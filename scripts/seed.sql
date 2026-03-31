-- NestQuest V2 Seed Data
-- Run after schema.sql: psql -d nestquest_v2 -f scripts/seed.sql
-- All passwords are: Password1!
-- bcrypt hash for Password1!
-- $2b$10$VOIsZLjUCDzxnX9uYYdRPuXemgCZN1NFmRbIv2AFmwiubGlp9Bave

-- ══════════════════════════════════════════════════════
-- USERS
-- ══════════════════════════════════════════════════════

INSERT INTO users (id, email, password_hash, role, phone, status) VALUES
  ('c57f9aec-5a7e-47ac-999d-44a4a3ded602', 'admin@nestquest.com', '$2b$10$VOIsZLjUCDzxnX9uYYdRPuXemgCZN1NFmRbIv2AFmwiubGlp9Bave', 'SUPER_ADMIN', '+971500000000', 'active'),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'pm@nestquest.com', '$2b$10$VOIsZLjUCDzxnX9uYYdRPuXemgCZN1NFmRbIv2AFmwiubGlp9Bave', 'PROPERTY_MANAGER', '+971501234567', 'active'),
  ('d4e5f6a7-b8c9-0123-def0-456789abcdef', 'owner@nestquest.com', '$2b$10$VOIsZLjUCDzxnX9uYYdRPuXemgCZN1NFmRbIv2AFmwiubGlp9Bave', 'PROPERTY_OWNER', '+971502345678', 'active'),
  ('guest-001', 'guest@nestquest.com', '$2b$10$VOIsZLjUCDzxnX9uYYdRPuXemgCZN1NFmRbIv2AFmwiubGlp9Bave', 'GUEST', '+971507654321', 'active'),
  ('cleaner-001', 'cleaner@nestquest.com', '$2b$10$VOIsZLjUCDzxnX9uYYdRPuXemgCZN1NFmRbIv2AFmwiubGlp9Bave', 'CLEANER', '+971509876543', 'active')
ON CONFLICT DO NOTHING;

