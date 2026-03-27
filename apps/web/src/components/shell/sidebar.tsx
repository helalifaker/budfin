import {
	LayoutDashboard,
	UserRound,
	DollarSign,
	Briefcase,
	BarChart2,
	GitBranch,
	TrendingUp,
	Layers,
	Calendar,
	Landmark,
	GraduationCap,
	Database,
	SlidersHorizontal,
	Users,
	ScrollText,
	Settings,
	ChevronsLeft,
	LogOut,
	Receipt,
	FileSpreadsheet,
	Workflow,
	Sun,
	Moon,
	Monitor,
} from 'lucide-react';
import { cn } from '../../lib/cn';
import { useAuthStore } from '../../stores/auth-store';
import { useSidebarStore } from '../../stores/sidebar-store';
import { useRightPanelStore } from '../../stores/right-panel-store';
import { useTheme, type ThemePreference } from '../../lib/theme';
import { SidebarNavItem } from './sidebar-nav-item';
import type { LucideIcon } from 'lucide-react';

interface NavItem {
	to: string;
	label: string;
	icon: LucideIcon;
}

interface NavGroup {
	label: string;
	adminOnly?: boolean;
	items: NavItem[];
}

const navGroups: NavGroup[] = [
	{
		label: 'Planning',
		items: [
			{ to: '/planning', label: 'Dashboard', icon: LayoutDashboard },
			{ to: '/planning/enrollment', label: 'Enrollment', icon: UserRound },
			{ to: '/planning/revenue', label: 'Revenue', icon: DollarSign },
			{ to: '/planning/staffing', label: 'Staffing', icon: Briefcase },
			{ to: '/planning/opex', label: 'Operating Expenses', icon: Receipt },
			{ to: '/planning/pnl', label: 'P&L', icon: BarChart2 },
			{ to: '/planning/pnl/accounting', label: 'P&L (Accounting)', icon: FileSpreadsheet },
			{ to: '/planning/scenarios', label: 'Scenarios', icon: GitBranch },
			{ to: '/planning/trends', label: 'Trends', icon: TrendingUp },
		],
	},
	{
		label: 'Management',
		items: [
			{ to: '/management/versions', label: 'Versions', icon: Layers },
			{ to: '/management/fiscal-periods', label: 'Fiscal Periods', icon: Calendar },
		],
	},
	{
		label: 'Master Data',
		items: [
			{ to: '/master-data/accounts', label: 'Accounts & Centers', icon: Landmark },
			{ to: '/master-data/academic', label: 'Academic Years', icon: GraduationCap },
			{ to: '/master-data/reference', label: 'Reference Data', icon: Database },
			{ to: '/master-data/assumptions', label: 'Assumptions', icon: SlidersHorizontal },
			{ to: '/master-data/pnl-mapping', label: 'P&L Mapping', icon: Workflow },
		],
	},
	{
		label: 'Admin',
		adminOnly: true,
		items: [
			{ to: '/admin/users', label: 'Users', icon: Users },
			{ to: '/admin/audit', label: 'Audit Trail', icon: ScrollText },
			{ to: '/admin/settings', label: 'Settings', icon: Settings },
		],
	},
];

const THEME_CYCLE: ThemePreference[] = ['light', 'dark', 'system'];
const THEME_ICONS = { light: Sun, dark: Moon, system: Monitor } as const;
const THEME_LABELS = { light: 'Light', dark: 'Dark', system: 'System' } as const;

