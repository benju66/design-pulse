-- ============================================================================
-- STEP 1: EXTEND PROJECT SEQUENCES COUNTER
-- ============================================================================
ALTER TABLE public.project_sequences 
ADD COLUMN IF NOT EXISTS del_current_value integer DEFAULT 0;

-- ============================================================================
-- STEP 2: CREATE THE PRE-CONSTRUCTION DELIVERABLES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.project_deliverables (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  permit_id             uuid REFERENCES public.permits(id) ON DELETE SET NULL, -- Optional parent permit bridge
  display_id            text, -- Populated atomically by BEFORE INSERT trigger
  title                 text NOT NULL,
  description           text,
  assignee              text, -- Captures standard task ownership metadata
  due_date              date NOT NULL, -- Strict native DATE type to support calendar picker
  status                text NOT NULL DEFAULT 'Open' 
    CHECK (status IN ('Open', 'In Progress', 'Under Review', 'Closed', 'Not Applicable')),
  is_elevated_key_date  boolean NOT NULL DEFAULT false, -- Nomenclature key_date
  is_deleted            boolean NOT NULL DEFAULT false, -- Soft-delete flag for Trash View integration
  created_at            timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at            timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_project_deliverable_display_id UNIQUE (project_id, display_id) -- Scoped per project for multi-tenancy
);

-- Establish performance indexes for multi-tenant boundary checks and FK traversals
CREATE INDEX IF NOT EXISTS idx_project_deliverables_project_id 
  ON public.project_deliverables(project_id);
CREATE INDEX IF NOT EXISTS idx_project_deliverables_permit_id 
  ON public.project_deliverables(permit_id) WHERE permit_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_project_deliverables_due_date 
  ON public.project_deliverables(due_date);

-- ============================================================================
-- STEP 3: AUTOMATE IDENTIFIER LOGGING TRIGGER (DE-XXX)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.generate_deliverable_display_id()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_val integer;
BEGIN
  -- Race-safe atomic increment isolated strictly per-project
  INSERT INTO public.project_sequences (project_id, del_current_value)
  VALUES (NEW.project_id, 1)
  ON CONFLICT (project_id) 
  DO UPDATE SET del_current_value = COALESCE(project_sequences.del_current_value, 0) + 1
  RETURNING del_current_value INTO next_val;

  -- Build user-facing padded tracking string
  NEW.display_id := 'DE-' || LPAD(next_val::text, 3, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_deliverable_display_id ON public.project_deliverables;
CREATE TRIGGER trg_set_deliverable_display_id
  BEFORE INSERT ON public.project_deliverables
  FOR EACH ROW
  WHEN (NEW.display_id IS NULL)
  EXECUTE FUNCTION public.generate_deliverable_display_id();

-- ============================================================================
-- STEP 4: BIND SYSTEM HOOK TRIGGERS (TIMESTAMPS & AUDITING)
-- ============================================================================
-- Bind standard updated_at timestamp sync execution
DROP TRIGGER IF EXISTS trg_project_deliverables_updated_at ON public.project_deliverables;
CREATE TRIGGER trg_project_deliverables_updated_at 
  BEFORE UPDATE ON public.project_deliverables 
  FOR EACH ROW 
  EXECUTE FUNCTION public.auto_update_timestamp();

-- NOTE: process_audit_log() is consolidated in supabase_schema.sql.
-- Only the TRIGGER binding is defined here. Never redefine the function in migrations.

-- Bind central enterprise audit log reporting
DROP TRIGGER IF EXISTS trg_audit_project_deliverables ON public.project_deliverables;
CREATE TRIGGER trg_audit_project_deliverables
  AFTER INSERT OR UPDATE OR DELETE ON public.project_deliverables
  FOR EACH ROW 
  EXECUTE FUNCTION public.process_audit_log();

-- ============================================================================
-- STEP 5: ENFORCE ROW LEVEL SECURITY POLICIES (DYNAMIC RBAC MAPPING)
-- ============================================================================
ALTER TABLE public.project_deliverables ENABLE ROW LEVEL SECURITY;

-- Select Policy: All authenticated project team members can view active deliverables
DROP POLICY IF EXISTS "Members or Admins can view project deliverables" ON public.project_deliverables;
CREATE POLICY "Members or Admins can view project deliverables" 
  ON public.project_deliverables FOR SELECT 
  USING (
    public.is_platform_admin() 
    OR (is_deleted = false AND public.get_user_project_role(project_id) IS NOT NULL)
  );

-- Insert/Update Policy: Restricted strictly to roles with record-level edit rights (Admins, GCs, Design Team)
DROP POLICY IF EXISTS "Authorized members can modify project deliverables" ON public.project_deliverables;
CREATE POLICY "Authorized members can modify project deliverables" 
  ON public.project_deliverables FOR INSERT 
  WITH CHECK (public.has_project_permission(project_id, 'can_edit_records'));

DROP POLICY IF EXISTS "Authorized members can update project deliverables" ON public.project_deliverables;
CREATE POLICY "Authorized members can update project deliverables" 
  ON public.project_deliverables FOR UPDATE 
  USING (public.has_project_permission(project_id, 'can_edit_records'));

-- Delete Policy: Standard database hard-purging restricted strictly to project owners/admins
DROP POLICY IF EXISTS "Admins can delete project deliverables" ON public.project_deliverables;
CREATE POLICY "Admins can delete project deliverables" 
  ON public.project_deliverables FOR DELETE 
  USING (public.has_project_permission(project_id, 'can_delete_records'));

-- ============================================================================
-- STEP 6: EXTEND ACTIVITY LOGS SECURITY FOR DELIVERABLES
-- ============================================================================
-- Add deliverable_id column to item_activity if not already exists
ALTER TABLE public.item_activity 
ADD COLUMN IF NOT EXISTS deliverable_id uuid REFERENCES public.project_deliverables(id) ON DELETE CASCADE;

-- Create an index to support performance for deliverable link traversals
CREATE INDEX IF NOT EXISTS idx_item_activity_deliverable_id 
ON public.item_activity(deliverable_id) WHERE deliverable_id IS NOT NULL;

-- Redefine members can insert item activity policy on item_activity to include deliverables
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
    (deliverable_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.project_deliverables d WHERE d.id = deliverable_id AND d.project_id = item_activity.project_id))
  )
);
