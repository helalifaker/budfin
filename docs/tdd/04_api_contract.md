# Section 6: API & Integration Design

> BudFin Technical Design Document -- Section 6 of 12
> Last updated: 2026-03-03

---

## 6.1 Design Principles

BudFin exposes a RESTful JSON API with URL-based versioning under the `/api/v1/` prefix. The API serves as the sole interface between the React SPA and the backend; there are no server-rendered pages.

**Core conventions:**

| Concern               | Decision                                                                                                                         |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Versioning            | URL path prefix: `/api/v1/`                                                                                                      |
| Monetary values       | Returned as **strings** (e.g., `"47250.0000"`) to prevent JSON floating-point precision loss (TC-001)                            |
| Pagination (lists)    | Cursor-based (`?cursor=<opaque>&limit=50`)                                                                                       |
| Pagination (reports)  | Offset-based (`?page=1&page_size=50`)                                                                                            |
| Date format           | ISO 8601 (`YYYY-MM-DDTHH:mm:ssZ`) everywhere                                                                                     |
| Request content type  | `application/json` (except file uploads: `multipart/form-data`)                                                                  |
| Auth header           | `Authorization: Bearer <access_token>` on all protected endpoints                                                                |
| JWT signing algorithm | RS256 (asymmetric). Private key path: `JWT_PRIVATE_KEY_PATH`. Public key path: `JWT_PUBLIC_KEY_PATH`. See `05_security.md §7.1`. |
| Rate limiting         | 100 requests/minute per authenticated user via `@fastify/rate-limit`                                                             |
| OpenAPI spec          | Auto-generated from Zod schemas via `zod-to-openapi`; served at `/api/openapi.json`                                              |
| Swagger UI            | Available at `/api/docs` in development environment only                                                                         |

**Consistent error response format (all non-2xx responses):**

```json
{
    "code": "VALIDATION_ERROR",
    "message": "Enrollment headcount cannot be negative",
    "field_errors": [{ "field": "headcount", "message": "Must be >= 0" }]
}
```

- `code`: Machine-readable error identifier (SCREAMING_SNAKE_CASE).
- `message`: Human-readable description suitable for logging.
- `field_errors`: Present only for 400/422 validation errors; omitted otherwise.

**Standard HTTP status codes used:**

| Code | Usage                                                                |
| ---- | -------------------------------------------------------------------- |
| 200  | Successful read or update                                            |
| 201  | Successful creation                                                  |
| 202  | Accepted (async job queued)                                          |
| 204  | Successful deletion / no content                                     |
| 400  | Malformed request / missing required fields                          |
| 401  | Authentication failure                                               |
| 403  | Insufficient role for this operation                                 |
| 404  | Resource not found                                                   |
| 409  | Conflict (duplicate, invalid state transition, optimistic lock)      |
| 410  | Resource expired (download links)                                    |
| 422  | Semantic validation failure (correct syntax, invalid business logic) |
| 425  | Too Early (export job not yet complete)                              |
| 429  | Rate limit exceeded                                                  |
| 500  | Internal server error                                                |

---

## 6.2 Authentication Scheme

BudFin uses a dual-token authentication pattern:

| Token         | Type                                | TTL        | Transport                      | Storage                |
| ------------- | ----------------------------------- | ---------- | ------------------------------ | ---------------------- |
| Access token  | JWT (RS256)                         | 30 minutes | `Authorization: Bearer` header | Client memory only     |
| Refresh token | Opaque random string (64 hex chars) | 8 hours    | HTTP-only cookie               | `refresh_tokens` table |

**JWT access token payload:**

```json
{
    "sub": 42,
    "email": "user@efir.edu.sa",
    "role": "BudgetOwner",
    "iat": 1709510400,
    "exp": 1709512200
}
```

**Refresh token rotation:** Every call to `/auth/refresh` invalidates the previous token and issues a new pair. If a previously invalidated token is reused (token family violation), the server invalidates the entire token family and all active sessions for the user, forcing re-authentication.

**Cookie attributes for refresh token:**

```text
Set-Cookie: refresh_token=<token>; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth; Max-Age=28800
```

---

## 6.3 Endpoint Catalog

### 6.3.1 Auth Endpoints

#### POST /api/v1/auth/login

Authenticate a user with email and password, issue an access token and refresh token.

**RBAC:** Public (no auth required).

**Request body:**

```json
{
    "email": "string (required, valid email format)",
    "password": "string (required, min 8 chars)"
}
```

**Response 200:**

```json
{
    "access_token": "string (JWT)",
    "expires_in": 1800,
    "user": {
        "id": "number",
        "email": "string",
        "role": "Admin|BudgetOwner|Editor|Viewer"
    }
}
```

Sets cookie: `refresh_token=<token>; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth; Max-Age=28800`

**Error responses:**

| Status | Code                | Condition                                                    |
| ------ | ------------------- | ------------------------------------------------------------ |
| 400    | VALIDATION_ERROR    | Missing or malformed fields                                  |
| 401    | INVALID_CREDENTIALS | Email not found or password mismatch                         |
| 401    | ACCOUNT_LOCKED      | Too many failed attempts; includes `locked_until` (ISO 8601) |
| 500    | INTERNAL_ERROR      | Unexpected server error                                      |

---

#### POST /api/v1/auth/refresh

Rotate the refresh token and issue a new token pair. Implements token family tracking to detect reuse.

**RBAC:** Public (uses `refresh_token` cookie).

**Request:** No body. Server reads the `refresh_token` cookie.

**Response 200:** Same shape as login response (new `access_token` + new `refresh_token` cookie).

**Error responses:**

| Status | Code                  | Condition                                                 |
| ------ | --------------------- | --------------------------------------------------------- |
| 401    | INVALID_REFRESH_TOKEN | Token not found, expired, or malformed                    |
| 401    | REFRESH_TOKEN_REUSE   | Token family violation; all sessions for user invalidated |

---

#### POST /api/v1/auth/logout

Invalidate the current refresh token and clear the cookie.

**RBAC:** Authenticated (any role).

**Request:** No body. Server reads the `refresh_token` cookie.

**Response 204:** No content. Server clears the `refresh_token` cookie.

---

#### GET /api/v1/context

Returns application context for the currently authenticated user: identity, active school year, and resolved permissions list. Intended to be called once on application load to bootstrap the frontend state.

**RBAC:** Authenticated (any role).

**Request params:** None.

**Request body:** None.

**Response 200:**

```json
{
    "user": {
        "id": "integer",
        "email": "string",
        "role": "Admin|BudgetOwner|Editor|Viewer"
    },
    "schoolYear": {
        "id": "integer",
        "label": "string (e.g. \"2025-26\")",
        "startDate": "string (ISO 8601 date)",
        "endDate": "string (ISO 8601 date)"
    },
    "permissions": ["string"]
}
```

**Error responses:**

| Status | Code         | Condition                       |
| ------ | ------------ | ------------------------------- |
| 401    | UNAUTHORIZED | Missing or invalid access token |

---

### 6.3.2 Version Endpoints

#### GET /api/v1/versions

List budget versions for a fiscal year.

**RBAC:** All authenticated roles.

**Query parameters:**

| Param        | Type    | Required | Description                                                  |
| ------------ | ------- | -------- | ------------------------------------------------------------ |
| `fiscalYear` | integer | Yes      | Fiscal year to filter by (e.g., 2026)                        |
| `status`     | string  | No       | Filter by status: `Draft`, `Published`, `Locked`, `Archived` |
| `type`       | string  | No       | Filter by type: `Actual`, `Budget`, `Forecast`               |

**Response 200:**

```json
{
    "versions": [
        {
            "id": "number",
            "name": "string",
            "type": "Actual|Budget|Forecast",
            "status": "Draft|Published|Locked|Archived",
            "data_source": "CALCULATED|IMPORTED",
            "description": "string|null",
            "modification_count": "number",
            "created_at": "string (ISO 8601)",
            "published_at": "string|null",
            "locked_at": "string|null",
            "created_by_email": "string"
        }
    ]
}
```

