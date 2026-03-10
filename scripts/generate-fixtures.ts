// Generate all migration fixture files with internally consistent data
// Run: npx tsx scripts/generate-fixtures.ts

import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, '..', 'data', 'fixtures');
const ENROLLMENT = resolve(__dirname, '..', 'data', 'enrollment');

// ── Grade definitions ────────────────────────────────────────────────────────

const GRADES = [
	{ code: 'PS', name: 'Petite Section', band: 'MATERNELLE', feeBand: 'MATERNELLE' },
	{ code: 'MS', name: 'Moyenne Section', band: 'MATERNELLE', feeBand: 'MATERNELLE' },
	{ code: 'GS', name: 'Grande Section', band: 'MATERNELLE', feeBand: 'MATERNELLE' },
	{ code: 'CP', name: 'Cours Preparatoire', band: 'ELEMENTAIRE', feeBand: 'ELEMENTAIRE' },
	{ code: 'CE1', name: 'Cours Elementaire 1', band: 'ELEMENTAIRE', feeBand: 'ELEMENTAIRE' },
	{ code: 'CE2', name: 'Cours Elementaire 2', band: 'ELEMENTAIRE', feeBand: 'ELEMENTAIRE' },
	{ code: 'CM1', name: 'Cours Moyen 1', band: 'ELEMENTAIRE', feeBand: 'ELEMENTAIRE' },
	{ code: 'CM2', name: 'Cours Moyen 2', band: 'ELEMENTAIRE', feeBand: 'ELEMENTAIRE' },
	{ code: '6EME', name: 'Sixieme', band: 'COLLEGE', feeBand: 'COLLEGE' },
	{ code: '5EME', name: 'Cinquieme', band: 'COLLEGE', feeBand: 'COLLEGE' },
	{ code: '4EME', name: 'Quatrieme', band: 'COLLEGE', feeBand: 'COLLEGE' },
	{ code: '3EME', name: 'Troisieme', band: 'COLLEGE', feeBand: 'COLLEGE' },
	{ code: '2NDE', name: 'Seconde', band: 'LYCEE', feeBand: 'LYCEE' },
	{ code: '1ERE', name: 'Premiere', band: 'LYCEE', feeBand: 'LYCEE' },
	{ code: 'TERM', name: 'TERM', band: 'LYCEE', feeBand: 'LYCEE' },
] as const;

const NATIONALITIES = ['FR', 'NAT', 'AUT'] as const;
const TARIFFS = ['PLEIN', 'RP', 'R3P'] as const;

// ── 1. Grade code mapping ────────────────────────────────────────────────────

function generateGradeCodeMapping() {
	return GRADES.map((g) => ({
		excelCode: g.code,
		appCode: g.code,
		gradeName: g.name,
		band: g.band,
		feeBand: g.feeBand,
	}));
}

// ── 2. Fee grid (270 entries: 15 grades × 3 nat × 3 tariff × 2 periods) ─────

// Base tuition HT per band (SAR per year)
const TUITION_HT_BY_BAND: Record<string, number> = {
	MATERNELLE: 32000,
	ELEMENTAIRE: 35000,
	COLLEGE: 40000,
	LYCEE: 45000,
};

function generateFeeGrid() {
	const rows: Array<{
		academicPeriod: string;
		gradeLevel: string;
		nationality: string;
		tariff: string;
		tuitionTtc: string;
		tuitionHt: string;
		dai: string;
	}> = [];

	for (const period of ['AY1', 'AY2'] as const) {
		for (const grade of GRADES) {
			const baseHt = TUITION_HT_BY_BAND[grade.feeBand]!;
			// AY2 fees are slightly lower (Sep-Dec is 4 months vs Jan-Jun 6 months)
			const periodFactor = period === 'AY1' ? 0.6 : 0.4;
			const periodHt = baseHt * periodFactor;

			for (const nat of NATIONALITIES) {
				// VAT: 15% for all (no exemptions currently)
				const vatRate = 0.15;

				for (const tariff of TARIFFS) {
					const ht = periodHt;
					const ttc = ht * (1 + vatRate);
					// DAI (Droit Annuel d'Inscription) varies by band
					const daiBase =
						grade.feeBand === 'MATERNELLE'
							? 2000
							: grade.feeBand === 'ELEMENTAIRE'
								? 2200
								: grade.feeBand === 'COLLEGE'
									? 2500
									: 2800;
					const dai = daiBase * periodFactor;

					rows.push({
						academicPeriod: period,
						gradeLevel: grade.code,
						nationality: nat,
						tariff: tariff,
						tuitionTtc: ttc.toFixed(4),
						tuitionHt: ht.toFixed(4),
						dai: dai.toFixed(4),
					});
				}
			}
		}
	}

	return rows;
}

// ── 3. Discounts (3 entries) ─────────────────────────────────────────────────

function generateDiscounts() {
	return [
		{ tariff: 'PLEIN', nationality: null, discountRate: '0.0000' },
		{ tariff: 'RP', nationality: null, discountRate: '0.2500' },
		{ tariff: 'R3P', nationality: null, discountRate: '0.1000' },
	];
}

// ── 4. Enrollment detail (214 entries, AY1 total = 1753) ─────────────────────

