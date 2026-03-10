# Staffing Page — Process Workflow

> **Document Purpose**: This document provides a comprehensive, plain-language guide to the Staffing planning page. It explains the business process, technical implementation, user actions, and data flow. It serves as a reference for auditors, new developers, and business analysts to understand and propose improvements.

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

| Attribute            | Value                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------ |
| **Page Name**        | Staffing                                                                                         |
| **URL Route**        | `/planning/staffing`                                                                             |
| **Module**           | Epic 4 — Staffing & HR Planning                                                                  |
| **Page File**        | `apps/web/src/pages/planning/staffing.tsx`                                                       |
| **Primary Function** | Manage employee roster, DHG teaching hour requirements, and comprehensive staff cost projections |

### What This Page Does

The Staffing page is the **HR planning hub** of the budget system. It allows users to:

1. View and manage the **employee roster** with complete employment details
2. Review **DHG (Dotation Horaire Globale)** requirements — teaching hour needs derived from enrollment
3. Configure **DHG Grille** — teaching hour allocations by grade and subject
4. Analyze **staff costs by department** with detailed breakdowns
5. View **monthly cost summary** projections throughout the fiscal year
6. Review **monthly cost budget (Tab C)** — cost breakdown by budget category
7. **Import employees** from Excel files for bulk onboarding
8. Calculate comprehensive **staffing costs** including salaries, benefits, and statutory obligations

**Critical Business Rule**: Changes to employee data or DHG calculations mark downstream modules (Staffing Costs, P&L) as "stale" — requiring recalculation to maintain data consistency.

---

## Business Context

### Employment Status Types

| Status       | Description                            | Budget Impact                 |
| ------------ | -------------------------------------- | ----------------------------- |
| **Active**   | Currently employed, full budget impact | Full monthly cost             |
| **Pending**  | Hired but not yet started              | Prorated from joining date    |
| **Inactive** | Terminated or on leave                 | No cost (or EOS accrual only) |

### Employee Functions (Roles)

| Function Category    | Examples                             | Salary Structure           |
| -------------------- | ------------------------------------ | -------------------------- |
| **Teaching Staff**   | Classroom teachers, specialists      | Base + DHG hours + Housing |
| **Administrative**   | Directors, coordinators, admin staff | Base + Housing + Transport |
| **Support Staff**    | Assistants, maintenance, security    | Base + Transport           |
| **Ajeer (Contract)** | Contract workers                     | Daily rate, no benefits    |

### Salary Components

| Component                | Description                             | Tax/GOSI Treatment   |
| ------------------------ | --------------------------------------- | -------------------- |
| **Base Salary**          | Fixed monthly salary                    | GOSI applicable      |
| **Housing Allowance**    | Accommodation allowance                 | GOSI applicable      |
| **Transport Allowance**  | Commute allowance                       | GOSI applicable      |
| **Food Allowance**       | Meal allowance                          | GOSI applicable      |
| **Other Allowances**     | Special allowances                      | Varies               |
| **GOSI (Employer)**      | Govt. Social Insurance (employer share) | 12% of GOSI wages    |
| **EOS (End of Service)** | Severance accrual                       | YEARFRAC calculation |

### DHG (Dotation Horaire Globale)

The DHG system calculates required teaching hours based on:

- Enrollment numbers (from Enrollment module)
- Class sections needed per grade
- Subject-specific hour allocations (from DHG Grille)
- FTE (Full-Time Equivalent) teacher requirements

---

## User Roles & Permissions

| Role            | View Data | View Salary | Edit Employees | Import Excel | Run Calculations |
| --------------- | --------- | ----------- | -------------- | ------------ | ---------------- |
| **Admin**       | ✅        | ✅          | ✅             | ✅           | ✅               |
| **BudgetOwner** | ✅        | ✅          | ✅             | ✅           | ✅               |
| **Editor**      | ✅        | ✅          | ✅             | ❌           | ✅               |
| **Viewer**      | ✅        | 🔒 Redacted | ❌             | ❌           | ❌               |

**Data Redaction Rule**: Viewers see employee names, codes, and departments, but salary fields display as "`[REDACTED]`" or hidden entirely.

**Version Lock Rule**: All edit operations are blocked if the Budget Version status is not "Draft". Published, Locked, or Archived versions cannot be modified.

---

## Pre-Conditions

Before using this page, the following must be configured:

### Required Master Data (via Admin → Master Data)

1. **Departments** (`departments` table)
    - Department codes: ADMIN, MATERNELLE, ELEMENTAIRE, COLLEGE, LYCEE, SUPPORT, etc.
    - Department names and budget category mappings

2. **Functions** (`functions` table)
    - Job function codes and descriptions
    - GOSI eligibility flags
    - EOS eligibility flags

3. **Grade Levels** (`grade_levels` table)
    - Required for DHG Grille configuration
    - Teaching hour allocations per subject

4. **DHG Grille Configuration** (`dhg_grille_config` table)
    - Subject codes (FR, EN, MATH, etc.)
    - Hours per week by grade and subject
    - Reference enrollment numbers

### Required Budget Setup

1. **Budget Version** must be created and selected in the workspace context bar
2. The version must be in **"Draft"** status for edits
3. **Fiscal Year** and **Academic Period** context must be set
4. **Enrollment calculations** should be completed (for DHG requirements)

### Required Security Setup

1. **Salary encryption key** must be configured
2. User must have appropriate role for intended actions

---

## Page Layout & UI Elements

### Header Section

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Staffing                                                  [Calculate]      │
│  Manage employees, DHG requirements, and cost projections  [Import Excel]   │
├─────────────────────────────────────────────────────────────────────────────┤
│  📊 KPI Ribbon                                                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │ Headcount    │ │ Annual Cost  │ │ Avg Monthly  │ │ GOSI Total   │       │
│  │ 89 employees │ │ 12.4M SAR    │ │ 11.6K SAR    │ │ 1.2M SAR     │       │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘       │
│  ┌──────────────┐ ┌──────────────┐                                           │
│  │ Ajeer Total  │ │ EOS Total    │                                           │
│  │ 340K SAR     │ │ 890K SAR     │                                           │
│  └──────────────┘ └──────────────┘                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Filter Controls

| Button                | Values                         | Function                |
| --------------------- | ------------------------------ | ----------------------- |
| **Status Filter**     | All, Active, Pending, Inactive | Filters employee roster |
| **Department Filter** | All departments dropdown       | Filters by department   |
| **Function Filter**   | All functions dropdown         | Filters by job function |

### Action Buttons

| Button           | Icon       | Role Required              | Action                         |
| ---------------- | ---------- | -------------------------- | ------------------------------ |
| **Calculate**    | Calculator | Admin, BudgetOwner, Editor | Runs staffing cost calculation |
| **Import Excel** | Upload     | Admin, BudgetOwner         | Opens employee import panel    |
| **Add Employee** | Plus       | Admin, BudgetOwner, Editor | Opens employee create dialog   |
| **Export**       | Download   | Admin, BudgetOwner         | Exports employee data to Excel |

