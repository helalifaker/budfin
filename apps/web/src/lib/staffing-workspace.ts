import Decimal from 'decimal.js';

// ── Staffing Workspace Types & Utilities ────────────────────────────────────

export type WorkspaceMode = 'teaching' | 'support';
export type WorkspaceTab = 'demand' | 'roster' | 'coverage' | 'costs';
export type BandFilter = 'ALL' | 'MAT' | 'ELEM' | 'COL' | 'LYC';
export type CoverageFilter = 'ALL' | 'DEFICIT' | 'SURPLUS' | 'UNCOVERED' | 'COVERED';
export type ViewPreset = 'Need' | 'Coverage' | 'Cost' | 'Full View';

export const WORKSPACE_TABS: Array<{ value: WorkspaceTab; label: string }> = [
	{ value: 'demand', label: 'Demand' },
	{ value: 'roster', label: 'Roster' },
	{ value: 'coverage', label: 'Coverage' },
	{ value: 'costs', label: 'Costs' },
];

export type StaffingEditability = 'editable' | 'locked' | 'viewer';

export function deriveStaffingEditability({
	role,
	versionStatus,
}: {
	role?: string | null;
	versionStatus?: string | null;
}): StaffingEditability {
	if (role === 'Viewer') return 'viewer';
	if (versionStatus !== 'Draft') return 'locked';
	return 'editable';
}

export const BAND_FILTERS: Array<{ value: BandFilter; label: string }> = [
	{ value: 'ALL', label: 'All' },
	{ value: 'MAT', label: 'Mat' },
	{ value: 'ELEM', label: 'Elem' },
	{ value: 'COL', label: 'Col' },
	{ value: 'LYC', label: 'Lyc' },
];

export const VIEW_PRESETS: Array<{ value: ViewPreset; label: string }> = [
	{ value: 'Need', label: 'Need' },
	{ value: 'Coverage', label: 'Coverage' },
	{ value: 'Cost', label: 'Cost' },
	{ value: 'Full View', label: 'Full View' },
];

export const COVERAGE_OPTIONS: Array<{ value: CoverageFilter; label: string }> = [
	{ value: 'ALL', label: 'All Coverage' },
	{ value: 'DEFICIT', label: 'Deficit' },
	{ value: 'SURPLUS', label: 'Surplus' },
	{ value: 'UNCOVERED', label: 'Uncovered' },
	{ value: 'COVERED', label: 'Covered' },
];

// ── Teaching Grid Types ─────────────────────────────────────────────────────

export interface TeachingGridRow {
	rowType: 'requirement' | 'subtotal' | 'total';
	id: number;
	band: string;
	disciplineCode: string;
	lineLabel: string;
	lineType: string;
	serviceProfileCode: string;
	totalDriverUnits: number;
	totalWeeklyHours: string;
	baseOrs: string;
	effectiveOrs: string;
	requiredFteRaw: string;
	requiredFtePlanned: string;
	recommendedPositions: number;
	coveredFte: string;
	gapFte: string;
	coverageStatus: string;
	assignedStaffCount: number;
	directCostAnnual: string;
	hsaCostAnnual: string;
	lineCount?: number;
}

/** Canonical display order for bands. */
const BAND_ORDER: Record<string, number> = {
	MATERNELLE: 1,
	ELEMENTAIRE: 2,
	COLLEGE: 3,
	LYCEE: 4,
};

/** Map from short filter key to full band name. */
const BAND_FILTER_MAP: Record<string, string> = {
	MAT: 'MATERNELLE',
	ELEM: 'ELEMENTAIRE',
	COL: 'COLLEGE',
	LYC: 'LYCEE',
};

/**
 * Build band-grouped rows from API teaching requirement lines.
 * Sorts by band display order (MAT -> ELEM -> COL -> LYC),
 * adds subtotal rows per band, computes from requiredFteRaw (never recommendedPositions).
 */
