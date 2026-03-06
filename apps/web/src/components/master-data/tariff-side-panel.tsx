import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '../../lib/cn';
import type { Tariff } from '../../hooks/use-reference-data';

const tariffSchema = z.object({
	code: z
		.string()
		.min(2, 'Code must be 2-10 characters')
		.max(10)
		.regex(/^[A-Z0-9+]{2,10}$/, 'Must be 2-10 uppercase letters, digits, or +'),
	label: z.string().min(1, 'Label is required').max(100),
	description: z.string().max(500).optional(),
});

type TariffFormValues = z.infer<typeof tariffSchema>;

export type TariffSidePanelProps = {
	open: boolean;
	onClose: () => void;
	tariff?: Tariff | null;
	onSave: (data: TariffFormValues) => void;
	loading?: boolean;
};

export function TariffSidePanel({
	open,
	onClose,
	tariff,
	onSave,
	loading = false,
}: TariffSidePanelProps) {
	const panelRef = useRef<HTMLDivElement>(null);
	const isEdit = !!tariff;

	const form = useForm<TariffFormValues>({
		resolver: zodResolver(tariffSchema),
		...(tariff
			? {
					values: {
						code: tariff.code,
						label: tariff.label,
						description: tariff.description ?? undefined,
					},
				}
			: {}),
		defaultValues: { code: '', label: '', description: '' },
	});

	useEffect(() => {
		if (open && !tariff) {
			form.reset({ code: '', label: '', description: '' });
		}
	}, [open, tariff, form]);

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
			<div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} aria-hidden="true" />
			<div
				ref={panelRef}
				role="dialog"
				aria-modal="true"
				aria-label={isEdit ? 'Edit Tariff' : 'Add Tariff'}
				className={cn(
					'fixed right-0 top-0 z-50 h-full w-[480px]',
					'bg-white shadow-xl',
					'flex flex-col'
				)}
			>
				<div className="border-b px-6 py-4">
					<h2 className="text-lg font-semibold">{isEdit ? `Edit ${tariff.code}` : 'Add Tariff'}</h2>
				</div>

				<div className="flex-1 overflow-y-auto px-6 py-4">
					<form
						id="tariff-form"
						onSubmit={form.handleSubmit((d) => onSave(d))}
						className="space-y-4"
					>
						<div>
							<label htmlFor="tariff-code" className="block text-sm font-medium">
								Code
							</label>
							<input
								id="tariff-code"
								type="text"
								disabled={isEdit}
								className={cn(
									'mt-1 block w-full rounded-md border px-3 py-2 text-sm',
									'uppercase',
									isEdit && 'bg-slate-100 text-slate-500',
									form.formState.errors.code ? 'border-red-500' : 'border-slate-300'
								)}
								{...form.register('code')}
							/>
							{form.formState.errors.code && (
								<p className="mt-1 text-xs text-red-600">{form.formState.errors.code.message}</p>
							)}
						</div>
						<div>
							<label htmlFor="tariff-label" className="block text-sm font-medium">
								Label
							</label>
							<input
								id="tariff-label"
								type="text"
								className={cn(
									'mt-1 block w-full rounded-md border px-3 py-2 text-sm',
									form.formState.errors.label ? 'border-red-500' : 'border-slate-300'
								)}
								{...form.register('label')}
							/>
							{form.formState.errors.label && (
								<p className="mt-1 text-xs text-red-600">{form.formState.errors.label.message}</p>
							)}
						</div>
						<div>
							<label htmlFor="tariff-description" className="block text-sm font-medium">
								Description (optional)
							</label>
							<textarea
								id="tariff-description"
								rows={3}
								className={cn(
									'mt-1 block w-full rounded-md border px-3 py-2 text-sm',
									'border-slate-300 resize-none'
								)}
								{...form.register('description')}
							/>
						</div>
					</form>
				</div>

				<div className="flex justify-end gap-3 border-t px-6 py-4">
					<button
						type="button"
						onClick={onClose}
						className={cn(
							'rounded-md border border-slate-300',
							'px-4 py-2 text-sm font-medium',
							'hover:bg-slate-50'
						)}
					>
						Cancel
					</button>
					<button
						type="submit"
						form="tariff-form"
						disabled={loading}
						className={cn(
							'rounded-md bg-blue-600 px-4 py-2 text-sm',
							'font-medium text-white',
							'hover:bg-blue-700',
							'disabled:opacity-50'
						)}
					>
						{loading ? 'Saving...' : 'Save'}
					</button>
				</div>
			</div>
		</>
	);
}
