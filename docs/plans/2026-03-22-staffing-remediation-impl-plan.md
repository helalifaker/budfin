# Staffing Master Data Remediation — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import 192 employees from new Excel format, fix staff cost calculations, and wire 3 hardcoded-to-zero KPI cards (HSA Budget, H/E Ratio, Recharge Cost).

**Architecture:** 3-wave dependency chain: Wave 1 fixes the data layer (new Excel parser + discipline aliases + one-shot migration), Wave 2 validates calculation outputs, Wave 3 wires frontend KPI cards. Each wave has a validation gate.

**Tech Stack:** Fastify 5, Prisma 6 (pgcrypto), ExcelJS, Decimal.js, React 19, TanStack Query, Vitest

**Spec:** `docs/plans/2026-03-22-staffing-master-data-remediation.md`

---

## File Structure

| File                                                      | Responsibility               | Action                                         |
| --------------------------------------------------------- | ---------------------------- | ---------------------------------------------- |
| `apps/api/prisma/seeds/staffing-master-data.ts`           | Discipline + alias seed data | Modify: add FLE discipline + 8 new aliases     |
| `apps/api/src/migration/parse-staff-costs-excel.ts`       | Excel → JSON fixture parser  | Modify: rewrite COL mapping for 22-col format  |
| `apps/api/src/migration/scripts/import-final-qa-staff.ts` | One-shot migration script    | Create: reads new Excel, upserts 192 employees |
| `apps/web/src/components/staffing/staffing-page-v2.tsx`   | Staffing page KPI wiring     | Modify: wire hsaBudget, heRatio, rechargeCost  |

---

## Chunk 1: Wave 1 — Data Layer

### Task 1: Add FLE discipline + expand discipline aliases

**Files:**

- Modify: `apps/api/prisma/seeds/staffing-master-data.ts:70-175`

- [ ] **Step 1: Add FLE discipline to the disciplines array**

In `apps/api/prisma/seeds/staffing-master-data.ts`, add after line 77 (after the EPS entry):

```typescript
{ code: 'FLE', name: 'Francais Langue Etrangere', category: 'SUBJECT', sortOrder: 6 },
```

- [ ] **Step 2: Add 8 new discipline aliases**

In the `disciplineAliases` array (after line 174), add:

```typescript
{ alias: 'Musique', disciplineCode: 'EDUCATION_MUSICALE' },
{ alias: 'Arts plastiques', disciplineCode: 'ARTS_PLASTIQUES' },
{ alias: 'Generaliste', disciplineCode: 'PRIMARY_HOMEROOM' },
{ alias: 'FLE', disciplineCode: 'FLE' },
{ alias: 'Sciences economiques', disciplineCode: 'SES' },
{ alias: 'Sciences Economiques', disciplineCode: 'SES' },
{ alias: 'PDMQDC', disciplineCode: 'PRIMARY_HOMEROOM' },
{ alias: 'Espagnol', disciplineCode: 'ESPAGNOL' },
```

- [ ] **Step 3: Run tests to verify seed file compiles**

Run: `pnpm --filter @budfin/api exec tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/seeds/staffing-master-data.ts
git commit -m "feat(staffing): add FLE discipline and 8 new discipline aliases

Adds FLE (Francais Langue Etrangere) as a new discipline code and expands
the alias table to cover subjects found in the FINAL QA Excel master data:
Musique, Arts plastiques, Generaliste, FLE, Sciences economiques, PDMQDC,
Espagnol."
```

---

### Task 2: Rewrite parse-staff-costs-excel.ts for new 22-column format

**Files:**

- Modify: `apps/api/src/migration/parse-staff-costs-excel.ts:16-76` (constants + COL enum)
- Modify: `apps/api/src/migration/parse-staff-costs-excel.ts:470-703` (main parser loop)
- Modify: `apps/api/src/migration/lib/types.ts:59-80` (StaffCostsFixture type)

- [ ] **Step 1: Update EXCEL_PATH and sheet constants**

In `parse-staff-costs-excel.ts`, change line 16:

```typescript
// Old:
const EXCEL_PATH = resolve(ROOT, 'data', 'budgets', 'EFIR_Staff_Costs_Budget_FY2026_V3.xlsx');
// New:
const EXCEL_PATH = resolve(
    ROOT,
    'data',
    'School staff force master data',
    'Staff force master data efir - FINAL (QA).xlsx'
);
```

