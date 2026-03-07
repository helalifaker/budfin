# BudFin 360° Alignment Review

**Reviewed corpus:** PRD v2.0, TDD/SAD split set (`README.md`, `01_overview.md` to `10_traceability_matrix.md`), and `stack-versions.md`  
**Review objective:** End-to-end alignment across product scope, architecture, design, security, data model, API contract, infrastructure, testing, roadmap, and implementation traceability  
**Review assumption:** Epic 13, Epic 11, Epic 7, Epic 10, and Epic 1 are already implemented and should be treated as **implemented baseline**, not future roadmap items.

---

## 1. Executive Summary

### Overall verdict

The BudFin document set is **architecturally strong and substantially aligned at the solution-design level**, but it is **not yet fully aligned as a controlled, implementation-aware documentation system**.

In practical terms:

- The **product vision, target architecture, technical stack, core module boundaries, version-management model, and non-functional intent** are largely coherent across PRD and TDD.
- The documentation also shows **strong traceability discipline**, especially through the traceability matrix and the split TDD structure.
- However, there are still several **authoritative-source collisions** between the PRD, TDD, roadmap, infrastructure, and implementation status.
- The most important issues are **not conceptual architecture flaws**; they are **document-control, contract-consistency, and as-built vs. baseline synchronization gaps**.

### Bottom-line conclusion

BudFin is **close to full documentation alignment on architecture and requirements**, but it is **not yet at “single source of truth” maturity**. The current state is best described as:

- **Architecture alignment:** Strong
- **Requirements-to-design traceability:** Strong
- **Implementation-status alignment:** Partial
- **Document governance alignment:** Weak to moderate
- **Operational contract alignment:** Moderate

### Most important conclusion for decision-making

The next documentation cycle should **not** focus on redesigning the system. It should focus on:

1. **Re-baselining authoritative sources**
2. **Reconciling conflicting contracts**
3. **Separating baseline plan from actual implementation status**
4. **Publishing an “as-built aligned set”**

That will materially increase execution clarity, auditability, onboarding quality, and confidence for the remaining epics.

---

## 2. Review Method

This review assessed the corpus across nine lenses:

1. **Document governance and source-of-truth clarity**
2. **Business-to-product alignment**
3. **PRD-to-TDD architectural alignment**
4. **Data model and schema alignment**
5. **API/security contract alignment**
6. **Infrastructure and deployment alignment**
7. **Testing, NFR, and traceability alignment**
8. **Roadmap-to-reality alignment**
9. **Role / persona / RBAC alignment**

The review also treated implementation evidence as materially important, because the traceability matrix explicitly confirms passing implementation traceability for the already-completed epics.

---

## 3. High-Level Alignment Scorecard

| Dimension                             | Assessment           | Commentary                                                                                                                  |
| ------------------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Product vision vs architecture        | **Strong**           | The monolithic SPA + REST API architecture is appropriate for the EFIR single-school scope and 20-user ceiling.             |
| PRD vs TDD structural consistency     | **Strong**           | The TDD generally translates PRD intent into components, schema, API, security, infrastructure, tests, and roadmap cleanly. |
| Requirements traceability             | **Strong**           | The traceability matrix is mature and one of the strongest assets in the set.                                               |
| Implemented-epic evidence alignment   | **Strong**           | Implemented epics are explicitly marked PASS in the traceability matrix.                                                    |
| Data model consistency                | **Moderate**         | One major PRD inconsistency on `budget_versions.data_source`; some conceptual-vs-physical ambiguity remains.                |
| API/security contract consistency     | **Moderate**         | Authentication lockout behavior and JWT payload definition are not fully synchronized.                                      |
| Infrastructure / operations alignment | **Moderate**         | Core design is coherent, but operational targets in the PRD do not always match the actual deployment model in the TDD.     |
| Roadmap / delivery alignment          | **Weak to Moderate** | The roadmap is still a baseline plan, not an implementation-aware live delivery view.                                       |
| Document governance                   | **Weak to Moderate** | Multiple files still say Draft, while `stack-versions.md` claims adopted canonical authority.                               |

---

## 4. What Is Well Aligned

## 4.1 Architecture choice is coherent and appropriate

The architecture style is consistent with the business context:

- single-school deployment
- no multi-tenant requirement
- low concurrency profile
- tight calculation-chain coupling
- strong need for transactional integrity

