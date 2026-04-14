-- Migration: 2026-04-14 bugfixes
-- Run on production: psql -d nestquest_v2 -f scripts/migrate-2026-04-14.sql

BEGIN;

-- 1. Add missing columns to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS dob date,
  ADD COLUMN IF NOT EXISTS nationality text,
  ADD COLUMN IF NOT EXISTS country_of_residence text,
  ADD COLUMN IF NOT EXISTS resident_address text,
  ADD COLUMN IF NOT EXISTS emirates_id_number text,
  ADD COLUMN IF NOT EXISTS emirates_id_expiry date,
  ADD COLUMN IF NOT EXISTS emirates_id_front_url text,
  ADD COLUMN IF NOT EXISTS emirates_id_back_url text,
  ADD COLUMN IF NOT EXISTS passport_number text,
  ADD COLUMN IF NOT EXISTS passport_expiry date,
  ADD COLUMN IF NOT EXISTS passport_front_url text,
  ADD COLUMN IF NOT EXISTS trade_license_expiry date,
  ADD COLUMN IF NOT EXISTS trade_license_url text,
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS company_website text,
  ADD COLUMN IF NOT EXISTS company_description text,
  ADD COLUMN IF NOT EXISTS company_address text,
  ADD COLUMN IF NOT EXISTS kyc_status kyc_status;

-- 2. Add missing notification_type enum values
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'KYC_VERIFIED';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'KYC_REJECTED';

COMMIT;

-- 3. message_trigger enum (must be outside transaction for ADD VALUE)
DO $$ BEGIN
  CREATE TYPE message_trigger AS ENUM ('manual', 'booking_confirmed', 'check_in_day', 'day_before_checkout', 'post_checkout');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. message_templates table
CREATE TABLE IF NOT EXISTS message_templates (
  id character varying(36) PRIMARY KEY,
  pm_user_id character varying(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  subject text,
  body text NOT NULL,
  trigger message_trigger DEFAULT 'manual',
  trigger_delay_hours integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS message_templates_pm_user_id_idx ON message_templates(pm_user_id);

-- 5. message_template_sends table
CREATE TABLE IF NOT EXISTS message_template_sends (
  id character varying(36) PRIMARY KEY,
  template_id character varying(36) NOT NULL REFERENCES message_templates(id) ON DELETE CASCADE,
  booking_id character varying(36) NOT NULL,
  trigger message_trigger NOT NULL,
  sent_at timestamp without time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mts_template_booking_idx ON message_template_sends(template_id, booking_id);

-- 6. site_settings table
CREATE TABLE IF NOT EXISTS site_settings (
  key varchar(100) PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamp without time zone NOT NULL DEFAULT now()
);

-- Done
SELECT 'Migration 2026-04-14 complete' AS status;
