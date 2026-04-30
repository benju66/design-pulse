-- ==========================================
-- PHASE 1: ROSETTA STONE MIGRATION
-- Database Architecture & Data Standardization
-- ==========================================

-- 1. Create the new ENUM for Cost Types
DO $$ BEGIN
    CREATE TYPE cost_type_enum AS ENUM ('Labor', 'Material', 'Subcontract', 'Equipment', 'Other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Add structural columns to base tables
ALTER TABLE opportunities 
ADD COLUMN IF NOT EXISTS cost_type cost_type_enum,
ADD COLUMN IF NOT EXISTS spec_number_id uuid;

ALTER TABLE opportunity_options 
ADD COLUMN IF NOT EXISTS cost_type cost_type_enum,
ADD COLUMN IF NOT EXISTS spec_number_id uuid;

ALTER TABLE cost_codes 
ADD COLUMN IF NOT EXISTS category_e boolean DEFAULT false;

-- 3. Create Project-Level CSI Specs Table
CREATE TABLE IF NOT EXISTS project_csi_specs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  csi_number text NOT NULL,
  -- Aggressive Normalization: Strip everything except a-z and 0-9, always lowercase
  normalized_csi_number text GENERATED ALWAYS AS (regexp_replace(lower(csi_number), '[^a-z0-9]', '', 'g')) STORED,
  description text,
  cost_code text REFERENCES cost_codes(code) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(project_id, csi_number)
);

ALTER TABLE project_csi_specs ENABLE ROW LEVEL SECURITY;

-- 4. Create ML Flywheel Global Aggregation Table
CREATE TABLE IF NOT EXISTS global_csi_training_data (
  normalized_csi_number text NOT NULL,
  global_cost_code_id text NOT NULL REFERENCES cost_codes(code) ON DELETE CASCADE,
  latest_description text,
  match_count integer DEFAULT 1,
  is_admin_verified boolean DEFAULT false,
  last_seen_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (normalized_csi_number, global_cost_code_id)
);

ALTER TABLE global_csi_training_data ENABLE ROW LEVEL SECURITY;

-- 5. Set up RLS Policies

-- Project CSI Specs RLS
DROP POLICY IF EXISTS "Members can view project_csi_specs" ON project_csi_specs;
CREATE POLICY "Members can view project_csi_specs" 
  ON project_csi_specs FOR SELECT USING (is_platform_admin() OR public.get_user_project_role(project_id) IS NOT NULL);

DROP POLICY IF EXISTS "Members can insert project_csi_specs" ON project_csi_specs;
CREATE POLICY "Members can insert project_csi_specs" 
  ON project_csi_specs FOR INSERT WITH CHECK (public.has_project_permission(project_id, 'can_edit_records'));

DROP POLICY IF EXISTS "Members can update project_csi_specs" ON project_csi_specs;
CREATE POLICY "Members can update project_csi_specs" 
  ON project_csi_specs FOR UPDATE USING (public.has_project_permission(project_id, 'can_edit_records'));

DROP POLICY IF EXISTS "Members can delete project_csi_specs" ON project_csi_specs;
CREATE POLICY "Members can delete project_csi_specs" 
  ON project_csi_specs FOR DELETE USING (public.has_project_permission(project_id, 'can_delete_records'));

-- ML Flywheel RLS
DROP POLICY IF EXISTS "Anyone can view global_csi_training_data" ON global_csi_training_data;
CREATE POLICY "Anyone can view global_csi_training_data" 
  ON global_csi_training_data FOR SELECT USING (true);

DROP POLICY IF EXISTS "Only admins can modify global_csi_training_data" ON global_csi_training_data;
CREATE POLICY "Only admins can modify global_csi_training_data" 
  ON global_csi_training_data FOR ALL USING (is_platform_admin());

-- 6. Trigger Functions

