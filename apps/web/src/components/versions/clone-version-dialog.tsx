import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '../../lib/cn';
import { useCloneVersion } from '../../hooks/use-versions';
import type { BudgetVersion } from '../../hooks/use-versions';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from '../ui/dialog';

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

export function CloneVersionDialog({ open, source, onClose, onSuccess }: CloneVersionDialogProps) {
	const { mutateAsync, isPending } = useCloneVersion();
	const [progress, setProgress] = useState(false);

	const form = useForm<CloneForm>({
		resolver: zodResolver(cloneSchema),
		defaultValues: { name: '', description: '' },
	});

	useEffect(() => {
		if (open && source) {
			form.reset({ name: `${source.name} Copy`, description: '' });
		}
	}, [open, source, form]);

	if (!open || !source) return null;

	const isActual = source.type === 'Actual';

	const handleSubmit = form.handleSubmit(async (data) => {
		setProgress(true);
		try {
			await mutateAsync({
				id: source.id,
				name: data.name,
				...(data.description ? { description: data.description } : {}),
			});
			onSuccess(data.name, source.name);
		} finally {
			setProgress(false);
		}
	});

	return (
		<Dialog open={open} onOpenChange={(v) => !v && onClose()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Clone Version</DialogTitle>
					<DialogDescription>
						Cloning from: <span className="font-medium">{source.name}</span>
					</DialogDescription>
				</DialogHeader>

				{isActual && (
					<div className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
						Actual versions cannot be cloned.
					</div>
				)}

				{!isActual && (
					<>
						{progress && (
							<div>
								<p className="mb-1 text-xs text-slate-500">Copying version data...</p>
								<div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
									<div className="h-full animate-[indeterminate_1.5s_ease-in-out_infinite] rounded-full bg-blue-600" />
								</div>
							</div>
						)}

						<form id="clone-version-form" onSubmit={handleSubmit} className="space-y-4">
							<div>
								<label htmlFor="clone-name" className="block text-sm font-medium">
									Name{' '}
									<span aria-hidden="true" className="text-red-500">
										*
									</span>
								</label>
								<Input
									id="clone-name"
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
								<label htmlFor="clone-description" className="block text-sm font-medium">
									Description
								</label>
								<textarea
									id="clone-description"
									rows={2}
									maxLength={500}
									className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
									{...form.register('description')}
								/>
							</div>
						</form>
					</>
				)}

				<DialogFooter>
					<Button variant="outline" onClick={onClose} disabled={isPending}>
						Cancel
					</Button>
					{!isActual && (
						<Button type="submit" form="clone-version-form" loading={isPending}>
							Clone Version
						</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
