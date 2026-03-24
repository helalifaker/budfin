/**
 * Pure workbook builder for the 8-sheet staffing planning export.
 *
 * Cross-linked with Excel formulas so changes cascade:
 *   Settings (named ranges) → Enrollment → Demand Sources → Teaching Requirements → Summary
 *   Monthly Staff Costs → Summary
 *   Category Costs → Summary
 */
import type { Workbook, Worksheet, Row } from 'exceljs';
import type {
	StaffingSettings,
	ServiceProfileOverride,
	CostAssumption,
	LyceeGroupAssumption,
	TeachingRequirementLine,
	TeachingRequirementSource,
	TeachingRequirementsResponse,
	Employee,
	StaffCostBreakdown,
	CategoryCostData,
	StaffingSummaryResponse,
} from '../hooks/use-staffing';
import type { CapacityResult } from '@budfin/types';
import { BAND_LABELS } from './band-styles';

// ── Public interface ────────────────────────────────────────────────────────

export interface KpiValues {
	totalHeadcount: number;
	fteGap: number;
	staffCost: number;
	hsaBudget: number;
	heRatio: number;
	rechargeCost: number;
}

export interface StaffingWorkbookData {
	versionName: string;
	exportDate: string;
	settings: StaffingSettings;
	serviceProfiles: ServiceProfileOverride[];
	costAssumptions: CostAssumption[];
	lyceeGroups: LyceeGroupAssumption[];
	enrollmentResults: CapacityResult[];
	demandSources: TeachingRequirementSource[];
	teachingReqLines: TeachingRequirementLine[];
	teachingReqTotals: TeachingRequirementsResponse['totals'];
	employees: Employee[];
	costBreakdown: StaffCostBreakdown[];
	categoryCosts: CategoryCostData;
	kpiValues: KpiValues;
	summaryData: StaffingSummaryResponse;
}

// ── Constants ───────────────────────────────────────────────────────────────

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

