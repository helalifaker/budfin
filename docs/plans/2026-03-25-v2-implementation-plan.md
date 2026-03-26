# BudFin v2 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver Tier 1 fixes, Tier 2 UI/UX improvements, Comments, Export, Historical Trends, and 80% test coverage.

**Architecture:** Bottom-up approach: stabilize existing code (Tier 1), add polish (Tier 2), build new features (Comments, Export, Trends) in parallel, then blanket test coverage. All monetary math uses decimal.js. All API routes use Zod + Fastify type provider. Frontend uses TanStack Query + Zustand + shadcn/ui.

**Tech Stack:** Fastify 5, Prisma 6, PostgreSQL 16, pg-boss, @react-pdf/renderer, ExcelJS, React 19, Vite 7, TanStack Query/Table, Recharts, Tailwind v4, shadcn/ui.

**Spec:** `docs/plans/2026-03-25-v2-improvement-spec.md`

---

## Chunk 1: Tier 1 Critical Fixes (Tasks 1-6)

### Task 1: Fix Staffing CalculateButton

**Files:**

- Modify: `apps/web/src/components/staffing/staffing-page-v2.tsx`

- [ ] **Step 1: Read current staffing page calculate button code**

Read lines 310-325 and 370-385 of `staffing-page-v2.tsx` to understand the current plain `<Button>` usage.

- [ ] **Step 2: Replace plain Button with CalculateButton import**

Add import at top of file:

```tsx
import { CalculateButton } from '../shared/calculate-button';
```

Remove `Button` from the existing import if it's only used for calculate.

- [ ] **Step 3: Replace first calculate button (lines ~313-320)**

Replace the plain `<Button>` block with:

```tsx
<CalculateButton
    onCalculate={() => calculateMutation.mutate()}
    isPending={calculateMutation.isPending}
    isSuccess={calculateMutation.isSuccess}
    isError={calculateMutation.isError}
    disabled={editability !== 'editable'}
/>
```

- [ ] **Step 4: Replace second calculate button (lines ~373-380)**

Same replacement for the fallback/duplicate calculate button. If it's in an empty state, remove it entirely (only one calculate button per page).

- [ ] **Step 5: Run tests and verify**

Run: `pnpm --filter @budfin/web exec vitest run src/components/staffing`

Expected: All existing tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/staffing/staffing-page-v2.tsx
git commit -m "fix: use shared CalculateButton in staffing page"
```

---

### Task 2: Remove Duplicate Calculate Buttons in OpEx and P&L

**Files:**

- Modify: `apps/web/src/components/opex/opex-page.tsx`
- Modify: `apps/web/src/components/pnl/pnl-page.tsx`

- [ ] **Step 1: Identify duplicate calculate buttons in OpEx**

Read `opex-page.tsx` and find the empty-state calculate button (second instance). The toolbar already has the correct `<CalculateButton>`. Remove the duplicate in the empty state section.

- [ ] **Step 2: Identify duplicate calculate buttons in P&L**

Read `pnl-page.tsx` and find the empty-state calculate button. Remove the duplicate, keeping only the toolbar instance.

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @budfin/web exec vitest run src/components/opex src/components/pnl`

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/opex/opex-page.tsx apps/web/src/components/pnl/pnl-page.tsx
git commit -m "fix: remove duplicate calculate buttons in OpEx and P&L empty states"
```

---

### Task 3: Add Upstream Stale Validation to Calculate Hooks

**Files:**

- Modify: `apps/web/src/hooks/use-revenue.ts`
- Modify: `apps/web/src/hooks/use-staffing.ts`
- Modify: `apps/web/src/hooks/use-opex.ts`

- [ ] **Step 1: Add stale guard to useCalculateRevenue**

In `apps/web/src/hooks/use-revenue.ts`, modify the `useCalculateRevenue` function. Import `useWorkspaceContextStore` if not already imported. Add a stale check before the mutation:

```tsx
export function useCalculateRevenue(versionId: number | null) {
    const queryClient = useQueryClient();
    const staleModules = useWorkspaceContextStore((s) => s.versionStaleModules);
    const isUpstreamStale = staleModules.includes('ENROLLMENT');

    const mutation = useMutation({
        mutationFn: async () => {
            if (isUpstreamStale) {
                throw new Error('Recalculate Enrollment first');
            }
            return apiClient<RevenueCalculateResponse>(`/versions/${versionId}/calculate/revenue`, {
                method: 'POST',
            });
        },
        // ... existing onSuccess/onError handlers
    });

    return { ...mutation, isUpstreamStale };
}
```

- [ ] **Step 2: Add stale guard to useCalculateStaffing**

Same pattern in `apps/web/src/hooks/use-staffing.ts`:

```tsx
const isUpstreamStale = staleModules.includes('REVENUE');
```

- [ ] **Step 3: Add stale guard to useCalculateOpEx**

Same pattern in `apps/web/src/hooks/use-opex.ts`:

```tsx
const isUpstreamStale = staleModules.includes('REVENUE');
```

- [ ] **Step 4: Wire isUpstreamStale to CalculateButton disabled prop in each page**

In each page component, pass `isUpstreamStale` to the `disabled` prop of `<CalculateButton>`. Add a tooltip or visual indicator explaining why it's disabled.

- [ ] **Step 5: Run tests**

Run: `pnpm --filter @budfin/web test`

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/hooks/use-revenue.ts apps/web/src/hooks/use-staffing.ts apps/web/src/hooks/use-opex.ts
git commit -m "fix: add upstream stale validation to calculate hooks"
```

---

### Task 4: Fix Format-Money Consistency

**Files:**

- Modify: `apps/web/src/components/revenue/forecast-tab.tsx`
- Modify: `apps/web/src/components/revenue/revenue-matrix-table.tsx`
- Modify: `apps/web/src/components/staffing/monthly-cost-grid.tsx`
- Modify: `apps/web/src/components/scenarios/scenario-page.tsx`
- Modify: `apps/web/src/components/data-grid/cell-renderers.tsx`
- Modify: `apps/web/src/components/data-grid/editable-cell.tsx`
- Modify: `apps/web/src/components/dashboard/kpi-ribbon.tsx`
- Modify: `apps/web/src/components/dashboard/enrollment-trend-chart.tsx`
- Modify: `apps/web/src/components/dashboard/staffing-distribution-chart.tsx`
- Modify: `apps/web/src/hooks/use-staffing.ts`
- Modify: `apps/web/src/lib/revenue-workspace.ts`

