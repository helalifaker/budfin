import { useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../ui/sheet';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { cn } from '../../lib/cn';
import type { Employee } from '../../hooks/use-staffing';

// ── Form Data ───────────────────────────────────────────────────────────────

export interface EmployeeFormData {
	employeeCode: string;
	name: string;
	functionRole: string;
	department: string;
	status: string;
	joiningDate: string;
	paymentMethod: string;
	isSaudi: boolean;
	isAjeer: boolean;
	isTeaching: boolean;
	hourlyPercentage: string;
	baseSalary: string;
	housingAllowance: string;
	transportAllowance: string;
	responsibilityPremium: string;
	hsaAmount: string;
	augmentation: string;
	augmentationEffectiveDate: string;
	ajeerAnnualLevy: string;
	ajeerMonthlyFee: string;
	recordType: string;
	costMode: string;
	disciplineId: string;
	serviceProfileId: string;
	homeBand: string;
	contractEndDate: string;
}

// ── Props ───────────────────────────────────────────────────────────────────

export type EmployeeFormProps = {
	open: boolean;
	onClose: () => void;
	employee: Employee | null;
	isReadOnly: boolean;
	onSave: (data: EmployeeFormData) => void;
	onDelete?: () => void;
	isPending: boolean;
	disciplines?: Array<{ id: number; code: string; label: string; band: string | null }>;
	serviceProfiles?: Array<{
		id: number;
		code: string;
		label: string;
		defaultOrs: string;
		isHsaEligible: boolean;
	}>;
};

// ── Constants ───────────────────────────────────────────────────────────────

const DEPARTMENTS = ['Teaching', 'Administration', 'Support', 'Management', 'Maintenance'];
const STATUSES = ['Existing', 'New', 'Departed'];
const COST_MODES = [
	{ value: 'LOCAL_PAYROLL', label: 'Local Payroll' },
	{ value: 'AEFE_RECHARGE', label: 'AEFE Recharge' },
	{ value: 'NO_LOCAL_COST', label: 'No Local Cost' },
];
const HOME_BANDS = [
	{ value: 'MATERNELLE', label: 'Mat' },
	{ value: 'ELEMENTAIRE', label: 'Elem' },
	{ value: 'COLLEGE', label: 'Col' },
	{ value: 'LYCEE', label: 'Lyc' },
];

// ── Field helper ────────────────────────────────────────────────────────────

function Field({
	label,
	error,
	children,
}: {
	label: string;
	error?: string | undefined;
	children: React.ReactNode;
}) {
	return (
		<div className="space-y-1">
			<label className="text-(--text-xs) font-medium text-(--text-muted)">{label}</label>
			{children}
			{error && <p className="text-(--text-xs) text-(--color-error)">{error}</p>}
		</div>
	);
}

// ── Section Header ──────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
	return (
		<h3 className="text-(--text-sm) font-semibold text-(--text-primary) border-b border-(--workspace-border) pb-1">
			{title}
		</h3>
	);
}

// ── Vacancy code generator ──────────────────────────────────────────────────

let vacancyCounter = 1;

function generateVacancyCode(): string {
	const code = `VAC-${String(vacancyCounter).padStart(3, '0')}`;
	vacancyCounter++;
	return code;
}

// ── Main Component ──────────────────────────────────────────────────────────

