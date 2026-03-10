# Reference Data Page — Process Workflow

> **Document Purpose**: This document provides a comprehensive, plain-language guide to the Reference Data management page. It explains the business process, technical implementation, user actions, and data flow. It serves as a reference for auditors, new developers, and business analysts to understand and propose improvements.

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
10. [Audit Trail](#audit-trail)
11. [Error Handling](#error-handling)
12. [Improvements Required](#improvements-required)

---

## Overview

| Attribute            | Value                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------ |
| **Page Name**        | Reference Data                                                                                         |
| **URL Route**        | `/master-data/reference`                                                                               |
| **Module**           | Admin — Master Data Management                                                                         |
| **Page File**        | `apps/web/src/pages/master-data/reference.tsx`                                                         |
| **Primary Function** | Manage reference data entities (Nationalities, Tariffs, Departments) used throughout the budget system |

### What This Page Does

The Reference Data page is the **central configuration hub** for master data entities used across the entire budget system. It allows administrators to:

1. Manage **Nationalities** — Student nationality categories with VAT exemption flags
2. Manage **Tariffs** — Fee classification codes used in fee grid configuration
3. Manage **Departments** — School departments mapped to educational bands
4. Perform **CRUD operations** (Create, Read, Update, Delete) on all reference entities
5. Maintain **data integrity** through code uniqueness and optimistic locking

**Critical Business Rule**: Changes to reference data immediately affect downstream modules (Enrollment, Fee Grids, Staff Roster). Reference data is version-independent and shared across all budget versions.

---

## Business Context

### Reference Data Categories

Reference data provides the foundational lookup values used throughout the budget system:

| Category          | Purpose                                                             | Used In                                          |
| ----------------- | ------------------------------------------------------------------- | ------------------------------------------------ |
| **Nationalities** | Classify students by nationality for fee calculations and reporting | Enrollment nationality distribution, Fee grids   |
| **Tariffs**       | Define fee rate categories applied to student groups                | Fee grid configuration, Revenue calculations     |
| **Departments**   | Organize staff by functional school departments                     | Employee roster, Cost allocation, Staffing plans |

### Nationality Categories

| Code    | Label     | VAT Exempt | Description                                           |
| ------- | --------- | ---------- | ----------------------------------------------------- |
| **FR**  | Francais  | No         | French nationals — standard VAT applies               |
| **NAT** | Nationaux | No         | Saudi nationals (KSA) — standard VAT applies          |
| **AUT** | Autres    | Yes        | Other nationalities — VAT exempt for certain services |

### Tariff Classifications

| Code      | Label              | Description                              |
| --------- | ------------------ | ---------------------------------------- |
| **RP**    | Régime Particulier | Special fee regime for specific cases    |
| **R3+**   | Régime 3+          | Fee regime for families with 3+ children |
| **Plein** | Plein Tarif        | Full standard fee rate                   |

### Department Band Mapping

Departments are mapped to educational bands for cost allocation and reporting:

| Band             | Description            | Example Departments         |
| ---------------- | ---------------------- | --------------------------- |
| **MATERNELLE**   | Preschool level        | Maternelle Administration   |
| **ELEMENTAIRE**  | Primary school level   | Elementary Administration   |
| **COLLEGE**      | Middle school level    | College Administration      |
| **LYCEE**        | High school level      | Lycee Administration        |
| **NON_ACADEMIC** | Administrative/support | HR, Finance, IT, Facilities |

---

## User Roles & Permissions

| Role            | View Data | Add Records | Edit Records | Delete Records |
| --------------- | --------- | ----------- | ------------ | -------------- |
| **Admin**       | ✅        | ✅          | ✅           | ✅             |
| **BudgetOwner** | ✅        | ❌          | ❌           | ❌             |
| **Editor**      | ✅        | ❌          | ❌           | ❌             |
| **Viewer**      | ✅        | ❌          | ❌           | ❌             |

**Version Independence**: Reference data is global and not tied to budget versions. All authenticated users can view reference data regardless of version status.

**Delete Protection**: Delete operations require typing the record code to confirm, preventing accidental deletions.

---

## Pre-Conditions

Before using this page, the following requirements must be met:

### Required Permissions

1. **User must be authenticated** with a valid JWT token
2. **User must have appropriate role** for intended operations (Admin for modifications)

### System Dependencies

1. **Master data API endpoints** must be available (`/master-data/*`)
2. **Database tables** must exist with proper constraints
3. **Audit logging** must be configured for tracking changes

### Data Integrity Constraints

1. **Code uniqueness** — Each entity type enforces unique codes (e.g., cannot have two nationalities with code "FR")
2. **Referential integrity** — Cannot delete entities referenced by other records (enforced at application level)
3. **Optimistic locking** — Records include version field for concurrent modification detection

---

## Page Layout & UI Elements

### Header Section

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Reference Data                                              [Admin only]   │
│  Manage nationalities, tariffs, and departments              [+ Add New]    │
├─────────────────────────────────────────────────────────────────────────────┤
│  📑 Tabs                                                                    │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐                               │
│  │ Nationality│ │  Tariffs   │ │Departments │                               │
│  │   (3)      │ │   (3)      │ │   (5)      │                               │
│  └────────────┘ └────────────┘ └────────────┘                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Tab Navigation

| Tab               | Count             | Description                           | Permission                       |
| ----------------- | ----------------- | ------------------------------------- | -------------------------------- |
| **Nationalities** | Shows total count | Manage student nationality categories | All roles (view), Admin (modify) |
| **Tariffs**       | Shows total count | Manage fee tariff classifications     | All roles (view), Admin (modify) |
| **Departments**   | Shows total count | Manage school departments             | All roles (view), Admin (modify) |

### Filter Controls

| Control          | Type       | Function                                          |
| ---------------- | ---------- | ------------------------------------------------- |
| **Search Input** | Text field | Filters table by code or label (case-insensitive) |
| **Clear Search** | Button     | Clears the search filter and shows all records    |

### Action Buttons (Admin Only)

| Button      | Icon   | Action                                              |
| ----------- | ------ | --------------------------------------------------- |
| **Add New** | Plus   | Opens side panel to create new record in active tab |
| **Edit**    | Pencil | Opens side panel to edit selected record            |
| **Delete**  | Trash  | Opens confirmation dialog for record deletion       |

### Data Table Structure

#### Nationalities Table

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Nationalities                                                   [+ Add New] │
├──────────────────────────────────────────────────────────────────────────────┤
│ 🔍 Search...                                                                 │
├──────────┬─────────────────────┬─────────────┬───────────────────────────────┤
│ Code     │ Label               │ VAT Exempt  │ Actions                       │
├──────────┼─────────────────────┼─────────────┼───────────────────────────────┤
│ FR       │ Francais            │ No          │ [Edit] [Delete]               │
│ NAT      │ Nationaux           │ No          │ [Edit] [Delete]               │
│ AUT      │ Autres              │ Yes         │ [Edit] [Delete]               │
└──────────┴─────────────────────┴─────────────┴───────────────────────────────┘
```

**Display Fields**:

- **Code**: Short unique identifier (2–10 characters)
- **Label**: Human-readable name
- **VAT Exempt**: Boolean indicator (Yes/No)

#### Tariffs Table

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Tariffs                                                         [+ Add New] │
├──────────────────────────────────────────────────────────────────────────────┤
│ 🔍 Search...                                                                 │
├──────────┬─────────────────────┬────────────────────────┬────────────────────┤
│ Code     │ Label               │ Description            │ Actions            │
├──────────┼─────────────────────┼────────────────────────┼────────────────────┤
│ RP       │ Régime Particulier  │ Special fee regime     │ [Edit] [Delete]    │
│ R3+      │ Régime 3+           │ 3+ children discount   │ [Edit] [Delete]    │
│ Plein    │ Plein Tarif         │ Full standard rate     │ [Edit] [Delete]    │
└──────────┴─────────────────────┴────────────────────────┴────────────────────┘
```

**Display Fields**:

- **Code**: Short unique identifier
- **Label**: Human-readable name
- **Description**: Detailed explanation of the tariff

#### Departments Table

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Departments                                                     [+ Add New] │
├──────────────────────────────────────────────────────────────────────────────┤
│ 🔍 Search...                                                                 │
├──────────┬───────────────────────────┬─────────────────┬────────────────────┤
│ Code     │ Label                     │ Band Mapping    │ Actions            │
├──────────┼───────────────────────────┼─────────────────┼────────────────────┤
│ MAT      │ Maternelle Administration │ MATERNELLE      │ [Edit] [Delete]    │
│ ELEM     │ Elementary Administration │ ELEMENTAIRE     │ [Edit] [Delete]    │
│ COLL     │ College Administration    │ COLLEGE         │ [Edit] [Delete]    │
│ LYC      │ Lycee Administration      │ LYCEE           │ [Edit] [Delete]    │
│ ADMIN    │ General Administration    │ NON_ACADEMIC    │ [Edit] [Delete]    │
└──────────┴───────────────────────────┴─────────────────┴────────────────────┘
```

**Display Fields**:

- **Code**: Short unique identifier
- **Label**: Human-readable department name
- **Band Mapping**: Educational band association (MATERNELLE, ELEMENTAIRE, COLLEGE, LYCEE, NON_ACADEMIC)

---

## Step-by-Step Workflow

### Workflow 1: View Reference Data

**Actor**: Any authenticated user

| Step | Action                          | UI Element                            | API Call                                                     | Result                                   |
| ---- | ------------------------------- | ------------------------------------- | ------------------------------------------------------------ | ---------------------------------------- |
| 1    | Navigate to Reference Data page | Sidebar menu → Admin → Reference Data | -                                                            | Page loads with Nationalities tab active |
| 2    | View records in current tab     | Data table                            | `GET /master-data/nationalities`                             | Table displays all nationalities         |
| 3    | Switch to different tab         | Tab button                            | `GET /master-data/tariffs` or `GET /master-data/departments` | Table displays records for selected tab  |
| 4    | Search for specific record      | Search input                          | Client-side filter                                           | Table filters to matching records        |
| 5    | Clear search filter             | Clear button or empty search          | -                                                            | All records displayed again              |

---

### Workflow 2: Add New Nationality

**Actor**: Admin

| Step | Action                             | UI Element | API Call                          | Result                                 |
| ---- | ---------------------------------- | ---------- | --------------------------------- | -------------------------------------- |
| 1    | Ensure Nationalities tab is active | Tab button | -                                 | Nationalities table displayed          |
| 2    | Click "+ Add New" button           | Button     | -                                 | Side panel opens with empty form       |
| 3    | Enter Code (e.g., "FR")            | Text input | -                                 | Code entered, validated for uniqueness |
| 4    | Enter Label (e.g., "Francais")     | Text input | -                                 | Label entered                          |
| 5    | Toggle VAT Exempt switch           | Toggle     | -                                 | Switch set to Yes or No                |
| 6    | Click "Save" button                | Button     | `POST /master-data/nationalities` | Record created, table refreshes        |
| 7    | Observe success notification       | Toast      | -                                 | "Nationality created successfully"     |

**Request Body**:

```json
{
    "code": "FR",
    "label": "Francais",
    "vatExempt": false
}
```

**Database Changes**:

- Insert record into `nationalities` table
- Insert `audit_entries` record with operation NATIONALITY_CREATED
- Set `created_by` and `updated_by` to current user

---

### Workflow 3: Edit Tariff

**Actor**: Admin

| Step | Action                       | UI Element  | API Call                        | Result                               |
| ---- | ---------------------------- | ----------- | ------------------------------- | ------------------------------------ |
| 1    | Click Tariffs tab            | Tab button  | `GET /master-data/tariffs`      | Tariffs table displayed              |
| 2    | Locate tariff to edit        | Table row   | -                               | Row identified                       |
| 3    | Click "Edit" button          | Icon button | `GET /master-data/tariffs/{id}` | Side panel opens with form populated |
| 4    | Modify Label or Description  | Text input  | -                               | Updated values entered               |
| 5    | Click "Save" button          | Button      | `PUT /master-data/tariffs/{id}` | Record updated, table refreshes      |
| 6    | Observe success notification | Toast       | -                               | "Tariff updated successfully"        |

**Request Body**:

```json
{
    "code": "R3+",
    "label": "Régime 3+ (Updated)",
    "description": "Updated description for families with 3 or more children",
    "version": 2
}
```

**Database Changes**:

- Update record in `tariffs` table
- Increment `version` field (optimistic locking)
- Update `updated_at` timestamp
- Update `updated_by` to current user
- Insert `audit_entries` record with operation TARIFF_UPDATED

---

### Workflow 4: Delete Department

**Actor**: Admin

| Step | Action                               | UI Element  | API Call                               | Result                                  |
| ---- | ------------------------------------ | ----------- | -------------------------------------- | --------------------------------------- |
| 1    | Click Departments tab                | Tab button  | `GET /master-data/departments`         | Departments table displayed             |
| 2    | Locate department to delete          | Table row   | -                                      | Row identified                          |
| 3    | Click "Delete" button                | Icon button | -                                      | Confirmation dialog opens               |
| 4    | Type department code (e.g., "ADMIN") | Text input  | -                                      | Delete button enabled when code matches |
| 5    | Click "Delete" in dialog             | Button      | `DELETE /master-data/departments/{id}` | Record deleted, table refreshes         |
| 6    | Observe success notification         | Toast       | -                                      | "Department deleted successfully"       |

**Confirmation Dialog Behavior**:

- Shows warning: "This action cannot be undone"
- Requires typing the exact code to enable delete button
- Prevents accidental deletions through misclick

**Database Changes**:

- Delete record from `departments` table
- Insert `audit_entries` record with operation DEPARTMENT_DELETED

**Error Cases**:

- If department is referenced by employees, deletion is blocked
- Error message: "Cannot delete department: referenced by active employees"

---

### Workflow 5: Search and Filter

**Actor**: Any authenticated user

| Step | Action                                | UI Element | Result                          |
| ---- | ------------------------------------- | ---------- | ------------------------------- |
| 1    | Type search term in search box        | Text input | Table filters in real-time      |
| 2    | Observe filtered results              | Data table | Only matching records displayed |
| 3    | Clear search (delete text or click X) | Input/Icon | All records displayed           |

**Search Behavior**:

- Case-insensitive matching
- Searches across Code and Label fields
- Client-side filtering (no additional API call)
- Immediate feedback as user types

---

## Data Models & Database Schema

### Core Tables

#### 1. nationalities

Stores student nationality categories with VAT exemption flags.

```sql
Table: nationalities
┌───────────────────┬─────────────────┬────────────────────────────────────────────┐
│ Column            │ Type            │ Description                                │
├───────────────────┼─────────────────┼────────────────────────────────────────────┤
│ id                │ SERIAL PK       │ Unique identifier                          │
│ code              │ VARCHAR(10)     │ Unique code (FR, NAT, AUT, etc.)           │
│ label             │ VARCHAR(60)     │ Display name ("Francais")                  │
│ vat_exempt        │ BOOLEAN         │ VAT exemption flag                         │
│ version           │ INTEGER         │ Optimistic locking version                 │
│ created_by        │ INTEGER FK      │ → users.id                                 │
│ updated_by        │ INTEGER FK      │ → users.id                                 │
│ created_at        │ TIMESTAMPTZ     │ Record creation timestamp                  │
│ updated_at        │ TIMESTAMPTZ     │ Last update timestamp                      │
└───────────────────┴─────────────────┴────────────────────────────────────────────┘

Unique Constraint: code
```

#### 2. tariffs

Stores fee tariff classifications used in fee grids.

```sql
Table: tariffs
┌───────────────────┬─────────────────┬────────────────────────────────────────────┐
│ Column            │ Type            │ Description                                │
├───────────────────┼─────────────────┼────────────────────────────────────────────┤
│ id                │ SERIAL PK       │ Unique identifier                          │
│ code              │ VARCHAR(10)     │ Unique code (RP, R3+, Plein, etc.)         │
│ label             │ VARCHAR(60)     │ Display name ("Régime Particulier")        │
│ description       │ TEXT            │ Detailed description                       │
│ version           │ INTEGER         │ Optimistic locking version                 │
│ created_by        │ INTEGER FK      │ → users.id                                 │
│ updated_by        │ INTEGER FK      │ → users.id                                 │
│ created_at        │ TIMESTAMPTZ     │ Record creation timestamp                  │
│ updated_at        │ TIMESTAMPTZ     │ Last update timestamp                      │
└───────────────────┴─────────────────┴────────────────────────────────────────────┘

Unique Constraint: code
```

#### 3. departments

Stores school departments mapped to educational bands.

```sql
Table: departments
┌───────────────────┬─────────────────┬────────────────────────────────────────────┐
│ Column            │ Type            │ Description                                │
├───────────────────┼─────────────────┼────────────────────────────────────────────┤
│ id                │ SERIAL PK       │ Unique identifier                          │
│ code              │ VARCHAR(10)     │ Unique department code                     │
│ label             │ VARCHAR(100)    │ Display name                               │
│ band_mapping      │ BandMapping     │ ENUM: MATERNELLE, ELEMENTAIRE, COLLEGE,    │
│                   │                 │       LYCEE, NON_ACADEMIC                  │
│ version           │ INTEGER         │ Optimistic locking version                 │
│ created_by        │ INTEGER FK      │ → users.id                                 │
│ updated_by        │ INTEGER FK      │ → users.id                                 │
│ created_at        │ TIMESTAMPTZ     │ Record creation timestamp                  │
│ updated_at        │ TIMESTAMPTZ     │ Last update timestamp                      │
└───────────────────┴─────────────────┴────────────────────────────────────────────┘

Unique Constraint: code
```

### Type Definitions

```typescript
// Band mapping enum
export enum BandMapping {
    MATERNELLE = 'MATERNELLE',
    ELEMENTAIRE = 'ELEMENTAIRE',
    COLLEGE = 'COLLEGE',
    LYCEE = 'LYCEE',
    NON_ACADEMIC = 'NON_ACADEMIC',
}
```

---

## API Endpoints

### Nationalities APIs

| Method | Endpoint                          | Description            | Auth | Role  |
| ------ | --------------------------------- | ---------------------- | ---- | ----- |
| GET    | `/master-data/nationalities`      | List all nationalities | JWT  | Any   |
| GET    | `/master-data/nationalities/{id}` | Get single nationality | JWT  | Any   |
| POST   | `/master-data/nationalities`      | Create new nationality | JWT  | Admin |
| PUT    | `/master-data/nationalities/{id}` | Update nationality     | JWT  | Admin |
| DELETE | `/master-data/nationalities/{id}` | Delete nationality     | JWT  | Admin |

**POST/PUT Request Body**:

```json
{
    "code": "FR",
    "label": "Francais",
    "vatExempt": false
}
```

**Response (GET /nationalities)**:

```json
[
    {
        "id": 1,
        "code": "FR",
        "label": "Francais",
        "vatExempt": false,
        "version": 3,
        "createdAt": "2024-01-15T08:30:00Z",
        "updatedAt": "2024-03-10T14:22:00Z",
        "createdBy": 1,
        "updatedBy": 2
    },
    {
        "id": 2,
        "code": "NAT",
        "label": "Nationaux",
        "vatExempt": false,
        "version": 1,
        "createdAt": "2024-01-15T08:30:00Z",
        "updatedAt": "2024-01-15T08:30:00Z",
        "createdBy": 1,
        "updatedBy": 1
    }
]
```

---

### Tariffs APIs

| Method | Endpoint                    | Description       | Auth | Role  |
| ------ | --------------------------- | ----------------- | ---- | ----- |
| GET    | `/master-data/tariffs`      | List all tariffs  | JWT  | Any   |
| GET    | `/master-data/tariffs/{id}` | Get single tariff | JWT  | Any   |
| POST   | `/master-data/tariffs`      | Create new tariff | JWT  | Admin |
| PUT    | `/master-data/tariffs/{id}` | Update tariff     | JWT  | Admin |
| DELETE | `/master-data/tariffs/{id}` | Delete tariff     | JWT  | Admin |

**POST/PUT Request Body**:

```json
{
    "code": "R3+",
    "label": "Régime 3+",
    "description": "Special fee regime for families with 3 or more children enrolled"
}
```

**Response (GET /tariffs)**:

```json
[
    {
        "id": 1,
        "code": "RP",
        "label": "Régime Particulier",
        "description": "Special fee regime for specific cases",
        "version": 2,
        "createdAt": "2024-01-15T08:30:00Z",
        "updatedAt": "2024-02-20T11:15:00Z",
        "createdBy": 1,
        "updatedBy": 2
    }
]
```

---

### Departments APIs

| Method | Endpoint                        | Description           | Auth | Role  |
| ------ | ------------------------------- | --------------------- | ---- | ----- |
| GET    | `/master-data/departments`      | List all departments  | JWT  | Any   |
| GET    | `/master-data/departments/{id}` | Get single department | JWT  | Any   |
| POST   | `/master-data/departments`      | Create new department | JWT  | Admin |
| PUT    | `/master-data/departments/{id}` | Update department     | JWT  | Admin |
| DELETE | `/master-data/departments/{id}` | Delete department     | JWT  | Admin |

**POST/PUT Request Body**:

```json
{
    "code": "MAT",
    "label": "Maternelle Administration",
    "bandMapping": "MATERNELLE"
}
```

**Response (GET /departments)**:

```json
[
    {
        "id": 1,
        "code": "MAT",
        "label": "Maternelle Administration",
        "bandMapping": "MATERNELLE",
        "version": 1,
        "createdAt": "2024-01-15T08:30:00Z",
        "updatedAt": "2024-01-15T08:30:00Z",
        "createdBy": 1,
        "updatedBy": 1
    },
    {
        "id": 5,
        "code": "ADMIN",
        "label": "General Administration",
        "bandMapping": "NON_ACADEMIC",
        "version": 4,
        "createdAt": "2024-01-15T08:30:00Z",
        "updatedAt": "2024-05-01T09:00:00Z",
        "createdBy": 1,
        "updatedBy": 3
    }
]
```

---

## TypeScript Types

### Core Types (`packages/types/src/master-data.ts`)

```typescript
// Nationality entity
export interface Nationality {
    id: number;
    code: string;
    label: string;
    vatExempt: boolean;
    version: number;
    createdAt: Date;
    updatedAt: Date;
    createdBy: number;
    updatedBy: number;
}

// Tariff entity
export interface Tariff {
    id: number;
    code: string;
    label: string;
    description: string | null;
    version: number;
    createdAt: Date;
    updatedAt: Date;
    createdBy: number;
    updatedBy: number;
}

// Department entity
export interface Department {
    id: number;
    code: string;
    label: string;
    bandMapping: BandMapping;
    version: number;
    createdAt: Date;
    updatedAt: Date;
    createdBy: number;
    updatedBy: number;
}

// Band mapping enum
export enum BandMapping {
    MATERNELLE = 'MATERNELLE',
    ELEMENTAIRE = 'ELEMENTAIRE',
    COLLEGE = 'COLLEGE',
    LYCEE = 'LYCEE',
    NON_ACADEMIC = 'NON_ACADEMIC',
}

// Create/Update DTOs
export interface CreateNationalityDto {
    code: string;
    label: string;
    vatExempt: boolean;
}

export interface UpdateNationalityDto {
    code: string;
    label: string;
    vatExempt: boolean;
    version: number;
}

export interface CreateTariffDto {
    code: string;
    label: string;
    description?: string;
}

export interface UpdateTariffDto {
    code: string;
    label: string;
    description?: string;
    version: number;
}

export interface CreateDepartmentDto {
    code: string;
    label: string;
    bandMapping: BandMapping;
}

export interface UpdateDepartmentDto {
    code: string;
    label: string;
    bandMapping: BandMapping;
    version: number;
}
```

### Tab Type (Frontend)

```typescript
export type ReferenceDataTab = 'nationalities' | 'tariffs' | 'departments';
```

---

## Audit Trail

### Operations Logged

| Operation           | Table         | Data Captured                      |
| ------------------- | ------------- | ---------------------------------- |
| NATIONALITY_CREATED | nationalities | All fields of new record           |
| NATIONALITY_UPDATED | nationalities | Changed fields, old and new values |
| NATIONALITY_DELETED | nationalities | ID and code of deleted record      |
| TARIFF_CREATED      | tariffs       | All fields of new record           |
| TARIFF_UPDATED      | tariffs       | Changed fields, old and new values |
| TARIFF_DELETED      | tariffs       | ID and code of deleted record      |
| DEPARTMENT_CREATED  | departments   | All fields of new record           |
| DEPARTMENT_UPDATED  | departments   | Changed fields, old and new values |
| DEPARTMENT_DELETED  | departments   | ID and code of deleted record      |

### Audit Entry Schema

```typescript
{
  userId: number;
  userEmail: string;
  operation: string;
  tableName: string;
  recordId: number;
  ipAddress: string;
  oldValues?: Json;      // For updates and deletes
  newValues: Json;       // For creates and updates
  createdAt: Date;
}
```

---

## Error Handling

### Common Error Codes

| Code                 | HTTP Status | Description                                        | User Action             |
| -------------------- | ----------- | -------------------------------------------------- | ----------------------- |
| DUPLICATE_CODE       | 409         | Code already exists for this entity type           | Choose a unique code    |
| VERSION_CONFLICT     | 409         | Record was modified by another user                | Refresh and retry       |
| REFERENCED_RECORD    | 409         | Cannot delete — record is referenced by other data | Remove references first |
| INVALID_BAND_MAPPING | 422         | Invalid band mapping value for departments         | Use valid enum value    |
| CODE_TOO_LONG        | 422         | Code exceeds maximum length (10 chars)             | Shorten code            |
| UNAUTHORIZED         | 401         | User not authenticated                             | Log in                  |
| FORBIDDEN            | 403         | User lacks required role                           | Contact administrator   |
| NOT_FOUND            | 404         | Record not found                                   | Verify record ID        |

### Optimistic Locking Error

When two users edit the same record simultaneously:

1. User A fetches record (version = 1)
2. User B fetches record (version = 1)
3. User A saves changes → version becomes 2
4. User B tries to save → **VERSION_CONFLICT (409)**

**Error Response**:

```json
{
    "error": "VERSION_CONFLICT",
    "message": "Record was modified by another user. Please refresh and try again.",
    "currentVersion": 2
}
```

---

## Improvements Required

This section documents known issues, technical debt, and proposed enhancements for the Reference Data module.

### High Priority

| ID      | Issue                                 | Impact                                          | Proposed Solution                                   |
| ------- | ------------------------------------- | ----------------------------------------------- | --------------------------------------------------- |
| REF-001 | **No bulk import for reference data** | Administrators must add records one-by-one      | Add CSV/Excel import for bulk creation              |
| REF-002 | **No code format validation**         | Invalid codes can break downstream integrations | Add regex validation (e.g., uppercase letters only) |
| REF-003 | **No duplicate detection warning**    | Users only learn of duplicate on save attempt   | Real-time availability check as user types          |
| REF-004 | **Limited department hierarchy**      | Flat structure doesn't support sub-departments  | Add parent/child relationship for departments       |

### Medium Priority

| ID      | Issue                             | Impact                                      | Proposed Solution                              |
| ------- | --------------------------------- | ------------------------------------------- | ---------------------------------------------- |
| REF-005 | **No archive/hide functionality** | Cannot hide unused records without deleting | Add "isActive" flag to soft-hide records       |
| REF-006 | **No sorting customization**      | Tables always sorted by code                | Add column sorting and default sort preference |
| REF-007 | **No export functionality**       | Cannot export reference data to Excel       | Add "Export to Excel" button per tab           |
| REF-008 | **Missing audit log viewer**      | Audit entries exist but no UI to view them  | Add audit history panel per record             |

### Low Priority / Technical Debt

| ID      | Issue                               | Impact                                | Proposed Solution                             |
| ------- | ----------------------------------- | ------------------------------------- | --------------------------------------------- |
| REF-009 | **Sequential API calls for counts** | Tab badges load one at a time         | Parallelize count requests                    |
| REF-010 | **Hardcoded tab configuration**     | Tab structure in code                 | Move to configuration-driven approach         |
| REF-011 | **No keyboard navigation**          | Must use mouse for all actions        | Add keyboard shortcuts (Ctrl+N for new, etc.) |
| REF-012 | **Client-side search only**         | Large datasets may impact performance | Implement server-side search with debounce    |

### Feature Requests

| ID      | Feature                            | Business Value                              | Complexity |
| ------- | ---------------------------------- | ------------------------------------------- | ---------- |
| REF-F01 | **Reference data versioning**      | Track historical changes to codes/labels    | Medium     |
| REF-F02 | **Multi-language labels**          | Support Arabic and French labels            | Medium     |
| REF-F03 | **Department cost center mapping** | Link departments to accounting cost centers | Low        |
| REF-F04 | **Nationality fee rule templates** | Configure default fee rules per nationality | Medium     |
| REF-F05 | **Tariff effective dates**         | Schedule tariff changes for future dates    | High       |

---

## Appendix A: Data Usage Matrix

Reference data is consumed by various modules throughout the system:

| Reference Type    | Consumed By     | Usage                                  |
| ----------------- | --------------- | -------------------------------------- |
| **Nationalities** | Enrollment      | Nationality distribution breakdowns    |
| **Nationalities** | Fee Grids       | Fee rates by nationality × tariff      |
| **Nationalities** | Revenue         | VAT exemption calculations             |
| **Tariffs**       | Fee Grids       | Fee rate classifications               |
| **Tariffs**       | Revenue         | Revenue projections by tariff type     |
| **Departments**   | Staff Roster    | Employee department assignment         |
| **Departments**   | Cost Allocation | Departmental budget allocation         |
| **Departments**   | DHG             | Teaching hour allocation by department |

---

## Appendix B: Band Mapping Decision Tree

When creating or editing departments, use this decision tree for band mapping:

```
                    Is this an academic department?
                           │
              ┌────────────┴────────────┐
              Yes                        No
              │                          │
              ▼                          ▼
    What education level?         Band = NON_ACADEMIC
         │
    ┌────┼────┬────────┐
    │    │    │        │
  PS-   CP-  6eme-   2nde-
  MS-GS CE1-   5eme-  1ere-
        CE2    4eme-   Terminale
        CM1-   3eme
        CM2
         │    │        │
         ▼    ▼        ▼
    MATERNELLE ELEMENTAIRE  COLLEGE    LYCEE
```

---

## Document History

| Version | Date       | Author       | Changes                   |
| ------- | ---------- | ------------ | ------------------------- |
| 1.0     | 2026-03-10 | AI Assistant | Initial document creation |

---

_End of Document_
