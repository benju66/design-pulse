-- =============================================================
-- Migration: Add Not Applicable & In Drafting Coordination Statuses
-- Date: 2026-05-22
-- Purpose: Drop the existing check constraint on opportunities.coordination_status
--          and recreate it including 'In Drafting' and 'Not Applicable'.
-- =============================================================

BEGIN;

ALTER TABLE opportunities DROP CONSTRAINT IF EXISTS chk_opportunities_coordination_status;

ALTER TABLE opportunities
  ADD CONSTRAINT chk_opportunities_coordination_status
  CHECK (coordination_status IS NULL OR coordination_status IN (
    'Not Required',
    'Draft',
    'In Drafting',
    'Pending Plan Update',
    'Ready for Review',
    'Implemented',
    'Not Applicable'
  ));

COMMIT;
