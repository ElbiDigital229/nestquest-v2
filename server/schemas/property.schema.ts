import { z } from "zod";

export const createPropertySchema = z.object({
  publicName: z.string().min(1, "Property name is required").max(200),
  propertyType: z.enum(["apartment", "villa", "office"]),
  bedrooms: z.number().int().min(0).max(20),
  bathrooms: z.number().int().min(0).max(20),
  maxGuests: z.number().int().min(1).max(50),
  nightlyRate: z.number().positive("Nightly rate must be positive"),
  cleaningFee: z.number().min(0).optional(),
  securityDepositRequired: z.boolean().optional(),
  securityDepositAmount: z.number().min(0).optional(),
  minimumStay: z.number().int().min(1).optional(),
  maximumStay: z.number().int().min(1).optional(),
  city: z.enum(["dubai", "abu_dhabi", "sharjah", "ajman", "ras_al_khaimah", "fujairah", "umm_al_quwain"]).optional(),
  cancellationPolicy: z.enum(["flexible", "moderate", "strict", "non_refundable"]).optional(),
});

export const blockDatesSchema = z.object({
  propertyId: z.string().min(1),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  reason: z.string().max(200).optional(),
  declineConflicting: z.boolean().optional(),
}).refine(d => d.endDate > d.startDate, {
  message: "End date must be after start date",
  path: ["endDate"],
});

export const pricingOverrideSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  price: z.number().positive("Price must be positive"),
});
