import { useMemo } from 'react';
import {
	createColumnHelper,
	flexRender,
	getCoreRowModel,
	useReactTable,
} from '@tanstack/react-table';
import { AlertTriangle, CheckCircle, MinusCircle, PlusCircle } from 'lucide-react';
import { cn } from '../../lib/cn';
import { BAND_STYLES } from '../../lib/band-styles';
import { formatMoney } from '../../lib/format-money';
import type { DisciplineSummaryRow } from '../../lib/staffing-workspace';

// ── Scope badge ──────────────────────────────────────────────────────────────

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

// ── Coverage badge ───────────────────────────────────────────────────────────

interface CoverageBadgeConfig {
	label: string;
	Icon: typeof AlertTriangle;
	className: string;
}

function getCoverageBadgeConfig(status: string): CoverageBadgeConfig {
	switch (status) {
		case 'DEFICIT':
			return { label: '! Deficit', Icon: AlertTriangle, className: 'bg-red-600 text-white' };
		case 'COVERED':
			return { label: '\u2713 Covered', Icon: CheckCircle, className: 'bg-green-600 text-white' };
		case 'SURPLUS':
			return {
				label: '+ Surplus',
				Icon: PlusCircle,
				className: 'bg-amber-200 text-(--text-primary)',
			};
		case 'UNCOVERED':
			return {
				label: '\u2014 None',
				Icon: MinusCircle,
				className: 'bg-(--workspace-bg-muted) text-(--text-muted)',
			};
		default:
			return {
				label: status,
				Icon: MinusCircle,
				className: 'bg-(--workspace-bg-muted) text-(--text-muted)',
			};
	}
}

function CoverageBadge({ status }: { status: string }) {
	const config = getCoverageBadgeConfig(status);
	return (
		<span
			className={cn(
				'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
				config.className
			)}
			aria-label={`Coverage: ${status}`}
		>
			<config.Icon className="h-3 w-3" aria-hidden="true" />
			{config.label}
		</span>
	);
}

// ── Gap cell ─────────────────────────────────────────────────────────────────

function getGapTintClass(gap: string): string {
	const num = parseFloat(gap);
	if (num < 0) return 'bg-red-50';
	if (num > 0) return 'bg-amber-50';
	return 'bg-green-50';
}

// ── Props ────────────────────────────────────────────────────────────────────

export type DisciplineSummaryGridProps = {
	rows: DisciplineSummaryRow[];
	onRowSelect: (row: DisciplineSummaryRow) => void;
	selectedKey: string | null;
};

// ── Column definitions ───────────────────────────────────────────────────────

const columnHelper = createColumnHelper<DisciplineSummaryRow>();

// ── Component ────────────────────────────────────────────────────────────────

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
					<span className="font-[family-name:var(--font-mono)] tabular-nums">
						{parseFloat(getValue()).toFixed(2)}
					</span>
				),
			}),
			columnHelper.accessor('fteNeeded', {
				header: 'FTE Needed',
				size: 90,
				cell: ({ getValue }) => (
					<span className="font-bold font-[family-name:var(--font-mono)] tabular-nums">
						{parseFloat(getValue()).toFixed(2)}
					</span>
				),
			}),
			columnHelper.accessor('postes', {
				header: 'Postes',
				size: 70,
				cell: ({ getValue }) => (
					<span className="font-[family-name:var(--font-mono)] tabular-nums text-(--text-muted)">
						{getValue()}
					</span>
				),
			}),
			columnHelper.accessor('hsaHours', {
				header: 'HSA Hrs',
				size: 80,
				cell: ({ getValue }) => (
					<span className="font-[family-name:var(--font-mono)] tabular-nums text-(--text-muted)">
						{parseFloat(getValue()).toFixed(2)}
					</span>
				),
			}),
			columnHelper.accessor('coveredFte', {
				header: 'Covered FTE',
				size: 100,
				cell: ({ getValue }) => (
					<span className="font-[family-name:var(--font-mono)] tabular-nums">
						{parseFloat(getValue()).toFixed(2)}
					</span>
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
								'inline-block w-full rounded px-1 font-[family-name:var(--font-mono)] tabular-nums',
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
					<span className="font-[family-name:var(--font-mono)] tabular-nums">
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
		<div className={cn('overflow-x-auto rounded-md', 'border border-(--workspace-border)')}>
			<table
				className="w-full border-collapse text-sm"
				role="grid"
				aria-label="Discipline coverage summary"
			>
				<thead>
					<tr className="bg-(--workspace-bg-subtle)">
						{table.getHeaderGroups()[0]?.headers.map((header) => (
							<th
								key={header.id}
								className={cn(
									'px-3 py-2 text-left font-medium text-(--text-muted)',
									'text-(length:--text-xs) uppercase tracking-wider',
									'border-b border-(--workspace-border)'
								)}
								style={{ width: header.getSize() }}
							>
								{flexRender(header.column.columnDef.header, header.getContext())}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.length === 0 ? (
						<tr>
							<td colSpan={columns.length} className="px-3 py-8 text-center text-(--text-muted)">
								No disciplines match the current filters.
							</td>
						</tr>
					) : (
						table.getRowModel().rows.map((row) => (
							<tr
								key={row.original.key}
								className={cn(
									'cursor-pointer transition-colors',
									'hover:bg-(--workspace-bg-subtle)',
									row.original.key === selectedKey && 'bg-(--accent-50) hover:bg-(--accent-50)'
								)}
								role="row"
								tabIndex={0}
								aria-selected={row.original.key === selectedKey}
								onClick={() => onRowSelect(row.original)}
								onKeyDown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault();
										onRowSelect(row.original);
									}
								}}
							>
								{row.getVisibleCells().map((cell) => (
									<td key={cell.id} className="border-b border-(--workspace-border) px-3 py-2">
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
