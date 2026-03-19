import { useMemo } from 'react';
import {
	createColumnHelper,
	getCoreRowModel,
	useReactTable,
	flexRender,
} from '@tanstack/react-table';
import type { ColumnDef } from '@tanstack/react-table';
import type { TeachingRequirementsResponse } from '../../hooks/use-staffing';
import { buildDisciplineDemandRows, type DisciplineDemandRow } from '../../lib/staffing-workspace';
import { BAND_STYLES } from '../../lib/band-styles';
import { cn } from '../../lib/cn';

export type DisciplineDemandGridProps = {
	data: TeachingRequirementsResponse;
};

const SCOPE_TO_BAND: Record<string, string> = {
	Mat: 'MATERNELLE',
	Elem: 'ELEMENTAIRE',
	'Col+Lyc': 'COLLEGE',
};

function ScopeBadge({ scope }: { scope: string }) {
	const band = SCOPE_TO_BAND[scope];
	const style = band ? BAND_STYLES[band] : undefined;
	return (
		<span
			className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
			style={style ? { color: style.color, backgroundColor: style.bg } : undefined}
		>
			{scope}
		</span>
	);
}

const columnHelper = createColumnHelper<DisciplineDemandRow>();

export function DisciplineDemandGrid({ data }: DisciplineDemandGridProps) {
	const rows = useMemo(() => buildDisciplineDemandRows(data.lines), [data.lines]);

	const columns = useMemo<ColumnDef<DisciplineDemandRow, unknown>[]>(
		() => [
			columnHelper.accessor('disciplineCode', {
				id: 'disciplineCode',
				header: 'Discipline',
				size: 160,
				cell: ({ getValue }) => (
					<span className="font-medium text-(--text-primary)">{String(getValue())}</span>
				),
			}) as ColumnDef<DisciplineDemandRow, unknown>,
			columnHelper.accessor('scope', {
				id: 'scope',
				header: 'Scope',
				size: 90,
				cell: ({ getValue }) => <ScopeBadge scope={String(getValue())} />,
			}) as ColumnDef<DisciplineDemandRow, unknown>,
			columnHelper.accessor('colHoursPerWeek', {
				id: 'colHoursPerWeek',
				header: 'Col h/wk',
				size: 80,
				cell: ({ getValue }) => (
					<span className="font-[family-name:var(--font-mono)] tabular-nums">
						{String(getValue())}
					</span>
				),
			}) as ColumnDef<DisciplineDemandRow, unknown>,
			columnHelper.accessor('lycHoursPerWeek', {
				id: 'lycHoursPerWeek',
				header: 'Lyc h/wk',
				size: 80,
				cell: ({ getValue }) => (
					<span className="font-[family-name:var(--font-mono)] tabular-nums">
						{String(getValue())}
					</span>
				),
			}) as ColumnDef<DisciplineDemandRow, unknown>,
			columnHelper.accessor('totalHoursPerWeek', {
				id: 'totalHoursPerWeek',
				header: 'Total h/wk',
				size: 90,
				cell: ({ getValue }) => (
					<span className="font-bold font-[family-name:var(--font-mono)] tabular-nums">
						{String(getValue())}
					</span>
				),
			}) as ColumnDef<DisciplineDemandRow, unknown>,
			columnHelper.accessor('effectiveOrs', {
				id: 'effectiveOrs',
				header: () => <span title="Obligation Reglementaire de Service">ORS</span>,
				size: 60,
				cell: ({ getValue }) => (
					<span className="font-[family-name:var(--font-mono)] tabular-nums text-(--text-muted)">
						{String(getValue())}
					</span>
				),
			}) as ColumnDef<DisciplineDemandRow, unknown>,
			columnHelper.accessor('fteRaw', {
				id: 'fteRaw',
				header: () => <span title="FTE = total hours / ORS">FTE Raw</span>,
				size: 75,
				cell: ({ getValue }) => (
					<span className="font-bold font-[family-name:var(--font-mono)] tabular-nums">
						{String(getValue())}
					</span>
				),
			}) as ColumnDef<DisciplineDemandRow, unknown>,
			columnHelper.accessor('postes', {
				id: 'postes',
				header: () => <span title="Positions = ceil(FTE Raw)">Postes</span>,
				size: 70,
				cell: ({ getValue }) => (
					<span className="font-[family-name:var(--font-mono)] tabular-nums">
						{String(getValue())}
					</span>
				),
			}) as ColumnDef<DisciplineDemandRow, unknown>,
			columnHelper.accessor('hsaHours', {
				id: 'hsaHours',
				header: () => <span title="Heures Supplementaires d'Annualisation">HSA Hrs</span>,
				size: 75,
				cell: ({ getValue }) => (
					<span className="font-[family-name:var(--font-mono)] tabular-nums text-(--text-muted)">
						{String(getValue())}
					</span>
				),
			}) as ColumnDef<DisciplineDemandRow, unknown>,
		],
		[]
	);

	const table = useReactTable({
		data: rows,
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	const NUMERIC_COLS = new Set([
		'colHoursPerWeek',
		'lycHoursPerWeek',
		'totalHoursPerWeek',
		'effectiveOrs',
		'fteRaw',
		'postes',
		'hsaHours',
	]);

	return (
		<div className={cn('overflow-x-auto rounded-md', 'border border-(--workspace-border)')}>
			<table
				className="w-full border-collapse text-sm"
				role="table"
				aria-label="Discipline demand grid"
			>
				<thead>
					<tr className="bg-(--workspace-bg-subtle)">
						{table.getHeaderGroups().map((group) =>
							group.headers.map((header) => (
								<th
									key={header.id}
									style={{ width: header.getSize() }}
									className={cn(
										'px-3 py-2 font-medium text-(--text-muted)',
										'text-xs uppercase tracking-wider',
										'border-b border-(--workspace-border)',
										NUMERIC_COLS.has(header.id) ? 'text-right' : 'text-left'
									)}
								>
									{flexRender(header.column.columnDef.header, header.getContext())}
								</th>
							))
						)}
					</tr>
				</thead>
				<tbody>
					{rows.length === 0 ? (
						<tr>
							<td colSpan={columns.length} className="px-3 py-8 text-center text-(--text-muted)">
								No discipline demand data available.
							</td>
						</tr>
					) : (
						table.getRowModel().rows.map((row) => (
							<tr key={row.id} className="hover:bg-(--workspace-bg-subtle) transition-colors">
								{row.getVisibleCells().map((cell) => (
									<td
										key={cell.id}
										style={{ width: cell.column.getSize() }}
										className={cn(
											'px-3 py-2 border-b border-(--workspace-border)',
											NUMERIC_COLS.has(cell.column.id) ? 'text-right' : 'text-left'
										)}
									>
										{flexRender(cell.column.columnDef.cell, cell.getContext())}
									</td>
								))}
							</tr>
						))
					)}
				</tbody>
			</table>
		</div>
	);
}
