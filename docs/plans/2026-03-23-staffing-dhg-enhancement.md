# Staffing DHG Enhancement Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add TeacherProfile as a first-class entity bridging demand and supply, backed by a CurriculumReference table, with a salary increment rules engine and profile-keyed demand grouping.

**Architecture:** New Prisma models (CurriculumReference, TeacherProfile, TeacherProfileDiscipline, EmployeeSecondaryProfile, SalaryIncrementRule) extend the staffing module. Pure-function engines (salary-increment-engine, enhanced demand-engine, enhanced coverage-engine) feed the existing calculation pipeline. API routes follow the existing master-data pattern. Frontend adds two management pages and enhances existing grids/dialogs.

**Tech Stack:** Prisma 6, Fastify 5, Zod 4, fastify-type-provider-zod, decimal.js, React 19, TanStack Query, TanStack Table v8, shadcn/ui, Tailwind v4, Vitest

**Spec:** `docs/specs/epic-20/staffing-dhg-enhancement.md`

---

## Chunk 1: Schema + Migration

### Task 1: Add new Prisma enums

**Files:**

- Modify: `apps/api/prisma/schema.prisma` (after existing enums, ~line 200)

- [ ] **Step 1: Add 5 new enums to schema.prisma**

Add after the existing `DepartmentBand` enum (~line 205):

```prisma
enum CurriculumCycle {
  MATERNELLE
  ELEMENTAIRE
  COLLEGE
  LYCEE

  @@map("curriculum_cycle")
}

enum CurriculumTrack {
  CORE
  SPECIALTY
  OPTION
  CONDITIONAL

  @@map("curriculum_track")
}

enum TeacherProfileCategory {
  PRIMARY_TEACHER
  SECONDARY_TEACHER
  SUPPORT_TEACHER

  @@map("teacher_profile_category")
}

enum ProfileDisciplineType {
  PRIMARY
  SECONDARY

  @@map("profile_discipline_type")
}

enum IncrementType {
  FIXED_AMOUNT
  PERCENTAGE
  NO_CHANGE

  @@map("increment_type")
}
```

- [ ] **Step 2: Run prisma format to validate**

Run: `pnpm --filter @budfin/api exec prisma format`
Expected: No errors, schema formatted.

- [ ] **Step 3: Commit**

```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(schema): add enums for teacher profile, curriculum, and salary increment"
```

---

### Task 2: Add CurriculumReference model

**Files:**

- Modify: `apps/api/prisma/schema.prisma` (after StaffingAssignment, ~line 1190)

- [ ] **Step 1: Add CurriculumReference model**

**IMPORTANT:** All new models MUST include `@map("snake_case")` on every camelCase field and `@db.Timestamptz` on DateTime fields, matching the existing schema convention. The examples below show the complete pattern.

```prisma
model CurriculumReference {
  id                Int             @id @default(autoincrement())
  cycle             CurriculumCycle
  stage             String          @db.VarChar(30)
  gradeLevel        String          @map("grade_level") @db.VarChar(10)
  track             CurriculumTrack
  disciplineId      Int             @map("discipline_id")
  weeklyHours       Decimal         @map("weekly_hours") @db.Decimal(4, 1)
  annualHours       Decimal         @map("annual_hours") @db.Decimal(6, 1)
  planningGroups    Int             @default(1) @map("planning_groups")
  sourceUrl         String?         @map("source_url")
  notes             String?
  effectiveFromYear Int             @map("effective_from_year")

  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz

  discipline Discipline @relation(fields: [disciplineId], references: [id])
  dhgRules   DhgRule[]

  @@unique([gradeLevel, disciplineId, track, effectiveFromYear])
  @@map("curriculum_references")
}
```

Also add the reverse relation to the `Discipline` model (~line 779):

```prisma
// Add to Discipline model:
curriculumReferences CurriculumReference[]
```

- [ ] **Step 2: Run prisma format**

Run: `pnpm --filter @budfin/api exec prisma format`

- [ ] **Step 3: Commit**

```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(schema): add CurriculumReference model"
```

---

### Task 3: Add TeacherProfile and TeacherProfileDiscipline models

**Files:**

- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Add TeacherProfile model**

```prisma
model TeacherProfile {
  id                  Int                    @id @default(autoincrement())
  code                String                 @unique @db.VarChar(50)
  name                String                 @db.VarChar(100)
  category            TeacherProfileCategory
  serviceProfileId    Int                    @map("service_profile_id")
  primaryDisciplineId Int                    @map("primary_discipline_id")
  isActive            Boolean                @default(true) @map("is_active")
  sortOrder           Int                    @default(0) @map("sort_order")

  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz

  serviceProfile    ServiceObligationProfile @relation(fields: [serviceProfileId], references: [id])
  primaryDiscipline Discipline               @relation("PrimaryDiscipline", fields: [primaryDisciplineId], references: [id])

  disciplines           TeacherProfileDiscipline[]
  employees             Employee[]                 @relation("PrimaryProfile")
  secondaryAssignments  EmployeeSecondaryProfile[]
  dhgRules              DhgRule[]
  teachingRequirements  TeachingRequirementLine[]
  demandOverrides       DemandOverride[]
  // NOTE: No salaryIncrementRules relation — SalaryIncrementRule uses isTeachingRule (Boolean), not teacherProfileId FK

  @@map("teacher_profiles")
}

model TeacherProfileDiscipline {
  id                Int                   @id @default(autoincrement())
  teacherProfileId  Int                   @map("teacher_profile_id")
  disciplineId      Int                   @map("discipline_id")
  qualificationType ProfileDisciplineType  @map("qualification_type")

  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz

  teacherProfile TeacherProfile @relation(fields: [teacherProfileId], references: [id], onDelete: Cascade)
  discipline     Discipline     @relation(fields: [disciplineId], references: [id])

  @@unique([teacherProfileId, disciplineId])
  @@map("teacher_profile_disciplines")
}
```

Also add reverse relations:

- `ServiceObligationProfile` model: add `teacherProfiles TeacherProfile[]`
- `Discipline` model: add `teacherProfilesPrimary TeacherProfile[] @relation("PrimaryDiscipline")` and `teacherProfileDisciplines TeacherProfileDiscipline[]`

- [ ] **Step 2: Run prisma format**

Run: `pnpm --filter @budfin/api exec prisma format`

- [ ] **Step 3: Commit**

```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(schema): add TeacherProfile and TeacherProfileDiscipline models"
```

---

### Task 4: Add EmployeeSecondaryProfile model

**Files:**

- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Add EmployeeSecondaryProfile model**

```prisma
model EmployeeSecondaryProfile {
  id               Int @id @default(autoincrement())
  employeeId       Int @map("employee_id")
  teacherProfileId Int @map("teacher_profile_id")

  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz

  employee       Employee       @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  teacherProfile TeacherProfile @relation(fields: [teacherProfileId], references: [id])

  @@unique([employeeId, teacherProfileId])
  @@map("employee_secondary_profiles")
}
```

- [ ] **Step 2: Add teacherProfileId and reverse relations to Employee model (~line 843)**

Add to the Employee model fields:

```prisma
teacherProfileId Int? @map("teacher_profile_id")
```

Add to Employee relations:

```prisma
teacherProfile      TeacherProfile?            @relation("PrimaryProfile", fields: [teacherProfileId], references: [id])
secondaryProfiles   EmployeeSecondaryProfile[]
```

- [ ] **Step 3: Run prisma format**

