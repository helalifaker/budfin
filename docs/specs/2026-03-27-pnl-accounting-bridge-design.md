# P&L Accounting Bridge -- Design Specification

**Date:** 2026-03-27
**Status:** Approved
**Author:** Faker Helali + Claude

## 1. Problem Statement

BudFin has a sophisticated analytical P&L engine that calculates revenue by grade, staffing
by cost component, and opex by IFRS category. However, the school's accounting system
(French PCG -- Plan Comptable General) records data on entirely different axes:

- **Tuition revenue**: Accounting records by trimester (701100/701200/701300); BudFin
  calculates by grade level (PS, MS, LS, LY) per month
- **Staff costs**: Accounting records by function (641100 Teachers, 641400 Admin); BudFin
  calculates by component (base salary, housing, transport, GOSI, EOS)
- **OpEx**: Accounting uses PCG codes (606xxx, 613xxx); BudFin uses IFRS categories

This makes it impossible to compare budget vs prior year actuals at the account level.

## 2. Design Goals

1. **Zero changes to existing calculation engines** -- revenue, staffing, opex, and
   pnl-engine remain untouched
2. **Mapping layer** -- configurable transformation from analytical P&L output to
   PCG accounts and IFRS presentation
3. **Budget vs actual comparison** -- side-by-side with variance analysis against
   historical accounting data
4. **Profit center reporting** -- isolate P&L by Maternelle, Elementaire, College, Lycee
5. **User-configurable P&L structure** -- interactive template editor where users control
   which accounts appear, which roll into "Others", and the display order

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  Existing Engines (UNTOUCHED)                           │
│  Revenue Engine → Staffing Engine → OpEx Engine         │
│         ↓                ↓               ↓              │
│              MonthlyPnlLine (analytical)                │
└───────────────────────┬─────────────────────────────────┘
                        │
          ┌─────────────▼──────────────┐
          │  NEW: Mapping Layer        │
          │  PnlAccountMapping table   │
          │  (P&L line → PCG account   │
          │   → IFRS label → section   │
          │   → visibility → order)    │
          └─────────────┬──────────────┘
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
┌──────────────┐ ┌─────────────┐ ┌──────────────┐
│ Master Data: │ │ P&L Mapping │ │ Rebuilt P&L  │
│ COA CRUD     │ │ Config UI   │ │ Page (IFRS)  │
│ (Management  │ │ (Management │ │ (Planning    │
│  Shell)      │ │  Shell)     │ │  Shell)      │
└──────────────┘ └─────────────┘ └──────────────┘
```

## 4. Data Model

### 4.1 ChartOfAccount (extend existing)

Add three fields to the existing model:

| Field          | Type                      | Purpose                                                    |
| -------------- | ------------------------- | ---------------------------------------------------------- |
| `parentCode`   | `String?`                 | Account hierarchy (e.g., 7011 parent of 701100)            |
| `profitCenter` | `ProfitCenter?`           | MATERNELLE / ELEMENTAIRE / COLLEGE / LYCEE / null (shared) |
| `isSystem`     | `Boolean @default(false)` | `true` for seeded accounts, prevents deletion              |

New enum `ProfitCenter` (separate from `GradeBand` which includes `NON_ACADEMIC`):

```prisma
enum ProfitCenter {
  MATERNELLE
  ELEMENTAIRE
  COLLEGE
  LYCEE

