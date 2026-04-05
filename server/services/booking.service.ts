/**
 * Booking Service
 *
 * Contains all business logic for short-term bookings.
 * Route handlers (controllers) call these functions — they don't touch the DB directly.
 *
 * Key design decisions:
 *  - checkAvailability uses SELECT FOR UPDATE inside a transaction to prevent double-booking
 *  - All financial mutations (confirm/cancel) accept an optional tx for atomic multi-write ops
 *  - Price calculation is a pure function — no DB I/O, easy to unit-test
 */

import { db, withTransaction, DbClient } from "../db/index";
import { sql } from "drizzle-orm";
import { recordBookingIncome, recordBookingRefund } from "../utils/booking-financials";
import { createBookingSettlements } from "../utils/settlements";
import { createNotification } from "../utils/notify";
import { logPropertyActivity } from "../utils/property-activity";
import { sanitize } from "../utils/sanitize";
import logger from "../utils/logger";
import { fireTrigger } from "../utils/message-template-trigger";
import { NotFoundError, ConflictError, ValidationError, UnprocessableError } from "../errors/index";

// ── Types ──────────────────────────────────────────────

export interface NightsBreakdown {
  totalNights: number;
  weekdayNights: number;
  weekendNights: number;
}

export interface PriceBreakdown {
  totalNights: number;
  weekdayNights: number;
  weekendNights: number;
  nightlyRate: string;
  weekendRate: string;
  nightlyTotal: string;
  cleaningFee: string;
  subtotal: string;
  tourismTax: string;
  tourismTaxPercent: number;
  vat: string;
  vatPercent: number;
  securityDeposit: string;
  total: string;
  minimumStay: number;
  cancellationPolicy: string | null;
}

export interface CreateBookingInput {
  propertyId: string;
  guestUserId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  paymentMethod?: string;
  specialRequests?: string;
}

export interface ManualBookingInput {
  propertyId: string;
  pmUserId: string;
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  source?: string;
  externalRef?: string;
  paymentMethod?: string;
  totalAmountOverride?: number;
  notes?: string;
}

export interface ConfirmBookingInput {
  bookingId: string;
  pmUserId: string;
  confirmedByUserId: string;
  confirmedByRole: string;
}

export interface CancelBookingInput {
  bookingId: string;
  cancelledByUserId: string;
  cancelledByRole: string;
  reason?: string;
}

// ── Pure helpers ───────────────────────────────────────

/**
 * Calculate weekday vs weekend nights split.
 * UAE weekend = Friday (5) + Saturday (6).
 */
export function calculateNights(checkIn: string, checkOut: string): NightsBreakdown {
  const start = new Date(checkIn + "T00:00:00");
  const end = new Date(checkOut + "T00:00:00");
  let weekdayNights = 0;
  let weekendNights = 0;
  const current = new Date(start);
  while (current < end) {
    const day = current.getDay();
    if (day === 0 || day === 6) { // Sat (6), Sun (0)
      weekendNights++;
    } else {
      weekdayNights++;
    }
    current.setDate(current.getDate() + 1);
  }
  return { totalNights: weekdayNights + weekendNights, weekdayNights, weekendNights };
}

/**
 * Calculate refund amount based on cancellation policy and timing.
 * Returns a string representation of the refund amount in AED.
 */
export function calculateRefund(
  policy: string | null,
  totalAmount: string,
  checkInDate: string,
  status: string,
): string {
  if (status === "requested") return totalAmount;

  const total = parseFloat(totalAmount);
  const now = new Date();
  const checkIn = new Date(checkInDate);
  const hoursUntilCheckIn = (checkIn.getTime() - now.getTime()) / (1000 * 60 * 60);

  switch (policy) {
    case "flexible":
      return hoursUntilCheckIn > 48 ? totalAmount : (total * 0.5).toFixed(2);
    case "moderate":
      if (hoursUntilCheckIn > 120) return totalAmount;
      if (hoursUntilCheckIn > 48) return (total * 0.5).toFixed(2);
      return "0";
    case "strict":
      return hoursUntilCheckIn > 168 ? (total * 0.5).toFixed(2) : "0";
    case "non_refundable":
      return "0";
    default:
      return totalAmount;
  }
}

// ── Validation ─────────────────────────────────────────

