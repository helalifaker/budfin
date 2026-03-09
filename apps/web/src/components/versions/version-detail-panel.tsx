import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { cn } from '../../lib/cn';
import { formatDate, formatDateTime } from '../../lib/format-date';
import type { BudgetVersion } from '../../hooks/use-versions';
import { useVersionAuditTrail, useVersionImportLogs } from '../../hooks/use-versions';
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
	Draft: 'bg-(--status-draft-bg) text-(--text-primary)',
	Published: 'bg-(--status-published-bg) text-(--status-published)',
	Locked: 'bg-(--status-locked-bg) text-(--status-locked)',
	Archived: 'bg-(--status-archived-bg) text-(--text-muted)',
};

const TYPE_DOT_COLORS: Record<BudgetVersion['type'], string> = {
	Budget: 'bg-(--version-budget)',
	Forecast: 'bg-(--version-forecast)',
	Actual: 'bg-(--version-actual)',
};

const OPERATION_DOT_COLORS: Record<string, string> = {
	VERSION_CREATED: 'bg-(--status-draft)',
	VERSION_PUBLISHED: 'bg-(--status-published)',
	VERSION_LOCKED: 'bg-(--status-locked)',
	VERSION_ARCHIVED: 'bg-(--status-archived)',
	VERSION_REVERTED: 'bg-(--status-draft)',
	VERSION_CLONED: 'bg-(--status-draft)',
};

const OPERATION_VERBS: Record<string, string> = {
	VERSION_CREATED: 'Created',
	VERSION_PUBLISHED: 'Published',
	VERSION_LOCKED: 'Locked',
	VERSION_ARCHIVED: 'Archived',
	VERSION_REVERTED: 'Reverted',
	VERSION_CLONED: 'Cloned',
};

const TYPE_FULL_NAMES: Record<BudgetVersion['type'], string> = {
	Budget: 'Budget Version',
	Forecast: 'Forecast Version',
	Actual: 'Actual Data',
};

const LIFECYCLE_STATES: BudgetVersion['status'][] = ['Draft', 'Published', 'Locked', 'Archived'];

type TabKey = 'overview' | 'lifecycle' | 'data';

const TABS: { key: TabKey; label: string }[] = [
	{ key: 'overview', label: 'Overview' },
	{ key: 'lifecycle', label: 'Lifecycle' },
	{ key: 'data', label: 'Data' },
];

function SectionHeading({ children }: { children: React.ReactNode }) {
	return (
		<h3 className="mb-2 text-(--text-xs) font-semibold uppercase tracking-wide text-(--text-muted)">
			{children}
		</h3>
	);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div>
			<div className="text-(--text-sm) text-(--text-muted)">{label}</div>
			<div className="text-(--text-sm) font-medium text-(--text-primary)">{children}</div>
		</div>
	);
}

/* ---------- Tab: Overview ---------- */

function OverviewTab({ version }: { version: BudgetVersion }) {
	return (
		<div className="space-y-6">
			{/* Header info */}
			<section>
				<div className="flex items-center gap-3">
					<h3 className="text-(--text-lg) font-semibold text-(--text-primary)">{version.name}</h3>
					<span className="inline-flex items-center gap-1.5 text-(--text-sm)">
						<span
							className={cn('h-2 w-2 rounded-full', TYPE_DOT_COLORS[version.type])}
							aria-hidden="true"
						/>
						<span className="text-(--text-secondary)">{TYPE_FULL_NAMES[version.type]}</span>
					</span>
					<span
						className={cn(
							'inline-flex rounded-(--radius-sm) px-2 py-0.5',
							'text-(--text-xs) font-medium',
							STATUS_BADGE_COLORS[version.status]
						)}
					>
						{version.status}
					</span>
				</div>
				{version.description && (
					<p className="mt-2 text-(--text-sm) italic text-(--text-muted)">{version.description}</p>
				)}
			</section>

			{/* Metadata grid */}
			<section>
				<SectionHeading>Details</SectionHeading>
				<div className="grid grid-cols-2 gap-4">
					<Field label="Fiscal Year">FY{version.fiscalYear}</Field>
					<Field label="Data Source">{version.dataSource}</Field>
					<Field label="Created By">{version.createdByEmail ?? '\u2014'}</Field>
					<Field label="Created At">{formatDateTime(version.createdAt)}</Field>
					<Field label="Updated At">{formatDateTime(version.updatedAt)}</Field>
					{version.sourceVersionId !== null && (
						<Field label="Source">
							<span className="text-(--color-link)">
								Cloned from version #{version.sourceVersionId}
							</span>
						</Field>
					)}
				</div>
			</section>
		</div>
	);
}

/* ---------- Tab: Lifecycle ---------- */

