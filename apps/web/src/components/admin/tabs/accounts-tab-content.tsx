import { useCallback, useMemo, useRef, useState } from 'react';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Lock, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { cn } from '../../../lib/cn';
import { PROFIT_CENTER_LABELS } from '../../../lib/profit-center';
import { useAuthStore } from '../../../stores/auth-store';
import {
	useAccounts,
	useCreateAccount,
	useUpdateAccount,
	useDeleteAccount,
} from '../../../hooks/use-accounts';
import type { Account, AccountFilters } from '../../../hooks/use-accounts';
import { AccountsSidePanel } from '../../master-data/accounts-side-panel';
import { ListGrid } from '../../data-grid/list-grid';
import { DeleteConfirmDialog } from '../delete-confirm-dialog';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../ui/select';
import {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
} from '../../ui/dropdown-menu';
import { toast } from '../../ui/toast-state';

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

const PROFIT_CENTER_BADGE_COLORS: Record<string, string> = {
	MATERNELLE: 'bg-(--badge-asset-bg) text-(--badge-asset)',
	ELEMENTAIRE: 'bg-(--badge-revenue-bg) text-(--badge-revenue)',
	COLLEGE: 'bg-(--badge-profit-center-bg) text-(--badge-profit-center)',
	LYCEE: 'bg-(--badge-liability-bg) text-(--badge-liability)',
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

export function AccountsTabContent() {
	const currentUser = useAuthStore((s) => s.user);
	const isAdmin = currentUser?.role === 'Admin';

	// Filters
	const [searchInput, setSearchInput] = useState('');
	const [searchDebounced, setSearchDebounced] = useState('');
	const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const [typeFilter, setTypeFilter] = useState('');
	const [centerTypeFilter, setCenterTypeFilter] = useState('');
	const [profitCenterFilter, setProfitCenterFilter] = useState('');
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
		if (profitCenterFilter) f.profitCenter = profitCenterFilter;
		if (statusFilter) f.status = statusFilter;
		return f;
	}, [searchDebounced, typeFilter, centerTypeFilter, profitCenterFilter, statusFilter]);

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
						profitCenter: (formData.profitCenter as Account['profitCenter']) ?? null,
						parentCode: (formData.parentCode as string | null) ?? null,
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
						profitCenter: (formData.profitCenter as Account['profitCenter']) ?? null,
						parentCode: (formData.parentCode as string | null) ?? null,
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
		if (!deleteTarget) return;
		deleteMutation.mutate(deleteTarget.id, {
			onSuccess: () => {
				setDeleteTarget(null);
				toast.success('Account deleted successfully');
			},
			onError: () => {
				toast.error('Failed to delete account');
			},
		});
	}, [deleteTarget, deleteMutation]);

	const columns = useMemo(
		() => [
			columnHelper.accessor('accountCode', {
				header: 'Account Code',
				cell: (info) => {
					const account = info.row.original;
					return (
						<span className="inline-flex items-center gap-1.5 font-medium">
							{account.isSystem && (
								<Lock
									className="h-3 w-3 shrink-0 text-(--text-muted)"
									aria-label="System account"
								/>
							)}
							{info.getValue()}
						</span>
					);
				},
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
			columnHelper.accessor('profitCenter', {
				header: 'Profit Center',
				cell: (info) => {
					const value = info.getValue();
					if (!value) {
						return (
							<span className="text-(--text-xs) text-(--text-muted)" aria-label="Shared account">
								Shared
							</span>
						);
					}
					return (
						<span
							className={cn(
								'inline-flex rounded-sm px-2 py-0.5 text-(--text-xs) font-medium',
								PROFIT_CENTER_BADGE_COLORS[value]
							)}
							aria-label={`Profit center: ${PROFIT_CENTER_LABELS[value]}`}
						>
							{PROFIT_CENTER_LABELS[value]}
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
		],
		[]
	);

	const renderActions = useCallback(
		(account: Account) => {
			if (!isAdmin) return null;
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
						{!account.isSystem && (
							<>
								<DropdownMenuSeparator />
								<DropdownMenuItem destructive onSelect={() => setDeleteTarget(account)}>
									<Trash2 className="h-4 w-4" /> Delete
								</DropdownMenuItem>
							</>
						)}
					</DropdownMenuContent>
				</DropdownMenu>
			);
		},
		[isAdmin]
	);

	const table = useReactTable({
		data: data?.accounts ?? [],
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	return (
		<div className="space-y-4">
			{/* Toolbar */}
			<div className="flex flex-wrap items-center gap-3">
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
					value={profitCenterFilter || 'all'}
					onValueChange={(v) => setProfitCenterFilter(v === 'all' ? '' : v)}
				>
					<SelectTrigger className="w-[180px]" aria-label="Filter by profit center">
						<SelectValue placeholder="All Divisions" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Divisions</SelectItem>
						<SelectItem value="MATERNELLE">Maternelle</SelectItem>
						<SelectItem value="ELEMENTAIRE">Elementaire</SelectItem>
						<SelectItem value="COLLEGE">College</SelectItem>
						<SelectItem value="LYCEE">Lycee</SelectItem>
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
						className="ml-auto"
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
			<ListGrid
				table={table}
				isLoading={isLoading}
				{...(isAdmin ? { actionsColumn: { render: renderActions } } : {})}
				emptyState={<p className="text-(--text-sm) text-(--text-muted)">No accounts found</p>}
				ariaLabel="Chart of accounts"
			/>

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
			<DeleteConfirmDialog
				open={!!deleteTarget}
				entityCode={deleteTarget?.accountCode ?? ''}
				entityType="Account"
				onConfirm={handleDelete}
				onCancel={() => setDeleteTarget(null)}
				loading={deleteMutation.isPending}
			/>
		</div>
	);
}
