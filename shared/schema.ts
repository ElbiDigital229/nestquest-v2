import { pgTable, text, varchar, timestamp, date, pgEnum, boolean, uniqueIndex, index, integer } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

// ── Enums ──────────────────────────────────────────────

export const roleEnum = pgEnum("role", ["SUPER_ADMIN", "GUEST", "CLEANER", "PROPERTY_MANAGER", "PROPERTY_OWNER", "TENANT", "PM_TEAM_MEMBER"]);

export const PORTAL_ROLES = ["GUEST", "PROPERTY_MANAGER", "PROPERTY_OWNER", "TENANT", "PM_TEAM_MEMBER"] as const;
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
  // ── KYC Profile (nullable — only set after profile submission) ──
  fullName: text("full_name"),
  dob: date("dob"),
  nationality: text("nationality"),
  countryOfResidence: text("country_of_residence"),
  residentAddress: text("resident_address"),
  emiratesIdNumber: text("emirates_id_number"),
  emiratesIdExpiry: date("emirates_id_expiry"),
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
  kycStatus: kycStatusEnum("kyc_status"),
}, (table) => [
  uniqueIndex("users_email_role_unique").on(table.email, table.role),
]);

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
}, (table) => [
  index("user_audit_log_user_id_idx").on(table.userId),
]);

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
  "BOOKING_REQUESTED", "BOOKING_CONFIRMED", "BOOKING_DECLINED", "BOOKING_CANCELLED",
  "BOOKING_CHECKIN", "BOOKING_CHECKOUT", "BOOKING_EXPIRED", "REVIEW_RECEIVED",
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
}, (table) => [
  index("notifications_user_id_idx").on(table.userId),
]);

// ── Messages ───────────────────────────────────────────

export const messages = pgTable("messages", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  conversationId: varchar("conversation_id", { length: 36 }).notNull(), // = users.id
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
}, (table) => [
  index("subscriptions_user_id_idx").on(table.userId),
]);

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
}, (table) => [
  index("invoices_user_id_idx").on(table.userId),
  index("invoices_subscription_id_idx").on(table.subscriptionId),
]);

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
export const stExpenseCategoryEnum = pgEnum("st_expense_category", [
  "maintenance", "renovation", "furnishing", "insurance", "service_charge",
  "utility", "management_fee", "legal", "government_fee", "commission", "other",
  "booking_income", "cleaning_fee_income", "security_deposit_received",
  "security_deposit_returned", "damage_charge", "pm_commission", "po_payout",
]);
export const stActivityActionEnum = pgEnum("st_activity_action", [
  "property_created", "property_updated", "property_activated", "property_deactivated",
  "status_changed", "photo_added", "photo_removed", "document_added", "document_removed",
  "expense_added", "expense_updated", "expense_deleted",
  "owner_assigned", "owner_removed", "agreement_confirmed",
  "acquisition_updated", "amenities_updated", "policies_updated",
  "pricing_updated", "description_updated", "details_updated",
  "booking_created", "booking_confirmed", "booking_declined", "booking_cancelled",
  "booking_checked_in", "booking_checked_out", "booking_completed", "booking_expired",
  "review_received", "deposit_returned", "deposit_deducted",
  "date_blocked", "date_unblocked", "payout_recorded",
]);

// ── Booking Enums ────────────────────────────────────

export const stBookingStatusEnum = pgEnum("st_booking_status", [
  "requested", "confirmed", "declined", "cancelled", "checked_in",
  "checked_out", "completed", "expired", "no_show",
]);
export const stBookingPaymentMethodEnum = pgEnum("st_booking_payment_method", ["card", "bank_transfer", "cash"]);
export const stBookingPaymentStatusEnum = pgEnum("st_booking_payment_status", ["pending", "paid", "partial", "refunded"]);
export const stBookingSourceEnum = pgEnum("st_booking_source", ["website", "airbnb", "booking_com", "walk_in", "other"]);
export const stSecurityDepositStatusEnum = pgEnum("st_security_deposit_status", ["pending", "received", "partially_returned", "returned", "forfeited"]);
export const stTransactionTypeEnum = pgEnum("st_transaction_type", ["income", "expense", "deposit", "refund", "commission", "payout"]);
export const stOwnerPayoutStatusEnum = pgEnum("st_owner_payout_status", ["pending", "paid"]);

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

  // Per-method payment config (JSON)
  paymentMethodConfig: text("payment_method_config"),

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
}, (table) => [
  index("st_property_photos_property_id_idx").on(table.propertyId),
]);

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

