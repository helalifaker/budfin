# Frontend Consistency Audit Report

**Date**: 2026-03-09  
**Scope**: `apps/web/src/pages/` and related layout components  
**Auditor**: AI Code Assistant

---

## Executive Summary

The BudFin frontend has **19 pages** across 5 categories with **moderate inconsistency**. While planning pages follow a consistent workspace pattern, management and master data pages have notable inconsistencies in:

1. **Table header backgrounds** (2 different color tokens)
2. **Row hover states** (2 different color tokens)
3. **Heading typography** (mixed `text-xl` and `text-(--text-xl)`)
4. **Skeleton delay implementations** (minor variations)
5. **Toolbar layouts** (inconsistent gap sizing and alignment)

**Overall Assessment**: 🟡 **High Priority** - Inconsistencies are visible to users but don't break functionality.

---

## Detailed Findings

### 1. Layout & Spacing Consistency

#### 🔴 Critical: None found

#### 🟡 High: Container Padding Inconsistency

| File                  | Current         | Expected                | Issue                               |
| --------------------- | --------------- | ----------------------- | ----------------------------------- |
| `academic.tsx:207`    | `space-y-8 p-6` | `p-6` with section gaps | Uses extra spacing between sections |
| `assumptions.tsx:231` | `p-6` only      | Same                    | OK                                  |
| `versions.tsx:341`    | `p-6` only      | Same                    | OK                                  |

**Recommendation**: Standardize on `p-6` for all page containers. Use `space-y-6` between sections only when multiple distinct sections exist.

#### 🟢 Medium: Toolbar Layout Variations

| File                     | Gap     | Pattern                            |
| ------------------------ | ------- | ---------------------------------- |
| `versions.tsx:343`       | `gap-3` | `flex-wrap items-center`           |
| `fiscal-periods.tsx:159` | `gap-3` | `flex-wrap items-center`           |
| `accounts.tsx:310`       | `gap-3` | `flex-wrap items-center`           |
| `users.tsx:232`          | (none)  | `justify-between` only             |
| `reference.tsx:667`      | (none)  | `justify-between` inside tab panel |

**Fix**: All toolbars should use `flex flex-wrap items-center gap-3 pb-4` pattern.

---

### 2. Typography Standards

#### 🟡 High: Heading Size Inconsistency

| File                     | Current                  | Expected                      |
| ------------------------ | ------------------------ | ----------------------------- |
| `versions.tsx:344`       | `text-xl` (hardcoded)    | `text-(--text-xl)`            |
| `fiscal-periods.tsx:160` | `text-xl` (hardcoded)    | `text-(--text-xl)`            |
| `users.tsx:233`          | `text-(--text-xl)` ✅    | `text-(--text-xl)`            |
| `settings.tsx:173`       | `text-(--text-xl)` ✅    | `text-(--text-xl)`            |
| `audit.tsx:145`          | `text-(--text-xl)` ✅    | `text-(--text-xl)`            |
| `reference.tsx:630`      | `text-(--text-xl)` ✅    | `text-(--text-xl)`            |
| `assumptions.tsx:231`    | `text-(--text-xl)` ✅    | `text-(--text-xl)`            |
| `academic.tsx:211,276`   | `text-(--text-xl)` on H2 | Should use H1 for consistency |

**Fix Required**:

```tsx
// versions.tsx:344, fiscal-periods.tsx:160
- <h1 className="mr-auto text-xl font-semibold">
+ <h1 className="mr-auto text-(--text-xl) font-semibold">
```

```tsx
// academic.tsx:211,276
- <h2 className="text-(--text-xl) font-semibold">
+ <h1 className="text-(--text-xl) font-semibold">
```

---

### 3. Table Component Patterns

#### 🟡 High: Table Header Background Inconsistency

