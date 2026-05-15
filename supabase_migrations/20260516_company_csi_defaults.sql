-- ==========================================
-- PHASE 7: COMPANY CSI DEFAULTS
-- Global CSI-to-Cost-Code Mapping Library
-- ==========================================

-- 1. Create the company_csi_defaults table (Finding 2: UNIQUE(csi_number) — 1:1 Rosetta Stone)
CREATE TABLE IF NOT EXISTS company_csi_defaults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  csi_number text NOT NULL UNIQUE,
  normalized_csi_number text GENERATED ALWAYS AS (
    regexp_replace(lower(csi_number), '[^a-z0-9]', '', 'g')
  ) STORED,
  description text,
  cost_code text REFERENCES cost_codes(code) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE company_csi_defaults ENABLE ROW LEVEL SECURITY;

-- RLS: Anyone can read (needed for project seeding); explicit write policies (Finding 1)
DROP POLICY IF EXISTS "Anyone can view company_csi_defaults" ON company_csi_defaults;
CREATE POLICY "Anyone can view company_csi_defaults"
  ON company_csi_defaults FOR SELECT USING (true);

DROP POLICY IF EXISTS "Only admins can insert company_csi_defaults" ON company_csi_defaults;
CREATE POLICY "Only admins can insert company_csi_defaults"
  ON company_csi_defaults FOR INSERT WITH CHECK (is_platform_admin());

DROP POLICY IF EXISTS "Only admins can update company_csi_defaults" ON company_csi_defaults;
CREATE POLICY "Only admins can update company_csi_defaults"
  ON company_csi_defaults FOR UPDATE USING (is_platform_admin());

DROP POLICY IF EXISTS "Only admins can delete company_csi_defaults" ON company_csi_defaults;
CREATE POLICY "Only admins can delete company_csi_defaults"
  ON company_csi_defaults FOR DELETE USING (is_platform_admin());

-- Timestamp trigger (inline — no shared function in this schema)
CREATE OR REPLACE FUNCTION trg_fn_company_csi_defaults_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_company_csi_defaults_updated_at ON company_csi_defaults;
CREATE TRIGGER trg_company_csi_defaults_updated_at
  BEFORE UPDATE ON company_csi_defaults
  FOR EACH ROW EXECUTE FUNCTION trg_fn_company_csi_defaults_updated_at();


-- 2. Add `source` lineage column to project_csi_specs
ALTER TABLE project_csi_specs
ADD COLUMN IF NOT EXISTS source text DEFAULT 'project'
  CHECK (source IN ('company_default', 'project', 'ml_suggested'));


-- 3. Update bulk_upsert_project_csi_specs to handle `source` lineage
CREATE OR REPLACE FUNCTION bulk_upsert_project_csi_specs(p_project_id UUID, p_payload JSONB)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- RBAC Guard
  IF NOT public.has_project_permission(p_project_id, 'can_edit_records') THEN
    RAISE EXCEPTION 'Unauthorized: Insufficient privileges';
  END IF;

  -- Array Type-Safety Guard
  IF jsonb_typeof(COALESCE(p_payload, '[]'::jsonb)) = 'array' THEN
    INSERT INTO project_csi_specs (id, project_id, csi_number, description, cost_code, source)
    SELECT
      COALESCE((val->>'id')::uuid, gen_random_uuid()),
      p_project_id,
      val->>'csi_number',
      val->>'description',
      NULLIF(val->>'cost_code', ''), -- Foreign Key safety
      COALESCE(NULLIF(val->>'source', ''), 'project')  -- Default to 'project' if not specified
    FROM jsonb_array_elements(p_payload) AS val
    ON CONFLICT (project_id, csi_number) DO UPDATE SET
      description = EXCLUDED.description,
      cost_code = EXCLUDED.cost_code,
      source = EXCLUDED.source;  -- Flip source on override
  ELSE
    RAISE EXCEPTION 'Invalid Payload: Expected a JSON array.';
  END IF;
END;
$$;

-- Grant execute (idempotent)
GRANT EXECUTE ON FUNCTION bulk_upsert_project_csi_specs(UUID, JSONB) TO authenticated;


