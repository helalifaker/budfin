import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { PnlPage } from './pnl-page';

vi.mock('../shared/export-dialog', () => ({
	ExportDialog: () => null,
}));

// ── Mutable mock state ───────────────────────────────────────────────────────

let mockWorkspaceContext = {
	versionId: 10 as number | null,
	versionStatus: 'Draft' as string | null,
	comparisonVersionId: null as number | null,
	fiscalYear: 2026,
};

let mockUserRole = 'Admin';

let mockVersionsData = {
	data: [
		{
			id: 10,
			name: 'Budget v1',
			status: 'Draft',
			staleModules: [] as string[],
		},
	],
};

let mockPnlData: { lines: unknown[]; calculatedAt?: string } | null = null;
let mockPnlLoading = false;
let mockPnlError = false;
let mockKpisData: Record<string, string> | undefined = undefined;
let mockKpisLoading = false;

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../hooks/use-workspace-context', () => ({
	useWorkspaceContext: () => mockWorkspaceContext,
}));

vi.mock('../../stores/auth-store', () => ({
	useAuthStore: (selector: (state: { user: { role: string } }) => unknown) =>
		selector({ user: { role: mockUserRole } }),
}));

vi.mock('../../hooks/use-versions', () => ({
	useVersions: () => ({
		data: mockVersionsData,
	}),
}));

vi.mock('../../hooks/use-pnl', () => ({
	usePnlResults: () => ({
		data: mockPnlData,
		isLoading: mockPnlLoading,
		isError: mockPnlError,
	}),
	usePnlKpis: () => ({
		data: mockKpisData,
		isLoading: mockKpisLoading,
	}),
	useCalculatePnl: () => ({
		mutate: vi.fn(),
		isPending: false,
		isSuccess: false,
		isError: false,
	}),
}));

vi.mock('react-router', () => ({
	useNavigate: () => vi.fn(),
}));

vi.mock('../../stores/right-panel-store', () => ({
	useRightPanelStore: (selector: (state: Record<string, unknown>) => unknown) =>
		selector({
			setActivePage: vi.fn(),
			isOpen: false,
			open: vi.fn(),
			close: vi.fn(),
		}),
}));

vi.mock('../../stores/pnl-selection-store', () => ({
	usePnlSelectionStore: (selector: (state: Record<string, unknown>) => unknown) =>
		selector({
			selection: null,
			selectRow: vi.fn(),
			clearSelection: vi.fn(),
		}),
}));

vi.mock('../../lib/right-panel-registry', () => ({
	registerPanelContent: vi.fn(),
}));

vi.mock('../pnl/pnl-inspector-content', () => ({}));

vi.mock('../../components/shared/page-transition', () => ({
	PageTransition: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../components/shared/counter', () => ({
	Counter: ({ value, formatter }: { value: number; formatter?: (v: number) => string }) => (
		<span>{formatter ? formatter(value) : String(value)}</span>
	),
}));

vi.mock('../../lib/format-money', () => ({
	formatMoney: (val: unknown) => {
		const num =
			typeof val === 'object' && val !== null && 'toNumber' in val
				? (val as { toNumber: () => number }).toNumber()
				: Number(val);
		return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(num);
	},
}));

vi.mock('../../lib/format-date', () => ({
	formatDateTime: (iso: string | null) => iso ?? 'Not calculated',
}));

// ── Setup / Teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
	mockWorkspaceContext = {
		versionId: 10,
		versionStatus: 'Draft',
		comparisonVersionId: null,
		fiscalYear: 2026,
	};
	mockUserRole = 'Admin';
	mockVersionsData = {
		data: [
			{
				id: 10,
				name: 'Budget v1',
				status: 'Draft',
				staleModules: [],
			},
		],
	};
	mockPnlData = null;
	mockPnlLoading = false;
	mockPnlError = false;
	mockKpisData = undefined;
	mockKpisLoading = false;
});

