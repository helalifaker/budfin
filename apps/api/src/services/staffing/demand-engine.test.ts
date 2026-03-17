import { Decimal } from 'decimal.js';
import { describe, expect, it } from 'vitest';

import {
	calculateDemand,
	gradeToBand,
	type DemandEngineInput,
	type DemandServiceProfile,
} from './demand-engine.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeProfiles(): Map<string, DemandServiceProfile> {
	const defaults: Record<string, DemandServiceProfile> = {
		PE: { weeklyServiceHours: new Decimal(24), hsaEligible: false },
		CERTIFIE: { weeklyServiceHours: new Decimal(18), hsaEligible: true },
		AGREGE: { weeklyServiceHours: new Decimal(15), hsaEligible: true },
		EPS: { weeklyServiceHours: new Decimal(20), hsaEligible: true },
		ARABIC_ISLAMIC: { weeklyServiceHours: new Decimal(24), hsaEligible: false },
		ASEM: { weeklyServiceHours: new Decimal(0), hsaEligible: false },
		DOCUMENTALISTE: { weeklyServiceHours: new Decimal(30), hsaEligible: false },
	};
	return new Map(Object.entries(defaults));
}

function defaultSettings(): DemandEngineInput['settings'] {
	return {
		hsaTargetHours: new Decimal('1.5'),
		academicWeeks: 36,
	};
}

// ── gradeToBand ──────────────────────────────────────────────────────────────

describe('gradeToBand', () => {
	it('maps maternelle grades', () => {
		expect(gradeToBand('PS')).toBe('MATERNELLE');
		expect(gradeToBand('MS')).toBe('MATERNELLE');
		expect(gradeToBand('GS')).toBe('MATERNELLE');
	});

	it('maps elementaire grades', () => {
		expect(gradeToBand('CP')).toBe('ELEMENTAIRE');
		expect(gradeToBand('CE1')).toBe('ELEMENTAIRE');
		expect(gradeToBand('CM2')).toBe('ELEMENTAIRE');
	});

	it('maps college grades', () => {
		expect(gradeToBand('6EME')).toBe('COLLEGE');
		expect(gradeToBand('3EME')).toBe('COLLEGE');
	});

	it('maps lycee grades', () => {
		expect(gradeToBand('2NDE')).toBe('LYCEE');
		expect(gradeToBand('1ERE')).toBe('LYCEE');
		expect(gradeToBand('TERM')).toBe('LYCEE');
	});

	it('is case insensitive', () => {
		expect(gradeToBand('ps')).toBe('MATERNELLE');
		expect(gradeToBand('Cp')).toBe('ELEMENTAIRE');
	});

	it('throws for unknown grades', () => {
		expect(() => gradeToBand('UNKNOWN')).toThrow('Unknown grade level: UNKNOWN');
	});
});

// ── SECTION Driver ───────────────────────────────────────────────────────────

describe('SECTION driver (primary homeroom)', () => {
	it('AC-02: produces FTE = sections needed (1:1)', () => {
		const input: DemandEngineInput = {
			enrollments: [{ gradeLevel: 'CP', headcount: 120, maxClassSize: 25 }],
			rules: [
				{
					gradeLevel: 'CP',
					disciplineCode: 'PRIMARY_HOMEROOM',
					lineType: 'STRUCTURAL',
					driverType: 'SECTION',
					hoursPerUnit: new Decimal(0),
					serviceProfileCode: 'PE',
					languageCode: null,
					groupingKey: null,
				},
			],
			groupAssumptions: [],
			settings: defaultSettings(),
			serviceProfiles: makeProfiles(),
		};

		const result = calculateDemand(input);

		// 120/25 = 4.8, ceil = 5 sections
		expect(result.sources).toHaveLength(1);
		expect(result.sources[0]!.driverUnits).toBe(5);
		expect(result.sources[0]!.totalWeeklyHours.toNumber()).toBe(0);

		expect(result.lines).toHaveLength(1);
		const line = result.lines[0]!;
		expect(line.band).toBe('ELEMENTAIRE');
		expect(line.disciplineCode).toBe('PRIMARY_HOMEROOM');
		expect(line.driverType).toBe('SECTION');
		expect(line.requiredFteRaw.toNumber()).toBe(5);
		expect(line.requiredFtePlanned.toNumber()).toBe(5);
		expect(line.recommendedPositions).toBe(5);
	});
});

