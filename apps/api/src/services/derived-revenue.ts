import type { RevenueSettings } from '@budfin/types';
import { Decimal } from 'decimal.js';
import { GRADE_BAND_MAP } from '../lib/enrollment-constants.js';
import {
	CANONICAL_DYNAMIC_OTHER_REVENUE_ITEMS,
	getCanonicalDynamicOtherRevenueItem,
} from './revenue-config.js';
import { GRADE_PROGRESSION } from './cohort-engine.js';
import type { OtherRevenueInput } from './revenue-engine.js';

const ZERO = new Decimal(0);
const NATIONALITIES = ['Francais', 'Nationaux', 'Autres'] as const;
const PRIMAIRE_GRADES = ['CP', 'CE1', 'CE2', 'CM1', 'CM2'] as const;
const SECONDAIRE_GRADES = ['6EME', '5EME', '4EME', '3EME', '2NDE', '1ERE', 'TERM'] as const;

type Nationality = (typeof NATIONALITIES)[number];
type NationalityCounts = Record<Nationality, number>;

export class DerivedRevenueConfigurationError extends Error {
	code: string;
	details?: unknown;

	constructor(code: string, message: string, details?: unknown) {
		super(message);
		this.name = 'DerivedRevenueConfigurationError';
		this.code = code;
		this.details = details;
	}
}

export interface EnrollmentDetailForDerived {
	academicPeriod: 'AY1' | 'AY2';
	gradeLevel: string;
	nationality: string;
	tariff: string;
	headcount: number;
}

export interface FeeGridForDerived {
	academicPeriod: 'AY1' | 'AY2';
	gradeLevel: string;
	nationality: string;
	tariff: string;
	dai: string;
}

export interface HeadcountForDerived {
	academicPeriod: 'AY1' | 'AY2';
	gradeLevel: string;
	headcount: number;
}

export interface CohortParamForDerived {
	gradeLevel: string;
	appliedRetentionRate: string | null;
	retainedFromPrior: number | null;
	historicalTargetHeadcount: number | null;
	derivedLaterals: number | null;
	usesConfiguredRetention: boolean | null;
}

export interface DerivedRevenueInput {
	enrollmentDetails: EnrollmentDetailForDerived[];
	feeGrids: FeeGridForDerived[];
	headcounts: HeadcountForDerived[];
	cohortParams: CohortParamForDerived[];
	settings: RevenueSettings;
}

export interface NewStudentsByNationality {
	Francais: number;
	Nationaux: number;
	Autres: number;
}

export interface NewStudentsByBand {
	primaire: number;
	secondaire: number;
}

export interface NewStudentGradeResult {
	gradeLevel: string;
	effectiveRetained: number;
	newTotal: number;
	newByNationality: NewStudentsByNationality;
}

function emptyNationalityCounts(): NationalityCounts {
	return {
		Francais: 0,
		Nationaux: 0,
		Autres: 0,
	};
}

function normalizeNationalityCounts(input?: Partial<Record<string, number>>): NationalityCounts {
	const counts = emptyNationalityCounts();
	for (const nationality of NATIONALITIES) {
		counts[nationality] = input?.[nationality] ?? 0;
	}
	return counts;
}

function sumNationalityCounts(counts: NationalityCounts) {
	return NATIONALITIES.reduce((sum, nationality) => sum + counts[nationality], 0);
}

function buildDetailCountsByGrade(
	enrollmentDetails: EnrollmentDetailForDerived[],
	academicPeriod: 'AY1' | 'AY2'
) {
	const counts = new Map<string, NationalityCounts>();

	for (const detail of enrollmentDetails) {
		if (detail.academicPeriod !== academicPeriod) {
			continue;
		}

		const nationality = detail.nationality as Nationality;
		if (!NATIONALITIES.includes(nationality)) {
			continue;
		}

		const current = counts.get(detail.gradeLevel) ?? emptyNationalityCounts();
		current[nationality] += detail.headcount;
		counts.set(detail.gradeLevel, current);
	}

	return counts;
}

function makeDynamicItem(lineItemName: string, annualAmount: Decimal): OtherRevenueInput {
	const canonical = getCanonicalDynamicOtherRevenueItem(lineItemName);
	if (!canonical) {
		throw new DerivedRevenueConfigurationError(
			'DYNAMIC_ROW_UNKNOWN',
			`No canonical dynamic row exists for "${lineItemName}".`
		);
	}

	return {
		lineItemName: canonical.lineItemName,
		annualAmount: annualAmount.toFixed(4),
		distributionMethod: canonical.distributionMethod,
		weightArray: canonical.weightArray,
		specificMonths: canonical.specificMonths,
		ifrsCategory: canonical.ifrsCategory,
	};
}

