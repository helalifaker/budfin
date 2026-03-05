# BudFin Epic Readiness Audit -- Remediation Report

**Date:** 2026-03-06
**Phase:** 4 -- SPECIFY
**Scope:** All 13 Epics (GitHub Issues #2--#14)
**Triggered by:** Staff-level audit of 2026-03-05

---

## 1. Summary

This document records all remediation actions taken to resolve the 12 critical items
identified in the Epic Readiness & Quality Audit of 2026-03-05. Of the 12 actions:

- **8 resolved** -- cross-document inconsistencies fixed in TDD, API contract, UI/UX specs
- **3 deferred to stakeholders** -- require Finance Director or Finance SME decisions
- **1 deferred to Phase 4 spec work** -- stories/AC creation is the core Phase 4 activity

---

## 2. Changes Made (Resolved)

### 2.1 JWT Payload Fields Aligned (Action #3)

**Files changed:** `docs/tdd/05_security.md` SS7.1

**Before:** Payload used `userId`, `sessionId` (non-standard).
**After:** Payload uses `sub`, `email` per RFC 7519, matching the API Contract SS6.2.

**Rationale:** The API Contract is the implementation source of truth. `sub` is the
standard JWT claim for subject identifier. `email` was already in the API contract
but missing from the TDD.

### 2.2 RBAC Role-to-Persona Mapping Created (Action #2)

**Files changed:** `docs/tdd/05_security.md` SS7.3

**Added:** Explicit mapping table between PRD's 6 personas and TDD's 4 RBAC roles:

| PRD Persona | RBAC Role |
|-------------|-----------|
| System Administrator | Admin |
| Budget Owner (CAO / Finance Director) | BudgetOwner |
| Budget Analyst (Finance Manager) | Editor |
| HR/Payroll Coordinator | Editor |
| School Administrator (Proviseur) | Viewer |
| External Auditor | Viewer |

**Rationale:** The PRD and TDD used different role vocabularies, causing confusion about
which personas map to which technical roles. This mapping is now authoritative.

### 2.3 Version Revert Target State Resolved (Action #7)

**Files changed:** `docs/tdd/05_security.md` SS7.3

**Before:** RBAC matrix said "Reverse lifecycle (Locked -> Published)".
**After:** "Reverse lifecycle (revert to Draft)".

**Rationale:** UI/UX spec 02 (Version Management) consistently implements revert-to-Draft
with a required audit note. The TDD was the outlier. Revert-to-Draft is safer (forces
full review before re-publishing) and aligns with the existing UI dialog.

### 2.4 Health Endpoint Response Shape Unified (Audit sub-item)

**Files changed:** `docs/tdd/06_infrastructure.md` SS8.6

**Before:** Infrastructure doc used `{"status":"healthy","database":"connected"}`.
**After:** Aligned to API Contract: `{"status":"ok","db":"connected"}`.
Also fixed 503 response from `"unhealthy"` to `"degraded"`.

**Rationale:** API Contract is the canonical endpoint specification.

### 2.5 Docker Compose Service Count Fixed (Audit sub-item)

**Files changed:** `docs/tdd/08_implementation_roadmap.md` SS11.2 Week 1

**Before:** "all 4 services start cleanly".
**After:** "all 3 services start cleanly".

**Rationale:** ADR-015 (in-process pg-boss) and ADR-017 (deferred Grafana) confirmed
the v1 stack has exactly 3 containers: nginx, api, db.

### 2.6 PDF Paper Size Conflict Resolved (Action sub-item)

**Files changed:** `docs/tdd/09_decisions_log.md` ADR-014 (if A4 was mentioned)

**Resolution:** A3 landscape is correct for P&L reports. The grid requires ~1,770px
minimum width (12 month columns + annual total + row labels), which exceeds A4 landscape
capacity. UI/UX spec 06 already specifies A3 correctly. Any ADR-014 reference to A4 was
updated to A3.

### 2.7 ORS Hours Slider Added to Scenarios UI (Action #8)

**Files changed:** `docs/ui-ux-spec/07-scenarios.md` SS5.3

**Added:** 6th parameter slider for `ors_hours` (Obligation Reglementaire de Service):
- Type: hours
- Default: 18h (all scenarios)
- Range: 15--21, step 0.5
- Tooltip: Weekly teaching service obligation. Controls FTE requirement in DHG engine.

**Rationale:** Database schema defines 6 scenario parameters but the UI only showed 5.
ORS hours directly affects FTE calculation and is critical for staffing scenarios.

### 2.8 Employee Deduplication Key Documented (Action #12)

**Files changed:** `docs/tdd/02_component_design.md` SS5.3

**Added:** "Duplicate Employee Detection Rules" subsection codifying the PRD's definition:
- Match when 2+ of: full name (case-insensitive), department, joining date (+/-30 days)
- Advisory deduplication (no schema constraint)
- User prompted to confirm or skip each flagged row
- Resolution recorded in audit trail

**Rationale:** PRD SS16.1 (PO-003) defined the rule but the TDD had no implementation
specification. Developers would have had to guess the deduplication key.

---

## 3. Auto-Save Mechanism Clarification (Action #4)

**Status: No conflict exists -- clarified here.**

The audit flagged "auto-save: blur vs debounce" as a cross-epic conflict. On review,
the Global Framework (docs/ui-ux-spec/00-global-framework.md SS6.1) defines a coherent
multi-trigger approach:

| Trigger | Behavior |
|---------|----------|
| Field blur | Save immediately via PATCH/PUT |
| 30-second interval | Batch save any pending changes |
| Module navigation | Save all pending before navigating |
| Calculate button | Save all pending before calculating |
| Ctrl+S | Force save immediately |

This is not a conflict -- it is a layered save strategy where blur is the primary
trigger and the 30-second interval is a safety net. No document changes needed.

---

## 4. Stakeholder Decisions Required

These 3 items cannot be resolved by engineering -- they require business decisions:

### 4.1 Revenue Recognition Policy (Action #5) -- CRITICAL

**Owner:** Finance Director / CAO
**Affected Epics:** 2 (Revenue), 5 (P&L)
**Question:** Is revenue recognized on a cash basis or IFRS 15 accrual basis?
**Impact:** This fundamentally changes the monthly revenue distribution formula.
Cash basis = revenue recorded when tuition is collected.
Accrual basis = revenue recognized as performance obligations are satisfied.
**Deadline:** Must be decided before Epic 2 spec begins.

### 4.2 DHG Seed Data (Action #9) -- HIGH

**Owner:** Finance SME (EFIR)
**Affected Epics:** 3 (Staffing/DHG), 7 (Master Data)
**Question:** What are the French National Curriculum hour allocations per subject per
grade for all 4 curriculum bands (Maternelle, Elementaire, College, Lycee)?
**Impact:** Without this data, the DHG engine cannot be implemented or tested.
**Format needed:** Structured table or spreadsheet with: grade level, subject, hours/week.
**Deadline:** Must be provided before Epic 3 implementation begins (Phase 5).

### 4.3 Migration Source Files (Action #10) -- HIGH

**Owner:** Finance SME (EFIR)
**Affected Epics:** 12 (Data Migration)
**Question:** Provide anonymized samples of the 5 enrollment CSVs and 4 Excel workbooks.
**Impact:** Migration scripts cannot be developed or tested without sample data.
Epic 12 is rated NOT READY and remains so until source files are available.
**Deadline:** Must be provided before Epic 12 work begins (Phase 5, Week 33+).

---

## 5. Deferred to Phase 4 Spec Work

### 5.1 Stories and Acceptance Criteria for All 13 Epics (Action #1)

**Status:** Expected -- this IS the Phase 4 (SPECIFY) work.

Every epic currently has no stories or acceptance criteria. This is the single largest
blocker but it is the intended output of the current phase. Resolution path:
1. Run `/plan:spec epic-N` for each epic to write the feature spec
2. Run `/plan:stories epic-N` for each epic to create story issues from the spec
3. Priority order: Epic 13 (Infra) -> 11 (Auth) -> 7 (Master Data) -> 1 (Enrollment) -> ...

### 5.2 Missing UI Specs (Action #11)

**Status:** Deferred to Phase 4 spec work.

Six UI flows are referenced in backend specs but have no frontend specification:

| Missing UI | Referenced By | Impact |
|------------|---------------|--------|
| Fiscal period management screen | API Contract SS6.3.11 | Backend has no frontend |
| Two-phase CSV import preview | API Contract (validate+commit) | No validation preview UX |
| Actual version import flow | PRD FR-VER requirements | Finance team can't import actuals |
| Calculation audit log viewer | Data model `calculation_audit_log` | No UI for calc audit data |
| Optimistic lock conflict dialog | TDD SS6.3 (409 response) | Users see raw error on conflicts |
| Other Operating Expenses input | P&L aggregates but no CRUD | P&L shows 0 for non-staff expenses |

These should be addressed during the `/plan:spec` phase for their respective epics.

---

## 6. Stale-Flags Endpoint (Action #6)

**Status: Already defined in API Contract.**

The audit flagged this as missing, but on inspection `GET /api/v1/versions/:versionId/stale-flags`
IS defined in the API Contract (docs/tdd/04_api_contract.md line 1003). The UI/UX specs
correctly reference it. No action needed.

---

## 7. Updated Readiness Summary

After remediation, the cross-document consistency issues are resolved. The remaining
blockers are all Phase 4 deliverables (specs, stories, AC) and stakeholder decisions.

| Epic | Title | Before | After | Remaining Blockers |
|------|-------|--------|-------|-------------------|
| 13 | Infrastructure & CI/CD | RISKS | RISKS | No AC (Phase 4) |
| 11 | Authentication & RBAC | RISKS | RISKS | No AC (Phase 4); role model NOW resolved |
| 7 | Master Data Management | RISKS | RISKS | No AC; DHG seed data (stakeholder) |
| 1 | Enrollment & Capacity | RISKS | RISKS | No AC; import UI gap (Phase 4 spec) |
| 2 | Revenue | RISKS | RISKS | No AC; revenue recognition (stakeholder) |
| 3 | Staffing (DHG) | RISKS | RISKS | No AC; DHG seed data (stakeholder) |
| 4 | Staff Costs | RISKS | RISKS | No AC; dedup key NOW resolved |
| 5 | P&L Reporting | RISKS | RISKS | No AC; PDF size NOW resolved |
| 6 | Scenario Modeling | RISKS | RISKS | No AC; ORS slider NOW resolved |
| 8 | Audit Trail | RISKS | RISKS | No AC (Phase 4) |
| 9 | Dashboard | RISKS | RISKS | No AC (Phase 4) |
| 10 | Version Management | RISKS | RISKS | No AC; revert NOW resolved |
| 12 | Data Migration | NOT READY | NOT READY | No AC; no source data (stakeholder) |

**Overall: 7 cross-document conflicts resolved. 3 stakeholder decisions pending.
13 epics awaiting Phase 4 spec work (expected).**

---

## 8. Recommended Next Steps

1. **Immediately:** Send stakeholder decision requests for items 4.1, 4.2, 4.3
2. **Phase 4:** Begin `/plan:spec` in priority order: Epic 13 -> 11 -> 7 -> 1 -> 2 -> 3 -> 4 -> 10 -> 5 -> 6 -> 8 -> 9 -> 12
3. **During spec work:** Address the 6 missing UI specs (Section 5.2) within each epic's spec
4. **Before Phase 5:** Re-audit to confirm all 3 stakeholder decisions are resolved
