/**
 * Billing Guard Middleware
 *
 * Blocks PM users whose subscription is 'billing_suspended' from using
 * the app — except for billing-related routes so they can pay and restore access.
 */
import { Request, Response, NextFunction } from "express";
import { db } from "../db/index";
import { sql } from "drizzle-orm";

// Routes a suspended PM can still access
const WHITELIST_PREFIXES = [
  "/api/auth/",
  "/api/subscriptions/",
  "/api/notifications",
  "/api/plans",          // view plans
  "/api/portal/profile",  // load profile data for settings page
];

export async function requireBillingCurrent(req: Request, res: Response, next: NextFunction) {
  // Skip for unauthenticated requests
  if (!req.session?.userId) return next();

  // Only enforce for PMs (only role with subscriptions)
  if (req.session.userRole !== "PROPERTY_MANAGER") return next();

  // Skip whitelisted routes
  if (WHITELIST_PREFIXES.some(p => req.path.startsWith(p))) return next();

  // Check for billing_suspended subscription
  try {
    const result = await db.execute(sql`
      SELECT 1 FROM subscriptions
      WHERE user_id = ${req.session.userId}
      AND status = 'billing_suspended'
      LIMIT 1
    `);

    if (result.rows.length > 0) {
      return res.status(402).json({
        error: "billing_suspended",
        message: "Your account is suspended due to an unpaid invoice. Please complete payment to restore access.",
      });
    }
  } catch {
    // If check fails, don't block the user — fail open
  }

  return next();
}
