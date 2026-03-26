# OpEx Planning Workspace — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the OpEx planning page from a manual data-entry form into an Excel-like planning workspace with entry modes, school calendar awareness, initialization flow, and batch saves.

**Architecture:** 4-phase approach. Phase 1 upgrades shared grid infrastructure (benefits all pages). Phase 2 adds OpEx data model + engine changes. Phase 3 builds the OpEx UI overhaul. Phase 4 adds initialization and drag-and-drop. Each phase produces working, testable software.

**Tech Stack:** Fastify 5, Prisma 6 (PostgreSQL), Zod 4, React 19, TanStack Table v8, Zustand, Tailwind CSS v4, Vitest

**Spec:** `docs/plans/2026-03-26-opex-planning-workspace-redesign.md`

---

## Chunk 1: Design Tokens + Grid Infrastructure (Phase 1)

### Task 1: Add Entry Mode + Inactive Cell Design Tokens

**Files:**

- Modify: `apps/web/src/index.css`

- [ ] **Step 1: Add entry mode and inactive cell tokens to `:root`**

In `apps/web/src/index.css`, find the section with `--cell-editable-bg` (around line 180-190) and add after the existing cell tokens:

```css
/* Entry mode badge colors */
--entry-mode-flat: var(--info);
--entry-mode-flat-bg: var(--info-bg);
--entry-mode-seasonal: var(--success);
--entry-mode-seasonal-bg: var(--success-bg);
--entry-mode-annual: var(--error);
--entry-mode-annual-bg: var(--error-bg);
--entry-mode-revenue: var(--version-locked);
--entry-mode-revenue-bg: var(--version-locked-bg);

/* Inactive month cells */
--cell-inactive-bg: var(--workspace-bg);
--cell-inactive-text: var(--text-muted);

/* Drag and drop */
--grid-drop-zone-bg: color-mix(in srgb, var(--accent-100) 50%, transparent);
--grid-drop-zone-border: var(--accent-300);
```

- [ ] **Step 2: Add dark theme overrides**

In the `.dark { }` block (around line 400+), add:

```css
--entry-mode-flat-bg: color-mix(in srgb, var(--info) 20%, var(--workspace-bg-card));
--entry-mode-seasonal-bg: color-mix(in srgb, var(--success) 20%, var(--workspace-bg-card));
--entry-mode-annual-bg: color-mix(in srgb, var(--error) 20%, var(--workspace-bg-card));
--entry-mode-revenue-bg: color-mix(in srgb, var(--version-locked) 20%, var(--workspace-bg-card));
--cell-inactive-bg: color-mix(in srgb, var(--workspace-bg) 80%, black);
```

- [ ] **Step 3: Verify tokens render correctly**

Run: `pnpm dev` and inspect a page element in DevTools. Confirm `--entry-mode-flat` resolves to the `--info` color value and `--cell-inactive-bg` resolves correctly in both light and dark mode.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/index.css
git commit -m "feat: add entry mode + inactive cell design tokens to global CSS"
```

---

### Task 2: Enhance EditableCell with Overwrite-on-Type + F2

**Files:**

- Modify: `apps/web/src/components/data-grid/editable-cell.tsx`
- Test: `apps/web/src/components/data-grid/editable-cell.test.tsx`

- [ ] **Step 1: Write failing tests for new editing modes**

Create or extend the test file. Key test cases:

```typescript
// editable-cell.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EditableCell } from './editable-cell'

describe('EditableCell overwrite-on-type', () => {
	it('should enter edit mode and replace value when user types a digit', async () => {
		const onChange = vi.fn()
		render(<EditableCell value="500" onChange={onChange} type="number" />)
		const cell = screen.getByRole('button')
		// Focus the cell
		cell.focus()
		// Type a digit — should enter edit mode with just that digit
		await userEvent.keyboard('3')
		const input = screen.getByRole('textbox') // or spinbutton
		expect(input).toHaveValue('3')
	})

	it('should enter edit mode with cursor in existing value on F2', async () => {
		const onChange = vi.fn()
		render(<EditableCell value="500" onChange={onChange} type="number" />)
		const cell = screen.getByRole('button')
		cell.focus()
		await userEvent.keyboard('{F2}')
		const input = screen.getByRole('textbox')
		expect(input).toHaveValue('500')
	})

	it('should NOT enter edit mode on arrow key press', async () => {
		const onChange = vi.fn()
		render(<EditableCell value="500" onChange={onChange} type="number" />)
		const cell = screen.getByRole('button')
		cell.focus()
		await userEvent.keyboard('{ArrowDown}')
		expect(screen.queryByRole('textbox')).toBeNull()
	})
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @budfin/web exec vitest run src/components/data-grid/editable-cell.test.tsx`
Expected: FAIL — overwrite-on-type and F2 not yet implemented.

- [ ] **Step 3: Implement overwrite-on-type and F2**

In `editable-cell.tsx`, modify the focused (non-editing) state to listen for keydown:

```typescript
// In the button/display element's onKeyDown handler:
const handleDisplayKeyDown = (e: React.KeyboardEvent) => {
    if (isReadOnly) return;

    // F2 — enter edit mode with existing value
    if (e.key === 'F2') {
        e.preventDefault();
        setIsEditing(true);
        // editValue keeps current value
        return;
    }

    // Printable character — enter edit mode with just that character (overwrite)
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setEditValue(e.key);
        setIsEditing(true);
        return;
    }

    // Delete/Backspace — clear to zero
    if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        onChange('0');
        return;
    }

    // Navigation keys — propagate to parent (onNavigate)
    if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter', 'Home', 'End'].includes(
            e.key
        )
    ) {
        // Let parent grid handle navigation
        return;
    }
};
```

When entering edit mode via overwrite (printable char), the input should be initialized with just that character, cursor at end. When entering via F2, keep existing value, cursor at end.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @budfin/web exec vitest run src/components/data-grid/editable-cell.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/data-grid/editable-cell.tsx apps/web/src/components/data-grid/editable-cell.test.tsx
git commit -m "feat: add overwrite-on-type and F2 edit mode to EditableCell"
```

---

### Task 3: Enhance useGridClipboard with Fill Down + Fill Right

**Files:**

- Modify: `apps/web/src/hooks/use-grid-clipboard.ts`
- Test: `apps/web/src/hooks/use-grid-clipboard.test.ts`

- [ ] **Step 1: Write failing tests for fill-down and fill-right**

```typescript
// use-grid-clipboard.test.ts
import { renderHook, act } from '@testing-library/react';
import { useGridClipboard } from './use-grid-clipboard';

describe('useGridClipboard fill operations', () => {
    const getCellValue = (row: number, colId: string) => `${row}-${colId}`;
    const onPaste = vi.fn();

    it('fillDown should copy top row value to all selected rows', () => {
        const { result } = renderHook(() =>
            useGridClipboard({
                enabled: true,
                columnIds: ['m1', 'm2', 'm3'],
                editableColumns: ['m1', 'm2', 'm3'],
                getCellValue: (row, col) => (row === 0 ? '100' : '0'),
                onPaste,
            })
        );
        const selection = {
            anchor: { rowIndex: 0, colIndex: 0, colId: 'm1' },
            focus: { rowIndex: 3, colIndex: 0, colId: 'm1' },
            range: [
                { rowIndex: 0, colIndex: 0, colId: 'm1' },
                { rowIndex: 1, colIndex: 0, colId: 'm1' },
                { rowIndex: 2, colIndex: 0, colId: 'm1' },
                { rowIndex: 3, colIndex: 0, colId: 'm1' },
            ],
        };
        act(() => result.current.fillDown(selection));
        expect(onPaste).toHaveBeenCalledWith(1, 0, [['100'], ['100'], ['100']]);
    });

    it('fillRight should copy leftmost column value to all selected columns', () => {
        const { result } = renderHook(() =>
            useGridClipboard({
                enabled: true,
                columnIds: ['m1', 'm2', 'm3'],
                editableColumns: ['m1', 'm2', 'm3'],
                getCellValue: (row, col) => (col === 'm1' ? '200' : '0'),
                onPaste,
            })
        );
        const selection = {
            anchor: { rowIndex: 0, colIndex: 0, colId: 'm1' },
            focus: { rowIndex: 0, colIndex: 2, colId: 'm3' },
            range: [
                { rowIndex: 0, colIndex: 0, colId: 'm1' },
                { rowIndex: 0, colIndex: 1, colId: 'm2' },
                { rowIndex: 0, colIndex: 2, colId: 'm3' },
            ],
        };
        act(() => result.current.fillRight(selection));
        expect(onPaste).toHaveBeenCalledWith(0, 1, [['200', '200']]);
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @budfin/web exec vitest run src/hooks/use-grid-clipboard.test.ts`
Expected: FAIL — `fillDown` and `fillRight` not yet exported.