export function buildTeachingGridRows(
	lines: import('../hooks/use-staffing').TeachingRequirementLine[]
): TeachingGridRow[] {
	if (lines.length === 0) return [];

	const sorted = [...lines].sort((a, b) => {
		const orderA = BAND_ORDER[a.band] ?? 99;
		const orderB = BAND_ORDER[b.band] ?? 99;
		return orderA - orderB;
	});

	const bandGroups = new Map<string, typeof sorted>();
	for (const line of sorted) {
		const existing = bandGroups.get(line.band);
		if (existing) {
			existing.push(line);
		} else {
			bandGroups.set(line.band, [line]);
		}
	}

	const result: TeachingGridRow[] = [];

	for (const [band, bandLines] of bandGroups) {
		for (const line of bandLines) {
			result.push({
				rowType: 'requirement',
				id: line.id,
				band: line.band,
				disciplineCode: line.disciplineCode,
				lineLabel: line.lineLabel,
				lineType: line.lineType,
				serviceProfileCode: line.serviceProfileCode,
				totalDriverUnits: line.totalDriverUnits,
				totalWeeklyHours: line.totalWeeklyHours,
				baseOrs: line.baseOrs,
				effectiveOrs: line.effectiveOrs,
				requiredFteRaw: line.requiredFteRaw,
				requiredFtePlanned: line.requiredFtePlanned,
				recommendedPositions: line.recommendedPositions,
				coveredFte: line.coveredFte,
				gapFte: line.gapFte,
				coverageStatus: line.coverageStatus,
				assignedStaffCount: line.assignedStaffCount,
				directCostAnnual: line.directCostAnnual,
				hsaCostAnnual: line.hsaCostAnnual,
			});
		}

		let sumFteRaw = 0;
		let sumCovered = 0;
		let sumGap = 0;
		for (const line of bandLines) {
			sumFteRaw += parseFloat(line.requiredFteRaw);
			sumCovered += parseFloat(line.coveredFte);
			sumGap += parseFloat(line.gapFte);
		}

		result.push({
			rowType: 'subtotal',
			id: 0,
			band,
			disciplineCode: '',
			lineLabel: `${band} Subtotal`,
			lineType: '',
			serviceProfileCode: '',
			totalDriverUnits: 0,
			totalWeeklyHours: '0',
			baseOrs: '0',
			effectiveOrs: '0',
			requiredFteRaw: sumFteRaw.toFixed(2),
			requiredFtePlanned: '0',
			recommendedPositions: 0,
			coveredFte: sumCovered.toFixed(2),
			gapFte: sumGap.toFixed(2),
			coverageStatus: '',
			assignedStaffCount: 0,
			directCostAnnual: '0',
			hsaCostAnnual: '0',
			lineCount: bandLines.length,
		});
	}

	return result;
}

/**
 * Filter teaching grid rows by band and coverage status.
 * Both filters are additive (applied simultaneously).
 */
export function filterTeachingRows(
	rows: TeachingGridRow[],
	bandFilter: BandFilter,
	coverageFilter: CoverageFilter
): TeachingGridRow[] {
	let filtered = rows;

	if (bandFilter !== 'ALL') {
		const bandName = BAND_FILTER_MAP[bandFilter];
		if (bandName) {
			filtered = filtered.filter((r) => r.band === bandName);
		}
	}

	if (coverageFilter !== 'ALL') {
		filtered = filtered.filter((r) => r.coverageStatus === coverageFilter);
	}

	return filtered;
}

// ── Support Grid Types ──────────────────────────────────────────────────────

export interface SupportDepartmentGroup {
	department: string;
	employees: import('../hooks/use-staffing').Employee[];
	employeeCount: number;
	subtotalAnnualCost: string;
}

/**
 * Build department-grouped rows for the Support & Admin grid.
 * Filters out teaching employees, groups by department,
 * computes headcount and subtotal annual cost per department.
 */
