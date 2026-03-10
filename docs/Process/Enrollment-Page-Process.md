# Enrollment & Capacity Page — Process Workflow

> **Document Purpose**: This document provides a comprehensive, plain-language guide to the Enrollment & Capacity planning page. It explains the business process, technical implementation, user actions, and data flow. It serves as a reference for auditors, new developers, and business analysts to understand and propose improvements.

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

| Attribute            | Value                                                                                                                   |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Page Name**        | Enrollment & Capacity                                                                                                   |
| **URL Route**        | `/planning/enrollment`                                                                                                  |
| **Module**           | Epic 1 — Enrollment Planning                                                                                            |
| **Page File**        | `apps/web/src/pages/planning/enrollment.tsx`                                                                            |
| **Primary Function** | Configure student enrollment projections, cohort progression, nationality distribution, and classroom capacity planning |

### What This Page Does

The Enrollment & Capacity page is the **starting point** of the budget calculation chain. It allows users to:

1. Input **AY1 (Academic Year 1: Jan–Jun)** student headcounts by grade level
2. Configure **cohort progression parameters** (retention rates, lateral entries)
3. View projected **AY2 (Academic Year 2: Sep–Dec)** enrollments
4. Manage **nationality distribution** (French, Nationals, Others) by grade
5. Calculate **classroom capacity** needs (sections, utilization, alerts)
6. Import **historical enrollment data** from CSV files

**Critical Business Rule**: Changes to enrollment data mark downstream modules (Revenue, DHG, Staffing, P&L) as "stale" — requiring recalculation to maintain data consistency.

---

## Business Context

### Academic Periods

EFIR (École Française Internationale de Riyad) operates on a split academic calendar:

| Period     | Months               | Description                       |
| ---------- | -------------------- | --------------------------------- |
| **AY1**    | January – June       | First half of academic year       |
| **Summer** | July – August        | Summer break (minimal operations) |
| **AY2**    | September – December | Second half of academic year      |

### Grade Bands

| Band            | Grade Levels           | Age Range                   |
| --------------- | ---------------------- | --------------------------- |
| **MATERNELLE**  | PS, MS, GS             | Preschool (3–5 years)       |
| **ELEMENTAIRE** | CP, CE1, CE2, CM1, CM2 | Primary (6–10 years)        |
| **COLLEGE**     | 6eme, 5eme, 4eme, 3eme | Middle School (11–14 years) |
| **LYCEE**       | 2nde, 1ere, Terminale  | High School (15–17 years)   |

### Nationality Categories

| Category      | Description           |
| ------------- | --------------------- |
| **Francais**  | French nationals      |
| **Nationaux** | Saudi nationals (KSA) |
| **Autres**    | Other nationalities   |

---

## User Roles & Permissions

| Role            | View Data | Edit Headcounts | Run Calculations | Import CSV |
| --------------- | --------- | --------------- | ---------------- | ---------- |
| **Admin**       | ✅        | ✅              | ✅               | ✅         |
| **BudgetOwner** | ✅        | ✅              | ✅               | ✅         |
| **Editor**      | ✅        | ✅              | ✅               | ❌         |
| **Viewer**      | ✅        | ❌              | ❌               | ❌         |

**Version Lock Rule**: All edit operations are blocked if the Budget Version status is not "Draft". Published, Locked, or Archived versions cannot be modified.

---

## Pre-Conditions

Before using this page, the following must be configured:

### Required Master Data (via Admin → Master Data)

1. **Grade Levels** (`grade_levels` table)
    - Grade codes: PS, MS, GS, CP, CE1, CE2, CM1, CM2, 6eme, 5eme, 4eme, 3eme, 2nde, 1ere, Terminale
    - Band assignments (MATERNELLE, ELEMENTAIRE, COLLEGE, LYCEE)
    - Max class size, plafond %, plancher %, cible %

2. **Nationalities** (`nationalities` table)
    - Code: FR, NAT, AUT (mapped to Francais, Nationaux, Autres)
    - VAT exemption flags

### Required Budget Setup

1. **Budget Version** must be created and selected in the workspace context bar
2. The version must be in **"Draft"** status for edits
3. **Fiscal Year** and **Academic Period** context must be set

---

## Page Layout & UI Elements

### Header Section

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Enrollment & Capacity                                     [All][Mat][Elem] │
│  Configure cohort progression...                           [Calculate]      │
│                                                            [Import CSV]     │
├─────────────────────────────────────────────────────────────────────────────┤
│  📊 KPI Ribbon                                                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │ AY1 Total    │ │ AY2 Total    │ │ Utilization  │ │ Alerts       │       │
│  │ 245 students │ │ 238 students │ │ 87.3%        │ │ 2 grades     │       │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Filter Controls

