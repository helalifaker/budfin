# BudFin -- Expanded Risk Register and Revised Implementation Timeline

**Document Version:** 2.0
**Date:** March 3, 2026
**Status:** Draft -- PRD v2.0 Integration
**Prepared for:** EFIR Finance Leadership & Development Team
**Baseline Context:** 1,500 students, 168 employees, 40M+ SAR annual revenue, 4 Excel workbooks + 5 CSV files

---

## Table of Contents

1. [Expanded Risk Register](#1-expanded-risk-register)
2. [Risk Heat Map](#2-risk-heat-map)
3. [Risk Review Cadence and Escalation Path](#3-risk-review-cadence-and-escalation-path)
4. [RAID Log](#4-raid-log)
5. [Revised Implementation Timeline](#5-revised-implementation-timeline)
6. [Resource Plan](#6-resource-plan)
7. [MVP / Target / Stretch Tiers](#7-mvp--target--stretch-tiers)
8. [Integrated Testing Strategy](#8-integrated-testing-strategy)
9. [Phase Milestones and Checkpoints](#9-phase-milestones-and-checkpoints)
10. [Phase Dependencies](#10-phase-dependencies)

---

## 1. Expanded Risk Register

### 1.1 Risk Scoring Definitions

**Probability Scale:**

| Rating | Label | Quantified |
|--------|-------|------------|
| 1 | Rare | < 10% chance of occurring |
| 2 | Unlikely | 10-25% chance |
| 3 | Possible | 25-50% chance |
| 4 | Likely | 50-75% chance |
| 5 | Almost Certain | > 75% chance |

**Impact Scale:**

| Rating | Label | Schedule Impact | Financial Impact | Quality Impact |
|--------|-------|-----------------|------------------|----------------|
| 1 | Negligible | < 1 day delay | < 1,000 SAR | Cosmetic defect |
| 2 | Low | 1-3 day delay | 1,000-10,000 SAR | Minor feature gap |
| 3 | Medium | 1-2 week delay | 10,000-50,000 SAR | Feature degradation |
| 4 | High | 2-4 week delay | 50,000-200,000 SAR | Acceptance criteria at risk |
| 5 | Critical | > 4 week delay | > 200,000 SAR | Go-live blocked |

**Risk Score = Probability x Impact.** Scores 15-25: Critical (immediate action). Scores 8-14: High (active mitigation). Scores 4-7: Medium (monitor). Scores 1-3: Low (accept).

---

### 1.2 Full Risk Register (15 Risks)

#### R-001: Calculation Discrepancies Between Excel and Application

| Field | Value |
|-------|-------|
| **ID** | R-001 |
| **Source** | PRD v1.0 Section 15 |
| **Category** | Calculation Engine |
| **Probability** | 4 (Likely) |
| **Impact** | 4 (High) |
| **Risk Score** | 16 (Critical) |
| **Owner** | Tech Lead |
| **Phase Affected** | Phases 2, 3, 4, 6 |

**Description:** Revenue and staff cost calculations in the application diverge from Excel baselines beyond the +/-1 SAR tolerance. With 45+ fee combinations, 168 employees, 12 months, and 50+ calculation chains, compounding rounding differences are expected.

**Mitigation:**
- Implement automated regression test suite comparing application output against Excel baselines for every formula variant (target: 200+ test cases by end of Phase 2).
- Use fixed-point decimal arithmetic (Decimal.js or equivalent) for all financial calculations; round only at user-facing output.
- Store monetary values as scaled integers (fils precision) in the database.
- Run regression tests on every commit via CI pipeline.

**Contingency (if mitigation fails):**
- Engage an independent financial systems auditor to identify root-cause formula divergences.
- Establish a "Calculation Variance Log" with CAO sign-off for each known divergence, classifying as "fix required" or "acceptable deviation."
- Extend Phase 6 by 2 weeks (draw from unallocated buffer) for variance root-cause analysis.

**Trigger:** More than 5% of line items fail the +/-1 SAR tolerance in Phase 2 gate testing.

---

#### R-002: Academic Calendar Edge Cases Not Covered

| Field | Value |
|-------|-------|
| **ID** | R-002 |
| **Source** | PRD v1.0 Section 15 |
| **Category** | Business Logic |
| **Probability** | 3 (Possible) |
| **Impact** | 3 (Medium) |
| **Risk Score** | 9 (High) |
| **Owner** | Tech Lead |
| **Phase Affected** | Phases 2, 3 |

**Description:** The dual academic calendar (AY1: Jan-Jun, AY2: Sep-Dec) creates boundary conditions for revenue distribution, enrollment snapshots, and staff cost allocation that are not fully documented in the ASSUMPTIONS sheet.

**Mitigation:**
- Document all calendar rules from the ASSUMPTIONS sheet in a "Calendar Rules Specification" before Phase 2 starts (Week 4 deliverable).
- Create 15+ test scenarios covering AY1/AY2/summer transitions, fiscal year boundaries, and mid-year enrollment changes.
- CAO validates calendar rules document within 3 business days of delivery.

**Contingency (if mitigation fails):**
- Defer summer-month edge cases to v1.1 and hard-code July-August as zero-revenue/zero-enrollment months for v1.0.

**Trigger:** Calendar-related test failures exceed 3 scenarios during Phase 2 testing.

---

#### R-003: User Resistance to Moving Off Excel

| Field | Value |
|-------|-------|
| **ID** | R-003 |
| **Source** | PRD v1.0 Section 15 |
| **Category** | Adoption |
| **Probability** | 3 (Possible) |
| **Impact** | 4 (High) |
| **Risk Score** | 12 (High) |
| **Owner** | Project Manager |
| **Phase Affected** | Phases 5, 6 |

**Description:** Finance team members resist adopting BudFin due to familiarity with Excel workflows, missing keyboard shortcuts, or perceived loss of flexibility.

**Mitigation:**
- Implement Excel-like keyboard navigation: Tab, Shift+Tab, Enter, Escape, Arrow keys, Ctrl+C/V for multi-cell paste.
- Provide side-by-side parallel run during Phase 6 (app is primary, Excel is read-only audit export).
- Maintain export-to-Excel for all views and reports.
- Conduct 2 hands-on training sessions (1 hour each) during Phase 6 Week 2.

**Contingency (if mitigation fails):**
- Extend parallel-run period by 2 weeks to allow gradual transition.
- Assign a dedicated "champion user" from the finance team for peer support.

**Trigger:** Fewer than 3 of 5 finance team members complete training tasks without escalation.

---

#### R-004: Scope Creep from Additional School Requirements

| Field | Value |
|-------|-------|
| **ID** | R-004 |
| **Source** | PRD v1.0 Section 15 |
| **Category** | Scope Management |
| **Probability** | 4 (Likely) |
| **Impact** | 3 (Medium) |
| **Risk Score** | 12 (High) |
| **Owner** | Project Manager |
| **Phase Affected** | All phases |

**Description:** New requirements emerge during development (multi-school features, additional reporting, custom workflows) that expand scope beyond the PRD v2.0 baseline.

**Mitigation:**
- Strict change control process: all new requirements must pass through a Change Request Board (Project Manager + CAO + Tech Lead).
- Defer multi-school features to v2. Maintain prioritized backlog with MoSCoW classification.
- Enforce 48-hour evaluation period for any new request before accepting into scope.
- Track scope changes in a Change Log with estimated schedule impact.

**Contingency (if mitigation fails):**
- Invoke MVP tier (Section 7) and defer Target/Stretch features to accommodate accepted scope changes.
- Escalate to CAO for scope-vs-timeline trade-off decision.

**Trigger:** Cumulative accepted scope changes exceed 2 weeks of estimated effort.

---

#### R-005: Data Migration Integrity

| Field | Value |
|-------|-------|
| **ID** | R-005 |
| **Source** | PRD v1.0 Section 15 |
| **Category** | Data Migration |
| **Probability** | 3 (Possible) |
| **Impact** | 5 (Critical) |
| **Risk Score** | 15 (Critical) |
| **Owner** | Tech Lead |
| **Phase Affected** | Phase 6 |

**Description:** Migrated data from 4 Excel workbooks and 5 CSV files does not match source data due to encoding issues, schema mismatches, formula errors, or data type discrepancies.

**Mitigation:**
- Automated reconciliation scripts with cell-by-cell comparison for critical calculations.
- Dry-run migration in Phase 5 (Week 24) before formal Phase 6 migration.
- Sign-off checkpoint: CAO validates migrated enrollment counts, total revenue, total staff costs, and P&L totals before UAT begins.
- Pre-migration audit of Excel workbooks for broken references, circular dependencies, and formula complexity.

**Contingency (if mitigation fails):**
- Roll back migration and re-import from corrected Excel files.
- Establish a "Known Migration Issues" log with CAO sign-off for acceptable deviations.
- Extend Phase 6 by 1 week from unallocated buffer.

**Trigger:** More than 10 records fail reconciliation checks during dry-run migration.

---

#### R-006: Timeline Overrun

| Field | Value |
|-------|-------|
| **ID** | R-006 |
| **Source** | DA-005, DA-006, DA-007 |
| **Category** | Project Schedule |
| **Probability** | 5 (Almost Certain) |
| **Impact** | 4 (High) |
| **Risk Score** | 20 (Critical) |
| **Owner** | Project Manager |
| **Phase Affected** | All phases |

**Description:** The original 24-week timeline is underestimated by 25-33%. Complex financial systems consistently overrun by 25-40% due to calculation precision edge cases, regression testing cycles, and UAT discovery. The devil's advocate analysis rates this as "Almost Certain."

**Mitigation:**
- Revised timeline extends to 30 weeks with 4 weeks of phase buffers and 1 week unallocated reserve (see Section 5).
- Define MVP/Target/Stretch tiers (see Section 7) to enable controlled scope reduction if delays compound.
- Weekly schedule health check: compare actual velocity against planned velocity. Flag if cumulative slip exceeds 3 days.
- Integrate testing per phase (not just Phase 6) to catch issues early.

**Contingency (if mitigation fails):**
- At Week 20, if cumulative slip exceeds 2 weeks: invoke MVP tier, defer Target features, present trade-off to CAO.
- At Week 25, if Phase 5 is incomplete: skip Dashboard analytics (Stretch), ship with basic reports only.
- Engage additional developer (contract, 8-week engagement) if Phase 2 or Phase 3 exceeds buffer.

**Trigger:** Any single phase exceeds its allocated duration (including buffer) by more than 3 days.

---

#### R-007: Regulatory Change Mid-Implementation

| Field | Value |
|-------|-------|
| **ID** | R-007 |
| **Source** | DA-002, DA-019 |
| **Category** | Regulatory & Compliance |
| **Probability** | 3 (Possible) |
| **Impact** | 4 (High) |
| **Risk Score** | 12 (High) |
| **Owner** | CAO |
| **Phase Affected** | Phases 3, 6 |

**Description:** PDPL, ZATCA, or Saudi Labor Law changes during the 7.5-month implementation window (March-October 2026). Regulatory changes to GOSI rates, EoS multipliers, Ajeer fees, or Zakat computation rules would invalidate hardcoded assumptions and require recalculation of all affected line items.

**Mitigation:**
- Regulatory assumption freeze date: March 1, 2026. Changes after this date are documented as "out of scope for v1.0; deferred to v1.x" unless they affect go-live acceptance criteria.
- Externalize all statutory rate parameters in a "Regulatory Configuration" table with effective-date tracking. Never hardcode rates.
- CAO monitors ZATCA, Ministry of Human Resources, and Saudi Labor Law updates bi-weekly. Any relevant change is flagged within 48 hours.
- 2-week regulatory buffer included in Phase 6 UAT.

**Contingency (if mitigation fails):**
- If a rate change occurs during Phases 2-5: update the Regulatory Configuration table, re-run regression tests, absorb rework into phase buffer.
- If a rate change occurs during Phase 6: extend UAT by 1 week from unallocated buffer for recalculation and re-validation.
- If the change is structural (new deduction type, new calculation formula): defer to v1.1 with manual workaround documented.

**Trigger:** Any regulatory bulletin from ZATCA, Ministry of HR, or Saudi Labor Ministry that affects GOSI, EoS, Ajeer, or Zakat rates.

---

#### R-008: Key Personnel Dependency

| Field | Value |
|-------|-------|
| **ID** | R-008 |
| **Source** | DA-005 (implied) |
| **Category** | Resource & Organizational |
| **Probability** | 3 (Possible) |
| **Impact** | 4 (High) |
| **Risk Score** | 12 (High) |
| **Owner** | Project Manager |
| **Phase Affected** | All phases |

**Description:** Single-point-of-failure on CAO domain knowledge (only person who fully understands the Excel models) and Tech Lead (only person with full architecture context). Loss of either person for 2+ weeks would stall progress.

**Mitigation:**
- Document all Excel model logic in the "Calculation Specification" document (Phase 1 deliverable) so that domain knowledge is transferable.
- Tech Lead conducts weekly 30-minute knowledge-transfer sessions with Full-Stack Developer #2.
- CAO designates a backup domain expert (Finance Analyst or Budget Coordinator) who attends every other validation session.
- All architectural decisions recorded in a decision log within the project repository.

**Contingency (if mitigation fails):**
- If CAO is unavailable for 2+ weeks: pause validation-dependent tasks, continue with implementation using documented specifications. Queue validation for CAO's return.
- If Tech Lead is unavailable for 2+ weeks: Full-Stack Developer #2 assumes Tech Lead responsibilities for in-progress phase. Escalate to Project Manager to assess schedule impact.

**Trigger:** Any team member with a unique knowledge dependency is unavailable for more than 5 consecutive business days.

---

#### R-009: Technology Stack Risk

| Field | Value |
|-------|-------|
| **ID** | R-009 |
| **Source** | DA-005 (implied) |
| **Category** | Technical Architecture |
| **Probability** | 3 (Possible) |
| **Impact** | 3 (Medium) |
| **Risk Score** | 9 (High) |
| **Owner** | Tech Lead |
| **Phase Affected** | Phase 1 |

**Description:** No technology stack has been chosen. Selecting an inappropriate framework, database, or hosting environment could add 2-4 weeks of rework. Key decisions: frontend framework, backend language, database engine, decimal arithmetic library, and deployment platform.

**Mitigation:**
- Finalize technology stack in Phase 1 Week 1 using a decision matrix evaluating: decimal arithmetic support, Excel export capability, data grid performance, team expertise, and deployment simplicity.
- Require the stack to natively support or have mature libraries for: fixed-point decimal arithmetic, Excel file generation, data grid with keyboard navigation, and row-level audit logging.
- Conduct a 2-day proof-of-concept (Phase 1 Week 1) validating: decimal precision for a sample revenue calculation, data grid performance with 168 rows, and Excel export fidelity.

**Contingency (if mitigation fails):**
- If the chosen stack fails the proof-of-concept: pivot to the runner-up stack from the decision matrix. Absorb 3-day delay into Phase 1 buffer.
- If a critical library (e.g., decimal arithmetic) is abandoned mid-project: identify replacement library and allocate 1 week for migration from phase buffer.

**Trigger:** Proof-of-concept fails to meet any of the 3 validation criteria (decimal precision, grid performance, export fidelity).

---

#### R-010: Source Data Quality

| Field | Value |
|-------|-------|
| **ID** | R-010 |
| **Source** | DA-001 |
| **Category** | Data Quality |
| **Probability** | 4 (Likely) |
| **Impact** | 5 (Critical) |
| **Risk Score** | 20 (Critical) |
| **Owner** | Tech Lead |
| **Phase Affected** | Phases 1, 2, 3, 6 |

**Description:** Excel source files contain known #REF! errors (Executive Summary sheet) and potentially additional broken formulas, circular references, or silent calculation bugs across 39 sheets. Treating corrupted Excel as "source of truth" means replicating errors, not matching reality.

**Mitigation:**
- Conduct a pre-migration audit of all 4 Excel workbooks in Phase 1 Week 2: static analysis for broken references (#REF!, #N/A, #DIV/0!), formula complexity mapping, and precedent/dependent tracing.
- Document all known discrepancies in a "Calculation Variance Log." CAO signs off on which discrepancies to fix vs. preserve-as-is.
- Create an "Excel Baseline Validation Suite" of 15 independently verified test scenarios (hand-calculated, not derived from Excel) for critical calculations.
- Cross-reference Excel outputs against physical payroll records and bank statements for 3 sample months.

**Contingency (if mitigation fails):**
- If the audit reveals more than 10 material errors in the Excel models: halt Phase 2 start, dedicate 1 week to Excel model correction with CAO oversight. Adjust baseline test suite accordingly.
- If errors are discovered during Phase 6 UAT: classify each as "known variance" or "app bug." Fix app bugs; log known variances with CAO sign-off.

**Trigger:** Pre-migration audit identifies more than 5 formula errors affecting financial calculations in the Excel workbooks.

---

#### R-011: IEEE 754 Precision and Rounding Failures

| Field | Value |
|-------|-------|
| **ID** | R-011 |
| **Source** | SA-001, DA-004, DA-010, DA-011 |
| **Category** | Calculation Engine |
| **Probability** | 4 (Likely) |
| **Impact** | 5 (Critical) |
| **Risk Score** | 20 (Critical) |
| **Owner** | Tech Lead |
| **Phase Affected** | Phases 2, 3, 4 |

**Description:** IEEE 754 floating-point arithmetic will cause compounding precision loss across multi-stage calculations: enrollment x net fee / period months, across 1,500 students x 50+ fee combinations x 12 months. Without fixed-point decimal arithmetic, 15-25% of line items will exceed the +/-1 SAR tolerance. Aggregate P&L variance could reach +/-900 SAR.

**Mitigation:**
- Mandate fixed-point decimal arithmetic library (Decimal.js for JavaScript, decimal.Decimal for Python) for all financial calculations. Zero exceptions.
- Store monetary values as scaled integers in the database (e.g., 4,725,000 fils = 47,250.00 SAR).
- Define rounding rules explicitly: ROUND-HALF-UP to 2 decimal places (fils precision) per ISO 4217. Round only at user-facing output; maintain full internal precision.
- Implement automated regression tests: 200+ test cases comparing app vs. Excel for all 45+ fee combinations and all 168 employees.
- Monthly P&L reconciliation alert if variance exceeds +/-2 SAR on any single line.

**Contingency (if mitigation fails):**
- If decimal library introduces performance bottlenecks (recalculation > 5 seconds): profile and optimize hot paths. Consider caching intermediate results.
- If regression tests reveal systematic rounding bias: document the bias direction, implement a correction factor, and re-validate.
- Define layered tolerance: Layer 1 (detail line): +/-1 SAR/month. Layer 2 (subtotal): +/-5 SAR/month. Layer 3 (P&L total): +/-50 SAR/month.

**Trigger:** Phase 2 regression tests show more than 5% of revenue line items outside +/-1 SAR tolerance.

---

#### R-012: YEARFRAC Implementation Divergence

| Field | Value |
|-------|-------|
| **ID** | R-012 |
| **Source** | SA-002, SA-004, DA-008 |
| **Category** | Calculation Engine |
| **Probability** | 3 (Possible) |
| **Impact** | 4 (High) |
| **Risk Score** | 12 (High) |
| **Owner** | Tech Lead |
| **Phase Affected** | Phase 3 |

**Description:** Different platforms implement YEARFRAC differently, especially around leap year boundaries and day-count conventions. For 168 employees, YEARFRAC divergence of 0.001 years = ~10 SAR per employee, totaling +/-1,680 SAR aggregate EoS variance. The PRD specifies YEARFRAC by name but does not define which day-count convention or rounding rule to use.

**Mitigation:**
- Specify exact YEARFRAC implementation: Excel's YEARFRAC(Start, End, Basis=1) using Actual/Actual day-count convention.
- Create a "YEARFRAC Test Suite" with 10 cases: leap year join to leap year end, leap year to non-leap, mid-month joins, Feb 29 handling, and the 5-year tenure boundary.
- For legacy employees with Feb 29 joining dates: document handling as "treat as Feb 28 in non-leap years" (matching Excel behavior).
- Validate EoS provision for all 168 employees against Excel within +/-0.50 SAR per employee (tighter than general +/-1 SAR).

**Contingency (if mitigation fails):**
- If YEARFRAC divergence cannot be resolved within Phase 3 buffer: implement Excel's exact day-counting algorithm (reverse-engineered from Excel source) instead of relying on third-party library.
- If 5+ employees exceed +/-1 SAR: escalate to CAO for case-by-case review and manual EoS override capability.

**Trigger:** More than 3 employees show EoS divergence exceeding +/-1 SAR in Phase 3 gate testing.

---

#### R-013: Concurrent Editing Conflicts

| Field | Value |
|-------|-------|
| **ID** | R-013 |
| **Source** | SA-014, SA-015, DA-013 |
| **Category** | Data Integrity |
| **Probability** | 3 (Possible) |
| **Impact** | 3 (Medium) |
| **Risk Score** | 9 (High) |
| **Owner** | Tech Lead |
| **Phase Affected** | Phases 1, 4 |

**Description:** Multiple users editing the same budget version simultaneously could produce inconsistent data. User A updates AY1 enrollment while User B runs revenue calculations based on stale enrollment data. Auto-save conflicts during user edits could corrupt in-flight changes.

**Mitigation:**
- Implement optimistic locking with version timestamps on all editable entities. Display "Data has been updated by another user" warning on stale reads.
- For critical recalculations (Monthly Revenue, Monthly Staff Costs): implement row-level pessimistic locking during recalculation (< 3 seconds per NFR-11).
- Auto-save mechanism: debounce saves by 2 seconds; resolve conflicts with last-write-wins plus audit trail entry.
- Version locking: only one user can edit a Draft version at a time within a module. Other users see read-only mode with "Currently being edited by [username]" banner.

**Contingency (if mitigation fails):**
- If concurrent editing causes data corruption during UAT: restrict to single-user editing mode for v1.0 (acceptable for 3-5 user team). Implement full multi-user editing in v1.1.

**Trigger:** Any data corruption incident traceable to concurrent editing during Phase 4 or Phase 6 testing.

---

#### R-014: PDPL Non-Compliance

| Field | Value |
|-------|-------|
| **ID** | R-014 |
| **Source** | DA-002 (implied) |
| **Category** | Regulatory & Compliance |
| **Probability** | 2 (Unlikely) |
| **Impact** | 4 (High) |
| **Risk Score** | 8 (High) |
| **Owner** | CAO |
| **Phase Affected** | Phases 1, 3 |

**Description:** Storing 168 employee salary records, personal data, and potentially student data without a PDPL (Personal Data Protection Law) compliance assessment. Saudi Arabia's PDPL enforcement is active as of September 2023. Non-compliance could result in fines or mandatory system changes.

**Mitigation:**
- Conduct a PDPL impact assessment during Phase 1 Week 3: identify all personal data fields stored, processing purposes, retention periods, and access controls.
- Implement role-based access control (RBAC) restricting salary data to CAO and Finance Director roles only.
- Encrypt personal data at rest (AES-256) and in transit (TLS 1.3).
- Add a data retention policy: personal data retained for 7 years (matching Saudi labor record requirements), then anonymized.
- Include PDPL compliance section in the application's privacy documentation.

**Contingency (if mitigation fails):**
- If PDPL assessment reveals gaps that require architectural changes: allocate 1 week from Phase 1 buffer for remediation.
- If enforcement action occurs: engage legal counsel within 48 hours. Apply emergency access restrictions as interim measure.

**Trigger:** PDPL impact assessment identifies more than 3 non-compliant data handling practices.

---

#### R-015: Integration Gap Post-v1

| Field | Value |
|-------|-------|
| **ID** | R-015 |
| **Source** | DA-005 (implied) |
| **Category** | Operational |
| **Probability** | 2 (Unlikely) |
| **Impact** | 3 (Medium) |
| **Risk Score** | 6 (Medium) |
| **Owner** | Project Manager |
| **Phase Affected** | Phase 6, Post-launch |

**Description:** No ERP connector means manual data transfer continues for non-budgeting workflows (payroll, accounts payable, general ledger). Finance team may need to re-enter data in multiple systems, reducing the time savings BudFin provides.

**Mitigation:**
- Ensure comprehensive Excel export covers all views and reports needed for downstream systems.
- Document the manual data transfer workflow and estimated time per cycle.
- Include ERP integration feasibility assessment in the v1.1 roadmap.
- Provide CSV export in a format compatible with the school's existing ERP/accounting system.

**Contingency (if mitigation fails):**
- If manual data transfer takes more than 2 hours per monthly cycle: fast-track ERP API integration as a v1.1 priority.

**Trigger:** Post-launch feedback indicates manual data transfer exceeds 2 hours per monthly close cycle.

---

### 1.3 Risk Register Summary Table

| ID | Risk Title | Prob | Impact | Score | Category | Owner | Phase |
|----|-----------|------|--------|-------|----------|-------|-------|
| R-001 | Calculation Discrepancies (Excel vs. App) | 4 | 4 | 16 | Critical | Tech Lead | 2,3,4,6 |
| R-002 | Academic Calendar Edge Cases | 3 | 3 | 9 | High | Tech Lead | 2,3 |
| R-003 | User Resistance to Moving Off Excel | 3 | 4 | 12 | High | Project Manager | 5,6 |
| R-004 | Scope Creep | 4 | 3 | 12 | High | Project Manager | All |
| R-005 | Data Migration Integrity | 3 | 5 | 15 | Critical | Tech Lead | 6 |
| R-006 | Timeline Overrun | 5 | 4 | 20 | Critical | Project Manager | All |
| R-007 | Regulatory Change Mid-Implementation | 3 | 4 | 12 | High | CAO | 3,6 |
| R-008 | Key Personnel Dependency | 3 | 4 | 12 | High | Project Manager | All |
| R-009 | Technology Stack Risk | 3 | 3 | 9 | High | Tech Lead | 1 |
| R-010 | Source Data Quality | 4 | 5 | 20 | Critical | Tech Lead | 1,2,3,6 |
| R-011 | IEEE 754 Precision / Rounding | 4 | 5 | 20 | Critical | Tech Lead | 2,3,4 |
| R-012 | YEARFRAC Implementation Divergence | 3 | 4 | 12 | High | Tech Lead | 3 |
| R-013 | Concurrent Editing Conflicts | 3 | 3 | 9 | High | Tech Lead | 1,4 |
| R-014 | PDPL Non-Compliance | 2 | 4 | 8 | High | CAO | 1,3 |
| R-015 | Integration Gap Post-v1 | 2 | 3 | 6 | Medium | Project Manager | 6 |

---

## 2. Risk Heat Map

Text-based probability vs. impact matrix. Each cell lists the risk IDs falling in that intersection.

```
                         I M P A C T
               Negligible  Low     Medium    High      Critical
              (1)         (2)      (3)       (4)       (5)
         +------------+--------+---------+---------+----------+
Almost   |            |        |         | R-006   |          |
Certain  |            |        |         |         |          |
(5)      |            |        |         |  [20]   |          |
         +------------+--------+---------+---------+----------+
Likely   |            |        | R-004   | R-001   | R-010    |
         |            |        |         | R-003   | R-011    |
(4)      |            |        |  [12]   |  [16]   |  [20]   |
         +------------+--------+---------+---------+----------+
Possible |            |        | R-002   | R-007   | R-005    |
         |            |        | R-009   | R-008   |          |
(3)      |            |        | R-013   | R-012   |  [15]   |
         |            |        |  [9]    |  [12]   |          |
         +------------+--------+---------+---------+----------+
Unlikely |            |        | R-015   | R-014   |          |
         |            |        |         |         |          |
(2)      |            |        |  [6]    |  [8]    |          |
         +------------+--------+---------+---------+----------+
Rare     |            |        |         |         |          |
         |            |        |         |         |          |
(1)      |            |        |         |         |          |
         +------------+--------+---------+---------+----------+

Legend:
  [Score]  = Probability x Impact
  Critical = Score 15-25 (immediate action required)
  High     = Score 8-14 (active mitigation required)
  Medium   = Score 4-7 (monitor and review)
  Low      = Score 1-3 (accept)
```

**Risk Distribution:**
- Critical (15-25): 5 risks -- R-001, R-005, R-006, R-010, R-011
- High (8-14): 8 risks -- R-002, R-003, R-004, R-007, R-008, R-009, R-012, R-013, R-014
- Medium (4-7): 1 risk -- R-015
- Low (1-3): 0 risks

**Observation:** 5 of 15 risks are Critical. Three of these (R-006 Timeline, R-010 Data Quality, R-011 Precision) share the maximum score of 20. The project's primary risk cluster is in the Calculation Engine and Data Quality categories. The revised timeline and decimal arithmetic mandate are the two highest-leverage mitigations.

---

## 3. Risk Review Cadence and Escalation Path

### 3.1 Review Cadence

| Phase | Cadence | Participants | Duration | Output |
|-------|---------|-------------|----------|--------|
| Phases 1-4 (Development) | Bi-weekly (every 2 weeks) | Tech Lead, Project Manager, CAO (optional) | 30 minutes | Updated risk register, new risks identified, mitigation status |
| Phase 5 (Dashboard) | Bi-weekly | Tech Lead, Project Manager | 30 minutes | Updated risk register, performance test results |
| Phase 6 (Migration & UAT) | Weekly | Tech Lead, Project Manager, CAO, QA Lead | 45 minutes | Updated risk register, UAT findings, migration status |
| Post-launch (first 4 weeks) | Weekly | Project Manager, CAO | 30 minutes | Operational issues, user feedback, remaining risk closure |

**Standing Agenda for Risk Review:**
1. Review open Critical/High risks (5 minutes per risk).
2. Update probability/impact scores based on new information.
3. Review mitigation action status (on-track / at-risk / blocked).
4. Identify new risks from the past sprint/phase.
5. Review trigger conditions -- have any been met?
6. Document decisions and assign action items.

### 3.2 Escalation Path

```
Level 1: Team Level
  Who:    Tech Lead or QA Lead
  Scope:  Technical risks with Score <= 9
  Action: Implement mitigation within current phase buffer
  SLA:    Resolved within 3 business days

    |
    v (if unresolved or Score > 9)

Level 2: Project Manager
  Who:    Project Manager
  Scope:  Schedule, resource, or scope risks with Score 10-14
  Action: Reallocate resources, invoke phase buffer, negotiate scope trade-offs
  SLA:    Decision within 2 business days

    |
    v (if unresolved, requires budget/timeline change, or Score >= 15)

Level 3: CAO (Chief Accounting Officer)
  Who:    CAO
  Scope:  Critical risks (Score >= 15), regulatory risks, financial impact > 50,000 SAR
  Action: Approve timeline extension, approve MVP tier invocation, approve regulatory workarounds
  SLA:    Decision within 2 business days

    |
    v (if unresolved, requires budget increase > 200,000 SAR or timeline extension > 4 weeks)

Level 4: Board / Executive Sponsor
  Who:    Board representative or executive sponsor
  Scope:  Project cancellation risk, budget overrun > 200,000 SAR, go-live delay > 4 weeks
  Action: Approve additional funding, approve revised go-live date, or approve project pause
  SLA:    Decision within 5 business days
```

### 3.3 Risk Escalation Triggers

| Trigger Condition | Escalation Level |
|---|---|
| Any risk score increases to >= 15 | Level 3 (CAO) |
| Phase buffer fully consumed | Level 2 (Project Manager) |
| Unallocated reserve requested | Level 3 (CAO) |
| Regulatory bulletin affecting active calculations | Level 3 (CAO) |
| Key personnel unavailable > 5 business days | Level 2 (Project Manager) |
| Go-live acceptance criteria at risk | Level 3 (CAO) |
| Cumulative schedule slip > 2 weeks beyond buffer | Level 4 (Board) |
| Budget overrun > 100,000 SAR | Level 3 (CAO) |
| Budget overrun > 200,000 SAR | Level 4 (Board) |

---

## 4. RAID Log

### 4.1 Risks

See Section 1 (Expanded Risk Register) for the complete risk register with 15 risks.

### 4.2 Assumptions

| ID | Assumption | Owner | Validation Method | Impact if Wrong |
|----|-----------|-------|-------------------|-----------------|
| A-001 | Regulatory freeze date of March 1, 2026 holds. GOSI (11.75%), Ajeer (SAR 9,500 + SAR 160/month), and EoS (0.5/1 month per year) rates remain unchanged through go-live. | CAO | Bi-weekly monitoring of ZATCA, Ministry of HR bulletins | R-007 triggers; recalculation required for all statutory cost lines |
| A-002 | Excel workbooks are structurally sound except for the known #REF! error on the Executive Summary sheet. No additional material formula errors exist. | Tech Lead | Pre-migration audit (Phase 1 Week 2) | R-010 triggers; Phase 2 start delayed for Excel correction |
| A-003 | The finance team (3-5 users) will be available for validation sessions and UAT. CAO available 0.5 day/week during Phases 1-5 and 2 days/week during Phase 6. | Project Manager | Confirmed in project kickoff meeting | R-008 triggers; validation bottleneck delays phase gates |
| A-004 | Single-school deployment. No multi-tenant, multi-school, or SaaS requirements for v1.0. | Project Manager | PRD v2.0 scope definition | Scope creep (R-004); architecture rework if multi-tenancy needed |
| A-005 | AEFE curriculum grilles for FY2026 are fixed and will not change mid-year. DHG hours are stable for the planning period. | CAO | AEFE directive review at project start | Staffing model recalculation; FTE and cost budget revision |
| A-006 | The technology stack selected in Phase 1 supports fixed-point decimal arithmetic, Excel export, data grid with keyboard navigation, and row-level audit logging. | Tech Lead | Phase 1 proof-of-concept (Week 1) | R-009 triggers; stack pivot adds 1-2 weeks |
| A-007 | Historical enrollment CSVs (2021-2026) are complete, correctly encoded (UTF-8), and contain no duplicate records. | Tech Lead | Data profiling in Phase 1 Week 2 | Migration script rework; enrollment trend analysis inaccurate |
| A-008 | Application will be deployed on-premises or on a private cloud instance within Saudi Arabia to comply with PDPL data residency requirements. | Tech Lead | Infrastructure decision in Phase 1 | R-014 triggers; hosting migration required |
| A-009 | Zakat calculation at 2.5% on monthly positive profit is an acceptable simplification for v1.0. External auditors may require adjustment. | CAO | Auditor consultation before Phase 6 | Manual Zakat adjustment journal entries required post-launch |
| A-010 | The +/-1 SAR tolerance is measured per line item per month, not cumulatively across the P&L. Aggregate P&L tolerance is +/-50 SAR per subtotal per month. | CAO | Acceptance criteria sign-off (Phase 1) | Acceptance testing scope changes; tighter tolerance requires more regression testing |

### 4.3 Issues

| ID | Issue | Status | Owner | Date Raised | Resolution Target | Impact |
|----|-------|--------|-------|-------------|-------------------|--------|
| I-001 | Excel Executive Summary sheet contains #REF! error | Open | Tech Lead | March 3, 2026 | Phase 1 Week 2 (pre-migration audit) | Blocks baseline validation for consolidated P&L |
| I-002 | Technology stack not yet selected | Open | Tech Lead | March 3, 2026 | Phase 1 Week 1 | Blocks all development work |
| I-003 | YEARFRAC day-count convention not specified in PRD | Open | Tech Lead | March 3, 2026 | Phase 1 Week 4 (Calendar Rules Spec) | Blocks EoS calculation implementation in Phase 3 |
| I-004 | Rounding rules (per-month vs. annual total) not defined | Open | Tech Lead | March 3, 2026 | Phase 1 Week 4 (Calculation Spec) | Blocks revenue distribution implementation in Phase 2 |
| I-005 | PDPL compliance assessment not conducted | Open | CAO | March 3, 2026 | Phase 1 Week 3 | Blocks personal data storage design |
| I-006 | MVP/Target/Stretch tier sign-off pending | Open | CAO | March 3, 2026 | Phase 1 Week 1 (project kickoff) | Blocks scope trade-off decisions if delays occur |

### 4.4 Dependencies

| ID | Dependency | Type | Source | Target | Status | Impact if Broken |
|----|-----------|------|--------|--------|--------|-----------------|
| D-001 | Phase 2 depends on Phase 1 database schema and authentication | Technical | Phase 1 | Phase 2 | Pending | Phase 2 start delayed; all downstream phases shift |
| D-002 | Phase 3 depends on Phase 2 enrollment data and fee grid | Technical | Phase 2 | Phase 3 | Pending | Staff cost calculations cannot reference enrollment-driven revenue |
| D-003 | Phase 4 depends on Phase 2 revenue engine and Phase 3 staff cost engine | Technical | Phases 2, 3 | Phase 4 | Pending | Version comparison and P&L consolidation cannot be built |
| D-004 | Phase 5 depends on Phase 4 reporting engine and version management | Technical | Phase 4 | Phase 5 | Pending | Dashboard has no data source for KPIs and analytics |
| D-005 | Phase 6 depends on all prior phases completing within buffer | Schedule | Phases 1-5 | Phase 6 | Pending | UAT cannot validate incomplete features |
| D-006 | CAO availability for validation sessions (0.5 day/week Phases 1-5, 2 days/week Phase 6) | Resource | CAO | All phases | Confirmed | Validation bottleneck; phase gates cannot be passed |
| D-007 | Pre-migration Excel audit must complete before Phase 2 regression test baseline is set | Process | Phase 1 audit | Phase 2 testing | Pending | Regression tests compare against potentially incorrect baselines |
| D-008 | Technology stack decision must precede all implementation | Technical | Phase 1 Week 1 | All development | Pending | No code can be written until stack is selected |
| D-009 | Regulatory Configuration table must be designed before statutory cost implementation | Technical | Phase 1 schema | Phase 3 statutory costs | Pending | Hardcoded rates create R-007 exposure |
| D-010 | Decimal arithmetic library must be validated before financial calculations begin | Technical | Phase 1 PoC | Phases 2, 3 | Pending | R-011 (precision) cannot be mitigated without this |

---

## 5. Revised Implementation Timeline

### 5.1 Timeline Summary

| Phase | Scope | Base Duration | Buffer | Total Duration | Start Week | End Week | Start Date | End Date |
|-------|-------|---------------|--------|----------------|------------|----------|------------|----------|
| Phase 1 | Foundation | 4 weeks | 1 week | 5 weeks | Week 1 | Week 5 | Mar 9, 2026 | Apr 11, 2026 |
| Phase 2 | Enrollment & Revenue | 5 weeks | 1 week | 6 weeks | Week 6 | Week 11 | Apr 13, 2026 | May 22, 2026 |
| Phase 3 | Staffing & Staff Costs | 5 weeks | 1 week | 6 weeks | Week 12 | Week 17 | May 25, 2026 | Jul 3, 2026 |
| Phase 4 | Reporting & Versions | 4 weeks | 1 week | 5 weeks | Week 18 | Week 22 | Jul 6, 2026 | Aug 7, 2026 |
| Phase 5 | Dashboard & Analytics | 3 weeks | 0 weeks | 3 weeks | Week 23 | Week 25 | Aug 10, 2026 | Aug 28, 2026 |
| Phase 6 | Migration & UAT | 4 weeks | 0 weeks | 4 weeks | Week 26 | Week 29 | Aug 31, 2026 | Sep 25, 2026 |
| Reserve | Unallocated contingency | - | 1 week | 1 week | Week 30 | Week 30 | Sep 28, 2026 | Oct 2, 2026 |
| **Total** | | **25 weeks** | **5 weeks** | **30 weeks** | | | **Mar 9, 2026** | **Oct 2, 2026** |

### 5.2 Phase-by-Phase Detail

#### Phase 1: Foundation (Weeks 1-5)

| Week | Activities | Deliverables |
|------|-----------|-------------|
| Week 1 | Technology stack selection, proof-of-concept (decimal precision, grid perf, Excel export), project setup, CI/CD pipeline | Decision matrix document, PoC results, repository initialized |
| Week 2 | Database schema design, pre-migration Excel audit, data profiling of CSV files | Schema ERD, Excel audit report, data profiling summary |
| Week 3 | Authentication implementation, RBAC setup, PDPL impact assessment, context bar shell | Working auth flow, RBAC configuration, PDPL assessment document |
| Week 4 | Master data CRUD (grades, subjects, fee types, nationality codes), Calendar Rules Specification | Master data management UI, calendar rules document (CAO-validated) |
| Week 5 | Buffer. Integration testing, bug fixes, Phase 1 gate review | Phase 1 gate sign-off |

**Phase 1 Gate Criteria:**
- Authentication working with role-based access (CAO, Finance Director, Budget Analyst).
- Context bar functional: persists fiscal year, version, and module state across navigation.
- Master data CRUD complete for all reference entities (grades, subjects, fee types, nationalities).
- Database schema reviewed and approved by Tech Lead.
- Pre-migration Excel audit report delivered and reviewed by CAO.
- Technology stack proof-of-concept passes all 3 validation criteria.

---

#### Phase 2: Enrollment & Revenue (Weeks 6-11)

| Week | Activities | Deliverables |
|------|-----------|-------------|
| Week 6 | Historical enrollment CSV import (5 files, 2021-2026), enrollment data model, trend analysis queries | Imported enrollment data, data validation report |
| Week 7 | Enrollment planning UI (Stage 1: headcount by grade, Stage 2: detail by nationality/tariff), capacity calculation | Enrollment planning screens, capacity alerts |
| Week 8 | Fee grid management (45+ combinations), discount engine (RP, Personnel, Scholarship, Exoneration) | Fee grid CRUD, discount calculation engine |
| Week 9 | Revenue calculation engine: net fee computation, monthly distribution (Academic /10, /12, specific months), VAT handling | Revenue engine with all distribution methods |
| Week 10 | Revenue regression testing against Excel baseline (200+ test cases), reconciliation report | Regression test suite, variance report |
| Week 11 | Buffer. Bug fixes from regression testing, edge case remediation, Phase 2 gate review | Phase 2 gate sign-off |

**Phase 2 Gate Criteria:**
- Revenue engine matches Excel REVENUE_ENGINE output within +/-1 SAR for all 45+ fee combinations across all 12 months.
- Enrollment data imported and validated: total headcount matches CSV source for all 5 years.
- Fee grid supports all tariff types (Reduit, Francais, Etranger, Personnel, Exonere).
- Discount cascade produces correct net fees for all discount types.
- Regression test suite passes with >= 95% of line items within +/-1 SAR tolerance.
- CAO validates 5 representative revenue scenarios (hand-verified).

---

#### Phase 3: Staffing & Staff Costs (Weeks 12-17)

| Week | Activities | Deliverables |
|------|-----------|-------------|
| Week 12 | DHG grilles implementation (Maternelle, Elementaire, College, Lycee), subject hours configuration, FTE calculation | DHG module with FTE output per grade band |
| Week 13 | Employee master data (168 employees), salary components (base, housing, transport, premium), contract types | Employee roster, salary component engine |
| Week 14 | Statutory cost calculations: GOSI (11.75%), Ajeer (SAR 9,500 + SAR 160/month), EoS provision (YEARFRAC-based) | Statutory cost engine with Regulatory Configuration table |
| Week 15 | Monthly staff cost budget grid, HSA seasonal handling, cost allocation by department | Monthly cost budget view, HSA exclusion logic |
| Week 16 | Staff cost regression testing against Excel baseline (168 employees x 12 months), YEARFRAC validation | Regression test suite, EoS variance report |
| Week 17 | Buffer. Bug fixes, EoS edge case remediation, Phase 3 gate review | Phase 3 gate sign-off |

**Phase 3 Gate Criteria:**
- Staff cost engine matches Excel FY2026 Monthly Budget within +/-1 SAR for all 168 employees across all 12 months.
- EoS provision matches for all 168 employees within +/-0.50 SAR (tighter tolerance).
- GOSI, Ajeer calculations match Excel for all applicable employees.
- YEARFRAC test suite passes all 10 cases.
- DHG FTE calculation produces correct staffing for all 4 curriculum grilles.
- CAO validates 5 representative employee scenarios (hand-verified, covering YoS < 5, = 5, > 5, Saudi national, Ajeer contractor).

---

#### Phase 4: Reporting & Versions (Weeks 18-22)

| Week | Activities | Deliverables |
|------|-----------|-------------|
| Week 18 | Version management system: Draft/Published/Locked lifecycle, version creation, audit trail for lock/unlock | Version management UI, lifecycle state machine |
| Week 19 | P&L consolidation: revenue subtotals, cost subtotals, EBITDA, Zakat provision, net income; IFRS mapping | P&L consolidation engine, IFRS Income Statement view |
| Week 20 | Comparison engine: Budget vs. Actual, Budget vs. Forecast, variance calculation at line-item and summary level | Comparison report, variance highlights |
| Week 21 | Scenario modeling: parameter inputs (enrollment factor, retention, attrition), scenario comparison | Scenario UI, optimistic/pessimistic/custom scenarios |
| Week 22 | Buffer. E2E testing for version lifecycle, comparison accuracy, P&L consolidation, Phase 4 gate review | Phase 4 gate sign-off |

**Phase 4 Gate Criteria:**
- Version lifecycle works: Draft -> Published -> Locked. Unlock requires authorized user and creates audit entry.
- Version comparison (Budget vs. Actual) produces correct variance at P&L summary and line-item level.
- P&L consolidation matches the structure and totals of the Excel consolidated budget workbook within +/-50 SAR per subtotal.
- IFRS Income Statement output matches Excel structure.
- Scenario modeling handles zero-enrollment gracefully (clamps to zero, no crashes).
- CAO validates P&L consolidation against Excel for 2 complete months.

---

#### Phase 5: Dashboard & Analytics (Weeks 23-25)

| Week | Activities | Deliverables |
|------|-----------|-------------|
| Week 23 | Executive dashboard: KPI widgets (total revenue, total costs, EBITDA, enrollment, FTE count), trend charts | Dashboard layout with live KPI data |
| Week 24 | Capacity alerts, export functionality (Excel, PDF, CSV), dry-run migration rehearsal | Export engine, migration rehearsal report |
| Week 25 | Performance testing (< 1 second load time), UI polish, Phase 5 gate review | Phase 5 gate sign-off |

**Phase 5 Gate Criteria:**
- All 8 go-live acceptance criteria (Section 16.1) met in staging environment.
- Application load time < 1 second for all modules on standard office network.
- Export to Excel produces valid .xlsx files with correct formatting and data.
- Dashboard KPIs display correct values sourced from the calculation engines.
- Dry-run migration rehearsal completes without blocking errors.
- Performance test results documented: page load times, recalculation times, export times.

---

#### Phase 6: Migration & UAT (Weeks 26-29)

| Week | Activities | Deliverables |
|------|-----------|-------------|
| Week 26 | Production data migration: import 4 Excel workbooks + 5 CSV files, automated reconciliation | Migration log, reconciliation report |
| Week 27 | Parallel-run validation: app as primary system, Excel as read-only audit export. Weekly reconciliation checkpoint. | Parallel-run reconciliation report (Week 1) |
| Week 28 | UAT with finance team: structured test scripts covering all modules, edge cases, and acceptance criteria | UAT findings log, bug triage |
| Week 29 | Bug fixes, final reconciliation, sign-off, go-live preparation, training sessions (2 x 1 hour) | UAT sign-off, go-live checklist, training materials |

**Phase 6 Gate Criteria:**
- Data migration verified: enrollment counts, total revenue, total staff costs, and P&L totals match source Excel within defined tolerances.
- Parallel-run produces matching results for at least 5 consecutive business days.
- UAT sign-off by CAO and Finance Director.
- All Critical and High severity bugs resolved. Medium severity bugs documented with workarounds.
- Training completed for all finance team members (3-5 users).
- Go-live checklist completed: backups, rollback plan, support contacts, monitoring dashboards.

---

#### Reserve (Week 30)

| Week | Activities | Deliverables |
|------|-----------|-------------|
| Week 30 | Unallocated contingency for any phase that consumed its buffer. Also covers: post-go-live stabilization, regulatory changes discovered during UAT, or additional training. | Deployed and operational application |

**Reserve allocation rules:**
- Reserve is drawn only with Level 3 (CAO) approval.
- If reserve is not needed, it becomes the first week of post-launch stabilization.
- Reserve cannot be pre-allocated to any specific phase during planning.

---

### 5.3 Timeline Visualization

```
Week  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30
      |--Phase 1 (Foundation)--|
      [====BUILD====][BUF]
                        |------Phase 2 (Enrollment & Revenue)------|
                        [==========BUILD==========][BUF]
                                                      |------Phase 3 (Staffing & Costs)---------|
                                                      [==========BUILD==========][BUF]
                                                                                    |---Phase 4 (Reporting)---|
                                                                                    [=======BUILD======][BUF]
                                                                                                          |--Ph5--|
                                                                                                          [BUILD=]
                                                                                                                 |----Phase 6 (UAT)----|
                                                                                                                 [======BUILD=========]
                                                                                                                                        |RSV|

Legend: [BUILD] = Active development   [BUF] = Phase buffer   [RSV] = Unallocated reserve
```

---

## 6. Resource Plan

### 6.1 Team Composition

| Role | Allocation | Phases | Responsibilities |
|------|-----------|--------|-----------------|
| Tech Lead / Senior Developer | Full-time (100%) | All phases (Weeks 1-30) | Architecture decisions, code reviews, calculation engine implementation, regression test design, Phase gate technical sign-off |
| Full-Stack Developer #1 | Full-time (100%) | Phases 1-5 (Weeks 1-25) | Frontend development (data grids, dashboard), UI components, keyboard navigation, export functionality |
| Full-Stack Developer #2 | Full-time (100%) | Phases 1-5 (Weeks 1-25) | Backend development (API, database), data migration scripts, integration testing, Tech Lead backup |
| QA Engineer | Part-time (50%) Phases 2-5, Full-time (100%) Phase 6 | Phases 2-6 (Weeks 6-29) | Test case design, regression testing, UAT coordination, bug triage, reconciliation validation |
| UX Designer | Part-time (50%) Phases 1-2, As-needed Phases 3-5 | Phases 1-5 (Weeks 1-25) | Data grid design, context bar UX, dashboard layout, export templates, training materials |
| Project Manager | Part-time (25%) | All phases (Weeks 1-30) | Schedule tracking, risk management, stakeholder communication, scope control, Phase gate scheduling |
| CAO (Domain Expert) | 0.5 day/week Phases 1-5, 2 days/week Phase 6 | All phases (Weeks 1-30) | Business rule validation, acceptance criteria review, Excel model clarification, UAT sign-off |

### 6.2 Resource Allocation by Phase

| Phase | Tech Lead | Dev #1 | Dev #2 | QA | UX | PM | CAO |
|-------|-----------|--------|--------|-----|-----|-----|------|
| Phase 1 (Wk 1-5) | 100% | 100% | 100% | 0% | 50% | 25% | 0.5d/wk |
| Phase 2 (Wk 6-11) | 100% | 100% | 100% | 50% | 50% | 25% | 0.5d/wk |
| Phase 3 (Wk 12-17) | 100% | 100% | 100% | 50% | 20% | 25% | 0.5d/wk |
| Phase 4 (Wk 18-22) | 100% | 100% | 100% | 50% | 10% | 25% | 0.5d/wk |
| Phase 5 (Wk 23-25) | 100% | 100% | 100% | 50% | 20% | 25% | 0.5d/wk |
| Phase 6 (Wk 26-29) | 100% | 50% | 50% | 100% | 10% | 50% | 2d/wk |
| Reserve (Wk 30) | 100% | 25% | 25% | 100% | 0% | 25% | 1d/wk |

### 6.3 Total Effort Estimate

| Role | Person-Weeks | Notes |
|------|-------------|-------|
| Tech Lead | 30 | Full-time throughout |
| Full-Stack Developer #1 | 26.5 | Full-time Phases 1-5, half-time Phase 6 |
| Full-Stack Developer #2 | 26.5 | Full-time Phases 1-5, half-time Phase 6 |
| QA Engineer | 16 | 12 weeks at 50% (Phases 2-5) + 4 weeks at 100% (Phase 6) |
| UX Designer | 8.5 | 5 weeks at 50% (Phase 1-2) + 16 weeks at ~20% avg (Phases 3-6) |
| Project Manager | 7.5 | 30 weeks at 25% |
| CAO | 5.5 | 25 weeks at 0.5d/wk + 4 weeks at 2d/wk |
| **Total** | **120.5 person-weeks** | |

---

## 7. MVP / Target / Stretch Tiers

### 7.1 Tier Definitions

| Tier | Target Completion | Decision Point | Scope Philosophy |
|------|------------------|----------------|-----------------|
| **MVP (Must Ship)** | Week 24 | Week 20 (if cumulative slip > 2 weeks) | Minimum feature set to replace Excel for monthly budget operations |
| **Target (Should Ship)** | Week 29 | Default plan; no slip | Full feature set as defined in PRD v2.0 |
| **Stretch (Could Ship)** | Week 30+ (post-launch) | Only if Target ships early or with remaining buffer | Enhanced analytics and automation features |

### 7.2 Feature Allocation by Tier

#### MVP Tier (Must Ship)

| Module | Features Included | Features Excluded |
|--------|------------------|-------------------|
| Authentication & RBAC | Login, role-based access (CAO, Finance Director, Analyst) | SSO integration |
| Context Bar | Fiscal year, version selector, module navigation | Breadcrumb history |
| Master Data | Grade, subject, fee type, nationality CRUD | Bulk import/export of master data |
| Enrollment Planning | Stage 1 (headcount by grade), Stage 2 (detail by nationality/tariff), historical import | Cohort progression modeling |
| Revenue Engine | Fee grid, discount engine, net fee calculation, monthly distribution, VAT handling | Revenue variance drill-down |
| DHG & Staffing | Curriculum grilles (4 bands), FTE calculation, subject hours | Capacity optimization suggestions |
| Staff Cost Engine | Salary components, GOSI, Ajeer, EoS provision, monthly cost grid | Year-over-year salary comparison |
| P&L Consolidation | Revenue subtotals, cost subtotals, EBITDA, Zakat, net income | IFRS Income Statement detail |
| Version Management | Single version type (Budget), Draft/Published/Locked lifecycle | Actual, Forecast versions; comparison engine |
| Audit Trail | Basic: who changed what, when, old/new values | Calculation trace ("Show Calculation" feature) |
| Data Migration | Import from 4 Excel workbooks + 5 CSV files | Automated reconciliation scripts |
| Export | Export all views to Excel (.xlsx) | PDF export, CSV export |

#### Target Tier (Should Ship)

All MVP features, plus:

| Module | Additional Features |
|--------|-------------------|
| Version Management | Actual, Budget, Forecast version types; full lifecycle |
| Comparison Engine | Budget vs. Actual, Budget vs. Forecast; variance at line-item and summary level |
| IFRS Reporting | Full IFRS Income Statement with classification and line-item detail |
| Scenario Modeling | Optimistic/Pessimistic/Custom scenarios with enrollment adjustment parameters |
| Dashboard | Executive KPI widgets, trend charts, capacity alerts |
| Capacity Planning | Section count alerts (over/under), enrollment vs. capacity visualization |
| Export | Excel + PDF + CSV export for all views |
| Audit Trail | Full audit with calculation trace, "Show Calculation" feature |

#### Stretch Tier (Could Ship)

All Target features, plus:

| Module | Additional Features |
|--------|-------------------|
| AEFE Benchmarks | Benchmark comparison against AEFE network averages (if data available) |
| Cohort Progression | Automated enrollment projection based on historical retention/attrition trends |
| Custom Scenarios | User-defined scenario parameters beyond enrollment (fee adjustments, staffing changes, cost drivers) |
| Advanced Analytics | Year-over-year trend analysis, department-level cost breakdowns, per-student cost analysis |
| Department Breakdowns | Revenue and cost allocation by department (Maternelle, Elementaire, College, Lycee) |
| ERP Integration | API connector for data export to school's ERP/accounting system |
| Variance Root Cause | Automated variance analysis suggesting which input changed to cause a discrepancy |

### 7.3 Tier Decision Protocol

```
Week 20 Checkpoint:
  IF cumulative schedule slip > 2 weeks beyond phase buffers:
    Project Manager presents MVP/Target trade-off to CAO
    CAO decides: (a) Accept MVP and defer Target features to v1.1
                 (b) Extend timeline by 2-4 weeks (requires Board approval if > 4 weeks)
                 (c) Add resources (contract developer, 8-week engagement)

Week 25 Checkpoint:
  IF Phase 5 is incomplete:
    Project Manager presents Target/Stretch trade-off to CAO
    CAO decides: (a) Ship Target without Stretch features
                 (b) Defer Dashboard analytics to v1.1, prioritize Migration & UAT
                 (c) Use reserve week for Dashboard completion

Post-Launch (Week 31+):
  Stretch features are added to v1.1 backlog, prioritized by CAO based on user feedback
```

---

## 8. Integrated Testing Strategy

### 8.1 Testing Principles

1. **Shift Left:** Testing begins in Phase 1, not Phase 6. Each phase has its own test deliverables.
2. **Regression First:** Automated regression tests against Excel baselines are the primary quality gate.
3. **Tolerance-Based:** Financial calculations use +/-1 SAR per line item per month (detail), +/-50 SAR per subtotal per month (consolidation).
4. **Continuous Integration:** All tests run on every commit via CI pipeline. No merge without green tests.
5. **CAO Validation:** Each phase gate includes CAO validation of 5 representative scenarios (hand-verified, not from Excel).

### 8.2 Testing by Phase

#### Phase 1: Foundation Testing

| Test Type | Scope | Count | Owner | Pass Criteria |
|-----------|-------|-------|-------|---------------|
| Unit Tests | Database schema validation (all tables, constraints, indexes) | 30+ | Dev #2 | All constraints enforced; no orphan references |
| Unit Tests | Authentication flow (login, logout, session management) | 15+ | Dev #2 | Correct role assignment; session expiry after 30 min inactivity |
| Unit Tests | RBAC enforcement (role-based access to modules and data) | 20+ | Dev #2 | Unauthorized access returns 403; no data leakage |
| Unit Tests | Master data CRUD (create, read, update, delete for all reference entities) | 25+ | Dev #1 | All CRUD operations succeed; validation rules enforced |
| Integration Tests | Context bar state persistence across module navigation | 10+ | Dev #1 | Context bar maintains fiscal year, version, module state after 10 sequential navigations |
| PoC Validation | Decimal arithmetic precision (sample revenue calculation) | 5 | Tech Lead | Result matches hand-calculated value to 2 decimal places |

**Phase 1 Test Deliverable:** 100+ unit tests, 10+ integration tests. CI pipeline green.

---

#### Phase 2: Enrollment & Revenue Testing

| Test Type | Scope | Count | Owner | Pass Criteria |
|-----------|-------|-------|-------|---------------|
| Unit Tests | Fee grid CRUD, discount calculation logic | 40+ | Dev #1 | All 45+ fee combinations produce correct net fees |
| Unit Tests | Revenue distribution methods (Academic /10, /12, specific months) | 30+ | Dev #2 | Monthly amounts sum to annual total within +/-0.01 SAR |
| Integration Tests | Enrollment-to-revenue pipeline: enrollment change triggers revenue recalculation | 20+ | QA | Revenue updates within 3 seconds of enrollment change |
| Regression Tests | App revenue vs. Excel REVENUE_ENGINE for all fee combinations x 12 months | 200+ | QA | >= 95% of line items within +/-1 SAR |
| Edge Case Tests | Zero enrollment, negative scenario enrollment (clamped to 0), fractional students | 10+ | QA | No crashes, no NaN, no #DIV/0! equivalents |
| CAO Validation | 5 hand-verified revenue scenarios (different grades, tariffs, discount types) | 5 | CAO | All 5 match CAO's hand calculations |

**Phase 2 Test Deliverable:** 300+ unit/integration tests, 200+ regression tests. Variance report delivered.

---

#### Phase 3: Staffing & Staff Costs Testing

| Test Type | Scope | Count | Owner | Pass Criteria |
|-----------|-------|-------|-------|---------------|
| Unit Tests | DHG grille configuration, FTE calculation, subject hours allocation | 30+ | Dev #2 | FTE matches manual calculation for all 4 curriculum bands |
| Unit Tests | Salary component calculation, GOSI, Ajeer, EoS provision | 50+ | Dev #2 | Each component matches Excel for 10 sample employees |
| Integration Tests | DHG enrollment to FTE to staff cost pipeline | 15+ | QA | FTE change cascades to staff cost within 3 seconds |
| Regression Tests | App staff costs vs. Excel for all 168 employees x 12 months | 2,016 | QA | >= 95% of cells within +/-1 SAR |
| YEARFRAC Tests | YEARFRAC implementation: leap year, Feb 29, mid-month join, 5-year boundary | 10 | Tech Lead | All 10 cases match Excel's YEARFRAC output exactly |
| EoS Regression | EoS provision for all 168 employees | 168 | QA | All 168 within +/-0.50 SAR |
| CAO Validation | 5 hand-verified employee scenarios (YoS < 5, = 5, > 5, Saudi, Ajeer) | 5 | CAO | All 5 match CAO's hand calculations |

**Phase 3 Test Deliverable:** 2,300+ regression tests, YEARFRAC suite, EoS suite. Variance report delivered.

---

#### Phase 4: Reporting & Versions Testing

| Test Type | Scope | Count | Owner | Pass Criteria |
|-----------|-------|-------|-------|---------------|
| Unit Tests | Version lifecycle state transitions (Draft, Published, Locked) | 20+ | Dev #1 | Invalid transitions rejected; audit trail records all transitions |
| Unit Tests | P&L consolidation formulas (subtotals, EBITDA, Zakat, net income) | 25+ | Dev #2 | Subtotals match sum of detail lines; Zakat = 2.5% of positive profit |
| Integration Tests | Version comparison: Budget vs. Actual variance at summary and line-item level | 15+ | QA | Variance = Actual - Budget for each line; totals reconcile |
| E2E Tests | Full version lifecycle: create Draft, edit, publish, lock, unlock, re-lock | 5 | QA | State transitions work end-to-end; audit trail complete |
| E2E Tests | Scenario modeling: apply optimistic/pessimistic parameters, compare results | 5 | QA | Scenarios produce plausible results; zero-enrollment handled gracefully |
| Regression Tests | P&L consolidation vs. Excel consolidated budget workbook | 50+ | QA | All subtotals within +/-50 SAR |
| CAO Validation | P&L consolidation for 2 complete months vs. Excel | 2 | CAO | CAO confirms P&L structure and totals are correct |

**Phase 4 Test Deliverable:** 120+ tests, P&L regression suite, comparison validation report.

---

#### Phase 5: Dashboard & Analytics Testing

| Test Type | Scope | Count | Owner | Pass Criteria |
|-----------|-------|-------|-------|---------------|
| UI Tests | Dashboard KPI widgets display correct values | 10+ | QA | Each KPI matches the underlying calculation engine output |
| UI Tests | Trend charts render correctly with real data | 5+ | QA | Charts display without errors; data points match source |
| Performance Tests | Page load times for all modules | 8 (one per module) | QA | All modules load in < 1 second on standard network |
| Performance Tests | Recalculation time for full revenue/cost cascade | 3 | QA | Recalculation completes in < 5 seconds |
| Export Tests | Excel, PDF, CSV export for all views | 10+ | QA | Exported files open correctly; data matches screen |
| Migration Rehearsal | Dry-run import of all 4 Excel workbooks + 5 CSV files into staging | 1 | QA + Tech Lead | Import completes without errors; record counts match |

**Phase 5 Test Deliverable:** 40+ tests, performance benchmark report, migration rehearsal report.

---

#### Phase 6: Migration & UAT Testing

| Test Type | Scope | Count | Owner | Pass Criteria |
|-----------|-------|-------|-------|---------------|
| Migration Verification | Production data import: record counts, data type validation, referential integrity | 1 full run | Tech Lead | Zero import errors; record counts match source |
| Reconciliation Tests | Cell-by-cell comparison for critical calculations (revenue, staff costs, P&L) | 500+ | QA | All critical calculations within defined tolerances |
| Parallel-Run Validation | App as primary, Excel as read-only. Weekly reconciliation for 2 weeks. | 2 weekly reports | QA + CAO | Matching results for 5+ consecutive business days |
| UAT Scripts | Structured test scripts covering all modules, executed by finance team | 30+ scripts | Finance team (facilitated by QA) | All scripts pass; Critical/High bugs resolved |
| Regression Suite | Full regression run of all prior phase tests | All (2,800+) | QA (automated) | >= 98% pass rate; no new Critical/High failures |
| Sign-Off | Final acceptance review | 1 | CAO + Finance Director | Written sign-off on go-live readiness |

**Phase 6 Test Deliverable:** Migration report, reconciliation report, UAT findings log, sign-off document.

### 8.3 Test Coverage Targets

| Category | Target Coverage | Measurement |
|----------|----------------|-------------|
| Unit Tests (business logic) | >= 80% line coverage | CI coverage report |
| Regression Tests (Excel baseline) | 100% of critical calculations | All 45+ fee combos, all 168 employees, all 12 months |
| Integration Tests | All cross-module data flows | Enrollment->Revenue, DHG->FTE->Staff Cost, Revenue+Cost->P&L |
| E2E Tests | All user workflows | Version lifecycle, scenario modeling, export |
| Performance Tests | All modules | Load time < 1 second, recalculation < 5 seconds |

---

## 9. Phase Milestones and Checkpoints

### 9.1 Phase Gate Protocol

Each phase gate is a formal checkpoint where the project team reviews deliverables against pass criteria. Gates are pass/fail.

**Gate Review Process:**
1. Tech Lead presents deliverables and test results (15 minutes).
2. QA presents regression test summary and open bugs (10 minutes).
3. CAO validates representative scenarios (pre-reviewed, 5 minutes).
4. Project Manager presents schedule status and risk updates (5 minutes).
5. Decision: Pass (proceed to next phase) / Conditional Pass (proceed with documented open items) / Fail (remain in current phase, consume buffer).

**Gate Participants:** Tech Lead, QA Engineer, Project Manager, CAO.

### 9.2 Phase Gates

#### Gate 1: Foundation Complete (End of Week 5)

| Criterion | Metric | Status Required |
|-----------|--------|-----------------|
| Authentication | Login, logout, session management working | Pass |
| RBAC | 3 roles configured and enforced | Pass |
| Context Bar | Persists state across 5+ module navigations | Pass |
| Master Data | CRUD for all reference entities (grades, subjects, fee types, nationalities) | Pass |
| Database Schema | ERD reviewed, all tables created, constraints enforced | Pass |
| Excel Audit | Pre-migration audit report delivered, reviewed by CAO | Pass |
| PoC | Decimal precision, grid performance, Excel export validated | Pass |
| CI Pipeline | All tests green, automated on every commit | Pass |
| Test Count | >= 100 unit tests, >= 10 integration tests | Pass |

---

#### Gate 2: Revenue Engine Validated (End of Week 11)

| Criterion | Metric | Status Required |
|-----------|--------|-----------------|
| Revenue Accuracy | >= 95% of line items within +/-1 SAR vs. Excel | Pass |
| Enrollment Import | All 5 CSV files imported; headcounts match source | Pass |
| Fee Grid | All 45+ fee combinations configured and tested | Pass |
| Discount Engine | All discount types (RP, Personnel, Scholarship, Exoneration) produce correct net fees | Pass |
| Revenue Distribution | All methods (/10, /12, specific months) produce correct monthly amounts | Pass |
| CAO Validation | 5/5 hand-verified scenarios match | Pass |
| Regression Suite | 200+ test cases passing in CI | Pass |
| Test Count | >= 400 cumulative tests | Pass |

---

#### Gate 3: Staff Cost Engine Validated (End of Week 17)

| Criterion | Metric | Status Required |
|-----------|--------|-----------------|
| Staff Cost Accuracy | >= 95% of cells within +/-1 SAR vs. Excel (168 employees x 12 months) | Pass |
| EoS Accuracy | All 168 employees within +/-0.50 SAR | Pass |
| YEARFRAC | All 10 test cases match Excel | Pass |
| GOSI/Ajeer | Calculations match Excel for all applicable employees | Pass |
| DHG/FTE | FTE output correct for all 4 curriculum bands | Pass |
| CAO Validation | 5/5 hand-verified employee scenarios match | Pass |
| Regression Suite | 2,300+ test cases passing in CI | Pass |
| Test Count | >= 2,700 cumulative tests | Pass |

---

#### Gate 4: Version Management and P&L Validated (End of Week 22)

| Criterion | Metric | Status Required |
|-----------|--------|-----------------|
| Version Lifecycle | Draft -> Published -> Locked transitions work; audit trail complete | Pass |
| Comparison Engine | Budget vs. Actual variance correct at summary and line-item level | Pass |
| P&L Consolidation | All subtotals within +/-50 SAR vs. Excel consolidated workbook | Pass |
| IFRS Statement | Structure matches Excel; classification correct | Pass |
| Scenario Modeling | Optimistic/Pessimistic scenarios produce plausible results; zero-enrollment handled | Pass |
| CAO Validation | P&L for 2 months validated by CAO | Pass |
| Regression Suite | All prior regression tests still passing | Pass |
| Test Count | >= 2,820 cumulative tests | Pass |

---

#### Gate 5: Production Ready (End of Week 25)

| Criterion | Metric | Status Required |
|-----------|--------|-----------------|
| Go-Live Criteria | All 8 acceptance criteria (Section 16.1) met in staging | Pass |
| Performance | All modules < 1 second load; recalculation < 5 seconds | Pass |
| Export | Excel, PDF, CSV exports produce valid files with correct data | Pass |
| Dashboard | KPIs display correct values; trend charts render correctly | Pass |
| Migration Rehearsal | Dry-run completes without blocking errors | Pass |
| Regression Suite | >= 98% pass rate across all 2,800+ tests | Pass |

---

#### Gate 6: Go-Live Approved (End of Week 29)

| Criterion | Metric | Status Required |
|-----------|--------|-----------------|
| Migration | Production data imported; record counts match; referential integrity verified | Pass |
| Reconciliation | All critical calculations within tolerance (500+ cell-by-cell checks) | Pass |
| Parallel Run | 5+ consecutive business days of matching results | Pass |
| UAT | All 30+ test scripts executed by finance team; Critical/High bugs resolved | Pass |
| Regression | Full regression suite passes (>= 98%) | Pass |
| Training | 2 sessions completed for all finance team members | Pass |
| Sign-Off | CAO and Finance Director written approval | Pass |
| Go-Live Plan | Backups, rollback plan, support contacts, monitoring in place | Pass |

---

## 10. Phase Dependencies

### 10.1 Dependency Map

```
Phase 1: Foundation
  |
  |-- D-001: Schema, auth, master data --> Phase 2
  |-- D-008: Tech stack decision --> All phases
  |-- D-010: Decimal library validation --> Phases 2, 3
  |-- D-007: Excel audit --> Phase 2 regression baseline
  |-- D-009: Regulatory Config table --> Phase 3
  |
  v
Phase 2: Enrollment & Revenue
  |
  |-- D-002: Enrollment data, fee grid --> Phase 3 (DHG uses enrollment)
  |-- D-003a: Revenue engine --> Phase 4 (P&L consolidation)
  |
  v
Phase 3: Staffing & Staff Costs
  |
  |-- D-003b: Staff cost engine --> Phase 4 (P&L consolidation)
  |
  v
Phase 4: Reporting & Versions
  |
  |-- D-004: Reporting engine, version management --> Phase 5 (dashboard data source)
  |
  v
Phase 5: Dashboard & Analytics
  |
  |-- D-005: All features complete --> Phase 6 (UAT can only test what exists)
  |
  v
Phase 6: Migration & UAT
  |
  |-- D-006: CAO availability (2 days/week) --> UAT validation and sign-off
  |
  v
Go-Live (Week 29-30)
```

### 10.2 Critical Path

The critical path runs through all 6 phases sequentially. There is no phase that can be executed in parallel with another due to the data dependency chain:

```
Phase 1 (Schema) --> Phase 2 (Enrollment/Revenue) --> Phase 3 (Staff Costs) -->
Phase 4 (Reporting/Versions) --> Phase 5 (Dashboard) --> Phase 6 (UAT) --> Go-Live
```

**Critical path duration:** 30 weeks (no slack on the critical path; all slack is in phase buffers).

**Highest-risk dependency:** D-003 (Phase 4 depends on both Phase 2 and Phase 3 calculation engines). If either Phase 2 or Phase 3 is delayed, Phase 4 cannot start. This is why both Phase 2 and Phase 3 have 1-week buffers.

### 10.3 Parallel Work Opportunities

While phases are sequential on the critical path, certain tasks within adjacent phases can overlap:

| Overlap Opportunity | Description | Risk |
|---|---|---|
| Phase 2 Week 11 + Phase 3 Week 12 | If Phase 2 gate passes early, Phase 3 DHG work (which does not depend on revenue engine) can start in Week 10 | Low -- DHG is enrollment-dependent, not revenue-dependent |
| Phase 4 Week 22 + Phase 5 Week 23 | Dashboard layout and KPI widget shells can be built before Phase 4 completes (data can be mocked) | Low -- UI work is independent of backend reporting logic |
| Phase 5 Week 24 + Phase 6 prep | Dry-run migration rehearsal can start while Phase 5 UI polish continues | Low -- migration rehearsal uses staging environment |

### 10.4 Dependency Risk Mitigations

| Dependency | Risk | Mitigation |
|---|---|---|
| D-001 (Phase 1 -> 2) | Schema design flawed; requires rework in Phase 2 | Schema review by Tech Lead + CAO in Phase 1 Week 4. Iterate before Phase 2 starts. |
| D-002 (Phase 2 -> 3) | Revenue engine incomplete; staff cost calculations lack enrollment data | Phase 2 buffer (Week 11) allows 1 week of spillover. If insufficient, Phase 3 starts with mock enrollment data and integrates real data when available. |
| D-003 (Phases 2+3 -> 4) | Either calculation engine has unresolved regression failures | Phase 3 buffer (Week 17) is the last opportunity to resolve before Phase 4. If both engines have > 5% failure rate, escalate to Level 3 (CAO) for tolerance relaxation or timeline extension. |
| D-006 (CAO availability) | CAO unavailable during Phase 6 | Backup domain expert designated in A-003. If CAO unavailable for > 1 week during Phase 6, pause UAT validation tasks and extend Phase 6 by equivalent duration (draw from reserve). |

---

*End of Document*

**Document Control:**

| Version | Date | Author | Change Description |
|---------|------|--------|-------------------|
| 2.0 | March 3, 2026 | BudFin Project Team | Initial comprehensive risk register and revised timeline |
