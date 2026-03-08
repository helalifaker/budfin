# Version Management Module Redesign

**Date**: 2026-03-08
**Status**: Design approved, pending implementation
**Epic**: Epic 10 (Version Management) — refactoring pass

## Problem Statement

The Version Management page is functionally complete but has significant UX gaps:

1. Heavy context bar confuses users; changing FY resets version selection
2. No cross-year visibility — versions locked to single FY
3. Actuals handling is unclear — no import metadata, no visual distinction
4. Comparison limited to 2 versions, tabular only, navigates away
5. No cross-year cloning in UI (backend supports it)
6. RBAC mismatch: BudgetOwner sees Lock but gets 403
7. Duplicate dead code in `pages/versions/`

## Design Decisions

- **Layout**: Full-width TanStack Table + right slide panel (520px)
- **Filters**: Inline filter bar replacing context bar; "All Years" option
- **FY column**: Always visible in table
- **Detail panel**: 3 tabs (Overview, Lifecycle, Data)
- **Comparison**: Inline checkbox selection (2-3 versions), charts + table below
- **Charts**: recharts (already installed) — bar + line charts
- **Cross-year clone**: Target FY selector + data rollover checkboxes
- **Actuals**: Visual green accent, import log in Data tab
- **AY mapping**: Visual display of AY1 (Jan-Jun) + Gap (Jul-Aug) + AY2 (Sep-Dec)
- **State**: New Zustand store for page state (filters, compare mode, selection)
- **No schema changes**: All changes are API + frontend only

## Implementation Plan

See `.claude/plans/tidy-moseying-star.md` for the detailed 5-phase implementation plan.

## Key Files

| Area            | File                                                        |
| --------------- | ----------------------------------------------------------- |
| Backend routes  | `apps/api/src/routes/versions.ts`                           |
| Frontend page   | `apps/web/src/pages/management/versions.tsx`                |
| Hooks           | `apps/web/src/hooks/use-versions.ts`                        |
| Detail panel    | `apps/web/src/components/versions/version-detail-panel.tsx` |
| Clone dialog    | `apps/web/src/components/versions/clone-version-dialog.tsx` |
| Create panel    | `apps/web/src/components/versions/create-version-panel.tsx` |
| New: Store      | `apps/web/src/stores/version-page-store.ts`                 |
| New: Comparison | `apps/web/src/components/versions/comparison-*.tsx`         |
