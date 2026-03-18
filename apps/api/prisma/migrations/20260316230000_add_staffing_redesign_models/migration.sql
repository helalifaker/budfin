-- Epic 18/19/20: DHG & Staffing Redesign — Master Data + Version-Scoped Tables
-- This migration creates the staffing redesign models that were defined in
-- schema.prisma but missing from the migration chain.

-- ══════════════════════════════════════════════════════════════════════════════
-- 1. Master Data Tables (global, not version-scoped)
-- ══════════════════════════════════════════════════════════════════════════════

-- CreateTable: service_obligation_profiles
CREATE TABLE "service_obligation_profiles" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "weekly_service_hours" DECIMAL(4,1) NOT NULL,
    "hsa_eligible" BOOLEAN NOT NULL DEFAULT false,
    "default_cost_mode" VARCHAR(20) NOT NULL DEFAULT 'LOCAL_PAYROLL',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "created_by" INTEGER,
    "updated_by" INTEGER,

    CONSTRAINT "service_obligation_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable: disciplines
CREATE TABLE "disciplines" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "category" VARCHAR(20) NOT NULL DEFAULT 'SUBJECT',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "created_by" INTEGER,
    "updated_by" INTEGER,

    CONSTRAINT "disciplines_pkey" PRIMARY KEY ("id")
);