function buildAy2DaiLookup(feeGrids: FeeGridForDerived[]) {
	const grouped = new Map<
		string,
		{
			values: Set<string>;
			pleinValue: string | null;
		}
	>();

	for (const feeGrid of feeGrids) {
		if (feeGrid.academicPeriod !== 'AY2') {
			continue;
		}

		const key = `${feeGrid.gradeLevel}|${feeGrid.nationality}`;
		const current = grouped.get(key) ?? { values: new Set<string>(), pleinValue: null };
		current.values.add(new Decimal(feeGrid.dai).toFixed(4));
		if (feeGrid.tariff === 'Plein') {
			current.pleinValue = new Decimal(feeGrid.dai).toFixed(4);
		}
		grouped.set(key, current);
	}

	const lookup = new Map<string, Decimal>();
	for (const [key, value] of grouped) {
		if (value.values.size > 1) {
			throw new DerivedRevenueConfigurationError(
				'DAI_MISMATCH',
				`DAI values must match across AY2 tariffs for ${key}.`,
				{ key, values: [...value.values] }
			);
		}

		if (!value.pleinValue) {
			throw new DerivedRevenueConfigurationError(
				'DAI_RATE_MISSING',
				`Missing AY2 Plein DAI fee for ${key}.`,
				{ key }
			);
		}

		lookup.set(key, new Decimal(value.pleinValue));
	}

	return lookup;
}

function allocateRetainedByNationality({
	gradeLevel,
	effectiveRetained,
	priorAy1Counts,
	ay2Counts,
}: {
	gradeLevel: string;
	effectiveRetained: number;
	priorAy1Counts: NationalityCounts;
	ay2Counts: NationalityCounts;
}): NationalityCounts {
	const retained = emptyNationalityCounts();
	if (effectiveRetained === 0) {
		return retained;
	}

	const priorTotal = sumNationalityCounts(priorAy1Counts);
	if (priorTotal === 0) {
		throw new DerivedRevenueConfigurationError(
			'COHORT_OUTPUTS_MISSING',
			`Cannot allocate retained students for ${gradeLevel} because prior-grade AY1 nationality detail is missing.`,
			{ gradeLevel }
		);
	}

	const rawRetained = new Map<Nationality, Decimal>();
	for (const nationality of NATIONALITIES) {
		const raw = new Decimal(effectiveRetained).times(priorAy1Counts[nationality]).div(priorTotal);
		rawRetained.set(nationality, raw);
		retained[nationality] = Math.min(
			ay2Counts[nationality],
			raw.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber()
		);
	}

	let allocated = sumNationalityCounts(retained);
	while (allocated > effectiveRetained) {
		const candidate = [...NATIONALITIES]
			.filter((nationality) => retained[nationality] > 0)
			.sort((left, right) => {
				const leftOverage = new Decimal(retained[left]).minus(rawRetained.get(left)!);
				const rightOverage = new Decimal(retained[right]).minus(rawRetained.get(right)!);
				const overageDiff = rightOverage.comparedTo(leftOverage);
				if (overageDiff !== 0) {
					return overageDiff;
				}

				return retained[right] - retained[left];
			})[0];

		if (!candidate) {
			throw new DerivedRevenueConfigurationError(
				'COHORT_OUTPUTS_MISSING',
				`Retained-student reconciliation failed for ${gradeLevel}.`,
				{
					gradeLevel,
					effectiveRetained,
					priorAy1Counts,
					ay2Counts,
					retained,
				}
			);
		}

		retained[candidate] -= 1;
		allocated -= 1;
	}

	while (allocated < effectiveRetained) {
		const candidate = [...NATIONALITIES]
			.filter((nationality) => retained[nationality] < ay2Counts[nationality])
			.sort((left, right) => {
				const leftDeficit = rawRetained.get(left)!.minus(retained[left]);
				const rightDeficit = rawRetained.get(right)!.minus(retained[right]);
				const deficitDiff = rightDeficit.comparedTo(leftDeficit);
				if (deficitDiff !== 0) {
					return deficitDiff;
				}

				const rawDiff = rawRetained.get(right)!.comparedTo(rawRetained.get(left)!);
				if (rawDiff !== 0) {
					return rawDiff;
				}

				return ay2Counts[right] - ay2Counts[left];
			})[0];

		if (!candidate) {
			throw new DerivedRevenueConfigurationError(
				'COHORT_OUTPUTS_MISSING',
				`Retained-student reconciliation failed for ${gradeLevel}.`,
				{
					gradeLevel,
					effectiveRetained,
					priorAy1Counts,
					ay2Counts,
					retained,
				}
			);
		}

		retained[candidate] += 1;
		allocated += 1;
	}

	return retained;
}

