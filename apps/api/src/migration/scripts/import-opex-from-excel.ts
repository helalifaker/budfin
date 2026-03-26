// Import OpEx Budget Data — Seed VersionOpExLineItem + MonthlyOpEx from FY2026 Excel data
// Run: pnpm --filter @budfin/api exec tsx src/migration/scripts/import-opex-from-excel.ts
//
// Safe to run multiple times (idempotent — deletes existing data for the target version first).
// Hard-coded values from data/budgets/03_EFIR_OpEx_FY2026.xlsx.

import { PrismaClient } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { ensureMigrationUser } from '../lib/migration-user.js';

const prisma = new PrismaClient();

// ── Types ────────────────────────────────────────────────────────────────────

interface LineItemSeed {
	displayOrder: number;
	sectionType: 'OPERATING' | 'NON_OPERATING';
	ifrsCategory: string;
	lineItemName: string;
	computeMethod: 'MANUAL' | 'PERCENT_OF_REVENUE';
	computeRate: string | null;
	budgetV6Total: string | null;
	monthlyAmounts: string[]; // 12 elements, Jan(1) through Dec(12)
}

// ── Operating Line Items (Sheet: Operating_Expenses) ─────────────────────────

const OPERATING_LINE_ITEMS: LineItemSeed[] = [
	{
		displayOrder: 1,
		sectionType: 'OPERATING',
		ifrsCategory: 'Rent & Utilities',
		lineItemName: 'Rent',
		computeMethod: 'MANUAL',
		computeRate: null,
		budgetV6Total: '8395518',
		monthlyAmounts: [
			'699626.5',
			'699626.5',
			'699626.5',
			'699626.5',
			'699626.5',
			'699626.5',
			'699626.5',
			'699626.5',
			'699626.5',
			'699626.5',
			'699626.5',
			'699626.5',
		],
	},
	{
		displayOrder: 2,
		sectionType: 'OPERATING',
		ifrsCategory: 'Rent & Utilities',
		lineItemName: 'Electricity',
		computeMethod: 'MANUAL',
		computeRate: null,
		budgetV6Total: '420000',
		monthlyAmounts: [
			'35000',
			'35000',
			'35000',
			'35000',
			'35000',
			'35000',
			'35000',
			'35000',
			'35000',
			'35000',
			'35000',
			'35000',
		],
	},
	{
		displayOrder: 3,
		sectionType: 'OPERATING',
		ifrsCategory: 'Rent & Utilities',
		lineItemName: 'Water',
		computeMethod: 'MANUAL',
		computeRate: null,
		budgetV6Total: '166000',
		monthlyAmounts: [
			'13833.33',
			'13833.33',
			'13833.33',
			'13833.33',
			'13833.33',
			'13833.33',
			'13833.33',
			'13833.33',
			'13833.33',
			'13833.33',
			'13833.33',
			'13833.33',
		],
	},
	{
		displayOrder: 4,
		sectionType: 'OPERATING',
		ifrsCategory: 'Building Services',
		lineItemName: 'Maintenance Contracts',
		computeMethod: 'MANUAL',
		computeRate: null,
		budgetV6Total: '2766252',
		monthlyAmounts: [
			'230521',
			'230521',
			'230521',
			'230521',
			'230521',
			'230521',
			'230521',
			'230521',
			'230521',
			'230521',
			'230521',
			'230521',
		],
	},
	{
		displayOrder: 5,
		sectionType: 'OPERATING',
		ifrsCategory: 'Building Services',
		lineItemName: 'Security',
		computeMethod: 'MANUAL',
		computeRate: null,
		budgetV6Total: '1730400',
		monthlyAmounts: [
			'144200',
			'144200',
			'144200',
			'144200',
			'144200',
			'144200',
			'144200',
			'144200',
			'144200',
			'144200',
			'144200',
			'144200',
		],
	},
	{
		displayOrder: 6,
		sectionType: 'OPERATING',
		ifrsCategory: 'Building Services',
		lineItemName: 'Equipment Maintenance',
		computeMethod: 'MANUAL',
		computeRate: null,
		budgetV6Total: '355886',
		monthlyAmounts: [
			'35000',
			'35000',
			'35000',
			'35000',
			'35000',
			'35000',
			'0',
			'0',
			'35000',
			'35000',
			'35000',
			'35000',
		],
	},
	{
		displayOrder: 7,
		sectionType: 'OPERATING',
		ifrsCategory: 'Office & Supplies',
		lineItemName: 'Administration Supplies',
		computeMethod: 'MANUAL',
		computeRate: null,
		budgetV6Total: '465139',
		monthlyAmounts: [
			'47000',
			'47000',
			'47000',
			'47000',
			'47000',
			'47000',
			'0',
			'0',
			'47000',
			'47000',
			'47000',
			'47000',
		],
	},
	{
		displayOrder: 8,
		sectionType: 'OPERATING',
		ifrsCategory: 'Office & Supplies',
		lineItemName: 'Photocopier Contract',
		computeMethod: 'MANUAL',
		computeRate: null,
		budgetV6Total: '150000',
		monthlyAmounts: [
			'6192.67',
			'6192.67',
			'6192.67',
			'6192.67',
			'6192.67',
			'6192.67',
			'6192.67',
			'6192.67',
			'6192.67',
			'6192.67',
			'6192.67',
			'6192.67',
		],
	},
	{
		displayOrder: 9,
		sectionType: 'OPERATING',
		ifrsCategory: 'Insurance',
		lineItemName: 'Medical Insurance \u2013 Saudi Staff',
		computeMethod: 'MANUAL',
		computeRate: null,
		budgetV6Total: '69533',
		monthlyAmounts: [
			'5794.42',
			'5794.42',
			'5794.42',
			'5794.42',
			'5794.42',
			'5794.42',
			'5794.42',
			'5794.42',
			'5794.42',
			'5794.42',
			'5794.42',
			'5794.42',
		],
	},
	{
		displayOrder: 10,
		sectionType: 'OPERATING',
		ifrsCategory: 'Insurance',
		lineItemName: 'School Insurance',
		computeMethod: 'MANUAL',
		computeRate: null,
		budgetV6Total: '101789',
		monthlyAmounts: [
			'18000',
			'18000',
			'18000',
			'18000',
			'18000',
			'18000',
			'18000',
			'18000',
			'18000',
			'18000',
			'18000',
			'18000',
		],
	},
	{
		displayOrder: 11,
		sectionType: 'OPERATING',
		ifrsCategory: 'Professional Services',
		lineItemName: 'External Audit',
		computeMethod: 'MANUAL',
		computeRate: null,
		budgetV6Total: '32000',
		monthlyAmounts: [
			'3000',
			'3000',
			'3000',
			'3000',
			'3000',
			'3000',
			'3000',
			'3000',
			'3000',
			'3000',
			'3000',
			'3000',
		],
	},
	{
		displayOrder: 12,
		sectionType: 'OPERATING',
		ifrsCategory: 'Professional Services',
		lineItemName: 'Communication',
		computeMethod: 'MANUAL',
		computeRate: null,
		budgetV6Total: '30000',
		monthlyAmounts: [
			'2500',
			'2500',
			'2500',
			'2500',
			'2500',
			'2500',
			'2500',
			'2500',
			'2500',
			'2500',
			'2500',
			'2500',
		],
	},
	{
		displayOrder: 13,
		sectionType: 'OPERATING',
		ifrsCategory: 'IT & Telecom',
		lineItemName: 'IT Equipment',
		computeMethod: 'MANUAL',
		computeRate: null,
		budgetV6Total: '330077',
		monthlyAmounts: [
			'40000',
			'40000',
			'40000',
			'40000',
			'40000',
			'40000',
			'0',
			'0',
			'40000',
			'40000',
			'40000',
			'40000',
		],
	},
	{
		displayOrder: 14,
		sectionType: 'OPERATING',
		ifrsCategory: 'IT & Telecom',
		lineItemName: 'Telephone & Internet',
		computeMethod: 'MANUAL',
		computeRate: null,
		budgetV6Total: '263791',
		monthlyAmounts: [
			'25000',
			'25000',
			'25000',
			'25000',
			'25000',
			'25000',
			'25000',
			'25000',
			'25000',
			'25000',
			'25000',
			'25000',
		],
	},
	{
		displayOrder: 15,
		sectionType: 'OPERATING',
		ifrsCategory: 'Other General',
		lineItemName: 'Vehicle Fuel & Maintenance',
		computeMethod: 'MANUAL',
		computeRate: null,
		budgetV6Total: '20000',
		monthlyAmounts: [
			'2000',
			'2000',
			'2000',
			'2000',
			'2000',
			'2000',
			'0',
			'0',
			'2000',
			'2000',
			'2000',
			'2000',
		],
	},
	{
		displayOrder: 16,
		sectionType: 'OPERATING',
		ifrsCategory: 'Other General',
		lineItemName: 'Infirmary',
		computeMethod: 'MANUAL',
		computeRate: null,
		budgetV6Total: '23269',
		monthlyAmounts: [
			'2500',
			'2500',
			'2500',
			'2500',
			'2500',
			'2500',
			'0',
			'0',
			'2500',
			'2500',
			'2500',
			'2500',
		],
	},
	{
		displayOrder: 17,
		sectionType: 'OPERATING',
		ifrsCategory: 'Other General',
		lineItemName: 'Reception & Events',
		computeMethod: 'MANUAL',
		computeRate: null,
		budgetV6Total: '25000',
		monthlyAmounts: [
			'2500',
			'2500',
			'2500',
			'2500',
			'2500',
			'2500',
			'0',
			'0',
			'2500',
			'2500',
			'2500',
			'2500',
		],
	},
	{
		displayOrder: 18,
		sectionType: 'OPERATING',
		ifrsCategory: 'Other General',
		lineItemName: 'Class Photos / Printing',
		computeMethod: 'MANUAL',
		computeRate: null,
		budgetV6Total: '18180',
		monthlyAmounts: [
			'2000',
			'2000',
			'2000',
			'2000',
			'2000',
			'2000',
			'0',
			'0',
			'2000',
			'2000',
			'2000',
			'2000',
		],
	},
	{
		displayOrder: 19,
		sectionType: 'OPERATING',
		ifrsCategory: 'Other General',
		lineItemName: 'Social Aid Fund',
		computeMethod: 'MANUAL',
		computeRate: null,
		budgetV6Total: '80000',
		monthlyAmounts: [
			'8000',
			'8000',
			'8000',
			'8000',
			'8000',
			'8000',
			'0',
			'0',
			'8000',
			'8000',
			'8000',
			'8000',
		],
	},
	{
		displayOrder: 20,
		sectionType: 'OPERATING',
		ifrsCategory: 'Other General',
		lineItemName: 'Payment Processing (Moyasar)',
		computeMethod: 'MANUAL',
		computeRate: null,
		budgetV6Total: '735000',
		monthlyAmounts: [
			'73500',
			'73500',
			'73500',
			'73500',
			'73500',
			'73500',
			'0',
			'0',
			'73500',
			'73500',
			'73500',
			'73500',
		],
	},
	{
		displayOrder: 21,
		sectionType: 'OPERATING',
		ifrsCategory: 'Other General',
		lineItemName: 'PFC Contribution (6%)',
		computeMethod: 'PERCENT_OF_REVENUE',
		computeRate: '0.06',
		budgetV6Total: '4120473',
		monthlyAmounts: [
			'328299.128292',
			'328299.128292',
			'328299.128292',
			'328299.128292',
			'328299.128292',
			'758083.540692',
			'0',
			'0',
			'381442.028292',
			'328651.628292',
			'328299.128292',
			'328299.128292',
		],
	},
	{
		displayOrder: 22,
		sectionType: 'OPERATING',
		ifrsCategory: 'School Materials',
		lineItemName: 'Workbooks (Fichiers)',
		computeMethod: 'MANUAL',
		computeRate: null,
		budgetV6Total: '541439.36',
		monthlyAmounts: [
			'45119.95',
			'45119.95',
			'45119.95',
			'45119.95',
			'45119.95',
			'45119.95',
			'45119.95',
			'45119.95',
			'45119.95',
			'45119.95',
			'45119.95',
			'45119.95',
		],
	},
	{
		displayOrder: 23,
		sectionType: 'OPERATING',
		ifrsCategory: 'School Materials',
		lineItemName: 'Supplies (Fournitures)',
		computeMethod: 'MANUAL',
		computeRate: null,
		budgetV6Total: '425416.64',
		monthlyAmounts: [
			'35451.39',
			'35451.39',
			'35451.39',
			'35451.39',
			'35451.39',
			'35451.39',
			'35451.39',
			'35451.39',
			'35451.39',
			'35451.39',
			'35451.39',
			'35451.39',
		],
	},
	{
		displayOrder: 24,
		sectionType: 'OPERATING',
		ifrsCategory: 'School Materials',
		lineItemName: 'Other Materials',
		computeMethod: 'MANUAL',
		computeRate: null,
		budgetV6Total: '100000',
		monthlyAmounts: [
			'8333.33',
			'8333.33',
			'8333.33',
			'8333.33',
			'8333.33',
			'8333.33',
			'8333.33',
			'8333.33',
			'8333.33',
			'8333.33',
			'8333.33',
			'8333.33',
		],
	},
	{
		displayOrder: 25,
		sectionType: 'OPERATING',
		ifrsCategory: 'Pedagogical',
		lineItemName: 'Pedagogical Credits',
		computeMethod: 'MANUAL',
		computeRate: null,
		budgetV6Total: '442539',
		monthlyAmounts: [
			'36878.25',
			'36878.25',
			'36878.25',
			'36878.25',
			'36878.25',
			'36878.25',
			'36878.25',
			'36878.25',
			'36878.25',
			'36878.25',
			'36878.25',
			'36878.25',
		],
	},
	{
		displayOrder: 26,
		sectionType: 'OPERATING',
		ifrsCategory: 'Pedagogical',
		lineItemName: 'Teaching Credits',
		computeMethod: 'MANUAL',
		computeRate: null,
		budgetV6Total: '276942',
		monthlyAmounts: [
			'23078.5',
			'23078.5',
			'23078.5',
			'23078.5',
			'23078.5',
			'23078.5',
			'23078.5',
			'23078.5',
			'23078.5',
			'23078.5',
			'23078.5',
			'23078.5',
		],
	},
	{
		displayOrder: 27,
		sectionType: 'OPERATING',
		ifrsCategory: 'Library & Subscriptions',
		lineItemName: 'BCD Subscriptions',
		computeMethod: 'MANUAL',
		computeRate: null,
		budgetV6Total: '22112.08',
		monthlyAmounts: [
			'1842.67',
			'1842.67',
			'1842.67',
			'1842.67',
			'1842.67',
			'1842.67',
			'1842.67',
			'1842.67',
			'1842.67',
			'1842.67',
			'1842.67',
			'1842.67',
		],
	},
	{
		displayOrder: 28,
		sectionType: 'OPERATING',
		ifrsCategory: 'Library & Subscriptions',
		lineItemName: 'CDI Subscriptions',
		computeMethod: 'MANUAL',
		computeRate: null,
		budgetV6Total: '11946.48',
		monthlyAmounts: [
			'995.54',
			'995.54',
			'995.54',
			'995.54',
			'995.54',
			'995.54',
			'995.54',
			'995.54',
			'995.54',
			'995.54',
			'995.54',
			'995.54',
		],
	},
	{
		displayOrder: 29,
		sectionType: 'OPERATING',
		ifrsCategory: 'Evaluation & Testing',
		lineItemName: 'Tests & Evaluations',
		computeMethod: 'MANUAL',
		computeRate: null,
		budgetV6Total: '12500',
		monthlyAmounts: [
			'1041.67',
			'1041.67',
			'1041.67',
			'1041.67',
			'1041.67',
			'1041.67',
			'1041.67',
			'1041.67',
			'1041.67',
			'1041.67',
			'1041.67',
			'1041.67',
		],
	},
	{
		displayOrder: 30,
		sectionType: 'OPERATING',
		ifrsCategory: 'Activities & Projects',
		lineItemName: 'School Projects',
		computeMethod: 'MANUAL',
		computeRate: null,
		budgetV6Total: '300000',
		monthlyAmounts: [
			'25000',
			'25000',
			'25000',
			'25000',
			'25000',
			'25000',
			'25000',
			'25000',
			'25000',
			'25000',
			'25000',
			'25000',
		],
	},
	{
		displayOrder: 31,
		sectionType: 'OPERATING',
		ifrsCategory: 'Activities & Projects',
		lineItemName: 'Trip Accompaniment',
		computeMethod: 'MANUAL',
		computeRate: null,
		budgetV6Total: '200000',
		monthlyAmounts: [
			'16666.67',
			'16666.67',
			'16666.67',
			'16666.67',
			'16666.67',
			'16666.67',
			'16666.67',
			'16666.67',
			'16666.67',
			'16666.67',
			'16666.67',
			'16666.67',
		],
	},
	{
		displayOrder: 32,
		sectionType: 'OPERATING',
		ifrsCategory: 'Activities & Projects',
		lineItemName: 'School Outings \u2013 Bus',
		computeMethod: 'MANUAL',
		computeRate: null,
		budgetV6Total: '45000',
		monthlyAmounts: [
			'3750',
			'3750',
			'3750',
			'3750',
			'3750',
			'3750',
			'3750',
			'3750',
			'3750',
			'3750',
			'3750',
			'3750',
		],
	},
];