### Tab Navigation

| Tab                      | Content                | Description                     |
| ------------------------ | ---------------------- | ------------------------------- |
| **Employee Roster**      | Employee list table    | All employees with details      |
| **DHG Requirements**     | Teaching hour needs    | Calculated from enrollment      |
| **DHG Grille**           | Hour allocation config | Teaching hours by grade/subject |
| **Staff Costs by Dept**  | Department breakdown   | Cost analysis by department     |
| **Monthly Cost Summary** | Month-by-month view    | Projected costs per month       |
| **Monthly Cost Budget**  | Tab C view             | Budget category breakdown       |

---

### Workspace Blocks (Main Content)

#### 1. Employee Roster

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ Employee Roster                                                [stale badge]   │
├────────┬──────────────┬──────────────┬──────────────┬──────────┬───────────────┤
│ Code   │ Name         │ Function     │ Department   │ Status   │ Joining Date  │
├────────┼──────────────┼──────────────┼──────────────┼──────────┼───────────────┤
│ EMP001 │ Ahmed Al-S.  │ Teacher      │ ELEMENTAIRE  │ Active   │ 2023-09-01    │
│ EMP002 │ Sarah J.     │ Coordinator  │ ADMIN        │ Active   │ 2022-01-15    │
│ EMP003 │ [Add New...] │              │              │          │               │
└────────┴──────────────┴──────────────┴──────────────┴──────────┴───────────────┘

[Click row to edit] [Delete selected]
```

**Employee Detail Panel (Slide-out)**:

```
┌──────────────────────────────────────────────────────────────┐
│ Employee: EMP001 - Ahmed Al-Saud              [X]            │
├──────────────────────────────────────────────────────────────┤
│ BASIC INFORMATION                                            │
│ ┌────────────────────────┐ ┌────────────────────────┐        │
│ │ Code:      [ EMP001  ] │ │ Name:    [Ahmed A-S  ] │        │
│ │ Function:  [Teacher ▼] │ │ Dept:    [Elementaire▼]│        │
│ │ Status:    [Active  ▼] │ │ Joining: [2023-09-01 ] │        │
│ └────────────────────────┘ └────────────────────────┘        │
├──────────────────────────────────────────────────────────────┤
│ SALARY COMPONENTS                                            │
│ ┌────────────────────────┐ ┌────────────────────────┐        │
│ │ Base Salary:  [8,500]  │ │ Housing:   [3,200]     │        │
│ │ Transport:    [  500]  │ │ Food:      [  300]     │        │
│ │ Other:        [    0]  │ │                        │        │
│ └────────────────────────┘ └────────────────────────┘        │
├──────────────────────────────────────────────────────────────┤
│ STATUTORY COSTS                                              │
│ ┌────────────────────────┐ ┌────────────────────────┐        │
│ │ GOSI Employer:  [1,020]│ │ EOS Accrual: [  245]   │        │
│ │ GOSI Employee:  [   0] │ │                        │        │
│ └────────────────────────┘ └────────────────────────┘        │
├──────────────────────────────────────────────────────────────┤
│          [Cancel]                      [Save Changes]        │
└──────────────────────────────────────────────────────────────┘
```

**Editable Fields** (Admin, BudgetOwner, Editor):

- **Code**: Unique employee identifier
- **Name**: Full name
- **Function**: Job function (dropdown)
- **Department**: Department assignment (dropdown)
- **Status**: Active/Pending/Inactive
- **Joining Date**: Employment start date
- **Salary Components**: Base, Housing, Transport, Food, Other (encrypted at rest)

---

#### 2. DHG Requirements

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ DHG Requirements (Dotation Horaire Globale)                    [stale badge] │
├──────────┬──────────┬─────────────┬──────────────┬───────────┬──────────────┤
│ Grade    │ Period   │ Students    │ Sections     │ Total Hrs │ FTE Needed   │
├──────────┼──────────┼─────────────┼──────────────┼───────────┼──────────────┤
│ PS       │ AY1      │ 42          │ 3            │ 45.0      │ 1.29         │
│ PS       │ AY2      │ 38          │ 2            │ 30.0      │ 0.86         │
│ MS       │ AY1      │ 48          │ 2            │ 60.0      │ 1.71         │
│ ...      │ ...      │ ...         │ ...          │ ...       │ ...          │
├──────────┼──────────┼─────────────┴──────────────┴───────────┴──────────────┤
│ TOTAL    │          │             │              │ 1,245.5   │ 35.6         │
└──────────┴──────────┴────────────────────────────────────────────────────────┘
```

**Display Fields** (read-only, computed):

- **Students**: Headcount from enrollment
- **Sections**: Calculated class sections needed
- **Total Hours**: Sum of teaching hours required
- **FTE Needed**: Full-time equivalent teachers (Total Hrs ÷ 35)

---

#### 3. DHG Grille Configuration

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ DHG Grille Configuration                                                    │
├──────────┬───────────┬───────────┬───────────┬───────────┬──────────────────┤
│ Subject  │ PS        │ MS        │ GS        │ CP        │ ... (per grade)  │
├──────────┼───────────┼───────────┼───────────┼───────────┼──────────────────┤
│ FR       │ 15.0      │ 16.0      │ 16.0      │ 18.0      │ ...              │
│ EN       │ 5.0       │ 5.0       │ 6.0       │ 6.0       │ ...              │
│ MATH     │ -         │ -         │ 5.0       │ 5.0       │ ...              │
│ ...      │ ...       │ ...       │ ...       │ ...       │ ...              │
├──────────┼───────────┴───────────┴───────────┴───────────┴──────────────────┤
│ Total/Wk │ 20.0      │ 21.0      │ 27.0      │ 29.0      │ ...              │
└──────────┴──────────────────────────────────────────────────────────────────┘
```

**Editable Fields**:

- **Hour cells**: Teaching hours per subject per grade (editable by Admin/BudgetOwner)
- Reference data from master data, can be overridden per version

---

#### 4. Staff Costs by Department

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Staff Costs by Department                                      [stale badge] │
├──────────────────┬───────────┬───────────┬───────────┬───────────┬───────────┤
│ Department       │ Headcount │ Base      │ Allowances│ GOSI      │ Total     │
├──────────────────┼───────────┼───────────┼───────────┼───────────┼───────────┤
│ ADMIN            │ 8         │ 84,000    │ 32,000    │ 13,920    │ 129,920   │
│ MATERNELLE       │ 15        │ 142,500   │ 71,250    │ 25,650    │ 239,400   │
│ ELEMENTAIRE      │ 22        │ 209,000   │ 104,500   │ 37,620    │ 351,120   │
│ COLLEGE          │ 18        │ 171,000   │ 85,500    │ 30,780    │ 287,280   │
│ LYCEE            │ 16        │ 168,000   │ 84,000    │ 30,240    │ 282,240   │
│ SUPPORT          │ 10        │ 55,000    │ 22,000    │ 9,240     │ 86,240    │
├──────────────────┼───────────┼───────────┴───────────┴───────────┴───────────┤
│ TOTAL            │ 89        │ 829,500   │ 399,250   │ 147,450   │ 1,376,200 │
└──────────────────┴───────────┴───────────────────────────────────────────────┘
```

