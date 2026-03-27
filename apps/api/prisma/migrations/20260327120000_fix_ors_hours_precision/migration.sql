-- Fix ors_hours precision: Decimal(5,4) max is 9.9999, but default is 18.0000
-- Change to Decimal(6,4) to allow values up to 99.9999
ALTER TABLE "scenario_parameters" ALTER COLUMN "ors_hours" TYPE DECIMAL(6,4);
