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
