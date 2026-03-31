--
-- PostgreSQL database dump
--

\restrict kYbV8CpMOPvz6l4NI5DwrcVmunRShArCIfij4ay2hCtPd6ov6S7I9fDJhduLYSm

-- Dumped from database version 15.14 (Homebrew)
-- Dumped by pg_dump version 15.14 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: audit_action; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.audit_action AS ENUM (
    'ACCOUNT_CREATED',
    'LOGIN',
    'LOGOUT',
    'PROFILE_UPDATED',
    'PASSWORD_CHANGED',
    'KYC_SUBMITTED',
    'KYC_VERIFIED',
    'KYC_REJECTED',
    'STATUS_CHANGED',
    'SETTINGS_UPDATED',
    'LINK_INVITE_SENT',
    'LINK_INVITE_RECEIVED',
    'LINK_ACCEPTED',
    'LINK_REJECTED',
    'LINK_REMOVED'
);


--
-- Name: billing_cycle; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.billing_cycle AS ENUM (
    'monthly',
    'yearly',
    'one_time',
    'custom'
);


--
-- Name: feature_key; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.feature_key AS ENUM (
    'max_linked_owners',
    'max_linked_tenants',
    'dm_messaging',
    'document_viewing'
);


--
-- Name: invoice_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.invoice_status AS ENUM (
    'paid',
    'pending',
    'failed',
    'refunded'
);


--
-- Name: kyc_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.kyc_status AS ENUM (
    'pending',
    'verified',
    'rejected'
);


--
-- Name: limit_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.limit_type AS ENUM (
    'boolean',
    'numeric'
);


--
-- Name: link_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.link_status AS ENUM (
    'pending',
    'accepted',
    'rejected'
);


--
-- Name: notification_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.notification_type AS ENUM (
    'LINK_INVITE',
    'LINK_ACCEPTED',
    'LINK_REJECTED',
    'LINK_REMOVED',
    'NEW_MESSAGE',
    'USER_SIGNUP',
    'KYC_SUBMISSION',
    'PLAN_ASSIGNED',
    'INVOICE_CREATED',
    'INVOICE_OVERDUE',
    'BOOKING_REQUESTED',
    'BOOKING_CONFIRMED',
    'BOOKING_DECLINED',
    'BOOKING_CANCELLED',
    'BOOKING_CHECKIN',
    'BOOKING_CHECKOUT',
    'BOOKING_EXPIRED',
    'REVIEW_RECEIVED'
);


--
-- Name: role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.role AS ENUM (
    'SUPER_ADMIN',
    'GUEST',
    'CLEANER',
    'PROPERTY_MANAGER',
    'PROPERTY_OWNER',
    'TENANT',
    'PM_TEAM_MEMBER'
);


--
-- Name: st_access_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.st_access_type AS ENUM (
    'traditional_key',
    'smart_lock'
);


--
-- Name: st_acquisition_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.st_acquisition_type AS ENUM (
    'cash',
    'rented',
    'financed',
    'off_plan'
);


--
-- Name: st_activity_action; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.st_activity_action AS ENUM (
    'property_created',
    'property_updated',
    'property_activated',
    'property_deactivated',
    'status_changed',
    'photo_added',
    'photo_removed',
    'document_added',
    'document_removed',
    'expense_added',
    'expense_updated',
    'expense_deleted',
    'owner_assigned',
    'owner_removed',
    'agreement_confirmed',
    'acquisition_updated',
    'amenities_updated',
    'policies_updated',
    'pricing_updated',
    'description_updated',
    'details_updated',
    'booking_created',
    'booking_confirmed',
    'booking_declined',
    'booking_cancelled',
    'booking_checked_in',
    'booking_checked_out',
    'booking_completed',
    'booking_expired',
    'review_received',
    'deposit_returned',
    'deposit_deducted',
    'date_blocked',
    'date_unblocked',
    'payout_recorded'
);


--
-- Name: st_bank_account_belongs_to; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.st_bank_account_belongs_to AS ENUM (
    'property_manager',
    'property_owner'
);


--
-- Name: st_bank_lender; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.st_bank_lender AS ENUM (
    'enbd',
    'adcb',
    'dib',
    'mashreq',
    'fab',
    'rak_bank',
    'other'
);


--
-- Name: st_booking_payment_method; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.st_booking_payment_method AS ENUM (
    'card',
    'bank_transfer',
    'cash'
);


--
-- Name: st_booking_payment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.st_booking_payment_status AS ENUM (
    'pending',
    'paid',
    'partial',
    'refunded'
);


--
-- Name: st_booking_source; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.st_booking_source AS ENUM (
    'website',
    'airbnb',
    'booking_com',
    'walk_in',
    'other'
);


--
-- Name: st_booking_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.st_booking_status AS ENUM (
    'requested',
    'confirmed',
    'declined',
    'cancelled',
    'checked_in',
    'checked_out',
    'completed',
    'expired',
    'no_show'
);


--
-- Name: st_cancellation_policy; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.st_cancellation_policy AS ENUM (
    'flexible',
    'moderate',
    'strict',
    'non_refundable'
);


--
-- Name: st_commission_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.st_commission_type AS ENUM (
    'fixed_monthly',
    'percentage_per_booking'
);


--
-- Name: st_document_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.st_document_type AS ENUM (
    'title_deed',
    'spa',
    'noc',
    'dtcm',
    'oqood',
    'tenancy_contract',
    'mortgage_agreement',
    'other'
);


--
-- Name: st_expense_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.st_expense_category AS ENUM (
    'maintenance',
    'renovation',
    'furnishing',
    'insurance',
    'service_charge',
    'utility',
    'management_fee',
    'legal',
    'government_fee',
    'commission',
    'other',
    'booking_income',
    'cleaning_fee_income',
    'security_deposit_received',
    'security_deposit_returned',
    'damage_charge',
    'pm_commission',
    'po_payout'
);


--
-- Name: st_handover_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.st_handover_status AS ENUM (
    'not_yet',
    'handed_over'
);