| Button          | Values                   | Function                    |
| --------------- | ------------------------ | --------------------------- |
| **Band Filter** | All, Mat, Elem, Col, Lyc | Filters grids by grade band |

### Action Buttons

| Button                | Icon       | Role Required              | Action                              |
| --------------------- | ---------- | -------------------------- | ----------------------------------- |
| **Calculate**         | Calculator | Admin, BudgetOwner, Editor | Runs enrollment calculation engine  |
| **Import CSV**        | Upload     | Admin, BudgetOwner         | Opens historical data import panel  |
| **Show/Hide History** | Chart      | All                        | Toggles historical enrollment chart |

### Workspace Blocks (Main Content)

#### 1. Cohort Progression (AY1 → AY2)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Cohort Progression (AY1 → AY2)                                [stale badge]  │
├──────────┬──────────┬─────────────┬───────────┬─────────────┬────────────────┤
│ Grade    │ Band     │ AY1 Hdc     │ Ret %     │ Lat.Ent     │ AY2 Tot        │
├──────────┼──────────┼─────────────┼───────────┼─────────────┼────────────────┤
│ PS       │ Maternel │ [    45   ] │     -     │      -      │ [    42   ]    │
│ MS       │ Maternel │ [    48   ] │ [  95%  ] │ [    2   ]  │ 47 (computed)  │
│ ...      │ ...      │ ...         │ ...       │ ...         │ ...            │
└──────────┴──────────┴─────────────┴───────────┴─────────────┴────────────────┘
```

**Editable Fields**:

- **AY1 Hdc**: AY1 headcount input (all grades)
- **Ret %**: Retention rate percentage (non-PS grades only)
- **Lat.Ent**: Lateral entry count (non-PS grades only)
- **AY2 Tot**: Direct input for PS grade only (new entrants); computed for others

#### 2. Nationality Distribution

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ Nationality Distribution                                                    [stale badge]  │
├──────────┬──────────────┬──────────────┬──────────────┬──────────────┬───────┬────────────┤
│ Grade    │ Francais Wt% │ Francais Cnt │ Nationaux Wt%│ Nationaux Cnt│ ...   │ Override   │
├──────────┼──────────────┼──────────────┼──────────────┼──────────────┼───────┼────────────┤
│ PS       │ [  33.3%  ]  │ 14           │ [  33.3%  ]  │ 14           │ ...   │ -          │
│ MS       │ 32.1%        │ 15           │ 40.2%        │ 19           │ ...   │ [ Off→On ] │
└──────────┴──────────────┴──────────────┴──────────────┴──────────────┴───────┴────────────┘
```

**Editable Fields**:

- **Weight % columns**: Editable for PS grade always; for other grades only when Override is ON
- **Override toggle**: Enable/disable manual override of computed nationality distribution