export function validateBookingDates(
  checkIn: string,
  checkOut: string,
  allowPast = false,
): { valid: true } | { valid: false; error: string } {
  const checkInDate = new Date(checkIn + "T00:00:00");
  const checkOutDate = new Date(checkOut + "T00:00:00");

  if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
    return { valid: false, error: "Invalid date format" };
  }
  if (checkOutDate <= checkInDate) {
    return { valid: false, error: "Check-out date must be after check-in date" };
  }
  if (!allowPast) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (checkInDate < today) {
      return { valid: false, error: "Check-in date cannot be in the past" };
    }
  }
  return { valid: true };
}

// ── Availability check ─────────────────────────────────

/**
 * Atomically check availability inside an existing transaction.
 * Uses SELECT FOR UPDATE to prevent concurrent bookings for the same dates.
 * Must be called within a withTransaction() block.
 */
export async function checkAvailabilityForUpdate(
  tx: DbClient,
  propertyId: string,
  checkIn: string,
  checkOut: string,
): Promise<{ available: true } | { available: false; reason: string }> {
  // Row-level lock: any concurrent transaction attempting the same check will wait
  const conflict = await tx.execute(sql`
    SELECT id FROM st_bookings
    WHERE property_id = ${propertyId}
      AND status IN ('confirmed', 'checked_in', 'requested')
      AND check_in_date < ${checkOut}
      AND check_out_date > ${checkIn}
    LIMIT 1
    FOR UPDATE
  `);

  if (conflict.rows.length > 0) {
    return { available: false, reason: "Selected dates are no longer available" };
  }

  const blocked = await tx.execute(sql`
    SELECT id FROM st_blocked_dates
    WHERE property_id = ${propertyId}
      AND start_date < ${checkOut}
      AND end_date > ${checkIn}
    LIMIT 1
  `);

  if (blocked.rows.length > 0) {
    return { available: false, reason: "Selected dates are blocked by the host" };
  }

  return { available: true };
}

// ── Price calculation ──────────────────────────────────