--
-- Name: st_internet_provider; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.st_internet_provider AS ENUM (
    'du',
    'etisalat',
    'other'
);


--
-- Name: st_owner_payout_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.st_owner_payout_status AS ENUM (
    'pending',
    'paid'
);


--
-- Name: st_parking_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.st_parking_type AS ENUM (
    'covered',
    'basement',
    'street'
);


--
-- Name: st_payment_schedule_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.st_payment_schedule_status AS ENUM (
    'unpaid',
    'paid',
    'overdue'
);


--
-- Name: st_payment_schedule_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.st_payment_schedule_type AS ENUM (
    'rental',
    'mortgage',
    'off_plan'
);


--
-- Name: st_property_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.st_property_status AS ENUM (
    'draft',
    'active',
    'inactive'
);


--
-- Name: st_property_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.st_property_type AS ENUM (
    'apartment',
    'villa',
    'office'
);


--
-- Name: st_security_deposit_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.st_security_deposit_status AS ENUM (
    'pending',
    'received',
    'partially_returned',
    'returned',
    'forfeited'
);


--
-- Name: st_transaction_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.st_transaction_type AS ENUM (
    'income',
    'expense',
    'deposit',
    'refund',
    'commission',
    'payout'
);


--
-- Name: st_uae_city; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.st_uae_city AS ENUM (
    'dubai',
    'abu_dhabi',
    'sharjah',
    'ajman',
    'ras_al_khaimah',
    'fujairah',
    'umm_al_quwain'
);


--
-- Name: st_view_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.st_view_type AS ENUM (
    'sea_view',
    'garden_view',
    'city_view',
    'pool_view',
    'no_view'
);


--
-- Name: subscription_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.subscription_status AS ENUM (
    'active',
    'trial',
    'expired',
    'cancelled',
    'pending_payment',
    'billing_suspended'
);


