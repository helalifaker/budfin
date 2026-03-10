# Dashboard Page — Process Workflow

> **Document Purpose**: This document provides a comprehensive, plain-language guide to the Budget Planning Dashboard page. It explains the business process, technical implementation, user actions, and data flow. It serves as a reference for auditors, new developers, and business analysts to understand and propose improvements.

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

| Attribute            | Value                                                                                                           |
| -------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Page Name**        | Budget Planning Dashboard                                                                                       |
| **URL Route**        | `/planning/dashboard`                                                                                           |
| **Module**           | Epic 1 — Budget Planning Overview                                                                               |
| **Page File**        | `apps/web/src/pages/planning/dashboard.tsx`                                                                     |
| **Primary Function** | Provide a high-level overview of key budget metrics including enrollment, revenue, staff costs, and net results |

### What This Page Does

The Budget Planning Dashboard serves as the **landing page** for budget planning activities. It provides users with:

1. **Key Performance Indicators (KPIs)** — At-a-glance metrics for critical budget dimensions:
    - Total student enrollment count
    - Total projected revenue (SAR)
    - Total staff costs (SAR)
    - Net budget result (SAR)

2. **Visual Analytics** — Charts for trend analysis and comparisons:
    - Revenue vs Budget comparison chart
    - Enrollment distribution by grade band
    - Monthly trend visualization

3. **Navigation Hub** — Entry point to detailed planning modules (Enrollment, Revenue, DHG, Staffing, P&L)

**Current Implementation Status**: This page is currently a **placeholder/skeleton** with zero values displayed. The component structure and layout are implemented, but data integration and chart implementations are pending backend API development.

---

## Business Context

### Dashboard Metrics Overview

The dashboard aggregates data from across the budget planning system to provide executive-level visibility:

| Metric             | Source Module         | Description                                                    |
| ------------------ | --------------------- | -------------------------------------------------------------- |
| **Total Students** | Enrollment & Capacity | Sum of AY1 and AY2 projected headcounts across all grades      |
| **Total Revenue**  | Revenue Planning      | Sum of tuition fees, registration fees, and other income       |
| **Staff Costs**    | Staff Planning        | Sum of salaries, benefits, and End-of-Service provisions       |
| **Net Result**     | P&L Module            | Total Revenue minus Total Expenses (Staff Costs + Other Costs) |

### Academic Periods Context

Dashboard metrics span the complete academic year:

| Period     | Months               | Data Inclusion                             |
| ---------- | -------------------- | ------------------------------------------ |
| **AY1**    | January – June       | First half enrollment and revenue          |
| **Summer** | July – August        | Minimal operations, summer program revenue |
| **AY2**    | September – December | Second half enrollment and revenue         |

### Currency

All monetary values are displayed in **Saudi Riyal (SAR)** with thousands separators for readability.

---

## User Roles & Permissions

| Role            | View Dashboard | Drill Down | Export Data | Refresh Data |
| --------------- | -------------- | ---------- | ----------- | ------------ |
| **Admin**       | ✅             | ✅         | ✅          | ✅           |
| **BudgetOwner** | ✅             | ✅         | ✅          | ✅           |
| **Editor**      | ✅             | ✅         | ❌          | ❌           |
| **Viewer**      | ✅             | ❌         | ❌          | ❌           |

**Version Lock Rule**: Dashboard data reflects the current Budget Version state. All users can view data regardless of version status (Draft, Published, Locked, Archived).

---

## Pre-Conditions

Before using this page, the following must be configured:

### Required Budget Setup

1. **Budget Version** must be created and selected in the workspace context bar
2. **Fiscal Year** context must be set
3. **Enrollment data** should be calculated for meaningful metrics (otherwise displays zeros)

### Data Dependencies

For dashboard to display meaningful data (not zeros):

| Module     | Data Required                   | Status                      |
| ---------- | ------------------------------- | --------------------------- |
| Enrollment | Calculated headcounts by grade  | Required for Student count  |
| Revenue    | Fee grid and enrollment data    | Required for Revenue metric |
| Staffing   | Position calculations           | Required for Staff Costs    |
| P&L        | Revenue and expense aggregation | Required for Net Result     |

---

