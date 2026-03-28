import { Router, Request, Response } from "express";
import { db } from "../db/index";
import { stProperties, stPropertyPhotos, stPropertyAmenities, stPropertyPolicies, stPropertyDocuments, stAcquisitionDetails, stPaymentSchedules, areas, pmPoLinks, guests, users } from "../../shared/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { logPropertyActivity } from "../utils/property-activity";

const router = Router();

// All routes require authentication
router.use(requireAuth);

// Helper: verify PM role
function isPM(req: Request): boolean {
  return req.session.userRole === "PROPERTY_MANAGER";
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

router.get("/", async (req: Request, res: Response) => {
  try {
    if (!isPM(req)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const userId = req.session.userId;

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
      WHERE p.pm_user_id = ${userId}
      ORDER BY p.updated_at DESC
    `);

    return res.json(results.rows);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── POST / — Create a new draft property ──

router.post("/", async (req: Request, res: Response) => {
  try {
    if (!isPM(req)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const userId = req.session.userId;

    const result = await db.transaction(async (tx) => {
      const [property] = await tx
        .insert(stProperties)
        .values({
          pmUserId: userId,
          status: "draft",
        })
        .returning({ id: stProperties.id });

      // Create empty acquisition details row
      await tx.insert(stAcquisitionDetails).values({
        propertyId: property.id,
      });

      return property;
    });

    await logPropertyActivity(result.id, userId!, "property_created", "Property draft created");

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

// ── GET /:id — Get full property details ──

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const userRole = req.session.userRole;
    if (userRole !== "PROPERTY_MANAGER" && userRole !== "PROPERTY_OWNER") {
      return res.status(403).json({ error: "Access denied" });
    }

    const { id } = req.params;
    const userId = req.session.userId;

    // Get property using Drizzle (returns camelCase keys)
    const [property] = await db
      .select()
      .from(stProperties)
      .where(eq(stProperties.id, id))
      .limit(1);

    if (!property) {
      return res.status(404).json({ error: "Property not found" });
    }

    // PM must own it, PO must be linked
    if (userRole === "PROPERTY_MANAGER" && property.pmUserId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }
    if (userRole === "PROPERTY_OWNER" && property.poUserId !== userId) {
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

router.patch("/:id", async (req: Request, res: Response) => {
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
      "accountHolderName", "accountNumber", "iban", "swiftCode",
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
    const err = await verifyOwnership(id, req.session.userId!);
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
    const err = await verifyOwnership(id, req.session.userId!);
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
    const err = await verifyOwnership(id, req.session.userId!);
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
    const err = await verifyOwnership(id, req.session.userId!);
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
    const err = await verifyOwnership(id, req.session.userId!);
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
    const err = await verifyOwnership(id, req.session.userId!);
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
    const err = await verifyOwnership(id, req.session.userId!);
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
    const err = await verifyOwnership(id, req.session.userId!);
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
    const err = await verifyOwnership(id, req.session.userId!);
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
    const err = await verifyOwnership(id, req.session.userId!);
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
    const err = await verifyOwnership(id, req.session.userId!);
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
    const err = await verifyOwnership(id, req.session.userId!);
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

router.get("/:id/investment-summary", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.session.userId!;
    const userRole = req.session.userRole!;

    const propResult = await db.execute(
      sql`SELECT pm_user_id AS "pmUserId", po_user_id AS "poUserId" FROM st_properties WHERE id = ${id}`
    );
    const prop = (propResult.rows || [])[0] as { pmUserId: string; poUserId: string | null } | undefined;
    if (!prop) return res.status(404).json({ error: "Property not found" });

    if (userRole === "PROPERTY_MANAGER" && prop.pmUserId !== userId) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (userRole === "PROPERTY_OWNER" && prop.poUserId !== userId) {
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

    return res.json({
      purchasePrice: acquisition?.purchasePrice || "0",
      purchaseDate: acquisition?.purchaseDate || null,
      acquisitionType: acquisition?.acquisitionType || null,
      totalExpenses: totalExpenses.toFixed(2),
      expenseCount,
      totalInvestment: (purchasePrice + totalExpenses).toFixed(2),
      categoryBreakdown,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── POST /:id/expenses — Add an expense ──

router.post("/:id/expenses", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.session.userId!;

    if (!isPM(req)) return res.status(403).json({ error: "Only PMs can add expenses" });

    // Verify PM owns property
    const [prop] = await db.select({ pmUserId: stProperties.pmUserId })
      .from(stProperties).where(eq(stProperties.id, id));
    if (!prop) return res.status(404).json({ error: "Property not found" });
    if (prop.pmUserId !== userId) return res.status(403).json({ error: "Forbidden" });

    const { category, description, amount, expenseDate, receiptUrl } = req.body;
    if (!category || !amount || !expenseDate) {
      return res.status(400).json({ error: "category, amount, and expenseDate are required" });
    }

    const expId = crypto.randomUUID();
    const insertResult = await db.execute(
      sql`INSERT INTO st_property_expenses (id, property_id, category, description, amount, expense_date, receipt_url, created_by_user_id, created_at, updated_at)
          VALUES (${expId}, ${id}, ${sql.raw(`'${category}'::st_expense_category`)}, ${description || null}, ${String(amount)}, ${expenseDate}, ${receiptUrl || null}, ${userId}, NOW(), NOW())
          RETURNING id, property_id AS "propertyId", category, description, amount, expense_date AS "expenseDate", receipt_url AS "receiptUrl", created_at AS "createdAt", updated_at AS "updatedAt"`
    );
    const expense = (insertResult.rows || [])[0];

    await logPropertyActivity(id, userId, "expense_added", `Expense added: ${category} — AED ${amount}`, { expenseId: expId, category, amount, description });

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

    const { category, description, amount, expenseDate, receiptUrl } = req.body;
    const setClauses: string[] = ["updated_at = NOW()"];
    if (category !== undefined) setClauses.push(`category = '${category}'::st_expense_category`);
    if (description !== undefined) setClauses.push(`description = ${description === null ? 'NULL' : `'${description.replace(/'/g, "''")}'`}`);
    if (amount !== undefined) setClauses.push(`amount = '${String(amount)}'`);
    if (expenseDate !== undefined) setClauses.push(`expense_date = '${expenseDate}'`);
    if (receiptUrl !== undefined) setClauses.push(`receipt_url = ${receiptUrl === null ? 'NULL' : `'${receiptUrl}'`}`);

    const updateResult = await db.execute(
      sql.raw(`UPDATE st_property_expenses SET ${setClauses.join(", ")} WHERE id = '${expenseId}' AND property_id = '${id}' RETURNING id, category, description, amount, expense_date AS "expenseDate", receipt_url AS "receiptUrl", updated_at AS "updatedAt"`)
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
