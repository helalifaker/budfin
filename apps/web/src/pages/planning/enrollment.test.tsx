import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { EnrollmentPage } from './enrollment';

const mockSetActivePage = vi.fn();
const mockClearSelection = vi.fn();
const mockNavigate = vi.fn();

const fullHeadcountData = {
	entries: [
		{
			gradeLevel: 'PS',
			academicPeriod: 'AY1',
			headcount: 90,
			gradeName: 'Petite Section',
			band: 'MATERNELLE',
			displayOrder: 1,
		},
		{
			gradeLevel: 'MS',
			academicPeriod: 'AY1',
			headcount: 100,
			gradeName: 'Moyenne Section',
			band: 'MATERNELLE',
			displayOrder: 2,
		},
		{
			gradeLevel: 'PS',
			academicPeriod: 'AY2',
			headcount: 92,
			gradeName: 'Petite Section',
			band: 'MATERNELLE',
			displayOrder: 1,
		},
	],
};

const filteredAy2HeadcountData = {
	entries: fullHeadcountData.entries.filter((entry) => entry.academicPeriod === 'AY2'),
};

// Mutable state holders so individual tests can override values without
// recreating the entire module mock (which would require vi.resetModules).
let mockWorkspaceContext = {
	versionId: 20,
	fiscalYear: 2026,
	academicPeriod: 'AY2' as const,
	versionStatus: 'Draft',
	versionName: 'v2',
	versionDataSource: 'MANUAL',
};

let mockUserRole = 'Admin';

let mockCohortParametersData = {
	entries: [
		{ gradeLevel: 'PS', isPersisted: true },
		{ gradeLevel: 'MS', isPersisted: true },
	] as Array<{ gradeLevel: string; isPersisted: boolean }>,
	planningRules: {
		rolloverThreshold: 1,
		cappedRetention: 0.98,
	},
};

let mockVersionsData = {
	data: [
		{
			id: 20,
			status: 'Draft',
			dataSource: 'MANUAL',
			staleModules: [] as string[],
			name: 'v2',
		},
	],
};

const mockEnrollmentSettingsData = {
	rules: {
		rolloverThreshold: 1,
		cappedRetention: 0.98,
		retentionRecentWeight: 0.6,
		historicalTargetRecentWeight: 0.8,
	},
	capacityByGrade: [
		{
			gradeLevel: 'PS',
			gradeName: 'Petite Section',
			band: 'MATERNELLE',
			displayOrder: 1,
			defaultAy2Intake: 66,
			maxClassSize: 25,
			plancherPct: 0.7,
			ciblePct: 0.8,
			plafondPct: 1,
			templateMaxClassSize: 25,
			templatePlancherPct: 0.7,
			templateCiblePct: 0.8,
			templatePlafondPct: 1,
		},
		{
			gradeLevel: 'MS',
			gradeName: 'Moyenne Section',
			band: 'MATERNELLE',
			displayOrder: 2,
			defaultAy2Intake: null,
			maxClassSize: 25,
			plancherPct: 0.7,
			ciblePct: 0.8,
			plafondPct: 1,
			templateMaxClassSize: 25,
			templatePlancherPct: 0.7,
			templateCiblePct: 0.8,
			templatePlafondPct: 1,
		},
	],
};

vi.mock('react-router', () => ({
	useNavigate: () => mockNavigate,
}));

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
	) => selector({ setActivePage: mockSetActivePage, isOpen: true }),
}));

vi.mock('../../stores/enrollment-selection-store', () => ({
	useEnrollmentSelectionStore: (
		selector: (state: { clearSelection: typeof mockClearSelection }) => unknown
	) => selector({ clearSelection: mockClearSelection }),
}));

vi.mock('../../hooks/use-enrollment', () => ({
	useHeadcount: (_versionId: number | null, academicPeriod?: 'AY1' | 'AY2' | 'SUMMER' | null) => ({
		data: academicPeriod ? filteredAy2HeadcountData : fullHeadcountData,
	}),
	usePutHeadcount: () => ({
		mutate: vi.fn(),
	}),
	useCalculateEnrollment: () => ({
		mutate: vi.fn(),
		isPending: false,
		isSuccess: false,
		isError: false,
	}),
	useEnrollmentCapacityResults: () => ({
		data: {
			results: [],
		},
	}),
	useHistorical: () => ({
		data: {
			data: [],
			cagrByBand: {},
			movingAvgByBand: {},
		},
	}),
	useEnrollmentSettings: () => ({
		data: mockEnrollmentSettingsData,
	}),
}));

vi.mock('../../hooks/use-capacity-config', () => ({
	useCapacityConfig: () => ({
		data: { configs: [] },
	}),
	usePutCapacityConfig: () => ({
		mutate: vi.fn(),
	}),
	useResetCapacityConfig: () => ({
		mutate: vi.fn(),
	}),
}));

vi.mock('../../hooks/use-versions', () => ({
	useVersions: () => ({
		data: mockVersionsData,
	}),
}));

