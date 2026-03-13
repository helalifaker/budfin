// Nationality distribution engine — pure functions, no DB dependencies
// Phase 2b: Distributes AY2 headcounts across nationality buckets

import { Decimal } from 'decimal.js';

export interface NationalityWeight {
	nationality: string; // 'Francais' | 'Nationaux' | 'Autres'
	weight: string; // decimal string 0-1
	headcount: number; // absolute count
}

export interface NationalityInput {
	gradeLevel: string;
	ay2Headcount: number;
	isPs: boolean;
	// For PS: use these weights directly
	psWeights?: Map<string, string>; // nationality -> weight decimal string
	// For non-PS: prior grade data
	priorGradeNationality?: NationalityWeight[];
	retentionRate?: string | undefined;
	lateralCount?: number | undefined;
	lateralWeights?: Map<string, string> | undefined;
}

export interface NationalityOutputRow {
	gradeLevel: string;
	nationality: string;
	weight: string; // decimal string (computed or from input)
	headcount: number;
	isOverridden: boolean;
}

/**
 * Reconcile integer headcounts so they sum to the target.
 * Adjusts the largest bucket (by count) to absorb rounding differences.
 * Mutates the counts array in-place.
 */
function reconcileToTarget(counts: { nationality: string; count: number }[], target: number): void {
	if (counts.length === 0) return;

	const currentSum = counts.reduce((sum, c) => sum + c.count, 0);
	const diff = target - currentSum;

	if (diff === 0) return;

	// Find the largest bucket to absorb the difference
	let largestIdx = 0;
	for (let i = 1; i < counts.length; i++) {
		if (counts[i]!.count > counts[largestIdx]!.count) {
			largestIdx = i;
		}
	}

	counts[largestIdx]!.count += diff;
}

/**
 * Distribute AY2 headcounts across nationality buckets for each grade.
 *
 * For PS:
 *   count[N] = round(ay2Headcount * psWeight[N])
 *   Apply last-bucket reconciliation: adjust largest nationality so sum == ay2Headcount
 *
 * For non-PS grades:
 *   priorWeight[N] = priorCount[N] / priorTotal
 *   totalN = round(ay2Headcount * priorWeight[N])
 *   Reconcile: adjust largest bucket so sum == ay2Headcount
 *   weight = totalN / ay2Total
 */
export function calculateNationalityDistribution(
	inputs: NationalityInput[]
): NationalityOutputRow[] {
	const results: NationalityOutputRow[] = [];

	for (const input of inputs) {
		const { gradeLevel, ay2Headcount, isPs } = input;

		// Zero headcount: all counts and weights are 0
		if (ay2Headcount === 0) {
			const nationalities = isPs
				? [...(input.psWeights?.keys() ?? [])]
				: (input.priorGradeNationality?.map((n) => n.nationality) ?? []);

			// Fallback: if no nationalities are known, skip
			for (const nationality of nationalities) {
				results.push({
					gradeLevel,
					nationality,
					weight: '0.0000',
					headcount: 0,
					isOverridden: false,
				});
			}
			continue;
		}

		if (isPs) {
			const counts = distributePs(ay2Headcount, input.psWeights ?? new Map());
			reconcileToTarget(counts, ay2Headcount);

			for (const entry of counts) {
				const weight = new Decimal(entry.count)
					.dividedBy(ay2Headcount)
					.toDecimalPlaces(4, Decimal.ROUND_HALF_UP);

				results.push({
					gradeLevel,
					nationality: entry.nationality,
					weight: weight.toFixed(4),
					headcount: entry.count,
					isOverridden: false,
				});
			}
		} else {
			const counts = distributeNonPs(input);
			reconcileToTarget(counts, ay2Headcount);

			for (const entry of counts) {
				const weight = new Decimal(entry.count)
					.dividedBy(ay2Headcount)
					.toDecimalPlaces(4, Decimal.ROUND_HALF_UP);

				results.push({
					gradeLevel,
					nationality: entry.nationality,
					weight: weight.toFixed(4),
					headcount: entry.count,
					isOverridden: false,
				});
			}
		}
	}

	return results;
}

function distributePs(
	ay2Headcount: number,
	psWeights: Map<string, string>
): { nationality: string; count: number }[] {
	const total = new Decimal(ay2Headcount);
	const counts: { nationality: string; count: number }[] = [];

	for (const [nationality, weightStr] of psWeights) {
		const weight = new Decimal(weightStr);
		const count = total.times(weight).round().toNumber();
		counts.push({ nationality, count });
	}

	return counts;
}

function distributeNonPs(input: NationalityInput): { nationality: string; count: number }[] {
	const { priorGradeNationality = [], ay2Headcount } = input;

	const effectivePrior: NationalityWeight[] =
		priorGradeNationality.length > 0
			? priorGradeNationality
			: [
					// Real EFIR distribution: ~34% Francais, ~2% Nationaux, ~64% Autres
					{ nationality: 'Francais', weight: '0.3366', headcount: 0 },
					{ nationality: 'Nationaux', weight: '0.0234', headcount: 0 },
					{ nationality: 'Autres', weight: '0.6400', headcount: 0 },
				];

	const totalPrior = effectivePrior.reduce((sum, prior) => sum + prior.headcount, 0);
	const counts: { nationality: string; count: number }[] = [];

	for (const prior of effectivePrior) {
		const sourceWeight =
			totalPrior > 0
				? new Decimal(prior.headcount).dividedBy(totalPrior)
				: new Decimal(prior.weight);

		counts.push({
			nationality: prior.nationality,
			count: new Decimal(ay2Headcount).times(sourceWeight).round().toNumber(),
		});
	}

	return counts;
}

/**
 * Convenience: compute weights from a set of headcounts.
 * Returns a map of nationality -> weight string (4 decimal places).
 */
export function computeWeightsFromHeadcounts(
	entries: { nationality: string; headcount: number }[]
): Map<string, string> {
	const total = entries.reduce((sum, e) => sum + e.headcount, 0);
	const weights = new Map<string, string>();

	if (total === 0) {
		for (const entry of entries) {
			weights.set(entry.nationality, '0.0000');
		}
		return weights;
	}

	for (const entry of entries) {
		const weight = new Decimal(entry.headcount)
			.dividedBy(total)
			.toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
		weights.set(entry.nationality, weight.toFixed(4));
	}

	return weights;
}
