import { describe, expect, it } from 'vitest';
import type { DhgRuleDetail } from '../hooks/use-master-data';
import {
	buildRuleIndex,
	computeCoverageGaps,
	computeCurriculumKpis,
	DISCIPLINE_DISPLAY_GROUPS,
	EXPECTED_COVERAGE,
	isExpectedCell,
	isGapCell,
} from './curriculum-coverage-map';

// ── Test Helpers ──────────────────────────────────────────────────────────────

function makeRule(
	overrides: Partial<DhgRuleDetail> & {
		gradeLevel: string;
		disciplineCode: string;
	}
): DhgRuleDetail {
	return {
		id: 1,
		disciplineId: 100,
		disciplineName: 'Test Discipline',
		lineType: 'STRUCTURAL',
		driverType: 'SECTION',
		hoursPerUnit: '1.50',
		serviceProfileId: 1,
		serviceProfileCode: 'ENS',
		serviceProfileName: 'Enseignant',
		languageCode: null,
		groupingKey: null,
		effectiveFromYear: 2025,
		effectiveToYear: null,
		updatedAt: '2026-01-01T00:00:00.000Z',
		...overrides,
	};
}

// ── buildRuleIndex ────────────────────────────────────────────────────────────

describe('buildRuleIndex', () => {
	it('creates correct composite keys from gradeLevel and disciplineCode', () => {
		const rules = [
			makeRule({ gradeLevel: '6EME', disciplineCode: 'FRANCAIS' }),
			makeRule({ gradeLevel: 'CP', disciplineCode: 'ARABE' }),
		];
		const index = buildRuleIndex(rules);

		expect(index.has('6EME::FRANCAIS')).toBe(true);
		expect(index.has('CP::ARABE')).toBe(true);
		expect(index.size).toBe(2);
	});

	it('groups multiple rules under the same key', () => {
		const rules = [
			makeRule({
				id: 1,
				gradeLevel: '1ERE',
				disciplineCode: 'MATHEMATIQUES',
				lineType: 'STRUCTURAL',
			}),
			makeRule({
				id: 2,
				gradeLevel: '1ERE',
				disciplineCode: 'MATHEMATIQUES',
				lineType: 'SPECIALTY',
			}),
		];
		const index = buildRuleIndex(rules);

		expect(index.size).toBe(1);
		const entries = index.get('1ERE::MATHEMATIQUES');
		expect(entries).toBeDefined();
		expect(entries).toHaveLength(2);
		expect(entries?.[0]?.lineType).toBe('STRUCTURAL');
		expect(entries?.[1]?.lineType).toBe('SPECIALTY');
	});

	it('returns an empty map for empty input', () => {
		const index = buildRuleIndex([]);
		expect(index.size).toBe(0);
	});

	it('handles single rule correctly', () => {
		const rules = [makeRule({ gradeLevel: 'TLE', disciplineCode: 'PHILOSOPHIE' })];
		const index = buildRuleIndex(rules);

		expect(index.size).toBe(1);
		expect(index.get('TLE::PHILOSOPHIE')).toHaveLength(1);
	});
});

// ── computeCoverageGaps ───────────────────────────────────────────────────────

