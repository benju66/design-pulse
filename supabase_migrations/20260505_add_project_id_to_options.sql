BEGIN;

-- 1. Open the immutability escape hatch for this transaction
SELECT set_config('designpulse.bypass_immutability', 'true', true);

-- 2. Add project_id column to opportunity_options (nullable initially)
ALTER TABLE public.opportunity_options 
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE;

-- 3. Backfill existing rows by joining with opportunities
UPDATE public.opportunity_options oo
SET project_id = o.project_id
FROM public.opportunities o
WHERE oo.opportunity_id = o.id;

-- 4. Delete any orphaned options to prevent NOT NULL constraint violations
DELETE FROM public.opportunity_options WHERE project_id IS NULL;

-- 5. Make project_id NOT NULL
ALTER TABLE public.opportunity_options 
ALTER COLUMN project_id SET NOT NULL;

-- 6. Recreate RLS Policies to use the much faster project_id directly
DROP POLICY IF EXISTS "Members or Admins can view opportunity_options" ON public.opportunity_options;
CREATE POLICY "Members or Admins can view opportunity_options" 
  ON public.opportunity_options FOR SELECT USING (
    public.get_user_project_role(project_id) IS NOT NULL
  );

DROP POLICY IF EXISTS "Members can insert opportunity_options" ON public.opportunity_options;
CREATE POLICY "Members can insert opportunity_options" 
  ON public.opportunity_options FOR INSERT WITH CHECK (
    public.get_user_project_role(project_id) IN ('project_admin', 'gc_admin', 'design_team')
  );

DROP POLICY IF EXISTS "Members can update opportunity_options" ON public.opportunity_options;
CREATE POLICY "Members can update opportunity_options" 
  ON public.opportunity_options FOR UPDATE USING (
    public.get_user_project_role(project_id) IN ('project_admin', 'gc_admin', 'design_team')
  );

DROP POLICY IF EXISTS "Admins can delete opportunity_options" ON public.opportunity_options;
CREATE POLICY "Admins can delete opportunity_options" 
  ON public.opportunity_options FOR DELETE USING (
    public.get_user_project_role(project_id) IN ('project_admin', 'gc_admin')
  );

COMMIT;