function generateEnrollmentDetail() {
	// Excluded combos (56 total → 270 - 56 = 214 entries):
	// - AUT/R3P everywhere (30): too few 3+ sibling families among "Autres"
	// - NAT/R3P for maternelle both periods (6): rare in early years
	// - AUT/RP in AY2 all grades (15): staff "Autres" children attrit by AY2
	// - NAT/RP for maternelle in AY2 (3): attrition
	// - FR/R3P for GS and TERM in AY2 (2): attrition in edge grades
	const EXCLUDED = new Set<string>();
	for (const period of ['AY1', 'AY2']) {
		for (const g of GRADES) {
			EXCLUDED.add(`${period}|${g.code}|AUT|R3P`);
		}
		for (const code of ['PS', 'MS', 'GS']) {
			EXCLUDED.add(`${period}|${code}|NAT|R3P`);
		}
	}
	for (const g of GRADES) EXCLUDED.add(`AY2|${g.code}|AUT|RP`);
	for (const code of ['PS', 'MS', 'GS']) EXCLUDED.add(`AY2|${code}|NAT|RP`);
	EXCLUDED.add('AY2|GS|FR|R3P');
	EXCLUDED.add('AY2|TERM|FR|R3P');

	// Distribution weights (used only for included combos, then normalized)
	const natWeights: Record<string, number> = { FR: 0.48, NAT: 0.3, AUT: 0.22 };
	const tariffWeights: Record<string, number> = { PLEIN: 0.78, RP: 0.12, R3P: 0.1 };

	// Target grade headcounts for AY1 (must sum to 1753)
	const gradeTargetsAY1: Record<string, number> = {
		PS: 100,
		MS: 103,
		GS: 106,
		CP: 110,
		CE1: 113,
		CE2: 116,
		CM1: 119,
		CM2: 122,
		'6EME': 131,
		'5EME': 134,
		'4EME': 137,
		'3EME': 139,
		'2NDE': 125,
		'1ERE': 120,
		TERM: 78,
	};
	const ay1Sum = Object.values(gradeTargetsAY1).reduce((a, b) => a + b, 0);
	if (ay1Sum !== 1753) throw new Error(`AY1 sum is ${ay1Sum}, expected 1753`);

	// AY2 is ~95% of AY1
	const gradeTargetsAY2: Record<string, number> = {};
	for (const [code, count] of Object.entries(gradeTargetsAY1)) {
		gradeTargetsAY2[code] = Math.round(count * 0.95);
	}

	const rows: Array<{
		academicPeriod: string;
		gradeLevel: string;
		nationality: string;
		tariff: string;
		headcount: number;
	}> = [];

	for (const period of ['AY1', 'AY2'] as const) {
		const targets = period === 'AY1' ? gradeTargetsAY1 : gradeTargetsAY2;

		for (const grade of GRADES) {
			const gradeTotal = targets[grade.code]!;

			// Collect active combos and their raw weights
			const active: Array<{ nat: string; tariff: string; weight: number }> = [];
			for (const nat of NATIONALITIES) {
				for (const tariff of TARIFFS) {
					const key = `${period}|${grade.code}|${nat}|${tariff}`;
					if (!EXCLUDED.has(key)) {
						active.push({ nat, tariff, weight: natWeights[nat]! * tariffWeights[tariff]! });
					}
				}
			}

			// Normalize weights and distribute headcount
			const totalWeight = active.reduce((s, a) => s + a.weight, 0);
			let remaining = gradeTotal;
			const combos: Array<{ nat: string; tariff: string; count: number }> = [];

			for (let i = 0; i < active.length; i++) {
				const a = active[i]!;
				const isLast = i === active.length - 1;
				const count = isLast ? remaining : Math.round(gradeTotal * (a.weight / totalWeight));
				if (count > 0) {
					combos.push({ nat: a.nat, tariff: a.tariff, count });
					remaining -= count;
				}
			}

			// Fix rounding remainder
			if (remaining !== 0 && combos.length > 0) {
				combos[combos.length - 1]!.count += remaining;
			}

			for (const combo of combos) {
				if (combo.count > 0) {
					rows.push({
						academicPeriod: period,
						gradeLevel: grade.code,
						nationality: combo.nat,
						tariff: combo.tariff,
						headcount: combo.count,
					});
				}
			}
		}
	}

	return rows;
}

// ── 5. Other revenue (21 items) ──────────────────────────────────────────────

