import { useMemo } from 'react';
import {
	createColumnHelper,
	flexRender,
	getCoreRowModel,
	useReactTable,
} from '@tanstack/react-table';
import { useDiscounts } from '../../hooks/use-revenue';
import type { DiscountEntry } from '@budfin/types';

interface DiscountsTabProps {
	versionId: number;
}

const columnHelper = createColumnHelper<DiscountEntry>();

export function DiscountsTab({ versionId }: DiscountsTabProps) {
	const { data, isLoading } = useDiscounts(versionId);
	const entries = data?.entries ?? [];

	const columns = useMemo(
		() => [
			columnHelper.accessor('tariff', {
				header: 'Tariff',
				cell: (info) => <span className="font-medium">{info.getValue()}</span>,
			}),
			columnHelper.accessor('nationality', {
				header: 'Nationality',
				cell: (info) => {
					const val = info.getValue();
					return val ? (
						<span>{val}</span>
					) : (
						<span className="text-slate-400 italic">All nationalities</span>
					);
				},
			}),
			columnHelper.accessor('discountRate', {
				header: 'Discount Rate',
				cell: (info) => {
					const rate = Number(info.getValue()) * 100;
					return <span className="tabular-nums font-medium">{rate.toFixed(2)}%</span>;
				},
			}),
			columnHelper.display({
				id: 'impact',
				header: 'Impact',
				cell: (info) => {
					const rate = Number(info.row.original.discountRate);
					if (rate === 0) {
						return <span className="text-slate-400">No discount</span>;
					}
					return (
						<span className="inline-block rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
							-{(rate * 100).toFixed(1)}% off tuition
						</span>
					);
				},
			}),
		],
		[]
	);

	const table = useReactTable({
		data: entries,
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-32 text-slate-500">
				Loading discount policies...
			</div>
		);
	}

	if (entries.length === 0) {
		return (
			<div className="flex items-center justify-center h-32 text-slate-500">
				No discount policies configured. Add policies to apply tuition discounts.
			</div>
		);
	}

	return (
		<div className="overflow-x-auto rounded-lg border">
			<table role="grid" className="w-full text-left text-sm" aria-label="Discount policies">
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
	);
}
