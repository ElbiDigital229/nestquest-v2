import { Router, Request, Response } from "express";
import { db } from "../db/index";
import { sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../middleware/auth";
import { createNotification } from "../utils/notify";
import { logPropertyActivity } from "../utils/property-activity";
import { recordBookingIncome, recordBookingRefund, recordDepositReturn, recordOwnerPayout } from "../utils/booking-financials";
import { createBookingSettlements } from "../utils/settlements";
import { triggerCleaningAutomation } from "./cleaners";
import { getPmUserId, requirePmPermission } from "../middleware/pm-permissions";
import { sanitize } from "../utils/sanitize";

const router = Router();

// ── Helper: Calculate nights breakdown ──────────────
function calculateNights(checkIn: string, checkOut: string) {
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  let weekdayNights = 0;
  let weekendNights = 0;
  const current = new Date(start);
  while (current < end) {
    const day = current.getDay();
    // Friday (5) and Saturday (6) are weekend in UAE
    if (day === 5 || day === 6) {
      weekendNights++;
    } else {
      weekdayNights++;
    }
    current.setDate(current.getDate() + 1);
  }
  return { totalNights: weekdayNights + weekendNights, weekdayNights, weekendNights };
}

// ── Helper: Calculate refund based on cancellation policy ──
function calculateRefund(
  policy: string | null,
  totalAmount: string,
  checkInDate: string,
  status: string,
): string {
  // If not yet confirmed, full refund
  if (status === "requested") return totalAmount;

  const total = parseFloat(totalAmount);
  const now = new Date();
  const checkIn = new Date(checkInDate);
  const hoursUntilCheckIn = (checkIn.getTime() - now.getTime()) / (1000 * 60 * 60);

  switch (policy) {
    case "flexible":
      return hoursUntilCheckIn > 48 ? totalAmount : (total * 0.5).toFixed(2);
    case "moderate":
      if (hoursUntilCheckIn > 120) return totalAmount; // >5 days
      if (hoursUntilCheckIn > 48) return (total * 0.5).toFixed(2); // 2-5 days
      return "0";
    case "strict":
      return hoursUntilCheckIn > 168 ? (total * 0.5).toFixed(2) : "0"; // >7 days: 50%
    case "non_refundable":
      return "0";
    default:
      return totalAmount;
  }
}

// ── GET /api/bookings/payment-details/:propertyId — Bank details for payment (authenticated)
router.get("/payment-details/:propertyId", requireAuth, async (req: Request, res: Response) => {
  try {
    const { propertyId } = req.params;
    const result = await db.execute(sql`
      SELECT p.bank_name AS "bankName", p.account_holder_name AS "accountHolderName",
        p.account_number AS "accountNumber", p.iban, p.swift_code AS "swiftCode",
        p.accepted_payment_methods AS "acceptedPaymentMethods",
        p.payment_method_config AS "paymentMethodConfig",
        u.email AS "pmEmail"
      FROM st_properties p
      JOIN users u ON u.id = p.pm_user_id
      WHERE p.id = ${propertyId} AND p.status = 'active'
    `);
    if (result.rows.length === 0) return res.status(404).json({ error: "Property not found" });
    return res.json(result.rows[0]);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ══════════════════════════════════════════════════════
// PUBLIC / GUEST ENDPOINTS
// ══════════════════════════════════════════════════════

// ── POST /api/bookings/calculate-price ────────────────
// Calculate price breakdown without creating a booking
router.post("/calculate-price", async (req: Request, res: Response) => {
  try {
    const { propertyId, checkIn, checkOut, guests } = req.body;

    if (!propertyId || !checkIn || !checkOut) {
      return res.status(400).json({ error: "propertyId, checkIn, and checkOut are required" });
    }

    // Validate dates
    const checkInDate = new Date(checkIn + "T00:00:00");
    const checkOutDate = new Date(checkOut + "T00:00:00");
    if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
      return res.status(400).json({ error: "Invalid date format" });
    }
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (checkInDate < today) {
      return res.status(400).json({ error: "Check-in date cannot be in the past" });
    }
    if (checkOutDate <= checkInDate) {
      return res.status(400).json({ error: "Check-out date must be after check-in date" });
    }

    // Get property pricing
    const propResult = await db.execute(sql`
      SELECT p.nightly_rate, p.weekend_rate, p.minimum_stay, p.cleaning_fee,
        p.security_deposit_required, p.security_deposit_amount,
        p.max_guests, p.pm_user_id, p.cancellation_policy
      FROM st_properties p WHERE p.id = ${propertyId} AND p.status = 'active'
    `);

    if (propResult.rows.length === 0) {
      return res.status(404).json({ error: "Property not found" });
    }

    const prop = propResult.rows[0] as any;
    const { totalNights, weekdayNights, weekendNights } = calculateNights(checkIn, checkOut);

    if (totalNights < (prop.minimum_stay || 1)) {
      return res.status(400).json({ error: `Minimum stay is ${prop.minimum_stay || 1} nights` });
    }
    if (guests && guests > prop.max_guests) {
      return res.status(400).json({ error: `Maximum ${prop.max_guests} guests allowed` });
    }

    const nightlyRate = parseFloat(prop.nightly_rate || "0");
    const weekendRate = parseFloat(prop.weekend_rate || prop.nightly_rate || "0");
    const cleaningFee = parseFloat(prop.cleaning_fee || "0");
    const securityDeposit = prop.security_deposit_required ? parseFloat(prop.security_deposit_amount || "0") : 0;

    // Check for custom date-specific pricing
    const customPricing = await db.execute(sql`
      SELECT date, price FROM st_property_pricing
      WHERE property_id = ${propertyId} AND date >= ${checkIn} AND date < ${checkOut}
    `);
    const customPriceMap = new Map((customPricing.rows as any[]).map(r => [r.date.toISOString().slice(0, 10), parseFloat(r.price)]));

    // Calculate nightly total respecting custom prices
    let nightlyTotal = 0;
    const d = new Date(checkIn + "T00:00:00");
    const endD = new Date(checkOut + "T00:00:00");
    while (d < endD) {
      const dateStr = d.toISOString().slice(0, 10);
      const dayOfWeek = d.getDay();
      const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;
      const customPrice = customPriceMap.get(dateStr);
      nightlyTotal += customPrice !== undefined ? customPrice : (isWeekend ? weekendRate : nightlyRate);
      d.setDate(d.getDate() + 1);
    }

    // Get PM tax settings
    const taxResult = await db.execute(sql`
      SELECT tourism_tax_percent, vat_percent FROM pm_settings WHERE pm_user_id = ${prop.pm_user_id} LIMIT 1
    `);
    const taxSettings = taxResult.rows[0] as any || { tourism_tax_percent: "0", vat_percent: "0" };
    const tourismTaxPct = parseFloat(taxSettings.tourism_tax_percent || "0");
    const vatPct = parseFloat(taxSettings.vat_percent || "0");

    const subtotal = nightlyTotal + cleaningFee;
    const tourismTax = nightlyTotal * (tourismTaxPct / 100);
    const vat = subtotal * (vatPct / 100);
    const total = subtotal + tourismTax + vat + securityDeposit;

    return res.json({
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
    });
  } catch (error: any) {
    console.error("[Bookings] calculate-price error:", error);
    return res.status(500).json({ error: "Failed to calculate price" });
  }
});

// ── POST /api/bookings ────────────────────────────────
// Create a booking (guest only)
router.post("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const userRole = req.session.userRole!;

    // Only guests, POs, and tenants can book via public flow. PMs/team use /manual.
    if (userRole === "SUPER_ADMIN") {
      return res.status(403).json({ error: "Admins cannot create bookings" });
    }
    if (userRole === "PROPERTY_MANAGER") {
      return res.status(403).json({ error: "Property Managers should use the manual booking feature" });
    }
    if (userRole === "PM_TEAM_MEMBER") {
      return res.status(403).json({ error: "Team members should use the manual booking feature" });
    }
    if (userRole === "CLEANER") {
      return res.status(403).json({ error: "Cleaners cannot create bookings" });
    }

    const { propertyId, checkIn, checkOut, guests, paymentMethod, specialRequests } = req.body;

    if (!propertyId || !checkIn || !checkOut || !guests) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Validate dates
    const checkInDate = new Date(checkIn + "T00:00:00");
    const checkOutDate = new Date(checkOut + "T00:00:00");
    if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
      return res.status(400).json({ error: "Invalid date format" });
    }
    if (checkOutDate <= checkInDate) {
      return res.status(400).json({ error: "Check-out date must be after check-in date" });
    }
    // Guests cannot book past dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (checkInDate < today) {
      return res.status(400).json({ error: "Check-in date cannot be in the past" });
    }

    // Get property details
    const propResult = await db.execute(sql`
      SELECT p.*, a.name AS area_name FROM st_properties p
      LEFT JOIN areas a ON a.id = p.area_id
      WHERE p.id = ${propertyId} AND p.status = 'active'
    `);

    if (propResult.rows.length === 0) {
      return res.status(404).json({ error: "Property not found or not active" });
    }

    const prop = propResult.rows[0] as any;

    // Validate minimum stay
    const { totalNights, weekdayNights, weekendNights } = calculateNights(checkIn, checkOut);
    if (totalNights < (prop.minimum_stay || 1)) {
      return res.status(400).json({ error: `Minimum stay is ${prop.minimum_stay || 1} nights` });
    }
    if (guests > prop.max_guests) {
      return res.status(400).json({ error: `Maximum ${prop.max_guests} guests allowed` });
    }

    // Check availability (atomic with row lock simulation)
    const conflict = await db.execute(sql`
      SELECT 1 FROM st_bookings
      WHERE property_id = ${propertyId}
      AND status IN ('confirmed', 'checked_in', 'requested')
      AND check_in_date < ${checkOut}
      AND check_out_date > ${checkIn}
      LIMIT 1
    `);
    if (conflict.rows.length > 0) {
      return res.status(409).json({ error: "Selected dates are no longer available" });
    }

    const blockedConflict = await db.execute(sql`
      SELECT 1 FROM st_blocked_dates
      WHERE property_id = ${propertyId}
      AND start_date < ${checkOut}
      AND end_date > ${checkIn}
      LIMIT 1
    `);
    if (blockedConflict.rows.length > 0) {
      return res.status(409).json({ error: "Selected dates are blocked by the host" });
    }

    // Calculate pricing
    const nightlyRate = parseFloat(prop.nightly_rate || "0");
    const weekendRate = parseFloat(prop.weekend_rate || prop.nightly_rate || "0");
    const cleaningFee = parseFloat(prop.cleaning_fee || "0");
    const securityDeposit = prop.security_deposit_required ? parseFloat(prop.security_deposit_amount || "0") : 0;
    const nightlyTotal = (weekdayNights * nightlyRate) + (weekendNights * weekendRate);

    // Tax settings
    const taxResult = await db.execute(sql`
      SELECT tourism_tax_percent, vat_percent FROM pm_settings WHERE pm_user_id = ${prop.pm_user_id} LIMIT 1
    `);
    const tax = taxResult.rows[0] as any || { tourism_tax_percent: "0", vat_percent: "0" };
    const tourismTax = nightlyTotal * (parseFloat(tax.tourism_tax_percent || "0") / 100);
    const vat = (nightlyTotal + cleaningFee) * (parseFloat(tax.vat_percent || "0") / 100);
    const subtotal = nightlyTotal + cleaningFee;
    const total = subtotal + tourismTax + vat + securityDeposit;

    // Commission calculation (based on rental income, not deposit)
    const rentalIncome = subtotal + tourismTax + vat;
    let commissionAmount = "0";
    if (prop.commission_type === "percentage_per_booking" && prop.commission_value) {
      commissionAmount = (subtotal * (parseFloat(prop.commission_value) / 100)).toFixed(2);
    }
    const ownerPayoutAmount = (rentalIncome - parseFloat(commissionAmount)).toFixed(2);

    // Create booking
    const bookingId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await db.execute(sql`
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
        ${bookingId}, ${propertyId}, ${userId}, ${prop.pm_user_id},
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

    // Get guest name for notifications
    const guestResult = await db.execute(sql`
      SELECT full_name FROM guests WHERE user_id = ${userId} LIMIT 1
    `);
    const guestName = (guestResult.rows[0] as any)?.full_name || "A guest";

    // Notify PM
    await createNotification({
      userId: prop.pm_user_id,
      type: "BOOKING_REQUESTED",
      title: "New booking request",
      body: `${guestName} has requested to book ${prop.public_name || "your property"} from ${checkIn} to ${checkOut}`,
      linkUrl: `/portal/st-properties/${propertyId}?tab=bookings`,
      relatedId: bookingId,
    });

    // Log activity
    await logPropertyActivity(
      propertyId,
      userId,
      "booking_created",
      `New booking request from ${guestName} (${checkIn} to ${checkOut})`,
      { bookingId, checkIn, checkOut, totalAmount: total.toFixed(2) }
    );

    return res.status(201).json({ id: bookingId, status: "requested", expiresAt });
  } catch (error: any) {
    console.error("[Bookings] POST error:", error);
    return res.status(500).json({ error: "Failed to create booking" });
  }
});

// ── GET /api/bookings/my ──────────────────────────────
// List bookings for current user (guest sees their bookings, PM sees all managed bookings)
router.get("/my", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const userRole = req.session.userRole!;
    const status = req.query.status as string;

    let statusFilter = sql``;
    if (status && status !== "all") {
      statusFilter = sql` AND b.status = ${sql.raw(`'${status}'::st_booking_status`)}`;
    }

    // PM/team sees managed bookings; PO sees bookings for owned properties; Guest sees own
    const isPmOrTeam = userRole === "PROPERTY_MANAGER" || userRole === "PM_TEAM_MEMBER";
    const pmId = isPmOrTeam ? await getPmUserId(req) : userId;
    let ownerFilter;
    if (isPmOrTeam) {
      ownerFilter = sql`(b.guest_user_id = ${userId} OR b.pm_user_id = ${pmId})`;
    } else if (userRole === "PROPERTY_OWNER") {
      ownerFilter = sql`b.property_id IN (SELECT id FROM st_properties WHERE po_user_id = ${userId})`;
    } else {
      ownerFilter = sql`b.guest_user_id = ${userId}`;
    }

    const result = await db.execute(sql`
      SELECT b.id, b.status, b.source,
        b.check_in_date AS "checkInDate", b.check_out_date AS "checkOutDate",
        b.number_of_guests AS "numberOfGuests", b.total_nights AS "totalNights",
        b.total_amount AS "totalAmount", b.security_deposit_amount AS "securityDepositAmount",
        b.payment_method AS "paymentMethod", b.payment_status AS "paymentStatus",
        b.cancellation_policy AS "cancellationPolicy",
        b.access_pin AS "accessPin",
        b.created_at AS "createdAt", b.expires_at AS "expiresAt",
        b.confirmed_at AS "confirmedAt",
        (SELECT sd.status FROM st_security_deposits sd WHERE sd.booking_id = b.id LIMIT 1) AS "depositStatus",
        (SELECT s.status FROM pm_po_settlements s WHERE s.booking_id = b.id AND s.reason = 'owner_payout' LIMIT 1) AS "settlementStatus",
        p.id AS "propertyId", p.public_name AS "propertyName",
        p.city AS "propertyCity",
        a.name AS "areaName",
        (SELECT url FROM st_property_photos WHERE property_id = p.id AND is_cover = true LIMIT 1) AS "coverPhoto",
        (SELECT id FROM st_reviews WHERE booking_id = b.id LIMIT 1) AS "reviewId",
        g.full_name AS "guestName"
      FROM st_bookings b
      JOIN st_properties p ON p.id = b.property_id
      LEFT JOIN areas a ON a.id = p.area_id
      LEFT JOIN guests g ON g.user_id = b.guest_user_id
      WHERE ${ownerFilter}
      ${statusFilter}
      ORDER BY b.created_at DESC
    `);

    return res.json(result.rows);
  } catch (error: any) {
    console.error("[Bookings] GET /my error:", error);
    return res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

// ── GET /api/bookings/:id ─────────────────────────────
// Booking detail (role-filtered)
router.get("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const userRole = req.session.userRole!;
    const { id } = req.params;

    const result = await db.execute(sql`
      SELECT b.*,
        p.public_name AS property_name, p.city AS property_city,
        p.check_in_time, p.check_out_time, p.smart_home,
        p.po_user_id,
        a.name AS area_name,
        (SELECT url FROM st_property_photos WHERE property_id = p.id AND is_cover = true LIMIT 1) AS cover_photo,
        g.full_name AS guest_full_name,
        pm_g.full_name AS pm_name
      FROM st_bookings b
      JOIN st_properties p ON p.id = b.property_id
      LEFT JOIN areas a ON a.id = p.area_id
      LEFT JOIN guests g ON g.user_id = b.guest_user_id
      LEFT JOIN guests pm_g ON pm_g.user_id = b.pm_user_id
      WHERE b.id = ${id}
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Booking not found" });
    }

    const booking = result.rows[0] as any;

    // Access control
    const isGuest = booking.guest_user_id === userId;
    const isPm = booking.pm_user_id === userId;
    const isPo = booking.po_user_id === userId;

    if (!isGuest && !isPm && !isPo && userRole !== "SUPER_ADMIN") {
      return res.status(403).json({ error: "Access denied" });
    }

    // Get full guest profile for PM/PO/Admin (KYC view)
    let guestProfile = null;
    if ((isPm || isPo || userRole === "SUPER_ADMIN" || userRole === "PM_TEAM_MEMBER") && booking.guest_user_id) {
      const guestResult = await db.execute(sql`
        SELECT g.full_name AS "fullName", g.dob, g.nationality,
          g.country_of_residence AS "countryOfResidence", g.resident_address AS "residentAddress",
          g.emirates_id_number AS "emiratesIdNumber", g.emirates_id_expiry AS "emiratesIdExpiry",
          g.emirates_id_front_url AS "emiratesIdFrontUrl", g.emirates_id_back_url AS "emiratesIdBackUrl",
          g.passport_number AS "passportNumber", g.passport_expiry AS "passportExpiry",
          g.passport_front_url AS "passportFrontUrl",
          g.kyc_status AS "kycStatus",
          u.email, u.phone, u.created_at AS "registeredAt"
        FROM guests g
        JOIN users u ON u.id = g.user_id
        WHERE g.user_id = ${booking.guest_user_id}
      `);
      if (guestResult.rows.length > 0) guestProfile = guestResult.rows[0];

      // Get guest documents
      const guestDocs = await db.execute(sql`
        SELECT ud.id, dt.label AS "documentName", dt.slug AS "documentType",
          ud.file_url AS "fileUrl", ud.document_number AS "documentNumber",
          ud.expiry_date AS "expiryDate"
        FROM user_documents ud
        JOIN document_types dt ON dt.id = ud.document_type_id
        WHERE ud.user_id = ${booking.guest_user_id}
      `);
      if (guestProfile) (guestProfile as any).documents = guestDocs.rows;
    }

    // Get review if exists
    const review = await db.execute(sql`
      SELECT id, rating, title, description, pm_response AS "pmResponse",
        pm_responded_at AS "pmRespondedAt", created_at AS "createdAt"
      FROM st_reviews WHERE booking_id = ${id} LIMIT 1
    `);

    // Get security deposit if exists
    const deposit = await db.execute(sql`
      SELECT id, amount, status, returned_amount AS "returnedAmount",
        deductions, notes, returned_at AS "returnedAt"
      FROM st_security_deposits WHERE booking_id = ${id} LIMIT 1
    `);

    // Get checkout record if exists
    const checkout = await db.execute(sql`
      SELECT id, checklist_items AS "checklistItems", photos,
        damage_assessment AS "damageAssessment", notes
      FROM st_checkout_records WHERE booking_id = ${id} LIMIT 1
    `);

    // Format response
    const response: any = {
      id: booking.id,
      propertyId: booking.property_id,
      propertyName: booking.property_name,
      propertyCity: booking.property_city,
      areaName: booking.area_name,
      coverPhoto: booking.cover_photo,
      checkInTime: booking.check_in_time,
      checkOutTime: booking.check_out_time,
      smartHome: booking.smart_home,
      guestName: booking.guest_full_name || booking.guest_name,
      guestEmail: booking.guest_email,
      guestPhone: booking.guest_phone,
      guestProfile,
      pmName: booking.pm_name,
      source: booking.source,
      status: booking.status,
      checkInDate: booking.check_in_date,
      checkOutDate: booking.check_out_date,
      numberOfGuests: booking.number_of_guests,
      totalNights: booking.total_nights,
      weekdayNights: booking.weekday_nights,
      weekendNights: booking.weekend_nights,
      nightlyRate: booking.nightly_rate,
      weekendRate: booking.weekend_rate,
      cleaningFee: booking.cleaning_fee,
      tourismTax: booking.tourism_tax,
      vat: booking.vat,
      subtotal: booking.subtotal,
      totalAmount: booking.total_amount,
      securityDepositAmount: booking.security_deposit_amount,
      paymentMethod: booking.payment_method,
      paymentStatus: booking.payment_status,
      cancellationPolicy: booking.cancellation_policy,
      specialRequests: booking.special_requests,
      externalBookingRef: booking.external_booking_ref,
      accessPin: (isGuest || isPm) ? booking.access_pin : null,
      expiresAt: booking.expires_at,
      confirmedAt: booking.confirmed_at,
      declinedAt: booking.declined_at,
      declineReason: booking.decline_reason,
      cancelledAt: booking.cancelled_at,
      cancellationReason: booking.cancellation_reason,
      refundAmount: booking.refund_amount,
      checkedInAt: booking.checked_in_at,
      checkInNotes: booking.check_in_notes,
      checkedOutAt: booking.checked_out_at,
      checkOutNotes: booking.check_out_notes,
      completedAt: booking.completed_at,
      createdAt: booking.created_at,
      review: review.rows[0] || null,
      securityDeposit: deposit.rows[0] || null,
      checkoutRecord: checkout.rows[0] || null,
    };

    // PM-only fields
    if (isPm || userRole === "SUPER_ADMIN") {
      response.pmNotes = booking.pm_notes;
      response.commissionType = booking.commission_type;
      response.commissionValue = booking.commission_value;
      response.commissionAmount = booking.commission_amount;
      response.bankAccountBelongsTo = booking.bank_account_belongs_to;
      response.ownerPayoutAmount = booking.owner_payout_amount;
      response.ownerPayoutStatus = booking.owner_payout_status;
      response.ownerPayoutDate = booking.owner_payout_date;
    }

    // PO can see settlement info
    if (isPo) {
      response.commissionType = booking.commission_type;
      response.commissionAmount = booking.commission_amount;
      response.ownerPayoutAmount = booking.owner_payout_amount;
      response.ownerPayoutStatus = booking.owner_payout_status;
      response.ownerPayoutDate = booking.owner_payout_date;
    }

    return res.json(response);
  } catch (error: any) {
    console.error("[Bookings] GET /:id error:", error);
    return res.status(500).json({ error: "Failed to fetch booking" });
  }
});

