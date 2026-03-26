# BudFin Improvement Roadmap

**Date**: 2026-03-25
**Status**: Proposal
**Scope**: Post-v1 improvements across UI/UX, features, and technical quality

---

## Executive Summary

BudFin is functionally complete (20/20 epics done, 2,131 tests passing, zero TODO/FIXME comments). However, analysis of the codebase, competitor products (Questica, Frontline, Allovue, Blackbaud, Vena), and UI/UX patterns reveals significant opportunities for improvement across 4 tiers.

---

## TIER 1: CRITICAL FIXES (1-3 days)

Issues that affect correctness, consistency, or could confuse users today.

### 1.1 Calculate Button Inconsistency

**Problem**: Only Revenue uses the shared `CalculateButton` component. Staffing, OpEx, and P&L use plain `<Button>` elements, losing the 4-state visual feedback (idle/pending/success/error).

| Module     | File                                           | Uses Shared Component?  |
| ---------- | ---------------------------------------------- | ----------------------- |
| Enrollment | `pages/planning/enrollment.tsx:410`            | No (custom styling)     |
| Revenue    | `pages/planning/revenue.tsx:287`               | Yes                     |
| Staffing   | `components/staffing/staffing-page-v2.tsx:313` | No                      |
| OpEx       | `components/opex/opex-page.tsx:203,279`        | No (+ duplicate button) |
| P&L        | `components/pnl/pnl-page.tsx:425,448`          | No (+ duplicate button) |

**Fix**: Refactor all modules to use `components/shared/calculate-button.tsx`. Remove duplicate buttons in OpEx and P&L empty states.

### 1.2 Missing Upstream Stale Validation

**Problem**: Only P&L checks for stale upstream modules before calculating. Revenue, Staffing, and OpEx silently calculate with stale inputs, producing incorrect results the user doesn't notice until P&L fails.

**Fix**: Add stale-module guards to all calculate hooks:

- Revenue: Block if ENROLLMENT is stale
- Staffing: Block if REVENUE is stale
- OpEx: Block if REVENUE is stale (for PERCENT_OF_REVENUE items)
- Show toast: "Recalculate [module] first"

### 1.3 Format-Money Inconsistency

**Problem**: 5 files bypass `format-money.ts` and use raw `toLocaleString()` with inconsistent locales.

| File                          | Locale Used     |
| ----------------------------- | --------------- |
| `forecast-tab.tsx:46`         | `fr-FR`         |
| `revenue-matrix-table.tsx:26` | `fr-FR`         |
| `monthly-cost-grid.tsx:19`    | `undefined`     |
| `scenario-page.tsx:51`        | `en-US`         |
| `cell-renderers.tsx:48`       | browser default |

**Fix**: Replace all 5 with `formatMoney()` from `lib/format-money.ts`.

### 1.4 Design Token Violations

**Problem**: 12 instances of raw Tailwind colors (`text-emerald-600`, `text-red-600`) instead of CSS custom property tokens.

**Fix**: Replace with semantic tokens from the design system.

### 1.5 Audit RBAC Bug

**Problem**: Calculation history (`routes/audit.ts:97`) restricted to Admin only; spec says Admin + BudgetOwner.

**Fix**: Change role check to `['Admin', 'BudgetOwner']`.

### 1.6 Missing React Error Boundary

**Problem**: No Error Boundary component exists. Runtime crashes show a blank white screen.

**Fix**: Add a root `<ErrorBoundary>` with a user-friendly fallback and "Reload" button.

---

## TIER 2: UI/UX IMPROVEMENTS (1-2 weeks)

Polish, usability, and user experience enhancements.

### 2.1 Right Panel Activity & Audit Tabs

**Problem**: The Activity and Audit tabs in the right panel are pure placeholders ("Recent activity will appear here").

**Fix**:

- **Activity Tab**: Show recent changes to the current version (fetch from audit log, filter by versionId, display as timeline)
- **Audit Tab**: Show calculation history for the current module (when was it last calculated, by whom, duration)

### 2.2 Calculation Progress Indicator

**Problem**: Calculate buttons show a spinner but no progress for multi-step pipelines (staffing has 10 steps). Users don't know if it's working or stuck.

