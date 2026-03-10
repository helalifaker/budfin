# Accounts (Chart of Accounts) Master Data Page — Process Workflow

> **Document Purpose**: This document provides a comprehensive, plain-language guide to the Chart of Accounts Master Data management page. It explains the business process, technical implementation, user actions, and data flow. It serves as a reference for auditors, new developers, and business analysts to understand and propose improvements.

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
| **Page Name**        | Chart of Accounts                                                                                |
| **URL Route**        | `/admin/master-data/accounts`                                                                    |
| **Module**           | Master Data — Financial Management                                                               |
| **Page File**        | `apps/web/src/pages/master-data/accounts.tsx`                                                    |
| **Side Panel File**  | `apps/web/src/components/master-data/accounts-side-panel.tsx`                                    |
| **Primary Function** | Manage the chart of accounts for financial reporting, budget categorization, and IFRS compliance |

### What This Page Does

The Chart of Accounts page is the **foundation** of the financial reporting structure. It allows administrators to:

1. Create and manage **account codes** for all financial transactions
2. Classify accounts by **type** (Revenue, Expense, Asset, Liability)
3. Assign **IFRS categories** for international financial reporting standards compliance
4. Designate **center types** (Profit Center or Cost Center) for organizational analysis
5. Control account **status** (Active/Inactive) for soft deletion
6. Enable **optimistic locking** (version tracking) to prevent concurrent edit conflicts

**Critical Business Rule**: Account codes must be unique and cannot be changed after creation. This ensures referential integrity across all budget versions and financial reports.

---

## Business Context

### Account Types

| Type          | Description                                                | Financial Statement |
| ------------- | ---------------------------------------------------------- | ------------------- |
| **REVENUE**   | Income accounts from tuition, fees, and other sources      | Income Statement    |
| **EXPENSE**   | Cost accounts for salaries, operations, and supplies       | Income Statement    |
| **ASSET**     | Balance sheet assets (cash, receivables, fixed assets)     | Balance Sheet       |
| **LIABILITY** | Balance sheet liabilities (payables, accruals, provisions) | Balance Sheet       |

### Center Types

| Center Type       | Description                             | Use Case                                 |
| ----------------- | --------------------------------------- | ---------------------------------------- |
| **PROFIT_CENTER** | Revenue-generating organizational units | Track income by department or activity   |
| **COST_CENTER**   | Cost-incurring organizational units     | Track expenses by department or function |

### Account Status Lifecycle

```
ACTIVE ──► INACTIVE (soft delete via status change)
   ▲            │
   └────────────┘ (can be reactivated)
```

Accounts are never physically deleted from the database. Instead, they are marked as INACTIVE to preserve historical references in budget versions and audit logs.

---

## User Roles & Permissions

| Role            | View Data | Create Account | Edit Account | Delete Account |
| --------------- | --------- | -------------- | ------------ | -------------- |
| **Admin**       | ✅        | ✅             | ✅           | ✅             |
| **BudgetOwner** | ✅        | ❌             | ❌           | ❌             |
| **Editor**      | ✅        | ❌             | ❌           | ❌             |
| **Viewer**      | ✅        | ❌             | ❌           | ❌             |

**Permission Rule**: Only users with the "Admin" role can access the Master Data section. All CRUD operations on accounts are restricted to administrators.

---

## Pre-Conditions

Before using this page, the following must be met:

### Required Authentication

1. User must be authenticated with a valid JWT token
2. User role must be "Admin" (enforced at both UI and API levels)

### System Dependencies

1. **Database connection** to `chart_of_accounts` table must be available
2. **API service** must be running and accessible at `/master-data/accounts`
3. **Audit logging** must be enabled for compliance tracking

---

## Page Layout & UI Elements

### Header Section

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Chart of Accounts                                                          │
│  Manage the chart of accounts for financial reporting...                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  🔍 Search...    [All Types▼] [All Center Types▼] [All Statuses▼]  [+ Add]  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Filter Controls

| Filter                 | Values                                  | Function                                |
| ---------------------- | --------------------------------------- | --------------------------------------- |
| **Search**             | Free text (300ms debounce)              | Filters by account code or account name |
| **Type Filter**        | All, Revenue, Expense, Asset, Liability | Filters by account classification       |
| **Center Type Filter** | All, Profit Center, Cost Center         | Filters by organizational unit type     |
| **Status Filter**      | All, Active, Inactive                   | Filters by account status               |

