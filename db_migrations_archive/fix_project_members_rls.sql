-- Fix project_members RLS to prevent recursion and evaluation failures

-- 1. Create a SECURITY DEFINER function to securely get the current user's role in a project
CREATE OR REPLACE FUNCTION public.get_user_project_role(p_project_id uuid)
RETURNS project_role
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM public.project_members 
  WHERE project_id = p_project_id AND user_id = auth.uid();
$$;

-- 2. Update SELECT Policy
DROP POLICY IF EXISTS "Members can view project team" ON project_members;
CREATE POLICY "Members can view project team" 
  ON project_members FOR SELECT 
  USING (
    is_platform_admin() OR
    public.get_user_project_role(project_id) IS NOT NULL
  );

-- 3. Update INSERT Policy
DROP POLICY IF EXISTS "Admins can insert project members" ON project_members;
CREATE POLICY "Admins can insert project members" 
  ON project_members FOR INSERT 
  WITH CHECK (
    is_platform_admin() OR
    public.get_user_project_role(project_id) IN ('owner', 'gc_admin')
  );

-- 4. Update UPDATE Policy
DROP POLICY IF EXISTS "Admins can update project members" ON project_members;
CREATE POLICY "Admins can update project members" 
  ON project_members FOR UPDATE
  USING (
    is_platform_admin() OR
    public.get_user_project_role(project_id) IN ('owner', 'gc_admin')
  );

-- 5. Update DELETE Policy
DROP POLICY IF EXISTS "Admins can delete project members" ON project_members;
CREATE POLICY "Admins can delete project members" 
  ON project_members FOR DELETE
  USING (
    is_platform_admin() OR
    public.get_user_project_role(project_id) IN ('owner', 'gc_admin')
  );