const GRADE_ORDER = [
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

const BAND_ORDER: Record<string, number> = {
	MATERNELLE: 1,
	ELEMENTAIRE: 2,
	COLLEGE: 3,
	LYCEE: 4,
};

const BAND_COLORS: Record<string, string> = {
	MATERNELLE: 'FF6366F1',
	ELEMENTAIRE: 'FF22C55E',
	COLLEGE: 'FFF59E0B',
	LYCEE: 'FFEF4444',
};

const MONTH_LABELS = [
	'Jan',
	'Feb',
	'Mar',
	'Apr',
	'May',
	'Jun',
	'Jul',
	'Aug',
	'Sep',
	'Oct',
	'Nov',
	'Dec',
];

// ── Style constants ─────────────────────────────────────────────────────────

const DARK_BG = 'FF1A1A2E';
const LIGHT_GRAY_BG = 'FFF3F4F6';
const WHITE = 'FFFFFFFF';

// ── Entry point ─────────────────────────────────────────────────────────────

export async function buildStaffingWorkbook(
	workbook: Workbook,
	data: StaffingWorkbookData
): Promise<Workbook> {
	const ctx: BuildContext = {
		workbook,
		data,
		// Populated by sheet builders for cross-sheet references
		enrollmentLookupStart: 0,
		enrollmentLookupGradeCol: 'A',
		enrollmentLookupHeadcountCol: 'B',
		enrollmentLookupMaxClassCol: 'C',
		enrollmentLookupEnd: 0,
		settingsProfileCodeCol: '',
		settingsProfileOrsCol: '',
		settingsProfileHsaCol: '',
		settingsProfileStart: 0,
		settingsProfileEnd: 0,
		teachingReqGrandTotalRow: 0,
		monthlyStaffCostsGrandTotalRow: 0,
		categoryCostsGrandTotalRow: 0,
		enrollmentGrandTotalRow: 0,
	};

	buildSettingsSheet(ctx);
	buildEnrollmentSheet(ctx);
	buildDemandSourcesSheet(ctx);
	buildTeachingRequirementsSheet(ctx);
	buildEmployeeRosterSheet(ctx);
	buildMonthlyStaffCostsSheet(ctx);
	buildCategoryCostsSheet(ctx);
	buildSummarySheet(ctx);

	return workbook;
}

// ── Build context ───────────────────────────────────────────────────────────

interface BuildContext {
	workbook: Workbook;
	data: StaffingWorkbookData;
	enrollmentLookupStart: number;
	enrollmentLookupGradeCol: string;
	enrollmentLookupHeadcountCol: string;
	enrollmentLookupMaxClassCol: string;
	enrollmentLookupEnd: number;
	settingsProfileCodeCol: string;
	settingsProfileOrsCol: string;
	settingsProfileHsaCol: string;
	settingsProfileStart: number;
	settingsProfileEnd: number;
	teachingReqGrandTotalRow: number;
	monthlyStaffCostsGrandTotalRow: number;
	categoryCostsGrandTotalRow: number;
	enrollmentGrandTotalRow: number;
}

// ── Sheet 1: Settings ───────────────────────────────────────────────────────

function buildSettingsSheet(ctx: BuildContext) {
	const ws = ctx.workbook.addWorksheet('Settings');
	const { settings, serviceProfiles, costAssumptions, lyceeGroups } = ctx.data;

	ws.columns = [
		{ key: 'A', width: 30 },
		{ key: 'B', width: 20 },
		{ key: 'C', width: 20 },
	];

	// Row 1: Title
	const titleRow = ws.addRow(['BudFin - Staffing Settings']);
	ws.mergeCells('A1:C1');
	styleTitleRow(titleRow);

	// Row 2: Version + date
	const infoRow = ws.addRow([
		`Version: ${ctx.data.versionName}`,
		'',
		`Exported: ${ctx.data.exportDate}`,
	]);
	styleInfoRow(infoRow);

	// Row 3: blank
	ws.addRow([]);

	// Rows 4-10: Parameter named ranges
	const params: Array<[string, string | number, string]> = [
		['HSA Target Hours', settings.hsaTargetHours, 'HSA_TARGET_HOURS'],
		['HSA First Hour Rate', settings.hsaFirstHourRate, 'HSA_FIRST_RATE'],
		['HSA Additional Rate', settings.hsaAdditionalHourRate, 'HSA_ADDL_RATE'],
		['HSA Months', settings.hsaMonths, 'HSA_MONTHS'],
		['Academic Weeks', settings.academicWeeks, 'ACADEMIC_WEEKS'],
		['Ajeer Annual Fee', settings.ajeerAnnualFee, 'AJEER_FEE'],
	];

	for (const [label, value, namedRange] of params) {
		const r = ws.rowCount + 1;
		const row = ws.addRow([label, typeof value === 'number' ? value : parseFloat(String(value))]);
		styleLabelValueRow(row);
		ctx.workbook.definedNames.add(`Settings!$B$${r}`, namedRange);
	}

	// Row 11: blank
	ws.addRow([]);

	// Row 12: SERVICE PROFILES header
	const profileHeaderRow = ws.addRow(['SERVICE PROFILES']);
	ws.mergeCells(`A${profileHeaderRow.number}:C${profileHeaderRow.number}`);
	styleSectionHeader(profileHeaderRow);

	// Row 13: Column headers
	const profileColHeaderRow = ws.addRow(['Code', 'Weekly Hours', 'HSA Eligible']);
	styleHeaderRow(profileColHeaderRow);

	ctx.settingsProfileCodeCol = 'A';
	ctx.settingsProfileOrsCol = 'B';
	ctx.settingsProfileHsaCol = 'C';
	ctx.settingsProfileStart = ws.rowCount + 1;

	for (const profile of serviceProfiles) {
		const row = ws.addRow([
			profile.serviceProfileCode,
			profile.weeklyServiceHours ? parseFloat(profile.weeklyServiceHours) : '',
			profile.hsaEligible ? 'Yes' : 'No',
		]);
		styleDataRow(row);
	}

	ctx.settingsProfileEnd = ws.rowCount;

	// Blank row
	ws.addRow([]);

	// COST ASSUMPTIONS section
	const costHeaderRow = ws.addRow(['COST ASSUMPTIONS']);
	ws.mergeCells(`A${costHeaderRow.number}:C${costHeaderRow.number}`);
	styleSectionHeader(costHeaderRow);

	const costColHeaderRow = ws.addRow(['Category', 'Calc Mode', 'Value']);
	styleHeaderRow(costColHeaderRow);

	for (const ca of costAssumptions) {
		const row = ws.addRow([ca.category, ca.calculationMode, parseFloat(ca.value)]);
		styleDataRow(row);
	}

	// Blank row
	ws.addRow([]);

	// LYCEE GROUP ASSUMPTIONS section
	const lyceeHeaderRow = ws.addRow(['LYCEE GROUP ASSUMPTIONS']);
	ws.mergeCells(`A${lyceeHeaderRow.number}:C${lyceeHeaderRow.number}`);
	styleSectionHeader(lyceeHeaderRow);

	// Add a 4th column for this section
	ws.getColumn('D').width = 15;
	const lyceeColHeaderRow = ws.addRow(['Discipline', 'Groups', 'Hrs/Group']);
	styleHeaderRow(lyceeColHeaderRow);

	for (const lg of lyceeGroups) {
		const row = ws.addRow([lg.disciplineCode, lg.groupCount, parseFloat(lg.hoursPerGroup)]);
		styleDataRow(row);
	}

	// Number formats
	ws.getColumn('B').numFmt = '0.00';

	// Print setup
	ws.pageSetup = {
		orientation: 'landscape',
		fitToPage: true,
		fitToWidth: 1,
		fitToHeight: 0,
		paperSize: 9,
	};
}

// ── Sheet 2: Enrollment ─────────────────────────────────────────────────────

function buildEnrollmentSheet(ctx: BuildContext) {
	const ws = ctx.workbook.addWorksheet('Enrollment');
	const results = ctx.data.enrollmentResults;

	ws.columns = [
		{ key: 'A', width: 14 }, // Grade
		{ key: 'B', width: 16 }, // Band
		{ key: 'C', width: 18 }, // AY2 Headcount
		{ key: 'D', width: 18 }, // Max Class Size
		{ key: 'E', width: 14 }, // Sections
		{ key: 'F', width: 14 }, // Utilization
		{ key: 'G', width: 12 }, // Alert
	];

	// Title
	const titleRow = ws.addRow(['BudFin - Enrollment (AY2)']);
	ws.mergeCells('A1:G1');
	styleTitleRow(titleRow);

	// Info
	const infoRow = ws.addRow([
		`Version: ${ctx.data.versionName}`,
		'',
		'',
		`Exported: ${ctx.data.exportDate}`,
	]);
	ws.mergeCells('A2:C2');
	ws.mergeCells('D2:G2');
	styleInfoRow(infoRow);

	// Blank
	ws.addRow([]);

	// Headers
	const headerRow = ws.addRow([
		'Grade',
		'Band',
		'AY2 Headcount',
		'Max Class Size',
		'Sections',
		'Utilization',
		'Alert',
	]);
	styleHeaderRow(headerRow);

	// Freeze below header
	ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 4, topLeftCell: 'A5' }];

	// Sort results by grade order
	const sortedResults = [...results].sort(
		(a, b) => GRADE_ORDER.indexOf(a.gradeLevel) - GRADE_ORDER.indexOf(b.gradeLevel)
	);

	// Group by band
	const bandGroups = new Map<string, CapacityResult[]>();
	for (const result of sortedResults) {
		const band = GRADE_TO_BAND[result.gradeLevel] ?? 'OTHER';
		const group = bandGroups.get(band);
		if (group) {
			group.push(result);
		} else {
			bandGroups.set(band, [result]);
		}
	}

	const sortedBands = [...bandGroups.keys()].sort(
		(a, b) => (BAND_ORDER[a] ?? 99) - (BAND_ORDER[b] ?? 99)
	);

	const subtotalRowNumbers: number[] = [];

	for (const band of sortedBands) {
		const bandResults = bandGroups.get(band)!;
		const bandLabel = BAND_LABELS[band] ?? band;
		const bandColor = BAND_COLORS[band] ?? 'FF888888';

		// Band header row
		const bandHeaderRow = ws.addRow([`${bandLabel} (${bandResults.length})`]);
		ws.mergeCells(`A${bandHeaderRow.number}:G${bandHeaderRow.number}`);
		styleBandHeaderRow(bandHeaderRow, bandColor);

		const firstDataRow = ws.rowCount + 1;

		for (const result of bandResults) {
			const r = ws.rowCount + 1;
			const row = ws.addRow([
				result.gradeLevel,
				band,
				result.headcount,
				result.maxClassSize,
				// Sections formula
				{ formula: `CEILING(C${r}/D${r},1)`, result: result.sectionsNeeded },
				result.utilization,
				result.alert ?? '',
			]);
			styleDataRow(row);
		}

		const lastDataRow = ws.rowCount;

		// Band subtotal
		const sr = ws.rowCount + 1;
		const subtotalRow = ws.addRow([
			`${bandLabel} Subtotal`,
			'',
			{ formula: `SUM(C${firstDataRow}:C${lastDataRow})` },
			'',
			{ formula: `SUM(E${firstDataRow}:E${lastDataRow})` },
			'',
			'',
		]);
		styleSubtotalRow(subtotalRow);
		subtotalRowNumbers.push(sr);
	}

	// Grand total
	const subtotalRefs = (col: string) => subtotalRowNumbers.map((r) => `${col}${r}`).join('+');

	const grandTotalRow = ws.addRow([
		'Grand Total',
		'',
		{ formula: subtotalRefs('C') },
		'',
		{ formula: subtotalRefs('E') },
		'',
		'',
	]);
	styleGrandTotalRow(grandTotalRow);
	ctx.enrollmentGrandTotalRow = grandTotalRow.number;

	// ── Hidden lookup range for INDEX/MATCH from Demand Sources ──
	// Two blank rows as separator
	ws.addRow([]);
	ws.addRow([]);

	const lookupHeaderRow = ws.addRow(['LOOKUP TABLE (hidden)']);
	ws.mergeCells(`A${lookupHeaderRow.number}:C${lookupHeaderRow.number}`);
	lookupHeaderRow.hidden = true;

	ctx.enrollmentLookupStart = ws.rowCount + 1;

	// Build flat lookup: Grade | Headcount | MaxClassSize (no band headers)
	for (const result of sortedResults) {
		const row = ws.addRow([result.gradeLevel, result.headcount, result.maxClassSize]);
		row.hidden = true;
	}

	ctx.enrollmentLookupEnd = ws.rowCount;
	ctx.enrollmentLookupGradeCol = 'A';
	ctx.enrollmentLookupHeadcountCol = 'B';
	ctx.enrollmentLookupMaxClassCol = 'C';

	// Number formats
	ws.getColumn('C').numFmt = '0';
	ws.getColumn('D').numFmt = '0';
	ws.getColumn('E').numFmt = '0';
	ws.getColumn('F').numFmt = '0%';

	ws.pageSetup = {
		orientation: 'landscape',
		fitToPage: true,
		fitToWidth: 1,
		fitToHeight: 0,
		paperSize: 9,
	};
}