---

#### POST /api/v1/versions

Create a new budget version (FR-VER-001). Optionally copy data from an existing source version.

**RBAC:** Admin, BudgetOwner.

**Request body:**

```json
{
    "fiscal_year": "number (required, 2020-2099)",
    "name": "string (required, 1-100 chars)",
    "type": "Budget|Forecast (required)",
    "description": "string (optional)",
    "source_version_id": "number|null (optional, version to copy data from)"
}
```

**Response 201:**

```json
{
    "id": "number",
    "name": "string",
    "type": "Budget|Forecast",
    "status": "Draft",
    "data_source": "CALCULATED|IMPORTED",
    "description": "string|null",
    "modification_count": 0,
    "created_at": "string (ISO 8601)",
    "published_at": null,
    "locked_at": null,
    "created_by_email": "string"
}
```

> **Constraint:** `data_source` is set by the API and cannot be overridden by the client. For versions with `type='Budget'` or `type='Forecast'`, `data_source` is always `CALCULATED`. For `type='Actual'`, it is always `IMPORTED`. The field is informational in the response only.

**Error responses:**

| Status | Code                     | Condition                                             |
| ------ | ------------------------ | ----------------------------------------------------- |
| 400    | VALIDATION_ERROR         | Missing or invalid fields                             |
| 404    | SOURCE_VERSION_NOT_FOUND | `source_version_id` references a non-existent version |
| 409    | DUPLICATE_VERSION_NAME   | Version name already exists for this fiscal year      |

---

#### GET /api/v1/versions/:id

Get full version detail including stale module flags (FR-VER-006).

**RBAC:** All authenticated.

**Path params:** `id` (integer, required).

**Response 200:**

```json
{
    "id": "number",
    "name": "string",
    "type": "Actual|Budget|Forecast",
    "status": "Draft|Published|Locked|Archived",
    "data_source": "CALCULATED|IMPORTED",
    "description": "string|null",
    "modification_count": "number",
    "created_at": "string (ISO 8601)",
    "published_at": "string|null",
    "locked_at": "string|null",
    "created_by_email": "string",
    "stale_modules": ["REVENUE", "PNL"]
}
```

**Error responses:**

| Status | Code              | Condition               |
| ------ | ----------------- | ----------------------- |
| 404    | VERSION_NOT_FOUND | No version with this ID |

---

#### PATCH /api/v1/versions/:id/status

Transition version through lifecycle states (FR-VER-003).

Valid transitions: `Draft -> Published -> Locked -> Archived`. Reverting from `Published` or `Locked` back to `Draft` requires an `audit_note`.

**RBAC:** Admin, BudgetOwner (publishing); Admin only (locking, archiving).

**Path params:** `id` (integer, required).

**Request body:**

```json
{
    "new_status": "Published|Locked|Archived|Draft",
    "audit_note": "string (required when reverting from Locked/Published)"
}
```

**Response 200:** Updated version object (same shape as GET /versions/:id).

**Error responses:**

| Status | Code                | Condition                                           |
| ------ | ------------------- | --------------------------------------------------- |
| 400    | AUDIT_NOTE_REQUIRED | Reverting status without providing audit_note       |
| 403    | INSUFFICIENT_ROLE   | Role cannot perform this transition                 |
| 409    | INVALID_TRANSITION  | Disallowed state transition (e.g., Draft -> Locked) |

---

#### POST /api/v1/versions/:id/clone

Clone an existing version as a new Draft (FR-VER-005). Copies all associated data (enrollment, fee grid, employees, calculated results).

**RBAC:** Admin, BudgetOwner.

**Path params:** `id` (integer, required).

**Request body:**

```json
{
    "name": "string (required, 1-100 chars)",
    "description": "string (optional)"
}
```

**Response 201:** New version object with `status: "Draft"`.

**Error responses:**

| Status | Code                            | Condition                                                                                                                                         |
| ------ | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 404    | VERSION_NOT_FOUND               | Source version does not exist                                                                                                                     |
| 409    | DUPLICATE_VERSION_NAME          | Name already exists for this fiscal year                                                                                                          |
| 409    | ACTUAL_VERSION_CLONE_PROHIBITED | Actual versions cannot be cloned. Response body: `{ "error": "ACTUAL_VERSION_CLONE_PROHIBITED", "message": "Actual versions cannot be cloned." }` |

---

#### GET /api/v1/versions/compare

Side-by-side comparison of two versions (FR-VER-004).

**RBAC:** All authenticated.

**Query parameters:**

| Param        | Type           | Required | Description                                      |
| ------------ | -------------- | -------- | ------------------------------------------------ |
| `primary`    | integer        | Yes      | Primary version ID                               |
| `comparison` | integer        | Yes      | Comparison version ID                            |
| `month`      | integer (1-12) | No       | Filter to a single month; defaults to all months |

**Response 200:**

```json
{
    "primary_version": { "id": "number", "name": "string" },
    "comparison_version": { "id": "number", "name": "string" },
    "monthly_comparison": [
        {
            "month": 1,
            "primary": {
                "total_revenue_ht": "string",
                "total_staff_costs": "string",
                "net_profit": "string"
            },
            "comparison": {
                "total_revenue_ht": "string",
                "total_staff_costs": "string",
                "net_profit": "string"
            },
            "variance_absolute": {
                "total_revenue_ht": "string",
                "total_staff_costs": "string",
                "net_profit": "string"
            },
            "variance_pct": {
                "total_revenue_ht": "string|null",
                "total_staff_costs": "string|null",
                "net_profit": "string|null"
            }
        }
    ],
    "annual_totals": {
        "primary": {
            "total_revenue_ht": "string",
            "total_staff_costs": "string",
            "net_profit": "string"
        },
        "comparison": {
            "total_revenue_ht": "string",
            "total_staff_costs": "string",
            "net_profit": "string"
        },
        "variance_absolute": {
            "total_revenue_ht": "string",
            "total_staff_costs": "string",
            "net_profit": "string"
        },
        "variance_pct": {
            "total_revenue_ht": "string|null",
            "total_staff_costs": "string|null",
            "net_profit": "string|null"
        }
    }
}
```

Note: `variance_pct` is `null` when the comparison value is zero (division by zero).

---

#### DELETE /api/v1/versions/:id

Delete a draft version (FR-VER-002). Only versions with status `Draft` can be deleted. Hard-deletes the version and all associated data (cascade).

**RBAC:** Admin, BudgetOwner.

**Path params:** `id` (integer, required).

**Response 204:** No content.

**Error responses:**

| Status | Code              | Condition                                          |
| ------ | ----------------- | -------------------------------------------------- |
| 404    | VERSION_NOT_FOUND | No version with this ID                            |
| 409    | VERSION_NOT_DRAFT | Cannot delete a non-draft version                  |
| 409    | VERSION_IN_USE    | Version is referenced by an in-progress export job |

---

### 6.3.3 Enrollment Endpoints

#### GET /api/v1/versions/:versionId/enrollment/headcount

Retrieve Stage 1 enrollment headcount by grade and academic period.

**RBAC:** All authenticated.

**Path params:** `versionId` (integer, required).

**Query parameters:**

| Param             | Type   | Required | Default | Description                     |
| ----------------- | ------ | -------- | ------- | ------------------------------- |
| `academic_period` | string | No       | `both`  | Filter: `AY1`, `AY2`, or `both` |

**Response 200:**

```json
{
    "entries": [
        {
            "grade_level": "string",
            "academic_period": "AY1|AY2",
            "headcount": "number"
        }
    ]
}
```

---

#### PUT /api/v1/versions/:versionId/enrollment/headcount

Update Stage 1 enrollment headcount (FR-ENR-005). This marks downstream modules (REVENUE, DHG, STAFFING, PNL) as stale.

**RBAC:** Admin, BudgetOwner, Editor.

