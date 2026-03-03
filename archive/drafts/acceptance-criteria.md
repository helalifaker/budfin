# Acceptance Criteria -- Top 30 Functional Requirements

**Document Version:** 1.0
**Date:** March 3, 2026
**Format:** Given/When/Then (Gherkin-style)
**Scope:** 30 critical FRs across Revenue, Staff Costs, Version Management, and Core Platform

---

## Revenue Calculations (10 FRs)

---

### FR-REV-001: Configurable Fee Grid (Grade Level x Nationality x Tariff)

**AC-REV-001-1: Happy path -- fee grid lookup returns correct fee for valid combination**
- Given a fee grid is configured with dimensions Grade Level (PS through Terminale), Nationality (Francais, Nationaux, Autres), and Tariff Category (RP, R3+, Plein),
- When a user looks up the fee for Grade = "CP", Nationality = "Francais", Tariff = "Plein",
- Then the system returns the exact fee amount stored for that combination (e.g., 47,250.00 SAR) with no rounding or truncation.

**AC-REV-001-2: Edge case -- missing fee grid entry for a valid combination**
- Given the fee grid has 45+ combinations defined but one combination (e.g., Grade = "Terminale", Nationality = "Nationaux", Tariff = "R3+") has no fee entry,
- When the revenue engine attempts to calculate revenue for that combination,
- Then the system displays a validation error identifying the missing combination by name, prevents revenue calculation from proceeding, and does not silently treat the missing fee as zero.

**AC-REV-001-3: Edge case -- fee grid with zero enrollment grade (PO-001)**
- Given a fee grid has valid fee entries for Grade = "Terminale" across all nationality/tariff combinations,
- And enrollment for Terminale is zero in the current version,
- When the revenue engine calculates monthly revenue,
- Then the system returns 0.00 SAR revenue for all Terminale combinations, does not generate division-by-zero errors, and displays the grade as "0 students -- no revenue" in the revenue summary.

**AC-REV-001-4: Edge case -- rounding precision across fee grid lookups (PO-013)**
- Given a fee grid contains a fee of 47,237.50 SAR (non-round value from Excel import),
- When the system retrieves this fee for calculation,
- Then the fee is stored and retrieved using fixed-point decimal arithmetic (minimum 2 decimal places), matching the Excel source value exactly with zero precision loss.

---

### FR-REV-003: Automatic HT Calculation (Tuition HT = TTC / (1 + VAT_RATE))

**AC-REV-003-1: Happy path -- standard HT calculation with 15% VAT**
- Given a fee entry has Tuition TTC = 47,250.00 SAR and the system VAT rate is 15%,
- When the system calculates Tuition HT,
- Then Tuition HT = 47,250.00 / 1.15 = 41,086.96 SAR (rounded to 2 decimal places at the final step only), and this value is displayed and stored.

**AC-REV-003-2: Edge case -- VAT exemption for Saudi nationals (FR-REV-006)**
- Given a fee entry is for Nationality = "Nationaux" (Saudi nationals) with Tuition TTC = 47,250.00 SAR,
- And the VAT rate for Nationaux is configured as 0%,
- When the system calculates Tuition HT,
- Then Tuition HT = 47,250.00 / 1.00 = 47,250.00 SAR (no VAT deduction applied), and the VAT amount is displayed as 0.00 SAR.

**AC-REV-003-3: Edge case -- rounding precision in HT calculation (PO-013)**
- Given a fee entry has Tuition TTC = 53,125.00 SAR and VAT = 15%,
- When the system calculates Tuition HT,
- Then the system computes 53,125.00 / 1.15 using fixed-point decimal arithmetic, rounds only at the final presentation step to 2 decimal places, and the result matches the Excel baseline within +/-1 SAR.

---

### FR-REV-004: Version-Controlled Fee Grids

**AC-REV-004-1: Happy path -- each version has its own fee grid snapshot**
- Given a Budget version "Budget FY2026" exists with fee grid Snapshot A,
- And a Forecast version "FC1 FY2026" exists with fee grid Snapshot B (different fees),
- When the user switches between versions via the context bar,
- Then the Revenue module displays the fee grid associated with the selected version, and changes to Snapshot B do not affect Snapshot A.

**AC-REV-004-2: Edge case -- fee grid update in draft does not affect published version (PO-007)**
- Given Budget v1 is in Published/Locked status with fee grid Snapshot A,
- And Forecast v1 is in Draft status with fee grid Snapshot B,
- When a user modifies a fee in Forecast v1's fee grid (e.g., changes CP/Francais/Plein from 47,250 to 48,000 SAR),
- Then Budget v1's fee grid remains unchanged at 47,250 SAR, and the audit trail logs the fee change only for Forecast v1.

**AC-REV-004-3: Edge case -- cloned version copies fee grid as independent snapshot (PO-007)**
- Given Budget v1 has fee grid Snapshot A with 45 fee combinations,
- When a user clones Budget v1 to create "Budget v2" (FR-VER-005),
- Then Budget v2 receives an independent copy of all 45 fee combinations, and subsequent edits to Budget v2's fees do not modify Budget v1's fees.

---

### FR-REV-006: VAT Exemption for Saudi Nationals

