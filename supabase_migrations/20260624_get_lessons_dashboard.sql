-- Migration: 20260624_get_lessons_dashboard.sql
-- Description: Cross-project lessons-learned rollup for the main dashboard.
--   get_lessons_dashboard() returns every lesson the caller may see — platform admins
--   see all non-deleted lessons; everyone else sees lessons from their member projects.
--   Each row carries its project name and (snapshot) client name for the dashboard table.
--   Mirrors the access model of get_client_lessons / get_client_projects_metrics, minus the
--   single-client filter, and does NOT raise on empty (a member with no lessons just sees none).

CREATE OR REPLACE FUNCTION get_lessons_dashboard()
RETURNS TABLE (
  id             uuid,
  display_id     text,
  title          text,
  category       text,
  severity       text,
  phase          text,
  status         text,
  cost_code      text,
  what_happened  text,
  root_cause     text,
  recommendation text,
  project_id     uuid,
  project_name   text,
  client_id      uuid,
  client_name    text,
  created_at     timestamptz
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_is_admin boolean;
  v_accessible_ids uuid[];
BEGIN
  v_is_admin := public.is_platform_admin();

  IF NOT v_is_admin THEN
    SELECT array_agg(pm.project_id) INTO v_accessible_ids
    FROM project_members pm WHERE pm.user_id = auth.uid();
  END IF;

  RETURN QUERY
  SELECT
    pl.id,
    pl.display_id,
    pl.title,
    pl.category,
    pl.severity,
    pl.phase,
    pl.status,
    pl.cost_code,
    pl.what_happened,
    pl.root_cause,
    pl.recommendation,
    p.id   AS project_id,
    p.name AS project_name,
    c.id   AS client_id,
    c.name AS client_name,
    pl.created_at
  FROM project_lessons pl
  JOIN projects p ON p.id = pl.project_id
  LEFT JOIN clients c ON c.id = p.client_id
  WHERE pl.is_deleted = false
    AND (v_is_admin OR p.id = ANY(COALESCE(v_accessible_ids, '{}')))
  ORDER BY pl.created_at DESC;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_lessons_dashboard() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_lessons_dashboard() TO authenticated;
