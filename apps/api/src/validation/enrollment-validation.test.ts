// Enrollment & Capacity Validation — tests FY2026 data against capacity engine
// Phase 2b+2c: Enrollment headcount, grade code mapping, capacity calculations

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	calculateCapacity,
	type GradeConfig,
	type CapacityInput,
} from '../services/capacity-engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURES = resolve(__dirname, '..', '..', '..', '..', 'data', 'fixtures');

// ── Fixture types ────────────────────────────────────────────────────────────

interface EnrollmentHeadcountFixture {
	academicYear: string;
	gradeLevel: string;
	headcount: number;
}

interface GradeCodeMappingFixture {
	excelCode: string;
	appCode: string;
	gradeName: string;
	band: string;
	feeBand: string;
}

interface EnrollmentDetailFixture {
	academicPeriod: 'AY1' | 'AY2';
	gradeLevel: string;
	nationality: string;
	tariff: string;
	headcount: number;
}

// ── Grade configs from seed-data.ts (expected after taxonomy alignment) ──────

const GRADE_CONFIGS: GradeConfig[] = [
	{ gradeCode: 'PS', maxClassSize: 28, plafondPct: 0.9 },
	{ gradeCode: 'MS', maxClassSize: 28, plafondPct: 0.9 },
	{ gradeCode: 'GS', maxClassSize: 28, plafondPct: 0.95 },
	{ gradeCode: 'CP', maxClassSize: 28, plafondPct: 0.95 },
	{ gradeCode: 'CE1', maxClassSize: 30, plafondPct: 0.95 },
	{ gradeCode: 'CE2', maxClassSize: 30, plafondPct: 0.95 },
	{ gradeCode: 'CM1', maxClassSize: 30, plafondPct: 0.95 },
	{ gradeCode: 'CM2', maxClassSize: 30, plafondPct: 0.95 },
	{ gradeCode: '6EME', maxClassSize: 30, plafondPct: 0.95 },
	{ gradeCode: '5EME', maxClassSize: 30, plafondPct: 0.95 },
	{ gradeCode: '4EME', maxClassSize: 30, plafondPct: 0.95 },
	{ gradeCode: '3EME', maxClassSize: 30, plafondPct: 0.95 },
	{ gradeCode: '2NDE', maxClassSize: 35, plafondPct: 1.0 },
	{ gradeCode: '1ERE', maxClassSize: 35, plafondPct: 1.0 },
	{ gradeCode: 'TERM', maxClassSize: 35, plafondPct: 1.0 },
];

