# Revenue Workspace Refactoring Plan & Best-In-Class Comparative Analysis

## 1. Executive Summary

The Revenue module is the financial engine of BudFin, converting simulated enrollment figures (from the Enrollment module) into projected school income. Following the decision to separate domain logic, Revenue will now independently manage complete Tariff breakdown logic based on Nationality/Family structure, alongside the core Fee Grids and Discount policies.

This plan mirrors the **"Continuous Planning Board"** architecture proposed for Enrollment, utilizing TanStack React Table as the headless driver for ultra-high-density, Excel-like interaction without breaking the existing BudFin App Shell.

---

## 2. Functional Business Logic (from Excel & PRD)

### 2.1 Inputs (Yellow Cells)

- **Tariff/Nationality Ratios:** Proportion of students who are _Full Price (Plein)_, _Staff Children (RP)_, or _3+ Siblings (R3+)_, split across _Francais, Nationaux, Autres_.
- **Discount Policy Parameters:** Hardcoded percent discounts applied to RP and R3+ (e.g., `0.75` / 75%).
- **Fee Grid (Tuition):** Raw SAR entry for DAI (First-time Enrollment Fee) and Base Tuition per academic band (PS, Maternelle, Elementaire, College, Lycee).
- **Other Revenues:** Fixed input assumptions (e.g., Canteen, Bus, Exam fees).

### 2.2 Outputs (Live Calculated)

- **Effective Rate Card:** Real SAR discounts computed mechanically per student.
- **Total Revenue HT / TTC:** Calculated by multiplying the Tariff breakdown grid by the Effective Rate Card.

---

## 3. UI/UX "Continuous Board" Architecture

Just like the Enrollment panel, we construct a "Board" strictly respecting the Left Main Nav and Top Context Bar. No nested tabs; users scroll naturally through dependent grid blocks.

### 3.1 ASCII Mockup of the Revenue Workspace

```text
====================================================================================================
[ MAIN LEFT ]    [ GLOBAL CONTEXT BAR: FY2026 | Budget V1 | Period... ]          [ RIGHT PANEL ]
[    NAV    ]    ======================================================          [ (Audit,     ]
|           |    [ KPI: Total Tuition HT | Total Gross | Avg Net / Stdnt]          |  Prop.. )   |
| Dashboard |    [    SAR 52,431,215     | SAR 58M     |   SAR 30,000   ]          |             |
| Planning  |    ------------------------------------------------------          |             |
|   Enroll  |    [ Module Switch: (o) Academic Income  ( ) Other Revenues ]      |             |
|   Revenue |                                                                    |             |
|   Staff   |    +--- BLOCK A: TARIFF ASSIGNMENT (Nationality x Tariff) -------+ |             |
| Master D. |    |           |       Francais         |     Nationaux        | |             |
| Admin     |    | Grade     | [ RP ] [ R3+ ] [Plein] | [ RP ] [ R3+ ] [Plei]| |             |
|           |    |-------+---+--------+-------+-------+--------+-------+-----| |             |
|           |    | PS (65)   | [  1 ] [  6  ] [  17 ] | [  0 ] [  1  ] [ 1 ] | |             |
|           |    | MS (77)   | [  1 ] [  8  ] [  18 ] | [  0 ] [  1  ] [ 1 ] | |             |
|           |    +-------------------------------------------------------------+ |             |
|           |                                                                    |             |
|           |    +--- BLOCK B: ASSUMPTIONS & FEE GRID (Live Preview) ----------+ |             |
|           |    |             | DAI (TTC)| Tuition HT | Disc RP | Disc R3+  | |             |
|           |    |-------------+----------+------------+---------+-----------| |             |
|           |    | Globals     |          |            | [ 75% ] | [ 75% ]   | |             |
|           |    | PS          | [ 5000 ] | [ 26,086 ] | (19,565)| (19,565)  | |             |
|           |    | Maternelle  | [ 5000 ] | [ 30,000 ] | (22,500)| (22,500)  | |             |
|           |    +-------------------------------------------------------------+ |             |
====================================================================================================
```

### 3.2 Engineering the Layout with TanStack Table

To answer the pressing architectural question: **TanStack Table is the core engine for this design.**
Tabs were not the issue; burying context _inside_ exclusive tabs was the issue.
By mounting two or three `TanStack` grid instances directly underneath each other on a single scrolling page (Block A, Block B), we get:

1. **Editable Cells:** Yellow background `<input>` fields wired to `useReactTable`'s custom `meta` properties.
2. **Headless Speed:** Pressing Tab moves the cursor quickly through Block A.
3. **Optimistic Updates:** Changing `[ 75% ]` in Block B immediately recalculates the `(19,565)` read-only cells via derived state, before the Fastify server responds.

---

## 4. Implementation Steps (Revenue)

### Phase 1: Migrate Tariff Distribution

- Extract `<ByTariffGrid />` and `<ByNationalityGrid />` from the Enrollment page.
- Combine them into a single, high-density matrix (Block A) where the user sets `RP / R3+ / Plein` per Nationality per Grade.
- _Note on API:_ This connects to the `DetailEntry` REST endpoints smoothly.

### Phase 2: Assumptions & Fee Grid Integration

- Build Block B using TanStack Table.
- Rows are Grade _Bands_ (`PS`, `Maternelle`, `Elementaire`).
- Columns are editable `DAI`, `Tuition HT` (which computes `TTC` based on VAT globally), and editable Discount Factors.

### Phase 3: The KPI Ribbon

- Hook up `useCalculateRevenue` directly to the sticky top ribbon.
- Whenever the TanStack grids trigger an `onBlur` HTTP PUT, the Query invalidation causes the KPI ribbon to quickly spin and update the `Total Tuition HT` macro-number.

---

_End of Document_
