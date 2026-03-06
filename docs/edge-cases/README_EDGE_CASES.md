# BudFin PRD Edge Case Analysis

## Complete Product Owner Review & Risk Assessment

**Date**: March 3, 2026  
**Scope**: BudFin v1.0 PRD for EFIR (École Française Internationale de Riyad) — NOTE: This analysis was prepared against PRD v1.0. The canonical PRD is now v2.0 (`docs/prd/BudFin_PRD_v2.0.md`). Review edge cases against v2.0 before implementation.
**Total Cases Identified**: 35 edge cases across 7 categories

---

## Document Deliverables

This analysis consists of three comprehensive documents:

### 1. **budfin_edge_case_analysis.md** (Main Document)

**Size**: 75 KB | **Length**: 1,357 lines  
**Purpose**: Detailed edge case analysis from Product Owner perspective

**Contents**:

- Executive Summary
- 35 detailed edge case analyses (PO-001 through PO-035)
- Each case includes:
  - Category (Data Entry, Business Rules, Version Lifecycle, Academic Calendar, Reporting, Missing Requirements)
  - Description of the scenario
  - Why it matters (business impact)
  - Current PRD language gaps
  - Suggested resolution
  - Severity (Critical, High, Medium, Low)
  - Affected FRs (Functional Requirements)
- Comprehensive summary table with all 35 cases
- Critical & High-severity reference list
- Implementation priorities by phase
- Conclusion and recommendations

**When to Use**:

- For detailed technical analysis
- For specification writing and FR refinement
- For technical design review
- For UAT planning

---

### 2. **EDGE_CASE_SUMMARY.txt** (Executive Summary)

**Size**: 9.8 KB | **Length**: 234 lines  
**Purpose**: High-level overview for stakeholders and decision-makers

**Contents**:

- Severity breakdown (Critical/High/Medium/Low)
- Category distribution
- Key findings (6 areas of concern)
- Impact on user workflows (CAO, Finance Manager, HR, Finance Team)
- Implementation priorities by phase
- Testing implications
- Risk mitigation strategy
- Recommended actions for Product Owner, Technical Lead, Project Manager

**When to Use**:

- For executive presentations
- For risk assessment meetings
- For project planning and schedule estimation
- For decision-making on missing requirements
- For communicating risks to stakeholders

---

### 3. **EDGE_CASE_QUICK_REFERENCE.csv** (Tracking Table)

**Size**: 4.6 KB | **Length**: 36 rows (header + 35 cases)  
**Purpose**: Machine-readable reference for tracking and filtering

**Columns**:

- ID (PO-001 through PO-035)
- Category (7 types)
- Edge Case (brief description)
- Severity (Critical, High, Medium, Low)
- Affected_FRs (comma-separated FR codes)
- Phase (Phase 2-5 or Cross-Phase)
- Status (Pending, Critical_Path)

**When to Use**:

- For creating issue tracking in Jira/Azure DevOps
- For filtering by severity or phase
- For building test matrices
- For implementation roadmap planning
- For automation/scripting (CSV import)

---

## Quick Statistics

| Metric               | Count |
| -------------------- | ----- |
| **Total Edge Cases** | 35    |
| **Critical Issues**  | 5     |
| **High Issues**      | 14    |
| **Medium Issues**    | 12    |
| **Low Issues**       | 4     |

**By Category**:

- Data Entry Edge Cases: 7
- Business Rule Conflicts: 9
- Version & Lifecycle Edge Cases: 9
- Academic Calendar Edge Cases: 4
- Reporting Edge Cases: 5
- Missing Requirements: 3

**By Phase**:

- Phase 2 (Enrollment & Revenue): 7 cases
- Phase 3 (Staffing & Costs): 8 cases
- Phase 4 (Reporting & Versions): 10 cases
- Phase 5 (Dashboard & Analytics): 5 cases
- Cross-Phase (Foundational): 5 cases

---

## Critical Issues (Must Address Before UAT)

1. **PO-003**: Duplicate employee records during import → breaks payroll
2. **PO-007**: Fee grid retroactive changes → financial restatement risk
3. **PO-012**: EoS retroactive joining date update → over/under-provision
4. **PO-013**: Rounding precision in calculations → fails Excel match requirement
5. **PO-030**: Revenue recognition policy (IFRS 15) → P&L inaccuracy

---

## Key Risk Areas

### 1. Data Integrity (3 Critical Issues)

- Duplicate employee detection missing
- Rounding precision logic not specified
- Revenue recognition policy undefined

### 2. Version Management (2 Critical Issues)

- Fee grid retroactivity not addressed
- Version unlock workflow not specified
- Variance attribution (enrollment vs. assumptions) not defined

### 3. Business Rules (9 High/Critical Issues)

- Mid-year staff joining not covered
- Nationality transitions for GOSI/Ajeer not handled
- Scenario parameter sequencing ambiguous
- Staggered salary augmentation not supported
- Capacity over-enrollment not enforced

### 4. Academic Calendar (4 High Issues)

- AY1/AY2 fee grid application unclear
- Zero-enrollment grades not handled
- Mid-year enrollment changes trigger no workflow
- HSA Jul-Aug exclusion logic ambiguous

### 5. Reporting (4-5 Medium/Low Issues)

- Monthly revenue reconciliation to annual not specified
- Zero-revenue scenarios allowed but not flagged
- Deleted employees not soft-deleted
- Rounding in capacity calculations documented

### 6. Missing Requirements (3 Medium/Low Issues)

- Currency handling (SAR-only vs. multi-currency) not specified
- Audit trail retention lifecycle not defined
- Role change permission impact not specified
- Master data versioning strategy undefined

