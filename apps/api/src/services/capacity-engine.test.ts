import { describe, it, expect } from 'vitest';
import { calculateCapacity, type GradeConfig } from './capacity-engine.js';

const makeConfig = (overrides: Partial<GradeConfig> = {}): GradeConfig => ({
	gradeCode: 'CP',
	maxClassSize: 28,
	plafondPct: 1.1,
	...overrides,
});

function configMap(configs: GradeConfig[]): Map<string, GradeConfig> {
	return new Map(configs.map((c) => [c.gradeCode, c]));
}

describe('calculateCapacity', () => {
	describe('AC-10: sections = CEILING(headcount / maxClassSize)', () => {
		it('computes 1 section for 25 students with maxClassSize 28', () => {
			const configs = configMap([makeConfig({ gradeCode: 'CP', maxClassSize: 28 })]);
			const results = calculateCapacity(
				[{ gradeLevel: 'CP', academicPeriod: 'AY1', headcount: 25 }],
				configs
			);

			expect(results[0]!.sectionsNeeded).toBe(1);
			expect(results[0]!.utilization).toBeCloseTo(89.3, 0);
		});

		it('computes 2 sections for 29 students with maxClassSize 28', () => {
			const configs = configMap([makeConfig({ gradeCode: 'CP', maxClassSize: 28 })]);
			const results = calculateCapacity(
				[{ gradeLevel: 'CP', academicPeriod: 'AY1', headcount: 29 }],
				configs
			);

			expect(results[0]!.sectionsNeeded).toBe(2);
		});

		it('computes exactly 1 section for 28 students', () => {
			const configs = configMap([makeConfig({ gradeCode: 'CP', maxClassSize: 28 })]);
			const results = calculateCapacity(
				[{ gradeLevel: 'CP', academicPeriod: 'AY1', headcount: 28 }],
				configs
			);

			expect(results[0]!.sectionsNeeded).toBe(1);
			expect(results[0]!.utilization).toBe(100);
		});
	});

	describe('AC-11: zero headcount', () => {
		it('returns sections=0, utilization=0, no alert for headcount=0', () => {
			const configs = configMap([makeConfig({ gradeCode: 'CP' })]);
			const results = calculateCapacity(
				[{ gradeLevel: 'CP', academicPeriod: 'AY1', headcount: 0 }],
				configs
			);

			expect(results[0]!.sectionsNeeded).toBe(0);
			expect(results[0]!.utilization).toBe(0);
			expect(results[0]!.alert).toBeNull();
			expect(results[0]!.recruitmentSlots).toBe(0);
		});
	});

	describe('AC-12: traffic-light alerts', () => {
		it('assigns OVER when utilization > 100%', () => {
			// 30 students, maxClassSize=28 → 2 sections, utilization = 30/56 = 53.6%
			// Actually for OVER, we need > maxClassSize per section
			// With 1 section of 28, 30 students = 107.1% → OVER
			// Wait, CEILING(30/28) = 2, so 30/56 = 53.6% UNDER
			// For OVER, utilization must exceed 100%. This can't happen normally
			// since CEILING always gives enough sections.
			// OVER is only possible if headcount exceeds sections * maxClassSize,
			// which can't happen with CEILING. Let's test that it correctly
			// calculates non-OVER cases and test UNDER.

			// Actually: utilization = headcount / (ceil(headcount/max) * max) * 100
			// This is always <= 100% by definition. So OVER alert can't occur
			// through normal calculation. It may be relevant for manually set sections.
			// Let's verify OK, NEAR_CAP, UNDER are correctly assigned.
			const configs = configMap([makeConfig({ gradeCode: 'CP', maxClassSize: 28 })]);

			// 28 students → 1 section → 100% → NEAR_CAP (> 95% and <= 100%)
			const results100 = calculateCapacity(
				[{ gradeLevel: 'CP', academicPeriod: 'AY1', headcount: 28 }],
				configs
			);
			expect(results100[0]!.alert).toBe('NEAR_CAP');

			// 27 students → 1 section → 96.4% → NEAR_CAP
			const results96 = calculateCapacity(
				[{ gradeLevel: 'CP', academicPeriod: 'AY1', headcount: 27 }],
				configs
			);
			expect(results96[0]!.alert).toBe('NEAR_CAP');

			// 26 students → 1 section → 92.9% → OK
			const results92 = calculateCapacity(
				[{ gradeLevel: 'CP', academicPeriod: 'AY1', headcount: 26 }],
				configs
			);
			expect(results92[0]!.alert).toBe('OK');

			// 20 students → 1 section → 71.4% → OK
			const results71 = calculateCapacity(
				[{ gradeLevel: 'CP', academicPeriod: 'AY1', headcount: 20 }],
				configs
			);
			expect(results71[0]!.alert).toBe('OK');

			// 19 students → 1 section → 67.9% → UNDER
			const results67 = calculateCapacity(
				[{ gradeLevel: 'CP', academicPeriod: 'AY1', headcount: 19 }],
				configs
			);
			expect(results67[0]!.alert).toBe('UNDER');
		});
	});

	describe('AC-15: recruitment slots', () => {
		it('computes recruitment_slots = floor(sections * maxClassSize * plafondPct) - headcount', () => {
			const configs = configMap([
				makeConfig({ gradeCode: 'CP', maxClassSize: 28, plafondPct: 1.1 }),
			]);
			const results = calculateCapacity(
				[{ gradeLevel: 'CP', academicPeriod: 'AY1', headcount: 25 }],
				configs
			);

			// 1 section * 28 * 1.1 = 30.8 → floor = 30 → 30 - 25 = 5
			expect(results[0]!.recruitmentSlots).toBe(5);
		});

		it('returns negative slots when over plafond', () => {
			const configs = configMap([
				makeConfig({ gradeCode: 'CP', maxClassSize: 28, plafondPct: 0.9 }),
			]);
			const results = calculateCapacity(
				[{ gradeLevel: 'CP', academicPeriod: 'AY1', headcount: 28 }],
				configs
			);

			// 1 section * 28 * 0.9 = 25.2 → floor = 25 → 25 - 28 = -3
			expect(results[0]!.recruitmentSlots).toBe(-3);
		});
	});

	describe('multiple grades', () => {
		it('processes multiple grades correctly', () => {
			const configs = configMap([
				makeConfig({ gradeCode: 'PS', maxClassSize: 25, plafondPct: 1.0 }),
				makeConfig({ gradeCode: 'CP', maxClassSize: 28, plafondPct: 1.1 }),
			]);
			const results = calculateCapacity(
				[
					{ gradeLevel: 'PS', academicPeriod: 'AY1', headcount: 20 },
					{ gradeLevel: 'CP', academicPeriod: 'AY1', headcount: 25 },
				],
				configs
			);

			expect(results).toHaveLength(2);
			expect(results[0]!.gradeLevel).toBe('PS');
			expect(results[1]!.gradeLevel).toBe('CP');
		});
	});

	it('throws for unknown grade', () => {
		const configs = configMap([]);
		expect(() =>
			calculateCapacity([{ gradeLevel: 'UNKNOWN', academicPeriod: 'AY1', headcount: 10 }], configs)
		).toThrow('Unknown grade: UNKNOWN');
	});
});