#### 3. Capacity Planning

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ Capacity Planning                                                         [count: 15]  │
├──────────┬──────────┬───────────┬──────────┬───────────┬──────────────────────────────┤
│ Grade    │ AY2 Tot  │ Max Size  │ Sections │ Util %    │ Alert                        │
├──────────┼──────────┼───────────┼──────────┼───────────┼──────────────────────────────┤
│ PS       │ 42       │ 20        │ 3        │ 70.0%     │ 🟢 OK                        │
│ MS       │ 47       │ 25        │ 2        │ 94.0%     │ 🟡 NEAR_CAP                  │
│ GS       │ 51       │ 25        │ 3        │ 102.0%    │ 🔴 OVER                      │
└──────────┴──────────┴───────────┴──────────┴───────────┴──────────────────────────────┘
```

**Display Fields** (read-only, computed):

- **AY2 Tot**: Total students from cohort progression
- **Max Size**: Maximum class size from grade level config
- **Sections**: Number of class sections needed
- **Util %**: Classroom utilization percentage
- **Alert**: Capacity status (OK, NEAR_CAP, OVER)

---

## Step-by-Step Workflow

### Workflow 1: Initial Data Entry (AY1 Headcounts)

**Actor**: Budget Owner or Editor

| Step | Action                                 | UI Element      | API Call                                  | Result                                           |
| ---- | -------------------------------------- | --------------- | ----------------------------------------- | ------------------------------------------------ |
| 1    | Select Budget Version from context bar | Dropdown        | `GET /versions`                           | Version loaded                                   |
| 2    | Navigate to Enrollment page            | Sidebar menu    | -                                         | Page loads                                       |
| 3    | Click AY1 Hdc cell for a grade         | EditableCell    | -                                         | Cell enters edit mode                            |
| 4    | Enter student count (e.g., 45)         | Number input    | -                                         | Value displayed                                  |
| 5    | Press Tab or click outside             | Blur event      | `PUT /versions/{id}/enrollment/headcount` | Data saved, stale modules updated                |
| 6    | Observe stale indicator                | Badge on blocks | -                                         | "Stale" appears on Revenue, DHG, Staffing blocks |

**Database Changes**:

- Insert/Update `enrollment_headcount` table
- Update `budget_versions.stale_modules` array to include REVENUE, DHG, STAFFING, PNL
- Insert `audit_entries` record with operation HEADCOUNT_UPDATED

---

### Workflow 2: Configure Cohort Parameters

**Actor**: Budget Owner or Editor

| Step | Action                                  | UI Element       | API Call                               | Business Logic                            |
| ---- | --------------------------------------- | ---------------- | -------------------------------------- | ----------------------------------------- |
| 1    | Click Ret % cell for a grade (e.g., MS) | EditableCell     | -                                      | Cell enters edit mode                     |
| 2    | Enter retention percentage (e.g., 95)   | Percentage input | -                                      | Value displayed as 95%                    |
| 3    | Confirm entry                           | Blur/Enter       | `PUT /versions/{id}/cohort-parameters` | Saved to database                         |
| 4    | Observe AY2 Tot column                  | Computed cell    | -                                      | Value recalculated: `AY1 × Ret% + LatEnt` |

**Formula**:

```
AY2 Headcount (non-PS) = round(AY1 Headcount × Retention Rate) + Lateral Entry Count
AY2 Headcount (PS) = Direct user input (new preschool entrants)
```

---

### Workflow 3: Run Enrollment Calculation

**Actor**: Budget Owner or Editor

| Step | Action                          | UI Element   | API Call                                   | Result                                  |
| ---- | ------------------------------- | ------------ | ------------------------------------------ | --------------------------------------- |
| 1    | Click "Calculate" button        | Button       | `POST /versions/{id}/calculate/enrollment` | Calculation initiated                   |
| 2    | Observe button state            | Spinner icon | -                                          | Shows "Calculating..."                  |
| 3    | Wait for completion             | Success icon | -                                          | Shows "Calculated"                      |
| 4    | Review Capacity Planning grid   | Data grid    | -                                          | Sections, utilization, alerts displayed |
| 5    | Review Nationality Distribution | Data grid    | -                                          | AY2 nationality breakdown computed      |

**Calculation Steps** (Backend):

1. Fetch cohort parameters for the version
2. Fetch all AY1 headcounts
3. Calculate PS AY2 headcount (direct input or AY1 fallback)
4. Run cohort progression engine to compute AY2 headcounts
5. Calculate nationality distribution for AY2
6. Run capacity calculation engine
7. Persist all results to database
8. Remove ENROLLMENT from stale modules
9. Create calculation audit log

---

### Workflow 4: Override Nationality Distribution

**Actor**: Budget Owner or Editor

| Step | Action                                             | UI Element       | API Call                                   | Result                         |
| ---- | -------------------------------------------------- | ---------------- | ------------------------------------------ | ------------------------------ |
| 1    | Locate grade row in Nationality Distribution       | Grid row         | -                                          | Row identified                 |
| 2    | Click "Override" toggle button                     | Toggle button    | -                                          | Toggle switches to "On"        |
| 3    | Click nationality weight cell (e.g., Francais Wt%) | EditableCell     | -                                          | Cell becomes editable          |
| 4    | Enter new percentage                               | Percentage input | -                                          | Value updated                  |
| 5    | Confirm entry                                      | Blur/Enter       | `PUT /versions/{id}/nationality-breakdown` | Saved with `isOverridden=true` |

**Important**: Overridden grades preserve their manual nationality distribution even after subsequent calculations. Non-overridden grades are recomputed each time Calculate is run.

---

### Workflow 5: Import Historical Data

**Actor**: Budget Owner

| Step | Action                                | UI Element    | API Call                                             | Result                                  |
| ---- | ------------------------------------- | ------------- | ---------------------------------------------------- | --------------------------------------- |
| 1    | Click "Import CSV" button             | Button        | -                                                    | Import panel opens (right sidebar)      |
| 2    | Select academic year                  | Dropdown      | -                                                    | Year selected (e.g., 2023/2024)         |
| 3    | Click "Choose File"                   | File input    | -                                                    | File browser opens                      |
| 4    | Select CSV file                       | File dialog   | -                                                    | File name displayed                     |
| 5    | Click "Validate"                      | Button        | `POST /enrollment/historical/import` (mode=validate) | Validation runs                         |
| 6    | Review validation results             | Results panel | -                                                    | Valid rows count, preview table, errors |
| 7    | Click "Import" (if validation passes) | Button        | `POST /enrollment/historical/import` (mode=commit)   | Data imported                           |
| 8    | Close panel                           | Close button  | -                                                    | Panel closes, historical chart updated  |

**CSV Format Requirements**:

```csv
grade_level,student_count
PS,42
MS,48
GS,51
...
```

---

## Data Models & Database Schema

### Core Tables

#### 1. enrollment_headcount

Stores student headcounts by grade and academic period.

```sql
Table: enrollment_headcount
┌───────────────────┬─────────────────┬────────────────────────────────────────────┐
│ Column            │ Type            │ Description                                │
├───────────────────┼─────────────────┼────────────────────────────────────────────┤
│ id                │ SERIAL PK       │ Unique identifier                          │
│ version_id        │ INTEGER FK      │ → budget_versions.id                       │
│ academic_period   │ VARCHAR(3)      │ 'AY1' or 'AY2'                             │
│ grade_level       │ VARCHAR(10)     │ Grade code (PS, MS, GS, etc.)              │
│ headcount         │ INTEGER         │ Number of students (≥ 0)                   │
│ created_by        │ INTEGER FK      │ → users.id                                 │
│ updated_by        │ INTEGER FK      │ → users.id (nullable)                      │
│ created_at        │ TIMESTAMPTZ     │ Record creation timestamp                  │
│ updated_at        │ TIMESTAMPTZ     │ Last update timestamp                      │
└───────────────────┴─────────────────┴────────────────────────────────────────────┘