// ── PATCH /api/bookings/:id/cancel ────────────────────
// Cancel a booking (guest or PM)
router.patch("/:id/cancel", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const userRole = req.session.userRole!;
    const { id } = req.params;
    const { reason } = req.body;

    const bookingResult = await db.execute(sql`
      SELECT b.*, p.public_name AS property_name
      FROM st_bookings b
      JOIN st_properties p ON p.id = b.property_id
      WHERE b.id = ${id}
    `);

    if (bookingResult.rows.length === 0) {
      return res.status(404).json({ error: "Booking not found" });
    }

    const booking = bookingResult.rows[0] as any;
    const isGuest = booking.guest_user_id === userId;
    const isPm = booking.pm_user_id === userId;

    if (!isGuest && !isPm) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (!["requested", "confirmed"].includes(booking.status)) {
      return res.status(400).json({ error: `Cannot cancel a booking with status: ${booking.status}` });
    }

    // Calculate refund
    const refundAmount = isPm
      ? booking.total_amount // PM cancels = full refund
      : calculateRefund(booking.cancellation_policy, booking.total_amount, booking.check_in_date, booking.status);

    await db.execute(sql`
      UPDATE st_bookings SET
        status = 'cancelled',
        cancelled_at = NOW(),
        cancelled_by = ${userId},
        cancellation_reason = ${reason || null},
        refund_amount = ${refundAmount},
        payment_status = ${parseFloat(refundAmount) > 0 ? sql.raw("'refunded'::st_booking_payment_status") : sql.raw("'paid'::st_booking_payment_status")},
        updated_at = NOW()
      WHERE id = ${id}
    `);

    // Record refund if applicable
    if (parseFloat(refundAmount) > 0 && booking.status === "confirmed") {
      await recordBookingRefund({
        id: booking.id,
        propertyId: booking.property_id,
        refundAmount,
        bankAccountBelongsTo: booking.bank_account_belongs_to,
      });
    }

    // Notify other party
    const notifyUserId = isGuest ? booking.pm_user_id : booking.guest_user_id;
    if (notifyUserId) {
      await createNotification({
        userId: notifyUserId,
        type: "BOOKING_CANCELLED",
        title: "Booking cancelled",
        body: `A booking for ${booking.property_name || "a property"} has been cancelled.${parseFloat(refundAmount) > 0 ? ` Refund: AED ${refundAmount}` : ""}`,
        linkUrl: isGuest
          ? `/portal/st-properties/${booking.property_id}?tab=bookings`
          : `/portal/my-bookings/${id}`,
        relatedId: id,
      });
    }

    await logPropertyActivity(
      booking.property_id,
      userId,
      "booking_cancelled",
      `Booking cancelled by ${isGuest ? "guest" : "PM"}${reason ? `: ${reason}` : ""}`,
      { bookingId: id, refundAmount }
    );

    return res.json({ status: "cancelled", refundAmount });
  } catch (error: any) {
    console.error("[Bookings] PATCH cancel error:", error);
    return res.status(500).json({ error: "Failed to cancel booking" });
  }
});