describe('computeCoverageGaps', () => {
	const miniExpected = [
		{
			disciplineCode: 'FRANCAIS',
			gradeCodes: ['6EME', '5EME'],
			label: 'Francais',
		},
		{
			disciplineCode: 'MATHEMATIQUES',
			gradeCodes: ['6EME'],
			label: 'Mathematiques',
		},
	];

	it('returns all expected entries as gaps when no rules exist', () => {
		const gaps = computeCoverageGaps([], miniExpected);

		expect(gaps).toHaveLength(3); // 6EME+5EME for FRANCAIS, 6EME for MATHS
		expect(gaps).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					gradeCode: '6EME',
					disciplineCode: 'FRANCAIS',
				}),
				expect.objectContaining({
					gradeCode: '5EME',
					disciplineCode: 'FRANCAIS',
				}),
				expect.objectContaining({
					gradeCode: '6EME',
					disciplineCode: 'MATHEMATIQUES',
				}),
			])
		);
	});

	it('returns zero gaps when all expected entries have matching rules', () => {
		const rules = [
			makeRule({ gradeLevel: '6EME', disciplineCode: 'FRANCAIS' }),
			makeRule({ gradeLevel: '5EME', disciplineCode: 'FRANCAIS' }),
			makeRule({ gradeLevel: '6EME', disciplineCode: 'MATHEMATIQUES' }),
		];
		const gaps = computeCoverageGaps(rules, miniExpected);

		expect(gaps).toHaveLength(0);
	});

	it('correctly identifies partial gaps', () => {
		const rules = [
			makeRule({ gradeLevel: '6EME', disciplineCode: 'FRANCAIS' }),
			// Missing: 5EME FRANCAIS and 6EME MATHEMATIQUES
		];
		const gaps = computeCoverageGaps(rules, miniExpected);

		expect(gaps).toHaveLength(2);
		expect(gaps[0]).toMatchObject({
			gradeCode: '5EME',
			disciplineCode: 'FRANCAIS',
			label: 'Francais',
		});
		expect(gaps[1]).toMatchObject({
			gradeCode: '6EME',
			disciplineCode: 'MATHEMATIQUES',
			label: 'Mathematiques',
		});
	});

	it('handles specialty lineType matching', () => {
		const specialtyExpected = [
			{
				disciplineCode: 'MATHEMATIQUES',
				gradeCodes: ['1ERE'],
				label: 'Mathematiques',
			},
			{
				disciplineCode: 'MATHEMATIQUES',
				gradeCodes: ['1ERE'],
				lineType: 'SPECIALTY',
				label: 'Mathematiques (Specialite)',
			},
		];

		// Only a STRUCTURAL rule exists, not a SPECIALTY one
		const rules = [
			makeRule({
				gradeLevel: '1ERE',
				disciplineCode: 'MATHEMATIQUES',
				lineType: 'STRUCTURAL',
			}),
		];
		const gaps = computeCoverageGaps(rules, specialtyExpected);

		// The basic MATHEMATIQUES at 1ERE is covered (no lineType in entry,
		// so the basic key matches). The SPECIALTY entry is a gap because
		// the specific "1ERE::MATHEMATIQUES::SPECIALTY" key is not present.
		expect(gaps).toHaveLength(1);
		expect(gaps[0]).toMatchObject({
			gradeCode: '1ERE',
			disciplineCode: 'MATHEMATIQUES',
			lineType: 'SPECIALTY',
			label: 'Mathematiques (Specialite)',
		});
	});

	it('marks specialty as covered when SPECIALTY lineType rule exists', () => {
		const specialtyExpected = [
			{
				disciplineCode: 'MATHEMATIQUES',
				gradeCodes: ['1ERE'],
				lineType: 'SPECIALTY',
				label: 'Mathematiques (Specialite)',
			},
		];

		const rules = [
			makeRule({
				gradeLevel: '1ERE',
				disciplineCode: 'MATHEMATIQUES',
				lineType: 'SPECIALTY',
			}),
		];
		const gaps = computeCoverageGaps(rules, specialtyExpected);

		expect(gaps).toHaveLength(0);
	});

	it('includes lineType in gap objects when present in expected entry', () => {
		const expected = [
			{
				disciplineCode: 'SVT',
				gradeCodes: ['TLE'],
				lineType: 'SPECIALTY',
				label: 'SVT (Specialite)',
			},
		];
		const gaps = computeCoverageGaps([], expected);

		expect(gaps).toHaveLength(1);
		expect(gaps[0]?.lineType).toBe('SPECIALTY');
	});

	it('omits lineType from gap objects when not in expected entry', () => {
		const expected = [
			{
				disciplineCode: 'SVT',
				gradeCodes: ['6EME'],
				label: 'SVT',
			},
		];
		const gaps = computeCoverageGaps([], expected);

		expect(gaps).toHaveLength(1);
		expect(gaps[0]?.lineType).toBeUndefined();
	});
});

