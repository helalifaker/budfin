# Revenue Settings Dialog Pattern & Staffing Migration

## Overview

This document maps the **Revenue Settings Dialog** pattern to serve as a template for transforming the **Staffing Settings Sheet** from Sheet → Dialog. The revenue pattern is fully production-tested and suitable for replication.

## Revenue Settings Dialog Pattern

### 1. Component Structure

**File**: `apps/web/src/components/revenue/revenue-settings-dialog.tsx` (316 lines)

```
RevenueSettingsDialog (Props)
├── Props
│   ├── versionId: number
│   ├── isViewer: boolean
│   ├── onClose?: () => void
├── State management (Zustand stores)
│   ├── Dialog open/tab state
│   ├── Dirty tracking per-tab
│   └── Readiness data (from API)
├── Computed values
│   ├── dirtyTabs[] — tabs with changes
│   ├── dirtyTabNames — comma-joined labels
│   ├── readinessAreas[] — completion data
│   ├── completionPct — 0–100
│   └── pendingTab — for unsaved-changes dialog
├── Handlers
│   ├── handleOpenChange() — open/close + unsaved-changes check
│   ├── handleTabChange() — tab switching with dirty-state guard
│   ├── handleStayOnTab() — cancel pending tab switch
│   ├── handleSwitchTab() — confirm pending switch + clear tab
│   ├── handleDiscardClose() — close + discard all changes
│   ├── handleInteraction() — mark field as dirty
│   ├── handleContentClick() — detect "Save" button to clear tab
│   └── useEffect hooks (2) — auto-routing to incomplete tabs
└── JSX Structure
    ├── Dialog (main container)
    │   ├── DialogContent (h-[90vh] max-w-[90vw])
    │   │   ├── DialogHeader
    │   │   │   ├── Title + Description
    │   │   │   ├── "Setup progress" bar
    │   │   │   │   ├── readyCount / totalCount
    │   │   │   │   └── progress bar (completionPct)
    │   │   │   └── [empty line for spacing]
    │   │   └── Main flex container (flex-1)
    │   │       ├── LEFT sidebar (w-64, vertical tabs)
    │   │       │   └── TabsList (flex-col)
    │   │       │       ├── TabsTrigger (feeGrid)
    │   │       │       │   ├── Label
    │   │       │       │   └── ReadinessIndicator (sm)
    │   │       │       └── TabsTrigger (otherRevenue)
    │   │       │           ├── Label
    │   │       │           └── ReadinessIndicator (sm)
    │   │       └── RIGHT content (flex-1, flex-col)
    │   │           ├── ViewerBanner (if isViewer)
    │   │           ├── OverallReady warning (if not ready)
    │   │           ├── PendingTab warning (if switching)
    │   │           └── Content div
    │   │               └── Tabs (feeGrid, otherRevenue)
    │   │                   ├── TabsContent (feeGrid)
    │   │                   └── TabsContent (otherRevenue)
    └── AlertDialog (unsaved-changes confirmation)
        ├── Title + Description (lists dirtyTabNames)
        ├── Cancel + Discard buttons
```

### 2. Store Architecture

#### Dialog State Store

**File**: `apps/web/src/stores/revenue-settings-dialog-store.ts` (23 lines)

```typescript
interface RevenueSettingsDialogState {
    isOpen: boolean;
    activeTab: RevenueSettingsTab; // 'feeGrid' | 'otherRevenue'
    open: (tab?: RevenueSettingsTab) => void;
    close: () => void;
    setTab: (tab: RevenueSettingsTab) => void;
}
```

**Usage in component**:

```typescript
const isOpen = useRevenueSettingsDialogStore((state) => state.isOpen);
const activeTab = useRevenueSettingsDialogStore((state) => state.activeTab);
const setTab = useRevenueSettingsDialogStore((state) => state.setTab);
const close = useRevenueSettingsDialogStore((state) => state.close);
```

**API**: `open(tab?)`, `close()`, `setTab(tab)`

---

#### Dirty Tracking Store

**File**: `apps/web/src/stores/revenue-settings-dirty-store.ts` (36 lines)

```typescript
interface RevenueSettingsDirtyState {
    dirtyFields: Map<RevenueSettingsTab, Set<string>>;
    // Public API:
    markDirty(tab, fieldId): void;
    clearTab(tab): void;
    clearAll(): void;
    isTabDirty(tab): boolean;
    isAnyDirty(): boolean;
    getDirtyTabs(): RevenueSettingsTab[];
}
```

