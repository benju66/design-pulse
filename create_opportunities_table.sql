-- Create the opportunities table
CREATE TABLE IF NOT EXISTS public.opportunities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    project_id TEXT NOT NULL,
    
    title TEXT,
    type TEXT,
    status TEXT DEFAULT 'Draft',
    cost_impact NUMERIC DEFAULT 0,
    days_impact NUMERIC DEFAULT 0,
    
    scope TEXT DEFAULT 'General',
    location TEXT,
    arch_plans_spec TEXT,
    bok_standard TEXT,
    existing_conditions TEXT,
    mep_impact TEXT,
    owner_goals TEXT,
    final_direction TEXT,
    backing_required TEXT,
    coordination_required TEXT,
    design_lock_phase TEXT,
    
    assignee TEXT,
    due_date TEXT,
    
    design_markups JSONB
);

-- Turn on RLS
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

-- Drop the policy if it already exists so we don't get an error
DROP POLICY IF EXISTS "Allow all operations for public" ON public.opportunities;

-- Create the policy
CREATE POLICY "Allow all operations for public" 
ON public.opportunities
FOR ALL 
USING (true) 
WITH CHECK (true);

-- FORCE Supabase API to recognize the new table immediately
NOTIFY pgrst, 'reload schema';
