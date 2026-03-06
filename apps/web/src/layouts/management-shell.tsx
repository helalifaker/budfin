import { NavLink, Outlet } from 'react-router';
import type { LucideIcon } from 'lucide-react';
import {
	Landmark,
	GraduationCap,
	Database,
	SlidersHorizontal,
	Layers,
	Calendar,
	Users,
	ScrollText,
	Settings,
} from 'lucide-react';
import { cn } from '../lib/cn';
import { useAuthStore } from '../stores/auth-store';

interface NavItem {
	to: string;
	label: string;
	Icon: LucideIcon;
}

interface NavGroup {
	label: string;
	adminOnly?: boolean;
	items: NavItem[];
}

const navGroups: NavGroup[] = [
	{
		label: 'Master Data',
		items: [
			{ to: '/master-data/accounts', label: 'Accounts & Centers', Icon: Landmark },
			{ to: '/master-data/academic', label: 'Academic Years & Grades', Icon: GraduationCap },
			{ to: '/master-data/reference', label: 'Reference Data', Icon: Database },
			{ to: '/master-data/assumptions', label: 'Assumptions', Icon: SlidersHorizontal },
		],
	},
	{
		label: 'Planning',
		adminOnly: true,
		items: [
			{ to: '/versions', label: 'Version Management', Icon: Layers },
			{ to: '/fiscal-periods', label: 'Fiscal Periods', Icon: Calendar },
		],
	},
	{
		label: 'Admin',
		adminOnly: true,
		items: [
			{ to: '/admin/users', label: 'Users', Icon: Users },
			{ to: '/admin/audit', label: 'Audit Trail', Icon: ScrollText },
			{ to: '/admin/settings', label: 'Settings', Icon: Settings },
		],
	},
];

export function ManagementShell() {
	const user = useAuthStore((s) => s.user);
	const logout = useAuthStore((s) => s.logout);
	const isAdmin = user?.role === 'Admin';
	const visibleGroups = navGroups.filter((group) => !group.adminOnly || isAdmin);

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
				<nav className="flex-1 px-2 py-4 space-y-6" aria-label="Primary">
					{visibleGroups.map((group) => (
						<section key={group.label} aria-label={group.label}>
							<h2 className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">
								{group.label}
							</h2>
							<div className="space-y-1">
								{group.items.map((item) => (
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
							</div>
						</section>
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