function LifecycleStateMachine({ currentStatus }: { currentStatus: BudgetVersion['status'] }) {
	return (
		<div
			className="flex items-center gap-0"
			role="img"
			aria-label={`Current status: ${currentStatus}`}
		>
			{LIFECYCLE_STATES.map((state, idx) => {
				const isCurrent = state === currentStatus;
				const isPast = LIFECYCLE_STATES.indexOf(currentStatus) > idx;
				return (
					<div key={state} className="flex items-center">
						<span
							className={cn(
								'inline-flex items-center justify-center rounded-full px-3 py-1',
								'text-(--text-xs) font-medium',
								'transition-colors',
								isCurrent
									? 'bg-(--color-accent) text-white'
									: isPast
										? 'bg-(--workspace-bg-subtle) text-(--text-secondary)'
										: 'bg-(--workspace-bg-card) text-(--text-muted)' +
											' border border-(--workspace-border)'
							)}
						>
							{state}
						</span>
						{idx < LIFECYCLE_STATES.length - 1 && (
							<span
								className={cn(
									'mx-1 text-(--text-sm)',
									isPast ? 'text-(--text-secondary)' : 'text-(--text-muted)'
								)}
								aria-hidden="true"
							>
								&rarr;
							</span>
						)}
					</div>
				);
			})}
		</div>
	);
}

function LifecycleTab({
	version,
	isAdmin,
	isMutator,
	onPublish,
	onLock,
	onArchive,
	onRevert,
	onDelete,
}: {
	version: BudgetVersion;
	isAdmin: boolean;
	isMutator: boolean;
	onPublish?: ((v: BudgetVersion) => void) | undefined;
	onLock?: ((v: BudgetVersion) => void) | undefined;
	onArchive?: ((v: BudgetVersion) => void) | undefined;
	onRevert?: ((v: BudgetVersion) => void) | undefined;
	onDelete?: ((v: BudgetVersion) => void) | undefined;
}) {
	const { data: auditTrail, isLoading: auditLoading } = useVersionAuditTrail(version.id);

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
		<div className="space-y-6">
			{/* State machine diagram */}
			<section>
				<SectionHeading>State Machine</SectionHeading>
				<LifecycleStateMachine currentStatus={version.status} />
			</section>

			{/* Audit trail timeline */}
			<section>
				<SectionHeading>Audit Trail</SectionHeading>
				{auditLoading ? (
					<p className="text-(--text-sm) text-(--text-muted)">Loading...</p>
				) : !auditTrail || auditTrail.length === 0 ? (
					<p className="text-(--text-sm) text-(--text-muted)">No history available</p>
				) : (
					<div className="relative space-y-0">
						{auditTrail.map((entry, idx) => {
							const dotColor = OPERATION_DOT_COLORS[entry.operation] ?? 'bg-(--text-muted)';
							const verb = OPERATION_VERBS[entry.operation] ?? entry.operation;
							const userEmail =
								entry.newValues &&
								typeof entry.newValues === 'object' &&
								'user_email' in entry.newValues
									? String(entry.newValues.user_email)
									: null;
							const note =
								entry.newValues &&
								typeof entry.newValues === 'object' &&
								'audit_note' in entry.newValues
									? String(entry.newValues.audit_note)
									: null;
							const isLast = idx === auditTrail.length - 1;

							return (
								<div key={entry.id} className="relative flex gap-3 pb-4">
									{/* Vertical connector line */}
									{!isLast && (
										<div
											className={cn('absolute left-[5px] top-3 w-0.5', 'bg-(--workspace-border)')}
											style={{ bottom: 0 }}
											aria-hidden="true"
										/>
									)}
									{/* Dot */}
									<div
										className={cn('relative z-10 mt-1 h-3 w-3 shrink-0', 'rounded-full', dotColor)}
										aria-hidden="true"
									/>
									{/* Text */}
									<div>
										<p className="text-(--text-sm) text-(--text-primary)">
											{verb} on {formatDate(entry.createdAt)}
											{userEmail && <span className="text-(--text-muted)"> by {userEmail}</span>}
										</p>
										{note && <p className="text-(--text-xs) italic text-(--text-muted)">{note}</p>}
									</div>
								</div>
							);
						})}
					</div>
				)}
			</section>

			{/* Action buttons */}
			{lifecycleButtons.length > 0 && (
				<section>
					<SectionHeading>Actions</SectionHeading>
					<div className="flex gap-2">{lifecycleButtons}</div>
				</section>
			)}
		</div>
	);
}

/* ---------- Tab: Data ---------- */

