-- Design Pulse Database Schema
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

-- 1.5 Project Members (Junction Table)
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
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2.5 Project Sequences Table (For VE-001 IDs)
CREATE TABLE IF NOT EXISTS project_sequences (
  project_id uuid PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  current_value integer DEFAULT 0
);

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

-- 4.5 Auto Update Timestamps
CREATE OR REPLACE FUNCTION auto_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_opportunities_updated_at ON opportunities;
CREATE TRIGGER trg_opportunities_updated_at
BEFORE UPDATE ON opportunities
FOR EACH ROW EXECUTE FUNCTION auto_update_timestamp();

DROP TRIGGER IF EXISTS trg_opportunity_options_updated_at ON opportunity_options;
CREATE TRIGGER trg_opportunity_options_updated_at
BEFORE UPDATE ON opportunity_options
FOR EACH ROW EXECUTE FUNCTION auto_update_timestamp();

-- Enable RLS (Row Level Security)
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

-- Security Policies
CREATE POLICY "Members can view their own memberships" 
  ON project_members FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Members can view projects" 
  ON projects FOR SELECT 
  USING (EXISTS (SELECT 1 FROM project_members WHERE project_members.project_id = projects.id AND project_members.user_id = auth.uid()));

CREATE POLICY "Members can view project_settings" 
  ON project_settings FOR SELECT 
  USING (EXISTS (SELECT 1 FROM project_members WHERE project_members.project_id = project_settings.project_id AND project_members.user_id = auth.uid()));

CREATE POLICY "Members can view opportunities" 
  ON opportunities FOR SELECT 
  USING (EXISTS (SELECT 1 FROM project_members WHERE project_members.project_id = opportunities.project_id AND project_members.user_id = auth.uid()));

CREATE POLICY "Members can view opportunity_options" 
  ON opportunity_options FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM opportunities 
    JOIN project_members ON project_members.project_id = opportunities.project_id 
    WHERE opportunities.id = opportunity_options.opportunity_id AND project_members.user_id = auth.uid()
  ));

-- 5. RPCs (Stored Procedures)

-- Generate Sequential Display ID for Opportunities
CREATE OR REPLACE FUNCTION generate_opportunity_display_id()
RETURNS TRIGGER AS $$
DECLARE
  next_val integer;
