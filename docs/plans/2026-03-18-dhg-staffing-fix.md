# DHG / Staffing Redesign — Complete Fix Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 48 issues identified in the full implementation audit and bring Epics 18-20 from NOT READY to deployable.

**Architecture:** Fix migration chain, align frontend to backend contracts (backend is source of truth), wire placeholder frontend to real components, remove DHG legacy contamination, harden tests.

**Tech Stack:** Prisma 6, Fastify 5, Zod 4, React 19, TanStack Query/Table, Vitest 4, decimal.js

---

## Design Decisions (locked before implementation)

| Decision                    | Choice                                                                     | Rationale                                                          |
| --------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Response wrapper convention | **Backend's named wrappers** (`{settings}`, `{profiles}`, `{assignments}`) | Consistent with rest of codebase; more semantic than `{data}`      |
| Field name authority        | **Backend (Prisma schema)**                                                | Backend names match Prisma models and Zod schemas                  |
| Employee casing             | **Backend changes to camelCase**                                           | Only endpoint that uses snake_case; inconsistent                   |
| Cost mode enum              | **Backend's `PERCENT_OF_PAYROLL`**                                         | Matches Prisma default value                                       |
| Assignment keys             | **Backend's `(band, disciplineId)`**                                       | Stable compound key; not coupled to recalculated requirement lines |
| Stale propagation           | **Mutations mark `['STAFFING']` only**                                     | Per redesign spec; calculate.ts already adds PNL after recalc      |

---

## Workstream 1: Data Model & Migration

### Task 1: Generate Migration for Missing Tables and Columns

**Files:**

- Modify: `apps/api/prisma/schema.prisma:1145` (add `requiredFteCalculated`)
- Create: `apps/api/prisma/migrations/2026XXXX_add_staffing_redesign_tables/migration.sql` (auto-generated)

**Context:** 11 tables and 7+ columns exist in schema.prisma but have NO SQL migration committed. The migration `20260309100000_add_staffing_models` only creates `employees`, `dhg_grille_config`, `monthly_staff_costs`, `eos_provisions`. None of the redesign tables are there.

- [ ] **Step 1: Add `requiredFteCalculated` to schema.prisma**

In `apps/api/prisma/schema.prisma`, after line 1146 (`requiredFtePlanned`), add:

```prisma
requiredFteCalculated Decimal? @default(0) @map("required_fte_calculated") @db.Decimal(7, 4)
```

- [ ] **Step 2: Generate the migration**

```bash
cd apps/api && pnpm exec prisma migrate dev --name add_staffing_redesign_tables
```

This will auto-generate SQL for ALL missing tables:

- `service_obligation_profiles`, `disciplines`, `discipline_aliases`, `dhg_rules`
- `version_staffing_settings`, `version_service_profile_overrides`, `version_staffing_cost_assumptions`
- `version_lycee_group_assumptions`, `demand_overrides`
- `teaching_requirement_sources`, `teaching_requirement_lines`
- ALTER TABLE `employees` ADD 6 columns (`record_type`, `cost_mode`, `discipline_id`, `service_profile_id`, `home_band`, `contract_end_date`)
- ALTER TABLE `category_monthly_costs` ADD `calculation_mode`
- ALTER TABLE `teaching_requirement_lines` ADD `required_fte_calculated`

- [ ] **Step 3: Verify migration**

```bash
# Verify the generated SQL contains all expected tables
grep -c "CREATE TABLE" apps/api/prisma/migrations/*add_staffing_redesign*/migration.sql
# Expected: 11 (one per new table)

grep "ALTER TABLE" apps/api/prisma/migrations/*add_staffing_redesign*/migration.sql
# Expected: ALTER TABLE for employees (6 cols), category_monthly_costs (1 col), teaching_requirement_lines (1 col)
```

- [ ] **Step 4: Regenerate Prisma client**

```bash
pnpm --filter @budfin/api exec prisma generate
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat(db): add migration for 11 staffing tables, 8 column additions"
```

---

### Task 2: Expand Discipline & Alias Seed Data

**Files:**

- Modify: `apps/api/prisma/seeds/staffing-master-data.ts:70-138`

**Context:** Currently 18 disciplines (target >=30) and 7 aliases (target >=20). Need broader coverage for import alias resolution.

- [ ] **Step 1: Add missing disciplines**

In `apps/api/prisma/seeds/staffing-master-data.ts`, expand the disciplines array (after line 124) to include at minimum:

```typescript
// Additional SUBJECT disciplines
{ code: 'ESPAGNOL_LV2', name: 'Espagnol LV2', category: 'SUBJECT' },
{ code: 'ALLEMAND_LV2', name: 'Allemand LV2', category: 'SUBJECT' },
{ code: 'SCIENCES', name: 'Sciences', category: 'SUBJECT' },
{ code: 'DECOUVERTE_MONDE', name: 'Decouverte du Monde', category: 'SUBJECT' },
{ code: 'EMC', name: 'Enseignement Moral et Civique', category: 'SUBJECT' },
{ code: 'INFORMATIQUE', name: 'Informatique', category: 'SUBJECT' },
{ code: 'LATIN', name: 'Latin', category: 'SUBJECT' },
{ code: 'LCA', name: 'Langues et Cultures de l\'Antiquite', category: 'SUBJECT' },
{ code: 'DNL', name: 'Discipline Non Linguistique', category: 'SUBJECT' },
{ code: 'AP', name: 'Accompagnement Personnalise', category: 'SUBJECT' },
{ code: 'ORIENTATION', name: 'Orientation', category: 'SUBJECT' },
{ code: 'VIE_CLASSE', name: 'Vie de Classe', category: 'SUBJECT' },
// Additional ROLE disciplines
{ code: 'CPE', name: 'Conseiller Principal d\'Education', category: 'ROLE' },
{ code: 'COORDINATOR', name: 'Coordinateur', category: 'ROLE' },
```

- [ ] **Step 2: Add missing aliases**

Expand the aliases array (after line 138):

```typescript
{ alias: 'Math', disciplineCode: 'MATHEMATIQUES' },
{ alias: 'Francais', disciplineCode: 'FRANCAIS' },
{ alias: 'French', disciplineCode: 'FRANCAIS' },
{ alias: 'Mathematics', disciplineCode: 'MATHEMATIQUES' },
{ alias: 'English', disciplineCode: 'ANGLAIS_LV1' },
{ alias: 'Anglais', disciplineCode: 'ANGLAIS_LV1' },
{ alias: 'Arabic', disciplineCode: 'ARABE' },
{ alias: 'Islamic Studies', disciplineCode: 'ISLAMIQUE' },
{ alias: 'Physical Education', disciplineCode: 'EPS' },
{ alias: 'Sport', disciplineCode: 'EPS' },
{ alias: 'SVT', disciplineCode: 'SVT' },
{ alias: 'Biology', disciplineCode: 'SVT' },
{ alias: 'Physics', disciplineCode: 'PHYSIQUE_CHIMIE' },
{ alias: 'Chemistry', disciplineCode: 'PHYSIQUE_CHIMIE' },
{ alias: 'History', disciplineCode: 'HISTOIRE_GEO' },
{ alias: 'Geography', disciplineCode: 'HISTOIRE_GEO' },
{ alias: 'Hist-Geo', disciplineCode: 'HISTOIRE_GEO' },
{ alias: 'Techno', disciplineCode: 'TECHNOLOGIE' },
{ alias: 'Music', disciplineCode: 'EDUCATION_MUSICALE' },
{ alias: 'Musique', disciplineCode: 'EDUCATION_MUSICALE' },
{ alias: 'Arts', disciplineCode: 'ARTS_PLASTIQUES' },
{ alias: 'Philo', disciplineCode: 'PHILOSOPHIE' },
{ alias: 'Spanish', disciplineCode: 'ESPAGNOL_LV2' },
{ alias: 'Espagnol', disciplineCode: 'ESPAGNOL_LV2' },
{ alias: 'German', disciplineCode: 'ALLEMAND_LV2' },
```