export function buildSupportGridRows(
	employees: import('../hooks/use-staffing').Employee[]
): SupportDepartmentGroup[] {
	const nonTeaching = employees.filter((emp) => !emp.isTeaching);

	if (nonTeaching.length === 0) return [];

	const deptMap = new Map<string, import('../hooks/use-staffing').Employee[]>();
	for (const emp of nonTeaching) {
		const dept = emp.department || 'Unassigned';
		const list = deptMap.get(dept);
		if (list) {
			list.push(emp);
		} else {
			deptMap.set(dept, [emp]);
		}
	}

	const groups: SupportDepartmentGroup[] = [];
	for (const [department, emps] of deptMap) {
		let subtotal = new Decimal(0);
		for (const emp of emps) {
			subtotal = subtotal.plus(new Decimal(emp.annualCost ?? '0'));
		}

		groups.push({
			department,
			employees: emps,
			employeeCount: emps.length,
			subtotalAnnualCost: subtotal.toFixed(4),
		});
	}

	return groups;
}

// ── Discipline Demand Types ──────────────────────────────────────────────────

export interface DisciplineDemandRow {
	key: string;
	disciplineCode: string;
	scope: string;
	colHoursPerWeek: string;
	lycHoursPerWeek: string;
	totalHoursPerWeek: string;
	effectiveOrs: string;
	fteRaw: string;
	postes: number;
	hsaHours: string;
	contributingLineIds: number[];
}

/**
 * Build discipline demand rows from teaching requirement lines.
 * Secondary (COLLEGE + LYCEE) lines sharing the same disciplineCode are pooled.
 * Primary (MATERNELLE, ELEMENTAIRE) lines pass through unchanged.
 */
export function buildDisciplineDemandRows(
	lines: import('../hooks/use-staffing').TeachingRequirementLine[]
): DisciplineDemandRow[] {
	const secondaryMap = new Map<
		string,
		{
			col: import('../hooks/use-staffing').TeachingRequirementLine[];
			lyc: import('../hooks/use-staffing').TeachingRequirementLine[];
		}
	>();
	const primaryRows: DisciplineDemandRow[] = [];

	for (const line of lines) {
		if (line.band === 'COLLEGE' || line.band === 'LYCEE') {
			const existing = secondaryMap.get(line.disciplineCode) ?? { col: [], lyc: [] };
			if (line.band === 'COLLEGE') {
				existing.col.push(line);
			} else {
				existing.lyc.push(line);
			}
			secondaryMap.set(line.disciplineCode, existing);
		} else {
			const scopeLabel = line.band === 'MATERNELLE' ? 'Mat' : 'Elem';
			const totalHours = new Decimal(line.totalWeeklyHours);
			const ors = new Decimal(line.effectiveOrs || '18');
			const fte = totalHours.div(ors);
			const postes = Math.ceil(fte.toNumber());
			const hsaHrs = new Decimal(postes).times(ors).minus(totalHours);

			primaryRows.push({
				key: `${line.band}-${line.disciplineCode}`,
				disciplineCode: line.disciplineCode,
				scope: scopeLabel,
				colHoursPerWeek: '0',
				lycHoursPerWeek: '0',
				totalHoursPerWeek: totalHours.toFixed(2),
				effectiveOrs: ors.toFixed(2),
				fteRaw: fte.toFixed(2),
				postes,
				hsaHours: hsaHrs.greaterThan(0) ? hsaHrs.toFixed(2) : '0.00',
				contributingLineIds: [line.id],
			});
		}
	}

	const secondaryRows: DisciplineDemandRow[] = [];
	for (const [disciplineCode, group] of secondaryMap) {
		const allLines = [...group.col, ...group.lyc];
		let colHours = new Decimal(0);
		let lycHours = new Decimal(0);

		for (const l of group.col) colHours = colHours.plus(l.totalWeeklyHours);
		for (const l of group.lyc) lycHours = lycHours.plus(l.totalWeeklyHours);

		const totalHours = colHours.plus(lycHours);
		const ors = new Decimal(allLines[0]?.effectiveOrs ?? '18');
		const fte = totalHours.div(ors);
		const postes = Math.ceil(fte.toNumber());
		const hsaHrs = new Decimal(postes).times(ors).minus(totalHours);

		secondaryRows.push({
			key: `COL_LYC-${disciplineCode}`,
			disciplineCode,
			scope: 'Col+Lyc',
			colHoursPerWeek: colHours.toFixed(2),
			lycHoursPerWeek: lycHours.toFixed(2),
			totalHoursPerWeek: totalHours.toFixed(2),
			effectiveOrs: ors.toFixed(2),
			fteRaw: fte.toFixed(2),
			postes,
			hsaHours: hsaHrs.greaterThan(0) ? hsaHrs.toFixed(2) : '0.00',
			contributingLineIds: allLines.map((l) => l.id),
		});
	}

	return [...primaryRows, ...secondaryRows];
}

