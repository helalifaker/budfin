# Epic 9 -- Dashboard Module

## Overview

The Dashboard module provides a single-page summary of the active budget version. It
aggregates KPIs from the MonthlyBudgetSummary table and enrollment headcounts, then
renders them in the frontend with KPI cards and a monthly trend table.

## API Endpoint

**Route**: `GET /api/v1/versions/:versionId/dashboard`
**Auth**: `data:view` permission (all authenticated roles)

### Response Shape

```json
{
    "kpis": {
        "totalRevenue": "string (decimal)",
        "totalStaffCosts": "string (decimal)",
        "enrollmentCount": "number",
        "costPerStudent": "string (decimal)",
        "ebitda": "string (decimal)",
        "ebitdaMarginPct": "string (percentage, 2dp)",
        "netProfit": "string (decimal)"
    },
    "monthlyTrend": [
        {
            "month": 1,
            "revenue": "string",
            "staffCosts": "string",
            "opex": "string",
            "netProfit": "string"
        }
    ],
    "staleModules": ["REVENUE", "STAFFING"],
    "lastCalculatedAt": "ISO 8601 string | null"
}
```

### Computation Logic

- `totalRevenue`: SUM of revenueHt across 12 months from MonthlyBudgetSummary
- `totalStaffCosts`: SUM of staffCosts across 12 months
- `enrollmentCount`: SUM of headcount from EnrollmentHeadcount WHERE academicPeriod = AY1
- `costPerStudent`: totalStaffCosts / enrollmentCount (zero-safe)
- `ebitda`: SUM of ebitda from MonthlyBudgetSummary
- `ebitdaMarginPct`: (ebitda / totalRevenue) \* 100 (zero-safe)
- `netProfit`: SUM of netProfit from MonthlyBudgetSummary
- `staleModules`: directly from BudgetVersion.staleModules

## Frontend

### Page: `/planning` (DashboardPage)

1. Reads `versionId` from workspace context
2. Fetches `/dashboard` via TanStack Query hook `useDashboard(versionId)`
3. Displays 4 KPI cards: Total Students, Total Revenue, Staff Costs, Net Result
4. Displays stale-data warning banner when staleModules is non-empty
5. Displays monthly trend table with 12 rows (Jan-Dec) showing Revenue, Staff Costs,
   OpEx, and Net Profit columns
6. Shows skeleton loading states while data is fetching

### Components Used

- `KpiCard` -- existing animated card with counter
- `ChartCard` -- existing card wrapper, children slot used for the trend table
- `Skeleton` -- loading placeholder
- `formatMoney` -- SAR formatting utility

## Stories

1. **Dashboard API endpoint** -- GET /dashboard with KPIs, monthly trend, stale flags
2. **Dashboard frontend with real data** -- Wire up page to API with KPI cards, monthly
   trend table, and stale warnings
