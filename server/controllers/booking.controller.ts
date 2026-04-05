/**
 * Booking Controller
 *
 * Thin HTTP handlers — validate input, call the booking service, return responses.
 * No business logic lives here.
 */

import { Request, Response } from "express";
import {
  validateBookingDates,
  calculatePrice,
  createBooking,
  confirmBooking,
  cancelBooking,
} from "../services/booking.service";
import { getPmUserId } from "../middleware/pm-permissions";
import { createBookingSchema, cancelBookingSchema } from "../schemas/booking.schema";
import { ValidationError } from "../errors/index";
import logger from "../utils/logger";

/**
 * @openapi
 * /bookings/calculate-price:
 *   post:
 *     tags: [Bookings]
 *     summary: Calculate price breakdown for given dates
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [propertyId, checkIn, checkOut]
 *             properties:
 *               propertyId: { type: string }
 *               checkIn: { type: string, format: date, example: "2026-05-01" }
 *               checkOut: { type: string, format: date, example: "2026-05-05" }
 *               guests: { type: integer }
 *     responses:
 *       200:
 *         description: Price breakdown
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PriceBreakdown'
 *       400:
 *         description: Invalid input
 *       404:
 *         description: Property not found
 */
export async function calculatePriceHandler(req: Request, res: Response): Promise<Response> {
  const { propertyId, checkIn, checkOut, guests } = req.body;

  if (!propertyId || !checkIn || !checkOut) {
    return res.status(400).json({ error: "propertyId, checkIn, and checkOut are required" });
  }

  const dateCheck = validateBookingDates(checkIn, checkOut);
  if (!dateCheck.valid) return res.status(400).json({ error: dateCheck.error });

  try {
    const result = await calculatePrice(propertyId, checkIn, checkOut, guests);
    if ("error" in result) return res.status(result.status).json({ error: result.error });
    return res.json(result);
  } catch (err: any) {
    logger.error({ err }, "calculatePrice error");
    return res.status(500).json({ error: "Failed to calculate price" });
  }
}

/**
 * @openapi
 * /bookings:
 *   post:
 *     tags: [Bookings]
 *     summary: Create a booking request (guest flow)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [propertyId, checkIn, checkOut, guests]
 *             properties:
 *               propertyId: { type: string }
 *               checkIn: { type: string, format: date }
 *               checkOut: { type: string, format: date }
 *               guests: { type: integer }
 *               paymentMethod: { type: string, enum: [bank_transfer, cash, card] }
 *               specialRequests: { type: string }
 *     responses:
 *       201:
 *         description: Booking created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: string }
 *                 status: { type: string, example: requested }
 *                 expiresAt: { type: string, format: date-time }
 *       400: { description: Validation error }
 *       401: { description: Not authenticated }
 *       409: { description: Dates no longer available }
 */
export async function createBookingHandler(req: Request, res: Response): Promise<Response> {
  const userRole = req.session.userRole!;

  if (userRole === "SUPER_ADMIN") return res.status(403).json({ error: "Admins cannot create bookings" });
  if (userRole === "PROPERTY_MANAGER") return res.status(403).json({ error: "Property Managers should use the manual booking feature" });
  if (userRole === "PM_TEAM_MEMBER") return res.status(403).json({ error: "Team members should use the manual booking feature" });
  if (userRole === "CLEANER") return res.status(403).json({ error: "Cleaners cannot create bookings" });

  const parsed = createBookingSchema.safeParse(req.body);
  if (!parsed.success) {
    const details: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "_root";
      if (!details[key]) details[key] = [];
      details[key].push(issue.message);
    }
    throw new ValidationError("Validation failed", details);
  }

  const { propertyId, checkIn, checkOut, guests, paymentMethod, specialRequests } = parsed.data;

  const dateCheck = validateBookingDates(checkIn, checkOut);
  if (!dateCheck.valid) return res.status(400).json({ error: dateCheck.error });

  try {
    const result = await createBooking({
      propertyId,
      guestUserId: req.session.userId!,
      checkIn,
      checkOut,
      guests,
      paymentMethod,
      specialRequests,
    });
    return res.status(201).json(result);
  } catch (err: any) {
    const status = err.status || 500;
    logger.error({ err }, "createBooking error");
    return res.status(status).json({ error: err.message || "Failed to create booking" });
  }
}

/**
 * @openapi
 * /bookings/{id}/confirm:
 *   patch:
 *     tags: [Bookings]
 *     summary: Confirm a booking (PM only)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Booking confirmed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: confirmed }
 *       400: { description: Cannot confirm — wrong status }
 *       403: { description: Not a PM or missing permission }
 *       404: { description: Booking not found }
 */
export async function confirmBookingHandler(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;

  try {
    const pmId = await getPmUserId(req);
    await confirmBooking({
      bookingId: id,
      pmUserId: pmId,
      confirmedByUserId: req.session.userId!,
      confirmedByRole: req.session.userRole!,
    });
    return res.json({ status: "confirmed" });
  } catch (err: any) {
    const status = err.status || 500;
    logger.error({ err, bookingId: id }, "confirmBooking error");
    return res.status(status).json({ error: err.message || "Failed to confirm booking" });
  }
}

// ── POST /api/bookings/:id/cancel ─────────────────────

export async function cancelBookingHandler(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;

  const parsed = cancelBookingSchema.safeParse(req.body);
  if (!parsed.success) {
    const details: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "_root";
      if (!details[key]) details[key] = [];
      details[key].push(issue.message);
    }
    throw new ValidationError("Validation failed", details);
  }

  const { reason } = parsed.data;

  try {
    const result = await cancelBooking({
      bookingId: id,
      cancelledByUserId: req.session.userId!,
      cancelledByRole: req.session.userRole!,
      reason,
    });
    return res.json({ status: "cancelled", refundAmount: result.refundAmount });
  } catch (err: any) {
    const status = err.status || 500;
    logger.error({ err, bookingId: id }, "cancelBooking error");
    return res.status(status).json({ error: err.message || "Failed to cancel booking" });
  }
}
