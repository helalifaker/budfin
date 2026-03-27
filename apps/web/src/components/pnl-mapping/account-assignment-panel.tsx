import { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { PnlAccountMapping, PnlTemplateSection } from '../../hooks/use-pnl-templates';
import type { Account } from '../../hooks/use-accounts';
import { cn } from '../../lib/cn';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

export interface AccountAssignmentPanelProps {
	section: PnlTemplateSection;
	allAccounts: Account[];
	onVisibilityChange: (sectionKey: string, mappingId: number, visibility: 'SHOW' | 'GROUP') => void;
	onRemoveAccount: (sectionKey: string, mappingId: number) => void;
	onAddAccount: (sectionKey: string, accountCode: string) => void;
}

export function AccountAssignmentPanel({
	section,
	allAccounts,
	onVisibilityChange,
	onRemoveAccount,
	onAddAccount,
}: AccountAssignmentPanelProps) {
	const [searchTerm, setSearchTerm] = useState('');
	const [isAddingAccount, setIsAddingAccount] = useState(false);

	// Filter accounts for the add dropdown to exclude already-assigned ones
	const assignedCodes = useMemo(
		() => new Set(section.mappings.map((m) => m.accountCode).filter(Boolean)),
		[section.mappings]
	);

	const availableAccounts = useMemo(() => {
		return allAccounts.filter((a) => {
			if (assignedCodes.has(a.accountCode)) return false;
			if (a.status !== 'ACTIVE') return false;
			if (!searchTerm) return true;
			const term = searchTerm.toLowerCase();
			return (
				a.accountCode.toLowerCase().includes(term) || a.accountName.toLowerCase().includes(term)
			);
		});
	}, [allAccounts, assignedCodes, searchTerm]);

	const handleAddAccount = (accountCode: string) => {
		onAddAccount(section.sectionKey, accountCode);
		setIsAddingAccount(false);
		setSearchTerm('');
	};

	if (section.isSubtotal) {
		return (
			<div className="flex flex-col items-center justify-center py-12 text-center">
				<p className="text-(--text-sm) text-(--text-muted)">
					This is a subtotal row. It automatically aggregates values from mapped sections.
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{/* Header */}
			<div className="flex items-center justify-between">
				<h3 className="text-(--text-sm) font-semibold text-(--text-primary)">
					Section: {section.displayLabel}
				</h3>
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={() => setIsAddingAccount(!isAddingAccount)}
				>
					<Plus className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
					Add account
				</Button>
			</div>

			{/* Add account search */}
			{isAddingAccount && (
				<div
					className={cn(
						'rounded-lg border border-(--accent-300) bg-(--accent-50)/30 p-3',
						'space-y-2'
					)}
				>
					<Input
						type="search"
						placeholder="Search by code or name..."
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						aria-label="Search accounts to add"
						autoFocus
					/>
					<div className="max-h-48 overflow-y-auto rounded-md border border-(--workspace-border)">
						{availableAccounts.length === 0 ? (
							<p className="px-3 py-2 text-(--text-xs) text-(--text-muted)">
								No matching accounts found
							</p>
						) : (
							availableAccounts.slice(0, 50).map((account) => (
								<button
									key={account.accountCode}
									type="button"
									className={cn(
										'flex w-full items-center gap-2 px-3 py-1.5',
										'text-left text-(--text-sm)',
										'hover:bg-(--workspace-bg-muted)',
										'transition-colors duration-(--duration-fast)',
										'border-b border-(--workspace-border) last:border-b-0'
									)}
									onClick={() => handleAddAccount(account.accountCode)}
								>
									<span className="font-mono text-(--text-xs) text-(--text-muted)">
										{account.accountCode}
									</span>
									<span className="truncate">{account.accountName}</span>
								</button>
							))
						)}
					</div>
					<div className="flex justify-end">
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => {
								setIsAddingAccount(false);
								setSearchTerm('');
							}}
						>
							Cancel
						</Button>
					</div>
				</div>
			)}

			{/* Account list */}
			{section.mappings.length === 0 ? (
				<p className="py-6 text-center text-(--text-sm) text-(--text-muted)">
					No accounts assigned to this section yet.
				</p>
			) : (
				<div className="space-y-1">
					{section.mappings.map((mapping) => (
						<AccountMappingRow
							key={mapping.id}
							mapping={mapping}
							sectionKey={section.sectionKey}
							onVisibilityChange={onVisibilityChange}
							onRemove={onRemoveAccount}
						/>
					))}
				</div>
			)}
		</div>
	);
}

// ── Individual Account Row ───────────────────────────────────────────────────

function AccountMappingRow({
	mapping,
	sectionKey,
	onVisibilityChange,
	onRemove,
}: {
	mapping: PnlAccountMapping;
	sectionKey: string;
	onVisibilityChange: (sectionKey: string, mappingId: number, visibility: 'SHOW' | 'GROUP') => void;
	onRemove: (sectionKey: string, mappingId: number) => void;
}) {
	const label = mapping.displayLabel ?? mapping.accountCode ?? 'Category mapping';
	return (
		<div
			className={cn(
				'flex items-center gap-2',
				'rounded-md border border-(--workspace-border)',
				'bg-(--workspace-bg-card) px-3 py-2',
				'transition-colors duration-(--duration-fast)',
				'hover:bg-(--workspace-bg-muted)'
			)}
		>
			<span className="font-mono text-(--text-xs) text-(--text-muted) shrink-0">
				{mapping.accountCode ?? '\u2014'}
			</span>
			<span className="min-w-0 flex-1 truncate text-(--text-sm) text-(--text-primary)">
				{label}
			</span>

			<Select
				value={mapping.visibility}
				onValueChange={(v) => onVisibilityChange(sectionKey, mapping.id, v as 'SHOW' | 'GROUP')}
			>
				<SelectTrigger
					className="w-[100px] h-7 text-(--text-xs)"
					aria-label={`Visibility for ${label}`}
				>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="SHOW">SHOW</SelectItem>
					<SelectItem value="GROUP">GROUP</SelectItem>
				</SelectContent>
			</Select>

			<button
				type="button"
				className={cn(
					'shrink-0 rounded-md p-1',
					'text-(--text-muted) hover:text-(--color-error)',
					'transition-colors duration-(--duration-fast)'
				)}
				onClick={() => onRemove(sectionKey, mapping.id)}
				aria-label={`Remove ${label} from ${sectionKey}`}
			>
				<X className="h-3.5 w-3.5" />
			</button>
		</div>
	);
}