## Page Layout & UI Elements

### Header Section

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Budget Planning Dashboard                                                  │
│  Overview and summary of key metrics                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  📊 KPI Cards Row (4-column grid)                                           │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │ Total        │ │ Total        │ │ Staff        │ │ Net          │       │
│  │ Students     │ │ Revenue      │ │ Costs        │ │ Result       │       │
│  │ 👤           │ │ 💰           │ │ 💼           │ │ 📈           │       │
│  │ 0            │ │ SAR 0        │ │ SAR 0        │ │ SAR 0        │       │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### KPI Cards

| Card               | Icon            | Value Format                 | Color Accent    |
| ------------------ | --------------- | ---------------------------- | --------------- |
| **Total Students** | Users (👤)      | Plain number (e.g., 245)     | Teal top border |
| **Total Revenue**  | DollarSign (💰) | SAR with thousands separator | Teal top border |
| **Staff Costs**    | Briefcase (💼)  | SAR with thousands separator | Teal top border |
| **Net Result**     | TrendingUp (📈) | SAR with thousands separator | Teal top border |

**Card Features**:

- Animated counter for value display
- Hover effect with subtle shadow and lift
- Teal accent bar at top of each card
- Optional trend indicator (planned for future)

### Charts Section

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  📈 Charts Row (2-column grid)                                              │
│  ┌────────────────────────────┐ ┌────────────────────────────┐             │
│  │ Revenue vs Budget          │ │ Enrollment by Band         │             │
│  │ [Chart placeholder]        │ │ [Chart placeholder]        │             │
│  └────────────────────────────┘ └────────────────────────────┘             │
├─────────────────────────────────────────────────────────────────────────────┤
│  📉 Monthly Trend                                                           │
│  ┌────────────────────────────────────────────────────────┐                │
│  │ [Full-width chart placeholder]                         │                │
│  └────────────────────────────────────────────────────────┘                │
└─────────────────────────────────────────────────────────────────────────────┘
```

| Chart                  | Type                  | Data Source             | Status              |
| ---------------------- | --------------------- | ----------------------- | ------------------- |
| **Revenue vs Budget**  | Bar/Column comparison | Revenue module          | Not yet implemented |
| **Enrollment by Band** | Pie/Doughnut or Bar   | Enrollment module       | Not yet implemented |
| **Monthly Trend**      | Line chart            | Aggregated monthly data | Not yet implemented |

### Animation System

The dashboard uses staggered reveal animations:

| Element                     | Animation      | Delay        |
| --------------------------- | -------------- | ------------ |
| KPI Card 1 (Total Students) | Stagger reveal | 0ms          |
| KPI Card 2 (Total Revenue)  | Stagger reveal | 50ms         |
| KPI Card 3 (Staff Costs)    | Stagger reveal | 100ms        |
| KPI Card 4 (Net Result)     | Stagger reveal | 150ms        |
| Charts Row                  | Stagger reveal | 200ms, 250ms |
| Monthly Trend               | Stagger reveal | 300ms        |

---

## Step-by-Step Workflow

### Workflow 1: View Dashboard Overview

**Actor**: Any authenticated user

| Step | Action                                 | UI Element               | Result                                    |
| ---- | -------------------------------------- | ------------------------ | ----------------------------------------- |
| 1    | Select Budget Version from context bar | Dropdown                 | Version loaded                            |
| 2    | Navigate to Dashboard page             | Sidebar menu → Dashboard | Page loads with animations                |
| 3    | Review KPI Cards                       | 4-card grid              | Current metrics displayed                 |
| 4    | Review Charts section                  | Chart cards below        | Visual representations (when implemented) |

**Expected Behavior**:

- All KPI values show zero (placeholder state)
- Charts display "Chart data not available" placeholder
- Animations play sequentially on page load

---

### Workflow 2: Navigate to Detail Modules

**Actor**: Admin, BudgetOwner, Editor, Viewer

| Step | Action                                 | UI Element | Navigation Target      |
| ---- | -------------------------------------- | ---------- | ---------------------- |
| 1    | Click Enrollment & Capacity in sidebar | Menu item  | `/planning/enrollment` |
| 2    | Click Revenue in sidebar               | Menu item  | `/planning/revenue`    |
| 3    | Click DHG in sidebar                   | Menu item  | `/planning/dhg`        |
| 4    | Click Staffing in sidebar              | Menu item  | `/planning/staffing`   |
| 5    | Click P&L in sidebar                   | Menu item  | `/planning/pnl`        |

---

### Workflow 3: Refresh Dashboard Data (Future)

**Actor**: Admin, BudgetOwner

| Step | Action                 | UI Element        | API Call                 | Result                         |
| ---- | ---------------------- | ----------------- | ------------------------ | ------------------------------ |
| 1    | Click "Refresh" button | Button            | `GET /dashboard/summary` | Latest data fetched            |
| 2    | Observe KPI updates    | Animated counters | -                        | Values animate to new numbers  |
| 3    | Review updated charts  | Chart components  | -                        | Charts re-render with new data |

---

## Data Models & Database Schema

### Core Tables (Future Implementation)

#### 1. dashboard_summary

> **Status**: Not yet implemented — Future enhancement

Stores pre-computed dashboard metrics for fast loading.

```sql
Table: dashboard_summary (PROPOSED)
┌───────────────────┬─────────────────┬────────────────────────────────────────────┐
│ Column            │ Type            │ Description                                │
├───────────────────┼─────────────────┼────────────────────────────────────────────┤
│ id                │ SERIAL PK       │ Unique identifier                          │
│ version_id        │ INTEGER FK      │ → budget_versions.id                       │
│ total_students    │ INTEGER         │ Sum of AY1 and AY2 headcounts              │
│ total_revenue     │ DECIMAL(15,4)   │ Total projected revenue (SAR)              │
│ staff_costs       │ DECIMAL(15,4)   │ Total staff costs (SAR)                    │
│ other_costs       │ DECIMAL(15,4)   │ Other operational expenses (SAR)           │
│ net_result        │ DECIMAL(15,4)   │ Revenue - Total Costs (SAR)                │
│ calculated_at     │ TIMESTAMPTZ     │ Last calculation timestamp                 │
│ is_stale          │ BOOLEAN         │ True if source data has changed            │
└───────────────────┴─────────────────┴────────────────────────────────────────────┘

