-- Add discipline_id to project_sheets
ALTER TABLE public.project_sheets
  ADD COLUMN IF NOT EXISTS discipline_id text;
