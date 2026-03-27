import type { ReactNode } from 'react';
import { Search } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';

export type AdminPageHeaderProps = {
	title: string;
	subtitle?: string;
	searchValue?: string;
	onSearchChange?: (value: string) => void;
	searchPlaceholder?: string;
	primaryAction?: {
		label: string;
		onClick: () => void;
	};
	children?: ReactNode;
};

export function AdminPageHeader({
	title,
	subtitle,
	searchValue,
	onSearchChange,
	searchPlaceholder = 'Search...',
	primaryAction,
	children,
}: AdminPageHeaderProps) {
	return (
		<div className="flex items-start justify-between gap-4">
			<div className="min-w-0">
				<h1 className="text-(--text-xl) font-semibold text-(--text-primary)">{title}</h1>
				{subtitle && <p className="mt-1 text-(--text-sm) text-(--text-muted)">{subtitle}</p>}
			</div>
			<div className="flex shrink-0 items-center gap-2">
				{onSearchChange !== undefined && (
					<div className="relative">
						<Search
							className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-(--text-muted)"
							aria-hidden="true"
						/>
						<label htmlFor="admin-search" className="sr-only">
							{searchPlaceholder}
						</label>
						<Input
							id="admin-search"
							type="text"
							placeholder={searchPlaceholder}
							value={searchValue ?? ''}
							onChange={(e) => onSearchChange(e.target.value)}
							className="w-56 pl-8"
						/>
					</div>
				)}
				{children}
				{primaryAction && (
					<Button type="button" variant="primary" onClick={primaryAction.onClick}>
						{primaryAction.label}
					</Button>
				)}
			</div>
		</div>
	);
}