// ── HOURS Driver ─────────────────────────────────────────────────────────────

describe('HOURS driver (secondary subjects)', () => {
	it('AC-03: produces FTE = totalWeeklyHours / baseOrs', () => {
		const input: DemandEngineInput = {
			enrollments: [{ gradeLevel: '6EME', headcount: 150, maxClassSize: 30 }],
			rules: [
				{
					gradeLevel: '6EME',
					disciplineCode: 'FRANCAIS',
					lineType: 'STRUCTURAL',
					driverType: 'HOURS',
					hoursPerUnit: new Decimal('4.5'),
					serviceProfileCode: 'CERTIFIE',
					languageCode: 'FR',
					groupingKey: null,
				},
			],
			groupAssumptions: [],
			settings: defaultSettings(),
			serviceProfiles: makeProfiles(),
		};

		const result = calculateDemand(input);

		// 150/30 = 5 sections, 5 * 4.5 = 22.5 hours/week
		expect(result.sources).toHaveLength(1);
		expect(result.sources[0]!.driverUnits).toBe(5);
		expect(result.sources[0]!.totalWeeklyHours.toNumber()).toBe(22.5);

		expect(result.lines).toHaveLength(1);
		const line = result.lines[0]!;
		expect(line.band).toBe('COLLEGE');
		// FTE raw = 22.5 / 18 = 1.25
		expect(line.requiredFteRaw.toFixed(4)).toBe('1.2500');
		// FTE planned = 22.5 / (18 + 1.5) = 22.5 / 19.5 = 1.1538...
		expect(line.requiredFtePlanned.toFixed(4)).toBe('1.1538');
		expect(line.recommendedPositions).toBe(2); // ceil(1.25) = 2
		expect(line.baseOrs.toNumber()).toBe(18);
		expect(line.effectiveOrs.toNumber()).toBe(19.5);
	});
});

// ── GROUP Driver ─────────────────────────────────────────────────────────────

describe('GROUP driver (Lycee specialties)', () => {
	it('AC-04: uses VersionLyceeGroupAssumption when present', () => {
		const input: DemandEngineInput = {
			enrollments: [{ gradeLevel: '2NDE', headcount: 200, maxClassSize: 35 }],
			rules: [
				{
					gradeLevel: '2NDE',
					disciplineCode: 'NSI',
					lineType: 'SPECIALTY',
					driverType: 'GROUP',
					hoursPerUnit: new Decimal('4'),
					serviceProfileCode: 'CERTIFIE',
					languageCode: null,
					groupingKey: null,
				},
			],
			groupAssumptions: [
				{
					gradeLevel: '2NDE',
					disciplineCode: 'NSI',
					groupCount: 3,
					hoursPerGroup: new Decimal('4'),
				},
			],
			settings: defaultSettings(),
			serviceProfiles: makeProfiles(),
		};

		const result = calculateDemand(input);

		// 3 groups * 4 hours = 12 hours/week
		expect(result.sources).toHaveLength(1);
		expect(result.sources[0]!.driverUnits).toBe(3);
		expect(result.sources[0]!.totalWeeklyHours.toNumber()).toBe(12);

		const line = result.lines[0]!;
		// FTE raw = 12 / 18 = 0.6667
		expect(line.requiredFteRaw.toFixed(4)).toBe('0.6667');
		expect(line.recommendedPositions).toBe(1);
	});

	it('AC-04: falls back to DhgRule.hoursPerUnit when no assumption', () => {
		const input: DemandEngineInput = {
			enrollments: [{ gradeLevel: '2NDE', headcount: 200, maxClassSize: 35 }],
			rules: [
				{
					gradeLevel: '2NDE',
					disciplineCode: 'SES',
					lineType: 'SPECIALTY',
					driverType: 'GROUP',
					hoursPerUnit: new Decimal('3'),
					serviceProfileCode: 'CERTIFIE',
					languageCode: null,
					groupingKey: null,
				},
			],
			groupAssumptions: [], // No assumption => groupCount = 0
			settings: defaultSettings(),
			serviceProfiles: makeProfiles(),
		};

		const result = calculateDemand(input);

		// No assumption → groupCount = 0, totalWeeklyHours = 0
		expect(result.sources).toHaveLength(1);
		expect(result.sources[0]!.driverUnits).toBe(0);
		expect(result.sources[0]!.totalWeeklyHours.toNumber()).toBe(0);
		// Zero-demand lines omitted from lines output
		expect(result.lines).toHaveLength(0);
	});
});

