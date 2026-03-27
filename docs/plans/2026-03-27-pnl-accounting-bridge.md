# P&L Accounting Bridge Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a configurable mapping layer that transforms BudFin's analytical P&L into an IFRS-structured accounting P&L, enabling budget vs prior-year-actual comparison with profit center reporting.

**Architecture:** A pure-function transformation service sits between the existing `MonthlyPnlLine` data and a new IFRS presentation layer. No changes to existing calculation engines. New Prisma models store the mapping configuration and historical actuals. Three new frontend pages: COA master data (Management Shell), P&L mapping editor (Management Shell), rebuilt P&L page (Planning Shell).

**Tech Stack:** Prisma 6, Fastify 5, Zod 4, fastify-type-provider-zod, decimal.js, React 19, TanStack Query, TanStack Table v8, shadcn/ui, Tailwind CSS v4, dnd-kit (drag-and-drop)

**Spec:** `docs/specs/2026-03-27-pnl-accounting-bridge-design.md`

---

## Chunk 1: Data Model, Migration & Seed Data

### Task 1: Add new Prisma enums and models

**Files:**

- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Add ProfitCenter enum and extend ChartOfAccount**

Add after the existing `AccountStatus` enum (around line 196):

```prisma
enum ProfitCenter {
  MATERNELLE
  ELEMENTAIRE
  COLLEGE
  LYCEE

  @@map("profit_center")
}
```

Add three fields to `ChartOfAccount` (after `updatedBy`, before relations):

```prisma
  parentCode   String?       @map("parent_code") @db.VarChar(10)
  profitCenter ProfitCenter? @map("profit_center")
  isSystem     Boolean       @default(false) @map("is_system")
```

- [ ] **Step 2: Add new enums for mapping models**

Add after the `ProfitCenter` enum:

```prisma
enum AnalyticalKeyType {
  CATEGORY
  LINE_ITEM

  @@map("analytical_key_type")
}

enum MappingVisibility {
  SHOW
  GROUP
  EXCLUDE

  @@map("mapping_visibility")
}

enum AllocationMethod {
  DIRECT
  HEADCOUNT
  MANUAL

  @@map("allocation_method")
}

enum ActualSource {
  SEED
  MANUAL

  @@map("actual_source")
}
```

- [ ] **Step 3: Add PnlTemplate model**

Add after the `ChartOfAccount` model:

```prisma
model PnlTemplate {
  id        Int      @id @default(autoincrement())
  name      String   @db.VarChar(100)
  isDefault Boolean  @default(false) @map("is_default")
  isSystem  Boolean  @default(false) @map("is_system")
  version   Int      @default(1)
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz
  createdBy Int      @map("created_by")
  updatedBy Int      @map("updated_by")

  creator  User                @relation("TemplateCreator", fields: [createdBy], references: [id])
  updater  User                @relation("TemplateUpdater", fields: [updatedBy], references: [id])
  sections PnlTemplateSection[]

  @@map("pnl_templates")
}
```

Add the User reverse-relations to the User model (after the existing account relations):

```prisma
  createdTemplates  PnlTemplate[] @relation("TemplateCreator")
  updatedTemplates  PnlTemplate[] @relation("TemplateUpdater")
```

- [ ] **Step 4: Add PnlTemplateSection model**

```prisma
model PnlTemplateSection {
  id              Int     @id @default(autoincrement())
  templateId      Int     @map("template_id")
  sectionKey      String  @map("section_key") @db.VarChar(40)
  displayLabel    String  @map("display_label") @db.VarChar(100)
  displayOrder    Int     @map("display_order") @db.SmallInt
  isSubtotal      Boolean @default(false) @map("is_subtotal")
  subtotalFormula String? @map("subtotal_formula") @db.VarChar(200)
  signConvention  String  @default("POSITIVE") @map("sign_convention") @db.VarChar(10)

  template PnlTemplate         @relation(fields: [templateId], references: [id], onDelete: Cascade)
  mappings PnlAccountMapping[]

  @@unique([templateId, sectionKey], map: "uq_template_section")
  @@map("pnl_template_sections")
}
```

- [ ] **Step 5: Add PnlAccountMapping model**

```prisma
model PnlAccountMapping {
  id                     Int               @id @default(autoincrement())
  sectionId              Int               @map("section_id")
  analyticalKey          String            @map("analytical_key") @db.VarChar(80)
  analyticalKeyType      AnalyticalKeyType @map("analytical_key_type")
  accountCode            String?           @map("account_code") @db.VarChar(10)
  monthFilter            Int[]             @map("month_filter") @db.SmallInt
  displayLabel           String?           @map("display_label") @db.VarChar(120)
  visibility             MappingVisibility @default(SHOW)
  displayOrder           Int               @map("display_order") @db.SmallInt
  profitCenterAllocation AllocationMethod  @default(HEADCOUNT) @map("profit_center_allocation")
  manualAllocation       Json?             @map("manual_allocation")

  section PnlTemplateSection @relation(fields: [sectionId], references: [id], onDelete: Cascade)
  account ChartOfAccount?    @relation(fields: [accountCode], references: [accountCode])

  @@unique([sectionId, analyticalKey, accountCode], map: "uq_mapping_key")
  @@map("pnl_account_mappings")
}
```

Add the reverse relation to `ChartOfAccount`:

```prisma
  mappings PnlAccountMapping[]
```

- [ ] **Step 6: Add HistoricalActual model**

```prisma
model HistoricalActual {
  id           Int          @id @default(autoincrement())
  fiscalYear   Int          @map("fiscal_year") @db.SmallInt
  accountCode  String       @map("account_code") @db.VarChar(10)
  annualAmount Decimal      @default(0) @map("annual_amount") @db.Decimal(15, 4)
  q1Amount     Decimal?     @map("q1_amount") @db.Decimal(15, 4)
  q2Amount     Decimal?     @map("q2_amount") @db.Decimal(15, 4)
  q3Amount     Decimal?     @map("q3_amount") @db.Decimal(15, 4)
  source       ActualSource @default(MANUAL)
  importedAt   DateTime     @default(now()) @map("imported_at") @db.Timestamptz

  account ChartOfAccount @relation(fields: [accountCode], references: [accountCode], onDelete: Restrict)

  @@unique([fiscalYear, accountCode], map: "uq_historical_actual")
  @@map("historical_actuals")
}
```

Add reverse relation to `ChartOfAccount`:

```prisma
  historicalActuals HistoricalActual[]
```

- [ ] **Step 7: Run migration**

```bash
pnpm --filter @budfin/api exec prisma migrate dev --name add-pnl-accounting-bridge
```

Expected: Migration created, `prisma generate` runs automatically.

- [ ] **Step 8: Verify schema compiles**

```bash
pnpm --filter @budfin/api exec prisma generate
```

Expected: No errors.

- [ ] **Step 9: Commit**

```bash
git add apps/api/prisma/
git commit -m "feat(db): add P&L accounting bridge models

Add PnlTemplate, PnlTemplateSection, PnlAccountMapping, HistoricalActual
models. Extend ChartOfAccount with parentCode, profitCenter, isSystem.
New enums: ProfitCenter, AnalyticalKeyType, MappingVisibility,
AllocationMethod, ActualSource."
```

---

### Task 2: Seed COA accounts from PDF data

**Files:**

- Create: `apps/api/prisma/seeds/seed-coa-accounts.ts`
- Modify: `apps/api/prisma/seed.ts` (call the new seeder)

- [ ] **Step 1: Create the COA seed data file**

Create `apps/api/prisma/seeds/seed-coa-accounts.ts` with the union of all accounts from
the 2024 and 2025 Compte de Resultat PDFs. Use `upsert` for idempotency.

Reference data (parsed from the PDFs):

**Revenue accounts (7xx):**

