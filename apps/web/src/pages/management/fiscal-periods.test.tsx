import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { FiscalPeriodsPage } from './fiscal-periods';

let mockUserRole = 'Admin';

const mockFiscalPeriodsData = [
	{
		id: 1,
		fiscalYear: 2026,
		month: 1,
		status: 'Locked',
		actualVersionId: 5,
		lockedAt: '2026-02-01T08:00:00Z',
		lockedById: 1,
	},
	{
		id: 2,
		fiscalYear: 2026,
		month: 2,
		status: 'Draft',
		actualVersionId: null,
		lockedAt: null,
		lockedById: null,
	},
	{
		id: 3,
		fiscalYear: 2026,
		month: 3,
		status: 'Draft',
		actualVersionId: null,
		lockedAt: null,
		lockedById: null,
	},
];

vi.mock('../../stores/auth-store', () => ({
	useAuthStore: (selector: (state: { user: { role: string } }) => unknown) =>
		selector({ user: { role: mockUserRole } }),
}));

vi.mock('../../hooks/use-fiscal-periods', () => ({
	useFiscalPeriods: () => ({
		data: mockFiscalPeriodsData,
		isLoading: false,
	}),
	useLockFiscalPeriod: () => ({
		mutate: vi.fn(),
		isPending: false,
	}),
}));

vi.mock('../../hooks/use-versions', () => ({
	useVersions: () => ({
		data: {
			data: [
				{
					id: 5,
					name: 'Actual Jan',
					fiscalYear: 2026,
					type: 'Actual',
					status: 'Locked',
				},
			],
		},
	}),
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
		loading?: boolean;
	}) => (
		<button type="button" {...props}>
			{children}
		</button>
	),
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

vi.mock('../../components/ui/skeleton', () => ({
	TableSkeleton: () => null,
}));

vi.mock('../../components/ui/toast-state', () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

describe('FiscalPeriodsPage', () => {
	beforeEach(() => {
		mockUserRole = 'Admin';
	});

	afterEach(() => {
		cleanup();
	});

	it('renders page heading', () => {
		render(<FiscalPeriodsPage />);
		expect(screen.getByText('Fiscal Period Management')).toBeTruthy();
	});

	it('renders fiscal period table', () => {
		render(<FiscalPeriodsPage />);
		expect(screen.getByRole('table')).toBeTruthy();
	});

	it('renders month names in the table', () => {
		render(<FiscalPeriodsPage />);
		expect(screen.getByText('January')).toBeTruthy();
		expect(screen.getByText('February')).toBeTruthy();
		expect(screen.getByText('March')).toBeTruthy();
	});

	it('renders status badges', () => {
		render(<FiscalPeriodsPage />);
		expect(screen.getByLabelText('Status: Locked')).toBeTruthy();
		const draftBadges = screen.getAllByLabelText('Status: Draft');
		expect(draftBadges.length).toBe(2);
	});

	it('renders fiscal year selector', () => {
		render(<FiscalPeriodsPage />);
		expect(screen.getByLabelText('Filter by fiscal year')).toBeTruthy();
	});

	it('renders table column headers', () => {
		render(<FiscalPeriodsPage />);
		expect(screen.getByText('Month')).toBeTruthy();
		expect(screen.getByText('Status')).toBeTruthy();
		expect(screen.getByText('Actual Version')).toBeTruthy();
		expect(screen.getByText('Locked At')).toBeTruthy();
		expect(screen.getByText('Locked By')).toBeTruthy();
	});

	it('renders Actions column for Admin', () => {
		render(<FiscalPeriodsPage />);
		expect(screen.getByText('Actions')).toBeTruthy();
	});

	it('renders Actions column for BudgetOwner', () => {
		mockUserRole = 'BudgetOwner';
		render(<FiscalPeriodsPage />);
		expect(screen.getByText('Actions')).toBeTruthy();
	});

	it('hides Actions column for Editor', () => {
		mockUserRole = 'Editor';
		render(<FiscalPeriodsPage />);
		expect(screen.queryByText('Actions')).toBeNull();
	});

	it('renders lock action for Draft periods', () => {
		render(<FiscalPeriodsPage />);
		const lockButtons = screen.getAllByText('Lock Period');
		expect(lockButtons.length).toBe(2);
	});

	it('renders actual version reference for locked periods', () => {
		render(<FiscalPeriodsPage />);
		const versionRefs = screen.getAllByText('Actual Jan (#5)');
		expect(versionRefs.length).toBeGreaterThanOrEqual(1);
	});
});