Unique Constraint: (version_id)
```

#### 2. dashboard_trends

> **Status**: Not yet implemented — Future enhancement

Stores time-series data for trend charts.

```sql
Table: dashboard_trends (PROPOSED)
┌───────────────────┬─────────────────┬────────────────────────────────────────────┐
│ Column            │ Type            │ Description                                │
├───────────────────┼─────────────────┼────────────────────────────────────────────┤
│ id                │ SERIAL PK       │ Unique identifier                          │
│ version_id        │ INTEGER FK      │ → budget_versions.id                       │
│ metric_type       │ VARCHAR(20)     │ 'revenue', 'enrollment', 'costs'           │
│ period_month      │ DATE            │ Month (YYYY-MM-01)                         │
│ actual_value      │ DECIMAL(15,4)   │ Historical actual (for completed months)   │
│ budget_value      │ DECIMAL(15,4)   │ Budget projection                          │
│ variance          │ DECIMAL(15,4)   │ Actual - Budget                            │
└───────────────────┴─────────────────┴────────────────────────────────────────────┘

Unique Constraint: (version_id, metric_type, period_month)
```

#### 3. dashboard_enrollment_by_band

> **Status**: Not yet implemented — Future enhancement

Stores enrollment breakdown by grade band for chart display.

```sql
Table: dashboard_enrollment_by_band (PROPOSED)
┌───────────────────┬─────────────────┬────────────────────────────────────────────┐
│ Column            │ Type            │ Description                                │
├───────────────────┼─────────────────┼────────────────────────────────────────────┤
│ id                │ SERIAL PK       │ Unique identifier                          │
│ version_id        │ INTEGER FK      │ → budget_versions.id                       │
│ band              │ VARCHAR(20)     │ 'MATERNELLE', 'ELEMENTAIRE', etc.          │
│ ay1_headcount     │ INTEGER         │ AY1 student count                          │
│ ay2_headcount     │ INTEGER         │ AY2 student count                          │
│ percentage        │ DECIMAL(5,2)    │ % of total enrollment                      │
└───────────────────┴─────────────────┴────────────────────────────────────────────┘

