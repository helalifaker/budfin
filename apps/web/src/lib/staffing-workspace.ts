// ── Staffing Workspace Types & Utilities ────────────────────────────────────

export type WorkspaceMode = 'teaching' | 'support';
export type BandFilter = 'ALL' | 'MAT' | 'ELEM' | 'COL' | 'LYC';
export type CoverageFilter = 'ALL' | 'DEFICIT' | 'SURPLUS' | 'UNCOVERED' | 'COVERED';
export type ViewPreset = 'Need' | 'Coverage' | 'Cost' | 'Full View';

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

	// Sort lines by band display order, preserving original order within each band
	const sorted = [...lines].sort((a, b) => {
		const orderA = BAND_ORDER[a.band] ?? 99;
		const orderB = BAND_ORDER[b.band] ?? 99;
		return orderA - orderB;
	});

	// Group by band
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
		// Add requirement rows for this band
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

		// Compute band subtotals using requiredFteRaw (continuous decimal, not positions)
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
 * Only filters requirement rows (subtotal/total rows are excluded from filtering input).
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
	// Filter to non-teaching employees only
	const nonTeaching = employees.filter((emp) => !emp.isTeaching);

	if (nonTeaching.length === 0) return [];

	// Group by department
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
		let subtotal = 0;
		for (const emp of emps) {
			subtotal += parseFloat(emp.annualCost ?? '0');
		}

		groups.push({
			department,
			employees: emps,
			employeeCount: emps.length,
			subtotalAnnualCost: String(subtotal),
		});
	}

	return groups;
}