// ══════════════════════════════════════════════════════
// PM ENDPOINTS
// ══════════════════════════════════════════════════════

// ── GET /api/bookings/property/:propertyId ────────────
// List bookings for a property (PM, team member, or PO)
router.get("/property/:propertyId", requireAuth, requirePmPermission("bookings.view"), async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const userRole = req.session.userRole!;
    const { propertyId } = req.params;
    const status = req.query.status as string;

    // Resolve PM ID for team members
    const resolvedId = (userRole === "PROPERTY_MANAGER" || userRole === "PM_TEAM_MEMBER")
      ? await getPmUserId(req) : userId;

    // Verify access
    const propCheck = await db.execute(sql`
      SELECT pm_user_id, po_user_id FROM st_properties WHERE id = ${propertyId}
    `);
    if (propCheck.rows.length === 0) return res.status(404).json({ error: "Property not found" });

    const prop = propCheck.rows[0] as any;
    if (prop.pm_user_id !== resolvedId && prop.po_user_id !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    let statusFilter = sql``;
    if (status && status !== "all") {
      statusFilter = sql` AND b.status = ${sql.raw(`'${status}'::st_booking_status`)}`;
    }

    const result = await db.execute(sql`
      SELECT b.id, b.status, b.source,
        b.check_in_date AS "checkInDate", b.check_out_date AS "checkOutDate",
        b.number_of_guests AS "numberOfGuests", b.total_nights AS "totalNights",
        b.total_amount AS "totalAmount", b.security_deposit_amount AS "securityDepositAmount",
        (SELECT sd.status FROM st_security_deposits sd WHERE sd.booking_id = b.id LIMIT 1) AS "depositStatus",
        (SELECT s.status FROM pm_po_settlements s WHERE s.booking_id = b.id AND s.reason = 'owner_payout' LIMIT 1) AS "settlementStatus",
        b.payment_method AS "paymentMethod",
        b.payment_status AS "paymentStatus",
        b.owner_payout_amount AS "ownerPayoutAmount",
        b.owner_payout_status AS "ownerPayoutStatus",
        b.commission_amount AS "commissionAmount",
        b.guest_name AS "guestName", b.guest_email AS "guestEmail",
        b.external_booking_ref AS "externalBookingRef",
        b.access_pin AS "accessPin",
        b.cancellation_policy AS "cancellationPolicy",
        b.created_at AS "createdAt", b.expires_at AS "expiresAt",
        b.confirmed_at AS "confirmedAt", b.checked_in_at AS "checkedInAt",
        b.checked_out_at AS "checkedOutAt", b.completed_at AS "completedAt",
        g.full_name AS "guestFullName",
        p.id AS "propertyId", p.public_name AS "propertyName", p.city AS "propertyCity",
        a.name AS "areaName",
        (SELECT url FROM st_property_photos WHERE property_id = p.id AND is_cover = true LIMIT 1) AS "coverPhoto",
        (SELECT id FROM st_reviews WHERE booking_id = b.id LIMIT 1) AS "reviewId"
      FROM st_bookings b
      LEFT JOIN guests g ON g.user_id = b.guest_user_id
      JOIN st_properties p ON p.id = b.property_id
      LEFT JOIN areas a ON a.id = p.area_id
      WHERE b.property_id = ${propertyId}
      ${statusFilter}
      ORDER BY b.check_in_date DESC
    `);

    // Merge guest name from either guests table or manual entry
    const rows = (result.rows as any[]).map(r => ({
      ...r,
      guestName: r.guestFullName || r.guestName || "Unknown Guest",
    }));

    return res.json(rows);
  } catch (error: any) {
    console.error("[Bookings] GET /property/:id error:", error);
    return res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

// ── GET /api/bookings/property/:propertyId/calendar ───
router.get("/property/:propertyId/calendar", requireRole("PROPERTY_MANAGER", "PM_TEAM_MEMBER"), async (req: Request, res: Response) => {
  try {
    const pmId = await getPmUserId(req);
    const { propertyId } = req.params;
    const { from, to } = req.query as Record<string, string>;

    // Verify ownership
    const propCheck = await db.execute(sql`
      SELECT 1 FROM st_properties WHERE id = ${propertyId} AND pm_user_id = ${pmId}
    `);
    if (propCheck.rows.length === 0) return res.status(403).json({ error: "Access denied" });

    const startDate = from || new Date().toISOString().slice(0, 10);
    const endDate = to || new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);

    const bookings = await db.execute(sql`
      SELECT b.id, b.status, b.check_in_date AS "checkInDate", b.check_out_date AS "checkOutDate",
        b.guest_name AS "manualGuestName", b.source,
        g.full_name AS "guestFullName"
      FROM st_bookings b
      LEFT JOIN guests g ON g.user_id = b.guest_user_id
      WHERE b.property_id = ${propertyId}
      AND b.status IN ('requested', 'confirmed', 'checked_in', 'checked_out', 'completed')
      AND b.check_in_date <= ${endDate}
      AND b.check_out_date >= ${startDate}
      ORDER BY b.check_in_date ASC
    `);

    const blocked = await db.execute(sql`
      SELECT id, start_date AS "startDate", end_date AS "endDate", reason
      FROM st_blocked_dates
      WHERE property_id = ${propertyId}
      AND start_date <= ${endDate}
      AND end_date >= ${startDate}
      ORDER BY start_date ASC
    `);

    const calBookings = (bookings.rows as any[]).map(b => ({
      ...b,
      guestName: b.guestFullName || b.manualGuestName || "Guest",
    }));

    return res.json({ bookings: calBookings, blocked: blocked.rows });
  } catch (error: any) {
    console.error("[Bookings] GET calendar error:", error);
    return res.status(500).json({ error: "Failed to fetch calendar" });
  }
});

// ── PATCH /api/bookings/:id/confirm ───────────────────
router.patch("/:id/confirm", requireRole("PROPERTY_MANAGER", "PM_TEAM_MEMBER"), requirePmPermission("bookings.manage"), async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const { id } = req.params;
    const pmId = await getPmUserId(req);

    const bookingResult = await db.execute(sql`
      SELECT b.*, p.public_name AS property_name
      FROM st_bookings b JOIN st_properties p ON p.id = b.property_id
      WHERE b.id = ${id} AND b.pm_user_id = ${pmId}
    `);

    if (bookingResult.rows.length === 0) return res.status(404).json({ error: "Booking not found" });

    const booking = bookingResult.rows[0] as any;
    if (booking.status !== "requested") {
      return res.status(400).json({ error: `Cannot confirm a booking with status: ${booking.status}` });
    }

    // Track who confirmed / collected cash
    const cashCollectedBy = booking.payment_method === "cash" ? userId : null;

    await db.execute(sql`
      UPDATE st_bookings SET status = 'confirmed', confirmed_at = NOW(),
        payment_status = 'paid',
        cash_collected_by_user_id = ${cashCollectedBy},
        updated_at = NOW()
      WHERE id = ${id}
    `);

    // Record financial transactions
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
    });

    // Create settlement records (PM↔PO reconciliation)
    createBookingSettlements(id).catch(err => console.error("[Settlements] Error:", err));

    // Notify guest
    if (booking.guest_user_id) {
      await createNotification({
        userId: booking.guest_user_id,
        type: "BOOKING_CONFIRMED",
        title: "Booking confirmed!",
        body: `Your booking at ${booking.property_name || "a property"} has been confirmed.`,
        linkUrl: `/portal/my-bookings/${id}`,
        relatedId: id,
      });
    }

    // Notify PM when team member performs action
    const userRole = req.session.userRole;
    if (userRole === "PM_TEAM_MEMBER") {
      // Notify the parent PM
      await createNotification({
        userId: pmId,
        type: "BOOKING_CONFIRMED",
        title: "Team member confirmed booking",
        body: `A team member confirmed a booking at ${booking.property_name || "a property"}.`,
        linkUrl: `/portal/my-bookings`,
        relatedId: id,
      });
    }

    await logPropertyActivity(
      booking.property_id, userId, "booking_confirmed",
      `Booking confirmed`, { bookingId: id }
    );

    return res.json({ status: "confirmed" });
  } catch (error: any) {
    console.error("[Bookings] PATCH confirm error:", error);
    return res.status(500).json({ error: "Failed to confirm booking" });
  }
});

