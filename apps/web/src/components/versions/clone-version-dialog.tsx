import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '../../lib/cn';
import { useCloneVersion } from '../../hooks/use-versions';
import type { BudgetVersion } from '../../hooks/use-versions';

const cloneSchema = z.object({
	name: z.string().min(1, 'Name is required').max(100, 'Name must be ≤ 100 characters'),
	description: z.string().max(500).optional(),
});

type CloneForm = z.infer<typeof cloneSchema>;

export type CloneVersionDialogProps = {
	open: boolean;
	source: BudgetVersion | null;
	onClose: () => void;
	onSuccess: (clonedName: string, sourceName: string) => void;
};

export function CloneVersionDialog({
	open,
	source,
	onClose,
	onSuccess,
}: CloneVersionDialogProps) {
	const dialogRef = useRef<HTMLDivElement>(null);
	const titleId = 'clone-version-dialog-title';
	const { mutateAsync, isPending } = useCloneVersion();
	const [progress, setProgress] = useState(false);

	const form = useForm<CloneForm>({
		resolver: zodResolver(cloneSchema),
		defaultValues: { name: '', description: '' },
	});

	// Focus trap + Escape
	useEffect(() => {
		if (!open) return;
		const dialog = dialogRef.current;
		if (!dialog) return;

		const focusable = dialog.querySelectorAll<HTMLElement>(
			'input, select, textarea, button, [tabindex]:not([tabindex="-1"])',
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

		dialog.addEventListener('keydown', handleKeyDown);
		return () => dialog.removeEventListener('keydown', handleKeyDown);
	}, [open, onClose]);

	useEffect(() => {
		if (open && source) {
			form.reset({ name: `${source.name} Copy`, description: '' });
		}
	}, [open, source, form]);

	if (!open || !source) return null;

	// Clone button is disabled for Actual type versions (AC-12)
	const isActual = source.type === 'Actual';

	const handleSubmit = form.handleSubmit(async (data) => {
		setProgress(true);
		try {
			await mutateAsync({ id: source.id, name: data.name });
			onSuccess(data.name, source.name);
		} finally {
			setProgress(false);
		}
	});

	return (
		<>
			<div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} aria-hidden="true" />
			<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
				<div
					ref={dialogRef}
					role="dialog"
					aria-modal="true"
					aria-labelledby={titleId}
					className="w-[480px] rounded-lg bg-white shadow-xl"
				>
					<div className="border-b px-6 py-4">
						<h2 id={titleId} className="text-lg font-semibold">
							Clone Version
						</h2>
						<p className="mt-0.5 text-sm text-slate-500">
							Cloning from: <span className="font-medium">{source.name}</span>
						</p>
					</div>

					{isActual && (
						<div className="mx-6 mt-4 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
							Actual versions cannot be cloned.
						</div>
					)}

					{!isActual && (
						<>
							{progress && (
								<div className="px-6 pt-4">
									<p className="mb-1 text-xs text-slate-500">Copying version data...</p>
									<div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
										<div className="h-full animate-[indeterminate_1.5s_ease-in-out_infinite] rounded-full bg-blue-600" />
									</div>
								</div>
							)}

							<div className="px-6 py-4">
								<form id="clone-version-form" onSubmit={handleSubmit} className="space-y-4">
									<div>
										<label htmlFor="clone-name" className="block text-sm font-medium">
											Name <span aria-hidden="true" className="text-red-500">*</span>
										</label>
										<input
											id="clone-name"
											type="text"
											aria-required="true"
											maxLength={100}
											className={cn(
												'mt-1 w-full rounded-md border px-3 py-2 text-sm',
												form.formState.errors.name ? 'border-red-400' : 'border-slate-300',
											)}
											{...form.register('name')}
										/>
										{form.formState.errors.name && (
											<p className="mt-1 text-xs text-red-600" role="alert">
												{form.formState.errors.name.message}
											</p>
										)}
									</div>

									<div>
										<label htmlFor="clone-description" className="block text-sm font-medium">
											Description
										</label>
										<textarea
											id="clone-description"
											rows={2}
											maxLength={500}
											className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
											{...form.register('description')}
										/>
									</div>
								</form>
							</div>
						</>
					)}

					<div className="flex items-center justify-end gap-3 border-t px-6 py-4">
						<button
							type="button"
							onClick={onClose}
							disabled={isPending}
							className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
						>
							Cancel
						</button>
						{!isActual && (
							<button
								type="submit"
								form="clone-version-form"
								disabled={isPending}
								className={cn(
									'rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white',
									'hover:bg-blue-700 disabled:opacity-50',
								)}
							>
								{isPending ? 'Cloning...' : 'Clone Version'}
							</button>
						)}
					</div>
				</div>
			</div>
		</>
	);
}
