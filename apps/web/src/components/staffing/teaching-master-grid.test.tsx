import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TeachingMasterGrid } from './teaching-master-grid';
import type {
	TeachingRequirementLine,
	TeachingRequirementsResponse,
} from '../../hooks/use-staffing';
import type { ViewPreset } from '../../lib/staffing-workspace';

const mockSelectRequirementLine = vi.fn();
vi.mock('../../stores/staffing-selection-store', () => ({
	useStaffingSelectionStore: (
		selector: (state: {
			selection: null;
			selectRequirementLine: typeof mockSelectRequirementLine;
		}) => unknown
	) => selector({ selection: null, selectRequirementLine: mockSelectRequirementLine }),
}));
vi.mock('../../lib/format-money', () => ({
	formatMoney: (value: string | number) => `SAR ${value}`,
}));

function makeLine(overrides: Partial<TeachingRequirementLine> = {}): TeachingRequirementLine {
	return {
		id: 1,
		band: 'MATERNELLE',
		disciplineCode: 'FR',
		lineLabel: 'Francais - Maternelle',
		lineType: 'Structural',
		serviceProfileCode: 'PE',
		totalDriverUnits: 10,
		totalWeeklyHours: '15.0',
		baseOrs: '24.0',
		effectiveOrs: '24.0',
		requiredFteRaw: '0.63',
		requiredFtePlanned: '1.00',
		recommendedPositions: 1,
		coveredFte: '0.63',
		gapFte: '0.00',
		coverageStatus: 'COVERED',
		assignedStaffCount: 1,
		directCostAnnual: '120000.00',
		hsaCostAnnual: '5000.00',
		...overrides,
	};
}

const MOCK_DATA: TeachingRequirementsResponse = {
	data: [
		makeLine({
			id: 1,
			band: 'MATERNELLE',
			disciplineCode: 'FR',
			lineLabel: 'Francais - Mat',
			requiredFteRaw: '2.50',
			coveredFte: '2.00',
			gapFte: '-0.50',
			coverageStatus: 'DEFICIT',
			assignedStaffCount: 2,
		}),
		makeLine({
			id: 2,
			band: 'MATERNELLE',
			disciplineCode: 'MA',
			lineLabel: 'Maths - Mat',
			requiredFteRaw: '1.50',
			coveredFte: '1.50',
			gapFte: '0.00',
			coverageStatus: 'COVERED',
			assignedStaffCount: 2,
		}),
		makeLine({
			id: 3,
			band: 'ELEMENTAIRE',
			disciplineCode: 'FR',
			lineLabel: 'Francais - Elem',
			requiredFteRaw: '3.00',
			coveredFte: '3.50',
			gapFte: '0.50',
			coverageStatus: 'SURPLUS',
			assignedStaffCount: 4,
		}),
		makeLine({
			id: 4,
			band: 'COLLEGE',
			disciplineCode: 'SCI',
			lineLabel: 'Sciences - Col',
			requiredFteRaw: '2.00',
			coveredFte: '0.00',
			gapFte: '-2.00',
			coverageStatus: 'UNCOVERED',
			assignedStaffCount: 0,
		}),
		makeLine({
			id: 5,
			band: 'LYCEE',
			disciplineCode: 'PHI',
			lineLabel: 'Philosophie - Lyc',
			requiredFteRaw: '1.00',
			coveredFte: '1.00',
			gapFte: '0.00',
			coverageStatus: 'COVERED',
			assignedStaffCount: 1,
		}),
	],
	totals: {
		totalFteRaw: '10.00',
		totalFtePlanned: '10.00',
		totalFteCovered: '8.00',
		totalFteGap: '-2.00',
	},
};

const DEFAULT_PROPS = {
	data: MOCK_DATA,
	viewPreset: 'Full View' as ViewPreset,
	bandFilter: 'ALL' as const,
	coverageFilter: 'ALL' as const,
	selectedLineId: null as number | null,
};

