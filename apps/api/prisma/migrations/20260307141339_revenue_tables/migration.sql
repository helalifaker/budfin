-- DropForeignKey
ALTER TABLE "calculation_audit_log" DROP CONSTRAINT "calculation_audit_log_triggered_by_fkey";

-- DropForeignKey
ALTER TABLE "calculation_audit_log" DROP CONSTRAINT "calculation_audit_log_version_id_fkey";

-- DropForeignKey
ALTER TABLE "dhg_requirements" DROP CONSTRAINT "dhg_requirements_version_id_fkey";

-- AlterTable
ALTER TABLE "budget_versions" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fiscal_periods" ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateTable
CREATE TABLE "fee_grids" (
    "id" SERIAL NOT NULL,
    "version_id" INTEGER NOT NULL,
    "academic_period" VARCHAR(3) NOT NULL,
    "grade_level" VARCHAR(10) NOT NULL,
    "nationality" VARCHAR(10) NOT NULL,
    "tariff" VARCHAR(10) NOT NULL,
    "dai" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "tuition_ttc" DECIMAL(15,4) NOT NULL,
    "tuition_ht" DECIMAL(15,4) NOT NULL,
    "term1_amount" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "term2_amount" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "term3_amount" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "created_by" INTEGER NOT NULL,
    "updated_by" INTEGER,

    CONSTRAINT "fee_grids_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discount_policies" (
    "id" SERIAL NOT NULL,
    "version_id" INTEGER NOT NULL,
    "tariff" VARCHAR(10) NOT NULL,
    "nationality" VARCHAR(10),
    "discount_rate" DECIMAL(7,6) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "created_by" INTEGER NOT NULL,
    "updated_by" INTEGER,

    CONSTRAINT "discount_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "other_revenue_items" (
    "id" SERIAL NOT NULL,
    "version_id" INTEGER NOT NULL,
    "line_item_name" TEXT NOT NULL,
    "annual_amount" DECIMAL(15,4) NOT NULL,
    "distribution_method" VARCHAR(20) NOT NULL,
    "weight_array" JSONB,
    "specific_months" INTEGER[],
    "ifrs_category" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "created_by" INTEGER NOT NULL,
    "updated_by" INTEGER,

    CONSTRAINT "other_revenue_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_revenue" (
    "id" SERIAL NOT NULL,
    "version_id" INTEGER NOT NULL,
    "scenario_name" VARCHAR(20) NOT NULL DEFAULT 'Base',
    "academic_period" VARCHAR(3) NOT NULL,
    "grade_level" VARCHAR(10) NOT NULL,
    "nationality" VARCHAR(10) NOT NULL,
    "tariff" VARCHAR(10) NOT NULL,
    "month" SMALLINT NOT NULL,
    "gross_revenue_ht" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "scholarship_deduction" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "net_revenue_ht" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "vat_amount" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "calculated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "calculated_by" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "monthly_revenue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_fee_grids_revenue_calc" ON "fee_grids"("version_id", "academic_period", "grade_level", "nationality", "tariff");

-- CreateIndex
CREATE INDEX "idx_fee_grids_created_by" ON "fee_grids"("created_by");

-- CreateIndex
CREATE UNIQUE INDEX "uq_fee_grid" ON "fee_grids"("version_id", "academic_period", "grade_level", "nationality", "tariff");

-- CreateIndex
CREATE INDEX "idx_discount_policies_calc" ON "discount_policies"("version_id", "tariff", "nationality");

-- CreateIndex
CREATE INDEX "idx_discount_policies_created_by" ON "discount_policies"("created_by");

-- CreateIndex
CREATE UNIQUE INDEX "uq_discount_policy" ON "discount_policies"("version_id", "tariff", "nationality");

-- CreateIndex
CREATE INDEX "idx_other_revenue_items_version" ON "other_revenue_items"("version_id");

-- CreateIndex
CREATE INDEX "idx_other_revenue_items_created_by" ON "other_revenue_items"("created_by");

-- CreateIndex
CREATE UNIQUE INDEX "uq_other_revenue_item" ON "other_revenue_items"("version_id", "line_item_name");

-- CreateIndex
CREATE INDEX "idx_monthly_revenue_version_month" ON "monthly_revenue"("version_id", "month");

-- CreateIndex
CREATE INDEX "idx_monthly_revenue_version_period" ON "monthly_revenue"("version_id", "academic_period");

-- CreateIndex
CREATE INDEX "idx_monthly_revenue_calculated_by" ON "monthly_revenue"("calculated_by");

-- CreateIndex
CREATE UNIQUE INDEX "uq_monthly_revenue" ON "monthly_revenue"("version_id", "scenario_name", "academic_period", "grade_level", "nationality", "tariff", "month");

-- AddForeignKey
ALTER TABLE "dhg_requirements" ADD CONSTRAINT "dhg_requirements_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "budget_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calculation_audit_log" ADD CONSTRAINT "calculation_audit_log_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "budget_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calculation_audit_log" ADD CONSTRAINT "calculation_audit_log_triggered_by_fkey" FOREIGN KEY ("triggered_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_grids" ADD CONSTRAINT "fee_grids_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "budget_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_grids" ADD CONSTRAINT "fee_grids_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_grids" ADD CONSTRAINT "fee_grids_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_policies" ADD CONSTRAINT "discount_policies_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "budget_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_policies" ADD CONSTRAINT "discount_policies_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_policies" ADD CONSTRAINT "discount_policies_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "other_revenue_items" ADD CONSTRAINT "other_revenue_items_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "budget_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "other_revenue_items" ADD CONSTRAINT "other_revenue_items_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "other_revenue_items" ADD CONSTRAINT "other_revenue_items_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_revenue" ADD CONSTRAINT "monthly_revenue_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "budget_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_revenue" ADD CONSTRAINT "monthly_revenue_calculated_by_fkey" FOREIGN KEY ("calculated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "dhg_requirements_version_id_academic_period_grade_level_key" RENAME TO "uq_dhg_requirement";
