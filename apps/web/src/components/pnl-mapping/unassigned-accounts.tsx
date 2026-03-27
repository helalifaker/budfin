import { AlertTriangle } from 'lucide-react';
import type { Account } from '../../hooks/use-accounts';
import type { PnlTemplateSection } from '../../hooks/use-pnl-templates';
import { cn } from '../../lib/cn';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

export interface UnassignedAccountsProps {
	accounts: Account[];
	sections: PnlTemplateSection[];
	onAssignAccount: (sectionKey: string, accountCode: string) => void;
}

export function UnassignedAccounts({
	accounts,
	sections,
	onAssignAccount,
}: UnassignedAccountsProps) {
	if (accounts.length === 0) return null;

	const assignableSections = sections.filter((s) => !s.isSubtotal);

	return (
		<div
			className={cn('rounded-xl border border-(--color-warning)/30', 'bg-(--color-warning)/5 p-4')}
		>
			<div className="mb-3 flex items-center gap-2">
				<AlertTriangle className="h-4 w-4 text-(--color-warning)" aria-hidden="true" />
				<h3 className="text-(--text-sm) font-semibold text-(--text-primary)">
					Unassigned Accounts
				</h3>
				<span
					className={cn(
						'inline-flex items-center justify-center',
						'h-5 min-w-5 rounded-full px-1.5',
						'bg-(--color-warning) text-(--text-xs) font-medium text-(--text-on-dark)'
					)}
				>
					{accounts.length}
				</span>
			</div>

			<div className="space-y-1">
				{accounts.map((account) => (
					<div
						key={account.accountCode}
						className={cn(
							'flex items-center gap-2',
							'rounded-md bg-(--workspace-bg-card) px-3 py-2',
							'border border-(--workspace-border)'
						)}
					>
						<span className="font-mono text-(--text-xs) text-(--text-muted) shrink-0">
							{account.accountCode}
						</span>
						<span className="min-w-0 flex-1 truncate text-(--text-sm)">{account.accountName}</span>

						<Select
							value=""
							onValueChange={(sectionKey) => onAssignAccount(sectionKey, account.accountCode)}
						>
							<SelectTrigger
								className="w-[160px] h-7 text-(--text-xs)"
								aria-label={`Assign ${account.accountCode} to section`}
							>
								<SelectValue placeholder="Assign to..." />
							</SelectTrigger>
							<SelectContent>
								{assignableSections.map((section) => (
									<SelectItem key={section.sectionKey} value={section.sectionKey}>
										{section.displayLabel}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				))}
			</div>
		</div>
	);
}
