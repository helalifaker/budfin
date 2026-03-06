# BudFin UI/UX Audit Report

**Date:** 2026-03-07
**Auditor:** Claude Code
**Scope:** Full frontend against `docs/ui-ux-spec/` (spec versions 1.0, dated 2026-03-04 / 2026-03-06)
**Epic 14 Claim:** "UI/UX alignment across all modules"
**Verdict:** Epic 14 delivered partial, surface-level fixes. Core architectural gaps from the spec remain unaddressed.

---

## Executive Summary

The BudFin frontend is structurally incomplete relative to the UI/UX specification. Epic 14 appears to have fixed styling tokens (CSS variables in `index.css` are correct) and added functional components for Version Management dialogs. However, **five of six planning modules do not exist**, the **two-shell architecture is incorrectly implemented** (two isolated sidebars instead of a shared one), and **key shell features** (docked right panel, sidebar collapse, stale indicators) are missing entirely. The app as implemented cannot fulfill its core purpose of financial planning.

---

## Finding Classification

| Severity     | Meaning                                                         |
| ------------ | --------------------------------------------------------------- |
| **CRITICAL** | Core architecture/navigation broken — blocks all user workflows |
| **HIGH**     | Feature required by spec is absent or fundamentally wrong       |
| **MEDIUM**   | Spec requirement partially met — behavior or styling deviates   |
| **LOW**      | Minor polish gap — cosmetic or edge-case deviation              |

---

## Section 1: Architecture — Two-Shell Model

### CRITICAL-01: Shared Sidebar Is Not Implemented

**Spec (00b-workspace-philosophy.md §2):**

> The sidebar persists across both shells. The same sidebar renders in PlanningShell and ManagementShell. It contains: Planning group (Dashboard, Enrollment, Revenue, Staffing, P&L, Scenarios, Version Management) + Administration group (Master Data, Admin).

**Implementation:**

- `PlanningShell` has its own sidebar with 4 items: Enrollment, Staff & Positions, Budget, Reports
- `ManagementShell` has a completely separate sidebar with different nav groups and different items
- No shared sidebar component exists

**Impact:** Users navigating from a planning module to Version Management face a complete shell and sidebar switch. Navigation labels don't match spec. The sidebar is not a single unified navigation — it's two independent implementations.

**Files:** `apps/web/src/layouts/planning-shell.tsx:14-19`, `apps/web/src/layouts/management-shell.tsx:29-55`

---

### CRITICAL-02: Planning Module Routes Missing

**Spec defines these routes under PlanningShell:**

- `/planning/dashboard` — Dashboard module
- `/planning/enrollment` — Enrollment & Capacity
- `/planning/revenue` — Revenue
- `/planning/staffing` or `/planning/staff-costs` — Staffing & Staff Costs
- `/planning/pnl` — P&L & Reporting
- `/planning/scenarios` — Scenarios

**Implementation (`router.tsx`):**

```
/planning  →  PlanningLandingPage (placeholder stub)
```

Only a landing placeholder exists. **None of the six planning module pages are implemented.** The PlanningShell nav links point to routes that return a 404.

**Files:** `apps/web/src/router.tsx:86-95`, `apps/web/src/pages/planning/index.tsx`

---

### CRITICAL-03: PlanningShell Has No Docked Right Panel

**Spec (00-global-framework.md §3, 00b-workspace-philosophy.md §2):**

> PlanningShell has a docked right panel (resizable, persistent) for: Details, Activity feed, Audit, Help, CRUD forms. Planning modules use it at Level 3 of progressive disclosure.

**Implementation:**

```tsx
// planning-shell.tsx
<div className="flex-1 flex flex-col min-w-0">
    <ContextBar />
    <main className="flex-1 p-6 overflow-auto">
        <Outlet />
    </main>
</div>
```

No right panel exists. No panel state management, no resize handle, no panel tabs. All CRUD interactions in planning modules fall back to dialogs or nothing.

---

### CRITICAL-04: Version Management Route Mismatch

**Spec:** Route is `/planning/version-management` under ManagementShell.

**Implementation:** Route is `/versions` under ManagementShell.

The spec explicitly groups Version Management under the "Planning" navigation group within ManagementShell. The current route `/versions` is inconsistent with the spec and with the sidebar label "Version Management".

**File:** `apps/web/src/router.tsx:58`

---

## Section 2: Sidebar & Navigation

### HIGH-05: PlanningShell Sidebar Labels Don't Match Spec

**Spec sidebar items (Planning group):**
Dashboard, Enrollment & Capacity, Revenue, Staffing & Staff Costs, P&L & Reporting, Scenarios, Version Management

