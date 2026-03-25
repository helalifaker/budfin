# ADR-034: Export Service Deferral

**Status:** Accepted
**Date:** 2026-03-25

## Context

Epic 5 spec (AC-14 through AC-18) defines a PDF + Excel export service with:

- POST /api/v1/export/jobs — create export job
- GET /api/v1/export/jobs/:id — check status
- GET /api/v1/export/jobs/:id/download — download file
- PDF generation via @react-pdf/renderer
- Excel generation via ExcelJS
- Background processing via pg-boss queue

## Decision

Defer the export service to a post-v1 sprint.

**Rationale:**

1. All P&L data is accessible via the GET /pnl/results API endpoint.
2. The frontend P&L page renders a complete IFRS-structured view with 3 format modes (Summary, Detailed, IFRS) that can be printed via browser print.
3. Export requires significant infrastructure: job queue, file storage, cleanup scheduler.
4. Users have not yet validated the P&L data structure — building export on an unvalidated format risks rework.
5. ADR-014 already established @react-pdf/renderer as the PDF approach (no Chromium).

## Consequences

- Epic 5 ACs 14-18 are deferred. STATUS.md already notes "export service deferred."
- Frontend export button hooks (`use-pnl.ts:91-129`) remain wired but disabled.
- When implemented, follow the pg-boss job pattern established in ADR-022.
- ExportJob Prisma model already exists in schema (ready for use).