The monolithic SPA + REST API model, PostgreSQL persistence, and Docker Compose deployment are proportionate to the problem and avoid unnecessary distributed-system complexity.

**Why this matters:** this is the right kind of architecture for BudFin v1. It is not over-engineered.

---

## 4.2 Version-management model is one of the strongest aligned areas

The documents are broadly aligned on the following concepts:

- Version types: Actual / Budget / Forecast
- Version lifecycle: Draft / Published / Locked / Archived
- Actuals and planning data following different data paths
- Period locking via `fiscal_periods`
- Latest Estimate as hybrid actuals + forecast logic
- Cross-version comparison with variance behavior

This is not only well-designed; it is also well-traced across PRD, TDD, API, data model, and roadmap.

---

## 4.3 NFRs and testing strategy are unusually mature

The document set is strong on measurable targets and testability:

- performance targets are quantified
- CI gates are explicit
- Excel regression tolerance is defined
- build-blocking quality thresholds are specified
- migration validation and parallel run are documented
- risk-based mitigation exists in the PRD and roadmap

This is a major strength and significantly reduces ambiguity for engineering and QA.

---

## 4.4 Traceability discipline is a major asset

The traceability matrix is a standout strength. It creates a clear bridge between:

- functional requirements
- TDD sections
- components
- endpoints
- tables
- test types
- implementation evidence

This is exactly the right control layer for a calculation-heavy finance system.

---

## 4.5 Implemented epics are evidenced, not merely assumed

The traceability matrix explicitly confirms that the already-implemented epics are passing their implementation traceability sections:

- **Infrastructure & CI/CD (Epic 13): All PASS**
- **Authentication & RBAC (Epic 11): All PASS**
- **Master Data Management (Epic 7): All PASS**
- **Version Management (Epic 10): All PASS**
- **Enrollment & Capacity (Epic 1): All PASS**

**Evidence:** `10_traceability_matrix.md:425-432`

This is important because it means the review should **not** treat those areas as greenfield design. They are already in an **as-built** state and should now be documented as such.

---

## 5. Material Misalignments Requiring Remediation

Below are the material issues that prevent full alignment.

## 5.1 Document-control state is not synchronized

### Finding

Several core files still present the TDD as **Draft**, while `stack-versions.md` declares itself **Adopted** and the canonical source of truth for versions.

### Evidence

- `README.md:5-8` → TDD status = **Draft**
- `01_overview.md:7-10` → status = **Draft**, author still “to be assigned”
- `03_data_architecture.md:5-8` → status = **Draft**
- `stack-versions.md:3-7` → version 1.2, **Adopted**, canonical source of truth
- PRD is already marked frozen baseline

### Why this matters

This creates governance ambiguity:

- Is the TDD draft or adopted?
- Which file is authoritative when there is conflict?
- Can implementation teams safely treat the current set as baselined?

### Severity

**High**

### Required action

Publish a formal document-governance hierarchy, for example:

1. **PRD v2.0** = frozen product baseline
2. **TDD v1.x as-built set** = authoritative technical implementation baseline
3. **stack-versions.md** = authoritative for runtime/package versions only
4. All TDD files updated from Draft → Approved / Baseline / As-Built as applicable

---

## 5.2 The roadmap is not rebaselined to implemented reality

### Finding

The roadmap still reads as a complete future delivery plan even though the traceability matrix confirms several epics are already implemented and passing.

### Evidence

- `08_implementation_roadmap.md:1-4` → full 35-week baseline roadmap
- `10_traceability_matrix.md:425-432` → implemented epics explicitly PASS

### Why this matters

This creates delivery confusion:

- The roadmap shows future work for items already built
- Reviewers cannot easily distinguish baseline plan vs actual delivery progress
- Governance and PMO views will diverge from engineering reality

### Severity

**High**

### Required action

Split roadmap into two layers:

- **Baseline roadmap** (original planned sequence)
- **Current delivery status / as-built tracker**

At minimum, annotate each completed epic with:

- status = implemented
- evidence reference
- remaining hardening work, if any

---

## 5.3 Frontend routing version mismatch

### Finding

The roadmap still specifies **React Router v6**, while the version manifest defines **react-router ^7.13.0** as the canonical package version.

### Evidence