export async function calculatePrice(
  propertyId: string,
  checkIn: string,
  checkOut: string,
  guests?: number,
): Promise<PriceBreakdown | { error: string; status: number }> {
  const propResult = await db.execute(sql`
    SELECT p.nightly_rate, p.weekend_rate, p.minimum_stay, p.cleaning_fee,
      p.security_deposit_required, p.security_deposit_amount,
      p.max_guests, p.pm_user_id, p.cancellation_policy
    FROM st_properties p WHERE p.id = ${propertyId} AND p.status = 'active'
  `);

  if (propResult.rows.length === 0) {
    return { error: "Property not found", status: 404 };
  }

  const prop = propResult.rows[0] as any;
  const { totalNights, weekdayNights, weekendNights } = calculateNights(checkIn, checkOut);

  if (totalNights < (prop.minimum_stay || 1)) {
    return { error: `Minimum stay is ${prop.minimum_stay || 1} nights`, status: 400 };
  }
  if (guests && guests > prop.max_guests) {
    return { error: `Maximum ${prop.max_guests} guests allowed`, status: 400 };
  }

  const nightlyRate = parseFloat(prop.nightly_rate || "0");
  const weekendRate = parseFloat(prop.weekend_rate || prop.nightly_rate || "0");
  const cleaningFee = parseFloat(prop.cleaning_fee || "0");
  const securityDeposit = prop.security_deposit_required
    ? parseFloat(prop.security_deposit_amount || "0")
    : 0;

  // Custom date-specific pricing overrides
  const customPricing = await db.execute(sql`
    SELECT date, price FROM st_property_pricing
    WHERE property_id = ${propertyId} AND date >= ${checkIn} AND date < ${checkOut}
  `);
  const customPriceMap = new Map(
    (customPricing.rows as any[]).map((r) => {
      // PostgreSQL date comes back as a JS Date at midnight UTC — use local date parts
      // to avoid timezone-shift bugs (e.g. UTC+4 shifts midnight UTC to previous day)
      const dt = new Date(r.date);
      const key = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
      return [key, parseFloat(r.price)];
    })
  );

  let nightlyTotal = 0;
  const d = new Date(checkIn + "T00:00:00");
  const endD = new Date(checkOut + "T00:00:00");
  while (d < endD) {
    const dateStr = d.toISOString().slice(0, 10);
    const isWeekend = d.getDay() === 0 || d.getDay() === 6; // Sat (6), Sun (0)
    const customPrice = customPriceMap.get(dateStr);
    nightlyTotal += customPrice !== undefined ? customPrice : isWeekend ? weekendRate : nightlyRate;
    d.setDate(d.getDate() + 1);
  }

  const taxResult = await db.execute(sql`
    SELECT tourism_tax_percent, vat_percent FROM pm_settings
    WHERE pm_user_id = ${prop.pm_user_id} LIMIT 1
  `);
  const taxSettings = (taxResult.rows[0] as any) || {
    tourism_tax_percent: "0",
    vat_percent: "0",
  };
  const tourismTaxPct = parseFloat(taxSettings.tourism_tax_percent || "0");
  const vatPct = parseFloat(taxSettings.vat_percent || "0");

  const subtotal = nightlyTotal + cleaningFee;
  const tourismTax = nightlyTotal * (tourismTaxPct / 100);
  const vat = subtotal * (vatPct / 100);
  const total = subtotal + tourismTax + vat + securityDeposit;

  // Per-night breakdown
  const pricingBreakdown: { date: string; price: number; type: string }[] = [];
  const dBreak = new Date(checkIn + "T00:00:00Z");
  const endBreak = new Date(checkOut + "T00:00:00Z");
  while (dBreak < endBreak) {
    const dateStr = `${dBreak.getUTCFullYear()}-${String(dBreak.getUTCMonth() + 1).padStart(2, "0")}-${String(dBreak.getUTCDate()).padStart(2, "0")}`;
    const dow = dBreak.getUTCDay();
    const isWknd = dow === 0 || dow === 6;
    const custom = customPriceMap.get(dateStr);
    pricingBreakdown.push({
      date: dateStr,
      price: custom !== undefined ? custom : isWknd ? weekendRate : nightlyRate,
      type: custom !== undefined ? "custom" : isWknd ? "weekend" : "weekday",
    });
    dBreak.setUTCDate(dBreak.getUTCDate() + 1);
  }

  return {
    totalNights,
    weekdayNights,
    weekendNights,
    nightlyRate: nightlyRate.toFixed(2),
    weekendRate: weekendRate.toFixed(2),
    nightlyTotal: nightlyTotal.toFixed(2),
    cleaningFee: cleaningFee.toFixed(2),
    subtotal: subtotal.toFixed(2),
    tourismTax: tourismTax.toFixed(2),
    tourismTaxPercent: tourismTaxPct,
    vat: vat.toFixed(2),
    vatPercent: vatPct,
    securityDeposit: securityDeposit.toFixed(2),
    total: total.toFixed(2),
    minimumStay: prop.minimum_stay || 1,
    cancellationPolicy: prop.cancellation_policy,
    pricingBreakdown,
  };
}

// ── Create booking (guest flow) ────────────────────────

