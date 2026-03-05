# BudFin UI/UX Specification: Global Framework

> **Document Version:** 1.0
> **Date:** March 4, 2026
> **Status:** Draft
> **Scope:** Developer-focused UI specification for the BudFin frontend shell, shared components, and interaction patterns.
> **Visual Direction:** Pigment-like modern financial planning tool. Each module is a self-contained workspace. Dark collapsible sidebar, light workspace area, inline editing everywhere, full spreadsheet-like keyboard navigation.

---

## 1. Design Tokens

### 1.1 Color Palette

#### Sidebar (Dark Theme)

| Token | Value | Usage |
| --- | --- | --- |
| `--sidebar-bg` | `#0F172A` | Sidebar background (slate-900) |
| `--sidebar-bg-hover` | `#1E293B` | Sidebar item hover (slate-800) |
| `--sidebar-bg-active` | `#1E40AF` | Active nav item background (blue-800) |
| `--sidebar-text` | `#CBD5E1` | Sidebar text (slate-300) |
| `--sidebar-text-active` | `#FFFFFF` | Active nav item text |
| `--sidebar-icon` | `#94A3B8` | Sidebar icon default (slate-400) |
| `--sidebar-icon-active` | `#FFFFFF` | Active nav icon |
| `--sidebar-border` | `#334155` | Sidebar dividers (slate-700) |

#### Workspace (Light Theme)

| Token | Value | Usage |
| --- | --- | --- |
| `--workspace-bg` | `#FFFFFF` | Main workspace background |
| `--workspace-bg-subtle` | `#F8FAFC` | Alternate row background (slate-50) |
| `--workspace-bg-muted` | `#F1F5F9` | Section headers, context bar background (slate-100) |
| `--workspace-border` | `#E2E8F0` | Grid borders, dividers (slate-200) |
| `--workspace-border-strong` | `#CBD5E1` | Focused cell border (slate-300) |
| `--text-primary` | `#0F172A` | Primary text (slate-900) |
| `--text-secondary` | `#475569` | Secondary text, labels (slate-600) |
| `--text-muted` | `#94A3B8` | Placeholder text (slate-400) |

#### Version Type Colors

| Token | Value | Type | Usage |
| --- | --- | --- | --- |
| `--version-budget` | `#2563EB` | Budget | Badges, column highlights, row tints in comparison mode (blue-600) |
| `--version-budget-bg` | `#DBEAFE` | Budget | Light background tint (blue-100) |
| `--version-actual` | `#16A34A` | Actual | Badges, column highlights (green-600) |
| `--version-actual-bg` | `#DCFCE7` | Actual | Light background tint (green-100) |
| `--version-forecast` | `#EA580C` | Forecast | Badges, column highlights (orange-600) |
| `--version-forecast-bg` | `#FFF7ED` | Forecast | Light background tint (orange-50) |

#### Status Colors

| Token | Value | Status | Usage |
| --- | --- | --- | --- |
| `--status-draft` | `#6B7280` | Draft | Status badge (gray-500) |
| `--status-published` | `#2563EB` | Published | Status badge (blue-600) |
| `--status-locked` | `#7C3AED` | Locked | Status badge (violet-600) |
| `--status-archived` | `#9CA3AF` | Archived | Status badge (gray-400) |

#### Semantic Colors

| Token | Value | Usage |
| --- | --- | --- |
| `--color-success` | `#16A34A` | Favorable variance, success states (green-600) |
| `--color-success-bg` | `#F0FDF4` | Success background (green-50) |
| `--color-warning` | `#D97706` | Near-cap alerts, stale indicators (amber-600) |
| `--color-warning-bg` | `#FFFBEB` | Warning background (amber-50) |
| `--color-error` | `#DC2626` | Unfavorable variance, over-capacity, validation errors (red-600) |
| `--color-error-bg` | `#FEF2F2` | Error background (red-50) |
| `--color-info` | `#2563EB` | Information indicators (blue-600) |
| `--color-info-bg` | `#EFF6FF` | Info background (blue-50) |
| `--color-stale` | `#F59E0B` | Stale calculation indicator (amber-500) |