- `08_implementation_roadmap.md:68` → React Router v6
- `stack-versions.md:79` → `react-router ^7.13.0`

### Why this matters

This is a classic documentation drift signal. It is not a major architectural problem, but it proves that the roadmap is outdated as a technical reference.

### Severity

**Medium**

### Required action

Update all roadmap and setup references to match the adopted version manifest.

---

## 5.4 Authentication lockout contract is inconsistent

### Finding

The documents disagree on both the **status code** and the **audit operation name** for account lockout.

### Evidence

- `02_component_design.md:74` → lockout audit op = `ACCOUNT_LOCKOUT`, response = **HTTP 423**
- `05_security.md:68-81` → lockout audit op = `ACCOUNT_LOCKED`, response = **HTTP 401**
- `04_api_contract.md:135` → `401 ACCOUNT_LOCKED`

### Why this matters

This is a real interface-contract issue, not a cosmetic one. It affects:

- frontend error handling
- integration tests
- audit-log consistency
- security documentation

### Severity

**High**

### Required action

Pick one canonical contract and update all documents. The most internally consistent current choice appears to be:

- **HTTP 401**
- error code = `ACCOUNT_LOCKED`
- audit operation = `ACCOUNT_LOCKED`

Then update component design accordingly.

---

## 5.5 JWT payload definition is inconsistent

### Finding

The component design requires a `sessionId` in the JWT payload, but the API and security examples omit it.

### Evidence

- `02_component_design.md:32-38` → `JwtPayload` includes `sessionId`
- `04_api_contract.md:72-81` → JWT example omits `sessionId`
- `05_security.md:16-25` → JWT example omits `sessionId`

### Why this matters

This matters because session-level security and audit traceability appear to depend on session identity elsewhere in the design. If `sessionId` is operationally important, the API/security contract must show it. If not, component design must be simplified.

### Severity

**High**

### Required action

Ratify one of the following:

- **Option A:** JWT includes `sessionId`; update API/security payload examples and validation logic
- **Option B:** session identity is maintained outside the access token; remove `sessionId` from component-contract assumptions and explain how audit/session linkage is done

---

## 5.6 PRD is internally inconsistent on `budget_versions.data_source`

### Finding

The PRD contains two incompatible definitions for `budget_versions.data_source`.

### Evidence

- `BudFin_PRD_v2.0.md:623` → Actual = `IMPORTED`; Budget/Forecast = `CALCULATED`
- `BudFin_PRD_v2.0.md:1116` → `ENUM('MANUAL','IMPORTED') DEFAULT 'MANUAL'`
- `BudFin_PRD_v2.0.md:1170` → `CALCULATED` or `IMPORTED`

### Why this matters

This is one of the most important alignment defects in the full set because it directly impacts:

- lifecycle rules
- import/calculate guards
- DB semantics
- API validation
- migration logic

### Severity

**Critical**

### Required action

The PRD must be corrected so that `data_source` has one single definition everywhere. Based on the TDD and the version-management logic, the correct value set appears to be:

- `CALCULATED`
- `IMPORTED`

The older `MANUAL` definition should be removed or explicitly deprecated.

---

## 5.7 PRD data dictionary and TDD physical schema are not cleanly separated

### Finding

The PRD data dictionary is partly conceptual and partly physical, and some elements do not match the TDD physical schema exactly.

### Symptoms

- PRD uses schema-like constructs that look physical
- PRD includes the outdated `MANUAL`/`IMPORTED` definition
- TDD Section 5 is clearly the true physical DDL authority

### Why this matters

This creates ambiguity for developers and reviewers over which document governs database implementation.

### Severity

**High**

### Required action

State explicitly:

- **PRD Section 9 = logical/conceptual data model only**
- **TDD Section 5 = authoritative physical schema / implementation DDL**

Then remove or soften physical-schema wording from the PRD where needed.

---

## 5.8 Health endpoint contract is inconsistent

### Finding

The PRD defines the health endpoint as `GET /health`, while infrastructure and deployment checks consistently use `/api/v1/health`.

### Evidence

- `BudFin_PRD_v2.0.md:1572` → `GET /health`
- `06_infrastructure.md:53-55` → container healthcheck uses `/api/v1/health`
- `06_infrastructure.md:145-160` (observability section) also references `/api/v1/health`

### Why this matters

