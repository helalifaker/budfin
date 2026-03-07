import { NavLink } from 'react-router';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';

interface SidebarNavItemProps {
	to: string;
	label: string;
	icon: LucideIcon;
	isCollapsed: boolean;
}

export function SidebarNavItem({ to, label, icon: Icon, isCollapsed }: SidebarNavItemProps) {
	return (
		<NavLink
			to={to}
			className={({ isActive }) =>
				cn(
					'group relative flex items-center gap-3 rounded-[var(--radius-md)]',
					'text-[length:var(--text-sm)] font-medium',
					'transition-all duration-[var(--duration-fast)]',
					isCollapsed ? 'justify-center px-2 py-2' : 'px-3 py-2',
					isActive
						? [
								'bg-[var(--sidebar-bg-active)] text-[var(--sidebar-text-active)]',
								'shadow-[0_0_12px_var(--sidebar-glow)]',
							].join(' ')
						: [
								'text-[var(--sidebar-text)]',
								'hover:bg-[var(--sidebar-bg-hover)] hover:text-[var(--sidebar-text-active)]',
							].join(' ')
				)
			}
		>
			{({ isActive }) => (
				<>
					{isActive && (
						<span
							className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-[var(--accent-300)]"
							aria-hidden="true"
						/>
					)}
					<Icon
						className={cn(
							'h-[18px] w-[18px] shrink-0',
							'transition-transform duration-[var(--duration-fast)]',
							!isCollapsed && 'group-hover:translate-x-0.5'
						)}
						aria-hidden="true"
					/>
					{!isCollapsed && <span className="truncate">{label}</span>}
					{isCollapsed && (
						<span
							className={cn(
								'absolute left-full ml-2 z-50',
								'rounded-[var(--radius-sm)] bg-[var(--sidebar-bg)]',
								'px-2.5 py-1.5 text-xs text-[var(--sidebar-text-active)]',
								'shadow-[var(--shadow-md)] border border-[var(--sidebar-border)]',
								'opacity-0 group-hover:opacity-100',
								'pointer-events-none',
								'transition-opacity duration-[var(--duration-fast)]',
								'whitespace-nowrap'
							)}
							role="tooltip"
						>
							{label}
						</span>
					)}
				</>
			)}
		</NavLink>
	);
}