- [ ] **Step 3: Implement fillDown and fillRight**

Add to `use-grid-clipboard.ts`:

```typescript
const fillDown = useCallback(
    (selection: GridSelection) => {
        if (!selection || selection.range.length < 2) return;
        // Group by column
        const colGroups = new Map<number, CellCoord[]>();
        for (const cell of selection.range) {
            const group = colGroups.get(cell.colIndex) ?? [];
            group.push(cell);
            colGroups.set(cell.colIndex, group);
        }
        // For each column, copy the topmost row's value to all rows below
        const data: string[][] = [];
        const minRow = Math.min(...selection.range.map((c) => c.rowIndex));
        const maxRow = Math.max(...selection.range.map((c) => c.rowIndex));
        for (let row = minRow + 1; row <= maxRow; row++) {
            const rowData: string[] = [];
            for (const [colIndex, cells] of colGroups) {
                if (!editableColumns?.includes(columnIds[colIndex])) continue;
                const topValue = getCellValue?.(minRow, columnIds[colIndex]) ?? '';
                rowData.push(topValue);
            }
            data.push(rowData);
        }
        const startCol = Math.min(...colGroups.keys());
        onPaste?.(minRow + 1, startCol, data);
    },
    [getCellValue, onPaste, editableColumns, columnIds]
);

const fillRight = useCallback(
    (selection: GridSelection) => {
        if (!selection || selection.range.length < 2) return;
        // Group by row
        const rowGroups = new Map<number, CellCoord[]>();
        for (const cell of selection.range) {
            const group = rowGroups.get(cell.rowIndex) ?? [];
            group.push(cell);
            rowGroups.set(cell.rowIndex, group);
        }
        const minCol = Math.min(...selection.range.map((c) => c.colIndex));
        const data: string[][] = [];
        for (const [rowIndex, cells] of rowGroups) {
            const leftValue = getCellValue?.(rowIndex, columnIds[minCol]) ?? '';
            const rowData: string[] = [];
            for (const cell of cells) {
                if (cell.colIndex === minCol) continue;
                if (!editableColumns?.includes(columnIds[cell.colIndex])) continue;
                rowData.push(leftValue);
            }
            data.push(rowData);
        }
        const minRow = Math.min(...rowGroups.keys());
        onPaste?.(minRow, minCol + 1, data);
    },
    [getCellValue, onPaste, editableColumns, columnIds]
);
```

Return `fillDown` and `fillRight` from the hook.

- [ ] **Step 4: Wire Ctrl+D and Ctrl+R in useGridKeyboard**

In `use-grid-keyboard.ts`, find the keydown handler and add:

```typescript
// Ctrl+D — fill down
if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
    e.preventDefault();
    clipboard?.fillDown(selection);
    return;
}
// Ctrl+R — fill right
if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
    e.preventDefault();
    clipboard?.fillRight(selection);
    return;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @budfin/web exec vitest run src/hooks/use-grid-clipboard.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/hooks/use-grid-clipboard.ts apps/web/src/hooks/use-grid-clipboard.test.ts apps/web/src/hooks/use-grid-keyboard.ts
git commit -m "feat: add fill-down (Ctrl+D) and fill-right (Ctrl+R) to grid clipboard"
```

---

### Task 4: Create useGridUndoRedo Hook

**Files:**

- Create: `apps/web/src/hooks/use-grid-undo-redo.ts`
- Test: `apps/web/src/hooks/use-grid-undo-redo.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// use-grid-undo-redo.test.ts
import { renderHook, act } from '@testing-library/react';
import { useGridUndoRedo } from './use-grid-undo-redo';

describe('useGridUndoRedo', () => {
    it('should push changes and undo them', () => {
        const { result } = renderHook(() => useGridUndoRedo());
        act(() =>
            result.current.push({
                type: 'cell-edit',
                cellKey: '1-m1',
                oldValue: '100',
                newValue: '200',
            })
        );
        expect(result.current.canUndo).toBe(true);
        expect(result.current.canRedo).toBe(false);

        const undone = act(() => result.current.undo());
        expect(result.current.canUndo).toBe(false);
        expect(result.current.canRedo).toBe(true);
    });

    it('should redo after undo', () => {
        const { result } = renderHook(() => useGridUndoRedo());
        act(() =>
            result.current.push({
                type: 'cell-edit',
                cellKey: '1-m1',
                oldValue: '100',
                newValue: '200',
            })
        );
        act(() => result.current.undo());
        const redone = act(() => result.current.redo());
        expect(result.current.canUndo).toBe(true);
        expect(result.current.canRedo).toBe(false);
    });

    it('should clear redo stack on new push after undo', () => {
        const { result } = renderHook(() => useGridUndoRedo());
        act(() =>
            result.current.push({
                type: 'cell-edit',
                cellKey: '1-m1',
                oldValue: '0',
                newValue: '100',
            })
        );
        act(() =>
            result.current.push({
                type: 'cell-edit',
                cellKey: '1-m2',
                oldValue: '0',
                newValue: '200',
            })
        );
        act(() => result.current.undo());
        act(() =>
            result.current.push({
                type: 'cell-edit',
                cellKey: '1-m3',
                oldValue: '0',
                newValue: '300',
            })
        );
        expect(result.current.canRedo).toBe(false);
    });

    it('should clear all stacks on flush', () => {
        const { result } = renderHook(() => useGridUndoRedo());
        act(() =>
            result.current.push({
                type: 'cell-edit',
                cellKey: '1-m1',
                oldValue: '0',
                newValue: '100',
            })
        );
        act(() => result.current.flush());
        expect(result.current.canUndo).toBe(false);
        expect(result.current.canRedo).toBe(false);
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @budfin/web exec vitest run src/hooks/use-grid-undo-redo.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the hook**

```typescript
// use-grid-undo-redo.ts
import { useCallback, useRef, useSyncExternalStore } from 'react';

export interface UndoEntry {
    type: 'cell-edit' | 'bulk-edit';
    cellKey: string;
    oldValue: string;
    newValue: string;
}

interface UndoRedoState {
    undoStack: UndoEntry[];
    redoStack: UndoEntry[];
}

