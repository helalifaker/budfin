# ADR-024: Continuous Planning Board Layout Pattern

> Date: 2026-03-08 | Status: Accepted | Deciders: Engineering team

## Context

BudFin's Enrollment and Revenue planning pages used a tabbed layout where each data view (By Grade, By Nationality, By Tariff, Capacity) occupied a full-page tab. This design forced users to context-switch between tabs to see related data, hiding the cause-and-effect relationship between input changes and downstream impacts.

Professional FP&A tools (Pigment, Anaplan, Adaptive Insights) use a "Continuous Board" pattern: vertically stacked grid blocks on a single scrollable canvas where drivers (inputs) sit above outputs, so users see the immediate impact of their changes without navigation.

The Excel workbook that BudFin replaces uses the same mental model -- headcount inputs sit above capacity outputs on the same sheet.

Additionally, the previous Enrollment page contained tariff distribution logic (`ByTariffGrid`) that belongs to the Revenue domain. Demographics planning (students and classrooms) was conflated with financial planning (pricing and discounts).

## Decision

Adopt a "Continuous Planning Board" layout pattern for all planning workspace pages, implemented via two shared components:

- **WorkspaceBoard** -- page-level container with a sticky KPI ribbon and action toolbar.
- **WorkspaceBlock** -- collapsible section with a title, item count badge, and stale-data indicator.

Planning pages stack multiple WorkspaceBlock sections vertically on a single scrolling canvas instead of hiding them behind tabs. The enrollment page uses three blocks (Cohort Progression, Nationality Distribution, Capacity Planning). The revenue page uses six blocks (Tariff Assignment, Fee Grid, Discounts, Other Revenue, Revenue Engine, Executive Summary).

Tariff assignment was moved from the Enrollment page to the Revenue page, enforcing a clean domain boundary: Enrollment handles demographics and capacity; Revenue handles pricing and income.

## Consequences

### Positive

- Users see input-to-output relationships without navigating away (e.g., changing a headcount immediately shows capacity impact below)
- Domain separation between Enrollment (demographics) and Revenue (financial) aligns with the Excel workbook structure EFIR staff already understand
- Sticky KPI ribbon provides persistent context on key metrics during scrolling
- Collapsible blocks allow users to hide sections they are not actively editing
- Reusable WorkspaceBoard and WorkspaceBlock components enforce consistent layout across all future planning pages (Staffing, P&L)

### Negative

- Longer page scroll compared to tabs -- mitigated by collapsible blocks and sticky KPI ribbon
- Multiple TanStack Table instances on one page increase DOM node count -- acceptable per ADR-016 (under 300 rows per grid in v1)

### Neutral

- Each WorkspaceBlock is independently collapsible, so users can approximate the old tabbed experience by collapsing all but one section
- The pattern applies to planning pages only; management pages retain their existing overlay-panel approach (ADR-023)

## Alternatives Considered

| Option                                            | Why Rejected                                                                                                      |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Keep tabbed layout with side-by-side preview pane | Still hides the full grid context; preview pane too narrow for 15-grade tables                                    |
| Nested sidebar navigation within the page         | Conflicts with the main app sidebar; creates navigation confusion (the refactoring plan explicitly rejected this) |
| Dashboard-style cards with drill-down             | Too many clicks to reach editable data; not suitable for data-entry workflows                                     |

## References

- `docs/plans/2026-03-08-enrollment-workspace-refactoring.md` -- analysis and ASCII mockups
- `docs/plans/2026-03-08-revenue-workspace-refactoring.md` -- revenue board analysis
- `apps/web/src/components/shared/workspace-board.tsx` -- WorkspaceBoard component
- `apps/web/src/components/shared/workspace-block.tsx` -- WorkspaceBlock component
- ADR-023 (Two-Shell Layout) -- planning pages use PlanningShell; management pages use ManagementShell
