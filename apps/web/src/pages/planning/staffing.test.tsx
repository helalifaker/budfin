import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { StaffingPage } from './staffing';

vi.mock('../../components/shared/export-dialog', () => ({
	ExportDialog: () => null,
}));

const mockSetActivePage = vi.fn();
const mockClearSelection = vi.fn();
const mockOpenSettings = vi.fn();

let mockWorkspaceContext = {
	versionId: 20 as number | null,
	fiscalYear: 2026,
	versionStatus: 'Draft',
	versionName: 'v2',
	versionDataSource: 'MANUAL',
};

let mockUserRole = 'Admin';

let mockVersionsData = {
	data: [
		{
			id: 20,
			status: 'Draft',
			dataSource: 'MANUAL',
			staleModules: [] as string[],
			name: 'v2',
			lastCalculatedAt: '2026-03-17T10:00:00Z',
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
		selector: (state: { setActivePage: typeof mockSetActivePage; isOpen: boolean }) => unknown
	) => selector({ setActivePage: mockSetActivePage, isOpen: false }),
}));

vi.mock('../../stores/staffing-selection-store', () => ({
	useStaffingSelectionStore: (
		selector: (state: {
			clearSelection: typeof mockClearSelection;
			selection: null;
			selectSupportEmployee: (id: number, department: string) => void;
		}) => unknown
	) =>
		selector({
			clearSelection: mockClearSelection,
			selection: null,
			selectSupportEmployee: vi.fn(),
		}),
}));

vi.mock('../../stores/staffing-settings-dialog-store', () => ({
	useStaffingSettingsDialogStore: (
		selector: (state: {
			open: typeof mockOpenSettings;
			isOpen: boolean;
			activeTab: string;
		}) => unknown
	) =>
		selector({
			open: mockOpenSettings,
			isOpen: false,
			activeTab: 'profiles',
		}),
}));

vi.mock('../../hooks/use-staffing', () => ({
	useCalculateStaffing: () => ({
		mutate: vi.fn(),
		isPending: false,
		isSuccess: false,
		isError: false,
	}),
	useTeachingRequirements: () => ({
		data: {
			lines: [],
			totals: {
				totalFteRaw: '0',
				totalFteCovered: '0',
				totalFteGap: '0',
				totalDirectCost: '0',
				totalHsaCost: '0',
				lineCount: 0,
			},
			warnings: [],
		},
	}),
	useEmployees: () => ({
		data: { data: [], total: 0 },
	}),
	useStaffingSummary: () => ({
		data: null,
	}),
	useStaffingAssignments: () => ({
		data: { data: [] },
	}),
	useCategoryCosts: () => ({
		data: null,
	}),
}));

vi.mock('../../hooks/use-versions', () => ({
	useVersions: () => ({
		data: mockVersionsData,
	}),
}));

