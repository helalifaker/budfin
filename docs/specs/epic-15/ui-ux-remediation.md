# Epic 15: UI/UX Clean-Slate Rewrite

**Epic:** #114
**Date:** 2026-03-07
**Status:** Draft
**Predecessor:** Epic 14 (PR #76) -- partial fixes, audit found 23 gaps

---

## 1. Overview

Complete rewrite of the BudFin frontend visual layer to achieve full parity with the
UI/UX specification (`docs/ui-ux-spec/`). Preserves all business logic (hooks, auth store,
lib utilities) while replacing every layout, component, and page file.

### Design References

| Document                | Path                                                |
| ----------------------- | --------------------------------------------------- |
| Global framework        | `docs/ui-ux-spec/00-global-framework.md`            |
| Workspace philosophy    | `docs/ui-ux-spec/00b-workspace-philosophy.md`       |
| Dashboard               | `docs/ui-ux-spec/01-dashboard.md`                   |
| Version Management      | `docs/ui-ux-spec/02-version-management.md`          |
| Enrollment & Capacity   | `docs/ui-ux-spec/03-enrollment-capacity.md`         |
| Revenue                 | `docs/ui-ux-spec/04-revenue.md`                     |
| Staffing & Staff Costs  | `docs/ui-ux-spec/05-staffing-costs.md`              |
| P&L & Reporting         | `docs/ui-ux-spec/06-pnl-reporting.md`               |
| Scenarios               | `docs/ui-ux-spec/07-scenarios.md`                   |
| Master Data             | `docs/ui-ux-spec/08-master-data.md`                 |
| Admin                   | `docs/ui-ux-spec/09-admin.md`                       |
| Input Management        | `docs/ui-ux-spec/10-input-management.md`            |
| Remediation design plan | `docs/plans/2026-03-07-ui-ux-remediation-design.md` |
| Audit report            | `docs/plans/2026-03-07-ui-ux-audit-report.md`       |

---

## 2. Scope

### 2.1 Preserved (business logic -- NOT rewritten)

- `hooks/` -- all data-fetching and mutation hooks
- `stores/auth-store.ts` -- auth state + JWT handling
- `lib/api-client.ts` -- HTTP client with auth headers
- `lib/cn.ts` -- clsx + tailwind-merge utility
- `lib/format-date.ts` -- date formatting

### 2.2 Rewritten (visual layer)

- `index.css` -- design tokens, animation keyframes, font imports
- `router.tsx` -- two-shell route structure
- `layouts/*` -- all layout components
- `components/ui/*` -- all shadcn/ui components re-styled
- `components/shell/*` -- all shell components (new directory)
- `components/data-grid/*` -- reusable grid system (new directory)
- `components/shared/*` -- animation/empty/error components (new directory)
- `components/dashboard/*` -- dashboard components (new directory)
- `pages/*` -- all page components

### 2.3 New additions

- `stores/sidebar-store.ts` -- sidebar collapsed/expanded state
- `stores/right-panel-store.ts` -- right panel state, width, tab
- `stores/ui-store.ts` -- toast queue, dialog state
- `@fontsource-variable/dm-sans` -- font package
- `@fontsource-variable/plus-jakarta-sans` -- font package
- `geist/font/mono` -- monospace font package

---

## 3. Design System

Full design system defined in `docs/plans/2026-03-07-ui-ux-remediation-design.md` Section 2:

- **Color palette:** Brand teal (#14B8A6 family), sidebar dark carbon, workspace light, semantic colors, version type colors, status colors, editable cell colors
- **Typography:** DM Sans Variable (primary), Plus Jakarta Sans Variable (headings), Geist Mono (numeric), 8 size tokens (11px-36px)
- **Shadows:** 6 levels (xs through lg + sidebar + glow-accent)
- **Animation tokens:** 4 easing curves, 5 duration levels, stagger delay
- **Border radii:** 6 levels (none through 2xl)
- **Spacing:** 4px grid (space-1 through space-10)

All tokens defined as CSS custom properties in `index.css`. Components MUST use CSS variables (not raw Tailwind classes) for themed values.

---

## 4. Architecture

### 4.1 Two-shell model

```
/login                          -> LoginPage (public)

RootLayout (Sidebar + Outlet)
+-- PlanningShell (ContextBar + RightPanel + Outlet)
|   +-- /planning               -> DashboardPage
|   +-- /planning/enrollment    -> EnrollmentPage
|   +-- /planning/revenue       -> PlaceholderPage
|   +-- /planning/staffing      -> PlaceholderPage
|   +-- /planning/pnl           -> PlaceholderPage
|   +-- /planning/scenarios     -> PlaceholderPage
|
+-- ManagementShell (Toolbar + Outlet)
    +-- /management/versions    -> VersionsPage
    +-- /management/fiscal-periods -> FiscalPeriodsPage
    +-- /master-data/accounts   -> AccountsPage
    +-- /master-data/academic   -> AcademicPage
    +-- /master-data/reference  -> ReferencePage
    +-- /master-data/assumptions -> AssumptionsPage
    +-- /admin/users            -> UsersPage (Admin)
    +-- /admin/audit            -> AuditPage (Admin)
    +-- /admin/settings         -> SettingsPage (Admin)
```

### 4.2 Sidebar

- Single shared component rendered in `RootLayout`
- Expanded: 240px with labels, groups, user info
- Collapsed: 64px icon-only with tooltips
- Smart auto-collapse: right panel open -> sidebar collapses
- Mutual exclusion: re-expand sidebar -> right panel closes
- Collapse state persisted via localStorage

### 4.3 PlanningShell

- Context bar (56px, frosted glass): breadcrumb, FY/version/compare/period selectors, save/stale indicators
- Module toolbar (48px): title, filters, action buttons
- Workspace content (flex:1, min 480px): slide-up animation on module switch
- Docked right panel (280px-50%, default 400px): resizable, tabs (Details, Activity, Audit, Help, Form)

### 4.4 ManagementShell

- Module toolbar (48px): title, search, filters, action buttons
- Workspace content (full width)
- Overlay side panel (480px, z-30) for CRUD forms -- not docked

---

## 5. Acceptance Criteria

### 5.1 Architecture (CRITICAL -- from audit)

- [ ] AC-01: Single shared sidebar component used by both shells
- [ ] AC-02: All 6 planning module routes exist and render correct pages
- [ ] AC-03: PlanningShell has docked, resizable right panel
- [ ] AC-04: Version Management uses correct route under ManagementShell

### 5.2 Design System

- [ ] AC-05: All color tokens from Section 2.1 defined as CSS custom properties in `index.css`
- [ ] AC-06: DM Sans Variable, Plus Jakarta Sans Variable, and Geist Mono fonts installed and applied
- [ ] AC-07: Typography tokens (11px-36px) enforced via CSS custom properties
- [ ] AC-08: Shadow, animation, radius, and spacing tokens defined and used consistently
- [ ] AC-09: Components use CSS variables for themed values, not raw Tailwind classes

### 5.3 Shell Features

- [ ] AC-10: Sidebar collapses to 64px icon-only mode with toggle
- [ ] AC-11: Sidebar collapse state persisted in localStorage
- [ ] AC-12: Smart auto-collapse: right panel open triggers sidebar collapse
- [ ] AC-13: Context bar displays breadcrumb, FY selector, version selector with type dot
- [ ] AC-14: Stale module indicators present in context bar and sidebar
- [ ] AC-15: Save indicator animates on save/unsaved state
- [ ] AC-16: Module toolbar sticky at top of content area

### 5.4 Pages

- [ ] AC-17: Login page renders animated mesh gradient + glassmorphic card
- [ ] AC-18: Dashboard renders KPI cards with counter roll-up and chart cards
- [ ] AC-19: Enrollment page renders band filters, tabs, data grid, CSV import panel
- [ ] AC-20: Version Management page renders filter bar, data table, lifecycle dialogs
- [ ] AC-21: Master Data pages (4) render with ManagementShell + CRUD side panels
- [ ] AC-22: Admin pages (3) render with correct RBAC gates
- [ ] AC-23: Placeholder pages render centered empty state with "Coming soon" shimmer

### 5.5 Data Grid

- [ ] AC-24: Row hover: smooth bg transition + faint teal left border
- [ ] AC-25: Cell focus: teal border + glow shadow
- [ ] AC-26: Edit mode: cell bg transitions to white, scale-up, input auto-focused
- [ ] AC-27: Save on blur: green checkmark animation
- [ ] AC-28: Validation error: red border + horizontal shake
- [ ] AC-29: Expandable groups: chevron rotation + child row slide-down

### 5.6 Animations (30+ points)

- [ ] AC-30: Page transitions: slide-up animation
- [ ] AC-31: Loading: diagonal shimmer skeletons + staggered reveal
- [ ] AC-32: Sidebar expand/collapse choreography (width, labels, chevron)
- [ ] AC-33: Right panel slide-in/out with workspace resize
- [ ] AC-34: Toast enter/stack/dismiss animations
- [ ] AC-35: Empty state entrance animation

### 5.7 Quality Gates

- [ ] AC-36: `pnpm typecheck` passes with zero errors
- [ ] AC-37: `pnpm lint` passes with zero errors
- [ ] AC-38: `pnpm test` passes with existing test coverage maintained
- [ ] AC-39: No accessibility regressions (semantic HTML, keyboard nav, contrast ratios)

### 5.8 Version Management Fixes (from audit)

- [ ] AC-40: "View Details" visible for all roles (not just Admin/BudgetOwner)
- [ ] AC-41: Clone disabled for Actual versions with tooltip
- [ ] AC-42: Status badge uses `--radius-sm` (not `rounded-full`)
- [ ] AC-43: Empty state uses Lucide `Layers` icon with description and CTA
- [ ] AC-44: Type dot colors use CSS variables (not raw Tailwind shades)

---

## 6. Story Decomposition (4 Waves)

### Wave 1: Design System Foundation (4 stories)

| #   | Story                                                                                                      | Dependencies |
| --- | ---------------------------------------------------------------------------------------------------------- | ------------ |
| 1   | Design tokens + fonts in `index.css`                                                                       | None         |
| 2   | Core UI components (Button, Input, Select, Tabs, Dialog, AlertDialog, DropdownMenu, Sheet, Skeleton, Card) | Story 1      |
| 3   | Toast system (toast component + toast-state + ToggleGroup)                                                 | Story 1      |
| 4   | Shared components (EmptyState, ErrorState, PageTransition, StaggerList, Counter, AnimatedGradient)         | Story 1      |

### Wave 2: Shell Architecture (5 stories)

| #   | Story                                                                                            | Dependencies    |
| --- | ------------------------------------------------------------------------------------------------ | --------------- |
| 5   | Zustand stores (sidebar-store, right-panel-store, ui-store)                                      | None            |
| 6   | Router restructure (two-shell routing)                                                           | Story 5         |
| 7   | Sidebar component (expanded/collapsed, nav items, auto-collapse)                                 | Stories 1, 5    |
| 8   | PlanningShell (ContextBar, Breadcrumb, RightPanel, ModuleToolbar, SaveIndicator, StaleIndicator) | Stories 5, 6, 7 |
| 9   | ManagementShell (toolbar + overlay panel pattern)                                                | Stories 5, 6, 7 |

### Wave 3: Pages (6 stories)

| #   | Story                                                                                    | Dependencies       |
| --- | ---------------------------------------------------------------------------------------- | ------------------ |
| 10  | Login page (animated mesh gradient + glassmorphic card)                                  | Stories 1, 4       |
| 11  | Dashboard page (KPI cards + chart cards)                                                 | Stories 1, 2, 4, 8 |
| 12  | Enrollment page (band filters, tabs, data grid, CSV import panel)                        | Stories 1, 2, 8    |
| 13  | Version Management page rewrite (filter bar, data table, lifecycle dialogs, audit fixes) | Stories 1, 2, 9    |
| 14  | Master Data pages (Accounts, Academic, Reference, Assumptions)                           | Stories 1, 2, 9    |
| 15  | Admin pages (Users, Audit, Settings) + Placeholder pages                                 | Stories 1, 2, 4, 9 |

### Wave 4: Polish & Integration (3 stories)

| #   | Story                                                                                  | Dependencies       |
| --- | -------------------------------------------------------------------------------------- | ------------------ |
| 16  | Animation choreography (page transitions, loading sequences, staggered reveals)        | All Wave 3         |
| 17  | Data grid micro-interactions (hover, focus, edit, save, validation, selection, expand) | Stories 12, 13, 14 |
| 18  | Integration testing + visual regression verification                                   | All stories        |

---

## 7. Preserved vs Rewritten (Full Inventory)

See `docs/plans/2026-03-07-ui-ux-remediation-design.md` Section 8 for the complete list.

---

## 8. Risk Mitigation

| Risk                                     | Mitigation                                                               |
| ---------------------------------------- | ------------------------------------------------------------------------ |
| Breaking existing hooks/API integration  | Preserved files are never modified; new pages import them unchanged      |
| Animation performance on low-end devices | Use CSS transforms/opacity only (GPU-composited); avoid layout thrashing |
| Design token drift                       | Single source of truth in `index.css`; components reference variables    |
| Route changes break bookmarks            | Old routes redirect to new equivalents                                   |
| Scope creep into backend                 | This epic is frontend-only; no API or Prisma changes                     |
