import { useCallback, useMemo, useState } from 'react'
import {
	createColumnHelper,
	flexRender,
	getCoreRowModel,
	useReactTable,
} from '@tanstack/react-table'
import { cn } from '../../lib/cn'
import { useAuthStore } from '../../stores/auth-store'
import {
	useAccounts,
	useCreateAccount,
	useUpdateAccount,
	useDeleteAccount,
} from '../../hooks/use-accounts'
import type { Account, AccountFilters } from '../../hooks/use-accounts'
import { AccountsSidePanel } from '../../components/master-data/accounts-side-panel'

const columnHelper = createColumnHelper<Account>()

const TYPE_BADGE_COLORS: Record<string, string> = {
	REVENUE: 'bg-blue-100 text-blue-800',
	EXPENSE: 'bg-red-100 text-red-800',
	ASSET: 'bg-green-100 text-green-800',
	LIABILITY: 'bg-yellow-100 text-yellow-800',
}

const CENTER_TYPE_BADGE_COLORS: Record<string, string> = {
	PROFIT_CENTER: 'bg-purple-100 text-purple-800',
	COST_CENTER: 'bg-orange-100 text-orange-800',
}

const TYPE_LABELS: Record<string, string> = {
	REVENUE: 'Revenue',
	EXPENSE: 'Expense',
	ASSET: 'Asset',
	LIABILITY: 'Liability',
}

const CENTER_TYPE_LABELS: Record<string, string> = {
	PROFIT_CENTER: 'Profit Center',
	COST_CENTER: 'Cost Center',
}

