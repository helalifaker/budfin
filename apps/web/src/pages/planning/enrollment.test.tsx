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

vi.mock('react-router', () => ({
	useNavigate: () => mockNavigate,
}));

vi.mock('../../hooks/use-workspace-context', () => ({
	useWorkspaceContext: () => ({
		versionId: 20,
		fiscalYear: 2026,
		academicPeriod: 'AY2',
		versionStatus: 'Draft',
		versionName: 'v2',
		versionDataSource: 'MANUAL',
	}),
}));

vi.mock('../../stores/auth-store', () => ({
	useAuthStore: (selector: (state: { user: { role: string } }) => unknown) =>
		selector({ user: { role: 'Admin' } }),
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
}));

vi.mock('../../hooks/use-versions', () => ({
	useVersions: () => ({
		data: {
			data: [
				{
					id: 20,
					status: 'Draft',
					dataSource: 'MANUAL',
					staleModules: [],
					name: 'v2',
				},
			],
		},
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
					plafondPct: '1',
				},
				{
					gradeCode: 'MS',
					gradeName: 'Moyenne Section',
					band: 'MATERNELLE',
					displayOrder: 2,
					maxClassSize: 25,
					plafondPct: '1',
				},
			],
		},
	}),
}));

vi.mock('../../hooks/use-cohort-parameters', () => ({
	useCohortParameters: () => ({
		data: {
			entries: [
				{ gradeLevel: 'PS', isPersisted: true },
				{ gradeLevel: 'MS', isPersisted: true },
			],
		},
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

vi.mock('../../components/shared/workspace-board', () => ({
	WorkspaceBoard: ({
		title,
		actions,
		children,
	}: {
		title: string;
		actions: ReactNode;
		children: ReactNode;
	}) => (
		<section>
			<h1>{title}</h1>
			<div>{actions}</div>
			<div>{children}</div>
		</section>
	),
}));

vi.mock('../../components/shared/workspace-block', () => ({
	WorkspaceBlock: ({ title, children }: { title: string; children: ReactNode }) => (
		<section>
			<h2>{title}</h2>
			{children}
		</section>
	),
}));

vi.mock('../../components/enrollment/kpi-ribbon', () => ({
	EnrollmentKpiRibbon: () => <div>KPI</div>,
}));

vi.mock('../../components/enrollment/cohort-progression-grid', () => ({
	CohortProgressionGrid: () => <div>Cohort grid</div>,
}));

vi.mock('../../components/enrollment/nationality-distribution-grid', () => ({
	NationalityDistributionGrid: () => <div>Nationality grid</div>,
}));

vi.mock('../../components/enrollment/capacity-grid', () => ({
	CapacityGrid: () => <div>Capacity grid</div>,
}));

vi.mock('../../components/enrollment/historical-chart', () => ({
	HistoricalChart: () => <div>History</div>,
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

vi.mock('../../components/enrollment/enrollment-inspector', () => ({}));

describe('EnrollmentPage', () => {
	beforeEach(() => {
		mockSetActivePage.mockClear();
		mockClearSelection.mockClear();
		mockNavigate.mockClear();
	});

	afterEach(() => {
		cleanup();
	});

	it('treats setup as complete even when the current workspace period is AY2', () => {
		render(<EnrollmentPage />);

		expect(screen.getByRole('button', { name: 'Reopen Setup Wizard' })).toBeTruthy();
	});
});
