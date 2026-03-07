import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	createColumnHelper,
	flexRender,
	getCoreRowModel,
	useReactTable,
} from '@tanstack/react-table';
import { Layers, MoreHorizontal } from 'lucide-react';
import { cn } from '../../lib/cn';
import { useAuthStore } from '../../stores/auth-store';
import { useVersions } from '../../hooks/use-versions';
import type { BudgetVersion } from '../../hooks/use-versions';
import { formatDate, getCurrentFiscalYear } from '../../lib/format-date';
import { toast } from '../../components/ui/toast-state';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
	Select,
	SelectTrigger,
	SelectValue,
	SelectContent,
	SelectItem,
} from '../../components/ui/select';
import {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
} from '../../components/ui/dropdown-menu';
import { TableSkeleton } from '../../components/ui/skeleton';
import { CreateVersionPanel } from '../../components/versions/create-version-panel';
import { CloneVersionDialog } from '../../components/versions/clone-version-dialog';
import { CompareDialog } from '../../components/versions/compare-dialog';
import { VersionDetailPanel } from '../../components/versions/version-detail-panel';
import {
	PublishDialog,
	LockDialog,
	ArchiveDialog,
	RevertDialog,
	DeleteDialog,
} from '../../components/versions/lifecycle-dialogs';

const columnHelper = createColumnHelper<BudgetVersion>();

const STATUS_BADGE_COLORS: Record<BudgetVersion['status'], string> = {
	Draft: 'bg-[color-mix(in_srgb,var(--status-draft)_15%,white)] text-[var(--status-draft)]',
	Published: 'bg-[var(--version-budget-bg)] text-[var(--status-published)]',
	Locked: 'bg-[color-mix(in_srgb,var(--status-locked)_15%,white)] text-[var(--status-locked)]',
	Archived:
		'bg-[color-mix(in_srgb,var(--status-archived)_15%,white)] text-[var(--status-archived)]',
};

const TYPE_LABELS: Record<BudgetVersion['type'], string> = {
	Budget: 'BUD',
	Forecast: 'FC',
	Actual: 'ACT',
};

const TYPE_DOT_COLORS: Record<BudgetVersion['type'], string> = {
	Budget: 'bg-[var(--version-budget)]',
	Forecast: 'bg-[var(--version-forecast)]',
	Actual: 'bg-[var(--version-actual)]',
};

const CURRENT_FISCAL_YEAR = getCurrentFiscalYear();