vi.mock('../../hooks/use-grade-levels', () => ({
	useGradeLevels: () => ({
		data: {
			gradeLevels: [
				{
					gradeCode: 'PS',
					gradeName: 'Petite Section',
					band: 'MATERNELLE',
					displayOrder: 1,
					maxClassSize: 25,
					defaultAy2Intake: 66,
					plafondPct: '1',
				},
				{
					gradeCode: 'MS',
					gradeName: 'Moyenne Section',
					band: 'MATERNELLE',
					displayOrder: 2,
					maxClassSize: 25,
					defaultAy2Intake: null,
					plafondPct: '1',
				},
			],
		},
	}),
}));

vi.mock('../../hooks/use-cohort-parameters', () => ({
	useCohortParameters: () => ({
		data: mockCohortParametersData,
	}),
	usePutCohortParameters: () => ({
		mutate: vi.fn(),
	}),
}));

vi.mock('../../components/ui/button', () => ({
	Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
		<button type="button" {...props}>
			{children}
		</button>
	),
}));

vi.mock('../../components/ui/toggle-group', () => ({
	ToggleGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	ToggleGroupItem: ({ children }: { children: ReactNode }) => (
		<button type="button">{children}</button>
	),
}));

vi.mock('../../components/enrollment/kpi-ribbon', () => ({
	EnrollmentKpiRibbon: () => <div>KPI</div>,
}));

vi.mock('../../components/enrollment/calculate-button', () => ({
	CalculateButton: () => <button type="button">Calculate</button>,
}));

vi.mock('../../components/shared/page-transition', () => ({
	PageTransition: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('../../components/enrollment/version-lock-banner', () => ({
	VersionLockBanner: () => <div>Version lock banner</div>,
}));

vi.mock('../../components/enrollment/setup-wizard', () => ({
	EnrollmentSetupWizard: () => <div>Wizard</div>,
}));

vi.mock('../../components/enrollment/enrollment-settings-sheet', () => ({
	EnrollmentSettingsSheet: () => <div>Settings Sheet</div>,
}));

vi.mock('../../stores/enrollment-settings-store', () => ({
	useEnrollmentSettingsSheetStore: (
		selector: (state: {
			open: () => void;
			isOpen: boolean;
			setOpen: (open: boolean) => void;
		}) => unknown
	) =>
		selector({
			open: vi.fn(),
			isOpen: false,
			setOpen: vi.fn(),
		}),
}));

vi.mock('../../components/enrollment/enrollment-inspector', () => ({}));

describe('EnrollmentPage', () => {
	beforeEach(() => {
		mockSetActivePage.mockClear();
		mockClearSelection.mockClear();
		mockNavigate.mockClear();
		// Reset mutable mock state to defaults before each test
		mockWorkspaceContext = {
			versionId: 20,
			fiscalYear: 2026,
			academicPeriod: 'AY2',
			versionStatus: 'Draft',
			versionName: 'v2',
			versionDataSource: 'MANUAL',
		};
		mockUserRole = 'Admin';
		mockCohortParametersData = {
			entries: [
				{ gradeLevel: 'PS', isPersisted: true },
				{ gradeLevel: 'MS', isPersisted: true },
			],
			planningRules: {
				rolloverThreshold: 1,
				cappedRetention: 0.98,
			},
		};
		mockVersionsData = {
			data: [
				{
					id: 20,
					status: 'Draft',
					dataSource: 'MANUAL',
					staleModules: [],
					name: 'v2',
				},
			],
		};
	});

	afterEach(() => {
		cleanup();
	});

	it('treats setup as complete even when the current workspace period is AY2', () => {
		render(<EnrollmentPage />);

		expect(screen.getByRole('button', { name: 'Reopen Setup Wizard' })).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Enrollment Settings' })).toBeTruthy();
	});

	it('renders version-lock banner when versionStatus is Locked', () => {
		// A Locked status causes deriveEnrollmentEditability to return 'locked',
		// which in turn renders the VersionLockBanner component.
		mockWorkspaceContext = { ...mockWorkspaceContext, versionStatus: 'Locked' };
		mockVersionsData = {
			data: [{ id: 20, status: 'Locked', dataSource: 'MANUAL', staleModules: [], name: 'v2' }],
		};

		render(<EnrollmentPage />);

		expect(screen.getByText('Version lock banner')).toBeTruthy();
	});

	it('renders viewer banner when user role is Viewer', () => {
		// Viewer role causes deriveEnrollmentEditability to return 'viewer',
		// which renders the viewer-mode info banner.
		mockUserRole = 'Viewer';

		render(<EnrollmentPage />);

		expect(screen.getByText('Viewer access keeps this workspace in review mode.')).toBeTruthy();
	});

	it('shows wizard prompt when setup is incomplete', () => {
		// Mark MS cohort entry as not persisted — setup is now incomplete because
		// not every non-PS grade has a persisted cohort parameter.
		mockCohortParametersData = {
			...mockCohortParametersData,
			entries: [
				{ gradeLevel: 'PS', isPersisted: true },
				{ gradeLevel: 'MS', isPersisted: false },
			],
		};

		render(<EnrollmentPage />);

		// When setup is incomplete, the wizard button reads "Resume Setup Wizard"
		// rather than "Reopen Setup Wizard", confirming the component detects it.
		expect(screen.getByRole('button', { name: 'Resume Setup Wizard' })).toBeTruthy();
	});
});
