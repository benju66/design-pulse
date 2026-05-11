-- Design Pulse Database Schema (Unified Source of Truth)
-- Run this entire script in your Supabase SQL Editor to initialize or reset the environment.

DO $$ BEGIN
    CREATE TYPE project_role AS ENUM ('project_admin', 'gc_admin', 'design_team', 'viewer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 1. Projects Table
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  project_number text UNIQUE,
  procore_project_id text UNIQUE,
  procore_company_id text,
  is_archived boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Safely add columns if the table already exists
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS procore_project_id text UNIQUE,
ADD COLUMN IF NOT EXISTS procore_company_id text;

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
  building_areas jsonb DEFAULT '["Corridor / Common", "Unit Interiors", "Back of House"]'::jsonb,
  sidebar_items jsonb DEFAULT '[{"id": "dashboard", "label": "VE Matrix", "iconName": "LayoutDashboard", "visible": true}, {"id": "map", "label": "Map View", "iconName": "Map", "visible": true}, {"id": "analytics", "label": "Analytics", "iconName": "PieChart", "visible": true}, {"id": "coordination", "label": "Coordination Tracker", "iconName": "ListChecks", "visible": true}]'::jsonb,
  disciplines jsonb DEFAULT '[{"id": "d_arch", "label": "Arch"}, {"id": "d_civil", "label": "Civil"}, {"id": "d_struct", "label": "Struct"}, {"id": "d_mech", "label": "Mech"}, {"id": "d_elec", "label": "Elec"}, {"id": "d_plumb", "label": "Plumbg"}, {"id": "d_fp", "label": "FP"}, {"id": "d_lv", "label": "LV"}, {"id": "d_proc", "label": "Proc"}, {"id": "d_owner", "label": "Owner"}, {"id": "d_gc", "label": "GC"}]'::jsonb,
  project_name text,
  location text,
  original_budget numeric DEFAULT 0,
  enable_audit_logging boolean DEFAULT false,
  ve_column_order jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE project_settings 
ADD COLUMN IF NOT EXISTS permit_types jsonb DEFAULT '[{"id": "93f2f811-0a6f-4d9b-a320-1a7638d17a3a", "label": "Building (Core & Shell)"}, {"id": "e3b6a9c1-7f9e-4b45-97c4-a4b51381e7d2", "label": "Electrical"}, {"id": "0b14c356-9e12-4c2f-b4e8-8a562e153f91", "label": "Plumbing"}]'::jsonb,
ADD COLUMN IF NOT EXISTS permit_ahjs jsonb DEFAULT '[{"id": "550e8400-e29b-41d4-a716-446655440000", "label": "City"}, {"id": "713f0a00-1c3f-4e00-84f9-25f0535c0001", "label": "State"}]'::jsonb;

-- 2.5 Project Sequences Table (For VE-001 IDs)
CREATE TABLE IF NOT EXISTS project_sequences (
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  ve_current_value integer DEFAULT 0,
  cd_current_value integer DEFAULT 0,
  per_current_value integer DEFAULT 0
);

ALTER TABLE project_sequences ADD COLUMN IF NOT EXISTS per_current_value integer DEFAULT 0;

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
  building_area text,
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
  coordination_status text DEFAULT 'Draft',
  cost_impact numeric DEFAULT 0,
  days_impact numeric DEFAULT 0,
  design_markups jsonb DEFAULT '[]'::jsonb,
  display_id text,
  priority text DEFAULT 'Set Priority' CHECK (priority IN ('Critical', 'High', 'Medium', 'Low', 'Set Priority')),
  division text,
  cost_code text,
  record_type text DEFAULT 'VE' CHECK (record_type IN ('VE', 'Coordination')),
  coordination_details jsonb DEFAULT '{}'::jsonb,
  description text,
  is_deleted boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Opportunity Options (Contenders) Table
CREATE TABLE IF NOT EXISTS opportunity_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  cost_impact numeric DEFAULT 0,
  days_impact numeric DEFAULT 0,
  description text,
  category text,
  order_index integer DEFAULT 0,
  is_locked boolean DEFAULT false,
  include_in_budget boolean DEFAULT false,
  requires_coordination boolean DEFAULT true,
  coordination_requirements jsonb DEFAULT '{}'::jsonb,
  is_deleted boolean DEFAULT false,
  cost_code text,
  division text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4.4 Permit Helpers
CREATE OR REPLACE FUNCTION generate_permit_display_id()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  next_val integer;
BEGIN
  INSERT INTO project_sequences (project_id, ve_current_value, cd_current_value, per_current_value)
  VALUES (NEW.project_id, 0, 0, 1)
  ON CONFLICT (project_id) 
  DO UPDATE SET per_current_value = COALESCE(project_sequences.per_current_value, 0) + 1
  RETURNING per_current_value INTO next_val;

  NEW.display_id := 'PER-' || LPAD(next_val::text, 3, '0');
  RETURN NEW;
END;
$$;

-- 4.5 Permits Table
CREATE TABLE IF NOT EXISTS permits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  display_id text,
  title text NOT NULL,
  permit_type text,
  ahj text,
  status text DEFAULT 'Preparing' CHECK (status IN ('Preparing', 'Submitted', 'Under Review', 'Comments Received', 'Approved')),
  assignee text,
  date_submitted timestamp with time zone,
  target_approval_date timestamp with time zone,
  revision_number integer DEFAULT 0,
  revision_history jsonb DEFAULT '[]'::jsonb,
  is_deleted boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

DROP TRIGGER IF EXISTS set_permit_display_id ON permits;
CREATE TRIGGER set_permit_display_id
BEFORE INSERT ON permits
FOR EACH ROW EXECUTE FUNCTION generate_permit_display_id();

-- 4.6 Permit Task Links (Junction Table)
CREATE TABLE IF NOT EXISTS permit_task_links (
  permit_id uuid NOT NULL REFERENCES permits(id) ON DELETE CASCADE,
  coordination_task_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  PRIMARY KEY (permit_id, coordination_task_id)
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
  category_e boolean DEFAULT false,
  category_o boolean DEFAULT false
);

-- Safely add category_e if the table was created before this column was introduced
ALTER TABLE cost_codes ADD COLUMN IF NOT EXISTS category_e boolean DEFAULT false;

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
ALTER TABLE permits ENABLE ROW LEVEL SECURITY;
ALTER TABLE permit_task_links ENABLE ROW LEVEL SECURITY;

-- 8. Security Policies

-- Platform Admins
DROP POLICY IF EXISTS "Platform admins can view platform_admins" ON platform_admins;
CREATE POLICY "Platform admins can view platform_admins" ON platform_admins FOR SELECT USING (
  public.is_platform_admin() OR user_id = auth.uid()
);
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
  ON project_members FOR INSERT WITH CHECK (is_platform_admin() OR public.get_user_project_role(project_id) IN ('project_admin', 'gc_admin'));

DROP POLICY IF EXISTS "Admins can update project members" ON project_members;
CREATE POLICY "Admins can update project members" 
  ON project_members FOR UPDATE USING (is_platform_admin() OR public.get_user_project_role(project_id) IN ('project_admin', 'gc_admin'));

DROP POLICY IF EXISTS "Admins can delete project members" ON project_members;
CREATE POLICY "Admins can delete project members" 
  ON project_members FOR DELETE USING (is_platform_admin() OR public.get_user_project_role(project_id) IN ('project_admin', 'gc_admin'));

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
  ON project_settings FOR INSERT WITH CHECK (is_platform_admin() OR public.get_user_project_role(project_id) IN ('project_admin', 'gc_admin'));

DROP POLICY IF EXISTS "Admins can update project_settings" ON project_settings;
CREATE POLICY "Admins can update project_settings" 
  ON project_settings FOR UPDATE USING (is_platform_admin() OR public.get_user_project_role(project_id) IN ('project_admin', 'gc_admin'));

-- Opportunities
DROP POLICY IF EXISTS "Members can view opportunities" ON opportunities;
DROP POLICY IF EXISTS "Members or Admins can view opportunities" ON opportunities;
CREATE POLICY "Members or Admins can view opportunities" 
  ON opportunities FOR SELECT USING (is_platform_admin() OR (is_deleted = false AND public.get_user_project_role(project_id) IS NOT NULL));

DROP POLICY IF EXISTS "Members can insert opportunities" ON opportunities;
CREATE POLICY "Members can insert opportunities" 
  ON opportunities FOR INSERT WITH CHECK (is_platform_admin() OR public.get_user_project_role(project_id) IN ('project_admin', 'gc_admin', 'design_team'));

DROP POLICY IF EXISTS "Members can update opportunities" ON opportunities;
CREATE POLICY "Members can update opportunities" 
  ON opportunities FOR UPDATE USING (is_platform_admin() OR public.get_user_project_role(project_id) IN ('project_admin', 'gc_admin', 'design_team'));

DROP POLICY IF EXISTS "Admins can delete opportunities" ON opportunities;
CREATE POLICY "Admins can delete opportunities" 
  ON opportunities FOR DELETE USING (is_platform_admin() OR public.get_user_project_role(project_id) IN ('project_admin', 'gc_admin'));

-- Opportunity Options
DROP POLICY IF EXISTS "Members can view opportunity_options" ON opportunity_options;
DROP POLICY IF EXISTS "Members or Admins can view opportunity_options" ON opportunity_options;
CREATE POLICY "Members or Admins can view opportunity_options" 
  ON opportunity_options FOR SELECT USING (
    is_platform_admin() OR (is_deleted = false AND public.get_user_project_role(project_id) IS NOT NULL)
  );

DROP POLICY IF EXISTS "Members can insert opportunity_options" ON opportunity_options;
CREATE POLICY "Members can insert opportunity_options" 
  ON opportunity_options FOR INSERT WITH CHECK (
    public.get_user_project_role(project_id) IN ('project_admin', 'gc_admin', 'design_team')
  );

DROP POLICY IF EXISTS "Members can update opportunity_options" ON opportunity_options;
CREATE POLICY "Members can update opportunity_options" 
  ON opportunity_options FOR UPDATE USING (
    public.get_user_project_role(project_id) IN ('project_admin', 'gc_admin', 'design_team')
  );

DROP POLICY IF EXISTS "Admins can delete opportunity_options" ON opportunity_options;
CREATE POLICY "Admins can delete opportunity_options" 
  ON opportunity_options FOR DELETE USING (
    public.get_user_project_role(project_id) IN ('project_admin', 'gc_admin')
  );

-- Permits
DROP POLICY IF EXISTS "Members can view permits" ON permits;
CREATE POLICY "Members can view permits" 
  ON permits FOR SELECT USING (
    is_platform_admin() OR (is_deleted = false AND public.get_user_project_role(project_id) IS NOT NULL)
  );

DROP POLICY IF EXISTS "Members can insert permits" ON permits;
CREATE POLICY "Members can insert permits" 
  ON permits FOR INSERT WITH CHECK (
    public.has_project_permission(project_id, 'can_edit_records')
  );

DROP POLICY IF EXISTS "Members can update permits" ON permits;
CREATE POLICY "Members can update permits" 
  ON permits FOR UPDATE USING (
    public.has_project_permission(project_id, 'can_edit_records')
  );

DROP POLICY IF EXISTS "Admins can delete permits" ON permits;
CREATE POLICY "Admins can delete permits" 
  ON permits FOR DELETE USING (
    public.has_project_permission(project_id, 'can_delete_records')
  );

-- Permit Task Links
DROP POLICY IF EXISTS "Members can view permit_task_links" ON permit_task_links;
CREATE POLICY "Members can view permit_task_links" 
  ON permit_task_links FOR SELECT USING (
    is_platform_admin() OR EXISTS (
      SELECT 1 FROM permits WHERE permits.id = permit_id AND permits.is_deleted = false AND public.get_user_project_role(permits.project_id) IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Members can insert permit_task_links" ON permit_task_links;
CREATE POLICY "Members can insert permit_task_links" 
  ON permit_task_links FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM permits WHERE permits.id = permit_id AND public.has_project_permission(permits.project_id, 'can_edit_records')
    )
  );

DROP POLICY IF EXISTS "Members can delete permit_task_links" ON permit_task_links;
CREATE POLICY "Members can delete permit_task_links" 
  ON permit_task_links FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM permits WHERE permits.id = permit_id AND public.has_project_permission(permits.project_id, 'can_edit_records')
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
  USING (public.get_user_project_role(project_id::uuid) IN ('project_admin', 'gc_admin'));

-- 9. RPCs (Stored Procedures)

DROP FUNCTION IF EXISTS create_new_project(text, text, text);
DROP FUNCTION IF EXISTS create_new_project(text, text, text, text, text);

CREATE OR REPLACE FUNCTION create_new_project(
  p_name text, 
  p_description text DEFAULT NULL, 
  p_project_number text DEFAULT NULL,
  p_procore_project_id text DEFAULT NULL,
  p_procore_company_id text DEFAULT NULL,
  p_client_id uuid DEFAULT NULL
)
RETURNS SETOF projects
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_project projects%ROWTYPE;
BEGIN
  -- 1. Create the project record
  INSERT INTO projects (name, description, project_number, procore_project_id, procore_company_id, client_id) 
  VALUES (p_name, p_description, p_project_number, p_procore_project_id, p_procore_company_id, p_client_id) 
  RETURNING * INTO v_project;
  
  -- 2. Assign the creator as owner
  INSERT INTO project_members (project_id, user_id, role) 
  VALUES (v_project.id, auth.uid(), 'project_admin');

  -- 3. Guarantee a settings row exists atomically (Audit fix C-2 / AGENTS.md Rule 25)
  -- ON CONFLICT DO NOTHING makes this idempotent and safe to retry.
  INSERT INTO project_settings (project_id, project_name)
  VALUES (v_project.id, p_name)
  ON CONFLICT (project_id) DO NOTHING;
  
  RETURN NEXT v_project;
  RETURN;
END;
$$;





CREATE OR REPLACE FUNCTION generate_opportunity_display_id()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  next_val integer;
  v_record_type text;
BEGIN
  v_record_type := COALESCE(NEW.record_type, 'VE');

  INSERT INTO project_sequences (project_id, ve_current_value, cd_current_value)
  VALUES (
    NEW.project_id, 
    CASE WHEN v_record_type = 'Coordination' THEN 0 ELSE 1 END,
    CASE WHEN v_record_type = 'Coordination' THEN 1 ELSE 0 END
  )
  ON CONFLICT (project_id) 
  DO UPDATE SET 
    ve_current_value = project_sequences.ve_current_value + CASE WHEN v_record_type = 'Coordination' THEN 0 ELSE 1 END,
    cd_current_value = project_sequences.cd_current_value + CASE WHEN v_record_type = 'Coordination' THEN 1 ELSE 0 END
  RETURNING 
    CASE WHEN v_record_type = 'Coordination' THEN cd_current_value ELSE ve_current_value END INTO next_val;

  IF v_record_type = 'Coordination' THEN
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
  IF NOT (public.is_platform_admin() OR public.get_user_project_role(v_project_id) IN ('project_admin', 'gc_admin')) THEN
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
  IF NOT (public.is_platform_admin() OR public.get_user_project_role(v_project_id) IN ('project_admin', 'gc_admin')) THEN
    RAISE EXCEPTION 'Unauthorized: Insufficient privileges to toggle budget';
  END IF;

  UPDATE opportunity_options SET include_in_budget = p_is_included WHERE id = p_option_id;
END;
$$;

-- Bulk JSONB Reorder for Opportunity Options
CREATE OR REPLACE FUNCTION public.reorder_opportunity_options(p_project_id uuid, p_payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- RBAC Guard
  IF NOT has_project_permission(p_project_id, 'can_edit_records') THEN
    RAISE EXCEPTION 'Unauthorized: Insufficient privileges';
  END IF;

  -- Array Type-Safety Guard (AGENTS.md C21)
  IF jsonb_typeof(COALESCE(p_payload, '[]'::jsonb)) = 'array' THEN
    UPDATE opportunity_options AS o
    SET order_index = (elem->>'order_index')::integer
    FROM jsonb_array_elements(p_payload) AS elem
    WHERE o.id = (elem->>'id')::uuid AND o.project_id = p_project_id;
  END IF;
END;
$$;

-- NOTE: enforce_financial_immutability and enforce_options_immutability are defined
-- below (Section: Implement Immutability Escape Hatches) with the correct escape hatch
-- logic. The definitions that existed here were stale duplicates without escape hatches
-- and have been removed. (Audit fix C-1, 2026-04-30)

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

CREATE OR REPLACE FUNCTION trg_auto_update_coordination_status_fn()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_total_required int := 0;
  v_total_complete int := 0;
  k text;
  v text;
  v_status text;
  v_safe_details jsonb;
BEGIN
  IF NEW.coordination_details IS DISTINCT FROM OLD.coordination_details THEN
    v_safe_details := COALESCE(NEW.coordination_details, '{}'::jsonb);
    
    IF jsonb_typeof(v_safe_details) = 'object' THEN
      FOR k, v IN SELECT key, value FROM jsonb_each_text(v_safe_details) LOOP
        v_status := (v::jsonb)->>'status';
        IF v_status IS NOT NULL AND v_status != 'Not Required' THEN
          v_total_required := v_total_required + 1;
          IF v_status = 'Complete' THEN
            v_total_complete := v_total_complete + 1;
          END IF;
        END IF;
      END LOOP;

      IF v_total_required > 0 AND v_total_required = v_total_complete THEN
        IF NEW.coordination_status IN ('Pending Plan Update') THEN
          NEW.coordination_status := 'Ready for Review';
        END IF;
      ELSIF v_total_complete < v_total_required THEN
        IF OLD.coordination_status IN ('Ready for Review', 'Implemented') THEN
          NEW.coordination_status := 'Pending Plan Update';
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_update_coordination_status ON opportunities;
CREATE TRIGGER trg_auto_update_coordination_status BEFORE UPDATE ON opportunities FOR EACH ROW EXECUTE FUNCTION trg_auto_update_coordination_status_fn();

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
DROP POLICY IF EXISTS "Anyone can view role_permissions" ON role_permissions;
CREATE POLICY "Anyone can view role_permissions" ON role_permissions FOR SELECT USING (true);
-- Only platform admins can modify the global matrix
DROP POLICY IF EXISTS "Only admins can modify role_permissions" ON role_permissions;
CREATE POLICY "Only admins can modify role_permissions" ON role_permissions FOR ALL USING (is_platform_admin());

-- Seed default matrix to exactly match current hardcoded system behavior
INSERT INTO role_permissions (role, can_lock_options, can_unlock_options, can_manage_team, can_edit_project_settings, can_manage_budget, can_edit_records, can_delete_records, can_view_audit_logs) VALUES
  ('project_admin', true, true, true, true, true, true, true, true),
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

  IF OLD.status = 'Approved' THEN
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

  IF v_parent_status = 'Approved' THEN
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
  UPDATE opportunities SET 
    status = 'Draft', 
    final_direction = NULL,
    coordination_status = 'Not Required',
    coordination_details = '{}'::jsonb
  WHERE id = p_opp_id;
END;
$$;


-- 5. Refactor Existing RPCs
CREATE OR REPLACE FUNCTION public.lock_opportunity_option(p_option_id UUID, p_opp_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_option_title text;
  v_option_cost numeric;
  v_option_days numeric;
  v_option_cost_code text;
  v_option_division text;
  v_requires_coord boolean;
  v_coord_reqs jsonb;
  v_new_coord_details jsonb := '{}'::jsonb;
  k text;
  v text;
BEGIN
  IF NOT public.has_project_permission((SELECT project_id FROM opportunities WHERE id = p_opp_id), 'can_lock_options') THEN
    RAISE EXCEPTION 'Unauthorized: Insufficient privileges to lock options';
  END IF;

  -- Open the immutability escape hatch AFTER RBAC check, BEFORE any UPDATE statement.
  -- Required so that intermediate state resets (SET status = 'Draft') do not trigger
  -- enforce_financial_immutability on already-Approved records. (Audit fix W-5 / AGENTS.md Rule B)
  PERFORM set_config('designpulse.bypass_immutability', 'true', true);

  UPDATE opportunities SET status = 'Draft' WHERE id = p_opp_id;
  UPDATE opportunity_options SET is_locked = false WHERE opportunity_id = p_opp_id;
  
  UPDATE opportunity_options SET is_locked = true WHERE id = p_option_id 
  RETURNING title, cost_impact, days_impact, cost_code, division, COALESCE(requires_coordination, true), COALESCE(coordination_requirements, '{}'::jsonb) 
  INTO v_option_title, v_option_cost, v_option_days, v_option_cost_code, v_option_division, v_requires_coord, v_coord_reqs;
  
  IF jsonb_typeof(v_coord_reqs) = 'object' THEN
    FOR k, v IN SELECT key, value FROM jsonb_each_text(v_coord_reqs) LOOP
      BEGIN
        IF jsonb_typeof(v::jsonb) = 'object' AND (v::jsonb)->>'required' = 'true' THEN
          v_new_coord_details := jsonb_set(
            v_new_coord_details, 
            ARRAY[k], 
            jsonb_build_object('status', 'Pending', 'notes', COALESCE((v::jsonb)->>'notes', '')), 
            true
          );
        ELSIF jsonb_typeof(v::jsonb) = 'boolean' AND v = 'true' THEN
          v_new_coord_details := jsonb_set(
            v_new_coord_details, 
            ARRAY[k], 
            jsonb_build_object('status', 'Pending', 'notes', ''), 
            true
          );
        END IF;
      EXCEPTION WHEN OTHERS THEN
        -- Safely ignore malformed JSON text to prevent transaction aborts
      END;
    END LOOP;
  END IF;

  IF v_requires_coord THEN
    UPDATE opportunities SET 
      final_direction = 'Locked: ' || v_option_title, 
      status = 'Approved', 
      cost_impact = v_option_cost, 
      days_impact = v_option_days,
      cost_code = COALESCE(v_option_cost_code, cost_code),
      division = COALESCE(v_option_division, division),
      coordination_status = 'Pending Plan Update',
      coordination_details = v_new_coord_details
    WHERE id = p_opp_id;
  ELSE
    UPDATE opportunities SET 
      final_direction = 'Locked: ' || v_option_title, 
      status = 'Approved', 
      cost_impact = v_option_cost, 
      days_impact = v_option_days,
      cost_code = COALESCE(v_option_cost_code, cost_code),
      division = COALESCE(v_option_division, division),
      coordination_status = 'Not Required',
      coordination_details = '{}'::jsonb
    WHERE id = p_opp_id;
  END IF;
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

-- De-Escalation RPC: Removes an escalated Coordination item from the Value Matrix.
-- Atomically: unlocks contender options, resets opportunity state, strips is_escalated flag.
-- Requires designpulse.bypass_immutability escape hatch (AGENTS.md Rule B5).
CREATE OR REPLACE FUNCTION public.de_escalate_opportunity(p_opp_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- 1. RBAC check — same permission as editing records (not lock-level).
  IF NOT public.has_project_permission(
    (SELECT project_id FROM opportunities WHERE id = p_opp_id),
    'can_edit_records'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Insufficient privileges to de-escalate this item';
  END IF;

  -- 2. Open escape hatch AFTER RBAC, BEFORE any UPDATE statement.
  --    Covers BOTH enforce_financial_immutability (opportunities)
  --    AND enforce_options_immutability (opportunity_options).
  --    Per AGENTS.md B5: opening the hatch late still triggers on earlier UPDATEs.
  PERFORM set_config('designpulse.bypass_immutability', 'true', true);

  -- 3. Unlock all contender options first (CRITICAL ordering).
  --    trg_sync_parent_opportunity_totals (AFTER trigger on opportunity_options) fires
  --    here and recalculates parent costs from now-unlocked options.
  --    Our explicit UPDATE in step 4 then overrides that intermediate calculation.
  UPDATE opportunity_options
  SET is_locked = false
  WHERE opportunity_id = p_opp_id;

  -- 4. Reset opportunity to Coordination-only state.
  --    Uses JSONB key-deletion operator (-) to cleanly strip is_escalated.
  --    COALESCE guards against NULL coordination_details (NULL - key = NULL without it).
  --    trg_auto_update_coordination_status (BEFORE trigger) recalculates coordination_status
  --    from remaining discipline task data automatically before this UPDATE commits.
  UPDATE opportunities
  SET
    cost_impact          = 0,
    days_impact          = 0,
    status               = 'Draft',
    final_direction      = NULL,
    coordination_details = COALESCE(coordination_details, '{}'::jsonb) - 'is_escalated'
  WHERE id = p_opp_id;

END;
$$;



-- 6. Upgrade RLS Policies to use Dynamic RBAC
-- Projects
DROP POLICY IF EXISTS "Admins can update projects" ON projects;
CREATE POLICY "Admins can update projects" 
  ON projects FOR UPDATE USING (public.has_project_permission(id, 'can_edit_project_settings'));

DROP POLICY IF EXISTS "Admins can delete projects" ON projects;
CREATE POLICY "Admins can delete projects" 
  ON projects FOR DELETE USING (public.is_platform_admin() OR public.get_user_project_role(id) = 'project_admin');

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

-- ==========================================
-- REALTIME SUBSCRIPTIONS
-- ==========================================

-- Enable Realtime for the target tables to broadcast changes over WebSockets
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE opportunities, opportunity_options;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END $$;

-- ==========================================
-- ANALYTICS RPCs (Phase 4)
-- ==========================================

-- 1. Trade Variances
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

-- 2. GC Bottleneck Metrics
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

-- 3. Owner ROI Metrics (Savings)
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

-- 4. Design Completion Metrics (Dynamic JSONB Parsing)
CREATE OR REPLACE FUNCTION get_design_completion_metrics(p_project_id UUID)
RETURNS TABLE (discipline_id text, status text, count bigint)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT (public.is_platform_admin() OR public.get_user_project_role(p_project_id) IS NOT NULL) THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  
  RETURN QUERY 
  SELECT key AS discipline_id, value->>'status' AS status, COUNT(*) 
  FROM opportunities o, jsonb_each(o.coordination_details)
  WHERE o.project_id = p_project_id 
    AND o.is_deleted = false
    AND (
      o.record_type = 'Coordination' 
      OR (o.record_type = 'VE' AND o.status IN ('Pending Plan Update', 'In Drafting', 'GC / Owner Review', 'Implemented', 'Approved'))
    )
  GROUP BY key, value->>'status';
END;
$$;

-- 5. User Email Lookup (Auth OAuth Callback)
CREATE OR REPLACE FUNCTION get_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(p_email) LIMIT 1;
$$;

-- CRITICAL GUARDRAIL: Prevent User Enumeration from the frontend
REVOKE EXECUTE ON FUNCTION get_user_id_by_email(text) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION get_user_id_by_email(text) TO service_role;

-- 6. Concurrent JSONB Updates (Race Condition Fixes)
CREATE OR REPLACE FUNCTION update_coordination_details_delta(
  p_opp_id UUID,
  p_updates JSONB
) RETURNS opportunities LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_current JSONB;
  v_key TEXT;
  v_val JSONB;
  v_result opportunities;
BEGIN
  -- 1. Check permissions against RBAC
  IF NOT public.has_project_permission((SELECT project_id FROM opportunities WHERE id = p_opp_id), 'can_edit_records') THEN
    RAISE EXCEPTION 'Unauthorized: Insufficient privileges to edit coordination details';
  END IF;
  
  -- 2. Lock row and fetch current state
  SELECT COALESCE(coordination_details, '{}'::jsonb) INTO v_current 
  FROM opportunities WHERE id = p_opp_id FOR UPDATE;

  -- 3. Merge deltas
  FOR v_key, v_val IN SELECT key, value FROM jsonb_each(p_updates) LOOP
    IF v_key LIKE 'd_%' THEN
      -- It's a discipline (e.g., d_arch): Merge nested object
      v_current := jsonb_set(
        v_current, 
        ARRAY[v_key], 
        COALESCE(v_current->v_key, '{}'::jsonb) || v_val
      );
    ELSE
      -- Root level key (e.g., is_escalated): Overwrite value directly
      v_current := jsonb_set(v_current, ARRAY[v_key], v_val);
    END IF;
  END LOOP;

  -- 4. Save and return
  UPDATE opportunities 
  SET coordination_details = v_current 
  WHERE id = p_opp_id 
  RETURNING * INTO v_result;
  
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION update_option_requirements_delta(
  p_option_id UUID,
  p_updates JSONB
) RETURNS opportunity_options LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_current JSONB;
  v_key TEXT;
  v_val JSONB;
  v_result opportunity_options;
BEGIN
  -- 1. Check permissions
  IF NOT public.has_project_permission(
    (SELECT project_id FROM opportunities WHERE id = (SELECT opportunity_id FROM opportunity_options WHERE id = p_option_id)), 
    'can_edit_records'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Insufficient privileges to edit coordination requirements';
  END IF;
  
  -- 2. Lock row and fetch current state
  SELECT COALESCE(coordination_requirements, '{}'::jsonb) INTO v_current 
  FROM opportunity_options WHERE id = p_option_id FOR UPDATE;

  -- 3. Merge deltas safely
  IF jsonb_typeof(v_current) = 'object' THEN
    FOR v_key, v_val IN SELECT key, value FROM jsonb_each(p_updates) LOOP
      v_current := jsonb_set(
        v_current, 
        ARRAY[v_key], 
        COALESCE(v_current->v_key, '{}'::jsonb) || v_val
      );
    END LOOP;
  ELSE
    v_current := p_updates;
  END IF;

  -- 4. Update and return
  UPDATE opportunity_options 
  SET coordination_requirements = v_current
  WHERE id = p_option_id
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

-- 7. Bulk Import Coordination Tasks
CREATE OR REPLACE FUNCTION bulk_import_coordination_tasks(p_project_id UUID, p_payload JSONB)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- 1. Security Guardrail: RBAC check
  IF NOT public.has_project_permission(p_project_id, 'can_edit_records') THEN
    RAISE EXCEPTION 'Unauthorized: Insufficient privileges to import coordination tasks';
  END IF;

  -- 2. JSONB Guardrail: Ensure payload is strictly an array to prevent transaction aborts
  IF jsonb_typeof(p_payload) = 'array' THEN
    -- 3. Atomic Batch Insert
    INSERT INTO opportunities (
      id,
      project_id,
      title,
      description,
      priority,
      building_area,
      cost_code,
      cost_type,
      coordination_details,
      record_type,
      status,
      coordination_status
    )
    SELECT
      (val->>'id')::uuid,
      p_project_id,
      val->>'title',
      val->>'description',
      COALESCE(NULLIF(val->>'priority', ''), 'Set Priority'),
      val->>'building_area',
      val->>'cost_code',
      NULLIF(val->>'cost_type', '')::cost_type_enum,
      COALESCE(val->'coordination_details', '{}'::jsonb),
      'Coordination',
      'Draft',
      'Draft'
    FROM jsonb_array_elements(p_payload) AS val;
  ELSE
    RAISE EXCEPTION 'Invalid Payload: Expected a JSON array of tasks.';
  END IF;
END;
$$;

-- 7. Soft Delete Cascades
CREATE OR REPLACE FUNCTION cascade_soft_delete_opportunities()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.is_deleted = true AND OLD.is_deleted = false THEN
    DELETE FROM permit_task_links WHERE coordination_task_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cascade_soft_delete_opportunities ON opportunities;
CREATE TRIGGER trg_cascade_soft_delete_opportunities
AFTER UPDATE OF is_deleted ON opportunities
FOR EACH ROW EXECUTE FUNCTION cascade_soft_delete_opportunities();

-- 8. Atomic Permit Revision Logging
CREATE OR REPLACE FUNCTION log_permit_revision(
  p_permit_id UUID,
  p_new_revision JSONB
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_project_id UUID;
  v_current_history JSONB;
BEGIN
  SELECT project_id, COALESCE(revision_history, '[]'::jsonb) INTO v_project_id, v_current_history
  FROM permits WHERE id = p_permit_id FOR UPDATE;

  IF NOT public.has_project_permission(v_project_id, 'can_edit_records') THEN
    RAISE EXCEPTION 'Unauthorized: Insufficient privileges to log revisions';
  END IF;

  IF jsonb_typeof(COALESCE(v_current_history, '[]'::jsonb)) != 'array' THEN
    v_current_history := '[]'::jsonb;
  END IF;

  UPDATE permits
  SET revision_history = v_current_history || p_new_revision,
      revision_number = revision_number + 1,
      status = COALESCE(p_new_revision->>'status', status)
  WHERE id = p_permit_id;
END;
$$;

-- ==========================================
-- PHASE 5: ROSETTA STONE SPEC BOOK EXTRACTOR
-- Database Architecture & RPC Additions
-- ==========================================

-- 0. Project CSI Specs Table
CREATE TABLE IF NOT EXISTS public.project_csi_specs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  csi_number text NOT NULL,
  description text NOT NULL,
  cost_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, csi_number)
);

ALTER TABLE public.project_csi_specs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view project_csi_specs" 
  ON public.project_csi_specs FOR SELECT 
  USING (
    public.is_platform_admin() 
    OR public.get_user_project_role(project_id) IS NOT NULL
  );

CREATE POLICY "Members can insert project_csi_specs"
  ON public.project_csi_specs FOR INSERT
  WITH CHECK (public.has_project_permission(project_id, 'can_edit_records'));

CREATE POLICY "Members can update project_csi_specs"
  ON public.project_csi_specs FOR UPDATE
  USING (public.has_project_permission(project_id, 'can_edit_records'));

CREATE POLICY "Members can delete project_csi_specs"
  ON public.project_csi_specs FOR DELETE
  USING (public.has_project_permission(project_id, 'can_delete_records'));

-- 1. Optimized ML Auto-Suggest RPC (Minimizes network payload with DISTINCT ON)
CREATE OR REPLACE FUNCTION get_csi_training_suggestions(p_normalized_codes jsonb)
RETURNS SETOF global_csi_training_data LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF jsonb_typeof(COALESCE(p_normalized_codes, '[]'::jsonb)) != 'array' THEN
    RAISE EXCEPTION 'Expected JSON array';
  END IF;

  RETURN QUERY
  SELECT DISTINCT ON (t.normalized_csi_number) t.*
  FROM global_csi_training_data t
  JOIN jsonb_array_elements_text(p_normalized_codes) AS code 
    ON t.normalized_csi_number = code
  -- The ORDER BY must match the DISTINCT ON column first, then our weights
  ORDER BY t.normalized_csi_number, t.is_admin_verified DESC, t.match_count DESC;
END;
$$;

-- Grant execute
GRANT EXECUTE ON FUNCTION get_csi_training_suggestions(jsonb) TO authenticated;


-- 2. Secure Bulk Upsert RPC (High-performance set-based processing)
CREATE OR REPLACE FUNCTION bulk_upsert_project_csi_specs(p_project_id UUID, p_payload JSONB)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- RBAC Guard
  IF NOT public.has_project_permission(p_project_id, 'can_edit_records') THEN
    RAISE EXCEPTION 'Unauthorized: Insufficient privileges';
  END IF;

  -- Array Type-Safety Guard
  IF jsonb_typeof(COALESCE(p_payload, '[]'::jsonb)) = 'array' THEN
    INSERT INTO project_csi_specs (id, project_id, csi_number, description, cost_code)
    SELECT
      COALESCE((val->>'id')::uuid, gen_random_uuid()),
      p_project_id,
      val->>'csi_number',
      val->>'description',
      NULLIF(val->>'cost_code', '') -- Foreign Key safety
    FROM jsonb_array_elements(p_payload) AS val
    ON CONFLICT (project_id, csi_number) DO UPDATE SET
      description = EXCLUDED.description,
      cost_code = EXCLUDED.cost_code;
  ELSE
    RAISE EXCEPTION 'Invalid Payload: Expected a JSON array.';
  END IF;
END;
$$;

-- Grant execute
GRANT EXECUTE ON FUNCTION bulk_upsert_project_csi_specs(UUID, JSONB) TO authenticated;

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
  author_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  include_in_oac boolean DEFAULT false,
  is_edited boolean DEFAULT false,
  is_deleted boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE item_activity REPLICA IDENTITY FULL;

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
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_summary text;
  v_project_id uuid;
  v_opportunity_id uuid;
  v_option_id uuid;
BEGIN
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

DROP TRIGGER IF EXISTS trg_ui_system_activity_opp ON opportunities;
CREATE TRIGGER trg_ui_system_activity_opp
AFTER INSERT OR UPDATE ON opportunities
FOR EACH ROW EXECUTE FUNCTION log_ui_system_activity();

DROP TRIGGER IF EXISTS trg_ui_system_activity_opt ON opportunity_options;
CREATE TRIGGER trg_ui_system_activity_opt
AFTER INSERT OR UPDATE ON opportunity_options
FOR EACH ROW EXECUTE FUNCTION log_ui_system_activity();

-- 7. Realtime Publication
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE item_activity;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END $$;

-- ==========================================
-- GLOBAL USER MANAGEMENT (Phase 6)
-- ==========================================

CREATE OR REPLACE FUNCTION bulk_update_user_projects(p_user_id uuid, p_assignments jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- 1. Security Check
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only platform admins can bulk update project memberships.';
  END IF;

  -- 2. Guardrail 21: JSONB Array Null Safety
  IF jsonb_typeof(COALESCE(p_assignments, '[]'::jsonb)) != 'array' THEN
    RAISE EXCEPTION 'p_assignments must be a JSONB array';
  END IF;

  -- 3. Set-based UPSERT
  INSERT INTO project_members (project_id, user_id, role)
  SELECT 
    (value->>'project_id')::uuid, 
    p_user_id, 
    (value->>'role')::project_role
  FROM jsonb_array_elements(p_assignments)
  WHERE (value->>'action') = 'UPSERT'
  ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role;

  -- 4. Set-based DELETE
  DELETE FROM project_members
  WHERE user_id = p_user_id
  AND project_id IN (
    SELECT (value->>'project_id')::uuid
    FROM jsonb_array_elements(p_assignments)
    WHERE (value->>'action') = 'DELETE'
  );

END;
$$;



-- 2.0 User Management & RPCs Update
DROP FUNCTION IF EXISTS get_system_users();
CREATE OR REPLACE FUNCTION get_system_users()
RETURNS TABLE (
  id uuid, 
  email text, 
  name text, 
  is_platform_admin boolean,
  company_name text,
  job_title text,
  default_color text
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    u.id, 
    u.email::text, 
    (u.raw_user_meta_data->>'display_name')::text as name,
    EXISTS(SELECT 1 FROM platform_admins pa WHERE pa.user_id = u.id) as is_platform_admin,
    (u.raw_user_meta_data->>'company_name')::text as company_name,
    (u.raw_user_meta_data->>'job_title')::text as job_title,
    (u.raw_user_meta_data->>'default_color')::text as default_color
  FROM auth.users u
  WHERE public.is_platform_admin() 
     OR EXISTS (
       SELECT 1 FROM project_members pm
       WHERE pm.user_id = auth.uid() 
         AND pm.role IN ('project_admin', 'gc_admin')
     );
$$;

DROP FUNCTION IF EXISTS get_project_members_with_email(UUID);
CREATE OR REPLACE FUNCTION get_project_members_with_email(p_project_id UUID)
RETURNS TABLE (
  project_id uuid, 
  user_id uuid, 
  role project_role, 
  email text, 
  name text,
  company_name text,
  job_title text,
  default_color text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if caller is authorized to view this project
  IF NOT (public.is_platform_admin() OR EXISTS (
    SELECT 1 FROM project_members pm WHERE pm.project_id = p_project_id AND pm.user_id = auth.uid()
  )) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT 
    pm.project_id, 
    pm.user_id, 
    pm.role, 
    u.email::text, 
    (u.raw_user_meta_data->>'display_name')::text as name,
    (u.raw_user_meta_data->>'company_name')::text as company_name,
    (u.raw_user_meta_data->>'job_title')::text as job_title,
    (u.raw_user_meta_data->>'default_color')::text as default_color
  FROM project_members pm
  JOIN auth.users u ON u.id = pm.user_id
  WHERE pm.project_id = p_project_id;
END;
$$;

-- ============================================================
-- PROJECT ESTIMATE VERSIONING (Budget Import Feature)
-- ============================================================

-- Versioned snapshots of a project's imported budget estimate.
-- Only one version may be active per project at any time.
CREATE TABLE IF NOT EXISTS public.project_estimate_versions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  version_name  text NOT NULL,
  version_date  date NOT NULL DEFAULT CURRENT_DATE,
  is_active     boolean NOT NULL DEFAULT false,
  is_finalized  boolean NOT NULL DEFAULT false,
  total_budget  numeric NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
-- Idempotent column addition for existing deployments that pre-date this column
ALTER TABLE public.project_estimate_versions
  ADD COLUMN IF NOT EXISTS is_finalized boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_estimate_versions_project ON public.project_estimate_versions(project_id);
CREATE INDEX IF NOT EXISTS idx_estimate_versions_active  ON public.project_estimate_versions(project_id, is_active);
ALTER TABLE public.project_estimate_versions ENABLE ROW LEVEL SECURITY;

-- Line-item children of a version. Cascade-deletes when parent version is deleted.
-- cost_code is a loose text FK to cost_codes.code (intentional — see AGENTS.md §5)
-- cost_type is plain text NOT an enum (AGENTS.md §5)
CREATE TABLE IF NOT EXISTS public.project_estimates (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id     uuid NOT NULL REFERENCES public.project_estimate_versions(id) ON DELETE CASCADE,
  project_id     uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  cost_code      text,
  cost_type      text,
  description    text NOT NULL DEFAULT 'No Description',
  unit_qty       numeric NOT NULL DEFAULT 1,
  uom            text,
  unit_cost      numeric NOT NULL DEFAULT 0,
  budget_amount  numeric NOT NULL DEFAULT 0,
  display_order  integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_estimates_version ON public.project_estimates(version_id);
CREATE INDEX IF NOT EXISTS idx_estimates_project  ON public.project_estimates(project_id);
ALTER TABLE public.project_estimates ENABLE ROW LEVEL SECURITY;

-- RLS: any project member can read; only project settings editors can write
CREATE POLICY "Members can view estimate versions"
  ON public.project_estimate_versions FOR SELECT
  USING (public.is_platform_admin() OR public.get_user_project_role(project_id) IS NOT NULL);
CREATE POLICY "Admins can manage estimate versions"
  ON public.project_estimate_versions FOR ALL
  USING (public.has_project_permission(project_id, 'can_edit_project_settings'));

CREATE POLICY "Members can view estimates"
  ON public.project_estimates FOR SELECT
  USING (public.is_platform_admin() OR public.get_user_project_role(project_id) IS NOT NULL);
CREATE POLICY "Admins can manage estimates"
  ON public.project_estimates FOR ALL
  USING (public.has_project_permission(project_id, 'can_edit_project_settings'));

-- auto_update_timestamp triggers (consistent with all other tables)
DROP TRIGGER IF EXISTS trg_estimate_versions_updated_at ON public.project_estimate_versions;
CREATE TRIGGER trg_estimate_versions_updated_at
  BEFORE UPDATE ON public.project_estimate_versions
  FOR EACH ROW EXECUTE FUNCTION auto_update_timestamp();

DROP TRIGGER IF EXISTS trg_estimates_updated_at ON public.project_estimates;
CREATE TRIGGER trg_estimates_updated_at
  BEFORE UPDATE ON public.project_estimates
  FOR EACH ROW EXECUTE FUNCTION auto_update_timestamp();

-- ── RPC 1: create_estimate_version ──────────────────────────────────────────
-- Called once per import. Creates the version header and optionally
-- atomically deactivates all prior active versions (AGENTS.md C33).
CREATE OR REPLACE FUNCTION public.create_estimate_version(
  p_project_id   uuid,
  p_version_name text,
  p_version_date date,
  p_set_active   boolean
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_version_id uuid;
BEGIN
  IF NOT has_project_permission(p_project_id, 'can_edit_project_settings') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF p_set_active THEN
    UPDATE project_estimate_versions SET is_active = false
    WHERE project_id = p_project_id AND is_active = true;
  END IF;
  INSERT INTO project_estimate_versions (project_id, version_name, version_date, is_active)
  VALUES (p_project_id, p_version_name, p_version_date, p_set_active)
  RETURNING id INTO v_version_id;
  RETURN v_version_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_estimate_version(uuid, text, date, boolean) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.create_estimate_version(uuid, text, date, boolean) TO authenticated;

-- ── RPC 2: bulk_append_estimate_lines ───────────────────────────────────────
-- Called N times in 50-row chunks (AGENTS.md C20).
-- Set-based insert; no FOR loops (AGENTS.md C21).
-- Cross-ownership guard prevents cross-project data injection.
CREATE OR REPLACE FUNCTION public.bulk_append_estimate_lines(
  p_version_id uuid,
  p_project_id uuid,
  p_payload    jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT has_project_permission(p_project_id, 'can_edit_project_settings') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  -- Cross-ownership guard: verify version belongs to declared project
  IF NOT EXISTS (
    SELECT 1 FROM project_estimate_versions
    WHERE id = p_version_id AND project_id = p_project_id
  ) THEN
    RAISE EXCEPTION 'Version % does not belong to project %', p_version_id, p_project_id;
  END IF;
  -- JSONB array safety (AGENTS.md C21)
  IF jsonb_typeof(COALESCE(p_payload, '[]'::jsonb)) != 'array' THEN
    RAISE EXCEPTION 'p_payload must be a JSON array';
  END IF;
  INSERT INTO project_estimates (
    version_id, project_id, cost_code, cost_type, description,
    unit_qty, uom, unit_cost, budget_amount, display_order
  )
  SELECT
    p_version_id, p_project_id,
    NULLIF(val->>'cost_code', ''),
    NULLIF(val->>'cost_type', ''),
    COALESCE(NULLIF(val->>'description', ''), 'No Description'),
    COALESCE((val->>'unit_qty')::numeric, 1),
    NULLIF(val->>'uom', ''),
    COALESCE((val->>'unit_cost')::numeric, 0),
    ROUND(COALESCE((val->>'budget_amount')::numeric, 0), 2),
    COALESCE((val->>'display_order')::integer, 0)
  FROM jsonb_array_elements(p_payload) AS val;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.bulk_append_estimate_lines(uuid, uuid, jsonb) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.bulk_append_estimate_lines(uuid, uuid, jsonb) TO authenticated;

-- ── RPC 3: finalize_estimate_version ────────────────────────────────────────
-- Called once after all chunks complete. Computes total_budget and stamps is_finalized=true.
-- Only syncs original_budget when version is_active (AGENTS.md C33).
-- Row-lock on project_settings prevents concurrent sync races (AGENTS.md C7).
CREATE OR REPLACE FUNCTION public.finalize_estimate_version(
  p_version_id uuid,
  p_project_id uuid
) RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_total numeric; v_is_active boolean;
BEGIN
  IF NOT has_project_permission(p_project_id, 'can_edit_project_settings') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM project_estimate_versions
    WHERE id = p_version_id AND project_id = p_project_id
  ) THEN
    RAISE EXCEPTION 'Version % does not belong to project %', p_version_id, p_project_id;
  END IF;
  SELECT ROUND(COALESCE(SUM(budget_amount), 0), 2) INTO v_total
  FROM project_estimates WHERE version_id = p_version_id;
  SELECT is_active INTO v_is_active
  FROM project_estimate_versions WHERE id = p_version_id;
  -- Stamp is_finalized=true and persist total_budget atomically
  UPDATE project_estimate_versions
  SET total_budget = v_total, is_finalized = true
  WHERE id = p_version_id;
  IF v_is_active THEN
    -- Row-lock on project_settings to prevent concurrent budget sync races (AGENTS.md C7).
    -- project_settings uses project_id as PK, not id — use PERFORM 1, not PERFORM id.
    PERFORM 1 FROM project_settings WHERE project_id = p_project_id FOR UPDATE;
    UPDATE project_settings SET original_budget = v_total WHERE project_id = p_project_id;
  END IF;
  RETURN v_total;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.finalize_estimate_version(uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.finalize_estimate_version(uuid, uuid) TO authenticated;

-- ── RPC 4: activate_estimate_version ────────────────────────────────────────
-- Atomic swap: deactivates all others, activates target, syncs budget.
-- NOT FOUND guard prevents silent no-op on bad UUID (AGENTS.md C33).
CREATE OR REPLACE FUNCTION public.activate_estimate_version(p_version_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_project_id uuid; v_total numeric;
BEGIN
  SELECT project_id INTO v_project_id
  FROM project_estimate_versions WHERE id = p_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Estimate version % not found', p_version_id;
  END IF;
  IF NOT has_project_permission(v_project_id, 'can_edit_project_settings') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  -- Atomic swap (uses composite index idx_estimate_versions_active)
  UPDATE project_estimate_versions SET is_active = false
  WHERE project_id = v_project_id AND is_active = true;
  UPDATE project_estimate_versions SET is_active = true WHERE id = p_version_id;
  -- Sync budget with row-lock guard (AGENTS.md C33)
  -- project_settings uses project_id as PK, not id — use PERFORM 1, not PERFORM id.
  SELECT total_budget INTO v_total FROM project_estimate_versions WHERE id = p_version_id;
  PERFORM 1 FROM project_settings WHERE project_id = v_project_id FOR UPDATE;
  UPDATE project_settings SET original_budget = v_total WHERE project_id = v_project_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.activate_estimate_version(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.activate_estimate_version(uuid) TO authenticated;

-- ── RPC 5: delete_draft_estimate_version ────────────────────────────────────
-- Orphan cleanup: called from mutation onError when chunked insert fails.
-- Safety guards: never deletes active or finalized versions.
CREATE OR REPLACE FUNCTION public.delete_draft_estimate_version(
  p_version_id uuid,
  p_project_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_version public.project_estimate_versions%ROWTYPE;
BEGIN
  IF NOT has_project_permission(p_project_id, 'can_edit_project_settings') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  SELECT * INTO v_version FROM project_estimate_versions
  WHERE id = p_version_id AND project_id = p_project_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Version % not found in project %', p_version_id, p_project_id;
  END IF;
  IF v_version.is_active THEN
    RAISE EXCEPTION 'Cannot delete an active estimate version';
  END IF;
  -- Use is_finalized (not total_budget != 0) — the old proxy would incorrectly
  -- allow deleting legitimately $0 budgets and block deletions on uncompleted imports.
  IF v_version.is_finalized THEN
    RAISE EXCEPTION 'Cannot delete a finalized estimate version. Use deactivation instead.';
  END IF;
  DELETE FROM project_estimate_versions WHERE id = p_version_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.delete_draft_estimate_version(uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.delete_draft_estimate_version(uuid, uuid) TO authenticated;

-- ── RPC 6: get_project_budget_waterfall ─────────────────────────────────────
-- Server-side aggregation for the waterfall chart (AGENTS.md C5).
-- IS NOT DISTINCT FROM handles NULL cost_code join correctly.
CREATE OR REPLACE FUNCTION public.get_project_budget_waterfall(p_project_id uuid, p_version_id uuid DEFAULT NULL)
RETURNS TABLE (
  cost_code     text,
  description   text,
  budget_amount numeric,
  ve_impact     numeric,
  pending_impact numeric,
  net_position  numeric,
  projected_position numeric
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (is_platform_admin() OR get_user_project_role(p_project_id) IS NOT NULL) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  RETURN QUERY
  WITH budget_agg AS (
    SELECT COALESCE(e.cost_code, 'Unassigned')::text AS cost_code,
           MAX(e.description)::text AS description,
           SUM(e.budget_amount) AS budget_amount
    FROM project_estimates e
    JOIN project_estimate_versions v ON v.id = e.version_id
    WHERE v.project_id = p_project_id 
      AND (
        (p_version_id IS NOT NULL AND v.id = p_version_id) OR 
        (p_version_id IS NULL AND v.is_active = true)
      )
    GROUP BY COALESCE(e.cost_code, 'Unassigned')
  ),
  opp_agg AS (
    SELECT COALESCE(o.cost_code, 'Unassigned')::text AS cost_code,
           SUM(CASE WHEN o.status IN ('Approved', 'Pending Plan Update', 'Implemented') THEN o.cost_impact ELSE 0 END) AS locked_impact,
           SUM(CASE WHEN o.status IN ('Draft', 'Pending Review', 'Pending') THEN o.cost_impact ELSE 0 END) AS pending_impact
    FROM opportunities o
    WHERE o.project_id = p_project_id AND o.is_deleted = false
    GROUP BY COALESCE(o.cost_code, 'Unassigned')
  )
  SELECT 
    COALESCE(b.cost_code, o.cost_code) AS cost_code,
    COALESCE(b.description, c.description, 'Unbudgeted')::text AS description,
    COALESCE(b.budget_amount, 0) AS budget_amount,
    COALESCE(o.locked_impact, 0) AS ve_impact,
    COALESCE(o.pending_impact, 0) AS pending_impact,
    COALESCE(b.budget_amount, 0) + COALESCE(o.locked_impact, 0) AS net_position,
    COALESCE(b.budget_amount, 0) + COALESCE(o.locked_impact, 0) + COALESCE(o.pending_impact, 0) AS projected_position
  FROM budget_agg b
  FULL OUTER JOIN opp_agg o ON b.cost_code = o.cost_code
  LEFT JOIN cost_codes c ON c.code = COALESCE(b.cost_code, o.cost_code)
  ORDER BY COALESCE(b.cost_code, o.cost_code);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_project_budget_waterfall(uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_project_budget_waterfall(uuid, uuid) TO authenticated;

-- ── CLIENT DATABASE INTEGRATION ──────────────────────────────────────────────

-- 0. Client Directory (must exist before FK references)
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  general_standards_url text,
  primary_contact_name text,
  primary_contact_email text,
  is_archived boolean DEFAULT false,
  is_deleted boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add client_id FK to projects (nullable — not every project has a client)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES clients(id) ON DELETE SET NULL;

-- 1. Client Brand Standards Table (Global)
CREATE TABLE IF NOT EXISTS client_brand_standards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  cost_code text,
  normalized_csi_number text,
  standard_description text NOT NULL,
  is_deleted boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CHECK (cost_code IS NOT NULL OR normalized_csi_number IS NOT NULL)
);

-- 2. Project Brand Standards Table (Project Snapshot)
CREATE TABLE IF NOT EXISTS project_brand_standards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  client_standard_id uuid REFERENCES client_brand_standards(id) ON DELETE SET NULL,
  spec_number_id uuid REFERENCES project_csi_specs(id) ON DELETE SET NULL,
  cost_code text,
  standard_description text NOT NULL,
  is_verified boolean DEFAULT false,
  is_deleted boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Unique constraint: prevent duplicate standard syncs per project (N-4)
ALTER TABLE project_brand_standards
  ADD CONSTRAINT IF NOT EXISTS uq_project_brand_standards_client_link
  UNIQUE (project_id, client_standard_id);

-- Performance indexes for RLS FK traversals (R-4)
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_client_brand_standards_client_id ON client_brand_standards(client_id);
CREATE INDEX IF NOT EXISTS idx_project_brand_standards_project_id ON project_brand_standards(project_id);

-- 3. Triggers for Audit and Auto-Timestamp
CREATE TRIGGER trg_clients_updated_at BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION auto_update_timestamp();
CREATE TRIGGER trg_client_brand_standards_updated_at BEFORE UPDATE ON client_brand_standards FOR EACH ROW EXECUTE FUNCTION auto_update_timestamp();

CREATE TRIGGER trg_audit_clients AFTER INSERT OR UPDATE OR DELETE ON clients FOR EACH ROW EXECUTE FUNCTION process_audit_log();
CREATE TRIGGER trg_audit_client_brand_standards AFTER INSERT OR UPDATE OR DELETE ON client_brand_standards FOR EACH ROW EXECUTE FUNCTION process_audit_log();

-- 4. RLS Policies
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view clients for their projects" ON clients FOR SELECT USING (is_platform_admin() OR EXISTS (SELECT 1 FROM projects WHERE client_id = clients.id AND public.get_user_project_role(id) IS NOT NULL));
CREATE POLICY "Only admins can modify clients" ON clients FOR ALL USING (is_platform_admin());

ALTER TABLE client_brand_standards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view global standards for their clients" ON client_brand_standards FOR SELECT USING (is_platform_admin() OR EXISTS (SELECT 1 FROM projects WHERE client_id = client_brand_standards.client_id AND public.get_user_project_role(id) IS NOT NULL));
CREATE POLICY "Only admins can modify global standards" ON client_brand_standards FOR ALL USING (is_platform_admin());

ALTER TABLE project_brand_standards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view project standards" ON project_brand_standards FOR SELECT USING (is_platform_admin() OR public.get_user_project_role(project_id) IS NOT NULL);
CREATE POLICY "Members can edit project standards" ON project_brand_standards FOR ALL USING (public.has_project_permission(project_id, 'can_edit_records'));

-- 5. RPC: get_client_projects_metrics (CTE-based, pre-computed access — R-6 + Q2)
CREATE OR REPLACE FUNCTION get_client_projects_metrics(p_client_id uuid)
RETURNS TABLE (
  project_id uuid,
  name text,
  status text,
  original_budget numeric,
  locked_variance numeric,
  potential_exposure numeric
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_is_admin boolean;
  v_accessible_ids uuid[];
BEGIN
  v_is_admin := public.is_platform_admin();

  -- Pre-compute accessible project IDs once (Q2: eliminates N per-row calls)
  IF NOT v_is_admin THEN
    SELECT array_agg(pm.project_id) INTO v_accessible_ids
    FROM project_members pm WHERE pm.user_id = auth.uid();

    -- RBAC gate: user must have at least one project for this client
    IF NOT EXISTS (
      SELECT 1 FROM projects
      WHERE client_id = p_client_id AND id = ANY(COALESCE(v_accessible_ids, '{}'))
    ) THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;
  END IF;

  RETURN QUERY
  WITH budgets AS (
    SELECT ps.project_id, ps.original_budget
    FROM project_settings ps
  ),
  opp_agg AS (
    SELECT
      o.project_id,
      SUM(CASE WHEN o.status = 'Approved' THEN o.cost_impact ELSE 0 END) AS locked_variance,
      -- NOTE: potential_exposure uses parent-level SUM (portfolio approximation).
      -- The canonical per-opportunity MAX(option) calculation (AGENTS.md §3) is
      -- deferred to the project-level dashboard for performance reasons.
      SUM(CASE WHEN o.status != 'Approved' THEN o.cost_impact ELSE 0 END) AS pending_exposure
    FROM opportunities o
    WHERE o.is_deleted = false
    GROUP BY o.project_id
  )
  SELECT
    p.id AS project_id,
    p.name,
    CASE WHEN p.is_archived THEN 'Archived' ELSE 'Active' END AS status,
    COALESCE(b.original_budget, 0) AS original_budget,
    COALESCE(oa.locked_variance, 0) AS locked_variance,
    COALESCE(oa.pending_exposure, 0) AS potential_exposure
  FROM projects p
  LEFT JOIN budgets b ON b.project_id = p.id
  LEFT JOIN opp_agg oa ON oa.project_id = p.id
  WHERE p.client_id = p_client_id
    AND (v_is_admin OR p.id = ANY(COALESCE(v_accessible_ids, '{}')));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_client_projects_metrics(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_client_projects_metrics(uuid) TO authenticated;

-- 6. RPC: bulk_map_project_standards (COALESCE guard W-2, ON CONFLICT R-5, search_path W-3)
CREATE OR REPLACE FUNCTION bulk_map_project_standards(p_project_id uuid, p_standards jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_project_permission(p_project_id, 'can_edit_records') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF jsonb_typeof(COALESCE(p_standards, '[]'::jsonb)) != 'array' THEN
    RAISE EXCEPTION 'Payload must be a JSON array';
  END IF;

  INSERT INTO project_brand_standards (id, project_id, client_standard_id, spec_number_id, cost_code, standard_description, is_verified)
  SELECT
    COALESCE((elem->>'id')::uuid, gen_random_uuid()),
    p_project_id,
    (elem->>'client_standard_id')::uuid,
    (elem->>'spec_number_id')::uuid,
    elem->>'cost_code',
    elem->>'standard_description',
    COALESCE((elem->>'is_verified')::boolean, true)
  FROM jsonb_array_elements(p_standards) AS elem
  ON CONFLICT (project_id, client_standard_id) DO UPDATE SET
    cost_code = EXCLUDED.cost_code,
    standard_description = EXCLUDED.standard_description,
    is_verified = EXCLUDED.is_verified;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.bulk_map_project_standards(uuid, jsonb) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.bulk_map_project_standards(uuid, jsonb) TO authenticated;

-- ==========================================
-- DRAWINGS & MARKUPS (TILE ENGINE FOUNDATION)
-- ==========================================

-- 11. Project Sheets Table
CREATE TABLE IF NOT EXISTS project_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sheet_name text NOT NULL,
  status text DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'error')),
  original_width numeric,
  original_height numeric,
  max_zoom integer,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 12. Sheet Markups Table
CREATE TABLE IF NOT EXISTS sheet_markups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_id uuid NOT NULL REFERENCES project_sheets(id) ON DELETE CASCADE,
  opportunity_id uuid REFERENCES opportunities(id) ON DELETE CASCADE,
  geometry jsonb DEFAULT '{}'::jsonb,
  style jsonb DEFAULT '{}'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE project_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE sheet_markups ENABLE ROW LEVEL SECURITY;

-- Project Sheets Policies
DROP POLICY IF EXISTS "Members can view project_sheets" ON project_sheets;
CREATE POLICY "Members can view project_sheets" 
  ON project_sheets FOR SELECT USING (
    public.is_platform_admin() OR public.get_user_project_role(project_id) IS NOT NULL
  );

DROP POLICY IF EXISTS "Members can insert project_sheets" ON project_sheets;
CREATE POLICY "Members can insert project_sheets" 
  ON project_sheets FOR INSERT WITH CHECK (
    public.has_project_permission(project_id, 'can_edit_records')
  );

DROP POLICY IF EXISTS "Members can update project_sheets" ON project_sheets;
CREATE POLICY "Members can update project_sheets" 
  ON project_sheets FOR UPDATE USING (
    public.has_project_permission(project_id, 'can_edit_records')
  );

DROP POLICY IF EXISTS "Admins can delete project_sheets" ON project_sheets;
CREATE POLICY "Admins can delete project_sheets" 
  ON project_sheets FOR DELETE USING (
    public.has_project_permission(project_id, 'can_delete_records')
  );

-- Sheet Markups Policies
DROP POLICY IF EXISTS "Members can view sheet_markups" ON sheet_markups;
CREATE POLICY "Members can view sheet_markups" 
  ON sheet_markups FOR SELECT USING (
    public.is_platform_admin() OR EXISTS (
      SELECT 1 FROM project_sheets WHERE project_sheets.id = sheet_id AND public.get_user_project_role(project_sheets.project_id) IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Members can insert sheet_markups" ON sheet_markups;
CREATE POLICY "Members can insert sheet_markups" 
  ON sheet_markups FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_sheets WHERE project_sheets.id = sheet_id AND public.has_project_permission(project_sheets.project_id, 'can_edit_records')
    )
  );

DROP POLICY IF EXISTS "Members can update sheet_markups" ON sheet_markups;
CREATE POLICY "Members can update sheet_markups" 
  ON sheet_markups FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM project_sheets WHERE project_sheets.id = sheet_id AND public.has_project_permission(project_sheets.project_id, 'can_edit_records')
    )
  );

DROP POLICY IF EXISTS "Members can delete sheet_markups" ON sheet_markups;
CREATE POLICY "Members can delete sheet_markups" 
  ON sheet_markups FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM project_sheets WHERE project_sheets.id = sheet_id AND public.has_project_permission(project_sheets.project_id, 'can_edit_records')
    )
  );

-- 13. Storage Buckets & Policies
INSERT INTO storage.buckets (id, name, public) 
VALUES ('project_drawings', 'project_drawings', false)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies for project_drawings
DROP POLICY IF EXISTS "Members can view project_drawings" ON storage.objects;
CREATE POLICY "Members can view project_drawings" 
  ON storage.objects FOR SELECT USING (
    bucket_id = 'project_drawings' AND (
      public.is_platform_admin() OR public.get_user_project_role((path_tokens[1])::uuid) IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Members can insert project_drawings" ON storage.objects;
CREATE POLICY "Members can insert project_drawings" 
  ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'project_drawings' AND (
      public.has_project_permission((path_tokens[1])::uuid, 'can_edit_records')
    )
  );

DROP POLICY IF EXISTS "Members can update project_drawings" ON storage.objects;
CREATE POLICY "Members can update project_drawings" 
  ON storage.objects FOR UPDATE USING (
    bucket_id = 'project_drawings' AND (
      public.has_project_permission((path_tokens[1])::uuid, 'can_edit_records')
    )
  );

DROP POLICY IF EXISTS "Admins can delete project_drawings" ON storage.objects;
CREATE POLICY "Admins can delete project_drawings" 
  ON storage.objects FOR DELETE USING (
    bucket_id = 'project_drawings' AND (
      public.has_project_permission((path_tokens[1])::uuid, 'can_delete_records')
    )
  );

-- ── RPC: upsert_sheet_markups ───────────────────────────────────────────────
-- Atomically replaces all sheet_markups for a given (sheet_id, opportunity_id)
-- pair within a single transaction. Eliminates the non-atomic DELETE+INSERT
-- pattern in the frontend that could lose data on mid-operation failures.
-- Follows AGENTS.md: RBAC check (B.2), JSONB array safety (C21), set-based insert (C21).
-- NULL safety: p_opportunity_id uses DEFAULT NULL + IS NOT DISTINCT FROM (not =)
-- because NULL = NULL evaluates to NULL in SQL, silently matching zero rows.
DROP FUNCTION IF EXISTS upsert_sheet_markups(uuid, uuid, jsonb);
CREATE OR REPLACE FUNCTION upsert_sheet_markups(
  p_sheet_id uuid,
  p_opportunity_id uuid DEFAULT NULL,
  p_markups jsonb DEFAULT '[]'::jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- RBAC check via existing permission helper
  IF NOT EXISTS (
    SELECT 1 FROM project_sheets
    WHERE id = p_sheet_id
    AND has_project_permission(project_id, 'can_edit_records')
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- JSONB array safety (AGENTS.md C21)
  IF jsonb_typeof(COALESCE(p_markups, '[]'::jsonb)) != 'array' THEN
    RAISE EXCEPTION 'p_markups must be a JSON array';
  END IF;

  -- Atomic delete + set-based insert in one transaction.
  -- IS NOT DISTINCT FROM is the NULL-safe equality operator:
  -- NULL IS NOT DISTINCT FROM NULL → TRUE (correct for unlinked zones)
  -- 'uuid' IS NOT DISTINCT FROM 'uuid' → TRUE (correct for linked zones)
  DELETE FROM sheet_markups
  WHERE sheet_id = p_sheet_id
    AND opportunity_id IS NOT DISTINCT FROM p_opportunity_id;

  INSERT INTO sheet_markups (sheet_id, opportunity_id, geometry, style, metadata)
  SELECT
    p_sheet_id,
    p_opportunity_id,
    elem->'geometry',
    COALESCE(elem->'style', '{}'::jsonb),
    COALESCE(elem->'metadata', '{}'::jsonb)
  FROM jsonb_array_elements(p_markups) AS elem;
END;
$$;
REVOKE EXECUTE ON FUNCTION upsert_sheet_markups(uuid, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION upsert_sheet_markups(uuid, uuid, jsonb) TO authenticated;
