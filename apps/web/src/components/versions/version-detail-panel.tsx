import { useEffect, useRef } from 'react';
import { cn } from '../../lib/cn';
import type { BudgetVersion } from '../../hooks/use-versions';

export type VersionDetailPanelProps = {
	open: boolean;
	version: BudgetVersion | null;
	onClose: () => void;
};

const STATUS_BADGE_COLORS: Record<BudgetVersion['status'], string> = {
	Draft: 'bg-slate-100 text-slate-700',
	Published: 'bg-blue-100 text-blue-800',
	Locked: 'bg-violet-100 text-violet-800',
	Archived: 'bg-slate-100 text-slate-500',
};

const TYPE_DOT_COLORS: Record<BudgetVersion['type'], string> = {
	Budget: 'bg-blue-500',
	Forecast: 'bg-amber-500',
	Actual: 'bg-green-500',
};

function formatDate(iso: string | null): string {
	if (!iso) return '\u2014';
	return new Date(iso).toLocaleString();
}

function SectionHeading({ children }: { children: React.ReactNode }) {
	return (
		<h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
			{children}
		</h3>
	);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div>
			<dt className="text-sm text-slate-500">{label}</dt>
			<dd className="text-sm font-medium text-slate-900">{children}</dd>
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
			'button, [tabindex]:not([tabindex="-1"])',
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

	const staleDisplay =
		version.staleModules.length > 0 ? version.staleModules : null;

	return (
		<>
			<div
				className="fixed inset-0 z-40 bg-black/30"
				onClick={onClose}
				aria-hidden="true"
			/>
			<aside
				ref={panelRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
				className={cn(
					'fixed right-0 top-0 z-50 h-full w-[480px]',
					'bg-white shadow-xl',
					'flex flex-col',
				)}
			>
				{/* Header */}
				<div className="border-b px-6 py-4">
					<div className="flex items-center gap-3">
						<h2 id={titleId} className="text-lg font-semibold">
							{version.name}
						</h2>
						<span
							className={cn(
								'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
								STATUS_BADGE_COLORS[version.status],
							)}
						>
							{version.status}
						</span>
					</div>
					{version.description && (
						<p className="mt-1 text-sm text-slate-500">{version.description}</p>
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
											'h-2 w-2 rounded-full',
											TYPE_DOT_COLORS[version.type],
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
							<Field label="Published At">
								{formatDate(version.publishedAt)}
							</Field>
							<Field label="Locked At">
								{formatDate(version.lockedAt)}
							</Field>
							<Field label="Archived At">
								{formatDate(version.archivedAt)}
							</Field>
						</dl>
					</section>

					{/* Version Control */}
					<section>
						<SectionHeading>Version Control</SectionHeading>
						<dl className="grid grid-cols-2 gap-4">
							<Field label="Modification Count">
								{version.modificationCount}
							</Field>
							<Field label="Stale Modules">
								{staleDisplay ? (
									<span className="flex flex-wrap gap-1">
										{staleDisplay.map((mod) => (
											<span
												key={mod}
												className={cn(
													'inline-flex rounded-full px-2 py-0.5',
													'text-xs font-medium',
													'bg-amber-100 text-amber-800',
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
								{version.sourceVersionId !== null
									? version.sourceVersionId
									: 'Original'}
							</Field>
						</dl>
					</section>

					{/* Audit */}
					<section>
						<SectionHeading>Audit</SectionHeading>
						<dl className="grid grid-cols-2 gap-4">
							<Field label="Created By">
								{version.createdByEmail ?? '\u2014'}
							</Field>
							<Field label="Created At">
								{formatDate(version.createdAt)}
							</Field>
							<Field label="Updated At">
								{formatDate(version.updatedAt)}
							</Field>
						</dl>
					</section>
				</div>

				{/* Footer */}
				<div className="flex justify-end border-t px-6 py-4">
					<button
						type="button"
						onClick={onClose}
						className={cn(
							'rounded-md border border-slate-300',
							'px-4 py-2 text-sm font-medium',
							'hover:bg-slate-50',
						)}
					>
						Close
					</button>
				</div>
			</aside>
		</>
	);
}
