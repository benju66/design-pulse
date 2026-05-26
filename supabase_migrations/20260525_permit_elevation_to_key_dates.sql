-- Permit Elevation: Allow permits to be surfaced on the executive Key Dates timeline.
ALTER TABLE permits ADD COLUMN IF NOT EXISTS is_elevated_key_date boolean DEFAULT false;