// ── Sheet 3: Demand Sources ─────────────────────────────────────────────────

function buildDemandSourcesSheet(ctx: BuildContext) {
	const ws = ctx.workbook.addWorksheet('Demand Sources');
	const sources = ctx.data.demandSources;

	ws.columns = [
		{ key: 'A', width: 12 }, // Grade
		{ key: 'B', width: 16 }, // Band
		{ key: 'C', width: 20 }, // Discipline
		{ key: 'D', width: 14 }, // Line Type
		{ key: 'E', width: 14 }, // Driver Type
		{ key: 'F', width: 14 }, // Headcount
		{ key: 'G', width: 16 }, // Max Class Size
		{ key: 'H', width: 14 }, // Driver Units
		{ key: 'I', width: 12 }, // Hours/Unit
		{ key: 'J', width: 14 }, // Weekly Hours
	];

	// Title
	const titleRow = ws.addRow(['BudFin - Teaching Demand Sources']);
	ws.mergeCells('A1:J1');
	styleTitleRow(titleRow);

	// Info
	const infoRow = ws.addRow([
		`Version: ${ctx.data.versionName}`,
		'',
		'',
		'',
		`Exported: ${ctx.data.exportDate}`,
	]);
	ws.mergeCells('A2:D2');
	ws.mergeCells('E2:J2');
	styleInfoRow(infoRow);

	// Blank
	ws.addRow([]);

	// Headers
	const headerRow = ws.addRow([
		'Grade',
		'Band',
		'Discipline',
		'Line Type',
		'Driver Type',
		'Headcount',
		'Max Class Size',
		'Driver Units',
		'Hours/Unit',
		'Weekly Hours',
	]);
	styleHeaderRow(headerRow);

	ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 4, topLeftCell: 'A5' }];

	// Sort sources by grade order then discipline
	const sorted = [...sources].sort((a, b) => {
		const gradeA = GRADE_ORDER.indexOf(a.gradeLevel);
		const gradeB = GRADE_ORDER.indexOf(b.gradeLevel);
		if (gradeA !== gradeB) return gradeA - gradeB;
		return a.disciplineCode.localeCompare(b.disciplineCode);
	});

	const lookupGradeRange = `Enrollment!$${ctx.enrollmentLookupGradeCol}$${ctx.enrollmentLookupStart}:$${ctx.enrollmentLookupGradeCol}$${ctx.enrollmentLookupEnd}`;
	const lookupHeadcountRange = `Enrollment!$${ctx.enrollmentLookupHeadcountCol}$${ctx.enrollmentLookupStart}:$${ctx.enrollmentLookupHeadcountCol}$${ctx.enrollmentLookupEnd}`;
	const lookupMaxClassRange = `Enrollment!$${ctx.enrollmentLookupMaxClassCol}$${ctx.enrollmentLookupStart}:$${ctx.enrollmentLookupMaxClassCol}$${ctx.enrollmentLookupEnd}`;

	for (const source of sorted) {
		const r = ws.rowCount + 1;
		const band = GRADE_TO_BAND[source.gradeLevel] ?? 'OTHER';

		// F: Headcount via INDEX/MATCH to Enrollment lookup
		const headcountFormula = `INDEX(${lookupHeadcountRange},MATCH(A${r},${lookupGradeRange},0))`;

		// G: Max Class Size via INDEX/MATCH
		const maxClassFormula = `INDEX(${lookupMaxClassRange},MATCH(A${r},${lookupGradeRange},0))`;

		// H: Driver Units - SECTION type uses CEILING formula, others are static
		let driverUnitsCell: { formula: string; result: number } | number;
		if (source.driverType === 'SECTION') {
			driverUnitsCell = {
				formula: `IF(E${r}="SECTION",CEILING(F${r}/G${r},1),${source.driverUnits})`,
				result: source.driverUnits,
			};
		} else {
			driverUnitsCell = source.driverUnits;
		}

		// J: Weekly Hours = Driver Units * Hours/Unit
		const weeklyHoursFormula = `H${r}*I${r}`;

		const row = ws.addRow([
			source.gradeLevel,
			band,
			source.disciplineCode,
			source.lineType,
			source.driverType,
			{ formula: headcountFormula, result: source.headcount },
			{ formula: maxClassFormula, result: source.maxClassSize },
			driverUnitsCell,
			parseFloat(source.hoursPerUnit),
			{ formula: weeklyHoursFormula, result: parseFloat(source.totalWeeklyHours) },
		]);
		styleDataRow(row);
	}

	// Number formats
	ws.getColumn('F').numFmt = '0';
	ws.getColumn('G').numFmt = '0';
	ws.getColumn('H').numFmt = '0';
	ws.getColumn('I').numFmt = '0.00';
	ws.getColumn('J').numFmt = '0.00';

	ws.pageSetup = {
		orientation: 'landscape',
		fitToPage: true,
		fitToWidth: 1,
		fitToHeight: 0,
		paperSize: 9,
	};
}

