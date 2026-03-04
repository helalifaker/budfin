# 4. Detailed Component Design

This section specifies every first-class component in BudFin, covering purpose, internal structure, TypeScript interfaces, interaction contracts, and traceability to functional requirements (FR) and non-functional requirements (NFR) defined in the PRD.

---

## 4.1 Auth Service

### Purpose and Responsibility

The Auth Service owns the complete authentication lifecycle: credential verification, JWT token issuance and rotation, session enforcement, and brute-force lockout. It is the single entry point for identity verification and produces the `JwtPayload` consumed by all downstream authorization decisions.

### Internal Modules

| Module | Responsibility |
| --- | --- |
| `TokenService` | JWT generation (access + refresh pair), access token validation, refresh token rotation with family-based replay detection |
| `PasswordService` | bcrypt hashing and comparison with cost factor 12 |
| `SessionService` | Tracks active sessions per user, enforces a maximum of 2 concurrent sessions, and invalidates the oldest session when the limit is exceeded |
| `LockoutService` | Counts consecutive failed login attempts per user, triggers a 30-minute lockout after 5 failures, and resets the counter on successful authentication |

### Key TypeScript Interfaces

```typescript
// --- Token types ---

interface TokenPair {
 accessToken: string;   // JWT, 30-min TTL, payload: JwtPayload
 refreshToken: string;  // Opaque 256-bit random hex, 8-hr TTL, stored bcrypt-hashed in DB
}

interface JwtPayload {
 userId: number;
 role: 'Admin' | 'BudgetOwner' | 'Editor' | 'Viewer';
 sessionId: string;
 iat: number;
 exp: number;
}

// --- Service interface ---

interface AuthService {
 login(email: string, password: string, ipAddress: string): Promise<TokenPair>;
 refresh(refreshToken: string): Promise<TokenPair>;
 logout(refreshToken: string): Promise<void>;
 validateAccessToken(token: string): Promise<JwtPayload>;
}

// --- Supporting types ---

interface LoginAttemptRecord {
 userId: number;
 failedAttempts: number;
 lockedUntil: Date | null;
}

interface RefreshTokenRecord {
 id: number;
 userId: number;
 tokenHash: string;
 familyId: string;     // Groups tokens in one refresh chain
 isRevoked: boolean;
 expiresAt: Date;
 createdAt: Date;
}
```

### Token Refresh Rotation

When `refresh()` is called with a valid token, the service immediately revokes the presented token and issues a new `TokenPair` sharing the same `familyId`. If a client replays an already-revoked refresh token, the service detects the reuse via `familyId`, revokes every token in that family, and invalidates all sessions for the affected user. This forces a full re-authentication and is logged as a security event in the audit trail.

### Lockout Logic

The `users` table carries `failed_attempts INTEGER DEFAULT 0` and `locked_until TIMESTAMPTZ`. On each failed login attempt the service increments `failed_attempts`. When the counter reaches 5, the service sets `locked_until = NOW() + INTERVAL '30 minutes'` and writes an audit entry with operation `ACCOUNT_LOCKOUT`. Any login attempt while `NOW() < locked_until` is rejected with HTTP 423 regardless of credential correctness. A successful login resets `failed_attempts` to 0 and clears `locked_until`.

### Component Interactions

| Direction | Partner | Mechanism |
| --- | --- | --- |
| Called by | API router (login, refresh, logout endpoints) | Direct function call |
| Calls | Prisma client (users, refresh_tokens tables) | Prisma query API |
| Calls | Audit Logger | Prisma middleware (automatic) |
| Consumed by | RBAC Middleware | `validateAccessToken()` on every request |

### Traceability

- **FR**: FR-SEC-01 (authentication), FR-SEC-02 (session management), FR-SEC-03 (lockout policy)
- **NFR**: NFR 11.3.1 (bcrypt cost factor 12), NFR 11.3.2 (JWT 30-min TTL), NFR 11.3.3 (refresh token 8-hr TTL), NFR 11.3.4 (max 2 concurrent sessions)

---

## 4.2 RBAC Middleware

### Purpose and Responsibility

The RBAC Middleware intercepts every inbound HTTP request after authentication, extracts the caller's role from the validated `JwtPayload`, and gates execution based on a statically defined permission matrix. It is implemented as Express middleware and is the sole enforcement point for authorization policy.

### Internal Modules

| Module | Responsibility |
| --- | --- |
| `PermissionMap` | Static lookup table mapping each `Role` to its granted `Permission` set |
| `requireRole` | Middleware factory that accepts an allow-list of roles and rejects requests whose JWT role is not in the list |
| `requirePermission` | Middleware factory that accepts a single permission key and checks whether the caller's role grants it |

### Key TypeScript Interfaces

