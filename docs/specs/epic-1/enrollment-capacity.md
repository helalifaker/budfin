# Feature Spec: Enrollment & Capacity

> Epic: #3 | Phase: 4 — SPECIFY | Status: Draft | Date: 2026-03-06

## Summary

Epic 1 delivers the Enrollment & Capacity module — the primary data-entry point for student
headcount planning and the upstream input to every subsequent calculation engine (Revenue, DHG,
Staffing, P&L). It implements a two-stage enrollment workflow: Stage 1 captures total headcount per
grade level (15 grades, PS through Terminale) and academic period (AY1 Jan–Jun, AY2 Sep–Dec);
Stage 2 breaks down each headcount into nationality (Francais, Nationaux, Autres) and tariff (RP,
R3+, Plein) segments, with server-validated sum constraints. A capacity calculation engine computes
sections needed via CEILING(headcount / max_class_size), derives utilization percentages, and
produces traffic-light alerts (OVER, NEAR_CAP, OK, UNDER). Historical enrollment (5-year CSV import
with CAGR and moving average analytics) informs projection decisions. The frontend renders inside
PlanningShell with three TanStack Table v8 grids (By Grade, By Nationality, By Tariff), a
collapsible Recharts v3 historical trend chart, and a two-phase CSV import side panel. PRD
references: FR-ENR-001 through FR-ENR-009, FR-CAP-001 through FR-CAP-007, US-006, US-015, US-016.

## Acceptance Criteria

**Stage 1 — Headcount Entry (FR-ENR-005, FR-ENR-009)**

- [ ] AC-01: Given a Draft version and a user with Admin, BudgetOwner, or Editor role, when they PUT
      to `/api/v1/versions/:versionId/enrollment/headcount` with entries containing grade_level (one
      of the 15 canonical grades), academic_period (AY1 or AY2), and headcount (integer >= 0), then
      the headcount values are upserted into enrollment_headcount, stale_modules on the version is
      updated to include REVENUE, DHG, STAFFING, and PNL, and a 200 response returns the updated
      count and stale_modules array.

- [ ] AC-02: Given a Draft version, when GET
      `/api/v1/versions/:versionId/enrollment/headcount` is called with optional academic_period
      filter (AY1, AY2, or both), then all headcount entries for the version are returned grouped by
      grade and period, sorted in grade display order.

- [ ] AC-03: Given a Locked or Archived version, when any user sends PUT to the headcount endpoint,
      then 409 VERSION_LOCKED is returned.

- [ ] AC-04: Given a headcount PUT request containing a negative value, then 422 NEGATIVE_HEADCOUNT
      is returned with field-level errors indicating which entries are invalid.

- [ ] AC-05: Given a Viewer role user, when they attempt PUT on headcount, then 403
      INSUFFICIENT_ROLE is returned.

**Stage 2 — Nationality/Tariff Detail (FR-ENR-005, FR-ENR-006, FR-ENR-007)**

- [ ] AC-06: Given a Draft version with Stage 1 headcount entered, when a user PUTs to
      `/api/v1/versions/:versionId/enrollment/detail` with entries containing grade_level,
      academic_period, nationality (Francais/Nationaux/Autres), tariff (RP/R3+/Plein), and
      headcount, then the detail rows are upserted and a 200 response is returned.

- [ ] AC-07: Given a Stage 2 PUT request where the sum of detail headcounts for any (grade_level,
      academic_period) combination does not equal the corresponding Stage 1 headcount total, then
      422 STAGE2_TOTAL_MISMATCH is returned with an array listing the mismatched grades and their
      expected vs actual totals.

- [ ] AC-08: Given Stage 2 detail rows exist, when GET
      `/api/v1/versions/:versionId/enrollment/detail` is called, then all detail entries are returned
      with grade_level, academic_period, nationality, tariff, and headcount fields.

- [ ] AC-09: Given a Stage 1 headcount row is deleted (version cascade) or updated to 0, then any
      corresponding Stage 2 detail rows are handled gracefully (FK CASCADE removes details when
      headcount row is deleted; headcount=0 is valid with matching zero-sum details).

