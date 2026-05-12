-- Migration: 2026-05-12 — Quick-login demo users + links
--
-- Adds the demo accounts the login-page "Quick Login" dropdown references but
-- that weren't seeded by scripts/seed.sql: PM Sarah Al Rashidi, Guest Maria
-- Santos, Guest Lena Hoffmann. Also backfills display names on the existing
-- seed users (Ahmed / Fatima / James / Ravi) so dashboards render nicely, and
-- wires the new PM (Sarah) up with a subscription, pm_settings, a pm_po_link
-- to Fatima, four reassigned demo properties, and bookings for Maria + Lena.
--
-- Password for every demo account is "Password1!" — the same bcrypt hash
-- shipped in seed.sql, so this file does not need bcrypt at migration time.
--
-- Idempotent: safe to re-run.
-- Run: psql "$DATABASE_URL" -f scripts/migrate-2026-05-12-quick-login-demo.sql

BEGIN;

-- ══════════════════════════════════════════════════════
-- 1. NEW QUICK-LOGIN USERS
-- ══════════════════════════════════════════════════════

INSERT INTO users (
  id, email, password_hash, role, phone, status,
  full_name, nationality, country_of_residence, kyc_status
) VALUES
  ('demo-pm-sarah',
   'sarah@nestquest.com',
   '$2b$10$VOIsZLjUCDzxnX9uYYdRPuXemgCZN1NFmRbIv2AFmwiubGlp9Bave',
   'PROPERTY_MANAGER', '+971502233445', 'active',
   'Sarah Al Rashidi', 'Emirati', 'United Arab Emirates', 'verified'),
  ('demo-guest-maria',
   'maria@guest.com',
   '$2b$10$VOIsZLjUCDzxnX9uYYdRPuXemgCZN1NFmRbIv2AFmwiubGlp9Bave',
   'GUEST', '+971504567890', 'active',
   'Maria Santos', 'Philippines', 'United Arab Emirates', 'verified'),
  ('demo-guest-lena',
   'lena@guest.com',
   '$2b$10$VOIsZLjUCDzxnX9uYYdRPuXemgCZN1NFmRbIv2AFmwiubGlp9Bave',
   'GUEST', '+971505678901', 'active',
   'Lena Hoffmann', 'Germany', 'United Arab Emirates', 'verified')
ON CONFLICT (email, role) DO NOTHING;

-- ══════════════════════════════════════════════════════
-- 2. BACKFILL DISPLAY NAMES ON EXISTING SEED USERS
-- ══════════════════════════════════════════════════════

UPDATE users SET
  full_name = COALESCE(full_name, 'Ahmed Al Maktoum'),
  nationality = COALESCE(nationality, 'Emirati'),
  country_of_residence = COALESCE(country_of_residence, 'United Arab Emirates'),
  kyc_status = COALESCE(kyc_status, 'verified')
WHERE id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

UPDATE users SET
  full_name = COALESCE(full_name, 'Fatima Al Nahyan'),
  nationality = COALESCE(nationality, 'Emirati'),
  country_of_residence = COALESCE(country_of_residence, 'United Arab Emirates'),
  kyc_status = COALESCE(kyc_status, 'verified')
WHERE id = 'd4e5f6a7-b8c9-0123-def0-456789abcdef';

UPDATE users SET
  full_name = COALESCE(full_name, 'James Wilson'),
  nationality = COALESCE(nationality, 'United Kingdom'),
  country_of_residence = COALESCE(country_of_residence, 'United Arab Emirates'),
  kyc_status = COALESCE(kyc_status, 'verified')
WHERE id = 'guest-001';

UPDATE users SET
  full_name = COALESCE(full_name, 'Ravi Kumar'),
  nationality = COALESCE(nationality, 'India'),
  country_of_residence = COALESCE(country_of_residence, 'United Arab Emirates')
WHERE id = 'cleaner-001';

-- ══════════════════════════════════════════════════════
-- 3. SARAH'S PM INFRA (subscription, settings)
-- ══════════════════════════════════════════════════════

