import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { OpExPage } from '../../components/opex/opex-page';

vi.mock('../../components/shared/export-dialog', () => ({
	ExportDialog: () => null,
}));

let mockWorkspaceContext = {
	versionId: 10 as number | null,
	fiscalYear: 2026,
	versionStatus: 'Draft' as string | null,
};

let mockUserRole = 'Admin';

const mockSetActivePage = vi.fn();
const mockSetOverlay = vi.fn();

let mockVersionsData = {
	data: [
		{
			id: 10,
			name: 'OpEx v1',
			status: 'Draft',
			dataSource: 'MANUAL',
			staleModules: [] as string[],
			lastCalculatedAt: '2026-03-20T10:00:00Z',
		},
	],
};

vi.mock('../../hooks/use-workspace-context', () => ({
	useWorkspaceContext: () => mockWorkspaceContext,
}));

vi.mock('../../stores/auth-store', () => ({
	useAuthStore: (selector: (state: { user: { role: string } }) => unknown) =>
		selector({ user: { role: mockUserRole } }),
}));

vi.mock('../../stores/right-panel-store', () => ({
	useRightPanelStore: (
		selector: (state: {
			setActivePage: typeof mockSetActivePage;
			setOverlay: typeof mockSetOverlay;
			isOpen: boolean;
		}) => unknown
	) => selector({ setActivePage: mockSetActivePage, setOverlay: mockSetOverlay, isOpen: false }),
}));

vi.mock('../../stores/opex-selection-store', () => ({
	useOpExSelectionStore: (
		selector: (state: { selection: null; clearSelection: () => void }) => unknown
	) => selector({ selection: null, clearSelection: vi.fn() }),
}));

vi.mock('../../stores/opex-dirty-store', () => ({
	useOpExDirtyStore: Object.assign(
		(selector?: (state: { dirtyMap: { size: number } }) => unknown) => {
			if (selector) return selector({ dirtyMap: { size: 0 } });
			return {
				setDirty: vi.fn(),
				getDirtyUpdates: vi.fn(() => []),
				flush: vi.fn(),
				dirtyCount: vi.fn(() => 0),
			};
		},
		{}
	),
}));

vi.mock('../../hooks/use-grid-undo-redo', () => ({
	useGridUndoRedo: () => ({
		push: vi.fn(),
		undo: vi.fn(),
		redo: vi.fn(),
		flush: vi.fn(),
		canUndo: false,
		canRedo: false,
		pendingCount: 0,
	}),
}));

vi.mock('../../hooks/use-versions', () => ({
	useVersions: () => ({
		data: mockVersionsData,
	}),
	usePatchVersion: () => ({
		mutateAsync: vi.fn(),
		isPending: false,
	}),
}));

vi.mock('../../hooks/use-opex', () => ({
	useOpExLineItems: () => ({
		data: {
			data: [
				{
					id: 1,
					sectionType: 'OPERATING',
					ifrsCategory: 'Office & Supplies',
					lineItemName: 'Office Supplies',
					displayOrder: 0,
					computeMethod: 'MANUAL',
					computeRate: null,
					budgetV6Total: null,
					fy2025Actual: null,
					fy2024Actual: null,
					comment: null,
					monthlyAmounts: [{ month: 1, amount: '10000.0000' }],
				},
				{
					id: 2,
					sectionType: 'NON_OPERATING',
					ifrsCategory: 'Depreciation',
					lineItemName: 'Depreciation',
					displayOrder: 0,
					computeMethod: 'MANUAL',
					computeRate: null,
					budgetV6Total: null,
					fy2025Actual: null,
					fy2024Actual: null,
					comment: null,
					monthlyAmounts: [{ month: 1, amount: '50000.0000' }],
				},
			],
			summary: {
				totalOperating: '120000.0000',
				totalDepreciation: '50000.0000',
				totalFinanceIncome: '5000.0000',
				totalFinanceCosts: '2000.0000',
				totalNonOperating: '53000.0000',
				monthlyOperatingTotals: [],
				monthlyNonOperatingTotals: [],
			},
		},
		isLoading: false,
	}),
	useUpdateOpExMonthly: () => ({
		mutate: vi.fn(),
		isPending: false,
	}),
	useCalculateOpEx: () => ({
		mutate: vi.fn(),
		isPending: false,
		isSuccess: false,
		isError: false,
	}),
	useBulkUpdateOpEx: () => ({
		mutate: vi.fn(),
		isPending: false,
	}),
	useUpdateOpExLineItem: () => ({
		mutate: vi.fn(),
		isPending: false,
	}),
	useReorderOpExLineItem: () => ({
		mutate: vi.fn(),
		isPending: false,
	}),
	useDeleteOpExLineItem: () => ({
		mutate: vi.fn(),
		isPending: false,
	}),
	useInitializeOpEx: () => ({
		mutate: vi.fn(),
		isPending: false,
	}),
}));

