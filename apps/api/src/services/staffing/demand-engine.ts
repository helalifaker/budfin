import { Decimal } from 'decimal.js';

// ── Input Types ──────────────────────────────────────────────────────────────

export interface DemandEnrollmentInput {
	gradeLevel: string;
	headcount: number;
	maxClassSize: number;
}

export interface DemandRuleInput {
	gradeLevel: string;
	disciplineCode: string;
	lineType: string;
	driverType: string;
	hoursPerUnit: Decimal;
	serviceProfileCode: string;
	languageCode: string | null;
	groupingKey: string | null;
}

export interface GroupAssumptionInput {
	gradeLevel: string;
	disciplineCode: string;
	groupCount: number;
	hoursPerGroup: Decimal;
}

export interface DemandServiceProfile {
	weeklyServiceHours: Decimal;
	hsaEligible: boolean;
}

export interface DemandSettings {
	hsaTargetHours: Decimal;
	academicWeeks: number;
}

export interface DemandEngineInput {
	enrollments: DemandEnrollmentInput[];
	rules: DemandRuleInput[];
	groupAssumptions: GroupAssumptionInput[];
	settings: DemandSettings;
	serviceProfiles: Map<string, DemandServiceProfile>;
}

// ── Output Types ─────────────────────────────────────────────────────────────

export interface RequirementSource {
	gradeLevel: string;
	disciplineCode: string;
	lineType: string;
	driverType: string;
	headcount: number;
	maxClassSize: number;
	driverUnits: number;
	hoursPerUnit: Decimal;
	totalWeeklyHours: Decimal;
}

export interface RequirementLine {
	band: string;
	disciplineCode: string;
	lineLabel: string;
	lineType: string;
	driverType: string;
	serviceProfileCode: string;
	totalDriverUnits: number;
	totalWeeklyHours: Decimal;
	baseOrs: Decimal;
	effectiveOrs: Decimal;
	requiredFteRaw: Decimal;
	requiredFtePlanned: Decimal;
	recommendedPositions: number;
}

export interface DemandEngineOutput {
	sources: RequirementSource[];
	lines: RequirementLine[];
}

// ── Band Mapping ─────────────────────────────────────────────────────────────

const GRADE_TO_BAND: Record<string, string> = {
	PS: 'MATERNELLE',
	MS: 'MATERNELLE',
	GS: 'MATERNELLE',
	CP: 'ELEMENTAIRE',
	CE1: 'ELEMENTAIRE',
	CE2: 'ELEMENTAIRE',
	CM1: 'ELEMENTAIRE',
	CM2: 'ELEMENTAIRE',
	'6EME': 'COLLEGE',
	'5EME': 'COLLEGE',
	'4EME': 'COLLEGE',
	'3EME': 'COLLEGE',
	'2NDE': 'LYCEE',
	'1ERE': 'LYCEE',
	TERM: 'LYCEE',
};

export function gradeToBand(gradeLevel: string): string {
	const band = GRADE_TO_BAND[gradeLevel.toUpperCase()];
	if (!band) {
		throw new Error(`Unknown grade level: ${gradeLevel}`);
	}
	return band;
}

// ── Line Label Builder ───────────────────────────────────────────────────────

function buildLineLabel(band: string, disciplineCode: string, lineType: string): string {
	const bandLabel = band.charAt(0) + band.slice(1).toLowerCase();
	const disciplineLabel = disciplineCode.replace(/_/g, ' ');
	if (lineType !== 'STRUCTURAL') {
		return `${bandLabel} — ${disciplineLabel} (${lineType.toLowerCase()})`;
	}
	return `${bandLabel} — ${disciplineLabel}`;
}

// ── Demand Engine (Pure Function) ────────────────────────────────────────────