// ── Discipline Summary Types (Coverage Tab) ──────────────────────────────────

export interface DisciplineSummaryRow {
	key: string;
	disciplineCode: string;
	scope: string;
	totalHoursPerWeek: string;
	fteNeeded: string;
	postes: number;
	hsaHours: string;
	coveredFte: string;
	gap: string;
	coverageStatus: string;
	estimatedCost: string;
	contributingLineIds: number[];
}

/**
 * Build discipline summary rows for the Coverage tab.
 * Aggregates requirement lines by scope + disciplineCode.
 * Coverage data comes from requirement lines (assignment-driven).
 */
export function buildDisciplineSummaryRows(
	lines: import('../hooks/use-staffing').TeachingRequirementLine[]
): DisciplineSummaryRow[] {
	const secondaryMap = new Map<string, import('../hooks/use-staffing').TeachingRequirementLine[]>();
	const primaryRows: DisciplineSummaryRow[] = [];

	for (const line of lines) {
		if (line.band === 'COLLEGE' || line.band === 'LYCEE') {
			const existing = secondaryMap.get(line.disciplineCode) ?? [];
			existing.push(line);
			secondaryMap.set(line.disciplineCode, existing);
		} else {
			const scopeLabel = line.band === 'MATERNELLE' ? 'Mat' : 'Elem';
			const totalHours = new Decimal(line.totalWeeklyHours);
			const ors = new Decimal(line.effectiveOrs || '18');
			const fte = totalHours.div(ors);
			const postes = Math.ceil(fte.toNumber());
			const hsaHrs = new Decimal(postes).times(ors).minus(totalHours);
			const covered = new Decimal(line.coveredFte);
			const gap = covered.minus(fte);
			const cost = new Decimal(line.directCostAnnual || '0').plus(line.hsaCostAnnual || '0');

			primaryRows.push({
				key: `${line.band}-${line.disciplineCode}`,
				disciplineCode: line.disciplineCode,
				scope: scopeLabel,
				totalHoursPerWeek: totalHours.toFixed(2),
				fteNeeded: fte.toFixed(2),
				postes,
				hsaHours: hsaHrs.greaterThan(0) ? hsaHrs.toFixed(2) : '0.00',
				coveredFte: covered.toFixed(2),
				gap: gap.toFixed(2),
				coverageStatus: line.coverageStatus,
				estimatedCost: cost.toFixed(2),
				contributingLineIds: [line.id],
			});
		}
	}

	const secondaryRows: DisciplineSummaryRow[] = [];
	for (const [disciplineCode, groupLines] of secondaryMap) {
		let totalHours = new Decimal(0);
		let totalCovered = new Decimal(0);
		let totalCost = new Decimal(0);
		let allUncovered = true;

		for (const l of groupLines) {
			totalHours = totalHours.plus(l.totalWeeklyHours);
			totalCovered = totalCovered.plus(l.coveredFte);
			totalCost = totalCost.plus(l.directCostAnnual || '0').plus(l.hsaCostAnnual || '0');
			if (l.coverageStatus !== 'UNCOVERED') allUncovered = false;
		}

		const ors = new Decimal(groupLines[0]?.effectiveOrs ?? '18');
		const fte = totalHours.div(ors);
		const postes = Math.ceil(fte.toNumber());
		const hsaHrs = new Decimal(postes).times(ors).minus(totalHours);
		const gap = totalCovered.minus(fte);

		let status: string;
		if (allUncovered) {
			status = 'UNCOVERED';
		} else if (gap.lessThan(-0.25)) {
			status = 'DEFICIT';
		} else if (gap.greaterThan(0.25)) {
			status = 'SURPLUS';
		} else {
			status = 'COVERED';
		}

		secondaryRows.push({
			key: `COL_LYC-${disciplineCode}`,
			disciplineCode,
			scope: 'Col+Lyc',
			totalHoursPerWeek: totalHours.toFixed(2),
			fteNeeded: fte.toFixed(2),
			postes,
			hsaHours: hsaHrs.greaterThan(0) ? hsaHrs.toFixed(2) : '0.00',
			coveredFte: totalCovered.toFixed(2),
			gap: gap.toFixed(2),
			coverageStatus: status,
			estimatedCost: totalCost.toFixed(2),
			contributingLineIds: groupLines.map((l) => l.id),
		});
	}

	return [...primaryRows, ...secondaryRows];
}

