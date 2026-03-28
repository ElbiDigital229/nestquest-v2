import { Router, Request, Response } from "express";
import { db } from "../db/index";
import { plans, planFeatures, subscriptions } from "../../shared/schema";
import { eq, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../middleware/auth";
import { sanitize } from "../utils/sanitize";

const router = Router();

router.use(requireAuth, requireRole("SUPER_ADMIN"));

// ── List plans with subscriber counts ────────────────────

router.get("/", async (_req: Request, res: Response) => {
  try {
    const rows = await db.execute(sql`
      SELECT
        p.id, p.name, p.description, p.price,
        p.billing_cycle AS "billingCycle",
        p.trial_days AS "trialDays",
        p.is_active AS "isActive",
        p.custom_cycle_days AS "customCycleDays",
        p.created_at AS "createdAt",
        (SELECT COUNT(*)::int FROM subscriptions s WHERE s.plan_id = p.id AND s.status IN ('active', 'trial')) AS "subscriberCount",
        (SELECT COUNT(*)::int FROM subscriptions s WHERE s.plan_id = p.id AND s.status = 'pending_payment') AS "pendingCount"
      FROM plans p
      ORDER BY p.created_at DESC
    `);

    const plansWithSubscribers = await Promise.all(
      (rows.rows as any[]).map(async (plan) => {
        const subs = await db.execute(sql`
          SELECT u.email, g.full_name AS "fullName", s.status, s.trial_ends_at AS "trialEndsAt", g.id AS "guestId"
          FROM subscriptions s
          JOIN users u ON u.id = s.user_id
          JOIN guests g ON g.user_id = u.id
          WHERE s.plan_id = ${plan.id} AND s.status IN ('active', 'trial')
          ORDER BY s.created_at DESC
        `);
        return { ...plan, subscribers: subs.rows };
      })
    );

    return res.json(plansWithSubscribers);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── Get plan + features ──────────────────────────────────

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const [plan] = await db.select().from(plans).where(eq(plans.id, req.params.id)).limit(1);
    if (!plan) return res.status(404).json({ error: "Plan not found" });

    const features = await db.select().from(planFeatures).where(eq(planFeatures.planId, plan.id));

    return res.json({ ...plan, features });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── Create plan + features ───────────────────────────────

router.post("/", async (req: Request, res: Response) => {
  try {
    const { name, description, price, billingCycle, trialDays, isActive, customCycleDays, features } = req.body;

    if (!name?.trim()) return res.status(400).json({ error: "Plan name is required" });

    // Sanitize text inputs
    const safeName = sanitize(name);
    const safeDescription = description ? sanitize(description) : null;

    // Validate price is non-negative
    const numericPrice = parseFloat(price || "0");
    if (isNaN(numericPrice) || numericPrice < 0) {
      return res.status(400).json({ error: "Price must be a non-negative number" });
    }

    // Check for duplicate plan name
    const [existingPlan] = await db.select({ id: plans.id }).from(plans)
      .where(eq(plans.name, safeName)).limit(1);
    if (existingPlan) {
      return res.status(409).json({ error: "A plan with this name already exists" });
    }

    const [plan] = await db.insert(plans).values({
      name: safeName,
      description: safeDescription,
      price: price || "0",
      billingCycle: billingCycle || "monthly",
      trialDays: trialDays ?? 7,
      isActive: isActive ?? true,
      customCycleDays: customCycleDays || null,
    }).returning();

    if (features?.length) {
      await db.insert(planFeatures).values(
        features.map((f: any) => ({
          planId: plan.id,
          featureKey: f.featureKey,
          limitType: f.limitType,
          booleanValue: f.booleanValue ?? null,
          numericMin: f.numericMin ?? null,
          numericMax: f.numericMax ?? null,
        }))
      );
    }

    const allFeatures = await db.select().from(planFeatures).where(eq(planFeatures.planId, plan.id));
    return res.status(201).json({ ...plan, features: allFeatures });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── Update plan + features ───────────────────────────────

router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const { name, description, price, billingCycle, trialDays, isActive, customCycleDays, features } = req.body;

    const [existing] = await db.select().from(plans).where(eq(plans.id, req.params.id)).limit(1);
    if (!existing) return res.status(404).json({ error: "Plan not found" });

    // Validate price if provided
    if (price !== undefined) {
      const numericPrice = parseFloat(price);
      if (isNaN(numericPrice) || numericPrice < 0) {
        return res.status(400).json({ error: "Price must be a non-negative number" });
      }
    }

    // Sanitize text inputs
    const safeName = name ? sanitize(name) : null;
    const safeDescription = description !== undefined ? (description ? sanitize(description) : description) : undefined;

    // Check duplicate name if changing
    if (safeName && safeName !== existing.name) {
      const [dup] = await db.select({ id: plans.id }).from(plans)
        .where(eq(plans.name, safeName)).limit(1);
      if (dup) return res.status(409).json({ error: "A plan with this name already exists" });
    }

    const [plan] = await db.update(plans).set({
      name: safeName ?? existing.name,
      description: safeDescription !== undefined ? safeDescription : existing.description,
      price: price ?? existing.price,
      billingCycle: billingCycle ?? existing.billingCycle,
      trialDays: trialDays ?? existing.trialDays,
      isActive: isActive !== undefined ? isActive : existing.isActive,
      customCycleDays: customCycleDays !== undefined ? customCycleDays : existing.customCycleDays,
      updatedAt: new Date(),
    }).where(eq(plans.id, req.params.id)).returning();

    if (features) {
      // Delete old features and insert new ones
      await db.delete(planFeatures).where(eq(planFeatures.planId, plan.id));
      if (features.length) {
        await db.insert(planFeatures).values(
          features.map((f: any) => ({
            planId: plan.id,
            featureKey: f.featureKey,
            limitType: f.limitType,
            booleanValue: f.booleanValue ?? null,
            numericMin: f.numericMin ?? null,
            numericMax: f.numericMax ?? null,
          }))
        );
      }
    }

    const allFeatures = await db.select().from(planFeatures).where(eq(planFeatures.planId, plan.id));
    return res.json({ ...plan, features: allFeatures });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── Delete plan ──────────────────────────────────────────

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const [existing] = await db.select().from(plans).where(eq(plans.id, req.params.id)).limit(1);
    if (!existing) return res.status(404).json({ error: "Plan not found" });

    // Check for active subscribers
    const countResult = await db.execute(sql`
      SELECT COUNT(*)::int AS count FROM subscriptions
      WHERE plan_id = ${req.params.id} AND status IN ('active', 'trial')
    `);
    const activeCount = (countResult.rows[0] as any).count;
    if (activeCount > 0) {
      return res.status(409).json({ error: `Cannot delete plan with ${activeCount} active subscriber(s)` });
    }

    await db.delete(plans).where(eq(plans.id, req.params.id));
    return res.json({ ok: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
