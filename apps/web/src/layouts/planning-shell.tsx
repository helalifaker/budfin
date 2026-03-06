import { NavLink, Outlet } from 'react-router';
import type { LucideIcon } from 'lucide-react';
import { UserRound, Briefcase, DollarSign, BarChart2 } from 'lucide-react';
import { cn } from '../lib/cn';
import { useAuthStore } from '../stores/auth-store';
import { ContextBar } from '../components/context-bar';

interface NavItem {
	to: string;
	label: string;
	Icon: LucideIcon;
}

const navItems: NavItem[] = [
	{ to: '/planning/enrollment', label: 'Enrollment', Icon: UserRound },
	{ to: '/planning/staff', label: 'Staff & Positions', Icon: Briefcase },
	{ to: '/planning/budget', label: 'Budget', Icon: DollarSign },
	{ to: '/planning/reports', label: 'Reports', Icon: BarChart2 },
];

export function PlanningShell() {
	const user = useAuthStore((s) => s.user);
	const logout = useAuthStore((s) => s.logout);

	return (
		<div className="min-h-screen flex bg-gray-50">
			<aside
				className="w-60 flex flex-col"
				style={{
					background: 'var(--sidebar-bg)',
					borderRight: '1px solid var(--sidebar-border)',
					boxShadow: 'var(--shadow-sidebar)',
				}}
			>
				<div className="px-4 py-4" style={{ borderBottom: '1px solid var(--sidebar-border)' }}>
					<span className="text-lg font-bold text-white">BudFin</span>
				</div>
				<nav className="flex-1 px-2 py-4 space-y-1" aria-label="Planning navigation">
					{navItems.map((item) => (
						<NavLink
							key={item.to}
							to={item.to}
							className={({ isActive }) =>
								cn(
									'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
									isActive
										? 'bg-[#1E40AF] text-white'
										: 'text-[#CBD5E1] hover:bg-[#1E293B] hover:text-white'
								)
							}
						>
							<item.Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
							{item.label}
						</NavLink>
					))}
				</nav>
				<div
					className="px-4 py-3 flex flex-col gap-1"
					style={{ borderTop: '1px solid var(--sidebar-border)' }}
				>
					<span className="text-xs text-[#94A3B8] truncate">{user?.email}</span>
					<span className="text-xs bg-[#1E293B] text-[#CBD5E1] px-2 py-0.5 rounded w-fit">
						{user?.role}
					</span>
					<button
						type="button"
						onClick={() => logout()}
						className="mt-1 text-left text-xs text-red-400 hover:text-red-300"
					>
						Logout
					</button>
				</div>
			</aside>

			<div className="flex-1 flex flex-col min-w-0">
				<ContextBar />

				<main className="flex-1 p-6 overflow-auto">
					<Outlet />
				</main>
			</div>
		</div>
	);
}
