import { Router, Request, Response } from "express";
import { db } from "../db/index";
import { plans, planFeatures, subscriptions, invoices, paymentMethods, userAuditLog, users } from "../../shared/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { sanitize } from "../utils/sanitize";
import { createNotification } from "../utils/notify";

// Helper: notify all super admins
async function notifySuperAdmins(opts: { type: Parameters<typeof createNotification>[0]["type"]; title: string; body: string; linkUrl?: string; relatedId?: string }) {
  try {
    const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, "SUPER_ADMIN"));
    for (const admin of admins) {
      await createNotification({ userId: admin.id, ...opts });
    }
  } catch {}
}

// Helper: get user display name
async function getUserName(userId: string): Promise<string> {
  const [user] = await db.select({ fullName: users.fullName }).from(users).where(eq(users.id, userId)).limit(1);
  return user?.fullName || "Unknown User";
}

const router = Router();

router.use(requireAuth);

// ── Helper: calculate period end from plan ───────────
function calcPeriodEnd(now: Date, plan: { billingCycle: string; customCycleDays: number | null }): Date {
  const periodEnd = new Date(now);
  if (plan.billingCycle === "monthly") {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  } else if (plan.billingCycle === "yearly") {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  } else if (plan.billingCycle === "custom" && plan.customCycleDays) {
    periodEnd.setDate(periodEnd.getDate() + plan.customCycleDays);
  } else {
    periodEnd.setFullYear(periodEnd.getFullYear() + 100); // one_time
  }
  return periodEnd;
}

// Grace period: 3 days after period_end before full expiry
const GRACE_PERIOD_DAYS = 3;

// ── Helper: auto-transition trial/expired subscriptions on read ──
async function resolveSubscriptionStatus(sub: any): Promise<any> {
  const now = new Date();

  // Trial ended → activate and charge
  if (sub.status === "trial" && sub.trial_ends_at && new Date(sub.trial_ends_at) <= now) {
    await db.execute(sql`
      UPDATE subscriptions SET status = 'active', updated_at = NOW()
      WHERE id = ${sub.id}
    `);
    // Mark any pending invoice as paid
    await db.execute(sql`
      UPDATE invoices SET invoice_status = 'paid', paid_at = NOW()
      WHERE subscription_id = ${sub.id} AND invoice_status = 'pending'
    `);
    sub.status = "active";
    sub.trial_ends_at = null;
  }

  // Period ended → check grace period before expiring
  if (
    (sub.status === "active" || sub.status === "trial") &&
    sub.current_period_end &&
    new Date(sub.current_period_end) <= now
  ) {
    const graceEnd = new Date(sub.current_period_end);
    graceEnd.setDate(graceEnd.getDate() + GRACE_PERIOD_DAYS);

    if (now >= graceEnd) {
      // Grace period over → fully expire
      await db.execute(sql`
        UPDATE subscriptions SET status = 'expired', updated_at = NOW()
        WHERE id = ${sub.id}
      `);
      sub.status = "expired";
    } else {
      // In grace period — still "active" but flag it
      sub.inGracePeriod = true;
      sub.graceEndsAt = graceEnd.toISOString();
    }
  }

  return sub;
}

// ── List active plans with features (any authenticated user) ─