**Request body:**

```json
{
    "entries": [
        {
            "grade_level": "string (required)",
            "academic_period": "AY1|AY2 (required)",
            "headcount": "number (required, >= 0)"
        }
    ]
}
```

**Response 200:**

```json
{
    "updated": "number",
    "stale_modules": ["REVENUE", "DHG", "STAFFING", "PNL"]
}
```

**Error responses:**

| Status | Code               | Condition                                 |
| ------ | ------------------ | ----------------------------------------- |
| 409    | VERSION_LOCKED     | Version is Locked or Archived             |
| 422    | NEGATIVE_HEADCOUNT | One or more headcount values are negative |

---

#### GET /api/v1/versions/:versionId/enrollment/detail

Retrieve Stage 2 enrollment detail (breakdown by nationality and tariff).

**RBAC:** All authenticated.

**Response 200:**

```json
{
    "entries": [
        {
            "grade_level": "string",
            "academic_period": "AY1|AY2",
            "nationality": "string",
            "tariff": "string",
            "headcount": "number"
        }
    ]
}
```

---

#### PUT /api/v1/versions/:versionId/enrollment/detail

Update Stage 2 enrollment detail (FR-ENR-005, FR-ENR-006, FR-ENR-007). Server validates that the sum of Stage 2 headcounts per grade/period matches the Stage 1 total.

**RBAC:** Admin, BudgetOwner, Editor.

**Request body:**

```json
{
    "entries": [
        {
            "grade_level": "string (required)",
            "academic_period": "AY1|AY2 (required)",
            "nationality": "string (required)",
            "tariff": "string (required)",
            "headcount": "number (required, >= 0)"
        }
    ]
}
```

**Response 200:**

```json
{
    "updated": "number",
    "validation_warnings": []
}
```

**Error responses:**

| Status | Code                  | Condition                                                                     |
| ------ | --------------------- | ----------------------------------------------------------------------------- |
| 409    | VERSION_LOCKED        | Version is Locked or Archived                                                 |
| 422    | STAGE2_TOTAL_MISMATCH | Sum of Stage 2 headcounts does not equal Stage 1 total for one or more grades |

---

#### GET /api/v1/enrollment/historical

Retrieve 5-year historical enrollment data with computed trend analytics (FR-ENR-001, FR-ENR-003).

**RBAC:** All authenticated.

**Query parameters:**

| Param   | Type    | Required | Default | Description                           |
| ------- | ------- | -------- | ------- | ------------------------------------- |
| `years` | integer | No       | 5       | Number of historical years to include |

**Response 200:**

```json
{
    "data": [
        {
            "academic_year": "string",
            "grade_level": "string",
            "student_count": "number"
        }
    ],
    "cagr_by_band": {
        "Maternelle": "string (percentage)",
        "Elementaire": "string (percentage)",
        "College": "string (percentage)",
        "Lycee": "string (percentage)"
    },
    "moving_avg_by_band": {
        "Maternelle": "string",
        "Elementaire": "string",
        "College": "string",
        "Lycee": "string"
    }
}
```

---

#### POST /api/v1/enrollment/historical/import

Bulk CSV import of historical enrollment data (FR-ENR-002). Supports a two-phase workflow: validate first, then commit.

**RBAC:** Admin, BudgetOwner, Editor.

**Request:** `multipart/form-data`

| Field           | Type       | Required | Description                                       |
| --------------- | ---------- | -------- | ------------------------------------------------- |
| `file`          | file (CSV) | Yes      | CSV file with columns: grade_level, student_count |
| `mode`          | string     | Yes      | `validate` (dry run) or `commit` (persist)        |
| `academic_year` | string     | Yes      | Academic year label (e.g., `2025-26`)             |

**Response 200 (validate mode):**

```json
{
    "total_rows": "number",
    "valid_rows": "number",
    "errors": [{ "row": "number", "field": "string", "message": "string" }],
    "preview": [{ "grade_level": "string", "student_count": "number" }]
}
```

**Response 201 (commit mode):**

```json
{
    "imported": "number",
    "academic_year": "string"
}
```

**Error responses:**

| Status | Code             | Condition                                                                        |
| ------ | ---------------- | -------------------------------------------------------------------------------- |
| 400    | VALIDATION_ERROR | Invalid CSV format or missing required columns                                   |
| 409    | DUPLICATE_YEAR   | Data already exists for this academic year (client should prompt replace/cancel) |

---

### 6.3.4 Fee Grid Endpoints

#### GET /api/v1/versions/:versionId/fee-grid

Retrieve the fee grid for a version (FR-REV-001).

**RBAC:** All authenticated.

**Query parameters:**

| Param             | Type   | Required | Default | Description                     |
| ----------------- | ------ | -------- | ------- | ------------------------------- |
| `academic_period` | string | No       | `both`  | Filter: `AY1`, `AY2`, or `both` |

**Response 200:**

```json
{
    "entries": [
        {
            "academic_period": "AY1|AY2",
            "grade_level": "string",
            "nationality": "string",
            "tariff": "string",
            "dai": "string (decimal)",
            "tuition_ttc": "string (decimal)",
            "tuition_ht": "string (decimal)",
            "term1_amount": "string (decimal)",
            "term2_amount": "string (decimal)",
            "term3_amount": "string (decimal)",
            "registration_fee": "string (decimal)",
            "re_registration_fee": "string (decimal)",
            "insurance_fee": "string (decimal)"
        }
    ]
}
```

---

#### PUT /api/v1/versions/:versionId/fee-grid

Update the fee grid (FR-REV-001 through FR-REV-006). Server validates `tuition_ht` against `tuition_ttc` and the configured VAT rate. Marks REVENUE module as stale.

**RBAC:** Admin, BudgetOwner, Editor.

**Request body:**

```json
{
    "entries": [
        {
            "academic_period": "AY1|AY2 (required)",
            "grade_level": "string (required)",
            "nationality": "string (required)",
            "tariff": "string (required)",
            "dai": "string (decimal, required)",
            "tuition_ttc": "string (decimal, required)",
            "tuition_ht": "string (decimal, required)",
            "term1_amount": "string (decimal, required)",
            "term2_amount": "string (decimal, required)",
            "term3_amount": "string (decimal, required)"
        }
    ]
}
```

**Response 200:**

```json
{ "updated": "number" }
```

**Error responses:**

| Status | Code           | Condition                                                  |
| ------ | -------------- | ---------------------------------------------------------- |
| 409    | VERSION_LOCKED | Version is Locked or Archived                              |
| 422    | VAT_MISMATCH   | `tuition_ht` does not match `tuition_ttc / (1 + VAT_rate)` |

---

#### GET /api/v1/versions/:versionId/discounts

Retrieve discount policies by tariff and nationality.

**RBAC:** All authenticated.

**Response 200:**

```json
{
    "entries": [
        {
            "tariff": "string",
            "nationality": "string",
            "discount_rate": "string (decimal, 0.0000-1.0000)"
        }
    ]
}
```

---

#### PUT /api/v1/versions/:versionId/discounts

Update discount policies (FR-REV-007 through FR-REV-010). Marks REVENUE module as stale.

**RBAC:** Admin, BudgetOwner, Editor.

**Request body:**

```json
{
    "entries": [
        {
            "tariff": "string (required)",
            "nationality": "string (required)",
            "discount_rate": "string (decimal, required, 0.0000-1.0000)"
        }
    ]
}
```

**Response 200:**

```json
{ "updated": "number" }
```

**Error responses:**

| Status | Code                  | Condition                     |
| ------ | --------------------- | ----------------------------- |
| 409    | VERSION_LOCKED        | Version is Locked or Archived |
| 422    | INVALID_DISCOUNT_RATE | Rate outside valid range      |

---

#### GET /api/v1/versions/:versionId/other-revenue

Retrieve non-tuition revenue line items.

**RBAC:** All authenticated.

**Response 200:**

