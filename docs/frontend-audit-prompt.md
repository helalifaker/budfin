# Frontend Consistency Audit Prompt

## Objective

Perform a comprehensive audit of all frontend pages in `apps/web/src/pages/` to identify inconsistencies in layout, styling, component usage, and user experience patterns. The goal is to establish standardized page layouts while acknowledging that **planning pages** (enrollment, revenue, staffing) are workspace-style interfaces that follow different patterns.

## Page Categories

### 1. Management Pages (`pages/management/`)

- `versions.tsx` - Version management with complex table
- `fiscal-periods.tsx` - Fiscal period locking

### 2. Admin Pages (`pages/admin/`)

- `users.tsx` - User management
- `settings.tsx` - System configuration
- `audit.tsx` - Audit trail

### 3. Master Data Pages (`pages/master-data/`)

- `academic.tsx` - Academic years & grade levels
- `accounts.tsx` - Chart of accounts
- `reference.tsx` - Nationalities, tariffs, departments (tabbed)
- `assumptions.tsx` - System parameters (editable table)

### 4. Planning Pages (`pages/planning/`) - WORKSPACE STYLE

- `dashboard.tsx` - Overview with KPIs and charts
- `enrollment.tsx` - Enrollment & capacity planning
- `revenue.tsx` - Revenue planning
- `staffing.tsx` - Staff costs & DHG

### 5. Auth Pages

- `login.tsx` - Authentication

## Audit Checklist

### A. Layout & Spacing Consistency

- [ ] **Container Padding**: All pages should use consistent padding (`p-6` standard)
- [ ] **Section Spacing**: Consistent gap between sections (`space-y-6` or `space-y-8`)
- [ ] **Max Width Constraints**: Check for inconsistent max-width usage
- [ ] **Content Alignment**: Verify consistent horizontal alignment

### B. Typography Standards

- [ ] **Page Titles**:
    - Standard pages: H1 with `text-(--text-xl) font-semibold`
    - Check for inconsistent font sizes (`text-xl` vs `text-(--text-xl)`)
- [ ] **Section Headers**: H2 with consistent styling
- [ ] **Table Headers**: Consistent font weight and color
- [ ] **Body Text**: Standard text colors (`--text-primary`, `--text-secondary`, `--text-muted`)

### C. Component Usage Patterns

- [ ] **Buttons**:
    - Primary action button styling consistency
    - Icon + text alignment
    - Loading state handling
- [ ] **Tables**:
    - Header background color (`--workspace-bg-muted` vs `--workspace-bg-subtle`)
    - Row hover states (`--accent-50` vs `--workspace-bg-subtle`)
    - Border and rounded styles
    - Empty state patterns
- [ ] **Form Inputs**: Consistent sizing and styling
- [ ] **Select/Dropdown**: Consistent width and trigger styling
- [ ] **Cards/Blocks**: Consistent shadow, border, and background

### D. Color & Theme Consistency

- [ ] **Background Colors**:
    - Page background
    - Card/block backgrounds
    - Table header backgrounds
- [ ] **Text Colors**:
    - Primary, secondary, muted text usage
    - Link colors
- [ ] **Status Colors**:
    - Success, error, warning, info states
    - Badge colors for different statuses
- [ ] **Border Colors**: Consistent border usage

### E. Interactive States

- [ ] **Hover States**: Consistent hover colors across tables and buttons
- [ ] **Focus States**: Consistent focus rings
- [ ] **Active/Selected States**: Consistent selected item styling
- [ ] **Disabled States**: Consistent disabled appearance

### F. Loading & Empty States

- [ ] **Skeleton Loaders**:
    - Consistent delay timing (200ms standard)
    - Consistent row/column counts
    - Same styling across pages
- [ ] **Empty States**:
    - Consistent messaging
    - Consistent icon usage
    - Call-to-action button placement

### G. Toolbar & Action Patterns

- [ ] **Toolbar Layout**:
    - Title placement (left with `mr-auto`)
    - Filter alignment
    - Action button grouping