**Capacity Calculation (FR-CAP-001 through FR-CAP-007)**

- [ ] AC-10: Given a version with Stage 1 headcount entered, when POST
      `/api/v1/versions/:versionId/calculate/enrollment` is called, then for each grade,
      sections*needed is computed as CEILING(headcount / max_class_size) using the GradeLevel
      model's maxClassSize, utilization is computed as
      (headcount / (sections_needed * max*class_size)) * 100, and a traffic-light status is assigned.

- [ ] AC-11: Given headcount = 0 for a grade, then sections_needed = 0, utilization = 0%, and no
      alert status is assigned (PO-001).

- [ ] AC-12: Given headcount > 0, then traffic-light alerts are assigned as: OVER when
      utilization > 100%, NEAR_CAP when utilization > 95% and <= 100% (FR-CAP-007), OK when
      utilization >= 70% and <= 95%, UNDER when utilization < 70%.

- [ ] AC-13: Given the capacity calculation response, it includes run_id (uuid), duration_ms,
      summary.total_students_ay1, summary.total_students_ay2, and summary.over_capacity_grades
      listing grades with utilization > 100%.

- [ ] AC-14: Given a version with data_source = 'IMPORTED', when POST calculate/enrollment is
      called, then 409 IMPORTED_VERSION is returned.

**Recruitment Slots (FR-CAP-005)**

- [ ] AC-15: Given calculated capacity data, the recruitment slot for each grade is computed as
      (sections*needed * max*class_size * plafond_pct) - headcount and is included in the capacity
      calculation response.

**Historical Enrollment (FR-ENR-001, FR-ENR-002, FR-ENR-003, FR-ENR-004)**

- [ ] AC-16: Given historical enrollment data exists for 5 academic years, when GET
      `/api/v1/enrollment/historical?years=5` is called, then the response includes per-grade
      per-year student counts, cagr_by_band (percentage per band), and moving_avg_by_band (3-year
      moving average per band).

- [ ] AC-17: Given a CSV file with columns grade_level, student_count and a selected academic_year,
      when POST `/api/v1/enrollment/historical/import` with mode=validate is sent, then the response
      includes total_rows, valid_rows, errors (with row/field/message), and preview data without
      persisting anything.

- [ ] AC-18: Given a successful validation, when POST
      `/api/v1/enrollment/historical/import` with mode=commit is sent, then the data is persisted as
      headcount rows under an Actual-type version for that academic year, and 201 is returned with
      the imported count.

- [ ] AC-19: Given data already exists for the submitted academic_year, then 409 DUPLICATE_YEAR is
      returned, prompting the client to confirm replacement (PO-010).

- [ ] AC-20: Given a CSV with an unknown grade_level (not in the 15 canonical grades), then that row
      is flagged as an error in validation and skipped during commit (PO-023).

**Delta vs Prior Year (FR-ENR-008)**

- [ ] AC-21: Given the current version headcount and the prior year's Actual version headcount, when
      the By Grade grid is displayed, the Delta column shows ((current - prior) / prior) \* 100 with
      visual flagging (red icon) when |delta| > 10%. When prior = 0, a "New" badge is shown.

**Dual Academic Year (FR-ENR-009)**

- [ ] AC-22: Given the enrollment module, AY1 (Jan–Jun) and AY2 (Sep–Dec) headcount columns are
      independently editable in all grids, and all API endpoints support the academic_period filter.

**Version Staleness Integration**

- [ ] AC-23: Given any enrollment headcount PUT, the version's stale_modules is updated to include
      REVENUE, DHG, STAFFING, and PNL. After calculate/enrollment succeeds, ENROLLMENT is removed
      from stale_modules but the downstream modules remain stale.

**Permissions**

- [ ] AC-24: Given a Viewer role, all grids render without editable cell styling, Calculate and
      Import buttons are hidden, and PUT/POST mutation endpoints return 403.

## Stories