function buildConfigMap(): Map<string, GradeConfig> {
	return new Map(GRADE_CONFIGS.map((c) => [c.gradeCode, c]));
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Enrollment & Capacity Validation — FY2026', () => {
	let gradeMapping: GradeCodeMappingFixture[];
	let enrollmentDetail: EnrollmentDetailFixture[];
	let enrollmentHeadcount: EnrollmentHeadcountFixture[] | null = null;

	beforeAll(() => {
		gradeMapping = JSON.parse(readFileSync(resolve(FIXTURES, 'grade-code-mapping.json'), 'utf-8'));
		enrollmentDetail = JSON.parse(
			readFileSync(resolve(FIXTURES, 'fy2026-enrollment-detail.json'), 'utf-8')
		);
		try {
			enrollmentHeadcount = JSON.parse(
				readFileSync(resolve(FIXTURES, 'fy2026-enrollment-headcount.json'), 'utf-8')
			);
		} catch {
			// Headcount fixture may not exist yet
		}
	});

	describe('Grade Code Mapping', () => {
		it('should have exactly 15 grade codes (no TPS)', () => {
			expect(gradeMapping).toHaveLength(15);
		});

		it('should NOT include TPS', () => {
			const codes = gradeMapping.map((g) => g.excelCode);
			expect(codes).not.toContain('TPS');
		});

		it('should have 1ERE and TERM as separate grades (not combined S1T)', () => {
			const codes = gradeMapping.map((g) => g.excelCode);
			expect(codes).toContain('1ERE');
			expect(codes).toContain('TERM');
			expect(codes).not.toContain('S1T');
		});

		it('should use the correct grade codes from Excel', () => {
			const expected = [
				'PS',
				'MS',
				'GS',
				'CP',
				'CE1',
				'CE2',
				'CM1',
				'CM2',
				'6EME',
				'5EME',
				'4EME',
				'3EME',
				'2NDE',
				'1ERE',
				'TERM',
			];
			const actual = gradeMapping.map((g) => g.excelCode);
			expect(actual).toEqual(expected);
		});

		it('should have correct band assignments', () => {
			const matGrades = gradeMapping.filter((g) => g.band === 'MATERNELLE');
			expect(matGrades.map((g) => g.excelCode)).toEqual(['PS', 'MS', 'GS']);

			const elemGrades = gradeMapping.filter((g) => g.band === 'ELEMENTAIRE');
			expect(elemGrades.map((g) => g.excelCode)).toEqual(['CP', 'CE1', 'CE2', 'CM1', 'CM2']);

			const collGrades = gradeMapping.filter((g) => g.band === 'COLLEGE');
			expect(collGrades.map((g) => g.excelCode)).toEqual(['6EME', '5EME', '4EME', '3EME']);

			const lycGrades = gradeMapping.filter((g) => g.band === 'LYCEE');
			expect(lycGrades.map((g) => g.excelCode)).toEqual(['2NDE', '1ERE', 'TERM']);
		});

		it('should have all mapped grade codes in the capacity config', () => {
			const configMap = buildConfigMap();
			for (const grade of gradeMapping) {
				expect(
					configMap.has(grade.excelCode),
					`Missing capacity config for ${grade.excelCode}`
				).toBe(true);
			}
		});
	});

	describe('Enrollment Detail Validation', () => {
		it('should have AY1 total of 1753 students', () => {
			const ay1Total = enrollmentDetail
				.filter((e) => e.academicPeriod === 'AY1')
				.reduce((sum, e) => sum + e.headcount, 0);
			expect(ay1Total).toBe(1753);
		});

		it('should have all 15 grades in AY1 data', () => {
			const ay1Grades = new Set(
				enrollmentDetail.filter((e) => e.academicPeriod === 'AY1').map((e) => e.gradeLevel)
			);
			expect(ay1Grades.size).toBe(15);
		});

		it('should have 3 nationality groups', () => {
			const nationalities = new Set(enrollmentDetail.map((e) => e.nationality));
			expect(nationalities).toEqual(new Set(['Francais', 'Nationaux', 'Autres']));
		});

		it('should have 3 tariff types', () => {
			const tariffs = new Set(enrollmentDetail.map((e) => e.tariff));
			expect(tariffs).toEqual(new Set(['Plein', 'RP', 'R3+']));
		});

		it('should match per-grade AY1 headcounts from Excel', () => {
			// Expected per-grade totals from real EFIR historical data
			const expected: Record<string, number> = {
				PS: 65,
				MS: 77,
				GS: 124,
				CP: 126,
				CE1: 118,
				CE2: 132,
				CM1: 121,
				CM2: 121,
				'6EME': 151,
				'5EME': 139,
				'4EME': 120,
				'3EME': 103,
				'2NDE': 125,
				'1ERE': 120,
				TERM: 111,
			};

			const ay1ByGrade: Record<string, number> = {};
			for (const e of enrollmentDetail) {
				if (e.academicPeriod !== 'AY1') continue;
				ay1ByGrade[e.gradeLevel] = (ay1ByGrade[e.gradeLevel] ?? 0) + e.headcount;
			}

			for (const [grade, expectedCount] of Object.entries(expected)) {
				expect(ay1ByGrade[grade], `Grade ${grade}: expected ${expectedCount}`).toBe(expectedCount);
			}
		});

		it('should have 1ERE (120) and TERM (111) as separate grades', () => {
			const ay1ByGrade: Record<string, number> = {};
			for (const e of enrollmentDetail) {
				if (e.academicPeriod !== 'AY1') continue;
				ay1ByGrade[e.gradeLevel] = (ay1ByGrade[e.gradeLevel] ?? 0) + e.headcount;
			}

			expect(ay1ByGrade['1ERE']).toBe(120);
			expect(ay1ByGrade['TERM']).toBe(111);
			// Verify S1T does not exist
			expect(ay1ByGrade['S1T']).toBeUndefined();
		});
	});

	describe('Capacity Calculation with FY2026 Data', () => {
		it('should calculate sections for all 15 grades', () => {
			const configMap = buildConfigMap();

			// Build capacity inputs from AY1 enrollment detail
			const headcountByGrade: Record<string, number> = {};
			for (const e of enrollmentDetail) {
				if (e.academicPeriod !== 'AY1') continue;
				headcountByGrade[e.gradeLevel] = (headcountByGrade[e.gradeLevel] ?? 0) + e.headcount;
			}

			const inputs: CapacityInput[] = Object.entries(headcountByGrade).map(
				([gradeLevel, headcount]) => ({
					gradeLevel,
					academicPeriod: 'AY1',
					headcount,
				})
			);

			const results = calculateCapacity(inputs, configMap);
			expect(results).toHaveLength(15);

			// Verify each grade has reasonable sections
			for (const r of results) {
				expect(r.sectionsNeeded).toBeGreaterThan(0);
				expect(r.utilization).toBeGreaterThan(0);
				expect(r.utilization).toBeLessThanOrEqual(100);
			}
		});

		it('should produce expected sections for known grades', () => {
			const configMap = buildConfigMap();

			// PS: 65 students, maxClassSize=28 → ceil(65/28) = 3 sections
			const psResult = calculateCapacity(
				[{ gradeLevel: 'PS', academicPeriod: 'AY1', headcount: 65 }],
				configMap
			);
			expect(psResult[0]!.sectionsNeeded).toBe(3);

			// 6EME: 151 students, maxClassSize=30 → ceil(151/30) = 6 sections
			const s6Result = calculateCapacity(
				[{ gradeLevel: '6EME', academicPeriod: 'AY1', headcount: 151 }],
				configMap
			);
			expect(s6Result[0]!.sectionsNeeded).toBe(6);

			// 2NDE: 125 students, maxClassSize=35 → ceil(125/35) = 4 sections
			const s2Result = calculateCapacity(
				[{ gradeLevel: '2NDE', academicPeriod: 'AY1', headcount: 125 }],
				configMap
			);
			expect(s2Result[0]!.sectionsNeeded).toBe(4);

			// TERM: 111 students, maxClassSize=35 → ceil(111/35) = 4 sections
			const termResult = calculateCapacity(
				[{ gradeLevel: 'TERM', academicPeriod: 'AY1', headcount: 111 }],
				configMap
			);
			expect(termResult[0]!.sectionsNeeded).toBe(4);
		});

		it('should compute minimum sections needed from enrollment', () => {
			const configMap = buildConfigMap();

			const headcountByGrade: Record<string, number> = {};
			for (const e of enrollmentDetail) {
				if (e.academicPeriod !== 'AY1') continue;
				headcountByGrade[e.gradeLevel] = (headcountByGrade[e.gradeLevel] ?? 0) + e.headcount;
			}

			const inputs: CapacityInput[] = Object.entries(headcountByGrade).map(
				([gradeLevel, headcount]) => ({
					gradeLevel,
					academicPeriod: 'AY1',
					headcount,
				})
			);

			const results = calculateCapacity(inputs, configMap);
			const totalSections = results.reduce((sum, r) => sum + r.sectionsNeeded, 0);

			// Engine computes MINIMUM sections: ceil(headcount/maxClassSize) = 66
			// Excel EXECUTIVE_SUMMARY shows PLANNED sections: 74
			// Difference of 8: schools open more sections than minimum for operational
			// reasons (mid-year intake buffer, pedagogical grouping, option splits).
			// This is an expected discrepancy — not a bug.
			expect(totalSections).toBe(66);
			expect(totalSections).toBeLessThan(74); // always fewer than planned
		});
	});

	describe('CSV Enrollment Headcount Validation', () => {
		it('should have enrollment headcount data from CSVs (if fixture exists)', () => {
			if (!enrollmentHeadcount) return;

			// Should have 5 years of data (2021-22 through 2025-26)
			const years = new Set(enrollmentHeadcount.map((e) => e.academicYear));
			expect(years.size).toBe(5);

			// Each year should have 15 grades (no TPS)
			for (const year of years) {
				const yearData = enrollmentHeadcount.filter((e) => e.academicYear === year);
				expect(yearData).toHaveLength(15);
			}
		});

		it('should use Excel-matching grade codes in CSV data', () => {
			if (!enrollmentHeadcount) return;

			const codes = new Set(enrollmentHeadcount.map((e) => e.gradeLevel));
			expect(codes).not.toContain('TPS');
			expect(codes).not.toContain('S6');
			expect(codes).not.toContain('S1T');
			expect(codes).toContain('6EME');
			expect(codes).toContain('1ERE');
			expect(codes).toContain('TERM');
		});

		it('should preserve total student count after mapping', () => {
			if (!enrollmentHeadcount) return;

			// 2025-26 CSV total: PS(65)+MS(77)+GS(124)+CP(126)+CE1(118)+CE2(132)
			// +CM1(121)+CM2(121)+6EME(151)+5EME(139)+4EME(120)+3EME(103)
			// +2NDE(125)+1ERE(120)+TERM(111) = 1753
			const fy2026 = enrollmentHeadcount.filter((e) => e.academicYear === '2025-26');
			const total = fy2026.reduce((sum, e) => sum + e.headcount, 0);
			expect(total).toBe(1753);
		});
	});
});