- [ ] **Filter Components**:
    - Consistent Select widths
    - Search input sizing
    - Filter spacing (`gap-3` standard)
- [ ] **Action Buttons**:
    - Primary action placement
    - Icon usage consistency

### H. Data Table Patterns

- [ ] **Table Container**:
    - `overflow-x-auto` usage
    - `rounded-lg border` consistency
- [ ] **Column Alignment**:
    - Text alignment in cells
    - Number alignment
- [ ] **Action Columns**:
    - Dropdown menu trigger styling
    - Icon sizing
- [ ] **Pagination**:
    - Consistent pagination controls (if applicable)

### I. Side Panel / Dialog Patterns

- [ ] **Side Panels**:
    - Consistent width
    - Consistent animation
    - Close button placement
- [ ] **Dialogs**:
    - Consistent sizing
    - Button placement (Cancel left, Action right)
    - Destructive action styling

### J. Workspace Pages (Planning) Specific

- [ ] **WorkspaceBoard Usage**:
    - Consistent title/description pattern
    - Actions placement
    - KPI ribbon integration
- [ ] **WorkspaceBlock Usage**:
    - Consistent title styling
    - Count badge display
    - Stale indicator placement
- [ ] **PageTransition Wrapper**: Check all planning pages have it

### K. Code Quality

- [ ] **Import Order**:
    - External dependencies first
    - Internal packages (`@budfin/types`)
    - Relative imports
    - Type-only imports last
- [ ] **Type Definitions**: Consistent interface/type usage
- [ ] **Helper Functions**: Consistent placement (top of file vs inline)

## Severity Levels

### 🔴 Critical (Must Fix)

- Functional inconsistencies that affect UX
- Accessibility violations
- Broken responsive behavior

### 🟡 High (Should Fix)

- Visual inconsistencies obvious to users
- Inconsistent interaction patterns
- Missing loading/error states

### 🟢 Medium (Nice to Have)

- Code organization differences
- Minor spacing differences (< 4px)
- Import ordering

### 🔵 Low (Document Only)

- Subjective styling preferences
- Advanced refactoring suggestions

## Report Format

For each inconsistency found, provide:

1. **Location**: File path and line number
2. **Category**: From checklist above
3. **Severity**: Critical/High/Medium/Low
4. **Current State**: What's inconsistent
5. **Expected State**: What it should be
6. **Fix Recommendation**: Specific code change

## Standard Patterns to Enforce

### Standard Page Layout (Non-Planning)

```tsx
<div className="p-6">
    {/* Toolbar */}
    <div className="flex flex-wrap items-center gap-3 pb-4">
        <h1 className="mr-auto text-(--text-xl) font-semibold">Page Title</h1>
        {/* Actions */}
    </div>

    {/* Content */}
</div>
```

### Standard Table Pattern

```tsx
<div className="overflow-x-auto rounded-lg border">
    <table role="table" className="w-full text-left text-(--text-sm)">
        <thead className="border-b bg-(--workspace-bg-muted)">{/* headers */}</thead>
        <tbody>{/* rows with hover:bg-(--accent-50) */}</tbody>
    </table>
</div>
```

### Skeleton Pattern

```tsx
const [showSkeleton, setShowSkeleton] = useState(false);
useEffect(() => {
    if (!isLoading) {
        setShowSkeleton(false);
        return;
    }
    const t = setTimeout(() => setShowSkeleton(true), 200);
    return () => clearTimeout(t);
}, [isLoading]);
```

## Planning Pages Exception Note

Planning pages (enrollment, revenue, staffing, dashboard) use a **workspace pattern** with:

- `WorkspaceBoard` as the main container
- `WorkspaceBlock` for collapsible sections
- `PageTransition` wrapper
- Context bar integration (handled by PlanningShell)

These should maintain their unique layout but still follow consistent:

- Button styling
- Color tokens
- Loading states
- Typography within blocks
