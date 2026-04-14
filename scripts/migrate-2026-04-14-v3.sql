-- Migration v3: 2026-04-14 — Add missing lock tables
-- Run: source .env && psql $DATABASE_URL -f scripts/migrate-2026-04-14-v3.sql

CREATE TABLE IF NOT EXISTS st_property_locks (
  id character varying(36) PRIMARY KEY,
  property_id character varying(36) NOT NULL REFERENCES st_properties(id) ON DELETE CASCADE,
  device_name text,
  device_type text,
  device_id text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_property_locks_property_id ON st_property_locks(property_id);

CREATE TABLE IF NOT EXISTS st_lock_pins (
  id character varying(36) PRIMARY KEY,
  lock_id character varying(36) NOT NULL REFERENCES st_property_locks(id) ON DELETE CASCADE,
  booking_id character varying(36) REFERENCES st_bookings(id),
  pin text NOT NULL,
  valid_from timestamp without time zone,
  valid_until timestamp without time zone,
  status text NOT NULL DEFAULT 'active',
  generated_by character varying(36) REFERENCES users(id),
  deactivated_at timestamp without time zone,
  created_at timestamp without time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lock_pins_lock_id ON st_lock_pins(lock_id);
CREATE INDEX IF NOT EXISTS idx_lock_pins_booking_id ON st_lock_pins(booking_id);

SELECT 'Migration v3 complete' AS status;