Unique Constraint: (version_id, academic_period, grade_level)
```

#### 2. cohort_parameters

Stores retention rates and lateral entry configuration.

```sql
Table: cohort_parameters
┌─────────────────────┬─────────────────┬────────────────────────────────────────────┐
│ Column              │ Type            │ Description                                │
├─────────────────────┼─────────────────┼────────────────────────────────────────────┤
│ id                  │ SERIAL PK       │ Unique identifier                          │
│ version_id          │ INTEGER FK      │ → budget_versions.id                       │
│ grade_level         │ VARCHAR(10)     │ Grade code                                 │
│ retention_rate      │ DECIMAL(5,4)    │ Retention percentage (0.00–1.00)           │
│ lateral_entry_count │ INTEGER         │ Number of lateral entry students           │
│ lateral_weight_fr   │ DECIMAL(5,4)    │ French lateral entry weight                │
│ lateral_weight_nat  │ DECIMAL(5,4)    │ Nationals lateral entry weight             │
│ lateral_weight_aut  │ DECIMAL(5,4)    │ Others lateral entry weight                │
│ created_at          │ TIMESTAMPTZ     │ Record creation timestamp                  │
│ updated_at          │ TIMESTAMPTZ     │ Last update timestamp                      │
└─────────────────────┴─────────────────┴────────────────────────────────────────────┘

Unique Constraint: (version_id, grade_level)
```

#### 3. nationality_breakdown

Stores nationality distribution by grade.

```sql
Table: nationality_breakdown
┌───────────────────┬─────────────────┬────────────────────────────────────────────┐
│ Column            │ Type            │ Description                                │
├───────────────────┼─────────────────┼────────────────────────────────────────────┤
│ id                │ SERIAL PK       │ Unique identifier                          │
│ version_id        │ INTEGER FK      │ → budget_versions.id                       │
│ academic_period   │ VARCHAR(3)      │ 'AY1' or 'AY2'                             │
│ grade_level       │ VARCHAR(10)     │ Grade code                                 │
│ nationality       │ VARCHAR(10)     │ 'Francais', 'Nationaux', or 'Autres'       │
│ weight            │ DECIMAL(5,4)    │ Percentage weight (0.00–1.00)              │
│ headcount         │ INTEGER         │ Calculated student count                   │
│ is_overridden     │ BOOLEAN         │ True if manually overridden                │
│ created_at        │ TIMESTAMPTZ     │ Record creation timestamp                  │
│ updated_at        │ TIMESTAMPTZ     │ Last update timestamp                      │
└───────────────────┴─────────────────┴────────────────────────────────────────────┘

