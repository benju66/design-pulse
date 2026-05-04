-- ==========================================
-- Migration: Fix Activity Tracker Audit Trails & Realtime
-- Date: 2026-05-04
-- ==========================================

-- 1. Fix RLS insertion failure by defaulting author_id to the authenticated user
ALTER TABLE item_activity ALTER COLUMN author_id SET DEFAULT auth.uid();

-- 2. Safely add item_activity to the Supabase realtime publication and set REPLICA IDENTITY FULL
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE item_activity;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END $$;

ALTER TABLE item_activity REPLICA IDENTITY FULL;

-- 3. Replace the UI System Activity logger with missing audit trails and no escape hatch bypass
CREATE OR REPLACE FUNCTION log_ui_system_activity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_summary text;
  v_project_id uuid;
  v_opportunity_id uuid;
  v_option_id uuid;
BEGIN
  -- REMOVED: Escape hatch bypass. We MUST log system activity even if immutability is bypassed (e.g. admin unlocks).

  IF TG_TABLE_NAME = 'opportunities' THEN
    v_project_id := NEW.project_id;
    v_opportunity_id := NEW.id;
    v_option_id := NULL;

    IF TG_OP = 'INSERT' THEN
      v_summary := 'Opportunity "' || COALESCE(NEW.title, 'Untitled') || '" was created.';
      INSERT INTO item_activity (project_id, opportunity_id, option_id, activity_type, content, author_id)
      VALUES (v_project_id, v_opportunity_id, v_option_id, 'system_log', v_summary, auth.uid());
    ELSIF TG_OP = 'UPDATE' THEN
      IF NEW.title IS DISTINCT FROM OLD.title THEN
        v_summary := 'Opportunity renamed from "' || COALESCE(OLD.title, '') || '" to "' || COALESCE(NEW.title, '') || '"';
        INSERT INTO item_activity (project_id, opportunity_id, option_id, activity_type, content, author_id)
        VALUES (v_project_id, v_opportunity_id, v_option_id, 'system_log', v_summary, auth.uid());
      END IF;
      
      IF NEW.status IS DISTINCT FROM OLD.status THEN
        v_summary := 'Status changed from ' || COALESCE(OLD.status, 'None') || ' to ' || NEW.status;
        INSERT INTO item_activity (project_id, opportunity_id, option_id, activity_type, content, author_id)
        VALUES (v_project_id, v_opportunity_id, v_option_id, 'system_log', v_summary, auth.uid());
      END IF;
      
      IF NEW.assignee IS DISTINCT FROM OLD.assignee THEN
        v_summary := 'Assignee changed from ' || COALESCE(OLD.assignee, 'Unassigned') || ' to ' || COALESCE(NEW.assignee, 'Unassigned');
        INSERT INTO item_activity (project_id, opportunity_id, option_id, activity_type, content, author_id)
        VALUES (v_project_id, v_opportunity_id, v_option_id, 'system_log', v_summary, auth.uid());
      END IF;
      
      IF NEW.priority IS DISTINCT FROM OLD.priority THEN
        v_summary := 'Priority changed from ' || COALESCE(OLD.priority, 'None') || ' to ' || COALESCE(NEW.priority, 'None');
        INSERT INTO item_activity (project_id, opportunity_id, option_id, activity_type, content, author_id)
        VALUES (v_project_id, v_opportunity_id, v_option_id, 'system_log', v_summary, auth.uid());
      END IF;
    END IF;

  ELSIF TG_TABLE_NAME = 'opportunity_options' THEN
    SELECT project_id INTO v_project_id FROM opportunities WHERE id = NEW.opportunity_id;
    v_opportunity_id := NEW.opportunity_id;
    v_option_id := NEW.id;

    IF TG_OP = 'INSERT' THEN
      v_summary := 'Option "' || COALESCE(NEW.title, 'Untitled') || '" was created.';
      INSERT INTO item_activity (project_id, opportunity_id, option_id, activity_type, content, author_id)
      VALUES (v_project_id, v_opportunity_id, v_option_id, 'system_log', v_summary, auth.uid());
      
    ELSIF TG_OP = 'UPDATE' THEN
      IF NEW.title IS DISTINCT FROM OLD.title THEN
        v_summary := 'Option renamed from "' || COALESCE(OLD.title, '') || '" to "' || COALESCE(NEW.title, '') || '"';
        INSERT INTO item_activity (project_id, opportunity_id, option_id, activity_type, content, author_id)
        VALUES (v_project_id, v_opportunity_id, v_option_id, 'system_log', v_summary, auth.uid());
      END IF;

      IF NEW.cost_impact IS DISTINCT FROM OLD.cost_impact THEN
        v_summary := 'Cost impact changed from $' || COALESCE(OLD.cost_impact::text, '0') || ' to $' || COALESCE(NEW.cost_impact::text, '0');
        INSERT INTO item_activity (project_id, opportunity_id, option_id, activity_type, content, author_id)
        VALUES (v_project_id, v_opportunity_id, v_option_id, 'system_log', v_summary, auth.uid());
      END IF;

      IF NEW.days_impact IS DISTINCT FROM OLD.days_impact THEN
        v_summary := 'Schedule impact changed from ' || COALESCE(OLD.days_impact::text, '0') || ' days to ' || COALESCE(NEW.days_impact::text, '0') || ' days';
        INSERT INTO item_activity (project_id, opportunity_id, option_id, activity_type, content, author_id)
        VALUES (v_project_id, v_opportunity_id, v_option_id, 'system_log', v_summary, auth.uid());
      END IF;

      IF NEW.include_in_budget IS DISTINCT FROM OLD.include_in_budget THEN
        v_summary := 'Budget inclusion changed to ' || CASE WHEN NEW.include_in_budget THEN 'Yes' ELSE 'No' END;
        INSERT INTO item_activity (project_id, opportunity_id, option_id, activity_type, content, author_id)
        VALUES (v_project_id, v_opportunity_id, v_option_id, 'system_log', v_summary, auth.uid());
      END IF;

      IF NEW.is_locked = true AND OLD.is_locked = false THEN
        v_summary := 'Option "' || NEW.title || '" was locked as the final direction.';
        INSERT INTO item_activity (project_id, opportunity_id, option_id, activity_type, content, author_id)
        VALUES (v_project_id, v_opportunity_id, v_option_id, 'system_log', v_summary, auth.uid());
      ELSIF NEW.is_locked = false AND OLD.is_locked = true THEN
        v_summary := 'Option "' || NEW.title || '" was unlocked.';
        INSERT INTO item_activity (project_id, opportunity_id, option_id, activity_type, content, author_id)
        VALUES (v_project_id, v_opportunity_id, v_option_id, 'system_log', v_summary, auth.uid());
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 4. Update the triggers to fire on INSERT as well
DROP TRIGGER IF EXISTS trg_ui_system_activity_opp ON opportunities;
CREATE TRIGGER trg_ui_system_activity_opp
AFTER INSERT OR UPDATE ON opportunities
FOR EACH ROW EXECUTE FUNCTION log_ui_system_activity();

DROP TRIGGER IF EXISTS trg_ui_system_activity_opt ON opportunity_options;
CREATE TRIGGER trg_ui_system_activity_opt
AFTER INSERT OR UPDATE ON opportunity_options
FOR EACH ROW EXECUTE FUNCTION log_ui_system_activity();
