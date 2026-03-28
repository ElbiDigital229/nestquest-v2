import { Router, Request, Response } from "express";
import { db } from "../db/index";
import { sql } from "drizzle-orm";
import { requireRole } from "../middleware/auth";

const router = Router();

// All routes require PM role
router.use(requireRole("PROPERTY_MANAGER"));

// ── GET /api/pm-settings ──────────────────────────────
router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const result = await db.execute(sql`
      SELECT id, pm_user_id AS "pmUserId",
        tourism_tax_percent AS "tourismTaxPercent",
        vat_percent AS "vatPercent",
        default_check_in_time AS "defaultCheckInTime",
        default_check_out_time AS "defaultCheckOutTime",
        default_cancellation_policy AS "defaultCancellationPolicy",
        business_name AS "businessName",
        business_license AS "businessLicense",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM pm_settings WHERE pm_user_id = ${userId} LIMIT 1
    `);

    if (result.rows.length === 0) {
      // Return defaults if no settings exist yet
      return res.json({
        tourismTaxPercent: "0",
        vatPercent: "0",
        defaultCheckInTime: "15:00",
        defaultCheckOutTime: "12:00",
        defaultCancellationPolicy: null,
        businessName: null,
        businessLicense: null,
      });
    }

    return res.json(result.rows[0]);
  } catch (error: any) {
    console.error("[PM Settings] GET error:", error);
    return res.status(500).json({ error: "Failed to fetch settings" });
  }
});

// ── PUT /api/pm-settings ──────────────────────────────
router.put("/", async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const {
      tourismTaxPercent,
      vatPercent,
      defaultCheckInTime,
      defaultCheckOutTime,
      defaultCancellationPolicy,
      businessName,
      businessLicense,
    } = req.body;

    // Upsert: insert or update
    const existing = await db.execute(sql`
      SELECT id FROM pm_settings WHERE pm_user_id = ${userId} LIMIT 1
    `);

    if (existing.rows.length === 0) {
      const id = crypto.randomUUID();
      await db.execute(sql`
        INSERT INTO pm_settings (id, pm_user_id, tourism_tax_percent, vat_percent, default_check_in_time, default_check_out_time, default_cancellation_policy, business_name, business_license, created_at, updated_at)
        VALUES (${id}, ${userId}, ${tourismTaxPercent || "0"}, ${vatPercent || "0"}, ${defaultCheckInTime || "15:00"}, ${defaultCheckOutTime || "12:00"}, ${defaultCancellationPolicy ? sql.raw(`'${defaultCancellationPolicy}'::st_cancellation_policy`) : sql`NULL`}, ${businessName || null}, ${businessLicense || null}, NOW(), NOW())
      `);
    } else {
      await db.execute(sql`
        UPDATE pm_settings SET
          tourism_tax_percent = ${tourismTaxPercent || "0"},
          vat_percent = ${vatPercent || "0"},
          default_check_in_time = ${defaultCheckInTime || "15:00"},
          default_check_out_time = ${defaultCheckOutTime || "12:00"},
          default_cancellation_policy = ${defaultCancellationPolicy ? sql.raw(`'${defaultCancellationPolicy}'::st_cancellation_policy`) : sql`NULL`},
          business_name = ${businessName || null},
          business_license = ${businessLicense || null},
          updated_at = NOW()
        WHERE pm_user_id = ${userId}
      `);
    }

    // Return updated settings
    const result = await db.execute(sql`
      SELECT id, pm_user_id AS "pmUserId",
        tourism_tax_percent AS "tourismTaxPercent",
        vat_percent AS "vatPercent",
        default_check_in_time AS "defaultCheckInTime",
        default_check_out_time AS "defaultCheckOutTime",
        default_cancellation_policy AS "defaultCancellationPolicy",
        business_name AS "businessName",
        business_license AS "businessLicense"
      FROM pm_settings WHERE pm_user_id = ${userId} LIMIT 1
    `);

    return res.json(result.rows[0]);
  } catch (error: any) {
    console.error("[PM Settings] PUT error:", error);
    return res.status(500).json({ error: "Failed to save settings" });
  }
});

export default router;
