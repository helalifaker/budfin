import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { apiClient } from '../../lib/api-client';
import { AuditFilters, type AuditFilterValues } from '../../components/admin/audit-filters';
import { ListGrid } from '../../components/data-grid/list-grid';
import { Input } from '../../components/ui/input';
import {
	Select,
	SelectTrigger,
	SelectValue,
	SelectContent,
	SelectItem,
} from '../../components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import { useVersions } from '../../hooks/use-versions';

// ── Audit Log Types ──────────────────────────────────────────────────────────

interface AuditEntry {
	id: number;
	user_id: number | null;
	operation: string;
	table_name: string | null;
	record_id: number | null;
	old_values: unknown;
	new_values: unknown;
	ip_address: string | null;
	created_at: string;
}

interface AuditResponse {
	entries: AuditEntry[];
	total: number;
	page: number;
	page_size: number;
}

// ── Calculation History Types ────────────────────────────────────────────────

interface CalcEntry {
	id: number;
	run_id: string;
	version_id: number | null;
	version_name: string | null;
	fiscal_year: number | null;
	module: string;
	status: string;
	started_at: string;
	completed_at: string | null;
	duration_ms: number | null;
	triggered_by: string | null;
	input_summary: unknown;
	output_summary: unknown;
}

interface CalcResponse {
	entries: CalcEntry[];
	total: number;
	page: number;
	page_size: number;
}

interface CalcFilterValues {
	version_id?: string;
	module?: string;
	from?: string;
	to?: string;
}

// ── Shared Utilities ─────────────────────────────────────────────────────────

const auditColumnHelper = createColumnHelper<AuditEntry>();
const calcColumnHelper = createColumnHelper<CalcEntry>();

function formatTimestamp(iso: string): string {
	return new Date(iso).toLocaleString('en-GB', {
		timeZone: 'Asia/Riyadh',
		dateStyle: 'medium',
		timeStyle: 'medium',
	});
}

function buildAuditQueryString(page: number, pageSize: number, filters: AuditFilterValues): string {
	const params = new URLSearchParams();
	params.set('page', String(page));
	params.set('page_size', String(pageSize));

	if (filters.from) {
		params.set('from', new Date(filters.from).toISOString());
	}
	if (filters.to) {
		params.set('to', new Date(filters.to).toISOString());
	}
	if (filters.user_id) params.set('user_id', filters.user_id);
	if (filters.operation) {
		params.set('operation', filters.operation);
	}
	if (filters.table_name) {
		params.set('table_name', filters.table_name);
	}

	return params.toString();
}

function buildCalcQueryString(page: number, pageSize: number, filters: CalcFilterValues): string {
	const params = new URLSearchParams();
	params.set('page', String(page));
	params.set('page_size', String(pageSize));

	if (filters.version_id) params.set('version_id', filters.version_id);
	if (filters.module) params.set('module', filters.module);
	if (filters.from) {
		params.set('from', new Date(filters.from).toISOString());
	}
	if (filters.to) {
		params.set('to', new Date(filters.to).toISOString());
	}

	return params.toString();
}

// ── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
	const colors: Record<string, string> = {
		COMPLETED: 'bg-(--color-success-bg) text-(--color-success) border-(--color-success)/20',
		FAILED: 'bg-(--color-error-bg) text-(--color-error) border-(--color-error)/20',
		STARTED: 'bg-(--color-warning-bg) text-(--color-warning) border-(--color-warning)/20',
	};

	return (
		<span
			className={`inline-flex items-center rounded-md border px-2 py-0.5 text-(--text-xs) font-medium ${colors[status] ?? 'bg-(--workspace-bg-subtle) text-(--text-secondary) border-(--workspace-border)'}`}
		>
			{status}
		</span>
	);
}

// ── Audit Log Tab ────────────────────────────────────────────────────────────

