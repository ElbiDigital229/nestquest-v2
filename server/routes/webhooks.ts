/**
 * Stripe Webhook Handler (stub)
 *
 * When you integrate Stripe, this endpoint receives events like:
 *   - invoice.paid → extend subscription period, create invoice record
 *   - invoice.payment_failed → set status to 'past_due', notify PM
 *   - customer.subscription.updated → sync status changes
 *   - customer.subscription.deleted → cancel subscription
 *
 * IMPORTANT: Stripe sends the raw body for signature verification.
 * This route must be mounted BEFORE express.json() middleware,
 * or use express.raw() for this specific path.
 */

import { Router, Request, Response } from "express";
import { db } from "../db/index";
import { subscriptions, invoices } from "../../shared/schema";
import { sql } from "drizzle-orm";

const router = Router();

// Stripe signature verification placeholder
// In production: import Stripe from 'stripe'; const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
function verifyStripeSignature(_req: Request): { type: string; data: any } | null {
  // TODO: Replace with real Stripe signature verification
  // const sig = req.headers['stripe-signature'];
  // const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  // return event;
  return null;
}

router.post("/stripe", async (req: Request, res: Response) => {
  try {
    const event = verifyStripeSignature(req);

    if (!event) {
      // In dev/mock mode, return 200 to acknowledge
      return res.json({ received: true, mode: "mock" });
    }

    switch (event.type) {
      case "invoice.paid": {
        // Payment succeeded — activate subscription, record invoice
        const { subscription_id, customer, amount_paid } = event.data.object;
        // TODO: Look up internal subscription by Stripe subscription ID
        // Update subscription status to 'active', extend period
        // Create invoice record with status 'paid'
        break;
      }

      case "invoice.payment_failed": {
        // Payment failed — mark subscription as past_due, notify PM
        const { subscription_id: failedSubId } = event.data.object;
        // TODO: Update subscription status to 'past_due'
        // Send notification to PM: "Payment failed, please update your card"
        break;
      }

      case "customer.subscription.updated": {
        // Subscription changed externally (e.g., plan change via Stripe dashboard)
        // TODO: Sync status and plan changes
        break;
      }

      case "customer.subscription.deleted": {
        // Subscription cancelled via Stripe
        // TODO: Cancel internal subscription, refund pending invoices
        break;
      }

      default:
        // Unhandled event type — log and acknowledge
        console.log(`[Stripe Webhook] Unhandled event: ${event.type}`);
    }

    return res.json({ received: true });
  } catch (error: any) {
    console.error("[Stripe Webhook] Error:", error.message);
    return res.status(400).json({ error: "Webhook processing failed" });
  }
});

export default router;
