import type { PrismaClient } from '@prisma/client';
import { Decimal } from 'decimal.js';
import type {
	MigrationLog,
	FeeGridFixture,
	DiscountFixture,
	EnrollmentDetailFixture,
} from '../lib/types.js';
import { MigrationLogger } from '../lib/logger.js';
import { loadFixture } from '../lib/fixture-loader.js';

// ── Main export ─────────────────────────────────────────────────────────────

export async function importRevenue(
	prisma: PrismaClient,
	versionId: number,
	userId: number
): Promise<MigrationLog> {
	const logger = new MigrationLogger('revenue');

	try {
		// Load fixtures
		const feeGrid = loadFixture<FeeGridFixture[]>('fy2026-fee-grid.json');
		const discounts = loadFixture<DiscountFixture[]>('fy2026-discounts.json');
		const enrollmentDetail = loadFixture<EnrollmentDetailFixture[]>(
			'fy2026-enrollment-detail.json'
		);

		// 1. Aggregate enrollment by period+grade for headcount table
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

		// 2. Insert enrollment headcounts BEFORE details (FK constraint)
		let headcountCount = 0;
		for (const [, entry] of headcountMap) {
			await prisma.enrollmentHeadcount.upsert({
				where: {
					versionId_academicPeriod_gradeLevel: {
						versionId,
						academicPeriod: entry.period,
						gradeLevel: entry.grade,
					},
				},
				update: {
					headcount: entry.total,
					updatedBy: userId,
				},
				create: {
					versionId,
					academicPeriod: entry.period,
					gradeLevel: entry.grade,
					headcount: entry.total,
					createdBy: userId,
				},
			});
			headcountCount++;
		}
		logger.addRowCount('enrollment_headcount', headcountCount);

		// 3. Insert enrollment details
		let detailCount = 0;
		for (const e of enrollmentDetail) {
			await prisma.enrollmentDetail.upsert({
				where: {
					versionId_academicPeriod_gradeLevel_nationality_tariff: {
						versionId,
						academicPeriod: e.academicPeriod,
						gradeLevel: e.gradeLevel,
						nationality: e.nationality,
						tariff: e.tariff,
					},
				},
				update: {
					headcount: e.headcount,
					updatedBy: userId,
				},
				create: {
					versionId,
					academicPeriod: e.academicPeriod,
					gradeLevel: e.gradeLevel,
					nationality: e.nationality,
					tariff: e.tariff,
					headcount: e.headcount,
					createdBy: userId,
				},
			});
			detailCount++;
		}
		logger.addRowCount('enrollment_detail', detailCount);

		// 3.5 Seed nationality breakdown from enrollment detail
		const breakdownMap = new Map<
			string,
			{ period: string; grade: string; nationality: string; headcount: number }
		>();
		for (const e of enrollmentDetail) {
			const key = `${e.academicPeriod}|${e.gradeLevel}|${e.nationality}`;
			const cur = breakdownMap.get(key);
			if (cur) {
				cur.headcount += e.headcount;
			} else {
				breakdownMap.set(key, {
					period: e.academicPeriod,
					grade: e.gradeLevel,
					nationality: e.nationality,
					headcount: e.headcount,
				});
			}
		}

		// Compute grade totals for weight calculation
		const gradeTotalMap = new Map<string, number>();
		for (const [, entry] of breakdownMap) {
			const gradeKey = `${entry.period}|${entry.grade}`;
			gradeTotalMap.set(gradeKey, (gradeTotalMap.get(gradeKey) ?? 0) + entry.headcount);
		}

		let breakdownCount = 0;
		for (const [, entry] of breakdownMap) {
			const gradeKey = `${entry.period}|${entry.grade}`;
			const gradeTotal = gradeTotalMap.get(gradeKey) ?? 1;
			const weight = new Decimal(entry.headcount)
				.dividedBy(gradeTotal)
				.toDecimalPlaces(4, Decimal.ROUND_HALF_UP);

			await prisma.nationalityBreakdown.upsert({
				where: {
					versionId_academicPeriod_gradeLevel_nationality: {
						versionId,
						academicPeriod: entry.period,
						gradeLevel: entry.grade,
						nationality: entry.nationality,
					},
				},
				update: {
					weight: weight.toNumber(),
					headcount: entry.headcount,
				},
				create: {
					versionId,
					academicPeriod: entry.period,
					gradeLevel: entry.grade,
					nationality: entry.nationality,
					weight: weight.toNumber(),
					headcount: entry.headcount,
					isOverridden: false,
				},
			});
			breakdownCount++;
		}
		logger.addRowCount('nationality_breakdown', breakdownCount);

		// 4. Insert fee grid — ALL rows (AY1 + AY2), not just AY1
		let feeCount = 0;
		for (const f of feeGrid) {
			const tuitionTtc = new Decimal(f.tuitionTtc);
			const tuitionHt = new Decimal(f.tuitionHt);
			const dai = new Decimal(f.dai);
			const term1Amount = new Decimal(f.term1Amount);
			const term2Amount = new Decimal(f.term2Amount);
			const term3Amount = new Decimal(f.term3Amount);

			await prisma.feeGrid.upsert({
				where: {
					versionId_academicPeriod_gradeLevel_nationality_tariff: {
						versionId,
						academicPeriod: f.academicPeriod,
						gradeLevel: f.gradeLevel,
						nationality: f.nationality,
						tariff: f.tariff,
					},
				},
				update: {
					tuitionTtc: tuitionTtc.toNumber(),
					tuitionHt: tuitionHt.toNumber(),
					dai: dai.toNumber(),
					term1Amount: term1Amount.toNumber(),
					term2Amount: term2Amount.toNumber(),
					term3Amount: term3Amount.toNumber(),
					updatedBy: userId,
				},
				create: {
					versionId,
					academicPeriod: f.academicPeriod,
					gradeLevel: f.gradeLevel,
					nationality: f.nationality,
					tariff: f.tariff,
					tuitionTtc: tuitionTtc.toNumber(),
					tuitionHt: tuitionHt.toNumber(),
					dai: dai.toNumber(),
					term1Amount: term1Amount.toNumber(),
					term2Amount: term2Amount.toNumber(),
					term3Amount: term3Amount.toNumber(),
					createdBy: userId,
				},
			});
			feeCount++;
		}
		logger.addRowCount('fee_grids', feeCount);

		// 5. Insert discount policies
		let discountCount = 0;
		for (const d of discounts) {
			const discountRate = new Decimal(d.discountRate);

			await prisma.discountPolicy.upsert({
				where: {
					versionId_tariff_nationality: {
						versionId,
						tariff: d.tariff,
						nationality: d.nationality ?? '',
					},
				},
				update: {
					discountRate: discountRate.toNumber(),
					updatedBy: userId,
				},
				create: {
					versionId,
					tariff: d.tariff,
					nationality: d.nationality,
					discountRate: discountRate.toNumber(),
					createdBy: userId,
				},
			});
			discountCount++;
		}
		logger.addRowCount('discount_policies', discountCount);

		return logger.complete('SUCCESS');
	} catch (err) {
		logger.error({
			code: 'REVENUE_IMPORT_FAILED',
			message: err instanceof Error ? err.message : String(err),
			fatal: true,
		});
		return logger.complete('FAILED');
	}
}
