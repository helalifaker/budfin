import { useMemo } from 'react';
import {
	createColumnHelper,
	flexRender,
	getCoreRowModel,
	useReactTable,
} from '@tanstack/react-table';
import { useOtherRevenue } from '../../hooks/use-revenue';
import type { OtherRevenueItem } from '@budfin/types';

interface OtherRevenueTabProps {
	versionId: number;
}

function formatDecimal(value: string): string {
	return Number(value).toLocaleString('fr-FR', {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	});
}

const DISTRIBUTION_LABELS: Record<string, string> = {
	ACADEMIC_10: 'Academic (10 months)',
	YEAR_ROUND_12: 'Year-round (12 months)',
	CUSTOM_WEIGHTS: 'Custom weights',
	SPECIFIC_PERIOD: 'Specific period',
};

const columnHelper = createColumnHelper<OtherRevenueItem>();

export function OtherRevenueTab({ versionId }: OtherRevenueTabProps) {
	const { data, isLoading } = useOtherRevenue(versionId);
	const items = data?.items ?? [];

	const columns = useMemo(
		() => [
			columnHelper.accessor('lineItemName', {
				header: 'Line Item',
				cell: (info) => <span className="font-medium">{info.getValue()}</span>,
			}),
			columnHelper.accessor('annualAmount', {
				header: 'Annual Amount',
				cell: (info) => <span className="tabular-nums">{formatDecimal(info.getValue())}</span>,
			}),
			columnHelper.accessor('distributionMethod', {
				header: 'Distribution',
				cell: (info) => (
					<span className="inline-block rounded bg-slate-100 px-2 py-0.5 text-xs">
						{DISTRIBUTION_LABELS[info.getValue()] ?? info.getValue()}
					</span>
				),
			}),
			columnHelper.accessor('ifrsCategory', {
				header: 'IFRS Category',
				cell: (info) => (
					<span className="text-xs text-slate-600">{info.getValue().replace(/_/g, ' ')}</span>
				),
			}),
			columnHelper.display({
				id: 'monthlyEstimate',
				header: 'Monthly Est.',
				cell: (info) => {
					const item = info.row.original;
					const annual = Number(item.annualAmount);
					let monthly: number;
					if (item.distributionMethod === 'YEAR_ROUND_12') {
						monthly = annual / 12;
					} else if (item.distributionMethod === 'ACADEMIC_10') {
						monthly = annual / 10;
					} else {
						monthly = annual / 12;
					}
					return (
						<span className="tabular-nums text-slate-500">
							~{formatDecimal(String(monthly.toFixed(4)))}
						</span>
					);
				},
			}),
		],
		[]
	);

	const table = useReactTable({
		data: items,
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-32 text-slate-500">
				Loading other revenue items...
			</div>
		);
	}

	if (items.length === 0) {
		return (
			<div className="flex items-center justify-center h-32 text-slate-500">
				No other revenue items. Add non-tuition revenue sources.
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div className="overflow-x-auto rounded-lg border">
				<table role="grid" className="w-full text-left text-sm" aria-label="Other revenue items">
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
					</tbody>
				</table>
			</div>

			{/* Total summary */}
			<div className="flex justify-end">
				<div className="rounded-lg border bg-slate-50 px-4 py-2 text-sm">
					<span className="text-slate-600">Total Annual: </span>
					<span className="font-semibold tabular-nums">
						{formatDecimal(
							String(items.reduce((sum, i) => sum + Number(i.annualAmount), 0).toFixed(4))
						)}
					</span>
				</div>
			</div>
		</div>
	);
}
