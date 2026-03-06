import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	createColumnHelper,
	flexRender,
	getCoreRowModel,
	useReactTable,
} from '@tanstack/react-table';
import { MoreHorizontal } from 'lucide-react';
import { cn } from '../../lib/cn';
import { useAuthStore } from '../../stores/auth-store';
import { useVersions } from '../../hooks/use-versions';
import type { BudgetVersion } from '../../hooks/use-versions';
import { formatDate } from '../../lib/format-date';
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
	Draft: 'bg-slate-100 text-slate-700',
	Published: 'bg-blue-100 text-blue-800',
	Locked: 'bg-violet-100 text-violet-800',
	Archived: 'bg-slate-100 text-slate-500',
};

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
	const canCreate = currentUser?.role === 'Admin' || currentUser?.role === 'BudgetOwner';

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

				<Select value={typeFilter} onValueChange={setTypeFilter}>
					<SelectTrigger className="w-[140px]" aria-label="Filter by type">
						<SelectValue placeholder="All Types" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="">All Types</SelectItem>
						<SelectItem value="Budget">Budget</SelectItem>
						<SelectItem value="Forecast">Forecast</SelectItem>
						<SelectItem value="Actual">Actual</SelectItem>
					</SelectContent>
				</Select>

				<Select value={statusFilter} onValueChange={setStatusFilter}>
					<SelectTrigger className="w-[150px]" aria-label="Filter by status">
						<SelectValue placeholder="All Statuses" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="">All Statuses</SelectItem>
						<SelectItem value="Draft">Draft</SelectItem>
						<SelectItem value="Published">Published</SelectItem>
						<SelectItem value="Locked">Locked</SelectItem>
						<SelectItem value="Archived">Archived</SelectItem>
					</SelectContent>
				</Select>

				<Button variant="outline" onClick={() => setCompareOpen(true)}>
					Compare
				</Button>

				{canCreate && <Button onClick={() => setCreateOpen(true)}>+ New Version</Button>}
			</div>

			{/* Data table */}
			<div className="overflow-x-auto rounded-lg border">
				<table role="table" className="w-full text-left text-sm">
					<thead className="border-b bg-slate-50">
						{table.getHeaderGroups().map((hg) => (
							<tr key={hg.id}>
								{hg.headers.map((header) => (
									<th key={header.id} className="px-4 py-3 font-medium text-slate-600">
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
									className="px-4 py-12 text-center text-sm text-slate-500"
								>
									<EmptyState fiscalYear={fiscalYear} />
								</td>
							</tr>
						) : (
							table.getRowModel().rows.map((row) => (
								<tr key={row.id} className="border-b last:border-0 hover:bg-slate-50">
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
	const canArchive = isMutator && version.status === 'Locked';
	const canRevert = isAdmin && (version.status === 'Published' || version.status === 'Locked');
	const canDelete = isMutator && version.status === 'Draft';

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100"
					aria-label={`Actions for ${version.name}`}
				>
					<MoreHorizontal className="h-4 w-4 text-slate-500" />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuItem onSelect={() => onViewDetails(version)}>View Details</DropdownMenuItem>
				<DropdownMenuItem onSelect={() => onClone(version)}>Clone</DropdownMenuItem>
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
