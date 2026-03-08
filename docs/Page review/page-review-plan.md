# Front-End Page Review Plan

This document outlines the systematic, dependency-ordered plan for reviewing all pages in the BudFin frontend application (`apps/web/src/pages`).

Because downstream pages (like Enrollment and Revenue) fundamentally depend on upstream configurations (like Master Data and Budget Versions), the review proceeds structurally from foundational contexts to end-state calculations.

## Phase 1: Foundations & Administration

These pages form the core system access and system-wide settings. They do not depend on period or version contexts.

- [ ] **1. Authentication**
    - `apps/web/src/pages/login.tsx`
    - _Context_: Entry point. Validate token lifecycle, RBAC initiation, and layout shell loading.
- [ ] **2. Admin - Users**
    - `apps/web/src/pages/admin/users.tsx`
    - _Context_: Role assignments that affect downstream visibility and write access.
- [ ] **3. Admin - Audit**
    - `apps/web/src/pages/admin/audit.tsx`
    - _Context_: Log review mechanisms.
- [ ] **4. Admin - Settings**
    - `apps/web/src/pages/admin/settings.tsx`
    - _Context_: Global application settings.

## Phase 2: Master Data

Core foundational data that informs fiscal periods and version structures.

- [ ] **5. Master Data - Academic**
    - `apps/web/src/pages/master-data/academic.tsx`
    - _Context_: Structure of academic years and grade mappings.
- [ ] **6. Master Data - Accounts**
    - `apps/web/src/pages/master-data/accounts.tsx`
    - _Context_: Chart of accounts.
- [ ] **7. Master Data - Reference**
    - `apps/web/src/pages/master-data/reference.tsx`
    - _Context_: Additional reference datasets needed for reporting.
- [ ] **8. Master Data - Assumptions**
    - `apps/web/src/pages/master-data/assumptions.tsx`
    - _Context_: Global rate and financial assumptions.

## Phase 3: Version & Timeline Management

These set the constraints and boundaries for the actual budget planning operations.
_Note: Verify if `management/` and `versions/` directories have duplicate responsibilities._

- [ ] **9. Fiscal Periods**
    - `apps/web/src/pages/management/fiscal-periods.tsx` (and `versions/fiscal-periods.tsx`)
    - _Context_: Defining the boundaries and metadata of the financial and academic periods.
- [ ] **10. Versions**
    - `apps/web/src/pages/management/versions.tsx` (and `versions/versions.tsx`)
    - _Context_: Creating, managing, and transitioning budget versions (Draft → Published → Locked). This is required before any planning logic can be reviewed.

## Phase 4: Planning & Operations

The core operational pages where users calculate budgets. These rely directly on an active Version and Master Data.

- [ ] **11. Planning - Dashboard**
    - `apps/web/src/pages/planning/dashboard.tsx`
    - _Context_: Overview KPIs and navigation hub for the selected version.
- [ ] **12. Planning - Enrollment**
    - `apps/web/src/pages/planning/enrollment.tsx`
    - _Context_: Baseline operational input. Forecasts for students. Critical dependency for revenue and staffing calculations.
- [ ] **13. Planning - Revenue**
    - `apps/web/src/pages/planning/revenue.tsx`
    - _Context_: Depends completely on `enrollment.tsx` output and fee grids set up in the version to generate fee calculations.

## Phase 5: Utility & Unknown

- [ ] **14. Placeholder Pages**
    - `apps/web/src/pages/placeholder.tsx`
    - _Context_: Any missing features to be identified or stripped.

---

### Review Criteria Checklist (for each page)

For each file, the review should evaluate:

1. **Component Architecture**: Breakdown of monolithic pages into modular components.
2. **State Management**: `zustand` vs `useQuery` usage, caching, and invalidation rules.
3. **Data Fetching**: Loading states, error boundaries, skeleton loaders.
4. **Accessibility (WCAG AA)**: ARIA roles, keyboard navigation.
5. **Types & Zod Validation**: Strict typing based on the Fastify/Zod TS Provider outputs.
6. **Financial Precision**: Make sure `decimal.js` is used exclusively for any visible monetary displays (TC-001).
7. **Responsiveness**: Tailwind v4 Oxide checks.