// ── HSA Eligibility ──────────────────────────────────────────────────────────

describe('HSA eligibility', () => {
	it('AC-06: effectiveOrs includes HSA for eligible profiles', () => {
		const input: DemandEngineInput = {
			enrollments: [{ gradeLevel: '4EME', headcount: 90, maxClassSize: 30 }],
			rules: [
				{
					gradeLevel: '4EME',
					disciplineCode: 'MATHEMATIQUES',
					lineType: 'STRUCTURAL',
					driverType: 'HOURS',
					hoursPerUnit: new Decimal('4'),
					serviceProfileCode: 'CERTIFIE', // HSA eligible
					languageCode: null,
					groupingKey: null,
				},
			],
			groupAssumptions: [],
			settings: defaultSettings(),
			serviceProfiles: makeProfiles(),
		};

		const result = calculateDemand(input);
		const line = result.lines[0]!;

		expect(line.baseOrs.toNumber()).toBe(18);
		expect(line.effectiveOrs.toNumber()).toBe(19.5); // 18 + 1.5
	});

	it('AC-06: effectiveOrs = baseOrs for non-eligible profiles', () => {
		const input: DemandEngineInput = {
			enrollments: [{ gradeLevel: 'CP', headcount: 50, maxClassSize: 25 }],
			rules: [
				{
					gradeLevel: 'CP',
					disciplineCode: 'ARABE',
					lineType: 'STRUCTURAL',
					driverType: 'HOURS',
					hoursPerUnit: new Decimal('3'),
					serviceProfileCode: 'ARABIC_ISLAMIC', // Not HSA eligible
					languageCode: 'AR',
					groupingKey: null,
				},
			],
			groupAssumptions: [],
			settings: defaultSettings(),
			serviceProfiles: makeProfiles(),
		};

		const result = calculateDemand(input);
		const line = result.lines[0]!;

		expect(line.baseOrs.toNumber()).toBe(24);
		expect(line.effectiveOrs.toNumber()).toBe(24); // No HSA
		expect(line.requiredFteRaw.toFixed(4)).toBe('0.2500'); // 6/24
		expect(line.requiredFtePlanned.toFixed(4)).toBe('0.2500'); // Same, no HSA
	});
});

// ── Band Aggregation ─────────────────────────────────────────────────────────