function generateOtherRevenue() {
	return [
		{
			lineItemName: 'DAI — Maternelle',
			annualAmount: '600000.0000',
			distributionMethod: 'ACADEMIC',
			weightArray: null,
			specificMonths: null,
			ifrsCategory: 'Registration Fees',
		},
		{
			lineItemName: 'DAI — Elementaire',
			annualAmount: '1100000.0000',
			distributionMethod: 'ACADEMIC',
			weightArray: null,
			specificMonths: null,
			ifrsCategory: 'Registration Fees',
		},
		{
			lineItemName: 'DAI — College',
			annualAmount: '1350000.0000',
			distributionMethod: 'ACADEMIC',
			weightArray: null,
			specificMonths: null,
			ifrsCategory: 'Registration Fees',
		},
		{
			lineItemName: 'DAI — Lycee',
			annualAmount: '905000.0000',
			distributionMethod: 'ACADEMIC',
			weightArray: null,
			specificMonths: null,
			ifrsCategory: 'Registration Fees',
		},
		{
			lineItemName: 'DPI Revenue',
			annualAmount: '450000.0000',
			distributionMethod: 'SPECIFIC_MONTHS',
			weightArray: null,
			specificMonths: [1, 9],
			ifrsCategory: 'Registration Fees',
		},
		{
			lineItemName: 'Frais de Dossier',
			annualAmount: '350000.0000',
			distributionMethod: 'SPECIFIC_MONTHS',
			weightArray: null,
			specificMonths: [3, 4, 5],
			ifrsCategory: 'Registration Fees',
		},
		{
			lineItemName: 'Examination Fees — BAC',
			annualAmount: '78000.0000',
			distributionMethod: 'SPECIFIC_MONTHS',
			weightArray: null,
			specificMonths: [3],
			ifrsCategory: 'Examination Fees',
		},
		{
			lineItemName: 'Examination Fees — DNB',
			annualAmount: '69500.0000',
			distributionMethod: 'SPECIFIC_MONTHS',
			weightArray: null,
			specificMonths: [3],
			ifrsCategory: 'Examination Fees',
		},
		{
			lineItemName: 'Examination Fees — EAF',
			annualAmount: '60000.0000',
			distributionMethod: 'SPECIFIC_MONTHS',
			weightArray: null,
			specificMonths: [4],
			ifrsCategory: 'Examination Fees',
		},
		{
			lineItemName: 'Examination Fees — SIELE',
			annualAmount: '42000.0000',
			distributionMethod: 'SPECIFIC_MONTHS',
			weightArray: null,
			specificMonths: [5],
			ifrsCategory: 'Examination Fees',
		},
		{
			lineItemName: 'After-School Activities',
			annualAmount: '280000.0000',
			distributionMethod: 'ACADEMIC',
			weightArray: null,
			specificMonths: null,
			ifrsCategory: 'Activities & Services',
		},
		{
			lineItemName: 'Daycare Revenue',
			annualAmount: '195000.0000',
			distributionMethod: 'ACADEMIC',
			weightArray: null,
			specificMonths: null,
			ifrsCategory: 'Activities & Services',
		},
		{
			lineItemName: 'Class Photos Revenue',
			annualAmount: '35000.0000',
			distributionMethod: 'SPECIFIC_MONTHS',
			weightArray: null,
			specificMonths: [10, 11],
			ifrsCategory: 'Activities & Services',
		},
		{
			lineItemName: 'PSG Academy Rental',
			annualAmount: '120000.0000',
			distributionMethod: 'EVEN',
			weightArray: null,
			specificMonths: null,
			ifrsCategory: 'Activities & Services',
		},
		{
			lineItemName: 'Evaluation Fees',
			annualAmount: '87500.0000',
			distributionMethod: 'SPECIFIC_MONTHS',
			weightArray: null,
			specificMonths: [1, 2, 3],
			ifrsCategory: 'Registration Fees',
		},
		{
			lineItemName: 'Bourses AEFE',
			annualAmount: '-450000.0000',
			distributionMethod: 'EVEN',
			weightArray: null,
			specificMonths: null,
			ifrsCategory: 'Other Revenue',
		},
		{
			lineItemName: 'Bourses AESH',
			annualAmount: '-120000.0000',
			distributionMethod: 'EVEN',
			weightArray: null,
			specificMonths: null,
			ifrsCategory: 'Other Revenue',
		},
		{
			lineItemName: 'Transport Service — Buses',
			annualAmount: '680000.0000',
			distributionMethod: 'ACADEMIC',
			weightArray: null,
			specificMonths: null,
			ifrsCategory: 'Activities & Services',
		},
		{
			lineItemName: 'Cafeteria Concession',
			annualAmount: '95000.0000',
			distributionMethod: 'EVEN',
			weightArray: null,
			specificMonths: null,
			ifrsCategory: 'Other Revenue',
		},
		{
			lineItemName: 'Uniform Sales Commission',
			annualAmount: '45000.0000',
			distributionMethod: 'SPECIFIC_MONTHS',
			weightArray: null,
			specificMonths: [8, 9],
			ifrsCategory: 'Other Revenue',
		},
		{
			lineItemName: 'Summer Camp Revenue',
			annualAmount: '150000.0000',
			distributionMethod: 'SPECIFIC_MONTHS',
			weightArray: null,
			specificMonths: [7, 8],
			ifrsCategory: 'Activities & Services',
		},
	];
}

// ── 6. DHG structure ─────────────────────────────────────────────────────────

