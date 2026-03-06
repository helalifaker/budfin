# PRODUCT REQUIREMENTS DOCUMENT

## BudFin -- School Financial Planning Workspace

### École Française Internationale de Riyad (EFIR)

| Field             | Value                                                      |
| ----------------- | ---------------------------------------------------------- |
| Document Version  | 2.0                                                        |
| Date              | March 3, 2026                                              |
| Status            | Frozen Baseline -- Comprehensive Audit Remediation Applied |
| Confidentiality   | Internal -- Restricted                                     |
| Author            | Office of the Chief Accounting Officer                     |
| Fiscal Year Scope | FY2026 (Jan--Dec 2026)                                     |

---

## Revision History

| Version | Date       | Author                                 | Description of Changes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------- | ---------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.0     | 2026-02-15 | Office of the Chief Accounting Officer | Initial draft. Established product vision, scope, functional requirements (Enrollment, Revenue, Staffing & Staff Costs, P&L, Scenarios, Master Data, Audit Trail, Dashboard, Input Management), data model overview, calculation engine specifications, non-functional requirements, UI/UX design principles, data migration strategy, implementation roadmap, risks and mitigations, acceptance criteria, and appendices A through I.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 1.1     | 2026-03-03 | Office of the Chief Accounting Officer | Phase 1 Stakeholder Review applied. Incorporated 6 decisions from CAO review: (D-001) reorganized navigation into 4 groups (Dashboard, Planning, Master Data, Admin); (D-002) merged Enrollment and Capacity Planning into unified "Enrollment & Capacity" module; (D-003) merged Staffing (DHG) and Staff Costs into unified "Staffing & Staff Costs" module; (D-004) added explicit Calculate button per planning module with stale-state indicator; (D-005) simplified Audit Trail scope for v1 (basic logging, deferred CSV export to v2); (D-006) added Version Management as dedicated Planning module with FRs VER-001 through VER-006. Added Decision Log (Section 19). Added Addendum with 32 additional FRs from Excel workbook analysis (FR-ADD-001 through FR-ADD-032).                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2.0     | 2026-03-03 | Office of the Chief Accounting Officer | Comprehensive audit remediation -- 72 gaps addressed across 10 dimensions. Added: Revision History, Glossary, Intended Audience, Document Versioning Policy, Approvers & Sign-Off, RACI matrix, Communication Plan. Added Scope Assumptions (SA-001 through SA-009), Change Control Process, Scope Freeze. Added 2 personas (System Administrator, External Auditor), 25 user stories (US-001 through US-025), 4 user journey maps, persona-to-FR traceability matrix. Added Technology Constraints (TC-001 through TC-005), Data Dictionary (5 entities), API Contract Guidance, Data Flow description. Replaced NFR table with 97 expanded NFRs across 12 categories including RBAC matrix. Added Acceptance Criteria for top 30 FRs with Given/When/Then format. Enhanced Data Migration Strategy with cleansing, rollback, transformation rules, parallel-run specification, and error handling. Replaced timeline (30 weeks with buffers), expanded risk register (15 risks with owners), added Resource Plan, MVP/Target/Stretch tiers, integrated testing strategy. Merged Addendum (32 FR-ADD items) into main body, applied MoSCoW priority tags to all 68 FRs, deleted Section 18 (Addendum). |

---

## Intended Audience

This Product Requirements Document serves the following audiences:

**(a) Development Team** -- Provides functional specifications, calculation algorithms, data model definitions, data dictionary, technology constraints, and UI/UX design principles required to build BudFin. The development team should use Section 8 (Functional Requirements), Section 10 (Calculation Engine Specifications), Section 9 (Data Model Overview with Data Dictionary), and the Technology Constraints as the primary source of truth for implementation. All calculation formulas must be implemented exactly as specified to achieve the zero-discrepancy target against Excel baselines.

**(b) QA Team** -- Provides acceptance criteria (Sections 16 and 16.3), testable functional requirements with unique IDs and MoSCoW priorities, non-functional requirements with measurable targets (Section 11), and the data migration validation protocol (Section 13). The QA team should derive test cases from each functional requirement's acceptance criteria and use the appendices as reference data for validation.

**(c) Finance Stakeholders (EFIR)** -- Provides domain validation for business rules, calculation logic, fee structures, statutory cost rules (GOSI, Ajeer, EoS), IFRS compliance requirements, and workflow accuracy. Finance stakeholders should review Sections 8.2 (Revenue), 8.3 (Staffing & Staff Costs), 8.4 (P&L), and 10 (Calculation Engine) to confirm that every business rule embedded in the current Excel workbooks is accurately captured. The Decision Log (Section 20) records all stakeholder-driven changes.

**(d) Project Management** -- Provides scope definition (Section 4), implementation roadmap with phased delivery (Section 14), risk register with mitigations (Section 15), resource plan, MVP/Target/Stretch tier definitions, and success metrics (Section 16). Project managers should use the roadmap to plan resources and timelines, and the risk register to monitor and escalate identified risks during execution.

---

## Document Versioning Policy

This PRD follows a semantic versioning scheme with three levels of change classification:

**Major Version (X.0)** -- Structural or scope changes that alter the fundamental architecture, add or remove entire modules, change the project scope boundary (in-scope vs. out-of-scope), modify the data model in breaking ways, or represent a comprehensive remediation pass. Major versions require full stakeholder review and sign-off before publication. Examples: adding a new planning module, removing a feature from scope, comprehensive audit remediation.

**Minor Version (X.Y)** -- Corrections, clarifications, and enhancements that refine existing requirements without changing the overall structure or scope. Minor versions include stakeholder feedback integration, additional functional requirements derived from deeper analysis, decision log updates, and cross-reference improvements. Minor versions require review by the document owner (CAO) and the directly affected team (development or finance). Examples: incorporating stakeholder review decisions, adding FRs discovered during Excel analysis, clarifying calculation formulas.

**Patch Version (X.Y.Z)** -- Typographical fixes, formatting corrections, broken link repairs, and minor wording adjustments that do not alter the meaning or intent of any requirement. Patch versions can be applied by the document author without formal review, though they must be recorded in the Revision History. Examples: fixing a typo in a table header, correcting a markdown formatting issue, updating a broken cross-reference.

**Version Numbering Rules:**

- The document version appears in the header metadata table (Field: Document Version).
- Each version increment is recorded in the Revision History with date, author, and description.
- Only the latest version of the PRD is considered authoritative. Prior versions are retained in Git history for reference.
- Version numbers are never reused or decremented.

---

## Table of Contents

**Front Matter:** Revision History | Intended Audience | Document Versioning Policy

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
   - 2.1 Current Pain Points
   - 2.2 Business Impact
