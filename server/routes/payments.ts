/**
 * Stripe Payment Routes
 *
 * Flow:
 *   1. Guest calls POST /api/payments/create-intent with bookingId
 *      → Server creates Stripe PaymentIntent, returns clientSecret
 *   2. Frontend uses Stripe.js to collect card and confirm the PaymentIntent
 *   3. Stripe calls POST /api/payments/webhook on success/failure
 *      → On payment_intent.succeeded: booking is auto-confirmed atomically
 *      → On payment_intent.payment_failed: booking stays 'requested', guest notified
 */

import { Router, Request, Response } from "express";
import Stripe from "stripe";
import { db, withTransaction } from "../db/index";
import { sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { recordBookingIncome } from "../utils/booking-financials";
import { createBookingSettlements } from "../utils/settlements";
import { createNotification } from "../utils/notify";
import { logPropertyActivity } from "../utils/property-activity";
import { fireTrigger } from "../utils/message-template-trigger";
import logger from "../utils/logger";

const router = Router();

// Stripe is optional — only active when STRIPE_SECRET_KEY is set
const stripeEnabled = !!process.env.STRIPE_SECRET_KEY;
const stripe = stripeEnabled
  ? new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2025-03-31.basil" })
  : null;

// ── POST /api/payments/create-intent ──────────────────
// Creates a Stripe PaymentIntent for a booking.
// The clientSecret is returned to the frontend for Stripe.js to complete payment.
router.post("/create-intent", requireAuth, async (req: Request, res: Response) => {
  if (!stripe) {
    return res.status(503).json({ error: "Payment gateway not configured. Use bank transfer instead." });
  }

  try {
    const userId = req.session.userId!;
    const { bookingId } = req.body;

    if (!bookingId) return res.status(400).json({ error: "bookingId is required" });

    // Fetch booking — must belong to this user and be in 'requested' state
    const result = await db.execute(sql`
      SELECT b.id, b.total_amount, b.status, b.guest_user_id,
        b.pm_user_id, b.property_id, b.stripe_payment_intent_id,
        p.public_name AS "propertyName"
      FROM st_bookings b
      JOIN st_properties p ON p.id = b.property_id
      WHERE b.id = ${bookingId} AND b.guest_user_id = ${userId}
    `);

    if (result.rows.length === 0) return res.status(404).json({ error: "Booking not found" });

    const booking = result.rows[0] as any;

    if (booking.status !== "requested") {
      return res.status(400).json({ error: `Booking is already ${booking.status}` });
    }

    // Reuse existing PaymentIntent if already created (idempotency)
    if (booking.stripe_payment_intent_id) {
      const existing = await stripe.paymentIntents.retrieve(booking.stripe_payment_intent_id);
      if (existing.status === "requires_payment_method" || existing.status === "requires_confirmation") {
        return res.json({ clientSecret: existing.client_secret, paymentIntentId: existing.id });
      }
    }

    // Amount in fils/halalas (AED × 100) — Stripe requires integer smallest unit
    const amountFils = Math.round(parseFloat(booking.total_amount) * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountFils,
      currency: "aed",
      metadata: {
        bookingId: booking.id,
        pmUserId: booking.pm_user_id,
        propertyId: booking.property_id,
        propertyName: booking.propertyName,
      },
      description: `NestQuest booking — ${booking.propertyName}`,
      automatic_payment_methods: { enabled: true },
    });

    // Store PaymentIntent ID on the booking for idempotency
    await db.execute(sql`
      UPDATE st_bookings
      SET stripe_payment_intent_id = ${paymentIntent.id}, updated_at = NOW()
      WHERE id = ${bookingId}
    `);

    logger.info({ bookingId, paymentIntentId: paymentIntent.id, amount: amountFils }, "PaymentIntent created");

    return res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (err: any) {
    logger.error({ err, bookingId: req.body.bookingId }, "create-intent error");
    return res.status(500).json({ error: "Failed to create payment intent" });
  }
});

// ── POST /api/payments/webhook ────────────────────────
// Stripe sends events here. Body must be raw (mounted in index.ts before express.json()).
router.post("/webhook", async (req: Request, res: Response) => {
  if (!stripe) return res.status(503).json({ error: "Stripe not configured" });

  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    logger.error("STRIPE_WEBHOOK_SECRET not set — cannot verify webhook");
    return res.status(500).json({ error: "Webhook secret not configured" });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig as string, webhookSecret);
  } catch (err: any) {
    logger.warn({ err: err.message }, "Webhook signature verification failed");
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  logger.info({ eventType: event.type, eventId: event.id }, "Stripe webhook received");

  // Acknowledge immediately — Stripe retries if we don't respond within 30s
  res.json({ received: true });

  // Process event asynchronously
  handleStripeEvent(event).catch((err) =>
    logger.error({ err, eventType: event.type, eventId: event.id }, "Webhook handler error")
  );
});

// ── Stripe event handler ───────────────────────────────

async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "payment_intent.succeeded":
      await handlePaymentSuccess(event.data.object as Stripe.PaymentIntent);
      break;

    case "payment_intent.payment_failed":
      await handlePaymentFailure(event.data.object as Stripe.PaymentIntent);
      break;

    case "payment_intent.canceled":
      logger.info({ paymentIntentId: (event.data.object as Stripe.PaymentIntent).id }, "PaymentIntent cancelled");
      break;

    default:
      logger.debug({ eventType: event.type }, "Unhandled Stripe event type");
  }
}