export function useGridUndoRedo() {
    const stateRef = useRef<UndoRedoState>({ undoStack: [], redoStack: [] });
    const versionRef = useRef(0);
    const listenersRef = useRef(new Set<() => void>());

    const subscribe = useCallback((listener: () => void) => {
        listenersRef.current.add(listener);
        return () => listenersRef.current.delete(listener);
    }, []);

    const notify = useCallback(() => {
        versionRef.current++;
        listenersRef.current.forEach((l) => l());
    }, []);

    const getSnapshot = useCallback(() => versionRef.current, []);

    useSyncExternalStore(subscribe, getSnapshot);

    const push = useCallback(
        (entry: UndoEntry) => {
            stateRef.current.undoStack.push(entry);
            stateRef.current.redoStack = []; // new action clears redo
            notify();
        },
        [notify]
    );

    const undo = useCallback((): UndoEntry | null => {
        const entry = stateRef.current.undoStack.pop();
        if (!entry) return null;
        stateRef.current.redoStack.push(entry);
        notify();
        return entry;
    }, [notify]);

    const redo = useCallback((): UndoEntry | null => {
        const entry = stateRef.current.redoStack.pop();
        if (!entry) return null;
        stateRef.current.undoStack.push(entry);
        notify();
        return entry;
    }, [notify]);

    const flush = useCallback(() => {
        stateRef.current = { undoStack: [], redoStack: [] };
        notify();
    }, [notify]);

    return {
        push,
        undo,
        redo,
        flush,
        canUndo: stateRef.current.undoStack.length > 0,
        canRedo: stateRef.current.redoStack.length > 0,
        pendingCount: stateRef.current.undoStack.length,
    };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @budfin/web exec vitest run src/hooks/use-grid-undo-redo.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/hooks/use-grid-undo-redo.ts apps/web/src/hooks/use-grid-undo-redo.test.ts
git commit -m "feat: add useGridUndoRedo hook for local undo/redo buffer"
```

---

## Chunk 2: Data Model Migration + Types (Phase 2, Part A)

### Task 5: Prisma Migration — Entry Mode Fields + School Calendar

**Files:**

- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_add_opex_entry_modes/migration.sql` (auto-generated)

- [ ] **Step 1: Add new fields to VersionOpExLineItem model**

In `schema.prisma`, find the `VersionOpExLineItem` model and add after the `comment` field:

```prisma
entryMode          String   @default("SEASONAL") @map("entry_mode")
activeMonths       Int[]    @default([]) @map("active_months")
annualTotal        Decimal? @db.Decimal(15, 4) @map("annual_total")
flatAmount         Decimal? @db.Decimal(15, 4) @map("flat_amount")
flatOverrideMonths Int[]    @default([]) @map("flat_override_months")
```

- [ ] **Step 2: Add schoolCalendarMonths to BudgetVersion model**

In `schema.prisma`, find the `BudgetVersion` model and add:

```prisma
schoolCalendarMonths Int[] @default([1, 2, 3, 4, 5, 6, 9, 10, 11, 12]) @map("school_calendar_months")
```

- [ ] **Step 3: Generate and customize migration**

Run: `pnpm --filter @budfin/api exec prisma migrate dev --name add_opex_entry_modes --create-only`

Then edit the generated SQL to populate `entryMode` from `computeMethod`:

```sql
-- Add new columns
ALTER TABLE "version_opex_line_items" ADD COLUMN "entry_mode" TEXT NOT NULL DEFAULT 'SEASONAL';
ALTER TABLE "version_opex_line_items" ADD COLUMN "active_months" INTEGER[] DEFAULT '{}';
ALTER TABLE "version_opex_line_items" ADD COLUMN "annual_total" DECIMAL(15,4);
ALTER TABLE "version_opex_line_items" ADD COLUMN "flat_amount" DECIMAL(15,4);
ALTER TABLE "version_opex_line_items" ADD COLUMN "flat_override_months" INTEGER[] DEFAULT '{}';
ALTER TABLE "budget_versions" ADD COLUMN "school_calendar_months" INTEGER[] DEFAULT '{1,2,3,4,5,6,9,10,11,12}';

-- Populate entryMode from computeMethod
UPDATE "version_opex_line_items"
SET "entry_mode" = CASE
    WHEN "compute_method" = 'PERCENT_OF_REVENUE' THEN 'PERCENT_OF_REVENUE'
    ELSE 'SEASONAL'
END;
```

- [ ] **Step 4: Apply migration**

Run: `pnpm --filter @budfin/api exec prisma migrate dev`
Expected: Migration applies successfully.

- [ ] **Step 5: Regenerate Prisma client**

Run: `pnpm --filter @budfin/api exec prisma generate`

- [ ] **Step 6: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat: add entry mode fields and school calendar to Prisma schema"
```

---

### Task 6: Update @budfin/types — Replace OpExComputeMethod with OpExEntryMode

**Files:**

- Modify: `packages/types/src/opex.ts`

- [ ] **Step 1: Add new entry mode type and update interfaces**

```typescript
// Add new entry mode constant
export const OPEX_ENTRY_MODES = [
    'FLAT',
    'SEASONAL',
    'ANNUAL_SPREAD',
    'PERCENT_OF_REVENUE',
] as const;
export type OpExEntryMode = (typeof OPEX_ENTRY_MODES)[number];

// Update OpExLineItem interface — add new fields alongside existing ones
// (computeMethod kept temporarily for backward compat during migration)
export interface OpExLineItem {
    id: number;
    versionId: number;
    sectionType: OpExSectionType;
    ifrsCategory: string;
    lineItemName: string;
    displayOrder: number;
    computeMethod: OpExComputeMethod; // DEPRECATED — use entryMode
    entryMode: OpExEntryMode;
    computeRate: string | null;
    budgetV6Total: string | null;
    fy2025Actual: string | null;
    fy2024Actual: string | null;
    comment: string | null;
    activeMonths: number[];
    annualTotal: string | null;
    flatAmount: string | null;
    flatOverrideMonths: number[];
    monthlyAmounts: MonthlyOpExEntry[];
}

// Update OpExLineItemUpdate
export interface OpExLineItemUpdate {
    id?: number;
    sectionType: OpExSectionType;
    ifrsCategory: string;
    lineItemName: string;
    displayOrder?: number;
    entryMode?: OpExEntryMode;
    computeRate?: string | null;
    budgetV6Total?: string | null;
    fy2025Actual?: string | null;
    fy2024Actual?: string | null;
    comment?: string | null;
    activeMonths?: number[];
    annualTotal?: string | null;
    flatAmount?: string | null;
    flatOverrideMonths?: number[];
    monthlyAmounts: MonthlyOpExEntry[];
}

// Add initialize types
export interface OpExInitializePayload {
    source: 'PRIOR_YEAR_ACTUALS' | 'VERSION';
    sourceVersionId?: number;
    priorYear?: 'FY2025' | 'FY2024';
}

// Add reorder types
export interface OpExReorderPayload {
    moves: Array<{
        lineItemId: number;
        ifrsCategory: string;
        displayOrder: number;
    }>;
}

// Add line item patch types
export interface OpExLineItemPatch {
    entryMode?: OpExEntryMode;
    activeMonths?: number[];
    ifrsCategory?: string;
    displayOrder?: number;
    comment?: string | null;
    lineItemName?: string;
    annualTotal?: string | null;
    flatAmount?: string | null;
    flatOverrideMonths?: number[];
    computeRate?: string | null;
}
```

- [ ] **Step 2: Build types package to verify**

Run: `pnpm --filter @budfin/types build` (or `pnpm typecheck`)
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add packages/types/src/opex.ts
git commit -m "feat: add OpExEntryMode type and entry mode fields to OpEx interfaces"
```

---

### Task 7: Update OpEx Engine — FLAT + ANNUAL_SPREAD Modes

**Files:**

- Modify: `apps/api/src/services/opex/opex-engine.ts`
- Test: `apps/api/src/services/opex/opex-engine.test.ts`

- [ ] **Step 1: Write failing tests for FLAT mode computation**

```typescript
// In opex-engine.test.ts, add:
describe('computeOpEx with entry modes', () => {
    it('should compute FLAT mode — same amount for all active months', () => {
        const lineItems: OpExLineItemInput[] = [
            {
                id: 1,
                sectionType: 'OPERATING',
                ifrsCategory: 'Rent & Utilities',
                lineItemName: 'Rent',
                entryMode: 'FLAT',
                computeMethod: 'MANUAL',
                computeRate: null,
                flatAmount: '699627',
                annualTotal: null,
                activeMonths: [], // empty = all 12
                flatOverrideMonths: [],
                monthlyAmounts: Array.from({ length: 12 }, (_, i) => ({
                    month: i + 1,
                    amount: '699627',
                })),
            },
        ];
        const result = computeOpEx(lineItems, [], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
        expect(result.computedLineItems[0].monthlyAmounts).toHaveLength(12);
        for (const m of result.computedLineItems[0].monthlyAmounts) {
            expect(m.amount).toBe('699627.0000');
        }
    });

    it('should compute FLAT mode with active months — zero for inactive', () => {
        const lineItems: OpExLineItemInput[] = [
            {
                id: 2,
                sectionType: 'OPERATING',
                ifrsCategory: 'School Materials',
                lineItemName: 'Supplies',
                entryMode: 'FLAT',
                computeMethod: 'MANUAL',
                computeRate: null,
                flatAmount: '5000',
                annualTotal: null,
                activeMonths: [9, 10, 11, 12, 1, 2, 3, 4, 5, 6], // school calendar
                flatOverrideMonths: [],
                monthlyAmounts: [],
            },
        ];
        const result = computeOpEx(lineItems, [], [1, 2, 3, 4, 5, 6, 9, 10, 11, 12]);
        const amounts = result.computedLineItems[0].monthlyAmounts;
        // Jul (7) and Aug (8) should be zero
        expect(amounts.find((m) => m.month === 7)?.amount).toBe('0.0000');
        expect(amounts.find((m) => m.month === 8)?.amount).toBe('0.0000');
        // Active months should be 5000
        expect(amounts.find((m) => m.month === 1)?.amount).toBe('5000.0000');
    });

    it('should compute FLAT mode with override — keep override value', () => {
        const lineItems: OpExLineItemInput[] = [
            {
                id: 3,
                sectionType: 'OPERATING',
                ifrsCategory: 'Rent & Utilities',
                lineItemName: 'Electricity',
                entryMode: 'FLAT',
                computeMethod: 'MANUAL',
                computeRate: null,
                flatAmount: '35000',
                annualTotal: null,
                activeMonths: [],
                flatOverrideMonths: [6, 7, 8], // summer months overridden
                monthlyAmounts: [
                    { month: 6, amount: '50000' },
                    { month: 7, amount: '55000' },
                    { month: 8, amount: '55000' },
                ],
            },
        ];
        const result = computeOpEx(lineItems, [], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
        const amounts = result.computedLineItems[0].monthlyAmounts;
        // Non-override months get flatAmount
        expect(amounts.find((m) => m.month === 1)?.amount).toBe('35000.0000');
        // Override months keep their values
        expect(amounts.find((m) => m.month === 6)?.amount).toBe('50000.0000');
        expect(amounts.find((m) => m.month === 7)?.amount).toBe('55000.0000');
    });
});

describe('computeOpEx ANNUAL_SPREAD mode', () => {
    it('should spread annual total evenly across active months', () => {
        const lineItems: OpExLineItemInput[] = [
            {
                id: 4,
                sectionType: 'OPERATING',
                ifrsCategory: 'Insurance',
                lineItemName: 'School Insurance',
                entryMode: 'ANNUAL_SPREAD',
                computeMethod: 'MANUAL',
                computeRate: null,
                flatAmount: null,
                annualTotal: '216000',
                activeMonths: [],
                flatOverrideMonths: [],
                monthlyAmounts: [],
            },
        ];
        const result = computeOpEx(lineItems, [], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
        const amounts = result.computedLineItems[0].monthlyAmounts;
        for (const m of amounts) {
            expect(m.amount).toBe('18000.0000'); // 216000 / 12
        }
    });

    it('should spread with remainder to last active month', () => {
        const lineItems: OpExLineItemInput[] = [
            {
                id: 5,
                sectionType: 'OPERATING',
                ifrsCategory: 'Insurance',
                lineItemName: 'Insurance 2',
                entryMode: 'ANNUAL_SPREAD',
                computeMethod: 'MANUAL',
                computeRate: null,
                flatAmount: null,
                annualTotal: '100003',
                activeMonths: [9, 10, 11, 12, 1, 2, 3, 4, 5, 6],
                flatOverrideMonths: [],
                monthlyAmounts: [],
            },
        ];
        const result = computeOpEx(lineItems, [], [1, 2, 3, 4, 5, 6, 9, 10, 11, 12]);
        const amounts = result.computedLineItems[0].monthlyAmounts;
        // 100003 / 10 = 10000.3 each
        const activeAmounts = amounts.filter((m) =>
            [9, 10, 11, 12, 1, 2, 3, 4, 5, 6].includes(m.month)
        );
        // Sum should equal annualTotal
        const sum = activeAmounts.reduce((s, m) => s + parseFloat(m.amount), 0);
        expect(sum).toBeCloseTo(100003, 2);
        // Jul and Aug should be 0
        expect(amounts.find((m) => m.month === 7)?.amount).toBe('0.0000');
        expect(amounts.find((m) => m.month === 8)?.amount).toBe('0.0000');
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @budfin/api exec vitest run src/services/opex/opex-engine.test.ts`
Expected: FAIL — engine doesn't handle entryMode yet.

- [ ] **Step 3: Update OpExLineItemInput interface and engine**

Update the input interface to include new fields:

```typescript
export interface OpExLineItemInput {
    id: number;
    sectionType: string;
    ifrsCategory: string;
    lineItemName: string;
    entryMode: string; // NEW
    computeMethod: string; // DEPRECATED, kept for compat
    computeRate: string | null;
    flatAmount: string | null; // NEW
    annualTotal: string | null; // NEW
    activeMonths: number[]; // NEW
    flatOverrideMonths: number[]; // NEW
    monthlyAmounts: { month: number; amount: string }[];
}
```

Add new function `computeEntryModeAmounts()`:

```typescript
function computeEntryModeAmounts(
    lineItem: OpExLineItemInput,
    schoolCalendar: number[]
): { month: number; amount: string }[] {
    const activeMonths = lineItem.activeMonths.length > 0 ? lineItem.activeMonths : schoolCalendar;

    const allMonths: { month: number; amount: string }[] = [];

    switch (lineItem.entryMode) {
        case 'FLAT': {
            const flat = new Decimal(lineItem.flatAmount ?? '0');
            for (let month = 1; month <= 12; month++) {
                if (!activeMonths.includes(month)) {
                    allMonths.push({ month, amount: '0.0000' });
                } else if (lineItem.flatOverrideMonths.includes(month)) {
                    // Keep the existing monthly amount for overridden months
                    const existing = lineItem.monthlyAmounts.find((m) => m.month === month);
                    allMonths.push({
                        month,
                        amount: new Decimal(existing?.amount ?? '0').toFixed(4),
                    });
                } else {
                    allMonths.push({ month, amount: flat.toFixed(4) });
                }
            }
            return allMonths;
        }

        case 'ANNUAL_SPREAD': {
            const total = new Decimal(lineItem.annualTotal ?? '0');
            const count = activeMonths.length;
            if (count === 0) {
                return Array.from({ length: 12 }, (_, i) => ({ month: i + 1, amount: '0.0000' }));
            }
            const perMonth = total.dividedBy(count).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
            const allocated = perMonth.times(count - 1);
            const lastAmount = total.minus(allocated);
            // Sort active months to find the "last" one (highest month number)
            const sortedActive = [...activeMonths].sort((a, b) => a - b);
            const lastMonth = sortedActive[sortedActive.length - 1];

            for (let month = 1; month <= 12; month++) {
                if (!activeMonths.includes(month)) {
                    allMonths.push({ month, amount: '0.0000' });
                } else if (month === lastMonth) {
                    allMonths.push({ month, amount: lastAmount.toFixed(4) });
                } else {
                    allMonths.push({ month, amount: perMonth.toFixed(4) });
                }
            }
            return allMonths;
        }

        case 'SEASONAL':
        default:
            // SEASONAL: monthly amounts are the direct input, pass through
            // Fill missing months with 0
            for (let month = 1; month <= 12; month++) {
                if (!activeMonths.includes(month)) {
                    allMonths.push({ month, amount: '0.0000' });
                } else {
                    const existing = lineItem.monthlyAmounts.find((m) => m.month === month);
                    allMonths.push({
                        month,
                        amount: new Decimal(existing?.amount ?? '0').toFixed(4),
                    });
                }
            }
            return allMonths;
    }
}
```

Update `computeOpEx()` signature to accept `schoolCalendar`:

```typescript
export function computeOpEx(
    lineItems: OpExLineItemInput[],
    monthlyRevenue: MonthlyRevenueInput[],
    schoolCalendar: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
): OpExComputeResult {
    // Step 0 (NEW): Compute entry-mode-based amounts for FLAT and ANNUAL_SPREAD
    const processedItems = lineItems.map((item) => {
        if (item.entryMode === 'FLAT' || item.entryMode === 'ANNUAL_SPREAD') {
            return { ...item, monthlyAmounts: computeEntryModeAmounts(item, schoolCalendar) };
        }
        return item;
    });

    // Step 1: Compute revenue-based items (PERCENT_OF_REVENUE)
    // Use entryMode instead of computeMethod
    const revenueItems = computeRevenueBasedItems(
        processedItems.filter((i) => i.entryMode === 'PERCENT_OF_REVENUE'),
        monthlyRevenue
    );

    // ... rest unchanged
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @budfin/api exec vitest run src/services/opex/opex-engine.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/opex/opex-engine.ts apps/api/src/services/opex/opex-engine.test.ts
git commit -m "feat: add FLAT and ANNUAL_SPREAD entry mode support to OpEx engine"
```

---

### Task 8: Update OpEx Routes — Zod Schemas + PATCH Endpoint

**Files:**

- Modify: `apps/api/src/routes/opex/line-items.ts`
- Test: `apps/api/src/routes/opex/line-items.test.ts`

- [ ] **Step 1: Write failing test for PATCH endpoint**

```typescript
// In line-items.test.ts, add:
describe('PATCH /opex/line-items/:lineItemId', () => {
    it('should update entry mode and return recomputed monthly amounts', async () => {
        // Create a line item first
        const createRes = await app.inject({
            method: 'POST',
            url: `/api/v1/versions/${testVersionId}/opex/line-items`,
            headers: { authorization: `Bearer ${token}` },
            payload: {
                sectionType: 'OPERATING',
                ifrsCategory: 'Rent & Utilities',
                lineItemName: 'Test PATCH',
                entryMode: 'SEASONAL',
                monthlyAmounts: [{ month: 1, amount: '1000' }],
            },
        });
        const lineItemId = createRes.json().data.id;

        // Patch to FLAT mode
        const res = await app.inject({
            method: 'PATCH',
            url: `/api/v1/versions/${testVersionId}/opex/line-items/${lineItemId}`,
            headers: { authorization: `Bearer ${token}` },
            payload: {
                entryMode: 'FLAT',
                flatAmount: '5000',
            },
        });
        expect(res.statusCode).toBe(200);
        const data = res.json().data;
        expect(data.entryMode).toBe('FLAT');
        expect(data.flatAmount).toBe('5000.0000');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @budfin/api exec vitest run src/routes/opex/line-items.test.ts`
Expected: FAIL — PATCH route not defined.

- [ ] **Step 3: Update Zod schemas to include new fields**

In `line-items.ts`, update the create and bulk schemas to include `entryMode`, `activeMonths`, `annualTotal`, `flatAmount`, `flatOverrideMonths`. Add the PATCH route schema:

```typescript
const entryModeSchema = z.enum(['FLAT', 'SEASONAL', 'ANNUAL_SPREAD', 'PERCENT_OF_REVENUE']);

const activeMonthsSchema = z
    .array(z.number().int().min(1).max(12))
    .max(12)
    .refine((arr) => new Set(arr).size === arr.length, 'Months must be unique');

const lineItemPatchSchema = z.object({
    entryMode: entryModeSchema.optional(),
    activeMonths: activeMonthsSchema.optional(),
    ifrsCategory: z.string().optional(),
    displayOrder: z.number().int().optional(),
    comment: z.string().nullable().optional(),
    lineItemName: z.string().max(200).optional(),
    annualTotal: z.string().nullable().optional(),
    flatAmount: z.string().nullable().optional(),
    flatOverrideMonths: z.array(z.number().int().min(1).max(12)).optional(),
    computeRate: z.string().nullable().optional(),
});
```

- [ ] **Step 4: Implement PATCH route**

```typescript
// PATCH /opex/line-items/:lineItemId
fastify.patch(
    '/:lineItemId',
    {
        schema: {
            params: z.object({ lineItemId: z.coerce.number().int() }),
            body: lineItemPatchSchema,
        },
        preHandler: [requirePermission('data:edit')],
    },
    async (request, reply) => {
        const { lineItemId } = request.params;
        const { versionId } = request.routeOptions.config as { versionId: number };
        const patch = request.body;

        // Verify line item exists and belongs to this version
        const existing = await prisma.versionOpExLineItem.findFirst({
            where: { id: lineItemId, versionId },
        });
        if (!existing) {
            return reply.status(404).send({ error: 'Line item not found' });
        }

        // If changing ifrsCategory, validate against section type
        if (patch.ifrsCategory) {
            const validCategories =
                existing.sectionType === 'OPERATING'
                    ? OPEX_IFRS_CATEGORIES
                    : NON_OPERATING_IFRS_CATEGORIES;
            if (!validCategories.includes(patch.ifrsCategory as any)) {
                return reply
                    .status(400)
                    .send({ error: `Invalid IFRS category for ${existing.sectionType}` });
            }
        }

        // Update the line item
        const updated = await prisma.versionOpExLineItem.update({
            where: { id: lineItemId },
            data: {
                ...patch,
                annualTotal: patch.annualTotal
                    ? new Prisma.Decimal(patch.annualTotal)
                    : patch.annualTotal === null
                      ? null
                      : undefined,
                flatAmount: patch.flatAmount
                    ? new Prisma.Decimal(patch.flatAmount)
                    : patch.flatAmount === null
                      ? null
                      : undefined,
                computeRate: patch.computeRate
                    ? new Prisma.Decimal(patch.computeRate)
                    : patch.computeRate === null
                      ? null
                      : undefined,
                updatedBy: request.user.id,
            },
            include: { monthlyAmounts: true },
        });

        // If entry mode or active months changed, recompute monthly amounts
        if (patch.entryMode || patch.activeMonths || patch.flatAmount || patch.annualTotal) {
            // Mark stale
            await markModulesStale(prisma, versionId, ['OPEX', 'PNL']);
        }

        return reply.send({ data: formatLineItem(updated) });
    }
);
```

- [ ] **Step 5: Update existing create/bulk routes to accept new fields**

Add `entryMode`, `activeMonths`, `annualTotal`, `flatAmount`, `flatOverrideMonths` to the create and bulk update schemas and handlers. When creating, default `entryMode` to `'SEASONAL'` if not provided.

- [ ] **Step 6: Run all OpEx route tests**

Run: `pnpm --filter @budfin/api exec vitest run src/routes/opex/`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/routes/opex/line-items.ts apps/api/src/routes/opex/line-items.test.ts
git commit -m "feat: add PATCH endpoint and entry mode fields to OpEx routes"
```

---

### Task 9: Add Initialize + Reorder Endpoints

**Files:**

- Create: `apps/api/src/routes/opex/initialize.ts`
- Create: `apps/api/src/routes/opex/initialize.test.ts`
- Modify: `apps/api/src/routes/opex/line-items.ts` (reorder route)
- Modify: `apps/api/src/routes/opex/index.ts` (register new routes)

- [ ] **Step 1: Write failing test for initialize**

```typescript
// initialize.test.ts
describe('POST /opex/initialize', () => {
    it('should initialize from another version', async () => {
        // Setup: create line items in source version
        // ...
        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/versions/${targetVersionId}/opex/initialize`,
            headers: { authorization: `Bearer ${token}` },
            payload: {
                source: 'VERSION',
                sourceVersionId: sourceVersionId,
            },
        });
        expect(res.statusCode).toBe(200);
        const data = res.json().data;
        expect(data.length).toBeGreaterThan(0);
    });

    it('should initialize from prior year actuals', async () => {
        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/versions/${targetVersionId}/opex/initialize`,
            headers: { authorization: `Bearer ${token}` },
            payload: {
                source: 'PRIOR_YEAR_ACTUALS',
                priorYear: 'FY2025',
            },
        });
        expect(res.statusCode).toBe(200);
    });

    it('should be destructive — replace existing items', async () => {
        // Create items in target, then initialize from source
        // Verify old items are gone
    });
});
```

- [ ] **Step 2: Implement initialize endpoint**

```typescript
// initialize.ts
export async function opexInitializeRoutes(fastify: FastifyInstance) {
    fastify.post(
        '/',
        {
            schema: {
                body: z
                    .object({
                        source: z.enum(['PRIOR_YEAR_ACTUALS', 'VERSION']),
                        sourceVersionId: z.number().int().optional(),
                        priorYear: z.enum(['FY2025', 'FY2024']).optional(),
                    })
                    .refine(
                        (d) => d.source !== 'VERSION' || d.sourceVersionId != null,
                        'sourceVersionId required when source is VERSION'
                    ),
            },
            preHandler: [requirePermission('data:edit')],
        },
        async (request, reply) => {
            const { versionId } = request.routeOptions.config as { versionId: number };
            const { source, sourceVersionId, priorYear } = request.body;

            // Verify version is not locked
            const version = await prisma.budgetVersion.findUnique({ where: { id: versionId } });
            if (!version || version.status === 'Locked' || version.status === 'Archived') {
                return reply.status(409).send({ error: 'Version is locked' });
            }

            await prisma.$transaction(async (tx) => {
                // Delete existing line items + monthly amounts
                await tx.monthlyOpEx.deleteMany({ where: { versionId } });
                await tx.versionOpExLineItem.deleteMany({ where: { versionId } });

                if (source === 'VERSION') {
                    // Copy from source version
                    const sourceItems = await tx.versionOpExLineItem.findMany({
                        where: { versionId: sourceVersionId! },
                        include: { monthlyAmounts: true },
                        orderBy: [{ sectionType: 'asc' }, { displayOrder: 'asc' }],
                    });
                    for (const item of sourceItems) {
                        const newItem = await tx.versionOpExLineItem.create({
                            data: {
                                versionId,
                                sectionType: item.sectionType,
                                ifrsCategory: item.ifrsCategory,
                                lineItemName: item.lineItemName,
                                displayOrder: item.displayOrder,
                                entryMode: item.entryMode,
                                computeMethod: item.computeMethod,
                                computeRate: item.computeRate,
                                budgetV6Total: item.budgetV6Total,
                                fy2025Actual: item.fy2025Actual,
                                fy2024Actual: item.fy2024Actual,
                                comment: item.comment,
                                activeMonths: item.activeMonths,
                                annualTotal: item.annualTotal,
                                flatAmount: item.flatAmount,
                                flatOverrideMonths: item.flatOverrideMonths,
                                createdBy: request.user.id,
                                updatedBy: request.user.id,
                            },
                        });
                        // Copy monthly amounts
                        for (const ma of item.monthlyAmounts) {
                            await tx.monthlyOpEx.create({
                                data: {
                                    versionId,
                                    lineItemId: newItem.id,
                                    month: ma.month,
                                    amount: ma.amount,
                                    calculatedBy: request.user.id,
                                },
                            });
                        }
                    }
                } else if (source === 'PRIOR_YEAR_ACTUALS') {
                    // Copy from prior year annual totals using ANNUAL_SPREAD
                    const sourceItems = await tx.versionOpExLineItem.findMany({
                        where: { versionId }, // This won't work — we deleted them. Need to get from any version that has the actuals.
                    });
                    // Actually, we need to get the line items from *any* existing version
                    // and use their fy2025Actual / fy2024Actual fields.
                    // Find the most recent version with OpEx data:
                    const refVersion = await tx.budgetVersion.findFirst({
                        where: { opExLineItems: { some: {} } },
                        orderBy: { createdAt: 'desc' },
                    });
                    if (refVersion) {
                        const refItems = await tx.versionOpExLineItem.findMany({
                            where: { versionId: refVersion.id },
                            orderBy: [{ sectionType: 'asc' }, { displayOrder: 'asc' }],
                        });
                        const actualField =
                            priorYear === 'FY2024' ? 'fy2024Actual' : 'fy2025Actual';
                        for (const item of refItems) {
                            const actualTotal = item[actualField];
                            const newItem = await tx.versionOpExLineItem.create({
                                data: {
                                    versionId,
                                    sectionType: item.sectionType,
                                    ifrsCategory: item.ifrsCategory,
                                    lineItemName: item.lineItemName,
                                    displayOrder: item.displayOrder,
                                    entryMode: 'ANNUAL_SPREAD',
                                    computeMethod: 'MANUAL',
                                    budgetV6Total: item.budgetV6Total,
                                    fy2025Actual: item.fy2025Actual,
                                    fy2024Actual: item.fy2024Actual,
                                    comment: item.comment,
                                    annualTotal: actualTotal,
                                    activeMonths: version.schoolCalendarMonths,
                                    createdBy: request.user.id,
                                    updatedBy: request.user.id,
                                },
                            });
                            // Compute monthly spread from annual
                            if (actualTotal) {
                                const activeCount = version.schoolCalendarMonths.length || 12;
                                const perMonth = new Decimal(actualTotal.toString())
                                    .dividedBy(activeCount)
                                    .toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
                                for (let month = 1; month <= 12; month++) {
                                    const isActive = version.schoolCalendarMonths.includes(month);
                                    await tx.monthlyOpEx.create({
                                        data: {
                                            versionId,
                                            lineItemId: newItem.id,
                                            month,
                                            amount: isActive ? perMonth : new Prisma.Decimal(0),
                                            calculatedBy: request.user.id,
                                        },
                                    });
                                }
                            }
                        }
                    }
                }

                // Mark OPEX + PNL stale
                await markModulesStale(tx, versionId, ['OPEX', 'PNL']);
            });

            // Fetch and return the new state
            const lineItems = await fetchLineItemsWithSummary(prisma, versionId);
            return reply.send(lineItems);
        }
    );
}
```

- [ ] **Step 3: Implement reorder endpoint in line-items.ts**

```typescript
// PUT /opex/line-items/reorder
fastify.put(
    '/line-items/reorder',
    {
        schema: {
            body: z.object({
                moves: z.array(
                    z.object({
                        lineItemId: z.number().int(),
                        ifrsCategory: z.string(),
                        displayOrder: z.number().int(),
                    })
                ),
            }),
        },
        preHandler: [requirePermission('data:edit')],
    },
    async (request, reply) => {
        const { versionId } = request.routeOptions.config as { versionId: number };
        const { moves } = request.body;

        await prisma.$transaction(
            moves.map((move) =>
                prisma.versionOpExLineItem.update({
                    where: { id: move.lineItemId },
                    data: {
                        ifrsCategory: move.ifrsCategory,
                        displayOrder: move.displayOrder,
                        updatedBy: request.user.id,
                    },
                })
            )
        );

        return reply.send({ success: true });
    }
);
```

- [ ] **Step 4: Register new routes in index.ts**

In `apps/api/src/routes/opex/index.ts`, add:

```typescript
import { opexInitializeRoutes } from './initialize.js';
// Register under /opex/initialize
fastify.register(opexInitializeRoutes, { prefix: '/initialize' });
```

- [ ] **Step 5: Run all tests**

Run: `pnpm --filter @budfin/api exec vitest run src/routes/opex/`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/opex/
git commit -m "feat: add initialize and reorder endpoints for OpEx"
```

