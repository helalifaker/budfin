import { Decimal } from 'decimal.js';

const EXPECTED_LATERAL_WEIGHT_SUM = new Decimal(1);
const LATERAL_WEIGHT_SUM_TOLERANCE = new Decimal('0.01');

interface LateralWeightEntry {
	gradeLevel: string;
	lateralEntryCount?: number | null;
	lateralWeightFr?: number | null;
	lateralWeightNat?: number | null;
	lateralWeightAut?: number | null;
}

export interface InvalidLateralWeightEntry {
	gradeLevel: string;
	weightSum: number;
}

export function findInvalidLateralWeightEntry(
	entries: LateralWeightEntry[]
): InvalidLateralWeightEntry | null {
	for (const entry of entries) {
		if ((entry.lateralEntryCount ?? 0) <= 0) {
			continue;
		}

		const weightSum = new Decimal(entry.lateralWeightFr ?? 0)
			.plus(entry.lateralWeightNat ?? 0)
			.plus(entry.lateralWeightAut ?? 0);

		if (
			weightSum.minus(EXPECTED_LATERAL_WEIGHT_SUM).abs().greaterThan(LATERAL_WEIGHT_SUM_TOLERANCE)
		) {
			return {
				gradeLevel: entry.gradeLevel,
				weightSum: weightSum.toNumber(),
			};
		}
	}

	return null;
}
