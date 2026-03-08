import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/cn';

export type WorkspaceBlockProps = {
	title: string;
	count?: number;
	isStale?: boolean;
	defaultOpen?: boolean;
	children: ReactNode;
};

export function WorkspaceBlock({
	title,
	count,
	isStale = false,
	defaultOpen = true,
	children,
}: WorkspaceBlockProps) {
	const [isOpen, setIsOpen] = useState(defaultOpen);
	const contentRef = useRef<HTMLDivElement>(null);
	const [contentHeight, setContentHeight] = useState<number | undefined>(undefined);

	const measureHeight = useCallback(() => {
		if (contentRef.current) {
			setContentHeight(contentRef.current.scrollHeight);
		}
	}, []);

	useEffect(() => {
		measureHeight();

		const observer = new ResizeObserver(measureHeight);
		if (contentRef.current) {
			observer.observe(contentRef.current);
		}
		return () => observer.disconnect();
	}, [measureHeight]);

	const toggleId = `workspace-block-${title.toLowerCase().replace(/\s+/g, '-')}`;

	return (
		<section
			className={cn(
				'rounded-[var(--radius-lg)] border border-[var(--workspace-border)]',
				'bg-[var(--workspace-bg-card)] shadow-[var(--shadow-md)]'
			)}
		>
			{/* Header */}
			<button
				type="button"
				className={cn(
					'flex w-full items-center gap-3 px-4 py-3',
					'text-left transition-colors duration-[var(--duration-fast)]',
					'hover:bg-[var(--workspace-bg-subtle)]',
					'focus-visible:outline-none focus-visible:ring-2',
					'focus-visible:ring-[var(--accent-500)] focus-visible:ring-inset',
					!isOpen && 'rounded-[var(--radius-lg)]',
					isOpen && 'rounded-t-[var(--radius-lg)] border-b border-[var(--workspace-border)]'
				)}
				onClick={() => setIsOpen((prev) => !prev)}
				aria-expanded={isOpen}
				aria-controls={toggleId}
			>
				<ChevronDown
					className={cn(
						'size-4 shrink-0 text-[var(--text-muted)]',
						'transition-transform duration-[var(--duration-normal)]',
						isOpen && 'rotate-0',
						!isOpen && '-rotate-90'
					)}
					aria-hidden="true"
				/>
				<span className="text-[length:var(--text-sm)] font-semibold text-[var(--text-primary)]">
					{title}
				</span>
				{count !== undefined && (
					<span
						className={cn(
							'inline-flex items-center rounded-full',
							'bg-[var(--workspace-bg-muted)] px-2 py-0.5',
							'text-[length:var(--text-xs)] font-medium text-[var(--text-secondary)]'
						)}
					>
						{count}
					</span>
				)}
				{isStale && (
					<span className="ml-auto flex items-center gap-1.5">
						<span className="size-2 rounded-full bg-[var(--color-stale)]" aria-hidden="true" />
						<span className="text-[length:var(--text-xs)] font-medium text-[var(--color-stale)]">
							Recalculate
						</span>
					</span>
				)}
			</button>

			{/* Collapsible content */}
			<div
				id={toggleId}
				role="region"
				aria-labelledby={toggleId}
				className="overflow-hidden transition-[max-height] duration-[var(--duration-normal)] ease-[var(--ease-out-expo)]"
				style={{
					maxHeight: isOpen ? (contentHeight ?? 'none') : 0,
				}}
			>
				<div ref={contentRef} className="p-4">
					{children}
				</div>
			</div>
		</section>
	);
}
