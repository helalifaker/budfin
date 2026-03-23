# Staffing DHG Enhancement — Teacher Profile & Curriculum-Driven Planning

**Date:** 2026-03-23
**Epic:** Epic 20 — Staffing Module
**Status:** Draft
**Approach:** Approach 3 — "Profile as Master Data"

## Problem Statement

The current staffing module links employees directly to disciplines and service profiles, but lacks a unified "Teacher Profile" concept that bridges demand (what subjects need teaching) and supply (which teachers can teach them). The Excel-based planning process at EFIR uses Teacher Profile as the primary matching key between subject requirements and staff allocation, but this concept isn't modeled in BudFin.

Additionally:

- Curriculum reference data (MEN official hours) is hardcoded in frontend code
- Salary version projections require manual re-import instead of formula-driven rules
- Specialty/LV2 demand calculations need manual overrides instead of version-level assumptions

## Design Decisions

| #   | Decision                   | Choice                                                             | Rationale                                                                                  |
| --- | -------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| 1   | Profile-to-subject mapping | Primary + Secondary qualifications                                 | Mirrors French certification system; a Certifie Maths can also hold Certifie NSI           |
| 2   | Staff classification       | Binary (Teaching/Non-Teaching), ASEMs reclassified as Teaching     | ASEMs have demand lines; keeps model simple                                                |
| 3   | Salary increments          | Model increment rules as version-level assumptions                 | Self-sustaining for future versions without re-import                                      |
| 4   | Variable-demand subjects   | DHG rules + overridable assumptions (specialty groups, LV2 splits) | Leverages existing VersionLyceeGroupAssumption; fully formula-driven                       |
| 5   | Curriculum reference       | Full database-backed CurriculumReference table                     | Single source of truth; audit trail to MEN sources                                         |
| 6   | TBD staff                  | Park as unassigned, cost counted, no demand reduction              | Human decides allocation; system calculates                                                |
| 7   | 250 vs 200 increment split | Key on teacherProfileId                                            | Teachers with a profile get 250, non-teachers get 200                                      |
| 8   | Philosophie vs Lettres     | Separate profiles                                                  | Each French certification is its own TeacherProfile; secondary quals are at employee level |

---

## Section 1: Data Model

### Enums (new)

| Enum                   | Values                                              | Used by                                                 |
| ---------------------- | --------------------------------------------------- | ------------------------------------------------------- |
| CurriculumCycle        | MATERNELLE, ELEMENTAIRE, COLLEGE, LYCEE             | CurriculumReference.cycle                               |
| CurriculumTrack        | CORE, SPECIALTY, OPTION, CONDITIONAL                | CurriculumReference.track                               |
| TeacherProfileCategory | PRIMARY_TEACHER, SECONDARY_TEACHER, SUPPORT_TEACHER | TeacherProfile.category (display-only, no engine logic) |
| ProfileDisciplineType  | PRIMARY, SECONDARY                                  | TeacherProfileDiscipline.qualificationType              |
| IncrementType          | FIXED_AMOUNT, PERCENTAGE, NO_CHANGE                 | SalaryIncrementRule.incrementType                       |

### New Models

All new models include `createdAt DateTime @default(now())` and `updatedAt DateTime @updatedAt` for consistency with existing schema. All models use `@@map("snake_case_table_name")`.

#### CurriculumReference

`@@map("curriculum_references")`

MEN official curriculum hours. Seeded from the Curriculum_Detail sheet (95 rows covering 6e-Terminale). Maternelle/Elementaire rows are manually defined (homeroom model is school-specific, not MEN-driven).

