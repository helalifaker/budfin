import { Decimal } from 'decimal.js';

export interface EnrollmentPlanningRules {
	rolloverThreshold: number;
	retentionRecentWeight: number;
	historicalTargetRecentWeight: number;
	cappedRetention?: number | undefined;
}

export const DEFAULT_ROLLOVER_THRESHOLD = 1;
export const DEFAULT_CAPPED_RETENTION = 0.98;
export const DEFAULT_RETENTION_RECENT_WEIGHT = 0.6;
export const DEFAULT_HISTORICAL_TARGET_RECENT_WEIGHT = 0.8;

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
	retentionRecentWeight?: Decimal.Value | null;
	historicalTargetRecentWeight?: Decimal.Value | null;
}): EnrollmentPlanningRules {
	return {
		rolloverThreshold: new Decimal(
			source?.rolloverThreshold ?? DEFAULT_ROLLOVER_THRESHOLD
		).toNumber(),
		cappedRetention: new Decimal(source?.cappedRetention ?? DEFAULT_CAPPED_RETENTION).toNumber(),
		retentionRecentWeight: new Decimal(
			source?.retentionRecentWeight ?? DEFAULT_RETENTION_RECENT_WEIGHT
		).toNumber(),
		historicalTargetRecentWeight: new Decimal(
			source?.historicalTargetRecentWeight ?? DEFAULT_HISTORICAL_TARGET_RECENT_WEIGHT
		).toNumber(),
	};
}

function toRuleDecimal(value: number) {
	return new Decimal(value).toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4);
}

export function buildEnrollmentPlanningRulesUpdateData(rules: EnrollmentPlanningRules) {
	return {
		rolloverThreshold: toRuleDecimal(rules.rolloverThreshold),
		retentionRecentWeight: toRuleDecimal(rules.retentionRecentWeight),
		historicalTargetRecentWeight: toRuleDecimal(rules.historicalTargetRecentWeight),
		...(rules.cappedRetention === undefined
			? {}
			: { cappedRetention: toRuleDecimal(rules.cappedRetention) }),
	};
}
