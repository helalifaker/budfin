import { useCallback, useEffect, useMemo, useState } from 'react';
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
	REVENUE: 'bg-blue-100 text-blue-800',
	EXPENSE: 'bg-red-100 text-red-800',
	ASSET: 'bg-green-100 text-green-800',
	LIABILITY: 'bg-yellow-100 text-yellow-800',
};

const CENTER_TYPE_BADGE_COLORS: Record<string, string> = {
	PROFIT_CENTER: 'bg-purple-100 text-purple-800',
	COST_CENTER: 'bg-orange-100 text-orange-800',
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
	const [searchTimer, setSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
	const [typeFilter, setTypeFilter] = useState('');
	const [centerTypeFilter, setCenterTypeFilter] = useState('');
	const [statusFilter, setStatusFilter] = useState('');

	const handleSearchChange = useCallback(
		(value: string) => {
			setSearchInput(value);
			if (searchTimer) clearTimeout(searchTimer);
			const timer = setTimeout(() => setSearchDebounced(value), 300);
			setSearchTimer(timer);
		},
		[searchTimer]
	);

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
								'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
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
								'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
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
							className={cn('inline-flex items-center gap-1.5 text-xs font-medium')}
							aria-label={`Status: ${isActive ? 'Active' : 'Inactive'}`}
						>
							<span
								className={cn('h-2 w-2 rounded-full', isActive ? 'bg-green-500' : 'bg-slate-400')}
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
												className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100"
												aria-label={`Actions for ${account.accountCode}`}
											>
												<MoreHorizontal className="h-4 w-4 text-slate-500" />
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
				<h1 className="mr-auto text-xl font-semibold">Chart of Accounts</h1>

				<Input
					type="search"
					placeholder="Search accounts..."
					value={searchInput}
					onChange={(e) => handleSearchChange(e.target.value)}
					className="w-[280px]"
					aria-label="Search accounts"
				/>

				<select
					value={typeFilter}
					onChange={(e) => setTypeFilter(e.target.value)}
					className={cn(
						'flex h-9 rounded-md border border-slate-300 bg-white',
						'px-3 py-2 text-sm text-slate-900',
						'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
					)}
					aria-label="Filter by type"
				>
					<option value="">All Types</option>
					<option value="REVENUE">Revenue</option>
					<option value="EXPENSE">Expense</option>
					<option value="ASSET">Asset</option>
					<option value="LIABILITY">Liability</option>
				</select>

				<select
					value={centerTypeFilter}
					onChange={(e) => setCenterTypeFilter(e.target.value)}
					className={cn(
						'flex h-9 rounded-md border border-slate-300 bg-white',
						'px-3 py-2 text-sm text-slate-900',
						'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
					)}
					aria-label="Filter by center type"
				>
					<option value="">All Center Types</option>
					<option value="PROFIT_CENTER">Profit Center</option>
					<option value="COST_CENTER">Cost Center</option>
				</select>

				<select
					value={statusFilter}
					onChange={(e) => setStatusFilter(e.target.value)}
					className={cn(
						'flex h-9 rounded-md border border-slate-300 bg-white',
						'px-3 py-2 text-sm text-slate-900',
						'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
					)}
					aria-label="Filter by status"
				>
					<option value="">All Statuses</option>
					<option value="ACTIVE">Active</option>
					<option value="INACTIVE">Inactive</option>
				</select>

				{isAdmin && (
					<Button
						type="button"
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
									className="px-4 py-8 text-center text-sm text-slate-500"
								>
									No accounts found
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
							className="bg-red-600 hover:bg-red-700"
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