Unique Constraint: (version_id, academic_period, grade_level, nationality)
```

#### 4. dhg_requirements

Stores calculated capacity and DHG (Dotation Horaire Globale) requirements.

```sql
Table: dhg_requirements
┌────────────────────┬─────────────────┬────────────────────────────────────────────┐
│ Column             │ Type            │ Description                                │
├────────────────────┼─────────────────┼────────────────────────────────────────────┤
│ id                 │ SERIAL PK       │ Unique identifier                          │
│ version_id         │ INTEGER FK      │ → budget_versions.id                       │
│ academic_period    │ VARCHAR(3)      │ 'AY1' or 'AY2'                             │
│ grade_level        │ VARCHAR(10)     │ Grade code                                 │
│ headcount          │ INTEGER         │ Student count                              │
│ max_class_size     │ INTEGER         │ Maximum students per class                 │
│ sections_needed    │ INTEGER         │ Number of class sections required          │
│ utilization        │ DECIMAL(5,1)    │ Classroom utilization %                    │
│ alert              │ VARCHAR(10)     │ 'OVER', 'NEAR_CAP', 'OK', or null          │
│ recruitment_slots  │ INTEGER         │ Recommended recruitment positions          │
│ total_weekly_hours │ DECIMAL(10,4)   │ Total DHG hours per week                   │
│ total_annual_hours │ DECIMAL(10,4)   │ Total DHG hours per year                   │
│ fte                │ DECIMAL(7,4)    │ Full-time equivalent teachers              │
│ created_at         │ TIMESTAMPTZ     │ Record creation timestamp                  │
│ updated_at         │ TIMESTAMPTZ     │ Last update timestamp                      │
└────────────────────┴─────────────────┴────────────────────────────────────────────┘