// ── computeCurriculumKpis ─────────────────────────────────────────────────────

describe('computeCurriculumKpis', () => {
	const gradeToBand = new Map<string, string>([
		['PS', 'MATERNELLE'],
		['MS', 'MATERNELLE'],
		['GS', 'MATERNELLE'],
		['CP', 'ELEMENTAIRE'],
		['CE1', 'ELEMENTAIRE'],
		['CE2', 'ELEMENTAIRE'],
		['CM1', 'ELEMENTAIRE'],
		['CM2', 'ELEMENTAIRE'],
		['6EME', 'COLLEGE'],
		['5EME', 'COLLEGE'],
		['4EME', 'COLLEGE'],
		['3EME', 'COLLEGE'],
		['2NDE', 'LYCEE'],
		['1ERE', 'LYCEE'],
		['TLE', 'LYCEE'],
	]);

	const miniExpected = [
		{
			disciplineCode: 'FRANCAIS',
			gradeCodes: ['6EME'],
			label: 'Francais',
		},
	];

	it('correctly sums hours by band', () => {
		const rules = [
			makeRule({
				gradeLevel: 'PS',
				disciplineCode: 'PRIMARY_HOMEROOM',
				hoursPerUnit: '4.50',
			}),
			makeRule({
				gradeLevel: 'MS',
				disciplineCode: 'PRIMARY_HOMEROOM',
				hoursPerUnit: '3.00',
			}),
			makeRule({
				gradeLevel: 'CP',
				disciplineCode: 'PRIMARY_HOMEROOM',
				hoursPerUnit: '2.00',
			}),
			makeRule({
				gradeLevel: '6EME',
				disciplineCode: 'FRANCAIS',
				hoursPerUnit: '4.50',
			}),
			makeRule({
				gradeLevel: '2NDE',
				disciplineCode: 'FRANCAIS',
				hoursPerUnit: '4.00',
			}),
		];

		const kpis = computeCurriculumKpis(rules, gradeToBand, miniExpected);

		expect(kpis.primaryHours.maternelle).toBe(7.5); // 4.50 + 3.00
		expect(kpis.primaryHours.elementaire).toBe(2.0);
		expect(kpis.secondaryHours.college).toBe(4.5);
		expect(kpis.secondaryHours.lycee).toBe(4.0);
	});

	it('handles parseFloat edge cases with string hours', () => {
		const rules = [
			makeRule({
				gradeLevel: '6EME',
				disciplineCode: 'FRANCAIS',
				hoursPerUnit: '0.75',
			}),
			makeRule({
				gradeLevel: '5EME',
				disciplineCode: 'FRANCAIS',
				hoursPerUnit: '1.25',
			}),
		];

		const kpis = computeCurriculumKpis(rules, gradeToBand, miniExpected);

		expect(kpis.secondaryHours.college).toBe(2.0);
	});

	it('treats non-numeric hoursPerUnit as zero', () => {
		const rules = [
			makeRule({
				gradeLevel: '6EME',
				disciplineCode: 'FRANCAIS',
				hoursPerUnit: 'invalid',
			}),
		];

		const kpis = computeCurriculumKpis(rules, gradeToBand, miniExpected);

		expect(kpis.secondaryHours.college).toBe(0);
	});

	it('returns correct discipline and grade level counts', () => {
		const rules = [
			makeRule({
				gradeLevel: '6EME',
				disciplineCode: 'FRANCAIS',
				hoursPerUnit: '4.50',
			}),
			makeRule({
				gradeLevel: '5EME',
				disciplineCode: 'FRANCAIS',
				hoursPerUnit: '4.50',
			}),
			makeRule({
				gradeLevel: '6EME',
				disciplineCode: 'MATHEMATIQUES',
				hoursPerUnit: '4.00',
			}),
		];

		const kpis = computeCurriculumKpis(rules, gradeToBand, miniExpected);

		expect(kpis.totalRules).toBe(3);
		expect(kpis.disciplineCount).toBe(2); // FRANCAIS, MATHEMATIQUES
		expect(kpis.gradeLevelCount).toBe(2); // 6EME, 5EME
	});

	it('computes gap count against expected coverage', () => {
		const expected = [
			{
				disciplineCode: 'FRANCAIS',
				gradeCodes: ['6EME', '5EME', '4EME'],
				label: 'Francais',
			},
		];
		const rules = [
			makeRule({
				gradeLevel: '6EME',
				disciplineCode: 'FRANCAIS',
				hoursPerUnit: '4.50',
			}),
		];

		const kpis = computeCurriculumKpis(rules, gradeToBand, expected);

		expect(kpis.gapCount).toBe(2); // 5EME and 4EME missing
	});

	it('returns all zeros for empty rules', () => {
		const kpis = computeCurriculumKpis([], gradeToBand, []);

		expect(kpis.totalRules).toBe(0);
		expect(kpis.disciplineCount).toBe(0);
		expect(kpis.gradeLevelCount).toBe(0);
		expect(kpis.primaryHours.maternelle).toBe(0);
		expect(kpis.primaryHours.elementaire).toBe(0);
		expect(kpis.secondaryHours.college).toBe(0);
		expect(kpis.secondaryHours.lycee).toBe(0);
		expect(kpis.gapCount).toBe(0);
	});

	it('ignores grades not found in gradeToBand map', () => {
		const rules = [
			makeRule({
				gradeLevel: 'UNKNOWN',
				disciplineCode: 'FRANCAIS',
				hoursPerUnit: '5.00',
			}),
		];

		const kpis = computeCurriculumKpis(rules, gradeToBand, miniExpected);

		// Hours not added to any band
		expect(kpis.primaryHours.maternelle).toBe(0);
		expect(kpis.primaryHours.elementaire).toBe(0);
		expect(kpis.secondaryHours.college).toBe(0);
		expect(kpis.secondaryHours.lycee).toBe(0);
		// But still counted in totals
		expect(kpis.totalRules).toBe(1);
		expect(kpis.gradeLevelCount).toBe(1);
	});
});

