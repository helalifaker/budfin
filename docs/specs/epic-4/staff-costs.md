# Feature Spec: Staff Costs

> Epic: #8 | Phase: 4 -- SPECIFY | Status: Draft | Date: 2026-03-09

## Summary

Epic 4 completes the Staff Costs module by building on the foundation laid by Epic 3 (Staffing DHG). Epic 3 delivered the core cost engine (`calculateGOSI`, `calculateAjeer`, `calculateEoSProvision`, `calculateFullMonthlyCost`), employee CRUD routes with pgcrypto encryption, xlsx import, the `POST /calculate/staffing` endpoint, and basic result endpoints (`GET /staff-costs`, `GET /staffing-summary`). Epic 4 delivers the remaining delta: the full Monthly Cost Budget grid (Tab C) with 12-month category-level breakdown and September step-change visibility, department-grouped expandable rows on the Staff Costs tab (Tab B), stale data enforcement on result endpoints, enhanced KPI ribbon, YEARFRAC regression validation against Excel baselines, and the Contrats Locaux / Residents cost category infrastructure. All monetary calculations use `Decimal.js` (TC-001) and all dates use `@date-fns/tz` for AST (UTC+3) handling (TC-005). PRD references: FR-STC-001 through FR-STC-025.

## Acceptance Criteria

- [x] AC-01: Given employees exist and calculation has been run, when a user opens Tab C (Monthly Cost Budget), then a hierarchical grid displays cost categories (Local Staff Salaries > Existing/New, GOSI, Ajeer, EoS Accrual, Subtotal, Contrats Locaux, Residents, Grand Total) with 12 individual month columns (Jan-Dec) plus an Annual Total column.
- [x] AC-02: Given calculation has been run, when the September column renders in Tab C, then it displays an amber triangle indicator and a tooltip "New positions start September", and the column background has `--color-warning-bg` at 30% opacity.
- [x] AC-03: Given the Academic Period Toggle is set to AY1/AY2/Summer, when viewing Tab C, then only the applicable months are visible and the Annual column sums only the visible months.
- [x] AC-04: Given employees exist in a version, when viewing Tab B (Staff Costs), then employees are grouped into expandable department rows with a chevron toggle, headcount badge, and aggregated totals for Monthly Gross, Annual Cost, EoS, Ajeer, GOSI, and Department Total.
- [x] AC-05: Given a department row is expanded, when viewing employee detail rows, then each row shows all column definitions per UI/UX spec Section 5.3 (Employee Code through EoS Monthly), with first 3 columns pinned left and horizontal scroll for the remaining columns.
- [x] AC-06: Given the Grand Total row at the bottom of Tab B, when viewing it, then it is sticky and aggregates all departments (excluding Departed employees) for Headcount, Monthly Gross, Annual Cost, EoS, Ajeer, GOSI, and Grand Total.
- [x] AC-07: Given a user hovers over a Monthly Gross cell in Tab B, then a tooltip displays the calculation breakdown: Base Salary + Housing + Transport + Premium + HSA (with Jul-Aug exclusion note) = Subtotal x Hourly % = Monthly Gross.
- [x] AC-08: Given a user with Viewer role accesses employee data, when salary fields render, then encrypted fields display `--` (masked) and the API returns `null` for those fields.
- [x] AC-09: Given the STAFFING module is stale (employee data modified since last calculation), when `GET /staff-costs` or `GET /staffing-summary` is called, then the API returns 409 with code `STALE_DATA`.
- [x] AC-10: Given the Staff Costs KPI ribbon renders, then it displays: Total Headcount, Total Annual Staff Cost (SAR), Average Monthly Cost per Employee, GOSI Total, Ajeer Total, EoS Total.
- [x] AC-11: Given the `GET /staff-costs` endpoint is called with `group_by=category_month`, then it returns cost data broken down by category (gross_salaries_existing, gross_salaries_new, gosi, ajeer, eos_accrual) for each of the 12 months -- this powers Tab C.
- [x] AC-12: Given a YEARFRAC calculation is performed for EoS provision, then the result matches Excel `YEARFRAC(start, end, 0)` to full `Decimal.js` precision for all test cases including leap year boundaries (SA-002, SA-004).
- [x] AC-13: Given `system_config` contains Contrats Locaux rates (remplacements_rate, formation_rate) and Residents costs (resident_salary_annual, resident_logement_annual), when calculation runs, then these additional cost categories are computed and included in Tab C output rows.
- [x] AC-14: Given department share percentage calculation, when a department total renders in Tab B, then a secondary line shows the department's share as a percentage of the grand total (FR-STC-021).
- [x] AC-15: Given keyboard navigation on the employee grid, then Space/Enter toggles department expand/collapse, Arrow Right expands, Arrow Left collapses, and Ctrl+Shift+N opens the Add Employee panel.