BEGIN
  INSERT INTO project_sequences (project_id, current_value)
  VALUES (NEW.project_id, 1)
  ON CONFLICT (project_id) 
  DO UPDATE SET current_value = project_sequences.current_value + 1
  RETURNING current_value INTO next_val;

  NEW.display_id := 'VE-' || LPAD(next_val::text, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_opportunity_display_id ON opportunities;
CREATE TRIGGER trg_generate_opportunity_display_id
BEFORE INSERT ON opportunities
FOR EACH ROW
EXECUTE FUNCTION generate_opportunity_display_id();

-- Lock an option and update the parent opportunity status
CREATE OR REPLACE FUNCTION lock_opportunity_option(p_option_id UUID, p_opp_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_option_title text;
  v_project_id uuid;
BEGIN
  -- Authorization Check
  SELECT project_id INTO v_project_id FROM opportunities WHERE id = p_opp_id;
  IF NOT EXISTS (
    SELECT 1 FROM project_members 
    WHERE project_id = v_project_id 
      AND user_id = auth.uid() 
      AND role IN ('owner', 'gc_admin')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Insufficient privileges to lock options';
  END IF;

  -- 0. Temporarily unlock parent to bypass immutability triggers during RPC execution
  UPDATE opportunities SET status = 'Draft' WHERE id = p_opp_id;

  -- 1. Set all options for this opportunity to unlocked
  UPDATE opportunity_options SET is_locked = false WHERE opportunity_id = p_opp_id;

  -- 2. Lock the target option and retrieve its details
  UPDATE opportunity_options SET is_locked = true WHERE id = p_option_id RETURNING title INTO v_option_title;

  -- 3. Update the parent opportunity row to Locked Status
  UPDATE opportunities 
  SET final_direction = 'Locked: ' || v_option_title, 
      status = 'Pending Plan Update' 
  WHERE id = p_opp_id;
END;
$$;

-- Toggle an option's include_in_budget flag
CREATE OR REPLACE FUNCTION toggle_option_budget(p_option_id UUID, p_opp_id UUID, p_is_included BOOLEAN)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_project_id uuid;
BEGIN
  -- Authorization Check
  SELECT project_id INTO v_project_id FROM opportunities WHERE id = p_opp_id;
  IF NOT EXISTS (
    SELECT 1 FROM project_members 
    WHERE project_id = v_project_id 
      AND user_id = auth.uid() 
      AND role IN ('owner', 'gc_admin')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Insufficient privileges to toggle budget';
  END IF;

  UPDATE opportunity_options SET include_in_budget = p_is_included WHERE id = p_option_id;
END;
$$;

-- 6. Immutability Triggers (The Ledger Brakes)
CREATE OR REPLACE FUNCTION enforce_financial_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status IN ('Pending Plan Update', 'GC / Owner Review', 'Implemented') THEN
    IF OLD.cost_impact IS DISTINCT FROM NEW.cost_impact 
       OR OLD.days_impact IS DISTINCT FROM NEW.days_impact 
       OR OLD.title IS DISTINCT FROM NEW.title THEN
      RAISE EXCEPTION 'Financial immutability enforced: Cannot modify core fields of locked records';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_financial_immutability ON opportunities;
CREATE TRIGGER trg_enforce_financial_immutability
BEFORE UPDATE ON opportunities
FOR EACH ROW
EXECUTE FUNCTION enforce_financial_immutability();

CREATE OR REPLACE FUNCTION enforce_options_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
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

DROP TRIGGER IF EXISTS trg_enforce_options_immutability ON opportunity_options;
CREATE TRIGGER trg_enforce_options_immutability
BEFORE INSERT OR UPDATE OR DELETE ON opportunity_options
FOR EACH ROW
EXECUTE FUNCTION enforce_options_immutability();

-- 7. Trigger for Parent Rollup Math (Single Source of Truth)
CREATE OR REPLACE FUNCTION sync_parent_opportunity_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_opp_id uuid;
  v_cost_impact numeric := 0;
  v_days_impact numeric := 0;
  v_has_options boolean := false;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_opp_id := OLD.opportunity_id;
  ELSE
    v_opp_id := NEW.opportunity_id;
  END IF;

  SELECT EXISTS(SELECT 1 FROM opportunity_options WHERE opportunity_id = v_opp_id) INTO v_has_options;

  IF v_has_options THEN
    IF EXISTS (SELECT 1 FROM opportunity_options WHERE opportunity_id = v_opp_id AND is_locked = true) THEN
      SELECT COALESCE(cost_impact, 0), COALESCE(days_impact, 0)
      INTO v_cost_impact, v_days_impact
      FROM opportunity_options
      WHERE opportunity_id = v_opp_id AND is_locked = true
      LIMIT 1;
    ELSIF EXISTS (SELECT 1 FROM opportunity_options WHERE opportunity_id = v_opp_id AND include_in_budget = true) THEN
      SELECT COALESCE(SUM(cost_impact), 0), COALESCE(SUM(days_impact), 0)
      INTO v_cost_impact, v_days_impact
      FROM opportunity_options
      WHERE opportunity_id = v_opp_id AND include_in_budget = true;
    ELSE
      SELECT COALESCE(MAX(cost_impact), 0), COALESCE(MAX(days_impact), 0)
      INTO v_cost_impact, v_days_impact
      FROM opportunity_options
      WHERE opportunity_id = v_opp_id;
    END IF;

    UPDATE opportunities
    SET cost_impact = v_cost_impact,
        days_impact = v_days_impact
    WHERE id = v_opp_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_parent_opportunity_totals ON opportunity_options;
CREATE TRIGGER trg_sync_parent_opportunity_totals
AFTER INSERT OR UPDATE OR DELETE ON opportunity_options
FOR EACH ROW
EXECUTE FUNCTION sync_parent_opportunity_totals();

-- 8. Audit Logging
CREATE TABLE IF NOT EXISTS audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id uuid NOT NULL,
    table_name text NOT NULL,
    action_type text NOT NULL CHECK (action_type IN ('INSERT', 'UPDATE', 'DELETE')),
    old_payload jsonb,
    new_payload jsonb,
    user_id uuid,
    project_id uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE OR REPLACE FUNCTION process_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_project_id uuid;
  v_audit_enabled boolean;
BEGIN
  IF TG_TABLE_NAME = 'opportunities' THEN
    v_project_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.project_id ELSE NEW.project_id END;
  ELSIF TG_TABLE_NAME = 'opportunity_options' THEN
    SELECT project_id INTO v_project_id FROM opportunities WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.opportunity_id ELSE NEW.opportunity_id END;
  END IF;

  SELECT enable_audit_logging INTO v_audit_enabled
  FROM project_settings
  WHERE project_id = v_project_id;

  IF v_audit_enabled IS NOT TRUE THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF (row_to_json(OLD)::jsonb - 'updated_at') IS NOT DISTINCT FROM (row_to_json(NEW)::jsonb - 'updated_at') THEN
      RETURN NEW;
    END IF;
    INSERT INTO audit_logs (record_id, table_name, action_type, old_payload, new_payload, user_id, project_id)
    VALUES (NEW.id, TG_TABLE_NAME, 'UPDATE', row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb, auth.uid(), v_project_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (record_id, table_name, action_type, old_payload, user_id, project_id)
    VALUES (OLD.id, TG_TABLE_NAME, 'DELETE', row_to_json(OLD)::jsonb, auth.uid(), v_project_id);
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (record_id, table_name, action_type, new_payload, user_id, project_id)
    VALUES (NEW.id, TG_TABLE_NAME, 'INSERT', row_to_json(NEW)::jsonb, auth.uid(), v_project_id);
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_opportunities ON opportunities;
CREATE TRIGGER trg_audit_opportunities
AFTER INSERT OR UPDATE OR DELETE ON opportunities
FOR EACH ROW EXECUTE FUNCTION process_audit_log();

DROP TRIGGER IF EXISTS trg_audit_opportunity_options ON opportunity_options;
CREATE TRIGGER trg_audit_opportunity_options
AFTER INSERT OR UPDATE OR DELETE ON opportunity_options
FOR EACH ROW EXECUTE FUNCTION process_audit_log();

-- 9. Global Cost Codes Table
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
