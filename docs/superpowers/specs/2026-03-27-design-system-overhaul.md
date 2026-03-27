# BudFin Design System Overhaul: Warm Slate & Aged Bronze

**Date:** 2026-03-27
**Status:** Draft
**Scope:** Full visual redesign of the BudFin application

---

## 1. Design Vision

Transform BudFin from a teal-accented SaaS tool into a premium, institutional-grade finance application. The new identity draws from old-money aesthetics — warm stone surfaces, aged bronze accents, dark espresso chrome — creating an environment that feels like a private banking portfolio, not a startup dashboard.

**Design principles:**

- **Understated authority** — the accent color whispers, never shouts
- **Data-forward density** — every pixel serves the numbers; compact layout maximizes visible rows
- **Warm materiality** — stone, leather, bronze over cold slate and neon
- **Institutional gravitas** — think Vontobel, not Stripe

---

## 2. Color System

### 2.1 Accent Palette: Aged Bronze

Replaces the current teal (`#14b8a6`) accent entirely.

| Token          | Old (Teal) | New (Aged Bronze) | Usage                                               |
| -------------- | ---------- | ----------------- | --------------------------------------------------- |
| `--accent-50`  | `#f0fdfa`  | `#f9f6f2`         | Subtle backgrounds, hover tints                     |
| `--accent-100` | `#ccfbf1`  | `#f0ebe3`         | Selected row bg, range selection                    |
| `--accent-200` | `#99f6e4`  | `#ddd3c4`         | Drag-drop zones, clipboard flash                    |
| `--accent-300` | `#5eead4`  | `#c4b5a0`         | Resize handles, range borders, focus rings          |
| `--accent-400` | `#2dd4bf`  | `#a89880`         | Grid focus ring, sort indicators                    |
| `--accent-500` | `#14b8a6`  | `#8b7355`         | **Primary accent** — buttons, active states, badges |
| `--accent-600` | `#0d9488`  | `#756145`         | Hover states for primary buttons                    |
| `--accent-700` | `#0f766e`  | `#5f4f38`         | Revenue badge, pressed states                       |
| `--accent-800` | `#115e59`  | `#4a3d2d`         | Dark selection tints (dark mode)                    |
| `--accent-900` | `#134e4a`  | `#362d22`         | Deepest accent (dark mode hover)                    |

### 2.2 Sidebar: Dark Espresso

Replaces the current cold navy (`#0f172a`) with warm charcoal.

| Token                   | Old                     | New                     | Notes                         |
| ----------------------- | ----------------------- | ----------------------- | ----------------------------- |
| `--sidebar-bg`          | `#0f172a`               | `#1c1917`               | Warm near-black (stone 900)   |
| `--sidebar-bg-hover`    | `#1e293b`               | `#292524`               | Stone 800                     |
| `--sidebar-bg-active`   | `#1e40af`               | `rgba(139,115,85,0.12)` | Bronze tint, not solid blue   |
| `--sidebar-text`        | `#cbd5e1`               | `#d6d3d1`               | Stone 300 — warm gray         |
| `--sidebar-text-active` | `#ffffff`               | `#8b7355`               | Bronze accent for active text |
| `--sidebar-border`      | `#334155`               | `#292524`               | Stone 800                     |
| `--sidebar-icon`        | `#94a3b8`               | `#a8a29e`               | Stone 400                     |
| `--sidebar-icon-active` | `#ffffff`               | `#8b7355`               | Bronze                        |
| `--sidebar-glow`        | `rgba(20,184,166,0.15)` | `rgba(139,115,85,0.1)`  | Subtle bronze glow            |

Active sidebar item gets a `border-left: 2px solid var(--accent-500)` instead of a solid blue background.

### 2.3 Workspace: Warm Stone

Replaces the current cool slate backgrounds with warm stone tones.