Unique Constraint: (version_id, band)
```

### Source Data Tables

Dashboard metrics are derived from the following existing tables:

| Table                  | Module     | Metric Derived |
| ---------------------- | ---------- | -------------- |
| `enrollment_headcount` | Enrollment | Total Students |
| `revenue_calculation`  | Revenue    | Total Revenue  |
| `staff_positions`      | Staffing   | Staff Costs    |
| `pnl_summary`          | P&L        | Net Result     |

---

## API Endpoints

### Dashboard Summary APIs

> **Status**: Not yet implemented — Future enhancement

| Method | Endpoint                                             | Description         | Auth | Role               |
| ------ | ---------------------------------------------------- | ------------------- | ---- | ------------------ |
| GET    | `/versions/{versionId}/dashboard/summary`            | Get dashboard KPIs  | JWT  | Any                |
| GET    | `/versions/{versionId}/dashboard/trends`             | Get trend data      | JWT  | Any                |
| GET    | `/versions/{versionId}/dashboard/enrollment-by-band` | Get band breakdown  | JWT  | Any                |
| POST   | `/versions/{versionId}/dashboard/refresh`            | Recalculate summary | JWT  | Admin, BudgetOwner |

**Proposed GET /dashboard/summary Response**:

```json
{
    "versionId": 123,
    "fiscalYear": 2026,
    "metrics": {
        "totalStudents": {
            "value": 483,
            "ay1": 245,
            "ay2": 238,
            "trend": { "value": 5.2, "label": "vs last year" }
        },
        "totalRevenue": {
            "value": 12500000.0,
            "formatted": "SAR 12,500,000",
            "currency": "SAR"
        },
        "staffCosts": {
            "value": 8750000.0,
            "formatted": "SAR 8,750,000",
            "currency": "SAR"
        },
        "netResult": {
            "value": 2500000.0,
            "formatted": "SAR 2,500,000",
            "currency": "SAR",
            "margin": 20.0
        }
    },
    "isStale": false,
    "calculatedAt": "2026-03-10T08:30:00Z"
}
```

**Proposed GET /dashboard/trends Response**:

```json
{
    "revenue": [
        { "month": "2026-01", "budget": 2500000, "actual": null },
        { "month": "2026-02", "budget": 2100000, "actual": null },
        { "month": "2026-03", "budget": 2200000, "actual": null }
    ],
    "enrollment": [
        { "month": "2026-01", "ay1": 245, "ay2": 0 },
        { "month": "2026-09", "ay1": 0, "ay2": 238 }
    ]
}
```

---

## TypeScript Types

### Dashboard Types (Proposed)

> **Location**: `packages/types/src/dashboard.ts` (Not yet created)

```typescript
// Dashboard metric with optional trend
export interface DashboardMetric {
    value: number;
    formatted?: string;
    currency?: 'SAR' | 'USD' | 'EUR';
    trend?: {
        value: number;
        label: string;
    };
}

// Complete dashboard summary
export interface DashboardSummary {
    versionId: number;
    fiscalYear: number;
    metrics: {
        totalStudents: DashboardMetric & { ay1: number; ay2: number };
        totalRevenue: DashboardMetric;
        staffCosts: DashboardMetric;
        netResult: DashboardMetric & { margin?: number };
    };
    isStale: boolean;
    calculatedAt: string; // ISO 8601 timestamp
}

// Trend data point
export interface TrendDataPoint {
    month: string; // YYYY-MM format
    budget: number;
    actual?: number; // null for future months
}

// Trend series
export interface TrendSeries {
    revenue: TrendDataPoint[];
    enrollment: Array<{
        month: string;
        ay1: number;
        ay2: number;
    }>;
}

// Enrollment by band for charts
export interface EnrollmentByBand {
    band: 'MATERNELLE' | 'ELEMENTAIRE' | 'COLLEGE' | 'LYCEE';
    bandLabel: string;
    ay1Headcount: number;
    ay2Headcount: number;
    percentage: number;
}

