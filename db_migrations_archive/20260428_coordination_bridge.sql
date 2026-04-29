-- Migration: Automate Design Coordination Tracker Lifecycle & Patch Status Bug
-- Date: 2026-04-28

-- 1. Create Automated Status Trigger
CREATE OR REPLACE FUNCTION trg_auto_update_coordination_status_fn()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_total_required int := 0;
  v_total_complete int := 0;
  k text;
  v text;
  v_status text;
BEGIN
  IF NEW.coordination_details IS DISTINCT FROM OLD.coordination_details THEN
    IF jsonb_typeof(NEW.coordination_details) = 'object' THEN
      FOR k, v IN SELECT key, value FROM jsonb_each_text(NEW.coordination_details) LOOP
        v_status := (v::jsonb)->>'status';
        IF v_status IS NOT NULL AND v_status != 'Not Required' THEN
          v_total_required := v_total_required + 1;
          IF v_status = 'Complete' THEN
            v_total_complete := v_total_complete + 1;
          END IF;
        END IF;
      END LOOP;
    END IF;

    IF v_total_required > 0 AND v_total_required = v_total_complete THEN
      IF NEW.coordination_status IN ('Draft', 'In Drafting') THEN
        NEW.coordination_status := 'Ready for Review';
      END IF;
    ELSIF v_total_complete < v_total_required THEN
      IF OLD.coordination_status IN ('Ready for Review', 'Implemented') THEN
        NEW.coordination_status := 'In Drafting';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_update_coordination_status ON opportunities;
CREATE TRIGGER trg_auto_update_coordination_status BEFORE UPDATE ON opportunities FOR EACH ROW EXECUTE FUNCTION trg_auto_update_coordination_status_fn();


-- 2. Update `unlock_opportunity_option` to reset coordination status and details
CREATE OR REPLACE FUNCTION unlock_opportunity_option(p_opp_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- 1. Verify Permissions against the unified RBAC helper
  IF NOT public.has_project_permission((SELECT project_id FROM opportunities WHERE id = p_opp_id), 'can_unlock_options') THEN
    RAISE EXCEPTION 'Unauthorized: Insufficient privileges to unlock options';
  END IF;

  -- 2. Open Escape Hatch for this specific transaction only
  PERFORM set_config('designpulse.bypass_immutability', 'true', true);

  -- 3. Perform Unlock 
  -- Order matters: Sync totals trigger will recalculate based on the now unlocked options
  UPDATE opportunity_options SET is_locked = false WHERE opportunity_id = p_opp_id;
  UPDATE opportunities SET 
    status = 'Draft', 
    final_direction = NULL,
    coordination_status = 'Draft',
    coordination_details = '{}'::jsonb
  WHERE id = p_opp_id;
END;
$$;


-- 3. Update `lock_opportunity_option` to set coordination status to Draft
CREATE OR REPLACE FUNCTION lock_opportunity_option(p_option_id UUID, p_opp_id UUID)
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
      IF v = 'true' THEN
        v_new_coord_details := jsonb_set(v_new_coord_details, ARRAY[k], '{"status": "Pending", "notes": ""}'::jsonb, true);
      END IF;
    END LOOP;
  END IF;

  IF v_requires_coord THEN
    UPDATE opportunities SET 
      final_direction = 'Locked: ' || v_option_title, 
      status = 'Pending Plan Update', 
      cost_impact = v_option_cost, 
      days_impact = v_option_days,
      coordination_status = 'Draft',
      coordination_details = v_new_coord_details
    WHERE id = p_opp_id;
  ELSE
    UPDATE opportunities SET 
      final_direction = 'Locked: ' || v_option_title, 
      status = 'Approved', 
      cost_impact = v_option_cost, 
      days_impact = v_option_days,
      coordination_status = 'Draft',
      coordination_details = '{}'::jsonb
    WHERE id = p_opp_id;
  END IF;
END;
$$;