- [ ] **Step 1: Grep all monetary toLocaleString calls**

Run: `grep -rn 'toLocaleString' apps/web/src/ --include='*.tsx' --include='*.ts'`

Review each hit. Classify as monetary (needs fix) or non-monetary (date formatting, counts -- leave alone).

- [ ] **Step 2: Replace each monetary toLocaleString with formatMoney**

For each file, add import:

```tsx
import { formatMoney } from '../../lib/format-money';
```

Replace patterns like `value.toLocaleString('fr-FR')` or `Number(value).toLocaleString()` with `formatMoney(value)`.

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @budfin/web test`

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/
git commit -m "fix: replace raw toLocaleString with formatMoney for all monetary values"
```

---

### Task 5: Fix Design Token Violations

**Files:**

- Modify: `apps/web/src/components/pnl/pnl-page.tsx`
- Modify: `apps/web/src/pages/admin/audit.tsx`
- Modify: `apps/web/src/components/scenarios/scenario-page.tsx`
- Modify: `apps/web/src/components/master-data/curriculum-rules-table.tsx`

- [ ] **Step 1: Grep all raw Tailwind color classes**

Run: `grep -rn 'text-emerald\|text-red-\|text-amber-\|bg-emerald\|bg-red-\|bg-amber-' apps/web/src/ --include='*.tsx'`

- [ ] **Step 2: Replace with CSS custom properties**

Replacements:

| Raw class          | Design token                                      |
| ------------------ | ------------------------------------------------- |
| `text-emerald-600` | `text-(--color-success)`                          |
| `text-red-600`     | `text-(--color-error)`                            |
| `text-amber-600`   | `text-(--color-warning)`                          |
| `bg-emerald-*`     | `bg-(--color-success)` (with appropriate opacity) |
| `bg-red-*`         | `bg-(--color-error)` (with appropriate opacity)   |

- [ ] **Step 3: Verify design tokens exist in index.css**

Read `apps/web/src/index.css` and confirm `--color-success`, `--color-error`, `--color-warning` are defined. If not, add them.

- [ ] **Step 4: Run tests and visual check**

Run: `pnpm --filter @budfin/web test`

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/
git commit -m "fix: replace raw Tailwind colors with design tokens"
```

---

### Task 6: Add React Error Boundary

**Files:**

- Create: `apps/web/src/components/shared/error-boundary.tsx`
- Create: `apps/web/src/components/shared/error-boundary.test.tsx`
- Modify: `apps/web/src/layouts/root-layout.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/components/shared/error-boundary.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ErrorBoundary } from './error-boundary';

function ThrowingComponent() {
    throw new Error('Test error');
}

