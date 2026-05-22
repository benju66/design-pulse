-- =============================================================
-- Migration: Prevent Double-Lock Race Condition
-- Date: 2026-05-22
-- Sprint: 2 — Data Integrity (C-10)
-- Purpose: Add a partial unique index so only ONE contender per
--          opportunity can have is_locked = true at any time.
-- Rollback: DROP INDEX IF EXISTS idx_one_locked_option_per_opportunity;
-- =============================================================

BEGIN;

-- Pre-flight: Fix any existing double-locks before adding the constraint.
-- Keeps the most recently updated locked option; unlocks the rest.
WITH dupes AS (
  SELECT id, opportunity_id,
    ROW_NUMBER() OVER (
      PARTITION BY opportunity_id
      ORDER BY updated_at DESC
    ) AS rn
  FROM opportunity_options
  WHERE is_locked = true AND is_deleted = false
)
UPDATE opportunity_options SET is_locked = false
WHERE id IN (SELECT id FROM dupes WHERE rn > 1);

-- Enforce: exactly one locked option per opportunity.
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_locked_option_per_opportunity
  ON opportunity_options(opportunity_id)
  WHERE is_locked = true AND is_deleted = false;

COMMIT;