```
701100  FACT SCO 1ER TRIMESTRE          REVENUE  Tuition Fees       PROFIT_CENTER
701200  FACT SCO 2EME TRIMESTRE         REVENUE  Tuition Fees       PROFIT_CENTER
701300  FACT SCO 3EME TRIMESTRE         REVENUE  Tuition Fees       PROFIT_CENTER
701400  FACT DAI                        REVENUE  Registration Fees  PROFIT_CENTER
701401  Droit de Premiere Inscription   REVENUE  Registration Fees  PROFIT_CENTER
701410  FACT FRAIS DE DOSSIER           REVENUE  Registration Fees  PROFIT_CENTER
701500  GARDERIE                        REVENUE  Activities         PROFIT_CENTER
701600  APS ETUDES DIRIGEES             REVENUE  Activities         PROFIT_CENTER
701700  STAGE DE NATATION               REVENUE  Activities         PROFIT_CENTER
701800  APS NATATION                    REVENUE  Activities         PROFIT_CENTER
701801  APS FOOT                        REVENUE  Activities         PROFIT_CENTER
701802  APS BASKET BALL                 REVENUE  Activities         PROFIT_CENTER
701803  APS THEATRE EN ARABE            REVENUE  Activities         PROFIT_CENTER
701806  APS ECHEC                       REVENUE  Activities         PROFIT_CENTER
701808  APS ROBOTIQUE                   REVENUE  Activities         PROFIT_CENTER
701809  APS TAEKWONDO                   REVENUE  Activities         PROFIT_CENTER
701810  APS THEATRE EN FRANCAIS         REVENUE  Activities         PROFIT_CENTER
701811  APS PING PONG                   REVENUE  Activities         PROFIT_CENTER
701812  APS MANGA                       REVENUE  Activities         PROFIT_CENTER
701813  APS UN JOUR UNE OEUVRE          REVENUE  Activities         PROFIT_CENTER
701814  RELAXATION SPORT ET MUSIQUE     REVENUE  Activities         PROFIT_CENTER
701815  APS THEATRE EN ANGLAIS          REVENUE  Activities         PROFIT_CENTER
701816  APS MATHEMATIQUES               REVENUE  Activities         PROFIT_CENTER
701817  APS DANSE                       REVENUE  Activities         PROFIT_CENTER
701818  APS PATISSERIE                  REVENUE  Activities         PROFIT_CENTER
701819  APS GYMNASTIQUE                 REVENUE  Activities         PROFIT_CENTER
701820  APS SANTE ET MEDECINE           REVENUE  Activities         PROFIT_CENTER
701821  APS PROGRAMMATION               REVENUE  Activities         PROFIT_CENTER
701822  APS CHANSONS EN ANGLAIS         REVENUE  Activities         PROFIT_CENTER
701823  APS ESPAGNOL                    REVENUE  Activities         PROFIT_CENTER
701825  APS ART PLASTIQUE               REVENUE  Activities         PROFIT_CENTER
707200  FOURNITURES ELEVES REMB         REVENUE  Student Supplies   PROFIT_CENTER
708100  PHOTOS DE CLASSE                REVENUE  Other Revenue      PROFIT_CENTER
708101  AMICALE                         REVENUE  Other Revenue      PROFIT_CENTER
708150  RECETTES BAC                    REVENUE  Examination Fees   PROFIT_CENTER
708151  EPREUVES ANTICIPEES FR          REVENUE  Examination Fees   PROFIT_CENTER
708170  RECETTES BREVET                 REVENUE  Examination Fees   PROFIT_CENTER
71810R  LIVRE LITTERATURE REMB          REVENUE  Student Supplies   PROFIT_CENTER
718200  PERTE DETERIORATION MAN         REVENUE  Student Supplies   PROFIT_CENTER
724317  VOYAGE                          REVENUE  School Trips       PROFIT_CENTER
730000  FACT EVALUATION                 REVENUE  Examination Fees   PROFIT_CENTER
741001  CAISSE DE SOLIDARITE            REVENUE  Other Revenue      PROFIT_CENTER
500011  GAIN DIFFERENCE CHANGE          REVENUE  Other Revenue      PROFIT_CENTER
```

**Expense accounts (6xx):**

```
606001  General Expense                 EXPENSE  General Expense    COST_CENTER
606200  EAU                             EXPENSE  Utilities          COST_CENTER
606420  LOGICIEL ADMINISTRATION         EXPENSE  IT Expenses        COST_CENTER
606500  INFORMATIQUE                    EXPENSE  IT Expenses        COST_CENTER
613100  SCHOOL RENT                     EXPENSE  Rent               COST_CENTER
615100  SCHOOL MAINTENANCE CONTRACT     EXPENSE  Maintenance        COST_CENTER
616000  INSURANCE POLICIES              EXPENSE  Insurance          COST_CENTER
618100  MANUELS SCOLAIRES PRIMAIRE      EXPENSE  Teaching Materials COST_CENTER
618110  MANUELS SCOLAIRES SEC           EXPENSE  Teaching Materials COST_CENTER
618200  LIBRAIRIE BCD                   EXPENSE  Teaching Materials COST_CENTER
618210  LIBRAIRIE SECONDAIRE CDI        EXPENSE  Teaching Materials COST_CENTER
618300  PUPILS SUBSCRIPTIONS BCD        EXPENSE  Teaching Materials COST_CENTER
623100  PHOTOCOPIEUSES                  EXPENSE  Office Expenses    COST_CENTER
625300  CARS MAINTENANCE                EXPENSE  Transport          COST_CENTER
625600  TRAVEL INDEMNITIES              EXPENSE  Travel             COST_CENTER
626000  MAIL EXPENSES                   EXPENSE  Communication      COST_CENTER
626100  PHONE FAX EXPENSES              EXPENSE  Communication      COST_CENTER
627000  BANQUES SERVICES                EXPENSE  Bank Charges       COST_CENTER
627003  MOYASAR CHARGES                 EXPENSE  Bank Charges       COST_CENTER
628000  AUTRES SERVICES EXTERIEURS      EXPENSE  Other Services     COST_CENTER
631300  FORMATION CONTINUE              EXPENSE  Training           COST_CENTER
631310  FORMATEUR RECU A EFIR           EXPENSE  Training           COST_CENTER
631320  MISSION ETABLISSEMENT           EXPENSE  Training           COST_CENTER
641100  FRENCH TEACHERS SALARIES        EXPENSE  Staff Costs        COST_CENTER
641120  HS FRENCH TEACHERS SAL          EXPENSE  Staff Costs        COST_CENTER
641200  FRENCH REPLACEMENT SALARY       EXPENSE  Staff Costs        COST_CENTER
641300  GARDERIE SALARIES               EXPENSE  Staff Costs        COST_CENTER
641400  ADMINISTRATION SALARIES         EXPENSE  Staff Costs        COST_CENTER
641401  APS SALARIES                    EXPENSE  Staff Costs        COST_CENTER
641410  DEPENSE ETUDES DIRIGEES         EXPENSE  Staff Costs        COST_CENTER
641420  HS ADMINISTRATION SAL           EXPENSE  Staff Costs        COST_CENTER
645100  GOSI PAYMENT                    EXPENSE  Employer Charges   COST_CENTER
648000  AGENCE ENSEIGNEMENT FR          EXPENSE  AEFE Fees          COST_CENTER
648010  CONTRIBUTION FRAIS SCO          EXPENSE  PFC                COST_CENTER
648030  PRIME                           EXPENSE  Staff Costs        COST_CENTER
666000  PERTE DE CHANGE                 EXPENSE  Finance Costs      COST_CENTER
670000  PERTE FINANCIERE                EXPENSE  Finance Costs      COST_CENTER
671200  PENALITES AMENDES               EXPENSE  Other Expenses     COST_CENTER
672000  CHARGES EXERCICES ANT           EXPENSE  Other Expenses     COST_CENTER
681100  DEPRECIATION                    EXPENSE  Depreciation       COST_CENTER
681700  PROVISION BAD DEBT              EXPENSE  Provisions         COST_CENTER
681750  PROVISION END OF SERVICE        EXPENSE  Provisions         COST_CENTER
685000  ARRONDISSEMENT                  EXPENSE  Rounding           COST_CENTER
687500  PROVISION RH NOUVELLE ECOLE     EXPENSE  Provisions         COST_CENTER
```

**Other revenue (7xx):**