**Key design**:

- **Per-tab tracking** — `Map<TabId, Set<FieldIds>>`
- **Granular field IDs** — from `name`, `aria-label`, `id`, or element tag
- **Line 269–276** in dialog shows how to capture them:

```typescript
onInputCapture={(event) => {
  const target = event.target as HTMLElement;
  handleInteraction(
    target.getAttribute('name') ??
      target.getAttribute('aria-label') ??
      target.getAttribute('id') ??
      target.tagName.toLowerCase()
  );
}}
```

---

### 3. Readiness Data Flow

**Hook**: `useRevenueReadiness(versionId)` (line 148–153 in use-revenue.ts)

```typescript
export function useRevenueReadiness(versionId: number | null) {
    return useQuery({
        queryKey: ['revenue', 'readiness', versionId],
        queryFn: () =>
            apiClient<RevenueReadinessResponse>(`/versions/${versionId}/revenue/readiness`),
        enabled: versionId !== null,
    });
}
```

**API response type** (from line 1–27 in revenue-readiness.ts):

```typescript
interface RevenueReadinessArea {
    key: 'feeGrid' | 'otherRevenue';
    label: string;
    tab: RevenueSettingsTab;
    ready: boolean;
}

// Helper functions
function getRevenueReadinessAreas(readiness): RevenueReadinessArea[];
function getFirstIncompleteRevenueTab(readiness): RevenueSettingsTab;
function getRevenueTabReadiness(tab, readiness): { ready; total };
```

**Usage in dialog**:

- Line 72: `const readinessAreas = useMemo(() => getRevenueReadinessAreas(readiness), [readiness]);`
- Line 222–226: Per-tab indicator `<ReadinessIndicator ready={...} total={...} size="sm" />`
- Line 159–176: Auto-routing logic — jump to first incomplete tab on dialog open

---

### 4. Tab Content Pattern

**Tab content is a child component** — passed via `<TabsContent>`:

```typescript
<TabsContent value="feeGrid">
  <FeeGridTab
    versionId={versionId}
    academicPeriod="both"
    isReadOnly={isViewer}
  />
</TabsContent>
<TabsContent value="otherRevenue">
  <OtherRevenueTab versionId={versionId} isReadOnly={isViewer} />
</TabsContent>
```

**Key**: Tab content components receive:

- `versionId` — to fetch their own data via React Query hooks
- `isReadOnly` — viewer mode propagation
- No state lifting — each tab manages its own state/mutations

**Mutation pattern** (from use-revenue.ts):

```typescript
export function usePutFeeGrid(versionId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entries) => apiClient(...),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['revenue', 'fee-grid', versionId] });
      queryClient.invalidateQueries({ queryKey: ['revenue', 'readiness', versionId] });
      queryClient.invalidateQueries({ queryKey: ['versions'] });
    },
    onError: (err) => toast.error(...),
  });
}
```

---

### 5. Unsaved Changes Workflow

**Dirty tab detection** (line 66–70):

```typescript
const dirtyTabs = useMemo(
    () => [...dirtyFields.entries()].filter(([, fields]) => fields.size > 0).map(([tab]) => tab),
    [dirtyFields]
);
const hasDirtyTabs = dirtyTabs.length > 0;
```

**On tab switch attempt** (line 98–110):

1. Check if active tab has dirty fields
2. If yes, set `pendingTab` (render warning)
3. User clicks "Stay" or "Switch"

**On dialog close** (line 83–96):

1. If dirty tabs exist, open discard confirmation
2. User confirms or cancels

**After save** (line 147–149):

```typescript
onClickCapture = { handleContentClick };
// Detect button with text starting "Save " and clear that tab
```

---

### 6. API Integration

**All mutations invalidate**:

1. The specific query (e.g., `fee-grid`)
2. The `readiness` query (triggers re-render of progress bar + indicators)
3. The `versions` query (marks module stale on workspace context)

---

## Staffing Settings Sheet — Current State

**File**: `apps/web/src/components/staffing/staffing-settings-sheet.tsx` (1004 lines)

### Structure Overview