-- Ensure the basic plan exists (seed.sql adds it, but be defensive)
INSERT INTO plans (id, name, description, price, billing_cycle, trial_days, is_active)
VALUES ('plan-basic', 'Basic', 'Essential property management', '1000', 'monthly', 7, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO subscriptions (id, user_id, plan_id, status, current_period_start, current_period_end)
VALUES ('sub-pm-sarah', 'demo-pm-sarah', 'plan-basic', 'active', NOW(), NOW() + INTERVAL '30 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO pm_settings (id, pm_user_id, tourism_tax_percent, vat_percent, default_check_in_time, default_check_out_time)
VALUES ('pmset-sarah', 'demo-pm-sarah', '0', '5', '15:00', '12:00')
ON CONFLICT (pm_user_id) DO NOTHING;

-- ══════════════════════════════════════════════════════
-- 4. PM ↔ PO LINKS
-- ══════════════════════════════════════════════════════

-- Sarah ↔ Fatima (so Sarah co-manages Fatima's portfolio)
INSERT INTO pm_po_links (id, pm_user_id, target_user_id, target_role, status)
VALUES ('link-sarah-fatima', 'demo-pm-sarah', 'd4e5f6a7-b8c9-0123-def0-456789abcdef', 'PROPERTY_OWNER', 'accepted')
ON CONFLICT (pm_user_id, target_user_id) DO NOTHING;

-- ══════════════════════════════════════════════════════
-- 5. REASSIGN 4 PROPERTIES + BOOKINGS FOR MARIA/LENA
-- Only runs if the demo seed (seed-demo.sql) has been applied —
-- on a fresh DB without demo-prop-* rows this block is a no-op.
-- ══════════════════════════════════════════════════════

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM st_properties WHERE id = 'demo-prop-04') THEN
    UPDATE st_properties
       SET pm_user_id = 'demo-pm-sarah', updated_at = NOW()
     WHERE id IN ('demo-prop-04', 'demo-prop-08', 'demo-prop-13', 'demo-prop-14');

    UPDATE st_bookings
       SET pm_user_id = 'demo-pm-sarah'
     WHERE property_id IN ('demo-prop-04', 'demo-prop-08', 'demo-prop-13', 'demo-prop-14');

    -- Bookings for Maria & Lena so they have history when they sign in
    INSERT INTO st_bookings (
      id, property_id, pm_user_id, guest_user_id, guest_name, guest_email,
      status, payment_status,
      check_in_date, check_out_date, number_of_guests,
      total_nights, weekday_nights, weekend_nights,
      nightly_rate, weekend_rate, cleaning_fee,
      subtotal, total_amount,
      completed_at, confirmed_at
    ) VALUES
      ('demo-bk-maria-01', 'demo-prop-01', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'demo-guest-maria', 'Maria Santos', 'maria@guest.com',
       'completed', 'paid',
       (NOW() - INTERVAL '45 days')::date, (NOW() - INTERVAL '42 days')::date, 2,
       3, 2, 1, '650', '800', '150', '2100', '2100',
       NOW() - INTERVAL '42 days', NOW() - INTERVAL '50 days'),
      ('demo-bk-maria-02', 'demo-prop-04', 'demo-pm-sarah', 'demo-guest-maria', 'Maria Santos', 'maria@guest.com',
       'completed', 'paid',
       (NOW() - INTERVAL '20 days')::date, (NOW() - INTERVAL '17 days')::date, 1,
       3, 2, 1, '320', '420', '90', '1050', '1050',
       NOW() - INTERVAL '17 days', NOW() - INTERVAL '25 days'),
      ('demo-bk-lena-01', 'demo-prop-08', 'demo-pm-sarah', 'demo-guest-lena', 'Lena Hoffmann', 'lena@guest.com',
       'completed', 'paid',
       (NOW() - INTERVAL '30 days')::date, (NOW() - INTERVAL '25 days')::date, 2,
       5, 3, 2, '280', '360', '80', '1480', '1480',
       NOW() - INTERVAL '25 days', NOW() - INTERVAL '35 days'),
      ('demo-bk-lena-02', 'demo-prop-06', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'demo-guest-lena', 'Lena Hoffmann', 'lena@guest.com',
       'confirmed', 'paid',
       (NOW() + INTERVAL '10 days')::date, (NOW() + INTERVAL '14 days')::date, 2,
       4, 3, 1, '580', '720', '140', '2440', '2440',
       NULL, NOW() - INTERVAL '5 days')
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

COMMIT;

SELECT
  (SELECT COUNT(*) FROM users WHERE id IN ('demo-pm-sarah', 'demo-guest-maria', 'demo-guest-lena')) AS new_users,
  (SELECT COUNT(*) FROM pm_po_links WHERE pm_user_id = 'demo-pm-sarah') AS sarah_links,
  (SELECT COUNT(*) FROM st_properties WHERE pm_user_id = 'demo-pm-sarah') AS sarah_properties,
  (SELECT COUNT(*) FROM st_bookings WHERE guest_user_id IN ('demo-guest-maria', 'demo-guest-lena')) AS new_bookings;
