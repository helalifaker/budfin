# BudFin UI/UX Specification: Workspace Philosophy

> **Document Version:** 1.0
> **Date:** March 6, 2026
> **Status:** Draft
> **Scope:** Principles that govern the BudFin workspace paradigm. Read this before implementing any module.

---

## 1. Workspace-First Design

BudFin is a single-page application. Every interaction happens within a persistent workspace. Users never leave the app shell -- they navigate between modules, open panels, and edit inline.

**Core constraint:** Users work with financial data for extended sessions (1-4 hours). The UI must minimize context switches and preserve working state across navigation.

---

## 2. Two-Shell Architecture

BudFin separates modules into two shells based on their relationship to planning context:

| Shell           | Purpose                                    | Context Bar | Right Panel              | Modules                                                  |
| --------------- | ------------------------------------------ | ----------- | ------------------------ | -------------------------------------------------------- |
| PlanningShell   | Financial planning with version/FY context | Yes         | Yes (docked, resizable)  | Dashboard, Enrollment, Revenue, Staffing, P&L, Scenarios |
| ManagementShell | CRUD administration and configuration      | No          | No (overlay panels only) | Version Management, Master Data (4), Admin (3)           |

**Why two shells?** Planning modules require persistent fiscal year, version, period, and scenario context. Management modules (reference data, user admin) are version-independent and do not benefit from -- and are visually cluttered by -- the context bar.

---

## 3. Progressive Disclosure

Information and controls are revealed in layers, from least to most disruptive:

```text
Level 1: Module Toolbar
  Filters, search, primary actions (Calculate, Export)
  Always visible. Zero cost to access.

Level 2: Inline Editing
  Double-click or Enter on grid cells.
  Data stays in context. No panel or dialog.

Level 3: Docked Right Panel (PlanningShell)
  Details, activity feed, audit, help, CRUD forms.
  Shifts content but preserves layout. Resizable. Persistent.

Level 4: Overlay Side Panel (ManagementShell / utility)
  480px slide-in for CRUD forms, import wizards.
  Overlays content. Temporary. Close to dismiss.

Level 5: Dialog
  Confirmations, destructive actions, version comparison selection.
  Modal. Blocks interaction. Use sparingly.
```

### Decision Tree: Where Does This UI Go?

```text
Is it a filter, search, or primary action?
  YES -> Module Toolbar (Level 1)

Is it data entry on an existing record?
  YES -> Inline edit in the grid (Level 2)

Is it contextual info about the current view (details, audit, help)?
  YES -> Docked Right Panel tab (Level 3, PlanningShell only)

Is it a CRUD form (create/edit a record)?
  IN PLANNING MODULE -> Right Panel "Form" tab (Level 3)
  IN MANAGEMENT MODULE -> Overlay Side Panel (Level 4)

Is it a destructive action requiring confirmation?
  YES -> Dialog (Level 5)

Is it a multi-step wizard (import, comparison setup)?
  YES -> Dialog or Overlay Side Panel (Level 4-5)
```

---

## 4. Persistent Context

### PlanningShell Context

The context bar maintains five dimensions of planning context:

1. **Fiscal Year** -- which year's data is displayed
2. **Version** -- which budget/forecast/actual version
3. **Comparison** -- optional second version for variance analysis
4. **Period** -- AY1, AY2, Summer, or Full Year
5. **Scenario** -- Base, Optimistic, or Pessimistic

These persist across module navigation within PlanningShell. Changing any dimension triggers a data refresh in the active module.

### Sidebar Context

The sidebar provides navigation and is shared across both shells. It collapses to 64px (icon-only) when the right panel opens in PlanningShell, maintaining mutual exclusion at narrow viewports.

### URL Context

All context bar state is reflected in URL search params for deep linking:
`/planning/revenue?fy=2026&version=42&compare=38&period=full&scenario=base`

ManagementShell modules use only module-specific params (e.g., `?fy=2026` for Version Management).

---

## 5. Inline-First Editing

BudFin prioritizes inline editing over form-based editing:

- **Planning grids** (Enrollment, Revenue, Staffing): Double-click or Enter to edit cells directly in the grid. Changes auto-save on blur or 30-second intervals.
- **Assumptions & Parameters**: Single-click to edit values in the key-value table.
- **Master Data CRUD**: Side panel forms for create/edit (too many fields for inline).

### Why Inline-First?

Financial planners iterate rapidly. Opening a form panel to change a single headcount value disrupts flow. Inline editing keeps the user in the grid context, seeing the impact of changes on calculated columns immediately.

### When NOT to Use Inline Editing

- Record creation (too many required fields)
- Complex validation with cross-field dependencies
- Destructive actions requiring confirmation

---

## 6. SPA Transitions

All module navigation is client-side. No full page reloads.

| Navigation                            | Behavior                                                              |
| ------------------------------------- | --------------------------------------------------------------------- |
| Sidebar click                         | React Router navigation. Pending changes auto-save before transition. |
| Context bar change (FY, version)      | Data refresh via TanStack Query. No route change.                     |
| Panel open/close                      | CSS transition (200ms ease-in-out). No route change.                  |
| Shell switch (Planning -> Management) | React Router navigation. Context bar unmounts. Sidebar persists.      |

**Transition guarantee:** No user data is lost during navigation. Auto-save fires before every route change. If save fails, a confirmation dialog appears: "You have unsaved changes. Discard?"