--
-- Name: user_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_status AS ENUM (
    'active',
    'suspended'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: areas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.areas (
    id character varying(36) DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    city public.st_uae_city NOT NULL,
    latitude text,
    longitude text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: cleaning_automation_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cleaning_automation_rules (
    id character varying(36) DEFAULT (gen_random_uuid())::text NOT NULL,
    property_id character varying(36) NOT NULL,
    pm_user_id character varying(36) NOT NULL,
    checklist_id character varying(36) NOT NULL,
    delay_minutes integer DEFAULT 30 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: cleaning_checklist_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cleaning_checklist_items (
    id character varying(36) DEFAULT (gen_random_uuid())::text NOT NULL,
    checklist_id character varying(36) NOT NULL,
    label text NOT NULL,
    display_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: cleaning_checklists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cleaning_checklists (
    id character varying(36) DEFAULT (gen_random_uuid())::text NOT NULL,
    property_id character varying(36),
    pm_user_id character varying(36) NOT NULL,
    name text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: cleaning_task_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cleaning_task_items (
    id character varying(36) DEFAULT (gen_random_uuid())::text NOT NULL,
    task_id character varying(36) NOT NULL,
    label text NOT NULL,
    is_checked boolean DEFAULT false NOT NULL,
    notes text,
    image_url text,
    checked_at timestamp without time zone,
    display_order integer DEFAULT 0
);


--
-- Name: cleaning_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cleaning_tasks (
    id character varying(36) DEFAULT (gen_random_uuid())::text NOT NULL,
    property_id character varying(36) NOT NULL,
    pm_user_id character varying(36) NOT NULL,
    cleaner_user_id character varying(36),
    checklist_id character varying(36),
    booking_id character varying(36),
    status text DEFAULT 'pending'::text NOT NULL,
    priority text DEFAULT 'normal'::text,
    title text NOT NULL,
    notes text,
    due_at timestamp without time zone,
    started_at timestamp without time zone,
    completed_at timestamp without time zone,
    created_by character varying(36),
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: document_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_types (
    id character varying(36) NOT NULL,
    slug text NOT NULL,
    label text NOT NULL,
    has_expiry boolean DEFAULT true NOT NULL,
    applicable_roles text[],
    required_for_roles text[],
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: guests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.guests (
    id character varying(36) NOT NULL,
    user_id character varying(36) NOT NULL,
    full_name text NOT NULL,
    dob date NOT NULL,
    nationality text NOT NULL,
    country_of_residence text NOT NULL,
    resident_address text NOT NULL,
    emirates_id_number text NOT NULL,
    emirates_id_expiry date NOT NULL,
    emirates_id_front_url text,
    emirates_id_back_url text,
    kyc_status public.kyc_status DEFAULT 'pending'::public.kyc_status NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    passport_number text,
    passport_expiry date,
    passport_front_url text,
    trade_license_expiry date,
    trade_license_url text,
    company_name text,
    company_website text,
    company_description text,
    company_address text
);


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoices (
    id character varying(36) DEFAULT (gen_random_uuid())::text NOT NULL,
    subscription_id character varying(36) NOT NULL,
    user_id character varying(36) NOT NULL,
    plan_id character varying(36) NOT NULL,
    amount text NOT NULL,
    invoice_status public.invoice_status DEFAULT 'pending'::public.invoice_status NOT NULL,
    billing_period_start timestamp without time zone NOT NULL,
    billing_period_end timestamp without time zone NOT NULL,
    paid_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    due_date timestamp without time zone
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id character varying(36) NOT NULL,
    conversation_id character varying(36) NOT NULL,
    sender_id character varying(36) NOT NULL,
    sender_role character varying(20) NOT NULL,
    content text NOT NULL,
    read_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id character varying(36) NOT NULL,
    user_id character varying(36) NOT NULL,
    type public.notification_type NOT NULL,
    title text NOT NULL,
    body text,
    link_url text,
    related_id character varying(36),
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: otp_verifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.otp_verifications (
    id character varying(36) NOT NULL,
    phone text NOT NULL,
    code text NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    verified_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: payment_methods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_methods (
    id character varying(36) NOT NULL,
    user_id character varying(36) NOT NULL,
    card_brand text NOT NULL,
    card_last4 character varying(4) NOT NULL,
    card_holder_name text NOT NULL,
    expiry_month integer,
    expiry_year integer,
    is_default boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: plan_features; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plan_features (
    id character varying(36) DEFAULT (gen_random_uuid())::text NOT NULL,
    plan_id character varying(36) NOT NULL,
    feature_key public.feature_key NOT NULL,
    limit_type public.limit_type NOT NULL,
    boolean_value boolean,
    numeric_min integer,
    numeric_max integer
);


--
-- Name: plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plans (
    id character varying(36) DEFAULT (gen_random_uuid())::text NOT NULL,
    name text NOT NULL,
    description text,
    price text DEFAULT '0'::text NOT NULL,
    billing_cycle public.billing_cycle DEFAULT 'monthly'::public.billing_cycle NOT NULL,
    trial_days integer DEFAULT 7 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    custom_cycle_days integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: pm_po_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pm_po_links (
    id character varying(36) NOT NULL,
    pm_user_id character varying(36) NOT NULL,
    target_user_id character varying(36) NOT NULL,
    target_role character varying(20) NOT NULL,
    status public.link_status DEFAULT 'pending'::public.link_status NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: pm_po_settlements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pm_po_settlements (
    id character varying(36) DEFAULT (gen_random_uuid())::text NOT NULL,
    booking_id character varying(36),
    property_id character varying(36) NOT NULL,
    from_user_id character varying(36) NOT NULL,
    to_user_id character varying(36) NOT NULL,
    amount text NOT NULL,
    reason text NOT NULL,
    payment_method_used text,
    collected_by text,
    status text DEFAULT 'pending'::text NOT NULL,
    notes text,
    paid_at timestamp without time zone,
    confirmed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    proof_url text,
    expense_id character varying(36)
);


--
-- Name: pm_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pm_roles (
    id character varying(36) DEFAULT (gen_random_uuid())::text NOT NULL,
    pm_user_id character varying(36) NOT NULL,
    name text NOT NULL,
    description text,
    permissions text DEFAULT '[]'::text NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: pm_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pm_settings (
    id character varying(36) NOT NULL,
    pm_user_id character varying(36) NOT NULL,
    tourism_tax_percent text DEFAULT '0'::text,
    vat_percent text DEFAULT '0'::text,
    default_check_in_time text DEFAULT '15:00'::text,
    default_check_out_time text DEFAULT '12:00'::text,
    default_cancellation_policy public.st_cancellation_policy,
    business_name text,
    business_license text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: pm_team_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pm_team_members (
    id character varying(36) DEFAULT (gen_random_uuid())::text NOT NULL,
    pm_user_id character varying(36) NOT NULL,
    user_id character varying(36) NOT NULL,
    role_id character varying(36),
    status text DEFAULT 'invited'::text NOT NULL,
    invited_at timestamp without time zone DEFAULT now() NOT NULL,
    accepted_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    full_name text
);


--
-- Name: session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session (
    sid character varying NOT NULL,
    sess json NOT NULL,
    expire timestamp(6) without time zone NOT NULL
);


--
-- Name: st_acquisition_details; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.st_acquisition_details (
    id character varying(36) DEFAULT gen_random_uuid() NOT NULL,
    property_id character varying(36) NOT NULL,
    purchase_price text,
    purchase_date date,
    down_payment text,
    annual_rent text,
    num_cheques integer,
    payment_method text,
    tenancy_start date,
    tenancy_end date,
    security_deposit_paid text,
    bank_lender public.st_bank_lender,
    loan_amount text,
    interest_rate text,
    loan_term_years integer,
    monthly_emi text,
    mortgage_start date,
    mortgage_end date,
    expected_handover date,
    handover_status public.st_handover_status,
    dewa_no text,
    internet_provider public.st_internet_provider,
    internet_account_no text,
    gas_no text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: st_blocked_dates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.st_blocked_dates (
    id character varying(36) NOT NULL,
    property_id character varying(36) NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    reason text,
    blocked_by character varying(36) NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: st_booking_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.st_booking_transactions (
    id character varying(36) NOT NULL,
    booking_id character varying(36) NOT NULL,
    property_id character varying(36) NOT NULL,
    transaction_type public.st_transaction_type NOT NULL,
    category text NOT NULL,
    amount text NOT NULL,
    direction text NOT NULL,
    held_by text NOT NULL,
    owed_to text,
    description text,
    recorded_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: st_bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.st_bookings (
    id character varying(36) NOT NULL,
    property_id character varying(36) NOT NULL,
    guest_user_id character varying(36),
    pm_user_id character varying(36) NOT NULL,
    source public.st_booking_source DEFAULT 'website'::public.st_booking_source,
    status public.st_booking_status DEFAULT 'requested'::public.st_booking_status,
    check_in_date date NOT NULL,
    check_out_date date NOT NULL,
    number_of_guests integer NOT NULL,
    total_nights integer NOT NULL,
    weekday_nights integer,
    weekend_nights integer,
    nightly_rate text,
    weekend_rate text,
    cleaning_fee text,
    tourism_tax text,
    vat text,
    subtotal text NOT NULL,
    total_amount text NOT NULL,
    security_deposit_amount text,
    payment_method public.st_booking_payment_method,
    payment_status public.st_booking_payment_status DEFAULT 'pending'::public.st_booking_payment_status,
    cancellation_policy public.st_cancellation_policy,
    commission_type public.st_commission_type,
    commission_value text,
    commission_amount text,
    bank_account_belongs_to public.st_bank_account_belongs_to,
    owner_payout_amount text,
    owner_payout_status public.st_owner_payout_status DEFAULT 'pending'::public.st_owner_payout_status,
    owner_payout_date timestamp without time zone,
    special_requests text,
    pm_notes text,
    expires_at timestamp without time zone,
    confirmed_at timestamp without time zone,
    declined_at timestamp without time zone,
    decline_reason text,
    cancelled_at timestamp without time zone,
    cancelled_by character varying(36),
    cancellation_reason text,
    refund_amount text,
    checked_in_at timestamp without time zone,
    checked_in_by character varying(36),
    check_in_notes text,
    access_pin text,
    checked_out_at timestamp without time zone,
    checked_out_by character varying(36),
    check_out_notes text,
    completed_at timestamp without time zone,
    external_booking_ref text,
    guest_name text,
    guest_email text,
    guest_phone text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    cash_collected_by_user_id character varying(36)
);


--
-- Name: st_checkout_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.st_checkout_records (
    id character varying(36) NOT NULL,
    booking_id character varying(36) NOT NULL,
    checklist_items text,
    photos text,
    damage_assessment text,
    notes text,
    completed_by character varying(36) NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: st_payment_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.st_payment_schedules (
    id character varying(36) DEFAULT gen_random_uuid() NOT NULL,
    property_id character varying(36) NOT NULL,
    schedule_type public.st_payment_schedule_type NOT NULL,
    milestone_name text,
    amount text NOT NULL,
    due_date date,
    status public.st_payment_schedule_status DEFAULT 'unpaid'::public.st_payment_schedule_status,
    paid_date date,
    display_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: st_properties; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.st_properties (
    id character varying(36) DEFAULT gen_random_uuid() NOT NULL,
    pm_user_id character varying(36) NOT NULL,
    status public.st_property_status DEFAULT 'draft'::public.st_property_status NOT NULL,
    property_type public.st_property_type,
    unit_number text,
    floor_number integer,
    building_name text,
    area_sqft integer,
    bedrooms integer DEFAULT 0,
    bathrooms integer DEFAULT 0,
    max_guests integer DEFAULT 1,
    maid_room boolean DEFAULT false,
    furnished boolean DEFAULT false,
    ceiling_height integer,
    view_type public.st_view_type,
    smart_home boolean DEFAULT false,
    address_line_1 text,
    address_line_2 text,
    city public.st_uae_city,
    zip_code text,
    latitude text,
    longitude text,
    area_id character varying(36),
    parking_spaces integer DEFAULT 0,
    parking_type public.st_parking_type,
    access_type public.st_access_type DEFAULT 'traditional_key'::public.st_access_type,
    lock_device_id text,
    public_name text,
    short_description text,
    long_description text,
    internal_notes text,
    nightly_rate text,
    weekend_rate text,
    minimum_stay integer DEFAULT 1,
    cleaning_fee text,
    security_deposit_required boolean DEFAULT false,
    security_deposit_amount text,
    accepted_payment_methods text,
    bank_account_belongs_to public.st_bank_account_belongs_to,
    bank_name text,
    account_holder_name text,
    account_number text,
    iban text,
    swift_code text,
    check_in_time text DEFAULT '15:00'::text,
    check_out_time text DEFAULT '12:00'::text,
    cancellation_policy public.st_cancellation_policy,
    po_user_id character varying(36),
    commission_type public.st_commission_type,
    commission_value text,
    acquisition_type public.st_acquisition_type,
    confirmed boolean DEFAULT false,
    wizard_step integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    payment_method_config text
);


--
-- Name: st_property_activity_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.st_property_activity_log (
    id character varying(36) NOT NULL,
    property_id character varying(36) NOT NULL,
    user_id character varying(36) NOT NULL,
    action public.st_activity_action NOT NULL,
    description text NOT NULL,
    metadata text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: st_property_amenities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.st_property_amenities (
    id character varying(36) DEFAULT gen_random_uuid() NOT NULL,
    property_id character varying(36) NOT NULL,
    amenity_key text NOT NULL
);


--
-- Name: st_property_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.st_property_documents (
    id character varying(36) DEFAULT gen_random_uuid() NOT NULL,
    property_id character varying(36) NOT NULL,
    document_type public.st_document_type NOT NULL,
    name text,
    description text,
    file_url text,
    has_expiry boolean DEFAULT false,
    expiry_date date,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: st_property_expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.st_property_expenses (
    id character varying(36) NOT NULL,
    property_id character varying(36) NOT NULL,
    category public.st_expense_category NOT NULL,
    description text,
    amount text NOT NULL,
    expense_date date NOT NULL,
    receipt_url text,
    created_by_user_id character varying(36) NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    bill_image_url text,
    payment_status text DEFAULT 'unpaid'::text,
    paid_date date,
    payment_proof_url text,
    responsible_party text,
    paid_by text,
    notes text
);


--
-- Name: st_property_inventory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.st_property_inventory (
    id character varying(36) DEFAULT (gen_random_uuid())::text NOT NULL,
    property_id character varying(36) NOT NULL,
    name text NOT NULL,
    category text NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    unit_cost text DEFAULT '0'::text NOT NULL,
    condition text DEFAULT 'new'::text NOT NULL,
    purchase_date date,
    location text,
    notes text,
    created_by character varying(36),
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: st_property_photos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.st_property_photos (
    id character varying(36) DEFAULT gen_random_uuid() NOT NULL,
    property_id character varying(36) NOT NULL,
    url text NOT NULL,
    display_order integer DEFAULT 0,
    is_cover boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: st_property_policies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.st_property_policies (
    id character varying(36) DEFAULT gen_random_uuid() NOT NULL,
    property_id character varying(36) NOT NULL,
    name text NOT NULL,
    description text,
    display_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: st_property_pricing; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.st_property_pricing (
    id character varying(36) DEFAULT (gen_random_uuid())::text NOT NULL,
    property_id character varying(36) NOT NULL,
    date date NOT NULL,
    price text NOT NULL,
    min_stay integer,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: st_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.st_reviews (
    id character varying(36) NOT NULL,
    booking_id character varying(36) NOT NULL,
    property_id character varying(36) NOT NULL,
    guest_user_id character varying(36) NOT NULL,
    rating integer NOT NULL,
    title text,
    description text,
    pm_response text,
    pm_responded_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT st_reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


--
-- Name: st_security_deposits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.st_security_deposits (
    id character varying(36) NOT NULL,
    booking_id character varying(36) NOT NULL,
    amount text NOT NULL,
    status public.st_security_deposit_status DEFAULT 'pending'::public.st_security_deposit_status,
    received_at timestamp without time zone,
    returned_amount text,
    returned_at timestamp without time zone,
    deductions text,
    processed_by character varying(36),
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions (
    id character varying(36) DEFAULT (gen_random_uuid())::text NOT NULL,
    user_id character varying(36) NOT NULL,
    plan_id character varying(36) NOT NULL,
    status public.subscription_status DEFAULT 'active'::public.subscription_status NOT NULL,
    trial_ends_at timestamp without time zone,
    current_period_start timestamp without time zone DEFAULT now() NOT NULL,
    current_period_end timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: user_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_audit_log (
    id character varying(36) NOT NULL,
    user_id character varying(36) NOT NULL,
    action public.audit_action NOT NULL,
    details text,
    metadata text,
    ip_address text,
    user_agent text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: user_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_documents (
    id character varying(36) NOT NULL,
    user_id character varying(36) NOT NULL,
    document_type_id character varying(36) NOT NULL,
    file_url text,
    document_number text,
    expiry_date timestamp without time zone,
    metadata text,
    uploaded_at timestamp without time zone DEFAULT now(),
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id character varying(36) NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    role public.role NOT NULL,
    phone text,
    status public.user_status DEFAULT 'active'::public.user_status NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: areas areas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.areas
    ADD CONSTRAINT areas_pkey PRIMARY KEY (id);


--
-- Name: cleaning_automation_rules cleaning_automation_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cleaning_automation_rules
    ADD CONSTRAINT cleaning_automation_rules_pkey PRIMARY KEY (id);


--
-- Name: cleaning_checklist_items cleaning_checklist_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cleaning_checklist_items
    ADD CONSTRAINT cleaning_checklist_items_pkey PRIMARY KEY (id);


--
-- Name: cleaning_checklists cleaning_checklists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cleaning_checklists
    ADD CONSTRAINT cleaning_checklists_pkey PRIMARY KEY (id);


--
-- Name: cleaning_task_items cleaning_task_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cleaning_task_items
    ADD CONSTRAINT cleaning_task_items_pkey PRIMARY KEY (id);


--
-- Name: cleaning_tasks cleaning_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cleaning_tasks
    ADD CONSTRAINT cleaning_tasks_pkey PRIMARY KEY (id);


--
-- Name: document_types document_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_types
    ADD CONSTRAINT document_types_pkey PRIMARY KEY (id);


--
-- Name: document_types document_types_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_types
    ADD CONSTRAINT document_types_slug_key UNIQUE (slug);


--
-- Name: guests guests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guests
    ADD CONSTRAINT guests_pkey PRIMARY KEY (id);


--
-- Name: guests guests_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guests
    ADD CONSTRAINT guests_user_id_unique UNIQUE (user_id);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: otp_verifications otp_verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.otp_verifications
    ADD CONSTRAINT otp_verifications_pkey PRIMARY KEY (id);


--
-- Name: payment_methods payment_methods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT payment_methods_pkey PRIMARY KEY (id);


--
-- Name: plan_features plan_features_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_features
    ADD CONSTRAINT plan_features_pkey PRIMARY KEY (id);


--
-- Name: plans plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_pkey PRIMARY KEY (id);


--
-- Name: pm_po_links pm_po_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pm_po_links
    ADD CONSTRAINT pm_po_links_pkey PRIMARY KEY (id);


--
-- Name: pm_po_settlements pm_po_settlements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pm_po_settlements
    ADD CONSTRAINT pm_po_settlements_pkey PRIMARY KEY (id);


--
-- Name: pm_roles pm_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pm_roles
    ADD CONSTRAINT pm_roles_pkey PRIMARY KEY (id);


--
-- Name: pm_settings pm_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pm_settings
    ADD CONSTRAINT pm_settings_pkey PRIMARY KEY (id);


--
-- Name: pm_settings pm_settings_pm_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pm_settings
    ADD CONSTRAINT pm_settings_pm_user_id_key UNIQUE (pm_user_id);


--
-- Name: pm_team_members pm_team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pm_team_members
    ADD CONSTRAINT pm_team_members_pkey PRIMARY KEY (id);


--
-- Name: pm_team_members pm_team_members_pm_user_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pm_team_members
    ADD CONSTRAINT pm_team_members_pm_user_id_user_id_key UNIQUE (pm_user_id, user_id);


--
-- Name: session session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (sid);


--
-- Name: st_acquisition_details st_acquisition_details_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.st_acquisition_details
    ADD CONSTRAINT st_acquisition_details_pkey PRIMARY KEY (id);


--
-- Name: st_acquisition_details st_acquisition_details_property_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.st_acquisition_details
    ADD CONSTRAINT st_acquisition_details_property_id_key UNIQUE (property_id);


--
-- Name: st_blocked_dates st_blocked_dates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.st_blocked_dates
    ADD CONSTRAINT st_blocked_dates_pkey PRIMARY KEY (id);


--
-- Name: st_booking_transactions st_booking_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.st_booking_transactions
    ADD CONSTRAINT st_booking_transactions_pkey PRIMARY KEY (id);


--
-- Name: st_bookings st_bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.st_bookings
    ADD CONSTRAINT st_bookings_pkey PRIMARY KEY (id);


--
-- Name: st_checkout_records st_checkout_records_booking_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.st_checkout_records
    ADD CONSTRAINT st_checkout_records_booking_id_key UNIQUE (booking_id);


--
-- Name: st_checkout_records st_checkout_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.st_checkout_records
    ADD CONSTRAINT st_checkout_records_pkey PRIMARY KEY (id);


--
-- Name: st_payment_schedules st_payment_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.st_payment_schedules
    ADD CONSTRAINT st_payment_schedules_pkey PRIMARY KEY (id);


--
-- Name: st_properties st_properties_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.st_properties
    ADD CONSTRAINT st_properties_pkey PRIMARY KEY (id);


--
-- Name: st_property_activity_log st_property_activity_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.st_property_activity_log
    ADD CONSTRAINT st_property_activity_log_pkey PRIMARY KEY (id);


--
-- Name: st_property_amenities st_property_amenities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.st_property_amenities
    ADD CONSTRAINT st_property_amenities_pkey PRIMARY KEY (id);


--
-- Name: st_property_documents st_property_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.st_property_documents
    ADD CONSTRAINT st_property_documents_pkey PRIMARY KEY (id);


--
-- Name: st_property_expenses st_property_expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.st_property_expenses
    ADD CONSTRAINT st_property_expenses_pkey PRIMARY KEY (id);


--
-- Name: st_property_inventory st_property_inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.st_property_inventory
    ADD CONSTRAINT st_property_inventory_pkey PRIMARY KEY (id);


--
-- Name: st_property_photos st_property_photos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.st_property_photos
    ADD CONSTRAINT st_property_photos_pkey PRIMARY KEY (id);


--
-- Name: st_property_policies st_property_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.st_property_policies
    ADD CONSTRAINT st_property_policies_pkey PRIMARY KEY (id);


--
-- Name: st_property_pricing st_property_pricing_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.st_property_pricing
    ADD CONSTRAINT st_property_pricing_pkey PRIMARY KEY (id);


--
-- Name: st_property_pricing st_property_pricing_property_id_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.st_property_pricing
    ADD CONSTRAINT st_property_pricing_property_id_date_key UNIQUE (property_id, date);


--
-- Name: st_reviews st_reviews_booking_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.st_reviews
    ADD CONSTRAINT st_reviews_booking_id_key UNIQUE (booking_id);


--
-- Name: st_reviews st_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.st_reviews
    ADD CONSTRAINT st_reviews_pkey PRIMARY KEY (id);


--
-- Name: st_security_deposits st_security_deposits_booking_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.st_security_deposits
    ADD CONSTRAINT st_security_deposits_booking_id_key UNIQUE (booking_id);


--
-- Name: st_security_deposits st_security_deposits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.st_security_deposits
    ADD CONSTRAINT st_security_deposits_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: user_audit_log user_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_audit_log
    ADD CONSTRAINT user_audit_log_pkey PRIMARY KEY (id);


--
-- Name: user_documents user_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_documents
    ADD CONSTRAINT user_documents_pkey PRIMARY KEY (id);


--
-- Name: user_documents user_documents_user_id_document_type_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_documents
    ADD CONSTRAINT user_documents_user_id_document_type_id_key UNIQUE (user_id, document_type_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: IDX_session_expire; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_session_expire" ON public.session USING btree (expire);


--
-- Name: idx_blocked_dates_property; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blocked_dates_property ON public.st_blocked_dates USING btree (property_id, start_date, end_date);


--
-- Name: idx_booking_txns_booking_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_txns_booking_id ON public.st_booking_transactions USING btree (booking_id);


--
-- Name: idx_booking_txns_property_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_txns_property_id ON public.st_booking_transactions USING btree (property_id);


--
-- Name: idx_bookings_check_in_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_check_in_date ON public.st_bookings USING btree (check_in_date);


--
-- Name: idx_bookings_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_expires_at ON public.st_bookings USING btree (expires_at) WHERE (status = 'requested'::public.st_booking_status);


--
-- Name: idx_bookings_guest_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_guest_user_id ON public.st_bookings USING btree (guest_user_id);


--
-- Name: idx_bookings_pm_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_pm_user_id ON public.st_bookings USING btree (pm_user_id);


--
-- Name: idx_bookings_property_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_property_id ON public.st_bookings USING btree (property_id);


--
-- Name: idx_bookings_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_status ON public.st_bookings USING btree (status);


--
-- Name: idx_cleaning_tasks_cleaner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cleaning_tasks_cleaner ON public.cleaning_tasks USING btree (cleaner_user_id);


--
-- Name: idx_cleaning_tasks_property; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cleaning_tasks_property ON public.cleaning_tasks USING btree (property_id);


--
-- Name: idx_cleaning_tasks_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cleaning_tasks_status ON public.cleaning_tasks USING btree (status);


--
-- Name: idx_inventory_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_category ON public.st_property_inventory USING btree (category);


--
-- Name: idx_inventory_property; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_property ON public.st_property_inventory USING btree (property_id);


--
-- Name: idx_notifications_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id, is_read, created_at DESC);


--
-- Name: idx_payment_methods_user_default; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_payment_methods_user_default ON public.payment_methods USING btree (user_id) WHERE (is_default = true);


--
-- Name: idx_payment_methods_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_methods_user_id ON public.payment_methods USING btree (user_id);


--
-- Name: idx_pm_roles_pm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pm_roles_pm ON public.pm_roles USING btree (pm_user_id);


--
-- Name: idx_pm_team_pm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pm_team_pm ON public.pm_team_members USING btree (pm_user_id);


--
-- Name: idx_pm_team_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pm_team_user ON public.pm_team_members USING btree (user_id);


--
-- Name: idx_pricing_property_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pricing_property_date ON public.st_property_pricing USING btree (property_id, date);


--
-- Name: idx_reviews_property_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_property_id ON public.st_reviews USING btree (property_id);


--
-- Name: idx_settlements_booking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_settlements_booking ON public.pm_po_settlements USING btree (booking_id);


--
-- Name: idx_settlements_from; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_settlements_from ON public.pm_po_settlements USING btree (from_user_id);


--
-- Name: idx_settlements_property; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_settlements_property ON public.pm_po_settlements USING btree (property_id);


--
-- Name: idx_settlements_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_settlements_to ON public.pm_po_settlements USING btree (to_user_id);


--
-- Name: idx_st_activity_property; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_st_activity_property ON public.st_property_activity_log USING btree (property_id, created_at DESC);


--
-- Name: idx_user_documents_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_documents_expiry ON public.user_documents USING btree (expiry_date);


--
-- Name: idx_user_documents_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_documents_user_id ON public.user_documents USING btree (user_id);


--
-- Name: pm_links_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX pm_links_unique ON public.pm_po_links USING btree (pm_user_id, target_user_id);


--
-- Name: users_email_role_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_email_role_unique ON public.users USING btree (email, role);


--
-- Name: cleaning_automation_rules cleaning_automation_rules_checklist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cleaning_automation_rules
    ADD CONSTRAINT cleaning_automation_rules_checklist_id_fkey FOREIGN KEY (checklist_id) REFERENCES public.cleaning_checklists(id) ON DELETE CASCADE;


--
-- Name: cleaning_automation_rules cleaning_automation_rules_pm_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cleaning_automation_rules
    ADD CONSTRAINT cleaning_automation_rules_pm_user_id_fkey FOREIGN KEY (pm_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: cleaning_automation_rules cleaning_automation_rules_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cleaning_automation_rules
    ADD CONSTRAINT cleaning_automation_rules_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.st_properties(id) ON DELETE CASCADE;


--
-- Name: cleaning_checklist_items cleaning_checklist_items_checklist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cleaning_checklist_items
    ADD CONSTRAINT cleaning_checklist_items_checklist_id_fkey FOREIGN KEY (checklist_id) REFERENCES public.cleaning_checklists(id) ON DELETE CASCADE;


--
-- Name: cleaning_checklists cleaning_checklists_pm_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cleaning_checklists
    ADD CONSTRAINT cleaning_checklists_pm_user_id_fkey FOREIGN KEY (pm_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: cleaning_checklists cleaning_checklists_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cleaning_checklists
    ADD CONSTRAINT cleaning_checklists_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.st_properties(id) ON DELETE CASCADE;


--
-- Name: cleaning_task_items cleaning_task_items_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cleaning_task_items
    ADD CONSTRAINT cleaning_task_items_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.cleaning_tasks(id) ON DELETE CASCADE;


--
-- Name: cleaning_tasks cleaning_tasks_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cleaning_tasks
    ADD CONSTRAINT cleaning_tasks_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.st_bookings(id);


--
-- Name: cleaning_tasks cleaning_tasks_checklist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cleaning_tasks
    ADD CONSTRAINT cleaning_tasks_checklist_id_fkey FOREIGN KEY (checklist_id) REFERENCES public.cleaning_checklists(id);


--
-- Name: cleaning_tasks cleaning_tasks_cleaner_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cleaning_tasks
    ADD CONSTRAINT cleaning_tasks_cleaner_user_id_fkey FOREIGN KEY (cleaner_user_id) REFERENCES public.users(id);


--
-- Name: cleaning_tasks cleaning_tasks_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cleaning_tasks
    ADD CONSTRAINT cleaning_tasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: cleaning_tasks cleaning_tasks_pm_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cleaning_tasks
    ADD CONSTRAINT cleaning_tasks_pm_user_id_fkey FOREIGN KEY (pm_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: cleaning_tasks cleaning_tasks_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cleaning_tasks
    ADD CONSTRAINT cleaning_tasks_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.st_properties(id) ON DELETE CASCADE;


--
-- Name: guests guests_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guests
    ADD CONSTRAINT guests_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: invoices invoices_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id);


--
-- Name: invoices invoices_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id) ON DELETE CASCADE;


--
-- Name: invoices invoices_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: messages messages_sender_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_sender_id_users_id_fk FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: payment_methods payment_methods_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT payment_methods_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: plan_features plan_features_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_features
    ADD CONSTRAINT plan_features_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id) ON DELETE CASCADE;


--
-- Name: pm_po_links pm_po_links_pm_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pm_po_links
    ADD CONSTRAINT pm_po_links_pm_user_id_fkey FOREIGN KEY (pm_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: pm_po_links pm_po_links_target_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pm_po_links
    ADD CONSTRAINT pm_po_links_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: pm_po_settlements pm_po_settlements_from_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pm_po_settlements
    ADD CONSTRAINT pm_po_settlements_from_user_id_fkey FOREIGN KEY (from_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: pm_po_settlements pm_po_settlements_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pm_po_settlements
    ADD CONSTRAINT pm_po_settlements_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.st_properties(id) ON DELETE CASCADE;


--
-- Name: pm_po_settlements pm_po_settlements_to_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pm_po_settlements
    ADD CONSTRAINT pm_po_settlements_to_user_id_fkey FOREIGN KEY (to_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: pm_roles pm_roles_pm_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pm_roles
    ADD CONSTRAINT pm_roles_pm_user_id_fkey FOREIGN KEY (pm_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: pm_settings pm_settings_pm_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pm_settings
    ADD CONSTRAINT pm_settings_pm_user_id_fkey FOREIGN KEY (pm_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: pm_team_members pm_team_members_pm_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pm_team_members
    ADD CONSTRAINT pm_team_members_pm_user_id_fkey FOREIGN KEY (pm_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: pm_team_members pm_team_members_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pm_team_members
    ADD CONSTRAINT pm_team_members_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.pm_roles(id) ON DELETE SET NULL;


--
-- Name: pm_team_members pm_team_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pm_team_members
    ADD CONSTRAINT pm_team_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: st_acquisition_details st_acquisition_details_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.st_acquisition_details
    ADD CONSTRAINT st_acquisition_details_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.st_properties(id) ON DELETE CASCADE;


--
-- Name: st_blocked_dates st_blocked_dates_blocked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.st_blocked_dates
    ADD CONSTRAINT st_blocked_dates_blocked_by_fkey FOREIGN KEY (blocked_by) REFERENCES public.users(id);


--
-- Name: st_blocked_dates st_blocked_dates_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.st_blocked_dates
    ADD CONSTRAINT st_blocked_dates_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.st_properties(id) ON DELETE CASCADE;


--
-- Name: st_booking_transactions st_booking_transactions_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.st_booking_transactions
    ADD CONSTRAINT st_booking_transactions_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.st_bookings(id) ON DELETE CASCADE;


--
-- Name: st_booking_transactions st_booking_transactions_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.st_booking_transactions
    ADD CONSTRAINT st_booking_transactions_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.st_properties(id) ON DELETE CASCADE;


--
-- Name: st_bookings st_bookings_cancelled_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.st_bookings
    ADD CONSTRAINT st_bookings_cancelled_by_fkey FOREIGN KEY (cancelled_by) REFERENCES public.users(id);


--
-- Name: st_bookings st_bookings_cash_collected_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.st_bookings
    ADD CONSTRAINT st_bookings_cash_collected_by_user_id_fkey FOREIGN KEY (cash_collected_by_user_id) REFERENCES public.users(id);


--
-- Name: st_bookings st_bookings_checked_in_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.st_bookings
    ADD CONSTRAINT st_bookings_checked_in_by_fkey FOREIGN KEY (checked_in_by) REFERENCES public.users(id);


--
-- Name: st_bookings st_bookings_checked_out_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.st_bookings
    ADD CONSTRAINT st_bookings_checked_out_by_fkey FOREIGN KEY (checked_out_by) REFERENCES public.users(id);


--
-- Name: st_bookings st_bookings_guest_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.st_bookings
    ADD CONSTRAINT st_bookings_guest_user_id_fkey FOREIGN KEY (guest_user_id) REFERENCES public.users(id);


--
-- Name: st_bookings st_bookings_pm_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.st_bookings
    ADD CONSTRAINT st_bookings_pm_user_id_fkey FOREIGN KEY (pm_user_id) REFERENCES public.users(id);


--
-- Name: st_bookings st_bookings_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.st_bookings
    ADD CONSTRAINT st_bookings_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.st_properties(id) ON DELETE CASCADE;


--
-- Name: st_checkout_records st_checkout_records_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.st_checkout_records
    ADD CONSTRAINT st_checkout_records_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.st_bookings(id) ON DELETE CASCADE;


--
-- Name: st_checkout_records st_checkout_records_completed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.st_checkout_records
    ADD CONSTRAINT st_checkout_records_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES public.users(id);


--
-- Name: st_payment_schedules st_payment_schedules_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.st_payment_schedules
    ADD CONSTRAINT st_payment_schedules_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.st_properties(id) ON DELETE CASCADE;


--
-- Name: st_properties st_properties_area_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.st_properties
    ADD CONSTRAINT st_properties_area_id_fkey FOREIGN KEY (area_id) REFERENCES public.areas(id);


--
-- Name: st_properties st_properties_pm_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.st_properties
    ADD CONSTRAINT st_properties_pm_user_id_fkey FOREIGN KEY (pm_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: st_properties st_properties_po_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.st_properties
    ADD CONSTRAINT st_properties_po_user_id_fkey FOREIGN KEY (po_user_id) REFERENCES public.users(id);


--
-- Name: st_property_activity_log st_property_activity_log_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.st_property_activity_log
    ADD CONSTRAINT st_property_activity_log_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.st_properties(id) ON DELETE CASCADE;


--
-- Name: st_property_activity_log st_property_activity_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.st_property_activity_log
    ADD CONSTRAINT st_property_activity_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: st_property_amenities st_property_amenities_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.st_property_amenities
    ADD CONSTRAINT st_property_amenities_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.st_properties(id) ON DELETE CASCADE;


--
-- Name: st_property_documents st_property_documents_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.st_property_documents
    ADD CONSTRAINT st_property_documents_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.st_properties(id) ON DELETE CASCADE;


--
-- Name: st_property_expenses st_property_expenses_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.st_property_expenses
    ADD CONSTRAINT st_property_expenses_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: st_property_expenses st_property_expenses_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.st_property_expenses
    ADD CONSTRAINT st_property_expenses_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.st_properties(id) ON DELETE CASCADE;


--
-- Name: st_property_inventory st_property_inventory_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.st_property_inventory
    ADD CONSTRAINT st_property_inventory_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: st_property_inventory st_property_inventory_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.st_property_inventory
    ADD CONSTRAINT st_property_inventory_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.st_properties(id) ON DELETE CASCADE;


--
-- Name: st_property_photos st_property_photos_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.st_property_photos
    ADD CONSTRAINT st_property_photos_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.st_properties(id) ON DELETE CASCADE;


--
-- Name: st_property_policies st_property_policies_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.st_property_policies
    ADD CONSTRAINT st_property_policies_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.st_properties(id) ON DELETE CASCADE;


--
-- Name: st_property_pricing st_property_pricing_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.st_property_pricing
    ADD CONSTRAINT st_property_pricing_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.st_properties(id) ON DELETE CASCADE;


--
-- Name: st_reviews st_reviews_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.st_reviews
    ADD CONSTRAINT st_reviews_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.st_bookings(id) ON DELETE CASCADE;


--
-- Name: st_reviews st_reviews_guest_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.st_reviews
    ADD CONSTRAINT st_reviews_guest_user_id_fkey FOREIGN KEY (guest_user_id) REFERENCES public.users(id);


--
-- Name: st_reviews st_reviews_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.st_reviews
    ADD CONSTRAINT st_reviews_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.st_properties(id) ON DELETE CASCADE;


--
-- Name: st_security_deposits st_security_deposits_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.st_security_deposits
    ADD CONSTRAINT st_security_deposits_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.st_bookings(id) ON DELETE CASCADE;


--
-- Name: st_security_deposits st_security_deposits_processed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.st_security_deposits
    ADD CONSTRAINT st_security_deposits_processed_by_fkey FOREIGN KEY (processed_by) REFERENCES public.users(id);


--
-- Name: subscriptions subscriptions_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id);


--
-- Name: subscriptions subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_audit_log user_audit_log_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_audit_log
    ADD CONSTRAINT user_audit_log_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_documents user_documents_document_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_documents
    ADD CONSTRAINT user_documents_document_type_id_fkey FOREIGN KEY (document_type_id) REFERENCES public.document_types(id);


--
-- Name: user_documents user_documents_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_documents
    ADD CONSTRAINT user_documents_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict kYbV8CpMOPvz6l4NI5DwrcVmunRShArCIfij4ay2hCtPd6ov6S7I9fDJhduLYSm

