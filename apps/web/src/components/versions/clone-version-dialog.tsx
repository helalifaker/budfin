import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '../../lib/cn';
import { getCurrentFiscalYear } from '../../lib/format-date';
import { useCloneVersion } from '../../hooks/use-versions';
import type { BudgetVersion } from '../../hooks/use-versions';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Checkbox } from '../ui/checkbox';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from '../ui/dialog';

const cloneSchema = z.object({
	name: z.string().min(1, 'Name is required').max(100, 'Name must be \u2264 100 characters'),
	description: z.string().max(500),
	fiscalYear: z.number().int().min(2000).max(2100),
	includeEnrollment: z.boolean(),
	includeSummaries: z.boolean(),
});

type CloneForm = z.infer<typeof cloneSchema>;

const CURRENT_FY = getCurrentFiscalYear();
const FY_OPTIONS = Array.from({ length: 5 }, (_, i) => CURRENT_FY - 2 + i);

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
		defaultValues: {
			name: '',
			description: '',
			fiscalYear: source?.fiscalYear ?? CURRENT_FY,
			includeEnrollment: true,
			includeSummaries: true,
		},
	});

	const watchedFy = form.watch('fiscalYear');
	const isCrossYear = source != null && watchedFy != null && watchedFy !== source.fiscalYear;

	useEffect(() => {
		if (open && source) {
			form.reset({
				name: `${source.name} Copy`,
				description: '',
				fiscalYear: source.fiscalYear,
				includeEnrollment: true,
				includeSummaries: true,
			});
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
				...(data.fiscalYear ? { fiscalYear: data.fiscalYear } : {}),
				includeEnrollment: data.includeEnrollment,
				includeSummaries: data.includeSummaries,
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
					<div className="rounded-(--radius-md) bg-(--color-warning-bg) px-4 py-3 text-(--text-sm) text-(--color-warning)">
						Actual versions cannot be cloned.
					</div>
				)}

				{!isActual && (
					<>
						{progress && (
							<div>
								<p className="mb-1 text-(--text-xs) text-(--text-muted)">Copying version data...</p>
								<div className="h-1.5 w-full overflow-hidden rounded-(--radius-sm) bg-(--workspace-border)">
									<div className="h-full animate-[indeterminate_1.5s_ease-in-out_infinite] rounded-(--radius-sm) bg-(--accent-500)" />
								</div>
							</div>
						)}

						<form id="clone-version-form" onSubmit={handleSubmit} className="space-y-4">
							<div>
								<label htmlFor="clone-name" className="block text-(--text-sm) font-medium">
									Name{' '}
									<span aria-hidden="true" className="text-(--color-error)">
										*
									</span>
								</label>
								<Input
									id="clone-name"
									type="text"
									aria-required="true"
									maxLength={100}
									className={cn('mt-1', form.formState.errors.name && 'border-(--color-error)')}
									{...form.register('name')}
								/>
								{form.formState.errors.name && (
									<p className="mt-1 text-(--text-xs) text-(--color-error)" role="alert">
										{form.formState.errors.name.message}
									</p>
								)}
							</div>

							<div>
								<label htmlFor="clone-description" className="block text-(--text-sm) font-medium">
									Description
								</label>
								<Textarea
									id="clone-description"
									rows={2}
									maxLength={500}
									className="mt-1"
									{...form.register('description')}
								/>
							</div>

							<div>
								<label htmlFor="clone-fy" className="block text-(--text-sm) font-medium">
									Target Fiscal Year
								</label>
								<Controller
									control={form.control}
									name="fiscalYear"
									render={({ field }) => (
										<Select
											value={String(field.value)}
											onValueChange={(v) => field.onChange(Number(v))}
										>
											<SelectTrigger id="clone-fy" className="mt-1">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{FY_OPTIONS.map((fy) => (
													<SelectItem key={fy} value={String(fy)}>
														FY{fy}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									)}
								/>
								{isCrossYear && (
									<div className="mt-2 rounded-(--radius-md) bg-[var(--color-info-bg,var(--accent-50))] px-3 py-2 text-(--text-xs) text-[var(--color-info,var(--accent-700))]">
										Cross-year clone: data will be copied from FY{source.fiscalYear} to FY
										{watchedFy}
									</div>
								)}
							</div>

							<fieldset className="space-y-3">
								<legend className="text-(--text-sm) font-medium">Data to Include</legend>

								<Controller
									control={form.control}
									name="includeEnrollment"
									render={({ field }) => (
										<div className="flex items-start gap-2">
											<Checkbox
												id="clone-enrollment"
												checked={field.value}
												onCheckedChange={field.onChange}
												className="mt-0.5"
											/>
											<div>
												<label
													htmlFor="clone-enrollment"
													className="text-(--text-sm) font-medium cursor-pointer"
												>
													Include Enrollment Data
												</label>
												<p className="text-(--text-xs) text-(--text-muted)">
													Copy student enrollment counts and grade configurations
												</p>
											</div>
										</div>
									)}
								/>

								<Controller
									control={form.control}
									name="includeSummaries"
									render={({ field }) => (
										<div className="flex items-start gap-2">
											<Checkbox
												id="clone-summaries"
												checked={field.value}
												onCheckedChange={field.onChange}
												className="mt-0.5"
											/>
											<div>
												<label
													htmlFor="clone-summaries"
													className="text-(--text-sm) font-medium cursor-pointer"
												>
													Include Budget Summaries
												</label>
												<p className="text-(--text-xs) text-(--text-muted)">
													Copy revenue, cost, and P&L summary data
												</p>
											</div>
										</div>
									)}
								/>
							</fieldset>

							<p className="text-(--text-xs) italic text-(--text-muted)">
								Cloned versions start as Draft with all modules marked stale
							</p>
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