-- Trigger: Upsert into ML Flywheel
CREATE OR REPLACE FUNCTION upsert_global_csi_training_data()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.cost_code IS NOT NULL THEN
    INSERT INTO global_csi_training_data (
      normalized_csi_number, 
      global_cost_code_id, 
      latest_description, 
      match_count, 
      last_seen_at
    )
    VALUES (
      NEW.normalized_csi_number, 
      NEW.cost_code, 
      NEW.description, 
      1, 
      timezone('utc'::text, now())
    )
    ON CONFLICT (normalized_csi_number, global_cost_code_id)
    DO UPDATE SET 
      match_count = global_csi_training_data.match_count + 1,
      latest_description = EXCLUDED.latest_description,
      last_seen_at = EXCLUDED.last_seen_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_upsert_global_csi_training_data ON project_csi_specs;
CREATE TRIGGER trg_upsert_global_csi_training_data 
AFTER INSERT OR UPDATE OF cost_code ON project_csi_specs 
FOR EACH ROW EXECUTE FUNCTION upsert_global_csi_training_data();

-- Trigger: Cascade mapping updates to opportunities
CREATE OR REPLACE FUNCTION cascade_csi_spec_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.cost_code IS DISTINCT FROM OLD.cost_code THEN
    -- Temporarily bypass financial immutability so we can cascade the cost_code
    PERFORM set_config('designpulse.bypass_immutability', 'true', true);
    
    UPDATE opportunities SET cost_code = NEW.cost_code WHERE spec_number_id = NEW.id;
    UPDATE opportunity_options SET cost_code = NEW.cost_code WHERE spec_number_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cascade_csi_spec_update ON project_csi_specs;
CREATE TRIGGER trg_cascade_csi_spec_update 
AFTER UPDATE OF cost_code ON project_csi_specs 
FOR EACH ROW EXECUTE FUNCTION cascade_csi_spec_update();

-- 7. DATA MIGRATION SCRIPT (Clean up .L / .M / .S)
DO $$ 
DECLARE
  v_old_setting text;
BEGIN
  -- Save current immutability setting
  v_old_setting := current_setting('designpulse.bypass_immutability', true);
  
  -- Enable escape hatch
  PERFORM set_config('designpulse.bypass_immutability', 'true', false);

  -- Update Opportunities
  -- SAFE: regexp_replace with $ anchor targets ONLY the trailing suffix.
  -- split_part was removed as it shreds codes with internal periods (e.g. 09.6500.M → 09).
  UPDATE opportunities 
  SET 
    cost_type = CASE 
      WHEN cost_code LIKE '%.L' THEN 'Labor'::cost_type_enum
      WHEN cost_code LIKE '%.M' THEN 'Material'::cost_type_enum
      WHEN cost_code LIKE '%.S' THEN 'Subcontract'::cost_type_enum
      ELSE NULL
    END,
    cost_code = regexp_replace(cost_code, '\.[LMS]$', '')
  WHERE cost_code LIKE '%.L' OR cost_code LIKE '%.M' OR cost_code LIKE '%.S';

  -- Update Opportunity Options
  UPDATE opportunity_options 
  SET 
    cost_type = CASE 
      WHEN cost_code LIKE '%.L' THEN 'Labor'::cost_type_enum
      WHEN cost_code LIKE '%.M' THEN 'Material'::cost_type_enum
      WHEN cost_code LIKE '%.S' THEN 'Subcontract'::cost_type_enum
      ELSE NULL
    END,
    cost_code = regexp_replace(cost_code, '\.[LMS]$', '')
  WHERE cost_code LIKE '%.L' OR cost_code LIKE '%.M' OR cost_code LIKE '%.S';

  -- Now safe to delete the suffixed codes from cost_codes
  DELETE FROM cost_codes WHERE code LIKE '%.L' OR code LIKE '%.M' OR code LIKE '%.S';

  -- Restore immutability setting
  IF v_old_setting IS NOT NULL THEN
    PERFORM set_config('designpulse.bypass_immutability', v_old_setting, false);
  ELSE
    PERFORM set_config('designpulse.bypass_immutability', 'false', false);
  END IF;
END $$;
