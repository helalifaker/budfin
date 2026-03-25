import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { VersionsPage } from './versions';

let mockUserRole = 'Admin';

let mockVersionsData = {
	data: [
		{
			id: 1,
			name: 'Budget 2026',
			fiscalYear: 2026,
			type: 'Budget' as const,
			status: 'Draft' as const,
			dataSource: 'MANUAL' as const,
			staleModules: [] as string[],
			lastCalculatedAt: '2026-03-20T10:00:00Z',
			createdAt: '2026-01-15T08:00:00Z',
			createdByEmail: 'admin@efir.edu.sa',
		},
		{
			id: 2,
			name: 'Forecast Q2',
			fiscalYear: 2026,
			type: 'Forecast' as const,
			status: 'Published' as const,
			dataSource: 'CALCULATED' as const,
			staleModules: ['REVENUE'],
			lastCalculatedAt: '2026-03-18T10:00:00Z',
			createdAt: '2026-02-01T08:00:00Z',
			createdByEmail: 'budget@efir.edu.sa',
		},
	],
	isLoading: false,
};

vi.mock('../../stores/auth-store', () => ({
	useAuthStore: (selector: (state: { user: { role: string; id: number } }) => unknown) =>
		selector({ user: { role: mockUserRole, id: 1 } }),
}));

vi.mock('../../stores/version-page-store', () => ({
	useVersionPageStore: () => ({
		fiscalYear: null,
		setFiscalYear: vi.fn(),
		typeFilter: '',
		setTypeFilter: vi.fn(),
		statusFilter: '',
		setStatusFilter: vi.fn(),
		searchQuery: '',
		setSearchQuery: vi.fn(),
		isCompareMode: false,
		toggleCompareMode: vi.fn(),
		compareVersionIds: [],
		addCompareVersion: vi.fn(),
		removeCompareVersion: vi.fn(),
		clearCompareVersions: vi.fn(),
	}),
}));

vi.mock('../../hooks/use-versions', () => ({
	useVersions: () => ({
		data: mockVersionsData,
		isLoading: false,
	}),
}));

vi.mock('../../hooks/use-delayed-skeleton', () => ({
	useDelayedSkeleton: () => false,
}));

vi.mock('../../lib/format-date', () => ({
	formatDate: (iso: string) => iso,
	getCurrentFiscalYear: () => 2026,
}));

vi.mock('../../components/ui/button', () => ({
	Button: ({
		children,
		...props
	}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
		children: ReactNode;
		variant?: string;
		size?: string;
	}) => (
		<button type="button" {...props}>
			{children}
		</button>
	),
}));

