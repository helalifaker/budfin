-- AlterTable
ALTER TABLE "other_revenue_items" ADD COLUMN "compute_method" VARCHAR(30);

-- DOWN: ALTER TABLE "other_revenue_items" DROP COLUMN "compute_method";