Unique Constraint: (version_id, academic_period, grade_level)
```

#### 5. calculation_audit_log

Tracks all calculation runs for audit purposes.

```sql
Table: calculation_audit_log
┌───────────────────┬─────────────────┬────────────────────────────────────────────┐
│ Column            │ Type            │ Description                                │
├───────────────────┼─────────────────┼────────────────────────────────────────────┤
│ id                │ SERIAL PK       │ Unique identifier                          │
│ version_id        │ INTEGER FK      │ → budget_versions.id                       │
│ run_id            │ UUID            │ Unique calculation run ID                  │
│ module            │ VARCHAR(20)     │ 'ENROLLMENT', 'REVENUE', etc.              │
│ status            │ VARCHAR(20)     │ 'STARTED', 'COMPLETED', 'FAILED'           │
│ started_at        │ TIMESTAMPTZ     │ Calculation start time                     │
│ completed_at      │ TIMESTAMPTZ     │ Calculation end time                       │
│ duration_ms       │ INTEGER         │ Execution time in milliseconds             │
│ input_summary     │ JSONB           │ Input data summary                         │
│ output_summary    │ JSONB           │ Results summary                            │
│ triggered_by      │ INTEGER FK      │ → users.id                                 │
└───────────────────┴─────────────────┴────────────────────────────────────────────┘
```

#### 6. grade_levels (Master Data)

Reference table for grade configuration.

```sql
Table: grade_levels
┌───────────────────┬─────────────────┬────────────────────────────────────────────┐
│ Column            │ Type            │ Description                                │
├───────────────────┼─────────────────┼────────────────────────────────────────────┤
│ id                │ SERIAL PK       │ Unique identifier                          │
│ grade_code        │ VARCHAR(10)     │ Unique code (PS, MS, etc.)                 │
│ grade_name        │ VARCHAR(60)     │ Display name ("Petite Section")            │
│ band              │ GradeBand ENUM  │ MATERNELLE, ELEMENTAIRE, COLLEGE, LYCEE    │
│ max_class_size    │ INTEGER         │ Maximum students per class                 │
│ plancher_pct      │ DECIMAL(5,4)    │ Minimum capacity threshold                 │
│ cible_pct         │ DECIMAL(5,4)    │ Target capacity percentage                 │
│ plafond_pct       │ DECIMAL(5,4)    │ Maximum capacity threshold                 │
│ display_order     │ INTEGER         │ Sort order for UI display                  │
└───────────────────┴─────────────────┴────────────────────────────────────────────┘
```

---

## API Endpoints

### Enrollment Headcount APIs

| Method | Endpoint                                                         | Description       | Auth | Role                       |
| ------ | ---------------------------------------------------------------- | ----------------- | ---- | -------------------------- |
| GET    | `/versions/{versionId}/enrollment/headcount`                     | List headcounts   | JWT  | Any                        |
| GET    | `/versions/{versionId}/enrollment/headcount?academic_period=AY1` | Filter by period  | JWT  | Any                        |
| PUT    | `/versions/{versionId}/enrollment/headcount`                     | Update headcounts | JWT  | Admin, BudgetOwner, Editor |

**PUT Request Body**:

```json
{
    "entries": [
        {
            "gradeLevel": "PS",
            "academicPeriod": "AY1",
            "headcount": 45
        },
        {
            "gradeLevel": "MS",
            "academicPeriod": "AY1",
            "headcount": 48
        }
    ]
}
```

**PUT Response**:

```json
{
    "updated": 2,
    "staleModules": ["REVENUE", "DHG", "STAFFING", "PNL"]
}
```

---

### Cohort Parameter APIs

| Method | Endpoint                                  | Description       | Auth | Role                       |
| ------ | ----------------------------------------- | ----------------- | ---- | -------------------------- |
| GET    | `/versions/{versionId}/cohort-parameters` | List parameters   | JWT  | Any                        |
| PUT    | `/versions/{versionId}/cohort-parameters` | Update parameters | JWT  | Admin, BudgetOwner, Editor |

**PUT Request Body**:

```json
{
    "entries": [
        {
            "gradeLevel": "MS",
            "retentionRate": 0.95,
            "lateralEntryCount": 2,
            "lateralWeightFr": 0.33,
            "lateralWeightNat": 0.34,
            "lateralWeightAut": 0.33
        }
    ]
}
```

---

### Nationality Breakdown APIs

| Method | Endpoint                                      | Description       | Auth | Role                       |
| ------ | --------------------------------------------- | ----------------- | ---- | -------------------------- |
| GET    | `/versions/{versionId}/nationality-breakdown` | List breakdowns   | JWT  | Any                        |
| PUT    | `/versions/{versionId}/nationality-breakdown` | Update breakdowns | JWT  | Admin, BudgetOwner, Editor |

---

### Calculation APIs

| Method | Endpoint                                     | Description         | Auth | Role                       |
| ------ | -------------------------------------------- | ------------------- | ---- | -------------------------- |
| POST   | `/versions/{versionId}/calculate/enrollment` | Run enrollment calc | JWT  | Admin, BudgetOwner, Editor |

**Response**:

```json
{
    "runId": "550e8400-e29b-41d4-a716-446655440000",
    "durationMs": 245,
    "summary": {
        "totalStudentsAy1": 245,
        "totalStudentsAy2": 238,
        "overCapacityGrades": ["GS", "CM2"]
    },
    "results": [
        {
            "gradeLevel": "PS",
            "academicPeriod": "AY2",
            "headcount": 42,
            "maxClassSize": 20,
            "sectionsNeeded": 3,
            "utilization": 70.0,
            "alert": "OK",
            "recruitmentSlots": 3
        }
    ]
}
```

---

### Historical Data APIs

| Method | Endpoint                         | Description         | Auth | Role               |
| ------ | -------------------------------- | ------------------- | ---- | ------------------ |
| GET    | `/enrollment/historical`         | Get historical data | JWT  | Any                |
| GET    | `/enrollment/historical?years=5` | Get last 5 years    | JWT  | Any                |
| POST   | `/enrollment/historical/import`  | Import CSV data     | JWT  | Admin, BudgetOwner |

**Import Request** (multipart/form-data):

```
file: <CSV file>
mode: "validate" | "commit"
academicYear: "2023"
```

**Validation Response**:

```json
{
    "totalRows": 15,
    "validRows": 14,
    "errors": [
        {
            "row": 5,
            "field": "grade_level",
            "message": "Invalid grade code 'INVALID'"
        }
    ],
    "preview": [
        {
            "gradeLevel": "PS",
            "headcount": 42
        }
    ]
}
```

---

## TypeScript Types

### Core Types (`packages/types/src/enrollment.ts`)

```typescript
// Academic periods
export type AcademicPeriod = 'AY1' | 'AY2';

// Nationality categories
export type NationalityType = 'Francais' | 'Nationaux' | 'Autres';

// Tariff types
export type TariffType = 'RP' | 'R3+' | 'Plein';

// Capacity alerts
export type CapacityAlert = 'OVER' | 'NEAR_CAP' | 'OK' | 'UNDER';

// Grade codes (15 total)
export type GradeCode =
    | 'PS'
    | 'MS'
    | 'GS' // Maternelle
    | 'CP'
    | 'CE1'
    | 'CE2'
    | 'CM1'
    | 'CM2' // Elementaire
    | '6eme'
    | '5eme'
    | '4eme'
    | '3eme' // College
    | '2nde'
    | '1ere'
    | 'Terminale'; // Lycee

// Modules that can be stale
export type StaleModule = 'ENROLLMENT' | 'REVENUE' | 'DHG' | 'STAFFING' | 'PNL';

// Headcount entry
export interface HeadcountEntry {
    gradeLevel: GradeCode;
    academicPeriod: AcademicPeriod;
    headcount: number;
}