export function computeDAI(
	enrollmentDetails: EnrollmentDetailForDerived[],
	feeGrids: FeeGridForDerived[]
): OtherRevenueInput[] {
	const daiLookup = buildAy2DaiLookup(feeGrids);
	const amountsByNationality: Record<Nationality, Decimal> = {
		Francais: ZERO,
		Nationaux: ZERO,
		Autres: ZERO,
	};

	for (const detail of enrollmentDetails) {
		if (detail.academicPeriod !== 'AY2' || detail.headcount <= 0) {
			continue;
		}

		const nationality = detail.nationality as Nationality;
		if (!NATIONALITIES.includes(nationality)) {
			continue;
		}

		const daiPerStudent = daiLookup.get(`${detail.gradeLevel}|${detail.nationality}`);
		if (!daiPerStudent) {
			throw new DerivedRevenueConfigurationError(
				'DAI_RATE_MISSING',
				`Missing AY2 DAI fee for ${detail.gradeLevel}/${detail.nationality}.`,
				{
					gradeLevel: detail.gradeLevel,
					nationality: detail.nationality,
				}
			);
		}

		amountsByNationality[nationality] = amountsByNationality[nationality].plus(
			daiPerStudent.times(detail.headcount)
		);
	}

	return NATIONALITIES.map((nationality) =>
		makeDynamicItem(`DAI - ${nationality}`, amountsByNationality[nationality])
	);
}

export function deriveNewStudentGradeResults(
	enrollmentDetails: EnrollmentDetailForDerived[],
	cohortParams: CohortParamForDerived[]
): NewStudentGradeResult[] {
	const ay1CountsByGrade = buildDetailCountsByGrade(enrollmentDetails, 'AY1');
	const ay2CountsByGrade = buildDetailCountsByGrade(enrollmentDetails, 'AY2');
	const cohortByGrade = new Map(cohortParams.map((row) => [row.gradeLevel, row] as const));

	return GRADE_PROGRESSION.map((gradeLevel, index) => {
		const ay2Counts = normalizeNationalityCounts(ay2CountsByGrade.get(gradeLevel));
		const ay2Total = sumNationalityCounts(ay2Counts);

		if (index === 0) {
			return {
				gradeLevel,
				effectiveRetained: 0,
				newTotal: ay2Total,
				newByNationality: ay2Counts,
			};
		}

		const cohortRow = cohortByGrade.get(gradeLevel);
		if (!cohortRow || cohortRow.retainedFromPrior === null) {
			throw new DerivedRevenueConfigurationError(
				'COHORT_OUTPUTS_MISSING',
				`Persisted enrollment outputs are missing for ${gradeLevel}. Recalculate enrollment before revenue.`,
				{ gradeLevel }
			);
		}

		const effectiveRetained = Math.min(Math.max(cohortRow.retainedFromPrior, 0), ay2Total);
		const priorGrade = GRADE_PROGRESSION[index - 1]!;
		const priorAy1Counts = normalizeNationalityCounts(ay1CountsByGrade.get(priorGrade));
		const retainedByNationality = allocateRetainedByNationality({
			gradeLevel,
			effectiveRetained,
			priorAy1Counts,
			ay2Counts,
		});
		const newByNationality = emptyNationalityCounts();
		for (const nationality of NATIONALITIES) {
			newByNationality[nationality] = ay2Counts[nationality] - retainedByNationality[nationality];
		}

		return {
			gradeLevel,
			effectiveRetained,
			newTotal: sumNationalityCounts(newByNationality),
			newByNationality,
		};
	});
}

export function deriveNewStudentsByNationality(
	enrollmentDetails: EnrollmentDetailForDerived[],
	cohortParams: CohortParamForDerived[]
): NewStudentsByNationality {
	const totals = emptyNationalityCounts();

	for (const result of deriveNewStudentGradeResults(enrollmentDetails, cohortParams)) {
		for (const nationality of NATIONALITIES) {
			totals[nationality] += result.newByNationality[nationality];
		}
	}

	return totals;
}