// ── Non-Operating Line Items (Sheet: Non_Operating_Items) ────────────────────

const NON_OPERATING_LINE_ITEMS: LineItemSeed[] = [
	{
		displayOrder: 1,
		sectionType: 'NON_OPERATING',
		ifrsCategory: 'Depreciation',
		lineItemName: 'Depreciation of Assets (DOA)',
		computeMethod: 'MANUAL',
		computeRate: null,
		budgetV6Total: null,
		monthlyAmounts: [
			'439818',
			'439818',
			'439818',
			'439818',
			'439818',
			'439818',
			'439818',
			'439818',
			'439818',
			'439818',
			'439818',
			'439818',
		],
	},
	{
		displayOrder: 2,
		sectionType: 'NON_OPERATING',
		ifrsCategory: 'Impairment',
		lineItemName: 'Expected Credit Loss \u2013 Bad Debt',
		computeMethod: 'MANUAL',
		computeRate: null,
		budgetV6Total: null,
		monthlyAmounts: ['0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0'],
	},
	{
		displayOrder: 3,
		sectionType: 'NON_OPERATING',
		ifrsCategory: 'Finance Income',
		lineItemName: 'Investment Income (Placements)',
		computeMethod: 'MANUAL',
		computeRate: null,
		budgetV6Total: null,
		monthlyAmounts: [
			'41666.67',
			'41666.67',
			'41666.67',
			'41666.67',
			'41666.67',
			'41666.67',
			'41666.67',
			'41666.67',
			'41666.67',
			'41666.67',
			'41666.67',
			'41666.67',
		],
	},
	{
		displayOrder: 4,
		sectionType: 'NON_OPERATING',
		ifrsCategory: 'Finance Income',
		lineItemName: 'Foreign Exchange Gains',
		computeMethod: 'MANUAL',
		computeRate: null,
		budgetV6Total: null,
		monthlyAmounts: ['0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0'],
	},
	{
		displayOrder: 5,
		sectionType: 'NON_OPERATING',
		ifrsCategory: 'Finance Costs',
		lineItemName: 'Bank Charges',
		computeMethod: 'MANUAL',
		computeRate: null,
		budgetV6Total: null,
		monthlyAmounts: [
			'23820.85',
			'23820.85',
			'23820.85',
			'23820.85',
			'23820.85',
			'23820.85',
			'23820.85',
			'23820.85',
			'23820.85',
			'23820.85',
			'23820.85',
			'23820.85',
		],
	},
	{
		displayOrder: 6,
		sectionType: 'NON_OPERATING',
		ifrsCategory: 'Finance Costs',
		lineItemName: 'Foreign Exchange Losses',
		computeMethod: 'MANUAL',
		computeRate: null,
		budgetV6Total: null,
		monthlyAmounts: ['0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0'],
	},
];

