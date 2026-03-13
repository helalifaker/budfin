import { describe, it, expect } from 'vitest';
import {
	calculateNationalityDistribution,
	computeWeightsFromHeadcounts,
	type NationalityInput,
} from './nationality-engine.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePsInput(overrides: Partial<NationalityInput> = {}): NationalityInput {
	return {
		gradeLevel: 'PS',
		ay2Headcount: 30,
		isPs: true,
		psWeights: new Map([
			['Francais', '0.3333'],
			['Nationaux', '0.3333'],
			['Autres', '0.3334'],
		]),
		...overrides,
	};
}

function makeNonPsInput(overrides: Partial<NationalityInput> = {}): NationalityInput {
	return {
		gradeLevel: 'MS',
		ay2Headcount: 25,
		isPs: false,
		priorGradeNationality: [
			{ nationality: 'Francais', weight: '0.5000', headcount: 15 },
			{ nationality: 'Nationaux', weight: '0.3000', headcount: 9 },
			{ nationality: 'Autres', weight: '0.2000', headcount: 6 },
		],
		retentionRate: '0.95',
		lateralCount: 2,
		lateralWeights: new Map([
			['Francais', '0.5000'],
			['Nationaux', '0.3000'],
			['Autres', '0.2000'],
		]),
		...overrides,
	};
}