```typescript
type Role = 'Admin' | 'BudgetOwner' | 'Editor' | 'Viewer';

type Permission =
 | 'versions:create'
 | 'versions:delete'
 | 'data:edit'
 | 'calculations:run'
 | 'data:view'
 | 'versions:publish'
 | 'users:manage'
 | 'audit:view'
 | 'config:edit'
 | 'data:import'
 | 'data:export';

const PERMISSION_MAP: Record<Role, ReadonlySet<Permission>> = {
 Admin: new Set([
  'versions:create', 'versions:delete', 'data:edit', 'calculations:run',
  'data:view', 'versions:publish', 'users:manage', 'audit:view',
  'config:edit', 'data:import', 'data:export',
 ]),
 BudgetOwner: new Set([
  'versions:create', 'versions:delete', 'data:edit', 'calculations:run',
  'data:view', 'versions:publish', 'data:import', 'data:export',
 ]),
 Editor: new Set([
  'data:edit', 'calculations:run', 'data:view', 'data:import', 'data:export',
 ]),
 Viewer: new Set([
  'data:view', 'data:export',
 ]),
};

function requireRole(roles: Role[]): RequestHandler;
function requirePermission(permission: Permission): RequestHandler;
```

### Permission Matrix

| Permission | Admin | BudgetOwner | Editor | Viewer |
| --- | --- | --- | --- | --- |
| `versions:create` | Yes | Yes | No | No |
| `versions:delete` | Yes | Yes | No | No |
| `data:edit` | Yes | Yes | Yes | No |
| `calculations:run` | Yes | Yes | Yes | No |
| `data:view` | Yes | Yes | Yes | Yes |
| `versions:publish` | Yes | Yes | No | No |
| `users:manage` | Yes | No | No | No |
| `audit:view` | Yes | No | No | No |
| `config:edit` | Yes | No | No | No |
| `data:import` | Yes | Yes | Yes | No |
| `data:export` | Yes | Yes | Yes | Yes |

### Rejection Response

All authorization failures produce HTTP 403 with a JSON body:

```json
{ "code": "FORBIDDEN", "message": "Insufficient permissions" }
```

The response intentionally omits details about which permission was missing to avoid information leakage.

### Component Interactions

| Direction | Partner | Mechanism |
| --- | --- | --- |
| Called by | Express router (registered before route handlers) | Middleware chain |
| Calls | Auth Service | `validateAccessToken()` to extract `JwtPayload` |
| Guards | All API route handlers | Blocks execution before handler runs |

### Traceability

- **FR**: FR-SEC-04 (role-based access control), FR-SEC-05 (permission enforcement per endpoint)
- **NFR**: NFR 11.3.5 (principle of least privilege), NFR 11.3.6 (403 on unauthorized access)

---

## 4.3 Context Bar State

### Purpose and Responsibility

The Context Bar State component maintains the user's working context — fiscal year, active version, optional comparison version, academic period, and scenario — persistently across all navigation events. It ensures that every module page renders data for the same version and period without requiring the user to re-select context after navigating.

### Internal Modules

| Module | Responsibility |
| --- | --- |
| `WorkspaceContextProvider` | React Context provider wrapping the application shell; holds canonical state and exposes update functions |
| `useWorkspaceContext` | Custom hook consumed by every module page to read and modify the active context |
| `ContextBarUI` | Persistent header component rendering dropdowns for fiscal year, version, comparison version, period, and scenario |
| `ContextSyncService` | Server-side persistence of context per session and bidirectional URL query-parameter synchronization |

### Key TypeScript Interfaces

```typescript
interface WorkspaceContext {
 fiscalYear: number;
 versionId: number;
 comparisonVersionId: number | null;
 academicPeriod: 'AY1' | 'AY2' | 'FULL_YEAR';
 scenario: 'Base' | 'Optimistic' | 'Pessimistic';
}

interface WorkspaceContextActions {
 setFiscalYear(year: number): void;
 setVersion(versionId: number): void;
 setComparisonVersion(versionId: number | null): void;
 setAcademicPeriod(period: WorkspaceContext['academicPeriod']): void;
 setScenario(scenario: WorkspaceContext['scenario']): void;
}

type WorkspaceContextValue = WorkspaceContext & WorkspaceContextActions;
```

### Server Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/v1/context` | Returns the stored `WorkspaceContext` for the current session |
| `PATCH` | `/api/v1/context` | Partial update of any context fields; returns the merged result |

### URL Synchronization

The `ContextSyncService` keeps URL query parameters (`?fiscalYear=2026&versionId=3&comparisonVersionId=5&period=AY1&scenario=Base`) in lockstep with the React state via `useSearchParams`. On initial page load, URL parameters take precedence over server-side stored context, enabling deep-linking and bookmarking. When the user changes context via the UI, both the URL and the server-side record are updated.

### Component Interactions

| Direction | Partner | Mechanism |
| --- | --- | --- |
| Provides context to | Every module page (Revenue, DHG, Staff Costs, P&L) | React Context (`useWorkspaceContext`) |
| Calls | Version Manager API | Fetches version list for dropdowns |
| Calls | Context API | `GET`/`PATCH /api/v1/context` for persistence |
| Consumed by | Calculation Engine triggers | Reads `versionId` and `scenario` to scope computation |

### Traceability

- **FR**: FR-CTX-01 (persistent context bar), FR-CTX-02 (version comparison selection), FR-CTX-03 (deep-linkable URLs)
- **NFR**: NFR 11.1.1 (context switch latency < 500ms)