// Detail entry (nationality × tariff)
export interface DetailEntry {
    gradeLevel: GradeCode;
    academicPeriod: AcademicPeriod;
    nationality: NationalityType;
    tariff: TariffType;
    headcount: number;
}

// Capacity calculation result
export interface CapacityResult {
    gradeLevel: GradeCode;
    academicPeriod: AcademicPeriod;
    headcount: number;
    maxClassSize: number;
    sectionsNeeded: number;
    utilization: number;
    alert: CapacityAlert | null;
    recruitmentSlots: number;
}
```

### Cohort Types (`packages/types/src/cohort.ts`)

```typescript
export interface CohortParameterEntry {
    gradeLevel: GradeCode;
    retentionRate: number; // 0.00–1.00
    lateralEntryCount: number;
    lateralWeightFr: number;
    lateralWeightNat: number;
    lateralWeightAut: number;
}

export interface NationalityBreakdownEntry {
    gradeLevel: GradeCode;
    academicPeriod: AcademicPeriod;
    nationality: NationalityType;
    weight: number; // 0.00–1.00
    headcount: number;
    isOverridden: boolean;
}

export interface CohortProgressionRow {
    gradeLevel: GradeCode;
    band: string;
    ay1Headcount: number;
    retainedFromPrior: number;
    lateralEntry: number;
    ay2Headcount: number;
}

export interface EnrollmentKpiData {
    totalAy1: number;
    totalAy2: number;
    utilizationPct: number;
    alertCount: number;
    isStale: boolean;
}
```

---

## Calculation Engine

### Capacity Calculation Logic

```typescript
// 1. Calculate sections needed
sectionsNeeded = ceil(headcount / maxClassSize);

// 2. Calculate utilization
utilization = (headcount / (sectionsNeeded × maxClassSize)) × 100;

// 3. Determine alert status
if (utilization > 100):
  alert = 'OVER'
elif (utilization > 90):  // Near capacity threshold
  alert = 'NEAR_CAP'
elif (utilization < 50):  // Under-utilization threshold
  alert = 'UNDER'
else:
  alert = 'OK'

// 4. Calculate recruitment slots
recruitmentSlots = sectionsNeeded × baseTeachersPerSection;
```

### Cohort Progression Logic

```typescript
// For PS (Petite Section) - direct input
ay2Headcount[PS] = userInput || ay1Headcount[PS] || 0;

// For other grades
for each grade in GRADE_PROGRESSION[1..]:
  priorGrade = GRADE_PROGRESSION[index - 1];
  retained = floor(ay1Headcount[priorGrade] × retentionRate[grade]);
  ay2Headcount[grade] = retained + lateralEntryCount[grade];
```

### Nationality Distribution Logic

```typescript
// For PS grade (direct weight input)
francaisCount = round(ay2Headcount × francaisWeight);
nationauxCount = round(ay2Headcount × nationauxWeight);
autresCount = ay2Headcount - francaisCount - nationauxCount;

// For other grades (computed from prior grade AY1 distribution)
if (!isOverridden):
  priorGrade = GRADE_PROGRESSION[index - 1];
  priorDistribution = getNationalityBreakdown(priorGrade, 'AY1');
  lateralDistribution = {
    Francais: lateralWeightFr,
    Nationaux: lateralWeightNat,
    Autres: lateralWeightAut
  };

  // Blend retained and lateral entries
  for each nationality:
    retained = priorDistribution[nationality] × retentionRate;
    lateral = lateralEntryCount × lateralDistribution[nationality];
    ay2Distribution[nationality] = retained + lateral;
