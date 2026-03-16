# ADR-029: Flat Discount Model for Revenue Settings

**Status:** Accepted
**Date:** 2026-03-15
**Epic:** #197 (Revenue Page - Enrollment Parity & Fee Grid Redesign)

## Context

EFIR's operational model applies a single uniform discount across all students rather than per-tariff (RP/R3+) discount rates. The existing `DiscountPolicy` model stores per-tariff/nationality rates, but the school never configures different rates by tariff. This added unnecessary complexity to the Revenue Settings UI (a full tariff assignment tab + per-tariff discount grid) and confused users.

## Decision

### AD-1: Storage

Add `flatDiscountPct DECIMAL(7,6) DEFAULT 0` to the existing `VersionRevenueSettings` model. This is a single scalar field per version, reusing the existing settings GET/PUT routes and hooks. Existing `DiscountPolicy` rows remain untouched for backward compatibility.

### AD-2: Engine Algorithm

When `flatDiscountPct > 0`, the engine applies it uniformly to all students:

```text
grossTuitionHt = pleinTuitionHt
discountPerStudentHt = grossTuitionHt * flatDiscountPct
netTuitionHt = grossTuitionHt * (1 - flatDiscountPct)
```

When `flatDiscountPct === 0`, fall back to existing per-tariff `DiscountPolicy` logic for backward compatibility with legacy versions.

### AD-3: Tariff Assignment Removal

The engine already falls back to Plein fees via `makePleinFeeKey()`. With the flat discount model, this fallback becomes the primary path. Enrollment details retain their tariff values for historical reporting. No data migration needed.

### AD-4: Revenue Readiness Simplification

Readiness reduced from 5 areas to 3: Fee Grid (includes settings existence check), Discounts (always ready when settings exist, since 0% is valid), Other Revenue. The `tariffAssignment` and `derivedRevenueSettings` areas are removed.

## Consequences

- Simpler UI: 3 tabs instead of 4, single discount input instead of per-tariff grid
- Backward compatible: legacy versions with RP/R3+ data continue to calculate correctly
- Prior-year comparison enabled via new `GET /fee-grid/prior-year` endpoint
- `tariff-assignment-grid.tsx` deleted (287 lines removed)
- Frontend `FeeEditability` union narrowed from 4 to 3 values (removed `mixed-value`)

## Alternatives Considered

1. **Migrate all DiscountPolicy rows to flat rate** - Rejected: would break historical versions
2. **Keep per-tariff UI but default to uniform** - Rejected: adds unnecessary complexity for a feature EFIR never uses
3. **Remove tariff from enrollment entirely** - Rejected: tariff remains a valid reporting dimension
