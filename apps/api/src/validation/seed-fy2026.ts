// Validation Seed Script — loads FY2026 fixtures into a "Validation FY2026" BudgetVersion
// Standalone script, does NOT modify production seed
// Requires: running database (DATABASE_URL) + an existing admin user
// Run: pnpm --filter @budfin/api exec tsx src/validation/seed-fy2026.ts

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Decimal } from 'decimal.js';
import {
	calculateRevenue,
	type EnrollmentDetailInput,
	type FeeGridInput,
	type DiscountPolicyInput,
	type OtherRevenueInput,
} from '../services/revenue-engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURES = resolve(__dirname, '..', '..', '..', '..', 'data', 'fixtures');

const prisma = new PrismaClient();

// ── Fixture types ────────────────────────────────────────────────────────────

interface FeeGridFixture {
	academicPeriod: 'AY1' | 'AY2';
	gradeLevel: string;
	nationality: string;
	tariff: string;
	tuitionTtc: string;
	tuitionHt: string;
	dai: string;
}

interface DiscountFixture {
	tariff: string;
	discountRate: string;
}

interface EnrollmentDetailFixture {
	academicPeriod: 'AY1' | 'AY2';
	gradeLevel: string;
	nationality: string;
	tariff: string;
	headcount: number;
}

interface OtherRevenueFixture {
	lineItemName: string;
	annualAmount: string;
	distributionMethod: string;
	weightArray: number[] | null;
	specificMonths: number[] | null;
	ifrsCategory: string;
	computeMethod: string | null;
}

interface ExpectedRevenueFixture {
	month: number;
	totalOperatingRevenue: string;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
	// eslint-disable-next-line no-console
	console.log('=== Validation Seed: FY2026 ===\n');

	// Load fixtures
	const feeGrid: FeeGridFixture[] = JSON.parse(
		readFileSync(resolve(FIXTURES, 'fy2026-fee-grid.json'), 'utf-8')
	);
	const discounts: DiscountFixture[] = JSON.parse(
		readFileSync(resolve(FIXTURES, 'fy2026-discounts.json'), 'utf-8')
	);
	const enrollmentDetail: EnrollmentDetailFixture[] = JSON.parse(
		readFileSync(resolve(FIXTURES, 'fy2026-enrollment-detail.json'), 'utf-8')
	);
	const otherRevenue: OtherRevenueFixture[] = JSON.parse(
		readFileSync(resolve(FIXTURES, 'fy2026-other-revenue.json'), 'utf-8')
	);
	const expectedRevenue: ExpectedRevenueFixture[] = JSON.parse(
		readFileSync(resolve(FIXTURES, 'fy2026-expected-revenue.json'), 'utf-8')
	);

	// eslint-disable-next-line no-console
	console.log(
		`Fixtures loaded: ${feeGrid.length} fees, ${enrollmentDetail.length} enrollment, ${discounts.length} discounts, ${otherRevenue.length} other rev`
	);

	// Find admin user
	const admin = await prisma.user.findFirst({ where: { role: 'Admin' } });
	if (!admin) {
		// eslint-disable-next-line no-console
		console.error('No admin user found. Run prisma seed first.');
		process.exit(1);
	}

	// Check for existing validation version
	const existing = await prisma.budgetVersion.findFirst({
		where: { name: 'Validation FY2026', fiscalYear: 2026 },
	});
	if (existing) {
		// eslint-disable-next-line no-console
		console.log(`Deleting existing validation version (id=${existing.id})...`);
		await prisma.budgetVersion.delete({ where: { id: existing.id } });
	}

	// Create validation version
	const version = await prisma.budgetVersion.create({
		data: {
			fiscalYear: 2026,
			name: 'Validation FY2026',
			type: 'Budget',
			status: 'Draft',
			dataSource: 'IMPORTED',
			createdById: admin.id,
			modificationCount: 0,
			staleModules: [],
		},
	});
	// eslint-disable-next-line no-console
	console.log(`Created BudgetVersion: id=${version.id}, name="${version.name}"`);

	// Aggregate enrollment by grade for headcount table
	const headcountMap = new Map<string, { period: string; grade: string; total: number }>();
	for (const e of enrollmentDetail) {
		const key = `${e.academicPeriod}|${e.gradeLevel}`;
		const cur = headcountMap.get(key);
		if (cur) {
			cur.total += e.headcount;
		} else {
			headcountMap.set(key, {
				period: e.academicPeriod,
				grade: e.gradeLevel,
				total: e.headcount,
			});
		}
	}

	// Insert enrollment headcounts
	let headcountCount = 0;
	for (const [, entry] of headcountMap) {
		await prisma.enrollmentHeadcount.create({
			data: {
				versionId: version.id,
				academicPeriod: entry.period,
				gradeLevel: entry.grade,
				headcount: entry.total,
				createdBy: admin.id,
			},
		});
		headcountCount++;
	}
	// eslint-disable-next-line no-console
	console.log(`Inserted ${headcountCount} enrollment headcounts`);

	// Insert enrollment details
	let detailCount = 0;
	for (const e of enrollmentDetail) {
		await prisma.enrollmentDetail.create({
			data: {
				versionId: version.id,
				academicPeriod: e.academicPeriod,
				gradeLevel: e.gradeLevel,
				nationality: e.nationality,
				tariff: e.tariff,
				headcount: e.headcount,
				createdBy: admin.id,
			},
		});
		detailCount++;
	}
	// eslint-disable-next-line no-console
	console.log(`Inserted ${detailCount} enrollment details`);