| Field             | Type                   | Notes                                                                                                                                                                                                                                                      |
| ----------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id                | Int                    | PK, autoincrement                                                                                                                                                                                                                                          |
| cycle             | CurriculumCycle        | Enum — not reusing GradeBand (different semantic domain)                                                                                                                                                                                                   |
| stage             | String                 | "Cycle 3", "Cycle 4", "Cycle Terminal"                                                                                                                                                                                                                     |
| gradeLevel        | String @db.VarChar(10) | Soft reference to GradeLevel.gradeCode (6EME, 5EME, ..., TERM). Not a formal FK — matches the pattern used by EnrollmentHeadcount and DhgRule.                                                                                                             |
| track             | CurriculumTrack        | CORE, SPECIALTY, OPTION, CONDITIONAL                                                                                                                                                                                                                       |
| disciplineId      | Int                    | FK → Discipline                                                                                                                                                                                                                                            |
| weeklyHours       | Decimal(4,1)           | e.g., 4.5                                                                                                                                                                                                                                                  |
| annualHours       | Decimal(6,1)           | e.g., 162.0                                                                                                                                                                                                                                                |
| planningGroups    | Int                    | Default groups from MEN. 0 = template specialty (Premiere/Terminale electives where actual group count is school-specific). When 0, the demand engine uses `VersionLyceeGroupAssumption` to get the school's actual group count for that discipline+grade. |
| sourceUrl         | String?                | MEN source link for audit                                                                                                                                                                                                                                  |
| notes             | String?                |                                                                                                                                                                                                                                                            |
| effectiveFromYear | Int                    | e.g., 2025 (curriculum version tracking)                                                                                                                                                                                                                   |
| createdAt         | DateTime               | @default(now())                                                                                                                                                                                                                                            |
| updatedAt         | DateTime               | @updatedAt                                                                                                                                                                                                                                                 |

**Unique constraint:** `(gradeLevel, disciplineId, track, effectiveFromYear)`

#### TeacherProfile

`@@map("teacher_profiles")`

The keystone entity linking demand to supply. Each profile represents a French teaching certification and maps to a tightly coupled set of disciplines.

**Note on EMC:** In the French system, EMC is typically taught by the history-geography teacher. Verify with EFIR whether `CERTIFIE_EMC` should be a standalone profile or if EMC should instead be a secondary discipline of `CERTIFIE_HIST_GEO`. The profile list below includes it as standalone per the Excel, but this may need adjustment during implementation.

| Field               | Type                   | Notes                                                                                                                                                                                             |
| ------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id                  | Int                    | PK, autoincrement                                                                                                                                                                                 |
| code                | String                 | Unique. e.g., `CERTIFIE_LETTRES`, `PE`, `ASEM`                                                                                                                                                    |
| name                | String                 | Display: "Certifie Lettres"                                                                                                                                                                       |
| category            | TeacherProfileCategory | Display-only classification. No engine logic depends on this — it exists for UI grouping/filtering. ASEM uses SUPPORT_TEACHER but follows the same demand/coverage engine path as other profiles. |
| serviceProfileId    | Int                    | FK → ServiceObligationProfile (determines ORS: 18h, 24h)                                                                                                                                          |
| primaryDisciplineId | Int                    | FK → Discipline (main subject)                                                                                                                                                                    |
| isActive            | Boolean                | default true                                                                                                                                                                                      |
| sortOrder           | Int                    | Display ordering                                                                                                                                                                                  |
| createdAt           | DateTime               | @default(now())                                                                                                                                                                                   |
| updatedAt           | DateTime               | @updatedAt                                                                                                                                                                                        |

**22 profiles from EFIR's current structure:**