export async function createBooking(input: CreateBookingInput): Promise<{ id: string; status: string; expiresAt: string }> {
  const { propertyId, guestUserId, checkIn, checkOut, guests, paymentMethod, specialRequests } = input;

  const propResult = await db.execute(sql`
    SELECT p.*, a.name AS area_name FROM st_properties p
    LEFT JOIN areas a ON a.id = p.area_id
    WHERE p.id = ${propertyId} AND p.status = 'active'
  `);

  if (propResult.rows.length === 0) {
    throw new NotFoundError("Property not found or not active");
  }

  const prop = propResult.rows[0] as any;
  const { totalNights, weekdayNights, weekendNights } = calculateNights(checkIn, checkOut);

  if (totalNights < (prop.minimum_stay || 1)) {
    throw new ValidationError(`Minimum stay is  nights`);
  }
  if (guests > prop.max_guests) {
    throw new ValidationError(`Maximum  guests allowed`);
  }

  const nightlyRate = parseFloat(prop.nightly_rate || "0");
  const weekendRate = parseFloat(prop.weekend_rate || prop.nightly_rate || "0");
  const cleaningFee = parseFloat(prop.cleaning_fee || "0");
  const securityDeposit = prop.security_deposit_required
    ? parseFloat(prop.security_deposit_amount || "0")
    : 0;
  const nightlyTotal = weekdayNights * nightlyRate + weekendNights * weekendRate;

  const taxResult = await db.execute(sql`
    SELECT tourism_tax_percent, vat_percent FROM pm_settings
    WHERE pm_user_id = ${prop.pm_user_id} LIMIT 1
  `);
  const tax = (taxResult.rows[0] as any) || { tourism_tax_percent: "0", vat_percent: "0" };
  const tourismTax = nightlyTotal * (parseFloat(tax.tourism_tax_percent || "0") / 100);
  const vat = (nightlyTotal + cleaningFee) * (parseFloat(tax.vat_percent || "0") / 100);
  const subtotal = nightlyTotal + cleaningFee;
  const total = subtotal + tourismTax + vat + securityDeposit;

  const rentalIncome = subtotal + tourismTax + vat;
  let commissionAmount = "0";
  if (prop.commission_type === "percentage_per_booking" && prop.commission_value) {
    commissionAmount = (subtotal * (parseFloat(prop.commission_value) / 100)).toFixed(2);
  }
  const ownerPayoutAmount = (rentalIncome - parseFloat(commissionAmount)).toFixed(2);

  const bookingId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  // Atomic: availability check + insert in one transaction (FOR UPDATE prevents race)
  await withTransaction(async (tx) => {
    const availability = await checkAvailabilityForUpdate(tx, propertyId, checkIn, checkOut);
    if (!availability.available) {
      throw new ConflictError(availability.reason);
    }

    await tx.execute(sql`
      INSERT INTO st_bookings (
        id, property_id, guest_user_id, pm_user_id, source, status,
        check_in_date, check_out_date, number_of_guests, total_nights,
        weekday_nights, weekend_nights,
        nightly_rate, weekend_rate, cleaning_fee, tourism_tax, vat,
        subtotal, total_amount, security_deposit_amount,
        payment_method, payment_status, cancellation_policy,
        commission_type, commission_value, commission_amount,
        bank_account_belongs_to, owner_payout_amount, owner_payout_status,
        special_requests, expires_at, created_at, updated_at
      ) VALUES (
        ${bookingId}, ${propertyId}, ${guestUserId}, ${prop.pm_user_id},
        'website', 'requested',
        ${checkIn}, ${checkOut}, ${guests}, ${totalNights},
        ${weekdayNights}, ${weekendNights},
        ${nightlyRate.toFixed(2)}, ${weekendRate.toFixed(2)},
        ${cleaningFee.toFixed(2)}, ${tourismTax.toFixed(2)}, ${vat.toFixed(2)},
        ${subtotal.toFixed(2)}, ${total.toFixed(2)},
        ${securityDeposit > 0 ? securityDeposit.toFixed(2) : null},
        ${paymentMethod ? sql.raw(`'${paymentMethod}'::st_booking_payment_method`) : sql`NULL`},
        'pending',
        ${prop.cancellation_policy ? sql.raw(`'${prop.cancellation_policy}'::st_cancellation_policy`) : sql`NULL`},
        ${prop.commission_type ? sql.raw(`'${prop.commission_type}'::st_commission_type`) : sql`NULL`},
        ${prop.commission_value || null},
        ${commissionAmount},
        ${prop.bank_account_belongs_to ? sql.raw(`'${prop.bank_account_belongs_to}'::st_bank_account_belongs_to`) : sql`NULL`},
        ${ownerPayoutAmount}, 'pending',
        ${specialRequests ? sanitize(specialRequests) : null},
        ${expiresAt},
        NOW(), NOW()
      )
    `);
  });

  // Notifications + activity log (outside transaction — non-critical side effects)
  const guestResult = await db.execute(sql`
    SELECT full_name FROM users WHERE id = ${guestUserId} LIMIT 1
  `);
  const guestName = (guestResult.rows[0] as any)?.full_name || "A guest";

  await createNotification({
    userId: prop.pm_user_id,
    type: "BOOKING_REQUESTED",
    title: "New booking request",
    body: `${guestName} has requested to book ${prop.public_name || "your property"} from ${checkIn} to ${checkOut}`,
    linkUrl: `/portal/st-properties/${propertyId}?tab=bookings`,
    relatedId: bookingId,
  });

  await logPropertyActivity(
    propertyId,
    guestUserId,
    "booking_created",
    `New booking request from ${guestName} (${checkIn} to ${checkOut})`,
    { bookingId, checkIn, checkOut, totalAmount: total.toFixed(2) }
  );

  logger.info({ bookingId, propertyId, guestUserId, total: total.toFixed(2) }, "Booking created");
  return { id: bookingId, status: "requested", expiresAt };
}

