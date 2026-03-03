# Document Governance Sections

> These sections are designed for insertion into the BudFin PRD (v2.0). They address gaps G-064 through G-070 identified during the comprehensive audit remediation.

---

## Revision History

| Version | Date | Author | Description of Changes |
| --- | --- | --- | --- |
| 1.0 | 2026-02-15 | Office of the Chief Accounting Officer | Initial draft. Established product vision, scope, functional requirements (Enrollment, Revenue, Staffing & Staff Costs, P&L, Scenarios, Master Data, Audit Trail, Dashboard, Input Management), data model overview, calculation engine specifications, non-functional requirements, UI/UX design principles, data migration strategy, implementation roadmap, risks and mitigations, acceptance criteria, and appendices A through I. |
| 1.1 | 2026-03-03 | Office of the Chief Accounting Officer | Phase 1 Stakeholder Review applied. Incorporated 6 decisions from CAO review: (D-001) reorganized navigation into 4 groups (Dashboard, Planning, Master Data, Admin); (D-002) merged Enrollment and Capacity Planning into unified "Enrollment & Capacity" module; (D-003) merged Staffing (DHG) and Staff Costs into unified "Staffing & Staff Costs" module; (D-004) added explicit Calculate button per planning module with stale-state indicator; (D-005) simplified Audit Trail scope for v1 (basic logging, deferred CSV export to v2); (D-006) added Version Management as dedicated Planning module with FRs VER-001 through VER-006. Added Decision Log (Section 19). Added Addendum with 32 additional FRs from Excel workbook analysis (FR-ADD-001 through FR-ADD-032). |
| 2.0 | 2026-03-03 | Office of the Chief Accounting Officer | Comprehensive audit remediation -- 72 gaps addressed. Added document governance sections (Revision History, Glossary, Intended Audience, Document Versioning Policy, Approvers & Sign-Off, Communication Plan). Remediated structural gaps, added missing cross-references, resolved ambiguities in calculation specifications, standardized terminology across all sections, and ensured full traceability between functional requirements and source Excel workbook data. |

---

## Glossary of Terms

### A

| Term | Definition |
| --- | --- |
| AEFE | Agence pour l'Enseignement Francais a l'Etranger -- the French government agency that oversees and accredits French schools abroad, including EFIR. Sets curriculum standards, provides benchmark data (H/E ratios), and administers scholarship programs (Bourses AEFE). |
| AESH | Accompagnants des Eleves en Situation de Handicap -- support staff for students with disabilities. Bourses AESH refers to the associated scholarship/aid program appearing as negative revenue in the P&L. |
| Ajeer | A Saudi Ministry of Human Resources digital platform for managing work permits and visa compliance for non-Saudi employees. Imposes an annual levy per worker (SAR 9,500 non-Nitaqat or SAR 1,500 Nitaqat-compliant) plus a monthly platform fee (SAR 160). In the BudFin context, Ajeer costs are a statutory employer charge applied to all 166 non-Saudi employees. |
| APS | Activites Periscolaires -- after-school extracurricular activities offered to students. Revenue distributed using Academic /10 method. |
| ASEM | Agent Specialise des Ecoles Maternelles -- specialized classroom assistants required in French Maternelle classes (1 per class section). Included in the DHG staffing model as non-teaching support staff. |
| AY | Academic Year. EFIR operates on a dual academic year cycle within a single fiscal year: AY1 (January through June, continuing the prior academic year) and AY2 (September through December, starting the new academic year). July and August are the summer break with zero tuition revenue. |

### B

| Term | Definition |
| --- | --- |
| BAC | Baccalaureat -- the French national secondary school examination taken by Terminale students. Examination fees are calculated as zone rate (SAR 2,000) multiplied by AY1 Terminale headcount. |
| Bourses | Scholarships or financial aid grants. In the BudFin context, Bourses AEFE and Bourses AESH appear as negative revenue (social aid deductions) distributed using the Academic /10 method. |

### C

