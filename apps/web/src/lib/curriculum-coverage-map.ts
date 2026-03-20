import type { DhgRuleDetail } from '../hooks/use-master-data';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ExpectedCoverageEntry = {
	disciplineCode: string;
	gradeCodes: string[];
	lineType?: string;
	label: string;
};

export type CoverageGap = {
	gradeCode: string;
	disciplineCode: string;
	label: string;
	lineType?: string | undefined;
};

export type CurriculumKpis = {
	totalRules: number;
	disciplineCount: number;
	gradeLevelCount: number;
	primaryHours: { maternelle: number; elementaire: number };
	secondaryHours: { college: number; lycee: number };
	gapCount: number;
};

export type DisciplineDisplayGroup = {
	key: string;
	label: string;
	disciplineCodes: string[];
};

// ── Expected Coverage Map ─────────────────────────────────────────────────────
// Static map of subject-grade combinations that EFIR teaches.
// Based on EFIR curriculum research (French education nationale framework
// adapted for international context in KSA).

export const EXPECTED_COVERAGE: ExpectedCoverageEntry[] = [
	// Primary (taught by PE homeroom teachers)
	{
		disciplineCode: 'PRIMARY_HOMEROOM',
		gradeCodes: ['PS', 'MS', 'GS', 'CP', 'CE1', 'CE2', 'CM1', 'CM2'],
		label: 'Enseignement Primaire',
	},
	{
		disciplineCode: 'ASEM',
		gradeCodes: ['PS', 'MS', 'GS'],
		label: 'ASEM',
	},

	// Host country languages & culture
	{
		disciplineCode: 'ARABE',
		gradeCodes: ['PS', 'MS', 'GS', 'CP', 'CE1', 'CE2', 'CM1', 'CM2', '5EME', '4EME', '3EME'],
		label: 'Arabe',
	},
	{
		disciplineCode: 'EDUCATION_ISLAMIQUE',
		gradeCodes: [
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
		],
		label: 'Education Islamique',
	},
	{
		disciplineCode: 'ANGLAIS_LV1',
		gradeCodes: ['CP', 'CE1', 'CE2', 'CM1', 'CM2', '6EME', '5EME', '4EME', '3EME'],
		label: 'Anglais LV1',
	},

	// Tronc commun secondaire (College + Lycee)
	{
		disciplineCode: 'FRANCAIS',
		gradeCodes: ['6EME', '5EME', '4EME', '3EME', '2NDE', '1ERE'],
		label: 'Francais',
	},
	{
		disciplineCode: 'MATHEMATIQUES',
		gradeCodes: ['6EME', '5EME', '4EME', '3EME', '2NDE'],
		label: 'Mathematiques',
	},
	{
		disciplineCode: 'HISTOIRE_GEO',
		gradeCodes: ['6EME', '5EME', '4EME', '3EME', '2NDE', '1ERE', 'TLE'],
		label: 'Histoire-Geographie',
	},
	{
		disciplineCode: 'EPS',
		gradeCodes: ['6EME', '5EME', '4EME', '3EME', '2NDE', '1ERE', 'TLE'],
		label: 'EPS',
	},
	{
		disciplineCode: 'EMC',
		gradeCodes: ['6EME', '5EME', '4EME', '3EME', '2NDE', '1ERE', 'TLE'],
		label: 'Enseignement Moral et Civique',
	},

	// Sciences (College)
	{
		disciplineCode: 'SVT',
		gradeCodes: ['6EME', '5EME', '4EME', '3EME', '2NDE'],
		label: 'SVT',
	},
	{
		disciplineCode: 'PHYSIQUE_CHIMIE',
		gradeCodes: ['6EME', '5EME', '4EME', '3EME', '2NDE'],
		label: 'Physique-Chimie',
	},
	{
		disciplineCode: 'TECHNOLOGIE',
		gradeCodes: ['5EME', '4EME', '3EME'],
		label: 'Technologie',
	},

	// Arts (College only at EFIR)
	{
		disciplineCode: 'ARTS_PLASTIQUES',
		gradeCodes: ['6EME', '5EME', '4EME', '3EME'],
		label: 'Arts Plastiques',
	},
	{
		disciplineCode: 'EDUCATION_MUSICALE',
		gradeCodes: ['6EME', '5EME', '4EME', '3EME'],
		label: 'Education Musicale',
	},

	// Lycee tronc commun
	{
		disciplineCode: 'SES',
		gradeCodes: ['2NDE'],
		label: 'SES (Tronc commun)',
	},
	{
		disciplineCode: 'SNT',
		gradeCodes: ['2NDE'],
		label: 'Sciences Numeriques et Technologie',
	},
	{
		disciplineCode: 'ENS_SCIENTIFIQUE',
		gradeCodes: ['1ERE', 'TLE'],
		label: 'Enseignement Scientifique',
	},
	{
		disciplineCode: 'PHILOSOPHIE',
		gradeCodes: ['TLE'],
		label: 'Philosophie',
	},

	// Lycee specialties (1ere: 4h, Terminale: 6h)
	{
		disciplineCode: 'MATHEMATIQUES',
		gradeCodes: ['1ERE', 'TLE'],
		lineType: 'SPECIALTY',
		label: 'Mathematiques (Specialite)',
	},
	{
		disciplineCode: 'PHYSIQUE_CHIMIE',
		gradeCodes: ['1ERE', 'TLE'],
		lineType: 'SPECIALTY',
		label: 'Physique-Chimie (Specialite)',
	},
	{
		disciplineCode: 'SVT',
		gradeCodes: ['1ERE', 'TLE'],
		lineType: 'SPECIALTY',
		label: 'SVT (Specialite)',
	},
	{
		disciplineCode: 'SES',
		gradeCodes: ['1ERE', 'TLE'],
		lineType: 'SPECIALTY',
		label: 'SES (Specialite)',
	},
	{
		disciplineCode: 'HGGSP',
		gradeCodes: ['1ERE', 'TLE'],
		lineType: 'SPECIALTY',
		label: 'HGGSP (Specialite)',
	},
	{
		disciplineCode: 'HLP',
		gradeCodes: ['1ERE', 'TLE'],
		lineType: 'SPECIALTY',
		label: 'HLP (Specialite)',
	},
	{
		disciplineCode: 'LLCER',
		gradeCodes: ['1ERE', 'TLE'],
		lineType: 'SPECIALTY',
		label: 'LLCER (Specialite)',
	},

	// Options
	{
		disciplineCode: 'ALLEMAND',
		gradeCodes: ['5EME', '4EME', '3EME', '2NDE', '1ERE', 'TLE'],
		label: 'Allemand (LV3)',
	},
	{
		disciplineCode: 'ESPAGNOL',
		gradeCodes: ['5EME', '4EME', '3EME', '2NDE', '1ERE', 'TLE'],
		label: 'Espagnol (LV3)',
	},
	{
		disciplineCode: 'MATHS_COMP',
		gradeCodes: ['TLE'],
		label: 'Mathematiques Complementaires',
	},
	{
		disciplineCode: 'MATHS_EXPERTES',
		gradeCodes: ['TLE'],
		label: 'Mathematiques Expertes',
	},

	// Autonomy pool
	{
		disciplineCode: 'AUTONOMY',
		gradeCodes: ['6EME', '5EME', '4EME', '3EME', '2NDE', '1ERE', 'TLE'],
		label: "Heures d'Autonomie",
	},
];