// Chart data response
export interface DashboardChartData {
    enrollmentByBand: EnrollmentByBand[];
    revenueVsBudget: Array<{
        category: string;
        budget: number;
        projected: number;
        variance: number;
    }>;
}
```

### Component Props Types

**Existing**: `apps/web/src/components/dashboard/kpi-card.tsx`

```typescript
interface KpiCardProps {
    title: string;
    value: number;
    formatter?: ((value: number) => string) | undefined;
    icon: LucideIcon;
    trend?: { value: number; label: string };
    className?: string;
}
```

**Existing**: `apps/web/src/components/dashboard/chart-card.tsx`

```typescript
interface ChartCardProps {
    title: string;
    children?: ReactNode;
    className?: string;
}
```

---

## Calculation Engine

### Dashboard Summary Calculations (Proposed)

> **Status**: Not yet implemented — Future enhancement

```typescript
// Total Students calculation
function calculateTotalStudents(enrollmentData: EnrollmentData): number {
    const ay1Total = sum(enrollmentData.ay1.map((e) => e.headcount));
    const ay2Total = sum(enrollmentData.ay2.map((e) => e.headcount));
    return ay1Total + ay2Total;
}

// Total Revenue calculation
function calculateTotalRevenue(revenueData: RevenueData): Decimal {
    return revenueData.fees.reduce((sum, fee) => sum.plus(fee.projectedAmount), new Decimal(0));
}

// Staff Costs calculation
function calculateStaffCosts(staffData: StaffData): Decimal {
    const salaries = staffData.positions.reduce(
        (sum, pos) => sum.plus(pos.annualSalary),
        new Decimal(0)
    );
    const benefits = staffData.positions.reduce(
        (sum, pos) => sum.plus(pos.benefitsAmount),
        new Decimal(0)
    );
    const eosProvisions = staffData.positions.reduce(
        (sum, pos) => sum.plus(pos.eosProvision),
        new Decimal(0)
    );
    return salaries.plus(benefits).plus(eosProvisions);
}

// Net Result calculation
function calculateNetResult(revenue: Decimal, costs: Decimal): Decimal {
    return revenue.minus(costs);
}
```

### Stale Detection

Dashboard data becomes stale when underlying modules are recalculated:

```
┌─────────────────────────────────────────────────────────────┐
│  Enrollment updated → Dashboard STALE                        │
│  Revenue updated    → Dashboard STALE                        │
│  Staffing updated   → Dashboard STALE                        │
│  P&L updated        → Dashboard STALE                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Audit Trail

### Operations to Log (Future Implementation)

| Operation            | Description                       | Data Captured               |
| -------------------- | --------------------------------- | --------------------------- |
| DASHBOARD_REFRESHED  | User manually refreshed dashboard | Version ID, timestamp, user |
| DASHBOARD_CALCULATED | Summary recalculated              | All metric values, duration |

**Note**: Current implementation has no audit logging as no data mutations occur on this page.

---

## Error Handling

### Common Error Codes (Future Implementation)

| Code                | HTTP Status | Description                         | User Action          |
| ------------------- | ----------- | ----------------------------------- | -------------------- |
| VERSION_NOT_FOUND   | 404         | Budget version does not exist       | Select valid version |
| DASHBOARD_STALE     | 200         | Data is stale, recalculation needed | Click Refresh button |
| CALCULATION_PENDING | 200         | Background calculation in progress  | Wait and refresh     |
| UNAUTHORIZED        | 401         | User not authenticated              | Log in               |

### Current Error Handling

The current placeholder implementation has no error scenarios — it simply displays zero values for all metrics.

---

## Improvements Required

This section documents known issues, technical debt, and proposed enhancements for the Dashboard module.

### High Priority

| ID       | Issue                               | Impact                               | Proposed Solution                                      |
| -------- | ----------------------------------- | ------------------------------------ | ------------------------------------------------------ |
| DASH-001 | **All values are zero/placeholder** | Dashboard provides no business value | Implement backend API endpoints and data fetching      |
| DASH-002 | **Charts not implemented**          | No visual analytics capability       | Integrate Recharts library with actual data            |
| DASH-003 | **No data refresh mechanism**       | Static display only                  | Add refresh button and auto-refresh on data changes    |
| DASH-004 | **No drill-down capability**        | Users cannot navigate to details     | Add click handlers on KPIs to navigate to detail pages |

