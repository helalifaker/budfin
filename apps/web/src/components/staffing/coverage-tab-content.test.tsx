import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import { CoverageTabContent } from './coverage-tab-content';
import type { TeachingRequirementsResponse } from '../../hooks/use-staffing';

// ── Store mocks ─────────────────────────────────────────────────────────────

const mockSelectDisciplineSummary = vi.fn();
let mockSelection: { type: string; scope?: string; disciplineCode?: string } | null = null;

vi.mock('../../stores/staffing-selection-store', () => ({
	useStaffingSelectionStore: (selector: (state: unknown) => unknown) =>
		selector({
			selectDisciplineSummary: mockSelectDisciplineSummary,
			selection: mockSelection,
		}),
}));

// ── Hook mocks ───────────────────────────────────────────────────────────────

const mockAutoSuggestMutate = vi.fn();

vi.mock('../../hooks/use-master-data', () => ({
	useAutoSuggestAssignments: () => ({
		mutate: mockAutoSuggestMutate,
		isPending: false,
	}),
}));

// ── Child component mocks ───────────────────────────────────────────────────

vi.mock('./discipline-summary-grid', () => ({
	DisciplineSummaryGrid: ({
		rows,
		onRowSelect,
		selectedKey,
	}: {
		rows: unknown[];
		onRowSelect: (row: unknown) => void;
		selectedKey: string | null;
	}) => (
		<div
			data-testid="discipline-summary-grid"
			data-row-count={rows.length}
			data-selected-key={selectedKey ?? ''}
		>
			{(
				rows as Array<{ disciplineCode: string; scope: string; contributingLineIds: number[] }>
			).map((row) => (
				<button
					key={`${row.scope}-${row.disciplineCode}`}
					type="button"
					data-testid={`row-${row.disciplineCode}`}
					onClick={() => onRowSelect(row)}
				>
					{row.disciplineCode} ({row.scope})
				</button>
			))}
		</div>
	),
}));

vi.mock('./auto-suggest-dialog', () => ({
	AutoSuggestDialog: ({
		open,
		versionId,
	}: {
		open: boolean;
		onOpenChange: (v: boolean) => void;
		versionId: number;
		suggestions: unknown[];
	}) => (open ? <div data-testid="auto-suggest-dialog" data-version={versionId} /> : null),
}));

vi.mock('../ui/button', () => ({
	Button: ({
		children,
		onClick,
		disabled,
		'aria-busy': ariaBusy,
		...props
	}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
		children: ReactNode;
		variant?: string;
		size?: string;
		'aria-busy'?: boolean;
	}) => (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			aria-busy={ariaBusy ? 'true' : undefined}
			{...props}
		>
			{children}
		</button>
	),
}));

vi.mock('../ui/dropdown-menu', () => ({
	DropdownMenu: ({ children }: { children: ReactNode }) => (
		<div data-testid="dropdown-menu">{children}</div>
	),
	DropdownMenuTrigger: ({
		children,
		asChild: _asChild,
	}: {
		children: ReactNode;
		asChild?: boolean;
	}) => <div data-testid="dropdown-trigger">{children}</div>,
	DropdownMenuContent: ({ children }: { children: ReactNode; align?: string }) => (
		<div data-testid="dropdown-content">{children}</div>
	),
	DropdownMenuItem: ({
		children,
		onSelect,
	}: {
		children: ReactNode;
		onSelect?: () => void;
		'aria-current'?: string;
	}) => (
		<button type="button" data-testid="dropdown-item" onClick={onSelect}>
			{children}
		</button>
	),
}));

vi.mock('../ui/toggle-group', () => ({
	ToggleGroup: ({
		children,
		'aria-label': ariaLabel,
	}: {
		children: ReactNode;
		value: string;
		onValueChange?: (v: string) => void;
		type: string;
		'aria-label'?: string;
	}) => (
		<div role="group" aria-label={ariaLabel}>
			{children}
		</div>
	),
	ToggleGroupItem: ({
		children,
		value,
		'aria-label': ariaLabel,
	}: {
		children: ReactNode;
		value: string;
		'aria-label'?: string;
	}) => (
		<button type="button" data-value={value} aria-label={ariaLabel}>
			{children}
		</button>
	),
}));

