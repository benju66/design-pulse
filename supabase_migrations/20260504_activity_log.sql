-- ==========================================
-- ACTIVITY & AUDIT LOG IMPLEMENTATION
-- ==========================================

-- 1. Create the item_activity table
CREATE TABLE IF NOT EXISTS item_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  option_id uuid REFERENCES opportunity_options(id) ON DELETE CASCADE,
  activity_type text NOT NULL CHECK (activity_type IN ('system_log', 'user_comment')),
  content text NOT NULL,
  mentions jsonb DEFAULT '[]'::jsonb,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  include_in_oac boolean DEFAULT false,
  is_edited boolean DEFAULT false,
  is_deleted boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_item_activity_opportunity_id ON item_activity(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_item_activity_project_id ON item_activity(project_id);

-- 3. Enable RLS
ALTER TABLE item_activity ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
DROP POLICY IF EXISTS "Members can view item activity" ON item_activity;
CREATE POLICY "Members can view item activity" ON item_activity 
FOR SELECT USING (
  is_deleted = false AND
  (public.is_platform_admin() OR public.get_user_project_role(project_id) IS NOT NULL)
);

DROP POLICY IF EXISTS "Members can insert item activity" ON item_activity;
CREATE POLICY "Members can insert item activity" ON item_activity
FOR INSERT WITH CHECK (
  public.has_project_permission(project_id, 'can_edit_records') AND
  activity_type = 'user_comment' AND
  author_id = auth.uid() AND
  EXISTS (SELECT 1 FROM opportunities o WHERE o.id = opportunity_id AND o.project_id = item_activity.project_id)
);

DROP POLICY IF EXISTS "Authors can update their own comments" ON item_activity;
CREATE POLICY "Authors can update their own comments" ON item_activity
FOR UPDATE USING (
  activity_type = 'user_comment' AND 
  author_id = auth.uid() AND 
  is_deleted = false
);

DROP POLICY IF EXISTS "Authors can delete their own comments" ON item_activity;
CREATE POLICY "Authors can delete their own comments" ON item_activity
FOR DELETE USING (
  activity_type = 'user_comment' AND 
  author_id = auth.uid()
);

-- 5. Immutability Trigger
CREATE OR REPLACE FUNCTION enforce_item_activity_immutability()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.activity_type = 'system_log' THEN
    RAISE EXCEPTION 'System logs are strictly immutable and cannot be updated.';
  END IF;
  IF NEW.project_id IS DISTINCT FROM OLD.project_id OR NEW.opportunity_id IS DISTINCT FROM OLD.opportunity_id OR NEW.option_id IS DISTINCT FROM OLD.option_id OR NEW.author_id IS DISTINCT FROM OLD.author_id OR NEW.activity_type IS DISTINCT FROM OLD.activity_type THEN
    RAISE EXCEPTION 'Core relational columns on item_activity cannot be mutated after creation.';
  END IF;
  NEW.updated_at = timezone('utc'::text, now());
  NEW.is_edited = true;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_item_activity_immutability ON item_activity;
CREATE TRIGGER trg_item_activity_immutability
BEFORE UPDATE ON item_activity
FOR EACH ROW EXECUTE FUNCTION enforce_item_activity_immutability();

-- 6. UI-Specific System Log Triggers
CREATE OR REPLACE FUNCTION log_ui_system_activity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_summary text;
  v_project_id uuid;
  v_opportunity_id uuid;
  v_option_id uuid;
BEGIN
  -- Respect the escape hatch
  IF current_setting('designpulse.bypass_immutability', true) = 'true' THEN 
    RETURN NEW; 
  END IF;

  IF TG_TABLE_NAME = 'opportunities' THEN
    v_project_id := NEW.project_id;
    v_opportunity_id := NEW.id;
    v_option_id := NULL;

    IF TG_OP = 'UPDATE' THEN
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
    END IF;

  ELSIF TG_TABLE_NAME = 'opportunity_options' THEN
    SELECT project_id INTO v_project_id FROM opportunities WHERE id = NEW.opportunity_id;
    v_opportunity_id := NEW.opportunity_id;
    v_option_id := NEW.id;

    IF TG_OP = 'INSERT' THEN
      v_summary := 'Option "' || NEW.title || '" was created.';
      INSERT INTO item_activity (project_id, opportunity_id, option_id, activity_type, content, author_id)
      VALUES (v_project_id, v_opportunity_id, v_option_id, 'system_log', v_summary, auth.uid());
    ELSIF TG_OP = 'UPDATE' THEN
      IF NEW.is_locked = true AND OLD.is_locked = false THEN
        v_summary := 'Option "' || NEW.title || '" was locked as the final direction.';
        INSERT INTO item_activity (project_id, opportunity_id, option_id, activity_type, content, author_id)
        VALUES (v_project_id, v_opportunity_id, v_option_id, 'system_log', v_summary, auth.uid());
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ui_system_activity_opp ON opportunities;
CREATE TRIGGER trg_ui_system_activity_opp
AFTER UPDATE ON opportunities
FOR EACH ROW EXECUTE FUNCTION log_ui_system_activity();

DROP TRIGGER IF EXISTS trg_ui_system_activity_opt ON opportunity_options;
CREATE TRIGGER trg_ui_system_activity_opt
AFTER INSERT OR UPDATE ON opportunity_options
FOR EACH ROW EXECUTE FUNCTION log_ui_system_activity();