// ── PATCH /api/bookings/:id/decline ───────────────────
router.patch("/:id/decline", requireRole("PROPERTY_MANAGER", "PM_TEAM_MEMBER"), requirePmPermission("bookings.manage"), async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const { id } = req.params;
    const { reason } = req.body;

    const bookingResult = await db.execute(sql`
      SELECT b.*, p.public_name AS property_name
      FROM st_bookings b JOIN st_properties p ON p.id = b.property_id
      WHERE b.id = ${id} AND b.pm_user_id = ${userId}
    `);

    if (bookingResult.rows.length === 0) return res.status(404).json({ error: "Booking not found" });

    const booking = bookingResult.rows[0] as any;
    if (booking.status !== "requested") {
      return res.status(400).json({ error: `Cannot decline a booking with status: ${booking.status}` });
    }

    await db.execute(sql`
      UPDATE st_bookings SET status = 'declined', declined_at = NOW(),
        decline_reason = ${reason || null}, updated_at = NOW()
      WHERE id = ${id}
    `);

    if (booking.guest_user_id) {
      await createNotification({
        userId: booking.guest_user_id,
        type: "BOOKING_DECLINED",
        title: "Booking request declined",
        body: `Your booking request for ${booking.property_name || "a property"} has been declined.${reason ? ` Reason: ${reason}` : ""}`,
        linkUrl: `/portal/my-bookings/${id}`,
        relatedId: id,
      });
    }

    await logPropertyActivity(
      booking.property_id, userId, "booking_declined",
      `Booking declined${reason ? `: ${reason}` : ""}`, { bookingId: id }
    );

    return res.json({ status: "declined" });
  } catch (error: any) {
    console.error("[Bookings] PATCH decline error:", error);
    return res.status(500).json({ error: "Failed to decline booking" });
  }
});