export function Sidebar() {
	const user = useAuthStore((s) => s.user);
	const logout = useAuthStore((s) => s.logout);
	const { isCollapsed, toggle, expand } = useSidebarStore();
	const rightPanelOpen = useRightPanelStore((s) => s.isOpen);
	const closeRightPanel = useRightPanelStore((s) => s.close);
	const [theme, setTheme] = useTheme();

	const cycleTheme = () => {
		const idx = THEME_CYCLE.indexOf(theme);
		const next = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length]!;
		setTheme(next);
	};

	const ThemeIcon = THEME_ICONS[theme];

	const isAdmin = user?.role === 'Admin';
	const visibleGroups = navGroups.filter((g) => !g.adminOnly || isAdmin);

	const handleToggle = () => {
		if (isCollapsed && rightPanelOpen) {
			closeRightPanel();
		}
		toggle();
	};

	const handleExpand = () => {
		if (rightPanelOpen) {
			closeRightPanel();
		}
		expand();
	};

	return (
		<aside
			className={cn(
				'flex flex-col shrink-0',
				'bg-(--sidebar-bg) border-r border-(--sidebar-border)',
				'shadow-(--shadow-sidebar)',
				'transition-[width] duration-(--duration-normal)',
				'overflow-hidden'
			)}
			style={{
				width: isCollapsed ? 64 : 240,
				transitionTimingFunction: 'var(--ease-out-expo)',
			}}
		>
			{/* Logo */}
			<div
				className={cn(
					'flex h-14 items-center shrink-0',
					'border-b border-(--sidebar-border)',
					isCollapsed ? 'justify-center px-2' : 'px-4 gap-3'
				)}
			>
				<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-(--accent-500)">
					<span className="text-sm font-bold text-(--text-on-dark)">B</span>
				</div>
				{!isCollapsed && (
					<span
						className={cn(
							'text-(--text-lg) font-bold text-(--text-on-dark)',
							'transition-opacity duration-(--duration-fast)'
						)}
					>
						BudFin
					</span>
				)}
			</div>

			{/* Navigation */}
			<nav
				className={cn(
					'flex-1 overflow-y-auto scrollbar-thin',
					isCollapsed ? 'px-2 py-3' : 'px-3 py-3',
					'space-y-5'
				)}
				aria-label="Primary"
			>
				{visibleGroups.map((group) => (
					<section key={group.label} aria-label={group.label}>
						{!isCollapsed && (
							<h2
								className={cn(
									'px-3 pb-2 text-(length:--text-xs) font-semibold uppercase tracking-wider',
									'text-(--text-muted)',
									'transition-opacity duration-(--duration-fast)'
								)}
							>
								{group.label}
							</h2>
						)}
						<div className="space-y-0.5">
							{group.items.map((item) => (
								<SidebarNavItem
									key={item.to}
									to={item.to}
									label={item.label}
									icon={item.icon}
									isCollapsed={isCollapsed}
								/>
							))}
						</div>
					</section>
				))}
			</nav>

			{/* Footer */}
			<div
				className={cn(
					'border-t border-(--sidebar-border) shrink-0',
					isCollapsed ? 'px-2 py-3' : 'px-3 py-3',
					'space-y-2'
				)}
			>
				{/* User info */}
				{!isCollapsed && user && (
					<div className="flex items-center gap-3 px-3 py-2">
						<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-(--accent-600) text-xs font-medium text-(--text-on-dark)">
							{user.email.charAt(0).toUpperCase()}
						</div>
						<div className="min-w-0 flex-1">
							<p className="truncate text-(--text-sm) text-(--sidebar-text-active)">{user.email}</p>
							<p className="text-(length:--text-xs) text-(--text-muted)">{user.role}</p>
						</div>
					</div>
				)}

				{/* Theme toggle */}
				<button
					type="button"
					onClick={cycleTheme}
					className={cn(
						'flex w-full items-center gap-3 rounded-md',
						'text-(--text-sm) text-(--sidebar-text)',
						'hover:bg-(--sidebar-bg-hover) hover:text-(--sidebar-text-active)',
						'transition-colors duration-(--duration-fast)',
						isCollapsed ? 'justify-center px-2 py-2' : 'px-3 py-2'
					)}
					aria-label={`Theme: ${THEME_LABELS[theme]}. Click to cycle.`}
				>
					<ThemeIcon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
					{!isCollapsed && <span>{THEME_LABELS[theme]}</span>}
				</button>

				{/* Logout */}
				<button
					type="button"
					onClick={() => logout()}
					className={cn(
						'flex w-full items-center gap-3 rounded-md',
						'text-(--text-sm) text-(--sidebar-text)',
						'hover:bg-(--sidebar-bg-hover) hover:text-(--color-error)',
						'transition-colors duration-(--duration-fast)',
						isCollapsed ? 'justify-center px-2 py-2' : 'px-3 py-2'
					)}
				>
					<LogOut className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
					{!isCollapsed && <span>Logout</span>}
				</button>

				{/* Collapse toggle */}
				<button
					type="button"
					onClick={isCollapsed ? handleExpand : handleToggle}
					className={cn(
						'flex w-full items-center gap-3 rounded-md',
						'text-(--text-sm) text-(--sidebar-text)',
						'hover:bg-(--sidebar-bg-hover) hover:text-(--sidebar-text-active)',
						'transition-colors duration-(--duration-fast)',
						isCollapsed ? 'justify-center px-2 py-2' : 'px-3 py-2'
					)}
					aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
				>
					<ChevronsLeft
						className={cn(
							'h-[18px] w-[18px] shrink-0',
							'transition-transform duration-(--duration-normal)',
							isCollapsed && 'rotate-180'
						)}
						style={{ transitionTimingFunction: 'var(--ease-out-back)' }}
						aria-hidden="true"
					/>
					{!isCollapsed && <span>Collapse</span>}
				</button>
			</div>
		</aside>
	);
}
