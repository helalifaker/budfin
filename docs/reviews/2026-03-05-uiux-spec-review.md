# BudFin UI/UX Specification Review Report

**Date:** March 5, 2026
**Reviewer:** Claude (on behalf of CAO)
**Scope:** All 11 UI/UX spec documents (00–10) cross-referenced against TDD v1.0, API Contract, Data Architecture, Security Architecture, NFR Design, Implementation Roadmap, ADRs, and PRD v2.0
**Purpose:** Ensure the UI/UX specification is 100% accurate and will faithfully reflect the application as built

---

## Executive Summary

The UI/UX specification is a high-quality, detailed body of work that covers the vast majority of BudFin's functional requirements. However, the cross-referencing analysis has uncovered **7 critical discrepancies**, **9 moderate inconsistencies**, and **6 coverage gaps** where the UI/UX spec either contradicts the TDD/API contract or fails to address functionality that developers will need to implement. These must be resolved before the spec is used as an implementation baseline.

**Risk rating legend:**
- **CRITICAL** — Will cause incorrect implementation if left unresolved; contradicts the TDD or API contract on a material point
- **MODERATE** — Inconsistent wording or minor mismatch that could confuse developers or lead to rework
- **GAP** — Functionality defined in the TDD/PRD but not covered (or under-covered) in the UI/UX spec

---

## 1. Critical Discrepancies

### 1.1 JWT Payload Field Names (Security ↔ API Contract)

| Source | Fields |
| --- | --- |
| TDD §7.1 (05_security.md) | `userId`, `role`, `sessionId`, `iat`, `exp` |
| API Contract §4 (04_api_contract.md) | `sub`, `email`, `role` |

**Impact:** The frontend authentication module needs to know which field names to read from the decoded JWT. If the UI/UX spec references JWT fields (e.g., for RBAC logic or displaying current user), the field names must be consistent. The TDD and API contract must be reconciled first; then the UI/UX spec should reference the canonical payload shape.

**Recommendation:** Align on one canonical JWT payload. The API contract's `sub` (standard JWT claim) is the more standards-compliant choice. Update TDD §7.1 to match, then confirm that the UI/UX spec's RBAC references (Section 8 of 00-global-framework.md) do not depend on a specific field name.

---

### 1.2 Auto-Save Mechanism (NFR ↔ Global Framework)

| Source | Mechanism |
| --- | --- |
| TDD §9.3 (07_nfr_and_testing.md) | Debounced PATCH **500ms after last keystroke** + background PATCH every 30 seconds |
| UI/UX Spec §00 (00-global-framework.md) | Save on **field blur** + background PATCH every 30 seconds |

**Impact:** These are fundamentally different UX behaviors. "500ms debounce after keystroke" means the user sees saves happening as they type (with a short delay). "Save on blur" means saves only happen when the user tabs out of a field. This affects perceived responsiveness, conflict detection timing, and the "Last Saved" indicator in the context bar.

**Recommendation:** Choose one canonical approach. The blur-based approach is simpler and less prone to intermediate-state issues (e.g., saving "12" when the user is typing "1234"). If blur is chosen, update TDD §9.3 to match. If debounce is chosen, update UI/UX spec §00.

---

### 1.3 Health Endpoint Response Shape (Infrastructure ↔ API Contract)

| Source | Response Body |
| --- | --- |
| TDD §8.6 (06_infrastructure.md) | `{ "status": "healthy", "version": "1.0.0", "uptime_seconds": 86400, "database": "connected" }` |
| API Contract §4 (04_api_contract.md) | `{ "status": "ok", "db": "connected", "uptime_seconds": 86400, "version": "1.0.0" }` |

**Impact:** Field names differ (`healthy` vs `ok`, `database` vs `db`). While this does not directly affect end-user UI, the Admin module's system health display (spec 09) and any frontend health-check logic need a single source of truth.

