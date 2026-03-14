import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { RevenuePage } from './revenue';

const { mockSetActivePage, mockClearSelection, mockPanelClose } = vi.hoisted(() => ({
	mockSetActivePage: vi.fn(),
	mockClearSelection: vi.fn(),
	mockPanelClose: vi.fn(),
}));

type MockWorkspaceContext = {
	versionId: number | null;
	fiscalYear: number;
	academicPeriod: string;
	versionStatus: string | null;
	versionName: string | null;
	setAcademicPeriod: ReturnType<typeof vi.fn>;
};

type MockVersionSummary = {
	id: number;
	name: string;
	status: string;
	dataSource: string;
	staleModules: string[];
	lastCalculatedAt: string | null;
};

let mockWorkspaceContext: MockWorkspaceContext = {
	versionId: 16,
	fiscalYear: 2026,
	academicPeriod: 'both',
	versionStatus: 'Draft',
	versionName: 'Revenue v3',
	setAcademicPeriod: vi.fn(),
};
let mockUserRole = 'Admin';
let mockVersionsData: { data: MockVersionSummary[] } = {
	data: [
		{
			id: 16,
			name: 'Revenue v3',
			status: 'Draft',
			dataSource: 'MANUAL',
			staleModules: ['STAFFING'],
			lastCalculatedAt: '2026-03-14T09:30:00.000Z',
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

vi.mock('../../stores/right-panel-store', () => {
	const storeState = {
		setActivePage: mockSetActivePage,
		isOpen: false,
		close: mockPanelClose,
	};
	const hook = (selector: (state: typeof storeState) => unknown) => selector(storeState);
	hook.getState = () => storeState;
	return { useRightPanelStore: hook };
});

vi.mock('../../stores/revenue-selection-store', () => ({
	useRevenueSelectionStore: (
		selector: (state: { clearSelection: typeof mockClearSelection }) => unknown
	) => selector({ clearSelection: mockClearSelection }),
}));

vi.mock('../../hooks/use-versions', () => ({
	useVersions: () => ({
		data: mockVersionsData,
	}),
}));

vi.mock('../../hooks/use-revenue', () => ({
	useRevenueResults: () => ({
		data: {
			totals: {
				grossRevenueHt: '58972254.0000',
				discountAmount: '2333713.0000',
				netRevenueHt: '56638541.0000',
				otherRevenueAmount: '11517700.0000',
				totalOperatingRevenue: '68156191.0000',
			},
			executiveSummary: {
				rows: [],
			},
		},
	}),
	useRevenueReadiness: () => ({
		data: {
			feeGrid: { total: 90, complete: 90, ready: true },
			tariffAssignment: { reconciled: true, ready: true },
			discounts: { rpRate: '0.250000', r3Rate: '0.100000', ready: true },
			derivedRevenueSettings: { exists: true, ready: true },
			otherRevenue: { total: 20, configured: 20, ready: true },
			overallReady: true,
			readyCount: 5,
			totalCount: 5,
		},
	}),
	useCalculateRevenue: () => ({
		mutate: vi.fn(),
		isPending: false,
	}),
}));

vi.mock('../../hooks/use-enrollment', () => ({
	useHeadcount: () => ({
		data: {
			entries: [{ academicPeriod: 'AY1', headcount: 1619 }],
		},
	}),
}));

vi.mock('../../hooks/use-grade-levels', () => ({
	useGradeLevels: () => ({
		data: { gradeLevels: [] },
	}),
}));

vi.mock('../../components/ui/button', () => ({
	Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
		<button type="button" {...props}>
			{children}
		</button>
	),
}));

vi.mock('../../components/ui/toggle-group', () => ({
	ToggleGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	ToggleGroupItem: ({ children }: { children: React.ReactNode }) => (
		<button type="button">{children}</button>
	),
}));

vi.mock('../../components/shared/page-transition', () => ({
	PageTransition: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../components/enrollment/version-lock-banner', () => ({
	VersionLockBanner: () => <div>Version lock banner</div>,
}));

vi.mock('../../components/revenue/forecast-grid', () => ({
	ForecastGrid: () => <div>Forecast Grid</div>,
}));

vi.mock('../../components/revenue/revenue-export-button', () => ({
	RevenueExportButton: () => <button type="button">Export</button>,
}));

vi.mock('../../components/revenue/kpi-ribbon', () => ({
	RevenueKpiRibbon: () => <div>KPI Ribbon</div>,
}));

vi.mock('../../components/revenue/revenue-status-strip', () => ({
	RevenueStatusStrip: () => <div>Status Strip</div>,
}));

vi.mock('../../components/revenue/setup-checklist', () => ({
	RevenueSetupChecklist: ({ forceOpen }: { forceOpen?: boolean }) =>
		forceOpen ? <div>Setup Checklist</div> : null,
}));

vi.mock('../../components/revenue/revenue-settings-dialog', () => ({
	RevenueSettingsDialog: () => <div>Settings Dialog</div>,
}));

vi.mock('../../components/revenue/revenue-inspector', () => ({}));

describe('RevenuePage', () => {
	beforeEach(() => {
		mockSetActivePage.mockClear();
		mockClearSelection.mockClear();
		mockPanelClose.mockClear();
		mockWorkspaceContext = {
			versionId: 16,
			fiscalYear: 2026,
			academicPeriod: 'both',
			versionStatus: 'Draft',
			versionName: 'Revenue v3',
			setAcademicPeriod: vi.fn(),
		};
		mockUserRole = 'Admin';
		mockVersionsData = {
			data: [
				{
					id: 16,
					name: 'Revenue v3',
					status: 'Draft',
					dataSource: 'MANUAL',
					staleModules: ['STAFFING'],
					lastCalculatedAt: '2026-03-14T09:30:00.000Z',
				},
			],
		};
	});

	afterEach(() => {
		cleanup();
	});

	it('renders the workspace composition and toolbar actions', () => {
		render(<RevenuePage />);

		expect(screen.getByText('KPI Ribbon')).toBeDefined();
		expect(screen.getByText('Status Strip')).toBeDefined();
		expect(screen.getByText('Forecast Grid')).toBeDefined();
		expect(screen.getByRole('button', { name: 'Revenue Settings' })).toBeDefined();
		expect(screen.getByRole('button', { name: 'Setup' })).toBeDefined();
		expect(screen.getByRole('button', { name: 'Calculate Revenue' })).toBeDefined();
		expect(mockSetActivePage).toHaveBeenCalledWith('revenue');
	});

	it('shows the empty-state message when no version is selected', () => {
		mockWorkspaceContext = {
			...mockWorkspaceContext,
			versionId: null,
		};

		render(<RevenuePage />);

		expect(
			screen.getByText('Select a version from the context bar to begin revenue planning.')
		).toBeDefined();
	});

	it('renders imported and viewer banners and hides calculate for viewers', () => {
		mockUserRole = 'Viewer';
		mockVersionsData = {
			data: [
				{
					id: 16,
					name: 'Revenue v3',
					status: 'Published',
					dataSource: 'IMPORTED',
					staleModules: [],
					lastCalculatedAt: null,
				},
			],
		};
		mockWorkspaceContext = {
			...mockWorkspaceContext,
			versionStatus: 'Published',
		};

		render(<RevenuePage />);

		expect(screen.getByText('Version lock banner')).toBeDefined();
		expect(screen.getByText(/This version was imported/)).toBeDefined();
		expect(screen.getByText(/Viewer access keeps this workspace/)).toBeDefined();
		expect(screen.getByRole('button', { name: 'View Settings' })).toBeDefined();
		expect(screen.queryByRole('button', { name: 'Calculate Revenue' })).toBeNull();
	});
});
