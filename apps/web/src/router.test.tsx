import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from './router';
import { useAuthStore } from './stores/auth-store';

// Mock page components
vi.mock('./pages/planning/dashboard', () => ({
	DashboardPage: () => <div>Dashboard Page</div>,
}));

vi.mock('./pages/planning/enrollment', () => ({
	EnrollmentPage: () => <div>Enrollment Page</div>,
}));

vi.mock('./pages/planning/revenue', () => ({
	RevenuePage: () => <div>Revenue Page</div>,
}));

vi.mock('./pages/planning/scenarios', () => ({
	ScenarioPage: () => <div>Scenario Page</div>,
}));

vi.mock('./pages/management/versions', () => ({
	VersionsPage: () => <div>Versions Page</div>,
}));

vi.mock('./pages/management/fiscal-periods', () => ({
	FiscalPeriodsPage: () => <div>Fiscal Periods Page</div>,
}));

vi.mock('./pages/master-data/accounts', () => ({
	AccountsPage: () => <div>Accounts Page</div>,
}));

vi.mock('./pages/master-data/academic', () => ({
	AcademicPage: () => <div>Academic Page</div>,
}));

vi.mock('./pages/master-data/reference', () => ({
	ReferencePage: () => <div>Reference Page</div>,
}));

vi.mock('./pages/master-data/assumptions', () => ({
	AssumptionsPage: () => <div>Assumptions Page</div>,
}));

vi.mock('./pages/admin/users', () => ({
	UsersPage: () => <div>Users Page</div>,
}));

vi.mock('./pages/admin/audit', () => ({
	AuditPage: () => <div>Audit Page</div>,
}));

vi.mock('./pages/admin/settings', () => ({
	SettingsPage: () => <div>Settings Page</div>,
}));

// Mock layout shells to render Outlet directly
vi.mock('./layouts/planning-shell', async () => {
	const { Outlet } = await import('react-router');
	return { PlanningShell: () => <Outlet /> };
});

vi.mock('./layouts/management-shell', async () => {
	const { Outlet } = await import('react-router');
	return { ManagementShell: () => <Outlet /> };
});

function renderRoute(
	initialEntry: string,
	user: {
		id: number;
		email: string;
		role: string;
	}
) {
	useAuthStore.setState({
		accessToken: 'test-access-token',
		user,
		isAuthenticated: true,
		isInitializing: false,
	});

	const router = createMemoryRouter(routes, {
		initialEntries: [initialEntry],
	});

	render(<RouterProvider router={router} />);
	return router;
}

afterEach(() => {
	cleanup();
	useAuthStore.setState({
		accessToken: null,
		user: null,
		isAuthenticated: false,
	});
});

describe('router access control', () => {
	it('redirects Admin users at / to /admin/users', async () => {
		renderRoute('/', {
			id: 1,
			email: 'admin@budfin.app',
			role: 'Admin',
		});

		expect(await screen.findByText('Users Page')).toBeDefined();
		expect(screen.getByRole('heading', { name: 'Master Data' })).toBeDefined();
		expect(screen.getByRole('heading', { name: 'Admin' })).toBeDefined();
	});

	it('redirects non-admin users at / to /planning', async () => {
		renderRoute('/', {
			id: 2,
			email: 'editor@budfin.app',
			role: 'Editor',
		});

		expect(await screen.findByText('Dashboard Page')).toBeDefined();
		expect(screen.getByRole('heading', { name: 'Master Data' })).toBeDefined();
		expect(screen.queryByRole('heading', { name: 'Admin' })).toBeNull();
	});

	it('keeps master-data pages reachable for authenticated non-admin users', async () => {
		renderRoute('/master-data/assumptions', {
			id: 3,
			email: 'viewer@budfin.app',
			role: 'Viewer',
		});

		expect(await screen.findByText('Assumptions Page')).toBeDefined();
		expect(screen.getByText('Accounts & Centers')).toBeDefined();
		expect(screen.queryByRole('heading', { name: 'Admin' })).toBeNull();
	});

	it('redirects non-admin users away from admin routes', async () => {
		renderRoute('/admin/users', {
			id: 4,
			email: 'budget-owner@budfin.app',
			role: 'BudgetOwner',
		});

		expect(await screen.findByText('Dashboard Page')).toBeDefined();
		expect(screen.queryByText('Users Page')).toBeNull();
		expect(screen.queryByRole('heading', { name: 'Admin' })).toBeNull();
	});
});