describe('ErrorBoundary', () => {
    it('renders children when no error', () => {
        render(
            <ErrorBoundary>
                <div>Hello</div>
            </ErrorBoundary>
        );
        expect(screen.getByText('Hello')).toBeTruthy();
    });

    it('renders fallback UI when child throws', () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        render(
            <ErrorBoundary>
                <ThrowingComponent />
            </ErrorBoundary>
        );
        expect(screen.getByText('Something went wrong')).toBeTruthy();
        expect(screen.getByRole('button', { name: /reload/i })).toBeTruthy();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @budfin/web exec vitest run src/components/shared/error-boundary.test.tsx`

Expected: FAIL (module not found)

- [ ] **Step 3: Implement ErrorBoundary**

```tsx
// apps/web/src/components/shared/error-boundary.tsx
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '../ui/button';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // eslint-disable-next-line no-console
        console.error('ErrorBoundary caught:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex min-h-screen items-center justify-center bg-(--workspace-bg)">
                    <div className="flex max-w-md flex-col items-center gap-4 text-center">
                        <AlertTriangle className="h-12 w-12 text-(--color-error)" />
                        <h1 className="text-xl font-semibold text-(--text-primary)">
                            Something went wrong
                        </h1>
                        <p className="text-sm text-(--text-muted)">
                            An unexpected error occurred. Please reload the page to continue.
                        </p>
                        {import.meta.env.DEV && this.state.error && (
                            <pre className="max-w-full overflow-auto rounded border p-3 text-left text-xs">
                                {this.state.error.message}
                            </pre>
                        )}
                        <Button onClick={() => window.location.reload()} variant="default">
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Reload Page
                        </Button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @budfin/web exec vitest run src/components/shared/error-boundary.test.tsx`

Expected: PASS

- [ ] **Step 5: Wrap RootLayout with ErrorBoundary**

In `apps/web/src/layouts/root-layout.tsx`, import and wrap:

```tsx
import { ErrorBoundary } from '../components/shared/error-boundary';

export function RootLayout() {
    return <ErrorBoundary>{/* existing layout content */}</ErrorBoundary>;
}
```

- [ ] **Step 6: Run full test suite**

Run: `pnpm --filter @budfin/web test`

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/shared/error-boundary.tsx apps/web/src/components/shared/error-boundary.test.tsx apps/web/src/layouts/root-layout.tsx
git commit -m "feat: add React ErrorBoundary with fallback UI"
```

---

## Chunk 2: Tier 2 UI/UX Improvements (Tasks 7-16)

### Task 7: Right Panel Activity & Audit Tabs

**Files:**

- Create: `apps/web/src/hooks/use-audit.ts`
- Create: `apps/web/src/components/shared/timeline-item.tsx`
- Create: `apps/web/src/components/shell/activity-feed.tsx`
- Create: `apps/web/src/components/shell/calculation-history.tsx`
- Modify: `apps/web/src/components/shell/right-panel.tsx`

- [ ] **Step 1: Create the useAudit hooks**

```tsx
// apps/web/src/hooks/use-audit.ts
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { useWorkspaceContextStore } from '../stores/workspace-context-store';
import type { AuditEntry, CalculationAuditEntry } from '@budfin/types';

export const auditKeys = {
    activity: (versionId: number) => ['audit', 'activity', versionId] as const,
    calculations: (versionId: number) => ['audit', 'calculations', versionId] as const,
};

export function useVersionActivity() {
    const versionId = useWorkspaceContextStore((s) => s.versionId);

    return useQuery({
        queryKey: auditKeys.activity(versionId!),
        queryFn: () =>
            apiClient<{ entries: AuditEntry[] }>(`/audit?versionId=${versionId}&limit=20`),
        enabled: !!versionId,
        refetchInterval: 60_000,
    });
}

export function useCalculationHistory() {
    const versionId = useWorkspaceContextStore((s) => s.versionId);

    return useQuery({
        queryKey: auditKeys.calculations(versionId!),
        queryFn: () =>
            apiClient<{ entries: CalculationAuditEntry[] }>(
                `/audit/calculation?versionId=${versionId}`
            ),
        enabled: !!versionId,
    });
}
```

- [ ] **Step 2: Create TimelineItem component**

```tsx
// apps/web/src/components/shared/timeline-item.tsx
import type { ReactNode } from 'react';
import { formatDistanceToNow } from 'date-fns';

interface TimelineItemProps {
    icon: ReactNode;
    title: string;
    subtitle?: string;
    timestamp: string;
}

export function TimelineItem({ icon, title, subtitle, timestamp }: TimelineItemProps) {
    return (
        <div className="flex gap-3 py-2">
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-(--workspace-bg)">
                {icon}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm text-(--text-primary) truncate">{title}</p>
                {subtitle && <p className="text-xs text-(--text-muted) truncate">{subtitle}</p>}
                <p className="text-xs text-(--text-muted)">
                    {formatDistanceToNow(new Date(timestamp), { addSuffix: true })}
                </p>
            </div>
        </div>
    );
}
```

- [ ] **Step 3: Create ActivityFeed component**

```tsx
// apps/web/src/components/shell/activity-feed.tsx
import { useVersionActivity } from '../../hooks/use-audit';
import { TimelineItem } from '../shared/timeline-item';
import { FileText, Calculator, Users, Settings } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';

const operationIcons: Record<string, typeof FileText> = {
    FEE_GRID_UPDATED: FileText,
    VERSION_PUBLISHED: Settings,
    CALCULATE: Calculator,
    DEFAULT: Users,
};

export function ActivityFeed() {
    const { data, isLoading } = useVersionActivity();

    if (isLoading) {
        return (
            <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                ))}
            </div>
        );
    }

    const entries = data?.entries ?? [];

    if (entries.length === 0) {
        return <p className="text-sm text-(--text-muted)">No recent activity for this version.</p>;
    }

    return (
        <div className="space-y-1">
            {entries.map((entry) => {
                const Icon = operationIcons[entry.operation] ?? operationIcons.DEFAULT;
                return (
                    <TimelineItem
                        key={entry.id}
                        icon={<Icon className="h-3.5 w-3.5 text-(--text-muted)" />}
                        title={`${entry.userEmail} ${entry.operation.toLowerCase().replace(/_/g, ' ')}`}
                        subtitle={entry.tableName ? `on ${entry.tableName}` : undefined}
                        timestamp={entry.createdAt}
                    />
                );
            })}
        </div>
    );
}
```

- [ ] **Step 4: Create CalculationHistory component**

Similar pattern using `useCalculationHistory()`, showing module, user, duration, status.

- [ ] **Step 5: Wire into right-panel.tsx**

Replace placeholder text at lines ~153-162:

```tsx
{
    activeTab === 'activity' && <ActivityFeed />;
}
{
    activeTab === 'audit' && <CalculationHistory />;
}
```

- [ ] **Step 6: Run tests and commit**

```bash
pnpm --filter @budfin/web test
git add apps/web/src/hooks/use-audit.ts apps/web/src/components/shared/timeline-item.tsx apps/web/src/components/shell/activity-feed.tsx apps/web/src/components/shell/calculation-history.tsx apps/web/src/components/shell/right-panel.tsx
git commit -m "feat: populate right panel Activity and Audit tabs with real data"
```

---

### Task 8: Calculation Progress Indicator

**Files:**

- Modify: `apps/web/src/components/shared/calculate-button.tsx`

- [ ] **Step 1: Add estimatedDurationMs prop to CalculateButton**

```tsx
export interface CalculateButtonProps {
    onCalculate: () => void;
    isPending: boolean;
    isSuccess: boolean;
    isError: boolean;
    disabled?: boolean;
    disabledReason?: string;
    estimatedDurationMs?: number;
}
```

- [ ] **Step 2: Add elapsed time progress bar when isPending**

Add a `useEffect` with `setInterval` to track elapsed ms. Render a thin progress bar beneath the button showing `elapsed / estimated * 100%`.

- [ ] **Step 3: Store last duration in localStorage per module**

Create helper: `getLastDuration(module: string)` and `setLastDuration(module: string, ms: number)`.

- [ ] **Step 4: Wire in each page's calculate hook to persist duration**

In each `useCalculate*` hook's `onSuccess`, call `setLastDuration(module, data.durationMs)`.

- [ ] **Step 5: Test and commit**

```bash
pnpm --filter @budfin/web test
git commit -m "feat: add progress indicator to calculate buttons"
```

---

### Task 9: Guided Budget Cycle Wizard

**Files:**

- Create: `apps/web/src/components/dashboard/budget-cycle-wizard.tsx`
- Create: `apps/web/src/components/dashboard/setup-checklist.tsx`
- Modify: `apps/web/src/pages/planning/dashboard.tsx`

- [ ] **Step 1: Create SetupChecklist component**

A card showing 7 steps with check/pending indicators. Each step checks data existence via existing hooks:

1. Version exists (versionId is set)
2. Enrollment configured (headcount count > 0)
3. Fee grid set (fee grid data exists)
4. Staff imported (employee count > 0)
5. OpEx configured (line items exist)
6. Calculations run (no stale modules)
7. P&L reviewed (P&L data exists)

- [ ] **Step 2: Create BudgetCycleWizard dialog**

A multi-step dialog with Previous/Next navigation. Each step has a description and "Go to Module" button that navigates to the relevant page.

- [ ] **Step 3: Add to Dashboard page**

Add "Start New Budget" button and `<SetupChecklist>` card to the dashboard layout.

- [ ] **Step 4: Test and commit**

```bash
pnpm --filter @budfin/web test
git commit -m "feat: add budget cycle wizard and setup checklist to dashboard"
```

---

### Task 10: Drill-Down from Dashboard & P&L

**Files:**

- Modify: `apps/web/src/pages/planning/dashboard.tsx`
- Modify: `apps/web/src/components/pnl/pnl-page.tsx`

- [ ] **Step 1: Make Dashboard KPI cards clickable**

Wrap each KPI card in a clickable container with `useNavigate()`:

```tsx
const navigate = useNavigate();
// Revenue card -> onClick={() => navigate('/planning/revenue')}
// Staff Costs card -> onClick={() => navigate('/planning/staffing')}
// Enrollment card -> onClick(() => navigate('/planning/enrollment')}
```

Add `cursor-pointer hover:shadow-md transition-shadow` classes.

- [ ] **Step 2: Make P&L category rows clickable**

In `pnl-page.tsx`, add onClick handlers to category-level rows:

- Revenue rows -> `/planning/revenue`
- Staff Cost rows -> `/planning/staffing`
- OpEx rows -> `/planning/opex`

- [ ] **Step 3: Test and commit**

```bash
pnpm --filter @budfin/web test
git commit -m "feat: add drill-down navigation from Dashboard and P&L"
```

---

### Task 11: Version Comparison Charts

**Files:**

- Create: `apps/web/src/components/pnl/comparison-bar-chart.tsx`
- Create: `apps/web/src/components/pnl/variance-waterfall-chart.tsx`
- Modify: `apps/web/src/components/pnl/pnl-page.tsx`

- [ ] **Step 1: Create ComparisonBarChart**

Using Recharts `<BarChart>` with grouped bars for primary vs comparison version. Categories: Revenue, Staff Costs, OpEx, Net Profit.

- [ ] **Step 2: Create VarianceWaterfallChart**

Using Recharts `<BarChart>` styled as waterfall. Shows each variance contribution from base to comparison total.

- [ ] **Step 3: Wire into P&L page**

Render charts above the table when `comparisonVersionId` is selected in workspace context.

- [ ] **Step 4: Test and commit**

```bash
pnpm --filter @budfin/web test
git commit -m "feat: add comparison bar chart and variance waterfall to P&L"
```

---

### Task 12: Inline Cell Editing in Grids

**Files:**

- Create: `apps/web/src/components/data-grid/editable-numeric-cell.tsx`
- Modify: `apps/web/src/components/data-grid/planning-grid.tsx`

- [ ] **Step 1: Create EditableNumericCell renderer**

```tsx
// apps/web/src/components/data-grid/editable-numeric-cell.tsx
import { useState, useRef, useEffect, type KeyboardEvent } from 'react';

interface EditableNumericCellProps {
    value: number | string;
    onSave: (value: number) => void;
    editable: boolean;
}

export function EditableNumericCell({ value, onSave, editable }: EditableNumericCellProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(String(value));
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const handleSave = () => {
        const num = Number(editValue);
        if (!isNaN(num)) {
            onSave(num);
        }
        setIsEditing(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            handleSave();
        } else if (e.key === 'Escape') {
            setEditValue(String(value));
            setIsEditing(false);
        }
    };

    if (!editable) {
        return <span>{value}</span>;
    }

    if (isEditing) {
        return (
            <input
                ref={inputRef}
                type="number"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleSave}
                onKeyDown={handleKeyDown}
                className="w-full border-0 bg-transparent p-0 text-right text-sm outline-none ring-1 ring-(--border-focus) rounded px-1"
            />
        );
    }

    return (
        <span
            onDoubleClick={() => {
                setEditValue(String(value));
                setIsEditing(true);
            }}
            className="cursor-text"
            role="button"
            tabIndex={0}
            aria-label={`Edit value: ${value}`}
        >
            {value}
        </span>
    );
}
```

- [ ] **Step 2: Integrate into planning-grid for enrollment and OpEx**

Add `EditableNumericCell` as an available cell renderer in the grid configuration.

- [ ] **Step 3: Test and commit**

```bash
pnpm --filter @budfin/web test
git commit -m "feat: add inline cell editing for numeric values in planning grids"
```

---

### Task 13: Contextual Help Tooltips

**Files:**

- Create: `apps/web/src/lib/glossary.ts`
- Create: `apps/web/src/components/shared/info-tooltip.tsx`

- [ ] **Step 1: Create glossary**

```tsx
// apps/web/src/lib/glossary.ts
export const glossary: Record<string, string> = {
    YEARFRAC:
        'Excel-compatible day-count fraction used to prorate annual salary to monthly amounts based on actual calendar days.',
    'DHG Grille':
        'Dotation Horaire Globale — the French education staffing allocation grid that determines teaching hours per grade based on enrollment.',
    GOSI: 'General Organization for Social Insurance — Saudi mandatory employer contribution (currently 12% of base salary).',
    Echelon:
        'A step within a salary band in the DHG grille. Each echelon corresponds to a specific salary index.',
    Indice: 'The numerical index value associated with an echelon, multiplied by the point value to determine base salary.',
    'Cohort Retention':
        'The percentage of students from one academic year who return for the following year, used to project AY2 headcounts.',
    AY1: 'Academic Year 1 — the first year in the budget period (current year).',
    AY2: 'Academic Year 2 — the second year in the budget period (following year).',
    FTE: 'Full-Time Equivalent — a measure of staff workload where 1.0 = one full-time position.',
    Ajeer: 'Saudi temporary worker program. Ajeer employees have simplified cost structures (no indemnity, no AEFE contributions).',
    IFRS: 'International Financial Reporting Standards — used for the detailed P&L format showing revenue, costs, and margins in a standardized structure.',
    Zakat: 'Islamic tax obligation (2.5% of net income) applicable in Saudi Arabia.',
    PERCENT_OF_REVENUE:
        'An OpEx computation method where the line item amount is calculated as a percentage of total revenue.',
    'Stale Module':
        'A calculation module whose inputs have changed since it was last computed. Must be recalculated before downstream modules.',
    DAI: "Droit Annuel d'Inscription — annual registration fee charged per student.",
    ORS: 'Obligation Reglementaire de Service — the mandatory teaching hours per week for a position.',
    'Base Salary':
        'The core salary amount before allowances, determined by band, echelon, and point value.',
    Indemnity:
        'End-of-service benefit accrual calculated per Saudi labor law (0.5 months per year for first 5 years, 1 month per year thereafter).',
    'Housing Allowance':
        'Monthly housing benefit, typically 25% of annual base salary divided by 12.',
    'Transport Allowance': 'Monthly transport benefit, a fixed amount per employee category.',
    'AEFE Contribution':
        "Agence pour l'Enseignement Français à l'Étranger — the French education network contribution paid by the school.",
    'Gross Salary': 'Total salary including base + all allowances, before deductions.',
    'Net Cost':
        'Total employer cost per employee: gross salary + GOSI employer share + indemnity + AEFE contribution.',
    Band: 'A salary classification level in the DHG grille (e.g., Band A, Band B). Each band has multiple echelons.',
    'Service Obligation Profile':
        'Defines the weekly teaching hours required for a position type (e.g., 18h for secondary teacher, 24h for primary).',
};
```

- [ ] **Step 2: Create InfoTooltip component**

```tsx
// apps/web/src/components/shared/info-tooltip.tsx
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { glossary } from '../../lib/glossary';

interface InfoTooltipProps {
    term: keyof typeof glossary;
}

export function InfoTooltip({ term }: InfoTooltipProps) {
    const definition = glossary[term];
    if (!definition) return null;

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    type="button"
                    className="ml-1 inline-flex items-center text-(--text-muted) hover:text-(--text-primary)"
                    aria-label={`Info about ${term}`}
                >
                    <Info className="h-3.5 w-3.5" />
                </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
                <p className="text-sm">{definition}</p>
            </TooltipContent>
        </Tooltip>
    );
}
```

- [ ] **Step 3: Add tooltips to key column headers across planning pages**

Add `<InfoTooltip term="FTE" />` next to relevant headers in staffing, revenue, enrollment grids.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: add contextual help tooltips with financial glossary"
```

---

### Task 14: Dark Mode

**Files:**

- Create: `apps/web/src/components/shared/theme-provider.tsx`
- Modify: `apps/web/src/index.css`
- Modify: `apps/web/src/layouts/root-layout.tsx`
- Modify: `apps/web/src/components/shell/sidebar.tsx`

- [ ] **Step 1: Add dark theme tokens to index.css**

Add a `@media (prefers-color-scheme: dark)` or `.dark` class variant with inverted color tokens.

- [ ] **Step 2: Create ThemeProvider**

Zustand store managing `'light' | 'dark' | 'system'` preference, persisted to localStorage. Applies `.dark` class to `<html>` element.

- [ ] **Step 3: Add theme toggle to sidebar user menu**

Three-option toggle: Light / Dark / System with sun/moon/monitor icons.

- [ ] **Step 4: Test and commit**

```bash
pnpm --filter @budfin/web test
git commit -m "feat: add dark mode with theme toggle"
```

---

### Task 15: Print-Optimized Views

**Files:**

- Modify: `apps/web/src/index.css`
- Modify: `apps/web/src/components/pnl/pnl-page.tsx`
- Modify: `apps/web/src/pages/planning/revenue.tsx`
- Modify: `apps/web/src/components/staffing/staffing-page-v2.tsx`

- [ ] **Step 1: Add @media print rules to index.css**

```css
@media print {
    [data-sidebar],
    [data-context-bar],
    [data-right-panel],
    button,
    .no-print {
        display: none !important;
    }

    main {
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
    }

    table {
        font-size: 10px;
        page-break-inside: auto;
    }

    tr {
        page-break-inside: avoid;
    }

    .print-header {
        display: block !important;
    }
}

.print-header {
    display: none;
}
```

- [ ] **Step 2: Add data attributes to layout elements for print targeting**

Add `data-sidebar`, `data-context-bar`, `data-right-panel` attributes to the respective components.

- [ ] **Step 3: Add Print button to P&L, Revenue, and Staffing toolbars**

```tsx
<Button variant="outline" size="sm" onClick={() => window.print()} className="no-print">
    <Printer className="h-4 w-4 mr-1.5" />
    Print
</Button>
```

- [ ] **Step 4: Add print header**

```tsx
<div className="print-header">
    <h1>EFIR Budget Report</h1>
    <p>
        {versionName} — {fiscalYear}
    </p>
    <p>Printed: {new Date().toLocaleDateString()}</p>
</div>
```

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: add print-optimized CSS and Print buttons"
```

---

### Task 16: Keyboard Shortcuts + Command Palette

**Files:**

- Create: `apps/web/src/lib/hotkeys.ts`
- Create: `apps/web/src/components/shared/command-palette.tsx`
- Create: `apps/web/src/components/shared/command-palette.test.tsx`
- Modify: `apps/web/src/layouts/root-layout.tsx`

- [ ] **Step 1: Create useHotkeys hook**

```tsx
// apps/web/src/lib/hotkeys.ts
import { useEffect, useRef } from 'react';

export function useHotkeys(key: string, callback: () => void) {
    const callbackRef = useRef(callback);
    callbackRef.current = callback;

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            const isMac = navigator.platform.includes('Mac');
            const mod = isMac ? e.metaKey : e.ctrlKey;

            if (key === 'mod+k' && mod && e.key === 'k') {
                e.preventDefault();
                callbackRef.current();
            } else if (key === 'mod+enter' && mod && e.key === 'Enter') {
                e.preventDefault();
                callbackRef.current();
            } else if (key === 'escape' && e.key === 'Escape') {
                callbackRef.current();
            }
        };

        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [key]);
}
```

- [ ] **Step 2: Create CommandPalette component**

A modal dialog with search input and filtered list of commands (pages, actions). Uses `useHotkeys('mod+k', toggle)` to open/close.

- [ ] **Step 3: Write tests**

Test: opens on Cmd+K, filters commands, navigates on selection, closes on Escape.

- [ ] **Step 4: Mount in RootLayout**

```tsx
<CommandPalette />
```

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: add command palette with keyboard shortcuts"
```

---

## Chunk 3: Feature A — Comments & Annotations (Tasks 17-20)

### Task 17: Comment Prisma Model + Migration

**Files:**

- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Add Comment model to schema.prisma**

Add after the ScenarioParameters model:

```prisma
// ── Comments & Annotations ──────────────────────────────────────────────────

model Comment {
  id           Int       @id @default(autoincrement())
  versionId    Int       @map("version_id")
  targetType   String    @map("target_type") @db.VarChar(30)
  targetId     String    @map("target_id") @db.VarChar(100)
  parentId     Int?      @map("parent_id")
  authorId     Int       @map("author_id")
  body         String    @db.Text
  resolvedAt   DateTime? @map("resolved_at") @db.Timestamptz
  resolvedById Int?      @map("resolved_by_id")
  createdAt    DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt    DateTime  @updatedAt @map("updated_at") @db.Timestamptz

  version    BudgetVersion @relation(fields: [versionId], references: [id], onDelete: Cascade)
  parent     Comment?      @relation("CommentThread", fields: [parentId], references: [id], onDelete: Cascade)
  replies    Comment[]     @relation("CommentThread")
  author     User          @relation("CommentAuthor", fields: [authorId], references: [id])
  resolvedBy User?         @relation("CommentResolver", fields: [resolvedById], references: [id])

  @@index([versionId, targetType, targetId], map: "idx_comment_target")
  @@index([parentId], map: "idx_comment_parent")
  @@map("comments")
}
```

- [ ] **Step 2: Add relation fields to User model**

Add to the User model:

```prisma
  commentsAuthored Comment[] @relation("CommentAuthor")
  commentsResolved Comment[] @relation("CommentResolver")
```

- [ ] **Step 3: Add relation field to BudgetVersion model**

```prisma
  comments Comment[]
```

- [ ] **Step 4: Run migration**

```bash
pnpm --filter @budfin/api exec prisma migrate dev --name add-comments
pnpm --filter @budfin/api exec prisma generate
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/
git commit -m "feat: add Comment model with threading and resolve support"
```

---

### Task 18: Comments API Routes

**Files:**

- Create: `apps/api/src/routes/comments.ts`
- Create: `apps/api/src/routes/comments.test.ts`

- [ ] **Step 1: Write failing tests for CRUD operations**

Test file covers: list comments, get counts, create comment, create reply, edit own comment, resolve thread, unresolve thread, delete own comment, RBAC checks.

- [ ] **Step 2: Implement comment routes**

Register at `/api/v1/versions/:versionId/comments`. All endpoints use Zod schemas for validation. Auth + permission preHandlers on every route.

Key implementation details:

- `GET /` -- Filter by `targetType` and `targetId`. Include author relation. Fetch replies for each root comment.
- `GET /counts` -- Group by `targetId`, count where `resolvedAt IS NULL` and `parentId IS NULL`.
- `POST /` -- Create with `authorId` from JWT. Audit log.
- `PATCH /:id` -- Check `authorId === req.user.id`. Only update `body`.
- `POST /:id/resolve` -- Set `resolvedAt = now()`, `resolvedById = req.user.id`.
- `POST /:id/unresolve` -- Clear `resolvedAt` and `resolvedById`.
- `DELETE /:id` -- Check `authorId === req.user.id`. Cascades to replies.

- [ ] **Step 3: Run tests to verify all pass**

```bash
pnpm --filter @budfin/api exec vitest run src/routes/comments.test.ts
```

- [ ] **Step 4: Register routes in index.ts**

Add to `apps/api/src/index.ts`:

```ts
import { commentRoutes } from './routes/comments';
// Inside route registration:
app.register(commentRoutes, { prefix: '/api/v1/versions/:versionId/comments' });
```

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: add Comments API with threading, resolve, and RBAC"
```

---

### Task 19: Comments Frontend Hooks + Types

**Files:**

- Create: `apps/web/src/hooks/use-comments.ts`
- Modify: `packages/types/src/index.ts` (add Comment types)

- [ ] **Step 1: Add Comment types to shared package**

```ts
export interface Comment {
    id: number;
    versionId: number;
    targetType: string;
    targetId: string;
    parentId: number | null;
    authorId: number;
    authorEmail: string;
    body: string;
    resolvedAt: string | null;
    resolvedByEmail: string | null;
    createdAt: string;
    updatedAt: string;
    replies: Comment[];
}

export interface CommentCount {
    targetId: string;
    unresolvedCount: number;
}
```

- [ ] **Step 2: Create use-comments.ts hooks**

Hooks: `useComments`, `useCommentCounts`, `useCreateComment`, `useEditComment`, `useDeleteComment`, `useResolveComment`, `useUnresolveComment`.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: add Comment types and frontend hooks"
```

---

### Task 20: Comments UI Components + Integration

**Files:**

- Create: `apps/web/src/components/shared/comment-thread.tsx`
- Create: `apps/web/src/components/shared/comment-indicator.tsx`
- Modify: `apps/web/src/components/shell/right-panel.tsx`
- Modify: Planning grid pages (revenue, staffing, opex, enrollment)

- [ ] **Step 1: Create CommentThread component**

Renders root comment + replies list + reply input. Resolve/unresolve button. Edit/delete for own comments.

- [ ] **Step 2: Create CommentIndicator badge**

Small badge showing unresolved count. Click opens right panel to Details tab filtered to that row's comments.

- [ ] **Step 3: Wire CommentThread into right panel Details tab**

When a row is selected and has comments, show them in the Details tab.

- [ ] **Step 4: Add CommentIndicator to planning grids**

Add a comment count column to enrollment, revenue, staffing, and opex grids.

- [ ] **Step 5: Test and commit**

```bash
pnpm --filter @budfin/web test
git commit -m "feat: add comment threads and indicators to planning grids"
```

---

## Chunk 4: Feature B — PDF & Excel Export (Tasks 21-25)

### Task 21: Export API Routes

**Files:**

- Create: `apps/api/src/routes/export.ts`
- Create: `apps/api/src/routes/export.test.ts`

- [ ] **Step 1: Write failing tests**

Test: create export job, poll status, download file, RBAC for salary reports, error responses.

- [ ] **Step 2: Implement export routes**

```ts
// POST /api/v1/export/jobs
// GET /api/v1/export/jobs/:id
// GET /api/v1/export/jobs/:id/download
```

POST creates an ExportJob record and enqueues a pg-boss job. GET /:id returns status/progress. GET /:id/download streams the file.

- [ ] **Step 3: Register routes**

Add to `apps/api/src/index.ts`:

```ts
import { exportRoutes } from './routes/export';
app.register(exportRoutes, { prefix: '/api/v1/export' });
```

- [ ] **Step 4: Run tests and commit**

```bash
git commit -m "feat: add Export API routes with pg-boss job queue"
```

---

### Task 22: Report Data Loader

**Files:**

- Create: `apps/api/src/services/export/report-data-loader.ts`
- Create: `apps/api/src/services/export/report-data-loader.test.ts`

- [ ] **Step 1: Implement data loader**

A function per report type that fetches all necessary data:

```ts
export async function loadReportData(
    prisma: PrismaClient,
    versionId: number,
    reportType: string,
    options: { comparisonVersionId?: number; pnlFormat?: string }
): Promise<ReportData>;
```

Reuses query patterns from existing route handlers but consolidates into one data object.

- [ ] **Step 2: Test with mock data and commit**

```bash
git commit -m "feat: add report data loader for export service"
```

---

### Task 23: PDF Generator

**Files:**

- Create: `apps/api/src/services/export/pdf-generator.tsx`
- Create: `apps/api/src/services/export/templates/pdf-header.tsx`
- Create: `apps/api/src/services/export/templates/pdf-table.tsx`
- Create: `apps/api/src/services/export/pdf-generator.test.ts`

- [ ] **Step 1: Create shared PDF components**

`pdf-header.tsx`: EFIR branding, version info, date. `pdf-table.tsx`: Generic table renderer with column definitions.

- [ ] **Step 2: Create PDF generator per report type**

Each report type gets a React PDF document component. The generator renders to PDF buffer.

- [ ] **Step 3: Test and commit**

```bash
git commit -m "feat: add PDF report generator with @react-pdf/renderer"
```

---

### Task 24: Excel Generator

**Files:**

- Create: `apps/api/src/services/export/excel-generator.ts`
- Create: `apps/api/src/services/export/excel-generator.test.ts`

- [ ] **Step 1: Implement Excel generator**

Using ExcelJS: create workbook, add sheets per report section, format headers, freeze panes, auto-width columns, SAR number format.

- [ ] **Step 2: Test and commit**

```bash
git commit -m "feat: add Excel report generator with ExcelJS"
```

---

### Task 25: Export Worker + Frontend Integration

**Files:**

- Create: `apps/api/src/services/export/export-worker.ts`
- Create: `apps/web/src/hooks/use-export.ts`
- Create: `apps/web/src/components/shared/export-dialog.tsx`
- Modify: `apps/web/src/hooks/use-pnl.ts` (remove export hooks, re-export from use-export)
- Modify: Module toolbar pages (add Export button)

- [ ] **Step 1: Implement export worker**

pg-boss job handler that loads data, generates file (PDF or Excel), saves to `data/exports/`, updates ExportJob record.

Error handling: catch exceptions, set status to `'FAILED'`, store error message.

- [ ] **Step 2: Create use-export.ts hooks**

Move `useCreateExportJob` and `useExportJobStatus` from `use-pnl.ts`. Add `useDownloadExport(jobId)` that triggers file download.

- [ ] **Step 3: Create ExportDialog**

Modal with: report type dropdown, format toggle (PDF/Excel), comparison version option, "Export" button. Shows progress bar while generating.

- [ ] **Step 4: Add Export button to all module toolbars**

- [ ] **Step 5: Add cleanup job**

Register hourly pg-boss job to delete expired export files.

- [ ] **Step 6: Test and commit**

```bash
pnpm test
git commit -m "feat: complete export pipeline with worker, dialog, and cleanup"
```

---

## Chunk 5: Feature C — Historical Trend Analysis (Tasks 26-28)

### Task 26: Trends API Endpoint

**Files:**

- Create: `apps/api/src/routes/trends.ts`
- Create: `apps/api/src/routes/trends.test.ts`

- [ ] **Step 1: Write failing tests**

Test cases: 0 years (empty response), 1 year (no growth), 2+ years (with growth rates), metric filtering, graceful handling of missing data.

- [ ] **Step 2: Implement trends route**

```ts
// GET /api/v1/trends?metrics=revenue,staffCost,opex,netProfit,enrollment,fte&years=5
```

Logic:

1. Find all fiscal years with `'Locked'` or `'Archived'` versions
2. Pick canonical version per year (prefer `'Locked'`, then `'Archived'`, newest first)
3. For each version, load `MonthlyBudgetSummary` aggregates
4. Calculate YoY growth rates
5. Return structured response

- [ ] **Step 3: Register route**

```ts
app.register(trendRoutes, { prefix: '/api/v1/trends' });
```

- [ ] **Step 4: Run tests and commit**

```bash
git commit -m "feat: add Historical Trends API endpoint"
```

---

### Task 27: Trends Frontend Page

**Files:**

- Create: `apps/web/src/pages/planning/trends.tsx`
- Create: `apps/web/src/hooks/use-trends.ts`
- Create: `apps/web/src/components/trends/trend-line-chart.tsx`
- Create: `apps/web/src/components/trends/growth-rate-table.tsx`
- Create: `apps/web/src/components/trends/per-pupil-kpis.tsx`
- Create: `apps/web/src/components/trends/trend-empty-state.tsx`
- Modify: `apps/web/src/router.tsx`
- Modify: `apps/web/src/components/shell/sidebar.tsx`

- [ ] **Step 1: Create use-trends.ts hook**

```tsx
export function useTrends(metrics: string[], years: number = 5) {
    return useQuery({
        queryKey: ['trends', metrics, years],
        queryFn: () =>
            apiClient<TrendsResponse>(`/trends?metrics=${metrics.join(',')}&years=${years}`),
        staleTime: 5 * 60_000,
    });
}
```

- [ ] **Step 2: Create TrendLineChart**

Recharts `<LineChart>` with lines per selected metric. X-axis: fiscal year labels. Y-axis: SAR amounts (formatted with `formatMoney`).

- [ ] **Step 3: Create GrowthRateTable**

Table showing YoY growth per metric. Green for positive, red for negative. `formatMoney` for amounts.

- [ ] **Step 4: Create PerPupilKpis**

Derived metrics card: revenue/student, cost/student, staff cost/FTE.

- [ ] **Step 5: Create TrendEmptyState**

Shows when < 2 years of data exist. Message varies:

- 0 years: "No locked or archived versions found. Lock a version to start tracking trends."
- 1 year: "Showing current year data. Historical comparison available after the next fiscal year is locked."

- [ ] **Step 6: Create trends page**

```tsx
// apps/web/src/pages/planning/trends.tsx
// Composes: TrendLineChart, GrowthRateTable, PerPupilKpis, TrendEmptyState
```

- [ ] **Step 7: Add route and sidebar link**

In `router.tsx`, add under PlanningShell:

```tsx
{ path: 'trends', element: <TrendsPage /> }
```

In `sidebar.tsx`, add "Trends" after "Scenarios" in planning nav with `TrendingUp` icon.

- [ ] **Step 8: Test and commit**

```bash
pnpm --filter @budfin/web test
git commit -m "feat: add Historical Trends page with charts and growth analysis"
```

---

### Task 28: Trends Integration + Polish

**Files:**

- Modify: `apps/web/src/pages/planning/trends.tsx`
- Modify: `apps/web/src/pages/planning/dashboard.tsx`

- [ ] **Step 1: Add trends summary card to Dashboard**

Show a small "Year-over-Year" card on the dashboard with key growth rates, linking to the full Trends page.

- [ ] **Step 2: Add metric selector to Trends page**

Checkboxes for which metrics to display on the chart. Default: all.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: add trends summary to dashboard and metric selector"
```

---

## Chunk 6: Test Coverage to 80% (Tasks 29-33)

### Task 29: Wave 1 — Zero-Coverage API Validation Modules

**Files:**

- Create: `apps/api/src/validation/parse-consolidated-excel.test.ts`
- Create: `apps/api/src/validation/parse-dhg-excel.test.ts`
- Create: `apps/api/src/validation/parse-enrollment-csv.test.ts`
- Create: `apps/api/src/validation/parse-revenue-excel.test.ts`
- Create: `apps/api/src/validation/seed-fy2026.test.ts`
- Create: `apps/api/src/validation/seed-prior-year-fees.test.ts`
- Create: `apps/api/src/services/staffing/crypto-helper.test.ts`

- [ ] **Step 1: Create test fixtures**

Create fixture Excel/CSV buffers for each validator. Use ExcelJS to programmatically create test workbooks with valid and invalid data.

- [ ] **Step 2: Write tests for parse-consolidated-excel.ts**

Test: valid file parses correctly, missing required columns throws, invalid data types flagged, empty rows skipped.

- [ ] **Step 3: Write tests for parse-dhg-excel.ts**

Test: valid DHG data parses, invalid grades flagged, missing disciplines handled.

- [ ] **Step 4: Write tests for parse-enrollment-csv.ts**

Test: valid CSV parses, header validation, data type coercion, error collection.

- [ ] **Step 5: Write tests for parse-revenue-excel.ts**

Test: valid revenue data, fee grid validation, VAT consistency checks.

- [ ] **Step 6: Write tests for seed files**

Test: seed-fy2026 generates expected data structure, seed-prior-year-fees handles missing data.

- [ ] **Step 7: Write tests for crypto-helper.ts**

Mock pgcrypto functions. Test encrypt/decrypt roundtrip, error on missing key.

- [ ] **Step 8: Run coverage and verify improvement**

```bash
pnpm --filter @budfin/api exec vitest run --coverage
```

- [ ] **Step 9: Commit**

```bash
git commit -m "test: add tests for validation modules and crypto-helper"
```

---

### Task 30: Wave 1 — Zero-Coverage Frontend Pages

**Files:**

- Create: `apps/web/src/pages/planning/dashboard.test.tsx`
- Create: `apps/web/src/components/scenarios/scenario-page.test.tsx`
- Create: `apps/web/src/components/opex/opex-page.test.tsx`
- Create: `apps/web/src/components/opex/opex-grid.test.tsx`

- [ ] **Step 1: Write Dashboard page tests**

Test: renders KPI cards, loading skeleton shown, error state handled, drill-down navigation works.

- [ ] **Step 2: Write Scenario page tests**

Test: renders parameter form, edit mode toggles, save mutation fires, validation on invalid values.

- [ ] **Step 3: Write OpEx page + grid tests**

Test: renders line items, calculate button works, empty state shown when no data, inline editing.

- [ ] **Step 4: Run coverage and commit**

```bash
pnpm --filter @budfin/web exec vitest run --coverage
git commit -m "test: add tests for Dashboard, Scenario, and OpEx pages"
```

---

### Task 31: Wave 2 — Below-Threshold API Route Tests

**Files:**

- Modify: Existing test files in `apps/api/src/routes/`

- [ ] **Step 1: Identify routes below 80%**

Run: `pnpm --filter @budfin/api exec vitest run --coverage`

List all route files below 80% lines.

- [ ] **Step 2: Add error path tests**

For each route below threshold, add tests for:

- 409 STALE_DATA responses
- 403 Forbidden (wrong role)
- 400 Validation errors (invalid Zod input)
- 404 Not found
- P2025 Prisma errors

- [ ] **Step 3: Run coverage and verify >= 80%**

- [ ] **Step 4: Commit**

```bash
git commit -m "test: add error path tests for API routes"
```

---

### Task 32: Wave 2 — Below-Threshold Frontend Tests

**Files:**

- Modify/create tests in `apps/web/src/hooks/`, `apps/web/src/stores/`, `apps/web/src/pages/`

- [ ] **Step 1: Identify frontend modules below 80%**

Run: `pnpm --filter @budfin/web exec vitest run --coverage`

- [ ] **Step 2: Add hook tests**

Test mutation callbacks (onSuccess invalidation, onError toast), query enable conditions, stale time behavior.

- [ ] **Step 3: Add store tests**

Test state transitions, selectors, actions for all Zustand stores.

- [ ] **Step 4: Add page interaction tests**

Test button clicks, filter changes, empty states, loading states.

- [ ] **Step 5: Run coverage and verify >= 80%**

- [ ] **Step 6: Commit**

```bash
git commit -m "test: raise frontend coverage to 80% across hooks, stores, and pages"
```

---

### Task 33: Wave 3 — New Feature Tests

**Files:**

- Create tests for all new files from Tasks 7-28

- [ ] **Step 1: Test Comments API (routes/comments.test.ts)**

Already covered in Task 18. Verify >= 80%.

- [ ] **Step 2: Test Export pipeline**

Tests for export-worker, pdf-generator, excel-generator, report-data-loader. Already covered in Tasks 21-24. Verify >= 80%.

- [ ] **Step 3: Test Trends API and frontend**

Tests for trends route and page components. Already covered in Tasks 26-27. Verify >= 80%.

- [ ] **Step 4: Test all new UI components**

Write tests for: command-palette, info-tooltip, theme-provider, error-boundary (already done), comment-thread, comment-indicator, export-dialog, setup-checklist, budget-cycle-wizard.

- [ ] **Step 5: Final coverage verification**

```bash
pnpm test
pnpm --filter @budfin/api exec vitest run --coverage
pnpm --filter @budfin/web exec vitest run --coverage
```

Both must show >= 80% lines, functions, statements, branches.

- [ ] **Step 6: Commit**

```bash
git commit -m "test: achieve 80% coverage across all modules"
```

---

## Final Verification

- [ ] **Run full test suite**: `pnpm test` -- all pass
- [ ] **Run typecheck**: `pnpm typecheck` -- zero errors
- [ ] **Run lint**: `pnpm lint:all` -- zero errors
- [ ] **Run coverage**: Both API and Web >= 80%
- [ ] **Manual smoke test**: Start dev server (`pnpm dev`), verify each new feature works