```
766000  GAIN DE CHANGE                  REVENUE  Finance Income     PROFIT_CENTER
770000  REVENUS FINANCIERS              REVENUE  Finance Income     PROFIT_CENTER
771000  MISC REVENUES                   REVENUE  Other Revenue      PROFIT_CENTER
772000  PRODUITS EXERCICES ANT          REVENUE  Other Revenue      PROFIT_CENTER
775000  PRODUITS CESSIONS ACTIF         REVENUE  Other Revenue      PROFIT_CENTER
785000  ROUNDING                        REVENUE  Rounding           PROFIT_CENTER
```

The seed function should:

1. Define the accounts array with all fields
2. Use `prisma.chartOfAccount.upsert()` for each, keyed on `accountCode`
3. Set `isSystem: true` and `createdBy: 1` (admin user)

- [ ] **Step 2: Add call to seed.ts**

In `apps/api/prisma/seed.ts`, import and call `seedCoaAccounts(prisma)` after existing seeds.

- [ ] **Step 3: Run seed to verify**

```bash
pnpm --filter @budfin/api exec prisma db seed
```

Expected: ~80 accounts seeded without errors.

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/seeds/seed-coa-accounts.ts apps/api/prisma/seed.ts
git commit -m "feat(seed): add COA accounts from 2024/2025 accounting data"
```

---

### Task 3: Seed historical actuals from PDF data

**Files:**

- Create: `apps/api/prisma/seeds/seed-historical-actuals.ts`
- Modify: `apps/api/prisma/seed.ts`

- [ ] **Step 1: Create the historical actuals seed file**

Create `apps/api/prisma/seeds/seed-historical-actuals.ts` with amounts parsed from
both PDFs. Each row: `{ fiscalYear, accountCode, annualAmount, source: 'SEED' }`.

**2024 data (from Compte de resultat au 31_12_2024.pdf):**

Revenue side:

```
701100  23798253.01
701200  16916546.42
701300  17058330.65
701400   6897977.47
701401    279333.33
701410    552839.06
701500    205073.13  (note: 11200.00 shown separately but the total is 205073.13)
701600     28121.70
701700      4086.97
701800    265365.39
701801    409166.70
701802     85304.34
701803     22271.68
701806     62797.72
701808    110478.58
701809      2521.73
701810     21793.45
701811      8030.43
701812     12365.17
701813      5247.83
701814      1739.12
701815     21697.78
701816      1913.02
701817      4900.00
701818     33950.00
701819    147000.00
701820      6650.00
701821     16200.00
701822      4550.00
701823       700.00  (negative in PDF — credit)
707200    171209.90
708101      1980.00
708150    171506.05
708151     75500.00
708170     52086.17
71810R    462533.42
718200      6358.87
724317   1935608.53
730000     12800.00
741001     15552.24
766000    107519.35
770000    432478.65
771000     10840.94
772000    147173.42
775000         0.99
785000         8.18  (negative)
500011         0.02  (negative)
```

Expense side:

```
606001   6906936.55
606200     15004.25
606420     24434.35
606500     29825.17
613100   7631145.33
615100   3591009.97
616000    195526.60
618100     24713.69
618110     85643.21
618200      6613.93
618210     11731.56
618300       662.31
623100     48085.29
625300      5167.57
625600    139400.00
626000       420.15
626100       230.00
627000      7309.93
627003    287021.11
631300    364820.51
631310     36359.23
631320      3848.47
641100  15791553.85
641120    613865.00
641200    257539.00
641300     54763.00
641400   6022008.00
641401    476193.00
641410     33301.00
641420     15026.00
645100     42444.33
648000   6283917.48
648010   4611966.72
648030   1178250.00
666000    244708.52
670000        10.34
672000       978.00  (negative)
681100   3612073.00
681700    966521.00
681750    957709.00
685000        14.94  (negative)
687500  10000000.00
```

**2025 data (from Compte de resultat au 31_12_2025.pdf):**

Revenue side:

```
701100  23222295.31
701200  17543728.63
701300  18065118.38
701400   7361859.02
701401    763679.67
701410    341184.00
701500     30000.00
701600     32826.08
701800    347340.23
701801    351700.00
701802      3000.00  (negative)
701803     17125.21
701806     91962.52
701808     77800.00
701810     18021.73
701811      4537.50
701813      4840.00
701815      7865.00
701818     83618.76
701819    133700.00
701820      7260.00
701821     36180.00
701822      2675.00
701823       700.00
701825     48261.16
707200    197483.82
708100    124906.35
708150    221443.03
708151     90250.00
708170     60250.00
71810R    254116.18
718200      5165.22
724317   3832286.75
730000       200.00
766000     88307.62
770000    474412.74
771000    153942.61
772000     14004.00
785000         0.39  (negative)
```

Expense side:

```
606001  10680823.89
606420     26603.18
613100   8395516.00
615100   2783446.97
616000    165852.00
623100     10944.00
625300      9746.15
625600    151400.00
627000    241301.93
627003    714581.08
628000    216775.62
631300    210682.22
631310     20018.69  (negative)
631320      4453.22  (negative)
641100  14981293.38
641120   1207270.00
641200    267234.00
641300     55225.00
641400   6960074.83
641401    531351.15
641410     39877.50
641420     65530.00
645100     73457.94
648000   7636202.58
648010   3940546.97
648030    239750.00
666000    724211.72
670000     16130.02
671200      1000.00
681100   5283921.00
681750   2771399.33
685000         7.70
687500   5730000.00
```

Use `upsert` keyed on `@@unique([fiscalYear, accountCode])`.

- [ ] **Step 2: Add call to seed.ts**

Call `seedHistoricalActuals(prisma)` after COA seed (accounts must exist first).

- [ ] **Step 3: Run seed to verify**

```bash
pnpm --filter @budfin/api exec prisma db seed
```

Expected: ~160 historical actual rows seeded.

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/seeds/seed-historical-actuals.ts apps/api/prisma/seed.ts
git commit -m "feat(seed): add 2024/2025 historical actuals from accounting PDFs"
```

---

### Task 4: Seed default IFRS template with mappings

**Files:**

- Create: `apps/api/prisma/seeds/seed-pnl-template.ts`
- Modify: `apps/api/prisma/seed.ts`

- [ ] **Step 1: Create the template seed file**

Create `apps/api/prisma/seeds/seed-pnl-template.ts`. This seeds:

1. One `PnlTemplate` named "EFIR IFRS P&L" with `isDefault: true`, `isSystem: true`
2. 14 `PnlTemplateSection` rows (see spec Section 5)
3. ~60 `PnlAccountMapping` rows (see spec Section 6)

Use nested `create` within the template upsert to seed sections and mappings together.

Template sections:

```typescript
const sections = [
    {
        sectionKey: 'REVENUE',
        displayLabel: 'Revenue',
        displayOrder: 10,
        isSubtotal: false,
        signConvention: 'POSITIVE',
    },
    {
        sectionKey: 'COST_OF_SERVICE',
        displayLabel: 'Cost of Service',
        displayOrder: 20,
        isSubtotal: false,
        signConvention: 'NEGATIVE',
    },
    {
        sectionKey: 'GROSS_PROFIT',
        displayLabel: 'Gross Profit',
        displayOrder: 30,
        isSubtotal: true,
        subtotalFormula: 'REVENUE - COST_OF_SERVICE',
        signConvention: 'POSITIVE',
    },
    {
        sectionKey: 'PFC_6PCT',
        displayLabel: 'PFC 6%',
        displayOrder: 40,
        isSubtotal: false,
        signConvention: 'NEGATIVE',
    },
    {
        sectionKey: 'STAFF_COSTS',
        displayLabel: 'Staff Costs',
        displayOrder: 50,
        isSubtotal: false,
        signConvention: 'NEGATIVE',
    },
    {
        sectionKey: 'RENT',
        displayLabel: 'Rent',
        displayOrder: 60,
        isSubtotal: false,
        signConvention: 'NEGATIVE',
    },
    {
        sectionKey: 'MAINTENANCE',
        displayLabel: 'Maintenance',
        displayOrder: 70,
        isSubtotal: false,
        signConvention: 'NEGATIVE',
    },
    {
        sectionKey: 'OTHER_OPEX',
        displayLabel: 'Other Operating Expenses',
        displayOrder: 80,
        isSubtotal: false,
        signConvention: 'NEGATIVE',
    },
    {
        sectionKey: 'EBITDA',
        displayLabel: 'EBITDA',
        displayOrder: 90,
        isSubtotal: true,
        subtotalFormula: 'GROSS_PROFIT - PFC_6PCT - STAFF_COSTS - RENT - MAINTENANCE - OTHER_OPEX',
        signConvention: 'POSITIVE',
    },
    {
        sectionKey: 'DEPRECIATION',
        displayLabel: 'Depreciation',
        displayOrder: 100,
        isSubtotal: false,
        signConvention: 'NEGATIVE',
    },
    {
        sectionKey: 'PROVISIONS',
        displayLabel: 'Provisions',
        displayOrder: 110,
        isSubtotal: false,
        signConvention: 'NEGATIVE',
    },
    {
        sectionKey: 'OPERATING_PROFIT',
        displayLabel: 'Operating Profit',
        displayOrder: 120,
        isSubtotal: true,
        subtotalFormula: 'EBITDA - DEPRECIATION - PROVISIONS',
        signConvention: 'POSITIVE',
    },
    {
        sectionKey: 'NET_FINANCE',
        displayLabel: 'Net Finance',
        displayOrder: 130,
        isSubtotal: false,
        signConvention: 'POSITIVE',
    },
    {
        sectionKey: 'NET_PROFIT',
        displayLabel: 'Net Profit',
        displayOrder: 140,
        isSubtotal: true,
        subtotalFormula: 'OPERATING_PROFIT + NET_FINANCE',
        signConvention: 'POSITIVE',
    },
];
```

