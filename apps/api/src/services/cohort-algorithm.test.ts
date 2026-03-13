import { describe, expect, it } from 'vitest';
import { calculateCohortGradeResult, calculateHistoricalTrendRetention } from '@budfin/types';

describe('calculateCohortGradeResult', () => {
	it('uses weighted historical trend retention for attrition grades', () => {
		const result = calculateCohortGradeResult({
			gradeLevel: 'CE1',
			feederAy1Headcount: 126,
			configuredRetentionRate: 0.98,
			manualAdjustment: -5,
			historicalHeadcounts: [
				{ academicYear: 2025, gradeLevel: 'CE1', headcount: 118 },
				{ academicYear: 2024, gradeLevel: 'CP', headcount: 126 },
				{ academicYear: 2024, gradeLevel: 'CE1', headcount: 120 },
				{ academicYear: 2023, gradeLevel: 'CP', headcount: 130 },
				{ academicYear: 2023, gradeLevel: 'CE1', headcount: 110 },
				{ academicYear: 2022, gradeLevel: 'CP', headcount: 120 },
			],
			targetFiscalYear: 2026,
			planningRules: {
				rolloverThreshold: 1,
				retentionRecentWeight: 0.6,
				historicalTargetRecentWeight: 0.8,
			},
		});

		expect(result.historicalTrendRatio).toBeCloseTo(0.9303, 4);
		expect(result.usesConfiguredRetention).toBe(false);
		expect(result.appliedRetentionRate).toBeCloseTo(0.9303, 4);
		expect(result.retainedFromPrior).toBe(117);
		expect(result.historicalTargetHeadcount).toBe(118);
		expect(result.derivedLaterals).toBe(1);
		expect(result.ay2Headcount).toBe(113);
	});

	it('switches to configured retention for growth grades and keeps overrides signed', () => {
		const result = calculateCohortGradeResult({
			gradeLevel: 'GS',
			feederAy1Headcount: 77,
			configuredRetentionRate: 0.97,
			manualAdjustment: 0,
			historicalHeadcounts: [
				{ academicYear: 2025, gradeLevel: 'GS', headcount: 124 },
				{ academicYear: 2024, gradeLevel: 'MS', headcount: 109 },
				{ academicYear: 2024, gradeLevel: 'GS', headcount: 123 },
				{ academicYear: 2023, gradeLevel: 'MS', headcount: 86 },
				{ academicYear: 2023, gradeLevel: 'GS', headcount: 95 },
				{ academicYear: 2022, gradeLevel: 'MS', headcount: 80 },
			],
			targetFiscalYear: 2026,
			planningRules: {
				rolloverThreshold: 1,
				retentionRecentWeight: 0.6,
				historicalTargetRecentWeight: 0.8,
			},
		});

		expect(result.historicalTrendRatio).toBeGreaterThan(1);
		expect(result.usesConfiguredRetention).toBe(true);
		expect(result.appliedRetentionRate).toBe(0.97);
		expect(result.retainedFromPrior).toBe(75);
		expect(result.historicalTargetHeadcount).toBe(124);
		expect(result.derivedLaterals).toBe(49);
		expect(result.ay2Headcount).toBe(124);
	});

	it('rounds historical trend retention with Decimal half-up semantics at four decimals', () => {
		const result = calculateHistoricalTrendRetention({
			gradeLevel: 'CE1',
			historicalHeadcounts: [
				{ academicYear: 2025, gradeLevel: 'CE1', headcount: 12345 },
				{ academicYear: 2024, gradeLevel: 'CP', headcount: 100000 },
			],
			targetFiscalYear: 2026,
			recentWeight: 0.6,
		});

		expect(result.historicalTrendRatio).toBe(0.1235);
		expect(result.historicalTrendRetention).toBe(0.1235);
	});
});