---

## 4.4 Calculation Engine

### Purpose and Responsibility

The Calculation Engine contains all financial computation logic for BudFin. It is a set of pure TypeScript functions that accept structured domain inputs and return fully computed output arrays. Every monetary value is represented as a `Decimal` instance (Decimal.js with precision 20, `ROUND_HALF_UP`). The engine never performs database I/O; callers are responsible for loading inputs and persisting results. Calculations are invoked explicitly via a Calculate button (PRD requirement D-004), never implicitly.

```typescript
import Decimal from 'decimal.js';
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });
```

The engine is decomposed into four sub-engines: Revenue, DHG (Dotation Horaire Globale), Staff Cost, and P&L.

### 4.4.1 Revenue Engine

**Purpose**

Computes monthly gross and net revenue per grade/nationality/tariff combination by combining enrollment headcount with the fee grid, applying discount policies, and distributing across academic calendar months.

**Key TypeScript Interfaces**

```typescript
interface EnrollmentDetailRow {
 gradeLevel: string;
 nationality: string;
 tariff: string;
 headcount: number;
}

interface FeeGridRow {
 gradeLevel: string;
 nationality: string;
 tariff: string;
 academicPeriod: 'AY1' | 'AY2';
 annualFeeTtc: Decimal;
}

interface DiscountPolicy {
 id: number;
 name: string;
 discountPercent: Decimal;
 eligibilityCriteria: Record<string, unknown>;
}

interface OtherRevenueItem {
 category: string;
 month: number;
 amount: Decimal;
 description: string;
}

interface RevenueEngineInput {
 enrollmentDetail: EnrollmentDetailRow[];
 feeGrid: FeeGridRow[];
 discountPolicies: DiscountPolicy[];
 otherRevenueItems: OtherRevenueItem[];
 academicWeeks: number;  // 36 per TC-005
}

interface MonthlyRevenueRow {
 versionId: number;
 academicPeriod: 'AY1' | 'AY2';
 gradeLevel: string;
 nationality: string;
 tariff: string;
 month: number;
 grossRevenueHt: Decimal;
 discountAmount: Decimal;
 netRevenueHt: Decimal;
 vatAmount: Decimal;
}

function calculateRevenue(input: RevenueEngineInput): MonthlyRevenueRow[];

function distributeAcrossMonths(
 annualAmount: Decimal,
 method: DistributionMethod,
 weights?: number[],
): Map<number, Decimal>;

type DistributionMethod = 'equal' | 'weighted' | 'academic_calendar';
```

#### Revenue Formula

```text
Revenue_month = Headcount × NetFee / PeriodMonths
```

- **AY1** (months 1–6): `PeriodMonths = 6`
- **AY2** (months 9–12): `PeriodMonths = 4`
- **Summer** (months 7–8, Jul–Aug): Revenue = 0

#### VAT Treatment

Saudi nationals (`nationality = 'Nationaux'`) are VAT-exempt (0%). All other nationalities incur 15% VAT. The fee grid stores TTC (tax-inclusive) amounts; the engine derives HT values:

```text
TuitionHT = TuitionTTC / (1 + vatRate)
```

#### Discount Mutual Exclusivity

When a student qualifies for multiple discount policies, the engine applies only the single policy with the highest `discountPercent`. The engine sorts applicable policies by `discountPercent` descending and takes the first.

### 4.4.2 DHG Engine

**Purpose**

Computes Full-Time Equivalent (FTE) teaching requirements by grade level based on enrollment-driven section counts and the subject-hours grille.

**Key TypeScript Interfaces**

```typescript
interface DHGGrilleRow {
 gradeLevel: string;
 subject: string;
 hoursPerWeekPerSection: number;
}

interface DHGResult {
 gradeLevel: string;
 enrollment: number;
 maxClassSize: number;
 sectionsNeeded: number;
 totalWeeklyHours: Decimal;
 totalAnnualHours: Decimal;
 fte: Decimal;
}

function calculateSectionsNeeded(enrollment: number, maxClassSize: number): number {
 return Math.ceil(enrollment / maxClassSize);
}

function calculateFTE(
 gradeLevel: string,
 sectionsNeeded: number,
 grille: DHGGrilleRow[],
): Decimal {
 const totalWeeklyHours = grille
  .filter(g => g.gradeLevel === gradeLevel)
  .reduce(
   (sum, g) => sum.plus(new Decimal(g.hoursPerWeekPerSection).mul(sectionsNeeded)),
   new Decimal(0),
  );
 return totalWeeklyHours.div(new Decimal(18)); // standard ORS divisor
}

function calculateDHG(
 enrollment: EnrollmentDetailRow[],
 grille: DHGGrilleRow[],
 maxClassSizes: Record<string, number>,
 academicWeeks: number,
): DHGResult[];
```

#### Annual Hours

`Annual hours = Weekly hours × academicWeeks` where `academicWeeks` defaults to 36 (stored in `system_config`, configurable by Admin).

### 4.4.3 Staff Cost Engine

**Purpose**