| File                     | Current Header BG              | Expected                    |
| ------------------------ | ------------------------------ | --------------------------- |
| `versions.tsx:450`       | `bg-(--workspace-bg-subtle)`   | `bg-(--workspace-bg-muted)` |
| `fiscal-periods.tsx:188` | `bg-(--workspace-bg-subtle)`   | `bg-(--workspace-bg-muted)` |
| `users.tsx:248`          | `bg-(--workspace-bg-muted)` ✅ | `bg-(--workspace-bg-muted)` |
| `settings.tsx`           | N/A (card-based)               | N/A                         |
| `audit.tsx:151`          | `bg-(--workspace-bg-muted)` ✅ | `bg-(--workspace-bg-muted)` |
| `accounts.tsx:382`       | `bg-(--workspace-bg-muted)` ✅ | `bg-(--workspace-bg-muted)` |
| `reference.tsx:169`      | `bg-(--workspace-bg-muted)` ✅ | `bg-(--workspace-bg-muted)` |
| `academic.tsx:227,282`   | `bg-(--workspace-bg-muted)` ✅ | `bg-(--workspace-bg-muted)` |
| `assumptions.tsx:235`    | `bg-(--workspace-bg-muted)` ✅ | `bg-(--workspace-bg-muted)` |

**Fix Required**:

```tsx
// versions.tsx:450, fiscal-periods.tsx:188
- <thead className="border-b bg-(--workspace-bg-subtle)">
+ <thead className="border-b bg-(--workspace-bg-muted)">
```

#### 🟡 High: Row Hover Color Inconsistency

| File                     | Current Hover                      | Expected                 |
| ------------------------ | ---------------------------------- | ------------------------ |
| `versions.tsx:616`       | `hover:bg-(--workspace-bg-subtle)` | `hover:bg-(--accent-50)` |
| `fiscal-periods.tsx:213` | `hover:bg-(--workspace-bg-subtle)` | `hover:bg-(--accent-50)` |
| `users.tsx:266`          | `hover:bg-(--accent-50)` ✅        | `hover:bg-(--accent-50)` |
| `audit.tsx:169`          | `hover:bg-(--accent-50)` ✅        | `hover:bg-(--accent-50)` |
| `accounts.tsx:409`       | `hover:bg-(--accent-50)` ✅        | `hover:bg-(--accent-50)` |
| `reference.tsx:197`      | `hover:bg-(--accent-50)` ✅        | `hover:bg-(--accent-50)` |
| `academic.tsx:254,308`   | `hover:bg-(--accent-50)` ✅        | `hover:bg-(--accent-50)` |

**Fix Required**:

```tsx
// versions.tsx:616, fiscal-periods.tsx:213
- className="... hover:bg-(--workspace-bg-subtle) ..."
+ className="... hover:bg-(--accent-50) ..."
```

#### 🟢 Medium: Table Text Size Inconsistency

| File                     | Table Text Size                              |
| ------------------------ | -------------------------------------------- |
| `versions.tsx:449`       | `text-sm` (hardcoded)                        |
| `fiscal-periods.tsx:187` | `text-sm` (hardcoded)                        |
| `users.tsx:247`          | `text-(--text-sm)` ✅                        |
| `accounts.tsx:381`       | `text-(--text-sm)` ✅                        |
| `reference.tsx`          | `text-(length:--text-sm)` (different syntax) |

**Fix**: Standardize on `text-(--text-sm)` for all tables.

---

### 4. Skeleton Loading Patterns

#### 🟢 Medium: Skeleton Implementation Variations

Most pages use the 200ms-delayed skeleton pattern correctly, but with minor inconsistencies:

| File                      | Delay | Notes                                              |
| ------------------------- | ----- | -------------------------------------------------- |
| `versions.tsx:136-145`    | 200ms | Uses `isLoading && showSkeleton` pattern correctly |
| `fiscal-periods.tsx`      | 200ms | Inlined inside table, slightly different structure |
| `users.tsx:220-228`       | 200ms | Different cleanup timing (0ms timeout)             |
| `settings.tsx:130-138`    | 200ms | Full-page skeleton with cards                      |
| `audit.tsx:133-141`       | 200ms | Standard pattern                                   |
| `accounts.tsx:115-124`    | 200ms | Standard pattern                                   |
| `reference.tsx:617-626`   | 200ms | Standard pattern                                   |
| `assumptions.tsx:186-196` | 200ms | ESLint suppress comment present                    |

**Recommendation**: Create a reusable `useDelayedSkeleton` hook to eliminate duplication.

```tsx
// Proposed hook: apps/web/src/hooks/use-delayed-skeleton.ts
export function useDelayedSkeleton(isLoading: boolean, delay = 200) {
    const [showSkeleton, setShowSkeleton] = useState(false);

    useEffect(() => {
        if (!isLoading) {
            setShowSkeleton(false);
            return;
        }
        const t = setTimeout(() => setShowSkeleton(true), delay);
        return () => clearTimeout(t);
    }, [isLoading, delay]);

    return showSkeleton;
}
```

---

### 5. Button & Action Patterns

#### 🟡 High: Primary Button Variant Inconsistency

| File                 | Primary Action Button            |
| -------------------- | -------------------------------- |
| `versions.tsx:352`   | `variant="primary"` ✅           |
| `fiscal-periods.tsx` | No primary action (Select only)  |
| `users.tsx:234`      | No variant (defaults to primary) |
| `settings.tsx:174`   | No variant (defaults to primary) |
| `accounts.tsx:367`   | No variant (defaults to primary) |
| `reference.tsx:682`  | No variant (defaults to primary) |

**Fix**: Explicitly add `variant="primary"` to all primary action buttons for clarity.

#### 🟢 Medium: Button Content Format

| File                | Add Button Pattern |
| ------------------- | ------------------ |
| `versions.tsx:353`  | `+ New Version`    |
| `users.tsx:242`     | `+ Add User`       |
| `settings.tsx`      | N/A (Save Changes) |
| `accounts.tsx:374`  | `+ Add Account`    |
| `reference.tsx:683` | `+ Add New`        |
| `academic.tsx:220`  | `+ Add New`        |

**Recommendation**: Standardize on either `+ Add [Entity]` or `+ New [Entity]` across all pages.

---

### 6. Color Token Usage

#### 🟢 Medium: Status Badge Color Variations

| File                       | Status Badge Implementation        |
| -------------------------- | ---------------------------------- |
| `versions.tsx:50-55`       | Direct token mapping with CSS vars |
| `fiscal-periods.tsx:43-46` | Uses `color-mix()` function        |
| `accounts.tsx:50-60`       | Direct token mapping               |

**Note**: The `color-mix()` usage in fiscal-periods creates visually different badges. Standardize on one approach.

---

### 7. Planning Pages (Workspace Pattern)

#### 🟢 Medium: Planning Pages Consistency Check

| Page             | WorkspaceBoard | PageTransition | KPI Ribbon | Status Alerts |
| ---------------- | -------------- | -------------- | ---------- | ------------- |
| `enrollment.tsx` | ✅             | ✅             | ✅         | N/A           |
| `revenue.tsx`    | ✅             | ❌ Missing     | ✅         | ✅            |
| `staffing.tsx`   | ✅             | ✅             | ✅         | ✅            |
| `dashboard.tsx`  | ❌ N/A         | ✅             | N/A        | N/A           |

**Fix Required**:

```tsx
// revenue.tsx - Wrap in PageTransition
import { PageTransition } from '../../components/shared/page-transition';

<PageTransition>
  <WorkspaceBoard ... />
</PageTransition>
```

---

### 8. Code Organization

#### 🔵 Low: Import Order Inconsistencies

Multiple patterns observed:

- Some files group react hooks together, others intersperse
- Relative import paths vary (`../../` vs `@/` if aliased)
- Type imports not consistently at end