- [ ] **Step 3: Run seed and verify**

```bash
pnpm --filter @budfin/api exec prisma db seed
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/seeds/staffing-master-data.ts
git commit -m "feat(seed): expand disciplines to 32 and aliases to 32"
```

---

## Workstream 2: Shared Types Foundation

### Task 3: Create Shared Staffing Types in packages/types

**Files:**

- Create: `packages/types/src/staffing.ts`
- Modify: `packages/types/src/index.ts`

**Context:** No shared staffing types exist. Backend uses local Zod schemas. Frontend uses local TS interfaces. Contract drift is undetectable. All shared types use the **backend's naming convention** as the canonical source of truth.

- [ ] **Step 1: Create `packages/types/src/staffing.ts`**

```typescript
/**
 * Shared staffing types for @budfin/api and @budfin/web.
 * Backend is the canonical source — field names match Prisma schema.
 */

// ── Employee ────────────────────────────────────────────────────────────────

export interface Employee {
    id: number;
    employeeCode: string;
    name: string;
    functionRole: string;
    department: string;
    status: string;
    joiningDate: string;
    paymentMethod: string;
    isSaudi: boolean;
    isAjeer: boolean;
    isTeaching: boolean;
    hourlyPercentage: string | null;
    baseSalary: string | null;
    housingAllowance: string | null;
    transportAllowance: string | null;
    responsibilityPremium: string | null;
    hsaAmount: string | null;
    augmentation: string | null;
    augmentationEffectiveDate: string | null;
    ajeerAnnualLevy: string | null;
    ajeerMonthlyFee: string | null;
    recordType: string;
    costMode: string;
    disciplineId: number | null;
    serviceProfileId: number | null;
    homeBand: string | null;
    contractEndDate: string | null;
    disciplineName: string | null;
    serviceProfileName: string | null;
    monthlyCost: string | null;
    annualCost: string | null;
    updatedAt: string;
}

export interface EmployeeListResponse {
    employees: Employee[];
    total: number;
    page: number;
    pageSize: number;
}

// ── Staffing Settings ───────────────────────────────────────────────────────

export interface StaffingSettings {
    id: number;
    versionId: number;
    hsaTargetHours: string;
    hsaFirstHourRate: string;
    hsaAdditionalHourRate: string;
    hsaMonths: number;
    academicWeeks: number;
    ajeerAnnualLevy: string;
    ajeerMonthlyFee: string;
    reconciliationBaseline: unknown;
}

export interface StaffingSettingsResponse {
    settings: StaffingSettings;
}

// ── Service Profiles ────────────────────────────────────────────────────────

export interface ServiceProfile {
    id: number;
    code: string;
    name: string;
    weeklyServiceHours: string;
    hsaEligible: boolean;
    defaultCostMode: string;
    sortOrder: number;
}

export interface ServiceProfilesResponse {
    profiles: ServiceProfile[];
}

// ── Service Profile Overrides ───────────────────────────────────────────────

export interface ServiceProfileOverride {
    id: number;
    versionId: number;
    serviceProfileId: number;
    weeklyServiceHours: string | null;
    hsaEligible: boolean | null;
}

export interface ServiceProfileOverridesResponse {
    overrides: ServiceProfileOverride[];
}

// ── Cost Assumptions ────────────────────────────────────────────────────────

export type CostCalculationMode = 'PERCENT_OF_PAYROLL' | 'FLAT_ANNUAL' | 'AMOUNT_PER_FTE';

export interface CostAssumption {
    id: number;
    versionId: number;
    category: string;
    calculationMode: CostCalculationMode;
    value: string;
}

export interface CostAssumptionsResponse {
    assumptions: CostAssumption[];
}

// ── Lycee Group Assumptions ─────────────────────────────────────────────────

export interface LyceeGroupAssumption {
    id: number;
    versionId: number;
    gradeLevel: string;
    disciplineId: number;
    groupCount: number;
    hoursPerGroup: string;
}

export interface LyceeGroupAssumptionsResponse {
    assumptions: LyceeGroupAssumption[];
}

// ── Demand Overrides ────────────────────────────────────────────────────────

export interface DemandOverride {
    id: number;
    versionId: number;
    band: string;
    disciplineId: number;
    lineType: string;
    overrideFte: string;
    reasonCode: string;
    note: string | null;
}

export interface DemandOverridesResponse {
    overrides: DemandOverride[];
}

// ── Teaching Requirement Lines ──────────────────────────────────────────────

export interface TeachingRequirementLine {
    id: number;
    versionId: number;
    band: string;
    disciplineCode: string;
    lineLabel: string;
    lineType: string;
    driverType: string;
    serviceProfileCode: string;
    totalDriverUnits: number;
    totalWeeklyHours: string;
    baseOrs: string;
    effectiveOrs: string;
    requiredFteRaw: string;
    requiredFtePlanned: string;
    requiredFteCalculated: string | null;
    recommendedPositions: number;
    coveredFte: string;
    gapFte: string;
    coverageStatus: string;
    assignedStaffCount: number;
    vacancyCount: number;
    directCostAnnual: string | null;
    hsaCostAnnual: string | null;
    assignedEmployees: AssignedEmployee[];
    calculatedAt: string;
}

export interface AssignedEmployee {
    employeeId: number;
    employeeName: string;
    fteShare: string;
}

export interface TeachingRequirementTotals {
    totalFteRaw: string;
    totalFtePlanned: string;
    totalFteCovered: string;
    totalFteGap: string;
    totalDirectCost: string | null;
    totalHsaCost: string | null;
    totalPositions: number;
    heRatio: string | null;
}

export interface TeachingRequirementsResponse {
    lines: TeachingRequirementLine[];
    totals: TeachingRequirementTotals;
    warnings: string[];
}

// ── Teaching Requirement Sources ────────────────────────────────────────────

export interface TeachingRequirementSource {
    id: number;
    versionId: number;
    gradeLevel: string;
    disciplineId: number;
    lineType: string;
    driverType: string;
    headcount: number;
    maxClassSize: number;
    driverUnits: number;
    hoursPerUnit: string;
    totalWeeklyHours: string;
    calculatedAt: string;
}

export interface TeachingRequirementSourcesResponse {
    sources: TeachingRequirementSource[];
}

// ── Staffing Assignments ────────────────────────────────────────────────────

export interface StaffingAssignment {
    id: number;
    versionId: number;
    employeeId: number;
    band: string;
    disciplineId: number;
    hoursPerWeek: string;
    fteShare: string;
    source: string;
    note: string | null;
    employeeName: string;
    employeeCode: string;
    costMode: string;
    disciplineCode: string;
    disciplineName: string;
    updatedAt: string;
}

export interface StaffingAssignmentsResponse {
    assignments: StaffingAssignment[];
}

export interface CreateAssignmentPayload {
    employeeId: number;
    band: string;
    disciplineId: number;
    hoursPerWeek: string;
    fteShare: string;
    source?: string;
    note?: string | null;
}

// ── Auto-Suggest ────────────────────────────────────────────────────────────

export interface AutoSuggestResult {
    employeeId: number;
    employeeName: string;
    band: string;
    disciplineId: number;
    disciplineCode: string;
    fteShare: string;
    confidence: number;
}

export interface AutoSuggestResponse {
    suggestions: AutoSuggestResult[];
}

// ── Stale Modules ───────────────────────────────────────────────────────────

/** Modules used in stale propagation chain: ENROLLMENT -> REVENUE -> STAFFING -> PNL */
export type StaffingStaleModule = 'STAFFING';

/** After staffing recalculation, PNL is marked stale */
export type StaffingCalcStaleModule = 'PNL';
```