**Display Fields** (read-only, computed):

- **Headcount**: Number of employees in department
- **Base**: Sum of base salaries
- **Allowances**: Sum of housing, transport, food, other
- **GOSI**: Employer GOSI contributions
- **Total**: All costs combined (monthly)

---

#### 5. Monthly Cost Summary

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Monthly Cost Summary                                           [stale badge] │
├───────────┬───────────┬───────────┬───────────┬───────────┬──────────────────┤
│ Month     │ Salaries  │ GOSI      │ EOS       │ Ajeer     │ Total            │
├───────────┼───────────┼───────────┼───────────┼───────────┼──────────────────┤
│ Jan 2025  │ 1,228,750 │  147,450  │  102,395  │  28,500   │ 1,507,095        │
│ Feb 2025  │ 1,228,750 │  147,450  │  102,395  │  28,500   │ 1,507,095        │
│ Mar 2025  │ 1,245,000 │  149,400  │  103,750  │  28,500   │ 1,526,650        │
│ ...       │ ...       │ ...       │ ...       │ ...       │ ...              │
│ Dec 2025  │ 1,310,000 │  157,200  │  109,167  │  31,000   │ 1,607,367        │
├───────────┼───────────┴───────────┴───────────┴───────────┴──────────────────┤
│ ANNUAL    │ 15,456,000│ 1,854,720 │ 1,286,400 │  350,000  │ 18,947,120       │
└───────────┴───────────────────────────────────────────────────────────────────┘
```

**Notes**:

- Costs vary by month due to joining dates, terminations, and salary changes
- EOS accrual calculated using YEARFRAC US 30/360 convention
- Ajeer (contract workers) tracked separately

---

#### 6. Monthly Cost Budget (Tab C View)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Monthly Cost Budget (Tab C Format)                             [stale badge] │
├──────────────────────────┬───────────┬───────────┬───────────┬───────────────┤
│ Category                 │ Q1        │ Q2        │ Q3        │ Q4            │
├──────────────────────────┼───────────┼───────────┼───────────┼───────────────┤
│ 6100 - Salaries & Wages  │ 3,682,500 │ 3,735,000 │ 3,870,000 │ 4,168,500     │
│ 6200 - Social Charges    │   441,900 │   448,200 │   464,400 │   500,220     │
│ 6300 - EOS Provision     │   306,135 │   310,260 │   321,510 │   346,335     │
│ 6400 - Recruitment       │    25,000 │    15,000 │    35,000 │    45,000     │
│ 6500 - Training          │    10,000 │     5,000 │    15,000 │    10,000     │
├──────────────────────────┼───────────┼───────────┼───────────┼───────────────┤
│ TOTAL                    │ 4,465,535 │ 4,513,460 │ 4,705,910 │ 5,070,055     │
└──────────────────────────┴───────────┴───────────┴───────────┴───────────────┘
```

---

## Step-by-Step Workflow

### Workflow 1: Add New Employee

**Actor**: Budget Owner or Editor

| Step | Action                                      | UI Element    | API Call                                 | Result                         |
| ---- | ------------------------------------------- | ------------- | ---------------------------------------- | ------------------------------ |
| 1    | Select Budget Version from context bar      | Dropdown      | `GET /versions`                          | Version loaded                 |
| 2    | Navigate to Staffing page                   | Sidebar menu  | -                                        | Page loads                     |
| 3    | Click "Add Employee" button                 | Button        | -                                        | Employee create dialog opens   |
| 4    | Enter employee code                         | Text input    | -                                        | Code validated (unique)        |
| 5    | Enter full name                             | Text input    | -                                        | Name captured                  |
| 6    | Select function from dropdown               | Select        | -                                        | Function selected              |
| 7    | Select department from dropdown             | Select        | -                                        | Department selected            |
| 8    | Set employment status                       | Select        | -                                        | Status selected                |
| 9    | Enter joining date                          | Date picker   | -                                        | Date captured                  |
| 10   | Enter base salary                           | Number input  | -                                        | Value encrypted client-side    |
| 11   | Enter allowances (housing, transport, etc.) | Number inputs | -                                        | Values captured                |
| 12   | Click "Save"                                | Button        | `POST /versions/{id}/staffing/employees` | Employee created               |
| 13   | Observe stale indicator                     | Badge         | -                                        | "Stale" appears on Cost blocks |

**Database Changes**:

- Insert record into `employees` table with encrypted salary fields
- Update `budget_versions.stale_modules` array to include STAFFING, PNL
- Insert `audit_entries` record with operation EMPLOYEE_CREATED

---

### Workflow 2: Edit Employee

**Actor**: Budget Owner or Editor

| Step | Action                      | UI Element         | API Call                                        | Result                         |
| ---- | --------------------------- | ------------------ | ----------------------------------------------- | ------------------------------ |
| 1    | Locate employee in roster   | Grid row           | -                                               | Row identified                 |
| 2    | Click employee row          | Row click          | `GET /versions/{id}/staffing/employees/{empId}` | Employee details loaded        |
| 3    | Edit desired field(s)       | Various inputs     | -                                               | Values updated                 |
| 4    | Click "Save Changes"        | Button             | `PUT /versions/{id}/staffing/employees/{empId}` | Changes saved                  |
| 5    | Observe update confirmation | Toast notification | -                                               | "Employee updated" shown       |
| 6    | Observe stale indicator     | Badge              | -                                               | Cost calculations marked stale |

**Formula for Salary Update**:

```
Total Monthly Cost = Base + Housing + Transport + Food + Other + GOSI_Employer
GOSI_Employer = (Base + Housing + Transport + Food) × 0.12
```

---

### Workflow 3: Delete Employee

**Actor**: Budget Owner or Editor

| Step | Action                    | UI Element     | API Call                                           | Result                      |
| ---- | ------------------------- | -------------- | -------------------------------------------------- | --------------------------- |
| 1    | Locate employee in roster | Grid row       | -                                                  | Row identified              |
| 2    | Select employee checkbox  | Checkbox       | -                                                  | Row selected                |
| 3    | Click "Delete" button     | Button         | -                                                  | Confirmation dialog appears |
| 4    | Confirm deletion          | Confirm button | `DELETE /versions/{id}/staffing/employees/{empId}` | Employee soft-deleted       |
| 5    | Observe roster update     | Grid refresh   | -                                                  | Employee no longer listed   |

**Note**: Employees are soft-deleted (status changed to "Inactive") to preserve audit trail and historical cost data.