**AC-REV-006-1: Happy path -- VAT rate is 0% for Nationaux**
- Given a student enrollment entry exists for Nationality = "Nationaux" and the system VAT exemption rule is active,
- When the revenue engine calculates Tuition HT for this entry,
- Then VAT rate = 0% is applied, Tuition HT equals Tuition TTC, and no VAT amount is included in the revenue line item.

**AC-REV-006-2: Happy path -- VAT applies to non-Saudi nationalities**
- Given a student enrollment entry exists for Nationality = "Francais" with Tuition TTC = 47,250.00 SAR,
- When the revenue engine calculates Tuition HT,
- Then VAT rate = 15% is applied, and Tuition HT = 47,250.00 / 1.15 = 41,086.96 SAR.

**AC-REV-006-3: Edge case -- mixed nationality cohort in same grade**
- Given Grade = "CP" has 50 Francais students (VAT = 15%), 10 Nationaux students (VAT = 0%), and 40 Autres students (VAT = 15%),
- When the revenue engine calculates total HT revenue for CP,
- Then each nationality segment uses its correct VAT rate independently, and the total HT revenue is the sum of each segment's HT calculations.

---

### FR-REV-009: Mutually Exclusive Discount Application

**AC-REV-009-1: Happy path -- student receives highest applicable discount only**
- Given a student qualifies for both RP (staff children, 75% discount) and R3+ (3+ siblings, 75% discount),
- When the discount engine determines the applicable discount,
- Then only one discount is applied (the highest), and the student's net fee reflects a single 75% discount from Plein tariff, not a stacked 150% discount.

**AC-REV-009-2: Edge case -- negative/invalid discount rate (PO-002)**
- Given a user attempts to enter a discount rate of -10% (negative) or 110% (exceeds 100%),
- When the system validates the discount rate input,
- Then the system rejects the entry with an error message: "Discount rate must be between 0% and 100%", and does not save the invalid value.

**AC-REV-009-3: Edge case -- student with no applicable discount**
- Given a student has Nationality = "Autres" and Tariff = "Plein" with no discount qualifications,
- When the discount engine processes this student,
- Then discount rate = 0%, and net fee equals the full Plein tariff from the fee grid.

---

### FR-REV-011: Monthly Revenue Calculation with Academic Calendar Logic

**AC-REV-011-1: Happy path -- revenue distributed across correct months**
- Given AY1 runs Jan--Jun (6 months) and AY2 runs Sep--Dec (4 months),
- And a student has Net Fee = 30,000 SAR for AY1,
- When the revenue engine calculates monthly revenue,
- Then monthly revenue = 30,000 / 6 = 5,000.00 SAR for each of Jan, Feb, Mar, Apr, May, Jun; 0.00 SAR for Jul, Aug; and AY2 revenue is calculated separately for Sep--Dec.

**AC-REV-011-2: Edge case -- zero enrollment produces zero revenue (PO-001)**
- Given enrollment for Grade = "PS" is zero in both AY1 and AY2,
- When the revenue engine calculates monthly revenue for PS,
- Then all 12 months show 0.00 SAR revenue for PS, no division-by-zero error occurs, and the grade appears in reports with "0 students" label.

**AC-REV-011-3: Edge case -- summer months always zero**
- Given the academic calendar defines Jul and Aug as summer break,
- And a student has valid enrollment in AY1,
- When the revenue engine calculates July and August revenue,
- Then revenue for Jul = 0.00 SAR and Aug = 0.00 SAR regardless of any fee or enrollment configuration.

**AC-REV-011-4: Edge case -- monthly sum equals annual total (PO-013)**
- Given a grade/nationality/tariff combination produces annual revenue of 120,000.00 SAR,
- When the system sums the 12 monthly revenue values,
- Then the sum equals the annual total within +/-1 SAR tolerance, and any rounding remainder is allocated to the last month of the relevant period.

---

### FR-REV-012: Revenue Formula (Enrollment x Net Fee / Period Months)

**AC-REV-012-1: Happy path -- correct revenue calculation**
- Given enrollment detail shows 50 students for Grade = "CE1", Nationality = "Francais", Tariff = "Plein" in AY1,
- And Net Fee for this combination = 41,086.96 SAR (HT after VAT),
- When the revenue engine calculates total revenue for this line,
- Then Total Revenue = 50 x 41,086.96 = 2,054,348.00 SAR annual, and Monthly Revenue (AY1) = 2,054,348.00 / 6 = 342,391.33 SAR per month.

**AC-REV-012-2: Edge case -- rounding across multiplication chain (PO-013)**
- Given a combination has 23 students x Net Fee = 35,437.69 SAR,
- When the system calculates revenue,
- Then intermediate multiplication uses full decimal precision (no rounding at intermediate steps), and only the final monthly figure is rounded to 2 decimal places, matching the Excel baseline within +/-1 SAR per line item.

**AC-REV-012-3: Edge case -- single student enrollment**
- Given enrollment detail shows 1 student for a specific combination,
- When the revenue engine calculates revenue,
- Then revenue equals exactly the Net Fee value divided by the period months, with no aggregation anomalies.

---

### FR-REV-014: Non-Tuition Revenue Distribution Methods

