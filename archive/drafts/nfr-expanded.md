# Non-Functional Requirements -- Expanded

> **Replaces:** PRD Section 11 (original 15-row NFR table)
> **Date:** 2026-03-03
> **Status:** Draft for review

---

## 1. Performance

| Category | Requirement | Target / Threshold |
| --- | --- | --- |
| Performance | Page load time for any module | < 1 second |
| Performance | Full module calculation after Calculate button click | < 3 seconds |
| Performance | Calculate button visual feedback (spinner/progress indicator) after click | < 200 ms |
| Performance | Version comparison report generation | < 5 seconds |
| Performance | Full staff cost recalculation (168 employees x 12 months) | < 3 seconds |
| Performance | Dashboard widget rendering (all KPI tiles + charts) | < 2 seconds |
| Performance | Data grid rendering (up to 200 rows) | < 500 ms |
| Performance | Search / filter response within data grids | < 300 ms |
| Performance | Auto-save operation (background, non-blocking) | < 500 ms |

---

## 2. Reliability

| Category | Requirement | Target / Threshold |
| --- | --- | --- |
| Reliability | Application uptime | 99.9% (< 8.76 hours unplanned downtime per year) |
| Reliability | Data integrity: zero calculation discrepancies vs. Excel baseline | 100% match to 2 decimal places |
| Reliability | Auto-save frequency | Every 30 seconds or on field blur |
| Reliability | Transaction atomicity for calculation engine runs | All-or-nothing; partial calculation results never persisted |
| Reliability | Recovery Time Objective (RTO) | < 4 hours (supports month-end close operations) |
| Reliability | Recovery Point Objective (RPO) | < 24 hours (daily automated backup) |
| Reliability | Backup schedule | Daily automated backup at 02:00 AST |
| Reliability | Backup retention | 30 days rolling for daily backups; monthly snapshots retained for 1 year |

---

## 3. Security

### 3.1 Authentication and Encryption

| Category | Requirement | Target / Threshold |
| --- | --- | --- |
| Security | Authentication (v1) | Secure local authentication with username/password |
| Security | Password hashing | bcrypt with minimum cost factor 12 |
| Security | Password policy | Minimum 12 characters, at least 1 uppercase, 1 lowercase, 1 digit, 1 special character |
| Security | Account lockout | Lock after 5 consecutive failed attempts; auto-unlock after 30 minutes |
| Security | Session management | JWT tokens; access token TTL 30 minutes; refresh token TTL 8 hours |
| Security | Session concurrency | Maximum 2 active sessions per user; oldest session terminated on new login |
| Security | SSO integration | Deferred to v2 |
| Security | Data encryption at rest | AES-256 |
| Security | Data encryption in transit | TLS 1.3 |
| Security | Sensitive field encryption | Employee salary data, personal identifiers encrypted at field level in database |

### 3.2 Role-Based Access Control (RBAC) Matrix

Four roles with explicit permission assignments:

| Permission | Admin | Budget Owner | Editor | Viewer |
| --- | --- | --- | --- | --- |
| **User Management** | | | | |
| Create / edit / deactivate users | Yes | No | No | No |
| Assign roles to users | Yes | No | No | No |
| View user activity log | Yes | No | No | No |
| **System Settings** | | | | |
| Configure system settings (fiscal year, school info) | Yes | No | No | No |
| Manage master data (grades, fee structures, IFRS mappings) | Yes | No | No | No |
| **Version Lifecycle** | | | | |
| Create new version | Yes | Yes | Yes | No |
| Delete version (draft only) | Yes | Yes | No | No |
| Lock version | Yes | Yes | No | No |
| Unlock version (with audit note) | Yes | Yes | No | No |
| Publish version (draft to published) | Yes | Yes | No | No |
| **Data Entry & Calculation** | | | | |
| Edit data in Enrollment & Capacity module | Yes | Yes | Yes | No |
| Edit data in Revenue module | Yes | Yes | Yes | No |
| Edit data in Staffing & Staff Costs module | Yes | Yes | Yes | No |
| Edit data in P&L & Reporting module | Yes | Yes | Yes | No |
| Trigger Calculate on any module | Yes | Yes | Yes | No |
| Edit scenario assumptions | Yes | Yes | Yes | No |
| **Viewing & Reporting** | | | | |
| View all modules (read-only) | Yes | Yes | Yes | Yes |
| View dashboards and KPIs | Yes | Yes | Yes | Yes |
| View version comparison reports | Yes | Yes | Yes | Yes |
| View audit trail / change history | Yes | Yes | Yes | Yes |
| **Export** | | | | |
| Export to Excel / PDF / CSV | Yes | Yes | Yes | Yes |
| **Audit** | | | | |
| View calculation audit log | Yes | Yes | No | No |
| View system access log | Yes | No | No | No |

