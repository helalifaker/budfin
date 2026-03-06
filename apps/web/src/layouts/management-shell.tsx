import { NavLink, Outlet } from 'react-router';
import { useAuthStore } from '../stores/auth-store';

const navItems = [
	{ to: '/admin/users', label: 'Users' },
	{ to: '/admin/audit', label: 'Audit Trail' },
	{ to: '/admin/settings', label: 'Settings' },
	{ to: '/versions', label: 'Version Management' },
	{ to: '/fiscal-periods', label: 'Fiscal Periods' },
];

export function ManagementShell() {
	const user = useAuthStore((s) => s.user);
	const logout = useAuthStore((s) => s.logout);

	return (
		<div className="min-h-screen flex bg-gray-50">
			<aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
				<div className="px-4 py-4 border-b border-gray-200">
					<span className="text-lg font-bold text-gray-900">BudFin</span>
				</div>
				<nav className="flex-1 px-2 py-4 space-y-1">
					{navItems.map((item) => (
						<NavLink
							key={item.to}
							to={item.to}
							className={({ isActive }) =>
								`block rounded px-3 py-2 text-sm font-medium ${
									isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
								}`
							}
						>
							{item.label}
						</NavLink>
					))}
				</nav>
			</aside>
			<div className="flex-1 flex flex-col">
				<header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-end gap-4">
					<span className="text-sm text-gray-600">{user?.email}</span>
					<span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
						{user?.role}
					</span>
					<button
						type="button"
						onClick={() => logout()}
						className="text-sm text-red-600 hover:text-red-700"
					>
						Logout
					</button>
				</header>
				<main className="flex-1 p-6">
					<Outlet />
				</main>
			</div>
		</div>
	);
}
