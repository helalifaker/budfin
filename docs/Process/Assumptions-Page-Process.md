# Assumptions & Parameters Page — Process Workflow

> **Document Purpose**: This document provides a comprehensive, plain-language guide to the Assumptions & Parameters configuration page. It explains the business process, technical implementation, user actions, and data flow. It serves as a reference for auditors, new developers, and business analysts to understand and propose improvements.

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
10. [Calculation Engine](#calculation-engine)
11. [Audit Trail](#audit-trail)
12. [Error Handling](#error-handling)
13. [Improvements Required](#improvements-required)

---

## Overview

| Attribute            | Value                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Page Name**        | Assumptions & Parameters                                                                                      |
| **URL Route**        | `/master-data/assumptions`                                                                                    |
| **Module**           | Epic 7 — Master Data Management                                                                               |
| **Page File**        | `apps/web/src/pages/master-data/assumptions.tsx`                                                              |
| **Primary Function** | Configure system-wide assumptions and parameters used in staffing cost calculations and financial projections |

### What This Page Does

The Assumptions & Parameters page is the **central configuration hub** for all system-wide constants used across budget calculations. It allows users to:

1. Configure **tax parameters** (VAT rates)
2. Set **financial parameters** (interest rates, discount rates)
3. Manage **social charges** (GOSI employer/employee contribution rates)
4. Define **academic calendar parameters** (instructional weeks, holidays)
5. Configure **administrative fees** (registration, re-enrollment fees)
6. View **computed values** (GOSI Total Rate from employer + employee contributions)

**Critical Business Rule**: Changes to assumption values immediately affect downstream **staffing cost calculations**. Modified assumptions trigger recalculation requirements for the Staffing module.

---

## Business Context

### Parameter Categories

| Section            | Description                          | Impact Area                                  |
| ------------------ | ------------------------------------ | -------------------------------------------- |
| **Tax**            | VAT and other tax-related rates      | Revenue calculations, fee computations       |
| **Financial**      | Interest rates, discount factors     | Present value calculations, loan projections |
| **Social Charges** | GOSI pension, SANED, OHI rates       | Staffing cost calculations, EOS benefits     |
| **Academic**       | Calendar weeks, instructional days   | DHG hour calculations, teacher allocations   |
| **Fees**           | Administrative and registration fees | Revenue projections, family billing          |

### GOSI (General Organization for Social Insurance)

Saudi Arabia's social insurance system requires both employer and employee contributions:

| Component   | Employer Pays  | Employee Pays  | Purpose                       |
| ----------- | -------------- | -------------- | ----------------------------- |
| **Pension** | Configurable % | Configurable % | Retirement benefits           |
| **SANED**   | Configurable % | 0%             | Unemployment insurance        |
| **OHI**     | Configurable % | 0%             | Occupational hazard insurance |

**Computed Total**: GOSI Total Rate = GOSI Employer Rate + GOSI Employee Rate

This total rate is applied to gross salaries when calculating total staffing costs and End-of-Service (EOS) benefits.

---

## User Roles & Permissions

| Role            | View Data | Edit Assumptions | View Audit History |
| --------------- | --------- | ---------------- | ------------------ |
| **Admin**       | ✅        | ✅               | ✅                 |
| **BudgetOwner** | ✅        | ✅               | ✅                 |
| **Editor**      | ✅        | ✅               | ❌                 |
| **Viewer**      | ✅        | ❌               | ❌                 |

**Permission Check**: Edit operations require `data:edit` permission (granted to Admin, BudgetOwner, Editor roles).

---

## Pre-Conditions

Before using this page, the following must be in place:

### Required System Configuration

1. **Assumption Records** (`assumptions` table)
    - All standard parameters must be seeded in the database
    - Each parameter has a unique `key`, `section`, `label`, `value`, and `valueType`
    - Initial values should be set based on current fiscal year requirements

2. **User Authentication**
    - User must be logged in with valid JWT token
    - User role must be assigned (Admin, BudgetOwner, Editor, or Viewer)

### Master Data Dependencies

Assumptions are used by the following modules:

| Downstream Module | Assumptions Used                 |
| ----------------- | -------------------------------- |
| **Staffing**      | GOSI rates for cost calculations |
| **Revenue**       | VAT rates for fee calculations   |
| **DHG**           | Academic calendar parameters     |
| **P&L**           | Financial rates for projections  |

---

## Page Layout & UI Elements

### Header Section

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Assumptions & Parameters                                                   │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  📋 Grouped Parameter Table                                                 │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ ▶ Tax                                                  [collapsed]    │ │
│  ├───────────────────────────────────────────────────────────────────────┤ │
│  │ ▼ Social Charges                                       [expanded]     │ │
│  │   ┌──────────────┬──────────────┬──────────┬─────────────────────────┐│ │
│  │   │ Label        │ Value        │ Unit     │ Status                  ││ │
│  │   ├──────────────┼──────────────┼──────────┼─────────────────────────┤│ │
│  │   │ GOSI Pension │ [  9.00   ]  │ %        │ Saved                   ││ │
│  │   │ GOSI SANED   │ [  1.00   ]  │ %        │                         ││ │
│  │   │ GOSI OHI     │ [  2.00   ]  │ %        │                         ││ │
│  │   │ ➕ GOSI Total│    12.00     │ %        │ (computed)              ││ │
│  │   └──────────────┴──────────────┴──────────┴─────────────────────────┘│ │
│  └───────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Section Organization

| Section            | Key                  | Label               | Unit       | Value Type          |
| ------------------ | -------------------- | ------------------- | ---------- | ------------------- |
| **Tax**            | `vatRate`            | VAT Rate            | %          | PERCENTAGE          |
| **Financial**      | `[financial params]` | Various             | %/SAR      | PERCENTAGE/CURRENCY |
| **Social Charges** | `gosiPension`        | GOSI Pension Rate   | %          | PERCENTAGE          |
|                    | `gosiSaned`          | GOSI SANED Rate     | %          | PERCENTAGE          |
|                    | `gosiOhi`            | GOSI OHI Rate       | %          | PERCENTAGE          |
| **Academic**       | `[academic params]`  | Calendar parameters | weeks/days | INTEGER             |
| **Fees**           | `[fee params]`       | Administrative fees | SAR        | CURRENCY            |

### Interactive Elements

| Element            | Behavior                        | Keyboard Support                    |
| ------------------ | ------------------------------- | ----------------------------------- |
| **Section Header** | Click to expand/collapse        | Enter/Space to toggle               |
| **Value Cell**     | Click to enter edit mode        | Tab to navigate, Enter to save      |
| **Input Field**    | Inline text input               | Escape to cancel, Enter/Tab to save |
| **Save Status**    | Shows Saving... / Saved / Error | N/A (visual feedback)               |

---

## Step-by-Step Workflow

### Workflow 1: View Assumptions

**Actor**: Any authenticated user

| Step | Action                       | UI Element                               | API Call                       | Result                  |
| ---- | ---------------------------- | ---------------------------------------- | ------------------------------ | ----------------------- |
| 1    | Navigate to Assumptions page | Sidebar menu → Master Data → Assumptions | -                              | Page loads              |
| 2    | Observe loading state        | Skeleton table                           | `GET /master-data/assumptions` | Data fetched            |
| 3    | Review grouped parameters    | Expandable sections                      | -                              | All sections displayed  |
| 4    | Expand a section             | Click section header                     | -                              | Section rows revealed   |
| 5    | Review computed values       | GOSI Total row (if in Social Charges)    | -                              | Computed rate displayed |

**API Response**:

```json
{
    "assumptions": [
        {
            "id": 1,
            "key": "gosiPension",
            "value": "9.0000",
            "unit": "%",
            "section": "social_charges",
            "label": "GOSI Pension Rate",
            "valueType": "PERCENTAGE",
            "version": 3
        }
    ],
    "computed": {
        "gosiRateTotal": "12.0000"
    }
}
```

---

### Workflow 2: Edit Assumption Value (Inline)

**Actor**: Admin, BudgetOwner, or Editor

| Step | Action                     | UI Element                 | API Call                         | Result                          |
| ---- | -------------------------- | -------------------------- | -------------------------------- | ------------------------------- |
| 1    | Locate parameter to edit   | Value cell                 | -                                | Cell identified                 |
| 2    | Click on value cell        | Editable cell              | -                                | Cell enters edit mode           |
| 3    | Enter new value            | Input field                | -                                | Value displayed in input        |
| 4    | Press Tab or click outside | Blur event                 | `PATCH /master-data/assumptions` | Auto-save triggered             |
| 5    | Observe save status        | Status column              | -                                | Shows "Saving..." then "Saved"  |
| 6    | Continue editing           | Tab navigates to next cell | -                                | Next parameter enters edit mode |

**Keyboard Navigation**:

- **Tab**: Save current, move to next parameter
- **Enter**: Save current, exit edit mode
- **Escape**: Cancel edit, revert to original value

**API Request**:

```json
{
    "updates": [
        {
            "key": "gosiPension",
            "value": "10.00",
            "version": 3
        }
    ]
}
```

**Database Changes**:

- Update `assumptions` table: `value`, `version` (incremented), `updated_at`, `updated_by`
- Insert `audit_entries` record with operation `ASSUMPTION_UPDATED`

---

### Workflow 3: Batch Update Multiple Assumptions

**Actor**: Admin, BudgetOwner, or Editor

| Step | Action                   | UI Element    | API Call                         | Result                         |
| ---- | ------------------------ | ------------- | -------------------------------- | ------------------------------ |
| 1    | Edit first parameter     | Value cell    | -                                | Cell in edit mode              |
| 2    | Press Tab to move        | Keyboard      | -                                | Focus moves to next cell       |
| 3    | Edit second parameter    | Value cell    | -                                | New value entered              |
| 4    | Continue Tab navigation  | Keyboard      | -                                | Multiple cells edited          |
| 5    | Final cell: Tab or Enter | Keyboard      | `PATCH /master-data/assumptions` | Batch save triggered           |
| 6    | Observe status updates   | Status column | -                                | All changed cells show "Saved" |

**Transaction Behavior**: All updates are wrapped in a single database transaction. If any update fails (e.g., optimistic lock conflict), all changes are rolled back.

---

### Workflow 4: Handle Validation Errors

**Actor**: Admin, BudgetOwner, or Editor

| Step | Action                 | UI Element            | API Call                         | Result                  |
| ---- | ---------------------- | --------------------- | -------------------------------- | ----------------------- |
| 1    | Enter invalid value    | Input field           | -                                | Invalid value displayed |
| 2    | Attempt to save        | Blur/Enter            | `PATCH /master-data/assumptions` | Validation fails        |
| 3    | Observe error feedback | Status column + Toast | -                                | Shows "Error" + message |
| 4    | Correct the value      | Input field           | -                                | Valid value entered     |
| 5    | Save again             | Blur/Enter            | `PATCH /master-data/assumptions` | Success                 |

**Validation Rules by Type**:

| Value Type     | Validation Rule | Error Message                        |
| -------------- | --------------- | ------------------------------------ |
| **PERCENTAGE** | 0.00 – 100.00   | "Must be a number between 0 and 100" |
| **CURRENCY**   | Non-negative    | "Must be a non-negative number"      |
| **INTEGER**    | Whole number    | "Must be a whole number"             |
| **DECIMAL**    | Valid number    | "Must be a valid number"             |
| **TEXT**       | Any string      | No validation                        |

---

## Data Models & Database Schema

### Core Tables

#### 1. assumptions

Stores system-wide configurable parameters.

```sql
Table: assumptions
┌───────────────────┬─────────────────────┬────────────────────────────────────────────┐
│ Column            │ Type                │ Description                                │
├───────────────────┼─────────────────────┼────────────────────────────────────────────┤
│ id                │ SERIAL PK           │ Unique identifier                          │
│ key               │ VARCHAR(50) UNIQUE  │ Unique parameter key (snake_case)          │
│ value             │ VARCHAR(500)        │ Parameter value (as string)                │
│ unit              │ VARCHAR(20)         │ Display unit (% or absolute)               │
│ section           │ VARCHAR(50)         │ Grouping category                          │
│ label             │ VARCHAR(100)        │ Human-readable label                       │
│ value_type        │ AssumptionValueType │ PERCENTAGE, CURRENCY, INTEGER, etc.        │
│ version           │ INTEGER             │ Optimistic locking version (starts at 1)   │
│ created_at        │ TIMESTAMPTZ         │ Record creation timestamp                  │
│ updated_at        │ TIMESTAMPTZ         │ Last update timestamp                      │
│ updated_by        │ INTEGER FK          │ → users.id (nullable)                      │
└───────────────────┴─────────────────────┴────────────────────────────────────────────┘

Unique Constraint: key
Foreign Key: updated_by → users(id)
```

#### 2. audit_entries

Tracks all changes for compliance auditing.

```sql
Table: audit_entries
┌───────────────────┬─────────────────┬────────────────────────────────────────────┐
│ Column            │ Type            │ Description                                │
├───────────────────┼─────────────────┼────────────────────────────────────────────┤
│ id                │ SERIAL PK       │ Unique identifier                          │
│ user_id           │ INTEGER FK      │ → users.id                                 │
│ operation         │ VARCHAR(50)     │ ASSUMPTION_UPDATED                         │
│ table_name        │ VARCHAR(100)    │ "assumptions"                              │
│ record_id         │ INTEGER         │ → assumptions.id                           │
│ old_values        │ JSONB           │ Previous {key, value}                      │
│ new_values        │ JSONB           │ New {key, value}                           │
│ ip_address        │ VARCHAR(45)     │ Client IP for audit trail                  │
│ user_email        │ VARCHAR(255)    │ User identifier                            │
│ session_id        │ VARCHAR(100)    │ Session tracking                           │
│ audit_note        │ TEXT            │ Additional context                         │
│ created_at        │ TIMESTAMPTZ     │ Timestamp of change                        │
└───────────────────┴─────────────────┴────────────────────────────────────────────┘

Indexes: created_at, user_id, table_name + record_id, operation
```

### Enum: AssumptionValueType

```sql
Enum: assumption_value_type
┌─────────────┬────────────────────────────────────────────┐
│ Value       │ Description                                │
├─────────────┼────────────────────────────────────────────┤
│ PERCENTAGE  │ Percentage values (0-100)                  │
│ CURRENCY    │ Monetary amounts (SAR)                     │
│ INTEGER     │ Whole numbers                              │
│ DECIMAL     │ Decimal numbers                            │
│ TEXT        │ Free text                                  │
└─────────────┴────────────────────────────────────────────┘
```

---

## API Endpoints

### Assumptions APIs

| Method | Endpoint                   | Description             | Auth | Permission        |
| ------ | -------------------------- | ----------------------- | ---- | ----------------- |
| GET    | `/master-data/assumptions` | List all assumptions    | JWT  | Any authenticated |
| PATCH  | `/master-data/assumptions` | Bulk update assumptions | JWT  | data:edit         |

#### GET Response

```json
{
    "assumptions": [
        {
            "id": 1,
            "key": "vatRate",
            "value": "15.0000",
            "unit": "%",
            "section": "tax",
            "label": "VAT Rate",
            "valueType": "PERCENTAGE",
            "version": 1
        },
        {
            "id": 2,
            "key": "gosiPension",
            "value": "9.0000",
            "unit": "%",
            "section": "social_charges",
            "label": "GOSI Pension Rate",
            "valueType": "PERCENTAGE",
            "version": 3
        }
    ],
    "computed": {
        "gosiRateTotal": "12.0000"
    }
}
```

#### PATCH Request

```json
{
    "updates": [
        {
            "key": "gosiPension",
            "value": "10.00",
            "version": 3
        },
        {
            "key": "gosiSaned",
            "value": "1.50",
            "version": 2
        }
    ]
}
```

#### PATCH Response (Success)

```json
{
    "assumptions": [
        /* Full updated list */
    ],
    "computed": {
        "gosiRateTotal": "13.5000"
    }
}
```

#### PATCH Response (Validation Error - 422)

```json
{
    "code": "VALIDATION_ERROR",
    "message": "One or more values failed validation",
    "field_errors": [
        {
            "field": "gosiPension",
            "message": "Must be a number between 0 and 100"
        }
    ]
}
```

#### PATCH Response (Optimistic Lock - 409)

```json
{
    "code": "OPTIMISTIC_LOCK",
    "message": "An assumption has been modified by another user"
}
```

---

## TypeScript Types

### Core Types (`apps/web/src/hooks/use-assumptions.ts`)

```typescript
// Value type enum
export type AssumptionValueType = 'PERCENTAGE' | 'CURRENCY' | 'INTEGER' | 'DECIMAL' | 'TEXT';

// Individual assumption
export interface Assumption {
    id: number;
    key: string;
    value: string;
    unit: string;
    section: string;
    label: string;
    valueType: AssumptionValueType;
    version: number;
}

// API response structure
export interface AssumptionsResponse {
    assumptions: Assumption[];
    computed: {
        gosiRateTotal: string;
    };
}
```

### Update Types

```typescript
// Single update payload
interface AssumptionUpdate {
    key: string;
    value: string;
    version: number;
}

// PATCH request body
interface PatchAssumptionsRequest {
    updates: AssumptionUpdate[];
}
```

### Component Types

```typescript
// Save status for UI feedback
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface CellSaveStatus {
    status: SaveStatus;
    timerId?: ReturnType<typeof setTimeout>;
}

// Section ordering
const SECTION_ORDER = ['tax', 'financial', 'social_charges', 'academic', 'fees'] as const;
```

---

## Calculation Engine

### GOSI Total Rate Computation

```typescript
const GOSI_KEYS = ['gosiPension', 'gosiSaned', 'gosiOhi'];

function computeGosiTotal(assumptions: Array<{ key: string; value: string }>): string {
    const gosiAssumptions = assumptions.filter((a) => GOSI_KEYS.includes(a.key));
    const total = gosiAssumptions.reduce(
        (sum, a) => sum.plus(new Decimal(a.value)),
        new Decimal(0)
    );
    return total.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4);
}
```

**Example Calculation**:

```
GOSI Pension Rate:  9.00%
GOSI SANED Rate:    1.00%
GOSI OHI Rate:      2.00%
──────────────────────────
GOSI Total Rate:   12.00%
```

### Value Canonicalization

```typescript
function canonicalizeValue(value: string, valueType: string): string {
    if (valueType === 'CURRENCY' || valueType === 'PERCENTAGE') {
        return new Decimal(value).toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4);
    }
    return value;
}
```

### Downstream Impact

When assumptions change, the following calculations are affected:

| Changed Assumption | Impacted Module | Calculation Affected          |
| ------------------ | --------------- | ----------------------------- |
| GOSI rates         | Staffing        | Employer contribution costs   |
| GOSI rates         | Staffing        | End-of-Service (EOS) benefits |
| VAT rate           | Revenue         | Fee calculations              |
| Academic weeks     | DHG             | Teaching hour allocations     |
| Fee amounts        | Revenue         | Total revenue projections     |

---

## Audit Trail

### Operations Logged

| Operation          | Table       | Data Captured             |
| ------------------ | ----------- | ------------------------- |
| ASSUMPTION_UPDATED | assumptions | key, old value, new value |

### Audit Entry Example

```typescript
{
  userId: 5,
  userEmail: "budget.owner@efir.edu.sa",
  operation: "ASSUMPTION_UPDATED",
  tableName: "assumptions",
  recordId: 2,
  ipAddress: "192.168.1.100",
  oldValues: {
    key: "gosiPension",
    value: "9.0000"
  },
  newValues: {
    key: "gosiPension",
    value: "10.0000"
  },
  createdAt: "2026-03-10T08:30:00+03:00"
}
```

### Optimistic Locking

The `version` field on each assumption enables optimistic concurrency control:

1. **Read**: Client receives current `version` with assumption data
2. **Modify**: Client sends update with original `version`
3. **Check**: Database verifies `version` matches before updating
4. **Conflict**: If version mismatch, returns 409 error
5. **Success**: If version matches, increments version and saves

---

## Error Handling

### Common Error Codes

| Code             | HTTP Status | Description                     | User Action             |
| ---------------- | ----------- | ------------------------------- | ----------------------- |
| UNAUTHORIZED     | 401         | User not authenticated          | Log in                  |
| FORBIDDEN        | 403         | User lacks data:edit permission | Contact administrator   |
| VALIDATION_ERROR | 422         | Value failed type validation    | Correct the input value |
| OPTIMISTIC_LOCK  | 409         | Record modified by another user | Refresh and try again   |

### Validation Error Details

| Value Type | Validation         | Error Response                       |
| ---------- | ------------------ | ------------------------------------ |
| PERCENTAGE | < 0 or > 100       | "Must be a number between 0 and 100" |
| CURRENCY   | < 0                | "Must be a non-negative number"      |
| INTEGER    | Not a whole number | "Must be a whole number"             |
| DECIMAL    | Not a valid number | "Must be a valid number"             |

---

## Improvements Required

This section documents known issues, technical debt, and proposed enhancements for the Assumptions & Parameters module.

### High Priority

| ID      | Issue                                | Impact                                    | Proposed Solution                              |
| ------- | ------------------------------------ | ----------------------------------------- | ---------------------------------------------- |
| ASM-001 | **No bulk import capability**        | Manual entry required for many parameters | Add CSV import for batch assumption updates    |
| ASM-002 | **No assumption versioning history** | Cannot view or restore previous values    | Add version history with rollback capability   |
| ASM-003 | **Limited computed value types**     | Only GOSI total is computed               | Allow configurable computed fields (formulas)  |
| ASM-004 | **No change approval workflow**      | Changes apply immediately                 | Add approval workflow for critical assumptions |

### Medium Priority

| ID      | Issue                         | Impact                                          | Proposed Solution                                                 |
| ------- | ----------------------------- | ----------------------------------------------- | ----------------------------------------------------------------- |
| ASM-005 | **No parameter descriptions** | Users may not understand parameter purpose      | Add tooltip/help text for each parameter                          |
| ASM-006 | **No parameter dependencies** | Cannot model related parameters                 | Add dependency chains (e.g., changing pension auto-adjusts total) |
| ASM-007 | **No export functionality**   | Cannot backup or analyze assumptions externally | Add "Export to Excel/CSV" button                                  |
| ASM-008 | **Section order hardcoded**   | Cannot customize display order                  | Add user preference for section ordering                          |

### Low Priority / Technical Debt

| ID      | Issue                            | Impact                                  | Proposed Solution                             |
| ------- | -------------------------------- | --------------------------------------- | --------------------------------------------- |
| ASM-009 | **Value stored as string**       | Requires type conversion on every read  | Consider typed value columns or JSONB         |
| ASM-010 | **No parameter categories/tags** | Flat section structure only             | Add tagging system for cross-cutting concerns |
| ASM-011 | **Unit display hardcoded**       | Cannot handle complex units             | Add unit configuration per parameter          |
| ASM-012 | **No default value reset**       | Cannot easily revert to system defaults | Add "Reset to Default" button per parameter   |

### Feature Requests

| ID      | Feature                               | Business Value                                     | Complexity |
| ------- | ------------------------------------- | -------------------------------------------------- | ---------- |
| ASM-F01 | **Assumption scenarios**              | Compare budget impact of different assumption sets | High       |
| ASM-F02 | **Audit report export**               | Compliance documentation                           | Medium     |
| ASM-F03 | **Parameter change notifications**    | Alert stakeholders when key assumptions change     | Low        |
| ASM-F04 | **Integration with external sources** | Auto-update rates from government APIs             | High       |
| ASM-F05 | **Assumption templates**              | Quick setup for new fiscal years                   | Medium     |

---

## Appendix A: Section Hierarchy

```
Assumptions & Parameters
│
├── Tax
│   └── VAT Rate
│
├── Financial
│   ├── Interest Rate
│   ├── Discount Rate
│   └── [Other financial parameters]
│
├── Social Charges (GOSI)
│   ├── GOSI Pension Rate
│   ├── GOSI SANED Rate
│   ├── GOSI OHI Rate
│   └── GOSI Total Rate (computed)
│
├── Academic
│   ├── Instructional Weeks AY1
│   ├── Instructional Weeks AY2
│   ├── Summer Weeks
│   └── [Other calendar parameters]
│
└── Fees
    ├── Registration Fee
    ├── Re-enrollment Fee
    └── [Other administrative fees]
```

---

## Appendix B: Downstream Impact Chain

When assumption values change, the following cascade occurs:

```
┌─────────────────────────────────────────────────────────────┐
│  ASSUMPTION CHANGED (e.g., GOSI Pension Rate)                │
│        │                                                     │
│        ▼                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │   STAFFING  │  │   STAFFING  │  │   STAFFING  │          │
│  │   Costs     │  │    EOS      │  │   Budget    │          │
│  │  (updated)  │  │  (updated)  │  │  (stale)    │          │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘          │
│         │                │                │                  │
│         └────────────────┴────────────────┘                  │
│                          │                                   │
│                          ▼                                   │
│                    ┌─────────────┐                           │
│                    │     PNL     │                           │
│                    │  (stale)    │                           │
│                    └─────────────┘                           │
└─────────────────────────────────────────────────────────────┘
```

Users must re-run staffing calculations after modifying social charges assumptions.

---

## Document History

| Version | Date       | Author       | Changes                   |
| ------- | ---------- | ------------ | ------------------------- |
| 1.0     | 2026-03-10 | AI Assistant | Initial document creation |

---

_End of Document_
