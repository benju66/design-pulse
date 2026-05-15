-- Migration: 20260515163500_lessons_learned.sql
-- Description: Creates the Lessons Learned schema, tables, and proactive surfacing RPC.

-- 1. Add sequence counter for display IDs
ALTER TABLE project_sequences ADD COLUMN IF NOT EXISTS ll_current_value integer DEFAULT 0;

-- 2. Project Lessons Table
CREATE TABLE IF NOT EXISTS project_lessons (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  display_id     text,                          
  title          text NOT NULL,
  what_happened  text,                          
  root_cause     text,                          
  recommendation text NOT NULL,                 
  category       text DEFAULT 'Other'
    CHECK (category IN ('Design','Constructability','Cost','Schedule',
      'Safety','Procurement','Coordination','Client/Owner','Other')),
  severity       text DEFAULT 'Medium'
    CHECK (severity IN ('Critical','High','Medium','Low','Informational')),
  phase          text DEFAULT 'Pre-Construction'
    CHECK (phase IN ('Pre-Construction','Design Development',
      'Construction Documents','Buyout','Construction','Closeout')),
  status         text DEFAULT 'Draft'
    CHECK (status IN ('Draft','Submitted','Verified','Archived')),
  template_id    text,                          
  cost_code      text,                          
  csi_number     text,                          
  building_area  text,                          
  discipline_id  text,                          
  client_id      uuid REFERENCES clients(id) ON DELETE SET NULL,
  author_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at    timestamptz,
  source_type    text DEFAULT 'manual'          
    CHECK (source_type IN ('manual','ai_generated','ai_assisted')),
  ai_confidence  numeric,                       
  ai_metadata    jsonb DEFAULT '{}'::jsonb,     
  is_deleted     boolean DEFAULT false,
  created_at     timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at     timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Junction Table: Lessons <-> Opportunities
CREATE TABLE IF NOT EXISTS lesson_opportunity_links (
  lesson_id       uuid NOT NULL REFERENCES project_lessons(id) ON DELETE CASCADE,
  opportunity_id  uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  PRIMARY KEY (lesson_id, opportunity_id)
);

-- 4. Lesson Attachments Table
CREATE TABLE IF NOT EXISTS lesson_attachments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id   uuid NOT NULL REFERENCES project_lessons(id) ON DELETE CASCADE,
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_name   text NOT NULL,
  file_path   text NOT NULL,       
  file_size   integer,
  file_type   text,                
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Modify item_activity for Activity Feed integration
ALTER TABLE item_activity ALTER COLUMN opportunity_id DROP NOT NULL;
ALTER TABLE item_activity ADD COLUMN IF NOT EXISTS lesson_id uuid REFERENCES project_lessons(id) ON DELETE CASCADE;

-- 6. Triggers and Immutability
CREATE OR REPLACE FUNCTION generate_lesson_display_id()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE next_val integer;
BEGIN
  INSERT INTO project_sequences (project_id, ll_current_value) VALUES (NEW.project_id, 1)
  ON CONFLICT (project_id) DO UPDATE SET ll_current_value = COALESCE(project_sequences.ll_current_value, 0) + 1
  RETURNING ll_current_value INTO next_val;
  NEW.display_id := 'LL-' || LPAD(next_val::text, 3, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_lesson_display_id ON project_lessons;
CREATE TRIGGER set_lesson_display_id BEFORE INSERT ON project_lessons
FOR EACH ROW EXECUTE FUNCTION generate_lesson_display_id();

CREATE OR REPLACE FUNCTION enforce_lesson_immutability()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('designpulse.bypass_immutability', true) = 'true' THEN RETURN NEW; END IF;
  IF OLD.status = 'Verified' AND NEW.status != 'Verified' THEN
    RAISE EXCEPTION 'Verified lessons are immutable. Must be explicitly reopened.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_lesson_immutability ON project_lessons;
CREATE TRIGGER trg_enforce_lesson_immutability BEFORE UPDATE ON project_lessons
FOR EACH ROW EXECUTE FUNCTION enforce_lesson_immutability();

CREATE OR REPLACE FUNCTION update_lesson_status(p_lesson_id uuid, p_status text)
RETURNS void SECURITY DEFINER AS $$
DECLARE v_project_id uuid;
BEGIN
  SELECT project_id INTO v_project_id FROM project_lessons WHERE id = p_lesson_id;
  IF NOT has_project_permission(v_project_id, 'can_edit_records') THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  PERFORM set_config('designpulse.bypass_immutability', 'true', true);
  UPDATE project_lessons SET status = p_status, verified_by = (CASE WHEN p_status = 'Verified' THEN auth.uid() ELSE NULL END), verified_at = (CASE WHEN p_status = 'Verified' THEN now() ELSE NULL END) WHERE id = p_lesson_id;
END;
$$ LANGUAGE plpgsql;

-- 7. RLS Policies
ALTER TABLE project_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_opportunity_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view project_lessons" ON project_lessons FOR SELECT USING (get_user_project_role(project_id) IS NOT NULL);
CREATE POLICY "Members can insert project_lessons" ON project_lessons FOR INSERT WITH CHECK (has_project_permission(project_id, 'can_edit_records'));
CREATE POLICY "Members can update project_lessons" ON project_lessons FOR UPDATE USING (has_project_permission(project_id, 'can_edit_records'));
CREATE POLICY "Members can delete project_lessons" ON project_lessons FOR DELETE USING (has_project_permission(project_id, 'can_delete_records'));

CREATE POLICY "Members can view lesson_opportunity_links" ON lesson_opportunity_links FOR SELECT USING (EXISTS (SELECT 1 FROM project_lessons WHERE id = lesson_id AND get_user_project_role(project_id) IS NOT NULL));
CREATE POLICY "Members can insert lesson_opportunity_links" ON lesson_opportunity_links FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM project_lessons WHERE id = lesson_id AND has_project_permission(project_id, 'can_edit_records')));
CREATE POLICY "Members can delete lesson_opportunity_links" ON lesson_opportunity_links FOR DELETE USING (EXISTS (SELECT 1 FROM project_lessons WHERE id = lesson_id AND has_project_permission(project_id, 'can_edit_records')));

