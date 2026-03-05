# Section 11: Implementation Roadmap

Follows PRD Section 14 exactly. 30 working weeks + 5-week buffer total = 35 weeks.
6 phases.

## 11.1 Team Structure

| Role | FTE | Phases Active |
| ---------------------- | ---- | ------------------ |
| Tech Lead | 1.0 | All phases |
| Full-Stack Developer 1 | 1.0 | Phases 1-5 |
| Full-Stack Developer 2 | 1.0 | Phases 1-5 |
| QA Engineer | 1.0 | Phases 2-6 |
| DBA | 0.5 | Phase 1 + Phase 6 |
| UX Designer | 0.5 | Phase 1 + Phase 5 |
| Project Manager | 1.0 | All phases |
| Finance SME (EFIR) | 0.25 | Advisory, all phases |

## 11.2 Phase 1: Foundation (Weeks 1-4.5)

**Objective:** Validate tech stack; establish data layer; implement authentication
and master data.

### Week 1 -- Tech Stack Proof of Concept

Deliverables:

- Decimal.js precision validation: write 50+ unit tests covering revenue and EoS calculations; confirm +/- 0 SAR vs. manual calculation
- YEARFRAC TypeScript implementation: validate against 10 known employee joining dates vs. Excel formula output; zero tolerance for discrepancy
- PostgreSQL DECIMAL(15,4) schema: create sample tables, insert test values, verify no precision loss on read
- Docker Compose skeleton: all 3 services start cleanly; health checks pass
- Repository setup: Git, GitHub Actions CI skeleton (lint + type-check passes on empty project)

Owner: Tech Lead + Dev 1

Risk: R-004 (IEEE 754) and R-006 (YEARFRAC) resolved or escalated here

### Week 2 -- Database Schema + Auth

Deliverables:

- Full DDL execution: all 23 tables created via Prisma migrations (reviewed by DBA)
- `fiscal_periods` (Table 3b) and `actuals_import_log` (Table 3c) tables created with indexes and triggers
- pgcrypto extension enabled; salary field encryption/decryption tested end-to-end
- Auth endpoints working: POST /auth/login, POST /auth/refresh, POST /auth/logout
- RBAC middleware implemented; unit tests for all role x permission combinations passing
- Winston logger configured; request ID middleware active

Owner: Tech Lead + Dev 1 + DBA

### Week 3 -- Master Data CRUD + User Management

Deliverables:

- system_config table seeded with defaults (VAT rate, GOSI rate, Ajeer levies, academic_week_count)
- Grade levels and class capacity config seeded (15 grades, Maternelle=24, Elementaire=26, etc.)
- User management: GET/POST/PATCH /api/v1/users (Admin only)
- system_config endpoints: GET/PUT /api/v1/system-config
- PDPL field encryption: encrypt/decrypt round-trip test for all 5 salary fields
- dhg_grille_config seeded with French National Curriculum data for all 4 bands

Owner: Dev 1 + Dev 2

### Week 4 -- Context Bar + Frontend Shell

Deliverables:

- React SPA scaffold: Vite + TypeScript + React Router v6 + @tanstack/react-table v8 + shadcn/ui Table
- Login page with JWT flow (access token in memory, refresh cookie)
- Navigation shell: 4 groups (Dashboard, Planning, Master Data, Admin)
- Context bar component: fiscalYear, versionId, comparisonVersionId, scenario selectors
- GET/PATCH /api/v1/context endpoints; URL param sync
- UX wireframe approval for all module layouts (UX Designer)

Owner: Dev 2 + UX Designer

### Buffer (Week 4.5) -- M1 Gate

- DBA schema review: column types, indexes, constraints
- Tech Lead code review: auth security, RBAC completeness
- M1 Gate criteria: Docker Compose starts cleanly; auth login/refresh/logout working; YEARFRAC unit tests passing; all Decimal.js precision tests passing; DBA signs off on schema

## 11.3 Phase 2: Enrollment and Revenue (Weeks 5-11)

**Objective:** Implement complete enrollment input and revenue calculation engine.
First Excel regression validation.

### Week 5 -- Enrollment Historical + Stage 1