export function EmployeeForm({
	open,
	onClose,
	employee,
	isReadOnly,
	onSave,
	onDelete,
	isPending,
	disciplines = [],
	serviceProfiles = [],
}: EmployeeFormProps) {
	const isNew = !employee;

	const {
		register,
		handleSubmit,
		reset,
		control,
		watch,
		setValue,
		formState: { errors },
	} = useForm<EmployeeFormData>({
		defaultValues: {
			employeeCode: '',
			name: '',
			functionRole: '',
			department: 'Teaching',
			status: 'Existing',
			joiningDate: '',
			paymentMethod: 'Bank Transfer',
			isSaudi: false,
			isAjeer: false,
			isTeaching: false,
			hourlyPercentage: '1.0000',
			baseSalary: '',
			housingAllowance: '',
			transportAllowance: '',
			responsibilityPremium: '0',
			hsaAmount: '0',
			augmentation: '0',
			augmentationEffectiveDate: '',
			ajeerAnnualLevy: '0',
			ajeerMonthlyFee: '0',
			recordType: 'EMPLOYEE',
			costMode: 'LOCAL_PAYROLL',
			disciplineId: '',
			serviceProfileId: '',
			homeBand: '',
			contractEndDate: '',
		},
	});

	// Watch fields for conditional visibility
	const watchRecordType = watch('recordType');
	const watchCostMode = watch('costMode');
	const watchIsTeaching = watch('isTeaching');
	const watchIsAjeer = watch('isAjeer');

	// Derived visibility flags
	const isVacancy = watchRecordType === 'VACANCY';
	const isLocalPayroll = watchCostMode === 'LOCAL_PAYROLL';
	const isAefeRecharge = watchCostMode === 'AEFE_RECHARGE';
	const _isNoCost = watchCostMode === 'NO_LOCAL_COST';

	const showTeachingProfile = watchIsTeaching === true;
	const showCompensation = isLocalPayroll && !isVacancy;
	const showAjeerSection = watchIsAjeer === true && isLocalPayroll && !isVacancy;
	const showSaudiAjeerFlags = !isVacancy;
	const showSalaryInfoBanner = isAefeRecharge && !isVacancy;

	// Auto-generate vacancy code when switching to VACANCY
	const vacancyCode = useMemo(() => generateVacancyCode(), []);

	useEffect(() => {
		if (employee) {
			reset({
				employeeCode: employee.employeeCode,
				name: employee.name,
				functionRole: employee.functionRole,
				department: employee.department,
				status: employee.status,
				joiningDate: employee.joiningDate?.split('T')[0] ?? '',
				paymentMethod: employee.paymentMethod,
				isSaudi: employee.isSaudi,
				isAjeer: employee.isAjeer,
				isTeaching: employee.isTeaching,
				hourlyPercentage: employee.hourlyPercentage,
				baseSalary: employee.baseSalary ?? '',
				housingAllowance: employee.housingAllowance ?? '',
				transportAllowance: employee.transportAllowance ?? '',
				responsibilityPremium: employee.responsibilityPremium ?? '0',
				hsaAmount: employee.hsaAmount ?? '0',
				augmentation: employee.augmentation ?? '0',
				augmentationEffectiveDate: employee.augmentationEffectiveDate?.split('T')[0] ?? '',
				ajeerAnnualLevy: employee.ajeerAnnualLevy ?? '0',
				ajeerMonthlyFee: employee.ajeerMonthlyFee ?? '0',
				recordType: employee.recordType ?? 'EMPLOYEE',
				costMode: employee.costMode ?? 'LOCAL_PAYROLL',
				disciplineId: employee.disciplineId ? String(employee.disciplineId) : '',
				serviceProfileId: employee.serviceProfileId ? String(employee.serviceProfileId) : '',
				homeBand: employee.homeBand ?? '',
				contractEndDate: employee.contractEndDate?.split('T')[0] ?? '',
			});
		} else {
			reset();
		}
	}, [employee, reset]);

	// When recordType changes to VACANCY, set vacancy code
	useEffect(() => {
		if (watchRecordType === 'VACANCY' && isNew) {
			setValue('employeeCode', vacancyCode);
		}
	}, [watchRecordType, isNew, setValue, vacancyCode]);

	const inputClass = cn(
		'w-full rounded-md',
		'border border-(--workspace-border) bg-(--workspace-bg)',
		'px-3 py-1.5 text-sm text-(--text-primary)',
		'focus:outline-none focus:ring-2 focus:ring-(--accent-500)',
		'disabled:opacity-50 disabled:cursor-not-allowed'
	);

	const selectClass = cn(inputClass, 'appearance-none');

	return (
		<Sheet open={open} onOpenChange={(v) => !v && onClose()}>
			<SheetContent className="w-[420px] overflow-y-auto" aria-label="Employee details">
				<SheetHeader>
					<SheetTitle>{isNew ? 'Add Employee' : `Edit: ${employee?.name}`}</SheetTitle>
				</SheetHeader>

				<form onSubmit={handleSubmit(onSave)} className="mt-6 space-y-4" aria-label="Employee form">
					{/* Section 1: Identity */}
					<div className="grid grid-cols-2 gap-3">
						<Field label="Employee Code" error={errors.employeeCode?.message}>
							<Input
								{...register('employeeCode', { required: 'Required' })}
								disabled={isReadOnly || !isNew || isVacancy}
								className={inputClass}
							/>
						</Field>
						<Field label="Status">
							<Controller
								control={control}
								name="status"
								render={({ field }) => (
									<Select value={field.value} onValueChange={field.onChange} disabled={isReadOnly}>
										<SelectTrigger className={selectClass}>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{STATUSES.map((s) => (
												<SelectItem key={s} value={s}>
													{s}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								)}
							/>
						</Field>
					</div>

					<Field label="Full Name" error={errors.name?.message}>
						<Input
							{...register('name', {
								required: isVacancy ? false : 'Required',
							})}
							disabled={isReadOnly}
							className={inputClass}
						/>
					</Field>

					<div className="grid grid-cols-2 gap-3">
						<Field label="Department">
							<Controller
								control={control}
								name="department"
								render={({ field }) => (
									<Select value={field.value} onValueChange={field.onChange} disabled={isReadOnly}>
										<SelectTrigger className={selectClass}>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{DEPARTMENTS.map((d) => (
												<SelectItem key={d} value={d}>
													{d}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								)}
							/>
						</Field>
						<Field label="Function / Role" error={errors.functionRole?.message}>
							<Input
								{...register('functionRole', { required: 'Required' })}
								disabled={isReadOnly}
								className={inputClass}
							/>
						</Field>
					</div>

					{/* Section 2: Classification */}
					<SectionHeader title="Classification" />

					<Field label="Record Type">
						<div className="flex gap-4 py-1">
							<label className="flex items-center gap-2 text-sm">
								<input
									type="radio"
									value="EMPLOYEE"
									{...register('recordType')}
									disabled={isReadOnly}
									className="rounded"
								/>
								Employee
							</label>
							<label className="flex items-center gap-2 text-sm">
								<input
									type="radio"
									value="VACANCY"
									{...register('recordType')}
									disabled={isReadOnly}
									className="rounded"
								/>
								Vacancy
							</label>
						</div>
					</Field>

					<Field label="Cost Mode">
						<Controller
							control={control}
							name="costMode"
							render={({ field }) => (
								<Select value={field.value} onValueChange={field.onChange} disabled={isReadOnly}>
									<SelectTrigger className={selectClass}>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{COST_MODES.map((cm) => (
											<SelectItem key={cm.value} value={cm.value}>
												{cm.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							)}
						/>
					</Field>

					{/* Flags: Teaching always visible; Saudi/Ajeer hidden for VACANCY */}
					<div className="flex gap-6 py-2">
						<label className="flex items-center gap-2 text-sm">
							<input
								type="checkbox"
								{...register('isTeaching')}
								disabled={isReadOnly}
								className="rounded"
							/>
							Teaching
						</label>
						{showSaudiAjeerFlags && (
							<>
								<label className="flex items-center gap-2 text-sm">
									<input
										type="checkbox"
										{...register('isSaudi')}
										disabled={isReadOnly}
										className="rounded"
									/>
									Saudi
								</label>
								<label className="flex items-center gap-2 text-sm">
									<input
										type="checkbox"
										{...register('isAjeer')}
										disabled={isReadOnly}
										className="rounded"
									/>
									Ajeer
								</label>
							</>
						)}
					</div>

					{/* Section 3: Teaching Profile (visible when isTeaching=true) */}
					{showTeachingProfile && (
						<>
							<SectionHeader title="Teaching Profile" />

							<Field label="Discipline">
								<Controller
									control={control}
									name="disciplineId"
									render={({ field }) => (
										<Select
											value={field.value}
											onValueChange={field.onChange}
											disabled={isReadOnly}
										>
											<SelectTrigger className={selectClass}>
												<SelectValue placeholder="Select discipline" />
											</SelectTrigger>
											<SelectContent>
												{disciplines.map((d) => (
													<SelectItem key={d.id} value={String(d.id)}>
														{d.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									)}
								/>
							</Field>

							<Field label="Service Profile">
								<Controller
									control={control}
									name="serviceProfileId"
									render={({ field }) => (
										<Select
											value={field.value}
											onValueChange={field.onChange}
											disabled={isReadOnly}
										>
											<SelectTrigger className={selectClass}>
												<SelectValue placeholder="Select service profile" />
											</SelectTrigger>
											<SelectContent>
												{serviceProfiles.map((sp) => (
													<SelectItem key={sp.id} value={String(sp.id)}>
														{sp.label} ({sp.code})
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									)}
								/>
							</Field>

							<Field label="Home Band">
								<Controller
									control={control}
									name="homeBand"
									render={({ field }) => (
										<Select
											value={field.value}
											onValueChange={field.onChange}
											disabled={isReadOnly}
										>
											<SelectTrigger className={selectClass}>
												<SelectValue placeholder="Select home band" />
											</SelectTrigger>
											<SelectContent>
												{HOME_BANDS.map((b) => (
													<SelectItem key={b.value} value={b.value}>
														{b.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									)}
								/>
							</Field>
						</>
					)}

					{/* Section 4: Employment */}
					<SectionHeader title="Employment" />
					<div className="grid grid-cols-2 gap-3">
						<Field label="Joining Date" error={errors.joiningDate?.message}>
							<Input
								type="date"
								{...register('joiningDate', { required: 'Required' })}
								disabled={isReadOnly}
								className={inputClass}
							/>
						</Field>
						<Field label="Contract End Date">
							<Input
								type="date"
								{...register('contractEndDate')}
								disabled={isReadOnly}
								className={inputClass}
							/>
						</Field>
					</div>
					<div className="grid grid-cols-2 gap-3">
						<Field label="Payment Method">
							<Input {...register('paymentMethod')} disabled={isReadOnly} className={inputClass} />
						</Field>
						<Field label="Hourly %">
							<Input
								type="number"
								step="0.0001"
								{...register('hourlyPercentage')}
								disabled={isReadOnly}
								className={inputClass}
							/>
						</Field>
					</div>

					{/* AEFE Recharge info banner */}
					{showSalaryInfoBanner && (
						<div
							className={cn(
								'rounded-md border border-(--color-info-bg) bg-(--color-info-bg)/10',
								'px-3 py-2 text-sm text-(--color-info)'
							)}
						>
							Salary managed by AEFE recharge. Configure recharge amounts in Staffing Settings.
						</div>
					)}

					{/* Section 5: Compensation (LOCAL_PAYROLL only, not VACANCY) */}
					{showCompensation && !isReadOnly && (
						<>
							<SectionHeader title="Compensation" />
							<div className="grid grid-cols-2 gap-3">
								<Field label="Base Salary (SAR)" error={errors.baseSalary?.message}>
									<Input
										type="number"
										step="0.01"
										{...register('baseSalary', { required: 'Required' })}
										className={inputClass}
									/>
								</Field>
								<Field label="Housing Allowance" error={errors.housingAllowance?.message}>
									<Input
										type="number"
										step="0.01"
										{...register('housingAllowance', {
											required: 'Required',
										})}
										className={inputClass}
									/>
								</Field>
								<Field label="Transport Allowance" error={errors.transportAllowance?.message}>
									<Input
										type="number"
										step="0.01"
										{...register('transportAllowance', {
											required: 'Required',
										})}
										className={inputClass}
									/>
								</Field>
								<Field label="Responsibility Premium">
									<Input
										type="number"
										step="0.01"
										{...register('responsibilityPremium')}
										className={inputClass}
									/>
								</Field>
								{/* hsaAmount is ALWAYS hidden (computed by pipeline) */}
								<Field label="Augmentation">
									<Input
										type="number"
										step="0.01"
										{...register('augmentation')}
										className={inputClass}
									/>
								</Field>
								<Field label="Augmentation Effective Date">
									<Input
										type="date"
										{...register('augmentationEffectiveDate')}
										className={inputClass}
									/>
								</Field>
							</div>
						</>
					)}

					{/* Section 6: Ajeer Details (isAjeer AND LOCAL_PAYROLL, not VACANCY) */}
					{showAjeerSection && !isReadOnly && (
						<>
							<SectionHeader title="Ajeer Details" />
							<div className="grid grid-cols-2 gap-3">
								<Field label="Annual Levy">
									<Input
										type="number"
										step="0.01"
										{...register('ajeerAnnualLevy')}
										className={inputClass}
									/>
								</Field>
								<Field label="Monthly Fee">
									<Input
										type="number"
										step="0.01"
										{...register('ajeerMonthlyFee')}
										className={inputClass}
									/>
								</Field>
							</div>
						</>
					)}

					{/* Actions */}
					{!isReadOnly && (
						<div className="flex items-center gap-2 pt-4 border-t border-(--workspace-border)">
							<Button type="submit" size="sm" disabled={isPending}>
								{isPending ? 'Saving...' : isNew ? 'Create' : 'Update'}
							</Button>
							<Button type="button" variant="outline" size="sm" onClick={onClose}>
								Cancel
							</Button>
							{!isNew && onDelete && (
								<Button
									type="button"
									variant="destructive"
									size="sm"
									className="ml-auto"
									onClick={onDelete}
								>
									Delete
								</Button>
							)}
						</div>
					)}
				</form>
			</SheetContent>
		</Sheet>
	);
}
