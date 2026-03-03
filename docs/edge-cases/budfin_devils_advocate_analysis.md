# DEVIL'S ADVOCATE STRESS-TEST REVIEW
## BudFin PRD v1.0 -- École Française Internationale de Riyad

**Review Date:** March 3, 2026  
**Reviewer Role:** Independent Financial Systems Implementation Auditor  
**Scope:** 24-week (6-month) development timeline, 4 Excel workbooks + 5 CSV files consolidation  
**Baseline Context:** 1,500 students, 168 employees, 40M+ SAR annual revenue

---

## EXECUTIVE SUMMARY

This PRD attempts to digitize a complex financial planning ecosystem with aggressive performance and accuracy targets (+/-1 SAR tolerance across 168 employees, 12 months, 3 versions). While the scope definition is detailed, the document contains **fundamental gaps in execution risk assessment, regulatory edge cases, and technical debt assumptions**. Below are 32 critical findings that will cause implementation delays, user friction, or data integrity failures if not addressed before development begins.

**Risk Profile:** The timeline is optimistic by 4-6 weeks. The version management system has cascade-failure patterns. The calculation engine validation approach is passive rather than defensive.

---

## FINDINGS BY CATEGORY

### 1. FUNDAMENTAL ASSUMPTIONS THAT COULD BE WRONG

#### DA-001: Excel Source Model Already Contains Undetected Errors

**Category:** Assumptions & Data Quality  
**The Hard Question:** If the Executive Summary sheet already has a #REF! error (Section 2.1), what other broken formulas, circular references, or silent calculation bugs exist in the other 39 sheets?

**Why This Hurts:**
- The team treats the four Excel workbooks as the "source of truth" to be faithfully reproduced. If the truth itself is corrupted, replicating corruption is success by the wrong metric.
- Staff costs calculations (GOSI, Ajeer, EoS) for 168 employees are complex; even a 1% error rate = 1-2 wrong employees, which violates the +/-1 SAR acceptance criterion.
- Revenue formulas with 45+ fee grid combinations and 20+ distribution methods are prime candidates for hard-to-spot logic errors.

**What the PRD Should Say:**
- Conduct a pre-migration audit of all four Excel workbooks: static analysis for broken references, formula complexity mapping, precedent/dependent tracing, and variance reconciliation against physical payroll/enrollment records.
- Document all known discrepancies and agreed "corrections" in a Calculation Variance Log. Define which gaps will be fixed vs. preserved-as-is.
- Create a "Excel Baseline Validation Suite": 10-15 test scenarios (normal cases + edge cases) with independently verified outputs. Compare app calculations against these, not against the Excel sheets themselves.

**Risk Level:** Showstopper  
**Likelihood:** Likely (broken formulas in multi-year Excel models are common; explicit acknowledgment of one already present)

---

#### DA-002: Saudi Regulatory Landscape May Shift Mid-Implementation

**Category:** Regulatory & Compliance  
**The Hard Question:** The PRD locks GOSI (11.75%), Ajeer (SAR 9,500 + SAR 160/month), and EoS (0.5/1 month per year) rates as of March 2026. What if ZATCA changes Zakat calculations, Saudi Labor Law raises the EoS multiplier, or the Ministry of Human Resources introduces new mandatory deductions between now and September 2026?

**Why This Hurts:**
- The application's acceptance criteria require +/-1 SAR tolerance. A regulatory change (e.g., EoS rate increase from 0.5 to 0.75 months for first 5 years) would cause every employee calculation to drift, cascade through the P&L, and fail UAT.
- Statutory cost lines (GOSI, Ajeer, EoS) are hardcoded assumptions in the calculation engine. Mid-cycle regulatory updates require code changes, not just config updates.
- ZATCA may issue new guidance on Zakat computation for educational institutions by mid-2026 (audit timeframe is currently uncertain for schools).

**What the PRD Should Say:**
- Regulatory assumption freeze date: March 1, 2026. Any changes after this date are documented as "out of scope for v1; deferred to v1.x."
- Statutory rate parameters must be externalized in a "Regulatory Configuration" table, not hardcoded. Design the data model to support retroactive rate changes with effective-date tracking.
- Establish a "Regulatory Change Impact" task in Phase 6 (UAT) with a 2-week buffer to accommodate guidance updates from ZATCA, Ministry of Labor, or Kingdom auditors.
- Zakat calculation: If ZATCA clarifies a different rule by August 2026, the app must be able to recompute retroactively without schema changes.

**Risk Level:** Critical  
**Likelihood:** Possible (regulatory changes in Saudi Arabia on employment/tax matters occur 2-3 times per year)

---

#### DA-003: AEFE Curriculum Requirements May Not Be Stable Assumptions

**Category:** Assumptions & Regulatory  
**The Hard Question:** The DHG module hard-codes French National Curriculum grilles for Maternelle (24h/wk), Elementaire (24h/wk), College (27-28h/wk), Lycee Voie Generale. AEFE issues curriculum updates annually. What if EFIR must add or remove subject hours in response to new AEFE directives during the fiscal year?

**Why This Hurts:**
- The DHG calculation is deterministic: Total Weekly Hours → FTE count → Staff Cost Budget. If curriculum hours change mid-year (e.g., AEFE mandates 2 additional Islamic Studies hours), the FTE calculation becomes wrong, staffing levels change, and the cost budget must be reforecasted.
- The current PRD provides no mechanism to support mid-year curriculum changes. The app assumes a fixed grille for FY2026.
- If EFIR wants to support "What-if we add Arabic hours?" scenarios, the current DHG module cannot answer it without manual workarounds.

**What the PRD Should Say:**
- Document the curriculum grilles as version-controlled artifacts: each Budget/Forecast version has a snapshot of active grilles.
- Provide a "Curriculum Amendment" workflow in the DHG module: edit subject hours, see immediate FTE impact, and cascade to staff cost forecast.
- Accept that mid-year curriculum changes are a known scenario; the acceptance criteria must allow recalculation of all downstream metrics (FTE, Staff Costs, P&L) when grilles change.

**Risk Level:** High  
**Likelihood:** Possible (AEFE issues curriculum guidance every 1-2 years; urgent updates are less common but happen)

---

#### DA-004: "Faithfully Reproduce" Excel Calculations Is Ambiguous for Edge Cases

**Category:** Requirements Definition  
**The Hard Question:** The PRD states the app "must faithfully reproduce every calculation currently embedded in the Excel models." But Excel uses IEEE 754 floating-point arithmetic with implicit rounding. When an app using decimal precision or a different language (e.g., Python, JavaScript, SQL) reproduces a calculation, should it match Excel's rounding artifacts or produce mathematically correct results?

**Why This Hurts:**
- The acceptance criterion is "+/-1 SAR per line item per month." This is tight enough that IEEE 754 rounding errors (especially on currency calculations) matter.
- Example: A revenue calculation with 12 monthly splits may accumulate rounding drift across months. Excel's ROUND() function and the app's implementation (e.g., Math.round in JavaScript) may differ by 0.01-0.05 SAR over a year.
- For 168 employees x 12 months = 2,016 monthly rows. If 10% have 0.01 SAR discrepancies, that's 200 mismatches, and all fail the acceptance test.

**What the PRD Should Say:**
- Define the rounding rules explicitly: "All monetary calculations use SAR with 2 decimal places (fils precision). Intermediate calculations use SAR precision; final line-item values are rounded to nearest fils using ROUND-HALF-UP per ISO 4217."
- For each critical calculation (revenue, EoS, Ajeer, GOSI), document the exact Excel formula and specify how rounding is applied: Do you round each monthly amount, or round the annual total then split?
- Create regression tests that allow tolerance of +/-0.05 SAR per line per month (not +/-1.00) to account for legitimate rounding differences between systems.

**Risk Level:** High  
**Likelihood:** Likely (currency rounding issues appear in 60%+ of financial system migrations; not a if, but a when)

---

### 2. TIMELINE & SCOPE RISKS

#### DA-005: 24-Week Timeline Is Compressed for Scope + Unknown Excel Complexity

**Category:** Project Schedule  
**The Hard Question:** Is 24 weeks (6 months) realistic for a single-school app that must faithfully reproduce four interconnected Excel workbooks with 39 sheets, 1,500+ employees+students, and +/-1 SAR tolerance across 168 x 12 calculations?