export function calculateDemand(input: DemandEngineInput): DemandEngineOutput {
	const { enrollments, rules, groupAssumptions, settings, serviceProfiles } = input;

	// Build enrollment lookup
	const enrollmentMap = new Map<string, DemandEnrollmentInput>();
	for (const e of enrollments) {
		enrollmentMap.set(e.gradeLevel, e);
	}

	// Build group assumption lookup: key = `${gradeLevel}|${disciplineCode}`
	const groupMap = new Map<string, GroupAssumptionInput>();
	for (const ga of groupAssumptions) {
		groupMap.set(`${ga.gradeLevel}|${ga.disciplineCode}`, ga);
	}

	// STEP 1: Compute requirement source rows
	const sources: RequirementSource[] = [];

	for (const rule of rules) {
		const enrollment = enrollmentMap.get(rule.gradeLevel);
		if (!enrollment || enrollment.headcount <= 0) continue;

		const sectionsNeeded = Math.ceil(enrollment.headcount / enrollment.maxClassSize);
		let driverUnits: number;
		let totalWeeklyHours: Decimal;
		let hoursPerUnit: Decimal;

		switch (rule.driverType) {
			case 'SECTION':
				driverUnits = sectionsNeeded;
				totalWeeklyHours = new Decimal(0);
				hoursPerUnit = new Decimal(0);
				break;

			case 'HOURS':
				driverUnits = sectionsNeeded;
				hoursPerUnit = rule.hoursPerUnit;
				totalWeeklyHours = new Decimal(driverUnits).times(hoursPerUnit);
				break;

			case 'GROUP': {
				const gaKey = `${rule.gradeLevel}|${rule.disciplineCode}`;
				const ga = groupMap.get(gaKey);
				driverUnits = ga?.groupCount ?? 0;
				hoursPerUnit = ga?.hoursPerGroup ?? rule.hoursPerUnit;
				totalWeeklyHours = new Decimal(driverUnits).times(hoursPerUnit);
				break;
			}

			default:
				throw new Error(`Unknown driverType: ${rule.driverType}`);
		}

		sources.push({
			gradeLevel: rule.gradeLevel,
			disciplineCode: rule.disciplineCode,
			lineType: rule.lineType,
			driverType: rule.driverType,
			headcount: enrollment.headcount,
			maxClassSize: enrollment.maxClassSize,
			driverUnits,
			hoursPerUnit,
			totalWeeklyHours,
		});
	}

	// STEP 2: Aggregate sources to requirement lines by (band, disciplineCode, lineType)
	const lineMap = new Map<
		string,
		{
			band: string;
			disciplineCode: string;
			lineType: string;
			driverType: string;
			serviceProfileCode: string;
			totalDriverUnits: number;
			totalWeeklyHours: Decimal;
		}
	>();

	for (const source of sources) {
		const band = gradeToBand(source.gradeLevel);
		const key = `${band}|${source.disciplineCode}|${source.lineType}`;

		const existing = lineMap.get(key);
		if (existing) {
			existing.totalDriverUnits += source.driverUnits;
			existing.totalWeeklyHours = existing.totalWeeklyHours.plus(source.totalWeeklyHours);
		} else {
			// Find the rule to get serviceProfileCode
			const rule = rules.find(
				(r) =>
					r.gradeLevel === source.gradeLevel &&
					r.disciplineCode === source.disciplineCode &&
					r.lineType === source.lineType
			);
			lineMap.set(key, {
				band,
				disciplineCode: source.disciplineCode,
				lineType: source.lineType,
				driverType: source.driverType,
				serviceProfileCode: rule?.serviceProfileCode ?? '',
				totalDriverUnits: source.driverUnits,
				totalWeeklyHours: new Decimal(source.totalWeeklyHours),
			});
		}
	}

	// STEP 3: FTE calculation per line
	const lines: RequirementLine[] = [];

	for (const agg of lineMap.values()) {
		const profile = serviceProfiles.get(agg.serviceProfileCode);
		if (!profile) {
			throw new Error(
				`Service profile not found: ${agg.serviceProfileCode} for ${agg.band}/${agg.disciplineCode}`
			);
		}

		const baseOrs = profile.weeklyServiceHours;
		const effectiveOrs = profile.hsaEligible ? baseOrs.plus(settings.hsaTargetHours) : baseOrs;

		let requiredFteRaw: Decimal;
		let requiredFtePlanned: Decimal;

		if (agg.driverType === 'SECTION') {
			// SECTION: FTE = totalDriverUnits (1:1, no ORS division)
			requiredFteRaw = new Decimal(agg.totalDriverUnits);
			requiredFtePlanned = requiredFteRaw;
		} else {
			// HOURS or GROUP: FTE = totalWeeklyHours / ORS
			if (baseOrs.isZero()) {
				throw new Error(
					`Cannot divide by zero ORS for profile ${agg.serviceProfileCode} ` +
						`on line ${agg.band}/${agg.disciplineCode}. ` +
						`Profiles with ORS=0 must use SECTION driver type.`
				);
			}
			requiredFteRaw = agg.totalWeeklyHours.div(baseOrs).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
			requiredFtePlanned = agg.totalWeeklyHours
				.div(effectiveOrs)
				.toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
		}

		// Omit zero-demand lines from output (retained in sources for audit)
		if (requiredFteRaw.isZero()) continue;

		const recommendedPositions = requiredFteRaw.ceil().toNumber();

		lines.push({
			band: agg.band,
			disciplineCode: agg.disciplineCode,
			lineLabel: buildLineLabel(agg.band, agg.disciplineCode, agg.lineType),
			lineType: agg.lineType,
			driverType: agg.driverType,
			serviceProfileCode: agg.serviceProfileCode,
			totalDriverUnits: agg.totalDriverUnits,
			totalWeeklyHours: agg.totalWeeklyHours,
			baseOrs,
			effectiveOrs,
			requiredFteRaw,
			requiredFtePlanned,
			recommendedPositions,
		});
	}

	return { sources, lines };
}