3. [Product Vision and Goals](#3-product-vision-and-goals)
   - 3.1 Vision Statement
   - 3.2 Strategic Goals
4. [Scope](#4-scope)
   - 4.1 In Scope
   - 4.2 Out of Scope
   - 4.3 Scope Assumptions (SA-001 -- SA-009)
   - 4.4 Change Control Process
   - 4.5 Scope Freeze
5. [User Personas and Stories](#5-user-personas-and-stories)
   - 5.1 Persona Registry (6 personas)
   - 5.2 User Stories (US-001 -- US-025)
   - 5.3 Persona-to-FR Traceability Matrix
   - 5.4 User Journey Maps (4 workflows)
6. [Workspace Architecture](#6-workspace-architecture)
   - 6.1 Context Bar (Persistent Header)
   - 6.2 Navigation Modules (Dashboard | Planning | Master Data | Admin)
7. [Version Management System](#7-version-management-system)
   - 7.1 Version Types
   - 7.2 Version Lifecycle
   - 7.3 Comparison Engine
   - 7.4 Version Management Functional Requirements (FR-VER-001 -- FR-VER-006)
8. [Functional Requirements](#8-functional-requirements) (68 FRs with MoSCoW priority)
   - 8.1 Enrollment & Capacity Module (FR-ENR-_, FR-CAP-_)
   - 8.2 Revenue Module (FR-REV-\*)
   - 8.3 Staffing & Staff Costs Module (FR-DHG-_, FR-STC-_)
   - 8.4 P&L and Financial Reporting Module (FR-PNL-\*)
   - 8.5 Scenario Modeling (FR-SCN-\*)
   - 8.6 Master Data Management (FR-MDM-\*)
   - 8.7 Audit Trail and Change History (FR-AUD-\*)
   - 8.8 Dashboard Module (FR-DSH-\*)
   - 8.9 Input Management (FR-INP-\*)
9. [Data Model Overview](#9-data-model-overview)
   - 9.1 Technology Constraints (TC-001 -- TC-005)
   - 9.2 Data Dictionary (5 entities)
   - 9.3 API Contract Guidance
   - 9.4 Data Flow Description
10. [Calculation Engine Specifications](#10-calculation-engine-specifications)
11. [Non-Functional Requirements](#11-non-functional-requirements) (97 NFRs across 12 categories)
    - 11.1 Performance | 11.2 Reliability | 11.3 Security & RBAC
    - 11.4 Usability | 11.5 Data | 11.6 Scalability
    - 11.7 Compliance/Regulatory | 11.8 Localization | 11.9 Load Testing
    - 11.10 Export | 11.11 Maintainability | 11.12 Monitoring
12. [UI/UX Design Principles](#12-uiux-design-principles)
13. [Data Migration Strategy](#13-data-migration-strategy)
    - 13.1 Source Files | 13.2 Sheet-Level Mapping | 13.3 Data Cleansing Strategy
    - 13.4 Validation Protocol | 13.5 Data Transformation Rules
    - 13.6 Rollback Plan | 13.7 Parallel-Run Specification | 13.8 Historical Data Scope
14. [Implementation Roadmap](#14-implementation-roadmap) (30 weeks with buffers)
    - 14.1 Phase Timeline | 14.2 Milestones | 14.3 Phase Dependencies
    - 14.4 Resource Plan | 14.5 MVP / Target / Stretch Tiers
    - 14.6 Integrated Testing Strategy
15. [Risks and Mitigations](#15-risks-and-mitigations) (15 risks with owners)
    - 15.1 Risk Register | 15.2 Risk Heat Map | 15.3 Risk Review Cadence
    - 15.4 RAID Log (Assumptions, Issues, Dependencies)
16. [Acceptance Criteria and Success Metrics](#16-acceptance-criteria-and-success-metrics)
    - 16.1 Go-Live Acceptance Criteria | 16.2 Post-Launch Success Metrics
    - 16.3 Detailed Acceptance Criteria for Top 30 FRs (Given/When/Then)
17. [Appendices](#17-appendices) (A through I)
18. [Glossary of Terms](#18-glossary-of-terms)
19. [Document Governance](#19-document-governance)
    - 19.1 RACI Matrix | 19.2 Sign-Off Table | 19.3 Communication Plan
20. [Decision Log](#20-decision-log) (D-001 -- D-007)

---

## 1. Executive Summary

EFIR currently manages its annual budget cycle across four interconnected Excel workbooks and five CSV files covering enrollment history, revenue forecasting, curriculum-based staffing models, employee compensation, and IFRS-compliant consolidated reporting. This fragmented approach creates version-control risks, manual reconciliation overhead, audit-trail gaps, and an inability to compare actuals against budget or forecast in real time.

BudFin is a purpose-built financial planning workspace designed to replace this spreadsheet-driven process with a single, reliable application. The system will consolidate enrollment planning, revenue forecasting, staff-cost budgeting, and financial reporting into one platform with strong version management (Actual, Budget, Forecast), instant cross-version comparison, and a persistent context bar that preserves the user's working state across planning modules.

The application will serve EFIR as a single-school deployment, optimized for speed and reliability rather than multi-tenant scalability. It must faithfully reproduce every calculation currently embedded in the Excel models -- including the dual academic-calendar revenue engine, DHG-based FTE staffing, Saudi statutory cost rules (GOSI, Ajeer, End of Service), and IFRS 15 revenue classification -- while adding the analytical and governance capabilities that spreadsheets cannot provide.

---

## 2. Problem Statement

### 2.1 Current Pain Points

**Fragmented Data Architecture**
The budgeting process relies on four separate Excel workbooks (Revenue, DHG Staffing, Staff Costs, Consolidated Budget) plus five historical enrollment CSVs. Cross-file formulas are brittle: the Executive Summary sheet already contains a `#REF!` error, and any structural change in one workbook can cascade failures across the entire model.

**No Version Management Infrastructure**
Files use manual naming conventions (v1, v3, V3) with no formal mechanism to distinguish Actual results from Budget assumptions or Forecast revisions. There is no way to lock a published budget version while continuing to iterate on a forecast.

**Inability to Compare Versions**
Comparing Budget vs. Actual or Budget vs. Forecast requires manual side-by-side analysis. The YoY Comparison sheet provides salary variance data, but no equivalent exists for revenue, enrollment, or total P&L variance at the consolidated level.

**No Audit Trail**
Changes to assumptions, enrollment figures, fee grids, or salary components are not tracked. There is no record of who changed what, when, or why -- a significant gap for a school handling over 40 million SAR in annual revenue.

**Slow and Error-Prone Analysis**
Analyzing historical enrollment trends, running scenario comparisons, or drilling into cost drivers requires navigating across multiple sheets and workbooks. This makes the monthly close and annual budget cycle unnecessarily time-consuming for the finance team.

### 2.2 Business Impact

- Budget cycle takes 4--6 weeks instead of days due to manual data reconciliation.
- Finance leadership cannot get real-time answers on budget-to-actual variance.
- Board and AEFE reporting requires manual compilation from multiple sources.
- Risk of material misstatement due to broken cross-file references.
- No ability to model what-if scenarios rapidly for enrollment or cost changes.

---

## 3. Product Vision and Goals

### 3.1 Vision Statement

BudFin will be a fast, reliable financial planning workspace that enables EFIR's finance team to build, analyze, and compare budgets and forecasts against actual performance -- all within a single application that behaves like an integrated workbench rather than a collection of disconnected spreadsheets.

### 3.2 Strategic Goals

| Goal                                | Success Metric                                      | Target        |
| ----------------------------------- | --------------------------------------------------- | ------------- |
| Eliminate spreadsheet fragmentation | Number of external files needed for budget cycle    | Zero          |
| Enable real-time version comparison | Time to generate Budget vs. Actual variance report  | < 5 seconds   |
| Provide full audit trail            | Percentage of data changes with attribution         | 100%          |
| Accelerate budget cycle             | Elapsed days for annual budget preparation          | Reduce by 60% |
| Ensure calculation reliability      | Number of broken references or formula errors       | Zero          |
| Support IFRS-compliant reporting    | Manual adjustments needed for IFRS Income Statement | Zero          |

---

## 4. Scope

### 4.1 In Scope

- Single-school deployment for EFIR (no multi-tenant requirements).
- Version management: Actual, Budget, and Forecast with locking and comparison.
- Enrollment planning with 5-year historical trend analysis and cohort progression.
- Revenue forecasting engine: fee grids, discount policies, monthly allocation by academic calendar.
- Staff cost budgeting: salary components, GOSI, Ajeer, End of Service provisioning.
- DHG-based curriculum staffing model with FTE calculation.
- Consolidated monthly P&L with IFRS 15 revenue classification.
- Master data management: accounts, profit centers, cost centers, departments.
- Scenario modeling: Base, Optimistic, Pessimistic with configurable adjustment factors.
- Class capacity planning with utilization alerts.
- Workspace UI with persistent context bar across all planning modules.
- Full audit trail on all data modifications.

### 4.2 Out of Scope (v1)

- Multi-school / multi-entity consolidation.
- Student-level individual billing or invoicing.
- HR workflows (leave, performance, recruitment pipeline).
- General ledger integration or ERP connector.
- Mobile application.
- Parent or student-facing portal.

### 4.3 Scope Assumptions

The following assumptions constrain the design and implementation of BudFin v1. Any deviation from these assumptions triggers the Change Control Process (Section 4.4).

| ID     | Assumption             | Value                                                                                                                                                                                                                                                                                                                                                                                                                 | Rationale                                                                                                                                                                                            |
| ------ | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SA-001 | Currency               | SAR (Saudi Riyal) only. Multi-currency support is out of scope for v1. All monetary values are denominated in SAR. No exchange rate tables, currency conversion logic, or multi-currency ledger entries are required.                                                                                                                                                                                                 | EFIR operates exclusively in Saudi Arabia with SAR-denominated tuition, salaries, and statutory obligations.                                                                                         |
| SA-002 | UI Language            | English only for v1. French and Arabic localization (including RTL layout support) are deferred to v2. All UI labels, validation messages, error text, report headers, and help content are in English. Domain-specific French terms (e.g., grade names like "Terminale", cost lines like "Contrats Locaux Remplacements") are preserved as-is since they are proper nouns within the EFIR context.                   | Reduces v1 scope while preserving domain terminology that the finance team already uses in English/French.                                                                                           |
| SA-003 | Timezone               | Arabia Standard Time (AST, UTC+3) for all timestamps, date calculations, and date display. No daylight saving time adjustments (Saudi Arabia does not observe DST). All server-side timestamps stored in UTC and converted to AST for display. YEARFRAC and date arithmetic use AST-anchored dates.                                                                                                                   | EFIR is located in Riyadh, Saudi Arabia. Single-timezone simplifies date logic.                                                                                                                      |
| SA-004 | Concurrent Users       | Maximum ~20 concurrent users (single school finance team). No requirement for horizontal scaling, connection pooling beyond default limits, or real-time collaborative editing. Optimistic locking is sufficient for conflict resolution.                                                                                                                                                                             | PRD Section 5 defines six personas within a single school's finance and administrative staff.                                                                                                        |
| SA-005 | Fiscal Years Supported | Maximum 10 fiscal years of active data (current year + 9 historical years). Fiscal years beyond the 10-year window must be archived per the version archival policy. Archived data remains queryable for read-only access but is excluded from active calculations and version comparison.                                                                                                                            | 10 years provides sufficient historical depth for trend analysis (FR-ENR-001 requires 5+ years) while keeping database size manageable.                                                              |
| SA-006 | Deployment Model       | Single-school, single-tenant deployment. No multi-entity consolidation, no shared infrastructure between schools, no tenant isolation logic. One database instance serves one EFIR installation.                                                                                                                                                                                                                      | PRD Section 4.1 explicitly scopes to "single-school deployment for EFIR." Section 4.2 defers multi-school consolidation to a future version.                                                         |
| SA-007 | Browser Support        | Modern evergreen browsers: Chrome, Edge, Firefox, and Safari (latest 2 major versions at time of release). No support for Internet Explorer, legacy Edge (EdgeHTML), or mobile browsers. Progressive Web App (PWA) capabilities are not required.                                                                                                                                                                     | Standard office environment with managed workstations. Evergreen browsers ensure access to modern JavaScript APIs (ES2022+), CSS Grid/Flexbox, and Web APIs required for keyboard-driven data grids. |
| SA-008 | Network Requirements   | Standard office LAN/WiFi connectivity assumed. No offline mode, no service worker caching for offline use, no conflict resolution for offline-to-online sync. Application requires active network connection for all operations. Minimum expected bandwidth: 10 Mbps.                                                                                                                                                 | EFIR operates from a single physical campus with reliable office network infrastructure. Offline scenarios are not part of the daily finance workflow.                                               |
| SA-009 | Data Volume            | Approximately 1,500 students, 168 employees, 31 sheets across 4 Excel workbooks, 5 enrollment CSV files. Fee grid contains ~45+ combinations (15 grades x 3 nationalities x 3 tariffs, for 2 academic periods). Monthly budget grid produces 12 x 168 = ~2,016 employee-month records per fiscal year. Total active data fits comfortably within a single PostgreSQL/MySQL instance without partitioning or sharding. | Derived from actual EFIR data: enrollment CSVs (2021-22 through 2025-26), Revenue workbook (12 sheets), DHG workbook (9 sheets), Staff Costs workbook (8 sheets), Consolidated workbook (2 sheets).  |

### 4.4 Change Control Process

All changes to requirements after the scope freeze date (Section 4.5) must follow this five-step process. The process applies to functional requirements (FR-_), non-functional requirements (NFR), scope assumptions (SA-_), and technology constraints (TC-\*).

**Step 1: Change Request Submission**

The requester submits a formal change request using the following template:

| Field             | Description                                                                |
| ----------------- | -------------------------------------------------------------------------- |
| CR Number         | Auto-assigned sequential identifier (CR-001, CR-002, ...)                  |
| Requester         | Name and role of the person requesting the change                          |
| Date Submitted    | Date the change request was filed                                          |
| Description       | Clear description of what needs to change                                  |
| Justification     | Business or technical reason for the change                                |
| Affected FRs      | List of functional requirement IDs impacted (e.g., FR-REV-011, FR-STC-009) |
| Affected Sections | PRD sections that would need revision                                      |
| Estimated Impact  | Requester's initial assessment: Low / Medium / High                        |

**Step 2: Impact Assessment (Tech Lead)**

The Tech Lead performs a formal impact assessment within 3 business days of submission:

- **Effort estimate**: Story points or person-days required to implement
- **Risk assessment**: Impact on existing functionality, data integrity, and calculation accuracy
- **Timeline impact**: Effect on current sprint and overall delivery schedule
- **Dependency analysis**: Other FRs or modules affected by the change
- **Testing impact**: Additional test cases or regression testing required

**Step 3: Approval**

Approval authority depends on the MoSCoW priority of the affected requirements:

| Affected Priority             | Approval Authority                               | SLA             |
| ----------------------------- | ------------------------------------------------ | --------------- |
| [MUST] requirements           | CAO (Chief Accounting Officer) approval required | 5 business days |
| [SHOULD] requirements         | Project Manager approval sufficient              | 3 business days |
| [COULD] requirements          | Project Manager approval sufficient              | 3 business days |
| New requirements (not in PRD) | CAO approval required                            | 5 business days |

**Step 4: Implementation**

Upon approval:

1. Approved change is assigned to the next available sprint backlog
2. FR references in the PRD are updated to reflect the change
3. Implementation follows standard development workflow (branch, develop, test, review, merge)
4. Regression tests are executed for all affected modules
5. Calculation validation against Excel baselines is re-run if the change affects any calculation engine

**Step 5: Documentation**

All approved changes are reflected in the PRD with:

- PRD version number incremented (minor or patch as appropriate)
- Change log entry added to the Decision Log (Section 20)
- Affected FR text updated in-place with a revision marker
- Impact assessment and approval record archived in project documentation

### 4.5 Scope Freeze

> **PRD v2.0 represents the frozen baseline.** After the scope freeze, all changes to functional requirements, non-functional requirements, scope assumptions, and technology constraints must follow the Change Control Process defined in Section 4.4. No exceptions.

Changes submitted after the scope freeze are evaluated against the current sprint plan. Emergency changes (e.g., regulatory compliance, data integrity issues) may be fast-tracked with CAO approval but still require formal documentation.

---

## 5. User Personas

### 5.1 Persona Registry

| Persona                | Role                                        | Primary Needs                                                                                    | Key Activities                                                                                                                                                                                 |
| ---------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Budget Owner           | Chief Accounting Officer / Finance Director | Full control over budget versions, assumptions, and approvals; variance analysis                 | Create/lock budget versions; approve forecasts; review P&L variance; present to board                                                                                                          |
| Budget Analyst         | Finance Manager / Controller                | Efficient data entry, scenario modeling, detailed drill-down                                     | Enter enrollment projections; adjust fee grids; run scenarios; prepare monthly close reports                                                                                                   |
| HR/Payroll Coordinator | HR Manager                                  | Staff roster accuracy, cost projections for new hires                                            | Maintain employee master data; validate salary components; review EoS provisions                                                                                                               |
| School Administrator   | Proviseur / Principal                       | Enrollment visibility, capacity planning, staffing adequacy                                      | Review enrollment trends; check class capacity; validate DHG staffing requirements                                                                                                             |
| System Administrator   | IT Manager / Technical Lead                 | System reliability, user access management, data backup integrity                                | Manage user accounts and RBAC roles; monitor system health; perform database backups; configure system parameters; troubleshoot technical issues                                               |
| External Auditor       | IFRS Auditor / Compliance Reviewer          | Read-only access to financial data, audit trail, and version history for compliance verification | Review IFRS Income Statement outputs; verify audit trail completeness; validate calculation methodology; inspect version lifecycle compliance; confirm data integrity against source documents |

### 5.2 User Stories

#### 5.2.1 Budget Owner Stories

**US-001: Create Annual Budget Version**
As a Budget Owner, I want to create a new Budget version for FY2026, so that the finance team has a workspace to build the annual plan.

- **Acceptance Criteria:** New version created in Draft status; appears in context bar; audit event logged.
- **Related FRs:** FR-VER-001, FR-VER-006

**US-002: Lock Approved Budget**
As a Budget Owner, I want to lock a Budget version after board approval, so that approved figures cannot be accidentally modified.

- **Acceptance Criteria:** Version transitions to Locked status; all data fields become read-only; audit entry with timestamp and user; version badge changes to "Locked."
- **Related FRs:** FR-VER-003, FR-AUD-002

**US-003: Compare Budget vs. Forecast**
As a Budget Owner, I want to compare the approved Budget against the latest Forecast, so that I can quantify variance and explain drivers to the board.

- **Acceptance Criteria:** Selecting two versions activates variance columns; absolute and percentage variance displayed; color-coded favorable/unfavorable.
- **Related FRs:** FR-VER-004, FR-PNL-006

**US-004: Review P&L Variance**
As a Budget Owner, I want to see the consolidated P&L with variance against prior period or budget, so that I can identify areas needing attention during monthly review.

- **Acceptance Criteria:** P&L displays 12 monthly columns + annual total; variance columns appear when comparison version active; drill-down to line-item level.
- **Related FRs:** FR-PNL-001, FR-PNL-004, FR-PNL-006

**US-005: Approve Forecast Revision**
As a Budget Owner, I want to review and publish a forecast revision prepared by the Budget Analyst, so that the latest projections become the official working numbers.

- **Acceptance Criteria:** Forecast version transitions from Draft to Published; all stakeholders can view published version; audit trail records publication event.
- **Related FRs:** FR-VER-003, FR-AUD-002

#### 5.2.2 Budget Analyst Stories

**US-006: Enter Enrollment Projections**
As a Budget Analyst, I want to enter AY2 enrollment projections by grade, nationality, and tariff, so that the revenue engine can calculate updated forecasts.

- **Acceptance Criteria:** Two-stage entry (total headcount then breakdown); validation that Stage 2 sums match Stage 1; stale indicator appears on Revenue module after save.
- **Related FRs:** FR-ENR-005, FR-ENR-006, FR-ENR-007

**US-007: Adjust Fee Grid for New Academic Year**
As a Budget Analyst, I want to update tuition fees for AY2 in the current forecast version, so that revenue projections reflect the latest approved fee schedule.

- **Acceptance Criteria:** Fee grid editable in Draft/Published versions; changes scoped to selected version only; HT auto-calculated from TTC; audit trail logs each fee change.
- **Related FRs:** FR-REV-001, FR-REV-003, FR-REV-004

**US-008: Run Scenario Comparison**
As a Budget Analyst, I want to compare Base, Optimistic, and Pessimistic scenarios side-by-side, so that I can prepare a range of outcomes for the finance committee.

- **Acceptance Criteria:** All three scenarios display simultaneously with delta columns; enrollment, revenue, and net revenue metrics shown per scenario.
- **Related FRs:** FR-SCN-001, FR-SCN-004, FR-SCN-006, FR-SCN-007

**US-009: Prepare Monthly Close Reports**
As a Budget Analyst, I want to generate the monthly P&L close report with IFRS classification, so that the Finance Director can review it before board submission.

- **Acceptance Criteria:** P&L generated with IFRS line items; export to Excel and PDF available; report includes current month and YTD figures.
- **Related FRs:** FR-PNL-001, FR-PNL-016, FR-PNL-018

**US-010: Calculate Revenue After Data Changes**
As a Budget Analyst, I want to click the Calculate button after updating enrollment and fee data, so that the revenue engine recalculates all monthly figures.

- **Acceptance Criteria:** Calculate button triggers full revenue recalculation; visual feedback within 200ms; results displayed within 3 seconds; stale indicator clears; success/error message shown.
- **Related FRs:** FR-REV-011, FR-REV-012, Section 12 (Calculate button behavior)

#### 5.2.3 HR/Payroll Coordinator Stories

**US-011: Maintain Employee Master Data**
As an HR/Payroll Coordinator, I want to add, edit, and review employee records with all salary components, so that staff cost calculations are based on accurate data.

- **Acceptance Criteria:** All 18+ fields editable; validation on required fields; duplicate detection on import; audit trail for every change.
- **Related FRs:** FR-STC-001, FR-STC-002, FR-STC-003, FR-AUD-001

**US-012: Review EoS Provisions**
As an HR/Payroll Coordinator, I want to review the End of Service provision for each employee, so that I can verify the calculation against our internal records and Saudi Labor Law requirements.

- **Acceptance Criteria:** EoS provision displayed per employee with opening balance, annual charge, and closing balance; YEARFRAC-based years of service visible; drill-down to formula components.
- **Related FRs:** FR-STC-011

**US-013: Model New Hire Impact**
As an HR/Payroll Coordinator, I want to add planned new positions starting September and see their impact on total staff costs, so that I can advise on hiring budget adequacy.

- **Acceptance Criteria:** New positions contribute zero cost Jan-Aug, full cost Sep-Dec; step-change visible in monthly budget grid; total headcount and cost updated.
- **Related FRs:** FR-STC-012, FR-STC-013

**US-014: Validate GOSI and Ajeer Calculations**
As an HR/Payroll Coordinator, I want to verify that GOSI applies only to Saudi nationals and Ajeer costs are correctly calculated for non-Saudi staff, so that statutory obligations are accurately budgeted.

- **Acceptance Criteria:** GOSI = 11.75% applied to 2 Saudi employees only; Ajeer levy + platform fee applied to 166 non-Saudi employees; prorated for new hires.
- **Related FRs:** FR-STC-009, FR-STC-010

#### 5.2.4 School Administrator Stories

**US-015: Review Enrollment Trends**
As a School Administrator, I want to see 5-year enrollment trends by grade level, so that I can plan for facility and staffing needs.

- **Acceptance Criteria:** Line chart showing 5 years of enrollment per grade; CAGR and moving averages displayed; filterable by band (Maternelle, Elementaire, College, Lycee).
- **Related FRs:** FR-ENR-001, FR-ENR-003, FR-ENR-004

**US-016: Check Class Capacity**
As a School Administrator, I want to see capacity utilization per grade with traffic-light alerts, so that I can identify grades approaching maximum capacity.

- **Acceptance Criteria:** Utilization percentage displayed per grade; traffic-light (green/amber/red) based on Plancher/Cible/Plafond thresholds; recruitment slots calculated.
- **Related FRs:** FR-CAP-001 through FR-CAP-007

**US-017: Validate DHG Staffing**
As a School Administrator, I want to review FTE requirements per curriculum band and compare against current staffing, so that I can ensure adequate teaching coverage.

- **Acceptance Criteria:** FTE requirements by level displayed; comparison against available staff; HSA scenario impact visible; ASEM assistant requirements for Maternelle shown.
- **Related FRs:** FR-DHG-009 through FR-DHG-015

#### 5.2.5 System Administrator Stories

**US-018: Manage User Accounts**
As a System Administrator, I want to create, edit, deactivate user accounts and assign RBAC roles, so that only authorized personnel access the system with appropriate permissions.

- **Acceptance Criteria:** CRUD operations on user accounts; four roles assignable (Admin, Budget Owner, Editor, Viewer); role changes logged in audit trail.
- **Related FRs:** NFR Security (RBAC matrix)

**US-019: Monitor System Health**
As a System Administrator, I want to view application health status, error logs, and backup status, so that I can ensure the system is running reliably.

- **Acceptance Criteria:** Health endpoint accessible; error logs filterable by severity; last backup timestamp visible; alerts for FATAL errors.
- **Related FRs:** NFR Monitoring, NFR Reliability

**US-020: Configure System Parameters**
As a System Administrator, I want to configure fiscal year settings, academic year boundaries, and system-wide parameters, so that the application reflects the correct operational context.

- **Acceptance Criteria:** System settings editable by Admin role only; changes logged in audit trail; validation prevents invalid configurations.
- **Related FRs:** FR-MDM-005, FR-MDM-008

**US-021: Perform Database Backup and Restore**
As a System Administrator, I want to verify that daily backups are running and test restore procedures, so that data can be recovered within the RTO if needed.

- **Acceptance Criteria:** Backup status visible with last run time and checksum; test restore can be initiated; RPO < 24 hours confirmed; RTO < 4 hours achievable.
- **Related FRs:** NFR Reliability (RTO, RPO, Backup)

#### 5.2.6 External Auditor Stories

**US-022: Review IFRS Income Statement**
As an External Auditor, I want to view the IFRS Income Statement with full line-item detail and reclassification notes, so that I can verify compliance with IAS 1 and IFRS 15.

- **Acceptance Criteria:** P&L displayed with IFRS classifications; all values in SAR HT; reclassification mapping visible; read-only access (no edit capability).
- **Related FRs:** FR-PNL-001, FR-PNL-016, FR-PNL-018

**US-023: Inspect Audit Trail**
As an External Auditor, I want to review the complete audit trail for a given fiscal year and version, so that I can confirm all data changes are properly attributed and timestamped.

- **Acceptance Criteria:** Audit log filterable by date range and version; entries show user, timestamp, field, old/new values; 7-year retention confirmed.
- **Related FRs:** FR-AUD-001, FR-AUD-002, FR-AUD-003

**US-024: Validate Calculation Methodology**
As an External Auditor, I want to trace how revenue and staff cost figures are calculated from source inputs, so that I can verify the methodology conforms to IFRS and Saudi regulatory requirements.

- **Acceptance Criteria:** Calculation audit log shows input hash, output hash, duration, and success/failure per calculation run; formula documentation accessible; results traceable to source data.
- **Related FRs:** Section 10 (Calculation Engine), NFR Monitoring (Calculation audit log)

**US-025: Compare Budget Versions**
As an External Auditor, I want to compare the approved Budget against Actual results with variance analysis, so that I can assess budget accuracy and identify material variances.

- **Acceptance Criteria:** Version comparison available in read-only mode; absolute and percentage variance displayed; drill-down to line-item level; export to Excel for working papers.
- **Related FRs:** FR-VER-004, FR-PNL-006

### 5.3 Persona-to-FR Traceability Matrix

| FR Family            | Budget Owner | Budget Analyst | HR/Payroll | School Admin | System Admin | Ext. Auditor |
| -------------------- | ------------ | -------------- | ---------- | ------------ | ------------ | ------------ |
| FR-ENR (Enrollment)  | View         | Edit           | --         | View         | --           | View         |
| FR-CAP (Capacity)    | View         | Edit           | --         | View         | --           | --           |
| FR-REV (Revenue)     | View         | Edit           | --         | --           | --           | View         |
| FR-DHG (Staffing)    | View         | View           | View       | View         | --           | --           |
| FR-STC (Staff Costs) | View         | View           | Edit       | --           | --           | View         |
| FR-PNL (P&L)         | View         | Edit           | --         | --           | --           | View         |
| FR-SCN (Scenarios)   | View         | Edit           | --         | View         | --           | --           |
| FR-MDM (Master Data) | View         | Edit           | Edit       | --           | Configure    | --           |
| FR-AUD (Audit)       | View         | View           | View       | --           | View         | View         |
| FR-DSH (Dashboard)   | View         | View           | View       | View         | View         | View         |
| FR-INP (Input Mgmt)  | View         | Edit           | Edit       | --           | --           | --           |
| FR-VER (Versions)    | Full         | Create/Clone   | --         | --           | --           | View         |

**Legend:** Edit = can create/modify data; View = read-only access; Full = all lifecycle operations; Configure = system-level settings; -- = no access to this module.

### 5.4 User Journey Maps

#### 5.4.1 Annual Budget Preparation

| Step | Actor          | Action                                                                | System Response                                                                               | Duration |
| ---- | -------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------- |
| 1    | Budget Owner   | Creates new Budget version "Budget FY2026"                            | Version created in Draft status; appears in context bar                                       | Day 1    |
| 2    | Budget Analyst | Imports AY1 enrollment from historical data; enters AY2 projections   | Two-stage enrollment entry validated; stale indicators appear on Revenue and Staffing modules | Days 1-3 |
| 3    | Budget Analyst | Updates fee grid for AY2 with approved tuition rates                  | Fee grid snapshot created for this version; HT auto-calculated                                | Days 2-3 |
| 4    | HR/Payroll     | Enters new hire positions for September; updates salary augmentations | Employee records updated; step-change visible in preview                                      | Days 3-5 |
| 5    | Budget Analyst | Clicks Calculate on Enrollment & Capacity module                      | Sections calculated; capacity utilization alerts shown; stale indicator clears                | Day 5    |
| 6    | Budget Analyst | Clicks Calculate on Revenue module                                    | Monthly revenue calculated; IFRS categories assigned; total displayed                         | Day 5    |
| 7    | Budget Analyst | Clicks Calculate on Staffing & Staff Costs module                     | Monthly cost budget generated with Sep step-change; EoS/GOSI/Ajeer calculated                 | Day 6    |
| 8    | Budget Analyst | Clicks Calculate on P&L module                                        | Consolidated P&L generated; IFRS Income Statement populated                                   | Day 6    |
| 9    | Budget Analyst | Runs scenario comparisons (Base, Optimistic, Pessimistic)             | Side-by-side scenario output with delta metrics                                               | Day 7    |
| 10   | Budget Owner   | Reviews P&L, scenarios, and KPIs on Dashboard                         | Dashboard displays all KPIs; variance indicators if comparison version active                 | Days 7-8 |
| 11   | Budget Owner   | Publishes Budget version for broader review                           | Version status changes to Published; visible to all users                                     | Day 8    |
| 12   | Budget Owner   | After board approval, locks Budget version                            | Version locked; all fields read-only; audit entry created                                     | Day 10   |

#### 5.4.2 Monthly Close

| Step | Actor          | Action                                                                   | System Response                                                         | Duration       |
| ---- | -------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------- | -------------- |
| 1    | Budget Analyst | Selects current month in context bar; verifies actuals data (if entered) | Context bar filters to selected month; data displays for active version | Start of close |
| 2    | Budget Analyst | Reviews Revenue module for any adjustments                               | Revenue figures displayed by IFRS category                              | Hour 1         |
| 3    | HR/Payroll     | Confirms staff roster is current; validates any mid-month changes        | Employee records verified; changes logged in audit trail                | Hour 1-2       |
| 4    | Budget Analyst | Clicks Calculate on all planning modules                                 | All modules recalculated; P&L consolidated; stale indicators cleared    | Hour 2         |
| 5    | Budget Analyst | Generates monthly P&L report with IFRS classification                    | P&L report generated; export to Excel/PDF available                     | Hour 2-3       |
| 6    | Budget Owner   | Reviews monthly P&L and variance against Budget                          | Variance columns displayed; favorable/unfavorable color-coded           | Hour 3-4       |
| 7    | Budget Owner   | Approves close; signs off on monthly figures                             | Monthly figures finalized in current version                            | End of close   |

#### 5.4.3 Forecast Revision

| Step | Actor          | Action                                                                       | System Response                                                    | Duration |
| ---- | -------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------ | -------- |
| 1    | Budget Owner   | Creates new Forecast version (e.g., "FC2 March") by cloning current forecast | All data copied to new Draft version; independent of source        | Day 1    |
| 2    | Budget Analyst | Updates enrollment assumptions based on latest actuals                       | Enrollment modified; stale indicators appear on downstream modules | Days 1-2 |
| 3    | Budget Analyst | Adjusts scenario parameters if assumptions have changed                      | Scenario parameters updated for new forecast                       | Day 2    |
| 4    | Budget Analyst | Recalculates all modules                                                     | Revenue, costs, P&L updated with new assumptions                   | Day 2-3  |
| 5    | Budget Analyst | Compares FC2 against approved Budget                                         | Variance columns show forecast-to-budget deviation                 | Day 3    |
| 6    | Budget Owner   | Reviews variance and approves forecast                                       | Forecast published after review                                    | Day 3-4  |

#### 5.4.4 Version Comparison

| Step | Actor    | Action                                                             | System Response                                          | Duration     |
| ---- | -------- | ------------------------------------------------------------------ | -------------------------------------------------------- | ------------ |
| 1    | Any user | Selects primary version in context bar (e.g., "FC2 March")         | Data loads for selected version                          | Immediate    |
| 2    | Any user | Selects comparison version (e.g., "Budget FY2026")                 | Variance columns appear across all modules               | < 5 seconds  |
| 3    | Any user | Reviews variance at summary level (Dashboard or P&L)               | Color-coded variance indicators; key metrics highlighted | Immediate    |
| 4    | Any user | Drills into specific line item (e.g., Maternelle revenue variance) | Waterfall breakdown showing contributing drivers         | < 3 seconds  |
| 5    | Any user | Exports comparison report                                          | Excel/PDF export with variance data                      | < 10 seconds |

---

## 6. Workspace Architecture

### 6.1 Context Bar (Persistent Header)

The context bar is a fixed horizontal bar at the top of the workspace that maintains the user's working context across all planning modules. When a user navigates from the Enrollment & Capacity page to the Revenue page or Staffing & Staff Costs page, the selected context persists without requiring re-selection.

**Context Bar Elements:**

| Element            | Type              | Behavior                                                                                                                                                                 |
| ------------------ | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Fiscal Year        | Dropdown          | Selects the active fiscal year (e.g., FY2026). Filters all data across modules.                                                                                          |
| Version            | Dropdown + Badge  | Selects the active version: Actual (green badge), Budget (blue badge), Forecast (orange badge). Determines whether data is read-only (locked Actual/Budget) or editable. |
| Comparison Version | Optional Dropdown | Enables side-by-side comparison. Selecting a second version activates variance columns throughout the workspace.                                                         |
| Academic Period    | Toggle            | Switches between AY1 (Jan--Jun), AY2 (Sep--Dec), Summer, or Full Year view.                                                                                              |
| Scenario           | Dropdown          | Selects the active scenario: Base, Optimistic, Pessimistic. Only applicable to Budget/Forecast versions.                                                                 |
| Last Saved         | Timestamp         | Shows the last auto-save timestamp for the current session.                                                                                                              |

### 6.2 Navigation Modules

The workspace provides a left-side navigation panel organized into four groups with clear purpose segregation. Each module page inherits the context bar state.

#### Dashboard (Standalone)

| Module    | Purpose                                                                               | Key Data Sources                    |
| --------- | ------------------------------------------------------------------------------------- | ----------------------------------- |
| Dashboard | Executive KPIs, P&L summary, alerts, enrollment trends. Read-only cross-cutting view. | All modules (read-only aggregation) |

#### Planning

| Module                 | Purpose                                                                                                                                                                                                                                                                                                 | Key Data Sources                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Version Management     | Create, edit, delete, lock, unlock, archive, and compare budget versions. Full CRUD lifecycle management.                                                                                                                                                                                               | budget_versions, audit trail                                                                           |
| Enrollment & Capacity  | Student headcount by grade, nationality, tariff; historical trends; cohort progression; class sections, utilization thresholds, recruitment slots. Deals ONLY with students, headcount, cohorts, sections, and utilization -- fee grids, tariff categories, and discount policies remain under Revenue. | enrollment CSVs, ENROLLMENT_HEADCOUNT, ENROLLMENT_DETAIL, CLASS_CAPACITY                               |
| Revenue                | Fee grids, discount policies, revenue engine, monthly revenue forecast                                                                                                                                                                                                                                  | FEE_GRID, DISCOUNTS, OTHER_REVENUES, REVENUE_ENGINE                                                    |
| Staffing & Staff Costs | Curriculum grilles, teaching hours, FTE requirements, subject-level staffing, employee roster, salary components, GOSI, Ajeer, EoS provisions, monthly cost budget. FTE requirements from DHG directly feed staff cost calculations.                                                                    | DHG grilles, Staff_Summary, Staffing_By_Subject, Staff Master Data, salary components, statutory costs |
| P&L & Reporting        | IFRS Income Statement, monthly P&L, consolidated budget                                                                                                                                                                                                                                                 | IFRS Mapping, IFRS Income Statement                                                                    |
| Scenarios              | Scenario parameters, side-by-side comparison, sensitivity analysis                                                                                                                                                                                                                                      | SCENARIOS sheet, all calculation engines                                                               |

#### Master Data

| Module                      | Purpose                                                                                                                   | Key Data Sources     |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Chart of Accounts & Centers | IFRS-compliant account structure, profit centers, cost centers                                                            | Configuration tables |
| Academic Years & Grades     | Calendar configuration with AY1/AY2 periods, fiscal year mapping, grade levels with band grouping and capacity parameters | Configuration tables |
| Reference Data              | Nationality, tariff, and department reference data                                                                        | Configuration tables |
| Assumptions & Parameters    | VAT rate, discount rates, GOSI rates, Ajeer levies, and other configurable parameters                                     | Configuration tables |

#### Admin

| Module          | Purpose                                                   | Key Data Sources                     |
| --------------- | --------------------------------------------------------- | ------------------------------------ |
| User Settings   | User preferences, RBAC, user management                   | User configuration, role assignments |
| Audit Trail     | Simple audit log list view with basic date filtering (v1) | Audit log entries                    |
| System Settings | System parameters, import/export                          | System configuration                 |

**Context bar vs. Version Management clarification:** The context bar version dropdown (Section 6.1) selects the active working version for data display and editing across all modules. The Version Management module (under Planning) manages the version lifecycle -- creating, deleting, locking, comparing, and archiving versions.

---

## 7. Version Management System

### 7.1 Version Types

| Version Type | Purpose                                                    | Editability                                                                         | Color Badge |
| ------------ | ---------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------- |
| Actual       | Recorded financial results from closed periods             | Read-only after period close; import or manual entry during open period             | Green       |
| Budget       | Approved annual plan locked after board approval           | Editable during preparation; locked after approval; requires unlock with audit note | Blue        |
| Forecast     | Rolling re-forecast based on actuals + forward projections | Always editable; supports multiple iterations (FC1, FC2, FC3...)                    | Orange      |

### 7.1.1 Version Data Source

**Actual versions** are populated by the Excel/CSV import service (`data_source = IMPORTED`). Calculation engines are disabled for these versions. **Budget and Forecast versions** are populated by the calculation engines (`data_source = CALCULATED`). Direct imports are rejected.

This ensures that confirmed financial actuals and planning projections follow separate, non-overlapping data paths. The enforcement is at the API layer: calculation endpoints return `409 Conflict` for IMPORTED versions; import endpoints return `409 Conflict` for CALCULATED versions.

**Actual versions cannot be cloned.** The clone operation is restricted to Budget and Forecast versions.

### 7.2 Version Lifecycle

- **Draft:** Version is being prepared. All fields are editable. Not visible to read-only users.
- **Published:** Version is finalized and visible to all users. Data is locked by default.
- **Locked:** Version cannot be modified without explicit unlock action by an authorized user, which creates an audit entry.
- **Archived:** Historical version preserved for reference. Fully read-only.

### 7.2.1 Period Management (Fiscal Periods)

Beyond version-level status, the system manages individual calendar months through `fiscal_periods`. Each month in a fiscal year carries a **period status**:

- **Draft** (default): The budget or forecast version's numbers apply for this month.
- **Locked**: Confirmed actuals for this month have been imported and approved. The system serves data from the designated Actual version (`actual_version_id`) rather than the planning version.

Period locking enables a **Latest Estimate** view: a hybrid of confirmed actuals for past months and projected figures for future months. Only Admin/BudgetOwner may lock a period. Locking is one-way (irreversible without creating a new Actual version).

### 7.3 Comparison Engine

When a user selects a primary version and a comparison version in the context bar, every data table in the workspace adds variance columns:

- **Absolute Variance:** Primary -- Comparison (in SAR).
- **Percentage Variance:** (Primary -- Comparison) / |Comparison| x 100.
- **Color Coding:** Green for favorable variances, red for unfavorable, based on line-item nature (revenue favorable = positive; cost favorable = negative).
- **Drill-down:** Clicking a variance cell opens a waterfall breakdown showing contributing drivers.

### 7.4 Version Management Functional Requirements

The Version Management module (accessible from the Planning group in navigation) provides full lifecycle management for budget versions. The context bar version dropdown selects the active working version; the Version Management module manages the version lifecycle.

- FR-VER-001 [MUST]: Create a new version (Budget or Forecast) by specifying name, type, and optional base data copy from an existing version. New versions start in Draft status.
- FR-VER-002 [MUST]: Delete draft versions. Published, Locked, and Archived versions are immutable financial records and cannot be deleted.
- FR-VER-003 [MUST]: Version lifecycle transitions follow the path: Draft --> Published --> Locked --> Archived. Each transition is logged as an audit event (see FR-AUD-002). Reverse transitions (e.g., Locked --> Published) require authorized user action and an audit note.
- FR-VER-004 [MUST]: Version comparison with variance columns. User selects two versions and the system displays side-by-side data with absolute and percentage variance columns across all modules (see Section 7.3).
- FR-VER-005 [MUST]: Clone an existing version as the starting point for a new version. All data, assumptions, and configuration from the source version are copied into a new Draft version.
- FR-VER-006 [MUST]: Version metadata display and management: creation date, author, current status, description/notes, last modified date, and modification count.

---

## 8. Functional Requirements

### 8.1 Enrollment & Capacity Module

#### 8.1.1 Historical Enrollment

- FR-ENR-001 [MUST]: Import and store 5+ years of enrollment history by grade level (PS through Terminale).
- FR-ENR-002 [MUST]: Support CSV import format: `level_code`, `student_count` per academic year.
- FR-ENR-003 [MUST]: Display enrollment trends as a line chart with year-over-year comparison.
- FR-ENR-004 [MUST]: Calculate compound annual growth rate (CAGR) and moving averages by grade band.

#### 8.1.2 Enrollment Planning

- FR-ENR-005 [MUST]: Two-stage enrollment entry: Stage 1 (total headcount by grade), Stage 2 (breakdown by nationality and tariff category).
- FR-ENR-006 [MUST]: Nationality segments: Francais, Nationaux (KSA), Autres.
- FR-ENR-007 [MUST]: Tariff categories: RP (Reduced -- Staff children), R3+ (Reduced -- 3+ siblings), Plein (Full price).
- FR-ENR-008 [MUST]: Automatic delta calculation vs. prior year with visual flagging of significant changes (+/-10%).
- FR-ENR-009 [MUST]: Support for dual academic year within one fiscal year: AY1 (Jan--Jun) and AY2 (Sep--Dec), with summer break (Jul--Aug).
- FR-ENR-010 [COULD]: Cohort progression modeling: auto-suggest AY2 enrollment based on AY1 retention rates and historical lateral entry patterns.
- FR-ENR-011 [COULD]: Configurable lateral entry weight parameter for recent year (default: 0.8 weight for most recent year).
- FR-ENR-012 [COULD]: Manual input for new PS intake for AY2 (entry-level estimate).
- FR-ENR-013 [COULD]: Display 3-year historical context (N-2, N-1, Current) alongside AY1 headcount for each grade.

#### 8.1.3 Capacity Planning

> **Enrollment boundary clarification:** This subsection deals with class sections, utilization, and recruitment slots based on student headcount. Fee grids, tariff categories, and discount policies remain under the Revenue module (Section 8.2).

- FR-CAP-001 [MUST]: Sections needed = `CEILING(Enrollment / Max Class Size)`.
- FR-CAP-002 [MUST]: Three-tier utilization thresholds per grade: Plancher (70% floor), Cible (85% target), Plafond (100% ceiling).
- FR-CAP-003 [MUST]: Utilization percentage = `Enrollment / (Sections x Max Class Size)`.
- FR-CAP-004 [MUST]: Traffic-light alerts: OVER (red), OK (green), UNDER (amber).
- FR-CAP-005 [MUST]: Recruitment slot calculation: `Available spots = Plafond - Current Enrollment`.
- FR-CAP-006 [MUST]: Max class size parameters configurable per grade band: Maternelle (24), Elementaire (26), College/Lycee (variable).
- FR-CAP-007 [SHOULD]: "Near Cap" warning when utilization exceeds 95% but is not yet OVER.

### 8.2 Revenue Module

#### 8.2.1 Fee Grid Management

- FR-REV-001 [MUST]: Configurable fee grid with dimensions: Grade Level x Nationality x Tariff Category.
- FR-REV-002 [MUST]: Fee components per combination: DAI (admission fee), Tuition TTC (incl. 15% VAT), Tuition HT (excl. VAT), Term installments (T1, T2, T3).
- FR-REV-003 [MUST]: Automatic HT calculation: `Tuition HT = Tuition TTC / (1 + VAT_RATE)`.
- FR-REV-004 [MUST]: Version-controlled: each Budget/Forecast version carries its own fee grid snapshot.
- FR-REV-005 [MUST]: Separate fee grids for AY1 (Jan--Jun) and AY2 (Sep--Dec) periods within the same fiscal year.
- FR-REV-006 [MUST]: VAT exemption for Saudi nationals (Nationaux) -- VAT rate = 0% for this nationality.

#### 8.2.2 Discount Engine

- FR-REV-007 [MUST]: Configurable discount policies: Staff children (RP), 3+ siblings (R3+).
- FR-REV-008 [MUST]: Discounts expressed as percentage of Plein tariff (default: 75% of Plein for both RP and R3+).
- FR-REV-009 [MUST]: Mutually exclusive application (student receives highest applicable discount only).
- FR-REV-010 [MUST]: Discount impact analysis: total discount SAR by nationality, grade band, and tariff type.

#### 8.2.3 Revenue Engine

- FR-REV-011 [MUST]: Monthly revenue calculation with academic calendar logic: 6 months AY1 (Jan--Jun), 0 months summer (Jul--Aug), 4 months AY2 (Sep--Dec).
- FR-REV-012 [MUST]: Revenue = Enrollment Detail headcount x Net Fee (after discount) / Academic period months.
- FR-REV-013 [MUST]: IFRS 15 revenue classification: Tuition Fees, Registration & Miscellaneous, Other Revenue (ancillary services).
- FR-REV-014 [MUST]: Non-tuition revenue with configurable monthly distribution methods: Academic /10, Year-round /12, Custom months, specific period allocations.
- FR-REV-015 [MUST]: Scenario adjustment factors applied multiplicatively to base revenue (e.g., Optimistic = 1.1x, Pessimistic = 0.9x).

#### 8.2.4 Other Revenue Items (Non-Tuition)

- FR-REV-016 [MUST]: Support the following other revenue categories with configurable annual amounts and distribution methods:

**Registration Fees (distributed May--Jun):**

- Frais de Dossier -- by nationality (Francais, Nationaux, Autres)
- DPI (Droit de Premiere Inscription) -- by nationality
- Evaluation Tests -- by level (Primaire, College+Lycee), custom month weights

**DAI (Droit Annuel d'Inscription) -- distributed May--Jun:**

- DAI by nationality (Francais, Nationaux, Autres)

**Activities & Services:**

- After-School Activities / APS (Academic /10 distribution)
- Daycare / Garderie (Academic /10 distribution)
- Class Photos (Custom months: Nov--Dec weights)
- PSG Academy Rental (Year-round /12 distribution)

**Examination Fees (distributed Apr--May):**

- BAC Examination (zone rate x AY1 Terminale headcount)
- DNB Examination (zone rate x AY1 3eme headcount)
- EAF Examination (zone rate x AY1 1ere headcount)
- SIELE Examination (Custom months: Oct--Nov)

**Social Aid (Negative Revenue, Academic /10 distribution):**

- Bourses AEFE
- Bourses AESH

- FR-REV-017 [MUST]: Custom month distribution using explicit configurable weight arrays per month (e.g., weights [0,0,0,0,0,0,0,0,0,0,1,1] for Nov--Dec, or 50/50 split across two months). Weight arrays allow arbitrary monthly distribution beyond named period types.
- FR-REV-018 [MUST]: New student count assumptions by nationality and by level, linked from Assumptions parameters.
- FR-REV-019 [MUST]: Examination fee calculation based on zone rate per student x AY1 headcount for the relevant grade.

#### 8.2.5 Scholarship and Fee Collection

- FR-REV-020 [MUST]: Scholarship allocation parameter as percentage of gross tuition (configurable per scenario, default: 2% Base, 1% Optimistic, 3% Pessimistic).
- FR-REV-021 [MUST]: Fee collection rate parameter applied to revenue calculations (default: 95% Base, 98% Optimistic, 90% Pessimistic).

### 8.3 Staffing & Staff Costs Module

#### 8.3.1 Curriculum Grilles

- FR-DHG-001 [MUST]: Pre-loaded French National Curriculum grilles for all four bands: Maternelle (24h/wk), Elementaire (24h/wk), College (27--28h/wk), Lycee Voie Generale.
- FR-DHG-002 [MUST]: Subject-level hours per week per section, compliant with Education Nationale standards.
- FR-DHG-003 [MUST]: Host-country requirements: Arabic language and Islamic Studies hours per Saudi regulations.
- FR-DHG-004 [MUST]: Complementary curriculum hours (e.g., additional French, Sciences).
- FR-DHG-005 [MUST]: Maternelle grille covering domains: Mobiliser le langage, Activite physique, Activites artistiques, Premiers outils (maths), Explorer le monde.
- FR-DHG-006 [MUST]: Elementaire grille covering disciplines: Francais, Mathematiques, Langue Vivante (Anglais), EPS, Sciences, Histoire-Geographie-EMC, Arts, Enseignement Moral et Civique.
- FR-DHG-007 [MUST]: College grille per French arretes with section-level total hours (6eme through 3eme), including marge d'autonomie.
- FR-DHG-008 [MUST]: Lycee grille supporting Voie Generale structure: Tronc commun + Specialites for 2nde, 1ere, and Terminale, including autonomie hours.

#### 8.3.2 FTE Calculation Engine

- FR-DHG-009 [MUST]: `FTE = Total weekly teaching hours / 18 hours standard workload`.
- FR-DHG-010 [MUST]: HSA (overtime hours) optimization: adjustable assumptions per level to minimize FTE count while respecting labor limits.
- FR-DHG-011 [MUST]: Total DHG composition: Structural hours + Host-country hours + Complementary hours.
- FR-DHG-012 [MUST]: Support staff requirements: ASEM assistants for Maternelle (1 per class), no assistants for upper levels. Staff Summary view must show FR Teachers, ASEM/Assistants, Arabic hours, and Islamic hours per level.
- FR-DHG-013 [MUST]: Effective ORS (teaching obligation) configurable per scenario (e.g., 18h base, 19h with 1 HSA, 19.5h custom, 20h with 2 HSA).
- FR-DHG-014 [MUST]: FTE scenario comparison showing positions saved at different HSA levels (No HSA, Conservative, Custom, Full HSA).
- FR-DHG-015 [MUST]: Annual hours calculation: `Weekly hours x 36 weeks`.

#### 8.3.3 Subject-Level Staffing

- FR-DHG-016 [SHOULD]: Year-over-year comparison of FTE requirements by subject (AY1 vs. AY2).
- FR-DHG-017 [SHOULD]: Delta analysis with variance flagging.
- FR-DHG-018 [SHOULD]: Link to staff cost module: each FTE position maps to an employee or open position.

#### 8.3.4 AEFE Benchmark Comparison

- FR-DHG-019 [COULD]: H/E (Heures/Eleve) benchmark comparison against AEFE mean values per level.
- FR-DHG-020 [COULD]: AEFE FTE estimate vs. EFIR model FTE with variance display.
- FR-DHG-021 [COULD]: Average students per division calculation per level.

#### 8.3.5 Employee Master Data

- FR-STC-001 [MUST]: Employee record with 18+ fields: ID, name, function/role, department, status (Existing/New), joining date, years of service, payment method, Saudi/Ajeer designation.
- FR-STC-002 [MUST]: Status tracking: Existing (carrying over), New (starting Sep), Departed.
- FR-STC-003 [MUST]: Department assignment: Maternelle, Elementaire, College, Lycee, Administration, Vie Scolaire & Support.

#### 8.3.6 Salary Components

- FR-STC-004 [MUST]: Five core components: Base Salary, Housing Allowance (IL), Transport Allowance (IT), Responsibility Premium, HSA (overtime on 10-month basis).
- FR-STC-005 [MUST]: Monthly Gross = Sum of all five components x Hourly Percentage (for part-time adjustment).
- FR-STC-006 [MUST]: Augmentation (salary increase) field with effective date for Sep budget year adjustments.
- FR-STC-007 [MUST]: Jul--Aug HSA exclusion: HSA component is zero during summer months (Jul--Aug) for teaching staff.
- FR-STC-008 [MUST]: Part-time adjustment via Hourly Percentage field (1.0 = full-time; < 1.0 = pro-rata).

#### 8.3.7 Statutory Costs

- FR-STC-009 [MUST]: GOSI (Saudi Social Insurance): 11.75% employer contribution decomposed as 9.75% Pension + 1% SANED + 1% OHI, applicable only to Saudi nationals (currently 2 employees). Base = full salary package. The rate decomposition must be stored and displayed at the component level.
- FR-STC-010 [MUST]: Ajeer Program: Annual levy per worker configurable between Nitaqat (SAR 1,500) and non-Nitaqat (SAR 9,500) rates + monthly platform fee (SAR 160). All non-Saudi employees (166 of 168). Existing staff = 12 months; New staff = 4 months (Sep--Dec). The Nitaqat/non-Nitaqat rate selection must be configurable in Assumptions.
- FR-STC-011 [MUST]: End of Service Provision (Saudi Labor Law): 0.5 month per year for first 5 years; 1 month per year thereafter. Base = Salary + Housing + Transport + Premium (excludes HSA). Monthly accrual = Annual charge / 12. Uses YEARFRAC calculation for fractional years of service.

#### 8.3.8 Monthly Cost Budget

- FR-STC-012 [MUST]: 12-month budget grid with step-change in September when new positions start.
- FR-STC-013 [MUST]: Cost components aggregated: Local Staff Salaries (existing + new), GOSI, Ajeer, EoS Accrual.
- FR-STC-014 [MUST]: FY annual total with automatic summation.

#### 8.3.9 Additional Staff Cost Lines

- FR-STC-015 [MUST]: Contrats Locaux Remplacements (substitute/replacement teacher contracts) -- configurable annual amount with monthly distribution.
- FR-STC-016 [MUST]: Contrats Locaux 1% Masse Salariale (Formation Continue) -- continuous training obligation, calculated as percentage of payroll mass.
- FR-STC-017 [MUST]: Residents Salaires -- French expatriate staff under AEFE/resident contracts, separate from local staff payroll.
- FR-STC-018 [MUST]: Residents Logement & Billets Avion -- housing and airfare allowances for resident (expatriate) staff.
- FR-STC-019 [MUST]: Grand Total Staff Costs = Local Staff Salaries + Additional Staff Costs (Residents, Replacements, Training) + Employer Charges (GOSI + EoS + Ajeer).

#### 8.3.10 Staff Cost Analytics

- FR-STC-020 [SHOULD]: Department-level cost repartition showing headcount, FTE, monthly gross, annual salary cost, annual EoS charge, annual Ajeer, and total department cost.
- FR-STC-021 [SHOULD]: Department share as percentage of total local staff cost.
- FR-STC-022 [COULD]: Per-employee cost ratios: average monthly gross salary, average annual EoS charge, total cost per headcount, total cost per FTE.
- FR-STC-023 [COULD]: Function-level detail breakdown per department showing count, average monthly gross, total monthly, and status.
- FR-STC-024 [SHOULD]: Year-over-year salary comparison (prior AY vs. current AY) with variance and variance percentage per employee.
- FR-STC-025 [SHOULD]: Version comparison (V2 vs. V3, Budget vs. Forecast) with component-level variance and notes.

### 8.4 P&L and Financial Reporting Module

- FR-PNL-001 [MUST]: Monthly Profit & Loss statement using IFRS Function of Expense method (IAS 1).
- FR-PNL-002 [MUST]: Revenue section: IFRS 15 classification with tuition by level and tariff, registration fees, ancillary revenue.
- FR-PNL-003 [MUST]: Expense section: Cost of sales (teaching staff, curriculum materials), operating expenses (admin, facilities, utilities, insurance, marketing).
- FR-PNL-004 [MUST]: Key subtotals: Total Revenue, Total Expenses, EBITDA, Operating Profit, Net Result.
- FR-PNL-005 [MUST]: Automatic consolidation from Revenue Engine and Staff Costs Monthly Budget.
- FR-PNL-006 [MUST]: Version comparison overlay: when comparison version is active, show variance columns inline.

#### 8.4.1 IFRS Income Statement Detail

- FR-PNL-007 [MUST]: Revenue line items: Tuition fees (by level and tariff -- Reduit/Plein), Registration & re-registration fees, Activities & services, Examination fees.
- FR-PNL-008 [MUST]: Revenue from contracts with customers subtotal (IFRS 15).
- FR-PNL-009 [MUST]: Rental income separated from contract revenue per IAS 1.
- FR-PNL-010 [MUST]: Operating Expenses line items: Staff costs, Other operating expenses, Depreciation & amortization, Impairment losses on receivables (IFRS 9 Expected Credit Loss model).
- FR-PNL-011 [MUST]: Finance section: Finance income (investment returns, FX gains), Finance costs (Moyasar processing fees, bank charges, FX losses).
- FR-PNL-012 [MUST]: Net Finance Income / (Cost) subtotal.
- FR-PNL-013 [MUST]: Profit / (Loss) Before Zakat calculation.
- FR-PNL-014 [MUST]: Estimated Zakat at 2.5% on positive monthly profit (per ZATCA regulations).
- FR-PNL-015 [MUST]: Net Profit / (Loss) for the Period as final line item.

#### 8.4.2 IFRS Mapping

- FR-PNL-016 [MUST]: Detailed IFRS reclassification mapping with per-line-item monthly breakdown (12 months + annual total).
- FR-PNL-017 [MUST]: Tuition fee detail by level and tariff category (e.g., Maternelle -- Tarif Reduit, Maternelle -- Tarif Plein, Elementaire -- Tarif Reduit, etc.).
- FR-PNL-018 [MUST]: All values presented in SAR HT (excluding VAT) per IFRS 15 requirements.

### 8.5 Scenario Modeling

- FR-SCN-001 [SHOULD]: Three pre-defined scenarios: Base, Optimistic, Pessimistic.
- FR-SCN-002 [SHOULD]: Configurable adjustment parameters (5 total):
  - New Enrollment Factor (e.g., 1.0, 1.1, 0.9)
  - Retention Adjustment (e.g., +0%, +3%, -5%)
  - Attrition Rate (e.g., 2% Base, 1% Optimistic, 5% Pessimistic)
  - Fee Collection Rate (e.g., 95% Base, 98% Optimistic, 90% Pessimistic)
  - Scholarship Allocation (e.g., 2% Base, 1% Optimistic, 3% Pessimistic)
    All five parameters must be individually configurable per scenario.

- FR-SCN-003 [SHOULD]: Scenario parameters propagate through enrollment, revenue, and staff cost calculations.
- FR-SCN-004 [SHOULD]: Side-by-side scenario comparison table with absolute and percentage deltas.
- FR-SCN-005 [COULD]: Support for custom user-defined scenarios beyond the three defaults.
- FR-SCN-006 [SHOULD]: Scenario output metrics: Adjusted Total Enrollment, Total Tuition Revenue HT, Total All-Stream Revenue, Scholarship Deductions, Net Revenue, Revenue per Student, and Delta vs. Base for each metric.
- FR-SCN-007 [SHOULD]: Delta vs. Base table showing Enrollment Delta, Tuition Delta, Net Revenue Delta, and Revenue per Student Delta for each scenario.

### 8.6 Master Data Management

- FR-MDM-001 [MUST]: Chart of Accounts: IFRS-compliant account structure with account code, name, type (Revenue/Expense/Asset/Liability), and IFRS category mapping.
- FR-MDM-002 [MUST]: Profit Centers: Revenue-generating organizational units (e.g., Maternelle, Elementaire, College, Lycee).
- FR-MDM-003 [MUST]: Cost Centers: Expense-consuming organizational units (e.g., Administration, Facilities, Vie Scolaire).
- FR-MDM-004 [MUST]: Departments: Organizational hierarchy for staff assignment.
- FR-MDM-005 [MUST]: Academic Years: Calendar configuration with AY1/AY2 periods, fiscal year mapping.
- FR-MDM-006 [MUST]: Grade Levels: 15 grades (PS through Terminale) with band grouping and capacity parameters.
- FR-MDM-007 [MUST]: Nationality and Tariff reference data.
- FR-MDM-008 [MUST]: Assumption parameters: VAT rate, discount rates, GOSI rates, Ajeer levies.

### 8.7 Audit Trail and Change History

- FR-AUD-001 [MUST]: Every data modification is logged with: timestamp, user identity, field changed, old value, new value, and optional comment.
- FR-AUD-002 [MUST]: Version-level audit: creation, publication, locking, and unlocking events.
- FR-AUD-003 [MUST]: Simple audit log list view with basic date filtering, accessible from the Audit Trail module (Admin group). Displays entries in reverse chronological order with timestamp, user, action type, and affected field.
- ~~FR-AUD-004: Export audit trail to CSV for external review.~~ **Deferred to v2.**

> **v1 scope note:** v1 provides basic audit logging with a simple list view and date filtering. Advanced search, filtering by field/user/module, and CSV/Excel export capabilities are planned for v2.

### 8.8 Dashboard Module

- FR-DSH-001 [SHOULD]: Executive KPI widgets: Total Revenue (SAR HT, Full Year), Total Students (by AY with sections and grades), School Utilization (target 85%, capacity-based), Discount Rate (% of Gross Tuition).
- FR-DSH-002 [SHOULD]: P&L summary with key subtotals (Revenue, Expenses, Operating Profit, Net Result).
- FR-DSH-003 [SHOULD]: Enrollment trend charts with historical data.
- FR-DSH-004 [SHOULD]: Capacity utilization alerts aggregated across all grade levels.
- FR-DSH-005 [SHOULD]: Quick variance indicators when comparison version is active.

### 8.9 Input Management

- FR-INP-001 [MUST]: Input control panel / map showing all editable inputs across modules (total count, sheets with inputs, critical inputs, largest input blocks).
- FR-INP-002 [MUST]: Visual highlighting of editable cells (e.g., yellow highlighting for modifiable inputs).
- FR-INP-003 [MUST]: Input guidance/notes for each configurable parameter.

### Auth, Context, Export, Import (System Infrastructure)

These FRs are generated by the TDD to provide traceability for system-level functions not
explicitly enumerated in the original PRD scope sections but derived from the requirements.

| ID        | MoSCoW | Description                                                                     |
| --------- | ------ | ------------------------------------------------------------------------------- |
| FR-SEC-01 | MUST   | Authenticate users via local username/password with bcrypt hashing              |
| FR-SEC-02 | MUST   | Issue RS256-signed JWT access tokens (30 min TTL) and refresh tokens (8 hr TTL) |
| FR-SEC-03 | MUST   | Rotate refresh tokens on use; revoke on logout                                  |
| FR-SEC-04 | MUST   | Enforce role-based access control per §11.3.2 on every API endpoint             |
| FR-SEC-05 | MUST   | Return HTTP 403 on authorization failure without revealing missing permission   |
| FR-CTX-01 | MUST   | Persist workspace context (fiscal year, version, scenario, period) in URL state |
| FR-CTX-02 | MUST   | Restore workspace context correctly after page refresh                          |
| FR-CTX-03 | MUST   | Context bar updates must not reset state of any active planning module          |
| FR-EXP-01 | MUST   | Export P&L and module data to xlsx format with column formatting preserved      |
| FR-EXP-02 | MUST   | Export P&L reports to PDF (A3 landscape) via @react-pdf/renderer                |
| FR-EXP-03 | SHOULD | Export module data to CSV with UTF-8 BOM for Excel compatibility                |
| FR-EXP-04 | MUST   | Generate exports asynchronously; return job ID for polling                      |
| FR-IMP-01 | MUST   | Import employee data from Excel/CSV into a Draft version                        |
| FR-IMP-02 | MUST   | Import confirmed actuals from Excel/CSV into an Actual version                  |
| FR-IMP-03 | MUST   | Validate import data against schema before committing; return row-level errors  |
| FR-IMP-04 | MUST   | Reject imports that would overwrite a Published or Locked version               |
| FR-IMP-05 | SHOULD | Preview import diff before commit; allow partial row acceptance                 |

### Actuals Management

| ID         | MoSCoW | Description                                                                |
| ---------- | ------ | -------------------------------------------------------------------------- |
| FR-ACT-001 | MUST   | Import confirmed actuals into an Actual version via Excel/CSV              |
| FR-ACT-002 | MUST   | Block calculation engines for IMPORTED Actual versions (409 response)      |
| FR-ACT-003 | MUST   | Allow Admin/BudgetOwner to lock a fiscal period (one-way Draft→Locked)     |
| FR-ACT-004 | SHOULD | Latest Estimate: merge Locked period actuals with Draft period budget data |

---

## 9. Data Model Overview

The application database follows a normalized relational schema organized into five domains.

| Domain                | Core Tables                                                                          | Key Relationships                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Enrollment & Students | academic_years, enrollments, enrollment_detail                                       | Enrollment links to fee_grids via grade+nationality+tariff; links to academic_years via fiscal year               |
| Revenue               | fee_grids, discount_policies, monthly_revenue, other_revenue_items                   | Revenue calculated from enrollment x fee grid; discount applied per tariff; monthly allocation per calendar rules |
| Staffing              | dhg_requirements, curriculum_grilles, staffing_by_subject                            | DHG hours driven by enrollment sections; FTE drives staff cost positions                                          |
| Staff Costs           | employees, salary_components, monthly_staff_costs, eos_provisions, gosi, ajeer_costs | Employee -> salary components -> monthly costs; statutory costs calculated per employee type                      |
| Budget & Reporting    | budget_versions, monthly_budget_summary, ifrs_line_items                             | Versions aggregate revenue + costs into P&L; IFRS mapping classifies line items per IAS 1                         |

The complete entity-relationship diagram and database schema specification are provided in the Technical Design Document (separate deliverable).

### 9.1 Technology Constraints

The following constraints are mandatory for any technology selection. They document hard requirements that the implementation must satisfy regardless of the specific technology stack chosen. Final technology decisions (frameworks, databases, hosting) are made in the Technical Design Document (Phase 3 of the Planning Process).

#### TC-001: Fixed-Point Decimal Arithmetic

**Constraint:** All financial calculations must use fixed-point decimal arithmetic, not IEEE 754 binary floating-point. This is required to meet the +/-1 SAR tolerance specified in Section 16.1 (acceptance criteria 1-3).

**Rationale:** IEEE 754 floating-point cannot exactly represent many decimal fractions (e.g., 0.1, 0.01). In a system performing thousands of multiply-accumulate operations across 168 employees, 12 months, and multiple fee grid combinations, floating-point rounding errors accumulate and can exceed the 1 SAR tolerance.

**Implementation guidance:**

- If using JavaScript/TypeScript: use a decimal library (e.g., `decimal.js`, `big.js`, or `Prisma Decimal`) -- never use native `Number` for monetary values.
- If using Python: use the `decimal.Decimal` module with explicit precision context, not `float`.
- If using Java/Kotlin: use `BigDecimal` with `HALF_UP` rounding mode.
- Database layer must use `DECIMAL` column types (see TC-003).
- All intermediate calculation results must maintain full precision; rounding occurs only at presentation (see TC-004).

#### TC-002: YEARFRAC Implementation

**Constraint:** The system must implement a YEARFRAC function that matches Excel's `YEARFRAC(start_date, end_date, basis)` output for the US 30/360 convention (basis = 0), which is the default used in EFIR's End of Service calculations.

**Algorithm (US 30/360 basis):**

```
Given start_date (d1/m1/y1) and end_date (d2/m2/y2):

1. If d1 == 31, set d1 = 30
2. If d2 == 31 AND d1 >= 30, set d2 = 30
3. YEARFRAC = ((y2 - y1) * 360 + (m2 - m1) * 30 + (d2 - d1)) / 360
```

**Validation:** The implementation must produce identical results to Excel's `YEARFRAC` function for all 168 employees' joining dates against the as-of dates (Dec 31 of prior year and Dec 31 of current year). Any discrepancy exceeding 0.001 years triggers a bug report.

#### TC-003: Database Decimal Precision

**Constraint:** The database must support `DECIMAL` (or equivalent fixed-point) column types with the following minimum precision:

| Data Category         | Column Type              | Example Fields                                                     |
| --------------------- | ------------------------ | ------------------------------------------------------------------ |
| Monetary values (SAR) | `DECIMAL(15,4)`          | `base_salary`, `tuition_ttc`, `revenue_amount`, `eos_provision`    |
| Percentage rates      | `DECIMAL(7,6)`           | `discount_rate`, `vat_rate`, `gosi_rate`                           |
| Headcount / counts    | `INT` or `DECIMAL(10,0)` | `student_count`, `sections_needed`, `headcount`                    |
| Years of service      | `DECIMAL(7,4)`           | `years_of_service` (computed via YEARFRAC)                         |
| Hourly percentage     | `DECIMAL(5,4)`           | `hourly_percentage` (part-time factor, e.g., 0.5000 for half-time) |

#### TC-004: Rounding Rules

**Constraint:** Round half-up (standard arithmetic rounding) at the presentation layer only. Banker's rounding (round half-to-even) is NOT used.

**Rules:**

1. **Intermediate calculations**: Maintain full precision (minimum 4 decimal places) throughout the calculation chain. No rounding between calculation steps.
2. **Presentation/display**: Round to 2 decimal places (SAR with fils) for all displayed monetary values. Use round half-up: values ending in exactly .5 round away from zero.
3. **Storage**: Store values at full precision (`DECIMAL(15,4)`) in the database. Rounding is applied only when rendering values in the UI or export files.
4. **Summation**: Sum the full-precision values first, then round the total for display. Do NOT sum pre-rounded values (this prevents rounding drift in large aggregations).
5. **Tolerance validation**: After rounding, all displayed totals must match the Excel baseline within +/-1 SAR per line item per month (Section 16.1).

#### TC-005: Date Arithmetic and Calendar

**Constraint:** All date arithmetic uses the Gregorian calendar exclusively. The Hijri (Islamic) calendar is not used for any calculation, scheduling, or date display in v1.

**Rules:**

1. **Timezone**: All dates and timestamps are anchored to AST (UTC+3). See Scope Assumption SA-003.
2. **Fiscal year**: January 1 through December 31 (Gregorian).
3. **Academic periods**: AY1 = January through June (6 months), Summer = July through August (2 months, zero revenue/zero HSA), AY2 = September through December (4 months). These boundaries are hardcoded for v1 but should be stored as configurable parameters for future flexibility.
4. **Month boundaries**: Calendar month boundaries (1st through last day of month) determine when salary step-changes take effect.
5. **YEARFRAC dates**: All YEARFRAC calculations use Gregorian dates with the US 30/360 convention (see TC-002).
6. **Week count**: DHG annual hours use 36 academic weeks per year (FR-DHG-015). This is a configurable parameter, not derived from calendar dates.

### 9.2 Data Dictionary

The following data dictionary defines the five most critical entities in the BudFin system. Field definitions include SQL-style types with precision, constraints, and descriptions. The complete database schema is delivered in the Technical Design Document.

#### 9.2.1 Employee

Represents a staff member (teaching or non-teaching) at EFIR. Source: Staff Master Data sheet (168 records in FY2026).

| Field               | Type                                  | Constraints                                      | Description                                                                                                 |
| ------------------- | ------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `employee_id`       | `INT`                                 | `PRIMARY KEY, AUTO_INCREMENT`                    | Unique employee identifier.                                                                                 |
| `version_id`        | `BIGINT`                              | `FOREIGN KEY -> budget_versions.id, NOT NULL`    | Budget version this employee record belongs to. Each version carries its own snapshot of employee data.     |
| `name`              | `VARCHAR(200)`                        | `NOT NULL`                                       | Full name of the employee.                                                                                  |
| `function_role`     | `VARCHAR(100)`                        | `NOT NULL`                                       | Job title or function (e.g., "Professeur des ecoles", "Directeur adjoint", "ASEM").                         |
| `department`        | `ENUM(...)`                           | `NOT NULL`                                       | Organizational department: Maternelle, Elementaire, College, Lycee, Administration, Vie Scolaire & Support. |
| `status`            | `ENUM('Existing', 'New', 'Departed')` | `NOT NULL, DEFAULT 'Existing'`                   | Employment status for the fiscal year.                                                                      |
| `joining_date`      | `DATE`                                | `NOT NULL`                                       | Date the employee joined EFIR. Used in YEARFRAC calculation for EoS provision (TC-002).                     |
| `years_of_service`  | `DECIMAL(7,4)`                        | `COMPUTED`                                       | Fractional years of service = YEARFRAC(joining_date, as_of_date). Computed at query/calculation time.       |
| `payment_method`    | `VARCHAR(50)`                         | `NOT NULL`                                       | Payment method (e.g., "Bank Transfer", "Cash").                                                             |
| `is_saudi`          | `BOOLEAN`                             | `NOT NULL, DEFAULT FALSE`                        | Whether the employee is a Saudi national. Determines GOSI applicability (FR-STC-009).                       |
| `is_ajeer`          | `BOOLEAN`                             | `NOT NULL, DEFAULT TRUE`                         | Whether the employee is registered under the Ajeer program. All non-Saudi employees are Ajeer (FR-STC-010). |
| `hourly_percentage` | `DECIMAL(5,4)`                        | `NOT NULL, DEFAULT 1.0000, CHECK (> 0 AND <= 1)` | Part-time adjustment factor. 1.0000 = full-time.                                                            |

> _Salary fields are stored AES-256 encrypted (pgcrypto) per §11.3.1 and PDPL field-level encryption. See TDD `05_security.md §7.4` for the full encryption schema._

| `base_salary_encrypted` | `BYTEA` | `NOT NULL` | AES-256 encrypted monthly base salary (SAR). See §7.4 PDPL compliance. Decrypted at query time for authorized roles only (salary:view). |
| `housing_allowance_encrypted` | `BYTEA` | `NOT NULL, DEFAULT encrypted(0)` | AES-256 encrypted monthly housing allowance (SAR). |
| `transport_allowance_encrypted` | `BYTEA` | `NOT NULL, DEFAULT encrypted(0)` | AES-256 encrypted monthly transport allowance (SAR). |
| `responsibility_premium_encrypted` | `BYTEA` | `NOT NULL, DEFAULT encrypted(0)` | AES-256 encrypted monthly responsibility premium (SAR). |
| `hsa_amount_encrypted` | `BYTEA` | `NOT NULL, DEFAULT encrypted(0)` | AES-256 encrypted monthly HSA amount (SAR). NOT included in EoS base. Excluded Jul–Aug. |
| `augmentation_encrypted` | `BYTEA` | `NOT NULL, DEFAULT encrypted(0)` | AES-256 encrypted salary augmentation absolute amount (SAR). Not a rate. |
| `augmentation_effective_date` | `DATE` | `NULL` | Date the augmentation takes effect. NULL if no augmentation. |

#### 9.2.2 Fee Grid Entry

Represents a single fee combination in the tuition fee grid. Source: FEE_GRID sheet (~45+ combinations per academic period).

| Field             | Type                                      | Constraints                                                              | Description                                                       |
| ----------------- | ----------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `fee_grid_id`     | `INT`                                     | `PRIMARY KEY, AUTO_INCREMENT`                                            | Unique fee grid entry identifier.                                 |
| `version_id`      | `BIGINT`                                  | `FOREIGN KEY -> budget_versions.id, NOT NULL`                            | Budget version this fee grid belongs to (FR-REV-004).             |
| `academic_period` | `ENUM('AY1', 'AY2')`                      | `NOT NULL`                                                               | Academic period: AY1 (Jan-Jun) or AY2 (Sep-Dec).                  |
| `grade_level`     | `ENUM('PS'..'Terminale')`                 | `NOT NULL`                                                               | Grade level per Appendix A.                                       |
| `nationality`     | `ENUM('Francais', 'Nationaux', 'Autres')` | `NOT NULL`                                                               | Nationality segment. "Nationaux" are VAT-exempt (FR-REV-006).     |
| `tariff`          | `ENUM('RP', 'R3+', 'Plein')`              | `NOT NULL`                                                               | Tariff category per FR-REV-007.                                   |
| `tuition_ttc`     | `DECIMAL(15,4)`                           | `NOT NULL, CHECK (>= 0)`                                                 | Annual tuition fee including VAT (TTC) in SAR.                    |
| `tuition_ht`      | `DECIMAL(15,4)`                           | `COMPUTED`                                                               | Annual tuition fee excluding VAT: `tuition_ttc / (1 + vat_rate)`. |
| `dai`             | `DECIMAL(15,4)`                           | `NOT NULL, DEFAULT 0, CHECK (>= 0)`                                      | Annual registration fee (DAI) in SAR.                             |
| `t1`              | `DECIMAL(15,4)`                           | `NOT NULL, DEFAULT 0`                                                    | Term 1 installment amount in SAR.                                 |
| `t2`              | `DECIMAL(15,4)`                           | `NOT NULL, DEFAULT 0`                                                    | Term 2 installment amount in SAR.                                 |
| `t3`              | `DECIMAL(15,4)`                           | `NOT NULL, DEFAULT 0`                                                    | Term 3 installment amount in SAR.                                 |
|                   |                                           | `UNIQUE (version_id, academic_period, grade_level, nationality, tariff)` | Composite unique constraint.                                      |

#### 9.2.3 Budget Version

Represents a named budget version with lifecycle state. Source: Version Management System (Section 7).

| Field                | Type                                               | Constraints                                     | Description                                                                     |
| -------------------- | -------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------- |
| `id`                 | `BIGSERIAL`                                        | `PRIMARY KEY`                                   | Unique version identifier.                                                      |
| `name`               | `VARCHAR(100)`                                     | `NOT NULL`                                      | User-assigned version name.                                                     |
| `type`               | `ENUM('Actual', 'Budget', 'Forecast')`             | `NOT NULL`                                      | Version type per Section 7.1.                                                   |
| `status`             | `ENUM('Draft', 'Published', 'Locked', 'Archived')` | `NOT NULL, DEFAULT 'Draft'`                     | Lifecycle status per Section 7.2.                                               |
| `fiscal_year`        | `INT`                                              | `NOT NULL, CHECK (>= 2020 AND <= 2040)`         | Fiscal year this version covers.                                                |
| `created_by`         | `INT`                                              | `FOREIGN KEY -> users.user_id, NOT NULL`        | User who created this version.                                                  |
| `created_at`         | `TIMESTAMPTZ`                                      | `NOT NULL, DEFAULT CURRENT_TIMESTAMP`           | Creation timestamp in UTC. Displayed in AST per SA-003.                         |
| `updated_at`         | `TIMESTAMPTZ`                                      | `NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE` | Last modification timestamp.                                                    |
| `locked_at`          | `TIMESTAMPTZ`                                      | `NULL`                                          | Timestamp when locked. NULL if not yet locked.                                  |
| `locked_by`          | `INT`                                              | `FOREIGN KEY -> users.user_id, NULL`            | User who locked this version.                                                   |
| `data_source`        | `ENUM('MANUAL', 'IMPORTED')`                       | `NOT NULL, DEFAULT 'MANUAL'`                    | How data was entered. IMPORTED versions block calculation engines (FR-ACT-002). |
| `modification_count` | `INT`                                              | `NOT NULL, DEFAULT 0`                           | Increments on each data modification. Used for optimistic concurrency control.  |
| `description`        | `TEXT`                                             | `NULL`                                          | Optional description or notes (FR-VER-006).                                     |
| `source_version_id`  | `BIGINT`                                           | `FOREIGN KEY -> budget_versions.id, NULL`       | If cloned from another version (FR-VER-005). NULL for originals.                |

> _All timestamps use `TIMESTAMPTZ` (UTC+3 / AST). See TC-005 and SA-003._

> _This is a simplified schema. See TDD `03_data_architecture.md §5` for the full DDL._

#### 9.2.4 Monthly Revenue

Represents calculated monthly revenue for a specific enrollment cohort. Source: REVENUE_ENGINE sheet output.

| Field             | Type                                      | Constraints                                                    | Description                                             |
| ----------------- | ----------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------- |
| `revenue_id`      | `INT`                                     | `PRIMARY KEY, AUTO_INCREMENT`                                  | Unique revenue record identifier.                       |
| `version_id`      | `BIGINT`                                  | `FOREIGN KEY -> budget_versions.id, NOT NULL`                  | Budget version.                                         |
| `month`           | `INT`                                     | `NOT NULL, CHECK (>= 1 AND <= 12)`                             | Calendar month. Jul/Aug have zero tuition revenue.      |
| `academic_period` | `ENUM('AY1', 'AY2', 'Summer')`            | `NOT NULL`                                                     | Academic period.                                        |
| `grade_level`     | `ENUM('PS'..'Terminale')`                 | `NOT NULL`                                                     | Grade level.                                            |
| `nationality`     | `ENUM('Francais', 'Nationaux', 'Autres')` | `NOT NULL`                                                     | Nationality segment.                                    |
| `tariff`          | `ENUM('RP', 'R3+', 'Plein')`              | `NOT NULL`                                                     | Tariff category.                                        |
| `headcount`       | `INT`                                     | `NOT NULL, CHECK (>= 0)`                                       | Number of students in this cohort for this month.       |
| `gross_fee`       | `DECIMAL(15,4)`                           | `NOT NULL, CHECK (>= 0)`                                       | Gross annual fee from the fee grid in SAR.              |
| `discount_rate`   | `DECIMAL(7,6)`                            | `NOT NULL, DEFAULT 0, CHECK (>= 0 AND <= 1)`                   | Applicable discount rate as a decimal.                  |
| `net_fee`         | `DECIMAL(15,4)`                           | `NOT NULL, CHECK (>= 0)`                                       | Net annual fee after discount.                          |
| `revenue_amount`  | `DECIMAL(15,4)`                           | `NOT NULL`                                                     | Monthly revenue: `headcount * net_fee / period_months`. |
| `ifrs_category`   | `VARCHAR(50)`                             | `NOT NULL`                                                     | IFRS 15 revenue classification per FR-REV-013.          |
|                   |                                           | `UNIQUE (version_id, month, grade_level, nationality, tariff)` | Composite unique constraint.                            |

#### 9.2.5 Audit Entry

Records every data modification in the system. Source: Section 8.7 (FR-AUD-001, FR-AUD-002).

| Field         | Type                                                                         | Constraints                               | Description                                                    |
| ------------- | ---------------------------------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------- |
| `audit_id`    | `BIGINT`                                                                     | `PRIMARY KEY, AUTO_INCREMENT`             | Unique audit entry identifier. BIGINT for high-volume logging. |
| `timestamp`   | `TIMESTAMPTZ`                                                                | `NOT NULL, DEFAULT CURRENT_TIMESTAMP`     | When the change occurred, stored in UTC. Displayed in AST.     |
| `user_id`     | `INT`                                                                        | `FOREIGN KEY -> users.user_id, NOT NULL`  | User who made the change.                                      |
| `action_type` | `ENUM('INSERT', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'IMPORT', 'CALCULATE')` | `NOT NULL`                                | Type of action performed.                                      |
| `entity_type` | `VARCHAR(50)`                                                                | `NOT NULL`                                | Name of the entity/table affected.                             |
| `entity_id`   | `INT`                                                                        | `NOT NULL`                                | Primary key of the affected record.                            |
| `version_id`  | `BIGINT`                                                                     | `FOREIGN KEY -> budget_versions.id, NULL` | Budget version context. NULL for system-level changes.         |
| `field_name`  | `VARCHAR(100)`                                                               | `NULL`                                    | Specific field changed. NULL for INSERT/DELETE.                |
| `old_value`   | `TEXT`                                                                       | `NULL`                                    | Previous value. NULL for INSERT.                               |
| `new_value`   | `TEXT`                                                                       | `NULL`                                    | New value. NULL for DELETE.                                    |
| `comment`     | `TEXT`                                                                       | `NULL`                                    | Optional comment. Required for version lifecycle transitions.  |

**Indexing guidance:** Index on `(entity_type, entity_id)`, `(timestamp)`, `(user_id, timestamp)`, and `(version_id)`. Retention: minimum 7 years. Consider table partitioning by year.

#### 9.2.6 New Schema Elements (v2.0 Architectural Update)

| Field                | Table             | Type | Description                                                                                                                                                           |
| -------------------- | ----------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data_source`        | `budget_versions` | TEXT | `CALCULATED` (calc engines) or `IMPORTED` (import service). Determines valid operations on the version.                                                               |
| `fiscal_periods`     | — (table)         | —    | Month-level period status. One row per fiscal_year + month. `status` is Draft or Locked. When Locked, `actual_version_id` points to the authoritative Actual version. |
| `actuals_import_log` | — (table)         | —    | Audit trail for Excel/CSV imports into Actual versions. One row per import run per module with source file, validation status, and row counts.                        |

### 9.3 API Contract Guidance

Full API contracts (endpoint specifications, request/response schemas, authentication flows) are deferred to the Technical Design Document. This section documents the high-level interface boundaries.

#### 9.3.1 Frontend-Backend Interface

- **Protocol**: RESTful API over HTTPS with JSON request/response payloads.
- **Authentication**: Token-based authentication (JWT or equivalent). Session state maintained server-side or via secure HTTP-only cookies.
- **Authorization**: Role-based access control (RBAC) with four roles: Admin, Budget Owner, Editor, Viewer (Section 11).
- **Versioning**: API versioned via URL prefix (e.g., `/api/v1/`) to support future backward-compatible evolution.
- **Error responses**: Structured JSON error objects with error code, human-readable message, and field-level validation details.

#### 9.3.2 Calculation Engine Interface

- **Execution model**: Server-side calculation, triggered by an explicit "Calculate" button per planning module (Section 12). Calculations are NOT auto-triggered on data change.
- **Request**: Module identifier + version ID + optional parameters.
- **Response**: Calculation status (success/error), summary metrics, validation warnings, and error details with field-level links.
- **Idempotency**: Repeated calculation requests with unchanged inputs produce identical outputs.
- **Stale state**: The API returns a `stale` flag when module inputs have changed since the last calculation.

#### 9.3.3 Data Import Interface

- **Upload endpoint**: Accepts CSV (`.csv`) and Excel (`.xlsx`) file uploads with multipart form encoding.
- **Validation response**: Synchronous validation returning row-level errors, warnings, and a summary before committing.
- **Two-phase import**: Phase 1 = upload + validate (returns preview). Phase 2 = confirm + commit. User can cancel after Phase 1 without side effects.
- **File size limit**: Maximum 10 MB per upload.

#### 9.3.4 Export Interface

- **Formats**: Excel (`.xlsx`), PDF, and CSV for all reports and data views.
- **Generation**: Asynchronous generation for large datasets. API returns a job ID; client polls or receives notification.
- **Download**: Temporary signed URL for file download, expiring after 1 hour.
- **Scope**: Exports respect the current context bar state (fiscal year, version, academic period, scenario).

### 9.4 Data Flow Description

This section documents the end-to-end calculation chain that transforms raw input data into financial outputs.

#### 9.4.1 Calculation Chain Overview

```
                            +-------------------+
                            |  Enrollment Data  |
                            |  (Headcount by    |
                            |  Grade/Nat/Tariff)|
                            +--------+----------+
                                     |
                      +--------------+--------------+
                      |                             |
                      v                             v
            +---------+----------+      +-----------+---------+
            |   Revenue Engine   |      |     DHG Engine      |
            | Enrollment x Fee   |      | Sections x Grille   |
            | Grid = Monthly     |      | Hours = FTE         |
            | Revenue            |      | Requirements        |
            +--------+-----------+      +-----------+---------+
                     |                              |
                     |                              v
                     |                  +-----------+---------+
                     |                  |  Staff Cost Engine  |
                     |                  | Employees x Salary  |
                     |                  | Components +        |
                     |                  | Statutory Costs     |
                     |                  | = Monthly Staff     |
                     |                  |   Costs             |
                     |                  +-----------+---------+
                     |                              |
                     +---------------+--------------+
                                     |
                                     v
                          +----------+----------+
                          |  P&L Consolidation  |
                          |  Revenue + Staff    |
                          |  Costs + Other =    |
                          |  IFRS Income        |
                          |  Statement          |
                          +---------------------+
```

#### 9.4.2 Stage 1: Enrollment to Revenue

**Input:** Enrollment detail (headcount by grade x nationality x tariff) + fee grid + discount policies.

**Process:** For each enrollment detail row, look up matching fee grid entry; determine applicable discount rate (mutually exclusive, highest only); calculate net fee; apply VAT exemption for Nationaux; calculate monthly revenue by dividing by period months (6 for AY1, 4 for AY2); summer months = zero; non-tuition revenue uses configured distribution methods; classify per IFRS 15 categories.

**Output:** `monthly_revenue` table with per-cohort, per-month revenue amounts and IFRS classifications.

#### 9.4.3 Stage 2: Enrollment to DHG to FTE

**Input:** Enrollment headcount by grade + curriculum grilles + HSA optimization parameters.

**Process:** Calculate sections per grade: `CEILING(enrollment / max_class_size)`; multiply subject hours by sections for total weekly teaching hours; compute total DHG; calculate FTE: `total_dhg_hours / effective_ORS`; adjust with CEILING per level; calculate annual hours (36 weeks); add ASEM for Maternelle; run capacity utilization check.

**Output:** FTE requirements by level and subject type, sections needed by grade, capacity utilization alerts.

#### 9.4.4 Stage 3: FTE and Employees to Staff Costs

**Input:** FTE requirements + employee master data (168 records) + salary components + statutory cost parameters.

**Process:** For each employee, for each month: calculate adjusted gross with part-time factor; apply new position rules (zero Jan-Aug); HSA exclusion Jul-Aug; augmentation from Sep; calculate GOSI for Saudi nationals; calculate Ajeer for non-Saudi; calculate EoS provision using YEARFRAC; add additional staff cost lines; compute grand total.

**Output:** `monthly_staff_costs` table with per-employee, per-month cost breakdown.

#### 9.4.5 Stage 4: Consolidation to P&L

**Input:** Monthly revenue + monthly staff costs + other operating expenses + finance items + IFRS mapping rules.

**Process:** Aggregate revenue by IFRS 15 category; aggregate expenses by IFRS category; compute subtotals (Total Revenue, Total Expenses, EBITDA, Operating Profit); add finance section; calculate Profit Before Zakat; estimate Zakat at 2.5% on positive profit; calculate Net Profit/(Loss); apply IFRS reclassifications.

**Output:** Monthly P&L statement (12 months + annual total) with IFRS-compliant line items.

#### 9.4.6 Scenario Overlay

Scenarios apply adjustment factors at the input stage, then propagate through the entire calculation chain. The scenario engine does NOT create separate data copies -- it applies multiplicative factors at calculation time and stores scenario-specific outputs alongside the base version.

---

## 10. Calculation Engine Specifications

The application must faithfully reproduce all calculations currently embedded in the four Excel workbooks. Below are the critical calculation algorithms.

### 10.1 Revenue Calculation

For each enrollment detail row (grade x nationality x tariff), the system calculates:

1. **Gross Fee** from the fee grid (by grade, nationality, tariff, academic year period)
2. **Applicable Discount Rate** (RP or R3+ as % of Plein, mutually exclusive -- highest applicable)
3. **Net Fee** = Gross Fee x (1 - Discount Rate) for discounted tariffs
4. **Monthly Revenue** = Headcount x Net Fee / Period months (6 for AY1, 4 for AY2)
5. **Summer months** (Jul--Aug) = 0

Non-tuition revenue uses configurable distribution methods:

- **Academic /10:** Spread across 10 academic months (Jan--Jun, Sep--Dec)
- **Year-round /12:** Equal monthly spread across all 12 months
- **Custom months:** User-defined weights for specific months (e.g., May--Jun 50/50, Apr--May 50/50)
- **Specific period:** Allocated to named months only

### 10.2 Staff Cost Calculation

For each employee per month:

1. **Monthly Adjusted Gross** = (Base + Housing + Transport + Premium + HSA) x Hourly Percentage
2. **New positions** contribute zero cost for Jan--Aug and full cost Sep--Dec
3. **HSA exclusion** during Jul--Aug for teaching staff
4. **Augmentation** applied from Sep onwards (current salary + augmentation amount)
5. **GOSI** applies at 11.75% only for Saudi nationals (Ajeer workers exempt)
6. **Ajeer costs** are annualized for existing staff (12 months) or prorated for new staff (4 months)
7. **End of Service accrual** = Annual FY charge / 12

### 10.3 End of Service Formula

````text
Years of Service (YoS) = YEARFRAC(Joining Date, As-of Date)
EoS Base = Base Salary + Housing + Transport + Premium (excludes HSA)

If YoS <= 5:
    Provision = EoS Base / 2 x YoS

If YoS > 5:
    Provision = (EoS Base / 2 x 5) + EoS Base x (YoS - 5)

Annual FY Charge = EoS(Dec Current Year) - EoS(Dec Prior Year)
Monthly Accrual = Annual FY Charge / 12
```text

The system must maintain both opening balance (Dec prior year) and closing balance (Dec current year) to calculate the annual charge.

### 10.4 Capacity Planning

```text
Sections Needed = CEILING(Enrollment / Max Class Size)
Utilization % = Enrollment / (Sections x Max Class Size)
Alert:
    OVER     if Enrollment > Plafond (100%)
    Near Cap if Utilization > 95%
    OK       if Enrollment between Plancher and Plafond
    UNDER    if Enrollment < Plancher (70%)
```text

### 10.5 DHG FTE Calculation

```text
Total Weekly Teaching Hours = Sum of (Subject Hours per Week x Sections)
    across all subjects for the grade level

Total DHG = Structural DHG + Host-Country (Arabic + Islamic) + Complementary

Base FTE = Total DHG Hours / Effective ORS
    where Effective ORS = 18 + HSA hours (configurable)

Adjusted FTE = CEILING(Base FTE) per level

Annual Hours = Weekly Hours x 36 weeks
```text

### 10.6 Scenario Revenue Calculation

```text
Adjusted Enrollment = Base Enrollment x New Enrollment Factor
    + (Base Enrollment x Retention Adjustment)
    - (Base Enrollment x Attrition Rate)

Total Tuition Revenue = Sum of (Adjusted Enrollment x Net Fee per combination)
Total All-Stream Revenue = Tuition + Other Revenue (Registration, Activities, Exams)
Scholarship Deductions = Total Tuition Revenue x Scholarship Allocation %
Net Revenue = Total All-Stream Revenue - Scholarship Deductions
Revenue per Student = Net Revenue / Adjusted Total Enrollment
```text

---

## 11. Non-Functional Requirements

### 11.1 Performance

| Requirement | Target |
| --- | --- |
| Page load time for any module | < 1 second |
| Full module calculation after Calculate button click | < 3 seconds |
| Calculate button visual feedback (spinner/progress indicator) after click | < 200 ms |
| Version comparison report generation | < 5 seconds |
| Full staff cost recalculation (168 employees x 12 months) | < 3 seconds |
| Dashboard widget rendering (all KPI tiles + charts) | < 2 seconds |
| Data grid rendering (up to 200 rows) | < 500 ms |
| Search / filter response within data grids | < 300 ms |
| Auto-save operation (background, non-blocking) | < 500 ms |

### 11.2 Reliability

| Requirement | Target |
| --- | --- |
| Application uptime | 99.9% (< 8.76 hours unplanned downtime per year) |
| Data integrity: zero calculation discrepancies vs. Excel baseline | 100% match to 2 decimal places |
| Auto-save frequency | Every 30 seconds or on field blur |
| Transaction atomicity for calculation engine runs | All-or-nothing; partial calculation results never persisted |
| Recovery Time Objective (RTO) | < 4 hours (supports month-end close operations) |
| Recovery Point Objective (RPO) | < 24 hours (daily automated backup) |
| Backup schedule | Daily automated backup at 02:00 AST |
| Backup retention | 30 days rolling for daily backups; monthly snapshots retained for 1 year |

### 11.3 Security

#### 11.3.1 Authentication and Encryption

| Requirement | Target |
| --- | --- |
| Authentication (v1) | Secure local authentication with username/password |
| Password hashing | bcrypt with minimum cost factor 12 |
| Password policy | Minimum 12 characters, at least 1 uppercase, 1 lowercase, 1 digit, 1 special character. _Enforced at API layer via Zod schema validation in the Auth Service route handler (see TDD `02_component_design.md §4.1`)._ |
| Account lockout | Lock after 5 consecutive failed attempts; auto-unlock after 30 minutes |
| Session management | JWT tokens; access token TTL 30 minutes; refresh token TTL 8 hours |
| Session concurrency | Maximum 2 active sessions per user; oldest session terminated on new login |
| SSO integration | Deferred to v2 |
| Data encryption at rest | AES-256 |
| Data encryption in transit | TLS 1.3 |
| Sensitive field encryption | Employee salary data, personal identifiers encrypted at field level in database |

#### 11.3.2 Role-Based Access Control (RBAC) Matrix

Four roles with explicit permission assignments:

| Permission | Admin | Budget Owner | Editor | Viewer |
| --- | --- | --- | --- | --- |
| **User Management** | | | | |
| Create / edit / deactivate users | Yes | No | No | No |
| Assign roles to users | Yes | No | No | No |
| View user activity log | Yes | No | No | No |
| **System Settings** | | | | |
| Configure system settings (fiscal year, school info) | Yes | No | No | No |
| Manage master data (grades, fee structures, IFRS mappings) | Yes | No | No | No |
| **Version Lifecycle** | | | | |
| Create new version | Yes | Yes | No | No |
| Delete version (draft only) | Yes | Yes | No | No |
| Lock version | Yes | Yes | No | No |
| Archive version (Locked → Archived) | Yes | No | No | No |
| Revert to Draft (Locked → Draft, requires audit note) | Yes | No | No | No |
| Publish version (draft to published) | Yes | Yes | No | No |
| **Data Entry & Calculation** | | | | |
| Edit data in all planning modules | Yes | Yes | Yes | No |
| Trigger Calculate on any module | Yes | Yes | Yes | No |
| Edit scenario assumptions | Yes | Yes | Yes | No |
| **Viewing & Reporting** | | | | |
| View all modules (read-only) | Yes | Yes | Yes | Yes |
| View dashboards and KPIs | Yes | Yes | Yes | Yes |
| View version comparison reports | Yes | Yes | Yes | Yes |
| View audit trail / change history | Yes | No | No | No |
| **Export** | | | | |
| Export to Excel / PDF / CSV | Yes | Yes | Yes | Yes |
| **Audit** | | | | |
| View calculation audit log | Yes | Yes | No | No |
| View system access log | Yes | No | No | No |

> _External Auditor persona maps to Viewer role. External Auditors receive exported P&L reports via the Export function; they do not have direct access to the raw audit trail._

### 11.4 Usability

| Requirement | Target |
| --- | --- |
| Context bar state persistence across module navigation | 100% retention |
| Keyboard navigation for data entry grids | Full support: Tab (next cell), Enter (confirm + move down), Arrow keys (navigate), Escape (cancel edit) |
| Undo / Redo for data entry | At least 20 actions deep per session |
| Browser support | Latest 2 versions of Chrome, Edge, Safari, Firefox |
| Minimum viewport | 1280 x 720 px (no mobile requirement for v1) |
| Accessibility compliance | WCAG 2.1 AA for all interactive elements |
| Error messages | Actionable text with field-level highlighting; link to problematic field from error summary |

### 11.5 Data

| Requirement | Target |
| --- | --- |
| Audit trail retention | Minimum 7 years (per Saudi Commercial Law) |
| Backup and recovery | Daily automated backup; RPO < 24 hours |
| Export formats | Excel (.xlsx), PDF, CSV for all reports and data views |
| Data validation on input | Server-side validation for all user inputs; client-side validation for immediate feedback |
| Referential integrity | Foreign key constraints enforced at database level for all relational data |

### 11.6 Scalability

| Requirement | Target |
| --- | --- |
| Maximum concurrent users | 20 (single school finance team) |
| Historical data retention | 5+ fiscal years of historical data loaded and queryable |
| Versions per fiscal year | Up to 3 active versions (Budget, Actual, Forecast) per fiscal year |
| Employee records | 168 employees (current); system must support up to 300 without performance degradation |
| Student enrollment records | 1,500 students (current); system must support up to 2,500 without performance degradation |
| Maximum supported fiscal years | 10 (with archival to cold storage beyond 10 years) |
| Archived data retrieval | Archived fiscal years retrievable within 1 hour upon request |

### 11.7 Compliance and Regulatory

| Requirement | Target |
| --- | --- |
| Saudi PDPL (Personal Data Protection Law) | Full compliance for employee personal data (168 records containing salary, national ID, banking details) |
| PDPL data subject rights | Support data access, correction, and deletion requests within 30 days |
| PDPL consent management | Record and store employee consent for data processing; track consent withdrawal |
| Data residency | All data stored within KSA or SDAIA-approved jurisdiction |
| IFRS conformance -- IAS 1 | Financial statement presentation outputs conform to IAS 1 structure |
| IFRS conformance -- IFRS 9 | Expected Credit Loss calculations conform to IFRS 9 |
| IFRS conformance -- IFRS 15 | Revenue recognition outputs conform to IFRS 15 |
| Audit trail retention (regulatory) | 7 years per Saudi Commercial Law Article 22 |
| Financial record retention | Budget versions and calculation outputs retained for 10 years |
| Data classification | Employee salary data classified as "Confidential"; financial aggregates classified as "Internal" |

### 11.8 Localization

| Requirement | Target |
| --- | --- |
| Number format | 1,234,567.89 (English notation; comma as thousands separator, period as decimal) |
| Currency | SAR only; displayed as "SAR" prefix (e.g., SAR 1,234.56); 2 decimal places |
| Date format | DD/MM/YYYY (KSA standard) |
| Timezone | Arabia Standard Time (AST, UTC+3); all timestamps stored as UTC, displayed as AST |
| UI language (v1) | English only |
| UI language (v2, deferred) | Arabic (RTL support) and French |
| Fiscal year convention | Calendar year (January 1 -- December 31) |
| Academic year convention | September -- August (displayed as "2025-26" format) |

### 11.9 Load Testing

| Requirement | Target |
| --- | --- |
| Concurrent data entry users | 10 users with no performance degradation |
| Concurrent report viewers | 20 users with < 2 second response time |
| Full module recalculation under load | < 3 seconds while 10 users are active |
| Concurrent export operations | 5 simultaneous Excel exports within 15 seconds each |
| Peak load scenario | All 20 users active; no HTTP 5xx errors; p95 response time < 3 seconds |
| Sustained load duration | Performance targets maintained over 8-hour sustained usage |

### 11.10 Export

| Requirement | Target |
| --- | --- |
| Excel (.xlsx) export -- formatting | Preserve column widths, number formatting, headers, and cell alignment |
| Excel (.xlsx) export -- performance | Largest dataset exported within 10 seconds |
| Excel (.xlsx) export -- file size | Maximum 25 MB per exported file |
| PDF export -- formatting | Formatted report layout with headers, footers, page numbers |
| PDF export -- performance | Full P&L report generated within 15 seconds |
| CSV export -- encoding | UTF-8 with BOM for Excel compatibility |
| CSV export -- delimiter | Comma-separated per RFC 4180 |
| Export audit | All export events logged with username, timestamp, dataset name, and file format |

### 11.11 Maintainability

| Requirement | Target |
| --- | --- |
| Code coverage -- calculation engine | Minimum 80% line coverage |
| Code coverage -- overall application | Minimum 60% line coverage |
| Code coverage -- critical paths | 90% branch coverage for RBAC and financial calculations |
| API versioning | All endpoints prefixed with version (e.g., /api/v1/) |
| API documentation | OpenAPI 3.0 specification maintained for all endpoints |
| Deployment strategy | Zero-downtime deployment capability (rolling or blue-green) |
| Database migrations | Forward-only versioned migrations; rollback scripts required |
| Dependency management | No known critical or high-severity CVEs in production dependencies; monthly audit |

### 11.12 Monitoring

| Requirement | Target |
| --- | --- |
| Application health endpoint | GET /health returns status, uptime, database connectivity; responds in < 200 ms |
| Error logging | Structured JSON logs with severity levels; ERROR and FATAL trigger alerts |
| Error alerting | Email notification to system administrator within 5 minutes of any FATAL error |
| Calculation audit log | Every calculation run logs: user, module, version, input hash, output hash, duration, success/failure |
| Access logging | All authentication events logged with IP address and timestamp |
| Performance monitoring | p50, p95, p99 response times tracked per endpoint; alert when p95 exceeds 2x target |
| Storage monitoring | Alert when database size exceeds 80% of provisioned storage |
| Uptime monitoring | External synthetic check every 5 minutes; alert after 2 consecutive failures |

---

## 12. UI/UX Design Principles

### Workspace Behavior

The application must feel like an integrated workspace, not a series of separate pages. Context (fiscal year, version, scenario, academic period) is set once in the context bar and persists across all navigation. Users should never need to re-select context when switching modules.

### Speed of Interaction

Data grids must support rapid keyboard-driven entry similar to Excel. Tab moves between cells, Enter confirms and moves down, arrow keys navigate. Inline editing without modal dialogs for standard data entry.

### Information Density

Financial users expect dense, information-rich displays. Avoid excessive whitespace. Prioritize showing numbers, trends, and variances on a single screen without scrolling for key metrics.

### Visual Hierarchy for Versions

Budget, Actual, and Forecast data must be immediately distinguishable through consistent color coding (Blue/Green/Orange) applied to badges, column headers, and row backgrounds when comparison mode is active.

### Progressive Disclosure

Show summary-level data by default (e.g., totals by band) with the ability to expand into detail (by grade, by nationality, by tariff). This applies to enrollment, revenue, and staff cost views.

### Calculation Workflow

Each planning module (Enrollment & Capacity, Revenue, Staffing & Staff Costs, P&L & Reporting, Scenarios) has an explicit **Calculate** button in the module toolbar. Calculations are NOT triggered automatically on data change.

**Calculate button behavior:**

1. Saves current module data (equivalent to manual save).
2. Runs the calculation engine for the module (e.g., revenue engine, staff cost engine, capacity engine).
3. Displays validation results and highlights any errors or warnings.

**Data entry auto-save:** Input fields auto-save on field blur and every 30 seconds (existing NFR preserved). Auto-save persists data but does NOT trigger recalculation.

**Stale state indicator:** A visual indicator (e.g., badge or banner) shows when module data has changed since the last calculation, alerting the user that displayed outputs may not reflect the latest inputs.

**Post-calculation feedback:**
- On success: confirmation message with summary of changes (e.g., "Revenue recalculated -- Total Revenue: 42.3M SAR").
- On error: error summary with links to problematic fields (e.g., "3 validation errors found -- click to navigate").

**Rationale:** This pattern gives users explicit control over when calculations run, prevents confusion from partial auto-updates during complex data entry sessions, and matches the familiar Excel workflow where users press F9 or click Calculate to recalculate.

---

## 13. Data Migration Strategy

### 13.1 Source Files

| Source File | Target Module | Migration Approach |
| --- | --- | --- |
| enrollment_2021-22.csv through 2025-26.csv | Enrollment (Actual Versions) | Direct CSV import; map level_code to grade_level enum. **Note (v2.0 architectural update):** Enrollment CSVs (2021-22 through 2025-26) are loaded as **Actual budget versions** rather than the `enrollment_historical` table. Each CSV creates one `budget_versions` row (`type='Actual'`, `data_source='IMPORTED'`, `status='Locked'`) and populates `enrollment_headcount` per grade per academic period. The `enrollment_historical` table is deprecated (v1.1 removal). Trend queries use `enrollment_headcount JOIN budget_versions WHERE type='Actual'`. |
| 01_EFIR_Revenue_FY2026_v3.xlsx | Enrollment & Capacity, Revenue | Parse ASSUMPTIONS, FEE_GRID, DISCOUNTS, ENROLLMENT sheets; create initial Budget version |
| 02_EFIR_DHG_FY2026_v1.xlsx | Staffing & Staff Costs (DHG) | Import curriculum grilles and enrollment-to-FTE parameters |
| EFIR_Staff_Costs_Budget_FY2026_V3.xlsx | Staffing & Staff Costs | Import all 168 employee records with salary components; import EoS, GOSI, Ajeer calculations |
| EFIR_Consolidated_Monthly_Budget_FY2026.xlsx | P&L & Reporting | Import IFRS mapping structure and Income Statement template |

### 13.2 Sheet-Level Mapping

**01_EFIR_Revenue_FY2026_v3.xlsx (12 sheets):**

| Sheet | Target | Key Data |
| --- | --- | --- |
| INPUT_MAP | Input Management | 694 total inputs, 10 sheets with inputs, 24 critical inputs |
| ASSUMPTIONS | Master Data / Assumptions | 24 configurable parameters (fiscal year, VAT, discounts, enrollment projections, fees, exam rates) |
| FEE_GRID | Revenue / Fee Grid | 45+ fee combinations across 3 nationalities x 15 grades x 3 tariffs, for AY1 and AY2 |
| DISCOUNTS | Revenue / Discounts | Discount policy rates and rate cards by nationality and level |
| HISTORICAL | Enrollment / Historical | 5-year enrollment data (2021-22 through 2025-26) for 15 grades |
| ENROLLMENT_HEADCOUNT | Enrollment / Planning | Stage 1: AY1 and AY2 headcount by grade with historical context |
| ENROLLMENT_DETAIL | Enrollment / Planning | Stage 2: Nationality x Tariff breakdown with overridable proportions |
| CLASS_CAPACITY | Enrollment & Capacity / Capacity Planning | Grade-level capacity with Plancher/Cible/Plafond thresholds |
| OTHER_REVENUES | Revenue / Other | 15+ line items with distribution methods and monthly breakdown |
| REVENUE_ENGINE | Revenue Engine | Monthly revenue output by IFRS category |
| EXECUTIVE_SUMMARY | Dashboard | KPI aggregation and analytics |
| SCENARIOS | Scenario Modeling | 5 adjustment parameters with 3 scenario outputs |

**02_EFIR_DHG_FY2026_v1.xlsx (9 sheets):**

| Sheet | Target | Key Data |
| --- | --- | --- |
| Parameters | Master Data | School info, academic year, curriculum type, weeks/year, HSA assumptions |
| Enrollment | Enrollment & Capacity / Capacity Planning | Grade-level capacity with alerts |
| Grille_Maternelle | DHG / Curriculum | 5 domains, PS/MS/GS hours |
| Grille_Elementaire | DHG / Curriculum | 8 disciplines, CP-CM2 hours |
| DHG_College | DHG / Curriculum | Per-subject hours x sections for 6eme-3eme |
| DHG_Lycee | DHG / Curriculum | Tronc commun + Specialites for 2nde/1ere/Terminale |
| DHG_Optimization | DHG / FTE | HSA scenarios, FTE comparison, savings analysis |
| Staff_Summary | DHG / Summary | Staff count by level with ASEM, Arabic, Islamic breakdown |
| Staffing_By_Subject | DHG / Subject | AY1 vs AY2 FTE by subject type with delta |

**EFIR_Staff_Costs_Budget_FY2026_V3.xlsx (8 sheets):**

| Sheet | Target | Key Data |
| --- | --- | --- |
| Assumptions & Inputs | Master Data / Assumptions | Headcount, Ajeer rates, GOSI rates, additional cost lines, new positions |
| Staff Master Data | Staffing & Staff Costs / Employees | 168 employee records with 18 fields each |
| FY2026 Monthly Budget | Staffing & Staff Costs / Monthly | 12-month cost grid with Sep step-change |
| End of Service | Staffing & Staff Costs / EoS | Per-employee EoS with opening/closing balances |
| GOSI | Staffing & Staff Costs / Statutory | Per-employee GOSI with Saudi/Ajeer designation |
| Ajeer Costs | Staffing & Staff Costs / Statutory | Per-employee Ajeer levy and platform fees |
| YoY Comparison | Staffing & Staff Costs / Analytics | Year-over-year salary variance per employee |
| Analysis & Summary | Staffing & Staff Costs / Analytics | Department breakdown, cost structure, per-employee ratios |

**EFIR_Consolidated_Monthly_Budget_FY2026.xlsx (2 sheets):**

| Sheet | Target | Key Data |
| --- | --- | --- |
| IFRS Mapping | P&L / IFRS Mapping | Detailed line-item reclassification per IAS 1 |
| IFRS Income Statement | P&L / Income Statement | Monthly P&L with Revenue, OpEx, Finance, Zakat |

### 13.3 Data Cleansing Strategy

Before any data is migrated, all four Excel workbooks and five enrollment CSVs must undergo a systematic quality audit producing a **Source Data Quality Report**.

**Error Categories:**

| Category | Code | Description | Examples |
| --- | --- | --- | --- |
| Formula Error | FE | Excel formula returns an error value | `#REF!`, `#N/A`, `#VALUE!`, `#DIV/0!` |
| Circular Reference | CR | Cell participates in a circular dependency chain | A1 references B1 which references A1 |
| Hardcoded Override | HO | Literal value where a formula is expected | Fee cell contains `45000` instead of formula |
| Type Mismatch | TM | Cell contains wrong data type | Grade enrollment stored as text `"25"` instead of number |
| Missing Value | MV | Required cell is blank | Employee joining_date is empty |
| Out-of-Range Value | OR | Value outside domain boundaries | Discount percentage > 100%, negative enrollment |
| Encoding Issue | EI | Character encoding problems in CSV files | Malformed UTF-8 in French diacritics |

**Decision Framework for Flagged Issues:**

- **Option A -- Fix in Source:** Error is clearly a mistake; Finance team corrects source workbook before migration.
- **Option B -- Flag and Exclude:** Error exists but does not affect migrated data; excluded from validation baseline with documentation.
- **Option C -- Correct in Target:** Source is incorrect but correct value determinable; migration script applies correction with documentation.

**Known Issues:**

| # | Source | Issue | Disposition |
| --- | --- | --- | --- |
| KI-001 | Revenue workbook, EXECUTIVE_SUMMARY | `#REF!` error in summary cell | Option B -- exclude from validation baseline |
| KI-002 | All workbooks | Inconsistent version suffixes (v1, v3, V3) | Option C -- normalize in import metadata |
| KI-003 | Enrollment CSVs | French diacritics in level names | Option C -- map to ASCII enum values |

### 13.4 Validation Protocol

1. **Enrollment Reconciliation:** Every grade-level headcount for every academic year (2021-22 through 2025-26) must exactly match CSV source. 15 grades x 5 years = 75 data points.
2. **Fee Grid Verification:** Every fee value for all 270 combinations (3 nationalities x 15 grades x 3 tariffs x 2 periods) must match within 0.01 SAR.
3. **Revenue Engine Reconciliation:** Every IFRS revenue category total must match REVENUE_ENGINE sheet for every month and annual total within +/-1 SAR per line item.
4. **Employee Record Validation:** All 168 employee records verified with 18 fields each (3,024 data points). Monetary values within 0.01 SAR; text/date fields exact match.
5. **End of Service Reconciliation:** EoS opening balance, monthly provision, and closing balance per employee within +/-1 SAR.
6. **P&L Reconciliation:** Every IFRS Income Statement line item matches for every month and annual total within +/-1 SAR.

### 13.5 Data Transformation Rules

**Level Code Mapping:** All grade-level variations (e.g., `6ème`, `6eme`, `6e`, `Sixième`) mapped to canonical enum values. Unmapped values halt migration with Blocker error.

**Date Format Transformations:** Excel serial dates converted via epoch; `DD/MM/YYYY` parsed day-first; ambiguous formats default to French locale convention; all dates stored as ISO 8601 (`YYYY-MM-DD`).

**Currency Rounding:** All monetary values rounded to 2 decimal places using round-half-up at point of import. Rounding differences up to 0.01 SAR per value are acceptable.

**Employee Status Inference:** `joining_date < 2026-01-01` = Existing; `joining_date >= 2026-01-01` = New; `end_date <= current_date` = Departed.

**Percentage Storage:** All percentages stored as decimal fractions (e.g., 11.75% stored as 0.1175). Values > 1.0 in percentage columns automatically divided by 100.

### 13.6 Rollback Plan

| Parameter | Value |
| --- | --- |
| Pre-migration backup | Full database export + bit-for-bit copies of all source files; checksum verified |
| Staging-first | Full migration on STAGING must pass all 6 validation steps before PRODUCTION |
| Maximum rollback window | 2 hours from migration start |
| Rollback authority | Finance Manager + Technical Lead (either can trigger) |
| Rollback trigger | Any Blocker-severity validation failure |

**Rollback Procedure:** STOP migration; NOTIFY stakeholders; RESTORE from pre-migration backup; VERIFY restoration; DOCUMENT incident; INVESTIGATE root cause; RE-PLAN with fixes.

**Fallback:** If migration cannot complete within Phase 6 timeline, Finance team continues with Excel workbooks. No partial migration is acceptable.

### 13.7 Parallel-Run Specification

| Parameter | Value |
| --- | --- |
| Duration | 2 weeks during Phase 6, aligned with month-end close |
| Primary system of record | Excel (until parallel run passes) |
| Tolerance | +/-1 SAR per line item per month; enrollment headcounts exact match |

**Pass Criteria:** 100% of revenue, staff cost, EoS, GOSI/Ajeer, and P&L line items within tolerance for every month. All enrollment headcounts exact match. No unresolved Blocker issues.

**Fail Handling:** Document variances; trace to root cause; fix and re-run; extend by up to 1 additional week if needed. If parallel run cannot pass within 3 total weeks, escalate to Fallback Procedure.

### 13.8 Historical Data Scope

**Imported:** 5 years of enrollment CSVs (read-only reference); FY2026 budget data from all 4 workbooks (editable initial Budget version).

**Not Imported:** Prior fiscal year budgets; actuals data (from ERP, out of scope); student-level detail; individual teacher timetables; Excel formatting. One-time migration, not sync.

---

## 14. Implementation Roadmap

### 14.1 Revised Timeline (30 Weeks)

| Phase | Scope | Duration | Buffer | Key Deliverables | Milestone |
| --- | --- | --- | --- | --- | --- |
| Phase 1: Foundation | Database schema, authentication, workspace shell with context bar, master data management, RBAC | 4 weeks | 0.5 week | Working skeleton with context bar, master data CRUD, authentication, RBAC | M1: Application shell deployed to staging |
| Phase 2: Enrollment & Revenue | Historical enrollment import, enrollment planning, fee grid management, discount engine, revenue calculation engine | 5 weeks | 1 week | Fully functional enrollment-to-revenue pipeline with monthly forecasts | M2: Revenue calculations match Excel baseline |
| Phase 3: Staffing & Staff Costs | DHG grilles, FTE calculation, employee master data, salary components, statutory costs (GOSI/Ajeer/EoS), monthly cost budget | 5 weeks | 1 week | Complete staffing model and staff cost budget | M3: Staff cost calculations match Excel baseline |
| Phase 4: Reporting & Versions | Version management system, P&L consolidation, IFRS mapping, comparison engine, scenario modeling | 5 weeks | 1 week | Version lifecycle, variance reports, IFRS Income Statement, scenario analysis | M4: Full calculation chain validated end-to-end |
| Phase 5: Dashboard & Analytics | Executive dashboard, KPI widgets, trend charts, capacity alerts, export functionality (Excel/PDF/CSV) | 3 weeks | 0.5 week | Production-ready dashboard with all KPIs and export | M5: Dashboard and export functionality complete |
| Phase 6: Migration & UAT | Source data audit, data cleansing, migration execution, parallel-run validation, UAT, bug fixes, training | 4 weeks | 1 week | Migrated data validated; parallel-run passed; signed-off UAT | M6: Go-live approval |

**Total estimated duration: 30 weeks (7.5 months), including 5 weeks of phase buffers.**

### 14.2 Phase Milestones and Checkpoints

Each phase has an entry checkpoint, mid-phase review, and exit gate:

**Phase 1 Entry:** PRD v2.0 signed off; development environment provisioned; tech stack selected.
**Phase 1 Mid (Week 2):** Database schema reviewed; authentication flow functional.
**Phase 1 Exit (M1):** Application skeleton deployed; all master data CRUD operational; RBAC enforced.

**Phase 2 Entry:** M1 achieved; enrollment CSV data available.
**Phase 2 Mid (Week 7):** Enrollment import functional; fee grid management complete.
**Phase 2 Exit (M2):** Revenue engine output matches Excel REVENUE_ENGINE within +/-1 SAR for all line items.

**Phase 3 Entry:** M2 achieved; Staff Costs workbook analyzed.
**Phase 3 Mid (Week 12):** Employee import functional; salary calculations verified for sample set.
**Phase 3 Exit (M3):** All 168 employees imported; EoS/GOSI/Ajeer match Excel within +/-1 SAR.

**Phase 4 Entry:** M3 achieved.
**Phase 4 Mid (Week 17):** Version lifecycle functional; P&L consolidation started.
**Phase 4 Exit (M4):** Full calculation chain (enrollment -> revenue -> staff costs -> P&L) validated.

**Phase 5 Entry:** M4 achieved.
**Phase 5 Mid (Week 22):** Dashboard KPIs rendering; export to Excel functional.
**Phase 5 Exit (M5):** All dashboard widgets, charts, and export formats operational.

**Phase 6 Entry:** M5 achieved; source data audit complete.
**Phase 6 Mid (Week 26):** Staging migration complete; parallel-run started.
**Phase 6 Exit (M6):** Parallel-run passed; UAT signed off; go-live approved.

### 14.3 Phase Dependencies

````

Phase 1 (Foundation)
|
+---> Phase 2 (Enrollment & Revenue)
| |
| +---> Phase 3 (Staffing & Staff Costs)
| | |
| | +---> Phase 4 (Reporting & Versions)
| | |
+-------- +-------- +--------+---> Phase 5 (Dashboard & Analytics)
|
+---> Phase 6 (Migration & UAT)

```

Phase 2 requires Phase 1 (database schema, auth). Phase 3 requires Phase 2 (enrollment data feeds DHG). Phase 4 requires both Phase 2 and Phase 3 (P&L consolidates revenue + costs). Phase 5 requires Phase 4 (dashboard aggregates from all modules). Phase 6 requires Phase 5 (full system must be functional for UAT).

### 14.4 Resource Plan

| Role | Count | Phase Allocation | Key Responsibilities |
| --- | --- | --- | --- |
| Tech Lead / Architect | 1 | All phases | Architecture decisions, code review, calculation engine design, data model |
| Full-Stack Developer | 2 | Phases 1-5 | Frontend and backend implementation, API development |
| QA Engineer | 1 | Phases 2-6 (joins Phase 2) | Test planning, regression testing, Excel baseline comparison, UAT support |
| UX Designer | 0.5 | Phases 1, 5 (part-time) | Wireframes, component design, usability testing |
| DBA / Data Engineer | 0.5 | Phases 1, 6 (part-time) | Schema design, migration scripts, data quality audit, performance tuning |
| Project Manager | 1 | All phases | Sprint planning, risk tracking, stakeholder communication |
| Finance SME (EFIR) | 0.25 | All phases (advisory) | Domain validation, calculation review, UAT participation |

**Total: ~6.25 FTE at peak (Phases 2-4).**

### 14.5 MVP / Target / Stretch Tiers

If timeline compression is required, features are organized into three tiers:

**MVP (Minimum Viable Product -- must ship):**
- All [MUST] FRs: Enrollment, Revenue Engine, Staff Costs, P&L, Version Management (create/lock/compare), Audit logging
- Core calculation engine with +/-1 SAR accuracy
- Data migration with validation
- Basic RBAC (Admin, Editor, Viewer)
- Data export (Excel only)

**Target (Full v1 delivery):**
- All [MUST] + [SHOULD] FRs: Scenarios, Dashboard KPIs, department analytics, YoY comparison
- PDF and CSV export
- Budget Owner role
- Full RBAC permission matrix
- Parallel-run validation

**Stretch (Nice to have for v1):**
- All [COULD] FRs: Cohort progression, AEFE benchmarks, custom scenarios, per-employee cost ratios
- Advanced audit trail features
- Performance optimizations beyond baseline targets

### 14.6 Integrated Testing Strategy

Testing is not deferred to Phase 6. Each phase includes its own testing activities:

| Phase | Testing Activities | Tools |
| --- | --- | --- |
| Phase 1 | Unit tests for auth, RBAC, master data CRUD; integration tests for database schema | Automated test framework |
| Phase 2 | Unit tests for revenue engine; regression tests comparing output against Excel REVENUE_ENGINE sheet | Automated comparison scripts |
| Phase 3 | Unit tests for EoS/GOSI/Ajeer formulas; regression tests comparing against Excel Staff Costs workbook | Automated comparison scripts |
| Phase 4 | Integration tests for full calculation chain; version lifecycle tests; comparison engine tests | End-to-end test suite |
| Phase 5 | UI tests for dashboard rendering; export format validation; performance testing under load | Load testing tool; browser automation |
| Phase 6 | Full regression suite; parallel-run validation; UAT with finance team; acceptance criteria verification | All tools; manual UAT scripts |

**Regression Test Baseline:** From Phase 2 onward, every build runs the automated comparison suite against the Excel workbook baselines. Any regression (line item exceeding +/-1 SAR tolerance) blocks the build.

---

## 15. Risks and Mitigations

### 15.1 Risk Scoring

**Probability:** 1 (Rare, <10%) / 2 (Unlikely, 10-25%) / 3 (Possible, 25-50%) / 4 (Likely, 50-75%) / 5 (Almost Certain, >75%)

**Impact:** 1 (Negligible) / 2 (Low) / 3 (Medium) / 4 (High) / 5 (Critical)

**Risk Score** = Probability x Impact. **Critical** >= 15; **High** = 10-14; **Medium** = 5-9; **Low** = 1-4.

### 15.2 Risk Register

| ID | Risk | Prob | Impact | Score | Owner | Mitigation | Contingency |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R-001 | Calculation discrepancies between Excel and application | 4 | 5 | 20 | Tech Lead | Automated regression tests against Excel baselines from Phase 2; fixed-point decimal arithmetic (TC-001); YEARFRAC implementation validated per TC-002 | Engage external consultant for calculation audit; extend Phase 4 buffer |
| R-002 | Timeline overrun (30 weeks insufficient) | 4 | 4 | 16 | Project Manager | Phase buffers (5 weeks total); milestone gates with go/no-go decisions; MVP tier definition for structured scope deferral | Invoke MVP tier: defer [SHOULD] and [COULD] FRs; extend by up to 4 weeks using contingency budget |
| R-003 | Data quality in source Excel files | 3 | 5 | 15 | Tech Lead | Pre-migration data audit (Section 13.3); Source Data Quality Report with sign-off; known issues register | Extend Phase 6 by 2 weeks; apply Option C corrections; exclude problematic cells from validation baseline |
| R-004 | IEEE 754 precision failures (rounding errors exceeding tolerance) | 3 | 5 | 15 | Tech Lead | TC-001 mandates fixed-point decimal; TC-004 defines rounding rules; precision validation in CI pipeline | Retrofit decimal library if precision issues discovered; 3-4 week estimated rework |
| R-005 | Saudi regulatory change mid-implementation (GOSI, Ajeer, PDPL, Zakat) | 2 | 5 | 10 | CAO | Monitor GOSI/Ajeer/ZATCA announcements; configurable statutory rates in master data; PDPL compliance built into NFRs | Assess impact within 5 business days; invoke change control for affected FRs; fast-track with CAO approval |
| R-006 | YEARFRAC implementation mismatch with Excel | 3 | 4 | 12 | Tech Lead | TC-002 documents exact algorithm; validation against all 168 employees' joining dates; tolerance of 0.001 years | Manual override table for edge-case dates; escalate to CAO for business decision on rounding |
| R-007 | User resistance to BudFin adoption | 3 | 4 | 12 | Project Manager | Excel-like keyboard navigation (NFR Usability); parallel-run period; export-to-Excel for all views; training in Phase 6 | Extended parallel-run (up to 3 weeks); dedicated support during first month post-go-live |
| R-008 | Scope creep from additional requirements | 4 | 3 | 12 | Project Manager | Change Control Process (Section 4.4); MoSCoW prioritization; scope freeze at v2.0; weekly PRD review | Reject non-critical CRs during active phases; defer to v2 backlog |
| R-009 | Key personnel dependency (single Tech Lead) | 3 | 4 | 12 | Project Manager | Documentation-first culture (PRD, TDD, code comments); pair programming on critical modules; knowledge transfer sessions | Cross-train second developer on calculation engine; engage contractor for 4-week coverage |
| R-010 | Data migration integrity failure | 2 | 5 | 10 | Tech Lead | Staging-first approach (Section 13.6); 6-step validation protocol; parallel-run; automated comparison scripts | Rollback to pre-migration backup within 2 hours; re-plan migration with fixes |
| R-011 | Technology stack mismatch (wrong tech choice) | 2 | 4 | 8 | Tech Lead | Technology Constraints (TC-001 through TC-005) as hard requirements; proof-of-concept for decimal precision in Phase 1 | Pivot technology in Phase 1 (before significant code investment); 2-3 week impact |
| R-012 | Academic calendar edge cases (AY1/AY2/summer transitions) | 3 | 3 | 9 | Tech Lead | TC-005 documents all date rules; comprehensive test scenarios for transitions; edge cases PO-001 through PO-035 documented | Fix-forward in subsequent sprint; does not block other modules |
| R-013 | Performance degradation under load | 2 | 3 | 6 | Tech Lead | NFR load testing targets defined; performance testing in Phase 5; scalability NFRs (20 concurrent users) | Optimize queries and caching; acceptable given 20-user ceiling |
| R-014 | PDPL compliance gap discovered post-launch | 2 | 4 | 8 | CAO | PDPL NFRs defined (Section 11.7); data classification policy; consent management built-in | Emergency patch within 2 weeks; data residency migration if required |
| R-015 | Integration with future systems (ERP, HR) blocked by v1 design | 2 | 3 | 6 | Tech Lead | API-first design (Section 9.3); RESTful interfaces; clean data model boundaries | Refactoring cost estimated at 2-3 weeks per integration point |

### 15.3 Risk Heat Map

```

Impact -> 1-Negligible 2-Low 3-Medium 4-High 5-Critical
Prob 5
Prob 4 R-008 R-002 R-001
Prob 3 R-013 R-012 R-006,7,9 R-003,4
Prob 2 R-015 R-011,14 R-005,10
Prob 1

```

### 15.4 Risk Review Cadence

- **Weekly** during active development: Project Manager reviews risk register; updates probability/impact scores based on sprint outcomes.
- **Bi-weekly** with CAO: Escalate risks scored >= 15; review mitigation effectiveness.
- **Monthly** full risk review: All stakeholders assess new risks; retire resolved risks; update contingency plans.
- **Phase gate reviews**: Comprehensive risk assessment at each milestone (M1-M6).

### 15.5 RAID Log -- Assumptions

| ID | Assumption | Owner | Validation Method | Impact if Wrong |
| --- | --- | --- | --- | --- |
| A-001 | Regulatory freeze date of March 1, 2026 holds. GOSI (11.75%), Ajeer (SAR 9,500 + SAR 160/month), and EoS (0.5/1 month per year) rates remain unchanged through go-live. | CAO | Bi-weekly monitoring of ZATCA, Ministry of HR bulletins | R-005 triggers; recalculation required for all statutory cost lines |
| A-002 | Excel workbooks are structurally sound except for the known #REF! error on the Executive Summary sheet. No additional material formula errors exist. | Tech Lead | Pre-migration audit (Phase 1 Week 2) | R-010 triggers; Phase 2 start delayed for Excel correction |
| A-003 | The finance team (3-5 users) will be available for validation sessions and UAT. CAO available 0.5 day/week during Phases 1-5 and 2 days/week during Phase 6. | Project Manager | Confirmed in project kickoff meeting | R-007 triggers; validation bottleneck delays phase gates |
| A-004 | Single-school deployment. No multi-tenant, multi-school, or SaaS requirements for v1.0. | Project Manager | PRD v2.0 scope definition | Scope creep (R-008); architecture rework if multi-tenancy needed |
| A-005 | AEFE curriculum grilles for FY2026 are fixed and will not change mid-year. DHG hours are stable for the planning period. | CAO | AEFE directive review at project start | Staffing model recalculation; FTE and cost budget revision |
| A-006 | The technology stack selected in Phase 1 supports fixed-point decimal arithmetic, Excel export, data grid with keyboard navigation, and row-level audit logging. | Tech Lead | Phase 1 proof-of-concept (Week 1) | R-011 triggers; stack pivot adds 1-2 weeks |
| A-007 | Historical enrollment CSVs (2021-2026) are complete, correctly encoded (UTF-8), and contain no duplicate records. | Tech Lead | Data profiling in Phase 1 Week 2 | Migration script rework; enrollment trend analysis inaccurate |
| A-008 | Application will be deployed on-premises or on a private cloud instance within Saudi Arabia to comply with PDPL data residency requirements. | Tech Lead | Infrastructure decision in Phase 1 | R-014 triggers; hosting migration required |
| A-009 | Zakat calculation at 2.5% on monthly positive profit is an acceptable simplification for v1.0. External auditors may require adjustment. | CAO | Auditor consultation before Phase 6 | Manual Zakat adjustment journal entries required post-launch |
| A-010 | The +/-1 SAR tolerance is measured per line item per month, not cumulatively across the P&L. Aggregate P&L tolerance is +/-50 SAR per subtotal per month. | CAO | Acceptance criteria sign-off (Phase 1) | Acceptance testing scope changes; tighter tolerance requires more regression testing |

### 15.6 RAID Log -- Issues

| ID | Issue | Status | Owner | Date Raised | Resolution Target | Impact |
| --- | --- | --- | --- | --- | --- | --- |
| I-001 | Excel Executive Summary sheet contains #REF! error | Open | Tech Lead | March 3, 2026 | Phase 1 Week 2 (pre-migration audit) | Blocks baseline validation for consolidated P&L |
| I-002 | Technology stack not yet selected | Open | Tech Lead | March 3, 2026 | Phase 1 Week 1 | Blocks all development work |
| I-003 | YEARFRAC day-count convention not specified in PRD | Open | Tech Lead | March 3, 2026 | Phase 1 Week 4 (Calendar Rules Spec) | Blocks EoS calculation implementation in Phase 3 |
| I-004 | Rounding rules (per-month vs. annual total) not defined | Open | Tech Lead | March 3, 2026 | Phase 1 Week 4 (Calculation Spec) | Blocks revenue distribution implementation in Phase 2 |
| I-005 | PDPL compliance assessment not conducted | Open | CAO | March 3, 2026 | Phase 1 Week 3 | Blocks personal data storage design |
| I-006 | MVP/Target/Stretch tier sign-off pending | Open | CAO | March 3, 2026 | Phase 1 Week 1 (project kickoff) | Blocks scope trade-off decisions if delays occur |

### 15.7 RAID Log -- Dependencies

| ID | Dependency | Type | Source | Target | Status | Impact if Broken |
| --- | --- | --- | --- | --- | --- | --- |
| D-001 | Phase 2 depends on Phase 1 database schema and authentication | Technical | Phase 1 | Phase 2 | Pending | Phase 2 start delayed; all downstream phases shift |
| D-002 | Phase 3 depends on Phase 2 enrollment data and fee grid | Technical | Phase 2 | Phase 3 | Pending | Staff cost calculations cannot reference enrollment-driven revenue |
| D-003 | Phase 4 depends on Phase 2 revenue engine and Phase 3 staff cost engine | Technical | Phases 2, 3 | Phase 4 | Pending | Version comparison and P&L consolidation cannot be built |
| D-004 | Phase 5 depends on Phase 4 reporting engine and version management | Technical | Phase 4 | Phase 5 | Pending | Dashboard has no data source for KPIs and analytics |
| D-005 | Phase 6 depends on all prior phases completing within buffer | Schedule | Phases 1-5 | Phase 6 | Pending | UAT cannot validate incomplete features |
| D-006 | CAO availability for validation sessions (0.5 day/week Phases 1-5, 2 days/week Phase 6) | Resource | CAO | All phases | Confirmed | Validation bottleneck; phase gates cannot be passed |
| D-007 | Pre-migration Excel audit must complete before Phase 2 regression test baseline is set | Process | Phase 1 audit | Phase 2 testing | Pending | Regression tests compare against potentially incorrect baselines |
| D-008 | Technology stack decision must precede all implementation | Technical | Phase 1 Week 1 | All development | Pending | No code can be written until stack is selected |
| D-009 | Regulatory Configuration table must be designed before statutory cost implementation | Technical | Phase 1 schema | Phase 3 statutory costs | Pending | Hardcoded rates create R-005 exposure |
| D-010 | Decimal arithmetic library must be validated before financial calculations begin | Technical | Phase 1 PoC | Phases 2, 3 | Pending | R-004 (precision) cannot be mitigated without this |

---

## 16. Acceptance Criteria and Success Metrics

### 16.1 Go-Live Acceptance Criteria

1. All revenue calculations match Excel REVENUE_ENGINE output within +/-1 SAR per line item per month.
2. All staff cost calculations match Excel FY2026 Monthly Budget within +/-1 SAR per employee per month.
3. End of Service provisions match for all 168 employees within +/-1 SAR.
4. Version comparison (Budget vs. Actual) produces correct variance at P&L summary and line-item level.
5. Context bar maintains state across all module navigations with zero loss of context.
6. All data modifications are recorded in the audit trail with timestamp, user, old value, and new value.
7. IFRS Income Statement output matches the structure and totals of the consolidated budget workbook.
8. Application load time under 1 second for all modules on standard office network.

### 16.2 Post-Launch Success Metrics (6-Month)

- Budget preparation cycle reduced from 4--6 weeks to under 2 weeks.
- Zero external Excel files needed for monthly reporting.
- 100% of budget changes tracked with full audit attribution.
- Finance team satisfaction score of 4+ out of 5 on usability survey.

### 16.3 Detailed Acceptance Criteria (Top 30 FRs)

The following acceptance criteria use Given/When/Then format for the 30 most critical functional requirements. These criteria are binding for go-live (Section 16.1) and serve as the basis for QA test case derivation.

#### Revenue Calculations

**FR-REV-001 (Fee Grid):** Given a fee grid with 45+ combinations, when a valid combination is looked up, then the exact fee amount is returned with no rounding. Missing combinations produce a validation error (not silent zero). Zero-enrollment grades return 0.00 SAR revenue.

**FR-REV-003 (HT Calculation):** Given TTC and VAT rate, when HT is calculated, then `HT = TTC / (1 + VAT_RATE)` using fixed-point arithmetic. For Nationaux (VAT=0%), HT = TTC. Results match Excel within +/-1 SAR.

**FR-REV-004 (Version-Controlled Fee Grids):** Each version carries an independent fee grid snapshot. Changes to one version's fees do not affect other versions. Cloned versions receive independent copies.

**FR-REV-006 (VAT Exemption):** Nationaux (Saudi) students have VAT = 0%. Non-Saudi nationalities have VAT = 15%. Each nationality segment calculated independently in mixed cohorts.

**FR-REV-009 (Discount Mutual Exclusivity):** Only the highest applicable discount is applied. Negative or >100% discount rates are rejected. Students with no qualification receive 0% discount.

**FR-REV-011 (Monthly Revenue):** Revenue distributed across correct months: AY1 = Jan-Jun (/6), AY2 = Sep-Dec (/4), Summer = zero. Monthly sum equals annual total within +/-1 SAR.

**FR-REV-012 (Revenue Formula):** `Revenue = Headcount x Net Fee / Period Months`. Intermediate multiplication maintains full decimal precision; rounding only at final display.

**FR-REV-014 (Non-Tuition Distribution):** Academic /10 distributes across 10 academic months; Year-round /12 across all 12; custom weights must sum to 1.0 (rejected otherwise). Rounding remainder allocated to final month.

**FR-REV-020 (Scholarship):** Scholarship = Total Gross Tuition x allocation percentage. Scenario-specific rates applied independently. Zero rate produces zero deduction.

**FR-REV-021 (Fee Collection Rate):** Collectible Revenue = Total Revenue x collection rate. Scenario-specific rates. 100% rate produces zero impairment provision.

#### Staff Cost Calculations

**FR-STC-005 (Monthly Gross):** `Gross = (Base + Housing + Transport + Premium + HSA) x Hourly Percentage`. Part-time factor applied to all components. Zero components handled without errors.

**FR-STC-007 (HSA Exclusion):** HSA = 0 for Jul-Aug for teaching staff. HSA resumes September. Summer rule overrides joining date for mid-summer joiners.

**FR-STC-009 (GOSI):** `GOSI = 11.75% x full salary package` for Saudi nationals only (2 employees). Non-Saudi = 0. GOSI base includes all components.

**FR-STC-010 (Ajeer):** Existing non-Saudi: annual levy + 12 x monthly fee. New staff: prorated for months worked. Saudi employees exempt.

**FR-STC-011 (End of Service):** YoS = YEARFRAC(joining_date, as_of_date) per TC-002. EoS Base excludes HSA. <=5 years: `base/2 x YoS`; >5 years: `(base/2 x 5) + base x (YoS-5)`. Retroactive date changes trigger recalculation with audit trail.

**FR-STC-012 (Monthly Cost Budget):** Jan-Aug shows existing staff only; September step-change adds new positions. Mid-year joiners before September start from their joining month. Augmentations apply from September.

**FR-STC-006 (Augmentation):** Pre-augmentation salary Jan-Aug; post-augmentation Sep-Dec. Augmentation affects EoS base. Zero augmentation produces no step-change.

**FR-STC-008 (Part-Time):** `Gross x Hourly Percentage`. Range validated: 0.01 to 1.0. 1.0 = full-time (no reduction).

**FR-STC-019 (Grand Total):** `Grand Total = Local Salaries + Additional Costs + Employer Charges`. Annual total = sum of 12 monthly totals within +/-1 SAR.

**FR-STC-024 (YoY Comparison):** Continuing employees show variance amount and percentage. New joiners: "N/A" for prior year. Departed: "N/A" for current year.

#### Version Management

**FR-VER-001 (Create Version):** New version created in Draft; appears in context bar; audit logged. Duplicate names rejected. Base data copy creates independent snapshot.

**FR-VER-002 (Delete Version):** Draft versions deleted directly. Published, Locked, and Archived versions are immutable financial records and cannot be deleted.

**FR-VER-003 (Lifecycle Transitions):** Draft -> Published -> Locked -> Archived. Each transition logged. Reverse transitions require authorized user + audit note. Unauthorized users rejected.

**FR-VER-004 (Version Comparison):** Absolute and percentage variance calculated. Division by zero handled gracefully ("N/A"). Color-coded: green favorable, red unfavorable.

**FR-VER-005 (Clone Version):** Full data clone to new Draft. Source unaffected. Fee grids copied independently.

#### Core Platform

**FR-ENR-001 (Historical Import):** 5 years of CSV data imported; totals match source. Unknown grade codes flagged and skipped. Duplicate year imports prompt user for replace/cancel.

**FR-ENR-005 (Two-Stage Entry):** Stage 1 total headcount; Stage 2 breakdown by nationality/tariff. Stage 2 sum must match Stage 1. Zero enrollment skips Stage 2.

**FR-PNL-001 (Monthly P&L):** IFRS Function of Expense method; 12 monthly columns + annual total; Revenue + Expenses + EBITDA + Operating Profit + Net Result. Zero revenue scenario produces loss (no errors). Zakat = 2.5% on positive profit only.

**FR-AUD-001 (Audit Logging):** All data changes logged with timestamp, user, field, old/new values. Duplicate employee detection logged. Bulk operations log summary + individual entries.

**FR-CAP-001 (Sections Calculation):** `CEILING(Enrollment / Max Class Size)`. Zero enrollment = 0 sections. Enrollment at exact boundary produces correct count. Near-boundary changes trigger notification.

#### Cross-Cutting

**Rounding Precision (PO-013):** All calculations use fixed-point decimal arithmetic. Monthly sums match annual totals within +/-1 SAR. Application results match Excel baseline within +/-1 SAR per line item per month.

**Duplicate Employee Detection (PO-003):** Flagged when 2+ of: full name (case-insensitive), department, and joining date (+/-30 days) match. User prompted to confirm or skip.

---

## 17. Appendices

### 17.1 Appendix A: Grade Level Reference

| Band | Grade Code | Full Name | Age/Year | Max Class Size |
| --- | --- | --- | --- | --- |
| Maternelle | PS | Petite Section | Age 3 | 24 |
| Maternelle | MS | Moyenne Section | Age 4 | 24 |
| Maternelle | GS | Grande Section | Age 5 | 24 |
| Elementaire | CP | Cours Preparatoire | Grade 1 | 26 |
| Elementaire | CE1 | Cours Elementaire 1 | Grade 2 | 26 |
| Elementaire | CE2 | Cours Elementaire 2 | Grade 3 | 26 |
| Elementaire | CM1 | Cours Moyen 1 | Grade 4 | 26 |
| Elementaire | CM2 | Cours Moyen 2 | Grade 5 | 26 |
| College | 6eme | Sixieme | Grade 6 | Variable |
| College | 5eme | Cinquieme | Grade 7 | Variable |
| College | 4eme | Quatrieme | Grade 8 | Variable |
| College | 3eme | Troisieme | Grade 9 | Variable |
| Lycee | 2nde | Seconde | Grade 10 | Variable |
| Lycee | 1ere | Premiere | Grade 11 | Variable |
| Lycee | Terminale | Terminale | Grade 12 | Variable |

### 17.2 Appendix B: Enrollment History (5-Year)

| Grade | 2021-22 | 2022-23 | 2023-24 | 2024-25 | 2025-26 |
| --- | --- | --- | --- | --- | --- |
| PS | 60 | 67 | 68 | 59 | 65 |
| MS | 94 | 85 | 86 | 109 | 71 |
| GS | 97 | 115 | 95 | 123 | 124 |
| CP | 118 | 103 | 126 | 116 | 126 |
| CE1 | 119 | 116 | 108 | 140 | 118 |
| CE2 | 113 | 120 | 122 | 126 | 132 |
| CM1 | 108 | 123 | 125 | 124 | 121 |
| CM2 | 98 | 112 | 126 | 145 | 121 |
| 6eme | 115 | 99 | 112 | 146 | 151 |
| 5eme | 90 | 117 | 102 | 121 | 139 |
| 4eme | 105 | 97 | 98 | 117 | 102 |
| 3eme | 118 | 107 | 117 | 105 | 105 |
| 2nde | 135 | 93 | 84 | 102 | 114 |
| 1ere | 62 | 95 | 77 | 99 | 118 |
| Terminale | 102 | 78 | 95 | 98 | 95 |
| **TOTAL** | **1,514** | **1,445** | **1,431** | **1,530** | **1,503** |

### 17.3 Appendix C: Salary Component Structure

| Component | Description | Calculation | Included in EoS Base |
| --- | --- | --- | --- |
| Base Salary | Core monthly salary | Fixed amount per employee | Yes |
| Housing (IL) | Indemnite Logement | Fixed monthly allowance | Yes |
| Transport (IT) | Indemnite Transport | Fixed monthly allowance | Yes |
| Resp. Premium | Responsibility premium for leadership roles | Fixed amount, 0 for most staff | Yes |
| HSA | Heures Supplementaires Annuelles (overtime) | Paid on 10-month basis | No |
| Hourly % | Part-time adjustment factor | 1.0 = full-time; < 1.0 = pro-rata | Applied to gross |

### 17.4 Appendix D: Statutory Cost Rules

| Statutory Item | Applicability | Rate / Formula | Notes |
| --- | --- | --- | --- |
| GOSI | Saudi nationals only (2 employees) | 11.75% of full salary package (9.75% Pension + 1% SANED + 1% OHI) | Ajeer employees are exempt |
| Ajeer Levy | All non-Saudi employees (166) | Annual levy per worker (SAR 9,500 non-Nitaqat) | Amount configurable in Assumptions |
| Ajeer Platform Fee | All non-Saudi employees | Monthly fee per worker (SAR 160) | Amount configurable in Assumptions |
| End of Service | All employees | <=5 yrs: 0.5 month/yr; >5 yrs: 1 month/yr | Saudi Labor Law; base excludes HSA |

### 17.5 Appendix E: Scenario Parameters

| Parameter | Base | Optimistic | Pessimistic |
| --- | --- | --- | --- |
| New Enrollment Factor | 1.0 | 1.1 | 0.9 |
| Retention Adjustment | 0% | +3% | -5% |
| Attrition Rate | 2% | 1% | 5% |
| Fee Collection Rate | 95% | 98% | 90% |
| Scholarship Allocation | 2% | 1% | 3% |

### 17.6 Appendix F: Other Revenue Line Items

| Line Item | Annual Amount (SAR) | Distribution Method | Period |
| --- | --- | --- | --- |
| Frais de Dossier -- Francais | 106,000 | May--Jun | Registration |
| Frais de Dossier -- Nationaux | 8,000 | May--Jun | Registration |
| Frais de Dossier -- Autres | 198,000 | May--Jun | Registration |
| DPI -- Francais | 212,000 | May--Jun | Registration |
| DPI -- Nationaux | 16,000 | May--Jun | Registration |
| DPI -- Autres | 396,000 | May--Jun | Registration |
| Evaluation -- Primaire | 22,000 | Custom (Oct--Nov) | Registration |
| Evaluation -- College+Lycee | 46,500 | Custom (Oct--Nov) | Registration |
| DAI -- Francais | 2,980,000 | May--Jun | Registration |
| DAI -- Nationaux | 187,050 | May--Jun | Registration |
| DAI -- Autres | 5,570,000 | May--Jun | Registration |
| After-School Activities (APS) | 1,230,000 | Academic /10 | Activities |
| Daycare (Garderie) | 30,000 | Academic /10 | Activities |
| Class Photos | 52,800 | Custom (Nov--Dec) | Activities |
| PSG Academy Rental | 51,230 | Year-round /12 | Rental |
| BAC Examination | 222,000 | Custom (Apr--May) | Examinations |
| DNB Examination | 61,800 | Custom (Apr--May) | Examinations |
| EAF Examination | 96,000 | Custom (Apr--May) | Examinations |
| SIELE Examination | 15,000 | Custom (Oct--Nov) | Examinations |
| Bourses AEFE | -151,906 | Academic /10 | Social Aid |
| Bourses AESH | -177,600 | Academic /10 | Social Aid |
| **TOTAL OTHER REVENUE** | **11,170,874** | | |

### 17.7 Appendix G: IFRS Income Statement Notes

1. Revenue presented net per IFRS 15 -- Moyasar processing fees reclassified to Finance Costs.
2. Bad debt provision reclassified to Impairment Losses per IFRS 9 (Expected Credit Loss model).
3. Bank charges and FX losses reclassified from Administrative & General to Finance Costs per IAS 1.
4. Financial income (investment returns & FX gains) separated from operating revenue per IAS 1.
5. Zakat estimated at 2.5% on positive monthly profit -- actual computation per ZATCA regulations may differ.

### 17.8 Appendix H: Additional Staff Cost Lines (FY2026)

| Cost Line | Annual Amount (SAR) | Monthly Amount (SAR) | Notes |
| --- | --- | --- | --- |
| Contrats Locaux Remplacements | 272,167 | 22,681 | Substitute/replacement teachers |
| Contrats Locaux 1% Masse Salariale | 306,046 | 25,504 | Formation Continue (training levy) |
| Residents Salaires | 7,356,097 | 613,008 | AEFE/resident expatriate contracts |
| Residents Logement & Billets Avion | 647,400 | 53,950 | Housing & airfare for residents |
| **Total Additional Costs** | **8,581,710** | | |

### 17.9 Appendix I: DHG Hours Summary (Secondary)

| Level | Structural DHG (h/wk) | Arabic (h/wk) | Islamic (h/wk) | Complementary (h/wk) | Total DHG (h/wk) |
| --- | --- | --- | --- | --- | --- |
| 6eme | 174 | 18 | 6 | 1.68 | 199.68 |
| 5eme | 174 | 18 | 6 | 1.68 | 199.68 |
| 4eme | 145 | 15 | 5 | 1.40 | 166.40 |
| 3eme | 116 | 12 | 4 | 1.12 | 133.12 |
| 2nde | 192.5 | 10 | 5 | 0 | 207.50 |
| 1ere | 171 | 10 | 5 | 0 | 186.00 |
| Terminale | 154 | 8 | 4 | 0 | 166.00 |
| **TOTAL** | **1,126.5** | **91** | **35** | **5.88** | **1,258.38** |

---

## 18. Glossary of Terms

### A

| Term | Definition |
| --- | --- |
| AEFE | Agence pour l'Enseignement Francais a l'Etranger -- the French government agency that oversees and accredits French schools abroad, including EFIR. Sets curriculum standards, provides benchmark data (H/E ratios), and administers scholarship programs (Bourses AEFE). |
| AESH | Accompagnants des Eleves en Situation de Handicap -- support staff for students with disabilities. Bourses AESH refers to the associated scholarship/aid program appearing as negative revenue in the P&L. |
| Ajeer | A Saudi Ministry of Human Resources digital platform for managing work permits and visa compliance for non-Saudi employees. Imposes an annual levy per worker (SAR 9,500 non-Nitaqat or SAR 1,500 Nitaqat-compliant) plus a monthly platform fee (SAR 160). In BudFin, Ajeer costs are a statutory employer charge applied to all 166 non-Saudi employees. |
| APS | Activites Periscolaires -- after-school extracurricular activities offered to students. Revenue distributed using Academic /10 method. |
| ASEM | Agent Specialise des Ecoles Maternelles -- specialized classroom assistants required in French Maternelle classes (1 per class section). Included in the DHG staffing model as non-teaching support staff. |
| AY | Academic Year. EFIR operates on a dual academic year cycle within a single fiscal year: AY1 (January through June, continuing the prior academic year) and AY2 (September through December, starting the new academic year). July and August are the summer break with zero tuition revenue. |

### B

| Term | Definition |
| --- | --- |
| BAC | Baccalaureat -- the French national secondary school examination taken by Terminale students. Examination fees are calculated as zone rate (SAR 2,000) multiplied by AY1 Terminale headcount. |
| Bourses | Scholarships or financial aid grants. In BudFin, Bourses AEFE and Bourses AESH appear as negative revenue (social aid deductions) distributed using the Academic /10 method. |

### C

| Term | Definition |
| --- | --- |
| CAGR | Compound Annual Growth Rate -- a measure of enrollment growth over multiple years, calculated from historical enrollment data. Used in trend analysis within the Enrollment module. |
| CAO | Chief Accounting Officer -- the senior finance executive who owns the BudFin PRD, approves budget versions, and serves as the primary stakeholder for system requirements. |
| Cible | French for "target." In BudFin capacity planning, Cible represents the 85% target utilization threshold for class sections -- the ideal operating point between the Plancher (floor) and Plafond (ceiling). |
| College | The French lower secondary education cycle covering grades 6eme through 3eme (equivalent to US Grades 6-9). Uses subject-specific curriculum grilles with per-subject hours per week per section. |
| Contrats Locaux | Locally hired staff contracts, as distinct from AEFE resident (expatriate) contracts. "Contrats Locaux Remplacements" refers to substitute/replacement teacher contracts; "Contrats Locaux 1% Masse Salariale" refers to the mandatory continuing education (Formation Continue) levy. |
| CP | Cours Preparatoire -- French elementary Grade 1 (Elementaire band). The first year of formal primary education. Max class size: 26 students. |
| CE1 / CE2 | Cours Elementaire 1 and 2 -- French elementary Grades 2-3 (Elementaire band). Max class size: 26 students. |
| CM1 / CM2 | Cours Moyen 1 and 2 -- French elementary Grades 4-5 (Elementaire band). Max class size: 26 students. |
| CRUD | Create, Read, Update, Delete -- the four basic operations for data management. Used in describing version management and master data module capabilities. |
| CSV | Comma-Separated Values -- a plain-text file format used for storing tabular data. BudFin imports historical enrollment data from CSV files (enrollment_2021-22.csv through enrollment_2025-26.csv). |

### D

| Term | Definition |
| --- | --- |
| DAG | Directed Acyclic Graph -- a data structure that may be used in calculation dependency resolution within the calculation engine. |
| DAI | Droit Annuel d'Inscription -- the annual registration fee charged to students. Broken down by nationality (Francais, Nationaux, Autres) and distributed across May-June in the revenue model. |
| DHG | Dotation Horaire Globale -- the total weekly teaching hours allocated to a school based on its curriculum requirements, enrollment, and number of class sections. DHG hours drive FTE requirements, which in turn drive staff cost budgets. Total DHG = Structural hours + Host-country hours (Arabic + Islamic) + Complementary hours. |
| DNB | Diplome National du Brevet -- the French national lower secondary examination taken by 3eme students. Examination fees calculated as zone rate (SAR 600) multiplied by AY1 3eme headcount. |
| DPI | Droit de Premiere Inscription -- a one-time first enrollment fee charged to new students. Broken down by nationality (Francais, Nationaux, Autres) and distributed across May-June. |

### E

| Term | Definition |
| --- | --- |
| EAF | Epreuve Anticipee de Francais -- the early French language examination taken by 1ere (Grade 11) students as part of the Baccalaureat cycle. |
| EBITDA | Earnings Before Interest, Taxes, Depreciation, and Amortization -- a key profitability metric displayed in the P&L module and Dashboard KPIs. |
| ECL | Expected Credit Loss -- the IFRS 9 methodology for estimating bad debt provisions on receivables. |
| EFIR | Ecole Francaise Internationale de Riyad -- the French international school in Riyadh, Saudi Arabia, for which BudFin is being built. Approximately 1,500 students across 15 grade levels (PS through Terminale) with annual revenue exceeding SAR 40 million. |
| Elementaire | The French primary education cycle covering grades CP through CM2 (equivalent to US Grades 1-5). Curriculum: 24 hours per week. Max class size: 26 students per section. |
| EoS | End of Service -- a statutory provision under Saudi Labor Law. Calculated as 0.5 months per year of service for the first 5 years, then 1 month per year thereafter. Base includes salary, housing, transport, and responsibility premium (excludes HSA). |
| EPS | Education Physique et Sportive -- Physical Education and Sports, a subject in the French curriculum grilles. |

### F

| Term | Definition |
| --- | --- |
| Formation Continue | Continuing professional training levy. Modeled as "Contrats Locaux 1% Masse Salariale" (SAR 306,046 annually). |
| Francais | French nationality category. One of three nationality segments (Francais, Nationaux, Autres) used in enrollment, fee grids, and revenue calculations. |
| FTE | Full-Time Equivalent -- a standardized measure of staffing level. FTE = Total weekly teaching hours / Effective ORS (default 18 hours). |
| FY | Fiscal Year -- EFIR's fiscal year runs January through December (FY2026 = January 2026 through December 2026). Distinguished from the Academic Year (AY). |

### G

| Term | Definition |
| --- | --- |
| Garderie | Daycare service provided to students outside regular school hours. Revenue distributed using Academic /10 method. |
| GOSI | General Organization for Social Insurance -- Saudi social insurance. Employer contributes 11.75% of salary (9.75% Pension + 1% SANED + 1% OHI) for Saudi national employees only. In BudFin, only 2 of 168 employees are GOSI-eligible. |
| GS | Grande Section -- the final year of French Maternelle (preschool), for children aged 5. Max class size: 24 students. |
| Grille | French for "grid." Refers to curriculum timetables defining subject-level teaching hours per week per class section for each grade level. The DHG model uses four grilles: Maternelle, Elementaire, College, and Lycee. |

### H

| Term | Definition |
| --- | --- |
| H/E | Heures par Eleve (Hours per Student) -- an AEFE benchmark ratio comparing total teaching hours to student enrollment. Used in DHG Optimization to compare EFIR's staffing efficiency against the AEFE network average. |
| HSA | Heures Supplementaires Annuelles -- annualized overtime hours for teaching staff. Paid on a 10-month basis (excluded during July-August). HSA is excluded from the End of Service base calculation. |
| HT | Hors Taxes -- excluding taxes (specifically VAT). All IFRS-compliant revenue figures are presented HT per IFRS 15. Tuition HT = Tuition TTC / (1 + VAT_RATE). |

### I

| Term | Definition |
| --- | --- |
| IAS 1 | International Accounting Standard 1 -- Presentation of Financial Statements. BudFin's P&L uses the IAS 1 Function of Expense method and separates operating from finance items. |
| IFRS 9 | International Financial Reporting Standard 9 -- Financial Instruments. Relevant for the ECL model used to calculate impairment losses on receivables. |
| IFRS 15 | International Financial Reporting Standard 15 -- Revenue from Contracts with Customers. Governs revenue classification and presentation in BudFin. |
| IL | Indemnite Logement -- housing allowance. One of the five salary components; included in the End of Service base calculation. |
| IT | Indemnite Transport -- transport allowance. One of the five salary components; included in the End of Service base calculation. |

### K

| Term | Definition |
| --- | --- |
| KPI | Key Performance Indicator -- quantifiable metrics displayed on the Dashboard. Primary KPIs: Total Revenue (SAR HT), Total Students (by AY), School Utilization (target 85%), Discount Rate (% of Gross Tuition). |
| KSA | Kingdom of Saudi Arabia -- the country where EFIR operates. Relevant for statutory costs (GOSI, Ajeer, EoS), tax regulations (VAT, Zakat), and data protection (PDPL). |

### L

| Term | Definition |
| --- | --- |
| Lycee | The French upper secondary education cycle covering Seconde (2nde), Premiere (1ere), and Terminale. Uses the Voie Generale curriculum structure with Tronc commun and Specialites. |

### M

| Term | Definition |
| --- | --- |
| Marge d'autonomie | Margin of autonomy -- additional discretionary teaching hours beyond the mandated national curriculum. Appears in College DHG grilles. |
| Maternelle | The French preschool education cycle covering PS, MS, and GS, for children aged 3-5. Max class size: 24 students per section. Requires 1 ASEM assistant per class. |
| MS | Moyenne Section -- the middle year of French Maternelle, for children aged 4. Max class size: 24 students. |

### N

| Term | Definition |
| --- | --- |
| Nationaux | Saudi national students. One of three nationality segments. Nationaux are exempt from VAT on tuition (VAT rate = 0%). |
| Nitaqat | A Saudi labor nationalization program. Ajeer levy rates differ based on Nitaqat compliance: SAR 1,500 (compliant) vs. SAR 9,500 (non-compliant). EFIR currently uses the non-Nitaqat rate. |

### O

| Term | Definition |
| --- | --- |
| OHI | Occupational Hazards Insurance -- a GOSI component (1% of salary). Part of the 11.75% total rate for Saudi national employees only. |
| ORS | Obligation Reglementaire de Service -- the standard teaching obligation (default: 18 hours/week). Used as the denominator in FTE calculation. |

### P

| Term | Definition |
| --- | --- |
| P&L | Profit and Loss statement -- BudFin produces a monthly P&L using the IFRS Function of Expense method (IAS 1) with subtotals: Total Revenue, Total Expenses, EBITDA, Operating Profit, Profit Before Zakat, Net Profit/(Loss). |
| PDPL | Personal Data Protection Law -- the Saudi data privacy regulation. BudFin must comply with PDPL for handling employee personal data. |
| PS | Petite Section -- the first year of French Maternelle, for children aged 3. Max class size: 24 students. |
| Plancher | French for "floor." The 70% minimum utilization threshold below which a section is flagged as UNDER-utilized (amber alert). |
| Plafond | French for "ceiling." The 100% maximum utilization threshold above which a section is flagged as OVER capacity (red alert). |
| Plein | Full-price tariff category. One of three tariff categories (RP, R3+, Plein). |
| Premiere (1ere) | French upper secondary Grade 11 (Lycee). Students take the EAF examination. |
| Proviseur | Head of a French secondary school. Listed as a School Administrator persona. |

### R

| Term | Definition |
| --- | --- |
| R3+ | Tarif Reduit 3+ -- reduced tuition for families with 3+ children enrolled. Default: 75% of Plein. Mutually exclusive with RP. |
| RBAC | Role-Based Access Control -- BudFin's security model with roles: Admin, Budget Owner, Editor, Viewer. |
| RP | Tarif Reduit Personnel -- reduced tuition for children of school staff. Default: 75% of Plein. Mutually exclusive with R3+. |
| RPO | Recovery Point Objective -- maximum acceptable data loss. BudFin target: < 24 hours. |
| RTO | Recovery Time Objective -- maximum acceptable system restore time. BudFin target: < 4 hours. |

### S

| Term | Definition |
| --- | --- |
| SANED | Saudi unemployment insurance program. A GOSI component (1% of salary) for Saudi national employees only. |
| SAR | Saudi Riyal -- the currency of Saudi Arabia. All BudFin financial figures are denominated in SAR. |
| Seconde (2nde) | French upper secondary Grade 10 (Lycee). The first year of Lycee. |
| SIELE | Servicio Internacional de Evaluacion de la Lengua Espanola -- international Spanish language examination. Fees distributed in October-November. |
| Specialites | Elective specialization subjects in the French Lycee Voie Generale curriculum. Relevant to DHG staffing calculations. |
| SSO | Single Sign-On -- authentication mechanism allowing users to access BudFin using existing organizational credentials. |

### T

| Term | Definition |
| --- | --- |
| Terminale | French upper secondary Grade 12 (Lycee). Final year culminating in the BAC examination. |
| Tronc commun | Common core -- mandatory subject hours in the Lycee Voie Generale curriculum that all students must take. |
| TTC | Toutes Taxes Comprises -- inclusive of all taxes (VAT). Fee grid amounts are TTC, converted to HT for IFRS reporting: HT = TTC / (1 + VAT_RATE). |

### U

| Term | Definition |
| --- | --- |
| UAT | User Acceptance Testing -- the final testing phase where EFIR finance team members validate that BudFin correctly reproduces all calculations and meets business requirements before go-live. |

### V

| Term | Definition |
| --- | --- |
| Vie Scolaire | School life / student affairs -- an administrative department responsible for student discipline, attendance, and non-academic support. Appears as a department assignment and cost center. |

### Y

| Term | Definition |
| --- | --- |
| YEARFRAC | A date calculation function returning the fraction of a year between two dates. Used in the End of Service formula to calculate precise years of service. BudFin uses US 30/360 basis to match Excel output. |

### Z

| Term | Definition |
| --- | --- |
| Zakat | An Islamic tax obligation. Estimated at 2.5% on positive monthly profit per ZATCA regulations. Appears in the IFRS Income Statement between "Profit Before Zakat" and "Net Profit/(Loss)." |
| ZATCA | Zakat, Tax and Customs Authority -- the Saudi government body administering zakat, income tax, VAT, and customs duties. EFIR must comply with ZATCA regulations for VAT (15% standard, 0% for Nationaux) and Zakat (2.5%). |

---

## 19. Document Governance

### 19.1 RACI Matrix for PRD Ownership

| Activity | CAO | Finance Director | Tech Lead | QA Lead | Project Manager |
| --- | --- | --- | --- | --- | --- |
| PRD authoring and maintenance | A | C | C | I | I |
| Domain rule validation (business logic, calculations, IFRS) | A | R | C | I | I |
| Technical feasibility assessment (architecture, performance, data model) | I | I | R | C | I |
| Testability review (acceptance criteria, measurable targets) | I | I | C | R | I |
| Scope and timeline management | C | I | C | I | R |
| Final PRD approval and sign-off | R | R | R | C | I |
| Change control after baseline freeze (v2.0) | A | R | R | C | R |

**Legend:** R = Responsible (does the work), A = Accountable (owns the outcome), C = Consulted (provides input before decision), I = Informed (notified after decision).

### 19.2 Sign-Off Table

The following sign-off is required before the PRD is considered an approved baseline for development:

| Name | Role | Date | Signature |
| --- | --- | --- | --- |
| _________________ | Chief Accounting Officer (CAO) | ____/____/________ | _________________ |
| _________________ | Finance Director | ____/____/________ | _________________ |
| _________________ | Tech Lead | ____/____/________ | _________________ |
| _________________ | QA Lead | ____/____/________ | _________________ |
| _________________ | Project Manager | ____/____/________ | _________________ |

**Sign-off confirms that:**
1. The signer has read and reviewed the PRD in its entirety.
2. All requirements within their area of responsibility are accurate and complete.
3. The document is approved as the baseline for development (Version 2.0).
4. Any subsequent changes will follow the change control process defined in Section 19.3.

### 19.3 Communication Plan

**1. Version Control**
The PRD is maintained under Git version control in the project repository at `docs/prd/BudFin_PRD_v2.0.md`. All changes are tracked through Git commits, providing a complete history of who changed what, when, and why.

**2. Change Notifications**
- Every PRD modification is accompanied by a descriptive Git commit message.
- Commit messages for PRD changes must follow the format: `docs(prd): [brief description] -- vX.Y.Z`
- For major and minor version changes, the commit must include a summary of affected sections and rationale.
- Team members can subscribe to notifications on the PRD file path for automatic alerts.

**3. Weekly PRD Review During Active Development**
- During Phases 1 through 5, a weekly PRD review session is held to address questions, evaluate proposed changes, review pending minor versions, and ensure alignment with implementation.
- The CAO (or delegate) chairs the review. Attendees: Tech Lead, QA Lead, Project Manager.
- Action items are recorded and tracked to resolution.

**4. Baseline Freeze at v2.0**
- Version 2.0 represents the approved baseline. After sign-off, the PRD enters controlled change regime.

**5. Change Control After Freeze**
- Proposed changes require a written change request with: section(s) and FR ID(s) affected, proposed modification (old vs. new text), rationale, and impact assessment (modules, calculations, data model, tests, timeline).
- Reviewed by CAO (Accountable), Finance Director (domain impact), Tech Lead (technical impact).
- Approved changes become a minor or major version increment. Rejected changes are documented in the Decision Log.
- Emergency changes (blocking development) may be fast-tracked with verbal CAO approval, followed by written documentation within 48 hours.

**6. Distribution**
- The authoritative PRD is always the latest Git repository version. Team members must not maintain divergent local copies.
- New major or minor versions are announced by the Project Manager to all stakeholders with a change summary.

---

## 20. Decision Log

The following decisions were made during the Phase 1 stakeholder review (Chief Accounting Officer feedback) and subsequent v2.0 remediation, recorded per the requirements of `PLANNING_PROCESS.md`.

| # | Decision | Rationale | Affected Sections |
| --- | --- | --- | --- |
| D-001 | Reorganize navigation into 4 groups: Dashboard, Planning, Master Data, Admin | Clear separation of concerns -- viewing (Dashboard), core budgeting work (Planning), configuration (Master Data), and system administration (Admin). Reduces cognitive load when navigating a 10+ module application. | 6.2, TOC |
| D-002 | Merge Enrollment + Capacity Planning into "Enrollment & Capacity" | Both modules operate on the same student data (headcount, sections, utilization). Capacity is a direct function of enrollment and splitting them creates unnecessary navigation between tightly coupled views. | 6.2, 8.1, 8.3 (removed) |
| D-003 | Merge Staffing (DHG) + Staff Costs into "Staffing & Staff Costs" | FTE requirements from the DHG model directly feed staff cost calculations. Keeping them in separate modules creates unnecessary navigation and makes it harder to see the full staffing picture (demand + cost) in one place. | 6.2, 8.3, 8.5 (removed) |
| D-004 | Add explicit Calculate button per planning module | Gives users explicit control over when calculations run. Prevents confusion from partial auto-updates during complex multi-field data entry sessions. Matches familiar Excel workflow (F9 / Calculate). Auto-save persists data independently of calculation. | 11, 12 |
| D-005 | Simplify Audit Trail for v1 (basic logging, simple list view, no CSV export) | v1 focuses on core logging (who changed what, when). Advanced search, filtering, and export capabilities are deferred to v2 to reduce initial scope and accelerate delivery. | 8.7 |
| D-006 | Add Version Management as dedicated Planning module with FRs | Version lifecycle management (create, delete, lock, compare, clone) is central to the planning workflow and needs more than a context bar dropdown. The context bar selects the active version; the dedicated module manages the full version lifecycle. | 6.2, 7.4 |
| D-007 | Comprehensive audit remediation (v1.1 to v2.0) | 72 gaps identified across 10 dimensions (22 Critical, 16 High, 19 Medium, 15 Low). Remediation added: document governance, glossary, scope assumptions, change control, user stories, acceptance criteria, expanded NFRs (97), technology constraints, data dictionary, enhanced migration strategy, revised timeline (30 weeks), expanded risk register (15 risks), RACI matrix, and MoSCoW prioritization on all FRs. | All sections |

---

--- End of Document ---
```
