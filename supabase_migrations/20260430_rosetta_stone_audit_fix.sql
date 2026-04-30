-- ============================================================
-- Rosetta Stone Audit Fix: cascade_csi_spec_update SECURITY DEFINER
-- Addresses: C-2 from enterprise audit (2026-04-30)
-- Run AFTER 20260430_rosetta_stone_phase1.sql
-- ============================================================

-- The original cascade_csi_spec_update trigger was created WITHOUT
-- SECURITY DEFINER. This means it executed under the calling user's
-- JWT and was therefore blocked by the `opportunities` RLS policy
-- when invoked by users without `can_edit_records` permissions.
--
-- A design_team user mapping a CSI spec would update `project_csi_specs`
-- correctly, but the cascade UPDATE to linked `opportunities` and
-- `opportunity_options` would silently fail — leaving orphaned cost_codes
-- on the parent records.
--
-- SECURITY DEFINER elevates execution to the function owner (postgres),
-- bypassing RLS on the UPDATE targets while the AFTER trigger still fires
-- in the same transaction — ensuring the bypass_immutability escape hatch
-- remains effective.

CREATE OR REPLACE FUNCTION cascade_csi_spec_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.cost_code IS DISTINCT FROM OLD.cost_code THEN
    -- Bypass financial immutability lock for this transaction only.
    -- is_local = true scopes this to the current transaction.
    PERFORM set_config('designpulse.bypass_immutability', 'true', true);

    UPDATE opportunities
    SET cost_code = NEW.cost_code
    WHERE spec_number_id = NEW.id;

    UPDATE opportunity_options
    SET cost_code = NEW.cost_code
    WHERE spec_number_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- The trigger declaration is unchanged — recreating it is safe because
-- DROP/CREATE TRIGGER is idempotent via the IF EXISTS guard.
DROP TRIGGER IF EXISTS trg_cascade_csi_spec_update ON project_csi_specs;
CREATE TRIGGER trg_cascade_csi_spec_update
AFTER UPDATE OF cost_code ON project_csi_specs
FOR EACH ROW EXECUTE FUNCTION cascade_csi_spec_update();