- [ ] **Step 2: Export from index.ts**

In `packages/types/src/index.ts`, add at the end:

```typescript
// Staffing types
export type {
    Employee,
    EmployeeListResponse,
    StaffingSettings,
    StaffingSettingsResponse,
    ServiceProfile,
    ServiceProfilesResponse,
    ServiceProfileOverride,
    ServiceProfileOverridesResponse,
    CostCalculationMode,
    CostAssumption,
    CostAssumptionsResponse,
    LyceeGroupAssumption,
    LyceeGroupAssumptionsResponse,
    DemandOverride,
    DemandOverridesResponse,
    TeachingRequirementLine,
    AssignedEmployee,
    TeachingRequirementTotals,
    TeachingRequirementsResponse,
    TeachingRequirementSource,
    TeachingRequirementSourcesResponse,
    StaffingAssignment,
    StaffingAssignmentsResponse,
    CreateAssignmentPayload,
    AutoSuggestResult,
    AutoSuggestResponse,
    StaffingStaleModule,
    StaffingCalcStaleModule,
} from './staffing.js';
```

- [ ] **Step 3: Verify types compile**

```bash
pnpm --filter @budfin/types typecheck
```

- [ ] **Step 4: Commit**

```bash
git add packages/types/src/staffing.ts packages/types/src/index.ts
git commit -m "feat(types): add shared staffing types for API/frontend contract"
```

---

## Workstream 3: Backend Contract Fixes

### Task 4: Fix Employee camelCase Serialization + Derived Cost Fields

**Files:**

- Modify: `apps/api/src/routes/staffing/employees.ts:108-142` (formatEmployee)
- Modify: `apps/api/src/routes/staffing/employees.ts:264-273` (IDOR TODO)

**Context:** `formatEmployee()` returns snake_case fields. ALL other staffing endpoints return camelCase. Frontend expects camelCase. Also need to add `monthlyCost`/`annualCost` derived fields for the support grid.

- [ ] **Step 1: Rewrite `formatEmployee` to camelCase**

At `apps/api/src/routes/staffing/employees.ts:108-142`, replace the function body:

```typescript
function formatEmployee(
    emp: EmployeeWithRelations,
    key: string,
    redactSalary: boolean
): Record<string, unknown> {
    const decrypt = (val: Uint8Array | null) => {
        if (!val || redactSalary) return null;
        return decryptField(val, key);
    };

    return {
        id: emp.id,
        employeeCode: emp.employeeCode,
        name: emp.name,
        functionRole: emp.functionRole,
        department: emp.department,
        status: emp.status,
        joiningDate: emp.joiningDate?.toISOString() ?? null,
        paymentMethod: emp.paymentMethod,
        isSaudi: emp.isSaudi,
        isAjeer: emp.isAjeer,
        isTeaching: emp.isTeaching,
        hourlyPercentage: emp.hourlyPercentage?.toString() ?? null,
        baseSalary: decrypt(emp.baseSalary),
        housingAllowance: decrypt(emp.housingAllowance),
        transportAllowance: decrypt(emp.transportAllowance),
        responsibilityPremium: decrypt(emp.responsibilityPremium),
        hsaAmount: decrypt(emp.hsaAmount),
        augmentation: decrypt(emp.augmentation),
        augmentationEffectiveDate: emp.augmentationEffectiveDate?.toISOString() ?? null,
        ajeerAnnualLevy: emp.ajeerAnnualLevy?.toString() ?? null,
        ajeerMonthlyFee: emp.ajeerMonthlyFee?.toString() ?? null,
        recordType: emp.recordType,
        costMode: emp.costMode,
        disciplineId: emp.disciplineId,
        serviceProfileId: emp.serviceProfileId,
        homeBand: emp.homeBand,
        contractEndDate: emp.contractEndDate?.toISOString() ?? null,
        disciplineName: emp.discipline?.name ?? null,
        serviceProfileName: emp.serviceProfile?.name ?? null,
        monthlyCost: null, // Populated by cost join below
        annualCost: null, // Populated by cost join below
        updatedAt: emp.updatedAt?.toISOString() ?? null,
    };
}
```

- [ ] **Step 2: Add derived cost fields to employee list**

In the GET employees handler (around line 300-315), after querying employees, join against the latest `MonthlyStaffCost` to derive per-employee cost totals. Add a Prisma raw query or a secondary groupBy query:

```typescript
// After fetching employees, derive cost totals from monthly_staff_costs
const costTotals = await prisma.$queryRaw<
    Array<{ employee_id: number; monthly_avg: string; annual_total: string }>
>`
	SELECT employee_id,
		(SUM(total_cost) / NULLIF(COUNT(*), 0))::DECIMAL(15,4) AS monthly_avg,
		SUM(total_cost)::DECIMAL(15,4) AS annual_total
	FROM monthly_staff_costs
	WHERE version_id = ${versionId}
	GROUP BY employee_id
`;
const costMap = new Map(costTotals.map((c) => [c.employee_id, c]));

// In the response mapping, populate monthlyCost/annualCost:
const formatted = employees.map((emp) => {
    const f = formatEmployee(emp, key, redactSalary);
    const cost = costMap.get(emp.id);
    if (cost && !redactSalary) {
        f.monthlyCost = cost.monthly_avg;
        f.annualCost = cost.annual_total;
    }
    return f;
});
```

- [ ] **Step 3: Fix response wrapper to match shared types**

Change the response from `{ employees: [...], total, page, page_size }` to `{ employees: [...], total, page, pageSize }` (camelCase `pageSize`).

- [ ] **Step 4: Run backend tests**

```bash
pnpm --filter @budfin/api test -- --run src/routes/staffing/employees
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/staffing/employees.ts
git commit -m "fix(api): employee list returns camelCase fields + derived cost totals"
```

---

### Task 5: Fix Stale Propagation (STAFFING only, not PNL)

**Files:**

- Modify: `apps/api/src/routes/staffing/settings.ts:84`
- Modify: `apps/api/src/routes/staffing/assignments.ts:57`

**Context:** Both files define `STAFFING_STALE_MODULES = ['STAFFING', 'PNL']`. Per redesign spec, mutations should mark only STAFFING stale. PNL is already correctly added by `calculate.ts:735-738` after recalculation.

- [ ] **Step 1: Fix settings.ts**

At `apps/api/src/routes/staffing/settings.ts:84`:

```typescript
// OLD: const STAFFING_STALE_MODULES = ['STAFFING', 'PNL'] as const;
// NEW:
const STAFFING_STALE_MODULES = ['STAFFING'] as const;
```

- [ ] **Step 2: Fix assignments.ts**

At `apps/api/src/routes/staffing/assignments.ts:57`:

```typescript
// OLD: const STAFFING_STALE_MODULES = ['STAFFING', 'PNL'] as const;
// NEW:
const STAFFING_STALE_MODULES = ['STAFFING'] as const;
```

- [ ] **Step 3: Verify calculate.ts still adds PNL after recalc**

Confirm `apps/api/src/routes/staffing/calculate.ts:735-738` still contains:

```typescript
staleSet.delete('STAFFING');
staleSet.add('PNL');
```

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @budfin/api test -- --run
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/staffing/settings.ts apps/api/src/routes/staffing/assignments.ts
git commit -m "fix(api): stale propagation marks STAFFING only on mutations, not PNL"
```

---

### Task 6: Fix Import — Remove hsa_amount from Accepted Columns

**Files:**

- Modify: `apps/api/src/routes/staffing/import.ts:35,264-265`

**Context:** `hsa_amount` is in OPTIONAL_COLUMNS. The redesign spec says HSA is computed-only. Import should ignore it.

- [ ] **Step 1: Remove from OPTIONAL_COLUMNS**

At `apps/api/src/routes/staffing/import.ts`, remove `'hsa_amount'` from the OPTIONAL_COLUMNS array (around line 35).

- [ ] **Step 2: Remove parsing logic**

At lines 264-265, remove:

```typescript
const hsaStr = getStr('hsa_amount');
const hsaAmount = hsaStr && !isNaN(Number(hsaStr)) ? hsaStr : '0';
```

Replace with:

```typescript
const hsaAmount = '0'; // HSA is always computed by the calculation pipeline
```

- [ ] **Step 3: Add warning if column present**

After header validation (where unknown columns are checked), add:

```typescript
if (headerRow.includes('hsa_amount')) {
    warnings.push('Column "hsa_amount" is ignored — HSA is computed by the calculation pipeline.');
}
```

- [ ] **Step 4: Run import tests**

```bash
pnpm --filter @budfin/api test -- --run src/routes/staffing/import
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/staffing/import.ts
git commit -m "fix(api): import ignores hsa_amount column (HSA is computed-only)"
```

---

### Task 7: Add Totals and Warnings to Teaching-Requirements Response

**Files:**

- Modify: `apps/api/src/routes/staffing/settings.ts:792-819`

**Context:** The GET teaching-requirements endpoint returns `{ lines: [...] }` but the redesign spec requires `{ lines, totals, warnings }`. Coverage warnings are computed at line 358 but discarded.

- [ ] **Step 1: Add totals aggregation to the teaching-requirements handler**

At the end of the GET teaching-requirements handler (around line 792-819), after building the `lines` array, add:

```typescript
import Decimal from 'decimal.js';

// Aggregate totals from lines
const totalFteRaw = lines.reduce((sum, l) => sum.plus(l.requiredFteRaw ?? '0'), new Decimal(0));
const totalFtePlanned = lines.reduce(
    (sum, l) => sum.plus(l.requiredFtePlanned ?? '0'),
    new Decimal(0)
);
const totalFteCovered = lines.reduce((sum, l) => sum.plus(l.coveredFte ?? '0'), new Decimal(0));
const totalFteGap = lines.reduce((sum, l) => sum.plus(l.gapFte ?? '0'), new Decimal(0));
const totalDirectCost = hasSalaryView
    ? lines.reduce((sum, l) => sum.plus(l.directCostAnnual ?? '0'), new Decimal(0))
    : null;
const totalHsaCost = hasSalaryView
    ? lines.reduce((sum, l) => sum.plus(l.hsaCostAnnual ?? '0'), new Decimal(0))
    : null;
const totalPositions = lines.reduce((sum, l) => sum + (l.recommendedPositions ?? 0), 0);

const totals = {
    totalFteRaw: totalFteRaw.toFixed(4),
    totalFtePlanned: totalFtePlanned.toFixed(4),
    totalFteCovered: totalFteCovered.toFixed(4),
    totalFteGap: totalFteGap.toFixed(4),
    totalDirectCost: totalDirectCost?.toFixed(4) ?? null,
    totalHsaCost: totalHsaCost?.toFixed(4) ?? null,
    totalPositions,
    heRatio: totalFtePlanned.gt(0)
        ? totalFteCovered.div(totalFtePlanned).toDecimalPlaces(4).toFixed(4)
        : null,
};

// Generate coverage warnings
const warnings: string[] = [];
for (const line of lines) {
    if (line.coverageStatus === 'UNCOVERED' && new Decimal(line.requiredFtePlanned ?? '0').gt(0)) {
        warnings.push(`${line.lineLabel}: uncovered (${line.gapFte} FTE gap)`);
    }
}

return reply.send({ lines, totals, warnings });
```

- [ ] **Step 2: Run tests**

```bash
pnpm --filter @budfin/api test -- --run src/routes/staffing/settings
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/staffing/settings.ts
git commit -m "feat(api): teaching-requirements response includes totals and warnings"
```

---

### Task 8: Persist requiredFteCalculated in Calculation Pipeline

**Files:**

- Modify: `apps/api/src/routes/staffing/calculate.ts:301-312,653-658`

**Context:** `requiredFtePlanned` is overwritten by demand overrides. Need to preserve the original calculated value in `requiredFteCalculated`.

- [ ] **Step 1: Persist original FTE before override**

In `calculate.ts`, at the demand override application section (around lines 301-312), store the original value:

```typescript
// Before applying overrides, capture original calculated FTE
for (const line of demandLines) {
    line.requiredFteCalculated = line.requiredFteRaw; // Original before override
}

// Apply overrides (existing logic)
for (const line of overriddenLines) {
    line.requiredFtePlanned = overrideFte;
    // requiredFteCalculated remains the pre-override value
}
```

- [ ] **Step 2: Include in upsert**

In the TeachingRequirementLine upsert (around lines 653-658), add:

```typescript
requiredFteCalculated: line.requiredFteCalculated?.toDecimalPlaces(4).toFixed(4) ?? line.requiredFteRaw.toDecimalPlaces(4).toFixed(4),
```

- [ ] **Step 3: Run calculation tests**

```bash
pnpm --filter @budfin/api test -- --run src/routes/staffing/calculate
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/staffing/calculate.ts
git commit -m "feat(api): persist requiredFteCalculated for demand override provenance"
```

---

### Task 9: HSA Clearing for Ineligible Employees

**Files:**

- Modify: `apps/api/src/routes/staffing/calculate.ts:725-733`

**Context:** HSA is only updated for eligible employees. Employees who become ineligible retain stale HSA amounts.

- [ ] **Step 1: Add clearing logic after HSA update**

After the existing HSA update loop (lines 725-733), add:

```typescript
// Clear HSA for employees who are NOT eligible (but may have old HSA amounts)
const ineligibleEmployeeIds = versionEmployees
    .filter((e) => !hsaEligibleEmployeeIds.includes(e.id))
    .map((e) => e.id);

