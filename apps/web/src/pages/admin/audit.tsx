import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
	createColumnHelper,
	flexRender,
	getCoreRowModel,
	useReactTable,
} from '@tanstack/react-table';
import { apiClient } from '../../lib/api-client';
import { AuditFilters, type AuditFilterValues } from '../../components/admin/audit-filters';
import { Button } from '../../components/ui/button';
import { TableSkeleton } from '../../components/ui/skeleton';

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

const columnHelper = createColumnHelper<AuditEntry>();

function formatTimestamp(iso: string): string {
	return new Date(iso).toLocaleString('en-GB', {
		timeZone: 'Asia/Riyadh',
		dateStyle: 'medium',
		timeStyle: 'medium',
	});
}

function buildQueryString(page: number, pageSize: number, filters: AuditFilterValues): string {
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

export function AuditPage() {
	const [page, setPage] = useState(1);
	const [pageSize] = useState(50);
	const [filters, setFilters] = useState<AuditFilterValues>({});

	const queryString = buildQueryString(page, pageSize, filters);

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
			columnHelper.accessor('created_at', {
				header: 'Timestamp',
				cell: (info) => formatTimestamp(info.getValue()),
			}),
			columnHelper.accessor('user_id', {
				header: 'User',
				cell: (info) => info.getValue() ?? '-',
			}),
			columnHelper.accessor('operation', {
				header: 'Action',
				cell: (info) => (
					<span className="rounded-[var(--radius-sm)] bg-[var(--workspace-bg-muted)] px-2 py-0.5 text-[length:var(--text-xs)] font-mono">
						{info.getValue()}
					</span>
				),
			}),
			columnHelper.accessor('table_name', {
				header: 'Entity',
				cell: (info) => info.getValue() ?? '-',
			}),
			columnHelper.accessor('record_id', {
				header: 'Record ID',
				cell: (info) => info.getValue() ?? '-',
			}),
			columnHelper.display({
				id: 'details',
				header: 'Details',
				cell: ({ row }) => {
					const nv = row.original.new_values;
					if (!nv) return '-';
					return (
						<pre className="max-w-xs truncate text-[length:var(--text-xs)] text-[var(--text-muted)]">
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

	const totalPages = data ? Math.ceil(data.total / data.page_size) : 0;

	const [showSkeleton, setShowSkeleton] = useState(false);
	useEffect(() => {
		if (!isLoading) {
			const t = setTimeout(() => setShowSkeleton(false), 0);
			return () => clearTimeout(t);
		}
		const t = setTimeout(() => setShowSkeleton(true), 200);
		return () => clearTimeout(t);
	}, [isLoading]);

	return (
		<div className="p-6">
			<h1 className="pb-4 text-[length:var(--text-xl)] font-semibold">Audit Trail</h1>

			<AuditFilters onFilterChange={handleFilterChange} />

			<div className="overflow-x-auto rounded-[var(--radius-lg)] border">
				<table role="table" className="w-full text-left text-[length:var(--text-sm)]">
					<thead className="border-b bg-[var(--workspace-bg-muted)]">
						{table.getHeaderGroups().map((hg) => (
							<tr key={hg.id}>
								{hg.headers.map((header) => (
									<th
										key={header.id}
										className="px-4 py-3 font-medium text-[var(--text-secondary)]"
									>
										{flexRender(header.column.columnDef.header, header.getContext())}
									</th>
								))}
							</tr>
						))}
					</thead>
					<tbody>
						{isLoading && showSkeleton ? (
							<TableSkeleton rows={10} cols={6} />
						) : (
							table.getRowModel().rows.map((row) => (
								<tr
									key={row.id}
									className="border-b last:border-0 hover:bg-[var(--accent-50)] transition-colors duration-[var(--duration-fast)]"
								>
									{row.getVisibleCells().map((cell) => (
										<td key={cell.id} className="px-4 py-3">
											{flexRender(cell.column.columnDef.cell, cell.getContext())}
										</td>
									))}
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>

			{!isLoading && (
				<div className="flex items-center justify-between pt-4 text-[length:var(--text-sm)]">
					<span className="text-[var(--text-muted)]">{data?.total ?? 0} total entries</span>
					<div className="flex gap-2">
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled={page <= 1}
							onClick={() => setPage((p) => p - 1)}
						>
							Previous
						</Button>
						<span className="px-2 py-1">
							Page {page} of {totalPages || 1}
						</span>
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled={page >= totalPages}
							onClick={() => setPage((p) => p + 1)}
						>
							Next
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}
