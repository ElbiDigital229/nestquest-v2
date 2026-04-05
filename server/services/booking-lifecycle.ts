/**
 * Booking Lifecycle Service
 *
 * Registers listeners on the bookingEmitter for all side effects that should
 * happen during booking state transitions. Routes emit events; this service
 * handles everything else: message templates, notifications, settlements,
 * cleaning automation, and activity logs.
 *
 * Centralising here means the route handlers only own the DB state change —
 * all fan-out logic lives in one place.
 */

import {
  bookingEmitter,
  BookingConfirmedPayload,
  BookingCheckedInPayload,
  BookingCheckedOutPayload,
  BookingCancelledPayload,
} from "../events/booking-emitter";
import { fireTrigger } from "../utils/message-template-trigger";
import { createNotification } from "../utils/notify";
import { createBookingSettlements } from "../utils/settlements";
import { triggerCleaningAutomation } from "../routes/cleaners";
import { db } from "../db/index";
import { sql } from "drizzle-orm";

// ── Helper: fetch PO user ID for a property ───────────
async function getPoUserId(propertyId: string): Promise<string | null> {
  const r = await db.execute(sql`SELECT po_user_id FROM st_properties WHERE id = ${propertyId} LIMIT 1`);
  return (r.rows[0] as any)?.po_user_id || null;
}

// ── booking:confirmed ─────────────────────────────────
bookingEmitter.on("booking:confirmed", async (p: BookingConfirmedPayload) => {
  try {
    // Settlements (has built-in idempotency guard)
    await createBookingSettlements(p.bookingId);
  } catch (err) {
    console.error("[Lifecycle] booking:confirmed settlements error:", err);
  }

  // Notify PO that their property has a new booking
  try {
    const poUserId = await getPoUserId(p.propertyId);
    if (poUserId) {
      await createNotification({
        userId: poUserId,
        type: "BOOKING_CONFIRMED",
        title: "New booking confirmed",
        body: `A booking at ${p.propertyName} has been confirmed (${p.checkInDate} – ${p.checkOutDate}).`,
        linkUrl: `/portal/po-properties`,
        relatedId: p.bookingId,
      });
    }
  } catch (err) {
    console.error("[Lifecycle] booking:confirmed PO notification error:", err);
  }

  if (!p.guestUserId) return;

  try {
    await createNotification({
      userId: p.guestUserId,
      type: "BOOKING_CONFIRMED",
      title: "Booking confirmed",
      body: `Your booking at ${p.propertyName} has been confirmed.`,
      linkUrl: `/portal/my-bookings/${p.bookingId}`,
      relatedId: p.bookingId,
    });
  } catch (err) {
    console.error("[Lifecycle] booking:confirmed guest notification error:", err);
  }

  try {
    await fireTrigger("booking_confirmed", {
      pmUserId: p.pmUserId,
      guestUserId: p.guestUserId,
      guestName: p.guestName,
      propertyName: p.propertyName,
      propertyAddress: p.propertyAddress,
      pmName: p.pmName,
      pmPhone: p.pmPhone,
      checkInDate: p.checkInDate,
      checkOutDate: p.checkOutDate,
      checkInTime: p.checkInTime,
      checkOutTime: p.checkOutTime,
      nights: p.totalNights,
      totalAmount: p.totalAmount,
      accessPin: p.accessPin,
      bookingId: p.bookingId,
    });
  } catch (err) {
    console.error("[Lifecycle] booking:confirmed fireTrigger error:", err);
  }
});