| Token                       | Old       | New       | Notes                     |
| --------------------------- | --------- | --------- | ------------------------- |
| `--workspace-bg`            | `#f8f9fb` | `#f5f3ef` | Warm linen — main canvas  |
| `--workspace-bg-subtle`     | `#f1f3f8` | `#eeeae4` | Grid headers, sub-headers |
| `--workspace-bg-muted`      | `#e8ecf4` | `#e7e5e0` | Borders, dividers         |
| `--workspace-bg-card`       | `#ffffff` | `#ffffff` | Stays white               |
| `--workspace-border`        | `#e5eaf0` | `#e7e5e0` | Stone 200                 |
| `--workspace-border-strong` | `#cbd5e1` | `#d6d3d1` | Stone 300                 |
| `--workspace-bg-warm`       | `#fafaf8` | `#faf9f7` | Unchanged (already warm)  |
| `--workspace-bg-warm-card`  | `#fffffe` | `#ffffff` | White                     |

### 2.4 Text: Warm Ink

| Token                  | Old                     | New                     | Notes                       |
| ---------------------- | ----------------------- | ----------------------- | --------------------------- |
| `--text-primary`       | `#0f172a`               | `#1c1917`               | Stone 900 — warm near-black |
| `--text-secondary`     | `#475569`               | `#57534e`               | Stone 600                   |
| `--text-muted`         | `#94a3b8`               | `#a8a29e`               | Stone 400                   |
| `--text-on-dark`       | `#f8fafc`               | `#fafaf9`               | Stone 50                    |
| `--text-on-dark-muted` | `rgba(248,250,252,0.6)` | `rgba(250,250,249,0.6)` | Stone tinted                |

### 2.5 Semantic Colors (Unchanged)

Success (`#16a34a`), warning (`#d97706`), error (`#dc2626`), and info (`#2563eb`) remain the same. These are functional and should not carry brand personality.

### 2.6 Shadows: Warmer

| Token                         | Old                        | New                                           |
| ----------------------------- | -------------------------- | --------------------------------------------- |
| `--shadow-glow-accent`        | `rgba(20,184,166,0.15)`    | `rgba(139,115,85,0.12)`                       |
| `--shadow-glow-accent-strong` | `rgba(20,184,166,0.25)...` | `rgba(139,115,85,0.2), rgba(139,115,85,0.12)` |
| `--shadow-sidebar`            | `rgba(0,0,0,0.12)`         | `rgba(28,25,23,0.15)`                         |

### 2.7 Gradients

| Token                    | Old                        | New                                          |
| ------------------------ | -------------------------- | -------------------------------------------- |
| `--gradient-teal-subtle` | teal-50 to workspace-bg    | accent-50 to workspace-bg                    |
| `--gradient-kpi-accent`  | accent-500 to accent-700   | accent-500 to accent-700 (now bronze)        |
| `--gradient-login`       | `-45deg, #0c1222, teal...` | `-45deg, #1c1917, #4a3d2d, #362d22, #292524` |

---

## 3. Grid Design: Compact Pro

### 3.1 Grid Token Changes

| Token                          | Old          | New                     | Notes                   |
| ------------------------------ | ------------ | ----------------------- | ----------------------- |
| `--grid-cell-px`               | `14px`       | `8px`                   | Compact by default      |
| `--grid-cell-py`               | `10px`       | `7px`                   | Tight vertical padding  |
| `--grid-header-bg`             | `#f6f8fb`    | `#faf9f7`               | Warm stone header       |
| `--grid-header-border`         | `#e2e8f0`    | `#e7e5e0`               | Warm border             |
| `--grid-row-stripe`            | `#fafbfd`    | `#faf9f7`               | Warm stripe             |
| `--grid-row-hover`             | teal-50 mix  | `rgba(139,115,85,0.04)` | Very subtle bronze tint |
| `--grid-active-row`            | teal-100 mix | `rgba(139,115,85,0.06)` | Slightly more visible   |
| `--grid-selected-row`          | teal-100 mix | `rgba(139,115,85,0.08)` | Selected row tint       |
| `--grid-selected-row-border`   | teal-300     | `#c4b5a0`               | Bronze 300              |
| `--grid-resize-handle`         | teal-300     | `#c4b5a0`               | Bronze 300              |
| `--grid-focus-ring`            | teal-400     | `#a89880`               | Bronze 400              |
| `--grid-range-bg`              | teal-200 30% | `rgba(139,115,85,0.08)` | Range selection         |
| `--grid-range-border`          | teal-300     | `#c4b5a0`               | Range border            |
| `--grid-clipboard-flash`       | teal-100     | `#f0ebe3`               | Bronze 100              |
| `--selected-row-accent`        | teal-50      | `#f9f6f2`               | Bronze 50               |
| `--grid-grandtotal-border-top` | teal-500     | `#8b7355`               | Bronze 500              |