**Fix**: Add a progress indicator or step-by-step status during calculation. The API could return progress via Server-Sent Events, or a simpler approach: show a determinate progress bar based on typical duration.

### 2.3 Guided Budget Cycle Wizard

**Problem**: Starting a new budget cycle requires knowing the correct sequence: create version -> set enrollment -> configure fees -> import staff -> calculate each module in order. New users get lost.

**Fix**: Add a "New Budget Cycle" wizard accessible from the Dashboard that walks through:

1. Create/clone version
2. Configure enrollment settings + import headcounts
3. Set fee grid + revenue settings
4. Import/configure staff
5. Set OpEx line items
6. Run full calculation chain
7. Review P&L

Include a persistent "Setup Progress" checklist on the Dashboard.

### 2.4 Drill-Down from Dashboard & P&L

**Problem**: Dashboard KPI cards and P&L summary rows are static. Users can't click a number to see what it's made of.

**Fix**: Make KPI cards and P&L rows clickable:

- Click "Total Revenue" -> navigate to Revenue page filtered to that period
- Click "Staff Costs" -> navigate to Staffing costs view
- Click a monthly column -> filter to that month

### 2.5 Version Comparison Visualization

**Problem**: Version comparison exists as a data endpoint but has no visual charts (only a table with variance columns).

**Fix**: Add a comparison chart component:

- Side-by-side bar chart for revenue/cost categories
- Waterfall chart showing what changed between versions
- Variance sparklines in the comparison table

### 2.6 Inline Cell Editing in Grids

**Problem**: Some grids require opening a side panel or dialog to edit values. Spreadsheet users expect click-to-edit.

**Fix**: Extend `DataGrid` with inline editing mode for numeric cells (enrollment headcounts, OpEx amounts). Use the existing `cell-renderers.tsx` editable cell type more broadly.

### 2.7 Contextual Help Tooltips

**Problem**: Financial terms like "YEARFRAC", "DHG Grille", "Cohort Retention Rate", "GOSI" are domain-specific. Non-finance users don't understand them.

**Fix**: Add `<InfoTooltip>` component next to complex fields with brief explanations. Source content from a glossary file.

### 2.8 Dark Mode

**Problem**: CSS custom properties exist for theming but no toggle is exposed.

**Fix**: Add theme toggle in user menu (light/dark/system). Wire to Tailwind's `dark:` variant.

### 2.9 Print-Optimized Views

**Problem**: No CSS print stylesheets. Browser print produces ugly output with navigation chrome.

**Fix**: Add `@media print` styles that hide sidebar, navigation, and right panel. Format tables for A4/Letter landscape. This is the simplest "export" until PDF generation is built.

### 2.10 Keyboard Shortcuts

**Problem**: No power-user keyboard shortcuts for common actions.

**Fix**: Add shortcuts via a command palette (Cmd+K):

- `Cmd+K` -> Command palette
- `Cmd+S` -> Save (when editing)
- `Cmd+Enter` -> Calculate
- `1-7` in command palette -> Navigate to module

---

## TIER 3: NEW FEATURES (1-3 months)

Major features identified from competitive analysis, ranked by impact for EFIR's use case.

### 3.1 Multi-Year Planning (HIGH)

**What**: Create 3-5 year forward projections from a single base budget. Apply year-over-year growth assumptions (enrollment growth %, salary escalation %, inflation rate).

**Why**: Schools plan strategically over 3-5 years. Currently BudFin only models a single fiscal year per version. Every competitor offers this.

**Approach**:

- Add `projectionYears` to BudgetVersion (default 1, max 5)
- Add `YearlyAssumptions` model (year, enrollmentGrowthPct, salaryEscalationPct, inflationPct, feeIncreasePct)
- Extend calculation engines to loop over projection years
- Frontend: Add year tabs to P&L view showing year-over-year progression

### 3.2 Budget vs. Actual Tracking (HIGH)

**What**: Import actual expenditure data (from accounting system or Excel) and compare against budgeted amounts with variance analysis.

**Why**: Without actuals, BudFin is a planning-only tool. Users need to track execution and adjust forecasts based on real spending.

**Approach**:

- Add `ActualEntry` model (accountCode, period, amount, source)
- Add import endpoint for actuals (Excel/CSV)
- Extend P&L view with Budget | Actual | Variance columns
- Add variance threshold alerts (configurable: warn at 10%, block at 25%)
- Dashboard: Add budget consumption gauges

### 3.3 Budget Approval Workflow (HIGH)

**What**: Formal multi-step approval pipeline: Submit -> Review -> Approve/Reject -> Revise.

**Why**: The current Draft/Published/Locked lifecycle manages version state but not the human approval process. Department heads and budget owners need a structured review workflow.

**Approach**:

- Add `BudgetSubmission` model (versionId, submittedBy, status, reviewerNotes, approvedBy, approvedAt)
- Add workflow state machine: Draft -> Submitted -> UnderReview -> Approved/Rejected -> Revised
- Email notifications at each transition
- Rejection requires a comment explaining what needs to change
- Approval locks the version automatically

### 3.4 Position Control (HIGH)

**What**: Centralized registry of authorized positions (filled and vacant) with budget impact. Prevent over-hiring beyond approved headcount.

**Why**: BudFin manages employees but lacks the concept of "authorized positions" as budget containers. A school might authorize 45 teaching positions but only have 42 filled -- the 3 vacant positions still need to be budgeted.

**Approach**:

- Add `AuthorizedPosition` model (title, department, gradeLevel, band, isFilled, employeeId?)
- Positions are the budget unit; employees fill positions
- Show filled/vacant status on staffing page
- Budget vacant positions at band midpoint or configurable rate
- Alert when employee count exceeds authorized positions

### 3.5 Comments & Annotations (HIGH)

**What**: Users can leave comments on specific budget lines, cells, or versions for discussion and justification.

**Why**: Without comments, budget discussions happen in email/WhatsApp and context is lost. Every modern financial tool includes inline commenting.

**Approach**:

- Add `Comment` model (targetType, targetId, versionId, userId, body, createdAt, resolvedAt)
- Target types: VERSION, REVENUE_LINE, STAFF_POSITION, OPEX_LINE, PNL_LINE
- Show comment indicators on rows with unresolved comments
- Right panel: Show comment thread for selected item
- Comment count badge in toolbar

### 3.6 Salary Step/Lane Progression (HIGH)

**What**: Automatically project next-year salary costs based on step increments in the DHG grille. When an employee moves from Echelon 5 to Echelon 6, the system calculates the new salary automatically.

**Why**: EFIR uses the DHG grille with echelons and indices. Currently, salary progression is manual. Auto-progression would save significant time during budget preparation.

**Approach**:

- Add `nextEchelon` logic to DHG engine
- Add "Auto-Progress" toggle per employee or en masse
- Show projected vs. current salary in staffing grid
- Factor progression into multi-year planning (Tier 3.1)

### 3.7 Bulk Adjustments (MEDIUM)

**What**: Apply percentage or flat-amount adjustments across multiple budget lines simultaneously.

**Why**: Common operations like "3% raise for all teachers" or "10% increase to all OpEx maintenance lines" require per-record editing today.

**Approach**:

- Add "Bulk Adjust" dialog accessible from staffing and OpEx grids
- Filter by category/department/type
- Apply: +X%, +X SAR, set to X
- Preview changes before applying
- Audit log all bulk operations

### 3.8 Notifications System (MEDIUM)

**What**: In-app and email notifications for workflow events.

**Why**: Users need to know when a version is published, when their attention is needed for review, when calculations complete, or when thresholds are exceeded.

**Approach**:

- Add `Notification` model (userId, type, title, body, read, link)
- Bell icon in header with unread count
- Email delivery via nodemailer (or SMTP relay)
- Configurable: which events trigger notifications per user

### 3.9 Historical Trend Analysis (MEDIUM)

**What**: Visualize 3-5 years of historical budget data to identify spending patterns and growth rates.

**Why**: Board presentations require historical context. "Staff costs grew 8% YoY for 3 years" is more compelling than a single-year number.

**Approach**:

- Query across locked/archived versions from multiple fiscal years
- Line chart: Revenue, Staff Cost, OpEx, Net Margin over years
- Table: Year-over-year growth rates by category
- Export to PDF for board presentations

### 3.10 PDF & Excel Export (MEDIUM, already planned)

**What**: Generate formatted PDF and Excel reports from budget data.