describe('band aggregation', () => {
	it('AC-05: aggregates sources by (band, disciplineCode, lineType)', () => {
		const input: DemandEngineInput = {
			enrollments: [
				{ gradeLevel: '6EME', headcount: 120, maxClassSize: 30 },
				{ gradeLevel: '5EME', headcount: 100, maxClassSize: 30 },
			],
			rules: [
				{
					gradeLevel: '6EME',
					disciplineCode: 'FRANCAIS',
					lineType: 'STRUCTURAL',
					driverType: 'HOURS',
					hoursPerUnit: new Decimal('4.5'),
					serviceProfileCode: 'CERTIFIE',
					languageCode: 'FR',
					groupingKey: null,
				},
				{
					gradeLevel: '5EME',
					disciplineCode: 'FRANCAIS',
					lineType: 'STRUCTURAL',
					driverType: 'HOURS',
					hoursPerUnit: new Decimal('4'),
					serviceProfileCode: 'CERTIFIE',
					languageCode: 'FR',
					groupingKey: null,
				},
			],
			groupAssumptions: [],
			settings: defaultSettings(),
			serviceProfiles: makeProfiles(),
		};

		const result = calculateDemand(input);

		// 2 source rows (one per grade)
		expect(result.sources).toHaveLength(2);

		// 1 aggregated line (both are COLLEGE / FRANCAIS / STRUCTURAL)
		expect(result.lines).toHaveLength(1);
		const line = result.lines[0]!;
		expect(line.band).toBe('COLLEGE');
		expect(line.disciplineCode).toBe('FRANCAIS');

		// 6EME: 120/30=4 sections * 4.5 = 18h. 5EME: 100/30=ceil=4 sections * 4 = 16h. Total = 34h
		expect(line.totalWeeklyHours.toNumber()).toBe(34);
		expect(line.totalDriverUnits).toBe(8); // 4 + 4
		// FTE raw = 34 / 18 = 1.8889
		expect(line.requiredFteRaw.toFixed(4)).toBe('1.8889');
		expect(line.recommendedPositions).toBe(2); // ceil(1.8889) = 2
	});
});

// ── Zero Enrollment ──────────────────────────────────────────────────────────

describe('zero enrollment', () => {
	it('AC-08: skips grades with zero headcount', () => {
		const input: DemandEngineInput = {
			enrollments: [{ gradeLevel: 'CP', headcount: 0, maxClassSize: 25 }],
			rules: [
				{
					gradeLevel: 'CP',
					disciplineCode: 'PRIMARY_HOMEROOM',
					lineType: 'STRUCTURAL',
					driverType: 'SECTION',
					hoursPerUnit: new Decimal(0),
					serviceProfileCode: 'PE',
					languageCode: null,
					groupingKey: null,
				},
			],
			groupAssumptions: [],
			settings: defaultSettings(),
			serviceProfiles: makeProfiles(),
		};

		const result = calculateDemand(input);

		expect(result.sources).toHaveLength(0);
		expect(result.lines).toHaveLength(0);
	});

	it('AC-08: zero-demand lines omitted from lines, retained in sources', () => {
		const input: DemandEngineInput = {
			enrollments: [{ gradeLevel: '2NDE', headcount: 100, maxClassSize: 35 }],
			rules: [
				{
					gradeLevel: '2NDE',
					disciplineCode: 'SPECIALTY_A',
					lineType: 'SPECIALTY',
					driverType: 'GROUP',
					hoursPerUnit: new Decimal('3'),
					serviceProfileCode: 'CERTIFIE',
					languageCode: null,
					groupingKey: null,
				},
			],
			groupAssumptions: [], // No groups → driverUnits = 0, totalWeeklyHours = 0
			settings: defaultSettings(),
			serviceProfiles: makeProfiles(),
		};

		const result = calculateDemand(input);

		// Source row exists (for audit)
		expect(result.sources).toHaveLength(1);
		expect(result.sources[0]!.driverUnits).toBe(0);
		// Line omitted (zero demand)
		expect(result.lines).toHaveLength(0);
	});
});

// ── Division by Zero Guard ───────────────────────────────────────────────────

