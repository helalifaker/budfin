import { useEffect, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '../../lib/cn';
import type { Account } from '../../hooks/use-accounts';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';

const accountSchema = z.object({
	accountCode: z.string().min(1, 'Account code is required'),
	accountName: z.string().min(1, 'Account name is required'),
	type: z.enum(['REVENUE', 'EXPENSE', 'ASSET', 'LIABILITY']),
	ifrsCategory: z.string().min(1, 'IFRS category is required'),
	centerType: z.enum(['PROFIT_CENTER', 'COST_CENTER']),
	description: z.string().nullable(),
	status: z.enum(['ACTIVE', 'INACTIVE']),
});

type AccountFormValues = z.infer<typeof accountSchema>;

export type AccountsSidePanelProps = {
	open: boolean;
	onClose: () => void;
	account?: Account | null;
	onSave: (data: AccountFormValues & { version?: number }) => void;
	loading?: boolean;
};

const TYPES = ['REVENUE', 'EXPENSE', 'ASSET', 'LIABILITY'] as const;
const TYPE_LABELS: Record<string, string> = {
	REVENUE: 'Revenue',
	EXPENSE: 'Expense',
	ASSET: 'Asset',
	LIABILITY: 'Liability',
};

const CENTER_TYPES = ['PROFIT_CENTER', 'COST_CENTER'] as const;
const CENTER_TYPE_LABELS: Record<string, string> = {
	PROFIT_CENTER: 'Profit Center',
	COST_CENTER: 'Cost Center',
};

const STATUSES = ['ACTIVE', 'INACTIVE'] as const;

export function AccountsSidePanel({
	open,
	onClose,
	account,
	onSave,
	loading = false,
}: AccountsSidePanelProps) {
	const panelRef = useRef<HTMLDivElement>(null);
	const isEdit = !!account;
	const titleId = 'accounts-panel-title';

	const defaultValues: AccountFormValues = {
		accountCode: '',
		accountName: '',
		type: 'EXPENSE',
		ifrsCategory: '',
		centerType: 'COST_CENTER',
		description: null,
		status: 'ACTIVE',
	};

	const formOptions: Parameters<typeof useForm<AccountFormValues>>[0] = {
		resolver: zodResolver(accountSchema),
		defaultValues,
	};

	if (account) {
		formOptions.values = {
			accountCode: account.accountCode,
			accountName: account.accountName,
			type: account.type,
			ifrsCategory: account.ifrsCategory,
			centerType: account.centerType,
			description: account.description,
			status: account.status,
		};
	}

	const form = useForm<AccountFormValues>(formOptions);

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

	// Reset form when opening for create
	useEffect(() => {
		if (open && !account) {
			form.reset();
		}
	}, [open, account, form]);

	if (!open) return null;

	const handleFormSubmit = form.handleSubmit((data: AccountFormValues) => {
		if (isEdit && account) {
			onSave({ ...data, version: account.version });
		} else {
			onSave(data);
		}
	});

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
					'bg-white shadow-xl',
					'flex flex-col'
				)}
			>
				<div className="border-b px-6 py-4">
					<h2 id={titleId} className="text-lg font-semibold">
						{isEdit ? `Edit Account: ${account.accountCode}` : 'Add Account'}
					</h2>
				</div>

				<div className="flex-1 overflow-y-auto px-6 py-4">
					<form id="account-form" onSubmit={handleFormSubmit} className="space-y-4">
						<div>
							<label htmlFor="accountCode" className="block text-sm font-medium">
								Account Code
							</label>
							<Input
								id="accountCode"
								type="text"
								disabled={isEdit}
								className={cn(
									'mt-1',
									isEdit && 'bg-slate-100 text-slate-500',
									form.formState.errors.accountCode && 'border-red-500'
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
							<label htmlFor="accountName" className="block text-sm font-medium">
								Account Name
							</label>
							<Input
								id="accountName"
								type="text"
								className={cn('mt-1', form.formState.errors.accountName && 'border-red-500')}
								{...form.register('accountName')}
							/>
							{form.formState.errors.accountName && (
								<p className="mt-1 text-xs text-red-600">
									{form.formState.errors.accountName.message}
								</p>
							)}
						</div>

						<div>
							<label htmlFor="type" className="block text-sm font-medium">
								Type
							</label>
							<Controller
								control={form.control}
								name="type"
								render={({ field }) => (
									<Select value={field.value} onValueChange={field.onChange}>
										<SelectTrigger id="type" className="mt-1">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{TYPES.map((t) => (
												<SelectItem key={t} value={t}>
													{TYPE_LABELS[t]}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								)}
							/>
						</div>

						<div>
							<label htmlFor="ifrsCategory" className="block text-sm font-medium">
								IFRS Category
							</label>
							<Input
								id="ifrsCategory"
								type="text"
								className={cn('mt-1', form.formState.errors.ifrsCategory && 'border-red-500')}
								{...form.register('ifrsCategory')}
							/>
							{form.formState.errors.ifrsCategory && (
								<p className="mt-1 text-xs text-red-600">
									{form.formState.errors.ifrsCategory.message}
								</p>
							)}
						</div>

						<div>
							<label htmlFor="centerType" className="block text-sm font-medium">
								Center Type
							</label>
							<Controller
								control={form.control}
								name="centerType"
								render={({ field }) => (
									<Select value={field.value} onValueChange={field.onChange}>
										<SelectTrigger id="centerType" className="mt-1">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{CENTER_TYPES.map((ct) => (
												<SelectItem key={ct} value={ct}>
													{CENTER_TYPE_LABELS[ct]}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								)}
							/>
						</div>

						<div>
							<label htmlFor="description" className="block text-sm font-medium">
								Description
							</label>
							<textarea
								id="description"
								rows={3}
								className={cn(
									'mt-1 flex w-full rounded-md border',
									'border-slate-300 bg-white px-3 py-2 text-sm text-slate-900',
									'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
								)}
								{...form.register('description')}
							/>
						</div>

						<div>
							<label htmlFor="status" className="block text-sm font-medium">
								Status
							</label>
							<Controller
								control={form.control}
								name="status"
								render={({ field }) => (
									<Select value={field.value} onValueChange={field.onChange}>
										<SelectTrigger id="status" className="mt-1">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{STATUSES.map((s) => (
												<SelectItem key={s} value={s}>
													{s === 'ACTIVE' ? 'Active' : 'Inactive'}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								)}
							/>
						</div>
					</form>
				</div>

				<div className="flex justify-end gap-3 border-t px-6 py-4">
					<Button type="button" variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button type="submit" form="account-form" loading={loading}>
						Save
					</Button>
				</div>
			</div>
		</>
	);
}