vi.mock('../../lib/staffing-workspace', () => ({
	BAND_FILTERS: [
		{ value: 'ALL', label: 'All' },
		{ value: 'MAT', label: 'Mat' },
		{ value: 'ELEM', label: 'Elem' },
		{ value: 'COL', label: 'Col' },
		{ value: 'LYC', label: 'Lyc' },
	],
	COVERAGE_OPTIONS: [
		{ value: 'ALL', label: 'All Coverage' },
		{ value: 'DEFICIT', label: 'Deficit' },
		{ value: 'SURPLUS', label: 'Surplus' },
		{ value: 'UNCOVERED', label: 'Uncovered' },
		{ value: 'COVERED', label: 'Covered' },
	],
	buildDisciplineSummaryRows: (lines: unknown[]) => {
		// Simple stub: return one row per unique discipline code
		const seen = new Set<string>();
		return (
			lines as Array<{
				disciplineCode: string;
				band: string;
				coverageStatus: string;
				id: number;
			}>
		)
			.filter((l) => {
				if (seen.has(l.disciplineCode)) return false;
				seen.add(l.disciplineCode);
				return true;
			})
			.map((l) => ({
				disciplineCode: l.disciplineCode,
				scope: l.band === 'MATERNELLE' ? 'Mat' : 'Elem',
				coverageStatus: l.coverageStatus,
				contributingLineIds: [l.id],
				fteCovered: '2.50',
				fteGap: '0.00',
			}));
	},
}));

// ── Fixtures ─────────────────────────────────────────────────────────────────

const TEACHING_REQ_DATA: TeachingRequirementsResponse = {
	lines: [
		{
			id: 1,
			band: 'MATERNELLE',
			disciplineCode: 'FR',
			lineType: 'STRUCTURAL',
			lineLabel: 'Francais - Maternelle',
			coverageStatus: 'COVERED',
			serviceProfileCode: 'P1',
			totalDriverUnits: 2,
			totalWeeklyHours: '8.0',
			baseOrs: '24',
			effectiveOrs: '24',
			requiredFteRaw: '2.50',
			requiredFteCalculated: '2.50',
			coveredFte: '2.50',
			gapFte: '0.00',
			assignedStaffCount: 3,
			vacancyCount: 0,
			driverType: 'SECTION',
			directCostAnnual: '360000',
			hsaCostAnnual: '15000',
			requiredFtePlanned: '3.00',
			recommendedPositions: 3,
			assignedEmployees: [],
		},
		{
			id: 2,
			band: 'ELEMENTAIRE',
			disciplineCode: 'MATH',
			lineType: 'STRUCTURAL',
			lineLabel: 'Mathematics - Elementaire',
			coverageStatus: 'DEFICIT',
			serviceProfileCode: 'P1',
			totalDriverUnits: 3,
			totalWeeklyHours: '12.0',
			baseOrs: '24',
			effectiveOrs: '24',
			requiredFteRaw: '4.00',
			requiredFteCalculated: '4.00',
			coveredFte: '3.00',
			gapFte: '-1.00',
			assignedStaffCount: 3,
			vacancyCount: 1,
			driverType: 'SECTION',
			directCostAnnual: '480000',
			hsaCostAnnual: '20000',
			requiredFtePlanned: '4.00',
			recommendedPositions: 4,
			assignedEmployees: [],
		},
	],
	totals: {
		totalFteRaw: '6.50',
		totalFteCovered: '5.50',
		totalFteGap: '-1.00',
		totalDirectCost: '840000',
		totalHsaCost: '35000',
		lineCount: 2,
	},
	warnings: [],
};

afterEach(() => {
	cleanup();
	mockSelection = null;
	mockSelectDisciplineSummary.mockReset();
	mockAutoSuggestMutate.mockReset();
});

