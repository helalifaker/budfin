import { useEffect, useMemo, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '../../lib/cn';
import { getCurrentFiscalYear } from '../../lib/format-date';
import { useCreateVersion, useVersions } from '../../hooks/use-versions';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import {
	Select,
	SelectTrigger,
	SelectValue,
	SelectContent,
	SelectItem,
	SelectGroup,
	SelectLabel,
} from '../ui/select';

const createSchema = z.object({
	fiscalYear: z.number().int().min(2000).max(2100),
	name: z.string().min(1, 'Name is required').max(100, 'Name must be \u2264 100 characters'),
	type: z.enum(['Budget', 'Forecast']),
	description: z.string().max(500).optional(),
	sourceVersionId: z.string().optional(),
});

type CreateForm = z.infer<typeof createSchema>;

const CURRENT_FY = getCurrentFiscalYear();
const FY_OPTIONS = Array.from({ length: 5 }, (_, i) => CURRENT_FY - 2 + i);

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
	const { data: allVersionsData } = useVersions();

	const sourceVersionsByFy = useMemo(() => {
		const versions = (allVersionsData?.data ?? []).filter((v) => v.type !== 'Actual');
		const grouped = new Map<number, typeof versions>();
		for (const v of versions) {
			const list = grouped.get(v.fiscalYear) ?? [];
			list.push(v);
			grouped.set(v.fiscalYear, list);
		}
		return Array.from(grouped.entries()).sort(([a], [b]) => b - a);
	}, [allVersionsData]);

	const form = useForm<CreateForm>({
		resolver: zodResolver(createSchema),
		defaultValues: {
			fiscalYear,
			name: '',
			type: 'Budget',
			description: '',
			sourceVersionId: '',
		},
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
		if (open) {
			form.reset({
				fiscalYear,
				name: '',
				type: 'Budget',
				description: '',
				sourceVersionId: '',
			});
		}
	}, [open, form, fiscalYear]);

	if (!open) return null;

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
					'bg-[var(--workspace-bg-card)] shadow-xl',
					'flex flex-col'
				)}
			>
				<div className="border-b px-6 py-4">
					<h2 id={titleId} className="text-[length:var(--text-lg)] font-semibold">
						Create New Version
					</h2>
					<p className="mt-0.5 text-[length:var(--text-sm)] text-[var(--text-muted)]">
						Create a new budget or forecast version
					</p>
				</div>

				<div className="flex-1 overflow-y-auto px-6 py-4">
					<form
						id="create-version-form"
						onSubmit={form.handleSubmit(async (data) => {
							const parsedSourceId = data.sourceVersionId
								? Number(data.sourceVersionId)
								: undefined;
							await mutateAsync({
								name: data.name,
								type: data.type,
								fiscalYear: data.fiscalYear,
								...(data.description ? { description: data.description } : {}),
								...(parsedSourceId ? { sourceVersionId: parsedSourceId } : {}),
							});
							onSuccess(data.name);
						})}
						className="space-y-4"
					>
						<div>
							<label htmlFor="cv-fy" className="block text-[length:var(--text-sm)] font-medium">
								Fiscal Year{' '}
								<span aria-hidden="true" className="text-[var(--color-error)]">
									*
								</span>
							</label>
							<Controller
								control={form.control}
								name="fiscalYear"
								render={({ field }) => (
									<Select
										value={String(field.value)}
										onValueChange={(v) => field.onChange(Number(v))}
									>
										<SelectTrigger id="cv-fy" aria-required="true" className="mt-1">
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
						</div>

						<div>
							<label htmlFor="cv-name" className="block text-[length:var(--text-sm)] font-medium">
								Name{' '}
								<span aria-hidden="true" className="text-[var(--color-error)]">
									*
								</span>
							</label>
							<Input
								id="cv-name"
								type="text"
								aria-required="true"
								maxLength={100}
								className={cn('mt-1', form.formState.errors.name && 'border-[var(--color-error)]')}
								{...form.register('name')}
							/>
							{form.formState.errors.name && (
								<p
									className="mt-1 text-[length:var(--text-xs)] text-[var(--color-error)]"
									role="alert"
								>
									{form.formState.errors.name.message}
								</p>
							)}
						</div>

						<div>
							<label htmlFor="cv-type" className="block text-[length:var(--text-sm)] font-medium">
								Type{' '}
								<span aria-hidden="true" className="text-[var(--color-error)]">
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
							<div className="mt-1.5 space-y-0.5 text-[length:var(--text-xs)] text-[var(--text-muted)]">
								<p>
									<span className="font-medium">Budget:</span> Annual operating plan
								</p>
								<p>
									<span className="font-medium">Forecast:</span> Mid-year revision
								</p>
								<p className="italic">Actual versions are created automatically via data import</p>
							</div>
							{form.formState.errors.type && (
								<p
									className="mt-1 text-[length:var(--text-xs)] text-[var(--color-error)]"
									role="alert"
								>
									{form.formState.errors.type.message}
								</p>
							)}
						</div>

						<div>
							<label
								htmlFor="cv-description"
								className="block text-[length:var(--text-sm)] font-medium"
							>
								Description
							</label>
							<Textarea
								id="cv-description"
								rows={3}
								maxLength={500}
								className="mt-1"
								{...form.register('description')}
							/>
						</div>

						<div>
							<label htmlFor="cv-source" className="block text-[length:var(--text-sm)] font-medium">
								Copy Data From
							</label>
							<Controller
								control={form.control}
								name="sourceVersionId"
								render={({ field }) => (
									<Select
										value={field.value || 'none'}
										onValueChange={(v) => field.onChange(v === 'none' ? '' : v)}
									>
										<SelectTrigger id="cv-source" className="mt-1">
											<SelectValue placeholder="None (start empty)" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="none">None (start empty)</SelectItem>
											{sourceVersionsByFy.map(([fy, versions]) => (
												<SelectGroup key={fy}>
													<SelectLabel>FY{fy}</SelectLabel>
													{versions.map((v) => (
														<SelectItem key={v.id} value={String(v.id)}>
															{v.name} ({v.type}) - FY{v.fiscalYear}
														</SelectItem>
													))}
												</SelectGroup>
											))}
										</SelectContent>
									</Select>
								)}
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