## Stories

| #   | Story                                                                                         | Depends On       | GitHub Issue |
| --- | --------------------------------------------------------------------------------------------- | ---------------- | ------------ |
| 1   | Add stale data enforcement to GET /staff-costs and GET /staffing-summary endpoints            | --               |              |
| 2   | Add category-month breakdown mode to GET /staff-costs endpoint                                | Story 1          |              |
| 3   | Add Contrats Locaux and Residents system_config entries and seed data                         | --               |              |
| 4   | Extend staff cost calculation to compute Contrats Locaux and Residents cost categories        | Story 3          |              |
| 5   | Build Monthly Cost Budget grid component (Tab C) with 12-month columns and category hierarchy | Story 2          |              |
| 6   | Add September step-change indicator and period filter to Tab C                                | Story 5          |              |
| 7   | Refactor employee grid (Tab B) with expandable department group rows and aggregated totals    | --               |              |
| 8   | Add grand total sticky row and department share percentage to Tab B                           | Story 7          |              |
| 9   | Add monthly gross calculation tooltip to Tab B                                                | Story 7          |              |
| 10  | Enhance Staff Costs KPI ribbon with full metrics                                              | --               |              |
| 11  | Add YEARFRAC regression test suite validated against Excel baselines                          | --               |              |
| 12  | Add keyboard navigation for department expand/collapse and Add Employee shortcut              | Story 7          |              |
| 13  | Add encrypted field masking (Viewer role) and ARIA attributes for Tab B and Tab C grids       | Story 5, Story 7 |              |

## Data Model Changes

No new tables required. Epic 3 already created `employees`, `monthly_staff_costs`, and `eos_provisions`.

New `system_config` seed entries:

```sql
INSERT INTO system_config (key, value, data_type, description) VALUES
  ('remplacements_rate', '0.02', 'decimal', 'Contrats Locaux: remplacements rate as fraction of local staff salaries'),
  ('formation_rate', '0.01', 'decimal', 'Contrats Locaux: 1% formation continue rate'),
  ('resident_salary_annual', '0', 'decimal', 'Residents: total annual resident salaries (SAR)'),
  ('resident_logement_annual', '0', 'decimal', 'Residents: total annual logement & billets avion (SAR)');
```

These are configurable via the existing `system_config` API (Epic 7).

## API Endpoints

Existing endpoints (no changes):

| Method | Path                                           | Notes                        |
| ------ | ---------------------------------------------- | ---------------------------- |
| GET    | /api/v1/versions/:versionId/employees          | Already implemented (Epic 3) |
| POST   | /api/v1/versions/:versionId/employees          | Already implemented (Epic 3) |
| GET    | /api/v1/versions/:versionId/employees/:id      | Already implemented (Epic 3) |
| PUT    | /api/v1/versions/:versionId/employees/:id      | Already implemented (Epic 3) |
| DELETE | /api/v1/versions/:versionId/employees/:id      | Already implemented (Epic 3) |
| POST   | /api/v1/versions/:versionId/employees/import   | Already implemented (Epic 3) |
| POST   | /api/v1/versions/:versionId/calculate/staffing | Already implemented (Epic 3) |

Modified endpoints:

| Method | Path                                         | Change                                                               | Auth   |
| ------ | -------------------------------------------- | -------------------------------------------------------------------- | ------ |
| GET    | /api/v1/versions/:versionId/staff-costs      | Add `group_by=category_month` option; add 409 STALE_DATA enforcement | Bearer |
| GET    | /api/v1/versions/:versionId/staffing-summary | Add 409 STALE_DATA enforcement                                       | Bearer |

### GET /staff-costs -- New `category_month` group_by mode

**Query params:**

- `group_by`: `employee` | `department` | `month` | `category_month` (default: `month`)
- `include_breakdown`: boolean (default: false)

**Response 200 (group_by=category_month):**