| #   | Story                                               | Depends On       | GitHub Issue |
| --- | --------------------------------------------------- | ---------------- | ------------ |
| 1   | DB schema: enrollment_headcount + enrollment_detail | —                | #80          |
| 2   | Stage 1 API: headcount GET/PUT                      | Story 1          | #81          |
| 3   | Stage 2 API: detail GET/PUT with sum validation     | Story 2          | #82          |
| 4   | Capacity calculation engine                         | Story 2          | #83          |
| 5   | Historical enrollment API: GET + CSV import         | Story 1          | #84          |
| 6   | Enrollment page shell + By Grade grid (Tab 1)       | Story 2          | #85          |
| 7   | By Nationality grid (Tab 2) + match validation UI   | Story 3, Story 6 | #86          |
| 8   | By Tariff grid (Tab 3) + two-level validation UI    | Story 3, Story 6 | #87          |
| 9   | Capacity columns + traffic-light alerts UI          | Story 4, Story 6 | #88          |
| 10  | Historical enrollment chart (Recharts v3)           | Story 5, Story 6 | #89          |
| 11  | CSV import side panel UI                            | Story 5, Story 6 | #90          |
| 12  | Calculate workflow + stale module integration       | Story 4, Story 9 | #91          |
| 13  | Integration tests (E2E API + UI smoke)              | Stories 1-12     | #92          |

## Data Model Changes

Two new Prisma models. No separate class_capacity_config table — the existing GradeLevel model
already has maxClassSize, plancherPct, ciblePct, plafondPct.

```sql
CREATE TABLE enrollment_headcount (
  id              SERIAL       PRIMARY KEY,
  version_id      INTEGER      NOT NULL,
  academic_period TEXT         NOT NULL,
  grade_level     TEXT         NOT NULL,
  headcount       INTEGER      NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_by      INTEGER      NOT NULL,
  updated_by      INTEGER,

  CONSTRAINT enrollment_headcount_version_fk
    FOREIGN KEY (version_id) REFERENCES budget_versions(id) ON DELETE CASCADE,
  CONSTRAINT enrollment_headcount_created_by_fk
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT enrollment_headcount_updated_by_fk
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT enrollment_headcount_period_check
    CHECK (academic_period IN ('AY1', 'AY2')),
  CONSTRAINT enrollment_headcount_grade_check
    CHECK (grade_level IN ('PS','MS','GS','CP','CE1','CE2','CM1','CM2',
           '6eme','5eme','4eme','3eme','2nde','1ere','Terminale')),
  CONSTRAINT enrollment_headcount_count_check CHECK (headcount >= 0),
  CONSTRAINT enrollment_headcount_composite_unique
    UNIQUE (version_id, academic_period, grade_level)
);

CREATE INDEX enrollment_headcount_version_period_idx
  ON enrollment_headcount (version_id, academic_period);

CREATE TABLE enrollment_detail (
  id              SERIAL       PRIMARY KEY,
  version_id      INTEGER      NOT NULL,
  academic_period Text         NOT NULL,
  grade_level     TEXT         NOT NULL,
  nationality     TEXT         NOT NULL,
  tariff          TEXT         NOT NULL,
  headcount       INTEGER      NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_by      INTEGER      NOT NULL,
  updated_by      INTEGER,

  CONSTRAINT enrollment_detail_version_fk
    FOREIGN KEY (version_id) REFERENCES budget_versions(id) ON DELETE CASCADE,
  CONSTRAINT enrollment_detail_created_by_fk
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT enrollment_detail_updated_by_fk
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT enrollment_detail_headcount_fk
    FOREIGN KEY (version_id, academic_period, grade_level)
    REFERENCES enrollment_headcount(version_id, academic_period, grade_level)
    ON DELETE CASCADE,
  CONSTRAINT enrollment_detail_period_check
    CHECK (academic_period IN ('AY1', 'AY2')),
  CONSTRAINT enrollment_detail_grade_check
    CHECK (grade_level IN ('PS','MS','GS','CP','CE1','CE2','CM1','CM2',
           '6eme','5eme','4eme','3eme','2nde','1ere','Terminale')),
  CONSTRAINT enrollment_detail_nationality_check
    CHECK (nationality IN ('Francais', 'Nationaux', 'Autres')),
  CONSTRAINT enrollment_detail_tariff_check
    CHECK (tariff IN ('RP', 'R3+', 'Plein')),
  CONSTRAINT enrollment_detail_count_check CHECK (headcount >= 0),
  CONSTRAINT enrollment_detail_composite_unique
    UNIQUE (version_id, academic_period, grade_level, nationality, tariff)
);

CREATE INDEX enrollment_detail_version_period_grade_idx
  ON enrollment_detail (version_id, academic_period, grade_level);
```

