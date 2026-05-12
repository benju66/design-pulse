
-- ============================================================
-- MASTER BUDGET LEDGER & FINANCIAL LIFECYCLE EXTENSIONS
-- ============================================================

ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS estimate_sync_status text DEFAULT 'Draft',
  ADD COLUMN IF NOT EXISTS incorporated_version_id uuid REFERENCES public.project_estimate_versions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS estimator_assignee text;

-- 3. Master Ledger Grid RPC
CREATE OR REPLACE FUNCTION public.get_master_ledger_grid(p_project_id UUID)
RETURNS TABLE (
  cost_code text,
  description text,
  old_budget numeric,
  new_budget numeric,
  locked_ve numeric,
  pending_ve numeric
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT public.has_project_permission(p_project_id, 'can_view_project') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  WITH active_budget AS (
    SELECT e.cost_code, MAX(e.description) as description, SUM(e.budget_amount) as amount
    FROM public.project_estimates e
    JOIN public.project_estimate_versions v ON e.version_id = v.id
    WHERE e.project_id = p_project_id AND v.is_active = true
    GROUP BY e.cost_code
  ),
  ve_impacts AS (
    SELECT o.cost_code,
      SUM(CASE WHEN o.status = 'Approved' THEN o.cost_impact ELSE 0 END) as locked_ve,
      SUM(CASE WHEN o.status != 'Approved' THEN o.cost_impact ELSE 0 END) as pending_ve
    FROM public.opportunities o
    WHERE o.project_id = p_project_id 
      AND o.is_deleted = false 
      AND o.incorporated_version_id IS NULL
    GROUP BY o.cost_code
  )
  SELECT 
    COALESCE(b.cost_code, v.cost_code) as cost_code,
    COALESCE(b.description, 'VE Item') as description,
    COALESCE(b.amount, 0) as old_budget,
    COALESCE(b.amount, 0) as new_budget,
    COALESCE(v.locked_ve, 0) as locked_ve,
    COALESCE(v.pending_ve, 0) as pending_ve
  FROM active_budget b
  FULL OUTER JOIN ve_impacts v ON b.cost_code = v.cost_code;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_master_ledger_grid(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_master_ledger_grid(uuid) TO authenticated;

-- 4. Waterfall Math Fix (Double-Count Prevention)
DROP FUNCTION IF EXISTS public.get_project_budget_waterfall(uuid);
CREATE OR REPLACE FUNCTION public.get_project_budget_waterfall(p_project_id UUID)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_baseline numeric := 0;
  v_ve_impact numeric := 0;
BEGIN
  IF NOT public.has_project_permission(p_project_id, 'can_view_project') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT COALESCE(total_budget, 0) INTO v_baseline
  FROM public.project_estimate_versions
  WHERE project_id = p_project_id AND is_active = true
  LIMIT 1;

  SELECT COALESCE(SUM(cost_impact), 0) INTO v_ve_impact
  FROM public.opportunities
  WHERE project_id = p_project_id 
    AND status = 'Approved' 
    AND is_deleted = false
    AND incorporated_version_id IS NULL;

  RETURN v_baseline + v_ve_impact;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_project_budget_waterfall(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_project_budget_waterfall(uuid) TO authenticated;

-- 5. True-Up Escape Hatch
CREATE OR REPLACE FUNCTION public.reconcile_and_incorporate_opportunity(
  p_opp_id UUID, 
  p_version_id UUID, 
  p_realized_cost numeric, 
  p_note text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_project_id uuid;
BEGIN
  SELECT project_id INTO v_project_id FROM public.opportunities WHERE id = p_opp_id;
  
  IF NOT public.has_project_permission(v_project_id, 'can_manage_budget') THEN
    RAISE EXCEPTION 'Unauthorized: Insufficient privileges';
  END IF;

  -- B5 Guardrail: Escape hatch after RBAC, before UPDATE
  PERFORM set_config('designpulse.bypass_immutability', 'true', true);

  UPDATE public.opportunities
  SET 
    cost_impact = p_realized_cost,
    estimate_sync_status = 'Incorporated',
    incorporated_version_id = p_version_id,
    final_direction = final_direction || ' | Reconciled: ' || p_note
  WHERE id = p_opp_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.reconcile_and_incorporate_opportunity(uuid, uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reconcile_and_incorporate_opportunity(uuid, uuid, numeric, text) TO authenticated;

-- 6. Atomic Linking: Finalize Estimate Version
CREATE OR REPLACE FUNCTION public.finalize_estimate_version(
  p_version_id UUID, 
  p_incorporated_ve_ids UUID[] DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_project_id uuid;
  v_total_amount numeric;
BEGIN
  SELECT project_id INTO v_project_id FROM public.project_estimate_versions WHERE id = p_version_id;
  
  IF NOT public.has_project_permission(v_project_id, 'can_manage_budget') THEN
    RAISE EXCEPTION 'Unauthorized: Insufficient privileges';
  END IF;

  SELECT COALESCE(SUM(budget_amount), 0) INTO v_total_amount 
  FROM public.project_estimates 
  WHERE version_id = p_version_id;

  UPDATE public.project_estimate_versions 
  SET is_finalized = true, total_budget = v_total_amount
  WHERE id = p_version_id;

  IF p_incorporated_ve_ids IS NOT NULL AND array_length(p_incorporated_ve_ids, 1) > 0 THEN
    -- B5 Guardrail required if we are modifying locked items
    PERFORM set_config('designpulse.bypass_immutability', 'true', true);

    UPDATE public.opportunities 
    SET 
      estimate_sync_status = 'Incorporated',
      incorporated_version_id = p_version_id
    WHERE id = ANY(p_incorporated_ve_ids) AND project_id = v_project_id;
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.finalize_estimate_version(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_estimate_version(uuid, uuid[]) TO authenticated;
