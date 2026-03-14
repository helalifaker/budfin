import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	computeAllDerivedRevenue,
	computeDAI,
	computeExamFees,
	deriveNewStudentGradeResults,
	DerivedRevenueConfigurationError,
	type CohortParamForDerived,
	type EnrollmentDetailForDerived,
	type FeeGridForDerived,
	type HeadcountForDerived,
} from './derived-revenue.js';
import {
	CANONICAL_DYNAMIC_OTHER_REVENUE_ITEMS,
	DEFAULT_VERSION_REVENUE_SETTINGS,
} from './revenue-config.js';
import { GRADE_PROGRESSION } from './cohort-engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURES_DIR = resolve(__dirname, '..', '..', '..', '..', 'data', 'fixtures');

interface EnrollmentDetailFixture {
	academicPeriod: 'AY1' | 'AY2';
	gradeLevel: string;
	nationality: string;
	tariff: string;
	headcount: number;
}

const fy2026EnrollmentDetails = JSON.parse(
	readFileSync(resolve(FIXTURES_DIR, 'fy2026-enrollment-detail.json'), 'utf8')
) as EnrollmentDetailFixture[];

function buildCohortParams(
	retainedByGrade: Partial<Record<(typeof GRADE_PROGRESSION)[number], number>>
): CohortParamForDerived[] {
	return GRADE_PROGRESSION.map((gradeLevel) => ({
		gradeLevel,
		appliedRetentionRate: null,
		retainedFromPrior: retainedByGrade[gradeLevel] ?? 0,
		historicalTargetHeadcount: null,
		derivedLaterals: null,
		usesConfiguredRetention: null,
	}));
}

function selectRealScenario(
	priorGrade: string,
	currentGrade: string,
	retainedFromPrior: number
): {
	enrollmentDetails: EnrollmentDetailForDerived[];
	cohortParams: CohortParamForDerived[];
} {
	return {
		enrollmentDetails: fy2026EnrollmentDetails.filter(
			(detail) =>
				(detail.academicPeriod === 'AY1' && detail.gradeLevel === priorGrade) ||
				(detail.academicPeriod === 'AY2' && detail.gradeLevel === currentGrade)
		),
		cohortParams: buildCohortParams({
			[currentGrade as (typeof GRADE_PROGRESSION)[number]]: retainedFromPrior,
		}),
	};
}

function buildSyntheticEnrollmentDetails(): EnrollmentDetailForDerived[] {
	return [
		{
			academicPeriod: 'AY1',
			gradeLevel: 'PS',
			nationality: 'Francais',
			tariff: 'Plein',
			headcount: 2,
		},
		{
			academicPeriod: 'AY1',
			gradeLevel: 'PS',
			nationality: 'Autres',
			tariff: 'Plein',
			headcount: 2,
		},
		{
			academicPeriod: 'AY1',
			gradeLevel: 'GS',
			nationality: 'Francais',
			tariff: 'Plein',
			headcount: 1,
		},
		{
			academicPeriod: 'AY1',
			gradeLevel: 'GS',
			nationality: 'Nationaux',
			tariff: 'Plein',
			headcount: 1,
		},
		{
			academicPeriod: 'AY1',
			gradeLevel: 'CM2',
			nationality: 'Nationaux',
			tariff: 'Plein',
			headcount: 1,
		},
		{
			academicPeriod: 'AY1',
			gradeLevel: 'CM2',
			nationality: 'Autres',
			tariff: 'Plein',
			headcount: 3,
		},
		{
			academicPeriod: 'AY2',
			gradeLevel: 'PS',
			nationality: 'Francais',
			tariff: 'Plein',
			headcount: 2,
		},
		{
			academicPeriod: 'AY2',
			gradeLevel: 'PS',
			nationality: 'Nationaux',
			tariff: 'Plein',
			headcount: 1,
		},
		{
			academicPeriod: 'AY2',
			gradeLevel: 'PS',
			nationality: 'Autres',
			tariff: 'Plein',
			headcount: 3,
		},
		{
			academicPeriod: 'AY2',
			gradeLevel: 'MS',
			nationality: 'Francais',
			tariff: 'Plein',
			headcount: 2,
		},
		{
			academicPeriod: 'AY2',
			gradeLevel: 'MS',
			nationality: 'Nationaux',
			tariff: 'Plein',
			headcount: 1,
		},
		{
			academicPeriod: 'AY2',
			gradeLevel: 'MS',
			nationality: 'Autres',
			tariff: 'Plein',
			headcount: 3,
		},
		{
			academicPeriod: 'AY2',
			gradeLevel: 'CP',
			nationality: 'Francais',
			tariff: 'Plein',
			headcount: 2,
		},
		{
			academicPeriod: 'AY2',
			gradeLevel: 'CP',
			nationality: 'Nationaux',
			tariff: 'Plein',
			headcount: 1,
		},
		{
			academicPeriod: 'AY2',
			gradeLevel: 'CP',
			nationality: 'Autres',
			tariff: 'Plein',
			headcount: 1,
		},
		{
			academicPeriod: 'AY2',
			gradeLevel: '6EME',
			nationality: 'Francais',
			tariff: 'Plein',
			headcount: 1,
		},
		{
			academicPeriod: 'AY2',
			gradeLevel: '6EME',
			nationality: 'Nationaux',
			tariff: 'Plein',
			headcount: 1,
		},
		{
			academicPeriod: 'AY2',
			gradeLevel: '6EME',
			nationality: 'Autres',
			tariff: 'Plein',
			headcount: 4,
		},
	];
}