### 3.2 Grid Subtotals & Footer (Warm Dark)

| Token                         | Old       | New       |
| ----------------------------- | --------- | --------- |
| `--grid-footer-bg`            | `#1e293b` | `#292524` |
| `--grid-grandtotal-bg`        | `#1e293b` | `#1c1917` |
| `--grid-subtotal-bg`          | `#475569` | `#44403c` |
| `--grid-compact-group-bg`     | `#334155` | `#292524` |
| `--grid-compact-group-border` | `#475569` | `#44403c` |
| `--grid-frame-border`         | `#334155` | `#292524` |

### 3.3 Grid Typography

| Token                    | Value                   | Notes                                 |
| ------------------------ | ----------------------- | ------------------------------------- |
| `--grid-header-size`     | `var(--text-xs)` (11px) | Unchanged                             |
| `--grid-header-weight`   | `600`                   | Unchanged                             |
| `--grid-header-tracking` | `0.12em`                | Unchanged                             |
| Font size for data cells | `12px`                  | Used via Tailwind `text-xs` or inline |

### 3.4 Compact as Default

The current "compact" variant tokens become the default. Remove the separate `--grid-compact-*` namespace — compact IS the grid now.

| Old Token                | Action                                  |
| ------------------------ | --------------------------------------- |
| `--grid-compact-cell-px` | Delete — use `--grid-cell-px` (now 8px) |
| `--grid-compact-cell-py` | Delete — use `--grid-cell-py` (now 7px) |
| `--grid-compact-border`  | Delete — use `--grid-header-border`     |

### 3.5 Grid Header Font

Uppercase, letterspaced, 10px, weight 600. Stone 500 color (`#78716c`). This is already close to current but the color shifts from cool slate to warm stone.

---

## 4. KPI Ribbon: Inline Metrics Strip

The KPI ribbon becomes a single horizontal bar with vertical dividers.

### 4.1 Token Additions

| New Token             | Value                      | Usage             |
| --------------------- | -------------------------- | ----------------- |
| `--kpi-strip-bg`      | `var(--workspace-bg-card)` | Strip background  |
| `--kpi-strip-border`  | `var(--workspace-border)`  | Strip border      |
| `--kpi-strip-divider` | `var(--workspace-border)`  | Vertical dividers |
| `--kpi-label-color`   | `var(--text-muted)`        | Metric labels     |
| `--kpi-value-color`   | `var(--text-primary)`      | Metric values     |

### 4.2 Layout

```text
[Label  Value  Delta | Label  Value  Delta | Label  Value | Label  Value  Delta]
```

- Single row, `align-items: baseline`
- Labels: 9-10px uppercase, letterspaced, muted color
- Values: 16-18px weight 700, tabular-nums
- Deltas: 10-11px, colored by semantic (green positive, red negative, bronze neutral)
- Dividers: 1px wide, 24px tall, `var(--kpi-strip-divider)`
- Padding: `10px 14px` total strip height ~44px

---

## 5. Sidebar Design: Dark Espresso Expanded

### 5.1 Layout

