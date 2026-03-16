# Epic 17 Revenue Remediation Note

## Baseline

Epic 17 remediation started from a partially complete Revenue parity implementation with six release-risk blockers:

1. Period state changed visible columns without scoping the underlying Revenue data query.
2. Selection, panel, and filter state could diverge and leave stale inspector context.
3. `PlanningGrid` did not fully honor the read-only grid accessibility contract.
4. The fee-grid redesign reflected workbook surface shape more than workbook business semantics.
5. The Revenue inspector and merged settings flow were structurally present but behaviorally incomplete.
6. Tests were green while still encoding several pre-remediation contracts.

## Remediation focus

The first implementation waves prioritized truthfulness and state integrity before polish:

- make Revenue queries period-aware
- centralize visible-row filtering and total-label semantics
- synchronize selection, filters, period changes, and right-panel lifecycle
- finish core `PlanningGrid` grid semantics used by Revenue
- rebuild the fee-schedule builder/writeback path around safer editability rules
- harden targeted Revenue tests before running full repo gates

## Exit criteria for this remediation pass

This pass is considered complete only when:

- repo typecheck, lint, and tests pass
- Revenue-specific targeted tests validate the new contracts
- the runtime UI is checked visually against Enrollment for the core Revenue states
- no workbook-specific hardcoding is introduced to achieve parity
