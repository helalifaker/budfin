import { describe, it, expect } from 'vitest';
import type { FeeGridEntry, RevenueSettings } from '@budfin/types';
import { buildFeeSchedule, TUITION_BANDS } from './fee-schedule-builder';
import { writebackFeeScheduleEdit } from './fee-schedule-writeback';

// ── Test helpers ────────────────────────────────────────────────────────────

function makeFeeEntry(overrides: Partial<FeeGridEntry> = {}): FeeGridEntry {
	return {
		academicPeriod: 'AY1',
		gradeLevel: 'PS',
		nationality: 'Francais',
		tariff: 'Plein',
		dai: '5000.0000',
		tuitionTtc: '46000.0000',
		tuitionHt: '40000.0000',
		term1Amount: '15333.3333',
		term2Amount: '15333.3333',
		term3Amount: '15333.3334',
		...overrides,
	};
}

/**
 * Generate a minimal complete fee grid for all grades, nationalities, and tariffs.
 * Uses the same values for all entries by default, so band aggregation yields clean results.
 */
function makeFullFeeGrid(): FeeGridEntry[] {
	const grades = TUITION_BANDS.flatMap((b) => b.grades);
	const nationalities = ['Francais', 'Nationaux', 'Autres'] as const;
	const tariffs = ['Plein', 'RP', 'R3+'] as const;

	return grades.flatMap((gradeLevel) =>
		nationalities.flatMap((nationality) =>
			tariffs.map((tariff) => makeFeeEntry({ gradeLevel, nationality, tariff }))
		)
	);
}

function makeRevenueSettings(): RevenueSettings {
	return {
		dossierPerStudentHt: '500.0000',
		dpiPerStudentHt: '1200.0000',
		examBacPerStudent: '0.0000',
		examDnbPerStudent: '0.0000',
		examEafPerStudent: '0.0000',
		evalPrimairePerStudent: '350.0000',
		evalSecondairePerStudent: '450.0000',
		flatDiscountPct: '0.000000',
	};
}