---

### Workflow 4: Import Employees from Excel

**Actor**: Budget Owner

| Step | Action                                | UI Element    | API Call                                                        | Result                                  |
| ---- | ------------------------------------- | ------------- | --------------------------------------------------------------- | --------------------------------------- |
| 1    | Click "Import Excel" button           | Button        | -                                                               | Import panel opens (right sidebar)      |
| 2    | Click "Choose File"                   | File input    | -                                                               | File browser opens                      |
| 3    | Select Excel file                     | File dialog   | -                                                               | File name displayed                     |
| 4    | Click "Validate"                      | Button        | `POST /versions/{id}/staffing/employees/import` (mode=validate) | Validation runs                         |
| 5    | Review validation results             | Results panel | -                                                               | Valid rows count, preview table, errors |
| 6    | Click "Import" (if validation passes) | Button        | `POST /versions/{id}/staffing/employees/import` (mode=commit)   | Employees imported                      |
| 7    | Close panel                           | Close button  | -                                                               | Panel closes, roster updated            |

**Excel Format Requirements**:

```
| code   | name          | function | department  | status  | joining_date | base_salary | housing | transport | food | other |
|--------|---------------|----------|-------------|---------|--------------|-------------|---------|-----------|------|-------|
| EMP001 | Ahmed Al-Saud | Teacher  | ELEMENTAIRE | Active  | 2023-09-01   | 8500        | 3200    | 500       | 300  | 0     |
| EMP002 | Sarah Johnson | Admin    | ADMIN       | Active  | 2022-01-15   | 12000       | 0       | 800       | 0    | 500   |
```

---

### Workflow 5: Run Staffing Cost Calculation

**Actor**: Budget Owner or Editor

| Step | Action                      | UI Element   | API Call                                 | Result                         |
| ---- | --------------------------- | ------------ | ---------------------------------------- | ------------------------------ |
| 1    | Click "Calculate" button    | Button       | `POST /versions/{id}/calculate/staffing` | Calculation initiated          |
| 2    | Observe button state        | Spinner icon | -                                        | Shows "Calculating..."         |
| 3    | Wait for completion         | Success icon | -                                        | Shows "Calculated"             |
| 4    | Review Monthly Cost Summary | Tab click    | `GET /versions/{id}/staffing/costs`      | Month-by-month costs displayed |
| 5    | Review Staff Costs by Dept  | Tab click    | -                                        | Department breakdown displayed |
| 6    | Check DHG Requirements      | Tab click    | `GET /versions/{id}/staffing/dhg`        | Teaching hour needs displayed  |

**Calculation Steps** (Backend):

1. Fetch all employees for the version
2. Calculate monthly base costs per employee
3. Calculate prorated costs for joining/termination dates
4. Calculate GOSI employer contributions (12%)
5. Calculate EOS accrual using YEARFRAC US 30/360
6. Calculate DHG requirements from enrollment data
7. Aggregate costs by department
8. Aggregate costs by month and category (Tab C format)
9. Persist all results to database
10. Remove STAFFING from stale modules
11. Create calculation audit log

---

### Workflow 6: Configure DHG Grille

**Actor**: Budget Owner or Editor

| Step | Action                            | UI Element       | API Call                                 | Result                        |
| ---- | --------------------------------- | ---------------- | ---------------------------------------- | ----------------------------- |
| 1    | Click "DHG Grille" tab            | Tab              | `GET /versions/{id}/staffing/dhg-grille` | Grille configuration loaded   |
| 2    | Click hour cell for grade/subject | EditableCell     | -                                        | Cell enters edit mode         |
| 3    | Enter teaching hours              | Number input     | -                                        | Value displayed               |
| 4    | Confirm entry                     | Blur/Enter       | `PUT /versions/{id}/staffing/dhg-grille` | Saved to database             |
| 5    | Run calculation to see impact     | Calculate button | `POST /versions/{id}/calculate/staffing` | DHG requirements recalculated |

---

## Data Models & Database Schema

### Core Tables

#### 1. employees

Stores employee records with field-level encrypted salary data.

```sql
Table: employees
┌─────────────────────────┬─────────────────┬────────────────────────────────────────────┐
│ Column                  │ Type            │ Description                                │
├─────────────────────────┼─────────────────┼────────────────────────────────────────────┤
│ id                      │ SERIAL PK       │ Unique identifier                          │
│ version_id              │ INTEGER FK      │ → budget_versions.id                       │
│ code                    │ VARCHAR(20)     │ Employee code (unique within version)      │
│ name                    │ VARCHAR(100)    │ Full name                                  │
│ function_id             │ INTEGER FK      │ → functions.id                             │
│ department_id           │ INTEGER FK      │ → departments.id                           │
│ status                  │ VARCHAR(10)     │ 'Active', 'Pending', 'Inactive'            │
│ joining_date            │ DATE            │ Employment start date                      │
│ termination_date        │ DATE            │ Employment end date (nullable)             │
│ base_salary_encrypted   │ BYTEA           │ AES-256 encrypted base salary              │
│ housing_encrypted       │ BYTEA           │ AES-256 encrypted housing allowance        │
│ transport_encrypted     │ BYTEA           │ AES-256 encrypted transport allowance      │
│ food_encrypted          │ BYTEA           │ AES-256 encrypted food allowance           │
│ other_encrypted         │ BYTEA           │ AES-256 encrypted other allowances         │
│ gosi_wages              │ DECIMAL(15,4)   │ Computed GOSI-eligible wages               │
│ created_by              │ INTEGER FK      │ → users.id                                 │
│ updated_by              │ INTEGER FK      │ → users.id (nullable)                      │
│ created_at              │ TIMESTAMPTZ     │ Record creation timestamp                  │
│ updated_at              │ TIMESTAMPTZ     │ Last update timestamp                      │
└─────────────────────────┴─────────────────┴────────────────────────────────────────────┘

Unique Constraint: (version_id, code)
```

**Encryption Note**: Salary fields are encrypted using pgcrypto AES-256 with a key stored in Docker secrets (`/run/secrets/salary_encryption_key`).

#### 2. dhg_requirements

Stores calculated teaching hour requirements derived from enrollment.

```sql
Table: dhg_requirements
┌────────────────────┬─────────────────┬────────────────────────────────────────────┐
│ Column             │ Type            │ Description                                │
├────────────────────┼─────────────────┼────────────────────────────────────────────┤
│ id                 │ SERIAL PK       │ Unique identifier                          │
│ version_id         │ INTEGER FK      │ → budget_versions.id                       │
│ academic_period    │ VARCHAR(3)      │ 'AY1' or 'AY2'                             │
│ grade_level        │ VARCHAR(10)     │ Grade code                                 │
│ headcount          │ INTEGER         │ Student count from enrollment              │
│ max_class_size     │ INTEGER         │ Maximum students per class                 │
│ sections_needed    │ INTEGER         │ Number of class sections required          │
│ total_weekly_hours │ DECIMAL(10,4)   │ Total teaching hours per week              │
│ total_annual_hours │ DECIMAL(10,4)   │ Total teaching hours per year              │
│ fte                │ DECIMAL(7,4)    │ Full-time equivalent teachers needed       │
│ created_at         │ TIMESTAMPTZ     │ Record creation timestamp                  │
│ updated_at         │ TIMESTAMPTZ     │ Last update timestamp                      │
└────────────────────┴─────────────────┴────────────────────────────────────────────┘

Unique Constraint: (version_id, academic_period, grade_level)
```

