# ADR-031: DHG Module Absorption into STAFFING

## Status

Accepted — Remediation Complete (2026-03-18)

## Date

2026-03-18

## Context

The original BudFin architecture (Epics 3-4) treated DHG (Dotation Horaire Globale) as a separate
calculation module with its own stale-module flag, route prefix, and UI indicators. When enrollment
data changed, the system marked `DHG` stale as a distinct step in the propagation chain:

```text
ENROLLMENT -> REVENUE -> DHG -> STAFFING -> PNL
```

The staffing redesign (Epics 18-20) introduced a comprehensive teaching-requirement model that
subsumes DHG: DhgRule master data drives a demand engine that computes TeachingRequirementLine
rows, which are then used for coverage analysis, assignment management, and cost calculations.
DHG is no longer a separate module — it is an input layer to the STAFFING calculation pipeline.

Maintaining DHG as a separate stale-module concept created several problems:

1. **Semantic pollution**: The frontend showed "DHG stale" indicators for a module that users
   no longer interact with directly.
2. **Stale chain ambiguity**: Enrollment changes marked both DHG and STAFFING stale, but only
   STAFFING recalculation existed. DHG had no independent recalculation path.
3. **Code maintenance burden**: Four enrollment route files and the shared types package carried
   DHG-specific stale-module constants that served no runtime purpose.

## Decision

Remove `'DHG'` from all stale-module constant arrays. The stale propagation chain becomes:

```text
ENROLLMENT -> REVENUE -> STAFFING -> PNL
```

The DHG route, view component, and frontend hooks/types are removed. The DhgRule model,
DhgGrilleConfig model, calculation engine, and migration importers remain — they serve
the demand engine and historical data bootstrapping respectively.

## Stale Propagation Rules (Post-Remediation)

- **Enrollment mutations** mark: `ENROLLMENT`, `REVENUE`, `STAFFING`, `PNL`
- **Staffing settings/assignment mutations** mark: `STAFFING` only
- **Staffing recalculation** clears `STAFFING`, adds `PNL`
- **Revenue recalculation** clears `REVENUE`

## Consequences

### Positive

- Cleaner stale-module semantics — every module in the chain has a corresponding recalculation
  action and UI workspace.
- Simpler status strip and version-detail indicators — no phantom DHG warnings.
- Reduced cognitive load for users who never knew what "DHG" meant in the UI.

### Negative

- None. The legacy read-only endpoint was removed as part of remediation.

### Neutral

- The DhgRule model name retains "Dhg" as a domain abbreviation. This is acceptable because
  DHG (Dotation Horaire Globale) is the correct French term for the teaching-hour allocation
  framework used by AEFE schools.

## Remediation Outcome

The following changes were applied to complete the DHG absorption:

### Removed

- **`dhg-grille.ts` route** — removed from the staffing route index; no longer registered.
- **`dhg-view.tsx` component** — deleted; the DHG tab no longer exists in the staffing UI.
- **DHG hooks/types in `use-staffing.ts`** — frontend query hooks and associated types for the
  DHG grille endpoint removed.

### Retained

- **`dhg-engine.ts`** — still used by the demand calculation pipeline (Step 2 of STAFFING
  recalculation). Not dead code.
- **DHG migration importers** (`apps/api/src/migration/`) — one-shot bootstrap tooling for
  historical DHG data. Not called by any live route.

### Fixed During Remediation

- **Clone test `lineType`** — changed `'DHG'` to `'STRUCTURAL'` to reflect valid line types
  after DHG removal.
- **Backend response wrappers** — staffing endpoints aligned from named keys (e.g.,
  `{ employees: [...] }`) to the `{ data: T }` convention used by the rest of the API.
- **Frontend type alignment** — staffing types updated to match backend field names (removed
  stale/mismatched property mappings).
- **HSA clearing bug** — fixed incorrect HSA (Housing/School Allowance) values persisting for
  non-eligible employees during cost calculation.
- **Stale-module arrays** — verified clean; no `'DHG'` references remained in any stale-module
  constant.

## Alternatives Considered

1. **Keep DHG as a pass-through stale module**: Mark DHG stale on enrollment changes, auto-clear
   it when STAFFING recalculates. Rejected because it adds complexity with no user-visible benefit.

2. **Rename DHG to DEMAND**: Rename the stale module from DHG to DEMAND to represent the demand
   engine phase. Rejected because the demand engine is not independently recalculable — it runs
   as Step 2 of the STAFFING calculation pipeline.