### Medium Priority

| ID       | Issue                           | Impact                               | Proposed Solution                       |
| -------- | ------------------------------- | ------------------------------------ | --------------------------------------- |
| DASH-005 | **No trend indicators**         | Cannot see changes over time         | Implement trend calculation and display |
| DASH-006 | **No comparison to prior year** | No historical context                | Add prior year comparison metrics       |
| DASH-007 | **No export functionality**     | Cannot export dashboard to PDF/Excel | Add export buttons with PDF generation  |
| DASH-008 | **Limited responsive layout**   | May not work well on mobile          | Test and improve responsive breakpoints |

### Low Priority / Technical Debt

| ID       | Issue                          | Impact                              | Proposed Solution                               |
| -------- | ------------------------------ | ----------------------------------- | ----------------------------------------------- |
| DASH-009 | **No skeleton loading state**  | Flash of zero content               | Implement loading skeletons while fetching data |
| DASH-010 | **Hardcoded animation delays** | Difficult to maintain               | Move animation config to constants              |
| DASH-011 | **No error boundary**          | Component crash affects entire page | Add React error boundary                        |
| DASH-012 | **No real-time updates**       | Must refresh to see changes         | Consider WebSocket or polling for live updates  |

### Feature Requests

| ID       | Feature                      | Business Value                           | Complexity |
| -------- | ---------------------------- | ---------------------------------------- | ---------- |
| DASH-F01 | **Customizable KPIs**        | Users choose which metrics to display    | Medium     |
| DASH-F02 | **Saved views**              | Save different dashboard configurations  | Medium     |
| DASH-F03 | **Widget library**           | Add/remove dashboard widgets             | High       |
| DASH-F04 | **Alert thresholds**         | Highlight metrics outside expected range | Medium     |
| DASH-F05 | **Executive summary PDF**    | Auto-generated report for stakeholders   | High       |
| DASH-F06 | **Budget variance analysis** | Compare actual vs budget vs forecast     | Medium     |

---

## Appendix A: Component Architecture

```
DashboardPage (apps/web/src/pages/planning/dashboard.tsx)
├── PageTransition (animation wrapper)
├── KpiCard × 4 (apps/web/src/components/dashboard/kpi-card.tsx)
│   ├── Counter (animated number)
│   └── Lucide Icon
├── ChartCard × 3 (apps/web/src/components/dashboard/chart-card.tsx)
│   └── Card (ui component)
│       ├── CardHeader
│       │   └── CardTitle
│       └── CardContent
│           └── [Chart component - future]
└── (Future: ErrorBoundary, LoadingState)
```

---

## Appendix B: Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DATABASE                                      │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐        │
│  │ enrollment_    │  │ revenue_       │  │ staff_         │        │
│  │ headcount      │  │ calculation    │  │ positions      │        │
│  └───────┬────────┘  └───────┬────────┘  └───────┬────────┘        │
└──────────┼───────────────────┼───────────────────┼─────────────────┘
           │                   │                   │
           ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        BACKEND API                                   │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  /dashboard/summary (FUTURE)                                  │   │
│  │  • Aggregates data from all modules                           │   │
│  │  • Computes KPIs                                              │   │
│  │  • Returns formatted response                                 │   │
│  └───────────────────────────┬──────────────────────────────────┘   │
└──────────────────────────────┼──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  DashboardPage                                                │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │   │
│  │  │ KpiCard     │  │ KpiCard     │  │ KpiCard     │          │   │
│  │  │ Students    │  │ Revenue     │  │ Costs       │          │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘          │   │
│  │  ┌─────────────────┐  ┌─────────────────┐                   │   │
│  │  │ ChartCard       │  │ ChartCard       │                   │   │
│  │  │ Revenue vs Budg │  │ Enroll by Band  │                   │   │
│  │  └─────────────────┘  └─────────────────┘                   │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Document History

| Version | Date       | Author       | Changes                   |
| ------- | ---------- | ------------ | ------------------------- |
| 1.0     | 2026-03-10 | AI Assistant | Initial document creation |

---

_End of Document_
