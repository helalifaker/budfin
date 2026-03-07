# ADR-023: Restore Two-Shell Layout Architecture

## Status

Accepted

## Date

2026-03-07

## Context

ADR-021 merged PlanningShell and ManagementShell into a single unified shell. While this simplified navigation, it created two problems during the Epic 15 UI/UX rewrite:

1. **Context bar clutter** — The fiscal year / version / period selectors (ContextBar) are irrelevant on admin and master data pages, yet the conditional rendering logic added complexity to the single shell.
2. **Panel model mismatch** — Planning pages need a persistent, docked right panel (Details / Activity / Audit / Help tabs) that coexists with the data grid. Management pages need modal overlay panels (side panels for create/edit forms, alert dialogs for delete confirmation). Cramming both panel models into one shell led to layout conflicts and z-index issues.

## Decision

Restore two dedicated shell layouts:

- **PlanningShell** — Used by budget planning routes (`/enrollment`, `/staff`, `/budget`, `/reports`). Includes the ContextBar (fiscal year, version, period selectors) and a resizable docked RightPanel.
- **ManagementShell** — Used by master data, admin, and version management routes. Includes a ModuleToolbar for page-level actions. Panels are rendered as overlays (side panels, dialogs) within individual pages.

Both shells share the same Sidebar and RootLayout. The router nests planning routes under a `<PlanningShell />` layout element and management routes under a `<ManagementShell />` layout element.

## Consequences

### Positive

- Each shell is optimised for its page type — no conditional rendering for features that only apply to one context
- Panel behaviour is predictable: docked in planning, overlay in management
- Easier to add planning-specific features (stale indicators, save indicators) without affecting management pages

### Negative

- Two layout components to maintain instead of one
- Adding a new route requires choosing the correct shell parent

### Neutral

- Route paths remain unchanged from ADR-021 (`/enrollment`, not `/planning/enrollment`)
- Supersedes ADR-021