This affects monitoring, DevOps setup, API documentation, and test automation.

### Severity

**Medium**

### Required action

Standardize on one public contract. Given the rest of the API design, `/api/v1/health` is likely the right choice.

---

## 5.9 Deployment strategy target does not match actual deployment design

### Finding

The PRD requires **zero-downtime deployment capability (rolling or blue-green)**, but the TDD infrastructure describes a single-server Docker Compose deployment with manual failover and rollback.

### Evidence

- `BudFin_PRD_v2.0.md:1564` → zero-downtime deployment capability
- `06_infrastructure.md:5-15` → single-host 3-service Compose stack
- `06_infrastructure.md:152-177` and HA/DR section → manual active-passive failover / manual rollback model

### Why this matters

This is a strategy-level mismatch. The current v1 infrastructure does not credibly support true zero-downtime deployment in the way the PRD describes.

### Severity

**High**

### Required action

Choose one of two paths:

- **Path A (recommended for v1):** downgrade PRD wording to controlled deployment + tested rollback + acceptable RTO/RPO
- **Path B:** materially redesign deployment for blue-green / rolling capability

For BudFin v1, Path A is more realistic and more aligned with the single-school scope.

---

## 5.10 Encryption key handling is ambiguous

### Finding

Some documents describe `SALARY_ENCRYPTION_KEY` as the key value supplied via environment variable, while infrastructure passes a **file path** mounted from Docker secrets.

### Evidence

- `03_data_architecture.md:432, 480, 2059, 2149` → key described as environment variable
- `05_security.md:160-161` → key in env var, but in production mounted as Docker secret
- `06_infrastructure.md:43-44` → `SALARY_ENCRYPTION_KEY: /run/secrets/salary_encryption_key`
- `06_infrastructure.md:91` → secrets mounted as files, not passed as env var values

### Why this matters

This is an implementation-contract ambiguity. The application needs a single, explicit secret-loading pattern.

### Severity

**High**

### Required action

Replace ambiguity with one clear standard, for example:

- `SALARY_ENCRYPTION_KEY_PATH=/run/secrets/salary_encryption_key`
- application reads the file contents at startup

Then update all data architecture, security, and infrastructure references accordingly.

---

## 5.11 Worker model wording is inconsistent

### Finding

The roadmap still refers to an async queue using a **worker process**, while infrastructure and decisions log clearly state the worker runs **in-process inside the API service**.

### Evidence

- `08_implementation_roadmap.md:275` → worker process
- `06_infrastructure.md:55-58` → pg-boss workers in-process
- ADR-015 in `09_decisions_log.md` resolves this in favor of in-process workers

### Why this matters

This is a medium-level terminology drift issue. It can cause deployment misunderstandings.

### Severity

**Medium**

### Required action

Update roadmap wording to “in-process job worker inside API service” wherever relevant.

---

## 5.12 External Auditor persona is inconsistent with RBAC policy

### Finding

The PRD gives the External Auditor persona a need to review the audit trail, but the RBAC matrix maps External Auditor to Viewer and explicitly denies direct access to raw audit trail.

### Evidence

- `BudFin_PRD_v2.0.md:313` → persona says read-only access to audit trail and version history
- `BudFin_PRD_v2.0.md:462` → user story asks to review complete audit trail
- `BudFin_PRD_v2.0.md:1460` → only Admin can view audit trail / change history
- `BudFin_PRD_v2.0.md:1467` → External Auditor mapped to Viewer, no direct raw audit trail access

### Why this matters

This is an internal PRD contradiction and a governance issue. It affects compliance expectations and access design.

### Severity

**High**

### Required action

Ratify one of the following models:

- **Model A:** External Auditor gets a restricted audit-read role or export-only audit package
- **Model B:** External Auditor remains Viewer; persona and stories are revised to remove direct audit-trail access

At present, the PRD says both things at once.

---

## 5.13 Traceability references are not fully self-contained in the uploaded set

### Finding

The traceability matrix references spec files such as `version-management.md` and `enrollment-capacity.md`, but those files are not part of the uploaded controlled set.

### Evidence

- `10_traceability_matrix.md` contains multiple references to `version-management.md`
- `10_traceability_matrix.md` contains multiple references to `enrollment-capacity.md`

### Why this matters

The traceability matrix is strong, but the review corpus is not fully self-contained. That weakens auditability for external reviewers or new team members working only from the controlled set.