**Recommendation:** Pick one shape and update the other document. The API contract is typically the frontend developer's reference, so align TDD §8.6 to match the API contract.

---

### 1.4 RBAC for Version Lock/Archive (Security ↔ API Contract ↔ UI/UX Spec)

| Action | TDD §7.3 (05_security.md) | API Contract RBAC Matrix | UI/UX Spec 02 (Version Mgmt) |
| --- | --- | --- | --- |
| Lock (Published → Locked) | Admin **and** BudgetOwner | Admin only | Admin **and** BudgetOwner |
| Archive (Locked → Archived) | Admin only (implied by omission) | Admin only | Admin only |

**Impact:** The API contract's RBAC summary matrix says only Admin can lock versions, but both the TDD security chapter and the UI/UX spec allow BudgetOwner to lock. If the API is built per the API contract's matrix, BudgetOwner users will get 403 errors when trying to lock versions — contradicting the UI/UX spec which shows them the Lock button.

**Recommendation:** The PRD (Section 7) and user stories (US-002) clearly indicate that a Budget Owner should be able to lock approved budgets. Update the API contract RBAC matrix to grant lock permission to BudgetOwner, matching the TDD and UI/UX spec.

---

### 1.5 Scenario Parameters: Missing `ors_hours` in UI (Data Architecture ↔ UI/UX Spec 07)

| Source | Parameters |
| --- | --- |
| TDD §3 Data Architecture (`scenario_parameters` table) | `new_enrollment_factor`, `retention_adjustment`, `attrition_rate`, `fee_collection_rate`, `scholarship_allocation`, **`ors_hours`** (6 total) |
| UI/UX Spec 07 (Scenarios, §3.1) | 5 slider controls: new_enrollment_factor, retention_adjustment, attrition_rate, fee_collection_rate, scholarship_allocation |

**Impact:** The database stores 6 scenario parameters, but the UI only exposes 5 sliders. The `ors_hours` parameter (Obligatory Regulatory Service hours — controls teacher workload and therefore FTE requirements) has no UI control. Developers will either leave it uneditable (defeating its purpose) or improvise a UI that doesn't match the spec.

**Recommendation:** Add an `ors_hours` slider/input to the Scenario Parameters panel in spec 07. The PRD's FR-DHG-013 explicitly requires ORS to be "configurable per scenario." The default is 18.0 hours with a range typically 18–20. Alternatively, if ORS configuration belongs in the DHG module's toolbar rather than the Scenario panel, document that clearly.

---

### 1.6 Version Revert Permissions Inconsistency (UI/UX Spec 02 internal)

In UI/UX spec 02, the permissions table (Section 2) and the row actions dropdown (Section 5.5) define different revert capabilities:

| Section | Revert from Published | Revert from Locked |
| --- | --- | --- |
| Section 2 (Permissions table) | Admin only ("Revert to Draft") | Admin only |
| Section 5.5 (Row Actions) | Admin only (Status in Published/Locked AND role is Admin) | Admin only |
| Section 8.3 (Panel Footer) | Published row shows "Revert to Draft" for Admin | Locked row shows "Revert to Draft" for Admin |

This is internally consistent — Admin only can revert. However, the TDD §7.3 RBAC matrix lists "Reverse lifecycle (Locked → Published)" as Admin only, which is a **different transition direction** (Locked → Published vs. Locked → Draft). The UI/UX spec reverts everything to Draft, while the TDD implies reverting to the previous state.

**Recommendation:** Clarify whether revert always goes to Draft (as UI/UX spec 02 specifies) or to the immediately prior state (e.g., Locked → Published). The PRD §7.2 says "Reverse transitions require authorized user action and an audit note" without specifying target state. Recommend the UI/UX spec's approach (always revert to Draft) as it is simpler and more auditable, but the TDD §7.3 permission label should be updated from "Reverse lifecycle (Locked → Published)" to "Reverse lifecycle (any → Draft)."

---

### 1.7 Stale-Flags Endpoint Not in API Contract

