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
				'rounded-lg border border-(--workspace-border)',
				isOpen
					? 'bg-(--workspace-bg-card) shadow-(--shadow-card-hover)'
					: 'bg-(--workspace-bg-card) shadow-(--shadow-card)'
			)}
		>
			{/* Header */}
			<button
				type="button"
				className={cn(
					'flex w-full items-center gap-3 px-4 py-3.5',
					'text-left transition-colors duration-(--duration-fast)',
					'hover:bg-(--workspace-bg-subtle)',
					'focus-visible:outline-none focus-visible:ring-2',
					'focus-visible:ring-(--accent-500) focus-visible:ring-inset',
					!isOpen && 'rounded-lg',
					isOpen && 'rounded-t-(--radius-lg) border-b border-(--workspace-border)'
				)}
				onClick={() => setIsOpen((prev) => !prev)}
				aria-expanded={isOpen}
				aria-controls={toggleId}
			>
				<ChevronDown
					className={cn(
						'size-4 shrink-0',
						isOpen ? 'text-(--accent-500)' : 'text-(--text-muted)',
						'transition-transform duration-(--duration-normal)',
						isOpen && 'rotate-0',
						!isOpen && '-rotate-90'
					)}
					aria-hidden="true"
				/>
				<span className="text-(--text-sm) font-semibold text-(--text-primary)">{title}</span>
				{count !== undefined && (
					<span
						className={cn(
							'inline-flex items-center rounded-full',
							'bg-(--accent-50) px-2 py-0.5',
							'text-(--text-xs) font-medium text-(--accent-700)'
						)}
					>
						{count}
					</span>
				)}
				{isStale && (
					<span className="ml-auto flex items-center gap-1.5">
						<span
							className="size-2 rounded-full bg-(--color-stale) animate-pulse"
							aria-hidden="true"
						/>
						<span className="text-(--text-xs) font-medium text-(--color-stale)">Recalculate</span>
					</span>
				)}
			</button>

			{/* Collapsible content */}
			<div
				id={toggleId}
				role="region"
				aria-labelledby={toggleId}
				className="overflow-hidden transition-[max-height,opacity] duration-(--duration-normal) ease-(--ease-out-expo)"
				style={{
					maxHeight: isOpen ? (contentHeight ?? 'none') : 0,
					opacity: isOpen ? 1 : 0,
				}}
			>
				<div ref={contentRef} className="p-4">
					{children}
				</div>
			</div>
		</section>
	);
}
