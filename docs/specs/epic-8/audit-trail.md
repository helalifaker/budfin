# Epic 8 -- Audit Trail

## Context

The core audit infrastructure (AuditEntry model, audit route with filtering and pagination,
and the audit page UI) was built as part of Epic 11 (Auth & RBAC). The CalculationAuditLog
model was added during Epic 1 (Enrollment & Capacity) to track calculation runs across all
modules.

This epic completes the audit trail feature by:

1. Exposing calculation history via a dedicated API endpoint
2. Adding a tabbed UI to the audit page so admins can view both general audit logs and
   calculation run history

## Scope

### Story 1: Calculation History API Endpoint

- `GET /api/v1/audit/calculation` endpoint added to `auditRoutes`
- Query parameters: `page`, `page_size`, `version_id`, `module`, `from`, `to`
- Access: Admin and BudgetOwner roles
- Includes version name/fiscal year and triggerer email via Prisma `include`
- Paginated response matching the existing audit endpoint pattern

### Story 2: Audit Page Calculation History Tab

- shadcn/ui `Tabs` component wraps two tabs: "Audit Log" and "Calculation History"
- Existing audit log content moves into the "Audit Log" tab (no behavior change)
- "Calculation History" tab has:
    - Filters: version selector (populated from `useVersions`), module dropdown
      (ENROLLMENT, REVENUE, STAFFING, OPEX, PNL), date range (from/to)
    - TanStack Table with columns: Timestamp, Module, Status (color-coded badge),
      Duration, Version, Triggered By, Output Summary (truncated JSON)
    - Server-side pagination (default 20 per page)

## Acceptance Criteria

- [x] `GET /api/v1/audit/calculation` returns paginated calculation history
- [x] Filters by version, module, and date range work correctly
- [x] Admin and BudgetOwner can access; Editor and Viewer get 403
- [x] Audit page shows two tabs: "Audit Log" and "Calculation History"
- [x] Status badges use green (COMPLETED), red (FAILED), amber (STARTED)
- [x] `pnpm typecheck`, `pnpm lint`, and `pnpm test` all pass
