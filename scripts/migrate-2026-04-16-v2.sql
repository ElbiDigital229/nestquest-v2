-- Migration: 2026-04-16 v2 — Ensure st_property_pricing table exists
-- The booking calculatePrice service queries this table for date-specific
-- price overrides. It exists in scripts/schema.sql but was never added to
-- the Drizzle schema, so drizzle-kit push doesn't create it.
-- Without it, POST /bookings/calculate-price returns 500.
-- Run: psql "$DATABASE_URL" -f scripts/migrate-2026-04-16-v2.sql

BEGIN;

CREATE TABLE IF NOT EXISTS st_property_pricing (
  id character varying(36) PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  property_id character varying(36) NOT NULL REFERENCES st_properties(id) ON DELETE CASCADE,
  date date NOT NULL,
  price text NOT NULL,
  min_stay integer,
  notes text,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  UNIQUE (property_id, date)
);

CREATE INDEX IF NOT EXISTS idx_pricing_property_date ON st_property_pricing (property_id, date);

COMMIT;

SELECT 'Migration 2026-04-16 v2 (st_property_pricing) complete' AS status;
