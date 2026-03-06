import { useEffect, useRef, useState } from 'react';

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

const ENTITIES = [
	'users',
	'refresh_tokens',
	'system_config',
];

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
					className="block text-xs font-medium text-slate-600"
				>
					From
				</label>
				<input
					id="filter-from"
					type="date"
					className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
					onChange={(e) => update('from', e.target.value)}
				/>
			</div>
			<div>
				<label
					htmlFor="filter-to"
					className="block text-xs font-medium text-slate-600"
				>
					To
				</label>
				<input
					id="filter-to"
					type="date"
					className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
					onChange={(e) => update('to', e.target.value)}
				/>
			</div>
			<div>
				<label
					htmlFor="filter-user"
					className="block text-xs font-medium text-slate-600"
				>
					User ID
				</label>
				<input
					id="filter-user"
					type="text"
					placeholder="e.g. 1"
					className="mt-1 w-20 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
					onChange={(e) => update('user_id', e.target.value)}
				/>
			</div>
			<div>
				<label
					htmlFor="filter-action"
					className="block text-xs font-medium text-slate-600"
				>
					Action
				</label>
				<select
					id="filter-action"
					className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
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
					className="block text-xs font-medium text-slate-600"
				>
					Entity
				</label>
				<select
					id="filter-entity"
					className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
					onChange={(e) =>
						update('table_name', e.target.value)
					}
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
