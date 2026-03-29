import { db } from "../db/index";
import { sql } from "drizzle-orm";

/**
 * Creates settlement records when a booking is confirmed.
 * Determines who collected the money (from payment_method_config) and who owes whom.
 *
 * If PM collected → PM owes PO the owner payout amount
 * If PO collected → PO owes PM the commission amount
 */
export async function createBookingSettlements(bookingId: string): Promise<void> {
  // Get booking + property + payment config
  const result = await db.execute(sql`
    SELECT b.id, b.property_id, b.pm_user_id, b.payment_method,
      b.total_amount, b.subtotal, b.commission_amount, b.owner_payout_amount,
      b.security_deposit_amount,
      p.po_user_id, p.payment_method_config,
      p.bank_account_belongs_to
    FROM st_bookings b
    JOIN st_properties p ON p.id = b.property_id
    WHERE b.id = ${bookingId}
  `);

  if (result.rows.length === 0) return;
  const booking = result.rows[0] as any;

  // No PO linked = no settlement needed
  if (!booking.po_user_id) return;

  const pmId = booking.pm_user_id;
  const poId = booking.po_user_id;
  const paymentMethod = booking.payment_method || "card";
  const commission = parseFloat(booking.commission_amount || "0");
  const ownerPayout = parseFloat(booking.owner_payout_amount || "0");

  // Determine who collected the money based on payment_method_config
  let collectedBy = "property_manager"; // default
  try {
    const config = booking.payment_method_config ? JSON.parse(booking.payment_method_config) : null;
    if (config) {
      const methodConfig = config[paymentMethod];
      if (methodConfig) {
        collectedBy = methodConfig.belongsTo || methodConfig.collectedBy || booking.bank_account_belongs_to || "property_manager";
      }
    } else if (booking.bank_account_belongs_to) {
      collectedBy = booking.bank_account_belongs_to;
    }
  } catch {}

  // Check if settlements already exist for this booking
  const existing = await db.execute(sql`
    SELECT id FROM pm_po_settlements WHERE booking_id = ${bookingId} LIMIT 1
  `);
  if (existing.rows.length > 0) return; // already created

  if (collectedBy === "property_manager" && ownerPayout > 0) {
    // PM collected money → PM owes PO the owner payout
    await db.execute(sql`
      INSERT INTO pm_po_settlements (id, booking_id, property_id, from_user_id, to_user_id, amount, reason, payment_method_used, collected_by, status, created_at, updated_at)
      VALUES (gen_random_uuid()::text, ${bookingId}, ${booking.property_id}, ${pmId}, ${poId}, ${ownerPayout.toFixed(2)}, 'owner_payout', ${paymentMethod}, 'property_manager', 'pending', NOW(), NOW())
    `);
  } else if (collectedBy === "property_owner" && commission > 0) {
    // PO collected money → PO owes PM the commission
    await db.execute(sql`
      INSERT INTO pm_po_settlements (id, booking_id, property_id, from_user_id, to_user_id, amount, reason, payment_method_used, collected_by, status, created_at, updated_at)
      VALUES (gen_random_uuid()::text, ${bookingId}, ${booking.property_id}, ${poId}, ${pmId}, ${commission.toFixed(2)}, 'pm_commission', ${paymentMethod}, 'property_owner', 'pending', NOW(), NOW())
    `);
  }
}
