# Feature Spec: DHG & Staffing Foundations

> Epic: #210 | Phase: 4 — SPECIFY | Status: Draft | Date: 2026-03-17
> Source Plan: `docs/plans/2026-03-17-dhg-staffing-redesign.md`

## Summary

Epic 18 delivers the foundational data model, master data taxonomies, demand calculation engine,
and settings API for the redesigned staffing module. It introduces controlled discipline and
service profile catalogs, replaces the flat `DhgGrilleConfig` with the richer `DhgRule` rule
catalog, implements a pure-function demand engine with variable ORS and multi-driver support
(SECTION/HOURS/GROUP), and exposes all staffing settings and master data through versioned CRUD
routes. After this epic ships, the system can compute teaching requirement lines from enrollment
and curriculum rules, and budget planners can configure staffing parameters. References plan
sections 6 (Data Model), 7.1 (Demand Engine), 8.1/8.3 (API Routes), and 15 (Migration Strategy
phases 1-3).

## Acceptance Criteria

- [ ] AC-01: 4 new master-data models (`ServiceObligationProfile`, `Discipline`, `DisciplineAlias`, `DhgRule`) with correct schemas, indexes, and relations
- [ ] AC-02: 7 version-scoped models (`VersionStaffingSettings`, `VersionServiceProfileOverride`, `VersionStaffingCostAssumption`, `VersionLyceeGroupAssumption`, `DemandOverride`, `TeachingRequirementSource`, `TeachingRequirementLine`) with compound unique constraints
- [ ] AC-03: `Employee` extended with `recordType`, `costMode`, `disciplineId`, `serviceProfileId`, `homeBand`, `contractEndDate` (all nullable/defaulted — no NOT NULL violations on existing data)
- [ ] AC-04: `CategoryMonthlyCost` extended with `calculationMode` (default `PERCENT_OF_PAYROLL`)
- [ ] AC-05: 7 service profiles seeded with correct weekly hours and HSA eligibility (PE=24h, CERTIFIE=18h, AGREGE=15h, EPS=20h, ARABIC_ISLAMIC=24h, ASEM=0h, DOCUMENTALISTE=30h; HSA-eligible: CERTIFIE, AGREGE, EPS only)
- [ ] AC-06: All disciplines seeded with correct category values (SUBJECT/ROLE/POOL); aliases seeded for known variant spellings
- [ ] AC-07: `DhgGrilleConfig` rows migrated to `DhgRule` with resolved lineType, driverType, serviceProfileId, disciplineId; migration is idempotent
- [ ] AC-08: Given enrollment data and DhgRules, when the demand engine runs, then it produces requirement sources per (grade, discipline, lineType) with correct driver semantics: SECTION driver yields `driverUnits = sections`, `requiredFteRaw = totalDriverUnits` (1:1); HOURS driver yields `requiredFteRaw = totalWeeklyHours / baseOrs`; GROUP driver uses `VersionLyceeGroupAssumption` when present, fallback to `DhgRule.hoursPerUnit`
- [ ] AC-09: Given requirement sources, when aggregated, then lines are produced by `(band, disciplineCode, lineType)` via `gradeToBand` mapping
- [ ] AC-10: Given an HSA-eligible service profile, when computing effective ORS, then `effectiveOrs = baseOrs + hsaTargetHours`; non-eligible profiles use `baseOrs` only
- [ ] AC-11: Given valid auth with `data:view`, when calling any settings or master data GET route, then the response returns correct data; given `data:edit`, when calling PUT, then settings are updated
- [ ] AC-12: Given a settings mutation (PUT), when the update completes, then `STAFFING` is added to `BudgetVersion.staleModules`
- [ ] AC-13: Given a GET request to master data routes, when querying dhg-rules with a year parameter, then only rules within the effective year range are returned
- [ ] AC-14: Given calculated teaching requirements exist, when calling GET teaching-requirements, then lines are returned with lightweight assigned employee data; given requirements are stale, then 409 Conflict is returned
- [ ] AC-15: Given existing employees, when the data migration runs, then `recordType`, `costMode`, `serviceProfileId`, `disciplineId`, and `homeBand` are populated via heuristic mapping; unmappable employees are logged to an exception queue
- [ ] AC-16: Given existing database with employees and versions, when running `prisma migrate dev`, then migration completes with zero errors and no data loss

## Stories

| #   | Story                                                                        | Depends On       | GitHub Issue |
| --- | ---------------------------------------------------------------------------- | ---------------- | ------------ |
| 1   | Prisma Schema Migration — Master Data Models                                 | —                | #211         |
| 2   | Prisma Schema Migration — Version-Scoped Models and Employee Extensions      | Story 1          | #212         |
| 3   | Seed Master Data — Service Profiles, Disciplines, Aliases, DhgRule Migration | Story 1          | #213         |
| 4   | Demand Engine — Pure Function Implementation                                 | Story 1          | #215         |
| 5   | Staffing Settings and Master Data API Routes                                 | Story 2, Story 3 | #217         |
| 6   | Data Migration Script — Employee Field Population and Version Settings Seed  | Story 2, Story 3 | #219         |

