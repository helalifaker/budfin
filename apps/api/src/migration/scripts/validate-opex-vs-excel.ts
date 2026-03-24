/**
 * Validate OpEx data in DB matches Excel file 100%.
 * Run: DATABASE_URL=... pnpm --filter @budfin/api exec tsx src/migration/scripts/validate-opex-vs-excel.ts
 */
import { PrismaClient } from '@prisma/client';
import { Decimal } from 'decimal.js';

const prisma = new PrismaClient();
const TOLERANCE = new Decimal('0.01');

interface ExpectedItem {
	lineItemName: string;
	sectionType: string;
	monthly: number[];
	fyTotal: number;
}

// All 38 line items with exact monthly values from the Excel
const EXPECTED: ExpectedItem[] = [
	{
		lineItemName: 'Rent',
		sectionType: 'OPERATING',
		monthly: [
			699626.5, 699626.5, 699626.5, 699626.5, 699626.5, 699626.5, 699626.5, 699626.5, 699626.5,
			699626.5, 699626.5, 699626.5,
		],
		fyTotal: 8395518,
	},
	{
		lineItemName: 'Electricity',
		sectionType: 'OPERATING',
		monthly: [35000, 35000, 35000, 35000, 35000, 35000, 35000, 35000, 35000, 35000, 35000, 35000],
		fyTotal: 420000,
	},
	{
		lineItemName: 'Water',
		sectionType: 'OPERATING',
		monthly: [
			13833.33, 13833.33, 13833.33, 13833.33, 13833.33, 13833.33, 13833.33, 13833.33, 13833.33,
			13833.33, 13833.33, 13833.33,
		],
		fyTotal: 165999.96,
	},
	{
		lineItemName: 'Maintenance Contracts',
		sectionType: 'OPERATING',
		monthly: [
			230521, 230521, 230521, 230521, 230521, 230521, 230521, 230521, 230521, 230521, 230521,
			230521,
		],
		fyTotal: 2766252,
	},
	{
		lineItemName: 'Security',
		sectionType: 'OPERATING',
		monthly: [
			144200, 144200, 144200, 144200, 144200, 144200, 144200, 144200, 144200, 144200, 144200,
			144200,
		],
		fyTotal: 1730400,
	},
	{
		lineItemName: 'Equipment Maintenance',
		sectionType: 'OPERATING',
		monthly: [35000, 35000, 35000, 35000, 35000, 35000, 0, 0, 35000, 35000, 35000, 35000],
		fyTotal: 350000,
	},
	{
		lineItemName: 'Administration Supplies',
		sectionType: 'OPERATING',
		monthly: [47000, 47000, 47000, 47000, 47000, 47000, 0, 0, 47000, 47000, 47000, 47000],
		fyTotal: 470000,
	},
	{
		lineItemName: 'Photocopier Contract',
		sectionType: 'OPERATING',
		monthly: [
			6192.67, 6192.67, 6192.67, 6192.67, 6192.67, 6192.67, 6192.67, 6192.67, 6192.67, 6192.67,
			6192.67, 6192.67,
		],
		fyTotal: 74312.04,
	},
	{
		lineItemName: 'Medical Insurance \u2013 Saudi Staff',
		sectionType: 'OPERATING',
		monthly: [
			5794.42, 5794.42, 5794.42, 5794.42, 5794.42, 5794.42, 5794.42, 5794.42, 5794.42, 5794.42,
			5794.42, 5794.42,
		],
		fyTotal: 69533.04,
	},
	{
		lineItemName: 'School Insurance',
		sectionType: 'OPERATING',
		monthly: [18000, 18000, 18000, 18000, 18000, 18000, 18000, 18000, 18000, 18000, 18000, 18000],
		fyTotal: 216000,
	},
	{
		lineItemName: 'External Audit',
		sectionType: 'OPERATING',
		monthly: [3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000],
		fyTotal: 36000,
	},
	{
		lineItemName: 'Communication',
		sectionType: 'OPERATING',
		monthly: [2500, 2500, 2500, 2500, 2500, 2500, 2500, 2500, 2500, 2500, 2500, 2500],
		fyTotal: 30000,
	},
	{
		lineItemName: 'IT Equipment',
		sectionType: 'OPERATING',
		monthly: [40000, 40000, 40000, 40000, 40000, 40000, 0, 0, 40000, 40000, 40000, 40000],
		fyTotal: 400000,
	},
	{
		lineItemName: 'Telephone & Internet',
		sectionType: 'OPERATING',
		monthly: [25000, 25000, 25000, 25000, 25000, 25000, 25000, 25000, 25000, 25000, 25000, 25000],
		fyTotal: 300000,
	},
	{
		lineItemName: 'Vehicle Fuel & Maintenance',
		sectionType: 'OPERATING',
		monthly: [2000, 2000, 2000, 2000, 2000, 2000, 0, 0, 2000, 2000, 2000, 2000],
		fyTotal: 20000,
	},
	{
		lineItemName: 'Infirmary',
		sectionType: 'OPERATING',
		monthly: [2500, 2500, 2500, 2500, 2500, 2500, 0, 0, 2500, 2500, 2500, 2500],
		fyTotal: 25000,
	},
	{
		lineItemName: 'Reception & Events',
		sectionType: 'OPERATING',
		monthly: [2500, 2500, 2500, 2500, 2500, 2500, 0, 0, 2500, 2500, 2500, 2500],
		fyTotal: 25000,
	},
	{
		lineItemName: 'Class Photos / Printing',
		sectionType: 'OPERATING',
		monthly: [2000, 2000, 2000, 2000, 2000, 2000, 0, 0, 2000, 2000, 2000, 2000],
		fyTotal: 20000,
	},
	{
		lineItemName: 'Social Aid Fund',
		sectionType: 'OPERATING',
		monthly: [8000, 8000, 8000, 8000, 8000, 8000, 0, 0, 8000, 8000, 8000, 8000],
		fyTotal: 80000,
	},
	{
		lineItemName: 'Payment Processing (Moyasar)',
		sectionType: 'OPERATING',
		monthly: [73500, 73500, 73500, 73500, 73500, 73500, 0, 0, 73500, 73500, 73500, 73500],
		fyTotal: 735000,
	},
	{
		lineItemName: 'PFC Contribution (6%)',
		sectionType: 'OPERATING',
		monthly: [
			328299.128292, 328299.128292, 328299.128292, 328299.128292, 328299.128292, 758083.540692, 0,
			0, 381442.028292, 328651.628292, 328299.128292, 328299.128292,
		],
		fyTotal: 3766271.0953,
	},
	{
		lineItemName: 'Workbooks (Fichiers)',
		sectionType: 'OPERATING',
		monthly: [
			45119.95, 45119.95, 45119.95, 45119.95, 45119.95, 45119.95, 45119.95, 45119.95, 45119.95,
			45119.95, 45119.95, 45119.95,
		],
		fyTotal: 541439.4,
	},
	{
		lineItemName: 'Supplies (Fournitures)',
		sectionType: 'OPERATING',
		monthly: [
			35451.39, 35451.39, 35451.39, 35451.39, 35451.39, 35451.39, 35451.39, 35451.39, 35451.39,
			35451.39, 35451.39, 35451.39,
		],
		fyTotal: 425416.68,
	},
	{
		lineItemName: 'Other Materials',
		sectionType: 'OPERATING',
		monthly: [
			8333.33, 8333.33, 8333.33, 8333.33, 8333.33, 8333.33, 8333.33, 8333.33, 8333.33, 8333.33,
			8333.33, 8333.33,
		],
		fyTotal: 99999.96,
	},
	{
		lineItemName: 'Pedagogical Credits',
		sectionType: 'OPERATING',
		monthly: [
			36878.25, 36878.25, 36878.25, 36878.25, 36878.25, 36878.25, 36878.25, 36878.25, 36878.25,
			36878.25, 36878.25, 36878.25,
		],
		fyTotal: 442539,
	},
	{
		lineItemName: 'Teaching Credits',
		sectionType: 'OPERATING',
		monthly: [
			23078.5, 23078.5, 23078.5, 23078.5, 23078.5, 23078.5, 23078.5, 23078.5, 23078.5, 23078.5,
			23078.5, 23078.5,
		],
		fyTotal: 276942,
	},
	{
		lineItemName: 'BCD Subscriptions',
		sectionType: 'OPERATING',
		monthly: [
			1842.67, 1842.67, 1842.67, 1842.67, 1842.67, 1842.67, 1842.67, 1842.67, 1842.67, 1842.67,
			1842.67, 1842.67,
		],
		fyTotal: 22112.04,
	},
	{
		lineItemName: 'CDI Subscriptions',
		sectionType: 'OPERATING',
		monthly: [
			995.54, 995.54, 995.54, 995.54, 995.54, 995.54, 995.54, 995.54, 995.54, 995.54, 995.54,
			995.54,
		],
		fyTotal: 11946.48,
	},
	{
		lineItemName: 'Tests & Evaluations',
		sectionType: 'OPERATING',
		monthly: [
			1041.67, 1041.67, 1041.67, 1041.67, 1041.67, 1041.67, 1041.67, 1041.67, 1041.67, 1041.67,
			1041.67, 1041.67,
		],
		fyTotal: 12500.04,
	},
	{
		lineItemName: 'School Projects',
		sectionType: 'OPERATING',
		monthly: [25000, 25000, 25000, 25000, 25000, 25000, 25000, 25000, 25000, 25000, 25000, 25000],
		fyTotal: 300000,
	},
	{
		lineItemName: 'Trip Accompaniment',
		sectionType: 'OPERATING',
		monthly: [
			16666.67, 16666.67, 16666.67, 16666.67, 16666.67, 16666.67, 16666.67, 16666.67, 16666.67,
			16666.67, 16666.67, 16666.67,
		],
		fyTotal: 200000.04,
	},
	{
		lineItemName: 'School Outings \u2013 Bus',
		sectionType: 'OPERATING',
		monthly: [3750, 3750, 3750, 3750, 3750, 3750, 3750, 3750, 3750, 3750, 3750, 3750],
		fyTotal: 45000,
	},
	{
		lineItemName: 'Depreciation of Assets (DOA)',
		sectionType: 'NON_OPERATING',
		monthly: [
			439818, 439818, 439818, 439818, 439818, 439818, 439818, 439818, 439818, 439818, 439818,
			439818,
		],
		fyTotal: 5277816,
	},
	{
		lineItemName: 'Expected Credit Loss \u2013 Bad Debt',
		sectionType: 'NON_OPERATING',
		monthly: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
		fyTotal: 0,
	},
	{
		lineItemName: 'Investment Income (Placements)',
		sectionType: 'NON_OPERATING',
		monthly: [
			41666.67, 41666.67, 41666.67, 41666.67, 41666.67, 41666.67, 41666.67, 41666.67, 41666.67,
			41666.67, 41666.67, 41666.67,
		],
		fyTotal: 500000.04,
	},
	{
		lineItemName: 'Foreign Exchange Gains',
		sectionType: 'NON_OPERATING',
		monthly: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
		fyTotal: 0,
	},
	{
		lineItemName: 'Bank Charges',
		sectionType: 'NON_OPERATING',
		monthly: [
			23820.85, 23820.85, 23820.85, 23820.85, 23820.85, 23820.85, 23820.85, 23820.85, 23820.85,
			23820.85, 23820.85, 23820.85,
		],
		fyTotal: 285850.2,
	},
	{
		lineItemName: 'Foreign Exchange Losses',
		sectionType: 'NON_OPERATING',
		monthly: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
		fyTotal: 0,
	},
];

