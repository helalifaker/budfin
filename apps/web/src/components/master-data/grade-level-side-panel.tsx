import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '../../lib/cn';
import { useUpdateGradeLevel, type GradeLevel } from '../../hooks/use-grade-levels';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { toast } from '../ui/toast-state';

const baseGradeLevelSchema = z.object({
	maxClassSize: z.coerce.number().int().min(1).max(50),
	defaultAy2Intake: z.coerce.number().int().min(0).max(200).nullable(),
	plancherPct: z.coerce.number().min(0).max(1),
	ciblePct: z.coerce.number().min(0).max(1),
	plafondPct: z.coerce.number().min(0).max(1),
	displayOrder: z.coerce.number().int().min(0),
});

const gradeLevelSchema = baseGradeLevelSchema.refine(
	(d) => d.plancherPct <= d.ciblePct && d.ciblePct <= d.plafondPct,
	{
		message: 'Must satisfy: plancher <= cible <= plafond',
		path: ['plafondPct'],
	}
);

type FormValues = z.infer<typeof baseGradeLevelSchema>;

export type GradeLevelSidePanelProps = {
	open: boolean;
	onClose: () => void;
	gradeLevel?: GradeLevel | null;
};

export function GradeLevelSidePanel({ open, onClose, gradeLevel }: GradeLevelSidePanelProps) {
	const panelRef = useRef<HTMLDivElement>(null);
	const updateMutation = useUpdateGradeLevel();

	const {
		register,
		handleSubmit,
		reset,
		formState: { errors },
	} = useForm<FormValues>({
		// eslint-disable-next-line @typescript-eslint/no-explicit-any -- refined schema input type mismatch with useForm
		resolver: zodResolver(gradeLevelSchema) as any,
		defaultValues: {
			maxClassSize: 25,
			defaultAy2Intake: null,
			plancherPct: 0,
			ciblePct: 0,
			plafondPct: 0,
			displayOrder: 0,
		},
	});

	useEffect(() => {
		if (!open || !gradeLevel) return;
		reset({
			maxClassSize: gradeLevel.maxClassSize,
			defaultAy2Intake: gradeLevel.defaultAy2Intake,
			plancherPct: Number(gradeLevel.plancherPct),
			ciblePct: Number(gradeLevel.ciblePct),
			plafondPct: Number(gradeLevel.plafondPct),
			displayOrder: gradeLevel.displayOrder,
		});
	}, [open, gradeLevel, reset]);

	// Focus trap + Escape
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

	function onSubmit(data: FormValues) {
		if (!gradeLevel) return;
		updateMutation.mutate(
			{
				id: gradeLevel.id,
				version: gradeLevel.version,
				maxClassSize: data.maxClassSize,
				defaultAy2Intake: data.defaultAy2Intake,
				plancherPct: String(data.plancherPct),
				ciblePct: String(data.ciblePct),
				plafondPct: String(data.plafondPct),
				displayOrder: data.displayOrder,
			},
			{
				onSuccess: () => {
					onClose();
					toast.success('Grade level updated');
				},
				onError: () => {
					toast.error('Failed to update grade level');
				},
			}
		);
	}

	if (!open || !gradeLevel) return null;

	const inputClass = (hasError: boolean) => cn('mt-1', hasError && 'border-(--color-error)');

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
				aria-label={`Edit Grade Level — ${gradeLevel.gradeName}`}
				className={cn(
					'fixed right-0 top-0 z-50 h-full w-[480px]',
					'bg-(--workspace-bg-card) shadow-xl',
					'flex flex-col'
				)}
			>
				<div className="border-b px-6 py-4">
					<h2 className="text-(--text-lg) font-semibold">
						Edit Grade Level — {gradeLevel.gradeName}
					</h2>
					<p className="mt-1 text-(--text-sm) text-(--text-muted)">
						These values seed new enrollment versions. Live planning settings are now managed from
						Enrollment.
					</p>
				</div>

				<div className="flex-1 overflow-y-auto px-6 py-4">
					<form id="grade-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
						<div>
							<label htmlFor="gl-code" className="block text-(--text-sm) font-medium">
								Grade Code
							</label>
							<Input
								id="gl-code"
								type="text"
								disabled
								value={gradeLevel.gradeCode}
								className="mt-1 bg-(--workspace-bg-muted) text-(--text-muted)"
							/>
						</div>

						<div>
							<label htmlFor="gl-name" className="block text-(--text-sm) font-medium">
								Grade Name
							</label>
							<Input
								id="gl-name"
								type="text"
								disabled
								value={gradeLevel.gradeName}
								className="mt-1 bg-(--workspace-bg-muted) text-(--text-muted)"
							/>
						</div>

						<div>
							<label htmlFor="gl-band" className="block text-(--text-sm) font-medium">
								Band
							</label>
							<Input
								id="gl-band"
								type="text"
								disabled
								value={gradeLevel.band}
								className="mt-1 bg-(--workspace-bg-muted) text-(--text-muted)"
							/>
						</div>

						<div>
							<label htmlFor="maxClassSize" className="block text-(--text-sm) font-medium">
								Template Max Class Size
							</label>
							<Input
								id="maxClassSize"
								type="number"
								min={1}
								max={50}
								className={inputClass(!!errors.maxClassSize)}
								{...register('maxClassSize')}
							/>
							{errors.maxClassSize && (
								<p className="mt-1 text-(--text-xs) text-(--color-error)">
									{errors.maxClassSize.message}
								</p>
							)}
						</div>

						<div>
							<label htmlFor="defaultAy2Intake" className="block text-(--text-sm) font-medium">
								Default AY2 Intake Template
							</label>
							<Input
								id="defaultAy2Intake"
								type="number"
								min={0}
								max={200}
								placeholder="Optional"
								className={inputClass(!!errors.defaultAy2Intake)}
								{...register('defaultAy2Intake', {
									setValueAs: (value) =>
										value === '' || value === null || value === undefined ? null : Number(value),
								})}
							/>
							{errors.defaultAy2Intake && (
								<p className="mt-1 text-(--text-xs) text-(--color-error)">
									{errors.defaultAy2Intake.message}
								</p>
							)}
						</div>

						<div className="grid grid-cols-3 gap-3">
							<div>
								<label htmlFor="plancherPct" className="block text-(--text-sm) font-medium">
									Template Plancher %
								</label>
								<Input
									id="plancherPct"
									type="number"
									step="0.01"
									min={0}
									max={1}
									className={inputClass(!!errors.plancherPct)}
									{...register('plancherPct')}
								/>
								{errors.plancherPct && (
									<p className="mt-1 text-(--text-xs) text-(--color-error)">
										{errors.plancherPct.message}
									</p>
								)}
							</div>
							<div>
								<label htmlFor="ciblePct" className="block text-(--text-sm) font-medium">
									Template Cible %
								</label>
								<Input
									id="ciblePct"
									type="number"
									step="0.01"
									min={0}
									max={1}
									className={inputClass(!!errors.ciblePct)}
									{...register('ciblePct')}
								/>
								{errors.ciblePct && (
									<p className="mt-1 text-(--text-xs) text-(--color-error)">
										{errors.ciblePct.message}
									</p>
								)}
							</div>
							<div>
								<label htmlFor="plafondPct" className="block text-(--text-sm) font-medium">
									Template Plafond %
								</label>
								<Input
									id="plafondPct"
									type="number"
									step="0.01"
									min={0}
									max={1}
									className={inputClass(!!errors.plafondPct)}
									{...register('plafondPct')}
								/>
								{errors.plafondPct && (
									<p className="mt-1 text-(--text-xs) text-(--color-error)">
										{errors.plafondPct.message}
									</p>
								)}
							</div>
						</div>

						<div>
							<label htmlFor="displayOrder" className="block text-(--text-sm) font-medium">
								Display Order
							</label>
							<Input
								id="displayOrder"
								type="number"
								min={0}
								className={inputClass(!!errors.displayOrder)}
								{...register('displayOrder')}
							/>
							{errors.displayOrder && (
								<p className="mt-1 text-(--text-xs) text-(--color-error)">
									{errors.displayOrder.message}
								</p>
							)}
						</div>
					</form>
				</div>

				<div className="flex justify-end gap-3 border-t px-6 py-4">
					<Button type="button" variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button type="submit" form="grade-form" loading={updateMutation.isPending}>
						Save
					</Button>
				</div>
			</div>
		</>
	);
}
