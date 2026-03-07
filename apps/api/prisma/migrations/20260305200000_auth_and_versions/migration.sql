-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('Admin', 'BudgetOwner', 'Editor', 'Viewer');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "user_role" NOT NULL DEFAULT 'Viewer',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ,
    "force_password_reset" BOOLEAN NOT NULL DEFAULT false,
    "last_login_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "family_id" UUID NOT NULL,
    "is_revoked" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_config" (
    "key" VARCHAR(100) NOT NULL,
    "value" TEXT NOT NULL,
    "data_type" VARCHAR(20) NOT NULL DEFAULT 'string',
    "description" TEXT,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" INTEGER,

    CONSTRAINT "system_config_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "audit_entries" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "operation" VARCHAR(50) NOT NULL,
    "table_name" VARCHAR(100),
    "record_id" INTEGER,
    "old_values" JSONB,
    "new_values" JSONB,
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_versions" (
    "id" SERIAL NOT NULL,
    "fiscal_year" SMALLINT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "type" VARCHAR(10) NOT NULL,
    "status" VARCHAR(10) NOT NULL DEFAULT 'Draft',
    "description" TEXT,
    "data_source" VARCHAR(12) NOT NULL DEFAULT 'CALCULATED',
    "source_version_id" INTEGER,
    "modification_count" INTEGER NOT NULL DEFAULT 0,
    "stale_modules" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_by_id" INTEGER NOT NULL,
    "published_at" TIMESTAMPTZ,
    "locked_at" TIMESTAMPTZ,
    "archived_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "budget_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal_periods" (
    "id" SERIAL NOT NULL,
    "fiscal_year" SMALLINT NOT NULL,
    "month" SMALLINT NOT NULL,
    "status" VARCHAR(10) NOT NULL DEFAULT 'Draft',
    "actual_version_id" INTEGER,
    "locked_at" TIMESTAMPTZ,
    "locked_by_id" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fiscal_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_budget_summary" (
    "id" SERIAL NOT NULL,
    "version_id" INTEGER NOT NULL,
    "month" SMALLINT NOT NULL,
    "revenue_ht" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "staff_costs" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "net_profit" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "calculated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monthly_budget_summary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "actuals_import_log" (
    "id" SERIAL NOT NULL,
    "version_id" INTEGER NOT NULL,
    "module" VARCHAR(12) NOT NULL,
    "source_file" VARCHAR(255) NOT NULL,
    "validation_status" VARCHAR(10) NOT NULL,
    "rows_imported" INTEGER NOT NULL DEFAULT 0,
    "imported_by_id" INTEGER NOT NULL,
    "imported_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "actuals_import_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_refresh_tokens_family" ON "refresh_tokens"("family_id");

-- CreateIndex
CREATE INDEX "idx_refresh_tokens_user_active" ON "refresh_tokens"("user_id", "is_revoked");

-- CreateIndex
CREATE INDEX "idx_audit_entries_created" ON "audit_entries"("created_at");

-- CreateIndex
CREATE INDEX "idx_audit_entries_user" ON "audit_entries"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_budget_version_name_fy" ON "budget_versions"("fiscal_year", "name");

-- CreateIndex
CREATE INDEX "idx_budget_versions_fiscal_year" ON "budget_versions"("fiscal_year");

-- CreateIndex
CREATE INDEX "idx_budget_versions_status" ON "budget_versions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_fiscal_period" ON "fiscal_periods"("fiscal_year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "uq_monthly_summary" ON "monthly_budget_summary"("version_id", "month");

-- CreateIndex
CREATE INDEX "idx_monthly_summary_version" ON "monthly_budget_summary"("version_id");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_config" ADD CONSTRAINT "system_config_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_entries" ADD CONSTRAINT "audit_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_versions" ADD CONSTRAINT "budget_versions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_versions" ADD CONSTRAINT "budget_versions_source_version_id_fkey" FOREIGN KEY ("source_version_id") REFERENCES "budget_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_periods" ADD CONSTRAINT "fiscal_periods_actual_version_id_fkey" FOREIGN KEY ("actual_version_id") REFERENCES "budget_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_periods" ADD CONSTRAINT "fiscal_periods_locked_by_id_fkey" FOREIGN KEY ("locked_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_budget_summary" ADD CONSTRAINT "monthly_budget_summary_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "budget_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actuals_import_log" ADD CONSTRAINT "actuals_import_log_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "budget_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actuals_import_log" ADD CONSTRAINT "actuals_import_log_imported_by_id_fkey" FOREIGN KEY ("imported_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
