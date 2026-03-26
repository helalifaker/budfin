import { useMemo } from 'react';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { cn } from '../../lib/cn';
import { BAND_STYLES } from '../../lib/band-styles';
import { formatMoney } from '../../lib/format-money';
import type { DisciplineSummaryRow } from '../../lib/staffing-workspace';
import { CoverageBadge, getGapTintClass } from './coverage-badges';
import { PlanningGrid } from '../data-grid/planning-grid';

// -- Scope badge ──────────────────────────────────────────────────────────────

const SCOPE_TO_BAND: Record<string, string> = {
	Mat: 'MATERNELLE',
	Elem: 'ELEMENTAIRE',
	'Col+Lyc': 'COLLEGE',
};

function ScopeBadge({ scope }: { scope: string }) {
	const band = SCOPE_TO_BAND[scope];
	const style = band ? BAND_STYLES[band] : null;
	return (
		<span
			className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
			style={
				style
					? { color: style.color, backgroundColor: style.bg }
					: { color: 'var(--text-muted)', backgroundColor: 'var(--workspace-bg-muted)' }
			}
		>
			{scope}
		</span>
	);
}

// -- Props ────────────────────────────────────────────────────────────────────

export type DisciplineSummaryGridProps = {
	rows: DisciplineSummaryRow[];
	onRowSelect: (row: DisciplineSummaryRow) => void;
	selectedKey: string | null;
};

// -- Column definitions ───────────────────────────────────────────────────────

const columnHelper = createColumnHelper<DisciplineSummaryRow>();

// -- Component ────────────────────────────────────────────────────────────────

export function DisciplineSummaryGrid({
	rows,
	onRowSelect,
	selectedKey,
}: DisciplineSummaryGridProps) {
	const columns = useMemo(
		() => [
			columnHelper.accessor('disciplineCode', {
				header: 'Discipline',
				size: 160,
				cell: ({ getValue }) => (
					<span className="font-medium text-(--text-primary)">{getValue()}</span>
				),
			}),
			columnHelper.accessor('scope', {
				header: 'Scope',
				size: 90,
				cell: ({ getValue }) => <ScopeBadge scope={getValue()} />,
			}),
			columnHelper.accessor('totalHoursPerWeek', {
				header: 'Total h/wk',
				size: 90,
				cell: ({ getValue }) => (
					<span className="font-mono tabular-nums">{parseFloat(getValue()).toFixed(2)}</span>
				),
			}),
			columnHelper.accessor('fteNeeded', {
				header: 'FTE Needed',
				size: 90,
				cell: ({ getValue }) => (
					<span className="font-bold font-mono tabular-nums">
						{parseFloat(getValue()).toFixed(2)}
					</span>
				),
			}),
			columnHelper.accessor('postes', {
				header: 'Postes',
				size: 70,
				cell: ({ getValue }) => (
					<span className="font-mono tabular-nums text-(--text-muted)">{getValue()}</span>
				),
			}),
			columnHelper.accessor('hsaHours', {
				header: 'HSA Hrs',
				size: 80,
				cell: ({ getValue }) => (
					<span className="font-mono tabular-nums text-(--text-muted)">
						{parseFloat(getValue()).toFixed(2)}
					</span>
				),
			}),
			columnHelper.accessor('coveredFte', {
				header: 'Covered FTE',
				size: 100,
				cell: ({ getValue }) => (
					<span className="font-mono tabular-nums">{parseFloat(getValue()).toFixed(2)}</span>
				),
			}),
			columnHelper.accessor('gap', {
				header: 'Gap',
				size: 80,
				cell: ({ getValue }) => {
					const value = getValue();
					const num = parseFloat(value);
					return (
						<span
							className={cn(
								'inline-block w-full rounded px-1 font-mono tabular-nums',
								getGapTintClass(value),
								num < 0 && 'text-(--delta-negative)',
								num > 0 && 'text-(--delta-positive)',
								num === 0 && 'text-(--delta-zero)'
							)}
							aria-label={`Gap: ${value} FTE`}
						>
							{num > 0 ? `+${num.toFixed(2)}` : num.toFixed(2)}
						</span>
					);
				},
			}),
			columnHelper.accessor('coverageStatus', {
				header: 'Status',
				size: 110,
				cell: ({ getValue }) => <CoverageBadge status={getValue()} />,
			}),
			columnHelper.accessor('estimatedCost', {
				header: 'Est. Cost',
				size: 110,
				cell: ({ getValue }) => (
					<span className="font-mono tabular-nums">
						{formatMoney(getValue(), { compact: true, showCurrency: true })}
					</span>
				),
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
		<PlanningGrid
			table={table}
			ariaLabel="Discipline coverage summary"
			rangeSelection
			clipboardEnabled
			pinnedColumns={['disciplineCode']}
			numericColumns={[
				'totalHoursPerWeek',
				'fteNeeded',
				'postes',
				'hsaHours',
				'coveredFte',
				'gap',
				'estimatedCost',
			]}
			onRowSelect={onRowSelect}
			selectedRowPredicate={(row) => row.key === selectedKey}
		/>
	);
}
