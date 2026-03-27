import { useCallback, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { MoreHorizontal } from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import { useAuthStore } from '../../../stores/auth-store';
import { RoleBadge } from '../role-badge';
import { StatusBadge } from '../status-badge';
import { UserSidePanel } from '../user-side-panel';
import { ListGrid } from '../../data-grid/list-grid';
import { Button } from '../../ui/button';
import {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
} from '../../ui/dropdown-menu';
import { toast } from '../../ui/toast-state';

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

/**
 * KPI stats derived from users data.
 * Used by the parent page to populate the AdminKpiRibbon.
 */
export type UsersKpiStats = {
	totalUsers: number;
	activeUsers: number;
	adminCount: number;
	lockedCount: number;
};

export function useUsersKpiStats(): UsersKpiStats | null {
	const { data } = useQuery({
		queryKey: ['users'],
		queryFn: () => apiClient<{ users: User[] }>('/users'),
	});

	return useMemo(() => {
		if (!data) return null;

		const users = data.users;
		return {
			totalUsers: users.length,
			activeUsers: users.filter((u) => u.is_active).length,
			adminCount: users.filter((u) => u.role === 'Admin').length,
			lockedCount: users.filter((u) => u.locked_until !== null).length,
		};
	}, [data]);
}

export function UsersTabContent() {
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
		],
		[]
	);

	const renderActions = useCallback(
		(user: User) => {
			const isSelf = user.id === currentUser?.id;
			if (isSelf) return null;
			return (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-(--workspace-bg-muted)"
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
		[currentUser?.id, handleUnlock, handleForceLogout]
	);

	const table = useReactTable({
		data: data?.users ?? [],
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	return (
		<>
			<div className="flex justify-end pb-4">
				<Button
					type="button"
					variant="primary"
					onClick={() => {
						setEditingUser(null);
						setPanelMode('create');
						setPanelOpen(true);
					}}
				>
					+ Add User
				</Button>
			</div>

			<ListGrid
				table={table}
				isLoading={isLoading}
				actionsColumn={{ render: renderActions }}
				ariaLabel="Users"
			/>

			<UserSidePanel
				open={panelOpen}
				mode={panelMode}
				user={editingUser}
				onClose={() => setPanelOpen(false)}
				onSave={handleSave}
				loading={createMutation.isPending || updateMutation.isPending}
			/>
		</>
	);
}