vi.mock('../../hooks/use-revenue', () => ({
	useRevenueResults: () => ({
		data: {
			totals: { totalOperatingRevenue: '500000.0000' },
		},
	}),
}));

vi.mock('../../lib/staffing-workspace', () => ({
	deriveStaffingEditability: ({
		role,
		versionStatus,
	}: {
		role: string | null;
		versionStatus: string | null;
	}) => {
		if (role === 'Viewer') return 'viewer';
		if (versionStatus === 'Locked' || versionStatus === 'Published') return 'locked';
		return 'editable';
	},
}));

vi.mock('../../components/ui/button', () => ({
	Button: ({
		children,
		...props
	}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
		children: ReactNode;
		loading?: boolean;
		variant?: string;
		size?: string;
	}) => (
		<button type="button" {...props}>
			{children}
		</button>
	),
}));

vi.mock('../../components/ui/tabs', () => ({
	Tabs: ({
		children,
	}: {
		children: ReactNode;
		value: string;
		onValueChange?: (v: string) => void;
	}) => <div data-testid="tabs-root">{children}</div>,
	TabsList: ({ children }: { children: ReactNode }) => <div role="tablist">{children}</div>,
	TabsTrigger: ({ children, value }: { children: ReactNode; value: string }) => (
		<button type="button" role="tab" data-value={value}>
			{children}
		</button>
	),
}));

