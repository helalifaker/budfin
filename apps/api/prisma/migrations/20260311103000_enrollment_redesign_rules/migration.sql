ALTER TABLE "grade_levels"
ADD COLUMN "default_ay2_intake" INTEGER;

ALTER TABLE "budget_versions"
ADD COLUMN "rollover_threshold" DECIMAL(5,4) NOT NULL DEFAULT 1.0000,
ADD COLUMN "capped_retention" DECIMAL(5,4) NOT NULL DEFAULT 0.9800;

UPDATE "grade_levels"
SET "default_ay2_intake" = 66
WHERE "grade_code" = 'PS' AND "default_ay2_intake" IS NULL;

ALTER TABLE "budget_versions" ADD COLUMN "last_calculated_at" TIMESTAMP(3);
