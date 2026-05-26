-- ============================================================================
-- VE SCENARIOS — Scenario Planner Feature Migration
-- Date: 2026-05-26
-- Depends on: projects, ve_packages, ve_package_items,
--             process_audit_log(), auto_update_timestamp(), has_project_permission(),
--             get_user_project_role(), is_platform_admin(),
--             lock_opportunity_option(p_option_id UUID, p_opp_id UUID)
-- ============================================================================

-- ============================================================================
-- STEP 1: ADD scope_id TO ve_packages
-- ============================================================================
-- Loose-referencing via UUID stored in JSONB project_settings.package_scopes
-- (Rule C7 — no FK, resolved client-side)
ALTER TABLE public.ve_packages
  ADD COLUMN IF NOT EXISTS scope_id uuid;

-- ============================================================================
-- STEP 2: VE SCENARIOS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ve_scenarios (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name        text NOT NULL DEFAULT 'New Scenario',
  description text,
  sort_order  integer NOT NULL DEFAULT 0,
  created_by  uuid DEFAULT auth.uid() REFERENCES auth.users(id),
  is_deleted  boolean NOT NULL DEFAULT false,
  created_at  timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  updated_at  timestamptz DEFAULT timezone('utc', now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ve_scenarios_project_id
  ON public.ve_scenarios(project_id);

-- ============================================================================
-- STEP 3: VE SCENARIO PACKAGES (JUNCTION TABLE)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ve_scenario_packages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id   uuid NOT NULL REFERENCES public.ve_scenarios(id) ON DELETE CASCADE,
  package_id    uuid NOT NULL REFERENCES public.ve_packages(id) ON DELETE CASCADE,
  project_id    uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  sort_order    integer NOT NULL DEFAULT 0,
  created_at    timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  UNIQUE(scenario_id, package_id)
);

CREATE INDEX IF NOT EXISTS idx_ve_scenario_packages_scenario_id
  ON public.ve_scenario_packages(scenario_id);
CREATE INDEX IF NOT EXISTS idx_ve_scenario_packages_package_id
  ON public.ve_scenario_packages(package_id);
CREATE INDEX IF NOT EXISTS idx_ve_scenario_packages_project_id
  ON public.ve_scenario_packages(project_id);

-- ============================================================================
-- STEP 4: TIMESTAMPS TRIGGER
-- ============================================================================
DROP TRIGGER IF EXISTS trg_ve_scenarios_updated_at ON public.ve_scenarios;
CREATE TRIGGER trg_ve_scenarios_updated_at
  BEFORE UPDATE ON public.ve_scenarios
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_update_timestamp();

-- ============================================================================
-- STEP 5: RLS POLICIES
-- ============================================================================
ALTER TABLE public.ve_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ve_scenario_packages ENABLE ROW LEVEL SECURITY;

-- ve_scenarios: SELECT — all project members can view
CREATE POLICY "Members can view project scenarios" ON public.ve_scenarios
  FOR SELECT USING (
    public.is_platform_admin()
    OR (is_deleted = false AND public.get_user_project_role(project_id) IS NOT NULL)
  );

-- ve_scenarios: INSERT
CREATE POLICY "Authorized members can create scenarios" ON public.ve_scenarios
  FOR INSERT WITH CHECK (public.has_project_permission(project_id, 'can_edit_records'));

-- ve_scenarios: UPDATE
CREATE POLICY "Authorized members can update scenarios" ON public.ve_scenarios
  FOR UPDATE USING (public.has_project_permission(project_id, 'can_edit_records'));

-- ve_scenarios: DELETE
CREATE POLICY "Admins can delete scenarios" ON public.ve_scenarios
  FOR DELETE USING (public.has_project_permission(project_id, 'can_delete_records'));

-- ve_scenario_packages: SELECT
CREATE POLICY "Members can view scenario packages" ON public.ve_scenario_packages
  FOR SELECT USING (
    public.is_platform_admin()
    OR public.get_user_project_role(project_id) IS NOT NULL
  );

-- ve_scenario_packages: INSERT
CREATE POLICY "Authorized members can add scenario packages" ON public.ve_scenario_packages
  FOR INSERT WITH CHECK (public.has_project_permission(project_id, 'can_edit_records'));

-- ve_scenario_packages: UPDATE (for reorder)
CREATE POLICY "Authorized members can update scenario packages" ON public.ve_scenario_packages
  FOR UPDATE USING (public.has_project_permission(project_id, 'can_edit_records'));

-- ve_scenario_packages: DELETE
CREATE POLICY "Authorized members can remove scenario packages" ON public.ve_scenario_packages
  FOR DELETE USING (public.has_project_permission(project_id, 'can_edit_records'));

-- ============================================================================
-- STEP 6: AUDIT TRIGGER BINDINGS
-- ============================================================================
DROP TRIGGER IF EXISTS trg_audit_ve_scenarios ON public.ve_scenarios;
CREATE TRIGGER trg_audit_ve_scenarios
  AFTER INSERT OR UPDATE OR DELETE ON public.ve_scenarios
  FOR EACH ROW EXECUTE FUNCTION process_audit_log();

DROP TRIGGER IF EXISTS trg_audit_ve_scenario_packages ON public.ve_scenario_packages;
CREATE TRIGGER trg_audit_ve_scenario_packages
  AFTER INSERT OR UPDATE OR DELETE ON public.ve_scenario_packages
  FOR EACH ROW EXECUTE FUNCTION process_audit_log();

-- ============================================================================
-- STEP 7: apply_ve_scenario RPC
-- Batch-locks all contenders across all packages in a scenario.
-- DR-1: lock_opportunity_option requires TWO params (p_option_id, p_opp_id).
-- DR-2: DISTINCT ON (opportunity_id) ORDER BY sort_order ensures first-package-wins.
-- ============================================================================
CREATE OR REPLACE FUNCTION apply_ve_scenario(p_scenario_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id uuid;
  v_item RECORD;
  v_locked_count int := 0;
  v_skipped_count int := 0;
BEGIN
  -- 1. Fetch and validate
  SELECT s.project_id INTO v_project_id
  FROM ve_scenarios s WHERE s.id = p_scenario_id AND NOT s.is_deleted;
  
  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Scenario not found or deleted';
  END IF;

  -- 2. RBAC check
  IF NOT has_project_permission(v_project_id, 'can_edit_records') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  -- 3. Iterate all package items with assumed contenders
  -- DISTINCT ON (opportunity_id) ensures one lock per opportunity
  -- First package by sort_order wins if same opp appears in multiple packages
  FOR v_item IN
    SELECT DISTINCT ON (pi.opportunity_id)
      pi.opportunity_id, pi.assumed_option_id
    FROM ve_scenario_packages sp
    JOIN ve_package_items pi ON pi.package_id = sp.package_id
    WHERE sp.scenario_id = p_scenario_id
      AND pi.assumed_option_id IS NOT NULL
    ORDER BY pi.opportunity_id, sp.sort_order
  LOOP
    -- 4. Call existing lock RPC per item (reuses full lock workflow)
    -- DR-1: lock_opportunity_option requires TWO params: (p_option_id, p_opp_id)
    PERFORM lock_opportunity_option(v_item.assumed_option_id, v_item.opportunity_id);
    v_locked_count := v_locked_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'locked', v_locked_count,
    'skipped', v_skipped_count
  );
END;
$$;
