import { db } from "../db/index";
import { sql } from "drizzle-orm";
import { fireTrigger } from "./message-template-trigger";

/**
 * Fires the day_before_checkout message template trigger daily.
 *
 * Only this trigger needs a cron — the others are fired directly from
 * the booking lifecycle routes (check_in_day from check-in, post_checkout
 * from checkout, booking_confirmed from confirm/manual-create).
 *
 * Runs once at server start then every 24 hours.
 */
export async function runMessageTriggerCron(): Promise<void> {
  try {
    // ── day_before_checkout ─────────────────────────────────────────────────
    // Fire for checked-in bookings whose checkout is tomorrow
    const rows = await db.execute(sql`
      SELECT b.id, b.pm_user_id, b.guest_user_id, b.check_in_date, b.check_out_date,
             b.total_nights, p.check_in_time, p.check_out_time, b.access_pin,
             COALESCE(g.full_name, b.guest_name, 'Guest') AS guest_name,
             p.public_name AS property_name
      FROM st_bookings b
      JOIN st_properties p ON p.id = b.property_id
      LEFT JOIN guests g ON g.user_id = b.guest_user_id
      WHERE b.check_out_date = CURRENT_DATE + INTERVAL '1 day'
        AND b.status = 'checked_in'
        AND b.guest_user_id IS NOT NULL
    `);

    for (const row of rows.rows as any[]) {
      await fireTrigger("day_before_checkout", {
        pmUserId: row.pm_user_id,
        guestUserId: row.guest_user_id,
        guestName: row.guest_name,
        propertyName: row.property_name || "the property",
        checkInDate: row.check_in_date,
        checkOutDate: row.check_out_date,
        checkInTime: row.check_in_time,
        checkOutTime: row.check_out_time,
        accessPin: row.access_pin,
        nights: row.total_nights,
        bookingId: row.id,
      });
    }

    if (rows.rows.length > 0) {
      console.log(`[MessageTriggerCron] day_before_checkout fired for ${rows.rows.length} booking(s)`);
    }
  } catch (err) {
    console.error("[MessageTriggerCron] Error:", err);
  }
}