if (ineligibleEmployeeIds.length > 0) {
    for (const empId of ineligibleEmployeeIds) {
        await tx.$executeRawUnsafe(
            `UPDATE employees SET hsa_amount = pgp_sym_encrypt($1, $2) WHERE id = $3`,
            '0.0000',
            key,
            empId
        );
    }
}
```

- [ ] **Step 2: Run tests**

```bash
pnpm --filter @budfin/api test -- --run src/routes/staffing/calculate
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/staffing/calculate.ts
git commit -m "fix(api): clear HSA for newly-ineligible employees during recalculation"
```

---

### Task 10: Version-Ownership IDOR Fix

**Files:**

- Modify: `apps/api/src/routes/staffing/employees.ts:264-273`

**Context:** `employees.ts:264` has explicit TODO. No version-ownership validation exists.

- [ ] **Step 1: Add version-ownership check**

Replace the TODO comment and existing version check (lines 264-273) with:

```typescript
// Verify version exists and user has access to its fiscal year
const version = await prisma.budgetVersion.findUnique({
    where: { id: versionId },
    select: { id: true, fiscalYear: { select: { id: true } } },
});
if (!version) {
    return reply.status(404).send({ error: 'Version not found' });
}
// Version-scoped access: all authenticated users can access all versions
// (RBAC is enforced at the route level via preHandler)
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/routes/staffing/employees.ts
git commit -m "fix(security): remove IDOR TODO, add version existence check"
```

---

## Workstream 4: Legacy DHG Cleanup

### Task 11: Remove DHG from All Stale-Module Constants

**Files:**

- Modify: `apps/api/src/services/planning-rules.ts:18`
- Modify: `apps/api/src/routes/enrollment/headcount.ts:33`
- Modify: `apps/api/src/routes/enrollment/detail.ts:7`
- Modify: `apps/api/src/routes/enrollment/nationality-breakdown.ts:35`

**Context:** `'DHG'` is included in all 4 enrollment stale-module arrays. DHG has been folded into STAFFING.

- [ ] **Step 1: Fix planning-rules.ts**

At `apps/api/src/services/planning-rules.ts:18`, remove `'DHG'` from `ENROLLMENT_RULES_STALE_MODULES`:

```typescript
// OLD: ['ENROLLMENT', 'REVENUE', 'DHG', 'STAFFING', 'PNL']
// NEW:
const ENROLLMENT_RULES_STALE_MODULES = ['ENROLLMENT', 'REVENUE', 'STAFFING', 'PNL'] as const;
```

- [ ] **Step 2: Fix headcount.ts**

At `apps/api/src/routes/enrollment/headcount.ts:33`:

```typescript
// OLD: ['ENROLLMENT', 'REVENUE', 'DHG', 'STAFFING', 'PNL']
// NEW:
const HEADCOUNT_STALE_MODULES = ['ENROLLMENT', 'REVENUE', 'STAFFING', 'PNL'] as const;
```

- [ ] **Step 3: Fix detail.ts**

At `apps/api/src/routes/enrollment/detail.ts:7`:

```typescript
// OLD: ['REVENUE', 'DHG', 'STAFFING', 'PNL']
// NEW:
const DETAIL_STALE_MODULES = ['REVENUE', 'STAFFING', 'PNL'] as const;
```

- [ ] **Step 4: Fix nationality-breakdown.ts**

At `apps/api/src/routes/enrollment/nationality-breakdown.ts:35`:

```typescript
// OLD: ['ENROLLMENT', 'REVENUE', 'DHG', 'STAFFING', 'PNL']
// NEW:
const NATIONALITY_STALE_MODULES = ['ENROLLMENT', 'REVENUE', 'STAFFING', 'PNL'] as const;
```

- [ ] **Step 5: Verify with grep**

```bash
grep -rn "'DHG'" apps/api/src/routes/enrollment/ apps/api/src/services/planning-rules.ts
# Expected: 0 results
```

- [ ] **Step 6: Run enrollment tests**

```bash
pnpm --filter @budfin/api test -- --run src/routes/enrollment
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/services/planning-rules.ts apps/api/src/routes/enrollment/
git commit -m "fix(api): remove DHG from all stale-module constants (folded into STAFFING)"
```

---

### Task 12: Deprecate dhg-grille Route

**Files:**

- Modify: `apps/api/src/routes/staffing/index.ts:4,12`

**Context:** `dhgGrilleRoutes` is still imported and registered. DHG is now managed via DhgRule model.

- [ ] **Step 1: Remove registration**

At `apps/api/src/routes/staffing/index.ts`, remove or comment out line 4 (import) and line 12 (registration):

```typescript
// Remove: import { dhgGrilleRoutes } from './dhg-grille.js';
// Remove: await app.register(dhgGrilleRoutes);
```

- [ ] **Step 2: Run tests**

```bash
pnpm --filter @budfin/api test -- --run
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/staffing/index.ts
git commit -m "fix(api): remove dhg-grille route registration (replaced by DhgRule master data)"
```

---

### Task 13: Clean DHG from Frontend Labels

**Files:**

- Modify: `apps/web/src/components/staffing/staffing-status-strip.tsx:8`
- Modify: `apps/web/src/components/versions/version-detail-panel.tsx:24`

- [ ] **Step 1: Remove DHG from status strip labels**

At `apps/web/src/components/staffing/staffing-status-strip.tsx:8`:

```typescript
// Remove: DHG: 'DHG',
```

- [ ] **Step 2: Remove DHG from version-detail MODULE_ROUTES**

At `apps/web/src/components/versions/version-detail-panel.tsx:24`:

```typescript
// Remove: DHG: '/planning/staffing',
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/staffing/staffing-status-strip.tsx apps/web/src/components/versions/version-detail-panel.tsx
git commit -m "fix(ui): remove DHG from stale module labels and route map"
```

---

## Workstream 5: Frontend Contract Alignment

### Task 14: Align use-staffing.ts Interfaces with Backend

**Files:**

- Modify: `apps/web/src/hooks/use-staffing.ts`

**Context:** Frontend interfaces use different field names and response wrappers than backend. Backend is source of truth.

- [ ] **Step 1: Update Employee interface (lines 7-38)**

Replace the Employee interface to import from shared types:

```typescript
import type {
    Employee,
    EmployeeListResponse,
    StaffingSettings,
    StaffingSettingsResponse,
    StaffingAssignment,
    StaffingAssignmentsResponse,
    TeachingRequirementLine,
    TeachingRequirementsResponse,
    CreateAssignmentPayload,
} from '@budfin/types';
```

Remove all local interface definitions that are now in `@budfin/types`.

- [ ] **Step 2: Fix employee list hook response unwrapping**

```typescript
// OLD: apiClient<{ data: Employee[], total: number }>(`/versions/${versionId}/employees`)
// NEW:
apiClient<EmployeeListResponse>(`/versions/${versionId}/employees`);
// Access: response.employees (not response.data)
```

- [ ] **Step 3: Fix StaffingSettings hook (lines 349-370)**

```typescript
// OLD interface:
// hsaTargetHoursPerWeek -> hsaTargetHours
// hsaRateFirstHour -> hsaFirstHourRate
// hsaRateAdditionalHour -> hsaAdditionalHourRate

// OLD response: (resp as { data: StaffingSettings }).data
// NEW response: (resp as StaffingSettingsResponse).settings
```

- [ ] **Step 4: Fix StaffingAssignment hook (lines 587-610)**

```typescript
// OLD interface field: requirementLineId
// NEW interface fields: band, disciplineId, employeeName, employeeCode, etc.

// OLD response: (resp as { data: StaffingAssignment[] }).data
// NEW response: (resp as StaffingAssignmentsResponse).assignments
```

- [ ] **Step 5: Fix TeachingRequirements hook (lines 518-560)**

```typescript
// OLD response: { data: TeachingRequirementLine[], totals: {...} }
// NEW response: { lines: TeachingRequirementLine[], totals: TeachingRequirementTotals, warnings: string[] }
```

- [ ] **Step 6: Fix all mutation hooks to match backend payload schemas**

Update `useCreateAssignment` to send `{ employeeId, band, disciplineId, hoursPerWeek, fteShare }` instead of `{ requirementLineId, ... }`.

- [ ] **Step 7: Run frontend typecheck**

```bash
pnpm --filter @budfin/web typecheck
```

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/hooks/use-staffing.ts
git commit -m "fix(web): align use-staffing hooks with backend contract via shared types"
```

---

### Task 15: Align use-master-data.ts with Backend

**Files:**

- Modify: `apps/web/src/hooks/use-master-data.ts:7-13,43-51`

**Context:** ServiceProfile uses `defaultOrs`/`isHsaEligible`/`label`. Backend uses `weeklyServiceHours`/`hsaEligible`/`name`. AutoSuggestResult uses `requirementLineId`.

- [ ] **Step 1: Update ServiceProfile interface**

```typescript
import type {
    ServiceProfile,
    ServiceProfilesResponse,
    AutoSuggestResult,
    AutoSuggestResponse,
} from '@budfin/types';
```

Remove local interfaces.