| Term | Definition |
| --- | --- |
| CAGR | Compound Annual Growth Rate -- a measure of enrollment growth over multiple years, calculated from historical enrollment data. Used in trend analysis within the Enrollment module. |
| CAO | Chief Accounting Officer -- the senior finance executive who owns the BudFin PRD, approves budget versions, and serves as the primary stakeholder for system requirements. |
| Cible | French for "target." In BudFin capacity planning, Cible represents the 85% target utilization threshold for class sections -- the ideal operating point between the Plancher (floor) and Plafond (ceiling). |
| College | The French lower secondary education cycle covering grades 6eme through 3eme (equivalent to US Grades 6-9). Uses subject-specific curriculum grilles with per-subject hours per week per section. |
| Contrats Locaux | Locally hired staff contracts, as distinct from AEFE resident (expatriate) contracts. In BudFin, "Contrats Locaux Remplacements" refers to substitute/replacement teacher contracts, and "Contrats Locaux 1% Masse Salariale" refers to the mandatory continuing education (Formation Continue) levy calculated as a percentage of local payroll mass. |
| Cours Elementaire 1 (CE1) | French elementary Grade 2 (Elementaire band). Max class size: 26 students. |
| Cours Elementaire 2 (CE2) | French elementary Grade 3 (Elementaire band). Max class size: 26 students. |
| Cours Moyen 1 (CM1) | French elementary Grade 4 (Elementaire band). Max class size: 26 students. |
| Cours Moyen 2 (CM2) | French elementary Grade 5 (Elementaire band). Max class size: 26 students. |
| Cours Preparatoire (CP) | French elementary Grade 1 (Elementaire band). The first year of formal primary education. Max class size: 26 students. |
| CRUD | Create, Read, Update, Delete -- the four basic operations for data management. Used in describing version management and master data module capabilities. |
| CSV | Comma-Separated Values -- a plain-text file format used for storing tabular data. BudFin imports historical enrollment data from CSV files (enrollment_2021-22.csv through enrollment_2025-26.csv). |

### D

| Term | Definition |
| --- | --- |
| DAG | Directed Acyclic Graph -- a data structure that may be used in calculation dependency resolution within the calculation engine. |
| DAI | Droit Annuel d'Inscription -- the annual registration fee charged to students. Broken down by nationality (Francais, Nationaux, Autres) and distributed across May-June in the revenue model. One of the largest non-tuition revenue items (SAR 8,737,050 combined). |
| DHG | Dotation Horaire Globale -- the total weekly teaching hours allocated to a school based on its curriculum requirements, enrollment, and number of class sections. DHG is the foundation of the French education staffing model: DHG hours drive FTE requirements, which in turn drive staff cost budgets. Total DHG = Structural hours + Host-country hours (Arabic + Islamic) + Complementary hours. |
| DNB | Diplome National du Brevet -- the French national lower secondary examination taken by 3eme students. Examination fees calculated as zone rate (SAR 600) multiplied by AY1 3eme headcount. |
| DPI | Droit de Premiere Inscription -- a one-time first enrollment fee charged to new students. Broken down by nationality (Francais, Nationaux, Autres) and distributed across May-June. |

### E

| Term | Definition |
| --- | --- |
| EAF | Epreuve Anticipee de Francais -- the early French language examination taken by 1ere (Grade 11) students as part of the Baccalaureat cycle. Examination fees calculated as zone rate (SAR 800) multiplied by AY1 1ere headcount. |
| EBITDA | Earnings Before Interest, Taxes, Depreciation, and Amortization -- a key profitability metric displayed in the P&L module and Dashboard KPIs. |
| ECL | Expected Credit Loss -- the IFRS 9 methodology for estimating bad debt provisions on receivables. In BudFin, impairment losses on receivables are calculated using the ECL model and appear as a separate line item under Operating Expenses in the IFRS Income Statement. |
| EFIR | Ecole Francaise Internationale de Riyad -- the French international school in Riyadh, Saudi Arabia, for which BudFin is being built. EFIR operates approximately 1,500 students across 15 grade levels (PS through Terminale) with an annual revenue exceeding SAR 40 million. |
| Elementaire | The French primary education cycle covering grades CP through CM2 (equivalent to US Grades 1-5). Student curriculum is 24 hours per week. Max class size: 26 students per section. |
| EoS | End of Service -- a statutory provision under Saudi Labor Law requiring employers to accrue terminal benefits for all employees. Calculated as 0.5 months per year of service for the first 5 years, then 1 month per year thereafter. Base for calculation includes salary, housing, transport, and responsibility premium (excludes HSA). |
| EPS | Education Physique et Sportive -- Physical Education and Sports, a subject in the French curriculum grilles for Elementaire and above. |

