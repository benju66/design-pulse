-- 1. Update get_system_users RPC
CREATE OR REPLACE FUNCTION get_system_users()
RETURNS TABLE (id uuid, email text, name text, is_platform_admin boolean)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    u.id, 
    u.email::text, 
    (u.raw_user_meta_data->>'display_name')::text as name,
    EXISTS(SELECT 1 FROM platform_admins pa WHERE pa.user_id = u.id) as is_platform_admin
  FROM auth.users u
  WHERE public.is_platform_admin() 
     OR EXISTS (
       SELECT 1 FROM project_members pm
       WHERE pm.user_id = auth.uid() 
         AND pm.role IN ('owner', 'gc_admin')
     );
$$;

-- 2. Update get_project_members_with_email RPC
CREATE OR REPLACE FUNCTION get_project_members_with_email(p_project_id UUID)
RETURNS TABLE (project_id uuid, user_id uuid, role project_role, email text, name text)
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
  SELECT pm.project_id, pm.user_id, pm.role, u.email::text, (u.raw_user_meta_data->>'display_name')::text as name
  FROM project_members pm
  JOIN auth.users u ON u.id = pm.user_id
  WHERE pm.project_id = p_project_id;
END;
$$;
