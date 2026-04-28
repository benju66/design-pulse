-- 20260429_demote_pending_review.sql

CREATE OR REPLACE FUNCTION enforce_financial_immutability()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- ESCAPE HATCH: Bypass if the transaction-scoped variable is set
  IF current_setting('designpulse.bypass_immutability', true) = 'true' THEN 
    RETURN NEW; 
  END IF;

  IF OLD.status = 'Approved' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      RAISE EXCEPTION 'Financial immutability enforced: Cannot modify status of locked records without explicitly unlocking.';
    END IF;
    IF OLD.is_deleted = false AND NEW.is_deleted = true THEN
      RAISE EXCEPTION 'Financial immutability enforced: Cannot delete a locked opportunity. Unlock it first.';
    END IF;
    IF OLD.cost_impact IS DISTINCT FROM NEW.cost_impact OR OLD.days_impact IS DISTINCT FROM NEW.days_impact OR OLD.title IS DISTINCT FROM NEW.title THEN
      RAISE EXCEPTION 'Financial immutability enforced: Cannot modify core fields of locked records';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION enforce_options_immutability()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_parent_status text;
BEGIN
  -- ESCAPE HATCH: Bypass for child records as well
  IF current_setting('designpulse.bypass_immutability', true) = 'true' THEN 
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    SELECT status INTO v_parent_status FROM opportunities WHERE id = OLD.opportunity_id;
  ELSE
    SELECT status INTO v_parent_status FROM opportunities WHERE id = NEW.opportunity_id;
  END IF;

  IF v_parent_status = 'Approved' THEN
    RAISE EXCEPTION 'Financial immutability enforced: Cannot modify options of a locked opportunity';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;