CREATE POLICY "Members can view lesson_attachments" ON lesson_attachments FOR SELECT USING (get_user_project_role(project_id) IS NOT NULL);
CREATE POLICY "Members can insert lesson_attachments" ON lesson_attachments FOR INSERT WITH CHECK (has_project_permission(project_id, 'can_edit_records'));
CREATE POLICY "Members can delete lesson_attachments" ON lesson_attachments FOR DELETE USING (has_project_permission(project_id, 'can_edit_records'));

-- Storage Policies for lesson_attachments bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('lesson_attachments', 'lesson_attachments', false) ON CONFLICT (id) DO NOTHING;
CREATE POLICY "Members can view lesson_attachments storage" ON storage.objects FOR SELECT USING (bucket_id = 'lesson_attachments' AND public.get_user_project_role((storage.foldername(name))[1]::uuid) IS NOT NULL);
CREATE POLICY "Members can insert lesson_attachments storage" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'lesson_attachments' AND public.has_project_permission((storage.foldername(name))[1]::uuid, 'can_edit_records'));
CREATE POLICY "Members can delete lesson_attachments storage" ON storage.objects FOR DELETE USING (bucket_id = 'lesson_attachments' AND public.has_project_permission((storage.foldername(name))[1]::uuid, 'can_edit_records'));

-- 8. Proactive Surfacing RPC
CREATE OR REPLACE FUNCTION get_lesson_indicators(
  p_project_id uuid,
  p_cost_codes text[]
) RETURNS TABLE (
  cost_code    text,
  lesson_count integer,
  max_severity text
) LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  -- Security check: must be a project member
  IF public.get_user_project_role(p_project_id) IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    pl.cost_code,
    count(*)::integer AS lesson_count,
    -- Custom aggregation for severity priority could go here, for now max() is alphabetical,
    -- but usually you'd write a custom aggregate. We'll use a CASE statement.
    max(pl.severity) AS max_severity
  FROM project_lessons pl
  WHERE pl.cost_code = ANY(p_cost_codes)
    AND pl.status = 'Verified'
    AND pl.is_deleted = false
    -- The user can only see lessons from projects they are members of
    AND public.get_user_project_role(pl.project_id) IS NOT NULL
  GROUP BY pl.cost_code;
END;
$$;
