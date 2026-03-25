import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UsersPage } from './users';

let mockUserRole = 'Admin';
let mockUserId = 1;

const mockUsersData = {
	users: [
		{
			id: 1,
			email: 'admin@efir.edu.sa',
			role: 'Admin',
			is_active: true,
			last_login_at: '2026-03-25T08:00:00Z',
			failed_attempts: 0,
			locked_until: null,
			created_at: '2025-09-01T00:00:00Z',
		},
		{
			id: 2,
			email: 'editor@efir.edu.sa',
			role: 'Editor',
			is_active: true,
			last_login_at: '2026-03-24T08:00:00Z',
			failed_attempts: 2,
			locked_until: null,
			created_at: '2025-10-01T00:00:00Z',
		},
		{
			id: 3,
			email: 'locked@efir.edu.sa',
			role: 'Viewer',
			is_active: false,
			last_login_at: null,
			failed_attempts: 5,
			locked_until: '2026-03-26T08:00:00Z',
			created_at: '2025-11-01T00:00:00Z',
		},
	],
};

vi.mock('../../stores/auth-store', () => ({
	useAuthStore: (selector: (state: { user: { role: string; id: number } }) => unknown) =>
		selector({ user: { role: mockUserRole, id: mockUserId } }),
}));

vi.mock('../../lib/api-client', () => ({
	apiClient: () => Promise.resolve(mockUsersData),
}));

vi.mock('../../hooks/use-delayed-skeleton', () => ({
	useDelayedSkeleton: () => false,
}));

vi.mock('../../components/admin/role-badge', () => ({
	RoleBadge: ({ role }: { role: string }) => <span data-testid={`role-badge-${role}`}>{role}</span>,
}));

vi.mock('../../components/admin/status-badge', () => ({
	StatusBadge: ({ isActive }: { isActive: boolean }) => (
		<span data-testid={`status-badge-${isActive ? 'active' : 'inactive'}`}>
			{isActive ? 'Active' : 'Inactive'}
		</span>
	),
}));

vi.mock('../../components/admin/user-side-panel', () => ({
	UserSidePanel: () => <div data-testid="user-side-panel" />,
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
		destructive?: boolean;
	}) => <div>{children}</div>,
	DropdownMenuSeparator: () => <hr />,
}));

vi.mock('../../components/ui/toast-state', () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

function createTestQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: { retry: false, gcTime: 0 },
		},
	});
}

function renderWithQueryClient(ui: React.ReactElement) {
	const qc = createTestQueryClient();
	return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('UsersPage', () => {
	beforeEach(() => {
		mockUserRole = 'Admin';
		mockUserId = 1;
	});

	afterEach(() => {
		cleanup();
	});

	it('renders page heading', () => {
		renderWithQueryClient(<UsersPage />);
		expect(screen.getByText('User Management')).toBeTruthy();
	});

	it('renders Add User button', () => {
		renderWithQueryClient(<UsersPage />);
		expect(screen.getByText('+ Add User')).toBeTruthy();
	});

	it('renders user table', () => {
		renderWithQueryClient(<UsersPage />);
		expect(screen.getByRole('table')).toBeTruthy();
	});

	it('renders table column headers', async () => {
		renderWithQueryClient(<UsersPage />);
		expect(screen.getByText('Email')).toBeTruthy();
		expect(screen.getByText('Role')).toBeTruthy();
		expect(screen.getByText('Status')).toBeTruthy();
		expect(screen.getByText('Last Login')).toBeTruthy();
		expect(screen.getByText('Failed Attempts')).toBeTruthy();
		expect(screen.getByText('Locked Until')).toBeTruthy();
		expect(screen.getByText('Created')).toBeTruthy();
		expect(screen.getByText('Actions')).toBeTruthy();
	});

	it('renders user side panel', () => {
		renderWithQueryClient(<UsersPage />);
		expect(screen.getByTestId('user-side-panel')).toBeTruthy();
	});
});
