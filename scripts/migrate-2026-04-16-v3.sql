-- Migration: 2026-04-16 v3 — Ensure cleaning_* tables exist
-- These tables are queried by /api/cleaners/* routes (checklists, tasks,
-- automation-rules, etc.) but were never added to the Drizzle schema or
-- previous migrations. Without them, every cleaner API endpoint 500s.
-- Run: psql "$DATABASE_URL" -f scripts/migrate-2026-04-16-v3.sql

BEGIN;

CREATE TABLE IF NOT EXISTS cleaning_checklists (
  id character varying(36) PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  property_id character varying(36) REFERENCES st_properties(id) ON DELETE CASCADE,
  pm_user_id character varying(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cleaning_checklists_pm ON cleaning_checklists (pm_user_id);
CREATE INDEX IF NOT EXISTS idx_cleaning_checklists_property ON cleaning_checklists (property_id);

CREATE TABLE IF NOT EXISTS cleaning_checklist_items (
  id character varying(36) PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  checklist_id character varying(36) NOT NULL REFERENCES cleaning_checklists(id) ON DELETE CASCADE,
  label text NOT NULL,
  display_order integer DEFAULT 0,
  created_at timestamp without time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cleaning_checklist_items_checklist ON cleaning_checklist_items (checklist_id);

CREATE TABLE IF NOT EXISTS cleaning_tasks (
  id character varying(36) PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  property_id character varying(36) NOT NULL REFERENCES st_properties(id) ON DELETE CASCADE,
  pm_user_id character varying(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cleaner_user_id character varying(36) REFERENCES users(id) ON DELETE SET NULL,
  checklist_id character varying(36) REFERENCES cleaning_checklists(id) ON DELETE SET NULL,
  booking_id character varying(36) REFERENCES st_bookings(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  priority text DEFAULT 'normal',
  title text NOT NULL,
  notes text,
  due_at timestamp without time zone,
  started_at timestamp without time zone,
  completed_at timestamp without time zone,
  created_by character varying(36) REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cleaning_tasks_pm ON cleaning_tasks (pm_user_id);
CREATE INDEX IF NOT EXISTS idx_cleaning_tasks_cleaner ON cleaning_tasks (cleaner_user_id);
CREATE INDEX IF NOT EXISTS idx_cleaning_tasks_property ON cleaning_tasks (property_id);
CREATE INDEX IF NOT EXISTS idx_cleaning_tasks_status ON cleaning_tasks (status);

CREATE TABLE IF NOT EXISTS cleaning_task_items (
  id character varying(36) PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  task_id character varying(36) NOT NULL REFERENCES cleaning_tasks(id) ON DELETE CASCADE,
  label text NOT NULL,
  is_checked boolean NOT NULL DEFAULT false,
  notes text,
  image_url text,
  checked_at timestamp without time zone,
  display_order integer DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_cleaning_task_items_task ON cleaning_task_items (task_id);

CREATE TABLE IF NOT EXISTS cleaning_automation_rules (
  id character varying(36) PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  property_id character varying(36) NOT NULL REFERENCES st_properties(id) ON DELETE CASCADE,
  pm_user_id character varying(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  checklist_id character varying(36) NOT NULL REFERENCES cleaning_checklists(id) ON DELETE CASCADE,
  delay_minutes integer NOT NULL DEFAULT 30,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cleaning_auto_pm ON cleaning_automation_rules (pm_user_id);
CREATE INDEX IF NOT EXISTS idx_cleaning_auto_property ON cleaning_automation_rules (property_id);

COMMIT;

SELECT 'Migration 2026-04-16 v3 (cleaning_* tables) complete' AS status;