**Implemented PlanningShell nav:**
| Implemented | Spec Label | Spec Route |
|-------------|-----------|-----------|
| Enrollment | Enrollment & Capacity | `/planning/enrollment` |
| Staff & Positions | Staffing & Staff Costs | `/planning/staffing` |
| Budget | (no match — not in spec) | — |
| Reports | (maps to P&L & Reporting?) | `/planning/pnl` |

"Budget" has no spec equivalent. "Reports" loosely maps to P&L. "Dashboard" is completely absent from PlanningShell nav.

**File:** `apps/web/src/layouts/planning-shell.tsx:14-19`

---

### HIGH-06: Sidebar Cannot Collapse

**Spec (00b §4):**

> The sidebar collapses to 64px (icon-only) when the right panel opens in PlanningShell, maintaining mutual exclusion at narrow viewports. Collapse toggle persists via localStorage.

**Implementation:** Sidebar is a fixed `w-60` (240px) with no collapse affordance. No toggle button, no 64px icon-only mode, no localStorage persistence.

**File:** `apps/web/src/layouts/planning-shell.tsx:29`

---

### MEDIUM-07: ManagementShell Has Unauthorised Header Bar

**Spec:** ManagementShell has no context bar, no header. Content starts immediately below the sidebar.

**Implementation:** ManagementShell renders a white `<header>` with email, role badge, and Logout button — something absent from the spec. The PlanningShell correctly puts these in the sidebar footer, but ManagementShell has an extra header that the spec does not call for.

**File:** `apps/web/src/layouts/management-shell.tsx:106-118`

---

## Section 3: Context Bar

### HIGH-08: Context Bar Height Wrong

**Spec (00-global-framework.md §3.1):** Height: 48px (`h-12`)

**Implementation:** `h-10` (40px)

**File:** `apps/web/src/components/context-bar.tsx:59`

---

### HIGH-09: Context Bar Missing Stale Module Indicators

**Spec (00-global-framework.md §3.1.7):**

> Each module has a stale indicator in the context bar. When calculations are outdated, an amber dot appears next to the module name in the sidebar, and a banner appears in the context bar.

**Implementation:** No stale indicator logic exists anywhere in the context bar or sidebar.

---

### MEDIUM-10: Version Selector Missing Type Badge

**Spec (00-global-framework.md §3.1.2):**

> Version selector displays: `[TypeDot] Version Name (Status)` with the colored type dot matching the version type token.

**Implementation:**

```tsx
{
    v.name;
}
<span className="ml-1 text-gray-400">({v.status})</span>;
```

No colored type dot. The status text uses `text-gray-400` (plain gray) rather than the status color token.

**File:** `apps/web/src/components/context-bar.tsx:111-113`

---

### LOW-11: Fiscal Year Format Mismatch

**Spec:** `FY2026`

**Implementation:** `2025/2026` (academic year format)

**File:** `apps/web/src/components/context-bar.tsx:80`

---

## Section 4: Version Management Module

This is the most complete module. It renders in ManagementShell and has most dialog/panel scaffolding in place. Issues are mostly polish-level.

### HIGH-12: "View Details" Hidden from Editor and Viewer Roles

**Spec (02-version-management.md §5.5):**

> View Details — Always visible (all roles).

**Implementation:**

```tsx
// versions.tsx:221-243
...(canCreate
  ? [columnHelper.display({ id: 'actions', ... })]
  : [])
```

The entire actions column (including "View Details") is omitted for Editor and Viewer roles. These users cannot open the detail panel or view version metadata. This is a clear spec violation.

**File:** `apps/web/src/pages/versions/versions.tsx:221-243`

---

### HIGH-13: Clone Not Restricted — Shown for All Roles

**Spec (02-version-management.md §5.5):**

> Clone — visible only when `type != Actual AND role is Admin/BudgetOwner`

**Implementation:**

```tsx
<DropdownMenuItem onSelect={() => onClone(version)}>Clone</DropdownMenuItem>
```

Clone is shown unconditionally when the actions menu renders (which is already gated on `canCreate`). However, there is no type restriction — the menu shows Clone even for Actual-type versions. The spec requires the Clone option to be shown-but-disabled with tooltip "Actual versions cannot be cloned" for Actual rows.

**File:** `apps/web/src/pages/versions/versions.tsx:489`

---

### MEDIUM-14: Status Badge Shape Wrong

**Spec (02-version-management.md §5.4):**

> `padding: 2px 8px`, `border-radius: --radius-sm` (4px) — a rounded rectangle, not a pill.

