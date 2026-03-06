-- CreateTable
CREATE TABLE "enrollment_headcount" (
    "id" SERIAL NOT NULL,
    "version_id" INTEGER NOT NULL,
    "academic_period" VARCHAR(3) NOT NULL,
    "grade_level" VARCHAR(10) NOT NULL,
    "headcount" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "created_by" INTEGER NOT NULL,
    "updated_by" INTEGER,

    CONSTRAINT "enrollment_headcount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollment_detail" (
    "id" SERIAL NOT NULL,
    "version_id" INTEGER NOT NULL,
    "academic_period" VARCHAR(3) NOT NULL,
    "grade_level" VARCHAR(10) NOT NULL,
    "nationality" VARCHAR(10) NOT NULL,
    "tariff" VARCHAR(10) NOT NULL,
    "headcount" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "created_by" INTEGER NOT NULL,
    "updated_by" INTEGER,

    CONSTRAINT "enrollment_detail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_enrollment_headcount" ON "enrollment_headcount"("version_id", "academic_period", "grade_level");

-- CreateIndex
CREATE INDEX "idx_enrollment_headcount_version_period" ON "enrollment_headcount"("version_id", "academic_period");

-- CreateIndex
CREATE UNIQUE INDEX "uq_enrollment_detail" ON "enrollment_detail"("version_id", "academic_period", "grade_level", "nationality", "tariff");

-- CreateIndex
CREATE INDEX "idx_enrollment_detail_version_period_grade" ON "enrollment_detail"("version_id", "academic_period", "grade_level");

-- AddForeignKey
ALTER TABLE "enrollment_headcount" ADD CONSTRAINT "enrollment_headcount_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "budget_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment_headcount" ADD CONSTRAINT "enrollment_headcount_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment_headcount" ADD CONSTRAINT "enrollment_headcount_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment_detail" ADD CONSTRAINT "enrollment_detail_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "budget_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment_detail" ADD CONSTRAINT "enrollment_detail_version_id_academic_period_grade_level_fkey" FOREIGN KEY ("version_id", "academic_period", "grade_level") REFERENCES "enrollment_headcount"("version_id", "academic_period", "grade_level") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment_detail" ADD CONSTRAINT "enrollment_detail_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment_detail" ADD CONSTRAINT "enrollment_detail_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