Computes monthly staff costs for every employee including base gross, September augmentation step-change, GOSI contributions, Ajeer levies, and End-of-Service (EoS) provision accruals.

**Key TypeScript Interfaces**

```typescript
interface Employee {
 id: number;
 isSaudi: boolean;
 isTeaching: boolean;
 isNewStaff: boolean;
 baseSalary: Decimal;
 housingAllowance: Decimal;
 transportAllowance: Decimal;
 responsibilityPremium: Decimal;
 hsaAmount: Decimal;
 augmentationPercent: Decimal;
 hireDate: Date;
 ajeerAnnualLevy: Decimal;
 ajeerMonthlyFee: Decimal;
}

interface MonthlyStaffCostRow {
 employeeId: number;
 month: number;
 baseGross: Decimal;
 adjustedGross: Decimal;
 gosiAmount: Decimal;
 ajeerAmount: Decimal;
 eosMonthlyAccrual: Decimal;
 totalCost: Decimal;
}

function calculateMonthlyGross(employee: Employee, month: number): Decimal;
function calculateGOSI(employee: Employee, monthlyGross: Decimal): Decimal;
function calculateAjeer(employee: Employee, isNewStaff: boolean, month: number): Decimal;
function calculateEoSProvision(employee: Employee, asOfDate: Date): Decimal;
function yearFrac(startDate: Date, endDate: Date): Decimal;
```

#### YEARFRAC US 30/360 Algorithm (TC-002)

This algorithm must be implemented exactly as specified to match Excel `YEARFRAC(start, end, 0)`:

```typescript
function yearFrac(d1: Date, d2: Date): Decimal {
 let day1 = d1.getDate();
 let month1 = d1.getMonth() + 1;
 let year1 = d1.getFullYear();
 let day2 = d2.getDate();
 let month2 = d2.getMonth() + 1;
 let year2 = d2.getFullYear();

 if (day1 === 31) day1 = 30;
 if (day2 === 31 && day1 >= 30) day2 = 30;

 const days = (year2 - year1) * 360 + (month2 - month1) * 30 + (day2 - day1);
 return new Decimal(days).div(360);
}
```

#### End-of-Service (EoS) Formula

EoS base is composed of: `base_salary + housing_allowance + transport_allowance + responsibility_premium`. HSA is explicitly excluded.

- **Years of Service (YoS) ≤ 5**: `EoSAnnual = (EoSBase / 2) × YoS`
- **YoS > 5**: `EoSAnnual = (EoSBase / 2 × 5) + EoSBase × (YoS - 5)`
- **Monthly accrual**: `EoSAnnual / 12`

YoS is computed via `yearFrac(hireDate, asOfDate)`.

#### September Step-Change

Months 1–8 (Jan–Aug) use the pre-augmentation salary. Months 9–12 (Sep–Dec) apply the augmentation percentage to the base salary and all affected allowances. This models the annual salary review cycle that takes effect each September.

#### HSA Exclusion for Teaching Staff

For employees where `isTeaching = true`, months 7 (July) and 8 (August) set `hsaAmount = 0` because teaching staff do not receive the housing and sustenance allowance during summer months.

#### GOSI Calculation

Applies only to Saudi nationals (`isSaudi = true`): `GOSI = 11.75% × full monthly gross`. For non-Saudi employees, `gosiAmount = 0`.

#### Ajeer Calculation

- **Existing staff** (non-Saudi, `isNewStaff = false`): `(ajeerAnnualLevy / 12) + ajeerMonthlyFee` applied for all 12 months.
- **New staff** (non-Saudi, `isNewStaff = true`): Ajeer applies only for Sep–Dec (months 9–12). The annual levy is prorated to 4 months: `(ajeerAnnualLevy / 12) × 1 + ajeerMonthlyFee` per month for those 4 months.
- **Saudi employees**: `ajeerAmount = 0`.

### 4.4.4 P&L Engine

**Purpose**

Aggregates monthly revenue and cost outputs from the other sub-engines into a consolidated Profit & Loss statement, applying IFRS line-item mapping.

**Key TypeScript Interfaces**

```typescript
interface IFRSMapping {
 sourceCategory: string;
 targetLineItem: string;
 sign: 'positive' | 'negative';
}

interface MonthlyPnLRow {
 month: number;
 totalRevenueHt: Decimal;
 totalStaffCosts: Decimal;
 grossProfit: Decimal;
 otherOperatingExpenses: Decimal;
 ebitda: Decimal;
 depreciationAmortization: Decimal;
 operatingProfit: Decimal;
 financeIncome: Decimal;
 financeCosts: Decimal;
 profitBeforeZakat: Decimal;
 zakat: Decimal;
 netProfit: Decimal;
}

function calculatePnL(
 monthlyRevenue: MonthlyRevenueRow[],
 monthlyStaffCosts: MonthlyStaffCostRow[],
 otherItems: OtherRevenueItem[],
 ifrsMapping: IFRSMapping[],
): MonthlyPnLRow[];
```

#### Zakat Calculation

Zakat is Saudi Arabia's religious tax applied at 2.5% on positive profit before Zakat only. When profit before Zakat is zero or negative, Zakat is zero:

```text
Zakat = IF(profitBeforeZakat > 0, profitBeforeZakat × 0.025, 0)
```

### Calculation Engine — Component Interactions

| Direction | Partner | Mechanism |
| --- | --- | --- |
| Called by | API route handlers (POST /api/v1/calculations/run) | Direct function call with loaded input data |
| Reads from | Prisma client (via caller) | Callers load enrollment, fees, employees, config |
| Writes to | Prisma client (via caller) | Callers persist monthly output rows |
| Depends on | Decimal.js | All monetary arithmetic |

### Calculation Engine — Traceability

- **FR**: FR-REV-01 (revenue calculation), FR-REV-02 (VAT treatment), FR-REV-03 (discount application), FR-DHG-01 (FTE computation), FR-DHG-02 (section calculation), FR-STC-01 (staff cost calculation), FR-STC-02 (GOSI/Ajeer), FR-STC-03 (EoS provision), FR-PNL-01 (P&L aggregation), FR-PNL-02 (Zakat)
- **NFR**: NFR 11.2.1 (Decimal.js mandatory for monetary values), NFR 11.2.2 (precision 20, ROUND_HALF_UP), NFR 11.2.3 (YEARFRAC US 30/360 exact match)

---

## 4.5 Version Manager

### Purpose and Responsibility

The Version Manager governs the full lifecycle of budget versions: creation, cloning, status transitions, and side-by-side comparison. It enforces a strict state machine that prevents unauthorized modifications to published or locked versions and provides deep-clone semantics for creating new drafts from existing versions.

### Internal Modules

| Module | Responsibility |
| --- | --- |
| `VersionCRUD` | Create, read, update, and delete operations on the `budget_versions` table |
| `VersionLifecycle` | State machine enforcement (Draft → Published → Locked → Archived) with role-gated transitions |
| `VersionCloner` | Deep-copy of all version-scoped data into a new Draft version within a single database transaction |
| `VersionComparator` | Joins two versions' `monthly_budget_summary` tables and computes absolute and percentage variances |

### Key TypeScript Interfaces

```typescript
type VersionStatus = 'Draft' | 'Published' | 'Locked' | 'Archived';

interface BudgetVersion {
 id: number;
 fiscalYear: number;
 name: string;
 status: VersionStatus;
 createdBy: number;
 createdAt: Date;
 publishedAt: Date | null;
 lockedAt: Date | null;
}

interface VersionService {
 create(fiscalYear: number, name: string, userId: number): Promise<BudgetVersion>;
 clone(sourceVersionId: number, newName: string, userId: number): Promise<BudgetVersion>;
 transition(
  versionId: number,
  targetStatus: VersionStatus,
  userId: number,
  auditNote?: string,
 ): Promise<BudgetVersion>;
 compare(
  primaryVersionId: number,
  comparisonVersionId: number,
 ): Promise<VersionComparisonResult[]>;
}

interface VersionComparisonResult {
 lineItem: string;
 month: number;
 primaryAmount: Decimal;
 comparisonAmount: Decimal;
 absoluteVariance: Decimal;
 percentageVariance: Decimal | null; // null when comparison is zero (N/A)
}
```

### Lifecycle State Machine

```text
Draft ──publish──▶ Published ──lock──▶ Locked ──archive──▶ Archived
                      ▲
                      │ (reverse: requires Admin role + mandatory audit note)
                      │
                   Locked ──unpublish──
```

Allowed transitions:

- **Draft → Published**: requires `versions:publish` permission.
- **Published → Locked**: requires `versions:publish` permission.
- **Locked → Archived**: requires Admin role.
- **Locked → Published** (reverse): requires Admin role and a non-empty `auditNote` explaining the reason for reversal. The audit note is recorded in `audit_entries`.

All data-modifying operations (edit, calculate, import) are restricted to versions in `Draft` status.

### Clone Operation

The clone creates a new `Draft` version and deep-copies the following version-scoped tables within a single Prisma interactive transaction: `employees`, `fee_grids`, `enrollment_headcount`, `enrollment_detail`, `discount_policies`, `other_revenue_items`, and `scenario_parameters`. The source version remains unchanged. Foreign key references within the cloned data are remapped to point to the new version's ID.

### Comparison Engine

The comparator joins two versions on `(line_item, month)` from `monthly_budget_summary` and computes:

- **Absolute variance**: `primary_amount - comparison_amount`
- **Percentage variance**: `(primary_amount - comparison_amount) / ABS(comparison_amount) × 100`

When `comparison_amount` is zero, percentage variance is set to `null` and rendered as "N/A" in the UI to avoid division-by-zero errors.

### Component Interactions

| Direction | Partner | Mechanism |
| --- | --- | --- |
| Called by | API route handlers (version CRUD and comparison endpoints) | Direct function call |
| Calls | Prisma client | Interactive transactions for clone; standard queries for CRUD |
| Calls | Audit Logger | Prisma middleware (automatic on all mutations) |
| Consumed by | Context Bar State | Version list populates dropdown selections |

### Traceability