describe('division by zero guard', () => {
	it('AC-09: throws when HOURS driver used with ORS=0 profile', () => {
		const input: DemandEngineInput = {
			enrollments: [{ gradeLevel: 'PS', headcount: 50, maxClassSize: 25 }],
			rules: [
				{
					gradeLevel: 'PS',
					disciplineCode: 'ASEM',
					lineType: 'STRUCTURAL',
					driverType: 'HOURS', // Wrong! ASEM has ORS=0
					hoursPerUnit: new Decimal('2'),
					serviceProfileCode: 'ASEM',
					languageCode: null,
					groupingKey: null,
				},
			],
			groupAssumptions: [],
			settings: defaultSettings(),
			serviceProfiles: makeProfiles(),
		};

		expect(() => calculateDemand(input)).toThrow('Cannot divide by zero ORS');
	});

	it('AC-09: SECTION driver works fine with ORS=0 (ASEM)', () => {
		const input: DemandEngineInput = {
			enrollments: [{ gradeLevel: 'PS', headcount: 50, maxClassSize: 25 }],
			rules: [
				{
					gradeLevel: 'PS',
					disciplineCode: 'ASEM',
					lineType: 'STRUCTURAL',
					driverType: 'SECTION', // Correct for ASEM
					hoursPerUnit: new Decimal(0),
					serviceProfileCode: 'ASEM',
					languageCode: null,
					groupingKey: null,
				},
			],
			groupAssumptions: [],
			settings: defaultSettings(),
			serviceProfiles: makeProfiles(),
		};

		const result = calculateDemand(input);

		expect(result.lines).toHaveLength(1);
		const line = result.lines[0]!;
		expect(line.requiredFteRaw.toNumber()).toBe(2); // ceil(50/25) = 2 sections
		expect(line.baseOrs.toNumber()).toBe(0);
		expect(line.effectiveOrs.toNumber()).toBe(0);
	});
});

// ── Pure Function ────────────────────────────────────────────────────────────

describe('pure function', () => {
	it('AC-11: produces deterministic output for same input', () => {
		const input: DemandEngineInput = {
			enrollments: [{ gradeLevel: '6EME', headcount: 90, maxClassSize: 30 }],
			rules: [
				{
					gradeLevel: '6EME',
					disciplineCode: 'MATHEMATIQUES',
					lineType: 'STRUCTURAL',
					driverType: 'HOURS',
					hoursPerUnit: new Decimal('4'),
					serviceProfileCode: 'CERTIFIE',
					languageCode: null,
					groupingKey: null,
				},
			],
			groupAssumptions: [],
			settings: defaultSettings(),
			serviceProfiles: makeProfiles(),
		};

		const result1 = calculateDemand(input);
		const result2 = calculateDemand(input);

		expect(result1.sources.length).toBe(result2.sources.length);
		expect(result1.lines.length).toBe(result2.lines.length);
		expect(result1.lines[0]!.requiredFteRaw.eq(result2.lines[0]!.requiredFteRaw)).toBe(true);
	});

	it('does not modify input', () => {
		const enrollments = [{ gradeLevel: '6EME', headcount: 90, maxClassSize: 30 }];
		const rules = [
			{
				gradeLevel: '6EME',
				disciplineCode: 'MATHEMATIQUES',
				lineType: 'STRUCTURAL',
				driverType: 'HOURS',
				hoursPerUnit: new Decimal('4'),
				serviceProfileCode: 'CERTIFIE',
				languageCode: null,
				groupingKey: null,
			},
		];

		const input: DemandEngineInput = {
			enrollments,
			rules,
			groupAssumptions: [],
			settings: defaultSettings(),
			serviceProfiles: makeProfiles(),
		};

		const enrollmentsBefore = JSON.stringify(enrollments);
		const rulesBefore = JSON.stringify(rules);

		calculateDemand(input);

		expect(JSON.stringify(enrollments)).toBe(enrollmentsBefore);
		expect(JSON.stringify(rules)).toBe(rulesBefore);
	});
});

// ── recommendedPositions ─────────────────────────────────────────────────────

describe('recommendedPositions', () => {
	it('AC-07: recommendedPositions = CEIL(requiredFteRaw)', () => {
		const input: DemandEngineInput = {
			enrollments: [{ gradeLevel: '3EME', headcount: 90, maxClassSize: 30 }],
			rules: [
				{
					gradeLevel: '3EME',
					disciplineCode: 'ANGLAIS_LV1',
					lineType: 'STRUCTURAL',
					driverType: 'HOURS',
					hoursPerUnit: new Decimal('3'),
					serviceProfileCode: 'CERTIFIE',
					languageCode: 'EN',
					groupingKey: null,
				},
			],
			groupAssumptions: [],
			settings: defaultSettings(),
			serviceProfiles: makeProfiles(),
		};

		const result = calculateDemand(input);
		const line = result.lines[0]!;

		// 3 sections * 3h = 9h/week. FTE = 9/18 = 0.5
		expect(line.requiredFteRaw.toNumber()).toBe(0.5);
		expect(line.recommendedPositions).toBe(1); // ceil(0.5)
	});
});

