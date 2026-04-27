-- ==========================================
-- DYNAMIC RBAC & ESCAPE HATCH MIGRATION
-- ==========================================

-- 1. Create the Dynamic Permissions Schema
CREATE TABLE IF NOT EXISTS role_permissions (
  role project_role PRIMARY KEY,
  can_lock_options boolean DEFAULT false,
  can_unlock_options boolean DEFAULT false,
  can_manage_team boolean DEFAULT false,
  can_edit_project_settings boolean DEFAULT false,
  can_manage_budget boolean DEFAULT false,
  can_edit_records boolean DEFAULT false,
  can_delete_records boolean DEFAULT false,
  can_view_audit_logs boolean DEFAULT false
);

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- Global read access for all authenticated users
CREATE POLICY "Anyone can view role_permissions" ON role_permissions FOR SELECT USING (true);
-- Only platform admins can modify the global matrix
CREATE POLICY "Only admins can modify role_permissions" ON role_permissions FOR ALL USING (is_platform_admin());

-- Seed default matrix to exactly match current hardcoded system behavior
INSERT INTO role_permissions (role, can_lock_options, can_unlock_options, can_manage_team, can_edit_project_settings, can_manage_budget, can_edit_records, can_delete_records, can_view_audit_logs) VALUES
  ('owner', true, true, true, true, true, true, true, true),
  ('gc_admin', true, true, true, true, true, true, true, true),
  ('design_team', false, false, false, false, false, true, false, false),
  ('viewer', false, false, false, false, false, false, false, false)
ON CONFLICT (role) DO UPDATE SET
  can_lock_options = EXCLUDED.can_lock_options,
  can_unlock_options = EXCLUDED.can_unlock_options,
  can_manage_team = EXCLUDED.can_manage_team,
  can_edit_project_settings = EXCLUDED.can_edit_project_settings,
  can_manage_budget = EXCLUDED.can_manage_budget,
  can_edit_records = EXCLUDED.can_edit_records,
  can_delete_records = EXCLUDED.can_delete_records,
  can_view_audit_logs = EXCLUDED.can_view_audit_logs;


