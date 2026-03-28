import { pgTable, text, varchar, timestamp, date, pgEnum, boolean, uniqueIndex, integer } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

// ── Enums ──────────────────────────────────────────────

export const roleEnum = pgEnum("role", ["SUPER_ADMIN", "GUEST", "CLEANER", "PROPERTY_MANAGER", "PROPERTY_OWNER", "TENANT"]);

export const PORTAL_ROLES = ["GUEST", "PROPERTY_MANAGER", "PROPERTY_OWNER", "TENANT"] as const;
export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  GUEST: "Guest",
  CLEANER: "Cleaner",
  PROPERTY_MANAGER: "Property Manager",
  PROPERTY_OWNER: "Property Owner",
  TENANT: "Tenant",
};
export const userStatusEnum = pgEnum("user_status", ["active", "suspended"]);
export const kycStatusEnum = pgEnum("kyc_status", ["pending", "verified", "rejected"]);
export const auditActionEnum = pgEnum("audit_action", [
  "ACCOUNT_CREATED",
  "LOGIN",
  "LOGOUT",
  "PROFILE_UPDATED",
  "PASSWORD_CHANGED",
  "KYC_SUBMITTED",
  "KYC_VERIFIED",
  "KYC_REJECTED",
  "STATUS_CHANGED",
  "SETTINGS_UPDATED",
  "LINK_INVITE_SENT",
  "LINK_INVITE_RECEIVED",
  "LINK_ACCEPTED",
  "LINK_REJECTED",
  "LINK_REMOVED",
]);

// ── Users ──────────────────────────────────────────────

export const users = pgTable("users", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull(),
  phone: text("phone"),
  status: userStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("users_email_role_unique").on(table.email, table.role),
]);

// ── Guests ─────────────────────────────────────────────

