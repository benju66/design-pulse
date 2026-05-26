-- Migration: Add native date column issued_date to permits table
ALTER TABLE permits ADD COLUMN IF NOT EXISTS issued_date date;