// ── Confirm booking ────────────────────────────────────

export async function confirmBooking(input: ConfirmBookingInput): Promise<void> {
  const { bookingId, pmUserId, confirmedByUserId, confirmedByRole } = input;

  const bookingResult = await db.execute(sql`
    SELECT b.*, p.public_name AS property_name, p.smart_home
    FROM st_bookings b JOIN st_properties p ON p.id = b.property_id
    WHERE b.id = ${bookingId} AND b.pm_user_id = ${pmUserId}
  `);

  if (bookingResult.rows.length === 0) {
    throw new NotFoundError("Booking not found");
  }

  const booking = bookingResult.rows[0] as any;

  if (booking.status !== "requested") {
    throw new ValidationError(`Cannot confirm a booking with status: `);
  }

  // KYC gate: registered guests must have verified KYC before booking can be confirmed
  if (booking.guest_user_id) {
    const guestResult = await db.execute(sql`
      SELECT kyc_status FROM users WHERE id = ${booking.guest_user_id} LIMIT 1
    `);
    const guest = guestResult.rows[0] as any;
    if (guest && guest.kyc_status !== "verified") {
      throw new UnprocessableError("Guest KYC is not verified. Ask the guest to complete identity verification before confirming.");
    }
  }

  const cashCollectedBy = booking.payment_method === "cash" ? confirmedByUserId : null;

  // Generate access PIN if property has locks
  let accessPin: string | null = booking.access_pin || null;
  if (!accessPin) {
    try {
      const lockResult = await db.execute(sql`
        SELECT id FROM st_property_locks WHERE property_id = ${booking.property_id} LIMIT 1
      `);
      if (lockResult.rows.length > 0) {
        accessPin = Math.floor(100000 + Math.random() * 900000).toString();
        const lockId = (lockResult.rows[0] as any).id;
        const checkIn = new Date(booking.check_in_date + "T15:00:00");
        const checkOut = new Date(booking.check_out_date + "T12:00:00");
        await db.execute(sql`
          INSERT INTO st_lock_pins (id, lock_id, booking_id, pin, valid_from, valid_until, status, generated_by)
          VALUES (gen_random_uuid()::text, ${lockId}, ${bookingId}, ${accessPin}, ${checkIn.toISOString()}, ${checkOut.toISOString()}, 'active', ${confirmedByUserId})
        `);
      }
    } catch { /* lock table may not exist */ }
  }

  await withTransaction(async (tx) => {
    await tx.execute(sql`
      UPDATE st_bookings SET
        status = 'confirmed',
        confirmed_at = NOW(),
        payment_status = 'paid',
        cash_collected_by_user_id = ${cashCollectedBy},
        access_pin = ${accessPin},
        updated_at = NOW()
      WHERE id = ${bookingId}
    `);

    await recordBookingIncome(
      {
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
      },
      tx
    );

    await createBookingSettlements(bookingId, tx);
  });

  if (booking.guest_user_id) {
    await createNotification({
      userId: booking.guest_user_id,
      type: "BOOKING_CONFIRMED",
      title: "Booking confirmed!",
      body: `Your booking at ${booking.property_name || "a property"} has been confirmed.`,
      linkUrl: `/portal/my-bookings/${bookingId}`,
      relatedId: bookingId,
    });
  }

  if (confirmedByRole === "PM_TEAM_MEMBER") {
    await createNotification({
      userId: pmUserId,
      type: "BOOKING_CONFIRMED",
      title: "Team member confirmed booking",
      body: `A team member confirmed a booking at ${booking.property_name || "a property"}.`,
      linkUrl: `/portal/my-bookings`,
      relatedId: bookingId,
    });
  }

  await logPropertyActivity(
    booking.property_id,
    confirmedByUserId,
    "booking_confirmed",
    "Booking confirmed",
    { bookingId }
  );

  // Fire message templates with trigger = booking_confirmed
  if (booking.guest_user_id) {
    const guestNameResult = await db.execute(sql`
      SELECT full_name FROM users WHERE id = ${booking.guest_user_id} LIMIT 1
    `);
    const guestName = (guestNameResult.rows[0] as any)?.full_name || "Guest";

    fireTrigger("booking_confirmed", {
      pmUserId,
      guestUserId: booking.guest_user_id,
      guestName,
      propertyName: booking.property_name || "the property",
      checkInDate: booking.check_in_date,
      checkOutDate: booking.check_out_date,
      accessPin,
      bookingId,
    }).catch(err => console.error("[MessageTrigger] booking_confirmed failed:", err));
  }

  logger.info({ bookingId, confirmedByUserId }, "Booking confirmed");
}

