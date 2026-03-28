import { db } from "../db/index";
import { sql } from "drizzle-orm";

export async function checkPlanLimit(
  userId: string,
  featureKey: string,
  currentCount?: number
): Promise<{ allowed: boolean; message?: string }> {
  // Find user's active subscription and matching feature
  const rows = await db.execute(sql`
    SELECT pf.limit_type, pf.boolean_value, pf.numeric_max
    FROM subscriptions s
    JOIN plan_features pf ON pf.plan_id = s.plan_id
    WHERE s.user_id = ${userId}
    AND s.status IN ('active', 'trial')
    AND pf.feature_key = ${featureKey}
    ORDER BY s.created_at DESC
    LIMIT 1
  `);

  if (!rows.rows.length) {
    // Check if user has a billing_suspended subscription
    const suspendedCheck = await db.execute(sql`
      SELECT 1 FROM subscriptions WHERE user_id = ${userId} AND status = 'billing_suspended' LIMIT 1
    `);
    if (suspendedCheck.rows.length > 0) {
      return { allowed: false, message: "Your account is suspended due to an unpaid invoice. Please complete payment to restore access." };
    }
    return { allowed: false, message: "No active subscription. Please subscribe to a plan." };
  }

  const feature = rows.rows[0] as any;

  if (feature.limit_type === "boolean") {
    if (!feature.boolean_value) {
      return { allowed: false, message: `Feature "${featureKey}" is not included in your plan.` };
    }
    return { allowed: true };
  }

  if (feature.limit_type === "numeric") {
    if (currentCount !== undefined && feature.numeric_max !== null && currentCount >= feature.numeric_max) {
      return { allowed: false, message: `Plan limit reached for "${featureKey}". Maximum: ${feature.numeric_max}.` };
    }
    return { allowed: true };
  }

  return { allowed: true };
}
