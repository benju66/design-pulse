-- =============================================================
-- DESIGN PULSE — AUDIT PHASE 1 SQL FIXES
-- Date: 2026-04-30
-- Fixes: C-2, W-5
-- Safe to re-run: YES (all CREATE OR REPLACE, ON CONFLICT DO NOTHING)
-- =============================================================


-- ---------------------------------------------------------------
-- FIX C-2: Guarantee a project_settings row is created atomically
--           with every new project. Prevents the silent "running
--           on hardcoded defaults forever" bug for new projects.
-- ---------------------------------------------------------------
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
  -- 1. Create the project record
  INSERT INTO projects (name, description, project_number, procore_project_id, procore_company_id)
  VALUES (p_name, p_description, p_project_number, p_procore_project_id, p_procore_company_id)
  RETURNING * INTO v_project;

  -- 2. Assign the creator as owner
  INSERT INTO project_members (project_id, user_id, role)
  VALUES (v_project.id, auth.uid(), 'owner');

  -- 3. [C-2 FIX] Guarantee a settings row exists immediately.
  --    ON CONFLICT DO NOTHING makes this safe to re-run and safe
  --    for any projects that already have a settings row.
  INSERT INTO project_settings (project_id)
  VALUES (v_project.id)
  ON CONFLICT (project_id) DO NOTHING;

  RETURN NEXT v_project;
  RETURN;
END;
$$;


-- ---------------------------------------------------------------
-- FIX W-5: Open the immutability escape hatch at the very start
--           of lock_opportunity_option, before ANY UPDATE statements.
--
--           Root cause: when re-locking (switching which contender
--           is locked), the first UPDATE sets status = 'Draft',
--           but enforce_financial_immutability fires BEFORE that
--           UPDATE and sees OLD.status = 'Approved' → blocks it.
--           The sync trigger also fires on opportunity_options
--           updates and tries to UPDATE opportunities while it is
--           still 'Approved' — same block.
--
--           The escape hatch is transaction-scoped (3rd arg = true)
--           so it resets automatically at commit/rollback.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lock_opportunity_option(p_option_id UUID, p_opp_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_option_title    text;
  v_option_cost     numeric;
  v_option_days     numeric;
  v_option_cost_code text;
  v_option_division  text;
  v_requires_coord  boolean;
  v_coord_reqs      jsonb;
  v_new_coord_details jsonb := '{}'::jsonb;
  k text;
  v text;
BEGIN
  -- 1. RBAC check — must happen before escape hatch
  IF NOT public.has_project_permission(
    (SELECT project_id FROM opportunities WHERE id = p_opp_id),
    'can_lock_options'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Insufficient privileges to lock options';
  END IF;

  -- 2. [W-5 FIX] Open the escape hatch for this transaction only.
  --    This allows all subsequent UPDATEs on opportunities and
  --    opportunity_options to bypass the immutability triggers,
  --    even if the record is currently in 'Approved' status.
  --    The TRUE flag means it auto-resets on transaction end.
  PERFORM set_config('designpulse.bypass_immutability', 'true', true);

  -- 3. Reset all options to unlocked, then lock the target
  UPDATE opportunities SET status = 'Draft' WHERE id = p_opp_id;
  UPDATE opportunity_options SET is_locked = false WHERE opportunity_id = p_opp_id;

  UPDATE opportunity_options SET is_locked = true WHERE id = p_option_id
  RETURNING title, cost_impact, days_impact, cost_code, division,
            COALESCE(requires_coordination, true),
            COALESCE(coordination_requirements, '{}'::jsonb)
  INTO v_option_title, v_option_cost, v_option_days,
       v_option_cost_code, v_option_division, v_requires_coord, v_coord_reqs;

  -- 4. Build coordination_details from the locked option's requirements
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
        -- Safely ignore malformed JSONB values to prevent transaction aborts
      END;
    END LOOP;
  END IF;

  -- 5. Write the final locked state back to the parent opportunity
  IF v_requires_coord THEN
    UPDATE opportunities SET
      final_direction    = 'Locked: ' || v_option_title,
      status             = 'Approved',
      cost_impact        = v_option_cost,
      days_impact        = v_option_days,
      cost_code          = COALESCE(v_option_cost_code, cost_code),
      division           = COALESCE(v_option_division, division),
      coordination_status = 'Pending Plan Update',
      coordination_details = v_new_coord_details
    WHERE id = p_opp_id;
  ELSE
    UPDATE opportunities SET
      final_direction    = 'Locked: ' || v_option_title,
      status             = 'Approved',
      cost_impact        = v_option_cost,
      days_impact        = v_option_days,
      cost_code          = COALESCE(v_option_cost_code, cost_code),
      division           = COALESCE(v_option_division, division),
      coordination_status = 'Not Required',
      coordination_details = '{}'::jsonb
    WHERE id = p_opp_id;
  END IF;
END;
$$;


-- ---------------------------------------------------------------
-- VERIFY: Run these SELECT statements after applying to confirm.
-- ---------------------------------------------------------------

-- Should return the updated function body containing 'bypass_immutability'
SELECT prosrc FROM pg_proc WHERE proname = 'lock_opportunity_option';

-- Should return the updated function body containing 'project_settings'
SELECT prosrc FROM pg_proc WHERE proname = 'create_new_project';
