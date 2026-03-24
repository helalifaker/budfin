export const SCENARIO_NAMES = ['Base', 'Optimistic', 'Pessimistic'] as const;
export type ScenarioName = (typeof SCENARIO_NAMES)[number];

export interface ScenarioParameters {
	id: number;
	versionId: number;
	scenarioName: ScenarioName;
	newEnrollmentFactor: string;
	retentionAdjustment: string;
	feeCollectionRate: string;
	scholarshipAllocation: string;
	attritionRate: string;
	orsHours: string;
}

export interface ScenarioComparisonRow {
	metric: string;
	base: string;
	optimistic: string;
	pessimistic: string;
	optimisticDeltaPct: string;
	pessimisticDeltaPct: string;
}

export interface ScenarioComparisonResponse {
	rows: ScenarioComparisonRow[];
}