**Implementation:** Uses `rounded-full` (full pill/circle ends).

**File:** `apps/web/src/pages/versions/versions.tsx:165`

---

### MEDIUM-15: Empty State Uses Wrong Icon

**Spec (02-version-management.md §10.1):**

> Icon: Lucide `Layers` (48px, `--text-muted`)
> Heading: "No versions for FY[year]" (`--text-lg`, `--text-secondary`)
> Description: "Create your first budget or forecast version to get started."
> Action: "Create Version" primary button (hidden for Editor/Viewer)

**Implementation:** Uses a custom inline SVG (stacked layers shape but not Lucide's `Layers`). Missing the description and "Create Version" CTA button.

**File:** `apps/web/src/pages/versions/versions.tsx:514-537`

---

### MEDIUM-16: Toolbar Not Sticky

**Spec (00-global-framework.md §4.5):**

> Module toolbar is sticky at top (position sticky, top 0, z-index toolbar).

**Implementation:** The toolbar `div` at `versions.tsx:257` uses no sticky positioning. On long lists it scrolls away.

---

### MEDIUM-17: Compare Button Missing Icon

**Spec (02-version-management.md §4):**

> Compare button: `<Button variant="outline">` with Lucide `Columns` icon.

**Implementation:** Plain text "Compare" button with no icon.

**File:** `apps/web/src/pages/versions/versions.tsx:307`

---

### LOW-18: Type Dot Colors Use Tailwind Classes Not CSS Variables

**Spec uses design tokens:** `var(--version-budget)` (#2563EB), `var(--version-actual)` (#16A34A), `var(--version-forecast)` (#EA580C).

**Implementation uses Tailwind:**

```tsx
Budget: 'bg-blue-500',    // #3B82F6 — wrong (spec: #2563EB = blue-600)
Forecast: 'bg-amber-500', // #F59E0B — wrong (spec: #EA580C = orange-600)
Actual: 'bg-green-500',   // #22C55E — wrong (spec: #16A34A = green-600)
```

All three dot colors are off by one Tailwind shade. They should use inline CSS `style={{ background: 'var(--version-budget)' }}` or the exact Tailwind equivalents (`bg-blue-600`, `bg-orange-600`, `bg-green-600`).

**File:** `apps/web/src/pages/versions/versions.tsx:59-63`

---

## Section 5: Shell Styling & Design Tokens

### MEDIUM-19: Workspace Background Uses Wrong Color

**Spec:** `--workspace-bg: #FFFFFF` (pure white).

**Implementation:** Both shells use `bg-gray-50` on the outer container div, making the workspace appear off-white (#F9FAFB) instead of white.

**Files:** `apps/web/src/layouts/planning-shell.tsx:26`, `apps/web/src/layouts/management-shell.tsx:64`

---

### MEDIUM-20: CSS Token Variables Not Applied Consistently

The design tokens in `index.css` are correctly defined and match the spec. However, components generally use Tailwind utility classes (`bg-slate-50`, `text-slate-600`) instead of the CSS variables. This creates two sources of truth and makes global theming harder.

Examples:

- Table headers: `bg-slate-50` instead of `var(--workspace-bg-subtle)`
- Table hover: `hover:bg-slate-50` instead of `var(--workspace-bg-muted)`
- Table border: `border` (default Tailwind) instead of `var(--workspace-border)`
- ManagementShell header: `border-gray-200`, `bg-gray-100`, `text-gray-700` — all raw Tailwind

---

### LOW-21: Typography Tokens Not Used

**Spec defines `--text-xs` through `--text-3xl` as CSS custom properties.** These are not defined in `index.css` — only the font-family and font-mono tokens are. The text sizes are handled purely by Tailwind (e.g., `text-sm`, `text-xs`). This is functional but means the spec's exact px sizes (`text-xs: 11px`) are not enforced; Tailwind's `text-xs` is 12px.

---

## Section 6: Missing Module Implementations

The following modules have specs but zero implementation:

| Module                  | Spec File                   | Spec Route             | Status                  |
| ----------------------- | --------------------------- | ---------------------- | ----------------------- |
| Dashboard               | `01-dashboard.md`           | `/planning/dashboard`  | **Not started**         |
| Enrollment & Capacity   | `03-enrollment-capacity.md` | `/planning/enrollment` | Nav link only, no page  |
| Revenue                 | `04-revenue.md`             | `/planning/revenue`    | Nav link only, no page  |
| Staffing & Staff Costs  | `05-staffing-costs.md`      | `/planning/staffing`   | Nav link only, no page  |
| P&L & Reporting         | `06-pnl-reporting.md`       | `/planning/pnl`        | Nav link only, no page  |
| Scenarios               | `07-scenarios.md`           | `/planning/scenarios`  | Not in nav, not started |
| Master Data (4 modules) | `08-master-data.md`         | `/master-data/*`       | Stub pages only         |

---

## Section 7: Admin Module

The Admin module (`/admin/users`, `/admin/audit`, `/admin/settings`) is correctly placed in ManagementShell with Admin-only RBAC gate. The Users page is functionally complete with CRUD side panel, role badges, status badges, and TanStack Table. Minor gaps:

### LOW-22: Admin User Table — No Search or Filter Bar

**Spec (09-admin.md):** Toolbar should include search by email and role filter.

**Implementation:** No search or filter on the Users table — just a table and "+ Add User" button.

---

### LOW-23: Audit Page Not Reviewed

The spec has a detailed Audit Trail spec (09-admin.md). The page at `apps/web/src/pages/admin/audit.tsx` exists but was not audited in detail. Noted for follow-up.

---

## Summary Table

| #   | Finding                                                                    | Severity | Module          | Status   |
| --- | -------------------------------------------------------------------------- | -------- | --------------- | -------- |
| 01  | Shared sidebar not implemented — two isolated sidebars                     | CRITICAL | Shell           | Open     |
| 02  | Five planning module pages missing                                         | CRITICAL | Planning        | Open     |
| 03  | PlanningShell docked right panel missing                                   | CRITICAL | PlanningShell   | Open     |
| 04  | Version Management route `/versions` ≠ spec `/planning/version-management` | CRITICAL | Versions        | Open     |
| 05  | PlanningShell sidebar labels wrong                                         | HIGH     | PlanningShell   | Open     |
| 06  | Sidebar collapse (64px icon-only) not implemented                          | HIGH     | Shell           | Open     |
| 07  | ManagementShell has unauthorised header bar                                | MEDIUM   | ManagementShell | Open     |
| 08  | Context bar height 40px vs spec 48px                                       | HIGH     | Context Bar     | Open     |
| 09  | Stale module indicators missing from context bar                           | HIGH     | Context Bar     | Open     |
| 10  | Version selector missing type badge dot                                    | MEDIUM   | Context Bar     | Open     |
| 11  | FY format `2025/2026` vs spec `FY2026`                                     | LOW      | Context Bar     | Open     |
| 12  | "View Details" hidden from Editor/Viewer — spec says always visible        | HIGH     | Versions        | Open     |
| 13  | Clone shown for Actual versions — should be disabled with tooltip          | HIGH     | Versions        | Open     |
| 14  | Status badge rounded-full vs spec 4px radius                               | MEDIUM   | Versions        | Open     |
| 15  | Empty state missing description and CTA button                             | MEDIUM   | Versions        | Open     |
| 16  | Module toolbar not sticky                                                  | MEDIUM   | Versions        | Open     |
| 17  | Compare button missing Columns icon                                        | MEDIUM   | Versions        | Open     |
| 18  | Type dot colors off by one Tailwind shade                                  | LOW      | Versions        | Open     |
| 19  | Workspace background `gray-50` vs spec `#FFFFFF`                           | MEDIUM   | Shell           | Open     |
| 20  | CSS token variables not applied consistently in components                 | MEDIUM   | All             | Open     |
| 21  | `--text-*` size tokens not defined in CSS                                  | LOW      | All             | Open     |
| 22  | Admin Users table missing search and role filter                           | LOW      | Admin           | Open     |
| 23  | Audit Trail page not audited                                               | —        | Admin           | Deferred |

---

## Recommended Priority Order

### P0 — Architectural (must fix before any functional work)

1. **CRITICAL-01**: Implement a single shared `<AppSidebar>` component with the full nav tree used by both shells
2. **CRITICAL-04**: Rename `/versions` route to `/planning/version-management` and fix sidebar item
3. **CRITICAL-03**: Scaffold docked right panel in PlanningShell (even empty)

### P1 — Missing modules (one-by-one, highest value first)

4. **CRITICAL-02**: Implement Dashboard module (`/planning/dashboard`)
5. Implement Enrollment & Capacity module (`/planning/enrollment`)
6. Implement Revenue module (`/planning/revenue`)

### P2 — High bugs in existing modules

7. **HIGH-12**: Show "View Details" for Editor/Viewer roles
8. **HIGH-13**: Disable Clone for Actual versions with tooltip
9. **HIGH-08/09**: Fix context bar height and add stale indicators

### P3 — Medium polish

10. Fix all MEDIUM findings (14–20) as a single polish pass
