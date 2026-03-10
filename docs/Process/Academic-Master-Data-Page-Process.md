# Academic Master Data Page — Process Workflow

> **Document Purpose**: This document provides a comprehensive, plain-language guide to the Academic Master Data page. It explains the business process, technical implementation, user actions, and data flow. It serves as a reference for auditors, new developers, and business analysts to understand and propose improvements.

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
10. [Validation Rules](#validation-rules)
11. [Audit Trail](#audit-trail)
12. [Error Handling](#error-handling)
13. [Improvements Required](#improvements-required)

---

## Overview

| Attribute            | Value                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------- |
| **Page Name**        | Academic Master Data                                                                      |
| **URL Route**        | `/master-data/academic`                                                                   |
| **Module**           | Epic 1 — Master Data Management                                                           |
| **Page File**        | `apps/web/src/pages/master-data/academic.tsx`                                             |
| **Primary Function** | Manage academic years and grade levels — foundational configuration for the entire system |

### What This Page Does

The Academic Master Data page is the **foundation** of the entire BudFin system. It allows administrators to:

1. Configure **Academic Years** — Fiscal year calendar with AY1, Summer, and AY2 date ranges
2. Define **Grade Levels** — All 15 grade codes with capacity thresholds and display ordering
3. Set **Capacity Thresholds** — Plancher (minimum), Cible (target), and Plafond (maximum) percentages
4. Manage **Display Order** — Control how grades appear throughout the application

**Critical Business Rule**: Changes to grade level capacity settings (max class size, thresholds) affect downstream enrollment capacity calculations and alerts throughout the system.

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

### Grade Level Codes

| Code      | Name                | Band        |
| --------- | ------------------- | ----------- |
| PS        | Petite Section      | MATERNELLE  |
| MS        | Moyenne Section     | MATERNELLE  |
| GS        | Grande Section      | MATERNELLE  |
| CP        | Cours Préparatoire  | ELEMENTAIRE |
| CE1       | Cours Élémentaire 1 | ELEMENTAIRE |
| CE2       | Cours Élémentaire 2 | ELEMENTAIRE |
| CM1       | Cours Moyen 1       | ELEMENTAIRE |
| CM2       | Cours Moyen 2       | ELEMENTAIRE |
| 6eme      | Sixième             | COLLEGE     |
| 5eme      | Cinquième           | COLLEGE     |
| 4eme      | Quatrième           | COLLEGE     |
| 3eme      | Troisième           | COLLEGE     |
| 2nde      | Seconde             | LYCEE       |
| 1ere      | Première            | LYCEE       |
| Terminale | Terminale           | LYCEE       |

### Capacity Thresholds

| Threshold      | Purpose                        | Usage                                                |
| -------------- | ------------------------------ | ---------------------------------------------------- |
| **Plancher %** | Minimum capacity alert trigger | Warns when enrollment falls below sustainable levels |
| **Cible %**    | Target utilization goal        | Ideal classroom occupancy rate                       |
| **Plafond %**  | Maximum capacity alert trigger | Warns when approaching over-capacity                 |

---

## User Roles & Permissions

| Role            | View Academic Years | Add/Edit Academic Years | View Grade Levels | Edit Grade Levels |
| --------------- | ------------------: | ----------------------: | ----------------: | ----------------: |
| **Admin**       |                  ✅ |                      ✅ |                ✅ |                ✅ |
| **BudgetOwner** |                  ✅ |                      ❌ |                ✅ |                ❌ |
| **Editor**      |                  ✅ |                      ❌ |                ✅ |                ❌ |
| **Viewer**      |                  ✅ |                      ❌ |                ✅ |                ❌ |

**Permission Key**: `admin:config` required for all write operations.

---

## Pre-Conditions

Before using this page, the following must be in place:

### Required System Setup

1. **User Authentication** — Must be logged in with valid JWT
2. **Admin Role** — Only Admin users can modify master data
3. **Grade Levels Seeded** — Grade levels are system-defined and seeded at deployment

### Data Dependencies

| Data           | Dependency Direction | Impact if Changed                               |
| -------------- | -------------------: | ----------------------------------------------- |
| Academic Years |              Used by | Budget versions, enrollment calculations        |
| Grade Levels   |              Used by | Enrollment capacity, DHG calculations, staffing |

---

## Page Layout & UI Elements

### Header Section

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Academic Years                                              [+ Add Year]   │
│  Manage fiscal year calendar configuration                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  Grade Levels                                                                 │
│  Configure grade codes, bands, and capacity thresholds                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Action Buttons

| Button         | Icon   | Role Required | Action                                       |
| -------------- | ------ | ------------- | -------------------------------------------- |
| **+ Add Year** | Plus   | Admin         | Opens side panel to create new academic year |
| **Edit (row)** | Pencil | Admin         | Opens side panel to edit existing record     |

### Workspace Blocks (Main Content)

#### 1. Academic Years Table

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ Academic Years                                                                      │
├─────────────┬─────────────┬─────────────┬─────────────┬─────────────┬───────────────┤
│ Fiscal Year │ AY1 Start   │ AY1 End     │ Summer Start│ Summer End  │ AY2 Start...  │
├─────────────┼─────────────┼─────────────┼─────────────┼─────────────┼───────────────┤
│ 2025-2026   │ 01/01/2025  │ 30/06/2025  │ 01/07/2025  │ 31/08/2025  │ 01/09/2025... │
│ 2024-2025   │ 01/01/2024  │ 30/06/2024  │ 01/07/2024  │ 31/08/2024  │ 01/09/2024... │
└─────────────┴─────────────┴─────────────┴─────────────┴─────────────┴───────────────┘
```

**Display Fields**:

- **Fiscal Year**: Academic year identifier (e.g., "2025-2026")
- **AY1 Start/End**: First academic period dates
- **Summer Start/End**: Summer break period dates
- **AY2 Start/End**: Second academic period dates
- **Weeks**: Total number of instructional weeks

#### 2. Grade Levels Table

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ Grade Levels                                                                            │
├──────┬────────────────┬─────────────┬──────────┬─────────┬─────────┬─────────┬───────────┤
│ Code │ Name           │ Band        │ Max Size │ Plancher│ Cible   │ Plafond │ Order     │
├──────┼────────────────┼─────────────┼──────────┼─────────┼─────────┼─────────┼───────────┤
│ PS   │ Petite Section │ MATERNELLE  │ 20       │ 0.6000  │ 0.8500  │ 1.0000  │ 1         │
│ MS   │ Moyenne Section│ MATERNELLE  │ 25       │ 0.6000  │ 0.8500  │ 1.0000  │ 2         │
│ ...  │ ...            │ ...         │ ...      │ ...     │ ...     │ ...     │ ...       │
└──────┴────────────────┴─────────────┴──────────┴─────────┴─────────┴─────────┴───────────┘
```

**Display Fields**:

- **Code**: Short grade identifier (PS, MS, etc.)
- **Name**: Full grade name
- **Band**: Color-coded band badge (MATERNELLE, ELEMENTAIRE, COLLEGE, LYCEE)
- **Max Class Size**: Maximum students per classroom
- **Plancher %**: Minimum capacity threshold (0.0–1.0)
- **Cible %**: Target capacity threshold (0.0–1.0)
- **Plafond %**: Maximum capacity threshold (0.0–1.0)
- **Order**: Display sort order

---

## Step-by-Step Workflow

### Workflow 1: Add New Academic Year

**Actor**: Admin

| Step | Action                           | UI Element         | API Call                           | Result                              |
| ---- | -------------------------------- | ------------------ | ---------------------------------- | ----------------------------------- |
| 1    | Navigate to Academic Master Data | Sidebar menu       | -                                  | Page loads with tables              |
| 2    | Click "+ Add Year" button        | Button             | -                                  | Side panel opens (Add mode)         |
| 3    | Enter Fiscal Year                | Text input         | -                                  | Value displayed (e.g., "2025-2026") |
| 4    | Select AY1 Start date            | Date picker        | -                                  | Date selected                       |
| 5    | Select AY1 End date              | Date picker        | -                                  | Date selected                       |
| 6    | Select Summer Start date         | Date picker        | -                                  | Date selected                       |
| 7    | Select Summer End date           | Date picker        | -                                  | Date selected                       |
| 8    | Select AY2 Start date            | Date picker        | -                                  | Date selected                       |
| 9    | Select AY2 End date              | Date picker        | -                                  | Date selected                       |
| 10   | Enter Academic Weeks             | Number input       | -                                  | Value displayed (default: 36)       |
| 11   | Click "Save" button              | Button             | `POST /master-data/academic-years` | Academic year created               |
| 12   | Observe confirmation             | Toast notification | -                                  | "Academic year created"             |
| 13   | Review updated table             | Data grid          | -                                  | New year appears in list            |

**Validation Rules**:

- AY1 Start < AY1 End
- AY1 End ≤ Summer Start
- Summer Start < Summer End
- Summer End ≤ AY2 Start
- AY2 Start < AY2 End

**Database Changes**:

- Insert record into `academic_years` table
- Insert `audit_entries` record with operation `ACADEMIC_YEAR_CREATED`

---

### Workflow 2: Edit Academic Year

**Actor**: Admin

| Step | Action                                   | UI Element         | API Call                               | Result                       |
| ---- | ---------------------------------------- | ------------------ | -------------------------------------- | ---------------------------- |
| 1    | Locate academic year row                 | Data grid          | -                                      | Row identified               |
| 2    | Click row or edit icon                   | Row/Icon           | -                                      | Side panel opens (Edit mode) |
| 3    | Modify desired field(s)                  | Form inputs        | -                                      | Values updated               |
| 4    | Click "Save" button                      | Button             | `PUT /master-data/academic-years/{id}` | Academic year updated        |
| 5    | Handle optimistic lock conflict (if any) | Error dialog       | Refresh data                           | Record refreshed             |
| 6    | Observe confirmation                     | Toast notification | -                                      | "Academic year updated"      |

**Optimistic Locking**:

- Each record has a `version` field
- Update includes the expected version
- If version mismatch → 409 Conflict error

**Database Changes**:

- Update record in `academic_years` table (version incremented)
- Insert `audit_entries` record with operation `ACADEMIC_YEAR_UPDATED`

---

### Workflow 3: Edit Grade Level Configuration

**Actor**: Admin

| Step | Action                 | UI Element         | API Call                             | Business Logic               |
| ---- | ---------------------- | ------------------ | ------------------------------------ | ---------------------------- |
| 1    | Locate grade level row | Data grid          | -                                    | Row identified               |
| 2    | Click row              | Row                | -                                    | Side panel opens (Edit mode) |
| 3    | Modify Max Class Size  | Number input       | -                                    | Value updated (1–50)         |
| 4    | Modify Plancher %      | Decimal input      | -                                    | Value updated (0.0–1.0)      |
| 5    | Modify Cible %         | Decimal input      | -                                    | Value updated (0.0–1.0)      |
| 6    | Modify Plafond %       | Decimal input      | -                                    | Value updated (0.0–1.0)      |
| 7    | Modify Display Order   | Number input       | -                                    | Value updated (≥ 1)          |
| 8    | Click "Save" button    | Button             | `PUT /master-data/grade-levels/{id}` | Grade level updated          |
| 9    | Observe confirmation   | Toast notification | -                                    | "Grade level updated"        |

**Validation Rules**:

```
Must satisfy: plancherPct ≤ ciblePct ≤ plafondPct
```

**Business Impact**:

- Changes to max class size affect capacity calculations
- Changes to threshold percentages affect enrollment alert generation
- Changes to display order affect grade ordering throughout UI

**Database Changes**:

- Update record in `grade_levels` table (version incremented)
- Insert `audit_entries` record with operation `GRADE_LEVEL_UPDATED`

---

## Data Models & Database Schema

### Core Tables

#### 1. academic_years

Stores fiscal year calendar configuration.

```sql
Table: academic_years
┌───────────────────┬─────────────────┬────────────────────────────────────────────┐
│ Column            │ Type            │ Description                                │
├───────────────────┼─────────────────┼────────────────────────────────────────────┤
│ id                │ SERIAL PK       │ Unique identifier                          │
│ fiscal_year       │ VARCHAR(6)      │ Fiscal year identifier (e.g., "2025")      │
│ ay1_start         │ DATE            │ AY1 period start date                      │
│ ay1_end           │ DATE            │ AY1 period end date                        │
│ summer_start      │ DATE            │ Summer period start date                   │
│ summer_end        │ DATE            │ Summer period end date                     │
│ ay2_start         │ DATE            │ AY2 period start date                      │
│ ay2_end           │ DATE            │ AY2 period end date                        │
│ academic_weeks    │ INTEGER         │ Total instructional weeks (default: 36)    │
│ version           │ INTEGER         │ Optimistic lock version                    │
│ created_at        │ TIMESTAMPTZ     │ Record creation timestamp                  │
│ updated_at        │ TIMESTAMPTZ     │ Last update timestamp                      │
│ created_by        │ INTEGER FK      │ → users.id                                 │
│ updated_by        │ INTEGER FK      │ → users.id                                 │
└───────────────────┴─────────────────┴────────────────────────────────────────────┘

Unique Constraint: fiscal_year
```

#### 2. grade_levels

Stores grade definitions with capacity thresholds.

```sql
Table: grade_levels
┌───────────────────┬─────────────────┬────────────────────────────────────────────┐
│ Column            │ Type            │ Description                                │
├───────────────────┼─────────────────┼────────────────────────────────────────────┤
│ id                │ SERIAL PK       │ Unique identifier                          │
│ grade_code        │ VARCHAR(10)     │ Unique code (PS, MS, etc.)                 │
│ grade_name        │ VARCHAR(60)     │ Display name ("Petite Section")            │
│ band              │ GradeBand ENUM  │ MATERNELLE, ELEMENTAIRE, COLLEGE, LYCEE    │
│ max_class_size    │ INTEGER         │ Maximum students per class (1–50)          │
│ plancher_pct      │ DECIMAL(5,4)    │ Minimum capacity threshold (0.0000–1.0000) │
│ cible_pct         │ DECIMAL(5,4)    │ Target capacity threshold (0.0000–1.0000)  │
│ plafond_pct       │ DECIMAL(5,4)    │ Maximum capacity threshold (0.0000–1.0000) │
│ display_order     │ INTEGER         │ Sort order for UI display (≥ 1)            │
│ version           │ INTEGER         │ Optimistic lock version                    │
│ created_at        │ TIMESTAMPTZ     │ Record creation timestamp                  │
│ updated_at        │ TIMESTAMPTZ     │ Last update timestamp                      │
└───────────────────┴─────────────────┴────────────────────────────────────────────┘

Unique Constraint: grade_code
```

#### 3. GradeBand ENUM

```sql
Enum: grade_band
┌───────────────────┬────────────────────────────────────────────┐
│ Value             │ Description                                │
├───────────────────┼────────────────────────────────────────────┤
│ MATERNELLE        │ Preschool band (PS, MS, GS)                │
│ ELEMENTAIRE       │ Primary school band (CP–CM2)               │
│ COLLEGE           │ Middle school band (6eme–3eme)             │
│ LYCEE             │ High school band (2nde–Terminale)          │
└───────────────────┴────────────────────────────────────────────┘
```

---

## API Endpoints

### Academic Years APIs

| Method | Endpoint                           | Description              | Auth | Permission        |
| ------ | ---------------------------------- | ------------------------ | ---- | ----------------- |
| GET    | `/master-data/academic-years`      | List all academic years  | JWT  | Any authenticated |
| GET    | `/master-data/academic-years/{id}` | Get single academic year | JWT  | Any authenticated |
| POST   | `/master-data/academic-years`      | Create academic year     | JWT  | `admin:config`    |
| PUT    | `/master-data/academic-years/{id}` | Update academic year     | JWT  | `admin:config`    |
| DELETE | `/master-data/academic-years/{id}` | Delete academic year     | JWT  | `admin:config`    |

**POST Request Body**:

```json
{
    "fiscalYear": "2025-2026",
    "ay1Start": "2025-01-01T00:00:00.000Z",
    "ay1End": "2025-06-30T00:00:00.000Z",
    "summerStart": "2025-07-01T00:00:00.000Z",
    "summerEnd": "2025-08-31T00:00:00.000Z",
    "ay2Start": "2025-09-01T00:00:00.000Z",
    "ay2End": "2025-12-31T00:00:00.000Z",
    "academicWeeks": 36
}
```

**POST Response** (201 Created):

```json
{
    "id": 1,
    "fiscalYear": "2025-2026",
    "ay1Start": "2025-01-01T00:00:00.000Z",
    "ay1End": "2025-06-30T00:00:00.000Z",
    "summerStart": "2025-07-01T00:00:00.000Z",
    "summerEnd": "2025-08-31T00:00:00.000Z",
    "ay2Start": "2025-09-01T00:00:00.000Z",
    "ay2End": "2025-12-31T00:00:00.000Z",
    "academicWeeks": 36,
    "version": 1,
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T10:30:00.000Z"
}
```

**PUT Request Body**:

```json
{
    "fiscalYear": "2025-2026",
    "ay1Start": "2025-01-01T00:00:00.000Z",
    "ay1End": "2025-06-30T00:00:00.000Z",
    "summerStart": "2025-07-01T00:00:00.000Z",
    "summerEnd": "2025-08-31T00:00:00.000Z",
    "ay2Start": "2025-09-01T00:00:00.000Z",
    "ay2End": "2025-12-31T00:00:00.000Z",
    "academicWeeks": 36,
    "version": 1
}
```

---

### Grade Levels APIs

| Method | Endpoint                         | Description                | Auth | Permission        |
| ------ | -------------------------------- | -------------------------- | ---- | ----------------- |
| GET    | `/master-data/grade-levels`      | List all grade levels      | JWT  | Any authenticated |
| PUT    | `/master-data/grade-levels/{id}` | Update grade level         | JWT  | `admin:config`    |
| POST   | `/master-data/grade-levels`      | **405 Method Not Allowed** | -    | -                 |
| DELETE | `/master-data/grade-levels/{id}` | **405 Method Not Allowed** | -    | -                 |

**PUT Request Body**:

```json
{
    "maxClassSize": 25,
    "plancherPct": 0.6,
    "ciblePct": 0.85,
    "plafondPct": 1.0,
    "displayOrder": 1,
    "version": 1
}
```

**PUT Response**:

```json
{
    "id": 1,
    "gradeCode": "PS",
    "gradeName": "Petite Section",
    "band": "MATERNELLE",
    "maxClassSize": 25,
    "plancherPct": "0.6000",
    "ciblePct": "0.8500",
    "plafondPct": "1.0000",
    "displayOrder": 1,
    "version": 2
}
```

---

## TypeScript Types

### Academic Year Types (`apps/web/src/hooks/use-academic-years.ts`)

```typescript
export interface AcademicYear {
    id: number;
    fiscalYear: string;
    ay1Start: string; // ISO date string
    ay1End: string;
    ay2Start: string;
    ay2End: string;
    summerStart: string;
    summerEnd: string;
    academicWeeks: number;
    version: number;
    createdAt: string;
    updatedAt: string;
}
```

### Grade Level Types (`apps/web/src/hooks/use-grade-levels.ts`)

```typescript
export type GradeBand = 'MATERNELLE' | 'ELEMENTAIRE' | 'COLLEGE' | 'LYCEE';

export interface GradeLevel {
    id: number;
    gradeCode: string;
    gradeName: string;
    band: GradeBand;
    maxClassSize: number;
    plancherPct: string; // Decimal as string (e.g., "0.6000")
    ciblePct: string; // Decimal as string (e.g., "0.8500")
    plafondPct: string; // Decimal as string (e.g., "1.0000")
    displayOrder: number;
    version: number;
}
```

### Form Validation Schemas

**Academic Year Schema**:

```typescript
const academicYearSchema = z
    .object({
        fiscalYear: z.string().min(1, 'Fiscal year is required'),
        ay1Start: z.string().min(1, 'AY1 start date is required'),
        ay1End: z.string().min(1, 'AY1 end date is required'),
        summerStart: z.string().min(1, 'Summer start date is required'),
        summerEnd: z.string().min(1, 'Summer end date is required'),
        ay2Start: z.string().min(1, 'AY2 start date is required'),
        ay2End: z.string().min(1, 'AY2 end date is required'),
        academicWeeks: z.coerce.number().int().min(1).max(52),
    })
    .refine((d) => d.ay1Start < d.ay1End, {
        message: 'AY1 start must be before AY1 end',
        path: ['ay1End'],
    })
    .refine((d) => d.ay1End <= d.summerStart, {
        message: 'AY1 end must be on or before summer start',
        path: ['summerStart'],
    })
    .refine((d) => d.summerStart < d.summerEnd, {
        message: 'Summer start must be before summer end',
        path: ['summerEnd'],
    })
    .refine((d) => d.summerEnd <= d.ay2Start, {
        message: 'Summer end must be on or before AY2 start',
        path: ['ay2Start'],
    })
    .refine((d) => d.ay2Start < d.ay2End, {
        message: 'AY2 start must be before AY2 end',
        path: ['ay2End'],
    });
```

**Grade Level Schema**:

```typescript
const gradeLevelSchema = z
    .object({
        maxClassSize: z.coerce.number().int().min(1).max(50),
        plancherPct: z.coerce.number().min(0).max(1),
        ciblePct: z.coerce.number().min(0).max(1),
        plafondPct: z.coerce.number().min(0).max(1),
        displayOrder: z.coerce.number().int().min(0),
    })
    .refine((d) => d.plancherPct <= d.ciblePct && d.ciblePct <= d.plafondPct, {
        message: 'Must satisfy: plancher <= cible <= plafond',
        path: ['plafondPct'],
    });
```

---

## Validation Rules

### Date Ordering Validation

Academic year dates must follow strict chronological ordering:

```
AY1 Start < AY1 End ≤ Summer Start < Summer End ≤ AY2 Start < AY2 End
```

| Validation                | Error Code         | Error Message                             |
| ------------------------- | ------------------ | ----------------------------------------- |
| AY1 Start ≥ AY1 End       | INVALID_DATE_ORDER | AY1 start must be before AY1 end          |
| AY1 End > Summer Start    | INVALID_DATE_ORDER | AY1 end must be on or before summer start |
| Summer Start ≥ Summer End | INVALID_DATE_ORDER | Summer start must be before summer end    |
| Summer End > AY2 Start    | INVALID_DATE_ORDER | Summer end must be on or before AY2 start |
| AY2 Start ≥ AY2 End       | INVALID_DATE_ORDER | AY2 start must be before AY2 end          |

### Capacity Threshold Validation

Grade level thresholds must satisfy a hierarchy:

```
Plancher % ≤ Cible % ≤ Plafond %
```

| Validation          | Error Code       | Error Message                              |
| ------------------- | ---------------- | ------------------------------------------ |
| Plancher > Cible    | VALIDATION_ERROR | Must satisfy: plancher <= cible <= plafond |
| Cible > Plafond     | VALIDATION_ERROR | Must satisfy: plancher <= cible <= plafond |
| Max Class Size < 1  | VALIDATION_ERROR | Max class size must be at least 1          |
| Max Class Size > 50 | VALIDATION_ERROR | Max class size cannot exceed 50            |

### Optimistic Locking

| Validation       | Error Code      | Error Message                            | User Action            |
| ---------------- | --------------- | ---------------------------------------- | ---------------------- |
| Version mismatch | OPTIMISTIC_LOCK | Record has been modified by another user | Refresh data and retry |

---

## Audit Trail

### Operations Logged

| Operation             | Table          | Data Captured              |
| --------------------- | -------------- | -------------------------- |
| ACADEMIC_YEAR_CREATED | academic_years | All fields of new record   |
| ACADEMIC_YEAR_UPDATED | academic_years | Old and new values         |
| ACADEMIC_YEAR_DELETED | academic_years | Old values before deletion |
| GRADE_LEVEL_UPDATED   | grade_levels   | Old and new values         |

### Audit Entry Schema

```typescript
{
  userId: number;           // User making the change
  userEmail: string;        // User email for display
  operation: string;        // Operation type (see above)
  tableName: string;        // Affected table
  recordId: number;         // Affected record ID
  ipAddress: string;        // Client IP address
  oldValues?: Json;         // Previous values (for updates/deletes)
  newValues: Json;          // New values (for creates/updates)
  createdAt: Date;          // Timestamp
}
```

---

## Error Handling

### Common Error Codes

| Code               | HTTP Status | Description                           | User Action                    |
| ------------------ | ----------- | ------------------------------------- | ------------------------------ |
| NOT_FOUND          | 404         | Academic year not found               | Verify ID or refresh list      |
| DUPLICATE_CODE     | 409         | Fiscal year already exists            | Use unique fiscal year         |
| INVALID_DATE_ORDER | 422         | Dates do not follow required sequence | Correct date ordering          |
| OPTIMISTIC_LOCK    | 409         | Record modified by another user       | Refresh and retry              |
| REFERENCED_RECORD  | 409         | Cannot delete: record is in use       | Remove dependent records first |
| UNAUTHORIZED       | 401         | User not authenticated                | Log in                         |
| FORBIDDEN          | 403         | User lacks admin:config permission    | Contact administrator          |
| VALIDATION_ERROR   | 422         | Schema validation failed              | Check input values             |

### Error Response Format

```json
{
    "code": "ERROR_CODE",
    "message": "Human-readable error description"
}
```

---

## Improvements Required

This section documents known issues, technical debt, and proposed enhancements for the Academic Master Data module.

### High Priority

| ID      | Issue                              | Impact                                   | Proposed Solution                  |
| ------- | ---------------------------------- | ---------------------------------------- | ---------------------------------- |
| AMD-001 | **No bulk edit for grade levels**  | Must edit each grade individually        | Add bulk update API and UI         |
| AMD-002 | **No duplicate detection preview** | User only knows of duplicate on save     | Add inline validation while typing |
| AMD-003 | **No academic year archiving**     | Old years clutter the interface          | Add "archived" flag with filter    |
| AMD-004 | **No grade level history**         | Cannot track threshold changes over time | Add history table for grade_levels |

### Medium Priority

| ID      | Issue                         | Impact                                    | Proposed Solution                    |
| ------- | ----------------------------- | ----------------------------------------- | ------------------------------------ |
| AMD-005 | **No default academic year**  | Must select year in every budget version  | Add "default" flag to academic_years |
| AMD-006 | **Fixed 36-week assumption**  | Some years may have different week counts | Remove default, make required field  |
| AMD-007 | **No calendar visualization** | Hard to visualize date ranges             | Add timeline/calendar view           |
| AMD-008 | **No grade level cloning**    | Setting up new year requires re-entry     | Add "Copy from year" feature         |

### Low Priority / Technical Debt

| ID      | Issue                                 | Impact                               | Proposed Solution            |
| ------- | ------------------------------------- | ------------------------------------ | ---------------------------- |
| AMD-009 | **String fiscal year format**         | No validation of year format pattern | Add regex pattern validation |
| AMD-010 | **No soft delete for academic years** | Deleted years cannot be recovered    | Add deleted_at timestamp     |
| AMD-011 | **Decimal precision in frontend**     | Percentages displayed as "0.6000"    | Format for display (60%)     |
| AMD-012 | **No import/export functionality**    | Cannot backup/restore master data    | Add CSV/JSON import/export   |

### Feature Requests

| ID      | Feature                       | Business Value                                            | Complexity |
| ------- | ----------------------------- | --------------------------------------------------------- | ---------- |
| AMD-F01 | **Academic year templates**   | Pre-configured year patterns (standard, Ramadan-adjusted) | Medium     |
| AMD-F02 | **Grade level dependencies**  | Validate grade progression rules                          | Medium     |
| AMD-F03 | **Multi-campus support**      | Different grade configs per campus                        | High       |
| AMD-F04 | **Threshold recommendations** | Suggest thresholds based on historical data               | High       |
| AMD-F05 | **Capacity planning wizard**  | Guided setup for new academic years                       | Medium     |

---

## Appendix A: Grade Level Band Colors

Band badges use color coding for quick visual identification:

| Band        | Background Color         | Text Color            |
| ----------- | ------------------------ | --------------------- |
| MATERNELLE  | `--badge-maternelle-bg`  | `--badge-maternelle`  |
| ELEMENTAIRE | `--badge-elementaire-bg` | `--badge-elementaire` |
| COLLEGE     | `--badge-college-bg`     | `--badge-college`     |
| LYCEE       | `--badge-lycee-bg`       | `--badge-lycee`       |

---

## Appendix B: System Dependencies

Academic Master Data is referenced throughout the system:

```
┌─────────────────────────────────────────────────────────────┐
│  ACADEMIC MASTER DATA                                        │
│  ┌───────────────┐  ┌───────────────┐                       │
│  │ AcademicYears │  │ Grade Levels  │                       │
│  └───────┬───────┘  └───────┬───────┘                       │
│          │                  │                               │
│          ▼                  ▼                               │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐   │
│  │ Budget        │  │ Enrollment    │  │ DHG           │   │
│  │ Versions      │  │ Planning      │  │ Calculations  │   │
│  └───────────────┘  └───────────────┘  └───────────────┘   │
│                              │                              │
│                              ▼                              │
│                    ┌───────────────┐                        │
│                    │ Revenue       │                        │
│                    │ Calculations  │                        │
│                    └───────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

Changes to master data propagate to all dependent modules.

---

## Document History

| Version | Date       | Author       | Changes                   |
| ------- | ---------- | ------------ | ------------------------- |
| 1.0     | 2026-03-10 | AI Assistant | Initial document creation |

---

_End of Document_
