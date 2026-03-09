import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	createColumnHelper,
	flexRender,
	getCoreRowModel,
	useReactTable,
} from '@tanstack/react-table';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { cn } from '../../lib/cn';
import { useAuthStore } from '../../stores/auth-store';
import {
	useAccounts,
	useCreateAccount,
	useUpdateAccount,
	useDeleteAccount,
} from '../../hooks/use-accounts';
import type { Account, AccountFilters } from '../../hooks/use-accounts';
import { AccountsSidePanel } from '../../components/master-data/accounts-side-panel';
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

const columnHelper = createColumnHelper<Account>();

const TYPE_BADGE_COLORS: Record<string, string> = {
	REVENUE: 'bg-(--badge-revenue-bg) text-(--badge-revenue)',
	EXPENSE: 'bg-(--badge-expense-bg) text-(--badge-expense)',
	ASSET: 'bg-(--badge-asset-bg) text-(--badge-asset)',
	LIABILITY: 'bg-(--badge-liability-bg) text-(--badge-liability)',
};

const CENTER_TYPE_BADGE_COLORS: Record<string, string> = {
	PROFIT_CENTER: 'bg-(--badge-profit-center-bg) text-(--badge-profit-center)',
	COST_CENTER: 'bg-(--badge-cost-center-bg) text-(--badge-cost-center)',
};

const TYPE_LABELS: Record<string, string> = {
	REVENUE: 'Revenue',
	EXPENSE: 'Expense',
	ASSET: 'Asset',
	LIABILITY: 'Liability',
};

const CENTER_TYPE_LABELS: Record<string, string> = {
	PROFIT_CENTER: 'Profit Center',
	COST_CENTER: 'Cost Center',
};

