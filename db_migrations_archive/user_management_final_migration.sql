-- 1. Create secure project creation RPC
CREATE OR REPLACE FUNCTION create_new_project(p_name text, p_description text)
RETURNS SETOF projects
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_project projects%ROWTYPE;
BEGIN
  -- Insert the new project
  INSERT INTO projects (name, description)
  VALUES (p_name, p_description)
  RETURNING * INTO v_project;

  -- Automatically add the creator as the 'owner' to the junction table
  INSERT INTO project_members (project_id, user_id, role)
  VALUES (v_project.id, auth.uid(), 'owner');

  -- Return the inserted project row to the frontend
  RETURN NEXT v_project;
  RETURN;
END;
$$;

-- 2. Opportunities Table RLS (Write Policies)
DROP POLICY IF EXISTS "Members can insert opportunities" ON opportunities;
CREATE POLICY "Members can insert opportunities" 
  ON opportunities FOR INSERT
  WITH CHECK (
    is_platform_admin() OR
    EXISTS (
      SELECT 1 FROM project_members pm 
      WHERE pm.project_id = project_id AND pm.user_id = auth.uid() AND pm.role IN ('owner', 'gc_admin', 'design_team')
    )
  );

DROP POLICY IF EXISTS "Members can update opportunities" ON opportunities;
CREATE POLICY "Members can update opportunities" 
  ON opportunities FOR UPDATE
  USING (
    is_platform_admin() OR
    EXISTS (
      SELECT 1 FROM project_members pm 
      WHERE pm.project_id = project_id AND pm.user_id = auth.uid() AND pm.role IN ('owner', 'gc_admin', 'design_team')
    )
  );

DROP POLICY IF EXISTS "Admins can delete opportunities" ON opportunities;
CREATE POLICY "Admins can delete opportunities" 
  ON opportunities FOR DELETE
  USING (
    is_platform_admin() OR
    EXISTS (
      SELECT 1 FROM project_members pm 
      WHERE pm.project_id = project_id AND pm.user_id = auth.uid() AND pm.role IN ('owner', 'gc_admin')
    )
  );

-- 3. Opportunity Options Table RLS (Write Policies)
DROP POLICY IF EXISTS "Members can insert opportunity_options" ON opportunity_options;
CREATE POLICY "Members can insert opportunity_options" 
  ON opportunity_options FOR INSERT
  WITH CHECK (
    is_platform_admin() OR
    EXISTS (
      SELECT 1 FROM opportunities o
      JOIN project_members pm ON pm.project_id = o.project_id
      WHERE o.id = opportunity_id AND pm.user_id = auth.uid() AND pm.role IN ('owner', 'gc_admin', 'design_team')
    )
  );

DROP POLICY IF EXISTS "Members can update opportunity_options" ON opportunity_options;
CREATE POLICY "Members can update opportunity_options" 
  ON opportunity_options FOR UPDATE
  USING (
    is_platform_admin() OR
    EXISTS (
      SELECT 1 FROM opportunities o
      JOIN project_members pm ON pm.project_id = o.project_id
      WHERE o.id = opportunity_id AND pm.user_id = auth.uid() AND pm.role IN ('owner', 'gc_admin', 'design_team')
    )
  );

DROP POLICY IF EXISTS "Admins can delete opportunity_options" ON opportunity_options;
CREATE POLICY "Admins can delete opportunity_options" 
  ON opportunity_options FOR DELETE
  USING (
    is_platform_admin() OR
    EXISTS (
      SELECT 1 FROM opportunities o
      JOIN project_members pm ON pm.project_id = o.project_id
      WHERE o.id = opportunity_id AND pm.user_id = auth.uid() AND pm.role IN ('owner', 'gc_admin')
    )
  );

-- 4. Project Settings Table RLS (Write Policies)
-- Needs INSERT and UPDATE for the upsert functionality in the frontend
DROP POLICY IF EXISTS "Admins can insert project_settings" ON project_settings;
CREATE POLICY "Admins can insert project_settings" 
  ON project_settings FOR INSERT
  WITH CHECK (
    is_platform_admin() OR
    EXISTS (
      SELECT 1 FROM project_members pm 
      WHERE pm.project_id = project_id AND pm.user_id = auth.uid() AND pm.role IN ('owner', 'gc_admin')
    )
  );

DROP POLICY IF EXISTS "Admins can update project_settings" ON project_settings;
CREATE POLICY "Admins can update project_settings" 
  ON project_settings FOR UPDATE
  USING (
    is_platform_admin() OR
    EXISTS (
      SELECT 1 FROM project_members pm 
      WHERE pm.project_id = project_id AND pm.user_id = auth.uid() AND pm.role IN ('owner', 'gc_admin')
    )
  );
