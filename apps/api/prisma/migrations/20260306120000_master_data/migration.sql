-- CreateEnum
CREATE TYPE "account_type" AS ENUM ('REVENUE', 'EXPENSE', 'ASSET', 'LIABILITY');

-- CreateEnum
CREATE TYPE "center_type" AS ENUM ('PROFIT_CENTER', 'COST_CENTER');

-- CreateEnum
CREATE TYPE "account_status" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "grade_band" AS ENUM ('MATERNELLE', 'ELEMENTAIRE', 'COLLEGE', 'LYCEE');

-- CreateEnum
CREATE TYPE "department_band" AS ENUM ('MATERNELLE', 'ELEMENTAIRE', 'COLLEGE', 'LYCEE', 'NON_ACADEMIC');

-- CreateEnum
CREATE TYPE "assumption_value_type" AS ENUM ('PERCENTAGE', 'CURRENCY', 'INTEGER', 'DECIMAL', 'TEXT');

-- CreateTable
CREATE TABLE "chart_of_accounts" (
    "id" SERIAL NOT NULL,
    "account_code" VARCHAR(10) NOT NULL,
    "account_name" VARCHAR(100) NOT NULL,
    "type" "account_type" NOT NULL,
    "ifrs_category" VARCHAR(100) NOT NULL,
    "center_type" "center_type" NOT NULL,
    "description" VARCHAR(500),
    "status" "account_status" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "created_by" INTEGER NOT NULL,
    "updated_by" INTEGER NOT NULL,

    CONSTRAINT "chart_of_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academic_years" (
    "id" SERIAL NOT NULL,
    "fiscal_year" VARCHAR(6) NOT NULL,
    "ay1_start" DATE NOT NULL,
    "ay1_end" DATE NOT NULL,
    "ay2_start" DATE NOT NULL,
    "ay2_end" DATE NOT NULL,
    "summer_start" DATE NOT NULL,
    "summer_end" DATE NOT NULL,
    "academic_weeks" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "created_by" INTEGER NOT NULL,
    "updated_by" INTEGER NOT NULL,

    CONSTRAINT "academic_years_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grade_levels" (
    "id" SERIAL NOT NULL,
    "grade_code" VARCHAR(10) NOT NULL,
    "grade_name" VARCHAR(60) NOT NULL,
    "band" "grade_band" NOT NULL,
    "max_class_size" INTEGER NOT NULL,
    "plancher_pct" DECIMAL(5,4) NOT NULL,
    "cible_pct" DECIMAL(5,4) NOT NULL,
    "plafond_pct" DECIMAL(5,4) NOT NULL,
    "display_order" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "grade_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nationalities" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(5) NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "vat_exempt" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "created_by" INTEGER NOT NULL,
    "updated_by" INTEGER NOT NULL,

    CONSTRAINT "nationalities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tariffs" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "created_by" INTEGER NOT NULL,
    "updated_by" INTEGER NOT NULL,

    CONSTRAINT "tariffs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "band_mapping" "department_band" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "created_by" INTEGER NOT NULL,
    "updated_by" INTEGER NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assumptions" (
    "id" SERIAL NOT NULL,
    "key" VARCHAR(50) NOT NULL,
    "value" VARCHAR(500) NOT NULL,
    "unit" VARCHAR(20) NOT NULL,
    "section" VARCHAR(50) NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "value_type" "assumption_value_type" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "updated_by" INTEGER,

    CONSTRAINT "assumptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "chart_of_accounts_account_code_key" ON "chart_of_accounts"("account_code");

-- CreateIndex
CREATE UNIQUE INDEX "academic_years_fiscal_year_key" ON "academic_years"("fiscal_year");

-- CreateIndex
CREATE UNIQUE INDEX "grade_levels_grade_code_key" ON "grade_levels"("grade_code");

-- CreateIndex
CREATE UNIQUE INDEX "nationalities_code_key" ON "nationalities"("code");

-- CreateIndex
CREATE UNIQUE INDEX "tariffs_code_key" ON "tariffs"("code");

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

-- CreateIndex
CREATE UNIQUE INDEX "assumptions_key_key" ON "assumptions"("key");

-- AddForeignKey
ALTER TABLE "chart_of_accounts" ADD CONSTRAINT "chart_of_accounts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chart_of_accounts" ADD CONSTRAINT "chart_of_accounts_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic_years" ADD CONSTRAINT "academic_years_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic_years" ADD CONSTRAINT "academic_years_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nationalities" ADD CONSTRAINT "nationalities_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nationalities" ADD CONSTRAINT "nationalities_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tariffs" ADD CONSTRAINT "tariffs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tariffs" ADD CONSTRAINT "tariffs_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assumptions" ADD CONSTRAINT "assumptions_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CHECK Constraints
ALTER TABLE "chart_of_accounts" ADD CONSTRAINT "chk_account_code"
    CHECK (account_code ~ '^[A-Z0-9]{3,10}$');

ALTER TABLE "nationalities" ADD CONSTRAINT "chk_nationality_code"
    CHECK (code ~ '^[A-Z]{2,5}$');

ALTER TABLE "tariffs" ADD CONSTRAINT "chk_tariff_code"
    CHECK (code ~ '^[A-Z0-9+]{2,10}$');

ALTER TABLE "departments" ADD CONSTRAINT "chk_department_code"
    CHECK (code ~ '^[A-Z_]{2,20}$');

ALTER TABLE "academic_years" ADD CONSTRAINT "chk_date_ordering"
    CHECK (ay1_start < ay1_end
        AND ay1_end <= summer_start
        AND summer_start < summer_end
        AND summer_end <= ay2_start
        AND ay2_start < ay2_end);

ALTER TABLE "academic_years" ADD CONSTRAINT "chk_academic_weeks"
    CHECK (academic_weeks BETWEEN 1 AND 52);

ALTER TABLE "grade_levels" ADD CONSTRAINT "chk_pct_ordering"
    CHECK (plancher_pct <= cible_pct AND cible_pct <= plafond_pct);

ALTER TABLE "grade_levels" ADD CONSTRAINT "chk_max_class_size"
    CHECK (max_class_size BETWEEN 1 AND 50);