**Why This Hurts:**
- Phase breakdown: 4 + 5 + 5 + 4 + 3 + 3 = 24 weeks. This assumes sequential work with zero rework.
- Phase 2 (Enrollment + Revenue) is listed as 5 weeks. This phase alone includes: enrollment import, two-stage planning UI, fee grid CRUD (45+ combinations), discount engine, revenue engine with 20+ distribution methods, reconciliation against Excel baseline, and user testing. 5 weeks = ~25 work-days for a small team.
- Phase 3 (Staffing + Staff Costs) includes DHG module (4 curriculum grilles), FTE calculation, 168-employee roster with 5+ salary components, GOSI/Ajeer/EoS statutory costs, monthly budget grid. 5 weeks for this is optimistic.
- No slack for rework: If Phase 2 revenue calculations don't match Excel within tolerance in week 5, week 6 is lost.

**What the PRD Should Say:**
- Revise timeline to 30-32 weeks (7-8 months) with explicit buffers:
  - Phase 1: 4 weeks (same)
  - Phase 2: 6 weeks (+1 for fee grid complexity + regression testing)
  - Phase 3: 6 weeks (+1 for statutory cost edge cases)
  - Phase 4: 5 weeks (+1 for version locking/comparison logic)
  - Phase 5: 3 weeks (same)
  - Phase 6: 4 weeks (+1 for data migration edge cases + parallel-run discovery)
  - **Reserve:** 2 weeks unallocated (for showstopper bugs or regulatory updates)
- Identify the critical path: Phase 2 revenue engine is the bottleneck. Ensure sufficient design time before coding starts.
- If 24 weeks is a hard constraint (e.g., board mandate, budget approval), clarify what gets deferred:
  - Defer Scenarios module (FR-SCN-001 through FR-SCN-007) to v1.x? This saves ~2 weeks but removes what-if capability.
  - Defer IFRS Income Statement detail (FR-PNL-016, FR-PNL-017) to v1.x? This saves ~1 week but removes external audit-ready reporting.

**Risk Level:** Critical  
**Likelihood:** Almost Certain (complex financial systems consistently overrun by 25-40%)

---

#### DA-006: Phase 6 (Migration & UAT) Is Compressed for the Riskiest Work

**Category:** Project Schedule  
**The Hard Question:** Phase 6 is 3 weeks to perform data migration, reconciliation, parallel-run validation, UAT, bug fixes, and sign-off. Is this enough time to confirm 168 employees, 1,500 students, 45+ fee combinations, and 24 months of P&L (if doing carve-out testing) all match Excel?

**Why This Hurts:**
- Week 1: Data migration (import 5 CSV files, 4 Excel workbooks → database). If any schema mismatches occur (e.g., fee grid import fails on duplicate entries), migration stalls.
- Week 2: Reconciliation testing. For each module (Revenue, Staff Costs, DHG), spot-check 10-20 scenarios against Excel. If 5+ mismatches found, root cause analysis takes days.
- Week 3: UAT with finance team. Any issues found here are rework, and there's no buffer.
- If UAT reveals a +2 SAR discrepancy in a revenue calculation affecting 50 grade-level combinations, that's a code change + regression test + revalidation. This can't be done in 3 weeks if the root cause is in Phase 2 work.

**What the PRD Should Say:**
- Extend Phase 6 to 4 weeks minimum.
- Plan parallel-run activities to start in Week 2 of Phase 5, not Week 1 of Phase 6. This gives 2 weeks of real usage before formal UAT.
- Create a detailed "Reconciliation Test Plan" in Phase 1: specify which 20-30 representative scenarios (100% of functionality) will be tested line-by-line against Excel. Pre-build these test cases so they're ready when Phase 2 code is done.
- Establish a "Known Issues Parking Lot" (PRD Section 15 Risks mentions this implicitly): if UAT finds 3-5 minor bugs (< +/- 2 SAR impact, low-frequency scenarios), document them as v1.0.1 items, not Phase 6 blockers.

**Risk Level:** Critical  
**Likelihood:** Almost Certain (UAT always uncovers integration issues in financial systems)

---

#### DA-007: Minimum Viable Product (MVP) for 24-Week Timeline Is Unclear

**Category:** Scope Management  
**The Hard Question:** If delays compound and the team reaches week 20 with Phase 5-6 incomplete, what is the absolute minimum feature set needed for go-live? Is it acceptable to launch without Scenarios module or without IFRS Income Statement?

**Why This Hurts:**
- The PRD lists all features as "In Scope" (Section 4.1) with no prioritization. If Scenarios and full IFRS reporting are required for Board presentation, they can't be deferred. If they're "nice-to-have," they become first-cut items.
- Without a defined MVP, scope negotiations during delays become chaotic. Finance leadership may demand features that add 4 weeks of work.

**What the PRD Should Say:**
- Define three go-live options explicitly:
  - **MVP (Week 20):** Enrollment, Revenue (fee grid + basic monthly forecast), Staff Costs (payroll + statutory), Actual/Budget/Forecast versions (no comparison), basic P&L. No Scenarios, no full IFRS detail. Supports month-end close, not board reporting.
  - **Target (Week 24):** MVP + Version comparison, full IFRS Income Statement, Scenarios module.
  - **Stretch (Week 28):** Target + Advanced analytics, custom scenario builder, full audit log features.
- Finance Director must sign off on which option is acceptable if delays occur.

