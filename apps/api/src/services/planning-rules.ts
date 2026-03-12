import { Decimal } from 'decimal.js';

export interface EnrollmentPlanningRules {
	rolloverThreshold: number;
	cappedRetention: number;
}

export const DEFAULT_ROLLOVER_THRESHOLD = 1;
export const DEFAULT_CAPPED_RETENTION = 0.98;

export const ENROLLMENT_RULES_STALE_MODULES = [
	'ENROLLMENT',
	'REVENUE',
	'DHG',
	'STAFFING',
	'PNL',
] as const;

export function resolveEnrollmentPlanningRules(source?: {
	rolloverThreshold?: Decimal.Value | null;
	cappedRetention?: Decimal.Value | null;
}): EnrollmentPlanningRules {
	return {
		rolloverThreshold: new Decimal(
			source?.rolloverThreshold ?? DEFAULT_ROLLOVER_THRESHOLD
		).toNumber(),
		cappedRetention: new Decimal(source?.cappedRetention ?? DEFAULT_CAPPED_RETENTION).toNumber(),
	};
}

function toRuleDecimal(value: number) {
	return new Decimal(value).toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4);
}

export function buildEnrollmentPlanningRulesUpdateData(rules: EnrollmentPlanningRules) {
	return {
		rolloverThreshold: toRuleDecimal(rules.rolloverThreshold),
		cappedRetention: toRuleDecimal(rules.cappedRetention),
	};
}