// ── isExpectedCell ────────────────────────────────────────────────────────────

describe('isExpectedCell', () => {
	const miniExpected = [
		{
			disciplineCode: 'FRANCAIS',
			gradeCodes: ['6EME', '5EME'],
			label: 'Francais',
		},
		{
			disciplineCode: 'EPS',
			gradeCodes: ['6EME'],
			label: 'EPS',
		},
	];

	it('returns true for an expected combination', () => {
		expect(isExpectedCell('6EME', 'FRANCAIS', miniExpected)).toBe(true);
		expect(isExpectedCell('5EME', 'FRANCAIS', miniExpected)).toBe(true);
		expect(isExpectedCell('6EME', 'EPS', miniExpected)).toBe(true);
	});

	it('returns false for an unexpected grade', () => {
		expect(isExpectedCell('TLE', 'FRANCAIS', miniExpected)).toBe(false);
	});

	it('returns false for an unexpected discipline', () => {
		expect(isExpectedCell('6EME', 'PHILOSOPHIE', miniExpected)).toBe(false);
	});

	it('returns false for completely unrelated combination', () => {
		expect(isExpectedCell('PS', 'TECHNOLOGIE', miniExpected)).toBe(false);
	});
});

// ── isGapCell ─────────────────────────────────────────────────────────────────