vi.mock('../../components/shared/page-transition', () => ({
	PageTransition: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('../../components/shared/calculate-button', () => ({
	CalculateButton: ({
		onCalculate,
		isPending,
	}: {
		onCalculate: () => void;
		isPending: boolean;
		isSuccess: boolean;
		isError: boolean;
	}) => (
		<button type="button" onClick={onCalculate} disabled={isPending}>
			Calculate
		</button>
	),
}));

vi.mock('../../components/shared/empty-state', () => ({
	EmptyState: ({ title, description }: { icon: unknown; title: string; description: string }) => (
		<div data-testid="empty-state">
			<p>{title}</p>
			<p>{description}</p>
		</div>
	),
}));

vi.mock('../../components/shared/stale-pill', () => ({
	StalePill: ({ label }: { label: string }) => <span aria-label="Stale data">{label}</span>,
}));

vi.mock('../../components/opex/opex-kpi-ribbon', () => ({
	OpExKpiRibbon: () => <div data-testid="opex-kpi-ribbon">KPI Ribbon</div>,
}));

vi.mock('../../components/opex/opex-status-strip', () => ({
	OpExStatusStrip: () => <div data-testid="opex-status-strip">Status Strip</div>,
}));

vi.mock('../../components/opex/opex-grid', () => ({
	OpExGrid: ({ sectionType }: { sectionType: string }) => {
		const testId = sectionType === 'NON_OPERATING' ? 'non-operating-grid' : 'opex-grid';
		const label = sectionType === 'NON_OPERATING' ? 'Non-Operating Grid' : 'OpEx Grid';
		return <div data-testid={testId}>{label}</div>;
	},
}));

vi.mock('../../components/opex/opex-inspector', () => ({}));

vi.mock('../../components/opex/opex-settings-dialog', () => ({
	OpExSettingsDialog: () => null,
}));

vi.mock('../../components/opex/opex-initialize-dialog', () => ({
	OpExInitializeDialog: () => null,
}));

describe('OpExPage', () => {
	beforeEach(() => {
		mockWorkspaceContext = {
			versionId: 10,
			fiscalYear: 2026,
			versionStatus: 'Draft',
		};
		mockUserRole = 'Admin';
		mockVersionsData = {
			data: [
				{
					id: 10,
					name: 'OpEx v1',
					status: 'Draft',
					dataSource: 'MANUAL',
					staleModules: [],
					lastCalculatedAt: '2026-03-20T10:00:00Z',
				},
			],
		};
	});

	afterEach(() => {
		cleanup();
	});

	it('renders select-version message when no versionId', () => {
		mockWorkspaceContext = { ...mockWorkspaceContext, versionId: null };
		render(<OpExPage />);
		expect(screen.getByText('No version selected')).toBeTruthy();
	});

	it('renders OpEx grid with line items', () => {
		render(<OpExPage />);
		expect(screen.getByTestId('opex-grid')).toBeTruthy();
	});

	it('renders KPI ribbon', () => {
		render(<OpExPage />);
		expect(screen.getByTestId('opex-kpi-ribbon')).toBeTruthy();
	});

	it('renders status strip', () => {
		render(<OpExPage />);
		expect(screen.getByTestId('opex-status-strip')).toBeTruthy();
	});

	it('renders 2 tab triggers: Operating Expenses, Non-Operating Items', () => {
		render(<OpExPage />);
		const tabs = screen.getAllByRole('tab');
		expect(tabs.length).toBe(2);
		expect(screen.getByText('Operating Expenses')).toBeTruthy();
		expect(screen.getByText('Non-Operating Items')).toBeTruthy();
	});

	it('renders Calculate button when editable', () => {
		render(<OpExPage />);
		expect(screen.getByText('Calculate')).toBeTruthy();
	});

	it('hides Calculate button when viewer', () => {
		mockUserRole = 'Viewer';
		render(<OpExPage />);
		expect(screen.queryByText('Calculate')).toBeNull();
	});

	it('hides Calculate button when version is locked', () => {
		mockWorkspaceContext = { ...mockWorkspaceContext, versionStatus: 'Locked' };
		mockVersionsData = {
			data: [
				{
					id: 10,
					name: 'OpEx v1',
					status: 'Locked',
					dataSource: 'MANUAL',
					staleModules: [],
					lastCalculatedAt: '2026-03-20T10:00:00Z',
				},
			],
		};
		render(<OpExPage />);
		expect(screen.queryByText('Calculate')).toBeNull();
	});

	it('renders locked banner when version is locked', () => {
		mockWorkspaceContext = { ...mockWorkspaceContext, versionStatus: 'Locked' };
		mockVersionsData = {
			data: [
				{
					id: 10,
					name: 'OpEx v1',
					status: 'Locked',
					dataSource: 'MANUAL',
					staleModules: [],
					lastCalculatedAt: '2026-03-20T10:00:00Z',
				},
			],
		};
		render(<OpExPage />);
		expect(
			screen.getByText('This version is locked. Operating expenses data is read-only.')
		).toBeTruthy();
	});

	it('renders viewer banner when user role is Viewer', () => {
		mockUserRole = 'Viewer';
		render(<OpExPage />);
		expect(screen.getByText('You have view-only access.')).toBeTruthy();
	});

	it('shows stale indicator when OPEX module is stale', () => {
		mockVersionsData = {
			data: [
				{
					id: 10,
					name: 'OpEx v1',
					status: 'Draft',
					dataSource: 'MANUAL',
					staleModules: ['OPEX'],
					lastCalculatedAt: '2026-03-20T10:00:00Z',
				},
			],
		};
		render(<OpExPage />);
		expect(screen.getByLabelText('Stale data')).toBeTruthy();
	});

	it('renders uncalculated banner when version has no lastCalculatedAt and not stale', () => {
		mockVersionsData = {
			data: [
				{
					id: 10,
					name: 'OpEx v1',
					status: 'Draft',
					dataSource: 'MANUAL',
					staleModules: [],
					lastCalculatedAt: null as unknown as string,
				},
			],
		};
		render(<OpExPage />);
		expect(
			screen.getByText('Operating expenses have not been calculated. Click Calculate to generate.')
		).toBeTruthy();
	});
});