Change line 22-25:

```typescript
const STAFF_SHEET_NAME = 'Master Data';
const HEADER_ROW = 5;
const DATA_START_ROW = 6;
const DATA_END_MARKER = 'AEFE STAFF'; // Stop parsing local staff at this section header
```

- [ ] **Step 2: Replace COL enum with new 22-column layout**

Replace lines 57-76 with:

```typescript
const COL = {
    NUM: 1, // A: #
    LAST_NAME: 2, // B: Last Name
    FIRST_NAME: 3, // C: First Name
    CONTRACT_TYPE: 4, // D: Contract Type
    FUNCTION_ROLE: 5, // E: Function / Role
    DEPARTMENT: 6, // F: Department
    SUBJECT: 7, // G: Subject / Discipline
    ALLOCATION: 8, // H: Allocation (Band)
    LEVEL: 9, // I: Level
    STATUS: 10, // J: Status
    JOINING_DATE: 11, // K: Joining Date
    YOS: 12, // L: YoS (skip)
    BASE_SALARY: 13, // M: Base Salary (SAR)
    HOUSING: 14, // N: Housing (IL)
    TRANSPORT: 15, // O: Transport (IT)
    RESP_PREMIUM: 16, // P: Resp. Premium
    HSA: 17, // Q: HSA (10m)
    MONTHLY_GROSS: 18, // R: Monthly Gross (skip)
    HOURLY_PCT: 19, // S: Hourly %
    PAYMENT: 20, // T: Payment Method
    AUGMENTATION: 21, // U: Aug. 2026-27
    NOTES: 22, // V: Notes (QA) (skip)
} as const;
```

- [ ] **Step 3: Replace DEPARTMENT_MAP with French-preserving normalization**

Replace lines 27-48 with:

```typescript
/** Normalizes department names — preserves French, fixes accent inconsistencies */
function normalizeDepartment(raw: string): string {
    const trimmed = raw.trim();
    const lower = trimmed.toLowerCase();
    // Fix accent inconsistencies between AEFE and local staff
    if (lower === 'college / lycee' || lower === 'collège / lycée') return 'Collège / Lycée';
    if (lower === 'elementaire' || lower === 'élémentaire') return 'Élémentaire';
    if (lower === 'maternelle') return 'Maternelle';
    if (lower === 'administration') return 'Administration';
    if (lower === 'vie scolaire & support') return 'Vie Scolaire & Support';
    if (lower === 'direction') return 'Direction';
    return trimmed; // Keep as-is for unknown departments
}
```

- [ ] **Step 4: Add homeBand resolution function**

Add after the normalizeDepartment function:

```typescript
/** Resolve homeBand from Allocation (col H) with Level (col I) as fallback */
function resolveHomeBand(allocation: string, level: string): string | null {
    const alloc = allocation.trim().toUpperCase();
    // Primary allocation patterns
    if (/^(PS|MS|GS)[-\s]/.test(alloc) || alloc === 'PS' || alloc === 'MS' || alloc === 'GS')
        return 'MATERNELLE';
    if (/^(CP|CE1|CE2|CM1|CM2)[-\s]/.test(alloc) || /^(CP|CE1|CE2|CM1|CM2)$/.test(alloc))
        return 'ELEMENTAIRE';
    if (/^(6[EÈ]ME|5[EÈ]ME|4[EÈ]ME|3[EÈ]ME)[-\s]?/i.test(allocation.trim())) return 'COLLEGE';
    if (/^(2NDE|1[EÈ]RE|TERM)[-\s]?/i.test(allocation.trim())) return 'LYCEE';
    if (alloc.includes('SECONDAIRE')) return 'COLLEGE';

    // Fallback to Level column
    const lvl = level.trim().toLowerCase();
    if (lvl === 'maternelle') return 'MATERNELLE';
    if (lvl.includes('lementaire') || lvl === 'élémentaire') return 'ELEMENTAIRE';
    if (lvl.includes('coll') || lvl.includes('lyc') || lvl === 'secondaire') return 'COLLEGE';
    // Non-teaching levels
    return null;
}
```

- [ ] **Step 5: Add contract type to cost mode mapping**

Add:

```typescript
/** Map contract type to costMode */
function mapCostMode(contractType: string, rowNum: number, warnings: MigrationWarning[]): string {
    const lower = contractType.trim().toLowerCase();
    if (lower === 'contrat local') return 'LOCAL_PAYROLL';
    if (lower === 'titulaire en') return 'AEFE_RECHARGE';
    warnings.push({
        code: 'UNKNOWN_CONTRACT_TYPE',
        message: `Unknown contract type "${contractType}", defaulting to LOCAL_PAYROLL`,
        row: rowNum,
        field: 'contractType',
        value: contractType,
    });
    return 'LOCAL_PAYROLL';
}
```

- [ ] **Step 6: Update StaffCostsFixture type to include new fields**

In `apps/api/src/migration/lib/types.ts`, replace the StaffCostsFixture interface (lines 59-80):

```typescript
export interface StaffCostsFixture {
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
    hourlyPercentage: string;
    baseSalary: string;
    housingAllowance: string;
    transportAllowance: string;
    responsibilityPremium: string;
    hsaAmount: string;
    augmentation: string;
    augmentationEffectiveDate: string | null;
    ajeerAnnualLevy: string;
    ajeerMonthlyFee: string;
    // New fields from FINAL QA Excel
    costMode: string;
    subject: string;
    homeBand: string | null;
    level: string;
}
```

- [ ] **Step 7: Rewrite the main parser loop**

In the main parser loop (starting at line 552), rewrite to use the new COL positions and add handling for:

- Contract Type → costMode mapping
- Subject column (col 7) → subject field
- Allocation (col 8) + Level (col 9) → homeBand resolution
- Department normalization (French accents)
- AEFE section detection (stop at "AEFE STAFF" merged row, then resume with AEFE handling)
- Saudi/Ajeer defaults (all false for new format)
- Remove Ajeer sheet lookup (not present in new Excel)

Key changes in the loop:

```typescript
const contractType = cellVal(row.getCell(COL.CONTRACT_TYPE)).trim();
const costMode = mapCostMode(contractType, r, warnings);
const subject = cellVal(row.getCell(COL.SUBJECT)).trim();
const allocation = cellVal(row.getCell(COL.ALLOCATION)).trim();
const level = cellVal(row.getCell(COL.LEVEL)).trim();
const department = normalizeDepartment(cellVal(row.getCell(COL.DEPARTMENT)));
const homeBand = resolveHomeBand(allocation, level);

// AEFE staff: all salary fields = 0
const isAefe = costMode === 'AEFE_RECHARGE';
const baseSalary = isAefe
    ? new Decimal('0')
    : cellMoney(row.getCell(COL.BASE_SALARY), r, 'base_salary', warnings);
// ... similar for other salary fields

// No Saudi/Ajeer column in new format — default both to false
const isSaudi = false;
const isAjeer = false;
```

- [ ] **Step 8: Run the parser to regenerate fixture**

Run: `pnpm --filter @budfin/api exec tsx src/migration/parse-staff-costs-excel.ts`
Expected: `Total employees parsed: 192` (166 local + 26 AEFE)
Verify: `cat data/fixtures/fy2026-staff-costs.json | python3 -c "import json,sys;d=json.load(sys.stdin);print(len(d))"`
Expected: 192

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/migration/parse-staff-costs-excel.ts apps/api/src/migration/lib/types.ts data/fixtures/fy2026-staff-costs.json
git commit -m "feat(staffing): rewrite Excel parser for new 22-column FINAL QA format

Updates column mapping to match the new Staff force master data efir - FINAL (QA).xlsx:
- 22 columns A-V (was 18 columns)
- Subject/Discipline in col G (new)
- Allocation/Band in col H (new)
- Level in col I (new)
- Contract Type in col D determines costMode
- Department names kept in French with accent normalization
- Saudi/Ajeer defaulted to false (not in new format)
- HomeBand resolved from Allocation with Level fallback
- AEFE staff imported with zero salaries and AEFE_RECHARGE costMode

Regenerates fy2026-staff-costs.json with 192 employee records."
```

---

### Task 3: Create one-shot migration script

**Files:**

- Create: `apps/api/src/migration/scripts/import-final-qa-staff.ts`

- [ ] **Step 1: Create the migration script**

Create `apps/api/src/migration/scripts/import-final-qa-staff.ts`:

```typescript
/**
 * One-shot migration: import 192 employees from FINAL QA Excel into dev DB.
 * Run: pnpm --filter @budfin/api exec tsx src/migration/scripts/import-final-qa-staff.ts
 *
 * Prerequisites:
 * 1. fy2026-staff-costs.json regenerated (Task 2 Step 8)
 * 2. Staffing master data seeded (disciplines, aliases, service profiles)
 * 3. DB backup taken
 */
