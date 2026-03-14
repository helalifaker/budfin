import Decimal from 'decimal.js';
import type {
	FeeGridEntry,
	FeeScheduleGroup,
	FeeScheduleRow,
	FeeScheduleSection,
} from '@budfin/types';

// ── Band definitions ────────────────────────────────────────────────────────
// EFIR fee bands group individual grades into pricing tiers.
// PS is standalone; MS+GS share a rate; the rest share within their cycle.

interface BandDef {
	id: string;
	label: string;
	grades: string[];
}

const TUITION_BANDS: BandDef[] = [
	{ id: 'PS', label: 'PS', grades: ['PS'] },
	{ id: 'MS_GS', label: 'MS + GS', grades: ['MS', 'GS'] },
	{ id: 'ELEM', label: 'Elementaire', grades: ['CP', 'CE1', 'CE2', 'CM1', 'CM2'] },
	{ id: 'COLLEGE', label: 'College', grades: ['6EME', '5EME', '4EME', '3EME'] },
	{ id: 'LYCEE', label: 'Lycee', grades: ['2NDE', '1ERE', 'TERM'] },
];

const NATIONALITIES: Array<{ code: string; label: string }> = [
	{ code: 'Francais', label: 'Francais' },
	{ code: 'Nationaux', label: 'Nationaux' },
	{ code: 'Autres', label: 'Autres' },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function decimalAvg(values: string[]): string {
	if (values.length === 0) return '0';
	const sum = values.reduce((acc, v) => acc.plus(new Decimal(v)), new Decimal(0));
	return sum.div(values.length).toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4);
}

function allEqual(values: string[]): boolean {
	if (values.length <= 1) return true;
	const first = new Decimal(values[0]!).toFixed(4);
	return values.every((v) => new Decimal(v).toFixed(4) === first);
}

type NumericField = 'dai' | 'tuitionHt' | 'term1Amount' | 'term2Amount' | 'term3Amount';
const NUMERIC_FIELDS: NumericField[] = [
	'dai',
	'tuitionHt',
	'term1Amount',
	'term2Amount',
	'term3Amount',
];

function hasHeterogeneous(entries: FeeGridEntry[], fields: NumericField[]): boolean {
	return fields.some((field) => {
		const values = entries.map((e) => e[field]);
		return !allEqual(values);
	});
}

// ── Builder ─────────────────────────────────────────────────────────────────

/**
 * Build tuition section rows for a single nationality / band combo.
 * Returns a single row representing the aggregated band values.
 */
function buildBandRow(
	band: BandDef,
	entries: FeeGridEntry[],
	nationality: string,
	tariff: 'Plein'
): FeeScheduleRow {
	const matching = entries.filter(
		(e) =>
			band.grades.includes(e.gradeLevel) && e.nationality === nationality && e.tariff === tariff
	);

	const isSingle = band.grades.length === 1;
	const editability = isSingle ? 'editable-source' : 'editable-fanout';
	const heterogeneous = matching.length > 1 ? hasHeterogeneous(matching, NUMERIC_FIELDS) : false;

	// Use average of matching entries for display; for homogeneous, this equals the shared value
	const dai = matching.length > 0 ? decimalAvg(matching.map((e) => e.dai)) : '0';
	const tuitionHt = matching.length > 0 ? decimalAvg(matching.map((e) => e.tuitionHt)) : '0';
	const term1 = matching.length > 0 ? decimalAvg(matching.map((e) => e.term1Amount)) : '0';
	const term2 = matching.length > 0 ? decimalAvg(matching.map((e) => e.term2Amount)) : '0';
	const term3 = matching.length > 0 ? decimalAvg(matching.map((e) => e.term3Amount)) : '0';

	// totalTtc = sum of tuitionTtc across matching entries (average per student)
	const totalTtc = matching.length > 0 ? decimalAvg(matching.map((e) => e.tuitionTtc)) : '0';

	return {
		id: `tuition-${nationality}-${band.id}`,
		label: band.label,
		editability,
		dai,
		tuitionHt,
		term1,
		term2,
		term3,
		totalTtc,
		underlyingGradeCount: band.grades.length,
		hasHeterogeneousValues: heterogeneous,
	};
}

/**
 * Build Section 1: Tuition Fees.
 * Groups rows by nationality, each group containing one row per fee band.
 */
function buildTuitionSection(entries: FeeGridEntry[]): FeeScheduleSection {
	// Filter to Plein tariff only for tuition display (RP and R3+ are in the abattement section)
	const pleinEntries = entries.filter((e) => e.tariff === 'Plein');

	const groups: FeeScheduleGroup[] = NATIONALITIES.map((nat) => ({
		nationality: nat.code,
		nationalityLabel: nat.label,
		rows: TUITION_BANDS.map((band) => buildBandRow(band, pleinEntries, nat.code, 'Plein')),
	}));

	return {
		id: 'tuition',
		title: 'Droits de Scolarite (Tuition Fees)',
		groups,
	};
}

/**
 * Build Section 2: Autres Frais (Other Fees).
 * DAI fees shown per nationality per band.
 */
function buildAutresFraisSection(entries: FeeGridEntry[]): FeeScheduleSection {
	const pleinEntries = entries.filter((e) => e.tariff === 'Plein');

	const rows: FeeScheduleRow[] = TUITION_BANDS.map((band) => {
		const row: FeeScheduleRow = {
			id: `autres-frais-${band.id}`,
			label: band.label,
			editability: 'summary-only',
		};

		// For each nationality, compute the average DAI
		for (const nat of NATIONALITIES) {
			const matching = pleinEntries.filter(
				(e) => band.grades.includes(e.gradeLevel) && e.nationality === nat.code
			);
			const daiValue = matching.length > 0 ? decimalAvg(matching.map((e) => e.dai)) : '0';
			// Store per-nationality DAI in a convention: use the nationality code as a suffix
			(row as Record<string, unknown>)[`dai_${nat.code}`] = daiValue;
		}

		return row;
	});

	return {
		id: 'autres-frais',
		title: 'Autres Frais (Other Fees)',
		rows,
	};
}

/**
 * Build Section 3: Tarifs Abattement (Discount Rates).
 * Shows Plein vs RP vs R3+ rates per band, read-only.
 */
function buildAbattementSection(entries: FeeGridEntry[]): FeeScheduleSection {
	const rows: FeeScheduleRow[] = [];

	for (const band of TUITION_BANDS) {
		for (const tariff of ['Plein', 'RP', 'R3+'] as const) {
			const matching = entries.filter(
				(e) => band.grades.includes(e.gradeLevel) && e.tariff === tariff
			);

			if (matching.length === 0) continue;

			// Average across nationalities for this band+tariff
			const tuitionHt = decimalAvg(matching.map((e) => e.tuitionHt));
			const totalTtc = decimalAvg(matching.map((e) => e.tuitionTtc));

			rows.push({
				id: `abattement-${band.id}-${tariff}`,
				label: `${band.label} - ${tariff}`,
				editability: 'summary-only',
				tuitionHt,
				totalTtc,
			});
		}
	}

	return {
		id: 'abattement',
		title: 'Tarifs Abattement (Discount Rates)',
		rows,
	};
}

// ── Public API ──────────────────────────────────────────────────────────────

export function buildFeeSchedule(entries: FeeGridEntry[]): FeeScheduleSection[] {
	return [
		buildTuitionSection(entries),
		buildAutresFraisSection(entries),
		buildAbattementSection(entries),
	];
}

/**
 * Exported for testing. Re-exports internal constants.
 */
export { TUITION_BANDS, NATIONALITIES, NUMERIC_FIELDS };
