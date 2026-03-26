import { useEffect, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '../../lib/cn';
import type { BandMapping, Department } from '../../hooks/use-reference-data';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';

const BAND_OPTIONS: { value: BandMapping; label: string }[] = [
	{ value: 'MATERNELLE', label: 'Maternelle' },
	{ value: 'ELEMENTAIRE', label: 'Elementaire' },
	{ value: 'COLLEGE', label: 'College' },
	{ value: 'LYCEE', label: 'Lycee' },
	{ value: 'NON_ACADEMIC', label: 'Non-Academic' },
];

const departmentSchema = z.object({
	code: z
		.string()
		.min(2, 'Code must be 2-20 characters')
		.max(20)
		.regex(/^[A-Z_]{2,20}$/, 'Must be 2-20 uppercase letters or underscores'),
	label: z.string().min(1, 'Label is required').max(100),
	bandMapping: z.enum(['MATERNELLE', 'ELEMENTAIRE', 'COLLEGE', 'LYCEE', 'NON_ACADEMIC']),
});

type DepartmentFormValues = z.infer<typeof departmentSchema>;

export type DepartmentSidePanelProps = {
	open: boolean;
	onClose: () => void;
	department?: Department | null;
	onSave: (data: DepartmentFormValues) => void;
	loading?: boolean;
};

export function DepartmentSidePanel({
	open,
	onClose,
	department,
	onSave,
	loading = false,
}: DepartmentSidePanelProps) {
	const panelRef = useRef<HTMLDivElement>(null);
	const isEdit = !!department;

	const form = useForm<DepartmentFormValues>({
		resolver: zodResolver(departmentSchema),
		...(department
			? {
					values: {
						code: department.code,
						label: department.label,
						bandMapping: department.bandMapping,
					},
				}
			: {}),
		defaultValues: {
			code: '',
			label: '',
			bandMapping: 'MATERNELLE',
		},
	});

	useEffect(() => {
		if (open && !department) {
			form.reset({
				code: '',
				label: '',
				bandMapping: 'MATERNELLE',
			});
		}
	}, [open, department, form]);

	useEffect(() => {
		if (!open) return;
		const panel = panelRef.current;
		if (!panel) return;

		const focusable = panel.querySelectorAll<HTMLElement>(
			'input, select, button, textarea, [tabindex]:not([tabindex="-1"])'
		);
		const first = focusable[0];
		const last = focusable[focusable.length - 1];
		first?.focus();

		function handleKeyDown(e: KeyboardEvent) {
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

		panel.addEventListener('keydown', handleKeyDown);
		return () => panel.removeEventListener('keydown', handleKeyDown);
	}, [open, onClose]);

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
				aria-label={isEdit ? 'Edit Department' : 'Add Department'}
				className={cn(
					'fixed right-0 top-0 z-50 h-full w-[480px]',
					'bg-(--workspace-bg-card) shadow-xl',
					'flex flex-col'
				)}
			>
				<div className="border-b px-6 py-4">
					<h2 className="text-(--text-lg) font-semibold">
						{isEdit ? `Edit ${department.code}` : 'Add Department'}
					</h2>
				</div>

				<div className="flex-1 overflow-y-auto px-6 py-4">
					<form
						id="department-form"
						onSubmit={form.handleSubmit((d) => onSave(d))}
						className="space-y-4"
					>
						<div>
							<label htmlFor="dept-code" className="block text-(--text-sm) font-medium">
								Code
							</label>
							<Input
								id="dept-code"
								type="text"
								disabled={isEdit}
								className={cn(
									'mt-1 uppercase',
									isEdit && 'bg-(--workspace-bg-muted) text-(--text-muted)',
									form.formState.errors.code && 'border-(--color-error)'
								)}
								{...form.register('code')}
							/>
							{form.formState.errors.code && (
								<p className="mt-1 text-(--text-xs) text-(--color-error)">
									{form.formState.errors.code.message}
								</p>
							)}
						</div>
						<div>
							<label htmlFor="dept-label" className="block text-(--text-sm) font-medium">
								Label
							</label>
							<Input
								id="dept-label"
								type="text"
								className={cn('mt-1', form.formState.errors.label && 'border-(--color-error)')}
								{...form.register('label')}
							/>
							{form.formState.errors.label && (
								<p className="mt-1 text-(--text-xs) text-(--color-error)">
									{form.formState.errors.label.message}
								</p>
							)}
						</div>
						<div>
							<label htmlFor="dept-band" className="block text-(--text-sm) font-medium">
								Band Mapping
							</label>
							<Controller
								control={form.control}
								name="bandMapping"
								render={({ field }) => (
									<Select value={field.value} onValueChange={field.onChange}>
										<SelectTrigger id="dept-band" className="mt-1">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{BAND_OPTIONS.map((opt) => (
												<SelectItem key={opt.value} value={opt.value}>
													{opt.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								)}
							/>
						</div>
					</form>
				</div>

				<div className="flex justify-end gap-3 border-t px-6 py-4">
					<Button type="button" variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button type="submit" form="department-form" loading={loading}>
						Save
					</Button>
				</div>
			</div>
		</>
	);
}
