import { describe, it, expect } from 'vitest';
import type { FeeGridEntry } from '@budfin/types';
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

// ── Tests ───────────────────────────────────────────────────────────────────

describe('buildFeeSchedule', () => {
	it('returns 3 sections from a complete fee grid', () => {
		const entries = makeFullFeeGrid();
		const sections = buildFeeSchedule(entries);

		expect(sections).toHaveLength(3);
		expect(sections[0]!.id).toBe('tuition');
		expect(sections[0]!.title).toContain('Tuition');
		expect(sections[1]!.id).toBe('autres-frais');
		expect(sections[2]!.id).toBe('abattement');
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

		// Make MS and GS have different tuition values for Francais
		const msEntry = entries.find(
			(e) => e.gradeLevel === 'MS' && e.nationality === 'Francais' && e.tariff === 'Plein'
		)!;
		msEntry.tuitionHt = '35000.0000';

		const gsEntry = entries.find(
			(e) => e.gradeLevel === 'GS' && e.nationality === 'Francais' && e.tariff === 'Plein'
		)!;
		gsEntry.tuitionHt = '38000.0000';

		const sections = buildFeeSchedule(entries);
		const msGsRow = sections[0]!.groups![0]!.rows[1]!;

		expect(msGsRow.hasHeterogeneousValues).toBe(true);
	});

	it('reports homogeneous when all underlying grades match', () => {
		const entries = makeFullFeeGrid();
		// All entries share the same values by default
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
				tuitionHt: '30000.0000',
			}),
			makeFeeEntry({
				gradeLevel: 'GS',
				nationality: 'Francais',
				tariff: 'Plein',
				tuitionHt: '40000.0000',
			}),
		];

		const sections = buildFeeSchedule(entries);
		const msGsRow = sections[0]!.groups![0]!.rows[1]!;

		expect(msGsRow.tuitionHt).toBe('35000.0000');
	});

	it('builds autres frais section with per-nationality DAI columns', () => {
		const entries = makeFullFeeGrid();
		const sections = buildFeeSchedule(entries);
		const autresFrais = sections[1]!;

		expect(autresFrais.rows).toHaveLength(5);
		const psRow = autresFrais.rows![0]! as Record<string, unknown>;
		expect(psRow.dai_Francais).toBe('5000.0000');
		expect(psRow.dai_Nationaux).toBe('5000.0000');
		expect(psRow.dai_Autres).toBe('5000.0000');
	});

	it('builds abattement section with tariff-specific rows', () => {
		const entries = makeFullFeeGrid();
		const sections = buildFeeSchedule(entries);
		const abattement = sections[2]!;

		// 5 bands x up to 3 tariffs = up to 15 rows
		expect(abattement.rows!.length).toBeGreaterThan(0);
		expect(abattement.rows!.every((r) => r.editability === 'summary-only')).toBe(true);
	});

	it('handles empty entries gracefully', () => {
		const sections = buildFeeSchedule([]);

		expect(sections).toHaveLength(3);
		expect(sections[0]!.groups).toHaveLength(3);
		// Each nationality group should have 5 band rows (all with zero values)
		for (const group of sections[0]!.groups!) {
			expect(group.rows).toHaveLength(5);
			expect(group.rows.every((r) => r.dai === '0')).toBe(true);
		}
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

		// Other entries unchanged
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
		const entries = makeFullFeeGrid();
		const sections = buildFeeSchedule(entries);
		const abattementRow = sections[2]!.rows![0]!;

		expect(() =>
			writebackFeeScheduleEdit(entries, abattementRow, 'tuitionHt', '1000.0000')
		).toThrow('summary-only');
	});

	it('throws on unknown field', () => {
		const entries = makeFullFeeGrid();
		const sections = buildFeeSchedule(entries);
		const psRow = sections[0]!.groups![0]!.rows[0]!;

		expect(() => writebackFeeScheduleEdit(entries, psRow, 'nonExistentField', '1000.0000')).toThrow(
			'Unknown fee schedule field'
		);
	});

	it('round-trip: transform -> edit -> writeback preserves Decimal exactness', () => {
		const entries = makeFullFeeGrid();
		const sections = buildFeeSchedule(entries);
		const elemRow = sections[0]!.groups![1]!.rows[2]!; // Nationaux Elementaire

		// Edit term1 to a value with 4 decimal places
		const newValue = '12345.6789';
		const updated = writebackFeeScheduleEdit(entries, elemRow, 'term1', newValue);

		// Rebuild the schedule from the updated entries
		const rebuiltSections = buildFeeSchedule(updated);
		const rebuiltRow = rebuiltSections[0]!.groups![1]!.rows[2]!;

		// The term1 value should be exactly what we set (homogeneous, so avg = value)
		expect(rebuiltRow.term1).toBe(newValue);
	});

	it('does not modify entries for other nationalities', () => {
		const entries = makeFullFeeGrid();
		const sections = buildFeeSchedule(entries);
		const francaisElem = sections[0]!.groups![0]!.rows[2]!;

		const updated = writebackFeeScheduleEdit(entries, francaisElem, 'tuitionHt', '99999.0000');

		// Nationaux Elementaire entries should be unchanged
		const natEntry = updated.find(
			(e) => e.gradeLevel === 'CP' && e.nationality === 'Nationaux' && e.tariff === 'Plein'
		)!;
		expect(natEntry.tuitionHt).toBe('40000.0000');
	});
});
