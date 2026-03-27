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

vi.mock('./pages/admin/versions-page', () => ({
	VersionsPage: () => <div>Versions Page</div>,
}));

vi.mock('./pages/admin/master-data-page', () => ({
	MasterDataPage: () => <div>Master Data Page</div>,
}));

vi.mock('./pages/admin/financial-setup-page', () => ({
	FinancialSetupPage: () => <div>Financial Setup Page</div>,
}));

vi.mock('./pages/admin/system-page', () => ({
	SystemPage: () => <div>System Page</div>,
}));

// Mock layout shells to render Outlet directly
vi.mock('./layouts/planning-shell', async () => {
	const { Outlet } = await import('react-router');
	return { PlanningShell: () => <Outlet /> };
});

vi.mock('./layouts/admin-shell', async () => {
	const { Outlet } = await import('react-router');
	return { AdminShell: () => <Outlet /> };
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
	it('redirects Admin users at / to /admin/system', async () => {
		renderRoute('/', {
			id: 1,
			email: 'admin@budfin.app',
			role: 'Admin',
		});

		expect(await screen.findByText('System Page')).toBeDefined();
		expect(screen.getByRole('heading', { name: 'Administration' })).toBeDefined();
	});

	it('redirects non-admin users at / to /planning', async () => {
		renderRoute('/', {
			id: 2,
			email: 'editor@budfin.app',
			role: 'Editor',
		});

		expect(await screen.findByText('Dashboard Page')).toBeDefined();
		expect(screen.getByRole('heading', { name: 'Administration' })).toBeDefined();
		// System nav item should be hidden for non-admins
		expect(screen.queryByRole('link', { name: 'System' })).toBeNull();
	});

	it('keeps admin pages reachable for authenticated non-admin users', async () => {
		renderRoute('/admin/financial-setup', {
			id: 3,
			email: 'viewer@budfin.app',
			role: 'Viewer',
		});

		expect(await screen.findByText('Financial Setup Page')).toBeDefined();
		expect(screen.getByText('Master Data')).toBeDefined();
		expect(screen.queryByRole('link', { name: 'System' })).toBeNull();
	});

	it('redirects non-admin users away from system routes', async () => {
		renderRoute('/admin/system', {
			id: 4,
			email: 'budget-owner@budfin.app',
			role: 'BudgetOwner',
		});

		expect(await screen.findByText('Dashboard Page')).toBeDefined();
		expect(screen.queryByText('System Page')).toBeNull();
		expect(screen.queryByRole('link', { name: 'System' })).toBeNull();
	});
});