**AC-REV-014-1: Happy path -- Academic /10 distribution**
- Given an "After-School Activities" line item has annual amount = 1,230,000 SAR and distribution method = "Academic /10",
- When the system distributes this across months,
- Then each academic month (Jan--Jun, Sep--Dec) receives 123,000.00 SAR (1,230,000 / 10), and Jul and Aug receive 0.00 SAR.

**AC-REV-014-2: Happy path -- Year-round /12 distribution**
- Given "PSG Academy Rental" has annual amount = 51,230 SAR and distribution method = "Year-round /12",
- When the system distributes this across months,
- Then each of the 12 months receives 4,269.17 SAR (51,230 / 12), with the rounding remainder allocated to the final month.

**AC-REV-014-3: Edge case -- custom month weights that sum to 1.0**
- Given "Class Photos" has annual amount = 52,800 SAR and custom weights of [0,0,0,0,0,0,0,0,0,0,0.5,0.5] (Nov--Dec),
- When the system distributes this across months,
- Then Nov = 26,400.00 SAR, Dec = 26,400.00 SAR, all other months = 0.00 SAR, and the annual sum equals 52,800.00 SAR.

**AC-REV-014-4: Edge case -- custom weights that do not sum to 1.0**
- Given a user enters custom weights that sum to 0.8 (e.g., [0.4, 0.4, 0, ...]),
- When the system validates the weight configuration,
- Then the system rejects the weights with error: "Distribution weights must sum to 1.0 (current sum: 0.8)", and does not proceed with revenue distribution.

---

### FR-REV-020: Scholarship Allocation

**AC-REV-020-1: Happy path -- scholarship deduction applied to gross tuition**
- Given the Base scenario has Scholarship Allocation = 2% and Total Gross Tuition Revenue = 30,000,000 SAR,
- When the system calculates scholarship deductions,
- Then Scholarship Deductions = 30,000,000 x 0.02 = 600,000.00 SAR, and Net Revenue = Total Revenue - 600,000.00 SAR.

**AC-REV-020-2: Happy path -- scenario-specific scholarship rates**
- Given Optimistic scenario has Scholarship Allocation = 1% and Pessimistic has 3%,
- When the user switches scenarios,
- Then the scholarship deduction recalculates using the scenario-specific rate, and the variance between scenarios is correctly reflected.

**AC-REV-020-3: Edge case -- zero scholarship rate**
- Given a custom scenario sets Scholarship Allocation = 0%,
- When the system calculates net revenue,
- Then Scholarship Deductions = 0.00 SAR, and Net Revenue equals Total Revenue with no deduction.

---

### FR-REV-021: Fee Collection Rate

**AC-REV-021-1: Happy path -- fee collection rate reduces net revenue**
- Given Base scenario has Fee Collection Rate = 95% and Total Revenue = 40,000,000 SAR,
- When the system applies the fee collection rate,
- Then Collectible Revenue = 40,000,000 x 0.95 = 38,000,000.00 SAR, and the uncollectible amount (2,000,000 SAR) is reflected in IFRS 9 impairment provisions.

**AC-REV-021-2: Edge case -- collection rate by scenario**
- Given Base = 95%, Optimistic = 98%, Pessimistic = 90%,
- When the user compares scenarios,
- Then each scenario applies its own collection rate independently, and the variance report shows the revenue impact of different collection assumptions.

**AC-REV-021-3: Edge case -- fee collection rate = 100%**
- Given a scenario sets Fee Collection Rate = 100%,
- When the system calculates revenue,
- Then no impairment provision is created, and Collectible Revenue equals Total Revenue exactly.

---

## Staff Cost Calculations (10 FRs)

---

### FR-STC-005: Monthly Gross Calculation

**AC-STC-005-1: Happy path -- full-time employee monthly gross**
- Given an employee has Base Salary = 10,000 SAR, Housing (IL) = 3,000 SAR, Transport (IT) = 1,000 SAR, Responsibility Premium = 500 SAR, HSA = 1,500 SAR, and Hourly Percentage = 1.0 (full-time),
- When the system calculates Monthly Gross,
- Then Monthly Gross = (10,000 + 3,000 + 1,000 + 500 + 1,500) x 1.0 = 16,000.00 SAR.

**AC-STC-005-2: Edge case -- part-time employee (FR-STC-008)**
- Given an employee has the same components as above but Hourly Percentage = 0.5 (50% part-time),
- When the system calculates Monthly Gross,
- Then Monthly Gross = (10,000 + 3,000 + 1,000 + 500 + 1,500) x 0.5 = 8,000.00 SAR.

**AC-STC-005-3: Edge case -- all components zero except base salary**
- Given an employee has Base Salary = 8,000 SAR and all other components = 0,
- When the system calculates Monthly Gross,
- Then Monthly Gross = 8,000.00 SAR with no errors or null-reference exceptions.

---

### FR-STC-007: Jul--Aug HSA Exclusion

**AC-STC-007-1: Happy path -- HSA is zero during summer months**
- Given a teaching staff employee has HSA = 1,500 SAR per month during academic months,
- When the system calculates Monthly Gross for July and August,
- Then HSA = 0 SAR for Jul and Aug, and Monthly Gross = (Base + Housing + Transport + Premium + 0) x Hourly Percentage.

**AC-STC-007-2: Happy path -- HSA resumes in September**
- Given the same employee,
- When the system calculates Monthly Gross for September,
- Then HSA = 1,500 SAR is included, and Monthly Gross reflects the full five components.

