import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { cn } from '../../lib/cn';
import { formatDate, formatDateTime } from '../../lib/format-date';
import type { BudgetVersion } from '../../hooks/use-versions';
import { useVersionAuditTrail } from '../../hooks/use-versions';
import { Button } from '../ui/button';

export type VersionDetailPanelProps = {
	open: boolean;
	version: BudgetVersion | null;
	onClose: () => void;
	currentUserRole?: string | undefined;
	onPublish?: (v: BudgetVersion) => void;
	onLock?: (v: BudgetVersion) => void;
	onArchive?: (v: BudgetVersion) => void;
	onRevert?: (v: BudgetVersion) => void;
	onDelete?: (v: BudgetVersion) => void;
};

const MODULE_ROUTES: Record<string, string> = {
	ENROLLMENT: '/planning/enrollment',
	REVENUE: '/planning/revenue',
	DHG: '/planning/staffing',
	STAFFING: '/planning/staffing',
	PNL: '/planning/pnl',
};

const STATUS_BADGE_COLORS: Record<BudgetVersion['status'], string> = {
	Draft: 'bg-[var(--status-draft-bg)] text-[var(--text-primary)]',
	Published: 'bg-[var(--status-published-bg)] text-[var(--status-published)]',
	Locked: 'bg-[var(--status-locked-bg)] text-[var(--status-locked)]',
	Archived: 'bg-[var(--status-archived-bg)] text-[var(--text-muted)]',
};

const TYPE_DOT_COLORS: Record<BudgetVersion['type'], string> = {
	Budget: 'bg-[var(--version-budget)]',
	Forecast: 'bg-[var(--version-forecast)]',
	Actual: 'bg-[var(--version-actual)]',
};

const OPERATION_DOT_COLORS: Record<string, string> = {
	VERSION_CREATED: 'bg-[var(--status-draft)]',
	VERSION_PUBLISHED: 'bg-[var(--status-published)]',
	VERSION_LOCKED: 'bg-[var(--status-locked)]',
	VERSION_ARCHIVED: 'bg-[var(--status-archived)]',
	VERSION_REVERTED: 'bg-[var(--status-draft)]',
	VERSION_CLONED: 'bg-[var(--status-draft)]',
};

const OPERATION_VERBS: Record<string, string> = {
	VERSION_CREATED: 'Created',
	VERSION_PUBLISHED: 'Published',
	VERSION_LOCKED: 'Locked',
	VERSION_ARCHIVED: 'Archived',
	VERSION_REVERTED: 'Reverted',
	VERSION_CLONED: 'Cloned',
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

export function VersionDetailPanel({
	open,
	version,
	onClose,
	currentUserRole,
	onPublish,
	onLock,
	onArchive,
	onRevert,
	onDelete,
}: VersionDetailPanelProps) {
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

	const { data: auditTrail, isLoading: auditLoading } = useVersionAuditTrail(version?.id);

	if (!open || !version) return null;

	const staleDisplay = version.staleModules.length > 0 ? version.staleModules : null;

	const isAdmin = currentUserRole === 'Admin';
	const isMutator = isAdmin || currentUserRole === 'BudgetOwner';

	const lifecycleButtons: React.ReactNode[] = [];
	if (version.status === 'Draft' && isMutator) {
		if (onPublish) {
			lifecycleButtons.push(
				<Button key="publish" variant="primary" onClick={() => onPublish(version)}>
					Publish
				</Button>
			);
		}
		if (onDelete) {
			lifecycleButtons.push(
				<Button key="delete" variant="destructive" onClick={() => onDelete(version)}>
					Delete
				</Button>
			);
		}
	} else if (version.status === 'Published' && isAdmin) {
		if (onLock) {
			lifecycleButtons.push(
				<Button key="lock" variant="primary" onClick={() => onLock(version)}>
					Lock
				</Button>
			);
		}
		if (onRevert) {
			lifecycleButtons.push(
				<Button key="revert" variant="outline" onClick={() => onRevert(version)}>
					Revert to Draft
				</Button>
			);
		}
	} else if (version.status === 'Locked' && isAdmin) {
		if (onArchive) {
			lifecycleButtons.push(
				<Button key="archive" variant="primary" onClick={() => onArchive(version)}>
					Archive
				</Button>
			);
		}
		if (onRevert) {
			lifecycleButtons.push(
				<Button key="revert" variant="outline" onClick={() => onRevert(version)}>
					Revert to Draft
				</Button>
			);
		}
	}

	return (
		<>
			<div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} aria-hidden="true" />
			<aside
				ref={panelRef}
				role="complementary"
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

					{/* Lifecycle History */}
					<section>
						<SectionHeading>Lifecycle History</SectionHeading>
						{auditLoading ? (
							<p className="text-[length:var(--text-sm)] text-[var(--text-muted)]">Loading...</p>
						) : !auditTrail || auditTrail.length === 0 ? (
							<p className="text-[length:var(--text-sm)] text-[var(--text-muted)]">
								No history available
							</p>
						) : (
							<div className="relative space-y-0">
								{auditTrail.map((entry, idx) => {
									const dotColor =
										OPERATION_DOT_COLORS[entry.operation] ?? 'bg-[var(--text-muted)]';
									const verb = OPERATION_VERBS[entry.operation] ?? entry.operation;
									const note =
										entry.newValues &&
										typeof entry.newValues === 'object' &&
										'audit_note' in entry.newValues
											? String(entry.newValues.audit_note)
											: null;
									const isLast = idx === auditTrail.length - 1;

									return (
										<div key={entry.id} className="relative flex gap-3 pb-4">
											{/* Vertical line */}
											{!isLast && (
												<div
													className={cn(
														'absolute left-[5px] top-3 w-0.5',
														'bg-[var(--workspace-border)]'
													)}
													style={{ bottom: 0 }}
													aria-hidden="true"
												/>
											)}
											{/* Dot */}
											<div
												className={cn(
													'relative z-10 mt-1 h-3 w-3 shrink-0',
													'rounded-full',
													dotColor
												)}
												aria-hidden="true"
											/>
											{/* Text */}
											<div>
												<p className="text-[length:var(--text-sm)] text-[var(--text-primary)]">
													{verb} on {formatDate(entry.createdAt)}
												</p>
												{note && (
													<p className="text-[length:var(--text-xs)] italic text-[var(--text-muted)]">
														{note}
													</p>
												)}
											</div>
										</div>
									);
								})}
							</div>
						)}
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
											<Link
												key={mod}
												to={MODULE_ROUTES[mod] ?? '#'}
												className={cn(
													'inline-flex rounded-[var(--radius-sm)] px-2 py-0.5',
													'text-[length:var(--text-xs)] font-medium',
													'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
													'hover:opacity-80'
												)}
											>
												{mod}
											</Link>
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
				<div className="flex items-center justify-between border-t px-6 py-4">
					<div className="flex gap-2">{lifecycleButtons}</div>
					<Button variant="outline" onClick={onClose}>
						Close
					</Button>
				</div>
			</aside>
		</>
	);
}