#### 3. dhg_grille_config

Stores teaching hour allocation configuration by grade and subject.

```sql
Table: dhg_grille_config
┌───────────────────┬─────────────────┬────────────────────────────────────────────┐
│ Column            │ Type            │ Description                                │
├───────────────────┼─────────────────┼────────────────────────────────────────────┤
│ id                │ SERIAL PK       │ Unique identifier                          │
│ version_id        │ INTEGER FK      │ → budget_versions.id (nullable for master) │
│ grade_level       │ VARCHAR(10)     │ Grade code                                 │
│ subject_code      │ VARCHAR(10)     │ Subject code (FR, EN, MATH, etc.)          │
│ hours_per_week    │ DECIMAL(5,4)    │ Teaching hours per week                    │
│ reference_enrollment│ INTEGER       │ Reference student count for calculation    │
│ is_active         │ BOOLEAN         │ Whether this row is active                 │
│ created_at        │ TIMESTAMPTZ     │ Record creation timestamp                  │
│ updated_at        │ TIMESTAMPTZ     │ Last update timestamp                      │
└───────────────────┴─────────────────┴────────────────────────────────────────────┘

Unique Constraint: (version_id, grade_level, subject_code)
```

#### 4. monthly_staff_costs

Stores calculated monthly costs per employee.

```sql
Table: monthly_staff_costs
┌───────────────────┬─────────────────┬────────────────────────────────────────────┐
│ Column            │ Type            │ Description                                │
├───────────────────┼─────────────────┼────────────────────────────────────────────┤
│ id                │ SERIAL PK       │ Unique identifier                          │
│ version_id        │ INTEGER FK      │ → budget_versions.id                       │
│ employee_id       │ INTEGER FK      │ → employees.id                             │
│ fiscal_month      │ INTEGER         │ Month number (1-12)                        │
│ fiscal_year       │ INTEGER         │ Fiscal year                                │
│ base_cost         │ DECIMAL(15,4)   │ Base salary for month                      │
│ housing_cost      │ DECIMAL(15,4)   │ Housing allowance for month                │
│ transport_cost    │ DECIMAL(15,4)   │ Transport allowance for month              │
│ food_cost         │ DECIMAL(15,4)   │ Food allowance for month                   │
│ other_cost        │ DECIMAL(15,4)   │ Other allowances for month                 │
│ gosi_employer     │ DECIMAL(15,4)   │ Employer GOSI contribution                 │
│ gosi_employee     │ DECIMAL(15,4)   │ Employee GOSI contribution                 │
│ eos_accrual       │ DECIMAL(15,4)   │ End of Service accrual                     │
│ is_prorated       │ BOOLEAN         │ True if month is partial (joining/exit)    │
│ proration_factor  │ DECIMAL(5,4)    │ Percentage of month worked                 │
│ created_at        │ TIMESTAMPTZ     │ Record creation timestamp                  │
│ updated_at        │ TIMESTAMPTZ     │ Last update timestamp                      │
└───────────────────┴─────────────────┴────────────────────────────────────────────┘

Unique Constraint: (version_id, employee_id, fiscal_month, fiscal_year)
```

#### 5. category_monthly_costs

Stores aggregated costs by budget category (Tab C format).

```sql
Table: category_monthly_costs
┌───────────────────┬─────────────────┬────────────────────────────────────────────┐
│ Column            │ Type            │ Description                                │
├───────────────────┼─────────────────┼────────────────────────────────────────────┤
│ id                │ SERIAL PK       │ Unique identifier                          │
│ version_id        │ INTEGER FK      │ → budget_versions.id                       │
│ category_code     │ VARCHAR(10)     │ Budget category (6100, 6200, etc.)         │
│ category_name     │ VARCHAR(50)     │ Category description                       │
│ fiscal_month      │ INTEGER         │ Month number (1-12)                        │
│ fiscal_year       │ INTEGER         │ Fiscal year                                │
│ amount            │ DECIMAL(15,4)   │ Cost amount                                │
│ is_calculated     │ BOOLEAN         │ True if from calculation, false if manual  │
│ created_at        │ TIMESTAMPTZ     │ Record creation timestamp                  │
│ updated_at        │ TIMESTAMPTZ     │ Last update timestamp                      │
└───────────────────┴─────────────────┴────────────────────────────────────────────┘

Unique Constraint: (version_id, category_code, fiscal_month, fiscal_year)
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
│ module            │ VARCHAR(20)     │ 'STAFFING', 'REVENUE', etc.                │
│ status            │ VARCHAR(20)     │ 'STARTED', 'COMPLETED', 'FAILED'           │
│ started_at        │ TIMESTAMPTZ     │ Calculation start time                     │
│ completed_at      │ TIMESTAMPTZ     │ Calculation end time                       │
│ duration_ms       │ INTEGER         │ Execution time in milliseconds             │
│ input_summary     │ JSONB           │ Input data summary                         │
│ output_summary    │ JSONB           │ Results summary                            │
│ triggered_by      │ INTEGER FK      │ → users.id                                 │
└───────────────────┴─────────────────┴────────────────────────────────────────────┘
```

#### 7. departments (Master Data)

Reference table for department configuration.

```sql
Table: departments
┌───────────────────┬─────────────────┬────────────────────────────────────────────┐
│ Column            │ Type            │ Description                                │
├───────────────────┼─────────────────┼────────────────────────────────────────────┤
│ id                │ SERIAL PK       │ Unique identifier                          │
│ code              │ VARCHAR(20)     │ Department code                            │
│ name              │ VARCHAR(60)     │ Display name                               │
│ budget_category   │ VARCHAR(10)     │ Default budget category mapping            │
│ is_active         │ BOOLEAN         │ Whether department is active               │
│ display_order     │ INTEGER         │ Sort order for UI display                  │
└───────────────────┴─────────────────┴────────────────────────────────────────────┘
```

#### 8. functions (Master Data)

Reference table for job functions.

```sql
Table: functions
┌───────────────────┬─────────────────┬────────────────────────────────────────────┐
│ Column            │ Type            │ Description                                │
├───────────────────┼─────────────────┼────────────────────────────────────────────┤
│ id                │ SERIAL PK       │ Unique identifier                          │
│ code              │ VARCHAR(20)     │ Function code                              │
│ name              │ VARCHAR(60)     │ Display name                               │
│ gosi_eligible     │ BOOLEAN         │ Whether subject to GOSI                    │
│ eos_eligible      │ BOOLEAN         │ Whether entitled to EOS                    │
│ is_teaching       │ BOOLEAN         │ Whether DHG-eligible function              │
│ is_active         │ BOOLEAN         │ Whether function is active                 │
└───────────────────┴─────────────────┴────────────────────────────────────────────┘
```

