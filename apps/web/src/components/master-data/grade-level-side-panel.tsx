import { useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { cn } from '../../lib/cn'
import { useUpdateGradeLevel, type GradeLevel } from '../../hooks/use-grade-levels'

const baseGradeLevelSchema = z.object({
	maxClassSize: z.coerce.number().int().min(1).max(50),
	plancherPct: z.string().min(1, 'Required'),
	ciblePct: z.string().min(1, 'Required'),
	plafondPct: z.string().min(1, 'Required'),
	displayOrder: z.coerce.number().int().min(0),
})

const gradeLevelSchema = baseGradeLevelSchema.refine(
	(d) => {
		const p = parseFloat(d.plancherPct)
		const c = parseFloat(d.ciblePct)
		const f = parseFloat(d.plafondPct)
		return p <= c && c <= f
	},
	{
		message: 'Must satisfy: plancher <= cible <= plafond',
		path: ['plafondPct'],
	},
)

type FormValues = z.infer<typeof baseGradeLevelSchema>

export type GradeLevelSidePanelProps = {
	open: boolean
	onClose: () => void
	gradeLevel?: GradeLevel | null
}

export function GradeLevelSidePanel({
	open,
	onClose,
	gradeLevel,
}: GradeLevelSidePanelProps) {
	const panelRef = useRef<HTMLDivElement>(null)
	const updateMutation = useUpdateGradeLevel()

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
			plancherPct: '0',
			ciblePct: '0',
			plafondPct: '0',
			displayOrder: 0,
		},
	})

	useEffect(() => {
		if (!open || !gradeLevel) return
		reset({
			maxClassSize: gradeLevel.maxClassSize,
			plancherPct: gradeLevel.plancherPct,
			ciblePct: gradeLevel.ciblePct,
			plafondPct: gradeLevel.plafondPct,
			displayOrder: gradeLevel.displayOrder,
		})
	}, [open, gradeLevel, reset])

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
		if (!gradeLevel) return
		updateMutation.mutate(
			{
				id: gradeLevel.id,
				version: gradeLevel.version,
				...data,
			},
			{ onSuccess: onClose },
		)
	}

	if (!open || !gradeLevel) return null

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
				aria-label={`Edit Grade Level — ${gradeLevel.gradeName}`}
				className={cn(
					'fixed right-0 top-0 z-50 h-full w-[480px]',
					'bg-white shadow-xl',
					'flex flex-col',
				)}
			>
				<div className="border-b px-6 py-4">
					<h2 className="text-lg font-semibold">
						Edit Grade Level — {gradeLevel.gradeName}
					</h2>
				</div>

				<div className="flex-1 overflow-y-auto px-6 py-4">
					<form
						id="grade-form"
						onSubmit={handleSubmit(onSubmit)}
						className="space-y-4"
					>
						<div>
							<label htmlFor="gl-code" className="block text-sm font-medium">
								Grade Code
							</label>
							<input
								id="gl-code"
								type="text"
								disabled
								value={gradeLevel.gradeCode}
								className="mt-1 block w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
							/>
						</div>

						<div>
							<label htmlFor="gl-name" className="block text-sm font-medium">
								Grade Name
							</label>
							<input
								id="gl-name"
								type="text"
								disabled
								value={gradeLevel.gradeName}
								className="mt-1 block w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
							/>
						</div>

						<div>
							<label htmlFor="gl-band" className="block text-sm font-medium">
								Band
							</label>
							<input
								id="gl-band"
								type="text"
								disabled
								value={gradeLevel.band}
								className="mt-1 block w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
							/>
						</div>

						<div>
							<label
								htmlFor="maxClassSize"
								className="block text-sm font-medium"
							>
								Max Class Size
							</label>
							<input
								id="maxClassSize"
								type="number"
								min={1}
								max={50}
								className={inputClass(!!errors.maxClassSize)}
								{...register('maxClassSize')}
							/>
							{errors.maxClassSize && (
								<p className="mt-1 text-xs text-red-600">
									{errors.maxClassSize.message}
								</p>
							)}
						</div>

						<div className="grid grid-cols-3 gap-3">
							<div>
								<label
									htmlFor="plancherPct"
									className="block text-sm font-medium"
								>
									Plancher %
								</label>
								<input
									id="plancherPct"
									type="text"
									inputMode="decimal"
									className={inputClass(!!errors.plancherPct)}
									{...register('plancherPct')}
								/>
								{errors.plancherPct && (
									<p className="mt-1 text-xs text-red-600">
										{errors.plancherPct.message}
									</p>
								)}
							</div>
							<div>
								<label
									htmlFor="ciblePct"
									className="block text-sm font-medium"
								>
									Cible %
								</label>
								<input
									id="ciblePct"
									type="text"
									inputMode="decimal"
									className={inputClass(!!errors.ciblePct)}
									{...register('ciblePct')}
								/>
								{errors.ciblePct && (
									<p className="mt-1 text-xs text-red-600">
										{errors.ciblePct.message}
									</p>
								)}
							</div>
							<div>
								<label
									htmlFor="plafondPct"
									className="block text-sm font-medium"
								>
									Plafond %
								</label>
								<input
									id="plafondPct"
									type="text"
									inputMode="decimal"
									className={inputClass(!!errors.plafondPct)}
									{...register('plafondPct')}
								/>
								{errors.plafondPct && (
									<p className="mt-1 text-xs text-red-600">
										{errors.plafondPct.message}
									</p>
								)}
							</div>
						</div>

						<div>
							<label
								htmlFor="displayOrder"
								className="block text-sm font-medium"
							>
								Display Order
							</label>
							<input
								id="displayOrder"
								type="number"
								min={0}
								className={inputClass(!!errors.displayOrder)}
								{...register('displayOrder')}
							/>
							{errors.displayOrder && (
								<p className="mt-1 text-xs text-red-600">
									{errors.displayOrder.message}
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
						form="grade-form"
						disabled={updateMutation.isPending}
						className={cn(
							'rounded-md bg-blue-600 px-4 py-2 text-sm',
							'font-medium text-white',
							'hover:bg-blue-700',
							'disabled:opacity-50',
						)}
					>
						{updateMutation.isPending ? 'Saving...' : 'Save'}
					</button>
				</div>

				<div aria-live="polite" className="sr-only">
					{updateMutation.isError && 'Failed to update grade level'}
					{updateMutation.isSuccess && 'Grade level updated'}
				</div>
			</div>
		</>
	)
}