export function AccountsPage() {
	const currentUser = useAuthStore((s) => s.user);
	const isAdmin = currentUser?.role === 'Admin';

	// Filters
	const [searchInput, setSearchInput] = useState('');
	const [searchDebounced, setSearchDebounced] = useState('');
	const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const [typeFilter, setTypeFilter] = useState('');
	const [centerTypeFilter, setCenterTypeFilter] = useState('');
	const [statusFilter, setStatusFilter] = useState('');

	const handleSearchChange = useCallback((value: string) => {
		setSearchInput(value);
		if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
		searchTimerRef.current = setTimeout(() => setSearchDebounced(value), 300);
	}, []);

	const filters: AccountFilters = useMemo(() => {
		const f: AccountFilters = {};
		if (searchDebounced) f.search = searchDebounced;
		if (typeFilter) f.type = typeFilter;
		if (centerTypeFilter) f.centerType = centerTypeFilter;
		if (statusFilter) f.status = statusFilter;
		return f;
	}, [searchDebounced, typeFilter, centerTypeFilter, statusFilter]);

	// Data hooks
	const { data, isLoading } = useAccounts(filters);
	const createMutation = useCreateAccount();
	const updateMutation = useUpdateAccount();
	const deleteMutation = useDeleteAccount();

	// Panel state
	const [panelOpen, setPanelOpen] = useState(false);
	const [editingAccount, setEditingAccount] = useState<Account | null>(null);

	// Delete confirmation state
	const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);
	const [deleteConfirmCode, setDeleteConfirmCode] = useState('');

	// 200ms-delayed skeleton
	const [showSkeleton, setShowSkeleton] = useState(false);
	useEffect(() => {
		if (!isLoading) {
			setShowSkeleton(false);
			return;
		}
		const t = setTimeout(() => setShowSkeleton(true), 200);
		return () => clearTimeout(t);
	}, [isLoading]);

	const handleSave = useCallback(
		(formData: Record<string, unknown>) => {
			if (editingAccount) {
				updateMutation.mutate(
					{
						id: editingAccount.id,
						version: formData.version as number,
						accountCode: formData.accountCode as string,
						accountName: formData.accountName as string,
						type: formData.type as Account['type'],
						ifrsCategory: formData.ifrsCategory as string,
						centerType: formData.centerType as Account['centerType'],
						description: formData.description as string | null,
						status: formData.status as Account['status'],
					},
					{
						onSuccess: () => {
							setPanelOpen(false);
							setEditingAccount(null);
							toast.success('Account updated successfully');
						},
						onError: () => {
							toast.error('Failed to update account');
						},
					}
				);
			} else {
				createMutation.mutate(
					{
						accountCode: formData.accountCode as string,
						accountName: formData.accountName as string,
						type: formData.type as Account['type'],
						ifrsCategory: formData.ifrsCategory as string,
						centerType: formData.centerType as Account['centerType'],
						description: formData.description as string | null,
						status: formData.status as Account['status'],
					},
					{
						onSuccess: () => {
							setPanelOpen(false);
							toast.success('Account created successfully');
						},
						onError: () => {
							toast.error('Failed to create account');
						},
					}
				);
			}
		},
		[editingAccount, updateMutation, createMutation]
	);

	const handleDelete = useCallback(() => {
		if (!deleteTarget || deleteConfirmCode !== deleteTarget.accountCode) return;
		deleteMutation.mutate(deleteTarget.id, {
			onSuccess: () => {
				setDeleteTarget(null);
				setDeleteConfirmCode('');
				toast.success('Account deleted successfully');
			},
			onError: () => {
				toast.error('Failed to delete account');
			},
		});
	}, [deleteTarget, deleteConfirmCode, deleteMutation]);

	const columns = useMemo(
		() => [
			columnHelper.accessor('accountCode', {
				header: 'Account Code',
				cell: (info) => <span className="font-medium">{info.getValue()}</span>,
			}),
			columnHelper.accessor('accountName', {
				header: 'Account Name',
			}),
			columnHelper.accessor('type', {
				header: 'Type',
				cell: (info) => {
					const value = info.getValue();
					return (
						<span
							className={cn(
								'inline-flex rounded-sm px-2 py-0.5 text-(--text-xs) font-medium',
								TYPE_BADGE_COLORS[value]
							)}
							aria-label={`Type: ${TYPE_LABELS[value]}`}
						>
							{TYPE_LABELS[value]}
						</span>
					);
				},
			}),
			columnHelper.accessor('ifrsCategory', {
				header: 'IFRS Category',
			}),
			columnHelper.accessor('centerType', {
				header: 'Center Type',
				cell: (info) => {
					const value = info.getValue();
					return (
						<span
							className={cn(
								'inline-flex rounded-sm px-2 py-0.5 text-(--text-xs) font-medium',
								CENTER_TYPE_BADGE_COLORS[value]
							)}
							aria-label={`Center type: ${CENTER_TYPE_LABELS[value]}`}
						>
							{CENTER_TYPE_LABELS[value]}
						</span>
					);
				},
			}),
			columnHelper.accessor('status', {
				header: 'Status',
				cell: (info) => {
					const value = info.getValue();
					const isActive = value === 'ACTIVE';
					return (
						<span
							className={cn('inline-flex items-center gap-1.5 text-(--text-xs) font-medium')}
							aria-label={`Status: ${isActive ? 'Active' : 'Inactive'}`}
						>
							<span
								className={cn(
									'h-2 w-2 rounded-full',
									isActive ? 'bg-(--color-success)' : 'bg-(--text-muted)'
								)}
							/>
							{isActive ? 'Active' : 'Inactive'}
						</span>
					);
				},
			}),
			...(isAdmin
				? [
						columnHelper.display({
							id: 'actions',
							header: 'Actions',
							cell: ({ row }) => {
								const account = row.original;
								return (
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<button
												type="button"
												className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-(--workspace-bg-muted)"
												aria-label={`Actions for ${account.accountCode}`}
											>
												<MoreHorizontal className="h-4 w-4 text-(--text-muted)" />
											</button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end">
											<DropdownMenuItem
												onSelect={() => {
													setEditingAccount(account);
													setPanelOpen(true);
												}}
											>
												<Pencil className="h-4 w-4" /> Edit
											</DropdownMenuItem>
											<DropdownMenuSeparator />
											<DropdownMenuItem destructive onSelect={() => setDeleteTarget(account)}>
												<Trash2 className="h-4 w-4" /> Delete
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								);
							},
						}),
					]
				: []),
		],
		[isAdmin]
	);

	const table = useReactTable({
		data: data?.accounts ?? [],
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	return (
		<div className="p-6">
			{/* Toolbar */}
			<div className="flex flex-wrap items-center gap-3 pb-4">
				<h1 className="mr-auto text-(--text-xl) font-semibold">Chart of Accounts</h1>

				<Input
					type="search"
					placeholder="Search accounts..."
					value={searchInput}
					onChange={(e) => handleSearchChange(e.target.value)}
					className="w-[280px]"
					aria-label="Search accounts"
				/>

				<Select
					value={typeFilter || 'all'}
					onValueChange={(v) => setTypeFilter(v === 'all' ? '' : v)}
				>
					<SelectTrigger className="w-[160px]" aria-label="Filter by type">
						<SelectValue placeholder="All Types" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Types</SelectItem>
						<SelectItem value="REVENUE">Revenue</SelectItem>
						<SelectItem value="EXPENSE">Expense</SelectItem>
						<SelectItem value="ASSET">Asset</SelectItem>
						<SelectItem value="LIABILITY">Liability</SelectItem>
					</SelectContent>
				</Select>

				<Select
					value={centerTypeFilter || 'all'}
					onValueChange={(v) => setCenterTypeFilter(v === 'all' ? '' : v)}
				>
					<SelectTrigger className="w-[180px]" aria-label="Filter by center type">
						<SelectValue placeholder="All Center Types" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Center Types</SelectItem>
						<SelectItem value="PROFIT_CENTER">Profit Center</SelectItem>
						<SelectItem value="COST_CENTER">Cost Center</SelectItem>
					</SelectContent>
				</Select>

				<Select
					value={statusFilter || 'all'}
					onValueChange={(v) => setStatusFilter(v === 'all' ? '' : v)}
				>
					<SelectTrigger className="w-[160px]" aria-label="Filter by status">
						<SelectValue placeholder="All Statuses" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Statuses</SelectItem>
						<SelectItem value="ACTIVE">Active</SelectItem>
						<SelectItem value="INACTIVE">Inactive</SelectItem>
					</SelectContent>
				</Select>

				{isAdmin && (
					<Button
						type="button"
						variant="primary"
						onClick={() => {
							setEditingAccount(null);
							setPanelOpen(true);
						}}
					>
						+ Add Account
					</Button>
				)}
			</div>

			{/* Data table */}
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
							<TableSkeleton rows={10} cols={columns.length} />
						) : table.getRowModel().rows.length === 0 ? (
							<tr>
								<td
									colSpan={columns.length}
									className="px-4 py-8 text-center text-(--text-sm) text-(--text-muted)"
								>
									No accounts found
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

			{/* Side panel */}
			<AccountsSidePanel
				open={panelOpen}
				account={editingAccount}
				onClose={() => {
					setPanelOpen(false);
					setEditingAccount(null);
				}}
				onSave={handleSave}
				loading={createMutation.isPending || updateMutation.isPending}
			/>

			{/* Delete confirmation dialog */}
			<AlertDialog
				open={!!deleteTarget}
				onOpenChange={(v) => {
					if (!v) {
						setDeleteTarget(null);
						setDeleteConfirmCode('');
					}
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Account</AlertDialogTitle>
						<AlertDialogDescription>
							This action cannot be undone. Type{' '}
							<strong className="font-semibold">{deleteTarget?.accountCode}</strong> to confirm
							deletion.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<div className="mt-2">
						<label htmlFor="delete-confirm" className="sr-only">
							Type account code to confirm
						</label>
						<Input
							id="delete-confirm"
							type="text"
							value={deleteConfirmCode}
							onChange={(e) => setDeleteConfirmCode(e.target.value)}
							placeholder={deleteTarget?.accountCode ?? ''}
							autoFocus
							onKeyDown={(e) => {
								if (e.key === 'Escape') {
									setDeleteTarget(null);
									setDeleteConfirmCode('');
								}
							}}
						/>
					</div>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
						<AlertDialogAction
							className="bg-(--color-error) hover:bg-[color-mix(in_srgb,var(--color-error),black_15%)]"
							disabled={deleteConfirmCode !== deleteTarget?.accountCode || deleteMutation.isPending}
							onClick={handleDelete}
						>
							{deleteMutation.isPending ? 'Deleting...' : 'Delete'}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
