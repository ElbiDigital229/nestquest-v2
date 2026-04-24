-- NestQuest V2 — Demo Seed
-- Populates the public home page with 15 listings so the site does not
-- look empty. All rows are tagged with a `demo-` prefix so cleanup is a
-- single command (see bottom of this file).
--
-- Prereqs: scripts/seed.sql must have been run first (users, areas, plan,
-- subscription, pm_settings, pm_po_links). This script assumes:
--   PM user:   a1b2c3d4-e5f6-7890-abcd-ef1234567890  (Ahmed — pm@nestquest.com)
--   PO user:   d4e5f6a7-b8c9-0123-def0-456789abcdef  (Fatima — owner@nestquest.com)
--   Guest:     guest-001                             (James — guest@nestquest.com)
--   Areas:     area-marina, area-downtown, area-jbr, area-barsha
--
-- Run:     psql "$DATABASE_URL" -f scripts/seed-demo.sql
-- Cleanup: psql "$DATABASE_URL" -c "DELETE FROM st_properties WHERE id LIKE 'demo-prop-%';"
--          (cascades to photos, bookings, reviews, etc.)

BEGIN;

-- ══════════════════════════════════════════════════════
-- 15 PROPERTIES
-- ══════════════════════════════════════════════════════

INSERT INTO st_properties (
  id, pm_user_id, po_user_id, status, property_type, area_id, city,
  public_name, short_description, long_description,
  bedrooms, bathrooms, max_guests, area_sqft, view_type,
  furnished, smart_home, maid_room,
  address_line_1, latitude, longitude,
  nightly_rate, weekend_rate, cleaning_fee, minimum_stay, maximum_stay,
  check_in_time, check_out_time, cancellation_policy,
  parking_spaces, parking_type, confirmed
) VALUES
  ('demo-prop-01', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'd4e5f6a7-b8c9-0123-def0-456789abcdef', 'active', 'apartment', 'area-marina',   'dubai', 'Marina Skyline Loft',            'Floor-to-ceiling views of Dubai Marina',                'A modern 2BR loft in the heart of Dubai Marina with panoramic harbour views, a private balcony, and full smart-home control.',                       2, 2, 4, 1350, 'sea_view',    true, true,  false, 'Marina Promenade, Dubai Marina', '25.080341', '55.139235', '650',  '800',  '150', 2, 30, '15:00', '12:00', 'moderate',       1, 'covered',  true),
  ('demo-prop-02', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'd4e5f6a7-b8c9-0123-def0-456789abcdef', 'active', 'apartment', 'area-downtown', 'dubai', 'Burj View Residence',            'Facing the Burj Khalifa — premium downtown location',   'A stylish 1BR apartment on the 42nd floor with direct Burj Khalifa views, walk-in rain shower, and access to the pool deck.',                         1, 1, 2, 780,  'city_view',   true, true,  false, 'Sheikh Mohammed bin Rashid Blvd', '25.197197', '55.274376', '480',  '620',  '120', 1, 30, '15:00', '11:00', 'flexible',       1, 'covered',  true),
  ('demo-prop-03', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'd4e5f6a7-b8c9-0123-def0-456789abcdef', 'active', 'villa',     'area-barsha',   'dubai', 'Al Barsha Family Villa',         'Spacious 4BR villa with private pool',                  'A generous family villa in quiet Al Barsha 1 — four bedrooms, maid''s room, private pool, and a landscaped garden. Close to Mall of the Emirates.',   4, 4, 8, 3800, 'garden_view', true, false, true,  'Villa 12, Al Barsha 1',            '25.113220', '55.200140', '1200', '1500', '250', 3, 30, '16:00', '12:00', 'moderate',       2, 'covered',  true),
  ('demo-prop-04', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'd4e5f6a7-b8c9-0123-def0-456789abcdef', 'active', 'apartment', 'area-jbr',      'dubai', 'JBR Beach Studio',               'Walk straight onto The Walk at JBR',                    'A cosy beachfront studio one minute from The Walk and JBR beach. Great for couples or a solo traveller — fully equipped kitchen and Netflix-ready.',  0, 1, 2, 520,  'sea_view',    true, false, false, 'JBR Walk, Cluster 4',              '25.078835', '55.133974', '320',  '420',  '90',  1, 30, '15:00', '11:00', 'flexible',       0, 'street',   true),
  ('demo-prop-05', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'd4e5f6a7-b8c9-0123-def0-456789abcdef', 'active', 'apartment', 'area-marina',   'dubai', 'Marina Harbour Suite',           'Bright 3BR with private terrace',                       'A refurbished 3BR with a large private terrace, marina views, and direct access to the metro. Sleeps 6 comfortably.',                                 3, 2, 6, 1650, 'sea_view',    true, true,  false, 'Marina Quay, Dubai Marina',       '25.081200', '55.140100', '900',  '1100', '180', 2, 30, '15:00', '12:00', 'moderate',       2, 'covered',  true),
  ('demo-prop-06', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'd4e5f6a7-b8c9-0123-def0-456789abcdef', 'active', 'apartment', 'area-downtown', 'dubai', 'Old Town Heritage Flat',         'Traditional Arabic architecture, modern comforts',      'A 2BR in the Old Town district designed in Arabic style — wooden balconies, courtyard views, and two minutes from Dubai Mall.',                       2, 2, 4, 1100, 'city_view',   true, false, false, 'Old Town Island',                  '25.196500', '55.273000', '580',  '720',  '140', 2, 30, '15:00', '12:00', 'strict',         1, 'basement', true),
  ('demo-prop-07', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'd4e5f6a7-b8c9-0123-def0-456789abcdef', 'active', 'villa',     'area-jbr',      'dubai', 'Beachfront Villa JBR',           'Private beach access, infinity pool',                   'An exclusive beachfront villa with an infinity pool, private beach entry, outdoor dining terrace, and a dedicated concierge on call.',               5, 5, 10,4500, 'sea_view',    true, true,  true,  'JBR Private Beachfront',           '25.077000', '55.132000', '2200', '2800', '450', 3, 30, '16:00', '12:00', 'strict',         3, 'covered',  true),
  ('demo-prop-08', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'd4e5f6a7-b8c9-0123-def0-456789abcdef', 'active', 'apartment', 'area-barsha',   'dubai', 'Al Barsha Cozy 1BR',             'Quiet neighbourhood, close to the Metro',               'A comfortable 1BR perfect for a business traveller — desk setup, fast Wi-Fi, and a five-minute walk to the Al Barsha Metro.',                          1, 1, 2, 680,  'no_view',     true, false, false, 'Al Barsha 1, Plot 14',             '25.112500', '55.201000', '280',  '360',  '80',  1, 30, '14:00', '11:00', 'flexible',       1, 'street',   true),
  ('demo-prop-09', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'd4e5f6a7-b8c9-0123-def0-456789abcdef', 'active', 'apartment', 'area-marina',   'dubai', 'Marina Walk Penthouse',          'Top-floor penthouse with wraparound views',             'A rare penthouse at the end of Marina Walk — wraparound terrace, private jacuzzi, and 270° sea views. Designed for a memorable stay.',                3, 3, 6, 2400, 'sea_view',    true, true,  true,  'Marina Walk Tower',                '25.079800', '55.138800', '1800', '2300', '300', 2, 30, '16:00', '12:00', 'strict',         2, 'covered',  true),
  ('demo-prop-10', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'd4e5f6a7-b8c9-0123-def0-456789abcdef', 'active', 'apartment', 'area-downtown', 'dubai', 'Downtown Designer 2BR',          'Curated by a local designer',                           'A carefully curated 2BR apartment with original art, a bespoke kitchen, and Burj Khalifa views from the living room.',                                 2, 2, 4, 1200, 'city_view',   true, true,  false, 'Emaar Square, Downtown',           '25.198000', '55.275100', '720',  '900',  '160', 2, 30, '15:00', '12:00', 'moderate',       1, 'covered',  true),
  ('demo-prop-11', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'd4e5f6a7-b8c9-0123-def0-456789abcdef', 'active', 'apartment', 'area-jbr',      'dubai', 'JBR Ocean View Apartment',       'Direct ocean views from every room',                    'A 2BR apartment with uninterrupted Arabian Gulf views, a full balcony spanning the living area, and beach access within 30 seconds.',                 2, 2, 4, 1450, 'sea_view',    true, true,  false, 'JBR Cluster 7',                    '25.078000', '55.134200', '780',  '980',  '170', 2, 30, '15:00', '11:00', 'moderate',       1, 'covered',  true),
  ('demo-prop-12', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'd4e5f6a7-b8c9-0123-def0-456789abcdef', 'active', 'villa',     'area-barsha',   'dubai', 'Barsha Pool Villa',              '3BR villa with private pool and garden',                'A warm family villa in Al Barsha — three en-suite bedrooms, a private pool, BBQ area, and a landscaped lawn. Great for long stays.',                   3, 3, 6, 2800, 'garden_view', true, false, true,  'Al Barsha 1, Block B',             '25.113500', '55.199200', '950',  '1200', '200', 3, 30, '16:00', '12:00', 'moderate',       2, 'covered',  true),
  ('demo-prop-13', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'd4e5f6a7-b8c9-0123-def0-456789abcdef', 'active', 'apartment', 'area-marina',   'dubai', 'Marina Smart Studio',            'Fully automated smart-home studio',                     'A modern studio for the tech-forward traveller — full smart-home automation, voice-controlled lighting, and a Peloton on request.',                   0, 1, 2, 480,  'city_view',   true, true,  false, 'Marina Gate',                      '25.080800', '55.140500', '300',  '390',  '85',  1, 30, '15:00', '12:00', 'flexible',       1, 'covered',  true),
  ('demo-prop-14', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'd4e5f6a7-b8c9-0123-def0-456789abcdef', 'active', 'apartment', 'area-downtown', 'dubai', 'Fountain View 1BR',              'Overlooking the Dubai Fountain',                        'A premium 1BR directly above the Dubai Fountain — catch the evening show from your balcony every night. Close to Dubai Mall.',                        1, 1, 2, 820,  'city_view',   true, true,  false, 'Burj Residences',                  '25.197500', '55.274000', '540',  '680',  '130', 2, 30, '15:00', '12:00', 'strict',         1, 'covered',  true),
  ('demo-prop-15', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'd4e5f6a7-b8c9-0123-def0-456789abcdef', 'active', 'villa',     'area-jbr',      'dubai', 'JBR Garden Villa',               'Beachside villa with lush garden',                      'A spacious family villa a short walk from JBR beach — five bedrooms, a private garden with fig trees, and a covered outdoor dining space.',           5, 4, 9, 4100, 'garden_view', true, false, true,  'JBR Private Garden Cluster',       '25.076500', '55.131500', '1700', '2200', '380', 3, 30, '16:00', '12:00', 'moderate',       3, 'covered',  true)
