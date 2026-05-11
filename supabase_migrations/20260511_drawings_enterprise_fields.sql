-- Add enterprise metadata fields to project_sheets
ALTER TABLE public.project_sheets
  ADD COLUMN IF NOT EXISTS drawing_title text,
  ADD COLUMN IF NOT EXISTS revision text,
  ADD COLUMN IF NOT EXISTS drawing_date date,
  ADD COLUMN IF NOT EXISTS received_date date;