// ── ST Property Activity Log ─────────────────────────

export const stPropertyActivityLog = pgTable("st_property_activity_log", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  propertyId: varchar("property_id", { length: 36 })
    .notNull()
    .references(() => stProperties.id, { onDelete: "cascade" }),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => users.id),
  action: stActivityActionEnum("action").notNull(),
  description: text("description").notNull(),
  metadata: text("metadata"), // JSON string for extra context (old/new values, amounts, etc.)
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── ST Property Expenses ─────────────────────────────

export const stPropertyExpenses = pgTable("st_property_expenses", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  propertyId: varchar("property_id", { length: 36 })
    .notNull()
    .references(() => stProperties.id, { onDelete: "cascade" }),
  category: stExpenseCategoryEnum("category").notNull(),
  description: text("description"),
  amount: text("amount").notNull(),
  expenseDate: date("expense_date").notNull(),
  receiptUrl: text("receipt_url"),
  createdByUserId: varchar("created_by_user_id", { length: 36 })
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── ST Bookings ─────────────────────────────────────

export const stBookings = pgTable("st_bookings", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  propertyId: varchar("property_id", { length: 36 })
    .notNull()
    .references(() => stProperties.id, { onDelete: "cascade" }),
  guestUserId: varchar("guest_user_id", { length: 36 })
    .references(() => users.id),
  pmUserId: varchar("pm_user_id", { length: 36 })
    .notNull()
    .references(() => users.id),
  source: stBookingSourceEnum("source").default("website"),
  status: stBookingStatusEnum("status").default("requested"),

  // Dates & guests
  checkInDate: date("check_in_date").notNull(),
  checkOutDate: date("check_out_date").notNull(),
  numberOfGuests: integer("number_of_guests").notNull(),
  totalNights: integer("total_nights").notNull(),
  weekdayNights: integer("weekday_nights"),
  weekendNights: integer("weekend_nights"),

  // Pricing snapshot (frozen at booking time)
  nightlyRate: text("nightly_rate"),
  weekendRate: text("weekend_rate"),
  cleaningFee: text("cleaning_fee"),
  tourismTax: text("tourism_tax"),
  vat: text("vat"),
  subtotal: text("subtotal").notNull(),
  totalAmount: text("total_amount").notNull(),
  securityDepositAmount: text("security_deposit_amount"),

  // Payment
  paymentMethod: stBookingPaymentMethodEnum("payment_method"),
  paymentStatus: stBookingPaymentStatusEnum("payment_status").default("pending"),
  cancellationPolicy: stCancellationPolicyEnum("cancellation_policy"),

  // PM-PO financial snapshots
  commissionType: stCommissionTypeEnum("commission_type"),
  commissionValue: text("commission_value"),
  commissionAmount: text("commission_amount"),
  bankAccountBelongsTo: stBankAccountBelongsToEnum("bank_account_belongs_to"),
  ownerPayoutAmount: text("owner_payout_amount"),
  ownerPayoutStatus: stOwnerPayoutStatusEnum("owner_payout_status").default("pending"),
  ownerPayoutDate: timestamp("owner_payout_date"),

  // Guest details
  specialRequests: text("special_requests"),
  pmNotes: text("pm_notes"),

  // Lifecycle timestamps
  expiresAt: timestamp("expires_at"),
  confirmedAt: timestamp("confirmed_at"),
  declinedAt: timestamp("declined_at"),
  declineReason: text("decline_reason"),
  cancelledAt: timestamp("cancelled_at"),
  cancelledBy: varchar("cancelled_by", { length: 36 })
    .references(() => users.id),
  cancellationReason: text("cancellation_reason"),
  refundAmount: text("refund_amount"),

  // Check-in
  checkedInAt: timestamp("checked_in_at"),
  checkedInBy: varchar("checked_in_by", { length: 36 })
    .references(() => users.id),
  checkInNotes: text("check_in_notes"),
  accessPin: text("access_pin"),

  // Check-out
  checkedOutAt: timestamp("checked_out_at"),
  checkedOutBy: varchar("checked_out_by", { length: 36 })
    .references(() => users.id),
  checkOutNotes: text("check_out_notes"),
  completedAt: timestamp("completed_at"),

  // Manual/external bookings
  externalBookingRef: text("external_booking_ref"),
  guestName: text("guest_name"),
  guestEmail: text("guest_email"),
  guestPhone: text("guest_phone"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("st_bookings_property_id_idx").on(table.propertyId),
  index("st_bookings_guest_user_id_idx").on(table.guestUserId),
]);

// ── ST Booking Transactions ─────────────────────────

export const stBookingTransactions = pgTable("st_booking_transactions", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  bookingId: varchar("booking_id", { length: 36 })
    .notNull()
    .references(() => stBookings.id, { onDelete: "cascade" }),
  propertyId: varchar("property_id", { length: 36 })
    .notNull()
    .references(() => stProperties.id, { onDelete: "cascade" }),
  transactionType: stTransactionTypeEnum("transaction_type").notNull(),
  category: text("category").notNull(),
  amount: text("amount").notNull(),
  direction: text("direction").notNull(), // "in" or "out"
  heldBy: text("held_by").notNull(), // "pm" or "po"
  owedTo: text("owed_to"), // "pm", "po", "guest", or null
  description: text("description"),
  recordedAt: timestamp("recorded_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── PM-PO Settlements ───────────────────────────────

export const pmPoSettlements = pgTable("pm_po_settlements", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  bookingId: varchar("booking_id", { length: 36 }).references(() => stBookings.id, { onDelete: "cascade" }),
  expenseId: varchar("expense_id", { length: 36 }),
  propertyId: varchar("property_id", { length: 36 }).notNull().references(() => stProperties.id, { onDelete: "cascade" }),
  fromUserId: varchar("from_user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  toUserId: varchar("to_user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  amount: text("amount").notNull(),
  reason: text("reason").notNull(),
  paymentMethodUsed: text("payment_method_used"),
  collectedBy: text("collected_by"),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  paidAt: timestamp("paid_at"),
  confirmedAt: timestamp("confirmed_at"),
  proofUrl: text("proof_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("pm_po_settlements_booking_id_idx").on(table.bookingId),
  index("pm_po_settlements_from_idx").on(table.fromUserId),
  index("pm_po_settlements_to_idx").on(table.toUserId),
]);

export type PmPoSettlement = typeof pmPoSettlements.$inferSelect;
export type InsertPmPoSettlement = typeof pmPoSettlements.$inferInsert;

// ── ST Blocked Dates ────────────────────────────────

export const stBlockedDates = pgTable("st_blocked_dates", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  propertyId: varchar("property_id", { length: 36 })
    .notNull()
    .references(() => stProperties.id, { onDelete: "cascade" }),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  reason: text("reason"),
  blockedBy: varchar("blocked_by", { length: 36 })
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── ST Security Deposits ────────────────────────────

export const stSecurityDeposits = pgTable("st_security_deposits", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  bookingId: varchar("booking_id", { length: 36 })
    .notNull()
    .unique()
    .references(() => stBookings.id, { onDelete: "cascade" }),
  amount: text("amount").notNull(),
  status: stSecurityDepositStatusEnum("status").default("pending"),
  receivedAt: timestamp("received_at"),
  returnedAmount: text("returned_amount"),
  returnedAt: timestamp("returned_at"),
  deductions: text("deductions"), // JSON: [{reason: string, amount: string}]
  processedBy: varchar("processed_by", { length: 36 })
    .references(() => users.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── ST Checkout Records ─────────────────────────────

export const stCheckoutRecords = pgTable("st_checkout_records", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  bookingId: varchar("booking_id", { length: 36 })
    .notNull()
    .unique()
    .references(() => stBookings.id, { onDelete: "cascade" }),
  checklistItems: text("checklist_items"), // JSON: [{item: string, checked: boolean}]
  photos: text("photos"), // JSON array of URLs
  damageAssessment: text("damage_assessment"), // JSON: {hasDamage, description, estimatedCost}
  notes: text("notes"),
  completedBy: varchar("completed_by", { length: 36 })
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── ST Reviews ──────────────────────────────────────

export const stReviews = pgTable("st_reviews", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  bookingId: varchar("booking_id", { length: 36 })
    .notNull()
    .unique()
    .references(() => stBookings.id, { onDelete: "cascade" }),
  propertyId: varchar("property_id", { length: 36 })
    .notNull()
    .references(() => stProperties.id, { onDelete: "cascade" }),
  guestUserId: varchar("guest_user_id", { length: 36 })
    .notNull()
    .references(() => users.id),
  rating: integer("rating").notNull(),
  title: text("title"),
  description: text("description"),
  pmResponse: text("pm_response"),
  pmRespondedAt: timestamp("pm_responded_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── PM Settings ─────────────────────────────────────

export const pmSettings = pgTable("pm_settings", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  pmUserId: varchar("pm_user_id", { length: 36 })
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  tourismTaxPercent: text("tourism_tax_percent").default("0"),
  vatPercent: text("vat_percent").default("0"),
  defaultCheckInTime: text("default_check_in_time").default("15:00"),
  defaultCheckOutTime: text("default_check_out_time").default("12:00"),
  defaultCancellationPolicy: stCancellationPolicyEnum("default_cancellation_policy"),
  businessName: text("business_name"),
  businessLicense: text("business_license"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── Site Settings (admin-managed key/value config) ────

export const siteSettings = pgTable("site_settings", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── Zod Schemas ────────────────────────────────────────

export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);

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
  phone: z.string()
    .min(8, "Phone number is required")
    .max(20, "Phone number is too long")
    .regex(/^\+\d{7,15}$/, "Phone must start with + followed by 7-15 digits"),
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
  // Optional fields — passport, trade license, company
  passportNumber: z.string().optional().nullable(),
  passportExpiry: z.string().optional().nullable(),
  passportFrontUrl: z.string().optional().nullable(),
  tradeLicenseExpiry: z.string().optional().nullable(),
  tradeLicenseUrl: z.string().optional().nullable(),
  companyName: z.string().optional().nullable(),
  companyWebsite: z.string().optional().nullable(),
  companyDescription: z.string().optional().nullable(),
  companyAddress: z.string().optional().nullable(),
});

export const loginSchema = z.object({
  email: z.string().email().transform(s => s.toLowerCase().trim()),
  password: z.string().min(1, "Password is required"),
  role: z.enum(["SUPER_ADMIN", "GUEST", "PROPERTY_MANAGER", "PROPERTY_OWNER", "TENANT", "PM_TEAM_MEMBER"]),
});

// ── Types ──────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
// Backward compat aliases — profile fields are now on User
export type UserProfile = User;
export type InsertUserProfile = InsertUser;
export type Guest = User;
export type InsertGuest = InsertUser;
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
export type StPropertyExpense = typeof stPropertyExpenses.$inferSelect;
export type StPropertyActivity = typeof stPropertyActivityLog.$inferSelect;
export type InsertStPropertyExpense = typeof stPropertyExpenses.$inferInsert;

// Booking types
export type StBooking = typeof stBookings.$inferSelect;
export type InsertStBooking = typeof stBookings.$inferInsert;
export type StBookingTransaction = typeof stBookingTransactions.$inferSelect;
export type InsertStBookingTransaction = typeof stBookingTransactions.$inferInsert;
export type StBlockedDate = typeof stBlockedDates.$inferSelect;
export type InsertStBlockedDate = typeof stBlockedDates.$inferInsert;
export type StSecurityDeposit = typeof stSecurityDeposits.$inferSelect;
export type InsertStSecurityDeposit = typeof stSecurityDeposits.$inferInsert;
export type StCheckoutRecord = typeof stCheckoutRecords.$inferSelect;
export type InsertStCheckoutRecord = typeof stCheckoutRecords.$inferInsert;
export type StReview = typeof stReviews.$inferSelect;
export type InsertStReview = typeof stReviews.$inferInsert;
export type PmSetting = typeof pmSettings.$inferSelect;
export type InsertPmSetting = typeof pmSettings.$inferInsert;

// ── Message Templates ────────────────────────────────

export const messageTriggerEnum = pgEnum("message_trigger", [
  "manual",
  "booking_confirmed",
  "check_in_day",
  "day_before_checkout",
  "post_checkout",
]);

export const messageTemplates = pgTable("message_templates", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  pmUserId: varchar("pm_user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  subject: text("subject"),
  body: text("body").notNull(),
  trigger: messageTriggerEnum("trigger").default("manual"),
  triggerDelayHours: integer("trigger_delay_hours").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("message_templates_pm_user_id_idx").on(table.pmUserId),
]);

export type MessageTemplate = typeof messageTemplates.$inferSelect;
export type InsertMessageTemplate = typeof messageTemplates.$inferInsert;

// Tracks which templates have already been sent for a booking+trigger, preventing duplicates
export const messageTemplateSends = pgTable("message_template_sends", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  templateId: varchar("template_id", { length: 36 }).notNull().references(() => messageTemplates.id, { onDelete: "cascade" }),
  bookingId: varchar("booking_id", { length: 36 }).notNull(),
  trigger: messageTriggerEnum("trigger").notNull(),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
}, (table) => [
  index("mts_template_booking_idx").on(table.templateId, table.bookingId),
]);

export type MessageTemplateSend = typeof messageTemplateSends.$inferSelect;

// ── PM Roles & Team Members ─────────────────────────

export const PM_PERMISSIONS = [
  "properties.view", "properties.create", "properties.edit", "properties.delete",
  "bookings.view", "bookings.manage",
  "owners.view", "owners.manage",
  "tenants.view", "tenants.manage",
  "financials.view", "financials.manage",
  "documents.view", "documents.manage",
  "cleaners.manage",
  "team.manage",
  "billing.view", "billing.manage",
] as const;

export const PM_PERMISSION_LABELS: Record<string, string> = {
  "properties.view": "View Properties",
  "properties.create": "Create Properties",
  "properties.edit": "Edit Properties",
  "properties.delete": "Delete Properties",
  "bookings.view": "View Bookings",
  "bookings.manage": "Manage Bookings",
  "owners.view": "View Owner Info",
  "owners.manage": "Manage Owners",
  "tenants.view": "View Tenant Info",
  "tenants.manage": "Manage Tenants",
  "financials.view": "View Financials",
  "financials.manage": "Manage Financials",
  "documents.view": "View Documents",
  "documents.manage": "Manage Documents",
  "cleaners.manage": "Manage Cleaners",
  "team.manage": "Manage Team",
  "billing.view": "View Billing",
  "billing.manage": "Manage Billing",
};

export const pmRoles = pgTable("pm_roles", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  pmUserId: varchar("pm_user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  permissions: text("permissions").notNull().default("[]"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const pmTeamMembers = pgTable("pm_team_members", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  pmUserId: varchar("pm_user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  roleId: varchar("role_id", { length: 36 })
    .references(() => pmRoles.id, { onDelete: "set null" }),
  fullName: text("full_name"),
  status: text("status").notNull().default("invited"),
  invitedAt: timestamp("invited_at").notNull().defaultNow(),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
