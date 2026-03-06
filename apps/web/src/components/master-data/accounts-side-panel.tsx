import { useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { cn } from '../../lib/cn'
import type { Account } from '../../hooks/use-accounts'

const accountSchema = z.object({
	accountCode: z.string().min(1, 'Account code is required'),
	accountName: z.string().min(1, 'Account name is required'),
	type: z.enum(['REVENUE', 'EXPENSE', 'ASSET', 'LIABILITY']),
	ifrsCategory: z.string().min(1, 'IFRS category is required'),
	centerType: z.enum(['PROFIT_CENTER', 'COST_CENTER']),
	description: z.string().nullable(),
	status: z.enum(['ACTIVE', 'INACTIVE']),
})

type AccountFormValues = z.infer<typeof accountSchema>

export type AccountsSidePanelProps = {
	open: boolean
	onClose: () => void
	account?: Account | null
	onSave: (data: AccountFormValues & { version?: number }) => void
	loading?: boolean
}

const TYPES = ['REVENUE', 'EXPENSE', 'ASSET', 'LIABILITY'] as const
const TYPE_LABELS: Record<string, string> = {
	REVENUE: 'Revenue',
	EXPENSE: 'Expense',
	ASSET: 'Asset',
	LIABILITY: 'Liability',
}

const CENTER_TYPES = ['PROFIT_CENTER', 'COST_CENTER'] as const
const CENTER_TYPE_LABELS: Record<string, string> = {
	PROFIT_CENTER: 'Profit Center',
	COST_CENTER: 'Cost Center',
}

const STATUSES = ['ACTIVE', 'INACTIVE'] as const

export function AccountsSidePanel({
	open,
	onClose,
	account,
	onSave,
	loading = false,
}: AccountsSidePanelProps) {
	const panelRef = useRef<HTMLDivElement>(null)
	const isEdit = !!account
	const titleId = 'accounts-panel-title'

	const defaultValues: AccountFormValues = {
		accountCode: '',
		accountName: '',
		type: 'EXPENSE',
		ifrsCategory: '',
		centerType: 'COST_CENTER',
		description: null,
		status: 'ACTIVE',
	}

	const formOptions: Parameters<typeof useForm<AccountFormValues>>[0] = {
		resolver: zodResolver(accountSchema),
		defaultValues,
	}

	if (account) {
		formOptions.values = {
			accountCode: account.accountCode,
			accountName: account.accountName,
			type: account.type,
			ifrsCategory: account.ifrsCategory,
			centerType: account.centerType,
			description: account.description,
			status: account.status,
		}
	}

	const form = useForm<AccountFormValues>(formOptions)

	// Focus trap + Escape
	useEffect(() => {
		if (!open) return
		const panel = panelRef.current
		if (!panel) return

		const focusable = panel.querySelectorAll<HTMLElement>(
			'input, select, textarea, button, [tabindex]:not([tabindex="-1"])'
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

	// Reset form when opening for create
	useEffect(() => {
		if (open && !account) {
			form.reset()
		}
	}, [open, account, form])

	if (!open) return null

	const handleFormSubmit = form.handleSubmit((data: AccountFormValues) => {
		if (isEdit && account) {
			onSave({ ...data, version: account.version })
		} else {
			onSave(data)
		}
	})

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
				aria-labelledby={titleId}
				className={cn(
					'fixed right-0 top-0 z-50 h-full w-[480px]',
					'bg-white shadow-xl',
					'flex flex-col',
				)}
			>
				<div className="border-b px-6 py-4">
					<h2 id={titleId} className="text-lg font-semibold">
						{isEdit
							? `Edit Account: ${account.accountCode}`
							: 'Add Account'}
					</h2>
				</div>

				<div className="flex-1 overflow-y-auto px-6 py-4">
					<form
						id="account-form"
						onSubmit={handleFormSubmit}
						className="space-y-4"
					>
						<div>
							<label
								htmlFor="accountCode"
								className="block text-sm font-medium"
							>
								Account Code
							</label>
							<input
								id="accountCode"
								type="text"
								disabled={isEdit}
								className={cn(
									'mt-1 block w-full rounded-md border px-3 py-2 text-sm',
									isEdit && 'bg-slate-100 text-slate-500',
									form.formState.errors.accountCode
										? 'border-red-500'
										: 'border-slate-300',
								)}
								{...form.register('accountCode')}
							/>
							{form.formState.errors.accountCode && (
								<p className="mt-1 text-xs text-red-600">
									{form.formState.errors.accountCode.message}
								</p>
							)}
						</div>

						<div>
							<label
								htmlFor="accountName"
								className="block text-sm font-medium"
							>
								Account Name
							</label>
							<input
								id="accountName"
								type="text"
								className={cn(
									'mt-1 block w-full rounded-md border px-3 py-2 text-sm',
									form.formState.errors.accountName
										? 'border-red-500'
										: 'border-slate-300',
								)}
								{...form.register('accountName')}
							/>
							{form.formState.errors.accountName && (
								<p className="mt-1 text-xs text-red-600">
									{form.formState.errors.accountName.message}
								</p>
							)}
						</div>

						<div>
							<label
								htmlFor="type"
								className="block text-sm font-medium"
							>
								Type
							</label>
							<select
								id="type"
								className={cn(
									'mt-1 block w-full rounded-md border',
									'border-slate-300 px-3 py-2 text-sm',
								)}
								{...form.register('type')}
							>
								{TYPES.map((t) => (
									<option key={t} value={t}>
										{TYPE_LABELS[t]}
									</option>
								))}
							</select>
						</div>

						<div>
							<label
								htmlFor="ifrsCategory"
								className="block text-sm font-medium"
							>
								IFRS Category
							</label>
							<input
								id="ifrsCategory"
								type="text"
								className={cn(
									'mt-1 block w-full rounded-md border px-3 py-2 text-sm',
									form.formState.errors.ifrsCategory
										? 'border-red-500'
										: 'border-slate-300',
								)}
								{...form.register('ifrsCategory')}
							/>
							{form.formState.errors.ifrsCategory && (
								<p className="mt-1 text-xs text-red-600">
									{form.formState.errors.ifrsCategory.message}
								</p>
							)}
						</div>

						<div>
							<label
								htmlFor="centerType"
								className="block text-sm font-medium"
							>
								Center Type
							</label>
							<select
								id="centerType"
								className={cn(
									'mt-1 block w-full rounded-md border',
									'border-slate-300 px-3 py-2 text-sm',
								)}
								{...form.register('centerType')}
							>
								{CENTER_TYPES.map((ct) => (
									<option key={ct} value={ct}>
										{CENTER_TYPE_LABELS[ct]}
									</option>
								))}
							</select>
						</div>

						<div>
							<label
								htmlFor="description"
								className="block text-sm font-medium"
							>
								Description
							</label>
							<textarea
								id="description"
								rows={3}
								className={cn(
									'mt-1 block w-full rounded-md border',
									'border-slate-300 px-3 py-2 text-sm',
								)}
								{...form.register('description')}
							/>
						</div>

						<div>
							<label
								htmlFor="status"
								className="block text-sm font-medium"
							>
								Status
							</label>
							<select
								id="status"
								className={cn(
									'mt-1 block w-full rounded-md border',
									'border-slate-300 px-3 py-2 text-sm',
								)}
								{...form.register('status')}
							>
								{STATUSES.map((s) => (
									<option key={s} value={s}>
										{s === 'ACTIVE' ? 'Active' : 'Inactive'}
									</option>
								))}
							</select>
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
						form="account-form"
						disabled={loading}
						className={cn(
							'rounded-md bg-blue-600 px-4 py-2 text-sm',
							'font-medium text-white',
							'hover:bg-blue-700',
							'disabled:opacity-50',
						)}
					>
						{loading ? 'Saving...' : 'Save'}
					</button>
				</div>
			</div>
		</>
	)
}
