import { useEffect, useRef } from 'react';
import { cn } from '../../lib/cn';
import { formatDateTime } from '../../lib/format-date';
import type { BudgetVersion } from '../../hooks/use-versions';
import { Button } from '../ui/button';

export type VersionDetailPanelProps = {
	open: boolean;
	version: BudgetVersion | null;
	onClose: () => void;
};

const STATUS_BADGE_COLORS: Record<BudgetVersion['status'], string> = {
	Draft: 'bg-[var(--workspace-bg-muted)] text-[var(--text-primary)]',
	Published: 'bg-[var(--version-budget-bg)] text-[var(--status-published)]',
	Locked: 'bg-[color-mix(in_srgb,var(--status-locked)_15%,white)] text-[var(--status-locked)]',
	Archived: 'bg-[var(--workspace-bg-muted)] text-[var(--text-muted)]',
};

const TYPE_DOT_COLORS: Record<BudgetVersion['type'], string> = {
	Budget: 'bg-[var(--version-budget)]',
	Forecast: 'bg-[var(--version-forecast)]',
	Actual: 'bg-[var(--version-actual)]',
};

function SectionHeading({ children }: { children: React.ReactNode }) {
	return (
		<h3 className="mb-2 text-[length:var(--text-xs)] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
			{children}
		</h3>
	);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div>
			<dt className="text-[length:var(--text-sm)] text-[var(--text-muted)]">{label}</dt>
			<dd className="text-[length:var(--text-sm)] font-medium text-[var(--text-primary)]">
				{children}
			</dd>
		</div>
	);
}

export function VersionDetailPanel({ open, version, onClose }: VersionDetailPanelProps) {
	const panelRef = useRef<HTMLDivElement>(null);
	const titleId = 'version-detail-panel-title';

	// Focus trap + Escape
	useEffect(() => {
		if (!open) return;
		const panel = panelRef.current;
		if (!panel) return;

		const focusable = panel.querySelectorAll<HTMLElement>(
			'button, [tabindex]:not([tabindex="-1"])'
		);
		const first = focusable[0];
		const last = focusable[focusable.length - 1];
		first?.focus();

		function handleKeyDown(e: KeyboardEvent) {
			if (e.key === 'Escape') {
				onClose();
				return;
			}
			if (e.key !== 'Tab') return;
			if (e.shiftKey && document.activeElement === first) {
				e.preventDefault();
				last?.focus();
			} else if (!e.shiftKey && document.activeElement === last) {
				e.preventDefault();
				first?.focus();
			}
		}

		panel.addEventListener('keydown', handleKeyDown);
		return () => panel.removeEventListener('keydown', handleKeyDown);
	}, [open, onClose]);

	if (!open || !version) return null;

	const staleDisplay = version.staleModules.length > 0 ? version.staleModules : null;

	return (
		<>
			<div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} aria-hidden="true" />
			<aside
				ref={panelRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
				className={cn(
					'fixed right-0 top-0 z-50 h-full w-[480px]',
					'bg-[var(--workspace-bg-card)] shadow-xl',
					'flex flex-col'
				)}
			>
				{/* Header */}
				<div className="border-b px-6 py-4">
					<div className="flex items-center gap-3">
						<h2 id={titleId} className="text-[length:var(--text-lg)] font-semibold">
							{version.name}
						</h2>
						<span
							className={cn(
								'inline-flex rounded-[var(--radius-sm)] px-2 py-0.5 text-[length:var(--text-xs)] font-medium',
								STATUS_BADGE_COLORS[version.status]
							)}
						>
							{version.status}
						</span>
					</div>
					{version.description && (
						<p className="mt-1 text-[length:var(--text-sm)] text-[var(--text-muted)]">
							{version.description}
						</p>
					)}
				</div>

				{/* Body */}
				<div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
					{/* Identity */}
					<section>
						<SectionHeading>Identity</SectionHeading>
						<dl className="grid grid-cols-2 gap-4">
							<Field label="ID">{version.id}</Field>
							<Field label="Fiscal Year">FY{version.fiscalYear}</Field>
							<Field label="Type">
								<span className="inline-flex items-center gap-1.5">
									<span
										className={cn(
											'h-2 w-2 rounded-[var(--radius-sm)]',
											TYPE_DOT_COLORS[version.type]
										)}
										aria-hidden="true"
									/>
									{version.type}
								</span>
							</Field>
							<Field label="Data Source">{version.dataSource}</Field>
						</dl>
					</section>

					{/* Lifecycle */}
					<section>
						<SectionHeading>Lifecycle</SectionHeading>
						<dl className="grid grid-cols-2 gap-4">
							<Field label="Status">{version.status}</Field>
							<Field label="Published At">{formatDateTime(version.publishedAt)}</Field>
							<Field label="Locked At">{formatDateTime(version.lockedAt)}</Field>
							<Field label="Archived At">{formatDateTime(version.archivedAt)}</Field>
						</dl>
					</section>

					{/* Version Control */}
					<section>
						<SectionHeading>Version Control</SectionHeading>
						<dl className="grid grid-cols-2 gap-4">
							<Field label="Modification Count">{version.modificationCount}</Field>
							<Field label="Stale Modules">
								{staleDisplay ? (
									<span className="flex flex-wrap gap-1">
										{staleDisplay.map((mod) => (
											<span
												key={mod}
												className={cn(
													'inline-flex rounded-[var(--radius-sm)] px-2 py-0.5',
													'text-[length:var(--text-xs)] font-medium',
													'bg-[var(--color-warning-bg)] text-[var(--color-warning)]'
												)}
											>
												{mod}
											</span>
										))}
									</span>
								) : (
									'None'
								)}
							</Field>
							<Field label="Source Version ID">
								{version.sourceVersionId !== null ? version.sourceVersionId : 'Original'}
							</Field>
						</dl>
					</section>

					{/* Audit */}
					<section>
						<SectionHeading>Audit</SectionHeading>
						<dl className="grid grid-cols-2 gap-4">
							<Field label="Created By">{version.createdByEmail ?? '\u2014'}</Field>
							<Field label="Created At">{formatDateTime(version.createdAt)}</Field>
							<Field label="Updated At">{formatDateTime(version.updatedAt)}</Field>
						</dl>
					</section>
				</div>

				{/* Footer */}
				<div className="flex justify-end border-t px-6 py-4">
					<Button variant="outline" onClick={onClose}>
						Close
					</Button>
				</div>
			</aside>
		</>
	);
}
