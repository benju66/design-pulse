-- Design Pulse Database Schema
-- Run this entire script in your Supabase SQL Editor to initialize or reset the environment.

-- 1. Projects Table
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Project Settings Table
CREATE TABLE IF NOT EXISTS project_settings (
  project_id text PRIMARY KEY,
  categories jsonb DEFAULT '["Existing Conditions", "Arch Plans/Specs", "Owner Standard", "Budgeted Item", "Other"]'::jsonb,
  scopes jsonb DEFAULT '["Corridor / Common", "Unit Interiors", "Back of House"]'::jsonb,
  sidebar_items jsonb DEFAULT '[{"id": "dashboard", "label": "VE Matrix", "iconName": "LayoutDashboard", "visible": true}, {"id": "map", "label": "Map View", "iconName": "Map", "visible": true}, {"id": "analytics", "label": "Analytics", "iconName": "PieChart", "visible": true}, {"id": "coordination", "label": "Coordination Tracker", "iconName": "ListChecks", "visible": true}]'::jsonb,
  project_name text,
  location text,
  original_budget numeric DEFAULT 5000000,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2.5 Project Sequences Table (For VE-001 IDs)
CREATE TABLE IF NOT EXISTS project_sequences (
  project_id text PRIMARY KEY,
  current_value integer DEFAULT 0
);

-- 3. Opportunities (VE Log Items) Table
CREATE TABLE IF NOT EXISTS opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL, -- Ties back to the project ID in the URL
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
  cost_code text,
  arch_completed boolean DEFAULT false,
  mep_completed boolean DEFAULT false,
  struct_completed boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
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
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS (Row Level Security) - Optional but recommended for production
-- ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE project_settings ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE opportunity_options ENABLE ROW LEVEL SECURITY;

-- If you enable RLS, uncomment these permissive policies for local/dev testing:
-- CREATE POLICY "Enable full access for all users" ON projects FOR ALL USING (true);
-- CREATE POLICY "Enable full access for all users" ON project_settings FOR ALL USING (true);
-- CREATE POLICY "Enable full access for all users" ON opportunities FOR ALL USING (true);
-- CREATE POLICY "Enable full access for all users" ON opportunity_options FOR ALL USING (true);

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
AS $$
DECLARE
  v_option_title text;
BEGIN
  -- 1. Set all options for this opportunity to unlocked
  UPDATE opportunity_options
  SET is_locked = false
  WHERE opportunity_id = p_opp_id;

  -- 2. Lock the target option and retrieve its details
  UPDATE opportunity_options
  SET is_locked = true
  WHERE id = p_option_id
  RETURNING title INTO v_option_title;

  -- 3. Update the parent opportunity row (status and direction only)
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
AS $$
BEGIN
  -- 1. Update the include_in_budget flag on the option
  UPDATE opportunity_options
  SET include_in_budget = p_is_included
  WHERE id = p_option_id;
  
  -- The trigger will handle the financial rollup math.
END;
$$;

-- 6. Trigger for Parent Rollup Math (Single Source of Truth)
CREATE OR REPLACE FUNCTION sync_parent_opportunity_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_opp_id uuid;
  v_cost_impact numeric := 0;
  v_days_impact numeric := 0;
  v_has_options boolean := false;
BEGIN
  -- Determine the opportunity_id based on operation type
  IF TG_OP = 'DELETE' THEN
    v_opp_id := OLD.opportunity_id;
  ELSE
    v_opp_id := NEW.opportunity_id;
  END IF;

  -- Check if any options exist for this opportunity
  SELECT EXISTS(SELECT 1 FROM opportunity_options WHERE opportunity_id = v_opp_id) INTO v_has_options;

  IF v_has_options THEN
    -- 1. Check for locked option
    IF EXISTS (SELECT 1 FROM opportunity_options WHERE opportunity_id = v_opp_id AND is_locked = true) THEN
      SELECT COALESCE(cost_impact, 0), COALESCE(days_impact, 0)
      INTO v_cost_impact, v_days_impact
      FROM opportunity_options
      WHERE opportunity_id = v_opp_id AND is_locked = true
      LIMIT 1;

    -- 2. Check for included options (Hybrid)
    ELSIF EXISTS (SELECT 1 FROM opportunity_options WHERE opportunity_id = v_opp_id AND include_in_budget = true) THEN
      SELECT COALESCE(SUM(cost_impact), 0), COALESCE(SUM(days_impact), 0)
      INTO v_cost_impact, v_days_impact
      FROM opportunity_options
      WHERE opportunity_id = v_opp_id AND include_in_budget = true;

    -- 3. Default to MAX (Potential Exposure)
    ELSE
      SELECT COALESCE(MAX(cost_impact), 0), COALESCE(MAX(days_impact), 0)
      INTO v_cost_impact, v_days_impact
      FROM opportunity_options
      WHERE opportunity_id = v_opp_id;
    END IF;

    -- Update the parent opportunity
    UPDATE opportunities
    SET cost_impact = v_cost_impact,
        days_impact = v_days_impact
    WHERE id = v_opp_id;
  END IF;

  RETURN NULL; -- AFTER trigger
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_parent_opportunity_totals ON opportunity_options;
CREATE TRIGGER trg_sync_parent_opportunity_totals
AFTER INSERT OR UPDATE OR DELETE ON opportunity_options
FOR EACH ROW
EXECUTE FUNCTION sync_parent_opportunity_totals();

-- 7. Audit Logging

-- Alter Settings to include the toggle
ALTER TABLE project_settings ADD COLUMN IF NOT EXISTS enable_audit_logging BOOLEAN DEFAULT false;

-- Create Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id uuid NOT NULL,
    table_name text NOT NULL,
    action_type text NOT NULL CHECK (action_type IN ('INSERT', 'UPDATE', 'DELETE')),
    old_payload jsonb,
    new_payload jsonb,
    user_id uuid,
    project_id text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for audit_logs (Optional but recommended)
-- ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Enable full access for all users" ON audit_logs FOR ALL USING (true);

-- Smart Trigger Function for Event Sourcing
CREATE OR REPLACE FUNCTION process_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_project_id text;
  v_audit_enabled boolean;
BEGIN
  -- 1. Determine project_id based on table
  IF TG_TABLE_NAME = 'opportunities' THEN
    IF TG_OP = 'DELETE' THEN
      v_project_id := OLD.project_id;
    ELSE
      v_project_id := NEW.project_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'opportunity_options' THEN
    IF TG_OP = 'DELETE' THEN
      SELECT project_id INTO v_project_id FROM opportunities WHERE id = OLD.opportunity_id;
    ELSE
      SELECT project_id INTO v_project_id FROM opportunities WHERE id = NEW.opportunity_id;
    END IF;
  END IF;

  -- 2. Gatekeeper Check: Respect the enable_audit_logging toggle
  SELECT enable_audit_logging INTO v_audit_enabled
  FROM project_settings
  WHERE project_id = v_project_id;

  IF v_audit_enabled IS NOT TRUE THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  -- 3. Execute Logging
  IF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (record_id, table_name, action_type, old_payload, user_id, project_id)
    VALUES (OLD.id, TG_TABLE_NAME, 'DELETE', row_to_json(OLD)::jsonb, auth.uid(), v_project_id);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (record_id, table_name, action_type, old_payload, new_payload, user_id, project_id)
    VALUES (NEW.id, TG_TABLE_NAME, 'UPDATE', row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb, auth.uid(), v_project_id);
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (record_id, table_name, action_type, new_payload, user_id, project_id)
    VALUES (NEW.id, TG_TABLE_NAME, 'INSERT', row_to_json(NEW)::jsonb, auth.uid(), v_project_id);
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

-- Attach Triggers to Tables
DROP TRIGGER IF EXISTS trg_audit_opportunities ON opportunities;
CREATE TRIGGER trg_audit_opportunities
AFTER INSERT OR UPDATE OR DELETE ON opportunities
FOR EACH ROW EXECUTE FUNCTION process_audit_log();

DROP TRIGGER IF EXISTS trg_audit_opportunity_options ON opportunity_options;
CREATE TRIGGER trg_audit_opportunity_options
AFTER INSERT OR UPDATE OR DELETE ON opportunity_options
FOR EACH ROW EXECUTE FUNCTION process_audit_log();
