-- CreateTable
CREATE TABLE "version_opex_line_items" (
    "id" SERIAL NOT NULL,
    "version_id" INTEGER NOT NULL,
    "section_type" VARCHAR(20) NOT NULL,
    "ifrs_category" VARCHAR(50) NOT NULL,
    "line_item_name" VARCHAR(200) NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "compute_method" VARCHAR(30) NOT NULL DEFAULT 'MANUAL',
    "compute_rate" DECIMAL(7,6),
    "budget_v6_total" DECIMAL(15,4),
    "fy2025_actual" DECIMAL(15,4),
    "fy2024_actual" DECIMAL(15,4),
    "comment" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "created_by" INTEGER NOT NULL,
    "updated_by" INTEGER,

    CONSTRAINT "version_opex_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_opex" (
    "id" SERIAL NOT NULL,
    "version_id" INTEGER NOT NULL,
    "line_item_id" INTEGER NOT NULL,
    "month" SMALLINT NOT NULL,
    "amount" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "calculated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "calculated_by" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "monthly_opex_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_opex_line_item" ON "version_opex_line_items"("version_id", "section_type", "line_item_name");

-- CreateIndex
CREATE INDEX "idx_opex_line_items_version" ON "version_opex_line_items"("version_id");

-- CreateIndex
CREATE INDEX "idx_opex_line_items_section" ON "version_opex_line_items"("version_id", "section_type");

-- CreateIndex
CREATE UNIQUE INDEX "uq_monthly_opex" ON "monthly_opex"("version_id", "line_item_id", "month");

-- CreateIndex
CREATE INDEX "idx_monthly_opex_version" ON "monthly_opex"("version_id");

-- CreateIndex
CREATE INDEX "idx_monthly_opex_version_month" ON "monthly_opex"("version_id", "month");

-- AddForeignKey
ALTER TABLE "version_opex_line_items" ADD CONSTRAINT "version_opex_line_items_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "budget_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "version_opex_line_items" ADD CONSTRAINT "version_opex_line_items_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "version_opex_line_items" ADD CONSTRAINT "version_opex_line_items_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_opex" ADD CONSTRAINT "monthly_opex_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "budget_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_opex" ADD CONSTRAINT "monthly_opex_line_item_id_fkey" FOREIGN KEY ("line_item_id") REFERENCES "version_opex_line_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_opex" ADD CONSTRAINT "monthly_opex_calculated_by_fkey" FOREIGN KEY ("calculated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