// ── booking:checked_in ────────────────────────────────
bookingEmitter.on("booking:checked_in", async (p: BookingCheckedInPayload) => {
  // Notify PO that a guest has checked in to their property
  try {
    const poUserId = await getPoUserId(p.propertyId);
    if (poUserId) {
      await createNotification({
        userId: poUserId,
        type: "BOOKING_CHECKIN",
        title: "Guest checked in",
        body: `${p.guestName} has checked in at ${p.propertyName}.`,
        linkUrl: `/portal/po-properties`,
        relatedId: p.bookingId,
      });
    }
  } catch (err) {
    console.error("[Lifecycle] booking:checked_in PO notification error:", err);
  }

  if (!p.guestUserId) return;

  try {
    await createNotification({
      userId: p.guestUserId,
      type: "BOOKING_CHECKIN",
      title: "Check-in confirmed",
      body: `You have been checked in at ${p.propertyName}.${p.accessPin ? ` Your access pin is: ${p.accessPin}` : ""}`,
      linkUrl: `/portal/my-bookings/${p.bookingId}`,
      relatedId: p.bookingId,
    });
  } catch (err) {
    console.error("[Lifecycle] booking:checked_in guest notification error:", err);
  }

  try {
    await fireTrigger("check_in_day", {
      pmUserId: p.pmUserId,
      guestUserId: p.guestUserId,
      guestName: p.guestName,
      propertyName: p.propertyName,
      propertyAddress: p.propertyAddress,
      pmName: p.pmName,
      pmPhone: p.pmPhone,
      checkInDate: p.checkInDate,
      checkOutDate: p.checkOutDate,
      checkInTime: p.checkInTime,
      checkOutTime: p.checkOutTime,
      nights: p.totalNights,
      totalAmount: p.totalAmount,
      accessPin: p.accessPin,
      bookingId: p.bookingId,
    });
  } catch (err) {
    console.error("[Lifecycle] booking:checked_in fireTrigger error:", err);
  }
});

// ── booking:checked_out ───────────────────────────────
bookingEmitter.on("booking:checked_out", async (p: BookingCheckedOutPayload) => {
  // Notify PO that guest has checked out — their property is now free
  try {
    const poUserId = await getPoUserId(p.propertyId);
    if (poUserId) {
      await createNotification({
        userId: poUserId,
        type: "BOOKING_CHECKOUT",
        title: "Guest checked out",
        body: `${p.guestName} has checked out of ${p.propertyName}. Payout will be processed shortly.`,
        linkUrl: `/portal/po-properties`,
        relatedId: p.bookingId,
      });
    }
  } catch (err) {
    console.error("[Lifecycle] booking:checked_out PO notification error:", err);
  }

  if (p.guestUserId) {
    try {
      await createNotification({
        userId: p.guestUserId,
        type: "BOOKING_CHECKOUT",
        title: "Check-out completed",
        body: `Check-out completed at ${p.propertyName}. Thank you for your stay!`,
        linkUrl: `/portal/my-bookings/${p.bookingId}`,
        relatedId: p.bookingId,
      });
    } catch (err) {
      console.error("[Lifecycle] booking:checked_out guest notification error:", err);
    }

    try {
      await fireTrigger("post_checkout", {
        pmUserId: p.pmUserId,
        guestUserId: p.guestUserId,
        guestName: p.guestName,
        propertyName: p.propertyName,
        checkInDate: p.checkInDate,
        checkOutDate: p.checkOutDate,
        checkInTime: p.checkInTime,
        checkOutTime: p.checkOutTime,
        nights: p.totalNights,
        accessPin: null,
        bookingId: p.bookingId,
      });
    } catch (err) {
      console.error("[Lifecycle] booking:checked_out fireTrigger error:", err);
    }
  }

  // Cleaning automation — notify PM if it fails so they can assign manually
  try {
    await triggerCleaningAutomation(p.propertyId, p.pmUserId, p.bookingId);
  } catch (err) {
    console.error("[Lifecycle] cleaning automation error:", err);
    try {
      await createNotification({
        userId: p.pmUserId,
        type: "SYSTEM_ALERT",
        title: "Cleaning automation failed",
        body: `Cleaning automation could not be triggered for ${p.propertyName} after check-out. Please assign a cleaner manually.`,
        linkUrl: `/portal/st-properties`,
        relatedId: p.bookingId,
      });
    } catch {}
  }
});

// ── booking:cancelled ─────────────────────────────────
bookingEmitter.on("booking:cancelled", async (p: BookingCancelledPayload) => {
  if (!p.guestUserId) return;

  try {
    await createNotification({
      userId: p.guestUserId,
      type: "BOOKING_CANCELLED",
      title: "Booking cancelled",
      body: `Your booking at ${p.propertyName} has been cancelled.`,
      linkUrl: `/portal/my-bookings/${p.bookingId}`,
      relatedId: p.bookingId,
    });
  } catch (err) {
    console.error("[Lifecycle] booking:cancelled notification error:", err);
  }
});

console.log("[BookingLifecycle] Lifecycle listeners registered");
