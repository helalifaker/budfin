# Revenue Page — Process Workflow

> **Document Purpose**: This document provides a comprehensive, plain-language guide to the Revenue planning page. It explains the business process, technical implementation, user actions, and data flow. It serves as a reference for auditors, new developers, and business analysts to understand and propose improvements.

---

## Table of Contents

1. [Overview](#overview)
2. [Business Context](#business-context)
3. [User Roles & Permissions](#user-roles--permissions)
4. [Pre-Conditions](#pre-conditions)
5. [Page Layout & UI Elements](#page-layout--ui-elements)
6. [Step-by-Step Workflow](#step-by-step-workflow)
7. [Data Models & Database Schema](#data-models--database-schema)
8. [API Endpoints](#api-endpoints)
9. [TypeScript Types](#typescript-types)
10. [Calculation Logic](#calculation-logic)
11. [Audit Trail](#audit-trail)
12. [Error Handling](#error-handling)
13. [Improvements Required](#improvements-required)

---

## Overview

| Attribute            | Value                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------- |
| **Page Name**        | Revenue                                                                                   |
| **URL Route**        | `/planning/revenue`                                                                       |
| **Module**           | Epic 2 — Revenue Planning                                                                 |
| **Page File**        | `apps/web/src/pages/planning/revenue.tsx`                                                 |
| **Primary Function** | Plan tuition revenue, discounts, and other income streams based on enrollment projections |

### What This Page Does

The Revenue page is the **second module** in the budget calculation chain, taking enrollment projections as input and producing detailed revenue forecasts. It allows users to:

1. Assign **tariffs** to nationality/grade combinations (RP, R3+, Plein)
2. Configure **fee grids** including DAI (Droits d'Inscription), tuition TTC/HT, and term breakdowns
3. Set **discount rates** by tariff and nationality
4. Define **other revenue** items (registration fees, activities, examination fees)
5. Run the **revenue calculation engine** to produce monthly revenue breakdowns
6. View **executive summary** and revenue forecasts with trend analysis

**Critical Business Rule**: Changes to revenue data mark downstream modules (STAFFING, P&L) as "stale" — requiring recalculation to maintain data consistency.

---

## Business Context

### Revenue Calculation Chain

The Revenue module sits between Enrollment and Staffing/P&L in the calculation cascade:

```
ENROLLMENT ──► REVENUE ──► STAFFING ──► PNL
                │
                └──► Direct impact on budget profitability
```

### Tuition Fee Structure

| Component        | Description                                | VAT Status        |
| ---------------- | ------------------------------------------ | ----------------- |
| **DAI**          | Droits d'Inscription (Registration Rights) | Taxable           |
| **Tuition TTC**  | All taxes included tuition amount          | —                 |
| **Tuition HT**   | Tax-exclusive tuition amount               | Base for VAT calc |
| **Term Amounts** | Split across 3 terms (T1, T2, T3)          | Per term          |

### Tariff Categories

| Tariff    | Code               | Description      | Typical Applicant             |
| --------- | ------------------ | ---------------- | ----------------------------- |
| **RP**    | Régime Prioritaire | Priority regime  | French civil servants         |
| **R3+**   | Régime 3+          | Reduced rate     | Siblings of enrolled students |
| **Plein** | Full Rate          | Standard tuition | All other families            |

### Nationality Categories

| Category      | Description           | VAT Exemption              |
| ------------- | --------------------- | -------------------------- |
| **Francais**  | French nationals      | No                         |
| **Nationaux** | Saudi nationals (KSA) | Yes (diplomatic agreement) |
| **Autres**    | Other nationalities   | Varies                     |

### Other Revenue Categories (IFRS)

| Category                  | Examples                              | Distribution        |
| ------------------------- | ------------------------------------- | ------------------- |
| **Registration Fees**     | Application fees, enrollment deposits | Academic 10-month   |
| **Activities & Services** | After-school programs, transportation | Custom weights      |
| **Examination Fees**      | Exam registration, certification      | Specific period     |
| **Other Revenue**         | Miscellaneous income                  | Year-round 12-month |

---

## User Roles & Permissions

| Role            | View Data | Edit Fee Grid | Edit Discounts | Edit Other Revenue | Run Calculations |
| --------------- | --------- | ------------- | -------------- | ------------------ | ---------------- |
| **Admin**       | ✅        | ✅            | ✅             | ✅                 | ✅               |
| **BudgetOwner** | ✅        | ✅            | ✅             | ✅                 | ✅               |
| **Editor**      | ✅        | ✅            | ✅             | ✅                 | ✅               |
| **Viewer**      | ✅        | ❌            | ❌             | ❌                 | ❌               |

**Version Lock Rule**: All edit operations are blocked if the Budget Version status is not "Draft". Published, Locked, or Archived versions cannot be modified.

---

## Pre-Conditions

Before using this page, the following must be configured:

### Required Master Data (via Admin → Master Data)

1. **Grade Levels** (`grade_levels` table)
    - Grade codes: PS, MS, GS, CP, CE1, CE2, CM1, CM2, 6eme, 5eme, 4eme, 3eme, 2nde, 1ere, Terminale
    - Band assignments (MATERNELLE, ELEMENTAIRE, COLLEGE, LYCEE)

2. **Nationalities** (`nationalities` table)
    - Code: FR, NAT, AUT (mapped to Francais, Nationaux, Autres)
    - VAT exemption flags

### Required Budget Setup

1. **Budget Version** must be created and selected in the workspace context bar
2. **Enrollment data** must be calculated (headcounts by grade/nationality/tariff)
3. The version must be in **"Draft"** status for edits
4. **Fiscal Year** and **Academic Period** context must be set

---

## Page Layout & UI Elements

### Header Section

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Revenue                                                   [FY2026][AY1][AY2]│
│  Plan tuition revenue, discounts, and other income streams.   [Calculate]   │
├─────────────────────────────────────────────────────────────────────────────┤
│  📊 KPI Ribbon                                                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │ Gross Rev HT │ │ Total Disc.  │ │ Net Revenue  │ │ Avg/Student  │       │
│  │ 12,450,000   │ │ 1,245,000    │ │ 11,205,000   │ │ 45,750       │       │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Filter Controls

| Button            | Values           | Function                             |
| ----------------- | ---------------- | ------------------------------------ |
| **Period Filter** | FY2026, AY1, AY2 | Filters all grids by academic period |

### Action Buttons

| Button                | Icon       | Role Required              | Action                          |
| --------------------- | ---------- | -------------------------- | ------------------------------- |
| **Calculate Revenue** | Calculator | Admin, BudgetOwner, Editor | Runs revenue calculation engine |

### KPI Ribbon Display

| KPI                    | Description                      | Format                   |
| ---------------------- | -------------------------------- | ------------------------ |
| **Gross Revenue (HT)** | Total tuition before discounts   | SAR currency, 2 decimals |
| **Total Discounts**    | Sum of all discount amounts      | SAR currency, 2 decimals |
| **Net Revenue**        | Gross minus discounts (HT)       | SAR currency, 2 decimals |
| **Avg per Student**    | Net revenue divided by headcount | SAR currency, 2 decimals |

### Workspace Blocks (Main Content)

#### 1. Tariff Assignment Grid

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ Tariff Assignment                                                              [stale] │
├────────────┬──────────┬────────────┬────────────┬────────────┬──────────────────────────┤
│ Grade      │ Nat.     │ RP %       │ R3+ %      │ Plein %    │ Total                    │
├────────────┼──────────┼────────────┼────────────┼────────────┼──────────────────────────┤
│ PS         │ Francais │ [  60%  ]  │ [  20%  ]  │ [  20%  ]  │ 100% ✓                   │
│ PS         │ Nationaux│ [  30%  ]  │ [  30%  ]  │ [  40%  ]  │ 100% ✓                   │
│ ...        │ ...      │ ...        │ ...        │ ...        │ ...                      │
└────────────┴──────────┴────────────┴────────────┴────────────┴──────────────────────────┘
```

**Editable Fields**:

- **RP %, R3+ %, Plein %**: Percentage of students in each tariff category (must sum to 100%)

**Validation**:

- Each grade × nationality row must sum to exactly 100%
- Invalid rows highlighted in red

#### 2. Fee Grid & Assumptions

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ Fee Grid & Assumptions                                                                  │
├──────────┬──────────┬────────┬───────────┬───────────┬────────┬────────┬────────────────┤
│ Grade    │ Nat.     │ Tariff │ DAI       │ Tuition   │ Term 1 │ Term 2 │ Term 3         │
├──────────┼──────────┼────────┼───────────┼───────────┼────────┼────────┼────────────────┤
│ PS       │ Francais │ RP     │ [10000]   │ [45000]   │ 15000  │ 15000  │ 15000          │
│ PS       │ Francais │ R3+    │ [10000]   │ [60000]   │ 20000  │ 20000  │ 20000          │
│ ...      │ ...      │ ...    │ ...       │ ...       │ ...    │ ...    │ ...            │
└──────────┴──────────┴────────┴───────────┴───────────┴────────┴────────┴────────────────┘
```

**Editable Fields**:

- **DAI**: Droits d'Inscription amount (SAR)
- **Tuition TTC**: Total all-inclusive tuition (SAR)
- **Term amounts**: Auto-calculated from tuition TTC unless manually overridden

**Computed Fields**:

- **Tuition HT**: TTC ÷ (1 + VAT rate)
- **VAT Amount**: TTC - HT

#### 3. Discounts

```
┌─────────────────────────────────────────────────────────────────┐
│ Discounts                                                       │
├─────────────┬──────────────┬─────────────────┬──────────────────┤
│ Tariff      │ Nationality  │ Discount Rate   │ Effective Rate   │
├─────────────┼──────────────┼─────────────────┼──────────────────┤
│ RP          │ All          │ [    0%    ]    │ 0%               │
│ R3+         │ Francais     │ [   15%    ]    │ 15%              │
│ R3+         │ Nationaux    │ [   10%    ]    │ 10%              │
│ R3+         │ Autres       │ [   12%    ]    │ 12%              │
└─────────────┴──────────────┴─────────────────┴──────────────────┘
```

**Editable Fields**:

- **Discount Rate**: Percentage discount applied to tuition (0–100%)

**Business Rules**:

- RP tariff typically has 0% discount
- R3+ tariff receives sibling discount
- Discounts apply to tuition only, not DAI

#### 4. Other Revenue

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ Other Revenue                                                                        │
├───────────────────┬───────────────┬───────────────────┬──────────────────────────────┤
│ Line Item         │ Annual Amount │ Distribution      │ IFRS Category                │
├───────────────────┼───────────────┼───────────────────┼──────────────────────────────┤
│ Registration Fees │ [  250,000  ] │ Academic 10-mo    │ Registration Fees            │
│ After-School Act. │ [  180,000  ] │ Custom Weights    │ Activities & Services        │
│ Exam Fees         │ [   45,000  ] │ Specific Period   │ Examination Fees             │
│ [+ Add Item]      │               │                   │                              │
└───────────────────┴───────────────┴───────────────────┴──────────────────────────────┘
```

**Editable Fields**:

- **Line Item Name**: Description of revenue source
- **Annual Amount**: Total expected revenue (SAR)
- **Distribution Method**: How revenue is spread across months
- **IFRS Category**: Accounting classification

**Distribution Methods**:

- **ACADEMIC_10**: Spread across 10 academic months (Sep–Jun)
- **YEAR_ROUND_12**: Evenly across all 12 months
- **CUSTOM_WEIGHTS**: User-defined monthly weights
- **SPECIFIC_PERIOD**: Single month or custom range

#### 5. Revenue Engine

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ Revenue Engine                                                                      │
├─────────────────────┬─────────┬─────────┬─────────┬─────────┬─────────┬─────────────┤
│ Section             │ Oct     │ Nov     │ Dec     │ Jan     │ Feb     │ ...         │
├─────────────────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────────┤
│ Tuition Revenue     │ 850K    │ 850K    │ 850K    │ 920K    │ 920K    │ ...         │
│ Discounts           │ -85K    │ -85K    │ -85K    │ -92K    │ -92K    │ ...         │
│ Net Tuition         │ 765K    │ 765K    │ 765K    │ 828K    │ 828K    │ ...         │
│ Other Revenue       │ 45K     │ 30K     │ 30K     │ 50K     │ 30K     │ ...         │
├─────────────────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────────┤
│ TOTAL REVENUE       │ 810K    │ 795K    │ 795K    │ 878K    │ 858K    │ ...         │
└─────────────────────┴─────────┴─────────┴─────────┴─────────┴─────────┴─────────────┘
```

**Display Fields** (read-only, computed):

- Monthly breakdown by revenue category
- Running totals and percentages
- Visual trend indicators

#### 6. Executive Summary

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ Executive Summary                                                                   │
├─────────────────────────────────────────────────────────────────────────────────────┤
│  Revenue Composition                    │  Monthly Trend                          │
│  ┌─────────────────────────────────┐    │  ┌─────────────────────────────────┐   │
│  │ Tuition (Net)      85% ████████ │    │  │                                 │   │
│  │ Registration Fees   8% ██       │    │  │    ╱╲     Peak in January       │   │
│  │ Activities          5% █        │    │  │   ╱  ╲    ╱                     │   │
│  │ Other               2%          │    │  │  ╱    ╲__╱                      │   │
│  └─────────────────────────────────┘    │  └─────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

**Display Fields**:

- Revenue composition (pie/bar chart)
- Monthly trend line chart
- Key metrics summary

---

## Step-by-Step Workflow

### Workflow 1: Configure Tariff Assignment

**Actor**: Budget Owner or Editor

| Step | Action                                      | UI Element        | API Call                              | Result                                |
| ---- | ------------------------------------------- | ----------------- | ------------------------------------- | ------------------------------------- |
| 1    | Select Budget Version from context bar      | Dropdown          | `GET /versions`                       | Version loaded                        |
| 2    | Navigate to Revenue page                    | Sidebar menu      | -                                     | Page loads                            |
| 3    | Verify enrollment data is calculated        | Stale badge check | -                                     | ENROLLMENT not stale                  |
| 4    | Click Tariff % cell for a grade/nationality | EditableCell      | -                                     | Cell enters edit mode                 |
| 5    | Enter percentage (e.g., 60 for RP)          | Number input      | -                                     | Value displayed                       |
| 6    | Edit remaining tariff percentages           | Editable cells    | -                                     | Values sum to 100%                    |
| 7    | Confirm entries                             | Blur/Enter        | `PUT /versions/{id}/revenue/fee-grid` | Data saved, STAFFING/PNL marked stale |

**Database Changes**:

- Insert/Update `fee_grids` table
- Update `budget_versions.stale_modules` array to include STAFFING, PNL
- Insert `audit_entries` record with operation FEE_GRID_UPDATED

---

### Workflow 2: Configure Fee Grid

**Actor**: Budget Owner or Editor

| Step | Action                                | UI Element          | API Call                              | Business Logic             |
| ---- | ------------------------------------- | ------------------- | ------------------------------------- | -------------------------- |
| 1    | Expand "Fee Grid & Assumptions" block | Collapsible section | -                                     | Grid displayed             |
| 2    | Click DAI cell for a grade/nat/tariff | EditableCell        | -                                     | Cell enters edit mode      |
| 3    | Enter DAI amount (e.g., 10000)        | Currency input      | -                                     | Value formatted as SAR     |
| 4    | Click Tuition TTC cell                | EditableCell        | -                                     | Cell enters edit mode      |
| 5    | Enter tuition amount (e.g., 45000)    | Currency input      | -                                     | Tuition HT auto-calculated |
| 6    | Adjust term amounts if needed         | Editable cells      | -                                     | Defaults: T1=T2=T3=TTC/3   |
| 7    | Confirm entries                       | Blur/Enter          | `PUT /versions/{id}/revenue/fee-grid` | Saved to database          |

**Formula**:

```
Tuition HT = Tuition TTC ÷ (1 + VAT Rate)
VAT Amount = Tuition TTC - Tuition HT
Default Term Amount = Tuition TTC ÷ 3
```

---

### Workflow 3: Configure Discounts

**Actor**: Budget Owner or Editor

| Step | Action                                          | UI Element          | API Call                               | Result                  |
| ---- | ----------------------------------------------- | ------------------- | -------------------------------------- | ----------------------- |
| 1    | Expand "Discounts" block                        | Collapsible section | -                                      | Discount grid displayed |
| 2    | Click Discount Rate cell for tariff/nationality | EditableCell        | -                                      | Cell enters edit mode   |
| 3    | Enter discount percentage (e.g., 15)            | Percentage input    | -                                      | Value displayed as 15%  |
| 4    | Confirm entry                                   | Blur/Enter          | `PUT /versions/{id}/revenue/discounts` | Saved to database       |
| 5    | Observe Effective Rate column                   | Computed field      | -                                      | Shows applied discount  |

**Discount Application Logic**:

```
Discount Amount = Tuition HT × Discount Rate
Net Tuition = Tuition HT - Discount Amount
```

---

### Workflow 4: Configure Other Revenue

**Actor**: Budget Owner or Editor

| Step | Action                         | UI Element          | API Call                                   | Result                  |
| ---- | ------------------------------ | ------------------- | ------------------------------------------ | ----------------------- |
| 1    | Expand "Other Revenue" block   | Collapsible section | -                                          | Revenue items displayed |
| 2    | Click "+ Add Item" button      | Button              | -                                          | New row added to grid   |
| 3    | Enter Line Item Name           | Text input          | -                                          | Name captured           |
| 4    | Enter Annual Amount            | Currency input      | -                                          | Amount captured         |
| 5    | Select Distribution Method     | Dropdown            | -                                          | Method selected         |
| 6    | Configure distribution details | Varies by method    | -                                          | Monthly spread defined  |
| 7    | Select IFRS Category           | Dropdown            | -                                          | Category assigned       |
| 8    | Click Save                     | Button              | `PUT /versions/{id}/revenue/other-revenue` | Item saved              |

**Distribution Method Details**:
| Method | Description | Configuration |
|--------|-------------|---------------|
| ACADEMIC_10 | Sep–Jun equal split | No additional config |
| YEAR_ROUND_12 | Jan–Dec equal split | No additional config |
| CUSTOM_WEIGHTS | User-defined monthly weights | Array of 12 weights |
| SPECIFIC_PERIOD | Specific months only | Month selection |

---

### Workflow 5: Run Revenue Calculation

**Actor**: Budget Owner or Editor

| Step | Action                               | UI Element      | API Call                                | Result                      |
| ---- | ------------------------------------ | --------------- | --------------------------------------- | --------------------------- |
| 1    | Verify all configuration is complete | Visual review   | -                                       | All grids populated         |
| 2    | Click "Calculate Revenue" button     | Button          | `POST /versions/{id}/calculate/revenue` | Calculation initiated       |
| 3    | Observe button state                 | Spinner icon    | -                                       | Shows "Calculating..."      |
| 4    | Wait for completion                  | Success message | -                                       | Shows success banner        |
| 5    | Review KPI Ribbon                    | Display area    | -                                       | Updated with new values     |
| 6    | Review Revenue Engine output         | Data grid       | -                                       | Monthly breakdown displayed |
| 7    | Review Executive Summary             | Charts/Tables   | -                                       | Visual analysis updated     |

**Calculation Steps** (Backend):

1. Fetch enrollment data (headcounts by grade/nationality/tariff)
2. Fetch fee grid configuration (DAI, tuition by grade/nat/tariff)
3. Fetch discount rates by tariff/nationality
4. Fetch other revenue items
5. Calculate monthly tuition revenue:
    - For each grade × nationality × tariff combination
    - Apply fee grid amounts to headcounts
    - Apply discount rates
    - Spread across academic periods
6. Calculate monthly other revenue based on distribution methods
7. Persist all results to `monthly_revenues` table
8. Update revenue totals
9. Remove REVENUE from stale modules
10. Mark STAFFING and PNL as stale
11. Create calculation audit log

---

## Data Models & Database Schema

### Core Tables

#### 1. fee_grids

Stores tuition fees by grade, nationality, and tariff.

```sql
Table: fee_grids
┌───────────────────┬─────────────────┬────────────────────────────────────────────┐
│ Column            │ Type            │ Description                                │
├───────────────────┼─────────────────┼────────────────────────────────────────────┤
│ id                │ SERIAL PK       │ Unique identifier                          │
│ version_id        │ INTEGER FK      │ → budget_versions.id                       │
│ academic_period   │ VARCHAR(3)      │ 'AY1' or 'AY2'                             │
│ grade_level       │ VARCHAR(10)     │ Grade code (PS, MS, etc.)                  │
│ nationality       │ VARCHAR(10)     │ 'Francais', 'Nationaux', 'Autres'          │
│ tariff            │ VARCHAR(10)     │ 'RP', 'R3+', or 'Plein'                    │
│ tariff_weight     │ DECIMAL(5,4)    │ % of students in this tariff (0–1)         │
│ dai               │ DECIMAL(15,4)   │ Droits d'Inscription amount                │
│ tuition_ttc       │ DECIMAL(15,4)   │ Tuition all taxes included                 │
│ tuition_ht        │ DECIMAL(15,4)   │ Tuition tax-exclusive                      │
│ term1_amount      │ DECIMAL(15,4)   │ First term amount                          │
│ term2_amount      │ DECIMAL(15,4)   │ Second term amount                         │
│ term3_amount      │ DECIMAL(15,4)   │ Third term amount                          │
│ created_at        │ TIMESTAMPTZ     │ Record creation timestamp                  │
│ updated_at        │ TIMESTAMPTZ     │ Last update timestamp                      │
└───────────────────┴─────────────────┴────────────────────────────────────────────┘

Unique Constraint: (version_id, academic_period, grade_level, nationality, tariff)
```

#### 2. discount_policies

Stores discount rates by tariff and nationality.

```sql
Table: discount_policies
┌───────────────────┬─────────────────┬────────────────────────────────────────────┐
│ Column            │ Type            │ Description                                │
├───────────────────┼─────────────────┼────────────────────────────────────────────┤
│ id                │ SERIAL PK       │ Unique identifier                          │
│ version_id        │ INTEGER FK      │ → budget_versions.id                       │
│ tariff            │ VARCHAR(10)     │ 'RP' or 'R3+' (Plein has no discount)      │
│ nationality       │ VARCHAR(10)     │ 'Francais', 'Nationaux', 'Autres', or null │
│ discount_rate     │ DECIMAL(5,4)    │ Discount percentage (0.00–1.00)            │
│ created_at        │ TIMESTAMPTZ     │ Record creation timestamp                  │
│ updated_at        │ TIMESTAMPTZ     │ Last update timestamp                      │
└───────────────────┴─────────────────┴────────────────────────────────────────────┘

Unique Constraint: (version_id, tariff, nationality)
```

#### 3. other_revenue_items

Stores non-tuition revenue line items.

```sql
Table: other_revenue_items
┌───────────────────┬─────────────────┬────────────────────────────────────────────┐
│ Column            │ Type            │ Description                                │
├───────────────────┼─────────────────┼────────────────────────────────────────────┤
│ id                │ SERIAL PK       │ Unique identifier                          │
│ version_id        │ INTEGER FK      │ → budget_versions.id                       │
│ line_item_name    │ VARCHAR(100)    │ Description of revenue item                │
│ annual_amount     │ DECIMAL(15,4)   │ Total annual amount                        │
│ distribution_method│ VARCHAR(20)    │ 'ACADEMIC_10', 'YEAR_ROUND_12', etc.       │
│ weight_array      │ DECIMAL(5,4)[]  │ Monthly weights (for CUSTOM_WEIGHTS)       │
│ specific_months   │ INTEGER[]       │ Month numbers (for SPECIFIC_PERIOD)        │
│ ifrs_category     │ VARCHAR(50)     │ 'Registration Fees', 'Activities', etc.    │
│ created_at        │ TIMESTAMPTZ     │ Record creation timestamp                  │
│ updated_at        │ TIMESTAMPTZ     │ Last update timestamp                      │
└───────────────────┴─────────────────┴────────────────────────────────────────────┘
```

#### 4. monthly_revenues

Stores calculated monthly revenue breakdown.

```sql
Table: monthly_revenues
┌───────────────────┬─────────────────┬────────────────────────────────────────────┐
│ Column            │ Type            │ Description                                │
├───────────────────┼─────────────────┼────────────────────────────────────────────┤
│ id                │ SERIAL PK       │ Unique identifier                          │
│ version_id        │ INTEGER FK      │ → budget_versions.id                       │
│ academic_period   │ VARCHAR(3)      │ 'AY1' or 'AY2'                             │
│ grade_level       │ VARCHAR(10)     │ Grade code                                 │
│ nationality       │ VARCHAR(10)     │ 'Francais', 'Nationaux', 'Autres'          │
│ tariff            │ VARCHAR(10)     │ 'RP', 'R3+', or 'Plein'                    │
│ month             │ INTEGER         │ Month number (1–12)                        │
│ gross_revenue_ht  │ DECIMAL(15,4)   │ Gross revenue before discounts             │
│ discount_amount   │ DECIMAL(15,4)   │ Applied discount amount                    │
│ scholarship_deduction│ DECIMAL(15,4) │ Scholarship deduction (if applicable)      │
│ net_revenue_ht    │ DECIMAL(15,4)   │ Net revenue after deductions               │
│ vat_amount        │ DECIMAL(15,4)   │ VAT amount                                 │
│ created_at        │ TIMESTAMPTZ     │ Record creation timestamp                  │
│ updated_at        │ TIMESTAMPTZ     │ Last update timestamp                      │
└───────────────────┴─────────────────┴────────────────────────────────────────────┘

Unique Constraint: (version_id, academic_period, grade_level, nationality, tariff, month)
```

#### 5. monthly_other_revenues

Stores calculated monthly other revenue breakdown.

```sql
Table: monthly_other_revenues
┌───────────────────┬─────────────────┬────────────────────────────────────────────┐
│ Column            │ Type            │ Description                                │
├───────────────────┼─────────────────┼────────────────────────────────────────────┤
│ id                │ SERIAL PK       │ Unique identifier                          │
│ version_id        │ INTEGER FK      │ → budget_versions.id                       │
│ line_item_name    │ VARCHAR(100)    │ Description of revenue item                │
│ ifrs_category     │ VARCHAR(50)     │ IFRS classification                        │
│ executive_category│ VARCHAR(50)     │ Executive summary category                 │
│ include_in_executive│ BOOLEAN       │ Whether to include in exec summary         │
│ month             │ INTEGER         │ Month number (1–12)                        │
│ amount            │ DECIMAL(15,4)   │ Revenue amount for the month               │
│ created_at        │ TIMESTAMPTZ     │ Record creation timestamp                  │
│ updated_at        │ TIMESTAMPTZ     │ Last update timestamp                      │
└───────────────────┴─────────────────┴────────────────────────────────────────────┘
```

#### 6. calculation_audit_log

Tracks all calculation runs for audit purposes.

```sql
Table: calculation_audit_log
┌───────────────────┬─────────────────┬────────────────────────────────────────────┐
│ Column            │ Type            │ Description                                │
├───────────────────┼─────────────────┼────────────────────────────────────────────┤
│ id                │ SERIAL PK       │ Unique identifier                          │
│ version_id        │ INTEGER FK      │ → budget_versions.id                       │
│ run_id            │ UUID            │ Unique calculation run ID                  │
│ module            │ VARCHAR(20)     │ 'REVENUE', 'ENROLLMENT', etc.              │
│ status            │ VARCHAR(20)     │ 'STARTED', 'COMPLETED', 'FAILED'           │
│ started_at        │ TIMESTAMPTZ     │ Calculation start time                     │
│ completed_at      │ TIMESTAMPTZ     │ Calculation end time                       │
│ duration_ms       │ INTEGER         │ Execution time in milliseconds             │
│ input_summary     │ JSONB           │ Input data summary                         │
│ output_summary    │ JSONB           │ Results summary                            │
│ triggered_by      │ INTEGER FK      │ → users.id                                 │
└───────────────────┴─────────────────┴────────────────────────────────────────────┘
```

---

## API Endpoints

### Fee Grid APIs

| Method | Endpoint                                 | Description           | Auth | Role                       |
| ------ | ---------------------------------------- | --------------------- | ---- | -------------------------- |
| GET    | `/versions/{versionId}/revenue/fee-grid` | List fee grid entries | JWT  | Any                        |
| PUT    | `/versions/{versionId}/revenue/fee-grid` | Update fee grid       | JWT  | Admin, BudgetOwner, Editor |

**PUT Request Body**:

```json
{
    "entries": [
        {
            "academicPeriod": "AY1",
            "gradeLevel": "PS",
            "nationality": "Francais",
            "tariff": "RP",
            "dai": "10000",
            "tuitionTtc": "45000",
            "tuitionHt": "39130.43",
            "term1Amount": "15000",
            "term2Amount": "15000",
            "term3Amount": "15000"
        }
    ]
}
```

**PUT Response**:

```json
{
    "updated": 1,
    "staleModules": ["STAFFING", "PNL"]
}
```

---

### Discount APIs

| Method | Endpoint                                  | Description            | Auth | Role                       |
| ------ | ----------------------------------------- | ---------------------- | ---- | -------------------------- |
| GET    | `/versions/{versionId}/revenue/discounts` | List discount policies | JWT  | Any                        |
| PUT    | `/versions/{versionId}/revenue/discounts` | Update discounts       | JWT  | Admin, BudgetOwner, Editor |

**PUT Request Body**:

```json
{
    "entries": [
        {
            "tariff": "R3+",
            "nationality": "Francais",
            "discountRate": "0.15"
        },
        {
            "tariff": "R3+",
            "nationality": "Nationaux",
            "discountRate": "0.10"
        }
    ]
}
```

---

### Other Revenue APIs

| Method | Endpoint                                      | Description              | Auth | Role                       |
| ------ | --------------------------------------------- | ------------------------ | ---- | -------------------------- |
| GET    | `/versions/{versionId}/revenue/other-revenue` | List other revenue items | JWT  | Any                        |
| PUT    | `/versions/{versionId}/revenue/other-revenue` | Update other revenue     | JWT  | Admin, BudgetOwner, Editor |

**PUT Request Body**:

```json
{
    "items": [
        {
            "id": 1,
            "lineItemName": "Registration Fees",
            "annualAmount": "250000",
            "distributionMethod": "ACADEMIC_10",
            "weightArray": null,
            "specificMonths": null,
            "ifrsCategory": "Registration Fees"
        },
        {
            "lineItemName": "After-School Activities",
            "annualAmount": "180000",
            "distributionMethod": "CUSTOM_WEIGHTS",
            "weightArray": [0, 0.1, 0.1, 0.1, 0.1, 0.1, 0, 0, 0.1, 0.1, 0.1, 0.2],
            "specificMonths": null,
            "ifrsCategory": "Activities & Services"
        }
    ]
}
```

---

### Calculation APIs

| Method | Endpoint                                  | Description      | Auth | Role                       |
| ------ | ----------------------------------------- | ---------------- | ---- | -------------------------- |
| POST   | `/versions/{versionId}/calculate/revenue` | Run revenue calc | JWT  | Admin, BudgetOwner, Editor |

**Response**:

```json
{
  "runId": "550e8400-e29b-41d4-a716-446655440000",
  "durationMs": 320,
  "entries": [
    {
      "academicPeriod": "AY1",
      "gradeLevel": "PS",
      "nationality": "Francais",
      "tariff": "RP",
      "month": 1,
      "grossRevenueHt": "39130.43",
      "discountAmount": "0",
      "scholarshipDeduction": "0",
      "netRevenueHt": "39130.43",
      "vatAmount": "5869.57"
    }
  ],
  "otherRevenueEntries": [
    {
      "lineItemName": "Registration Fees",
      "ifrsCategory": "Registration Fees",
      "executiveCategory": "REGISTRATION_FEES",
      "includeInExecutiveSummary": true,
      "month": 1,
      "amount": "25000"
    }
  ],
  "totals": {
    "grossRevenueHt": "12450000",
    "discountAmount": "1245000",
    "netRevenueHt": "11205000",
    "vatAmount": "1687500",
    "otherRevenueAmount": "475000",
    "totalOperatingRevenue": "11680000"
  },
  "executiveSummary": {
    "rows": [...],
    "composition": [...],
    "monthlyTrend": [...]
  }
}
```

---

## TypeScript Types

### Core Types (`packages/types/src/revenue.ts`)

```typescript
// Distribution methods for other revenue
export const DISTRIBUTION_METHODS = [
    'ACADEMIC_10',
    'YEAR_ROUND_12',
    'CUSTOM_WEIGHTS',
    'SPECIFIC_PERIOD',
] as const;
export type DistributionMethod = (typeof DISTRIBUTION_METHODS)[number];

// IFRS accounting categories
export const IFRS_CATEGORIES = [
    'Registration Fees',
    'Activities & Services',
    'Examination Fees',
    'Other Revenue',
] as const;
export type IfrsCategory = (typeof IFRS_CATEGORIES)[number];

// Executive summary categories
export type RevenueExecutiveCategory =
    | 'REGISTRATION_FEES'
    | 'ACTIVITIES_SERVICES'
    | 'EXAMINATION_FEES';

// Fee grid entry
export interface FeeGridEntry {
    academicPeriod: 'AY1' | 'AY2';
    gradeLevel: string;
    nationality: 'Francais' | 'Nationaux' | 'Autres';
    tariff: 'RP' | 'R3+' | 'Plein';
    dai: string; // DAI amount (string for Decimal precision)
    tuitionTtc: string; // Tuition TTC
    tuitionHt: string; // Tuition HT (computed)
    term1Amount: string; // Term 1 amount
    term2Amount: string; // Term 2 amount
    term3Amount: string; // Term 3 amount
}

// Discount policy entry
export interface DiscountEntry {
    tariff: 'RP' | 'R3+';
    nationality: 'Francais' | 'Nationaux' | 'Autres' | null;
    discountRate: string; // 0.00–1.00 as string
}

// Other revenue line item
export interface OtherRevenueItem {
    id?: number;
    lineItemName: string;
    annualAmount: string;
    distributionMethod: DistributionMethod;
    weightArray: number[] | null;
    specificMonths: number[] | null;
    ifrsCategory: IfrsCategory;
}

// Monthly calculated revenue
export interface MonthlyRevenueEntry {
    academicPeriod: string;
    gradeLevel: string;
    nationality: string;
    tariff: string;
    month: number;
    grossRevenueHt: string;
    discountAmount: string;
    scholarshipDeduction: string;
    netRevenueHt: string;
    vatAmount: string;
}

// Monthly other revenue
export interface MonthlyOtherRevenueEntry {
    lineItemName: string;
    ifrsCategory: IfrsCategory | string;
    executiveCategory: RevenueExecutiveCategory | null;
    includeInExecutiveSummary: boolean;
    month: number;
    amount: string;
}

// Revenue totals summary
export interface RevenueTotals {
    grossRevenueHt: string;
    discountAmount: string;
    netRevenueHt: string;
    vatAmount: string;
    otherRevenueAmount: string;
    totalOperatingRevenue: string;
}

// Revenue matrix row for engine display
export interface RevenueMatrixRow {
    section: string;
    label: string;
    monthlyAmounts: string[]; // 12 months
    annualTotal: string;
    percentageOfRevenue: string;
    isTotal: boolean;
}

// Revenue composition item
export interface RevenueCompositionItem {
    label: string;
    amount: string;
    percentageOfRevenue: string;
}

// Executive summary data
export interface RevenueExecutiveSummary {
    rows: RevenueMatrixRow[];
    composition: RevenueCompositionItem[];
    monthlyTrend: Array<{
        month: number;
        amount: string;
    }>;
}

// Full calculation response
export interface RevenueResultsResponse {
    entries: MonthlyRevenueEntry[];
    otherRevenueEntries: MonthlyOtherRevenueEntry[];
    summary: Array<Record<string, string>>;
    totals: RevenueTotals;
    rowCount: number;
    revenueEngine: {
        rows: RevenueMatrixRow[];
    };
    executiveSummary: RevenueExecutiveSummary;
}
```

---

## Calculation Logic

### Revenue Calculation Flow

```typescript
// 1. Calculate headcount by grade × nationality × tariff
headcount = enrollment_data × tariff_weight

// 2. Calculate gross tuition revenue
monthlyGross = (DAI + TermAmount) × headcount
annualGross = sum(monthlyGross)

// 3. Apply discounts
discountAmount = tuitionHT × discountRate
netTuition = tuitionHT - discountAmount

// 4. Calculate VAT (for non-exempt nationalities)
if (nationality !== 'Nationaux'):
  vatAmount = netTuition × vatRate
else:
  vatAmount = 0  // Saudi nationals VAT exempt

// 5. Calculate other revenue by month
for each otherRevenueItem:
  switch (distributionMethod):
    case 'ACADEMIC_10':
      monthAmount = annualAmount ÷ 10 for months 9–18 (Sep–Jun)
    case 'YEAR_ROUND_12':
      monthAmount = annualAmount ÷ 12 for all months
    case 'CUSTOM_WEIGHTS':
      monthAmount = annualAmount × weightArray[month]
    case 'SPECIFIC_PERIOD':
      monthAmount = annualAmount for specificMonths only

// 6. Calculate totals
totalGrossHT = sum(all gross revenue HT)
totalDiscounts = sum(all discount amounts)
totalNetHT = totalGrossHT - totalDiscounts
totalOther = sum(all other revenue)
totalOperatingRevenue = totalNetHT + totalOther
```

### Monthly Distribution Logic

```typescript
// Tuition revenue distribution follows academic calendar
const ACADEMIC_MONTHS = {
  AY1: [1, 2, 3, 4, 5, 6],      // Jan–Jun
  Summer: [7, 8],                // Jul–Aug (no tuition)
  AY2: [9, 10, 11, 12]           // Sep–Dec
};

// Term-based distribution
Term 1: Months 1–2 (Jan–Feb) or Month 9 (Sep) depending on entry
Term 2: Months 3–5 (Mar–May) or Months 10–12 (Oct–Dec)
Term 3: Month 6 (Jun) or deferred to next period
```

### KPI Calculations

```typescript
// Gross Revenue (HT)
grossRevenueHT = sum(monthly_revenues.gross_revenue_ht)

// Total Discounts
totalDiscounts = sum(monthly_revenues.discount_amount)

// Net Revenue (HT)
netRevenueHT = grossRevenueHT - totalDiscounts

// Average Revenue per Student
avgPerStudent = netRevenueHT ÷ totalHeadcount
```

---

## Audit Trail

### Operations Logged

| Operation             | Table                 | Data Captured                                    |
| --------------------- | --------------------- | ------------------------------------------------ |
| FEE_GRID_UPDATED      | fee_grids             | Grade, nationality, tariff, DAI, tuition amounts |
| DISCOUNTS_UPDATED     | discount_policies     | Tariff, nationality, discount rate               |
| OTHER_REVENUE_UPDATED | other_revenue_items   | Line item, amount, distribution method           |
| CALCULATION_STARTED   | calculation_audit_log | Run ID, inputs                                   |
| CALCULATION_COMPLETED | calculation_audit_log | Duration, outputs, totals                        |

### Audit Entry Schema

```typescript
{
  userId: number;
  userEmail: string;
  operation: string;
  tableName: string;
  recordId: number;
  ipAddress: string;
  oldValues?: Json;      // For updates
  newValues: Json;       // New/updated data
  createdAt: Date;
}
```

---

## Error Handling

### Common Error Codes

| Code                  | HTTP Status | Description                          | User Action                      |
| --------------------- | ----------- | ------------------------------------ | -------------------------------- |
| VERSION_NOT_FOUND     | 404         | Budget version does not exist        | Select valid version             |
| VERSION_LOCKED        | 409         | Version is Published/Locked/Archived | Create new version or unlock     |
| ENROLLMENT_STALE      | 409         | Enrollment data not calculated       | Run enrollment calculation first |
| TARIFF_WEIGHT_INVALID | 422         | Tariff weights don't sum to 100%     | Adjust percentages to total 100% |
| NEGATIVE_AMOUNT       | 422         | Fee or discount amount is negative   | Enter non-negative amount        |
| INVALID_DISCOUNT_RATE | 422         | Discount rate > 100% or < 0%         | Enter rate between 0% and 100%   |
| INVALID_DISTRIBUTION  | 422         | Distribution weights don't sum to 1  | Adjust weights                   |
| UNAUTHORIZED          | 401         | User not authenticated               | Log in                           |
| FORBIDDEN             | 403         | User lacks required role             | Contact administrator            |

---

## Improvements Required

This section documents known issues, technical debt, and proposed enhancements for the Revenue module.

### High Priority

| ID      | Issue                         | Impact                                                  | Proposed Solution                  |
| ------- | ----------------------------- | ------------------------------------------------------- | ---------------------------------- |
| REV-001 | **No bulk fee grid import**   | Manual entry of 135+ fee combinations is time-consuming | Add CSV import for fee grid data   |
| REV-002 | **No fee grid templates**     | New versions require re-entry of similar data           | Add template/save-as functionality |
| REV-003 | **Limited discount modeling** | Cannot model sibling count discounts                    | Add tiered discount structure      |
| REV-004 | **No revenue comparison**     | Cannot compare revenue scenarios across versions        | Add version comparison view        |

### Medium Priority

| ID      | Issue                           | Impact                                 | Proposed Solution                    |
| ------- | ------------------------------- | -------------------------------------- | ------------------------------------ |
| REV-005 | **No payment schedule preview** | Parents cannot see payment timing      | Add parent-facing payment schedule   |
| REV-006 | **Currency handling rigid**     | All amounts in SAR only                | Support multi-currency for reporting |
| REV-007 | **No early payment discounts**  | Cannot model early payment incentives  | Add early payment discount rules     |
| REV-008 | **Missing revenue alerts**      | No notification for revenue shortfalls | Add threshold-based alerts           |

### Low Priority / Technical Debt

| ID      | Issue                               | Impact                                     | Proposed Solution                   |
| ------- | ----------------------------------- | ------------------------------------------ | ----------------------------------- |
| REV-009 | **Hardcoded VAT rate**              | VAT changes require code deployment        | Move VAT rate to configuration      |
| REV-010 | **No fee versioning**               | Cannot track fee changes over time         | Add fee history/audit trail         |
| REV-011 | **Decimal precision inconsistency** | Some calculations use string, some Decimal | Standardize on Decimal.js           |
| REV-012 | **Client-side validation gaps**     | Server rejects some invalid inputs late    | Add comprehensive client validation |

### Feature Requests

| ID      | Feature                       | Business Value                     | Complexity |
| ------- | ----------------------------- | ---------------------------------- | ---------- |
| REV-F01 | **Scholarship management**    | Track and model scholarship awards | Medium     |
| REV-F02 | **Payment plan builder**      | Create custom payment schedules    | Medium     |
| REV-F03 | **Revenue forecasting**       | ML-based revenue predictions       | High       |
| REV-F04 | **What-if analysis**          | Scenario modeling for fee changes  | Medium     |
| REV-F05 | **Parent portal integration** | Show fees to parents in portal     | High       |

---

## Appendix A: Tariff × Nationality Matrix

```
Total combinations per grade: 3 nationalities × 3 tariffs = 9 rows
With 15 grade levels and 2 academic periods = 270 fee grid entries maximum

                    RP          R3+         Plein
                 ┌─────────┬─────────┬─────────┐
    Francais     │   60%   │   20%   │   20%   │
                 ├─────────┼─────────┼─────────┤
    Nationaux    │   30%   │   30%   │   40%   │
                 ├─────────┼─────────┼─────────┤
    Autres       │   40%   │   25%   │   35%   │
                 └─────────┴─────────┴─────────┘

Note: Percentages are examples; actual values configured per grade
```

---

## Appendix B: Stale Module Cascade

When revenue data changes, the following modules become stale:

```
┌─────────────────────────────────────────────────────────────┐
│  REVENUE (user changes fee/discount data)                    │
│        │                                                     │
│        ▼                                                     │
│  ┌─────────────┐  ┌─────────────┐                           │
│  │  STAFFING   │  │     PNL     │                           │
│  │  (positions)│  │  (profit)   │                           │
│  └─────────────┘  └─────────────┘                           │
│                                                             │
│  Note: ENROLLMENT is NOT marked stale by REVENUE changes    │
│  (upstream dependency preserved)                            │
└─────────────────────────────────────────────────────────────┘
```

Users must run calculations in downstream modules to clear stale flags.

---

## Document History

| Version | Date       | Author       | Changes                   |
| ------- | ---------- | ------------ | ------------------------- |
| 1.0     | 2026-03-10 | AI Assistant | Initial document creation |

---

_End of Document_
