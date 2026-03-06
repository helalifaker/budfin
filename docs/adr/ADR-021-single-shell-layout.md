# ADR-021: Single-Shell Layout

## Status

Accepted

## Date

2026-03-07

## Context

The app had two separate shell layouts — ManagementShell (for master data, versions, admin pages) and PlanningShell (for enrollment, staff, budget, reports). Navigating between them caused a full layout swap: different sidebar, different header, no shared state in the URL bar. This created a disorienting context switch and broke back-button navigation between management and planning views.

Users reported confusion about which shell they were in, and the two-shell architecture made it harder to add cross-cutting features (like a unified notification system or breadcrumbs) that need to span both contexts.

## Decision

Merge PlanningShell into ManagementShell. The sidebar now contains all navigation items (Master Data, Planning modules, Admin) in a single hierarchy. The ContextBar (fiscal year, version, period selectors) renders conditionally — only on planning routes (`/enrollment`, `/staff`, `/budget`, `/reports`) — between the header and the main content area.

Planning routes move from `/planning/enrollment` to `/enrollment` (top-level). The PlanningShell layout component and the `/planning` landing page are deleted.

## Consequences

### Positive

- Single mental model for navigation — no shell context switches
- Shared sidebar means all pages are one click away
- ContextBar appears only when relevant, reducing cognitive overhead on non-planning pages
- Simpler route tree — fewer nested layout wrappers

### Negative

- Sidebar is slightly longer with all items visible
- ContextBar conditional rendering adds a `useLocation()` check in ManagementShell

### Neutral

- Route paths change from `/planning/enrollment` to `/enrollment` — existing bookmarks would break (acceptable since app is pre-release)