- **FR**: FR-VER-01 (version CRUD), FR-VER-02 (lifecycle state machine), FR-VER-03 (deep clone), FR-VER-04 (version comparison with variance), FR-VER-05 (status-gated editing)
- **NFR**: NFR 11.4.1 (transactional clone integrity), NFR 11.4.2 (comparison query performance < 2s)

---

## 4.6 Audit Logger

### Purpose and Responsibility

The Audit Logger provides an automatic, append-only audit trail for every data mutation in the system. It is implemented as Prisma client extension middleware, ensuring that no code path can bypass logging. The audit log captures the full before-and-after state of every INSERT, UPDATE, and DELETE operation.

### Internal Modules

| Module | Responsibility |
| --- | --- |
| `PrismaAuditExtension` | Prisma `$extends` middleware that intercepts `create`, `update`, and `delete` operations on all models |
| `AuditEntryWriter` | Low-level INSERT-only writer to the `audit_entries` table |
| `AuditContextProvider` | Extracts `userId`, `ipAddress`, and `sessionId` from the current request context via AsyncLocalStorage |

### Key TypeScript Interfaces

```typescript
interface AuditEntry {
 id: number;
 timestamp: Date;          // TIMESTAMPTZ, set by DB default NOW()
 userId: number;
 tableName: string;
 recordId: number;
 operation: 'INSERT' | 'UPDATE' | 'DELETE';
 oldValues: Record<string, unknown> | null;  // null for INSERT
 newValues: Record<string, unknown> | null;  // null for DELETE
 ipAddress: string;
 sessionId: string;
}

// Prisma extension setup
function createAuditedPrismaClient(basePrisma: PrismaClient): PrismaClient {
 return basePrisma.$extends({
  query: {
   $allModels: {
    async create({ args, query }) {
     const result = await query(args);
     await writeAuditEntry('INSERT', null, result);
     return result;
    },
    async update({ args, query }) {
     const before = await findExisting(args);
     const result = await query(args);
     await writeAuditEntry('UPDATE', before, result);
     return result;
    },
    async delete({ args, query }) {
     const before = await findExisting(args);
     const result = await query(args);
     await writeAuditEntry('DELETE', before, null);
     return result;
    },
   },
  },
 });
}
```

### Append-Only Enforcement

The PostgreSQL database role `app_user` (used by the application at runtime) is granted only `INSERT` on `audit_entries`. `UPDATE` and `DELETE` privileges are revoked in the schema DDL:

```sql
GRANT INSERT ON audit_entries TO app_user;
REVOKE UPDATE, DELETE ON audit_entries FROM app_user;
```

This ensures that even if application code were compromised, it could not tamper with or erase audit records.

### Salary Field Handling

When logging changes to the `employees` table, salary-related fields (`base_salary`, `housing_allowance`, `transport_allowance`, `responsibility_premium`, `hsa_amount`) are stored encrypted at rest via PostgreSQL pgcrypto. The audit logger records the encrypted column value as-is. It does not decrypt salary data for the audit log. The audit entry `description` field notes that salary values are encrypted.

### Component Interactions

| Direction | Partner | Mechanism |
| --- | --- | --- |
| Called by | Prisma client (automatic via `$extends` middleware) | Transparent interception |
| Calls | PostgreSQL `audit_entries` table | Direct INSERT via Prisma raw or model |
| Reads from | AsyncLocalStorage | Retrieves `userId`, `ipAddress`, `sessionId` from request context |
| Consumed by | Admin audit trail UI | Read-only query endpoint for Admin role |

### Traceability

- **FR**: FR-AUD-01 (automatic audit logging), FR-AUD-02 (before/after state capture), FR-AUD-03 (append-only guarantee)
- **NFR**: NFR 11.3.7 (audit log cannot be modified by application), NFR 11.3.8 (all mutations logged without exception), NFR 11.6.1 (salary field encryption in logs)

---

## 4.7 Export Service

### Purpose and Responsibility

The Export Service generates downloadable files in xlsx, PDF, and CSV formats from budget data. Exports run asynchronously via a background job system to avoid blocking HTTP request threads during large file generation. Generated files are stored server-side with a 1-hour expiry.

### Internal Modules

| Module | Responsibility |
| --- | --- |
| `ExportJobManager` | Creates job records, polls for pending jobs, updates status on completion |
| `ExcelExporter` | Generates xlsx files using ExcelJS with stream-based writing for memory efficiency |
| `PdfExporter` | Renders React components to HTML and prints to PDF via headless Puppeteer |
| `CsvExporter` | Generates CSV files using fast-csv with UTF-8 BOM for Excel compatibility |
| `FileCleanupWorker` | Periodic job that deletes expired export files from local storage |

### Key TypeScript Interfaces

```typescript
type ExportFormat = 'xlsx' | 'pdf' | 'csv';
type ExportStatus = 'pending' | 'processing' | 'done' | 'failed';

interface ExportJob {
 id: number;
 userId: number;
 versionId: number;
 format: ExportFormat;
 reportType: string;
 status: ExportStatus;
 filePath: string | null;
 fileSizeBytes: number | null;
 expiresAt: Date | null;
 errorMessage: string | null;
 createdAt: Date;
 completedAt: Date | null;
}

interface ExportService {
 createJob(
  userId: number,
  versionId: number,
  format: ExportFormat,
  reportType: string,
 ): Promise<{ jobId: number }>;
 getJobStatus(jobId: number): Promise<ExportJob>;
 downloadFile(jobId: number): Promise<NodeJS.ReadableStream>;
}
```