### F

| Term | Definition |
| --- | --- |
| Formation Continue | Continuing professional training -- a French labor obligation requiring employers to dedicate a percentage of payroll mass to staff training. In BudFin, this is modeled as "Contrats Locaux 1% Masse Salariale" (SAR 306,046 annually). |
| Francais | French nationality category. One of three nationality segments used in enrollment, fee grids, and revenue calculations (Francais, Nationaux, Autres). |
| FTE | Full-Time Equivalent -- a standardized measure of staffing level. In BudFin, FTE = Total weekly teaching hours / Effective ORS (standard teaching obligation, default 18 hours). Used throughout the DHG staffing model to convert curriculum hour requirements into staffing positions. |
| FY | Fiscal Year -- the 12-month financial reporting period. EFIR's fiscal year runs January through December (FY2026 = January 2026 through December 2026). Distinguished from the Academic Year (AY), which spans September to June across two calendar years. |

### G

| Term | Definition |
| --- | --- |
| Garderie | Daycare service provided to students outside regular school hours. Revenue distributed using Academic /10 method. |
| GOSI | General Organization for Social Insurance -- the Saudi Arabian government body that administers social insurance programs. Employers contribute 11.75% of salary (decomposed as 9.75% Pension + 1% SANED + 1% OHI) for Saudi national employees only. Ajeer-registered (non-Saudi) employees are exempt from GOSI. In BudFin, only 2 of 168 employees are GOSI-eligible. |
| Grande Section (GS) | The final year of French Maternelle (preschool), for children aged 5. Max class size: 24 students. |
| Grille | French for "grid" or "schedule." In BudFin, refers to curriculum grilles -- the structured timetables that define subject-level teaching hours per week per class section for each grade level. The DHG model uses four grilles: Maternelle, Elementaire, College, and Lycee. |

### H

| Term | Definition |
| --- | --- |
| H/E | Heures par Eleve (Hours per Student) -- an AEFE benchmark ratio comparing total teaching hours to student enrollment at each level. Used in the DHG Optimization module to compare EFIR's staffing efficiency against the AEFE network average. |
| HSA | Heures Supplementaires Annuelles -- annualized overtime hours for teaching staff. Paid on a 10-month basis (excluded during July-August summer break). HSA is a key variable in DHG optimization: higher HSA assumptions reduce FTE requirements but increase per-teacher cost. HSA is excluded from the End of Service base calculation. |
| HT | Hors Taxes -- excluding taxes (specifically excluding VAT). All IFRS-compliant revenue figures in BudFin are presented HT per IFRS 15 requirements. Tuition HT = Tuition TTC / (1 + VAT_RATE). |

### I

| Term | Definition |
| --- | --- |
| IAS 1 | International Accounting Standard 1 -- Presentation of Financial Statements. Defines the structure and content of financial statements. BudFin's P&L module uses the IAS 1 Function of Expense method and follows IAS 1 requirements for separating operating items from finance items. |
| IFRS 9 | International Financial Reporting Standard 9 -- Financial Instruments. In BudFin, relevant for the Expected Credit Loss (ECL) model used to calculate impairment losses on receivables (bad debt provision). |
| IFRS 15 | International Financial Reporting Standard 15 -- Revenue from Contracts with Customers. Governs how revenue is classified and presented in BudFin. Tuition fees, registration fees, and ancillary services are classified as "Revenue from Contracts with Customers." Rental income is separated per IAS 1. All revenue is presented net (HT) per IFRS 15. |
| IL | Indemnite Logement -- housing allowance. One of the five salary components in the staff cost model. A fixed monthly allowance included in the End of Service base calculation. |
| IT | Indemnite Transport -- transport allowance. One of the five salary components in the staff cost model. A fixed monthly allowance included in the End of Service base calculation. |

