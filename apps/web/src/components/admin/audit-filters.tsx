import { useEffect, useRef, useState } from 'react';
import { Input } from '../ui/input';
import { cn } from '../../lib/cn';

export interface AuditFilterValues {
	from?: string;
	to?: string;
	user_id?: string;
	operation?: string;
	table_name?: string;
}

interface AuditFiltersProps {
	onFilterChange: (filters: AuditFilterValues) => void;
}

const OPERATIONS = [
	'LOGIN_SUCCESS',
	'LOGIN_FAILURE',
	'ACCOUNT_LOCKED',
	'ACCOUNT_UNLOCKED',
	'USER_CREATED',
	'USER_UPDATED',
	'SESSION_FORCE_REVOKED',
	'AUTHORIZATION_FAILED',
	'CONFIG_UPDATED',
	'TOKEN_FAMILY_CREATED',
	'TOKEN_FAMILY_REVOKED',
	'TOKEN_ROTATION',
	'ALL_SESSIONS_REVOKED',
];

const ENTITIES = ['users', 'refresh_tokens', 'system_config'];

const selectClassName = cn(
	'flex h-9 w-full rounded-[var(--radius-md)] border border-[var(--workspace-border)] bg-[var(--workspace-bg-card)]',
	'px-3 py-2 text-[length:var(--text-sm)] text-[var(--text-primary)]',
	'focus:outline-none focus:ring-2 focus:ring-[var(--accent-500)] focus:ring-offset-2',
	'disabled:cursor-not-allowed disabled:opacity-50'
);

export function AuditFilters({ onFilterChange }: AuditFiltersProps) {
	const [filters, setFilters] = useState<AuditFilterValues>({});
	const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

	useEffect(() => {
		if (debounceRef.current) clearTimeout(debounceRef.current);
		debounceRef.current = setTimeout(() => {
			onFilterChange(filters);
		}, 300);
		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current);
		};
	}, [filters, onFilterChange]);

	function update(key: keyof AuditFilterValues, value: string) {
		setFilters((prev) => ({
			...prev,
			[key]: value || undefined,
		}));
	}

	return (
		<div className="flex flex-wrap items-end gap-3 pb-4">
			<div>
				<label
					htmlFor="filter-from"
					className="block text-[length:var(--text-xs)] font-medium text-[var(--text-secondary)]"
				>
					From
				</label>
				<Input
					id="filter-from"
					type="date"
					className="mt-1"
					onChange={(e) => update('from', e.target.value)}
				/>
			</div>
			<div>
				<label
					htmlFor="filter-to"
					className="block text-[length:var(--text-xs)] font-medium text-[var(--text-secondary)]"
				>
					To
				</label>
				<Input
					id="filter-to"
					type="date"
					className="mt-1"
					onChange={(e) => update('to', e.target.value)}
				/>
			</div>
			<div>
				<label
					htmlFor="filter-user"
					className="block text-[length:var(--text-xs)] font-medium text-[var(--text-secondary)]"
				>
					User ID
				</label>
				<Input
					id="filter-user"
					type="text"
					placeholder="e.g. 1"
					className="mt-1 w-20"
					onChange={(e) => update('user_id', e.target.value)}
				/>
			</div>
			<div>
				<label
					htmlFor="filter-action"
					className="block text-[length:var(--text-xs)] font-medium text-[var(--text-secondary)]"
				>
					Action
				</label>
				<select
					id="filter-action"
					className={cn(selectClassName, 'mt-1')}
					onChange={(e) => update('operation', e.target.value)}
				>
					<option value="">All</option>
					{OPERATIONS.map((op) => (
						<option key={op} value={op}>
							{op}
						</option>
					))}
				</select>
			</div>
			<div>
				<label
					htmlFor="filter-entity"
					className="block text-[length:var(--text-xs)] font-medium text-[var(--text-secondary)]"
				>
					Entity
				</label>
				<select
					id="filter-entity"
					className={cn(selectClassName, 'mt-1')}
					onChange={(e) => update('table_name', e.target.value)}
				>
					<option value="">All</option>
					{ENTITIES.map((e) => (
						<option key={e} value={e}>
							{e}
						</option>
					))}
				</select>
			</div>
		</div>
	);
}