```json
{
    "items": [
        {
            "id": "number",
            "line_item_name": "string",
            "annual_amount": "string (decimal)",
            "distribution_method": "equal|weighted|custom",
            "weight_array": ["string (12 decimal values)"],
            "ifrs_category": "string"
        }
    ]
}
```

---

#### PUT /api/v1/versions/:versionId/other-revenue

Update non-tuition revenue items (FR-REV-014 through FR-REV-019). Validates that weight arrays sum to 1.0. Marks REVENUE module as stale.

**RBAC:** Admin, BudgetOwner, Editor.

**Request body:**

```json
{
    "items": [
        {
            "line_item_name": "string (required)",
            "annual_amount": "string (decimal, required)",
            "distribution_method": "equal|weighted|custom (required)",
            "weight_array": ["string (12 values, required when distribution_method is 'custom')"],
            "ifrs_category": "string (required)"
        }
    ]
}
```

**Response 200:**

```json
{ "updated": "number" }
```

**Error responses:**

| Status | Code                 | Condition                                            |
| ------ | -------------------- | ---------------------------------------------------- |
| 409    | VERSION_LOCKED       | Version is Locked or Archived                        |
| 422    | INVALID_WEIGHT_ARRAY | Custom weights do not sum to 1.0 (tolerance: 0.0001) |

---

### 6.3.5 Calculation Endpoints

All calculation endpoints share common behavior:

- **RBAC:** Admin, BudgetOwner, Editor.
- **Method:** POST (triggers a calculation run).
- **Idempotency:** Re-running a calculation overwrites previous results for the same version and module.
- **Response pattern:** Synchronous 200 with result summary (typical response time < 3 seconds for <= 20 concurrent users).
- **Common errors:**
    - `409 VERSION_LOCKED`: Cannot calculate on a Locked or Archived version.
    - `409 VERSION_DATA_SOURCE_MISMATCH`: Version uses imported data — calculation engine is disabled for Actual versions. Response body: `{ "error": "VERSION_DATA_SOURCE_MISMATCH", "message": "Version uses imported data — calculation engine is disabled for Actual versions." }`
    - `422 MISSING_PREREQUISITES`: Required upstream data has not been entered.

---

#### POST /api/v1/versions/:versionId/calculate/enrollment

Run capacity calculation: compute section counts, classroom utilization, and over-capacity alerts.

**Prerequisites:** Stage 1 enrollment headcount must be entered.

**Response 200:**

```json
{
    "run_id": "string (uuid)",
    "duration_ms": "number",
    "summary": {
        "total_students_ay1": "number",
        "total_students_ay2": "number",
        "over_capacity_grades": [{ "grade_level": "string", "utilization_pct": "string" }]
    }
}
```

---

#### POST /api/v1/versions/:versionId/calculate/revenue

Run the Revenue Engine (FR-REV-011, FR-REV-012). Computes gross revenue, applies discounts, and produces monthly revenue schedules per grade/nationality/tariff.

**Prerequisites:** Stage 2 enrollment detail, fee grid, and discounts must be entered.

**Response 200:**

```json
{
    "run_id": "string (uuid)",
    "duration_ms": "number",
    "summary": {
        "total_revenue_ht_ay1": "string (decimal)",
        "total_revenue_ht_ay2": "string (decimal)",
        "total_annual_revenue_ht": "string (decimal)"
    }
}
```

---

#### POST /api/v1/versions/:versionId/calculate/staffing

Run the DHG (Dotation Horaire Globale) calculation and Staff Cost Engine. Computes FTE requirements from enrollment data and calculates monthly staff costs including allowances, augmentations, and social charges.

**Prerequisites:** Enrollment data (for FTE computation) and employee records must be entered.

**Response 200:**

```json
{
    "run_id": "string (uuid)",
    "duration_ms": "number",
    "summary": {
        "total_fte": "string (decimal)",
        "total_annual_staff_costs": "string (decimal)"
    }
}
```

---

#### POST /api/v1/versions/:versionId/calculate/pnl

Run P&L consolidation. Aggregates revenue and staff cost results into IFRS-aligned monthly P&L statements.

**Prerequisites:** REVENUE and STAFFING modules must not be stale.

**Response 200:**

```json
{
    "run_id": "string (uuid)",
    "duration_ms": "number",
    "summary": {
        "total_revenue_ht": "string (decimal)",
        "net_profit": "string (decimal)",
        "ebitda_margin_pct": "string (percentage)"
    }
}
```

**Error responses (in addition to common):**

| Status | Code                | Condition                                                              |
| ------ | ------------------- | ---------------------------------------------------------------------- |
| 422    | STALE_PREREQUISITES | One or more upstream modules are stale; includes `stale_modules` array |

---

#### GET /api/v1/versions/:versionId/stale-flags

Check which modules have stale calculated data for a version.

**RBAC:** All authenticated.

**Response 200:**

```json
{
    "ENROLLMENT": false,
    "REVENUE": true,
    "STAFFING": false,
    "PNL": true
}
```

---

#### POST /api/v1/versions/:id/calculations/run

Triggers an async full-version salary and budget recalculation job. The job is queued via pg-boss and runs in-process. Returns immediately with a job reference; use `GET /api/v1/versions/:versionId/calculate/status` to poll progress.

**RBAC:** Admin, BudgetOwner, Editor.

**Path params:** `id` (integer, required) — version ID.

**Request body (optional):**

```json
{
    "scope": "full|incremental"
}
```

If `scope` is omitted the server defaults to `"full"`.

**Response 202:**

```json
{
    "jobId": "string",
    "status": "queued"
}
```

**Error responses:**

| Status | Code                         | Condition                                                                       |
| ------ | ---------------------------- | ------------------------------------------------------------------------------- |
| 404    | VERSION_NOT_FOUND            | No version with this ID                                                         |
| 409    | VERSION_LOCKED               | Version is Locked or Archived                                                   |
| 409    | VERSION_DATA_SOURCE_MISMATCH | Version uses imported data — calculation engine is disabled for Actual versions |

---

#### GET /api/v1/versions/:versionId/calculate/status

Polls the status of an async calculation job for a version. If `jobId` is omitted, returns the status of the most recently queued job for this version.

**RBAC:** All authenticated.

**Path params:** `versionId` (integer, required).

**Query parameters:**

| Param   | Type   | Required | Description                                                     |
| ------- | ------ | -------- | --------------------------------------------------------------- |
| `jobId` | string | No       | Specific pg-boss job ID to poll; if omitted, returns latest job |

**Response 200:**

```json
{
    "status": "queued|running|completed|failed",
    "progress": "number (0-100)",
    "completedAt": "string (ISO 8601)|null",
    "error": "string|null"
}
```

**Error responses:**

| Status | Code              | Condition                                            |
| ------ | ----------------- | ---------------------------------------------------- |
| 404    | VERSION_NOT_FOUND | No version with this ID                              |
| 404    | JOB_NOT_FOUND     | `jobId` does not reference any known calculation job |

---

### 6.3.6 Employee Endpoints

#### GET /api/v1/versions/:versionId/employees

List employees for a version with pagination and optional filters.

**RBAC:** All authenticated. Salary fields returned as `null` for Viewer role (enforced in the repository layer).

**Query parameters:**

| Param        | Type    | Required | Default | Description                           |
| ------------ | ------- | -------- | ------- | ------------------------------------- |
| `department` | string  | No       | all     | Filter by department                  |
| `status`     | string  | No       | all     | Filter: `Existing`, `New`, `Departed` |
| `page`       | integer | No       | 1       | Page number                           |
| `page_size`  | integer | No       | 50      | Results per page (max 200)            |

**Response 200:**