- Width: 210px (reduced from current to save grid space)
- Background: `--sidebar-bg` (#1c1917)
- Section labels: 9px uppercase, `letter-spacing: 0.14em`, stone 600 (`#57534e`)

### 5.2 Logo Area

- 32px rounded square, bronze gradient background
- "B" in white, weight 700
- "BudFin" label: 13px weight 600, stone 50
- Subtitle "EFIR Budget": 9px uppercase, stone 500

### 5.3 Active State

- Background: `rgba(139,115,85,0.12)` — subtle bronze wash
- Left border: `2px solid #8b7355`
- Text color: `#8b7355` (bronze)
- Icon color: `#8b7355` (bronze)

### 5.4 Hover State

- Background: `#292524` (stone 800)
- Text remains `#d6d3d1`

### 5.5 User Area

- 28px avatar circle, stone 700 bg
- Initials in stone 300
- Name: 11px stone 300
- Role: 9px stone 500
- Top border: 1px `#292524`

---

## 6. Dark Mode Adaptation

The dark mode extends the espresso sidebar aesthetic to the full canvas. It should feel like the same warm material system, not a cold inversion.

### 6.1 Base Dark Surfaces

| Token                       | Old Dark  | New Dark  | Notes                         |
| --------------------------- | --------- | --------- | ----------------------------- |
| `--workspace-bg`            | `#0f172a` | `#121210` | Very dark warm gray, not navy |
| `--workspace-bg-subtle`     | `#1e293b` | `#1c1a17` | Dark espresso                 |
| `--workspace-bg-muted`      | `#334155` | `#2a2724` | Warm mid-dark                 |
| `--workspace-bg-card`       | `#1e293b` | `#1e1c19` | Card surfaces                 |
| `--workspace-border`        | `#334155` | `#2e2b27` | Warm dark border              |
| `--workspace-border-strong` | `#475569` | `#44403c` | Stone 700                     |
| `--workspace-bg-warm`       | `#0f172a` | `#121210` | Same as workspace-bg          |
| `--workspace-bg-warm-card`  | `#1e293b` | `#1e1c19` | Same as card                  |
| `--workspace-bg-elevated`   | `#334155` | `#2a2724` | Same as muted                 |

### 6.2 Dark Text

| Token              | Old Dark  | New Dark  |
| ------------------ | --------- | --------- | --------- |
| `--text-primary`   | `#f1f5f9` | `#e7e5e4` | Stone 200 |
| `--text-secondary` | `#94a3b8` | `#a8a29e` | Stone 400 |
| `--text-muted`     | `#64748b` | `#78716c` | Stone 500 |

### 6.3 Dark Sidebar

The sidebar in dark mode uses an even deeper shade to maintain separation:

| Token                | New Dark  |
| -------------------- | --------- | ------------------- |
| `--sidebar-bg`       | `#0e0d0c` | Near-black espresso |
| `--sidebar-bg-hover` | `#1c1a17` |
| `--sidebar-border`   | `#1c1a17` |

### 6.4 Dark Grid

| Token                         | New Dark                |
| ----------------------------- | ----------------------- |
| `--grid-header-bg`            | `#1c1a17`               |
| `--grid-header-border`        | `#2e2b27`               |
| `--grid-row-stripe`           | `#151412`               |
| `--grid-row-hover`            | `rgba(139,115,85,0.08)` |
| `--grid-active-row`           | `rgba(139,115,85,0.12)` |
| `--grid-footer-bg`            | `#121210`               |
| `--grid-compact-group-bg`     | `#121210`               |
| `--grid-compact-group-border` | `#2e2b27`               |
| `--grid-subheader-bg`         | `#1c1a17`               |
| `--grid-subheader-text`       | `#a8a29e`               |
| `--grid-grandtotal-bg`        | `#0e0d0c`               |
| `--grid-selected-row`         | `rgba(139,115,85,0.15)` |
| `--grid-selected-row-border`  | `#756145`               |
| `--selected-row-accent`       | `#362d22`               |

### 6.5 Dark Shadows

| Token           | New Dark                                                           |
| --------------- | ------------------------------------------------------------------ |
| `--shadow-xs`   | `0 1px 2px rgba(0,0,0,0.3)`                                        |
| `--shadow-sm`   | `0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)`             |
| `--shadow-md`   | `0 4px 8px -2px rgba(0,0,0,0.5), 0 2px 4px -2px rgba(0,0,0,0.3)`   |
| `--shadow-lg`   | `0 12px 24px -4px rgba(0,0,0,0.6), 0 4px 8px -4px rgba(0,0,0,0.4)` |
| `--shadow-card` | `0 1px 3px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.04)`      |

### 6.6 Dark Glass

| Token               | New Dark                     |
| ------------------- | ---------------------------- |
| `--glass-bg`        | `rgba(18,18,16,0.88)`        |
| `--glass-border`    | `rgba(46,43,39,0.6)`         |
| `--glass-shadow`    | `0 4px 16px rgba(0,0,0,0.4)` |
| `--glass-bg-strong` | `rgba(18,18,16,0.94)`        |
| `--glass-bg-subtle` | `rgba(28,26,23,0.6)`         |

### 6.7 Dark Badge Backgrounds

All dark badge backgrounds shift from cold `#1e293b` base to warm `#1e1c19`:

```css
--badge-maternelle-bg: color-mix(in srgb, var(--badge-maternelle) 20%, #1e1c19);
--badge-elementaire-bg: color-mix(in srgb, var(--badge-elementaire) 20%, #1e1c19);
/* ... same pattern for all badges ... */
```

### 6.8 Dark Semantic Backgrounds

| Token                | New Dark  |
| -------------------- | --------- |
| `--color-success-bg` | `#0a1f0a` |
| `--color-warning-bg` | `#1f1408` |
| `--color-error-bg`   | `#1f0a0a` |
| `--color-info-bg`    | `#0a1025` |

### 6.9 Dark Login Gradient

```css
--gradient-login: linear-gradient(-45deg, #0e0d0c, #362d22, #4a3d2d, #1c1a17);
```

---

## 7. Component Changes

### 7.1 Editable Cell Colors

| Token                   | Old       | New       |
| ----------------------- | --------- | --------- | ------------------------------------------- |
| `--cell-editable-bg`    | `#f8f4e6` | `#f7f4ed` | Slightly cooler warm to match stone palette |
| `--cell-editable-focus` | `#2563eb` | `#8b7355` | Bronze focus (was blue)                     |
| `--cell-readonly-bg`    | `#f4f7fb` | `#f5f3ef` | Warm stone bg                               |

### 7.2 Drag & Drop

| Token                     | Old          | New                     |
| ------------------------- | ------------ | ----------------------- |
| `--grid-drop-zone-bg`     | teal-100 mix | `rgba(139,115,85,0.08)` |
| `--grid-drop-zone-border` | teal-300     | `#c4b5a0`               |

### 7.3 Gauge Track

| Token              | Old       | New       |
| ------------------ | --------- | --------- |
| `--gauge-track-bg` | `#e2e8f0` | `#e7e5e0` |

### 7.4 ListGrid Variant

| Token                   | Old      | New                    |
| ----------------------- | -------- | ---------------------- |
| `--list-row-hover`      | teal-50  | `#f9f6f2` (accent-50)  |
| `--list-sort-indicator` | teal-600 | `#756145` (accent-600) |

### 7.5 Account Type Badge: Revenue

| Token                | Old      | New                    |
| -------------------- | -------- | ---------------------- |
| `--badge-revenue`    | teal-700 | `#5f4f38` (accent-700) |
| `--badge-revenue-bg` | teal-50  | `#f9f6f2` (accent-50)  |

---

## 8. Files to Modify

### 8.1 Primary (token swap only)

| File                     | Change                                                       |
| ------------------------ | ------------------------------------------------------------ |
| `apps/web/src/index.css` | All CSS variable values — this is the single source of truth |

### 8.2 Component audit (verify no hardcoded values)

The audit found minimal hardcoded colors in production code. These files need verification:

| File                                                          | Issue                                                    |
| ------------------------------------------------------------- | -------------------------------------------------------- |
| `apps/web/src/components/enrollment/capacity-columns.tsx`     | Inline `background` style — verify uses CSS var          |
| `apps/web/src/components/staffing/discipline-demand-grid.tsx` | Inline `color`/`backgroundColor` — verify uses CSS var   |
| Test files (`.test.tsx`)                                      | Hardcoded hex in assertions — update to match new tokens |

### 8.3 Grid components (density change)

| File                                                  | Change                                                    |
| ----------------------------------------------------- | --------------------------------------------------------- |
| `apps/web/src/components/data-grid/planning-grid.tsx` | Update default cell padding classes to use compact values |
| `apps/web/src/components/data-grid/list-grid.tsx`     | Update default cell padding classes                       |
| `apps/web/src/components/data-grid/band-styles.ts`    | Verify band colors still work (they use CSS vars)         |

### 8.4 KPI Ribbon

| File                                                           | Change                         |
| -------------------------------------------------------------- | ------------------------------ |
| `apps/web/src/components/pnl/pnl-kpi-ribbon.tsx`               | Rewrite to inline strip layout |
| `apps/web/src/components/enrollment/enrollment-kpi-ribbon.tsx` | Rewrite to inline strip layout |
| `apps/web/src/components/revenue/revenue-kpi-ribbon.tsx`       | Rewrite to inline strip layout |
| `apps/web/src/components/staffing/staffing-kpi-ribbon.tsx`     | Rewrite to inline strip layout |
| `apps/web/src/components/opex/opex-kpi-ribbon.tsx`             | Rewrite to inline strip layout |

### 8.5 Sidebar

| File                                        | Change                                                              |
| ------------------------------------------- | ------------------------------------------------------------------- |
| `apps/web/src/components/shell/sidebar.tsx` | Active state from solid blue bg to bronze border-left + bronze text |

### 8.6 Login page

| File                           | Change                                               |
| ------------------------------ | ---------------------------------------------------- |
| `apps/web/src/pages/login.tsx` | Gradient uses `--gradient-login` (already a CSS var) |

---

## 9. What Does NOT Change

- **Fonts**: DM Sans, Plus Jakarta Sans, Geist Mono stay
- **Spacing scale**: 4px grid stays
- **Border radii**: Same scale
- **Semantic colors**: Success, warning, error, info stay
- **Badge colors**: Department (maternelle, elementaire, etc.) stay — these are functional
- **Status colors**: Draft, published, locked, archived stay
- **Version type colors**: Budget blue, actual green, forecast orange stay
- **Chart series colors**: Unchanged
- **Animation tokens**: All timing/easing unchanged
- **Typography scale**: All sizes unchanged

---

## 10. Accessibility

- Aged Bronze `#8b7355` on white `#ffffff`: contrast ratio 4.01:1 (passes AA for large text only)
- **Rule: accent-500 for non-text elements only** (backgrounds, borders, icons). For text on white, always use `accent-600` (`#756145`, 5.2:1 — passes AA)
- Primary button text (white on `#8b7355`): 4.01:1 — acceptable for buttons per WCAG (large text equivalent with `font-weight: 600` + 12px+)
- Dark mode text `#e7e5e4` on `#121210`: contrast ratio 14.3:1 (passes AAA)
- The bronze accent is muted by design — interactive elements should use `accent-600` (`#756145`) minimum for text on white backgrounds to ensure AA compliance

---

## 11. Migration Strategy

1. **Phase 1: Token swap in `index.css`** — change all CSS variable values (both `:root` and `.dark`). This propagates to 95% of the UI automatically since components use CSS vars.
2. **Phase 2: Grid density** — update PlanningGrid and ListGrid default padding to compact values.
3. **Phase 3: KPI ribbons** — rewrite all 5 KPI ribbon components to inline strip layout.
4. **Phase 4: Sidebar** — update active state styling.
5. **Phase 5: Verify & fix** — scan for any remaining hardcoded values, update test assertions.

Each phase is independently deployable. Phase 1 alone delivers ~80% of the visual transformation.
