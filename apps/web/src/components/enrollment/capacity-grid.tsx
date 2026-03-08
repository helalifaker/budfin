import { useMemo } from 'react';
import {
	createColumnHelper,
	flexRender,
	getCoreRowModel,
	useReactTable,
} from '@tanstack/react-table';
import { cn } from '../../lib/cn';
import { useGradeLevels } from '../../hooks/use-grade-levels';
import { AlertBadge, UtilizationCell } from './capacity-columns';
import { TableSkeleton } from '../ui/skeleton';
import type { CapacityResult, CapacityAlert } from '@budfin/types';

export type CapacityGridProps = {
	versionId: number;
	bandFilter: string;
	capacityResults?: CapacityResult[] | undefined;
};

const BAND_LABELS: Record<string, string> = {
	MATERNELLE: 'Maternelle',
	ELEMENTAIRE: 'Elementaire',
	COLLEGE: 'College',
	LYCEE: 'Lycee',
};

interface CapRow {
	gradeLevel: string;
	gradeName: string;
	band: string;
	displayOrder: number;
	ay2Total: number;
	maxClassSize: number;
	sectionsNeeded: number;
	utilization: number;
	alert: CapacityAlert | null;
}

const columnHelper = createColumnHelper<CapRow>();

export function CapacityGrid({
	versionId: _versionId,
	bandFilter,
	capacityResults,
}: CapacityGridProps) {
	const { data: gradeLevelData, isLoading: gradesLoading } = useGradeLevels();
	const gradeLevels = useMemo(
		() => gradeLevelData?.gradeLevels ?? [],
		[gradeLevelData?.gradeLevels]
	);
	const hasResults = capacityResults && capacityResults.length > 0;

	const rows: CapRow[] = useMemo(() => {
		const capMap = new Map<string, CapacityResult>();
		if (capacityResults) {
			for (const r of capacityResults) {
				if (r.academicPeriod === 'AY2') {
					capMap.set(r.gradeLevel, r);
				}
			}
		}

		const filtered =
			bandFilter === 'ALL' ? gradeLevels : gradeLevels.filter((gl) => gl.band === bandFilter);

		return filtered
			.sort((a, b) => a.displayOrder - b.displayOrder)
			.map((gl) => {
				const cap = capMap.get(gl.gradeCode);
				return {
					gradeLevel: gl.gradeCode,
					gradeName: gl.gradeName,
					band: gl.band,
					displayOrder: gl.displayOrder,
					ay2Total: cap?.headcount ?? 0,
					maxClassSize: cap?.maxClassSize ?? gl.maxClassSize,
					sectionsNeeded: cap?.sectionsNeeded ?? 0,
					utilization: cap?.utilization ?? 0,
					alert: cap?.alert ?? null,
				};
			});
	}, [capacityResults, gradeLevels, bandFilter]);

	const bands = useMemo(() => {
		const bandMap = new Map<string, CapRow[]>();
		for (const row of rows) {
			const existing = bandMap.get(row.band) ?? [];
			existing.push(row);
			bandMap.set(row.band, existing);
		}
		return bandMap;
	}, [rows]);

	const columns = useMemo(
		() => [
			columnHelper.accessor('gradeName', {
				header: 'Grade',
				cell: (info) => (
					<span className="font-medium text-[var(--text-primary)]">{info.getValue()}</span>
				),
			}),
			columnHelper.accessor('ay2Total', {
				header: 'AY2 Tot',
				cell: (info) => <span className="tabular-nums">{info.getValue() || '-'}</span>,
			}),
			columnHelper.accessor('maxClassSize', {
				header: 'Max Size',
				cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
			}),
			columnHelper.accessor('sectionsNeeded', {
				header: 'Sections',
				cell: (info) => {
					const val = info.getValue();
					return val > 0 ? (
						<span className="tabular-nums">{val}</span>
					) : (
						<span className="text-[var(--text-muted)]">-</span>
					);
				},
			}),
			columnHelper.accessor('utilization', {
				header: 'Util %',
				cell: (info) => <UtilizationCell value={info.getValue()} />,
			}),
			columnHelper.accessor('alert', {
				header: 'Alert',
				cell: (info) => <AlertBadge alert={info.getValue()} />,
			}),
		],
		[]
	);

	const table = useReactTable({
		data: rows,
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	return (
		<div className="overflow-x-auto rounded-[var(--radius-lg)] border">
			<table
				role="grid"
				className="w-full text-left text-[length:var(--text-sm)]"
				aria-label="Capacity planning"
			>
				<thead className="border-b bg-[var(--workspace-bg-muted)]">
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
					{gradesLoading ? (
						<TableSkeleton rows={15} cols={columns.length} />
					) : !hasResults ? (
						<tr>
							<td
								colSpan={columns.length}
								className="px-4 py-6 text-center text-[var(--text-muted)]"
							>
								Press Calculate to generate capacity results.
							</td>
						</tr>
					) : (
						[...bands.entries()].map(([band, bandRows]) => (
							<CapBandGroup
								key={band}
								band={band}
								bandRows={bandRows}
								table={table}
								colCount={columns.length}
							/>
						))
					)}
				</tbody>
			</table>
		</div>
	);
}

function CapBandGroup({
	band,
	bandRows,
	table,
	colCount,
}: {
	band: string;
	bandRows: CapRow[];
	table: ReturnType<typeof useReactTable<CapRow>>;
	colCount: number;
}) {
	return (
		<>
			<tr className="bg-[var(--workspace-bg-muted)]/50">
				<td
					colSpan={colCount}
					className="px-4 py-1.5 text-[length:var(--text-xs)] font-semibold uppercase tracking-wider text-[var(--text-muted)]"
				>
					{BAND_LABELS[band] ?? band} ({bandRows.length} grades)
				</td>
			</tr>
			{bandRows.map((row) => {
				const tableRow = table
					.getRowModel()
					.rows.find((r) => r.original.gradeLevel === row.gradeLevel);
				if (!tableRow) return null;
				return (
					<tr
						key={tableRow.id}
						className={cn(
							'border-b transition-colors duration-[var(--duration-fast)] last:border-0',
							'hover:bg-[var(--accent-50)]'
						)}
					>
						{tableRow.getVisibleCells().map((cell) => (
							<td key={cell.id} className="px-4 py-2">
								{flexRender(cell.column.columnDef.cell, cell.getContext())}
							</td>
						))}
					</tr>
				);
			})}
		</>
	);
}