```
StaffingSettingsSheet (Props)
├── Props
│   ├── versionId: number | null
│   ├── isEditable: boolean
├── Data hooks (9)
│   ├── useStaffingSettings()
│   ├── useServiceProfiles()
│   ├── useServiceProfileOverrides()
│   ├── useDhgRules()
│   ├── useLyceeGroupAssumptions()
│   ├── useCostAssumptions()
│   ├── useHeadcount()
│   └── useStaffingSummary()
├── Draft state (4 local useState)
│   ├── draftHsa: DraftHsaSettings | null
│   ├── draftOrs: DraftOrsOverride[]
│   ├── draftCost: DraftCostAssumption[]
│   └── draftLycee: DraftLyceeGroup[]
├── Change detection (4 useMemo)
│   ├── hsaChanged
│   ├── orsChanged
│   ├── costChanged
│   ├── lyceeChanged
│   └── hasChanges (OR of above 4)
├── Handler functions
│   ├── handleSave() — batches 4 mutations
│   ├── getOrsValue() — read from draft or original
│   ├── updateOrs() — mutate draftOrs array
│   └── computeMonthlyPreview() — display helper
└── JSX (Sheet container)
    ├── SheetHeader
    │   ├── Title: "Staffing Settings"
    │   └── Description
    ├── Tabs (6 or 5)
    │   ├── Tab 1: Service Profiles & HSA (rows 418–587)
    │   │   ├── Profile table (readonly)
    │   │   │   └── ORS override inputs (editable)
    │   │   └── 4 HSA settings inputs
    │   ├── Tab 2: Curriculum / DHG Rules (rows 590–657)
    │   │   ├── Read-only tables grouped by band
    │   │   └── "Edit in Master Data" link
    │   ├── Tab 3: Lycee Group Assumptions (rows 660–748)
    │   │   └── Editable group count + hours/group table
    │   ├── Tab 4: Cost Assumptions (rows 751–845)
    │   │   └── 5 categories: select mode + value input + monthly preview
    │   ├── Tab 5: Enrollment Link (rows 848–904)
    │   │   ├── AY2 headcount table (readonly)
    │   │   ├── Stale warning if ENROLLMENT is stale
    │   │   └── "Go to Enrollment" button
    │   └── Tab 6: Reconciliation (rows 907–973)
    │       └── FTE + Cost metrics vs. baseline (readonly)
    └── SheetFooter
        ├── "No unsaved changes" / "Saving will mark STAFFING stale" message
        └── Close + Save buttons
```

### Data Loading & Mutations

- **9 data queries** — all enabled when `versionId !== null`
- **4 separate mutations** — `putSettings`, `putOverrides`, `putCostAssumptions`, `putLyceeGroup`
- **Batching**: `handleSave()` calls all 4 if their data changed
- **isSaving**: OR of all 4 mutation pending states (line 316–320)

### Draft State Management

```typescript
// On sheet open (line 238–273):
useEffect(() => {
  if (!isOpen) return;
  startTransition(() => {
    setDraftHsa({...});
    setDraftOrs([...]);
    setDraftCost([...]);
    setDraftLycee([...]);
  });
}, [isOpen, settings, overrides, costAssumptions, lyceeAssumptions]);
```

### Change Detection

```typescript
const hsaChanged = useMemo(() => {
  if (!draftHsa || !settings) return false;
  return (
    draftHsa.hsaTargetHours !== settings.hsaTargetHours ||
    // ... 3 more checks
  );
}, [draftHsa, settings]);

// Similar for orsChanged, costChanged, lyceeChanged
const hasChanges = hsaChanged || orsChanged || costChanged || lyceeChanged;
```

---

## Transformation Plan: Sheet → Dialog

### Phase 1: Create Store Layer (Reuse Revenue Pattern)

1. **Create `staffing-settings-dialog-store.ts`**
    - Mirror `revenue-settings-dialog-store.ts`
    - State: `{ isOpen, activeTab: StaffingSettingsTab, open(), close(), setTab() }`
    - Define `StaffingSettingsTab = 'profiles' | 'curriculum' | 'lycee' | 'cost' | 'enrollment' | 'reconciliation'`

2. **Create `staffing-settings-dirty-store.ts`**
    - Mirror `revenue-settings-dirty-store.ts`
    - Same dirty tracking API

3. **Create `staffing-readiness.ts`** (optional, if implementing readiness indicators)
    - Helper functions to parse staffing readiness API
    - `getStaffingReadinessAreas()`, `getFirstIncompleteTab()`, `getTabReadiness()`

### Phase 2: Refactor Component as Dialog

1. **Replace `<Sheet>` with `<Dialog>`**
    - Copy structure from `RevenueSettingsDialog`
    - Use `DialogContent` instead of `SheetContent`
    - Keep `h-[90vh] max-w-[90vw]` sizing

