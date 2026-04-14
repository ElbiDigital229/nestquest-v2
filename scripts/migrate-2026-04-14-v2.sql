-- Migration v2: 2026-04-14 — Add missing st_bookings column
-- Run: source .env && psql $DATABASE_URL -f scripts/migrate-2026-04-14-v2.sql

ALTER TABLE st_bookings ADD COLUMN IF NOT EXISTS cash_collected_by_user_id character varying(36) REFERENCES users(id);

SELECT 'Migration v2 complete' AS status;
