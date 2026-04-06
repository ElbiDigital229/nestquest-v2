import { Router, Request, Response } from "express";
import { db, withTransaction } from "../db/index";
import { sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../middleware/auth";
import { createNotification } from "../utils/notify";
import { logPropertyActivity } from "../utils/property-activity";
import { recordBookingIncome, recordBookingRefund, recordDepositReturn, recordOwnerPayout } from "../utils/booking-financials";
import { getPmUserId, requirePmPermission } from "../middleware/pm-permissions";
import { sanitize } from "../utils/sanitize";
import { bookingEmitter } from "../events/booking-emitter";
import { validate } from "../middleware/validate";
import {
  manualBookingSchema,
  cancelBookingSchema,
  reviewSchema,
  reviewResponseSchema,
} from "../schemas/booking.schema";
import { blockDatesSchema } from "../schemas/property.schema";
import {
  calculatePriceHandler,
  createBookingHandler,
  confirmBookingHandler,
} from "../controllers/booking.controller";

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
    // Saturday (6) and Sunday (0) are weekend
    if (day === 0 || day === 6) {
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
    const row = result.rows[0] as any;
    return res.json({
      ...row,
      acceptedPaymentMethods: row.acceptedPaymentMethods ? JSON.parse(row.acceptedPaymentMethods) : [],
    });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ══════════════════════════════════════════════════════
// PUBLIC / GUEST ENDPOINTS
// ══════════════════════════════════════════════════════

// ── POST /api/bookings/calculate-price ────────────────
// Calculate price breakdown without creating a booking
router.post("/calculate-price", calculatePriceHandler);

// ── POST /api/bookings ────────────────────────────────
// Create a booking (guest only) — availability check uses SELECT FOR UPDATE to prevent double-booking
router.post("/", requireAuth, createBookingHandler);

// ── GET /api/bookings/my ──────────────────────────────
// List bookings for current user (guest sees their bookings, PM sees all managed bookings)
router.get("/my", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const userRole = req.session.userRole!;
    const status = req.query.status as string;

    const validStatuses = ["requested", "confirmed", "checked_in", "checked_out", "completed", "cancelled", "declined", "expired"];
    let statusFilter = sql``;
    if (status && status !== "all" && validStatuses.includes(status)) {
      statusFilter = sql` AND b.status = ${status}::st_booking_status`;
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
      LEFT JOIN users g ON g.id = b.guest_user_id
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

// ── GET /api/bookings/guests — All guests who have booked PM's properties
router.get("/guests", requireRole("PROPERTY_MANAGER", "PM_TEAM_MEMBER"), async (req: Request, res: Response) => {
  try {
    const pmId = await getPmUserId(req);

    // Get unique guests with their booking stats
    const result = await db.execute(sql`
      SELECT
        u.id AS "userId",
        COALESCE(g.full_name, b.guest_name) AS "name",
        u.email,
        u.phone,
        g.nationality,
        g.kyc_status AS "kycStatus",
        COUNT(b.id)::int AS "totalBookings",
        COUNT(CASE WHEN b.status = 'completed' THEN 1 END)::int AS "completedBookings",
        COUNT(CASE WHEN b.status = 'cancelled' THEN 1 END)::int AS "cancelledBookings",
        COUNT(CASE WHEN b.status IN ('confirmed', 'checked_in') THEN 1 END)::int AS "activeBookings",
        COALESCE(SUM(CASE WHEN b.status IN ('confirmed', 'checked_in', 'checked_out', 'completed') THEN b.total_amount::decimal ELSE 0 END), 0) AS "totalSpent",
        MIN(b.check_in_date) AS "firstBooking",
        MAX(b.check_in_date) AS "lastBooking",
        MAX(b.created_at) AS "lastActivity"
      FROM st_bookings b
      JOIN st_properties p ON p.id = b.property_id
      JOIN users u ON u.id = b.guest_user_id
      LEFT JOIN users g ON g.id = b.guest_user_id
      WHERE p.pm_user_id = ${pmId}
        AND b.guest_user_id IS NOT NULL
      GROUP BY u.id, g.full_name, b.guest_name, u.email, u.phone, g.nationality, g.kyc_status
      ORDER BY MAX(b.created_at) DESC
    `);

    return res.json(result.rows);
  } catch (error: any) {
    console.error("[Bookings] GET /guests error:", error);
    return res.status(500).json({ error: "Failed to fetch guests" });
  }
});

// ── GET /api/bookings/guests/:guestId/history — Booking history for a specific guest
router.get("/guests/:guestId/history", requireRole("PROPERTY_MANAGER", "PM_TEAM_MEMBER"), async (req: Request, res: Response) => {
  try {
    const pmId = await getPmUserId(req);
    const { guestId } = req.params;

    // Guest profile
    const profileResult = await db.execute(sql`
      SELECT u.id, u.email, u.phone, u.created_at AS "registeredAt",
        u.full_name AS "fullName", u.dob, u.nationality,
        u.country_of_residence AS "countryOfResidence", u.resident_address AS "residentAddress",
        u.emirates_id_number AS "emiratesIdNumber", u.emirates_id_expiry AS "emiratesIdExpiry",
        u.passport_number AS "passportNumber", u.passport_expiry AS "passportExpiry",
        u.kyc_status AS "kycStatus"
      FROM users u
      WHERE u.id = ${guestId}
    `);

    if (profileResult.rows.length === 0) {
      return res.status(404).json({ error: "Guest not found" });
    }

    // All bookings for this guest on PM's properties
    const bookingsResult = await db.execute(sql`
      SELECT
        b.id, b.status, b.source,
        b.check_in_date AS "checkIn", b.check_out_date AS "checkOut",
        b.total_nights AS "totalNights", b.number_of_guests AS "numberOfGuests",
        b.total_amount AS "totalAmount", b.payment_method AS "paymentMethod",
        b.payment_status AS "paymentStatus",
        b.commission_type AS "commissionType", b.commission_amount AS "commissionAmount",
        b.special_requests AS "specialRequests",
        b.cancellation_reason AS "cancellationReason", b.decline_reason AS "declineReason",
        b.created_at AS "createdAt",
        p.id AS "propertyId", p.public_name AS "propertyName",
        p.building_name AS "buildingName", p.unit_number AS "unitNumber",
        (SELECT url FROM st_property_photos WHERE property_id = p.id AND is_cover = true LIMIT 1) AS "coverPhoto",
        (SELECT rating FROM st_reviews WHERE booking_id = b.id LIMIT 1) AS "reviewRating"
      FROM st_bookings b
      JOIN st_properties p ON p.id = b.property_id
      WHERE b.guest_user_id = ${guestId}
        AND p.pm_user_id = ${pmId}
      ORDER BY b.check_in_date DESC
    `);

    return res.json({
      guest: profileResult.rows[0],
      bookings: bookingsResult.rows,
    });
  } catch (error: any) {
    console.error("[Bookings] GET /guests/:id/history error:", error);
    return res.status(500).json({ error: "Failed to fetch guest history" });
  }
});

// ── GET /api/bookings/cancellations — All cancelled/declined bookings for PM's properties
router.get("/cancellations", requireRole("PROPERTY_MANAGER", "PM_TEAM_MEMBER"), async (req: Request, res: Response) => {
  try {
    const pmId = await getPmUserId(req);
    const result = await db.execute(sql`
      SELECT b.id, b.status, b.check_in_date AS "checkIn", b.check_out_date AS "checkOut",
        b.cancelled_at AS "cancelledAt", b.cancellation_reason AS "cancellationReason",
        b.declined_at AS "declinedAt", b.decline_reason AS "declineReason",
        b.refund_amount AS "refundAmount", b.total_amount AS "totalAmount",
        'AED' AS currency,
        p.public_name AS "propertyName",
        COALESCE(g.full_name, b.guest_name) AS "guestName"
      FROM st_bookings b
      JOIN st_properties p ON p.id = b.property_id
      LEFT JOIN users g ON g.id = b.guest_user_id
      WHERE p.pm_user_id = ${pmId}
        AND b.status IN ('cancelled', 'declined')
      ORDER BY COALESCE(b.cancelled_at, b.declined_at) DESC
    `);
    return res.json(result.rows);
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/bookings/:id/ledger ─────────────────────
// Unified financial ledger for a booking — role-filtered
// Guest: fee breakdown + deposit status
// PO: their payout + settlement status + deposit damage view
// PM/SA: everything
router.get("/:id/ledger", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const userRole = req.session.userRole!;
    const { id } = req.params;

    // Fetch base booking + property
    const bookingResult = await db.execute(sql`
      SELECT b.id, b.status, b.guest_user_id, b.pm_user_id, b.property_id,
        b.check_in_date AS "checkInDate", b.check_out_date AS "checkOutDate",
        b.total_nights AS "totalNights",
        b.nightly_rate AS "nightlyRate", b.weekend_rate AS "weekendRate",
        b.weekday_nights AS "weekdayNights", b.weekend_nights AS "weekendNights",
        b.cleaning_fee AS "cleaningFee", b.tourism_tax AS "tourismTax", b.vat,
        b.subtotal, b.total_amount AS "totalAmount",
        b.security_deposit_amount AS "securityDepositAmount",
        b.commission_amount AS "commissionAmount",
        b.owner_payout_amount AS "ownerPayoutAmount",
        b.owner_payout_status AS "ownerPayoutStatus",
        b.payment_status AS "paymentStatus", b.payment_method AS "paymentMethod",
        b.refund_amount AS "refundAmount", b.cancellation_reason AS "cancellationReason",
        p.po_user_id AS "poUserId", p.public_name AS "propertyName"
      FROM st_bookings b
      JOIN st_properties p ON p.id = b.property_id
      WHERE b.id = ${id}
    `);

    if (bookingResult.rows.length === 0) return res.status(404).json({ error: "Booking not found" });

    const b = bookingResult.rows[0] as any;

    // Access control
    const isGuest = b.guest_user_id === userId;
    const isPm = b.pm_user_id === userId;
    const isPo = b.po_user_id === userId;
    const isSa = userRole === "SUPER_ADMIN";
    const isPmTeam = userRole === "PM_TEAM_MEMBER";

    if (!isGuest && !isPm && !isPo && !isSa && !isPmTeam) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Deposit status — visible to all parties (with different detail levels)
    const depositResult = await db.execute(sql`
      SELECT id, amount, status, returned_amount AS "returnedAmount",
        returned_at AS "returnedAt", deductions, notes
      FROM st_security_deposits WHERE booking_id = ${id} LIMIT 1
    `);
    const deposit = depositResult.rows[0] as any || null;

    // Build guest-facing view (fee breakdown + deposit)
    const guestView = {
      nights: b.totalNights,
      weekdayNights: b.weekdayNights,
      weekendNights: b.weekendNights,
      nightlyRate: b.nightlyRate,
      weekendRate: b.weekendRate,
      cleaningFee: b.cleaningFee,
      tourismTax: b.tourismTax,
      vat: b.vat,
      subtotal: b.subtotal,
      totalAmount: b.totalAmount,
      paymentStatus: b.paymentStatus,
      paymentMethod: b.paymentMethod,
      refundAmount: b.refundAmount,
      cancellationReason: b.cancellationReason,
      deposit: deposit ? {
        amount: deposit.amount || b.securityDepositAmount,
        status: deposit.status || "held",
        returnedAmount: deposit.returnedAmount,
        returnedAt: deposit.returnedAt,
        deductions: deposit.deductions ? JSON.parse(deposit.deductions) : [],
        notes: deposit.notes,
      } : (b.securityDepositAmount ? { amount: b.securityDepositAmount, status: "held", returnedAmount: null, returnedAt: null, deductions: [], notes: null } : null),
    };

    if (isGuest) return res.json({ role: "guest", ...guestView });

    // PM/PO/SA: fetch settlements
    const settlementsResult = await db.execute(sql`
      SELECT s.id, s.reason, s.amount, s.status, s.from_user_id AS "fromUserId",
        s.to_user_id AS "toUserId", s.paid_at AS "paidAt", s.confirmed_at AS "confirmedAt",
        s.notes, s.proof_url AS "proofUrl", s.collected_by AS "collectedBy",
        fu.full_name AS "fromName", tu.full_name AS "toName"
      FROM pm_po_settlements s
      LEFT JOIN users fu ON fu.id = s.from_user_id
      LEFT JOIN users tu ON tu.id = s.to_user_id
      WHERE s.booking_id = ${id}
      ORDER BY s.created_at ASC
    `);
    const settlements = settlementsResult.rows as any[];

    // PO view — only their payout, deposit damage info
    if (isPo && !isSa) {
      const mySettlement = settlements.find(s => s.reason === "owner_payout" && s.toUserId === userId);
      return res.json({
        role: "owner",
        property: b.propertyName,
        checkInDate: b.checkInDate,
        checkOutDate: b.checkOutDate,
        bookingTotal: b.totalAmount,
        myPayout: {
          amount: b.ownerPayoutAmount,
          status: mySettlement?.status || b.ownerPayoutStatus || "pending",
          paidAt: mySettlement?.paidAt || null,
          confirmedAt: mySettlement?.confirmedAt || null,
          proofUrl: mySettlement?.proofUrl || null,
          settlementId: mySettlement?.id || null,
        },
        deposit: deposit ? {
          amount: deposit.amount || b.securityDepositAmount,
          status: deposit.status || "held",
          returnedAmount: deposit.returnedAmount,
          deductions: deposit.deductions ? JSON.parse(deposit.deductions) : [],
          notes: deposit.notes,
        } : null,
        commission: {
          amount: b.commissionAmount,
        },
      });
    }

    // PM/SA: full ledger — transactions + settlements + deposit
    const txResult = await db.execute(sql`
      SELECT id, transaction_type AS "transactionType", category, amount, direction,
        held_by AS "heldBy", owed_to AS "owedTo", description, recorded_at AS "recordedAt"
      FROM st_booking_transactions
      WHERE booking_id = ${id}
      ORDER BY recorded_at ASC
    `);

    return res.json({
      role: isSa ? "admin" : "pm",
      property: b.propertyName,
      checkInDate: b.checkInDate,
      checkOutDate: b.checkOutDate,
      status: b.status,
      guest: {
        ...guestView,
      },
      transactions: txResult.rows,
      settlements,
      ownerPayout: {
        amount: b.ownerPayoutAmount,
        status: b.ownerPayoutStatus,
      },
      commission: {
        amount: b.commissionAmount,
      },
      deposit: deposit ? {
        amount: deposit.amount,
        status: deposit.status,
        returnedAmount: deposit.returnedAmount,
        returnedAt: deposit.returnedAt,
        deductions: deposit.deductions ? JSON.parse(deposit.deductions) : [],
        notes: deposit.notes,
      } : null,
    });
  } catch (error: any) {
    console.error("[Bookings] GET /:id/ledger error:", error);
    return res.status(500).json({ error: "Failed to fetch ledger" });
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
      LEFT JOIN users g ON g.id = b.guest_user_id
      LEFT JOIN users pm_g ON pm_g.id = b.pm_user_id
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
        SELECT u.full_name AS "fullName", u.dob, u.nationality,
          u.country_of_residence AS "countryOfResidence", u.resident_address AS "residentAddress",
          u.emirates_id_number AS "emiratesIdNumber", u.emirates_id_expiry AS "emiratesIdExpiry",
          u.emirates_id_front_url AS "emiratesIdFrontUrl", u.emirates_id_back_url AS "emiratesIdBackUrl",
          u.passport_number AS "passportNumber", u.passport_expiry AS "passportExpiry",
          u.passport_front_url AS "passportFrontUrl",
          u.kyc_status AS "kycStatus",
          u.email, u.phone, u.created_at AS "registeredAt"
        FROM users u
        WHERE u.id = ${booking.guest_user_id}
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

    // Build per-night pricing breakdown
    // Helper: convert pg date (may be string "YYYY-MM-DD" or Date object) to "YYYY-MM-DD"
    const toDateKey = (d: any): string => {
      if (!d) return "";
      if (typeof d === "string") return d.slice(0, 10);
      if (d instanceof Date) return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
      return String(d).slice(0, 10);
    };
    const checkInKey = toDateKey(booking.check_in_date);
    const checkOutKey = toDateKey(booking.check_out_date);
    const customPricingRows = await db.execute(sql`
      SELECT date::text AS date, price FROM st_property_pricing
      WHERE property_id = ${booking.property_id}
        AND date >= ${checkInKey}::date AND date < ${checkOutKey}::date
    `);
    const customPriceMap = new Map(
      (customPricingRows.rows as any[]).map((r) => [r.date.slice(0, 10), parseFloat(r.price)])
    );
    const nightlyRate = parseFloat(booking.nightly_rate || "0");
    const weekendRate = parseFloat(booking.weekend_rate || booking.nightly_rate || "0");
    const pricingBreakdown: { date: string; price: number; type: string }[] = [];
    const dLoop = new Date(checkInKey + "T00:00:00Z");
    const endLoop = new Date(checkOutKey + "T00:00:00Z");
    while (dLoop < endLoop) {
      const dateStr = `${dLoop.getUTCFullYear()}-${String(dLoop.getUTCMonth() + 1).padStart(2, "0")}-${String(dLoop.getUTCDate()).padStart(2, "0")}`;
      const dow = dLoop.getUTCDay();
      const isWeekend = dow === 0 || dow === 6;
      const custom = customPriceMap.get(dateStr);
      pricingBreakdown.push({
        date: dateStr,
        price: custom !== undefined ? custom : isWeekend ? weekendRate : nightlyRate,
        type: custom !== undefined ? "custom" : isWeekend ? "weekend" : "weekday",
      });
      dLoop.setUTCDate(dLoop.getUTCDate() + 1);
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
      pricingBreakdown,
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

    // Add lock PIN info for PM/PO/Guest (gracefully skip if tables don't exist yet)
    if (isGuest || isPm || isPo || userRole === "PM_TEAM_MEMBER" || userRole === "SUPER_ADMIN") {
      try {
        const pinResult = await db.execute(sql`
          SELECT p.id, p.pin, p.status, p.valid_from AS "validFrom", p.valid_until AS "validUntil",
            p.created_at AS "createdAt", p.deactivated_at AS "deactivatedAt",
            l.name AS "lockName", l.brand AS "lockBrand", l.location AS "lockLocation"
          FROM st_lock_pins p
          JOIN st_property_locks l ON l.id = p.lock_id
          WHERE p.booking_id = ${id}
          ORDER BY p.created_at DESC
        `);
        response.lockPins = pinResult.rows;
      } catch {
        response.lockPins = [];
      }
    }

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

// ── GET /api/bookings/:id/cancel-preview ──────────────
// Preview refund calculation before cancelling
router.get("/:id/cancel-preview", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const userRole = req.session.userRole!;
    const { id } = req.params;

    const bookingResult = await db.execute(sql`
      SELECT b.*, p.public_name AS property_name, p.po_user_id
      FROM st_bookings b JOIN st_properties p ON p.id = b.property_id
      WHERE b.id = ${id}
    `);
    if (bookingResult.rows.length === 0) return res.status(404).json({ error: "Booking not found" });

    const booking = bookingResult.rows[0] as any;
    const isPm = booking.pm_user_id === userId || userRole === "PM_TEAM_MEMBER";
    const totalAmount = parseFloat(booking.total_amount || "0");
    const securityDeposit = parseFloat(booking.security_deposit_amount || "0");
    const rentalAmount = totalAmount - securityDeposit;

    // Rental refund based on policy
    const rentalRefund = isPm
      ? rentalAmount
      : parseFloat(calculateRefund(booking.cancellation_policy, rentalAmount.toFixed(2), booking.check_in_date, booking.status));

    // Security deposit: always fully returned on cancellation (guest never stayed)
    const depositRefund = securityDeposit;

    const totalRefund = rentalRefund + depositRefund;
    const nonRefundable = rentalAmount - rentalRefund;

    return res.json({
      rentalAmount: rentalAmount.toFixed(2),
      securityDeposit: securityDeposit.toFixed(2),
      rentalRefund: rentalRefund.toFixed(2),
      depositRefund: depositRefund.toFixed(2),
      totalRefund: totalRefund.toFixed(2),
      nonRefundable: nonRefundable.toFixed(2),
      cancellationPolicy: booking.cancellation_policy,
      status: booking.status,
    });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── PATCH /api/bookings/:id/cancel ────────────────────
// Cancel a booking (guest or PM) with full financial flow
router.patch("/:id/cancel", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const userRole = req.session.userRole!;
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason?.trim()) {
      return res.status(400).json({ error: "Cancellation reason is required" });
    }

    const bookingResult = await db.execute(sql`
      SELECT b.*, p.public_name AS property_name, p.po_user_id
      FROM st_bookings b JOIN st_properties p ON p.id = b.property_id
      WHERE b.id = ${id}
    `);

    if (bookingResult.rows.length === 0) return res.status(404).json({ error: "Booking not found" });

    const booking = bookingResult.rows[0] as any;
    const isGuest = booking.guest_user_id === userId;
    const isPmOrTeam = booking.pm_user_id === userId || userRole === "PM_TEAM_MEMBER";

    if (!isGuest && !isPmOrTeam) return res.status(403).json({ error: "Access denied" });
    if (!["requested", "confirmed"].includes(booking.status)) {
      return res.status(400).json({ error: `Cannot cancel a booking with status: ${booking.status}` });
    }

    const totalAmount = parseFloat(booking.total_amount || "0");
    const securityDeposit = parseFloat(booking.security_deposit_amount || "0");
    const rentalAmount = totalAmount - securityDeposit;

    // Calculate refund
    const rentalRefund = isPmOrTeam
      ? rentalAmount
      : parseFloat(calculateRefund(booking.cancellation_policy, rentalAmount.toFixed(2), booking.check_in_date, booking.status));
    const depositRefund = securityDeposit; // Always full return on cancel
    const totalRefund = rentalRefund + depositRefund;

    // ── Atomic transaction: cancel booking + handle refund + deposit ──
    await withTransaction(async (tx) => {
      // 1. Update booking status
      await tx.execute(sql`
        UPDATE st_bookings SET
          status = 'cancelled',
          cancelled_at = NOW(),
          cancelled_by = ${userId},
          cancellation_reason = ${sanitize(reason)},
          refund_amount = ${totalRefund.toFixed(2)},
          payment_status = ${totalRefund > 0 ? sql.raw("'refunded'::st_booking_payment_status") : sql.raw("'paid'::st_booking_payment_status")},
          updated_at = NOW()
        WHERE id = ${id}
      `);

      // 2. Void pending settlements for this booking
      await tx.execute(sql`
        DELETE FROM pm_po_settlements WHERE booking_id = ${id} AND status = 'pending'
      `);

      // 3. Auto-return security deposit if exists
      if (securityDeposit > 0) {
        const depositResult = await tx.execute(sql`
          SELECT id FROM st_security_deposits WHERE booking_id = ${id} AND status NOT IN ('returned', 'forfeited')
        `);
        if (depositResult.rows.length > 0) {
          await tx.execute(sql`
            UPDATE st_security_deposits SET
              status = 'returned', returned_amount = ${securityDeposit.toFixed(2)},
              returned_at = NOW(), notes = 'Auto-returned on cancellation', updated_at = NOW()
            WHERE booking_id = ${id}
          `);
        }
      }

      // 4. Record refund transaction + create guest refund settlement (confirmed bookings only)
      if (totalRefund > 0 && booking.status === "confirmed") {
        await recordBookingRefund({
          id: booking.id,
          propertyId: booking.property_id,
          refundAmount: totalRefund.toFixed(2),
          bankAccountBelongsTo: booking.bank_account_belongs_to,
        }, tx);

        await tx.execute(sql`
          INSERT INTO pm_po_settlements (id, booking_id, property_id, from_user_id, to_user_id, amount, reason, collected_by, status, notes, created_at, updated_at)
          VALUES (gen_random_uuid()::text, ${id}, ${booking.property_id},
            ${booking.pm_user_id}, ${booking.guest_user_id || booking.pm_user_id},
            ${totalRefund.toFixed(2)}, 'guest_refund', 'property_manager', 'pending',
            ${'Cancellation refund: ' + sanitize(reason)},
            NOW(), NOW())
        `);
      }
    });

    // 5. Notify other party
    const notifyUserId = isGuest ? booking.pm_user_id : booking.guest_user_id;
    if (notifyUserId) {
      await createNotification({
        userId: notifyUserId,
        type: "BOOKING_CANCELLED",
        title: "Booking cancelled",
        body: `Booking at ${booking.property_name || "a property"} has been cancelled.${totalRefund > 0 ? ` Refund: AED ${totalRefund.toFixed(2)}` : ""} Reason: ${reason}`,
        linkUrl: isGuest ? `/portal/my-bookings` : `/portal/my-bookings`,
        relatedId: id,
      });
    }

    await logPropertyActivity(
      booking.property_id, userId, "booking_cancelled",
      `Booking cancelled by ${isGuest ? "guest" : "PM"}: ${reason}. Refund: AED ${totalRefund.toFixed(2)}`,
      { bookingId: id, rentalRefund, depositRefund, totalRefund, reason }
    );

    return res.json({
      status: "cancelled",
      rentalRefund: rentalRefund.toFixed(2),
      depositRefund: depositRefund.toFixed(2),
      totalRefund: totalRefund.toFixed(2),
    });
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

    // Verify access (SA bypasses ownership check)
    const propCheck = await db.execute(sql`
      SELECT pm_user_id, po_user_id FROM st_properties WHERE id = ${propertyId}
    `);
    if (propCheck.rows.length === 0) return res.status(404).json({ error: "Property not found" });

    const prop = propCheck.rows[0] as any;
    if (userRole !== "SUPER_ADMIN" && prop.pm_user_id !== resolvedId && prop.po_user_id !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const validStatuses = ["requested", "confirmed", "checked_in", "checked_out", "completed", "cancelled", "declined", "expired"];
    let statusFilter = sql``;
    if (status && status !== "all" && validStatuses.includes(status)) {
      statusFilter = sql` AND b.status = ${status}::st_booking_status`;
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
      LEFT JOIN users g ON g.id = b.guest_user_id
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
router.get("/property/:propertyId/calendar", requireAuth, async (req: Request, res: Response) => {
  try {
    const userRole = req.session.userRole!;
    const pmId = userRole === "SUPER_ADMIN"
      ? ((await db.execute(sql`SELECT pm_user_id FROM st_properties WHERE id = ${req.params.propertyId} LIMIT 1`)).rows[0] as any)?.pm_user_id
      : await getPmUserId(req);
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
      LEFT JOIN users g ON g.id = b.guest_user_id
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
router.patch("/:id/confirm", requireRole("PROPERTY_MANAGER", "PM_TEAM_MEMBER"), requirePmPermission("bookings.manage"), confirmBookingHandler);

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
router.post("/manual", requireRole("PROPERTY_MANAGER"), validate(manualBookingSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const {
      propertyId, guestUserId, guestName, guestEmail, guestPhone,
      checkIn, checkOut, guests, source, externalRef,
      paymentMethod, totalAmountOverride, notes,
    } = req.body;

    // Validate that check-in is not in the past (business rule beyond schema)
    const checkInDate = new Date(checkIn + "T00:00:00");
    const checkOutDate = new Date(checkOut + "T00:00:00");
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

    // Validate override amount
    if (totalAmountOverride !== undefined) {
      const overrideVal = parseFloat(totalAmountOverride);
      if (isNaN(overrideVal) || overrideVal <= 0) {
        return res.status(400).json({ error: "Total amount override must be a positive number" });
      }
    }

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
      const commissionPct = parseFloat(prop.commission_value);
      if (commissionPct > 100) {
        return res.status(400).json({ error: "Commission percentage cannot exceed 100%" });
      }
      commissionAmount = (subtotal * (commissionPct / 100)).toFixed(2);
      if (parseFloat(commissionAmount) > subtotal) {
        return res.status(400).json({ error: "Commission amount cannot exceed booking subtotal" });
      }
    }
    const ownerPayoutAmount = (totalAmountOverride ? (total - parseFloat(commissionAmount)) : (rentalIncome - parseFloat(commissionAmount))).toFixed(2);

    const bookingId = crypto.randomUUID();
    const validSource = source || "other";

    // Atomic: booking row + financial ledger entries in a single transaction
    await withTransaction(async (tx) => {
      await tx.execute(sql`
        INSERT INTO st_bookings (
          id, property_id, pm_user_id, source, status,
          check_in_date, check_out_date, number_of_guests, total_nights,
          weekday_nights, weekend_nights,
          nightly_rate, weekend_rate, cleaning_fee, tourism_tax, vat,
          subtotal, total_amount, security_deposit_amount,
          payment_method, payment_status, cancellation_policy,
          commission_type, commission_value, commission_amount,
          bank_account_belongs_to, owner_payout_amount, owner_payout_status,
          pm_notes, external_booking_ref, guest_user_id, guest_name, guest_email, guest_phone,
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
          ${guestUserId || null}, ${guestName || null}, ${guestEmail || null}, ${guestPhone || null},
          NOW(), NOW(), NOW()
        )
      `);

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
      }, tx);
    });

    await logPropertyActivity(
      propertyId, userId, "booking_created",
      `Manual booking added: ${guestName || "Guest"} (${source || "other"})`,
      { bookingId, checkIn, checkOut, source: validSource }
    );

    // Emit event — lifecycle service handles settlements, notifications, and message templates
    const pmInfo = await db.execute(sql`SELECT full_name, phone FROM users WHERE id = ${userId} LIMIT 1`);
    const pmRow = pmInfo.rows[0] as any;
    const propAddrResult = await db.execute(sql`SELECT address_line_1, city FROM st_properties WHERE id = ${propertyId} LIMIT 1`);
    const propAddr = propAddrResult.rows[0] as any;
    bookingEmitter.emit("booking:confirmed", {
      bookingId,
      pmUserId: userId,
      guestUserId: guestUserId || null,
      guestName: guestName || "Guest",
      propertyId,
      propertyName: prop.public_name || "the property",
      propertyAddress: [propAddr?.address_line_1, propAddr?.city].filter(Boolean).join(", "),
      pmName: pmRow?.full_name || "Your Property Manager",
      pmPhone: pmRow?.phone || "",
      checkInDate: checkIn,
      checkOutDate: checkOut,
      totalNights,
      totalAmount: total.toFixed(2),
      accessPin: null,
    });

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

    // Generate access pin if smart home — use lock system if available
    let accessPin: string | null = null;
    if (booking.smart_home) {
      accessPin = Math.floor(100000 + Math.random() * 900000).toString();

      // If property has locks, create a pin record
      const lockResult = await db.execute(sql`
        SELECT id FROM st_property_locks WHERE property_id = ${booking.property_id} AND is_active = true LIMIT 1
      `);
      if (lockResult.rows.length > 0) {
        const lockId = (lockResult.rows[0] as any).id;
        const checkInTime = booking.check_in_time || "15:00";
        const checkOutTime = booking.check_out_time || "12:00";
        const validFrom = new Date(`${booking.check_in_date}T${checkInTime}:00`);
        const validUntil = new Date(`${booking.check_out_date}T${checkOutTime}:00`);

        // Deactivate old pins
        await db.execute(sql`
          UPDATE st_lock_pins SET status = 'deactivated', deactivated_at = NOW()
          WHERE booking_id = ${id} AND status = 'active'
        `);

        await db.execute(sql`
          INSERT INTO st_lock_pins (id, lock_id, booking_id, pin, valid_from, valid_until, status, generated_by)
          VALUES (gen_random_uuid()::text, ${lockId}, ${id}, ${accessPin}, ${validFrom.toISOString()}, ${validUntil.toISOString()}, 'active', ${userId})
        `);
      }
    }

    await db.execute(sql`
      UPDATE st_bookings SET status = 'checked_in',
        checked_in_at = NOW(), checked_in_by = ${userId},
        check_in_notes = ${notes || null},
        access_pin = ${accessPin},
        updated_at = NOW()
      WHERE id = ${id}
    `);

    // Fetch context for side-effects, then emit — lifecycle service handles notifications + templates
    const [guestNameResult, pmInfoResult, propInfoResult] = await Promise.all([
      booking.guest_user_id
        ? db.execute(sql`SELECT full_name FROM users WHERE id = ${booking.guest_user_id} LIMIT 1`)
        : Promise.resolve({ rows: [] }),
      db.execute(sql`SELECT full_name, phone FROM users WHERE id = ${pmId} LIMIT 1`),
      db.execute(sql`SELECT address_line_1, city FROM st_properties WHERE id = ${booking.property_id} LIMIT 1`),
    ]);
    const guestName = (guestNameResult.rows[0] as any)?.full_name || "Guest";
    const pmInfo = pmInfoResult.rows[0] as any;
    const propInfo = propInfoResult.rows[0] as any;
    bookingEmitter.emit("booking:checked_in", {
      bookingId: id,
      pmUserId: pmId,
      guestUserId: booking.guest_user_id || null,
      guestName,
      propertyId: booking.property_id,
      propertyName: booking.property_name || "the property",
      propertyAddress: [propInfo?.address_line_1, propInfo?.city].filter(Boolean).join(", "),
      pmName: pmInfo?.full_name || "Your Property Manager",
      pmPhone: pmInfo?.phone || "",
      checkInDate: booking.check_in_date,
      checkOutDate: booking.check_out_date,
      checkInTime: booking.check_in_time,
      checkOutTime: booking.check_out_time,
      totalNights: booking.total_nights,
      totalAmount: booking.total_amount || "0",
      accessPin,
    });

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

    const pmId = await getPmUserId(req);
    const guestNameResult = booking.guest_user_id
      ? await db.execute(sql`SELECT full_name FROM users WHERE id = ${booking.guest_user_id} LIMIT 1`)
      : { rows: [] };
    const guestName = (guestNameResult.rows[0] as any)?.full_name || "Guest";

    // Emit — lifecycle service handles guest notification, post_checkout template, cleaning automation
    bookingEmitter.emit("booking:checked_out", {
      bookingId: id,
      pmUserId: pmId,
      guestUserId: booking.guest_user_id || null,
      guestName,
      propertyId: booking.property_id,
      propertyName: booking.property_name || "the property",
      checkInDate: booking.check_in_date,
      checkOutDate: booking.check_out_date,
      checkInTime: booking.check_in_time,
      checkOutTime: booking.check_out_time,
      totalNights: booking.total_nights,
    });

    await logPropertyActivity(
      booking.property_id, userId, "booking_checked_out",
      `Guest checked out`, { bookingId: id }
    );

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

    // Block completion if security deposit hasn't been processed
    const depositCheck = await db.execute(sql`
      SELECT status FROM st_security_deposits WHERE booking_id = ${id} LIMIT 1
    `);
    if (depositCheck.rows.length > 0) {
      const depStatus = (depositCheck.rows[0] as any).status;
      if (!["returned", "partially_returned", "forfeited"].includes(depStatus)) {
        return res.status(400).json({ error: "Security deposit must be processed (returned or forfeited) before completing this booking" });
      }
    }

    // Block completion if any settlement is still pending (unresolved money owed)
    const settlementCheck = await db.execute(sql`
      SELECT id FROM pm_po_settlements
      WHERE booking_id = ${id} AND status = 'pending'
      LIMIT 1
    `);
    if (settlementCheck.rows.length > 0) {
      return res.status(400).json({ error: "Outstanding settlement must be paid before completing this booking" });
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
router.post("/block-dates", requireRole("PROPERTY_MANAGER"), validate(blockDatesSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const { propertyId, startDate, endDate, reason } = req.body;

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

    // Use a transaction + FOR UPDATE to prevent a booking sneaking in while we're blocking
    let conflicting: any[] = [];
    let autoDeclined: any[] = [];
    let blockId = crypto.randomUUID();

    await withTransaction(async (tx) => {
      // Lock overlapping confirmed/checked-in bookings rows
      const confirmedConflict = await tx.execute(sql`
        SELECT id, check_in_date, check_out_date, guest_name,
          (SELECT full_name FROM users WHERE id = guest_user_id LIMIT 1) AS guest_full_name
        FROM st_bookings
        WHERE property_id = ${propertyId}
        AND status IN ('confirmed', 'checked_in')
        AND check_in_date < ${endDate}
        AND check_out_date > ${startDate}
        FOR UPDATE
      `);

      if (confirmedConflict.rows.length > 0) {
        conflicting = (confirmedConflict.rows as any[]).map(b => ({
          id: b.id,
          guestName: b.guest_full_name || b.guest_name || "Guest",
          checkIn: b.check_in_date,
          checkOut: b.check_out_date,
        }));
        throw Object.assign(new Error("CONFLICT"), { conflicting });
      }

      // Lock and auto-decline overlapping requested bookings atomically
      const overlapping = await tx.execute(sql`
        SELECT id, guest_user_id, guest_name FROM st_bookings
        WHERE property_id = ${propertyId}
        AND status = 'requested'
        AND check_in_date < ${endDate}
        AND check_out_date > ${startDate}
        FOR UPDATE
      `);

      for (const booking of overlapping.rows as any[]) {
        await tx.execute(sql`
          UPDATE st_bookings SET status = 'declined',
            declined_at = NOW(), decline_reason = 'Dates blocked by host',
            updated_at = NOW()
          WHERE id = ${booking.id}
        `);
        autoDeclined.push(booking);
      }

      await tx.execute(sql`
        INSERT INTO st_blocked_dates (id, property_id, start_date, end_date, reason, blocked_by, created_at)
        VALUES (${blockId}, ${propertyId}, ${startDate}, ${endDate}, ${reason || null}, ${userId}, NOW())
      `);
    });

    // Note: conflict case is handled below in catch block
    void conflicting; // referenced in catch

    // Notifications + activity logs outside the transaction (non-critical)
    for (const booking of autoDeclined) {
      if (booking.guest_user_id) {
        await createNotification({
          userId: booking.guest_user_id,
          type: "BOOKING_DECLINED",
          title: "Booking request declined",
          body: "Your booking request was declined because the dates have been blocked.",
          linkUrl: `/portal/my-bookings/${booking.id}`,
          relatedId: booking.id,
        }).catch(() => {});
      }
      await logPropertyActivity(
        propertyId, userId, "booking_declined",
        `Booking auto-declined due to date block (guest: ${booking.guest_name || "unknown"})`,
        { bookingId: booking.id, reason: "date_block" }
      ).catch(() => {});
    }

    await logPropertyActivity(
      propertyId, userId, "date_blocked",
      `Dates blocked: ${startDate} to ${endDate}${reason ? ` (${reason})` : ""}`,
      { blockId, startDate, endDate, declinedBookings: autoDeclined.length }
    );

    return res.status(201).json({ id: blockId });
  } catch (error: any) {
    if (error.message === "CONFLICT") {
      return res.status(409).json({
        error: "Cannot block dates that overlap with confirmed bookings",
        conflicts: error.conflicting,
      });
    }
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

    // Atomic: update booking status + record financial transaction together
    await withTransaction(async (tx) => {
      await tx.execute(sql`
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
      }, tx);
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
router.post("/:id/review", requireAuth, validate(reviewSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const { id } = req.params;
    const { rating, title, description } = req.body;

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
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Get review for a booking
router.get("/:id/review", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await db.execute(sql`
      SELECT r.*, g.full_name AS "guestName"
      FROM st_reviews r
      LEFT JOIN users g ON g.id = r.guest_user_id
      WHERE r.booking_id = ${id}
    `);
    if (result.rows.length === 0) return res.status(404).json({ error: "No review" });
    return res.json(result.rows[0]);
  } catch {
    return res.status(500).json({ error: "Failed to fetch review" });
  }
});

// ── PATCH /api/bookings/:id/review/response — PM responds to a guest review
router.patch("/:id/review/response", requireRole("PROPERTY_MANAGER", "PM_TEAM_MEMBER"), requirePmPermission("bookings.manage"), validate(reviewResponseSchema), async (req: Request, res: Response) => {
  try {
    const pmId = await getPmUserId(req);
    const { id } = req.params;
    const { response } = req.body;

    // Verify the booking belongs to this PM
    const bookingCheck = await db.execute(sql`
      SELECT pm_user_id FROM st_bookings WHERE id = ${id} LIMIT 1
    `);
    if (bookingCheck.rows.length === 0) return res.status(404).json({ error: "Booking not found" });
    if ((bookingCheck.rows[0] as any).pm_user_id !== pmId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const reviewCheck = await db.execute(sql`
      SELECT id, guest_user_id FROM st_reviews WHERE booking_id = ${id} LIMIT 1
    `);
    if (reviewCheck.rows.length === 0) return res.status(404).json({ error: "No review found for this booking" });

    const review = reviewCheck.rows[0] as any;

    await db.execute(sql`
      UPDATE st_reviews
      SET pm_response = ${sanitize(response)}, pm_responded_at = NOW()
      WHERE booking_id = ${id}
    `);

    // Notify the guest
    if (review.guest_user_id) {
      await createNotification({
        userId: review.guest_user_id,
        type: "BOOKING_CONFIRMED",
        title: "Property manager responded to your review",
        body: sanitize(response).slice(0, 100),
        linkUrl: `/portal/my-bookings?id=${id}`,
        relatedId: review.id,
      });
    }

    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: "Failed to save response" });
  }
});

export default router;