**AC-STC-007-3: Edge case -- employee joins July 15 (mid-summer)**
- Given a new employee has Joining Date = July 15 and is classified as teaching staff,
- When the system calculates Jul and Aug costs,
- Then HSA = 0 SAR for both Jul and Aug (summer rule overrides join date), and HSA begins from September onward.

---

### FR-STC-009: GOSI Calculation

**AC-STC-009-1: Happy path -- GOSI for Saudi national employee**
- Given an employee has Nationality = "Saudi" and Monthly Gross = 16,000.00 SAR,
- And the GOSI employer rate is 11.75% (9.75% Pension + 1% SANED + 1% OHI),
- When the system calculates monthly GOSI contribution,
- Then GOSI = 16,000.00 x 0.1175 = 1,880.00 SAR.

**AC-STC-009-2: Happy path -- GOSI does not apply to non-Saudi employees**
- Given an employee has Nationality = "French" (non-Saudi, Ajeer designation),
- When the system calculates GOSI,
- Then GOSI = 0.00 SAR for this employee, regardless of salary level.

**AC-STC-009-3: Edge case -- GOSI base includes all salary components**
- Given a Saudi employee has Base = 10,000, Housing = 3,000, Transport = 1,000, Premium = 500, HSA = 1,500 (total package = 16,000 SAR),
- When the system calculates GOSI,
- Then the GOSI base is the full salary package (16,000 SAR), not just the base salary.

---

### FR-STC-010: Ajeer Program Costs

**AC-STC-010-1: Happy path -- existing non-Saudi employee Ajeer costs**
- Given an existing non-Saudi employee (status = "Existing") and the Ajeer annual levy = 9,500 SAR (non-Nitaqat) with monthly platform fee = 160 SAR,
- When the system calculates annual Ajeer cost,
- Then Ajeer Cost = 9,500 + (160 x 12) = 11,420.00 SAR for the full year (12 months).

**AC-STC-010-2: Edge case -- new non-Saudi employee (Sep--Dec only)**
- Given a new employee (status = "New", start date = September) and Ajeer annual levy = 9,500 SAR,
- When the system calculates Ajeer cost for the fiscal year,
- Then Ajeer Levy = 9,500 x (4/12) = 3,166.67 SAR (prorated for 4 months), and Platform Fee = 160 x 4 = 640.00 SAR, for a total of 3,806.67 SAR.

**AC-STC-010-3: Edge case -- Saudi employee is exempt from Ajeer**
- Given an employee has Nationality = "Saudi",
- When the system calculates Ajeer costs,
- Then Ajeer Cost = 0.00 SAR (Saudi nationals are exempt from the Ajeer program).

**AC-STC-010-4: Edge case -- mid-year joining for Ajeer (PO-004)**
- Given a non-Saudi employee joins on April 1 (mid-year, not the standard Sep start),
- When the system calculates Ajeer costs,
- Then Ajeer Levy is prorated for 9 months (Apr--Dec) = 9,500 x (9/12) = 7,125.00 SAR, and Platform Fee = 160 x 9 = 1,440.00 SAR.

---

### FR-STC-011: End of Service Provision

**AC-STC-011-1: Happy path -- EoS for employee with less than 5 years of service**
- Given an employee has Joining Date = Jan 1, 2023 and As-of Date = Dec 31, 2026,
- And YoS = YEARFRAC(2023-01-01, 2026-12-31) = ~3.999 years,
- And EoS Base (Base + Housing + Transport + Premium, excluding HSA) = 14,500 SAR,
- When the system calculates EoS provision,
- Then EoS = (14,500 / 2) x 3.999 = 28,992.75 SAR (rounded to 2 decimal places at final step).

**AC-STC-011-2: Happy path -- EoS for employee with more than 5 years of service**
- Given an employee has YoS = 8.5 years and EoS Base = 14,500 SAR,
- When the system calculates EoS provision,
- Then EoS = (14,500 / 2 x 5) + (14,500 x (8.5 - 5)) = 36,250 + 50,750 = 87,000.00 SAR.

**AC-STC-011-3: Edge case -- retroactive joining date update (PO-012)**
- Given an employee's Joining Date is changed from Jan 1, 2020 to Jan 1, 2019 (retroactive correction),
- When the system recalculates EoS provision,
- Then YoS increases by approximately 1 year, the EoS provision increases accordingly, the Monthly Accrual (Annual FY Charge / 12) is recalculated, and the audit trail records the joining date change with old value, new value, and the resulting EoS delta.

**AC-STC-011-4: Edge case -- EoS uses YEARFRAC with leap year boundary (SA-004)**
- Given an employee joins Feb 29, 2024 (leap year) and the As-of Date is Dec 31, 2026,
- When the system calculates YoS using YEARFRAC,
- Then the system uses the same YEARFRAC basis as Excel (ISDA Actual/Actual), and the result matches the Excel calculation within +/-0.001 years of service.

---

### FR-STC-012: Monthly Cost Budget with September Step-Change

**AC-STC-012-1: Happy path -- Jan--Aug shows existing staff only**
- Given the employee roster has 160 existing employees and 8 new positions starting September,
- When the system generates the monthly cost budget for January through August,
- Then only the 160 existing employees' costs appear, and new positions contribute 0.00 SAR for Jan--Aug.