function generateDhgStructure() {
	return {
		maternelleHours: [
			{
				subject: 'Mobiliser le langage',
				hoursPerWeek: { PS: 6.0, MS: 6.0, GS: 6.5 },
			},
			{
				subject: 'Activites physiques',
				hoursPerWeek: { PS: 5.0, MS: 5.0, GS: 4.0 },
			},
			{
				subject: 'Activites artistiques',
				hoursPerWeek: { PS: 3.0, MS: 3.0, GS: 3.0 },
			},
			{
				subject: 'Construire les premiers outils',
				hoursPerWeek: { PS: 4.0, MS: 5.0, GS: 5.5 },
			},
			{
				subject: 'Explorer le monde',
				hoursPerWeek: { PS: 4.0, MS: 4.0, GS: 4.5 },
			},
			{
				subject: 'Arabe',
				hoursPerWeek: { PS: 2.0, MS: 2.0, GS: 2.5 },
			},
			{
				subject: 'Anglais',
				hoursPerWeek: { PS: 1.0, MS: 1.5, GS: 2.0 },
			},
		],
		elementaireHours: [
			{
				subject: 'Francais',
				hoursPerWeek: { CP: 10.0, CE1: 8.0, CE2: 8.0, CM1: 7.5, CM2: 7.5 },
			},
			{
				subject: 'Mathematiques',
				hoursPerWeek: { CP: 5.0, CE1: 5.0, CE2: 5.0, CM1: 5.0, CM2: 5.0 },
			},
			{
				subject: 'EPS',
				hoursPerWeek: { CP: 3.0, CE1: 3.0, CE2: 3.0, CM1: 3.0, CM2: 3.0 },
			},
			{
				subject: 'Sciences et Technologie',
				hoursPerWeek: { CP: 1.0, CE1: 1.5, CE2: 1.5, CM1: 2.0, CM2: 2.0 },
			},
			{
				subject: 'Histoire-Geographie-EMC',
				hoursPerWeek: { CP: 0.5, CE1: 1.0, CE2: 1.5, CM1: 2.5, CM2: 2.5 },
			},
			{
				subject: 'Arts Plastiques',
				hoursPerWeek: { CP: 1.0, CE1: 1.0, CE2: 1.0, CM1: 1.0, CM2: 1.0 },
			},
			{
				subject: 'Education Musicale',
				hoursPerWeek: { CP: 1.0, CE1: 1.0, CE2: 1.0, CM1: 1.0, CM2: 1.0 },
			},
			{
				subject: 'Arabe',
				hoursPerWeek: { CP: 2.0, CE1: 2.5, CE2: 2.5, CM1: 2.5, CM2: 2.5 },
			},
			{
				subject: 'Anglais',
				hoursPerWeek: { CP: 1.5, CE1: 2.0, CE2: 2.0, CM1: 2.0, CM2: 2.0 },
			},
		],
		collegeDHG: [
			{
				level: '6EME',
				discipline: 'Francais',
				hoursPerWeekPerStudent: 4.5,
				totalHoursPerWeek: 22.5,
				sections: 5,
			},
			{
				level: '6EME',
				discipline: 'Mathematiques',
				hoursPerWeekPerStudent: 4.5,
				totalHoursPerWeek: 22.5,
				sections: 5,
			},
			{
				level: '6EME',
				discipline: 'Histoire-Geographie-EMC',
				hoursPerWeekPerStudent: 3.0,
				totalHoursPerWeek: 15.0,
				sections: 5,
			},
			{
				level: '6EME',
				discipline: 'SVT',
				hoursPerWeekPerStudent: 1.5,
				totalHoursPerWeek: 7.5,
				sections: 5,
			},
			{
				level: '6EME',
				discipline: 'Physique-Chimie',
				hoursPerWeekPerStudent: 1.0,
				totalHoursPerWeek: 5.0,
				sections: 5,
			},
			{
				level: '6EME',
				discipline: 'Technologie',
				hoursPerWeekPerStudent: 1.5,
				totalHoursPerWeek: 7.5,
				sections: 5,
			},
			{
				level: '6EME',
				discipline: 'Anglais',
				hoursPerWeekPerStudent: 4.0,
				totalHoursPerWeek: 20.0,
				sections: 5,
			},
			{
				level: '6EME',
				discipline: 'Arabe',
				hoursPerWeekPerStudent: 3.0,
				totalHoursPerWeek: 15.0,
				sections: 5,
			},
			{
				level: '6EME',
				discipline: 'Arts Plastiques',
				hoursPerWeekPerStudent: 1.0,
				totalHoursPerWeek: 5.0,
				sections: 5,
			},
			{
				level: '6EME',
				discipline: 'Education Musicale',
				hoursPerWeekPerStudent: 1.0,
				totalHoursPerWeek: 5.0,
				sections: 5,
			},
			{
				level: '6EME',
				discipline: 'EPS',
				hoursPerWeekPerStudent: 4.0,
				totalHoursPerWeek: 20.0,
				sections: 5,
			},
			{
				level: '5EME',
				discipline: 'Francais',
				hoursPerWeekPerStudent: 4.5,
				totalHoursPerWeek: 22.5,
				sections: 5,
			},
			{
				level: '5EME',
				discipline: 'Mathematiques',
				hoursPerWeekPerStudent: 3.5,
				totalHoursPerWeek: 17.5,
				sections: 5,
			},
			{
				level: '5EME',
				discipline: 'Histoire-Geographie-EMC',
				hoursPerWeekPerStudent: 3.0,
				totalHoursPerWeek: 15.0,
				sections: 5,
			},
			{
				level: '5EME',
				discipline: 'SVT',
				hoursPerWeekPerStudent: 1.5,
				totalHoursPerWeek: 7.5,
				sections: 5,
			},
			{
				level: '5EME',
				discipline: 'Physique-Chimie',
				hoursPerWeekPerStudent: 1.5,
				totalHoursPerWeek: 7.5,
				sections: 5,
			},
			{
				level: '5EME',
				discipline: 'Technologie',
				hoursPerWeekPerStudent: 1.5,
				totalHoursPerWeek: 7.5,
				sections: 5,
			},
			{
				level: '5EME',
				discipline: 'Anglais',
				hoursPerWeekPerStudent: 3.0,
				totalHoursPerWeek: 15.0,
				sections: 5,
			},
			{
				level: '5EME',
				discipline: 'Arabe',
				hoursPerWeekPerStudent: 3.0,
				totalHoursPerWeek: 15.0,
				sections: 5,
			},
			{
				level: '5EME',
				discipline: 'Arts Plastiques',
				hoursPerWeekPerStudent: 1.0,
				totalHoursPerWeek: 5.0,
				sections: 5,
			},
			{
				level: '5EME',
				discipline: 'Education Musicale',
				hoursPerWeekPerStudent: 1.0,
				totalHoursPerWeek: 5.0,
				sections: 5,
			},
			{
				level: '5EME',
				discipline: 'EPS',
				hoursPerWeekPerStudent: 3.0,
				totalHoursPerWeek: 15.0,
				sections: 5,
			},
			{
				level: '5EME',
				discipline: 'Espagnol',
				hoursPerWeekPerStudent: 2.5,
				totalHoursPerWeek: 12.5,
				sections: 5,
			},
			{
				level: '4EME',
				discipline: 'Francais',
				hoursPerWeekPerStudent: 4.5,
				totalHoursPerWeek: 22.5,
				sections: 5,
			},
			{
				level: '4EME',
				discipline: 'Mathematiques',
				hoursPerWeekPerStudent: 3.5,
				totalHoursPerWeek: 17.5,
				sections: 5,
			},
			{
				level: '4EME',
				discipline: 'Histoire-Geographie-EMC',
				hoursPerWeekPerStudent: 3.0,
				totalHoursPerWeek: 15.0,
				sections: 5,
			},
			{
				level: '4EME',
				discipline: 'SVT',
				hoursPerWeekPerStudent: 1.5,
				totalHoursPerWeek: 7.5,
				sections: 5,
			},
			{
				level: '4EME',
				discipline: 'Physique-Chimie',
				hoursPerWeekPerStudent: 1.5,
				totalHoursPerWeek: 7.5,
				sections: 5,
			},
			{
				level: '4EME',
				discipline: 'Technologie',
				hoursPerWeekPerStudent: 1.5,
				totalHoursPerWeek: 7.5,
				sections: 5,
			},
			{
				level: '4EME',
				discipline: 'Anglais',
				hoursPerWeekPerStudent: 3.0,
				totalHoursPerWeek: 15.0,
				sections: 5,
			},
			{
				level: '4EME',
				discipline: 'Arabe',
				hoursPerWeekPerStudent: 3.0,
				totalHoursPerWeek: 15.0,
				sections: 5,
			},
			{
				level: '4EME',
				discipline: 'Espagnol',
				hoursPerWeekPerStudent: 2.5,
				totalHoursPerWeek: 12.5,
				sections: 5,
			},
			{
				level: '4EME',
				discipline: 'Arts Plastiques',
				hoursPerWeekPerStudent: 1.0,
				totalHoursPerWeek: 5.0,
				sections: 5,
			},
			{
				level: '4EME',
				discipline: 'Education Musicale',
				hoursPerWeekPerStudent: 1.0,
				totalHoursPerWeek: 5.0,
				sections: 5,
			},
			{
				level: '4EME',
				discipline: 'EPS',
				hoursPerWeekPerStudent: 3.0,
				totalHoursPerWeek: 15.0,
				sections: 5,
			},
			{
				level: '3EME',
				discipline: 'Francais',
				hoursPerWeekPerStudent: 4.0,
				totalHoursPerWeek: 20.0,
				sections: 5,
			},
			{
				level: '3EME',
				discipline: 'Mathematiques',
				hoursPerWeekPerStudent: 3.5,
				totalHoursPerWeek: 17.5,
				sections: 5,
			},
			{
				level: '3EME',
				discipline: 'Histoire-Geographie-EMC',
				hoursPerWeekPerStudent: 3.5,
				totalHoursPerWeek: 17.5,
				sections: 5,
			},
			{
				level: '3EME',
				discipline: 'SVT',
				hoursPerWeekPerStudent: 1.5,
				totalHoursPerWeek: 7.5,
				sections: 5,
			},
			{
				level: '3EME',
				discipline: 'Physique-Chimie',
				hoursPerWeekPerStudent: 1.5,
				totalHoursPerWeek: 7.5,
				sections: 5,
			},
			{
				level: '3EME',
				discipline: 'Technologie',
				hoursPerWeekPerStudent: 1.5,
				totalHoursPerWeek: 7.5,
				sections: 5,
			},
			{
				level: '3EME',
				discipline: 'Anglais',
				hoursPerWeekPerStudent: 3.0,
				totalHoursPerWeek: 15.0,
				sections: 5,
			},
			{
				level: '3EME',
				discipline: 'Arabe',
				hoursPerWeekPerStudent: 3.0,
				totalHoursPerWeek: 15.0,
				sections: 5,
			},
			{
				level: '3EME',
				discipline: 'Espagnol',
				hoursPerWeekPerStudent: 2.5,
				totalHoursPerWeek: 12.5,
				sections: 5,
			},
			{
				level: '3EME',
				discipline: 'Arts Plastiques',
				hoursPerWeekPerStudent: 1.0,
				totalHoursPerWeek: 5.0,
				sections: 5,
			},
			{
				level: '3EME',
				discipline: 'Education Musicale',
				hoursPerWeekPerStudent: 1.0,
				totalHoursPerWeek: 5.0,
				sections: 5,
			},
			{
				level: '3EME',
				discipline: 'EPS',
				hoursPerWeekPerStudent: 3.0,
				totalHoursPerWeek: 15.0,
				sections: 5,
			},
		],
		lyceeDHG: {
			seconde: [
				{
					level: '2NDE',
					discipline: 'Francais',
					hoursPerWeekPerStudent: 4.0,
					totalHoursPerWeek: 16.0,
					sections: 4,
				},
				{
					level: '2NDE',
					discipline: 'Mathematiques',
					hoursPerWeekPerStudent: 4.0,
					totalHoursPerWeek: 16.0,
					sections: 4,
				},
				{
					level: '2NDE',
					discipline: 'Histoire-Geographie',
					hoursPerWeekPerStudent: 3.0,
					totalHoursPerWeek: 12.0,
					sections: 4,
				},
				{
					level: '2NDE',
					discipline: 'SVT',
					hoursPerWeekPerStudent: 1.5,
					totalHoursPerWeek: 6.0,
					sections: 4,
				},
				{
					level: '2NDE',
					discipline: 'Physique-Chimie',
					hoursPerWeekPerStudent: 3.0,
					totalHoursPerWeek: 12.0,
					sections: 4,
				},
				{
					level: '2NDE',
					discipline: 'SES',
					hoursPerWeekPerStudent: 1.5,
					totalHoursPerWeek: 6.0,
					sections: 4,
				},
				{
					level: '2NDE',
					discipline: 'Anglais',
					hoursPerWeekPerStudent: 3.0,
					totalHoursPerWeek: 12.0,
					sections: 4,
				},
				{
					level: '2NDE',
					discipline: 'Arabe',
					hoursPerWeekPerStudent: 3.0,
					totalHoursPerWeek: 12.0,
					sections: 4,
				},
				{
					level: '2NDE',
					discipline: 'Espagnol',
					hoursPerWeekPerStudent: 2.5,
					totalHoursPerWeek: 10.0,
					sections: 4,
				},
				{
					level: '2NDE',
					discipline: 'EPS',
					hoursPerWeekPerStudent: 2.0,
					totalHoursPerWeek: 8.0,
					sections: 4,
				},
				{
					level: '2NDE',
					discipline: 'SNT',
					hoursPerWeekPerStudent: 1.5,
					totalHoursPerWeek: 6.0,
					sections: 4,
				},
				{
					level: '2NDE',
					discipline: 'EMC',
					hoursPerWeekPerStudent: 0.5,
					totalHoursPerWeek: 2.0,
					sections: 4,
				},
			],
			premiere: [
				{
					level: '1ERE',
					discipline: 'Francais',
					hoursPerWeekPerStudent: 4.0,
					totalHoursPerWeek: 16.0,
					sections: 4,
				},
				{
					level: '1ERE',
					discipline: 'Mathematiques',
					hoursPerWeekPerStudent: 4.0,
					totalHoursPerWeek: 16.0,
					sections: 4,
				},
				{
					level: '1ERE',
					discipline: 'Histoire-Geographie',
					hoursPerWeekPerStudent: 3.0,
					totalHoursPerWeek: 12.0,
					sections: 4,
				},
				{
					level: '1ERE',
					discipline: 'Specialite 1',
					hoursPerWeekPerStudent: 4.0,
					totalHoursPerWeek: 16.0,
					sections: 4,
				},
				{
					level: '1ERE',
					discipline: 'Specialite 2',
					hoursPerWeekPerStudent: 4.0,
					totalHoursPerWeek: 16.0,
					sections: 4,
				},
				{
					level: '1ERE',
					discipline: 'Specialite 3',
					hoursPerWeekPerStudent: 4.0,
					totalHoursPerWeek: 16.0,
					sections: 4,
				},
				{
					level: '1ERE',
					discipline: 'Anglais',
					hoursPerWeekPerStudent: 2.5,
					totalHoursPerWeek: 10.0,
					sections: 4,
				},
				{
					level: '1ERE',
					discipline: 'Arabe',
					hoursPerWeekPerStudent: 2.5,
					totalHoursPerWeek: 10.0,
					sections: 4,
				},
				{
					level: '1ERE',
					discipline: 'Espagnol',
					hoursPerWeekPerStudent: 2.0,
					totalHoursPerWeek: 8.0,
					sections: 4,
				},
				{
					level: '1ERE',
					discipline: 'EPS',
					hoursPerWeekPerStudent: 2.0,
					totalHoursPerWeek: 8.0,
					sections: 4,
				},
				{
					level: '1ERE',
					discipline: 'EMC',
					hoursPerWeekPerStudent: 0.5,
					totalHoursPerWeek: 2.0,
					sections: 4,
				},
				{
					level: '1ERE',
					discipline: 'Enseignement Scientifique',
					hoursPerWeekPerStudent: 2.0,
					totalHoursPerWeek: 8.0,
					sections: 4,
				},
			],
			terminale: [
				{
					level: 'TERM',
					discipline: 'Philosophie',
					hoursPerWeekPerStudent: 4.0,
					totalHoursPerWeek: 12.0,
					sections: 3,
				},
				{
					level: 'TERM',
					discipline: 'Mathematiques',
					hoursPerWeekPerStudent: 3.5,
					totalHoursPerWeek: 10.5,
					sections: 3,
				},
				{
					level: 'TERM',
					discipline: 'Histoire-Geographie',
					hoursPerWeekPerStudent: 3.0,
					totalHoursPerWeek: 9.0,
					sections: 3,
				},
				{
					level: 'TERM',
					discipline: 'Specialite 1',
					hoursPerWeekPerStudent: 6.0,
					totalHoursPerWeek: 18.0,
					sections: 3,
				},
				{
					level: 'TERM',
					discipline: 'Specialite 2',
					hoursPerWeekPerStudent: 6.0,
					totalHoursPerWeek: 18.0,
					sections: 3,
				},
				{
					level: 'TERM',
					discipline: 'Anglais',
					hoursPerWeekPerStudent: 2.0,
					totalHoursPerWeek: 6.0,
					sections: 3,
				},
				{
					level: 'TERM',
					discipline: 'Arabe',
					hoursPerWeekPerStudent: 2.0,
					totalHoursPerWeek: 6.0,
					sections: 3,
				},
				{
					level: 'TERM',
					discipline: 'Espagnol',
					hoursPerWeekPerStudent: 2.0,
					totalHoursPerWeek: 6.0,
					sections: 3,
				},
				{
					level: 'TERM',
					discipline: 'EPS',
					hoursPerWeekPerStudent: 2.0,
					totalHoursPerWeek: 6.0,
					sections: 3,
				},
				{
					level: 'TERM',
					discipline: 'EMC',
					hoursPerWeekPerStudent: 0.5,
					totalHoursPerWeek: 1.5,
					sections: 3,
				},
				{
					level: 'TERM',
					discipline: 'Enseignement Scientifique',
					hoursPerWeekPerStudent: 2.0,
					totalHoursPerWeek: 6.0,
					sections: 3,
				},
			],
		},
	};
}