export const guests = pgTable("guests", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  fullName: text("full_name").notNull(),
  dob: date("dob").notNull(),
  nationality: text("nationality").notNull(),
  countryOfResidence: text("country_of_residence").notNull(),
  residentAddress: text("resident_address").notNull(),
  emiratesIdNumber: text("emirates_id_number").notNull(),
  emiratesIdExpiry: date("emirates_id_expiry").notNull(),
  emiratesIdFrontUrl: text("emirates_id_front_url"),
  emiratesIdBackUrl: text("emirates_id_back_url"),
  // Passport (required for non-PM, optional for PM alongside Emirates ID)
  passportNumber: text("passport_number"),
  passportExpiry: date("passport_expiry"),
  passportFrontUrl: text("passport_front_url"),
  // Trade License (PM only)
  tradeLicenseExpiry: date("trade_license_expiry"),
  tradeLicenseUrl: text("trade_license_url"),
  // Company Info (PM only)
  companyName: text("company_name"),
  companyWebsite: text("company_website"),
  companyDescription: text("company_description"),
  companyAddress: text("company_address"),
  kycStatus: kycStatusEnum("kyc_status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── OTP Verifications ──────────────────────────────────

export const otpVerifications = pgTable("otp_verifications", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  phone: text("phone").notNull(),
  code: text("code").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── User Audit Log ─────────────────────────────────────

export const userAuditLog = pgTable("user_audit_log", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  action: auditActionEnum("action").notNull(),
  details: text("details"),
  metadata: text("metadata"), // JSON string
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── PM-PO/Tenant Links ────────────────────────────────

export const linkStatusEnum = pgEnum("link_status", ["pending", "accepted", "rejected"]);

export const pmPoLinks = pgTable("pm_po_links", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  pmUserId: varchar("pm_user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  targetUserId: varchar("target_user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  targetRole: varchar("target_role", { length: 20 }).notNull(),
  status: linkStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("pm_links_unique").on(table.pmUserId, table.targetUserId),
]);

// ── Notifications ─────────────────────────────────────

export const notificationTypeEnum = pgEnum("notification_type", [
  "LINK_INVITE", "LINK_ACCEPTED", "LINK_REJECTED", "LINK_REMOVED",
  "NEW_MESSAGE", "USER_SIGNUP", "KYC_SUBMISSION", "PLAN_ASSIGNED",
  "INVOICE_CREATED", "INVOICE_OVERDUE",
]);

export const notifications = pgTable("notifications", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: notificationTypeEnum("type").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  linkUrl: text("link_url"),
  relatedId: varchar("related_id", { length: 36 }),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Messages ───────────────────────────────────────────

export const messages = pgTable("messages", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  conversationId: varchar("conversation_id", { length: 36 }).notNull(), // = guests.id
  senderId: varchar("sender_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  senderRole: varchar("sender_role", { length: 20 }).notNull(),
  content: text("content").notNull(),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Plans & Subscriptions ─────────────────────────────

export const billingCycleEnum = pgEnum("billing_cycle", ["monthly", "yearly", "one_time", "custom"]);
export const featureKeyEnum = pgEnum("feature_key", ["max_linked_owners", "max_linked_tenants", "dm_messaging", "document_viewing"]);
export const limitTypeEnum = pgEnum("limit_type", ["boolean", "numeric"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", ["active", "trial", "expired", "cancelled", "pending_payment", "billing_suspended"]);
export const invoiceStatusEnum = pgEnum("invoice_status", ["paid", "pending", "failed", "refunded"]);

export const plans = pgTable("plans", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  price: text("price").notNull().default("0"), // text for decimal
  billingCycle: billingCycleEnum("billing_cycle").notNull().default("monthly"),
  trialDays: integer("trial_days").notNull().default(7),
  isActive: boolean("is_active").notNull().default(true),
  customCycleDays: integer("custom_cycle_days"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const planFeatures = pgTable("plan_features", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  planId: varchar("plan_id", { length: 36 })
    .notNull()
    .references(() => plans.id, { onDelete: "cascade" }),
  featureKey: featureKeyEnum("feature_key").notNull(),
  limitType: limitTypeEnum("limit_type").notNull(),
  booleanValue: boolean("boolean_value"),
  numericMin: integer("numeric_min"),
  numericMax: integer("numeric_max"),
});

export const subscriptions = pgTable("subscriptions", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  planId: varchar("plan_id", { length: 36 })
    .notNull()
    .references(() => plans.id),
  status: subscriptionStatusEnum("status").notNull().default("active"),
  trialEndsAt: timestamp("trial_ends_at"),
  currentPeriodStart: timestamp("current_period_start").notNull().defaultNow(),
  currentPeriodEnd: timestamp("current_period_end").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const invoices = pgTable("invoices", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  subscriptionId: varchar("subscription_id", { length: 36 })
    .notNull()
    .references(() => subscriptions.id, { onDelete: "cascade" }),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  planId: varchar("plan_id", { length: 36 })
    .notNull()
    .references(() => plans.id),
  amount: text("amount").notNull(),
  status: invoiceStatusEnum("invoice_status").notNull().default("pending"),
  billingPeriodStart: timestamp("billing_period_start").notNull(),
  billingPeriodEnd: timestamp("billing_period_end").notNull(),
  dueDate: timestamp("due_date"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Payment Methods ───────────────────────────────────

export const paymentMethods = pgTable("payment_methods", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  cardBrand: text("card_brand").notNull(), // Visa, Mastercard, etc.
  cardLast4: varchar("card_last4", { length: 4 }).notNull(),
  cardHolderName: text("card_holder_name").notNull(),
  expiryMonth: integer("expiry_month"),
  expiryYear: integer("expiry_year"),
  isDefault: boolean("is_default").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Document Types & User Documents (Compliance) ──────

export const documentTypes = pgTable("document_types", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  slug: text("slug").notNull().unique(),
  label: text("label").notNull(),
  hasExpiry: boolean("has_expiry").notNull().default(true),
  applicableRoles: text("applicable_roles").array(), // null = all roles
  requiredForRoles: text("required_for_roles").array(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const userDocuments = pgTable("user_documents", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  documentTypeId: varchar("document_type_id", { length: 36 })
    .notNull()
    .references(() => documentTypes.id),
  fileUrl: text("file_url"),
  documentNumber: text("document_number"),
  expiryDate: timestamp("expiry_date"),
  metadata: text("metadata"), // JSON for extra fields
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── Short-Term Property Management Enums ──────────────

export const stPropertyStatusEnum = pgEnum("st_property_status", ["draft", "active", "inactive"]);
export const stPropertyTypeEnum = pgEnum("st_property_type", ["apartment", "villa", "office"]);
export const stViewTypeEnum = pgEnum("st_view_type", ["sea_view", "garden_view", "city_view", "pool_view", "no_view"]);
export const stAccessTypeEnum = pgEnum("st_access_type", ["traditional_key", "smart_lock"]);
export const stParkingTypeEnum = pgEnum("st_parking_type", ["covered", "basement", "street"]);
export const stCancellationPolicyEnum = pgEnum("st_cancellation_policy", ["flexible", "moderate", "strict", "non_refundable"]);
export const stCommissionTypeEnum = pgEnum("st_commission_type", ["fixed_monthly", "percentage_per_booking"]);
export const stAcquisitionTypeEnum = pgEnum("st_acquisition_type", ["cash", "rented", "financed", "off_plan"]);
export const stHandoverStatusEnum = pgEnum("st_handover_status", ["not_yet", "handed_over"]);
export const stPaymentScheduleStatusEnum = pgEnum("st_payment_schedule_status", ["unpaid", "paid", "overdue"]);
export const stPaymentScheduleTypeEnum = pgEnum("st_payment_schedule_type", ["rental", "mortgage", "off_plan"]);
export const stDocumentTypeEnum = pgEnum("st_document_type", ["title_deed", "spa", "noc", "dtcm", "oqood", "tenancy_contract", "mortgage_agreement", "other"]);
export const stUaeCityEnum = pgEnum("st_uae_city", ["dubai", "abu_dhabi", "sharjah", "ajman", "ras_al_khaimah", "fujairah", "umm_al_quwain"]);
export const stBankAccountBelongsToEnum = pgEnum("st_bank_account_belongs_to", ["property_manager", "property_owner"]);
export const stInternetProviderEnum = pgEnum("st_internet_provider", ["du", "etisalat", "other"]);
export const stBankLenderEnum = pgEnum("st_bank_lender", ["enbd", "adcb", "dib", "mashreq", "fab", "rak_bank", "other"]);

// ── Areas ─────────────────────────────────────────────

export const areas = pgTable("areas", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  city: stUaeCityEnum("city").notNull(),
  latitude: text("latitude"),
  longitude: text("longitude"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Short-Term Properties ─────────────────────────────

export const stProperties = pgTable("st_properties", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  pmUserId: varchar("pm_user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  status: stPropertyStatusEnum("status").default("draft"),

  // Step 1: Property Details
  propertyType: stPropertyTypeEnum("property_type"),
  unitNumber: text("unit_number"),
  floorNumber: integer("floor_number"),
  buildingName: text("building_name"),
  areaSqft: integer("area_sqft"),
  bedrooms: integer("bedrooms").default(0),
  bathrooms: integer("bathrooms").default(0),
  maxGuests: integer("max_guests").default(1),
  maidRoom: boolean("maid_room").default(false),
  furnished: boolean("furnished").default(false),
  ceilingHeight: integer("ceiling_height"),
  viewType: stViewTypeEnum("view_type"),
  smartHome: boolean("smart_home").default(false),

  // Step 1: Address
  addressLine1: text("address_line_1"),
  addressLine2: text("address_line_2"),
  city: stUaeCityEnum("city"),
  zipCode: text("zip_code"),
  latitude: text("latitude"),
  longitude: text("longitude"),
  areaId: varchar("area_id", { length: 36 })
    .references(() => areas.id),

  // Step 1: Parking
  parkingSpaces: integer("parking_spaces").default(0),
  parkingType: stParkingTypeEnum("parking_type"),

  // Step 1: Access
  accessType: stAccessTypeEnum("access_type").default("traditional_key"),
  lockDeviceId: text("lock_device_id"),

  // Step 2: Description
  publicName: text("public_name"),
  shortDescription: text("short_description"),
  longDescription: text("long_description"),
  internalNotes: text("internal_notes"),

  // Step 5: Pricing
  nightlyRate: text("nightly_rate"),
  weekendRate: text("weekend_rate"),
  minimumStay: integer("minimum_stay").default(1),
  cleaningFee: text("cleaning_fee"),
  securityDepositRequired: boolean("security_deposit_required").default(false),
  securityDepositAmount: text("security_deposit_amount"),

  // Step 5: Payment methods
  acceptedPaymentMethods: text("accepted_payment_methods"), // JSON string
  bankAccountBelongsTo: stBankAccountBelongsToEnum("bank_account_belongs_to"),
  bankName: text("bank_name"),
  accountHolderName: text("account_holder_name"),
  accountNumber: text("account_number"),
  iban: text("iban"),
  swiftCode: text("swift_code"),

  // Step 6: Policies
  checkInTime: text("check_in_time").default("15:00"),
  checkOutTime: text("check_out_time").default("12:00"),
  cancellationPolicy: stCancellationPolicyEnum("cancellation_policy"),

  // Step 7: Owner
  poUserId: varchar("po_user_id", { length: 36 })
    .references(() => users.id),
  commissionType: stCommissionTypeEnum("commission_type"),
  commissionValue: text("commission_value"),

  // Step 8: Acquisition
  acquisitionType: stAcquisitionTypeEnum("acquisition_type"),
  confirmed: boolean("confirmed").default(false),

  // Wizard tracking
  wizardStep: integer("wizard_step").default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── ST Property Photos ────────────────────────────────

export const stPropertyPhotos = pgTable("st_property_photos", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  propertyId: varchar("property_id", { length: 36 })
    .notNull()
    .references(() => stProperties.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  displayOrder: integer("display_order").default(0),
  isCover: boolean("is_cover").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── ST Property Amenities ─────────────────────────────

export const stPropertyAmenities = pgTable("st_property_amenities", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  propertyId: varchar("property_id", { length: 36 })
    .notNull()
    .references(() => stProperties.id, { onDelete: "cascade" }),
  amenityKey: text("amenity_key").notNull(),
});

// ── ST Property Policies ──────────────────────────────

export const stPropertyPolicies = pgTable("st_property_policies", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  propertyId: varchar("property_id", { length: 36 })
    .notNull()
    .references(() => stProperties.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── ST Property Documents ─────────────────────────────

export const stPropertyDocuments = pgTable("st_property_documents", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  propertyId: varchar("property_id", { length: 36 })
    .notNull()
    .references(() => stProperties.id, { onDelete: "cascade" }),
  documentType: stDocumentTypeEnum("document_type").notNull(),
  name: text("name"),
  description: text("description"),
  fileUrl: text("file_url"),
  hasExpiry: boolean("has_expiry").default(false),
  expiryDate: date("expiry_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── ST Acquisition Details ────────────────────────────

export const stAcquisitionDetails = pgTable("st_acquisition_details", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  propertyId: varchar("property_id", { length: 36 })
    .notNull()
    .unique()
    .references(() => stProperties.id, { onDelete: "cascade" }),

  // Cash + Financed + Off-plan shared
  purchasePrice: text("purchase_price"),
  purchaseDate: date("purchase_date"),

  // Cash/Financed specific
  downPayment: text("down_payment"),

  // Rented
  annualRent: text("annual_rent"),
  numCheques: integer("num_cheques"),
  paymentMethod: text("payment_method"),
  tenancyStart: date("tenancy_start"),
  tenancyEnd: date("tenancy_end"),
  securityDepositPaid: text("security_deposit_paid"),

  // Financed
  bankLender: stBankLenderEnum("bank_lender"),
  loanAmount: text("loan_amount"),
  interestRate: text("interest_rate"),
  loanTermYears: integer("loan_term_years"),
  monthlyEmi: text("monthly_emi"),
  mortgageStart: date("mortgage_start"),
  mortgageEnd: date("mortgage_end"),

  // Off-plan
  expectedHandover: date("expected_handover"),
  handoverStatus: stHandoverStatusEnum("handover_status"),

  // Utilities
  dewaNo: text("dewa_no"),
  internetProvider: stInternetProviderEnum("internet_provider"),
  internetAccountNo: text("internet_account_no"),
  gasNo: text("gas_no"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── ST Payment Schedules ──────────────────────────────

export const stPaymentSchedules = pgTable("st_payment_schedules", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  propertyId: varchar("property_id", { length: 36 })
    .notNull()
    .references(() => stProperties.id, { onDelete: "cascade" }),
  scheduleType: stPaymentScheduleTypeEnum("schedule_type").notNull(),
  milestoneName: text("milestone_name"),
  amount: text("amount").notNull(),
  dueDate: date("due_date"),
  status: stPaymentScheduleStatusEnum("status").default("unpaid"),
  paidDate: date("paid_date"),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── Zod Schemas ────────────────────────────────────────

export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);

export const insertGuestSchema = createInsertSchema(guests);
export const selectGuestSchema = createSelectSchema(guests);

export const insertAuditLogSchema = createInsertSchema(userAuditLog);
export const selectAuditLogSchema = createSelectSchema(userAuditLog);

// ── Validation Schemas ─────────────────────────────────

export const signupSchema = z.object({
  email: z.string().email("Please enter a valid email address").max(254).transform(s => s.toLowerCase().trim()),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be at most 128 characters")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/\d/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
  fullName: z
    .string()
    .min(2, "Full name must be at least 2 characters")
    .max(100, "Full name must be at most 100 characters")
    .regex(/^[a-zA-Z\s]+$/, "Full name can only contain letters and spaces")
    .transform(s => s.trim()),
  phone: z.string().min(8, "Phone number is required"),
  dob: z.string().min(1, "Date of birth is required"),
  nationality: z.string().min(1, "Nationality is required"),
  countryOfResidence: z.string().min(1, "Country of residence is required"),
  residentAddress: z.string().min(5, "Resident address must be at least 5 characters").max(500),
  emiratesIdNumber: z
    .string()
    .min(6, "ID card number must be at least 6 characters")
    .max(20, "ID card number must be at most 20 characters")
    .regex(/^[a-zA-Z0-9\-]+$/, "ID card number can only contain letters, numbers, and hyphens"),
  emiratesIdExpiry: z.string().min(1, "ID expiry date is required"),
  emiratesIdFrontUrl: z.string().min(1, "ID card front image is required"),
  emiratesIdBackUrl: z.string().min(1, "ID card back image is required"),
  role: z.enum(["GUEST", "PROPERTY_MANAGER", "PROPERTY_OWNER", "TENANT"]),
});

export const loginSchema = z.object({
  email: z.string().email().transform(s => s.toLowerCase().trim()),
  password: z.string().min(1, "Password is required"),
  role: z.enum(["SUPER_ADMIN", "GUEST", "PROPERTY_MANAGER", "PROPERTY_OWNER", "TENANT"]),
});

// ── Types ──────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Guest = typeof guests.$inferSelect;
export type InsertGuest = typeof guests.$inferInsert;
export type AuditLog = typeof userAuditLog.$inferSelect;
export type InsertAuditLog = typeof userAuditLog.$inferInsert;
export type PmPoLink = typeof pmPoLinks.$inferSelect;
export type InsertPmPoLink = typeof pmPoLinks.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;
export type Plan = typeof plans.$inferSelect;
export type InsertPlan = typeof plans.$inferInsert;
export type PlanFeature = typeof planFeatures.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type DocumentType = typeof documentTypes.$inferSelect;
export type UserDocument = typeof userDocuments.$inferSelect;
export type Area = typeof areas.$inferSelect;
export type StProperty = typeof stProperties.$inferSelect;
export type InsertStProperty = typeof stProperties.$inferInsert;
export type StPropertyPhoto = typeof stPropertyPhotos.$inferSelect;
export type StPropertyAmenity = typeof stPropertyAmenities.$inferSelect;
export type StPropertyPolicy = typeof stPropertyPolicies.$inferSelect;
export type StPropertyDocument = typeof stPropertyDocuments.$inferSelect;
export type StAcquisitionDetail = typeof stAcquisitionDetails.$inferSelect;
export type StPaymentSchedule = typeof stPaymentSchedules.$inferSelect;