// ── Sheet 4: Teaching Requirements ──────────────────────────────────────────

function buildTeachingRequirementsSheet(ctx: BuildContext) {
	const ws = ctx.workbook.addWorksheet('Teaching Requirements');
	const lines = ctx.data.teachingReqLines;

	ws.columns = [
		{ key: 'A', width: 16 }, // BAND (hidden)
		{ key: 'B', width: 20 }, // DISCIPLINE
		{ key: 'C', width: 28 }, // LINE
		{ key: 'D', width: 14 }, // PROFILE
		{ key: 'E', width: 10 }, // UNITS
		{ key: 'F', width: 10 }, // HRS/W
		{ key: 'G', width: 10 }, // ORS
		{ key: 'H', width: 10 }, // EFF.ORS
		{ key: 'I', width: 12 }, // RAW FTE
		{ key: 'J', width: 12 }, // PLAN FTE
		{ key: 'K', width: 10 }, // REC.POS
		{ key: 'L', width: 12 }, // COVERED
		{ key: 'M', width: 10 }, // GAP
		{ key: 'N', width: 14 }, // STATUS
		{ key: 'O', width: 10 }, // STAFF
		{ key: 'P', width: 16 }, // DIRECT COST
		{ key: 'Q', width: 16 }, // HSA COST
	];

	// Hide Band column (A)
	ws.getColumn('A').hidden = true;

	// Title
	const titleRow = ws.addRow(['', 'BudFin - Teaching Requirements']);
	ws.mergeCells('B1:Q1');
	styleTitleRow(titleRow);

	// Info
	const infoRow = ws.addRow([
		'',
		`Version: ${ctx.data.versionName}`,
		'',
		'',
		`Exported: ${ctx.data.exportDate}`,
	]);
	ws.mergeCells('B2:D2');
	ws.mergeCells('E2:Q2');
	styleInfoRow(infoRow);

	// Blank
	ws.addRow([]);

	// KPI ribbon
	const kpi = ctx.data.kpiValues;
	const kpiLabels = [
		'',
		'Total Headcount',
		'',
		'FTE Gap',
		'',
		'Staff Cost (SAR)',
		'',
		'HSA Budget (SAR)',
		'',
		'H/E Ratio',
		'',
		'Recharge (SAR)',
	];
	const kpiLabelRow = ws.addRow(kpiLabels);
	ws.mergeCells('B4:C4');
	ws.mergeCells('D4:E4');
	ws.mergeCells('F4:G4');
	ws.mergeCells('H4:I4');
	ws.mergeCells('J4:K4');
	ws.mergeCells('L4:Q4');
	styleKpiLabelRow(kpiLabelRow);

	const kpiValueRow = ws.addRow([
		'',
		kpi.totalHeadcount,
		'',
		kpi.fteGap,
		'',
		kpi.staffCost,
		'',
		kpi.hsaBudget,
		'',
		kpi.heRatio,
		'',
		kpi.rechargeCost,
	]);
	ws.mergeCells('B5:C5');
	ws.mergeCells('D5:E5');
	ws.mergeCells('F5:G5');
	ws.mergeCells('H5:I5');
	ws.mergeCells('J5:K5');
	ws.mergeCells('L5:Q5');
	styleKpiValueRow(kpiValueRow);

	// Blank
	ws.addRow([]);

	// Column headers
	const headers = [
		'BAND',
		'DISCIPLINE',
		'LINE',
		'PROFILE',
		'UNITS',
		'HRS/W',
		'ORS',
		'EFF.ORS',
		'RAW FTE',
		'PLAN FTE',
		'REC.POS',
		'COVERED',
		'GAP',
		'STATUS',
		'STAFF',
		'DIRECT COST',
		'HSA COST',
	];
	const headerRow = ws.addRow(headers);
	styleHeaderRow(headerRow);

	ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 7, topLeftCell: 'A8' }];

	// Settings profile ranges for INDEX/MATCH
	const profileCodeRange = `Settings!$${ctx.settingsProfileCodeCol}$${ctx.settingsProfileStart}:$${ctx.settingsProfileCodeCol}$${ctx.settingsProfileEnd}`;
	const profileOrsRange = `Settings!$${ctx.settingsProfileOrsCol}$${ctx.settingsProfileStart}:$${ctx.settingsProfileOrsCol}$${ctx.settingsProfileEnd}`;
	const profileHsaRange = `Settings!$${ctx.settingsProfileHsaCol}$${ctx.settingsProfileStart}:$${ctx.settingsProfileHsaCol}$${ctx.settingsProfileEnd}`;

	// Group lines by band
	const bandGroups = new Map<string, TeachingRequirementLine[]>();
	for (const line of lines) {
		const group = bandGroups.get(line.band);
		if (group) {
			group.push(line);
		} else {
			bandGroups.set(line.band, [line]);
		}
	}

	const sortedBands = [...bandGroups.keys()].sort(
		(a, b) => (BAND_ORDER[a] ?? 99) - (BAND_ORDER[b] ?? 99)
	);

	const subtotalRowNumbers: number[] = [];

	for (const band of sortedBands) {
		const bandLines = bandGroups.get(band)!;
		const bandLabel = BAND_LABELS[band] ?? band;
		const bandColor = BAND_COLORS[band] ?? 'FF888888';

		// Band header row
		const bandHeaderRow = ws.addRow([band, `${bandLabel} (${bandLines.length})`]);
		ws.mergeCells(`B${bandHeaderRow.number}:Q${bandHeaderRow.number}`);
		styleBandHeaderRow(bandHeaderRow, bandColor);

		const firstDataRow = ws.rowCount + 1;

		for (const line of bandLines) {
			const r = ws.rowCount + 1;

			// E: UNITS via SUMIFS to Demand Sources
			const unitsFormula = `SUMIFS('Demand Sources'!H:H,'Demand Sources'!B:B,A${r},'Demand Sources'!C:C,B${r})`;

			// F: HRS/W via SUMIFS to Demand Sources
			const hrsFormula = `SUMIFS('Demand Sources'!J:J,'Demand Sources'!B:B,A${r},'Demand Sources'!C:C,B${r})`;

			// G: ORS via INDEX/MATCH to Settings profiles
			const orsFormula = `INDEX(${profileOrsRange},MATCH(D${r},${profileCodeRange},0))`;

			// H: EFF.ORS = ORS + HSA_TARGET_HOURS if HSA eligible
			const effOrsFormula = `G${r}+IF(INDEX(${profileHsaRange},MATCH(D${r},${profileCodeRange},0))="Yes",HSA_TARGET_HOURS,0)`;

			// I: RAW FTE = HRS/W / ORS
			const rawFteFormula = `F${r}/G${r}`;

			// J: PLAN FTE = HRS/W / EFF.ORS
			const planFteFormula = `F${r}/H${r}`;

			// K: REC.POS = CEILING(RAW FTE, 1)
			const recPosFormula = `CEILING(I${r},1)`;

			// M: GAP = COVERED - RAW FTE
			const gapFormula = `L${r}-I${r}`;

			// N: STATUS formula
			const statusFormula = `IF(L${r}=0,"UNCOVERED",IF(M${r}<-0.25,"DEFICIT",IF(M${r}>0.25,"SURPLUS","COVERED")))`;

			const row = ws.addRow([
				line.band,
				line.disciplineCode,
				line.lineLabel,
				line.serviceProfileCode,
				{ formula: unitsFormula, result: line.totalDriverUnits },
				{ formula: hrsFormula, result: parseFloat(line.totalWeeklyHours) },
				{ formula: orsFormula, result: parseFloat(line.baseOrs) },
				{ formula: effOrsFormula, result: parseFloat(line.effectiveOrs) },
				{ formula: rawFteFormula, result: parseFloat(line.requiredFteRaw) },
				{ formula: planFteFormula, result: parseFloat(line.requiredFtePlanned) },
				{ formula: recPosFormula, result: line.recommendedPositions },
				parseFloat(line.coveredFte),
				{ formula: gapFormula, result: parseFloat(line.gapFte) },
				{ formula: statusFormula, result: line.coverageStatus },
				line.assignedStaffCount,
				parseFloat(line.directCostAnnual),
				parseFloat(line.hsaCostAnnual),
			]);
			styleDataRow(row);
		}

		const lastDataRow = ws.rowCount;

		// Band subtotal row
		const sr = ws.rowCount + 1;
		const subtotalRow = ws.addRow([
			'',
			`${bandLabel} Subtotal`,
			'',
			'',
			'',
			'',
			'',
			'',
			{ formula: `SUM(I${firstDataRow}:I${lastDataRow})` },
			'',
			'',
			{ formula: `SUM(L${firstDataRow}:L${lastDataRow})` },
			{ formula: `SUM(M${firstDataRow}:M${lastDataRow})` },
			'',
			'',
			{ formula: `SUM(P${firstDataRow}:P${lastDataRow})` },
			{ formula: `SUM(Q${firstDataRow}:Q${lastDataRow})` },
		]);
		styleSubtotalRow(subtotalRow);
		subtotalRowNumbers.push(sr);
	}

	// Grand total
	const subtotalRefs = (col: string) => subtotalRowNumbers.map((r) => `${col}${r}`).join('+');

	const grandTotalRow = ws.addRow([
		'',
		'Grand Total',
		'',
		'',
		'',
		'',
		'',
		'',
		{ formula: subtotalRefs('I') },
		'',
		'',
		{ formula: subtotalRefs('L') },
		{ formula: subtotalRefs('M') },
		'',
		'',
		{ formula: subtotalRefs('P') },
		{ formula: subtotalRefs('Q') },
	]);
	styleGrandTotalRow(grandTotalRow);
	ctx.teachingReqGrandTotalRow = grandTotalRow.number;

	// Number formats
	ws.getColumn('E').numFmt = '0';
	ws.getColumn('F').numFmt = '0.00';
	ws.getColumn('G').numFmt = '0.00';
	ws.getColumn('H').numFmt = '0.00';
	ws.getColumn('I').numFmt = '0.00';
	ws.getColumn('J').numFmt = '0.00';
	ws.getColumn('K').numFmt = '0';
	ws.getColumn('L').numFmt = '0.00';
	ws.getColumn('M').numFmt = '0.00';
	ws.getColumn('O').numFmt = '0';
	ws.getColumn('P').numFmt = '#,##0';
	ws.getColumn('Q').numFmt = '#,##0';

	// Conditional formatting: GAP (M) and STATUS (N)
	const dataStartRow = 8;
	const dataEndRow = ws.rowCount;

	ws.addConditionalFormatting({
		ref: `M${dataStartRow}:M${dataEndRow}`,
		rules: [
			{
				type: 'cellIs',
				operator: 'lessThan',
				priority: 1,
				formulae: ['0'],
				style: {
					fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFEE2E2' } },
					font: { color: { argb: 'FFDC2626' } },
				},
			},
			{
				type: 'cellIs',
				operator: 'greaterThan' as const,
				priority: 2,
				formulae: ['-0.005'],
				style: {
					fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFDCFCE7' } },
					font: { color: { argb: 'FF16A34A' } },
				},
			},
		],
	});

	ws.addConditionalFormatting({
		ref: `N${dataStartRow}:N${dataEndRow}`,
		rules: [
			{
				type: 'containsText',
				operator: 'containsText',
				text: 'DEFICIT',
				priority: 3,
				style: {
					fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFEE2E2' } },
					font: { color: { argb: 'FFDC2626' }, bold: true },
				},
			},
			{
				type: 'containsText',
				operator: 'containsText',
				text: 'UNCOVERED',
				priority: 4,
				style: {
					fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFFF7ED' } },
					font: { color: { argb: 'FFEA580C' }, bold: true },
				},
			},
			{
				type: 'containsText',
				operator: 'containsText',
				text: 'SURPLUS',
				priority: 5,
				style: {
					fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFEFF6FF' } },
					font: { color: { argb: 'FF2563EB' }, bold: true },
				},
			},
			{
				type: 'containsText',
				operator: 'containsText',
				text: 'COVERED',
				priority: 6,
				style: {
					fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFDCFCE7' } },
					font: { color: { argb: 'FF16A34A' }, bold: true },
				},
			},
		],
	});

	ws.pageSetup = {
		orientation: 'landscape',
		fitToPage: true,
		fitToWidth: 1,
		fitToHeight: 0,
		paperSize: 9,
	};
}