```json
{
    "employees": [
        {
            "id": "number",
            "employee_code": "string",
            "name": "string",
            "function_role": "string",
            "department": "string",
            "status": "Existing|New|Departed",
            "joining_date": "string (YYYY-MM-DD)",
            "payment_method": "string",
            "is_saudi": "boolean",
            "is_ajeer": "boolean",
            "hourly_percentage": "string (decimal)",
            "base_salary": "string|null (decimal, null for Viewer)",
            "housing_allowance": "string|null",
            "transport_allowance": "string|null",
            "responsibility_premium": "string|null",
            "hsa_amount": "string|null",
            "augmentation": "string|null",
            "augmentation_effective_date": "string|null (YYYY-MM-DD)",
            "updated_at": "string (ISO 8601)"
        }
    ],
    "total": "number",
    "page": "number",
    "page_size": "number"
}
```

---

#### POST /api/v1/versions/:versionId/employees

Create a new employee record (FR-STC-001). Marks STAFFING module as stale. Sensitive salary fields are encrypted at rest by the server.

**RBAC:** Admin, BudgetOwner, Editor.

**Request body:**

```json
{
    "employee_code": "string (required)",
    "name": "string (required)",
    "function_role": "string (required)",
    "department": "Maternelle|Elementaire|College|Lycee|Administration|Vie Scolaire & Support (required)",
    "status": "Existing|New|Departed (required)",
    "joining_date": "YYYY-MM-DD (required)",
    "payment_method": "string (required)",
    "is_saudi": "boolean (required)",
    "is_ajeer": "boolean (required)",
    "hourly_percentage": "number (required, 0.01-1.0)",
    "base_salary": "string (decimal, required)",
    "housing_allowance": "string (decimal, required)",
    "transport_allowance": "string (decimal, required)",
    "responsibility_premium": "string (decimal, default '0.0000')",
    "hsa_amount": "string (decimal, default '0.0000')",
    "augmentation": "string (decimal, default '0.0000')",
    "augmentation_effective_date": "YYYY-MM-DD|null (optional)"
}
```

**Response 201:** Full employee object.

**Error responses:**

| Status | Code                    | Condition                                    |
| ------ | ----------------------- | -------------------------------------------- |
| 400    | VALIDATION_ERROR        | Missing or invalid fields                    |
| 409    | DUPLICATE_EMPLOYEE_CODE | Employee code already exists in this version |
| 409    | VERSION_LOCKED          | Version is Locked or Archived                |

---

#### GET /api/v1/versions/:versionId/employees/:id

Retrieve a single employee record. Salary fields are `null` for Viewer role.

**RBAC:** All authenticated.

**Response 200:** Full employee object (same shape as list item).

**Error responses:**

| Status | Code               | Condition                                |
| ------ | ------------------ | ---------------------------------------- |
| 404    | EMPLOYEE_NOT_FOUND | No employee with this ID in this version |

---

#### PUT /api/v1/versions/:versionId/employees/:id

Full update of an employee record (FR-STC-002). Uses optimistic locking via `updated_at`. Marks STAFFING module as stale.

**RBAC:** Admin, BudgetOwner, Editor.

**Request headers:**

| Header     | Required | Description                                                |
| ---------- | -------- | ---------------------------------------------------------- |
| `If-Match` | Yes      | The `updated_at` timestamp of the version you are updating |

**Request body:** Same shape as POST.

**Response 200:** Updated employee object.

**Error responses:**

| Status | Code               | Condition                                                          |
| ------ | ------------------ | ------------------------------------------------------------------ |
| 404    | EMPLOYEE_NOT_FOUND | No employee with this ID                                           |
| 409    | OPTIMISTIC_LOCK    | Record was modified by another user; includes current `updated_at` |
| 409    | VERSION_LOCKED     | Version is Locked or Archived                                      |

---

#### DELETE /api/v1/versions/:versionId/employees/:id

Remove an employee. For Draft versions, hard-deletes the record. For Published versions, soft-deletes by setting status to `Departed`.

**RBAC:** Admin, BudgetOwner.

**Response 204:** No content.

**Error responses:**

| Status | Code               | Condition                     |
| ------ | ------------------ | ----------------------------- |
| 404    | EMPLOYEE_NOT_FOUND | No employee with this ID      |
| 409    | VERSION_LOCKED     | Version is Locked or Archived |

---

#### POST /api/v1/versions/:versionId/employees/import

Bulk xlsx import of employee records (FR-STC-001). Two-phase workflow: validate then commit.

**RBAC:** Admin, BudgetOwner, Editor.

**Request:** `multipart/form-data`

| Field  | Type        | Required | Description                                |
| ------ | ----------- | -------- | ------------------------------------------ |
| `file` | file (xlsx) | Yes      | Employee data spreadsheet                  |
| `mode` | string      | Yes      | `validate` (dry run) or `commit` (persist) |

**Response 200 (validate mode):**

```json
{
    "total_rows": "number",
    "valid_rows": "number",
    "errors": [{ "row": "number", "field": "string", "message": "string" }],
    "preview": [{ "employee_code": "string", "name": "string", "department": "string" }]
}
```

**Response 201 (commit mode):**

```json
{
    "imported": "number",
    "skipped": "number",
    "errors": []
}
```

---

### 6.3.7 Result Endpoints

#### GET /api/v1/versions/:versionId/revenue

Retrieve calculated revenue results with flexible grouping.

**RBAC:** All authenticated.

**Query parameters:**

| Param             | Type   | Required | Default | Description                                         |
| ----------------- | ------ | -------- | ------- | --------------------------------------------------- |
| `group_by`        | string | No       | `month` | Grouping: `grade`, `nationality`, `tariff`, `month` |
| `academic_period` | string | No       | `both`  | Filter: `AY1`, `AY2`, `both`                        |

**Response 200:**

```json
{
    "data": [
        {
            "group_key": "string",
            "gross_revenue_ttc": "string (decimal)",
            "discount_amount": "string (decimal)",
            "net_revenue_ht": "string (decimal)"
        }
    ],
    "totals": {
        "gross_revenue_ttc": "string (decimal)",
        "discount_amount": "string (decimal)",
        "net_revenue_ht": "string (decimal)"
    }
}
```

**Error responses:**

| Status | Code       | Condition                                                   |
| ------ | ---------- | ----------------------------------------------------------- |
| 409    | STALE_DATA | Revenue has not been (re)calculated since last input change |

---

#### GET /api/v1/versions/:versionId/staff-costs

Retrieve calculated staff cost results.

**RBAC:** All authenticated. Employee-level salary details returned as `null` for Viewer role.

**Query parameters:**

| Param               | Type    | Required | Default | Description                                 |
| ------------------- | ------- | -------- | ------- | ------------------------------------------- |
| `group_by`          | string  | No       | `month` | Grouping: `employee`, `department`, `month` |
| `include_breakdown` | boolean | No       | false   | Include employee-level detail in response   |

**Response 200:**

```json
{
    "data": [
        {
            "group_key": "string",
            "total_gross_salary": "string (decimal)",
            "total_allowances": "string (decimal)",
            "total_social_charges": "string (decimal)",
            "total_staff_cost": "string (decimal)"
        }
    ],
    "totals": {
        "total_gross_salary": "string (decimal)",
        "total_allowances": "string (decimal)",
        "total_social_charges": "string (decimal)",
        "total_staff_cost": "string (decimal)"
    },
    "breakdown": "array|null (employee-level detail when include_breakdown=true)"
}
```

---

#### GET /api/v1/versions/:versionId/dhg-grilles

Returns DHG (Dotation Horaire Globale) grid data for a version. The DHG grid defines hourly allocations per teaching level and is the basis for FTE calculations in the staffing engine.

**RBAC:** All authenticated.

**Path params:** `versionId` (integer, required).

**Response 200:**

```json
{
    "grilles": [
        {
            "id": "integer",
            "level": "string (grade level code)",
            "weeklyHours": "number",
            "coefficient": "string (decimal)",
            "annualHours": "string (decimal)"
        }
    ]
}
```

**Error responses:**

| Status | Code              | Condition                                                    |
| ------ | ----------------- | ------------------------------------------------------------ |
| 404    | VERSION_NOT_FOUND | No version with this ID                                      |
| 409    | STALE_DATA        | Staffing has not been (re)calculated since last input change |