// ── POST /api/bookings/manual ─────────────────────────
// PM creates a booking manually (confirmed immediately)
router.post("/manual", requireRole("PROPERTY_MANAGER"), async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const {
      propertyId, guestName, guestEmail, guestPhone,
      checkIn, checkOut, guests, source, externalRef,
      paymentMethod, totalAmountOverride, notes,
    } = req.body;

    if (!propertyId || !checkIn || !checkOut || !guests) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Validate dates
    const checkInDate = new Date(checkIn + "T00:00:00");
    const checkOutDate = new Date(checkOut + "T00:00:00");
    if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
      return res.status(400).json({ error: "Invalid date format" });
    }
    if (checkOutDate <= checkInDate) {
      return res.status(400).json({ error: "Check-out date must be after check-in date" });
    }
    // PM cannot create manual bookings with past check-in dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (checkInDate < today) {
      return res.status(400).json({ error: "Check-in date cannot be in the past" });
    }

    // Validate source enum
    const validSources = ["website", "airbnb", "booking_com", "walk_in", "other"];
    if (source && !validSources.includes(source)) {
      return res.status(400).json({ error: `Invalid source. Must be one of: ${validSources.join(", ")}` });
    }

    // Verify PM owns property
    const propResult = await db.execute(sql`
      SELECT * FROM st_properties WHERE id = ${propertyId} AND pm_user_id = ${userId}
    `);
    if (propResult.rows.length === 0) return res.status(403).json({ error: "Access denied" });

    const prop = propResult.rows[0] as any;

    // Validate max guests
    if (guests && prop.max_guests && guests > prop.max_guests) {
      return res.status(400).json({ error: `Maximum ${prop.max_guests} guests allowed` });
    }

    // Check availability
    const conflict = await db.execute(sql`
      SELECT 1 FROM st_bookings
      WHERE property_id = ${propertyId}
      AND status IN ('confirmed', 'checked_in')
      AND check_in_date < ${checkOut}
      AND check_out_date > ${checkIn}
      LIMIT 1
    `);
    if (conflict.rows.length > 0) {
      return res.status(409).json({ error: "Dates conflict with existing booking" });
    }

    const { totalNights, weekdayNights, weekendNights } = calculateNights(checkIn, checkOut);
    const nightlyRate = parseFloat(prop.nightly_rate || "0");
    const weekendRate = parseFloat(prop.weekend_rate || prop.nightly_rate || "0");
    const cleaningFee = parseFloat(prop.cleaning_fee || "0");
    const securityDeposit = prop.security_deposit_required ? parseFloat(prop.security_deposit_amount || "0") : 0;
    const nightlyTotal = (weekdayNights * nightlyRate) + (weekendNights * weekendRate);

    const taxResult = await db.execute(sql`
      SELECT tourism_tax_percent, vat_percent FROM pm_settings WHERE pm_user_id = ${userId} LIMIT 1
    `);
    const tax = taxResult.rows[0] as any || { tourism_tax_percent: "0", vat_percent: "0" };
    const tourismTax = nightlyTotal * (parseFloat(tax.tourism_tax_percent || "0") / 100);
    const vat = (nightlyTotal + cleaningFee) * (parseFloat(tax.vat_percent || "0") / 100);
    const subtotal = nightlyTotal + cleaningFee;
    const rentalIncome = subtotal + tourismTax + vat;
    const total = totalAmountOverride ? parseFloat(totalAmountOverride) : (subtotal + tourismTax + vat + securityDeposit);

    let commissionAmount = "0";
    if (prop.commission_type === "percentage_per_booking" && prop.commission_value) {
      commissionAmount = (subtotal * (parseFloat(prop.commission_value) / 100)).toFixed(2);
    }
    const ownerPayoutAmount = (totalAmountOverride ? (total - parseFloat(commissionAmount)) : (rentalIncome - parseFloat(commissionAmount))).toFixed(2);

    const bookingId = crypto.randomUUID();
    const validSource = source || "other";

    await db.execute(sql`
      INSERT INTO st_bookings (
        id, property_id, pm_user_id, source, status,
        check_in_date, check_out_date, number_of_guests, total_nights,
        weekday_nights, weekend_nights,
        nightly_rate, weekend_rate, cleaning_fee, tourism_tax, vat,
        subtotal, total_amount, security_deposit_amount,
        payment_method, payment_status, cancellation_policy,
        commission_type, commission_value, commission_amount,
        bank_account_belongs_to, owner_payout_amount, owner_payout_status,
        pm_notes, external_booking_ref, guest_name, guest_email, guest_phone,
        confirmed_at, created_at, updated_at
      ) VALUES (
        ${bookingId}, ${propertyId}, ${userId},
        ${sql.raw(`'${validSource}'::st_booking_source`)}, 'confirmed',
        ${checkIn}, ${checkOut}, ${guests}, ${totalNights},
        ${weekdayNights}, ${weekendNights},
        ${nightlyRate.toFixed(2)}, ${weekendRate.toFixed(2)},
        ${cleaningFee.toFixed(2)}, ${tourismTax.toFixed(2)}, ${vat.toFixed(2)},
        ${subtotal.toFixed(2)}, ${total.toFixed(2)},
        ${securityDeposit > 0 ? securityDeposit.toFixed(2) : null},
        ${paymentMethod ? sql.raw(`'${paymentMethod}'::st_booking_payment_method`) : sql`NULL`},
        'paid',
        ${prop.cancellation_policy ? sql.raw(`'${prop.cancellation_policy}'::st_cancellation_policy`) : sql`NULL`},
        ${prop.commission_type ? sql.raw(`'${prop.commission_type}'::st_commission_type`) : sql`NULL`},
        ${prop.commission_value || null}, ${commissionAmount},
        ${prop.bank_account_belongs_to ? sql.raw(`'${prop.bank_account_belongs_to}'::st_bank_account_belongs_to`) : sql`NULL`},
        ${ownerPayoutAmount}, 'pending',
        ${notes || null}, ${externalRef || null},
        ${guestName || null}, ${guestEmail || null}, ${guestPhone || null},
        NOW(), NOW(), NOW()
      )
    `);

    // Record financial transactions
    await recordBookingIncome({
      id: bookingId,
      propertyId,
      subtotal: subtotal.toFixed(2),
      cleaningFee: cleaningFee.toFixed(2),
      tourismTax: tourismTax.toFixed(2),
      vat: vat.toFixed(2),
      securityDepositAmount: securityDeposit > 0 ? securityDeposit.toFixed(2) : null,
      commissionType: prop.commission_type,
      commissionValue: prop.commission_value,
      commissionAmount,
      bankAccountBelongsTo: prop.bank_account_belongs_to,
    });

    // Create settlement records
    createBookingSettlements(bookingId).catch(err => console.error("[Settlements] Error:", err));

    await logPropertyActivity(
      propertyId, userId, "booking_created",
      `Manual booking added: ${guestName || "Guest"} (${source || "other"})`,
      { bookingId, checkIn, checkOut, source: validSource }
    );

    return res.status(201).json({ id: bookingId, status: "confirmed" });
  } catch (error: any) {
    console.error("[Bookings] POST /manual error:", error);
    return res.status(500).json({ error: "Failed to create manual booking" });
  }
});

