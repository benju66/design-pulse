-- Migration: 20260429_bulk_import_rpc.sql
-- Description: Creates the bulk_import_coordination_tasks RPC with JSONB array safety

CREATE OR REPLACE FUNCTION bulk_import_coordination_tasks(p_project_id UUID, p_payload JSONB)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- 1. Security Guardrail: RBAC check
  IF NOT public.has_project_permission(p_project_id, 'can_edit_records') THEN
    RAISE EXCEPTION 'Unauthorized: Insufficient privileges to import coordination tasks';
  END IF;

  -- 2. JSONB Guardrail: Ensure payload is strictly an array to prevent transaction aborts
  IF jsonb_typeof(p_payload) = 'array' THEN
    -- 3. Atomic Batch Insert
    INSERT INTO opportunities (
      id,
      project_id,
      title,
      description,
      priority,
      building_area,
      cost_code,
      coordination_details,
      record_type,
      status,
      coordination_status
    )
    SELECT
      (val->>'id')::uuid,
      p_project_id,
      val->>'title',
      val->>'description',
      val->>'priority',
      val->>'building_area',
      val->>'cost_code',
      COALESCE(val->'coordination_details', '{}'::jsonb),
      'Coordination',
      'Draft',
      'Draft'
    FROM jsonb_array_elements(p_payload) AS val;
  ELSE
    RAISE EXCEPTION 'Invalid Payload: Expected a JSON array of tasks.';
  END IF;
END;
$$;