---

#### GET /api/v1/versions/:versionId/staffing-summary

Returns a high-level staffing cost summary for a version, aggregated by department. Useful for the dashboard and executive reporting views.

**RBAC:** All authenticated.

**Path params:** `versionId` (integer, required).

**Response 200:**

```json
{
    "totalFTE": "number",
    "totalSalaryCost": "string (decimal)",
    "byDepartment": [
        {
            "department": "string",
            "fte": "number",
            "cost": "string (decimal)"
        }
    ]
}
```

**Error responses:**

| Status | Code              | Condition                                                    |
| ------ | ----------------- | ------------------------------------------------------------ |
| 404    | VERSION_NOT_FOUND | No version with this ID                                      |
| 409    | STALE_DATA        | Staffing has not been (re)calculated since last input change |

---

#### GET /api/v1/versions/:versionId/pnl

Retrieve the IFRS monthly P&L statement (FR-PNL-001 through FR-PNL-018).

**RBAC:** All authenticated.

**Query parameters:**

| Param                   | Type    | Required | Default   | Description                                          |
| ----------------------- | ------- | -------- | --------- | ---------------------------------------------------- |
| `format`                | string  | No       | `summary` | Output format: `summary`, `detailed`, `ifrs`         |
| `comparison_version_id` | integer | No       | none      | Include side-by-side comparison with another version |

**Response 200 (detailed format):**

```json
{
    "version": { "id": "number", "name": "string" },
    "months": [
        {
            "month": 1,
            "label": "January",
            "revenue_from_contracts": "string (decimal)",
            "rental_income": "string (decimal)",
            "total_revenue_ht": "string (decimal)",
            "staff_costs": "string (decimal)",
            "other_operating_expenses": "string (decimal)",
            "ebitda": "string (decimal)",
            "depreciation_amortization": "string (decimal)",
            "operating_profit": "string (decimal)",
            "finance_income": "string (decimal)",
            "finance_costs": "string (decimal)",
            "profit_before_zakat": "string (decimal)",
            "zakat": "string (decimal)",
            "net_profit": "string (decimal)"
        }
    ],
    "annual_totals": {
        "revenue_from_contracts": "string (decimal)",
        "rental_income": "string (decimal)",
        "total_revenue_ht": "string (decimal)",
        "staff_costs": "string (decimal)",
        "other_operating_expenses": "string (decimal)",
        "ebitda": "string (decimal)",
        "depreciation_amortization": "string (decimal)",
        "operating_profit": "string (decimal)",
        "finance_income": "string (decimal)",
        "finance_costs": "string (decimal)",
        "profit_before_zakat": "string (decimal)",
        "zakat": "string (decimal)",
        "net_profit": "string (decimal)"
    },
    "comparison": "object|null (same structure when comparison_version_id is provided)"
}
```

---

#### GET /api/v1/versions/:versionId/scenarios

Scenario comparison view (FR-SCN-004, FR-SCN-006). Returns Base, Optimistic, and Pessimistic scenarios side-by-side.

**RBAC:** All authenticated.

**Response 200:**

```json
{
    "base": {
        "total_revenue_ht": "string",
        "total_staff_costs": "string",
        "ebitda": "string",
        "net_profit": "string"
    },
    "optimistic": {
        "total_revenue_ht": "string",
        "total_staff_costs": "string",
        "ebitda": "string",
        "net_profit": "string"
    },
    "pessimistic": {
        "total_revenue_ht": "string",
        "total_staff_costs": "string",
        "ebitda": "string",
        "net_profit": "string"
    },
    "deltas": {
        "optimistic_vs_base": {
            "revenue_delta_pct": "string",
            "net_profit_delta_pct": "string"
        },
        "pessimistic_vs_base": {
            "revenue_delta_pct": "string",
            "net_profit_delta_pct": "string"
        }
    }
}
```

---

#### GET /api/v1/versions/:versionId/dashboard

Returns aggregated dashboard data for all 4 KPI cards, chart data, alerts, and a stale flag in a single response (FR-DSH-001 through FR-DSH-005). Designed to avoid N+1 requests from the dashboard UI.

**RBAC:** All authenticated (Admin, BudgetOwner, Editor, Viewer).

**Path params:**

| Param       | Type    | Required | Description               |
| ----------- | ------- | -------- | ------------------------- |
| `versionId` | integer | Yes      | Budget version identifier |

**Query params:** None.

**Request body:** None.

**Response 200:**

```json
{
    "kpi": {
        "totalBudget": "string (decimal, e.g. \"1250000.0000\")",
        "enrollmentCount": "number",
        "costPerStudent": "string (decimal, e.g. \"3654.9700\")",
        "variancePercent": "string (decimal, e.g. \"-2.30\")"
    },
    "charts": {
        "monthlyTrend": [
            {
                "month": "string (YYYY-MM)",
                "budget": "string (decimal)",
                "actual": "string (decimal)"
            }
        ],
        "categoryBreakdown": [
            {
                "category": "string",
                "amount": "string (decimal)",
                "percent": "string (decimal)"
            }
        ]
    },
    "alerts": [
        {
            "type": "string (e.g. \"variance_threshold\")",
            "message": "string",
            "severity": "warning|critical|info"
        }
    ],
    "staleAt": "string (ISO 8601, nullable)"
}
```

**Error responses:**

| Status | Code              | Condition                              |
| ------ | ----------------- | -------------------------------------- |
| 401    | UNAUTHORIZED      | Missing or invalid access token        |
| 403    | FORBIDDEN         | User role lacks access to this version |
| 404    | VERSION_NOT_FOUND | No version with this ID                |

---

### 6.3.8 Export Endpoints (Async)

Export operations use an async job pattern backed by the `export_jobs` PostgreSQL table and a worker process.

#### POST /api/v1/export/jobs

Create an export job. The server queues the job and returns immediately.

**RBAC:** All authenticated.

**Request body:**

```json
{
    "version_id": "number (required)",
    "format": "xlsx|pdf|csv (required)",
    "report_type": "REVENUE_DETAIL|STAFF_COSTS|PNL_MONTHLY|FULL_BUDGET|AUDIT_TRAIL (required)"
}
```

**Response 202:**

```json
{
    "job_id": "number",
    "status": "pending",
    "poll_url": "/api/v1/export/jobs/123"
}
```

---

#### GET /api/v1/export/jobs/:id

Poll export job status.

**RBAC:** Job owner or Admin.

**Response 200:**

```json
{
    "id": "number",
    "status": "pending|processing|done|failed",
    "progress_pct": "number (0-100)",
    "download_url": "string|null",
    "expires_at": "string|null (ISO 8601)",
    "error_message": "string|null"
}
```

---

#### GET /api/v1/export/jobs/:id/download

Download the generated export file. Link expires after the configured TTL (default: 1 hour).

**RBAC:** Job owner or Admin.

**Response 200:** Binary file stream with `Content-Disposition: attachment; filename="<report_name>.<ext>"` header.

**Error responses:**

| Status | Code             | Condition                  |
| ------ | ---------------- | -------------------------- |
| 404    | JOB_NOT_FOUND    | No export job with this ID |
| 410    | DOWNLOAD_EXPIRED | Download link has expired  |
| 425    | NOT_READY        | Job is still processing    |

---

### 6.3.9 Audit Endpoints

#### GET /api/v1/audit

Retrieve the audit log with filters (FR-AUD-003).

**RBAC:** Admin only.

**Query parameters:**

| Param        | Type              | Required | Default     | Description                |
| ------------ | ----------------- | -------- | ----------- | -------------------------- |
| `from`       | string (ISO date) | No       | 30 days ago | Start date                 |
| `to`         | string (ISO date) | No       | now         | End date                   |
| `user_id`    | integer           | No       | all         | Filter by user             |
| `table_name` | string            | No       | all         | Filter by affected table   |
| `operation`  | string            | No       | all         | Filter by operation type   |
| `page`       | integer           | No       | 1           | Page number                |
| `page_size`  | integer           | No       | 50          | Results per page (max 200) |