import { PrismaClient } from '@prisma/client';
import { importEmployees } from '../importers/employees.js';
import { seedStaffingMasterData } from '../../../prisma/seeds/staffing-master-data.js';

const TARGET_VERSION_ID = 20; // v2 Draft
const SYSTEM_USER_ID = 1;

async function main() {
    const prisma = new PrismaClient();

    try {
        // eslint-disable-next-line no-console
        console.log('=== One-Shot Staff Migration ===');
        // eslint-disable-next-line no-console
        console.log(`Target version: ${TARGET_VERSION_ID}\n`);

        // 1. Re-seed master data (disciplines + aliases) to pick up new entries
        // eslint-disable-next-line no-console
        console.log('Step 1: Seeding staffing master data (disciplines, aliases, profiles)...');
        await seedStaffingMasterData(prisma);

        // 2. Delete existing staffing assignments for clean slate
        // eslint-disable-next-line no-console
        console.log('Step 2: Clearing existing staffing assignments...');
        const deletedAssignments = await prisma.staffingAssignment.deleteMany({
            where: { versionId: TARGET_VERSION_ID },
        });
        // eslint-disable-next-line no-console
        console.log(`  Deleted ${deletedAssignments.count} assignments`);

        // 3. Delete existing calculation results (they'll be stale)
        // eslint-disable-next-line no-console
        console.log('Step 3: Clearing existing calculation results...');
        await prisma.$transaction([
            prisma.monthlyStaffCost.deleteMany({ where: { versionId: TARGET_VERSION_ID } }),
            prisma.teachingRequirementSource.deleteMany({
                where: { versionId: TARGET_VERSION_ID },
            }),
            prisma.teachingRequirementLine.deleteMany({ where: { versionId: TARGET_VERSION_ID } }),
            prisma.categoryMonthlyCost.deleteMany({ where: { versionId: TARGET_VERSION_ID } }),
        ]);

        // 4. Import employees from regenerated fixture
        // eslint-disable-next-line no-console
        console.log('Step 4: Importing employees from fixture...');
        const result = await importEmployees(prisma, TARGET_VERSION_ID, SYSTEM_USER_ID);
        // eslint-disable-next-line no-console
        console.log(`  Status: ${result.status}`);
        // eslint-disable-next-line no-console
        console.log(`  Employees: ${result.rowCounts.employees ?? 0}`);
        if (result.warnings.length > 0) {
            // eslint-disable-next-line no-console
            console.log(`  Warnings: ${result.warnings.length}`);
        }

        // 5. Run discipline/profile/band resolution
        // eslint-disable-next-line no-console
        console.log('Step 5: Resolving disciplines, service profiles, and home bands...');
        await resolveEmployeeFields(prisma, TARGET_VERSION_ID);

        // 6. Mark STAFFING as stale so user must recalculate
        await prisma.budgetVersion.update({
            where: { id: TARGET_VERSION_ID },
            data: {
                staleModules: { push: 'STAFFING' },
            },
        });

        // 7. Verification
        // eslint-disable-next-line no-console
        console.log('\n=== Verification ===');
        const counts = await prisma.employee.groupBy({
            by: ['costMode'],
            where: { versionId: TARGET_VERSION_ID },
            _count: true,
        });
        // eslint-disable-next-line no-console
        console.log('By costMode:', JSON.stringify(counts));

        const total = await prisma.employee.count({
            where: { versionId: TARGET_VERSION_ID },
        });
        // eslint-disable-next-line no-console
        console.log(`Total employees: ${total}`);

        const withDiscipline = await prisma.employee.count({
            where: { versionId: TARGET_VERSION_ID, disciplineId: { not: null } },
        });
        // eslint-disable-next-line no-console
        console.log(`With discipline: ${withDiscipline}`);

        const withProfile = await prisma.employee.count({
            where: { versionId: TARGET_VERSION_ID, serviceProfileId: { not: null } },
        });
        // eslint-disable-next-line no-console
        console.log(`With service profile: ${withProfile}`);

        const withBand = await prisma.employee.count({
            where: { versionId: TARGET_VERSION_ID, homeBand: { not: null } },
        });
        // eslint-disable-next-line no-console
        console.log(`With home band: ${withBand}`);

        // eslint-disable-next-line no-console
        console.log('\n=== Migration Complete ===');
    } finally {
        await prisma.$disconnect();
    }
}

