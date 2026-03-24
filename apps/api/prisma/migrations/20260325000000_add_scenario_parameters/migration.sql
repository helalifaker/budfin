CREATE TABLE "scenario_parameters" (
  "id" SERIAL NOT NULL,
  "version_id" INTEGER NOT NULL,
  "scenario_name" VARCHAR(20) NOT NULL,
  "new_enrollment_factor" DECIMAL(7, 6) NOT NULL DEFAULT 1.000000,
  "retention_adjustment" DECIMAL(7, 6) NOT NULL DEFAULT 1.000000,
  "fee_collection_rate" DECIMAL(7, 6) NOT NULL DEFAULT 1.000000,
  "scholarship_allocation" DECIMAL(7, 6) NOT NULL DEFAULT 0.000000,
  "attrition_rate" DECIMAL(7, 6) NOT NULL DEFAULT 0.000000,
  "ors_hours" DECIMAL(5, 4) NOT NULL DEFAULT 18.0000,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "scenario_parameters_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "uq_scenario_params" ON "scenario_parameters"("version_id", "scenario_name");
CREATE INDEX "idx_scenario_params_version" ON "scenario_parameters"("version_id");
ALTER TABLE "scenario_parameters"
  ADD CONSTRAINT "scenario_parameters_version_id_fkey"
  FOREIGN KEY ("version_id") REFERENCES "budget_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
