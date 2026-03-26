-- Add entry mode fields to version_opex_line_items
ALTER TABLE "version_opex_line_items" ADD COLUMN "entry_mode" VARCHAR(30) NOT NULL DEFAULT 'SEASONAL';
ALTER TABLE "version_opex_line_items" ADD COLUMN "active_months" INTEGER[] DEFAULT '{}';
ALTER TABLE "version_opex_line_items" ADD COLUMN "annual_total" DECIMAL(15,4);
ALTER TABLE "version_opex_line_items" ADD COLUMN "flat_amount" DECIMAL(15,4);
ALTER TABLE "version_opex_line_items" ADD COLUMN "flat_override_months" INTEGER[] DEFAULT '{}';

-- Add school calendar to budget_versions
ALTER TABLE "budget_versions" ADD COLUMN "school_calendar_months" INTEGER[] DEFAULT '{1,2,3,4,5,6,9,10,11,12}';

-- Populate entryMode from existing computeMethod
UPDATE "version_opex_line_items"
SET "entry_mode" = CASE
    WHEN "compute_method" = 'PERCENT_OF_REVENUE' THEN 'PERCENT_OF_REVENUE'
    ELSE 'SEASONAL'
END;