describe('TeachingMasterGrid', () => {
	beforeEach(() => {
		mockSelectRequirementLine.mockClear();
	});
	afterEach(() => {
		cleanup();
	});

	describe('AC-05: Band grouping', () => {
		it('renders band group headers in correct order', () => {
			render(<TeachingMasterGrid {...DEFAULT_PROPS} />);
			const rows = screen.getAllByRole('row').filter((r) => {
				const t = r.textContent ?? '';
				return (
					t.includes('Maternelle') ||
					t.includes('Elementaire') ||
					t.includes('College') ||
					t.includes('Lycee')
				);
			});
			const texts = rows.map((h) => h.textContent);
			expect(texts.findIndex((t) => t?.includes('Maternelle'))).toBeLessThan(
				texts.findIndex((t) => t?.includes('Elementaire'))
			);
			expect(texts.findIndex((t) => t?.includes('Elementaire'))).toBeLessThan(
				texts.findIndex((t) => t?.includes('College'))
			);
			expect(texts.findIndex((t) => t?.includes('College'))).toBeLessThan(
				texts.findIndex((t) => t?.includes('Lycee'))
			);
		});
		it('displays line count badge in band headers', () => {
			render(<TeachingMasterGrid {...DEFAULT_PROPS} />);
			const matHeader = screen
				.getAllByRole('row')
				.find((r) => r.textContent?.includes('Maternelle'));
			expect(matHeader?.textContent).toContain('2');
		});
		it('displays subtotal values in band footers', () => {
			render(<TeachingMasterGrid {...DEFAULT_PROPS} />);
			const table = screen.getByRole('table');
			expect(table.textContent).toContain('4.00');
		});
		it('renders band headers with background styles', () => {
			const { container } = render(<TeachingMasterGrid {...DEFAULT_PROPS} />);
			expect(container.querySelectorAll('td[class*="bg-"]').length).toBeGreaterThan(0);
		});
	});

	describe('AC-06: Coverage status badges', () => {
		it('renders DEFICIT badge', () => {
			render(<TeachingMasterGrid {...DEFAULT_PROPS} />);
			expect(screen.getByText(/Deficit/)).toBeTruthy();
		});
		it('renders COVERED badge', () => {
			render(<TeachingMasterGrid {...DEFAULT_PROPS} />);
			expect(screen.getAllByText(/Covered/).length).toBeGreaterThanOrEqual(1);
		});
		it('renders SURPLUS badge', () => {
			render(<TeachingMasterGrid {...DEFAULT_PROPS} />);
			expect(screen.getByText(/Surplus/)).toBeTruthy();
		});
		it('renders UNCOVERED badge', () => {
			render(<TeachingMasterGrid {...DEFAULT_PROPS} />);
			expect(screen.getByText(/None/)).toBeTruthy();
		});
		it('has aria-label on status cells', () => {
			render(<TeachingMasterGrid {...DEFAULT_PROPS} />);
			expect(screen.getByLabelText(/Coverage: DEFICIT/i)).toBeTruthy();
		});
		it('renders gap cells with data-column', () => {
			const { container } = render(<TeachingMasterGrid {...DEFAULT_PROPS} />);
			expect(container.querySelectorAll('[data-column="gapFte"]').length).toBeGreaterThan(0);
		});
	});

	describe('AC-07: Filtering', () => {
		it('shows only MAT lines when band filter is MAT', () => {
			render(<TeachingMasterGrid {...DEFAULT_PROPS} bandFilter="MAT" />);
			expect(screen.getByText('Francais - Mat')).toBeTruthy();
			expect(screen.getByText('Maths - Mat')).toBeTruthy();
			expect(screen.queryByText('Francais - Elem')).toBeNull();
			expect(screen.queryByText('Sciences - Col')).toBeNull();
		});
		it('shows only DEFICIT lines', () => {
			render(<TeachingMasterGrid {...DEFAULT_PROPS} coverageFilter="DEFICIT" />);
			expect(screen.getByText('Francais - Mat')).toBeTruthy();
			expect(screen.queryByText('Maths - Mat')).toBeNull();
		});
		it('applies filters additively', () => {
			render(<TeachingMasterGrid {...DEFAULT_PROPS} bandFilter="MAT" coverageFilter="COVERED" />);
			expect(screen.getByText('Maths - Mat')).toBeTruthy();
			expect(screen.queryByText('Francais - Mat')).toBeNull();
		});
		it('shows empty when no match', () => {
			render(<TeachingMasterGrid {...DEFAULT_PROPS} bandFilter="LYC" coverageFilter="DEFICIT" />);
			expect(screen.queryByText('Philosophie - Lyc')).toBeNull();
		});
	});

	describe('AC-08: Grand total', () => {
		it('renders grand total in tfoot', () => {
			render(<TeachingMasterGrid {...DEFAULT_PROPS} />);
			const tfoot = screen.getByRole('table').querySelector('tfoot');
			expect(tfoot).toBeTruthy();
			expect(tfoot?.textContent).toContain('Total');
		});
		it('uses API totals directly', () => {
			render(<TeachingMasterGrid {...DEFAULT_PROPS} />);
			expect(screen.getByRole('table').querySelector('tfoot')?.textContent).toContain('10.00');
		});
		it('shows totalFteRaw not sum of positions', () => {
			const customData: TeachingRequirementsResponse = {
				data: [
					makeLine({ id: 10, band: 'MATERNELLE', requiredFteRaw: '1.33', recommendedPositions: 2 }),
					makeLine({ id: 11, band: 'MATERNELLE', requiredFteRaw: '0.67', recommendedPositions: 1 }),
				],
				totals: {
					totalFteRaw: '2.00',
					totalFtePlanned: '2.00',
					totalFteCovered: '1.50',
					totalFteGap: '-0.50',
				},
			};
			render(<TeachingMasterGrid {...DEFAULT_PROPS} data={customData} />);
			expect(screen.getByRole('table').querySelector('tfoot')?.textContent).toContain('2.00');
		});
	});

	describe('Row interaction', () => {
		it('calls selectRequirementLine on click', () => {
			render(<TeachingMasterGrid {...DEFAULT_PROPS} />);
			const row = screen.getByText('Francais - Mat').closest('tr');
			if (row) fireEvent.click(row);
			expect(mockSelectRequirementLine).toHaveBeenCalledWith(1, 'MATERNELLE', 'FR');
		});
		it('highlights selected row', () => {
			const { container } = render(<TeachingMasterGrid {...DEFAULT_PROPS} selectedLineId={1} />);
			expect(container.querySelector('[aria-selected="true"]')).toBeTruthy();
		});
	});

	describe('Column visibility', () => {
		it('Need preset hides coverage and cost columns', () => {
			render(<TeachingMasterGrid {...DEFAULT_PROPS} viewPreset="Need" />);
			const h = screen.getAllByRole('columnheader').map((x) => x.textContent);
			expect(h).not.toContain('Status');
			expect(h).not.toContain('Direct Cost');
			expect(h).toContain('Line');
			expect(h).toContain('Raw FTE');
		});
		it('Coverage preset shows status and covered', () => {
			render(<TeachingMasterGrid {...DEFAULT_PROPS} viewPreset="Coverage" />);
			const h = screen.getAllByRole('columnheader').map((x) => x.textContent);
			expect(h).toContain('Status');
			expect(h).toContain('Covered');
			expect(h).not.toContain('Direct Cost');
		});
		it('Cost preset shows cost columns', () => {
			render(<TeachingMasterGrid {...DEFAULT_PROPS} viewPreset="Cost" />);
			const h = screen.getAllByRole('columnheader').map((x) => x.textContent);
			expect(h).toContain('Direct Cost');
			expect(h).toContain('HSA Cost');
			expect(h).not.toContain('ORS');
		});
		it('Full View shows all columns', () => {
			render(<TeachingMasterGrid {...DEFAULT_PROPS} viewPreset="Full View" />);
			const h = screen.getAllByRole('columnheader').map((x) => x.textContent);
			expect(h).toContain('Line');
			expect(h).toContain('Status');
			expect(h).toContain('Direct Cost');
		});
	});

	describe('Table semantics', () => {
		it('uses role="table"', () => {
			render(<TeachingMasterGrid {...DEFAULT_PROPS} />);
			expect(screen.getByRole('table')).toBeTruthy();
		});
		it('has aria-label', () => {
			render(<TeachingMasterGrid {...DEFAULT_PROPS} />);
			expect(screen.getByRole('table').getAttribute('aria-label')).toBeTruthy();
		});
	});
});