```

---

## Audit Trail

### Operations Logged

| Operation             | Table                 | Data Captured                        |
| --------------------- | --------------------- | ------------------------------------ |
| HEADCOUNT_UPDATED     | enrollment_headcount  | All entries (grade, period, count)   |
| COHORT_PARAMS_UPDATED | cohort_parameters     | Grade, retention rate, lateral entry |
| NATIONALITY_UPDATED   | nationality_breakdown | Grade, nationality, weight, count    |
| CALCULATION_STARTED   | calculation_audit_log | Run ID, inputs                       |
| CALCULATION_COMPLETED | calculation_audit_log | Duration, outputs                    |

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

| Code                | HTTP Status | Description                           | User Action                  |
| ------------------- | ----------- | ------------------------------------- | ---------------------------- |
| VERSION_NOT_FOUND   | 404         | Budget version does not exist         | Select valid version         |
| VERSION_LOCKED      | 409         | Version is Published/Locked/Archived  | Create new version or unlock |
| IMPORTED_VERSION    | 409         | Cannot calculate on imported versions | Use calculated versions only |
| NEGATIVE_HEADCOUNT  | 422         | Headcount value is negative           | Enter non-negative number    |
| INVALID_GRADE_LEVEL | 422         | Grade code not recognized             | Check grade level spelling   |
| UNAUTHORIZED        | 401         | User not authenticated                | Log in                       |
| FORBIDDEN           | 403         | User lacks required role              | Contact administrator        |

---

## Improvements Required

This section documents known issues, technical debt, and proposed enhancements for the Enrollment & Capacity module.

### High Priority

| ID      | Issue                               | Impact                                        | Proposed Solution                                  |
| ------- | ----------------------------------- | --------------------------------------------- | -------------------------------------------------- |
| ENR-001 | **Bulk edit not supported**         | Users must edit cells one-by-one              | Add copy-paste from Excel; multi-cell selection    |
| ENR-002 | **No undo functionality**           | Accidental changes require manual revert      | Implement operation history with undo stack        |
| ENR-003 | **Limited CSV import validation**   | No data type checking for headcounts          | Add schema validation with detailed error messages |
| ENR-004 | **No capacity scenario comparison** | Cannot compare different enrollment scenarios | Add scenario modeling feature                      |

### Medium Priority

| ID      | Issue                          | Impact                                  | Proposed Solution                              |
| ------- | ------------------------------ | --------------------------------------- | ---------------------------------------------- |
| ENR-005 | **No real-time collaboration** | Multiple users can overwrite each other | Implement optimistic locking or real-time sync |
| ENR-006 | **Historical chart limited**   | Only shows totals, no grade breakdown   | Add drill-down capability to chart             |
| ENR-007 | **No export functionality**    | Cannot export enrollment data to Excel  | Add "Export to Excel" button                   |
| ENR-008 | **Missing capacity alerts**    | No email/notification for OVER capacity | Add notification system integration            |

### Low Priority / Technical Debt

| ID      | Issue                               | Impact                             | Proposed Solution                              |
| ------- | ----------------------------------- | ---------------------------------- | ---------------------------------------------- |
| ENR-009 | **Sequential database operations**  | N+1 query pattern in calculation   | Consider batch operations or stored procedures |
| ENR-010 | **Hardcoded grade progression**     | GRADE_PROGRESSION array in code    | Move to configuration table                    |
| ENR-011 | **No unit tests for edge cases**    | Zero headcounts, rounding errors   | Add comprehensive test coverage                |
| ENR-012 | **Client-side calculation preview** | Users must run calc to see results | Add preview calculation before commit          |

### Feature Requests

| ID      | Feature                          | Business Value                            | Complexity |
| ------- | -------------------------------- | ----------------------------------------- | ---------- |
| ENR-F01 | **Waitlist management**          | Track students on waitlist by grade       | Medium     |
| ENR-F02 | **Sibling preference modeling**  | Factor sibling enrollment in projections  | High       |
| ENR-F03 | **Marketing funnel integration** | Connect lead data to enrollment forecasts | High       |
| ENR-F04 | **Multi-year projection**        | Project 3–5 years ahead                   | Medium     |
| ENR-F05 | **Grade transition simulator**   | What-if analysis for grade changes        | Medium     |

---

## Appendix A: Grade Progression Mapping

```
Flow of students through grades:

Maternelle:          PS ──► MS ──► GS
                       ↗️
Elementaire:              CP ──► CE1 ──► CE2 ──► CM1 ──► CM2
                              ↗️
College:                          6eme ──► 5eme ──► 4eme ──► 3eme
                                      ↗️
Lycee:                                  2nde ──► 1ere ──► Terminale
```

- Solid arrows: Natural progression (retained students)
- Curved arrows: Lateral entries (new students joining)

---

## Appendix B: Stale Module Cascade

When enrollment data changes, the following modules become stale:

```
┌─────────────────────────────────────────────────────────────┐
│  ENROLLMENT (user changes data)                              │
│        │                                                     │
│        ▼                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │   REVENUE   │  │     DHG     │  │  STAFFING   │          │
│  │   (fees)    │  │  (hours)    │  │ (positions) │          │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘          │
│         │                │                │                  │
│         └────────────────┴────────────────┘                  │
│                          │                                   │
│                          ▼                                   │
│                    ┌─────────────┐                           │
│                    │     PNL     │                           │
│                    │  (profit)   │                           │
│                    └─────────────┘                           │
└─────────────────────────────────────────────────────────────┘
```

Users must run calculations in each module (in order) to clear stale flags.

---

## Document History

| Version | Date       | Author       | Changes                   |
| ------- | ---------- | ------------ | ------------------------- |
| 1.0     | 2026-03-10 | AI Assistant | Initial document creation |

---

_End of Document_
