import { useCallback, useMemo, useState } from 'react';
import {
	createColumnHelper,
	flexRender,
	getCoreRowModel,
	useReactTable,
} from '@tanstack/react-table';
import { cn } from '../../lib/cn';
import { useAuthStore } from '../../stores/auth-store';
import { useVersions } from '../../hooks/use-versions';
import type { BudgetVersion } from '../../hooks/use-versions';
import { CreateVersionPanel } from '../../components/versions/create-version-panel';
import { CloneVersionDialog } from '../../components/versions/clone-version-dialog';
import { VersionDetailPanel } from '../../components/versions/version-detail-panel';
import {
	PublishDialog,
	LockDialog,
	ArchiveDialog,
	RevertDialog,
	DeleteDialog,
} from '../../components/versions/lifecycle-dialogs';

const columnHelper = createColumnHelper<BudgetVersion>();

// Status badges: filled pill — Draft=gray, Published=blue, Locked=violet, Archived=gray
const STATUS_BADGE_COLORS: Record<BudgetVersion['status'], string> = {
	Draft: 'bg-slate-100 text-slate-700',
	Published: 'bg-blue-100 text-blue-800',
	Locked: 'bg-violet-100 text-violet-800',
	Archived: 'bg-slate-100 text-slate-500',
};

// Type: short label with colored dot indicator
const TYPE_LABELS: Record<BudgetVersion['type'], string> = {
	Budget: 'BUD',
	Forecast: 'FC',
	Actual: 'ACT',
};

const TYPE_DOT_COLORS: Record<BudgetVersion['type'], string> = {
	Budget: 'bg-blue-500',
	Forecast: 'bg-amber-500',
	Actual: 'bg-green-500',
};

const CURRENT_FISCAL_YEAR = new Date().getFullYear();

