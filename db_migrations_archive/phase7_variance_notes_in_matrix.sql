-- ── Phase 7 Migration: Variance Notes in Version Comparison RPCs ────────────
-- Adds variance_note columns to both comparison RPCs via LEFT JOIN.
-- No schema changes — only RPC function body updates.
-- Execute both CREATE OR REPLACE statements in Supabase SQL Editor.

-- ── 1. compare_estimate_versions: add variance_note_b ──────────────────────
-- Shows the Version B (newer) variance note for each cost code pair.
-- F2 fix: IS NOT NULL guard prevents phantom matches on NULL cost codes.
-- F4 fix: RETURNS TABLE signature includes the new column.

CREATE OR REPLACE FUNCTION public.compare_estimate_versions(
  p_project_id uuid,
  p_version_a_id uuid,
  p_version_b_id uuid
) RETURNS TABLE (
  cost_code text,
  cost_type text,
  description text,
  old_amount numeric,
  new_amount numeric,
  delta_amount numeric,
  variance_note_b text
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT has_project_permission(p_project_id, 'can_view_project') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM project_estimate_versions WHERE id = p_version_a_id AND project_id = p_project_id) OR
     NOT EXISTS (SELECT 1 FROM project_estimate_versions WHERE id = p_version_b_id AND project_id = p_project_id) THEN
    RAISE EXCEPTION 'One or both versions do not belong to the specified project.';
  END IF;

  RETURN QUERY
  SELECT 
    COALESCE(a.cost_code, b.cost_code) as cost_code,
    COALESCE(a.cost_type, b.cost_type) as cost_type,
    COALESCE(b.description, a.description) as description,
    COALESCE(a.budget_amount, 0) as old_amount,
    COALESCE(b.budget_amount, 0) as new_amount,
    COALESCE(b.budget_amount, 0) - COALESCE(a.budget_amount, 0) as delta_amount,
    evn.variance_note as variance_note_b
  FROM 
    (SELECT e.cost_code, e.cost_type, MAX(e.description) as description, SUM(e.budget_amount) as budget_amount 
     FROM project_estimates e WHERE e.version_id = p_version_a_id 
     GROUP BY e.cost_code, e.cost_type) a
  FULL OUTER JOIN 
    (SELECT e.cost_code, e.cost_type, MAX(e.description) as description, SUM(e.budget_amount) as budget_amount 
     FROM project_estimates e WHERE e.version_id = p_version_b_id 
     GROUP BY e.cost_code, e.cost_type) b
  ON a.cost_code = b.cost_code AND a.cost_type = b.cost_type
  LEFT JOIN estimate_variance_notes evn
    ON evn.estimate_version_id = p_version_b_id
    AND evn.cost_code = COALESCE(a.cost_code, b.cost_code)
    AND COALESCE(a.cost_code, b.cost_code) IS NOT NULL
  ORDER BY cost_code ASC, cost_type ASC;
END;
$$;

-- ── 2. get_multi_version_matrix: add variance_note ─────────────────────────
-- Shows the variance note per (version_id, cost_code) pair.
-- F2 fix: e.cost_code IS NOT NULL guard on JOIN.
-- F4 fix: RETURNS TABLE signature includes the new column.

CREATE OR REPLACE FUNCTION public.get_multi_version_matrix(
  p_project_id  uuid,
  p_version_ids uuid[]
) RETURNS TABLE (
  cost_code      text,
  description    text,
  version_id     uuid,
  version_name   text,
  version_date   date,
  budget_amount  numeric,
  variance_note  text
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (is_platform_admin() OR get_user_project_role(p_project_id) IS NOT NULL) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(p_version_ids) AS vid
    WHERE NOT EXISTS (
      SELECT 1 FROM project_estimate_versions
      WHERE id = vid AND project_id = p_project_id
    )
  ) THEN
    RAISE EXCEPTION 'One or more versions do not belong to the specified project.';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(e.cost_code, 'Unassigned')::text  AS cost_code,
    MAX(e.description)::text                   AS description,
    v.id                                        AS version_id,
    v.version_name::text                        AS version_name,
    v.version_date                              AS version_date,
    SUM(e.budget_amount)                        AS budget_amount,
    MAX(evn.variance_note)::text                AS variance_note
  FROM project_estimates e
  JOIN project_estimate_versions v ON v.id = e.version_id
  LEFT JOIN estimate_variance_notes evn
    ON evn.estimate_version_id = v.id
    AND evn.cost_code = e.cost_code
    AND e.cost_code IS NOT NULL
  WHERE v.id = ANY(p_version_ids)
    AND v.project_id = p_project_id
  GROUP BY e.cost_code, v.id, v.version_name, v.version_date
  ORDER BY cost_code ASC, v.version_date ASC, v.id ASC;
END;
$$;
