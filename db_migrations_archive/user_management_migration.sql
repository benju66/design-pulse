-- 1. Platform Admins RLS Policies
ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins can view platform_admins" ON platform_admins;
CREATE POLICY "Platform admins can view platform_admins" 
  ON platform_admins FOR SELECT 
  USING (true); -- Allow all authenticated users to see who is an admin (needed for get_system_users)

DROP POLICY IF EXISTS "Only platform admins can insert platform_admins" ON platform_admins;
CREATE POLICY "Only platform admins can insert platform_admins" 
  ON platform_admins FOR INSERT 
  WITH CHECK (is_platform_admin());

DROP POLICY IF EXISTS "Only platform admins can delete platform_admins" ON platform_admins;
CREATE POLICY "Only platform admins can delete platform_admins" 
  ON platform_admins FOR DELETE 
  USING (is_platform_admin());

-- 2. Project Members RLS Policies
DROP POLICY IF EXISTS "Members can view project team" ON project_members;
CREATE POLICY "Members can view project team" 
  ON project_members FOR SELECT 
  USING (
    is_platform_admin() OR
    EXISTS (
      SELECT 1 FROM project_members pm 
      WHERE pm.project_id = project_members.project_id 
      AND pm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can insert project members" ON project_members;
CREATE POLICY "Admins can insert project members" 
  ON project_members FOR INSERT 
  WITH CHECK (
    is_platform_admin() OR
    EXISTS (
      SELECT 1 FROM project_members pm 
      WHERE pm.project_id = project_members.project_id 
      AND pm.user_id = auth.uid()
      AND pm.role IN ('owner', 'gc_admin')
    )
  );

DROP POLICY IF EXISTS "Admins can update project members" ON project_members;
CREATE POLICY "Admins can update project members" 
  ON project_members FOR UPDATE
  USING (
    is_platform_admin() OR
    EXISTS (
      SELECT 1 FROM project_members pm 
      WHERE pm.project_id = project_members.project_id 
      AND pm.user_id = auth.uid()
      AND pm.role IN ('owner', 'gc_admin')
    )
  );

DROP POLICY IF EXISTS "Admins can delete project members" ON project_members;
CREATE POLICY "Admins can delete project members" 
  ON project_members FOR DELETE
  USING (
    is_platform_admin() OR
    EXISTS (
      SELECT 1 FROM project_members pm 
      WHERE pm.project_id = project_members.project_id 
      AND pm.user_id = auth.uid()
      AND pm.role IN ('owner', 'gc_admin')
    )
  );

-- 3. get_system_users RPC
CREATE OR REPLACE FUNCTION get_system_users()
RETURNS TABLE (id uuid, email text, is_platform_admin boolean)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    u.id, 
    u.email::text, 
    EXISTS(SELECT 1 FROM platform_admins pa WHERE pa.user_id = u.id) as is_platform_admin
  FROM auth.users u
  WHERE public.is_platform_admin() 
     OR EXISTS (
       SELECT 1 FROM project_members pm
       WHERE pm.user_id = auth.uid() 
         AND pm.role IN ('owner', 'gc_admin')
     );
$$;

-- 4. get_project_members_with_email RPC
CREATE OR REPLACE FUNCTION get_project_members_with_email(p_project_id UUID)
RETURNS TABLE (project_id uuid, user_id uuid, role project_role, email text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if caller is authorized to view this project
  IF NOT (public.is_platform_admin() OR EXISTS (
    SELECT 1 FROM project_members pm WHERE pm.project_id = p_project_id AND pm.user_id = auth.uid()
  )) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT pm.project_id, pm.user_id, pm.role, u.email::text
  FROM project_members pm
  JOIN auth.users u ON u.id = pm.user_id
  WHERE pm.project_id = p_project_id;
END;
$$;