---

## API Endpoints

### Employee APIs

| Method | Endpoint                                          | Description          | Auth | Role                       |
| ------ | ------------------------------------------------- | -------------------- | ---- | -------------------------- |
| GET    | `/versions/{versionId}/staffing/employees`        | List all employees   | JWT  | Any                        |
| GET    | `/versions/{versionId}/staffing/employees/{id}`   | Get employee details | JWT  | Any                        |
| POST   | `/versions/{versionId}/staffing/employees`        | Create new employee  | JWT  | Admin, BudgetOwner, Editor |
| PUT    | `/versions/{versionId}/staffing/employees/{id}`   | Update employee      | JWT  | Admin, BudgetOwner, Editor |
| DELETE | `/versions/{versionId}/staffing/employees/{id}`   | Delete employee      | JWT  | Admin, BudgetOwner, Editor |
| POST   | `/versions/{versionId}/staffing/employees/import` | Import from Excel    | JWT  | Admin, BudgetOwner         |

**POST Request Body** (Create Employee):

```json
{
    "code": "EMP001",
    "name": "Ahmed Al-Saud",
    "functionId": 5,
    "departmentId": 3,
    "status": "Active",
    "joiningDate": "2023-09-01",
    "baseSalary": 8500.0,
    "housing": 3200.0,
    "transport": 500.0,
    "food": 300.0,
    "other": 0
}
```

**POST Response**:

```json
{
    "id": 123,
    "code": "EMP001",
    "name": "Ahmed Al-Saud",
    "function": "Teacher",
    "department": "ELEMENTAIRE",
    "status": "Active",
    "joiningDate": "2023-09-01",
    "totalMonthlyCost": 13540.0,
    "staleModules": ["STAFFING", "PNL"]
}
```

---

### DHG APIs

| Method | Endpoint                                    | Description           | Auth | Role                       |
| ------ | ------------------------------------------- | --------------------- | ---- | -------------------------- |
| GET    | `/versions/{versionId}/staffing/dhg`        | Get DHG requirements  | JWT  | Any                        |
| GET    | `/versions/{versionId}/staffing/dhg-grille` | Get DHG grille config | JWT  | Any                        |
| PUT    | `/versions/{versionId}/staffing/dhg-grille` | Update DHG grille     | JWT  | Admin, BudgetOwner, Editor |

**GET DHG Response**:

```json
{
    "requirements": [
        {
            "gradeLevel": "PS",
            "academicPeriod": "AY1",
            "headcount": 42,
            "sectionsNeeded": 3,
            "totalWeeklyHours": 45.0,
            "totalAnnualHours": 1620.0,
            "fte": 1.29
        }
    ],
    "totals": {
        "totalWeeklyHours": 1245.5,
        "totalAnnualHours": 44838.0,
        "totalFte": 35.6
    }
}
```

---

### Cost APIs

| Method | Endpoint                                             | Description              | Auth | Role |
| ------ | ---------------------------------------------------- | ------------------------ | ---- | ---- |
| GET    | `/versions/{versionId}/staffing/costs`               | Get monthly cost summary | JWT  | Any  |
| GET    | `/versions/{versionId}/staffing/costs/by-department` | Get costs by department  | JWT  | Any  |
| GET    | `/versions/{versionId}/staffing/costs/by-category`   | Get Tab C budget view    | JWT  | Any  |

**GET Costs Response**:

```json
{
    "monthlyCosts": [
        {
            "month": 1,
            "year": 2025,
            "monthName": "January 2025",
            "salaries": 1228750.0,
            "gosi": 147450.0,
            "eos": 102395.0,
            "ajeer": 28500.0,
            "total": 1507095.0
        }
    ],
    "annualTotals": {
        "salaries": 15456000.0,
        "gosi": 1854720.0,
        "eos": 1286400.0,
        "ajeer": 350000.0,
        "total": 18947120.0
    }
}
```

---

### Calculation APIs

| Method | Endpoint                                   | Description       | Auth | Role                       |
| ------ | ------------------------------------------ | ----------------- | ---- | -------------------------- |
| POST   | `/versions/{versionId}/calculate/staffing` | Run staffing calc | JWT  | Admin, BudgetOwner, Editor |

**Response**:

```json
{
    "runId": "550e8400-e29b-41d4-a716-446655440000",
    "durationMs": 892,
    "summary": {
        "totalEmployees": 89,
        "activeEmployees": 87,
        "totalAnnualCost": 18947120.0,
        "totalGosi": 1854720.0,
        "totalEos": 1286400.0,
        "dhgFteRequired": 35.6
    },
    "results": {
        "monthlyCostsUpdated": 1068,
        "departmentCostsUpdated": 6,
        "categoryCostsUpdated": 5
    }
}
```

---

## TypeScript Types

### Core Types (`packages/types/src/staffing.ts`)

```typescript
// Employment status
export type EmployeeStatus = 'Active' | 'Pending' | 'Inactive';

// Salary components
export interface SalaryComponents {
    base: number;
    housing: number;
    transport: number;
    food: number;
    other: number;
}

// Employee entity
export interface Employee {
    id: number;
    versionId: number;
    code: string;
    name: string;
    functionId: number;
    functionName: string;
    departmentId: number;
    departmentName: string;
    status: EmployeeStatus;
    joiningDate: string; // ISO date
    terminationDate?: string; // ISO date
    salary: SalaryComponents;
    gosiWages: number;
    createdAt: string;
    updatedAt: string;
}

// Employee with computed costs
export interface EmployeeWithCosts extends Employee {
    totalMonthlyCost: number;
    gosiEmployer: number;
    gosiEmployee: number;
    eosAccrual: number;
}

// DHG Requirement
export interface DhgRequirement {
    gradeLevel: GradeCode;
    academicPeriod: AcademicPeriod;
    headcount: number;
    maxClassSize: number;
    sectionsNeeded: number;
    totalWeeklyHours: number;
    totalAnnualHours: number;
    fte: number;
}

// DHG Grille entry
export interface DhgGrilleEntry {
    gradeLevel: GradeCode;
    subjectCode: string;
    subjectName: string;
    hoursPerWeek: number;
    referenceEnrollment: number;
}

// Monthly cost entry
export interface MonthlyCostEntry {
    month: number;
    year: number;
    monthName: string;
    salaries: number;
    gosi: number;
    eos: number;
    ajeer: number;
    total: number;
}

// Department cost entry
export interface DepartmentCostEntry {
    departmentId: number;
    departmentName: string;
    departmentCode: string;
    headcount: number;
    baseTotal: number;
    allowancesTotal: number;
    gosiTotal: number;
    totalMonthly: number;
}

// Category cost entry (Tab C)
export interface CategoryCostEntry {
    categoryCode: string;
    categoryName: string;
    month: number;
    year: number;
    amount: number;
    isCalculated: boolean;
}

// Staffing KPI data
export interface StaffingKpiData {
    totalHeadcount: number;
    activeHeadcount: number;
    totalAnnualCost: number;
    averageMonthlyCost: number;
    totalGosi: number;
    totalAjeer: number;
    totalEos: number;
    dhgFteRequired: number;
    isStale: boolean;
}

// Employee import row
export interface EmployeeImportRow {
    code: string;
    name: string;
    function: string;
    department: string;
    status: EmployeeStatus;
    joiningDate: string;
    baseSalary: number;
    housing: number;
    transport: number;
    food: number;
    other: number;
}

// Import validation result
export interface ImportValidationResult {
    totalRows: number;
    validRows: number;
    errors: Array<{
        row: number;
        field: string;
        message: string;
    }>;
    preview: EmployeeImportRow[];
}
```