-- 2. High-Performance RBAC Helper Function
-- Guardrail Compliant: Chains off get_user_project_role to prevent infinite recursion on project_members
CREATE OR REPLACE FUNCTION public.has_project_permission(p_project_id uuid, p_permission text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT 
    public.is_platform_admin() OR 
    EXISTS (
      SELECT 1 FROM role_permissions rp
      WHERE rp.role = public.get_user_project_role(p_project_id)
        AND (
          (p_permission = 'can_lock_options' AND rp.can_lock_options = true) OR
          (p_permission = 'can_unlock_options' AND rp.can_unlock_options = true) OR
          (p_permission = 'can_manage_team' AND rp.can_manage_team = true) OR
          (p_permission = 'can_edit_project_settings' AND rp.can_edit_project_settings = true) OR
          (p_permission = 'can_manage_budget' AND rp.can_manage_budget = true) OR
          (p_permission = 'can_edit_records' AND rp.can_edit_records = true) OR
          (p_permission = 'can_delete_records' AND rp.can_delete_records = true) OR
          (p_permission = 'can_view_audit_logs' AND rp.can_view_audit_logs = true)
        )
    );
$$;


-- 3. Implement Immutability Escape Hatches
CREATE OR REPLACE FUNCTION enforce_financial_immutability()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- ESCAPE HATCH: Bypass if the transaction-scoped variable is set
  IF current_setting('designpulse.bypass_immutability', true) = 'true' THEN 
    RETURN NEW; 
  END IF;

  IF OLD.status IN ('Pending Plan Update', 'GC / Owner Review', 'Implemented') THEN
    IF OLD.cost_impact IS DISTINCT FROM NEW.cost_impact OR OLD.days_impact IS DISTINCT FROM NEW.days_impact OR OLD.title IS DISTINCT FROM NEW.title THEN
      RAISE EXCEPTION 'Financial immutability enforced: Cannot modify core fields of locked records';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION enforce_options_immutability()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_parent_status text;
BEGIN
  -- ESCAPE HATCH: Bypass for child records as well
  IF current_setting('designpulse.bypass_immutability', true) = 'true' THEN 
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    SELECT status INTO v_parent_status FROM opportunities WHERE id = OLD.opportunity_id;
  ELSE
    SELECT status INTO v_parent_status FROM opportunities WHERE id = NEW.opportunity_id;
  END IF;

  IF v_parent_status IN ('Pending Plan Update', 'GC / Owner Review', 'Implemented') THEN
    RAISE EXCEPTION 'Financial immutability enforced: Cannot modify options of a locked opportunity';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;


-- 4. Create the Unlock RPC
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
  UPDATE opportunities SET status = 'Draft', final_direction = NULL WHERE id = p_opp_id;
END;
$$;


-- 5. Refactor Existing RPCs
CREATE OR REPLACE FUNCTION lock_opportunity_option(p_option_id UUID, p_opp_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_option_title text;
  v_option_cost numeric;
  v_option_days numeric;
BEGIN
  IF NOT public.has_project_permission((SELECT project_id FROM opportunities WHERE id = p_opp_id), 'can_lock_options') THEN
    RAISE EXCEPTION 'Unauthorized: Insufficient privileges to lock options';
  END IF;

  UPDATE opportunities SET status = 'Draft' WHERE id = p_opp_id;
  UPDATE opportunity_options SET is_locked = false WHERE opportunity_id = p_opp_id;
  UPDATE opportunity_options SET is_locked = true WHERE id = p_option_id RETURNING title, cost_impact, days_impact INTO v_option_title, v_option_cost, v_option_days;
  UPDATE opportunities SET final_direction = 'Locked: ' || v_option_title, status = 'Pending Plan Update', cost_impact = v_option_cost, days_impact = v_option_days WHERE id = p_opp_id;
END;
$$;

CREATE OR REPLACE FUNCTION toggle_option_budget(p_option_id UUID, p_opp_id UUID, p_is_included BOOLEAN)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT public.has_project_permission((SELECT project_id FROM opportunities WHERE id = p_opp_id), 'can_manage_budget') THEN
    RAISE EXCEPTION 'Unauthorized: Insufficient privileges to toggle budget';
  END IF;

  UPDATE opportunity_options SET include_in_budget = p_is_included WHERE id = p_option_id;
END;
$$;

CREATE OR REPLACE FUNCTION get_system_users()
RETURNS TABLE (id uuid, email text, name text, is_platform_admin boolean)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT 
    u.id, 
    u.email::text, 
    (u.raw_user_meta_data->>'display_name')::text as name,
    EXISTS(SELECT 1 FROM platform_admins pa WHERE pa.user_id = u.id) as is_platform_admin
  FROM auth.users u
  WHERE public.is_platform_admin() 
     OR EXISTS (
       SELECT 1 FROM project_members pm
       JOIN role_permissions rp ON rp.role = pm.role
       WHERE pm.user_id = auth.uid() 
         AND rp.can_manage_team = true
     );
$$;


-- 6. Upgrade RLS Policies to use Dynamic RBAC
-- Project Members
DROP POLICY IF EXISTS "Admins can insert project members" ON project_members;
CREATE POLICY "Admins can insert project members" 
  ON project_members FOR INSERT WITH CHECK (public.has_project_permission(project_id, 'can_manage_team'));

DROP POLICY IF EXISTS "Admins can update project members" ON project_members;
CREATE POLICY "Admins can update project members" 
  ON project_members FOR UPDATE USING (public.has_project_permission(project_id, 'can_manage_team'));

DROP POLICY IF EXISTS "Admins can delete project members" ON project_members;
CREATE POLICY "Admins can delete project members" 
  ON project_members FOR DELETE USING (public.has_project_permission(project_id, 'can_manage_team'));

-- Project Settings
DROP POLICY IF EXISTS "Admins can insert project_settings" ON project_settings;
CREATE POLICY "Admins can insert project_settings" 
  ON project_settings FOR INSERT WITH CHECK (public.has_project_permission(project_id, 'can_edit_project_settings'));

DROP POLICY IF EXISTS "Admins can update project_settings" ON project_settings;
CREATE POLICY "Admins can update project_settings" 
  ON project_settings FOR UPDATE USING (public.has_project_permission(project_id, 'can_edit_project_settings'));

-- Opportunities
DROP POLICY IF EXISTS "Members can insert opportunities" ON opportunities;
CREATE POLICY "Members can insert opportunities" 
  ON opportunities FOR INSERT WITH CHECK (public.has_project_permission(project_id, 'can_edit_records'));

DROP POLICY IF EXISTS "Members can update opportunities" ON opportunities;
CREATE POLICY "Members can update opportunities" 
  ON opportunities FOR UPDATE USING (public.has_project_permission(project_id, 'can_edit_records'));

DROP POLICY IF EXISTS "Admins can delete opportunities" ON opportunities;
CREATE POLICY "Admins can delete opportunities" 
  ON opportunities FOR DELETE USING (public.has_project_permission(project_id, 'can_delete_records'));

-- Opportunity Options
DROP POLICY IF EXISTS "Members can insert opportunity_options" ON opportunity_options;
CREATE POLICY "Members can insert opportunity_options" 
  ON opportunity_options FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM opportunities WHERE opportunities.id = opportunity_id AND public.has_project_permission(opportunities.project_id, 'can_edit_records')
    )
  );

DROP POLICY IF EXISTS "Members can update opportunity_options" ON opportunity_options;
CREATE POLICY "Members can update opportunity_options" 
  ON opportunity_options FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM opportunities WHERE opportunities.id = opportunity_id AND public.has_project_permission(opportunities.project_id, 'can_edit_records')
    )
  );

DROP POLICY IF EXISTS "Admins can delete opportunity_options" ON opportunity_options;
CREATE POLICY "Admins can delete opportunity_options" 
  ON opportunity_options FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM opportunities WHERE opportunities.id = opportunity_id AND public.has_project_permission(opportunities.project_id, 'can_delete_records')
    )
  );

-- Audit Logs
DROP POLICY IF EXISTS "Project Admins can view project audit logs" ON audit_logs;
CREATE POLICY "Project Admins can view project audit logs" 
  ON audit_logs FOR SELECT 
  USING (public.has_project_permission(project_id::uuid, 'can_view_audit_logs'));