describe('isGapCell', () => {
	const miniExpected = [
		{
			disciplineCode: 'FRANCAIS',
			gradeCodes: ['6EME', '5EME'],
			label: 'Francais',
		},
	];

	it('returns true when cell is expected but no rule exists', () => {
		const index = buildRuleIndex([]);

		expect(isGapCell('6EME', 'FRANCAIS', index, miniExpected)).toBe(true);
	});

	it('returns false when a rule exists for the cell', () => {
		const rules = [makeRule({ gradeLevel: '6EME', disciplineCode: 'FRANCAIS' })];
		const index = buildRuleIndex(rules);

		expect(isGapCell('6EME', 'FRANCAIS', index, miniExpected)).toBe(false);
	});

	it('returns false when cell is not expected (even without rules)', () => {
		const index = buildRuleIndex([]);

		expect(isGapCell('TLE', 'FRANCAIS', index, miniExpected)).toBe(false);
	});

	it('returns false for unexpected discipline without rules', () => {
		const index = buildRuleIndex([]);

		expect(isGapCell('6EME', 'PHILOSOPHIE', index, miniExpected)).toBe(false);
	});

	it('distinguishes gap and covered cells in the same discipline', () => {
		const rules = [makeRule({ gradeLevel: '6EME', disciplineCode: 'FRANCAIS' })];
		const index = buildRuleIndex(rules);

		// 6EME is covered
		expect(isGapCell('6EME', 'FRANCAIS', index, miniExpected)).toBe(false);
		// 5EME is a gap (expected but no rule)
		expect(isGapCell('5EME', 'FRANCAIS', index, miniExpected)).toBe(true);
	});
});

// ── Constants integrity ───────────────────────────────────────────────────────

describe('EXPECTED_COVERAGE', () => {
	it('has entries for all major discipline groups', () => {
		const codes = EXPECTED_COVERAGE.map((e) => e.disciplineCode);

		expect(codes).toContain('PRIMARY_HOMEROOM');
		expect(codes).toContain('ARABE');
		expect(codes).toContain('FRANCAIS');
		expect(codes).toContain('MATHEMATIQUES');
		expect(codes).toContain('SVT');
		expect(codes).toContain('PHILOSOPHIE');
		expect(codes).toContain('AUTONOMY');
	});

	it('every entry has a non-empty label and at least one grade', () => {
		for (const entry of EXPECTED_COVERAGE) {
			expect(entry.label.length).toBeGreaterThan(0);
			expect(entry.gradeCodes.length).toBeGreaterThan(0);
		}
	});

	it('has specialty entries for lycee disciplines', () => {
		const specialties = EXPECTED_COVERAGE.filter((e) => e.lineType === 'SPECIALTY');

		expect(specialties.length).toBeGreaterThan(0);
		for (const s of specialties) {
			// All specialties should be 1ERE and/or TLE
			for (const grade of s.gradeCodes) {
				expect(['1ERE', 'TLE']).toContain(grade);
			}
		}
	});
});

describe('DISCIPLINE_DISPLAY_GROUPS', () => {
	it('has unique group keys', () => {
		const keys = DISCIPLINE_DISPLAY_GROUPS.map((g) => g.key);
		expect(new Set(keys).size).toBe(keys.length);
	});

	it('covers all discipline codes from EXPECTED_COVERAGE', () => {
		const allGroupCodes = new Set(DISCIPLINE_DISPLAY_GROUPS.flatMap((g) => g.disciplineCodes));
		const allExpectedCodes = new Set(EXPECTED_COVERAGE.map((e) => e.disciplineCode));

		for (const code of allExpectedCodes) {
			expect(allGroupCodes.has(code)).toBe(true);
		}
	});

	it('every group has at least one discipline code', () => {
		for (const group of DISCIPLINE_DISPLAY_GROUPS) {
			expect(group.disciplineCodes.length).toBeGreaterThan(0);
		}
	});
});