---

## Chunk 3: Frontend — Grid Merge + Property Panel (Phase 2B + Phase 3A)

### Task 10: Merge opex-grid.tsx + non-operating-grid.tsx

**Files:**

- Modify: `apps/web/src/components/opex/opex-grid.tsx`
- Delete: `apps/web/src/components/opex/non-operating-grid.tsx`
- Modify: `apps/web/src/components/opex/opex-page.tsx`

- [ ] **Step 1: Add sectionType prop to OpExGrid**

Refactor `opex-grid.tsx` to accept a `sectionType: 'OPERATING' | 'NON_OPERATING'` prop. Use it to select the correct category styles:

```typescript
const CATEGORY_STYLES_MAP = {
    OPERATING: CATEGORY_STYLES, // existing 12-category styles
    NON_OPERATING: NON_OP_CATEGORY_STYLES, // existing 4-category styles
};

type OpExGridProps = {
    lineItems: OpExLineItem[];
    monthlyTotals: string[];
    isEditable: boolean;
    sectionType: 'OPERATING' | 'NON_OPERATING';
    onMonthlyUpdate(lineItemId: number, month: number, amount: string): void;
    onCommentUpdate(lineItemId: number, comment: string): void;
};
```

Copy the `NON_OP_CATEGORY_STYLES` from `non-operating-grid.tsx` into `opex-grid.tsx`. Update the band grouping to use `CATEGORY_STYLES_MAP[sectionType]`.

