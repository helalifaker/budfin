import { useCallback, useMemo, useState } from 'react';
import {
	createColumnHelper,
	getCoreRowModel,
	getFilteredRowModel,
	useReactTable,
} from '@tanstack/react-table';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useAuthStore } from '../../../stores/auth-store';
import {
	useTariffs,
	useCreateTariff,
	useUpdateTariff,
	useDeleteTariff,
} from '../../../hooks/use-reference-data';
import type { Tariff } from '../../../hooks/use-reference-data';
import { TariffSidePanel } from '../../master-data/tariff-side-panel';
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

const tariffColumnHelper = createColumnHelper<Tariff>();

export function TariffsTabContent() {
	const currentUser = useAuthStore((s) => s.user);
	const isAdmin = currentUser?.role === 'Admin';

	const [search, setSearch] = useState('');

	// Panel state
	const [panelOpen, setPanelOpen] = useState(false);
	const [editingTariff, setEditingTariff] = useState<Tariff | null>(null);

	// Delete state
	const [deleteTarget, setDeleteTarget] = useState<Tariff | null>(null);

	// Data hooks
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
		],
		[]
	);

	const renderTariffActions = useCallback(
		(item: Tariff) => {
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
								setEditingTariff(item);
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

	const tariffTable = useReactTable({
		data: tariffs,
		columns: tariffColumns,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		state: { globalFilter: search },
		onGlobalFilterChange: setSearch,
	});

	const handleClosePanel = useCallback(() => {
		setPanelOpen(false);
		setEditingTariff(null);
	}, []);

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

	const handleDeleteConfirm = useCallback(() => {
		if (!deleteTarget) return;
		deleteTariff.mutate(deleteTarget.id, {
			onSuccess: () => {
				setDeleteTarget(null);
				toast.success('Tariff deleted successfully');
			},
			onError: () => {
				toast.error('Failed to delete tariff');
			},
		});
	}, [deleteTarget, deleteTariff]);

	return (
		<div className="space-y-4">
			{/* Toolbar */}
			<div className="flex flex-wrap items-center gap-3">
				<div>
					<label htmlFor="tariff-search" className="sr-only">
						Search tariffs
					</label>
					<Input
						id="tariff-search"
						type="text"
						placeholder="Search tariffs..."
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
							setEditingTariff(null);
							setPanelOpen(true);
						}}
					>
						+ Add Tariff
					</Button>
				)}
			</div>

			{/* Data table */}
			<ListGrid
				table={tariffTable}
				isLoading={tariffLoading}
				{...(isAdmin ? { actionsColumn: { render: renderTariffActions } } : {})}
				ariaLabel="Tariffs"
			/>

			{/* Side panel */}
			<TariffSidePanel
				open={panelOpen}
				onClose={handleClosePanel}
				tariff={editingTariff}
				onSave={handleTariffSave}
				loading={createTariff.isPending || updateTariff.isPending}
			/>

			{/* Delete confirmation dialog */}
			<DeleteConfirmDialog
				open={!!deleteTarget}
				entityCode={deleteTarget?.code ?? ''}
				entityType="Tariff"
				onConfirm={handleDeleteConfirm}
				onCancel={() => setDeleteTarget(null)}
				loading={deleteTariff.isPending}
			/>
		</div>
	);
}
