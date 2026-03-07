import { useMemo } from 'react';
import {
	createColumnHelper,
	flexRender,
	getCoreRowModel,
	useReactTable,
} from '@tanstack/react-table';
import { useFeeGrid } from '../../hooks/use-revenue';
import type { FeeGridEntry } from '@budfin/types';

interface FeeGridTabProps {
	versionId: number;
}

function formatDecimal(value: string): string {
	return Number(value).toLocaleString('fr-FR', {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	});
}

const columnHelper = createColumnHelper<FeeGridEntry>();

export function FeeGridTab({ versionId }: FeeGridTabProps) {
	const { data, isLoading } = useFeeGrid(versionId);
	const entries = data?.entries ?? [];

	const columns = useMemo(
		() => [
			columnHelper.accessor('academicPeriod', {
				header: 'Period',
				cell: (info) => (
					<span className="inline-block rounded bg-[var(--workspace-bg-muted)] px-2 py-0.5 text-xs font-medium">
						{info.getValue()}
					</span>
				),
			}),
			columnHelper.accessor('gradeLevel', {
				header: 'Grade',
				cell: (info) => <span className="font-medium">{info.getValue()}</span>,
			}),
			columnHelper.accessor('nationality', {
				header: 'Nationality',
			}),
			columnHelper.accessor('tariff', {
				header: 'Tariff',
			}),
			columnHelper.accessor('dai', {
				header: 'DAI',
				cell: (info) => <span className="tabular-nums">{formatDecimal(info.getValue())}</span>,
			}),
			columnHelper.accessor('tuitionTtc', {
				header: 'Tuition TTC',
				cell: (info) => <span className="tabular-nums">{formatDecimal(info.getValue())}</span>,
			}),
			columnHelper.accessor('tuitionHt', {
				header: 'Tuition HT',
				cell: (info) => <span className="tabular-nums">{formatDecimal(info.getValue())}</span>,
			}),
			columnHelper.accessor('term1Amount', {
				header: 'Term 1',
				cell: (info) => <span className="tabular-nums">{formatDecimal(info.getValue())}</span>,
			}),
			columnHelper.accessor('term2Amount', {
				header: 'Term 2',
				cell: (info) => <span className="tabular-nums">{formatDecimal(info.getValue())}</span>,
			}),
			columnHelper.accessor('term3Amount', {
				header: 'Term 3',
				cell: (info) => <span className="tabular-nums">{formatDecimal(info.getValue())}</span>,
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
			<div className="flex items-center justify-center h-32 text-[var(--text-muted)]">
				Loading fee grid...
			</div>
		);
	}

	if (entries.length === 0) {
		return (
			<div className="flex items-center justify-center h-32 text-[var(--text-muted)]">
				No fee grid data. Add fee entries to begin revenue planning.
			</div>
		);
	}

	return (
		<div className="overflow-x-auto rounded-lg border">
			<table role="grid" className="w-full text-left text-sm" aria-label="Fee grid">
				<thead className="border-b bg-[var(--workspace-bg-subtle)]">
					{table.getHeaderGroups().map((hg) => (
						<tr key={hg.id}>
							{hg.headers.map((header) => (
								<th key={header.id} className="px-4 py-3 font-medium text-[var(--text-secondary)]">
									{flexRender(header.column.columnDef.header, header.getContext())}
								</th>
							))}
						</tr>
					))}
				</thead>
				<tbody>
					{table.getRowModel().rows.map((row) => (
						<tr
							key={row.id}
							className="border-b last:border-0 hover:bg-[var(--workspace-bg-subtle)]"
						>
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
