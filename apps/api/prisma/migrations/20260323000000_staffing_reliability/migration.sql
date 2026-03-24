-- Staffing Module Reliability Improvements
-- 1. Simplify Ajeer: remove per-employee fields, consolidate to single global fee
-- 2. Add summer exclusion flag for category costs
-- 3. Widen record_type column for REPLACEMENT value

-- ── Ajeer simplification: Employee ──────────────────────────────────────────
ALTER TABLE "employees" DROP COLUMN IF EXISTS "ajeer_annual_levy";
ALTER TABLE "employees" DROP COLUMN IF EXISTS "ajeer_monthly_fee";

-- ── Ajeer simplification: VersionStaffingSettings ───────────────────────────
ALTER TABLE "version_staffing_settings" DROP COLUMN IF EXISTS "ajeer_annual_levy";
ALTER TABLE "version_staffing_settings" DROP COLUMN IF EXISTS "ajeer_monthly_fee";
ALTER TABLE "version_staffing_settings"
  ADD COLUMN "ajeer_annual_fee" DECIMAL(15,4) NOT NULL DEFAULT 10925;

-- ── Summer exclusion for category costs ─────────────────────────────────────
ALTER TABLE "version_staffing_cost_assumptions"
  ADD COLUMN "exclude_summer_months" BOOLEAN NOT NULL DEFAULT false;

-- ── Widen record_type for REPLACEMENT ───────────────────────────────────────
ALTER TABLE "employees" ALTER COLUMN "record_type" TYPE VARCHAR(15);