| Code                        | Name                          | Category          | ORS | Primary Discipline        |
| --------------------------- | ----------------------------- | ----------------- | --- | ------------------------- |
| PE                          | Professeur des ecoles         | PRIMARY_TEACHER   | 24h | PRIMARY_HOMEROOM          |
| ASEM                        | ASEM                          | SUPPORT_TEACHER   | —   | ASEM_SUPPORT              |
| ENSEIGNANT_ARABE_PRI        | Enseignant Arabe (Primaire)   | PRIMARY_TEACHER   | 18h | ARABE                     |
| ENSEIGNANT_ANGLAIS_PRI      | Enseignant Anglais (Primaire) | PRIMARY_TEACHER   | 18h | ANGLAIS                   |
| CERTIFIE_LETTRES            | Certifie Lettres              | SECONDARY_TEACHER | 18h | FRANCAIS                  |
| CERTIFIE_PHILOSOPHIE        | Certifie Philosophie          | SECONDARY_TEACHER | 18h | PHILOSOPHIE               |
| CERTIFIE_MATHS              | Certifie Maths                | SECONDARY_TEACHER | 18h | MATHEMATIQUES             |
| CERTIFIE_HIST_GEO           | Certifie Hist-Geo             | SECONDARY_TEACHER | 18h | HISTOIRE_GEOGRAPHIE       |
| CERTIFIE_EMC                | Certifie EMC                  | SECONDARY_TEACHER | 18h | EMC                       |
| CERTIFIE_ANGLAIS            | Certifie Anglais              | SECONDARY_TEACHER | 18h | ANGLAIS_LV1               |
| CERTIFIE_ARABE              | Certifie Arabe                | SECONDARY_TEACHER | 18h | ARABE_LV2                 |
| CERTIFIE_ALLEMAND           | Certifie Allemand             | SECONDARY_TEACHER | 18h | ALLEMAND_LV2              |
| CERTIFIE_ESPAGNOL           | Certifie Espagnol             | SECONDARY_TEACHER | 18h | ESPAGNOL_LV2              |
| CERTIFIE_SVT                | Certifie SVT                  | SECONDARY_TEACHER | 18h | SVT                       |
| CERTIFIE_PHYSIQUE_CHIMIE    | Certifie Physique-Chimie      | SECONDARY_TEACHER | 18h | PHYSIQUE_CHIMIE           |
| CERTIFIE_TECHNOLOGIE        | Certifie Technologie          | SECONDARY_TEACHER | 18h | TECHNOLOGIE               |
| CERTIFIE_SCIENCES_MUT       | Certifie Sciences (mutualise) | SECONDARY_TEACHER | 18h | ENSEIGNEMENT_SCIENTIFIQUE |
| CERTIFIE_SES                | Certifie SES                  | SECONDARY_TEACHER | 18h | SES                       |
| CERTIFIE_NSI_MATHS          | Certifie NSI/Maths            | SECONDARY_TEACHER | 18h | NSI                       |
| CERTIFIE_ARTS_PLASTIQUES    | Certifie Arts Plastiques      | SECONDARY_TEACHER | 18h | ARTS_PLASTIQUES           |
| CERTIFIE_EDUCATION_MUSICALE | Certifie Education Musicale   | SECONDARY_TEACHER | 18h | EDUCATION_MUSICALE        |
| CERTIFIE_EPS                | Certifie EPS                  | SECONDARY_TEACHER | 18h | EPS                       |

#### TeacherProfileDiscipline

`@@map("teacher_profile_disciplines")`

Defines which disciplines a profile naturally covers. "Certifie Maths" covers Mathematiques + Soutien + Spe. Maths + Maths Complementaires + Maths Expertes.

| Field             | Type                  | Notes                |
| ----------------- | --------------------- | -------------------- |
| id                | Int                   | PK, autoincrement    |
| teacherProfileId  | Int                   | FK → TeacherProfile  |
| disciplineId      | Int                   | FK → Discipline      |
| qualificationType | ProfileDisciplineType | PRIMARY or SECONDARY |
| createdAt         | DateTime              | @default(now())      |
| updatedAt         | DateTime              | @updatedAt           |

**Unique constraint:** `(teacherProfileId, disciplineId)`

Profile-to-discipline mapping:

| Profile                  | PRIMARY                   | SECONDARY                                      |
| ------------------------ | ------------------------- | ---------------------------------------------- |
| CERTIFIE_LETTRES         | FRANCAIS                  | HLP                                            |
| CERTIFIE_PHILOSOPHIE     | PHILOSOPHIE               | —                                              |
| CERTIFIE_MATHS           | MATHEMATIQUES             | SOUTIEN, SPE_MATHS, MATHS_COMP, MATHS_EXPERTES |
| CERTIFIE_HIST_GEO        | HISTOIRE_GEOGRAPHIE       | HGGSP                                          |
| CERTIFIE_ANGLAIS         | ANGLAIS_LV1               | ANGLAIS_LVA, LLCE_ANGLAIS                      |
| CERTIFIE_SVT             | SVT                       | SPE_SVT                                        |
| CERTIFIE_PHYSIQUE_CHIMIE | PHYSIQUE_CHIMIE           | SPE_PHYSIQUE_CHIMIE                            |
| CERTIFIE_SCIENCES_MUT    | ENSEIGNEMENT_SCIENTIFIQUE | SNT, TECHNOLOGIE                               |
| CERTIFIE_SES             | SES                       | SPE_SES                                        |
| CERTIFIE_NSI_MATHS       | NSI                       | —                                              |
| (others)                 | (primary only)            | —                                              |

#### EmployeeSecondaryProfile