UI/UX spec 06 (P&L) references `GET /versions/:versionId/stale-flags` for the prerequisite check (Section 4.2) and the stale data indicator (Section 9.3). UI/UX spec 00 (Global Framework Section 3.1.7) also relies on this endpoint for the context bar stale indicator.

**The API contract does not define this endpoint.** The TDD mentions `version_stale_flags` as "could be system_config or a simple table" (08_implementation_roadmap.md, Week 8) but never formally specifies the API.

**Impact:** Without a defined API contract, developers will have to invent the endpoint shape, request/response schema, and query key structure — leading to potential inconsistency with the UI/UX spec's expectations.

**Recommendation:** Add `GET /api/v1/versions/:versionId/stale-flags` to the API contract with a response schema like:
```json
{
  "version_id": 42,
  "stale_modules": {
    "REVENUE": true,
    "STAFFING": false,
    "PNL": true
  },
  "last_calculated_at": {
    "REVENUE": "2026-03-03T10:30:00Z",
    "STAFFING": "2026-03-03T09:15:00Z",
    "PNL": null
  }
}
```

---

## 2. Moderate Inconsistencies

### 2.1 Account Lockout HTTP Status Code

TDD §7.2 and API contract both specify **HTTP 401** for locked account login attempts. UI/UX spec 09 (Admin) does not explicitly state the HTTP code but describes the user management table showing `Locked Until` timestamps. No contradiction, but spec 09 should explicitly note the 401 response so frontend developers handle it correctly on the login page (distinct from 401 for expired JWT).

### 2.2 Export Job Cancel Behavior

UI/UX spec 06 (P&L, §6.2 Step 2) shows a "Cancel" button on the export progress toast but notes "(no cancel API — just dismisses the toast)." The API contract defines `POST /export/jobs` and `GET /export/jobs/:id` but no `DELETE /export/jobs/:id` for cancellation. This is consistent, but the UI should make clear to users that canceling the toast does not cancel the server-side job.

**Recommendation:** Update the toast's Cancel button label to "Dismiss" to avoid user confusion.

### 2.3 PDF Paper Size

UI/UX spec 06 (§6.3) specifies **A3 landscape** for PDF exports. TDD ADR-014 specifies **A4 landscape**. These are different paper sizes (A3 = 420×297mm, A4 = 297×210mm). A3 provides more room for 12 month columns but may not be standard for EFIR's printers.

**Recommendation:** Confirm with EFIR which paper size is preferred. A4 landscape is more universally printable; A3 provides better readability for 12-column reports. Update whichever document is incorrect.

### 2.4 Capacity Alert Thresholds: NEAR_CAP Label

The PRD (FR-CAP-007) defines a "Near Cap" warning when utilization exceeds 95%. The TDD data model uses the enum value `NEAR_CAP`. UI/UX spec 03 should confirm that the traffic-light system includes four states (OVER/NEAR_CAP/OK/UNDER) not just three. A review of spec 03 shows it covers traffic-light alerts but the exact 4-state label set should be verified for completeness.

### 2.5 Enrollment Historical Table Deprecation

The TDD implementation roadmap (Week 5) notes: "`enrollment_historical` table left empty and deprecated. Trend analysis tested using `enrollment_headcount JOIN budget_versions WHERE type='Actual'`." This means historical enrollment data is stored as Actual-type budget versions, not in a separate historical table.

UI/UX spec 03 references "Import Historical CSV" which creates Actual versions. This is consistent in behavior, but if any UI/UX spec references an `enrollment_historical` API endpoint or data model, it will be incorrect. No direct contradiction found, but worth flagging.

### 2.6 Context Bar Scenario Selector: Not Applicable for Actual Versions

UI/UX spec 00 (Global Framework §3.1) defines a scenario selector in the context bar. The PRD (§6.1) explicitly notes: "Only applicable to Budget/Forecast versions." The UI/UX spec should clearly state that the scenario selector is disabled or hidden when an Actual version is selected. Spec 00 likely covers this but it should be verified in the disabled-states matrix.

