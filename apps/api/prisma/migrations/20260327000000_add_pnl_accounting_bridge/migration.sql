-- CreateEnum
CREATE TYPE "profit_center" AS ENUM ('MATERNELLE', 'ELEMENTAIRE', 'COLLEGE', 'LYCEE');

-- CreateEnum
CREATE TYPE "analytical_key_type" AS ENUM ('CATEGORY', 'LINE_ITEM');

-- CreateEnum
CREATE TYPE "mapping_visibility" AS ENUM ('SHOW', 'GROUP', 'EXCLUDE');

-- CreateEnum
CREATE TYPE "allocation_method" AS ENUM ('DIRECT', 'HEADCOUNT', 'MANUAL');

-- CreateEnum
CREATE TYPE "actual_source" AS ENUM ('SEED', 'MANUAL');

-- AlterTable: add new columns to chart_of_accounts
ALTER TABLE "chart_of_accounts"
  ADD COLUMN "parent_code" VARCHAR(10),
  ADD COLUMN "profit_center" "profit_center",
  ADD COLUMN "is_system" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: pnl_templates
CREATE TABLE "pnl_templates" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "created_by" INTEGER NOT NULL,
    "updated_by" INTEGER NOT NULL,

    CONSTRAINT "pnl_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable: pnl_template_sections
CREATE TABLE "pnl_template_sections" (
    "id" SERIAL NOT NULL,
    "template_id" INTEGER NOT NULL,
    "section_key" VARCHAR(40) NOT NULL,
    "display_label" VARCHAR(100) NOT NULL,
    "display_order" SMALLINT NOT NULL,
    "is_subtotal" BOOLEAN NOT NULL DEFAULT false,
    "subtotal_formula" VARCHAR(200),
    "sign_convention" VARCHAR(10) NOT NULL DEFAULT 'POSITIVE',

    CONSTRAINT "pnl_template_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable: pnl_account_mappings
CREATE TABLE "pnl_account_mappings" (
    "id" SERIAL NOT NULL,
    "section_id" INTEGER NOT NULL,
    "analytical_key" VARCHAR(80) NOT NULL,
    "analytical_key_type" "analytical_key_type" NOT NULL,
    "account_code" VARCHAR(10),
    "month_filter" SMALLINT[],
    "display_label" VARCHAR(120),
    "visibility" "mapping_visibility" NOT NULL DEFAULT 'SHOW',
    "display_order" SMALLINT NOT NULL,
    "profit_center_allocation" "allocation_method" NOT NULL DEFAULT 'HEADCOUNT',
    "manual_allocation" JSONB,

    CONSTRAINT "pnl_account_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable: historical_actuals
CREATE TABLE "historical_actuals" (
    "id" SERIAL NOT NULL,
    "fiscal_year" SMALLINT NOT NULL,
    "account_code" VARCHAR(10) NOT NULL,
    "annual_amount" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "q1_amount" DECIMAL(15,4),
    "q2_amount" DECIMAL(15,4),
    "q3_amount" DECIMAL(15,4),
    "source" "actual_source" NOT NULL DEFAULT 'MANUAL',
    "imported_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historical_actuals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_pnl_template_name" ON "pnl_templates"("name");

-- CreateIndex
CREATE UNIQUE INDEX "uq_template_section" ON "pnl_template_sections"("template_id", "section_key");

-- CreateIndex
CREATE UNIQUE INDEX "uq_mapping_key" ON "pnl_account_mappings"("section_id", "analytical_key", "account_code");

-- CreateIndex
CREATE UNIQUE INDEX "uq_historical_actual" ON "historical_actuals"("fiscal_year", "account_code");

-- AddForeignKey: pnl_templates -> users (creator)
ALTER TABLE "pnl_templates"
  ADD CONSTRAINT "pnl_templates_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: pnl_templates -> users (updater)
ALTER TABLE "pnl_templates"
  ADD CONSTRAINT "pnl_templates_updated_by_fkey"
  FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: pnl_template_sections -> pnl_templates
ALTER TABLE "pnl_template_sections"
  ADD CONSTRAINT "pnl_template_sections_template_id_fkey"
  FOREIGN KEY ("template_id") REFERENCES "pnl_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: pnl_account_mappings -> pnl_template_sections
ALTER TABLE "pnl_account_mappings"
  ADD CONSTRAINT "pnl_account_mappings_section_id_fkey"
  FOREIGN KEY ("section_id") REFERENCES "pnl_template_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: pnl_account_mappings -> chart_of_accounts
ALTER TABLE "pnl_account_mappings"
  ADD CONSTRAINT "pnl_account_mappings_account_code_fkey"
  FOREIGN KEY ("account_code") REFERENCES "chart_of_accounts"("account_code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: historical_actuals -> chart_of_accounts
ALTER TABLE "historical_actuals"
  ADD CONSTRAINT "historical_actuals_account_code_fkey"
  FOREIGN KEY ("account_code") REFERENCES "chart_of_accounts"("account_code") ON DELETE RESTRICT ON UPDATE CASCADE;