`@@map("employee_secondary_profiles")`

Employee-level additional certifications. A Certifie Lettres teacher who also holds Certifie Philosophie has a row here.

| Field            | Type     | Notes               |
| ---------------- | -------- | ------------------- |
| id               | Int      | PK, autoincrement   |
| employeeId       | Int      | FK → Employee       |
| teacherProfileId | Int      | FK → TeacherProfile |
| createdAt        | DateTime | @default(now())     |
| updatedAt        | DateTime | @updatedAt          |

**Unique constraint:** `(employeeId, teacherProfileId)`

**Validation:** The secondary profile must differ from the employee's primary `teacherProfileId`. Enforced in application code (not a DB constraint).

#### SalaryIncrementRule

`@@map("salary_increment_rules")`

Version-level increment assumptions for salary projections. Each rule applies a single increment to **base salary only** (not allowances). One matching rule per employee — first match by specificity wins.

| Field             | Type                    | Notes                                                                                                                                                                                                                              |
| ----------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id                | Int                     | PK, autoincrement                                                                                                                                                                                                                  |
| versionId         | Int                     | FK → BudgetVersion                                                                                                                                                                                                                 |
| band              | String? @db.VarChar(15) | Matches Employee.homeBand (plain string, not enum). Values: "MATERNELLE", "ELEMENTAIRE", "COLLEGE", "LYCEE", "NON_ACADEMIC". null = all bands.                                                                                     |
| costMode          | CostMode?               | LOCAL_PAYROLL, AEFE_RECHARGE, NO_LOCAL_COST. null = all. Replaces `contractType` — costMode already encodes the same information (Contrat Local → LOCAL_PAYROLL, Titulaire EN → AEFE_RECHARGE/NO_LOCAL_COST).                      |
| teacherProfileId  | Int?                    | FK → TeacherProfile. Non-null = applies to employees with this profile. null = applies to employees without a profile (non-teaching).                                                                                              |
| incrementType     | IncrementType           | FIXED_AMOUNT, PERCENTAGE, NO_CHANGE                                                                                                                                                                                                |
| incrementValue    | Decimal(15,4)           | For FIXED_AMOUNT: SAR amount (e.g., 250.0000). For PERCENTAGE: decimal fraction (e.g., 0.0500 = 5%). For NO_CHANGE: ignored (use 0). **Convention: percentages are always stored as decimal fractions (0.0-1.0), never as 0-100.** |
| excludeNewHires   | Boolean                 | default true. New hire = employee with < 1 year of service at version start date.                                                                                                                                                  |
| minYearsOfService | Int?                    | Optional: only apply if YoS >= N                                                                                                                                                                                                   |
| createdAt         | DateTime                | @default(now())                                                                                                                                                                                                                    |
| updatedAt         | DateTime                | @updatedAt                                                                                                                                                                                                                         |

**Unique constraint:** `@@unique([versionId, band, costMode, teacherProfileId], nulls: NotDistinct)` — PostgreSQL 15+ `NULLS NOT DISTINCT` prevents duplicate catch-all rows. Prisma 5.17+ supports this via `nulls: NotDistinct`.

**Rule matching — specificity cascade (most specific wins):**

1. Rules with `band + costMode + teacherProfileId` all set → most specific
2. Rules with two of three set
3. Rules with one set
4. Rules with all null → catch-all default

For each employee, the engine:

1. Filters rules for the current `versionId`
2. Sorts by specificity (count of non-null filter fields, descending)
3. Finds the first matching rule
4. Skips if `excludeNewHires = true` and employee has < 1 year of service
5. Skips if `minYearsOfService` is set and employee's YoS is below threshold
6. Applies the increment to **base salary only**:
    - `FIXED_AMOUNT`: `newBase = currentBase + incrementValue`
    - `PERCENTAGE`: `newBase = currentBase × (1 + incrementValue)`
    - `NO_CHANGE`: no adjustment (explicit rule for Titulaire EN, etc.)
7. **Validation:** projected base salary must be >= 0. If negative, abort calculation with error.

**Removed fields (vs earlier draft):**

- `contractType` — redundant with `costMode` (see note above)
- `appliesTo` — simplified to always apply to base salary only. Allowance increments are a separate future concern.

**v2/2026 rules derived from Excel:**