**AC-STC-012-2: Happy path -- September step-change includes new positions**
- Given 8 new positions start in September with combined monthly gross = 120,000 SAR,
- When the system generates the monthly cost budget for September,
- Then September cost = existing staff costs + 120,000 SAR (new positions), creating a visible step-change from August to September.

**AC-STC-012-3: Edge case -- mid-year joining before September (PO-004)**
- Given a new employee has Joining Date = April 1 (not the standard September start),
- When the system generates the monthly cost budget,
- Then the employee's costs appear starting April (not September), the Apr--Aug months reflect this employee's salary, and the 12-month total correctly includes 9 months of this employee's cost.

**AC-STC-012-4: Edge case -- augmentation effective September (FR-STC-006)**
- Given existing employees receive a salary augmentation of +500 SAR/month effective September,
- When the system generates the monthly cost budget,
- Then Jan--Aug shows the pre-augmentation salary, Sep--Dec shows the post-augmentation salary (base + 500), and the annual total reflects 8 months at old rate + 4 months at new rate.

---

### FR-STC-006: Augmentation (Salary Increase)

**AC-STC-006-1: Happy path -- augmentation applied from September**
- Given an employee has Base Salary = 10,000 SAR and an augmentation of +500 SAR effective September,
- When the system calculates monthly costs,
- Then Jan--Aug: Base = 10,000 SAR; Sep--Dec: Base = 10,500 SAR; and the annual salary cost reflects 8 x 10,000 + 4 x 10,500 = 122,000 SAR (for base component only).

**AC-STC-006-2: Edge case -- augmentation affects EoS base**
- Given the augmentation increases the Base Salary by 500 SAR from September,
- When the system calculates EoS provision,
- Then the EoS Base for Sep--Dec reflects the augmented salary (Base + 500 + Housing + Transport + Premium), and the annual EoS charge accounts for the salary change mid-year.

**AC-STC-006-3: Edge case -- zero augmentation**
- Given an employee has augmentation amount = 0 SAR,
- When the system calculates monthly costs,
- Then salary remains unchanged across all 12 months with no step-change.

---

### FR-STC-008: Part-Time Adjustment via Hourly Percentage

**AC-STC-008-1: Happy path -- part-time employee at 50%**
- Given an employee has Hourly Percentage = 0.5 and full-time gross = 16,000 SAR,
- When the system calculates Monthly Gross,
- Then Monthly Gross = 16,000 x 0.5 = 8,000.00 SAR.

**AC-STC-008-2: Edge case -- hourly percentage boundary validation**
- Given a user attempts to enter Hourly Percentage = 0.0 (0%) or Hourly Percentage = 1.5 (150%),
- When the system validates the input,
- Then the system rejects values outside the range 0.01 to 1.0 with error: "Hourly Percentage must be between 1% and 100%", and does not save the invalid value.

**AC-STC-008-3: Edge case -- full-time explicit value**
- Given an employee has Hourly Percentage = 1.0 (full-time),
- When the system calculates Monthly Gross,
- Then the result equals the sum of all salary components with no fractional reduction.

---

### FR-STC-019: Grand Total Staff Costs

**AC-STC-019-1: Happy path -- grand total aggregation**
- Given Local Staff Salaries (existing + new) = 2,500,000 SAR/month,
- And Additional Staff Costs (Residents, Replacements, Training) = 715,143 SAR/month,
- And Employer Charges (GOSI + EoS + Ajeer) = 200,000 SAR/month,
- When the system calculates Grand Total Staff Costs for a month,
- Then Grand Total = 2,500,000 + 715,143 + 200,000 = 3,415,143.00 SAR.

**AC-STC-019-2: Happy path -- annual grand total equals sum of monthly totals**
- Given the system has calculated Grand Total for each of the 12 months,
- When the system calculates the annual Grand Total,
- Then Annual Grand Total = Sum of 12 monthly Grand Totals, and this matches within +/-1 SAR of the independently calculated annual component totals.

**AC-STC-019-3: Edge case -- category breakdown percentages**
- Given the Grand Total = 3,415,143 SAR,
- When the system displays the cost structure breakdown,
- Then Category A (Local Staff Salaries) shows its amount and percentage of Grand Total, Category B (Additional Staff Costs) shows its amount and percentage, and Category C (Employer Charges) shows its amount and percentage, with all percentages summing to 100%.

---

### FR-STC-024: Year-over-Year Salary Comparison

**AC-STC-024-1: Happy path -- continuing employee variance**
- Given Employee ID "E001" had Monthly Gross = 15,000 SAR in Prior AY and 16,000 SAR in Current AY,
- When the system generates the YoY comparison,
- Then Variance = +1,000 SAR, Variance % = +6.67%, and Status = "Continuing".

**AC-STC-024-2: Edge case -- new joiner has no prior year data**
- Given Employee ID "E169" is a new hire starting September with no prior AY record,
- When the system generates the YoY comparison,
- Then Prior AY salary = "N/A" (not zero), Variance = "N/A", and Status = "New Joiner".

**AC-STC-024-3: Edge case -- departed employee**
- Given Employee ID "E050" was present in Prior AY with Monthly Gross = 12,000 SAR but is not in Current AY,
- When the system generates the YoY comparison,
- Then Current AY salary = "N/A", Variance = "N/A", and Status = "Departed".