---

## 4. Usability

| Category | Requirement | Target / Threshold |
| --- | --- | --- |
| Usability | Context bar state persistence across module navigation | 100% retention (fiscal year, version, scenario, academic period) |
| Usability | Keyboard navigation for data entry grids | Full support: Tab (next cell), Enter (confirm + move down), Arrow keys (navigate), Escape (cancel edit) |
| Usability | Undo / Redo for data entry | At least 20 actions deep per session |
| Usability | Browser support | Latest 2 versions of Chrome, Edge, Safari, Firefox |
| Usability | Minimum viewport | 1280 x 720 px (no mobile requirement for v1) |
| Usability | Accessibility compliance | WCAG 2.1 AA for all interactive elements |
| Usability | Error messages | Actionable text with field-level highlighting; link to problematic field from error summary |

---

## 5. Data

| Category | Requirement | Target / Threshold |
| --- | --- | --- |
| Data | Audit trail retention | Minimum 7 years (per Saudi Commercial Law) |
| Data | Backup and recovery | Daily automated backup; RPO < 24 hours |
| Data | Export formats | Excel (.xlsx), PDF, CSV for all reports and data views |
| Data | Data validation on input | Server-side validation for all user inputs; client-side validation for immediate feedback |
| Data | Referential integrity | Foreign key constraints enforced at database level for all relational data |

---

## 6. Scalability

| Category | Requirement | Target / Threshold |
| --- | --- | --- |
| Scalability | Maximum concurrent users | 20 (single school finance team) |
| Scalability | Historical data retention | 5+ fiscal years of historical data loaded and queryable |
| Scalability | Versions per fiscal year | Up to 3 active versions (Budget, Actual, Forecast) per fiscal year |
| Scalability | Employee records | 168 employees (current); system must support up to 300 without performance degradation |
| Scalability | Student enrollment records | 1,500 students (current); system must support up to 2,500 without performance degradation |
| Scalability | Database growth rate | ~50 MB/year estimated |
| Scalability | Maximum supported fiscal years | 10 (with archival to cold storage beyond 10 years) |
| Scalability | Archived data retrieval | Archived fiscal years retrievable within 1 hour upon request |

---

## 7. Compliance and Regulatory

| Category | Requirement | Target / Threshold |
| --- | --- | --- |
| Compliance | Saudi PDPL (Personal Data Protection Law) | Full compliance for employee personal data (168 records containing salary, national ID, banking details) |
| Compliance | PDPL data subject rights | Support data access, correction, and deletion requests within 30 days |
| Compliance | PDPL consent management | Record and store employee consent for data processing; track consent withdrawal |
| Compliance | Data residency | All data stored within KSA or SDAIA-approved jurisdiction |
| Compliance | IFRS conformance -- IAS 1 | Financial statement presentation outputs conform to IAS 1 structure |
| Compliance | IFRS conformance -- IFRS 9 | Financial instrument calculations (if applicable) conform to IFRS 9 |
| Compliance | IFRS conformance -- IFRS 15 | Revenue recognition outputs conform to IFRS 15 five-step model |
| Compliance | Audit trail retention (regulatory) | 7 years per Saudi Commercial Law Article 22 |
| Compliance | Financial record retention | Budget versions and calculation outputs retained for 10 years |
| Compliance | Data classification | All employee salary data classified as "Confidential"; all financial aggregates classified as "Internal" |

---

## 8. Localization

| Category | Requirement | Target / Threshold |
| --- | --- | --- |
| Localization | Number format | 1,234,567.89 (English notation; comma as thousands separator, period as decimal separator) |
| Localization | Currency | SAR only; displayed as "SAR" prefix (e.g., SAR 1,234.56); 2 decimal places; no currency symbol |
| Localization | Date format | DD/MM/YYYY (KSA standard, e.g., 03/03/2026) |
| Localization | Timezone | Arabia Standard Time (AST, UTC+3); all timestamps stored as UTC, displayed as AST |
| Localization | UI language (v1) | English only |
| Localization | UI language (v2, deferred) | Arabic (RTL support) and French |
| Localization | Fiscal year convention | Calendar year (January 1 -- December 31) |
| Localization | Academic year convention | September -- August (displayed as "2025-26" format) |