## Data Model Changes

### New Master Data Models (plan section 6)

- `ServiceObligationProfile`: code (unique), name, weeklyServiceHours (Decimal), hsaEligible (Boolean), defaultCostMode (enum), sortOrder (Int), audit fields (createdAt, updatedAt, createdBy, updatedBy)
- `Discipline`: code (unique), name, category (enum: SUBJECT/ROLE/POOL), sortOrder (Int), audit fields
- `DisciplineAlias`: alias (unique), disciplineId FK -> Discipline
- `DhgRule`: gradeLevel (String), disciplineId FK -> Discipline, lineType (enum: STRUCTURAL/HOST_COUNTRY/AUTONOMY/SPECIALTY), driverType (enum: SECTION/HOURS/GROUP), hoursPerUnit (Decimal), serviceProfileId FK -> ServiceObligationProfile, languageCode (String?), groupingKey (String?), effectiveFromYear (Int), effectiveToYear (Int?), audit fields (createdAt, updatedAt). Compound unique index on `(gradeLevel, disciplineId, lineType, languageCode, effectiveFromYear)`. Indexes on `gradeLevel` and `effectiveFromYear`.

### New Version-Scoped Models (plan sections 6.5-6.12)

- `VersionStaffingSettings`: versionId FK (unique), hsaTargetHours (Decimal, default 1.5), hsaFirstHourRate (Decimal, default 500), hsaAdditionalHourRate (Decimal, default 400), hsaMonths (Int, default 10), academicWeeks (Int, default 36), ajeerAnnualLevy (Decimal, default 9500), ajeerMonthlyFee (Decimal, default 160), reconciliationBaseline (Json?), audit fields (createdAt, updatedAt)
- `VersionServiceProfileOverride`: unique (versionId, serviceProfileId), weeklyServiceHoursOverride (Decimal?), hsaEligibleOverride (Boolean?)
- `VersionStaffingCostAssumption`: unique (versionId, category), calculationMode (enum: FLAT_ANNUAL/PERCENT_OF_PAYROLL/AMOUNT_PER_FTE), value (Decimal)
- `VersionLyceeGroupAssumption`: unique (versionId, gradeLevel, disciplineId), groupCount (Int), hoursPerGroup (Decimal)
- `DemandOverride`: unique (versionId, band, disciplineId, lineType), overrideFte (Decimal), reasonCode (String), note (String?)
- `TeachingRequirementSource`: unique (versionId, gradeLevel, disciplineId, lineType), driverType (enum), headcount (Int), maxClassSize (Int), driverUnits (Int), hoursPerUnit (Decimal), totalWeeklyHours (Decimal), calculatedAt (DateTime)
- `TeachingRequirementLine`: unique (versionId, band, disciplineCode, lineType), lineLabel (String), driverType (enum), serviceProfileCode (String), totalDriverUnits (Int, default 0), totalWeeklyHours (Decimal), baseOrs (Decimal), effectiveOrs (Decimal), requiredFteRaw (Decimal), requiredFtePlanned (Decimal), recommendedPositions (Int), coveredFte (Decimal, default 0), gapFte (Decimal, default 0), coverageStatus (String, default 'UNCOVERED'), assignedStaffCount (Int, default 0), vacancyCount (Int, default 0), directCostAnnual (Decimal, default 0), hsaCostAnnual (Decimal, default 0), calculatedAt (DateTime)

### Extended Models

- `Employee`: +recordType (String?, default 'EMPLOYEE'), +costMode (String?, default 'LOCAL_PAYROLL'), +disciplineId (Int? FK -> Discipline), +serviceProfileId (Int? FK -> ServiceObligationProfile), +homeBand (String?), +contractEndDate (DateTime?)
- `CategoryMonthlyCost`: +calculationMode (String, default 'PERCENT_OF_PAYROLL')
- `BudgetVersion`: relation fields for all new version-scoped models

### Deprecated (not dropped)

- `DhgGrilleConfig` — replaced by `DhgRule`; marked `@deprecated` in schema comments
- `DhgRequirement` — replaced by `TeachingRequirementLine`; marked `@deprecated` in schema comments

## API Endpoints

### Settings Routes (version-scoped, prefix: `/api/v1/versions/:versionId`)

