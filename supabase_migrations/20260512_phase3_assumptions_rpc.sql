-- ============================================================
-- Phase 3: Budget Detail Panel — update_estimate_assumptions RPC
-- Audit Fix #1: Bypasses project_estimates can_edit_project_settings RLS
-- and checks can_edit_records instead, allowing design_team users to
-- edit item_assumptions without granting broad write access.
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_estimate_assumptions(
  p_project_id  UUID,
  p_cost_code   TEXT,
  p_assumptions TEXT  -- NULL to clear
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_active_version_id uuid;
BEGIN
  -- RBAC: can_edit_records (not can_edit_project_settings)
  IF NOT public.has_project_permission(p_project_id, 'can_edit_records') THEN
    RAISE EXCEPTION 'Unauthorized: Insufficient privileges to edit assumptions';
  END IF;

  -- Find the active version
  SELECT id INTO v_active_version_id
  FROM public.project_estimate_versions
  WHERE project_id = p_project_id AND is_active = true
  LIMIT 1;

  IF v_active_version_id IS NULL THEN
    RAISE EXCEPTION 'No active estimate version found for this project';
  END IF;

  -- Batch-update all lines matching this cost code in the active version
  UPDATE public.project_estimates
  SET item_assumptions = p_assumptions
  WHERE version_id = v_active_version_id
    AND cost_code = p_cost_code
    AND project_id = p_project_id;
END;
$$;

-- Restrict to authenticated users only (AGENTS.md B)
REVOKE EXECUTE ON FUNCTION public.update_estimate_assumptions(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_estimate_assumptions(uuid, text, text) TO authenticated;