export function VersionsPage() {
	const currentUser = useAuthStore((s) => s.user);
	const canCreate = currentUser?.role === 'Admin' || currentUser?.role === 'BudgetOwner';

	// Filters
	const [fiscalYear, setFiscalYear] = useState<number>(CURRENT_FISCAL_YEAR);
	const [typeFilter, setTypeFilter] = useState('');
	const [statusFilter, setStatusFilter] = useState('');
	const [searchInput, setSearchInput] = useState('');
	const [searchDebounced, setSearchDebounced] = useState('');
	const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const handleSearchChange = useCallback((value: string) => {
		setSearchInput(value);
		if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
		searchTimerRef.current = setTimeout(() => setSearchDebounced(value), 300);
	}, []);

	const { data, isLoading } = useVersions(fiscalYear, statusFilter || undefined);

	const filteredRows = useMemo(() => {
		let rows = data?.data ?? [];
		if (typeFilter) {
			rows = rows.filter((v) => v.type === typeFilter);
		}
		if (searchDebounced) {
			const lower = searchDebounced.toLowerCase();
			rows = rows.filter((v) => v.name.toLowerCase().includes(lower));
		}
		rows = [...rows].sort(
			(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
		);
		return rows;
	}, [data, typeFilter, searchDebounced]);

	// Skeleton with 200ms delay
	const [showSkeleton, setShowSkeleton] = useState(false);
	useEffect(() => {
		if (!isLoading) {
			setShowSkeleton(false);
			return;
		}
		const t = setTimeout(() => setShowSkeleton(true), 200);
		return () => clearTimeout(t);
	}, [isLoading]);

	// Fiscal year options
	const fiscalYearOptions = useMemo(() => {
		const base = CURRENT_FISCAL_YEAR;
		return [base - 2, base - 1, base, base + 1, base + 2];
	}, []);

	// --- Panel / Dialog state ---
	const [createOpen, setCreateOpen] = useState(false);
	const [compareOpen, setCompareOpen] = useState(false);
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
								'inline-flex rounded-[var(--radius-sm)] px-2 py-0.5 text-xs font-medium',
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
				cell: (info) => formatDate(info.getValue()),
			}),
			columnHelper.accessor('modificationCount', {
				header: 'Mods',
				cell: (info) => info.getValue(),
			}),
			columnHelper.accessor('publishedAt', {
				header: 'Published At',
				cell: (info) => {
					const v = info.getValue();
					return v ? formatDate(v) : '\u2014';
				},
			}),
			columnHelper.accessor('lockedAt', {
				header: 'Locked At',
				cell: (info) => {
					const v = info.getValue();
					return v ? formatDate(v) : '\u2014';
				},
			}),
			columnHelper.display({
				id: 'staleModules',
				header: 'Stale',
				cell: ({ row }) => {
					const stale = row.original.staleModules;
					if (!stale || stale.length === 0) return null;
					return (
						<span
							className="inline-flex rounded-[var(--radius-sm)] bg-[var(--color-warning-bg)] px-2 py-0.5 text-xs font-medium text-[var(--color-warning)]"
							title={stale.join(', ')}
							aria-label={`Stale modules: ${stale.join(', ')}`}
						>
							{stale.length} stale
						</span>
					);
				},
			}),
			columnHelper.display({
				id: 'actions',
				header: '',
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
		],
		[]
	);

	const table = useReactTable({
		data: filteredRows,
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	return (
		<div className="p-6">
			{/* Toolbar */}
			<div className="flex flex-wrap items-center gap-3 pb-4">
				<h1 className="mr-auto text-xl font-semibold">Version Management</h1>

				<Input
					type="search"
					placeholder="Search versions..."
					value={searchInput}
					onChange={(e) => handleSearchChange(e.target.value)}
					className="w-[240px]"
					aria-label="Search versions"
				/>

				<Select value={String(fiscalYear)} onValueChange={(v) => setFiscalYear(Number(v))}>
					<SelectTrigger className="w-[130px]" aria-label="Filter by fiscal year">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{fiscalYearOptions.map((fy) => (
							<SelectItem key={fy} value={String(fy)}>
								FY {fy}
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				<Select
					value={typeFilter || 'all'}
					onValueChange={(v) => setTypeFilter(v === 'all' ? '' : v)}
				>
					<SelectTrigger className="w-[140px]" aria-label="Filter by type">
						<SelectValue placeholder="All Types" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Types</SelectItem>
						<SelectItem value="Budget">Budget</SelectItem>
						<SelectItem value="Forecast">Forecast</SelectItem>
						<SelectItem value="Actual">Actual</SelectItem>
					</SelectContent>
				</Select>

				<Select
					value={statusFilter || 'all'}
					onValueChange={(v) => setStatusFilter(v === 'all' ? '' : v)}
				>
					<SelectTrigger className="w-[150px]" aria-label="Filter by status">
						<SelectValue placeholder="All Statuses" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Statuses</SelectItem>
						<SelectItem value="Draft">Draft</SelectItem>
						<SelectItem value="Published">Published</SelectItem>
						<SelectItem value="Locked">Locked</SelectItem>
						<SelectItem value="Archived">Archived</SelectItem>
					</SelectContent>
				</Select>

				<Button variant="secondary" onClick={() => setCompareOpen(true)}>
					Compare
				</Button>

				{canCreate && (
					<Button variant="primary" onClick={() => setCreateOpen(true)}>
						+ New Version
					</Button>
				)}
			</div>

			{/* Data table */}
			<div className="overflow-x-auto rounded-lg border">
				<table role="table" className="w-full text-left text-sm">
					<thead className="border-b bg-[var(--workspace-bg-subtle)]">
						{table.getHeaderGroups().map((hg) => (
							<tr key={hg.id}>
								{hg.headers.map((header) => (
									<th
										key={header.id}
										className="px-4 py-3 font-medium text-[var(--text-secondary)]"
									>
										{flexRender(header.column.columnDef.header, header.getContext())}
									</th>
								))}
							</tr>
						))}
					</thead>
					<tbody>
						{isLoading && showSkeleton ? (
							<TableSkeleton rows={10} cols={columns.length} />
						) : table.getRowModel().rows.length === 0 ? (
							<tr>
								<td
									colSpan={columns.length}
									className="px-4 py-12 text-center text-sm text-[var(--text-muted)]"
								>
									<EmptyState fiscalYear={fiscalYear} />
								</td>
							</tr>
						) : (
							table.getRowModel().rows.map((row) => (
								<tr
									key={row.id}
									className="border-b last:border-0 hover:bg-[var(--workspace-bg-subtle)]"
								>
									{row.getVisibleCells().map((cell) => (
										<td key={cell.id} role="cell" className="px-4 py-3">
											{flexRender(cell.column.columnDef.cell, cell.getContext())}
										</td>
									))}
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>

			{/* Create Version Panel */}
			<CreateVersionPanel
				open={createOpen}
				fiscalYear={fiscalYear}
				onClose={() => setCreateOpen(false)}
				onSuccess={(name) => {
					setCreateOpen(false);
					toast.success(`Version "${name}" created successfully.`);
				}}
			/>

			{/* Clone Version Dialog */}
			<CloneVersionDialog
				open={cloneSource !== null}
				source={cloneSource}
				onClose={() => setCloneSource(null)}
				onSuccess={(clonedName, sourceName) => {
					setCloneSource(null);
					toast.success(`"${clonedName}" cloned from "${sourceName}" successfully.`);
				}}
			/>

			{/* Version Detail Panel */}
			<VersionDetailPanel
				open={detailVersion !== null}
				version={detailVersion}
				onClose={() => setDetailVersion(null)}
			/>

			{/* Lifecycle Dialogs */}
			<PublishDialog
				open={publishTarget !== null}
				version={publishTarget}
				onClose={() => setPublishTarget(null)}
				onSuccess={() => {
					toast.success(`"${publishTarget?.name}" published successfully.`);
					setPublishTarget(null);
				}}
			/>
			<LockDialog
				open={lockTarget !== null}
				version={lockTarget}
				onClose={() => setLockTarget(null)}
				onSuccess={() => {
					toast.success(`"${lockTarget?.name}" locked successfully.`);
					setLockTarget(null);
				}}
			/>
			<ArchiveDialog
				open={archiveTarget !== null}
				version={archiveTarget}
				onClose={() => setArchiveTarget(null)}
				onSuccess={() => {
					toast.success(`"${archiveTarget?.name}" archived successfully.`);
					setArchiveTarget(null);
				}}
			/>
			<RevertDialog
				open={revertTarget !== null}
				version={revertTarget}
				onClose={() => setRevertTarget(null)}
				onSuccess={() => {
					toast.success(`"${revertTarget?.name}" reverted to Draft.`);
					setRevertTarget(null);
				}}
			/>
			<DeleteDialog
				open={deleteTarget !== null}
				version={deleteTarget}
				onClose={() => setDeleteTarget(null)}
				onSuccess={() => {
					toast.success(`"${deleteTarget?.name}" deleted successfully.`);
					setDeleteTarget(null);
				}}
			/>

			{/* Compare Dialog */}
			<CompareDialog
				open={compareOpen}
				fiscalYear={fiscalYear}
				onClose={() => setCompareOpen(false)}
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
	const currentUser = useAuthStore((s) => s.user);
	const isAdmin = currentUser?.role === 'Admin';
	const isMutator = isAdmin || currentUser?.role === 'BudgetOwner';

	const canPublish = isMutator && version.status === 'Draft';
	const canLock = isMutator && version.status === 'Published';
	const canArchive = isAdmin && version.status === 'Locked';
	const canRevert = isAdmin && (version.status === 'Published' || version.status === 'Locked');
	const canDelete = isMutator && version.status === 'Draft';
	const canClone = version.type !== 'Actual';

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] hover:bg-[var(--workspace-bg-muted)]"
					aria-label={`Actions for ${version.name}`}
				>
					<MoreHorizontal className="h-4 w-4 text-[var(--text-muted)]" />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuItem onSelect={() => onViewDetails(version)}>View Details</DropdownMenuItem>
				<DropdownMenuItem
					disabled={!canClone}
					onSelect={() => {
						if (canClone) onClone(version);
					}}
				>
					{canClone ? 'Clone' : 'Clone (N/A for Actual)'}
				</DropdownMenuItem>
				{(canPublish || canLock || canArchive || canRevert) && <DropdownMenuSeparator />}
				{canPublish && (
					<DropdownMenuItem onSelect={() => onPublish(version)}>Publish</DropdownMenuItem>
				)}
				{canLock && <DropdownMenuItem onSelect={() => onLock(version)}>Lock</DropdownMenuItem>}
				{canArchive && (
					<DropdownMenuItem onSelect={() => onArchive(version)}>Archive</DropdownMenuItem>
				)}
				{canRevert && (
					<DropdownMenuItem onSelect={() => onRevert(version)}>Revert to Draft</DropdownMenuItem>
				)}
				{canDelete && (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuItem destructive onSelect={() => onDelete(version)}>
							Delete
						</DropdownMenuItem>
					</>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function EmptyState({ fiscalYear }: { fiscalYear: number }) {
	return (
		<div className="flex flex-col items-center gap-3 py-4">
			<Layers className="h-10 w-10 text-[var(--accent-400)]" strokeWidth={1.5} aria-hidden="true" />
			<p className="text-[length:var(--text-sm)] font-medium text-[var(--text-primary)]">
				No versions for FY{fiscalYear}
			</p>
			<p className="text-[length:var(--text-sm)] text-[var(--text-secondary)]">
				Create your first budget version to get started.
			</p>
		</div>
	);
}
