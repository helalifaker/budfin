ALTER TABLE "cohort_parameters"
ADD COLUMN "applied_retention_rate" DECIMAL(5, 4),
ADD COLUMN "retained_from_prior" INTEGER,
ADD COLUMN "historical_target_headcount" INTEGER,
ADD COLUMN "derived_laterals" INTEGER,
ADD COLUMN "uses_configured_retention" BOOLEAN;

CREATE TABLE "version_revenue_settings" (
    "id" SERIAL NOT NULL,
    "version_id" INTEGER NOT NULL,
    "dpi_per_student_ht" DECIMAL(15, 4) NOT NULL,
    "dossier_per_student_ht" DECIMAL(15, 4) NOT NULL,
    "exam_bac_per_student" DECIMAL(15, 4) NOT NULL,
    "exam_dnb_per_student" DECIMAL(15, 4) NOT NULL,
    "exam_eaf_per_student" DECIMAL(15, 4) NOT NULL,
    "eval_primaire_per_student" DECIMAL(15, 4) NOT NULL,
    "eval_secondaire_per_student" DECIMAL(15, 4) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER NOT NULL,
    "updated_by" INTEGER,

    CONSTRAINT "version_revenue_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "version_revenue_settings_version_id_key"
ON "version_revenue_settings"("version_id");

CREATE INDEX "idx_version_revenue_settings_created_by"
ON "version_revenue_settings"("created_by");

ALTER TABLE "version_revenue_settings"
ADD CONSTRAINT "version_revenue_settings_version_id_fkey"
FOREIGN KEY ("version_id") REFERENCES "budget_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "version_revenue_settings"
ADD CONSTRAINT "version_revenue_settings_created_by_fkey"
FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "version_revenue_settings"
ADD CONSTRAINT "version_revenue_settings_updated_by_fkey"
FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "version_revenue_settings" (
    "version_id",
    "dpi_per_student_ht",
    "dossier_per_student_ht",
    "exam_bac_per_student",
    "exam_dnb_per_student",
    "exam_eaf_per_student",
    "eval_primaire_per_student",
    "eval_secondaire_per_student",
    "created_by",
    "updated_by"
)
SELECT
    v."id",
    COALESCE((SELECT "value"::DECIMAL(15, 4) FROM "assumptions" WHERE "key" = 'dpiPerStudentHt' LIMIT 1), 2000.0000),
    COALESCE((SELECT "value"::DECIMAL(15, 4) FROM "assumptions" WHERE "key" = 'dossierPerStudentHt' LIMIT 1), 1000.0000),
    COALESCE((SELECT "value"::DECIMAL(15, 4) FROM "assumptions" WHERE "key" = 'examBacPerStudent' LIMIT 1), 2000.0000),
    COALESCE((SELECT "value"::DECIMAL(15, 4) FROM "assumptions" WHERE "key" = 'examDnbPerStudent' LIMIT 1), 600.0000),
    COALESCE((SELECT "value"::DECIMAL(15, 4) FROM "assumptions" WHERE "key" = 'examEafPerStudent' LIMIT 1), 800.0000),
    COALESCE((SELECT "value"::DECIMAL(15, 4) FROM "assumptions" WHERE "key" = 'evalPrimairePerStudent' LIMIT 1), 200.0000),
    COALESCE((SELECT "value"::DECIMAL(15, 4) FROM "assumptions" WHERE "key" = 'evalSecondairePerStudent' LIMIT 1), 300.0000),
    v."created_by_id",
    v."updated_by_id"
FROM "budget_versions" v
WHERE NOT EXISTS (
    SELECT 1
    FROM "version_revenue_settings" s
    WHERE s."version_id" = v."id"
);

WITH "canonical_dynamic_rows" AS (
    SELECT *
    FROM (
        VALUES
            ('DAI - Francais', 'SPECIFIC_PERIOD', ARRAY[5, 6]::INTEGER[], 'Registration Fees', 'DAI'),
            ('DAI - Nationaux', 'SPECIFIC_PERIOD', ARRAY[5, 6]::INTEGER[], 'Registration Fees', 'DAI'),
            ('DAI - Autres', 'SPECIFIC_PERIOD', ARRAY[5, 6]::INTEGER[], 'Registration Fees', 'DAI'),
            ('DPI - Francais', 'SPECIFIC_PERIOD', ARRAY[5, 6]::INTEGER[], 'Registration Fees', 'DPI'),
            ('DPI - Nationaux', 'SPECIFIC_PERIOD', ARRAY[5, 6]::INTEGER[], 'Registration Fees', 'DPI'),
            ('DPI - Autres', 'SPECIFIC_PERIOD', ARRAY[5, 6]::INTEGER[], 'Registration Fees', 'DPI'),
            ('Frais de Dossier - Francais', 'SPECIFIC_PERIOD', ARRAY[5, 6]::INTEGER[], 'Registration Fees', 'FRAIS_DOSSIER'),
            ('Frais de Dossier - Nationaux', 'SPECIFIC_PERIOD', ARRAY[5, 6]::INTEGER[], 'Registration Fees', 'FRAIS_DOSSIER'),
            ('Frais de Dossier - Autres', 'SPECIFIC_PERIOD', ARRAY[5, 6]::INTEGER[], 'Registration Fees', 'FRAIS_DOSSIER'),
            ('BAC', 'SPECIFIC_PERIOD', ARRAY[4, 5]::INTEGER[], 'Examination Fees', 'EXAM_BAC'),
            ('DNB', 'SPECIFIC_PERIOD', ARRAY[4, 5]::INTEGER[], 'Examination Fees', 'EXAM_DNB'),
            ('EAF', 'SPECIFIC_PERIOD', ARRAY[4, 5]::INTEGER[], 'Examination Fees', 'EXAM_EAF'),
            ('Evaluation - Primaire', 'SPECIFIC_PERIOD', ARRAY[10, 11]::INTEGER[], 'Registration Fees', 'EVAL_PRIMAIRE'),
            ('Evaluation - College+Lycee', 'SPECIFIC_PERIOD', ARRAY[10, 11]::INTEGER[], 'Registration Fees', 'EVAL_SECONDAIRE')
    ) AS "rows"("line_item_name", "distribution_method", "specific_months", "ifrs_category", "compute_method")
)
UPDATE "other_revenue_items" o
SET
    "distribution_method" = c."distribution_method",
    "weight_array" = NULL,
    "specific_months" = c."specific_months",
    "ifrs_category" = c."ifrs_category",
    "compute_method" = c."compute_method"
FROM "canonical_dynamic_rows" c
WHERE o."line_item_name" = c."line_item_name";

WITH "canonical_dynamic_rows" AS (
    SELECT *
    FROM (
        VALUES
            ('DAI - Francais', 'SPECIFIC_PERIOD', ARRAY[5, 6]::INTEGER[], 'Registration Fees', 'DAI'),
            ('DAI - Nationaux', 'SPECIFIC_PERIOD', ARRAY[5, 6]::INTEGER[], 'Registration Fees', 'DAI'),
            ('DAI - Autres', 'SPECIFIC_PERIOD', ARRAY[5, 6]::INTEGER[], 'Registration Fees', 'DAI'),
            ('DPI - Francais', 'SPECIFIC_PERIOD', ARRAY[5, 6]::INTEGER[], 'Registration Fees', 'DPI'),
            ('DPI - Nationaux', 'SPECIFIC_PERIOD', ARRAY[5, 6]::INTEGER[], 'Registration Fees', 'DPI'),
            ('DPI - Autres', 'SPECIFIC_PERIOD', ARRAY[5, 6]::INTEGER[], 'Registration Fees', 'DPI'),
            ('Frais de Dossier - Francais', 'SPECIFIC_PERIOD', ARRAY[5, 6]::INTEGER[], 'Registration Fees', 'FRAIS_DOSSIER'),
            ('Frais de Dossier - Nationaux', 'SPECIFIC_PERIOD', ARRAY[5, 6]::INTEGER[], 'Registration Fees', 'FRAIS_DOSSIER'),
            ('Frais de Dossier - Autres', 'SPECIFIC_PERIOD', ARRAY[5, 6]::INTEGER[], 'Registration Fees', 'FRAIS_DOSSIER'),
            ('BAC', 'SPECIFIC_PERIOD', ARRAY[4, 5]::INTEGER[], 'Examination Fees', 'EXAM_BAC'),
            ('DNB', 'SPECIFIC_PERIOD', ARRAY[4, 5]::INTEGER[], 'Examination Fees', 'EXAM_DNB'),
            ('EAF', 'SPECIFIC_PERIOD', ARRAY[4, 5]::INTEGER[], 'Examination Fees', 'EXAM_EAF'),
            ('Evaluation - Primaire', 'SPECIFIC_PERIOD', ARRAY[10, 11]::INTEGER[], 'Registration Fees', 'EVAL_PRIMAIRE'),
            ('Evaluation - College+Lycee', 'SPECIFIC_PERIOD', ARRAY[10, 11]::INTEGER[], 'Registration Fees', 'EVAL_SECONDAIRE')
    ) AS "rows"("line_item_name", "distribution_method", "specific_months", "ifrs_category", "compute_method")
)
INSERT INTO "other_revenue_items" (
    "version_id",
    "line_item_name",
    "annual_amount",
    "distribution_method",
    "specific_months",
    "ifrs_category",
    "compute_method",
    "created_at",
    "updated_at",
    "created_by",
    "updated_by"
)
SELECT
    v."id",
    c."line_item_name",
    0.0000,
    c."distribution_method",
    c."specific_months",
    c."ifrs_category",
    c."compute_method",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    v."created_by_id",
    v."updated_by_id"
FROM "budget_versions" v
CROSS JOIN "canonical_dynamic_rows" c
WHERE NOT EXISTS (
    SELECT 1
    FROM "other_revenue_items" o
    WHERE o."version_id" = v."id"
      AND o."line_item_name" = c."line_item_name"
);

-- DOWN (not fully reversible — data seeding cannot be automatically undone; requires backup restore):
-- DROP INDEX IF EXISTS "idx_version_revenue_settings_created_by";
-- DROP INDEX IF EXISTS "version_revenue_settings_version_id_key";
-- ALTER TABLE "version_revenue_settings" DROP CONSTRAINT IF EXISTS "version_revenue_settings_version_id_fkey";
-- ALTER TABLE "version_revenue_settings" DROP CONSTRAINT IF EXISTS "version_revenue_settings_created_by_fkey";
-- ALTER TABLE "version_revenue_settings" DROP CONSTRAINT IF EXISTS "version_revenue_settings_updated_by_fkey";
-- DROP TABLE IF EXISTS "version_revenue_settings";
-- ALTER TABLE "cohort_parameters"
--   DROP COLUMN IF EXISTS "applied_retention_rate",
--   DROP COLUMN IF EXISTS "retained_from_prior",
--   DROP COLUMN IF EXISTS "historical_target_headcount",
--   DROP COLUMN IF EXISTS "derived_laterals",
--   DROP COLUMN IF EXISTS "uses_configured_retention";
-- NOTE: compute_method backfill on other_revenue_items cannot be reversed without a backup restore.
