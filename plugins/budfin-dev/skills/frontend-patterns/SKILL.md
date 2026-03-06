---
name: frontend-patterns
description: React 19 + Vite 7 + Tailwind CSS 4 + shadcn/ui frontend patterns for BudFin. Use when building React components, hooks, pages, forms, data tables, routing, bundle configuration, or any UI-related work. Encodes Tailwind v4 CSS-first approach, shadcn/ui copy-paste pattern, TanStack Table v8, React Hook Form v7 with Zod 4, token storage rules, and WCAG AA requirements.
---

# BudFin Frontend Patterns (React 19 + Vite 7 + Tailwind 4)

## Tailwind CSS v4 — CSS-First Configuration

Tailwind v4 is fundamentally different from v3 — no `tailwind.config.js`:

```css
/* src/styles/globals.css */
@import 'tailwindcss';

@theme {
    --color-primary: oklch(55% 0.2 250);
    --color-primary-foreground: oklch(98% 0 0);
    --font-sans: 'Inter', sans-serif;
    --radius: 0.5rem;
}
```

- Use `@tailwindcss/vite` plugin in `vite.config.ts` — NOT PostCSS
- No `tailwind.config.js` or `tailwind.config.ts` — configuration is in CSS `@theme` blocks
- Utility classes work exactly as before; configuration syntax changed

## shadcn/ui — Copy-Paste Pattern

shadcn/ui components are COPY-PASTED into the project, not imported from npm:

```
src/components/ui/
├── button.tsx      # Copied from shadcn/ui, owned by us
├── table.tsx
├── dialog.tsx
├── input.tsx
└── ...
```

- **Never** `import { Button } from 'shadcn-ui'` — the npm package doesn't exist
- **Always** `import { Button } from '@/components/ui/button'`
- We own these files — modify them freely for project needs
- Add new shadcn/ui components with `pnpm dlx shadcn@latest add <component>`

## TanStack Table v8 — Headless + shadcn/ui Pairing

```typescript
import { useReactTable, getCoreRowModel, type ColumnDef } from '@tanstack/react-table';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

// Column definitions MUST be wrapped in useMemo — never recreate on render
const columns = useMemo<ColumnDef<BudgetRow>[]>(
    () => [
        {
            accessorKey: 'staffName',
            header: 'Staff Name',
            cell: ({ getValue }) => getValue<string>(),
        },
        {
            accessorKey: 'amount',
            header: 'Amount (SAR)',
            // TC-004: format at presentation layer only
            cell: ({ getValue }) => new Decimal(getValue<string>()).toFixed(2),
        },
    ],
    []
); // dependencies array — add only stable references

// Server-side pagination for all financial grids
const table = useReactTable({
    data,
    columns,
    manualPagination: true, // Always true for financial grids
    pageCount,
    state: { pagination },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
});
```

## React Hook Form v7 + Zod 4

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
    name: z.string().min(1, 'Name is required'),
    fiscalYear: z.number().int().min(2020),
});

type FormData = z.infer<typeof schema>;

function MyForm() {
    const form = useForm<FormData>({
        resolver: zodResolver(schema),
        defaultValues: { name: '', fiscalYear: 2026 },
    });
    // ...
}
```

- Use `@hookform/resolvers` v5 — required for Zod 4 compatibility (v3 does NOT work with Zod 4)

## State Management

| State type                             | Solution           |
| -------------------------------------- | ------------------ |
| Server state (API data)                | TanStack Query v5  |
| UI-only client state                   | Zustand v5         |
| Workspace state (fiscal year, version) | React Context      |
| Form state                             | React Hook Form v7 |

```typescript
// TanStack Query v5 — server state
const { data, isLoading } = useQuery({
    queryKey: ['budget-versions', fiscalYear],
    queryFn: () => api.getBudgetVersions(fiscalYear),
});

// Zustand v5 — UI state only
const useSidebarStore = create<SidebarState>()((set) => ({
    isOpen: false,
    toggle: () => set((state) => ({ isOpen: !state.isOpen })),
}));
```

## Token Storage Rule

- **Access token**: JavaScript closure ONLY (in-memory variable, never persisted)
- **NEVER** store access token in `localStorage` or `sessionStorage`
- **Refresh token**: Managed by HTTP-only cookie (set by API server, never readable by JS)

```typescript
// Correct — token in closure
let accessToken: string | null = null;

function setToken(token: string) {
    accessToken = token;
}
function getToken() {
    return accessToken;
}
function clearToken() {
    accessToken = null;
}

// Wrong — NEVER do this
localStorage.setItem('accessToken', token);
sessionStorage.setItem('accessToken', token);
```

## Monetary Display (TC-004)

```typescript
import { Decimal } from 'decimal.js';

// In table cells and display components only
const display = new Decimal(amount).toFixed(2); // '12345.67'

// Never compute in browser — values come pre-computed from API as strings
// TC-004: round only at presentation, ROUND_HALF_UP
```

## Export UX Pattern

File exports (PDF, Excel) use a job polling pattern:

1. User clicks Export → POST to `/exports` → receive `jobId`
2. Poll `GET /exports/:jobId/status` until `status === 'complete'`
3. Download from `GET /exports/:jobId/download` (URL expires in 1 hour)
4. Show progress indicator during polling; disable export button while job runs

## Bundle Performance

- Target: < 150 KB gzipped initial bundle
- Code-split by route using Vite lazy imports:
    ```typescript
    const BudgetPage = lazy(() => import('./pages/BudgetPage'));
    ```
- No barrel files (`index.ts` that re-export everything) — they prevent tree-shaking

## WCAG AA Requirements

- All interactive elements keyboard-accessible (`Tab`, `Enter`, `Space`, `Escape`)
- Semantic HTML: use `<button>` for buttons, `<nav>` for navigation, `<main>` for main content
- Color contrast: minimum 4.5:1 for normal text, 3:1 for large text (18px+ or 14px+ bold)
- Focus indicators visible — never `outline: none` without a custom focus style
- `aria-label` on icon-only buttons; `aria-describedby` on complex form fields