describe('CoverageTabContent', () => {
	// ── Basic render ─────────────────────────────────────────────────────────

	it('renders without crashing', () => {
		render(
			<CoverageTabContent versionId={42} teachingReqData={TEACHING_REQ_DATA} isEditable={true} />
		);
		expect(screen.getByTestId('discipline-summary-grid')).toBeDefined();
	});

	// ── Toolbar ──────────────────────────────────────────────────────────────

	it('renders band filter toggle group with aria-label', () => {
		render(
			<CoverageTabContent versionId={42} teachingReqData={TEACHING_REQ_DATA} isEditable={true} />
		);
		expect(screen.getByRole('group', { name: 'Filter by band scope' })).toBeDefined();
	});

	it('renders band filter buttons: All, Mat, Elem, Col, Lyc', () => {
		render(
			<CoverageTabContent versionId={42} teachingReqData={TEACHING_REQ_DATA} isEditable={true} />
		);
		expect(screen.getByRole('button', { name: 'Filter All' })).toBeDefined();
		expect(screen.getByRole('button', { name: 'Filter Mat' })).toBeDefined();
		expect(screen.getByRole('button', { name: 'Filter Elem' })).toBeDefined();
		expect(screen.getByRole('button', { name: 'Filter Col' })).toBeDefined();
		expect(screen.getByRole('button', { name: 'Filter Lyc' })).toBeDefined();
	});

	it('renders coverage filter dropdown', () => {
		render(
			<CoverageTabContent versionId={42} teachingReqData={TEACHING_REQ_DATA} isEditable={true} />
		);
		// Default label is "All Coverage"
		expect(screen.getByRole('button', { name: /coverage filter: all coverage/i })).toBeDefined();
	});

	it('shows row count indicator', () => {
		render(
			<CoverageTabContent versionId={42} teachingReqData={TEACHING_REQ_DATA} isEditable={true} />
		);
		// 2 distinct discipline codes → 2 rows
		expect(screen.getByText('2 disciplines')).toBeDefined();
	});

	it('shows singular "discipline" when only 1 row', () => {
		const singleLineData: TeachingRequirementsResponse = {
			...TEACHING_REQ_DATA,
			lines: [TEACHING_REQ_DATA.lines[0]!],
		};
		render(
			<CoverageTabContent versionId={42} teachingReqData={singleLineData} isEditable={true} />
		);
		expect(screen.getByText('1 discipline')).toBeDefined();
	});

	// ── Auto-suggest button ──────────────────────────────────────────────────

	it('shows Auto-Suggest button when isEditable is true', () => {
		render(
			<CoverageTabContent versionId={42} teachingReqData={TEACHING_REQ_DATA} isEditable={true} />
		);
		expect(screen.getByRole('button', { name: /auto-suggest/i })).toBeDefined();
	});

	it('hides Auto-Suggest button when isEditable is false', () => {
		render(
			<CoverageTabContent versionId={42} teachingReqData={TEACHING_REQ_DATA} isEditable={false} />
		);
		expect(screen.queryByRole('button', { name: /auto-suggest/i })).toBeNull();
	});

	it('calls autoSuggest.mutate when Auto-Suggest button is clicked', () => {
		render(
			<CoverageTabContent versionId={42} teachingReqData={TEACHING_REQ_DATA} isEditable={true} />
		);
		fireEvent.click(screen.getByRole('button', { name: /auto-suggest/i }));
		expect(mockAutoSuggestMutate).toHaveBeenCalled();
	});

	// ── Grid ─────────────────────────────────────────────────────────────────

	it('passes built discipline rows to DisciplineSummaryGrid', () => {
		render(
			<CoverageTabContent versionId={42} teachingReqData={TEACHING_REQ_DATA} isEditable={true} />
		);
		const grid = screen.getByTestId('discipline-summary-grid');
		expect(grid.getAttribute('data-row-count')).toBe('2');
	});

	it('calls selectDisciplineSummary when a grid row is clicked', () => {
		render(
			<CoverageTabContent versionId={42} teachingReqData={TEACHING_REQ_DATA} isEditable={true} />
		);
		fireEvent.click(screen.getByTestId('row-FR'));
		expect(mockSelectDisciplineSummary).toHaveBeenCalledWith('FR', 'Mat', [1]);
	});

	it('passes selectedKey=null when no selection', () => {
		mockSelection = null;
		render(
			<CoverageTabContent versionId={42} teachingReqData={TEACHING_REQ_DATA} isEditable={true} />
		);
		const grid = screen.getByTestId('discipline-summary-grid');
		expect(grid.getAttribute('data-selected-key')).toBe('');
	});

	// ── Auto-suggest dialog ──────────────────────────────────────────────────

	it('auto-suggest dialog is closed by default', () => {
		render(
			<CoverageTabContent versionId={42} teachingReqData={TEACHING_REQ_DATA} isEditable={true} />
		);
		expect(screen.queryByTestId('auto-suggest-dialog')).toBeNull();
	});

	it('shows auto-suggest dialog when suggestions are returned', () => {
		// Wire the mutate to call onSuccess with suggestions
		mockAutoSuggestMutate.mockImplementation(
			(_: undefined, callbacks: { onSuccess: (data: unknown) => void }) => {
				callbacks.onSuccess({ suggestions: [{ employeeId: 1 }] });
			}
		);
		render(
			<CoverageTabContent versionId={42} teachingReqData={TEACHING_REQ_DATA} isEditable={true} />
		);
		fireEvent.click(screen.getByRole('button', { name: /auto-suggest/i }));
		expect(screen.getByTestId('auto-suggest-dialog')).toBeDefined();
	});

	// ── Coverage dropdown items ──────────────────────────────────────────────

	it('renders coverage filter dropdown items', () => {
		render(
			<CoverageTabContent versionId={42} teachingReqData={TEACHING_REQ_DATA} isEditable={true} />
		);
		const items = screen.getAllByTestId('dropdown-item');
		expect(items.length).toBeGreaterThanOrEqual(5); // ALL, DEFICIT, SURPLUS, UNCOVERED, COVERED
	});
});
