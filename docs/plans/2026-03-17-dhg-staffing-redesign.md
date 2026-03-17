# DHG & Staffing Module Redesign — Elevated Design Spec

**Date:** 2026-03-17
**Status:** REVIEW-DRIVEN — Incorporates findings from workbook analysis and codebase audit
**Approach:** Requirement-Line Architecture with Explicit Assignment Model
**Supersedes:** Earlier subject-first single-grid draft

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Source Evidence & Current State](#2-source-evidence--current-state)
3. [Design Principles](#3-design-principles)
4. [Resolved Design Decisions](#4-resolved-design-decisions)
5. [Domain Model & Conceptual Architecture](#5-domain-model--conceptual-architecture)
6. [Data Model](#6-data-model)
7. [Calculation Engines](#7-calculation-engines)
8. [API Routes](#8-api-routes)
9. [Frontend Architecture](#9-frontend-architecture)
10. [Settings Sheet](#10-settings-sheet)
11. [KPI Ribbon & Status Strip](#11-kpi-ribbon--status-strip)
12. [Employee Form Changes](#12-employee-form-changes)
13. [Validation, Controls & Auditability](#13-validation-controls--auditability)
14. [Stale Module Propagation](#14-stale-module-propagation)
15. [Migration Strategy](#15-migration-strategy)
16. [Performance Considerations](#16-performance-considerations)
17. [Implementation Sequence](#17-implementation-sequence)
18. [Acceptance Criteria](#18-acceptance-criteria)
19. [Open Questions](#19-open-questions)
20. [File Inventory](#20-file-inventory)

---

## 1. Executive Summary

### Problem

The current staffing module uses WorkspaceBoard/WorkspaceBlock layout with four disconnected
sections (Employee Roster, DHG Requirements, DHG Grille, Monthly Cost). The DHG engine uses a
single `ORS_DIVISOR = 18` and computes FTE per-grade (not per-subject). There is no assignment
model linking employees to teaching demand. HSA is stored per-employee but has no planning-policy
layer. Non-teaching and teaching staff share the same undifferentiated view.

### What Changed from the Earlier Draft

The earlier draft proposed a subject-first single grid with discipline-based employee matching.
A deep review of the source workbooks (DHG, staff costs, HSA, legacy AEFE) and the current
codebase revealed five structural weaknesses that this elevated spec corrects:

1. **Planning grain:** A universal subject grid does not fit primary staffing (section-based
   homeroom + ASEM) or support planning. This spec uses **requirement lines** with multiple
   row types that follow each level's actual pedagogical model.
2. **Assignment model:** Free-text discipline matching is not auditable and breaks for shared
   teachers. This spec introduces **`StaffingAssignment`** as the only authoritative link
   between supply and demand.
3. **HSA semantics:** A single system-level average loses payroll traceability. This spec
   separates **planning HSA policy** (FTE divisor) from **payroll HSA cost** (per-employee).
4. **Taxonomy governance:** Source workbooks contain typos, trailing spaces, accented variants,
   and inconsistent role labels. This spec introduces **controlled master-data taxonomies**
   with alias tables for migration normalization.
5. **Cost model flexibility:** Hardcoded percentage rates (2% remplacements, 1% formation) are
   not supported by workbook evidence. This spec uses **configurable cost assumption modes**
   (flat annual, percent of payroll, amount per FTE).

### Solution

A full-stack redesign that makes the staffing module one unified route (`/planning/staffing`)
with two coordinated workspace modes:

- **Teaching Demand & Coverage** (default) — DHG-driven requirement lines with explicit
  assignment-based coverage, gap analysis, and cost attribution.
- **Support & Admin Positions** — Department-grouped position planning for non-teaching staff.

Both workspaces share the same KPI ribbon, settings sheet, and calculation pipeline. The
planner sees requirement lines flowing left-to-right: **Drivers → Need → Coverage → Cost**.

---

## 2. Source Evidence & Current State

### 2.1 Workbook Evidence

| Source                                      | Key Evidence                                                                                                                                                                                                                            |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `02_EFIR_DHG_FY2026_v1.xlsx`                | 1,753 students, 74 sections, 47 unique subjects. Subject-level secondary model, summary-level primary model. Secondary total DHG of 1,258.38 h/week. Subject-level rounding inflation: 57.41 raw FTE → 63 rounded positions (+5.6 FTE). |
| `EFIR_Staff_Costs_Budget_FY2026_V3.xlsx`    | 168 headcount (162 existing + 6 new Sep start). 166 Ajeer / 2 Saudi. Monthly HSA total 57,424 SAR in staff master. 837,000 SAR pension contribution in monthly budget but omitted from analysis summary.                                |
| `Copy of HSA EFIR 25-26.xlsx`               | Person-level HSA workload and cost. Monthly HSA total 60,024 SAR (differs from staff master by 2,600 SAR). Covers both primary and secondary.                                                                                           |
| `Copy of Effectifs prévisionnels EFIR.xlsx` | Legacy multi-year staffing model with hidden sheets, `#N/A` dependencies, manual reference tables, and detached resident/recharge logic.                                                                                                |

### 2.2 Current App State

| Component           | Current Implementation                                                                                                                    |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **DHG engine**      | `ORS_DIVISOR = 18` (fixed). FTE computed per grade, not per subject. No variable ORS.                                                     |
| **Cost engine**     | Per-employee × 12 months. Handles GOSI (11.75% Saudi), Ajeer, EoS (YEARFRAC 30/360), HSA (Jul-Aug exclusion), augmentation (Sep step-up). |
| **Category costs**  | 4 categories: remplacements, formation, resident_salaires, resident_logement. Fixed rates from system_config.                             |
| **Employee model**  | 22 fields. No `discipline`, `contractType`, `teacherType`, `serviceProfile`, or `homeBand`.                                               |
| **Assignment**      | None. No link between employees and DHG demand.                                                                                           |
| **Staffing page**   | WorkspaceBoard + 4 WorkspaceBlock sections.                                                                                               |
| **DhgGrilleConfig** | 6 fields. `dhgType` hardcoded to "Structural" by importer. No line type, driver type, or service profile.                                 |
| **DhgRequirement**  | Per-grade FTE output. 13 fields. Unique by `(versionId, academicPeriod, gradeLevel)`.                                                     |

### 2.3 Fixture Data Structure

The `fy2026-dhg-structure.json` fixture contains:

- **15 grade levels** with enrollment, class sizes, and sections
- **Maternelle:** 10 curriculum domains per grade (PS/MS/GS) — planned as 1 PE per section
- **Elementaire:** 12 subjects per grade (CP-CM2) — planned as 1 PE per section + specialists
- **College:** 49 discipline entries across 4 grades (6e-3e) — subject-based DHG
- **Lycee:** 42 courses across 3 grades (2nde/1ere/Term) — subject + specialty-based DHG
- **46 unique subject names** in `subjectList`

---

## 3. Design Principles

1. **One module, two workspaces.** Teaching demand/coverage and support/admin positions live under
   one route but in separate grids with different row semantics.
2. **Requirement-line-first planning.** Rows = requirement lines, not universal subjects. Each
   line follows the level's pedagogical model (section-driven for primary, hours-driven for
   secondary).
3. **Explicit assignment model.** Coverage is based on `StaffingAssignment` records, not inferred
   from discipline text matching.
4. **Every number must be explainable.** Each grid row has a deterministic provenance chain back
   to enrollment, rules, assumptions, assignments, or cost inputs.
5. **Round only where the business hires whole units.** Raw FTE and recommended hireable positions
   are separate measures. Never sum rounded line positions for total demand.
6. **Separate planning policy from payroll detail.** HSA, resident recharge, and training budgets
   are configurable, traceable, and reconcilable between the planning and payroll views.
7. **Controlled taxonomies.** Mapping-critical fields (discipline, service profile, role) use
   master-data-backed codes with alias tables for migration normalization. No free-text joins.
8. **Preserve enrollment-page patterns.** Fixed-viewport workspace, KPI ribbon, status strip,
   filtered master grid, right-panel inspector, settings sheet, guide content.

---

## 4. Resolved Design Decisions

### D1: Employee-to-Demand Matching → Explicit Assignments

**Decision:** Introduce `StaffingAssignment` as the authoritative link between supply and demand.

**Rationale:** Discipline-only matching (original draft option A) is not auditable and breaks
for shared teachers. Assignments reference `(band, disciplineCode)` — the stable business key —
not derived output IDs. This decouples user-created assignments from recalculated demand lines.

### D2: FTE Gap Alert Thresholds → Fixed ±0.25 FTE

**Decision:** Option A — fixed threshold. `|gap| ≤ 0.25` → BALANCED, `gap < -0.25` → DEFICIT,
`gap > +0.25` → SURPLUS.

**Rationale:** Simple, deterministic, no additional settings surface.

### D3: DHG Grille Scope → Evolved Global Rule Catalog

**Decision:** `DhgGrilleConfig` is replaced by `DhgRule` — a richer **global** master-data
rule catalog with line type, driver type, service profile, language code, and effective-year
range. Rules are NOT version-scoped — curriculum changes rarely vary between budget scenarios
for the same fiscal year. All versions share the same active rule set, filtered by
`effectiveFromYear`/`effectiveToYear`.

**Rationale:** The current schema cannot represent group-based specialty demand, service profile
selection, host-country vs structural lines, or language/track distinctions. Global scope keeps
the model simple (no 750-row copy-on-write per version clone). If per-version rule overrides
are needed in the future, a `DhgRuleOverride` table can be added without breaking changes.

### D4: Data Migration Mapping → Controlled Taxonomies + Aliases

**Decision:** Introduce `Discipline` and `DisciplineAlias` master data tables. Migration
normalizes free-text values through alias lookup before inserting.

**Rationale:** Source data contains typos, trailing spaces, accented variants, and inconsistent
role labels. Free-text strings in core joins will produce silent mapping failures.

### D5: HSA Application → Planning Policy + Payroll Amount (Dual Model)

**Decision:** HSA is modeled as both a planning lever (effective ORS = base ORS + HSA target)
and a payroll cost item (per-employee HSA amount). The demand engine uses the planning policy;
the cost engine uses the payroll amount (defaulted from policy, overridable per-employee).

**Rationale:** The DHG workbook uses HSA as a scenario lever; the payroll workbook carries
person-level HSA amounts. A single average loses payroll traceability.

**HSA eligibility by profile:** PE and ARABIC_ISLAMIC use base ORS as the FTE divisor with no
HSA component (matching real-world practice). CERTIFIE, AGREGE, and EPS receive HSA.

### D6: Non-Teaching Staff → Separate Workspace Mode

**Decision:** Support/admin staffing lives in the same module but in a separate workspace grid,
switchable via a toolbar toggle.

**Rationale:** Non-teaching rows share no DHG drivers, coverage semantics, or planning logic
with teaching rows. Mixing them increases cognitive load.

### D7: Epic Scoping → Three Epics

**Decision:** Three implementation epics:

1. **Epic A — Foundations:** Schema + master data + demand engine + settings
2. **Epic B — Coverage & Cost:** Assignment model + coverage engine + cost integration + API
3. **Epic C — Frontend:** Teaching workspace + support workspace + settings sheet + inspector

**Rationale:** Each epic has clear boundaries and can be tested independently. Backend epics
(A + B) can be built and validated before the frontend epic begins.

### D8: Planning Granularity → Follows Pedagogical Model

**Decision:** Row grain varies by level:

| Level         | Row Grain                                      | FTE Derivation                           |
| ------------- | ---------------------------------------------- | ---------------------------------------- |
| Maternelle    | Grade × role (Homeroom, ASEM, Arabic, Islamic) | Section-driven: FTE = sections           |
| Elementaire   | Grade × role (Homeroom) + specialist lines     | Section-driven + hours-driven            |
| College       | Level × subject (Français, Maths, etc.)        | Hours-driven: FTE = hours / effectiveORS |
| Lycee         | Level × subject/track (TC + specialties)       | Hours-driven + group-based               |
| Support/Admin | Department × role (in separate workspace)      | Headcount-based                          |

### D9: Rounding Policy → Raw FTE + Hireable Recommendations (Separate)

**Decision:** The grid shows `requiredFteRaw` (continuous decimal) as the primary demand metric.
A separate `recommendedPositions` column shows `CEIL(requiredFteRaw)` for hiring guidance.
Totals are summed from raw FTE, never from per-line rounded positions.

**Rationale:** Workbook evidence shows rounding inflation of 5.6 FTE (57.41 raw → 63 rounded).

### D10: Cost Category Modes → Configurable Per Category

**Decision:** Each additional cost category (remplacements, formation, resident recharges) has
a `calculationMode`: `FLAT_ANNUAL`, `PERCENT_OF_PAYROLL`, or `AMOUNT_PER_FTE`.

**Rationale:** Source workbook rates (≈1.13% remplacements, ≈1.27% formation) do not match the
original draft's defaults (2%, 1%). Some lines are flat amounts, not formulas.

---

## 5. Domain Model & Conceptual Architecture

### 5.1 Conceptual Pipeline

```text
Enrollment → Rules → Demand → Coverage → Cost → Grid
     ↑           ↑        ↑          ↑         ↑
  AY2 heads   DhgRule  Req Lines  Assignments  Cost Engine
              catalog  (derived)  (user input)  (derived)
```

### 5.2 Four Layers

1. **Master data** — Statutory rules, controlled taxonomies, service profiles
2. **Version inputs** — Settings, assumptions, overrides (scenario-specific)
3. **Supply** — Employee records, vacancies, assignments (user-managed)
4. **Derived outputs** — Requirement sources, requirement lines, coverage summaries,
   cost rollups (system-calculated, recalculated on demand)

### 5.3 What Users Edit vs What the System Calculates

**Users edit:**

- Version staffing settings (HSA policy, academic weeks)
- Service profile overrides (per-version ORS adjustments)
- Cost assumption modes and values (per category)
- Lycee group assumptions (specialty group counts)
- Employee/vacancy records (supply)
- Coverage assignments (linking supply to demand)
- Demand overrides (with reason codes, for exception cases)

**System calculates:**

- Sections/divisions from enrollment headcounts
- Weekly teaching hours from rules + sections/groups
- Requirement source rows (granular) and requirement lines (aggregated)
- Raw and planned FTE from hours / effectiveORS
- Coverage status from assignments
- Monthly payroll cost per employee
- HSA cost per eligible employee
- Category cost rollups
- Line-level cost attribution

---

## 6. Data Model

### 6.1 Master Data — ServiceObligationProfile

Governs weekly service obligation (ORS), HSA eligibility, and default cost treatment per
teacher type. Replaces the hardcoded `ORS_DIVISOR = 18`.

```prisma
model ServiceObligationProfile {
  id                  Int      @id @default(autoincrement())
  code                String   @unique @db.VarChar(20)
  name                String   @db.VarChar(50)
  weeklyServiceHours  Decimal  @db.Decimal(4,1)
  hsaEligible         Boolean  @default(false)
  defaultCostMode     String   @default("LOCAL_PAYROLL") @map("default_cost_mode") @db.VarChar(20)
  sortOrder           Int      @default(0) @map("sort_order")

  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt  DateTime @updatedAt      @map("updated_at") @db.Timestamptz
  createdBy  Int?     @map("created_by")
  updatedBy  Int?     @map("updated_by")

  employees  Employee[]
  dhgRules   DhgRule[]
  overrides  VersionServiceProfileOverride[]

  @@map("service_obligation_profiles")
}
```

**Seed data:**

| Code             | Name                                | ORS (h/week) | HSA Eligible |
| ---------------- | ----------------------------------- | ------------ | ------------ |
| `PE`             | Professeur des Ecoles               | 24.0         | No           |
| `CERTIFIE`       | Professeur Certifie                 | 18.0         | Yes          |
| `AGREGE`         | Professeur Agrege                   | 15.0         | Yes          |
| `EPS`            | Professeur d'EPS                    | 20.0         | Yes          |
| `ARABIC_ISLAMIC` | Enseignant Arabe/Islamique          | 24.0         | No           |
| `ASEM`           | Agent Specialise Ecoles Maternelles | 0.0          | No           |
| `DOCUMENTALISTE` | Professeur Documentaliste           | 30.0         | No           |

### 6.2 Master Data — Discipline

Controlled subject/role taxonomy. Replaces free-text discipline matching.

```prisma
model Discipline {
  id        Int      @id @default(autoincrement())
  code      String   @unique @db.VarChar(50)
  name      String   @db.VarChar(100)
  category  String   @default("SUBJECT") @db.VarChar(20)
  sortOrder Int      @default(0) @map("sort_order")

  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt  DateTime @updatedAt      @map("updated_at") @db.Timestamptz
  createdBy  Int?     @map("created_by")
  updatedBy  Int?     @map("updated_by")

  aliases               DisciplineAlias[]
  employees             Employee[]
  dhgRules              DhgRule[]
  assignments           StaffingAssignment[]
  demandOverrides       DemandOverride[]
  lyceeGroupAssumptions VersionLyceeGroupAssumption[]
  requirementSources    TeachingRequirementSource[]

  @@map("disciplines")
}
```

**Category values:** `SUBJECT` (Français, Maths), `ROLE` (Primary Homeroom, ASEM),
`POOL` (Autonomy, Shared).

**Seed data examples:**

| Code                 | Name                                | Category |
| -------------------- | ----------------------------------- | -------- |
| `PRIMARY_HOMEROOM`   | Class Teacher (Homeroom)            | ROLE     |
| `ASEM`               | ASEM                                | ROLE     |
| `FRANCAIS`           | Français                            | SUBJECT  |
| `MATHEMATIQUES`      | Mathématiques                       | SUBJECT  |
| `HISTOIRE_GEO`       | Histoire-Géographie                 | SUBJECT  |
| `ANGLAIS_LV1`        | Anglais (LV1)                       | SUBJECT  |
| `ARABE`              | Arabe                               | SUBJECT  |
| `ISLAMIQUE`          | Etudes Islamiques                   | SUBJECT  |
| `EPS`                | Education Physique et Sportive      | SUBJECT  |
| `PHYSIQUE_CHIMIE`    | Physique-Chimie                     | SUBJECT  |
| `SVT`                | Sciences de la Vie et de la Terre   | SUBJECT  |
| `TECHNOLOGIE`        | Technologie                         | SUBJECT  |
| `ARTS_PLASTIQUES`    | Arts Plastiques                     | SUBJECT  |
| `EDUCATION_MUSICALE` | Education Musicale                  | SUBJECT  |
| `PHILOSOPHIE`        | Philosophie                         | SUBJECT  |
| `SES`                | Sciences Economiques et Sociales    | SUBJECT  |
| `NSI`                | Numérique et Sciences Informatiques | SUBJECT  |
| `AUTONOMY`           | Pool Autonomie                      | POOL     |

### 6.3 Master Data — DisciplineAlias

Import/migration normalization layer. Maps variant spellings to canonical discipline codes.

```prisma
model DisciplineAlias {
  id           Int    @id @default(autoincrement())
  alias        String @unique @db.VarChar(100)
  disciplineId Int    @map("discipline_id")

  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz

  discipline Discipline @relation(fields: [disciplineId], references: [id])

  @@map("discipline_aliases")
}
```

**Seed examples:** `"Mathematiques"` → MATHEMATIQUES, `"Maths"` → MATHEMATIQUES,
`"Histoire-Geographie"` → HISTOIRE_GEO, `"Histoire Géographie"` → HISTOIRE_GEO.

### 6.4 Master Data — DhgRule (Replaces DhgGrilleConfig)

Global curriculum rule catalog. Each row defines teaching hours for one
(grade, discipline, lineType) combination within an effective-year range. Not version-scoped —
all versions share the same active rules.

```prisma
model DhgRule {
  id                Int      @id @default(autoincrement())
  gradeLevel        String   @map("grade_level") @db.VarChar(10)
  disciplineId      Int      @map("discipline_id")
  lineType          String   @default("STRUCTURAL") @map("line_type") @db.VarChar(20)
  driverType        String   @default("HOURS") @map("driver_type") @db.VarChar(10)
  hoursPerUnit      Decimal  @map("hours_per_unit") @db.Decimal(5,2)
  serviceProfileId  Int      @map("service_profile_id")
  languageCode      String?  @map("language_code") @db.VarChar(5)
  groupingKey       String?  @map("grouping_key") @db.VarChar(50)
  effectiveFromYear Int      @map("effective_from_year")
  effectiveToYear   Int?     @map("effective_to_year")

  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt DateTime @updatedAt      @map("updated_at") @db.Timestamptz

  discipline     Discipline               @relation(fields: [disciplineId], references: [id])
  serviceProfile ServiceObligationProfile @relation(fields: [serviceProfileId], references: [id])

  @@unique([gradeLevel, disciplineId, lineType, languageCode, effectiveFromYear],
           map: "uq_dhg_rule")
  @@index([gradeLevel], map: "idx_dhg_rule_grade")
  @@index([effectiveFromYear], map: "idx_dhg_rule_year")
  @@map("dhg_rules")
}
```

**Year filtering:** The calculation pipeline loads rules where
`effectiveFromYear <= version.fiscalYear AND (effectiveToYear IS NULL OR effectiveToYear >= version.fiscalYear)`.

**Field definitions:**

| Field          | Values                                                | Purpose                                     |
| -------------- | ----------------------------------------------------- | ------------------------------------------- |
| `lineType`     | `STRUCTURAL`, `HOST_COUNTRY`, `AUTONOMY`, `SPECIALTY` | Distinguishes curriculum category           |
| `driverType`   | `SECTION`, `HOURS`, `GROUP`                           | Controls FTE calculation method             |
| `hoursPerUnit` | Decimal                                               | Teaching hours per section/group/pool       |
| `languageCode` | `FR`, `AR`, `EN`, null                                | For language-track subjects                 |
| `groupingKey`  | String or null                                        | Controls aggregation into requirement lines |

**driverType semantics:**

- `SECTION` — FTE = sections needed (1:1 staffing, e.g., homeroom teachers, ASEM)
- `HOURS` — FTE = totalWeeklyHours / effectiveORS (standard subject-based demand)
- `GROUP` — FTE = totalWeeklyHours / effectiveORS where units = group count (Lycee specialties)

**DhgRule validation rules** (enforced on create/update):

1. When `driverType = SECTION`, `hoursPerUnit` MUST be `0`. Rationale: SECTION driver means
   FTE = sections (1:1 staffing). Hours are irrelevant — storing a non-zero value creates a
   misleading `totalWeeklyHours` that is silently discarded by the FTE calculation. If hours
   need tracking, use `driverType = HOURS` with the actual per-section hours instead.
2. When `driverType = HOURS` or `GROUP`, `hoursPerUnit` MUST be > 0.
3. When `driverType = GROUP`, a matching `VersionLyceeGroupAssumption` SHOULD exist (warning,
   not blocking — fallback is 0 groups = 0 FTE).
4. At most one `lineType` per `(gradeLevel, disciplineId)` combination is permitted. If a
   discipline appears at a grade level, it appears with exactly one lineType. This prevents
   ambiguity in assignment coverage matching and demand override targeting (since both use
   `(band, disciplineId)` as their stable key, which would be insufficient if multiple
   lineTypes existed for the same discipline within a band).

**Primary specialist `hoursPerUnit` configuration:**

For primary specialist lines (English, Arabic, Islamic in Maternelle/Elementaire),
`hoursPerUnit` represents the **teacher's weekly teaching load per section**, NOT the
student-facing curriculum hours from the fixture data. These values must be confirmed with
the school (see section 19, Implementation Confirmations).

Example: The fixture shows Elementaire English at 1.5 h/wk (student curriculum). If the
English specialist teaches each section for 1.5h/week, then `hoursPerUnit = 1.5`. With
CP=5, CE1=5, CE2=6, CM1=5, CM2=5 sections (total 26), `totalWeeklyHours = 1.5 × 26 = 39h`.
FTE = 39/24 (PE ORS) = 1.625.

The DhgRule seed data MUST use teacher-facing hours confirmed by the school, not raw fixture
`hoursPerWeek` values, as these may differ when the specialist groups sections or uses a
different contact model.

**Migration from DhgGrilleConfig:** Each existing `DhgGrilleConfig` row maps to a `DhgRule`
with `lineType = 'STRUCTURAL'`, `driverType = 'HOURS'`, and service profile resolved from the
grade level (primary grades → PE, secondary grades → CERTIFIE).

### 6.5 Version-Scoped — VersionStaffingSettings

Version-scoped planning parameters. Replaces system_config-based approach.

```prisma
model VersionStaffingSettings {
  id        Int @id @default(autoincrement())
  versionId Int @unique @map("version_id")

  // HSA planning policy
  hsaTargetHours        Decimal @default(1.5)  @map("hsa_target_hours")          @db.Decimal(4,2)
  hsaFirstHourRate      Decimal @default(500)  @map("hsa_first_hour_rate")       @db.Decimal(10,2)
  hsaAdditionalHourRate Decimal @default(400)  @map("hsa_additional_hour_rate")  @db.Decimal(10,2)
  hsaMonths             Int     @default(10)   @map("hsa_months")

  // Academic calendar
  academicWeeks Int @default(36) @map("academic_weeks")

  // Ajeer system defaults (for new employees / vacancies)
  ajeerAnnualLevy  Decimal @default(9500) @map("ajeer_annual_levy")  @db.Decimal(15,4)
  ajeerMonthlyFee  Decimal @default(160)  @map("ajeer_monthly_fee") @db.Decimal(15,4)

  // Reconciliation baseline (workbook reference values for Tab 6)
  reconciliationBaseline Json? @map("reconciliation_baseline") @db.JsonB

  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt DateTime @updatedAt      @map("updated_at") @db.Timestamptz

  version BudgetVersion @relation(fields: [versionId], references: [id], onDelete: Cascade)

  @@map("version_staffing_settings")
}
```

**Note:** ORS values live on `ServiceObligationProfile` (master data), not here. Per-version ORS
overrides use `VersionServiceProfileOverride` (section 6.6).

**Override merge rule:** When resolving effective ORS for a profile, the engine checks for a
`VersionServiceProfileOverride` row. If `weeklyServiceHours` is non-null on the override, use
it; otherwise fall back to the master profile value. Same logic for `hsaEligible`. This means
partial overrides are supported (override ORS only, or HSA eligibility only).

### 6.6 Version-Scoped — VersionServiceProfileOverride

Allows per-version overrides of ORS and HSA eligibility for scenario comparison
(e.g., "what if Certifie ORS was 17 instead of 18?").

```prisma
model VersionServiceProfileOverride {
  id                 Int      @id @default(autoincrement())
  versionId          Int      @map("version_id")
  serviceProfileId   Int      @map("service_profile_id")
  weeklyServiceHours Decimal? @map("weekly_service_hours") @db.Decimal(4,1)
  hsaEligible        Boolean?  @map("hsa_eligible")

  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt DateTime @updatedAt      @map("updated_at") @db.Timestamptz

  version        BudgetVersion            @relation(fields: [versionId], references: [id],
                                                    onDelete: Cascade)
  serviceProfile ServiceObligationProfile @relation(fields: [serviceProfileId], references: [id])

  @@unique([versionId, serviceProfileId], map: "uq_version_profile_override")
  @@map("version_service_profile_overrides")
}
```

### 6.7 Version-Scoped — VersionStaffingCostAssumption

Configurable cost categories with explicit calculation modes.

```prisma
model VersionStaffingCostAssumption {
  id              Int     @id @default(autoincrement())
  versionId       Int     @map("version_id")
  category        String  @db.VarChar(30)
  calculationMode String  @map("calculation_mode") @db.VarChar(25)
  value           Decimal @db.Decimal(15,4)

  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt DateTime @updatedAt      @map("updated_at") @db.Timestamptz

  version BudgetVersion @relation(fields: [versionId], references: [id], onDelete: Cascade)

  @@unique([versionId, category], map: "uq_version_cost_assumption")
  @@map("version_staffing_cost_assumptions")
}
```

**Category values:** `REMPLACEMENTS`, `FORMATION`, `RESIDENT_SALAIRES`, `RESIDENT_LOGEMENT`,
`RESIDENT_PENSION`.

**Default seed values for FY2026:**

| Category          | Mode               | Value       | Notes                                                                                                                                                                                                                        |
| ----------------- | ------------------ | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| REMPLACEMENTS     | PERCENT_OF_PAYROLL | 0.0113      | ~1.13% of local payroll (from workbook)                                                                                                                                                                                      |
| FORMATION         | PERCENT_OF_PAYROLL | 0.0127      | ~1.27% of local payroll (from workbook)                                                                                                                                                                                      |
| RESIDENT_SALAIRES | FLAT_ANNUAL        | (TBD)       | Annual resident salary recharge amount                                                                                                                                                                                       |
| RESIDENT_LOGEMENT | FLAT_ANNUAL        | (TBD)       | Annual resident housing/travel recharge                                                                                                                                                                                      |
| RESIDENT_PENSION  | FLAT_ANNUAL        | 837000.0000 | 837K SAR/year (35% of resident salary recharge). Note: PERCENT_OF_PAYROLL mode cannot be used here because `subtotalGross` is local payroll, not resident salary. Use FLAT_ANNUAL until a PERCENT_OF_CATEGORY mode is added. |

**calculationMode values:**

| Mode                 | Value semantics             | Formula                                         |
| -------------------- | --------------------------- | ----------------------------------------------- |
| `FLAT_ANNUAL`        | Annual SAR amount           | monthlyAmount = value / 12                      |
| `PERCENT_OF_PAYROLL` | Decimal rate (e.g., 0.0113) | monthlyAmount = subtotalGross × value           |
| `AMOUNT_PER_FTE`     | Annual SAR per teaching FTE | monthlyAmount = (value × totalTeachingFte) / 12 |

### 6.8 Version-Scoped — VersionLyceeGroupAssumption

Group counts for Lycee specialty/shared-pool demand lines where sections are not the
driver (demand is group-based instead).

```prisma
model VersionLyceeGroupAssumption {
  id           Int     @id @default(autoincrement())
  versionId    Int     @map("version_id")
  gradeLevel   String  @map("grade_level") @db.VarChar(10)
  disciplineId Int     @map("discipline_id")
  groupCount   Int     @map("group_count")
  hoursPerGroup Decimal @map("hours_per_group") @db.Decimal(5,2)

  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt DateTime @updatedAt      @map("updated_at") @db.Timestamptz

  version    BudgetVersion @relation(fields: [versionId], references: [id], onDelete: Cascade)
  discipline Discipline    @relation(fields: [disciplineId], references: [id])

  @@unique([versionId, gradeLevel, disciplineId], map: "uq_lycee_group_assumption")
  @@map("version_lycee_group_assumptions")
}
```

**Precedence rule:** When `driverType = GROUP`, the demand engine uses `groupCount` and
`hoursPerGroup` from `VersionLyceeGroupAssumption` if a matching entry exists. If no assumption
entry exists, it falls back to `DhgRule.hoursPerUnit`. This allows planners to override
specialty hours per-version while keeping the base rule as the default.

### 6.8b Version-Scoped — DemandOverride

Allows planners to manually override a derived FTE requirement on any requirement line
(e.g., "I know this line needs 5 FTE, not the calculated 4.67"). Overrides persist across
recalculations and are always auditable.

```prisma
model DemandOverride {
  id               Int     @id @default(autoincrement())
  versionId        Int     @map("version_id")
  band             String  @db.VarChar(15)
  disciplineId     Int     @map("discipline_id")
  lineType         String  @map("line_type") @db.VarChar(20)
  overrideFte      Decimal @map("override_fte") @db.Decimal(7,4)
  reasonCode       String  @map("reason_code") @db.VarChar(30)
  note             String? @db.Text

  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt DateTime @updatedAt      @map("updated_at") @db.Timestamptz
  updatedBy Int?     @map("updated_by")

  version    BudgetVersion @relation(fields: [versionId], references: [id], onDelete: Cascade)
  discipline Discipline    @relation(fields: [disciplineId], references: [id])

  @@unique([versionId, band, disciplineId, lineType], map: "uq_demand_override")
  @@map("demand_overrides")
}
```

**`reasonCode` values:** `BUSINESS_DECISION`, `SPECIALIST_NEED`, `REGULATORY`, `TEMPORARY`,
`CORRECTION`.

**Engine behavior:** After the demand engine computes `requiredFtePlanned`, it checks for a
matching `DemandOverride` by `(versionId, band, disciplineId, lineType)`. If present,
`requiredFtePlanned` is replaced with `overrideFte`. The original calculated value is
preserved as `requiredFteCalculated` (added field on `TeachingRequirementLine`) for
audit/comparison. The UI shows an override indicator on affected lines.

### 6.9 Employee — Extended Fields

Six new fields added to the existing `Employee` model. No existing fields removed. Vacancies
are modeled as Employee records with `recordType = 'VACANCY'` (not a separate table) to keep
a single supply entity for queries, assignments, forms, and tests.

```prisma
// New fields on Employee (added to existing model)
recordType       String    @default("EMPLOYEE") @map("record_type") @db.VarChar(10)
costMode         String    @default("LOCAL_PAYROLL") @map("cost_mode") @db.VarChar(20)
disciplineId     Int?      @map("discipline_id")
serviceProfileId Int?      @map("service_profile_id")
homeBand         String?   @map("home_band") @db.VarChar(15)
contractEndDate  DateTime? @map("contract_end_date") @db.Date
```

| Field              | Type      | Purpose                                                                        | Values                                            |
| ------------------ | --------- | ------------------------------------------------------------------------------ | ------------------------------------------------- |
| `recordType`       | String    | Distinguishes employees from planned vacancies                                 | `EMPLOYEE`, `VACANCY`                             |
| `costMode`         | String    | Cost calculation model                                                         | `LOCAL_PAYROLL`, `AEFE_RECHARGE`, `NO_LOCAL_COST` |
| `disciplineId`     | Int?      | FK to `Discipline`. Maps employee to requirement lines. Null for non-teaching. | FK                                                |
| `serviceProfileId` | Int?      | FK to `ServiceObligationProfile`. Determines ORS basis. Null for non-teaching. | FK                                                |
| `homeBand`         | String?   | Primary assignment level. Null for non-teaching.                               | `MATERNELLE`, `ELEMENTAIRE`, `COLLEGE`, `LYCEE`   |
| `contractEndDate`  | DateTime? | For fixed-term contracts and vacancy end dates.                                | Date                                              |

**Vacancy handling:** Vacancies use `recordType = 'VACANCY'`, `employeeCode = 'VAC-NNN'`
(auto-generated), `status = 'New'`. Salary fields are nullable (set to null for vacancies).
The Zod request schema uses a discriminated union on `recordType` to validate field presence.

**Vacancy cost estimation:** Vacancies with `costMode = LOCAL_PAYROLL` may optionally include
estimated salary values in the encrypted salary fields. If salary fields are null, the cost
engine produces zero cost for that vacancy. The KPI ribbon shows a count of unfunded vacancies
(vacancies with null salary) as an informational indicator so planners are aware of positions
with no cost impact in the budget.

**New relations on Employee:**

```prisma
discipline     Discipline?               @relation(fields: [disciplineId], references: [id])
serviceProfile ServiceObligationProfile? @relation(fields: [serviceProfileId], references: [id])
assignments    StaffingAssignment[]
```

**Existing fields preserved:** `employeeCode`, `name`, `functionRole`, `department`, `status`,
`joiningDate`, `paymentMethod`, `isTeaching`, `isSaudi`, `isAjeer`, `hourlyPercentage`,
all 6 encrypted salary fields, `augmentationEffectiveDate`, `ajeerAnnualLevy`,
`ajeerMonthlyFee`, audit fields.

**`hsaAmount`** (existing encrypted Bytes field) becomes **computed-only** — the calculation
pipeline writes it; the employee form does not expose it for manual entry. The POST/PUT
employee Zod request schemas must strip `hsaAmount` from the request body (ignore if provided).

### 6.10 StaffingAssignment — New Model

The authoritative coverage link between supply (Employee, including vacancies) and demand
(requirement lines). References `(band, disciplineId)` as the stable demand key.

```prisma
model StaffingAssignment {
  id             Int     @id @default(autoincrement())
  versionId      Int     @map("version_id")
  employeeId     Int     @map("employee_id")
  band           String  @db.VarChar(15)
  disciplineId   Int     @map("discipline_id")
  hoursPerWeek   Decimal @map("hours_per_week") @db.Decimal(5,2)
  fteShare       Decimal @map("fte_share") @db.Decimal(5,4)
  source         String  @default("MANUAL") @db.VarChar(20)
  note           String? @db.Text

  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt DateTime @updatedAt      @map("updated_at") @db.Timestamptz
  updatedBy Int?     @map("updated_by")

  version    BudgetVersion @relation(fields: [versionId], references: [id], onDelete: Cascade)
  employee   Employee      @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  discipline Discipline    @relation(fields: [disciplineId], references: [id])

  @@unique([versionId, employeeId, band, disciplineId],
           map: "uq_staffing_assignment")
  @@index([versionId], map: "idx_staffing_assignment_version")
  @@index([versionId, band, disciplineId],
          map: "idx_staffing_assignment_demand")
  @@map("staffing_assignments")
}
```

**`source` values:** `MANUAL` (user-created), `AUTO_SUGGESTED` (system-proposed, user-accepted),
`IMPORTED` (from migration/import).

**Key design decision:** Assignments reference `(band, disciplineId)` — FK-enforced references —
not `requirementLineId` because requirement lines are derived outputs that get recalculated.
Assignments are user input and must survive demand recalculation. The coverage engine joins
assignments to requirement lines by `(band, discipline.code)` at calculation time, resolving
the `disciplineId` FK to the discipline code for matching.

This key is sufficient because the DhgRule validation constraint (section 6.4, rule #4)
guarantees at most one `lineType` per `(gradeLevel, disciplineId)`. Since a band is an
aggregation of grades, no `(band, disciplineCode)` can map to multiple lineTypes, and the
assignment unambiguously identifies one requirement line.

**`fteShare` semantics:** `fteShare` represents the fraction of the employee's total available
FTE (`hourlyPercentage`) allocated to this requirement line. It is an absolute value, not
relative. Example: an employee with `hourlyPercentage = 1.0` assigned with `fteShare = 0.5`
to line A and `fteShare = 0.5` to line B is fully assigned (total = 1.0).

**Validation rules:**

- Total `fteShare` across all assignments for one employee must not exceed `hourlyPercentage`
- `band` must match a valid band value (MATERNELLE, ELEMENTAIRE, COLLEGE, LYCEE)
- `disciplineId` must reference a valid `Discipline` record (DB-enforced via FK)
- Only employees/vacancies with `isTeaching = true` can be assigned to requirement lines

### 6.11 Derived Output — TeachingRequirementSource

Granular calculation output. One row per (version, grade, discipline, lineType). Shown in the
right-panel inspector when a requirement line is selected.

```prisma
model TeachingRequirementSource {
  id               Int     @id @default(autoincrement())
  versionId        Int     @map("version_id")
  gradeLevel       String  @map("grade_level") @db.VarChar(10)
  disciplineId     Int     @map("discipline_id")
  lineType         String  @map("line_type") @db.VarChar(20)
  driverType       String  @map("driver_type") @db.VarChar(10)
  headcount        Int     @default(0)
  maxClassSize     Int     @map("max_class_size")
  driverUnits      Int     @default(0) @map("driver_units")
  hoursPerUnit     Decimal @map("hours_per_unit") @db.Decimal(5,2)
  totalWeeklyHours Decimal @default(0) @map("total_weekly_hours") @db.Decimal(10,4)
  calculatedAt     DateTime @default(now()) @map("calculated_at") @db.Timestamptz

  version    BudgetVersion @relation(fields: [versionId], references: [id], onDelete: Cascade)
  discipline Discipline    @relation(fields: [disciplineId], references: [id])

  @@unique([versionId, gradeLevel, disciplineId, lineType],
           map: "uq_teaching_req_source")
  @@index([versionId], map: "idx_teaching_req_source_version")
  @@map("teaching_requirement_sources")
}
```

**`driverUnits`** = sections needed (for SECTION/HOURS drivers) or group count (for GROUP driver).

### 6.12 Derived Output — TeachingRequirementLine

Aggregated teaching demand lines for grid rendering. One row per (version, band, disciplineCode,
lineType). This is the row object planners see in the teaching workspace grid.

```prisma
model TeachingRequirementLine {
  id                       Int     @id @default(autoincrement())
  versionId                Int     @map("version_id")
  band                     String  @db.VarChar(15)
  disciplineCode           String  @map("discipline_code") @db.VarChar(50)
  lineLabel                String  @map("line_label") @db.VarChar(150)
  lineType                 String  @map("line_type") @db.VarChar(20)
  driverType               String  @map("driver_type") @db.VarChar(10)
  serviceProfileCode       String  @map("service_profile_code") @db.VarChar(20)
  totalDriverUnits         Int     @default(0) @map("total_driver_units")
  totalWeeklyHours         Decimal @default(0) @map("total_weekly_hours") @db.Decimal(10,4)
  baseOrs                  Decimal @map("base_ors") @db.Decimal(5,2)
  effectiveOrs             Decimal @map("effective_ors") @db.Decimal(5,2)
  requiredFteRaw           Decimal @default(0) @map("required_fte_raw") @db.Decimal(7,4)
  requiredFtePlanned       Decimal @default(0) @map("required_fte_planned") @db.Decimal(7,4)
  recommendedPositions     Int     @default(0) @map("recommended_positions")
  coveredFte               Decimal @default(0) @map("covered_fte") @db.Decimal(7,4)
  gapFte                   Decimal @default(0) @map("gap_fte") @db.Decimal(7,4)
  coverageStatus           String  @default("UNCOVERED") @map("coverage_status") @db.VarChar(10)
  assignedStaffCount       Int     @default(0) @map("assigned_staff_count")
  vacancyCount             Int     @default(0) @map("vacancy_count")
  directCostAnnual         Decimal @default(0) @map("direct_cost_annual") @db.Decimal(15,4)
  hsaCostAnnual            Decimal @default(0) @map("hsa_cost_annual") @db.Decimal(15,4)
  calculatedAt             DateTime @default(now()) @map("calculated_at") @db.Timestamptz

  version BudgetVersion @relation(fields: [versionId], references: [id], onDelete: Cascade)

  @@unique([versionId, band, disciplineCode, lineType],
           map: "uq_teaching_req_line")
  @@index([versionId], map: "idx_teaching_req_line_version")
  @@map("teaching_requirement_lines")
}
```

**`coverageStatus` values:** `COVERED` (gap within ±0.25), `DEFICIT` (gap < -0.25),
`SURPLUS` (gap > +0.25), `UNCOVERED` (no assignments).

**FTE computation by driverType:**

- `SECTION` → `requiredFteRaw = totalDriverUnits` (1:1, no ORS division)
- `HOURS` → `requiredFteRaw = totalWeeklyHours / baseOrs`
- `GROUP` → `requiredFteRaw = totalWeeklyHours / baseOrs`

**Planned FTE:** `requiredFtePlanned = totalWeeklyHours / effectiveOrs` where
`effectiveOrs = baseOrs + hsaTargetHours` (for HSA-eligible profiles only).

### 6.13 Existing Model Evolution

#### DhgGrilleConfig → Deprecated

Keep the table during transition. After `DhgRule` migration is stable, drop it. Mark in schema:

```prisma
/// @deprecated Superseded by DhgRule. Retained for migration rollback only.
model DhgGrilleConfig {
  // ... existing fields unchanged
}
```

#### DhgRequirement → Deprecated

Superseded by `TeachingRequirementSource` + `TeachingRequirementLine`. Keep during transition.

#### CategoryMonthlyCost → Extended

Add `RESIDENT_PENSION` as a 5th category value. Add `calculationMode` column:

```prisma
// New field on CategoryMonthlyCost
calculationMode String @default("PERCENT_OF_PAYROLL") @map("calculation_mode") @db.VarChar(25)
```

#### BudgetVersion → New Relations

Add relation fields:

```prisma
// New relations on BudgetVersion (DhgRule is global master data, not version-scoped)
staffingSettings             VersionStaffingSettings?
serviceProfileOverrides      VersionServiceProfileOverride[]
staffingCostAssumptions      VersionStaffingCostAssumption[]
lyceeGroupAssumptions        VersionLyceeGroupAssumption[]
staffingAssignments          StaffingAssignment[]
demandOverrides              DemandOverride[]
teachingRequirementSources   TeachingRequirementSource[]
teachingRequirementLines     TeachingRequirementLine[]
```

### 6.14 Version Clone Behavior

When a BudgetVersion is cloned (`POST /versions/:id/clone`), the following tables are handled:

#### Copied (user-input data)

| Table                           | Notes                                                            |
| ------------------------------- | ---------------------------------------------------------------- |
| `VersionStaffingSettings`       | Deep copy, new versionId. Includes reconciliation baseline.      |
| `VersionServiceProfileOverride` | Deep copy                                                        |
| `VersionStaffingCostAssumption` | Deep copy                                                        |
| `VersionLyceeGroupAssumption`   | Deep copy                                                        |
| `StaffingAssignment`            | Deep copy. `employeeId` must be remapped to cloned employee IDs. |
| `DemandOverride`                | Deep copy                                                        |
| `Employee` (existing)           | Already handled by existing clone logic                          |

#### NOT Copied (derived outputs — regenerated on calculate)

| Table                       | Post-clone behavior                             |
| --------------------------- | ----------------------------------------------- |
| `TeachingRequirementSource` | Not copied. `STAFFING` added to `staleModules`. |
| `TeachingRequirementLine`   | Not copied. `STAFFING` added to `staleModules`. |
| `MonthlyStaffCost`          | Already handled by existing clone logic.        |
| `EosProvision`              | Already handled by existing clone logic.        |
| `CategoryMonthlyCost`       | Already handled by existing clone logic.        |

#### Clone transaction sequence (additions to existing clone logic)

1. After existing employee copy: copy `VersionStaffingSettings`
2. Copy `VersionServiceProfileOverride` rows
3. Copy `VersionStaffingCostAssumption` rows
4. Copy `VersionLyceeGroupAssumption` rows
5. Copy `StaffingAssignment` rows — **remap `employeeId`** to the cloned Employee records.
   The clone transaction must build an `oldEmployeeId → newEmployeeId` map from step 1
   (employee copy) and apply it to assignments in this step.
6. Copy `DemandOverride` rows
7. Add `STAFFING` to the cloned version's `staleModules`

---

## 7. Calculation Engines

### 7.1 Demand Engine

**File:** `apps/api/src/services/staffing/demand-engine.ts`

Replaces the current `dhg-engine.ts`. Computes requirement sources and requirement lines
from enrollment, rules, and settings.

#### Inputs

```typescript
interface DemandEngineInput {
    enrollments: Array<{
        gradeLevel: string;
        headcount: number;
        maxClassSize: number;
    }>;
    rules: Array<{
        gradeLevel: string;
        disciplineCode: string;
        lineType: string;
        driverType: string;
        hoursPerUnit: Decimal;
        serviceProfileCode: string;
        languageCode: string | null;
        groupingKey: string | null;
    }>;
    groupAssumptions: Array<{
        gradeLevel: string;
        disciplineCode: string;
        groupCount: number;
        hoursPerGroup: Decimal;
    }>;
    settings: {
        hsaTargetHours: Decimal;
        academicWeeks: number;
    };
    serviceProfiles: Map<
        string,
        {
            weeklyServiceHours: Decimal;
            hsaEligible: boolean;
        }
    >;
}
```

#### Algorithm

```text
STEP 1 — Requirement Source Rows
  For each rule in rules:
    enrollment = enrollments.find(e.gradeLevel === rule.gradeLevel)
    IF enrollment is null → skip (no students in this grade)

    sectionsNeeded = CEIL(enrollment.headcount / enrollment.maxClassSize)

    SWITCH rule.driverType:
      CASE 'SECTION':
        driverUnits = sectionsNeeded
        totalWeeklyHours = Decimal(0)  // Always 0 for SECTION driver (hoursPerUnit validated as 0)
      CASE 'HOURS':
        driverUnits = sectionsNeeded
        totalWeeklyHours = driverUnits * rule.hoursPerUnit
      CASE 'GROUP':
        groupAssumption = groupAssumptions.find(match)
        driverUnits = groupAssumption?.groupCount ?? 0
        totalWeeklyHours = driverUnits * (groupAssumption?.hoursPerGroup ?? rule.hoursPerUnit)

    → TeachingRequirementSource row

STEP 2 — Aggregate to Requirement Lines
  Group source rows by (band, disciplineCode, lineType):
    band = gradeToBand(gradeLevel)
    totalDriverUnits = SUM(driverUnits)
    totalWeeklyHours = SUM(totalWeeklyHours)
    serviceProfile = serviceProfiles.get(rule.serviceProfileCode)
    lineLabel = buildLineLabel(band, disciplineCode, lineType)

STEP 3 — FTE Calculation
  For each requirement line:
    baseOrs = serviceProfile.weeklyServiceHours
    hsaEligible = serviceProfile.hsaEligible
    effectiveOrs = hsaEligible
      ? baseOrs.plus(settings.hsaTargetHours)
      : baseOrs

    SWITCH driverType:
      CASE 'SECTION':
        requiredFteRaw = Decimal(totalDriverUnits)
        requiredFtePlanned = requiredFteRaw  // No ORS division for section-driven
      CASE 'HOURS' | 'GROUP':
        // GUARD: baseOrs must be > 0 (profiles like ASEM have ORS=0 and must use SECTION driver)
        IF baseOrs.isZero() → throw CalculationError('Cannot divide by zero ORS for ...')
        requiredFteRaw = totalWeeklyHours.div(baseOrs)
        requiredFtePlanned = totalWeeklyHours.div(effectiveOrs)

    // Suppress zero-demand lines from grid output (retain in source rows for auditability)
    IF requiredFteRaw.isZero() → omit from requirement lines output

    recommendedPositions = requiredFteRaw.ceil().toNumber()
```

#### Outputs

```typescript
interface DemandEngineOutput {
    sources: TeachingRequirementSourceRow[];
    lines: TeachingRequirementLineRow[];
}
```

#### Band Mapping

```typescript
function gradeToBand(gradeLevel: string): string {
    const map: Record<string, string> = {
        PS: 'MATERNELLE',
        MS: 'MATERNELLE',
        GS: 'MATERNELLE',
        CP: 'ELEMENTAIRE',
        CE1: 'ELEMENTAIRE',
        CE2: 'ELEMENTAIRE',
        CM1: 'ELEMENTAIRE',
        CM2: 'ELEMENTAIRE',
        '6EME': 'COLLEGE',
        '5EME': 'COLLEGE',
        '4EME': 'COLLEGE',
        '3EME': 'COLLEGE',
        '2NDE': 'LYCEE',
        '1ERE': 'LYCEE',
        TERM: 'LYCEE',
    };
    return map[gradeLevel] ?? 'UNKNOWN';
}
```

### 7.2 Coverage Engine

**File:** `apps/api/src/services/staffing/coverage-engine.ts`

Joins assignments to requirement lines and computes coverage status.

#### Inputs

```typescript
interface CoverageEngineInput {
    requirementLines: TeachingRequirementLineRow[];
    assignments: Array<{
        employeeId: number;
        band: string;
        disciplineId: number;
        disciplineCode: string; // resolved from Discipline FK at query time
        hoursPerWeek: Decimal;
        fteShare: Decimal;
        employeeRecordType: string;
        employeeStatus: string; // 'Existing' | 'New' | 'Departed'
        employeeCostMode: string;
    }>;
}
```

#### Algorithm

```text
// Pre-filter: exclude departed employees from coverage.
// Departed employees do not provide teaching capacity.
activeAssignments = assignments.filter(a => a.employeeStatus !== 'Departed')

// AEFE_RECHARGE employees CAN have assignments and DO count toward coverage.
// They provide teaching hours but their cost is zero (handled by recharge categories).
// No cost-mode filter on coverage — only departed status is excluded.

For each requirement line:
  matchingAssignments = activeAssignments.filter(
    a.band === line.band AND a.disciplineCode === line.disciplineCode
  )

  coveredFte = SUM(matchingAssignments.map(a => a.fteShare))
  gapFte = coveredFte - line.requiredFteRaw  // Use RAW FTE (curriculum need), not planned (HSA-adjusted)

  assignedStaffCount = matchingAssignments
    .filter(a.employeeRecordType === 'EMPLOYEE').length
  vacancyCount = matchingAssignments
    .filter(a.employeeRecordType === 'VACANCY').length

  coverageStatus =
    matchingAssignments.length === 0 ? 'UNCOVERED' :
    gapFte < -0.25 ? 'DEFICIT' :
    gapFte > +0.25 ? 'SURPLUS' :
    'COVERED'

  → Update requirement line with coverage data

Validate:
  For each employee:
    totalAssignedFte = SUM(activeAssignments for this employee)
    IF totalAssignedFte > employee.hourlyPercentage:
      → Warning: employee over-assigned

  For each assignment:
    IF no matching requirement line exists:
      → Warning: orphaned assignment (demand line may have been removed)
      Orphaned assignments are excluded from the employee's coverage total.
      They persist for user review — they are NOT auto-deleted.
      If orphaned across 2 consecutive calculations → Warning: stale orphan

  For each departed employee with active assignments:
    → Warning: departed employee has active assignments (data cleanup needed)
```

#### Outputs

```typescript
interface CoverageEngineOutput {
    updatedLines: TeachingRequirementLineRow[];
    warnings: Array<{
        type:
            | 'OVER_ASSIGNED'
            | 'ORPHANED_ASSIGNMENT'
            | 'STALE_ORPHAN'
            | 'UNASSIGNED_TEACHER'
            | 'DEPARTED_WITH_ASSIGNMENTS'
            | 'RECHARGE_COVERAGE';
        employeeId?: number;
        band?: string;
        disciplineCode?: string;
        message: string;
    }>;
}
```

### 7.3 HSA Engine

**File:** `apps/api/src/services/staffing/hsa-engine.ts`

Computes HSA cost per eligible employee. This is the **payroll HSA amount**, derived from
the **planning HSA policy** (settings) but applicable to individual supply lines.

```typescript
interface HsaInput {
    hsaTargetHours: Decimal;
    hsaFirstHourRate: Decimal;
    hsaAdditionalHourRate: Decimal;
    hsaMonths: number; // 10 (excludes Jul-Aug)
}

interface HsaOutput {
    hsaCostPerMonth: Decimal;
    hsaAnnualPerTeacher: Decimal;
}

function calculateHsa(input: HsaInput): HsaOutput {
    const firstHourCost = input.hsaFirstHourRate;
    const additionalCost = Decimal.max(0, input.hsaTargetHours.minus(1)).times(
        input.hsaAdditionalHourRate
    );
    const costPerMonth = firstHourCost.plus(additionalCost);
    const annual = costPerMonth.times(input.hsaMonths);

    return { hsaCostPerMonth: costPerMonth, hsaAnnualPerTeacher: annual };
}
```

**Application rules:**

- HSA cost applies only to employees where `serviceProfile.hsaEligible === true`
- HSA cost applies only to `costMode === 'LOCAL_PAYROLL'` employees
- HSA cost excludes Jul-Aug (handled by existing cost engine monthly logic)
- The computed `hsaCostPerMonth` is written to the employee's `hsaAmount` encrypted field
  for the existing cost engine to pick up

### 7.4 Cost Engine — Modifications

**File:** `apps/api/src/services/staffing/cost-engine.ts` — modified, not rewritten.

Two changes to the existing pure-function cost engine:

1. **Skip AEFE_RECHARGE employees:** When `costMode === 'AEFE_RECHARGE'`, skip individual cost
   calculation. Return zero-cost monthly rows. Their cost flows through category cost
   assumptions.

2. **Skip NO_LOCAL_COST employees:** When `costMode === 'NO_LOCAL_COST'`, skip entirely. No
   cost output rows.

3. **HSA from demand engine:** The `calculateMonthlyGross` function currently reads `hsaAmount`
   from its input. This stays the same — the orchestration layer now passes the demand-engine-
   computed HSA amount instead of the previously stored value.

Everything else (GOSI 11.75% Saudi-only, Ajeer levy, EoS YEARFRAC tiered, augmentation months
9-12, summer HSA exclusion months 7-8) remains unchanged.

### 7.5 Category Cost Engine — Enhanced

**File:** `apps/api/src/services/staffing/category-cost-engine.ts` — modified.

Now reads from `VersionStaffingCostAssumption` instead of system_config. Supports three
calculation modes per category.

```typescript
interface CategoryCostInput {
    assumptions: Array<{
        category: string;
        calculationMode: string;
        value: Decimal;
    }>;
    monthlySubtotals: Map<number, Decimal>; // month → subtotal adjusted gross
    // MUST include ONLY LOCAL_PAYROLL employees.
    // AEFE_RECHARGE employees are excluded from subtotals
    // (their cost flows through recharge categories, not payroll).
    totalTeachingFteRaw: Decimal; // SUM(requiredFteRaw) from all TeachingRequirementLines.
    // Uses raw FTE (curriculum demand), not planned (HSA-adjusted).
}

function calculateCategoryCost(
    assumption: { category: string; calculationMode: string; value: Decimal },
    month: number,
    monthlySubtotal: Decimal,
    totalTeachingFteRaw: Decimal
): Decimal {
    switch (assumption.calculationMode) {
        case 'FLAT_ANNUAL':
            return assumption.value.div(12);
        case 'PERCENT_OF_PAYROLL':
            return monthlySubtotal.times(assumption.value);
        case 'AMOUNT_PER_FTE':
            return assumption.value.times(totalTeachingFteRaw).div(12);
        default:
            return new Decimal(0);
    }
}
```

**5 categories × 12 months = 60 output rows** (up from 48).

**Note:** A `PERCENT_OF_CATEGORY` mode (e.g., pension as 35% of resident salary recharge) is
not supported in v1. The pension category uses `FLAT_ANNUAL` at 837,000 SAR. If resident
salary amounts change, pension must be manually updated. A `PERCENT_OF_CATEGORY` mode can be
added in v2 without schema changes (only engine code).

### 7.6 Calculation Orchestration

**File:** `apps/api/src/routes/staffing/calculate.ts` — rewritten.

The POST `/versions/:vId/calculate/staffing` pipeline:

```text
1. VALIDATE PREREQUISITES
   - Version is Draft
   - Enrollment AY2 headcounts exist (from enrollment calculation)
   - At least 1 employee or vacancy exists
   - VersionStaffingSettings exists (auto-create with defaults if not)

2. LOAD INPUTS
   - Enrollment AY2 headcounts by grade
   - Active DhgRule rows (effectiveFromYear <= version.fiscalYear, effectiveToYear null or >= version.fiscalYear)
   - ServiceObligationProfile records + version overrides
   - VersionStaffingSettings
   - VersionStaffingCostAssumption records
   - VersionLyceeGroupAssumption records (if any)
   - Employee roster (all non-Departed for this version)
   - StaffingAssignment records for this version

3. RUN DEMAND ENGINE
   → TeachingRequirementSource[] + TeachingRequirementLine[]

4. RUN COVERAGE ENGINE
   → Updated TeachingRequirementLine[] with coverage data + warnings

5. RUN HSA ENGINE
   → HsaOutput (per-teacher cost based on settings)
   → Write hsaAmount to each HSA-eligible LOCAL_PAYROLL employee

6. RUN COST ENGINE (per LOCAL_PAYROLL non-Departed employee, 12 months)
   → MonthlyStaffCost[] (existing model)
   → EosProvision[] (existing model)

7. RUN CATEGORY COST ENGINE (5 categories × 12 months)
   → CategoryMonthlyCost[] (existing model + pension + calculationMode)

8. AGGREGATE COSTS ONTO REQUIREMENT LINES
   For each TeachingRequirementLine:
     matchedEmployees = assignments → employees for this line (by FTE share proportion)
     directCostAnnual = SUM(monthlyStaffCost.totalCost × assignment.fteShare for matched)
     hsaCostAnnual = hsaPerTeacher × count of HSA-eligible matched employees
   Note: Category costs (remplacements, formation, recharges) are NOT allocated to lines.
   They are shown only in the KPI ribbon and grand total row.

9. PERSIST ALL IN A SINGLE TRANSACTION
   - Delete old TeachingRequirementSource, TeachingRequirementLine for this version
   - Delete old MonthlyStaffCost, EosProvision, CategoryMonthlyCost for this version
   - Insert all new rows
   - Remove 'STAFFING' from version.staleModules
   - IF P&L module exists: add 'PNL' to staleModules

10. RETURN SUMMARY
    { totalFteNeeded, totalFteCovered, totalGap, totalCost, warningCount, duration }
```

---

## 8. API Routes

### 8.1 New Endpoints

| Method   | Path                                               | Auth        | Purpose                                                                                                                                                                                  |
| -------- | -------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/versions/:vId/staffing-settings`                 | `data:view` | Read version staffing settings                                                                                                                                                           |
| `PUT`    | `/versions/:vId/staffing-settings`                 | `data:edit` | Update settings. Marks STAFFING stale.                                                                                                                                                   |
| `GET`    | `/versions/:vId/service-profile-overrides`         | `data:view` | List version ORS overrides                                                                                                                                                               |
| `PUT`    | `/versions/:vId/service-profile-overrides`         | `data:edit` | Upsert ORS overrides. Marks STAFFING stale.                                                                                                                                              |
| `GET`    | `/versions/:vId/cost-assumptions`                  | `data:view` | List cost category assumptions                                                                                                                                                           |
| `PUT`    | `/versions/:vId/cost-assumptions`                  | `data:edit` | Upsert assumptions. Marks STAFFING stale.                                                                                                                                                |
| `GET`    | `/versions/:vId/lycee-group-assumptions`           | `data:view` | List Lycee group assumptions                                                                                                                                                             |
| `PUT`    | `/versions/:vId/lycee-group-assumptions`           | `data:edit` | Upsert assumptions. Marks STAFFING stale.                                                                                                                                                |
| `GET`    | `/versions/:vId/teaching-requirements`             | `data:view` | Requirement lines for grid. JOINs assignments + employees to hydrate `assignedEmployees` (lightweight: id, name, costMode, fteShare only). Returns 409 if stale.                         |
| `GET`    | `/versions/:vId/teaching-requirements/:id/sources` | `data:view` | Grade-level detail for inspector.                                                                                                                                                        |
| `GET`    | `/versions/:vId/staffing-assignments`              | `data:view` | List assignments for version                                                                                                                                                             |
| `POST`   | `/versions/:vId/staffing-assignments`              | `data:edit` | Create assignment. Marks STAFFING stale.                                                                                                                                                 |
| `PUT`    | `/versions/:vId/staffing-assignments/:id`          | `data:edit` | Update assignment. Marks STAFFING stale.                                                                                                                                                 |
| `DELETE` | `/versions/:vId/staffing-assignments/:id`          | `data:edit` | Delete assignment. Marks STAFFING stale.                                                                                                                                                 |
| `POST`   | `/versions/:vId/staffing-assignments/auto-suggest` | `data:edit` | Auto-suggest assignments. Returns proposed assignments for preview — planner accepts/rejects each before persisting. Scope: same discipline within home band + College↔Lycee cross-band. |
| `GET`    | `/versions/:vId/demand-overrides`                  | `data:view` | List demand overrides                                                                                                                                                                    |
| `PUT`    | `/versions/:vId/demand-overrides`                  | `data:edit` | Upsert demand override (requires `band`, `disciplineId`, `lineType`, `reasonCode`). Marks STAFFING stale.                                                                                |
| `DELETE` | `/versions/:vId/demand-overrides/:id`              | `data:edit` | Delete override. Marks STAFFING stale.                                                                                                                                                   |

### 8.2 Modified Endpoints

| Method | Path                                | Change                                                                                                        |
| ------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/versions/:vId/employees`          | Response includes `recordType`, `costMode`, `disciplineId`, `serviceProfileId`, `homeBand`, `contractEndDate` |
| `POST` | `/versions/:vId/employees`          | Request body accepts new fields. Marks STAFFING stale.                                                        |
| `PUT`  | `/versions/:vId/employees/:id`      | Request body accepts new fields. Marks STAFFING stale.                                                        |
| `POST` | `/versions/:vId/employees/import`   | Import template updated with new columns. Uses discipline alias resolution.                                   |
| `POST` | `/versions/:vId/calculate/staffing` | New pipeline (section 7.6).                                                                                   |
| `GET`  | `/versions/:vId/staffing-summary`   | Add: `totalHsa`, `totalRecharge`, `heRatio`, `totalFteGap`, coverage breakdown to response.                   |

### 8.3 Master Data Endpoints

| Method | Path                            | Auth        | Purpose                                    |
| ------ | ------------------------------- | ----------- | ------------------------------------------ |
| `GET`  | `/master-data/service-profiles` | `data:view` | List all service obligation profiles       |
| `GET`  | `/master-data/disciplines`      | `data:view` | List all disciplines                       |
| `GET`  | `/master-data/dhg-rules`        | `data:view` | List DHG rules (filterable by year, grade) |

### 8.4 Teaching Requirements Response Shape

```typescript
interface TeachingRequirementsResponse {
    lines: Array<{
        id: number;
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
        recommendedPositions: number;
        coveredFte: string;
        gapFte: string;
        coverageStatus: string;
        assignedStaffCount: number;
        vacancyCount: number;
        directCostAnnual: string;
        hsaCostAnnual: string;
        assignedEmployees: Array<{
            id: number;
            name: string;
            costMode: string;
            fteShare: string;
        }>;
    }>;
    totals: {
        totalFteRaw: string;
        totalFtePlanned: string;
        totalFteCovered: string;
        totalFteGap: string;
        totalDirectCost: string;
        totalHsaCost: string;
        heRatio: string;
    };
    warnings: Array<{
        type: string;
        employeeId?: number;
        message: string;
    }>;
}
```

### 8.5 Staffing Settings Response Shape

```typescript
interface StaffingSettingsResponse {
    hsaTargetHours: string;
    hsaFirstHourRate: string;
    hsaAdditionalHourRate: string;
    hsaMonths: number;
    academicWeeks: number;
    ajeerAnnualLevy: string;
    ajeerMonthlyFee: string;
}
```

### 8.6 Staffing Summary Response Shape

```typescript
interface StaffingSummaryResponse {
    headcount: {
        total: number;
        teaching: number;
        nonTeaching: number;
        employees: number;
        vacancies: number;
    };
    fte: {
        totalFteRaw: string;
        totalFtePlanned: string;
        totalFteCovered: string;
        totalFteGap: string;
    };
    cost: {
        totalStaffCost: string;
        totalHsaCost: string;
        totalCategoryCost: string;
        totalRechargesCost: string;
        grandTotal: string;
    };
    heRatio: string;
    coverageBreakdown: {
        covered: number;
        deficit: number;
        surplus: number;
        uncovered: number;
    };
}
```

---

## 9. Frontend Architecture

### 9.1 Module Layout — Mirrors Enrollment

**File:** `apps/web/src/pages/planning/staffing.tsx`

Structure matches `enrollment.tsx` with a workspace toggle:

```text
PageTransition
  div.flex.h-full.min-h-0.flex-col.overflow-hidden
    [Conditional banners: locked, viewer, imported]
    [Toolbar]
    StaffingKpiRibbon
    StaffingStatusStrip
    div.flex-1.min-h-0.overflow-hidden.px-6.py-2
      div.h-full.overflow-y-auto.scrollbar-thin
        {workspaceMode === 'teaching'
          ? <TeachingMasterGrid />
          : <SupportAdminGrid />}
    StaffingSettingsSheet
    EmployeeForm (Sheet overlay)
```

### 9.2 Toolbar

**Left side — Workspace toggle + Band filter:**

```typescript
const WORKSPACE_MODES = [
    { value: 'teaching', label: 'Teaching' },
    { value: 'support', label: 'Support & Admin' },
];

const BAND_FILTERS = [
    { value: 'ALL', label: 'All' },
    { value: 'MATERNELLE', label: 'Mat' },
    { value: 'ELEMENTAIRE', label: 'Elem' },
    { value: 'COLLEGE', label: 'Col' },
    { value: 'LYCEE', label: 'Lyc' },
];

const COVERAGE_FILTERS = [
    { value: 'ALL', label: 'All' },
    { value: 'DEFICIT', label: 'Deficit' },
    { value: 'SURPLUS', label: 'Surplus' },
    { value: 'UNCOVERED', label: 'Uncovered' },
    { value: 'COVERED', label: 'Covered' },
];
// Both filters visible only in Teaching workspace
```

**Right side — View preset + actions:**

```typescript
const VIEW_PRESETS = [
    { value: 'need', label: 'Need' },
    { value: 'coverage', label: 'Coverage' },
    { value: 'cost', label: 'Cost' },
    { value: 'full', label: 'Full View' },
];

// Buttons: [Settings] [Import xlsx] [Add Employee] [Calculate]
```

### 9.3 Teaching Master Grid

**File:** `apps/web/src/components/staffing/teaching-master-grid.tsx`

Uses DataGrid (TanStack Table v8 + shadcn `<Table>`).

#### Column groups with visibility presets

| Column Group | Columns                               | Need | Coverage | Cost | Full |
| ------------ | ------------------------------------- | ---- | -------- | ---- | ---- |
| Identity     | Band (group header), Line Label, Type | Yes  | Yes      | Yes  | Yes  |
| Drivers      | Driver Units, Hrs/week                | Yes  | Yes      | No   | Yes  |
| Need         | Raw FTE, Planned FTE, Rec. Positions  | Yes  | Yes      | No   | Yes  |
| Coverage     | Covered FTE, Gap, Status, Staff Count | No   | Yes      | No   | Yes  |
| Cost         | Direct Cost, HSA Cost                 | No   | No       | Yes  | Yes  |

#### Row grouping

Rows grouped by `band` with collapsible group headers. Group header shows band name, subtotal
FTE raw, subtotal FTE covered, subtotal gap.

Band display order: MATERNELLE (1) → ELEMENTAIRE (2) → COLLEGE (3) → LYCEE (4).

#### Coverage status column (WCAG AA compliant)

Uses text badge + icon, not color-only dots (per WCAG 1.4.1 Use of Color):

- **DEFICIT** (gap < -0.25): Red badge `! Deficit` with exclamation icon
- **COVERED** (-0.25 ≤ gap ≤ +0.25): Green badge `✓ Covered` with check icon
- **SURPLUS** (gap > +0.25): Amber badge `+ Surplus` with plus icon
- **UNCOVERED** (no assignments): Gray badge `— None` with dash icon

Gap cell background uses muted variants (red-50, green-50, amber-50) alongside text for
users who can distinguish colors. `aria-label` on status cells for screen readers.

#### Row interaction

Click a row → sets selection in `staffingSelectionStore`. Right panel inspector renders
context-sensitive detail (requirement sources, assignments, cost split).

### 9.4 Support & Admin Grid

**File:** `apps/web/src/components/staffing/support-admin-grid.tsx`

Separate grid with rows = employees/vacancies, grouped by department.

| Column                    | Purpose                           |
| ------------------------- | --------------------------------- |
| Department (group header) | Group employees by department     |
| Name / Position           | Employee name or vacancy label    |
| Role                      | `functionRole`                    |
| Status                    | Existing / New / Vacancy          |
| FTE                       | `hourlyPercentage`                |
| Effective Dates           | `joiningDate` — `contractEndDate` |
| Monthly Cost              | Average monthly                   |
| Annual Cost               | Sum of 12 months                  |

### 9.5 Selection Store

**File:** `apps/web/src/stores/staffing-selection-store.ts`

```typescript
interface StaffingSelection {
    type: 'REQUIREMENT_LINE' | 'SUPPORT_EMPLOYEE';
    // For REQUIREMENT_LINE
    requirementLineId?: number;
    band?: string;
    disciplineCode?: string;
    // For SUPPORT_EMPLOYEE
    employeeId?: number;
    department?: string;
}

interface StaffingSelectionStore {
    selection: StaffingSelection | null;
    selectRequirementLine: (id: number, band: string, disciplineCode: string) => void;
    selectSupportEmployee: (employeeId: number, department: string) => void;
    clearSelection: () => void;
}
```

### 9.6 Pure Function Pipeline

**File:** `apps/web/src/lib/staffing-workspace.ts`

Same pattern as `enrollment-workspace.ts` — pure functions, no React, no hooks.

```typescript
interface TeachingGridRow {
    id: number;
    band: string;
    lineLabel: string;
    lineType: string;
    driverType: string;
    rowType: 'requirement' | 'subtotal' | 'total';

    // Driver columns
    totalDriverUnits: number | null;
    totalWeeklyHours: number | null;

    // Need columns
    requiredFteRaw: number | null;
    requiredFtePlanned: number | null;
    recommendedPositions: number | null;

    // Coverage columns
    coveredFte: number;
    gapFte: number;
    coverageStatus: string;
    assignedStaffCount: number;
    vacancyCount: number;

    // Cost columns (direct payroll + HSA per line; category costs shown at total level only)
    directCostAnnual: number;
    hsaCostAnnual: number;
}

function buildTeachingGridRows(response: TeachingRequirementsResponse): TeachingGridRow[];

function filterTeachingRows(
    rows: TeachingGridRow[],
    bandFilter: string,
    coverageFilter: string
): TeachingGridRow[];
```

### 9.7 Right Panel Inspector

**File:** `apps/web/src/components/staffing/staffing-inspector.ts` (side-effect registration)
**File:** `apps/web/src/components/staffing/staffing-inspector-content.tsx` (component)

Registered via:

```typescript
import { registerPanelContent } from '../../lib/right-panel-registry';
registerPanelContent('staffing', () => <StaffingInspectorContent />);
```

#### Content when a REQUIREMENT_LINE is selected

1. **Header:** Line label + band badge + coverage status indicator
2. **Driver Breakdown Table:** Per-grade detail from `teaching-requirements/:id/sources`
    - Columns: Grade | Headcount | Sections/Groups | Hrs/unit | Total Hrs/w
3. **Assigned Teachers List:** From `assignedEmployees` on the requirement line
    - Each teacher: name, cost mode badge (LOCAL/RECHARGE), FTE share
    - Click teacher name → opens EmployeeForm in read-only mode
4. **Gap Analysis Card:**
    - "Raw need: X.XX FTE | Planned need: Y.YY FTE (with HSA relief)"
    - "Covered: Z.ZZ FTE | Gap: ±W.WW"
    - If deficit: "Consider hiring N additional [profile] teacher(s)"
    - If surplus: "N teacher(s) may have available capacity"
5. **Cost Split Card:**
    - Direct payroll: SAR X
    - HSA cost: SAR Y
    - Allocated overhead: SAR Z
    - Total loaded cost: SAR W
6. **HSA Detail Card** (if HSA-eligible):
    - "HSA target: Xh/week | Rate: SAR Y first hour + SAR Z additional"
    - "Applied to N teachers | SAR W/month total"

#### Content when a SUPPORT_EMPLOYEE is selected

1. **Header:** Employee name + department
2. **Employment Details:** Role, status, FTE, dates
3. **Cost Summary:** Monthly cost, annual cost
4. No DHG or assignment sections

### 9.8 Guide Content

**File:** `apps/web/src/components/staffing/staffing-guide-content.ts`

Registered via `registerGuideContent('staffing', ...)`. Contains:

- What is DHG and how it drives teaching demand
- How requirement lines work (section-driven vs hours-driven)
- What coverage assignments mean and how to create them
- How to use band filters and view presets
- What gap analysis means and how to act on it
- How HSA works as a planning lever (settings → effectiveORS → FTE)
- How resident/recharge costs differ from local staff costs
- How to switch between Teaching and Support & Admin workspaces

### 9.9 Hooks

**File:** `apps/web/src/hooks/use-staffing.ts` — extended

New hooks added alongside existing ones:

```typescript
// New hooks
export function useStaffingSettings(versionId: number | null);
export function usePutStaffingSettings(versionId: number | null);
export function useServiceProfileOverrides(versionId: number | null);
export function usePutServiceProfileOverrides(versionId: number | null);
export function useCostAssumptions(versionId: number | null);
export function usePutCostAssumptions(versionId: number | null);
export function useLyceeGroupAssumptions(versionId: number | null);
export function usePutLyceeGroupAssumptions(versionId: number | null);
export function useTeachingRequirements(versionId: number | null);
export function useTeachingRequirementSources(versionId: number | null, lineId: number | null);
export function useStaffingAssignments(versionId: number | null);
export function useCreateAssignment(versionId: number | null);
export function useUpdateAssignment(versionId: number | null);
export function useDeleteAssignment(versionId: number | null);
export function useAutoSuggestAssignments(versionId: number | null);

// Master data hooks (in use-master-data.ts or similar)
export function useServiceProfiles();
export function useDisciplines();
export function useDhgRules(year?: number);
```

Existing hooks (`useEmployees`, `useStaffCosts`, `useCalculateStaffing`, etc.) remain with
minor type updates to include new Employee fields.

---

## 10. Settings Sheet

**File:** `apps/web/src/components/staffing/staffing-settings-sheet.tsx`

Full-width Sheet (same as `EnrollmentSettingsSheet`) with 6 tabs:

### Tab 1: Service Profiles & HSA

- **Service profile table:** Read-only display of `ServiceObligationProfile` records
  (Code, Name, ORS, HSA Eligible). Shows version overrides inline if any.
- **ORS overrides:** Editable numeric fields per profile (only if override differs from base)
- **HSA target hours:** Numeric input, 0-3 range, step 0.5 (default 1.5)
- **HSA rate inputs:** First hour rate, additional hour rate (SAR)
- **HSA active months:** Numeric input (default 10)

### Tab 2: Curriculum / DHG Rules

- Read-only display of active `DhgRule` records for the version's fiscal year, grouped by band
- Table: Grade | Discipline | Line Type | Driver Type | Hours/unit | Service Profile
- "Edit in Master Data" link (rules are global, not version-scoped)
- If rules are modified in master data, all Draft versions with STAFFING calculated are marked stale

### Tab 3: Lycee Group Assumptions

- Editable table for Lycee specialty and shared-pool group counts
- Columns: Grade | Discipline | Group Count | Hours/Group
- Only visible when Lycee grades have GROUP-driver rules

### Tab 4: Additional Cost Assumptions

- **Category table:** One row per cost category:
    - Category name
    - Calculation mode dropdown: Flat Annual | % of Payroll | Amount per FTE
    - Value input (SAR or percentage depending on mode)
    - Computed monthly preview
- Default categories: Remplacements, Formation, Resident Salaires, Resident Logement,
  Resident Pension

### Tab 5: Enrollment Link

- Read-only table of enrollment AY2 headcounts by grade
- Shows last enrollment calculation timestamp
- If ENROLLMENT is stale: warning banner with link to enrollment page
- "Go to Enrollment" button

### Tab 6: Reconciliation (Read-Only)

Displays a comparison table of app-computed annual totals vs workbook baseline values.
Baselines are stored in `VersionStaffingSettings.reconciliationBaseline` (JSON field).

| Metric                           | App-Computed             | Workbook Baseline | Delta  | Status                     |
| -------------------------------- | ------------------------ | ----------------- | ------ | -------------------------- |
| Secondary Raw FTE                | (from requirement lines) | 57.41             | ±N.NN  | Within tolerance / Warning |
| Total Teaching Raw FTE           | (from requirement lines) | (from baseline)   | ±N.NN  | Within tolerance / Warning |
| Monthly HSA Total                | (from cost engine)       | 57,424 SAR        | ±N SAR | Within tolerance / Warning |
| Annual Pension                   | (from category cost)     | 837,000 SAR       | ±N SAR | Within tolerance / Warning |
| Annual Staff Cost (excl pension) | (from cost engine)       | (from baseline)   | ±N SAR | Within tolerance / Warning |

**Tolerance thresholds:** ±0.05 FTE per line, ±0.5 FTE total, ±1% per cost category,
±5% grand total.

**Known accepted variances** (shown as footnotes):

- HSA: app uses uniform policy rate; workbook has person-level amounts (±2,600 SAR/month expected)
- Pension: app includes pension in grand total; workbook summary omits it (837K SAR/year expected)

This tab is read-only. The app-computed values refresh after each staffing calculation. The
baseline values are static seed data from the source workbooks.

Saving any setting → marks STAFFING as stale via the PUT endpoint.

**Settings Sheet Store:** `apps/web/src/stores/staffing-settings-store.ts` (same pattern as
`enrollmentSettingsSheetStore`).

---

## 11. KPI Ribbon & Status Strip

### 11.1 KPI Ribbon

**File:** `apps/web/src/components/staffing/staffing-kpi-ribbon.tsx`

Six metrics:

| Metric          | Source                                              | Format           | Color Logic                                         |
| --------------- | --------------------------------------------------- | ---------------- | --------------------------------------------------- |
| Total Headcount | Count of non-Departed employees + vacancies         | "168"            | Neutral                                             |
| FTE Gap         | Sum of all requirement line `gapFte`                | "+2.5" or "-3.0" | Green if balanced, red if deficit, amber if surplus |
| Staff Cost      | Total annual local payroll cost                     | "SAR 24.3M"      | Neutral                                             |
| HSA Budget      | Total annual HSA cost                               | "SAR 574K"       | Neutral                                             |
| H/E Ratio       | Total weekly teaching hours / total students        | "1.32"           | Neutral                                             |
| Recharge Cost   | Sum of recharge category costs (resident + pension) | "SAR 8.8M"       | Neutral                                             |

### 11.2 Status Strip

**File:** `apps/web/src/components/staffing/staffing-status-strip.tsx`

Same visual pattern as `EnrollmentStatusStrip`:

- **Calculation status:** "Last calculated: Mar 16, 2026 14:23" or "Not yet calculated"
- **Stale indicator:** If `STAFFING` in `staleModules`, show warning: "Staffing data is stale.
  Recalculate to refresh."
- **Demand period:** "Demand: Academic Year 2 (Sep 2026 – Jun 2027)"
- **Source indicator:** "Based on enrollment AY2 headcounts (calculated Mar 15, 2026)"
- **Supply count:** "168 employees (162 existing, 6 new) + 3 vacancies"
- **Coverage summary:** "Coverage: 42 covered, 3 deficit, 2 surplus, 1 uncovered"

---

## 12. Employee Form Changes

**File:** `apps/web/src/components/staffing/employee-form.tsx`

The existing Sheet-based employee form receives 6 new fields with conditional visibility.
Vacancies use the same form with `recordType = 'VACANCY'` and simplified sections.

### 12.1 Employee Form — New Fields

| Field              | Control                                                        | Visible When                      |
| ------------------ | -------------------------------------------------------------- | --------------------------------- |
| `recordType`       | Radio group: Employee / Vacancy                                | Always                            |
| `costMode`         | Select dropdown: Local Payroll / AEFE Recharge / No Local Cost | Always                            |
| `disciplineId`     | Select dropdown (disciplines from master data)                 | `isTeaching = true`               |
| `serviceProfileId` | Select dropdown (service profiles from master data)            | `isTeaching = true`               |
| `homeBand`         | Select dropdown: Maternelle / Elementaire / College / Lycee    | `isTeaching = true`               |
| `contractEndDate`  | Date picker                                                    | Always (for fixed-term contracts) |

### Conditional Visibility Rules

- **costMode = AEFE_RECHARGE:** Hide all salary fields (baseSalary, housingAllowance,
  transportAllowance, responsibilityPremium, augmentation). Show info banner: "Salary managed
  by AEFE recharge. Configure recharge amounts in Staffing Settings."
- **costMode = NO_LOCAL_COST:** Hide all salary fields and Ajeer fields.
- **isTeaching = false:** Hide `disciplineId`, `serviceProfileId`, `homeBand`.
- **hsaAmount field:** Hidden from form (computed by calculation pipeline).

### Form Sections (top to bottom)

1. **Identity:** Employee code, name, department, function role
2. **Classification:** Status, cost mode, is teaching, is Saudi, is Ajeer
3. **Teaching Profile** (visible if isTeaching): Discipline, service profile, home band
4. **Employment:** Joining date, contract end date, payment method, hourly percentage
5. **Compensation** (visible if costMode = LOCAL_PAYROLL): Base salary, housing, transport,
   responsibility premium, augmentation + effective date
6. **Ajeer Details** (visible if isAjeer AND costMode = LOCAL_PAYROLL): Annual levy, monthly fee

### 12.2 Vacancy Mode (recordType = VACANCY)

When `recordType = VACANCY`, the employee form simplifies:

- **employeeCode:** Auto-generated as `VAC-NNN` (read-only)
- **Salary fields:** Hidden (vacancies have no encrypted salary data)
- **isSaudi, isAjeer:** Hidden (not relevant for planned positions)
- **contractEndDate:** Shown as "Position needed until" (optional)
- **Teaching Profile:** Discipline, service profile, home band remain required for teaching vacancies

### 12.3 Auto-Suggest Assignment Acceptance Dialog

**File:** `apps/web/src/components/staffing/auto-suggest-dialog.tsx`

Triggered from toolbar "Auto-Suggest" button. Calls
`POST /staffing-assignments/auto-suggest` and presents results for review.

**UI:** Full-width Sheet overlay with:

1. **Header:** "Suggested Assignments — Review and Accept"
2. **Summary:** "N assignments suggested for M unassigned employees"
3. **Table:** One row per suggested assignment:
    - Columns: Employee Name | Band | Discipline | FTE Share | Confidence | Accept?
    - Accept column: Checkbox per row (default checked)
    - Confidence: "High" (exact discipline+band match), "Medium" (cross-band College↔Lycee)
4. **Actions:**
    - "Accept Selected (N)" button — persists checked assignments with `source = 'AUTO_SUGGESTED'`
    - "Reject All" button — closes dialog with no changes
    - "Accept All" button — persists all suggestions
5. **Post-accept:** Marks STAFFING stale, shows success toast with count

---

## 13. Validation, Controls & Auditability

### 13.1 Mandatory Validations

**Form-save validations** (enforced via Zod request schemas on POST/PUT employee):

1. Every teaching employee/vacancy has a valid `serviceProfileId` (not null when `isTeaching = true`)
2. Every teaching employee/vacancy has a valid `disciplineId` (not null when `isTeaching = true`)
3. Every teaching employee/vacancy has a valid `homeBand` (not null when `isTeaching = true`)

**Calculation-time validations** (checked at the start of the calculate pipeline): 4. `disciplineCode` in assignments resolves through `Discipline` master data 5. No employee is assigned above 100% available FTE (`SUM(fteShare) ≤ hourlyPercentage`) 6. No requirement line has negative covered FTE unless explicitly acknowledged 7. Lycee GROUP-driver rules have corresponding `VersionLyceeGroupAssumption` entries 8. All cost assumption categories have a valid `calculationMode` 9. Enrollment AY2 headcounts exist before staffing calculation can run

### 13.2 Warning Conditions (Non-Blocking)

- Orphaned assignments (assignment references a band+discipline with no requirement line)
- Unassigned teaching employees (employee has no assignments)
- Over-assigned employees (total FTE > hourlyPercentage)
- Requirement lines with UNCOVERED status
- Large FTE gap (|gap| > 2.0 on a single line)
- Stale enrollment data (ENROLLMENT in staleModules)

### 13.3 Audit Requirements

- Persist calculation run header: `{ versionId, startedAt, completedAt, triggeredBy,
inputHash, warningCount, lineCount }`
- Log all assignment CRUD operations to `audit_log` with `userId`, `action`, `before`, `after`
- Log all settings changes to `audit_log`
- Expose `calculatedAt` timestamp on all derived output rows
- Show calculation warnings in the status strip and right-panel inspector

---

## 14. Stale Module Propagation

Extended chain (changes from current codebase noted):

```text
ENROLLMENT → REVENUE
ENROLLMENT → STAFFING    (enrollment headcounts drive DHG sections)
STAFFING   → PNL

Changes from current codebase:
- The existing 'DHG' stale module is REMOVED. DHG demand is now part of STAFFING calculation.
  All code referencing STALE_MODULES 'DHG' must be updated to use 'STAFFING' instead.
- The existing REVENUE → STAFFING chain is PRESERVED (revenue changes may affect P&L inputs
  that inform staffing budget, keeping the chain ensures consistency).

Triggers:
- Enrollment recalculated    → mark STAFFING stale
- Employee created/updated/deleted/imported → mark STAFFING stale
- DHG rule created/updated/deleted (master data change) → mark STAFFING stale on all Draft versions
- Staffing settings changed  → mark STAFFING stale
- Cost assumptions changed   → mark STAFFING stale
- Service profile override changed → mark STAFFING stale
- Lycee group assumption changed → mark STAFFING stale
- Demand override created/updated/deleted → mark STAFFING stale
- Assignment created/updated/deleted → mark STAFFING stale
- Staffing recalculated      → remove STAFFING from staleModules, mark PNL stale
```

---

## 15. Migration Strategy

### Phase 1 — Master Data Catalog

1. Create `ServiceObligationProfile` table and seed 6 profiles
2. Create `Discipline` table and seed from `subjectList` in fixture (46 subjects + roles)
3. Create `DisciplineAlias` table and seed normalization mappings
4. Create `DhgRule` table (global, with effectiveFromYear) and migrate from `DhgGrilleConfig`:
    - Map `dhgType = 'Structural'` → `lineType = 'STRUCTURAL'`
    - Determine `driverType` from grade level (primary grades → `SECTION` for homeroom/ASEM,
      `HOURS` for specialists; secondary grades → `HOURS`)
    - Resolve `serviceProfileId` from grade level heuristics
    - Resolve `disciplineId` from subject name through alias table
    - Set `effectiveFromYear = 2026`, `effectiveToYear = null`
    - Add English specialist rules for Maternelle and Elementaire grades

### Phase 2 — Schema Migration (Prisma)

1. Add 6 new fields to `Employee` model (all nullable or with defaults)
2. Create `DhgRule` model (global, replaces DhgGrilleConfig)
3. Create `VersionStaffingSettings` model
4. Create `VersionServiceProfileOverride` model
5. Create `VersionStaffingCostAssumption` model
6. Create `VersionLyceeGroupAssumption` model
7. Create `DemandOverride` model
8. Create `StaffingAssignment` model
9. Create `TeachingRequirementSource` model
10. Create `TeachingRequirementLine` model
11. Add `calculationMode` to `CategoryMonthlyCost`
12. Add relation fields to `BudgetVersion`

### Phase 3 — Data Migration (Script)

**File:** `apps/api/src/migration/scripts/staffing-data-migration.ts`

**Step 1 — Populate defaults:**

1. `recordType = 'EMPLOYEE'` for all existing employees
2. `costMode = 'LOCAL_PAYROLL'` for all existing employees

**Step 2 — Service profile assignment** (heuristics applied in order, first match wins):

1. `department ILIKE '%maternelle%'` OR `department ILIKE '%elementaire%'` → PE
2. `functionRole ILIKE '%agrege%'` OR `functionRole ILIKE '%agrégé%'` → AGREGE
3. `functionRole ILIKE '%EPS%'` OR `department ILIKE '%sport%'` → EPS
4. `functionRole ILIKE '%arabe%'` OR `functionRole ILIKE '%islamic%'`
   OR `department ILIKE '%arabic%'` → ARABIC_ISLAMIC
5. `functionRole ILIKE '%documentaliste%'` → DOCUMENTALISTE
6. `isTeaching = true` → CERTIFIE (catch-all for unresolved teaching staff)
7. `isTeaching = false` → null (non-teaching, no service profile)

**Step 3 — Discipline assignment:**

- Resolve through `DisciplineAlias` lookup on `functionRole`
- For each employee where alias lookup fails: log to exception queue

**Step 4 — Home band assignment:**

- Resolve from `department` through grade-to-band mapping
- For each employee where department doesn't map: log to exception queue

**Step 5 — Exception queue:**

Records that cannot be auto-mapped are collected into a temporary
`staffing_migration_exceptions` table (not a Prisma model — raw SQL):

| Column               | Type    | Purpose                                                             |
| -------------------- | ------- | ------------------------------------------------------------------- |
| `employeeId`         | Int     | FK to employee                                                      |
| `employeeName`       | String  | For human review                                                    |
| `field`              | String  | Which field failed (`serviceProfileId`, `disciplineId`, `homeBand`) |
| `sourceValue`        | String  | The department/functionRole value that didn't match                 |
| `attemptedHeuristic` | String  | Which rule was tried                                                |
| `suggestedMatch`     | String? | Best-guess if available                                             |
| `resolved`           | Boolean | Operator marks resolved after manual fix                            |

**Step 6 — Version-scoped seed data:**

1. Create `VersionStaffingSettings` with defaults for all existing versions
2. Create `VersionStaffingCostAssumption` with defaults for all existing versions
   (migrate current system_config values to PERCENT_OF_PAYROLL / FLAT_ANNUAL modes)
3. Seed `reconciliationBaseline` JSON with workbook reference values

**Step 7 — Verification:**

After migration, run verification queries:

- Count employees by `serviceProfileId` — compare to expected distribution
- Count employees by `costMode` — all should be `LOCAL_PAYROLL`
- Count unresolved exceptions — must be 0 before migration is marked complete
- Count null `disciplineId` where `isTeaching = true` — these are the exceptions

**Rollback:** Entire Phase 3 runs in a single transaction. If any step fails, all changes
are rolled back. The exception queue is populated outside the transaction so exceptions
remain visible even on failure.

### Phase 4 — Engine + API

1. New demand engine with requirement lines and variable ORS
2. New coverage engine with assignment-based gap analysis
3. Updated HSA engine (planning policy → payroll amount)
4. Updated cost engine (skip AEFE_RECHARGE, use computed HSA)
5. Updated category cost engine (configurable modes)
6. New API endpoints (settings, teaching requirements, assignments, master data)
7. Updated calculate orchestration pipeline
8. Updated employee endpoints (new fields + alias resolution on import)

### Phase 5 — Frontend

1. New `staffing.tsx` page (enrollment layout pattern with workspace toggle)
2. `TeachingMasterGrid` component (DataGrid with column visibility presets)
3. `SupportAdminGrid` component
4. `StaffingSettingsSheet` component (6 tabs)
5. `StaffingKpiRibbon` and `StaffingStatusStrip`
6. Right panel inspector + guide content registration
7. `staffing-workspace.ts` pure function pipeline
8. `staffingSelectionStore` and `staffingSettingsSheetStore` Zustand stores
9. Updated `EmployeeForm` with new fields and conditional visibility
10. Updated `use-staffing.ts` hooks (14 new hooks)
11. Assignment management UI (within inspector or modal)

### Phase 6 — Cleanup

1. Deprecate `DhgGrilleConfig` (mark in schema, keep table for rollback)
2. Deprecate `DhgRequirement` (mark in schema, keep table for rollback)
3. Remove old WorkspaceBoard/WorkspaceBlock imports from staffing page
4. Remove deprecated DHG components (`dhg-view.tsx`, old `monthly-cost-grid.tsx`)

---

## 16. Performance Considerations

### 16.1 Read Performance

The main teaching grid must not build its row model by joining raw employee, assignment, and
decrypted salary data on every load.

**Strategy:** Use precomputed read models:

- `TeachingRequirementLine` — pre-aggregated with coverage and cost data
- `assignedEmployees` array on response — lightweight (id, name, costMode, fteShare only)

The grid loads a single `GET /teaching-requirements` call. Inspector detail loads on-demand
via `GET /teaching-requirements/:id/sources`.

### 16.2 Write / Calculate Performance

- Keep the calculate pipeline transactional (single Prisma `$transaction`)
- Recalculate all derived outputs in the backend, not in the browser
- Only decrypt salary fields when calculating or rendering privileged detail views
- Do not embed large employee arrays in summary row responses (keep lightweight)

### 16.3 Data Volume Estimates

| Entity                    | Expected row count per version     |
| ------------------------- | ---------------------------------- |
| TeachingRequirementSource | ~200 (grades × disciplines)        |
| TeachingRequirementLine   | ~60 (bands × disciplines)          |
| StaffingAssignment        | ~170 (≈ 1 per teaching employee)   |
| MonthlyStaffCost          | ~2,000 (168 employees × 12 months) |
| CategoryMonthlyCost       | 60 (5 categories × 12 months)      |

All well within single-page rendering limits (no virtual scrolling needed per ADR-016).

---

## 17. Implementation Sequence

### Epic A — Foundations (Backend)

**Scope:** Schema + master data + demand engine + settings

1. Prisma schema migration (10 new models/extensions)
2. Seed master data (service profiles, disciplines, aliases)
3. Migrate DhgGrilleConfig → DhgRule
4. Implement demand engine (pure functions)
5. Implement staffing settings CRUD routes
6. Implement master data read routes
7. Implement teaching requirements read route
8. Unit tests for demand engine

### Epic B — Coverage & Cost (Backend)

**Scope:** Assignment model + coverage engine + cost integration + API

1. StaffingAssignment CRUD routes
2. Coverage engine (pure functions)
3. HSA engine updates (dual model)
4. Cost engine modifications (skip AEFE_RECHARGE, computed HSA)
5. Category cost engine (configurable modes)
6. Updated calculation orchestration pipeline
7. Updated employee endpoints (new fields)
8. Updated staffing summary endpoint
9. Auto-suggest assignments endpoint
10. Unit tests for coverage engine, HSA engine, cost engine changes

### Epic C — Frontend

**Scope:** Teaching workspace + support workspace + settings + inspector

1. Page layout with workspace toggle
2. TeachingMasterGrid (column groups, row grouping, gap styling)
3. SupportAdminGrid
4. StaffingSettingsSheet (5 tabs)
5. StaffingKpiRibbon (6 metrics)
6. StaffingStatusStrip
7. Right panel inspector + guide content
8. staffing-workspace.ts pure functions
9. Zustand stores (selection + settings sheet)
10. Updated EmployeeForm (new fields, conditional visibility)
11. New hooks (14 hooks)
12. Assignment management UI

---

## 18. Acceptance Criteria

The redesign is not complete until all of the following are true:

1. Teaching demand is represented as governed requirement lines with persisted source-row
   provenance traceable back to enrollment headcounts and DHG rules.
2. The grid supports primary (section-driven) and secondary (hours-driven) planning without
   forcing a single row model.
3. Coverage is based on explicit `StaffingAssignment` records, not discipline text matching.
4. Raw FTE and recommended hireable positions are shown as separate measures. Grid totals use
   raw FTE sums, not summed rounded positions.
5. HSA planning policy (effective ORS) and HSA payroll cost (per-employee amount) are modeled
   separately and can be reconciled.
6. HSA eligibility varies by service profile (PE/ARABIC_ISLAMIC excluded, CERTIFIE/AGREGE/EPS
   included).
7. Additional staff cost categories support FLAT_ANNUAL, PERCENT_OF_PAYROLL, and AMOUNT_PER_FTE
   calculation modes.
8. The status strip clearly identifies when staffing data is stale and needs recalculation.
9. Every assignment is auditable with user, timestamp, source, and optional note.
10. The teaching workspace supports gap filtering, band filtering, and view presets (Need,
    Coverage, Cost, Full).
11. Support/admin staffing can be planned in the same module without appearing in the teaching
    grid.
12. Employee import resolves discipline and service profile through alias normalization tables.
13. The API and read-model design avoids loading raw decrypted salary data for the main
    workspace grid.
14. Service profiles are master-data-backed with per-version overrides for scenario comparison.
15. The calculation pipeline runs as a single atomic transaction.

---

## 19. Open Questions

All major design decisions have been resolved. The following items remain as implementation
notes requiring confirmation during development:

### Resolved Decisions Summary

| #   | Question                   | Decision                                                                                 |
| --- | -------------------------- | ---------------------------------------------------------------------------------------- |
| Q1  | Primary English coverage   | **Specialist teachers** — dedicated English requirement lines for Maternelle/Elementaire |
| Q2  | Arabic/Islamic ORS by band | **24h everywhere** — single ARABIC_ISLAMIC profile across all bands                      |
| Q3  | Resident recharge mode     | **Flat annual totals** for v1                                                            |
| Q4  | AY scope                   | **AY2 only** for v1                                                                      |
| Q5  | Auto-assignment scope      | **Same discipline, College+Lycee** — cross-band suggestions allowed                      |
| Q6  | ASEM scope                 | **Maternelle only**                                                                      |
| Q7  | Elementaire specialists    | **Arabic + Islamic + English** — three specialist-covered subjects                       |
| Q8  | Pension treatment          | **% of resident salary** (35% share; 837K SAR is annual, not monthly)                    |

### Implementation Confirmations Needed

1. **Exact FY2026 resident recharge amounts** — The RESIDENT_SALAIRES and RESIDENT_LOGEMENT
   flat annual values need to be confirmed from the source workbook for seed data.
2. **Primary English hours per grade (teacher-facing)** — The DhgRule seed data needs the
   teacher's weekly teaching load per section for English in each Maternelle (PS/MS/GS) and
   Elementaire (CP-CM2) grade. These are NOT the student curriculum hours from the fixture
   (see section 6.4 for the distinction). Requires school confirmation.
3. **Discipline-to-employee mapping audit** — Before Phase 3 migration runs, audit existing
   employee `department`/`functionRole` values to validate the heuristic mapping rules.
   Run the dry-run migration script (Phase 3) on real data before the actual migration.
4. **Arabic/Islamic ORS by band** — Q2 resolved as 24h everywhere, but the fixture notes
   this as "Estimated — adjust per EFIR contract." Confirm with EFIR HR that 24h is correct
   for secondary Arabic/Islamic teachers. If secondary uses 18h, FTE demand changes by 33%.
5. **DOCUMENTALISTE classification** — Confirm whether the CDI documentaliste is a teaching
   position (needs DhgRule + requirement line) or support/admin (appears in support workspace
   only). Current assumption: support/admin.
6. **Maternelle English** — Confirm whether EFIR has English instruction in Maternelle
   (PS/MS/GS). The fixture has no Maternelle English data. If yes, need DhgRule seed data
   with confirmed hours. If no, remove from Appendix A mockup.
7. **Lycee autonomy hours** — Confirm whether "Heures d'autonomie" (12h/division) generate
   real FTE demand or are a planning diagnostic only. Current assumption: diagnostic only.
8. **Ajeer/EoS cost split** — The cost attribution formula splits all employee costs
   (including per-person Ajeer fees) by FTE share. This is an approximation. Confirm with
   finance that this is acceptable for per-line cost attribution (the KPI totals are exact).
9. **HSA per-employee override** — Deferred to v1.1. The uniform policy-derived HSA is used
   for all eligible teachers in v1. Known variance vs workbook: ±2,600 SAR/month.

---

## 20. File Inventory

### New Files

| Path                                                              | Purpose                                                                     |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **Backend — Engines**                                             |                                                                             |
| `apps/api/src/services/staffing/demand-engine.ts`                 | Pure function demand calculator (requirement sources + lines)               |
| `apps/api/src/services/staffing/coverage-engine.ts`               | Pure function coverage calculator (assignments → gaps)                      |
| `apps/api/src/services/staffing/hsa-engine.ts`                    | Pure function HSA cost calculator (dual model)                              |
| **Backend — Routes**                                              |                                                                             |
| `apps/api/src/routes/staffing/settings.ts`                        | Staffing settings CRUD                                                      |
| `apps/api/src/routes/staffing/service-profile-overrides.ts`       | Version ORS overrides                                                       |
| `apps/api/src/routes/staffing/cost-assumptions.ts`                | Cost assumption CRUD                                                        |
| `apps/api/src/routes/staffing/lycee-assumptions.ts`               | Lycee group assumption CRUD                                                 |
| `apps/api/src/routes/staffing/teaching-requirements.ts`           | Teaching requirement read endpoints                                         |
| `apps/api/src/routes/staffing/assignments.ts`                     | StaffingAssignment CRUD + auto-suggest                                      |
| `apps/api/src/routes/staffing/demand-overrides.ts`                | DemandOverride CRUD                                                         |
| **Frontend — Workspace**                                          |                                                                             |
| `apps/web/src/lib/staffing-workspace.ts`                          | Pure function grid data pipeline                                            |
| `apps/web/src/stores/staffing-selection-store.ts`                 | Zustand selection store                                                     |
| `apps/web/src/stores/staffing-settings-store.ts`                  | Settings sheet open/close store                                             |
| **Frontend — Components**                                         |                                                                             |
| `apps/web/src/components/staffing/teaching-master-grid.tsx`       | Teaching workspace DataGrid                                                 |
| `apps/web/src/components/staffing/support-admin-grid.tsx`         | Support workspace DataGrid                                                  |
| `apps/web/src/components/staffing/staffing-settings-sheet.tsx`    | Settings sheet (5 tabs)                                                     |
| `apps/web/src/components/staffing/staffing-kpi-ribbon.tsx`        | KPI ribbon (6 metrics)                                                      |
| `apps/web/src/components/staffing/staffing-status-strip.tsx`      | Status strip                                                                |
| `apps/web/src/components/staffing/staffing-inspector.ts`          | Right panel registration                                                    |
| `apps/web/src/components/staffing/staffing-inspector-content.tsx` | Inspector component                                                         |
| `apps/web/src/components/staffing/staffing-guide-content.ts`      | Guide content registration                                                  |
| `apps/web/src/components/staffing/auto-suggest-dialog.tsx`        | Auto-suggest review/accept Sheet                                            |
| **Frontend — Hooks**                                              |                                                                             |
| `apps/web/src/hooks/use-master-data.ts`                           | Master data hooks (useServiceProfiles, useDisciplines, useDhgRules)         |
| **Backend — Migration**                                           |                                                                             |
| `apps/api/src/migration/scripts/staffing-data-migration.ts`       | Phase 3 data migration script (populate new Employee fields, seed settings) |
| **Backend — Tests**                                               |                                                                             |
| `apps/api/src/services/staffing/demand-engine.test.ts`            | Demand engine unit tests                                                    |
| `apps/api/src/services/staffing/coverage-engine.test.ts`          | Coverage engine unit tests                                                  |
| `apps/api/src/services/staffing/hsa-engine.test.ts`               | HSA engine unit tests                                                       |
| `apps/api/src/routes/staffing/assignments.test.ts`                | Assignment CRUD route tests                                                 |
| `apps/api/src/routes/staffing/teaching-requirements.test.ts`      | Teaching requirements route tests                                           |

### Modified Files

| Path                                                     | Change                                                                                                                                                                                                                                                                               |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/api/prisma/schema.prisma`                          | Add 9 new models (DhgRule, settings, overrides, assumptions, DemandOverride, StaffingAssignment, TeachingRequirementSource, TeachingRequirementLine, DisciplineAlias) + 2 master data (ServiceObligationProfile, Discipline), extend Employee (6 fields), extend CategoryMonthlyCost |
| `apps/api/src/services/staffing/cost-engine.ts`          | Skip AEFE_RECHARGE, use computed HSA                                                                                                                                                                                                                                                 |
| `apps/api/src/services/staffing/category-cost-engine.ts` | Configurable calculation modes, add pension category                                                                                                                                                                                                                                 |
| `apps/api/src/routes/staffing/calculate.ts`              | New orchestration pipeline (demand → coverage → HSA → cost → category → persist)                                                                                                                                                                                                     |
| `apps/api/src/routes/staffing/employees.ts`              | New fields in request/response, alias resolution on import                                                                                                                                                                                                                           |
| `apps/api/src/routes/staffing/results.ts`                | Add HSA, recharge, H/E, coverage breakdown to summary                                                                                                                                                                                                                                |
| `apps/web/src/pages/planning/staffing.tsx`               | Complete rewrite (enrollment pattern + workspace toggle)                                                                                                                                                                                                                             |
| `apps/web/src/hooks/use-staffing.ts`                     | 14 new hooks + updated Employee types                                                                                                                                                                                                                                                |
| `apps/api/src/routes/versions/clone.ts`                  | Add cloning logic for 6 new version-scoped staffing tables (section 6.14)                                                                                                                                                                                                            |
| `apps/web/src/components/staffing/employee-form.tsx`     | 6 new fields + conditional visibility                                                                                                                                                                                                                                                |

### Deprecated Files (Phase 6 cleanup)

| Path                                                     | Reason                                  |
| -------------------------------------------------------- | --------------------------------------- |
| `apps/web/src/components/staffing/dhg-view.tsx`          | Replaced by teaching-master-grid        |
| `apps/web/src/components/staffing/monthly-cost-grid.tsx` | Replaced by cost columns in master grid |

---

## Appendix A: Teaching Grid Mockup (ASCII)

> **Note:** All values below are illustrative. Exact FTE, cost, and specialist hours depend
> on confirmed DhgRule seed data (see section 19, Implementation Confirmations). Section
> counts are derived from fixture enrollment data: PS=65/24=3, MS=77/24=4, GS=124/24=6.
> Primary specialist hours use placeholder values pending school confirmation.

```text
 Band / Requirement Line          | Units | Hrs/w | Raw FTE | Plan FTE | Pos | Cov FTE | Gap   | Status | Cost    | HSA
 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 MATERNELLE                       |       |       |    TBD  |     TBD  |     |         |       |        |         |  —
   PS Homeroom (PE)               |    3  |  —    |    3.00 |     3.00 |   3 |    3.00 |  0    | Cov    |   435K  |  —
   MS Homeroom (PE)               |    4  |  —    |    4.00 |     4.00 |   4 |    4.00 |  0    | Cov    |   580K  |  —
   GS Homeroom (PE)               |    6  |  —    |    6.00 |     6.00 |   6 |    6.00 |  0    | Cov    |   870K  |  —
   ASEM                           |   13  |  —    |   13.00 |    13.00 |  13 |   13.00 |  0    | Cov    |   555K  |  —
   Arabic (Host Country)          |   —   | TBD   |    TBD  |     TBD  |   1 |    1.00 |  TBD  | TBD    |    72K  |  —
   Islamic (Host Country)         |   —   | TBD   |    TBD  |     TBD  |   1 |    1.00 |  TBD  | TBD    |    72K  |  —
 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 ELEMENTAIRE                      |       |       |    TBD  |     TBD  |     |         |       |        |         |  —
   CP Homeroom (PE)               |    5  |  —    |    5.00 |     5.00 |   5 |    5.00 |  0    |  ●     |   725K  |  —
   CE1 Homeroom (PE)              |    5  |  —    |    5.00 |     5.00 |   5 |    5.00 |  0    |  ●     |   725K  |  —
   CE2 Homeroom (PE)              |    6  |  —    |    6.00 |     6.00 |   6 |    6.00 |  0    |  ●     |   870K  |  —
   CM1 Homeroom (PE)              |    5  |  —    |    5.00 |     5.00 |   5 |    5.00 |  0    |  ●     |   725K  |  —
   CM2 Homeroom (PE)              |    5  |  —    |    5.00 |     5.00 |   5 |    5.00 |  0    |  ●     |   725K  |  —
   English (Specialist)           |   —   | TBD   |    TBD  |     TBD  | TBD |    TBD  |  TBD  |  ●     |   TBD   |  —
   Arabic (Host Country)          |   —   | TBD   |    TBD  |     TBD  | TBD |    TBD  |  TBD  |  ●     |   TBD   |  —
   Islamic (Host Country)         |   —   | TBD   |    TBD  |     TBD  | TBD |    TBD  |  TBD  |  ●     |   TBD   |  —
 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 COLLEGE                          |   —   |       |   34.13 |    31.71 |  35 |   33.00 | +1.29 |        |  5.25M  |  96K
   Français                       |   —   | 108.0 |    6.00 |     5.54 |   6 |    6.00 | +0.46 |  ●     |   980K  |  18K
   Mathématiques                  |   —   |  84.0 |    4.67 |     4.31 |   5 |    4.00 | -0.31 |  ●     |   650K  |  12K
   Histoire-Géographie            |   —   |  72.0 |    4.00 |     3.69 |   4 |    4.00 | +0.31 |  ●     |   650K  |  12K
   Anglais (LV1)                  |   —   |  72.0 |    4.00 |     3.69 |   4 |    3.00 | -0.69 |  ●     |   490K  |  12K
   Physique-Chimie                |   —   |  36.0 |    2.00 |     1.85 |   2 |    2.00 | +0.15 |  ●     |   330K  |   8K
   SVT                            |   —   |  36.0 |    2.00 |     1.85 |   2 |    2.00 | +0.15 |  ●     |   330K  |   8K
   Technologie                    |   —   |  36.0 |    2.00 |     1.85 |   2 |    2.00 | +0.15 |  ●     |   330K  |   8K
   EPS                            |   —   |  96.0 |    4.80 |     4.47 |   5 |    5.00 | +0.53 |  ●     |   815K  |   8K
   Arts Plastiques                |   —   |  24.0 |    1.33 |     1.23 |   2 |    1.00 | -0.23 |  ●     |   165K  |   4K
   Education Musicale             |   —   |  24.0 |    1.33 |     1.23 |   2 |    1.00 | -0.23 |  ●     |   165K  |   4K
   Arabe (Host Country)           |   —   |  48.0 |    2.00 |     2.00 |   2 |    2.00 |  0    |  ●     |   150K  |  —
 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 LYCEE                            |   —   |       |   21.11 |    19.49 |  22 |   20.00 | +0.51 |        |  3.30M  |  62K
   Français (TC)                  |   —   |  48.0 |    2.67 |     2.46 |   3 |    3.00 | +0.54 |  ●     |   490K  |   8K
   Mathématiques (TC)             |   —   |  48.0 |    2.67 |     2.46 |   3 |    3.00 | +0.54 |  ●     |   490K  |   8K
   Maths Spécialité (1ere)        |   —   |  16.0 |    0.89 |     0.82 |   1 |    1.00 | +0.18 |  ●     |   165K  |   4K
   Maths Spécialité (Term)        |   —   |  24.0 |    1.33 |     1.23 |   2 |    1.00 | -0.23 |  ●     |   165K  |   4K
   Philosophie                    |   —   |  32.0 |    1.78 |     1.64 |   2 |    2.00 | +0.36 |  ●     |   330K  |   8K
   ...                            |       |       |         |          |     |         |       |        |         |
 ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
 TOTAL TEACHING                   |       |       |   89.63 |    85.12 |  94 |   89.00 | +3.88 |        | 12.79M  | 158K
                                                                    + Category costs:  1.75M (rempl + form + resident)
                                                                    = GRAND TOTAL:    23.54M
```

**Legend:** Units = sections or groups | Hrs/w = weekly teaching hours | Raw FTE = hours / baseORS |
Plan FTE = hours / effectiveORS | Pos = CEIL(rawFTE) | Cov = covered FTE from assignments |
Gap = covered - planned | ● status dot color: green=covered, red=deficit, amber=surplus

---

## Appendix B: Support & Admin Grid Mockup (ASCII)

```text
 Department / Employee            | Role                  | Status   | FTE  | Monthly  | Annual
 ─────────────────────────────────────────────────────────────────────────────────────────────────
 Administration                   |                       |          |  8.0 |   100K   | 1.20M
   Ahmad Al-Rashid                | Director              | Existing | 1.0  |    18K   |  216K
   Fatima Benali                  | Deputy Director       | Existing | 1.0  |    15K   |  180K
   Sarah Johnson                  | HR Manager            | Existing | 1.0  |    12K   |  144K
   ...                            |                       |          |      |          |
 ─────────────────────────────────────────────────────────────────────────────────────────────────
 Support Services                 |                       |          |  5.0 |    50K   |  600K
   Mohamed Hassan                 | Facilities Manager    | Existing | 1.0  |    10K   |  120K
   ...                            |                       |          |      |          |
 ─────────────────────────────────────────────────────────────────────────────────────────────────
 IT                               |                       |          |  2.0 |    25K   |  300K
   Khalid Omar                    | IT Coordinator        | Existing | 1.0  |    13K   |  156K
   [VACANCY]                      | IT Support            | Vacancy  | 1.0  |    12K   |  144K
 ═════════════════════════════════════════════════════════════════════════════════════════════════
 TOTAL SUPPORT & ADMIN            |                       |          | 15.0 |   175K   | 2.10M
```

---

## Appendix C: Grade-to-Band Mapping

| Grade Code | Display Name        | Band        |
| ---------- | ------------------- | ----------- |
| PS         | Petite Section      | MATERNELLE  |
| MS         | Moyenne Section     | MATERNELLE  |
| GS         | Grande Section      | MATERNELLE  |
| CP         | Cours Préparatoire  | ELEMENTAIRE |
| CE1        | Cours Élémentaire 1 | ELEMENTAIRE |
| CE2        | Cours Élémentaire 2 | ELEMENTAIRE |
| CM1        | Cours Moyen 1       | ELEMENTAIRE |
| CM2        | Cours Moyen 2       | ELEMENTAIRE |
| 6EME       | Sixième             | COLLEGE     |
| 5EME       | Cinquième           | COLLEGE     |
| 4EME       | Quatrième           | COLLEGE     |
| 3EME       | Troisième           | COLLEGE     |
| 2NDE       | Seconde             | LYCEE       |
| 1ERE       | Première            | LYCEE       |
| TERM       | Terminale           | LYCEE       |

---

## Appendix D: Calculation Formulas Summary

| Formula                                                                    | Application                                                            |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `sectionsNeeded = CEIL(headcount / maxClassSize)`                          | All grade levels                                                       |
| `totalWeeklyHours = driverUnits × hoursPerUnit`                            | All requirement sources                                                |
| `requiredFteRaw = totalWeeklyHours / baseORS`                              | HOURS and GROUP driver types                                           |
| `requiredFteRaw = totalDriverUnits`                                        | SECTION driver type (1:1)                                              |
| `effectiveORS = baseORS + hsaTargetHours`                                  | HSA-eligible profiles only                                             |
| `requiredFtePlanned = totalWeeklyHours / effectiveORS`                     | HSA-eligible HOURS/GROUP lines                                         |
| `recommendedPositions = CEIL(requiredFteRaw)`                              | Per-line hiring guidance                                               |
| `gapFte = coveredFte - requiredFteRaw`                                     | Coverage analysis (uses raw FTE, not HSA-adjusted)                     |
| `hsaCostPerMonth = firstHourRate + max(0, hsaTarget - 1) × additionalRate` | Per HSA-eligible teacher                                               |
| `hsaAnnual = hsaCostPerMonth × hsaMonths`                                  | Excludes Jul-Aug                                                       |
| `categoryCost_FLAT = value / 12`                                           | FLAT_ANNUAL mode                                                       |
| `categoryCost_PCT = subtotalGross × rate`                                  | PERCENT_OF_PAYROLL mode (subtotalGross = LOCAL_PAYROLL employees only) |
| `categoryCost_FTE = (value × totalFteRaw) / 12`                            | AMOUNT_PER_FTE mode (uses raw FTE, not HSA-adjusted)                   |

---

_End of spec. All design decisions resolved. See [Section 19](#19-open-questions) for the
resolved decisions summary and 9 remaining implementation confirmations._