export function AccountsPage() {
	const currentUser = useAuthStore((s) => s.user)
	const isAdmin = currentUser?.role === 'Admin'

	// Filters
	const [searchInput, setSearchInput] = useState('')
	const [searchDebounced, setSearchDebounced] = useState('')
	const [searchTimer, setSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null)
	const [typeFilter, setTypeFilter] = useState('')
	const [centerTypeFilter, setCenterTypeFilter] = useState('')
	const [statusFilter, setStatusFilter] = useState('')

	const handleSearchChange = useCallback(
		(value: string) => {
			setSearchInput(value)
			if (searchTimer) clearTimeout(searchTimer)
			const timer = setTimeout(() => setSearchDebounced(value), 300)
			setSearchTimer(timer)
		},
		[searchTimer],
	)

	const filters: AccountFilters = useMemo(() => {
		const f: AccountFilters = {}
		if (searchDebounced) f.search = searchDebounced
		if (typeFilter) f.type = typeFilter
		if (centerTypeFilter) f.centerType = centerTypeFilter
		if (statusFilter) f.status = statusFilter
		return f
	}, [searchDebounced, typeFilter, centerTypeFilter, statusFilter])

	// Data hooks
	const { data, isLoading } = useAccounts(filters)
	const createMutation = useCreateAccount()
	const updateMutation = useUpdateAccount()
	const deleteMutation = useDeleteAccount()

	// Panel state
	const [panelOpen, setPanelOpen] = useState(false)
	const [editingAccount, setEditingAccount] = useState<Account | null>(null)

	// Delete confirmation state
	const [deleteTarget, setDeleteTarget] = useState<Account | null>(null)
	const [deleteConfirmCode, setDeleteConfirmCode] = useState('')

	// Status message
	const [statusMessage, setStatusMessage] = useState<{
		text: string
		type: 'success' | 'error'
	} | null>(null)

	const showStatus = useCallback(
		(text: string, type: 'success' | 'error') => {
			setStatusMessage({ text, type })
			setTimeout(() => setStatusMessage(null), 4000)
		},
		[],
	)

	const handleSave = useCallback(
		(formData: Record<string, unknown>) => {
			if (editingAccount) {
				updateMutation.mutate(
					{
						id: editingAccount.id,
						version: formData.version as number,
						accountName: formData.accountName as string,
						type: formData.type as Account['type'],
						ifrsCategory: formData.ifrsCategory as string,
						centerType: formData.centerType as Account['centerType'],
						description: formData.description as string | null,
						status: formData.status as Account['status'],
					},
					{
						onSuccess: () => {
							setPanelOpen(false)
							setEditingAccount(null)
							showStatus('Account updated successfully', 'success')
						},
						onError: () => {
							showStatus('Failed to update account', 'error')
						},
					},
				)
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
							setPanelOpen(false)
							showStatus('Account created successfully', 'success')
						},
						onError: () => {
							showStatus('Failed to create account', 'error')
						},
					},
				)
			}
		},
		[editingAccount, updateMutation, createMutation, showStatus],
	)

	const handleDelete = useCallback(() => {
		if (!deleteTarget || deleteConfirmCode !== deleteTarget.accountCode) return
		deleteMutation.mutate(deleteTarget.id, {
			onSuccess: () => {
				setDeleteTarget(null)
				setDeleteConfirmCode('')
				showStatus('Account deleted successfully', 'success')
			},
			onError: () => {
				showStatus('Failed to delete account', 'error')
			},
		})
	}, [deleteTarget, deleteConfirmCode, deleteMutation, showStatus])

	const columns = useMemo(
		() => [
			columnHelper.accessor('accountCode', {
				header: 'Account Code',
				cell: (info) => (
					<span className="font-medium">{info.getValue()}</span>
				),
			}),
			columnHelper.accessor('accountName', {
				header: 'Account Name',
			}),
			columnHelper.accessor('type', {
				header: 'Type',
				cell: (info) => {
					const value = info.getValue()
					return (
						<span
							className={cn(
								'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
								TYPE_BADGE_COLORS[value],
							)}
							aria-label={`Type: ${TYPE_LABELS[value]}`}
						>
							{TYPE_LABELS[value]}
						</span>
					)
				},
			}),
			columnHelper.accessor('ifrsCategory', {
				header: 'IFRS Category',
			}),
			columnHelper.accessor('centerType', {
				header: 'Center Type',
				cell: (info) => {
					const value = info.getValue()
					return (
						<span
							className={cn(
								'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
								CENTER_TYPE_BADGE_COLORS[value],
							)}
							aria-label={`Center type: ${CENTER_TYPE_LABELS[value]}`}
						>
							{CENTER_TYPE_LABELS[value]}
						</span>
					)
				},
			}),
			columnHelper.accessor('status', {
				header: 'Status',
				cell: (info) => {
					const value = info.getValue()
					const isActive = value === 'ACTIVE'
					return (
						<span
							className={cn(
								'inline-flex items-center gap-1.5 text-xs font-medium',
							)}
							aria-label={`Status: ${isActive ? 'Active' : 'Inactive'}`}
						>
							<span
								className={cn(
									'h-2 w-2 rounded-full',
									isActive ? 'bg-green-500' : 'bg-slate-400',
								)}
							/>
							{isActive ? 'Active' : 'Inactive'}
						</span>
					)
				},
			}),
			...(isAdmin
				? [
						columnHelper.display({
							id: 'actions',
							header: 'Actions',
							cell: ({ row }) => {
								const account = row.original
								return (
									<div className="flex gap-2">
										<button
											type="button"
											className="text-xs text-blue-600 hover:underline"
											onClick={() => {
												setEditingAccount(account)
												setPanelOpen(true)
											}}
										>
											Edit
										</button>
										<button
											type="button"
											className="text-xs text-red-600 hover:underline"
											onClick={() => setDeleteTarget(account)}
										>
											Delete
										</button>
									</div>
								)
							},
						}),
					]
				: []),
		],
		[isAdmin],
	)

	const table = useReactTable({
		data: data?.accounts ?? [],
		columns,
		getCoreRowModel: getCoreRowModel(),
	})

	return (
		<div className="p-6">
			{/* Status message */}
			{statusMessage && (
				<div
					aria-live="polite"
					className={cn(
						'mb-4 rounded-md px-4 py-3 text-sm font-medium',
						statusMessage.type === 'success'
							? 'bg-green-50 text-green-800'
							: 'bg-red-50 text-red-800',
					)}
				>
					{statusMessage.text}
				</div>
			)}

			{/* Toolbar */}
			<div className="flex flex-wrap items-center gap-3 pb-4">
				<h1 className="mr-auto text-xl font-semibold">Chart of Accounts</h1>

				<input
					type="search"
					placeholder="Search accounts..."
					value={searchInput}
					onChange={(e) => handleSearchChange(e.target.value)}
					className={cn(
						'w-[280px] rounded-md border border-slate-300',
						'px-3 py-2 text-sm',
						'placeholder:text-slate-400',
					)}
					aria-label="Search accounts"
				/>

				<select
					value={typeFilter}
					onChange={(e) => setTypeFilter(e.target.value)}
					className={cn(
						'rounded-md border border-slate-300',
						'px-3 py-2 text-sm',
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
						'rounded-md border border-slate-300',
						'px-3 py-2 text-sm',
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
						'rounded-md border border-slate-300',
						'px-3 py-2 text-sm',
					)}
					aria-label="Filter by status"
				>
					<option value="">All Statuses</option>
					<option value="ACTIVE">Active</option>
					<option value="INACTIVE">Inactive</option>
				</select>

				{isAdmin && (
					<button
						type="button"
						className={cn(
							'rounded-md bg-blue-600 px-4 py-2 text-sm',
							'font-medium text-white hover:bg-blue-700',
						)}
						onClick={() => {
							setEditingAccount(null)
							setPanelOpen(true)
						}}
					>
						+ Add Account
					</button>
				)}
			</div>

			{/* Data table */}
			{isLoading ? (
				<p className="text-sm text-slate-500">Loading...</p>
			) : (
				<div className="overflow-x-auto rounded-lg border">
					<table role="grid" className="w-full text-left text-sm">
						<thead className="border-b bg-slate-50">
							{table.getHeaderGroups().map((hg) => (
								<tr key={hg.id} role="row">
									{hg.headers.map((header) => (
										<th
											key={header.id}
											role="columnheader"
											className="px-4 py-3 font-medium text-slate-600"
										>
											{flexRender(
												header.column.columnDef.header,
												header.getContext(),
											)}
										</th>
									))}
								</tr>
							))}
						</thead>
						<tbody>
							{table.getRowModel().rows.length === 0 ? (
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
									<tr
										key={row.id}
										role="row"
										className="border-b last:border-0 hover:bg-slate-50"
									>
										{row.getVisibleCells().map((cell) => (
											<td
												key={cell.id}
												role="gridcell"
												aria-readonly="true"
												className="px-4 py-3"
											>
												{flexRender(
													cell.column.columnDef.cell,
													cell.getContext(),
												)}
											</td>
										))}
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>
			)}

			{/* Side panel */}
			<AccountsSidePanel
				open={panelOpen}
				account={editingAccount}
				onClose={() => {
					setPanelOpen(false)
					setEditingAccount(null)
				}}
				onSave={handleSave}
				loading={createMutation.isPending || updateMutation.isPending}
			/>

			{/* Delete confirmation dialog */}
			{deleteTarget && (
				<>
					<div
						className="fixed inset-0 z-40 bg-black/30"
						aria-hidden="true"
					/>
					<div
						role="alertdialog"
						aria-modal="true"
						aria-labelledby="delete-dialog-title"
						aria-describedby="delete-dialog-desc"
						className={cn(
							'fixed left-1/2 top-1/2 z-50 w-[420px]',
							'-translate-x-1/2 -translate-y-1/2',
							'rounded-lg bg-white p-6 shadow-xl',
						)}
					>
						<h3
							id="delete-dialog-title"
							className="text-lg font-semibold text-slate-900"
						>
							Delete Account
						</h3>
						<p
							id="delete-dialog-desc"
							className="mt-2 text-sm text-slate-600"
						>
							This action cannot be undone. Type{' '}
							<strong className="font-semibold">
								{deleteTarget.accountCode}
							</strong>{' '}
							to confirm deletion.
						</p>
						<div className="mt-4">
							<label htmlFor="delete-confirm" className="sr-only">
								Type account code to confirm
							</label>
							<input
								id="delete-confirm"
								type="text"
								value={deleteConfirmCode}
								onChange={(e) => setDeleteConfirmCode(e.target.value)}
								placeholder={deleteTarget.accountCode}
								className={cn(
									'block w-full rounded-md border border-slate-300',
									'px-3 py-2 text-sm',
								)}
								autoFocus
								onKeyDown={(e) => {
									if (e.key === 'Escape') {
										setDeleteTarget(null)
										setDeleteConfirmCode('')
									}
								}}
							/>
						</div>
						<div className="mt-4 flex justify-end gap-3">
							<button
								type="button"
								onClick={() => {
									setDeleteTarget(null)
									setDeleteConfirmCode('')
								}}
								className={cn(
									'rounded-md border border-slate-300',
									'px-4 py-2 text-sm font-medium',
									'hover:bg-slate-50',
								)}
							>
								Cancel
							</button>
							<button
								type="button"
								disabled={
									deleteConfirmCode !== deleteTarget.accountCode ||
									deleteMutation.isPending
								}
								onClick={handleDelete}
								className={cn(
									'rounded-md bg-red-600 px-4 py-2 text-sm',
									'font-medium text-white',
									'hover:bg-red-700',
									'disabled:opacity-50',
								)}
							>
								{deleteMutation.isPending ? 'Deleting...' : 'Delete'}
							</button>
						</div>
					</div>
				</>
			)}
		</div>
	)
}