vi.mock('../../components/ui/button', () => ({
	Button: ({
		children,
		...props
	}: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) => (
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

vi.mock('../../components/staffing/staffing-kpi-ribbon', () => ({
	StaffingKpiRibbonV2: () => <div data-testid="staffing-kpi-ribbon">KPI Ribbon</div>,
}));

vi.mock('../../components/staffing/staffing-status-strip', () => ({
	StaffingStatusStrip: () => <div data-testid="staffing-status-strip">Status Strip</div>,
}));

vi.mock('../../components/staffing/staffing-settings-dialog', () => ({
	StaffingSettingsDialog: () => <div data-testid="staffing-settings-dialog" />,
}));

vi.mock('../../components/staffing/staffing-export-button', () => ({
	StaffingExportButton: () => <div data-testid="staffing-export-button" />,
}));

vi.mock('../../components/staffing/demand-tab-content', () => ({
	DemandTabContent: () => <div data-testid="demand-tab-content">Demand Content</div>,
}));

vi.mock('../../components/staffing/roster-tab-content', () => ({
	RosterTabContent: () => <div data-testid="roster-tab-content">Roster Content</div>,
}));

vi.mock('../../components/staffing/coverage-tab-content', () => ({
	CoverageTabContent: () => <div data-testid="coverage-tab-content">Coverage Content</div>,
}));

vi.mock('../../components/staffing/costs-tab-content', () => ({
	CostsTabContent: () => <div data-testid="costs-tab-content">Costs Content</div>,
}));

vi.mock('../../components/staffing/staffing-inspector-content', () => ({}));
vi.mock('../../components/staffing/staffing-guide-content', () => ({}));

describe('StaffingPage', () => {
	beforeEach(() => {
		mockSetActivePage.mockClear();
		mockClearSelection.mockClear();
		mockOpenSettings.mockClear();
		mockWorkspaceContext = {
			versionId: 20,
			fiscalYear: 2026,
			versionStatus: 'Draft',
			versionName: 'v2',
			versionDataSource: 'MANUAL',
		};
		mockUserRole = 'Admin';
		mockVersionsData = {
			data: [
				{
					id: 20,
					status: 'Draft',
					dataSource: 'MANUAL',
					staleModules: [],
					name: 'v2',
					lastCalculatedAt: '2026-03-17T10:00:00Z',
				},
			],
		};
	});

	afterEach(() => {
		cleanup();
	});

	// AC-01: Page layout
	it('renders select-version message when no versionId', () => {
		mockWorkspaceContext = { ...mockWorkspaceContext, versionId: null };
		render(<StaffingPage />);
		expect(
			screen.getByText('Select a version from the context bar to begin staffing planning.')
		).toBeTruthy();
	});

	it('renders the fixed-viewport layout container', () => {
		const { container } = render(<StaffingPage />);
		const layoutDiv = container.querySelector('.flex.h-full.min-h-0.flex-col.overflow-hidden');
		expect(layoutDiv).toBeTruthy();
	});

	it('renders locked banner when version is locked', () => {
		mockWorkspaceContext = { ...mockWorkspaceContext, versionStatus: 'Locked' };
		mockVersionsData = {
			data: [
				{
					id: 20,
					status: 'Locked',
					dataSource: 'MANUAL',
					staleModules: [],
					name: 'v2',
					lastCalculatedAt: '2026-03-17T10:00:00Z',
				},
			],
		};
		render(<StaffingPage />);
		expect(screen.getByText('This version is locked. Staffing data is read-only.')).toBeTruthy();
	});

	it('renders viewer banner when user role is Viewer', () => {
		mockUserRole = 'Viewer';
		render(<StaffingPage />);
		expect(screen.getByText('You have view-only access.')).toBeTruthy();
	});

	it('renders uncalculated banner when version has no lastCalculatedAt', () => {
		mockVersionsData = {
			data: [
				{
					id: 20,
					status: 'Draft',
					dataSource: 'MANUAL',
					staleModules: [],
					name: 'v2',
					lastCalculatedAt: null as unknown as string,
				},
			],
		};
		render(<StaffingPage />);
		expect(
			screen.getByText('Staffing has not been calculated. Click Calculate to generate.')
		).toBeTruthy();
	});

	// AC-02: 4-tab navigation
	it('renders 4 tab triggers: Demand, Roster, Coverage, Costs', () => {
		render(<StaffingPage />);
		const tabs = screen.getAllByRole('tab');
		expect(tabs.length).toBe(4);
		expect(screen.getByText('Demand')).toBeTruthy();
		expect(screen.getByText('Roster')).toBeTruthy();
		expect(screen.getByText('Coverage')).toBeTruthy();
		expect(screen.getByText('Costs')).toBeTruthy();
	});

	// AC-03: Demand tab renders by default
	it('renders Demand tab content by default', () => {
		render(<StaffingPage />);
		expect(screen.getByTestId('demand-tab-content')).toBeTruthy();
	});

	// AC-04: Toolbar buttons
	it('renders Settings button always', () => {
		render(<StaffingPage />);
		expect(screen.getByText('Settings')).toBeTruthy();
	});

	it('renders Calculate button when editable', () => {
		render(<StaffingPage />);
		expect(screen.getByText('Calculate')).toBeTruthy();
	});

	it('hides Calculate when viewer', () => {
		mockUserRole = 'Viewer';
		render(<StaffingPage />);
		expect(screen.queryByText('Calculate')).toBeNull();
	});

	it('hides Calculate when version is locked', () => {
		mockWorkspaceContext = { ...mockWorkspaceContext, versionStatus: 'Locked' };
		mockVersionsData = {
			data: [
				{
					id: 20,
					status: 'Locked',
					dataSource: 'MANUAL',
					staleModules: [],
					name: 'v2',
					lastCalculatedAt: '2026-03-17T10:00:00Z',
				},
			],
		};
		render(<StaffingPage />);
		expect(screen.queryByText('Calculate')).toBeNull();
	});

	it('shows View Settings label when viewer', () => {
		mockUserRole = 'Viewer';
		render(<StaffingPage />);
		expect(screen.getByText('View Settings')).toBeTruthy();
	});

	// AC-05: Shared components
	it('renders KPI ribbon', () => {
		render(<StaffingPage />);
		expect(screen.getByTestId('staffing-kpi-ribbon')).toBeTruthy();
	});

	it('renders status strip', () => {
		render(<StaffingPage />);
		expect(screen.getByTestId('staffing-status-strip')).toBeTruthy();
	});

	it('renders settings dialog', () => {
		render(<StaffingPage />);
		expect(screen.getByTestId('staffing-settings-dialog')).toBeTruthy();
	});

	it('renders export button', () => {
		render(<StaffingPage />);
		expect(screen.getByTestId('staffing-export-button')).toBeTruthy();
	});
});
