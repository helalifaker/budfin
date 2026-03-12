-- CreateTable
CREATE TABLE "version_capacity_config" (
    "id" SERIAL NOT NULL,
    "version_id" INTEGER NOT NULL,
    "grade_level" VARCHAR(10) NOT NULL,
    "max_class_size" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "version_capacity_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_version_capacity_config" ON "version_capacity_config"("version_id", "grade_level");

-- CreateIndex
CREATE INDEX "idx_version_capacity_config_version" ON "version_capacity_config"("version_id");

-- AddForeignKey
ALTER TABLE "version_capacity_config" ADD CONSTRAINT "version_capacity_config_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "budget_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