// ── Sheet 5: Employee Roster ────────────────────────────────────────────────

function buildEmployeeRosterSheet(ctx: BuildContext) {
	const ws = ctx.workbook.addWorksheet('Employee Roster');
	const employees = ctx.data.employees;

	ws.columns = [
		{ key: 'A', width: 14 }, // Code
		{ key: 'B', width: 24 }, // Name
		{ key: 'C', width: 16 }, // Department
		{ key: 'D', width: 18 }, // Role
		{ key: 'E', width: 12 }, // Status
		{ key: 'F', width: 14 }, // Cost Mode
		{ key: 'G', width: 10 }, // Teaching
		{ key: 'H', width: 10 }, // Saudi
		{ key: 'I', width: 10 }, // Ajeer
		{ key: 'J', width: 14 }, // Joining Date
		{ key: 'K', width: 16 }, // Base Salary
		{ key: 'L', width: 14 }, // Housing
		{ key: 'M', width: 14 }, // Transport
		{ key: 'N', width: 16 }, // Resp. Premium
		{ key: 'O', width: 14 }, // HSA Amount
		{ key: 'P', width: 16 }, // Augmentation
		{ key: 'Q', width: 16 }, // Monthly Cost
		{ key: 'R', width: 16 }, // Annual Cost
	];

	// Title
	const titleRow = ws.addRow(['BudFin - Employee Roster']);
	ws.mergeCells('A1:R1');
	styleTitleRow(titleRow);

	// Info
	const infoRow = ws.addRow([
		`Version: ${ctx.data.versionName}`,
		'',
		'',
		'',
		`Exported: ${ctx.data.exportDate}`,
	]);
	ws.mergeCells('A2:D2');
	ws.mergeCells('E2:R2');
	styleInfoRow(infoRow);

	// Blank
	ws.addRow([]);

	// Headers
	const headerRow = ws.addRow([
		'Code',
		'Name',
		'Department',
		'Role',
		'Status',
		'Cost Mode',
		'Teaching',
		'Saudi',
		'Ajeer',
		'Joining Date',
		'Base Salary',
		'Housing',
		'Transport',
		'Resp. Premium',
		'HSA Amount',
		'Augmentation',
		'Monthly Cost',
		'Annual Cost',
	]);
	styleHeaderRow(headerRow);

	ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 4, topLeftCell: 'A5' }];

	for (const emp of employees) {
		const row = ws.addRow([
			emp.employeeCode,
			emp.name,
			emp.department,
			emp.functionRole,
			emp.status,
			emp.costMode,
			emp.isTeaching ? 'Yes' : 'No',
			emp.isSaudi ? 'Yes' : 'No',
			emp.isAjeer ? 'Yes' : 'No',
			emp.joiningDate,
			safeParseNum(emp.baseSalary),
			safeParseNum(emp.housingAllowance),
			safeParseNum(emp.transportAllowance),
			safeParseNum(emp.responsibilityPremium),
			safeParseNum(emp.hsaAmount),
			safeParseNum(emp.augmentation),
			safeParseNum(emp.monthlyCost),
			safeParseNum(emp.annualCost),
		]);
		styleDataRow(row);
	}

	// Number formats for salary columns
	const costFormat = '#,##0';
	for (const col of ['K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R']) {
		ws.getColumn(col).numFmt = costFormat;
	}

	ws.pageSetup = {
		orientation: 'landscape',
		fitToPage: true,
		fitToWidth: 1,
		fitToHeight: 0,
		paperSize: 9,
	};
}

