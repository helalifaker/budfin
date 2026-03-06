import { Navigate, createBrowserRouter } from 'react-router'
import { ProtectedRoute } from './components/protected-route'
import { LoginPage } from './pages/login'
import { ManagementShell } from './layouts/management-shell'
import { UsersPage } from './pages/admin/users'
import { AuditPage } from './pages/admin/audit'
import { SettingsPage } from './pages/admin/settings'

export const router = createBrowserRouter([
	{ path: '/login', element: <LoginPage /> },
	{
		element: <ProtectedRoute />,
		children: [
			{
				path: '/',
				element: <Navigate to="/admin/users" replace />,
			},
		],
	},
	{
		element: <ProtectedRoute roles={['Admin']} />,
		children: [
			{
				element: <ManagementShell />,
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
])