| teacherProfileId | band | costMode      | Type         | Value | Exclude New |
| ---------------- | ---- | ------------- | ------------ | ----- | ----------- |
| (any non-null)   | null | LOCAL_PAYROLL | FIXED_AMOUNT | 250   | yes         |
| null             | null | LOCAL_PAYROLL | FIXED_AMOUNT | 200   | yes         |
| null             | null | NO_LOCAL_COST | NO_CHANGE    | 0     | no          |

**Note on `teacherProfileId` matching:** A rule with `teacherProfileId = (specific profile)` matches only that profile. For the "any teaching staff" rule, the engine treats `teacherProfileId IS NOT NULL on employee` + `teacherProfileId IS NULL on rule` as a non-match. Instead, we create one rule per profile or use a special sentinel value. **Recommended:** Use a boolean `isTeachingRule` flag instead:

- `isTeachingRule = true`: matches employees where `teacherProfileId IS NOT NULL`
- `isTeachingRule = false`: matches employees where `teacherProfileId IS NULL`
- `isTeachingRule = null`: matches all employees

This replaces `teacherProfileId` on the rule. Update the table:

| Field          | Type     | Notes                                                             |
| -------------- | -------- | ----------------------------------------------------------------- |
| isTeachingRule | Boolean? | true = teaching staff only, false = non-teaching only, null = all |

**Revised unique constraint:** `@@unique([versionId, band, costMode, isTeachingRule], nulls: NotDistinct)`

**Revised v2/2026 rules:**

| isTeachingRule | band | costMode      | Type         | Value | Exclude New |
| -------------- | ---- | ------------- | ------------ | ----- | ----------- |
| true           | null | LOCAL_PAYROLL | FIXED_AMOUNT | 250   | yes         |
| false          | null | LOCAL_PAYROLL | FIXED_AMOUNT | 200   | yes         |
| null           | null | NO_LOCAL_COST | NO_CHANGE    | 0     | no          |

### Modified Models

#### Employee — additions

| Field            | Type | Notes                     |
| ---------------- | ---- | ------------------------- |
| teacherProfileId | Int? | FK → TeacherProfile (new) |

- `isTeaching` becomes derived: `teacherProfileId != null` → true. Kept as explicit column for query performance.
- Existing `disciplineId` and `serviceProfileId` remain for backward compatibility during migration. For teaching staff, these are derived from `teacherProfile.primaryDisciplineId` and `teacherProfile.serviceProfileId`.

**Deprecated fields (transition plan):**

- `augmentation` and `augmentationEffectiveDate` — replaced by `SalaryIncrementRule` for version-level projections. These fields remain in the schema for backward compatibility but are no longer written to by the calculation pipeline. The salary increment engine computes projected salaries **in-memory** during the calculation pipeline (Step 0) and passes them to the cost engine. Projected salaries are not persisted as separate columns — the `MonthlyStaffCost` records store the final computed costs. The per-employee `augmentation` field may be used for ad-hoc one-off adjustments that don't fit increment rules (e.g., a single employee getting a special raise).

#### DhgRule — additions

| Field                 | Type | Notes                                                 |
| --------------------- | ---- | ----------------------------------------------------- |
| teacherProfileId      | Int? | FK → TeacherProfile (which profile teaches this rule) |
| curriculumReferenceId | Int? | FK → CurriculumReference (audit trail to MEN source)  |

#### TeachingRequirementLine — additions

| Field              | Type   | Notes                                                           |
| ------------------ | ------ | --------------------------------------------------------------- |
| teacherProfileId   | Int?   | FK → TeacherProfile (what profile is needed)                    |
| teacherProfileCode | String | Denormalized for display (profile name, e.g., "Certifie Maths") |

**Unique constraint change:** Current `@@unique([versionId, band, disciplineCode, lineType])` becomes `@@unique([versionId, band, teacherProfileCode, lineType])`. The `disciplineCode` field remains but becomes a comma-separated list of discipline codes covered by the profile (for display only, not for matching). Migration: drop old constraint, create new one.

#### DemandOverride — additions

| Field            | Type | Notes                                                    |
| ---------------- | ---- | -------------------------------------------------------- |
| teacherProfileId | Int? | FK → TeacherProfile (replaces disciplineId for matching) |