/**
 * Resolve discipline, service profile, and home band for imported employees.
 * Uses Subject field (from fixture) to match against DisciplineAlias table.
 */
async function resolveEmployeeFields(prisma: PrismaClient, versionId: number) {
    // Load all aliases for lookup
    const aliases = await prisma.disciplineAlias.findMany({
        include: { discipline: { select: { id: true, code: true } } },
    });
    const aliasMap = new Map<string, { id: number; code: string }>();
    for (const a of aliases) {
        aliasMap.set(a.alias.toLowerCase(), a.discipline);
    }

    // Load all disciplines for direct code match
    const allDisciplines = await prisma.discipline.findMany();
    const disciplineByCode = new Map(allDisciplines.map((d) => [d.code, d.id]));
    const disciplineByName = new Map(allDisciplines.map((d) => [d.name.toLowerCase(), d.id]));

    // Load service profiles
    const profiles = await prisma.serviceObligationProfile.findMany();
    const profileByCode = new Map(profiles.map((p) => [p.code, p.id]));

    // Get all employees for this version
    const employees = await prisma.employee.findMany({
        where: { versionId },
        select: {
            id: true,
            functionRole: true,
            department: true,
            isTeaching: true,
            costMode: true,
        },
    });

    // Load fixture to get Subject and Level fields
    const { loadFixture } = await import('../lib/fixture-loader.js');
    const fixtures = loadFixture<
        Array<{
            employeeCode: string;
            subject: string;
            homeBand: string | null;
            level: string;
            costMode: string;
        }>
    >('fy2026-staff-costs.json');
    const fixtureByCode = new Map(fixtures.map((f) => [f.employeeCode, f]));

    // Get employee codes
    const allEmps = await prisma.employee.findMany({
        where: { versionId },
        select: {
            id: true,
            employeeCode: true,
            functionRole: true,
            isTeaching: true,
            department: true,
        },
    });

    let resolved = 0;
    for (const emp of allEmps) {
        const fixture = fixtureByCode.get(emp.employeeCode);
        if (!fixture) continue;

        const subject = fixture.subject;
        const subjectLower = subject.toLowerCase();

        // Resolve discipline from Subject
        let disciplineId: number | null = null;
        // 1. Try alias match
        if (aliasMap.has(subjectLower)) {
            disciplineId = aliasMap.get(subjectLower)!.id;
        }
        // 2. Try direct name match
        if (!disciplineId && disciplineByName.has(subjectLower)) {
            disciplineId = disciplineByName.get(subjectLower)!;
        }
        // 3. Handle coordinator suffixes: "Arabe (coordinatrice)" → "Arabe"
        if (!disciplineId && subject.includes('(')) {
            const base = subject.split('(')[0]!.trim().toLowerCase();
            if (aliasMap.has(base)) disciplineId = aliasMap.get(base)!.id;
            if (!disciplineId && disciplineByName.has(base))
                disciplineId = disciplineByName.get(base)!;
        }

        // Resolve service profile
        let serviceProfileId: number | null = null;
        if (subjectLower.includes('asem')) {
            serviceProfileId = profileByCode.get('ASEM') ?? null;
        } else if (subjectLower.includes('arabe') || subjectLower.includes('islamique')) {
            serviceProfileId = profileByCode.get('ARABIC_ISLAMIC') ?? null;
        } else if (subjectLower === 'eps') {
            serviceProfileId = profileByCode.get('EPS') ?? null;
        } else if (subjectLower.includes('documentation') || subjectLower.includes('cdi')) {
            serviceProfileId = profileByCode.get('DOCUMENTALISTE') ?? null;
        } else if (emp.functionRole.toLowerCase().includes('agreg')) {
            serviceProfileId = profileByCode.get('AGREGE') ?? null;
        } else if (
            emp.isTeaching &&
            (fixture.level.toLowerCase().includes('maternelle') ||
                fixture.level.toLowerCase().includes('lementaire'))
        ) {
            serviceProfileId = profileByCode.get('PE') ?? null;
        } else if (emp.isTeaching) {
            serviceProfileId = profileByCode.get('CERTIFIE') ?? null;
        }

        // Update employee
        const updateData: Record<string, unknown> = {};
        if (disciplineId) updateData.disciplineId = disciplineId;
        if (serviceProfileId) updateData.serviceProfileId = serviceProfileId;
        if (fixture.homeBand) updateData.homeBand = fixture.homeBand;
        if (fixture.costMode) updateData.costMode = fixture.costMode;

        if (Object.keys(updateData).length > 0) {
            await prisma.employee.update({
                where: { id: emp.id },
                data: updateData,
            });
            resolved++;
        }
    }
    // eslint-disable-next-line no-console
    console.log(`  Resolved fields for ${resolved} employees`);
}