Prisma models: EnrollmentHeadcount and EnrollmentDetail with relations to BudgetVersion and User.

## API Endpoints

| Method | Path                                               | Request                                                                       | Response                                                                       | Auth                                |
| ------ | -------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------- |
| GET    | `/api/v1/versions/:versionId/enrollment/headcount` | `?academic_period=AY1\|AY2\|both`                                             | `{ entries: [{gradeLevel, academicPeriod, headcount}] }`                       | Bearer (all)                        |
| PUT    | `/api/v1/versions/:versionId/enrollment/headcount` | `{ entries: [{gradeLevel, academicPeriod, headcount}] }`                      | `{ updated: number, staleModules: string[] }`                                  | Bearer (Admin, BudgetOwner, Editor) |
| GET    | `/api/v1/versions/:versionId/enrollment/detail`    | `?academic_period=AY1\|AY2\|both`                                             | `{ entries: [{gradeLevel, academicPeriod, nationality, tariff, headcount}] }`  | Bearer (all)                        |
| PUT    | `/api/v1/versions/:versionId/enrollment/detail`    | `{ entries: [{gradeLevel, academicPeriod, nationality, tariff, headcount}] }` | `{ updated: number }`                                                          | Bearer (Admin, BudgetOwner, Editor) |
| GET    | `/api/v1/enrollment/historical`                    | `?years=5`                                                                    | `{ data: [...], cagrByBand: {...}, movingAvgByBand: {...} }`                   | Bearer (all)                        |
| POST   | `/api/v1/enrollment/historical/import`             | multipart: file, mode, academicYear                                           | validate: `{ totalRows, validRows, errors, preview }` / commit: `{ imported }` | Bearer (Admin, BudgetOwner, Editor) |
| POST   | `/api/v1/versions/:versionId/calculate/enrollment` | —                                                                             | `{ runId, durationMs, summary: {...} }`                                        | Bearer (Admin, BudgetOwner, Editor) |

Error codes: VERSION_LOCKED (409), NEGATIVE_HEADCOUNT (422), STAGE2_TOTAL_MISMATCH (422),
MISSING_PREREQUISITES (422), DUPLICATE_YEAR (409), INSUFFICIENT_ROLE (403), IMPORTED_VERSION (409).

## UI/UX Specification

> Source: `docs/ui-ux-spec/03-enrollment-capacity.md` | Cross-cutting:
> `00-global-framework.md`, `10-input-management.md`

### Shell & Layout

**PlanningShell** with Context Bar and docked right panel.

```text
Context Bar (56px) [FY | Version | Compare | Period | Scenario]
Module Toolbar (48px) [Title | Grade Band Filter | Calculate | Export | More]
Tab Bar [By Grade | By Nationality | By Tariff]
Active Tab Content (TanStack Table v8 grid)
Historical Chart (collapsible, default collapsed)
```

Route: `/planning/enrollment`

### Key Components