// ── PATCH /api/bookings/:id/check-in ──────────────────
router.patch("/:id/check-in", requireRole("PROPERTY_MANAGER", "PM_TEAM_MEMBER"), requirePmPermission("bookings.manage"), async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const { id } = req.params;
    const { notes } = req.body;
    const pmId = await getPmUserId(req);

    const bookingResult = await db.execute(sql`
      SELECT b.*, p.smart_home, p.public_name AS property_name
      FROM st_bookings b JOIN st_properties p ON p.id = b.property_id
      WHERE b.id = ${id} AND b.pm_user_id = ${pmId}
    `);
    if (bookingResult.rows.length === 0) return res.status(404).json({ error: "Booking not found" });

    const booking = bookingResult.rows[0] as any;
    if (booking.status !== "confirmed") {
      return res.status(400).json({ error: `Cannot check in a booking with status: ${booking.status}` });
    }

    // Generate access pin if smart home
    let accessPin: string | null = null;
    if (booking.smart_home) {
      accessPin = Math.floor(100000 + Math.random() * 900000).toString();
    }

    await db.execute(sql`
      UPDATE st_bookings SET status = 'checked_in',
        checked_in_at = NOW(), checked_in_by = ${userId},
        check_in_notes = ${notes || null},
        access_pin = ${accessPin},
        updated_at = NOW()
      WHERE id = ${id}
    `);

    if (booking.guest_user_id) {
      await createNotification({
        userId: booking.guest_user_id,
        type: "BOOKING_CHECKIN",
        title: "Check-in confirmed",
        body: `You have been checked in at ${booking.property_name || "your property"}.${accessPin ? ` Your access pin is: ${accessPin}` : ""}`,
        linkUrl: `/portal/my-bookings/${id}`,
        relatedId: id,
      });
    }

    await logPropertyActivity(
      booking.property_id, userId, "booking_checked_in",
      `Guest checked in`, { bookingId: id, accessPin }
    );

    return res.json({ status: "checked_in", accessPin });
  } catch (error: any) {
    console.error("[Bookings] PATCH check-in error:", error);
    return res.status(500).json({ error: "Failed to check in" });
  }
});

