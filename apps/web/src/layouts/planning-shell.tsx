import { NavLink, Outlet } from 'react-router';
import { useAuthStore } from '../stores/auth-store';
import { ContextBar } from '../components/context-bar';

const navItems = [
	{ to: '/planning/enrollment', label: 'Enrollment' },
	{ to: '/planning/staff', label: 'Staff & Positions' },
	{ to: '/planning/budget', label: 'Budget' },
	{ to: '/planning/reports', label: 'Reports' },
];

/**
 * PlanningShell — layout for all planning screens.
 *
 * Structure:
 *   ┌─ Sidebar ──────────────┬─ Main column ──────────────────────┐
 *   │  BudFin logo           │  ContextBar (sticky, 40px)         │
 *   │  Nav links             │  Content area (<Outlet />)          │
 *   │  ...                   │                                     │
 *   │  User info / Logout    │                                     │
 *   └────────────────────────┴────────────────────────────────────┘
 *
 * The ContextBar persists across all planning child routes and keeps
 * FY / Version / Comparison / Period / Scenario in URL search params.
 */
export function PlanningShell() {
	const user = useAuthStore((s) => s.user);
	const logout = useAuthStore((s) => s.logout);

	return (
		<div className="min-h-screen flex bg-gray-50">
			<aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
				<div className="px-4 py-4 border-b border-gray-200">
					<span className="text-lg font-bold text-gray-900">BudFin</span>
				</div>
				<nav className="flex-1 px-2 py-4 space-y-1" aria-label="Planning navigation">
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
				<div className="border-t border-gray-200 px-4 py-3 flex flex-col gap-1">
					<span className="text-xs text-gray-500 truncate">{user?.email}</span>
					<span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded w-fit">
						{user?.role}
					</span>
					<button
						type="button"
						onClick={() => logout()}
						className="mt-1 text-left text-xs text-red-600 hover:text-red-700"
					>
						Logout
					</button>
				</div>
			</aside>

			<div className="flex-1 flex flex-col min-w-0">
				{/* ContextBar is sticky and persists across all child routes */}
				<ContextBar />

				<main className="flex-1 p-6 overflow-auto">
					<Outlet />
				</main>
			</div>
		</div>
	);
}
