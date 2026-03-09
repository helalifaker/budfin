-- CreateTable
CREATE TABLE "category_monthly_costs" (
    "id" SERIAL NOT NULL,
    "version_id" INTEGER NOT NULL,
    "month" SMALLINT NOT NULL,
    "category" VARCHAR(40) NOT NULL,
    "amount" DECIMAL(15,4) NOT NULL,
    "calculated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "calculated_by" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "category_monthly_costs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_category_monthly_cost" ON "category_monthly_costs"("version_id", "month", "category");

-- CreateIndex
CREATE INDEX "idx_category_monthly_costs_version" ON "category_monthly_costs"("version_id");

-- AddForeignKey
ALTER TABLE "category_monthly_costs" ADD CONSTRAINT "category_monthly_costs_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "budget_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_monthly_costs" ADD CONSTRAINT "category_monthly_costs_calculated_by_fkey" FOREIGN KEY ("calculated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