main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Migration failed:', err);
    process.exit(1);
});
```

- [ ] **Step 2: Back up DB and run migration**

```bash
# Backup
pg_dump -Fc budfin_dev > /tmp/budfin_dev_pre_staff_migration.dump

# Run migration
pnpm --filter @budfin/api exec tsx src/migration/scripts/import-final-qa-staff.ts
```

Expected output:

```
Step 4: Importing employees from fixture...
  Status: SUCCESS
  Employees: 192
Step 5: Resolving disciplines, service profiles, and home bands...
  Resolved fields for ~120 employees
=== Verification ===
Total employees: 192
```

- [ ] **Step 3: Verify DB state**

```bash
# Check employee count
pnpm --filter @budfin/api exec tsx -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const total = await p.employee.count({ where: { versionId: 20 } });
  const byMode = await p.employee.groupBy({ by: ['costMode'], where: { versionId: 20 }, _count: true });
  const byStatus = await p.employee.groupBy({ by: ['status'], where: { versionId: 20 }, _count: true });
  console.log('Total:', total);
  console.log('By costMode:', JSON.stringify(byMode));
  console.log('By status:', JSON.stringify(byStatus));
  await p.\$disconnect();
})();
"
```

Expected:

- Total: 192
- LOCAL_PAYROLL: 166, AEFE_RECHARGE: 26
- Existing: 159, New: 6, Departed: 1, Titulaire EN: 26

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/migration/scripts/import-final-qa-staff.ts
git commit -m "feat(staffing): one-shot migration for FINAL QA staff master data

Imports 192 employees (166 local + 26 AEFE) from the regenerated fixture:
- Seeds updated discipline master data (FLE + 8 aliases)
- Clears existing assignments and calculation results
- Upserts employees via importEmployees()
- Resolves discipline, service profile, and home band from Subject column
- Marks STAFFING as stale for recalculation"
```

---

## Chunk 2: Wave 2 — Calculation Verification

### Task 4: Run staffing calculation and verify results

- [ ] **Step 1: Start the dev server**

Run: `pnpm dev`
Expected: API running on :3001, web on :3000

- [ ] **Step 2: Trigger staffing calculation via API**

```bash
# Get a fresh access token (adjust credentials as needed)
TOKEN=$(curl -s http://localhost:3001/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@efir.sa","password":"admin123"}' | jq -r '.accessToken')

# Run staffing calculation
curl -s -X POST http://localhost:3001/api/v1/versions/20/calculate/staffing \
  -H "Authorization: Bearer $TOKEN" | jq .
```

Expected: `summary.totalCost` in the range of 25,000,000 to 35,000,000 (25-35M SAR)

- [ ] **Step 3: Spot-check one employee cost**

Pick employee EFIR-001 and verify salary:

```bash
curl -s http://localhost:3001/api/v1/versions/20/employees \
  -H "Authorization: Bearer $TOKEN" | jq '.data[] | select(.employeeCode=="EFIR-001") | {name, baseSalary, housingAllowance, transportAllowance, costMode}'
```

Compare against Excel row 1 values.

- [ ] **Step 4: Verify teaching requirements**

```bash
curl -s http://localhost:3001/api/v1/versions/20/teaching-requirements \
  -H "Authorization: Bearer $TOKEN" | jq '.totals'
```

Expected: `totalFteRaw` ~132, `totalFteGap` = negative (equal to -totalFteRaw since no assignments)

---

## Chunk 3: Wave 3 — Frontend KPI Cards

### Task 5: Wire HSA Budget, H/E Ratio, and Recharge Cost cards

**Files:**

- Modify: `apps/web/src/components/staffing/staffing-page-v2.tsx:94-104`

- [ ] **Step 1: Replace hardcoded KPI values with computed values**

