-- Migration: Upgrade coordination_requirements to nested JSONB format
-- Description: Converts flat booleans to nested objects { "required": boolean, "notes": "" } and updates related RPCs.

-- 1. Data Migration
BEGIN;

-- Open escape hatch to allow data migration on locked records
SELECT set_config('designpulse.bypass_immutability', 'true', true);

UPDATE opportunity_options
SET coordination_requirements = (
  SELECT jsonb_object_agg(
    key,
    CASE
      WHEN jsonb_typeof(value) = 'boolean' THEN
        jsonb_build_object('required', value, 'notes', '')
      WHEN jsonb_typeof(value) = 'string' THEN
        jsonb_build_object('required', value = '"true"', 'notes', '')
      WHEN jsonb_typeof(value) = 'object' THEN
        value
      ELSE
        jsonb_build_object('required', false, 'notes', '')
    END
  )
  FROM jsonb_each(coordination_requirements)
)
WHERE jsonb_typeof(coordination_requirements) = 'object';

COMMIT;

-- 2. Update Delta RPC for Deep Merging
CREATE OR REPLACE FUNCTION public.update_option_requirements_delta(
  p_option_id UUID,
  p_updates JSONB
) RETURNS opportunity_options LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_current JSONB;
  v_key TEXT;
  v_val JSONB;
  v_result opportunity_options;
BEGIN
  -- 1. Check permissions
  IF NOT public.has_project_permission(
    (SELECT project_id FROM opportunities WHERE id = (SELECT opportunity_id FROM opportunity_options WHERE id = p_option_id)), 
    'can_edit_records'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Insufficient privileges to edit coordination requirements';
  END IF;
  
  -- 2. Lock row and fetch current state
  SELECT COALESCE(coordination_requirements, '{}'::jsonb) INTO v_current 
  FROM opportunity_options WHERE id = p_option_id FOR UPDATE;

  -- 3. Merge deltas safely
  IF jsonb_typeof(v_current) = 'object' THEN
    FOR v_key, v_val IN SELECT key, value FROM jsonb_each(p_updates) LOOP
      v_current := jsonb_set(
        v_current, 
        ARRAY[v_key], 
        COALESCE(v_current->v_key, '{}'::jsonb) || v_val
      );
    END LOOP;
  ELSE
    v_current := p_updates;
  END IF;

  -- 4. Update and return
  UPDATE opportunity_options 
  SET coordination_requirements = v_current
  WHERE id = p_option_id
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

-- 3. Update Lock RPC to handle Nested Objects
CREATE OR REPLACE FUNCTION public.lock_opportunity_option(p_option_id UUID, p_opp_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_option_title text;
  v_option_cost numeric;
  v_option_days numeric;
  v_requires_coord boolean;
  v_coord_reqs jsonb;
  v_new_coord_details jsonb := '{}'::jsonb;
  k text;
  v text;
BEGIN
  IF NOT public.has_project_permission((SELECT project_id FROM opportunities WHERE id = p_opp_id), 'can_lock_options') THEN
    RAISE EXCEPTION 'Unauthorized: Insufficient privileges to lock options';
  END IF;

  UPDATE opportunities SET status = 'Draft' WHERE id = p_opp_id;
  UPDATE opportunity_options SET is_locked = false WHERE opportunity_id = p_opp_id;
  
  UPDATE opportunity_options SET is_locked = true WHERE id = p_option_id 
  RETURNING title, cost_impact, days_impact, COALESCE(requires_coordination, true), COALESCE(coordination_requirements, '{}'::jsonb) 
  INTO v_option_title, v_option_cost, v_option_days, v_requires_coord, v_coord_reqs;
  
  IF jsonb_typeof(v_coord_reqs) = 'object' THEN
    FOR k, v IN SELECT key, value FROM jsonb_each_text(v_coord_reqs) LOOP
      IF (v::jsonb)->>'required' = 'true' THEN
        v_new_coord_details := jsonb_set(
          v_new_coord_details, 
          ARRAY[k], 
          jsonb_build_object('status', 'Pending', 'notes', COALESCE((v::jsonb)->>'notes', '')), 
          true
        );
      END IF;
    END LOOP;
  END IF;

  IF v_requires_coord THEN
    UPDATE opportunities SET 
      final_direction = 'Locked: ' || v_option_title, 
      status = 'Approved', 
      cost_impact = v_option_cost, 
      days_impact = v_option_days,
      coordination_status = 'Pending Plan Update',
      coordination_details = v_new_coord_details
    WHERE id = p_opp_id;
  ELSE
    UPDATE opportunities SET 
      final_direction = 'Locked: ' || v_option_title, 
      status = 'Approved', 
      cost_impact = v_option_cost, 
      days_impact = v_option_days,
      coordination_status = 'Not Required',
      coordination_details = '{}'::jsonb
    WHERE id = p_opp_id;
  END IF;
END;
$$;