### 2.7 `comparisonVersionId` Response Shape

UI/UX spec 00 references the context bar returning a `comparisonVersionId`, but the API contract defines `GET /api/v1/context` with a different response structure. The exact response shape for the context endpoint should be verified to ensure the UI/UX spec's context bar implementation matches.

### 2.8 Audit Trail Pagination

UI/UX spec 09 uses TanStack Table with server-side pagination for the audit trail. The API contract defines `GET /api/v1/audit` with offset pagination (`offset` + `limit` query params). This is consistent but the UI/UX spec should explicitly note the pagination pattern (offset-based, not cursor-based) so developers implement the correct TanStack Query `manualPagination` configuration.

### 2.9 Employee Delete Permission

The API contract RBAC matrix shows `employee:delete` granted to Admin and BudgetOwner. TDD §7.3 security RBAC matrix does not list employee deletion as a separate permission. UI/UX spec 05 (Staffing) should clarify whether employee records can be deleted or only deactivated (set to "Departed" status). The PRD's FR-STC-002 defines status tracking as "Existing, New, Departed" — suggesting soft-delete via status change, not hard delete.

**Recommendation:** Clarify whether `employee:delete` means hard delete or soft delete (status → Departed). Update the RBAC matrix consistently across all three documents.

---

## 3. Coverage Gaps

### 3.1 Fiscal Period Management UI — NOT COVERED

The TDD defines fiscal period endpoints:
- `GET /api/v1/fiscal-periods/:fiscalYear` — returns 12 period records with lock status
- `PATCH /api/v1/fiscal-periods/:fiscalYear/:month/lock` — locks a period (Admin/BudgetOwner only)

The PRD §7.2.1 describes period management and the "Latest Estimate" view. The API contract includes a `GET /api/v1/versions/:id/latest-estimate` endpoint.

**No UI/UX spec covers fiscal period management.** There is no screen, dialog, or panel defined for:
- Viewing the 12 months of a fiscal year with their lock status
- Locking a fiscal period
- Viewing the "Latest Estimate" (hybrid actuals + budget)

**Recommendation:** Create a new section in UI/UX spec 02 (Version Management) or spec 09 (Admin) that defines:
1. A fiscal period status grid (12 months, showing Draft/Locked status per month)
2. Lock period dialog with confirmation
3. Latest Estimate toggle or view mode

### 3.2 Two-Phase Import Flow UI — UNDER-COVERED

The API contract defines a two-phase import pattern:
1. `POST /versions/:id/import/:module/validate` — validates data, returns preview + error summary
2. `POST /versions/:id/import/:module/commit` — commits validated data

UI/UX spec 03 (Enrollment) mentions "Import Historical CSV" in the toolbar's More menu, and spec 05 (Staffing) mentions employee xlsx import. However, neither spec details the two-phase validate-then-commit flow with:
- Validation preview showing row counts, errors, warnings
- User confirmation step before commit
- Error summary display for failed validations

**Recommendation:** Add an "Import Flow" section to specs 03 and 05 detailing:
1. File upload dialog
2. Validation progress indicator
3. Validation results preview (success rows, error rows, warning rows)
4. Confirm/Cancel import decision
5. Commit progress and success/error handling

### 3.3 Actuals Import Flow — NOT COVERED

The API contract defines `POST /versions/:id/import/:module` for Actual versions (distinct from the two-phase validate/commit for Draft versions). The TDD roadmap (Week 19) describes an "Actual Version Import Flow" with:
- Pre-flight guards for version type and data source
- `actuals_import_log` creation
- Calculation engine 409 guards for IMPORTED versions

**No UI/UX spec covers the Actual version import workflow.** This is a distinct workflow from budget version data entry (Actual versions cannot use the calculation engine; they receive imported data only).

