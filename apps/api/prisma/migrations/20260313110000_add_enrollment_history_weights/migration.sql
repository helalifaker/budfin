ALTER TABLE "budget_versions"
ADD COLUMN IF NOT EXISTS "retention_recent_weight" DECIMAL(5,4) NOT NULL DEFAULT 0.6000,
ADD COLUMN IF NOT EXISTS "historical_target_recent_weight" DECIMAL(5,4) NOT NULL DEFAULT 0.8000;
