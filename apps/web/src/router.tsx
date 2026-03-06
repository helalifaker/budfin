import type { RouteObject } from 'react-router';
import { createBrowserRouter } from 'react-router';
import { LandingRedirect } from './components/landing-redirect';
import { ProtectedRoute } from './components/protected-route';
import { LoginPage } from './pages/login';
import { ManagementShell } from './layouts/management-shell';
import { UsersPage } from './pages/admin/users';
import { AuditPage } from './pages/admin/audit';
import { SettingsPage } from './pages/admin/settings';
import { VersionsPage } from './pages/versions/versions';
import { FiscalPeriodsPage } from './pages/versions/fiscal-periods';
import { AccountsPage } from './pages/master-data/accounts';
import { AcademicPage } from './pages/master-data/academic';
import { ReferencePage } from './pages/master-data/reference';
import { AssumptionsPage } from './pages/master-data/assumptions';

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
				element: <ManagementShell />,
				children: [
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
				],
			},
		],
	},
	{
		element: <ProtectedRoute />,
		children: [
			{
				element: <ManagementShell />,
				children: [
					{
						path: '/master-data/assumptions',
						element: <AssumptionsPage />,
					},
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
							{
								path: '/versions',
								element: <VersionsPage />,
							},
							{
								path: '/fiscal-periods',
								element: <FiscalPeriodsPage />,
							},
						],
					},
				],
			},
		],
	},
];

export const router = createBrowserRouter(routes);