**Unique constraint change:** Current `@@unique([versionId, band, disciplineId, lineType])` becomes `@@unique([versionId, band, teacherProfileId, lineType])`. Demand overrides now apply at the profile level to match the profile-keyed requirement lines. The `disciplineId` field is kept for backward compatibility but no longer participates in the unique constraint.

#### StaffingAssignment — kept at discipline level

`StaffingAssignment` retains its discipline-level granularity: `@@unique([versionId, employeeId, band, disciplineId])`. An employee assigned to Spe. Maths has a separate assignment from their Mathematiques assignment. The coverage engine **aggregates** discipline-level assignments into profile-level coverage: sum all assignment FTEs for disciplines that belong to the matching profile.

#### VersionStaffingSettings — additions

| Field           | Type  | Notes                                                                                                          |
| --------------- | ----- | -------------------------------------------------------------------------------------------------------------- |
| lv2StudentSplit | Json? | e.g., `{ "ARABE": 0.50, "ALLEMAND": 0.10, "ESPAGNOL": 0.40 }`. Must sum to 1.0. Validated in application code. |

---

## Section 2: Demand Engine Enhancements

### Enhanced data flow

```
CurriculumReference (MEN hours)
    ↓ seeds
DhgRule (grade + discipline + hours + teacherProfileId)
    ↓
demand-engine (pure function)
    ↓ groups by TeacherProfile
TeachingRequirementLine (keyed by teacherProfileId)
    ↓ coverage-engine
Employee (primary + secondary profiles)
```

### Input changes

- DhgRule now carries `teacherProfileId` — the engine knows which profile fulfills each rule
- `VersionLyceeGroupAssumption` expands to handle LV2 splits: a new `lv2StudentSplit` map per version (e.g., `{ ARABE: 0.50, ALLEMAND: 0.10, ESPAGNOL: 0.40 }`) stored as a JSON field on version settings

### Grouping change

- **Current:** groups requirement lines by `band + disciplineCode + lineType`
- **New:** groups by `band + teacherProfileId + lineType`
- Multiple disciplines under one profile (e.g., all math variants) roll up into a single requirement line for that profile
- Matches the Excel summary table (rows 78-99) which aggregates by Teacher Profile

### Specialty handling

- Specialty subjects (Spe. Maths, Spe. SVT, etc.) use `VersionLyceeGroupAssumption` for group counts
- Engine multiplies: `hours_per_group × group_count` to get total weekly hours
- Already partially implemented — enhancement wires it through TeacherProfile grouping

### LV2 split handling

- LV2 disciplines (Arabic LV2, German LV2, Spanish LV2) apply a student split factor
- `sections_for_lv2 = total_sections × split_percentage`
- Stored as version-level assumptions, editable in the staffing settings dialog

### Coverage engine changes

**Current:** Matches `StaffingAssignment` records against requirement lines by discipline+band

**Enhanced:**

1. Load employee's primary profile → get all disciplines it covers (via TeacherProfileDiscipline)
2. Load employee's secondary profiles (via EmployeeSecondaryProfile) → get their disciplines
3. Union of all covered disciplines = employee's full teaching capability
4. Match against requirement lines by `teacherProfileId`
5. Primary and secondary profile matches both score 1.0 FTE contribution (a qualified teacher is a qualified teacher)

**Unassigned employees** (TBD): `teacherProfileId = null` → excluded from coverage, cost still counted.

---

## Section 3: Salary Increment Engine

### Flow

```
v1 Employee salaries (current)
    ↓ SalaryIncrementRule (version-level assumptions)
    ↓ apply rules in specificity cascade order
v2 Employee salaries (projected)
    ↓ cost-engine (GOSI, Ajeer, EOS, etc.)
Monthly costs
```

### Rule matching logic

See Section 1 `SalaryIncrementRule` for full field definitions and the specificity cascade.

The salary increment engine is a **pure function**: `applySalaryIncrements(employees, rules, versionStartDate) → ProjectedSalary[]`. It returns in-memory projected salary values that are passed to the cost engine. No DB writes.

All arithmetic uses `decimal.js` with `ROUND_HALF_UP` (TC-001).

**Error handling:** If any projected salary is negative (e.g., a percentage rule with a negative value), the engine throws a validation error and the entire calculation pipeline aborts. The transaction is rolled back — no partial results are persisted.

### Integration with calculate pipeline