### Severity

**Medium**

### Required action

Either:

- add those implementation spec files into the official document pack, or
- remap those references to the numbered TDD sections / implementation modules already under control

---

## 6. Epic-Aware Delivery View

Because some epics are already implemented, the correct interpretation of the current documentation set is not “full future design”; it is “mixed baseline + as-built + remaining-plan”.

## 6.1 Epics already evidenced as implemented

| Epic                             | Status      | Evidence                        |
| -------------------------------- | ----------- | ------------------------------- |
| Epic 13 — Infrastructure & CI/CD | Implemented | `10_traceability_matrix.md:425` |
| Epic 11 — Authentication & RBAC  | Implemented | `10_traceability_matrix.md:426` |
| Epic 7 — Master Data Management  | Implemented | `10_traceability_matrix.md:427` |
| Epic 10 — Version Management     | Implemented | `10_traceability_matrix.md:428` |
| Epic 1 — Enrollment & Capacity   | Implemented | `10_traceability_matrix.md:429` |

## 6.2 What this means for alignment

These implemented areas should now be documented under an **as-built lens**:

- actual package versions
- actual endpoint behavior
- actual lockout contract
- actual secret-loading behavior
- actual deployment / worker topology
- actual test evidence and known deviations

Right now, the corpus still mixes:

- baseline design intent
- approved architecture choices
- implemented evidence
- future roadmap phrasing

That is the main structural cause of misalignment.

---

## 7. Per-Document Review

## 7.1 `BudFin_PRD_v2.0.md`

### Strengths

- Strong business framing
- Improved stakeholder completeness
- Mature NFR coverage
- Good risk register and success metrics
- Clear product intent and modular structure

### Main issues

- internal contradiction on `data_source`
- External Auditor vs RBAC contradiction
- health endpoint mismatch with TDD
- zero-downtime requirement misaligned with actual infra
- some schema wording too physical for a PRD

### Assessment

**Very strong PRD, but needs one focused reconciliation pass.**

---

## 7.2 `README.md`

### Strengths

- clear navigation hub
- good overview of document pack

### Main issues

- still marked Draft
- claims “single source of truth” while the set has conflicting authorities

### Assessment

**Useful index, but governance metadata is outdated.**

---

## 7.3 `01_overview.md`

### Strengths

- strong executive technical framing
- good rationale for monolith choice

### Main issues

- still Draft
- author and approver metadata incomplete

### Assessment

**Architecturally solid, governance metadata incomplete.**

---

## 7.4 `02_component_design.md`

### Strengths

- strong component decomposition
- useful interface-level detail
- good operational descriptions

### Main issues

- lockout contract conflicts with security/API docs
- JWT payload includes `sessionId` while other docs omit it

### Assessment

**Strong design section, but one of the main sources of contract drift.**

---

## 7.5 `03_data_architecture.md`

### Strengths

- strong physical-schema treatment
- high implementation value
- clear DDL orientation

### Main issues

- still Draft
- key-loading wording not aligned with infrastructure secret mounting

### Assessment

**Likely the true physical-schema authority, but should be formally declared as such.**

---

## 7.6 `04_api_contract.md`

### Strengths

- clear API conventions
- strong error handling model
- generally clean endpoint catalog

### Main issues

- JWT payload example incomplete vs component design

### Assessment

**Strong contract document, but needs synchronization with auth/session model.**

---

## 7.7 `05_security.md`

### Strengths

- mature security posture for a v1 internal system
- sensible token strategy
- useful session model and threat thinking

### Main issues

- differs from component design on lockout behavior
- secret handling wording not fully aligned with infrastructure implementation

### Assessment

**Strong security design, but contract harmonization is required.**

---

## 7.8 `06_infrastructure.md`

### Strengths

- practical and proportionate v1 deployment design
- strong CI/CD gate definitions
- strong observability and backup/restore thinking

### Main issues

- not aligned with PRD zero-downtime wording
- `/api/v1/health` differs from PRD `/health`
- secret contract should be made explicit

### Assessment

**One of the most operationally useful documents in the set.**

---

## 7.9 `07_nfr_and_testing.md`

### Strengths

- measurable targets
- practical technical implementation mapping
- strong verification mindset

### Main issues