| Method | Path                                 | Request                                                                                                                          | Response                                                            | Auth      |
| ------ | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | --------- |
| GET    | `/staffing-settings`                 | —                                                                                                                                | `VersionStaffingSettings` (auto-creates defaults if missing)        | data:view |
| PUT    | `/staffing-settings`                 | `{ hsaTargetHours?, hsaFirstHourRate?, hsaAdditionalHourRate?, hsaMonths?, academicWeeks?, ajeerAnnualLevy?, ajeerMonthlyFee? }` | Updated settings                                                    | data:edit |
| GET    | `/service-profile-overrides`         | —                                                                                                                                | `VersionServiceProfileOverride[]`                                   | data:view |
| PUT    | `/service-profile-overrides`         | `{ overrides: [{ serviceProfileId, weeklyServiceHoursOverride?, hsaEligibleOverride? }] }`                                       | Updated overrides                                                   | data:edit |
| GET    | `/cost-assumptions`                  | —                                                                                                                                | `VersionStaffingCostAssumption[]`                                   | data:view |
| PUT    | `/cost-assumptions`                  | `{ assumptions: [{ category, calculationMode, value }] }`                                                                        | Updated assumptions                                                 | data:edit |
| GET    | `/lycee-group-assumptions`           | —                                                                                                                                | `VersionLyceeGroupAssumption[]`                                     | data:view |
| PUT    | `/lycee-group-assumptions`           | `{ assumptions: [{ gradeLevel, disciplineId, groupCount, hoursPerGroup }] }`                                                     | Updated assumptions                                                 | data:edit |
| GET    | `/demand-overrides`                  | —                                                                                                                                | `DemandOverride[]`                                                  | data:view |
| PUT    | `/demand-overrides`                  | `{ overrides: [{ band, disciplineId, lineType, overrideFte, reasonCode, note? }] }`                                              | Updated overrides                                                   | data:edit |
| DELETE | `/demand-overrides/:id`              | —                                                                                                                                | `{ success: true }`                                                 | data:edit |
| GET    | `/teaching-requirements`             | —                                                                                                                                | `TeachingRequirementLine[]` with `assignedEmployees` (409 if stale) | data:view |
| GET    | `/teaching-requirement-sources`      | —                                                                                                                                | `TeachingRequirementSource[]`                                       | data:view |
| GET    | `/teaching-requirements/:id/sources` | —                                                                                                                                | `TeachingRequirementSource[]` for specific line (inspector detail)  | data:view |

### Master Data Routes (global, prefix: `/api/v1/master-data`)

| Method | Path                | Request                               | Response                                      | Auth      |
| ------ | ------------------- | ------------------------------------- | --------------------------------------------- | --------- |
| GET    | `/service-profiles` | —                                     | `ServiceObligationProfile[]`                  | data:view |
| GET    | `/disciplines`      | `?category=SUBJECT` (optional filter) | `Discipline[]` with aliases                   | data:view |
| GET    | `/dhg-rules`        | `?year=2026` (optional year filter)   | `DhgRule[]` with discipline and profile joins | data:view |

## UI/UX Specification

N/A — backend-only epic. All frontend components are deferred to Epic 20.

## Edge Cases Cross-Reference

| Case ID | Description                                    | Handling                                                                                                                                       |
| ------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| DA-003  | AEFE curriculum requirements may not be stable | DhgRule uses `effectiveFromYear`/`effectiveToYear` range to support curriculum changes across years without breaking existing versions         |
| DA-008  | YEARFRAC on edge dates                         | Employee `contractEndDate` field is nullable; cost engine (Epic 19) handles YEARFRAC — this epic only stores the field                         |
| DA-009  | Zero enrollment breaks calculations            | Demand engine omits zero-demand lines from requirement lines (retained in sources for audit); division-by-zero guard for ORS=0 profiles (ASEM) |
| DA-010  | Cascading recalculations and precision         | Settings mutations mark STAFFING stale; chain ENROLLMENT -> REVENUE -> STAFFING -> PNL enforced                                                |
| SA-001  | Floating-point precision loss                  | Demand engine uses `Decimal.js` for all FTE arithmetic (TC-001); database stores as `DECIMAL(15,4)`                                            |
| SA-021  | Data migration validation                      | Migration script includes exception queue for unmappable employees, verification queries, dry-run mode, and full transaction rollback          |
| SA-010  | Orphan records on cascade delete               | New FK relations use appropriate cascade/restrict policies; deprecated models not dropped to prevent orphans                                   |

## Out of Scope

- `StaffingAssignment` model and CRUD (deferred to Epic 19 Story 19-1)
- Coverage engine (Epic 19)
- HSA cost engine (Epic 19)
- Cost engine modifications (Epic 19)
- Frontend components — grids, inspector, settings sheet (Epic 20)
- Calculation orchestration pipeline (Epic 19)
- Version clone support for new tables (Epic 19)
- P&L integration

## Open Questions

None — all design decisions resolved in the source plan (sections D1-D7).

## Planner Agent Sign-Off

- [ ] No open questions
- [ ] Acceptance criteria are testable
- [ ] Edge cases cross-referenced
- [ ] Data model complete
- [ ] API contract complete
- [ ] UI/UX specification complete (or "N/A — backend-only epic")
