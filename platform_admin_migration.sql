-- 1. Create Platform Admins Table
CREATE TABLE IF NOT EXISTS platform_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create the STABLE RPC Function
CREATE OR REPLACE FUNCTION is_platform_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS(SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid());
$$;

-- 3. Update RLS Policies to include Admin Bypass
DROP POLICY IF EXISTS "Members can view projects" ON projects;
CREATE POLICY "Members or Admins can view projects" 
  ON projects FOR SELECT 
  USING (
    is_platform_admin() OR 
    EXISTS (SELECT 1 FROM project_members WHERE project_members.project_id = projects.id AND project_members.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Members can view project_settings" ON project_settings;
CREATE POLICY "Members or Admins can view project_settings" 
  ON project_settings FOR SELECT 
  USING (
    is_platform_admin() OR 
    EXISTS (SELECT 1 FROM project_members WHERE project_members.project_id = project_settings.project_id AND project_members.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Members can view opportunities" ON opportunities;
CREATE POLICY "Members or Admins can view opportunities" 
  ON opportunities FOR SELECT 
  USING (
    is_platform_admin() OR 
    EXISTS (SELECT 1 FROM project_members WHERE project_members.project_id = opportunities.project_id AND project_members.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Members can view opportunity_options" ON opportunity_options;
CREATE POLICY "Members or Admins can view opportunity_options" 
  ON opportunity_options FOR SELECT 
  USING (
    is_platform_admin() OR 
    EXISTS (
      SELECT 1 FROM opportunities 
      JOIN project_members ON project_members.project_id = opportunities.project_id 
      WHERE opportunities.id = opportunity_options.opportunity_id AND project_members.user_id = auth.uid()
    )
  );

-- 4. Secure Cost Codes
ALTER TABLE cost_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view cost codes" ON cost_codes;
CREATE POLICY "Anyone can view cost codes" ON cost_codes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Only admins can modify cost codes" ON cost_codes;
CREATE POLICY "Only admins can modify cost codes" ON cost_codes FOR ALL USING (is_platform_admin());
