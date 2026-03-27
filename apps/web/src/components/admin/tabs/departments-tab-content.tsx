import { useCallback, useMemo, useState } from 'react';
import {
	createColumnHelper,
	getCoreRowModel,
	getFilteredRowModel,
	useReactTable,
} from '@tanstack/react-table';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { cn } from '../../../lib/cn';
import { useAuthStore } from '../../../stores/auth-store';
import {
	useDepartments,
	useCreateDepartment,
	useUpdateDepartment,
	useDeleteDepartment,
} from '../../../hooks/use-reference-data';
import type { Department, BandMapping } from '../../../hooks/use-reference-data';
import { DepartmentSidePanel } from '../../master-data/department-side-panel';
import { ListGrid } from '../../data-grid/list-grid';
import { DeleteConfirmDialog } from '../delete-confirm-dialog';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
} from '../../ui/dropdown-menu';
import { toast } from '../../ui/toast-state';

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

const deptColumnHelper = createColumnHelper<Department>();

export function DepartmentsTabContent() {
	const currentUser = useAuthStore((s) => s.user);
	const isAdmin = currentUser?.role === 'Admin';

	const [search, setSearch] = useState('');

	// Panel state
	const [panelOpen, setPanelOpen] = useState(false);
	const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);

	// Delete state
	const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);

	// Data hooks
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
		],
		[]
	);

	const renderDeptActions = useCallback(
		(item: Department) => {
			if (!isAdmin) return null;
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
						<DropdownMenuItem destructive onSelect={() => setDeleteTarget(item)}>
							<Trash2 className="h-4 w-4" /> Delete
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			);
		},
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

	const handleClosePanel = useCallback(() => {
		setPanelOpen(false);
		setEditingDepartment(null);
	}, []);

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
		deleteDept.mutate(deleteTarget.id, {
			onSuccess: () => {
				setDeleteTarget(null);
				toast.success('Department deleted successfully');
			},
			onError: () => {
				toast.error('Failed to delete department');
			},
		});
	}, [deleteTarget, deleteDept]);

	return (
		<div className="space-y-4">
			{/* Toolbar */}
			<div className="flex flex-wrap items-center gap-3">
				<div>
					<label htmlFor="dept-search" className="sr-only">
						Search departments
					</label>
					<Input
						id="dept-search"
						type="text"
						placeholder="Search departments..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="w-64"
					/>
				</div>
				{isAdmin && (
					<Button
						type="button"
						variant="primary"
						className="ml-auto"
						onClick={() => {
							setEditingDepartment(null);
							setPanelOpen(true);
						}}
					>
						+ Add Department
					</Button>
				)}
			</div>

			{/* Data table */}
			<ListGrid
				table={deptTable}
				isLoading={deptLoading}
				{...(isAdmin ? { actionsColumn: { render: renderDeptActions } } : {})}
				ariaLabel="Departments"
			/>

			{/* Side panel */}
			<DepartmentSidePanel
				open={panelOpen}
				onClose={handleClosePanel}
				department={editingDepartment}
				onSave={handleDepartmentSave}
				loading={createDept.isPending || updateDept.isPending}
			/>

			{/* Delete confirmation dialog */}
			<DeleteConfirmDialog
				open={!!deleteTarget}
				entityCode={deleteTarget?.code ?? ''}
				entityType="Department"
				onConfirm={handleDeleteConfirm}
				onCancel={() => setDeleteTarget(null)}
				loading={deleteDept.isPending}
			/>
		</div>
	);
}