// ── Sheet 6: Monthly Staff Costs ────────────────────────────────────────────

function buildMonthlyStaffCostsSheet(ctx: BuildContext) {
	const ws = ctx.workbook.addWorksheet('Monthly Staff Costs');
	const breakdown = ctx.data.costBreakdown;

	ws.columns = [
		{ key: 'A', width: 24 }, // Employee
		{ key: 'B', width: 16 }, // Department
		{ key: 'C', width: 10 }, // Month
		{ key: 'D', width: 14 }, // Base Gross
		{ key: 'E', width: 14 }, // Adjusted Gross
		{ key: 'F', width: 14 }, // Housing
		{ key: 'G', width: 14 }, // Transport
		{ key: 'H', width: 14 }, // Resp Premium
		{ key: 'I', width: 12 }, // HSA
		{ key: 'J', width: 12 }, // GOSI
		{ key: 'K', width: 12 }, // Ajeer
		{ key: 'L', width: 14 }, // EoS Accrual
		{ key: 'M', width: 16 }, // Total Cost
	];

	// Title
	const titleRow = ws.addRow(['BudFin - Monthly Staff Costs']);
	ws.mergeCells('A1:M1');
	styleTitleRow(titleRow);

	// Info
	const infoRow = ws.addRow([
		`Version: ${ctx.data.versionName}`,
		'',
		'',
		`Exported: ${ctx.data.exportDate}`,
	]);
	ws.mergeCells('A2:C2');
	ws.mergeCells('D2:M2');
	styleInfoRow(infoRow);

	// Blank
	ws.addRow([]);

	// Headers
	const headerRow = ws.addRow([
		'Employee',
		'Department',
		'Month',
		'Base Gross',
		'Adjusted Gross',
		'Housing',
		'Transport',
		'Resp Premium',
		'HSA',
		'GOSI',
		'Ajeer',
		'EoS Accrual',
		'Total Cost',
	]);
	styleHeaderRow(headerRow);

	ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 4, topLeftCell: 'A5' }];

	const dataStartRow = 5;

	// Sort breakdown by employee then month
	const sorted = [...breakdown].sort((a, b) => {
		if (a.employee_name !== b.employee_name) return a.employee_name.localeCompare(b.employee_name);
		return a.month - b.month;
	});

	for (const entry of sorted) {
		const r = ws.rowCount + 1;
		const row = ws.addRow([
			entry.employee_name,
			entry.department,
			MONTH_LABELS[entry.month - 1] ?? entry.month,
			parseFloat(entry.base_gross),
			parseFloat(entry.adjusted_gross),
			parseFloat(entry.housing_allowance),
			parseFloat(entry.transport_allowance),
			parseFloat(entry.responsibility_premium),
			parseFloat(entry.hsa_amount),
			parseFloat(entry.gosi_amount),
			parseFloat(entry.ajeer_amount),
			parseFloat(entry.eos_monthly_accrual),
			{ formula: `SUM(D${r}:L${r})`, result: parseFloat(entry.total_cost) },
		]);
		styleDataRow(row);
	}

	const dataEndRow = ws.rowCount;

	// Monthly subtotal rows
	ws.addRow([]); // Blank separator
	const monthlySubtotalLabel = ws.addRow(['MONTHLY SUBTOTALS']);
	ws.mergeCells(`A${monthlySubtotalLabel.number}:M${monthlySubtotalLabel.number}`);
	styleSectionHeader(monthlySubtotalLabel);

	const monthSubtotalRows: number[] = [];

	for (let m = 1; m <= 12; m++) {
		const monthLabel = MONTH_LABELS[m - 1] ?? `M${m}`;
		const r = ws.rowCount + 1;
		const costCols = ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'];
		const values: (string | { formula: string })[] = [monthLabel, '', ''];

		for (const col of costCols) {
			values.push({
				formula: `SUMIFS(${col}${dataStartRow}:${col}${dataEndRow},C${dataStartRow}:C${dataEndRow},"${monthLabel}")`,
			});
		}

		const subtotalRow = ws.addRow(values);
		styleSubtotalRow(subtotalRow);
		monthSubtotalRows.push(r);
	}

	// Grand total
	const grandRow = ws.rowCount + 1;
	const grandValues: (string | { formula: string })[] = ['Grand Total', '', ''];
	const costCols = ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'];

	for (const col of costCols) {
		const refs = monthSubtotalRows.map((r) => `${col}${r}`).join('+');
		grandValues.push({ formula: refs });
	}

	const grandTotalRow = ws.addRow(grandValues);
	styleGrandTotalRow(grandTotalRow);
	ctx.monthlyStaffCostsGrandTotalRow = grandRow;

	// Number formats
	const costFormat = '#,##0';
	for (const col of ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M']) {
		ws.getColumn(col).numFmt = costFormat;
	}

	ws.pageSetup = {
		orientation: 'landscape',
		fitToPage: true,
		fitToWidth: 1,
		fitToHeight: 0,
		paperSize: 9,
	};
}