// ── Line Labels ──────────────────────────────────────────────────────────────

describe('line labels', () => {
	it('builds label with band and discipline', () => {
		const input: DemandEngineInput = {
			enrollments: [{ gradeLevel: '6EME', headcount: 30, maxClassSize: 30 }],
			rules: [
				{
					gradeLevel: '6EME',
					disciplineCode: 'FRANCAIS',
					lineType: 'STRUCTURAL',
					driverType: 'HOURS',
					hoursPerUnit: new Decimal('4'),
					serviceProfileCode: 'CERTIFIE',
					languageCode: null,
					groupingKey: null,
				},
			],
			groupAssumptions: [],
			settings: defaultSettings(),
			serviceProfiles: makeProfiles(),
		};

		const result = calculateDemand(input);
		expect(result.lines[0]!.lineLabel).toBe('College — FRANCAIS');
	});

	it('includes lineType in label for non-STRUCTURAL', () => {
		const input: DemandEngineInput = {
			enrollments: [{ gradeLevel: '2NDE', headcount: 100, maxClassSize: 35 }],
			rules: [
				{
					gradeLevel: '2NDE',
					disciplineCode: 'ARABE',
					lineType: 'HOST_COUNTRY',
					driverType: 'HOURS',
					hoursPerUnit: new Decimal('2'),
					serviceProfileCode: 'ARABIC_ISLAMIC',
					languageCode: 'AR',
					groupingKey: null,
				},
			],
			groupAssumptions: [],
			settings: defaultSettings(),
			serviceProfiles: makeProfiles(),
		};

		const result = calculateDemand(input);
		expect(result.lines[0]!.lineLabel).toBe('Lycee — ARABE (host_country)');
	});
});

// ── FTE Totals ───────────────────────────────────────────────────────────────

describe('FTE totals', () => {
	it('AC-07: totals sum raw FTE, not rounded positions', () => {
		const input: DemandEngineInput = {
			enrollments: [{ gradeLevel: '6EME', headcount: 90, maxClassSize: 30 }],
			rules: [
				{
					gradeLevel: '6EME',
					disciplineCode: 'FRANCAIS',
					lineType: 'STRUCTURAL',
					driverType: 'HOURS',
					hoursPerUnit: new Decimal('4.5'),
					serviceProfileCode: 'CERTIFIE',
					languageCode: null,
					groupingKey: null,
				},
				{
					gradeLevel: '6EME',
					disciplineCode: 'MATHEMATIQUES',
					lineType: 'STRUCTURAL',
					driverType: 'HOURS',
					hoursPerUnit: new Decimal('4'),
					serviceProfileCode: 'CERTIFIE',
					languageCode: null,
					groupingKey: null,
				},
			],
			groupAssumptions: [],
			settings: defaultSettings(),
			serviceProfiles: makeProfiles(),
		};

		const result = calculateDemand(input);

		// 3 sections. FR: 3*4.5=13.5h, FTE=13.5/18=0.75. MATH: 3*4=12h, FTE=12/18=0.6667
		const totalRawFte = result.lines.reduce((sum, l) => sum.plus(l.requiredFteRaw), new Decimal(0));
		const totalRoundedPositions = result.lines.reduce((sum, l) => sum + l.recommendedPositions, 0);

		// Raw FTE total = 0.75 + 0.6667 = 1.4167
		expect(totalRawFte.toFixed(4)).toBe('1.4167');
		// Rounded positions total = 1 + 1 = 2 (more than raw)
		expect(totalRoundedPositions).toBe(2);
	});
});
