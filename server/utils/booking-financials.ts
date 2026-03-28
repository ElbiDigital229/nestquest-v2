import { db } from "../db/index";
import { sql } from "drizzle-orm";

/**
 * Records financial transactions when a booking is confirmed.
 * Handles PM-PO money flow based on bankAccountBelongsTo and commission structure.
 */
export async function recordBookingIncome(booking: {
  id: string;
  propertyId: string;
  subtotal: string;
  cleaningFee: string | null;
  tourismTax: string | null;
  vat: string | null;
  securityDepositAmount: string | null;
  commissionType: string | null;
  commissionValue: string | null;
  commissionAmount: string | null;
  bankAccountBelongsTo: string | null;
}) {
  try {
    const holder = booking.bankAccountBelongsTo || "property_manager";
    const otherParty = holder === "property_manager" ? "po" : "pm";

    // 1. Booking income (nightly subtotal)
    await insertTransaction({
      bookingId: booking.id,
      propertyId: booking.propertyId,
      transactionType: "income",
      category: "booking_income",
      amount: booking.subtotal,
      direction: "in",
      heldBy: holder === "property_manager" ? "pm" : "po",
      owedTo: holder === "property_manager" ? "po" : null,
      description: `Booking income`,
    });

    // 2. Cleaning fee income
    if (booking.cleaningFee && parseFloat(booking.cleaningFee) > 0) {
      await insertTransaction({
        bookingId: booking.id,
        propertyId: booking.propertyId,
        transactionType: "income",
        category: "cleaning_fee",
        amount: booking.cleaningFee,
        direction: "in",
        heldBy: holder === "property_manager" ? "pm" : "po",
        owedTo: holder === "property_manager" ? "po" : null,
        description: `Cleaning fee`,
      });
    }

    // 3. Taxes
    const taxTotal = (parseFloat(booking.tourismTax || "0") + parseFloat(booking.vat || "0")).toString();
    if (parseFloat(taxTotal) > 0) {
      await insertTransaction({
        bookingId: booking.id,
        propertyId: booking.propertyId,
        transactionType: "income",
        category: "tax",
        amount: taxTotal,
        direction: "in",
        heldBy: holder === "property_manager" ? "pm" : "po",
        owedTo: null,
        description: `Taxes collected`,
      });
    }

    // 4. PM commission (only for percentage_per_booking)
    if (booking.commissionType === "percentage_per_booking" && booking.commissionAmount && parseFloat(booking.commissionAmount) > 0) {
      if (holder === "property_manager") {
        // PM collected money, PM keeps commission, reduces what PM owes PO
        await insertTransaction({
          bookingId: booking.id,
          propertyId: booking.propertyId,
          transactionType: "commission",
          category: "pm_commission",
          amount: booking.commissionAmount,
          direction: "in",
          heldBy: "pm",
          owedTo: null,
          description: `PM commission (${booking.commissionValue}%)`,
        });
      } else {
        // PO collected money, PO owes PM the commission
        await insertTransaction({
          bookingId: booking.id,
          propertyId: booking.propertyId,
          transactionType: "commission",
          category: "pm_commission",
          amount: booking.commissionAmount,
          direction: "in",
          heldBy: "po",
          owedTo: "pm",
          description: `PM commission owed (${booking.commissionValue}%)`,
        });
      }
    }

    // 5. Security deposit (NOT income — refundable)
    if (booking.securityDepositAmount && parseFloat(booking.securityDepositAmount) > 0) {
      await insertTransaction({
        bookingId: booking.id,
        propertyId: booking.propertyId,
        transactionType: "deposit",
        category: "security_deposit",
        amount: booking.securityDepositAmount,
        direction: "in",
        heldBy: holder === "property_manager" ? "pm" : "po",
        owedTo: "guest",
        description: `Security deposit (refundable)`,
      });

      // Create security deposit record
      const depId = crypto.randomUUID();
      await db.execute(sql`
        INSERT INTO st_security_deposits (id, booking_id, amount, status, received_at, created_at, updated_at)
        VALUES (${depId}, ${booking.id}, ${booking.securityDepositAmount}, 'received', NOW(), NOW(), NOW())
      `);
    }
  } catch (err) {
    console.error("[BookingFinancials] recordBookingIncome error:", err);
  }
}