- [ ] **Step 2: Update opex-page.tsx to use unified grid**

Replace:

```typescript
import { NonOperatingGrid } from './non-operating-grid';
```

With the unified `OpExGrid` using `sectionType="NON_OPERATING"`.

- [ ] **Step 3: Delete non-operating-grid.tsx**

Remove the file.

- [ ] **Step 4: Verify page renders correctly**

Run: `pnpm dev` and navigate to `/planning/opex`. Verify both Operating and Non-Operating tabs render with correct category colors and grouping.

- [ ] **Step 5: Run tests**

Run: `pnpm --filter @budfin/web test`
Expected: PASS (update any tests that import NonOperatingGrid)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/opex/opex-grid.tsx apps/web/src/components/opex/opex-page.tsx
git rm apps/web/src/components/opex/non-operating-grid.tsx
git commit -m "refactor: merge opex-grid and non-operating-grid into unified component"
```

---

### Task 11: Add isOverlay Mode to RightPanelStore

**Files:**

- Modify: `apps/web/src/stores/right-panel-store.ts`
- Modify: `apps/web/src/components/shell/right-panel.tsx`

- [ ] **Step 1: Add isOverlay to store**

```typescript
interface RightPanelState {
    // ... existing fields
    isOverlay: boolean;
    setOverlay(isOverlay: boolean): void;
}
```

Add `isOverlay: false` to initial state and `setOverlay` action.

- [ ] **Step 2: Update RightPanel component for overlay mode**

In `right-panel.tsx`, when `isOverlay` is true, render with `position: absolute`, `right: 0`, `top: 0`, `z-index: 40`, and a backdrop/click-away handler.

- [ ] **Step 3: Verify docked mode is unaffected**

Navigate to other planning pages (Enrollment, Revenue, Staffing) and confirm the right panel still works as docked.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/stores/right-panel-store.ts apps/web/src/components/shell/right-panel.tsx
git commit -m "feat: add overlay mode to RightPanelStore for full-width grid pages"
```