---

## Implementation Roadmap Impact

### Phase 2 (Enrollment & Revenue) - 5 weeks

Add 1-2 days for:

- Input validation (discount rates, enrollment, grade codes)
- Zero-enrollment handling
- AY1/AY2 fee grid separation
- Monthly-to-annual reconciliation

### Phase 3 (Staffing & Costs) - 5 weeks

Add 2+ weeks for:

- Duplicate employee detection
- Mid-year joining date support
- Nationality history & transitions
- HSA Jul-Aug logic
- Staggered augmentation dates
- Soft-delete employee status

### Phase 4 (Reporting & Versions) - 4 weeks

Add 2+ weeks for:

- Version-specific fee grids
- Variance bridge analysis
- Scenario parameter sequencing
- Rounding precision specification
- Version unlock workflow
- Revenue recognition policy implementation
- EoS retroactive adjustments

### Phase 5 (Dashboard & Analytics) - 3 weeks

Add 1 week for:

- Capacity over-enrollment workflow
- Zero-revenue scenario flagging
- Zero-enrollment grade labeling

**Total Additional Effort**: ~6-8 weeks (impact on overall 24-week timeline)

---

## How to Use This Analysis

### For Product Owner

1. **Review** budfin_edge_case_analysis.md (full document)
2. **Prioritize** the 5 Critical issues for Phase 4 + UAT
3. **Schedule** decision meetings for missing requirements (PO-022, 027, 028, 029, 030)
4. **Clarify** business rules ambiguities with stakeholders
5. **Update** PRD with resolved edge cases

### For Technical Lead

1. **Review** EDGE_CASE_SUMMARY.txt for key technical risks
2. **Design** architecture for:
   - Rounding precision (DECIMAL type, final-step rule)
   - Duplicate detection (employee import)
   - Version-specific fee grids
   - Audit trail lifecycle
3. **Create** test suite for all 35 edge cases vs. Excel baseline
4. **Reference** EDGE_CASE_QUICK_REFERENCE.csv for implementation tracking

### For Project Manager

1. **Review** EDGE_CASE_SUMMARY.txt for impact on schedule
2. **Add** 6-8 weeks to project timeline for edge case implementation
3. **Schedule** decision meetings for missing requirements
4. **Create** Jira/Azure DevOps issues from EDGE_CASE_QUICK_REFERENCE.csv
5. **Track** Critical issues on critical path

### For QA/Testing

1. **Create** test cases from budfin_edge_case_analysis.md (detailed scenarios)
2. **Reference** EDGE_CASE_QUICK_REFERENCE.csv for test matrix
3. **Prioritize** Critical and High-severity cases
4. **Plan** regression testing for Excel baseline comparison (PO-013)
5. **Define** acceptance criteria based on suggested resolutions

### For Finance/Business Stakeholders

1. **Review** EDGE_CASE_SUMMARY.txt for business impact section
2. **Understand** workflow blockers (e.g., version unlock, mid-year hiring)
3. **Participate** in decision meetings for missing requirements
4. **Validate** business rule interpretations (e.g., Plafond enforcement, revenue recognition)

---

## Decision Points Requiring Stakeholder Input

**5 Missing Requirements** that need explicit business decision:

1. **PO-030**: Revenue Recognition Policy
   - Question: Cash basis (accrual at payment) or IFRS 15 (accrual at service delivery)?
   - Impact: Monthly P&L structure and board reporting
   - Decision Needed: Define policy before Phase 4

2. **PO-022**: Currency Handling
   - Question: SAR-only or support multi-currency (USD, EUR)?
   - Impact: Data entry, reporting, FX reconciliation
   - Decision Needed: Define policy before Phase 2

3. **PO-027**: Audit Trail Lifecycle
   - Question: After 7 years, archive or delete audit records?
   - Impact: Legal hold, forensic analysis, storage costs
   - Decision Needed: Define policy before go-live

4. **PO-029**: Master Data Versioning
   - Question: Are grade levels, fee structures versioned or global?
   - Impact: Future-proofing for multi-school or calendar changes
   - Decision Needed: Define policy before Phase 1

5. **PO-014**: Capacity Enforcement
   - Question: Is Plafond a hard limit (reject) or soft target (warn)?
   - Impact: Enrollment data entry and staffing workflow
   - Decision Needed: Clarify with leadership before Phase 5

---

## Next Steps

1. **Distribute** this analysis to Product Owner, Technical Lead, Project Manager, and Finance Leadership
2. **Schedule** decision meeting for 5 missing requirements (PO-022, 027, 028, 029, 030)
3. **Update** BudFin_PRD_v2.0.md (the canonical PRD) with resolutions for all 35 edge cases
4. **Create** Jira/Azure DevOps issues from EDGE_CASE_QUICK_REFERENCE.csv
5. **Adjust** project schedule to account for 6-8 weeks of additional work
6. **Add** all 35 edge cases to test plan and define acceptance criteria
7. **Reference** in Phase 4 + UAT planning for Critical issues

---

## Document Maintenance

**Version**: 1.0  
**Date**: March 3, 2026  
**Status**: Analysis Complete (Awaiting Stakeholder Decision on Missing Requirements)

**Next Update**: After stakeholder decision meetings (PO-022, 027, 028, 029, 030)

---

**All three documents are located in**: `/budfin/` directory

- `budfin_edge_case_analysis.md` (detailed analysis)
- `EDGE_CASE_SUMMARY.txt` (executive summary)
- `EDGE_CASE_QUICK_REFERENCE.csv` (tracking table)
- `README_EDGE_CASES.md` (this file)
