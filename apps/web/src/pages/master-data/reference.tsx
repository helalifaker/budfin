import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Table as TanstackTable } from '@tanstack/react-table';
import {
	createColumnHelper,
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	useReactTable,
} from '@tanstack/react-table';
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
	const dialogRef = useRef<HTMLDivElement>(null);
	const [confirmText, setConfirmText] = useState('');

	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect -- reset form state when dialog opens; sync with prop is intentional
		if (open) setConfirmText('');
	}, [open]);

	useEffect(() => {
		if (!open) return;
		const dialog = dialogRef.current;
		if (!dialog) return;

		const focusable = dialog.querySelectorAll<HTMLElement>(
			'input, button, [tabindex]:not([tabindex="-1"])'
		);
		const first = focusable[0];
		const last = focusable[focusable.length - 1];
		first?.focus();

		function handleKeyDown(e: KeyboardEvent) {
			if (e.key === 'Escape') {
				onCancel();
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

		dialog.addEventListener('keydown', handleKeyDown);
		return () => dialog.removeEventListener('keydown', handleKeyDown);
	}, [open, onCancel]);

	if (!open) return null;

	return (
		<>
			<div className="fixed inset-0 z-50 bg-black/30" onClick={onCancel} aria-hidden="true" />
			<div
				ref={dialogRef}
				role="alertdialog"
				aria-modal="true"
				aria-label={`Delete ${entityType}`}
				aria-describedby="delete-desc"
				className={cn(
					'fixed left-1/2 top-1/2 z-50 w-[420px] -translate-x-1/2 -translate-y-1/2',
					'rounded-lg bg-white p-6 shadow-xl'
				)}
			>
				<h3 className="text-lg font-semibold text-red-700">Delete {entityType}</h3>
				<p id="delete-desc" className="mt-2 text-sm text-slate-600">
					This action cannot be undone. Type <strong className="font-mono">{entityCode}</strong> to
					confirm deletion.
				</p>
				<div className="mt-4">
					<label htmlFor="delete-confirm" className="sr-only">
						Type code to confirm
					</label>
					<input
						id="delete-confirm"
						type="text"
						value={confirmText}
						onChange={(e) => setConfirmText(e.target.value)}
						placeholder={entityCode}
						className={cn(
							'block w-full rounded-md border border-slate-300',
							'px-3 py-2 text-sm font-mono'
						)}
					/>
				</div>
				<div className="mt-4 flex justify-end gap-3">
					<button
						type="button"
						onClick={onCancel}
						className={cn(
							'rounded-md border border-slate-300',
							'px-4 py-2 text-sm font-medium',
							'hover:bg-slate-50'
						)}
					>
						Cancel
					</button>
					<button
						type="button"
						disabled={confirmText !== entityCode || loading}
						onClick={onConfirm}
						className={cn(
							'rounded-md bg-red-600 px-4 py-2 text-sm',
							'font-medium text-white',
							'hover:bg-red-700',
							'disabled:opacity-50'
						)}
					>
						{loading ? 'Deleting...' : 'Delete'}
					</button>
				</div>
			</div>
		</>
	);
}

// --- Band Mapping Badge ---

const BAND_COLORS: Record<BandMapping, string> = {
	MATERNELLE: 'bg-pink-100 text-pink-700',
	ELEMENTAIRE: 'bg-blue-100 text-blue-700',
	COLLEGE: 'bg-green-100 text-green-700',
	LYCEE: 'bg-purple-100 text-purple-700',
	NON_ACADEMIC: 'bg-gray-100 text-gray-700',
};

function BandBadge({ band }: { band: BandMapping }) {
	return (
		<span className={cn('inline-block rounded px-2 py-0.5 text-xs font-medium', BAND_COLORS[band])}>
			{band.replace('_', ' ')}
		</span>
	);
}

// --- Tab definitions ---

type TabKey = 'nationalities' | 'tariffs' | 'departments';

const TABS: { key: TabKey; label: string }[] = [
	{ key: 'nationalities', label: 'Nationalities' },
	{ key: 'tariffs', label: 'Tariffs' },
	{ key: 'departments', label: 'Departments' },
];

// --- Column helpers ---

const natColumnHelper = createColumnHelper<Nationality>();
const tariffColumnHelper = createColumnHelper<Tariff>();
const deptColumnHelper = createColumnHelper<Department>();

// --- Generic Data Grid ---

function DataGrid<T>({ table }: { table: TanstackTable<T> }) {
	return (
		<div className="overflow-x-auto rounded-lg border">
			<table role="grid" className="w-full text-left text-sm">
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
					{table.getRowModel().rows.length === 0 ? (
						<tr>
							<td
								colSpan={table.getAllColumns().length}
								className="px-4 py-8 text-center text-sm text-slate-500"
							>
								No records found.
							</td>
						</tr>
					) : (
						table.getRowModel().rows.map((row) => (
							<tr key={row.id} className="border-b last:border-0 hover:bg-slate-50">
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
	const [activeTab, setActiveTab] = useState<TabKey>('nationalities');
	const [search, setSearch] = useState('');

	// Panel state
	const [panelOpen, setPanelOpen] = useState(false);
	const [editingNationality, setEditingNationality] = useState<Nationality | null>(null);
	const [editingTariff, setEditingTariff] = useState<Tariff | null>(null);
	const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);

	// Delete state
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
							'inline-block rounded px-2 py-0.5 text-xs font-medium',
							info.getValue() ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
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
						<div className="flex gap-2">
							<button
								type="button"
								className="text-xs text-blue-600 hover:underline"
								onClick={() => {
									setEditingNationality(item);
									setPanelOpen(true);
								}}
							>
								Edit
							</button>
							<button
								type="button"
								className="text-xs text-red-600 hover:underline"
								onClick={() =>
									setDeleteTarget({
										type: 'nationality',
										code: item.code,
										id: item.id,
									})
								}
							>
								Delete
							</button>
						</div>
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
						<div className="flex gap-2">
							<button
								type="button"
								className="text-xs text-blue-600 hover:underline"
								onClick={() => {
									setEditingTariff(item);
									setPanelOpen(true);
								}}
							>
								Edit
							</button>
							<button
								type="button"
								className="text-xs text-red-600 hover:underline"
								onClick={() =>
									setDeleteTarget({
										type: 'tariff',
										code: item.code,
										id: item.id,
									})
								}
							>
								Delete
							</button>
						</div>
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
						<div className="flex gap-2">
							<button
								type="button"
								className="text-xs text-blue-600 hover:underline"
								onClick={() => {
									setEditingDepartment(item);
									setPanelOpen(true);
								}}
							>
								Edit
							</button>
							<button
								type="button"
								className="text-xs text-red-600 hover:underline"
								onClick={() =>
									setDeleteTarget({
										type: 'department',
										code: item.code,
										id: item.id,
									})
								}
							>
								Delete
							</button>
						</div>
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
					{ onSuccess: handleClosePanel }
				);
			} else {
				createNat.mutate(data, { onSuccess: handleClosePanel });
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
					{ onSuccess: handleClosePanel }
				);
			} else {
				createTariff.mutate(data, { onSuccess: handleClosePanel });
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
					{ onSuccess: handleClosePanel }
				);
			} else {
				createDept.mutate(data, { onSuccess: handleClosePanel });
			}
		},
		[editingDepartment, createDept, updateDept, handleClosePanel]
	);

	const handleDeleteConfirm = useCallback(() => {
		if (!deleteTarget) return;
		const onSuccess = () => setDeleteTarget(null);
		if (deleteTarget.type === 'nationality') {
			deleteNat.mutate(deleteTarget.id, { onSuccess });
		} else if (deleteTarget.type === 'tariff') {
			deleteTariff.mutate(deleteTarget.id, { onSuccess });
		} else {
			deleteDept.mutate(deleteTarget.id, { onSuccess });
		}
	}, [deleteTarget, deleteNat, deleteTariff, deleteDept]);

	const isLoading =
		activeTab === 'nationalities'
			? natLoading
			: activeTab === 'tariffs'
				? tariffLoading
				: deptLoading;

	return (
		<div className="p-6">
			<h1 className="text-xl font-semibold">Reference Data</h1>

			{/* Tab Navigation */}
			<div
				role="tablist"
				aria-label="Reference data categories"
				className="mt-4 flex border-b border-slate-200"
			>
				{TABS.map((tab) => (
					<button
						key={tab.key}
						type="button"
						role="tab"
						id={`tab-${tab.key}`}
						aria-selected={activeTab === tab.key}
						aria-controls={`panel-${tab.key}`}
						onClick={() => setActiveTab(tab.key)}
						className={cn(
							'px-4 py-2 text-sm font-medium -mb-px border-b-2',
							activeTab === tab.key
								? 'border-blue-600 text-blue-600'
								: 'border-transparent text-slate-500 hover:text-slate-700'
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
				{/* Toolbar */}
				<div className="flex items-center justify-between pb-4">
					<div>
						<label htmlFor="ref-search" className="sr-only">
							Search
						</label>
						<input
							id="ref-search"
							type="text"
							placeholder="Search..."
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							className={cn(
								'rounded-md border border-slate-300',
								'px-3 py-2 text-sm w-64',
								'placeholder:text-slate-400'
							)}
						/>
					</div>
					{isAdmin && (
						<button
							type="button"
							onClick={handleAddNew}
							className={cn(
								'rounded-md bg-blue-600 px-4 py-2 text-sm',
								'font-medium text-white hover:bg-blue-700'
							)}
						>
							+ Add New
						</button>
					)}
				</div>

				{/* Table */}
				{isLoading ? (
					<p className="text-sm text-slate-500">Loading...</p>
				) : (
					<>
						{activeTab === 'nationalities' && <DataGrid table={natTable} />}
						{activeTab === 'tariffs' && <DataGrid table={tariffTable} />}
						{activeTab === 'departments' && <DataGrid table={deptTable} />}
					</>
				)}
			</div>

			{/* Side Panels */}
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

			{/* Delete Confirmation */}
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
