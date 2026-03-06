import { useCallback, useMemo, useState } from 'react';
import {
	useQuery,
	useMutation,
	useQueryClient,
} from '@tanstack/react-query';
import {
	createColumnHelper,
	flexRender,
	getCoreRowModel,
	useReactTable,
} from '@tanstack/react-table';
import { apiClient } from '../../lib/api-client';
import { useAuthStore } from '../../stores/auth-store';
import { RoleBadge } from '../../components/admin/role-badge';
import { StatusBadge } from '../../components/admin/status-badge';
import { UserSidePanel } from '../../components/admin/user-side-panel';
import { cn } from '../../lib/cn';

interface User {
	id: number;
	email: string;
	role: string;
	is_active: boolean;
	last_login_at: string | null;
	failed_attempts: number;
	locked_until: string | null;
	created_at: string;
}

type RoleVariant = 'Admin' | 'BudgetOwner' | 'Editor' | 'Viewer';

const columnHelper = createColumnHelper<User>();

function formatDate(iso: string | null): string {
	if (!iso) return '-';
	return new Date(iso).toLocaleString('en-GB', {
		timeZone: 'Asia/Riyadh',
		dateStyle: 'medium',
		timeStyle: 'short',
	});
}

export function UsersPage() {
	const queryClient = useQueryClient();
	const currentUser = useAuthStore((s) => s.user);
	const [panelOpen, setPanelOpen] = useState(false);
	const [panelMode, setPanelMode] = useState<'create' | 'edit'>(
		'create',
	);
	const [editingUser, setEditingUser] = useState<User | null>(null);

	const { data, isLoading } = useQuery({
		queryKey: ['users'],
		queryFn: () =>
			apiClient<{ users: User[] }>('/users'),
	});

	const createMutation = useMutation({
		mutationFn: (body: {
			email: string;
			password: string;
			role: string;
		}) =>
			apiClient('/users', {
				method: 'POST',
				body: JSON.stringify(body),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['users'] });
			setPanelOpen(false);
		},
	});

	const updateMutation = useMutation({
		mutationFn: ({
			id,
			...body
		}: Record<string, unknown> & { id: number }) =>
			apiClient(`/users/${id}`, {
				method: 'PATCH',
				body: JSON.stringify(body),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['users'] });
			setPanelOpen(false);
		},
	});

	const handleSave = useCallback(
		(formData: Record<string, unknown>) => {
			if (panelMode === 'create') {
				createMutation.mutate(
					formData as {
						email: string;
						password: string;
						role: string;
					},
				);
			} else if (editingUser) {
				updateMutation.mutate({
					id: editingUser.id,
					...formData,
				});
			}
		},
		[panelMode, editingUser, createMutation, updateMutation],
	);

	const handleUnlock = useCallback(
		(user: User) => {
			updateMutation.mutate({
				id: user.id,
				unlock_account: true,
			});
		},
		[updateMutation],
	);

	const handleForceLogout = useCallback(
		(user: User) => {
			updateMutation.mutate({
				id: user.id,
				force_session_revoke: true,
			});
		},
		[updateMutation],
	);

	const columns = useMemo(
		() => [
			columnHelper.accessor('email', {
				header: 'Email',
				cell: (info) => (
					<span className="font-medium">
						{info.getValue()}
					</span>
				),
			}),
			columnHelper.accessor('role', {
				header: 'Role',
				cell: (info) => (
					<RoleBadge
						role={info.getValue() as RoleVariant}
					/>
				),
			}),
			columnHelper.accessor('is_active', {
				header: 'Status',
				cell: (info) => (
					<StatusBadge isActive={info.getValue()} />
				),
			}),
			columnHelper.accessor('last_login_at', {
				header: 'Last Login',
				cell: (info) => formatDate(info.getValue()),
			}),
			columnHelper.accessor('failed_attempts', {
				header: 'Failed Attempts',
				cell: (info) => info.getValue(),
			}),
			columnHelper.accessor('locked_until', {
				header: 'Locked Until',
				cell: (info) => formatDate(info.getValue()),
			}),
			columnHelper.accessor('created_at', {
				header: 'Created',
				cell: (info) => formatDate(info.getValue()),
			}),
			columnHelper.display({
				id: 'actions',
				header: 'Actions',
				cell: ({ row }) => {
					const user = row.original;
					const isSelf = user.id === currentUser?.id;
					return (
						<div className="flex gap-2">
							{!isSelf && (
								<button
									type="button"
									className="text-xs text-blue-600 hover:underline"
									onClick={() => {
										setEditingUser(user);
										setPanelMode('edit');
										setPanelOpen(true);
									}}
								>
									Edit
								</button>
							)}
							{!isSelf && user.locked_until && (
								<button
									type="button"
									className="text-xs text-amber-600 hover:underline"
									onClick={() => handleUnlock(user)}
								>
									Unlock
								</button>
							)}
							{!isSelf && (
								<button
									type="button"
									className="text-xs text-red-600 hover:underline"
									onClick={() =>
										handleForceLogout(user)
									}
								>
									Force Logout
								</button>
							)}
						</div>
					);
				},
			}),
		],
		[currentUser?.id, handleUnlock, handleForceLogout],
	);

	const table = useReactTable({
		data: data?.users ?? [],
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	return (
		<div className="p-6">
			<div className="flex items-center justify-between pb-4">
				<h1 className="text-xl font-semibold">
					User Management
				</h1>
				<button
					type="button"
					className={cn(
						'rounded-md bg-blue-600 px-4 py-2 text-sm',
						'font-medium text-white hover:bg-blue-700',
					)}
					onClick={() => {
						setEditingUser(null);
						setPanelMode('create');
						setPanelOpen(true);
					}}
				>
					+ Add User
				</button>
			</div>

			{isLoading ? (
				<p className="text-sm text-slate-500">Loading...</p>
			) : (
				<div className="overflow-x-auto rounded-lg border">
					<table
						role="grid"
						className="w-full text-left text-sm"
					>
						<thead className="border-b bg-slate-50">
							{table.getHeaderGroups().map((hg) => (
								<tr key={hg.id}>
									{hg.headers.map((header) => (
										<th
											key={header.id}
											className="px-4 py-3 font-medium text-slate-600"
										>
											{flexRender(
												header.column.columnDef
													.header,
												header.getContext(),
											)}
										</th>
									))}
								</tr>
							))}
						</thead>
						<tbody>
							{table.getRowModel().rows.map((row) => (
								<tr
									key={row.id}
									className="border-b last:border-0 hover:bg-slate-50"
								>
									{row
										.getVisibleCells()
										.map((cell) => (
											<td
												key={cell.id}
												className="px-4 py-3"
											>
												{flexRender(
													cell.column.columnDef
														.cell,
													cell.getContext(),
												)}
											</td>
										))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			<UserSidePanel
				open={panelOpen}
				mode={panelMode}
				user={editingUser}
				onClose={() => setPanelOpen(false)}
				onSave={handleSave}
				loading={
					createMutation.isPending ||
					updateMutation.isPending
				}
			/>
		</div>
	);
}
