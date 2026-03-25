import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AccountsPage } from './accounts';

let mockUserRole = 'Admin';

const mockAccountsData = {
	accounts: [
		{
			id: 1,
			accountCode: 'REV-001',
			accountName: 'Tuition Revenue',
			type: 'REVENUE' as const,
			ifrsCategory: 'Revenue from contracts',
			centerType: 'PROFIT_CENTER' as const,
			status: 'ACTIVE' as const,
			description: null,
			version: 1,
		},
		{
			id: 2,
			accountCode: 'EXP-001',
			accountName: 'Staff Salaries',
			type: 'EXPENSE' as const,
			ifrsCategory: 'Employee benefits',
			centerType: 'COST_CENTER' as const,
			status: 'ACTIVE' as const,
			description: null,
			version: 1,
		},
	],
};

vi.mock('../../stores/auth-store', () => ({
	useAuthStore: (selector: (state: { user: { role: string } }) => unknown) =>
		selector({ user: { role: mockUserRole } }),
}));

vi.mock('../../hooks/use-accounts', () => ({
	useAccounts: () => ({
		data: mockAccountsData,
		isLoading: false,
	}),
	useCreateAccount: () => ({
		mutate: vi.fn(),
		isPending: false,
	}),
	useUpdateAccount: () => ({
		mutate: vi.fn(),
		isPending: false,
	}),
	useDeleteAccount: () => ({
		mutate: vi.fn(),
		isPending: false,
	}),
}));

vi.mock('../../hooks/use-delayed-skeleton', () => ({
	useDelayedSkeleton: () => false,
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

vi.mock('../../components/ui/alert-dialog', () => ({
	AlertDialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	AlertDialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	AlertDialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	AlertDialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	AlertDialogDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	AlertDialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	AlertDialogAction: ({ children }: { children: ReactNode }) => (
		<button type="button">{children}</button>
	),
	AlertDialogCancel: ({ children }: { children: ReactNode }) => (
		<button type="button">{children}</button>
	),
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
		destructive?: boolean;
	}) => <div>{children}</div>,
	DropdownMenuSeparator: () => <hr />,
}));

vi.mock('../../components/ui/skeleton', () => ({
	TableSkeleton: () => null,
}));

vi.mock('../../components/ui/toast-state', () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../components/master-data/accounts-side-panel', () => ({
	AccountsSidePanel: () => <div data-testid="accounts-side-panel" />,
}));

describe('AccountsPage', () => {
	beforeEach(() => {
		mockUserRole = 'Admin';
	});

	afterEach(() => {
		cleanup();
	});

	it('renders page heading', () => {
		render(<AccountsPage />);
		expect(screen.getByText('Chart of Accounts')).toBeTruthy();
	});

	it('renders account table with data', () => {
		render(<AccountsPage />);
		expect(screen.getByRole('table')).toBeTruthy();
		expect(screen.getByText('REV-001')).toBeTruthy();
		expect(screen.getByText('Tuition Revenue')).toBeTruthy();
		expect(screen.getByText('EXP-001')).toBeTruthy();
		expect(screen.getByText('Staff Salaries')).toBeTruthy();
	});

	it('renders type badges', () => {
		render(<AccountsPage />);
		expect(screen.getByLabelText('Type: Revenue')).toBeTruthy();
		expect(screen.getByLabelText('Type: Expense')).toBeTruthy();
	});

	it('renders center type badges', () => {
		render(<AccountsPage />);
		expect(screen.getByLabelText('Center type: Profit Center')).toBeTruthy();
		expect(screen.getByLabelText('Center type: Cost Center')).toBeTruthy();
	});

	it('renders status badges', () => {
		render(<AccountsPage />);
		const statusBadges = screen.getAllByLabelText('Status: Active');
		expect(statusBadges.length).toBe(2);
	});

	it('renders search input', () => {
		render(<AccountsPage />);
		expect(screen.getByLabelText('Search accounts')).toBeTruthy();
	});

	it('renders filter controls', () => {
		render(<AccountsPage />);
		expect(screen.getByLabelText('Filter by type')).toBeTruthy();
		expect(screen.getByLabelText('Filter by center type')).toBeTruthy();
		expect(screen.getByLabelText('Filter by status')).toBeTruthy();
	});

	it('renders Add Account button for admins', () => {
		render(<AccountsPage />);
		expect(screen.getByText('+ Add Account')).toBeTruthy();
	});

	it('hides Add Account button for non-admins', () => {
		mockUserRole = 'Editor';
		render(<AccountsPage />);
		expect(screen.queryByText('+ Add Account')).toBeNull();
	});

	it('renders table column headers', () => {
		render(<AccountsPage />);
		expect(screen.getByText('Account Code')).toBeTruthy();
		expect(screen.getByText('Account Name')).toBeTruthy();
		expect(screen.getByText('IFRS Category')).toBeTruthy();
	});

	it('renders actions column for admins', () => {
		render(<AccountsPage />);
		expect(screen.getByText('Actions')).toBeTruthy();
	});

	it('hides actions column for non-admins', () => {
		mockUserRole = 'Viewer';
		render(<AccountsPage />);
		expect(screen.queryByText('Actions')).toBeNull();
	});
});
