import { useEffect, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '../../lib/cn';
import { useCreateVersion } from '../../hooks/use-versions';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';

const createSchema = z.object({
	name: z.string().min(1, 'Name is required').max(100, 'Name must be ≤ 100 characters'),
	type: z.enum(['Budget', 'Forecast']),
	description: z.string().max(500).optional(),
});

type CreateForm = z.infer<typeof createSchema>;

export type CreateVersionPanelProps = {
	open: boolean;
	fiscalYear: number;
	onClose: () => void;
	onSuccess: (name: string) => void;
};

export function CreateVersionPanel({
	open,
	fiscalYear,
	onClose,
	onSuccess,
}: CreateVersionPanelProps) {
	const panelRef = useRef<HTMLDivElement>(null);
	const titleId = 'create-version-panel-title';
	const { mutateAsync, isPending } = useCreateVersion();

	const form = useForm<CreateForm>({
		resolver: zodResolver(createSchema),
		defaultValues: { name: '', type: 'Budget', description: '' },
	});

	// Focus trap + Escape
	useEffect(() => {
		if (!open) return;
		const panel = panelRef.current;
		if (!panel) return;

		const focusable = panel.querySelectorAll<HTMLElement>(
			'input, select, textarea, button, [tabindex]:not([tabindex="-1"])'
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

	useEffect(() => {
		if (open) form.reset({ name: '', type: 'Budget', description: '' });
	}, [open, form]);

	if (!open) return null;

	const handleSubmit = form.handleSubmit(async (data) => {
		await mutateAsync({
			name: data.name,
			type: data.type,
			fiscalYear,
			...(data.description ? { description: data.description } : {}),
		});
		onSuccess(data.name);
	});

	return (
		<>
			<div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} aria-hidden="true" />
			<div
				ref={panelRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
				className={cn(
					'fixed right-0 top-0 z-50 h-full w-[480px]',
					'bg-white shadow-xl',
					'flex flex-col'
				)}
			>
				<div className="border-b px-6 py-4">
					<h2 id={titleId} className="text-lg font-semibold">
						New Version
					</h2>
					<p className="mt-0.5 text-sm text-slate-500">Fiscal Year: FY{fiscalYear}</p>
				</div>

				<div className="flex-1 overflow-y-auto px-6 py-4">
					<form id="create-version-form" onSubmit={handleSubmit} className="space-y-4">
						<div>
							<label htmlFor="cv-name" className="block text-sm font-medium">
								Name{' '}
								<span aria-hidden="true" className="text-red-500">
									*
								</span>
							</label>
							<Input
								id="cv-name"
								type="text"
								aria-required="true"
								maxLength={100}
								className={cn('mt-1', form.formState.errors.name && 'border-red-400')}
								{...form.register('name')}
							/>
							{form.formState.errors.name && (
								<p className="mt-1 text-xs text-red-600" role="alert">
									{form.formState.errors.name.message}
								</p>
							)}
						</div>

						<div>
							<label htmlFor="cv-type" className="block text-sm font-medium">
								Type{' '}
								<span aria-hidden="true" className="text-red-500">
									*
								</span>
							</label>
							<Controller
								control={form.control}
								name="type"
								render={({ field }) => (
									<Select value={field.value} onValueChange={field.onChange}>
										<SelectTrigger id="cv-type" aria-required="true" className="mt-1">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="Budget">Budget</SelectItem>
											<SelectItem value="Forecast">Forecast</SelectItem>
										</SelectContent>
									</Select>
								)}
							/>
							{form.formState.errors.type && (
								<p className="mt-1 text-xs text-red-600" role="alert">
									{form.formState.errors.type.message}
								</p>
							)}
						</div>

						<div>
							<label htmlFor="cv-description" className="block text-sm font-medium">
								Description
							</label>
							<textarea
								id="cv-description"
								rows={3}
								maxLength={500}
								className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
								{...form.register('description')}
							/>
						</div>
					</form>
				</div>

				<div className="flex items-center justify-end gap-3 border-t px-6 py-4">
					<Button variant="outline" onClick={onClose} disabled={isPending}>
						Cancel
					</Button>
					<Button type="submit" form="create-version-form" loading={isPending}>
						Create Version
					</Button>
				</div>
			</div>
		</>
	);
}
