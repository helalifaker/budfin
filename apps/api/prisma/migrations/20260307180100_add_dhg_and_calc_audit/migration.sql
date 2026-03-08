-- Irreversible: DROP TABLE calculation_audit_log; DROP TABLE dhg_requirements;
-- No down migration — these tables are new with no production data to preserve.

-- DHG Requirements table (calculation outputs)
CREATE TABLE dhg_requirements (
  id SERIAL PRIMARY KEY,
  version_id INTEGER NOT NULL REFERENCES budget_versions(id) ON DELETE CASCADE,
  academic_period VARCHAR(3) NOT NULL,
  grade_level VARCHAR(10) NOT NULL,
  headcount INTEGER NOT NULL DEFAULT 0,
  max_class_size INTEGER NOT NULL,
  sections_needed INTEGER NOT NULL DEFAULT 0,
  utilization DECIMAL(5,1) NOT NULL DEFAULT 0,
  alert VARCHAR(10),
  recruitment_slots INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dhg_requirements_version ON dhg_requirements(version_id);
CREATE UNIQUE INDEX uq_dhg_requirement ON dhg_requirements(version_id, academic_period, grade_level);

-- Calculation Audit Log
CREATE TABLE calculation_audit_log (
  id SERIAL PRIMARY KEY,
  version_id INTEGER NOT NULL REFERENCES budget_versions(id) ON DELETE CASCADE,
  run_id UUID NOT NULL,
  module VARCHAR(20) NOT NULL DEFAULT 'ENROLLMENT',
  status VARCHAR(20) NOT NULL DEFAULT 'STARTED',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  input_summary JSONB,
  output_summary JSONB,
  triggered_by INTEGER REFERENCES users(id)
);

CREATE INDEX idx_calc_audit_version ON calculation_audit_log(version_id);
