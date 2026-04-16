-- Migration: 2026-04-16 — Align st_property_locks schema with code
-- The original v3 migration created device_name/device_type, but the
-- application code uses name/brand/model/location/api_key.
-- Run: psql "$DATABASE_URL" -f scripts/migrate-2026-04-16.sql

BEGIN;

ALTER TABLE st_property_locks
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS api_key text;

-- Backfill: copy device_name into name if name is empty and device_name exists
UPDATE st_property_locks
SET name = device_name
WHERE name IS NULL AND device_name IS NOT NULL;

COMMIT;

SELECT 'Migration 2026-04-16 (st_property_locks columns) complete' AS status;
