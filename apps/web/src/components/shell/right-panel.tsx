import { useCallback, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';
import { useRightPanelStore } from '../../stores/right-panel-store';
import { useWorkspaceContext } from '../../hooks/use-workspace-context';
import type { RightPanelTab } from '../../stores/right-panel-store';

const TABS: Array<{ id: RightPanelTab; label: string }> = [
	{ id: 'details', label: 'Details' },
	{ id: 'activity', label: 'Activity' },
	{ id: 'audit', label: 'Audit' },
	{ id: 'help', label: 'Help' },
];

function DetailsTabContent() {
	const { versionId } = useWorkspaceContext();

	if (!versionId) {
		return (
			<p className="text-[length:var(--text-sm)] text-[var(--text-muted)]">
				Select a version to view details.
			</p>
		);
	}

	return (
		<div className="space-y-4">
			<div>
				<h3 className="text-[length:var(--text-xs)] font-medium uppercase tracking-wider text-[var(--text-muted)]">
					Enrollment Summary
				</h3>
				<p className="mt-2 text-[length:var(--text-sm)] text-[var(--text-secondary)]">
					Version {versionId} selected. Enrollment details will appear here.
				</p>
			</div>
		</div>
	);
}

export function RightPanel() {
	const { isOpen, activeTab, width, close, setTab, setWidth } = useRightPanelStore();
	const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);

	const handleResizeStart = useCallback(
		(e: React.PointerEvent) => {
			e.preventDefault();
			resizeRef.current = { startX: e.clientX, startWidth: width };

			const handleMove = (ev: PointerEvent) => {
				if (!resizeRef.current) return;
				const delta = resizeRef.current.startX - ev.clientX;
				setWidth(resizeRef.current.startWidth + delta);
			};

			const handleUp = () => {
				resizeRef.current = null;
				document.removeEventListener('pointermove', handleMove);
				document.removeEventListener('pointerup', handleUp);
			};

			document.addEventListener('pointermove', handleMove);
			document.addEventListener('pointerup', handleUp);
		},
		[width, setWidth]
	);

	if (!isOpen) return null;

	return (
		<div
			className={cn(
				'flex shrink-0 border-l-2 border-l-[var(--accent-100)]',
				'bg-[var(--workspace-bg)] shadow-[var(--shadow-sm)]',
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
					'hover:bg-[var(--accent-300)] active:bg-[var(--accent-400)]',
					'transition-colors duration-[var(--duration-fast)]'
				)}
				onPointerDown={handleResizeStart}
				role="separator"
				aria-orientation="vertical"
				aria-label="Resize panel"
			/>

			{/* Panel content */}
			<div className="flex flex-1 flex-col overflow-hidden">
				{/* Header */}
				<div className="flex h-12 items-center justify-between border-b border-[var(--workspace-border)] bg-white/80 backdrop-blur-md px-4">
					<div className="flex items-center gap-1" role="tablist">
						{TABS.map((tab) => (
							<button
								key={tab.id}
								type="button"
								onClick={() => setTab(tab.id)}
								className={cn(
									'px-2.5 py-1.5 text-[length:var(--text-sm)] font-medium',
									'transition-colors duration-[var(--duration-fast)]',
									activeTab === tab.id
										? 'text-[var(--accent-600)] border-b-2 border-b-[var(--accent-500)] rounded-none'
										: 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
								)}
								aria-selected={activeTab === tab.id}
								role="tab"
							>
								{tab.label}
							</button>
						))}
					</div>
					<button
						type="button"
						onClick={close}
						className={cn(
							'rounded-[var(--radius-sm)] p-1',
							'text-[var(--text-muted)] hover:text-[var(--text-primary)]',
							'hover:bg-[var(--workspace-bg-muted)]',
							'transition-colors duration-[var(--duration-fast)]'
						)}
						aria-label="Close panel"
					>
						<X className="h-4 w-4" />
					</button>
				</div>

				{/* Tab content */}
				<div className="flex-1 overflow-y-auto p-4 scrollbar-thin bg-[var(--workspace-bg-subtle)]">
					{activeTab === 'details' && <DetailsTabContent />}
					{activeTab === 'activity' && (
						<p className="text-[length:var(--text-sm)] text-[var(--text-muted)]">
							Recent activity will appear here.
						</p>
					)}
					{activeTab === 'audit' && (
						<p className="text-[length:var(--text-sm)] text-[var(--text-muted)]">
							Audit log entries for the selected item.
						</p>
					)}
					{activeTab === 'help' && (
						<p className="text-[length:var(--text-sm)] text-[var(--text-muted)]">
							Contextual help for the current module.
						</p>
					)}
				</div>
			</div>
		</div>
	);
}