// ── 7. Staff costs (employees) ───────────────────────────────────────────────

function generateStaffCosts() {
	const employees: Array<{
		employeeCode: string;
		name: string;
		functionRole: string;
		department: string;
		status: string;
		joiningDate: string;
		paymentMethod: string;
		isSaudi: boolean;
		isAjeer: boolean;
		isTeaching: boolean;
		hourlyPercentage: string;
		baseSalary: string;
		housingAllowance: string;
		transportAllowance: string;
		responsibilityPremium: string;
		hsaAmount: string;
		augmentation: string;
		augmentationEffectiveDate: string | null;
		ajeerAnnualLevy: string;
		ajeerMonthlyFee: string;
	}> = [];

	let empNum = 1;

	function addEmp(
		role: string,
		dept: string,
		isTeaching: boolean,
		base: number,
		housing: number,
		opts: Partial<{
			isSaudi: boolean;
			isAjeer: boolean;
			hourly: number;
			transport: number;
			resp: number;
			hsa: number;
			aug: number;
			augDate: string;
			ajeerLevy: number;
			ajeerFee: number;
			status: string;
			joining: string;
			payment: string;
		}> = {}
	) {
		const code = `EMP${String(empNum).padStart(4, '0')}`;
		const firstNames = [
			'Marie',
			'Jean',
			'Sophie',
			'Pierre',
			'Fatima',
			'Ahmed',
			'Nour',
			'Khalid',
			'Layla',
			'Omar',
			'Sarah',
			'Youssef',
			'Amina',
			'Hassan',
			'Claire',
			'Thomas',
			'Leila',
			'Mohamed',
			'Julie',
			'Ali',
			'Rania',
			'Karim',
			'Isabelle',
			'Samir',
			'Nadine',
			'Rachid',
			'Camille',
			'Mehdi',
			'Patricia',
			'Amine',
			'Maryam',
			'Tariq',
			'Elise',
			'Walid',
			'Hana',
			'Bilal',
			'Lina',
			'Hamza',
			'Chloe',
			'Faisal',
		];
		const lastNames = [
			'Dupont',
			'Martin',
			'Al-Rashid',
			'Benali',
			'Laurent',
			'Al-Saud',
			'Al-Harbi',
			'Moreau',
			'Khoury',
			'Dubois',
			'Mansouri',
			'Petit',
			'Roux',
			'Al-Qahtani',
			'Bernard',
			'Al-Dosari',
			'Leroy',
			'Al-Shehri',
			'David',
			'Al-Malki',
			'Simon',
			'Boulanger',
			'Chevalier',
			'Al-Ghamdi',
			'Fournier',
			'Al-Zahrani',
			'Girard',
			'Al-Otaibi',
			'Andre',
			'Al-Tamimi',
		];
		const name = `${firstNames[empNum % firstNames.length]} ${lastNames[empNum % lastNames.length]}`;
		empNum++;

		employees.push({
			employeeCode: code,
			name,
			functionRole: role,
			department: dept,
			status: opts.status ?? 'ACTIVE',
			joiningDate: opts.joining ?? `20${18 + (empNum % 7)}-0${1 + (empNum % 9)}-01`,
			paymentMethod: opts.payment ?? 'MONTHLY',
			isSaudi: opts.isSaudi ?? false,
			isAjeer: opts.isAjeer ?? false,
			isTeaching,
			hourlyPercentage: (opts.hourly ?? 1.0).toFixed(4),
			baseSalary: base.toFixed(4),
			housingAllowance: housing.toFixed(4),
			transportAllowance: (opts.transport ?? 500).toFixed(4),
			responsibilityPremium: (opts.resp ?? 0).toFixed(4),
			hsaAmount: (opts.hsa ?? 0).toFixed(4),
			augmentation: (opts.aug ?? 0).toFixed(4),
			augmentationEffectiveDate: opts.augDate ?? null,
			ajeerAnnualLevy: (opts.ajeerLevy ?? 0).toFixed(4),
			ajeerMonthlyFee: (opts.ajeerFee ?? 0).toFixed(4),
		});
	}

	// Management (5)
	addEmp('Proviseur', 'MGMT', false, 28000, 8000, { resp: 3000 });
	addEmp('Proviseur Adjoint', 'MGMT', false, 22000, 7000, { resp: 2000 });
	addEmp('Directeur Primaire', 'MGMT', false, 20000, 6500, { resp: 2000 });
	addEmp('Directeur Maternelle', 'MGMT', false, 18000, 6000, { resp: 1500 });
	addEmp('DAF', 'MGMT', false, 25000, 7500, { resp: 2500 });

	// Admin staff (12)
	for (let i = 0; i < 4; i++) addEmp('Secretaire', 'ADMIN', false, 6000, 2500, { isSaudi: i < 2 });
	for (let i = 0; i < 2; i++) addEmp('Comptable', 'ADMIN', false, 8000, 3000, { isSaudi: true });
	addEmp('RH Manager', 'ADMIN', false, 12000, 4500);
	addEmp('RH Assistant', 'ADMIN', false, 6500, 2500, { isSaudi: true });
	addEmp('Responsable Inscriptions', 'ADMIN', false, 7500, 3000);
	addEmp('Assistant Inscriptions', 'ADMIN', false, 5500, 2000, { isSaudi: true });
	addEmp('Responsable Communication', 'ADMIN', false, 9000, 3500);
	addEmp('Infirmiere', 'ADMIN', false, 7000, 3000);

	// Teaching staff — Maternelle (12)
	for (let i = 0; i < 9; i++)
		addEmp('Enseignant Maternelle', 'TEACHING', true, 14000, 5000, { hsa: i < 3 ? 1500 : 0 });
	for (let i = 0; i < 3; i++) addEmp('ASEM', 'TEACHING', true, 5000, 2000, { isSaudi: true });

	// Teaching staff — Elementaire (18)
	for (let i = 0; i < 15; i++)
		addEmp('Enseignant Elementaire', 'TEACHING', true, 14500, 5000, {
			hsa: i < 5 ? 1500 : 0,
			aug: i < 3 ? 500 : 0,
			augDate: i < 3 ? '2026-01-01' : null,
		});
	for (let i = 0; i < 3; i++) addEmp('Professeur Anglais Elem', 'TEACHING', true, 13000, 4500);

	// Teaching staff — College (22)
	for (let i = 0; i < 5; i++)
		addEmp('Professeur Francais College', 'TEACHING', true, 15000, 5500, { hsa: i < 2 ? 2000 : 0 });
	for (let i = 0; i < 5; i++) addEmp('Professeur Maths College', 'TEACHING', true, 15000, 5500);
	for (let i = 0; i < 3; i++) addEmp('Professeur HG College', 'TEACHING', true, 14000, 5000);
	for (let i = 0; i < 2; i++) addEmp('Professeur SVT', 'TEACHING', true, 14500, 5000);
	for (let i = 0; i < 2; i++) addEmp('Professeur Physique-Chimie', 'TEACHING', true, 14500, 5000);
	addEmp('Professeur Technologie', 'TEACHING', true, 13500, 4500);
	addEmp('Professeur Arts Plastiques', 'TEACHING', true, 12000, 4000);
	addEmp('Professeur Musique', 'TEACHING', true, 12000, 4000);
	for (let i = 0; i < 2; i++) addEmp('Professeur EPS', 'TEACHING', true, 13000, 4500);

	// Teaching staff — Lycee (16)
	for (let i = 0; i < 3; i++)
		addEmp('Professeur Francais Lycee', 'TEACHING', true, 16000, 6000, {
			hsa: 2000,
			resp: i === 0 ? 1000 : 0,
		});
	for (let i = 0; i < 3; i++)
		addEmp('Professeur Maths Lycee', 'TEACHING', true, 16000, 6000, { hsa: 2000 });
	for (let i = 0; i < 2; i++) addEmp('Professeur Philosophie', 'TEACHING', true, 15000, 5500);
	for (let i = 0; i < 2; i++) addEmp('Professeur SES', 'TEACHING', true, 14000, 5000);
	for (let i = 0; i < 2; i++) addEmp('Professeur SVT Lycee', 'TEACHING', true, 15000, 5500);
	for (let i = 0; i < 2; i++)
		addEmp('Professeur Physique-Chimie Lycee', 'TEACHING', true, 15000, 5500);
	for (let i = 0; i < 2; i++) addEmp('Professeur HG Lycee', 'TEACHING', true, 15000, 5500);

	// Language teachers — shared across levels (10)
	for (let i = 0; i < 4; i++) addEmp('Professeur Anglais', 'TEACHING', true, 13500, 4500);
	for (let i = 0; i < 4; i++)
		addEmp('Professeur Arabe', 'TEACHING', true, 8000, 3000, { isSaudi: true });
	for (let i = 0; i < 2; i++) addEmp('Professeur Espagnol', 'TEACHING', true, 13000, 4500);

	// CPE & Vie Scolaire (6)
	for (let i = 0; i < 2; i++) addEmp('CPE', 'TEACHING', false, 12000, 4500, { resp: 1000 });
	for (let i = 0; i < 4; i++)
		addEmp('Surveillant', 'TEACHING', false, 4500, 1500, { isSaudi: true });

	// Support staff (15)
	for (let i = 0; i < 2; i++) addEmp('Responsable IT', 'SUPPORT', false, 10000, 4000);
	for (let i = 0; i < 2; i++)
		addEmp('Technicien IT', 'SUPPORT', false, 6500, 2500, { isSaudi: i === 0 });
	addEmp('Bibliothecaire', 'SUPPORT', false, 7000, 3000);
	addEmp('Laborantin', 'SUPPORT', false, 5500, 2000, { isSaudi: true });
	for (let i = 0; i < 2; i++)
		addEmp('Chauffeur', 'SUPPORT', false, 4000, 1500, {
			isSaudi: true,
			isAjeer: true,
			ajeerLevy: 9600,
			ajeerFee: 200,
		});
	for (let i = 0; i < 3; i++)
		addEmp('Agent de Securite', 'SUPPORT', false, 3500, 1200, {
			isSaudi: true,
			isAjeer: true,
			ajeerLevy: 9600,
			ajeerFee: 200,
		});

	// Maintenance (8)
	for (let i = 0; i < 3; i++)
		addEmp('Technicien Maintenance', 'MAINT', false, 4500, 1500, { isSaudi: true });
	for (let i = 0; i < 5; i++)
		addEmp('Agent Entretien', 'MAINT', false, 3500, 1200, {
			isSaudi: false,
			isAjeer: true,
			ajeerLevy: 9600,
			ajeerFee: 200,
		});

	return employees;
}