The salary increment engine runs as **Step 0** of the staffing calculation pipeline, before cost calculations. The `POST /versions/:versionId/calculate/staffing` endpoint becomes:

0. (New) Apply salary increment rules → projected salaries (in-memory, passed to Step 8)
1. Validate version
2. Load DHG rules (with teacherProfileId)
3. Load employees (with teacherProfileId + secondary profiles)
4. Demand engine (groups by TeacherProfile)
5. Demand overrides (now keyed by teacherProfileId)
6. Coverage engine (matches primary + secondary profiles, aggregates discipline-level assignments)
7. HSA engine
8. Cost engine (uses projected salaries from Step 0)
9. Category costs
10. Persist results (single transaction — if any step fails, nothing is written)

---

## Section 4: CurriculumReference & Seed Pipeline

### Seed scripts (run in order)

**1. seed-curriculum-reference.ts**

- Source: Curriculum_Detail sheet (95 rows covering 6e→Terminale)
- Maternelle/Elementaire: manually defined rows (homeroom model is school-specific)
- Upserts by `(gradeLevel, disciplineId, track, effectiveFromYear)`
- Creates Discipline records if missing

**2. seed-teacher-profiles.ts**

- Source: Teacher Requirements summary (22 profiles)
- Creates TeacherProfile records with primary discipline + ServiceObligationProfile link
- Creates TeacherProfileDiscipline records for multi-discipline profiles
- Maps names to codes: "Certifie Lettres" → `CERTIFIE_LETTRES`

**3. seed-employees-v2.ts**

- Source: Master Data sheet (185 employees)
- Updates existing employee records with `teacherProfileId` matching "Teacher Profile" column
- Applies v2/2026 salary increments from "Aug. 2026-27" column as validation data
- Sets TBD employees with `teacherProfileId = null`
- Reclassifies ASEMs as `isTeaching = true` with profile `ASEM`

### Fixture updates

**fy2026-dhg-structure.json** — restructured:

- `teacherProfileCode` on each rule entry
- `curriculumReferenceKey` for traceability
- LV2 split percentages as top-level assumptions

**fy2026-staff-costs.json** — each employee gains:

- `teacherProfileCode` (or `null` for non-teaching)
- `secondaryProfiles: []`

### Replacing hardcoded curriculum-coverage-map.ts

Frontend fetches `CurriculumReference` via `GET /api/v1/master-data/curriculum` and computes coverage gaps dynamically against DhgRule data. `DISCIPLINE_DISPLAY_GROUPS` stays as a frontend UI constant.

---

## Section 5: API Surface

### New endpoints

| Method | Path                                                      | Purpose                                                                                                                                                                                                                                                      | RBAC        |
| ------ | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| GET    | `/api/v1/master-data/teacher-profiles`                    | List all profiles with disciplines                                                                                                                                                                                                                           | data:view   |
| POST   | `/api/v1/master-data/teacher-profiles`                    | Create profile                                                                                                                                                                                                                                               | data:edit   |
| PUT    | `/api/v1/master-data/teacher-profiles/:id`                | Update profile                                                                                                                                                                                                                                               | data:edit   |
| DELETE | `/api/v1/master-data/teacher-profiles/:id`                | Hard delete. Returns 409 CONFLICT if any employees are linked (primary or secondary). To retire a profile without deleting, use PUT to set `isActive = false` — inactive profiles cannot be assigned to new employees but existing assignments remain valid. | data:edit   |
| GET    | `/api/v1/master-data/curriculum`                          | List curriculum reference data                                                                                                                                                                                                                               | data:view   |
| POST   | `/api/v1/master-data/curriculum`                          | Create/update curriculum entry                                                                                                                                                                                                                               | data:edit   |
| GET    | `/api/v1/versions/:versionId/salary-increment-rules`      | List increment rules                                                                                                                                                                                                                                         | salary:view |
| POST   | `/api/v1/versions/:versionId/salary-increment-rules`      | Create/update rules                                                                                                                                                                                                                                          | salary:edit |
| DELETE | `/api/v1/versions/:versionId/salary-increment-rules/:id`  | Remove rule                                                                                                                                                                                                                                                  | salary:edit |
| POST   | `/api/v1/versions/:versionId/calculate/salary-projection` | Preview projected salaries                                                                                                                                                                                                                                   | salary:view |

