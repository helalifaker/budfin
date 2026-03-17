# Epic 20: Staffing Frontend Redesign

> Source Plan: `docs/plans/2026-03-17-dhg-staffing-redesign.md`

## Summary

Epic 20 delivers the complete frontend redesign of the staffing module with two coordinated
workspace modes: Teaching Demand & Coverage (default) and Support & Admin Positions. It includes
a requirement-line grid with band grouping and coverage badges, a department-grouped support
grid, a 6-tab settings sheet, a KPI ribbon with 6 metrics, a right-panel inspector for
requirement lines and employees, and an assignment management UI with auto-suggest dialog.
After this epic ships, EFIR budget planners have a unified staffing workspace matching the
enrollment page patterns with full demand/coverage/cost visibility.

## Acceptance Criteria

- AC-01: Page layout matches enrollment pattern with workspace toggle between Teaching and Support modes
- AC-02: Toolbar: workspace toggle, band filter, coverage filter, view presets (Need/Coverage/Cost/Full), action buttons
- AC-03: 14 new TanStack Query hooks in `use-staffing.ts` + master data hooks in `use-master-data.ts`
- AC-04: Zustand stores: `staffing-selection-store.ts` (REQUIREMENT_LINE/SUPPORT_EMPLOYEE) and `staffing-settings-store.ts`
- AC-05: TeachingMasterGrid renders requirement lines grouped by band (MAT/ELEM/COL/LYC) with collapsible headers and subtotals
- AC-06: Coverage badges WCAG AA compliant (text+icon, not color-only); gap cells with backgrounds + aria-labels
- AC-07: Band and coverage filters functional
- AC-08: Totals sum raw FTE, not rounded positions
- AC-09: SupportAdminGrid: non-teaching employees grouped by department with subtotals
- AC-10: Employee form updated with 6 new fields (recordType, costMode, discipline, profile, homeBand, contractEndDate)
- AC-11: StaffingSettingsSheet with 6 tabs: service profiles, DHG rules, lycee assumptions, cost assumptions, enrollment link, reconciliation
- AC-12: KPI ribbon: headcount, FTE gap, staff cost, HSA budget, H/E ratio, recharge cost
- AC-13: Status strip: calc timestamp, stale warning, demand period, source, supply count, coverage summary
- AC-14: Right panel inspector: requirement line detail (driver breakdown, assignments, gap, cost, HSA) and support employee detail
- AC-15: Assignment management: assign teacher action, assignment form, edit/delete existing assignments
- AC-16: Auto-suggest dialog: suggestion table with accept/reject, bulk actions, source tracking

## Data Model Changes

None — Epic 20 is frontend-only.

## API Endpoints

None — all API endpoints provided by Epics 18 and 19.

## Frontend Components

### New Components

| Component                        | Description                                              |
| -------------------------------- | -------------------------------------------------------- |
| `staffing.tsx` (rewrite)         | Main page with workspace toggle, toolbar, grid container |
| `teaching-master-grid.tsx`       | Requirement line grid with band grouping and coverage    |
| `support-admin-grid.tsx`         | Department-grouped non-teaching employee grid            |
| `staffing-settings-sheet.tsx`    | 6-tab settings sheet                                     |
| `staffing-kpi-ribbon.tsx`        | 6 KPI metrics                                            |
| `staffing-status-strip.tsx`      | Calculation status and warnings                          |
| `staffing-inspector-content.tsx` | Right panel inspector for lines and employees            |
| `auto-suggest-dialog.tsx`        | Assignment suggestion dialog with bulk actions           |

### New Stores

| Store                         | Purpose                                              |
| ----------------------------- | ---------------------------------------------------- |
| `staffing-selection-store.ts` | Tracks selected requirement line or support employee |
| `staffing-settings-store.ts`  | Settings sheet open/close state                      |

### New Hooks

| Hook File                    | Count  | Purpose                                                    |
| ---------------------------- | ------ | ---------------------------------------------------------- |
| `use-staffing.ts` (extended) | 14 new | Teaching requirements, assignments, settings, calculations |
| `use-master-data.ts` (new)   | ~5     | Service profiles, disciplines, DHG rules                   |

### Modified Components

| Component           | Changes                                            |
| ------------------- | -------------------------------------------------- |
| `employee-form.tsx` | 6 new fields, conditional visibility, vacancy mode |

## Out of Scope

- Backend API routes (Epics 18-19)
- Calculation engines (Epics 18-19)
- Data migrations (Epic 18)
- P&L integration (future epic)

## Open Questions

None — all design decisions resolved in the source plan.
