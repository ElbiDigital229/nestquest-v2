import { db } from "../db/index";
import { sql } from "drizzle-orm";
import { createNotification } from "./notify";
import { logPropertyActivity } from "./property-activity";

/**
 * Expires booking requests that haven't been confirmed within 24 hours.
 * Runs every 15 minutes.
 */
export async function expireStaleBookings() {
  try {
    // Find expired booking requests
    const expired = await db.execute(sql`
      SELECT b.id, b.property_id AS "propertyId", b.guest_user_id AS "guestUserId",
        b.pm_user_id AS "pmUserId", b.guest_name AS "guestName",
        p.public_name AS "propertyName"
      FROM st_bookings b
      JOIN st_properties p ON p.id = b.property_id
      WHERE b.status = 'requested'
      AND b.expires_at IS NOT NULL
      AND b.expires_at < NOW()
    `);

    if (expired.rows.length === 0) return;

    for (const booking of expired.rows as any[]) {
      // Update status to expired
      await db.execute(sql`
        UPDATE st_bookings SET status = 'expired', updated_at = NOW()
        WHERE id = ${booking.id} AND status = 'requested'
      `);

      // Notify guest
      if (booking.guestUserId) {
        await createNotification({
          userId: booking.guestUserId,
          type: "BOOKING_EXPIRED",
          title: "Booking request expired",
          body: `Your booking request for ${booking.propertyName || "a property"} has expired as it was not confirmed within 24 hours.`,
          linkUrl: `/portal/my-bookings/${booking.id}`,
          relatedId: booking.id,
        });
      }

      // Notify PM
      await createNotification({
        userId: booking.pmUserId,
        type: "BOOKING_EXPIRED",
        title: "Booking request expired",
        body: `A booking request from ${booking.guestName || "a guest"} for ${booking.propertyName || "a property"} has expired.`,
        linkUrl: `/portal/st-properties/${booking.propertyId}?tab=bookings`,
        relatedId: booking.id,
      });

      // Log activity
      await logPropertyActivity(
        booking.propertyId,
        booking.pmUserId,
        "booking_expired",
        `Booking request expired (not confirmed within 24h)`,
        { bookingId: booking.id }
      );
    }

    if (expired.rows.length > 0) {
      console.log(`[Booking Expiry] Expired ${expired.rows.length} booking(s)`);
    }
  } catch (err) {
    console.error("[Booking Expiry] Error:", err);
  }
}