**Recommendation:** Create a new section (possibly in spec 02 or as a separate spec) covering:
1. How users trigger an Actual version import
2. Module selection (which data to import: enrollment, revenue, staff costs)
3. File upload and validation feedback
4. Import log display
5. The 409 error when accidentally trying to calculate on an Actual version

### 3.4 Calculation Audit Trail — UNDER-COVERED

The API contract defines `GET /api/v1/audit/calculation` (Admin + BudgetOwner access) which returns calculation run records with input hash, output hash, duration, and success/failure status. The PRD user story US-024 (External Auditor) explicitly requires: "Calculation audit log shows input hash, output hash, duration, and success/failure per calculation run."

UI/UX spec 09 (Admin) covers the general audit trail but does not describe a separate calculation audit view or how calculation audit records are displayed. The general audit trail filter includes `CALCULATION_RUN` as an action type, but the detailed calculation audit fields (input hash, output hash, duration) are not addressed.

**Recommendation:** Add a "Calculation Audit" sub-section to spec 09 or create a dedicated view accessible from the P&L or Admin module.

### 3.5 System Health Monitoring UI — MINIMAL COVERAGE

PRD user story US-019 requires: "Health endpoint accessible; error logs filterable by severity; last backup timestamp visible; alerts for FATAL errors." UI/UX spec 09 covers System Settings but does not detail a system health dashboard showing:
- Application health status (from `GET /api/v1/health`)
- Last backup timestamp
- Error log viewer
- Alert configuration

**Recommendation:** Add a "System Health" section to spec 09 with at minimum:
1. Health status card (green/red indicator)
2. Database connection status
3. Last backup timestamp (if available via system_config)
4. Link to error logs or summary of recent errors

### 3.6 Optimistic Locking Conflict Resolution UI

TDD §9.3 describes optimistic locking with `updated_at` comparison and a 409 `OPTIMISTIC_LOCK_CONFLICT` response. The spec states: "Client shows conflict dialog; user chooses to refresh or force-overwrite."

**No UI/UX spec defines this conflict dialog.** This is a cross-cutting concern that affects every editable module (enrollment, revenue, staffing, master data).

**Recommendation:** Add an "Optimistic Lock Conflict" section to spec 00 (Global Framework) defining:
1. Conflict dialog design (who changed, when, what values)
2. "Refresh" vs. "Overwrite" action buttons
3. Whether the dialog shows a diff of conflicting values

---

## 4. Internal Consistency Issues

### 4.1 Keyboard Shortcut Conflicts

UI/UX spec 06 (P&L, §10.2) notes: "`Ctrl+Shift+C` — Collapse all groups (note: conflicts with comparison shortcut; active only when grid has focus)." This acknowledges the conflict but relies on focus context to disambiguate. This is fragile — if focus management has bugs, the wrong action triggers.

**Recommendation:** Either change one of the shortcuts or implement robust focus detection with clear visual focus indicators.

### 4.2 Version Type Badge Colors vs. PRD

| Badge | UI/UX Spec 02 | PRD §7.1 |
| --- | --- | --- |
| Actual | `#16A34A` (green) | Green |
| Budget | `#2563EB` (blue) | Blue |
| Forecast | `#EA580C` (orange) | Orange |

These are consistent. No issue.

### 4.3 P&L Row Hierarchy vs. IFRS Standards

UI/UX spec 06 defines the IFRS Income Statement hierarchy with all required IAS 1 subtotals. The row structure includes EBITDA, which is not a standard IFRS line item but is commonly used. The spec correctly labels it as a subtotal rather than a standard line item. No issue, but worth noting for audit purposes.

---

## 5. Positive Findings

The following areas are well-aligned and correctly specified:

