# BudFin Project Instructions

## Project Structure

```
docs/
  prd/               # Product Requirements Document
  edge-cases/         # Edge case analysis, summaries, and references
  planning/           # Planning methodology and delivery docs
data/
  budgets/            # EFIR budget spreadsheets (FY2026)
  enrollment/         # Enrollment CSV data (2021-2026)
plans/                # Implementation plans
specs/                # Feature specifications
tasks/                # Task tracking
```

## File Output Rules

- All plans, specs, tasks, and generated artifacts MUST be created in the project folder (`/Users/fakerhelali/Desktop/budfin/`), never in the global `~/.claude/` directory.
- Plans go in `./plans/` within the project root.
- Specs go in `./specs/` within the project root.
- Tasks go in `./tasks/` within the project root.
- Documentation goes in `./docs/` under the appropriate subdirectory.
- Data files (budgets, enrollment) go in `./data/` under the appropriate subdirectory.
- Any other generated files belong in the project root or an appropriate subdirectory within it.