function buildSyntheticFeeGrid(): FeeGridForDerived[] {
	const rows: FeeGridForDerived[] = [];
	const gradeLevels = ['PS', 'MS', 'CP', '6EME'] as const;
	const nationalities = ['Francais', 'Nationaux', 'Autres'] as const;

	for (const gradeLevel of gradeLevels) {
		for (const nationality of nationalities) {
			rows.push({
				academicPeriod: 'AY2',
				gradeLevel,
				nationality,
				tariff: 'Plein',
				dai: nationality === 'Nationaux' ? '4350.0000' : '5000.0000',
			});
		}
	}

	return rows;
}

function buildSyntheticHeadcounts(): HeadcountForDerived[] {
	return [
		{ academicPeriod: 'AY1', gradeLevel: 'TERM', headcount: 12 },
		{ academicPeriod: 'AY1', gradeLevel: '3EME', headcount: 10 },
		{ academicPeriod: 'AY1', gradeLevel: '1ERE', headcount: 11 },
	];
}

describe('derived-revenue', () => {
	describe('computeExamFees', () => {
		it('returns 0.0000 for all exam types when headcounts is empty', () => {
			const result = computeExamFees([], {
				examBacPerStudent: '2000.0000',
				examDnbPerStudent: '600.0000',
				examEafPerStudent: '800.0000',
			});
			expect(result).toHaveLength(3);
			const byName = new Map(result.map((r) => [r.lineItemName, r]));
			expect(byName.get('BAC')?.annualAmount).toBe('0.0000');
			expect(byName.get('DNB')?.annualAmount).toBe('0.0000');
			expect(byName.get('EAF')?.annualAmount).toBe('0.0000');
		});

		it('returns 0.0000 when TERM, 3EME, and 1ERE grades have zero headcount', () => {
			const headcounts: HeadcountForDerived[] = [
				{ academicPeriod: 'AY1', gradeLevel: 'TERM', headcount: 0 },
				{ academicPeriod: 'AY1', gradeLevel: '3EME', headcount: 0 },
				{ academicPeriod: 'AY1', gradeLevel: '1ERE', headcount: 0 },
			];
			const result = computeExamFees(headcounts, {
				examBacPerStudent: '2000.0000',
				examDnbPerStudent: '600.0000',
				examEafPerStudent: '800.0000',
			});
			const byName = new Map(result.map((r) => [r.lineItemName, r]));
			expect(byName.get('BAC')?.annualAmount).toBe('0.0000');
			expect(byName.get('DNB')?.annualAmount).toBe('0.0000');
			expect(byName.get('EAF')?.annualAmount).toBe('0.0000');
		});

		it('computes BAC = rate * TERM headcount, DNB = rate * 3EME, EAF = rate * 1ERE', () => {
			const headcounts: HeadcountForDerived[] = [
				{ academicPeriod: 'AY1', gradeLevel: 'TERM', headcount: 10 },
				{ academicPeriod: 'AY1', gradeLevel: '3EME', headcount: 8 },
				{ academicPeriod: 'AY1', gradeLevel: '1ERE', headcount: 6 },
			];
			const result = computeExamFees(headcounts, {
				examBacPerStudent: '2000.0000',
				examDnbPerStudent: '600.0000',
				examEafPerStudent: '800.0000',
			});
			const byName = new Map(result.map((r) => [r.lineItemName, r]));
			expect(byName.get('BAC')?.annualAmount).toBe('20000.0000');
			expect(byName.get('DNB')?.annualAmount).toBe('4800.0000');
			expect(byName.get('EAF')?.annualAmount).toBe('4800.0000');
		});
	});

	describe('computeDAI', () => {
		it('throws DAI_RATE_MISSING when an AY2 fee grid entry exists with no Plein tariff', () => {
			// Only an RP tariff exists for CP/Francais — no Plein tariff to serve as the DAI rate
			expect(() =>
				computeDAI(
					[
						{
							academicPeriod: 'AY2',
							gradeLevel: 'CP',
							nationality: 'Francais',
							tariff: 'RP',
							headcount: 1,
						},
					],
					[
						{
							academicPeriod: 'AY2',
							gradeLevel: 'CP',
							nationality: 'Francais',
							tariff: 'RP',
							dai: '4500.0000',
						},
					]
				)
			).toThrowError(
				expect.objectContaining<Partial<DerivedRevenueConfigurationError>>({
					code: 'DAI_RATE_MISSING',
				})
			);
		});

		it('rejects inconsistent AY2 DAI values across tariffs for the same grade and nationality', () => {
			expect(() =>
				computeDAI(
					[
						{
							academicPeriod: 'AY2',
							gradeLevel: 'CP',
							nationality: 'Francais',
							tariff: 'Plein',
							headcount: 1,
						},
					],
					[
						{
							academicPeriod: 'AY2',
							gradeLevel: 'CP',
							nationality: 'Francais',
							tariff: 'Plein',
							dai: '5000.0000',
						},
						{
							academicPeriod: 'AY2',
							gradeLevel: 'CP',
							nationality: 'Francais',
							tariff: 'RP',
							dai: '4500.0000',
						},
					]
				)
			).toThrowError(
				expect.objectContaining<Partial<DerivedRevenueConfigurationError>>({
					code: 'DAI_MISMATCH',
				})
			);
		});
	});

	describe('deriveNewStudentGradeResults', () => {
		it('uses retained-first nationality allocation for CM2 -> 6EME with real FY2026 data', () => {
			const input = selectRealScenario('CM2', '6EME', 119);

			const result = deriveNewStudentGradeResults(input.enrollmentDetails, input.cohortParams).find(
				(row) => row.gradeLevel === '6EME'
			);

			expect(result).toEqual({
				gradeLevel: '6EME',
				effectiveRetained: 119,
				newTotal: 24,
				newByNationality: {
					Francais: 6,
					Nationaux: 0,
					Autres: 18,
				},
			});
		});

		it('uses retained-first nationality allocation for 3EME -> 2NDE with real FY2026 data', () => {
			const input = selectRealScenario('3EME', '2NDE', 101);

			const result = deriveNewStudentGradeResults(input.enrollmentDetails, input.cohortParams).find(
				(row) => row.gradeLevel === '2NDE'
			);

			expect(result).toEqual({
				gradeLevel: '2NDE',
				effectiveRetained: 101,
				newTotal: 18,
				newByNationality: {
					Francais: 4,
					Nationaux: 1,
					Autres: 13,
				},
			});
		});

		it('clamps new students at zero when retained exceeds AY2 headcount for GS -> CP', () => {
			const input = selectRealScenario('GS', 'CP', 122);

			const result = deriveNewStudentGradeResults(input.enrollmentDetails, input.cohortParams).find(
				(row) => row.gradeLevel === 'CP'
			);

			expect(result).toEqual({
				gradeLevel: 'CP',
				effectiveRetained: 120,
				newTotal: 0,
				newByNationality: {
					Francais: 0,
					Nationaux: 0,
					Autres: 0,
				},
			});
		});
	});

	describe('computeAllDerivedRevenue', () => {
		it('returns all 14 canonical dynamic rows in canonical order with canonical metadata', () => {
			const result = computeAllDerivedRevenue({
				enrollmentDetails: buildSyntheticEnrollmentDetails(),
				feeGrids: buildSyntheticFeeGrid(),
				headcounts: buildSyntheticHeadcounts(),
				cohortParams: buildCohortParams({
					MS: 3,
					CP: 2,
					'6EME': 4,
				}),
				settings: DEFAULT_VERSION_REVENUE_SETTINGS,
			});

			expect(result.map((item) => item.lineItemName)).toEqual(
				CANONICAL_DYNAMIC_OTHER_REVENUE_ITEMS.map((item) => item.lineItemName)
			);

			expect(
				Object.fromEntries(result.map((item) => [item.lineItemName, item.annualAmount]))
			).toEqual({
				'DAI - Francais': '35000.0000',
				'DAI - Nationaux': '17400.0000',
				'DAI - Autres': '55000.0000',
				'DPI - Francais': '10000.0000',
				'DPI - Nationaux': '4000.0000',
				'DPI - Autres': '12000.0000',
				'Frais de Dossier - Francais': '5000.0000',
				'Frais de Dossier - Nationaux': '2000.0000',
				'Frais de Dossier - Autres': '6000.0000',
				BAC: '24000.0000',
				DNB: '6000.0000',
				EAF: '8800.0000',
				'Evaluation - Primaire': '400.0000',
				'Evaluation - College+Lycee': '600.0000',
			});

			for (const item of result) {
				const canonical = CANONICAL_DYNAMIC_OTHER_REVENUE_ITEMS.find(
					(candidate) => candidate.lineItemName === item.lineItemName
				);
				expect(item.distributionMethod).toBe(canonical?.distributionMethod);
				expect(item.specificMonths ?? null).toEqual(canonical?.specificMonths ?? null);
				expect(item.ifrsCategory).toBe(canonical?.ifrsCategory);
			}
		});
	});
});
