import { useEffect, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '../../lib/cn';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';

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

	return (
		<>
			<div
				className="fixed inset-0 z-40 bg-(--overlay-bg-subtle)"
				onClick={onClose}
				aria-hidden="true"
			/>
			<div
				ref={panelRef}
				role="dialog"
				aria-modal="true"
				aria-label={mode === 'create' ? 'Add User' : 'Edit User'}
				className={cn(
					'fixed right-0 top-0 z-50 h-full w-[480px]',
					'bg-(--workspace-bg-card) shadow-xl',
					'flex flex-col'
				)}
			>
				<div className="border-b px-6 py-4">
					<h2 className="text-(--text-lg) font-semibold">
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
								<label htmlFor="email" className="block text-(--text-sm) font-medium">
									Email
								</label>
								<Input
									id="email"
									type="email"
									className={cn(
										'mt-1',
										createForm.formState.errors.email && 'border-(--color-error)'
									)}
									{...createForm.register('email')}
								/>
								{createForm.formState.errors.email && (
									<p className="mt-1 text-(--text-xs) text-(--color-error)">
										{createForm.formState.errors.email.message}
									</p>
								)}
							</div>
							<div>
								<label htmlFor="password" className="block text-(--text-sm) font-medium">
									Password
								</label>
								<Input
									id="password"
									type="password"
									className={cn(
										'mt-1',
										createForm.formState.errors.password && 'border-(--color-error)'
									)}
									{...createForm.register('password')}
								/>
								{createForm.formState.errors.password && (
									<p className="mt-1 text-(--text-xs) text-(--color-error)">
										{createForm.formState.errors.password.message}
									</p>
								)}
							</div>
							<div>
								<label htmlFor="role" className="block text-(--text-sm) font-medium">
									Role
								</label>
								<Controller
									control={createForm.control}
									name="role"
									render={({ field }) => (
										<Select value={field.value} onValueChange={field.onChange}>
											<SelectTrigger id="role" className="mt-1">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{ROLES.map((r) => (
													<SelectItem key={r} value={r}>
														{ROLE_LABELS[r]}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									)}
								/>
							</div>
						</form>
					) : (
						<form
							id="user-form"
							onSubmit={editForm.handleSubmit((d) => onSave(d))}
							className="space-y-4"
						>
							<div>
								<label htmlFor="edit-role" className="block text-(--text-sm) font-medium">
									Role
								</label>
								<Controller
									control={editForm.control}
									name="role"
									render={({ field }) => (
										<Select value={field.value} onValueChange={field.onChange}>
											<SelectTrigger id="edit-role" className="mt-1">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{ROLES.map((r) => (
													<SelectItem key={r} value={r}>
														{ROLE_LABELS[r]}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									)}
								/>
							</div>
							<Controller
								control={editForm.control}
								name="is_active"
								render={({ field }) => (
									<div className="flex items-center gap-3">
										<Checkbox
											id="is-active"
											checked={field.value}
											onCheckedChange={field.onChange}
										/>
										<label htmlFor="is-active" className="text-(--text-sm) font-medium">
											Active
										</label>
									</div>
								)}
							/>
							<Controller
								control={editForm.control}
								name="force_password_reset"
								render={({ field }) => (
									<div className="flex items-center gap-3">
										<Checkbox
											id="force-reset"
											checked={field.value}
											onCheckedChange={field.onChange}
										/>
										<label htmlFor="force-reset" className="text-(--text-sm) font-medium">
											Force Password Reset
										</label>
									</div>
								)}
							/>
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
