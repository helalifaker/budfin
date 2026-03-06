import { useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { cn } from '../../lib/cn'
import {
	useCreateAcademicYear,
	useUpdateAcademicYear,
	type AcademicYear,
} from '../../hooks/use-academic-years'

const baseAcademicYearSchema = z.object({
	fiscalYear: z.string().min(1, 'Fiscal year is required'),
	ay1Start: z.string().min(1, 'AY1 start date is required'),
	ay1End: z.string().min(1, 'AY1 end date is required'),
	summerStart: z.string().min(1, 'Summer start date is required'),
	summerEnd: z.string().min(1, 'Summer end date is required'),
	ay2Start: z.string().min(1, 'AY2 start date is required'),
	ay2End: z.string().min(1, 'AY2 end date is required'),
	academicWeeks: z.coerce.number().int().min(1).max(52),
})

const academicYearSchema = baseAcademicYearSchema
	.refine((d) => d.ay1Start < d.ay1End, {
		message: 'AY1 start must be before AY1 end',
		path: ['ay1End'],
	})
	.refine((d) => d.ay1End <= d.summerStart, {
		message: 'AY1 end must be on or before summer start',
		path: ['summerStart'],
	})
	.refine((d) => d.summerStart < d.summerEnd, {
		message: 'Summer start must be before summer end',
		path: ['summerEnd'],
	})
	.refine((d) => d.summerEnd <= d.ay2Start, {
		message: 'Summer end must be on or before AY2 start',
		path: ['ay2Start'],
	})
	.refine((d) => d.ay2Start < d.ay2End, {
		message: 'AY2 start must be before AY2 end',
		path: ['ay2End'],
	})

type FormValues = z.infer<typeof baseAcademicYearSchema>

export type AcademicYearSidePanelProps = {
	open: boolean
	onClose: () => void
	academicYear?: AcademicYear | null
}

export function AcademicYearSidePanel({
	open,
	onClose,
	academicYear,
}: AcademicYearSidePanelProps) {
	const panelRef = useRef<HTMLDivElement>(null)
	const isEdit = !!academicYear
	const createMutation = useCreateAcademicYear()
	const updateMutation = useUpdateAcademicYear()
	const isPending = createMutation.isPending || updateMutation.isPending

	const {
		register,
		handleSubmit,
		reset,
		formState: { errors },
	} = useForm<FormValues>({
		// eslint-disable-next-line @typescript-eslint/no-explicit-any -- refined schema input type mismatch with useForm
		resolver: zodResolver(academicYearSchema) as any,
		defaultValues: {
			fiscalYear: '',
			ay1Start: '',
			ay1End: '',
			summerStart: '',
			summerEnd: '',
			ay2Start: '',
			ay2End: '',
			academicWeeks: 36,
		},
	})

	useEffect(() => {
		if (!open) return
		if (academicYear) {
			reset({
				fiscalYear: academicYear.fiscalYear,
				ay1Start: academicYear.ay1Start,
				ay1End: academicYear.ay1End,
				summerStart: academicYear.summerStart,
				summerEnd: academicYear.summerEnd,
				ay2Start: academicYear.ay2Start,
				ay2End: academicYear.ay2End,
				academicWeeks: academicYear.academicWeeks,
			})
		} else {
			reset({
				fiscalYear: '',
				ay1Start: '',
				ay1End: '',
				summerStart: '',
				summerEnd: '',
				ay2Start: '',
				ay2End: '',
				academicWeeks: 36,
			})
		}
	}, [open, academicYear, reset])

	// Focus trap + Escape
	useEffect(() => {
		if (!open) return
		const panel = panelRef.current
		if (!panel) return

		const focusable = panel.querySelectorAll<HTMLElement>(
			'input, select, button, [tabindex]:not([tabindex="-1"])',
		)
		const first = focusable[0]
		const last = focusable[focusable.length - 1]
		first?.focus()

		function handleKeyDown(e: KeyboardEvent) {
			if (e.key === 'Escape') {
				onClose()
				return
			}
			if (e.key !== 'Tab') return
			if (e.shiftKey && document.activeElement === first) {
				e.preventDefault()
				last?.focus()
			} else if (!e.shiftKey && document.activeElement === last) {
				e.preventDefault()
				first?.focus()
			}
		}

		panel.addEventListener('keydown', handleKeyDown)
		return () => panel.removeEventListener('keydown', handleKeyDown)
	}, [open, onClose])

	function onSubmit(data: FormValues) {
		if (isEdit) {
			updateMutation.mutate(
				{
					id: academicYear.id,
					version: academicYear.version,
					...data,
				},
				{ onSuccess: onClose },
			)
		} else {
			createMutation.mutate(data, { onSuccess: onClose })
		}
	}

	if (!open) return null

	const inputClass = (hasError: boolean) =>
		cn(
			'mt-1 block w-full rounded-md border px-3 py-2 text-sm',
			hasError ? 'border-red-500' : 'border-slate-300',
		)

	return (
		<>
			<div
				className="fixed inset-0 z-40 bg-black/30"
				onClick={onClose}
				aria-hidden="true"
			/>
			<div
				ref={panelRef}
				role="dialog"
				aria-modal="true"
				aria-label={isEdit ? 'Edit Academic Year' : 'Add Academic Year'}
				className={cn(
					'fixed right-0 top-0 z-50 h-full w-[480px]',
					'bg-white shadow-xl',
					'flex flex-col',
				)}
			>
				<div className="border-b px-6 py-4">
					<h2 className="text-lg font-semibold">
						{isEdit
							? `Edit Academic Year — ${academicYear.fiscalYear}`
							: 'Add Academic Year'}
					</h2>
				</div>

				<div className="flex-1 overflow-y-auto px-6 py-4">
					<form
						id="ay-form"
						onSubmit={handleSubmit(onSubmit)}
						className="space-y-4"
					>
						<div>
							<label htmlFor="fiscalYear" className="block text-sm font-medium">
								Fiscal Year
							</label>
							<input
								id="fiscalYear"
								type="text"
								placeholder="e.g. 2025-2026"
								className={inputClass(!!errors.fiscalYear)}
								{...register('fiscalYear')}
							/>
							{errors.fiscalYear && (
								<p className="mt-1 text-xs text-red-600">
									{errors.fiscalYear.message}
								</p>
							)}
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div>
								<label htmlFor="ay1Start" className="block text-sm font-medium">
									AY1 Start
								</label>
								<input
									id="ay1Start"
									type="date"
									className={inputClass(!!errors.ay1Start)}
									{...register('ay1Start')}
								/>
								{errors.ay1Start && (
									<p className="mt-1 text-xs text-red-600">
										{errors.ay1Start.message}
									</p>
								)}
							</div>
							<div>
								<label htmlFor="ay1End" className="block text-sm font-medium">
									AY1 End
								</label>
								<input
									id="ay1End"
									type="date"
									className={inputClass(!!errors.ay1End)}
									{...register('ay1End')}
								/>
								{errors.ay1End && (
									<p className="mt-1 text-xs text-red-600">
										{errors.ay1End.message}
									</p>
								)}
							</div>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div>
								<label
									htmlFor="summerStart"
									className="block text-sm font-medium"
								>
									Summer Start
								</label>
								<input
									id="summerStart"
									type="date"
									className={inputClass(!!errors.summerStart)}
									{...register('summerStart')}
								/>
								{errors.summerStart && (
									<p className="mt-1 text-xs text-red-600">
										{errors.summerStart.message}
									</p>
								)}
							</div>
							<div>
								<label htmlFor="summerEnd" className="block text-sm font-medium">
									Summer End
								</label>
								<input
									id="summerEnd"
									type="date"
									className={inputClass(!!errors.summerEnd)}
									{...register('summerEnd')}
								/>
								{errors.summerEnd && (
									<p className="mt-1 text-xs text-red-600">
										{errors.summerEnd.message}
									</p>
								)}
							</div>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div>
								<label htmlFor="ay2Start" className="block text-sm font-medium">
									AY2 Start
								</label>
								<input
									id="ay2Start"
									type="date"
									className={inputClass(!!errors.ay2Start)}
									{...register('ay2Start')}
								/>
								{errors.ay2Start && (
									<p className="mt-1 text-xs text-red-600">
										{errors.ay2Start.message}
									</p>
								)}
							</div>
							<div>
								<label htmlFor="ay2End" className="block text-sm font-medium">
									AY2 End
								</label>
								<input
									id="ay2End"
									type="date"
									className={inputClass(!!errors.ay2End)}
									{...register('ay2End')}
								/>
								{errors.ay2End && (
									<p className="mt-1 text-xs text-red-600">
										{errors.ay2End.message}
									</p>
								)}
							</div>
						</div>

						<div>
							<label
								htmlFor="academicWeeks"
								className="block text-sm font-medium"
							>
								Academic Weeks
							</label>
							<input
								id="academicWeeks"
								type="number"
								min={1}
								max={52}
								className={inputClass(!!errors.academicWeeks)}
								{...register('academicWeeks')}
							/>
							{errors.academicWeeks && (
								<p className="mt-1 text-xs text-red-600">
									{errors.academicWeeks.message}
								</p>
							)}
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
							'hover:bg-slate-50',
						)}
					>
						Cancel
					</button>
					<button
						type="submit"
						form="ay-form"
						disabled={isPending}
						className={cn(
							'rounded-md bg-blue-600 px-4 py-2 text-sm',
							'font-medium text-white',
							'hover:bg-blue-700',
							'disabled:opacity-50',
						)}
					>
						{isPending ? 'Saving...' : 'Save'}
					</button>
				</div>

				<div aria-live="polite" className="sr-only">
					{createMutation.isError && 'Failed to create academic year'}
					{updateMutation.isError && 'Failed to update academic year'}
					{createMutation.isSuccess && 'Academic year created'}
					{updateMutation.isSuccess && 'Academic year updated'}
				</div>
			</div>
		</>
	)
}
