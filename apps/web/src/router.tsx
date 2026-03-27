import type { RouteObject } from 'react-router';
import { createBrowserRouter, Navigate } from 'react-router';
import { LandingRedirect } from './components/landing-redirect';
import { ProtectedRoute } from './components/protected-route';
import { LoginPage } from './pages/login';
import { RootLayout } from './layouts/root-layout';
import { PlanningShell } from './layouts/planning-shell';
import { AdminShell } from './layouts/admin-shell';
import { DashboardPage } from './pages/planning/dashboard';
import { EnrollmentPage } from './pages/planning/enrollment';
import { RevenuePage } from './pages/planning/revenue';
import { StaffingPage } from './pages/planning/staffing';
import { OpExPage } from './pages/planning/opex';
import { PnlPage } from './pages/planning/pnl';
import { PnlAccountingPage } from './pages/planning/pnl-accounting';
import { ScenarioPage } from './pages/planning/scenarios';
import { TrendsPage } from './pages/planning/trends';
import { VersionsPage } from './pages/admin/versions-page';
import { MasterDataPage } from './pages/admin/master-data-page';
import { FinancialSetupPage } from './pages/admin/financial-setup-page';
import { SystemPage } from './pages/admin/system-page';

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
								path: '/planning/pnl/accounting',
								element: <PnlAccountingPage />,
							},
							{
								path: '/planning/scenarios',
								element: <ScenarioPage />,
							},
							{
								path: '/planning/trends',
								element: <TrendsPage />,
							},
						],
					},
					// Administration Shell
					{
						element: <AdminShell />,
						children: [
							{
								path: '/admin/versions',
								element: <VersionsPage />,
							},
							{
								path: '/admin/master-data',
								element: <MasterDataPage />,
							},
							{
								path: '/admin/financial-setup',
								element: <FinancialSetupPage />,
							},
							// System (Admin-only)
							{
								element: <ProtectedRoute roles={['Admin']} />,
								children: [
									{
										path: '/admin/system',
										element: <SystemPage />,
									},
								],
							},
						],
					},
					// Backward-compatible redirects
					{
						path: '/management/versions',
						element: <Navigate to="/admin/versions?tab=versions" replace />,
					},
					{
						path: '/management/fiscal-periods',
						element: <Navigate to="/admin/versions?tab=periods" replace />,
					},
					{
						path: '/master-data/accounts',
						element: <Navigate to="/admin/master-data?tab=accounts" replace />,
					},
					{
						path: '/master-data/academic',
						element: <Navigate to="/admin/master-data?tab=academic" replace />,
					},
					{
						path: '/master-data/reference',
						element: <Navigate to="/admin/master-data?tab=nationalities" replace />,
					},
					{
						path: '/master-data/assumptions',
						element: <Navigate to="/admin/financial-setup?tab=assumptions" replace />,
					},
					{
						path: '/master-data/pnl-mapping',
						element: <Navigate to="/admin/financial-setup?tab=pnl-template" replace />,
					},
					{
						path: '/admin/users',
						element: <Navigate to="/admin/system?tab=users" replace />,
					},
					{
						path: '/admin/audit',
						element: <Navigate to="/admin/system?tab=audit" replace />,
					},
					{
						path: '/admin/settings',
						element: <Navigate to="/admin/system?tab=settings" replace />,
					},
				],
			},
		],
	},
];

export const router = createBrowserRouter(routes);