Run: `pnpm --filter @budfin/api exec prisma format`

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(schema): add EmployeeSecondaryProfile and Employee.teacherProfileId"
```

---

### Task 5: Add SalaryIncrementRule model

**Files:**

- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Add SalaryIncrementRule model**

```prisma
model SalaryIncrementRule {
  id                Int           @id @default(autoincrement())
  versionId         Int           @map("version_id")
  band              String?       @db.VarChar(15)
  costMode          String?       @map("cost_mode") @db.VarChar(20)
  isTeachingRule    Boolean?      @map("is_teaching_rule")
  incrementType     IncrementType @map("increment_type")
  incrementValue    Decimal       @map("increment_value") @db.Decimal(15, 4)
  excludeNewHires   Boolean       @default(true) @map("exclude_new_hires")
  minYearsOfService Int?          @map("min_years_of_service")

  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz

  version BudgetVersion @relation(fields: [versionId], references: [id], onDelete: Cascade)

  @@unique([versionId, band, costMode, isTeachingRule], map: "salary_increment_rules_unique", nulls: NotDistinct)
  @@map("salary_increment_rules")
}
```

**Key fixes:**

- `costMode` is `String? @db.VarChar(20)`, NOT an enum (matches Employee pattern — validated via Zod at route level)
- `nulls: NotDistinct` on unique constraint prevents duplicate catch-all rows in PostgreSQL 15+
- All fields have `@map("snake_case")` annotations

Add reverse relation to `BudgetVersion` model:

```prisma
salaryIncrementRules SalaryIncrementRule[]
```

- [ ] **Step 2: Run prisma format**

Run: `pnpm --filter @budfin/api exec prisma format`

- [ ] **Step 3: Commit**

```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(schema): add SalaryIncrementRule model"
```

---

### Task 6: Modify existing models (DhgRule, TeachingRequirementLine, DemandOverride, VersionStaffingSettings)

**Files:**

- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Add fields to DhgRule (~line 816)**

Add to DhgRule fields:

```prisma
teacherProfileId      Int? @map("teacher_profile_id")
curriculumReferenceId Int? @map("curriculum_reference_id")
```

Add to DhgRule relations:

```prisma
teacherProfile      TeacherProfile?      @relation(fields: [teacherProfileId], references: [id])
curriculumReference CurriculumReference? @relation(fields: [curriculumReferenceId], references: [id])
```

- [ ] **Step 2: Add fields to TeachingRequirementLine (~line 1132) and update unique constraint**

Add to TeachingRequirementLine fields:

```prisma
teacherProfileId   Int?    @map("teacher_profile_id")
teacherProfileCode String? @map("teacher_profile_code") @db.VarChar(50)
```

Add relation:

```prisma
teacherProfile TeacherProfile? @relation(fields: [teacherProfileId], references: [id])
```

**Update unique constraint** (per spec): change from `@@unique([versionId, band, disciplineCode, lineType])` to `@@unique([versionId, band, teacherProfileCode, lineType])`. The old `disciplineCode` field stays but is no longer part of the unique key.

- [ ] **Step 3: Add fields to DemandOverride (~line 1088) and update unique constraint**

Add to DemandOverride fields:

```prisma
teacherProfileId Int? @map("teacher_profile_id")
```

Add relation:

```prisma
teacherProfile TeacherProfile? @relation(fields: [teacherProfileId], references: [id])
```

**Update unique constraint** (per spec): change from `@@unique([versionId, band, disciplineId, lineType])` to `@@unique([versionId, band, teacherProfileId, lineType])`. The old `disciplineId` field stays but is no longer part of the unique key.

- [ ] **Step 4: Add lv2StudentSplit to VersionStaffingSettings (~line 1009)**

Add to VersionStaffingSettings fields:

```prisma
lv2StudentSplit Json? @map("lv2_student_split")
```

- [ ] **Step 5: Run prisma format**

Run: `pnpm --filter @budfin/api exec prisma format`

- [ ] **Step 6: Generate migration**

Run: `pnpm --filter @budfin/api exec prisma migrate dev --name add_teacher_profile_curriculum_increment`

Expected: Migration created successfully, database updated.

- [ ] **Step 7: Run prisma generate**

Run: `pnpm --filter @budfin/api exec prisma generate`

Expected: Prisma client generated.

- [ ] **Step 8: Run typecheck to verify no breakage**

Run: `pnpm --filter @budfin/api exec tsc --noEmit`

Expected: No errors (new fields are all optional).

- [ ] **Step 8b: Add lv2StudentSplit validation to staffing settings route**

In `apps/api/src/routes/staffing/settings.ts`, add Zod validation for the `lv2StudentSplit` field in the PUT handler:

```typescript
const lv2SplitSchema = z
    .record(z.string(), z.number().min(0).max(1))
    .optional()
    .refine(
        (val) => {
            if (!val) return true;
            const sum = Object.values(val).reduce((a, b) => a + b, 0);
            return Math.abs(sum - 1.0) < 0.001; // must sum to 1.0
        },
        { message: 'LV2 student split percentages must sum to 1.0' }
    );
```

- [ ] **Step 9: Commit**

```bash
git add apps/api/prisma/ apps/api/src/routes/staffing/settings.ts
git commit -m "feat(schema): add teacherProfileId to DhgRule, TeachingRequirementLine, DemandOverride; add lv2StudentSplit to VersionStaffingSettings"
```

---

## Chunk 2: Seed Scripts + Fixtures

**Ordering:** Curriculum reference MUST run before teacher profiles, because curriculum seeding may create Discipline records that profiles depend on. Order: curriculum (Task 7) -> profiles (Task 8) -> employees (Task 9) -> DHG links (Task 10).

### Task 7: Create seed-curriculum-reference.ts

**Files:**

- Create: `apps/api/prisma/seeds/seed-curriculum-reference.ts`

- [ ] **Step 1: Write the seed script**

Source: `data/DHG/staffing.xlsx` Curriculum_Detail sheet (95 rows for College/Lycee).
Add manual entries for Maternelle/Elementaire (homeroom model).

Uses `xlsx` package (already a dependency) to read the sheet.
Upserts by `(gradeLevel, disciplineId, track, effectiveFromYear)`.
Creates Discipline records if missing (e.g., PHILOSOPHIE, HLP, SOUTIEN, SPE_MATHS, etc.).
Maps grade names to grade codes (e.g., "6e" → "6EME").

- [ ] **Step 2: Run the seed script**

Run: `pnpm --filter @budfin/api exec tsx prisma/seeds/seed-curriculum-reference.ts`

Expected: ~100+ curriculum reference entries created.

- [ ] **Step 3: Commit**

```bash
git add apps/api/prisma/seeds/seed-curriculum-reference.ts
git commit -m "feat(seed): add seed-curriculum-reference from Curriculum_Detail sheet"
```

---

### Task 8: Create seed-teacher-profiles.ts

**Files:**

- Create: `apps/api/prisma/seeds/seed-teacher-profiles.ts`

- [ ] **Step 1: Write the seed script**

This script creates:

1. All 22 TeacherProfile records with correct ServiceObligationProfile and Discipline links
2. All TeacherProfileDiscipline records (primary + secondary disciplines per profile)

Uses `prisma.teacherProfile.upsert()` keyed on `code`.

Must look up existing `ServiceObligationProfile` by code (PE, CERTIFIE, ARABIC_ISLAMIC) and `Discipline` by code.

Data source: spec Section 1 profile table + discipline mapping table.

Reference existing disciplines in `apps/api/prisma/seeds/staffing-master-data.ts` for codes already seeded. Discipline records created by Task 7 (curriculum seed) should already exist.

- [ ] **Step 2: Run the seed script**

Run: `pnpm --filter @budfin/api exec tsx prisma/seeds/seed-teacher-profiles.ts`

Expected: 22 profiles created, discipline links established.

- [ ] **Step 3: Verify in database**

Run: `pnpm --filter @budfin/api exec tsx -e "import { PrismaClient } from '@prisma/client'; const p = new PrismaClient(); const r = await p.teacherProfile.findMany({ include: { disciplines: true } }); console.log(r.length); await p.\$disconnect();"`

Expected: 22 profiles.

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/seeds/seed-teacher-profiles.ts
git commit -m "feat(seed): add seed-teacher-profiles with 22 profiles and discipline mappings"
```

