import { cn } from '../../lib/cn';

export type AdminTab = {
	key: string;
	label: string;
};

export type AdminTabBarProps = {
	tabs: readonly AdminTab[];
	activeTab: string;
	onTabChange: (key: string) => void;
	ariaLabel?: string;
};

export function AdminTabBar({ tabs, activeTab, onTabChange, ariaLabel }: AdminTabBarProps) {
	return (
		<div
			role="tablist"
			aria-label={ariaLabel ?? 'Page sections'}
			className="flex border-b border-(--workspace-border)"
		>
			{tabs.map((tab) => (
				<button
					key={tab.key}
					type="button"
					role="tab"
					id={`admin-tab-${tab.key}`}
					aria-selected={activeTab === tab.key}
					aria-controls={`admin-panel-${tab.key}`}
					onClick={() => onTabChange(tab.key)}
					className={cn(
						'px-4 py-2 text-(--text-sm) font-medium -mb-px border-b-2',
						'transition-colors duration-(--duration-fast)',
						activeTab === tab.key
							? 'border-(--accent-500) text-(--accent-600)'
							: 'border-transparent text-(--text-muted) hover:text-(--text-primary)'
					)}
				>
					{tab.label}
				</button>
			))}
		</div>
	);
}
