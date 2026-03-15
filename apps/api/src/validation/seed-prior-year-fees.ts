// Prior-Year Fee Seed — creates an Actuals FY2025 version with fee data from the 2025-2026 tariff PDF
// Links via FiscalPeriod so the prior-year comparison endpoint works.
// Run: pnpm --filter @budfin/api exec tsx src/validation/seed-prior-year-fees.ts
//
// Source: data/Schooling fees/3.-Tarifs-25-26.pdf

import { PrismaClient } from '@prisma/client';
import { Decimal } from 'decimal.js';

const prisma = new PrismaClient();

const FISCAL_YEAR = 2025;
const VERSION_NAME = 'Actuals FY2025';

// ── Band-level fee data from the 2025-2026 tariff PDF ─────────────────────

interface BandFee {
	band: string;
	grades: string[];
	dai: string;
	tuitionTtc: string;
	tuitionHt: string;
	term1: string;
	term2: string;
	term3: string;
}

function dec(n: number, places = 4): string {
	return new Decimal(n).toDecimalPlaces(places, Decimal.ROUND_HALF_UP).toFixed(places);
}

function htFromTtc(ttc: number, vatRate: number): string {
	return new Decimal(ttc)
		.div(new Decimal(1).plus(new Decimal(vatRate)))
		.toDecimalPlaces(4, Decimal.ROUND_HALF_UP)
		.toFixed(4);
}

// Francais: TTC prices, 15% VAT
const FRANCAIS_FEES: BandFee[] = [
	{
		band: 'PS',
		grades: ['PS'],
		dai: dec(5000),
		tuitionTtc: dec(30000),
		tuitionHt: htFromTtc(30000, 0.15),
		term1: dec(12000),
		term2: dec(9000),
		term3: dec(9000),
	},
	{
		band: 'MS_GS',
		grades: ['MS', 'GS'],
		dai: dec(5000),
		tuitionTtc: dec(34500),
		tuitionHt: htFromTtc(34500, 0.15),
		term1: dec(13800),
		term2: dec(10350),
		term3: dec(10350),
	},
	{
		band: 'ELEM',
		grades: ['CP', 'CE1', 'CE2', 'CM1', 'CM2'],
		dai: dec(5000),
		tuitionTtc: dec(34500),
		tuitionHt: htFromTtc(34500, 0.15),
		term1: dec(13800),
		term2: dec(10350),
		term3: dec(10350),
	},
	{
		band: 'COLLEGE',
		grades: ['6EME', '5EME', '4EME', '3EME'],
		dai: dec(5000),
		tuitionTtc: dec(34500),
		tuitionHt: htFromTtc(34500, 0.15),
		term1: dec(13800),
		term2: dec(10350),
		term3: dec(10350),
	},
	{
		band: 'LYCEE',
		grades: ['2NDE', '1ERE', 'TERM'],
		dai: dec(5000),
		tuitionTtc: dec(38500),
		tuitionHt: htFromTtc(38500, 0.15),
		term1: dec(15400),
		term2: dec(11550),
		term3: dec(11550),
	},
];

// Nationaux (KSA): HT prices (0% VAT), TTC = HT
const NATIONAUX_FEES: BandFee[] = [
	{
		band: 'PS',
		grades: ['PS'],
		dai: dec(4350),
		tuitionTtc: dec(34783),
		tuitionHt: dec(34783),
		term1: dec(13913.2),
		term2: dec(10434.9),
		term3: dec(10434.9),
	},
	{
		band: 'MS_GS',
		grades: ['MS', 'GS'],
		dai: dec(4350),
		tuitionTtc: dec(35650),
		tuitionHt: dec(35650),
		term1: dec(14260),
		term2: dec(10695),
		term3: dec(10695),
	},
	{
		band: 'ELEM',
		grades: ['CP', 'CE1', 'CE2', 'CM1', 'CM2'],
		dai: dec(4350),
		tuitionTtc: dec(35650),
		tuitionHt: dec(35650),
		term1: dec(14260),
		term2: dec(10695),
		term3: dec(10695),
	},
	{
		band: 'COLLEGE',
		grades: ['6EME', '5EME', '4EME', '3EME'],
		dai: dec(4350),
		tuitionTtc: dec(35650),
		tuitionHt: dec(35650),
		term1: dec(14260),
		term2: dec(10695),
		term3: dec(10695),
	},
	{
		band: 'LYCEE',
		grades: ['2NDE', '1ERE', 'TERM'],
		dai: dec(4350),
		tuitionTtc: dec(40000),
		tuitionHt: dec(40000),
		term1: dec(16000),
		term2: dec(12000),
		term3: dec(12000),
	},
];

// Autres Nationalites: TTC prices, 15% VAT
const AUTRES_FEES: BandFee[] = [
	{
		band: 'PS',
		grades: ['PS'],
		dai: dec(5000),
		tuitionTtc: dec(40000),
		tuitionHt: htFromTtc(40000, 0.15),
		term1: dec(16000),
		term2: dec(12000),
		term3: dec(12000),
	},
	{
		band: 'MS_GS',
		grades: ['MS', 'GS'],
		dai: dec(5000),
		tuitionTtc: dec(41000),
		tuitionHt: htFromTtc(41000, 0.15),
		term1: dec(16400),
		term2: dec(12300),
		term3: dec(12300),
	},
	{
		band: 'ELEM',
		grades: ['CP', 'CE1', 'CE2', 'CM1', 'CM2'],
		dai: dec(5000),
		tuitionTtc: dec(41000),
		tuitionHt: htFromTtc(41000, 0.15),
		term1: dec(16400),
		term2: dec(12300),
		term3: dec(12300),
	},
	{
		band: 'COLLEGE',
		grades: ['6EME', '5EME', '4EME', '3EME'],
		dai: dec(5000),
		tuitionTtc: dec(41000),
		tuitionHt: htFromTtc(41000, 0.15),
		term1: dec(16400),
		term2: dec(12300),
		term3: dec(12300),
	},
	{
		band: 'LYCEE',
		grades: ['2NDE', '1ERE', 'TERM'],
		dai: dec(5000),
		tuitionTtc: dec(46000),
		tuitionHt: htFromTtc(46000, 0.15),
		term1: dec(18400),
		term2: dec(13800),
		term3: dec(13800),
	},
];

