-- Design Pulse Database Schema (Unified Source of Truth)
-- Run this entire script in your Supabase SQL Editor to initialize or reset the environment.

DO $$ BEGIN
    CREATE TYPE project_role AS ENUM ('owner', 'gc_admin', 'design_team', 'viewer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 1. Projects Table
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 1.5 Platform Admins Table
CREATE TABLE IF NOT EXISTS platform_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 1.6 Project Members (Junction Table)
CREATE TABLE IF NOT EXISTS project_members (
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role project_role NOT NULL,
  PRIMARY KEY (project_id, user_id)
);

-- 2. Project Settings Table
CREATE TABLE IF NOT EXISTS project_settings (
  project_id uuid PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  categories jsonb DEFAULT '["Existing Conditions", "Arch Plans/Specs", "Owner Standard", "Budgeted Item", "Other"]'::jsonb,
  scopes jsonb DEFAULT '["Corridor / Common", "Unit Interiors", "Back of House"]'::jsonb,
  sidebar_items jsonb DEFAULT '[{"id": "dashboard", "label": "VE Matrix", "iconName": "LayoutDashboard", "visible": true}, {"id": "map", "label": "Map View", "iconName": "Map", "visible": true}, {"id": "analytics", "label": "Analytics", "iconName": "PieChart", "visible": true}, {"id": "coordination", "label": "Coordination Tracker", "iconName": "ListChecks", "visible": true}]'::jsonb,
  disciplines jsonb DEFAULT '[{"id": "d_arch", "label": "Arch"}, {"id": "d_civil", "label": "Civil"}, {"id": "d_struct", "label": "Struct"}, {"id": "d_mech", "label": "Mech"}, {"id": "d_elec", "label": "Elec"}, {"id": "d_plumb", "label": "Plumb"}]'::jsonb,
  project_name text,
  location text,
  original_budget numeric DEFAULT 5000000,
  enable_audit_logging boolean DEFAULT false,
  ve_column_order jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2.5 Project Sequences Table (For VE-001 IDs)
CREATE TABLE IF NOT EXISTS project_sequences (
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  current_value integer DEFAULT 0
);

-- Safely ensure the primary key exists in case the table was created previously without one
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'project_sequences'::regclass 
    AND contype = 'p'
  ) THEN
    ALTER TABLE project_sequences ADD PRIMARY KEY (project_id);
  END IF;
EXCEPTION WHEN OTHERS THEN 
  NULL; 
END $$;

-- 3. Opportunities (VE Log Items) Table
CREATE TABLE IF NOT EXISTS opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New Option',
  location text,
  scope text DEFAULT 'General',
  arch_plans_spec text,
  bok_standard text,
  existing_conditions text,
  mep_impact text,
  owner_goals text,
  backing_required text,
  coordination_required text,
  design_lock_phase text,
  final_direction text,
  assignee text,
  due_date text,
  status text DEFAULT 'Draft',
  cost_impact numeric DEFAULT 0,
  days_impact numeric DEFAULT 0,
  design_markups jsonb DEFAULT '[]'::jsonb,
  display_id text,
  priority text DEFAULT 'Medium' CHECK (priority IN ('Critical', 'High', 'Medium', 'Low')),
  division text,
  cost_code text,
  record_type text DEFAULT 'VE' CHECK (record_type IN ('VE', 'Coordination')),
  coordination_details jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Opportunity Options (Contenders) Table
CREATE TABLE IF NOT EXISTS opportunity_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  title text NOT NULL,
  cost_impact numeric DEFAULT 0,
  days_impact numeric DEFAULT 0,
  description text,
  category text,
  order_index integer DEFAULT 0,
  is_locked boolean DEFAULT false,
  include_in_budget boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Global Cost Codes Table
CREATE TABLE IF NOT EXISTS cost_codes (
  code text PRIMARY KEY,
  description text NOT NULL,
  is_division boolean DEFAULT false,
  parent_division text,
  category_l boolean DEFAULT false,
  category_m boolean DEFAULT false,
  category_s boolean DEFAULT false,
  category_o boolean DEFAULT false
);

-- 5.5 Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id uuid NOT NULL,
  table_name text NOT NULL,
  action_type text NOT NULL,
  old_payload jsonb,
  new_payload jsonb,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Helper RPCs for Authorization (MUST be defined before RLS)
CREATE OR REPLACE FUNCTION public.is_platform_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS(SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.get_user_project_role(p_project_id uuid)
RETURNS project_role
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM public.project_members 
  WHERE project_id = p_project_id AND user_id = auth.uid();
$$;

-- 7. Enable RLS (Row Level Security)
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 8. Security Policies

-- Platform Admins
DROP POLICY IF EXISTS "Platform admins can view platform_admins" ON platform_admins;
CREATE POLICY "Platform admins can view platform_admins" ON platform_admins FOR SELECT USING (true);
DROP POLICY IF EXISTS "Only platform admins can insert platform_admins" ON platform_admins;
CREATE POLICY "Only platform admins can insert platform_admins" ON platform_admins FOR INSERT WITH CHECK (is_platform_admin());
DROP POLICY IF EXISTS "Only platform admins can delete platform_admins" ON platform_admins;
CREATE POLICY "Only platform admins can delete platform_admins" ON platform_admins FOR DELETE USING (is_platform_admin());

-- Cost Codes
DROP POLICY IF EXISTS "Anyone can view cost codes" ON cost_codes;
CREATE POLICY "Anyone can view cost codes" ON cost_codes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Only admins can modify cost codes" ON cost_codes;
CREATE POLICY "Only admins can modify cost codes" ON cost_codes FOR ALL USING (is_platform_admin());

-- Project Members
DROP POLICY IF EXISTS "Members can view their own memberships" ON project_members;
DROP POLICY IF EXISTS "Members can view project team" ON project_members;
CREATE POLICY "Members can view project team" 
  ON project_members FOR SELECT USING (is_platform_admin() OR public.get_user_project_role(project_id) IS NOT NULL);

DROP POLICY IF EXISTS "Admins can insert project members" ON project_members;
CREATE POLICY "Admins can insert project members" 
  ON project_members FOR INSERT WITH CHECK (is_platform_admin() OR public.get_user_project_role(project_id) IN ('owner', 'gc_admin'));

DROP POLICY IF EXISTS "Admins can update project members" ON project_members;
CREATE POLICY "Admins can update project members" 
  ON project_members FOR UPDATE USING (is_platform_admin() OR public.get_user_project_role(project_id) IN ('owner', 'gc_admin'));

DROP POLICY IF EXISTS "Admins can delete project members" ON project_members;
CREATE POLICY "Admins can delete project members" 
  ON project_members FOR DELETE USING (is_platform_admin() OR public.get_user_project_role(project_id) IN ('owner', 'gc_admin'));

-- Projects
DROP POLICY IF EXISTS "Members can view projects" ON projects;
DROP POLICY IF EXISTS "Members or Admins can view projects" ON projects;
CREATE POLICY "Members or Admins can view projects" 
  ON projects FOR SELECT USING (is_platform_admin() OR public.get_user_project_role(id) IS NOT NULL);

-- Project Settings
DROP POLICY IF EXISTS "Members can view project_settings" ON project_settings;
DROP POLICY IF EXISTS "Members or Admins can view project_settings" ON project_settings;
CREATE POLICY "Members or Admins can view project_settings" 
  ON project_settings FOR SELECT USING (is_platform_admin() OR public.get_user_project_role(project_id) IS NOT NULL);

DROP POLICY IF EXISTS "Admins can insert project_settings" ON project_settings;
CREATE POLICY "Admins can insert project_settings" 
  ON project_settings FOR INSERT WITH CHECK (is_platform_admin() OR public.get_user_project_role(project_id) IN ('owner', 'gc_admin'));

DROP POLICY IF EXISTS "Admins can update project_settings" ON project_settings;
CREATE POLICY "Admins can update project_settings" 
  ON project_settings FOR UPDATE USING (is_platform_admin() OR public.get_user_project_role(project_id) IN ('owner', 'gc_admin'));

-- Opportunities
DROP POLICY IF EXISTS "Members can view opportunities" ON opportunities;
DROP POLICY IF EXISTS "Members or Admins can view opportunities" ON opportunities;
CREATE POLICY "Members or Admins can view opportunities" 
  ON opportunities FOR SELECT USING (is_platform_admin() OR public.get_user_project_role(project_id) IS NOT NULL);

DROP POLICY IF EXISTS "Members can insert opportunities" ON opportunities;
CREATE POLICY "Members can insert opportunities" 
  ON opportunities FOR INSERT WITH CHECK (is_platform_admin() OR public.get_user_project_role(project_id) IN ('owner', 'gc_admin', 'design_team'));

DROP POLICY IF EXISTS "Members can update opportunities" ON opportunities;
CREATE POLICY "Members can update opportunities" 
  ON opportunities FOR UPDATE USING (is_platform_admin() OR public.get_user_project_role(project_id) IN ('owner', 'gc_admin', 'design_team'));

DROP POLICY IF EXISTS "Admins can delete opportunities" ON opportunities;
CREATE POLICY "Admins can delete opportunities" 
  ON opportunities FOR DELETE USING (is_platform_admin() OR public.get_user_project_role(project_id) IN ('owner', 'gc_admin'));

-- Opportunity Options
DROP POLICY IF EXISTS "Members can view opportunity_options" ON opportunity_options;
DROP POLICY IF EXISTS "Members or Admins can view opportunity_options" ON opportunity_options;
CREATE POLICY "Members or Admins can view opportunity_options" 
  ON opportunity_options FOR SELECT USING (
    is_platform_admin() OR EXISTS (
      SELECT 1 FROM opportunities WHERE opportunities.id = opportunity_options.opportunity_id AND public.get_user_project_role(opportunities.project_id) IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Members can insert opportunity_options" ON opportunity_options;
CREATE POLICY "Members can insert opportunity_options" 
  ON opportunity_options FOR INSERT WITH CHECK (
    is_platform_admin() OR EXISTS (
      SELECT 1 FROM opportunities WHERE opportunities.id = opportunity_id AND public.get_user_project_role(opportunities.project_id) IN ('owner', 'gc_admin', 'design_team')
    )
  );

DROP POLICY IF EXISTS "Members can update opportunity_options" ON opportunity_options;
CREATE POLICY "Members can update opportunity_options" 
  ON opportunity_options FOR UPDATE USING (
    is_platform_admin() OR EXISTS (
      SELECT 1 FROM opportunities WHERE opportunities.id = opportunity_id AND public.get_user_project_role(opportunities.project_id) IN ('owner', 'gc_admin', 'design_team')
    )
  );

DROP POLICY IF EXISTS "Admins can delete opportunity_options" ON opportunity_options;
CREATE POLICY "Admins can delete opportunity_options" 
  ON opportunity_options FOR DELETE USING (
    is_platform_admin() OR EXISTS (
      SELECT 1 FROM opportunities WHERE opportunities.id = opportunity_id AND public.get_user_project_role(opportunities.project_id) IN ('owner', 'gc_admin')
    )
  );

-- Audit Logs
DROP POLICY IF EXISTS "Admins can view all audit logs" ON audit_logs;
CREATE POLICY "Admins can view all audit logs" 
  ON audit_logs FOR SELECT 
  USING (is_platform_admin());

DROP POLICY IF EXISTS "Project Admins can view project audit logs" ON audit_logs;
CREATE POLICY "Project Admins can view project audit logs" 
  ON audit_logs FOR SELECT 
  USING (public.get_user_project_role(project_id::uuid) IN ('owner', 'gc_admin'));

-- 9. RPCs (Stored Procedures)

CREATE OR REPLACE FUNCTION create_new_project(p_name text, p_description text)
RETURNS SETOF projects
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_project projects%ROWTYPE;
BEGIN
  INSERT INTO projects (name, description) VALUES (p_name, p_description) RETURNING * INTO v_project;
  INSERT INTO project_members (project_id, user_id, role) VALUES (v_project.id, auth.uid(), 'owner');
  RETURN NEXT v_project;
  RETURN;
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
       WHERE pm.user_id = auth.uid() 
         AND pm.role IN ('owner', 'gc_admin')
     );
$$;

CREATE OR REPLACE FUNCTION get_project_members_with_email(p_project_id UUID)
RETURNS TABLE (project_id uuid, user_id uuid, role project_role, email text, name text)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT (public.is_platform_admin() OR public.get_user_project_role(p_project_id) IS NOT NULL) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT pm.project_id, pm.user_id, pm.role, u.email::text, (u.raw_user_meta_data->>'display_name')::text as name
  FROM project_members pm
  JOIN auth.users u ON u.id = pm.user_id
  WHERE pm.project_id = p_project_id;
END;
$$;

CREATE OR REPLACE FUNCTION generate_opportunity_display_id()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  next_val integer;
BEGIN
  INSERT INTO project_sequences (project_id, current_value)
  VALUES (NEW.project_id, 1)
  ON CONFLICT (project_id) 
  DO UPDATE SET current_value = project_sequences.current_value + 1
  RETURNING current_value INTO next_val;

  IF NEW.record_type = 'Coordination' THEN
    NEW.display_id := 'CD-' || LPAD(next_val::text, 3, '0');
  ELSE
    NEW.display_id := 'VE-' || LPAD(next_val::text, 3, '0');
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION lock_opportunity_option(p_option_id UUID, p_opp_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_option_title text;
  v_option_cost numeric;
  v_option_days numeric;
  v_project_id uuid;
BEGIN
  SELECT project_id INTO v_project_id FROM opportunities WHERE id = p_opp_id;
  IF NOT (public.is_platform_admin() OR public.get_user_project_role(v_project_id) IN ('owner', 'gc_admin')) THEN
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
DECLARE
  v_project_id uuid;
BEGIN
  SELECT project_id INTO v_project_id FROM opportunities WHERE id = p_opp_id;
  IF NOT (public.is_platform_admin() OR public.get_user_project_role(v_project_id) IN ('owner', 'gc_admin')) THEN
    RAISE EXCEPTION 'Unauthorized: Insufficient privileges to toggle budget';
  END IF;

  UPDATE opportunity_options SET include_in_budget = p_is_included WHERE id = p_option_id;
END;
$$;

CREATE OR REPLACE FUNCTION enforce_financial_immutability()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
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

CREATE OR REPLACE FUNCTION sync_parent_opportunity_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_opp_id uuid;
  v_cost_impact numeric := 0;
  v_days_impact numeric := 0;
  v_has_options boolean := false;
BEGIN
  IF TG_OP = 'DELETE' THEN v_opp_id := OLD.opportunity_id; ELSE v_opp_id := NEW.opportunity_id; END IF;

  SELECT EXISTS(SELECT 1 FROM opportunity_options WHERE opportunity_id = v_opp_id) INTO v_has_options;

  IF v_has_options THEN
    IF EXISTS (SELECT 1 FROM opportunity_options WHERE opportunity_id = v_opp_id AND is_locked = true) THEN
      SELECT COALESCE(cost_impact, 0), COALESCE(days_impact, 0) INTO v_cost_impact, v_days_impact FROM opportunity_options WHERE opportunity_id = v_opp_id AND is_locked = true LIMIT 1;
    ELSIF EXISTS (SELECT 1 FROM opportunity_options WHERE opportunity_id = v_opp_id AND include_in_budget = true) THEN
      SELECT COALESCE(SUM(cost_impact), 0), COALESCE(SUM(days_impact), 0) INTO v_cost_impact, v_days_impact FROM opportunity_options WHERE opportunity_id = v_opp_id AND include_in_budget = true;
    ELSE
      SELECT COALESCE(MAX(cost_impact), 0), COALESCE(MAX(days_impact), 0) INTO v_cost_impact, v_days_impact FROM opportunity_options WHERE opportunity_id = v_opp_id;
    END IF;

    UPDATE opportunities SET cost_impact = v_cost_impact, days_impact = v_days_impact WHERE id = v_opp_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

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
    INSERT INTO audit_logs (record_id, table_name, action_type, old_payload, new_payload, user_id, project_id) VALUES (NEW.id, TG_TABLE_NAME, 'UPDATE', row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb, auth.uid(), v_project_id);
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

-- 10. Auto Update Timestamps & Bind Triggers
CREATE OR REPLACE FUNCTION auto_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_opportunities_updated_at ON opportunities;
CREATE TRIGGER trg_opportunities_updated_at BEFORE UPDATE ON opportunities FOR EACH ROW EXECUTE FUNCTION auto_update_timestamp();

DROP TRIGGER IF EXISTS trg_opportunity_options_updated_at ON opportunity_options;
CREATE TRIGGER trg_opportunity_options_updated_at BEFORE UPDATE ON opportunity_options FOR EACH ROW EXECUTE FUNCTION auto_update_timestamp();

DROP TRIGGER IF EXISTS trg_generate_opportunity_display_id ON opportunities;
CREATE TRIGGER trg_generate_opportunity_display_id BEFORE INSERT ON opportunities FOR EACH ROW EXECUTE FUNCTION generate_opportunity_display_id();

DROP TRIGGER IF EXISTS trg_enforce_financial_immutability ON opportunities;
CREATE TRIGGER trg_enforce_financial_immutability BEFORE UPDATE ON opportunities FOR EACH ROW EXECUTE FUNCTION enforce_financial_immutability();

DROP TRIGGER IF EXISTS trg_enforce_options_immutability ON opportunity_options;
CREATE TRIGGER trg_enforce_options_immutability BEFORE INSERT OR UPDATE OR DELETE ON opportunity_options FOR EACH ROW EXECUTE FUNCTION enforce_options_immutability();

DROP TRIGGER IF EXISTS trg_sync_parent_opportunity_totals ON opportunity_options;
CREATE TRIGGER trg_sync_parent_opportunity_totals AFTER INSERT OR UPDATE OR DELETE ON opportunity_options FOR EACH ROW EXECUTE FUNCTION sync_parent_opportunity_totals();

DROP TRIGGER IF EXISTS trg_audit_opportunities ON opportunities;
CREATE TRIGGER trg_audit_opportunities AFTER INSERT OR UPDATE OR DELETE ON opportunities FOR EACH ROW EXECUTE FUNCTION process_audit_log();

DROP TRIGGER IF EXISTS trg_audit_opportunity_options ON opportunity_options;
CREATE TRIGGER trg_audit_opportunity_options AFTER INSERT OR UPDATE OR DELETE ON opportunity_options FOR EACH ROW EXECUTE FUNCTION process_audit_log();