function makePriorYearEntries(): FeeGridEntry[] {
	const grades = TUITION_BANDS.flatMap((b) => b.grades);
	const nationalities = ['Francais', 'Nationaux', 'Autres'] as const;

	return grades.flatMap((gradeLevel) =>
		nationalities.map((nationality) =>
			makeFeeEntry({
				gradeLevel,
				nationality,
				tariff: 'Plein',
				tuitionTtc: '44000.0000',
				tuitionHt: '38260.8696',
			})
		)
	);
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('buildFeeSchedule', () => {
	it('returns 2 sections from a complete fee grid', () => {
		const entries = makeFullFeeGrid();
		const sections = buildFeeSchedule(entries);

		expect(sections).toHaveLength(2);
		expect(sections[0]!.id).toBe('tuition');
		expect(sections[0]!.title).toContain('Tuition');
		expect(sections[1]!.id).toBe('per-student-fees');
	});

	it('creates 3 nationality groups in the tuition section', () => {
		const entries = makeFullFeeGrid();
		const sections = buildFeeSchedule(entries);
		const tuition = sections[0]!;

		expect(tuition.groups).toHaveLength(3);
		expect(tuition.groups!.map((g) => g.nationality)).toEqual(['Francais', 'Nationaux', 'Autres']);
	});

	it('creates 5 band rows per nationality group', () => {
		const entries = makeFullFeeGrid();
		const sections = buildFeeSchedule(entries);
		const tuition = sections[0]!;

		for (const group of tuition.groups!) {
			expect(group.rows).toHaveLength(5);
			expect(group.rows.map((r) => r.label)).toEqual([
				'PS',
				'MS + GS',
				'Elementaire',
				'College',
				'Lycee',
			]);
		}
	});

	it('marks PS row as editable-source (single grade)', () => {
		const entries = makeFullFeeGrid();
		const sections = buildFeeSchedule(entries);
		const francaisGroup = sections[0]!.groups![0]!;
		const psRow = francaisGroup.rows[0]!;

		expect(psRow.editability).toBe('editable-source');
		expect(psRow.underlyingGradeCount).toBe(1);
	});

	it('marks multi-grade bands as editable-fanout', () => {
		const entries = makeFullFeeGrid();
		const sections = buildFeeSchedule(entries);
		const francaisGroup = sections[0]!.groups![0]!;

		const msGsRow = francaisGroup.rows[1]!;
		expect(msGsRow.editability).toBe('editable-fanout');
		expect(msGsRow.underlyingGradeCount).toBe(2);

		const elemRow = francaisGroup.rows[2]!;
		expect(elemRow.editability).toBe('editable-fanout');
		expect(elemRow.underlyingGradeCount).toBe(5);

		const collegeRow = francaisGroup.rows[3]!;
		expect(collegeRow.editability).toBe('editable-fanout');
		expect(collegeRow.underlyingGradeCount).toBe(4);

		const lyceeRow = francaisGroup.rows[4]!;
		expect(lyceeRow.editability).toBe('editable-fanout');
		expect(lyceeRow.underlyingGradeCount).toBe(3);
	});

	it('includes tuitionTtc on each band row', () => {
		const entries = makeFullFeeGrid();
		const sections = buildFeeSchedule(entries);
		const psRow = sections[0]!.groups![0]!.rows[0]!;

		expect(psRow.tuitionTtc).toBe('46000.0000');
	});

	it('computes totalTtc as dai + tuitionTtc', () => {
		const entries = makeFullFeeGrid();
		const sections = buildFeeSchedule(entries);
		const psRow = sections[0]!.groups![0]!.rows[0]!;

		expect(psRow.totalTtc).toBe('51000.0000');
	});

	it('preserves monetary values via Decimal.js (no float precision loss)', () => {
		const entries = [
			makeFeeEntry({
				gradeLevel: 'PS',
				nationality: 'Francais',
				tariff: 'Plein',
				tuitionHt: '40000.1234',
			}),
		];
		const sections = buildFeeSchedule(entries);
		const psRow = sections[0]!.groups![0]!.rows[0]!;

		expect(psRow.tuitionHt).toBe('40000.1234');
	});

	it('detects heterogeneous values when underlying grades differ', () => {
		const entries = makeFullFeeGrid();

		const msEntry = entries.find(
			(e) => e.gradeLevel === 'MS' && e.nationality === 'Francais' && e.tariff === 'Plein'
		)!;
		msEntry.tuitionTtc = '42000.0000';

		const gsEntry = entries.find(
			(e) => e.gradeLevel === 'GS' && e.nationality === 'Francais' && e.tariff === 'Plein'
		)!;
		gsEntry.tuitionTtc = '48000.0000';

		const sections = buildFeeSchedule(entries);
		const msGsRow = sections[0]!.groups![0]!.rows[1]!;

		expect(msGsRow.hasHeterogeneousValues).toBe(true);
	});

	it('reports homogeneous when all underlying grades match', () => {
		const entries = makeFullFeeGrid();
		const sections = buildFeeSchedule(entries);
		const elemRow = sections[0]!.groups![0]!.rows[2]!;

		expect(elemRow.hasHeterogeneousValues).toBe(false);
	});

	it('computes averages correctly for heterogeneous band values', () => {
		const entries = [
			makeFeeEntry({
				gradeLevel: 'MS',
				nationality: 'Francais',
				tariff: 'Plein',
				tuitionTtc: '30000.0000',
			}),
			makeFeeEntry({
				gradeLevel: 'GS',
				nationality: 'Francais',
				tariff: 'Plein',
				tuitionTtc: '40000.0000',
			}),
		];

		const sections = buildFeeSchedule(entries);
		const msGsRow = sections[0]!.groups![0]!.rows[1]!;

		expect(msGsRow.tuitionTtc).toBe('35000.0000');
	});

	it('builds per-student fees section with 7 rows', () => {
		const entries = makeFullFeeGrid();
		const sections = buildFeeSchedule({
			entries,
			settings: makeRevenueSettings(),
		});
		const perStudentFees = sections[1]!;

		expect(perStudentFees.rows).toHaveLength(7);
		const dossierRow = perStudentFees.rows![0]!;
		expect(dossierRow.label).toBe('Frais de Dossier');
		expect(dossierRow.tuitionHt).toBe('500.0000');
	});

	it('handles empty entries gracefully', () => {
		const sections = buildFeeSchedule([]);

		expect(sections).toHaveLength(2);
		expect(sections[0]!.groups).toHaveLength(3);
		for (const group of sections[0]!.groups!) {
			expect(group.rows).toHaveLength(5);
			expect(group.rows.every((r) => r.dai === '0.0000')).toBe(true);
		}
	});

	it('includes priorYearTtc when prior-year entries are provided', () => {
		const entries = makeFullFeeGrid();
		const priorYearEntries = makePriorYearEntries();

		const sections = buildFeeSchedule({
			entries,
			settings: null,
			priorYearEntries,
		});

		const psRow = sections[0]!.groups![0]!.rows[0]!;
		expect(psRow.priorYearTtc).toBe('44000.0000');
	});

	it('computes increasePct from current vs prior-year tuitionTtc', () => {
		const entries = makeFullFeeGrid();
		const priorYearEntries = makePriorYearEntries();

		const sections = buildFeeSchedule({
			entries,
			settings: null,
			priorYearEntries,
		});

		const psRow = sections[0]!.groups![0]!.rows[0]!;
		// (46000 - 44000) / 44000 * 100 = 4.5454...%
		expect(psRow.increasePct).toBe('4.55');
	});

	it('omits priorYearTtc when no prior-year entries exist', () => {
		const entries = makeFullFeeGrid();
		const sections = buildFeeSchedule({
			entries,
			settings: null,
		});

		const psRow = sections[0]!.groups![0]!.rows[0]!;
		expect(psRow.priorYearTtc).toBeUndefined();
		expect(psRow.increasePct).toBeUndefined();
	});

	it('omits increasePct when prior-year tuitionTtc is zero', () => {
		const entries = makeFullFeeGrid();
		const priorYearEntries = makePriorYearEntries().map((e) => ({
			...e,
			tuitionTtc: '0.0000',
		}));

		const sections = buildFeeSchedule({
			entries,
			settings: null,
			priorYearEntries,
		});

		const psRow = sections[0]!.groups![0]!.rows[0]!;
		expect(psRow.priorYearTtc).toBe('0.0000');
		expect(psRow.increasePct).toBeUndefined();
	});
});

describe('writebackFeeScheduleEdit', () => {
	it('applies editable-source edit to the single matching entry', () => {
		const entries = makeFullFeeGrid();
		const sections = buildFeeSchedule(entries);
		const psRow = sections[0]!.groups![0]!.rows[0]!;

		const updated = writebackFeeScheduleEdit(entries, psRow, 'dai', '6000.0000');

		const updatedPs = updated.find(
			(e) => e.gradeLevel === 'PS' && e.nationality === 'Francais' && e.tariff === 'Plein'
		)!;
		expect(updatedPs.dai).toBe('6000.0000');

		const otherEntry = updated.find(
			(e) => e.gradeLevel === 'MS' && e.nationality === 'Francais' && e.tariff === 'Plein'
		)!;
		expect(otherEntry.dai).toBe('5000.0000');
	});

	it('applies editable-fanout edit to ALL underlying grade entries', () => {
		const entries = makeFullFeeGrid();
		const sections = buildFeeSchedule(entries);
		const elemRow = sections[0]!.groups![0]!.rows[2]!;

		const updated = writebackFeeScheduleEdit(entries, elemRow, 'tuitionHt', '42000.0000');

		const elemGrades = ['CP', 'CE1', 'CE2', 'CM1', 'CM2'];
		for (const grade of elemGrades) {
			const entry = updated.find(
				(e) => e.gradeLevel === grade && e.nationality === 'Francais' && e.tariff === 'Plein'
			)!;
			expect(entry.tuitionHt).toBe('42000.0000');
		}
	});

	it('does not modify non-Plein tariff entries', () => {
		const entries = makeFullFeeGrid();
		const sections = buildFeeSchedule(entries);
		const psRow = sections[0]!.groups![0]!.rows[0]!;

		const updated = writebackFeeScheduleEdit(entries, psRow, 'dai', '9999.0000');

		const rpEntry = updated.find(
			(e) => e.gradeLevel === 'PS' && e.nationality === 'Francais' && e.tariff === 'RP'
		)!;
		expect(rpEntry.dai).toBe('5000.0000');
	});

	it('throws on summary-only row edit', () => {
		const entries: FeeGridEntry[] = [];
		const sections = buildFeeSchedule(entries);
		const emptyRow = sections[0]!.groups![0]!.rows![0]!;

		expect(() => writebackFeeScheduleEdit(entries, emptyRow, 'tuitionHt', '1000.0000')).toThrow(
			'summary-only'
		);
	});

	it('throws on unknown field', () => {
		const entries = makeFullFeeGrid();
		const sections = buildFeeSchedule(entries);
		const psRow = sections[0]!.groups![0]!.rows[0]!;

		expect(() => writebackFeeScheduleEdit(entries, psRow, 'nonExistentField', '1000.0000')).toThrow(
			'Unknown fee schedule field'
		);
	});

	it('auto-derives tuitionHt and terms when tuitionTtc is edited', () => {
		const entries = makeFullFeeGrid();
		const sections = buildFeeSchedule(entries);
		const psRow = sections[0]!.groups![0]!.rows[0]!;

		const updated = writebackFeeScheduleEdit(entries, psRow, 'tuitionTtc', '50000.0000');

		const updatedPs = updated.find(
			(e) => e.gradeLevel === 'PS' && e.nationality === 'Francais' && e.tariff === 'Plein'
		)!;

		expect(updatedPs.tuitionTtc).toBe('50000.0000');
		// tuitionHt = 50000 / 1.15 = 43478.2609 (rounded to 4 dp)
		expect(updatedPs.tuitionHt).toBe('43478.2609');
		// term1 = 50000 * 0.40 = 20000
		expect(updatedPs.term1Amount).toBe('20000.0000');
		// term2 = 50000 * 0.30 = 15000
		expect(updatedPs.term2Amount).toBe('15000.0000');
		// term3 = 50000 - 20000 - 15000 = 15000
		expect(updatedPs.term3Amount).toBe('15000.0000');
	});

	it('auto-derives tuitionHt without VAT for Nationaux', () => {
		const entries = makeFullFeeGrid();
		const sections = buildFeeSchedule(entries);
		const natRow = sections[0]!.groups![1]!.rows[0]!; // Nationaux PS

		const updated = writebackFeeScheduleEdit(entries, natRow, 'tuitionTtc', '50000.0000');

		const updatedPs = updated.find(
			(e) => e.gradeLevel === 'PS' && e.nationality === 'Nationaux' && e.tariff === 'Plein'
		)!;

		// Nationaux: 0% VAT, so tuitionHt = tuitionTtc
		expect(updatedPs.tuitionHt).toBe('50000.0000');
	});

	it('does not modify entries for other nationalities', () => {
		const entries = makeFullFeeGrid();
		const sections = buildFeeSchedule(entries);
		const francaisElem = sections[0]!.groups![0]!.rows[2]!;

		const updated = writebackFeeScheduleEdit(entries, francaisElem, 'tuitionTtc', '99999.0000');

		const natEntry = updated.find(
			(e) => e.gradeLevel === 'CP' && e.nationality === 'Nationaux' && e.tariff === 'Plein'
		)!;
		expect(natEntry.tuitionTtc).toBe('46000.0000');
	});
});