export function VersionsPage() {
	const currentUser = useAuthStore((s) => s.user);
	const canCreate = currentUser?.role === 'Admin';

	// Filters
	const [fiscalYear, setFiscalYear] = useState<number>(CURRENT_FISCAL_YEAR);
	const [typeFilter, setTypeFilter] = useState('');
	const [statusFilter, setStatusFilter] = useState('');
	const [searchInput, setSearchInput] = useState('');
	const [searchDebounced, setSearchDebounced] = useState('');
	const [searchTimer, setSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

	const handleSearchChange = useCallback(
		(value: string) => {
			setSearchInput(value);
			if (searchTimer) clearTimeout(searchTimer);
			const timer = setTimeout(() => setSearchDebounced(value), 300);
			setSearchTimer(timer);
		},
		[searchTimer]
	);

	// Server-side filtering: fiscal year and status go to the API
	const { data, isLoading } = useVersions(fiscalYear, statusFilter || undefined);

	// Client-side filtering: type and name search
	const filteredRows = useMemo(() => {
		let rows = data?.data ?? [];
		if (typeFilter) {
			rows = rows.filter((v) => v.type === typeFilter);
		}
		if (searchDebounced) {
			const lower = searchDebounced.toLowerCase();
			rows = rows.filter((v) => v.name.toLowerCase().includes(lower));
		}
		// Default sort: createdAt DESC
		rows = [...rows].sort(
			(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
		);
		return rows;
	}, [data, typeFilter, searchDebounced]);

	// Status message
	const [statusMessage, setStatusMessage] = useState<{
		text: string;
		type: 'success' | 'error';
	} | null>(null);

	const showStatus = useCallback((text: string, type: 'success' | 'error') => {
		setStatusMessage({ text, type });
		setTimeout(() => setStatusMessage(null), 4000);
	}, []);

	// Fiscal year options: current year +/- 2
	const fiscalYearOptions = useMemo(() => {
		const base = CURRENT_FISCAL_YEAR;
		return [base - 2, base - 1, base, base + 1, base + 2];
	}, []);

	// --- Panel / Dialog state ---
	const [createOpen, setCreateOpen] = useState(false);
	const [cloneSource, setCloneSource] = useState<BudgetVersion | null>(null);
	const [detailVersion, setDetailVersion] = useState<BudgetVersion | null>(null);
	const [publishTarget, setPublishTarget] = useState<BudgetVersion | null>(null);
	const [lockTarget, setLockTarget] = useState<BudgetVersion | null>(null);
	const [archiveTarget, setArchiveTarget] = useState<BudgetVersion | null>(null);
	const [revertTarget, setRevertTarget] = useState<BudgetVersion | null>(null);
	const [deleteTarget, setDeleteTarget] = useState<BudgetVersion | null>(null);

	const columns = useMemo(
		() => [
			columnHelper.accessor('name', {
				header: 'Name',
				cell: (info) => <span className="font-medium">{info.getValue()}</span>,
			}),
			columnHelper.accessor('type', {
				header: 'Type',
				cell: (info) => {
					const value = info.getValue();
					return (
						<span
							className="inline-flex items-center gap-1.5 text-xs font-medium"
							aria-label={`Type: ${value}`}
						>
							<span
								className={cn('h-2 w-2 rounded-full', TYPE_DOT_COLORS[value])}
								aria-hidden="true"
							/>
							{TYPE_LABELS[value]}
						</span>
					);
				},
			}),
			columnHelper.accessor('status', {
				header: 'Status',
				cell: (info) => {
					const value = info.getValue();
					return (
						<span
							className={cn(
								'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
								STATUS_BADGE_COLORS[value]
							)}
							aria-label={`Status: ${value}`}
						>
							{value}
						</span>
					);
				},
			}),
			columnHelper.accessor('dataSource', {
				header: 'Data Source',
			}),
			columnHelper.accessor('createdByEmail', {
				header: 'Created By',
				cell: (info) => info.getValue() ?? '\u2014',
			}),
			columnHelper.accessor('createdAt', {
				header: 'Created At',
				cell: (info) => {
					const iso = info.getValue();
					return new Date(iso).toLocaleDateString();
				},
			}),
			columnHelper.accessor('modificationCount', {
				header: 'Mods',
				cell: (info) => info.getValue(),
			}),
			columnHelper.display({
				id: 'staleModules',
				header: 'Stale',
				cell: ({ row }) => {
					const stale = row.original.staleModules;
					if (!stale || stale.length === 0) return null;
					return (
						<span
							className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
							title={stale.join(', ')}
							aria-label={`Stale modules: ${stale.join(', ')}`}
						>
							{stale.length} stale
						</span>
					);
				},
			}),
			...(canCreate
				? [
						columnHelper.display({
							id: 'actions',
							header: 'Actions',
							cell: ({ row }) => {
								const version = row.original;
								return (
									<VersionActions
										version={version}
										onViewDetails={setDetailVersion}
										onClone={setCloneSource}
										onPublish={setPublishTarget}
										onLock={setLockTarget}
										onArchive={setArchiveTarget}
										onRevert={setRevertTarget}
										onDelete={setDeleteTarget}
									/>
								);
							},
						}),
					]
				: []),
		],
		[canCreate]
	);

	const table = useReactTable({
		data: filteredRows,
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	return (
		<div className="p-6">
			{/* Status message */}
			{statusMessage && (
				<div
					aria-live="polite"
					className={cn(
						'mb-4 rounded-md px-4 py-3 text-sm font-medium',
						statusMessage.type === 'success'
							? 'bg-green-50 text-green-800'
							: 'bg-red-50 text-red-800'
					)}
				>
					{statusMessage.text}
				</div>
			)}

			{/* Toolbar */}
			<div className="flex flex-wrap items-center gap-3 pb-4">
				<h1 className="mr-auto text-xl font-semibold">Version Management</h1>

				<input
					type="search"
					placeholder="Search versions..."
					value={searchInput}
					onChange={(e) => handleSearchChange(e.target.value)}
					className={cn(
						'w-[240px] rounded-md border border-slate-300',
						'px-3 py-2 text-sm',
						'placeholder:text-slate-400'
					)}
					aria-label="Search versions"
				/>

				<select
					value={String(fiscalYear)}
					onChange={(e) => setFiscalYear(Number(e.target.value))}
					className={cn('rounded-md border border-slate-300', 'px-3 py-2 text-sm')}
					aria-label="Filter by fiscal year"
				>
					{fiscalYearOptions.map((fy) => (
						<option key={fy} value={String(fy)}>
							FY {fy}
						</option>
					))}
				</select>

				<select
					value={typeFilter}
					onChange={(e) => setTypeFilter(e.target.value)}
					className={cn('rounded-md border border-slate-300', 'px-3 py-2 text-sm')}
					aria-label="Filter by type"
				>
					<option value="">All Types</option>
					<option value="Budget">Budget</option>
					<option value="Forecast">Forecast</option>
					<option value="Actual">Actual</option>
				</select>

				<select
					value={statusFilter}
					onChange={(e) => setStatusFilter(e.target.value)}
					className={cn('rounded-md border border-slate-300', 'px-3 py-2 text-sm')}
					aria-label="Filter by status"
				>
					<option value="">All Statuses</option>
					<option value="Draft">Draft</option>
					<option value="Published">Published</option>
					<option value="Locked">Locked</option>
					<option value="Archived">Archived</option>
				</select>

				{canCreate && (
					<button
						type="button"
						className={cn(
							'rounded-md bg-blue-600 px-4 py-2 text-sm',
							'font-medium text-white hover:bg-blue-700'
						)}
						onClick={() => setCreateOpen(true)}
					>
						+ New Version
					</button>
				)}
			</div>

			{/* Data table */}
			{isLoading ? (
				<p className="text-sm text-slate-500">Loading...</p>
			) : (
				<div className="overflow-x-auto rounded-lg border">
					<table role="grid" className="w-full text-left text-sm">
						<thead className="border-b bg-slate-50">
							{table.getHeaderGroups().map((hg) => (
								<tr key={hg.id} role="row">
									{hg.headers.map((header) => (
										<th
											key={header.id}
											role="columnheader"
											className="px-4 py-3 font-medium text-slate-600"
										>
											{flexRender(header.column.columnDef.header, header.getContext())}
										</th>
									))}
								</tr>
							))}
						</thead>
						<tbody>
							{table.getRowModel().rows.length === 0 ? (
								<tr>
									<td
										colSpan={columns.length}
										className="px-4 py-12 text-center text-sm text-slate-500"
									>
										<EmptyState fiscalYear={fiscalYear} />
									</td>
								</tr>
							) : (
								table.getRowModel().rows.map((row) => (
									<tr key={row.id} role="row" className="border-b last:border-0 hover:bg-slate-50">
										{row.getVisibleCells().map((cell) => (
											<td key={cell.id} role="gridcell" aria-readonly="true" className="px-4 py-3">
												{flexRender(cell.column.columnDef.cell, cell.getContext())}
											</td>
										))}
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>
			)}

			{/* Story #58 — Create Version Panel */}
			<CreateVersionPanel
				open={createOpen}
				fiscalYear={fiscalYear}
				onClose={() => setCreateOpen(false)}
				onSuccess={(name) => {
					setCreateOpen(false);
					showStatus(`Version "${name}" created successfully.`, 'success');
				}}
			/>

			{/* Story #58 — Clone Version Dialog */}
			<CloneVersionDialog
				open={cloneSource !== null}
				source={cloneSource}
				onClose={() => setCloneSource(null)}
				onSuccess={(clonedName, sourceName) => {
					setCloneSource(null);
					showStatus(`"${clonedName}" cloned from "${sourceName}" successfully.`, 'success');
				}}
			/>

			{/* Story #60 — Version Detail Panel */}
			<VersionDetailPanel
				open={detailVersion !== null}
				version={detailVersion}
				onClose={() => setDetailVersion(null)}
			/>

			{/* Story #59 — Lifecycle Dialogs */}
			<PublishDialog
				open={publishTarget !== null}
				version={publishTarget}
				onClose={() => setPublishTarget(null)}
				onSuccess={() => {
					showStatus(`"${publishTarget?.name}" published successfully.`, 'success');
					setPublishTarget(null);
				}}
			/>
			<LockDialog
				open={lockTarget !== null}
				version={lockTarget}
				onClose={() => setLockTarget(null)}
				onSuccess={() => {
					showStatus(`"${lockTarget?.name}" locked successfully.`, 'success');
					setLockTarget(null);
				}}
			/>
			<ArchiveDialog
				open={archiveTarget !== null}
				version={archiveTarget}
				onClose={() => setArchiveTarget(null)}
				onSuccess={() => {
					showStatus(`"${archiveTarget?.name}" archived successfully.`, 'success');
					setArchiveTarget(null);
				}}
			/>
			<RevertDialog
				open={revertTarget !== null}
				version={revertTarget}
				onClose={() => setRevertTarget(null)}
				onSuccess={() => {
					showStatus(`"${revertTarget?.name}" reverted to Draft.`, 'success');
					setRevertTarget(null);
				}}
			/>
			<DeleteDialog
				open={deleteTarget !== null}
				version={deleteTarget}
				onClose={() => setDeleteTarget(null)}
				onSuccess={() => {
					showStatus(`"${deleteTarget?.name}" deleted successfully.`, 'success');
					setDeleteTarget(null);
				}}
			/>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

type VersionActionsProps = {
	version: BudgetVersion;
	onViewDetails: (v: BudgetVersion) => void;
	onClone: (v: BudgetVersion) => void;
	onPublish: (v: BudgetVersion) => void;
	onLock: (v: BudgetVersion) => void;
	onArchive: (v: BudgetVersion) => void;
	onRevert: (v: BudgetVersion) => void;
	onDelete: (v: BudgetVersion) => void;
};

function VersionActions({
	version,
	onViewDetails,
	onClone,
	onPublish,
	onLock,
	onArchive,
	onRevert,
	onDelete,
}: VersionActionsProps) {
	const [open, setOpen] = useState(false);

	const currentUser = useAuthStore((s) => s.user);
	const isAdmin = currentUser?.role === 'Admin';

	const canPublish = isAdmin && version.status === 'Draft';
	const canLock = isAdmin && version.status === 'Published';
	const canArchive = isAdmin && (version.status === 'Published' || version.status === 'Locked');
	const canRevert = isAdmin && version.status === 'Locked';
	const canDelete = isAdmin && version.status === 'Draft';

	return (
		<div className="relative">
			<button
				type="button"
				aria-haspopup="menu"
				aria-expanded={open}
				onClick={() => setOpen((prev) => !prev)}
				className={cn(
					'rounded-md border border-slate-300 px-2 py-1 text-xs font-medium',
					'hover:bg-slate-50'
				)}
			>
				Actions
			</button>

			{open && (
				<>
					{/* Backdrop to close menu on outside click */}
					<div className="fixed inset-0 z-10" aria-hidden="true" onClick={() => setOpen(false)} />
					<div
						role="menu"
						className={cn(
							'absolute right-0 z-20 mt-1 w-44 rounded-md border bg-white py-1 shadow-lg',
							'text-sm'
						)}
					>
						<button
							type="button"
							role="menuitem"
							className="block w-full px-4 py-2 text-left hover:bg-slate-50"
							onClick={() => {
								setOpen(false);
								onViewDetails(version);
							}}
						>
							View Details
						</button>
						<button
							type="button"
							role="menuitem"
							className="block w-full px-4 py-2 text-left hover:bg-slate-50"
							onClick={() => {
								setOpen(false);
								onClone(version);
							}}
						>
							Clone
						</button>
						{canPublish && (
							<button
								type="button"
								role="menuitem"
								className="block w-full px-4 py-2 text-left text-blue-700 hover:bg-blue-50"
								onClick={() => {
									setOpen(false);
									onPublish(version);
								}}
							>
								Publish
							</button>
						)}
						{canLock && (
							<button
								type="button"
								role="menuitem"
								className="block w-full px-4 py-2 text-left text-violet-700 hover:bg-violet-50"
								onClick={() => {
									setOpen(false);
									onLock(version);
								}}
							>
								Lock
							</button>
						)}
						{canArchive && (
							<button
								type="button"
								role="menuitem"
								className="block w-full px-4 py-2 text-left text-slate-700 hover:bg-slate-50"
								onClick={() => {
									setOpen(false);
									onArchive(version);
								}}
							>
								Archive
							</button>
						)}
						{canRevert && (
							<button
								type="button"
								role="menuitem"
								className="block w-full px-4 py-2 text-left text-amber-700 hover:bg-amber-50"
								onClick={() => {
									setOpen(false);
									onRevert(version);
								}}
							>
								Revert to Draft
							</button>
						)}
						{canDelete && (
							<button
								type="button"
								role="menuitem"
								className="block w-full px-4 py-2 text-left text-red-600 hover:bg-red-50"
								onClick={() => {
									setOpen(false);
									onDelete(version);
								}}
							>
								Delete
							</button>
						)}
					</div>
				</>
			)}
		</div>
	);
}

type EmptyStateProps = {
	fiscalYear: number;
};

function EmptyState({ fiscalYear }: EmptyStateProps) {
	return (
		<div className="flex flex-col items-center gap-3 py-4">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="40"
				height="40"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
				className="text-slate-300"
				aria-hidden="true"
			>
				<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
				<path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
				<path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
			</svg>
			<p className="text-sm text-slate-500">No versions for FY{fiscalYear}</p>
		</div>
	);
}
