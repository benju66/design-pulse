-- ============================================================
-- Rosetta Stone Phase 4: ML Flywheel Schema Supplement
-- Run AFTER 20260430_rosetta_stone_phase1.sql
-- ============================================================

-- 1. Add latest_raw_csi_number column to store the original,
--    unstripped CSI string (e.g. "09 65 16.13") alongside the
--    normalized key. The column is nullable for backward compat
--    with rows already written by the Phase 1 trigger.
ALTER TABLE global_csi_training_data
ADD COLUMN IF NOT EXISTS latest_raw_csi_number text;

-- 2. Replace the Phase 1 trigger function so it also persists
--    the human-readable csi_number from project_csi_specs.
--    The function is SECURITY DEFINER so it can bypass the
--    "Only admins can modify" RLS policy that would otherwise
--    block the trigger execution under the row owner's JWT.
CREATE OR REPLACE FUNCTION upsert_global_csi_training_data()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.cost_code IS NOT NULL THEN
    INSERT INTO global_csi_training_data (
      normalized_csi_number,
      global_cost_code_id,
      latest_description,
      latest_raw_csi_number,
      match_count,
      last_seen_at
    )
    VALUES (
      NEW.normalized_csi_number,
      NEW.cost_code,
      NEW.description,
      NEW.csi_number,          -- raw human-readable CSI number
      1,
      timezone('utc'::text, now())
    )
    ON CONFLICT (normalized_csi_number, global_cost_code_id)
    DO UPDATE SET
      match_count            = global_csi_training_data.match_count + 1,
      latest_description     = EXCLUDED.latest_description,
      latest_raw_csi_number  = EXCLUDED.latest_raw_csi_number,
      last_seen_at           = EXCLUDED.last_seen_at;
    -- NOTE: is_admin_verified is intentionally NOT reset here so
    -- an admin-verified mapping stays verified even after new project
    -- data arrives that agrees with the existing mapping.
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger remains the same — recreating ensures the updated
-- function body is picked up without dropping dependencies.
DROP TRIGGER IF EXISTS trg_upsert_global_csi_training_data ON project_csi_specs;
CREATE TRIGGER trg_upsert_global_csi_training_data
AFTER INSERT OR UPDATE OF cost_code ON project_csi_specs
FOR EACH ROW EXECUTE FUNCTION upsert_global_csi_training_data();


-- 3. Admin RPC: Atomically remap a CSI entry to a different
--    base cost code. Because global_cost_code_id is part of
--    the composite PK, a remap is a DELETE + INSERT — not an
--    UPDATE. This RPC wraps both ops in a single transaction.
--
--    Security: Caller identity check via is_platform_admin()
--    prevents escalation even if the function is somehow called
--    from an unexpected context.
CREATE OR REPLACE FUNCTION remap_global_csi_entry(
  p_normalized_csi_number  text,
  p_old_cost_code          text,
  p_new_cost_code          text,
  p_description            text,
  p_raw_csi_number         text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_existing_count  integer;
  v_match_count     integer := 1;
BEGIN
  -- Explicit admin guard (belt & suspenders alongside RLS)
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'remap_global_csi_entry: permission denied — platform admin required';
  END IF;

  -- Inherit match_count from the row being replaced so
  -- crowd-sourced frequency signal is preserved.
  SELECT match_count INTO v_match_count
  FROM global_csi_training_data
  WHERE normalized_csi_number = p_normalized_csi_number
    AND global_cost_code_id   = p_old_cost_code;

  IF v_match_count IS NULL THEN
    v_match_count := 1;
  END IF;

  -- Remove the old composite-PK row
  DELETE FROM global_csi_training_data
  WHERE normalized_csi_number = p_normalized_csi_number
    AND global_cost_code_id   = p_old_cost_code;

  -- Insert under the new cost code (admin verified = true)
  INSERT INTO global_csi_training_data (
    normalized_csi_number,
    global_cost_code_id,
    latest_description,
    latest_raw_csi_number,
    match_count,
    is_admin_verified,
    last_seen_at
  )
  VALUES (
    p_normalized_csi_number,
    p_new_cost_code,
    p_description,
    p_raw_csi_number,
    v_match_count,
    true,
    now()
  )
  ON CONFLICT (normalized_csi_number, global_cost_code_id)
  DO UPDATE SET
    latest_description    = EXCLUDED.latest_description,
    latest_raw_csi_number = EXCLUDED.latest_raw_csi_number,
    is_admin_verified     = true,
    last_seen_at          = now();
END;
$$;

-- Grant execute to authenticated role only (called from client
-- with user JWT). Service role already has full bypass.
GRANT EXECUTE ON FUNCTION remap_global_csi_entry(text, text, text, text, text)
  TO authenticated;
