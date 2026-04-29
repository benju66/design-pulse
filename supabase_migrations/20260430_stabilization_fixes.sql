-- 1. Refactor Coordination Status Trigger (Bulletproof JSONB Handling)
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
    -- Ensure null-safety
    v_safe_details := COALESCE(NEW.coordination_details, '{}'::jsonb);
    
    -- Ensure object type safety to prevent jsonb_each_text crashes
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

-- 2. Schema Modification for Sequences
ALTER TABLE project_sequences 
  ADD COLUMN IF NOT EXISTS ve_current_value integer DEFAULT 0, 
  ADD COLUMN IF NOT EXISTS cd_current_value integer DEFAULT 0;

-- 3. Bulletproof Data Migration: Calculate actual max sequences to prevent ID collisions
UPDATE project_sequences ps
SET 
  ve_current_value = (
    SELECT COALESCE(MAX(NULLIF(regexp_replace(display_id, '\D', '', 'g'), '')::int), 0)
    FROM opportunities o WHERE o.project_id = ps.project_id AND o.record_type = 'VE'
  ),
  cd_current_value = (
    SELECT COALESCE(MAX(NULLIF(regexp_replace(display_id, '\D', '', 'g'), '')::int), 0)
    FROM opportunities o WHERE o.project_id = ps.project_id AND o.record_type = 'Coordination'
  );

-- 4. Drop legacy column
ALTER TABLE project_sequences DROP COLUMN IF EXISTS current_value;

-- 5. Refactor ID Generation Trigger (Unified Upsert)
CREATE OR REPLACE FUNCTION generate_opportunity_display_id()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  next_val integer;
  v_record_type text;
BEGIN
  -- Safe fallback to 'VE' if record_type is somehow null
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
