import { useMemo, useState } from 'react';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { useRevenueResults } from '../../hooks/use-revenue';
import { formatMoney } from '../../lib/format-money';
import { DataGrid } from '../data-grid/data-grid';
import { Button } from '../ui/button';
import { RevenueMatrixTable } from './revenue-matrix-table';

interface ForecastTabProps {
	versionId: number;
}

type GroupBy = 'month' | 'grade' | 'nationality' | 'tariff';

interface SummaryRow {
	key: string;
	grossRevenueHt: string;
	discountAmount: string;
	netRevenueHt: string;
	vatAmount: string;
}

const columnHelper = createColumnHelper<SummaryRow>();

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
const GROUP_LABELS: Record<GroupBy, string> = {
	month: 'Month',
	grade: 'Grade',
	nationality: 'Nationality',
	tariff: 'Tariff',
};

function formatAmount(value: string) {
	return formatMoney(value);
}

export function ForecastTab({ versionId }: ForecastTabProps) {
	const [groupBy, setGroupBy] = useState<GroupBy>('month');
	const { data, isLoading } = useRevenueResults(versionId, groupBy);

	const summaryRows = useMemo(() => {
		if (!data?.summary) {
			return [];
		}

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
	}, [data?.summary, groupBy]);

	const columns = useMemo(
		() => [
			columnHelper.accessor('key', {
				header: GROUP_LABELS[groupBy],
				cell: (info) => <span className="font-medium">{info.getValue()}</span>,
			}),
			columnHelper.accessor('grossRevenueHt', {
				header: 'Tuition Fees',
				cell: (info) => <span className="tabular-nums">{formatAmount(info.getValue())}</span>,
			}),
			columnHelper.accessor('discountAmount', {
				header: 'Discount Impact',
				cell: (info) => (
					<span className="tabular-nums text-(--color-error)">
						-{formatAmount(info.getValue())}
					</span>
				),
			}),
			columnHelper.accessor('netRevenueHt', {
				header: 'Net Tuition',
				cell: (info) => (
					<span className="tabular-nums font-medium text-(--text-primary)">
						{formatAmount(info.getValue())}
					</span>
				),
			}),
			columnHelper.accessor('vatAmount', {
				header: 'VAT',
				cell: (info) => (
					<span className="tabular-nums text-(--text-muted)">{formatAmount(info.getValue())}</span>
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
			<div className="flex h-32 items-center justify-center text-sm text-(--text-muted)">
				Loading executive summary...
			</div>
		);
	}

	const composition = data?.executiveSummary.composition ?? [];

	return (
		<div className="space-y-6">
			<div className="grid gap-4 md:grid-cols-4">
				<div className="rounded-lg border border-(--workspace-border) bg-white p-4">
					<div className="text-xs uppercase tracking-wide text-(--text-muted)">Tuition Fees</div>
					<div className="mt-2 text-lg font-semibold tabular-nums">
						{formatAmount(data?.totals.grossRevenueHt ?? '0')}
					</div>
				</div>
				<div className="rounded-lg border border-(--workspace-border) bg-white p-4">
					<div className="text-xs uppercase tracking-wide text-(--text-muted)">Discount Impact</div>
					<div className="mt-2 text-lg font-semibold tabular-nums text-(--color-error)">
						-{formatAmount(data?.totals.discountAmount ?? '0')}
					</div>
				</div>
				<div className="rounded-lg border border-(--workspace-border) bg-white p-4">
					<div className="text-xs uppercase tracking-wide text-(--text-muted)">Net Tuition</div>
					<div className="mt-2 text-lg font-semibold tabular-nums text-(--text-primary)">
						{formatAmount(data?.totals.netRevenueHt ?? '0')}
					</div>
				</div>
				<div className="rounded-lg border border-(--workspace-border) bg-white p-4">
					<div className="text-xs uppercase tracking-wide text-(--text-muted)">
						Total Operating Revenue
					</div>
					<div className="mt-2 text-lg font-semibold tabular-nums text-(--color-success)">
						{formatAmount(data?.totals.totalOperatingRevenue ?? '0')}
					</div>
				</div>
			</div>

			<div className="rounded-lg border border-(--workspace-border) bg-(--workspace-bg-subtle) px-4 py-3 text-sm">
				<div className="font-medium text-(--text-primary)">Executive Summary Sheet</div>
				<div className="text-(--text-muted)">
					The monthly matrix below mirrors the workbook&apos;s executive summary, while the lower
					table keeps the detailed tuition drill-down by grouping.
				</div>
			</div>

			<RevenueMatrixTable
				rows={data?.executiveSummary.rows ?? []}
				ariaLabel="Executive summary matrix"
			/>

			<div className="grid gap-3 md:grid-cols-4">
				{composition.map((item) => (
					<div
						key={item.label}
						className="rounded-lg border border-(--workspace-border) bg-white px-4 py-3"
					>
						<div className="text-xs uppercase tracking-wide text-(--text-muted)">{item.label}</div>
						<div className="mt-2 text-base font-semibold tabular-nums">
							{formatAmount(item.amount)}
						</div>
						<div className="text-xs text-(--text-muted)">
							{(Number(item.percentageOfRevenue) * 100).toFixed(2)}% of revenue
						</div>
					</div>
				))}
			</div>

			<div className="space-y-3">
				<div className="flex items-center gap-2">
					<span className="text-sm text-(--text-secondary)">Drill down by:</span>
					{(Object.keys(GROUP_LABELS) as GroupBy[]).map((option) => (
						<Button
							key={option}
							variant={groupBy === option ? 'primary' : 'ghost'}
							size="sm"
							onClick={() => setGroupBy(option)}
						>
							{GROUP_LABELS[option]}
						</Button>
					))}
				</div>

				<DataGrid
					table={table}
					isLoading={isLoading}
					emptyState={
						<p className="text-sm text-(--text-muted)">
							Run the revenue calculation to generate tuition detail rows.
						</p>
					}
				/>
			</div>
		</div>
	);
}