### Modified endpoints

**`POST /versions/:versionId/calculate/staffing`** — enhanced pipeline adds Step 0 (salary increment) and groups demand by TeacherProfile.

**`GET /versions/:versionId/employees`** — response adds:

- `teacherProfile: { id, code, name } | null`
- `secondaryProfiles: [{ id, code, name }]`

**`POST` and `PUT /versions/:versionId/employees`** — request accepts:

- `teacherProfileId: number | null`
- `secondaryProfileIds: number[]` — **full replace semantics**: the provided array replaces all existing `EmployeeSecondaryProfile` records for that employee. Empty array = remove all secondary profiles. Validation: no duplicate of primary profile, all profile IDs must exist and be active.

---

## Section 6: Frontend Changes

### Staffing Settings Dialog — new tabs

**Salary Increment Rules tab:**

- Table: band (dropdown), costMode (dropdown), isTeachingRule (tri-state: Teaching/Non-Teaching/All), incrementType (FIXED/PERCENTAGE/NO_CHANGE), value (input), excludeNewHires (checkbox)
- Add/remove rows
- "Preview" button → calls `calculate/salary-projection` → shows summary: "X employees get +250 SAR, Y get +200 SAR, Z unchanged"

**LV2 Split Assumptions tab:**

- Three inputs: Arabic %, German %, Spanish %
- Display as percentages (0-100) in the UI, stored as decimal fractions (0.0-1.0) in the API/DB
- Validation: must sum to 100% (1.0 in storage)
- Stored on `VersionStaffingSettings.lv2StudentSplit`

### Teaching Master Grid — profile-keyed

- **Current grouping:** `band + disciplineCode + lineType`
- **New grouping:** `band + teacherProfileCode + lineType`
- Each row: profile name, disciplines covered (collapsible), required FTE, covered FTE, gap, status badge

### Employee Grid — profile column

- **Teacher Profile** column: dropdown of all active profiles + "Unassigned"
- **Secondary Profiles** column: multi-select chips
- TBD employees show "Unassigned" with warning indicator

### New: Teacher Profile Management page

Under Management Shell → Master Data:

- CRUD table of all profiles
- Columns: code, name, category, service profile (ORS), primary discipline, secondary disciplines (tags)
- Inline editing; DELETE disabled (grayed out) for profiles with linked employees; SET INACTIVE available instead

### New: Curriculum Reference page

Under Management Shell → Master Data:

- Read-only table of MEN curriculum data
- Columns: cycle, grade, track, subject, weekly hours, annual hours, source link
- Filter by cycle/grade

### curriculum-coverage-map.ts replacement

- Delete hardcoded `EXPECTED_COVERAGE[]` array
- New `use-curriculum.ts` hook fetches from API
- Coverage gap computation: compare CurriculumReference vs DhgRule dynamically
- `DISCIPLINE_DISPLAY_GROUPS` stays as frontend UI constant

---

## Migration Strategy

### Phase 1: Schema + Seed

1. Prisma migration: add new models (CurriculumReference, TeacherProfile, TeacherProfileDiscipline, EmployeeSecondaryProfile, SalaryIncrementRule)
2. Add new fields to Employee, DhgRule, TeachingRequirementLine
3. Run seed scripts in order: curriculum → profiles → employees

### Phase 2: Engine Updates

1. Demand engine: accept teacherProfileId, group by profile
2. Coverage engine: match primary + secondary profiles
3. Salary increment engine: new pure function
4. Integrate into calculate pipeline

### Phase 3: API

1. New master-data endpoints (teacher-profiles, curriculum)
2. New salary-increment-rules endpoints
3. Modify employee endpoints (accept/return profile data)
4. Modify calculate endpoint (add Step 0)

### Phase 4: Frontend

1. Teacher Profile management page
2. Curriculum Reference page
3. Employee grid: profile column + secondary profiles
4. Teaching master grid: profile-keyed grouping
5. Staffing settings: increment rules tab + LV2 splits tab
6. Delete curriculum-coverage-map.ts, replace with API-driven hook

### Phase 5: Validation

1. Run full calculation with v2/2026 data
2. Compare BudFin output vs Excel output (FTE per profile, total costs)
3. Verify coverage gaps match Excel's demand-supply analysis
4. Validate salary projections against "Aug. 2026-27" column
