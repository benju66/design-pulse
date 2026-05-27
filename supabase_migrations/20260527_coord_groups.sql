-- Migration: Coordination Groups
-- 1. Adds coord_group_id column to opportunities for group assignment.
-- 2. Adds coord_groups JSONB column to project_settings for group definitions.

ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS coord_group_id text DEFAULT NULL;

-- Optional index for filtering by group in large projects
CREATE INDEX IF NOT EXISTS idx_opportunities_coord_group_id
  ON opportunities (coord_group_id)
  WHERE coord_group_id IS NOT NULL;

-- Group definitions stored as JSONB array in project_settings
ALTER TABLE project_settings
  ADD COLUMN IF NOT EXISTS coord_groups jsonb DEFAULT '[]'::jsonb;