```json
{
    "months": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    "categories": [
        {
            "category": "gross_salaries_existing",
            "label": "Existing Staff",
            "parent": "local_staff_salaries",
            "values": ["125000.0000", "125000.0000", "...", "132000.0000"]
        },
        {
            "category": "gross_salaries_new",
            "label": "New Staff",
            "parent": "local_staff_salaries",
            "values": ["0.0000", "0.0000", "...", "45000.0000"]
        },
        {
            "category": "gosi",
            "label": "GOSI",
            "parent": null,
            "values": ["14687.5000", "..."]
        },
        {
            "category": "ajeer",
            "label": "Ajeer",
            "parent": null,
            "values": ["9660.0000", "..."]
        },
        {
            "category": "eos_accrual",
            "label": "EoS Accrual",
            "parent": null,
            "values": ["15250.0000", "..."]
        },
        {
            "category": "subtotal_local",
            "label": "Subtotal Local Staff",
            "parent": null,
            "values": ["sum...", "..."]
        },
        {
            "category": "remplacements",
            "label": "Remplacements",
            "parent": "contrats_locaux",
            "values": ["2500.0000", "..."]
        },
        {
            "category": "formation",
            "label": "1% Formation Continue",
            "parent": "contrats_locaux",
            "values": ["1250.0000", "..."]
        },
        {
            "category": "resident_salaires",
            "label": "Salaires",
            "parent": "residents",
            "values": ["0.0000", "..."]
        },
        {
            "category": "resident_logement",
            "label": "Logement & Billets Avion",
            "parent": "residents",
            "values": ["0.0000", "..."]
        },
        {
            "category": "grand_total",
            "label": "GRAND TOTAL",
            "parent": null,
            "values": ["sum...", "..."]
        }
    ],
    "annual_totals": {
        "gross_salaries_existing": "1584000.0000",
        "gross_salaries_new": "180000.0000",
        "gosi": "176250.0000",
        "ajeer": "115920.0000",
        "eos_accrual": "183000.0000",
        "subtotal_local": "2239170.0000",
        "remplacements": "30000.0000",
        "formation": "15000.0000",
        "resident_salaires": "0.0000",
        "resident_logement": "0.0000",
        "grand_total": "2284170.0000"
    }
}
```

**Error responses (new):**

| Status | Code       | Condition                                   |
| ------ | ---------- | ------------------------------------------- |
| 409    | STALE_DATA | STAFFING module is in `stale_modules` array |

## UI/UX Specification

> Source: `docs/ui-ux-spec/05-staffing-costs.md` Sections 5-9 | Cross-cutting: `00-global-framework.md`, `10-input-management.md`

### Shell & Layout

PlanningShell. The module renders inside the existing Staffing & Staff Costs page at `/planning/staffing`. The three-tab structure (DHG | Staff Costs | Monthly Budget) is already in place from Epic 3. Epic 4 enhances Tab B (Staff Costs) and rebuilds Tab C (Monthly Cost Budget).

```
+--------+--------------------------------------------+
| Side-  |  Context Bar (56px) [FY] [Version] [Period]|
| bar    +--------------------------------------------+
|        |  Module Toolbar (48px)                     |
|        +--------------------------------------------+
|        |  [DHG] [Staff Costs] [Monthly Budget]      |
|        +--------------------------------------------+
|        |  KPI Ribbon (4-6 cards)                    |
|        +--------------------------------------------+
|        |  Tab Content (scrollable)                  |
|        |                                            |
+--------+--------------------------------------------+
```

### Key Components

| Component                    | Type                                | Source                            | Notes                                               |
| ---------------------------- | ----------------------------------- | --------------------------------- | --------------------------------------------------- |
| `<StaffCostsDepartmentGrid>` | TanStack Table v8 + custom grouping | UI/UX 5.2-5.3                     | Expandable department rows with employee detail     |
| `<MonthlyCostBudgetGrid>`    | TanStack Table v8 (read-only)       | UI/UX 7.1-7.5                     | 12 month columns, category hierarchy, Sep indicator |
| `<GrossTooltip>`             | shadcn/ui Tooltip                   | UI/UX 5.5                         | Monthly gross calculation breakdown                 |
| `<StaffCostKpiRibbon>`       | Custom KPI cards                    | UI/UX spec + Global Framework 4.7 | 6 metric cards                                      |
| `<SeptemberIndicator>`       | Custom header decoration            | UI/UX 7.4                         | Amber triangle + tooltip                            |

### User Flows

1. **View Staff Costs by Department**: User clicks Tab B -> sees department group rows with aggregated totals -> clicks chevron to expand -> sees employee detail rows with salary fields -> hovers Monthly Gross to see breakdown tooltip.

