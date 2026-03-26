import { useCallback, useMemo, useRef, useState } from 'react';
import {
	createColumnHelper,
	getCoreRowModel,
	getSortedRowModel,
	useReactTable,
} from '@tanstack/react-table';
import type { SortingState } from '@tanstack/react-table';
import { Layers, MoreHorizontal, BarChart3 } from 'lucide-react';
import { cn } from '../../lib/cn';
import { useAuthStore } from '../../stores/auth-store';
import { useVersionPageStore } from '../../stores/version-page-store';
import { useVersions } from '../../hooks/use-versions';
import type { BudgetVersion } from '../../hooks/use-versions';
import { formatDate, getCurrentFiscalYear } from '../../lib/format-date';
import { toast } from '../../components/ui/toast-state';
import { ListGrid } from '../../components/data-grid/list-grid';
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
import { Checkbox } from '../../components/ui/checkbox';
import { CreateVersionPanel } from '../../components/versions/create-version-panel';
import { CloneVersionDialog } from '../../components/versions/clone-version-dialog';
import { VersionDetailPanel } from '../../components/versions/version-detail-panel';
import { ComparisonView } from '../../components/versions/comparison-view';
import {
	PublishDialog,
	LockDialog,
	ArchiveDialog,
	RevertDialog,
	DeleteDialog,
} from '../../components/versions/lifecycle-dialogs';

const columnHelper = createColumnHelper<BudgetVersion>();

const STATUS_BADGE_COLORS: Record<BudgetVersion['status'], string> = {
	Draft: 'bg-(--status-draft-bg) text-(--status-draft)',
	Published: 'bg-(--status-published-bg) text-(--status-published)',
	Locked: 'bg-(--status-locked-bg) text-(--status-locked)',
	Archived: 'bg-(--status-archived-bg) text-(--status-archived)',
};

const TYPE_LABELS: Record<BudgetVersion['type'], string> = {
	Budget: 'BUD',
	Forecast: 'FC',
	Actual: 'ACT',
};

const TYPE_DOT_COLORS: Record<BudgetVersion['type'], string> = {
	Budget: 'bg-(--version-budget)',
	Forecast: 'bg-(--version-forecast)',
	Actual: 'bg-(--version-actual)',
};

const CURRENT_FISCAL_YEAR = getCurrentFiscalYear();