// ── Sheet 7: Category Costs ─────────────────────────────────────────────────

function buildCategoryCostsSheet(ctx: BuildContext) {
	const ws = ctx.workbook.addWorksheet('Category Costs');
	const { categoryCosts } = ctx.data;

	// Columns: Category | Jan-Dec | Annual
	ws.columns = [
		{ key: 'A', width: 24 },
		...MONTH_LABELS.map((_, i) => ({
			key: String.fromCharCode(66 + i),
			width: 14,
		})),
		{ key: 'N', width: 16 }, // Annual
	];

	// Title
	const titleRow = ws.addRow(['BudFin - Category Costs']);
	ws.mergeCells('A1:N1');
	styleTitleRow(titleRow);

	// Info
	const infoRow = ws.addRow([
		`Version: ${ctx.data.versionName}`,
		'',
		'',
		`Exported: ${ctx.data.exportDate}`,
	]);
	ws.mergeCells('A2:C2');
	ws.mergeCells('D2:N2');
	styleInfoRow(infoRow);

	// Blank
	ws.addRow([]);

	// Headers
	const headerRow = ws.addRow(['Category', ...MONTH_LABELS, 'Annual']);
	styleHeaderRow(headerRow);

	ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 4, topLeftCell: 'B5' }];

	// Extract unique categories from the cost data
	// categoryCosts.data is an array of { month, [category]: value }
	const categoryNames = new Set<string>();
	for (const entry of categoryCosts.data) {
		for (const key of Object.keys(entry)) {
			if (key !== 'month') {
				categoryNames.add(key);
			}
		}
	}

	const categories = [...categoryNames].sort();
	const dataStartRow = 5;

	for (const category of categories) {
		const r = ws.rowCount + 1;
		const rowValues: (string | number | { formula: string })[] = [category];

		// Monthly values
		for (let m = 1; m <= 12; m++) {
			const monthEntry = categoryCosts.data.find((e) => e.month === m);
			const val = monthEntry?.[category];
			rowValues.push(typeof val === 'string' ? parseFloat(val) : (val ?? 0));
		}

		// Annual = SUM(B:M)
		rowValues.push({ formula: `SUM(B${r}:M${r})` });

		const row = ws.addRow(rowValues);
		styleDataRow(row);
	}

	const dataEndRow = ws.rowCount;

	// Grand total row
	const gr = ws.rowCount + 1;
	const grandValues: (string | { formula: string })[] = ['Grand Total'];
	for (let c = 0; c < 12; c++) {
		const col = String.fromCharCode(66 + c); // B through M
		grandValues.push({ formula: `SUM(${col}${dataStartRow}:${col}${dataEndRow})` });
	}
	grandValues.push({ formula: `SUM(N${dataStartRow}:N${dataEndRow})` });

	const grandTotalRow = ws.addRow(grandValues);
	styleGrandTotalRow(grandTotalRow);
	ctx.categoryCostsGrandTotalRow = gr;

	// Number formats
	const costFormat = '#,##0';
	for (let c = 0; c < 13; c++) {
		const col = String.fromCharCode(66 + c); // B through N
		ws.getColumn(col).numFmt = costFormat;
	}

	ws.pageSetup = {
		orientation: 'landscape',
		fitToPage: true,
		fitToWidth: 1,
		fitToHeight: 0,
		paperSize: 9,
	};
}

// ── Sheet 8: Summary ────────────────────────────────────────────────────────

