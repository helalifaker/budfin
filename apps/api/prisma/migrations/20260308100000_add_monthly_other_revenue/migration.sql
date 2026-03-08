CREATE TABLE "monthly_other_revenue" (
    "id" SERIAL NOT NULL,
    "version_id" INTEGER NOT NULL,
    "scenario_name" VARCHAR(20) NOT NULL DEFAULT 'Base',
    "line_item_name" TEXT NOT NULL,
    "ifrs_category" VARCHAR(50) NOT NULL,
    "executive_category" VARCHAR(40),
    "month" SMALLINT NOT NULL,
    "amount" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "calculated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "calculated_by" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "monthly_other_revenue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_monthly_other_revenue"
ON "monthly_other_revenue"("version_id", "scenario_name", "line_item_name", "month");

CREATE INDEX "idx_monthly_other_revenue_version_month"
ON "monthly_other_revenue"("version_id", "month");

CREATE INDEX "idx_monthly_other_revenue_version_category"
ON "monthly_other_revenue"("version_id", "executive_category");

CREATE INDEX "idx_monthly_other_revenue_calculated_by"
ON "monthly_other_revenue"("calculated_by");

ALTER TABLE "monthly_other_revenue"
ADD CONSTRAINT "monthly_other_revenue_version_id_fkey"
FOREIGN KEY ("version_id") REFERENCES "budget_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "monthly_other_revenue"
ADD CONSTRAINT "monthly_other_revenue_calculated_by_fkey"
FOREIGN KEY ("calculated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
