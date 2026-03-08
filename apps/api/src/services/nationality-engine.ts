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
	retentionRate?: string; // decimal string
	lateralCount?: number;
	lateralWeights?: Map<string, string>; // nationality -> weight decimal string
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
 *   retainedN = floor(priorCount[N] * retentionRate)
 *   lateralN = round(lateralCount * lateralWeight[N])
 *   totalN = retainedN + lateralN
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
	const {
		priorGradeNationality = [],
		retentionRate = '0.97',
		lateralCount = 0,
		lateralWeights = new Map<string, string>(),
	} = input;

	const retention = new Decimal(retentionRate);
	const lateralTotal = new Decimal(lateralCount);
	const counts: { nationality: string; count: number }[] = [];

	for (const prior of priorGradeNationality) {
		// Retained from prior grade: floor (conservative)
		const retained = new Decimal(prior.headcount).times(retention).floor().toNumber();

		// Lateral entries distributed by weight
		const lateralWeightStr = lateralWeights.get(prior.nationality) ?? '0';
		const lateralForNat = lateralTotal.times(new Decimal(lateralWeightStr)).round().toNumber();

		counts.push({
			nationality: prior.nationality,
			count: retained + lateralForNat,
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
