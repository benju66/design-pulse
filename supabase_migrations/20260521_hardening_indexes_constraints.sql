-- ============================================================
-- Migration: Hardening — Indexes, Constraints, RLS
-- Date: 2026-05-21
-- Purpose: Add missing indexes for performance, CHECK constraints
--          for state machine integrity, and RLS on project_sequences
-- ============================================================

BEGIN;

-- ============================================================
-- 1. INDEXES — Core opportunity tables
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_opps_project_active
  ON opportunities(project_id)
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_opps_project_status
  ON opportunities(project_id, status)
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_opps_cost_code
  ON opportunities(cost_code)
  WHERE cost_code IS NOT NULL AND is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_options_opportunity
  ON opportunity_options(opportunity_id)
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_options_project_active
  ON opportunity_options(project_id)
  WHERE is_deleted = false;

-- ============================================================
-- 2. INDEXES — Supporting tables
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_members_user_id
  ON project_members(user_id);

CREATE INDEX IF NOT EXISTS idx_audit_project_id
  ON audit_logs(project_id);

CREATE INDEX IF NOT EXISTS idx_audit_record_id
  ON audit_logs(record_id);

CREATE INDEX IF NOT EXISTS idx_markups_sheet_id
  ON sheet_markups(sheet_id);

CREATE INDEX IF NOT EXISTS idx_markups_opportunity_id
  ON sheet_markups(opportunity_id)
  WHERE opportunity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_permits_project_active
  ON permits(project_id)
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_sheets_project_id
  ON project_sheets(project_id);

-- ============================================================
-- 3. CHECK CONSTRAINTS — State machine fields
-- NOTE: If existing data violates these constraints, the
--       transaction will fail. Run validation query first:
--   SELECT DISTINCT status FROM opportunities;
--   SELECT DISTINCT coordination_status FROM opportunities;
-- ============================================================

-- opportunities.status — Allowed values derived from:
--   - Schema default: 'Draft' (line 105)
--   - Frontend StatusCell dropdown: Draft, Pending Review, Approved, Rejected
--   - lock_opportunity_option RPC: sets status to 'Approved' (line 998)
--   - unlock_opportunity_option RPC: sets status to 'Draft' (line 906)
--   - return_opportunity RPC: sets status to 'Pending Review' (line 3362)
--   - Excel export metadata: Draft, Pending Plan Update, Ready for Review,
--     Implemented, Approved, Rejected (veMatrixExport.ts line 127)
--
-- NOTE: The Excel export includes 'Pending Plan Update', 'Ready for Review',
--       and 'Implemented' as status options, but these are actually
--       coordination_status values. The UI dropdowns only allow:
--       Draft, Pending Review, Approved, Rejected.
--       Adding them here defensively in case legacy data or imports used them.
ALTER TABLE opportunities
  ADD CONSTRAINT chk_opportunities_status
  CHECK (status IN (
    'Draft',
    'Pending Review',
    'Pending Plan Update',
    'Ready for Review',
    'Implemented',
    'Approved',
    'Rejected'
  ));

-- opportunities.coordination_status — Allowed values derived from:
--   - Schema default: NULL (line 106)
--   - Frontend CoordinationStatusCell: Not Required, Pending Plan Update,
--     Ready for Review, Implemented
--   - lock_opportunity_option RPC: 'Pending Plan Update' or 'Not Required'
--   - unlock_opportunity_option RPC: 'Draft' or 'Not Required'
--   - trg_auto_update_coordination_status_fn: transitions between
--     'Pending Plan Update' ↔ 'Ready for Review', recognizes 'Implemented'
--   - ExpandedCard "Begin Coordination": sets to 'Draft'
--   - return_opportunity RPC: 'Draft' or 'Not Required'
--
-- NULL is explicitly allowed as the column defaults to NULL.
ALTER TABLE opportunities
  ADD CONSTRAINT chk_opportunities_coordination_status
  CHECK (coordination_status IS NULL OR coordination_status IN (
    'Not Required',
    'Draft',
    'Pending Plan Update',
    'Ready for Review',
    'Implemented'
  ));

-- ============================================================
-- 4. RLS — project_sequences
-- ============================================================

ALTER TABLE project_sequences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sequences_select_project_members" ON project_sequences;
CREATE POLICY "sequences_select_project_members"
  ON project_sequences FOR SELECT
  USING (get_user_project_role(project_id) IS NOT NULL OR is_platform_admin());

DROP POLICY IF EXISTS "sequences_modify_project_admins" ON project_sequences;
CREATE POLICY "sequences_modify_project_admins"
  ON project_sequences FOR ALL
  USING (
    get_user_project_role(project_id) IN ('project_admin', 'gc_admin')
    OR is_platform_admin()
  );

COMMIT;