	// Insert fee grid (AY1 only for initial validation)
	const ay1Fees = feeGrid.filter((f) => f.academicPeriod === 'AY1');
	let feeCount = 0;
	for (const f of ay1Fees) {
		await prisma.feeGrid.create({
			data: {
				versionId: version.id,
				academicPeriod: f.academicPeriod,
				gradeLevel: f.gradeLevel,
				nationality: f.nationality,
				tariff: f.tariff,
				tuitionTtc: f.tuitionTtc,
				tuitionHt: f.tuitionHt,
				dai: f.dai,
				createdBy: admin.id,
			},
		});
		feeCount++;
	}
	// eslint-disable-next-line no-console
	console.log(`Inserted ${feeCount} fee grid entries (AY1)`);

	// Insert discount policies
	for (const d of discounts) {
		await prisma.discountPolicy.create({
			data: {
				versionId: version.id,
				tariff: d.tariff,
				discountRate: d.discountRate,
				createdBy: admin.id,
			},
		});
	}
	// eslint-disable-next-line no-console
	console.log(`Inserted ${discounts.length} discount policies`);

	// Insert other revenue items
	for (const o of otherRevenue) {
		await prisma.otherRevenueItem.create({
			data: {
				versionId: version.id,
				lineItemName: o.lineItemName,
				annualAmount: o.annualAmount,
				distributionMethod: o.distributionMethod,
				weightArray: o.weightArray ? JSON.parse(JSON.stringify(o.weightArray)) : undefined,
				specificMonths: o.specificMonths ?? [],
				ifrsCategory: o.ifrsCategory,
				computeMethod: o.computeMethod ?? null,
				createdBy: admin.id,
			},
		});
	}
	// eslint-disable-next-line no-console
	console.log(`Inserted ${otherRevenue.length} other revenue items`);

	// Run revenue calculation
	// eslint-disable-next-line no-console
	console.log('\n=== Running Revenue Calculation ===');

	const engineInput = {
		enrollmentDetails: enrollmentDetail.map(
			(e): EnrollmentDetailInput => ({
				academicPeriod: e.academicPeriod,
				gradeLevel: e.gradeLevel,
				nationality: e.nationality,
				tariff: e.tariff,
				headcount: e.headcount,
			})
		),
		feeGrid: feeGrid.map(
			(f): FeeGridInput => ({
				academicPeriod: f.academicPeriod,
				gradeLevel: f.gradeLevel,
				nationality: f.nationality,
				tariff: f.tariff,
				tuitionTtc: f.tuitionTtc,
				tuitionHt: f.tuitionHt,
				dai: f.dai,
			})
		),
		discountPolicies: discounts.map(
			(d): DiscountPolicyInput => ({
				tariff: d.tariff,
				discountRate: d.discountRate,
			})
		),
		otherRevenueItems: otherRevenue.map(
			(o): OtherRevenueInput => ({
				lineItemName: o.lineItemName,
				annualAmount: o.annualAmount,
				distributionMethod: o.distributionMethod as OtherRevenueInput['distributionMethod'],
				weightArray: o.weightArray,
				specificMonths: o.specificMonths,
				ifrsCategory: o.ifrsCategory,
			})
		),
	};

	const result = calculateRevenue(engineInput);

	// Print comparison table
	// eslint-disable-next-line no-console
	console.log('\n=== Revenue Comparison: Calculated vs Expected ===');
	// eslint-disable-next-line no-console
	console.log('Month | Calc Net Rev  | Excel Total   | Diff        | Status');
	// eslint-disable-next-line no-console
	console.log('------|---------------|---------------|-------------|-------');

	// Aggregate calculated monthly totals
	const calcMonthly: Record<number, Decimal> = {};
	for (const row of result.tuitionRevenue) {
		calcMonthly[row.month] = (calcMonthly[row.month] ?? new Decimal(0)).plus(
			new Decimal(row.netRevenueHt)
		);
	}
	for (const row of result.otherRevenue) {
		calcMonthly[row.month] = (calcMonthly[row.month] ?? new Decimal(0)).plus(
			new Decimal(row.amount)
		);
	}

	let totalMatch = 0;
	let totalMismatch = 0;

	for (const exp of expectedRevenue) {
		const excelTotal = new Decimal(exp.totalOperatingRevenue);
		if (excelTotal.isZero()) continue;

		const calcTotal = calcMonthly[exp.month] ?? new Decimal(0);
		const diff = calcTotal.minus(excelTotal);
		const absDiff = diff.abs();
		const ok = absDiff.lte(new Decimal('100')); // 100 SAR tolerance

		if (ok) totalMatch++;
		else totalMismatch++;

		// eslint-disable-next-line no-console
		console.log(
			`  ${String(exp.month).padStart(2)}   | ${calcTotal.toFixed(2).padStart(13)} | ${excelTotal.toFixed(2).padStart(13)} | ${diff.toFixed(2).padStart(11)} | ${ok ? 'OK' : 'MISMATCH'}`
		);
	}

	// eslint-disable-next-line no-console
	console.log('\n=== Totals ===');
	// eslint-disable-next-line no-console
	console.log(`Gross Revenue HT: ${result.totals.grossRevenueHt}`);
	// eslint-disable-next-line no-console
	console.log(`Total Discounts:  ${result.totals.totalDiscounts}`);
	// eslint-disable-next-line no-console
	console.log(`Net Revenue HT:   ${result.totals.netRevenueHt}`);
	// eslint-disable-next-line no-console
	console.log(`Total VAT:        ${result.totals.totalVat}`);
	// eslint-disable-next-line no-console
	console.log(`Other Revenue:    ${result.totals.totalOtherRevenue}`);
	// eslint-disable-next-line no-console
	console.log(`\nMonths OK: ${totalMatch}, Mismatches: ${totalMismatch}`);
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