### Job Lifecycle

1. **POST /api/v1/export/jobs**: Client submits export request with `versionId`, `format`, and `reportType`. The service creates an `export_jobs` record with `status = 'pending'` and returns `{ jobId }`.
2. **Worker picks up job**: A background worker polls the `export_jobs` table every 5 seconds for `pending` jobs (alternatively, a `pg_notify` channel triggers immediate pickup). The worker sets `status = 'processing'`.
3. **File generation**: The appropriate exporter module generates the file and writes it to local storage. On completion, the worker updates `status = 'done'`, sets `file_path`, `file_size_bytes`, and `expires_at = NOW() + INTERVAL '1 hour'`.
4. **GET /api/v1/export/jobs/:id**: Client polls for job status. Returns `{ status, downloadUrl? }` where `downloadUrl` is populated only when `status = 'done'`.
5. **GET /api/v1/export/jobs/:id/download**: Serves the generated file. Returns 410 Gone if `NOW() > expires_at`.

### Format-Specific Details

- **ExcelJS (xlsx)**: Uses streaming `workbook.xlsx.write(stream)` for large datasets. Column widths are explicitly set to match PRD specifications (NFR 11.10). Monetary cells use number format `#,##0.00 "SAR"`. Headers are bold with frozen panes.
- **Puppeteer (PDF)**: Renders the target React report component to static HTML, launches a headless Chromium instance, and calls `page.pdf()` with A4 landscape format for P&L reports and A4 portrait for other reports. Page margins, headers, and footers are configured via the Puppeteer print options.
- **fast-csv (CSV)**: Uses streaming write mode. Prepends UTF-8 BOM (`\uFEFF`) to the output stream so that Microsoft Excel correctly detects the encoding. Column headers match the database field names in snake_case.

### Component Interactions

| Direction | Partner | Mechanism |
| --- | --- | --- |
| Called by | API route handlers (export endpoints) | Direct function call (job creation); worker picks up asynchronously |
| Calls | Prisma client | Reads version data for report generation |
| Calls | ExcelJS, Puppeteer, fast-csv | File generation libraries |
| Calls | Local filesystem | File storage (write on generation, read on download, delete on expiry) |

### Traceability

- **FR**: FR-EXP-01 (xlsx export), FR-EXP-02 (PDF export), FR-EXP-03 (CSV export), FR-EXP-04 (asynchronous generation)
- **NFR**: NFR 11.10 (column width preservation in xlsx), NFR 11.9.1 (export file size < 50MB), NFR 11.9.2 (export generation < 30s for standard reports)

---

## 4.8 Data Import Service

### Purpose and Responsibility

The Data Import Service handles ingestion of external data files (CSV for enrollment, xlsx for employee/staff cost data) into versioned budget datasets. It implements a strict two-phase workflow: a validation phase that parses and checks every row without writing to the database, followed by a commit phase that writes all validated rows in a single atomic transaction.

### Internal Modules

| Module | Responsibility |
| --- | --- |
| `FileParser` | Detects file type and delegates to the appropriate parser (csv-parse for CSV, ExcelJS for xlsx) |
| `EnrollmentValidator` | Validates enrollment CSV rows: grade code existence, non-negative headcount, academic year format |
| `EmployeeValidator` | Validates employee xlsx rows: required fields present, salary fields non-negative, date format validation, duplicate employee detection |
| `ImportCommitter` | Writes validated data to the database within a Prisma interactive transaction; rolls back entirely on any failure |

### Key TypeScript Interfaces

```typescript
interface ImportError {
 row: number;
 field: string;
 message: string;
}

interface ImportResult {
 totalRows: number;
 validRows: number;
 errorRows: number;
 errors: ImportError[];
 preview: Record<string, unknown>[];  // First 5 valid rows for UI preview
}

interface ImportService {
 validateEnrollmentCSV(file: Buffer): Promise<ImportResult>;
 commitEnrollmentCSV(
  file: Buffer,
  versionId: number,
  userId: number,
 ): Promise<void>;
 validateEmployeeXlsx(file: Buffer): Promise<ImportResult>;
 commitEmployeeXlsx(
  file: Buffer,
  versionId: number,
  userId: number,
 ): Promise<void>;
}
```

### Two-Phase Workflow

**Phase 1 — Validate**: The client uploads a file to `POST /api/v1/import/validate?type=enrollment` (or `type=employee`). The service parses every row, runs all validation rules, and returns an `ImportResult` containing counts, errors, and a 5-row preview. No data is written to the database. The client displays the preview and error list to the user.