// ── All line items combined ──────────────────────────────────────────────────

const ALL_LINE_ITEMS: LineItemSeed[] = [...OPERATING_LINE_ITEMS, ...NON_OPERATING_LINE_ITEMS];

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Round a Decimal value to 4 decimal places with ROUND_HALF_UP.
 */
function toDecimal4(value: string): string {
	return new Decimal(value).toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4);
}

/**
 * Compute the FY total from 12 monthly amounts.
 */
function computeFyTotal(monthlyAmounts: string[]): Decimal {
	let total = new Decimal(0);
	for (const amount of monthlyAmounts) {
		total = total.plus(new Decimal(amount));
	}
	return total.toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
	console.log('=== Import OpEx Budget Data (FY2026) ===\n');

	// Step 1: Find version v2 for FY2026

	console.log('[1/4] Finding target version...');

	let version = await prisma.budgetVersion.findFirst({
		where: { name: 'v2', fiscalYear: 2026 },
		select: { id: true, name: true, fiscalYear: true, status: true },
	});

	// Fallback: find the latest Draft version for FY2026
	if (!version) {
		console.log('  Version "v2" not found. Looking for latest Draft version (FY2026)...');
		version = await prisma.budgetVersion.findFirst({
			where: { fiscalYear: 2026, status: 'Draft' },
			orderBy: { id: 'desc' },
			select: { id: true, name: true, fiscalYear: true, status: true },
		});
	}

	if (!version) {
		console.error('ERROR: No version "v2" (FY2026) or Draft version found. Aborting.');
		process.exitCode = 1;
		return;
	}

	const versionId = version.id;

	console.log(
		`  Found version: id=${versionId}, name="${version.name}", ` +
			`fy=${version.fiscalYear}, status="${version.status}"`
	);

	// Step 1b: Ensure migration user for createdBy
	const userId = await ensureMigrationUser(prisma);

	console.log(`  Migration user ID: ${userId}`);

	// Step 2: Delete existing OpEx data for this version (idempotent)

	console.log('\n[2/4] Clearing existing OpEx data for version...');

	const deletedMonthly = await prisma.monthlyOpEx.deleteMany({
		where: { versionId },
	});

	console.log(`  Deleted ${deletedMonthly.count} monthly_opex records`);

	const deletedLineItems = await prisma.versionOpExLineItem.deleteMany({
		where: { versionId },
	});

	console.log(`  Deleted ${deletedLineItems.count} version_opex_line_items records`);

	// Step 3: Insert line items and monthly amounts in a transaction

	console.log('\n[3/4] Inserting OpEx line items and monthly amounts...');

	let lineItemCount = 0;
	let monthlyCount = 0;
	let operatingTotal = new Decimal(0);
	let nonOperatingTotal = new Decimal(0);

	await prisma.$transaction(
		async (tx) => {
			for (const item of ALL_LINE_ITEMS) {
				// Create the line item
				const lineItem = await tx.versionOpExLineItem.create({
					data: {
						versionId,
						sectionType: item.sectionType,
						ifrsCategory: item.ifrsCategory,
						lineItemName: item.lineItemName,
						displayOrder: item.displayOrder,
						computeMethod: item.computeMethod,
						computeRate: item.computeRate ? toDecimal4(item.computeRate) : null,
						budgetV6Total: item.budgetV6Total ? toDecimal4(item.budgetV6Total) : null,
						createdBy: userId,
					},
				});
				lineItemCount++;

				// Compute FY total for logging
				const fyTotal = computeFyTotal(item.monthlyAmounts);
				if (item.sectionType === 'OPERATING') {
					operatingTotal = operatingTotal.plus(fyTotal);
				} else {
					nonOperatingTotal = nonOperatingTotal.plus(fyTotal);
				}

				// Create 12 monthly records (months 1-12)
				for (let month = 1; month <= 12; month++) {
					const rawAmount = item.monthlyAmounts[month - 1];
					if (rawAmount === undefined) {
						throw new Error(`Missing month ${month} for "${item.lineItemName}"`);
					}
					const amount = toDecimal4(rawAmount);
					await tx.monthlyOpEx.create({
						data: {
							versionId,
							lineItemId: lineItem.id,
							month,
							amount,
							calculatedBy: userId,
						},
					});
					monthlyCount++;
				}
			}
		},
		{
			timeout: 60_000,
		}
	);

	console.log(`  Inserted ${lineItemCount} line items`);

	console.log(`  Inserted ${monthlyCount} monthly records`);

	// Step 4: Verification

	console.log('\n[4/4] Verification...');

	const dbLineItems = await prisma.versionOpExLineItem.count({
		where: { versionId },
	});
	const dbMonthly = await prisma.monthlyOpEx.count({
		where: { versionId },
	});

	const operatingItems = OPERATING_LINE_ITEMS.length;
	const nonOperatingItems = NON_OPERATING_LINE_ITEMS.length;

	console.log(`  DB line items: ${dbLineItems} (expected ${ALL_LINE_ITEMS.length})`);

	console.log(`  DB monthly records: ${dbMonthly} (expected ${ALL_LINE_ITEMS.length * 12})`);

	console.log(`  Operating items: ${operatingItems}`);

	console.log(`  Non-operating items: ${nonOperatingItems}`);

	console.log(`  Operating FY total: SAR ${operatingTotal.toFixed(4)}`);

	console.log(`  Non-operating FY total: SAR ${nonOperatingTotal.toFixed(4)}`);

	console.log(`  Combined FY total: SAR ${operatingTotal.plus(nonOperatingTotal).toFixed(4)}`);

	// Per-category breakdown

	console.log('\n  Per-category breakdown:');
	const categoryTotals = new Map<string, Decimal>();
	for (const item of ALL_LINE_ITEMS) {
		const key = `[${item.sectionType}] ${item.ifrsCategory}`;
		const fyTotal = computeFyTotal(item.monthlyAmounts);
		const existing = categoryTotals.get(key) ?? new Decimal(0);
		categoryTotals.set(key, existing.plus(fyTotal));
	}
	for (const [category, total] of categoryTotals) {
		console.log(`    ${category}: SAR ${total.toFixed(4)}`);
	}

	// Validation
	const expectedLineItems = ALL_LINE_ITEMS.length;
	const expectedMonthly = expectedLineItems * 12;
	if (dbLineItems !== expectedLineItems || dbMonthly !== expectedMonthly) {
		console.error('\n  VALIDATION FAILED: Record counts do not match!');
		process.exitCode = 1;
		return;
	}

	// Mark OPEX as stale-resolved (remove from staleModules if present)
	const currentVersion = await prisma.budgetVersion.findUniqueOrThrow({
		where: { id: versionId },
		select: { staleModules: true },
	});
	const staleSet = new Set(currentVersion.staleModules);
	staleSet.add('PNL'); // OpEx data changed, PNL needs recalculation
	await prisma.budgetVersion.update({
		where: { id: versionId },
		data: { staleModules: Array.from(staleSet) },
	});

	console.log(`\n  staleModules updated: [${Array.from(staleSet).join(', ')}]`);

	// Final summary

	console.log('\n=== Import Complete ===');

	console.log(
		JSON.stringify(
			{
				versionId,
				versionName: version.name,
				lineItemsInserted: lineItemCount,
				monthlyRecordsInserted: monthlyCount,
				operatingLineItems: operatingItems,
				nonOperatingLineItems: nonOperatingItems,
				operatingFyTotal: operatingTotal.toFixed(4),
				nonOperatingFyTotal: nonOperatingTotal.toFixed(4),
				combinedFyTotal: operatingTotal.plus(nonOperatingTotal).toFixed(4),
			},
			null,
			2
		)
	);
}

main()
	.catch((e) => {
		console.error('Fatal error:', e);
		process.exitCode = 1;
	})
	.finally(() => {
		prisma.$disconnect();
	});