  @@map("profit_center")
}
```

Accounts with `profitCenter = null` are shared/common costs allocated by headcount.
The existing `GradeBand` enum is not reused because it serves a different purpose
(department/grade classification) and includes `NON_ACADEMIC` which is not a P&L
profit center.

### 4.2 PnlTemplate (new)

Defines a saved P&L structure.

| Field                     | Type                                | Purpose                                               |
| ------------------------- | ----------------------------------- | ----------------------------------------------------- |
| `id`                      | `Int @id @default(autoincrement())` | Primary key                                           |
| `name`                    | `String`                            | e.g., "EFIR IFRS P&L 2025-26"                         |
| `isDefault`               | `Boolean`                           | Active template flag                                  |
| `isSystem`                | `Boolean @default(false)`           | `true` for seeded default template, prevents deletion |
| `version`                 | `Int @default(1)`                   | Optimistic locking                                    |
| `createdBy` / `updatedBy` | `Int`                               | Audit                                                 |
| `createdAt` / `updatedAt` | `DateTime`                          | Timestamps                                            |

`@@map("pnl_templates")`

Constraint: At least one template must always have `isDefault: true`.

### 4.3 PnlTemplateSection (new)

The IFRS sections within a template.

| Field             | Type                                | Purpose                                           |
| ----------------- | ----------------------------------- | ------------------------------------------------- |
| `id`              | `Int @id @default(autoincrement())` | Primary key                                       |
| `templateId`      | `Int → PnlTemplate`                 | Parent template                                   |
| `sectionKey`      | `String`                            | `REVENUE`, `COST_OF_SERVICE`, `STAFF_COSTS`, etc. |
| `displayLabel`    | `String`                            | IFRS display name                                 |
| `displayOrder`    | `Int`                               | Sort order (10, 20, 30...)                        |
| `isSubtotal`      | `Boolean`                           | `true` for GP, EBITDA, Net Profit                 |
| `subtotalFormula` | `String?`                           | Formula using section keys (see Section 5.1)      |
| `signConvention`  | `String @default("POSITIVE")`       | `POSITIVE` (revenue) or `NEGATIVE` (costs)        |

`@@unique([templateId, sectionKey])`
`@@map("pnl_template_sections")`

### 4.4 PnlAccountMapping (new)

Maps analytical P&L lines to template sections. Each mapping connects an analytical
P&L key (from `MonthlyPnlLine`) to a COA account code (for actuals comparison)
and places it in a template section (for IFRS display).

| Field                    | Type                                  | Purpose                                                                |
| ------------------------ | ------------------------------------- | ---------------------------------------------------------------------- |
| `id`                     | `Int @id @default(autoincrement())`   | Primary key                                                            |
| `sectionId`              | `Int → PnlTemplateSection`            | Target IFRS section                                                    |
| `analyticalKey`          | `String`                              | `MonthlyPnlLine.categoryKey` or `lineItemKey` to match for budget data |
| `analyticalKeyType`      | `Enum: CATEGORY \| LINE_ITEM`         | Whether to match against `categoryKey` or `lineItemKey`                |
| `accountCode`            | `String? → ChartOfAccount`            | COA account code for actuals comparison (nullable for subtotals)       |
| `monthFilter`            | `Int[]?`                              | Optional month filter (e.g., `[9,10,11,12]` for T1 tuition)            |
| `displayLabel`           | `String?`                             | Override label for IFRS display                                        |
| `visibility`             | `Enum: SHOW \| GROUP \| EXCLUDE`      | Show as line / roll into Others / ignore                               |
| `displayOrder`           | `Int`                                 | Sort within section                                                    |
| `profitCenterAllocation` | `Enum: DIRECT \| HEADCOUNT \| MANUAL` | Allocation method                                                      |
| `manualAllocation`       | `Json?`                               | When MANUAL: `{ MATERNELLE: 0.25, ELEMENTAIRE: 0.35, ... }`            |

`@@unique([sectionId, analyticalKey, accountCode])` prevents duplicate mappings.

The dual-key design solves the core problem: `analyticalKey` selects budget data from
`MonthlyPnlLine`, while `accountCode` selects actual data from `HistoricalActual`.
The `monthFilter` enables trimester aggregation (e.g., sum months 9-12 for T1 tuition).

### 4.5 HistoricalActual (new)

Stores prior year actuals from accounting.

| Field          | Type                                | Purpose                                                       |
| -------------- | ----------------------------------- | ------------------------------------------------------------- |
| `id`           | `Int @id @default(autoincrement())` | Primary key                                                   |
| `fiscalYear`   | `Int @db.SmallInt`                  | `2024`, `2025` (matches `FiscalPeriod.fiscalYear` convention) |
| `accountCode`  | `String → ChartOfAccount`           | Foreign key to `ChartOfAccount.accountCode`                   |
| `annualAmount` | `Decimal(15,4)`                     | Total for the year                                            |
| `q1Amount`     | `Decimal(15,4)?`                    | Optional trimester 1 breakdown                                |
| `q2Amount`     | `Decimal(15,4)?`                    | Optional trimester 2                                          |
| `q3Amount`     | `Decimal(15,4)?`                    | Optional trimester 3                                          |
| `source`       | `Enum: SEED \| MANUAL`              | How data entered                                              |
| `importedAt`   | `DateTime`                          | When imported                                                 |

`@@unique([fiscalYear, accountCode])` prevents duplicate entries.

Relation: `account ChartOfAccount @relation(fields: [accountCode], references: [accountCode])`
with `onDelete: Restrict` to prevent deleting accounts that have historical data.

## 5. Default IFRS Template Sections

Seeded as the default `PnlTemplate`:

| Order | Section Key        | Display Label            | Type                                              |
| ----- | ------------------ | ------------------------ | ------------------------------------------------- |
| 10    | `REVENUE`          | Revenue                  | Section                                           |
| 20    | `COST_OF_SERVICE`  | Cost of Service          | Section                                           |
| 30    | `GROSS_PROFIT`     | Gross Profit             | Subtotal: REVENUE - COST_OF_SERVICE               |
| 40    | `PFC_6PCT`         | PFC 6%                   | Section (single line: 648010)                     |
| 50    | `STAFF_COSTS`      | Staff Costs              | Section                                           |
| 60    | `RENT`             | Rent                     | Section                                           |
| 70    | `MAINTENANCE`      | Maintenance              | Section                                           |
| 80    | `OTHER_OPEX`       | Other Operating Expenses | Section                                           |
| 90    | `EBITDA`           | EBITDA                   | Subtotal: GP - PFC - Staff - Rent - Maint - Other |
| 100   | `DEPRECIATION`     | Depreciation             | Section                                           |
| 110   | `PROVISIONS`       | Provisions               | Section                                           |
| 120   | `OPERATING_PROFIT` | Operating Profit         | Subtotal: EBITDA - Depreciation - Provisions      |
| 130   | `NET_FINANCE`      | Net Finance              | Section                                           |
| 140   | `NET_PROFIT`       | Net Profit               | Subtotal: Operating Profit + Net Finance          |

### 5.1 Subtotal Formula Syntax

Subtotal formulas use section keys with `+` and `-` operators only. Evaluated left-to-right
(no operator precedence). All terms must be valid section keys from the same template.

```
GROSS_PROFIT:      "REVENUE - COST_OF_SERVICE"
EBITDA:            "GROSS_PROFIT - PFC_6PCT - STAFF_COSTS - RENT - MAINTENANCE - OTHER_OPEX"
OPERATING_PROFIT:  "EBITDA - DEPRECIATION - PROVISIONS"
NET_PROFIT:        "OPERATING_PROFIT + NET_FINANCE"
```

The parser splits on `+` and `-` (space-delimited), resolves each term to its section
subtotal, and applies the operator. This is simple and sufficient -- no parentheses or
multiplication needed for a P&L structure.

### 5.2 Engine Section Key → Template Section Key Mapping

The analytical P&L engine produces 16 section keys. The mapping layer must decompose
some engine sections into multiple IFRS template sections based on `categoryKey`
or `lineItemKey` matching.

| Engine sectionKey   | Engine categoryKey / lineItemKey                                     | Template sectionKey |
| ------------------- | -------------------------------------------------------------------- | ------------------- |
| `REVENUE_CONTRACTS` | `TUITION_FEES`                                                       | `REVENUE`           |
| `REVENUE_CONTRACTS` | `REGISTRATION_FEES`                                                  | `REVENUE`           |
| `REVENUE_CONTRACTS` | `ACTIVITIES_SERVICES`                                                | `REVENUE`           |
| `REVENUE_CONTRACTS` | `EXAMINATION_FEES`                                                   | `REVENUE`           |
| `RENTAL_INCOME`     | (all)                                                                | `REVENUE`           |
| `STAFF_COSTS`       | `LOCAL_SALARIES`                                                     | `STAFF_COSTS`       |
| `STAFF_COSTS`       | `ADDITIONAL_COSTS`                                                   | `STAFF_COSTS`       |
| `STAFF_COSTS`       | `EMPLOYER_CHARGES`                                                   | `STAFF_COSTS`       |
| `OTHER_OPEX`        | Lines where `lineItemKey` matches AEFE (`OPEX_*AEFE*` or mapped)     | `COST_OF_SERVICE`   |
| `OTHER_OPEX`        | Lines where `lineItemKey` matches PFC (`OPEX_*CONTRIBUTION*`)        | `PFC_6PCT`          |
| `OTHER_OPEX`        | Lines where `lineItemKey` matches rent (`OPEX_*RENT*`)               | `RENT`              |
| `OTHER_OPEX`        | Lines where `lineItemKey` matches maintenance (`OPEX_*MAINTENANCE*`) | `MAINTENANCE`       |
| `OTHER_OPEX`        | All remaining operating lines                                        | `OTHER_OPEX`        |
| `DEPRECIATION`      | (all)                                                                | `DEPRECIATION`      |
| `STAFF_COSTS`       | `EMPLOYER_CHARGES` / `EOS_PROVISION` (lineItemKey override)          | `PROVISIONS`        |
| `IMPAIRMENT`        | (all)                                                                | `PROVISIONS`        |
| `FINANCE_INCOME`    | (all)                                                                | `NET_FINANCE`       |
| `FINANCE_COSTS`     | (all)                                                                | `NET_FINANCE`       |

**Key insight**: The engine's `OTHER_OPEX` section is the one that gets decomposed.
AEFE fees, PFC, rent, and maintenance are OpEx line items with specific names or
`ifrsCategory` values. The mapping layer pulls them out into their own IFRS sections
based on `lineItemKey` pattern matching. This requires no engine changes -- we are
simply reclassifying existing output.

**Mapping priority**: When a `lineItemKey` matches a specific mapping (e.g.,
`EOS_PROVISION` → `PROVISIONS`), it takes precedence over the broader `categoryKey`
mapping (e.g., `EMPLOYER_CHARGES` → `STAFF_COSTS`). The service processes LINE_ITEM
mappings first, then CATEGORY mappings for remaining unmatched lines.

**Excluded engine sections**: The engine's computed subtotal/separator sections
(`TOTAL_REVENUE`, `TOTAL_OPEX`, `OPERATING_PROFIT`, `NET_FINANCE`,
`PROFIT_BEFORE_ZAKAT`, `ZAKAT`, `NET_PROFIT`, `SEPARATOR`) are ignored by the
mapping layer. Subtotals are recomputed by the template formula engine (Section 5.1).
`ZAKAT` is intentionally excluded from the IFRS P&L structure -- it is a KSA-specific
tax that does not appear in the French PCG/IFRS income statement. If needed in the
future, it can be added as a template section.

### 5.3 Provisions Section

The Provisions template section contains:

| Source        | Engine Key                        | Description                                            |
| ------------- | --------------------------------- | ------------------------------------------------------ |
| `STAFF_COSTS` | `EOS_PROVISION` (lineItemKey)     | End of Service provision -- extracted from Staff Costs |
| `IMPAIRMENT`  | (all lines)                       | Bad debt provisions, impairment                        |
| `OTHER_OPEX`  | Lines matching `OPEX_*PROVISION*` | Strategic provisions (687500)                          |

Note: `EOS_PROVISION` appears in the analytical P&L under `STAFF_COSTS` section.
The mapping layer moves it to `PROVISIONS` for IFRS presentation. The analytical
engine is untouched; only the display classification changes.

## 6. Account-to-Section Mapping (Default Seed)

### Revenue Section

Each row maps an analytical P&L key (budget source) to a COA account (actuals source).

| analyticalKey (type)               | accountCode | Display Label    | Visibility | monthFilter    |
| ---------------------------------- | ----------- | ---------------- | ---------- | -------------- |
| `TUITION_FEES` (CATEGORY)          | 701100      | Tuition T1       | SHOW       | `[9,10,11,12]` |
| `TUITION_FEES` (CATEGORY)          | 701200      | Tuition T2       | SHOW       | `[1,2,3]`      |
| `TUITION_FEES` (CATEGORY)          | 701300      | Tuition T3       | SHOW       | `[4,5,6]`      |
| `REG_DAI` (LINE_ITEM)              | 701400      | DAI              | SHOW       | null           |
| `REG_DPI` (LINE_ITEM)              | 701401      | DPI              | SHOW       | null           |
| `REG_FRAIS_DE_DOSSIER` (LINE_ITEM) | 701410      | Frais de Dossier | SHOW       | null           |
| `ACT_GARDERIE` (LINE_ITEM)         | 701500      | Daycare          | SHOW       | null           |
| `ACTIVITIES_SERVICES` (CATEGORY)   | null        | Activities       | GROUP      | null           |
| `EXAMINATION_FEES` (CATEGORY)      | null        | Examinations     | SHOW       | null           |
| `RENTAL_INCOME` (CATEGORY)         | null        | Rental Income    | GROUP      | null           |

For actuals comparison, APS activity accounts (701600, 701800-701825), supplies (707200),
photos (708100), books (71810R, 718200), voyages (724317), and evaluation (730000) are
matched by their COA account codes against `HistoricalActual` and roll into the "Others"
line within Revenue.

### Cost of Service Section

AEFE fees are OpEx line items in the analytical P&L. The mapping layer extracts them
from `OTHER_OPEX` based on `lineItemKey` pattern matching.

| analyticalKey (type)           | accountCode | Display Label      | Visibility |
| ------------------------------ | ----------- | ------------------ | ---------- |
| `OPEX_AGENCE_*` (LINE_ITEM)    | 648000      | AEFE Fees          | SHOW       |
| `OPEX_MANUELS_*` (LINE_ITEM)   | 618100      | Teaching Materials | SHOW       |
| `OPEX_LIBRAIRIE_*` (LINE_ITEM) | 618200      | Library            | GROUP      |

Budget source: These `lineItemKey` values come from OpEx line items entered with
names like "AGENCE ENSEIGNEMENT FRANCAIS" → `safeKey()` → `OPEX_AGENCE_ENSEIGNEMENT_FRANCAIS`.

### PFC 6% Section

| analyticalKey (type)              | accountCode | Display Label | Visibility |
| --------------------------------- | ----------- | ------------- | ---------- |
| `OPEX_CONTRIBUTION_*` (LINE_ITEM) | 648010      | PFC 6%        | SHOW       |

### Staff Costs Section

Staff costs in the analytical P&L are broken by component (base, housing, etc.).
For the accounting view, we aggregate all components per function using the employee
department → PCG account mapping.

| analyticalKey (type)          | accountCode | Display Label            | Visibility |
| ----------------------------- | ----------- | ------------------------ | ---------- |
| `LOCAL_SALARIES` (CATEGORY)   | 641100      | French Teachers Salaries | SHOW       |
| `LOCAL_SALARIES` (CATEGORY)   | 641400      | Administration Salaries  | SHOW       |
| `LOCAL_SALARIES` (CATEGORY)   | 641200      | Replacement Salary       | SHOW       |
| `ADDITIONAL_COSTS` (CATEGORY) | null        | Category Costs           | GROUP      |
| `GOSI_SAUDI` (LINE_ITEM)      | 645100      | GOSI                     | SHOW       |
| `EMPLOYER_CHARGES` (CATEGORY) | 648030      | Prime                    | SHOW       |

Note: The split of `LOCAL_SALARIES` budget total into 641100 vs 641400 vs 641200
is done by the mapping service using employee department data from the staffing
module. Each employee has a `departmentBand` that determines their PCG account:

- Teaching departments → 641100
- Administration → 641400
- APS → 641401
- Garderie → 641300
- Replacement → 641200

### Rent Section

| analyticalKey (type)           | accountCode | Display Label | Visibility |
| ------------------------------ | ----------- | ------------- | ---------- |
| `OPEX_SCHOOL_RENT` (LINE_ITEM) | 613100      | School Rent   | SHOW       |

### Maintenance Section

| analyticalKey (type)                    | accountCode | Display Label      | Visibility |
| --------------------------------------- | ----------- | ------------------ | ---------- |
| `OPEX_SCHOOL_MAINTENANCE_*` (LINE_ITEM) | 615100      | School Maintenance | SHOW       |

### Other OpEx Section

All remaining OpEx line items not extracted into Cost of Service, PFC, Rent, or Maintenance.

| analyticalKey (type)               | accountCode | Display Label        | Visibility |
| ---------------------------------- | ----------- | -------------------- | ---------- |
| `OPEX_GENERAL_EXPENSE` (LINE_ITEM) | 606001      | General Expense      | SHOW       |
| `OPEX_INSURANCE_*` (LINE_ITEM)     | 616000      | Insurance            | SHOW       |
| `OPEX_TRAVEL_*` (LINE_ITEM)        | 625600      | Travel & Indemnities | SHOW       |
| `OPEX_MOYASAR_*` (LINE_ITEM)       | 627003      | Payment Processing   | SHOW       |
| `OPEX_FORMATION_*` (LINE_ITEM)     | 631300      | Training             | SHOW       |
| (all other `OPEX_*`)               | (various)   | (various)            | GROUP      |

### Depreciation Section

| analyticalKey (type)      | accountCode | Display Label | Visibility |
| ------------------------- | ----------- | ------------- | ---------- |
| `DEPRECIATION` (CATEGORY) | 681100      | Depreciation  | SHOW       |

### Provisions Section

| analyticalKey (type)           | accountCode | Display Label        | Visibility |
| ------------------------------ | ----------- | -------------------- | ---------- |
| `EOS_PROVISION` (LINE_ITEM)    | 681750      | EOS Provision        | SHOW       |
| `IMPAIRMENT` (CATEGORY)        | 681700      | Bad Debt Provision   | SHOW       |
| `OPEX_PROVISION_*` (LINE_ITEM) | 687500      | Strategic Provisions | SHOW       |

### Net Finance Section

| analyticalKey (type)        | accountCode | Display Label     | Visibility |
| --------------------------- | ----------- | ----------------- | ---------- |
| `FINANCE_INCOME` (CATEGORY) | 770000      | Financial Income  | SHOW       |
| `FINANCE_INCOME` (CATEGORY) | 766000      | FX Gains          | SHOW       |
| `FINANCE_COSTS` (CATEGORY)  | 666000      | FX Losses         | SHOW       |
| `FINANCE_COSTS` (CATEGORY)  | 670000      | Financial Losses  | GROUP      |
| (prior year items)          | 771000      | Misc. Revenues    | GROUP      |
| (prior year items)          | 772000      | Prior Year Income | GROUP      |
| (rounding)                  | 685000      | Rounding          | EXCLUDE    |

## 7. Backend Services

### 7.1 pnl-accounting-service.ts (new, pure function)

```
Input:
  MonthlyPnlLine[]         ← existing analytical P&L
  PnlTemplate              ← active mapping template
  HistoricalActual[]?       ← optional comparison year
  GradeBand?                ← optional profit center filter
  EnrollmentByGrade[]       ← for headcount allocation ratios

