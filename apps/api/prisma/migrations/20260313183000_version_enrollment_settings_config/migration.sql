ALTER TABLE "version_capacity_config"
ADD COLUMN IF NOT EXISTS "plancher_pct" DECIMAL(5,4),
ADD COLUMN IF NOT EXISTS "cible_pct" DECIMAL(5,4),
ADD COLUMN IF NOT EXISTS "plafond_pct" DECIMAL(5,4);

UPDATE "version_capacity_config" AS vcc
SET
	"plancher_pct" = gl."plancher_pct",
	"cible_pct" = gl."cible_pct",
	"plafond_pct" = gl."plafond_pct"
FROM "grade_levels" AS gl
WHERE gl."grade_code" = vcc."grade_level"
	AND (
		vcc."plancher_pct" IS NULL
		OR vcc."cible_pct" IS NULL
		OR vcc."plafond_pct" IS NULL
	);

INSERT INTO "version_capacity_config" (
	"version_id",
	"grade_level",
	"max_class_size",
	"plancher_pct",
	"cible_pct",
	"plafond_pct",
	"created_at",
	"updated_at"
)
SELECT
	bv."id",
	gl."grade_code",
	gl."max_class_size",
	gl."plancher_pct",
	gl."cible_pct",
	gl."plafond_pct",
	NOW(),
	NOW()
FROM "budget_versions" AS bv
CROSS JOIN "grade_levels" AS gl
LEFT JOIN "version_capacity_config" AS vcc
	ON vcc."version_id" = bv."id"
	AND vcc."grade_level" = gl."grade_code"
WHERE vcc."id" IS NULL;

ALTER TABLE "version_capacity_config"
ALTER COLUMN "plancher_pct" SET NOT NULL,
ALTER COLUMN "cible_pct" SET NOT NULL,
ALTER COLUMN "plafond_pct" SET NOT NULL;