function buildSummarySheet(ctx: BuildContext) {
	const ws = ctx.workbook.addWorksheet('Summary');
	const { kpiValues, summaryData, teachingReqTotals, employees } = ctx.data;

	ws.columns = [
		{ key: 'A', width: 30 },
		{ key: 'B', width: 24 },
		{ key: 'C', width: 24 },
	];

	// Title
	const titleRow = ws.addRow(['BudFin - Staffing Summary']);
	ws.mergeCells('A1:C1');
	styleTitleRow(titleRow);

	// Info
	const infoRow = ws.addRow([
		`Version: ${ctx.data.versionName}`,
		'',
		`Exported: ${ctx.data.exportDate}`,
	]);
	styleInfoRow(infoRow);

	// Blank
	ws.addRow([]);

	// ENROLLMENT section
	const enrollHeader = ws.addRow(['ENROLLMENT']);
	ws.mergeCells(`A${enrollHeader.number}:C${enrollHeader.number}`);
	styleSectionHeader(enrollHeader);

	addSummaryRow(ws, 'Total AY2 Headcount', {
		formula: `Enrollment!C${ctx.enrollmentGrandTotalRow}`,
		result: kpiValues.totalHeadcount,
	});

	// Blank
	ws.addRow([]);

	// TEACHING DEMAND section
	const teachingHeader = ws.addRow(['TEACHING DEMAND']);
	ws.mergeCells(`A${teachingHeader.number}:C${teachingHeader.number}`);
	styleSectionHeader(teachingHeader);

	addSummaryRow(ws, 'Total Raw FTE Required', {
		formula: `'Teaching Requirements'!I${ctx.teachingReqGrandTotalRow}`,
		result: parseFloat(teachingReqTotals.totalFteRaw),
	});
	addSummaryRow(ws, 'Total FTE Covered', {
		formula: `'Teaching Requirements'!L${ctx.teachingReqGrandTotalRow}`,
		result: parseFloat(teachingReqTotals.totalFteCovered),
	});
	addSummaryRow(ws, 'Total FTE Gap', {
		formula: `'Teaching Requirements'!M${ctx.teachingReqGrandTotalRow}`,
		result: parseFloat(teachingReqTotals.totalFteGap),
	});
	addSummaryRow(ws, 'Requirement Lines', teachingReqTotals.lineCount);

	// Count deficit lines
	const deficitCount = ctx.data.teachingReqLines.filter(
		(l) => l.coverageStatus === 'DEFICIT' || l.coverageStatus === 'UNCOVERED'
	).length;
	addSummaryRow(ws, 'Deficit/Uncovered Lines', deficitCount);

	// Blank
	ws.addRow([]);

	// EMPLOYEES section
	const empHeader = ws.addRow(['EMPLOYEES']);
	ws.mergeCells(`A${empHeader.number}:C${empHeader.number}`);
	styleSectionHeader(empHeader);

	addSummaryRow(ws, 'Total Employees', employees.length);
	addSummaryRow(ws, 'Teaching Staff', employees.filter((e) => e.isTeaching).length);
	addSummaryRow(ws, 'Support & Admin Staff', employees.filter((e) => !e.isTeaching).length);

	// Blank
	ws.addRow([]);

	// COSTS section
	const costHeader = ws.addRow(['COSTS']);
	ws.mergeCells(`A${costHeader.number}:C${costHeader.number}`);
	styleSectionHeader(costHeader);

	const staffCostRow = addSummaryRow(ws, 'Total Staff Cost', {
		formula: `'Monthly Staff Costs'!M${ctx.monthlyStaffCostsGrandTotalRow}`,
		result: parseFloat(summaryData.cost),
	});

	const catCostRow = addSummaryRow(ws, 'Total Category Costs', {
		formula: `'Category Costs'!N${ctx.categoryCostsGrandTotalRow}`,
		result: parseFloat(ctx.data.categoryCosts.grand_total),
	});

	// Grand Total Budget = Staff + Category (formula referencing the two rows above)
	const budgetRow = ws.addRow([
		'GRAND TOTAL BUDGET',
		{ formula: `B${staffCostRow}+B${catCostRow}` },
	]);
	budgetRow.height = 26;
	budgetRow.eachCell((cell) => {
		cell.font = { bold: true, size: 12, color: { argb: WHITE } };
		cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK_BG } };
		cell.alignment = { vertical: 'middle' };
		cell.border = {
			top: { style: 'medium', color: { argb: 'FF374151' } },
		};
	});

	// Number format for cost values
	ws.getColumn('B').numFmt = '#,##0';

	ws.pageSetup = {
		orientation: 'portrait',
		fitToPage: true,
		fitToWidth: 1,
		fitToHeight: 0,
		paperSize: 9,
	};
}

// ── Style helpers ───────────────────────────────────────────────────────────

function styleTitleRow(row: Row) {
	row.height = 28;
	row.eachCell((cell) => {
		cell.font = { bold: true, size: 14, color: { argb: WHITE } };
		cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK_BG } };
		cell.alignment = { vertical: 'middle' };
	});
}

function styleInfoRow(row: Row) {
	row.eachCell((cell) => {
		cell.font = { size: 10, color: { argb: 'FF6B7280' } };
	});
}

function styleSectionHeader(row: Row) {
	row.height = 22;
	row.eachCell((cell) => {
		cell.font = { bold: true, size: 11, color: { argb: WHITE } };
		cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF374151' } };
		cell.alignment = { vertical: 'middle' };
	});
}

function styleHeaderRow(row: Row) {
	row.height = 24;
	row.eachCell((cell) => {
		cell.font = { bold: true, size: 10, color: { argb: WHITE } };
		cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK_BG } };
		cell.alignment = { horizontal: 'center', vertical: 'middle' };
		cell.border = {
			bottom: { style: 'thin', color: { argb: 'FF374151' } },
		};
	});
}

function styleBandHeaderRow(row: Row, bandColor: string) {
	row.height = 22;
	row.eachCell((cell) => {
		cell.font = { bold: true, size: 10 };
		cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_GRAY_BG } };
		cell.border = {
			left: { style: 'thick', color: { argb: bandColor } },
			bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
		};
	});
}

function styleDataRow(row: Row) {
	row.eachCell((cell) => {
		cell.font = { size: 10 };
		cell.alignment = { vertical: 'middle' };
		cell.border = {
			bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } },
		};
	});
}

function styleSubtotalRow(row: Row) {
	row.height = 22;
	row.eachCell((cell) => {
		cell.font = { bold: true, size: 10 };
		cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_GRAY_BG } };
		cell.alignment = { vertical: 'middle' };
		cell.border = {
			top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
			bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
		};
	});
}

function styleGrandTotalRow(row: Row) {
	row.height = 26;
	row.eachCell((cell) => {
		cell.font = { bold: true, size: 11, color: { argb: WHITE } };
		cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK_BG } };
		cell.alignment = { vertical: 'middle' };
		cell.border = {
			top: { style: 'medium', color: { argb: 'FF374151' } },
		};
	});
}

function styleLabelValueRow(row: Row) {
	row.eachCell((cell, colNumber) => {
		cell.font = { size: 10, bold: colNumber === 1 };
		cell.alignment = { vertical: 'middle' };
		cell.border = {
			bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } },
		};
	});
}

function styleKpiLabelRow(row: Row) {
	row.eachCell((cell) => {
		cell.font = { bold: true, size: 9, color: { argb: 'FF6B7280' } };
		cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_GRAY_BG } };
		cell.alignment = { horizontal: 'center', vertical: 'middle' };
		cell.border = {
			bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
		};
	});
}

function styleKpiValueRow(row: Row) {
	row.height = 22;
	row.eachCell((cell) => {
		cell.font = { bold: true, size: 12 };
		cell.alignment = { horizontal: 'center', vertical: 'middle' };
		cell.border = {
			bottom: { style: 'medium', color: { argb: 'FFD1D5DB' } },
		};
	});
}

// ── Utility helpers ─────────────────────────────────────────────────────────

function safeParseNum(val: string | null | undefined): number | string {
	if (val === null || val === undefined) return '';
	const num = parseFloat(val);
	return isNaN(num) ? '' : num;
}

function addSummaryRow(
	ws: Worksheet,
	label: string,
	value: number | { formula: string; result?: number }
): number {
	const row = ws.addRow([label, value]);
	styleLabelValueRow(row);
	return row.number;
}