Output:
  AccountingPnlView {
    sections: AccountingPnlSection[]
    kpis: { revenue, grossProfit, gpMargin, ebitda, ebitdaMargin, netProfit }
  }
```

Transformation steps:

1. Load `MonthlyPnlLine[]` for the version (existing query)
2. Load active `PnlTemplate` with sections and mappings
3. For each mapping row:
   a. **Budget amount**: Match `analyticalKey` against `MonthlyPnlLine.categoryKey`
   (if `analyticalKeyType = CATEGORY`) or `.lineItemKey` (if `LINE_ITEM`).
   If `monthFilter` is set, only sum months in the filter array.
   Skip header/subtotal/separator rows (`isSubtotal = false`, `depth = 3`).
   b. **Actual amount**: If comparison year requested, match `accountCode` against
   `HistoricalActual.accountCode` for the selected fiscal year.
4. Aggregate matched lines into template sections, respecting visibility:
    - `SHOW` → named line in the section
    - `GROUP` → amount rolls into auto-computed "Others" line
    - `EXCLUDE` → ignored (warning logged if amount > 0)
5. For staff cost mappings with department-based split: load employee cost summaries
   from staffing module, group by `departmentBand`, allocate to matching PCG accounts
6. If profit center filter active: weight cost amounts by enrollment headcount ratio
   for that `GradeBand`. Revenue is already per grade -- filter by matching grade band.
7. Compute subtotals by evaluating section formulas (GP, EBITDA, Operating Profit,
   Net Profit) using the formula parser (Section 5.1)
8. Compute variance: `variance = budget - actual`, `variancePct = variance / actual * 100`
9. Return structured `AccountingPnlView`

### 7.2 Profit Center Allocation

```
Revenue:  DIRECT -- already per grade in MonthlyPnlLine, filter by GradeBand
Costs:    HEADCOUNT -- allocatedAmount = totalAmount × (headcountInBand / totalHeadcount)