- should be checked after contract reconciliation to ensure no hidden drift on health/monitoring/auth semantics

### Assessment

**Strong section; mostly aligned.**

---

## 7.10 `08_implementation_roadmap.md`

### Strengths

- detailed and execution-friendly
- phase gates are useful
- testing and migration sequencing are strong

### Main issues

- still baseline-only, not implementation-aware
- React Router version drift
- “worker process” wording drift
- includes future phrasing for implemented epics

### Assessment

**Good baseline plan, poor live-program status document.**

---

## 7.11 `09_decisions_log.md`

### Strengths

- good decision capture discipline
- useful assumption visibility

### Main issues

- decision outcomes need to be reflected consistently back into all dependent documents

### Assessment

**Valuable control document; should drive more aggressive downstream synchronization.**

---

## 7.12 `10_traceability_matrix.md`

### Strengths

- strongest control artifact in the set
- bridges requirement, design, code, tests, and acceptance evidence
- clearly confirms implemented epic status

### Main issues

- references to non-uploaded spec files reduce self-contained reviewability

### Assessment

**Best document in the set from a governance/control perspective.**

---

## 7.13 `stack-versions.md`

### Strengths

- clearly states authority for versions
- materially useful for implementation alignment

### Main issues

- its adopted status is not reflected across the rest of the TDD set

### Assessment

**Necessary canonical artifact, but currently stronger than the surrounding governance system.**

---

## 8. Prioritized Remediation Plan

## 8.1 Immediate (Critical / High)

1. **Fix PRD `data_source` contradiction**
2. **Resolve lockout contract mismatch**
3. **Resolve JWT payload / `sessionId` contract**
4. **Resolve External Auditor vs RBAC contradiction**
5. **Define document-governance hierarchy**
6. **Rebaseline roadmap to show implemented epics**

## 8.2 Near-term (High / Medium)

1. Standardize health endpoint naming
2. Standardize secret-loading contract
3. Align deployment strategy wording with actual v1 infra
4. Replace “worker process” wording with in-process worker wording
5. Align React Router references with stack manifest

## 8.3 Structural hardening

1. Declare PRD data model conceptual only; TDD physical schema authoritative
2. Make traceability matrix self-contained or add missing spec artifacts
3. Publish an **as-built technical baseline** after reconciliation

---

## 9. Recommended Governance Decisions to Ratify

To close the alignment loop, I recommend formally ratifying the following decisions:

### Decision A — Authoritative hierarchy

- PRD = product baseline
- TDD = technical baseline
- `stack-versions.md` = package/runtime authority only
- traceability matrix = requirement/test/implementation control index

### Decision B — Physical schema authority

- PRD data model = logical view
- TDD Section 5 = physical schema authority

### Decision C — As-built documentation standard

Any implemented epic must have:

- implementation status
- canonical contract behavior
- evidence reference
- known deviations / technical debt note

### Decision D — Roadmap standard

Maintain two artifacts:

- planned roadmap
- current implementation status / release readiness tracker

---

## 10. Definition of “Full Alignment” for the Next Revision

The document set should be considered fully aligned only when all the following are true:

1. No conflicting contract exists across PRD, TDD, API, security, and infra
2. No implemented epic is still presented only as future plan
3. Every authoritative source is explicitly declared and respected
4. PRD logical model and TDD physical model are clearly separated
5. Operations targets in PRD match actual v1 deployment capability
6. Persona stories, RBAC matrix, and access model all say the same thing
7. All TDD governance metadata is updated from Draft to the correct controlled status

---

## 11. Final Conclusion

BudFin is **not suffering from a bad architecture problem**. It is suffering from a **documentation-governance maturity gap** between:

- what was designed,
- what was approved,
- what was implemented, and
- what the documents still say.

That is good news.

The core solution is sound. The next step is not re-architecture; it is **documentation consolidation and contract reconciliation**.

If you complete the remediation actions above, the BudFin document set can become a genuinely high-quality, audit-ready, implementation-aware technical baseline.

---

## 12. Suggested Next Deliverables

To move this from review to action, the next three deliverables should be:

1. **Alignment Remediation Log** — one row per issue, owner, decision, due date, status
2. **As-Built TDD v1.1** — synchronized technical baseline for implemented epics
3. **Roadmap Rebaseline Pack** — baseline plan vs completed epics vs remaining epics
