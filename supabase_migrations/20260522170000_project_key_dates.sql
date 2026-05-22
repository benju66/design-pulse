-- ============================================================================
-- STEP 1: EXTEND PROJECT SEQUENCES COUNTER
-- ============================================================================
ALTER TABLE public.project_sequences 
ADD COLUMN IF NOT EXISTS kd_current_value integer DEFAULT 0;

-- ============================================================================
-- STEP 2: CREATE THE PRE-CONSTRUCTION KEY DATES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.project_key_dates (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  display_id            text, -- Populated atomically by BEFORE INSERT trigger
  title                 text NOT NULL,
  description           text,
  event_date            date NOT NULL, -- Strict native DATE type
  is_deleted            boolean NOT NULL DEFAULT false, -- Soft-delete flag
  created_at            timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at            timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_project_key_date_display_id UNIQUE (project_id, display_id) -- Scoped per project for multi-tenancy
);

-- Establish performance indexes for multi-tenant boundary checks and FK traversals
CREATE INDEX IF NOT EXISTS idx_project_key_dates_project_id 
  ON public.project_key_dates(project_id);
CREATE INDEX IF NOT EXISTS idx_project_key_dates_event_date 
  ON public.project_key_dates(event_date);

-- ============================================================================
-- STEP 3: AUTOMATE IDENTIFIER LOGGING TRIGGER (KD-XXX)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.generate_key_date_display_id()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_val integer;
BEGIN
  -- Race-safe atomic increment isolated strictly per-project
  INSERT INTO public.project_sequences (project_id, kd_current_value)
  VALUES (NEW.project_id, 1)
  ON CONFLICT (project_id) 
  DO UPDATE SET kd_current_value = COALESCE(project_sequences.kd_current_value, 0) + 1
  RETURNING kd_current_value INTO next_val;

  -- Build user-facing padded tracking string
  NEW.display_id := 'KD-' || LPAD(next_val::text, 3, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_key_date_display_id ON public.project_key_dates;
CREATE TRIGGER trg_set_key_date_display_id
  BEFORE INSERT ON public.project_key_dates
  FOR EACH ROW
  WHEN (NEW.display_id IS NULL)
  EXECUTE FUNCTION public.generate_key_date_display_id();

-- ============================================================================
-- STEP 4: BIND SYSTEM HOOK TRIGGERS (TIMESTAMPS & AUDITING)
-- ============================================================================
-- Bind standard updated_at timestamp sync execution
DROP TRIGGER IF EXISTS trg_project_key_dates_updated_at ON public.project_key_dates;
CREATE TRIGGER trg_project_key_dates_updated_at 
  BEFORE UPDATE ON public.project_key_dates 
  FOR EACH ROW 
  EXECUTE FUNCTION public.auto_update_timestamp();

-- Redefine process_audit_log to explicitly include project_key_dates in the audit log system
CREATE OR REPLACE FUNCTION public.process_audit_log()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_project_id uuid;
  v_audit_enabled boolean;
END;
$$;

-- Wait, let's redefine the full body of process_audit_log exactly as in project_deliverables, but adding project_key_dates
CREATE OR REPLACE FUNCTION public.process_audit_log()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_project_id uuid;
  v_audit_enabled boolean;
BEGIN
  IF TG_TABLE_NAME = 'opportunities' THEN
    v_project_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.project_id ELSE NEW.project_id END;
  ELSIF TG_TABLE_NAME = 'opportunity_options' THEN
    SELECT project_id INTO v_project_id FROM opportunities WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.opportunity_id ELSE NEW.opportunity_id END;
  ELSIF TG_TABLE_NAME = 'project_estimate_versions' THEN
    v_project_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.project_id ELSE NEW.project_id END;
  ELSIF TG_TABLE_NAME IN ('permits', 'permit_comments', 'project_deliverables', 'project_key_dates') THEN
    v_project_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.project_id ELSE NEW.project_id END;
  ELSE
    -- For project_settings, projects, etc., fall back to looking for an id column
    BEGIN
      v_project_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
    EXCEPTION WHEN OTHERS THEN 
      v_project_id := NULL;
    END;
  END IF;

  SELECT enable_audit_logging INTO v_audit_enabled FROM project_settings WHERE project_id = v_project_id;

  IF v_audit_enabled IS NOT TRUE THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF (row_to_json(OLD)::jsonb - 'updated_at') IS NOT DISTINCT FROM (row_to_json(NEW)::jsonb - 'updated_at') THEN RETURN NEW; END IF;
    -- Soft-delete detection: only for tables that carry is_deleted
    IF TG_TABLE_NAME IN ('opportunities', 'opportunity_options', 'permits', 'project_deliverables', 'project_key_dates') AND OLD.is_deleted = false AND NEW.is_deleted = true THEN
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

-- Bind central enterprise audit log reporting
DROP TRIGGER IF EXISTS trg_audit_project_key_dates ON public.project_key_dates;
CREATE TRIGGER trg_audit_project_key_dates
  AFTER INSERT OR UPDATE OR DELETE ON public.project_key_dates
  FOR EACH ROW 
  EXECUTE FUNCTION public.process_audit_log();

-- ============================================================================
-- STEP 5: ENFORCE ROW LEVEL SECURITY POLICIES (DYNAMIC RBAC MAPPING)
-- ============================================================================
ALTER TABLE public.project_key_dates ENABLE ROW LEVEL SECURITY;

-- Select Policy: All authenticated project team members can view active key dates
DROP POLICY IF EXISTS "Members or Admins can view project key dates" ON public.project_key_dates;
CREATE POLICY "Members or Admins can view project key dates" 
  ON public.project_key_dates FOR SELECT 
  USING (
    public.is_platform_admin() 
    OR (is_deleted = false AND public.get_user_project_role(project_id) IS NOT NULL)
  );

-- Insert/Update Policy: Restricted strictly to roles with record-level edit rights (Admins, GCs, Design Team)
DROP POLICY IF EXISTS "Authorized members can modify project key dates" ON public.project_key_dates;
CREATE POLICY "Authorized members can modify project key dates" 
  ON public.project_key_dates FOR INSERT 
  WITH CHECK (public.has_project_permission(project_id, 'can_edit_records'));

DROP POLICY IF EXISTS "Authorized members can update project key dates" ON public.project_key_dates;
CREATE POLICY "Authorized members can update project key dates" 
  ON public.project_key_dates FOR UPDATE 
  USING (public.has_project_permission(project_id, 'can_edit_records'));

-- Delete Policy: Standard database hard-purging restricted strictly to project owners/admins
DROP POLICY IF EXISTS "Admins can delete project key dates" ON public.project_key_dates;
CREATE POLICY "Admins can delete project key dates" 
  ON public.project_key_dates FOR DELETE 
  USING (public.has_project_permission(project_id, 'can_delete_records'));

-- ============================================================================
-- STEP 6: EXTEND ACTIVITY LOGS SECURITY FOR KEY DATES
-- ============================================================================
-- Add key_date_id column to item_activity if not already exists
ALTER TABLE public.item_activity 
ADD COLUMN IF NOT EXISTS key_date_id uuid REFERENCES public.project_key_dates(id) ON DELETE CASCADE;

-- Create an index to support performance for key_date link traversals
CREATE INDEX IF NOT EXISTS idx_item_activity_key_date_id 
ON public.item_activity(key_date_id) WHERE key_date_id IS NOT NULL;

-- Redefine members can insert item activity policy on item_activity to include key dates
DROP POLICY IF EXISTS "Members can insert item activity" ON public.item_activity;
CREATE POLICY "Members can insert item activity" ON public.item_activity
FOR INSERT WITH CHECK (
  public.has_project_permission(project_id, 'can_edit_records') AND
  activity_type = 'user_comment' AND
  author_id = auth.uid() AND
  (
    (opportunity_id IS NOT NULL AND EXISTS (SELECT 1 FROM opportunities o WHERE o.id = opportunity_id AND o.project_id = item_activity.project_id)) OR
    (lesson_id IS NOT NULL AND EXISTS (SELECT 1 FROM project_lessons l WHERE l.id = lesson_id AND l.project_id = item_activity.project_id)) OR
    (permit_id IS NOT NULL AND EXISTS (SELECT 1 FROM permits p WHERE p.id = permit_id AND p.project_id = item_activity.project_id)) OR
    (deliverable_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.project_deliverables d WHERE d.id = deliverable_id AND d.project_id = item_activity.project_id)) OR
    (key_date_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.project_key_dates k WHERE k.id = key_date_id AND k.project_id = item_activity.project_id))
  )
);