export function deriveNewStudentsByBand(
	enrollmentDetails: EnrollmentDetailForDerived[],
	cohortParams: CohortParamForDerived[]
): NewStudentsByBand {
	let primaire = 0;
	let secondaire = 0;

	for (const result of deriveNewStudentGradeResults(enrollmentDetails, cohortParams)) {
		if ((PRIMAIRE_GRADES as readonly string[]).includes(result.gradeLevel)) {
			primaire += result.newTotal;
			continue;
		}

		if ((SECONDAIRE_GRADES as readonly string[]).includes(result.gradeLevel)) {
			secondaire += result.newTotal;
			continue;
		}

		if (GRADE_BAND_MAP[result.gradeLevel] === 'MATERNELLE') {
			continue;
		}
	}

	return { primaire, secondaire };
}

export function computeDPI(
	newStudentsByNationality: NewStudentsByNationality,
	dpiPerStudentHt: string
): OtherRevenueInput[] {
	const rate = new Decimal(dpiPerStudentHt);

	return NATIONALITIES.map((nationality) =>
		makeDynamicItem(`DPI - ${nationality}`, rate.times(newStudentsByNationality[nationality]))
	);
}

export function computeDossier(
	newStudentsByNationality: NewStudentsByNationality,
	dossierPerStudentHt: string
): OtherRevenueInput[] {
	const rate = new Decimal(dossierPerStudentHt);

	return NATIONALITIES.map((nationality) =>
		makeDynamicItem(
			`Frais de Dossier - ${nationality}`,
			rate.times(newStudentsByNationality[nationality])
		)
	);
}

export function computeExamFees(
	headcounts: HeadcountForDerived[],
	settings: Pick<RevenueSettings, 'examBacPerStudent' | 'examDnbPerStudent' | 'examEafPerStudent'>
): OtherRevenueInput[] {
	const ay1Headcounts = new Map<string, number>();
	for (const headcount of headcounts) {
		if (headcount.academicPeriod === 'AY1') {
			ay1Headcounts.set(headcount.gradeLevel, headcount.headcount);
		}
	}

	return [
		makeDynamicItem(
			'BAC',
			new Decimal(settings.examBacPerStudent).times(ay1Headcounts.get('TERM') ?? 0)
		),
		makeDynamicItem(
			'DNB',
			new Decimal(settings.examDnbPerStudent).times(ay1Headcounts.get('3EME') ?? 0)
		),
		makeDynamicItem(
			'EAF',
			new Decimal(settings.examEafPerStudent).times(ay1Headcounts.get('1ERE') ?? 0)
		),
	];
}

export function computeEvaluationFees(
	newStudentsByBand: NewStudentsByBand,
	settings: Pick<RevenueSettings, 'evalPrimairePerStudent' | 'evalSecondairePerStudent'>
): OtherRevenueInput[] {
	return [
		makeDynamicItem(
			'Evaluation - Primaire',
			new Decimal(settings.evalPrimairePerStudent).times(newStudentsByBand.primaire)
		),
		makeDynamicItem(
			'Evaluation - College+Lycee',
			new Decimal(settings.evalSecondairePerStudent).times(newStudentsByBand.secondaire)
		),
	];
}

export function computeAllDerivedRevenue(input: DerivedRevenueInput): OtherRevenueInput[] {
	const daiItems = computeDAI(input.enrollmentDetails, input.feeGrids);
	const newStudentsByNationality = deriveNewStudentsByNationality(
		input.enrollmentDetails,
		input.cohortParams
	);
	const dpiItems = computeDPI(newStudentsByNationality, input.settings.dpiPerStudentHt);
	const dossierItems = computeDossier(newStudentsByNationality, input.settings.dossierPerStudentHt);
	const examItems = computeExamFees(input.headcounts, input.settings);
	const newStudentsByBand = deriveNewStudentsByBand(input.enrollmentDetails, input.cohortParams);
	const evaluationItems = computeEvaluationFees(newStudentsByBand, input.settings);

	const items = [...daiItems, ...dpiItems, ...dossierItems, ...examItems, ...evaluationItems];

	if (items.length !== CANONICAL_DYNAMIC_OTHER_REVENUE_ITEMS.length) {
		throw new DerivedRevenueConfigurationError(
			'DYNAMIC_ROW_COUNT_MISMATCH',
			`Expected ${CANONICAL_DYNAMIC_OTHER_REVENUE_ITEMS.length} derived rows, received ${items.length}.`
		);
	}

	return items;
}