// ── Tab KPI Derivation ───────────────────────────────────────────────────────

export interface TabKpiValues {
	items: Array<{ label: string; value: string | number }>;
}

export function deriveTabKpis(
	activeTab: WorkspaceTab,
	teachingReqData: import('../hooks/use-staffing').TeachingRequirementsResponse | undefined,
	employeesData: import('../hooks/use-staffing').EmployeeListResponse | undefined,
	summaryData: import('../hooks/use-staffing').StaffingSummaryResponse | undefined,
	categoryCosts: import('../hooks/use-staffing').CategoryCostData | undefined,
	assignmentsData: import('../hooks/use-staffing').StaffingAssignmentsResponse | undefined
): TabKpiValues {
	const totals = teachingReqData?.totals;

	switch (activeTab) {
		case 'demand':
			return {
				items: [
					{ label: 'Total FTE Needed', value: totals?.totalFteRaw ?? '0' },
					{ label: 'Requirement Lines', value: totals?.lineCount ?? 0 },
					{ label: 'Total FTE Gap', value: totals?.totalFteGap ?? '0' },
				],
			};
		case 'roster': {
			const employees = employeesData?.data ?? [];
			const assignedIds = new Set((assignmentsData?.data ?? []).map((a) => a.employeeId));
			const teachingCount = employees.filter((e) => e.isTeaching).length;
			const assignedCount = employees.filter((e) => e.isTeaching && assignedIds.has(e.id)).length;
			const vacancyCount = employees.filter((e) => e.recordType === 'VACANCY').length;
			return {
				items: [
					{ label: 'Total Headcount', value: employeesData?.total ?? 0 },
					{ label: 'Teaching Assigned', value: `${assignedCount}/${teachingCount}` },
					{ label: 'Vacancies', value: vacancyCount },
				],
			};
		}
		case 'coverage': {
			const lines = teachingReqData?.lines ?? [];
			const summaryRows = buildDisciplineSummaryRows(lines);
			let covered = 0;
			let deficit = 0;
			let uncovered = 0;
			let surplus = 0;
			for (const row of summaryRows) {
				if (row.coverageStatus === 'COVERED') covered++;
				else if (row.coverageStatus === 'DEFICIT') deficit++;
				else if (row.coverageStatus === 'UNCOVERED') uncovered++;
				else if (row.coverageStatus === 'SURPLUS') surplus++;
			}
			return {
				items: [
					{ label: 'Covered', value: covered },
					{ label: 'Deficit', value: deficit },
					{ label: 'Uncovered', value: uncovered },
					{ label: 'Surplus', value: surplus },
				],
			};
		}
		case 'costs':
			return {
				items: [
					{ label: 'Total Cost', value: summaryData?.cost ?? '0' },
					{ label: 'Headcount', value: employeesData?.total ?? 0 },
					{
						label: 'Category Total',
						value: categoryCosts?.grand_total ?? '0',
					},
				],
			};
		default:
			return { items: [] };
	}
}