router.get("/plans", async (_req: Request, res: Response) => {
  try {
    const allPlans = await db.select().from(plans).where(eq(plans.isActive, true)).orderBy(plans.createdAt);
    const result = [];
    for (const plan of allPlans) {
      const features = await db.select().from(planFeatures).where(eq(planFeatures.planId, plan.id));
      result.push({ ...plan, features });
    }
    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── Current user's subscription + plan + features ────────

router.get("/current", async (req: Request, res: Response) => {
  try {
    const { userId } = req.session;

    const rows = await db.execute(sql`
      SELECT s.*, p.name AS "planName", p.price AS "planPrice", p.billing_cycle AS "planBillingCycle"
      FROM subscriptions s
      JOIN plans p ON p.id = s.plan_id
      WHERE s.user_id = ${userId!}
      AND s.status IN ('active', 'trial', 'pending_payment')
      ORDER BY s.created_at DESC
      LIMIT 1
    `);

    if (!rows.rows.length) {
      return res.json(null);
    }

    let sub = rows.rows[0] as any;

    // Don't auto-transition pending_payment subs — they wait for user action
    if (sub.status !== "pending_payment") {
      // Auto-transition trial → active or active → expired based on dates
      sub = await resolveSubscriptionStatus(sub);

      // If it became expired, return null (no active subscription)
      if (sub.status === "expired") {
        return res.json(null);
      }
    }

    const features = await db.select().from(planFeatures).where(eq(planFeatures.planId, sub.plan_id));

    return res.json({ ...sub, features });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── Mock checkout: create subscription + invoice ─────────

router.post("/checkout", async (req: Request, res: Response) => {
  try {
    const { userId, userRole } = req.session;
    const { planId, cardLast4, cardBrand, cardName } = req.body;

    // Only Property Managers can subscribe to plans
    if (userRole !== "PROPERTY_MANAGER") {
      return res.status(403).json({ error: "Only Property Managers can subscribe to plans" });
    }

    if (!planId) return res.status(400).json({ error: "Plan ID is required" });

    const [plan] = await db.select().from(plans).where(eq(plans.id, planId)).limit(1);
    if (!plan || !plan.isActive) return res.status(404).json({ error: "Plan not found or inactive" });

    const now = new Date();
    const periodEnd = calcPeriodEnd(now, plan);

    // Check if user already used a trial for this plan (prevent trial abuse)
    let isTrial = plan.trialDays > 0;
    if (isTrial) {
      const prevTrial = await db.execute(sql`
        SELECT id FROM subscriptions
        WHERE user_id = ${userId!} AND plan_id = ${planId} AND status = 'cancelled'
        AND trial_ends_at IS NOT NULL
        LIMIT 1
      `);
      if (prevTrial.rows.length > 0) {
        isTrial = false;
      }
    }
    const trialEndsAt = isTrial ? new Date(now.getTime() + plan.trialDays * 86400000) : null;
    const isFree = parseFloat(plan.price) === 0;
    const invoiceStatus = isTrial && !isFree ? "pending" : "paid";

    // Wrap in transaction for atomicity
    const result = await db.transaction(async (tx) => {
      // Cancel any existing active subscription
      await tx.execute(sql`
        UPDATE subscriptions SET status = 'cancelled', updated_at = NOW()
        WHERE user_id = ${userId!} AND status IN ('active', 'trial', 'pending_payment')
      `);

      const [sub] = await tx.insert(subscriptions).values({
        userId: userId!,
        planId: plan.id,
        status: isTrial ? "trial" : "active",
        trialEndsAt,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      }).returning();

      const [invoice] = await tx.insert(invoices).values({
        subscriptionId: sub.id,
        userId: userId!,
        planId: plan.id,
        amount: plan.price,
        status: invoiceStatus,
        billingPeriodStart: now,
        billingPeriodEnd: periodEnd,
        paidAt: invoiceStatus === "paid" ? now : null,
      }).returning();

      // Save card details to payment_methods if provided
      if (cardLast4 && cardBrand) {
        await tx.execute(sql`
          INSERT INTO payment_methods (id, user_id, card_brand, card_last4, card_holder_name, is_default)
          VALUES (gen_random_uuid(), ${userId!}, ${sanitize(cardBrand)}, ${sanitize(cardLast4)}, ${sanitize(cardName || 'Card Holder')}, true)
          ON CONFLICT (user_id) WHERE is_default = true
          DO UPDATE SET card_brand = EXCLUDED.card_brand, card_last4 = EXCLUDED.card_last4,
                        card_holder_name = EXCLUDED.card_holder_name
        `);
      }

      // Audit log
      await tx.insert(userAuditLog).values({
        userId: userId!,
        action: "SETTINGS_UPDATED",
        details: `Subscribed to ${plan.name} (${isTrial ? "trial" : "active"})`,
        metadata: JSON.stringify({ planId, planName: plan.name }),
        ipAddress: req.ip,
      });

      return { subscription: sub, invoice };
    });

    // Notify super admins about new subscription
    const userName = await getUserName(userId!);
    const trialLabel = isTrial ? ` (${plan.trialDays}-day trial)` : "";
    notifySuperAdmins({
      type: "PLAN_ASSIGNED",
      title: `New plan subscription: ${userName}`,
      body: `${userName} subscribed to ${plan.name} plan${trialLabel}`,
      linkUrl: "/admin/transactions",
      relatedId: userId!,
    });

    // Notify super admins about payment (if paid immediately)
    if (invoiceStatus === "paid" && parseFloat(plan.price) > 0) {
      notifySuperAdmins({
        type: "INVOICE_CREATED",
        title: `Payment received: ${userName}`,
        body: `${userName} paid AED ${plan.price} for ${plan.name} plan`,
        linkUrl: "/admin/transactions",
        relatedId: userId!,
      });
    }

    return res.status(201).json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── Activate pending_payment subscription (PM completes payment) ──

router.post("/activate", async (req: Request, res: Response) => {
  try {
    const { userId } = req.session;
    const { cardLast4, cardBrand, cardName } = req.body;

    // Find the pending_payment subscription
    const subRows = await db.execute(sql`
      SELECT s.*, p.name AS "planName", p.price AS "planPrice",
             p.billing_cycle AS "planBillingCycle", p.custom_cycle_days AS "customCycleDays"
      FROM subscriptions s
      JOIN plans p ON p.id = s.plan_id
      WHERE s.user_id = ${userId!}
      AND s.status = 'pending_payment'
      ORDER BY s.created_at DESC
      LIMIT 1
    `);

    if (!subRows.rows.length) {
      return res.status(404).json({ error: "No pending subscription found" });
    }

    const sub = subRows.rows[0] as any;
    const now = new Date();

    // Calculate fresh period from now (payment moment is the real start)
    const periodEnd = new Date(now);
    if (sub.planBillingCycle === "monthly") periodEnd.setMonth(periodEnd.getMonth() + 1);
    else if (sub.planBillingCycle === "yearly") periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    else if (sub.planBillingCycle === "custom" && sub.customCycleDays) periodEnd.setDate(periodEnd.getDate() + sub.customCycleDays);
    else periodEnd.setFullYear(periodEnd.getFullYear() + 100);

    // Wrap in transaction for atomicity
    await db.transaction(async (tx) => {
      // Activate the subscription — period starts NOW (when they pay)
      await tx.execute(sql`
        UPDATE subscriptions
        SET status = 'active',
            current_period_start = ${now},
            current_period_end = ${periodEnd},
            updated_at = NOW()
        WHERE id = ${sub.id}
      `);

      // Mark pending invoice as paid
      await tx.execute(sql`
        UPDATE invoices
        SET invoice_status = 'paid', paid_at = ${now}
        WHERE subscription_id = ${sub.id} AND invoice_status = 'pending'
      `);

      // Save card details if provided
      if (cardLast4 && cardBrand) {
        await tx.execute(sql`
          INSERT INTO payment_methods (id, user_id, card_brand, card_last4, card_holder_name, is_default)
          VALUES (gen_random_uuid(), ${userId!}, ${sanitize(cardBrand)}, ${sanitize(cardLast4)}, ${sanitize(cardName || 'Card Holder')}, true)
          ON CONFLICT (user_id) WHERE is_default = true
          DO UPDATE SET card_brand = EXCLUDED.card_brand, card_last4 = EXCLUDED.card_last4,
                        card_holder_name = EXCLUDED.card_holder_name
        `);
      }

      // Audit log
      await tx.insert(userAuditLog).values({
        userId: userId!,
        action: "SETTINGS_UPDATED",
        details: `Activated ${sub.planName} subscription (payment completed)`,
        metadata: JSON.stringify({ planId: sub.plan_id, planName: sub.planName }),
        ipAddress: req.ip,
      });
    });

    // Notify super admins about activation + payment
    const activateName = await getUserName(userId!);
    notifySuperAdmins({
      type: "PLAN_ASSIGNED",
      title: `Plan activated: ${activateName}`,
      body: `${activateName} activated ${sub.planName} plan (payment completed)`,
      linkUrl: "/admin/transactions",
      relatedId: userId!,
    });
    if (parseFloat(sub.planPrice) > 0) {
      notifySuperAdmins({
        type: "INVOICE_CREATED",
        title: `Payment received: ${activateName}`,
        body: `${activateName} paid AED ${sub.planPrice} for ${sub.planName} plan`,
        linkUrl: "/admin/transactions",
        relatedId: userId!,
      });
    }

    return res.json({ message: "Subscription activated", subscriptionId: sub.id });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── Change plan ──────────────────────────────────────────

router.patch("/change-plan", async (req: Request, res: Response) => {
  try {
    const { userId } = req.session;
    const { planId } = req.body;

    if (!planId) return res.status(400).json({ error: "Plan ID is required" });

    const [plan] = await db.select().from(plans).where(eq(plans.id, planId)).limit(1);
    if (!plan || !plan.isActive) return res.status(404).json({ error: "Plan not found or inactive" });

    const now = new Date();
    const periodEnd = calcPeriodEnd(now, plan);

    // Wrap in transaction for atomicity
    const result = await db.transaction(async (tx) => {
      // Cancel existing
      await tx.execute(sql`
        UPDATE subscriptions SET status = 'cancelled', updated_at = NOW()
        WHERE user_id = ${userId!} AND status IN ('active', 'trial', 'pending_payment')
      `);

      const [sub] = await tx.insert(subscriptions).values({
        userId: userId!,
        planId: plan.id,
        status: "active",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      }).returning();

      const [invoice] = await tx.insert(invoices).values({
        subscriptionId: sub.id,
        userId: userId!,
        planId: plan.id,
        amount: plan.price,
        status: "paid",
        billingPeriodStart: now,
        billingPeriodEnd: periodEnd,
        paidAt: now,
      }).returning();

      // Audit log
      await tx.insert(userAuditLog).values({
        userId: userId!,
        action: "SETTINGS_UPDATED",
        details: `Changed plan to ${plan.name}`,
        metadata: JSON.stringify({ planId, planName: plan.name }),
        ipAddress: req.ip,
      });

      return { subscription: sub, invoice };
    });

    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── Cancel subscription ──────────────────────────────────

router.post("/cancel", async (req: Request, res: Response) => {
  try {
    const { userId } = req.session;

    // Find current active/trial subscription
    const rows = await db.execute(sql`
      SELECT s.id, s.status, s.current_period_end,
             p.name AS "planName"
      FROM subscriptions s
      JOIN plans p ON p.id = s.plan_id
      WHERE s.user_id = ${userId!}
      AND s.status IN ('active', 'trial', 'pending_payment')
      ORDER BY s.created_at DESC
      LIMIT 1
    `);

    if (!rows.rows.length) {
      return res.status(404).json({ error: "No active subscription to cancel" });
    }

    const sub = rows.rows[0] as any;

    // Wrap in transaction for atomicity
    await db.transaction(async (tx) => {
      // Cancel the subscription
      await tx.execute(sql`
        UPDATE subscriptions SET status = 'cancelled', updated_at = NOW()
        WHERE id = ${sub.id}
      `);

      // If there were pending invoices (from trial), mark them as refunded
      await tx.execute(sql`
        UPDATE invoices SET invoice_status = 'refunded', paid_at = NULL
        WHERE subscription_id = ${sub.id} AND invoice_status = 'pending'
      `);

      // Audit log
      await tx.insert(userAuditLog).values({
        userId: userId!,
        action: "SETTINGS_UPDATED",
        details: `Cancelled subscription to ${sub.planName}`,
        metadata: JSON.stringify({ planId: sub.plan_id, planName: sub.planName }),
        ipAddress: req.ip,
      });
    });

    return res.json({
      message: `Subscription to ${sub.planName} has been cancelled`,
      cancelledAt: new Date(),
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── Get user's default payment method ────────────────────

router.get("/payment-method", async (req: Request, res: Response) => {
  try {
    const { userId } = req.session;
    const rows = await db.execute(sql`
      SELECT card_brand AS "cardBrand", card_last4 AS "cardLast4",
             card_holder_name AS "cardHolderName",
             expiry_month AS "expiryMonth", expiry_year AS "expiryYear"
      FROM payment_methods
      WHERE user_id = ${userId!} AND is_default = true
      LIMIT 1
    `);
    if (!rows.rows.length) return res.json(null);
    return res.json(rows.rows[0]);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── List user's invoices (paginated) ─────────────────────

router.get("/invoices", async (req: Request, res: Response) => {
  try {
    const { userId } = req.session;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = parseInt(req.query.offset as string) || 0;

    const rows = await db.execute(sql`
      SELECT i.*, i.invoice_status AS "status", p.name AS "planName"
      FROM invoices i
      JOIN plans p ON p.id = i.plan_id
      WHERE i.user_id = ${userId!}
      ORDER BY i.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    const [countResult] = await db.execute(sql`
      SELECT COUNT(*)::int AS count FROM invoices WHERE user_id = ${userId!}
    `).then(r => r.rows as any[]);

    return res.json({
      invoices: rows.rows,
      total: countResult.count,
      limit,
      offset,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── Pay overdue invoice (reactivate suspended subscription) ──

router.post("/pay-invoice", async (req: Request, res: Response) => {
  try {
    const { userId } = req.session;
    const { invoiceId, cardLast4, cardBrand, cardName } = req.body;

    // Find the failed/pending invoice
    const invoiceRows = await db.execute(sql`
      SELECT i.*, p.name AS "planName", p.billing_cycle AS "billingCycle",
             p.custom_cycle_days AS "customCycleDays"
      FROM invoices i
      JOIN plans p ON p.id = i.plan_id
      WHERE i.user_id = ${userId!}
      AND i.id = ${invoiceId}
      AND i.invoice_status IN ('failed', 'pending')
      LIMIT 1
    `);

    if (!invoiceRows.rows.length) {
      return res.status(404).json({ error: "No unpaid invoice found" });
    }

    const inv = invoiceRows.rows[0] as any;
    const now = new Date();

    await db.transaction(async (tx) => {
      // Mark invoice as paid
      await tx.execute(sql`
        UPDATE invoices SET invoice_status = 'paid', paid_at = ${now}
        WHERE id = ${inv.id}
      `);

      // Reactivate subscription and advance period
      await tx.execute(sql`
        UPDATE subscriptions
        SET status = 'active',
            current_period_start = ${new Date(inv.billing_period_start)},
            current_period_end = ${new Date(inv.billing_period_end)},
            updated_at = NOW()
        WHERE id = ${inv.subscription_id}
      `);

      // Save card details if provided
      if (cardLast4 && cardBrand) {
        await tx.execute(sql`
          INSERT INTO payment_methods (id, user_id, card_brand, card_last4, card_holder_name, is_default)
          VALUES (gen_random_uuid(), ${userId!}, ${sanitize(cardBrand)}, ${sanitize(cardLast4)}, ${sanitize(cardName || 'Card Holder')}, true)
          ON CONFLICT (user_id) WHERE is_default = true
          DO UPDATE SET card_brand = EXCLUDED.card_brand, card_last4 = EXCLUDED.card_last4,
                        card_holder_name = EXCLUDED.card_holder_name
        `);
      }

      // Audit log
      await tx.insert(userAuditLog).values({
        userId: userId!,
        action: "SETTINGS_UPDATED",
        details: `Paid overdue invoice for ${inv.planName} (AED ${inv.amount})`,
        metadata: JSON.stringify({ invoiceId: inv.id, planName: inv.planName }),
        ipAddress: req.ip,
      });
    });

    // Notify super admins about payment
    const payerName = await getUserName(userId!);
    notifySuperAdmins({
      type: "INVOICE_CREATED",
      title: `Payment received: ${payerName}`,
      body: `${payerName} paid AED ${inv.amount} for ${inv.planName} plan (overdue invoice)`,
      linkUrl: "/admin/transactions",
      relatedId: userId!,
    });

    return res.json({ message: "Invoice paid, subscription reactivated" });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
