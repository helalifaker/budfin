import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
	createColumnHelper,
	flexRender,
	getCoreRowModel,
	useReactTable,
} from '@tanstack/react-table';
import { MoreHorizontal } from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { useAuthStore } from '../../stores/auth-store';
import { RoleBadge } from '../../components/admin/role-badge';
import { StatusBadge } from '../../components/admin/status-badge';
import { UserSidePanel } from '../../components/admin/user-side-panel';
import { Button } from '../../components/ui/button';
import { TableSkeleton } from '../../components/ui/skeleton';
import {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
} from '../../components/ui/dropdown-menu';
import { toast } from '../../components/ui/toast-state';

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
	const [panelMode, setPanelMode] = useState<'create' | 'edit'>('create');
	const [editingUser, setEditingUser] = useState<User | null>(null);

	const { data, isLoading } = useQuery({
		queryKey: ['users'],
		queryFn: () => apiClient<{ users: User[] }>('/users'),
	});

	const createMutation = useMutation({
		mutationFn: (body: { email: string; password: string; role: string }) =>
			apiClient('/users', {
				method: 'POST',
				body: JSON.stringify(body),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['users'] });
			setPanelOpen(false);
			toast.success('User created successfully');
		},
		onError: () => {
			toast.error('Failed to create user');
		},
	});

	const updateMutation = useMutation({
		mutationFn: ({ id, ...body }: Record<string, unknown> & { id: number }) =>
			apiClient(`/users/${id}`, {
				method: 'PATCH',
				body: JSON.stringify(body),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['users'] });
			setPanelOpen(false);
			toast.success('User updated successfully');
		},
		onError: () => {
			toast.error('Failed to update user');
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
					}
				);
			} else if (editingUser) {
				updateMutation.mutate({
					id: editingUser.id,
					...formData,
				});
			}
		},
		[panelMode, editingUser, createMutation, updateMutation]
	);

	const handleUnlock = useCallback(
		(user: User) => {
			updateMutation.mutate({
				id: user.id,
				unlock_account: true,
			});
		},
		[updateMutation]
	);

	const handleForceLogout = useCallback(
		(user: User) => {
			updateMutation.mutate({
				id: user.id,
				force_session_revoke: true,
			});
		},
		[updateMutation]
	);

	const columns = useMemo(
		() => [
			columnHelper.accessor('email', {
				header: 'Email',
				cell: (info) => <span className="font-medium">{info.getValue()}</span>,
			}),
			columnHelper.accessor('role', {
				header: 'Role',
				cell: (info) => <RoleBadge role={info.getValue() as RoleVariant} />,
			}),
			columnHelper.accessor('is_active', {
				header: 'Status',
				cell: (info) => <StatusBadge isActive={info.getValue()} />,
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
					if (isSelf) return null;
					return (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<button
									type="button"
									className="inline-flex h-8 w-8 items-center justify-center
										rounded-(--radius-md) hover:bg-(--workspace-bg-muted)"
									aria-label={`Actions for ${user.email}`}
								>
									<MoreHorizontal className="h-4 w-4 text-(--text-muted)" />
								</button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem
									onSelect={() => {
										setEditingUser(user);
										setPanelMode('edit');
										setPanelOpen(true);
									}}
								>
									Edit
								</DropdownMenuItem>
								{user.locked_until && (
									<>
										<DropdownMenuSeparator />
										<DropdownMenuItem onSelect={() => handleUnlock(user)}>
											Unlock Account
										</DropdownMenuItem>
									</>
								)}
								<DropdownMenuSeparator />
								<DropdownMenuItem destructive onSelect={() => handleForceLogout(user)}>
									Force Logout
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					);
				},
			}),
		],
		[currentUser?.id, handleUnlock, handleForceLogout]
	);

	const table = useReactTable({
		data: data?.users ?? [],
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	const [showSkeleton, setShowSkeleton] = useState(false);
	useEffect(() => {
		if (!isLoading) {
			const t = setTimeout(() => setShowSkeleton(false), 0);
			return () => clearTimeout(t);
		}
		const t = setTimeout(() => setShowSkeleton(true), 200);
		return () => clearTimeout(t);
	}, [isLoading]);

	return (
		<div className="p-6">
			<div className="flex items-center justify-between pb-4">
				<h1 className="text-(--text-xl) font-semibold">User Management</h1>
				<Button
					type="button"
					onClick={() => {
						setEditingUser(null);
						setPanelMode('create');
						setPanelOpen(true);
					}}
				>
					+ Add User
				</Button>
			</div>

			<div className="overflow-x-auto rounded-(--radius-lg) border">
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
							<TableSkeleton rows={5} cols={8} />
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

			<UserSidePanel
				open={panelOpen}
				mode={panelMode}
				user={editingUser}
				onClose={() => setPanelOpen(false)}
				onSave={handleSave}
				loading={createMutation.isPending || updateMutation.isPending}
			/>
		</div>
	);
}
