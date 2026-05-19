-- ── Phase 2 Migration: Variance Note Unique Constraint + Upsert RPC ────────
-- Execute in order. Run de-duplication BEFORE adding the unique constraint.

-- Step 1: De-duplicate existing variance notes (keep latest per version+code)
-- This handles potential duplicates from multi-chunk imports where the same
-- cost code appeared in multiple estimate lines.
DELETE FROM public.estimate_variance_notes a
USING public.estimate_variance_notes b
WHERE a.estimate_version_id = b.estimate_version_id
  AND a.cost_code = b.cost_code
  AND a.created_at < b.created_at;

-- Step 2: Add unique constraint
ALTER TABLE public.estimate_variance_notes
ADD CONSTRAINT uq_variance_note_version_code UNIQUE (estimate_version_id, cost_code);

-- Step 3: Add author_id column (Phase 6 prep — nullable for now)
ALTER TABLE public.estimate_variance_notes
ADD COLUMN IF NOT EXISTS author_id uuid REFERENCES auth.users(id);

-- Step 4: Create upsert RPC for inline variance note editing
-- Writes are ALWAYS scoped to the active estimate version.
-- Historical version notes are never touched.
CREATE OR REPLACE FUNCTION public.upsert_variance_note(
  p_project_id uuid,
  p_cost_code  text,
  p_note       text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_active_version_id uuid;
BEGIN
  -- RBAC check — mirrors the RLS policy on estimate_variance_notes
  IF NOT has_project_permission(p_project_id, 'can_edit_project_settings') THEN
    RAISE EXCEPTION 'Unauthorized: insufficient privileges to edit variance notes';
  END IF;

  -- Find active version — writes are ALWAYS scoped to active version
  SELECT id INTO v_active_version_id
  FROM project_estimate_versions
  WHERE project_id = p_project_id AND is_active = true;

  IF v_active_version_id IS NULL THEN
    RAISE EXCEPTION 'No active estimate version found for this project';
  END IF;

  -- Open escape hatch BEFORE any write (AGENTS.md Rule B — bypass immutability)
  -- This is safe because we ONLY allow writes to the active version.
  -- Historical version notes are never touched by this RPC.
  PERFORM set_config('designpulse.bypass_immutability', 'true', true);

  -- Upsert — scoped to active version only
  INSERT INTO estimate_variance_notes (
    project_id, estimate_version_id, cost_code, variance_note, author_id
  )
  VALUES (p_project_id, v_active_version_id, p_cost_code, TRIM(p_note), auth.uid())
  ON CONFLICT (estimate_version_id, cost_code)
  DO UPDATE SET
    variance_note = TRIM(p_note),
    author_id = auth.uid(),
    updated_at = now();
END;
$$;
