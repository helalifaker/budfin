-- CreateTable
CREATE TABLE "employees" (
    "id" SERIAL NOT NULL,
    "version_id" INTEGER NOT NULL,
    "employee_code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "function_role" VARCHAR(100) NOT NULL,
    "department" VARCHAR(50) NOT NULL,
    "status" VARCHAR(10) NOT NULL DEFAULT 'Existing',
    "joining_date" DATE NOT NULL,
    "payment_method" VARCHAR(50) NOT NULL,
    "is_saudi" BOOLEAN NOT NULL DEFAULT false,
    "is_ajeer" BOOLEAN NOT NULL DEFAULT false,
    "is_teaching" BOOLEAN NOT NULL DEFAULT false,
    "hourly_percentage" DECIMAL(5,4) NOT NULL DEFAULT 1.0000,
    "base_salary" BYTEA NOT NULL,
    "housing_allowance" BYTEA NOT NULL,
    "transport_allowance" BYTEA NOT NULL,
    "responsibility_premium" BYTEA NOT NULL DEFAULT pgp_sym_encrypt('0.0000', current_setting('app.encryption_key')),
    "hsa_amount" BYTEA NOT NULL DEFAULT pgp_sym_encrypt('0.0000', current_setting('app.encryption_key')),
    "augmentation" BYTEA NOT NULL DEFAULT pgp_sym_encrypt('0.0000', current_setting('app.encryption_key')),
    "augmentation_effective_date" DATE,
    "ajeer_annual_levy" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "ajeer_monthly_fee" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "created_by" INTEGER NOT NULL,
    "updated_by" INTEGER,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dhg_grille_config" (
    "id" SERIAL NOT NULL,
    "grade_level" VARCHAR(10) NOT NULL,
    "subject" VARCHAR(100) NOT NULL,
    "dhg_type" VARCHAR(20) NOT NULL DEFAULT 'Structural',
    "hours_per_week_per_section" DECIMAL(5,2) NOT NULL,
    "effective_from_year" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "dhg_grille_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_staff_costs" (
    "id" SERIAL NOT NULL,
    "version_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "month" SMALLINT NOT NULL,
    "base_gross" DECIMAL(15,4) NOT NULL,
    "adjusted_gross" DECIMAL(15,4) NOT NULL,
    "housing_allowance" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "transport_allowance" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "responsibility_premium" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "hsa_amount" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "gosi_amount" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "ajeer_amount" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "eos_monthly_accrual" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "total_cost" DECIMAL(15,4) NOT NULL,
    "calculated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "calculated_by" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "monthly_staff_costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eos_provisions" (
    "id" SERIAL NOT NULL,
    "version_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "years_of_service" DECIMAL(7,4) NOT NULL,
    "eos_base" DECIMAL(15,4) NOT NULL,
    "eos_annual" DECIMAL(15,4) NOT NULL,
    "eos_monthly_accrual" DECIMAL(15,4) NOT NULL,
    "as_of_date" DATE NOT NULL,
    "calculated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "eos_provisions_pkey" PRIMARY KEY ("id")
);

-- AlterTable: Add FTE fields to dhg_requirements
ALTER TABLE "dhg_requirements" ADD COLUMN "total_weekly_hours" DECIMAL(10,4) NOT NULL DEFAULT 0;
ALTER TABLE "dhg_requirements" ADD COLUMN "total_annual_hours" DECIMAL(10,4) NOT NULL DEFAULT 0;
ALTER TABLE "dhg_requirements" ADD COLUMN "fte" DECIMAL(7,4) NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "uq_employee_code_version" ON "employees"("version_id", "employee_code");
CREATE INDEX "idx_employees_version" ON "employees"("version_id");
CREATE INDEX "idx_employees_department" ON "employees"("version_id", "department");
CREATE INDEX "idx_employees_status" ON "employees"("version_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_dhg_grille" ON "dhg_grille_config"("grade_level", "subject", "effective_from_year");
CREATE INDEX "idx_dhg_grille_grade" ON "dhg_grille_config"("grade_level");

-- CreateIndex
CREATE UNIQUE INDEX "uq_monthly_staff_cost" ON "monthly_staff_costs"("version_id", "employee_id", "month");
CREATE INDEX "idx_monthly_staff_costs_version" ON "monthly_staff_costs"("version_id");
CREATE INDEX "idx_monthly_staff_costs_employee" ON "monthly_staff_costs"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "eos_provisions_employee_id_key" ON "eos_provisions"("employee_id");
CREATE UNIQUE INDEX "uq_eos_provision" ON "eos_provisions"("version_id", "employee_id");
CREATE INDEX "idx_eos_provisions_version" ON "eos_provisions"("version_id");

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "budget_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employees" ADD CONSTRAINT "employees_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employees" ADD CONSTRAINT "employees_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_staff_costs" ADD CONSTRAINT "monthly_staff_costs_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "budget_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "monthly_staff_costs" ADD CONSTRAINT "monthly_staff_costs_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "monthly_staff_costs" ADD CONSTRAINT "monthly_staff_costs_calculated_by_fkey" FOREIGN KEY ("calculated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eos_provisions" ADD CONSTRAINT "eos_provisions_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "budget_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "eos_provisions" ADD CONSTRAINT "eos_provisions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
