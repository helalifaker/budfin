import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '../../lib/cn';
import { Input } from '../ui/input';
import { Button } from '../ui/button';

const createSchema = z.object({
	email: z.string().email('Invalid email'),
	password: z.string().min(8, 'Minimum 8 characters'),
	role: z.enum(['Admin', 'BudgetOwner', 'Editor', 'Viewer']),
});

const editSchema = z.object({
	role: z.enum(['Admin', 'BudgetOwner', 'Editor', 'Viewer']),
	is_active: z.boolean(),
	force_password_reset: z.boolean(),
});

type CreateValues = z.infer<typeof createSchema>;
type EditValues = z.infer<typeof editSchema>;

interface User {
	id: number;
	email: string;
	role: string;
	is_active: boolean;
}

interface UserSidePanelProps {
	open: boolean;
	mode: 'create' | 'edit';
	user?: User | null;
	onClose: () => void;
	onSave: (data: Record<string, unknown>) => void;
	loading?: boolean;
}

const ROLES = ['Admin', 'BudgetOwner', 'Editor', 'Viewer'] as const;
const ROLE_LABELS: Record<string, string> = {
	Admin: 'Admin',
	BudgetOwner: 'Budget Owner',
	Editor: 'Editor',
	Viewer: 'Viewer',
};

export function UserSidePanel({
	open,
	mode,
	user,
	onClose,
	onSave,
	loading = false,
}: UserSidePanelProps) {
	const panelRef = useRef<HTMLDivElement>(null);

	const createForm = useForm<CreateValues>({
		resolver: zodResolver(createSchema),
		defaultValues: { email: '', password: '', role: 'Viewer' },
	});

	const editFormOptions = user
		? {
				resolver: zodResolver(editSchema),
				values: {
					role: user.role as EditValues['role'],
					is_active: user.is_active,
					force_password_reset: false,
				},
			}
		: {
				resolver: zodResolver(editSchema),
				defaultValues: {
					role: 'Viewer' as const,
					is_active: true,
					force_password_reset: false,
				},
			};
	const editForm = useForm<EditValues>(editFormOptions);

	// Focus trap
	useEffect(() => {
		if (!open) return;
		const panel = panelRef.current;
		if (!panel) return;

		const focusable = panel.querySelectorAll<HTMLElement>(
			'input, select, button, [tabindex]:not([tabindex="-1"])'
		);
		const first = focusable[0];
		const last = focusable[focusable.length - 1];
		first?.focus();

		function handleTab(e: KeyboardEvent) {
			if (e.key === 'Escape') {
				onClose();
				return;
			}
			if (e.key !== 'Tab') return;
			if (e.shiftKey && document.activeElement === first) {
				e.preventDefault();
				last?.focus();
			} else if (!e.shiftKey && document.activeElement === last) {
				e.preventDefault();
				first?.focus();
			}
		}

		panel.addEventListener('keydown', handleTab);
		return () => panel.removeEventListener('keydown', handleTab);
	}, [open, onClose]);

	useEffect(() => {
		if (open && mode === 'create') {
			createForm.reset();
		}
	}, [open, mode, createForm]);

	if (!open) return null;

	const selectClassName = cn(
		'flex h-9 w-full rounded-md border border-slate-300 bg-white',
		'px-3 py-2 text-sm text-slate-900',
		'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
		'disabled:cursor-not-allowed disabled:opacity-50'
	);

	return (
		<>
			<div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} aria-hidden="true" />
			<div
				ref={panelRef}
				role="dialog"
				aria-modal="true"
				aria-label={mode === 'create' ? 'Add User' : 'Edit User'}
				className={cn(
					'fixed right-0 top-0 z-50 h-full w-[480px]',
					'bg-white shadow-xl',
					'flex flex-col'
				)}
			>
				<div className="border-b px-6 py-4">
					<h2 className="text-lg font-semibold">
						{mode === 'create' ? 'Add User' : `Edit ${user?.email ?? 'User'}`}
					</h2>
				</div>

				<div className="flex-1 overflow-y-auto px-6 py-4">
					{mode === 'create' ? (
						<form
							id="user-form"
							onSubmit={createForm.handleSubmit((d) => onSave(d))}
							className="space-y-4"
						>
							<div>
								<label htmlFor="email" className="block text-sm font-medium">
									Email
								</label>
								<Input
									id="email"
									type="email"
									className={cn('mt-1', createForm.formState.errors.email && 'border-red-500')}
									{...createForm.register('email')}
								/>
								{createForm.formState.errors.email && (
									<p className="mt-1 text-xs text-red-600">
										{createForm.formState.errors.email.message}
									</p>
								)}
							</div>
							<div>
								<label htmlFor="password" className="block text-sm font-medium">
									Password
								</label>
								<Input
									id="password"
									type="password"
									className={cn('mt-1', createForm.formState.errors.password && 'border-red-500')}
									{...createForm.register('password')}
								/>
								{createForm.formState.errors.password && (
									<p className="mt-1 text-xs text-red-600">
										{createForm.formState.errors.password.message}
									</p>
								)}
							</div>
							<div>
								<label htmlFor="role" className="block text-sm font-medium">
									Role
								</label>
								<select
									id="role"
									className={cn(selectClassName, 'mt-1')}
									{...createForm.register('role')}
								>
									{ROLES.map((r) => (
										<option key={r} value={r}>
											{ROLE_LABELS[r]}
										</option>
									))}
								</select>
							</div>
						</form>
					) : (
						<form
							id="user-form"
							onSubmit={editForm.handleSubmit((d) => onSave(d))}
							className="space-y-4"
						>
							<div>
								<label htmlFor="edit-role" className="block text-sm font-medium">
									Role
								</label>
								<select
									id="edit-role"
									className={cn(selectClassName, 'mt-1')}
									{...editForm.register('role')}
								>
									{ROLES.map((r) => (
										<option key={r} value={r}>
											{ROLE_LABELS[r]}
										</option>
									))}
								</select>
							</div>
							<div className="flex items-center gap-3">
								<input
									id="is-active"
									type="checkbox"
									className="h-4 w-4 rounded"
									{...editForm.register('is_active')}
								/>
								<label htmlFor="is-active" className="text-sm font-medium">
									Active
								</label>
							</div>
							<div className="flex items-center gap-3">
								<input
									id="force-reset"
									type="checkbox"
									className="h-4 w-4 rounded"
									{...editForm.register('force_password_reset')}
								/>
								<label htmlFor="force-reset" className="text-sm font-medium">
									Force Password Reset
								</label>
							</div>
						</form>
					)}
				</div>

				<div className="border-t px-6 py-4 flex justify-end gap-3">
					<Button type="button" variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button type="submit" form="user-form" loading={loading}>
						{loading ? 'Saving...' : 'Save'}
					</Button>
				</div>
			</div>
		</>
	);
}
