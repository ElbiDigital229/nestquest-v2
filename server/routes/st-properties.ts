import { Router, Request, Response } from "express";
import { db } from "../db/index";
import { stProperties, stPropertyPhotos, stPropertyAmenities, stPropertyPolicies, stPropertyDocuments, stAcquisitionDetails, stPaymentSchedules, areas, pmPoLinks, guests, users } from "../../shared/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { logPropertyActivity } from "../utils/property-activity";
import { createNotification } from "../utils/notify";
import { getPmUserId, requirePmPermission } from "../middleware/pm-permissions";

// Helper: get PM user ID (resolves team member → parent PM)
async function resolvePmId(req: Request): Promise<string> {
  const role = req.session.userRole;
  if (role === "PROPERTY_MANAGER") return req.session.userId!;
  if (role === "PM_TEAM_MEMBER") return getPmUserId(req);
  return req.session.userId!;
}

const router = Router();

// All routes require authentication
router.use(requireAuth);

// Helper: verify PM or team member role
function isPM(req: Request): boolean {
  return req.session.userRole === "PROPERTY_MANAGER" || req.session.userRole === "PM_TEAM_MEMBER";
}

// ── GET /areas — List all areas (for dropdowns and map) ──

router.get("/areas", async (req: Request, res: Response) => {
  try {
    const { city } = req.query;

    let results;
    if (city) {
      results = await db
        .select({
          id: areas.id,
          name: areas.name,
          city: areas.city,
          latitude: areas.latitude,
          longitude: areas.longitude,
        })
        .from(areas)
        .where(eq(areas.city, city as string))
        .orderBy(areas.name);
    } else {
      results = await db
        .select({
          id: areas.id,
          name: areas.name,
          city: areas.city,
          latitude: areas.latitude,
          longitude: areas.longitude,
        })
        .from(areas)
        .orderBy(areas.name);
    }

    return res.json(results);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── GET / — List all ST properties for the logged-in PM ──

router.get("/", requirePmPermission("properties.view"), async (req: Request, res: Response) => {
  try {
    if (!isPM(req)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const pmId = await resolvePmId(req);

    const results = await db.execute(sql`
      SELECT
        p.id,
        p.public_name AS "publicName",
        p.status,
        p.property_type AS "propertyType",
        p.city,
        a.name AS "area",
        p.bedrooms,
        p.bathrooms,
        p.max_guests AS "maxGuests",
        p.address_line_1 AS "addressLine1",
        p.short_description AS "shortDescription",
        p.nightly_rate AS "nightlyRate",
        p.cancellation_policy AS "cancellationPolicy",
        p.po_user_id AS "poUserId",
        p.commission_type AS "commissionType",
        p.commission_value AS "commissionValue",
        p.acquisition_type AS "acquisitionType",
        p.confirmed AS "agreementConfirmed",
        ph.url AS "coverPhotoUrl",
        COALESCE(photo_counts.cnt, 0)::int AS "photosCount",
        COALESCE(amenity_counts.cnt, 0)::int AS "amenitiesCount",
        COALESCE(doc_counts.cnt, 0)::int AS "documentsCount",
        COALESCE(doc_counts.has_title, false) AS "hasTitle",
        COALESCE(doc_counts.has_spa, false) AS "hasSpa",
        COALESCE(doc_counts.has_noc, false) AS "hasNoc",
        COALESCE(doc_counts.has_dtcm, false) AS "hasDtcm",
        p.wizard_step AS "wizardStep",
        p.created_at AS "createdAt",
        p.updated_at AS "updatedAt"
      FROM st_properties p
      LEFT JOIN areas a ON a.id = p.area_id
      LEFT JOIN st_property_photos ph ON ph.property_id = p.id AND ph.is_cover = true
      LEFT JOIN (
        SELECT property_id, COUNT(*)::int AS cnt FROM st_property_photos GROUP BY property_id
      ) photo_counts ON photo_counts.property_id = p.id
      LEFT JOIN (
        SELECT property_id, COUNT(*)::int AS cnt FROM st_property_amenities GROUP BY property_id
      ) amenity_counts ON amenity_counts.property_id = p.id
      LEFT JOIN (
        SELECT property_id,
          COUNT(*)::int AS cnt,
          bool_or(document_type = 'title_deed') AS has_title,
          bool_or(document_type = 'spa') AS has_spa,
          bool_or(document_type = 'noc') AS has_noc,
          bool_or(document_type = 'dtcm') AS has_dtcm
        FROM st_property_documents GROUP BY property_id
      ) doc_counts ON doc_counts.property_id = p.id
      WHERE p.pm_user_id = ${pmId}
      ORDER BY p.updated_at DESC
    `);

    return res.json(results.rows);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── POST / — Create a new draft property ──

router.post("/", requirePmPermission("properties.create"), async (req: Request, res: Response) => {
  try {
    if (!isPM(req)) {
      return res.status(403).json({ error: "Access denied" });
    }
    const pmId = await resolvePmId(req);
    const actorId = req.session.userId!;

    const result = await db.transaction(async (tx) => {
      const [property] = await tx
        .insert(stProperties)
        .values({
          pmUserId: pmId,
          status: "draft",
        })
        .returning({ id: stProperties.id });

      // Create empty acquisition details row
      await tx.insert(stAcquisitionDetails).values({
        propertyId: property.id,
      });

      return property;
    });

    await logPropertyActivity(result.id, actorId, "property_created", "Property draft created");

    return res.status(201).json({ id: result.id });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── PO: GET /po/my-properties — List PO's properties ──

router.get("/po/my-properties", async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const userRole = req.session.userRole!;

    if (userRole !== "PROPERTY_OWNER") {
      return res.status(403).json({ error: "Only property owners can access this" });
    }

    const propResult = await db.execute(sql`
      SELECT p.id, p.public_name AS name, p.city, p.area_id AS "areaId",
        p.property_type AS "propertyType", p.status, p.acquisition_type AS "acquisitionType",
        p.pm_user_id AS "pmUserId", p.created_at AS "createdAt",
        a.purchase_price AS "purchasePrice", a.purchase_date AS "purchaseDate",
        (SELECT url FROM st_property_photos WHERE property_id = p.id AND is_cover = true LIMIT 1) AS "coverPhoto",
        (SELECT name FROM areas WHERE id = p.area_id) AS "areaName",
        (SELECT full_name FROM guests WHERE user_id = p.pm_user_id LIMIT 1) AS "pmName"
      FROM st_properties p
      LEFT JOIN st_acquisition_details a ON a.property_id = p.id
      WHERE p.po_user_id = ${userId}
      ORDER BY p.created_at DESC
    `);
    const results = propResult.rows || [];

    return res.json(results);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── GET /reports/earnings — PM earnings across all properties ──

router.get("/reports/earnings", async (req: Request, res: Response) => {
  try {
    if (!isPM(req)) return res.status(403).json({ error: "Access denied" });
    const userId = req.session.userId!;

    // Per-property breakdown
    const propertyResult = await db.execute(sql`
      SELECT
        p.id, p.public_name AS "publicName", p.building_name AS "buildingName", p.unit_number AS "unitNumber",
        COUNT(b.id)::int AS "bookingCount",
        COALESCE(SUM(b.subtotal::decimal + b.tourism_tax::decimal + b.vat::decimal), 0) AS "totalIncome",
        COALESCE(SUM(b.commission_amount::decimal), 0) AS "commission",
        COALESCE(SUM(b.owner_payout_amount::decimal), 0) AS "ownerPayout"
      FROM st_properties p
      LEFT JOIN st_bookings b ON b.property_id = p.id
        AND b.status IN ('confirmed', 'checked_in', 'checked_out', 'completed')
      WHERE p.pm_user_id = ${userId}
      GROUP BY p.id
      ORDER BY COALESCE(SUM(b.commission_amount::decimal), 0) DESC
    `);

    // Totals
    const totalsResult = await db.execute(sql`
      SELECT
        COUNT(b.id)::int AS "totalBookings",
        COALESCE(SUM(b.subtotal::decimal + b.tourism_tax::decimal + b.vat::decimal), 0) AS "totalBookingIncome",
        COALESCE(SUM(b.commission_amount::decimal), 0) AS "totalCommission",
        COALESCE(SUM(b.owner_payout_amount::decimal), 0) AS "totalOwnerPayouts"
      FROM st_bookings b
      JOIN st_properties p ON p.id = b.property_id
      WHERE p.pm_user_id = ${userId}
        AND b.status IN ('confirmed', 'checked_in', 'checked_out', 'completed')
    `);
    const totals = (totalsResult.rows[0] || {}) as any;

    // Recent bookings with commission
    const recentResult = await db.execute(sql`
      SELECT
        b.id, b.status,
        b.check_in_date AS "checkIn", b.check_out_date AS "checkOut",
        b.total_amount AS "totalAmount", b.commission_amount AS "commission",
        b.created_at AS "createdAt",
        p.public_name AS "propertyName",
        COALESCE(g.full_name, b.guest_name, 'Guest') AS "guestName"
      FROM st_bookings b
      JOIN st_properties p ON p.id = b.property_id
      LEFT JOIN guests g ON g.user_id = b.guest_user_id
      WHERE p.pm_user_id = ${userId}
        AND b.status IN ('confirmed', 'checked_in', 'checked_out', 'completed')
      ORDER BY b.created_at DESC
      LIMIT 20
    `);

    return res.json({
      totalCommission: parseFloat(totals.totalCommission || "0").toFixed(2),
      totalBookings: totals.totalBookings || 0,
      totalBookingIncome: parseFloat(totals.totalBookingIncome || "0").toFixed(2),
      totalOwnerPayouts: parseFloat(totals.totalOwnerPayouts || "0").toFixed(2),
      properties: propertyResult.rows,
      recentBookings: recentResult.rows,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── GET /settlements — PM/PO settlement ledger ──

router.get("/settlements", requirePmPermission("financials.view"), async (req: Request, res: Response) => {
  try {
    const userRole = req.session.userRole!;

    if (!["PROPERTY_MANAGER", "PM_TEAM_MEMBER", "PROPERTY_OWNER"].includes(userRole!)) {
      return res.status(403).json({ error: "Access denied" });
    }

    // For PM/team, resolve to PM ID; for PO use own ID
    const isPmOrTeam = userRole === "PROPERTY_MANAGER" || userRole === "PM_TEAM_MEMBER";
    const userId = isPmOrTeam ? await resolvePmId(req) : req.session.userId!;

    // Get settlements where user is either from or to
    const result = await db.execute(sql`
      SELECT
        s.id, s.booking_id AS "bookingId", s.expense_id AS "expenseId", s.property_id AS "propertyId",
        s.from_user_id AS "fromUserId", s.to_user_id AS "toUserId",
        s.amount, s.reason, s.payment_method_used AS "paymentMethodUsed",
        s.collected_by AS "collectedBy", s.status, s.notes,
        s.paid_at AS "paidAt", s.confirmed_at AS "confirmedAt",
        s.proof_url AS "proofUrl",
        s.created_at AS "createdAt",
        p.public_name AS "propertyName", p.building_name AS "buildingName", p.unit_number AS "unitNumber",
        from_g.full_name AS "fromName",
        to_g.full_name AS "toName",
        b.check_in_date AS "checkIn", b.check_out_date AS "checkOut",
        b.total_amount AS "bookingTotal",
        COALESCE(guest_g.full_name, b.guest_name, e.description, 'N/A') AS "guestName",
        e.category AS "expenseCategory", e.description AS "expenseDescription"
      FROM pm_po_settlements s
      JOIN st_properties p ON p.id = s.property_id
      LEFT JOIN st_bookings b ON b.id = s.booking_id
      LEFT JOIN st_property_expenses e ON e.id = s.expense_id
      LEFT JOIN guests from_g ON from_g.user_id = s.from_user_id
      LEFT JOIN guests to_g ON to_g.user_id = s.to_user_id
      LEFT JOIN guests guest_g ON guest_g.user_id = b.guest_user_id
      WHERE s.from_user_id = ${userId} OR s.to_user_id = ${userId}
      ORDER BY s.created_at DESC
    `);

    // Summary stats
    const pendingOwed = (result.rows as any[])
      .filter(s => s.fromUserId === userId && s.status === "pending")
      .reduce((sum, s) => sum + parseFloat(s.amount), 0);

    const pendingReceivable = (result.rows as any[])
      .filter(s => s.toUserId === userId && s.status === "pending")
      .reduce((sum, s) => sum + parseFloat(s.amount), 0);

    const totalPaid = (result.rows as any[])
      .filter(s => s.fromUserId === userId && s.status === "paid")
      .reduce((sum, s) => sum + parseFloat(s.amount), 0);

    const totalReceived = (result.rows as any[])
      .filter(s => s.toUserId === userId && s.status === "paid")
      .reduce((sum, s) => sum + parseFloat(s.amount), 0);

    return res.json({
      settlements: result.rows,
      summary: {
        pendingOwed: pendingOwed.toFixed(2),
        pendingReceivable: pendingReceivable.toFixed(2),
        totalPaid: totalPaid.toFixed(2),
        totalReceived: totalReceived.toFixed(2),
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── PATCH /settlements/:id/pay — Mark settlement as paid ──

router.patch("/settlements/:id/pay", requirePmPermission("financials.manage"), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { notes, proofUrl } = req.body;
    const isPmOrTeam = req.session.userRole === "PROPERTY_MANAGER" || req.session.userRole === "PM_TEAM_MEMBER";
    const resolvedId = isPmOrTeam ? await resolvePmId(req) : req.session.userId!;

    const result = await db.execute(sql`
      SELECT * FROM pm_po_settlements WHERE id = ${id} AND (from_user_id = ${resolvedId} OR to_user_id = ${resolvedId}) AND status = 'pending'
    `);
    if (result.rows.length === 0) return res.status(404).json({ error: "Settlement not found" });

    await db.execute(sql`
      UPDATE pm_po_settlements SET status = 'confirmed', paid_at = NOW(), confirmed_at = NOW(), notes = ${notes || null}, proof_url = ${proofUrl || null}, updated_at = NOW()
      WHERE id = ${id}
    `);

    // Sync booking owner_payout_status if this is an owner_payout settlement
    const settlement = result.rows[0] as any;
    if (settlement.reason === 'owner_payout' && settlement.booking_id) {
      await db.execute(sql`
        UPDATE st_bookings SET owner_payout_status = 'paid', updated_at = NOW()
        WHERE id = ${settlement.booking_id}
      `);
    }
    // Get PM name for notification
    const pmNameResult = await db.execute(sql`SELECT full_name FROM guests WHERE user_id = ${resolvedId} LIMIT 1`);
    const pmName = (pmNameResult.rows[0] as any)?.full_name || "Property Manager";

    await createNotification({
      userId: settlement.to_user_id,
      type: "INVOICE_CREATED",
      title: `Settlement payment from ${pmName}`,
      body: `${pmName} has paid you AED ${settlement.amount} for a booking settlement. Please review and confirm receipt.`,
      linkUrl: "/portal/settlements",
      relatedId: settlement.booking_id,
    });

    return res.json({ status: "paid" });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── PATCH /settlements/:id/confirm — PO confirms receipt ──

router.patch("/settlements/:id/confirm", async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const { id } = req.params;

    const result = await db.execute(sql`
      SELECT * FROM pm_po_settlements WHERE id = ${id} AND to_user_id = ${userId} AND status = 'paid'
    `);
    if (result.rows.length === 0) return res.status(404).json({ error: "Settlement not found or not yet paid" });

    await db.execute(sql`
      UPDATE pm_po_settlements SET status = 'confirmed', confirmed_at = NOW(), updated_at = NOW()
      WHERE id = ${id}
    `);

    return res.json({ status: "confirmed" });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── GET /documents — All documents across properties and linked users ──

router.get("/documents", requirePmPermission("documents.view"), async (req: Request, res: Response) => {
  try {
    const userRole = req.session.userRole;
    if (!userRole || !["PROPERTY_MANAGER", "PM_TEAM_MEMBER", "PROPERTY_OWNER"].includes(userRole)) {
      return res.status(403).json({ error: "Access denied" });
    }
    const userId = req.session.userId!;
    const isPmOrTeam = userRole === "PROPERTY_MANAGER" || userRole === "PM_TEAM_MEMBER";
    const resolvedPmId = isPmOrTeam ? await resolvePmId(req) : userId;

    // Property documents: PM/team sees managed properties, PO sees owned properties
    const propertyWhereClause = isPmOrTeam
      ? sql`p.pm_user_id = ${resolvedPmId}`
      : sql`p.po_user_id = ${userId}`;

    const propertyDocs = await db.execute(sql`
      SELECT
        pd.id,
        pd.document_type AS "documentType",
        pd.name,
        pd.description,
        pd.file_url AS "fileUrl",
        pd.has_expiry AS "hasExpiry",
        pd.expiry_date AS "expiryDate",
        pd.created_at AS "createdAt",
        'property' AS "source",
        p.id AS "propertyId",
        p.public_name AS "propertyName",
        p.building_name AS "buildingName",
        p.unit_number AS "unitNumber",
        NULL AS "userName",
        NULL AS "userEmail",
        NULL AS "userRole"
      FROM st_property_documents pd
      JOIN st_properties p ON p.id = pd.property_id
      WHERE ${propertyWhereClause}
      ORDER BY pd.created_at DESC
    `);

    // User documents: PM/team sees PM's own + linked POs/Tenants; PO sees own only
    const userDocsWhereClause = isPmOrTeam
      ? sql`ud.user_id = ${resolvedPmId}
         OR ud.user_id IN (
           SELECT target_user_id FROM pm_po_links
           WHERE pm_user_id = ${resolvedPmId} AND status = 'accepted'
         )`
      : sql`ud.user_id = ${userId}`;

    const userDocs = await db.execute(sql`
      SELECT
        ud.id,
        dt.slug AS "documentType",
        dt.label AS "name",
        NULL AS "description",
        ud.file_url AS "fileUrl",
        dt.has_expiry AS "hasExpiry",
        ud.expiry_date AS "expiryDate",
        ud.created_at AS "createdAt",
        'user' AS "source",
        NULL AS "propertyId",
        NULL AS "propertyName",
        NULL AS "buildingName",
        NULL AS "unitNumber",
        g.full_name AS "userName",
        u.email AS "userEmail",
        u.role AS "userRole"
      FROM user_documents ud
      JOIN document_types dt ON dt.id = ud.document_type_id
      JOIN users u ON u.id = ud.user_id
      LEFT JOIN guests g ON g.user_id = u.id
      WHERE ${userDocsWhereClause}
      ORDER BY ud.created_at DESC
    `);

    return res.json({
      propertyDocuments: propertyDocs.rows,
      userDocuments: userDocs.rows,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── GET /:id — Get full property details ──

router.get("/:id", requirePmPermission("properties.view"), async (req: Request, res: Response) => {
  try {
    const userRole = req.session.userRole;
    if (!userRole || !["PROPERTY_MANAGER", "PM_TEAM_MEMBER", "PROPERTY_OWNER"].includes(userRole)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const { id } = req.params;
    const userId = (userRole === "PROPERTY_MANAGER" || userRole === "PM_TEAM_MEMBER")
      ? await resolvePmId(req) : req.session.userId;

    // Get property using Drizzle (returns camelCase keys)
    const [property] = await db
      .select()
      .from(stProperties)
      .where(eq(stProperties.id, id))
      .limit(1);

    if (!property) {
      return res.status(404).json({ error: "Property not found" });
    }

    // PM/team must own it, PO must be linked
    if ((userRole === "PROPERTY_MANAGER" || userRole === "PM_TEAM_MEMBER") && property.pmUserId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }
    if (userRole === "PROPERTY_OWNER" && property.poUserId !== req.session.userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Get area name
    let areaName: string | null = null;
    if (property.areaId) {
      const [area] = await db.select({ name: areas.name }).from(areas).where(eq(areas.id, property.areaId)).limit(1);
      areaName = area?.name || null;
    }

    // Fetch related data in parallel
    const [photos, amenities, policies, documents, acquisitionRows, paymentSchedules] = await Promise.all([
      db.select().from(stPropertyPhotos).where(eq(stPropertyPhotos.propertyId, id)).orderBy(stPropertyPhotos.displayOrder),
      db.select().from(stPropertyAmenities).where(eq(stPropertyAmenities.propertyId, id)),
      db.select().from(stPropertyPolicies).where(eq(stPropertyPolicies.propertyId, id)).orderBy(stPropertyPolicies.displayOrder),
      db.select().from(stPropertyDocuments).where(eq(stPropertyDocuments.propertyId, id)),
      db.select().from(stAcquisitionDetails).where(eq(stAcquisitionDetails.propertyId, id)).limit(1),
      db.select().from(stPaymentSchedules).where(eq(stPaymentSchedules.propertyId, id)).orderBy(stPaymentSchedules.displayOrder),
    ]);

    return res.json({
      ...property,
      areaName,
      photosCount: photos.length,
      agreementConfirmed: property.confirmed,
      photos,
      amenities: amenities.map(a => a.amenityKey),
      policies,
      documents,
      acquisitionDetails: acquisitionRows[0] || null,
      paymentSchedules,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── PATCH /:id — Update property (auto-save / manual save) ──

router.patch("/:id", requirePmPermission("properties.edit"), async (req: Request, res: Response) => {
  try {
    if (!isPM(req)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const { id } = req.params;
    const userId = req.session.userId;

    // Verify ownership
    const [existing] = await db
      .select({ pmUserId: stProperties.pmUserId })
      .from(stProperties)
      .where(eq(stProperties.id, id))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: "Property not found" });
    }
    if (existing.pmUserId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Build update object from body — only allow st_properties columns
    const allowedFields = [
      "propertyType", "unitNumber", "floorNumber", "buildingName", "areaSqft",
      "bedrooms", "bathrooms", "maxGuests", "maidRoom", "furnished",
      "ceilingHeight", "viewType", "smartHome",
      "addressLine1", "addressLine2", "city", "zipCode", "latitude", "longitude", "areaId",
      "parkingSpaces", "parkingType", "accessType", "lockDeviceId",
      "publicName", "shortDescription", "longDescription", "internalNotes",
      "nightlyRate", "weekendRate", "minimumStay", "cleaningFee",
      "securityDepositRequired", "securityDepositAmount",
      "acceptedPaymentMethods", "bankAccountBelongsTo", "bankName",
      "accountHolderName", "accountNumber", "iban", "swiftCode", "paymentMethodConfig",
      "checkInTime", "checkOutTime", "cancellationPolicy",
      "poUserId", "commissionType", "commissionValue",
      "acquisitionType", "confirmed", "wizardStep", "status",
    ];

    const updates: Record<string, any> = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      // No fields to update — return current property (no-op save)
      const [current] = await db
        .select()
        .from(stProperties)
        .where(eq(stProperties.id, id))
        .limit(1);
      return res.json(current);
    }

    updates.updatedAt = new Date();

    await db.update(stProperties).set(updates).where(eq(stProperties.id, id));

    // Log significant changes
    const changedKeys = Object.keys(updates).filter(k => k !== "updatedAt" && k !== "wizardStep");
    if (changedKeys.length > 0) {
      // Determine action type
      let action = "property_updated";
      let desc = `Updated: ${changedKeys.join(", ")}`;

      if (updates.status === "active" && existing.status !== "active") {
        action = "property_activated"; desc = "Property activated";
      } else if (updates.status === "inactive") {
        action = "property_deactivated"; desc = "Property deactivated";
      } else if (updates.status && updates.status !== existing.status) {
        action = "status_changed"; desc = `Status changed to ${updates.status}`;
      } else if (updates.confirmed === true) {
        action = "agreement_confirmed"; desc = "Agreement confirmed";
      } else if (updates.poUserId && !existing.poUserId) {
        action = "owner_assigned"; desc = "Property owner assigned";
      } else if (updates.poUserId === null && existing.poUserId) {
        action = "owner_removed"; desc = "Property owner removed";
      } else if (updates.acquisitionType !== undefined) {
        action = "acquisition_updated"; desc = `Acquisition type set to ${updates.acquisitionType}`;
      } else if (changedKeys.some(k => ["nightlyRate", "weekendRate", "minimumStay", "cleaningFee", "securityDepositRequired", "securityDepositAmount"].includes(k))) {
        action = "pricing_updated"; desc = "Pricing updated";
      } else if (changedKeys.some(k => ["checkInTime", "checkOutTime", "cancellationPolicy"].includes(k))) {
        action = "policies_updated"; desc = "Policies updated";
      } else if (changedKeys.some(k => ["publicName", "shortDescription", "longDescription", "internalNotes"].includes(k))) {
        action = "description_updated"; desc = "Description updated";
      } else if (changedKeys.some(k => ["propertyType", "bedrooms", "bathrooms", "maxGuests", "areaSqft", "viewType", "unitNumber", "buildingName", "floorNumber"].includes(k))) {
        action = "details_updated"; desc = "Property details updated";
      }

      await logPropertyActivity(id, userId!, action, desc, { fields: changedKeys });
    }

    // Return updated property
    const [updated] = await db
      .select()
      .from(stProperties)
      .where(eq(stProperties.id, id))
      .limit(1);

    return res.json(updated);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── DELETE /:id — Delete a draft property ──

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    if (!isPM(req)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const { id } = req.params;
    const userId = req.session.userId;

    const [existing] = await db
      .select({ pmUserId: stProperties.pmUserId, status: stProperties.status })
      .from(stProperties)
      .where(eq(stProperties.id, id))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: "Property not found" });
    }
    if (existing.pmUserId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }
    if (existing.status !== "draft") {
      return res.status(400).json({ error: "Only draft properties can be deleted" });
    }

    // Cascade deletes handled by FK constraints, but delete explicitly for safety
    await db.transaction(async (tx) => {
      await tx.delete(stPaymentSchedules).where(eq(stPaymentSchedules.propertyId, id));
      await tx.delete(stAcquisitionDetails).where(eq(stAcquisitionDetails.propertyId, id));
      await tx.delete(stPropertyDocuments).where(eq(stPropertyDocuments.propertyId, id));
      await tx.delete(stPropertyPolicies).where(eq(stPropertyPolicies.propertyId, id));
      await tx.delete(stPropertyAmenities).where(eq(stPropertyAmenities.propertyId, id));
      await tx.delete(stPropertyPhotos).where(eq(stPropertyPhotos.propertyId, id));
      await tx.delete(stProperties).where(eq(stProperties.id, id));
    });

    return res.json({ message: "Property deleted successfully" });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── POST /:id/publish — Go Live ──

router.post("/:id/publish", async (req: Request, res: Response) => {
  try {
    if (!isPM(req)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const { id } = req.params;
    const userId = req.session.userId;

    const [property] = await db
      .select()
      .from(stProperties)
      .where(eq(stProperties.id, id))
      .limit(1);

    if (!property) {
      return res.status(404).json({ error: "Property not found" });
    }
    if (property.pmUserId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }
    if (property.status !== "draft") {
      return res.status(400).json({ error: "Only draft properties can be published" });
    }

    // Validate required fields
    const missingFields: string[] = [];
    const requiredChecks: [string, any][] = [
      ["propertyType", property.propertyType],
      ["bedrooms", property.bedrooms],
      ["bathrooms", property.bathrooms],
      ["maxGuests", property.maxGuests],
      ["addressLine1", property.addressLine1],
      ["city", property.city],
      ["latitude", property.latitude],
      ["longitude", property.longitude],
      ["publicName", property.publicName],
      ["shortDescription", property.shortDescription],
      ["nightlyRate", property.nightlyRate],
      ["acceptedPaymentMethods", property.acceptedPaymentMethods],
      ["cancellationPolicy", property.cancellationPolicy],
      ["checkInTime", property.checkInTime],
      ["checkOutTime", property.checkOutTime],
      ["poUserId", property.poUserId],
      ["commissionType", property.commissionType],
      ["commissionValue", property.commissionValue],
      ["acquisitionType", property.acquisitionType],
    ];

    for (const [name, value] of requiredChecks) {
      if (value === null || value === undefined || value === "") {
        missingFields.push(name);
      }
    }

    if (!property.confirmed) {
      missingFields.push("confirmed");
    }

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: "Missing required fields",
        missingFields,
      });
    }

    // Validate minimum 5 photos
    const [photoCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(stPropertyPhotos)
      .where(eq(stPropertyPhotos.propertyId, id));

    if (photoCount.count < 5) {
      return res.status(400).json({
        error: "Minimum 5 photos required to publish",
        photoCount: photoCount.count,
      });
    }

    // Publish
    await db
      .update(stProperties)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(stProperties.id, id));

    return res.json({ message: "Property published successfully" });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── POST /:id/unpublish — Take offline ──

router.post("/:id/unpublish", async (req: Request, res: Response) => {
  try {
    if (!isPM(req)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const { id } = req.params;
    const userId = req.session.userId;

    const [property] = await db
      .select({ pmUserId: stProperties.pmUserId, status: stProperties.status })
      .from(stProperties)
      .where(eq(stProperties.id, id))
      .limit(1);

    if (!property) {
      return res.status(404).json({ error: "Property not found" });
    }
    if (property.pmUserId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }
    if (property.status !== "active") {
      return res.status(400).json({ error: "Only active properties can be unpublished" });
    }

    await db
      .update(stProperties)
      .set({ status: "inactive", updatedAt: new Date() })
      .where(eq(stProperties.id, id));

    return res.json({ message: "Property unpublished successfully" });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── Photo CRUD ──────────────────────────────────────────

// Helper: verify PM owns the property
async function verifyOwnership(propertyId: string, userId: string) {
  const [prop] = await db
    .select({ pmUserId: stProperties.pmUserId })
    .from(stProperties)
    .where(eq(stProperties.id, propertyId))
    .limit(1);
  if (!prop) return { error: "Property not found", status: 404 };
  if (prop.pmUserId !== userId) return { error: "Access denied", status: 403 };
  return null;
}

// POST /:id/photos — Add photo
router.post("/:id/photos", async (req: Request, res: Response) => {
  try {
    if (!isPM(req)) return res.status(403).json({ error: "Access denied" });
    const { id } = req.params;
    const err = await verifyOwnership(id, await resolvePmId(req));
    if (err) return res.status(err.status).json({ error: err.error });

    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "url is required" });

    // Get current max display order
    const [maxRow] = await db.execute(sql`
      SELECT COALESCE(MAX(display_order), -1) AS max_order FROM st_property_photos WHERE property_id = ${id}
    `).then(r => r.rows as any[]);
    const nextOrder = (maxRow?.max_order ?? -1) + 1;

    // Check if first photo
    const [countRow] = await db.execute(sql`
      SELECT COUNT(*)::int AS cnt FROM st_property_photos WHERE property_id = ${id}
    `).then(r => r.rows as any[]);
    const isFirst = countRow.cnt === 0;

    const [photo] = await db.insert(stPropertyPhotos).values({
      propertyId: id,
      url,
      displayOrder: nextOrder,
      isCover: isFirst,
    }).returning();

    await logPropertyActivity(id, req.session.userId!, "photo_added", "Photo added", { photoId: photo.id });

    return res.status(201).json(photo);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// PATCH /:id/photos/reorder — Bulk reorder (must be before /:photoId)
router.patch("/:id/photos/reorder", async (req: Request, res: Response) => {
  try {
    if (!isPM(req)) return res.status(403).json({ error: "Access denied" });
    const { id } = req.params;
    const err = await verifyOwnership(id, await resolvePmId(req));
    if (err) return res.status(err.status).json({ error: err.error });

    const { order } = req.body;
    if (!Array.isArray(order)) return res.status(400).json({ error: "order must be an array of photo IDs" });

    for (let i = 0; i < order.length; i++) {
      await db.update(stPropertyPhotos)
        .set({ displayOrder: i })
        .where(and(eq(stPropertyPhotos.id, order[i]), eq(stPropertyPhotos.propertyId, id)));
    }

    return res.json({ message: "Photos reordered" });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// PATCH /:id/photos/:photoId — Update photo (cover, order)
router.patch("/:id/photos/:photoId", async (req: Request, res: Response) => {
  try {
    if (!isPM(req)) return res.status(403).json({ error: "Access denied" });
    const { id, photoId } = req.params;
    const err = await verifyOwnership(id, await resolvePmId(req));
    if (err) return res.status(err.status).json({ error: err.error });

    const updates: any = {};
    if (req.body.isCover === true) {
      // Unset all covers first
      await db.update(stPropertyPhotos)
        .set({ isCover: false })
        .where(eq(stPropertyPhotos.propertyId, id));
      updates.isCover = true;
    }
    if (typeof req.body.displayOrder === "number") {
      updates.displayOrder = req.body.displayOrder;
    }

    const [updated] = await db.update(stPropertyPhotos)
      .set(updates)
      .where(and(eq(stPropertyPhotos.id, photoId), eq(stPropertyPhotos.propertyId, id)))
      .returning();

    return res.json(updated);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// DELETE /:id/photos/:photoId — Delete photo
router.delete("/:id/photos/:photoId", async (req: Request, res: Response) => {
  try {
    if (!isPM(req)) return res.status(403).json({ error: "Access denied" });
    const { id, photoId } = req.params;
    const err = await verifyOwnership(id, await resolvePmId(req));
    if (err) return res.status(err.status).json({ error: err.error });

    // Check if deleting cover
    const [photo] = await db.select({ isCover: stPropertyPhotos.isCover })
      .from(stPropertyPhotos)
      .where(and(eq(stPropertyPhotos.id, photoId), eq(stPropertyPhotos.propertyId, id)))
      .limit(1);

    if (!photo) return res.status(404).json({ error: "Photo not found" });

    await db.delete(stPropertyPhotos)
      .where(and(eq(stPropertyPhotos.id, photoId), eq(stPropertyPhotos.propertyId, id)));

    // If deleted cover, reassign to first remaining
    if (photo.isCover) {
      const [first] = await db.select({ id: stPropertyPhotos.id })
        .from(stPropertyPhotos)
        .where(eq(stPropertyPhotos.propertyId, id))
        .orderBy(stPropertyPhotos.displayOrder)
        .limit(1);
      if (first) {
        await db.update(stPropertyPhotos)
          .set({ isCover: true })
          .where(eq(stPropertyPhotos.id, first.id));
      }
    }

    await logPropertyActivity(id, req.session.userId!, "photo_removed", "Photo removed", { photoId });

    return res.json({ message: "Photo deleted" });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── Amenities CRUD ──────────────────────────────────────

// PUT /:id/amenities — Sync amenities (replace all)
router.put("/:id/amenities", async (req: Request, res: Response) => {
  try {
    if (!isPM(req)) return res.status(403).json({ error: "Access denied" });
    const { id } = req.params;
    const err = await verifyOwnership(id, await resolvePmId(req));
    if (err) return res.status(err.status).json({ error: err.error });

    const { amenities } = req.body;
    if (!Array.isArray(amenities)) {
      return res.status(400).json({ error: "amenities must be an array of strings" });
    }

    await db.transaction(async (tx) => {
      // Delete all existing amenities
      await tx.delete(stPropertyAmenities).where(eq(stPropertyAmenities.propertyId, id));

      // Insert new ones
      if (amenities.length > 0) {
        await tx.insert(stPropertyAmenities).values(
          amenities.map((key: string) => ({
            propertyId: id,
            amenityKey: key,
          })),
        );
      }
    });

    // Update timestamp
    await db.update(stProperties).set({ updatedAt: new Date() }).where(eq(stProperties.id, id));

    return res.json({ message: "Amenities updated", count: amenities.length });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── Policy CRUD ─────────────────────────────────────────

// POST /:id/policies — Add a custom policy
router.post("/:id/policies", async (req: Request, res: Response) => {
  try {
    if (!isPM(req)) return res.status(403).json({ error: "Access denied" });
    const { id } = req.params;
    const err = await verifyOwnership(id, await resolvePmId(req));
    if (err) return res.status(err.status).json({ error: err.error });

    const { name, description } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ error: "name is required" });
    }

    // Get next display order
    const [maxRow] = await db.execute(sql`
      SELECT COALESCE(MAX(display_order), -1) AS max_order FROM st_property_policies WHERE property_id = ${id}
    `).then(r => r.rows as any[]);
    const nextOrder = (maxRow?.max_order ?? -1) + 1;

    const [policy] = await db.insert(stPropertyPolicies).values({
      propertyId: id,
      name: name.trim(),
      description: description?.trim() || null,
      displayOrder: nextOrder,
    }).returning();

    await db.update(stProperties).set({ updatedAt: new Date() }).where(eq(stProperties.id, id));

    return res.status(201).json(policy);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// PATCH /:id/policies/:policyId — Update a policy
router.patch("/:id/policies/:policyId", async (req: Request, res: Response) => {
  try {
    if (!isPM(req)) return res.status(403).json({ error: "Access denied" });
    const { id, policyId } = req.params;
    const err = await verifyOwnership(id, await resolvePmId(req));
    if (err) return res.status(err.status).json({ error: err.error });

    const updates: any = {};
    if (req.body.name !== undefined) updates.name = req.body.name;
    if (req.body.description !== undefined) updates.description = req.body.description;
    if (typeof req.body.displayOrder === "number") updates.displayOrder = req.body.displayOrder;

    const [updated] = await db.update(stPropertyPolicies)
      .set(updates)
      .where(and(eq(stPropertyPolicies.id, policyId), eq(stPropertyPolicies.propertyId, id)))
      .returning();

    return res.json(updated);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// DELETE /:id/policies/:policyId — Delete a policy
router.delete("/:id/policies/:policyId", async (req: Request, res: Response) => {
  try {
    if (!isPM(req)) return res.status(403).json({ error: "Access denied" });
    const { id, policyId } = req.params;
    const err = await verifyOwnership(id, await resolvePmId(req));
    if (err) return res.status(err.status).json({ error: err.error });

    await db.delete(stPropertyPolicies)
      .where(and(eq(stPropertyPolicies.id, policyId), eq(stPropertyPolicies.propertyId, id)));

    return res.json({ message: "Policy deleted" });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// PATCH /:id/policies/reorder — Bulk reorder policies (must be before /:policyId in route order, but Express matches by registration order)
router.patch("/:id/policies-reorder", async (req: Request, res: Response) => {
  try {
    if (!isPM(req)) return res.status(403).json({ error: "Access denied" });
    const { id } = req.params;
    const err = await verifyOwnership(id, await resolvePmId(req));
    if (err) return res.status(err.status).json({ error: err.error });

    const { order } = req.body;
    if (!Array.isArray(order)) return res.status(400).json({ error: "order must be an array of policy IDs" });

    for (let i = 0; i < order.length; i++) {
      await db.update(stPropertyPolicies)
        .set({ displayOrder: i })
        .where(and(eq(stPropertyPolicies.id, order[i]), eq(stPropertyPolicies.propertyId, id)));
    }

    return res.json({ message: "Policies reordered" });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── Acquisition Details CRUD ─────────────────────────────

// PATCH /:id/acquisition — Update acquisition details
router.patch("/:id/acquisition", async (req: Request, res: Response) => {
  try {
    if (!isPM(req)) return res.status(403).json({ error: "Access denied" });
    const { id } = req.params;
    const err = await verifyOwnership(id, await resolvePmId(req));
    if (err) return res.status(err.status).json({ error: err.error });

    const allowedFields = [
      "purchasePrice", "purchaseDate", "downPayment",
      "annualRent", "numCheques", "paymentMethod", "tenancyStart", "tenancyEnd", "securityDepositPaid",
      "bankLender", "loanAmount", "interestRate", "loanTermYears", "monthlyEmi", "mortgageStart", "mortgageEnd",
      "expectedHandover", "handoverStatus",
      "dewaNo", "internetProvider", "internetAccountNo", "gasNo",
    ];

    const updates: Record<string, any> = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    updates.updatedAt = new Date();

    await db
      .update(stAcquisitionDetails)
      .set(updates)
      .where(eq(stAcquisitionDetails.propertyId, id));

    // Also bump the property's updatedAt
    await db.update(stProperties).set({ updatedAt: new Date() }).where(eq(stProperties.id, id));

    const [updated] = await db
      .select()
      .from(stAcquisitionDetails)
      .where(eq(stAcquisitionDetails.propertyId, id))
      .limit(1);

    return res.json(updated);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── Document CRUD ────────────────────────────────────────

// POST /:id/documents — Add a document
router.post("/:id/documents", async (req: Request, res: Response) => {
  try {
    if (!isPM(req)) return res.status(403).json({ error: "Access denied" });
    const { id } = req.params;
    const err = await verifyOwnership(id, await resolvePmId(req));
    if (err) return res.status(err.status).json({ error: err.error });

    const { documentType, name, fileUrl, hasExpiry, expiryDate } = req.body;
    if (!documentType) {
      return res.status(400).json({ error: "documentType is required" });
    }

    const [doc] = await db.insert(stPropertyDocuments).values({
      propertyId: id,
      documentType,
      name: name || null,
      fileUrl: fileUrl || null,
      hasExpiry: hasExpiry ?? false,
      expiryDate: expiryDate || null,
    }).returning();

    await db.update(stProperties).set({ updatedAt: new Date() }).where(eq(stProperties.id, id));
    await logPropertyActivity(id, req.session.userId!, "document_added", `Document added: ${documentType}`, { documentType, docId: doc.id });

    return res.status(201).json(doc);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// DELETE /:id/documents/:docId — Delete a document
router.delete("/:id/documents/:docId", async (req: Request, res: Response) => {
  try {
    if (!isPM(req)) return res.status(403).json({ error: "Access denied" });
    const { id, docId } = req.params;
    const err = await verifyOwnership(id, await resolvePmId(req));
    if (err) return res.status(err.status).json({ error: err.error });

    await db.delete(stPropertyDocuments)
      .where(and(eq(stPropertyDocuments.id, docId), eq(stPropertyDocuments.propertyId, id)));

    await logPropertyActivity(id, req.session.userId!, "document_removed", "Document removed", { docId });

    return res.json({ message: "Document deleted" });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── GET /:id/activity — Get activity log for a property ──

router.get("/:id/activity", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.session.userId!;
    const userRole = req.session.userRole!;

    // Verify access
    const propRes = await db.execute(
      sql`SELECT pm_user_id AS "pmUserId", po_user_id AS "poUserId" FROM st_properties WHERE id = ${id}`
    );
    const prop = (propRes.rows || [])[0] as { pmUserId: string; poUserId: string | null } | undefined;
    if (!prop) return res.status(404).json({ error: "Property not found" });

    if (userRole === "PROPERTY_MANAGER" && prop.pmUserId !== userId) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (userRole === "PROPERTY_OWNER" && prop.poUserId !== userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const result = await db.execute(sql`
      SELECT a.id, a.action, a.description, a.metadata, a.created_at AS "createdAt",
        g.full_name AS "userName"
      FROM st_property_activity_log a
      LEFT JOIN guests g ON g.user_id = a.user_id
      WHERE a.property_id = ${id}
      ORDER BY a.created_at DESC
      LIMIT 100
    `);

    return res.json(result.rows || []);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── GET /:id/expenses — List expenses for a property ──

router.get("/:id/expenses", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.session.userId!;
    const userRole = req.session.userRole!;

    // Verify access: PM owns it, or PO is linked
    const propRes = await db.execute(
      sql`SELECT pm_user_id AS "pmUserId", po_user_id AS "poUserId" FROM st_properties WHERE id = ${id}`
    );
    const prop = (propRes.rows || [])[0] as { pmUserId: string; poUserId: string | null } | undefined;
    if (!prop) return res.status(404).json({ error: "Property not found" });

    if (userRole === "PROPERTY_MANAGER" && prop.pmUserId !== userId) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (userRole === "PROPERTY_OWNER" && prop.poUserId !== userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const expResult = await db.execute(
      sql`SELECT id, property_id AS "propertyId", category, description, amount,
          expense_date AS "expenseDate", receipt_url AS "receiptUrl",
          bill_image_url AS "billImageUrl", payment_status AS "paymentStatus",
          paid_date AS "paidDate", payment_proof_url AS "paymentProofUrl",
          responsible_party AS "responsibleParty", paid_by AS "paidBy", notes,
          created_at AS "createdAt", updated_at AS "updatedAt"
          FROM st_property_expenses WHERE property_id = ${id} ORDER BY expense_date DESC`
    );
    const expenses = expResult.rows || [];

    return res.json(expenses);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── GET /:id/investment-summary — Investment summary for a property ──

router.get("/:id/investment-summary", requirePmPermission("financials.view"), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userRole = req.session.userRole!;
    const isPmOrTeam = userRole === "PROPERTY_MANAGER" || userRole === "PM_TEAM_MEMBER";
    const resolvedId = isPmOrTeam ? await resolvePmId(req) : req.session.userId!;

    const propResult = await db.execute(
      sql`SELECT pm_user_id AS "pmUserId", po_user_id AS "poUserId" FROM st_properties WHERE id = ${id}`
    );
    const prop = (propResult.rows || [])[0] as { pmUserId: string; poUserId: string | null } | undefined;
    if (!prop) return res.status(404).json({ error: "Property not found" });

    if (isPmOrTeam && prop.pmUserId !== resolvedId) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (userRole === "PROPERTY_OWNER" && prop.poUserId !== resolvedId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Get acquisition details (acquisition_type is on st_properties, not st_acquisition_details)
    const acqResult = await db.execute(
      sql`SELECT a.purchase_price AS "purchasePrice", a.purchase_date AS "purchaseDate", p.acquisition_type AS "acquisitionType"
          FROM st_acquisition_details a
          JOIN st_properties p ON p.id = a.property_id
          WHERE a.property_id = ${id} LIMIT 1`
    );
    const acquisition = (acqResult.rows || [])[0] as { purchasePrice: string; purchaseDate: string | null; acquisitionType: string | null } | undefined;

    // Get all expenses for this property using raw SQL
    const expenseResult = await db.execute(
      sql`SELECT id, category, description, amount, expense_date FROM st_property_expenses WHERE property_id = ${id}`
    );
    const allExpenses = (expenseResult.rows || []) as { id: string; category: string; description: string | null; amount: string; expense_date: string }[];

    const totalExpensesNum = allExpenses.reduce((sum, e) => sum + parseFloat(e.amount || "0"), 0);
    const expenseCount = allExpenses.length;

    // Category breakdown
    const catMap: Record<string, { total: number; count: number }> = {};
    for (const e of allExpenses) {
      if (!catMap[e.category]) catMap[e.category] = { total: 0, count: 0 };
      catMap[e.category].total += parseFloat(e.amount || "0");
      catMap[e.category].count += 1;
    }
    const categoryBreakdown = Object.entries(catMap)
      .map(([category, { total, count }]) => ({ category, total: total.toFixed(2), count }))
      .sort((a, b) => parseFloat(b.total) - parseFloat(a.total));

    const purchasePrice = parseFloat(acquisition?.purchasePrice || "0");
    const totalExpenses = totalExpensesNum;

    // Booking income: exclude security deposit from income (it's not revenue)
    const incomeResult = await db.execute(sql`
      SELECT
        COUNT(*)::int AS "bookingCount",
        COALESCE(SUM(
          b.subtotal::decimal + b.tourism_tax::decimal + b.vat::decimal
        ), 0) AS "totalIncome",
        COALESCE(SUM(b.subtotal::decimal), 0) AS "totalSubtotal",
        COALESCE(SUM(b.cleaning_fee::decimal), 0) AS "totalCleaningFees",
        COALESCE(SUM(b.tourism_tax::decimal), 0) AS "totalTourismTax",
        COALESCE(SUM(b.vat::decimal), 0) AS "totalVat",
        COALESCE(SUM(b.commission_amount::decimal), 0) AS "totalCommission",
        COALESCE(SUM(b.owner_payout_amount::decimal), 0) AS "totalOwnerPayout"
      FROM st_bookings b
      WHERE b.property_id = ${id}
        AND b.status IN ('confirmed', 'checked_in', 'checked_out', 'completed')
    `);
    const income = (incomeResult.rows[0] || {}) as any;

    // Security deposit tracking from st_security_deposits
    const depositResult = await db.execute(sql`
      SELECT
        COALESCE(SUM(sd.amount::decimal), 0) AS "totalCollected",
        COALESCE(SUM(CASE WHEN sd.status IN ('returned', 'partially_returned') THEN COALESCE(sd.returned_amount::decimal, 0) ELSE 0 END), 0) AS "totalReturned",
        COALESCE(SUM(CASE WHEN sd.status IN ('pending', 'received') THEN sd.amount::decimal ELSE 0 END), 0) AS "currentlyHeld",
        COALESCE(SUM(
          CASE
            WHEN sd.status = 'forfeited' THEN sd.amount::decimal
            WHEN sd.status = 'partially_returned' THEN sd.amount::decimal - COALESCE(sd.returned_amount::decimal, 0)
            ELSE 0
          END
        ), 0) AS "totalForfeited"
      FROM st_security_deposits sd
      JOIN st_bookings b ON b.id = sd.booking_id
      WHERE b.property_id = ${id}
    `);
    const deposits = (depositResult.rows[0] || {}) as any;

    // Inventory value
    const inventoryResult = await db.execute(sql`
      SELECT COALESCE(SUM(quantity * unit_cost::decimal), 0) AS "inventoryValue"
      FROM st_property_inventory WHERE property_id = ${id}
    `);
    const inventoryValue = parseFloat((inventoryResult.rows[0] as any)?.inventoryValue || "0");

    const totalIncome = parseFloat(income.totalIncome || "0");
    const totalCommission = parseFloat(income.totalCommission || "0");
    // Net profit = Revenue - Commission - Inventory - Expenses
    const totalCosts = totalCommission + inventoryValue + totalExpenses;
    const netProfit = totalIncome - totalCosts;

    return res.json({
      purchasePrice: acquisition?.purchasePrice || "0",
      purchaseDate: acquisition?.purchaseDate || null,
      acquisitionType: acquisition?.acquisitionType || null,
      totalExpenses: totalExpenses.toFixed(2),
      expenseCount,
      inventoryValue: inventoryValue.toFixed(2),
      totalInvestment: (purchasePrice + totalExpenses + inventoryValue).toFixed(2),
      categoryBreakdown,
      // Income (excludes security deposits)
      totalIncome: totalIncome.toFixed(2),
      bookingCount: income.bookingCount || 0,
      totalSubtotal: parseFloat(income.totalSubtotal || "0").toFixed(2),
      totalCleaningFees: parseFloat(income.totalCleaningFees || "0").toFixed(2),
      totalCommission: totalCommission.toFixed(2),
      totalOwnerPayout: parseFloat(income.totalOwnerPayout || "0").toFixed(2),
      totalCosts: totalCosts.toFixed(2),
      netProfit: netProfit.toFixed(2),
      // Security deposits (separate from income)
      depositsCollected: parseFloat(deposits.totalCollected || "0").toFixed(2),
      depositsReturned: parseFloat(deposits.totalReturned || "0").toFixed(2),
      depositsHeld: parseFloat(deposits.currentlyHeld || "0").toFixed(2),
      depositsForfeited: parseFloat(deposits.totalForfeited || "0").toFixed(2),
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── GET /:id/transactions — Unified transaction history ──

router.get("/:id/transactions", requirePmPermission("financials.view"), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.session.userId!;
    const userRole = req.session.userRole!;

    const propResult = await db.execute(
      sql`SELECT pm_user_id AS "pmUserId", po_user_id AS "poUserId", acquisition_type AS "acquisitionType" FROM st_properties WHERE id = ${id}`
    );
    const prop = (propResult.rows || [])[0] as any;
    if (!prop) return res.status(404).json({ error: "Property not found" });
    if (userRole === "PROPERTY_MANAGER" && prop.pmUserId !== userId) return res.status(403).json({ error: "Forbidden" });
    if (userRole === "PROPERTY_OWNER" && prop.poUserId !== userId) return res.status(403).json({ error: "Forbidden" });

    const transactions: any[] = [];

    // 1. Property purchase
    const acqResult = await db.execute(sql`
      SELECT purchase_price, purchase_date FROM st_acquisition_details WHERE property_id = ${id} LIMIT 1
    `);
    const acq = (acqResult.rows || [])[0] as any;
    if (acq?.purchase_price && acq?.purchase_date) {
      transactions.push({
        id: `acq-${id}`,
        date: acq.purchase_date,
        type: "purchase",
        category: "Property Purchase",
        description: `Property acquired (${(prop.acquisitionType || "cash").replace(/_/g, " ")})`,
        amount: `-${acq.purchase_price}`,
        direction: "out",
      });
    }

    // 2. Expenses
    const expResult = await db.execute(sql`
      SELECT id, category, description, amount, expense_date FROM st_property_expenses WHERE property_id = ${id}
    `);
    for (const exp of expResult.rows as any[]) {
      const catLabel = exp.category?.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
      transactions.push({
        id: `exp-${exp.id}`,
        date: exp.expense_date,
        type: "expense",
        category: catLabel,
        description: exp.description || catLabel,
        amount: `-${exp.amount}`,
        direction: "out",
      });
    }

    // 3. Booking income, security deposits, commissions
    const bookingResult = await db.execute(sql`
      SELECT b.id, b.status, b.check_in_date, b.check_out_date, b.created_at,
        b.subtotal, b.cleaning_fee, b.tourism_tax, b.vat,
        b.security_deposit_amount, b.commission_amount, b.owner_payout_amount,
        b.total_amount,
        g.full_name AS "guestName",
        b.guest_name AS "manualGuestName"
      FROM st_bookings b
      LEFT JOIN guests g ON g.user_id = b.guest_user_id
      WHERE b.property_id = ${id}
        AND b.status IN ('confirmed', 'checked_in', 'checked_out', 'completed')
      ORDER BY b.created_at ASC
    `);

    for (const b of bookingResult.rows as any[]) {
      const guest = b.guestName || b.manualGuestName || "Guest";
      const checkIn = new Date(b.check_in_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
      const checkOut = new Date(b.check_out_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });

      // Booking income (subtotal + cleaning + tax + vat, excluding deposit)
      const incomeAmount = (
        parseFloat(b.subtotal || "0") +
        parseFloat(b.tourism_tax || "0") +
        parseFloat(b.vat || "0")
      ).toFixed(2);

      transactions.push({
        id: `booking-income-${b.id}`,
        date: b.created_at,
        type: "booking_income",
        category: "Booking Income",
        description: `${guest} (${checkIn} – ${checkOut})`,
        amount: `+${incomeAmount}`,
        direction: "in",
      });

      // Security deposit received
      if (b.security_deposit_amount && parseFloat(b.security_deposit_amount) > 0) {
        transactions.push({
          id: `deposit-in-${b.id}`,
          date: b.created_at,
          type: "security_deposit_in",
          category: "Security Deposit Received",
          description: `Deposit held for ${guest}`,
          amount: b.security_deposit_amount,
          direction: "hold",
        });
      }

      // PM Commission
      if (b.commission_amount && parseFloat(b.commission_amount) > 0) {
        transactions.push({
          id: `commission-${b.id}`,
          date: b.created_at,
          type: "commission",
          category: "PM Commission",
          description: `Commission for ${guest} booking`,
          amount: `-${b.commission_amount}`,
          direction: "out",
        });
      }
    }

    // 4. Security deposit returns
    const depositResult = await db.execute(sql`
      SELECT sd.id, sd.amount, sd.returned_amount, sd.returned_at, sd.status, sd.deductions,
        b.id AS "bookingId", g.full_name AS "guestName", b.guest_name AS "manualGuestName"
      FROM st_security_deposits sd
      JOIN st_bookings b ON b.id = sd.booking_id
      LEFT JOIN guests g ON g.user_id = b.guest_user_id
      WHERE b.property_id = ${id}
        AND sd.status IN ('returned', 'partially_returned', 'forfeited')
    `);

    for (const sd of depositResult.rows as any[]) {
      const guest = sd.guestName || sd.manualGuestName || "Guest";
      if (sd.status === "forfeited") {
        transactions.push({
          id: `deposit-forfeit-${sd.id}`,
          date: sd.returned_at || sd.created_at,
          type: "security_deposit_forfeited",
          category: "Security Deposit Forfeited",
          description: `Deposit forfeited from ${guest}`,
          amount: `+${sd.amount}`,
          direction: "in",
        });
      } else {
        const returned = sd.returned_amount || sd.amount;
        transactions.push({
          id: `deposit-out-${sd.id}`,
          date: sd.returned_at,
          type: "security_deposit_out",
          category: "Security Deposit Returned",
          description: `Deposit returned to ${guest}`,
          amount: `-${returned}`,
          direction: "out",
        });
      }
    }

    // Sort by date descending
    transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return res.json(transactions);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ══════════════════════════════════════════════════════
// INVENTORY
// ══════════════════════════════════════════════════════

// List inventory for a property
router.get("/:id/inventory", requirePmPermission("properties.view"), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await db.execute(sql`
      SELECT id, name, category, quantity, unit_cost AS "unitCost",
        (quantity * unit_cost::decimal)::text AS "totalCost",
        condition, purchase_date AS "purchaseDate", location, notes,
        created_at AS "createdAt"
      FROM st_property_inventory
      WHERE property_id = ${id}
      ORDER BY category, name
    `);
    return res.json(result.rows);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Inventory summary (totals by category)
router.get("/:id/inventory-summary", requirePmPermission("properties.view"), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const totals = await db.execute(sql`
      SELECT
        COUNT(*)::int AS "totalItems",
        COALESCE(SUM(quantity), 0)::int AS "totalQuantity",
        COALESCE(SUM(quantity * unit_cost::decimal), 0)::text AS "totalValue"
      FROM st_property_inventory WHERE property_id = ${id}
    `);

    const categories = await db.execute(sql`
      SELECT category,
        COUNT(*)::int AS "itemCount",
        SUM(quantity)::int AS "totalQuantity",
        SUM(quantity * unit_cost::decimal)::text AS "totalCost"
      FROM st_property_inventory
      WHERE property_id = ${id}
      GROUP BY category
      ORDER BY SUM(quantity * unit_cost::decimal) DESC
    `);

    const conditions = await db.execute(sql`
      SELECT condition,
        COUNT(*)::int AS "count",
        SUM(quantity)::int AS "totalQuantity"
      FROM st_property_inventory
      WHERE property_id = ${id}
      GROUP BY condition
    `);

    return res.json({
      ...(totals.rows[0] as any),
      categoryBreakdown: categories.rows,
      conditionBreakdown: conditions.rows,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Add inventory item
router.post("/:id/inventory", requirePmPermission("properties.edit"), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.session.userId!;
    const err = await verifyOwnership(id, await resolvePmId(req));
    if (err) return res.status(err.status).json({ error: err.error });

    const { name, category, quantity, unitCost, condition, purchaseDate, location, notes } = req.body;
    if (!name?.trim() || !category) return res.status(400).json({ error: "Name and category are required" });

    const itemId = crypto.randomUUID();
    await db.execute(sql`
      INSERT INTO st_property_inventory (id, property_id, name, category, quantity, unit_cost, condition, purchase_date, location, notes, created_by)
      VALUES (${itemId}, ${id}, ${name.trim()}, ${category}, ${quantity || 1}, ${String(unitCost || 0)}, ${condition || 'new'}, ${purchaseDate || null}, ${location || null}, ${notes || null}, ${userId})
    `);

    await logPropertyActivity(id, userId, "property_updated", `Inventory item added: ${name}`, { itemId, category, quantity, unitCost });

    return res.status(201).json({ id: itemId });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Update inventory item
router.patch("/:id/inventory/:itemId", requirePmPermission("properties.edit"), async (req: Request, res: Response) => {
  try {
    const { id, itemId } = req.params;
    const err = await verifyOwnership(id, await resolvePmId(req));
    if (err) return res.status(err.status).json({ error: err.error });

    const { name, category, quantity, unitCost, condition, purchaseDate, location, notes } = req.body;
    const sets: string[] = ["updated_at = NOW()"];
    if (name !== undefined) sets.push(`name = '${name.replace(/'/g, "''")}'`);
    if (category !== undefined) sets.push(`category = '${category}'`);
    if (quantity !== undefined) sets.push(`quantity = ${quantity}`);
    if (unitCost !== undefined) sets.push(`unit_cost = '${unitCost}'`);
    if (condition !== undefined) sets.push(`condition = '${condition}'`);
    if (purchaseDate !== undefined) sets.push(`purchase_date = ${purchaseDate ? `'${purchaseDate}'` : 'NULL'}`);
    if (location !== undefined) sets.push(`location = ${location ? `'${location.replace(/'/g, "''")}'` : 'NULL'}`);
    if (notes !== undefined) sets.push(`notes = ${notes ? `'${notes.replace(/'/g, "''")}'` : 'NULL'}`);

    await db.execute(sql.raw(`UPDATE st_property_inventory SET ${sets.join(", ")} WHERE id = '${itemId}' AND property_id = '${id}'`));
    return res.json({ message: "Item updated" });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Delete inventory item
router.delete("/:id/inventory/:itemId", requirePmPermission("properties.edit"), async (req: Request, res: Response) => {
  try {
    const { id, itemId } = req.params;
    const err = await verifyOwnership(id, await resolvePmId(req));
    if (err) return res.status(err.status).json({ error: err.error });

    await db.execute(sql`DELETE FROM st_property_inventory WHERE id = ${itemId} AND property_id = ${id}`);
    await logPropertyActivity(id, req.session.userId!, "property_updated", "Inventory item removed", { itemId });
    return res.json({ message: "Item deleted" });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ══════════════════════════════════════════════════════
// CALENDAR & PRICING MANAGEMENT
// ══════════════════════════════════════════════════════

// GET /:id/calendar-pricing — Full calendar data (bookings + blocks + pricing)
router.get("/:id/calendar-pricing", requirePmPermission("properties.view"), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { from, to } = req.query;
    const startDate = (from as string) || new Date().toISOString().slice(0, 10);
    const endDate = (to as string) || new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);

    // Property defaults
    const propResult = await db.execute(sql`
      SELECT nightly_rate AS "nightlyRate", weekend_rate AS "weekendRate",
        minimum_stay AS "minimumStay", cleaning_fee AS "cleaningFee"
      FROM st_properties WHERE id = ${id}
    `);
    const defaults = propResult.rows[0] as any || {};

    // Bookings in range
    const bookings = await db.execute(sql`
      SELECT b.id, b.status, b.check_in_date AS "checkIn", b.check_out_date AS "checkOut",
        b.total_amount AS "totalAmount", b.number_of_guests AS "guests",
        COALESCE(g.full_name, b.guest_name, 'Guest') AS "guestName",
        b.source
      FROM st_bookings b
      LEFT JOIN guests g ON g.user_id = b.guest_user_id
      WHERE b.property_id = ${id}
        AND b.check_out_date >= ${startDate}
        AND b.check_in_date <= ${endDate}
        AND b.status IN ('requested', 'confirmed', 'checked_in', 'checked_out', 'completed')
      ORDER BY b.check_in_date
    `);

    // Blocked dates in range
    const blocked = await db.execute(sql`
      SELECT id, start_date AS "startDate", end_date AS "endDate", reason
      FROM st_blocked_dates
      WHERE property_id = ${id}
        AND end_date >= ${startDate}
        AND start_date <= ${endDate}
    `);

    // Custom pricing in range
    const pricing = await db.execute(sql`
      SELECT id, date, price, min_stay AS "minStay", notes
      FROM st_property_pricing
      WHERE property_id = ${id}
        AND date >= ${startDate}
        AND date <= ${endDate}
      ORDER BY date
    `);

    return res.json({
      defaults,
      bookings: bookings.rows,
      blocked: blocked.rows,
      pricing: pricing.rows,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// PUT /:id/pricing — Bulk set prices for date range
router.put("/:id/pricing", requirePmPermission("properties.edit"), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const err = await verifyOwnership(id, await resolvePmId(req));
    if (err) return res.status(err.status).json({ error: err.error });

    const { startDate, endDate, price, minStay, notes, weekdayPrice, weekendPrice } = req.body;
    if (!startDate || !endDate) return res.status(400).json({ error: "Start and end dates required" });
    if (!price && !weekdayPrice && !weekendPrice) return res.status(400).json({ error: "Price required" });

    const start = new Date(startDate + "T00:00:00");
    const end = new Date(endDate + "T00:00:00");
    let count = 0;

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().slice(0, 10);
      const dayOfWeek = d.getDay();
      const isWeekend = dayOfWeek === 5 || dayOfWeek === 6; // Fri, Sat

      let dayPrice = price;
      if (weekdayPrice && weekendPrice) {
        dayPrice = isWeekend ? weekendPrice : weekdayPrice;
      } else if (weekendPrice && isWeekend) {
        dayPrice = weekendPrice;
      } else if (weekdayPrice && !isWeekend) {
        dayPrice = weekdayPrice;
      }

      if (dayPrice) {
        await db.execute(sql`
          INSERT INTO st_property_pricing (id, property_id, date, price, min_stay, notes)
          VALUES (gen_random_uuid()::text, ${id}, ${dateStr}, ${String(dayPrice)}, ${minStay || null}, ${notes || null})
          ON CONFLICT (property_id, date) DO UPDATE SET price = ${String(dayPrice)}, min_stay = ${minStay || null}, notes = ${notes || null}, updated_at = NOW()
        `);
        count++;
      }
    }

    await logPropertyActivity(id, req.session.userId!, "property_updated", `Bulk pricing set: ${count} days (${startDate} to ${endDate})`, { startDate, endDate, price, weekdayPrice, weekendPrice });

    return res.json({ message: `Updated pricing for ${count} days` });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// DELETE /:id/pricing — Reset pricing for date range to defaults
router.delete("/:id/pricing", requirePmPermission("properties.edit"), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const err = await verifyOwnership(id, await resolvePmId(req));
    if (err) return res.status(err.status).json({ error: err.error });

    const { startDate, endDate } = req.body;
    if (!startDate || !endDate) return res.status(400).json({ error: "Start and end dates required" });

    await db.execute(sql`
      DELETE FROM st_property_pricing
      WHERE property_id = ${id} AND date >= ${startDate} AND date <= ${endDate}
    `);

    return res.json({ message: "Pricing reset to defaults" });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// PATCH /:id/pricing/:date — Update single date price
router.patch("/:id/pricing/:date", requirePmPermission("properties.edit"), async (req: Request, res: Response) => {
  try {
    const { id, date } = req.params;
    const err = await verifyOwnership(id, await resolvePmId(req));
    if (err) return res.status(err.status).json({ error: err.error });

    const { price, minStay, notes } = req.body;
    if (!price) return res.status(400).json({ error: "Price required" });

    await db.execute(sql`
      INSERT INTO st_property_pricing (id, property_id, date, price, min_stay, notes)
      VALUES (gen_random_uuid()::text, ${id}, ${date}, ${String(price)}, ${minStay || null}, ${notes || null})
      ON CONFLICT (property_id, date) DO UPDATE SET price = ${String(price)}, min_stay = ${minStay || null}, notes = ${notes || null}, updated_at = NOW()
    `);

    return res.json({ message: "Price updated" });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── POST /:id/expenses — Add an expense ──

router.post("/:id/expenses", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.session.userId!;
    const pmId = await resolvePmId(req);

    if (!isPM(req)) return res.status(403).json({ error: "Only PMs can add expenses" });

    // Verify PM owns property
    const [prop] = await db.select({ pmUserId: stProperties.pmUserId })
      .from(stProperties).where(eq(stProperties.id, id));
    if (!prop) return res.status(404).json({ error: "Property not found" });
    if (prop.pmUserId !== pmId) return res.status(403).json({ error: "Forbidden" });

    const { category, description, amount, expenseDate, receiptUrl, billImageUrl, paymentStatus, paidDate, paymentProofUrl, responsibleParty, paidBy, notes } = req.body;
    if (!category || !amount || !expenseDate) {
      return res.status(400).json({ error: "category, amount, and expenseDate are required" });
    }
    if (!responsibleParty) return res.status(400).json({ error: "Responsible party is required" });
    if (!paidBy) return res.status(400).json({ error: "Paid by is required" });
    if (!paymentStatus) return res.status(400).json({ error: "Payment status is required" });
    if ((paymentStatus === "paid" || paymentStatus === "partial") && !paidDate) {
      return res.status(400).json({ error: "Paid date is required when payment status is paid" });
    }

    const expId = crypto.randomUUID();
    const insertResult = await db.execute(
      sql`INSERT INTO st_property_expenses (id, property_id, category, description, amount, expense_date, receipt_url, bill_image_url, payment_status, paid_date, payment_proof_url, responsible_party, paid_by, notes, created_by_user_id, created_at, updated_at)
          VALUES (${expId}, ${id}, ${sql.raw(`'${category}'::st_expense_category`)}, ${description || null}, ${String(amount)}, ${expenseDate}, ${receiptUrl || null}, ${billImageUrl || null}, ${paymentStatus || 'unpaid'}, ${paidDate || null}, ${paymentProofUrl || null}, ${responsibleParty || null}, ${paidBy || null}, ${notes || null}, ${userId}, NOW(), NOW())
          RETURNING *`
    );
    const expense = (insertResult.rows || [])[0];

    await logPropertyActivity(id, userId, "expense_added", `Expense added: ${category} — AED ${amount}`, { expenseId: expId, category, amount, description });

    // Auto-create settlement when responsible party ≠ paid by
    if (responsibleParty && paidBy && responsibleParty !== paidBy) {
      const prop = await db.execute(sql`SELECT pm_user_id, po_user_id FROM st_properties WHERE id = ${id}`);
      const p = prop.rows[0] as any;
      if (p?.po_user_id) {
        // Determine who owes whom
        const fromUserId = responsibleParty === "property_owner" ? p.po_user_id : p.pm_user_id;
        const toUserId = paidBy === "property_manager" ? p.pm_user_id : p.po_user_id;

        await db.execute(sql`
          INSERT INTO pm_po_settlements (id, property_id, expense_id, from_user_id, to_user_id, amount, reason, payment_method_used, collected_by, status, created_at, updated_at)
          VALUES (gen_random_uuid()::text, ${id}, ${expId}, ${fromUserId}, ${toUserId}, ${String(amount)}, ${'expense_reimbursement'}, ${paymentStatus === 'paid' ? 'bank_transfer' : null}, ${paidBy}, 'pending', NOW(), NOW())
        `);
      }
    }

    return res.status(201).json(expense);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── PATCH /:id/expenses/:expenseId — Update an expense ──

router.patch("/:id/expenses/:expenseId", async (req: Request, res: Response) => {
  try {
    const { id, expenseId } = req.params;
    const userId = req.session.userId!;

    if (!isPM(req)) return res.status(403).json({ error: "Only PMs can edit expenses" });

    const [prop] = await db.select({ pmUserId: stProperties.pmUserId })
      .from(stProperties).where(eq(stProperties.id, id));
    if (!prop || prop.pmUserId !== userId) return res.status(403).json({ error: "Forbidden" });

    const { category, description, amount, expenseDate, receiptUrl, billImageUrl, paymentStatus, paidDate, paymentProofUrl, responsibleParty, paidBy, notes } = req.body;
    const setClauses: string[] = ["updated_at = NOW()"];
    if (category !== undefined) setClauses.push(`category = '${category}'::st_expense_category`);
    if (description !== undefined) setClauses.push(`description = ${description === null ? 'NULL' : `'${description.replace(/'/g, "''")}'`}`);
    if (amount !== undefined) setClauses.push(`amount = '${String(amount)}'`);
    if (expenseDate !== undefined) setClauses.push(`expense_date = '${expenseDate}'`);
    if (receiptUrl !== undefined) setClauses.push(`receipt_url = ${receiptUrl === null ? 'NULL' : `'${receiptUrl}'`}`);
    if (billImageUrl !== undefined) setClauses.push(`bill_image_url = ${billImageUrl === null ? 'NULL' : `'${billImageUrl}'`}`);
    if (paymentStatus !== undefined) setClauses.push(`payment_status = '${paymentStatus}'`);
    if (paidDate !== undefined) setClauses.push(`paid_date = ${paidDate === null ? 'NULL' : `'${paidDate}'`}`);
    if (paymentProofUrl !== undefined) setClauses.push(`payment_proof_url = ${paymentProofUrl === null ? 'NULL' : `'${paymentProofUrl}'`}`);
    if (responsibleParty !== undefined) setClauses.push(`responsible_party = ${responsibleParty === null ? 'NULL' : `'${responsibleParty}'`}`);
    if (paidBy !== undefined) setClauses.push(`paid_by = ${paidBy === null ? 'NULL' : `'${paidBy}'`}`);
    if (notes !== undefined) setClauses.push(`notes = ${notes === null ? 'NULL' : `'${notes.replace(/'/g, "''")}'`}`);

    const updateResult = await db.execute(
      sql.raw(`UPDATE st_property_expenses SET ${setClauses.join(", ")} WHERE id = '${expenseId}' AND property_id = '${id}' RETURNING *`)
    );
    const updated = (updateResult.rows || [])[0];

    if (!updated) return res.status(404).json({ error: "Expense not found" });

    await logPropertyActivity(id, userId, "expense_updated", `Expense updated`, { expenseId, category, amount });

    return res.json(updated);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── DELETE /:id/expenses/:expenseId — Delete an expense ──

router.delete("/:id/expenses/:expenseId", async (req: Request, res: Response) => {
  try {
    const { id, expenseId } = req.params;
    const userId = req.session.userId!;

    if (!isPM(req)) return res.status(403).json({ error: "Only PMs can delete expenses" });

    const [prop] = await db.select({ pmUserId: stProperties.pmUserId })
      .from(stProperties).where(eq(stProperties.id, id));
    if (!prop || prop.pmUserId !== userId) return res.status(403).json({ error: "Forbidden" });

    await db.execute(
      sql`DELETE FROM st_property_expenses WHERE id = ${expenseId} AND property_id = ${id}`
    );

    await logPropertyActivity(id, userId, "expense_deleted", "Expense deleted", { expenseId });

    return res.json({ message: "Expense deleted" });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
