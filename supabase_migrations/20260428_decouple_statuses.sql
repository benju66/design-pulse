-- ==========================================
-- MIGRATION: DECOUPLE VE STATUS & COORDINATION
-- ==========================================
-- This script migrates existing opportunities that were using the shared 'status' column
-- for coordination states (e.g., 'Pending Plan Update', 'Implemented') into the new 
-- decoupled architecture, ensuring financial immutability is preserved.

BEGIN;

-- Bypass the financial immutability triggers temporarily for this migration session
SELECT set_config('designpulse.bypass_immutability', 'true', true);

-- 1. Migrate 'Pending Plan Update' records
-- These records have finalized financial locks but require coordination.
UPDATE opportunities 
SET 
  coordination_status = 'Pending Plan Update',
  status = 'Approved'
WHERE status = 'Pending Plan Update';

-- 2. Migrate 'Implemented' records
-- These records have finished the coordination pipeline.
UPDATE opportunities 
SET 
  coordination_status = 'Implemented',
  status = 'Approved'
WHERE status = 'Implemented';

-- 3. Migrate 'GC / Owner Review' records
-- The new unified 'Pending Review' handles this phase.
UPDATE opportunities
SET status = 'Pending Review'
WHERE status = 'GC / Owner Review';

-- Note: The triggers must be updated immediately after this data migration runs
-- to prevent 'Approved' items from being unlocked by the old trigger logic.

COMMIT;
