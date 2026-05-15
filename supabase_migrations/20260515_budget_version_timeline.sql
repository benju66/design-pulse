-- ── RPC: get_budget_version_timeline ──────────────────────────────────────────
-- Returns one row per finalized estimate version for a project, with the
-- version's baseline budget and CURRENT locked/pending VE totals overlaid.
--
-- NOTE: VE values reflect the project's current opportunity status, NOT the
-- historical VE state at the time each version was created. This is by design —
-- the existing data model has no historical VE snapshots.
--
-- RBAC: Requires 'can_view_project' permission.
-- AGENTS.md compliance: B (SECURITY DEFINER + RBAC), C5 (server aggregation),
-- C11 (COALESCE null safety).

CREATE OR REPLACE FUNCTION public.get_budget_version_timeline(p_project_id UUID)
RETURNS TABLE (
  version_id    UUID,
  version_name  TEXT,
  version_date  DATE,
  baseline      NUMERIC,
  locked_ve     NUMERIC,
  pending_ve    NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_locked  NUMERIC;
  v_pending NUMERIC;
BEGIN
  -- RBAC check
  IF NOT public.has_project_permission(p_project_id, 'can_view_project') THEN
    RAISE EXCEPTION 'Unauthorized: insufficient permissions';
  END IF;

  -- Compute current VE totals (same status bucketing as get_project_budget_waterfall)
  SELECT
    COALESCE(SUM(CASE
      WHEN o.status IN ('Approved', 'Pending Plan Update', 'Implemented')
      THEN COALESCE(o.cost_impact, 0)
      ELSE 0
    END), 0),
    COALESCE(SUM(CASE
      WHEN o.status NOT IN ('Approved', 'Pending Plan Update', 'Implemented', 'Rejected', 'Deferred')
      THEN COALESCE(o.cost_impact, 0)
      ELSE 0
    END), 0)
  INTO v_locked, v_pending
  FROM opportunities o
  WHERE o.project_id = p_project_id;

  -- Return one row per finalized version, ordered by date
  RETURN QUERY
  SELECT
    pev.id            AS version_id,
    pev.version_name  AS version_name,
    pev.version_date  AS version_date,
    COALESCE(pev.total_budget, 0) AS baseline,
    v_locked          AS locked_ve,
    v_pending         AS pending_ve
  FROM project_estimate_versions pev
  WHERE pev.project_id = p_project_id
    AND pev.is_finalized = TRUE
  ORDER BY pev.version_date ASC, pev.created_at ASC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_budget_version_timeline(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_budget_version_timeline(UUID) TO authenticated;
