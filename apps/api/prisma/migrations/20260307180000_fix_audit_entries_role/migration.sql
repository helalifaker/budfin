-- Irreversible: reverting would restore the security vulnerability (no rollback needed)
-- Fix audit_entries append-only protection to target actual runtime role (app_user)
-- The original migration targeted budfin_app which doesn't exist in the running stack
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    EXECUTE 'REVOKE UPDATE, DELETE ON audit_entries FROM app_user';
    EXECUTE 'GRANT INSERT, SELECT ON audit_entries TO app_user';
  END IF;
END $$;