2. **View Monthly Cost Budget**: User clicks Tab C -> sees category-level hierarchical grid with 12 month columns -> scrolls right to see Sep column with step-change indicator -> toggles Academic Period to AY2 -> grid filters to Sep-Dec columns only.

3. **Stale Data Warning**: User modifies an employee salary -> navigates to Tab C -> sees "Recalculation required" banner instead of grid -> clicks "Recalculate" button -> calculation runs -> grid refreshes with updated data.

### Interaction Patterns

- **Department expand/collapse**: Click chevron or row. Keyboard: Space/Enter toggles, Arrow Right expands, Arrow Left collapses.
- **Inline editing on Tab B**: Single-click to select cell, type to edit. Auto-save after 1s debounce via `PUT /employees/:id`.
- **September column highlight**: Permanent amber tint on Sep column in Tab C. Tooltip on column header.
- **Period filter**: Context bar Academic Period Toggle hides non-applicable months in Tab C. Annual column adjusts sum.

### Accessibility Requirements

- Tab B employee grid: `role="grid"`, department rows: `aria-expanded`, employee rows: `aria-level="2"`.
- Tab C monthly budget grid: `role="grid"`, `aria-readonly="true"`.
- September column header: `aria-description="New positions start in September"`.
- Encrypted masked cells (Viewer role): `aria-label="Salary data restricted"`.
- Keyboard: full grid nav per Global Framework Section 5.1. Department expand/collapse via Arrow keys.
- Screen reader: `aria-live="polite"` announcements for department expand/collapse, calculation complete.

### Responsive / Viewport

> BudFin targets desktop (1280px min). Tab B employee grid total width ~2,032px requires horizontal scroll with first 3 columns pinned left. Tab C monthly budget grid ~1,650px requires horizontal scroll with Category column pinned left.

## UI Compliance (required for all stories with frontend changes)

Read before implementing any new screen:

- `docs/ui-ux-spec/00-global-framework.md` -- tokens, shells, shared components
- `docs/ui-ux-spec/00b-workspace-philosophy.md` -- two-shell architecture, progressive disclosure
- `docs/ui-ux-spec/05-staffing-costs.md` -- module-specific layout, columns, interactions

Acceptance criteria:

- [x] All interactive elements use shadcn/ui primitives from `apps/web/src/components/ui/`
- [x] Design tokens used (`var(--token)`) -- no arbitrary hex colors
- [x] Mutation feedback via `toast` -- no inline div status messages
- [x] Async states via `Skeleton` / `TableSkeleton` -- no plain "Loading..." text
- [x] Table ARIA: `role="grid"` for inline-editable grids, `role="grid" aria-readonly="true"` for read-only grids

## Edge Cases Cross-Reference

| Case ID | Description                                    | Handling                                                                                                                                                                                    |
| ------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SA-001  | IEEE 754 precision loss in calculation chain   | All monetary arithmetic uses `Decimal.js` (TC-001). No native `Number` for financial values.                                                                                                |
| SA-002  | YEARFRAC implementation and EoS rounding order | Custom US 30/360 implementation validated against Excel. Full precision retained; round only at presentation. Story 11 adds regression suite.                                               |
| SA-004  | YEARFRAC leap year boundary                    | Leap year test cases (Feb 29 -> Dec 31) included in regression suite.                                                                                                                       |
| SA-007  | HSA seasonal exclusion edge case               | HSA zeroed for July and August calendar months regardless of join date. Mid-year hires receive HSA only from join month through June (excl Jul-Aug). Already handled in `monthly-gross.ts`. |
| SA-011  | Circular dependency FTE <-> Staff Cost         | Staff cost positions are NOT auto-calculated from FTE. User manually manages employee roster. Calculation runs DHG and cost engine as separate sequential steps.                            |

## Out of Scope

- Comparison mode for staff costs (FR-STC-024, FR-STC-025) -- deferred to Epic 6 (Scenario Modeling)
- Async calculation via pg-boss (`POST /versions/:id/calculations/run`) -- deferred to Epic 8 (Audit Trail) which adds job monitoring
- Employee PDF export -- deferred to Epic 5 (P&L Reporting) which introduces `@react-pdf/renderer`
- Bulk augmentation application -- v2 feature
- Input Management integration (cell locking, guidance notes) -- Epic 10+ feature

## Open Questions

(none -- all resolved)

## Planner Agent Sign-Off

- [x] No open questions
- [x] Acceptance criteria are testable
- [x] Edge cases cross-referenced
- [x] Data model complete
- [x] API contract complete
- [x] UI/UX specification complete
