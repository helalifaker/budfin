-- Enforce append-only audit trail (TDD 05_security.md section 7.7)
-- app_user can INSERT and SELECT but never UPDATE or DELETE audit records.
-- Wrapped in DO block for idempotency (safe to re-run on existing databases).
DO $$ BEGIN
	-- Revoke destructive operations first
	EXECUTE 'REVOKE UPDATE ON audit_entries FROM app_user';
	EXECUTE 'REVOKE DELETE ON audit_entries FROM app_user';
	-- Grant read and append only
	EXECUTE 'GRANT INSERT, SELECT ON audit_entries TO app_user';
EXCEPTION
	WHEN undefined_table THEN
		RAISE NOTICE 'audit_entries table does not exist yet -- skipping grants';
	WHEN undefined_object THEN
		RAISE NOTICE 'app_user role does not exist yet -- skipping grants';
END $$;
