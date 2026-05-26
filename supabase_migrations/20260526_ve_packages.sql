-- ============================================================================
-- VE SANDBOX PACKAGES — Feature Migration
-- Date: 2026-05-26
-- Depends on: projects, opportunities, opportunity_options, auth.users,
--             process_audit_log(), auto_update_timestamp(), has_project_permission(),
--             get_user_project_role(), is_platform_admin()
-- ============================================================================

-- ============================================================================
-- STEP 1: VE PACKAGES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ve_packages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name        text NOT NULL DEFAULT 'New Package',
  color       text NOT NULL DEFAULT 'violet',
  notes       text,
  sort_order  integer NOT NULL DEFAULT 0,
  created_by  uuid DEFAULT auth.uid() REFERENCES auth.users(id),
  is_deleted  boolean NOT NULL DEFAULT false,
  created_at  timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  updated_at  timestamptz DEFAULT timezone('utc', now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ve_packages_project_id
  ON public.ve_packages(project_id);

-- ============================================================================
-- STEP 2: VE PACKAGE ITEMS (JUNCTION TABLE WITH SCENARIO SELECTION)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ve_package_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id        uuid NOT NULL REFERENCES public.ve_packages(id) ON DELETE CASCADE,
  opportunity_id    uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  project_id        uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  assumed_option_id uuid REFERENCES public.opportunity_options(id) ON DELETE SET NULL,
  sort_order        integer NOT NULL DEFAULT 0,
  created_at        timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  UNIQUE(package_id, opportunity_id)
);

-- assumed_option_id semantics:
--   NULL  → use standard BudgetSummary algorithm (locked > include_in_budget > worst-case)
--   SET   → use that specific contender's cost_impact, regardless of lock state
--   ON DELETE SET NULL → if the contender is hard-deleted, reverts to standard calculation
--   Soft-deleted contenders: handled client-side via stale ref cleanup (EDGE-1)

CREATE INDEX IF NOT EXISTS idx_ve_package_items_package_id
  ON public.ve_package_items(package_id);
CREATE INDEX IF NOT EXISTS idx_ve_package_items_opportunity_id
  ON public.ve_package_items(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_ve_package_items_project_id
  ON public.ve_package_items(project_id);

-- ============================================================================
-- STEP 3: TIMESTAMPS TRIGGER
-- ============================================================================
DROP TRIGGER IF EXISTS trg_ve_packages_updated_at ON public.ve_packages;
CREATE TRIGGER trg_ve_packages_updated_at
  BEFORE UPDATE ON public.ve_packages
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_update_timestamp();

-- ============================================================================
-- STEP 4: RLS POLICIES
-- ============================================================================
ALTER TABLE public.ve_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ve_package_items ENABLE ROW LEVEL SECURITY;

-- ve_packages: SELECT — all project members can view
CREATE POLICY "Members can view project packages" ON public.ve_packages
  FOR SELECT USING (
    public.is_platform_admin()
    OR (is_deleted = false AND public.get_user_project_role(project_id) IS NOT NULL)
  );

-- ve_packages: INSERT
CREATE POLICY "Authorized members can create packages" ON public.ve_packages
  FOR INSERT WITH CHECK (public.has_project_permission(project_id, 'can_edit_records'));

-- ve_packages: UPDATE
CREATE POLICY "Authorized members can update packages" ON public.ve_packages
  FOR UPDATE USING (public.has_project_permission(project_id, 'can_edit_records'));

-- ve_packages: DELETE
CREATE POLICY "Admins can delete packages" ON public.ve_packages
  FOR DELETE USING (public.has_project_permission(project_id, 'can_delete_records'));

-- ve_package_items: SELECT (uses denormalized project_id — no join needed)
CREATE POLICY "Members can view package items" ON public.ve_package_items
  FOR SELECT USING (
    public.is_platform_admin()
    OR public.get_user_project_role(project_id) IS NOT NULL
  );

-- ve_package_items: INSERT
CREATE POLICY "Authorized members can add package items" ON public.ve_package_items
  FOR INSERT WITH CHECK (public.has_project_permission(project_id, 'can_edit_records'));

-- ve_package_items: UPDATE (for contender selection + reorder)
CREATE POLICY "Authorized members can update package items" ON public.ve_package_items
  FOR UPDATE USING (public.has_project_permission(project_id, 'can_edit_records'));

-- ve_package_items: DELETE
CREATE POLICY "Authorized members can remove package items" ON public.ve_package_items
  FOR DELETE USING (public.has_project_permission(project_id, 'can_edit_records'));

-- ============================================================================
-- STEP 5: AUDIT TRIGGER BINDINGS
-- Per canonical process_audit_log() instructions (supabase_schema.sql L603-608):
--   1. ELSIF branch for project_id extraction → updated in supabase_schema.sql
--   2. is_deleted soft-delete clause → ve_packages added in supabase_schema.sql
--   3. TRIGGER bindings → created here in the feature migration
-- ============================================================================
DROP TRIGGER IF EXISTS trg_audit_ve_packages ON public.ve_packages;
CREATE TRIGGER trg_audit_ve_packages
  AFTER INSERT OR UPDATE OR DELETE ON public.ve_packages
  FOR EACH ROW EXECUTE FUNCTION process_audit_log();

DROP TRIGGER IF EXISTS trg_audit_ve_package_items ON public.ve_package_items;
CREATE TRIGGER trg_audit_ve_package_items
  AFTER INSERT OR UPDATE OR DELETE ON public.ve_package_items
  FOR EACH ROW EXECUTE FUNCTION process_audit_log();