---

### Task 12: OpEx Dirty Store + Debounced Batch Saves

**Files:**

- Create: `apps/web/src/stores/opex-dirty-store.ts`
- Test: `apps/web/src/stores/opex-dirty-store.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
describe('opexDirtyStore', () => {
    it('should track dirty cell changes', () => {
        const { setDirty, getDirtyUpdates, dirtyCount } = useOpExDirtyStore.getState();
        setDirty(1, 3, '5000');
        expect(dirtyCount()).toBe(1);
        expect(getDirtyUpdates()).toEqual([{ lineItemId: 1, month: 3, amount: '5000' }]);
    });

    it('should clear on flush', () => {
        const { setDirty, flush, dirtyCount } = useOpExDirtyStore.getState();
        setDirty(1, 3, '5000');
        flush();
        expect(dirtyCount()).toBe(0);
    });
});
```

- [ ] **Step 2: Implement the store**

```typescript
// opex-dirty-store.ts
import { create } from 'zustand';

interface DirtyEntry {
    lineItemId: number;
    month: number;
    amount: string;
}

interface OpExDirtyState {
    dirtyMap: Map<string, DirtyEntry>; // key: `${lineItemId}-${month}`
    setDirty(lineItemId: number, month: number, amount: string): void;
    getDirtyUpdates(): DirtyEntry[];
    dirtyCount(): number;
    flush(): void;
    flushTimer: ReturnType<typeof setTimeout> | null;
    setFlushTimer(timer: ReturnType<typeof setTimeout> | null): void;
}

export const useOpExDirtyStore = create<OpExDirtyState>((set, get) => ({
    dirtyMap: new Map(),
    flushTimer: null,

    setDirty: (lineItemId, month, amount) => {
        set((state) => {
            const newMap = new Map(state.dirtyMap);
            newMap.set(`${lineItemId}-${month}`, { lineItemId, month, amount });
            return { dirtyMap: newMap };
        });
    },

    getDirtyUpdates: () => Array.from(get().dirtyMap.values()),

    dirtyCount: () => get().dirtyMap.size,

    flush: () => set({ dirtyMap: new Map(), flushTimer: null }),

    setFlushTimer: (timer) => set({ flushTimer: timer }),
}));
```

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @budfin/web exec vitest run src/stores/opex-dirty-store.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/stores/opex-dirty-store.ts apps/web/src/stores/opex-dirty-store.test.ts
git commit -m "feat: add OpEx dirty store for debounced batch saves"
```

---

### Task 13: Redesign OpEx Inspector Panel

**Files:**

- Modify: `apps/web/src/components/opex/opex-inspector.tsx`
- Modify: `apps/web/src/hooks/use-opex.ts` (add PATCH mutation hook)

- [ ] **Step 1: Add useUpdateOpExLineItem hook**

In `use-opex.ts`, add:

```typescript
export function useUpdateOpExLineItem(versionId: number | undefined) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({
            lineItemId,
            patch,
        }: {
            lineItemId: number;
            patch: OpExLineItemPatch;
        }) => {
            return apiClient<{ data: OpExLineItem }>(
                `/versions/${versionId}/opex/line-items/${lineItemId}`,
                { method: 'PATCH', body: JSON.stringify(patch) }
            );
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['opex-line-items', versionId] });
        },
    });
}
```

- [ ] **Step 2: Rewrite inspector as compact sections panel**

Rewrite `opex-inspector.tsx` with these sections:

1. Header (section type + editable line item name)
2. Category dropdown (filterable by sectionType)
3. Entry mode toggle buttons
4. Active months picker (clickable month pills)
5. KPI cards (FY Total + % of Category)
6. Historical comparison table
7. Comment textarea
8. Quick actions (Copy from V6, Apply %, Delete)
9. Display order (position + up/down arrows)

Each editable field calls `useUpdateOpExLineItem` on change.

- [ ] **Step 3: Set overlay mode on mount in opex-page.tsx**

```typescript
useEffect(() => {
    setActivePage('opex');
    setOverlay(true); // NEW — enable overlay mode for OpEx
    return () => {
        setActivePage(null);
        setOverlay(false);
        clearSelection();
    };
}, [setActivePage, setOverlay, clearSelection]);
```

- [ ] **Step 4: Verify panel slides out on row selection**

Run: `pnpm dev`, navigate to OpEx, click a row. Panel should slide in from the right as an overlay. Esc or clicking outside should dismiss it.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/opex/opex-inspector.tsx apps/web/src/hooks/use-opex.ts apps/web/src/components/opex/opex-page.tsx
git commit -m "feat: redesign OpEx inspector as editable compact sections panel"
```

