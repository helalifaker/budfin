import { useMemo, useState } from 'react';
import {
	createColumnHelper,
	flexRender,
	getCoreRowModel,
	useReactTable,
} from '@tanstack/react-table';
import { useRevenueResults } from '../../hooks/use-revenue';

interface ForecastTabProps {
	versionId: number;
}

const MONTH_NAMES = [
	'Jan',
	'Feb',
	'Mar',
	'Apr',
	'May',
	'Jun',
	'Jul',
	'Aug',
	'Sep',
	'Oct',
	'Nov',
	'Dec',
];

function formatDecimal(value: string): string {
	return Number(value).toLocaleString('fr-FR', {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	});
}

interface SummaryRow {
	key: string;
	grossRevenueHt: string;
	discountAmount: string;
	netRevenueHt: string;
	vatAmount: string;
}

const columnHelper = createColumnHelper<SummaryRow>();

type GroupBy = 'month' | 'grade' | 'nationality' | 'tariff';

const GROUP_LABELS: Record<GroupBy, string> = {
	month: 'Month',
	grade: 'Grade',
	nationality: 'Nationality',
	tariff: 'Tariff',
};

export function ForecastTab({ versionId }: ForecastTabProps) {
	const [groupBy, setGroupBy] = useState<GroupBy>('month');
	const { data, isLoading } = useRevenueResults(versionId, groupBy);

	const summaryRows: SummaryRow[] = useMemo(() => {
		if (!data?.summary) return [];
		return data.summary.map((row) => ({
			key:
				groupBy === 'month'
					? (MONTH_NAMES[Number(row[groupBy]) - 1] ?? row[groupBy] ?? '')
					: (row[groupBy] ?? ''),
			grossRevenueHt: row.grossRevenueHt ?? '0',
			discountAmount: row.discountAmount ?? '0',
			netRevenueHt: row.netRevenueHt ?? '0',
			vatAmount: row.vatAmount ?? '0',
		}));
	}, [data, groupBy]);

	const columns = useMemo(
		() => [
			columnHelper.accessor('key', {
				header: GROUP_LABELS[groupBy],
				cell: (info) => <span className="font-medium">{info.getValue()}</span>,
			}),
			columnHelper.accessor('grossRevenueHt', {
				header: 'Gross Revenue HT',
				cell: (info) => <span className="tabular-nums">{formatDecimal(info.getValue())}</span>,
			}),
			columnHelper.accessor('discountAmount', {
				header: 'Discounts',
				cell: (info) => {
					const val = Number(info.getValue());
					return (
						<span className={`tabular-nums ${val > 0 ? 'text-red-600' : ''}`}>
							{val > 0 ? '-' : ''}
							{formatDecimal(info.getValue())}
						</span>
					);
				},
			}),
			columnHelper.accessor('netRevenueHt', {
				header: 'Net Revenue HT',
				cell: (info) => (
					<span className="tabular-nums font-medium">{formatDecimal(info.getValue())}</span>
				),
			}),
			columnHelper.accessor('vatAmount', {
				header: 'VAT',
				cell: (info) => (
					<span className="tabular-nums text-slate-500">{formatDecimal(info.getValue())}</span>
				),
			}),
		],
		[groupBy]
	);

	const table = useReactTable({
		data: summaryRows,
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-32 text-slate-500">
				Loading forecast results...
			</div>
		);
	}

	if (!data || data.rowCount === 0) {
		return (
			<div className="flex items-center justify-center h-32 text-slate-500">
				No forecast data. Run &ldquo;Calculate Revenue&rdquo; to generate the forecast.
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{/* Summary cards */}
			<div className="grid grid-cols-4 gap-4">
				<div className="rounded-lg border bg-white p-4">
					<div className="text-xs text-slate-500">Gross Revenue HT</div>
					<div className="mt-1 text-lg font-semibold tabular-nums">
						{formatDecimal(data.totals.grossRevenueHt)}
					</div>
				</div>
				<div className="rounded-lg border bg-white p-4">
					<div className="text-xs text-slate-500">Total Discounts</div>
					<div className="mt-1 text-lg font-semibold tabular-nums text-red-600">
						-{formatDecimal(data.totals.discountAmount)}
					</div>
				</div>
				<div className="rounded-lg border bg-white p-4">
					<div className="text-xs text-slate-500">Net Revenue HT</div>
					<div className="mt-1 text-lg font-semibold tabular-nums text-emerald-700">
						{formatDecimal(data.totals.netRevenueHt)}
					</div>
				</div>
				<div className="rounded-lg border bg-white p-4">
					<div className="text-xs text-slate-500">VAT Collected</div>
					<div className="mt-1 text-lg font-semibold tabular-nums">
						{formatDecimal(data.totals.vatAmount)}
					</div>
				</div>
			</div>

			{/* Group by selector */}
			<div className="flex items-center gap-2">
				<span className="text-sm text-slate-600">Group by:</span>
				{(Object.keys(GROUP_LABELS) as GroupBy[]).map((g) => (
					<button
						key={g}
						onClick={() => setGroupBy(g)}
						className={`rounded px-3 py-1 text-sm ${
							groupBy === g
								? 'bg-slate-900 text-white'
								: 'bg-slate-100 text-slate-700 hover:bg-slate-200'
						}`}
					>
						{GROUP_LABELS[g]}
					</button>
				))}
			</div>

			{/* Monthly breakdown table */}
			<div className="overflow-x-auto rounded-lg border">
				<table
					role="grid"
					className="w-full text-left text-sm"
					aria-label="Revenue forecast breakdown"
				>
					<thead className="border-b bg-slate-50">
						{table.getHeaderGroups().map((hg) => (
							<tr key={hg.id}>
								{hg.headers.map((header) => (
									<th key={header.id} className="px-4 py-3 font-medium text-slate-600">
										{flexRender(header.column.columnDef.header, header.getContext())}
									</th>
								))}
							</tr>
						))}
					</thead>
					<tbody>
						{table.getRowModel().rows.map((row) => (
							<tr key={row.id} className="border-b last:border-0 hover:bg-slate-50">
								{row.getVisibleCells().map((cell) => (
									<td key={cell.id} className="px-4 py-2">
										{flexRender(cell.column.columnDef.cell, cell.getContext())}
									</td>
								))}
							</tr>
						))}
						{/* Totals row */}
						<tr className="border-t-2 bg-slate-100 font-semibold">
							<td className="px-4 py-2">Total</td>
							<td className="px-4 py-2 tabular-nums">
								{formatDecimal(data.totals.grossRevenueHt)}
							</td>
							<td className="px-4 py-2 tabular-nums text-red-600">
								-{formatDecimal(data.totals.discountAmount)}
							</td>
							<td className="px-4 py-2 tabular-nums">{formatDecimal(data.totals.netRevenueHt)}</td>
							<td className="px-4 py-2 tabular-nums">{formatDecimal(data.totals.vatAmount)}</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	);
}