**Response 200:**

```json
{
    "entries": [
        {
            "id": "number",
            "occurred_at": "string (ISO 8601)",
            "user_email": "string",
            "table_name": "string",
            "record_id": "number",
            "operation": "INSERT|UPDATE|DELETE",
            "audit_note": "string|null"
        }
    ],
    "total": "number",
    "page": "number",
    "page_size": "number"
}
```

---

#### GET /api/v1/audit/calculation

Retrieve calculation run history (NFR 11.12).

**RBAC:** Admin, BudgetOwner.

**Query parameters:**

| Param        | Type              | Required | Description                                        |
| ------------ | ----------------- | -------- | -------------------------------------------------- |
| `version_id` | integer           | Yes      | Version to query                                   |
| `module`     | string            | No       | Filter: `ENROLLMENT`, `REVENUE`, `STAFFING`, `PNL` |
| `from`       | string (ISO date) | No       | Start date                                         |
| `to`         | string (ISO date) | No       | End date                                           |

**Response 200:**

```json
{
    "runs": [
        {
            "run_id": "string (uuid)",
            "module": "ENROLLMENT|REVENUE|STAFFING|PNL",
            "status": "success|failed",
            "duration_ms": "number",
            "created_at": "string (ISO 8601)",
            "output_summary": "object"
        }
    ]
}
```

---

### 6.3.10 Admin Endpoints

#### GET /api/v1/users

List all users in the system.

**RBAC:** Admin only.

**Response 200:**

```json
{
    "users": [
        {
            "id": "number",
            "email": "string",
            "role": "Admin|BudgetOwner|Editor|Viewer",
            "is_active": "boolean",
            "last_login": "string|null (ISO 8601)"
        }
    ]
}
```

---

#### POST /api/v1/users

Create a new user account.

**RBAC:** Admin only.

**Request body:**

```json
{
    "email": "string (required, valid email)",
    "password": "string (required, min 8 chars)",
    "role": "Admin|BudgetOwner|Editor|Viewer (required)"
}
```

**Response 201:**

```json
{
    "id": "number",
    "email": "string",
    "role": "string"
}
```

**Error responses:**

| Status | Code             | Condition                           |
| ------ | ---------------- | ----------------------------------- |
| 400    | VALIDATION_ERROR | Invalid email or password too short |
| 409    | EMAIL_EXISTS     | Email already registered            |

---

#### PATCH /api/v1/users/:id

Update user properties.

**RBAC:** Admin only.

**Request body (all fields optional):**

```json
{
    "role": "Admin|BudgetOwner|Editor|Viewer",
    "is_active": "boolean",
    "force_password_reset": "boolean"
}
```

**Response 200:** Updated user object.

---

#### GET /api/v1/system-config

Retrieve system configuration values (VAT rate, max section size, fiscal year start month, etc.).

**RBAC:** Admin only.

**Response 200:**

```json
{
    "config": [
        {
            "key": "string",
            "value": "string",
            "description": "string",
            "data_type": "string|number|boolean"
        }
    ]
}
```

---

#### PUT /api/v1/system-config

Update system configuration values.

**RBAC:** Admin only.

**Request body:**

```json
{
    "updates": [{ "key": "string (required)", "value": "string (required)" }]
}
```

**Response 200:**

```json
{ "updated": "number" }
```

**Error responses:**

| Status | Code               | Condition                                   |
| ------ | ------------------ | ------------------------------------------- |
| 404    | UNKNOWN_KEY        | Configuration key does not exist            |
| 422    | INVALID_VALUE_TYPE | Value does not match the expected data_type |

---

#### GET /api/v1/health

Health check endpoint for load balancers and monitoring. No authentication required.

**RBAC:** Public.

**Response 200:**

```json
{
    "status": "ok",
    "db": "connected",
    "uptime_seconds": "number",
    "version": "string (semver)"
}
```

**Response 503:**

```json
{
    "status": "degraded",
    "db": "disconnected"
}
```

---

### 6.3.11 Fiscal Period Endpoints

#### GET /api/v1/fiscal-periods/:fiscalYear

List all 12 fiscal period rows for the given fiscal year with status and actual version reference.

**RBAC:** All authenticated (Viewer+).

**Path params:** `fiscalYear` (integer, required, e.g. 2026).

**Response 200:**

```json
{
    "periods": [
        {
            "fiscal_year": "number",
            "month": "number (1-12)",
            "status": "Draft|Locked",
            "actual_version_id": "number|null",
            "locked_at": "string (ISO 8601)|null",
            "locked_by": "string (email)|null"
        }
    ]
}
```

---

#### PATCH /api/v1/fiscal-periods/:fiscalYear/:month/lock

Lock a fiscal period and set the authoritative Actual version for that month.

**RBAC:** Admin, BudgetOwner.

**Path params:** `fiscalYear` (integer, required), `month` (integer 1-12, required).

**Request body:**

```json
{
    "actual_version_id": "number (required)"
}
```

**Validations:**

- Referenced version must exist.
- Version must have `type='Actual'`, `data_source='IMPORTED'`, and `status='Locked'`.
- Sets `fiscal_periods.status='Locked'`, `locked_at=NOW()`, `locked_by=requesting user`.

**Response 200:** Updated fiscal period row.

**Error responses:**

| Status | Code                   | Condition                                                                    |
| ------ | ---------------------- | ---------------------------------------------------------------------------- |
| 404    | VERSION_NOT_FOUND      | `actual_version_id` references a non-existent version                        |
| 409    | PERIOD_ALREADY_LOCKED  | Period is already in Locked status                                           |
| 422    | INVALID_ACTUAL_VERSION | Version does not satisfy type='Actual' and data_source='IMPORTED' constraint |

---

### 6.3.12 Actuals Import Endpoints

#### POST /api/v1/versions/:id/import/:module

Import Excel/CSV data directly into an Actual version (Flow 5 from `03_data_architecture.md §5.2`).

**RBAC:** Editor+.

**Path params:** `id` (integer, required), `module` ∈ `{ revenue, staff_costs, enrollment, pnl }`.

**Validates:** Version must have `type='Actual'` and `data_source='IMPORTED'`.

Creates an `actuals_import_log` row. Writes directly to output tables without invoking calculation engines.

**Response 200:**

```json
{
    "import_log_id": "number",
    "rows_imported": "number",
    "validation_status": "PASSED|FAILED",
    "validation_notes": "string|null"
}
```

**Error responses:**

| Status | Code                         | Condition                                                               |
| ------ | ---------------------------- | ----------------------------------------------------------------------- |
| 409    | VERSION_DATA_SOURCE_MISMATCH | Version is CALCULATED — direct import not allowed                       |
| 409    | VERSION_TYPE_MISMATCH        | Version type is not Actual — only Actual versions accept direct imports |
| 422    | VALIDATION_FAILED            | Parsed file failed row-level validation; see `validation_notes`         |

---

#### GET /api/v1/versions/:id/latest-estimate

Returns monthly budget summary for all 12 months of the version's fiscal year, blending confirmed actuals for Locked fiscal periods and the requesting version's budget data for Draft periods.

**RBAC:** All authenticated (Viewer+).

**Path params:** `id` (integer, required).

**Response 200:**

```json
{
    "months": [
        {
            "month": "number (1-12)",
            "source": "actual|budget",
            "data": {
                "total_revenue_ht": "string (decimal)",
                "total_staff_costs": "string (decimal)",
                "ebitda": "string (decimal)",
                "net_profit": "string (decimal)"
            }
        }
    ]
}
```

---

#### GET /api/v1/versions/:id/import-log

List all `actuals_import_log` rows for the given version.

**RBAC:** All authenticated (Viewer+).

**Path params:** `id` (integer, required).

**Response 200:**