#### Editable Cell Highlight

| Token | Value | Usage |
| --- | --- | --- |
| `--cell-editable-bg` | `#FEFCE8` | Editable cell background (yellow-50) — matches PRD FR-INP-002 |
| `--cell-editable-focus` | `#2563EB` | Focused editable cell border (blue-600) |
| `--cell-readonly-bg` | `#F8FAFC` | Read-only cell background (slate-50) |
| `--cell-error-border` | `#DC2626` | Validation error cell border (red-600) |

### 1.2 Typography

All typography uses the system font stack for optimal rendering performance on desktop.

| Token | Font | Size | Weight | Line Height | Usage |
| --- | --- | --- | --- | --- | --- |
| `--font-family` | `Inter, system-ui, -apple-system, sans-serif` | — | — | — | Primary font family |
| `--font-mono` | `JetBrains Mono, ui-monospace, monospace` | — | — | — | Numeric values in grids |
| `--text-xs` | — | 11px | 400 | 16px | Grid cell values, metadata |
| `--text-sm` | — | 13px | 400 | 20px | Default body text, form labels |
| `--text-base` | — | 14px | 400 | 22px | Module toolbar text, buttons |
| `--text-lg` | — | 16px | 600 | 24px | Section headers within modules |
| `--text-xl` | — | 18px | 600 | 28px | Module page titles |
| `--text-2xl` | — | 24px | 700 | 32px | KPI card values |
| `--text-3xl` | — | 30px | 700 | 36px | Dashboard hero metric |

**Numeric display rules:**
- All monetary values use `--font-mono` with right-alignment
- Monetary values display 2 decimal places with thousands separator: `42,350.00`
- Percentages display 1 decimal place: `85.3%`
- Headcounts display as integers with no decimals: `1,523`
- Negative values shown in `--color-error` with parentheses: `(1,250.00)`

### 1.3 Spacing Scale

Based on a 4px grid system.

| Token | Value | Usage |
| --- | --- | --- |
| `--space-0` | 0px | No spacing |
| `--space-1` | 4px | Tight inline spacing (icon-to-text gap) |
| `--space-2` | 8px | Grid cell padding, compact list items |
| `--space-3` | 12px | Form field padding, button padding |
| `--space-4` | 16px | Section padding, card padding |
| `--space-5` | 20px | Module header padding |
| `--space-6` | 24px | Section gap within modules |
| `--space-8` | 32px | Module content margin, large section gap |
| `--space-10` | 40px | Page-level vertical spacing |

### 1.4 Border Radii

| Token | Value | Usage |
| --- | --- | --- |
| `--radius-none` | 0px | Data grid cells |
| `--radius-sm` | 4px | Badges, small buttons |
| `--radius-md` | 6px | Cards, input fields, dropdowns |
| `--radius-lg` | 8px | Modals, side panels |
| `--radius-xl` | 12px | KPI cards, large containers |

### 1.5 Shadows

| Token | Value | Usage |
| --- | --- | --- |
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Cards, input fields |
| `--shadow-md` | `0 4px 6px -1px rgba(0,0,0,0.1)` | Dropdowns, popovers |
| `--shadow-lg` | `0 10px 15px -3px rgba(0,0,0,0.1)` | Modals, side panels |
| `--shadow-sidebar` | `4px 0 6px -1px rgba(0,0,0,0.1)` | Sidebar right edge |

---

## 2. Layout Shell

### 2.1 Application Shell Structure

```
+--------------------------------------------------+
|                  Context Bar (56px)               |
+--------+-----------------------------------------+
|        |                                         |
| Side-  |              Main Workspace             |
| bar    |                                         |
| (240px |              (flex: 1)                   |
|  or    |                                         |
|  64px) |                                         |
|        |                                         |
+--------+-----------------------------------------+
```

**Desktop-only constraint:** Minimum viewport 1280x720. No responsive breakpoints. No mobile support (SA-007). If viewport is below 1280px wide, show a centered message: "BudFin requires a minimum screen width of 1280px."

### 2.2 Sidebar