- CSV import endpoint (validate + commit modes); 5 enrollment CSVs imported as Actual budget_versions (type='Actual', data_source='IMPORTED') using `migrate_enrollment_actuals.py`. `enrollment_historical` table left empty and deprecated. Trend analysis tested using `enrollment_headcount JOIN budget_versions WHERE type='Actual'`.
- GET /enrollment/historical with CAGR and moving average calculation
- Enrollment trend chart (Recharts line chart)
- Two-stage enrollment entry UI (Stage 1 headcount grid using TanStack Table v8)

Owner: Dev 1 (backend) + Dev 2 (frontend)

### Week 6 -- Enrollment Stage 2 + Capacity

- Stage 2 detail entry (nationality x tariff breakdown per grade)
- Stage 2 sum validation against Stage 1
- Capacity calculation: sections = CEILING(enrollment / max_class_size)
- Traffic-light utilization alerts (OVER/NEAR_CAP/OK/UNDER)
- FR-CAP-001 through FR-CAP-007 complete

### Week 7 -- Fee Grid + Discounts

- Fee grid management UI (TanStack Table v8; 45+ combinations)
- PUT /fee-grid with server-side HT validation (tuition_ht = tuition_ttc / 1.15)
- VAT exemption for Nationaux (VAT = 0%)
- Discount policies UI and API
- Version-controlled fee grids (each version has independent snapshot)

### Week 8 -- Revenue Engine + Other Revenue

- Revenue Engine implementation (all formulas: FR-REV-011, FR-REV-012)
- Other revenue items with all distribution methods (ACADEMIC_10, YEAR_ROUND_12, CUSTOM_WEIGHTS, SPECIFIC_PERIOD)
- Scholarship allocation and fee collection rate (FR-REV-020, FR-REV-021)
- POST /calculate/revenue endpoint
- Stale flag mechanism: `version_stale_flags` (could be system_config or a simple table)

### Week 9 -- Revenue UI + Stale Indicators

- Revenue results grid (TanStack Table v8; monthly breakdown by grade/nationality/tariff)
- Stale indicator on Calculate button
- IFRS 15 classification display (FR-REV-013)
- Revenue summary: total AY1, total AY2, annual total

### Week 10 -- Excel Regression Suite Setup + Fix

- Python regression scripts comparing BudFin API revenue output vs. Excel Revenue workbook
- Run against real EFIR data (imported from Revenue workbook)
- Target: all 12 months within +/- 1 SAR
- Fix any discrepancies found

### Week 11 -- Buffer + M2 Gate

- Integration test completion
- QA: functional testing of enrollment and revenue modules
- M2 Gate criteria: POST /calculate/revenue produces revenue within +/- 1 SAR of Excel baseline for all 12 months; all FR-ENR-001 through FR-REV-021 unit and integration tests passing; Excel regression suite passing

## 11.4 Phase 3: Staffing and Staff Costs (Weeks 12-18)

**Objective:** Implement DHG staffing model and complete staff cost engine including
GOSI/Ajeer/EoS.

### Week 12 -- DHG Engine

- dhg_grille_config fully seeded (4 bands, 15 grades, all subjects with hours)
- FTE calculation: sections x hours -> FTE (FR-DHG-009 through FR-DHG-015)
- ORS configurability per scenario (FR-DHG-013)
- DHG results display by grade and subject

### Week 13 -- Employee Import + Salary UI

- Employee xlsx import (validate + commit) for 168 records from Staff Costs workbook
- Employee list/detail UI with TanStack Table v8
- Salary components form (5 fields + augmentation); encrypted at write, decrypted at read
- Part-time factor (hourly_percentage)

### Week 14 -- Staff Cost Engine (Core)

- Monthly gross calculation with augmentation step-change (Sep)
- HSA summer exclusion (Jul-Aug = 0)
- GOSI calculation (Saudi nationals only, 11.75%)
- Ajeer calculation (existing vs. new staff; Nitaqat vs. non-Nitaqat rate from system_config)

### Week 15 -- EoS + Monthly Budget Grid

- YEARFRAC EoS provision: validated against all 168 employees (+/- 0.001 years vs. Excel)
- EoS <= 5yr and > 5yr branches
- 12-month budget grid UI (TanStack Table v8; employees as rows, months as columns)
- Sep step-change visually highlighted in grid
- POST /calculate/staffing endpoint

