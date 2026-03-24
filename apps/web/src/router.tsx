import type { RouteObject } from 'react-router';
import { createBrowserRouter } from 'react-router';
import { LandingRedirect } from './components/landing-redirect';
import { ProtectedRoute } from './components/protected-route';
import { LoginPage } from './pages/login';
import { RootLayout } from './layouts/root-layout';
import { PlanningShell } from './layouts/planning-shell';
import { ManagementShell } from './layouts/management-shell';
import { DashboardPage } from './pages/planning/dashboard';
import { EnrollmentPage } from './pages/planning/enrollment';
import { RevenuePage } from './pages/planning/revenue';
import { VersionsPage } from './pages/management/versions';
import { FiscalPeriodsPage } from './pages/management/fiscal-periods';
import { AccountsPage } from './pages/master-data/accounts';
import { AcademicPage } from './pages/master-data/academic';
import { ReferencePage } from './pages/master-data/reference';
import { AssumptionsPage } from './pages/master-data/assumptions';
import { UsersPage } from './pages/admin/users';
import { AuditPage } from './pages/admin/audit';
import { SettingsPage } from './pages/admin/settings';
import { StaffingPage } from './pages/planning/staffing';
import { OpExPage } from './pages/planning/opex';
import { PnlPage } from './pages/planning/pnl';
import { PlaceholderPage } from './pages/placeholder';

export const routes: RouteObject[] = [
	{ path: '/login', element: <LoginPage /> },
	{
		element: <ProtectedRoute />,
		children: [
			{
				path: '/',
				element: <LandingRedirect />,
			},
			{
				element: <RootLayout />,
				children: [
					// Planning Shell
					{
						element: <PlanningShell />,
						children: [
							{
								path: '/planning',
								element: <DashboardPage />,
							},
							{
								path: '/planning/enrollment',
								element: <EnrollmentPage />,
							},
							{
								path: '/planning/revenue',
								element: <RevenuePage />,
							},
							{
								path: '/planning/staffing',
								element: <StaffingPage />,
							},
							{
								path: '/planning/opex',
								element: <OpExPage />,
							},
							{
								path: '/planning/pnl',
								element: <PnlPage />,
							},
							{
								path: '/planning/scenarios',
								element: (
									<PlaceholderPage
										title="Scenario Modeling"
										description="Compare budget scenarios and what-if analysis"
									/>
								),
							},
						],
					},
					// Management Shell
					{
						element: <ManagementShell />,
						children: [
							{
								path: '/management/versions',
								element: <VersionsPage />,
							},
							{
								path: '/management/fiscal-periods',
								element: <FiscalPeriodsPage />,
							},
							// Master Data
							{
								path: '/master-data/accounts',
								element: <AccountsPage />,
							},
							{
								path: '/master-data/academic',
								element: <AcademicPage />,
							},
							{
								path: '/master-data/reference',
								element: <ReferencePage />,
							},
							{
								path: '/master-data/assumptions',
								element: <AssumptionsPage />,
							},
							// Admin (role-gated)
							{
								element: <ProtectedRoute roles={['Admin']} />,
								children: [
									{
										path: '/admin/users',
										element: <UsersPage />,
									},
									{
										path: '/admin/audit',
										element: <AuditPage />,
									},
									{
										path: '/admin/settings',
										element: <SettingsPage />,
									},
								],
							},
						],
					},
				],
			},
		],
	},
];

export const router = createBrowserRouter(routes);