// ── Cancel booking ─────────────────────────────────────

export async function cancelBooking(input: CancelBookingInput): Promise<{ refundAmount: string }> {
  const { bookingId, cancelledByUserId, cancelledByRole, reason } = input;

  const bookingResult = await db.execute(sql`
    SELECT b.*, p.public_name AS property_name
    FROM st_bookings b
    JOIN st_properties p ON p.id = b.property_id
    WHERE b.id = ${bookingId}
      AND (
        b.guest_user_id = ${cancelledByUserId}
        OR b.pm_user_id = ${cancelledByUserId}
        OR ${cancelledByRole} = 'SUPER_ADMIN'
      )
  `);

  if (bookingResult.rows.length === 0) {
    throw new NotFoundError("Booking not found");
  }

  const booking = bookingResult.rows[0] as any;
  const cancellableStatuses = ["requested", "confirmed"];

  if (!cancellableStatuses.includes(booking.status)) {
    throw new ValidationError(`Cannot cancel a booking with status: `);
  }

  const refundAmount = calculateRefund(
    booking.cancellation_policy,
    booking.total_amount,
    booking.check_in_date,
    booking.status
  );

  await withTransaction(async (tx) => {
    await tx.execute(sql`
      UPDATE st_bookings SET
        status = 'cancelled',
        cancelled_at = NOW(),
        cancellation_reason = ${reason || null},
        updated_at = NOW()
      WHERE id = ${bookingId}
    `);

    // Void settlements
    await tx.execute(sql`
      DELETE FROM pm_po_settlements WHERE booking_id = ${bookingId}
    `);

    // Release security deposit
    await tx.execute(sql`
      UPDATE st_security_deposits SET status = 'released', updated_at = NOW()
      WHERE booking_id = ${bookingId}
    `);

    // Record refund only if there's something to refund
    if (parseFloat(refundAmount) > 0 && booking.status === "confirmed") {
      await recordBookingRefund(
        {
          id: booking.id,
          propertyId: booking.property_id,
          refundAmount,
          bankAccountBelongsTo: booking.bank_account_belongs_to,
        },
        tx
      );
    }
  });

  if (booking.guest_user_id && booking.guest_user_id !== cancelledByUserId) {
    await createNotification({
      userId: booking.guest_user_id,
      type: "BOOKING_CANCELLED",
      title: "Booking cancelled",
      body: `Your booking at ${booking.property_name || "a property"} has been cancelled.${reason ? ` Reason: ${reason}` : ""}`,
      linkUrl: `/portal/my-bookings/${bookingId}`,
      relatedId: bookingId,
    });
  }

  if (booking.pm_user_id && booking.pm_user_id !== cancelledByUserId) {
    await createNotification({
      userId: booking.pm_user_id,
      type: "BOOKING_CANCELLED",
      title: "Booking cancelled",
      body: `A booking at ${booking.property_name || "a property"} has been cancelled.`,
      linkUrl: `/portal/st-properties/${booking.property_id}?tab=bookings`,
      relatedId: bookingId,
    });
  }

  await logPropertyActivity(
    booking.property_id,
    cancelledByUserId,
    "booking_cancelled",
    `Booking cancelled${reason ? `: ${reason}` : ""}`,
    { bookingId, refundAmount }
  );

  logger.info({ bookingId, cancelledByUserId, refundAmount }, "Booking cancelled");
  return { refundAmount };
}