---

## Version Management (5 FRs)

---

### FR-VER-001: Create a New Version

**AC-VER-001-1: Happy path -- create new Budget version**
- Given a user has "Create Version" permissions,
- When the user creates a new version with Name = "Budget FY2026", Type = "Budget", and no base data copy,
- Then a new version is created in Draft status, it appears in the version list and context bar dropdown, and an audit event is logged with the creation details.

**AC-VER-001-2: Happy path -- create version with base data copy**
- Given an existing version "Budget FY2025" has enrollment, fee grid, and staff cost data,
- When the user creates a new version "Budget FY2026" with base data copied from "Budget FY2025",
- Then all data from FY2025 is copied into FY2026 as a Draft, including enrollment, fee grid, staff costs, and assumptions, and the new version is independent of the source.

**AC-VER-001-3: Edge case -- duplicate version name**
- Given a version named "Budget FY2026" already exists,
- When the user attempts to create another version with the same name,
- Then the system rejects the creation with error: "A version named 'Budget FY2026' already exists. Choose a different name."

---

### FR-VER-002: Delete Version

**AC-VER-002-1: Happy path -- delete Draft version**
- Given a version "FC1 Draft" is in Draft status,
- When the user deletes it,
- Then the version and all associated data are removed, and an audit event is logged.

**AC-VER-002-2: Edge case -- delete Published/Locked version requires confirmation**
- Given a version "Budget FY2026" is in Published status,
- When the user attempts to delete it,
- Then the system requires explicit confirmation ("Are you sure you want to delete a published version?") AND a mandatory audit note explaining the reason for deletion.

**AC-VER-002-3: Edge case -- delete version referenced by comparison**
- Given "Budget FY2026" is currently selected as the comparison version in the context bar by another user,
- When a user attempts to delete "Budget FY2026",
- Then the system warns that the version is in use for comparison and requires confirmation before proceeding.

---

### FR-VER-003: Version Lifecycle Transitions

**AC-VER-003-1: Happy path -- forward transitions**
- Given a version is in Draft status,
- When an authorized user transitions it through Draft -> Published -> Locked -> Archived,
- Then each transition succeeds, the version status updates correctly, and each transition is logged as an audit event with timestamp, user, and transition description.

**AC-VER-003-2: Edge case -- reverse transition (Locked -> Published) requires audit note (PO-021)**
- Given a version "Budget FY2026" is in Locked status,
- When an authorized user unlocks it (transitions Locked -> Published),
- Then the system requires a mandatory audit note explaining why the locked version is being unlocked, the transition is logged with the note, and the version becomes editable again.

**AC-VER-003-3: Edge case -- unauthorized user attempts transition**
- Given a user with Viewer role attempts to transition a version from Draft to Published,
- When the system evaluates the transition request,
- Then the system rejects the action with error: "Insufficient permissions. Only Admin or Editor roles can change version status."

**AC-VER-003-4: Edge case -- version unlock workflow with concurrent edits (PO-021)**
- Given a version "Budget FY2026" is Locked,
- And User A unlocks it (Locked -> Published),
- And User B was viewing the locked version,
- When User B attempts to edit the now-unlocked version,
- Then User B's interface refreshes to show the version as editable (Published status), and no stale lock state prevents editing.

---

### FR-VER-004: Version Comparison with Variance Columns

**AC-VER-004-1: Happy path -- absolute and percentage variance**
- Given Primary Version "Budget FY2026" has Total Revenue = 40,000,000 SAR,
- And Comparison Version "Actual FY2025" has Total Revenue = 38,000,000 SAR,
- When the user activates version comparison,
- Then Absolute Variance = +2,000,000 SAR, Percentage Variance = +5.26%, and variance is color-coded green (favorable for revenue).

**AC-VER-004-2: Edge case -- comparison version has zero value (PO-001)**
- Given Primary Version has Revenue for Terminale = 500,000 SAR,
- And Comparison Version has Revenue for Terminale = 0 SAR (grade was not offered),
- When the system calculates percentage variance,
- Then the system handles division by zero gracefully, displaying Absolute Variance = +500,000 SAR and Percentage Variance as "N/A" or "+Inf" (not a crash or error).

**AC-VER-004-3: Edge case -- unfavorable cost variance color coding**
- Given Primary Version has Staff Costs = 25,000,000 SAR (higher) and Comparison Version has Staff Costs = 23,000,000 SAR (lower),
- When the variance is displayed,
- Then Absolute Variance = +2,000,000 SAR, and it is color-coded red (unfavorable -- costs increased).

---

### FR-VER-005: Clone an Existing Version

**AC-VER-005-1: Happy path -- full data clone**
- Given "Budget FY2026 v1" exists with enrollment data, fee grid, staff costs, and assumptions,
- When a user clones it to create "Budget FY2026 v2",
- Then all data, assumptions, and configuration from v1 are copied into v2, v2 starts in Draft status, and v2 is fully independent (edits to v2 do not affect v1).

**AC-VER-005-2: Edge case -- cloning a Locked version**
- Given "Budget FY2026 v1" is in Locked status,
- When a user clones it,
- Then the clone succeeds, the new version is in Draft status (not Locked), and the source version remains unchanged and Locked.