export function VersionsPage() {
	const currentUser = useAuthStore((s) => s.user);
	const canCreate = currentUser?.role === 'Admin' || currentUser?.role === 'BudgetOwner';

	// Zustand store for persistent filter state
	const store = useVersionPageStore();
	const {
		fiscalYear,
		setFiscalYear,
		typeFilter,
		setTypeFilter,
		statusFilter,
		setStatusFilter,
		searchQuery,
		setSearchQuery,
		isCompareMode,
		toggleCompareMode,
		compareVersionIds,
		addCompareVersion,
		removeCompareVersion,
		clearCompareVersions,
	} = store;

	// Debounced search
	const [searchInput, setSearchInput] = useState(searchQuery);
	const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const handleSearchChange = useCallback(
		(value: string) => {
			setSearchInput(value);
			if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
			searchTimerRef.current = setTimeout(() => setSearchQuery(value), 300);
		},
		[setSearchQuery]
	);

	const { data, isLoading } = useVersions(
		fiscalYear ?? undefined,
		statusFilter || undefined,
		typeFilter || undefined
	);

	const [sorting, setSorting] = useState<SortingState>([]);

	const filteredRows = useMemo(() => {
		let rows = data?.data ?? [];
		if (searchQuery) {
			const lower = searchQuery.toLowerCase();
			rows = rows.filter((v) => v.name.toLowerCase().includes(lower));
		}
		// Sort by fiscal year descending so groups appear newest-first
		return [...rows].sort((a, b) => b.fiscalYear - a.fiscalYear);
	}, [data, searchQuery]);

	const showSkeleton = isLoading;

	// FY group expandable config — always expanded, acts as visual separator
	const fyExpandable = useMemo(
		() => ({
			groupKey: (row: BudgetVersion) => String(row.fiscalYear),
			isExpanded: () => true,
			onToggle: () => {},
			renderExpanded: () => null,
			groupLabel: (key: string) => `FY ${key}`,
			groupCount: (key: string) => filteredRows.filter((v) => String(v.fiscalYear) === key).length,
		}),
		[filteredRows]
	);

	// Fiscal year options
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
	const [showComparison, setShowComparison] = useState(false);

	const handleCompareToggle = useCallback(() => {
		if (isCompareMode) {
			clearCompareVersions();
			setShowComparison(false);
		} else {
			toggleCompareMode();
		}
	}, [isCompareMode, clearCompareVersions, toggleCompareMode]);

	const handleViewComparison = useCallback(() => {
		setShowComparison(true);
		toggleCompareMode();
	}, [toggleCompareMode]);

	const handleCloseComparison = useCallback(() => {
		setShowComparison(false);
		clearCompareVersions();
	}, [clearCompareVersions]);

	const columns = useMemo(() => {
		const cols = [];

		if (isCompareMode) {
			cols.push(
				columnHelper.display({
					id: 'compare-select',
					header: () => (
						<span className="text-xs text-(--text-muted)">{compareVersionIds.length}/3</span>
					),
					cell: ({ row }) => {
						const id = row.original.id;
						const checked = compareVersionIds.includes(id);
						return (
							<Checkbox
								checked={checked}
								disabled={!checked && compareVersionIds.length >= 3}
								onCheckedChange={() => (checked ? removeCompareVersion(id) : addCompareVersion(id))}
								aria-label={`Select ${row.original.name} for comparison`}
							/>
						);
					},
					size: 48,
				})
			);
		}

		cols.push(
			columnHelper.accessor('name', {
				header: 'Name',
				cell: ({ row, getValue }) => (
					<button
						type="button"
						className="font-medium text-(--accent-700) hover:underline"
						onClick={() => setDetailVersion(row.original)}
					>
						{getValue()}
					</button>
				),
			}),
			columnHelper.accessor('fiscalYear', {
				header: 'Fiscal Year',
				cell: (info) => (
					<span className="inline-flex rounded-sm bg-(--workspace-bg-subtle) px-2 py-0.5 text-xs font-medium text-(--text-secondary)">
						FY{info.getValue()}
					</span>
				),
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
								'inline-flex rounded-(--radius-sm) px-2 py-0.5 text-xs font-medium',
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
				cell: (info) => {
					const val = info.getValue();
					return (
						<span className="text-xs text-(--text-secondary)">
							{val === 'CALCULATED' ? 'CALC' : val === 'IMPORTED' ? 'IMPORT' : val}
						</span>
					);
				},
			}),
			columnHelper.display({
				id: 'created',
				header: 'Created',
				cell: ({ row }) => {
					const v = row.original;
					const email = v.createdByEmail ?? '\u2014';
					const short = email.split('@')[0];
					return (
						<span className="text-xs text-(--text-secondary)">
							{short} / {formatDate(v.createdAt)?.replace(/\s\d{4}$/, '')}
						</span>
					);
				},
			}),
			columnHelper.display({
				id: 'staleModules',
				header: 'Stale',
				cell: ({ row }) => {
					const stale = row.original.staleModules;
					if (!stale || stale.length === 0) return null;
					return (
						<button
							type="button"
							className="inline-flex cursor-pointer rounded-sm bg-(--color-warning-bg) px-2 py-0.5 text-xs font-medium text-(--color-warning) hover:opacity-80"
							title={stale.join(', ')}
							aria-label={`Stale modules: ${stale.join(', ')}`}
							onClick={() => setDetailVersion(row.original)}
						>
							{stale.length} stale
						</button>
					);
				},
			}),
			columnHelper.display({
				id: 'actions',
				header: '',
				cell: ({ row }) => (
					<VersionActions
						version={row.original}
						onViewDetails={setDetailVersion}
						onClone={setCloneSource}
						onPublish={setPublishTarget}
						onLock={setLockTarget}
						onArchive={setArchiveTarget}
						onRevert={setRevertTarget}
						onDelete={setDeleteTarget}
					/>
				),
			})
		);

		return cols;
	}, [isCompareMode, compareVersionIds, addCompareVersion, removeCompareVersion, setDetailVersion]);

	const table = useReactTable({
		data: filteredRows,
		columns,
		state: { sorting },
		onSortingChange: setSorting,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
	});

	return (
		<div className="p-6">
			{/* Toolbar */}
			<div className="flex flex-wrap items-center gap-3 pb-4">
				<h1 className="mr-auto text-(--text-xl) font-semibold">Version Management</h1>

				<Button variant={isCompareMode ? 'primary' : 'secondary'} onClick={handleCompareToggle}>
					<BarChart3 className="mr-1.5 h-4 w-4" aria-hidden="true" />
					{isCompareMode ? 'Cancel' : 'Compare'}
				</Button>

				{canCreate && (
					<Button variant="primary" onClick={() => setCreateOpen(true)}>
						+ Add Version
					</Button>
				)}
			</div>

			{/* Inline filter bar */}
			<div className="flex flex-wrap items-center gap-3 border-b pb-4">
				<Select
					value={fiscalYear === null ? 'all' : String(fiscalYear)}
					onValueChange={(v) => setFiscalYear(v === 'all' ? null : Number(v))}
				>
					<SelectTrigger className="w-[130px]" aria-label="Filter by fiscal year">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Years</SelectItem>
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
						<SelectItem value="Budget">
							<span className="inline-flex items-center gap-1.5">
								<span className="h-2 w-2 rounded-full bg-(--version-budget)" aria-hidden="true" />
								Budget
							</span>
						</SelectItem>
						<SelectItem value="Forecast">
							<span className="inline-flex items-center gap-1.5">
								<span className="h-2 w-2 rounded-full bg-(--version-forecast)" aria-hidden="true" />
								Forecast
							</span>
						</SelectItem>
						<SelectItem value="Actual">
							<span className="inline-flex items-center gap-1.5">
								<span className="h-2 w-2 rounded-full bg-(--version-actual)" aria-hidden="true" />
								Actual
							</span>
						</SelectItem>
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

				<Input
					type="search"
					placeholder="Search versions..."
					value={searchInput}
					onChange={(e) => handleSearchChange(e.target.value)}
					className="w-[240px]"
					aria-label="Search versions"
				/>
			</div>

			{/* Compare mode indicator */}
			{isCompareMode && (
				<div className="mt-3 flex items-center gap-3 rounded-lg border border-(--accent-200) bg-(--accent-50) px-4 py-2">
					<span className="text-sm text-(--accent-700)">
						Select 2-3 versions to compare ({compareVersionIds.length} of 3 selected)
					</span>
					{compareVersionIds.length >= 2 && (
						<Button variant="primary" size="sm" onClick={handleViewComparison}>
							View Comparison
						</Button>
					)}
				</div>
			)}

			{/* Data table */}
			<div className="mt-4">
				<ListGrid
					table={table}
					isLoading={showSkeleton}
					sortable
					expandable={fyExpandable}
					emptyState={
						<EmptyState
							fiscalYear={fiscalYear}
							typeFilter={typeFilter}
							statusFilter={statusFilter}
							searchQuery={searchQuery}
							canCreate={!!canCreate}
							onCreateClick={() => setCreateOpen(true)}
						/>
					}
					ariaLabel="Budget versions"
				/>
			</div>

			{/* Comparison View */}
			{showComparison && compareVersionIds.length >= 2 && (
				<ComparisonView versionIds={compareVersionIds} onClose={handleCloseComparison} />
			)}

			{/* Create Version Panel */}
			<CreateVersionPanel
				open={createOpen}
				fiscalYear={fiscalYear ?? CURRENT_FISCAL_YEAR}
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
				currentUserRole={currentUser?.role}
				onPublish={setPublishTarget}
				onLock={setLockTarget}
				onArchive={setArchiveTarget}
				onRevert={setRevertTarget}
				onDelete={setDeleteTarget}
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
	const canLock = isAdmin && version.status === 'Published';
	const canArchive = isAdmin && version.status === 'Locked';
	const canRevert = isAdmin && (version.status === 'Published' || version.status === 'Locked');
	const canDelete = isMutator && version.status === 'Draft';
	const canClone = isMutator && version.type !== 'Actual';

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-(--workspace-bg-muted)"
					aria-label={`Actions for ${version.name}`}
					aria-haspopup="menu"
				>
					<MoreHorizontal className="h-4 w-4 text-(--text-muted)" />
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

function EmptyState({
	fiscalYear,
	typeFilter,
	statusFilter,
	searchQuery,
	canCreate,
	onCreateClick,
}: {
	fiscalYear: number | null;
	typeFilter: string;
	statusFilter: string;
	searchQuery: string;
	canCreate: boolean;
	onCreateClick: () => void;
}) {
	const hasFilters = typeFilter || statusFilter || searchQuery;
	const fyLabel = fiscalYear ? `FY${fiscalYear}` : 'any year';

	return (
		<div className="flex flex-col items-center gap-3 py-4">
			<Layers className="h-10 w-10 text-(--accent-400)" strokeWidth={1.5} aria-hidden="true" />
			{hasFilters ? (
				<>
					<p className="text-(--text-sm) font-medium text-(--text-primary)">
						No versions match your filters
					</p>
					<p className="text-(--text-sm) text-(--text-secondary)">
						Try adjusting your filters or search query.
					</p>
				</>
			) : (
				<>
					<p className="text-(--text-sm) font-medium text-(--text-primary)">
						No versions for {fyLabel}
					</p>
					<p className="text-(--text-sm) text-(--text-secondary)">
						Create your first budget version to get started.
					</p>
					{canCreate && (
						<Button variant="primary" onClick={onCreateClick}>
							+ Create Version
						</Button>
					)}
				</>
			)}
		</div>
	);
}
