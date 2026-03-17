-- CreateTable
CREATE TABLE "staffing_assignments" (
    "id" SERIAL NOT NULL,
    "version_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "band" VARCHAR(15) NOT NULL,
    "discipline_id" INTEGER NOT NULL,
    "hours_per_week" DECIMAL(5,2) NOT NULL,
    "fte_share" DECIMAL(5,4) NOT NULL,
    "source" VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
    "note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_by" INTEGER,

    CONSTRAINT "staffing_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_staffing_assignment" ON "staffing_assignments"("version_id", "employee_id", "band", "discipline_id");
CREATE INDEX "idx_staffing_assignment_version" ON "staffing_assignments"("version_id");
CREATE INDEX "idx_staffing_assignment_demand" ON "staffing_assignments"("version_id", "band", "discipline_id");

-- AddForeignKey
ALTER TABLE "staffing_assignments" ADD CONSTRAINT "staffing_assignments_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "budget_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staffing_assignments" ADD CONSTRAINT "staffing_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staffing_assignments" ADD CONSTRAINT "staffing_assignments_discipline_id_fkey" FOREIGN KEY ("discipline_id") REFERENCES "disciplines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "staffing_assignments" ADD CONSTRAINT "staffing_assignments_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