---

### Task 14: Add Entry Mode Column to Grid

**Files:**

- Modify: `apps/web/src/components/opex/opex-grid.tsx`

- [ ] **Step 1: Add entry mode column definition**

After the `lineItemName` column, add:

```typescript
columnHelper.accessor('entryMode', {
	header: 'Mode',
	size: 70,
	cell: ({ getValue, row }) => {
		const mode = getValue()
		const modeConfig: Record<string, { label: string; colorVar: string; bgVar: string }> = {
			FLAT: { label: 'FLAT', colorVar: '--entry-mode-flat', bgVar: '--entry-mode-flat-bg' },
			SEASONAL: { label: 'SEAS', colorVar: '--entry-mode-seasonal', bgVar: '--entry-mode-seasonal-bg' },
			ANNUAL_SPREAD: { label: 'ANNUAL', colorVar: '--entry-mode-annual', bgVar: '--entry-mode-annual-bg' },
			PERCENT_OF_REVENUE: {
				label: `${new Decimal(row.original.computeRate ?? '0').times(100).toFixed(1)}%`,
				colorVar: '--entry-mode-revenue',
				bgVar: '--entry-mode-revenue-bg',
			},
		}
		const cfg = modeConfig[mode] ?? modeConfig.SEASONAL
		return (
			<span
				className="rounded px-1.5 py-0.5 text-[10px] font-medium"
				style={{
					color: `var(${cfg.colorVar})`,
					backgroundColor: `var(${cfg.bgVar})`,
				}}
			>
				{cfg.label}
			</span>
		)
	},
})
```

- [ ] **Step 2: Make monthly cells respect entry mode**

For ANNUAL_SPREAD and PERCENT_OF_REVENUE, monthly cells should be read-only (dimmed, italic). For FLAT mode, non-override cells should show the flat fill styling.

```typescript
// In the monthly column cell renderer:
const isComputed = row.original.entryMode === 'ANNUAL_SPREAD'
	|| row.original.entryMode === 'PERCENT_OF_REVENUE'
const isInactiveMonth = row.original.activeMonths.length > 0
	&& !row.original.activeMonths.includes(month)
	// OR inherit from school calendar if activeMonths is empty

if (isInactiveMonth) {
	return <span className="text-(--cell-inactive-text) bg-(--cell-inactive-bg)">—</span>
}
if (isComputed) {
	return <span className="text-(--text-muted) italic tabular-nums">{formatMoney(amount)}</span>
}
// Otherwise render EditableCell as before
```

- [ ] **Step 3: Make FY Total editable for ANNUAL_SPREAD mode**

For ANNUAL_SPREAD items, the FY Total column should render as an `EditableCell` (the input), while monthly cells are read-only.

- [ ] **Step 4: Verify visually**