### K

| Term | Definition |
| --- | --- |
| KPI | Key Performance Indicator -- quantifiable metrics displayed on the BudFin Dashboard. The four primary KPIs are: Total Revenue (SAR HT), Total Students (by AY with sections and grades), School Utilization (target 85%), and Discount Rate (% of Gross Tuition). |
| KSA | Kingdom of Saudi Arabia -- the country where EFIR operates. Relevant for statutory cost rules (GOSI, Ajeer, EoS per Saudi Labor Law), tax regulations (VAT, Zakat per ZATCA), and data protection (PDPL). |

### L

| Term | Definition |
| --- | --- |
| Lycee | The French upper secondary education cycle covering Seconde (2nde), Premiere (1ere), and Terminale. Uses the Voie Generale curriculum structure with Tronc commun (common core) and Specialites (elective specializations). |

### M

| Term | Definition |
| --- | --- |
| Marge d'autonomie | Margin of autonomy -- additional discretionary teaching hours that schools can allocate to subjects or activities of their choice, beyond the mandated national curriculum hours. Appears in College DHG grilles. |
| Maternelle | The French preschool education cycle covering Petite Section (PS), Moyenne Section (MS), and Grande Section (GS), for children aged 3-5. Curriculum is organized into 5 learning domains rather than discrete subjects. Max class size: 24 students per section. Requires 1 ASEM assistant per class. |
| Moyenne Section (MS) | The middle year of French Maternelle (preschool), for children aged 4. Max class size: 24 students. |

### N

| Term | Definition |
| --- | --- |
| Nationaux | Saudi national students. One of three nationality segments in BudFin (Francais, Nationaux, Autres). Nationaux are exempt from VAT on tuition (VAT rate = 0%), which is a specific fiscal rule applied in the revenue calculation engine. |
| Nitaqat | A Saudi labor nationalization program that sets quotas for Saudi employee ratios. Ajeer levy rates differ based on Nitaqat compliance: SAR 1,500 (compliant) vs. SAR 9,500 (non-compliant). EFIR currently uses the non-Nitaqat rate. |

### O

| Term | Definition |
| --- | --- |
| OHI | Occupational Hazards Insurance -- a component of the GOSI employer contribution (1% of salary). Part of the 11.75% total GOSI rate applicable to Saudi national employees only. |
| ORS | Obligation Reglementaire de Service -- the standard teaching obligation in hours per week for French education staff. Default: 18 hours/week. Used as the denominator in the FTE calculation (FTE = Total DHG hours / Effective ORS). Effective ORS is configurable and increases with HSA assumptions. |

### P

| Term | Definition |
| --- | --- |
| P&L | Profit and Loss statement -- the financial report showing revenue, expenses, and net result. BudFin produces a monthly P&L using the IFRS Function of Expense method (IAS 1) with key subtotals: Total Revenue, Total Expenses, EBITDA, Operating Profit, Profit Before Zakat, and Net Profit/(Loss). |
| PDPL | Personal Data Protection Law -- the Saudi Arabian data privacy regulation. BudFin must comply with PDPL requirements for handling employee personal data (names, salaries, identification numbers). |
| Petite Section (PS) | The first year of French Maternelle (preschool), for children aged 3. The entry-level grade for new student intake. Max class size: 24 students. |
| Plancher | French for "floor." In BudFin capacity planning, Plancher represents the 70% minimum utilization threshold below which a class section is flagged as UNDER-utilized (amber alert). |
| Plafond | French for "ceiling." In BudFin capacity planning, Plafond represents the 100% maximum utilization threshold above which a class section is flagged as OVER capacity (red alert). |
| Plein | Full-price tariff category. Students paying the standard, undiscounted tuition rate. One of three tariff categories (RP, R3+, Plein). |
| Premiere (1ere) | French upper secondary Grade 11 (Lycee band). Students take the EAF (Epreuve Anticipee de Francais) examination. Curriculum includes Tronc commun + Specialites. |
| Proviseur | The head of a French secondary school (College/Lycee). Equivalent to "Principal" or "Head of School." Listed as a user persona (School Administrator) in BudFin. |