---

### Task 9: Create seed-employees-v2.ts (link employees to profiles)

**Files:**

- Create: `apps/api/prisma/seeds/seed-employees-v2.ts`

- [ ] **Step 1: Write the seed script**

Source: `data/DHG/staffing.xlsx` "Master Data (Clean)" sheet.
For each employee row:

1. Match "Teacher Profile" column to TeacherProfile.name → get teacherProfileId
2. Update Employee record: set `teacherProfileId`, set `isTeaching = true` for teaching staff
3. For ASEMs: set `isTeaching = true`, link to ASEM profile
4. For TBD employees: leave `teacherProfileId = null`

Uses `xlsx` to read the sheet. Matches employees by name (lastName + firstName) or employeeCode.

- [ ] **Step 2: Run the seed script**

Run: `pnpm --filter @budfin/api exec tsx prisma/seeds/seed-employees-v2.ts`

Expected: ~185 employees updated with profile links.

- [ ] **Step 3: Commit**

```bash
git add apps/api/prisma/seeds/seed-employees-v2.ts
git commit -m "feat(seed): link employees to teacher profiles from Master Data sheet"
```

---

### Task 10: Update DhgRule records with teacherProfileId

**Files:**

- Create: `apps/api/prisma/seeds/seed-dhg-profile-links.ts`

- [ ] **Step 1: Write the seed script**

For each existing DhgRule:

1. Look up the discipline via `disciplineId`
2. Find the TeacherProfile that covers this discipline (via TeacherProfileDiscipline)
3. Set `teacherProfileId` on the DhgRule

This links every DHG rule to the profile responsible for teaching it.

- [ ] **Step 2: Run the seed script**

Run: `pnpm --filter @budfin/api exec tsx prisma/seeds/seed-dhg-profile-links.ts`

- [ ] **Step 3: Commit**

```bash
git add apps/api/prisma/seeds/seed-dhg-profile-links.ts
git commit -m "feat(seed): link DhgRule records to TeacherProfile"
```

---

### Task 11: Update fixture files

**Files:**

- Modify: `data/fixtures/fy2026-staff-costs.json`
- Modify: `data/fixtures/fy2026-dhg-structure.json`

- [ ] **Step 1: Add teacherProfileCode to staff costs fixture**

For each employee in the JSON array, add `"teacherProfileCode"` field based on their subject/function matching the profile mapping. Non-teaching staff get `null`.

- [ ] **Step 2: Add teacherProfileCode to DHG structure fixture**

Add `teacherProfileCode` to each rule entry in the fixture.

- [ ] **Step 3: Commit**

```bash
git add data/fixtures/
git commit -m "feat(fixtures): add teacherProfileCode to staff-costs and dhg-structure fixtures"
```

---

## Chunk 3: Calculation Engines

### Task 12: Create salary-increment-engine.ts

**Files:**

- Create: `apps/api/src/services/staffing/salary-increment-engine.ts`
- Create: `apps/api/src/services/staffing/salary-increment-engine.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// salary-increment-engine.test.ts
import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { applySalaryIncrements } from './salary-increment-engine.js';

describe('applySalaryIncrements', () => {
    const baseDate = new Date('2026-08-01');

    it('applies FIXED_AMOUNT increment to matching teaching employee', () => {
        const employees = [
            {
                id: 1,
                baseSalary: new Decimal('8000'),
                teacherProfileId: 5,
                homeBand: 'COLLEGE',
                costMode: 'LOCAL_PAYROLL' as const,
                joiningDate: new Date('2020-01-01'),
            },
        ];
        const rules = [
            {
                id: 1,
                versionId: 1,
                band: null,
                costMode: 'LOCAL_PAYROLL' as const,
                isTeachingRule: true,
                incrementType: 'FIXED_AMOUNT' as const,
                incrementValue: new Decimal('250'),
                excludeNewHires: true,
                minYearsOfService: null,
            },
        ];

        const result = applySalaryIncrements(employees, rules, baseDate);

        expect(result[0].projectedBaseSalary.toString()).toBe('8250');
    });

    it('applies NO_CHANGE for Titulaire EN (NO_LOCAL_COST)', () => {
        const employees = [
            {
                id: 2,
                baseSalary: new Decimal('10000'),
                teacherProfileId: null,
                homeBand: 'COLLEGE',
                costMode: 'NO_LOCAL_COST' as const,
                joiningDate: new Date('2015-01-01'),
            },
        ];
        const rules = [
            {
                id: 2,
                versionId: 1,
                band: null,
                costMode: 'NO_LOCAL_COST' as const,
                isTeachingRule: null,
                incrementType: 'NO_CHANGE' as const,
                incrementValue: new Decimal('0'),
                excludeNewHires: false,
                minYearsOfService: null,
            },
        ];

        const result = applySalaryIncrements(employees, rules, baseDate);

        expect(result[0].projectedBaseSalary.toString()).toBe('10000');
    });

    it('excludes new hires when excludeNewHires is true', () => {
        const employees = [
            {
                id: 3,
                baseSalary: new Decimal('7000'),
                teacherProfileId: 5,
                homeBand: 'ELEMENTAIRE',
                costMode: 'LOCAL_PAYROLL' as const,
                joiningDate: new Date('2026-03-01'), // < 1 year
            },
        ];
        const rules = [
            {
                id: 1,
                versionId: 1,
                band: null,
                costMode: 'LOCAL_PAYROLL' as const,
                isTeachingRule: true,
                incrementType: 'FIXED_AMOUNT' as const,
                incrementValue: new Decimal('250'),
                excludeNewHires: true,
                minYearsOfService: null,
            },
        ];

        const result = applySalaryIncrements(employees, rules, baseDate);

        expect(result[0].projectedBaseSalary.toString()).toBe('7000'); // no increment
    });

    it('applies PERCENTAGE increment correctly', () => {
        const employees = [
            {
                id: 4,
                baseSalary: new Decimal('10000'),
                teacherProfileId: 5,
                homeBand: 'LYCEE',
                costMode: 'LOCAL_PAYROLL' as const,
                joiningDate: new Date('2020-01-01'),
            },
        ];
        const rules = [
            {
                id: 1,
                versionId: 1,
                band: null,
                costMode: 'LOCAL_PAYROLL' as const,
                isTeachingRule: true,
                incrementType: 'PERCENTAGE' as const,
                incrementValue: new Decimal('0.05'), // 5%
                excludeNewHires: true,
                minYearsOfService: null,
            },
        ];

        const result = applySalaryIncrements(employees, rules, baseDate);

        expect(result[0].projectedBaseSalary.toString()).toBe('10500');
    });

    it('picks most specific rule (band+costMode+isTeaching over catch-all)', () => {
        const employees = [
            {
                id: 5,
                baseSalary: new Decimal('9000'),
                teacherProfileId: 5,
                homeBand: 'LYCEE',
                costMode: 'LOCAL_PAYROLL' as const,
                joiningDate: new Date('2020-01-01'),
            },
        ];
        const rules = [
            {
                id: 1,
                versionId: 1,
                band: 'LYCEE',
                costMode: 'LOCAL_PAYROLL' as const,
                isTeachingRule: true,
                incrementType: 'FIXED_AMOUNT' as const,
                incrementValue: new Decimal('300'),
                excludeNewHires: true,
                minYearsOfService: null,
            },
            {
                id: 2,
                versionId: 1,
                band: null,
                costMode: 'LOCAL_PAYROLL' as const,
                isTeachingRule: true,
                incrementType: 'FIXED_AMOUNT' as const,
                incrementValue: new Decimal('250'),
                excludeNewHires: true,
                minYearsOfService: null,
            },
        ];

        const result = applySalaryIncrements(employees, rules, baseDate);

        expect(result[0].projectedBaseSalary.toString()).toBe('9300'); // 300, not 250
    });

    it('throws on negative projected salary', () => {
        const employees = [
            {
                id: 6,
                baseSalary: new Decimal('100'),
                teacherProfileId: null,
                homeBand: 'COLLEGE',
                costMode: 'LOCAL_PAYROLL' as const,
                joiningDate: new Date('2020-01-01'),
            },
        ];
        const rules = [
            {
                id: 1,
                versionId: 1,
                band: null,
                costMode: 'LOCAL_PAYROLL' as const,
                isTeachingRule: false,
                incrementType: 'FIXED_AMOUNT' as const,
                incrementValue: new Decimal('-200'),
                excludeNewHires: false,
                minYearsOfService: null,
            },
        ];

        expect(() => applySalaryIncrements(employees, rules, baseDate)).toThrow('negative');
    });

    it('skips increment when employee YoS is below minYearsOfService', () => {
        const employees = [
            {
                id: 8,
                baseSalary: new Decimal('8000'),
                teacherProfileId: 5,
                homeBand: 'COLLEGE',
                costMode: 'LOCAL_PAYROLL' as const,
                joiningDate: new Date('2024-06-01'), // ~2 years
            },
        ];
        const rules = [
            {
                id: 1,
                versionId: 1,
                band: null,
                costMode: 'LOCAL_PAYROLL' as const,
                isTeachingRule: true,
                incrementType: 'FIXED_AMOUNT' as const,
                incrementValue: new Decimal('500'),
                excludeNewHires: false,
                minYearsOfService: 5, // requires 5+ years
            },
        ];

        const result = applySalaryIncrements(employees, rules, baseDate);

        expect(result[0].projectedBaseSalary.toString()).toBe('8000'); // no increment, only 2 years
    });

    it('returns original salary when no rule matches', () => {
        const employees = [
            {
                id: 7,
                baseSalary: new Decimal('5000'),
                teacherProfileId: null,
                homeBand: 'COLLEGE',
                costMode: 'AEFE_RECHARGE' as const,
                joiningDate: new Date('2020-01-01'),
            },
        ];
        const rules = []; // no rules

        const result = applySalaryIncrements(employees, rules, baseDate);

        expect(result[0].projectedBaseSalary.toString()).toBe('5000');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @budfin/api exec vitest run src/services/staffing/salary-increment-engine.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```typescript