---

## Calculation Engine

### Staffing Cost Calculation Logic

```typescript
// 1. Calculate GOSI-eligible wages
function calculateGosiWages(salary: SalaryComponents): Decimal {
    return new Decimal(salary.base).plus(salary.housing).plus(salary.transport).plus(salary.food);
}

// 2. Calculate GOSI employer contribution (12%)
function calculateGosiEmployer(gosiWages: Decimal): Decimal {
    return gosiWages.times(0.12);
}

// 3. Calculate monthly cost (full month)
function calculateMonthlyCost(salary: SalaryComponents, gosiWages: Decimal): Decimal {
    const gosiEmployer = calculateGosiEmployer(gosiWages);
    return new Decimal(salary.base)
        .plus(salary.housing)
        .plus(salary.transport)
        .plus(salary.food)
        .plus(salary.other)
        .plus(gosiEmployer);
}

// 4. Calculate proration factor for joining/termination
function calculateProrationFactor(
    joiningDate: Date,
    terminationDate: Date | null,
    monthStart: Date,
    monthEnd: Date
): Decimal {
    const effectiveStart = joiningDate > monthStart ? joiningDate : monthStart;
    const effectiveEnd = terminationDate && terminationDate < monthEnd ? terminationDate : monthEnd;

    const daysWorked = differenceInDays(effectiveEnd, effectiveStart) + 1;
    const daysInMonth = differenceInDays(monthEnd, monthStart) + 1;

    return new Decimal(daysWorked).dividedBy(daysInMonth);
}

// 5. Calculate EOS accrual using YEARFRAC US 30/360
function calculateEosAccrual(
    joiningDate: Date,
    calculationDate: Date,
    totalMonthlySalary: Decimal
): Decimal {
    // YEARFRAC(start, end, 0) - US 30/360 convention
    const yearFrac = calculateYearFracUS30360(joiningDate, calculationDate);

    // EOS = half-month salary per year of service
    const yearsOfService = Math.floor(yearFrac);
    const monthlySalaryForEos = totalMonthlySalary.times(0.5);

    return monthlySalaryForEos.times(yearsOfService);
}
```

### YEARFRAC US 30/360 Implementation

```typescript
/**
 * Calculate YEARFRAC using US 30/360 day-count convention.
 * Must match Excel's YEARFRAC(start, end, 0) exactly.
 *
 * US 30/360 rules:
 * - If start date is last day of month, change to 30th
 * - If end date is last day of month and start date is 30th or 31st, change to 30th
 * - Days = (endYear - startYear) × 360 + (endMonth - startMonth) × 30 + (endDay - startDay)
 * - YEARFRAC = Days / 360
 */
function calculateYearFracUS30360(startDate: Date, endDate: Date): number {
    let startDay = startDate.getDate();
    let startMonth = startDate.getMonth() + 1;
    let startYear = startDate.getFullYear();

    let endDay = endDate.getDate();
    let endMonth = endDate.getMonth() + 1;
    let endYear = endDate.getFullYear();

    // US 30/360 adjustments
    const startIsLastDayOfMonth = startDay === new Date(startYear, startMonth, 0).getDate();
    const endIsLastDayOfMonth = endDay === new Date(endYear, endMonth, 0).getDate();

    if (startIsLastDayOfMonth) {
        startDay = 30;
    }

    if (endIsLastDayOfMonth && startDay >= 30) {
        endDay = 30;
    }

    if (startDay === 31) {
        startDay = 30;
    }

    if (endDay === 31 && startDay >= 30) {
        endDay = 30;
    }

    const days = (endYear - startYear) * 360 + (endMonth - startMonth) * 30 + (endDay - startDay);

    return days / 360;
}
```

### DHG Calculation Logic

```typescript
// 1. Calculate sections needed
sectionsNeeded = ceil(headcount / maxClassSize);

// 2. Calculate total weekly hours per grade
for each subject in dhgGrilleConfig:
  if subject.hoursPerWeek > 0:
    weeklyHours += sectionsNeeded × subject.hoursPerWeek;

// 3. Calculate annual hours (36 instructional weeks)
annualHours = weeklyHours × 36;

// 4. Calculate FTE (based on 35-hour work week)
fte = weeklyHours / 35;
```

### Category Mapping (Tab C)

| Cost Component       | Budget Category | Category Name                              |
| -------------------- | --------------- | ------------------------------------------ |
| Base salaries        | 6100            | Salaires et traitements                    |
| Housing allowances   | 6100            | Salaires et traitements                    |
| Transport allowances | 6100            | Salaires et traitements                    |
| Food allowances      | 6100            | Salaires et traitements                    |
| Other allowances     | 6100            | Salaires et traitements                    |
| GOSI Employer        | 6200            | Charges sociales                           |
| EOS Accrual          | 6300            | Provision pour indemnité de fin de contrat |
| Ajeer (contract)     | 6100            | Salaires et traitements                    |
| Recruitment costs    | 6400            | Recrutement                                |
| Training costs       | 6500            | Formation                                  |

---

## Audit Trail

### Operations Logged

| Operation               | Table                 | Data Captured                   |
| ----------------------- | --------------------- | ------------------------------- |
| EMPLOYEE_CREATED        | employees             | All fields (salaries encrypted) |
| EMPLOYEE_UPDATED        | employees             | Changed fields, old/new values  |
| EMPLOYEE_DELETED        | employees             | Employee ID, code, name         |
| DHG_GRILLE_UPDATED      | dhg_grille_config     | Grade, subject, old/new hours   |
| STAFFING_CALC_STARTED   | calculation_audit_log | Run ID, inputs                  |
| STAFFING_CALC_COMPLETED | calculation_audit_log | Duration, outputs               |
| EMPLOYEES_IMPORTED      | employees             | Import batch summary            |

