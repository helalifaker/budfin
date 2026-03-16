import Decimal from 'decimal.js';
import type {
	FeeGridEntry,
	FeeScheduleGroup,
	FeeScheduleRow,
	FeeScheduleSection,
	RevenueSettings,
} from '@budfin/types';

interface BandDef {
	id: string;
	label: string;
	grades: string[];
}

interface BuildFeeScheduleArgs {
	entries: FeeGridEntry[];
	settings: RevenueSettings | null;
	priorYearEntries?: FeeGridEntry[] | undefined;
}

const TUITION_BANDS: BandDef[] = [
	{ id: 'PS', label: 'PS', grades: ['PS'] },
	{ id: 'MS_GS', label: 'MS + GS', grades: ['MS', 'GS'] },
	{ id: 'ELEM', label: 'Elementaire', grades: ['CP', 'CE1', 'CE2', 'CM1', 'CM2'] },
	{ id: 'COLLEGE', label: 'College', grades: ['6EME', '5EME', '4EME', '3EME'] },
	{ id: 'LYCEE', label: 'Lycee', grades: ['2NDE', '1ERE', 'TERM'] },
];

const NATIONALITIES: Array<{
	code: FeeGridEntry['nationality'];
	label: string;
}> = [
	{ code: 'Francais', label: 'Francais' },
	{ code: 'Nationaux', label: 'Nationaux (KSA)' },
	{ code: 'Autres', label: 'Autres Nationalites' },
];

const OTHER_FEE_DEFS: Array<{
	id: string;
	label: string;
	settingsField: keyof Omit<RevenueSettings, 'flatDiscountPct'>;
	note: string;
}> = [
	{
		id: 'dossier',
		label: 'Frais de Dossier',
		settingsField: 'dossierPerStudentHt',
		note: 'Application fee - new students',
	},
	{
		id: 'dpi',
		label: 'DPI (1ere Inscription)',
		settingsField: 'dpiPerStudentHt',
		note: 'First registration - new students only',
	},
	{
		id: 'exam-bac',
		label: 'BAC Exam',
		settingsField: 'examBacPerStudent',
		note: 'Baccalaureate examination fee',
	},
	{
		id: 'exam-dnb',
		label: 'DNB Exam',
		settingsField: 'examDnbPerStudent',
		note: 'Diplome National du Brevet exam fee',
	},
	{
		id: 'exam-eaf',
		label: 'EAF Exam',
		settingsField: 'examEafPerStudent',
		note: 'Epreuves Anticipees de Francais exam fee',
	},
	{
		id: 'eval-primaire',
		label: 'Evaluation - Primaire',
		settingsField: 'evalPrimairePerStudent',
		note: 'Entry test - CP to CM2',
	},
	{
		id: 'eval-secondaire',
		label: 'Evaluation - College+Lycee',
		settingsField: 'evalSecondairePerStudent',
		note: 'Entry test - 6EME to TERM',
	},
];

function average(values: string[]) {
	if (values.length === 0) {
		return '0.0000';
	}

	const sum = values.reduce((acc, value) => acc.plus(new Decimal(value)), new Decimal(0));
	return sum.div(values.length).toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4);
}

function allEqual(values: string[]) {
	if (values.length <= 1) {
		return true;
	}

	const first = new Decimal(values[0] ?? '0').toFixed(4);
	return values.every((value) => new Decimal(value).toFixed(4) === first);
}

function buildBandRow(
	band: BandDef,
	entries: FeeGridEntry[],
	nationality: FeeGridEntry['nationality'],
	priorYearEntries?: FeeGridEntry[]
): FeeScheduleRow {
	const matching = entries
		.filter(
			(entry) =>
				entry.tariff === 'Plein' &&
				entry.nationality === nationality &&
				band.grades.includes(entry.gradeLevel)
		)
		.sort(
			(left, right) => band.grades.indexOf(left.gradeLevel) - band.grades.indexOf(right.gradeLevel)
		);

	const heterogenous =
		matching.length > 1
			? !allEqual(matching.map((entry) => entry.dai)) ||
				!allEqual(matching.map((entry) => entry.tuitionTtc))
			: false;

	const sourceGrades = matching.map((entry) => entry.gradeLevel);
	const daiAvg = average(matching.map((entry) => entry.dai));
	const tuitionHtAvg = average(matching.map((entry) => entry.tuitionHt));
	const tuitionTtcAvg = average(matching.map((entry) => entry.tuitionTtc));
	const totalTtcValue = new Decimal(tuitionTtcAvg).plus(new Decimal(daiAvg)).toFixed(4);

	let priorYearTtc: string | undefined;
	let increasePct: string | undefined;
	if (priorYearEntries && priorYearEntries.length > 0) {
		const priorMatching = priorYearEntries.filter(
			(entry) =>
				entry.tariff === 'Plein' &&
				entry.nationality === nationality &&
				band.grades.includes(entry.gradeLevel)
		);
		if (priorMatching.length > 0) {
			priorYearTtc = average(priorMatching.map((entry) => entry.tuitionTtc));
			const priorDecimal = new Decimal(priorYearTtc);
			if (!priorDecimal.eq(0)) {
				increasePct = new Decimal(tuitionTtcAvg)
					.minus(priorDecimal)
					.div(priorDecimal)
					.mul(100)
					.toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
					.toFixed(2);
			}
		}
	}

	const row: FeeScheduleRow = {
		id: `tuition-${nationality}-${band.id}`,
		label: band.label,
		editability:
			matching.length === 0
				? 'summary-only'
				: matching.length === 1
					? 'editable-source'
					: 'editable-fanout',
		dai: daiAvg,
		tuitionHt: tuitionHtAvg,
		tuitionTtc: tuitionTtcAvg,
		totalTtc: totalTtcValue,
		underlyingGradeCount: matching.length,
		hasHeterogeneousValues: heterogenous,
		sourceGrades,
		sourceNationality: nationality,
	};
	if (priorYearTtc !== undefined) row.priorYearTtc = priorYearTtc;
	if (increasePct !== undefined) row.increasePct = increasePct;
	return row;
}

function buildTuitionSection(
	entries: FeeGridEntry[],
	priorYearEntries?: FeeGridEntry[]
): FeeScheduleSection {
	const groups: FeeScheduleGroup[] = NATIONALITIES.map((nationality) => ({
		nationality: nationality.code,
		nationalityLabel: nationality.label,
		rows: TUITION_BANDS.map((band) =>
			buildBandRow(band, entries, nationality.code, priorYearEntries)
		),
	}));

	return {
		id: 'tuition',
		title: 'Droits de Scolarite (Tuition Fees)',
		groups,
	};
}

function buildOtherFeesSection(settings: RevenueSettings | null): FeeScheduleSection {
	const rows: FeeScheduleRow[] = OTHER_FEE_DEFS.map((definition) => {
		const ht = settings?.[definition.settingsField] ?? '0.0000';
		return {
			id: `per-student-${definition.id}`,
			label: definition.label,
			editability: 'editable-source',
			settingsField: definition.settingsField,
			tuitionHt: ht,
			note: definition.note,
		};
	});

	return {
		id: 'per-student-fees',
		title: 'Per-Student Fees',
		rows,
	};
}

export function buildFeeSchedule(
	args: FeeGridEntry[] | BuildFeeScheduleArgs
): FeeScheduleSection[] {
	const normalized = Array.isArray(args) ? { entries: args, settings: null } : args;
	const { entries, settings, priorYearEntries } = normalized;

	return [buildTuitionSection(entries, priorYearEntries), buildOtherFeesSection(settings)];
}

export { TUITION_BANDS, NATIONALITIES };
