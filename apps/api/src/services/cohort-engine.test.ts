import { describe, it, expect } from 'vitest';
import {
	calculateCohortProgression,
	GRADE_PROGRESSION,
	type CohortInput,
	type CohortParams,
} from './cohort-engine.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeInput(overrides: Partial<CohortInput> = {}): CohortInput {
	return {
		ay1Headcounts: new Map(),
		cohortParams: new Map(),
		psAy2Headcount: 0,
		...overrides,
	};
}

function makeParams(rate: string, lateral: number): CohortParams {
	return { retentionRate: rate, lateralEntryCount: lateral };
}

function buildUniformHeadcounts(count: number): Map<string, number> {
	const map = new Map<string, number>();
	for (const grade of GRADE_PROGRESSION) {
		map.set(grade, count);
	}
	return map;
}

function buildUniformParams(rate: string, lateral: number): Map<string, CohortParams> {
	const map = new Map<string, CohortParams>();
	for (const grade of GRADE_PROGRESSION) {
		map.set(grade, makeParams(rate, lateral));
	}
	return map;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Cohort Progression Engine', () => {
	describe('PS direct entry', () => {
		it('sets ay2 = psAy2Headcount with zero retained and zero lateral', () => {
			const results = calculateCohortProgression(
				makeInput({
					ay1Headcounts: new Map([['PS', 20]]),
					psAy2Headcount: 25,
				})
			);

			const ps = results.find((r) => r.gradeLevel === 'PS')!;
			expect(ps.ay1Headcount).toBe(20);
			expect(ps.retainedFromPrior).toBe(0);
			expect(ps.lateralEntry).toBe(0);
			expect(ps.ay2Headcount).toBe(25);
		});

		it('PS ay2 is independent of AY1 headcount', () => {
			const results = calculateCohortProgression(
				makeInput({
					ay1Headcounts: new Map([['PS', 100]]),
					psAy2Headcount: 30,
				})
			);

			const ps = results.find((r) => r.gradeLevel === 'PS')!;
			expect(ps.ay2Headcount).toBe(30);
		});
	});

	describe('Full 15-grade chain with realistic data', () => {
		it('produces 15 output rows, one per grade', () => {
			const results = calculateCohortProgression(
				makeInput({
					ay1Headcounts: buildUniformHeadcounts(25),
					cohortParams: buildUniformParams('0.95', 2),
					psAy2Headcount: 28,
				})
			);

			expect(results).toHaveLength(15);
			expect(results.map((r) => r.gradeLevel)).toEqual([...GRADE_PROGRESSION]);
		});

		it('calculates retention correctly for non-PS grades', () => {
			const results = calculateCohortProgression(
				makeInput({
					ay1Headcounts: buildUniformHeadcounts(25),
					cohortParams: buildUniformParams('0.95', 2),
					psAy2Headcount: 28,
				})
			);

			// MS: retained = floor(25 * 0.95) = floor(23.75) = 23, lateral = 2, ay2 = 25
			const ms = results.find((r) => r.gradeLevel === 'MS')!;
			expect(ms.retainedFromPrior).toBe(23);
			expect(ms.lateralEntry).toBe(2);
			expect(ms.ay2Headcount).toBe(25);
		});

		it('uses prior grade AY1 headcount (not current grade)', () => {
			const ay1 = new Map<string, number>([
				['PS', 30],
				['MS', 20],
				['GS', 10],
			]);
			const params = new Map<string, CohortParams>([
				['MS', makeParams('1.0', 0)],
				['GS', makeParams('1.0', 0)],
			]);

			const results = calculateCohortProgression(
				makeInput({ ay1Headcounts: ay1, cohortParams: params, psAy2Headcount: 30 })
			);

			// MS retained from PS AY1 (30), not MS AY1 (20)
			const ms = results.find((r) => r.gradeLevel === 'MS')!;
			expect(ms.retainedFromPrior).toBe(30);
			expect(ms.ay2Headcount).toBe(30);

			// GS retained from MS AY1 (20), not GS AY1 (10)
			const gs = results.find((r) => r.gradeLevel === 'GS')!;
			expect(gs.retainedFromPrior).toBe(20);
			expect(gs.ay2Headcount).toBe(20);
		});
	});

	describe('Zero headcount in prior grade', () => {
		it('retained = 0, ay2 = lateral only', () => {
			const ay1 = new Map<string, number>([
				['PS', 0],
				['MS', 15],
			]);
			const params = new Map<string, CohortParams>([['MS', makeParams('0.95', 3)]]);

			const results = calculateCohortProgression(
				makeInput({ ay1Headcounts: ay1, cohortParams: params, psAy2Headcount: 20 })
			);

			// MS: retained = floor(0 * 0.95) = 0, lateral = 3
			const ms = results.find((r) => r.gradeLevel === 'MS')!;
			expect(ms.retainedFromPrior).toBe(0);
			expect(ms.lateralEntry).toBe(3);
			expect(ms.ay2Headcount).toBe(3);
		});

		it('missing prior grade in headcounts map treated as 0', () => {
			const ay1 = new Map<string, number>(); // empty
			const params = new Map<string, CohortParams>([['MS', makeParams('0.95', 5)]]);

			const results = calculateCohortProgression(
				makeInput({ ay1Headcounts: ay1, cohortParams: params, psAy2Headcount: 10 })
			);

			const ms = results.find((r) => r.gradeLevel === 'MS')!;
			expect(ms.retainedFromPrior).toBe(0);
			expect(ms.ay2Headcount).toBe(5);
		});
	});

	describe('100% retention', () => {
		it('retained = prior headcount exactly', () => {
			const ay1 = new Map<string, number>([['PS', 28]]);
			const params = new Map<string, CohortParams>([['MS', makeParams('1.0', 0)]]);

			const results = calculateCohortProgression(
				makeInput({ ay1Headcounts: ay1, cohortParams: params, psAy2Headcount: 30 })
			);

			const ms = results.find((r) => r.gradeLevel === 'MS')!;
			expect(ms.retainedFromPrior).toBe(28);
			expect(ms.ay2Headcount).toBe(28);
		});

		it('100% retention + lateral entry adds correctly', () => {
			const ay1 = new Map<string, number>([['PS', 28]]);
			const params = new Map<string, CohortParams>([['MS', makeParams('1.0', 4)]]);

			const results = calculateCohortProgression(
				makeInput({ ay1Headcounts: ay1, cohortParams: params, psAy2Headcount: 30 })
			);

			const ms = results.find((r) => r.gradeLevel === 'MS')!;
			expect(ms.retainedFromPrior).toBe(28);
			expect(ms.lateralEntry).toBe(4);
			expect(ms.ay2Headcount).toBe(32);
		});
	});

	describe('0% retention (grade closure)', () => {
		it('ay2 = lateral only when retention is 0', () => {
			const ay1 = new Map<string, number>([['PS', 25]]);
			const params = new Map<string, CohortParams>([['MS', makeParams('0', 3)]]);

			const results = calculateCohortProgression(
				makeInput({ ay1Headcounts: ay1, cohortParams: params, psAy2Headcount: 20 })
			);

			const ms = results.find((r) => r.gradeLevel === 'MS')!;
			expect(ms.retainedFromPrior).toBe(0);
			expect(ms.lateralEntry).toBe(3);
			expect(ms.ay2Headcount).toBe(3);
		});

		it('0% retention with 0 lateral = empty grade', () => {
			const ay1 = new Map<string, number>([['PS', 25]]);
			const params = new Map<string, CohortParams>([['MS', makeParams('0', 0)]]);

			const results = calculateCohortProgression(
				makeInput({ ay1Headcounts: ay1, cohortParams: params, psAy2Headcount: 20 })
			);

			const ms = results.find((r) => r.gradeLevel === 'MS')!;
			expect(ms.ay2Headcount).toBe(0);
		});
	});

	describe('Default params when grade missing from params map', () => {
		it('uses 0.97 retention and 0 lateral when params missing', () => {
			const ay1 = new Map<string, number>([['PS', 100]]);

			const results = calculateCohortProgression(
				makeInput({ ay1Headcounts: ay1, psAy2Headcount: 50 })
			);

			// MS has no explicit params: defaults to 0.97 retention, 0 lateral
			// retained = floor(100 * 0.97) = floor(97) = 97
			const ms = results.find((r) => r.gradeLevel === 'MS')!;
			expect(ms.retainedFromPrior).toBe(97);
			expect(ms.lateralEntry).toBe(0);
			expect(ms.ay2Headcount).toBe(97);
		});

		it('default retention with non-round number uses floor', () => {
			const ay1 = new Map<string, number>([['PS', 10]]);

			const results = calculateCohortProgression(
				makeInput({ ay1Headcounts: ay1, psAy2Headcount: 8 })
			);

			// MS: floor(10 * 0.97) = floor(9.7) = 9
			const ms = results.find((r) => r.gradeLevel === 'MS')!;
			expect(ms.retainedFromPrior).toBe(9);
			expect(ms.ay2Headcount).toBe(9);
		});
	});

	describe('Floor rounding behavior', () => {
		it('floor ensures no half-students', () => {
			const ay1 = new Map<string, number>([['PS', 15]]);
			const params = new Map<string, CohortParams>([['MS', makeParams('0.90', 0)]]);

			const results = calculateCohortProgression(
				makeInput({ ay1Headcounts: ay1, cohortParams: params, psAy2Headcount: 12 })
			);

			// MS: floor(15 * 0.90) = floor(13.5) = 13
			const ms = results.find((r) => r.gradeLevel === 'MS')!;
			expect(ms.retainedFromPrior).toBe(13);
		});

		it('floor rounds down from .99', () => {
			const ay1 = new Map<string, number>([['PS', 100]]);
			const params = new Map<string, CohortParams>([['MS', makeParams('0.9999', 0)]]);

			const results = calculateCohortProgression(
				makeInput({ ay1Headcounts: ay1, cohortParams: params, psAy2Headcount: 80 })
			);

			// MS: floor(100 * 0.9999) = floor(99.99) = 99
			const ms = results.find((r) => r.gradeLevel === 'MS')!;
			expect(ms.retainedFromPrior).toBe(99);
		});
	});

	describe('TERM (exit grade)', () => {
		it('TERM uses 1ERE as prior grade', () => {
			const ay1 = new Map<string, number>([['1ERE', 22]]);
			const params = new Map<string, CohortParams>([['TERM', makeParams('0.95', 1)]]);

			const results = calculateCohortProgression(
				makeInput({ ay1Headcounts: ay1, cohortParams: params, psAy2Headcount: 0 })
			);

			// TERM: floor(22 * 0.95) = floor(20.9) = 20, + 1 lateral = 21
			const terminale = results.find((r) => r.gradeLevel === 'TERM')!;
			expect(terminale.retainedFromPrior).toBe(20);
			expect(terminale.lateralEntry).toBe(1);
			expect(terminale.ay2Headcount).toBe(21);
		});
	});
});