**Phase 2 — Commit**: If the user confirms after reviewing the preview, the client calls `POST /api/v1/import/commit?type=enrollment&versionId=3`. The service re-parses the file (the original file is held in memory or temporary storage from the validate phase), writes all valid rows to the database within a single Prisma interactive transaction, and returns success. If any row fails during the commit (unexpected constraint violation), the entire transaction is rolled back and the error is returned.

### Expected File Formats

**Enrollment CSV**: `level_code,student_count,academic_year` — e.g., `PS,42,2025-26`. The `level_code` must match a known grade in the `grade_levels` reference table. `student_count` must be a non-negative integer. `academic_year` must match the pattern `YYYY-YY`.

**Employee xlsx**: Uses ExcelJS to read the Staff Costs workbook format. Expected columns include employee ID, name, nationality, Saudi status, contract type, base salary, housing allowance, transport allowance, responsibility premium, HSA amount, hire date, and department. The validator checks that all required columns are present, salary fields are non-negative Decimal-parseable values, and dates follow ISO 8601 format.

### Validation Rules

| Rule | Applies To | Description |
| --- | --- | --- |
| Unknown grade code | Enrollment CSV | `level_code` not found in `grade_levels` table |
| Negative headcount | Enrollment CSV | `student_count < 0` |
| Invalid year format | Enrollment CSV | `academic_year` does not match `YYYY-YY` |
| Duplicate employee | Employee xlsx | Same `employee_id` appears multiple times in file |
| Missing required field | Employee xlsx | Any required column is empty or missing |
| Negative salary | Employee xlsx | Any salary/allowance field is negative |
| Invalid date | Employee xlsx | `hire_date` is not a valid ISO 8601 date |

### Component Interactions

| Direction | Partner | Mechanism |
| --- | --- | --- |
| Called by | API route handlers (import endpoints) | Direct function call |
| Calls | Prisma client | Interactive transaction for commit phase; read-only queries for validation (grade lookup) |
| Calls | csv-parse, ExcelJS | File parsing libraries |
| Calls | Audit Logger | Prisma middleware (automatic on all INSERTs during commit) |
| Guarded by | Version Manager | Import is rejected if target version is not in `Draft` status |

### Traceability

- **FR**: FR-IMP-01 (CSV enrollment import), FR-IMP-02 (xlsx employee import), FR-IMP-03 (two-phase validate-then-commit), FR-IMP-04 (preview before commit), FR-IMP-05 (error report with row-level detail)
- **NFR**: NFR 11.8.1 (atomic commit — all or nothing), NFR 11.8.2 (validation < 5s for 10,000 rows), NFR 11.8.3 (clear error messages with row numbers)

---

## 4.9 Data Grid (UI Component)

### Purpose and Responsibility

The Data Grid component renders financial data tables across all module pages: enrollment grids, fee grids, revenue results, staff cost breakdowns, and the P&L summary. It provides sortable columns, client-side filtering, pagination, keyboard navigation, and virtual scrolling for large datasets.

### Technology Choice

**TanStack Table v8 + TanStack Virtual v3 + shadcn/ui `<Table>`** (replaces AG Grid Community from TDD v1.0). See ADR-011 in `09_decisions_log.md`.

| Responsibility | Library |
| --- | --- |
| Table logic (sorting, filtering, pagination, row selection) | `@tanstack/react-table` v8 |
| Virtual scrolling for datasets > 100 rows | `@tanstack/react-virtual` v3 |
| Table rendering (HTML structure, accessibility) | shadcn/ui `<Table>`, `<TableHeader>`, `<TableBody>`, `<TableRow>`, `<TableCell>` |
| Styling | Tailwind CSS v4 |

### Internal Modules

| Module | Responsibility |
| --- | --- |
| `useFinancialTable` | Custom hook wrapping `useReactTable`; configures sort, filter, pagination; memoizes column definitions |
| `VirtualTableBody` | Renders only visible rows via `useVirtualizer`; used for datasets > 100 rows |
| `TablePagination` | shadcn/ui-based pagination controls; wired to TanStack Table `manualPagination` for server-side paging |
| `ColumnHeader` | Sortable column header component with sort direction indicator |

### Key Patterns

- Column definitions are created once with `useMemo` and passed to `useReactTable` — never recreated on render.
- For virtual scrolling: the `<TableBody>` renders a spacer element above and below the visible rows to maintain correct scroll height.
- For server-side pagination (audit log): `manualPagination: true` with `pageCount` driven by TanStack Query metadata.
- Monetary cell values are formatted using `Decimal.js` `toFixed(2)` with `ROUND_HALF_UP` for display per TC-004.

### Component Interactions

| Direction | Partner | Mechanism |
| --- | --- | --- |
| Receives data from | TanStack Query (`useQuery` / `useSuspenseQuery`) | Server state passed as `data` prop |
| Reads context from | `useWorkspaceContext` | Scopes queries to active `versionId` and `academicPeriod` |
| Consumes | shadcn/ui `<Table>` primitives | Copy-paste components in `src/components/ui/table.tsx` |

### Traceability

- **NFR**: NFR 11.4 (data grid render < 500ms), NFR 11.4 (keyboard navigation), NFR Accessibility (WCAG AA via shadcn/ui Radix primitives)