### Action Buttons

| Button          | Icon | Role Required | Action                                    |
| --------------- | ---- | ------------- | ----------------------------------------- |
| **Add Account** | Plus | Admin         | Opens side panel for creating new account |

### Accounts Table

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ Account Code │ Account Name      │ Type    │ IFRS Category │ Center Type  │ Status    │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 4100-010     │ Tuition Fees      │ REVENUE │ Revenue       │ PROFIT_CTR   │ ● Active  │
│ 6100-100     │ Teacher Salaries  │ EXPENSE │ Personnel     │ COST_CENTER  │ ● Active  │
│ 1100-001     │ Cash              │ ASSET   │ Current Asset │ COST_CENTER  │ ● Active  │
│ 2100-010     │ Accounts Payable  │ LIAB    │ Current Liab  │ COST_CENTER  │ ○ Inactive│
└────────────────────────────────────────────────────────────────────────────────────────┘
```

**Table Columns**:

- **Account Code**: Unique identifier for the account (editable on create only)
- **Account Name**: Human-readable account description
- **Type**: Color-coded badge (Revenue=green, Expense=red, Asset=blue, Liability=orange)
- **IFRS Category**: International financial reporting classification
- **Center Type**: Color-coded badge (Profit Center=purple, Cost Center=gray)
- **Status**: Indicator dot (Active=green, Inactive=gray)
- **Actions**: Dropdown menu with Edit/Delete (Admin only)

### Side Panel (Add/Edit)

```
┌─────────────────────────────────┐
│ Add Account / Edit Account: XXX │
├─────────────────────────────────┤
│ Account Code      [__________]  │
│ Account Name      [__________]  │
│ Type              [Revenue ▼]   │
│ IFRS Category     [__________]  │
│ Center Type       [Profit ▼]    │
│ Description       [          ]  │
│                   [          ]  │
│ Status            [Active ▼]    │
├─────────────────────────────────┤
│              [Cancel] [Save]    │
└─────────────────────────────────┘
```

**Form Fields**:

- **Account Code** (required): Unique alphanumeric code; disabled when editing
- **Account Name** (required): Descriptive name for the account
- **Type** (required): Revenue, Expense, Asset, or Liability
- **IFRS Category** (required): IFRS classification for reporting
- **Center Type** (required): Profit Center or Cost Center
- **Description** (optional): Additional notes or explanations
- **Status** (required): Active or Inactive

### Delete Confirmation Dialog

```
┌─────────────────────────────────┐
│ Delete Account                  │
├─────────────────────────────────┤
│ This action cannot be undone.   │
│ Type 6100-100 to confirm.       │
│                                 │
│ [__________________]            │
├─────────────────────────────────┤
│              [Cancel] [Delete]  │
└─────────────────────────────────┘
```

**Delete Safety**: Users must type the exact account code to confirm deletion. This prevents accidental deletions.

---

## Step-by-Step Workflow

### Workflow 1: Create New Account

**Actor**: Admin

| Step | Action                                         | UI Element   | API Call                     | Result                                         |
| ---- | ---------------------------------------------- | ------------ | ---------------------------- | ---------------------------------------------- |
| 1    | Navigate to Master Data → Accounts             | Sidebar menu | -                            | Page loads with accounts table                 |
| 2    | Click "+ Add Account" button                   | Button       | -                            | Side panel opens with empty form               |
| 3    | Enter account code (e.g., "4100-020")          | Text input   | -                            | Code validated for uniqueness                  |
| 4    | Enter account name (e.g., "Registration Fees") | Text input   | -                            | Name displayed                                 |
| 5    | Select type from dropdown                      | Select       | -                            | Type selected (REVENUE)                        |
| 6    | Enter IFRS category (e.g., "Revenue")          | Text input   | -                            | Category entered                               |
| 7    | Select center type                             | Select       | -                            | Center type selected                           |
| 8    | Enter optional description                     | Textarea     | -                            | Description entered                            |
| 9    | Click "Save" button                            | Button       | `POST /master-data/accounts` | Account created, panel closes, table refreshes |
| 10   | Observe success notification                   | Toast        | -                            | "Account created successfully"                 |

**Database Changes**:

- Insert new record into `chart_of_accounts` table
- Set `version = 1` for optimistic locking
- Set `created_by` and `updated_by` to current user ID
- Set `created_at` and `updated_at` to current timestamp

---

### Workflow 2: Edit Existing Account

**Actor**: Admin

| Step | Action                              | UI Element     | API Call                                              | Result                               |
| ---- | ----------------------------------- | -------------- | ----------------------------------------------------- | ------------------------------------ |
| 1    | Locate account in table             | Table row      | -                                                     | Row identified                       |
| 2    | Click actions dropdown (three dots) | Dropdown       | -                                                     | Menu opens with Edit/Delete options  |
| 3    | Select "Edit"                       | Menu item      | `GET /master-data/accounts/{id}` (implicit via cache) | Side panel opens with account data   |
| 4    | Modify desired fields               | Various inputs | -                                                     | Fields updated (except account code) |
| 5    | Click "Save" button                 | Button         | `PUT /master-data/accounts/{id}`                      | Account updated, panel closes        |
| 6    | Observe success notification        | Toast          | -                                                     | "Account updated successfully"       |

**Optimistic Locking**: The `version` field from the fetched record is sent with the PUT request. If another user modified the account concurrently, the API returns a 409 Conflict error.

**Database Changes**:

- Update existing record in `chart_of_accounts` table
- Increment `version` by 1
- Update `updated_by` to current user ID
- Update `updated_at` to current timestamp

---

### Workflow 3: Delete Account

**Actor**: Admin

| Step | Action                              | UI Element              | API Call                            | Result                                          |
| ---- | ----------------------------------- | ----------------------- | ----------------------------------- | ----------------------------------------------- |
| 1    | Locate account in table             | Table row               | -                                   | Row identified                                  |
| 2    | Click actions dropdown (three dots) | Dropdown                | -                                   | Menu opens                                      |
| 3    | Select "Delete"                     | Menu item (destructive) | -                                   | Delete confirmation dialog opens                |
| 4    | Type account code to confirm        | Text input              | -                                   | Confirm button enabled when code matches        |
| 5    | Click "Delete" button               | Button                  | `DELETE /master-data/accounts/{id}` | Account deleted, dialog closes, table refreshes |
| 6    | Observe success notification        | Toast                   | -                                   | "Account deleted successfully"                  |

**Important**: Deleted accounts cannot be recovered. However, any existing references in budget versions remain intact (the API may block deletion if references exist, depending on implementation).

---

### Workflow 4: Filter and Search Accounts

**Actor**: Any authenticated user

| Step | Action                    | UI Element      | API Call                                                 | Result                              |
| ---- | ------------------------- | --------------- | -------------------------------------------------------- | ----------------------------------- |
| 1    | Type in search box        | Search input    | `GET /master-data/accounts?search=xxx` (debounced 300ms) | Table filtered by code/name         |
| 2    | Select type filter        | Dropdown        | `GET /master-data/accounts?type=REVENUE`                 | Table filtered by type              |
| 3    | Select center type filter | Dropdown        | `GET /master-data/accounts?centerType=PROFIT_CENTER`     | Table filtered by center            |
| 4    | Select status filter      | Dropdown        | `GET /master-data/accounts?status=ACTIVE`                | Table filtered by status            |
| 5    | Combine multiple filters  | Multiple inputs | `GET /master-data/accounts?type=EXPENSE&status=ACTIVE`   | Table filtered by combined criteria |

**Frontend Behavior**: Filters are combined with AND logic. Search uses case-insensitive partial matching on both account code and account name.

---

## Data Models & Database Schema

### Core Table

#### chart_of_accounts

Stores the complete chart of accounts for financial reporting.

```sql
Table: chart_of_accounts
┌───────────────────┬─────────────────┬────────────────────────────────────────────┐
│ Column            │ Type            │ Description                                │
├───────────────────┼─────────────────┼────────────────────────────────────────────┤
│ id                │ SERIAL PK       │ Unique identifier                          │
│ account_code      │ VARCHAR(50)     │ Unique account code (e.g., "4100-010")     │
│ account_name      │ VARCHAR(100)    │ Human-readable account name                │
│ type              │ VARCHAR(20)     │ REVENUE, EXPENSE, ASSET, or LIABILITY      │
│ ifrs_category     │ VARCHAR(50)     │ IFRS classification category               │
│ center_type       │ VARCHAR(20)     │ PROFIT_CENTER or COST_CENTER               │
│ description       │ TEXT            │ Optional description/notes                 │
│ status            │ VARCHAR(20)     │ ACTIVE or INACTIVE                         │
│ version           │ INTEGER         │ Optimistic locking version counter         │
│ created_by        │ INTEGER FK      │ → users.id (who created the record)        │
│ updated_by        │ INTEGER FK      │ → users.id (who last updated)              │
│ created_at        │ TIMESTAMPTZ     │ Record creation timestamp                  │
│ updated_at        │ TIMESTAMPTZ     │ Last update timestamp                      │
└───────────────────┴─────────────────┴────────────────────────────────────────────┘