-- Guest profiles
INSERT INTO guests (id, user_id, full_name, dob, nationality, country_of_residence, resident_address, emirates_id_number, emirates_id_expiry, emirates_id_front_url, emirates_id_back_url, passport_number, passport_expiry, passport_front_url, kyc_status) VALUES
  ('g-pm-001', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Ahmed Al Maktoum', '1988-05-15', 'Emirati', 'United Arab Emirates', 'Villa 42, Al Barsha 1, Dubai, UAE', '784-1988-1234567-1', '2026-05-29', '/uploads/emirates_id_front.png', '/uploads/emirates_id_back.jpeg', 'P1234567', '2029-06-30', '/uploads/passport_front.webp', 'verified'),
  ('g-po-001', 'd4e5f6a7-b8c9-0123-def0-456789abcdef', 'Fatima Al Nahyan', '1985-09-22', 'Emirati', 'United Arab Emirates', 'Villa 18, Emirates Hills, Dubai, UAE', '784-1985-7654321-2', '2027-11-15', '/uploads/emirates_id_front.png', '/uploads/emirates_id_back.jpeg', 'P7654321', '2028-08-20', '/uploads/passport_front.webp', 'verified'),
  ('g-guest-001', 'guest-001', 'James Wilson', '1990-06-15', 'British', 'United Arab Emirates', 'JBR Walk, Apt 803, Dubai', '784-1990-1234567-5', '2028-03-15', NULL, NULL, NULL, NULL, NULL, 'verified')
ON CONFLICT DO NOTHING;

-- ══════════════════════════════════════════════════════
-- DOCUMENT TYPES & USER DOCUMENTS
-- ══════════════════════════════════════════════════════

INSERT INTO document_types (id, slug, label, has_expiry, applicable_roles, required_for_roles, sort_order, is_active) VALUES
  ('dt-001', 'emirates_id', 'Emirates ID', true, '{GUEST,PROPERTY_MANAGER,PROPERTY_OWNER,TENANT}', '{GUEST,PROPERTY_MANAGER,PROPERTY_OWNER,TENANT}', 1, true),
  ('dt-002', 'passport', 'Passport', true, '{GUEST,PROPERTY_MANAGER,PROPERTY_OWNER,TENANT}', '{GUEST}', 2, true),
  ('dt-003', 'trade_license', 'Trade License', true, '{PROPERTY_MANAGER}', '{PROPERTY_MANAGER}', 3, true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO user_documents (id, user_id, document_type_id, file_url, document_number, expiry_date) VALUES
  (gen_random_uuid()::text, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'dt-001', '/uploads/emirates_id_front.png', '784-1988-1234567-1', '2026-05-29'),
  (gen_random_uuid()::text, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'dt-002', '/uploads/passport_front.webp', 'P1234567', '2029-06-30'),
  (gen_random_uuid()::text, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'dt-003', '/uploads/trade_license.webp', 'TL-2024-98765', '2027-03-15'),
  (gen_random_uuid()::text, 'd4e5f6a7-b8c9-0123-def0-456789abcdef', 'dt-001', '/uploads/emirates_id_front.png', '784-1985-7654321-2', '2027-11-15'),
  (gen_random_uuid()::text, 'd4e5f6a7-b8c9-0123-def0-456789abcdef', 'dt-002', '/uploads/passport_front.webp', 'P7654321', '2028-08-20')
ON CONFLICT DO NOTHING;

-- ══════════════════════════════════════════════════════
-- PM-PO LINK, PLANS, SUBSCRIPTION
-- ══════════════════════════════════════════════════════

INSERT INTO pm_po_links (id, pm_user_id, target_user_id, target_role, status) VALUES
  (gen_random_uuid()::text, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'd4e5f6a7-b8c9-0123-def0-456789abcdef', 'PROPERTY_OWNER', 'accepted')
ON CONFLICT DO NOTHING;

INSERT INTO plans (id, name, description, price, billing_cycle, trial_days, is_active) VALUES
  ('plan-basic', 'Basic', 'Essential property management', '1000', 'monthly', 7, true)
ON CONFLICT DO NOTHING;

INSERT INTO subscriptions (id, user_id, plan_id, status, current_period_start, current_period_end) VALUES
  ('sub-pm-001', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'plan-basic', 'active', NOW(), NOW() + INTERVAL '30 days')
ON CONFLICT DO NOTHING;

INSERT INTO invoices (id, subscription_id, user_id, plan_id, amount, invoice_status, billing_period_start, billing_period_end, paid_at) VALUES
  (gen_random_uuid()::text, 'sub-pm-001', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'plan-basic', '1000', 'paid', NOW(), NOW() + INTERVAL '30 days', NOW())
ON CONFLICT DO NOTHING;

INSERT INTO payment_methods (id, user_id, card_brand, card_last4, card_holder_name, expiry_month, expiry_year, is_default) VALUES
  (gen_random_uuid()::text, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Visa', '4242', 'Ahmed Al Maktoum', 12, 2028, true)
ON CONFLICT DO NOTHING;

INSERT INTO pm_settings (id, pm_user_id, tourism_tax_percent, vat_percent, default_check_in_time, default_check_out_time) VALUES
  (gen_random_uuid()::text, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '0', '5', '15:00', '12:00')
ON CONFLICT DO NOTHING;

-- ══════════════════════════════════════════════════════
-- AREAS
-- ══════════════════════════════════════════════════════

INSERT INTO areas (id, name, city, latitude, longitude) VALUES
  ('area-marina', 'Dubai Marina', 'dubai', '25.080341', '55.139235'),
  ('area-downtown', 'Downtown Dubai', 'dubai', '25.197197', '55.274376'),
  ('area-jbr', 'JBR', 'dubai', '25.078835', '55.133974'),
  ('area-barsha', 'Al Barsha 1', 'dubai', '25.113220', '55.200140')
ON CONFLICT DO NOTHING;