In `staffing-page-v2.tsx`, replace the `exportKpis` useMemo (lines 94-104):

```typescript
const exportKpis: KpiValues = useMemo(() => {
    // HSA Budget: sum of hsaCostAnnual across all requirement lines
    const hsaBudget = (teachingReqData?.lines ?? [])
        .reduce((sum, line) => sum.plus(line.hsaCostAnnual ?? '0'), new Decimal(0))
        .toNumber();

    // H/E Ratio: Host (local) / Expatriate (AEFE) count
    const employees = employeesData?.data ?? [];
    const localCount = employees.filter(
        (e) => e.costMode !== 'AEFE_RECHARGE' && e.status !== 'Departed'
    ).length;
    const aefeCount = employees.filter(
        (e) => e.costMode === 'AEFE_RECHARGE' && e.status !== 'Departed'
    ).length;
    const heRatio = aefeCount > 0 ? +(localCount / aefeCount).toFixed(2) : 0;

    // Recharge Cost: sum of RESIDENT_* category costs (annualized)
    const rechargeCost = (categoryCosts?.data ?? [])
        .reduce((sum, entry) => {
            let monthTotal = new Decimal(0);
            for (const [key, val] of Object.entries(entry)) {
                if (key.startsWith('RESIDENT_') && typeof val === 'string') {
                    monthTotal = monthTotal.plus(val);
                }
            }
            return sum.plus(monthTotal);
        }, new Decimal(0))
        .toNumber();

    return {
        totalHeadcount: employeesData?.total ?? 0,
        fteGap: parseFloat(teachingReqData?.totals.totalFteGap ?? '0'),
        staffCost: new Decimal(summaryData?.cost ?? '0').toNumber(),
        hsaBudget,
        heRatio,
        rechargeCost,
    };
}, [employeesData, teachingReqData, summaryData, categoryCosts]);
```

- [ ] **Step 2: Verify categoryCosts is already loaded at page level**

Check line 58 of staffing-page-v2.tsx:

```typescript
const { data: categoryCosts } = useCategoryCosts(versionId);
```

This is already present — `categoryCosts` is available at page level. No hook changes needed.

- [ ] **Step 3: Run typecheck**

Run: `pnpm --filter @budfin/web exec tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Run all tests**

Run: `pnpm test`
Expected: All tests pass

- [ ] **Step 5: Verify in browser**

Open `http://localhost:3000/planning/staffing?fy=2026&version=20` and check:

1. Total Headcount card shows ~192 (or 191 excluding departed)
2. Staff Cost card shows value in 25-35M SAR range (not 1.6B)
3. HSA Budget card shows non-zero value
4. H/E Ratio card shows ~6.35
5. Recharge Cost card shows RESIDENT\_\* total (may be 0 if settings are 0)
6. FTE Gap card shows correct negative value

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/staffing/staffing-page-v2.tsx
git commit -m "fix(staffing): wire HSA Budget, H/E Ratio, and Recharge Cost KPI cards

Replaces hardcoded zero values with computed KPIs:
- HSA Budget: sum of hsaCostAnnual from teaching requirement lines
- H/E Ratio: local employee count / AEFE employee count (excludes departed)
- Recharge Cost: sum of all RESIDENT_* category monthly costs

Fixes F-004 (HSA Budget = 0), F-005 (H/E Ratio = 0), F-006 (Recharge Cost = 0)
from the staffing master data remediation plan."
```

---

## Final Validation

### Task 6: End-to-end reconciliation and final commit

- [ ] **Step 1: Run full test suite**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: All pass with zero errors

- [ ] **Step 2: Reconciliation matrix check**

Verify each cell in the reconciliation matrix:

| Metric         | Expected   | Check Command                                   |
| -------------- | ---------- | ----------------------------------------------- |
| Employee count | 192        | API: GET /employees → total                     |
| Local staff    | 166        | Filter costMode=LOCAL_PAYROLL                   |
| AEFE count     | 26         | Filter costMode=AEFE_RECHARGE                   |
| Staff Cost     | 25-35M SAR | GET /staffing-summary → cost                    |
| HSA Budget     | > 0        | Sum teachingReq lines hsaCostAnnual             |
| H/E Ratio      | ~6.35      | 165/26                                          |
| Recharge Cost  | >= 0       | Sum RESIDENT\_\* categories                     |
| FTE Gap        | < 0        | GET /teaching-requirements → totals.totalFteGap |