Unique Constraint: account_code
Index: type, center_type, status (for filtering)
```

### Related Tables

The `chart_of_accounts` table is referenced by:

- **Budget line items** — account assignments in budget versions
- **Transaction mappings** — automated import mappings
- **Report configurations** — financial report row definitions

---

## API Endpoints

### Account Management APIs

| Method | Endpoint                                         | Description        | Auth | Role  |
| ------ | ------------------------------------------------ | ------------------ | ---- | ----- |
| GET    | `/master-data/accounts`                          | List all accounts  | JWT  | Any   |
| GET    | `/master-data/accounts?search=xxx`               | Search accounts    | JWT  | Any   |
| GET    | `/master-data/accounts?type=REVENUE`             | Filter by type     | JWT  | Any   |
| GET    | `/master-data/accounts?centerType=PROFIT_CENTER` | Filter by center   | JWT  | Any   |
| GET    | `/master-data/accounts?status=ACTIVE`            | Filter by status   | JWT  | Any   |
| POST   | `/master-data/accounts`                          | Create new account | JWT  | Admin |
| PUT    | `/master-data/accounts/{id}`                     | Update account     | JWT  | Admin |
| DELETE | `/master-data/accounts/{id}`                     | Delete account     | JWT  | Admin |

**GET Response**:

```json
{
    "accounts": [
        {
            "id": 1,
            "accountCode": "4100-010",
            "accountName": "Tuition Fees",
            "type": "REVENUE",
            "ifrsCategory": "Revenue",
            "centerType": "PROFIT_CENTER",
            "description": "Main tuition income",
            "status": "ACTIVE",
            "version": 3,
            "createdAt": "2025-01-15T08:30:00Z",
            "updatedAt": "2025-03-01T14:22:00Z"
        }
    ]
}
```

**POST Request Body**:

```json
{
    "accountCode": "4100-020",
    "accountName": "Registration Fees",
    "type": "REVENUE",
    "ifrsCategory": "Revenue",
    "centerType": "PROFIT_CENTER",
    "description": "New student registration",
    "status": "ACTIVE"
}
```

**PUT Request Body**:

```json
{
    "version": 3,
    "accountName": "Updated Name",
    "type": "REVENUE",
    "ifrsCategory": "Revenue",
    "centerType": "PROFIT_CENTER",
    "description": "Updated description",
    "status": "ACTIVE"
}
```

**Note**: `accountCode` cannot be changed after creation. The `version` field is required for optimistic locking.

---

## TypeScript Types

### Core Types (`apps/web/src/hooks/use-accounts.ts`)

```typescript
// Account entity
export interface Account {
    id: number;
    accountCode: string;
    accountName: string;
    type: 'REVENUE' | 'EXPENSE' | 'ASSET' | 'LIABILITY';
    ifrsCategory: string;
    centerType: 'PROFIT_CENTER' | 'COST_CENTER';
    description: string | null;
    status: 'ACTIVE' | 'INACTIVE';
    version: number;
    createdAt: string;
    updatedAt: string;
}

