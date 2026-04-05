import { z } from "zod";

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format");

export const createBookingSchema = z.object({
  propertyId: z.string().uuid("Invalid property ID"),
  checkIn: dateString,
  checkOut: dateString,
  guests: z.number().int().min(1, "At least 1 guest required").max(50),
  paymentMethod: z.enum(["card", "bank_transfer", "cash"]).optional(),
  specialRequests: z.string().max(1000).optional(),
}).refine(d => d.checkOut > d.checkIn, {
  message: "Check-out must be after check-in",
  path: ["checkOut"],
});

export const manualBookingSchema = z.object({
  propertyId: z.string().min(1, "Property is required"),
  guestUserId: z.string().optional(),
  guestName: z.string().max(100).optional(),
  guestEmail: z.string().email().optional(),
  guestPhone: z.string().max(20).optional(),
  checkIn: dateString,
  checkOut: dateString,
  guests: z.number().int().min(1).max(50),
  source: z.enum(["website", "airbnb", "booking_com", "walk_in", "other"]).optional(),
  externalRef: z.string().max(100).optional(),
  paymentMethod: z.enum(["card", "bank_transfer", "cash"]).optional(),
  totalAmountOverride: z.number().positive("Must be a positive amount").optional(),
  notes: z.string().max(2000).optional(),
}).refine(d => d.checkOut > d.checkIn, {
  message: "Check-out must be after check-in",
  path: ["checkOut"],
});

export const cancelBookingSchema = z.object({
  reason: z.string().min(1, "Cancellation reason is required").max(500),
});

export const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().max(100).optional(),
  description: z.string().max(2000).optional(),
});

export const reviewResponseSchema = z.object({
  response: z.string().min(1, "Response text is required").max(1000),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type ManualBookingInput = z.infer<typeof manualBookingSchema>;
