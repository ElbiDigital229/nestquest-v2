-- Migration: 2026-04-15 add maximum_stay column
-- Run on production: psql -d nestquest_v2 -f scripts/migrate-2026-04-15.sql

BEGIN;

ALTER TABLE st_properties
  ADD COLUMN IF NOT EXISTS maximum_stay integer DEFAULT 30;

COMMIT;

SELECT 'Migration 2026-04-15 complete' AS status;