function AuditLogTab() {
	const [page, setPage] = useState(1);
	const [pageSize] = useState(50);
	const [filters, setFilters] = useState<AuditFilterValues>({});

	const queryString = buildAuditQueryString(page, pageSize, filters);

	const { data, isLoading } = useQuery({
		queryKey: ['audit', queryString],
		queryFn: () => apiClient<AuditResponse>(`/audit?${queryString}`),
	});

	const handleFilterChange = useCallback((newFilters: AuditFilterValues) => {
		setFilters(newFilters);
		setPage(1);
	}, []);

	const columns = useMemo(
		() => [
			auditColumnHelper.accessor('created_at', {
				header: 'Timestamp',
				cell: (info) => formatTimestamp(info.getValue()),
			}),
			auditColumnHelper.accessor('user_id', {
				header: 'User',
				cell: (info) => info.getValue() ?? '-',
			}),
			auditColumnHelper.accessor('operation', {
				header: 'Action',
				cell: (info) => (
					<span className="rounded-sm bg-(--workspace-bg-muted) px-2 py-0.5 text-(--text-xs) font-mono">
						{info.getValue()}
					</span>
				),
			}),
			auditColumnHelper.accessor('table_name', {
				header: 'Entity',
				cell: (info) => info.getValue() ?? '-',
			}),
			auditColumnHelper.accessor('record_id', {
				header: 'Record ID',
				cell: (info) => info.getValue() ?? '-',
			}),
			auditColumnHelper.display({
				id: 'details',
				header: 'Details',
				cell: ({ row }) => {
					const nv = row.original.new_values;
					if (!nv) return '-';
					return (
						<pre className="max-w-xs truncate text-(--text-xs) text-(--text-muted)">
							{JSON.stringify(nv)}
						</pre>
					);
				},
			}),
		],
		[]
	);

	const table = useReactTable({
		data: data?.entries ?? [],
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	return (
		<>
			<AuditFilters onFilterChange={handleFilterChange} />

			<ListGrid
				table={table}
				isLoading={isLoading}
				pagination={{
					page,
					pageSize,
					total: data?.total ?? 0,
					onPageChange: setPage,
				}}
				ariaLabel="Audit log"
			/>
		</>
	);
}

// ── Calculation History Filters ──────────────────────────────────────────────

const CALC_MODULES = ['ENROLLMENT', 'REVENUE', 'STAFFING', 'OPEX', 'PNL'];

function CalcHistoryFilters({
	onFilterChange,
}: {
	onFilterChange: (filters: CalcFilterValues) => void;
}) {
	const [filters, setFilters] = useState<CalcFilterValues>({});
	const { data: versionsData } = useVersions();
	const versions = versionsData?.data ?? [];

	function update(key: keyof CalcFilterValues, value: string) {
		const next = { ...filters, [key]: value || undefined };
		setFilters(next);
		onFilterChange(next);
	}

	return (
		<div className="flex flex-wrap items-end gap-3 pb-4">
			<div>
				<label className="block text-(--text-xs) font-medium text-(--text-secondary)">
					Version
				</label>
				<Select
					value={filters.version_id || 'all'}
					onValueChange={(v) => update('version_id', v === 'all' ? '' : v)}
				>
					<SelectTrigger className="mt-1 w-[220px]" aria-label="Filter by version">
						<SelectValue placeholder="All versions" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All versions</SelectItem>
						{versions.map((v) => (
							<SelectItem key={v.id} value={String(v.id)}>
								{v.name} (FY{v.fiscalYear})
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			<div>
				<label className="block text-(--text-xs) font-medium text-(--text-secondary)">Module</label>
				<Select
					value={filters.module || 'all'}
					onValueChange={(v) => update('module', v === 'all' ? '' : v)}
				>
					<SelectTrigger className="mt-1 w-[180px]" aria-label="Filter by module">
						<SelectValue placeholder="All modules" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All modules</SelectItem>
						{CALC_MODULES.map((m) => (
							<SelectItem key={m} value={m}>
								{m}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			<div>
				<label
					htmlFor="calc-filter-from"
					className="block text-(--text-xs) font-medium text-(--text-secondary)"
				>
					From
				</label>
				<Input
					id="calc-filter-from"
					type="date"
					className="mt-1"
					onChange={(e) => update('from', e.target.value)}
				/>
			</div>
			<div>
				<label
					htmlFor="calc-filter-to"
					className="block text-(--text-xs) font-medium text-(--text-secondary)"
				>
					To
				</label>
				<Input
					id="calc-filter-to"
					type="date"
					className="mt-1"
					onChange={(e) => update('to', e.target.value)}
				/>
			</div>
		</div>
	);
}

// ── Calculation History Tab ──────────────────────────────────────────────────

function CalcHistoryTab() {
	const [page, setPage] = useState(1);
	const [pageSize] = useState(20);
	const [filters, setFilters] = useState<CalcFilterValues>({});

	const queryString = buildCalcQueryString(page, pageSize, filters);

	const { data, isLoading } = useQuery({
		queryKey: ['audit-calculation', queryString],
		queryFn: () => apiClient<CalcResponse>(`/audit/calculation?${queryString}`),
	});

	const handleFilterChange = useCallback((newFilters: CalcFilterValues) => {
		setFilters(newFilters);
		setPage(1);
	}, []);

	const columns = useMemo(
		() => [
			calcColumnHelper.accessor('started_at', {
				header: 'Timestamp',
				cell: (info) => formatTimestamp(info.getValue()),
			}),
			calcColumnHelper.accessor('module', {
				header: 'Module',
				cell: (info) => (
					<span className="rounded-sm bg-(--workspace-bg-muted) px-2 py-0.5 text-(--text-xs) font-mono">
						{info.getValue()}
					</span>
				),
			}),
			calcColumnHelper.accessor('status', {
				header: 'Status',
				cell: (info) => <StatusBadge status={info.getValue()} />,
			}),
			calcColumnHelper.accessor('duration_ms', {
				header: 'Duration',
				cell: (info) => {
					const ms = info.getValue();
					if (ms == null) return '-';
					if (ms < 1000) return `${ms}ms`;
					return `${(ms / 1000).toFixed(1)}s`;
				},
			}),
			calcColumnHelper.accessor('version_name', {
				header: 'Version',
				cell: (info) => {
					const name = info.getValue();
					const fy = info.row.original.fiscal_year;
					if (!name) return '-';
					return fy ? `${name} (FY${fy})` : name;
				},
			}),
			calcColumnHelper.accessor('triggered_by', {
				header: 'Triggered By',
				cell: (info) => info.getValue() ?? '-',
			}),
			calcColumnHelper.accessor('output_summary', {
				header: 'Output Summary',
				cell: (info) => {
					const val = info.getValue();
					if (!val) return '-';
					const text = JSON.stringify(val);
					return (
						<pre className="max-w-xs truncate text-(--text-xs) text-(--text-muted)" title={text}>
							{text}
						</pre>
					);
				},
			}),
		],
		[]
	);

	const table = useReactTable({
		data: data?.entries ?? [],
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	return (
		<>
			<CalcHistoryFilters onFilterChange={handleFilterChange} />

			<ListGrid
				table={table}
				isLoading={isLoading}
				pagination={{
					page,
					pageSize,
					total: data?.total ?? 0,
					onPageChange: setPage,
				}}
				ariaLabel="Calculation history"
			/>
		</>
	);
}

// ── Main Page ────────────────────────────────────────────────────────────────

export function AuditPage() {
	return (
		<div className="p-6">
			<h1 className="pb-4 text-(--text-xl) font-semibold">Audit Trail</h1>

			<Tabs defaultValue="audit-log">
				<TabsList>
					<TabsTrigger value="audit-log">Audit Log</TabsTrigger>
					<TabsTrigger value="calculation-history">Calculation History</TabsTrigger>
				</TabsList>

				<TabsContent value="audit-log">
					<AuditLogTab />
				</TabsContent>

				<TabsContent value="calculation-history">
					<CalcHistoryTab />
				</TabsContent>
			</Tabs>
		</div>
	);
}