**Recommendation**: Enforce via ESLint with `import/order` rule.

---

## Summary Table

| Category         | Critical | High  | Medium | Low   |
| ---------------- | -------- | ----- | ------ | ----- |
| Layout & Spacing | 0        | 1     | 1      | 0     |
| Typography       | 0        | 1     | 0      | 0     |
| Table Patterns   | 0        | 2     | 1      | 0     |
| Loading States   | 0        | 0     | 1      | 0     |
| Button Patterns  | 0        | 1     | 1      | 0     |
| Color Tokens     | 0        | 0     | 1      | 0     |
| Planning Pages   | 0        | 0     | 1      | 0     |
| Code Quality     | 0        | 0     | 0      | 1     |
| **TOTAL**        | **0**    | **5** | **6**  | **1** |

---

## Recommended Fixes (Prioritized)

### Phase 1: High Priority (User-Visible)

1. **Fix table header backgrounds** (`versions.tsx`, `fiscal-periods.tsx`)
2. **Fix row hover colors** (`versions.tsx`, `fiscal-periods.tsx`)
3. **Standardize heading tokens** (`versions.tsx`, `fiscal-periods.tsx`, `academic.tsx`)
4. **Add explicit button variants** (`users.tsx`, `settings.tsx`, `accounts.tsx`, `reference.tsx`)
5. **Add PageTransition to revenue.tsx**

### Phase 2: Medium Priority (Polish)

1. **Standardize table text sizes**
2. **Create reusable skeleton hook**
3. **Standardize button text patterns**
4. **Unify status badge color approach**

### Phase 3: Low Priority (Code Quality)

1. **Add ESLint import ordering rule**
2. **Document standard patterns in AGENTS.md**

---

## Standard Patterns Reference

### Standard Page Header

```tsx
<div className="flex flex-wrap items-center gap-3 pb-4">
    <h1 className="mr-auto text-(--text-xl) font-semibold">Page Title</h1>
    <Button variant="primary">+ Add Item</Button>
</div>
```

### Standard Table Container

```tsx
<div className="overflow-x-auto rounded-lg border">
    <table role="table" className="w-full text-left text-(--text-sm)">
        <thead className="border-b bg-(--workspace-bg-muted)">{/* headers */}</thead>
        <tbody>
            {/* rows with: hover:bg-(--accent-50) transition-colors duration-(--duration-fast) */}
        </tbody>
    </table>
</div>
```

### Standard Skeleton Hook

```tsx
const showSkeleton = useDelayedSkeleton(isLoading);
```

---

## Appendix: File-by-File Status

| File                 | Status        | Issues                                    |
| -------------------- | ------------- | ----------------------------------------- |
| `login.tsx`          | ✅ Consistent | N/A (standalone auth page)                |
| `versions.tsx`       | 🟡 Needs Fix  | Heading token, table header BG, row hover |
| `fiscal-periods.tsx` | 🟡 Needs Fix  | Heading token, table header BG, row hover |
| `users.tsx`          | 🟡 Needs Fix  | Button variant, table text size           |
| `settings.tsx`       | 🟡 Needs Fix  | Button variant                            |
| `audit.tsx`          | ✅ Consistent | None                                      |
| `academic.tsx`       | 🟡 Needs Fix  | H2 instead of H1                          |
| `accounts.tsx`       | 🟡 Needs Fix  | Button variant                            |
| `reference.tsx`      | 🟡 Needs Fix  | Button variant, table text size syntax    |
| `assumptions.tsx`    | ✅ Consistent | None                                      |
| `enrollment.tsx`     | ✅ Consistent | Workspace pattern correct                 |
| `revenue.tsx`        | 🟡 Needs Fix  | Missing PageTransition                    |
| `staffing.tsx`       | ✅ Consistent | Workspace pattern correct                 |
| `dashboard.tsx`      | ✅ Consistent | Different pattern (cards)                 |