// ── PATCH /api/bookings/:id/check-out ─────────────────
router.patch("/:id/check-out", requireRole("PROPERTY_MANAGER", "PM_TEAM_MEMBER"), requirePmPermission("bookings.manage"), async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const { id } = req.params;
    const { checklistItems, photos, damageAssessment, notes } = req.body;

    const bookingResult = await db.execute(sql`
      SELECT b.*, p.public_name AS property_name
      FROM st_bookings b JOIN st_properties p ON p.id = b.property_id
      WHERE b.id = ${id} AND b.pm_user_id = ${userId}
    `);
    if (bookingResult.rows.length === 0) return res.status(404).json({ error: "Booking not found" });

    const booking = bookingResult.rows[0] as any;
    if (booking.status !== "checked_in") {
      return res.status(400).json({ error: `Cannot check out a booking with status: ${booking.status}` });
    }

    // Create checkout record
    const checkoutId = crypto.randomUUID();
    await db.execute(sql`
      INSERT INTO st_checkout_records (id, booking_id, checklist_items, photos, damage_assessment, notes, completed_by, created_at)
      VALUES (${checkoutId}, ${id},
        ${checklistItems ? JSON.stringify(checklistItems) : null},
        ${photos ? JSON.stringify(photos) : null},
        ${damageAssessment ? JSON.stringify(damageAssessment) : null},
        ${notes || null}, ${userId}, NOW())
    `);

    await db.execute(sql`
      UPDATE st_bookings SET status = 'checked_out',
        checked_out_at = NOW(), checked_out_by = ${userId},
        check_out_notes = ${notes || null},
        access_pin = NULL,
        updated_at = NOW()
      WHERE id = ${id}
    `);

    if (booking.guest_user_id) {
      await createNotification({
        userId: booking.guest_user_id,
        type: "BOOKING_CHECKOUT",
        title: "Check-out completed",
        body: `Check-out completed at ${booking.property_name || "your property"}. Thank you for your stay!`,
        linkUrl: `/portal/my-bookings/${id}`,
        relatedId: id,
      });
    }

    await logPropertyActivity(
      booking.property_id, userId, "booking_checked_out",
      `Guest checked out`, { bookingId: id }
    );

    // Trigger cleaning automation rules
    triggerCleaningAutomation(booking.property_id, booking.pm_user_id, id)
      .catch(err => console.error("[Cleaning Automation] Error:", err));

    return res.json({ status: "checked_out" });
  } catch (error: any) {
    console.error("[Bookings] PATCH check-out error:", error);
    return res.status(500).json({ error: "Failed to check out" });
  }
});

// ── PATCH /api/bookings/:id/complete ──────────────────
router.patch("/:id/complete", requireRole("PROPERTY_MANAGER", "PM_TEAM_MEMBER"), requirePmPermission("bookings.manage"), async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const { id } = req.params;

    const bookingResult = await db.execute(sql`
      SELECT b.*, p.public_name AS property_name
      FROM st_bookings b JOIN st_properties p ON p.id = b.property_id
      WHERE b.id = ${id} AND b.pm_user_id = ${userId}
    `);
    if (bookingResult.rows.length === 0) return res.status(404).json({ error: "Booking not found" });

    const booking = bookingResult.rows[0] as any;
    if (booking.status !== "checked_out") {
      return res.status(400).json({ error: `Cannot complete a booking with status: ${booking.status}` });
    }

    await db.execute(sql`
      UPDATE st_bookings SET status = 'completed', completed_at = NOW(), updated_at = NOW()
      WHERE id = ${id}
    `);

    // Prompt guest for review
    if (booking.guest_user_id) {
      await createNotification({
        userId: booking.guest_user_id,
        type: "BOOKING_CHECKOUT",
        title: "How was your stay?",
        body: `Your stay at ${booking.property_name || "a property"} is complete. We'd love to hear your feedback!`,
        linkUrl: `/portal/my-bookings/${id}`,
        relatedId: id,
      });
    }

    await logPropertyActivity(
      booking.property_id, userId, "booking_completed",
      `Booking completed`, { bookingId: id }
    );

    return res.json({ status: "completed" });
  } catch (error: any) {
    console.error("[Bookings] PATCH complete error:", error);
    return res.status(500).json({ error: "Failed to complete booking" });
  }
});

// ── POST /api/bookings/block-dates ────────────────────
router.post("/block-dates", requireRole("PROPERTY_MANAGER"), async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const { propertyId, startDate, endDate, reason } = req.body;

    if (!propertyId || !startDate || !endDate) {
      return res.status(400).json({ error: "propertyId, startDate, and endDate are required" });
    }

    // Validate dates
    const start = new Date(startDate + "T00:00:00");
    const end = new Date(endDate + "T00:00:00");
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: "Invalid date format" });
    }
    if (end <= start) {
      return res.status(400).json({ error: "End date must be after start date" });
    }

    // Verify PM owns property
    const propCheck = await db.execute(sql`
      SELECT 1 FROM st_properties WHERE id = ${propertyId} AND pm_user_id = ${userId}
    `);
    if (propCheck.rows.length === 0) return res.status(403).json({ error: "Access denied" });

    // Check for conflicts with confirmed/checked-in bookings
    const confirmedConflict = await db.execute(sql`
      SELECT id, check_in_date, check_out_date, guest_name,
        (SELECT full_name FROM guests WHERE user_id = guest_user_id LIMIT 1) AS guest_full_name
      FROM st_bookings
      WHERE property_id = ${propertyId}
      AND status IN ('confirmed', 'checked_in')
      AND check_in_date < ${endDate}
      AND check_out_date > ${startDate}
    `);
    if (confirmedConflict.rows.length > 0) {
      const conflicting = (confirmedConflict.rows as any[]).map(b => ({
        id: b.id,
        guestName: b.guest_full_name || b.guest_name || "Guest",
        checkIn: b.check_in_date,
        checkOut: b.check_out_date,
      }));
      return res.status(409).json({
        error: "Cannot block dates that overlap with confirmed bookings",
        conflicts: conflicting,
      });
    }

    // Auto-decline overlapping requested bookings
    const overlapping = await db.execute(sql`
      SELECT id, guest_user_id, guest_name FROM st_bookings
      WHERE property_id = ${propertyId}
      AND status = 'requested'
      AND check_in_date < ${endDate}
      AND check_out_date > ${startDate}
    `);

    for (const booking of overlapping.rows as any[]) {
      await db.execute(sql`
        UPDATE st_bookings SET status = 'declined',
          declined_at = NOW(), decline_reason = 'Dates blocked by host',
          updated_at = NOW()
        WHERE id = ${booking.id}
      `);

      if (booking.guest_user_id) {
        await createNotification({
          userId: booking.guest_user_id,
          type: "BOOKING_DECLINED",
          title: "Booking request declined",
          body: "Your booking request was declined because the dates have been blocked.",
          linkUrl: `/portal/my-bookings/${booking.id}`,
          relatedId: booking.id,
        });
      }
    }

    const blockId = crypto.randomUUID();
    await db.execute(sql`
      INSERT INTO st_blocked_dates (id, property_id, start_date, end_date, reason, blocked_by, created_at)
      VALUES (${blockId}, ${propertyId}, ${startDate}, ${endDate}, ${reason || null}, ${userId}, NOW())
    `);

    await logPropertyActivity(
      propertyId, userId, "date_blocked",
      `Dates blocked: ${startDate} to ${endDate}${reason ? ` (${reason})` : ""}`,
      { blockId, startDate, endDate, declinedBookings: (overlapping.rows as any[]).length }
    );

    return res.status(201).json({ id: blockId });
  } catch (error: any) {
    console.error("[Bookings] POST block-dates error:", error);
    return res.status(500).json({ error: "Failed to block dates" });
  }
});

// ── DELETE /api/bookings/block-dates/:id ──────────────
router.delete("/block-dates/:id", requireRole("PROPERTY_MANAGER"), async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const { id } = req.params;

    const blockResult = await db.execute(sql`
      SELECT bd.*, p.pm_user_id FROM st_blocked_dates bd
      JOIN st_properties p ON p.id = bd.property_id
      WHERE bd.id = ${id}
    `);
    if (blockResult.rows.length === 0) return res.status(404).json({ error: "Not found" });

    const block = blockResult.rows[0] as any;
    if (block.pm_user_id !== userId) return res.status(403).json({ error: "Access denied" });

    await db.execute(sql`DELETE FROM st_blocked_dates WHERE id = ${id}`);

    await logPropertyActivity(
      block.property_id, userId, "date_unblocked",
      `Dates unblocked: ${block.start_date} to ${block.end_date}`,
      { blockId: id }
    );

    return res.json({ success: true });
  } catch (error: any) {
    console.error("[Bookings] DELETE block-dates error:", error);
    return res.status(500).json({ error: "Failed to unblock dates" });
  }
});