async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  const bookingId = paymentIntent.metadata?.bookingId;
  if (!bookingId) {
    logger.error({ paymentIntentId: paymentIntent.id }, "PaymentIntent has no bookingId in metadata");
    return;
  }

  // Fetch booking
  const result = await db.execute(sql`
    SELECT b.*, p.public_name AS property_name
    FROM st_bookings b
    JOIN st_properties p ON p.id = b.property_id
    WHERE b.id = ${bookingId}
  `);

  if (result.rows.length === 0) {
    logger.error({ bookingId }, "Booking not found for successful payment");
    return;
  }

  const booking = result.rows[0] as any;

  if (booking.status !== "requested") {
    logger.info({ bookingId, status: booking.status }, "Booking already processed, skipping");
    return;
  }

  // ── Atomic: confirm booking + record financials + settlements ──
  await withTransaction(async (tx) => {
    await tx.execute(sql`
      UPDATE st_bookings SET
        status = 'confirmed',
        confirmed_at = NOW(),
        payment_status = 'paid',
        payment_method = 'card',
        stripe_payment_intent_id = ${paymentIntent.id},
        updated_at = NOW()
      WHERE id = ${bookingId}
    `);

    await recordBookingIncome({
      id: booking.id,
      propertyId: booking.property_id,
      subtotal: booking.subtotal,
      cleaningFee: booking.cleaning_fee,
      tourismTax: booking.tourism_tax,
      vat: booking.vat,
      securityDepositAmount: booking.security_deposit_amount,
      commissionType: booking.commission_type,
      commissionValue: booking.commission_value,
      commissionAmount: booking.commission_amount,
      bankAccountBelongsTo: booking.bank_account_belongs_to,
    }, tx);

    await createBookingSettlements(bookingId, tx);
  });

  // Notifications (outside transaction — non-critical)
  if (booking.guest_user_id) {
    await createNotification({
      userId: booking.guest_user_id,
      type: "BOOKING_CONFIRMED",
      title: "Payment received — booking confirmed!",
      body: `Your booking at ${booking.property_name} has been confirmed. Payment of AED ${booking.total_amount} received.`,
      linkUrl: `/portal/my-bookings/${bookingId}`,
      relatedId: bookingId,
    });
  }

  await createNotification({
    userId: booking.pm_user_id,
    type: "BOOKING_CONFIRMED",
    title: "Booking auto-confirmed via Stripe",
    body: `A booking at ${booking.property_name} was paid and auto-confirmed via card.`,
    linkUrl: `/portal/st-properties/${booking.property_id}?tab=bookings`,
    relatedId: bookingId,
  });

  await logPropertyActivity(
    booking.property_id, booking.pm_user_id, "booking_confirmed",
    `Booking auto-confirmed via Stripe payment (${paymentIntent.id})`,
    { bookingId, paymentIntentId: paymentIntent.id }
  );

  // Fire booking_confirmed message templates
  if (booking.guest_user_id) {
    const guestNameResult = await db.execute(sql`SELECT full_name FROM users WHERE id = ${booking.guest_user_id} LIMIT 1`);
    const guestName = (guestNameResult.rows[0] as any)?.full_name || "Guest";
    fireTrigger("booking_confirmed", {
      pmUserId: booking.pm_user_id,
      guestUserId: booking.guest_user_id,
      guestName,
      propertyName: booking.property_name || "the property",
      checkInDate: booking.check_in_date,
      checkOutDate: booking.check_out_date,
      checkInTime: booking.check_in_time,
      checkOutTime: booking.check_out_time,
      nights: booking.total_nights,
      bookingId,
    }).catch(err => logger.error({ err, bookingId }, "[MessageTrigger] booking_confirmed (Stripe) failed"));
  }

  logger.info({ bookingId, paymentIntentId: paymentIntent.id }, "Booking auto-confirmed via Stripe");
}

async function handlePaymentFailure(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  const bookingId = paymentIntent.metadata?.bookingId;
  if (!bookingId) return;

  const lastError = paymentIntent.last_payment_error;

  await db.execute(sql`
    UPDATE st_bookings SET
      payment_status = 'failed',
      updated_at = NOW()
    WHERE id = ${bookingId} AND status = 'requested'
  `);

  // Fetch guest ID for notification
  const result = await db.execute(sql`
    SELECT guest_user_id FROM st_bookings WHERE id = ${bookingId}
  `);

  const guestId = (result.rows[0] as any)?.guest_user_id;
  if (guestId) {
    await createNotification({
      userId: guestId,
      type: "BOOKING_CANCELLED",
      title: "Payment failed",
      body: `Your payment for booking ${bookingId} failed${lastError?.message ? `: ${lastError.message}` : ""}. Please try again.`,
      linkUrl: `/booking/payment?bookingId=${bookingId}`,
      relatedId: bookingId,
    });
  }

  logger.warn({ bookingId, paymentIntentId: paymentIntent.id, lastError }, "Payment failed");
}

export default router;