**AC-VER-005-3: Edge case -- clone preserves fee grid independently (PO-007)**
- Given "Budget FY2026 v1" has 45 fee grid entries,
- When a user clones it and then modifies a fee in the clone,
- Then the original version's fee grid is unaffected, and the audit trail shows the fee change only in the cloned version.

---

## Core Platform (5 FRs)

---

### FR-ENR-001: Historical Enrollment Import

**AC-ENR-001-1: Happy path -- import 5 years of CSV data**
- Given five CSV files exist with format `level_code, student_count` for academic years 2021-22 through 2025-26,
- When the user imports all five files,
- Then the system stores enrollment data for all 15 grade levels across all 5 years, totals match the source CSVs (e.g., 2025-26 total = 1,503 students), and a confirmation message shows the import summary.

**AC-ENR-001-2: Edge case -- CSV with unknown grade code**
- Given a CSV contains a row with level_code = "XYZ" that does not match any known grade,
- When the system processes the import,
- Then the system flags the unknown grade with a warning: "Grade code 'XYZ' not found in master data. Row skipped.", imports all valid rows, and generates a data quality report listing skipped rows.

**AC-ENR-001-3: Edge case -- duplicate academic year import**
- Given enrollment data for 2024-25 has already been imported,
- When the user attempts to import another CSV for 2024-25,
- Then the system prompts: "Enrollment data for 2024-25 already exists. Replace existing data or cancel?", and does not silently overwrite.

---

### FR-ENR-005: Two-Stage Enrollment Entry

**AC-ENR-005-1: Happy path -- Stage 1 then Stage 2**
- Given the user enters Stage 1 total headcount: PS = 65, MS = 71, GS = 124,
- When the user proceeds to Stage 2,
- Then Stage 2 shows the nationality (Francais, Nationaux, Autres) and tariff (RP, R3+, Plein) breakdown for each grade, and the sum of all Stage 2 entries for each grade must equal the Stage 1 total.

**AC-ENR-005-2: Edge case -- Stage 2 sum does not match Stage 1 total**
- Given Stage 1 total for PS = 65,
- And the user enters Stage 2 breakdown: Francais/Plein = 30, Nationaux/Plein = 20, Autres/Plein = 10 (sum = 60),
- When the system validates Stage 2 entries,
- Then the system displays an error: "Stage 2 total (60) does not match Stage 1 headcount (65) for PS. Difference: 5 students.", and does not allow proceeding until resolved.

**AC-ENR-005-3: Edge case -- zero enrollment in Stage 1 (PO-001)**
- Given the user enters Stage 1 headcount for a grade as 0,
- When the user proceeds to Stage 2,
- Then Stage 2 is skipped for that grade (no breakdown needed for 0 students), the grade appears in reports with "0 students" label, and no division-by-zero errors occur in downstream calculations.

**AC-ENR-005-4: Edge case -- enrollment change triggers stale state indicator**
- Given enrollment data was entered and the revenue engine was previously calculated,
- When the user modifies enrollment headcount for any grade,
- Then a stale state indicator appears in the Revenue module banner: "Enrollment data has changed since last calculation. Click Calculate to update revenue.", and revenue figures are not auto-recalculated.

---

### FR-PNL-001: Monthly P&L Statement (IFRS Function of Expense)

**AC-PNL-001-1: Happy path -- P&L consolidation from Revenue and Staff Costs**
- Given the Revenue Engine has calculated Total Revenue = 40,000,000 SAR annual,
- And Staff Costs Monthly Budget shows Total Staff Costs = 30,000,000 SAR annual,
- When the system generates the monthly P&L,
- Then the P&L shows 12 monthly columns plus an annual total, Revenue section pulls from the Revenue Engine, Expense section pulls from Staff Costs, and key subtotals (Total Revenue, Total Expenses, EBITDA, Operating Profit, Net Result) are correctly calculated.

**AC-PNL-001-2: Happy path -- IFRS 15 revenue classification**
- Given revenue includes Tuition Fees, Registration & Miscellaneous, and Other Revenue,
- When the P&L is generated,
- Then revenue line items are classified per IFRS 15 categories, all values are presented in SAR HT (excluding VAT), and the Revenue from Contracts with Customers subtotal is correctly calculated.

**AC-PNL-001-3: Edge case -- zero revenue scenario**
- Given a hypothetical scenario where all enrollment is zero,
- When the P&L is generated,
- Then Total Revenue = 0.00 SAR, expenses still display (staff costs may remain), Net Result shows a negative value (loss), and no calculation errors occur.

**AC-PNL-001-4: Edge case -- Zakat calculation on positive profit**
- Given monthly profit before Zakat = 500,000 SAR,
- When the system calculates Zakat,
- Then Zakat = 500,000 x 0.025 = 12,500.00 SAR, and Net Profit = 500,000 - 12,500 = 487,500.00 SAR. If monthly profit is negative, Zakat = 0.00 SAR.

---

### FR-AUD-001: Audit Logging of All Data Modifications

**AC-AUD-001-1: Happy path -- data change is logged with full context**
- Given a user changes the enrollment headcount for PS/AY1 from 60 to 65,
- When the change is saved,
- Then an audit log entry is created with: timestamp (ISO 8601), user identity (name/ID), field changed ("enrollment_headcount"), entity ("PS/AY1"), old value (60), new value (65), and version context.

