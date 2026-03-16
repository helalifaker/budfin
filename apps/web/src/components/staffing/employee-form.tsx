import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../ui/sheet';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { cn } from '../../lib/cn';
import type { Employee } from '../../hooks/use-staffing';

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
	ajeerAnnualLevy: string;
	ajeerMonthlyFee: string;
}

export type EmployeeFormProps = {
	open: boolean;
	onClose: () => void;
	employee: Employee | null;
	isReadOnly: boolean;
	onSave: (data: EmployeeFormData) => void;
	onDelete?: () => void;
	isPending: boolean;
};

const DEPARTMENTS = ['Teaching', 'Administration', 'Support', 'Management', 'Maintenance'];
const STATUSES = ['Existing', 'New', 'Departed'];

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

export function EmployeeForm({
	open,
	onClose,
	employee,
	isReadOnly,
	onSave,
	onDelete,
	isPending,
}: EmployeeFormProps) {
	const isNew = !employee;

	const {
		register,
		handleSubmit,
		reset,
		control,
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
			ajeerAnnualLevy: '0',
			ajeerMonthlyFee: '0',
		},
	});

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
				ajeerAnnualLevy: employee.ajeerAnnualLevy ?? '0',
				ajeerMonthlyFee: employee.ajeerMonthlyFee ?? '0',
			});
		} else {
			reset();
		}
	}, [employee, reset]);

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
					{/* Identity */}
					<div className="grid grid-cols-2 gap-3">
						<Field label="Employee Code" error={errors.employeeCode?.message}>
							<Input
								{...register('employeeCode', { required: 'Required' })}
								disabled={isReadOnly || !isNew}
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
							{...register('name', { required: 'Required' })}
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

					<div className="grid grid-cols-2 gap-3">
						<Field label="Joining Date" error={errors.joiningDate?.message}>
							<Input
								type="date"
								{...register('joiningDate', { required: 'Required' })}
								disabled={isReadOnly}
								className={inputClass}
							/>
						</Field>
						<Field label="Payment Method">
							<Input {...register('paymentMethod')} disabled={isReadOnly} className={inputClass} />
						</Field>
					</div>

					{/* Flags */}
					<div className="flex gap-6 py-2">
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
						<label className="flex items-center gap-2 text-sm">
							<input
								type="checkbox"
								{...register('isTeaching')}
								disabled={isReadOnly}
								className="rounded"
							/>
							Teaching
						</label>
					</div>

					{/* Salary Fields */}
					{!isReadOnly && (
						<>
							<h3 className="text-(--text-sm) font-semibold text-(--text-primary) border-b border-(--workspace-border) pb-1">
								Compensation
							</h3>
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
										{...register('housingAllowance', { required: 'Required' })}
										className={inputClass}
									/>
								</Field>
								<Field label="Transport Allowance" error={errors.transportAllowance?.message}>
									<Input
										type="number"
										step="0.01"
										{...register('transportAllowance', { required: 'Required' })}
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
								<Field label="HSA Amount">
									<Input
										type="number"
										step="0.01"
										{...register('hsaAmount')}
										className={inputClass}
									/>
								</Field>
								<Field label="Augmentation">
									<Input
										type="number"
										step="0.01"
										{...register('augmentation')}
										className={inputClass}
									/>
								</Field>
								<Field label="Hourly %">
									<Input
										type="number"
										step="0.0001"
										{...register('hourlyPercentage')}
										className={inputClass}
									/>
								</Field>
							</div>

							<h3 className="text-(--text-sm) font-semibold text-(--text-primary) border-b border-(--workspace-border) pb-1">
								Ajeer
							</h3>
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
