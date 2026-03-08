// Cohort progression engine — pure functions, no DB dependencies
// Phase 2a: Calculates AY2 headcounts from AY1 using retention rates and lateral entries

import { Decimal } from 'decimal.js';

// Grade progression order (PS is entry, Terminale is exit)
export const GRADE_PROGRESSION = [
	'PS',
	'MS',
	'GS',
	'CP',
	'CE1',
	'CE2',
	'CM1',
	'CM2',
	'6eme',
	'5eme',
	'4eme',
	'3eme',
	'2nde',
	'1ere',
	'Terminale',
] as const;

export type ProgressionGrade = (typeof GRADE_PROGRESSION)[number];

const DEFAULT_RETENTION_RATE = '0.97';
const DEFAULT_LATERAL_ENTRY = 0;

export interface CohortParams {
	retentionRate: string; // decimal string 0-1
	lateralEntryCount: number;
}

export interface CohortInput {
	ay1Headcounts: Map<string, number>; // grade -> headcount
	cohortParams: Map<string, CohortParams>; // grade -> params
	psAy2Headcount: number; // direct entry for PS
}

export interface CohortOutputRow {
	gradeLevel: string;
	ay1Headcount: number;
	retainedFromPrior: number;
	lateralEntry: number;
	ay2Headcount: number;
}

/**
 * Calculate AY2 headcounts for all 15 grades based on AY1 headcounts,
 * retention rates, and lateral entry counts.
 *
 * Algorithm:
 * - PS: ay2 = psAy2Headcount (direct entry, no retention applied)
 * - For grade G at index i > 0:
 *     priorGrade = GRADE_PROGRESSION[i - 1]
 *     retained = floor(ay1Headcounts[priorGrade] * retentionRate[G])
 *     ay2 = retained + lateralEntryCount[G]
 *
 * Uses Decimal.floor() for retained students (conservative — no half-students).
 */
export function calculateCohortProgression(input: CohortInput): CohortOutputRow[] {
	const { ay1Headcounts, cohortParams, psAy2Headcount } = input;
	const results: CohortOutputRow[] = [];

	for (let i = 0; i < GRADE_PROGRESSION.length; i++) {
		const grade = GRADE_PROGRESSION[i]!;
		const ay1Headcount = ay1Headcounts.get(grade) ?? 0;

		if (i === 0) {
			// PS: direct entry, no retention from prior grade
			results.push({
				gradeLevel: grade,
				ay1Headcount,
				retainedFromPrior: 0,
				lateralEntry: 0,
				ay2Headcount: psAy2Headcount,
			});
			continue;
		}

		const priorGrade = GRADE_PROGRESSION[i - 1]!;
		const priorHeadcount = ay1Headcounts.get(priorGrade) ?? 0;

		const params = cohortParams.get(grade);
		const retentionRate = new Decimal(params?.retentionRate ?? DEFAULT_RETENTION_RATE);
		const lateralEntry = params?.lateralEntryCount ?? DEFAULT_LATERAL_ENTRY;

		// Conservative: floor — no half-students
		const retained = new Decimal(priorHeadcount).times(retentionRate).floor().toNumber();
		const ay2Headcount = retained + lateralEntry;

		results.push({
			gradeLevel: grade,
			ay1Headcount,
			retainedFromPrior: retained,
			lateralEntry,
			ay2Headcount,
		});
	}

	return results;
}