---

## 9. Load Testing

| Category | Requirement | Target / Threshold |
| --- | --- | --- |
| Load Testing | Concurrent data entry users | 10 users performing simultaneous data entry with no performance degradation (all response times within normal thresholds) |
| Load Testing | Concurrent report viewers | 20 users viewing reports simultaneously with < 2 second response time |
| Load Testing | Full module recalculation under load | Full staff cost calculation (168 employees x 12 months) completes in < 3 seconds while 10 users are active |
| Load Testing | Concurrent export operations | 5 simultaneous Excel exports complete within 15 seconds each |
| Load Testing | Peak load scenario | All 20 users active (mix of data entry, viewing, and export) with no HTTP 5xx errors and p95 response time < 3 seconds |
| Load Testing | Sustained load duration | System maintains performance targets over 8-hour sustained usage period (simulating full workday) |

---

## 10. Export

| Category | Requirement | Target / Threshold |
| --- | --- | --- |
| Export | Excel (.xlsx) export -- formatting | Preserve column widths, number formatting, headers, and cell alignment; formulas exported as static values |
| Export | Excel (.xlsx) export -- performance | Largest dataset (168 employees x 12 months with all salary components) exported within 10 seconds |
| Export | Excel (.xlsx) export -- file size | Maximum 25 MB per exported file |
| Export | PDF export -- formatting | Formatted report layout with headers, footers, page numbers, and print-ready margins |
| Export | PDF export -- performance | Full P&L report (12 months, all line items) generated within 15 seconds |
| Export | CSV export -- encoding | UTF-8 with BOM for Excel compatibility |
| Export | CSV export -- performance | Any dataset exported within 5 seconds |
| Export | CSV export -- delimiter | Comma-separated; fields containing commas or quotes properly escaped per RFC 4180 |
| Export | Export audit | All export events logged with username, timestamp, dataset name, and file format |

---

## 11. Maintainability

| Category | Requirement | Target / Threshold |
| --- | --- | --- |
| Maintainability | Code coverage -- calculation engine | Minimum 80% line coverage |
| Maintainability | Code coverage -- overall application | Minimum 60% line coverage |
| Maintainability | Code coverage -- critical paths | 90% branch coverage for RBAC permission checks and financial calculations |
| Maintainability | API versioning | All API endpoints prefixed with version (e.g., /api/v1/); breaking changes require new version |
| Maintainability | API documentation | OpenAPI 3.0 specification maintained for all endpoints |
| Maintainability | Deployment strategy | Zero-downtime deployment capability (rolling or blue-green) |
| Maintainability | Deployment frequency target | Ability to deploy up to once per business day |
| Maintainability | Database migrations | Forward-only versioned migrations; rollback scripts required for every migration |
| Maintainability | Dependency management | No known critical or high-severity CVEs in production dependencies; monthly audit |

---

## 12. Monitoring

| Category | Requirement | Target / Threshold |
| --- | --- | --- |
| Monitoring | Application health endpoint | GET /health returns status, uptime, database connectivity, and last backup timestamp; responds in < 200 ms |
| Monitoring | Error logging | Structured JSON logs with severity levels (DEBUG, INFO, WARN, ERROR, FATAL); ERROR and FATAL trigger alerts |
| Monitoring | Error alerting | Email notification to system administrator within 5 minutes of any FATAL error |
| Monitoring | Calculation audit log | Every calculation run logs: user, module, version, input hash, output hash, row count, duration (ms), success/failure |
| Monitoring | Access logging | All authentication events (login, logout, failed attempt, lockout) logged with IP address and timestamp |
| Monitoring | Performance monitoring | p50, p95, p99 response times tracked per API endpoint; alert when p95 exceeds 2x target |
| Monitoring | Storage monitoring | Alert when database size exceeds 80% of provisioned storage |
| Monitoring | Uptime monitoring | External synthetic check every 5 minutes; alert after 2 consecutive failures |

---

## Summary

| Category | NFR Count |
| --- | --- |
| Performance | 9 |
| Reliability | 8 |
| Security (Authentication + RBAC) | 10 + permission matrix |
| Usability | 7 |
| Data | 5 |
| Scalability | 8 |
| Compliance / Regulatory | 10 |
| Localization | 8 |
| Load Testing | 6 |
| Export | 9 |
| Maintainability | 9 |
| Monitoring | 8 |
| **Total** | **97 + RBAC matrix** |
