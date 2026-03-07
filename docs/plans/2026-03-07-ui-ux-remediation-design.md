# BudFin UI/UX Remediation -- Full Clean Slate Rewrite

> **Date:** 2026-03-07
> **Status:** Approved
> **Scope:** Complete visual and UX overhaul of the BudFin frontend
> **Approach:** Clean slate rewrite of all layouts, components, and pages
> **Inspiration:** Pigment-like financial planning workspace

---

## 1. Design Decisions

| Decision           | Choice                                            |
| ------------------ | ------------------------------------------------- |
| Scope              | Full clean slate rewrite                          |
| Accent color       | Teal/emerald (#14B8A6 family)                     |
| Animation level    | Full motion design (30+ animation points)         |
| Shell architecture | Two-shell (PlanningShell + ManagementShell)       |
| Sidebar            | Collapsible (240px/64px) with smart auto-collapse |
| Login              | Animated mesh gradient + glassmorphic card        |
| Grid               | Full micro-interaction set                        |
| Page transitions   | Cross-fade with directional slide                 |
| Loading            | Diagonal shimmer skeletons + staggered reveal     |
| Fonts              | Inter Variable + JetBrains Mono Variable          |

**Preserved (not rewritten):** hooks/, stores/auth-store.ts, lib/ -- these contain working business logic and API integration.

---

## 2. Design System -- Teal Identity

### 2.1 Color Palette

#### Brand Teal (Signature Accent)

| Token          | Value     | Usage                              |
| -------------- | --------- | ---------------------------------- |
| `--accent-50`  | `#F0FDFA` | Subtle backgrounds, selected rows  |
| `--accent-100` | `#CCFBF1` | Hover backgrounds, badge bgs       |
| `--accent-200` | `#99F6E4` | Light borders on accent elements   |
| `--accent-300` | `#5EEAD4` | Secondary buttons, toggle active   |
| `--accent-400` | `#2DD4BF` | Charts, progress bars              |
| `--accent-500` | `#14B8A6` | Primary buttons, active indicators |
| `--accent-600` | `#0D9488` | Primary button hover, links        |
| `--accent-700` | `#0F766E` | Primary button active/pressed      |
| `--accent-800` | `#115E59` | Dark accent text on light bg       |
| `--accent-900` | `#134E4A` | Accent text in sidebar             |

#### Sidebar (Dark Carbon)

| Token                   | Value                   | Usage                      |
| ----------------------- | ----------------------- | -------------------------- |
| `--sidebar-bg`          | `#0C1222`               | Deep navy-black background |
| `--sidebar-bg-hover`    | `#162032`               | Item hover                 |
| `--sidebar-bg-active`   | `#0D9488`               | Active item (teal accent)  |
| `--sidebar-text`        | `#A1B4CC`               | Default text               |
| `--sidebar-text-active` | `#FFFFFF`               | Active item text           |
| `--sidebar-border`      | `#1E2D42`               | Dividers                   |
| `--sidebar-glow`        | `rgba(20,184,166,0.15)` | Teal glow on active item   |

#### Workspace (Light)

| Token                       | Value     | Usage                        |
| --------------------------- | --------- | ---------------------------- |
| `--workspace-bg`            | `#FFFFFF` | Main background              |
| `--workspace-bg-subtle`     | `#F8FAFB` | Alternating rows             |
| `--workspace-bg-muted`      | `#F1F5F9` | Context bar, section headers |
| `--workspace-bg-card`       | `#FFFFFF` | Cards with shadow            |
| `--workspace-border`        | `#E5EAF0` | Standard borders             |
| `--workspace-border-strong` | `#CBD5E1` | Focused elements             |

#### Semantic Colors (unchanged)

| Token                | Value     | Usage                  |
| -------------------- | --------- | ---------------------- |
| `--color-success`    | `#16A34A` | Favorable variance     |
| `--color-success-bg` | `#F0FDF4` | Success background     |
| `--color-warning`    | `#D97706` | Near-cap alerts        |
| `--color-warning-bg` | `#FFFBEB` | Warning background     |
| `--color-error`      | `#DC2626` | Unfavorable variance   |
| `--color-error-bg`   | `#FEF2F2` | Error background       |
| `--color-info`       | `#2563EB` | Information indicators |
| `--color-info-bg`    | `#EFF6FF` | Info background        |
| `--color-stale`      | `#F59E0B` | Stale calculation      |

#### Version Type Colors (unchanged)

| Token                   | Value     | Type     |
| ----------------------- | --------- | -------- |
| `--version-budget`      | `#2563EB` | Budget   |
| `--version-budget-bg`   | `#DBEAFE` | Budget   |
| `--version-actual`      | `#16A34A` | Actual   |
| `--version-actual-bg`   | `#DCFCE7` | Actual   |
| `--version-forecast`    | `#EA580C` | Forecast |
| `--version-forecast-bg` | `#FFF7ED` | Forecast |

#### Status Colors (unchanged)

| Token                | Value     | Status    |
| -------------------- | --------- | --------- |
| `--status-draft`     | `#4B5563` | Draft     |
| `--status-published` | `#2563EB` | Published |
| `--status-locked`    | `#7C3AED` | Locked    |
| `--status-archived`  | `#6B7280` | Archived  |

#### Editable Cell Colors (unchanged)

| Token                   | Value     |
| ----------------------- | --------- |
| `--cell-editable-bg`    | `#FEFCE8` |
| `--cell-editable-focus` | `#14B8A6` |
| `--cell-readonly-bg`    | `#F8FAFC` |
| `--cell-error-border`   | `#DC2626` |

Note: `--cell-editable-focus` changed from blue to teal to match accent.

### 2.2 Typography

| Token           | Font                                             | Size | Weight | Usage                   |
| --------------- | ------------------------------------------------ | ---- | ------ | ----------------------- |
| `--font-family` | `'Inter Variable', Inter, system-ui, sans-serif` | --   | --     | Primary                 |
| `--font-mono`   | `'JetBrains Mono Variable', ui-monospace, mono`  | --   | --     | Numeric values in grids |
| `--text-xs`     | --                                               | 11px | 400    | Grid cells, metadata    |
| `--text-sm`     | --                                               | 13px | 400    | Body text, form labels  |
| `--text-base`   | --                                               | 14px | 400    | Toolbar text, buttons   |
| `--text-lg`     | --                                               | 16px | 600    | Section headers         |
| `--text-xl`     | --                                               | 20px | 600    | Module page titles      |
| `--text-2xl`    | --                                               | 28px | 700    | KPI card values         |
| `--text-3xl`    | --                                               | 36px | 700    | Dashboard hero metric   |

Fonts self-hosted via `@fontsource-variable/inter` and `@fontsource-variable/jetbrains-mono`.

### 2.3 Shadows

| Token                  | Value                                                                | Usage             |
| ---------------------- | -------------------------------------------------------------------- | ----------------- |
| `--shadow-xs`          | `0 1px 2px rgba(0,0,0,0.04)`                                         | Subtle card lift  |
| `--shadow-sm`          | `0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)`             | Cards, inputs     |
| `--shadow-md`          | `0 4px 8px -2px rgba(0,0,0,0.08), 0 2px 4px -2px rgba(0,0,0,0.04)`   | Dropdowns         |
| `--shadow-lg`          | `0 12px 24px -4px rgba(0,0,0,0.10), 0 4px 8px -4px rgba(0,0,0,0.04)` | Modals            |
| `--shadow-sidebar`     | `1px 0 8px rgba(0,0,0,0.12)`                                         | Sidebar edge      |
| `--shadow-glow-accent` | `0 0 20px rgba(20,184,166,0.15)`                                     | Accent focus glow |

### 2.4 Animation Tokens

| Token               | Value                               | Usage                          |
| ------------------- | ----------------------------------- | ------------------------------ |
| `--ease-out-expo`   | `cubic-bezier(0.16, 1, 0.3, 1)`     | Panel open, page transitions   |
| `--ease-out-back`   | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Toast enter, tooltip pop       |
| `--ease-in-out`     | `cubic-bezier(0.4, 0, 0.2, 1)`      | Standard transitions           |
| `--duration-fast`   | `150ms`                             | Hover states, toggles          |
| `--duration-normal` | `250ms`                             | Panel transitions, fades       |
| `--duration-slow`   | `400ms`                             | Page transitions, stagger root |
| `--duration-slower` | `600ms`                             | Chart draw-in, counter roll-up |
| `--stagger-delay`   | `50ms`                              | List item reveal offset        |

### 2.5 Border Radii

| Token           | Value  | Usage                       |
| --------------- | ------ | --------------------------- |
| `--radius-none` | `0px`  | Grid cells                  |
| `--radius-sm`   | `6px`  | Badges, small buttons       |
| `--radius-md`   | `8px`  | Cards, inputs, dropdowns    |
| `--radius-lg`   | `12px` | Modals, panels              |
| `--radius-xl`   | `16px` | KPI cards, large containers |
| `--radius-2xl`  | `24px` | Login card, hero elements   |

### 2.6 Spacing (unchanged from spec, 4px grid)

| Token        | Value |
| ------------ | ----- |
| `--space-1`  | 4px   |
| `--space-2`  | 8px   |
| `--space-3`  | 12px  |
| `--space-4`  | 16px  |
| `--space-5`  | 20px  |
| `--space-6`  | 24px  |
| `--space-8`  | 32px  |
| `--space-10` | 40px  |

---

## 3. UX Architecture

### 3.1 Workspace Paradigm

BudFin is a single, persistent workspace. Users don't navigate to pages -- they switch contexts within a living workspace. The shell (sidebar + context bar + right panel) stays stable while content transitions smoothly.

### 3.2 Sidebar

**States:** Expanded (240px) and Collapsed (64px).

**Expanded:**

- Logo area (56px) with teal accent dot + "BudFin" wordmark
- Nav groups: Planning, Management, Master Data, Admin (admin-only)
- Collapse toggle at bottom with rotating chevron
- User avatar + email + role badge at bottom

**Collapsed:**

- Icon-only navigation
- Tooltips slide out to the right on hover
- Active item: teal left bar (3px)
- Logo icon only

**Transition choreography (expand/collapse):**

1. Width: 250ms `--ease-out-expo`
2. Labels: fade in/out with 50ms delay after width starts
3. Group headers: fade in 100ms after labels
4. Chevron: 180-degree rotation with spring (`--ease-out-back`)

**Nav item hover:**

- Background slides in from left edge (150ms)
- Icon shifts 2px right (subtle parallax)
- Click ripple: teal-tinted, emanates from click point (300ms)

**Smart auto-collapse:**

- Right panel opens -> sidebar collapses (coordinated animation)
- User re-expands sidebar while panel open -> panel closes (mutual exclusion)

### 3.3 PlanningShell Layout

```
+--------+------------------------------------------------------+---+----------+
|        | CONTEXT BAR (56px, frosted glass)                     |   |          |
| SIDE-  | Breadcrumb           [FY][Ver][Cmp][Per][Sc]           |   |          |
| BAR    |                         [Save] [Stale] [Panel] [User] |   |          |
|        +------------------------------------------------------+   |  RIGHT   |
| 240/   | MODULE TOOLBAR (48px)                                 | r |  PANEL   |
| 64px   | Title    [Filters]    [Calculate] [Export] [More]      | e | (280-50%)|
|        +------------------------------------------------------+ s |  default |
|        |                                                      | i |  400px   |
|        |  WORKSPACE CONTENT (flex:1, min 480px)               | z |          |
|        |  Cross-fades on module switch                        | e | [tabs]   |
|        |  Staggered reveal on data load                       |   |          |
+--------+------------------------------------------------------+---+----------+
```

**Context bar:**

- Frosted glass: `backdrop-filter: blur(12px)`, semi-transparent white bg
- Breadcrumb: `FY2026 / Budget v1 > Module Name`, clickable FY+Version
- Module name cross-fades on navigation
- Data refresh: shimmer wave across workspace on selector change
- Save indicator: animated checkmark on save, pulse on unsaved
- Stale indicator: amber warning with tooltip listing stale modules

**Module content transitions:**

1. Current content: fade out + slide down 8px (150ms)
2. 50ms gap
3. New content: fade in + slide up from 8px (200ms, `--ease-out-expo`)
4. Skeleton appears at 200ms if data loading (diagonal shimmer)
5. Content reveal: rows fade in with 30ms stagger

**Right panel:**

- Opens: slide from right (250ms, `--ease-out-expo`), workspace shrinks
- Resize handle: hover glows teal, drag shows guide line
- Tab switching: content cross-fades (150ms), indicator slides to position
- Tabs: Details, Activity, Audit, Help, Form
- Active tab: teal left bar (3px), icon scale 1.1 on hover

### 3.4 ManagementShell Layout

```
+--------+--------------------------------------------------------------+
|        | MODULE TOOLBAR (48px)                                        |
| SIDE-  | Title    [Search] [Filters]    [+ New] [Export]               |
| BAR    +--------------------------------------------------------------+
|        |                                                              |
|        |  WORKSPACE CONTENT (full width)                              |
|        |  Overlay side panel (480px, z-30) for CRUD forms            |
+--------+--------------------------------------------------------------+
```

No context bar. No docked right panel. Overlay side panels for CRUD.

**Overlay panel animation:**

1. Dark backdrop fades in (150ms, 40% opacity)
2. Panel slides from right (250ms, `--ease-out-expo`)
3. Form fields stagger-reveal (50ms per field)
4. Close: reverse with faster timing (200ms)

### 3.5 Data Grid Experience

- Row hover: smooth bg transition + faint teal left border slides in from top
- Cell focus: teal border + `--shadow-glow-accent`, cell appears to "lift"
- Edit mode: cell bg transitions to white, 1.02x scale-up, input auto-focused
- Save on blur: green checkmark draws over 300ms, cell flashes `--accent-50`
- Validation error: red border + horizontal shake (3px, 200ms), tooltip slides up
- Row selection: `--accent-50` bg + teal left border, multi-select staggers 30ms
- Expandable groups: chevron rotates 90deg (spring), child rows slide down (30ms stagger)
- Column resize: teal guide line during drag, smooth reflow on release

### 3.6 Loading Choreography

1. Shell always visible (sidebar + context bar)
2. Skeleton at 200ms (diagonal shimmer gradient, 105deg, 1.5s sweep)
3. Skeleton shapes match expected content exactly
4. Minimum 400ms display
5. Content reveal: fade in with 30ms stagger per row/card

### 3.7 Empty States

- Large teal-tinted icon (48px, thin strokes)
- Heading: fade + slide up (300ms)
- Description: fade (150ms delay)
- CTA button: fade + scale 0.95->1.0 (200ms delay)
- Subtle animated background pattern

### 3.8 Toast Notifications

- Enter: slide up from bottom-right + bounce (`--ease-out-back`, 400ms)
- Stack: 8px gap, new toasts push existing up (animated)
- Auto-dismiss: progress bar shrinks over 5s (color-coded)
- Dismiss: slide right + fade out (200ms)

### 3.9 Login Page

- Background: animated mesh gradient (dark navy + teal + deep purple), 20s loop
- Login card: glassmorphic (backdrop-filter blur, semi-transparent, thin white border)
- Card entrance: scale 0.95->1.0 + fade (400ms on page load)
- Input focus: teal border + glow, floating label animation
- Submit: hover gradient shift, click spring (scale down then up)
- Success: card fades to white, morphs into workspace (600ms)
- Error: card shake + error message fade in

---

## 4. Component Library

### 4.1 Button Variants

| Variant       | Idle                                 | Hover                    | Active               |
| ------------- | ------------------------------------ | ------------------------ | -------------------- |
| `primary`     | Teal-500 bg, white text              | Teal-600 bg, shadow lift | Teal-700, scale 0.98 |
| `secondary`   | White bg, teal-600 text, teal border | Accent-50 bg             | Accent-100 bg        |
| `ghost`       | Transparent, muted text              | Accent-50 bg fades in    | Accent-100 bg        |
| `destructive` | Red-600 bg, white text               | Red-700 bg               | Red-800, scale 0.98  |

All: 150ms transitions. Click micro-scale bounce (0.97->1.0, spring, 200ms).

### 4.2 Input

- Idle: `--workspace-border`, `--radius-md`, subtle inner shadow
- Focus: teal-500 border, `--shadow-glow-accent`, label floats up
- Error: red-500 border, red glow, shake (200ms)
- Filled: slightly bolder border

### 4.3 Select / Dropdown

- Trigger: same as Input styling
- Panel: `--shadow-lg`, `--radius-md`, scale 0.95->1.0 + fade (150ms)
- Item hover: bg slides in from left
- Selected: teal checkmark with draw animation

### 4.4 Tabs

- Underline variant: sliding teal underline follows active tab (250ms)
- Pill variant: animated background blob moves between pills

### 4.5 Cards

- Default: white bg, `--shadow-xs`, `--radius-xl`, 1px border
- Hover (interactive): shadow elevates, translateY(-1px) over 200ms
- KPI: `--radius-xl`, teal top accent line (3px), counter roll-up animation

### 4.6 Skeleton

- Diagonal shimmer gradient (105deg), sweeps left-to-right over 1.5s
- Shapes match expected content precisely

---

## 5. Page Designs

### 5.1 Login (`/login`)

Animated mesh gradient bg + glassmorphic card with teal accent. See Section 3.9.

### 5.2 Dashboard (`/planning`)

KPI cards row (4 cards: Students, Revenue, Staff Costs, Net Result) with counter roll-up + sparklines.
Charts section: Revenue vs Budget waterfall, Enrollment donut, Monthly trend line.
All charts animate on first render. Cards stagger-reveal (50ms).

### 5.3 Enrollment (`/planning/enrollment`)

Module toolbar with band filter toggles (animated pill blob) + Calculate/Import/History.
Underline tabs: By Grade / By Nationality / By Tariff (sliding underline).
Elevated data grid with full micro-interactions.
CSV import: overlay panel with staggered fields.
Historical chart: collapsible with smooth height animation.

### 5.4 Version Management (`/management/versions`)

Filter bar with search, type/status filters, FY selector.
Data table with elevated styling (hover, sort indicators, action dropdowns).
Create version: slide-in overlay panel.
Lifecycle dialogs: elevated AlertDialog.

### 5.5 Master Data (`/master-data/*`)

All four pages: ManagementShell template.
Toolbar: search (teal focus glow), filters, + New button.
Data tables with hover/sort animations.
CRUD side panels (480px overlay) with staggered form entry.

### 5.6 Admin (`/admin/*`)

Users: table with role badges, side panel for edit.
Audit: timeline-style log with staggered entry reveals.
Settings: card-based groups with hover lift.

### 5.7 Placeholder Pages

Centered empty state with teal-tinted icon.
"Coming soon" with shimmer gradient text.
Animated entrance.

---

## 6. Router Structure

```
/login                          -> LoginPage (public)

RootLayout (Sidebar + Outlet)
├── PlanningShell (ContextBar + RightPanel + Outlet)
│   ├── /planning               -> DashboardPage
│   ├── /planning/enrollment    -> EnrollmentPage
│   ├── /planning/revenue       -> PlaceholderPage
│   ├── /planning/staffing      -> PlaceholderPage
│   ├── /planning/pnl           -> PlaceholderPage
│   └── /planning/scenarios     -> PlaceholderPage
│
└── ManagementShell (Toolbar + Outlet)
    ├── /management/versions    -> VersionsPage
    ├── /management/fiscal-periods -> FiscalPeriodsPage
    ├── /master-data/accounts   -> AccountsPage
    ├── /master-data/academic   -> AcademicPage
    ├── /master-data/reference  -> ReferencePage
    ├── /master-data/assumptions -> AssumptionsPage
    ├── /admin/users            -> UsersPage (Admin)
    ├── /admin/audit            -> AuditPage (Admin)
    └── /admin/settings         -> SettingsPage (Admin)
```

---

## 7. File Structure

```
apps/web/src/
├── main.tsx
├── app.tsx
├── router.tsx
├── index.css                      # Design tokens + keyframes + fonts
│
├── layouts/
│   ├── root-layout.tsx            # Sidebar + Outlet
│   ├── planning-shell.tsx         # ContextBar + RightPanel + Outlet
│   └── management-shell.tsx       # Toolbar + Outlet
│
├── components/
│   ├── ui/                        # Elevated shadcn/ui
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── tabs.tsx
│   │   ├── dialog.tsx
│   │   ├── alert-dialog.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── sheet.tsx
│   │   ├── skeleton.tsx
│   │   ├── toast.tsx
│   │   ├── toast-state.ts
│   │   ├── toggle-group.tsx
│   │   └── card.tsx
│   │
│   ├── shell/
│   │   ├── sidebar.tsx
│   │   ├── sidebar-nav-item.tsx
│   │   ├── context-bar.tsx
│   │   ├── breadcrumb.tsx
│   │   ├── right-panel.tsx
│   │   ├── module-toolbar.tsx
│   │   ├── save-indicator.tsx
│   │   └── stale-indicator.tsx
│   │
│   ├── data-grid/
│   │   ├── data-grid.tsx
│   │   ├── editable-cell.tsx
│   │   ├── cell-renderers.tsx
│   │   └── grid-skeleton.tsx
│   │
│   ├── dashboard/
│   │   ├── kpi-card.tsx
│   │   └── chart-card.tsx
│   │
│   ├── enrollment/
│   ├── versions/
│   ├── master-data/
│   ├── admin/
│   │
│   └── shared/
│       ├── empty-state.tsx
│       ├── error-state.tsx
│       ├── page-transition.tsx
│       ├── stagger-list.tsx
│       ├── counter.tsx
│       └── animated-gradient.tsx
│
├── hooks/                         # PRESERVED
├── stores/
│   ├── auth-store.ts              # PRESERVED
│   ├── sidebar-store.ts           # NEW
│   ├── right-panel-store.ts       # NEW
│   └── ui-store.ts                # NEW
│
├── lib/                           # PRESERVED
│
└── pages/
    ├── login.tsx
    ├── planning/
    │   ├── dashboard.tsx
    │   └── enrollment.tsx
    ├── management/
    │   ├── versions.tsx
    │   └── fiscal-periods.tsx
    ├── master-data/
    │   ├── accounts.tsx
    │   ├── academic.tsx
    │   ├── reference.tsx
    │   └── assumptions.tsx
    ├── admin/
    │   ├── users.tsx
    │   ├── audit.tsx
    │   └── settings.tsx
    └── placeholder.tsx
```

---

## 8. What Is Preserved vs Rewritten

### Preserved (business logic)

- `hooks/use-workspace-context.ts` -- planning context store
- `hooks/use-versions.ts` -- version CRUD hooks
- `hooks/use-enrollment.ts` -- enrollment data hooks
- `hooks/use-grade-levels.ts` -- grade level fetch
- `hooks/use-reference-data.ts` -- nationality/tariff/department CRUD
- `hooks/use-accounts.ts` -- chart of accounts CRUD
- `hooks/use-academic-years.ts` -- academic year CRUD
- `hooks/use-assumptions.ts` -- assumptions CRUD
- `hooks/use-fiscal-periods.ts` -- fiscal period CRUD
- `stores/auth-store.ts` -- auth state + JWT handling
- `lib/api-client.ts` -- HTTP client with auth headers
- `lib/cn.ts` -- clsx + tailwind-merge
- `lib/format-date.ts` -- date formatting

### Rewritten (visual layer)

- `index.css` -- new design tokens, animation keyframes, font imports
- `router.tsx` -- two-shell route structure with new paths
- `layouts/*` -- all layout components (root, planning shell, management shell)
- `components/ui/*` -- all shadcn/ui components re-styled
- `components/shell/*` -- all new shell components
- `components/data-grid/*` -- new reusable grid system
- `components/shared/*` -- new animation/empty/error components
- `pages/*` -- all page components rewritten
- All domain component directories (enrollment, versions, master-data, admin)

### New additions

- `stores/sidebar-store.ts` -- sidebar collapsed/expanded state
- `stores/right-panel-store.ts` -- right panel state, width, tab
- `stores/ui-store.ts` -- toast queue, dialog state
- `components/shell/*` -- new shell component directory
- `components/data-grid/*` -- new reusable grid directory
- `components/dashboard/*` -- new dashboard components
- `components/shared/*` -- new shared animation/state components
- `@fontsource-variable/inter` -- font package
- `@fontsource-variable/jetbrains-mono` -- font package