afterEach(() => {
	cleanup();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('PnlPage', () => {
	it('renders loading skeletons when KPIs are loading', () => {
		mockKpisLoading = true;

		const { container } = render(<PnlPage />);

		const skeletons = container.querySelectorAll('.rounded-xl');
		expect(skeletons.length).toBeGreaterThan(0);
	});

	it('renders KPI cards with correct labels when data exists', () => {
		mockKpisData = {
			totalRevenueHt: '5000000.0000',
			ebitda: '1500000.0000',
			ebitdaMarginPct: '30.00',
			netProfit: '1200000.0000',
		};

		render(<PnlPage />);

		expect(screen.getByText('Total Revenue HT')).toBeTruthy();
		expect(screen.getByText('EBITDA')).toBeTruthy();
		expect(screen.getByText('EBITDA Margin')).toBeTruthy();
		expect(screen.getByText('Net Profit')).toBeTruthy();
	});

	it('renders grid with header and monthly columns', () => {
		mockPnlData = {
			lines: [createMockLine()],
		};

		render(<PnlPage />);

		expect(screen.getByText('Jan')).toBeTruthy();
		expect(screen.getByText('Dec')).toBeTruthy();
		expect(screen.getByText('FY Total')).toBeTruthy();
		expect(screen.getByText('Test Line')).toBeTruthy();
	});

	it('shows upstream stale banner with module links', () => {
		mockVersionsData = {
			data: [
				{
					id: 10,
					name: 'Budget v1',
					status: 'Draft',
					staleModules: ['REVENUE', 'STAFFING'],
				},
			],
		};
		mockPnlData = { lines: [createMockLine()] };

		render(<PnlPage />);

		expect(screen.getByText('Prerequisites outdated.')).toBeTruthy();
		expect(screen.getByText('revenue')).toBeTruthy();
		expect(screen.getByText('staffing')).toBeTruthy();
	});

	it('shows empty state when no P&L data exists', () => {
		mockPnlData = null;

		render(<PnlPage />);

		expect(screen.getByText('No P&L data yet')).toBeTruthy();
		expect(screen.getByText('Click Calculate to generate the P&L statement.')).toBeTruthy();
	});

	it('shows viewer empty state when user is Viewer', () => {
		mockUserRole = 'Viewer';
		mockPnlData = null;

		render(<PnlPage />);

		expect(screen.getByText('A Budget Owner or Editor must calculate the P&L first.')).toBeTruthy();
	});

	it('renders format toggle with Summary/Detailed/IFRS buttons', () => {
		render(<PnlPage />);

		expect(screen.getByText('Summary')).toBeTruthy();
		expect(screen.getByText('Detailed')).toBeTruthy();
		expect(screen.getByText('IFRS')).toBeTruthy();
	});

	it('displays negative values in parentheses in the grid', () => {
		mockPnlData = {
			lines: [
				{
					sectionKey: 'expenses',
					categoryKey: 'staff',
					lineItemKey: 'total',
					displayLabel: 'Staff Costs',
					depth: 2,
					displayOrder: 1,
					isSubtotal: false,
					isSeparator: false,
					monthlyAmounts: ['-500000.0000', ...Array.from({ length: 11 }, () => '0')],
					annualTotal: '-500000.0000',
				},
			],
		};

		render(<PnlPage />);

		const cells = screen.getAllByText(/\(.*500.*\)/);
		expect(cells.length).toBeGreaterThan(0);
	});

	it('hides Calculate button for Viewer role', () => {
		mockUserRole = 'Viewer';
		mockPnlData = { lines: [createMockLine()] };

		render(<PnlPage />);

		expect(screen.queryByText('Calculate')).toBeNull();
	});

	it('hides Calculate button when version is locked', () => {
		mockWorkspaceContext = { ...mockWorkspaceContext, versionStatus: 'Locked' };
		mockVersionsData = {
			data: [
				{
					id: 10,
					name: 'Budget v1',
					status: 'Locked',
					staleModules: [],
				},
			],
		};
		mockPnlData = { lines: [createMockLine()] };

		render(<PnlPage />);

		expect(screen.queryByText('Calculate')).toBeNull();
	});

	it('does not show stale banner when no upstream modules are stale', () => {
		mockPnlData = { lines: [createMockLine()] };

		render(<PnlPage />);

		expect(screen.queryByText('Prerequisites outdated.')).toBeNull();
	});

	it('renders status strip with calculated status', () => {
		mockPnlData = {
			lines: [createMockLine()],
			calculatedAt: '2026-03-25T10:00:00Z',
		};

		render(<PnlPage />);

		expect(screen.getByText('Last calculated:')).toBeTruthy();
	});
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function createMockLine() {
	return {
		sectionKey: 'revenue',
		categoryKey: 'tuition',
		lineItemKey: 'total',
		displayLabel: 'Test Line',
		depth: 2 as const,
		displayOrder: 1,
		isSubtotal: false,
		isSeparator: false,
		monthlyAmounts: Array.from({ length: 12 }, () => '100000.0000'),
		annualTotal: '1200000.0000',
	};
}