```json
{
    "import_log": [
        {
            "id": "number",
            "import_module": "REVENUE|STAFF_COSTS|ENROLLMENT|PNL",
            "source_file": "string",
            "academic_year_label": "string|null",
            "target_fiscal_year": "number|null",
            "target_period": "string|null",
            "validation_status": "PENDING|PASSED|FAILED",
            "rows_imported": "number|null",
            "validation_notes": "string|null",
            "imported_at": "string (ISO 8601)",
            "imported_by": "string (email)"
        }
    ]
}
```

---

### 6.3.13 Two-Phase Import Endpoints

Two-phase import for enrollment and employee data into Draft versions. Phase 1 validates without committing; Phase 2 commits using the token returned by Phase 1.

#### POST /api/v1/versions/:id/import/:module/validate

Phase 1 of the two-phase import workflow. Parses and validates the uploaded file without writing any data to the database. Returns a validation token that must be passed to the commit endpoint.

**RBAC:** Admin, BudgetOwner, Editor.

**Path params:**

| Param    | Type    | Required | Description                          |
| -------- | ------- | -------- | ------------------------------------ |
| `id`     | integer | Yes      | Version ID (must be in Draft status) |
| `module` | string  | Yes      | `enrollment` or `employee`           |

**Request:** `multipart/form-data` with a single `file` field containing the CSV (enrollment) or xlsx (employee) data file.

**Response 200:**

```json
{
    "valid": "boolean",
    "rowCount": "integer",
    "errors": [
        {
            "row": "integer",
            "field": "string",
            "message": "string"
        }
    ],
    "validationToken": "string (opaque token, required for commit step)"
}
```

**Error responses:**

| Status | Code               | Condition                                  |
| ------ | ------------------ | ------------------------------------------ |
| 400    | MISSING_FILE       | No file was attached to the request        |
| 404    | VERSION_NOT_FOUND  | No version with this ID                    |
| 409    | VERSION_NOT_DRAFT  | Import is only allowed on Draft versions   |
| 422    | UNSUPPORTED_MODULE | `module` is not `enrollment` or `employee` |

---

#### POST /api/v1/versions/:id/import/:module/commit

Phase 2 of the two-phase import workflow. Commits previously validated import data using the token issued by the validate endpoint. Data is written within a single Prisma interactive transaction; any failure rolls back the entire import.

**RBAC:** Admin, BudgetOwner, Editor.

**Path params:**

| Param    | Type    | Required | Description                          |
| -------- | ------- | -------- | ------------------------------------ |
| `id`     | integer | Yes      | Version ID (must be in Draft status) |
| `module` | string  | Yes      | `enrollment` or `employee`           |

**Request body:**

```json
{
    "validationToken": "string (required, token from validate step)"
}
```

**Response 201:**

```json
{
    "imported": "integer",
    "warnings": ["string"]
}
```

**Error responses:**

| Status | Code                     | Condition                                                                 |
| ------ | ------------------------ | ------------------------------------------------------------------------- |
| 400    | INVALID_VALIDATION_TOKEN | Token is missing, expired, or does not match this version/module          |
| 404    | VERSION_NOT_FOUND        | No version with this ID                                                   |
| 409    | VERSION_NOT_DRAFT        | Import is only allowed on Draft versions                                  |
| 422    | COMMIT_FAILED            | Unexpected constraint violation during transaction; full rollback applied |

---

## 6.4 Integration Notes

BudFin v1 is a fully standalone application with no external system integrations:

- **No ERP integration.** All financial data is entered manually or imported via CSV/xlsx.
- **No HR system integration.** Employee records are managed within BudFin.
- **No General Ledger integration.** P&L output is exported (xlsx/pdf) for manual import into accounting systems.
- **No event bus or message queue.** Synchronous request/response is sufficient for the expected <= 20 concurrent users. The only async pattern is the export job queue, which uses PostgreSQL as the queue backend (the `export_jobs` table with a polling worker process).
- **No SSO/SAML/OIDC.** Authentication is username/password with JWT tokens. SSO is deferred to a future version.

---

## 6.5 Zod Schema Pattern

All request and response schemas are defined as Zod schemas at the API layer, providing runtime validation, TypeScript type inference, and automatic OpenAPI generation.

### Example: Create Version Schema

```typescript
import { z } from 'zod';
import { extendZodWithOpenApi } from 'zod-to-openapi';

extendZodWithOpenApi(z);

export const CreateVersionSchema = z
    .object({
        fiscal_year: z
            .number()
            .int()
            .min(2020)
            .max(2099)
            .openapi({ description: 'Fiscal year for the budget version' }),
        name: z
            .string()
            .min(1)
            .max(100)
            .openapi({ description: 'Unique version name within the fiscal year' }),
        type: z.enum(['Budget', 'Forecast']).openapi({ description: 'Version type' }),
        description: z
            .string()
            .max(500)
            .optional()
            .openapi({ description: 'Optional description' }),
        source_version_id: z
            .number()
            .int()
            .positive()
            .optional()
            .openapi({ description: 'Copy data from this version if provided' }),
    })
    .openapi('CreateVersionRequest');

export type CreateVersionInput = z.infer<typeof CreateVersionSchema>;
```

### Example: Error Response Schema

```typescript
export const ErrorResponseSchema = z
    .object({
        code: z
            .string()
            .openapi({ description: 'Machine-readable error code', example: 'VALIDATION_ERROR' }),
        message: z.string().openapi({ description: 'Human-readable error message' }),
        field_errors: z
            .array(
                z.object({
                    field: z.string(),
                    message: z.string(),
                })
            )
            .optional()
            .openapi({ description: 'Per-field validation errors, present for 400/422 responses' }),
    })
    .openapi('ErrorResponse');
```

### Example: Monetary String Schema (TC-001)

```typescript
export const MonetaryStringSchema = z
    .string()
    .regex(/^-?\d+\.\d{4}$/, 'Must be a decimal string with 4 decimal places')
    .openapi({
        description: 'Monetary value as string to prevent floating-point precision loss',
        example: '47250.0000',
    });
```

The OpenAPI spec is generated at build time and served at:

- `/api/openapi.json` -- Machine-readable spec (all environments).
- `/api/docs` -- Swagger UI (development environment only, gated by `NODE_ENV`).

---

## 6.6 RBAC Summary Matrix

| Endpoint Group                 | Admin  | BudgetOwner | Editor | Viewer              |
| ------------------------------ | ------ | ----------- | ------ | ------------------- |
| Auth (login/refresh/logout)    | Yes    | Yes         | Yes    | Yes                 |
| Versions (read)                | Yes    | Yes         | Yes    | Yes                 |
| Versions (create/clone/delete) | Yes    | Yes         | No     | No                  |
| Version status (publish)       | Yes    | Yes         | No     | No                  |
| Version status (lock/archive)  | Yes    | No          | No     | No                  |
| Enrollment (read)              | Yes    | Yes         | Yes    | Yes                 |
| Enrollment (write)             | Yes    | Yes         | Yes    | No                  |
| Fee grid / discounts (read)    | Yes    | Yes         | Yes    | Yes                 |
| Fee grid / discounts (write)   | Yes    | Yes         | Yes    | No                  |
| Calculations (trigger)         | Yes    | Yes         | Yes    | No                  |
| Employees (read)               | Yes    | Yes         | Yes    | Yes (salaries null) |
| Employees (write)              | Yes    | Yes         | Yes    | No                  |
| Employees (delete)             | Yes    | Yes         | No     | No                  |
| Results (read)                 | Yes    | Yes         | Yes    | Yes                 |
| Export (create/download)       | Yes    | Yes         | Yes    | Yes                 |
| Audit log                      | Yes    | No          | No     | No                  |
| Calculation audit              | Yes    | Yes         | No     | No                  |
| Users (manage)                 | Yes    | No          | No     | No                  |
| System config                  | Yes    | No          | No     | No                  |
| Health check                   | Public | Public      | Public | Public              |