// Filter parameters
export interface AccountFilters {
    type?: string;
    centerType?: string;
    status?: string;
    search?: string;
}
```

### Form Types (`apps/web/src/components/master-data/accounts-side-panel.tsx`)

```typescript
import { z } from 'zod';

const accountSchema = z.object({
    accountCode: z.string().min(1, 'Account code is required'),
    accountName: z.string().min(1, 'Account name is required'),
    type: z.enum(['REVENUE', 'EXPENSE', 'ASSET', 'LIABILITY']),
    ifrsCategory: z.string().min(1, 'IFRS category is required'),
    centerType: z.enum(['PROFIT_CENTER', 'COST_CENTER']),
    description: z.string().nullable(),
    status: z.enum(['ACTIVE', 'INACTIVE']),
});

type AccountFormValues = z.infer<typeof accountSchema>;
```

### UI Label Mappings

```typescript
const TYPE_LABELS: Record<string, string> = {
    REVENUE: 'Revenue',
    EXPENSE: 'Expense',
    ASSET: 'Asset',
    LIABILITY: 'Liability',
};

const CENTER_TYPE_LABELS: Record<string, string> = {
    PROFIT_CENTER: 'Profit Center',
    COST_CENTER: 'Cost Center',
};

const TYPE_BADGE_COLORS: Record<string, string> = {
    REVENUE: 'bg-(--badge-revenue-bg) text-(--badge-revenue)',
    EXPENSE: 'bg-(--badge-expense-bg) text-(--badge-expense)',
    ASSET: 'bg-(--badge-asset-bg) text-(--badge-asset)',
    LIABILITY: 'bg-(--badge-liability-bg) text-(--badge-liability)',
};
```

---

## Calculation Engine

The Accounts Master Data page does not perform complex calculations. However, it does implement the following logic:

### Optimistic Locking Logic

```typescript
// On edit: Include version in update request
const updateData = {
    ...formData,
    version: account.version, // Current version from fetch
};

