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
  disciplines jsonb DEFAULT '[{"id": "d_arch", "label": "Arch"}, {"id": "d_civil", "label": "Civil"}, {"id": "d_struct", "label": "Struct"}, {"id": "d_mech", "label": "Mech"}, {"id": "d_elec", "label": "Elec"}, {"id": "d_plumb", "label": "Plumb"}, {"id": "d_fp", "label": "FP"}, {"id": "d_lv", "label": "LV"}]'::jsonb,
  project_name text,
  location text,
  original_budget numeric DEFAULT 0,
  enable_audit_logging boolean DEFAULT false,
  ve_column_order jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2.5 Project Sequences Table (For VE-001 IDs)
CREATE TABLE IF NOT EXISTS project_sequences (
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  ve_current_value integer DEFAULT 0,
  cd_current_value integer DEFAULT 0
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
  priority text DEFAULT 'Medium' CHECK (priority IN ('Critical', 'High', 'Medium', 'Low')),
  division text,
  cost_code text,
  record_type text DEFAULT 'VE' CHECK (record_type IN ('VE', 'Coordination')),
  coordination_details jsonb DEFAULT '{}'::jsonb,
  is_deleted boolean DEFAULT false,
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
  requires_coordination boolean DEFAULT true,
  coordination_requirements jsonb DEFAULT '{}'::jsonb,
  is_deleted boolean DEFAULT false,
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
  ON opportunities FOR SELECT USING (is_platform_admin() OR (is_deleted = false AND public.get_user_project_role(project_id) IS NOT NULL));

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
    is_platform_admin() OR (is_deleted = false AND EXISTS (
      SELECT 1 FROM opportunities WHERE opportunities.id = opportunity_options.opportunity_id AND public.get_user_project_role(opportunities.project_id) IS NOT NULL
    ))
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

DROP FUNCTION IF EXISTS create_new_project(text, text, text);

CREATE OR REPLACE FUNCTION create_new_project(
  p_name text, 
  p_description text DEFAULT NULL, 
  p_project_number text DEFAULT NULL,
  p_procore_project_id text DEFAULT NULL,
  p_procore_company_id text DEFAULT NULL
)
RETURNS SETOF projects
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_project projects%ROWTYPE;
BEGIN
  INSERT INTO projects (name, description, project_number, procore_project_id, procore_company_id) 
  VALUES (p_name, p_description, p_project_number, p_procore_project_id, p_procore_company_id) 
  RETURNING * INTO v_project;
  
  INSERT INTO project_members (project_id, user_id, role) 
  VALUES (v_project.id, auth.uid(), 'owner');
  
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
  IF OLD.status IN ('Pending Plan Update', 'GC / Owner Review', 'Implemented', 'Approved') THEN
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

  IF v_parent_status IN ('Pending Plan Update', 'GC / Owner Review', 'Implemented', 'Approved') THEN
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
CREATE OR REPLACE FUNCTION lock_opportunity_option(p_option_id UUID, p_opp_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_option_title text;
  v_option_cost numeric;
  v_option_days numeric;
  v_requires_coord boolean;
  v_coord_reqs jsonb;
  v_new_coord_details jsonb := '{}'::jsonb;
  k text;
  v text;
BEGIN
  IF NOT public.has_project_permission((SELECT project_id FROM opportunities WHERE id = p_opp_id), 'can_lock_options') THEN
    RAISE EXCEPTION 'Unauthorized: Insufficient privileges to lock options';
  END IF;

  UPDATE opportunities SET status = 'Draft' WHERE id = p_opp_id;
  UPDATE opportunity_options SET is_locked = false WHERE opportunity_id = p_opp_id;
  
  UPDATE opportunity_options SET is_locked = true WHERE id = p_option_id 
  RETURNING title, cost_impact, days_impact, COALESCE(requires_coordination, true), COALESCE(coordination_requirements, '{}'::jsonb) 
  INTO v_option_title, v_option_cost, v_option_days, v_requires_coord, v_coord_reqs;
  
  IF jsonb_typeof(v_coord_reqs) = 'object' THEN
    FOR k, v IN SELECT key, value FROM jsonb_each_text(v_coord_reqs) LOOP
      IF (v::jsonb)->>'required' = 'true' THEN
        v_new_coord_details := jsonb_set(
          v_new_coord_details, 
          ARRAY[k], 
          jsonb_build_object('status', 'Pending', 'notes', COALESCE((v::jsonb)->>'notes', '')), 
          true
        );
      END IF;
    END LOOP;
  END IF;

  IF v_requires_coord THEN
    UPDATE opportunities SET 
      final_direction = 'Locked: ' || v_option_title, 
      status = 'Approved', 
      cost_impact = v_option_cost, 
      days_impact = v_option_days,
      coordination_status = 'Pending Plan Update',
      coordination_details = v_new_coord_details
    WHERE id = p_opp_id;
  ELSE
    UPDATE opportunities SET 
      final_direction = 'Locked: ' || v_option_title, 
      status = 'Approved', 
      cost_impact = v_option_cost, 
      days_impact = v_option_days,
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
-- Projects
DROP POLICY IF EXISTS "Admins can update projects" ON projects;
CREATE POLICY "Admins can update projects" 
  ON projects FOR UPDATE USING (public.has_project_permission(id, 'can_edit_project_settings'));

DROP POLICY IF EXISTS "Admins can delete projects" ON projects;
CREATE POLICY "Admins can delete projects" 
  ON projects FOR DELETE USING (public.is_platform_admin() OR public.get_user_project_role(id) = 'owner');

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
ALTER PUBLICATION supabase_realtime ADD TABLE opportunities, opportunity_options;

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
