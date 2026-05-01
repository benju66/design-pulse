-- ==========================================
-- PHASE 5: ROSETTA STONE SPEC BOOK EXTRACTOR
-- Database Architecture & RPC Additions
-- ==========================================

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