// API validates:
// 1. Fetch current record from DB
// 2. If DB.version !== request.version: return 409 Conflict
// 3. Else: increment version and apply updates
```

### Search Filtering Logic

```typescript
// Frontend debounce (300ms)
const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => setSearchDebounced(value), 300);
};

// Backend query (case-insensitive partial match)
// WHERE account_code ILIKE '%{search}%' OR account_name ILIKE '%{search}%'
```

### Status-Based Soft Delete

```typescript
// Deletion is permanent, but "deactivation" is preferred:
const deactivateAccount = (id: number) => {
    return updateAccount(id, { status: 'INACTIVE' });
};

// Reactivate when needed:
const reactivateAccount = (id: number) => {
    return updateAccount(id, { status: 'ACTIVE' });
};
```

---

## Audit Trail

### Operations Logged

| Operation       | Table             | Data Captured                              |
| --------------- | ----------------- | ------------------------------------------ |
| ACCOUNT_CREATED | chart_of_accounts | All fields, created_by                     |
| ACCOUNT_UPDATED | chart_of_accounts | Changed fields, old/new values, updated_by |
| ACCOUNT_DELETED | chart_of_accounts | Account ID, code, name, deleted_by         |

### Audit Entry Schema

```typescript
{
  userId: number;
  userEmail: string;
  operation: 'ACCOUNT_CREATED' | 'ACCOUNT_UPDATED' | 'ACCOUNT_DELETED';
  tableName: 'chart_of_accounts';
  recordId: number;
  ipAddress: string;
  oldValues?: Json;      // For updates: previous field values
  newValues: Json;       // New/updated field values
  createdAt: Date;
}
```

### Audit Trail Benefits

1. **Compliance**: PDPL (KSA Data Protection Law) requires data change tracking
2. **Debugging**: Trace who modified an account and when
3. **Recovery**: Audit logs can help reconstruct accidental changes
4. **Reporting**: Track account lifecycle for governance

---

## Error Handling

### Common Error Codes

| Code                | HTTP Status | Description                         | User Action                    |
| ------------------- | ----------- | ----------------------------------- | ------------------------------ |
| ACCOUNT_CODE_EXISTS | 409         | Account code already in use         | Choose a different unique code |
| VERSION_CONFLICT    | 409         | Record was modified by another user | Refresh and retry the edit     |
| ACCOUNT_NOT_FOUND   | 404         | Account ID does not exist           | Verify the account exists      |
| ACCOUNT_IN_USE      | 409         | Cannot delete - references exist    | Deactivate instead of delete   |
| UNAUTHORIZED        | 401         | User not authenticated              | Log in                         |
| FORBIDDEN           | 403         | User lacks Admin role               | Contact administrator          |
| VALIDATION_ERROR    | 422         | Required field missing or invalid   | Check all required fields      |

### Optimistic Locking Conflict Resolution

```
User A opens account for editing (version = 3)
         │
         │    User B edits and saves same account (version becomes 4)
         │
User A attempts to save (sends version = 3)
         │
         ▼
    ┌─────────┐
    │ 409 Conflict returned
    └────┬────┘
         │
         ▼
User A sees: "This record was modified by another user.
              Please refresh and try again."