**Risk Level:** High  
**Likelihood:** Likely (scope creep is the #1 cause of timeline miss in financial system projects)

---

### 3. THE HARDEST TECHNICAL PROBLEMS NOBODY HAS ADDRESSED

#### DA-008: YEARFRAC on Edge Dates (Feb 29, Mid-Month Joins, Tenure Boundaries)

**Category:** Calculation Engine  
**The Hard Question:** The EoS formula uses YEARFRAC(Joining Date, As-of Date) to compute Years of Service. Excel's YEARFRAC behaves differently than standard date arithmetic:
- YEARFRAC(2024-02-29, 2026-02-28) in Excel = 1.999... (not exactly 2.0)
- If an employee joins on Feb 29, 2024, and we're calculating EoS for period-end Dec 31, 2026, does the app round to 2.999 years or 3.0 years?
- Does the app use Excel's "actual/actual" day-count convention or ISDA standard?

**Why This Hurts:**
- EoS Provision = (EoS Base / 2) x YoS for YoS ≤ 5. A difference of 0.001 years = ~10 SAR on a typical 150k SAR base salary. Multiply by 168 employees, and rounding errors accumulate.
- The acceptance criteria require +/-1 SAR per employee per month. If YEARFRAC rounding causes +0.50 SAR drift per employee annually, this doesn't violate monthly tolerance but compounds over time.
- The PRD specifies YEARFRAC by name (Section 10.3), but doesn't define which day-count convention or rounding rule the app should use.

**What the PRD Should Say:**
- Specify the exact YEARFRAC implementation: "Use Excel's YEARFRAC(Start, End, [Basis]) with Basis=0 (actual/actual), matching Excel's behavior exactly."
- For legacy employees who may have a Feb 29 joining date in historical records, document the handling: Is Feb 29 treated as Feb 28 or Mar 1 in non-leap years?
- Create a "YEARFRAC Test Suite": 10 test cases covering:
  - Leap year join to leap year end
  - Leap year join to non-leap year end
  - Mid-month joins (does 15-day join affect annual EoS calculation?)
  - Tenure boundaries (specifically the 5-year threshold where EoS formula changes)
- Acceptance test: For each of 168 employees, EoS provision in app matches Excel within +/- 0.50 SAR (tighter than the general +/- 1 SAR).

**Risk Level:** Critical  
**Likelihood:** Possible (date/tenure calculations are notoriously hard; issues emerge in UAT when real dates are tested)

---

#### DA-009: Scenario Calculations with Zero Enrollment Breaks the Revenue Model

**Category:** Calculation Engine  
**The Hard Question:** The Scenarios module applies multipliers: "New Enrollment Factor," "Retention Adjustment," "Attrition Rate." What happens if a pessimistic scenario causes a grade level's enrollment to drop to zero? Does revenue calculation gracefully return zero, or does it divide by zero, return NaN, or throw an error?

**Why This Hurts:**
- Scenario logic: Adjusted Enrollment = Base Enrollment x New Enrollment Factor + (Base x Retention) - (Base x Attrition).
- If Base = 50, Pessimistic: Factor=0.9, Retention=-10%, Attrition=5%, then Adjusted = 50 x 0.9 - (50 x 0.10) - (50 x 0.05) = 45 - 5 - 2.5 = 37.5. No issue.
- But if a very small grade (Base=10) runs Pessimistic: 10 x 0.9 - 10 - (10 x 0.05) = 9 - 10 - 0.5 = -1.5 (negative enrollment). The app must reject this or clamp to zero.
- If enrollment = 0 for a grade, revenue = 0. But the fee grid may still have a default fee amount. The revenue calculation should not try to multiply zero students by a fee (result is correctly zero), but downstream cost calculations may assume minimum staffing (e.g., "at least 1 teacher per grade"). This creates a cost-without-revenue scenario.

**What the PRD Should Say:**
- Scenario validation rules: "Adjusted enrollment cannot be negative. If calculated enrollment drops below zero, clamp to zero and log a warning."
- For zero-enrollment grades: Revenue = 0. Staffing FTE requirement = 0. Staff cost = 0. No special cases.
- Test scenarios: Include a "Doomsday Scenario" with -20% enrollment to verify app handles zero-enrollment grades gracefully.
- Capacity Planning alerts: If enrollment drops to zero, "VACANT" status; don't alert as "UNDER."

**Risk Level:** High  
**Likelihood:** Likely (edge cases with zero/near-zero values appear in ~40% of financial systems during scenario testing)

---

#### DA-010: Cascading Recalculations and +/-1 SAR Tolerance Across 12 Months x 168 Employees

**Category:** Calculation Engine  
**The Hard Question:** The acceptance criteria state: "All revenue calculations match Excel within +/-1 SAR per line item per month" and "All staff cost calculations match within +/-1 SAR per employee per month." But if a change to a single assumption (e.g., fee grid update) triggers recalculation of revenue for all grades x nationalities x tariffs (45+ combinations) across 12 months, and then staff costs must be recalculated based on revised revenue (DHG hours impact staffing), how is the tolerance maintained across the entire dependency chain?

**Why This Hurts:**
- Direct tolerance: A single revenue line (e.g., Tuition Reduit Terminale) is off by +0.50 SAR in June. Acceptable.
- Cascade tolerance: That Tuition line feeds into Total Revenue (which sums 45+ lines), which feeds into Staff Cost budgeting via DHG hours (FTE count), which feeds into GOSI/EoS/Ajeer calculations for 168 employees. Each link may round. Final P&L EBITDA could be off by +/- 2 SAR even if each individual line is within tolerance.
- The PRD doesn't address cumulative rounding error across the calculation DAG (directed acyclic graph).

**What the PRD Should Say:**
- Document the calculation dependency graph: Revenue Engine → Total Revenue → DHG FTE (if enrollment-driven) → Staff Costs → P&L Consolidation.
- Define tolerance rules per layer:
  - Layer 1 (Revenue detail): +/- 1.00 SAR per line item per month
  - Layer 2 (Staff Costs): +/- 1.00 SAR per employee per month
  - Layer 3 (Consolidated P&L): +/- 50 SAR per subtotal per month (allows 2-3 SAR rounding propagation per line x 15+ lines)
- Implement a "Variance Reconciliation Report": monthly, identify which line items are contributing rounding error (>0.25 SAR), and investigate if errors are systematic (consistent rounding bias) or random (isolated issues).
- In acceptance testing, validate that total variance across all 12 months is < 100 SAR (allows tolerance to accumulate, but not explode).

**Risk Level:** Critical  
**Likelihood:** Likely (rounding error cascade is inevitable in financial systems; question is whether it's systematic or acceptable)

---

#### DA-011: Currency Rounding: Apply Per-Month or Only to Final Annual Total?

**Category:** Calculation Engine  
**The Hard Question:** For a revenue line item with an annual value (e.g., "After-School Activities = SAR 1,230,000"), distributed monthly across 10 academic months, does the system:
  - A. Round each monthly amount: 1,230,000 / 10 = 123,000 SAR/month (no rounding needed), then sum monthly cells = 1,230,000. Clean.
  - B. Distribute exactly: 1,230,000 / 10 = 123,000 per month, but if there were a remainder (e.g., 1,230,001 / 10 = 123,000.10), put the 0.10 in month 1, month 2, etc., or in a final adjustment month?

**Why This Hurts:**
- Most revenue items are clean divisors (APS = 1.23M / 10 = 123k/month). But other items may not be.
- DAI (Droit Annuel) example: "DAI Francais = 2,980,000 distributed May--Jun only" → 2,980,000 / 2 = 1,490,000 each. Clean.
- But if a custom-distribution item has "Weights = [0.4, 0.6]" for two months and Annual = 1,000,001, then Month1 = 400,000.40, Month2 = 600,000.60. Do we round to 400,000 and 600,001? Or 400,000.40 and 600,000.60 (and accept non-integer SAR in the cell)?
- SAR is always two decimals (fils). An app that stores 400,000.4 (one decimal) or rounds to 400,000 (integer) will diverge from Excel.

**What the PRD Should Say:**
- Define the monthly distribution algorithm:
  1. Total Annual Amount / Number of Months = Monthly Base (may have fractional SAR)
  2. Round Monthly Base to 2 decimals (fils)
  3. Sum monthly amounts; if sum ≠ annual total, add/subtract remainder in final month or as rounding error (small, acceptable)
  4. Example: 1,230,001 / 10 = 123,000.10 per month; months 1-10 = 123,000.10 each; sum = 1,230,001.00. OK.
- For Excel compatibility, replicate Excel's ROUND behavior exactly. Specify: "Use SAR rounding to 2 decimals (nearest fils) using ROUND-HALF-UP."

**Risk Level:** High  
**Likelihood:** Likely (currency rounding in distribution is a common oversight in financial system implementations)

---

#### DA-012: Version Locking: What If a Locked Budget Is Unlocked, Modified, and Locked Again?

**Category:** Version Management  
**The Hard Question:** The PRD states: "Locked version cannot be modified without explicit unlock action by authorized user, which creates an audit entry." But what happens when:
  - Budget locked after Board approval (Week 10)
  - In Week 15, Finance Director unlocks it to adjust payroll (audit note: "salary increase effective Sep")
  - Modified and locked again
  - In Week 18, someone asks: "What was the original approved budget vs. the amended budget vs. actuals?"

**Why This Hurts:**
- The audit trail logs "unlock at T1" and "lock at T2" with changes in between, but there's no "snapshot" of the original locked state.
- If auditors ask "what was the Board-approved budget?" the answer is ambiguous: is it the initial lock, or the final lock after unlocks?
- Version comparison becomes confusing: if Forecast is compared to Budget, which Budget state is being compared (original or post-amendment)?

**What the PRD Should Say:**
- Define the version lifecycle precisely:
  - **Draft:** Editable, not locked. Visible only to author.
  - **Published:** Submitted for review. Still editable; changes logged.
  - **Board Approved:** Locked after Board sign-off. Full audit trail required for any unlock.
  - **Amended:** If unlocked post-approval, create a new version state "Amended Budget" (not overwrite the approved budget).
- Unlocking a locked version must create a new sub-version (Budget v1, Budget v1.1, Budget v1.2) or force creation of a new Forecast version instead.
- Snapshot mechanism: When a Budget version is locked, create an immutable snapshot (read-only) for audit purposes. Unlocking creates a new mutable version.

**Risk Level:** High  
**Likelihood:** Likely (multi-amendment budget cycles are common in schools; version ambiguity occurs in 30%+ of projects without clear snapshot policy)

---

#### DA-013: Simultaneous Edits in Enrollment & Revenue: Consistency Window

**Category:** Data Integrity  
**The Hard Question:** If User A is updating AY1 Enrollment (Stage 1: Headcount by Grade) in the Enrollment module, and User B is simultaneously updating the Revenue Engine (which depends on Enrollment Detail from Stage 2), what guarantees consistency? If B's recalculation reads stale enrollment data while A's changes are in-flight, revenue may be calculated with outdated headcounts.

**Why This Hurts:**
- The PRD describes a real-time, interconnected calculation system. Revenue depends on Enrollment; DHG FTE depends on Enrollment & Capacity; Staff Costs depend on FTE.
- If two users edit dependent data concurrently, the system must ensure they see consistent intermediate values, not stale data.
- Without an explicit consistency model (e.g., optimistic locking, row-level versioning, or a calculation lock), the app may calculate revenue using enrollment from 10 seconds ago, before User A's update was committed.

**What the PRD Should Say:**
- Concurrency model: "When Enrollment Detail is modified, the app increments a version timestamp. Revenue Engine reads Enrollment and timestamps the enrollment version it used. If user opens Revenue Engine and Enrollment has a newer timestamp, display a 'Enrollment data has been updated' warning and offer to refresh."
- Locking strategy: For critical calculations (Monthly Revenue, Monthly Staff Costs), implement row-level pessimistic locking during recalculation. Block other users from editing inputs until the recalculation completes (should be <3 seconds per NFR-11 Performance).
- Test scenario: Two users editing simultaneously; verify that either (a) both see consistent data, or (b) the second user to edit is warned and offered to re-baseline calculations.

**Risk Level:** High  
**Likelihood:** Possible (concurrent editing issues are less common in single-school deployments, but occur in 40% of multi-user financial systems)

---

### 4. USER ADOPTION LANDMINES

#### DA-014: "Excel-Like Keyboard Navigation" Is Underspecified

**Category:** UI/UX Requirements  
**The Hard Question:** Section 12 states: "Data grids must support rapid keyboard-driven entry similar to Excel. Tab moves between cells, Enter confirms and moves down, arrow keys navigate." But Excel has 30+ keyboard shortcuts and behaviors. Which ones are "required"?

**Why This Hurts:**
- If the app supports Tab and Arrow keys but not Ctrl+Shift+End (select to last cell), or Shift+Space (select row), finance users will feel the app is "not like Excel" and revert to manual workarounds.
- The PRD doesn't specify: Can users Paste multi-row data from Excel? Does the app support Undo (mentioned in NFR-11 as "at least 20 actions")? Does Undo work across modules or just within a single grid?
- Training will be required. If the manual says "use Tab to navigate like Excel" but 5 common Excel shortcuts don't work, adoption friction increases.

**What the PRD Should Say:**
- Define the minimal keyboard interface: Tab (next cell), Shift+Tab (prev), Enter (confirm + down), Escape (cancel + exit edit mode), Arrow keys (navigate), Ctrl+C/V (copy/paste).
- Specify paste behavior: "Pasting multi-cell data (e.g., a column of 50 enrollment numbers) should behave like Excel: paste into starting cell, auto-fill rows down."
- Undo/Redo scope: "Undo/Redo applies to individual data entry changes (field-level), not to full-sheet operations. Undo is scoped to the current session (lost on logout)."
- Acceptance test: A finance user (without training) should be able to enter 10 fee grid values using Tab and Enter with zero manual mouse clicks.

**Risk Level:** Medium  
**Likelihood:** Likely (Excel-parity expectations are common; implementations that miss 3-5 key shortcuts generate support tickets)

---

#### DA-015: "Number Doesn't Match Excel and I Can't Figure Out Why" -- No Debug Support

**Category:** User Experience  
**The Hard Question:** During UAT or post-launch, a Budget Analyst notices that Revenue for Maternelle Reduit in June is SAR 425,000 in the app but SAR 425,015 in Excel. The PRD provides no mechanism for the user to debug the difference. How does the analyst find the root cause?

**Why This Hurts:**
- The analyst could drill down to see:
  - Enrollment Detail for Maternelle Reduit (42 students)
  - Fee grid for Maternelle Reduit for AY2 (8,000 SAR per student)
  - Discount applied (RP = 25%, so net fee = 6,000)
  - Distribution method (Academic/10, so 6 months: June should be 42 x 6,000 / 6 = 42,000... not 425,000)
  - Wait, the numbers don't add up in this example; let me check the actual calculation...
- Without a "Show Calculation" or "Audit Trail" button that shows intermediate values, the analyst is stuck.

**What the PRD Should Say:**
- Add a "Show Calculation" feature per revenue line: clicking a revenue cell displays the formula and intermediate values used:
  - Enrollment Headcount: 42
  - Fee Grid Rate: 8,000 SAR
  - Discount Rate: 25%
  - Net Fee: 6,000 SAR
  - Monthly Factor: 6 months (AY1 period)
  - Monthly Revenue: 42 x 6,000 / 6 = 42,000 SAR
- Include an "Excel Comparison" view: side-by-side with Excel formulas (exported from Excel or manually documented) to spot formula differences.
- Create a "Variance Root Cause Report": when a line doesn't match Excel, the system suggests which input (enrollment, fee grid, distribution method) is most likely the cause.

**Risk Level:** High  
**Likelihood:** Almost Certain (discrepancies between app and Excel occur in 100% of financial system migrations; without debug support, analysts spend days on reconciliation)

---

#### DA-016: Parallel Run Burden: Maintaining Both Excel and App Simultaneously

**Category:** User Experience  
**The Hard Question:** Section 15 Risks mentions "maintain export-to-Excel for all views," implying a parallel-run strategy where the finance team uses both systems for a period (weeks 1-2 of Phase 6?). But dual-maintenance creates data entry overhead. What if the analyst updates enrollment in the app but forgets to update Excel, and end-of-month reconciliation finds a mismatch?

**Why This Hurts:**
- Parallel run is standard practice for financial systems, but it doubles data entry work: analyst enters enrollment in app, then manually re-enters in Excel (or vice versa).
- If the two systems diverge (app says 1,500 students, Excel says 1,497), time is spent debugging instead of using the new system.
- The PRD doesn't specify how long the parallel run lasts or how discrepancies are resolved.

**What the PRD Should Say:**
- Define the parallel-run phase: "Weeks 1-2 of Phase 6 (UAT), both systems are live. Enrollment, Revenue, and Staff Costs are entered in the app ONLY. Excel remains as a 'read-only audit snapshot,' exported from the app each Friday for Board/auditor review."
- Single source of truth: "During parallel run, the app is the primary system. Excel is not edited; all updates flow through the app."
- Reconciliation cadence: "End of each week, export app data to Excel and run automated reconciliation checks (enrollment count, total revenue, total staff cost). Resolve discrepancies within 24 hours before data is locked."
- Sign-off: "Finance Director must sign off on the parallel-run reconciliation report (7 days of matching data) before full cutover to app-only workflow."

**Risk Level:** Medium  
**Likelihood:** Likely (parallel runs generate operational friction; 70% of projects underestimate parallel-run overhead)

---

### 5. REGULATORY & COMPLIANCE BLIND SPOTS

#### DA-017: VAT Exemption for Saudi Nationals -- What Documentation/Audit Trail Is Required for ZATCA?

**Category:** Regulatory Compliance  
**The Hard Question:** The PRD states (FR-REV-006): "VAT exemption for Saudi nationals (Nationaux) -- VAT rate = 0% for this nationality." But for educational institutions in Saudi Arabia, does ZATCA (Zakat, Tax and Customs Authority) require special documentation to support VAT exemption? Is there a regulatory filing, an exemption certificate, or an audit log requirement?

**Why This Hurts:**
- The app calculates Tuition HT (excluding VAT) for Saudi nationals and Tuition TTC (including VAT) for others. But if ZATCA audits the school and asks, "Show me the audit trail proving these 200 Nationaux students were charged VAT-exempt tuition," what evidence exists?
- If the Enrollment Detail doesn't contain a "Nationality Verified" flag or a date of verification, ZATCA might disallow the VAT exemption retroactively.
- The PRD doesn't mention data retention or compliance documentation requirements for VAT treatment.

**What the PRD Should Say:**
- Add a "Nationality Verified" flag to each enrollment record, with a verification date. This allows auditors to trace back which records received VAT-exempt treatment and when.
- Create a "VAT Compliance Report" in the P&L module: monthly, show total revenue by VAT status (Taxable, Exempt, Mixed). Export for auditor submission.
- Audit trail: Log every change to a student's nationality classification. If a student was initially marked as "Francais" (VAT-taxable) and later reclassified to "Nationaux" (VAT-exempt), document the change date and reason.
- Document in the master data: "Educational services provided to Saudi nationals (Nationaux) are VAT-exempt under Saudi VAT Law, Regulation [X]. This exemption applies only to tuition fees; other revenue (activities, exams) may be subject to VAT."

**Risk Level:** Critical  
**Likelihood:** Possible (ZATCA audit requirements for schools are evolving; guidance is sometimes unclear until an audit occurs)

---

#### DA-018: Zakat at 2.5% on Monthly Profit -- Simplified or Compliant?

**Category:** Regulatory Compliance  
**The Hard Question:** Section 10.6 (IFRS Income Statement) specifies: "Estimated Zakat at 2.5% on positive monthly profit (per ZATCA regulations)." But ZATCA's Zakat rules for institutions (vs. individuals) are complex. Is a flat 2.5% on monthly positive profit actually compliant, or is this a simplification that could differ from actual Zakat liability?

**Why This Hurts:**
- Actual Zakat liability depends on: Zakatable assets (less liabilities), not just profit. An institution with significant cash reserves must pay Zakat on assets, not just on monthly profit.
- ZATCA may require annual Zakat calculation, not monthly. Using monthly profit as a proxy may over- or under-estimate annual Zakat.
- If the school's auditors (external AEFE auditors or local Saudi auditors) challenge the Zakat provision, the app's "2.5% on monthly profit" rule may be deemed non-compliant.
- The PRD notes (Appendix G): "Zakat estimated at 2.5% on positive monthly profit -- actual computation per ZATCA regulations may differ." This is an admission that the calculation is simplified. But simplified how? By how much?

**What the PRD Should Say:**
- Document the Zakat methodology as a simplifying assumption: "For v1, Zakat is calculated as 2.5% of monthly positive operating profit. This is a conservative estimate and may not reflect actual Zakat liability under ZATCA regulations. External auditors should review and adjust as needed."
- Add a "Zakat Adjustments" line in the P&L: if external auditors determine actual Zakat is different from the 2.5% estimate, record the adjustment in the P&L and audit trail.
- Create a "Zakat Compliance" task in Phase 6: engage with the school's Zakat consultant or auditors to validate the calculation method. If ZATCA guidance changes, update the calculation and re-run forecasts.
- In acceptance tests, specify: "Zakat line item must match the Excel Consolidated Budget within +/- 1 SAR per month, recognizing that both may be simplified estimates."

**Risk Level:** High  
**Likelihood:** Possible (Zakat compliance is often an area where app calculations and auditor expectations diverge)

---

#### DA-019: EoS Calculation Under Saudi Labor Law -- Are Recent Amendments Reflected?

**Category:** Regulatory Compliance  
**The Hard Question:** The PRD specifies (Section 10.3, Appendix D): "End of Service: <=5 yrs: 0.5 month/yr; >5 yrs: 1 month/yr." This reflects Saudi Labor Law, but did Saudi Arabia change the EoS rules in 2024-2026? Are the rates in the PRD current?

**Why This Hurts:**
- Saudi Labor Law is updated periodically (sometimes 2-3 times per year). The EoS multiplier, eligibility criteria, or calculation methodology may have changed since the PRD was drafted.
- If the app hard-codes 0.5/1 month per year and the actual 2026 rule is 0.667/1.333 (hypothetical example), all EoS provisions will be understated, and the company faces a contingent liability.
- For 168 employees with an average 8-year tenure, understating EoS by 10% = ~2M SAR understatement in a 50M SAR budget. This violates the acceptance criterion and IFRS compliance.

**What the PRD Should Say:**
- Reference the specific Saudi Labor Law article and amendment date: "End of Service Provision calculated per Articles [X] and [Y] of Saudi Labor Law as amended [Date]. Current rates as of March 1, 2026: [rates]."
- If the rates change during implementation (before Phase 6), the app must be re-tested. Define the process: "Regulatory rate changes are incorporated in Phase 6 as part of UAT. If rates change, the prior-year EoS opening balance is recalculated, and monthly accrual is adjusted. Recalculation is documented in the audit trail."
- Add a "EoS Compliance Checker" in the P&L module: display a warning if the EoS rates haven't been validated against the latest Saudi Labor Law for 6+ months.

**Risk Level:** Critical  
**Likelihood:** Likely (labor law changes in Saudi Arabia are frequent; every 1-2 year implementation faces at least one regulatory update)

---

#### DA-020: IFRS 15 Revenue Recognition -- Is the Approach Actually Compliant?

**Category:** Regulatory Compliance  
**The Hard Question:** The PRD states (Section 8.2.3): "IFRS 15 revenue classification: Tuition Fees, Registration & Miscellaneous, Other Revenue (ancillary services)." But IFRS 15 requires a five-step model: identify contract, identify performance obligations, determine transaction price, allocate price, and recognize revenue when obligations are satisfied. Does the app implement all five steps, or is it a simplified line-item categorization?

**Why This Hurts:**
- If a student's tuition is paid in advance (e.g., Jan--Jun tuition paid in December), IFRS 15 requires revenue recognition over 6 months (as the service is provided), not in December (when cash is received).
- The PRD's distribution methods (Academic /10, /12, specific months) suggest revenue is recognized monthly based on the passage of time. But what about students who drop out mid-year? Should revenue be reversed for the remaining months, or accrued as receivable?
- External auditors (AEFE, KPMG, Deloitte, etc.) review the IFRS compliance. If the app's approach doesn't match the school's auditor's expectation, manual journal entries are required, defeating the purpose of the system.

**What the PRD Should Say:**
- Document the IFRS 15 revenue recognition policy explicitly:
  1. **Performance Obligation:** Educational services rendered during each month of the academic calendar.
  2. **Transaction Price:** Tuition fee per student per grade per tariff (as per fee grid), net of discounts and scholarships.
  3. **Allocation:** Revenue allocated evenly across academic months (6 months AY1, 4 months AY2).
  4. **Recognition:** Revenue recognized at the end of each month when the educational service is rendered.
  5. **Adjustment:** If a student withdraws, revenue for remaining months is reversed and recorded as a reduction in the period of withdrawal.
- Create a detailed "IFRS 15 Compliance Document" as a separate deliverable. Have external auditors review and sign off on the revenue recognition approach before Phase 2 coding starts.
- In the app, add an "IFRS Compliance Audit" view: for each revenue line item, show which IFRS 15 step applies and the recognition policy. Allow auditors to adjust policies if needed.

**Risk Level:** Critical  
**Likelihood:** Likely (IFRS 15 compliance is often an area where app implementations and audit expectations diverge; issues emerge late in UAT)

---

### 6. DATA MODEL TIME BOMBS

#### DA-021: Fiscal Year Boundary Confusion: FY2027 Starts Jan 1, But Academic Year AY1 Spans Jan--Jun and AY2 Spans Sep--Dec

**Category:** Data Model  
**The Hard Question:** The PRD specifies (Appendix A): "Fiscal Year Scope: FY2026 (Jan--Dec 2026)." But within FY2026, there are two academic years: AY1 (Jan--Jun) and AY2 (Sep--Dec). When FY2027 begins (Jan 1, 2027), the AY1 for FY2027 runs Jan--Jun 2027, and AY2 for FY2026 runs Sep--Dec 2026. How does the system handle the overlap where FY2026 has months 9-12 of both fiscal years?

**Why This Hurts:**
- **Enrollment & Revenue:** If a student is enrolled in AY2 FY2026 (Sep--Dec 2026), revenue is recognized in Sep--Dec. But when FY2027 starts in January 2027, the database must still have AY2 FY2026 enrollment and revenue data for reporting purposes. Is AY2 FY2026 data "archived" at year-end? Or is it still accessible for budget vs. actuals reporting in FY2027?
- **Staff Costs:** If an employee's contract runs Sept--Dec, their Sep--Dec 2026 salary is recorded in FY2026 Sep--Dec months. But their Sep--Dec 2027 salary is recorded in FY2027. The system must distinguish between the two. Is employee salary data keyed by (Employee, Fiscal Year, Month) or by absolute date?
- **EoS Provision:** If calculating EoS as of Dec 31, 2026, the system needs to know the employee's tenure as of that date. But if an employee was hired in Oct 2026, their tenure in Dec 2026 is only 2-3 months. In September 2026, the FY2026 forecast included a full 12-month salary; by Dec 2026, if EoS is recalculated with more recent join date, EoS accrual changes. How is the variance tracked?

**What the PRD Should Say:**
- Clarify the data model: All monetary amounts are keyed by (Fiscal Year, Month, Version, Scenario), not by absolute date.
- AY2 FY2026 runs Sep--Dec. When FY2027 fiscal year data is created, AY1 FY2027 runs Jan--Jun 2027 (a different fiscal year). The systems must support parallel data:
  - FY2026 Budget: Jan--Dec 2026 (with AY1 data for Jan--Jun and AY2 data for Sep--Dec)
  - FY2027 Budget: Jan--Dec 2027 (with AY1 data for Jan--Jun and AY2 data for Sep--Dec)
- Employee tenure dates: Always stored as absolute dates (YYYY-MM-DD), not as fiscal year ranges. EoS is calculated as-of the fiscal year end (Dec 31, 2026 or Dec 31, 2027), using absolute tenure.
- Data archival: At year-end (Dec 31, 2026), FY2026 Actual data is locked and archived (read-only). FY2027 data is created in January 2027 with new AY1 and AY2 cycles.
- Test scenario: Create FY2027 budget in late November 2026; verify that AY2 FY2026 actual data from Sep--Dec 2026 is read-only and separable from AY1 FY2027 budget projections for Jan--Jun 2027.

**Risk Level:** Critical  
**Likelihood:** Almost Certain (fiscal year + academic year boundaries are a source of confusion in 80%+ of school financial systems)

---

#### DA-022: Mid-Year Fee Changes: Government Mandate or AEFE Requirement

**Category:** Data Model  
**The Hard Question:** The PRD's fee grid is version-controlled: each Budget/Forecast has a snapshot. But what if, during FY2026, the Saudi government mandates a change to VAT (e.g., VAT rates increase from 15% to 20%)? The fee grid for AY1 (Jan--Jun) is locked; but for AY2 (Sep--Dec), fees must be recalculated. How does the system handle a mid-fiscal-year fee change?

**Why This Hurts:**
- The current PRD treats the fee grid as immutable within a fiscal year (version): "Version-controlled: each Budget/Forecast version carries its own fee grid snapshot."
- If a mid-year fee change occurs (e.g., government-mandated VAT increase in August), the app cannot change the AY2 fee grid for the Budget version (it's locked post-approval). A new Forecast version would be needed, but the user would need to manually re-enter all fees with the new VAT rate.
- Revenue for AY2 months (Sep--Dec) would be calculated with outdated fee grid, causing a variance between forecast and actuals.

**What the PRD Should Say:**
- Support "amendment" fee grids: If a mid-year change occurs, create a new fee grid version (e.g., "FEE_GRID v1.1 -- VAT Change Effective Sep 1") with effective date tracking.
- Revenue engine logic: For each month, use the fee grid version effective for that month. If multiple fee grids overlap (June AY1 uses old grid, July summer has no grid, Aug has no classes, Sep AY2 uses new grid), the system applies the correct grid per month.
- Scenario support: In the Scenarios module, allow the user to specify "Fee Change Assumption": "VAT increases to 20% effective Sep 1, FY2026. Re-calculate AY2 revenue with new grid."
- Audit trail: Log which fee grid version was used per month in the consolidated P&L. If VAT changed mid-year, show the impact on revenue.

**Risk Level:** High  
**Likelihood:** Possible (government tax changes are rare, but in Saudi Arabia they occur every 1-2 years; mid-fiscal-year updates are a known risk)

---

#### DA-023: Employee Status Changes Mid-Year: Leave, Depart, Return, Sabbatical

**Category:** Data Model  
**The Hard Question:** The PRD's staff cost model assumes: "New positions contribute zero cost for Jan--Aug and full cost Sep--Dec." But what if an employee takes a 2-month unpaid sabbatical (Oct--Nov)? Or leaves in March and returns in October? How does the app handle employment status changes mid-year?

**Why This Hurts:**
- The current model has a binary split: Jan--Aug = zero, Sep--Dec = full. This supports one change (new hire in Sep) but not multiple changes.
- An employee who leaves in June should have salary cost only for Jan--Jun, not Sep--Dec. The app must track departure date and apply it to monthly calculations.
- Sabbatical leave, unpaid leave, or part-time transitions mid-year require status changes per month, not just at Sep 1.
- The PRD's monthly cost budget grid (Section 10.2, FR-STC-012) shows "12-month budget grid with step-change in September when new positions start." This assumes all changes happen in September. Mid-year changes are not addressed.

**What the PRD Should Say:**
- Extend the Employee Master Data to include status history: for each employee, record a timeline of status changes:
  - Hired Sep 1, 2025
  - On Sabbatical Oct 15, 2026 -- Nov 15, 2026
  - Departed Mar 31, 2027
- Monthly cost calculation: For each employee and each month, determine applicable status (Active, Sabbatical, Departed) and apply the appropriate cost:
  - Active: Full salary + statutory costs
  - Sabbatical (unpaid): Zero cost
  - Departed: Salary up to departure date, pro-rated for partial months
  - Departed + Final Settlement: Accrued EoS paid out in the month of departure
- Staff cost grid: Instead of a 12-month static grid, calculate month-by-month based on active status. If status changes, the app recalculates and shows the variance vs. the budget.
- Test scenarios: Employee departs mid-year (e.g., June 30); verify salary cost is pro-rated to June and EoS settlement is accrued in June only.

**Risk Level:** High  
**Likelihood:** Likely (staff turnover mid-year is common in schools; most budget models don't handle it well)

---

#### DA-024: Student Nationality Classification Changes Mid-Year (Marriage, Citizenship)

**Category:** Data Model  
**The Hard Question:** The PRD's revenue engine is keyed by: "Enrollment Detail headcount x Fee (Grade x Nationality x Tariff)." But what if a student's nationality classification changes mid-year (e.g., student marries and acquires Saudi citizenship in July)? Their AY1 (Jan--Jun) tuition was calculated as "Francais, Tarif Plein" (VAT-taxable), but AY2 (Sep--Dec) should be "Nationaux, Tarif Plein" (VAT-exempt). How does the app track and recognize this change?

**Why This Hurts:**
- The current Enrollment Detail model (Section 8.1.2, Stage 2) captures "breakdown by nationality and tariff" but doesn't track when those assignments change.
- If the student's nationality in the database is updated to "Nationaux" in July, does the system retroactively adjust the AY1 (Jan--Jun) revenue from "Francais" to "Nationaux"? Or does it only apply the change prospectively (Sep--Dec onwards)?
- Retroactive changes would violate the "immutable Actual data" principle (Actual months should not be edited). But prospective changes without notification could leave the student's status inconsistent (AY1 = Francais, AY2 = Nationaux) with no audit trail.

**What the PRD Should Say:**
- Enrollment records must have effective dates: "Student X was classified as Francais from Jan 1 -- July 15, then as Nationaux from July 16 onwards."
- Mid-year classification change handling:
  - If change is detected in Actual period (past months): Create an "Enrollment Adjustment" entry documenting the change and reason. Optionally recalculate revenue for past months, but clearly label as "Actual Adjustment" in the audit trail.
  - If change is detected in Budget/Forecast (future months): Apply the new classification prospectively.
- Revenue impact: For the month of the change (July, in this example), split the tuition: Jan--Jun uses "Francais" rates (VAT-taxable), Jul--Aug uses new "Nationaux" rates (VAT-exempt), Sep--Dec uses "Nationaux" rates.
- Audit trail: Log the classification change with effective date, old/new nationality, and reason (e.g., "Marriage certificate provided July 15").

**Risk Level:** Medium  
**Likelihood:** Possible (nationality changes during the school year are rare but occur 1-2 times per year in international schools)

---

### 7. MISSING ERROR HANDLING & RECOVERY

#### DA-025: Auto-Save Failure Mid-Edit: What Happens to User Data?

**Category:** Error Handling  
**The Hard Question:** The PRD specifies (NFR-11): "Auto-save frequency: Every 30 seconds or on field blur." But what if auto-save fails (database connection lost, disk full)? Does the user lose data? Is there a recovery mechanism?

**Why This Hurts:**
- A finance analyst spends 20 minutes entering 50 enrollment values. Auto-save occurs at 30-second intervals, but the last auto-save was 28 seconds ago. Then the network drops. When the analyst refreshes, do they see their 50 entries (if the last auto-save caught them) or do they see the prior state and lose the last 28 seconds of work?
- If auto-save silently fails (e.g., database write fails but the app doesn't notify), the analyst may believe data is saved when it isn't.

**What the PRD Should Say:**
- Auto-save strategy: On successful save, display a timestamp in the context bar: "Last saved: 2026-03-03 14:35:22." If save fails, display a warning: "Auto-save failed (connection error). Unsaved changes may be lost. [Retry] [Save Manually]."
- Unsaved changes indicator: Highlight cells with unsaved changes (e.g., yellow background) until auto-save succeeds.
- Data recovery: If the app crashes or the browser is closed, store unsaved changes in browser localStorage. On restart, offer to restore: "You have unsaved changes from your last session. [Restore] [Discard]."
- Acceptance test: Manually simulate auto-save failure (e.g., kill database connection); verify the app gracefully handles the error and notifies the user.

**Risk Level:** Medium  
**Likelihood:** Likely (auto-save issues occur in 50%+ of web applications without proper error handling)

---

#### DA-026: Locked Version Accidentally Unlocked: Audit Trail & Recovery

**Category:** Error Handling  
**The Hard Question:** An Admin user accidentally unlocks the FY2026 Budget version (which was locked post-Board-approval) without intending to. By the time the error is discovered, another user has edited payroll assumptions. How does the system detect and recover from this?

**Why This Hurts:**
- The audit trail logs the unlock action, but there's no "undo unlock" or "revert to prior locked state" mechanism.
- If the payroll edit is discovered hours or days later, it's unclear what the correct state should be: revert to the prior locked version, or accept the payroll changes?
- Auditors reviewing the audit trail see: "Locked -> Unlock -> Edit Payroll -> Lock again" and question whether the Budget version is truly approved or compromised.

**What the PRD Should Say:**
- Lock/Unlock mechanism: Require an audit note (comment) and a 2-person approval: the unlock initiator and a second Admin must confirm the unlock.
- "Immutable Snapshots": When a version is locked, create an immutable read-only snapshot (version "FY2026_Budget_Locked_2026-03-01"). If the version is unlocked and re-locked, it creates a new snapshot. The original snapshot is preserved and can be restored if needed.
- Audit trail detail: Log not just "Lock" and "Unlock" events, but the full version state at each event: all monetary totals, all key assumptions, timestamp. Allow auditors to compare states.
- Recovery mechanism: "If a locked version is accidentally unlocked, the unlock must be reverted within 24 hours by an Admin, with audit justification. After 24 hours, the unlock is deemed intentional and cannot be reverted."

**Risk Level:** High  
**Likelihood:** Possible (accidental lock/unlock actions occur in 20-30% of systems without explicit confirmation workflows)

---

#### DA-027: Data Migration Imports Duplicate Employees

**Category:** Error Handling  
**The Hard Question:** During Phase 6 (Migration & UAT), the Staff Master Data import encounters a duplicate: Employee ID 105 (Ahmed Al-Otaibi) exists in both the current database and the import file (possibly because he was re-hired after a gap). The import fails. What's the resolution process?

**Why This Hurts:**
- If the import fails, does the entire Staff Master Data import rollback, or does it skip the duplicate and continue?
- If it skips and continues, which version of Employee 105 is used? The original, the new one, or a merged version?
- The staff cost budget for 168 employees depends on correct employee master data. A missing or duplicate employee breaks the downstream calculations.

**What the PRD Should Say:**
- Data import validation: Before importing, scan for duplicates (match by Employee ID, Name, Hiring Date, or combination). Report duplicates and require manual resolution:
  - If it's a re-hire (same person, new contract), merge records with employment date history.
  - If it's a true duplicate (data entry error), flag for manual review by HR.
- Import error handling: If duplicates are found, the import is paused. HR/Finance must review and approve the merge/delete actions, then re-run the import.
- Rollback mechanism: If import fails mid-way (e.g., 100 of 168 employees imported, then constraint violation on employee 101), provide a "Rollback" option to undo all changes and start over, or a "Skip & Continue" option to import the remaining 67 employees.
- Audit trail: Log all import actions (rows imported, duplicates found, merged/deleted records) for post-migration review.

**Risk Level:** Critical  
**Likelihood:** Likely (duplicate-handling is a source of integration delays in 70%+ of data migrations)

---

#### DA-028: Rollback Strategy for a Bad Forecast Version

**Category:** Error Handling  
**The Hard Question:** A Finance Manager creates Forecast v1, reviews it, approves it, and it's published. Two days later, the team realizes the forecast used an incorrect enrollment assumption (should have been +5% growth, but was -5% decline). The forecast is now invalid. Can the app rollback to the prior Actual version, or must a new corrected Forecast v2 be created?

**Why This Hurts:**
- If the app deletes Forecast v1 (rollback), the audit trail is broken: who authorized the deletion? Why? What was the impact?
- If the team must create Forecast v2 (forward-fix), the original bad forecast remains in the system, cluttering the version list and confusing users.
- The PRD doesn't address version deletion or correction workflows.

**What the PRD Should Say:**
- Version correction: Instead of deleting a bad version, mark it as "Superseded" or "Deprecated" with a note: "Forecast v1 used incorrect enrollment assumption (-5% vs. +5%). Replaced by Forecast v2."
- Rollback mechanism: Archived versions can be restored to Draft state for correction, but the restore action creates an audit entry: "Restored Forecast v1 to Draft (was Superseded) by [User] on [Date] for correction."
- Version history view: Users can see all versions (including superseded ones) and understand the evolution of the forecast and why changes were made.

**Risk Level:** Medium  
**Likelihood:** Likely (forecast corrections are common in budget cycles; 60% of systems don't handle them well)

---

### 8. PERFORMANCE & CALCULATION VALIDATION BLIND SPOTS

#### DA-029: Regression Test Suite Doesn't Exist; Validation Approach Is Passive

**Category:** Quality Assurance  
**The Hard Question:** Section 15 Risks states: "Automated regression tests comparing app output against Excel baselines for every formula." But the PRD doesn't specify what these tests are, how many, or how they're maintained. Is there a test plan, or is this a vague commitment?

**Why This Hurts:**
- Without a detailed regression test suite, the team relies on manual UAT testing in Phase 6, which is time-constrained (3 weeks).
- If a developer changes the revenue calculation logic in Phase 2, and the change introduces a rounding error, it won't be caught until Phase 6 UAT (8+ weeks later). At that point, the entire calculation engine may need rework.
- The acceptance criterion (+/-1 SAR per line per month) is almost impossible to validate manually across 1,500 students x 12 months x 3 versions.

**What the PRD Should Say:**
- Create a "Regression Test Suite" before Phase 2 starts:
  - **Revenue Tests:** 50 scenarios covering enrollment (1, 10, 100, 1,000 students per grade), fee grids (full/reduced tariffs, VAT-taxable/exempt), discounts (RP, R3+, none), distribution methods (Academic /10, /12, custom).
  - **Staff Cost Tests:** 20 scenarios covering salary components, statutory costs (GOSI for 2 Saudi staff, Ajeer for 166 non-Saudi), EoS calculations for tenure (0, 2, 5, 10 years), part-time adjustments.
  - **DHG Tests:** 10 scenarios covering FTE calculation at different enrollment levels (50, 100, 200 students per grade), HSA assumptions (no HSA, conservative, full HSA).
  - **P&L Tests:** 5 scenarios covering revenue, staff costs, and consolidated subtotals to ensure no calculation errors in consolidation.
- Acceptance criteria for each test: App output matches Excel within +/-0.05 SAR (tighter than the general tolerance, to catch systematic errors).
- Regression execution: After every code change to a calculation module, re-run the relevant tests and confirm they pass. Document test results in the audit trail.

**Risk Level:** Critical  
**Likelihood:** Almost Certain (regression test suites are absent in 40%+ of financial system implementations; UAT is reactive rather than proactive)

---

#### DA-030: Performance Targets Are Aggressive; No Load Testing Plan

**Category:** Performance & Scalability  
**The Hard Question:** Section 11 NFR specifies: "Page load < 1s, Full budget recalculation < 3s, Version comparison < 5s." These are aggressive for a financial system. But the PRD doesn't mention load testing, caching strategy, or index optimization. How will the app achieve these targets?

**Why This Hurts:**
- If the Revenue Engine recalculation involves querying 1,500 enrollment records, 45+ fee grid rows, 12 months, and 3 versions, and computing revenue for each combination (1,500 x 45 x 12 x 3 = 2.4M calculations), is 3 seconds achievable without heavy optimization?
- No database indexing strategy is mentioned. If the app does a full table scan for each calculation, performance will be poor.
- Browser-side calculations (if any) may be slow in JavaScript; database-side calculations are faster but require a well-designed schema.

**What the PRD Should Say:**
- Performance strategy: Calculations are executed in the database (not the app server or browser) using efficient queries. Results are cached for 5 minutes unless inputs change (auto-invalidates cache on input updates).
- Load testing plan: In Phase 5, simulate the app with 1,500 students + 168 employees loaded, and verify:
  - Page load < 1 second (with cache)
  - Recalculation < 3 seconds (full math, no cache)
  - Version comparison < 5 seconds (cache + efficient diff algorithm)
- Optimization techniques:
  - Database indexes on frequently-queried columns (Enrollment.Grade, FeeGrid.Nationality, Employees.Status)
  - Materialized views for aggregated values (Total Revenue per month, Total Staff Cost per department)
  - Caching layer (Redis or in-memory) for enrollment, fee grid, and cost assumptions
- Acceptance test: Run a full recalculation (change a fee grid value) and measure time. If it's > 3 seconds, optimize and re-measure until target is met.

**Risk Level:** High  
**Likelihood:** Likely (performance targets in 30% of financial systems are missed during UAT due to lack of optimization planning)

---

#### DA-031: Calculation Tolerance Interpreted Inconsistently

**Category:** Acceptance Criteria  
**The Hard Question:** The acceptance criteria state: "+/-1 SAR per line item per month" and "+/-1 SAR per employee per month." But these are different units:
- A "line item" in revenue could be "Tuition Maternelle Reduit," which covers multiple students. Off by +1 SAR across 50 students could mean an error of +0.02 SAR per student per month (tiny).
- A "line item" in staff cost could be "GOSI provision for Employee 1," which is a single number. Off by +1 SAR is off by +1 SAR.
- These aren't comparable. Is the acceptance criteria ambiguous?

**Why This Hurts:**
- If developer interprets "+/-1 SAR per line per month" as "within 1 SAR of Excel," they might accept a line that's off by +0.75 SAR. If Finance Manager interprets it as "exact match (within rounding)," they'll reject it.
- Without a clear definition, acceptance testing becomes subjective and prolonged.

**What the PRD Should Say:**
- Define "line item" precisely:
  - Revenue "line item" = monthly revenue for one (Grade x Nationality x Tariff) combination.
  - Staff Cost "line item" = monthly cost for one employee (salary + statutory costs).
  - P&L "line item" = monthly subtotal (Total Revenue, Total Staff Cost, Operating Profit, Net Profit).
- Tolerance hierarchy:
  - Detail level (+/-1.00 SAR): Individual revenue or staff cost lines.
  - Subtotal level (+/-10.00 SAR per subtotal): Monthly aggregates (Total Revenue, Total Staff Cost).
  - P&L level (+/-50.00 SAR): Monthly P&L subtotals (Operating Profit, Net Profit).
- Acceptance process:
  1. Compare app detail-level output against Excel for all 1,500 revenue lines x 12 months x 168 staff cost lines x 12 months.
  2. If any detail line is > +/-1.00 SAR, investigate root cause (formula error, rounding, data input discrepancy).
  3. If all detail lines are within tolerance, check P&L level. If subtotals match (within +/-50.00 SAR), accept.

**Risk Level:** High  
**Likelihood:** Likely (acceptance criteria ambiguity causes 30%+ of UAT delays and rework)

---

### 9. MISSING SPECIFICATIONS & AMBIGUITIES

#### DA-032: Context Bar Persistence -- What Exactly Persists?

**Category:** Requirements Clarity  
**The Hard Question:** Section 6.1 states: "The context bar is a fixed horizontal bar at the top of the workspace that maintains the user's working context across all planning modules." But what, exactly, persists?
- If a user selects Fiscal Year = FY2026, Version = Budget, Comparison = Actual, Scenario = Optimistic, and navigates from Revenue to Staffing modules, do all four selections persist?
- If the user navigates to the Dashboard (which is read-only), does the Scenario dropdown stay visible, or is it grayed out?
- If the user logs out and logs in later, is the context restored, or reset to defaults?

**Why This Hurts:**
- Without clear specifications, developers build the feature differently than users expect. Users get frustrated when context resets unexpectedly.
- If the Scenario selection persists to the Capacity Planning module (which doesn't use scenarios), users may think they're viewing a scenario when they're not.

**What the PRD Should Say:**
- Context persistence rules:
  - **Fiscal Year, Version, Comparison:** Persist across all modules.
  - **Academic Period:** Persists across all modules.
  - **Scenario:** Persists only in modules that use scenarios (Revenue, Staff Costs, Scenarios, P&L). In other modules (Enrollment, Capacity, DHG), the Scenario dropdown is hidden.
  - **Session persistence:** Context is stored in browser session storage. On logout, context is cleared. On login, context defaults to: FY = latest fiscal year, Version = Budget, Comparison = None, Academic Period = Full Year, Scenario = Base.
- Acceptance test: User logs in, sets Context = {FY2026, Forecast, v2}, navigates through 5 modules. Each module shows the correct context. User logs out and logs back in. Context resets to defaults.

**Risk Level:** Medium  
**Likelihood:** Likely (context persistence is easy to under-specify; issues emerge during UAT)

---

---

## SUMMARY TABLE: 32 FINDINGS

| ID | Category | Title | Risk Level | Likelihood |
| --- | --- | --- | --- | --- |
| DA-001 | Assumptions | Excel Source Model Contains Undetected Errors | Showstopper | Likely |
| DA-002 | Regulatory | Saudi Regulatory Landscape May Shift Mid-Implementation | Critical | Possible |
| DA-003 | Assumptions | AEFE Curriculum Requirements May Not Be Stable | High | Possible |
| DA-004 | Requirements | "Faithfully Reproduce" Excel Is Ambiguous for Rounding | High | Likely |
| DA-005 | Schedule | 24-Week Timeline Is Compressed for Scope | Critical | Almost Certain |
| DA-006 | Schedule | Phase 6 (Migration & UAT) Is Compressed | Critical | Almost Certain |
| DA-007 | Scope | Minimum Viable Product Undefined | High | Likely |
| DA-008 | Calculation | YEARFRAC on Edge Dates (Feb 29, Tenure Boundaries) | Critical | Possible |
| DA-009 | Calculation | Scenario Calculations with Zero Enrollment | High | Likely |
| DA-010 | Calculation | Cascading Recalculations and Tolerance Propagation | Critical | Likely |
| DA-011 | Calculation | Currency Rounding: Per-Month vs. Annual Total | High | Likely |
| DA-012 | Version Management | Version Locking & Multi-Amendment Workflow | High | Likely |
| DA-013 | Data Integrity | Simultaneous Edits in Enrollment & Revenue | High | Possible |
| DA-014 | UX | "Excel-Like Keyboard Navigation" Is Underspecified | Medium | Likely |
| DA-015 | UX | No Debug Support for Discrepancies | High | Almost Certain |
| DA-016 | UX | Parallel Run Burden and Dual-Maintenance | Medium | Likely |
| DA-017 | Regulatory | VAT Exemption for Saudi Nationals -- ZATCA Audit Trail | Critical | Possible |
| DA-018 | Regulatory | Zakat Calculation -- Simplified or Compliant? | High | Possible |
| DA-019 | Regulatory | EoS Calculation -- Are Recent Amendments Reflected? | Critical | Likely |
| DA-020 | Regulatory | IFRS 15 Revenue Recognition -- Is Approach Compliant? | Critical | Likely |
| DA-021 | Data Model | Fiscal Year Boundary Confusion (AY1/AY2 Overlap) | Critical | Almost Certain |
| DA-022 | Data Model | Mid-Year Fee Changes (Government Mandate) | High | Possible |
| DA-023 | Data Model | Employee Status Changes Mid-Year | High | Likely |
| DA-024 | Data Model | Student Nationality Changes Mid-Year | Medium | Possible |
| DA-025 | Error Handling | Auto-Save Failure Mid-Edit | Medium | Likely |
| DA-026 | Error Handling | Locked Version Accidentally Unlocked | High | Possible |
| DA-027 | Error Handling | Data Migration Imports Duplicate Employees | Critical | Likely |
| DA-028 | Error Handling | Rollback Strategy for Bad Forecast Version | Medium | Likely |
| DA-029 | QA | Regression Test Suite Doesn't Exist | Critical | Almost Certain |
| DA-030 | Performance | Performance Targets Aggressive; No Load Testing | High | Likely |
| DA-031 | Acceptance | Calculation Tolerance Interpreted Inconsistently | High | Likely |
| DA-032 | Requirements | Context Bar Persistence -- What Exactly Persists? | Medium | Likely |

---

## TOP 5 SHOWSTOPPERS (Must Resolve Before Phase 1 Ends)

1. **DA-005 (24-Week Timeline):** Extend to 30-32 weeks or define a clear MVP. A compressed timeline guarantees scope creep and quality issues.
2. **DA-001 (Excel Source Audit):** Conduct a pre-migration audit of all four Excel workbooks. Identify and document known errors before replicating them.
3. **DA-029 (Regression Test Suite):** Build a comprehensive test suite (100+ scenarios) before Phase 2 coding. Passive UAT testing is too late.
4. **DA-021 (Fiscal Year Boundaries):** Clarify the data model for FY2027 overlaps with AY1/AY2 cycles. This affects the entire schema design.
5. **DA-020 (IFRS 15 Compliance):** Have external auditors review and sign off on the revenue recognition approach before Phase 2 starts.

---

## RECOMMENDATIONS

### Immediate Actions (Before Phase 1 Development)

1. **Freeze Regulatory Assumptions:** Lock GOSI rates, Ajeer levies, EoS rules, VAT rates as of March 1, 2026. Document any changes after this date as out-of-scope for v1.
2. **Conduct Excel Audit:** Analyze all 39 sheets for formula errors, broken references, and logic discrepancies. Create a "Calculation Variance Log."
3. **Define Acceptance Criteria Precisely:** Specify tolerance by calculation layer (detail, subtotal, P&L). Create 100+ regression test scenarios.
4. **Engage External Auditors:** Have AEFE or local auditors review IFRS 15 approach, VAT treatment, Zakat calculation, and EoS compliance before development.
5. **Extend Timeline to 30 Weeks:** Add 6 weeks of buffer distributed across Phases 2-6. If 24 weeks is a hard constraint, define what gets deferred.

### Phase 1 Deliverables (Weeks 1-4)

1. Finalized data schema with fiscal year / academic year handling.
2. Regression test suite (100+ scenarios) with expected outputs from Excel baseline.
3. IFRS 15 Revenue Recognition Policy Document (externally reviewed).
4. Regulatory Compliance Checklist (ZATCA, AEFE, Saudi Labor Law).
5. Context Bar Persistence Specification (detailed wireframe).

---

**Report End**