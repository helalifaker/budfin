-- Add P&L Reporting tables (Epic 5)

-- Enhance MonthlyBudgetSummary with additional P&L fields
ALTER TABLE "monthly_budget_summary"
  ADD COLUMN "opex_costs" DECIMAL(15, 4) NOT NULL DEFAULT 0,
  ADD COLUMN "depreciation" DECIMAL(15, 4) NOT NULL DEFAULT 0,
  ADD COLUMN "impairment" DECIMAL(15, 4) NOT NULL DEFAULT 0,
  ADD COLUMN "ebitda" DECIMAL(15, 4) NOT NULL DEFAULT 0,
  ADD COLUMN "operating_profit" DECIMAL(15, 4) NOT NULL DEFAULT 0,
  ADD COLUMN "finance_net" DECIMAL(15, 4) NOT NULL DEFAULT 0,
  ADD COLUMN "profit_before_zakat" DECIMAL(15, 4) NOT NULL DEFAULT 0,
  ADD COLUMN "zakat_amount" DECIMAL(15, 4) NOT NULL DEFAULT 0;

-- MonthlyPnlLine: individual IFRS line items per month per version
CREATE TABLE "monthly_pnl_line" (
  "id" SERIAL NOT NULL,
  "version_id" INTEGER NOT NULL,
  "month" SMALLINT NOT NULL,
  "section_key" VARCHAR(60) NOT NULL,
  "category_key" VARCHAR(60) NOT NULL,
  "line_item_key" VARCHAR(80) NOT NULL,
  "display_label" VARCHAR(120) NOT NULL,
  "depth" SMALLINT NOT NULL DEFAULT 3,
  "display_order" SMALLINT NOT NULL,
  "amount" DECIMAL(15, 4) NOT NULL DEFAULT 0,
  "sign_convention" VARCHAR(10) NOT NULL DEFAULT 'POSITIVE',
  "is_subtotal" BOOLEAN NOT NULL DEFAULT false,
  "is_separator" BOOLEAN NOT NULL DEFAULT false,
  "calculated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "monthly_pnl_line_pkey" PRIMARY KEY ("id")
);

-- ExportJob: async export job tracking
CREATE TABLE "export_jobs" (
  "id" SERIAL NOT NULL,
  "version_id" INTEGER NOT NULL,
  "report_type" VARCHAR(30) NOT NULL,
  "format" VARCHAR(10) NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  "progress" SMALLINT NOT NULL DEFAULT 0,
  "file_path" VARCHAR(500),
  "error_message" TEXT,
  "comparison_version_id" INTEGER,
  "created_by_id" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMPTZ,
  "expires_at" TIMESTAMPTZ,

  CONSTRAINT "export_jobs_pkey" PRIMARY KEY ("id")
);

-- Unique constraint for MonthlyPnlLine
CREATE UNIQUE INDEX "uq_pnl_line" ON "monthly_pnl_line"("version_id", "month", "section_key", "category_key", "line_item_key");

-- Indexes for MonthlyPnlLine
CREATE INDEX "idx_pnl_line_version" ON "monthly_pnl_line"("version_id");
CREATE INDEX "idx_pnl_line_version_month" ON "monthly_pnl_line"("version_id", "month");

-- Indexes for ExportJob
CREATE INDEX "idx_export_job_version" ON "export_jobs"("version_id");
CREATE INDEX "idx_export_job_status" ON "export_jobs"("status");

-- Foreign keys for MonthlyPnlLine
ALTER TABLE "monthly_pnl_line"
  ADD CONSTRAINT "monthly_pnl_line_version_id_fkey"
  FOREIGN KEY ("version_id") REFERENCES "budget_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign keys for ExportJob
ALTER TABLE "export_jobs"
  ADD CONSTRAINT "export_jobs_version_id_fkey"
  FOREIGN KEY ("version_id") REFERENCES "budget_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "export_jobs"
  ADD CONSTRAINT "export_jobs_comparison_version_id_fkey"
  FOREIGN KEY ("comparison_version_id") REFERENCES "budget_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "export_jobs"
  ADD CONSTRAINT "export_jobs_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