const ALL_NATIONALITY_FEES: Array<{ nationality: string; bands: BandFee[] }> = [
	{ nationality: 'Francais', bands: FRANCAIS_FEES },
	{ nationality: 'Nationaux', bands: NATIONAUX_FEES },
	{ nationality: 'Autres', bands: AUTRES_FEES },
];

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
	// eslint-disable-next-line no-console
	console.log('=== Prior-Year Fee Seed: FY2025 ===\n');

	// Find admin user
	const admin = await prisma.user.findFirst({ where: { role: 'Admin' } });
	if (!admin) {
		// eslint-disable-next-line no-console
		console.error('No admin user found. Run prisma seed first.');
		process.exit(1);
	}

	// Check for existing prior-year version
	const existing = await prisma.budgetVersion.findFirst({
		where: { name: VERSION_NAME, fiscalYear: FISCAL_YEAR },
	});
	if (existing) {
		// eslint-disable-next-line no-console
		console.log(`Deleting existing prior-year version (id=${existing.id})...`);
		await prisma.budgetVersion.delete({ where: { id: existing.id } });
	}

	// Create actuals version for FY2025
	const version = await prisma.budgetVersion.create({
		data: {
			fiscalYear: FISCAL_YEAR,
			name: VERSION_NAME,
			type: 'Budget',
			status: 'Published',
			dataSource: 'IMPORTED',
			createdById: admin.id,
			modificationCount: 0,
			staleModules: [],
		},
	});
	// eslint-disable-next-line no-console
	console.log(`Created BudgetVersion: id=${version.id}, name="${version.name}"`);

	// Create FeeGrid entries — expand bands to individual grades, Plein tariff only
	let feeCount = 0;
	for (const { nationality, bands } of ALL_NATIONALITY_FEES) {
		for (const band of bands) {
			for (const grade of band.grades) {
				await prisma.feeGrid.create({
					data: {
						versionId: version.id,
						academicPeriod: 'AY1',
						gradeLevel: grade,
						nationality,
						tariff: 'Plein',
						dai: band.dai,
						tuitionTtc: band.tuitionTtc,
						tuitionHt: band.tuitionHt,
						term1Amount: band.term1,
						term2Amount: band.term2,
						term3Amount: band.term3,
						createdBy: admin.id,
					},
				});
				feeCount++;
			}
		}
	}
	// eslint-disable-next-line no-console
	console.log(`Inserted ${feeCount} fee grid entries (Plein tariff, 15 grades x 3 nationalities)`);

	// Create VersionRevenueSettings (required for the version to be valid)
	await prisma.versionRevenueSettings.create({
		data: {
			versionId: version.id,
			dpiPerStudentHt: '2000.0000',
			dossierPerStudentHt: '1000.0000',
			examBacPerStudent: '1300.0000',
			examDnbPerStudent: '250.0000',
			examEafPerStudent: '500.0000',
			evalPrimairePerStudent: '200.0000',
			evalSecondairePerStudent: '300.0000',
			flatDiscountPct: '0.000000',
			createdBy: admin.id,
		},
	});
	// eslint-disable-next-line no-console
	console.log('Created VersionRevenueSettings for prior-year version');

	// Link FiscalPeriod records for FY2025 to the actuals version
	// Academic months: Sep(9) through Jun(6) of the next calendar year
	const academicMonths = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6];
	let linkedCount = 0;

	for (const month of academicMonths) {
		await prisma.fiscalPeriod.upsert({
			where: {
				fiscalYear_month: {
					fiscalYear: FISCAL_YEAR,
					month,
				},
			},
			create: {
				fiscalYear: FISCAL_YEAR,
				month,
				status: 'Locked',
				actualVersionId: version.id,
			},
			update: {
				actualVersionId: version.id,
			},
		});
		linkedCount++;
	}
	// eslint-disable-next-line no-console
	console.log(`Linked ${linkedCount} FiscalPeriod records (FY${FISCAL_YEAR}) to actuals version`);

	// Summary
	// eslint-disable-next-line no-console
	console.log('\n=== Summary ===');
	// eslint-disable-next-line no-console
	console.log(`Actuals version: id=${version.id}, FY${FISCAL_YEAR}`);
	// eslint-disable-next-line no-console
	console.log(`Fee grid: ${feeCount} entries (band-level Plein tariff)`);
	// eslint-disable-next-line no-console
	console.log(`FiscalPeriods: ${linkedCount} months linked`);
	// eslint-disable-next-line no-console
	console.log('\nThe prior-year comparison endpoint will now return data for FY2026 versions.');
}

main()
	.catch((e) => {
		// eslint-disable-next-line no-console
		console.error('Fatal error:', e);
		process.exit(1);
	})
	.finally(() => {
		prisma.$disconnect();
	});