| Component              | Type                    | Notes                                          |
| ---------------------- | ----------------------- | ---------------------------------------------- |
| Grade Band ToggleGroup | shadcn/ui ToggleGroup   | All/Mat/Elem/Col/Lyc filter                    |
| Calculate Button       | Custom state machine    | idle/saving/calculating/success/error          |
| Tab Bar                | shadcn/ui Tabs          | 3 tabs; badge on By Nationality for mismatches |
| By Grade Grid          | TanStack Table v8       | 11 cols, 4 band groups, inline integer editing |
| By Nationality Grid    | TanStack Table v8       | 7 cols, 15 grade groups, match validation      |
| By Tariff Grid         | TanStack Table v8       | 8 cols, two-level grouping                     |
| Historical Chart       | Recharts v3 LineChart   | 5 lines, CAGR annotations, collapsible         |
| CSV Import Panel       | shadcn/ui Sheet (480px) | Two-phase validate/commit                      |
| Alert Badge            | Custom traffic-light    | OVER/NEAR_CAP/OK/UNDER with icons              |

### User Flows

1. **Enter headcount:** Navigate to tab -> double-click cell -> type integer -> Enter/Tab -> auto-save
2. **Enter detail:** Switch to By Nationality/Tariff tab -> edit cells -> real-time sum validation
3. **Calculate:** Click Calculate -> saving -> calculating -> capacity columns populate + toast
4. **Import CSV:** More > Import Historical -> select year + file -> Validate -> Import
5. **View trends:** Expand historical chart -> hover/click legend

### Interaction Patterns

- Inline editing: double-click/Enter, yellow bg, blue focus border, Escape cancels
- Auto-save: batch on blur or 30s interval via PUT
- Keyboard: Arrow keys navigate, Tab moves right, Enter moves down
- Group expand/collapse with chevron, all expanded by default
- Grand total row sticky at bottom

### Accessibility Requirements

- ARIA grid pattern on all three grids
- Traffic-light uses icons + text (not color alone)
- `aria-expanded` on group headers, `aria-readonly` on non-editable cells
- Focus management on tab switch and panel open/close
- All contrast ratios meet WCAG AA 4.5:1

### Responsive / Viewport

Desktop only (min 1280px). Historical columns hidden below 1440px. No mobile layout.

## Edge Cases Cross-Reference

| Case ID | Description                                         | Handling                                                                |
| ------- | --------------------------------------------------- | ----------------------------------------------------------------------- |
| PO-001  | Zero enrollment in a grade                          | headcount=0 valid; sections=0, utilization=0%, no alert                 |
| PO-005  | Enrollment decrease mid-year                        | AY1/AY2 independent; re-calculation propagates stale flags              |
| PO-008  | Version comparison with different enrollment counts | Handled by Epic 10 comparison engine                                    |
| PO-010  | Historic enrollment with missing data points        | Gaps in chart; CAGR over available years                                |
| PO-011  | AY1 vs AY2 fee grid discrepancy                     | Enrollment stores per-period; fee logic is Epic 2                       |
| PO-014  | Enrollment exceeds Plafond                          | OVER alert; negative recruitment slots; toast warning                   |
| PO-020  | Rounding in CEILING function                        | Integer arithmetic server-side; no ambiguity                            |
| PO-023  | Unknown grade in CSV                                | Flagged as error in validation; skipped on commit                       |
| PO-029  | Master data changes; retroactive impact             | GradeLevel not version-scoped; affects next calculate on Draft versions |
| PO-032  | Comparison with different calendars                 | Period-indexed (AY1/AY2); calendar mapping is upstream                  |

## Out of Scope

- FR-ENR-010 (COULD): Cohort progression modeling — deferred to v2
- FR-ENR-011 (COULD): Lateral entry weight parameter — deferred to v2
- FR-ENR-012 (COULD): Manual PS intake for AY2 — deferred to v2
- FR-ENR-013 (COULD): 3-year historical context analysis — deferred to v2
  (N-2/N-1 columns in the grid ARE in scope as simple read-only reference)
- Revenue calculation engine — enrollment feeds revenue but engine is Epic 2
- DHG/FTE calculation — sections_needed computed here; DHG allocation is Epic 3
- Scenario modeling parameters — deferred to Epic 6
- Export functionality — toolbar buttons stubbed; export logic is cross-cutting
- Capacity Settings admin UI — already in Epic 7 (grade-levels route)

## Open Questions

_(none — all questions resolved)_