### Week 16 -- Additional Staff Costs

- Residents (FR-STC-017, FR-STC-018): fixed annual amounts with distribution
- Replacements (FR-STC-015): configurable annual amount
- Training levy (FR-STC-016): 1% of payroll mass
- Grand Total Staff Costs aggregation (FR-STC-019)
- Department-level cost repartition (FR-STC-020, FR-STC-021)

### Week 17 -- Excel Regression + YoY Comparison

- Staff cost regression: 168 employees x 12 months vs. Excel +/- 1 SAR
- Year-over-year comparison view (FR-STC-024)
- Fix any EoS or GOSI discrepancies

### Week 18 -- Buffer + M3 Gate

- QA functional testing of staffing module
- M3 Gate criteria: POST /calculate/staffing produces staff costs within +/- 1 SAR of Excel baseline for all 168 employees x 12 months; YEARFRAC matches Excel for all 168 joining dates; all FR-DHG and FR-STC tests passing

## 11.5 Phase 4: Versions and P&L (Weeks 19-25)

**Objective:** Version lifecycle management, P&L consolidation, IFRS mapping,
scenario modeling.

### Week 19 -- Version Management

- Version CRUD (FR-VER-001 through FR-VER-006)
- Lifecycle transitions with audit trail
- Clone operation: deep-copy all version-scoped data (Budget/Forecast only; 409 guard for Actual versions)
- Version selector in context bar
- **Actual Version Import Flow** (Flow 5): POST `/import/:module` endpoint; pre-flight guards for type/data_source; actuals_import_log creation; calculation engine 409 guards for IMPORTED versions; clone 409 guard for Actual versions; fiscal period locking endpoint (`PATCH /fiscal-periods/:year/:month/lock`); Latest Estimate endpoint (`GET /versions/:id/latest-estimate`).

### Week 20 -- Version Comparison Engine

- Side-by-side comparison view (FR-VER-004)
- Variance columns: absolute and percentage
- Color coding: green favorable, red unfavorable
- GET /versions/compare endpoint

### Week 21 -- P&L Consolidation

- P&L Engine implementation: consolidate revenue + staff costs + other items
- Monthly P&L grid (IFRS Function of Expense method, IAS 1)
- All 18 FR-PNL requirements implemented
- Zakat calculation (2.5% on positive monthly profit)

### Week 22 -- IFRS Detailed Reporting

- IFRS line items generation (tuition by level and tariff, FR-PNL-017)
- Revenue from contracts subtotal (IFRS 15)
- Rental income separation (IAS 1)
- Finance income and costs section
- All values in SAR HT (FR-PNL-018)

### Week 23 -- Scenario Modeling

- Three pre-defined scenarios (Base/Optimistic/Pessimistic)
- 5 configurable adjustment factors per scenario
- Scenario parameters stored in scenario_parameters table
- POST /calculate/pnl with scenario parameter propagation

### Week 24 -- Scenario Comparison + E2E Tests

- Side-by-side scenario comparison (FR-SCN-004, FR-SCN-006)
- Delta vs. Base table (FR-SCN-007)
- Playwright E2E tests for budget preparation and version comparison workflows

### Week 25 -- Buffer + M4 Gate

- QA functional testing of versions and P&L
- Full chain regression: enrollment -> revenue -> staffing -> P&L end-to-end within +/- 1 SAR
- M4 Gate criteria: full calculation chain validated; all FR-VER, FR-PNL, FR-SCN tests passing; version comparison producing correct variances

## 11.6 Phase 5: Dashboard, Audit UI, and Export (Weeks 26-29.5)

**Objective:** Executive dashboard, audit trail browsing UI, data export, input
management, polish.

### Week 26 -- Dashboard

- KPI widgets: Total Revenue, Total Students, School Utilization, Discount Rate (FR-DSH-001)
- P&L summary (FR-DSH-002)
- Enrollment trend charts using Recharts (FR-DSH-003)
- Capacity utilization alerts summary (FR-DSH-004)
- Version comparison indicator (FR-DSH-005)