-- CreateTable: discipline_aliases
CREATE TABLE "discipline_aliases" (
    "id" SERIAL NOT NULL,
    "alias" VARCHAR(100) NOT NULL,
    "discipline_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "discipline_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable: dhg_rules
CREATE TABLE "dhg_rules" (
    "id" SERIAL NOT NULL,
    "grade_level" VARCHAR(10) NOT NULL,
    "discipline_id" INTEGER NOT NULL,
    "line_type" VARCHAR(20) NOT NULL DEFAULT 'STRUCTURAL',
    "driver_type" VARCHAR(10) NOT NULL DEFAULT 'HOURS',
    "hours_per_unit" DECIMAL(5,2) NOT NULL,
    "service_profile_id" INTEGER NOT NULL,
    "language_code" VARCHAR(5),
    "grouping_key" VARCHAR(50),
    "effective_from_year" INTEGER NOT NULL,
    "effective_to_year" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "dhg_rules_pkey" PRIMARY KEY ("id")
);

-- ══════════════════════════════════════════════════════════════════════════════
-- 2. Version-Scoped Staffing Tables
-- ══════════════════════════════════════════════════════════════════════════════

-- CreateTable: version_staffing_settings
CREATE TABLE "version_staffing_settings" (
    "id" SERIAL NOT NULL,
    "version_id" INTEGER NOT NULL,
    "hsa_target_hours" DECIMAL(4,2) NOT NULL DEFAULT 1.5,
    "hsa_first_hour_rate" DECIMAL(10,2) NOT NULL DEFAULT 500,
    "hsa_additional_hour_rate" DECIMAL(10,2) NOT NULL DEFAULT 400,
    "hsa_months" INTEGER NOT NULL DEFAULT 10,
    "academic_weeks" INTEGER NOT NULL DEFAULT 36,
    "ajeer_annual_levy" DECIMAL(15,4) NOT NULL DEFAULT 9500,
    "ajeer_monthly_fee" DECIMAL(15,4) NOT NULL DEFAULT 160,
    "reconciliation_baseline" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "version_staffing_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable: version_service_profile_overrides
CREATE TABLE "version_service_profile_overrides" (
    "id" SERIAL NOT NULL,
    "version_id" INTEGER NOT NULL,
    "service_profile_id" INTEGER NOT NULL,
    "weekly_service_hours" DECIMAL(4,1),
    "hsa_eligible" BOOLEAN,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "version_service_profile_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable: version_staffing_cost_assumptions
CREATE TABLE "version_staffing_cost_assumptions" (
    "id" SERIAL NOT NULL,
    "version_id" INTEGER NOT NULL,
    "category" VARCHAR(30) NOT NULL,
    "calculation_mode" VARCHAR(25) NOT NULL,
    "value" DECIMAL(15,4) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "version_staffing_cost_assumptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: version_lycee_group_assumptions
CREATE TABLE "version_lycee_group_assumptions" (
    "id" SERIAL NOT NULL,
    "version_id" INTEGER NOT NULL,
    "grade_level" VARCHAR(10) NOT NULL,
    "discipline_id" INTEGER NOT NULL,
    "group_count" INTEGER NOT NULL,
    "hours_per_group" DECIMAL(5,2) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "version_lycee_group_assumptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: demand_overrides
CREATE TABLE "demand_overrides" (
    "id" SERIAL NOT NULL,
    "version_id" INTEGER NOT NULL,
    "band" VARCHAR(15) NOT NULL,
    "discipline_id" INTEGER NOT NULL,
    "line_type" VARCHAR(20) NOT NULL,
    "override_fte" DECIMAL(7,4) NOT NULL,
    "reason_code" VARCHAR(30) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_by" INTEGER,

    CONSTRAINT "demand_overrides_pkey" PRIMARY KEY ("id")
);

-- ══════════════════════════════════════════════════════════════════════════════
-- 3. Derived Output Tables (calculation results)
-- ══════════════════════════════════════════════════════════════════════════════

-- CreateTable: teaching_requirement_sources
CREATE TABLE "teaching_requirement_sources" (
    "id" SERIAL NOT NULL,
    "version_id" INTEGER NOT NULL,
    "grade_level" VARCHAR(10) NOT NULL,
    "discipline_id" INTEGER NOT NULL,
    "line_type" VARCHAR(20) NOT NULL,
    "driver_type" VARCHAR(10) NOT NULL,
    "headcount" INTEGER NOT NULL DEFAULT 0,
    "max_class_size" INTEGER NOT NULL,
    "driver_units" INTEGER NOT NULL DEFAULT 0,
    "hours_per_unit" DECIMAL(5,2) NOT NULL,
    "total_weekly_hours" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "calculated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "teaching_requirement_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable: teaching_requirement_lines
CREATE TABLE "teaching_requirement_lines" (
    "id" SERIAL NOT NULL,
    "version_id" INTEGER NOT NULL,
    "band" VARCHAR(15) NOT NULL,
    "discipline_code" VARCHAR(50) NOT NULL,
    "line_label" VARCHAR(150) NOT NULL,
    "line_type" VARCHAR(20) NOT NULL,
    "driver_type" VARCHAR(10) NOT NULL,
    "service_profile_code" VARCHAR(20) NOT NULL,
    "total_driver_units" INTEGER NOT NULL DEFAULT 0,
    "total_weekly_hours" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "base_ors" DECIMAL(5,2) NOT NULL,
    "effective_ors" DECIMAL(5,2) NOT NULL,
    "required_fte_raw" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "required_fte_calculated" DECIMAL(7,4),
    "required_fte_planned" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "recommended_positions" INTEGER NOT NULL DEFAULT 0,
    "covered_fte" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "gap_fte" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "coverage_status" VARCHAR(10) NOT NULL DEFAULT 'UNCOVERED',
    "assigned_staff_count" INTEGER NOT NULL DEFAULT 0,
    "vacancy_count" INTEGER NOT NULL DEFAULT 0,
    "direct_cost_annual" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "hsa_cost_annual" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "calculated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "teaching_requirement_lines_pkey" PRIMARY KEY ("id")
);

-- ══════════════════════════════════════════════════════════════════════════════
-- 4. ALTER TABLE: Employee new columns (Epic 18)
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE "employees" ADD COLUMN "record_type" VARCHAR(10) NOT NULL DEFAULT 'EMPLOYEE';
ALTER TABLE "employees" ADD COLUMN "cost_mode" VARCHAR(20) NOT NULL DEFAULT 'LOCAL_PAYROLL';
ALTER TABLE "employees" ADD COLUMN "discipline_id" INTEGER;
ALTER TABLE "employees" ADD COLUMN "service_profile_id" INTEGER;
ALTER TABLE "employees" ADD COLUMN "home_band" VARCHAR(15);
ALTER TABLE "employees" ADD COLUMN "contract_end_date" DATE;

-- ══════════════════════════════════════════════════════════════════════════════
-- 5. ALTER TABLE: CategoryMonthlyCost calculation_mode column
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE "category_monthly_costs" ADD COLUMN "calculation_mode" VARCHAR(25) NOT NULL DEFAULT 'PERCENT_OF_PAYROLL';

-- ══════════════════════════════════════════════════════════════════════════════
-- 6. Unique Indexes
-- ══════════════════════════════════════════════════════════════════════════════

-- Master data
CREATE UNIQUE INDEX "service_obligation_profiles_code_key" ON "service_obligation_profiles"("code");
CREATE UNIQUE INDEX "disciplines_code_key" ON "disciplines"("code");
CREATE UNIQUE INDEX "discipline_aliases_alias_key" ON "discipline_aliases"("alias");
CREATE UNIQUE INDEX "uq_dhg_rule" ON "dhg_rules"("grade_level", "discipline_id", "line_type", "language_code", "effective_from_year");

-- Version-scoped
CREATE UNIQUE INDEX "version_staffing_settings_version_id_key" ON "version_staffing_settings"("version_id");
CREATE UNIQUE INDEX "uq_version_profile_override" ON "version_service_profile_overrides"("version_id", "service_profile_id");
CREATE UNIQUE INDEX "uq_version_cost_assumption" ON "version_staffing_cost_assumptions"("version_id", "category");
CREATE UNIQUE INDEX "uq_lycee_group_assumption" ON "version_lycee_group_assumptions"("version_id", "grade_level", "discipline_id");
CREATE UNIQUE INDEX "uq_demand_override" ON "demand_overrides"("version_id", "band", "discipline_id", "line_type");

-- Derived
CREATE UNIQUE INDEX "uq_teaching_req_source" ON "teaching_requirement_sources"("version_id", "grade_level", "discipline_id", "line_type");
CREATE UNIQUE INDEX "uq_teaching_req_line" ON "teaching_requirement_lines"("version_id", "band", "discipline_code", "line_type");

-- ══════════════════════════════════════════════════════════════════════════════
-- 7. Additional Indexes (query performance)
-- ══════════════════════════════════════════════════════════════════════════════

CREATE INDEX "idx_dhg_rule_grade" ON "dhg_rules"("grade_level");
CREATE INDEX "idx_dhg_rule_year" ON "dhg_rules"("effective_from_year");
CREATE INDEX "idx_teaching_req_source_version" ON "teaching_requirement_sources"("version_id");
CREATE INDEX "idx_teaching_req_line_version" ON "teaching_requirement_lines"("version_id");

-- ══════════════════════════════════════════════════════════════════════════════
-- 8. Foreign Keys
-- ══════════════════════════════════════════════════════════════════════════════

-- service_obligation_profiles
ALTER TABLE "service_obligation_profiles" ADD CONSTRAINT "service_obligation_profiles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "service_obligation_profiles" ADD CONSTRAINT "service_obligation_profiles_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- disciplines
ALTER TABLE "disciplines" ADD CONSTRAINT "disciplines_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "disciplines" ADD CONSTRAINT "disciplines_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- discipline_aliases
ALTER TABLE "discipline_aliases" ADD CONSTRAINT "discipline_aliases_discipline_id_fkey" FOREIGN KEY ("discipline_id") REFERENCES "disciplines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- dhg_rules
ALTER TABLE "dhg_rules" ADD CONSTRAINT "dhg_rules_discipline_id_fkey" FOREIGN KEY ("discipline_id") REFERENCES "disciplines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dhg_rules" ADD CONSTRAINT "dhg_rules_service_profile_id_fkey" FOREIGN KEY ("service_profile_id") REFERENCES "service_obligation_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- version_staffing_settings
ALTER TABLE "version_staffing_settings" ADD CONSTRAINT "version_staffing_settings_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "budget_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- version_service_profile_overrides
ALTER TABLE "version_service_profile_overrides" ADD CONSTRAINT "version_service_profile_overrides_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "budget_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "version_service_profile_overrides" ADD CONSTRAINT "version_service_profile_overrides_service_profile_id_fkey" FOREIGN KEY ("service_profile_id") REFERENCES "service_obligation_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- version_staffing_cost_assumptions
ALTER TABLE "version_staffing_cost_assumptions" ADD CONSTRAINT "version_staffing_cost_assumptions_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "budget_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- version_lycee_group_assumptions
ALTER TABLE "version_lycee_group_assumptions" ADD CONSTRAINT "version_lycee_group_assumptions_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "budget_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "version_lycee_group_assumptions" ADD CONSTRAINT "version_lycee_group_assumptions_discipline_id_fkey" FOREIGN KEY ("discipline_id") REFERENCES "disciplines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- demand_overrides
ALTER TABLE "demand_overrides" ADD CONSTRAINT "demand_overrides_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "budget_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "demand_overrides" ADD CONSTRAINT "demand_overrides_discipline_id_fkey" FOREIGN KEY ("discipline_id") REFERENCES "disciplines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "demand_overrides" ADD CONSTRAINT "demand_overrides_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- teaching_requirement_sources
ALTER TABLE "teaching_requirement_sources" ADD CONSTRAINT "teaching_requirement_sources_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "budget_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "teaching_requirement_sources" ADD CONSTRAINT "teaching_requirement_sources_discipline_id_fkey" FOREIGN KEY ("discipline_id") REFERENCES "disciplines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- teaching_requirement_lines
ALTER TABLE "teaching_requirement_lines" ADD CONSTRAINT "teaching_requirement_lines_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "budget_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- employees (new FKs for Epic 18 columns)
ALTER TABLE "employees" ADD CONSTRAINT "employees_discipline_id_fkey" FOREIGN KEY ("discipline_id") REFERENCES "disciplines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "employees" ADD CONSTRAINT "employees_service_profile_id_fkey" FOREIGN KEY ("service_profile_id") REFERENCES "service_obligation_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
