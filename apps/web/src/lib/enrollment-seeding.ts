import type { HistoricalDataPoint } from '../hooks/use-enrollment';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface SeedResult {
	gradeLevel: string;
	suggestedRetention: number;
	suggestedLaterals: number;
	confidence: ConfidenceLevel;
	dataYears: number;
}

// Grade progression order — each grade's prior grade
const GRADE_PROGRESSION: Record<string, string> = {
	MS: 'PS',
	GS: 'MS',
	CP: 'GS',
	CE1: 'CP',
	CE2: 'CE1',
	CM1: 'CE2',
	CM2: 'CM1',
	'6EME': 'CM2',
	'5EME': '6EME',
	'4EME': '5EME',
	'3EME': '4EME',
	'2NDE': '3EME',
	'1ERE': '2NDE',
	TERM: '1ERE',
};

const DEFAULT_RETENTION = 0.97;
const GROWTH_THRESHOLD = 0.05; // 5% YoY

export function calculateBaselineRetention(
	historicalData: HistoricalDataPoint[],
	grades: string[]
): SeedResult[] {
	// Build lookup: gradeLevel -> academicYear -> headcount
	const lookup = new Map<string, Map<number, number>>();
	for (const dp of historicalData) {
		if (!lookup.has(dp.gradeLevel)) lookup.set(dp.gradeLevel, new Map());
		lookup.get(dp.gradeLevel)!.set(dp.academicYear, dp.headcount);
	}

	// Get sorted unique years
	const years = [...new Set(historicalData.map((d) => d.academicYear))].sort((a, b) => a - b);

	return grades.map((grade) => {
		// PS: always skip
		if (grade === 'PS') {
			return {
				gradeLevel: grade,
				suggestedRetention: 0,
				suggestedLaterals: 0,
				confidence: 'low' as ConfidenceLevel,
				dataYears: 0,
			};
		}

		const priorGrade = GRADE_PROGRESSION[grade];
		if (!priorGrade) {
			return {
				gradeLevel: grade,
				suggestedRetention: DEFAULT_RETENTION,
				suggestedLaterals: 0,
				confidence: 'low' as ConfidenceLevel,
				dataYears: 0,
			};
		}

		const gradeData = lookup.get(grade);
		const priorData = lookup.get(priorGrade);

		// Compute observed retentions and YoY growth for consecutive year pairs
		const observedRetentions: number[] = [];
		const impliedLaterals: number[] = [];
		const yoyGrowths: number[] = [];

		for (let i = 0; i < years.length - 1; i++) {
			const y = years[i]!;
			const yNext = years[i + 1]!;

			const priorCount = priorData?.get(y) ?? 0;
			const gradeCount = gradeData?.get(yNext) ?? 0;

			// Skip pairs with zero headcount
			if (priorCount === 0 || gradeCount === 0) continue;

			const observedRet = gradeCount / priorCount;
			observedRetentions.push(observedRet);

			// Implied lateral entries
			const retained = Math.floor(priorCount * Math.min(observedRet, 1));
			impliedLaterals.push(Math.max(0, gradeCount - retained));

			// YoY growth for this grade
			const prevGradeCount = gradeData?.get(y) ?? 0;
			if (prevGradeCount > 0) {
				yoyGrowths.push((gradeCount - prevGradeCount) / prevGradeCount);
			}
		}

		const dataYears = observedRetentions.length;

		// Confidence
		let confidence: ConfidenceLevel = 'low';
		if (dataYears >= 3) confidence = 'high';
		else if (dataYears >= 2) confidence = 'medium';

		// Not enough data: fall back to defaults
		if (dataYears < 2) {
			return {
				gradeLevel: grade,
				suggestedRetention: DEFAULT_RETENTION,
				suggestedLaterals: 0,
				confidence,
				dataYears,
			};
		}

		// Average YoY growth
		const avgGrowth =
			yoyGrowths.length > 0 ? yoyGrowths.reduce((s, v) => s + v, 0) / yoyGrowths.length : 0;

		// Average observed retention
		const avgObservedRetention =
			observedRetentions.reduce((s, v) => s + v, 0) / observedRetentions.length;

		// Average implied laterals
		const avgLaterals = impliedLaterals.reduce((s, v) => s + v, 0) / impliedLaterals.length;

		// Decision rules
		if (avgGrowth > GROWTH_THRESHOLD) {
			// Growing: use default healthy retention, compute laterals
			return {
				gradeLevel: grade,
				suggestedRetention: DEFAULT_RETENTION,
				suggestedLaterals: Math.round(avgLaterals),
				confidence,
				dataYears,
			};
		} else {
			// Flat/decline: use observed retention (capped), zero laterals
			return {
				gradeLevel: grade,
				suggestedRetention: Math.min(avgObservedRetention, DEFAULT_RETENTION),
				suggestedLaterals: 0,
				confidence,
				dataYears,
			};
		}
	});
}
