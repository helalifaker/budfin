import { ChevronRight } from 'lucide-react';
import { cn } from '../../lib/cn';

interface BreadcrumbItem {
	label: string;
	onClick?: () => void;
}

interface BreadcrumbProps {
	items: BreadcrumbItem[];
	className?: string;
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
	return (
		<nav aria-label="Breadcrumb" className={cn('flex items-center gap-1', className)}>
			{items.map((item, i) => (
				<span key={i} className="flex items-center gap-1">
					{i > 0 && (
						<ChevronRight className="h-3.5 w-3.5 text-[var(--text-muted)]" aria-hidden="true" />
					)}
					{item.onClick ? (
						<button
							type="button"
							onClick={item.onClick}
							className={cn(
								'text-[length:var(--text-sm)]',
								i === items.length - 1
									? 'font-medium text-[var(--text-primary)]'
									: 'text-[var(--text-muted)] hover:text-[var(--text-primary)]',
								'transition-colors duration-[var(--duration-fast)]'
							)}
						>
							{item.label}
						</button>
					) : (
						<span
							className={cn(
								'text-[length:var(--text-sm)]',
								i === items.length - 1
									? 'font-medium text-[var(--text-primary)]'
									: 'text-[var(--text-muted)]'
							)}
							aria-current={i === items.length - 1 ? 'page' : undefined}
						>
							{item.label}
						</span>
					)}
				</span>
			))}
		</nav>
	);
}