// ── 8. Historical enrollment CSVs ────────────────────────────────────────────

function generateEnrollmentCsvs() {
	const yearTotals: Record<string, number> = {
		'2021-22': 1434,
		'2022-23': 1499,
		'2023-24': 1587,
		'2024-25': 1794,
		'2025-26': 1747,
	};

	// Base distribution weights per grade (will be scaled to hit totals)
	const gradeWeights: Record<string, number> = {
		PS: 0.054,
		MS: 0.057,
		GS: 0.059,
		CP: 0.062,
		CE1: 0.063,
		CE2: 0.064,
		CM1: 0.066,
		CM2: 0.068,
		'6EME': 0.073,
		'5EME': 0.075,
		'4EME': 0.077,
		'3EME': 0.078,
		'2NDE': 0.07,
		'1ERE': 0.068,
		TERM: 0.066,
	};

	const csvs: Record<string, string> = {};

	for (const [yearKey, total] of Object.entries(yearTotals)) {
		const gradeOrder = GRADES.map((g) => g.code);
		const rawCounts: Record<string, number> = {};
		let rawSum = 0;

		// Calculate raw counts
		for (const code of gradeOrder) {
			const count = Math.round(total * gradeWeights[code]!);
			rawCounts[code] = count;
			rawSum += count;
		}

		// Adjust last grade to hit exact total
		const diff = total - rawSum;
		rawCounts['TERM'] = rawCounts['TERM']! + diff;

		// Verify
		const actualSum = Object.values(rawCounts).reduce((a, b) => a + b, 0);
		if (actualSum !== total) {
			throw new Error(`CSV sum mismatch for ${yearKey}: ${actualSum} != ${total}`);
		}

		const lines = ['level_code,student_count'];
		for (const code of gradeOrder) {
			lines.push(`${code},${rawCounts[code]}`);
		}
		csvs[yearKey] = lines.join('\n') + '\n';
	}

	return csvs;
}