// ── Discipline Display Groups ─────────────────────────────────────────────────
// Ordering for the Y-axis of the coverage matrix.

export const DISCIPLINE_DISPLAY_GROUPS: DisciplineDisplayGroup[] = [
	{
		key: 'primary',
		label: 'Enseignement Primaire',
		disciplineCodes: ['PRIMARY_HOMEROOM', 'ASEM'],
	},
	{
		key: 'host-country',
		label: 'Langues du Pays Hote',
		disciplineCodes: ['ARABE', 'EDUCATION_ISLAMIQUE'],
	},
	{
		key: 'tronc-commun',
		label: 'Tronc Commun',
		disciplineCodes: ['FRANCAIS', 'MATHEMATIQUES', 'HISTOIRE_GEO', 'ANGLAIS_LV1', 'EPS', 'EMC'],
	},
	{
		key: 'sciences',
		label: 'Sciences',
		disciplineCodes: ['SVT', 'PHYSIQUE_CHIMIE', 'TECHNOLOGIE', 'SNT', 'ENS_SCIENTIFIQUE'],
	},
	{
		key: 'arts',
		label: 'Arts',
		disciplineCodes: ['ARTS_PLASTIQUES', 'EDUCATION_MUSICALE'],
	},
	{
		key: 'lycee-tronc',
		label: 'Lycee Tronc Commun',
		disciplineCodes: ['SES', 'PHILOSOPHIE'],
	},
	{
		key: 'specialites',
		label: 'Specialites Lycee',
		disciplineCodes: ['HGGSP', 'HLP', 'LLCER'],
	},
	{
		key: 'options',
		label: 'Options',
		disciplineCodes: ['ALLEMAND', 'ESPAGNOL', 'MATHS_COMP', 'MATHS_EXPERTES'],
	},
	{
		key: 'pools',
		label: 'Pools Horaires',
		disciplineCodes: ['AUTONOMY'],
	},
];

