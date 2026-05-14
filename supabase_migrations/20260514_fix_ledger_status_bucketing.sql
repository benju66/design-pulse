-- Migration: Fix status bucketing in get_master_ledger_grid
-- Rejected items should have zero financial weight (not inflate pending_ve)
-- Aligns status classification with get_project_budget_waterfall

CREATE OR REPLACE FUNCTION public.get_master_ledger_grid(p_project_id UUID)
RETURNS TABLE (
  cost_code text,
  csi_division text,
  description text,
  old_budget numeric,
  new_budget numeric,
  locked_ve numeric,
  pending_ve numeric,
  revised_budget numeric,
  projected_final numeric
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
      SUM(CASE WHEN o.status IN ('Approved', 'Pending Plan Update', 'Implemented') THEN o.cost_impact ELSE 0 END) as locked_ve,
      SUM(CASE WHEN o.status IN ('Draft', 'Pending Review', 'Pending') THEN o.cost_impact ELSE 0 END) as pending_ve
    FROM public.opportunities o
    WHERE o.project_id = p_project_id
      AND o.is_deleted = false
      AND o.incorporated_version_id IS NULL
      AND o.cost_code IS NOT NULL AND o.cost_code != ''
    GROUP BY o.cost_code
  )
  SELECT
    COALESCE(b.cost_code, v.cost_code) as cost_code,
    LEFT(LPAD(SPLIT_PART(COALESCE(b.cost_code, v.cost_code), '.', 1), 6, '0'), 2) as csi_division,
    COALESCE(b.description, 'VE Item') as description,
    COALESCE(b.amount, 0) as old_budget,
    COALESCE(b.amount, 0) as new_budget,
    COALESCE(v.locked_ve, 0) as locked_ve,
    COALESCE(v.pending_ve, 0) as pending_ve,
    COALESCE(b.amount, 0) + COALESCE(v.locked_ve, 0) as revised_budget,
    COALESCE(b.amount, 0) + COALESCE(v.locked_ve, 0) + COALESCE(v.pending_ve, 0) as projected_final
  FROM active_budget b
  FULL OUTER JOIN ve_impacts v ON b.cost_code = v.cost_code;
END;
$$;

-- CRITICAL: Re-apply privilege restrictions (AGENTS.md B2)
REVOKE EXECUTE ON FUNCTION public.get_master_ledger_grid(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_master_ledger_grid(uuid) TO authenticated;
