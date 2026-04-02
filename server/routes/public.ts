import { Router, Request, Response } from "express";
import { db } from "../db/index";
import { sql } from "drizzle-orm";

const router = Router();

// ── GET /api/public/areas ─────────────────────────────
// Returns areas with property counts for search autocomplete
router.get("/areas", async (_req: Request, res: Response) => {
  try {
    const result = await db.execute(sql`
      SELECT a.id, a.name, a.city, a.latitude, a.longitude,
        COUNT(p.id)::int AS "propertyCount"
      FROM areas a
      LEFT JOIN st_properties p ON p.area_id = a.id AND p.status = 'active'
      GROUP BY a.id
      ORDER BY a.name ASC
    `);
    return res.json(result.rows);
  } catch (error: any) {
    console.error("[Public] GET areas error:", error);
    return res.status(500).json({ error: "Failed to fetch areas" });
  }
});

// ── GET /api/public/featured ──────────────────────────
// Returns featured active properties for homepage
router.get("/featured", async (_req: Request, res: Response) => {
  try {
    const result = await db.execute(sql`
      SELECT p.id, p.public_name AS "publicName", p.property_type AS "propertyType",
        p.bedrooms, p.bathrooms, p.max_guests AS "maxGuests",
        p.nightly_rate AS "nightlyRate", p.weekend_rate AS "weekendRate",
        p.cleaning_fee AS "cleaningFee",
        p.city, p.latitude, p.longitude,
        a.name AS "areaName",
        (SELECT url FROM st_property_photos WHERE property_id = p.id AND is_cover = true LIMIT 1) AS "coverPhoto",
        COALESCE((SELECT ROUND(AVG(r.rating), 1) FROM st_reviews r WHERE r.property_id = p.id), 0) AS "avgRating",
        COALESCE((SELECT COUNT(*)::int FROM st_reviews r WHERE r.property_id = p.id), 0) AS "reviewCount"
      FROM st_properties p
      LEFT JOIN areas a ON a.id = p.area_id
      WHERE p.status = 'active'
      ORDER BY p.created_at DESC
      LIMIT 12
    `);
    return res.json(result.rows);
  } catch (error: any) {
    console.error("[Public] GET featured error:", error);
    return res.status(500).json({ error: "Failed to fetch featured properties" });
  }
});

