# User Stories, Personas, and Journey Maps

## BudFin -- School Financial Planning Workspace

| Field | Value |
| --- | --- |
| Document Version | 1.0 |
| Date | March 3, 2026 |
| Status | Draft |
| Parent Document | BudFin PRD v1.1 |
| PRD Gap References | G-011, G-012, G-013, G-015, G-016 |

---

## Table of Contents

1. [Persona Registry](#1-persona-registry)
	- 1.1 Existing Personas (from PRD v1.1)
	- 1.2 Additional Personas
2. [User Stories](#2-user-stories)
	- 2.1 Budget Owner Stories (US-001 through US-005)
	- 2.2 Budget Analyst Stories (US-006 through US-010)
	- 2.3 HR/Payroll Coordinator Stories (US-011 through US-014)
	- 2.4 School Administrator Stories (US-015 through US-017)
	- 2.5 System Administrator Stories (US-018 through US-021)
	- 2.6 External Auditor Stories (US-022 through US-025)
3. [Persona-to-FR Traceability Matrix](#3-persona-to-fr-traceability-matrix)
4. [User Journey Maps](#4-user-journey-maps)
	- 4.1 Annual Budget Preparation
	- 4.2 Monthly Close
	- 4.3 Forecast Revision
	- 4.4 Version Comparison

---

## 1. Persona Registry

### 1.1 Existing Personas (from PRD v1.1 Section 5)

| Persona | Role | Primary Needs | Key Activities |
| --- | --- | --- | --- |
| Budget Owner | Chief Accounting Officer / Finance Director | Full control over budget versions, assumptions, and approvals; variance analysis | Create/lock budget versions; approve forecasts; review P&L variance; present to board |
| Budget Analyst | Finance Manager / Controller | Efficient data entry, scenario modeling, detailed drill-down | Enter enrollment projections; adjust fee grids; run scenarios; prepare monthly close reports |
| HR/Payroll Coordinator | HR Manager | Staff roster accuracy, cost projections for new hires | Maintain employee master data; validate salary components; review EoS provisions |
| School Administrator | Proviseur / Principal | Enrollment visibility, capacity planning, staffing adequacy | Review enrollment trends; check class capacity; validate DHG staffing requirements |

### 1.2 Additional Personas

| Persona | Role | Primary Needs | Key Activities |
| --- | --- | --- | --- |
| System Administrator | IT Support Staff / Application Administrator | System health monitoring, user provisioning, data backup/restore, technical troubleshooting | Manage user accounts and role assignments; configure RBAC policies; monitor audit trail for anomalies; perform system backup and recovery; manage system parameters and import/export settings |
| External Auditor | AEFE Compliance Officer / External Audit Firm Representative | Read-only access to locked/archived versions; audit trail review; IFRS compliance verification; version integrity validation | View locked and archived budget versions; review full audit trail for data change attribution; verify IFRS 15 revenue classification and IAS 1 expense presentation; export comparison reports for external review; validate version integrity (no post-lock modifications) |

---

## 2. User Stories

### 2.1 Budget Owner Stories

**US-001: Create a New Budget Version**
As a Budget Owner, I want to create a new budget version for the upcoming fiscal year, so that the finance team can begin entering assumptions and projections in a controlled workspace.

Acceptance Criteria:
- Given I am on the Version Management module with Editor or Admin role, when I click "Create Version" and specify name "FY2026 Budget", type "Budget", and optionally select an existing version as the base data source, then a new version is created in Draft status with all fields editable.
- Given I selected a base version during creation, when the new version is created, then all data, assumptions, fee grids, enrollment figures, and configuration from the source version are copied into the new Draft version (per FR-VER-005).
- Given the version is created, when I view Version Management, then the new version appears with metadata showing creation date, my user identity as author, Draft status, and a modification count of zero (per FR-VER-006).
- Given the version is in Draft status, when a Viewer-role user navigates to the workspace, then the Draft version is not visible in their context bar dropdown.

---

**US-002: Lock a Published Budget Version**
As a Budget Owner, I want to lock a published budget version after board approval, so that no further edits can be made without explicit authorization and audit trail.

Acceptance Criteria:
- Given a budget version is in Published status, when I select "Lock Version" from the Version Management module, then the version transitions to Locked status and an audit event is logged with timestamp, my identity, and action type "Version Locked" (per FR-VER-003, FR-AUD-002).
- Given a version is Locked, when any user (including Budget Owner) attempts to edit data within that version, then the system prevents the edit and displays a read-only indicator.
- Given a Locked version needs a correction, when I select "Unlock Version", then the system requires a mandatory audit note explaining the reason for unlocking before transitioning the version back to Published status (per FR-VER-003).
- Given the unlock occurs, when I view the audit trail, then the unlock event is recorded with my identity, timestamp, the reason note, and the version identifier.

---

**US-003: Compare Two Budget Versions**
As a Budget Owner, I want to compare a Budget version against an Actual or Forecast version, so that I can identify variances and present informed analysis to leadership.

Acceptance Criteria:
- Given I have selected a primary version in the context bar, when I select a comparison version from the Comparison Version dropdown, then every data table across all modules displays additional variance columns: Absolute Variance (SAR) and Percentage Variance (per FR-VER-004, Section 7.3).
- Given comparison mode is active, when I view the P&L module, then revenue line items show green highlighting for favorable variances (positive revenue delta) and red for unfavorable, and expense line items show green for favorable (negative cost delta) and red for unfavorable.
- Given a variance cell is displayed, when I click on it, then a waterfall breakdown opens showing the contributing drivers of the variance (per Section 7.3).
- Given comparison mode is active, when I navigate between modules using the left navigation, then the comparison context persists and variance columns remain visible in every module (per NFR context bar state persistence).

---

**US-004: Review Consolidated P&L Variance**
As a Budget Owner, I want to review the consolidated P&L statement with Budget vs. Actual variance, so that I can identify areas of over- or under-performance against plan.

Acceptance Criteria:
- Given comparison mode is active with Budget as primary and Actual as comparison, when I open the P&L & Reporting module, then the IFRS Income Statement displays monthly columns (Jan-Dec) with inline variance columns for each month showing absolute and percentage delta (per FR-PNL-006).
- Given the P&L is displayed, when I review the key subtotals, then I see Total Revenue, Total Expenses, EBITDA, Operating Profit, and Net Result with correct variance calculation at each level (per FR-PNL-004).
- Given I notice a significant revenue variance, when I drill into the Revenue section, then I see IFRS 15 classified detail: tuition by level and tariff, registration fees, and ancillary revenue each with their own variance (per FR-PNL-002, FR-PNL-007).
- Given the Zakat line is shown, when monthly profit is positive, then Zakat is calculated at 2.5% per ZATCA regulations, and when monthly profit is negative, then Zakat is zero (per FR-PNL-014).

---

**US-005: Present Budget to Board**
As a Budget Owner, I want to generate a board-ready budget presentation package, so that I can present a complete financial plan with supporting analysis to the board of directors.

Acceptance Criteria:
- Given I have a Locked budget version, when I navigate to the Dashboard module, then I see executive KPI widgets showing Total Revenue (SAR HT), Total Students (by AY with sections), School Utilization (vs 85% target), and Discount Rate (per FR-DSH-001).
- Given the Dashboard is displayed, when I review the P&L summary widget, then it shows key subtotals (Revenue, Expenses, Operating Profit, Net Result) for the active version (per FR-DSH-002).
- Given I need to export the presentation materials, when I select export for any report or data view, then the system generates the output in my selected format: Excel (.xlsx), PDF, or CSV (per NFR export formats).
- Given I want to show enrollment context, when I review the Dashboard enrollment trend charts, then the charts display 5-year historical data with year-over-year comparison (per FR-DSH-003, FR-ENR-003).

---

### 2.2 Budget Analyst Stories

**US-006: Enter Enrollment Projections**
As a Budget Analyst, I want to enter enrollment projections using a two-stage process, so that I can build headcount estimates from high-level totals down to nationality/tariff detail with historical context.

Acceptance Criteria:
- Given I am in the Enrollment & Capacity module with an editable Budget or Forecast version selected, when I enter Stage 1 data, then I can input total headcount by grade for both AY1 (Jan-Jun) and AY2 (Sep-Dec) with 3-year historical context (N-2, N-1, Current) displayed alongside each grade row (per FR-ENR-005, FR-ENR-009, FR-ENR-013).
- Given Stage 1 headcount is entered, when I advance to Stage 2, then the system presents a breakdown grid by nationality (Francais, Nationaux, Autres) and tariff category (RP, R3+, Plein) for each grade, with proportions that can be overridden (per FR-ENR-005, FR-ENR-006, FR-ENR-007).
- Given I enter AY1 headcount, when the system runs cohort progression modeling, then AY2 enrollment is auto-suggested based on AY1 retention rates and historical lateral entry patterns with configurable weight parameter (default 0.8 for most recent year), and I can manually override the suggestion for new PS intake (per FR-ENR-010, FR-ENR-011, FR-ENR-012).
- Given enrollment data changes more than +/-10% vs. prior year for any grade, when I view the enrollment grid, then the system visually flags those grades with a significant-change indicator (per FR-ENR-008).

---

**US-007: Adjust Fee Grids and Discount Policies**
As a Budget Analyst, I want to configure fee grids and discount policies for the budget version, so that the revenue engine calculates accurate tuition and ancillary revenue.

Acceptance Criteria:
- Given I am in the Revenue module with an editable version, when I open the Fee Grid section, then I see a configurable grid with dimensions Grade Level x Nationality x Tariff Category, with separate grids for AY1 and AY2, showing fee components: DAI, Tuition TTC, Tuition HT, and Term installments T1/T2/T3 (per FR-REV-001, FR-REV-002, FR-REV-005).
- Given I enter a Tuition TTC value, when the field loses focus, then the system automatically calculates Tuition HT = Tuition TTC / (1 + VAT_RATE), except for Nationaux where VAT rate = 0% (per FR-REV-003, FR-REV-006).
- Given I open the Discount Policies section, when I configure RP and R3+ rates, then the rates are expressed as percentage of Plein tariff (default 75% for both) and the system enforces mutually exclusive application: each student receives only the highest applicable discount (per FR-REV-007, FR-REV-008, FR-REV-009).
- Given discounts are configured, when I view the discount impact analysis, then I see total discount SAR broken down by nationality, grade band, and tariff type (per FR-REV-010).

---

**US-008: Run Scenario Comparisons**
As a Budget Analyst, I want to configure and run multiple budget scenarios, so that I can present leadership with a range of financial outcomes based on different enrollment and revenue assumptions.

Acceptance Criteria:
- Given I am in the Scenarios module with an editable version, when I open scenario parameters, then I see three pre-defined scenarios (Base, Optimistic, Pessimistic) each with 5 individually configurable parameters: New Enrollment Factor, Retention Adjustment, Attrition Rate, Fee Collection Rate, and Scholarship Allocation (per FR-SCN-001, FR-SCN-002).
- Given I adjust scenario parameters and click Calculate, when the calculation completes, then the system propagates parameters through enrollment, revenue, and staff cost calculations and displays output metrics: Adjusted Total Enrollment, Total Tuition Revenue HT, Total All-Stream Revenue, Scholarship Deductions, Net Revenue, and Revenue per Student (per FR-SCN-003, FR-SCN-006).
- Given calculation is complete, when I view the side-by-side comparison table, then I see all three scenarios with absolute and percentage deltas, including a Delta vs. Base table showing Enrollment Delta, Tuition Delta, and Net Revenue Delta (per FR-SCN-004, FR-SCN-007).
- Given I need a fourth scenario, when I click "Create Custom Scenario", then I can define a new user-defined scenario with independent parameter values beyond the three defaults (per FR-SCN-005).

---

**US-009: Prepare Monthly Close Report**
As a Budget Analyst, I want to import actual financial results and compare them against the budget, so that I can prepare the monthly close report with variance analysis.

Acceptance Criteria:
- Given it is month-end and Actual data is available, when I select the Actual version in the context bar and navigate to the relevant module, then I can enter or import actual financial figures for the closed period.
- Given Actual data is entered, when I select the Budget version as the comparison version in the context bar, then variance columns appear across all modules showing Budget vs. Actual absolute and percentage differences (per FR-VER-004).
- Given I review the P&L module with comparison active, when I examine the monthly columns, then I see the IFRS Income Statement with Revenue, Operating Expenses (including Staff Costs, Other OpEx, D&A, Impairment Losses), Finance section, Zakat, and Net Result each with variance (per FR-PNL-001 through FR-PNL-015).
- Given I need to share the close report, when I export the P&L comparison view, then the system generates an Excel or PDF file containing the full monthly comparison with all variance columns preserved.

---

**US-010: Export Reports and Data Views**
As a Budget Analyst, I want to export any report or data view in multiple formats, so that I can share analysis with stakeholders who may not have system access.

Acceptance Criteria:
- Given I am viewing any module (Enrollment, Revenue, Staffing, P&L, Dashboard, Scenarios), when I click the Export button, then I can select from Excel (.xlsx), PDF, and CSV output formats (per NFR export formats).
- Given comparison mode is active, when I export a view, then the exported file includes the primary version data, comparison version data, and all variance columns (absolute and percentage) exactly as displayed on screen.
- Given I export the IFRS Income Statement, when I open the exported file, then all 12 monthly columns plus annual total are present with correct IFRS 15 revenue classification and IAS 1 expense presentation, with values in SAR HT (per FR-PNL-016, FR-PNL-017, FR-PNL-018).
- Given I export enrollment data, when I open the file, then it includes all grade levels, nationality/tariff breakdowns, historical context, and capacity metrics with utilization alerts preserved.

---

### 2.3 HR/Payroll Coordinator Stories

**US-011: Maintain Employee Master Data**
As an HR/Payroll Coordinator, I want to maintain the employee roster with all required fields, so that staff cost calculations use accurate and current employee data.

Acceptance Criteria:
- Given I am in the Staffing & Staff Costs module, when I open Employee Master Data, then I see a grid of all employees with 18+ fields including: ID, name, function/role, department, status (Existing/New/Departed), joining date, years of service, payment method, and Saudi/Ajeer designation (per FR-STC-001).
- Given I need to update an employee's department, when I edit the Department field, then I can select from the configured departments: Maternelle, Elementaire, College, Lycee, Administration, Vie Scolaire & Support (per FR-STC-003).
- Given I change an employee's status to "Departed", when I save the change, then the system logs the modification in the audit trail with timestamp, my identity, old value, new value, and optional comment (per FR-AUD-001).
- Given I am entering data, when I use keyboard navigation, then Tab moves between cells, Enter confirms and moves down, and arrow keys navigate -- matching Excel-like behavior (per UI/UX Section 12).

---

**US-012: Validate Salary Components and Cost Projections**
As an HR/Payroll Coordinator, I want to review and validate each employee's salary components, so that the monthly cost budget accurately reflects compensation commitments.

Acceptance Criteria:
- Given I view an employee's salary detail, when I expand the row, then I see the five core components: Base Salary, Housing Allowance (IL), Transport Allowance (IT), Responsibility Premium, and HSA, plus Hourly Percentage for part-time adjustment (per FR-STC-004, FR-STC-008).
- Given all components are entered, when the system calculates Monthly Gross, then Monthly Gross = (Base + Housing + Transport + Premium + HSA) x Hourly Percentage, with HSA = 0 during Jul-Aug for teaching staff (per FR-STC-005, FR-STC-007).
- Given an augmentation is planned, when I enter the augmentation amount with effective date of September, then the system applies the augmentation from Sep onward: adjusted salary = current salary + augmentation amount (per FR-STC-006).
- Given a new position starts in September, when I view the 12-month budget grid, then Jan-Aug shows zero cost for that position and Sep-Dec shows full cost based on salary components (per FR-STC-012).

---

**US-013: Review End of Service Provisions**
As an HR/Payroll Coordinator, I want to review End of Service provision calculations for all employees, so that I can confirm accruals comply with Saudi Labor Law and are correctly provisioned in the budget.

Acceptance Criteria:
- Given I am in the EoS section of Staffing & Staff Costs, when I view the provision table, then I see per-employee calculations with: years of service (YEARFRAC from joining date), EoS base (Base + Housing + Transport + Premium, excluding HSA), opening balance (Dec prior year), closing balance (Dec current year), annual FY charge, and monthly accrual (per FR-STC-011).
- Given an employee has 3 years of service, when the system calculates EoS, then Provision = EoS Base / 2 x 3 (0.5 month per year for first 5 years).
- Given an employee has 8 years of service, when the system calculates EoS, then Provision = (EoS Base / 2 x 5) + EoS Base x (8 - 5) = 2.5 months + 3 months = 5.5 months equivalent of EoS Base.
- Given I view the monthly cost budget, when I check the EoS Accrual row, then the monthly accrual = Annual FY Charge / 12 for each employee, and the total is summed across all 168 employees (per FR-STC-013).

---

**US-014: Handle New Hires and Staffing Changes**
As an HR/Payroll Coordinator, I want to add new hire positions to the budget, so that September onboarding costs are correctly reflected in the annual staff cost forecast.

Acceptance Criteria:
- Given I need to add a new position, when I create a new employee record with status "New" and joining date in September, then the system sets cost contribution to zero for Jan-Aug and full cost for Sep-Dec in the monthly budget (per FR-STC-002, FR-STC-012).
- Given the new employee is non-Saudi, when the system calculates statutory costs, then Ajeer costs are prorated to 4 months (Sep-Dec) instead of 12 months for existing staff, and the annual levy and monthly platform fee (SAR 160) are applied proportionally (per FR-STC-010).
- Given the new employee is Saudi, when the system calculates GOSI, then 11.75% employer contribution is applied on the full salary package for Sep-Dec only (per FR-STC-009).
- Given I review the staff cost analytics after adding new hires, when I view department-level cost repartition, then the department totals reflect updated headcount, FTE, monthly gross, annual salary cost, EoS charge, Ajeer, and total cost with correct department share percentages (per FR-STC-020, FR-STC-021).

---

### 2.4 School Administrator Stories

**US-015: Review Enrollment Trends and Historical Data**
As a School Administrator, I want to review 5-year enrollment trends with CAGR and moving averages, so that I can make informed decisions about future enrollment targets and school capacity.

Acceptance Criteria:
- Given I am in the Enrollment & Capacity module, when I view the Historical Enrollment section, then I see 5+ years of enrollment data by grade level (PS through Terminale) imported from CSV files (per FR-ENR-001, FR-ENR-002).
- Given historical data is displayed, when I view the trend chart, then enrollment trends are shown as a line chart with year-over-year comparison for each grade (per FR-ENR-003).
- Given I want to analyze growth patterns, when I review the analytics, then I see compound annual growth rate (CAGR) and moving averages calculated by grade band: Maternelle, Elementaire, College, Lycee (per FR-ENR-004).
- Given I am reviewing data, when I toggle the Academic Period in the context bar between AY1, AY2, Summer, and Full Year, then the enrollment data filters to show only the selected period's headcount.

---

**US-016: Check Class Capacity and Utilization**
As a School Administrator, I want to see class capacity utilization with traffic-light alerts, so that I can identify grades that are over-enrolled, under-enrolled, or approaching capacity limits.

Acceptance Criteria:
- Given I am in the Capacity Planning section of Enrollment & Capacity, when I view the capacity grid, then I see for each grade: current enrollment, max class size, sections needed (CEILING of enrollment / max class size), and utilization percentage (per FR-CAP-001, FR-CAP-003).
- Given utilization is calculated, when the system applies thresholds, then each grade shows a traffic-light alert: OVER (red) when enrollment exceeds Plafond (100%), OK (green) when between Plancher (70%) and Plafond, UNDER (amber) when below Plancher, and a "Near Cap" warning when utilization exceeds 95% (per FR-CAP-004, FR-CAP-007).
- Given I review the capacity grid, when I look at recruitment slots, then the system displays Available Spots = Plafond - Current Enrollment for each grade (per FR-CAP-005).
- Given I review max class size parameters, when I check the configuration, then Maternelle = 24, Elementaire = 26, and College/Lycee = variable, each configurable per grade band (per FR-CAP-006).

---

**US-017: Validate DHG Staffing Requirements**
As a School Administrator, I want to validate that curriculum staffing (DHG) meets French National Curriculum requirements and compare against AEFE benchmarks, so that I can confirm the school is properly staffed for the planned enrollment.

Acceptance Criteria:
- Given I am in the Staffing section of Staffing & Staff Costs, when I view the DHG grilles, then I see pre-loaded French National Curriculum grilles for all four bands (Maternelle 24h/wk, Elementaire 24h/wk, College 27-28h/wk, Lycee Voie Generale) with subject-level hours per week per section (per FR-DHG-001, FR-DHG-002).
- Given the DHG grilles and enrollment sections are populated, when the system calculates FTE requirements, then FTE = Total DHG Hours / Effective ORS (where ORS = 18 + configurable HSA hours) with CEILING applied per level, and I can compare four HSA scenarios: No HSA (ORS=18), Conservative (ORS=19), Custom, Full HSA (ORS=20) (per FR-DHG-009, FR-DHG-013, FR-DHG-014).
- Given FTE is calculated, when I view the AEFE benchmark comparison, then I see H/E (Heures/Eleve) benchmark comparison against AEFE mean values per level, AEFE FTE estimate vs. EFIR model FTE with variance, and average students per division (per FR-DHG-019, FR-DHG-020, FR-DHG-021).
- Given AY1 and AY2 have different enrollments, when I view subject-level staffing, then I see year-over-year comparison of FTE requirements by subject (AY1 vs. AY2) with delta analysis and variance flagging (per FR-DHG-016, FR-DHG-017).

---

### 2.5 System Administrator Stories

**US-018: Manage User Accounts and Provisioning**
As a System Administrator, I want to create, modify, and deactivate user accounts, so that only authorized personnel have access to BudFin with appropriate permissions.

Acceptance Criteria:
- Given I am in the Admin > User Settings module, when I create a new user account, then I can specify: username, display name, email, assigned role (Admin, Editor, Viewer), and active/inactive status (per NFR Security RBAC).
- Given I need to deactivate a departing employee's access, when I set their account to inactive, then the user can no longer log in, and their historical audit trail entries are preserved with their identity.
- Given I modify a user's role, when I save the change, then the role change is logged in the audit trail with timestamp, my identity, old role, new role, and optional comment (per FR-AUD-001).
- Given I view the user list, when I review all accounts, then I see each user's name, role, status, last login date, and creation date.

---

**US-019: Configure Role-Based Access Control**
As a System Administrator, I want to configure RBAC policies for each role, so that users can only access data and perform actions appropriate to their responsibilities.

Acceptance Criteria:
- Given I am configuring RBAC, when I define the Admin role, then it grants full access to all modules including User Settings, System Settings, and Audit Trail.
- Given I am configuring RBAC, when I define the Editor role, then it grants read-write access to Planning and Master Data modules but restricts access to Admin modules (User Settings, System Settings).
- Given I am configuring RBAC, when I define the Viewer role, then it grants read-only access to published and locked versions across Dashboard, Planning (read-only), and Master Data (read-only), with no access to Draft versions or Admin modules.
- Given a user with Viewer role attempts to edit data in a published version, when they click on a data cell, then the system displays a read-only indicator and prevents modification.

---

**US-020: Monitor Audit Trail for Anomalies**
As a System Administrator, I want to review the audit trail to detect unusual activity, so that I can identify potential security issues or data integrity concerns.

Acceptance Criteria:
- Given I am in the Admin > Audit Trail module, when I open the audit log, then I see entries displayed in reverse chronological order with: timestamp, user identity, action type, and affected field for each entry (per FR-AUD-003).
- Given the audit log is displayed, when I apply date filters, then only entries within the selected date range are shown (per FR-AUD-003).
- Given I am reviewing entries, when I look at version-level events, then I see creation, publication, locking, and unlocking events with the acting user's identity and any mandatory audit notes (per FR-AUD-002).
- Given I detect suspicious activity (e.g., multiple unlock/relock cycles on a published version), when I review the detailed entries, then I see the old value, new value, and optional comment for each modification (per FR-AUD-001).

---

**US-021: Perform System Backup and Recovery**
As a System Administrator, I want to manage system backups and have the ability to restore data, so that the school's financial data is protected against loss or corruption.

Acceptance Criteria:
- Given the system is running, when the daily automated backup executes, then a complete backup of all data (versions, master data, audit trail, user accounts) is created with RPO < 24 hours (per NFR backup and recovery).
- Given I am in Admin > System Settings, when I initiate a manual backup, then the system creates an immediate backup and confirms the backup timestamp and status.
- Given a data corruption event occurs, when I initiate a restore from a specific backup, then the system restores all data to the state captured in that backup and logs the restore event in the audit trail.
- Given audit trail data must be retained, when I verify the system configuration, then the audit trail retention period is set to a minimum of 7 years (per NFR audit trail retention).

---

### 2.6 External Auditor Stories

**US-022: View Locked and Archived Budget Versions**
As an External Auditor, I want to access locked and archived budget versions with read-only permissions, so that I can review the approved financial plan without any risk of inadvertent modification.

Acceptance Criteria:
- Given I am logged in with an Auditor/Viewer role, when I open the context bar version dropdown, then I see only Published, Locked, and Archived versions -- Draft versions are not visible to me.
- Given I select a Locked version, when I navigate through any module (Enrollment, Revenue, Staffing, P&L, Dashboard), then all data is displayed in read-only mode with no editable fields or Calculate buttons available.
- Given I select an Archived version, when I review the data, then I see the complete historical snapshot as it existed when the version was archived, with version metadata showing creation date, author, lock date, and archive date (per FR-VER-006).
- Given I attempt to modify any data, when I interact with the interface, then no edit actions are available and the system displays a clear read-only indicator tied to my role.

---

**US-023: Review Audit Trail for Compliance Verification**
As an External Auditor, I want to review the complete audit trail for a specific budget version, so that I can verify that all data changes are properly attributed and no unauthorized modifications occurred after version lock.

Acceptance Criteria:
- Given I am in the Admin > Audit Trail module with Viewer access, when I view the audit log, then I see all logged events in reverse chronological order with date filtering capability (per FR-AUD-003).
- Given I review version-level events, when I filter for a specific version, then I see all lifecycle transitions (Draft to Published, Published to Locked, any unlock/relock cycles) with the acting user, timestamp, and audit notes (per FR-AUD-002, FR-VER-003).
- Given a version was unlocked and relocked after initial approval, when I review the unlock event, then I see the mandatory audit note explaining the reason for the unlock and the identity of the authorizing user.
- Given I need to verify data integrity, when I review data modification entries for the period after lock, then I can confirm whether any field-level changes occurred and identify exactly who made them, what the old and new values were, and when the changes happened (per FR-AUD-001).

---

**US-024: Verify IFRS Compliance of Financial Statements**
As an External Auditor, I want to review the IFRS Income Statement and mapping details, so that I can verify that revenue classification follows IFRS 15 and expense presentation follows IAS 1.

Acceptance Criteria:
- Given I am viewing the P&L & Reporting module for a locked version, when I review the IFRS Income Statement, then revenue is presented net per IFRS 15 with classification into: Tuition Fees (by level and tariff -- Reduit/Plein), Registration & re-registration fees, Activities & services, and Examination fees (per FR-PNL-007, FR-PNL-008).
- Given I review expenses, when I examine Operating Expenses, then I see the IAS 1 Function of Expense presentation: Staff costs, Other operating expenses, Depreciation & amortization, and Impairment losses on receivables per IFRS 9 ECL model (per FR-PNL-010).
- Given I review Finance items, when I examine the Finance section, then I see Finance income (investment returns, FX gains) separated from Finance costs (Moyasar processing fees, bank charges, FX losses) per IAS 1 with Moyasar fees correctly reclassified from operating to Finance Costs (per FR-PNL-011, FR-PNL-012).
- Given I review the IFRS Mapping detail, when I examine the mapping, then I see per-line-item monthly breakdown (12 months + annual total) with tuition fee detail split by level AND tariff type, all presented in SAR HT excluding VAT (per FR-PNL-016, FR-PNL-017, FR-PNL-018).

---

**US-025: Export Reports for External Review**
As an External Auditor, I want to export financial reports and comparison data, so that I can perform independent analysis using external audit tools and include the outputs in our audit working papers.

Acceptance Criteria:
- Given I am viewing any module or report, when I click the Export button, then I can select Excel (.xlsx), PDF, or CSV format for download (per NFR export formats).
- Given I have comparison mode active (Budget vs. Actual), when I export the P&L report, then the exported file includes both version columns, absolute variance, and percentage variance exactly as displayed on screen.
- Given I export the IFRS Income Statement, when I open the file in Excel, then all 12 monthly columns plus annual total are present with IFRS 15 revenue classification and IAS 1 expense structure intact, with values in SAR HT (per FR-PNL-016, FR-PNL-018).
- Given I need enrollment and staffing data for analytical procedures, when I export from Enrollment and Staffing modules, then the files include all detail levels: by grade, by nationality, by tariff, by department, by function -- preserving the same data granularity available in the application.

---

## 3. Persona-to-FR Traceability Matrix

The following matrix maps each persona to their primary and secondary functional requirements. Primary FRs are those the persona directly interacts with as part of their core activities. Secondary FRs are those the persona uses occasionally or consumes indirectly.

| Persona | Primary FRs | Secondary FRs |
| --- | --- | --- |
| Budget Owner | FR-VER-001 through FR-VER-006 (version lifecycle), FR-PNL-001 through FR-PNL-018 (P&L and IFRS reporting), FR-DSH-001 through FR-DSH-005 (dashboard KPIs), FR-SCN-004 (scenario comparison) | FR-ENR-003, FR-ENR-004 (enrollment trends), FR-REV-010 (discount impact), FR-STC-020, FR-STC-021 (department cost), FR-AUD-001 through FR-AUD-003 (audit trail) |
| Budget Analyst | FR-ENR-001 through FR-ENR-013 (enrollment planning), FR-CAP-001 through FR-CAP-007 (capacity), FR-REV-001 through FR-REV-021 (revenue and fees), FR-SCN-001 through FR-SCN-007 (scenarios), FR-INP-001 through FR-INP-003 (input management) | FR-VER-001, FR-VER-004, FR-VER-005 (create/compare/clone versions), FR-PNL-001 through FR-PNL-006 (P&L review), FR-DSH-001 through FR-DSH-005 (dashboard), FR-STC-012 through FR-STC-014 (monthly cost review) |
| HR/Payroll Coordinator | FR-STC-001 through FR-STC-025 (employee data, salary, statutory costs, analytics), FR-DHG-018 (FTE-to-employee link) | FR-DHG-009 through FR-DHG-015 (FTE requirements context), FR-PNL-003, FR-PNL-010 (staff cost in P&L), FR-AUD-001 (audit trail for changes) |
| School Administrator | FR-ENR-001 through FR-ENR-013 (enrollment), FR-CAP-001 through FR-CAP-007 (capacity), FR-DHG-001 through FR-DHG-021 (curriculum grilles, FTE, benchmarks), FR-DSH-001 through FR-DSH-004 (dashboard KPIs) | FR-REV-011, FR-REV-012 (revenue context), FR-STC-020 (department costs overview), FR-SCN-004 (scenario comparison) |
| System Administrator | FR-AUD-001 through FR-AUD-003 (audit trail), FR-MDM-001 through FR-MDM-008 (master data configuration), FR-INP-001 through FR-INP-003 (input management) | FR-VER-003, FR-VER-006 (version lifecycle monitoring), FR-DSH-001 (dashboard health overview) |
| External Auditor | FR-VER-003, FR-VER-004, FR-VER-006 (version status, comparison, metadata), FR-PNL-001 through FR-PNL-018 (IFRS reporting and mapping), FR-AUD-001 through FR-AUD-003 (audit trail) | FR-ENR-001, FR-ENR-005 (enrollment data review), FR-REV-001, FR-REV-011 (revenue methodology review), FR-STC-011 (EoS verification), FR-DSH-001 through FR-DSH-005 (dashboard summary) |

---

## 4. User Journey Maps

### 4.1 Annual Budget Preparation

**Journey:** Budget Owner initiates the annual budget cycle, the Budget Analyst builds the financial model, HR validates staffing costs, and the Budget Owner approves and locks the final version.

**Primary Actors:** Budget Owner, Budget Analyst, HR/Payroll Coordinator
**Duration:** 2-4 weeks (target: reduced from current 4-6 week cycle)
**Trigger:** Start of annual budget planning cycle (typically Q4 of prior fiscal year)

| Step | Actor | Action | Module | Key FRs | Output |
| --- | --- | --- | --- | --- | --- |
| 1 | Budget Owner | Creates a new Budget version for FY2026, optionally cloning the prior year's budget as a starting point | Version Management | FR-VER-001, FR-VER-005 | New Draft version created with base data copied |
| 2 | Budget Analyst | Enters AY1 enrollment projections (Stage 1: headcount by grade) using 3-year historical context for reference | Enrollment & Capacity | FR-ENR-005, FR-ENR-009, FR-ENR-013 | AY1 headcount by grade entered for 15 grade levels |
| 3 | Budget Analyst | Breaks down enrollment to Stage 2: nationality (Francais, Nationaux, Autres) and tariff category (RP, R3+, Plein) per grade | Enrollment & Capacity | FR-ENR-005, FR-ENR-006, FR-ENR-007 | Full enrollment detail matrix populated |
| 4 | Budget Analyst | Reviews cohort progression model for AY2 auto-suggestions, adjusts lateral entry weights, enters PS intake estimate | Enrollment & Capacity | FR-ENR-010, FR-ENR-011, FR-ENR-012 | AY2 enrollment projections finalized |
| 5 | Budget Analyst | Clicks Calculate in Enrollment module; reviews capacity utilization and traffic-light alerts across all grades | Enrollment & Capacity | FR-CAP-001 through FR-CAP-007 | Sections needed, utilization %, and alerts generated |
| 6 | Budget Analyst | Configures AY1 and AY2 fee grids (Grade x Nationality x Tariff), sets discount policies (RP, R3+), configures other revenue line items | Revenue | FR-REV-001 through FR-REV-019 | Fee grids, discount rates, and other revenue items configured |
| 7 | Budget Analyst | Clicks Calculate in Revenue module; system computes monthly revenue using enrollment detail x net fee / period months | Revenue | FR-REV-011, FR-REV-012, FR-REV-013 | Monthly revenue forecast generated with IFRS 15 classification |
| 8 | HR/Payroll Coordinator | Maintains employee master data: updates existing staff, adds new positions for September, marks departed employees | Staffing & Staff Costs | FR-STC-001, FR-STC-002, FR-STC-003 | 168+ employee records validated and current |
| 9 | HR/Payroll Coordinator | Validates salary components for all employees; enters augmentation amounts for September; verifies Hourly Percentage for part-time staff | Staffing & Staff Costs | FR-STC-004 through FR-STC-008 | Salary components validated for cost calculation |
| 10 | HR/Payroll Coordinator | Clicks Calculate in Staffing module; system generates monthly cost budget with Sep step-change, GOSI, Ajeer, and EoS provisions | Staffing & Staff Costs | FR-STC-009 through FR-STC-014, FR-STC-019 | 12-month staff cost budget with all statutory costs |
| 11 | Budget Analyst | Reviews consolidated P&L; verifies IFRS Income Statement with Revenue, OpEx, Finance, Zakat; checks key subtotals | P&L & Reporting | FR-PNL-001 through FR-PNL-015 | Consolidated monthly P&L validated |
| 12 | Budget Analyst | Runs Base, Optimistic, and Pessimistic scenarios; reviews side-by-side comparison and delta table | Scenarios | FR-SCN-001 through FR-SCN-007 | Three scenario outputs with variance analysis |
| 13 | Budget Owner | Reviews the Dashboard KPIs (Total Revenue, Total Students, Utilization, Discount Rate), P&L summary, and scenario comparison | Dashboard, Scenarios | FR-DSH-001 through FR-DSH-005, FR-SCN-004 | Executive review completed |
| 14 | Budget Owner | Publishes the budget version, making it visible to all users including Viewer roles | Version Management | FR-VER-003 | Version transitions from Draft to Published |
| 15 | Budget Owner | After board approval, locks the budget version; system logs the lock event with timestamp and user identity | Version Management | FR-VER-003, FR-AUD-002 | Version locked; no further edits without authorized unlock |

**Post-Journey State:** A locked FY2026 Budget version exists with complete enrollment, revenue, staffing costs, and consolidated P&L. The version is immutable and serves as the baseline for all future Budget vs. Actual and Budget vs. Forecast comparisons.

---

### 4.2 Monthly Close

**Journey:** The Budget Analyst imports actual financial results for the closed month, compares them against the Budget, analyzes variances, and prepares the close report for the Budget Owner's review.

**Primary Actors:** Budget Analyst, Budget Owner
**Duration:** 2-3 business days per month
**Trigger:** Month-end financial data becomes available (typically 3-5 business days after period close)

| Step | Actor | Action | Module | Key FRs | Output |
| --- | --- | --- | --- | --- | --- |
| 1 | Budget Analyst | Selects the Actual version in the context bar for the current fiscal year | Context Bar | FR-VER-001, Section 6.1 | Actual version active in workspace |
| 2 | Budget Analyst | Enters or imports actual financial results for the closed month: actual enrollment counts, actual revenue collected, actual staff costs incurred | Enrollment, Revenue, Staffing | FR-ENR-005, FR-REV-011, FR-STC-012 | Actual data entered for the closed period |
| 3 | Budget Analyst | Clicks Calculate in each module to process actual data and generate computed fields | All Planning Modules | Section 12 (Calculate button) | Actual figures calculated and saved |
| 4 | Budget Analyst | Selects the locked Budget version as the Comparison Version in the context bar, activating variance columns across all modules | Context Bar | FR-VER-004, Section 7.3 | Budget vs. Actual comparison mode active |
| 5 | Budget Analyst | Reviews enrollment variances: actual vs. budgeted headcount by grade, section count changes, utilization shifts | Enrollment & Capacity | FR-ENR-008, FR-CAP-003, FR-CAP-004 | Enrollment variance identified per grade |
| 6 | Budget Analyst | Reviews revenue variances: actual vs. budgeted tuition revenue, fee collection rates, other revenue line items | Revenue | FR-REV-011, FR-REV-012, FR-DSH-005 | Revenue variance quantified by IFRS category |
| 7 | Budget Analyst | Reviews staff cost variances: actual vs. budgeted payroll, statutory costs, additional cost lines | Staffing & Staff Costs | FR-STC-012, FR-STC-013, FR-STC-019 | Staff cost variance identified by category |
| 8 | Budget Analyst | Opens the P&L & Reporting module; reviews the consolidated IFRS Income Statement with inline Budget vs. Actual variance columns for the closed month and YTD | P&L & Reporting | FR-PNL-001 through FR-PNL-006 | Consolidated P&L with full variance analysis |
| 9 | Budget Analyst | Drills into significant variances using waterfall breakdown to identify contributing drivers | P&L & Reporting | Section 7.3 (drill-down) | Root cause analysis for material variances |
| 10 | Budget Analyst | Exports the monthly close report (P&L with variance, enrollment summary, staff cost summary) in Excel or PDF format | All Modules (Export) | NFR Export Formats | Close report package generated |
| 11 | Budget Owner | Reviews the close report; examines Dashboard KPIs and P&L summary with variance indicators; discusses material variances | Dashboard, P&L & Reporting | FR-DSH-001 through FR-DSH-005, FR-PNL-006 | Monthly close approved or follow-up items identified |

**Post-Journey State:** Actual data for the closed month is recorded in the system. The Budget vs. Actual variance is documented and available for trend analysis. The close report is distributed to stakeholders.

---

### 4.3 Forecast Revision

**Journey:** The Budget Analyst clones the latest forecast, adjusts assumptions based on current actuals and revised outlook, recalculates projections, and presents the updated forecast to the Budget Owner for comparison against the original Budget.

**Primary Actors:** Budget Analyst, Budget Owner
**Duration:** 3-5 business days per forecast cycle (typically quarterly)
**Trigger:** Significant actual-to-budget variance detected, enrollment changes, fee adjustments, or quarterly forecast refresh cadence

| Step | Actor | Action | Module | Key FRs | Output |
| --- | --- | --- | --- | --- | --- |
| 1 | Budget Analyst | Clones the latest Forecast version (or Budget if this is the first forecast) using Version Management, creating a new Draft Forecast (e.g., FC2) | Version Management | FR-VER-005 | New Draft Forecast created with all data from source version |
| 2 | Budget Analyst | Selects the new Draft Forecast in the context bar; all modules now show the cloned data ready for adjustment | Context Bar | Section 6.1 | Forecast version active and editable |
| 3 | Budget Analyst | Adjusts enrollment assumptions: updates AY2 projections based on actual AY1 enrollment data, modifies lateral entry estimates, updates PS intake for next period | Enrollment & Capacity | FR-ENR-005, FR-ENR-010, FR-ENR-012 | Enrollment projections revised |
| 4 | Budget Analyst | Adjusts revenue assumptions: updates fee grid if rate changes are planned, modifies discount policy rates, revises other revenue estimates based on actual collection patterns | Revenue | FR-REV-001, FR-REV-007, FR-REV-016 | Revenue assumptions revised |
| 5 | Budget Analyst | Adjusts scenario parameters: updates the five adjustment factors (enrollment factor, retention, attrition, collection rate, scholarship) to reflect revised outlook | Scenarios | FR-SCN-002 | Scenario parameters recalibrated |
| 6 | Budget Analyst | Clicks Calculate in each planning module (Enrollment, Revenue, Staffing, P&L) to recalculate all projections with revised assumptions | All Planning Modules | Section 12 (Calculate button) | All financial projections recalculated |
| 7 | Budget Analyst | Selects the locked Budget version as the Comparison Version to see Forecast vs. Budget variance across all modules | Context Bar | FR-VER-004, Section 7.3 | Forecast vs. Budget comparison mode active |
| 8 | Budget Analyst | Reviews the consolidated P&L showing Forecast vs. Budget: identifies where the forecast diverges from the original plan at each subtotal level | P&L & Reporting | FR-PNL-001, FR-PNL-006 | Forecast-to-Budget variance quantified |
| 9 | Budget Analyst | Runs scenario analysis on the revised forecast; compares Base, Optimistic, and Pessimistic outcomes | Scenarios | FR-SCN-001 through FR-SCN-007 | Scenario range defined for revised forecast |
| 10 | Budget Owner | Reviews the revised forecast: Dashboard KPIs, P&L variance against Budget, scenario range; decides whether to publish | Dashboard, P&L, Scenarios | FR-DSH-001 through FR-DSH-005, FR-SCN-004 | Forecast reviewed by leadership |
| 11 | Budget Owner | Publishes the forecast version, making it available to all users; optionally locks the previous forecast (FC1) for audit purposes | Version Management | FR-VER-003, FR-AUD-002 | Forecast published; previous iteration preserved |

**Post-Journey State:** A new Forecast version (FC2) is published with updated projections. The Budget remains locked as the baseline. Both the old forecast (FC1) and the new one (FC2) are available for historical comparison. Variance between Budget and latest Forecast is visible across all modules.

---

### 4.4 Version Comparison

**Journey:** The Budget Owner selects two versions for side-by-side comparison, reviews variance across all modules, drills into drivers of significant differences, and exports the comparison report.

**Primary Actors:** Budget Owner (primary), External Auditor (secondary -- for compliance verification)
**Duration:** 30-60 minutes per comparison session
**Trigger:** Board reporting, quarterly review, audit request, or ad-hoc analysis need

| Step | Actor | Action | Module | Key FRs | Output |
| --- | --- | --- | --- | --- | --- |
| 1 | Budget Owner | Selects the primary version (e.g., Budget FY2026) in the context bar Version dropdown | Context Bar | Section 6.1 | Primary version data displayed across all modules |
| 2 | Budget Owner | Selects the comparison version (e.g., Actual FY2026 or Forecast FC2) in the Comparison Version dropdown | Context Bar | FR-VER-004, Section 6.1 | Variance columns activated across all modules |
| 3 | Budget Owner | Reviews the Dashboard with comparison active: KPI widgets show both values with delta indicators | Dashboard | FR-DSH-001 through FR-DSH-005 | Executive-level variance visible at a glance |
| 4 | Budget Owner | Navigates to Enrollment & Capacity: reviews headcount variance by grade, section count changes, utilization shifts between versions | Enrollment & Capacity | FR-ENR-005, FR-CAP-003 | Enrollment driver differences identified |
| 5 | Budget Owner | Navigates to Revenue: reviews tuition revenue variance by grade and tariff, other revenue line item differences, fee collection variance | Revenue | FR-REV-011, FR-REV-012, FR-REV-016 | Revenue driver differences quantified |
| 6 | Budget Owner | Navigates to Staffing & Staff Costs: reviews headcount changes, salary component variance, statutory cost differences | Staffing & Staff Costs | FR-STC-012, FR-STC-024, FR-STC-025 | Staff cost driver differences identified |
| 7 | Budget Owner | Opens P&L & Reporting: reviews consolidated IFRS Income Statement with inline variance for all 12 months and annual total, examining key subtotals (Revenue, Expenses, EBITDA, Operating Profit, Net Result) | P&L & Reporting | FR-PNL-001 through FR-PNL-006 | Full P&L variance analyzed |
| 8 | Budget Owner | Clicks on significant variance cells to open waterfall breakdown: identifies the top contributing drivers (e.g., enrollment drop in College drove SAR 1.2M revenue shortfall) | P&L & Reporting | Section 7.3 (drill-down) | Root causes of material variances documented |
| 9 | Budget Owner | Exports the full comparison report in Excel format: both version columns, absolute variance, percentage variance, all modules and line items | All Modules (Export) | NFR Export Formats | Comparison report exported for distribution |
| 10 | Budget Owner | Clears the Comparison Version dropdown to exit comparison mode and return to single-version view | Context Bar | Section 6.1 | Workspace returns to normal single-version display |

**Post-Journey State:** The Budget Owner has a complete understanding of the variance between two versions, with root cause analysis for material differences. An exported comparison report is available for board presentation, AEFE reporting, or external audit working papers.

---

## Appendix: Story-to-FR Cross-Reference Index

This index maps each user story to all referenced functional requirements for bidirectional traceability.

| User Story | Referenced FRs |
| --- | --- |
| US-001 | FR-VER-001, FR-VER-005, FR-VER-006 |
| US-002 | FR-VER-003, FR-AUD-001, FR-AUD-002 |
| US-003 | FR-VER-004, Section 7.3 |
| US-004 | FR-PNL-002, FR-PNL-004, FR-PNL-006, FR-PNL-007, FR-PNL-014 |
| US-005 | FR-DSH-001, FR-DSH-002, FR-DSH-003, FR-ENR-003 |
| US-006 | FR-ENR-005 through FR-ENR-013 |
| US-007 | FR-REV-001 through FR-REV-010 |
| US-008 | FR-SCN-001 through FR-SCN-007 |
| US-009 | FR-VER-004, FR-PNL-001 through FR-PNL-015 |
| US-010 | FR-PNL-016, FR-PNL-017, FR-PNL-018 |
| US-011 | FR-STC-001, FR-STC-002, FR-STC-003, FR-AUD-001 |
| US-012 | FR-STC-004 through FR-STC-008, FR-STC-012 |
| US-013 | FR-STC-011, FR-STC-013 |
| US-014 | FR-STC-002, FR-STC-009, FR-STC-010, FR-STC-012, FR-STC-020, FR-STC-021 |
| US-015 | FR-ENR-001 through FR-ENR-004 |
| US-016 | FR-CAP-001 through FR-CAP-007 |
| US-017 | FR-DHG-001, FR-DHG-002, FR-DHG-009, FR-DHG-013, FR-DHG-014, FR-DHG-016, FR-DHG-017, FR-DHG-019 through FR-DHG-021 |
| US-018 | FR-AUD-001 |
| US-019 | NFR Security (RBAC) |
| US-020 | FR-AUD-001 through FR-AUD-003 |
| US-021 | NFR Backup/Recovery, NFR Audit Trail Retention |
| US-022 | FR-VER-003, FR-VER-006 |
| US-023 | FR-AUD-001, FR-AUD-002, FR-AUD-003, FR-VER-003 |
| US-024 | FR-PNL-007 through FR-PNL-018 |
| US-025 | FR-PNL-016, FR-PNL-017, FR-PNL-018 |

---

--- End of Document ---