**Why**: Already planned (ADR-034, ExportJob model exists). Board members and regulators need offline documents.

**Approach**: Per existing plan -- pg-boss job queue, @react-pdf/renderer for PDF, ExcelJS for Excel. Implement the deferred export routes.

---

## TIER 4: FUTURE VISION (3-6 months)

Strategic features for long-term roadmap.

### 4.1 SIS/HR Integration

Bi-directional sync with the school's Student Information System (actual enrollment) and HR/Payroll system (actual salaries, new hires, terminations).

### 4.2 SSO/LDAP Authentication

Connect to school's Active Directory or Google Workspace for single sign-on.

### 4.3 Two-Factor Authentication

TOTP-based 2FA for Admin and BudgetOwner roles accessing salary data.

### 4.4 Custom Report Builder

Drag-and-drop report designer where administrators select dimensions (department, grade, account code) and measures (amount, FTE, headcount).

### 4.5 Per-Pupil Cost Analysis

Calculate cost-per-student by grade, program, or department for resource allocation decisions.

### 4.6 Mobile Dashboard

Read-only responsive dashboard for executives checking KPIs on mobile devices.

### 4.7 Board Presentation Mode

Pre-formatted executive summary view with charts, narratives, and school branding suitable for direct projection in board meetings.

### 4.8 AI-Powered Insights

Natural language queries: "Why did staff costs increase 12%?" -> AI analyzes the data and explains contributing factors (new hires, progression, benefit changes).

---

## TECHNICAL DEBT

### Test Coverage

| Package | Current | Target | Gap   |
| ------- | ------- | ------ | ----- |
| API     | 61.6%   | 80%    | 18.4% |
| Web     | 33.9%   | 80%    | 46.1% |

Priority test gaps: Dashboard, Scenarios, P&L frontend, OpEx frontend.

### Spec Drift Documentation

4 spec tables need updating to match improved implementation:

- Table 8: GradeLevel capacity fields (merged from separate config)
- Table 9: Flat discount model (replaces per-tariff CRUD)
- Table 17: MonthlyPnlLine (replaces ifrs_line_items)
- Table 23: VersionOpExLineItem + MonthlyOpEx (replaces flat table)

### OpEx Settings Button

`components/opex/opex-page.tsx:198` has a disabled "Settings" button with no implementation. Either implement or remove.

---

## RECOMMENDED IMPLEMENTATION ORDER

### Phase 1: Polish (Week 1-2)

1. Fix calculate button consistency (Tier 1.1)
2. Add upstream stale validation (Tier 1.2)
3. Fix format-money inconsistency (Tier 1.3)
4. Fix design token violations (Tier 1.4)
5. Fix audit RBAC bug (Tier 1.5)
6. Add Error Boundary (Tier 1.6)
7. Populate right panel Activity/Audit tabs (Tier 2.1)
8. Add print styles (Tier 2.9)

### Phase 2: UX Enhancement (Week 3-4)

1. Calculation progress indicator (Tier 2.2)
2. Dashboard drill-down (Tier 2.4)
3. Contextual help tooltips (Tier 2.7)
4. Dark mode toggle (Tier 2.8)
5. Keyboard shortcuts + command palette (Tier 2.10)
6. Raise test coverage to 80% (Tech Debt)

### Phase 3: Core Features (Month 2)

1. Comments & annotations (Tier 3.5)
2. Notifications system (Tier 3.8)
3. Budget approval workflow (Tier 3.3)
4. PDF & Excel export (Tier 3.10)
5. Bulk adjustments (Tier 3.7)

### Phase 4: Strategic Features (Month 3)

1. Multi-year planning (Tier 3.1)
2. Budget vs. Actual tracking (Tier 3.2)
3. Position control (Tier 3.4)
4. Salary step/lane progression (Tier 3.6)
5. Historical trend analysis (Tier 3.9)

### Phase 5: Vision (Month 4-6)

1. Guided budget cycle wizard (Tier 2.3)
2. Version comparison charts (Tier 2.5)
3. SIS/HR integration (Tier 4.1)
4. SSO/LDAP (Tier 4.2)
5. Custom report builder (Tier 4.4)
6. Mobile dashboard (Tier 4.6)
