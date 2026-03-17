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