ON CONFLICT (id) DO NOTHING;

-- ══════════════════════════════════════════════════════
-- PHOTOS (cover + 2 gallery per property, Unsplash-hosted)
-- ══════════════════════════════════════════════════════

INSERT INTO st_property_photos (id, property_id, url, display_order, is_cover) VALUES
  -- 01 Marina Skyline Loft
  ('demo-photo-01-c', 'demo-prop-01', 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200&q=80', 0, true),
  ('demo-photo-01-a', 'demo-prop-01', 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200&q=80', 1, false),
  ('demo-photo-01-b', 'demo-prop-01', 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&q=80', 2, false),

  -- 02 Burj View Residence
  ('demo-photo-02-c', 'demo-prop-02', 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200&q=80', 0, true),
  ('demo-photo-02-a', 'demo-prop-02', 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=1200&q=80', 1, false),
  ('demo-photo-02-b', 'demo-prop-02', 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1200&q=80', 2, false),

  -- 03 Al Barsha Family Villa
  ('demo-photo-03-c', 'demo-prop-03', 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&q=80', 0, true),
  ('demo-photo-03-a', 'demo-prop-03', 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1200&q=80', 1, false),
  ('demo-photo-03-b', 'demo-prop-03', 'https://images.unsplash.com/photo-1540518614846-7eded433c457?w=1200&q=80', 2, false),

  -- 04 JBR Beach Studio
  ('demo-photo-04-c', 'demo-prop-04', 'https://images.unsplash.com/photo-1615529182904-14819c35db37?w=1200&q=80', 0, true),
  ('demo-photo-04-a', 'demo-prop-04', 'https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?w=1200&q=80', 1, false),
  ('demo-photo-04-b', 'demo-prop-04', 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=1200&q=80', 2, false),

  -- 05 Marina Harbour Suite
  ('demo-photo-05-c', 'demo-prop-05', 'https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?w=1200&q=80', 0, true),
  ('demo-photo-05-a', 'demo-prop-05', 'https://images.unsplash.com/photo-1556912172-45b7abe8b7d1?w=1200&q=80', 1, false),
  ('demo-photo-05-b', 'demo-prop-05', 'https://images.unsplash.com/photo-1571508601891-ca5e7a713859?w=1200&q=80', 2, false),

  -- 06 Old Town Heritage Flat
  ('demo-photo-06-c', 'demo-prop-06', 'https://images.unsplash.com/photo-1599809275671-b5942cabc7a2?w=1200&q=80', 0, true),
  ('demo-photo-06-a', 'demo-prop-06', 'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=1200&q=80', 1, false),
  ('demo-photo-06-b', 'demo-prop-06', 'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=1200&q=80', 2, false),

  -- 07 Beachfront Villa JBR
  ('demo-photo-07-c', 'demo-prop-07', 'https://images.unsplash.com/photo-1416331108676-a22ccb276e35?w=1200&q=80', 0, true),
  ('demo-photo-07-a', 'demo-prop-07', 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&q=80', 1, false),
  ('demo-photo-07-b', 'demo-prop-07', 'https://images.unsplash.com/photo-1540518614846-7eded433c457?w=1200&q=80', 2, false),

  -- 08 Al Barsha Cozy 1BR
  ('demo-photo-08-c', 'demo-prop-08', 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=1200&q=80', 0, true),
  ('demo-photo-08-a', 'demo-prop-08', 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200&q=80', 1, false),
  ('demo-photo-08-b', 'demo-prop-08', 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&q=80', 2, false),

  -- 09 Marina Walk Penthouse
  ('demo-photo-09-c', 'demo-prop-09', 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200&q=80', 0, true),
  ('demo-photo-09-a', 'demo-prop-09', 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200&q=80', 1, false),
  ('demo-photo-09-b', 'demo-prop-09', 'https://images.unsplash.com/photo-1615529182904-14819c35db37?w=1200&q=80', 2, false),

  -- 10 Downtown Designer 2BR
  ('demo-photo-10-c', 'demo-prop-10', 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1200&q=80', 0, true),
  ('demo-photo-10-a', 'demo-prop-10', 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=1200&q=80', 1, false),
  ('demo-photo-10-b', 'demo-prop-10', 'https://images.unsplash.com/photo-1571508601891-ca5e7a713859?w=1200&q=80', 2, false),

  -- 11 JBR Ocean View Apartment
  ('demo-photo-11-c', 'demo-prop-11', 'https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?w=1200&q=80', 0, true),
  ('demo-photo-11-a', 'demo-prop-11', 'https://images.unsplash.com/photo-1416331108676-a22ccb276e35?w=1200&q=80', 1, false),
  ('demo-photo-11-b', 'demo-prop-11', 'https://images.unsplash.com/photo-1556912172-45b7abe8b7d1?w=1200&q=80', 2, false),

  -- 12 Barsha Pool Villa
  ('demo-photo-12-c', 'demo-prop-12', 'https://images.unsplash.com/photo-1540518614846-7eded433c457?w=1200&q=80', 0, true),
  ('demo-photo-12-a', 'demo-prop-12', 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&q=80', 1, false),
  ('demo-photo-12-b', 'demo-prop-12', 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1200&q=80', 2, false),

  -- 13 Marina Smart Studio
  ('demo-photo-13-c', 'demo-prop-13', 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1200&q=80', 0, true),
  ('demo-photo-13-a', 'demo-prop-13', 'https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?w=1200&q=80', 1, false),
  ('demo-photo-13-b', 'demo-prop-13', 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200&q=80', 2, false),

  -- 14 Fountain View 1BR
  ('demo-photo-14-c', 'demo-prop-14', 'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=1200&q=80', 0, true),
  ('demo-photo-14-a', 'demo-prop-14', 'https://images.unsplash.com/photo-1599809275671-b5942cabc7a2?w=1200&q=80', 1, false),
  ('demo-photo-14-b', 'demo-prop-14', 'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=1200&q=80', 2, false),

  -- 15 JBR Garden Villa
  ('demo-photo-15-c', 'demo-prop-15', 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&q=80', 0, true),
  ('demo-photo-15-a', 'demo-prop-15', 'https://images.unsplash.com/photo-1416331108676-a22ccb276e35?w=1200&q=80', 1, false),
  ('demo-photo-15-b', 'demo-prop-15', 'https://images.unsplash.com/photo-1540518614846-7eded433c457?w=1200&q=80', 2, false)
ON CONFLICT (id) DO NOTHING;

-- ══════════════════════════════════════════════════════
-- BOOKINGS (2 per property → 30 demo bookings, all completed)
-- Needed so we can attach reviews (st_reviews.booking_id NOT NULL, UNIQUE)
-- ══════════════════════════════════════════════════════

INSERT INTO st_bookings (
  id, property_id, pm_user_id, guest_user_id, guest_name, guest_email,
  status, payment_status,
  check_in_date, check_out_date, number_of_guests,
  total_nights, weekday_nights, weekend_nights,
  nightly_rate, weekend_rate, cleaning_fee,
  subtotal, total_amount,
  completed_at, confirmed_at
)
SELECT
  'demo-bk-' || lpad(p.n::text, 2, '0') || '-' || b.i,
  'demo-prop-' || lpad(p.n::text, 2, '0'),
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'guest-001',
  'James Wilson',
  'guest@nestquest.com',
  'completed',
  'paid',
  (NOW() - ((b.offset_days + p.n * 2) || ' days')::interval)::date,
  (NOW() - ((b.offset_days + p.n * 2 - 3) || ' days')::interval)::date,
  2,
  3, 2, 1,
  '500', '600', '120',
  '1720', '1720',
  NOW() - ((b.offset_days + p.n * 2 - 4) || ' days')::interval,
  NOW() - ((b.offset_days + p.n * 2 + 5) || ' days')::interval
FROM generate_series(1, 15) AS p(n)
CROSS JOIN (VALUES ('a', 30), ('b', 60)) AS b(i, offset_days)
ON CONFLICT (id) DO NOTHING;

-- ══════════════════════════════════════════════════════
-- REVIEWS (one per booking → 30 reviews, ratings 4–5)
-- ══════════════════════════════════════════════════════

INSERT INTO st_reviews (id, booking_id, property_id, guest_user_id, rating, title, description)
SELECT
  'demo-rev-' || substring(b.id from 9),  -- demo-rev-01-a etc.
  b.id,
  b.property_id,
  b.guest_user_id,
  CASE WHEN right(b.id, 1) = 'a' THEN 5 ELSE 4 END,
  CASE right(b.id, 1)
    WHEN 'a' THEN 'Exceptional stay — would return in a heartbeat'
    ELSE 'Great location, comfortable apartment'
  END,
  CASE right(b.id, 1)
    WHEN 'a' THEN 'The host was incredibly responsive and the place was spotless. Everything from check-in to check-out felt effortless. Highly recommend.'
    ELSE 'Spacious, clean, and well-located. A couple of minor quirks with the appliances but nothing that affected the stay. Would book again.'
  END
FROM st_bookings b
WHERE b.id LIKE 'demo-bk-%'
ON CONFLICT (id) DO NOTHING;

COMMIT;

SELECT
  (SELECT COUNT(*) FROM st_properties     WHERE id LIKE 'demo-prop-%') AS properties,
  (SELECT COUNT(*) FROM st_property_photos WHERE id LIKE 'demo-photo-%') AS photos,
  (SELECT COUNT(*) FROM st_bookings        WHERE id LIKE 'demo-bk-%')    AS bookings,
  (SELECT COUNT(*) FROM st_reviews         WHERE id LIKE 'demo-rev-%')   AS reviews;