Example:
  Staff Costs = 33M SAR
  Maternelle headcount = 200, Total = 800
  Maternelle Staff Costs = 33M × (200/800) = 8.25M
```

### 7.3 Trimester Mapping (Revenue)

BudFin's fiscal year is calendar-based (month 1 = January, month 12 = December).
French school trimesters map to fiscal months as follows:

```
Trimester 1 (Sep-Dec) = fiscal months 9, 10, 11, 12 → maps to 701100
Trimester 2 (Jan-Mar) = fiscal months 1, 2, 3        → maps to 701200
Trimester 3 (Apr-Jun) = fiscal months 4, 5, 6        → maps to 701300
Summer (Jul-Aug)      = fiscal months 7, 8            → no tuition billing
```

The `monthFilter` field on `PnlAccountMapping` stores these month arrays.
When computing the budget figure for a trimester account, the service sums
`MonthlyPnlLine` amounts for the filtered months only.

Monthly budget data aggregated to match PCG trimester accounts for comparison.

### 7.4 New API Routes

| Method   | Route                                            | Purpose                       |
| -------- | ------------------------------------------------ | ----------------------------- |
| `GET`    | `/api/v1/master-data/pnl-templates`              | List templates                |
| `POST`   | `/api/v1/master-data/pnl-templates`              | Create template               |
| `PUT`    | `/api/v1/master-data/pnl-templates/:id`          | Update template               |
| `DELETE` | `/api/v1/master-data/pnl-templates/:id`          | Delete template               |
| `GET`    | `/api/v1/master-data/pnl-templates/:id/mappings` | Get all mappings for template |
| `PUT`    | `/api/v1/master-data/pnl-templates/:id/mappings` | Bulk save mappings            |
| `GET`    | `/api/v1/historical-actuals`                     | List actuals (filter by year) |
| `POST`   | `/api/v1/historical-actuals/bulk`                | Bulk import actuals           |
| `PUT`    | `/api/v1/historical-actuals/:id`                 | Update single actual          |
| `DELETE` | `/api/v1/historical-actuals/:id`                 | Delete single actual          |
| `GET`    | `/api/v1/versions/:versionId/pnl/accounting`     | IFRS P&L view                 |

Query params for `/pnl/accounting`:

- `compareYear` -- fiscal year to compare against (e.g., `2025`)
- `profitCenter` -- filter by GradeBand (e.g., `MATERNELLE`)
- `view` -- `annual` | `quarterly` | `monthly`

## 8. Frontend Pages

### 8.1 Chart of Accounts Master Data

- **Shell:** Management
- **Route:** `/master-data/accounts`
- **Features:** Standard CRUD grid, inline editing, filters (type, status, profit center),
  bulk import, system account protection (lock icon)
- **API changes:** Existing account routes need schema updates to handle the three new
  fields (`parentCode`, `profitCenter`, `isSystem`). Add these to `createAccountSchema`
  and `updateAccountSchema` in `accounts.ts`.
- **Pattern:** Follows existing master data pages (grades, tariffs, departments)

### 8.2 P&L Mapping Configuration

- **Shell:** Management
- **Route:** `/master-data/pnl-mapping`
- **Layout:** Two-panel -- left: live IFRS P&L preview, right: account assignment panel
- **Interactions:**
    - Click section on left → right panel shows assigned accounts
    - `[+ Add account]` → searchable dropdown of COA accounts
    - Tri-state per account: SHOW / GROUP / EXCLUDE
    - Drag handle (⋮) for reordering within sections
    - "Others" line auto-computed per section from GROUP accounts
    - Unassigned accounts panel with warning badge
    - Live subtotal recomputation as accounts are moved
- **Validation:**
    - All active COA accounts must be assigned or explicitly excluded
    - Excluded accounts trigger warning (not blocker)
    - Subtotal formulas validated
- **Persistence:** Saves as `PnlTemplate` + `PnlTemplateSection[]` + `PnlAccountMapping[]`

### 8.3 Rebuilt P&L Page

- **Shell:** Planning
- **Route:** `/reports/pnl` (replaces current P&L page)
- **KPI Ribbon:** Revenue, Gross Profit, EBITDA, Net Profit, EBITDA Margin %
- **Controls:**
    - Compare dropdown: Actual 2024, Actual 2025, or another budget version
    - Profit center tabs: All | Maternelle | Elementaire | College | Lycee
    - View toggle: Annual | Quarterly | Monthly
- **Main grid:** Clean IFRS summary (~15-18 lines), SHOW accounts as named lines,
  GROUP accounts in "Others", subtotal rows bold with separators,
  Budget + Actual + Variance + Var% columns when comparison active
- **Inspector sidebar** (right panel, existing registry pattern):
    - Component breakdown (e.g., Staff Costs → base, housing, GOSI, EOS)
    - PCG account detail (code, name, amount)
    - Profit center split per division
    - Trimester/monthly detail for revenue
    - Navigation links to source modules (Revenue, Staffing, OpEx pages)
- **Conditional formatting:** Negative variances in red, positive in green,
  subtotals visually distinct, "Others" in lighter text,
  stale module warnings (existing pattern)

## 9. Seed Data

### 9.1 Chart of Accounts (~80 accounts)

Parsed from the 2024 and 2025 Compte de Resultat PDFs. Union of all account codes
appearing in either year. Seeded with `isSystem: true`.

Revenue accounts (7xx): ~40 accounts
Expense accounts (6xx): ~40 accounts

### 9.2 Historical Actuals (~160 rows)

Two fiscal years of actual data:

- 2024: ~80 rows (from `Compte de resultat au 31_12_2024.pdf`)
- 2025: ~80 rows (from `Compte de resultat au 31_12_2025.pdf`)

Each row: `{ fiscalYear, accountCode, annualAmount, source: "SEED" }`

### 9.3 Default IFRS Template

One `PnlTemplate` with 14 sections and ~60 mappings as defined in Section 6.

## 10. What Does NOT Change

- `revenue-engine.ts` -- untouched
- `cost-engine.ts`, `dhg-engine.ts`, `monthly-gross.ts`, `yearfrac.ts` -- untouched
- `category-cost-engine.ts` -- untouched
- `opex-engine.ts` -- untouched
- `pnl-engine.ts` -- untouched
- `MonthlyPnlLine` model and storage -- untouched
- All existing calculation routes -- untouched
- Stale module propagation chain -- untouched

## 11. Technical Constraints

- **TC-001**: All monetary calculations use `decimal.js` with `ROUND_HALF_UP`
- **TC-005**: `pnl-accounting-service.ts` is a pure function with no DB dependencies
  (same pattern as existing engines)
- **Prisma 6**: `Uint8Array` for binary fields, `P2025` error handling
- **RBAC**: Template and mapping management requires `admin:config` permission.
  P&L accounting view requires `data:view`. Historical actuals management
  requires `admin:config`.
- **Stale modules**: The accounting P&L view reads from `MonthlyPnlLine`, which is
  computed by the P&L calculate route. If the P&L module is stale, the accounting
  view shows a warning banner: "P&L data is stale. Recalculate to see updated figures."
  This reuses the existing `staleModules` check from `BudgetVersion`.
- **Audit trail**: All CRUD operations on templates, mappings, and historical actuals
  create `AuditEntry` records, following the existing pattern from account routes.
- **Account code validation**: Existing regex `/^[A-Z0-9]{3,10}$/` supports all PCG codes
  in the seed data. Account codes from PDFs must be uppercased during import (e.g.,
  `71810R` is already valid uppercase).

## 12. Prisma Model Table Names

All new models follow the existing `@@map` convention:

| Model                | Table Name                       |
| -------------------- | -------------------------------- |
| `PnlTemplate`        | `@@map("pnl_templates")`         |
| `PnlTemplateSection` | `@@map("pnl_template_sections")` |
| `PnlAccountMapping`  | `@@map("pnl_account_mappings")`  |
| `HistoricalActual`   | `@@map("historical_actuals")`    |
