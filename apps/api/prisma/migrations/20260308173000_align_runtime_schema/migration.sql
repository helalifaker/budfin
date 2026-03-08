-- Irreversible: aligns runtime schema with current Prisma datamodel.
-- This migration is intentionally idempotent for environments that may
-- already have received a manual hotfix before deploy.

ALTER TABLE "audit_entries"
ADD COLUMN IF NOT EXISTS "user_email" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "session_id" VARCHAR(100),
ADD COLUMN IF NOT EXISTS "audit_note" TEXT;

ALTER TABLE "budget_versions"
ADD COLUMN IF NOT EXISTS "updated_by_id" INTEGER;

ALTER TABLE "fiscal_periods"
ADD COLUMN IF NOT EXISTS "updated_by_id" INTEGER;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'budget_versions_updated_by_id_fkey'
    ) THEN
        ALTER TABLE "budget_versions"
        ADD CONSTRAINT "budget_versions_updated_by_id_fkey"
        FOREIGN KEY ("updated_by_id") REFERENCES "users"("id")
        ON DELETE SET NULL
        ON UPDATE CASCADE;
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fiscal_periods_updated_by_id_fkey'
    ) THEN
        ALTER TABLE "fiscal_periods"
        ADD CONSTRAINT "fiscal_periods_updated_by_id_fkey"
        FOREIGN KEY ("updated_by_id") REFERENCES "users"("id")
        ON DELETE SET NULL
        ON UPDATE CASCADE;
    END IF;
END
$$;
