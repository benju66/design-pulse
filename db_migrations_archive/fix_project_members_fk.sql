-- 1. Drop the existing foreign key constraint
ALTER TABLE public.project_members
  DROP CONSTRAINT IF EXISTS project_members_user_id_fkey;

-- 2. Re-create it explicitly pointing to auth.users(id)
ALTER TABLE public.project_members
  ADD CONSTRAINT project_members_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES auth.users(id) 
  ON DELETE CASCADE;