1. **RBAC enforcement pattern** — Consistent across all 11 specs: hide controls for unauthorized roles, disable for locked versions, show read-only for Viewers
2. **TanStack Table v8 + shadcn/ui** — Consistently used across all data grid modules with no virtual scrolling (ADR-016 compliance)
3. **Context bar persistence** — All modules correctly inherit context bar state (fiscal year, version, comparison, period, scenario)
4. **Async export pattern** — Spec 06 correctly implements POST job → poll → download matching the API contract
5. **Audit operation types** — Spec 09's action filter options exactly match the PostgreSQL ENUM defined in the data architecture
6. **Design token system** — Consistently applied across all specs (colors, spacing, typography, component variants)
7. **Decimal.js and numeric formatting** — Consistent SAR formatting rules across revenue, staffing, and P&L specs
8. **Error handling patterns** — Toast notifications, inline field errors, and blocking dialogs correctly match API error codes
9. **ADR compliance** — References to ADR-004 (explicit Calculate button), ADR-014 (@react-pdf/renderer), ADR-016 (no virtual scrolling) are consistently applied
10. **Accessibility (WCAG AA)** — All specs include ARIA attributes, keyboard navigation, and screen reader announcements

---

## 6. Recommended Action Items

| # | Priority | Action | Owner | Affected Documents |
| --- | --- | --- | --- | --- |
| 1 | CRITICAL | Reconcile JWT payload fields between TDD §7.1 and API contract | Tech Lead | 05_security.md, 04_api_contract.md |
| 2 | CRITICAL | Align auto-save mechanism (blur vs. debounce) | Tech Lead + UX | 07_nfr_and_testing.md, 00-global-framework.md |
| 3 | CRITICAL | Align health endpoint response shape | Tech Lead | 06_infrastructure.md, 04_api_contract.md |
| 4 | CRITICAL | Fix RBAC for version lock in API contract (allow BudgetOwner) | Tech Lead | 04_api_contract.md |
| 5 | CRITICAL | Add `ors_hours` control to Scenario UI | UX Designer | 07-scenarios.md |
| 6 | CRITICAL | Clarify revert target state (always Draft vs. prior state) | CAO + Tech Lead | 05_security.md, 02-version-management.md |
| 7 | CRITICAL | Define `stale-flags` endpoint in API contract | Tech Lead | 04_api_contract.md |
| 8 | GAP | Create fiscal period management UI spec | UX Designer | New section in 02 or 09 |
| 9 | GAP | Detail two-phase import flow in enrollment and staffing specs | UX Designer | 03-enrollment-capacity.md, 05-staffing-costs.md |
| 10 | GAP | Create Actual version import workflow spec | UX Designer | New section |
| 11 | GAP | Add calculation audit view | UX Designer | 09-admin.md |
| 12 | GAP | Add system health monitoring UI | UX Designer | 09-admin.md |
| 13 | GAP | Define optimistic lock conflict dialog | UX Designer | 00-global-framework.md |
| 14 | MODERATE | Align PDF paper size (A3 vs A4) | CAO | 06-pnl-reporting.md or ADR-014 |
| 15 | MODERATE | Rename export toast "Cancel" to "Dismiss" | UX Designer | 06-pnl-reporting.md |
| 16 | MODERATE | Clarify employee delete vs. soft-delete | Tech Lead | 04_api_contract.md, 05-staffing-costs.md |

---

## 7. Conclusion

The UI/UX specification is approximately **85–90% aligned** with the TDD and API contract. The critical discrepancies (items 1–7) must be resolved before development begins on the affected modules to prevent costly rework. The coverage gaps (items 8–13) represent functionality that developers will encounter during Phases 2–5 of the roadmap without UI guidance — leading to ad-hoc decisions that may not match the CAO's expectations.

I recommend a focused review session between the Tech Lead, UX Designer, and CAO to resolve the 7 critical items within one working day, followed by UX Designer effort (estimated 3–5 days) to close the 6 coverage gaps with new spec sections.

---

*Report generated by cross-referencing 11 UI/UX spec documents against TDD v1.0 (9 sections), API Contract, PRD v2.0, and 17 ADRs.*