/**
 * Records refund transactions when a booking is cancelled.
 */
export async function recordBookingRefund(booking: {
  id: string;
  propertyId: string;
  refundAmount: string;
  bankAccountBelongsTo: string | null;
}) {
  try {
    const holder = booking.bankAccountBelongsTo || "property_manager";

    await insertTransaction({
      bookingId: booking.id,
      propertyId: booking.propertyId,
      transactionType: "refund",
      category: "booking_refund",
      amount: booking.refundAmount,
      direction: "out",
      heldBy: holder === "property_manager" ? "pm" : "po",
      owedTo: "guest",
      description: `Booking refund`,
    });
  } catch (err) {
    console.error("[BookingFinancials] recordBookingRefund error:", err);
  }
}

/**
 * Records deposit return transactions.
 */
export async function recordDepositReturn(params: {
  bookingId: string;
  propertyId: string;
  returnedAmount: string;
  deductions: Array<{ reason: string; amount: string }>;
  bankAccountBelongsTo: string | null;
}) {
  try {
    const holder = params.bankAccountBelongsTo || "property_manager";
    const heldBy = holder === "property_manager" ? "pm" : "po";

    // Returned portion
    if (parseFloat(params.returnedAmount) > 0) {
      await insertTransaction({
        bookingId: params.bookingId,
        propertyId: params.propertyId,
        transactionType: "refund",
        category: "security_deposit_returned",
        amount: params.returnedAmount,
        direction: "out",
        heldBy,
        owedTo: "guest",
        description: `Security deposit returned`,
      });
    }

    // Deductions become income (damage charges)
    for (const d of params.deductions) {
      if (parseFloat(d.amount) > 0) {
        await insertTransaction({
          bookingId: params.bookingId,
          propertyId: params.propertyId,
          transactionType: "income",
          category: "damage_charge",
          amount: d.amount,
          direction: "in",
          heldBy,
          owedTo: null,
          description: `Damage charge: ${d.reason}`,
        });
      }
    }
  } catch (err) {
    console.error("[BookingFinancials] recordDepositReturn error:", err);
  }
}

/**
 * Records owner payout transaction.
 */
export async function recordOwnerPayout(params: {
  bookingId: string;
  propertyId: string;
  amount: string;
}) {
  try {
    await insertTransaction({
      bookingId: params.bookingId,
      propertyId: params.propertyId,
      transactionType: "payout",
      category: "po_payout",
      amount: params.amount,
      direction: "out",
      heldBy: "pm",
      owedTo: null,
      description: `Owner payout`,
    });
  } catch (err) {
    console.error("[BookingFinancials] recordOwnerPayout error:", err);
  }
}

// ── Helper ──────────────────────────────────────────

async function insertTransaction(t: {
  bookingId: string;
  propertyId: string;
  transactionType: string;
  category: string;
  amount: string;
  direction: string;
  heldBy: string;
  owedTo: string | null;
  description: string;
}) {
  const id = crypto.randomUUID();
  await db.execute(sql`
    INSERT INTO st_booking_transactions (id, booking_id, property_id, transaction_type, category, amount, direction, held_by, owed_to, description, recorded_at, created_at)
    VALUES (${id}, ${t.bookingId}, ${t.propertyId}, ${sql.raw(`'${t.transactionType}'::st_transaction_type`)}, ${t.category}, ${t.amount}, ${t.direction}, ${t.heldBy}, ${t.owedTo}, ${t.description}, NOW(), NOW())
  `);
}