### R

| Term | Definition |
| --- | --- |
| R3+ | Tarif Reduit 3+ -- a reduced tuition rate for families with 3 or more children enrolled in the school. Default discount: 75% of Plein tariff. Mutually exclusive with RP (student receives the highest applicable discount only). |
| RBAC | Role-Based Access Control -- the security model for BudFin. Minimum roles: Admin (full system access), Editor (data entry and modification), Viewer (read-only access). |
| RP | Tarif Reduit Personnel -- a reduced tuition rate for children of school staff members. Default discount: 75% of Plein tariff. Mutually exclusive with R3+ (student receives the highest applicable discount only). |
| RPO | Recovery Point Objective -- the maximum acceptable data loss in the event of a system failure. BudFin target: less than 24 hours (daily automated backup). |
| RTO | Recovery Time Objective -- the maximum acceptable time to restore the system after a failure. Defined in non-functional requirements. |

### S

| Term | Definition |
| --- | --- |
| SANED | Saudi unemployment insurance program (Saned / Insurance Against Unemployment). A component of the GOSI employer contribution (1% of salary). Part of the 11.75% total GOSI rate applicable to Saudi national employees only. |
| SAR | Saudi Riyal -- the currency of Saudi Arabia. All financial figures in BudFin are denominated in SAR. EFIR's annual revenue exceeds SAR 40 million. |
| Seconde (2nde) | French upper secondary Grade 10 (Lycee band). The first year of Lycee. Curriculum includes Tronc commun + Specialites. |
| SIELE | Servicio Internacional de Evaluacion de la Lengua Espanola -- an international Spanish language examination. Examination fees distributed using custom months (October-November). |
| Specialites | Elective specialization subjects in the French Lycee Voie Generale curriculum. Students select Specialites in addition to the Tronc commun (common core). Relevant to DHG staffing calculations for the Lycee band. |
| SSO | Single Sign-On -- an authentication mechanism allowing users to access BudFin using their existing organizational credentials. Listed as a non-functional requirement for security. |

### T

| Term | Definition |
| --- | --- |
| Terminale | French upper secondary Grade 12 (Lycee band). The final year of secondary education, culminating in the BAC examination. |
| Tronc commun | Common core -- the mandatory subject hours in the French Lycee Voie Generale curriculum that all students must take, regardless of their chosen Specialites. Relevant to DHG staffing calculations for Seconde, Premiere, and Terminale. |
| TTC | Toutes Taxes Comprises -- inclusive of all taxes (specifically inclusive of VAT). Fee grid amounts are recorded TTC, then converted to HT for IFRS reporting using: HT = TTC / (1 + VAT_RATE). |

### U

| Term | Definition |
| --- | --- |
| UAT | User Acceptance Testing -- the final testing phase (Phase 6 of the implementation roadmap) where EFIR finance team members validate that BudFin correctly reproduces all calculations and meets business requirements before go-live. |

### V

| Term | Definition |
| --- | --- |
| Vie Scolaire | School life / student affairs -- an administrative department in French schools responsible for student discipline, attendance, and non-academic support. Appears as a department assignment category and cost center in BudFin. |

### Y

| Term | Definition |
| --- | --- |
| YEARFRAC | A date calculation function that returns the fraction of a year between two dates. Used in the End of Service (EoS) formula to calculate precise years of service for each employee. |

### Z

