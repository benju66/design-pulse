-- Step 1: Add new columns to the opportunities table
ALTER TABLE public.opportunities
ADD COLUMN IF NOT EXISTS scope TEXT DEFAULT 'General',
ADD COLUMN IF NOT EXISTS location TEXT,
ADD COLUMN IF NOT EXISTS arch_plans_spec TEXT,
ADD COLUMN IF NOT EXISTS bok_standard TEXT,
ADD COLUMN IF NOT EXISTS existing_conditions TEXT,
ADD COLUMN IF NOT EXISTS mep_impact TEXT,
ADD COLUMN IF NOT EXISTS owner_goals TEXT,
ADD COLUMN IF NOT EXISTS final_direction TEXT,
ADD COLUMN IF NOT EXISTS backing_required TEXT,
ADD COLUMN IF NOT EXISTS coordination_required TEXT,
ADD COLUMN IF NOT EXISTS design_lock_phase TEXT;