vi.mock('../../components/ui/input', () => ({
	Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock('../../components/ui/select', () => ({
	Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	SelectTrigger: ({
		children,
		...props
	}: { children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) => (
		<div {...props}>{children}</div>
	),
	SelectValue: () => null,
	SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	SelectItem: ({ children }: { children: ReactNode; value: string }) => <div>{children}</div>,
}));

vi.mock('../../components/ui/checkbox', () => ({
	Checkbox: () => <input type="checkbox" />,
}));

vi.mock('../../components/ui/skeleton', () => ({
	TableSkeleton: () => null,
}));

vi.mock('../../components/ui/dropdown-menu', () => ({
	DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	DropdownMenuTrigger: ({ children }: { children: ReactNode; asChild?: boolean }) => (
		<div>{children}</div>
	),
	DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	DropdownMenuItem: ({
		children,
	}: {
		children: ReactNode;
		onSelect?: () => void;
		disabled?: boolean;
		destructive?: boolean;
	}) => <div>{children}</div>,
	DropdownMenuSeparator: () => <hr />,
}));

vi.mock('../../components/ui/toast-state', () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../components/versions/create-version-panel', () => ({
	CreateVersionPanel: () => <div data-testid="create-version-panel" />,
}));

vi.mock('../../components/versions/clone-version-dialog', () => ({
	CloneVersionDialog: () => <div data-testid="clone-version-dialog" />,
}));

vi.mock('../../components/versions/version-detail-panel', () => ({
	VersionDetailPanel: () => <div data-testid="version-detail-panel" />,
}));

vi.mock('../../components/versions/comparison-view', () => ({
	ComparisonView: () => <div data-testid="comparison-view" />,
}));

vi.mock('../../components/versions/lifecycle-dialogs', () => ({
	PublishDialog: () => <div data-testid="publish-dialog" />,
	LockDialog: () => <div data-testid="lock-dialog" />,
	ArchiveDialog: () => <div data-testid="archive-dialog" />,
	RevertDialog: () => <div data-testid="revert-dialog" />,
	DeleteDialog: () => <div data-testid="delete-dialog" />,
}));

describe('VersionsPage', () => {
	beforeEach(() => {
		mockUserRole = 'Admin';
		mockVersionsData = {
			data: [
				{
					id: 1,
					name: 'Budget 2026',
					fiscalYear: 2026,
					type: 'Budget',
					status: 'Draft',
					dataSource: 'MANUAL',
					staleModules: [],
					lastCalculatedAt: '2026-03-20T10:00:00Z',
					createdAt: '2026-01-15T08:00:00Z',
					createdByEmail: 'admin@efir.edu.sa',
				},
				{
					id: 2,
					name: 'Forecast Q2',
					fiscalYear: 2026,
					type: 'Forecast',
					status: 'Published',
					dataSource: 'CALCULATED',
					staleModules: ['REVENUE'],
					lastCalculatedAt: '2026-03-18T10:00:00Z',
					createdAt: '2026-02-01T08:00:00Z',
					createdByEmail: 'budget@efir.edu.sa',
				},
			],
			isLoading: false,
		};
	});

	afterEach(() => {
		cleanup();
	});

	it('renders page heading', () => {
		render(<VersionsPage />);
		expect(screen.getByText('Version Management')).toBeTruthy();
	});

	it('renders version list table with data', () => {
		render(<VersionsPage />);
		expect(screen.getByRole('table')).toBeTruthy();
		expect(screen.getByText('Budget 2026')).toBeTruthy();
		expect(screen.getByText('Forecast Q2')).toBeTruthy();
	});

	it('shows Add Version button for Admin', () => {
		render(<VersionsPage />);
		expect(screen.getByText('+ Add Version')).toBeTruthy();
	});

	it('shows Add Version button for BudgetOwner', () => {
		mockUserRole = 'BudgetOwner';
		render(<VersionsPage />);
		expect(screen.getByText('+ Add Version')).toBeTruthy();
	});

	it('hides Add Version button for Editor', () => {
		mockUserRole = 'Editor';
		render(<VersionsPage />);
		expect(screen.queryByText('+ Add Version')).toBeNull();
	});

	it('hides Add Version button for Viewer', () => {
		mockUserRole = 'Viewer';
		render(<VersionsPage />);
		expect(screen.queryByText('+ Add Version')).toBeNull();
	});

	it('renders version status badges', () => {
		render(<VersionsPage />);
		expect(screen.getByLabelText('Status: Draft')).toBeTruthy();
		expect(screen.getByLabelText('Status: Published')).toBeTruthy();
	});

	it('renders version type badges', () => {
		render(<VersionsPage />);
		expect(screen.getByLabelText('Type: Budget')).toBeTruthy();
		expect(screen.getByLabelText('Type: Forecast')).toBeTruthy();
	});

	it('renders stale module indicator for versions with stale modules', () => {
		render(<VersionsPage />);
		expect(screen.getByLabelText('Stale modules: REVENUE')).toBeTruthy();
	});

	it('renders Compare button', () => {
		render(<VersionsPage />);
		expect(screen.getByText('Compare')).toBeTruthy();
	});

	it('renders search input', () => {
		render(<VersionsPage />);
		expect(screen.getByLabelText('Search versions')).toBeTruthy();
	});

	it('renders filter controls', () => {
		render(<VersionsPage />);
		expect(screen.getByLabelText('Filter by fiscal year')).toBeTruthy();
		expect(screen.getByLabelText('Filter by type')).toBeTruthy();
		expect(screen.getByLabelText('Filter by status')).toBeTruthy();
	});

	it('renders table column headers', () => {
		render(<VersionsPage />);
		expect(screen.getByText('Name')).toBeTruthy();
		expect(screen.getByText('Fiscal Year')).toBeTruthy();
		expect(screen.getByText('Type')).toBeTruthy();
		expect(screen.getByText('Status')).toBeTruthy();
	});
});