// ── POST /api/bookings/:id/deposit/return ─────────────
router.post("/:id/deposit/return", requireRole("PROPERTY_MANAGER"), async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const { id } = req.params;
    const { returnedAmount, deductions, notes } = req.body;

    const bookingResult = await db.execute(sql`
      SELECT b.*, sd.id AS deposit_id, sd.amount AS deposit_amount, sd.status AS deposit_status
      FROM st_bookings b
      JOIN st_security_deposits sd ON sd.booking_id = b.id
      WHERE b.id = ${id} AND b.pm_user_id = ${userId}
    `);

    if (bookingResult.rows.length === 0) return res.status(404).json({ error: "Booking or deposit not found" });

    const booking = bookingResult.rows[0] as any;
    if (booking.deposit_status === "returned") {
      return res.status(400).json({ error: "Deposit has already been returned" });
    }

    const totalDeductions = (deductions || []).reduce((sum: number, d: any) => sum + parseFloat(d.amount || "0"), 0);
    const returned = parseFloat(returnedAmount || "0");
    const originalAmount = parseFloat(booking.deposit_amount);

    if (returned + totalDeductions > originalAmount + 0.01) {
      return res.status(400).json({ error: "Return + deductions cannot exceed deposit amount" });
    }

    const status = returned >= originalAmount - 0.01 ? "returned" : (totalDeductions > 0 ? "partially_returned" : "returned");

    await db.execute(sql`
      UPDATE st_security_deposits SET
        status = ${sql.raw(`'${status}'::st_security_deposit_status`)},
        returned_amount = ${returned.toFixed(2)},
        returned_at = NOW(),
        deductions = ${deductions ? JSON.stringify(deductions) : null},
        processed_by = ${userId},
        notes = ${notes || null},
        updated_at = NOW()
      WHERE id = ${booking.deposit_id}
    `);

    // Record financial transactions
    await recordDepositReturn({
      bookingId: id,
      propertyId: booking.property_id,
      returnedAmount: returned.toFixed(2),
      deductions: deductions || [],
      bankAccountBelongsTo: booking.bank_account_belongs_to,
    });

    await logPropertyActivity(
      booking.property_id, userId, "deposit_returned",
      `Security deposit: AED ${returned.toFixed(2)} returned${totalDeductions > 0 ? `, AED ${totalDeductions.toFixed(2)} deducted` : ""}`,
      { bookingId: id, returned: returned.toFixed(2), deductions }
    );

    // Auto-create settlement for forfeited amount (damage deduction)
    if (totalDeductions > 0) {
      const propResult = await db.execute(sql`SELECT po_user_id FROM st_properties WHERE id = ${booking.property_id}`);
      const poId = (propResult.rows[0] as any)?.po_user_id;
      if (poId) {
        // Forfeited deposit is income — PM collected it, needs to settle with PO
        await db.execute(sql`
          INSERT INTO pm_po_settlements (id, booking_id, property_id, from_user_id, to_user_id, amount, reason, collected_by, status, notes, created_at, updated_at)
          VALUES (gen_random_uuid()::text, ${id}, ${booking.property_id}, ${userId}, ${poId},
            ${totalDeductions.toFixed(2)}, ${'deposit_forfeiture'},
            'property_manager', 'pending',
            ${(deductions || []).map((d: any) => `${d.reason}: AED ${d.amount}`).join(", ")},
            NOW(), NOW())
        `);
      }
    }

    return res.json({ status, returnedAmount: returned.toFixed(2) });
  } catch (error: any) {
    console.error("[Bookings] POST deposit/return error:", error);
    return res.status(500).json({ error: "Failed to process deposit return" });
  }
});

// ── PATCH /api/bookings/:id/payout ────────────────────
// Mark owner payout as completed
router.patch("/:id/payout", requireRole("PROPERTY_MANAGER", "PM_TEAM_MEMBER"), requirePmPermission("financials.manage"), async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const { id } = req.params;
    const { notes } = req.body;

    const bookingResult = await db.execute(sql`
      SELECT * FROM st_bookings WHERE id = ${id} AND pm_user_id = ${userId}
    `);
    if (bookingResult.rows.length === 0) return res.status(404).json({ error: "Booking not found" });

    const booking = bookingResult.rows[0] as any;
    if (booking.owner_payout_status === "paid") {
      return res.status(400).json({ error: "Owner payout already completed" });
    }

    await db.execute(sql`
      UPDATE st_bookings SET
        owner_payout_status = 'paid',
        owner_payout_date = NOW(),
        updated_at = NOW()
      WHERE id = ${id}
    `);

    await recordOwnerPayout({
      bookingId: id,
      propertyId: booking.property_id,
      amount: booking.owner_payout_amount,
    });

    await logPropertyActivity(
      booking.property_id, userId, "payout_recorded",
      `Owner payout: AED ${booking.owner_payout_amount}`,
      { bookingId: id }
    );

    return res.json({ status: "paid" });
  } catch (error: any) {
    console.error("[Bookings] PATCH payout error:", error);
    return res.status(500).json({ error: "Failed to record payout" });
  }
});

// ══════════════════════════════════════════════════════
// REVIEWS
// ══════════════════════════════════════════════════════

// Submit a review (guest only, after checkout/completed)
router.post("/:id/review", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const { id } = req.params;
    const { rating, title, description } = req.body;

    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: "Rating must be 1-5" });

    // Verify booking belongs to guest and is checked_out or completed
    const bookingResult = await db.execute(sql`
      SELECT b.id, b.property_id, b.status, b.guest_user_id
      FROM st_bookings b WHERE b.id = ${id}
    `);
    if (bookingResult.rows.length === 0) return res.status(404).json({ error: "Booking not found" });

    const booking = bookingResult.rows[0] as any;
    if (booking.guest_user_id !== userId) return res.status(403).json({ error: "Not your booking" });
    if (!["checked_out", "completed"].includes(booking.status)) {
      return res.status(400).json({ error: "Can only review after checkout" });
    }

    // Check if already reviewed
    const existing = await db.execute(sql`SELECT id FROM st_reviews WHERE booking_id = ${id}`);
    if (existing.rows.length > 0) return res.status(400).json({ error: "Already reviewed" });

    const reviewId = crypto.randomUUID();
    await db.execute(sql`
      INSERT INTO st_reviews (id, booking_id, property_id, guest_user_id, rating, title, description)
      VALUES (${reviewId}, ${id}, ${booking.property_id}, ${userId}, ${rating}, ${title ? sanitize(title) : null}, ${description ? sanitize(description) : null})
    `);

    // Notify PM
    const pmResult = await db.execute(sql`SELECT pm_user_id FROM st_properties WHERE id = ${booking.property_id}`);
    const pmId = (pmResult.rows[0] as any)?.pm_user_id;
    if (pmId) {
      await createNotification({
        userId: pmId,
        type: "REVIEW_RECEIVED",
        title: "New review received",
        body: `A guest left a ${rating}-star review`,
        relatedId: reviewId,
      });
    }

    return res.status(201).json({ id: reviewId });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Get review for a booking
router.get("/:id/review", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await db.execute(sql`
      SELECT r.*, g.full_name AS "guestName"
      FROM st_reviews r
      LEFT JOIN guests g ON g.user_id = r.guest_user_id
      WHERE r.booking_id = ${id}
    `);
    if (result.rows.length === 0) return res.status(404).json({ error: "No review" });
    return res.json(result.rows[0]);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
