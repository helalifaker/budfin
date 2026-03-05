# UI/UX Spec Audit Fix Plan

> **Date:** 2026-03-06
> **Source:** External agent audit of `docs/ui-ux-spec/`
> **Validated by:** Claude Code against actual spec content
> **Scope:** Only fixes for validated findings (invalid findings excluded)

---

## Summary

Of 8 "critical" findings, 16 total items audited:
- **5 INVALID** (specs already cover these; auditor missed them)
- **6 PARTIALLY VALID** (real but overstated)
- **3 VALID** (genuine gaps)
- **2 LOW PRIORITY** (nice-to-have, not blocking)

---

## Phase 1: Genuine Gaps (Must Fix)

### Fix 1: Archived Status Badge Contrast (Severity: HIGH)

**File:** `00-global-framework.md` Section 1.1 (Status Colors) + `02-version-management.md` Section 5.4

**Problem:** `Archived` badge uses #9CA3AF text on #F9FAFB background (~2.3:1 contrast ratio). Fails WCAG AA minimum of 4.5:1 for 11px text. `Draft` badge is borderline at ~4.3:1.

**Fix:**
- `Draft` badge: change text from `#6B7280` to `#4B5563` (gray-600). New ratio: ~5.7:1.
- `Archived` badge: change text from `#9CA3AF` to `#6B7280` (gray-500) and bg from `#F9FAFB` to `#F3F4F6` (gray-100). New ratio: ~4.6:1.
- Update the `--status-draft` and `--status-archived` tokens in the global framework.
- Update version management badge table to match.

**Files to edit:**
1. `docs/ui-ux-spec/00-global-framework.md` lines 56-59 (status colors table)
2. `docs/ui-ux-spec/02-version-management.md` lines 145-148 (badge table)

---

### Fix 2: Unsaved Changes Guard for Side Panels (Severity: HIGH)

**File:** `00-global-framework.md` Section 4.4

**Problem:** No specification for what happens when a user has unsaved form data and accidentally closes a side panel (via X, Escape, or backdrop click).

**Fix:** Add a new subsection `4.4.3 Unsaved Changes Guard` to the global framework:

```markdown
### 4.4.3 Unsaved Changes Guard

When a side panel or dialog contains a form with unsaved changes (dirty state
detected via React Hook Form `isDirty`), closing the panel triggers a
confirmation dialog before discarding:

| Property | Value |
| --- | --- |
| Component | shadcn/ui `<AlertDialog>` |
| Title | "Unsaved Changes" |
| Description | "You have unsaved changes. Are you sure you want to close?" |
| Confirm button | "Discard" (`<Button variant="destructive">`) |
| Cancel button | "Keep Editing" (`<Button variant="outline">`) |

Close triggers that invoke the guard: X button, Escape key, backdrop click.

If the form is clean (no changes), the panel closes immediately without the
guard.
```

**Files to edit:**
1. `docs/ui-ux-spec/00-global-framework.md` (insert after Section 4.4.2)

---

### Fix 3: Stale Data + Export Interaction (Severity: MEDIUM)

**File:** `00-global-framework.md` Section 4.5 (Module Toolbar) or new Section 7.3

**Problem:** No specification for what happens when a user clicks Export while the module data is stale (calculation outdated).

**Fix:** Add behavior to the Export button section:

```markdown
### Export While Stale

When a user triggers an export and the current module is in the `stale_modules`
array:

1. Show a warning dialog before proceeding:
   | Property | Value |
   | --- | --- |
   | Component | shadcn/ui `<AlertDialog>` |
   | Title | "Data May Be Outdated" |
   | Description | "The current data has not been recalculated since inputs changed. The export will reflect the last calculated values." |
   | Confirm button | "Export Anyway" (`<Button variant="default">`) |
   | Cancel button | "Cancel" |
   | Secondary | "Recalculate First" (`<Button variant="outline">`) -- triggers Calculate |

2. If the user confirms, the export proceeds with last-calculated data.
3. The exported file header includes a timestamp note: "Data as of [last_calculated_at]".
```

**Files to edit:**
1. `docs/ui-ux-spec/00-global-framework.md` (add to Section 7 after comparison mode)

---

### Fix 4: Calculation Job Timeout Fallback (Severity: MEDIUM)

**File:** `00-global-framework.md` Section 4.5 (Calculate Button States)

**Problem:** No UI fallback if a pg-boss calculation job stalls or takes >30s.

**Fix:** Add a timeout state to the Calculate button state table:

```markdown
| Timeout | `<Button>` with amber exclamation icon + "Taking longer than expected" |
  Shows after 30s. Tooltip: "Calculation is still running. You can continue
  working." After 60s, changes to: "Calculation may have failed. Click to retry."
  with a retry action that cancels the current job and starts a new one.
```

Also add to the Activity panel: "Calculation started at [time] -- still running" event.

**Files to edit:**
1. `docs/ui-ux-spec/00-global-framework.md` Section 4.5 (Calculate Button States table)

---

## Phase 2: Consistency Improvements (Should Fix)

### Fix 5: Centralize Expandable Row Keyboard Spec (Severity: LOW)

**File:** `00-global-framework.md` Section 5.1

**Problem:** Grid navigation section omits expand/collapse keyboard shortcuts. Each module defines its own (inconsistently: some use Space, some Enter, some Arrow keys).

**Fix:** Add to Section 5.1 Grid Navigation table:

```markdown
| `Space` or `Enter` | Toggle expand/collapse on focused group row |
| `Arrow Right` | Expand collapsed group row (no-op if already expanded) |
| `Arrow Left` | Collapse expanded group row (no-op if already collapsed) |
```

Then reference "Global Framework Section 5.1" from each module instead of
re-defining. No need to change module specs since they already align with
this pattern.

**Files to edit:**
1. `docs/ui-ux-spec/00-global-framework.md` Section 5.1

---

### Fix 6: Add Tab Usage Guide (Severity: LOW)

**File:** `00-global-framework.md` (new subsection in Section 4)

**Problem:** Three tab patterns used (underline navigation, pill sub-tabs, toggle groups) without documented distinction.

**Fix:** Add Section 4.11 Tab Patterns:

```markdown
### 4.11 Tab Patterns

| Pattern | Component | Use Case | Example |
| --- | --- | --- | --- |
| Navigation tabs | shadcn/ui `<Tabs>` underline variant | Switch between data views within a module | Enrollment: By Grade / By Nationality / By Tariff |
| Sub-navigation tabs | shadcn/ui `<Tabs>` pill variant | Select a sub-category within a tab | Staffing DHG: Maternelle / Elementaire / College / Lycee |
| Mode toggle | shadcn/ui `<ToggleGroup>` single | Switch display format (no data change) | P&L: Summary / Detailed / IFRS |

Do not mix patterns within the same hierarchy level.
```

**Files to edit:**
1. `docs/ui-ux-spec/00-global-framework.md` (new Section 4.11)

---

### Fix 7: P&L Comparison Viewport Guidance (Severity: LOW)

**File:** `06-pnl-reporting.md` Section 5.3

**Problem:** Comparison mode at ~3,830px width is documented but lacks guidance
for viewports under 1920px.

**Fix:** Add a note to Section 5.3:

```markdown
**Viewport guidance:** At viewports below 1920px with comparison mode active,
the grid may require significant horizontal scrolling. Consider:
- Month headers condense to 3-letter abbreviations (already used)
- Variance (%) sub-column can be hidden via column visibility toggle
  (reduces width by ~840px)
- A toolbar chip shows: "Comparison mode -- wide view recommended"
```

**Files to edit:**
1. `docs/ui-ux-spec/06-pnl-reporting.md` Section 5.3

---

## Not Fixing (Invalid Findings)

| Audit Finding | Why Invalid |
| --- | --- |
| 2.2 CSV Import Missing | Enrollment 03-§9 and Staffing 05-§8 have full import specs |
| 2.4 aria-level Inconsistency | P&L, Enrollment, Revenue all define aria-level 1/2/3 consistently |
| 2.6 Locked Version Fallbacks | Framework §8.3 + §4.10 + Revenue §9.3 cover this comprehensively |
| 2.7 Sidebar Context Conflict | Framework §2.1 auto-collapse table explicitly handles Scenarios overlay |
| 3.2 Dialog Heading Verbs | All use consistent imperative verb pattern (Create/Clone/Publish/Lock/Delete) |
| Concurrent Edit Conflicts | Framework §6.3 specifies optimistic locking + 409 conflict dialog |
| DOM Throttling | ADR-016 explicitly accepts this tradeoff for <=300 rows |

---

## Execution Order

1. **Fix 1** (contrast) -- 10 min, 2 files
2. **Fix 2** (unsaved changes guard) -- 10 min, 1 file
3. **Fix 3** (stale export) -- 10 min, 1 file
4. **Fix 4** (timeout fallback) -- 5 min, 1 file
5. **Fix 5** (keyboard centralization) -- 5 min, 1 file
6. **Fix 6** (tab guide) -- 5 min, 1 file
7. **Fix 7** (viewport guidance) -- 5 min, 1 file

**Total: ~50 min, touching 4 unique files.**
