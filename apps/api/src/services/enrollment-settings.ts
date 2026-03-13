import { Decimal } from 'decimal.js';
import type { EnrollmentSettings } from '@budfin/types';
import type { Prisma } from '@prisma/client';
import { resolveEnrollmentPlanningRules } from './planning-rules.js';

const DECIMAL_PRECISION = 4;

export const ENROLLMENT_SETTINGS_STALE_MODULES = [
	'ENROLLMENT',
	'REVENUE',
	'DHG',
	'STAFFING',
	'PNL',
] as const;

type GradeLevelTemplate = {
	gradeCode: string;
	gradeName: string;
	band: string;
	displayOrder: number;
	defaultAy2Intake: number | null;
	maxClassSize: number;
	plancherPct: Prisma.Decimal | Decimal | number | string;
	ciblePct: Prisma.Decimal | Decimal | number | string;
	plafondPct: Prisma.Decimal | Decimal | number | string;
};

type VersionCapacityRow = {
	gradeLevel: string;
	maxClassSize: number;
	plancherPct: Prisma.Decimal | Decimal | number | string;
	ciblePct: Prisma.Decimal | Decimal | number | string;
	plafondPct: Prisma.Decimal | Decimal | number | string;
};

export type EnrollmentSettingsClient = Pick<
	Prisma.TransactionClient,
	'budgetVersion' | 'gradeLevel' | 'versionCapacityConfig'
>;

function toRoundedNumber(value: Decimal.Value) {
	return new Decimal(value).toDecimalPlaces(DECIMAL_PRECISION, Decimal.ROUND_HALF_UP).toNumber();
}

function toRoundedDecimalString(value: number) {
	return new Decimal(value)
		.toDecimalPlaces(DECIMAL_PRECISION, Decimal.ROUND_HALF_UP)
		.toFixed(DECIMAL_PRECISION);
}

export function mergeEnrollmentSettingsCapacityByGrade({
	gradeLevels,
	capacityConfigs,
}: {
	gradeLevels: GradeLevelTemplate[];
	capacityConfigs: VersionCapacityRow[];
}): EnrollmentSettings['capacityByGrade'] {
	const configByGrade = new Map(capacityConfigs.map((config) => [config.gradeLevel, config]));

	return [...gradeLevels]
		.sort((left, right) => left.displayOrder - right.displayOrder)
		.map((gradeLevel) => {
			const config = configByGrade.get(gradeLevel.gradeCode);

			return {
				gradeLevel:
					gradeLevel.gradeCode as EnrollmentSettings['capacityByGrade'][number]['gradeLevel'],
				gradeName: gradeLevel.gradeName,
				band: gradeLevel.band,
				displayOrder: gradeLevel.displayOrder,
				defaultAy2Intake: gradeLevel.defaultAy2Intake,
				maxClassSize: config?.maxClassSize ?? gradeLevel.maxClassSize,
				plancherPct: toRoundedNumber(config?.plancherPct ?? gradeLevel.plancherPct),
				ciblePct: toRoundedNumber(config?.ciblePct ?? gradeLevel.ciblePct),
				plafondPct: toRoundedNumber(config?.plafondPct ?? gradeLevel.plafondPct),
				templateMaxClassSize: gradeLevel.maxClassSize,
				templatePlancherPct: toRoundedNumber(gradeLevel.plancherPct),
				templateCiblePct: toRoundedNumber(gradeLevel.ciblePct),
				templatePlafondPct: toRoundedNumber(gradeLevel.plafondPct),
			};
		});
}

export async function getEnrollmentSettings(
	prismaClient: EnrollmentSettingsClient,
	versionId: number
): Promise<EnrollmentSettings | null> {
	const [version, gradeLevels, capacityConfigs] = await Promise.all([
		prismaClient.budgetVersion.findUnique({
			where: { id: versionId },
			select: {
				id: true,
				rolloverThreshold: true,
				cappedRetention: true,
				retentionRecentWeight: true,
				historicalTargetRecentWeight: true,
			},
		}),
		prismaClient.gradeLevel.findMany({
			orderBy: { displayOrder: 'asc' },
			select: {
				gradeCode: true,
				gradeName: true,
				band: true,
				displayOrder: true,
				defaultAy2Intake: true,
				maxClassSize: true,
				plancherPct: true,
				ciblePct: true,
				plafondPct: true,
			},
		}),
		prismaClient.versionCapacityConfig.findMany({
			where: { versionId },
			select: {
				gradeLevel: true,
				maxClassSize: true,
				plancherPct: true,
				ciblePct: true,
				plafondPct: true,
			},
		}),
	]);

	if (!version) {
		return null;
	}

	return {
		rules: resolveEnrollmentPlanningRules(version),
		capacityByGrade: mergeEnrollmentSettingsCapacityByGrade({
			gradeLevels,
			capacityConfigs,
		}),
	};
}

export function buildEnrollmentSettingsStaleModules(staleModules: string[]) {
	return [...new Set([...staleModules, ...ENROLLMENT_SETTINGS_STALE_MODULES])];
}

export function buildEnrollmentCapacityConfigUpdateData(setting: {
	gradeLevel: string;
	maxClassSize: number;
	plancherPct: number;
	ciblePct: number;
	plafondPct: number;
}) {
	return {
		maxClassSize: setting.maxClassSize,
		plancherPct: toRoundedDecimalString(setting.plancherPct),
		ciblePct: toRoundedDecimalString(setting.ciblePct),
		plafondPct: toRoundedDecimalString(setting.plafondPct),
	};
}