| Term | Definition |
| --- | --- |
| Zakat | An Islamic tax obligation. In BudFin, estimated at 2.5% on positive monthly profit per ZATCA regulations. Appears as a line item in the IFRS Income Statement between "Profit Before Zakat" and "Net Profit/(Loss)." |
| ZATCA | Zakat, Tax and Customs Authority -- the Saudi Arabian government body that administers zakat, income tax, VAT, and customs duties. EFIR must comply with ZATCA regulations for VAT collection (15% standard rate, 0% for Saudi nationals) and Zakat calculation. |

---

## Intended Audience

This Product Requirements Document serves the following audiences:

**(a) Development Team** -- Provides functional specifications, calculation algorithms, data model definitions, and UI/UX design principles required to build BudFin. The development team should use Section 8 (Functional Requirements), Section 10 (Calculation Engine Specifications), Section 9 (Data Model Overview), and the Addendum (Section 18) as the primary source of truth for implementation. All calculation formulas must be implemented exactly as specified to achieve the zero-discrepancy target against Excel baselines.

**(b) QA Team** -- Provides acceptance criteria (Section 16), testable functional requirements with unique IDs (FR-ENR-*, FR-REV-*, FR-DHG-*, FR-STC-*, FR-PNL-*, FR-SCN-*, FR-MDM-*, FR-AUD-*, FR-DSH-*, FR-INP-*, FR-VER-*, FR-ADD-*), non-functional requirements with measurable targets (Section 11), and the data migration validation protocol (Section 13.3). The QA team should derive test cases from each functional requirement and use the appendices (Sections 17.1 through 17.9) as reference data for validation.

**(c) Finance Stakeholders (EFIR)** -- Provides domain validation for business rules, calculation logic, fee structures, statutory cost rules (GOSI, Ajeer, EoS), IFRS compliance requirements, and workflow accuracy. Finance stakeholders should review Sections 8.2 (Revenue), 8.3 (Staffing & Staff Costs), 8.4 (P&L), and 10 (Calculation Engine) to confirm that every business rule embedded in the current Excel workbooks is accurately captured. The Decision Log (Section 19) records all stakeholder-driven changes.

**(d) Project Management** -- Provides scope definition (Section 4), implementation roadmap with phased delivery (Section 14), risk register with mitigations (Section 15), and success metrics (Section 16). Project managers should use the roadmap to plan resources and timelines, and the risk register to monitor and escalate identified risks during execution.

---

## Document Versioning Policy

This PRD follows a semantic versioning scheme with three levels of change classification:

**Major Version (X.0)** -- Structural or scope changes that alter the fundamental architecture, add or remove entire modules, change the project scope boundary (in-scope vs. out-of-scope), modify the data model in breaking ways, or represent a comprehensive remediation pass. Major versions require full stakeholder review and sign-off before publication. Examples: adding a new planning module, removing a feature from scope, comprehensive audit remediation.

**Minor Version (X.Y)** -- Corrections, clarifications, and enhancements that refine existing requirements without changing the overall structure or scope. Minor versions include stakeholder feedback integration, additional functional requirements derived from deeper analysis, decision log updates, and cross-reference improvements. Minor versions require review by the document owner (CAO) and the directly affected team (development or finance). Examples: incorporating stakeholder review decisions, adding FRs discovered during Excel analysis, clarifying calculation formulas.

**Patch Version (X.Y.Z)** -- Typographical fixes, formatting corrections, broken link repairs, and minor wording adjustments that do not alter the meaning or intent of any requirement. Patch versions can be applied by the document author without formal review, though they must be recorded in the Revision History. Examples: fixing a typo in a table header, correcting a markdown formatting issue, updating a broken cross-reference.

**Version Numbering Rules:**
- The document version appears in the header metadata table (Field: Document Version).
- Each version increment is recorded in the Revision History with date, author, and description.
- Only the latest version of the PRD is considered authoritative. Prior versions are retained in Git history for reference.
- Version numbers are never reused or decremented.

---

## Approvers and Sign-Off

### RACI Matrix for PRD Ownership