### Audit Entry Schema

```typescript
{
  userId: number;
  userEmail: string;
  operation: string;
  tableName: string;
  recordId: number;
  ipAddress: string;
  oldValues?: Json;      // For updates (salary values masked)
  newValues: Json;       // New/updated data (salary values masked)
  createdAt: Date;
}
```

**Security Note**: Salary values in audit logs are masked (shown as `[ENCRYPTED]`) to prevent exposure in plaintext logs.

---

## Error Handling

### Common Error Codes

| Code                     | HTTP Status | Description                          | User Action                         |
| ------------------------ | ----------- | ------------------------------------ | ----------------------------------- |
| VERSION_NOT_FOUND        | 404         | Budget version does not exist        | Select valid version                |
| VERSION_LOCKED           | 409         | Version is Published/Locked/Archived | Create new version or unlock        |
| EMPLOYEE_NOT_FOUND       | 404         | Employee ID does not exist           | Check employee code                 |
| DUPLICATE_EMPLOYEE_CODE  | 409         | Employee code already exists         | Use unique code                     |
| INVALID_FUNCTION         | 422         | Function ID not recognized           | Check function list                 |
| INVALID_DEPARTMENT       | 422         | Department ID not recognized         | Check department list               |
| NEGATIVE_SALARY          | 422         | Salary value is negative             | Enter non-negative amount           |
| INVALID_JOINING_DATE     | 422         | Date format invalid                  | Use YYYY-MM-DD format               |
| IMPORT_VALIDATION_FAILED | 422         | Excel validation errors              | Review error details, fix and retry |
| ENCRYPTION_ERROR         | 500         | Salary encryption failed             | Contact administrator               |
| UNAUTHORIZED             | 401         | User not authenticated               | Log in                              |
| FORBIDDEN                | 403         | User lacks required role             | Contact administrator               |

---

## Improvements Required

This section documents known issues, technical debt, and proposed enhancements for the Staffing module.

### High Priority

| ID      | Issue                          | Impact                                      | Proposed Solution                                  |
| ------- | ------------------------------ | ------------------------------------------- | -------------------------------------------------- |
| STF-001 | **No bulk edit for employees** | Users must edit employees one-by-one        | Add multi-select with bulk update dialog           |
| STF-002 | **No salary history tracking** | Cannot see salary progression over time     | Add salary_history table with effective dates      |
| STF-003 | **Limited import validation**  | No data type checking for salary fields     | Add schema validation with detailed error messages |
| STF-004 | **No employee search/filter**  | Difficult to find employees in large roster | Add global search and advanced filters             |

### Medium Priority

| ID      | Issue                              | Impact                                  | Proposed Solution                              |
| ------- | ---------------------------------- | --------------------------------------- | ---------------------------------------------- |
| STF-005 | **No real-time collaboration**     | Multiple users can overwrite each other | Implement optimistic locking or real-time sync |
| STF-006 | **No org chart view**              | Cannot visualize reporting structure    | Add hierarchical department/function view      |
| STF-007 | **Limited export options**         | Cannot export specific views            | Add "Export Current View" with filters         |
| STF-008 | **No budget vs actual comparison** | Cannot compare planned vs actual costs  | Add variance analysis dashboard                |

### Low Priority / Technical Debt

| ID      | Issue                              | Impact                           | Proposed Solution                              |
| ------- | ---------------------------------- | -------------------------------- | ---------------------------------------------- |
| STF-009 | **Sequential database operations** | N+1 query pattern in calculation | Consider batch operations or stored procedures |
| STF-010 | **Hardcoded category mappings**    | Tab C categories in code         | Move to configuration table                    |
| STF-011 | **No unit tests for YEARFRAC**     | Edge case calculation errors     | Add comprehensive test coverage matching Excel |
| STF-012 | **Client-side salary encryption**  | Potential exposure in transit    | Move encryption to server-side with TLS        |

### Feature Requests

| ID      | Feature                          | Business Value                          | Complexity |
| ------- | -------------------------------- | --------------------------------------- | ---------- |
| STF-F01 | **Contract management**          | Track contract expiry and renewals      | Medium     |
| STF-F02 | **Leave management integration** | Factor leave costs in projections       | High       |
| STF-F03 | **Performance bonus modeling**   | Include variable compensation           | Medium     |
| STF-F04 | **Recruitment pipeline**         | Track open positions and candidates     | High       |
| STF-F05 | **Skills matrix**                | Track qualifications and certifications | Low        |

---

## Appendix A: Salary Structure Examples

### Example 1: Teaching Staff

```
Employee: EMP001 - Ahmed Al-Saud
Function: Classroom Teacher
Department: ELEMENTAIRE

Salary Components:
- Base Salary:     8,500 SAR
- Housing:         3,200 SAR
- Transport:         500 SAR
- Food:              300 SAR
- Other:               0 SAR
─────────────────────────────────
GOSI Wages:       12,500 SAR
GOSI Employer:     1,500 SAR (12%)
─────────────────────────────────
Total Monthly:    14,300 SAR
Total Annual:    171,600 SAR
```

### Example 2: Administrative Staff

```
Employee: EMP002 - Sarah Johnson
Function: Academic Coordinator
Department: ADMIN

Salary Components:
- Base Salary:    12,000 SAR
- Housing:             0 SAR (company accommodation)
- Transport:         800 SAR
- Food:                0 SAR
- Other:             500 SAR (phone allowance)
─────────────────────────────────
GOSI Wages:       12,800 SAR
GOSI Employer:     1,536 SAR (12%)
─────────────────────────────────
Total Monthly:    14,836 SAR
Total Annual:    178,032 SAR
```

---

## Appendix B: Stale Module Cascade

When staffing data changes, the following modules become stale:

```
┌─────────────────────────────────────────────────────────────┐
│  STAFFING (user changes employee data)                       │
│        │                                                     │
│        ▼                                                     │
│  ┌─────────────┐                                             │
│  │     PNL     │                                             │
│  │  (profit)   │                                             │
│  └─────────────┘                                             │
└─────────────────────────────────────────────────────────────┘
```

Users must run calculations in the Staffing module to clear stale flags before P&L calculations can be considered current.

---

## Appendix C: DHG Subject Codes

| Code | Subject Name        | Notes                 |
| ---- | ------------------- | --------------------- |
| FR   | Français            | French language       |
| EN   | English             | English language      |
| MATH | Mathématiques       | Mathematics           |
| SCI  | Sciences            | General science       |
| HG   | Histoire-Géographie | History and geography |
| ART  | Arts                | Art and music         |
| EPS  | EPS                 | Physical education    |
| ISL  | Islamique           | Islamic studies       |
| ARA  | Arabe               | Arabic language       |

---

## Document History

| Version | Date       | Author       | Changes                   |
| ------- | ---------- | ------------ | ------------------------- |
| 1.0     | 2026-03-10 | AI Assistant | Initial document creation |

---

_End of Document_
