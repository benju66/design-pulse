-- Migration: Fix Concurrent JSONB Updates (Race Conditions)
-- Creates specialized RPCs for safe delta merging on coordination fields

CREATE OR REPLACE FUNCTION update_coordination_details_delta(
  p_opp_id UUID,
  p_updates JSONB
) RETURNS opportunities LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_current JSONB;
  v_key TEXT;
  v_val JSONB;
  v_result opportunities;
BEGIN
  -- 1. Check permissions against RBAC
  IF NOT public.has_project_permission((SELECT project_id FROM opportunities WHERE id = p_opp_id), 'can_edit_records') THEN
    RAISE EXCEPTION 'Unauthorized: Insufficient privileges to edit coordination details';
  END IF;
  
  -- 2. Lock row and fetch current state
  SELECT COALESCE(coordination_details, '{}'::jsonb) INTO v_current 
  FROM opportunities WHERE id = p_opp_id FOR UPDATE;

  -- 3. Merge deltas
  FOR v_key, v_val IN SELECT key, value FROM jsonb_each(p_updates) LOOP
    IF v_key LIKE 'd_%' THEN
      -- It's a discipline (e.g., d_arch): Merge nested object
      v_current := jsonb_set(
        v_current, 
        ARRAY[v_key], 
        COALESCE(v_current->v_key, '{}'::jsonb) || v_val
      );
    ELSE
      -- Root level key (e.g., is_escalated): Overwrite value directly
      v_current := jsonb_set(v_current, ARRAY[v_key], v_val);
    END IF;
  END LOOP;

  -- 4. Save and return
  UPDATE opportunities 
  SET coordination_details = v_current 
  WHERE id = p_opp_id 
  RETURNING * INTO v_result;
  
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION update_option_requirements_delta(
  p_option_id UUID,
  p_updates JSONB
) RETURNS opportunity_options LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_result opportunity_options;
BEGIN
  -- 1. Check permissions
  IF NOT public.has_project_permission(
    (SELECT project_id FROM opportunities WHERE id = (SELECT opportunity_id FROM opportunity_options WHERE id = p_option_id)), 
    'can_edit_records'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Insufficient privileges to edit coordination requirements';
  END IF;
  
  -- 2. Update with COALESCE and flat merge (since requirements are just boolean flags)
  UPDATE opportunity_options 
  SET coordination_requirements = COALESCE(coordination_requirements, '{}'::jsonb) || p_updates
  WHERE id = p_option_id
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;
