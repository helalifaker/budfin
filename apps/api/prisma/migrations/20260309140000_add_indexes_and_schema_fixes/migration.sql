-- Fix 1: Add unique constraint to token_hash on refresh_tokens
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- Fix 2: Make version_id optional on calculation_audit_log and change cascade to SET NULL
ALTER TABLE "calculation_audit_log" DROP CONSTRAINT "calculation_audit_log_version_id_fkey";
ALTER TABLE "calculation_audit_log" ALTER COLUMN "version_id" DROP NOT NULL;
ALTER TABLE "calculation_audit_log" ADD CONSTRAINT "calculation_audit_log_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "budget_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Fix 3: Add missing indexes

-- BudgetVersion indexes
CREATE INDEX "idx_budget_versions_source" ON "budget_versions"("source_version_id");
CREATE INDEX "idx_budget_versions_created_by" ON "budget_versions"("created_by_id");
CREATE INDEX "idx_budget_versions_updated_by" ON "budget_versions"("updated_by_id");

-- FiscalPeriod indexes
CREATE INDEX "idx_fiscal_periods_fiscal_year" ON "fiscal_periods"("fiscal_year");
CREATE INDEX "idx_fiscal_periods_actual_version" ON "fiscal_periods"("actual_version_id");
CREATE INDEX "idx_fiscal_periods_locked_by" ON "fiscal_periods"("locked_by_id");
CREATE INDEX "idx_fiscal_periods_updated_by" ON "fiscal_periods"("updated_by_id");

-- AuditEntry indexes
CREATE INDEX "idx_audit_entries_table_record" ON "audit_entries"("table_name", "record_id");
CREATE INDEX "idx_audit_entries_operation" ON "audit_entries"("operation");

-- MonthlyStaffCost index
CREATE INDEX "idx_monthly_staff_costs_version_month" ON "monthly_staff_costs"("version_id", "month");

-- CalculationAuditLog indexes
CREATE INDEX "idx_calc_audit_run_id" ON "calculation_audit_log"("run_id");
CREATE INDEX "idx_calc_audit_module_status" ON "calculation_audit_log"("module", "status");
CREATE INDEX "idx_calc_audit_triggered_by" ON "calculation_audit_log"("triggered_by");

-- RefreshToken index
CREATE INDEX "idx_refresh_tokens_expires" ON "refresh_tokens"("expires_at");
