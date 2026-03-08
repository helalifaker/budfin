-- Irreversible: DROP TABLE nationality_breakdown; DROP TABLE cohort_parameters;
-- No down migration — these tables are new with no production data to preserve.

-- Cohort Parameters table (retention + lateral entry weights per grade)
CREATE TABLE cohort_parameters (
  id SERIAL PRIMARY KEY,
  version_id INTEGER NOT NULL REFERENCES budget_versions(id) ON DELETE CASCADE,
  grade_level VARCHAR(10) NOT NULL,
  retention_rate DECIMAL(5,4) NOT NULL DEFAULT 0.97,
  lateral_entry_count INTEGER NOT NULL DEFAULT 0,
  lateral_weight_fr DECIMAL(5,4) NOT NULL DEFAULT 0,
  lateral_weight_nat DECIMAL(5,4) NOT NULL DEFAULT 0,
  lateral_weight_aut DECIMAL(5,4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cohort_parameters_version ON cohort_parameters(version_id);
CREATE UNIQUE INDEX uq_cohort_parameter ON cohort_parameters(version_id, grade_level);

-- Nationality Breakdown table (weight/headcount per version, period, grade, nationality)
CREATE TABLE nationality_breakdown (
  id SERIAL PRIMARY KEY,
  version_id INTEGER NOT NULL REFERENCES budget_versions(id) ON DELETE CASCADE,
  academic_period VARCHAR(3) NOT NULL,
  grade_level VARCHAR(10) NOT NULL,
  nationality VARCHAR(10) NOT NULL,
  weight DECIMAL(5,4) NOT NULL DEFAULT 0,
  headcount INTEGER NOT NULL DEFAULT 0,
  is_overridden BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_nationality_breakdown_version_period ON nationality_breakdown(version_id, academic_period);
CREATE UNIQUE INDEX uq_nationality_breakdown ON nationality_breakdown(version_id, academic_period, grade_level, nationality);
