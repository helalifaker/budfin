import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { StaffingPage } from './staffing';

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

vi.mock('../../stores/staffing-settings-store', () => ({
	useStaffingSettingsSheetStore: (
		selector: (state: {
			open: typeof mockOpenSettings;
			isOpen: boolean;
			setOpen: (open: boolean) => void;
		}) => unknown
	) =>
		selector({
			open: mockOpenSettings,
			isOpen: false,
			setOpen: vi.fn(),
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
}));

vi.mock('../../hooks/use-versions', () => ({
	useVersions: () => ({
		data: mockVersionsData,
	}),
}));

vi.mock('../../components/ui/button', () => ({
	Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
		<button type="button" {...props}>
			{children}
		</button>
	),
}));

// Mock ToggleGroup that calls onValueChange when a ToggleGroupItem is clicked
let capturedOnValueChange: ((value: string) => void) | undefined;

vi.mock('../../components/ui/toggle-group', () => ({
	ToggleGroup: ({
		children,
		'aria-label': ariaLabel,
		onValueChange,
	}: {
		children: ReactNode;
		'aria-label'?: string;
		onValueChange?: (value: string) => void;
	}) => {
		// Capture the first ToggleGroup's onValueChange (Workspace mode)
		if (ariaLabel === 'Workspace mode') {
			capturedOnValueChange = onValueChange;
		}
		return (
			<div role="group" aria-label={ariaLabel}>
				{children}
			</div>
		);
	},
	ToggleGroupItem: ({ children, value }: { children: ReactNode; value: string }) => (
		<button type="button" data-value={value} onClick={() => capturedOnValueChange?.(value)}>
			{children}
		</button>
	),
}));

vi.mock('../../components/ui/dropdown-menu', () => ({
	DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	DropdownMenuTrigger: ({ children }: { children: ReactNode; asChild?: boolean }) => (
		<div>{children}</div>
	),
	DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	DropdownMenuItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../components/shared/page-transition', () => ({
	PageTransition: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('../../components/staffing/teaching-master-grid', () => ({
	TeachingMasterGrid: () => <div data-testid="teaching-master-grid">Teaching Grid</div>,
}));

vi.mock('../../components/staffing/support-admin-grid', () => ({
	SupportAdminGrid: () => <div data-testid="support-admin-grid">Support Grid</div>,
}));

vi.mock('../../components/staffing/staffing-kpi-ribbon', () => ({
	StaffingKpiRibbonV2: () => <div data-testid="staffing-kpi-ribbon">KPI Ribbon</div>,
}));

vi.mock('../../components/staffing/staffing-status-strip', () => ({
	StaffingStatusStrip: () => <div data-testid="staffing-status-strip">Status Strip</div>,
}));

vi.mock('../../components/staffing/staffing-settings-sheet', () => ({
	StaffingSettingsSheet: () => <div data-testid="staffing-settings-sheet" />,
}));

vi.mock('../../components/staffing/staffing-inspector-content', () => ({}));
vi.mock('../../components/staffing/staffing-guide-content', () => ({}));

describe('StaffingPage', () => {
	beforeEach(() => {
		mockSetActivePage.mockClear();
		mockClearSelection.mockClear();
		mockOpenSettings.mockClear();
		capturedOnValueChange = undefined;
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

	it('renders grid zone with correct CSS structure', () => {
		const { container } = render(<StaffingPage />);
		const gridZone = container.querySelector('.flex-1.min-h-0.overflow-hidden.px-6.py-2');
		expect(gridZone).toBeTruthy();
		const scrollContainer = gridZone?.querySelector('.h-full.overflow-y-auto.scrollbar-thin');
		expect(scrollContainer).toBeTruthy();
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

	// AC-02: Toolbar
	it('renders workspace mode toggle with Teaching and Support & Admin options', () => {
		render(<StaffingPage />);
		expect(screen.getByText('Teaching')).toBeTruthy();
		expect(screen.getByText('Support & Admin')).toBeTruthy();
	});

	it('renders band filter in Teaching mode', () => {
		render(<StaffingPage />);
		expect(screen.getByRole('group', { name: 'Band filter' })).toBeTruthy();
	});

	it('renders view presets in Teaching mode', () => {
		render(<StaffingPage />);
		expect(screen.getByRole('group', { name: 'View preset' })).toBeTruthy();
		expect(screen.getByText('Need')).toBeTruthy();
		expect(screen.getByText('Coverage')).toBeTruthy();
		expect(screen.getByText('Cost')).toBeTruthy();
		expect(screen.getByText('Full View')).toBeTruthy();
	});

	it('renders coverage filter in Teaching mode with non-Need preset', () => {
		render(<StaffingPage />);
		// Default viewPreset is 'Full View', so coverage filter should be visible.
		// 'All Coverage' appears both in trigger button and menu item, so use getAllByText.
		const allCoverageElements = screen.getAllByText('All Coverage');
		expect(allCoverageElements.length).toBeGreaterThanOrEqual(1);
	});

	it('renders Settings button always', () => {
		render(<StaffingPage />);
		expect(screen.getByText('Settings')).toBeTruthy();
	});

	it('renders Calculate, Import, Add Employee buttons when editable', () => {
		render(<StaffingPage />);
		expect(screen.getByText('Calculate')).toBeTruthy();
		expect(screen.getByText('Import')).toBeTruthy();
		expect(screen.getByText('Add Employee')).toBeTruthy();
	});

	it('renders Auto-Suggest in Teaching mode when editable', () => {
		render(<StaffingPage />);
		expect(screen.getByText('Auto-Suggest')).toBeTruthy();
	});

	it('hides Calculate, Import, Add Employee, Auto-Suggest when viewer', () => {
		mockUserRole = 'Viewer';
		render(<StaffingPage />);
		expect(screen.queryByText('Calculate')).toBeNull();
		expect(screen.queryByText('Import')).toBeNull();
		expect(screen.queryByText('Add Employee')).toBeNull();
		expect(screen.queryByText('Auto-Suggest')).toBeNull();
	});

	it('hides editable buttons when version is locked', () => {
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
		expect(screen.queryByText('Import')).toBeNull();
		expect(screen.queryByText('Add Employee')).toBeNull();
		expect(screen.queryByText('Auto-Suggest')).toBeNull();
	});

	it('hides band filter, coverage filter, and view presets in Support mode', () => {
		render(<StaffingPage />);
		// Default is Teaching mode — verify they exist first
		expect(screen.getByRole('group', { name: 'Band filter' })).toBeTruthy();

		// Switch to Support mode by clicking the Support & Admin button
		const supportButton = screen.getByText('Support & Admin');
		fireEvent.click(supportButton);

		// After switching, band filter should not be in the DOM
		expect(screen.queryByRole('group', { name: 'Band filter' })).toBeNull();
		expect(screen.queryByRole('group', { name: 'View preset' })).toBeNull();
	});

	it('hides Auto-Suggest in Support mode even when editable', () => {
		render(<StaffingPage />);
		expect(screen.getByText('Auto-Suggest')).toBeTruthy();

		// Switch to Support mode
		const supportButton = screen.getByText('Support & Admin');
		fireEvent.click(supportButton);

		expect(screen.queryByText('Auto-Suggest')).toBeNull();
	});

	it('renders teaching grid in teaching mode', () => {
		render(<StaffingPage />);
		expect(screen.getByTestId('teaching-master-grid')).toBeTruthy();
	});

	it('renders support grid in support mode', () => {
		render(<StaffingPage />);
		const supportButton = screen.getByText('Support & Admin');
		fireEvent.click(supportButton);
		expect(screen.getByTestId('support-admin-grid')).toBeTruthy();
	});

	it('Settings button is visible even when viewer', () => {
		mockUserRole = 'Viewer';
		render(<StaffingPage />);
		expect(screen.getByText('Settings')).toBeTruthy();
	});
});
