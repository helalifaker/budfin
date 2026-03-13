DO $$
DECLARE
	non_null_count integer;
BEGIN
	SELECT COUNT(*)
	INTO non_null_count
	FROM "discount_policies"
	WHERE "nationality" IS NOT NULL;

	IF non_null_count > 0 THEN
		RAISE EXCEPTION
			'Cannot drop nationality: % rows have non-null values. Consolidate before retrying.',
			non_null_count;
	END IF;
END $$;

ALTER TABLE "discount_policies" DROP CONSTRAINT "uq_discount_policy";
DROP INDEX IF EXISTS "idx_discount_policies_calc";

ALTER TABLE "discount_policies" DROP COLUMN "nationality";

ALTER TABLE "discount_policies"
	ADD CONSTRAINT "uq_discount_policy" UNIQUE ("version_id", "tariff");

CREATE INDEX "idx_discount_policies_calc" ON "discount_policies" ("version_id", "tariff");
