import { useEffect, useRef, useState } from 'react';
import { Input } from '../ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';

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
				<label className="block text-[length:var(--text-xs)] font-medium text-[var(--text-secondary)]">
					Action
				</label>
				<Select
					value={filters.operation || 'all'}
					onValueChange={(v) => update('operation', v === 'all' ? '' : v)}
				>
					<SelectTrigger className="mt-1 w-[200px]" aria-label="Filter by action">
						<SelectValue placeholder="All" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All</SelectItem>
						{OPERATIONS.map((op) => (
							<SelectItem key={op} value={op}>
								{op}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			<div>
				<label className="block text-[length:var(--text-xs)] font-medium text-[var(--text-secondary)]">
					Entity
				</label>
				<Select
					value={filters.table_name || 'all'}
					onValueChange={(v) => update('table_name', v === 'all' ? '' : v)}
				>
					<SelectTrigger className="mt-1 w-[180px]" aria-label="Filter by entity">
						<SelectValue placeholder="All" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All</SelectItem>
						{ENTITIES.map((e) => (
							<SelectItem key={e} value={e}>
								{e}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
		</div>
	);
}