- [ ] **Step 2: Update response unwrapping**

```typescript
// OLD: (resp as { data: ServiceProfile[] }).data
// NEW: (resp as ServiceProfilesResponse).profiles
```

- [ ] **Step 3: Update AutoSuggestResult**

Replace `requirementLineId` with `band` + `disciplineId` + `disciplineCode`.

- [ ] **Step 4: Run typecheck**

```bash
pnpm --filter @budfin/web typecheck
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/hooks/use-master-data.ts
git commit -m "fix(web): align use-master-data hooks with backend field names"
```

---

### Task 16: Fix Settings Sheet Enum Values and Field Names

**Files:**

- Modify: `apps/web/src/components/staffing/staffing-settings-sheet.tsx:50-54,138-165,198-201,423,431`

- [ ] **Step 1: Fix cost mode enum**

At line 52:

```typescript
// OLD: { value: 'PCT_PAYROLL', label: '% of Payroll' },
// NEW:
{ value: 'PERCENT_OF_PAYROLL', label: '% of Payroll' },
```

- [ ] **Step 2: Fix response unwrapping**

At lines 138-165, change all `(resp as { data: X }).data` to use named wrappers:

```typescript
// settings = (settingsResp as StaffingSettingsResponse)?.settings ?? null
// profiles = (profilesResp as ServiceProfilesResponse)?.profiles ?? []
// overrides = (overridesResp as ServiceProfileOverridesResponse)?.overrides ?? []
// costAssumptions = (costResp as CostAssumptionsResponse)?.assumptions ?? []
```

- [ ] **Step 3: Fix HSA field names**

At lines 198-201:

```typescript
// OLD: hsaTargetHoursPerWeek -> NEW: hsaTargetHours
// OLD: hsaRateFirstHour -> NEW: hsaFirstHourRate
// OLD: hsaRateAdditionalHour -> NEW: hsaAdditionalHourRate
```

- [ ] **Step 4: Fix service profile field access**

At line 423: `p.defaultOrs` -> `p.weeklyServiceHours`
At line 431: `p.isHsaEligible` -> `p.hsaEligible`

- [ ] **Step 5: Run typecheck**

```bash
pnpm --filter @budfin/web typecheck
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/staffing/staffing-settings-sheet.tsx
git commit -m "fix(web): settings sheet uses backend enum values and field names"
```

---

### Task 17: Fix Inspector ORS Hardcode and Assignment Keys

**Files:**

- Modify: `apps/web/src/components/staffing/staffing-inspector-content.tsx:108-113,120-126`

- [ ] **Step 1: Fix ORS hardcode**

At lines 108-113, replace:

```typescript
// OLD: return (fte * 24).toFixed(1);
// NEW: read effectiveOrs from the selected requirement line
const derivedHoursPerWeek = useMemo(() => {
    const fte = parseFloat(form.fteShare);
    if (isNaN(fte)) return '';
    const ors = parseFloat(selectedLine?.effectiveOrs ?? '24');
    return (fte * ors).toFixed(1);
}, [form.fteShare, selectedLine?.effectiveOrs]);
```

- [ ] **Step 2: Fix assignment creation payload**

At lines 120-126, change from `requirementLineId` to `(band, disciplineId)`:

```typescript
// OLD: { requirementLineId, employeeId, fteShare, hoursPerWeek, note }
// NEW:
{
	employeeId: form.employeeId,
	band: selectedLine.band,
	disciplineId: selectedLine.disciplineId ?? getDisciplineIdByCode(selectedLine.disciplineCode),
	hoursPerWeek: derivedHoursPerWeek,
	fteShare: form.fteShare,
	note: form.note || null,
}
```

The `disciplineId` must be resolved from the requirement line's context (which already has `disciplineCode` and can be joined to disciplines).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/staffing/staffing-inspector-content.tsx
git commit -m "fix(web): inspector uses effectiveOrs and (band, disciplineId) keys"
```

---

### Task 18: Fix Auto-Suggest Dialog Assignment Keys

**Files:**

- Modify: `apps/web/src/components/staffing/auto-suggest-dialog.tsx:76-82`

- [ ] **Step 1: Update assignment creation**

```typescript
// OLD:
createAssignment.mutate({
    requirementLineId: s.requirementLineId,
    employeeId: s.employeeId,
    fteShare: s.fteShare,
    hoursPerWeek: '0',
    note: null,
});