// ── GET /api/public/properties ────────────────────────
// Search/filter properties
router.get("/properties", async (req: Request, res: Response) => {
  try {
    const {
      areaId, city, checkIn, checkOut, guests,
      minPrice, maxPrice, propertyType, bedrooms,
      minRating, sort, page = "1", limit = "20",
    } = req.query as Record<string, string>;
    const amenities = req.query.amenities as string[] | string | undefined;

    const conditions: string[] = ["p.status = 'active'"];
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    if (areaId) conditions.push(`p.area_id = '${areaId}'`);
    if (city) conditions.push(`p.city::text ILIKE '${city}'`);
    if (guests) conditions.push(`p.max_guests >= ${parseInt(guests)}`);
    if (minPrice) conditions.push(`CAST(p.nightly_rate AS DECIMAL) >= ${parseFloat(minPrice)}`);
    if (maxPrice) conditions.push(`CAST(p.nightly_rate AS DECIMAL) <= ${parseFloat(maxPrice)}`);
    if (propertyType) conditions.push(`p.property_type = '${propertyType}'`);
    if (bedrooms) conditions.push(`p.bedrooms >= ${parseInt(bedrooms)}`);

    // Availability filter: exclude properties with overlapping bookings or blocked dates
    if (checkIn && checkOut) {
      conditions.push(`
        NOT EXISTS (
          SELECT 1 FROM st_bookings b
          WHERE b.property_id = p.id
          AND b.status IN ('confirmed', 'checked_in')
          AND b.check_in_date < '${checkOut}'
          AND b.check_out_date > '${checkIn}'
        )
        AND NOT EXISTS (
          SELECT 1 FROM st_blocked_dates bd
          WHERE bd.property_id = p.id
          AND bd.start_date < '${checkOut}'
          AND bd.end_date > '${checkIn}'
        )
      `);
    }

    // Amenities filter: property must have ALL specified amenities
    if (amenities) {
      const amenityList = Array.isArray(amenities) ? amenities : [amenities];
      for (const a of amenityList) {
        conditions.push(`EXISTS (SELECT 1 FROM st_property_amenities pa WHERE pa.property_id = p.id AND pa.amenity_key = '${a}')`);
      }
    }

    const whereClause = conditions.join(" AND ");

    // Rating filter uses HAVING
    const havingClause = minRating
      ? `HAVING COALESCE(AVG(r.rating), 0) >= ${parseFloat(minRating)}`
      : "";

    let orderBy = "p.created_at DESC";
    if (sort === "price_asc") orderBy = "CAST(p.nightly_rate AS DECIMAL) ASC NULLS LAST";
    else if (sort === "price_desc") orderBy = "CAST(p.nightly_rate AS DECIMAL) DESC NULLS LAST";
    else if (sort === "rating_desc") orderBy = "COALESCE(AVG(r.rating), 0) DESC";

    // Count total
    const countQuery = `
      SELECT COUNT(DISTINCT p.id)::int AS total
      FROM st_properties p
      LEFT JOIN st_reviews r ON r.property_id = p.id
      WHERE ${whereClause}
      ${havingClause ? `GROUP BY p.id ${havingClause}` : ""}
    `;

    // For count with HAVING, we need a subquery
    const countResult = minRating
      ? await db.execute(sql.raw(`SELECT COUNT(*)::int AS total FROM (SELECT p.id FROM st_properties p LEFT JOIN st_reviews r ON r.property_id = p.id WHERE ${whereClause} GROUP BY p.id ${havingClause}) sub`))
      : await db.execute(sql.raw(`SELECT COUNT(*)::int AS total FROM st_properties p WHERE ${whereClause}`));
    const total = countResult.rows[0]?.total || 0;

    const query = `
      SELECT p.id, p.public_name AS "publicName", p.property_type AS "propertyType",
        p.bedrooms, p.bathrooms, p.max_guests AS "maxGuests",
        p.nightly_rate AS "nightlyRate", p.weekend_rate AS "weekendRate",
        p.cleaning_fee AS "cleaningFee",
        p.minimum_stay AS "minimumStay",
        p.city, p.latitude, p.longitude,
        a.name AS "areaName",
        (SELECT url FROM st_property_photos WHERE property_id = p.id AND is_cover = true LIMIT 1) AS "coverPhoto",
        COALESCE(AVG(r.rating), 0)::DECIMAL(3,1) AS "avgRating",
        COUNT(r.id)::int AS "reviewCount"
      FROM st_properties p
      LEFT JOIN areas a ON a.id = p.area_id
      LEFT JOIN st_reviews r ON r.property_id = p.id
      WHERE ${whereClause}
      GROUP BY p.id, a.name
      ${havingClause}
      ORDER BY ${orderBy}
      LIMIT ${limitNum} OFFSET ${offset}
    `;

    const result = await db.execute(sql.raw(query));

    return res.json({
      properties: result.rows,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error: any) {
    console.error("[Public] GET properties error:", error);
    return res.status(500).json({ error: "Failed to search properties" });
  }
});

// ── GET /api/public/properties/:id/availability ───────
// Returns booked + blocked date ranges for calendar
router.get("/properties/:id/availability", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { from, to } = req.query as Record<string, string>;
    const startDate = from || new Date().toISOString().slice(0, 10);
    const endDate = to || new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10);

    const booked = await db.execute(sql`
      SELECT check_in_date AS "checkIn", check_out_date AS "checkOut", status
      FROM st_bookings WHERE property_id = ${id}
      AND status IN ('confirmed', 'checked_in', 'requested')
      AND check_in_date <= ${endDate} AND check_out_date >= ${startDate}
      ORDER BY check_in_date ASC
    `);
    const blocked = await db.execute(sql`
      SELECT start_date AS "startDate", end_date AS "endDate", reason
      FROM st_blocked_dates WHERE property_id = ${id}
      AND start_date <= ${endDate} AND end_date >= ${startDate}
      ORDER BY start_date ASC
    `);
    const prop = await db.execute(sql`SELECT minimum_stay AS "minimumStay" FROM st_properties WHERE id = ${id}`);

    return res.json({ booked: booked.rows, blocked: blocked.rows, minimumStay: prop.rows[0]?.minimumStay || 1 });
  } catch (error: any) {
    return res.status(500).json({ error: "Failed to fetch availability" });
  }
});