Run: `pnpm dev`, navigate to OpEx. Entry mode badges should appear. Different modes should show different cell editability. (Won't have real data with modes yet unless you manually PATCH via API.)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/opex/opex-grid.tsx
git commit -m "feat: add entry mode column and mode-aware cell rendering to OpEx grid"
```

---

### Task 15: Fix KPI + computeRate Display Bug

**Files:**

- Modify: `apps/web/src/components/opex/opex-kpi-ribbon.tsx`
- Modify: `apps/web/src/components/opex/opex-inspector.tsx`
- Modify: `apps/web/src/hooks/use-opex.ts` (fetch revenue total)

- [ ] **Step 1: Fix OpEx % of Revenue KPI**

In `opex-kpi-ribbon.tsx`, replace the hardcoded `0` with a computed value. Fetch the revenue total for the version and compute `(totalOpEx / totalRevenue * 100)`:

```typescript
// In opex-page.tsx, fetch revenue summary
const { data: revenueData } = useRevenueLineItems(versionId)
const totalRevenue = revenueData?.summary?.totalOperatingRevenue ?? '0'

// Pass to KPI ribbon
<OpExKpiRibbon
	summary={lineItemsResponse.summary}
	totalRevenue={totalRevenue}
/>

// In opex-kpi-ribbon.tsx, compute:
const opexPercentOfRevenue = totalRevenue && new Decimal(totalRevenue).gt(0)
	? new Decimal(summary.totalOperating).dividedBy(totalRevenue).times(100).toDecimalPlaces(1).toString()
	: '0'
```

- [ ] **Step 2: Fix computeRate display in inspector**

In `opex-inspector.tsx`, find the formula display for PERCENT_OF_REVENUE and fix:

```typescript
// WRONG: `${lineItem.computeRate ?? '0'}%`
// RIGHT:
const displayRate = lineItem.computeRate
    ? new Decimal(lineItem.computeRate).times(100).toDecimalPlaces(2).toString()
    : '0';
// Display: `${displayRate}% of revenue`
```

- [ ] **Step 3: Verify**

Run: `pnpm dev`, navigate to OpEx. The "OpEx % of Revenue" KPI should show a real value (not 0%). Click a PERCENT_OF_REVENUE item — the inspector should show "6%" not "0.06%".

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/opex/opex-kpi-ribbon.tsx apps/web/src/components/opex/opex-inspector.tsx apps/web/src/components/opex/opex-page.tsx
git commit -m "fix: compute OpEx % of Revenue KPI and fix computeRate display"
```

---

## Chunk 4: OpEx Settings + Initialize Dialog + DnD (Phase 3B + Phase 4)

### Task 16: OpEx Settings Dialog (School Calendar)

**Files:**

- Create: `apps/web/src/components/opex/opex-settings-dialog.tsx`
- Modify: `apps/web/src/components/opex/opex-page.tsx` (add Settings button)

- [ ] **Step 1: Create the dialog component**

A dialog with:

- Month picker: 12 clickable month pills (J F M A M J J A S O N D)
- Preset buttons: "School Year (Sep-Jun)", "Full Year", "Custom"
- Preview: "10 months active — Jul, Aug inactive"
- Save button calls `PATCH /versions/:versionId` with `schoolCalendarMonths`

- [ ] **Step 2: Wire into toolbar**

Add a "Settings" button (gear icon) to the toolbar right zone, between Export and Calculate. Opens the dialog.

- [ ] **Step 3: Verify**

Run: `pnpm dev`, open Settings dialog, toggle months, save. Refresh page and confirm the setting persisted.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/opex/opex-settings-dialog.tsx apps/web/src/components/opex/opex-page.tsx
git commit -m "feat: add OpEx settings dialog with school calendar configuration"
```

---

### Task 17: Initialize Dialog

**Files:**

- Create: `apps/web/src/components/opex/opex-initialize-dialog.tsx`
- Modify: `apps/web/src/hooks/use-opex.ts` (add initialize mutation)
- Modify: `apps/web/src/components/opex/opex-page.tsx`

- [ ] **Step 1: Add useInitializeOpEx hook**

```typescript
export function useInitializeOpEx(versionId: number | undefined) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (payload: OpExInitializePayload) => {
            return apiClient<OpExLineItemsResponse>(`/versions/${versionId}/opex/initialize`, {
                method: 'POST',
                body: JSON.stringify(payload),
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['opex-line-items', versionId] });
            queryClient.invalidateQueries({ queryKey: ['versions'] });
        },
    });
}
```

- [ ] **Step 2: Create the dialog**

Three-step dialog:

1. Source selection (radio cards: Prior Year Actuals / Another Version / Start Fresh)
2. Source options (version dropdown or prior year selector, depending on choice)
3. Confirmation ("This will replace all X current line items. Continue?")

- [ ] **Step 3: Wire "Initialize from..." button in toolbar**

- [ ] **Step 4: Verify end-to-end**

Create a version with OpEx data. Open another version, click "Initialize from..." → "Another Version" → select the first version → Confirm. Data should copy over.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/opex/opex-initialize-dialog.tsx apps/web/src/hooks/use-opex.ts apps/web/src/components/opex/opex-page.tsx
git commit -m "feat: add OpEx initialization dialog for copying from prior year/version"
```

---

### Task 18: Drag-and-Drop Row Reordering

**Files:**

- Modify: `apps/web/src/components/opex/opex-grid.tsx`
- Modify: `apps/web/src/hooks/use-opex.ts` (add reorder mutation)

- [ ] **Step 1: Add useReorderOpEx hook**

```typescript
export function useReorderOpEx(versionId: number | undefined) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (payload: OpExReorderPayload) => {
            return apiClient<{ success: boolean }>(
                `/versions/${versionId}/opex/line-items/reorder`,
                { method: 'PUT', body: JSON.stringify(payload) }
            );
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['opex-line-items', versionId] });
        },
    });
}
```

- [ ] **Step 2: Add drag handle column and DnD logic**

Add a grip icon column as the first column (20px). Use `@dnd-kit/core` and `@dnd-kit/sortable` (or native HTML5 DnD) for reordering:

```typescript
// Drag handle column
columnHelper.display({
	id: 'drag-handle',
	size: 28,
	cell: ({ row }) => (
		<button
			className="cursor-grab text-(--text-muted) hover:text-(--text-secondary)"
			{...dragHandleProps}
		>
			<GripVertical size={14} />
		</button>
	),
})
```

- [ ] **Step 3: Implement drop logic**

On drop within same category: update `displayOrder` for affected rows.
On drop onto different category header (same section): update `ifrsCategory` + `displayOrder`.
Cross-section drops: show "not-allowed" cursor.

After drop, call `useReorderOpEx` with the new positions.

- [ ] **Step 4: Add visual feedback**

```css
/* Already added in Task 1 */
--grid-drop-zone-bg
--grid-drop-zone-border
```

Highlight valid drop zones with these tokens. Invalid zones get `cursor: not-allowed`.

- [ ] **Step 5: Verify**

Run: `pnpm dev`. Drag a row within a category — it should reorder. Drag onto a different category header — it should move. Try dragging from Operating to Non-Operating — should be blocked.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/opex/opex-grid.tsx apps/web/src/hooks/use-opex.ts
git commit -m "feat: add drag-and-drop row reordering to OpEx grid"
```

---

### Task 19: Wire Debounced Batch Saves into OpEx Page

**Files:**

- Modify: `apps/web/src/components/opex/opex-page.tsx`

- [ ] **Step 1: Replace per-cell updates with dirty store**

Replace `handleMonthlyUpdate` to write to dirty store instead of calling mutation directly:

```typescript
const { setDirty, getDirtyUpdates, flush, dirtyCount } = useOpExDirtyStore();
const updateMonthlyMutation = useUpdateOpExMonthly(versionId);
const undoRedo = useGridUndoRedo();

const handleMonthlyUpdate = useCallback(
    (lineItemId: number, month: number, amount: string) => {
        // Track old value for undo
        const oldAmount =
            /* find from current data */
            undoRedo.push({
                type: 'cell-edit',
                cellKey: `${lineItemId}-${month}`,
                oldValue: oldAmount,
                newValue: amount,
            });
        setDirty(lineItemId, month, amount);
        // Debounce: flush after 2 seconds of inactivity
        if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
        flushTimerRef.current = setTimeout(() => {
            const updates = getDirtyUpdates();
            if (updates.length > 0) {
                updateMonthlyMutation.mutate(
                    { updates },
                    {
                        onSuccess: () => {
                            flush();
                            undoRedo.flush();
                        },
                    }
                );
            }
        }, 2000);
    },
    [setDirty, getDirtyUpdates, flush, updateMonthlyMutation, undoRedo]
);
```

- [ ] **Step 2: Add unsaved indicator to status strip**

```typescript
// In the status strip sections:
if (dirtyCount() > 0) {
    sections.push({
        key: 'unsaved',
        label: 'Unsaved',
        value: `${dirtyCount()} changes`,
        severity: 'warning',
    });
}
```

- [ ] **Step 3: Wire Ctrl+Z/Ctrl+Shift+Z**

In the grid's keyboard handler, handle undo/redo:

```typescript
// When undo returns an entry, apply the oldValue to the grid
const handleUndo = () => {
    const entry = undoRedo.undo();
    if (entry) {
        const [lineItemId, month] = entry.cellKey.split('-').map(Number);
        setDirty(lineItemId, month, entry.oldValue);
    }
};
```

- [ ] **Step 4: Verify end-to-end**

Edit multiple cells rapidly. After 2 seconds, check Network tab — should see a single `PUT /opex/monthly` with all changes batched. Unsaved indicator should appear and disappear on flush. Ctrl+Z should undo the last edit.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/opex/opex-page.tsx
git commit -m "feat: wire debounced batch saves and undo/redo to OpEx page"
```

---

### Task 20: Final Verification + Cleanup

- [ ] **Step 1: Run full test suite**

```bash
pnpm test
```

Expected: All tests pass. Fix any failures.

- [ ] **Step 2: Run type checking**

```bash
pnpm typecheck
```

Expected: Zero type errors (excluding pre-existing ones from the grid-design-system branch).

- [ ] **Step 3: Run linting**

```bash
pnpm lint
```

Expected: No new warnings or errors.

- [ ] **Step 4: Manual smoke test**

1. Navigate to OpEx page — grid renders with entry mode column
2. Click a row — slide-out panel appears with editable properties
3. Change entry mode to FLAT — monthly cells auto-fill
4. Change entry mode to ANNUAL_SPREAD — FY Total becomes editable, months read-only
5. Open Settings — configure school calendar (10 months)
6. Verify inactive months show as dashes
7. Use "Initialize from..." to copy from another version
8. Drag a row to reorder within category
9. Edit multiple cells — observe 2-second debounced save
10. Ctrl+Z to undo — works on unsaved changes
11. KPI "OpEx % of Revenue" shows real value

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: cleanup and finalize OpEx planning workspace redesign"
```