2. **Implement sidebar + content layout**
    - LEFT: Vertical tab list with readiness badges (if implemented)
    - RIGHT: Scrollable content area

3. **Extract tab content to child components**
    - `ServiceProfilesTab.tsx` — Tab 1
    - `CurriculumTab.tsx` — Tab 2
    - `LyceeGroupTab.tsx` — Tab 3 (conditional)
    - `CostAssumptionsTab.tsx` — Tab 4
    - `EnrollmentTab.tsx` — Tab 5
    - `ReconciliationTab.tsx` — Tab 6

4. **Simplify parent state management**
    - Remove all draft state (`draftHsa`, `draftOrs`, etc.)
    - Remove all change detection logic
    - Remove `handleSave()` batching
    - Let each tab own its state + mutations

5. **Implement unsaved-changes dialog**
    - Detect dirty tabs on tab switch
    - Warn before closing
    - Mirror Revenue pattern (lines 98–110, 83–96)

### Phase 3: Implement Auto-Routing (Optional)

If staffing readiness API exists:

1. Add readiness indicator to each tab trigger
2. Auto-route to first incomplete tab on dialog open
3. Show progress bar in header (like Revenue)

### Phase 4: Update Tests

- Migrate from `SheetContent` → `DialogContent`
- Keep tab-specific test suites
- Add dirty-state and unsaved-changes tests

---

## Key Differences: Revenue vs. Staffing

| Aspect            | Revenue                               | Staffing (Current)                 |
| ----------------- | ------------------------------------- | ---------------------------------- |
| **Container**     | Dialog                                | Sheet                              |
| **Tabs**          | 2 (feeGrid, otherRevenue)             | 6 (or 5 if no groups)              |
| **Layout**        | Left sidebar + right content          | Vertical tab list + inline content |
| **Data queries**  | 2–3 per tab                           | 9 global                           |
| **Mutations**     | 2–3 per tab                           | 4 global (batched)                 |
| **Readiness**     | API-driven `RevenueReadinessResponse` | Not yet implemented                |
| **Draft state**   | Per-tab, managed by tab component     | All in parent (4 useState)         |
| **Tab switching** | Blocks on dirty + warns               | Direct switch (no guards)          |
| **Auto-routing**  | Yes (to first incomplete)             | Not implemented                    |

---

## Implementation Checklist

### Pre-rewrite

- [ ] Create new stores (`staffing-settings-dialog-store.ts`, `staffing-settings-dirty-store.ts`)
- [ ] Define `StaffingSettingsTab` type in `@budfin/types`
- [ ] Plan readiness API (if needed)

### Component Migration

- [ ] Replace Sheet → Dialog container
- [ ] Implement left sidebar + right content layout
- [ ] Extract each tab to a child component
- [ ] Move data queries to child components (or centralize per tab)
- [ ] Move mutations to child components

### Dirty Tracking & Unsaved Changes

- [ ] Wire up dirty store in main dialog
- [ ] Add `onInputCapture` to detect field interactions
- [ ] Implement tab-switch guards
- [ ] Implement close-with-unsaved confirmation

### Testing

- [ ] Update component to use `DialogContent` in tests
- [ ] Verify each tab renders and is editable
- [ ] Test dirty-state detection
- [ ] Test unsaved-changes warnings

### Documentation

- [ ] Update right-panel registry if needed
- [ ] Document new stores in codebase
- [ ] Update CLAUDE.md with staffing settings pattern

---

## Notes for Implementation

1. **Sheet → Dialog is not just a style change**. The unsaved-changes workflow requires a different UX:
    - Sheet uses right-slide + overlay
    - Dialog uses centered modal + backdrop
    - Closing behavior differs (Sheet can be swiped; Dialog requires button)

2. **Tab content components should be dumb**:
    - Each receives `versionId`, `isEditable` only
    - Each manages its own state + mutations
    - Parent only manages open/close + tab selection

3. **Dirty tracking is granular**:
    - Track by field ID (name, aria-label, id, or tag)
    - Allows showing "unsaved changes in X" message
    - Allows clearing dirty state per-tab on save

4. **Avoid over-engineering readiness** initially:
    - Revenue pattern includes auto-routing + readiness indicators
    - Staffing can start without these; add later if needed
    - Core pattern is just Dialog + dirty tracking + unsaved-changes warning

5. **Mutation strategy**:
    - Keep each mutation independent
    - Invalidate `['staffing', 'readiness', versionId]` if readiness API exists
    - Invalidate `['versions']` to update staleModules
    - Let TanStack Query handle deduplication

---
