-- ==============================================================================
-- Migration: Fix Lock Opportunity Option JSONB Parsing
-- Description: Refactors the lock_opportunity_option RPC to safely parse 
-- coordination_requirements using jsonb_each_text and an EXCEPTION block
-- to prevent transaction aborts, while supporting legacy flat booleans.
-- Date: 2026-04-30
-- ==============================================================================

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
  -- 1. Check permissions
  IF NOT public.has_project_permission((SELECT project_id FROM opportunities WHERE id = p_opp_id), 'can_lock_options') THEN
    RAISE EXCEPTION 'Unauthorized: Insufficient privileges to lock options';
  END IF;

  -- 2. Unlock all options and reset the opportunity
  UPDATE opportunities SET status = 'Draft' WHERE id = p_opp_id;
  UPDATE opportunity_options SET is_locked = false WHERE opportunity_id = p_opp_id;
  
  -- 3. Lock the selected option and fetch its values
  UPDATE opportunity_options SET is_locked = true WHERE id = p_option_id 
  RETURNING title, cost_impact, days_impact, COALESCE(requires_coordination, true), COALESCE(coordination_requirements, '{}'::jsonb) 
  INTO v_option_title, v_option_cost, v_option_days, v_requires_coord, v_coord_reqs;
  
  -- 4. Safely parse coordination requirements and carry notes over to coordination_details
  IF jsonb_typeof(v_coord_reqs) = 'object' THEN
    FOR k, v IN SELECT key, value FROM jsonb_each_text(v_coord_reqs) LOOP
      BEGIN
        IF jsonb_typeof(v::jsonb) = 'object' AND (v::jsonb)->>'required' = 'true' THEN
          v_new_coord_details := jsonb_set(
            v_new_coord_details, 
            ARRAY[k], 
            jsonb_build_object('status', 'Pending', 'notes', COALESCE((v::jsonb)->>'notes', '')), 
            true
          );
        -- Fallback for legacy flat boolean structure just in case
        ELSIF jsonb_typeof(v::jsonb) = 'boolean' AND v = 'true' THEN
          v_new_coord_details := jsonb_set(
            v_new_coord_details, 
            ARRAY[k], 
            jsonb_build_object('status', 'Pending', 'notes', ''), 
            true
          );
        END IF;
      EXCEPTION WHEN OTHERS THEN
        -- Safely ignore malformed JSON text to prevent transaction aborts
      END;
    END LOOP;
  END IF;

  -- 5. Finalize the Opportunity update
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