// ── Main: write all files ────────────────────────────────────────────────────

function writeJson(filename: string, data: unknown) {
	const path = resolve(FIXTURES, filename);
	writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
	// eslint-disable-next-line no-console
	console.log(`  Wrote ${path}`);
}

function writeCsv(filename: string, content: string) {
	const path = resolve(ENROLLMENT, filename);
	writeFileSync(path, content);
	// eslint-disable-next-line no-console
	console.log(`  Wrote ${path}`);
}

// eslint-disable-next-line no-console
console.log('=== Generating BudFin Migration Fixtures ===\n');

// 1. Grade code mapping
const mapping = generateGradeCodeMapping();
writeJson('grade-code-mapping.json', mapping);

// 2. Fee grid
const feeGrid = generateFeeGrid();
// eslint-disable-next-line no-console
console.log(`  fee_grids: ${feeGrid.length} rows (expected 270)`);
writeJson('fy2026-fee-grid.json', feeGrid);

// 3. Discounts
const discounts = generateDiscounts();
writeJson('fy2026-discounts.json', discounts);

// 4. Enrollment detail
const enrollmentDetail = generateEnrollmentDetail();
const ay1Total = enrollmentDetail
	.filter((e) => e.academicPeriod === 'AY1')
	.reduce((sum, e) => sum + e.headcount, 0);
// eslint-disable-next-line no-console
console.log(
	`  enrollment_detail: ${enrollmentDetail.length} rows, AY1 total: ${ay1Total} (expected 214 / 1753)`
);
writeJson('fy2026-enrollment-detail.json', enrollmentDetail);

// 5. Other revenue
const otherRevenue = generateOtherRevenue();
// eslint-disable-next-line no-console
console.log(`  other_revenue: ${otherRevenue.length} items (expected 21)`);
writeJson('fy2026-other-revenue.json', otherRevenue);

// 6. DHG structure
const dhg = generateDhgStructure();
writeJson('fy2026-dhg-structure.json', dhg);

// 7. Staff costs
const staff = generateStaffCosts();
// eslint-disable-next-line no-console
console.log(`  employees: ${staff.length} records`);
writeJson('fy2026-staff-costs.json', staff);

// 8. Historical enrollment CSVs
const csvs = generateEnrollmentCsvs();
for (const [yearKey, content] of Object.entries(csvs)) {
	writeCsv(`enrollment_${yearKey}.csv`, content);
}

// eslint-disable-next-line no-console
console.log('\n=== Fixture generation complete ===');
