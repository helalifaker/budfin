import { useCallback, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';
import { useAdminSidePanel } from './admin-side-panel-context';

const MIN_WIDTH = 280;
const MAX_WIDTH_RATIO = 0.5;
const DEFAULT_WIDTH = 400;

function clampWidth(width: number): number {
	const maxWidth = typeof window !== 'undefined' ? window.innerWidth * MAX_WIDTH_RATIO : 960;
	return Math.max(MIN_WIDTH, Math.min(width, maxWidth));
}

export function AdminSidePanel() {
	const { isOpen, title, content, close } = useAdminSidePanel();
	const [width, setWidth] = useState(DEFAULT_WIDTH);
	const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);

	const handleResizeStart = useCallback(
		(e: React.PointerEvent) => {
			e.preventDefault();
			resizeRef.current = { startX: e.clientX, startWidth: width };

			const handleMove = (ev: PointerEvent) => {
				if (!resizeRef.current) return;
				const delta = resizeRef.current.startX - ev.clientX;
				setWidth(clampWidth(resizeRef.current.startWidth + delta));
			};

			const handleUp = () => {
				resizeRef.current = null;
				document.removeEventListener('pointermove', handleMove);
				document.removeEventListener('pointerup', handleUp);
			};

			document.addEventListener('pointermove', handleMove);
			document.addEventListener('pointerup', handleUp);
		},
		[width]
	);

	if (!isOpen) return null;

	return (
		<div
			className={cn(
				'flex h-full shrink-0 border-l-2 border-l-(--accent-100)',
				'bg-(--workspace-bg) shadow-(--shadow-sm)',
				'animate-slide-up'
			)}
			style={{
				width,
				animationName: 'slide-in-right',
				animationDuration: 'var(--duration-normal)',
				animationTimingFunction: 'var(--ease-out-expo)',
			}}
		>
			{/* Resize handle */}
			<div
				className={cn(
					'w-1 cursor-col-resize shrink-0',
					'hover:bg-(--accent-300) active:bg-(--accent-400)',
					'transition-colors duration-(--duration-fast)'
				)}
				onPointerDown={handleResizeStart}
				role="separator"
				aria-orientation="vertical"
				aria-label="Resize panel"
			/>

			{/* Panel content */}
			<div className="flex flex-1 flex-col overflow-hidden">
				{/* Header */}
				<div className="flex h-12 items-center justify-between border-b border-(--workspace-border) bg-(--inspector-bg) px-4 backdrop-blur-md">
					<h2 className="text-(--text-sm) font-semibold text-(--text-primary)">{title}</h2>
					<button
						type="button"
						onClick={close}
						className={cn(
							'rounded-sm p-1',
							'text-(--text-muted) hover:text-(--text-primary)',
							'hover:bg-(--workspace-bg-muted)',
							'transition-colors duration-(--duration-fast)'
						)}
						aria-label="Close panel"
					>
						<X className="h-4 w-4" />
					</button>
				</div>

				{/* Content */}
				<div className="flex-1 overflow-y-auto p-4 scrollbar-thin bg-(--workspace-bg-subtle)">
					{content}
				</div>
			</div>
		</div>
	);
}
