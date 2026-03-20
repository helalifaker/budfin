# ADR-032: Staffing Settings — Dialog with Sidebar Navigation over Sheet

> Date: 2026-03-19 | Status: Accepted | Deciders: BudFin Engineering

## Context

The Staffing settings surface (introduced in Epics 18-19) used a Radix `Sheet` component: a
slide-out panel anchored to the right edge of the screen with 5-6 tabs rendered as a horizontal
`TabsList` at the top. This worked adequately when the settings surface was a secondary concern,
but the Epic 20 redesign exposed three concrete problems:

1. **Horizontal tab overflow**: Six tabs in a Sheet did not fit at common viewport widths without
   truncation or wrapping. Adding the Lycee Groups tab (conditionally shown) made the tab bar
   unpredictable.

2. **Lack of readiness signalling**: Budget planners need to see at a glance which settings
   sections are configured (non-empty) and which have unsaved changes. A flat horizontal tab bar
   has no room for per-tab indicators beyond a notification dot.

3. **Width constraint**: The Sheet's width is bounded by a percentage of the viewport. The Cost
   Assumptions and DHG Rules tables need horizontal scrolling within the Sheet, degrading
   usability on smaller screens.

## Decision

Replace `StaffingSettingsSheet` (Radix `Sheet`) with `StaffingSettingsDialog` (Radix `Dialog`)
using a two-column layout: a fixed 256 px left sidebar listing all sections as `<button>` items,
and a flex-1 content area that renders the active section.

The dialog opens at 90 vh × 90 vw, giving ample room for tabular content. Each sidebar item
carries two status indicators: an orange dot for unsaved changes and a green/grey dot for
readiness (whether the section has been configured). Unsaved-change guards prevent accidental
tab switches and dialog closes with a confirmation prompt.

The sidebar navigation pattern replaces horizontal `TabsList` for settings surfaces with more
than four sections or where per-section status indicators are needed.

## Consequences

### Positive

- All six settings sections fit in the sidebar without overflow at any supported viewport width.
- Readiness and dirty-state indicators are visible for every section simultaneously, reducing
  the chance a planner saves and recalculates without noticing an unconfigured cost assumption.
- The 90 vw content area eliminates horizontal scrolling on DHG Rules and Cost Assumptions
  tables at 1280 px viewport width and above.
- The unsaved-change guard (prompt on tab switch and close) prevents data loss from accidental
  navigation.

### Negative

- The Dialog renders outside the normal document flow; keyboard focus trapping is handled by
  Radix Dialog's built-in `FocusTrap`. This is correct behaviour but developers must not add
  additional focus management inside the dialog.
- The dialog occupies 90 vh, which may feel heavy on small laptop screens. Mitigated by the
  fact that the settings surface is an infrequent, intentional action (not a quick edit).

### Neutral

- `StaffingSettingsSheet` (`staffing-settings-sheet.tsx`) is deleted. Its state management
  was migrated to `staffing-settings-dialog-store.ts` (Zustand) with a separate
  `staffing-settings-dirty-store.ts` for per-tab dirty tracking.
- The `StaffingSettingsSheet` tests are superseded by tests against the Dialog equivalent.

## Alternatives Considered

| Option                                             | Why Rejected                                                                                                                                                               |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Keep Sheet, use vertical tab list inside           | Sheet width cap means the tab list would consume too much of the already-limited horizontal space, leaving little room for content.                                        |
| Sheet with scrollable horizontal tabs              | Horizontal scrolling on a tab bar is not accessible and violates WCAG 2.1 SC 1.4.10 (Reflow).                                                                              |
| Separate route for settings (`/staffing/settings`) | A full navigation away from the Staffing page loses the in-context workflow benefit. The planner needs to switch between settings and the grid without losing their place. |
| Multi-step wizard (drawer pattern)                 | Appropriate for first-time onboarding but wrong for repeat configuration; planners need random access to any section.                                                      |

## References

- `apps/web/src/components/staffing/staffing-settings-dialog.tsx` — implementation
- `apps/web/src/stores/staffing-settings-dialog-store.ts` — open/close/tab state
- `apps/web/src/stores/staffing-settings-dirty-store.ts` — per-tab dirty tracking
- ADR-023: Two-Shell Layout — established that settings surfaces in PlanningShell are overlays
- Epic 20, Story #240 — staffing 4-tab pipeline PR