const EXPECTED_OPERATING_TOTAL = 22473181.7753;

async function main() {
	const version = await prisma.budgetVersion.findFirst({
		where: { name: 'v2', fiscalYear: 2026 },
	});
	 
	if (!version) {
		console.error('Version v2 not found');
		process.exit(1);
	}

	 
	console.log('Validating OpEx for version', version.name, 'id=', version.id);

	const lineItems = await prisma.versionOpExLineItem.findMany({
		where: { versionId: version.id },
		include: { monthlyAmounts: { orderBy: { month: 'asc' } } },
	});

	let errors = 0;
	let checks = 0;
	let passed = 0;

	// Count check
	checks++;
	if (lineItems.length !== EXPECTED.length) {
		 
		console.error('FAIL count:', lineItems.length, 'vs', EXPECTED.length);
		errors++;
	} else {
		passed++;
	}

	for (const exp of EXPECTED) {
		const db = lineItems.find(
			(li) => li.lineItemName === exp.lineItemName && li.sectionType === exp.sectionType
		);
		if (!db) {
			 
			console.error('FAIL missing:', exp.lineItemName);
			errors++;
			continue;
		}

		for (let m = 0; m < 12; m++) {
			checks++;
			const dbMa = db.monthlyAmounts.find((ma) => ma.month === m + 1);
			const dbAmt = dbMa ? new Decimal(String(dbMa.amount)) : new Decimal(0);
			const expAmt = new Decimal(exp.monthly[m]!);
			if (dbAmt.minus(expAmt).abs().gt(TOLERANCE)) {
				 
				console.error(
					'FAIL',
					exp.lineItemName,
					'M' + (m + 1) + ':',
					dbAmt.toFixed(4),
					'vs',
					expAmt.toFixed(4)
				);
				errors++;
			} else {
				passed++;
			}
		}

		// FY total
		checks++;
		const dbFy = db.monthlyAmounts.reduce((s, ma) => s.plus(String(ma.amount)), new Decimal(0));
		if (dbFy.minus(exp.fyTotal).abs().gt(TOLERANCE)) {
			 
			console.error('FAIL FY', exp.lineItemName, ':', dbFy.toFixed(4), 'vs', exp.fyTotal);
			errors++;
		} else {
			passed++;
		}
	}

	// Grand total
	checks++;
	const dbOpTotal = lineItems
		.filter((li) => li.sectionType === 'OPERATING')
		.flatMap((li) => li.monthlyAmounts)
		.reduce((s, ma) => s.plus(String(ma.amount)), new Decimal(0));

	if (dbOpTotal.minus(EXPECTED_OPERATING_TOTAL).abs().gt(TOLERANCE)) {
		 
		console.error('FAIL grand total:', dbOpTotal.toFixed(4), 'vs', EXPECTED_OPERATING_TOTAL);
		errors++;
	} else {
		passed++;
		 
		console.log('PASS grand total:', dbOpTotal.toFixed(4));
	}

	 
	console.log('\n=== RESULT ===');
	 
	console.log('Checks:', checks, '| Passed:', passed, '| Failed:', errors);

	if (errors === 0) {
		 
		console.log('\n*** 100% MATCH — ALL CHECKS PASSED ***');
	} else {
		 
		console.error('\n***', errors, 'FAILURES ***');
		process.exit(1);
	}
}

 
main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