// salary-increment-engine.ts
import Decimal from 'decimal.js';

Decimal.set({ rounding: Decimal.ROUND_HALF_UP });

export interface IncrementEmployee {
    id: number;
    baseSalary: Decimal;
    teacherProfileId: number | null;
    homeBand: string | null;
    costMode: string;
    joiningDate: Date;
}

export interface IncrementRule {
    id: number;
    versionId: number;
    band: string | null;
    costMode: string | null;
    isTeachingRule: boolean | null;
    incrementType: 'FIXED_AMOUNT' | 'PERCENTAGE' | 'NO_CHANGE';
    incrementValue: Decimal;
    excludeNewHires: boolean;
    minYearsOfService: number | null;
}

export interface ProjectedSalary {
    employeeId: number;
    originalBaseSalary: Decimal;
    projectedBaseSalary: Decimal;
    appliedRuleId: number | null;
}

function countSpecificity(rule: IncrementRule): number {
    let count = 0;
    if (rule.band !== null) count++;
    if (rule.costMode !== null) count++;
    if (rule.isTeachingRule !== null) count++;
    return count;
}

function ruleMatchesEmployee(rule: IncrementRule, emp: IncrementEmployee): boolean {
    if (rule.band !== null && rule.band !== emp.homeBand) return false;
    if (rule.costMode !== null && rule.costMode !== emp.costMode) return false;
    if (rule.isTeachingRule !== null) {
        const empIsTeaching = emp.teacherProfileId !== null;
        if (rule.isTeachingRule !== empIsTeaching) return false;
    }
    return true;
}

function yearsOfService(joiningDate: Date, referenceDate: Date): number {
    const diffMs = referenceDate.getTime() - joiningDate.getTime();
    return diffMs / (365.25 * 24 * 60 * 60 * 1000);
}

