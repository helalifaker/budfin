import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useDelayedSkeleton } from '../../hooks/use-delayed-skeleton';
import type { Table as TanstackTable } from '@tanstack/react-table';
import {
	createColumnHelper,
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	useReactTable,
} from '@tanstack/react-table';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { cn } from '../../lib/cn';
import { useAuthStore } from '../../stores/auth-store';
import {
	useNationalities,
	useCreateNationality,
	useUpdateNationality,
	useDeleteNationality,
	useTariffs,
	useCreateTariff,
	useUpdateTariff,
	useDeleteTariff,
	useDepartments,
	useCreateDepartment,
	useUpdateDepartment,
	useDeleteDepartment,
} from '../../hooks/use-reference-data';
import type { Nationality, Tariff, Department, BandMapping } from '../../hooks/use-reference-data';
import { NationalitySidePanel } from '../../components/master-data/nationality-side-panel';
import { TariffSidePanel } from '../../components/master-data/tariff-side-panel';
import { DepartmentSidePanel } from '../../components/master-data/department-side-panel';
import { CurriculumTabContent } from '../../components/master-data/curriculum-tab-content';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogAction,
	AlertDialogCancel,
} from '../../components/ui/alert-dialog';
import {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
} from '../../components/ui/dropdown-menu';
import { TableSkeleton } from '../../components/ui/skeleton';
import { toast } from '../../components/ui/toast-state';

// --- Delete Confirmation Dialog ---

type DeleteDialogProps = {
	open: boolean;
	entityCode: string;
	entityType: string;
	onConfirm: () => void;
	onCancel: () => void;
	loading: boolean;
};

