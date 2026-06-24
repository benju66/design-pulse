-- Migration: 20260624_get_client_lessons.sql
-- Description: Surfaces a client's lessons learned across all of its projects.
--   * Auto-stamps project_lessons.client_id from the owning project on insert (snapshot
--     semantics — the client the lesson was learned under), backfills existing rows, and
--     indexes the column for a future cross-project global lessons table.
--   * Adds get_client_lessons(p_client_id) — a SECURITY DEFINER rollup that joins each
--     lesson to its project and returns the project name, gated like
--     get_client_projects_metrics (platform admin OR a member of one of the client's projects).
--
-- NOTE: The client-profile feature itself routes lesson -> project -> projects.client_id,
-- so it works for all existing rows regardless of the backfill. The client_id column is
-- denormalized purely as future-proofing for the planned global lessons table.

-- 1. Auto-stamp client_id from the owning project (snapshot at authoring time).
--    COALESCE lets an explicitly-provided client_id win; otherwise we derive it.
CREATE OR REPLACE FUNCTION set_lesson_client_id()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.client_id := COALESCE(
    NEW.client_id,
    (SELECT p.client_id FROM projects p WHERE p.id = NEW.project_id)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_lesson_client_id ON project_lessons;
CREATE TRIGGER set_lesson_client_id BEFORE INSERT ON project_lessons
FOR EACH ROW EXECUTE FUNCTION set_lesson_client_id();

-- 2. Backfill existing lessons from their project's current client.
UPDATE project_lessons pl
SET client_id = p.client_id
FROM projects p
WHERE pl.project_id = p.id
  AND pl.client_id IS NULL
  AND p.client_id IS NOT NULL;

-- 3. Index for client-scoped lookups (future global table).
CREATE INDEX IF NOT EXISTS idx_project_lessons_client_id
  ON project_lessons(client_id) WHERE client_id IS NOT NULL;

-- 4. RPC: get_client_lessons (rollup across a client's projects).
--    Mirrors get_client_projects_metrics: pre-computed access, SECURITY DEFINER, RBAC gate.
--    Returns the lesson's rich text fields too, so the client-side read-only detail
--    panel can render full content without a per-row (RLS-blocked) refetch.
DROP FUNCTION IF EXISTS get_client_lessons(uuid);
CREATE OR REPLACE FUNCTION get_client_lessons(p_client_id uuid)
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
  created_at     timestamptz
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_is_admin boolean;
  v_accessible_ids uuid[];
BEGIN
  v_is_admin := public.is_platform_admin();

  -- Pre-compute accessible project IDs once (Q2: eliminates N per-row calls)
  IF NOT v_is_admin THEN
    SELECT array_agg(pm.project_id) INTO v_accessible_ids
    FROM project_members pm WHERE pm.user_id = auth.uid();

    -- RBAC gate: user must have at least one project for this client
    IF NOT EXISTS (
      SELECT 1 FROM projects
      WHERE client_id = p_client_id AND id = ANY(COALESCE(v_accessible_ids, '{}'))
    ) THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;
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
    p.id AS project_id,
    p.name AS project_name,
    pl.created_at
  FROM project_lessons pl
  JOIN projects p ON p.id = pl.project_id
  WHERE p.client_id = p_client_id
    AND pl.is_deleted = false
    AND (v_is_admin OR p.id = ANY(COALESCE(v_accessible_ids, '{}')))
  ORDER BY pl.created_at DESC;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_client_lessons(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_client_lessons(uuid) TO authenticated;