function totalHeadcount(results: { headcount: number }[]): number {
	return results.reduce((sum, r) => sum + r.headcount, 0);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Nationality Distribution Engine', () => {
	describe('PS with equal weights (33.3/33.3/33.4)', () => {
		it('distributes headcount by weights and reconciles to target', () => {
			const results = calculateNationalityDistribution([makePsInput()]);

			expect(results).toHaveLength(3);
			expect(totalHeadcount(results)).toBe(30);

			// round(30 * 0.3333) = round(9.999) = 10
			// round(30 * 0.3333) = round(9.999) = 10
			// round(30 * 0.3334) = round(10.002) = 10
			// Sum = 30 — matches target
			expect(results.map((r) => r.nationality)).toEqual(['Francais', 'Nationaux', 'Autres']);
		});

		it('sum always equals ay2Headcount', () => {
			const results = calculateNationalityDistribution([makePsInput({ ay2Headcount: 30 })]);
			expect(totalHeadcount(results)).toBe(30);
		});
	});

	describe('PS with unequal weights and rounding reconciliation', () => {
		it('reconciles rounding to match target headcount', () => {
			// Weights that cause rounding issues: 0.60 + 0.30 + 0.10 = 1.0
			// For 7 students: round(7*0.60)=4, round(7*0.30)=2, round(7*0.10)=1 = 7 OK
			// For 11 students: round(11*0.60)=7, round(11*0.30)=3, round(11*0.10)=1 = 11 OK
			// For 13 students: round(13*0.60)=8, round(13*0.30)=4, round(13*0.10)=1 = 13 OK
			const results = calculateNationalityDistribution([
				makePsInput({
					ay2Headcount: 10,
					psWeights: new Map([
						['Francais', '0.60'],
						['Nationaux', '0.30'],
						['Autres', '0.10'],
					]),
				}),
			]);

			expect(totalHeadcount(results)).toBe(10);
		});

		it('handles uneven distribution that requires reconciliation', () => {
			// 3 students with 1/3 each: round(1) + round(1) + round(1) = 3
			// But try 2 students with 1/3: round(0.667)=1, round(0.667)=1, round(0.667)=1 = 3
			// Reconciliation should bring it to 2
			const results = calculateNationalityDistribution([
				makePsInput({
					ay2Headcount: 2,
					psWeights: new Map([
						['Francais', '0.3333'],
						['Nationaux', '0.3333'],
						['Autres', '0.3334'],
					]),
				}),
			]);

			expect(totalHeadcount(results)).toBe(2);
		});
	});

	describe('Non-PS grade with prior data', () => {
		it('scales the prior-grade nationality mix to the final AY2 total', () => {
			const results = calculateNationalityDistribution([makeNonPsInput()]);

			expect(results).toHaveLength(3);

			// Prior-grade weights are 50% / 30% / 20%.
			// Applying those weights to an AY2 target of 25 yields 13 / 8 / 5.
			// Reconciliation adjusts the largest bucket by -1 to keep the total at 25.
			const francais = results.find((r) => r.nationality === 'Francais')!;
			expect(francais.headcount).toBe(12);

			const nationaux = results.find((r) => r.nationality === 'Nationaux')!;
			expect(nationaux.headcount).toBe(8);

			const autres = results.find((r) => r.nationality === 'Autres')!;
			expect(autres.headcount).toBe(5);
		});

		it('sum matches ay2Headcount after reconciliation', () => {
			const results = calculateNationalityDistribution([makeNonPsInput()]);
			expect(totalHeadcount(results)).toBe(25);
		});

		it('computes weight from headcount', () => {
			const results = calculateNationalityDistribution([
				makeNonPsInput({ ay2Headcount: 30, lateralCount: 0 }),
			]);

			for (const row of results) {
				if (row.headcount > 0) {
					const expectedWeight = (row.headcount / 30).toFixed(4);
					// Weight should be close but may differ slightly due to Decimal rounding
					expect(parseFloat(row.weight)).toBeCloseTo(parseFloat(expectedWeight), 3);
				}
			}
		});
	});

	describe('Zero headcount grade', () => {
		it('returns 0 headcount and 0 weight for all nationalities', () => {
			const results = calculateNationalityDistribution([makePsInput({ ay2Headcount: 0 })]);

			expect(results).toHaveLength(3);
			for (const row of results) {
				expect(row.headcount).toBe(0);
				expect(row.weight).toBe('0.0000');
			}
		});

		it('returns 0 for non-PS with zero headcount', () => {
			const results = calculateNationalityDistribution([makeNonPsInput({ ay2Headcount: 0 })]);

			expect(results).toHaveLength(3);
			for (const row of results) {
				expect(row.headcount).toBe(0);
				expect(row.weight).toBe('0.0000');
			}
		});
	});

	describe('Full chain: verify sums match cohort engine output', () => {
		it('distributes cohort-like headcounts across nationalities correctly', () => {
			// Simulate: PS=28, MS=25 (retained from PS), GS=22 (retained from MS)
			const inputs: NationalityInput[] = [
				makePsInput({
					gradeLevel: 'PS',
					ay2Headcount: 28,
					psWeights: new Map([
						['Francais', '0.50'],
						['Nationaux', '0.30'],
						['Autres', '0.20'],
					]),
				}),
				{
					gradeLevel: 'MS',
					ay2Headcount: 25,
					isPs: false,
					priorGradeNationality: [
						{ nationality: 'Francais', weight: '0.50', headcount: 14 },
						{ nationality: 'Nationaux', weight: '0.30', headcount: 8 },
						{ nationality: 'Autres', weight: '0.20', headcount: 6 },
					],
					retentionRate: '0.95',
					lateralCount: 2,
					lateralWeights: new Map([
						['Francais', '0.50'],
						['Nationaux', '0.30'],
						['Autres', '0.20'],
					]),
				},
			];

			const results = calculateNationalityDistribution(inputs);

			// PS: 28 total
			const psRows = results.filter((r) => r.gradeLevel === 'PS');
			expect(totalHeadcount(psRows)).toBe(28);

			// MS: 25 total
			const msRows = results.filter((r) => r.gradeLevel === 'MS');
			expect(totalHeadcount(msRows)).toBe(25);
		});
	});

	describe('Last-bucket rounding: sum always equals target headcount', () => {
		it('reconciles for small odd numbers', () => {
			const results = calculateNationalityDistribution([
				makePsInput({
					ay2Headcount: 1,
					psWeights: new Map([
						['Francais', '0.3333'],
						['Nationaux', '0.3333'],
						['Autres', '0.3334'],
					]),
				}),
			]);

			expect(totalHeadcount(results)).toBe(1);
		});

		it('reconciles for large numbers with uneven weights', () => {
			const results = calculateNationalityDistribution([
				makePsInput({
					ay2Headcount: 100,
					psWeights: new Map([
						['Francais', '0.3333'],
						['Nationaux', '0.3333'],
						['Autres', '0.3334'],
					]),
				}),
			]);

			expect(totalHeadcount(results)).toBe(100);
		});

		it('reconciles non-PS with rounding overshoot', () => {
			// Create a scenario where floor + round can overshoot
			const results = calculateNationalityDistribution([
				{
					gradeLevel: 'CP',
					ay2Headcount: 20,
					isPs: false,
					priorGradeNationality: [
						{ nationality: 'Francais', weight: '0.50', headcount: 10 },
						{ nationality: 'Nationaux', weight: '0.30', headcount: 7 },
						{ nationality: 'Autres', weight: '0.20', headcount: 5 },
					],
					retentionRate: '0.95',
					lateralCount: 1,
					lateralWeights: new Map([
						['Francais', '0.50'],
						['Nationaux', '0.30'],
						['Autres', '0.20'],
					]),
				},
			]);

			expect(totalHeadcount(results)).toBe(20);
		});
	});

	describe('computeWeightsFromHeadcounts', () => {
		it('computes correct weights for balanced distribution', () => {
			const weights = computeWeightsFromHeadcounts([
				{ nationality: 'Francais', headcount: 10 },
				{ nationality: 'Nationaux', headcount: 10 },
				{ nationality: 'Autres', headcount: 10 },
			]);

			expect(weights.get('Francais')).toBe('0.3333');
			expect(weights.get('Nationaux')).toBe('0.3333');
			expect(weights.get('Autres')).toBe('0.3333');
		});

		it('returns all zeros for zero total', () => {
			const weights = computeWeightsFromHeadcounts([
				{ nationality: 'Francais', headcount: 0 },
				{ nationality: 'Nationaux', headcount: 0 },
			]);

			expect(weights.get('Francais')).toBe('0.0000');
			expect(weights.get('Nationaux')).toBe('0.0000');
		});

		it('computes correct weights for unbalanced distribution', () => {
			const weights = computeWeightsFromHeadcounts([
				{ nationality: 'Francais', headcount: 60 },
				{ nationality: 'Nationaux', headcount: 30 },
				{ nationality: 'Autres', headcount: 10 },
			]);

			expect(weights.get('Francais')).toBe('0.6000');
			expect(weights.get('Nationaux')).toBe('0.3000');
			expect(weights.get('Autres')).toBe('0.1000');
		});
	});
});