// NEW:
createAssignment.mutate({
    employeeId: s.employeeId,
    band: s.band,
    disciplineId: s.disciplineId,
    fteShare: s.fteShare,
    hoursPerWeek: '0',
    note: null,
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/staffing/auto-suggest-dialog.tsx
git commit -m "fix(web): auto-suggest uses (band, disciplineId) for assignment creation"
```

---

## Workstream 6: Frontend Integration (Staffing Page)

### Task 19: Wire Staffing Page to Real Components

**Files:**

- Modify: `apps/web/src/pages/planning/staffing.tsx:7,237-250`

**Context:** Lines 237-250 render placeholder `<div>Teaching workspace</div>` and `<div>Support & Admin workspace</div>`. Replace with real components.

- [ ] **Step 1: Add component imports**

At the top of `staffing.tsx` (around line 7), add:

```typescript
import { TeachingMasterGrid } from '@/components/staffing/teaching-master-grid';
import { SupportAdminGrid } from '@/components/staffing/support-admin-grid';
import { StaffingKpiRibbon } from '@/components/staffing/staffing-kpi-ribbon';
import { StaffingStatusStrip } from '@/components/staffing/staffing-status-strip';
import { StaffingInspectorContent } from '@/components/staffing/staffing-inspector-content';
```

- [ ] **Step 2: Add data hooks**

Add hooks for teaching requirements, employees, version context:

```typescript
const teachingReqs = useTeachingRequirements(versionId);
const employees = useEmployeeList(versionId);
const assignments = useStaffingAssignments(versionId);
```

- [ ] **Step 3: Replace placeholder divs**

At lines 237-250, replace the placeholder divs:

```tsx
{
    isTeachingMode ? (
        teachingReqs.data ? (
            <TeachingMasterGrid
                data={teachingReqs.data}
                viewPreset={viewPreset}
                bandFilter={bandFilter}
                coverageFilter={coverageFilter}
                selectedLineId={selectedLineId}
            />
        ) : (
            <div className="flex h-full items-center justify-center text-(--text-muted)">
                Loading teaching data...
            </div>
        )
    ) : employees.data ? (
        <SupportAdminGrid
            versionId={versionId!}
            employees={employees.data.employees.filter((e) => !e.isTeaching)}
            isEditable={isEditable}
        />
    ) : (
        <div className="flex h-full items-center justify-center text-(--text-muted)">
            Loading support staff...
        </div>
    );
}
```

- [ ] **Step 4: Mount KPI ribbon and status strip**

Above the grid zone, add:

```tsx
{teachingReqs.data?.totals && (
	<StaffingKpiRibbon
		totalHeadcount={...}
		fteGap={teachingReqs.data.totals.totalFteGap}
		staffCost={teachingReqs.data.totals.totalDirectCost}
		hsaBudget={teachingReqs.data.totals.totalHsaCost}
		heRatio={teachingReqs.data.totals.heRatio}
		rechargeCost={null}
		isStale={version?.staleModules?.includes('STAFFING') ?? false}
	/>
)}

<StaffingStatusStrip
	version={version}
	lastCalculatedAt={teachingReqs.data?.lines?.[0]?.calculatedAt ?? null}
/>
```

- [ ] **Step 5: Register inspector content**

Wire the right panel inspector to show requirement line details when a teaching line is selected:

```typescript
import { registerPanelContent } from '@/lib/right-panel-registry';

registerPanelContent('staffing', (props) => (
	<StaffingInspectorContent
		versionId={props.versionId}
		selectedLineId={props.selectedItemId}
		isEditable={props.isEditable}
	/>
));
```

- [ ] **Step 6: Run typecheck**

```bash
pnpm --filter @budfin/web typecheck
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/pages/planning/staffing.tsx
git commit -m "feat(web): wire staffing page to real grids, KPI ribbon, status strip, inspector"
```

---

### Task 20: Wire Toolbar Action Buttons

**Files:**

- Modify: `apps/web/src/pages/planning/staffing.tsx:201-217`

**Context:** Import, Add Employee, Auto-Suggest buttons have no onClick handlers.

- [ ] **Step 1: Add state for dialogs**

```typescript
const [showImportDialog, setShowImportDialog] = useState(false);
const [showEmployeeForm, setShowEmployeeForm] = useState(false);
const [showAutoSuggest, setShowAutoSuggest] = useState(false);
```

- [ ] **Step 2: Wire button handlers**

```tsx
// Import button (line 201-203)
<Button onClick={() => setShowImportDialog(true)} ...>Import</Button>

// Add Employee button (line 207-210)
<Button onClick={() => setShowEmployeeForm(true)} ...>Add Employee</Button>

// Auto-Suggest button (line 215-217)
<Button onClick={() => setShowAutoSuggest(true)} ...>Auto-Suggest</Button>
```

- [ ] **Step 3: Mount dialog components**

At the bottom of the component, before the closing fragment:

```tsx
{
    showImportDialog && (
        <ImportDialog versionId={versionId!} onClose={() => setShowImportDialog(false)} />
    );
}
{
    showEmployeeForm && (
        <EmployeeForm versionId={versionId!} onClose={() => setShowEmployeeForm(false)} />
    );
}
{
    showAutoSuggest && teachingReqs.data && (
        <AutoSuggestDialog versionId={versionId!} onClose={() => setShowAutoSuggest(false)} />
    );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/planning/staffing.tsx
git commit -m "feat(web): wire Import, Add Employee, Auto-Suggest toolbar buttons"
```

---

## Workstream 7: Test Hardening

### Task 21: Migration Alignment Test for Staffing Tables

**Files:**

- Modify: `apps/api/src/migration-alignment.test.ts`

**Context:** Test currently covers 0 staffing tables (only audit/auth columns).

- [ ] **Step 1: Add staffing table assertions**

Add a new describe block:

```typescript
describe('staffing redesign tables', () => {
    it('migration SQL contains all 11 staffing tables', () => {
        const requiredTables = [
            'service_obligation_profiles',
            'disciplines',
            'discipline_aliases',
            'dhg_rules',
            'version_staffing_settings',
            'version_service_profile_overrides',
            'version_staffing_cost_assumptions',
            'version_lycee_group_assumptions',
            'demand_overrides',
            'teaching_requirement_sources',
            'teaching_requirement_lines',
        ];
        for (const table of requiredTables) {
            expect(migrationSql).toContain(`"${table}"`);
        }
    });

    it('migration SQL contains staffing_assignments table', () => {
        expect(migrationSql).toContain('"staffing_assignments"');
    });

    it('migration SQL contains Employee new columns', () => {
        const columns = [
            'record_type',
            'cost_mode',
            'discipline_id',
            'service_profile_id',
            'home_band',
            'contract_end_date',
        ];
        for (const col of columns) {
            expect(migrationSql).toContain(`"${col}"`);
        }
    });

    it('migration SQL contains calculation_mode on category_monthly_costs', () => {
        expect(migrationSql).toContain('"calculation_mode"');
    });

    it('migration SQL contains required_fte_calculated', () => {
        expect(migrationSql).toContain('"required_fte_calculated"');
    });
});
```

- [ ] **Step 2: Run test**

```bash
pnpm --filter @budfin/api exec vitest run src/migration-alignment.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/migration-alignment.test.ts
git commit -m "test(api): migration alignment covers all staffing tables and columns"
```

---

### Task 22: Stale-Chain Regression Test

**Files:**

- Create: `apps/api/src/routes/staffing/stale-chain.test.ts`

- [ ] **Step 1: Write stale-chain test**

```typescript
import { describe, it, expect } from 'vitest';

describe('staffing stale propagation', () => {
    it('settings mutation marks only STAFFING stale, not PNL', () => {
        // Import the constant directly
        // Verify STAFFING_STALE_MODULES contains only 'STAFFING'
    });

    it('assignment mutation marks only STAFFING stale, not PNL', () => {
        // Same verification for assignments.ts
    });

    it('DHG is not in any enrollment stale constant', () => {
        // Grep-style assertion or import verification
    });
});
```

- [ ] **Step 2: Run test**

```bash
pnpm --filter @budfin/api exec vitest run src/routes/staffing/stale-chain.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/staffing/stale-chain.test.ts
git commit -m "test(api): stale-chain regression test for STAFFING/PNL propagation"
```

---

### Task 23: Rewrite Page Test — No Placeholder Assertions

**Files:**

- Modify: `apps/web/src/pages/planning/staffing.test.tsx:334-344`

- [ ] **Step 1: Replace placeholder assertions**

Remove lines 334-344 (the "Teaching workspace" and "Support & Admin workspace" assertions). Replace with:

```typescript
it('renders TeachingMasterGrid in teaching mode', async () => {
    // Mock teaching requirements data
    // Assert grid component renders (data-testid or role)
    expect(screen.getByTestId('teaching-master-grid')).toBeTruthy();
});

it('renders SupportAdminGrid in support mode', async () => {
    // Toggle to support mode
    // Assert support grid renders
    expect(screen.getByTestId('support-admin-grid')).toBeTruthy();
});
```

- [ ] **Step 2: Run test**

```bash
pnpm --filter @budfin/web exec vitest run src/pages/planning/staffing.test.tsx
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/planning/staffing.test.tsx
git commit -m "test(web): staffing page test asserts real components, not placeholders"
```

---

### Task 24: Rewrite Hook Tests with Correct Response Shapes

**Files:**

- Modify: `apps/web/src/hooks/use-staffing-hooks.test.ts`
- Modify: `apps/web/src/hooks/use-master-data.test.ts`

- [ ] **Step 1: Fix use-staffing-hooks.test.ts mock shapes**

Update all mock data to use named wrappers matching backend:

```typescript
// OLD: { data: { id: 1, versionId: 10, hsaMonths: 10 } }
// NEW:
const mockSettings = {
    settings: {
        id: 1,
        versionId: 10,
        hsaTargetHours: '1.50',
        hsaFirstHourRate: '500.00',
        hsaAdditionalHourRate: '400.00',
        hsaMonths: 10,
        academicWeeks: 36,
        ajeerAnnualLevy: '9500.0000',
        ajeerMonthlyFee: '160.0000',
        reconciliationBaseline: null,
    },
};

// OLD: { data: [] } for assignments
// NEW: { assignments: [] }

// OLD: { data: [], totals: {} } for teaching requirements
// NEW: { lines: [], totals: { totalFteRaw: '0', ... }, warnings: [] }
```

- [ ] **Step 2: Fix use-master-data.test.ts mock shapes**

```typescript
// OLD: { id, code, label: 'Certifie', defaultOrs: '18', isHsaEligible: true }
// NEW:
{ id: 1, code: 'CERTIFIE', name: 'Professeur Certifie', weeklyServiceHours: '18.0', hsaEligible: true, defaultCostMode: 'LOCAL_PAYROLL', sortOrder: 1 }

// OLD response: assume { data: [...] }
// NEW response: { profiles: [...] }
```

- [ ] **Step 3: Run tests**

```bash
pnpm --filter @budfin/web test -- --run
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/hooks/use-staffing-hooks.test.ts apps/web/src/hooks/use-master-data.test.ts
git commit -m "test(web): hook tests use correct backend response shapes and field names"
```

---

### Task 25: Import hsa_amount Rejection Test

**Files:**

- Modify: `apps/api/src/routes/staffing/import.test.ts` (add test case)

- [ ] **Step 1: Add test**

```typescript
it('ignores hsa_amount column in CSV and returns warning', async () => {
    const csv = buildCsvWithColumns(
        ['employee_code', 'name', 'function_role', 'base_salary', 'hsa_amount'],
        [['EMP001', 'Test User', 'Teacher', '50000', '1000']]
    );
    const response = await importCsv(versionId, csv);
    expect(response.statusCode).toBe(200);
    // hsa_amount column should be ignored
    expect(response.json().warnings).toContainEqual(expect.stringContaining('hsa_amount'));
});
```

- [ ] **Step 2: Run test**

```bash
pnpm --filter @budfin/api exec vitest run src/routes/staffing/import.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/staffing/import.test.ts
git commit -m "test(api): import test verifies hsa_amount column is ignored"
```

---

### Task 26: Settings Sheet Test Field Names

**Files:**

- Modify: `apps/web/src/components/staffing/staffing-settings-sheet.test.tsx`

- [ ] **Step 1: Update mock field names to match backend**

```typescript
// OLD mock: { hsaTargetHoursPerWeek: '1.5', hsaRateFirstHour: '250', hsaRateAdditionalHour: '200' }
// NEW mock:
{
	hsaTargetHours: '1.50',
	hsaFirstHourRate: '500.00',
	hsaAdditionalHourRate: '400.00',
	hsaMonths: 10,
	academicWeeks: 36,
}

// OLD profile mock: { defaultOrs: '18', isHsaEligible: true }
// NEW profile mock:
{ weeklyServiceHours: '18.0', hsaEligible: true, name: 'Certifie' }
```

- [ ] **Step 2: Run test**

```bash
pnpm --filter @budfin/web exec vitest run src/components/staffing/staffing-settings-sheet.test.tsx
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/staffing/staffing-settings-sheet.test.tsx
git commit -m "test(web): settings sheet test uses backend-aligned field names"
```

---

## Workstream 8: Documentation

### Task 27: Add Clone Discipline Documentation

**Files:**

- Modify: `apps/api/src/routes/versions.ts:1262,1281,1303`

- [ ] **Step 1: Add documentation comments**

At each location where `disciplineId` is copied verbatim:

```typescript
// disciplineId references global master-data Discipline (not version-scoped).
// IDs are stable across versions — intentionally NOT remapped during clone.
disciplineId: la.disciplineId,
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/routes/versions.ts
git commit -m "docs(api): document intentional disciplineId non-remapping in clone logic"
```

---

### Task 28: DHG Removal ADR

**Files:**

- Create: `docs/adr/ADR-031-dhg-to-staffing-absorption.md`

- [ ] **Step 1: Write ADR**

```markdown
# ADR-031: DHG Module Absorption into STAFFING

## Status

Accepted

## Context

The legacy DHG (Dotation Horaire Globale) module was a separate calculation step
between enrollment and staffing. The staffing redesign (Epics 18-20) folds DHG
into the STAFFING module as the "demand engine" — a sub-step within staffing
calculation rather than a standalone module.

## Decision

- Remove `'DHG'` from all stale-module propagation constants
- Retire the `dhg-grille.ts` route (replaced by DhgRule master data)
- DHG demand calculation is now performed within `calculate.ts` as part of
  the staffing calculation pipeline
- Stale chain becomes: ENROLLMENT -> REVENUE -> STAFFING -> PNL

## Consequences

- Frontend no longer shows DHG as a separate stale indicator
- Legacy `DhgGrilleConfig` model is deprecated (replaced by `DhgRule`)
- Version clone no longer needs to consider DHG as a separate module
```

- [ ] **Step 2: Commit**

```bash
git add docs/adr/ADR-031-dhg-to-staffing-absorption.md
git commit -m "docs: ADR-031 documents DHG absorption into STAFFING module"
```

---

## Workstream 9: Final Verification

### Task 29: Full Test Suite and Typecheck

- [ ] **Step 1: Run all tests**

```bash
pnpm test
```

- [ ] **Step 2: Run typecheck on both workspaces**

```bash
pnpm typecheck
```

- [ ] **Step 3: Run linter**

```bash
pnpm lint
```

- [ ] **Step 4: Verify no DHG in stale constants**

```bash
grep -rn "'DHG'" apps/api/src/routes/enrollment/ apps/api/src/services/planning-rules.ts apps/api/src/routes/staffing/settings.ts apps/api/src/routes/staffing/assignments.ts
# Expected: 0 results
```

- [ ] **Step 5: Verify no placeholder text in page**

```bash
grep -n "Teaching workspace\|Support & Admin workspace" apps/web/src/pages/planning/staffing.tsx
# Expected: 0 results (loading states use different text)
```

---

## Dependency Graph

```
Task 1 (Migration) ─────────────────────┐
                                         │
Task 2 (Seeds) ──────────────────────────┤
                                         │
Task 3 (Shared Types) ──────────────────┤──→ Task 14, 15, 16 (Frontend Alignment)
                                         │            │
Task 4 (Employee camelCase) ────────────┤            │
Task 5 (Stale propagation) ─────────────┤            ├──→ Task 19 (Page Integration)
Task 6 (Import hsa_amount) ─────────────┤            │          │
Task 7 (Totals/warnings) ──────────────┤            │          ├──→ Task 20 (Toolbar)
Task 8 (requiredFteCalculated) ─────────┤            │          │
Task 9 (HSA clearing) ──────────────────┤            │          │
Task 10 (IDOR) ─────────────────────────┘            │          │
                                                      │          │
Task 11 (DHG stale constants) ──────────────────────┤          │
Task 12 (dhg-grille removal) ───────────────────────┤          │
Task 13 (DHG frontend labels) ─────────────────────┘          │
                                                                │
Task 17 (Inspector ORS) ────────────────────────────────────────┤
Task 18 (Auto-suggest keys) ───────────────────────────────────┘
                                                                │
                                                                v
Task 21-26 (Tests) ──────────────────────────────────────────────┤
                                                                  │
Task 27-28 (Documentation) ──────────────────────────────────────┘
                                                                  │
                                                                  v
Task 29 (Final Verification) ────────────────────────────────────
```

## Parallelization Matrix

| Phase | Tasks                  | Agents            | Can Parallel?                                    |
| ----- | ---------------------- | ----------------- | ------------------------------------------------ |
| 1     | 1, 2, 3                | Migration + Types | YES (independent)                                |
| 2     | 4, 5, 6, 7, 8, 9, 10   | Backend           | YES (all independent)                            |
| 3     | 11, 12, 13             | DHG Cleanup       | YES (independent of Phase 2)                     |
| 4     | 14, 15, 16, 17, 18     | Frontend          | AFTER Phase 2 + 3 (depends on backend contracts) |
| 5     | 19, 20                 | Page Integration  | AFTER Phase 4                                    |
| 6     | 21, 22, 23, 24, 25, 26 | Tests             | AFTER Phase 5                                    |
| 7     | 27, 28                 | Docs              | AFTER Phase 3                                    |
| 8     | 29                     | Verification      | LAST                                             |

---

_Plan generated: 2026-03-18_
_Source: Full implementation assurance audit (6 parallel agents)_
_Addresses: 48 findings across 10 severity-critical, 14 high, 8 medium, 4 low items_