| Activity | CAO | Finance Director | Tech Lead | QA Lead | Project Manager |
| --- | --- | --- | --- | --- | --- |
| PRD authoring and maintenance | A | C | C | I | I |
| Domain rule validation (business logic, calculations, IFRS) | A | R | C | I | I |
| Technical feasibility assessment (architecture, performance, data model) | I | I | R | C | I |
| Testability review (acceptance criteria, measurable targets) | I | I | C | R | I |
| Scope and timeline management | C | I | C | I | R |
| Final PRD approval and sign-off | R | R | R | C | I |
| Change control after baseline freeze (v2.0) | A | R | R | C | R |

**Legend:** R = Responsible (does the work), A = Accountable (owns the outcome), C = Consulted (provides input before decision), I = Informed (notified after decision).

### Sign-Off Table

The following sign-off is required before the PRD is considered an approved baseline for development:

| Name | Role | Date | Signature |
| --- | --- | --- | --- |
| _________________ | Chief Accounting Officer (CAO) | ____/____/________ | _________________ |
| _________________ | Finance Director | ____/____/________ | _________________ |
| _________________ | Tech Lead | ____/____/________ | _________________ |
| _________________ | QA Lead | ____/____/________ | _________________ |
| _________________ | Project Manager | ____/____/________ | _________________ |

**Sign-off confirms that:**
1. The signer has read and reviewed the PRD in its entirety.
2. All requirements within their area of responsibility are accurate and complete.
3. The document is approved as the baseline for development (Version 2.0).
4. Any subsequent changes will follow the change control process defined in the Communication Plan.

---

## Communication Plan

### How PRD Changes Reach Teams

**1. Version Control**
The PRD is maintained under Git version control in the project repository at `docs/prd/BudFin_PRD_v1.0.md` (filename to be updated upon version increment). All changes are tracked through Git commits, providing a complete history of who changed what, when, and why.

**2. Change Notifications**
- Every PRD modification is accompanied by a descriptive Git commit message that summarizes the nature and scope of the change.
- Commit messages for PRD changes must follow the format: `docs(prd): [brief description of change] -- vX.Y.Z`
- For major and minor version changes, the commit message must include a summary of affected sections and the rationale for the change.
- Team members with repository access can subscribe to notifications on the PRD file path to receive automatic alerts on changes.

**3. Weekly PRD Review During Active Development**
- During active development phases (Phases 1 through 5 of the implementation roadmap), a weekly PRD review session is held to:
	- Address questions or ambiguities raised by the development or QA teams.
	- Evaluate proposed requirement changes or additions.
	- Review and approve any pending minor version updates.
	- Ensure the PRD remains aligned with implementation discoveries.
- The CAO (or delegate) chairs the review. Attendees include: Tech Lead, QA Lead, and Project Manager.
- Action items from PRD review sessions are recorded and tracked to resolution.

**4. Baseline Freeze at v2.0**
- Version 2.0 of the PRD represents the approved baseline for development.
- After v2.0 sign-off, the PRD enters a controlled change regime. No modifications are permitted without following the formal change control process.

**5. Change Control After Freeze**
- Any proposed change to the baselined PRD (v2.0+) must be submitted as a written change request that includes:
	- The specific section(s) and requirement ID(s) affected.
	- The proposed modification (old text vs. new text).
	- The rationale for the change and its business justification.
	- An impact assessment covering: affected modules, calculation engine changes, data model changes, test case impact, and timeline impact.
- Change requests are reviewed by the CAO (Accountable), Finance Director (domain impact), and Tech Lead (technical impact).
- Approved changes are incorporated into the PRD as a minor or major version increment, with full Revision History documentation.
- Rejected changes are documented in the Decision Log with the rationale for rejection.
- Emergency changes (blocking development) may be fast-tracked with verbal CAO approval, followed by written documentation within 48 hours.

**6. Distribution**
- The authoritative PRD is always the latest version in the Git repository.
- Team members must not maintain local copies that diverge from the repository version.
- When a new major or minor version is published, the Project Manager notifies all stakeholders via email or team communication channel with a summary of changes and a link to the updated document.

---