### Week 26 (continued) -- Audit Trail Browsing UI

- Audit log viewer page: paginated table of `audit_entries` (TanStack Table v8)
- Filters: user, date range, module, entity type
- On-screen before/after diff view for individual audit entries
- Leverages Prisma `$extends` audit middleware deployed in Phase 1 (Week 2)
- All FR-AUD requirements for on-screen browsing implemented

Owner: Dev 2

### Week 27 -- Export (xlsx + CSV)

- ExcelJS xlsx generation for all report types (Revenue Detail, Staff Costs, P&L Monthly, Full Budget)
- fast-csv CSV export
- Async job queue using export_jobs table + worker process
- Job status polling (GET /export/jobs/:id)
- Download with expiry (GET /export/jobs/:id/download)

### Week 28 -- Export (PDF) + Input Management

- `@react-pdf/renderer` PDF generation for P&L reports (A3 landscape, ADR-014)
- Input management module (FR-INP-001 through FR-INP-003)
- Input control panel: count of editable fields per module
- Visual highlighting of editable cells in TanStack Table v8 (yellow background)
- Input guidance notes per parameter

### Week 29 -- Performance + Accessibility

- k6 performance test execution; fix any p95 > 3s endpoints
- Accessibility audit: keyboard navigation for TanStack Table v8; WCAG AA contrast ratios; semantic HTML
- Final UI polish per UX Designer review

### Week 29.5 -- Buffer + M5 Gate

- M5 Gate criteria: Dashboard displaying all KPI widgets; xlsx/PDF/CSV export working for all report types; k6 performance tests passing; all Playwright E2E tests passing

## 11.7 Phase 6: Data Migration and Go-Live (Weeks 30-36)

**Objective:** Migrate real EFIR data, validate, parallel run, UAT, go-live.

### Week 30 -- Source Data Audit

- Finance SME + DBA review all 4 Excel workbooks and 5 CSVs
- Document data quality issues: missing fields, inconsistent naming, broken references
- Produce Source Data Quality Report

### Week 31 -- Migration Scripts

- Python migration scripts for all 4 workbooks (openpyxl + pandas + decimal.Decimal)
- Test run on staging environment with anonymized data
- Fix data quality issues identified in Week 30

### Week 32 -- Staging Migration + Validation

- Full migration execution on staging
- 6-step automated validation protocol runs; review results
- Fix any validation failures; re-run migration

### Weeks 33-34 -- Parallel Run

- Finance team runs both Excel and BudFin simultaneously for 2 weeks
- Any discrepancy > +/- 1 SAR logged as P1 bug; same-day fix required
- Daily comparison reports generated by Python regression scripts

### Week 35 -- UAT + Training

- Finance team formal UAT: all 30 acceptance criteria from PRD Section 16.3
- User training sessions (Budget Analyst, HR/Payroll Coordinator, School Administrator)
- User manual/quick reference guide prepared by PM + Dev

### Week 36 -- Production Migration + Go-Live

- pg_dump of production DB (empty baseline)
- Migration scripts run on production
- Validation protocol run on production
- CAO signs M6 Gate approval
- DNS cutover; finance team notified; Excel files archived (not deleted)

**M6 Gate criteria (all required for go-live):**

- All 30 UAT acceptance criteria passed by finance team
- Parallel run: +/- 1 SAR per line item per month for 2 consecutive weeks
- 100% enrollment headcount match between BudFin and Excel
- OWASP ZAP scan: zero MEDIUM or higher findings
- Backup and restore procedure tested and documented
- CAO formal sign-off received

## 11.8 Phase Dependencies

```text
Phase 1 (Foundation)
  |-> Phase 2 (Enrollment + Revenue) -- requires: auth, DB schema
        |-> Phase 3 (Staffing) -- requires: enrollment (for FTE), version structure
              |-> Phase 4 (Versions + P&L) -- requires: revenue + staffing calculations
                    |-> Phase 5 (Dashboard + Export) -- requires: all calculation modules
                          |-> Phase 6 (Migration + Go-Live) -- requires: all features complete
```

Phases 2 and 3 overlap by design: revenue and staffing are independent calculation
modules. DHG/staffing development starts in Week 12 (parallel with revenue refinement).
