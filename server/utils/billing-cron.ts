/**
 * Billing Cron — runs hourly to:
 * 1. Generate upcoming invoices for subscriptions nearing period end
 * 2. Auto-charge (mock: always succeeds if payment method exists)
 * 3. Suspend users with overdue unpaid invoices
 */
import { db } from "../db/index";
import { sql } from "drizzle-orm";
import { createNotification } from "./notify";

const INVOICE_ADVANCE_DAYS = 3; // Generate invoice this many days before period end

function calcPeriodEnd(start: Date, billingCycle: string, customCycleDays: number | null): Date {
  const end = new Date(start);
  if (billingCycle === "monthly") end.setMonth(end.getMonth() + 1);
  else if (billingCycle === "yearly") end.setFullYear(end.getFullYear() + 1);
  else if (billingCycle === "custom" && customCycleDays) end.setDate(end.getDate() + customCycleDays);
  else end.setFullYear(end.getFullYear() + 100); // one_time
  return end;
}

export async function runBillingCron(): Promise<void> {
  const now = new Date();
  const advanceDate = new Date(now);
  advanceDate.setDate(advanceDate.getDate() + INVOICE_ADVANCE_DAYS);

  let invoicesCreated = 0;
  let autoCharged = 0;
  let suspended = 0;

  // ── Pass 1: Generate upcoming invoices ──────────────────
  // Find active subscriptions whose period ends within INVOICE_ADVANCE_DAYS
  // that don't already have a pending/paid invoice for the next period
  const upcoming = await db.execute(sql`
    SELECT
      s.id AS "subId", s.user_id AS "userId", s.plan_id AS "planId",
      s.current_period_end AS "periodEnd",
      p.name AS "planName", p.price, p.billing_cycle AS "billingCycle",
      p.custom_cycle_days AS "customCycleDays"
    FROM subscriptions s
    JOIN plans p ON p.id = s.plan_id
    WHERE s.status = 'active'
    AND p.billing_cycle != 'one_time'
    AND p.price != '0'
    AND s.current_period_end <= ${advanceDate}
    AND NOT EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.subscription_id = s.id
      AND i.billing_period_start = s.current_period_end
    )
  `);

  for (const row of upcoming.rows as any[]) {
    const nextStart = new Date(row.periodEnd);
    const nextEnd = calcPeriodEnd(nextStart, row.billingCycle, row.customCycleDays);
    // Due date = current period end (when the new period starts)
    const dueDate = new Date(row.periodEnd);

    // Create the invoice
    await db.execute(sql`
      INSERT INTO invoices (id, subscription_id, user_id, plan_id, amount, invoice_status, billing_period_start, billing_period_end, due_date, created_at)
      VALUES (gen_random_uuid(), ${row.subId}, ${row.userId}, ${row.planId}, ${row.price}, 'pending', ${nextStart}, ${nextEnd}, ${dueDate}, NOW())
    `);
    invoicesCreated++;

    // Notify user
    const dueDateStr = dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    try {
      await createNotification({
        userId: row.userId,
        type: "INVOICE_CREATED",
        title: `Invoice for ${row.planName} — AED ${row.price}`,
        body: `Your next invoice of AED ${row.price} is due on ${dueDateStr}.`,
        linkUrl: "/portal/settings",
        relatedId: row.subId,
      });
    } catch {}

    // Auto-charge: check if user has a saved payment method
    const pmResult = await db.execute(sql`
      SELECT id FROM payment_methods WHERE user_id = ${row.userId} AND is_default = true LIMIT 1
    `);

    if (pmResult.rows.length > 0) {
      // Mock: auto-charge always succeeds
      await db.execute(sql`
        UPDATE invoices SET invoice_status = 'paid', paid_at = NOW()
        WHERE subscription_id = ${row.subId} AND billing_period_start = ${nextStart} AND invoice_status = 'pending'
      `);
      // Advance subscription period
      await db.execute(sql`
        UPDATE subscriptions SET current_period_start = ${nextStart}, current_period_end = ${nextEnd}, updated_at = NOW()
        WHERE id = ${row.subId}
      `);
      autoCharged++;
    }
  }

  // ── Pass 2: Suspend overdue unpaid invoices ─────────────
  const overdue = await db.execute(sql`
    SELECT i.id AS "invoiceId", i.subscription_id AS "subId", i.user_id AS "userId",
           i.amount, p.name AS "planName"
    FROM invoices i
    JOIN subscriptions s ON s.id = i.subscription_id
    JOIN plans p ON p.id = i.plan_id
    WHERE i.invoice_status = 'pending'
    AND i.due_date IS NOT NULL
    AND i.due_date < NOW()
    AND s.status = 'active'
  `);

  for (const row of overdue.rows as any[]) {
    // Mark invoice as failed
    await db.execute(sql`
      UPDATE invoices SET invoice_status = 'failed' WHERE id = ${row.invoiceId}
    `);

    // Suspend the subscription
    await db.execute(sql`
      UPDATE subscriptions SET status = 'billing_suspended', updated_at = NOW()
      WHERE id = ${row.subId}
    `);

    // Notify user
    try {
      await createNotification({
        userId: row.userId,
        type: "INVOICE_OVERDUE",
        title: "Account Suspended — Payment Overdue",
        body: `Your invoice of AED ${row.amount} for ${row.planName} is overdue. Please update your payment method to restore access.`,
        linkUrl: "/portal/settings",
        relatedId: row.subId,
      });
    } catch {}

    suspended++;
  }

  console.log(`[Billing Cron] Created ${invoicesCreated} invoices, auto-charged ${autoCharged}, suspended ${suspended}`);
}