Key mappings (per spec Section 6) — the seed file should contain the full mapping array.

- [ ] **Step 2: Add call to seed.ts**

Call `seedPnlTemplate(prisma)` after COA and historical actual seeds.

- [ ] **Step 3: Run seed and verify**

```bash
pnpm --filter @budfin/api exec prisma db seed
```

Expected: 1 template, 14 sections, ~60 mappings.

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/seeds/seed-pnl-template.ts apps/api/prisma/seed.ts
git commit -m "feat(seed): add default IFRS P&L template with account mappings"
```

---

## Chunk 2: Backend API Routes

### Task 5: Update existing account routes for new fields

**Files:**

- Modify: `apps/api/src/routes/master-data/accounts.ts`
- Modify: `apps/api/src/routes/master-data/accounts.test.ts`

- [ ] **Step 1: Write failing test for new fields**

In `accounts.test.ts`, add a test for creating an account with `parentCode`, `profitCenter`,
and `isSystem` fields. The test should POST with these new fields and expect them in the response.

```typescript
it('should create an account with profitCenter and parentCode', async () => {
    // ... mock prisma.chartOfAccount.create to return object with new fields
    const res = await app.inject({
        method: 'POST',
        url: '/api/v1/master-data/accounts',
        headers: authHeader(token),
        payload: {
            accountCode: 'REV001',
            accountName: 'Test Revenue',
            type: 'REVENUE',
            ifrsCategory: 'Tuition Fees',
            centerType: 'PROFIT_CENTER',
            parentCode: '7011',
            profitCenter: 'MATERNELLE',
        },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.parentCode).toBe('7011');
    expect(body.profitCenter).toBe('MATERNELLE');
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @budfin/api exec vitest run src/routes/master-data/accounts.test.ts
```

Expected: FAIL — new fields not in schema.

- [ ] **Step 3: Update Zod schemas and route handlers**

In `accounts.ts`, add the new fields to `createAccountSchema` and `updateAccountSchema`:

```typescript
const profitCenterEnum = z.enum(['MATERNELLE', 'ELEMENTAIRE', 'COLLEGE', 'LYCEE']);

const createAccountSchema = z.object({
    // ... existing fields
    parentCode: z.string().max(10).optional(),
    profitCenter: profitCenterEnum.optional().nullable(),
});
```

Also update the `listQuerySchema` to add `profitCenter` filter and update the
`findMany` where clause to filter by `profitCenter`.

Add system account protection to the DELETE handler:

```typescript
if (account.isSystem) {
    return reply
        .status(403)
        .send({ code: 'SYSTEM_ACCOUNT', message: 'Cannot delete system accounts' });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter @budfin/api exec vitest run src/routes/master-data/accounts.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/master-data/accounts.ts apps/api/src/routes/master-data/accounts.test.ts
git commit -m "feat(api): extend account routes with profitCenter, parentCode, isSystem"
```

---

### Task 6: Create PnlTemplate CRUD routes

**Files:**

- Create: `apps/api/src/routes/master-data/pnl-templates.ts`
- Create: `apps/api/src/routes/master-data/pnl-templates.test.ts`
- Modify: `apps/api/src/routes/master-data/index.ts` (register new routes)

- [ ] **Step 1: Write failing tests**

Create `pnl-templates.test.ts` with tests for:

- `GET /` — list all templates
- `POST /` — create template (requires `admin:config`)
- `PUT /:id` — update template with optimistic locking
- `DELETE /:id` — delete template (prevent system template deletion)
- `GET /:id/mappings` — list all mappings for a template
- `PUT /:id/mappings` — bulk save mappings (replace all mappings for a template)

Follow the existing `accounts.test.ts` pattern for mock setup, JWT generation,
and assertion style.

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter @budfin/api exec vitest run src/routes/master-data/pnl-templates.test.ts
```

- [ ] **Step 3: Implement pnl-templates.ts**

Follow the exact pattern from `accounts.ts`:

- Zod schemas for create/update/list
- RBAC: `admin:config` for mutations, `data:view` for reads
- Optimistic locking on PUT
- Audit entries on all mutations
- Transaction wrapper for mutations
- System template protection on DELETE

For `PUT /:id/mappings` (bulk save):

```typescript
// Delete existing mappings for the template's sections, then create new ones
await tx.pnlAccountMapping.deleteMany({
    where: { section: { templateId: id } },
});
await tx.pnlAccountMapping.createMany({ data: mappings });
```

- [ ] **Step 4: Register routes in master-data/index.ts**

Add to `apps/api/src/routes/master-data/index.ts`:

```typescript
import { pnlTemplateRoutes } from './pnl-templates.js';
// ...
await app.register(pnlTemplateRoutes, { prefix: '/pnl-templates' });
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pnpm --filter @budfin/api exec vitest run src/routes/master-data/pnl-templates.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/master-data/pnl-templates.ts apps/api/src/routes/master-data/pnl-templates.test.ts apps/api/src/routes/master-data/index.ts
git commit -m "feat(api): add P&L template CRUD routes with mapping bulk save"
```

---

### Task 7: Create HistoricalActual routes

**Files:**

- Create: `apps/api/src/routes/historical-actuals.ts`
- Create: `apps/api/src/routes/historical-actuals.test.ts`
- Modify: `apps/api/src/index.ts` (register routes)

- [ ] **Step 1: Write failing tests**

Tests for:

- `GET /` — list with `fiscalYear` filter
- `POST /bulk` — bulk import array of actuals (upsert pattern)
- `PUT /:id` — update single actual
- `DELETE /:id` — delete single actual
- RBAC: `admin:config` required for all mutations

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter @budfin/api exec vitest run src/routes/historical-actuals.test.ts
```

- [ ] **Step 3: Implement historical-actuals.ts**

Follow the CRUD pattern. The bulk import endpoint uses `upsert` keyed on
`(fiscalYear, accountCode)`:

```typescript
for (const row of body.actuals) {
  await tx.historicalActual.upsert({
    where: {
      fiscalYear_accountCode: {
        fiscalYear: row.fiscalYear,
        accountCode: row.accountCode,
      },
    },
    update: { annualAmount: row.annualAmount, q1Amount: row.q1Amount, ... },
    create: { ...row, source: 'MANUAL' },
  });
}
```

- [ ] **Step 4: Register in index.ts**

```typescript
import { historicalActualRoutes } from './routes/historical-actuals.js';
// ...
await app.register(historicalActualRoutes, { prefix: '/api/v1/historical-actuals' });
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pnpm --filter @budfin/api exec vitest run src/routes/historical-actuals.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/historical-actuals.ts apps/api/src/routes/historical-actuals.test.ts apps/api/src/index.ts
git commit -m "feat(api): add historical actuals routes with bulk import"
```

---

## Chunk 3: Backend - Accounting P&L Transformation Service

### Task 8: Create subtotal formula parser

**Files:**

- Create: `apps/api/src/services/pnl-formula-parser.ts`
- Create: `apps/api/src/services/pnl-formula-parser.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { parseFormula, evaluateFormula } from './pnl-formula-parser.js';

describe('pnl-formula-parser', () => {
    it('parses simple subtraction', () => {
        const result = parseFormula('REVENUE - COST_OF_SERVICE');
        expect(result).toEqual([
            { key: 'REVENUE', operator: '+' },
            { key: 'COST_OF_SERVICE', operator: '-' },
        ]);
    });

    it('evaluates formula with section totals', () => {
        const sectionTotals = new Map([
            ['REVENUE', new Decimal('1000')],
            ['COST_OF_SERVICE', new Decimal('200')],
        ]);
        const result = evaluateFormula('REVENUE - COST_OF_SERVICE', sectionTotals);
        expect(result.toString()).toBe('800');
    });

    it('evaluates EBITDA formula', () => {
        const sectionTotals = new Map([
            ['GROSS_PROFIT', new Decimal('800')],
            ['PFC_6PCT', new Decimal('60')],
            ['STAFF_COSTS', new Decimal('300')],
            ['RENT', new Decimal('100')],
            ['MAINTENANCE', new Decimal('50')],
            ['OTHER_OPEX', new Decimal('90')],
        ]);
        const result = evaluateFormula(
            'GROSS_PROFIT - PFC_6PCT - STAFF_COSTS - RENT - MAINTENANCE - OTHER_OPEX',
            sectionTotals
        );
        expect(result.toString()).toBe('200');
    });

    it('returns zero for unknown section key', () => {
        const sectionTotals = new Map([['REVENUE', new Decimal('1000')]]);
        const result = evaluateFormula('REVENUE - UNKNOWN', sectionTotals);
        expect(result.toString()).toBe('1000');
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter @budfin/api exec vitest run src/services/pnl-formula-parser.test.ts
```

- [ ] **Step 3: Implement formula parser**

```typescript
import Decimal from 'decimal.js';

interface FormulaTerm {
    key: string;
    operator: '+' | '-';
}

export function parseFormula(formula: string): FormulaTerm[] {
    const terms: FormulaTerm[] = [];
    const parts = formula.split(/\s+/);
    let currentOperator: '+' | '-' = '+';

    for (const part of parts) {
        if (part === '+') {
            currentOperator = '+';
        } else if (part === '-') {
            currentOperator = '-';
        } else {
            terms.push({ key: part, operator: currentOperator });
            currentOperator = '+'; // reset
        }
    }

    return terms;
}

export function evaluateFormula(formula: string, sectionTotals: Map<string, Decimal>): Decimal {
    const terms = parseFormula(formula);
    let result = new Decimal(0);

    for (const term of terms) {
        const value = sectionTotals.get(term.key) ?? new Decimal(0);
        if (term.operator === '+') {
            result = result.plus(value);
        } else {
            result = result.minus(value);
        }
    }

    return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter @budfin/api exec vitest run src/services/pnl-formula-parser.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/pnl-formula-parser.ts apps/api/src/services/pnl-formula-parser.test.ts
git commit -m "feat: add P&L subtotal formula parser with decimal.js"
```

---

### Task 9: Create pnl-accounting-service.ts (core transformation)

**Files:**

- Create: `apps/api/src/services/pnl-accounting-service.ts`
- Create: `apps/api/src/services/pnl-accounting-service.test.ts`

This is the most complex task. The service is a pure function (TC-005) that takes
`MonthlyPnlLine[]`, a template with mappings, optional historical actuals, and optional
profit center filter, and returns the IFRS-structured P&L view.

- [ ] **Step 1: Define input/output types**

Create types in `packages/types/src/pnl-accounting.ts`:

```typescript
import type { Decimal } from 'decimal.js';

export interface AccountingPnlLine {
    displayLabel: string;
    budgetAmount: string; // decimal string
    actualAmount?: string;
    variance?: string;
    variancePct?: string;
    accountCode?: string;
    visibility: 'SHOW' | 'GROUP';
}

export interface AccountingPnlSection {
    sectionKey: string;
    displayLabel: string;
    displayOrder: number;
    isSubtotal: boolean;
    signConvention: 'POSITIVE' | 'NEGATIVE';
    lines: AccountingPnlLine[];
    othersAmount?: string; // sum of GROUP lines
    subtotal: string; // section total
    budgetSubtotal: string;
    actualSubtotal?: string;
    varianceSubtotal?: string;
    variancePctSubtotal?: string;
}

export interface AccountingPnlKpis {
    revenue: string;
    grossProfit: string;
    gpMargin: string;
    ebitda: string;
    ebitdaMargin: string;
    netProfit: string;
}

export interface AccountingPnlView {
    sections: AccountingPnlSection[];
    kpis: AccountingPnlKpis;
}
```

Export from `packages/types/src/index.ts`.

- [ ] **Step 2: Write failing tests for core transformation**

In `pnl-accounting-service.test.ts`, create comprehensive tests:

```typescript
describe('transformToAccountingPnl', () => {
    it('maps analytical revenue lines to IFRS Revenue section', () => {
        /* ... */
    });
    it('applies month filter for trimester aggregation', () => {
        /* ... */
    });
    it('groups GROUP-visibility lines into Others', () => {
        /* ... */
    });
    it('excludes EXCLUDE-visibility lines', () => {
        /* ... */
    });
    it('computes subtotals using formula parser', () => {
        /* ... */
    });
    it('computes variance when historical actuals provided', () => {
        /* ... */
    });
    it('processes LINE_ITEM mappings before CATEGORY mappings', () => {
        /* ... */
    });
    it('extracts EOS_PROVISION from STAFF_COSTS to PROVISIONS', () => {
        /* ... */
    });
    it('computes KPIs from section subtotals', () => {
        /* ... */
    });
});
```

Create test fixtures with minimal `MonthlyPnlLine[]` data and a template.

- [ ] **Step 3: Run tests to verify they fail**

```bash
pnpm --filter @budfin/api exec vitest run src/services/pnl-accounting-service.test.ts
```

- [ ] **Step 4: Implement transformToAccountingPnl**

The function signature:

```typescript
import Decimal from 'decimal.js';
import { evaluateFormula } from './pnl-formula-parser.js';

interface MonthlyPnlLineInput {
    month: number;
    sectionKey: string;
    categoryKey: string;
    lineItemKey: string;
    displayLabel: string;
    depth: number;
    amount: Decimal | string;
    isSubtotal: boolean;
    isSeparator: boolean;
}

interface TemplateSectionInput {
    sectionKey: string;
    displayLabel: string;
    displayOrder: number;
    isSubtotal: boolean;
    subtotalFormula: string | null;
    signConvention: string;
    mappings: MappingInput[];
}

interface MappingInput {
    analyticalKey: string;
    analyticalKeyType: 'CATEGORY' | 'LINE_ITEM';
    accountCode: string | null;
    monthFilter: number[];
    displayLabel: string | null;
    visibility: 'SHOW' | 'GROUP' | 'EXCLUDE';
    displayOrder: number;
    profitCenterAllocation: 'DIRECT' | 'HEADCOUNT' | 'MANUAL';
    manualAllocation: Record<string, number> | null;
}

interface HistoricalActualInput {
    accountCode: string;
    annualAmount: Decimal | string;
}

interface EnrollmentByGradeInput {
    gradeBand: string; // MATERNELLE, ELEMENTAIRE, COLLEGE, LYCEE
    headcount: number;
}

export function transformToAccountingPnl(
    pnlLines: MonthlyPnlLineInput[],
    sections: TemplateSectionInput[],
    historicalActuals?: HistoricalActualInput[],
    enrollmentByGrade?: EnrollmentByGradeInput[],
    profitCenter?: string
): AccountingPnlView {
    // Implementation follows spec Section 7.1 transformation steps
}
```

**Profit center allocation logic** (when `profitCenter` is provided):

```typescript
// 1. Compute headcount ratio for requested profit center
const totalHeadcount = enrollmentByGrade.reduce((sum, e) => sum + e.headcount, 0);
const bandHeadcount = enrollmentByGrade
    .filter((e) => e.gradeBand === profitCenter)
    .reduce((sum, e) => sum + e.headcount, 0);
const ratio = new Decimal(bandHeadcount).div(totalHeadcount);

// 2. For revenue: filter MonthlyPnlLine by grade (tuition lines contain grade in lineItemKey)
//    For costs: multiply total by ratio
// 3. For MANUAL allocation: use manualAllocation[profitCenter] percentage instead
```

**Note on quarterly/monthly views**: The initial implementation supports `annual`
view only. The `view` query param is accepted but quarterly and monthly are
documented as follow-up work. The annual view sums all 12 months.

**Note on department-based staff cost split**: The initial implementation shows
staff costs as a single aggregate per mapping line. The department-level breakdown
(splitting LOCAL_SALARIES into 641100 vs 641400 vs 641200 by employee department)
is shown in the inspector panel drill-down but not in the main grid. Full split
requires additional employee cost data input, documented as follow-up.

````

Key implementation details:
1. Filter out header/subtotal/separator rows from `pnlLines` (`depth === 3 && !isSubtotal && !isSeparator`)
2. Build an index of actuals by `accountCode` for O(1) lookup
3. Process LINE_ITEM mappings first, mark matched lines as consumed
4. Process CATEGORY mappings for remaining unconsumed lines
5. For each mapping with `monthFilter`, sum only matching months
6. Aggregate SHOW lines as named entries, GROUP lines into Others
7. Compute section subtotals; for subtotal sections, evaluate formula
8. Compute variance as `budget - actual`, percentage as `variance / |actual| * 100`
9. Extract KPIs from specific section subtotals

- [ ] **Step 5: Run tests to verify they pass**

```bash
pnpm --filter @budfin/api exec vitest run src/services/pnl-accounting-service.test.ts
````

- [ ] **Step 6: Commit**

```bash
git add packages/types/src/pnl-accounting.ts packages/types/src/index.ts apps/api/src/services/pnl-accounting-service.ts apps/api/src/services/pnl-accounting-service.test.ts
git commit -m "feat: add P&L accounting transformation service (pure function)"
```

---

### Task 10: Create GET /pnl/accounting endpoint

**Files:**

- Create: `apps/api/src/routes/pnl/accounting.ts`
- Create: `apps/api/src/routes/pnl/accounting.test.ts`
- Modify: `apps/api/src/routes/pnl/index.ts` (register alongside existing pnl routes)

- [ ] **Step 1: Write failing tests**

Test the endpoint with mocked Prisma and transformation service:

- Returns IFRS P&L view for a version
- Filters by `compareYear` query param
- Filters by `profitCenter` query param
- Returns 404 if version not found
- Returns 409 if P&L not calculated (no MonthlyPnlLine rows)
- Requires `data:view` permission

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter @budfin/api exec vitest run src/routes/pnl-accounting.test.ts
```

- [ ] **Step 3: Implement the route**

```typescript
export async function pnlAccountingRoutes(app: FastifyInstance) {
    app.get(
        '/',
        {
            schema: {
                querystring: z.object({
                    compareYear: z.coerce.number().int().optional(),
                    profitCenter: z
                        .enum(['MATERNELLE', 'ELEMENTAIRE', 'COLLEGE', 'LYCEE'])
                        .optional(),
                    view: z.enum(['annual', 'quarterly', 'monthly']).optional().default('annual'),
                }),
            },
            preHandler: [app.requirePermission('data:view')],
        },
        async (request, reply) => {
            const { versionId } = request.params as { versionId: string };
            const { compareYear, profitCenter, view } = request.query;

            // 1. Load MonthlyPnlLine[] for version
            // 2. Load default PnlTemplate with sections + mappings
            // 3. Optionally load HistoricalActual[] for compareYear
            // 4. Call transformToAccountingPnl()
            // 5. Return AccountingPnlView
        }
    );
}
```

Register alongside existing P&L routes in `apps/api/src/routes/pnl/index.ts`:

```typescript
import { pnlAccountingRoutes } from './accounting.js';
// ... inside the pnlRoutes function:
await fastify.register(pnlAccountingRoutes);
```

The route handler registers at path `/pnl/accounting` since the parent prefix
already provides `/api/v1/versions/:versionId`.

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter @budfin/api exec vitest run src/routes/pnl-accounting.test.ts
```

- [ ] **Step 5: Run full test suite**

```bash
pnpm --filter @budfin/api test
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/pnl/accounting.ts apps/api/src/routes/pnl/accounting.test.ts apps/api/src/routes/pnl/index.ts
git commit -m "feat(api): add GET /pnl/accounting endpoint for IFRS P&L view"
```

---

## Chunk 4: Frontend - COA Master Data & Hooks

### Task 11: Create shared types and API hooks

**Files:**

- Modify: `apps/web/src/hooks/use-accounts.ts` (already exists — add profitCenter filter)
- Create: `apps/web/src/hooks/use-pnl-templates.ts`
- Create: `apps/web/src/hooks/use-historical-actuals.ts`
- Create: `apps/web/src/hooks/use-pnl-accounting.ts`

- [ ] **Step 1: Update existing use-accounts.ts**

The accounts hook already exists at `apps/web/src/hooks/use-accounts.ts`.
Update the `AccountFilters` interface to add `profitCenter` filter.
Update the `Account` interface/type to include `parentCode`, `profitCenter`, `isSystem`.
No new file needed — modify in place.

- [ ] **Step 2: Create use-pnl-templates.ts**

```typescript
export const templateKeys = {
    all: ['pnl-templates'] as const,
    list: () => ['pnl-templates', 'list'] as const,
    detail: (id: number) => ['pnl-templates', id] as const,
    mappings: (id: number) => ['pnl-templates', id, 'mappings'] as const,
};

export function usePnlTemplates() {
    /* list */
}
export function useTemplateMappings(templateId: number) {
    /* GET /:id/mappings */
}
export function useCreateTemplate() {
    /* POST */
}
export function useUpdateTemplate() {
    /* PUT */
}
export function useDeleteTemplate() {
    /* DELETE */
}
export function useSaveMappings() {
    /* PUT /:id/mappings (bulk) */
}
```

- [ ] **Step 3: Create use-historical-actuals.ts**

```typescript
export function useHistoricalActuals(fiscalYear?: number) {
    /* list */
}
export function useBulkImportActuals() {
    /* POST /bulk */
}
export function useUpdateActual() {
    /* PUT */
}
export function useDeleteActual() {
    /* DELETE */
}
```

- [ ] **Step 4: Create use-pnl-accounting.ts**

```typescript
export const pnlAccountingKeys = {
    all: ['pnl-accounting'] as const,
    view: (versionId: number, compareYear?: number, profitCenter?: string) =>
        ['pnl-accounting', versionId, compareYear, profitCenter] as const,
};

export function usePnlAccounting(options?: {
    compareYear?: number;
    profitCenter?: string;
    view?: 'annual' | 'quarterly' | 'monthly';
}) {
    const versionId = useWorkspaceContextStore((s) => s.versionId);

    return useQuery({
        queryKey: pnlAccountingKeys.view(versionId!, options?.compareYear, options?.profitCenter),
        queryFn: async () => {
            const params = new URLSearchParams();
            if (options?.compareYear) params.set('compareYear', String(options.compareYear));
            if (options?.profitCenter) params.set('profitCenter', options.profitCenter);
            if (options?.view) params.set('view', options.view);
            return apiClient<AccountingPnlView>(
                `/versions/${versionId}/pnl/accounting?${params.toString()}`
            );
        },
        enabled: !!versionId,
        staleTime: 30_000,
    });
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/hooks/use-accounts.ts apps/web/src/hooks/use-pnl-templates.ts apps/web/src/hooks/use-historical-actuals.ts apps/web/src/hooks/use-pnl-accounting.ts
git commit -m "feat(web): add TanStack Query hooks for accounting bridge APIs"
```

---

### Task 12: Update existing COA Master Data page

**Files:**

- Modify: `apps/web/src/pages/master-data/accounts.tsx` (already exists — 433 lines)

The COA page already exists with full CRUD, ListGrid, filters, and side panel.
We only need to add support for the three new fields.

- [ ] **Step 1: Add Profit Center column to the grid**

In `accounts.tsx`, add a new column for `profitCenter` after the existing columns.
Display as a badge (MATERNELLE, ELEMENTAIRE, COLLEGE, LYCEE, or "Shared").

- [ ] **Step 2: Add Profit Center filter**

Add a `Select` dropdown to the filter bar for `profitCenter` values.
Wire it to the existing `useAccounts` hook's filter params.

- [ ] **Step 3: Add isSystem protection**

In the actions column, disable the Delete action when `account.isSystem` is true.
Show a lock icon (Lucide `Lock`) next to the account code for system accounts.

- [ ] **Step 4: Update the edit/create side panel**

Add `parentCode` text input and `profitCenter` select to the account form.

- [ ] **Step 5: Run lint and typecheck**

```bash
pnpm typecheck && pnpm lint
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/master-data/accounts.tsx apps/web/src/hooks/use-accounts.ts
git commit -m "feat(web): add profitCenter, parentCode, isSystem to accounts page"
```

---

## Chunk 5: Frontend - P&L Mapping Configuration

### Task 13: Create P&L Mapping Editor page

**Files:**

- Create: `apps/web/src/pages/master-data/pnl-mapping-page.tsx`
- Create: `apps/web/src/components/pnl-mapping/pnl-preview-panel.tsx`
- Create: `apps/web/src/components/pnl-mapping/account-assignment-panel.tsx`
- Create: `apps/web/src/components/pnl-mapping/unassigned-accounts.tsx`
- Modify: `apps/web/src/router.tsx` (add route)

This is the interactive P&L template editor (Approach 3 from the design).

- [ ] **Step 1: Create the page shell**

`pnl-mapping-page.tsx`:

- Two-panel layout using CSS grid
- Left: `PnlPreviewPanel` — clickable IFRS P&L preview
- Right: `AccountAssignmentPanel` — accounts for selected section
- Bottom-right: `UnassignedAccounts` — warning panel
- Template selector dropdown (for future multi-template support)
- Save button with validation

- [ ] **Step 2: Create PnlPreviewPanel**

Shows the IFRS sections as an expandable list:

- Click a section to select it → highlights, updates right panel
- Shows computed subtotals (from current mapping)
- Subtotal rows with bold styling and separators
- "Others" line per section showing GROUP account count

- [ ] **Step 3: Create AccountAssignmentPanel**

When a section is selected:

- Lists all accounts mapped to that section
- Each account row has: code, name, visibility tri-state dropdown (SHOW/GROUP/EXCLUDE)
- Drag handle for reordering (use `@dnd-kit/core` + `@dnd-kit/sortable`)
- `[+ Add account]` button opens searchable command palette (shadcn `<Command>`)
- Remove button to unassign an account

- [ ] **Step 4: Create UnassignedAccounts**

- Lists COA accounts not mapped to any section
- Warning badge showing count
- `[Assign →]` button per account opens section selector
- Warning text: "Unassigned accounts may affect Net Profit accuracy"

- [ ] **Step 5: Register route**

In `router.tsx`, add under Management Shell:

```typescript
{ path: '/master-data/pnl-mapping', element: <PnlMappingPage /> },
```

- [ ] **Step 6: Install dnd-kit**

```bash
pnpm --filter @budfin/web add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

- [ ] **Step 7: Verify the page works**

```bash
pnpm dev
```

Navigate to `/master-data/pnl-mapping`. Should show the seeded template with 14 sections
and accounts assigned. Test clicking sections, changing visibility, reordering.

- [ ] **Step 8: Lint and typecheck**

```bash
pnpm typecheck && pnpm lint
```

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/pages/master-data/pnl-mapping-page.tsx apps/web/src/components/pnl-mapping/ apps/web/src/router.tsx package.json pnpm-lock.yaml
git commit -m "feat(web): add interactive P&L mapping configuration editor"
```

---

## Chunk 6: Frontend - Rebuilt P&L Page

### Task 14: Create P&L KPI Ribbon

**Files:**

- Create: `apps/web/src/components/pnl/pnl-kpi-ribbon.tsx`

- [ ] **Step 1: Create the KPI ribbon component**

Follow `revenue/kpi-ribbon.tsx` pattern. Five cards:

1. Total Revenue (DollarSign icon)
2. Gross Profit (TrendingUp icon)
3. EBITDA (BarChart3 icon)
4. Net Profit (Wallet icon)
5. EBITDA Margin % (Percent icon)

Each card shows:

- Value formatted with `formatMoney()`
- Optional variance subtitle when comparison active
- Stale indicator dot

```typescript
export interface PnlKpiRibbonProps {
    kpis: AccountingPnlKpis;
    isStale: boolean;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/pnl/pnl-kpi-ribbon.tsx
git commit -m "feat(web): add P&L KPI ribbon (Revenue, GP, EBITDA, Net Profit, Margin)"
```

---

### Task 15: Create P&L Accounting Grid

**Files:**

- Create: `apps/web/src/components/pnl/pnl-accounting-grid.tsx`

- [ ] **Step 1: Create the grid component**

TanStack Table with these columns:

- **Line Item** (displayLabel, styled by depth/isSubtotal)
- **Budget** (formatted with `formatMoney`)
- **Actual** (shown only when comparison active)
- **Variance** (absolute, colored red/green)
- **Variance %** (colored red/green)

Row styling:

- Subtotal rows: bold, background `var(--muted)`, separator line above
- "Others" rows: text color `var(--muted-foreground)`, italic
- Regular rows: normal weight

Data source: `AccountingPnlView.sections` flattened into rows.

```typescript
interface PnlAccountingGridProps {
    sections: AccountingPnlSection[];
    hasComparison: boolean;
    onRowClick: (sectionKey: string, lineLabel: string) => void;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/pnl/pnl-accounting-grid.tsx
git commit -m "feat(web): add P&L accounting grid with IFRS sections and variance"
```

---

### Task 16: Create P&L Inspector Content

**Files:**

- Create: `apps/web/src/components/pnl/pnl-accounting-inspector.tsx`

- [ ] **Step 1: Create the inspector component**

Registered in the right panel registry. Shows drill-down details when a P&L line is clicked:

Tabs or sections within the inspector:

1. **Breakdown** — component-level detail (e.g., Staff Costs → base, housing, GOSI, EOS)
2. **Accounts** — PCG account codes and amounts contributing to this line
3. **Profit Centers** — allocation split across Maternelle/Elementaire/College/Lycee
4. **Navigate** — links to source module pages (Revenue, Staffing, OpEx)

Register with:

```typescript
registerPanelContent('pnl-accounting', () => <PnlAccountingInspector />);
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/pnl/pnl-accounting-inspector.tsx
git commit -m "feat(web): add P&L accounting inspector for right panel drill-down"
```

---

### Task 17: Create new Accounting P&L Page (coexists with existing analytical P&L)

The existing `pnl-page.tsx` (706 lines) is preserved unchanged. The accounting P&L
is a **new page** at a new route. Users can navigate between both views.

**Files:**

- Create: `apps/web/src/components/pnl/pnl-accounting-page.tsx`
- Modify: `apps/web/src/router.tsx` (add new route)
- Modify: `apps/web/src/components/shell/sidebar.tsx` (add nav entries)

- [ ] **Step 1: Create pnl-accounting-page.tsx**

New page that composes the accounting-specific components:

```typescript
export function PnlAccountingPage() {
  const [compareYear, setCompareYear] = useState<number | undefined>();
  const [profitCenter, setProfitCenter] = useState<string | undefined>();
  const [viewMode, setViewMode] = useState<'annual' | 'quarterly' | 'monthly'>('annual');

  const { data, isLoading } = usePnlAccounting({ compareYear, profitCenter, view: viewMode });
  const version = useCurrentVersion();
  const isStale = version?.staleModules?.includes('PNL') ?? false;

  return (
    <div className="flex flex-col gap-4">
      {/* Stale warning banner */}
      {isStale && <StaleBanner module="PNL" />}

      {/* KPI Ribbon */}
      {data && <PnlKpiRibbon kpis={data.kpis} isStale={isStale} />}

      {/* Controls bar */}
      <div className="flex items-center gap-3">
        {/* Compare dropdown: Actual 2024, Actual 2025 */}
        {/* Profit center tabs: All, Maternelle, Elementaire, College, Lycee */}
        {/* View toggle: Annual, Quarterly, Monthly */}
      </div>

      {/* Main IFRS grid */}
      {data && (
        <PnlAccountingGrid
          sections={data.sections}
          hasComparison={!!compareYear}
          onRowClick={handleRowClick}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Register route in router.tsx**

Add under PlanningShell children, alongside the existing `/planning/pnl`:

```typescript
{ path: '/planning/pnl/accounting', element: <PnlAccountingPage /> },
```

The existing `/planning/pnl` (analytical view) remains untouched.

- [ ] **Step 3: Add sidebar navigation entries**

In `apps/web/src/components/shell/sidebar.tsx`:

Add to the Planning nav group (under existing P&L entry):

```typescript
{ to: '/planning/pnl/accounting', label: 'P&L (Accounting)', icon: FileSpreadsheet },
```

Add to the Master Data nav group:

```typescript
{ to: '/master-data/pnl-mapping', label: 'P&L Mapping', icon: Workflow },
```

Import `FileSpreadsheet` and `Workflow` from `lucide-react`.

- [ ] **Step 4: Verify both P&L pages work**

```bash
pnpm dev
```

- Navigate to `/planning/pnl` — existing analytical P&L works unchanged
- Navigate to `/planning/pnl/accounting` — new IFRS accounting P&L loads
- Sidebar shows both entries

- [ ] **Step 5: Verify the inspector panel works**

Click a P&L line → inspector opens in right panel with detail tabs.

- [ ] **Step 6: Run lint and typecheck**

```bash
pnpm typecheck && pnpm lint
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/pnl/pnl-accounting-page.tsx apps/web/src/router.tsx apps/web/src/components/shell/sidebar.tsx
git commit -m "feat(web): add accounting P&L page with IFRS view, comparison, profit centers"
```

---

## Chunk 7: Integration Testing & Final Verification

### Task 18: End-to-end verification

**Files:** None (testing only)

- [ ] **Step 1: Run full backend test suite**

```bash
pnpm --filter @budfin/api test
```

Expected: All tests pass, no regressions.

- [ ] **Step 2: Run full frontend test suite**

```bash
pnpm --filter @budfin/web test
```

Expected: All tests pass.

- [ ] **Step 3: Run typecheck across all packages**

```bash
pnpm typecheck
```

Expected: Zero errors.

- [ ] **Step 4: Run lint across all packages**

```bash
pnpm lint:all
```

Expected: Zero errors.

- [ ] **Step 5: Manual smoke test**

Start the dev server:

```bash
pnpm dev
```

Verify:

1. `/master-data/accounts` — shows seeded accounts, can filter by type/profit center
2. `/master-data/pnl-mapping` — shows IFRS template with sections, can click sections
   to see assigned accounts, can change visibility, reorder, save
3. `/planning/pnl` — shows IFRS P&L with ~15 lines, KPI ribbon, profit center tabs
4. Select "Actual 2025" comparison — shows Budget/Actual/Variance columns
5. Click a P&L line — inspector opens with breakdown detail
6. Click "Maternelle" tab — P&L filters to Maternelle profit center

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "chore: final integration fixes for P&L accounting bridge"
```

---

## File Map Summary

### New Files Created

| #   | Path                                                               | Responsibility                        |
| --- | ------------------------------------------------------------------ | ------------------------------------- |
| 1   | `apps/api/prisma/seeds/seed-coa-accounts.ts`                       | Seed ~80 COA accounts from PDF data   |
| 2   | `apps/api/prisma/seeds/seed-historical-actuals.ts`                 | Seed ~160 historical actual rows      |
| 3   | `apps/api/prisma/seeds/seed-pnl-template.ts`                       | Seed default IFRS template + mappings |
| 4   | `apps/api/src/routes/master-data/pnl-templates.ts`                 | Template CRUD + mapping bulk save     |
| 5   | `apps/api/src/routes/master-data/pnl-templates.test.ts`            | Tests for template routes             |
| 6   | `apps/api/src/routes/historical-actuals.ts`                        | Historical actuals CRUD + bulk import |
| 7   | `apps/api/src/routes/historical-actuals.test.ts`                   | Tests for historical actuals routes   |
| 8   | `apps/api/src/services/pnl-formula-parser.ts`                      | Subtotal formula parser               |
| 9   | `apps/api/src/services/pnl-formula-parser.test.ts`                 | Tests for formula parser              |
| 10  | `apps/api/src/services/pnl-accounting-service.ts`                  | Core transformation service           |
| 11  | `apps/api/src/services/pnl-accounting-service.test.ts`             | Tests for transformation              |
| 12  | `apps/api/src/routes/pnl/accounting.ts`                            | GET /pnl/accounting endpoint          |
| 13  | `apps/api/src/routes/pnl/accounting.test.ts`                       | Tests for accounting endpoint         |
| 14  | `packages/types/src/pnl-accounting.ts`                             | Shared types for accounting P&L       |
| 15  | `apps/web/src/hooks/use-pnl-templates.ts`                          | TanStack Query hooks for templates    |
| 16  | `apps/web/src/hooks/use-historical-actuals.ts`                     | TanStack Query hooks for actuals      |
| 17  | `apps/web/src/hooks/use-pnl-accounting.ts`                         | TanStack Query hook for IFRS P&L      |
| 18  | `apps/web/src/pages/master-data/pnl-mapping-page.tsx`              | P&L mapping editor page               |
| 19  | `apps/web/src/components/pnl-mapping/pnl-preview-panel.tsx`        | IFRS preview (left panel)             |
| 20  | `apps/web/src/components/pnl-mapping/account-assignment-panel.tsx` | Account config (right panel)          |
| 21  | `apps/web/src/components/pnl-mapping/unassigned-accounts.tsx`      | Unassigned warnings                   |
| 22  | `apps/web/src/components/pnl/pnl-kpi-ribbon.tsx`                   | KPI cards for P&L                     |
| 23  | `apps/web/src/components/pnl/pnl-accounting-grid.tsx`              | IFRS P&L grid                         |
| 24  | `apps/web/src/components/pnl/pnl-accounting-inspector.tsx`         | Right panel drill-down                |
| 25  | `apps/web/src/components/pnl/pnl-accounting-page.tsx`              | New accounting P&L page               |

### Existing Files Modified

| #   | Path                                               | Change                                           |
| --- | -------------------------------------------------- | ------------------------------------------------ |
| 1   | `apps/api/prisma/schema.prisma`                    | Add 6 enums, 4 models, extend ChartOfAccount     |
| 2   | `apps/api/prisma/seed.ts`                          | Call new seed functions                          |
| 3   | `apps/api/src/routes/master-data/accounts.ts`      | Add profitCenter, parentCode, isSystem           |
| 4   | `apps/api/src/routes/master-data/accounts.test.ts` | Tests for new fields                             |
| 5   | `apps/api/src/routes/master-data/index.ts`         | Register pnl-templates routes                    |
| 6   | `apps/api/src/routes/pnl/index.ts`                 | Register accounting routes                       |
| 7   | `apps/api/src/index.ts`                            | Register historical-actuals routes               |
| 8   | `packages/types/src/index.ts`                      | Export new accounting types                      |
| 9   | `apps/web/src/hooks/use-accounts.ts`               | Add profitCenter filter + new fields             |
| 10  | `apps/web/src/pages/master-data/accounts.tsx`      | Add profitCenter column, isSystem protection     |
| 11  | `apps/web/src/router.tsx`                          | Add pnl-mapping + pnl/accounting routes          |
| 12  | `apps/web/src/components/shell/sidebar.tsx`        | Add nav entries for P&L Accounting + P&L Mapping |

### Scoped as Follow-up

| Feature                                   | Reason                                                      |
| ----------------------------------------- | ----------------------------------------------------------- |
| Quarterly/monthly view toggle             | Requires time-dimension expansion of AccountingPnlView type |
| Department-based staff cost split in grid | Requires employee cost data as additional service input     |
| Full department split in grid columns     | Inspector drill-down shows breakdown; grid shows aggregate  |