| Property | Expanded | Collapsed |
| --- | --- | --- |
| Width | 240px | 64px |
| Background | `--sidebar-bg` (#0F172A) | Same |
| Transition | `width 200ms ease-in-out` | Same |
| Z-index | 40 | 40 |
| Position | Fixed left, full height | Same |

**Sidebar structure (top to bottom):**

1. **Logo area** (56px height): BudFin logo + wordmark (expanded) or icon only (collapsed)
2. **Navigation groups** (scrollable):
   - **Dashboard** — single item, no group header
   - **Planning** — group header + items: Version Management, Enrollment & Capacity, Revenue, Staffing & Staff Costs, P&L & Reporting, Scenarios
   - **Master Data** — group header + items: Chart of Accounts, Academic Years & Grades, Reference Data, Assumptions & Parameters
   - **Admin** — group header + items: User Settings, Audit Trail, System Settings
3. **Collapse toggle** (bottom, 48px): chevron icon, toggles expanded/collapsed
4. **User avatar + role badge** (bottom, 56px): shows current user email (truncated) and role badge

**Nav item states:**

| State | Background | Text | Left border |
| --- | --- | --- | --- |
| Default | transparent | `--sidebar-text` | none |
| Hover | `--sidebar-bg-hover` | `--sidebar-text` | none |
| Active | `--sidebar-bg-active` | `--sidebar-text-active` | 3px solid white |
| Group header | transparent | `--sidebar-text` (uppercase, 10px) | none |

**Collapsed mode:** Only icons visible. Group headers hidden. Hovering an icon shows a tooltip with the full label. Nav items use `title` attribute for tooltip.

**RBAC visibility:**
- Admin group is visible only to users with Admin role
- Audit Trail is visible only to Admin role
- All other nav items visible to all roles

### 2.3 Context Bar

Fixed at the top of the viewport. Height: 56px. Background: `--workspace-bg-muted`. Border-bottom: 1px solid `--workspace-border`.

```
+-----------------------------------------------------------------------+
| [FY Dropdown] [Version Dropdown+Badge] [Compare Toggle] [Period Toggle]
|                                              [Scenario Dropdown] [Save]
+-----------------------------------------------------------------------+
```

**Layout:** Flexbox row, `justify-content: space-between`. Left group: FY + Version + Compare. Right group: Period + Scenario + Save indicator.

See **Section 3: Context Bar Specification** for full detail.

---

## 3. Context Bar Specification

The context bar is the persistent header that maintains user working context across all modules (PRD Section 6.1).

### 3.1 Elements (Left to Right)

#### 3.1.1 Fiscal Year Selector

| Property | Value |
| --- | --- |
| Component | `<Select>` (shadcn/ui) |
| Width | 120px |
| Options | FY2020 through FY2029 (10 years per SA-005) |
| Default | Current fiscal year (FY2026) |
| Label | "Fiscal Year" (visually hidden, `aria-label`) |

On change: reloads version list, resets version selector to first available, triggers data refresh for active module.

#### 3.1.2 Version Selector

| Property | Value |
| --- | --- |
| Component | Custom `<VersionSelect>` — `<Select>` with inline badge |
| Width | 240px |
| Options | All versions for selected fiscal year, grouped by type |
| Display format | `[TypeBadge] Version Name (Status)` |

Type badge is a colored dot + abbreviated label:
- Budget: `--version-budget` blue dot + "BUD"
- Actual: `--version-actual` green dot + "ACT"
- Forecast: `--version-forecast` orange dot + "FC"

Status shown as suffix text in `--text-muted`: "(Draft)", "(Published)", "(Locked)", "(Archived)".

On change: triggers full data refresh for active module. If version is Locked/Archived, shows read-only indicator in module toolbar.

#### 3.1.3 Comparison Toggle

| Property | Value |
| --- | --- |
| Component | `<Button variant="outline">` + `<Select>` (conditional) |
| Label | "Compare" with toggle icon |
| Initial state | Off (no comparison) |

Toggle ON reveals a second version selector (same component as 3.1.2). Selecting a comparison version activates variance columns throughout the workspace (PRD Section 7.3).

Toggle OFF hides comparison selector and removes variance columns.

Visual indicator when comparison is active: a thin colored bar below the context bar using the comparison version's type color.

#### 3.1.4 Academic Period Toggle

| Property | Value |
| --- | --- |
| Component | `<ToggleGroup>` (shadcn/ui, single select) |
| Options | AY1, AY2, Summer, Full Year |
| Default | Full Year |
| Width | Auto (fits content) |

Options map to:
- **AY1**: January through June (months 1-6)
- **AY2**: September through December (months 9-12)
- **Summer**: July through August (months 7-8)
- **Full Year**: All 12 months

On change: filters data display in active module to selected period.

#### 3.1.5 Scenario Selector

| Property | Value |
| --- | --- |
| Component | `<Select>` (shadcn/ui) |
| Width | 160px |
| Options | Base, Optimistic, Pessimistic |
| Default | Base |
| Visibility | Hidden when version type is "Actual" |

On change: filters calculated outputs to selected scenario parameters.

#### 3.1.6 Save Indicator

| Property | Value |
| --- | --- |
| Component | Custom `<SaveIndicator>` |
| Position | Right-aligned in context bar |
| States | "Saved" (green check), "Saving..." (spinner), "Unsaved changes" (amber dot) |

Displays the last auto-save timestamp in `--text-muted`: "Last saved 2 min ago".

#### 3.1.7 Stale Calculation Indicator

| Property | Value |
| --- | --- |
| Component | Custom `<StaleIndicator>` |
| Position | Next to save indicator |
| Display | `--color-stale` amber warning icon + "Calculations outdated" tooltip |
| Visibility | Shown only when `stale_modules` array from API is non-empty |
| Tooltip | Lists stale modules: "Revenue, P&L need recalculation" |

---

## 4. Shared Components

### 4.1 Data Grid (TanStack Table v8 — no virtual scrolling, ADR-016)

The data grid is the core component used across Enrollment, Revenue, Staffing, P&L, and Master Data modules.

**Base configuration:**

| Property | Value |
| --- | --- |
| Library | `@tanstack/react-table` v8 (headless) |
| Virtualization | None (no virtual scrolling — ADR-016) |
| Rendering | shadcn/ui `<Table>` components |
| Styling | Tailwind CSS 4.2 utility classes |
| State management | `zustand` store per module for grid state (sorting, filtering, column visibility) |

**Column features:**
- Sorting: click header to toggle asc/desc/none. Sort indicator arrow in header.
- Filtering: column-level filter input below header row (optional per column)
- Resizing: drag column border to resize. Minimum width 60px.
- Pinning: first N columns (configurable) pinned left during horizontal scroll
- Grouping: expandable row groups with summary aggregation (sum, count, avg)

**Row features:**
- Row height: 36px (compact financial grid)
- Alternating row colors: `--workspace-bg` and `--workspace-bg-subtle`
- Hover highlight: `--workspace-bg-muted`
- Selected row: `--color-info-bg` with `--color-info` left border (2px)
- Expandable rows: chevron icon in first column, indented child rows

> **No virtual scrolling (ADR-016).** All EFIR datasets are ≤ 500 rows. The audit log uses server-side pagination (`manualPagination: true`, TanStack Query) for larger datasets. Do not add `@tanstack/react-virtual` to the project.

### 4.2 Cell Editor Types

All cell editors activate on double-click or Enter key when cell is focused. Confirm with Enter or Tab. Cancel with Escape.

| Type | Component | Validation | Display Format |
| --- | --- | --- | --- |
| `text` | `<Input>` (shadcn/ui) | Max length, pattern | Left-aligned |
| `number` | `<Input type="number">` | Min/max, non-negative | Right-aligned, `--font-mono` |
| `currency` | Custom `<CurrencyInput>` | Decimal(15,4), >= 0 | Right-aligned, `--font-mono`, thousands separator, 2 decimals |
| `percentage` | Custom `<PercentInput>` | 0-100 (display), stored as decimal | Right-aligned, `--font-mono`, 1 decimal + "%" |
| `integer` | `<Input type="number">` | Integer >= 0 | Right-aligned, `--font-mono`, thousands separator |
| `date` | `<DatePicker>` (shadcn/ui) | Valid date, ISO format | `DD/MM/YYYY` display |
| `dropdown` | `<Select>` (shadcn/ui) | Enum values | Left-aligned, shows selected label |
| `boolean` | `<Checkbox>` (shadcn/ui) | — | Centered checkbox |

**Inline validation pattern:**
1. On blur or Enter: validate against cell rules
2. Invalid: red border (`--cell-error-border`), red tooltip with error message below cell
3. Valid: normal border, value saved via auto-save
4. Pending save: subtle pulse animation on cell background

### 4.3 Inline Validation Display

```
+------------------+
| [Invalid Value]  |  <-- --cell-error-border (2px solid red)
+------------------+
  ┌──────────────┐
  │ Error message │  <-- Tooltip: --color-error-bg, --color-error text
  └──────────────┘      Positioned below cell, z-index: 50
```

Validation tooltips auto-dismiss after 5 seconds or on next interaction. Multiple validation errors on a cell show as a stacked list in the tooltip.

### 4.4 Side Panel

Used for detail views, create/edit forms, and drill-down information.

| Property | Value |
| --- | --- |
| Width | 480px (fixed) |
| Position | Right side of workspace, overlays content |
| Animation | Slide in from right, 200ms ease-in-out |
| Background | `--workspace-bg` |
| Shadow | `--shadow-lg` |
| Z-index | 30 |
| Header | Title + close button (X), 56px height |
| Footer | Action buttons (Save, Cancel), 56px height |
| Body | Scrollable content area |

Close triggers: X button, Escape key, clicking overlay backdrop (if modal mode).

### 4.5 Module Toolbar

Each module page has a toolbar below the context bar.

```
+-----------------------------------------------------------------------+
| [Module Title]    [Filter controls...]    [Calculate] [Export] [More] |
+-----------------------------------------------------------------------+
```

| Property | Value |
| --- | --- |
| Height | 48px |
| Background | `--workspace-bg` |
| Border-bottom | 1px solid `--workspace-border` |
| Padding | 0 `--space-4` |

**Standard toolbar elements:**
- **Module title** (left): `--text-xl` weight 600
- **Filter/search** (center): Module-specific filter controls
- **Calculate button** (right): Primary action button, visible on planning modules only
- **Export button** (right): Dropdown with xlsx/pdf/csv options
- **More menu** (right): Overflow actions (import, settings)

#### Calculate Button States

| State | Appearance | Behavior |
| --- | --- | --- |
| Default | `<Button variant="default">` with calculator icon | Clickable |
| Stale | `<Button>` with amber pulsing dot indicator | Draws attention |
| Running | `<Button disabled>` with spinner | Shows progress |
| Success | Brief green check flash (2s), then returns to default | Auto-resets |
| Error | Red badge with error count, clickable to show details | Opens error panel |

**Calculate button behavior** (PRD Section 12):
1. Saves current module data (equivalent to manual save)
2. Runs the calculation engine for the module
3. Displays validation results and highlights any errors or warnings
4. On success: toast notification with summary (e.g., "Revenue recalculated -- Total Revenue: 42.3M SAR")
5. On error: error panel slides in with links to problematic fields

### 4.6 Toast Notifications

| Property | Value |
| --- | --- |
| Component | shadcn/ui `<Toast>` |
| Position | Bottom-right, 16px from edges |
| Duration | 5 seconds (auto-dismiss) |
| Max visible | 3 stacked |
| Variants | `success` (green), `error` (red), `warning` (amber), `info` (blue) |

### 4.7 Confirmation Dialog

Used for destructive actions (delete version, lock version, archive).

| Property | Value |
| --- | --- |
| Component | shadcn/ui `<AlertDialog>` |
| Width | 480px max |
| Overlay | Semi-transparent black backdrop |
| Actions | Primary destructive button (red) + Cancel |
| Requires | Text confirmation for critical actions (e.g., type version name to delete) |

### 4.8 Empty State

Shown when a module has no data (e.g., new version with no enrollment entered).

| Property | Value |
| --- | --- |
| Layout | Centered vertically and horizontally in workspace |
| Icon | Lucide icon relevant to module, 48px, `--text-muted` |
| Heading | `--text-lg`, `--text-secondary` |
| Description | `--text-sm`, `--text-muted` |
| Action | Primary button to get started (e.g., "Import Enrollment Data") |

### 4.9 Loading State

| Property | Value |
| --- | --- |
| Skeleton | shadcn/ui `<Skeleton>` rows matching expected grid layout |
| Spinner | Used in buttons and inline loading indicators |
| Full-page | Skeleton grid with animated shimmer, replaces workspace content |
| Duration before showing | 200ms delay (avoid flash for fast loads) |

### 4.10 Read-Only Mode Indicator

When the active version is Locked or Archived, the module workspace shows a read-only indicator.

| Property | Value |
| --- | --- |
| Banner | Sticky top of workspace, 32px, `--color-info-bg` |
| Text | "This version is [Locked/Archived] -- all fields are read-only" |
| Icon | Lock icon (Lucide `Lock`) |
| Effect | All editable cells lose `--cell-editable-bg`, cursor changes to `default` |

---

## 5. Keyboard Navigation

### 5.1 Grid Navigation

| Key | Action |
| --- | --- |
| `Arrow Up/Down/Left/Right` | Move focus between cells |
| `Tab` | Move to next editable cell (skips read-only cells) |
| `Shift+Tab` | Move to previous editable cell |
| `Enter` | Enter edit mode on focused cell / Confirm edit and move down |
| `Escape` | Cancel edit, revert to previous value, exit edit mode |
| `F2` | Enter edit mode (alternative to Enter) |
| `Home` | Move to first cell in current row |
| `End` | Move to last cell in current row |
| `Ctrl+Home` | Move to first cell in grid (A1) |
| `Ctrl+End` | Move to last cell with data |
| `Page Up/Down` | Scroll one viewport height up/down |

### 5.2 Application Shortcuts

| Key | Action | Scope |
| --- | --- | --- |
| `Ctrl+S` | Force save current data | Global |
| `Ctrl+Shift+C` | Toggle comparison mode | Global |
| `Ctrl+E` | Export current view | Module |
| `Ctrl+/` | Show keyboard shortcuts help overlay | Global |
| `Escape` | Close side panel / dialog / dropdown | Global |

### 5.3 Focus Management

- On module navigation: focus moves to first interactive element in the workspace (typically the first editable cell or the search input)
- On side panel open: focus traps inside panel, first form field receives focus
- On side panel close: focus returns to the element that triggered the panel
- On dialog open: focus traps inside dialog
- On dialog close: focus returns to trigger element
- Tab order follows visual layout: toolbar > filters > grid headers > grid cells (left-to-right, top-to-bottom)

---

## 6. Auto-Save Behavior

### 6.1 Save Triggers

| Trigger | Behavior |
| --- | --- |
| Field blur | Save the changed field immediately via PATCH/PUT |
| 30-second interval | Batch save all pending changes |
| Module navigation | Save all pending changes before navigating |
| Calculate button | Save all pending changes before calculating |
| `Ctrl+S` | Force save all pending changes immediately |

### 6.2 Save Indicator States

| State | Display | Duration |
| --- | --- | --- |
| All saved | Green checkmark + "Saved" + timestamp | Persistent |
| Saving | Spinner + "Saving..." | During save |
| Unsaved changes | Amber dot + "Unsaved changes" | Until save completes |
| Save error | Red X + "Save failed -- click to retry" | Until resolved |

### 6.3 Conflict Resolution

Uses optimistic locking via `updated_at` timestamp (sent as `If-Match` header). On conflict (HTTP 409 with `OPTIMISTIC_LOCK`):

1. Show dialog: "This record was modified by [user] at [time]. Your changes:"
2. Display diff: old value, server value, your value
3. Options: "Keep mine" (force save) or "Use theirs" (discard local changes)

---

## 7. Comparison Mode

When comparison mode is active (context bar toggle ON + second version selected):

### 7.1 Grid Overlay

Each numeric column gains two additional sub-columns:

| Sub-column | Content | Style |
| --- | --- | --- |
| Variance (absolute) | Primary - Comparison value | `--font-mono`, right-aligned |
| Variance (%) | (Primary - Comparison) / |Comparison| x 100 | `--font-mono`, right-aligned |

**Color coding:**
- Favorable variance: `--color-success` (green text)
- Unfavorable variance: `--color-error` (red text)
- Zero variance: `--text-muted` (gray text)

**Favorable/unfavorable logic:**
- Revenue items: positive = favorable (green), negative = unfavorable (red)
- Expense items: negative = favorable (green), positive = unfavorable (red)

### 7.2 Visual Differentiation

- Primary version data: normal text color
- Comparison version data: slightly muted (`--text-secondary`)
- Variance columns: background tinted with the comparison version's type color at 5% opacity

---

## 8. RBAC UI Behavior

Four roles with progressively increasing privileges (TDD Section 7.3).

### 8.1 Role-Based UI Modifications

| UI Element | Admin | BudgetOwner | Editor | Viewer |
| --- | --- | --- | --- | --- |
| Sidebar: Admin group | Visible | Hidden | Hidden | Hidden |
| Sidebar: Audit Trail | Visible | Hidden | Hidden | Hidden |
| Context bar: all elements | Full | Full | Full | Full |
| Module toolbar: Calculate | Yes | Yes | Yes | No |
| Module toolbar: Import | Yes | Yes | Yes | No |
| Module toolbar: Export | Yes | Yes | Yes | Yes |
| Grid cells: editable | Yes | Yes | Yes | No (all read-only) |
| Version Management: Create | Yes | Yes | No | No |
| Version Management: Delete | Yes | Yes | No | No |
| Version Management: Lifecycle | Yes | Yes (Publish/Lock) | No | No |
| Salary fields | Visible | Visible | Visible | Masked ("--") |
| User Management | Full CRUD | No access | No access | No access |

### 8.2 Viewer Role Specifics

- All grids render without `--cell-editable-bg` highlight
- No edit cursor on hover
- Calculate, Import buttons hidden from toolbar
- Double-click on cell does nothing (no edit mode)
- Salary columns in Staffing show "--" placeholder
- Context bar fully functional (can change FY, version, period, scenario)

### 8.3 Locked Version Behavior

When the active version is Locked or Archived (regardless of user role):
- All cells become read-only
- Calculate button disabled with tooltip "Version is locked"
- Import button disabled
- Read-only banner displayed (see Section 4.10)
- Context bar remains fully functional

---

## 9. Error Handling

### 9.1 API Error Display

| HTTP Status | UI Behavior |
| --- | --- |
| 400 | Field-level validation errors shown inline on affected cells |
| 401 | Redirect to login page |
| 403 | Toast: "You don't have permission to perform this action" |
| 404 | Toast: "Resource not found" + navigate to parent view |
| 409 (VERSION_LOCKED) | Banner: "This version is locked -- switch to a Draft version to make changes" |
| 409 (OPTIMISTIC_LOCK) | Conflict resolution dialog (Section 6.3) |
| 422 | Validation error panel with field-level details |
| 429 | Toast: "Too many requests -- please wait a moment" |
| 500 | Error page with "Something went wrong" message + retry button |

### 9.2 Network Error

Full-screen error overlay with:
- Icon: disconnected cloud
- Message: "Connection lost -- BudFin will retry automatically"
- Auto-retry with exponential backoff (1s, 2s, 4s, 8s, max 30s)
- Manual retry button

---

## 10. Accessibility (WCAG AA)

### 10.1 Requirements

| Requirement | Implementation |
| --- | --- |
| Color contrast | Minimum 4.5:1 for text, 3:1 for large text and UI components |
| Keyboard navigation | All interactive elements reachable via Tab, grid via Arrow keys |
| Focus indicators | 2px solid `--color-info` outline on all focusable elements |
| Screen reader | ARIA roles on grid (`role="grid"`, `role="row"`, `role="gridcell"`) |
| ARIA labels | All form controls have associated labels or `aria-label` |
| Live regions | `aria-live="polite"` for save indicator, toast notifications, calculation status |
| Skip links | "Skip to main content" link as first focusable element |
| Error identification | Errors identified by text, not color alone (icon + text) |

### 10.2 Grid Accessibility

| ARIA Attribute | Element | Value |
| --- | --- | --- |
| `role="grid"` | Table container | — |
| `role="row"` | Each row (`<tr>`) | — |
| `role="columnheader"` | Header cells | — |
| `role="gridcell"` | Data cells | — |
| `aria-sort` | Sorted column header | `ascending` / `descending` / `none` |
| `aria-selected` | Selected row | `true` / `false` |
| `aria-readonly` | Read-only cells | `true` |
| `aria-invalid` | Cells with validation errors | `true` |
| `aria-describedby` | Cells with errors | ID of error tooltip |
| `aria-expanded` | Expandable group rows | `true` / `false` |
| `aria-level` | Hierarchical rows (P&L) | Nesting depth (1, 2, 3) |

---

## 11. State Management Architecture

### 11.1 Server State (TanStack Query v5)

All API data is managed via `@tanstack/react-query`:
- **Query keys**: `[module, versionId, filters]` pattern
- **Stale time**: 30 seconds (matches auto-save interval)
- **Cache time**: 5 minutes
- **Background refetch**: On window focus
- **Optimistic updates**: For inline cell edits (revert on error)

### 11.2 Client State (Zustand v5)

UI-only state managed via Zustand stores:
- `useContextBarStore`: fiscal year, version, comparison version, period, scenario
- `useSidebarStore`: expanded/collapsed, active nav item
- `useGridStore` (per module): column visibility, sort state, filter state, selected rows
- `useUIStore`: active side panel, active dialog, toast queue

### 11.3 URL State

Context bar state is synced to URL search params for deep linking:
- `?fy=2026&version=42&compare=38&period=full&scenario=base`
- Module navigation uses React Router path: `/planning/revenue`, `/master-data/accounts`, etc.

---

## 12. Module Page Template

Every module page follows this consistent structure:

```tsx
<ModulePage>
  {/* Context bar is rendered at shell level, not per-module */}

  <ModuleToolbar>
    <ModuleTitle />
    <FilterControls />       {/* Module-specific */}
    <ToolbarActions>
      <CalculateButton />    {/* Planning modules only */}
      <ExportButton />
      <MoreMenu />
    </ToolbarActions>
  </ModuleToolbar>

  {/* Optional: Tab navigation for multi-view modules */}
  <TabNavigation />

  <ModuleContent>
    {/* Loading: skeleton grid */}
    {/* Empty: empty state with CTA */}
    {/* Error: error state with retry */}
    {/* Data: grid / charts / panels */}
  </ModuleContent>

  {/* Optional: Side panel for detail views */}
  <SidePanel />
</ModulePage>
```

---

## 13. Cross-Reference: Technology Stack

| Component | Technology | Version | Notes |
| --- | --- | --- | --- |
| UI Framework | React | 19 | Hooks, Server Components support |
| Build Tool | Vite | 7.3+ | Hot module replacement |
| Styling | Tailwind CSS | 4.2 | CSS-first config, Oxide engine |
| Component Library | shadcn/ui + Radix UI | 1.4+ | Headless accessible primitives |
| Data Grid | TanStack Table | v8 | Headless table logic |
| Server State | TanStack Query | v5 | Caching, background sync |
| Client State | Zustand | v5 | Minimal UI state |
| Charts | Recharts | v3 | React 19 compatible |
| Forms | React Hook Form + Zod 4 | v7 + v4 | With @hookform/resolvers v5 |
| Icons | Lucide React | 0.576+ | shadcn/ui default icons |
| Date Handling | date-fns + @date-fns/tz | v4 + v1 | AST (UTC+3) formatting |
| Decimal Display | decimal.js | 10.6+ | Presentation rounding only (TC-004) |
