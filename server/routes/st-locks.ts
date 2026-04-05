import { Router, Request, Response } from "express";
import { db } from "../db/index";
import { sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { getPmUserId, requirePmPermission } from "../middleware/pm-permissions";
import { logPropertyActivity } from "../utils/property-activity";

const router = Router();
router.use(requireAuth);

async function resolvePmId(req: Request): Promise<string> {
  const role = req.session.userRole;
  if (role === "PM_TEAM_MEMBER") return getPmUserId(req);
  return req.session.userId!;
}

// GET / — all locks across all PM properties
router.get("/", requirePmPermission("properties.view"), async (req: Request, res: Response) => {
  try {
    const pmId = await resolvePmId(req);
    const result = await db.execute(sql`
      SELECT
        l.id, l.name, l.brand, l.model,
        l.device_id AS "deviceId",
        l.location, l.is_active AS "isActive",
        l.created_at AS "createdAt",
        l.property_id AS "propertyId",
        p.public_name AS "propertyName",
        p.address_line_1 AS "propertyAddress",
        (SELECT COUNT(*)::int FROM st_lock_pins pin WHERE pin.lock_id = l.id AND pin.status = 'active') AS "activePins"
      FROM st_property_locks l
      JOIN st_properties p ON p.id = l.property_id
      WHERE p.pm_user_id = ${pmId}
      ORDER BY p.public_name ASC, l.created_at DESC
    `);
    return res.json(result.rows);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST / — add lock to a property
router.post("/", requirePmPermission("properties.edit"), async (req: Request, res: Response) => {
  try {
    const pmId = await resolvePmId(req);
    const { propertyId, name, brand, model, deviceId, location, apiKey } = req.body;
    if (!propertyId) return res.status(400).json({ error: "propertyId is required" });
    if (!name?.trim()) return res.status(400).json({ error: "Lock name is required" });

    // Verify property belongs to this PM
    const check = await db.execute(sql`SELECT id FROM st_properties WHERE id = ${propertyId} AND pm_user_id = ${pmId}`);
    if (check.rows.length === 0) return res.status(403).json({ error: "Forbidden" });

    const lockId = crypto.randomUUID();
    await db.execute(sql`
      INSERT INTO st_property_locks (id, property_id, name, brand, model, device_id, location, api_key)
      VALUES (${lockId}, ${propertyId}, ${name.trim()}, ${brand || null}, ${model || null}, ${deviceId || null}, ${location || null}, ${apiKey || null})
    `);

    await logPropertyActivity(propertyId, req.session.userId!, "property_updated", `Smart lock added: ${name}`, { lockId });
    return res.status(201).json({ id: lockId });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// PATCH /:lockId — update lock
router.patch("/:lockId", requirePmPermission("properties.edit"), async (req: Request, res: Response) => {
  try {
    const pmId = await resolvePmId(req);
    const { lockId } = req.params;
    const { name, brand, model, deviceId, location, apiKey, isActive } = req.body;

    // Verify ownership via property
    const check = await db.execute(sql`
      SELECT l.id FROM st_property_locks l
      JOIN st_properties p ON p.id = l.property_id
      WHERE l.id = ${lockId} AND p.pm_user_id = ${pmId}
    `);
    if (check.rows.length === 0) return res.status(403).json({ error: "Forbidden" });

    const sets: string[] = ["updated_at = NOW()"];
    if (name !== undefined) sets.push(`name = '${name.replace(/'/g, "''")}'`);
    if (brand !== undefined) sets.push(`brand = ${brand ? `'${brand}'` : "NULL"}`);
    if (model !== undefined) sets.push(`model = ${model ? `'${model}'` : "NULL"}`);
    if (deviceId !== undefined) sets.push(`device_id = ${deviceId ? `'${deviceId}'` : "NULL"}`);
    if (location !== undefined) sets.push(`location = ${location ? `'${location.replace(/'/g, "''")}'` : "NULL"}`);
    if (apiKey !== undefined) sets.push(`api_key = ${apiKey ? `'${apiKey}'` : "NULL"}`);
    if (isActive !== undefined) sets.push(`is_active = ${isActive}`);

    await db.execute(sql.raw(`UPDATE st_property_locks SET ${sets.join(", ")} WHERE id = '${lockId}'`));
    return res.json({ message: "Lock updated" });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// DELETE /:lockId — delete lock
router.delete("/:lockId", requirePmPermission("properties.edit"), async (req: Request, res: Response) => {
  try {
    const pmId = await resolvePmId(req);
    const { lockId } = req.params;

    const check = await db.execute(sql`
      SELECT l.id FROM st_property_locks l
      JOIN st_properties p ON p.id = l.property_id
      WHERE l.id = ${lockId} AND p.pm_user_id = ${pmId}
    `);
    if (check.rows.length === 0) return res.status(403).json({ error: "Forbidden" });

    await db.execute(sql`DELETE FROM st_property_locks WHERE id = ${lockId}`);
    return res.json({ message: "Lock deleted" });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /pins — all PIN history across all PM properties
router.get("/pins", requirePmPermission("properties.view"), async (req: Request, res: Response) => {
  try {
    const pmId = await resolvePmId(req);
    const result = await db.execute(sql`
      SELECT
        pin.id, pin.pin, pin.status,
        pin.valid_from AS "validFrom", pin.valid_until AS "validUntil",
        pin.created_at AS "createdAt", pin.deactivated_at AS "deactivatedAt",
        l.name AS "lockName", l.location AS "lockLocation",
        p.public_name AS "propertyName",
        COALESCE(g.full_name, b.guest_name, 'Guest') AS "guestName",
        b.check_in_date AS "checkIn", b.check_out_date AS "checkOut"
      FROM st_lock_pins pin
      JOIN st_property_locks l ON l.id = pin.lock_id
      JOIN st_properties p ON p.id = l.property_id
      LEFT JOIN st_bookings b ON b.id = pin.booking_id
      LEFT JOIN users g ON g.id = b.guest_user_id
      WHERE p.pm_user_id = ${pmId}
      ORDER BY pin.created_at DESC
      LIMIT 100
    `);
    return res.json(result.rows);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