**AC-AUD-001-2: Happy path -- audit log is accessible and filterable**
- Given 500 audit log entries exist,
- When a user navigates to the Audit Trail module,
- Then entries are displayed in reverse chronological order with basic date filtering, and the list supports pagination.

**AC-AUD-001-3: Edge case -- duplicate employee detection logged (PO-003)**
- Given a user imports employee data and the system detects a duplicate (matching name + department + joining date),
- When the system flags the duplicate,
- Then an audit log entry records: "Duplicate employee detected: [Employee Name], Department: [Dept], Joining Date: [Date]. Import row skipped." with the user and timestamp.

**AC-AUD-001-4: Edge case -- bulk operation audit granularity**
- Given a user imports 168 employee records in a single bulk operation,
- When the import completes,
- Then the audit trail logs a summary entry ("168 employees imported by [User] at [Time]") plus individual entries for each employee record created, and the audit log does not silently omit any records.

---

### FR-CAP-001: Sections Calculation (CEILING(Enrollment / Max Class Size))

**AC-CAP-001-1: Happy path -- correct sections calculation**
- Given Grade = "CP" has Enrollment = 126 and Max Class Size = 26,
- When the system calculates sections needed,
- Then Sections = CEILING(126 / 26) = CEILING(4.846) = 5 sections.

**AC-CAP-001-2: Happy path -- enrollment exactly divisible**
- Given Grade = "PS" has Enrollment = 72 and Max Class Size = 24,
- When the system calculates sections needed,
- Then Sections = CEILING(72 / 24) = CEILING(3.0) = 3 sections (no rounding needed).

**AC-CAP-001-3: Edge case -- zero enrollment (PO-001)**
- Given Grade = "Terminale" has Enrollment = 0,
- When the system calculates sections needed,
- Then Sections = 0 (not CEILING(0/26) = 0), Utilization = 0%, and the system does not produce a division-by-zero error in utilization calculation.

**AC-CAP-001-4: Edge case -- enrollment near boundary causes section jump (SA-005)**
- Given Grade = "CE2" has Enrollment = 104 and Max Class Size = 26,
- When the system calculates sections,
- Then Sections = CEILING(104 / 26) = CEILING(4.0) = 4 sections. If enrollment is then changed to 105 (105/26 = 4.038), Sections = 5, and the system displays a notification: "Section count increased from 4 to 5 due to enrollment exceeding class size boundary."

---

## Cross-Cutting Edge Cases Integrated

---

### Rounding Precision (PO-013) -- Applies to All Calculation FRs

**AC-ROUND-001: All financial calculations use fixed-point decimal arithmetic**
- Given any revenue, staff cost, EoS, GOSI, or P&L calculation is performed,
- When the system executes the calculation,
- Then the system uses fixed-point decimal arithmetic (e.g., Decimal.js or equivalent) for all intermediate steps, rounding only at the final user-facing output to 2 decimal places.

**AC-ROUND-002: Monthly sums match annual totals within tolerance**
- Given any 12-month calculation series (revenue, costs, or P&L line item),
- When the system sums the 12 monthly values,
- Then the sum matches the independently calculated annual total within +/-1 SAR, and any rounding remainder is explicitly allocated (not silently dropped).

**AC-ROUND-003: Application results match Excel baseline**
- Given the Excel workbooks contain the baseline calculation outputs for all revenue, staff costs, and P&L line items,
- When the application calculates the same values using the same inputs,
- Then every line item matches the Excel output within +/-1 SAR per line item per month, verified through automated regression testing.

---

### Duplicate Employee Detection (PO-003) -- Applies to FR-STC-001

**AC-DUP-001: Duplicate detection on employee import**
- Given a user uploads an employee roster with 168 records,
- And record #169 has the same name, department, and joining date as an existing employee,
- When the system processes the import,
- Then the system flags record #169 as a potential duplicate, prevents automatic creation, and prompts the user to confirm: "Employee '[Name]' in [Department] with joining date [Date] may be a duplicate of existing Employee ID [ID]. Create new record or skip?"

**AC-DUP-002: Duplicate detection criteria**
- Given the system checks for duplicates,
- When evaluating a new employee record,
- Then duplication is detected when two or more of the following match: full name (case-insensitive), department, and joining date (within +/-30 days). A single-field match alone does not trigger a duplicate alert.

---

### Mid-Year Joining (PO-004) -- Applies to FR-STC-012

**AC-MIDYEAR-001: Non-September joining date cost allocation**
- Given a new employee has Joining Date = March 1,
- When the system generates the 12-month cost budget,
- Then Jan--Feb show 0.00 SAR for this employee, Mar--Dec show the employee's monthly gross, and the annual total reflects 10 months of cost.

**AC-MIDYEAR-002: Mid-year joiner EoS calculation**
- Given a new employee joins March 1 with EoS Base = 14,500 SAR,
- When the system calculates EoS provision as of Dec 31,
- Then YoS = YEARFRAC(March 1, Dec 31) (approximately 0.833 years), and EoS = (14,500 / 2) x 0.833 = 6,039.25 SAR.

---

*End of Acceptance Criteria Document*
