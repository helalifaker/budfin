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
	useNationalities,
	useCreateNationality,
	useUpdateNationality,
	useDeleteNationality,
} from '../../../hooks/use-reference-data';
import type { Nationality } from '../../../hooks/use-reference-data';
import { NationalitySidePanel } from '../../master-data/nationality-side-panel';
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

const natColumnHelper = createColumnHelper<Nationality>();

export function NationalitiesTabContent() {
	const currentUser = useAuthStore((s) => s.user);
	const isAdmin = currentUser?.role === 'Admin';

	const [search, setSearch] = useState('');

	// Panel state
	const [panelOpen, setPanelOpen] = useState(false);
	const [editingNationality, setEditingNationality] = useState<Nationality | null>(null);

	// Delete state
	const [deleteTarget, setDeleteTarget] = useState<Nationality | null>(null);

	// Data hooks
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
		],
		[]
	);

	const renderNatActions = useCallback(
		(item: Nationality) => {
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
								setEditingNationality(item);
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

	const natTable = useReactTable({
		data: nationalities,
		columns: natColumns,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		state: { globalFilter: search },
		onGlobalFilterChange: setSearch,
	});

	const handleClosePanel = useCallback(() => {
		setPanelOpen(false);
		setEditingNationality(null);
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

	const handleDeleteConfirm = useCallback(() => {
		if (!deleteTarget) return;
		deleteNat.mutate(deleteTarget.id, {
			onSuccess: () => {
				setDeleteTarget(null);
				toast.success('Nationality deleted successfully');
			},
			onError: () => {
				toast.error('Failed to delete nationality');
			},
		});
	}, [deleteTarget, deleteNat]);

	return (
		<div className="space-y-4">
			{/* Toolbar */}
			<div className="flex flex-wrap items-center gap-3">
				<div>
					<label htmlFor="nat-search" className="sr-only">
						Search nationalities
					</label>
					<Input
						id="nat-search"
						type="text"
						placeholder="Search nationalities..."
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
							setEditingNationality(null);
							setPanelOpen(true);
						}}
					>
						+ Add Nationality
					</Button>
				)}
			</div>

			{/* Data table */}
			<ListGrid
				table={natTable}
				isLoading={natLoading}
				{...(isAdmin ? { actionsColumn: { render: renderNatActions } } : {})}
				ariaLabel="Nationalities"
			/>

			{/* Side panel */}
			<NationalitySidePanel
				open={panelOpen}
				onClose={handleClosePanel}
				nationality={editingNationality}
				onSave={handleNationalitySave}
				loading={createNat.isPending || updateNat.isPending}
			/>

			{/* Delete confirmation dialog */}
			<DeleteConfirmDialog
				open={!!deleteTarget}
				entityCode={deleteTarget?.code ?? ''}
				entityType="Nationality"
				onConfirm={handleDeleteConfirm}
				onCancel={() => setDeleteTarget(null)}
				loading={deleteNat.isPending}
			/>
		</div>
	);
}
