# Epic 17 Visual Verification

Date: 2026-03-15  
Branch: `codex/epic-17-revenue-remediation`

## Scope

Playwright-driven visual verification was run against the local BudFin dev stack (`http://127.0.0.1:3000` / `http://127.0.0.1:3001`) after the Epic 17 remediation changes.

## Verified Screens

### Revenue shell and parity states

- Pass: Revenue default overview  
  `/tmp/epic-17-visuals/revenue-default-overview.png`
- Pass: Revenue grade view, AY1, no filters  
  `/tmp/epic-17-visuals/revenue-grade-ay1.png`
- Pass: Revenue grade view, AY1, band filter active  
  `/tmp/epic-17-visuals/revenue-grade-ay1-maternelle-filter.png`
- Pass: Revenue nationality view  
  `/tmp/epic-17-visuals/revenue-nationality-ay1.png`
- Pass: Revenue tariff view  
  `/tmp/epic-17-visuals/revenue-tariff-ay1.png`
- Pass: Revenue category view with exception filter active  
  `/tmp/epic-17-visuals/revenue-category-high-discount.png`
- Pass: Revenue active inspector state  
  `/tmp/epic-17-visuals/revenue-active-inspector-discount-impact.png`

### Revenue settings and fee-grid redesign

- Pass: Revenue settings dialog with incomplete readiness  
  `/tmp/epic-17-visuals/revenue-settings-incomplete.png`
- Pass: Fee-grid tuition section  
  `/tmp/epic-17-visuals/revenue-fee-grid-tuition.png`
- Pass: Fee-grid tuition section (focused section capture)  
  `/tmp/epic-17-visuals/revenue-fee-grid-tuition-section.png`
- Pass: Fee-grid `Autres Frais` section  
  `/tmp/epic-17-visuals/revenue-fee-grid-autres-frais-section.png`
- Pass: Fee-grid `Tarifs Abattement` section  
  `/tmp/epic-17-visuals/revenue-fee-grid-tarifs-abattement-section.png`
- Pass: Imported-version settings dialog state  
  `/tmp/epic-17-visuals/revenue-settings-imported-admin.png`

### Enrollment comparison

- Pass: Enrollment shell comparison capture  
  `/tmp/epic-17-visuals/enrollment-shell-comparison.png`

## Notable live findings addressed during verification

- Fixed during browser verification: Revenue category view showed an empty grid against live data because category rows were incorrectly normalized as totals.
    - File: `/Users/fakerhelali/Desktop/budfin/apps/web/src/lib/revenue-workspace.ts`
    - Result: live category view now renders correctly and category-based screenshots were captured successfully.

- Fixed during browser verification: Revenue settings auto-routed back to the first incomplete tab even after a user manually clicked `Fee Grid`.
    - File: `/Users/fakerhelali/Desktop/budfin/apps/web/src/components/revenue/revenue-settings-dialog.tsx`
    - Result: fee-grid sections became reachable and capturable in the live app.

## Verification notes

- The local dev environment emits `401 /api/v1/auth/refresh` console noise when a browser session does not have a refresh cookie. This did not block the main admin-based verification flow, but it did make hard reloads and session switching fragile.
- A dedicated viewer-account browser login was blocked by the auth rate limiter after repeated session resets. Because of that, the exact `viewer + imported` screenshot was not captured end-to-end in the browser.
- The imported-version settings state was still verified visually via the locked/imported Revenue version capture:
    - `/tmp/epic-17-visuals/revenue-settings-imported-admin.png`

## Overall visual verdict

- Revenue shell parity: Pass
- Revenue grid and right-panel synchronization: Pass
- Revenue settings readiness shell: Pass
- Fee-grid redesign sections: Pass
- Enrollment comparison shell: Pass
- Exact viewer/imported visual capture: Partial due dev auth rate limiting