function DeleteConfirmDialog({
	open,
	entityCode,
	entityType,
	onConfirm,
	onCancel,
	loading,
}: DeleteDialogProps) {
	const [confirmText, setConfirmText] = useState('');

	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect -- reset form state when dialog opens; sync with prop is intentional
		if (open) setConfirmText('');
	}, [open]);

	return (
		<AlertDialog open={open} onOpenChange={(v) => !v && onCancel()}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle className="text-(--color-error)">Delete {entityType}</AlertDialogTitle>
					<AlertDialogDescription>
						This action cannot be undone. Type <strong className="font-mono">{entityCode}</strong>{' '}
						to confirm deletion.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<div className="mt-2">
					<label htmlFor="delete-confirm" className="sr-only">
						Type code to confirm
					</label>
					<Input
						id="delete-confirm"
						type="text"
						value={confirmText}
						onChange={(e) => setConfirmText(e.target.value)}
						placeholder={entityCode}
						className="font-mono"
					/>
				</div>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
					<AlertDialogAction
						className="bg-(--color-error) hover:bg-[color-mix(in_srgb,var(--color-error),black_15%)]"
						disabled={confirmText !== entityCode || loading}
						onClick={onConfirm}
					>
						{loading ? 'Deleting...' : 'Delete'}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

// --- Band Mapping Badge ---

const BAND_COLORS: Record<BandMapping, string> = {
	MATERNELLE: 'bg-(--badge-maternelle-bg) text-(--badge-maternelle)',
	ELEMENTAIRE: 'bg-(--badge-elementaire-bg) text-(--badge-elementaire)',
	COLLEGE: 'bg-(--badge-college-bg) text-(--badge-college)',
	LYCEE: 'bg-(--badge-lycee-bg) text-(--badge-lycee)',
	NON_ACADEMIC: 'bg-(--workspace-bg-muted) text-(--text-primary)',
};

function BandBadge({ band }: { band: BandMapping }) {
	return (
		<span
			className={cn(
				'inline-block rounded-sm px-2 py-0.5 text-(--text-xs) font-medium',
				BAND_COLORS[band]
			)}
		>
			{band.replace('_', ' ')}
		</span>
	);
}

// --- Tab definitions ---

type TabKey = 'nationalities' | 'tariffs' | 'departments' | 'curriculum';

const TABS: { key: TabKey; label: string }[] = [
	{ key: 'nationalities', label: 'Nationalities' },
	{ key: 'tariffs', label: 'Tariffs' },
	{ key: 'departments', label: 'Departments' },
	{ key: 'curriculum', label: 'Curriculum' },
];

// --- Column helpers ---

const natColumnHelper = createColumnHelper<Nationality>();
const tariffColumnHelper = createColumnHelper<Tariff>();
const deptColumnHelper = createColumnHelper<Department>();

// --- Generic Data Grid ---

function DataGrid<T>({
	table,
	isLoading,
	showSkeleton,
}: {
	table: TanstackTable<T>;
	isLoading: boolean;
	showSkeleton: boolean;
}) {
	return (
		<div className="overflow-x-auto rounded-lg border">
			<table role="table" className="w-full text-left text-(--text-sm)">
				<thead className="border-b bg-(--workspace-bg-muted)">
					{table.getHeaderGroups().map((hg) => (
						<tr key={hg.id}>
							{hg.headers.map((header) => (
								<th key={header.id} className="px-4 py-3 font-medium text-(--text-secondary)">
									{flexRender(header.column.columnDef.header, header.getContext())}
								</th>
							))}
						</tr>
					))}
				</thead>
				<tbody>
					{isLoading && showSkeleton ? (
						<TableSkeleton rows={10} cols={table.getAllColumns().length} />
					) : table.getRowModel().rows.length === 0 ? (
						<tr>
							<td
								colSpan={table.getAllColumns().length}
								className="px-4 py-8 text-center text-(--text-sm) text-(--text-muted)"
							>
								No records found.
							</td>
						</tr>
					) : (
						table.getRowModel().rows.map((row) => (
							<tr
								key={row.id}
								className="border-b last:border-0 hover:bg-(--accent-50) transition-colors duration-(--duration-fast)"
							>
								{row.getVisibleCells().map((cell) => (
									<td key={cell.id} className="px-4 py-3">
										{flexRender(cell.column.columnDef.cell, cell.getContext())}
									</td>
								))}
							</tr>
						))
					)}
				</tbody>
			</table>
		</div>
	);
}

// --- Main Page ---

export function ReferencePage() {
	const currentUser = useAuthStore((s) => s.user);
	const isAdmin = currentUser?.role === 'Admin';
	const [searchParams, setSearchParams] = useSearchParams();
	const initialTab = TABS.some((t) => t.key === searchParams.get('tab'))
		? (searchParams.get('tab') as TabKey)
		: 'nationalities';
	const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
	const [search, setSearch] = useState('');

	// Panel state (for non-curriculum tabs)
	const [panelOpen, setPanelOpen] = useState(false);
	const [editingNationality, setEditingNationality] = useState<Nationality | null>(null);
	const [editingTariff, setEditingTariff] = useState<Tariff | null>(null);
	const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);

	// Delete state (for non-curriculum tabs)
	const [deleteTarget, setDeleteTarget] = useState<{
		type: string;
		code: string;
		id: number;
	} | null>(null);

	// Reset search when switching tabs
	useEffect(() => {
		setSearch('');
	}, [activeTab]);

	// --- Nationalities ---
	const { data: nationalities = [], isLoading: natLoading } = useNationalities();
	const createNat = useCreateNationality();
	const updateNat = useUpdateNationality();
	const deleteNat = useDeleteNationality();

	const natColumns = useMemo(
		() => [
			natColumnHelper.accessor('code', {
				header: 'Code',
				cell: (info) => <span className="font-mono font-medium">{info.getValue()}</span>,
			}),
			natColumnHelper.accessor('label', { header: 'Label' }),
			natColumnHelper.accessor('vatExempt', {
				header: 'VAT Exempt',
				cell: (info) => (
					<span
						className={cn(
							'inline-block rounded-sm px-2 py-0.5 text-(--text-xs) font-medium',
							info.getValue()
								? 'bg-(--color-success-bg) text-(--color-success)'
								: 'bg-(--workspace-bg-muted) text-(--text-secondary)'
						)}
					>
						{info.getValue() ? 'Yes' : 'No'}
					</span>
				),
			}),
			natColumnHelper.display({
				id: 'actions',
				header: 'Actions',
				cell: ({ row }) => {
					if (!isAdmin) return null;
					const item = row.original;
					return (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<button
									type="button"
									className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-(--workspace-bg-muted)"
									aria-label={`Actions for ${item.code}`}
								>
									<MoreHorizontal className="h-4 w-4 text-(--text-muted)" />
								</button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem
									onSelect={() => {
										setEditingNationality(item);
										setPanelOpen(true);
									}}
								>
									<Pencil className="h-4 w-4" /> Edit
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									destructive
									onSelect={() =>
										setDeleteTarget({
											type: 'nationality',
											code: item.code,
											id: item.id,
										})
									}
								>
									<Trash2 className="h-4 w-4" /> Delete
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					);
				},
			}),
		],
		[isAdmin]
	);

	const natTable = useReactTable({
		data: nationalities,
		columns: natColumns,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		state: { globalFilter: search },
		onGlobalFilterChange: setSearch,
	});

	// --- Tariffs ---
	const { data: tariffs = [], isLoading: tariffLoading } = useTariffs();
	const createTariff = useCreateTariff();
	const updateTariff = useUpdateTariff();
	const deleteTariff = useDeleteTariff();

	const tariffColumns = useMemo(
		() => [
			tariffColumnHelper.accessor('code', {
				header: 'Code',
				cell: (info) => <span className="font-mono font-medium">{info.getValue()}</span>,
			}),
			tariffColumnHelper.accessor('label', { header: 'Label' }),
			tariffColumnHelper.accessor('description', {
				header: 'Description',
				cell: (info) => info.getValue() ?? '-',
			}),
			tariffColumnHelper.display({
				id: 'actions',
				header: 'Actions',
				cell: ({ row }) => {
					if (!isAdmin) return null;
					const item = row.original;
					return (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<button
									type="button"
									className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-(--workspace-bg-muted)"
									aria-label={`Actions for ${item.code}`}
								>
									<MoreHorizontal className="h-4 w-4 text-(--text-muted)" />
								</button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem
									onSelect={() => {
										setEditingTariff(item);
										setPanelOpen(true);
									}}
								>
									<Pencil className="h-4 w-4" /> Edit
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									destructive
									onSelect={() =>
										setDeleteTarget({
											type: 'tariff',
											code: item.code,
											id: item.id,
										})
									}
								>
									<Trash2 className="h-4 w-4" /> Delete
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					);
				},
			}),
		],
		[isAdmin]
	);

	const tariffTable = useReactTable({
		data: tariffs,
		columns: tariffColumns,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		state: { globalFilter: search },
		onGlobalFilterChange: setSearch,
	});

	// --- Departments ---
	const { data: departments = [], isLoading: deptLoading } = useDepartments();
	const createDept = useCreateDepartment();
	const updateDept = useUpdateDepartment();
	const deleteDept = useDeleteDepartment();

	const deptColumns = useMemo(
		() => [
			deptColumnHelper.accessor('code', {
				header: 'Code',
				cell: (info) => <span className="font-mono font-medium">{info.getValue()}</span>,
			}),
			deptColumnHelper.accessor('label', { header: 'Label' }),
			deptColumnHelper.accessor('bandMapping', {
				header: 'Band Mapping',
				cell: (info) => <BandBadge band={info.getValue()} />,
			}),
			deptColumnHelper.display({
				id: 'actions',
				header: 'Actions',
				cell: ({ row }) => {
					if (!isAdmin) return null;
					const item = row.original;
					return (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<button
									type="button"
									className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-(--workspace-bg-muted)"
									aria-label={`Actions for ${item.code}`}
								>
									<MoreHorizontal className="h-4 w-4 text-(--text-muted)" />
								</button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem
									onSelect={() => {
										setEditingDepartment(item);
										setPanelOpen(true);
									}}
								>
									<Pencil className="h-4 w-4" /> Edit
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									destructive
									onSelect={() =>
										setDeleteTarget({
											type: 'department',
											code: item.code,
											id: item.id,
										})
									}
								>
									<Trash2 className="h-4 w-4" /> Delete
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					);
				},
			}),
		],
		[isAdmin]
	);

	const deptTable = useReactTable({
		data: departments,
		columns: deptColumns,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		state: { globalFilter: search },
		onGlobalFilterChange: setSearch,
	});

	// --- Handlers ---

	const handleAddNew = useCallback(() => {
		setEditingNationality(null);
		setEditingTariff(null);
		setEditingDepartment(null);
		setPanelOpen(true);
	}, []);

	const handleClosePanel = useCallback(() => {
		setPanelOpen(false);
		setEditingNationality(null);
		setEditingTariff(null);
		setEditingDepartment(null);
	}, []);

	const handleNationalitySave = useCallback(
		(data: { code: string; label: string; vatExempt: boolean }) => {
			if (editingNationality) {
				updateNat.mutate(
					{
						id: editingNationality.id,
						version: editingNationality.version,
						...data,
					},
					{
						onSuccess: () => {
							handleClosePanel();
							toast.success('Nationality updated successfully');
						},
						onError: () => {
							toast.error('Failed to update nationality');
						},
					}
				);
			} else {
				createNat.mutate(data, {
					onSuccess: () => {
						handleClosePanel();
						toast.success('Nationality created successfully');
					},
					onError: () => {
						toast.error('Failed to create nationality');
					},
				});
			}
		},
		[editingNationality, createNat, updateNat, handleClosePanel]
	);

	const handleTariffSave = useCallback(
		(data: { code: string; label: string; description?: string | undefined }) => {
			if (editingTariff) {
				updateTariff.mutate(
					{
						id: editingTariff.id,
						version: editingTariff.version,
						...data,
					},
					{
						onSuccess: () => {
							handleClosePanel();
							toast.success('Tariff updated successfully');
						},
						onError: () => {
							toast.error('Failed to update tariff');
						},
					}
				);
			} else {
				createTariff.mutate(data, {
					onSuccess: () => {
						handleClosePanel();
						toast.success('Tariff created successfully');
					},
					onError: () => {
						toast.error('Failed to create tariff');
					},
				});
			}
		},
		[editingTariff, createTariff, updateTariff, handleClosePanel]
	);

	const handleDepartmentSave = useCallback(
		(data: { code: string; label: string; bandMapping: BandMapping }) => {
			if (editingDepartment) {
				updateDept.mutate(
					{
						id: editingDepartment.id,
						version: editingDepartment.version,
						...data,
					},
					{
						onSuccess: () => {
							handleClosePanel();
							toast.success('Department updated successfully');
						},
						onError: () => {
							toast.error('Failed to update department');
						},
					}
				);
			} else {
				createDept.mutate(data, {
					onSuccess: () => {
						handleClosePanel();
						toast.success('Department created successfully');
					},
					onError: () => {
						toast.error('Failed to create department');
					},
				});
			}
		},
		[editingDepartment, createDept, updateDept, handleClosePanel]
	);

	const handleDeleteConfirm = useCallback(() => {
		if (!deleteTarget) return;
		const onSuccess = () => {
			setDeleteTarget(null);
			toast.success(
				`${deleteTarget.type.charAt(0).toUpperCase() + deleteTarget.type.slice(1)} deleted successfully`
			);
		};
		const onError = () => {
			toast.error(`Failed to delete ${deleteTarget.type}`);
		};
		if (deleteTarget.type === 'nationality') {
			deleteNat.mutate(deleteTarget.id, { onSuccess, onError });
		} else if (deleteTarget.type === 'tariff') {
			deleteTariff.mutate(deleteTarget.id, { onSuccess, onError });
		} else if (deleteTarget.type === 'department') {
			deleteDept.mutate(deleteTarget.id, { onSuccess, onError });
		}
	}, [deleteTarget, deleteNat, deleteTariff, deleteDept]);

	const isLoading =
		activeTab === 'nationalities'
			? natLoading
			: activeTab === 'tariffs'
				? tariffLoading
				: deptLoading;

	const showSkeleton = useDelayedSkeleton(isLoading);
	const showToolbar = activeTab !== 'curriculum';

	return (
		<div className="p-6">
			<h1 className="text-(--text-xl) font-semibold">Reference Data</h1>

			{/* Tab Navigation */}
			<div
				role="tablist"
				aria-label="Reference data categories"
				className="mt-4 flex border-b border-(--workspace-border)"
			>
				{TABS.map((tab) => (
					<button
						key={tab.key}
						type="button"
						role="tab"
						id={`tab-${tab.key}`}
						aria-selected={activeTab === tab.key}
						aria-controls={`panel-${tab.key}`}
						onClick={() => {
							setActiveTab(tab.key);
							setSearchParams({ tab: tab.key }, { replace: true });
						}}
						className={cn(
							'px-4 py-2 text-(--text-sm) font-medium -mb-px border-b-2',
							activeTab === tab.key
								? 'border-(--accent-500) text-(--accent-600)'
								: 'border-transparent text-(--text-muted) hover:text-(--text-primary)'
						)}
					>
						{tab.label}
					</button>
				))}
			</div>

			{/* Tab Panel */}
			<div
				role="tabpanel"
				id={`panel-${activeTab}`}
				aria-labelledby={`tab-${activeTab}`}
				className="mt-4"
			>
				{/* Toolbar (non-curriculum tabs only) */}
				{showToolbar && (
					<div className="flex flex-wrap items-center gap-3 pb-4">
						<div>
							<label htmlFor="ref-search" className="sr-only">
								Search
							</label>
							<Input
								id="ref-search"
								type="text"
								placeholder="Search..."
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								className="w-64"
							/>
						</div>
						{isAdmin && (
							<Button type="button" variant="primary" onClick={handleAddNew}>
								+ Add Item
							</Button>
						)}
					</div>
				)}

				{/* Tables */}
				{activeTab === 'nationalities' && (
					<DataGrid table={natTable} isLoading={natLoading} showSkeleton={showSkeleton} />
				)}
				{activeTab === 'tariffs' && (
					<DataGrid table={tariffTable} isLoading={tariffLoading} showSkeleton={showSkeleton} />
				)}
				{activeTab === 'departments' && (
					<DataGrid table={deptTable} isLoading={deptLoading} showSkeleton={showSkeleton} />
				)}
				{activeTab === 'curriculum' && <CurriculumTabContent isAdmin={isAdmin} />}
			</div>

			{/* Side Panels (non-curriculum tabs) */}
			{activeTab === 'nationalities' && (
				<NationalitySidePanel
					open={panelOpen && activeTab === 'nationalities'}
					onClose={handleClosePanel}
					nationality={editingNationality}
					onSave={handleNationalitySave}
					loading={createNat.isPending || updateNat.isPending}
				/>
			)}

			{activeTab === 'tariffs' && (
				<TariffSidePanel
					open={panelOpen && activeTab === 'tariffs'}
					onClose={handleClosePanel}
					tariff={editingTariff}
					onSave={handleTariffSave}
					loading={createTariff.isPending || updateTariff.isPending}
				/>
			)}

			{activeTab === 'departments' && (
				<DepartmentSidePanel
					open={panelOpen && activeTab === 'departments'}
					onClose={handleClosePanel}
					department={editingDepartment}
					onSave={handleDepartmentSave}
					loading={createDept.isPending || updateDept.isPending}
				/>
			)}

			{/* Delete Confirmation (non-curriculum tabs) */}
			<DeleteConfirmDialog
				open={!!deleteTarget}
				entityCode={deleteTarget?.code ?? ''}
				entityType={deleteTarget?.type ?? ''}
				onConfirm={handleDeleteConfirm}
				onCancel={() => setDeleteTarget(null)}
				loading={deleteNat.isPending || deleteTariff.isPending || deleteDept.isPending}
			/>
		</div>
	);
}
