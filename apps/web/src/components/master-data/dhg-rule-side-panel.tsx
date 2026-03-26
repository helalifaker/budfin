import { useEffect, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '../../lib/cn';
import type { DhgRuleDetail } from '../../hooks/use-master-data';
import { useDisciplines, useServiceProfiles } from '../../hooks/use-master-data';
import { useGradeLevels } from '../../hooks/use-grade-levels';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';

const LINE_TYPE_OPTIONS = [
	{ value: 'STRUCTURAL', label: 'Structural' },
	{ value: 'HOST_COUNTRY', label: 'Host Country' },
	{ value: 'AUTONOMY', label: 'Autonomy' },
	{ value: 'SPECIALTY', label: 'Specialty' },
] as const;

const DRIVER_TYPE_OPTIONS = [
	{ value: 'HOURS', label: 'Hours' },
	{ value: 'GROUPS', label: 'Groups' },
] as const;

const dhgRuleFormSchema = z.object({
	gradeLevel: z.string().min(1, 'Grade level is required'),
	disciplineId: z.number().int().positive('Discipline is required'),
	serviceProfileId: z.number().int().positive('Service profile is required'),
	lineType: z.enum(['STRUCTURAL', 'HOST_COUNTRY', 'AUTONOMY', 'SPECIALTY']),
	driverType: z.enum(['HOURS', 'GROUPS']),
	hoursPerUnit: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a decimal (up to 2 places)'),
	effectiveFromYear: z.number().int().min(2000).max(2100),
	effectiveToYear: z.number().int().min(2000).max(2100).nullable().optional(),
	languageCode: z.string().max(5).nullable().optional(),
	groupingKey: z.string().max(50).nullable().optional(),
});

export type DhgRuleFormValues = z.infer<typeof dhgRuleFormSchema>;

export type DhgRuleSidePanelProps = {
	open: boolean;
	onClose: () => void;
	dhgRule?: DhgRuleDetail | null;
	onSave: (data: DhgRuleFormValues) => void;
	loading?: boolean;
	prefillGradeLevel?: string | undefined;
	prefillDisciplineId?: number | undefined;
};

const DEFAULT_VALUES: DhgRuleFormValues = {
	gradeLevel: '',
	disciplineId: 0,
	serviceProfileId: 0,
	lineType: 'STRUCTURAL' as const,
	driverType: 'HOURS' as const,
	hoursPerUnit: '',
	effectiveFromYear: new Date().getFullYear(),
	effectiveToYear: null,
	languageCode: null,
	groupingKey: null,
};

export function DhgRuleSidePanel({
	open,
	onClose,
	dhgRule,
	onSave,
	loading = false,
	prefillGradeLevel,
	prefillDisciplineId,
}: DhgRuleSidePanelProps) {
	const panelRef = useRef<HTMLDivElement>(null);
	const isEdit = !!dhgRule;

	const { data: gradeLevelsData } = useGradeLevels();
	const { data: disciplines = [] } = useDisciplines();
	const { data: serviceProfiles = [] } = useServiceProfiles();

	const gradeLevels = gradeLevelsData?.gradeLevels ?? [];

	const form = useForm<DhgRuleFormValues>({
		resolver: zodResolver(dhgRuleFormSchema),
		...(dhgRule
			? {
					values: {
						gradeLevel: dhgRule.gradeLevel,
						disciplineId: dhgRule.disciplineId,
						serviceProfileId: dhgRule.serviceProfileId,
						lineType: dhgRule.lineType as 'STRUCTURAL' | 'HOST_COUNTRY' | 'AUTONOMY' | 'SPECIALTY',
						driverType: dhgRule.driverType as 'HOURS' | 'GROUPS',
						hoursPerUnit: dhgRule.hoursPerUnit,
						effectiveFromYear: dhgRule.effectiveFromYear,
						effectiveToYear: dhgRule.effectiveToYear ?? null,
						languageCode: dhgRule.languageCode ?? null,
						groupingKey: dhgRule.groupingKey ?? null,
					},
				}
			: {}),
		defaultValues: DEFAULT_VALUES,
	});

	useEffect(() => {
		if (open && !dhgRule) {
			form.reset({
				...DEFAULT_VALUES,
				...(prefillGradeLevel ? { gradeLevel: prefillGradeLevel } : {}),
				...(prefillDisciplineId ? { disciplineId: prefillDisciplineId } : {}),
			});
		}
	}, [open, dhgRule, form, prefillGradeLevel, prefillDisciplineId]);

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
				aria-label={isEdit ? 'Edit DHG Rule' : 'Add DHG Rule'}
				className={cn(
					'fixed right-0 top-0 z-50 h-full w-[480px]',
					'bg-(--workspace-bg-card) shadow-xl',
					'flex flex-col'
				)}
			>
				<div className="border-b px-6 py-4">
					<h2 className="text-(--text-lg) font-semibold">
						{isEdit ? 'Edit DHG Rule' : 'Add DHG Rule'}
					</h2>
				</div>

				<div className="flex-1 overflow-y-auto px-6 py-4">
					<form id="dhg-rule-form" onSubmit={form.handleSubmit(onSave)} className="space-y-4">
						{/* Grade Level */}
						<div>
							<label htmlFor="dhg-grade" className="block text-(--text-sm) font-medium">
								Grade Level
							</label>
							<Controller
								control={form.control}
								name="gradeLevel"
								render={({ field }) => (
									<Select value={field.value} onValueChange={field.onChange} disabled={isEdit}>
										<SelectTrigger
											id="dhg-grade"
											className={cn(
												'mt-1',
												isEdit && 'bg-(--workspace-bg-muted) text-(--text-muted)',
												form.formState.errors.gradeLevel && 'border-(--color-error)'
											)}
										>
											<SelectValue placeholder="Select grade level" />
										</SelectTrigger>
										<SelectContent>
											{gradeLevels.map((gl) => (
												<SelectItem key={gl.gradeCode} value={gl.gradeCode}>
													{gl.gradeName}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								)}
							/>
							{form.formState.errors.gradeLevel && (
								<p className="mt-1 text-(--text-xs) text-(--color-error)">
									{form.formState.errors.gradeLevel.message}
								</p>
							)}
						</div>

						{/* Discipline */}
						<div>
							<label htmlFor="dhg-discipline" className="block text-(--text-sm) font-medium">
								Discipline
							</label>
							<Controller
								control={form.control}
								name="disciplineId"
								render={({ field }) => (
									<Select
										value={field.value ? String(field.value) : ''}
										onValueChange={(v) => field.onChange(Number(v))}
										disabled={isEdit}
									>
										<SelectTrigger
											id="dhg-discipline"
											className={cn(
												'mt-1',
												isEdit && 'bg-(--workspace-bg-muted) text-(--text-muted)',
												form.formState.errors.disciplineId && 'border-(--color-error)'
											)}
										>
											<SelectValue placeholder="Select discipline" />
										</SelectTrigger>
										<SelectContent>
											{disciplines.map((d) => (
												<SelectItem key={d.id} value={String(d.id)}>
													{d.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								)}
							/>
							{form.formState.errors.disciplineId && (
								<p className="mt-1 text-(--text-xs) text-(--color-error)">
									{form.formState.errors.disciplineId.message}
								</p>
							)}
						</div>

						{/* Line Type */}
						<div>
							<label htmlFor="dhg-line-type" className="block text-(--text-sm) font-medium">
								Line Type
							</label>
							<Controller
								control={form.control}
								name="lineType"
								render={({ field }) => (
									<Select value={field.value} onValueChange={field.onChange} disabled={isEdit}>
										<SelectTrigger
											id="dhg-line-type"
											className={cn(
												'mt-1',
												isEdit && 'bg-(--workspace-bg-muted) text-(--text-muted)'
											)}
										>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{LINE_TYPE_OPTIONS.map((opt) => (
												<SelectItem key={opt.value} value={opt.value}>
													{opt.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								)}
							/>
						</div>

						{/* Driver Type */}
						<div>
							<label htmlFor="dhg-driver-type" className="block text-(--text-sm) font-medium">
								Driver Type
							</label>
							<Controller
								control={form.control}
								name="driverType"
								render={({ field }) => (
									<Select value={field.value} onValueChange={field.onChange}>
										<SelectTrigger id="dhg-driver-type" className="mt-1">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{DRIVER_TYPE_OPTIONS.map((opt) => (
												<SelectItem key={opt.value} value={opt.value}>
													{opt.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								)}
							/>
						</div>

						{/* Hours per Unit */}
						<div>
							<label htmlFor="dhg-hours" className="block text-(--text-sm) font-medium">
								Hours per Unit
							</label>
							<Input
								id="dhg-hours"
								type="text"
								className={cn(
									'mt-1 font-mono',
									form.formState.errors.hoursPerUnit && 'border-(--color-error)'
								)}
								{...form.register('hoursPerUnit')}
							/>
							{form.formState.errors.hoursPerUnit && (
								<p className="mt-1 text-(--text-xs) text-(--color-error)">
									{form.formState.errors.hoursPerUnit.message}
								</p>
							)}
						</div>

						{/* Service Profile */}
						<div>
							<label htmlFor="dhg-profile" className="block text-(--text-sm) font-medium">
								Service Profile
							</label>
							<Controller
								control={form.control}
								name="serviceProfileId"
								render={({ field }) => (
									<Select
										value={field.value ? String(field.value) : ''}
										onValueChange={(v) => field.onChange(Number(v))}
									>
										<SelectTrigger
											id="dhg-profile"
											className={cn(
												'mt-1',
												form.formState.errors.serviceProfileId && 'border-(--color-error)'
											)}
										>
											<SelectValue placeholder="Select service profile" />
										</SelectTrigger>
										<SelectContent>
											{serviceProfiles.map((sp) => (
												<SelectItem key={sp.id} value={String(sp.id)}>
													{sp.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								)}
							/>
							{form.formState.errors.serviceProfileId && (
								<p className="mt-1 text-(--text-xs) text-(--color-error)">
									{form.formState.errors.serviceProfileId.message}
								</p>
							)}
						</div>

						{/* Effective From Year */}
						<div>
							<label htmlFor="dhg-from-year" className="block text-(--text-sm) font-medium">
								Effective From Year
							</label>
							<Input
								id="dhg-from-year"
								type="number"
								disabled={isEdit}
								className={cn(
									'mt-1',
									isEdit && 'bg-(--workspace-bg-muted) text-(--text-muted)',
									form.formState.errors.effectiveFromYear && 'border-(--color-error)'
								)}
								{...form.register('effectiveFromYear', { valueAsNumber: true })}
							/>
							{form.formState.errors.effectiveFromYear && (
								<p className="mt-1 text-(--text-xs) text-(--color-error)">
									{form.formState.errors.effectiveFromYear.message}
								</p>
							)}
						</div>

						{/* Effective To Year */}
						<div>
							<label htmlFor="dhg-to-year" className="block text-(--text-sm) font-medium">
								Effective To Year
							</label>
							<Input
								id="dhg-to-year"
								type="number"
								className={cn(
									'mt-1',
									form.formState.errors.effectiveToYear && 'border-(--color-error)'
								)}
								{...form.register('effectiveToYear', { valueAsNumber: true })}
							/>
							{form.formState.errors.effectiveToYear && (
								<p className="mt-1 text-(--text-xs) text-(--color-error)">
									{form.formState.errors.effectiveToYear.message}
								</p>
							)}
						</div>

						{/* Language Code */}
						<div>
							<label htmlFor="dhg-lang" className="block text-(--text-sm) font-medium">
								Language Code
							</label>
							<Input
								id="dhg-lang"
								type="text"
								disabled={isEdit}
								className={cn(
									'mt-1',
									isEdit && 'bg-(--workspace-bg-muted) text-(--text-muted)',
									form.formState.errors.languageCode && 'border-(--color-error)'
								)}
								{...form.register('languageCode')}
							/>
							{form.formState.errors.languageCode && (
								<p className="mt-1 text-(--text-xs) text-(--color-error)">
									{form.formState.errors.languageCode.message}
								</p>
							)}
						</div>

						{/* Grouping Key */}
						<div>
							<label htmlFor="dhg-group-key" className="block text-(--text-sm) font-medium">
								Grouping Key
							</label>
							<Input
								id="dhg-group-key"
								type="text"
								className={cn(
									'mt-1',
									form.formState.errors.groupingKey && 'border-(--color-error)'
								)}
								{...form.register('groupingKey')}
							/>
							{form.formState.errors.groupingKey && (
								<p className="mt-1 text-(--text-xs) text-(--color-error)">
									{form.formState.errors.groupingKey.message}
								</p>
							)}
						</div>
					</form>
				</div>

				<div className="flex justify-end gap-3 border-t px-6 py-4">
					<Button type="button" variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button type="submit" form="dhg-rule-form" loading={loading}>
						Save
					</Button>
				</div>
			</div>
		</>
	);
}