// ── Pure Functions ────────────────────────────────────────────────────────────

/**
 * Build an index of DHG rules keyed by "gradeLevel::disciplineCode".
 * Multiple rules per cell are supported (e.g., STRUCTURAL + SPECIALTY).
 */
export function buildRuleIndex(rules: DhgRuleDetail[]): Map<string, DhgRuleDetail[]> {
	const index = new Map<string, DhgRuleDetail[]>();
	for (const rule of rules) {
		const key = `${rule.gradeLevel}::${rule.disciplineCode}`;
		const existing = index.get(key);
		if (existing) {
			existing.push(rule);
		} else {
			index.set(key, [rule]);
		}
	}
	return index;
}

/**
 * Compare actual DHG rules against the expected curriculum coverage.
 * Returns gaps: entries that are expected but have no matching rule.
 *
 * For entries with a lineType (e.g., SPECIALTY), the check is more specific:
 * both discipline+grade AND lineType must match.
 * For entries without a lineType, any rule at that grade+discipline satisfies.
 */
export function computeCoverageGaps(
	rules: DhgRuleDetail[],
	expected: ExpectedCoverageEntry[] = EXPECTED_COVERAGE
): CoverageGap[] {
	const existingKeys = new Set<string>();
	for (const r of rules) {
		// Key without lineType for basic coverage check
		existingKeys.add(`${r.gradeLevel}::${r.disciplineCode}`);
		// Also add with lineType for specialty-specific checks
		existingKeys.add(`${r.gradeLevel}::${r.disciplineCode}::${r.lineType}`);
	}

	const gaps: CoverageGap[] = [];
	for (const entry of expected) {
		for (const gradeCode of entry.gradeCodes) {
			const key = entry.lineType
				? `${gradeCode}::${entry.disciplineCode}::${entry.lineType}`
				: `${gradeCode}::${entry.disciplineCode}`;
			if (!existingKeys.has(key)) {
				gaps.push({
					gradeCode,
					disciplineCode: entry.disciplineCode,
					label: entry.label,
					lineType: entry.lineType,
				});
			}
		}
	}
	return gaps;
}

/**
 * Aggregate DHG rules into KPI metrics by educational band.
 * The gradeToBand map translates grade codes (e.g., 'PS') to bands
 * (e.g., 'MATERNELLE').
 */
export function computeCurriculumKpis(
	rules: DhgRuleDetail[],
	gradeToBand: Map<string, string>,
	expected: ExpectedCoverageEntry[] = EXPECTED_COVERAGE
): CurriculumKpis {
	const gaps = computeCoverageGaps(rules, expected);
	const disciplineCodes = new Set<string>();
	const gradeLevels = new Set<string>();
	const bandHours = {
		MATERNELLE: 0,
		ELEMENTAIRE: 0,
		COLLEGE: 0,
		LYCEE: 0,
	};

	for (const rule of rules) {
		disciplineCodes.add(rule.disciplineCode);
		gradeLevels.add(rule.gradeLevel);
		const band = gradeToBand.get(rule.gradeLevel);
		if (band && band in bandHours) {
			bandHours[band as keyof typeof bandHours] += parseFloat(rule.hoursPerUnit) || 0;
		}
	}

	return {
		totalRules: rules.length,
		disciplineCount: disciplineCodes.size,
		gradeLevelCount: gradeLevels.size,
		primaryHours: {
			maternelle: bandHours.MATERNELLE,
			elementaire: bandHours.ELEMENTAIRE,
		},
		secondaryHours: {
			college: bandHours.COLLEGE,
			lycee: bandHours.LYCEE,
		},
		gapCount: gaps.length,
	};
}

/**
 * Check if a given grade+discipline combination is in the expected coverage.
 * Used by the coverage matrix to determine if a cell should be rendered.
 */
export function isExpectedCell(
	gradeCode: string,
	disciplineCode: string,
	expected: ExpectedCoverageEntry[] = EXPECTED_COVERAGE
): boolean {
	return expected.some(
		(entry) => entry.disciplineCode === disciplineCode && entry.gradeCodes.includes(gradeCode)
	);
}

/**
 * Check if a cell is a coverage gap: expected by the curriculum but
 * no DHG rule exists for it. Used to highlight missing rules in the
 * coverage matrix.
 */
export function isGapCell(
	gradeCode: string,
	disciplineCode: string,
	ruleIndex: Map<string, DhgRuleDetail[]>,
	expected: ExpectedCoverageEntry[] = EXPECTED_COVERAGE
): boolean {
	const hasRule = ruleIndex.has(`${gradeCode}::${disciplineCode}`);
	return !hasRule && isExpectedCell(gradeCode, disciplineCode, expected);
}
