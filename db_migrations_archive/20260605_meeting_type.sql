-- Migration: Add meeting_type column to coordination items
-- Adds project-configurable meeting type tagging to coordination board items.

ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS meeting_type TEXT;

ALTER TABLE project_settings
  ADD COLUMN IF NOT EXISTS meeting_types JSONB DEFAULT '[]'::jsonb;