function DataTab({ version }: { version: BudgetVersion }) {
	const staleDisplay = version.staleModules.length > 0 ? version.staleModules : null;
	const isActual = version.type === 'Actual';
	const { data: importLogs, isLoading: importLoading } = useVersionImportLogs(
		isActual ? version.id : undefined
	);

	return (
		<div className="space-y-6">
			{/* Stale Modules */}
			<section>
				<SectionHeading>Stale Modules</SectionHeading>
				{staleDisplay ? (
					<div className="flex flex-wrap gap-2">
						{staleDisplay.map((mod) => (
							<Link
								key={mod}
								to={MODULE_ROUTES[mod] ?? '#'}
								className={cn(
									'inline-flex items-center gap-1.5 rounded-(--radius-sm) px-2.5 py-1',
									'text-(--text-xs) font-medium',
									'bg-(--color-warning-bg) text-(--color-warning)',
									'hover:opacity-80 transition-opacity'
								)}
							>
								<span aria-hidden="true">!</span>
								{mod}
							</Link>
						))}
					</div>
				) : (
					<p className="text-(--text-sm) text-(--text-muted)">No stale modules</p>
				)}
			</section>

			{/* Import Information */}
			<section>
				<SectionHeading>Import Information</SectionHeading>
				{!isActual ? (
					<p className="text-(--text-sm) text-(--text-muted)">
						Import data is only available for Actual versions
					</p>
				) : importLoading ? (
					<p className="text-(--text-sm) text-(--text-muted)">Loading...</p>
				) : !importLogs || importLogs.length === 0 ? (
					<p className="text-(--text-sm) text-(--text-muted)">No imports recorded</p>
				) : (
					<div className="space-y-3">
						{importLogs.map((log) => (
							<div
								key={log.id}
								className={cn(
									'rounded-(--radius-md) border border-(--workspace-border)',
									'bg-(--workspace-bg-subtle) p-3'
								)}
							>
								<div className="grid grid-cols-2 gap-2">
									<Field label="Module">{log.module}</Field>
									<Field label="Source File">{log.sourceFile}</Field>
									<Field label="Rows Imported">{log.rowsImported}</Field>
									<Field label="Validation">
										<span
											className={cn(
												'inline-flex rounded-(--radius-sm) px-1.5 py-0.5',
												'text-(--text-xs) font-medium',
												log.validationStatus === 'passed'
													? 'bg-(--status-published-bg) text-(--status-published)'
													: 'bg-(--color-warning-bg) text-(--color-warning)'
											)}
										>
											{log.validationStatus}
										</span>
									</Field>
									<Field label="Imported At">{formatDateTime(log.importedAt)}</Field>
									<Field label="Imported By">{log.importedByEmail}</Field>
								</div>
							</div>
						))}
					</div>
				)}
			</section>
		</div>
	);
}

/* ---------- Main Panel ---------- */

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
	const [activeTab, setActiveTab] = useState<TabKey>('overview');
	const prevVersionIdRef = useRef<number | undefined>(undefined);

	// Reset tab when version changes (avoids setState-in-effect lint rule)
	if (version?.id !== prevVersionIdRef.current) {
		prevVersionIdRef.current = version?.id;
		if (activeTab !== 'overview') {
			setActiveTab('overview');
		}
	}

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

	const isAdmin = currentUserRole === 'Admin';
	const isMutator = isAdmin || currentUserRole === 'BudgetOwner';

	return (
		<>
			{/* Backdrop */}
			<div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} aria-hidden="true" />

			{/* Panel */}
			<aside
				ref={panelRef}
				role="complementary"
				aria-labelledby={titleId}
				className={cn(
					'fixed right-0 top-0 z-50 h-full w-[520px]',
					'bg-(--workspace-bg-card) shadow-xl',
					'flex flex-col',
					'translate-x-0 transition-transform duration-200 ease-out'
				)}
			>
				{/* Header */}
				<div className="border-b px-6 py-4">
					<div className="flex items-center justify-between">
						<h2 id={titleId} className="text-(--text-lg) font-semibold text-(--text-primary)">
							Version Details
						</h2>
						<button
							type="button"
							onClick={onClose}
							className={cn(
								'inline-flex h-8 w-8 items-center justify-center rounded-(--radius-sm)',
								'text-(--text-muted) hover:bg-(--workspace-bg-subtle)',
								'hover:text-(--text-primary) transition-colors'
							)}
							aria-label="Close panel"
						>
							<span aria-hidden="true" className="text-(--text-lg)">
								&times;
							</span>
						</button>
					</div>

					{/* Tab bar */}
					<nav className="mt-3 flex gap-0 border-b border-(--workspace-border)" role="tablist">
						{TABS.map((tab) => (
							<button
								key={tab.key}
								type="button"
								role="tab"
								aria-selected={activeTab === tab.key}
								aria-controls={`tabpanel-${tab.key}`}
								onClick={() => setActiveTab(tab.key)}
								className={cn(
									'px-4 pb-2 text-(--text-sm) font-medium transition-colors',
									'-mb-px border-b-2',
									activeTab === tab.key
										? 'border-(--color-accent) text-(--color-accent)'
										: 'border-transparent text-(--text-muted)' +
												' hover:text-(--text-secondary)' +
												' hover:border-(--workspace-border)'
								)}
							>
								{tab.label}
							</button>
						))}
					</nav>
				</div>

				{/* Body */}
				<div className="flex-1 overflow-y-auto px-6 py-5" role="tabpanel">
					{activeTab === 'overview' && <OverviewTab version={version} />}
					{activeTab === 'lifecycle' && (
						<LifecycleTab
							version={version}
							isAdmin={isAdmin}
							isMutator={isMutator}
							onPublish={onPublish}
							onLock={onLock}
							onArchive={onArchive}
							onRevert={onRevert}
							onDelete={onDelete}
						/>
					)}
					{activeTab === 'data' && <DataTab version={version} />}
				</div>

				{/* Footer */}
				<div className="flex items-center justify-end border-t px-6 py-4">
					<Button variant="outline" onClick={onClose}>
						Close
					</Button>
				</div>
			</aside>
		</>
	);
}
