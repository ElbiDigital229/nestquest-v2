import { db, DbClient } from "../db/index";
import { sql } from "drizzle-orm";

/**
 * Records financial transactions when a booking is confirmed.
 * Pass `tx` when calling inside a db.transaction() to ensure atomicity.
 */
export async function recordBookingIncome(
  booking: {
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
  },
  tx?: DbClient
): Promise<void> {
  const client = tx ?? db;
  const holder = booking.bankAccountBelongsTo || "property_manager";

  // 1. Booking income (nightly subtotal)
  await insertTransaction(client, {
    bookingId: booking.id,
    propertyId: booking.propertyId,
    transactionType: "income",
    category: "booking_income",
    amount: booking.subtotal,
    direction: "in",
    heldBy: holder === "property_manager" ? "pm" : "po",
    owedTo: holder === "property_manager" ? "po" : null,
    description: "Booking income",
  });

  // 2. Cleaning fee
  if (booking.cleaningFee && parseFloat(booking.cleaningFee) > 0) {
    await insertTransaction(client, {
      bookingId: booking.id,
      propertyId: booking.propertyId,
      transactionType: "income",
      category: "cleaning_fee",
      amount: booking.cleaningFee,
      direction: "in",
      heldBy: holder === "property_manager" ? "pm" : "po",
      owedTo: holder === "property_manager" ? "po" : null,
      description: "Cleaning fee",
    });
  }

  // 3. Taxes
  const taxTotal = (
    parseFloat(booking.tourismTax || "0") + parseFloat(booking.vat || "0")
  ).toString();
  if (parseFloat(taxTotal) > 0) {
    await insertTransaction(client, {
      bookingId: booking.id,
      propertyId: booking.propertyId,
      transactionType: "income",
      category: "tax",
      amount: taxTotal,
      direction: "in",
      heldBy: holder === "property_manager" ? "pm" : "po",
      owedTo: null,
      description: "Taxes collected",
    });
  }

  // 4. PM commission
  if (
    booking.commissionType === "percentage_per_booking" &&
    booking.commissionAmount &&
    parseFloat(booking.commissionAmount) > 0
  ) {
    if (holder === "property_manager") {
      await insertTransaction(client, {
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
      await insertTransaction(client, {
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

  // 5. Security deposit (refundable — tracked separately)
  if (
    booking.securityDepositAmount &&
    parseFloat(booking.securityDepositAmount) > 0
  ) {
    await insertTransaction(client, {
      bookingId: booking.id,
      propertyId: booking.propertyId,
      transactionType: "deposit",
      category: "security_deposit",
      amount: booking.securityDepositAmount,
      direction: "in",
      heldBy: holder === "property_manager" ? "pm" : "po",
      owedTo: "guest",
      description: "Security deposit (refundable)",
    });

    const depId = crypto.randomUUID();
    await client.execute(sql`
      INSERT INTO st_security_deposits (id, booking_id, amount, status, received_at, created_at, updated_at)
      VALUES (${depId}, ${booking.id}, ${booking.securityDepositAmount}, 'received', NOW(), NOW(), NOW())
    `);
  }
}

/**
 * Records refund transactions when a booking is cancelled.
 * Pass `tx` when calling inside a db.transaction().
 */
export async function recordBookingRefund(
  booking: {
    id: string;
    propertyId: string;
    refundAmount: string;
    bankAccountBelongsTo: string | null;
  },
  tx?: DbClient
): Promise<void> {
  const client = tx ?? db;
  const holder = booking.bankAccountBelongsTo || "property_manager";

  await insertTransaction(client, {
    bookingId: booking.id,
    propertyId: booking.propertyId,
    transactionType: "refund",
    category: "booking_refund",
    amount: booking.refundAmount,
    direction: "out",
    heldBy: holder === "property_manager" ? "pm" : "po",
    owedTo: "guest",
    description: "Booking refund",
  });
}

/**
 * Records deposit return transactions.
 * Pass `tx` when calling inside a db.transaction().
 */
export async function recordDepositReturn(
  params: {
    bookingId: string;
    propertyId: string;
    returnedAmount: string;
    deductions: Array<{ reason: string; amount: string }>;
    bankAccountBelongsTo: string | null;
  },
  tx?: DbClient
): Promise<void> {
  const client = tx ?? db;
  const holder = params.bankAccountBelongsTo || "property_manager";
  const heldBy = holder === "property_manager" ? "pm" : "po";

  if (parseFloat(params.returnedAmount) > 0) {
    await insertTransaction(client, {
      bookingId: params.bookingId,
      propertyId: params.propertyId,
      transactionType: "refund",
      category: "security_deposit_returned",
      amount: params.returnedAmount,
      direction: "out",
      heldBy,
      owedTo: "guest",
      description: "Security deposit returned",
    });
  }

  for (const d of params.deductions) {
    if (parseFloat(d.amount) > 0) {
      await insertTransaction(client, {
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
}

/**
 * Records owner payout transaction.
 * Pass `tx` when calling inside a db.transaction().
 */
export async function recordOwnerPayout(
  params: { bookingId: string; propertyId: string; amount: string },
  tx?: DbClient
): Promise<void> {
  const client = tx ?? db;
  await insertTransaction(client, {
    bookingId: params.bookingId,
    propertyId: params.propertyId,
    transactionType: "payout",
    category: "po_payout",
    amount: params.amount,
    direction: "out",
    heldBy: "pm",
    owedTo: null,
    description: "Owner payout",
  });
}

// ── Internal helper ──────────────────────────────────

async function insertTransaction(
  client: DbClient,
  t: {
    bookingId: string;
    propertyId: string;
    transactionType: string;
    category: string;
    amount: string;
    direction: string;
    heldBy: string;
    owedTo: string | null;
    description: string;
  }
): Promise<void> {
  const id = crypto.randomUUID();
  await client.execute(sql`
    INSERT INTO st_booking_transactions (
      id, booking_id, property_id, transaction_type, category,
      amount, direction, held_by, owed_to, description, recorded_at, created_at
    )
    VALUES (
      ${id}, ${t.bookingId}, ${t.propertyId},
      ${t.transactionType}::st_transaction_type,
      ${t.category}, ${t.amount}, ${t.direction},
      ${t.heldBy}, ${t.owedTo}, ${t.description},
      NOW(), NOW()
    )
  `);
}