```

---

## Improvements Required

This section documents known issues, technical debt, and proposed enhancements for the Accounts Master Data module.

### High Priority

| ID      | Issue                                       | Impact                                               | Proposed Solution                                                      |
| ------- | ------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------- |
| ACC-001 | **No bulk import capability**               | Administrators must create accounts one-by-one       | Add CSV/Excel import with validation                                   |
| ACC-002 | **No account hierarchy**                    | Flat list doesn't support parent-child relationships | Add hierarchical account structure (e.g., 4100-010 parent of 4100-011) |
| ACC-003 | **No duplicate detection on similar names** | Similar accounts may be created unintentionally      | Add fuzzy matching warning on create                                   |
| ACC-004 | **No usage analytics**                      | Cannot see which accounts are actively used          | Add reference count and last-used date                                 |

### Medium Priority

| ID      | Issue                                | Impact                                           | Proposed Solution                          |
| ------- | ------------------------------------ | ------------------------------------------------ | ------------------------------------------ |
| ACC-005 | **Limited IFRS category validation** | Free text allows inconsistent entries            | Use dropdown with standard IFRS categories |
| ACC-006 | **No account code auto-generation**  | Manual code entry prone to errors                | Add configurable auto-numbering scheme     |
| ACC-007 | **No export functionality**          | Cannot export chart of accounts for external use | Add Excel/CSV export button                |
| ACC-008 | **No account merging**               | Duplicate accounts require manual data migration | Add merge tool with reference remapping    |

### Low Priority / Technical Debt

| ID      | Issue                              | Impact                                   | Proposed Solution                           |
| ------- | ---------------------------------- | ---------------------------------------- | ------------------------------------------- |
| ACC-009 | **Client-side cache invalidation** | Manual query invalidation on mutations   | Implement optimistic updates with rollback  |
| ACC-010 | **No keyboard navigation**         | Accessibility limitation in table        | Add full keyboard shortcut support          |
| ACC-011 | **Hardcoded type enums**           | Type values in multiple files            | Centralize in shared constants package      |
| ACC-012 | **No account templates**           | New budgets require manual account setup | Add template system for common account sets |

### Feature Requests

| ID      | Feature                       | Business Value                           | Complexity |
| ------- | ----------------------------- | ---------------------------------------- | ---------- |
| ACC-F01 | **Account groups/categories** | Organize accounts for reporting          | Medium     |
| ACC-F02 | **Budget account mapping**    | Map external system accounts to internal | High       |
| ACC-F03 | **Account approval workflow** | Require approval for new accounts        | Medium     |
| ACC-F04 | **Account freeze capability** | Lock accounts from posting (period-end)  | Low        |
| ACC-F05 | **Multi-currency support**    | Track accounts in different currencies   | High       |

---

## Appendix A: Account Code Naming Convention

Recommended account code structure for EFIR:

```
4xxx-xxx  Revenue accounts
  4100-xxx  Tuition and fees
  4200-xxx  Other income

6xxx-xxx  Expense accounts
  6100-xxx  Personnel costs
  6200-xxx  Operating expenses
  6300-xxx  Administrative costs

1xxx-xxx  Asset accounts
  1100-xxx  Current assets
  1200-xxx  Fixed assets

2xxx-xxx  Liability accounts
  2100-xxx  Current liabilities
  2200-xxx  Long-term liabilities
```

---

## Appendix B: IFRS Category Mapping

Common IFRS categories for schools:

| IFRS Category         | Account Types | Examples                          |
| --------------------- | ------------- | --------------------------------- |
| Revenue               | REVENUE       | Tuition, Registration, Activities |
| Personnel Costs       | EXPENSE       | Salaries, Benefits, Training      |
| Operating Expenses    | EXPENSE       | Utilities, Maintenance, Supplies  |
| Administrative        | EXPENSE       | Insurance, Legal, Consulting      |
| Current Assets        | ASSET         | Cash, Receivables, Inventory      |
| Fixed Assets          | ASSET         | Buildings, Equipment, Vehicles    |
| Current Liabilities   | LIABILITY     | Payables, Accruals, Provisions    |
| Long-term Liabilities | LIABILITY     | Loans, Lease obligations          |

---

## Document History

| Version | Date       | Author       | Changes                   |
| ------- | ---------- | ------------ | ------------------------- |
| 1.0     | 2026-03-10 | AI Assistant | Initial document creation |

---

_End of Document_
