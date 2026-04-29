-- Migration Script: Soft Deletes and Immutability Upgrades
-- Run this in your Supabase SQL Editor to upgrade your existing database.

-- 1. Add `is_deleted` columns safely
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false;
ALTER TABLE opportunity_options ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false;

-- 2. Update RLS Policies
DROP POLICY IF EXISTS "Members or Admins can view opportunities" ON opportunities;
CREATE POLICY "Members or Admins can view opportunities" 
  ON opportunities FOR SELECT USING (is_platform_admin() OR (is_deleted = false AND public.get_user_project_role(project_id) IS NOT NULL));

DROP POLICY IF EXISTS "Members or Admins can view opportunity_options" ON opportunity_options;
CREATE POLICY "Members or Admins can view opportunity_options" 
  ON opportunity_options FOR SELECT USING (
    is_platform_admin() OR (is_deleted = false AND EXISTS (
      SELECT 1 FROM opportunities WHERE opportunities.id = opportunity_options.opportunity_id AND public.get_user_project_role(opportunities.project_id) IS NOT NULL
    ))
  );

-- 3. Update sync_parent_opportunity_totals to filter soft deletes
CREATE OR REPLACE FUNCTION sync_parent_opportunity_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_opp_id uuid;
  v_cost_impact numeric := 0;
  v_days_impact numeric := 0;
  v_has_options boolean := false;
BEGIN
  IF TG_OP = 'DELETE' THEN v_opp_id := OLD.opportunity_id; ELSE v_opp_id := NEW.opportunity_id; END IF;

  SELECT EXISTS(SELECT 1 FROM opportunity_options WHERE opportunity_id = v_opp_id AND is_deleted = false) INTO v_has_options;

  IF v_has_options THEN
    IF EXISTS (SELECT 1 FROM opportunity_options WHERE opportunity_id = v_opp_id AND is_locked = true AND is_deleted = false) THEN
      SELECT COALESCE(cost_impact, 0), COALESCE(days_impact, 0) INTO v_cost_impact, v_days_impact FROM opportunity_options WHERE opportunity_id = v_opp_id AND is_locked = true AND is_deleted = false LIMIT 1;
    ELSIF EXISTS (SELECT 1 FROM opportunity_options WHERE opportunity_id = v_opp_id AND include_in_budget = true AND is_deleted = false) THEN
      SELECT COALESCE(SUM(cost_impact), 0), COALESCE(SUM(days_impact), 0) INTO v_cost_impact, v_days_impact FROM opportunity_options WHERE opportunity_id = v_opp_id AND include_in_budget = true AND is_deleted = false;
    ELSE
      SELECT COALESCE(MAX(cost_impact), 0), COALESCE(MAX(days_impact), 0) INTO v_cost_impact, v_days_impact FROM opportunity_options WHERE opportunity_id = v_opp_id AND is_deleted = false;
    END IF;

    UPDATE opportunities SET cost_impact = v_cost_impact, days_impact = v_days_impact WHERE id = v_opp_id;
  ELSE
    UPDATE opportunities SET cost_impact = 0, days_impact = 0 WHERE id = v_opp_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 4. Update process_audit_log for SOFT_DELETE
CREATE OR REPLACE FUNCTION process_audit_log()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_project_id uuid;
  v_audit_enabled boolean;
BEGIN
  IF TG_TABLE_NAME = 'opportunities' THEN
    v_project_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.project_id ELSE NEW.project_id END;
  ELSIF TG_TABLE_NAME = 'opportunity_options' THEN
    SELECT project_id INTO v_project_id FROM opportunities WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.opportunity_id ELSE NEW.opportunity_id END;
  END IF;

  SELECT enable_audit_logging INTO v_audit_enabled FROM project_settings WHERE project_id = v_project_id;

  IF v_audit_enabled IS NOT TRUE THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF (row_to_json(OLD)::jsonb - 'updated_at') IS NOT DISTINCT FROM (row_to_json(NEW)::jsonb - 'updated_at') THEN RETURN NEW; END IF;
    IF OLD.is_deleted = false AND NEW.is_deleted = true THEN
      INSERT INTO audit_logs (record_id, table_name, action_type, old_payload, user_id, project_id) VALUES (NEW.id, TG_TABLE_NAME, 'SOFT_DELETE', row_to_json(OLD)::jsonb, auth.uid(), v_project_id);
    ELSE
      INSERT INTO audit_logs (record_id, table_name, action_type, old_payload, new_payload, user_id, project_id) VALUES (NEW.id, TG_TABLE_NAME, 'UPDATE', row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb, auth.uid(), v_project_id);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (record_id, table_name, action_type, old_payload, user_id, project_id) VALUES (OLD.id, TG_TABLE_NAME, 'DELETE', row_to_json(OLD)::jsonb, auth.uid(), v_project_id);
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (record_id, table_name, action_type, new_payload, user_id, project_id) VALUES (NEW.id, TG_TABLE_NAME, 'INSERT', row_to_json(NEW)::jsonb, auth.uid(), v_project_id);
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