// ── GET /api/public/properties/:id/reviews ────────────
router.get("/properties/:id/reviews", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
    const offset = (page - 1) * limit;

    const countResult = await db.execute(sql`
      SELECT COUNT(*)::int AS total, COALESCE(AVG(rating), 0)::DECIMAL(3,1) AS "avgRating"
      FROM st_reviews WHERE property_id = ${id}
    `);
    const reviews = await db.execute(sql`
      SELECT r.id, r.rating, r.title, r.description,
        r.pm_response AS "pmResponse", r.created_at AS "createdAt",
        g.full_name AS "guestName"
      FROM st_reviews r LEFT JOIN guests g ON g.user_id = r.guest_user_id
      WHERE r.property_id = ${id} ORDER BY r.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    return res.json({
      reviews: reviews.rows, total: countResult.rows[0]?.total || 0,
      avgRating: countResult.rows[0]?.avgRating || 0, page,
      totalPages: Math.ceil((countResult.rows[0]?.total || 0) / limit),
    });
  } catch (error: any) {
    return res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

// ── GET /api/public/properties/:id ────────────────────
// Full property detail for public view
router.get("/properties/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Property details
    const propResult = await db.execute(sql`
      SELECT p.id, p.public_name AS "publicName", p.property_type AS "propertyType",
        p.status, p.bedrooms, p.bathrooms, p.max_guests AS "maxGuests",
        p.unit_number AS "unitNumber", p.floor_number AS "floorNumber",
        p.building_name AS "buildingName", p.area_sqft AS "areaSqft",
        p.view_type AS "viewType", p.maid_room AS "maidRoom",
        p.furnished, p.smart_home AS "smartHome",
        p.ceiling_height AS "ceilingHeight",
        p.address_line_1 AS "addressLine1", p.address_line_2 AS "addressLine2",
        p.city, p.latitude, p.longitude,
        p.parking_spaces AS "parkingSpaces", p.parking_type AS "parkingType",
        p.access_type AS "accessType",
        p.short_description AS "shortDescription", p.long_description AS "longDescription",
        p.nightly_rate AS "nightlyRate", p.weekend_rate AS "weekendRate",
        p.minimum_stay AS "minimumStay", p.cleaning_fee AS "cleaningFee",
        p.security_deposit_required AS "securityDepositRequired",
        p.security_deposit_amount AS "securityDepositAmount",
        p.accepted_payment_methods AS "acceptedPaymentMethods",
        p.check_in_time AS "checkInTime", p.check_out_time AS "checkOutTime",
        p.cancellation_policy AS "cancellationPolicy",
        a.name AS "areaName",
        pm_guest.full_name AS "pmName"
      FROM st_properties p
      LEFT JOIN areas a ON a.id = p.area_id
      LEFT JOIN guests pm_guest ON pm_guest.user_id = p.pm_user_id
      WHERE p.id = ${id} AND p.status = 'active'
    `);

    if (propResult.rows.length === 0) {
      return res.status(404).json({ error: "Property not found" });
    }

    const property = propResult.rows[0] as any;

    // Photos
    const photosResult = await db.execute(sql`
      SELECT id, url, display_order AS "displayOrder", is_cover AS "isCover"
      FROM st_property_photos WHERE property_id = ${id}
      ORDER BY is_cover DESC, display_order ASC
    `);

    // Amenities
    const amenResult = await db.execute(sql`
      SELECT amenity_key AS "amenityKey" FROM st_property_amenities WHERE property_id = ${id}
    `);

    // Policies (house rules)
    const polResult = await db.execute(sql`
      SELECT id, name, description, display_order AS "displayOrder"
      FROM st_property_policies WHERE property_id = ${id}
      ORDER BY display_order ASC
    `);

    // Reviews summary
    const reviewSummary = await db.execute(sql`
      SELECT COALESCE(AVG(rating), 0)::DECIMAL(3,1) AS "avgRating",
        COUNT(*)::int AS "reviewCount"
      FROM st_reviews WHERE property_id = ${id}
    `);

    // Derive coverPhoto from the photos array (first cover photo, or first photo)
    const coverPhoto = photosResult.rows.find((p: any) => p.isCover)?.url
      || photosResult.rows[0]?.url
      || null;

    return res.json({
      ...property,
      acceptedPaymentMethods: property.acceptedPaymentMethods ? JSON.parse(property.acceptedPaymentMethods) : [],
      coverPhoto,
      photos: photosResult.rows,
      amenities: amenResult.rows.map((r: any) => r.amenityKey),
      policies: polResult.rows,
      avgRating: reviewSummary.rows[0]?.avgRating || 0,
      reviewCount: reviewSummary.rows[0]?.reviewCount || 0,
    });
  } catch (error: any) {
    console.error("[Public] GET property detail error:", error);
    return res.status(500).json({ error: "Failed to fetch property" });
  }
});

// (availability and reviews routes moved before /:id)

export default router;
