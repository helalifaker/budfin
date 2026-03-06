# UI/UX Specification Review: Workspace Paradigm Analysis & Fix Plan

**Date:** 2026-03-06
**Scope:** Complete review of `docs/ui-ux-spec/` (10 files) for workspace-first UX coverage
**Status:** Superseded — resolved decisions implemented on 2026-03-06. See final plan below.

---

## 1. Executive Summary

The existing specs are solid in breadth — all 11 modules are documented with tokens, components, ARIA, state management, and API contracts. However, the specs **miss the fundamental workspace architecture** the user expects: a Pigment-like SPA where everything happens in the page, with a persistent, dockable right panel that can be toggled at will without disrupting the workspace.

**Current state:** Each module independently manages a floating overlay side panel (z-index:30). There is no shell-level right panel, no right panel toggle, and no concept of the panel shifting workspace content.

**Target state:** Shell manages a dockable right panel slot. Modules declare their "right panel content." Users toggle the right panel globally. It shifts (not overlays) the workspace. It has multiple modes: Details, Activity, Help.

---

## 2. Critical Gaps Found

### GAP-001 — Right Panel is an Overlay, Not a Docked Shell Component [BLOCKING]

**Current spec:** `00-global-framework.md §4.4` defines `<SidePanel>` as:

- Width: 480px fixed
- Position: "overlays content" (implied by z-index:30)
- Animation: slides in from right but does NOT shift the workspace
- Defined per-module — each module manages its own panel independently

**Required:** A shell-level docked right panel that:

- Is managed at the `<AppShell>` level, not per-module
- **Shifts** the workspace width when open (workspace `flex: 1` narrows; panel appears beside it)
- Has a persistent toggle button accessible at all times
- Can be pinned open across module navigation
- Width: 320px (compact) / 480px (expanded), user-draggable

**Impact:** Without this, the "right sidebar toggle" the user expects does not exist. Each module's panel opens as a modal overlay, breaking the continuous workspace feel.

---

### GAP-002 — No Right Panel Toggle in the Shell Layout [BLOCKING]

**Current spec:** The application shell ASCII diagram shows:

```
Context Bar (56px)
Sidebar (240/64px) | Main Workspace (flex:1)
```

There is no right panel slot, no toggle button, and no right rail.

**Required:** Update the shell to:

```
Context Bar (56px) — includes right panel toggle button (far right)
Sidebar (240/64px) | Main Workspace (flex:1) | Right Panel (0/320/480px)
```

The toggle button must be:

- Always visible in the context bar (far right, before the user avatar)
- Icon: `PanelRightOpen` / `PanelRightClose` (Lucide)
- Keyboard shortcut: `Ctrl+Shift+P`
- State persisted in localStorage (not URL — don't pollute deep links)

---

### GAP-003 — No Right Panel Mode System [BLOCKING]

**Current spec:** Side panels only exist for CRUD forms (create/edit employee, create version, CSV import). There is no concept of the right panel showing contextual information beyond forms.

**Required:** The right panel has 4 modes, switchable via icon tabs on its left edge:

| Mode     | Icon            | Content                                                          | Available In         |
| -------- | --------------- | ---------------------------------------------------------------- | -------------------- |
| Details  | `Info`          | Version metadata, stale modules, last calculated timestamps      | All planning modules |
| Activity | `Activity`      | Recent changes, calculation history, export status               | All modules          |
| Audit    | `ClipboardList` | Audit trail entries for the current record or module             | All modules          |
| Help     | `HelpCircle`    | Contextual documentation for the active module                   | All modules          |
| Form     | `FilePen`       | Create/edit CRUD forms (replaces the current overlay side panel) | Per module           |

Mode tabs appear as a vertical icon strip on the left edge of the right panel. The active mode is highlighted with `--color-info` left border.

---

### GAP-004 — Side Panel Opens as Overlay Instead of Shifting Content [IMPORTANT]

**Current spec:** The side panel has `z-index: 30` and "overlays content." In financial planning tools (Pigment, Anaplan, Adaptive Insights), panels dock alongside the workspace — the workspace narrows but remains fully accessible.

**Required:**

- When the right panel opens, `<MainWorkspace>` gets `transition: width 200ms ease-in-out`
- Right panel appears to the right of the workspace, not on top of it
- If viewport < 1440px AND right panel is open: overlay mode is acceptable (fallback), with a semi-transparent backdrop
- Minimum workspace width when panel open: 800px (forces overlay mode below this)

**Trade-off:** This requires the workspace to know the right panel state. The `useUIStore` already tracks side panel state — extend it to control panel width.

---

### GAP-005 — No Persistent Activity/Notification Center [IMPORTANT]

**Current spec:** Toasts auto-dismiss in 5 seconds. There is no way to review past notifications (completed exports, calculation results, save errors that were dismissed).

**Required:** "Activity" mode in the right panel (see GAP-003) shows:

- Last 20 events in reverse-chronological order
- Event types: calculation complete, export ready, auto-save, error, version lifecycle change
- Each event: icon + description + timestamp (relative: "2 min ago")
- Calculation events: link to the module ("View Revenue module")
- Export events: "Download" action button
- Events persist for the browser session (Zustand, not server state)
- Unread count badge on the right panel toggle button (clears when panel is opened)

---

### GAP-006 — No Workspace Header / Location Breadcrumb [IMPORTANT]

**Current spec:** The module toolbar has a title (`<h1>` with module name). The context bar shows FY + Version. But there is no persistent, unambiguous location indicator.

**Required:** The context bar left side should show a location indicator:

```
[BudFin logo] > FY2026 / Budget v2 > Staffing & Staff Costs
```

| Segment      | Component                            | Behavior                                           |
| ------------ | ------------------------------------ | -------------------------------------------------- |
| App          | Logo                                 | Always visible; click → Dashboard                  |
| FY + Version | Same as current FY/Version selectors | Combined into "FY2026 / Budget v2" compact display |
| Module       | Current module name                  | Non-interactive, text only                         |

This gives users an immediate sense of their context without requiring them to look at both the sidebar (active item) and the context bar separately. In comparison mode, a colored bar below the breadcrumb uses the comparison version's type color (this already exists in the spec).

---

### GAP-007 — Context Bar is Overloaded [IMPORTANT]

**Current spec:** The context bar contains 7 elements: FY selector, Version selector, Compare toggle + second version selector (conditional), Period toggle, Scenario selector, Save indicator, Stale indicator.

Adding a right panel toggle (GAP-002) and breadcrumb (GAP-006) makes this 9+ elements.

**Required:** Reorganize the context bar into zones:

```
+--[ Logo > FY2026/BudgetV2 > Module ]--[ Compact mode controls ]---------[ Panel toggle | User ]--+
Left zone: Navigation                   Center zone: Context                Right zone: Shell actions
```

| Left Zone                  | Center Zone                                                                     | Right Zone                                                       |
| -------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Logo, breadcrumb (GAP-006) | FY selector, Version selector, Compare toggle, Period toggle, Scenario selector | Save indicator, Stale indicator, Right panel toggle, User avatar |

This reduces cognitive load by grouping navigation vs. data context vs. shell controls.

---

### GAP-008 — No Expanded/Focus Mode for Data-Dense Views [MINOR]

**Current spec:** The sidebar can be collapsed to 64px. But there is no way to collapse the context bar for maximum workspace vertical space.

**Required:** A "Focus mode" toggle that:

- Hides the context bar (collapses to 0px height with 200ms transition)
- Sidebar stays visible in collapsed (64px) mode
- The module toolbar becomes the topmost element
- Keyboard shortcut: `Ctrl+Shift+F`
- Useful for staffing grid (many columns) and P&L monthly view
- Exit focus mode: same shortcut or a small floating "Exit Focus" button in the top-right corner of the workspace

---

### GAP-009 — Right Panel Width Inconsistency Across Modules [MINOR]

**Current spec:**

- Most side panels: 480px (fixed)
- Scenarios module: 40/60% split layout (completely different pattern)
- Master Data: 65/35% split

**Required:** A unified right panel width system:

- Default: 480px
- Compact: 320px (for Details/Activity/Help modes)
- Expanded: 560px (for form-heavy CRUD side panels)
- User-resizable via drag handle (min 280px, max 50% of workspace)
- The Scenarios module's split layout is a valid exception but should be noted as a "workspace variant" in the spec

---

### GAP-010 — No "Open in Right Panel" vs "Navigate To" Decision Rule [MINOR]

**Current spec:** Some interactions navigate to a new module (e.g., clicking "Go to Revenue" in P&L's stale prerequisites dialog). Others open a side panel. The decision rule is implicit.

**Required:** A documented rule in the global framework:

- **Navigate to module:** When the user needs to perform multi-step data entry or calculation
- **Open in right panel (Details mode):** When the user needs to view metadata, audit trail, or read-only detail without leaving their current context
- **Open in right panel (Form mode):** When the user is creating/editing a single record (< 10 fields)
- **Open full-page dialog:** Only for destructive confirmations (delete, lock, archive) — uses `<AlertDialog>` as currently specified

---

### GAP-011 — Master Data Right Panel Behavior Unspecified [MINOR]

**Current spec:** `08-master-data.md §2.1` shows a `Side Panel (480px) (hidden by default)` as part of the page layout (not the shell). This means Master Data would have TWO right panels — the shell-level one (GAP-001) and its own CRUD panel.

**Required:** Master Data CRUD side panels become the "Form mode" of the shell-level right panel. The `08-master-data.md` layout diagram should be updated to remove the per-page side panel and use the shell right panel instead.

---

## 3. What the Specs Get Right (No Change Needed)

- Design tokens, typography, spacing scale — comprehensive and implementation-ready
- Left sidebar specification (expanded/collapsed, RBAC visibility) — complete
- Context bar components (FY, Version, Compare, Period, Scenario, Save, Stale) — well-specified; needs reorganization (GAP-007) but not a redesign
- Data grid component (TanStack Table v8, no virtual scrolling) — correct and complete
- Cell editor types and inline validation — thorough
- Keyboard navigation (grid navigation, application shortcuts) — complete
- Auto-save behavior and conflict resolution — complete
- Comparison mode overlay columns — complete
- RBAC UI behavior per role — complete
- Toast notifications — correct component choice
- Empty states and loading skeletons — consistent across all modules
- Module toolbar pattern (Calculate, Export, More) — consistent
- All module-specific grids (Enrollment, Revenue, Staffing, P&L, Version Management, Scenarios, Master Data) — well-specified
- Accessibility (WCAG AA, ARIA, live regions, keyboard, screen reader announcements) — very thorough
- State management architecture (TanStack Query keys, Zustand stores, URL sync) — production-ready
- API endpoint contracts per module — complete

---

## 4. Fix Plan

### Phase 1: Shell Architecture (Blocks everything else)

**Task 1.1** — Update `00-global-framework.md §2` (Layout Shell)

- Add Section 2.4: Right Panel Architecture
- Update ASCII shell diagram to include right panel slot
- Specify right panel states: hidden (0px), compact (320px), expanded (480px), form (480px or 560px)
- Specify panel shift behavior (not overlay)
- Specify the right panel's left-edge mode icon strip
- Define `useRightPanelStore` Zustand store: `{ isOpen, mode, width, unreadActivityCount }`

**Task 1.2** — Update `00-global-framework.md §3` (Context Bar)

- Reorganize into 3 zones (left/center/right) per GAP-007
- Add breadcrumb to left zone (GAP-006)
- Add right panel toggle button to right zone (GAP-002)
- Define `Ctrl+Shift+P` shortcut

**Task 1.3** — Update `00-global-framework.md §4.4` (Side Panel)

- Rename to "Right Panel — Form Mode"
- Remove per-module management — all CRUD forms use the shell right panel in Form mode
- Remove the z-index:30 overlay specification
- Define how modules register their form content with the shell: `useRightPanelStore.openForm(content)`

**Task 1.4** — Update `00-global-framework.md §12` (Module Page Template)

- Remove `<SidePanel />` from the module page template
- Add right panel content registration to the `<ModulePage>` contract
- Define `RightPanelDetails`, `RightPanelActivity` as module-level exports consumed by the shell

**Task 1.5** — Update `00-global-framework.md §5.2` (Application Shortcuts)

- Add `Ctrl+Shift+P`: Toggle right panel
- Add `Ctrl+Shift+F`: Toggle focus mode (GAP-008)

### Phase 2: Activity & Details Panel Content

**Task 2.1** — Define Right Panel: Details Mode

- Version metadata display (version name, type, status, last calculated, stale flags)
- Available in all planning modules
- Source: `GET /versions/:versionId` + `GET /versions/:versionId/stale-flags`

**Task 2.2** — Define Right Panel: Activity Mode

- Event schema: `{ id, type, message, timestamp, moduleLink?, downloadUrl? }`
- Client-side event store (Zustand, session-only)
- Sources: calculation completions, export completions, save errors, version lifecycle changes
- Unread count badge on right panel toggle button

**Task 2.3** — Define Right Panel: Audit Mode

- Module-level audit entries for the current context (version + module)
- Source: `GET /api/v1/audit?versionId=&module=&limit=50`
- Complements the full Audit Trail module (read-only, contextual)

**Task 2.4** — Define Right Panel: Help Mode

- Static markdown content per module
- Module key actions, formula references, common errors
- Links to full documentation (external, future)

### Phase 3: Per-Module Updates (Reference Shell Panel)

**Task 3.1** — Update `02-version-management.md`

- Replace "Version Detail Side Panel (§8)" with "Version Details in Right Panel — Details mode"
- The CRUD side panels (Create, Clone) become "Right Panel — Form mode"

**Task 3.2** — Update `03-enrollment-capacity.md`

- CSV import side panel → Right Panel Form mode
- No new detail panel needed (no record-level drill-down in this module)

**Task 3.3** — Update `04-revenue.md` (not yet reviewed)

- Apply same pattern: CRUD side panels → Right Panel Form mode

**Task 3.4** — Update `05-staffing-costs.md`

- New/Edit Employee panel → Right Panel Form mode
- Bulk Import panel → Right Panel Form mode

**Task 3.5** — Update `06-pnl-reporting.md`

- No side panels in this module; add Details mode content (last calculation timestamp, prerequisite status)

**Task 3.6** — Update `07-scenarios.md`

- The split-panel layout (40% params + 60% preview) is a workspace variant — document it explicitly as such
- Add a note: this module uses an inline split instead of the right panel; the right panel is still available in Details/Activity/Help modes

**Task 3.7** — Update `08-master-data.md`

- Per-page side panel (§2.1 layout diagram) → Right Panel Form mode
- Remove the separate side panel layout from Section 2.1

**Task 3.8** — Review `09-admin.md` and `10-input-management.md` (not yet read)

- Apply same right panel pattern

### Phase 4: Supplementary Specs

**Task 4.1** — Add `00b-workspace-philosophy.md` (new document)
Content:

1. Workspace-first principle: zero full page reloads, all routing is SPA client-side transitions
2. Everything happens in the workspace — no app-external navigation
3. Progressive disclosure: toolbar action → inline edit in grid → right panel form → full dialog (destructive only)
4. Persistent context: sidebar + context bar always visible; right panel state survives navigation
5. Inline-first editing: cells are editable by double-click everywhere; no "edit mode" for entire pages
6. Immediate feedback: optimistic updates everywhere, save indicator always visible
7. Decision tree: when to navigate vs. open right panel vs. open dialog (GAP-010)

---

## 5. File Change Summary

| File                          | Change Type                                             | Priority |
| ----------------------------- | ------------------------------------------------------- | -------- |
| `00-global-framework.md`      | Major update (§2, §3, §4.4, §5.2, §11.2, §12)           | P0       |
| `00b-workspace-philosophy.md` | New document                                            | P0       |
| `02-version-management.md`    | Update §6, §7, §8 (side panel → right panel)            | P1       |
| `03-enrollment-capacity.md`   | Update §9 (import panel → right panel)                  | P1       |
| `05-staffing-costs.md`        | Update §6, §8 (employee/import panels → right panel)    | P1       |
| `06-pnl-reporting.md`         | Add Details mode content registration                   | P1       |
| `07-scenarios.md`             | Add workspace variant note; add right panel modes       | P2       |
| `08-master-data.md`           | Update §2.1 layout, replace side panel with right panel | P1       |
| `04-revenue.md`               | Review then update (not yet read)                       | P1       |
| `09-admin.md`                 | Review then update                                      | P2       |
| `10-input-management.md`      | Review then update                                      | P2       |
| `01-dashboard.md`             | Minor: add Details/Activity right panel content spec    | P2       |

---

## 6. Shell Architecture: Revised ASCII Diagram

```
+-------+------------------------------------------------------------+----------+
|       |  Context Bar (56px)                                        |          |
|       |  [Logo > FY2026/BudgetV2 > Module] [FY][Ver][Compare]...  |          |
|       |  ...[Period][Scenario]  [Stale][Save][Panel Toggle][User]  |          |
+-------+------------------------------------------------------------+    R     |
|       |  Module Toolbar (48px)                                     |    i     |
| Side- |                                                            |    g     |
| bar   |  Main Workspace (flex:1, min 800px)                        |    h     |
| (240  |                                                            |    t     |
|  or   |  Data grids, charts, split panels, tabs                    |          |
|  64px)|  Inline editing everywhere                                 |    P     |
|       |  No overlays — all panels dock to right                    |    a     |
|       |                                                            |    n     |
|       |                                                            |    e     |
|       |                                                            |    l     |
|       |                                                            |          |
|       |                                                            | (0/320/  |
|       |                                                            |  480px)  |
+-------+------------------------------------------------------------+----------+
  Fixed   Flexible width (responds to sidebar + right panel state)   Docked
  left                                                                right
```

**Right panel left-edge mode strip (top to bottom):**

```
[Info]       — Details mode
[Activity]   — Activity/notifications
[Clipboard]  — Audit trail
[HelpCircle] — Help
```

Active mode icon has `--color-info` left border (3px). The strip is 32px wide. The panel content is to the right of the strip.

---

## 7. New Zustand Store: `useRightPanelStore`

```typescript
type RightPanelMode = 'details' | 'activity' | 'audit' | 'help' | 'form';

interface RightPanelStore {
	// Panel state
	isOpen: boolean;
	mode: RightPanelMode;
	width: 320 | 480 | 560;

	// Form mode (replaces current per-module SidePanel)
	formContent: ReactNode | null;
	formTitle: string | null;

	// Activity
	events: ActivityEvent[];
	unreadCount: number;
	markAllRead: () => void;

	// Actions
	open: (mode?: RightPanelMode) => void;
	close: () => void;
	toggle: () => void;
	setMode: (mode: RightPanelMode) => void;
	openForm: (title: string, content: ReactNode) => void;
	closeForm: () => void;
	addEvent: (event: Omit<ActivityEvent, 'id' | 'timestamp'>) => void;
}

interface ActivityEvent {
	id: string;
	type: 'calculation' | 'export' | 'save_error' | 'lifecycle' | 'import';
	message: string;
	timestamp: Date;
	moduleLink?: string;
	downloadUrl?: string;
	read: boolean;
}
```

**Persistence:** `isOpen`, `mode`, `width` are persisted to `localStorage` (key: `budfin.rightPanel`). Events are session-only (no persistence).

---

## 8. Resolved Decisions (2026-03-06)

All questions from the original review have been resolved:

1. **Overlay fallback threshold:** When the right panel opens, the sidebar **auto-collapses to 64px** (icon-only). This gives ~776px workspace on a 1280px screen. User can manually expand sidebar, which auto-closes the right panel. Mutual exclusion at narrow viewports.

2. **Scenarios module:** Right panel uses **overlay mode** (z-index:30) instead of docking, since the 40/60 split layout already fills the workspace. Other planning modules still dock.

3. **Right panel in comparison mode:** When comparison toggle is turned ON in any planning module, right panel **auto-closes** to maximize horizontal viewport. User can manually re-open if they want.

4. **Audit mode vs Audit Trail module:** The distinction is clear -- right panel Audit shows contextual entries for the current version + module. The Admin Audit Trail module shows system-wide entries with full filtering.

5. **Two-Shell Architecture (new):** The workspace paradigm is NOT a single shell. Version Management, Master Data, and Admin render in ManagementShell (sidebar + toolbar only, NO context bar, NO docked panel). Planning modules render in PlanningShell (context bar + docked right panel). This eliminates the awkward "muted context bar" workaround.

---

## 9. Implementation Summary

All spec files updated on 2026-03-06:

| File                          | Change                                                                                    |
| ----------------------------- | ----------------------------------------------------------------------------------------- |
| `00-global-framework.md`      | Two-shell architecture, right panel spec, context bar 3-zone layout, two module templates |
| `00b-workspace-philosophy.md` | New document: workspace-first principles, progressive disclosure, decision tree           |
| `02-version-management.md`    | ManagementShell, FY in toolbar, simplified URL state                                      |
| `08-master-data.md`           | ManagementShell, removed muted context bar                                                |
| `09-admin.md`                 | ManagementShell, removed de-emphasized context bar                                        |
| `01-dashboard.md`             | PlanningShell note, removed per-module context bar                                        |
| `03-enrollment-capacity.md`   | PlanningShell note                                                                        |
| `04-revenue.md`               | PlanningShell note                                                                        |
| `05-staffing-costs.md`        | PlanningShell note                                                                        |
| `06-pnl-reporting.md`         | PlanningShell note, auto-close panel on comparison                                        |
| `07-scenarios.md`             | PlanningShell note, overlay mode for right panel                                          |
| `10-input-management.md`      | Overlay side panel within PlanningShell                                                   |