-- 5. Soft-Delete Cascade Trigger
CREATE OR REPLACE FUNCTION cascade_soft_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.is_deleted = false AND NEW.is_deleted = true THEN
    UPDATE opportunity_options SET is_deleted = true WHERE opportunity_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cascade_soft_delete_opportunities ON opportunities;
CREATE TRIGGER trg_cascade_soft_delete_opportunities AFTER UPDATE ON opportunities FOR EACH ROW EXECUTE FUNCTION cascade_soft_delete();

-- 6. Update enforce_financial_immutability
CREATE OR REPLACE FUNCTION enforce_financial_immutability()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- ESCAPE HATCH: Bypass if the transaction-scoped variable is set
  IF current_setting('designpulse.bypass_immutability', true) = 'true' THEN 
    RETURN NEW; 
  END IF;

  IF OLD.status IN ('Pending Plan Update', 'GC / Owner Review', 'Implemented', 'Approved') THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      RAISE EXCEPTION 'Financial immutability enforced: Cannot modify status of locked records without explicitly unlocking.';
    END IF;
    IF OLD.is_deleted = false AND NEW.is_deleted = true THEN
      RAISE EXCEPTION 'Financial immutability enforced: Cannot delete a locked opportunity. Unlock it first.';
    END IF;
    IF OLD.cost_impact IS DISTINCT FROM NEW.cost_impact OR OLD.days_impact IS DISTINCT FROM NEW.days_impact OR OLD.title IS DISTINCT FROM NEW.title THEN
      RAISE EXCEPTION 'Financial immutability enforced: Cannot modify core fields of locked records';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 7. Analytics RPCs Updates
CREATE OR REPLACE FUNCTION get_project_trade_variances(p_project_id UUID)
RETURNS TABLE (cost_code text, total_variance numeric)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT (public.is_platform_admin() OR public.get_user_project_role(p_project_id) IS NOT NULL) THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  
  RETURN QUERY 
  SELECT COALESCE(o.cost_code, 'Unassigned'), SUM(o.cost_impact) 
  FROM opportunities o 
  WHERE o.project_id = p_project_id AND o.is_deleted = false
  GROUP BY COALESCE(o.cost_code, 'Unassigned');
END;
$$;

CREATE OR REPLACE FUNCTION get_gc_bottleneck_metrics(p_project_id UUID)
RETURNS TABLE (assignee text, pending_count bigint)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT (public.is_platform_admin() OR public.get_user_project_role(p_project_id) IS NOT NULL) THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  
  RETURN QUERY 
  SELECT COALESCE(o.assignee, 'Unassigned'), COUNT(*) 
  FROM opportunities o 
  WHERE o.project_id = p_project_id AND o.status IN ('Draft', 'Pending Review', 'Pending') AND o.is_deleted = false 
  GROUP BY COALESCE(o.assignee, 'Unassigned');
END;
$$;

CREATE OR REPLACE FUNCTION get_owner_roi_metrics(p_project_id UUID)
RETURNS TABLE (building_area text, total_savings numeric)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT (public.is_platform_admin() OR public.get_user_project_role(p_project_id) IS NOT NULL) THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  
  RETURN QUERY 
  SELECT COALESCE(o.building_area, 'General'), ABS(SUM(o.cost_impact)) 
  FROM opportunities o 
  WHERE o.project_id = p_project_id 
    AND o.is_deleted = false
    AND o.cost_impact < 0 
    AND o.status IN ('Approved', 'Pending Plan Update', 'Implemented') 
  GROUP BY COALESCE(o.building_area, 'General');
END;
$$;

CREATE OR REPLACE FUNCTION get_design_completion_metrics(p_project_id UUID)
RETURNS TABLE (discipline_id text, status text, count bigint)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT (public.is_platform_admin() OR public.get_user_project_role(p_project_id) IS NOT NULL) THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  
  RETURN QUERY 
  SELECT key AS discipline_id, value->>'status' AS status, COUNT(*) 
  FROM opportunities o, jsonb_each(CASE WHEN jsonb_typeof(o.coordination_details) = 'object' THEN o.coordination_details ELSE '{}'::jsonb END)
  WHERE o.project_id = p_project_id 
    AND o.is_deleted = false
    AND (
      o.record_type = 'Coordination' 
      OR (o.record_type = 'VE' AND o.status IN ('Pending Plan Update', 'In Drafting', 'GC / Owner Review', 'Implemented', 'Approved'))
    )
  GROUP BY key, value->>'status';
END;
$$;