export function applySalaryIncrements(
    employees: IncrementEmployee[],
    rules: IncrementRule[],
    versionStartDate: Date
): ProjectedSalary[] {
    const sorted = [...rules].sort((a, b) => countSpecificity(b) - countSpecificity(a));

    return employees.map((emp) => {
        let projectedBaseSalary = emp.baseSalary;
        let appliedRuleId: number | null = null;

        for (const rule of sorted) {
            if (!ruleMatchesEmployee(rule, emp)) continue;

            const yos = yearsOfService(emp.joiningDate, versionStartDate);
            if (rule.excludeNewHires && yos < 1) continue;
            if (rule.minYearsOfService !== null && yos < rule.minYearsOfService) continue;

            switch (rule.incrementType) {
                case 'FIXED_AMOUNT':
                    projectedBaseSalary = emp.baseSalary.plus(rule.incrementValue);
                    break;
                case 'PERCENTAGE':
                    projectedBaseSalary = emp.baseSalary.times(
                        new Decimal(1).plus(rule.incrementValue)
                    );
                    break;
                case 'NO_CHANGE':
                    projectedBaseSalary = emp.baseSalary;
                    break;
            }

            appliedRuleId = rule.id;
            break; // first match wins
        }

        if (projectedBaseSalary.isNegative()) {
            throw new Error(
                `Projected salary is negative for employee ${emp.id}: ${projectedBaseSalary.toString()}. ` +
                    `Rule ${appliedRuleId} produced an invalid result.`
            );
        }

        return {
            employeeId: emp.id,
            originalBaseSalary: emp.baseSalary,
            projectedBaseSalary,
            appliedRuleId,
        };
    });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @budfin/api exec vitest run src/services/staffing/salary-increment-engine.test.ts`

Expected: All 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/staffing/salary-increment-engine.ts apps/api/src/services/staffing/salary-increment-engine.test.ts
git commit -m "feat(engine): add salary-increment-engine with specificity cascade and TDD tests"
```

---

### Task 13: Enhance demand-engine.ts — profile-keyed grouping

**Files:**

- Modify: `apps/api/src/services/staffing/demand-engine.ts`
- Modify: `apps/api/src/services/staffing/demand-engine.test.ts`

- [ ] **Step 1: Write failing test for profile-keyed grouping**

Add test to `demand-engine.test.ts`:

```typescript
// NOTE: The existing test file uses makeProfiles() and defaultSettings() helpers,
// and constructs DemandEngineInput directly. Follow the existing pattern.
// Define the input inline or add a helper. Do NOT call createDemandInput/createRule
// — they don't exist.
it('groups requirement lines by teacherProfileId when present on rules', () => {
    const profiles = makeProfiles(); // existing helper
    const input: DemandEngineInput = {
        enrollments: [{ gradeLevel: '6EME', headcount: 120, maxClassSize: 30 }],
        rules: [
            {
                id: 1,
                gradeLevel: '6EME',
                disciplineId: 1,
                lineType: 'STRUCTURAL',
                driverType: 'HOURS',
                hoursPerUnit: 4.5,
                groupingKey: null,
                serviceProfileId: profiles.certifie.id,
                teacherProfileId: 5,
                teacherProfileCode: 'CERTIFIE_MATHS',
            },
            {
                id: 2,
                gradeLevel: '6EME',
                disciplineId: 2,
                lineType: 'STRUCTURAL',
                driverType: 'HOURS',
                hoursPerUnit: 2,
                groupingKey: null,
                serviceProfileId: profiles.certifie.id,
                teacherProfileId: 5,
                teacherProfileCode: 'CERTIFIE_MATHS',
            },
        ],
        settings: defaultSettings(),
        serviceProfiles: [profiles.certifie],
        groupAssumptions: [],
    };

    const result = calculateDemand(input);

    // Both discipline lines roll up into one profile line
    const mathsLines = result.requirementLines.filter(
        (l) => l.teacherProfileCode === 'CERTIFIE_MATHS'
    );
    expect(mathsLines).toHaveLength(1);
    // Total hours = (4.5 + 2) * 4 sections = 26 hours
    expect(mathsLines[0].totalWeeklyHours).toBeCloseTo(26);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @budfin/api exec vitest run src/services/staffing/demand-engine.test.ts`

Expected: FAIL — teacherProfileId not recognized.

- [ ] **Step 3: Implement profile-keyed grouping**

Modify the `calculateDemand` function:

1. Accept `teacherProfileId` and `teacherProfileCode` on input rule objects
2. Change grouping key from `band|disciplineCode|lineType` to `band|teacherProfileId|lineType` when teacherProfileId is present
3. Fall back to discipline-based grouping when teacherProfileId is null (backward compatibility)
4. Set `teacherProfileId` and `teacherProfileCode` on output requirement lines

**Note on TeachingRequirementSource:** This model stores per-grade source data (headcount, driver units). It remains discipline-level — no `teacherProfileId` needed. The profile grouping happens in the aggregation step (requirement lines), not at the source data level. Sources feed into the demand engine, which then groups by profile when producing requirement lines.

- [ ] **Step 4: Run tests to verify all pass**

Run: `pnpm --filter @budfin/api exec vitest run src/services/staffing/demand-engine.test.ts`

Expected: All tests PASS (existing + new).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/staffing/demand-engine.ts apps/api/src/services/staffing/demand-engine.test.ts
git commit -m "feat(engine): add profile-keyed grouping to demand engine"
```

---

### Task 14: Enhance coverage-engine.ts — profile-aware matching

**Files:**

- Modify: `apps/api/src/services/staffing/coverage-engine.ts`
- Create: `apps/api/src/services/staffing/coverage-engine.test.ts` (if not exists)

- [ ] **Step 1: Write failing test for profile-aware coverage**

```typescript
// NOTE: calculateCoverage uses a single CoverageEngineInput object, not separate args.
// Add profileDisciplines as a new optional field on CoverageEngineInput.
it('matches employee to requirement line via primary profile', () => {
    const input: CoverageEngineInput = {
        requirementLines: [
            {
                id: 1,
                band: 'COLLEGE',
                teacherProfileId: 5,
                teacherProfileCode: 'CERTIFIE_MATHS',
                requiredFteRaw: new Decimal('3.5'),
                lineType: 'STRUCTURAL',
            },
        ],
        assignments: [
            {
                employeeId: 10,
                band: 'COLLEGE',
                disciplineId: 1, // MATHEMATIQUES
                hoursPerWeek: new Decimal('18'),
                fteShare: new Decimal('1'),
            },
        ],
        // NEW field: Map<teacherProfileId, disciplineId[]>
        profileDisciplines: new Map([[5, [1, 2, 3]]]), // profile 5 covers discipline 1,2,3
    };

    const result = calculateCoverage(input);

    expect(result.lines[0].coveredFte.toString()).toBe('1');
    expect(result.lines[0].gapFte.toString()).toBe('2.5');
});
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement profile-aware coverage matching**

Modify `calculateCoverage`:

1. Accept a `profileDisciplines` map: `Map<teacherProfileId, disciplineId[]>`
2. For each requirement line with `teacherProfileId`:
    - Get the list of disciplines this profile covers
    - Sum FTE from all assignments whose `disciplineId` is in that list
3. Fall back to discipline-based matching when `teacherProfileId` is null

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @budfin/api exec vitest run src/services/staffing/coverage-engine.test.ts`

Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/staffing/coverage-engine.ts apps/api/src/services/staffing/coverage-engine.test.ts
git commit -m "feat(engine): add profile-aware matching to coverage engine"
```

---

### Task 15: Integrate salary increment into calculate pipeline

**Files:**

- Modify: `apps/api/src/routes/staffing/calculate.ts`

- [ ] **Step 1: Import salary-increment-engine**

Add import at top:

```typescript
import { applySalaryIncrements } from '../../services/staffing/salary-increment-engine.js';
```

- [ ] **Step 2: Add Step 0 to the calculation pipeline**

After loading employees but before cost calculations:

```typescript
// Step 0: Apply salary increment rules
// NOTE: The existing raw SQL query for employees uses snake_case columns (e.g., e.base_salary, e.home_band).
// Add e.teacher_profile_id to the SELECT clause and map it when constructing the increment engine input.
// Use emp.base_salary (not emp.baseSalary) etc. — raw SQL returns snake_case.
const incrementRules = await prisma.salaryIncrementRule.findMany({
    where: { versionId },
});

// BudgetVersion has fiscalYear (Int) but no startDate. Aug 1 is the fiscal year start for EFIR.
const versionStartDate = new Date(version.fiscalYear, 7, 1); // Aug 1 of fiscal year

const projectedSalaries =
    incrementRules.length > 0
        ? applySalaryIncrements(
              employees.map((e) => ({
                  id: e.id,
                  baseSalary: new Decimal(e.baseSalary),
                  teacherProfileId: e.teacherProfileId,
                  homeBand: e.homeBand,
                  costMode: e.costMode,
                  joiningDate: e.joiningDate,
              })),
              incrementRules.map((r) => ({
                  ...r,
                  incrementValue: new Decimal(r.incrementValue),
              })),
              versionStartDate
          )
        : null;

// Pass projectedSalaries to cost engine (Step 8)
// If projectedSalaries exists, use projected base salary instead of stored base salary
```

- [ ] **Step 3: Wire projected salaries into cost engine call**

Modify the cost calculation step to use `projectedSalaries` when available, looking up each employee's projected base salary by employeeId.

- [ ] **Step 4: Run existing tests**

Run: `pnpm --filter @budfin/api test`

Expected: All pass — increment rules table is empty by default, so Step 0 is a no-op.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/staffing/calculate.ts
git commit -m "feat(calculate): integrate salary increment engine as Step 0 in pipeline"
```

---

## Chunk 4: API Routes

### Task 16: Add teacher-profiles master data routes

**Files:**

- Create: `apps/api/src/routes/master-data/teacher-profiles.ts`
- Modify: `apps/api/src/routes/master-data/index.ts`

- [ ] **Step 1: Create teacher-profiles.ts route file**

Follow the pattern in `staffing-master-data.ts`. Implement:

- `GET /teacher-profiles` — list all profiles with `include: { disciplines: { include: { discipline: true } }, primaryDiscipline: true, serviceProfile: true }`. Filter by `?active=true` optional param.
- `POST /teacher-profiles` — create profile + discipline links. Requires `data:edit`. Zod schema validates code, name, category, serviceProfileId, primaryDisciplineId, disciplines array.
- `PUT /teacher-profiles/:id` — update profile. Requires `data:edit`. Accepts partial updates. Updates TeacherProfileDiscipline records with full-replace semantics.
- `DELETE /teacher-profiles/:id` — hard delete. Requires `data:edit`. Check for linked employees (primary + secondary) before deleting. Return 409 CONFLICT if linked.

- [ ] **Step 2: Register in master-data/index.ts**

Add import and registration. Follow the `staffingMasterDataRoutes` pattern — routes define their paths internally (e.g., `/teacher-profiles`, `/teacher-profiles/:id`), no prefix at registration:

```typescript
import { teacherProfileRoutes } from './teacher-profiles.js';
// In the plugin function (alongside staffingMasterDataRoutes):
await fastify.register(teacherProfileRoutes);
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm --filter @budfin/api exec tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/master-data/teacher-profiles.ts apps/api/src/routes/master-data/index.ts
git commit -m "feat(api): add teacher-profiles CRUD master data routes"
```

---

### Task 17: Add curriculum master data routes

**Files:**

- Create: `apps/api/src/routes/master-data/curriculum.ts`
- Modify: `apps/api/src/routes/master-data/index.ts`

- [ ] **Step 1: Create curriculum.ts route file**

- `GET /curriculum` — list with optional filters: `?cycle=COLLEGE`, `?gradeLevel=6EME`, `?effectiveFromYear=2025`. Include discipline relation.
- `POST /curriculum` — create/upsert entry. Requires `data:edit`. Zod schema validates all fields.

- [ ] **Step 2: Register in master-data/index.ts**

- [ ] **Step 3: Run typecheck**

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/master-data/curriculum.ts apps/api/src/routes/master-data/index.ts
git commit -m "feat(api): add curriculum reference master data routes"
```

---

### Task 18: Add salary-increment-rules routes

**Files:**

- Create: `apps/api/src/routes/staffing/salary-increment-rules.ts`
- Modify: `apps/api/src/routes/staffing/index.ts`

- [ ] **Step 1: Create salary-increment-rules.ts**

Version-scoped routes:

- `GET /salary-increment-rules` — list rules for versionId. Requires `salary:view`.
- `POST /salary-increment-rules` — create/update rule. Requires `salary:edit`. Zod schema validates band, costMode, isTeachingRule, incrementType, incrementValue, excludeNewHires, minYearsOfService.
- `DELETE /salary-increment-rules/:id` — delete rule. Requires `salary:edit`.

- [ ] **Step 2: Add salary-projection preview endpoint**

In `apps/api/src/routes/staffing/calculate.ts`, add:

- `POST /calculate/salary-projection` — loads employees + rules, runs `applySalaryIncrements`, returns summary (not persisted). Requires `salary:view`.

Response shape:

```typescript
{
    projections: Array<{
        employeeId: number;
        employeeName: string;
        currentBaseSalary: string;
        projectedBaseSalary: string;
        incrementAmount: string;
        appliedRuleId: number | null;
    }>;
    summary: {
        totalEmployees: number;
        incrementedCount: number;
        unchangedCount: number;
        newHireSkippedCount: number;
    }
}
```

- [ ] **Step 3: Register in staffing/index.ts**

- [ ] **Step 4: Run typecheck**

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/staffing/salary-increment-rules.ts apps/api/src/routes/staffing/index.ts apps/api/src/routes/staffing/calculate.ts
git commit -m "feat(api): add salary-increment-rules CRUD and salary-projection preview endpoint"
```

---

### Task 19: Modify employee routes — add profile fields

**Files:**

- Modify: `apps/api/src/routes/staffing/employees.ts`

- [ ] **Step 1: Update GET response to include teacher profile**

In the employee list query, add:

```typescript
include: {
  teacherProfile: { select: { id: true, code: true, name: true } },
  secondaryProfiles: {
    include: { teacherProfile: { select: { id: true, code: true, name: true } } },
  },
}
```

Map the response to include `teacherProfile` and `secondaryProfiles` in the output shape.

- [ ] **Step 2: Update POST/PUT to accept teacherProfileId and secondaryProfileIds**

Add to the Zod request schema:

```typescript
teacherProfileId: z.number().int().nullable().optional(),
secondaryProfileIds: z.array(z.number().int()).optional(),
```

In the handler:

- Set `teacherProfileId` on employee create/update
- For `secondaryProfileIds`: delete all existing `EmployeeSecondaryProfile` for this employee, then create new ones. Validate no duplicate of primary profile.

- [ ] **Step 3: Run typecheck**

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/staffing/employees.ts
git commit -m "feat(api): add teacherProfileId and secondaryProfiles to employee endpoints"
```

---

## Chunk 5: Frontend — Hooks + Data Layer

### Task 20: Add teacher profile types and hooks

**Files:**

- Modify: `apps/web/src/hooks/use-staffing.ts`

- [ ] **Step 1: Add types**

```typescript
export interface TeacherProfile {
    id: number;
    code: string;
    name: string;
    category: 'PRIMARY_TEACHER' | 'SECONDARY_TEACHER' | 'SUPPORT_TEACHER';
    serviceProfileId: number;
    primaryDisciplineId: number;
    isActive: boolean;
    sortOrder: number;
    disciplines: Array<{
        disciplineId: number;
        qualificationType: 'PRIMARY' | 'SECONDARY';
        discipline: { id: number; code: string; name: string };
    }>;
}

export interface SalaryIncrementRule {
    id: number;
    versionId: number;
    band: string | null;
    costMode: string | null;
    isTeachingRule: boolean | null;
    incrementType: 'FIXED_AMOUNT' | 'PERCENTAGE' | 'NO_CHANGE';
    incrementValue: string;
    excludeNewHires: boolean;
    minYearsOfService: number | null;
}

export interface SalaryProjectionResponse {
    projections: Array<{
        employeeId: number;
        employeeName: string;
        currentBaseSalary: string;
        projectedBaseSalary: string;
        incrementAmount: string;
        appliedRuleId: number | null;
    }>;
    summary: {
        totalEmployees: number;
        incrementedCount: number;
        unchangedCount: number;
        newHireSkippedCount: number;
    };
}
```

- [ ] **Step 2: Add query hooks**

```typescript
export function useTeacherProfiles() {
    return useQuery({
        queryKey: ['teacher-profiles'],
        queryFn: () => apiClient<TeacherProfile[]>('/master-data/teacher-profiles'),
    });
}

export function useSalaryIncrementRules(versionId: number | undefined) {
    return useQuery({
        queryKey: ['salary-increment-rules', versionId],
        queryFn: () =>
            apiClient<SalaryIncrementRule[]>(`/versions/${versionId}/salary-increment-rules`),
        enabled: !!versionId,
    });
}
```

- [ ] **Step 3: Add mutation hooks**

```typescript
export function useCreateSalaryIncrementRule(versionId: number | undefined) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (data: Omit<SalaryIncrementRule, 'id' | 'versionId'>) =>
            apiClient(`/versions/${versionId}/salary-increment-rules`, {
                method: 'POST',
                body: data,
            }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['salary-increment-rules', versionId] });
        },
    });
}

export function useDeleteSalaryIncrementRule(versionId: number | undefined) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (ruleId: number) =>
            apiClient(`/versions/${versionId}/salary-increment-rules/${ruleId}`, {
                method: 'DELETE',
            }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['salary-increment-rules', versionId] });
        },
    });
}

export function usePreviewSalaryProjection(versionId: number | undefined) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: () =>
            apiClient<SalaryProjectionResponse>(
                `/versions/${versionId}/calculate/salary-projection`,
                { method: 'POST' }
            ),
    });
}
```

- [ ] **Step 4: Update Employee interface**

Add to the existing `Employee` interface:

```typescript
teacherProfileId: number | null;
teacherProfile: { id: number; code: string; name: string } | null;
secondaryProfiles: Array<{ id: number; code: string; name: string }>;
```

- [ ] **Step 5: Run typecheck**

Run: `pnpm --filter @budfin/web exec tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/hooks/use-staffing.ts
git commit -m "feat(web): add teacher profile, salary increment rule types and hooks"
```

---

### Task 21: Add curriculum hooks

**Files:**

- Create: `apps/web/src/hooks/use-curriculum.ts`

- [ ] **Step 1: Create the hook file**

```typescript
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';

export interface CurriculumReference {
    id: number;
    cycle: 'MATERNELLE' | 'ELEMENTAIRE' | 'COLLEGE' | 'LYCEE';
    stage: string;
    gradeLevel: string;
    track: 'CORE' | 'SPECIALTY' | 'OPTION' | 'CONDITIONAL';
    disciplineId: number;
    weeklyHours: string;
    annualHours: string;
    planningGroups: number;
    sourceUrl: string | null;
    notes: string | null;
    effectiveFromYear: number;
    discipline: { id: number; code: string; name: string };
}

export function useCurriculumReferences(filters?: {
    cycle?: string;
    gradeLevel?: string;
    effectiveFromYear?: number;
}) {
    const params = new URLSearchParams();
    if (filters?.cycle) params.set('cycle', filters.cycle);
    if (filters?.gradeLevel) params.set('gradeLevel', filters.gradeLevel);
    if (filters?.effectiveFromYear)
        params.set('effectiveFromYear', String(filters.effectiveFromYear));
    const qs = params.toString();

    return useQuery({
        queryKey: ['curriculum-references', filters],
        queryFn: () =>
            apiClient<CurriculumReference[]>(`/master-data/curriculum${qs ? `?${qs}` : ''}`),
    });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/hooks/use-curriculum.ts
git commit -m "feat(web): add use-curriculum hook for CurriculumReference API"
```

---

## Chunk 6: Frontend — Components

### Task 22: Update employee-grid.tsx — add Teacher Profile column

**Files:**

- Modify: `apps/web/src/components/staffing/employee-grid.tsx`

- [ ] **Step 1: Add Teacher Profile column definition**

Add a new column to the column definitions array:

```typescript
columnHelper.accessor('teacherProfile', {
  header: 'Teacher Profile',
  cell: ({ getValue }) => {
    const profile = getValue();
    return profile ? profile.name : (
      <span className="text-muted-foreground italic">Unassigned</span>
    );
  },
  size: 180,
}),
```

- [ ] **Step 2: Run typecheck and dev server to verify**

Run: `pnpm --filter @budfin/web exec tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/staffing/employee-grid.tsx
git commit -m "feat(web): add Teacher Profile column to employee grid"
```

---

### Task 23: Update teaching-master-grid.tsx — profile-keyed grouping

**Files:**

- Modify: `apps/web/src/components/staffing/teaching-master-grid.tsx`
- Modify: `apps/web/src/lib/staffing-workspace.ts`

- [ ] **Step 1: Update TeachingGridRow type in staffing-workspace.ts**

Add `teacherProfileId` and `teacherProfileCode` fields to the `TeachingGridRow` type. Update `buildTeachingGridRows()` to use `teacherProfileCode` for grouping when available.

- [ ] **Step 2: Update grid column to show profile name**

Replace `disciplineCode` display with `teacherProfileCode` where it exists. Show the profile name as the primary row label, with discipline codes as secondary info.

- [ ] **Step 3: Run typecheck**

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/staffing/teaching-master-grid.tsx apps/web/src/lib/staffing-workspace.ts
git commit -m "feat(web): update teaching master grid for profile-keyed grouping"
```

---

### Task 24: Update staffing-settings-dialog.tsx — add increment rules tab

**Files:**

- Modify: `apps/web/src/components/staffing/staffing-settings-dialog.tsx`

- [ ] **Step 1: Add Salary Increment Rules tab**

Add a new tab to the dialog's tab list. The tab content renders a table with:

- band (dropdown: Maternelle/Elementaire/College/Lycee/All)
- costMode (dropdown: LOCAL_PAYROLL/AEFE_RECHARGE/NO_LOCAL_COST/All)
- isTeachingRule (tri-state: Teaching/Non-Teaching/All)
- incrementType (dropdown: FIXED_AMOUNT/PERCENTAGE/NO_CHANGE)
- value (numeric input)
- excludeNewHires (checkbox)
- Add/Remove row buttons

Uses `useSalaryIncrementRules()` and `useCreateSalaryIncrementRule()` hooks.

- [ ] **Step 2: Add LV2 Split Assumptions tab**

Add another tab with three numeric inputs:

- Arabic % (0-100, displayed)
- German % (0-100, displayed)
- Spanish % (0-100, displayed)
- Validation: must sum to 100

Stored as decimal fractions in `VersionStaffingSettings.lv2StudentSplit`.

Uses `usePutStaffingSettings()` hook with the lv2StudentSplit field.

- [ ] **Step 3: Add Preview button to increment rules tab**

Wire the "Preview" button to `usePreviewSalaryProjection()`. Display the summary in a toast or inline panel showing count of affected employees and total increment amount.

- [ ] **Step 4: Run typecheck**

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/staffing/staffing-settings-dialog.tsx
git commit -m "feat(web): add salary increment rules and LV2 split tabs to staffing settings"
```

---

### Task 25: Create Teacher Profile management page

**Files:**

- Create: `apps/web/src/pages/master-data/teacher-profiles-page.tsx`
- Modify: `apps/web/src/router.tsx` (add route)

- [ ] **Step 1: Create the page component**

A DataGrid-based CRUD page under Management Shell → Master Data:

- Table columns: code, name, category, service profile (ORS hours), primary discipline, secondary disciplines (tag list), isActive
- Row actions: Edit (dialog), Delete (confirm, disabled if employees linked), Set Inactive
- Add button opens create dialog with form fields
- Uses `useTeacherProfiles()` hook

Follow the pattern of existing master data pages.

- [ ] **Step 2: Add route to router.tsx**

Add under the ManagementShell routes:

```typescript
// Follow the existing router pattern: direct imports + element prop (not lazy)
import { TeacherProfilesPage } from './pages/master-data/teacher-profiles-page';
// ...
{
  path: 'master-data/teacher-profiles',
  element: <TeacherProfilesPage />,
}
```

- [ ] **Step 3: Run typecheck**

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/master-data/teacher-profiles-page.tsx apps/web/src/router.tsx
git commit -m "feat(web): add Teacher Profile management page under master data"
```

---

### Task 26: Create Curriculum Reference page

**Files:**

- Create: `apps/web/src/pages/master-data/curriculum-reference-page.tsx`
- Modify: `apps/web/src/router.tsx`

- [ ] **Step 1: Create the read-only page**

DataGrid showing MEN curriculum data:

- Columns: cycle, grade, track, subject name, weekly hours, annual hours, source link
- Filters: cycle dropdown, grade dropdown
- Read-only (no create/edit/delete)
- Uses `useCurriculumReferences()` hook

- [ ] **Step 2: Add route**

```typescript
import { CurriculumReferencePage } from './pages/master-data/curriculum-reference-page';
// ...
{
  path: 'master-data/curriculum',
  element: <CurriculumReferencePage />,
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/master-data/curriculum-reference-page.tsx apps/web/src/router.tsx
git commit -m "feat(web): add Curriculum Reference read-only page under master data"
```

---

### Task 27: Replace hardcoded curriculum-coverage-map.ts

**Files:**

- Modify: `apps/web/src/lib/curriculum-coverage-map.ts`
- Modify: `apps/web/src/lib/curriculum-coverage-map.test.ts`
- Modify: `apps/web/src/components/staffing/coverage-tab-content.tsx` (or wherever coverage map is consumed)

- [ ] **Step 1: Remove EXPECTED_COVERAGE array**

Delete the hardcoded `EXPECTED_COVERAGE` array (~70 entries). Replace `buildRuleIndex`, `computeCoverageGaps`, `computeCurriculumKpis`, `isExpectedCell`, `isGapCell` to accept curriculum data as a parameter rather than using the hardcoded array.

Keep `DISCIPLINE_DISPLAY_GROUPS` — this is a UI grouping concern.

- [ ] **Step 2: Update consumers to pass curriculum data**

In `coverage-tab-content.tsx` (or wherever coverage map functions are called), fetch curriculum data via `useCurriculumReferences()` and pass it to the coverage gap functions.

- [ ] **Step 3: Update tests**

Update `curriculum-coverage-map.test.ts` to pass curriculum data as test fixtures instead of relying on the hardcoded array.

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @budfin/web exec vitest run src/lib/curriculum-coverage-map.test.ts`

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/curriculum-coverage-map.ts apps/web/src/lib/curriculum-coverage-map.test.ts apps/web/src/components/staffing/
git commit -m "refactor(web): replace hardcoded curriculum coverage map with API-driven data"
```

---

## Chunk 7: Validation + Final Verification

### Task 28: Run full test suite

- [ ] **Step 1: Run all backend tests**

Run: `pnpm --filter @budfin/api test`

Expected: All pass.

- [ ] **Step 2: Run all frontend tests**

Run: `pnpm --filter @budfin/web test`

Expected: All pass.

- [ ] **Step 3: Run typecheck across all packages**

Run: `pnpm typecheck`

Expected: Zero errors.

- [ ] **Step 4: Run linter**

Run: `pnpm lint`

Expected: Zero errors.

---

### Task 29: End-to-end validation with v2/2026 data

- [ ] **Step 1: Start dev server**

Run: `pnpm dev`

- [ ] **Step 2: Run all seed scripts in order**

```bash
pnpm --filter @budfin/api exec tsx prisma/seeds/seed-curriculum-reference.ts
pnpm --filter @budfin/api exec tsx prisma/seeds/seed-teacher-profiles.ts
pnpm --filter @budfin/api exec tsx prisma/seeds/seed-employees-v2.ts
pnpm --filter @budfin/api exec tsx prisma/seeds/seed-dhg-profile-links.ts
```

- [ ] **Step 3: Create v2/2026 salary increment rules via API**

```bash
# Teaching staff: +250 SAR
curl -X POST http://localhost:3001/api/v1/versions/{versionId}/salary-increment-rules \
  -H "Content-Type: application/json" \
  -d '{"costMode":"LOCAL_PAYROLL","isTeachingRule":true,"incrementType":"FIXED_AMOUNT","incrementValue":"250","excludeNewHires":true}'

# Non-teaching staff: +200 SAR
curl -X POST http://localhost:3001/api/v1/versions/{versionId}/salary-increment-rules \
  -H "Content-Type: application/json" \
  -d '{"costMode":"LOCAL_PAYROLL","isTeachingRule":false,"incrementType":"FIXED_AMOUNT","incrementValue":"200","excludeNewHires":true}'

# Titulaire EN: no change
curl -X POST http://localhost:3001/api/v1/versions/{versionId}/salary-increment-rules \
  -H "Content-Type: application/json" \
  -d '{"costMode":"NO_LOCAL_COST","incrementType":"NO_CHANGE","incrementValue":"0","excludeNewHires":false}'
```

- [ ] **Step 4: Trigger staffing calculation**

```bash
curl -X POST http://localhost:3001/api/v1/versions/{versionId}/calculate/staffing
```

- [ ] **Step 5: Verify results against Excel**

Compare BudFin output vs Excel:

- FTE per profile matches Excel Teacher Requirements summary (rows 78-99)
- Total costs match expected values
- Coverage gaps match demand-supply analysis
- Salary projections match "Aug. 2026-27" column values

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat(staffing): complete DHG enhancement — teacher profiles, curriculum reference, salary increment engine"
```

---

## File Map Summary

### Created files:

| File                                                             | Purpose                                                   |
| ---------------------------------------------------------------- | --------------------------------------------------------- |
| `apps/api/src/services/staffing/salary-increment-engine.ts`      | Pure function: salary projection with specificity cascade |
| `apps/api/src/services/staffing/salary-increment-engine.test.ts` | Tests for increment engine                                |
| `apps/api/src/services/staffing/coverage-engine.test.ts`         | Tests for enhanced coverage engine                        |
| `apps/api/src/routes/master-data/teacher-profiles.ts`            | Teacher profile CRUD routes                               |
| `apps/api/src/routes/master-data/curriculum.ts`                  | Curriculum reference routes                               |
| `apps/api/src/routes/staffing/salary-increment-rules.ts`         | Salary increment rule CRUD routes                         |
| `apps/api/prisma/seeds/seed-teacher-profiles.ts`                 | Seed 22 profiles + discipline mappings                    |
| `apps/api/prisma/seeds/seed-curriculum-reference.ts`             | Seed MEN curriculum data                                  |
| `apps/api/prisma/seeds/seed-employees-v2.ts`                     | Link employees to profiles                                |
| `apps/api/prisma/seeds/seed-dhg-profile-links.ts`                | Link DhgRule to profiles                                  |
| `apps/web/src/hooks/use-curriculum.ts`                           | Curriculum reference query hook                           |
| `apps/web/src/pages/master-data/teacher-profiles-page.tsx`       | Profile management page                                   |
| `apps/web/src/pages/master-data/curriculum-reference-page.tsx`   | Curriculum read-only page                                 |

### Modified files:

| File                                                            | Changes                                          |
| --------------------------------------------------------------- | ------------------------------------------------ |
| `apps/api/prisma/schema.prisma`                                 | 5 enums, 5 new models, 5 modified models         |
| `apps/api/src/services/staffing/demand-engine.ts`               | Profile-keyed grouping                           |
| `apps/api/src/services/staffing/demand-engine.test.ts`          | New grouping tests                               |
| `apps/api/src/services/staffing/coverage-engine.ts`             | Profile-aware matching                           |
| `apps/api/src/routes/staffing/calculate.ts`                     | Step 0 salary increment + profile-aware pipeline |
| `apps/api/src/routes/staffing/employees.ts`                     | teacherProfileId + secondaryProfiles on CRUD     |
| `apps/api/src/routes/staffing/index.ts`                         | Register new route                               |
| `apps/api/src/routes/master-data/index.ts`                      | Register new routes                              |
| `apps/web/src/hooks/use-staffing.ts`                            | New types + hooks for profiles, increment rules  |
| `apps/web/src/components/staffing/employee-grid.tsx`            | Teacher Profile column                           |
| `apps/web/src/components/staffing/teaching-master-grid.tsx`     | Profile-keyed grouping                           |
| `apps/web/src/components/staffing/staffing-settings-dialog.tsx` | Increment rules + LV2 tabs                       |
| `apps/web/src/lib/staffing-workspace.ts`                        | TeachingGridRow + profile fields                 |
| `apps/web/src/lib/curriculum-coverage-map.ts`                   | Remove hardcoded array, parameterize             |
| `apps/web/src/lib/curriculum-coverage-map.test.ts`              | Update for parameterized API                     |
| `apps/web/src/router.tsx`                                       | Add 2 new management routes                      |
| `data/fixtures/fy2026-staff-costs.json`                         | Add teacherProfileCode                           |
| `data/fixtures/fy2026-dhg-structure.json`                       | Add teacherProfileCode                           |