-- 4. Bulk upsert RPC for company defaults (Finding 2: ON CONFLICT uses UNIQUE(csi_number))
CREATE OR REPLACE FUNCTION bulk_upsert_company_csi_defaults(p_payload JSONB)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Platform Admin RBAC Guard
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Platform admin required';
  END IF;

  -- Array Type-Safety Guard (C21)
  IF jsonb_typeof(COALESCE(p_payload, '[]'::jsonb)) = 'array' THEN
    INSERT INTO company_csi_defaults (id, csi_number, description, cost_code)
    SELECT
      COALESCE((val->>'id')::uuid, gen_random_uuid()),
      TRIM(val->>'csi_number'),  -- Normalize whitespace on import
      val->>'description',
      NULLIF(val->>'cost_code', '')
    FROM jsonb_array_elements(p_payload) AS val
    ON CONFLICT (csi_number) DO UPDATE SET
      description = EXCLUDED.description,
      cost_code = EXCLUDED.cost_code;  -- Allow re-mapping on re-upload
  ELSE
    RAISE EXCEPTION 'Invalid Payload: Expected a JSON array.';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION bulk_upsert_company_csi_defaults(JSONB) TO authenticated;


-- 5. Seed RPC for manual project seeding
CREATE OR REPLACE FUNCTION seed_project_from_company_defaults(p_project_id UUID)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count integer;
BEGIN
  -- RBAC Guard
  IF NOT public.has_project_permission(p_project_id, 'can_edit_records') THEN
    RAISE EXCEPTION 'Unauthorized: Insufficient privileges';
  END IF;

  INSERT INTO project_csi_specs (id, project_id, csi_number, description, cost_code, source)
  SELECT
    gen_random_uuid(),
    p_project_id,
    d.csi_number,
    d.description,
    d.cost_code,
    'company_default'
  FROM company_csi_defaults d
  ON CONFLICT (project_id, csi_number) DO NOTHING;  -- Don't overwrite existing project specs

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION seed_project_from_company_defaults(UUID) TO authenticated;


-- 6. Guard ML Flywheel trigger against company defaults
-- Re-creates the function from Phase 1 with an additional source check
CREATE OR REPLACE FUNCTION upsert_global_csi_training_data()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Skip company defaults to keep ML signal clean (Deep Review Finding)
  IF NEW.source = 'company_default' THEN
    RETURN NEW;
  END IF;

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

-- Trigger already exists from Phase 1, function replacement is sufficient


-- ==========================================
-- PHASE 2: ROSETTA STONE AGGREGATION VIEW
-- Cross-project CSI override visibility
-- ==========================================

-- 7. Rosetta Stone aggregation RPC
CREATE OR REPLACE FUNCTION get_company_csi_rosetta_view()
RETURNS TABLE (
  cost_code text,
  cost_code_description text,
  default_csi_number text,
  default_csi_description text,
  project_specs jsonb  -- Array of {project_id, project_name, csi_number}
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Platform admin required';
  END IF;

  RETURN QUERY
  SELECT
    d.cost_code,
    cc.description AS cost_code_description,
    d.csi_number AS default_csi_number,
    d.description AS default_csi_description,
    COALESCE(
      jsonb_agg(
        DISTINCT jsonb_build_object(
          'project_id', ps.project_id,
          'project_name', p.name,
          'csi_number', ps.csi_number
        )
      ) FILTER (WHERE ps.id IS NOT NULL AND ps.source = 'project'),
      '[]'::jsonb
    ) AS project_specs
  FROM company_csi_defaults d
  LEFT JOIN cost_codes cc ON cc.code = d.cost_code
  LEFT JOIN project_csi_specs ps
    ON ps.cost_code = d.cost_code
    AND ps.source = 'project'
  LEFT JOIN projects p ON p.id = ps.project_id
  GROUP BY d.cost_code, cc.description, d.csi_number, d.description
  ORDER BY d.cost_code, d.csi_number;
END;
$$;

GRANT EXECUTE ON FUNCTION get_company_csi_rosetta_view() TO authenticated;
