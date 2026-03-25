import { useMemo, useState } from 'react';
import Decimal from 'decimal.js';
import {
	useReactTable,
	getCoreRowModel,
	getExpandedRowModel,
	flexRender,
	type ColumnDef,
	type Row,
} from '@tanstack/react-table';
import { useWorkspaceContext } from '../../hooks/use-workspace-context';
import { usePnlResults, usePnlKpis, useCalculatePnl } from '../../hooks/use-pnl';
import { useVersions } from '../../hooks/use-versions';
import { useAuthStore } from '../../stores/auth-store';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { useNavigate } from 'react-router';
import { cn } from '../../lib/cn';
import { formatMoney } from '../../lib/format-money';
import { PageTransition } from '../shared/page-transition';
import type { PnlFormat, PnlLineItem, PnlKpis } from '@budfin/types';

// ── Month Labels ────────────────────────────────────────────────────────────

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ── Format Money for P&L ────────────────────────────────────────────────────

function formatPnlAmount(value: string): string {
	const d = new Decimal(value);
	if (d.isZero()) return '--';
	const formatted = formatMoney(d.abs());
	return d.isNeg() ? `(${formatted})` : formatted;
}

function formatPnlPercent(value: string): string {
	const d = new Decimal(value);
	const formatted = d.abs().toDecimalPlaces(1, Decimal.ROUND_HALF_UP).toFixed(1);
	if (d.isNeg()) return `(${formatted}%)`;
	return `${formatted}%`;
}

// ── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({
	label,
	value,
	colorClass,
}: {
	label: string;
	value: string;
	colorClass?: string;
}) {
	return (
		<div className="flex flex-col gap-1 rounded-lg border bg-card px-4 py-3">
			<span className="text-xs font-medium text-muted-foreground">{label}</span>
			<span className={cn('text-lg font-semibold tabular-nums', colorClass)}>{value}</span>
		</div>
	);
}

// ── KPI Strip ───────────────────────────────────────────────────────────────

function PnlKpiStrip({ kpis, isLoading }: { kpis?: PnlKpis | undefined; isLoading: boolean }) {
	if (isLoading) {
		return (
			<div className="flex gap-4 px-6 py-3">
				{Array.from({ length: 4 }).map((_, i) => (
					<Skeleton key={i} className="h-16 w-48" />
				))}
			</div>
		);
	}

	if (!kpis) return null;

	const marginPct = new Decimal(kpis.ebitdaMarginPct || '0');
	const marginColor = marginPct.gte(15)
		? 'text-emerald-600'
		: marginPct.gte(5)
			? 'text-amber-600'
			: 'text-red-600';

	const ebitda = new Decimal(kpis.ebitda || '0');
	const ebitdaColor = ebitda.gte(0) ? 'text-emerald-600' : 'text-red-600';

	const netProfit = new Decimal(kpis.netProfit || '0');
	const profitColor = netProfit.gte(0) ? 'text-emerald-600' : 'text-red-600';

	return (
		<div className="flex gap-4 px-6 py-3">
			<KpiCard label="Total Revenue HT" value={formatPnlAmount(kpis.totalRevenueHt)} />
			<KpiCard label="EBITDA" value={formatPnlAmount(kpis.ebitda)} colorClass={ebitdaColor} />
			<KpiCard
				label="EBITDA Margin"
				value={formatPnlPercent(kpis.ebitdaMarginPct)}
				colorClass={marginColor}
			/>
			<KpiCard
				label="Net Profit"
				value={formatPnlAmount(kpis.netProfit)}
				colorClass={profitColor}
			/>
		</div>
	);
}

// ── Grid Row Type ───────────────────────────────────────────────────────────

interface PnlGridRow {
	id: string;
	displayLabel: string;
	depth: number;
	displayOrder: number;
	isSubtotal: boolean;
	isSeparator: boolean;
	sectionKey: string;
	monthlyAmounts: string[];
	annualTotal: string;
	subRows?: PnlGridRow[];
}

function buildGridRows(lines: PnlLineItem[]): PnlGridRow[] {
	return lines.map((line) => ({
		id: `${line.sectionKey}/${line.categoryKey}/${line.lineItemKey}`,
		displayLabel: line.displayLabel,
		depth: line.depth,
		displayOrder: line.displayOrder,
		isSubtotal: line.isSubtotal,
		isSeparator: line.isSeparator,
		sectionKey: line.sectionKey,
		monthlyAmounts: line.monthlyAmounts,
		annualTotal: line.annualTotal,
	}));
}

// ── P&L Grid ────────────────────────────────────────────────────────────────

function PnlGrid({ lines, isLoading }: { lines: PnlLineItem[]; isLoading: boolean }) {
	const rows = useMemo(() => buildGridRows(lines), [lines]);

	const columns = useMemo<ColumnDef<PnlGridRow, string>[]>(() => {
		const cols: ColumnDef<PnlGridRow, string>[] = [
			{
				id: 'label',
				accessorFn: (row) => row.displayLabel,
				header: '',
				size: 280,
				cell: ({ row }) => {
					const indent = (row.original.depth - 1) * 20;
					return (
						<div
							style={{ paddingLeft: `${indent}px` }}
							className={cn(
								'truncate',
								row.original.isSubtotal && 'font-semibold',
								row.original.depth === 1 && 'font-semibold'
							)}
						>
							{row.original.displayLabel}
						</div>
					);
				},
			},
		];

		for (let m = 0; m < 12; m++) {
			const monthIdx = m;
			cols.push({
				id: `month-${monthIdx}`,
				accessorFn: (row) => row.monthlyAmounts[monthIdx] ?? '0',
				header: MONTHS[monthIdx]!,
				size: 110,
				cell: ({ row }) => {
					if (row.original.isSeparator) return null;
					const val = row.original.monthlyAmounts[monthIdx] ?? '0';
					return (
						<div
							className={cn(
								'text-right tabular-nums text-sm',
								new Decimal(val).isNeg() && 'text-red-600'
							)}
						>
							{formatPnlAmount(val)}
						</div>
					);
				},
			});
		}

		cols.push({
			id: 'annual',
			accessorFn: (row) => row.annualTotal,
			header: 'FY Total',
			size: 130,
			cell: ({ row }) => {
				if (row.original.isSeparator) return null;
				return (
					<div
						className={cn(
							'text-right tabular-nums text-sm font-medium',
							new Decimal(row.original.annualTotal).isNeg() && 'text-red-600'
						)}
					>
						{formatPnlAmount(row.original.annualTotal)}
					</div>
				);
			},
		});

		return cols;
	}, []);

	const table = useReactTable({
		data: rows,
		columns,
		getCoreRowModel: getCoreRowModel(),
		getExpandedRowModel: getExpandedRowModel(),
		getRowId: (row) => row.id,
	});

	if (isLoading) {
		return (
			<div className="px-6 py-4 space-y-2">
				{Array.from({ length: 15 }).map((_, i) => (
					<Skeleton key={i} className="h-8 w-full" />
				))}
			</div>
		);
	}

	if (rows.length === 0) return null;

	return (
		<div className="overflow-x-auto px-6">
			<table
				role="grid"
				aria-label="P&L Income Statement"
				className="w-full border-collapse text-sm"
			>
				<thead>
					{table.getHeaderGroups().map((headerGroup) => (
						<tr key={headerGroup.id} role="row">
							{headerGroup.headers.map((header) => (
								<th
									key={header.id}
									role="columnheader"
									aria-readonly="true"
									className={cn(
										'sticky top-0 z-10 bg-muted/50 px-3 py-2 text-left text-xs font-medium text-muted-foreground',
										header.id !== 'label' && 'text-right'
									)}
									style={{ width: header.getSize() }}
								>
									{header.isPlaceholder
										? null
										: flexRender(header.column.columnDef.header, header.getContext())}
								</th>
							))}
						</tr>
					))}
				</thead>
				<tbody>
					{table.getRowModel().rows.map((row: Row<PnlGridRow>) => (
						<tr
							key={row.id}
							role="row"
							aria-level={row.original.depth}
							className={cn(
								'border-b border-border/50',
								row.original.isSeparator && 'border-t-2 border-dashed border-border h-2',
								row.original.isSubtotal && 'bg-muted/30 border-t-2 border-border font-semibold',
								row.original.depth === 1 &&
									!row.original.isSubtotal &&
									!row.original.isSeparator &&
									'bg-muted/20'
							)}
						>
							{row.getVisibleCells().map((cell) => (
								<td key={cell.id} role="gridcell" aria-readonly="true" className="px-3 py-1.5">
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

// ── Stale Banner ────────────────────────────────────────────────────────────

function StaleBanner({
	staleModules,
	onNavigate,
}: {
	staleModules: string[];
	onNavigate: (module: string) => void;
}) {
	const hasPnlStale = staleModules.includes('PNL');
	const hasUpstreamStale = staleModules.some((m) => ['REVENUE', 'STAFFING', 'OPEX'].includes(m));

	if (!hasPnlStale && !hasUpstreamStale) return null;

	return (
		<div className="mx-6 mt-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
			{hasUpstreamStale ? (
				<>
					<span className="font-medium">Prerequisites outdated.</span> Recalculate{' '}
					{staleModules
						.filter((m) => ['REVENUE', 'STAFFING', 'OPEX'].includes(m))
						.map((m) => (
							<button
								key={m}
								className="underline hover:text-amber-900 mx-1"
								onClick={() => onNavigate(m)}
							>
								{m.toLowerCase()}
							</button>
						))}{' '}
					before running P&L.
				</>
			) : (
				<>
					<span className="font-medium">P&L data may be outdated.</span> Click Calculate to refresh.
				</>
			)}
		</div>
	);
}

// ── Format Toggle ───────────────────────────────────────────────────────────

function FormatToggle({ value, onChange }: { value: PnlFormat; onChange: (f: PnlFormat) => void }) {
	const options: { value: PnlFormat; label: string }[] = [
		{ value: 'summary', label: 'Summary' },
		{ value: 'detailed', label: 'Detailed' },
		{ value: 'ifrs', label: 'IFRS' },
	];

	return (
		<div className="inline-flex rounded-md border border-input bg-background">
			{options.map((opt) => (
				<button
					key={opt.value}
					onClick={() => onChange(opt.value)}
					className={cn(
						'px-3 py-1.5 text-xs font-medium transition-colors',
						'first:rounded-l-md last:rounded-r-md',
						opt.value === value
							? 'bg-primary text-primary-foreground'
							: 'text-muted-foreground hover:text-foreground'
					)}
				>
					{opt.label}
				</button>
			))}
		</div>
	);
}

// ── Main P&L Page ───────────────────────────────────────────────────────────

export function PnlPage() {
	const { versionId, versionStatus, comparisonVersionId, fiscalYear } = useWorkspaceContext();
	const user = useAuthStore((state) => state.user);
	const { data: versionsData } = useVersions(fiscalYear);

	const [format, setFormat] = useState<PnlFormat>('ifrs');

	const {
		data: pnlData,
		isLoading: pnlLoading,
		isError: pnlError,
	} = usePnlResults(format, comparisonVersionId ?? undefined);
	const { data: kpisData, isLoading: kpisLoading } = usePnlKpis();
	const calculateMutation = useCalculatePnl();

	const version = versionsData?.data?.find((v) => v.id === versionId);
	const staleModules: string[] = version?.staleModules ?? [];
	const isViewerOnly = user?.role === 'Viewer';
	const isLocked = versionStatus === 'Locked' || versionStatus === 'Archived';
	const canCalculate = !isViewerOnly && !isLocked;

	const navigate = useNavigate();
	const handleNavigateToModule = (module: string) => {
		const paths: Record<string, string> = {
			REVENUE: '/planning/revenue',
			STAFFING: '/planning/staffing',
			OPEX: '/planning/opex',
		};
		const path = paths[module];
		if (path) navigate(path);
	};

	const handleCalculate = () => {
		const hasUpstreamStale = staleModules.some((m) => ['REVENUE', 'STAFFING', 'OPEX'].includes(m));
		if (hasUpstreamStale) return;
		calculateMutation.mutate();
	};

	const isEmpty = !pnlLoading && !pnlError && (!pnlData || pnlData.lines.length === 0);

	return (
		<PageTransition>
			<div className="flex h-full flex-col">
				{/* Module Toolbar */}
				<div className="flex items-center justify-between border-b px-6 py-3">
					<div className="flex items-center gap-4">
						<h1 className="text-lg font-semibold">P&L Reporting</h1>
						<FormatToggle value={format} onChange={setFormat} />
					</div>
					<div className="flex items-center gap-2">
						{canCalculate && (
							<Button size="sm" onClick={handleCalculate} disabled={calculateMutation.isPending}>
								{calculateMutation.isPending ? 'Calculating...' : 'Calculate'}
							</Button>
						)}
					</div>
				</div>

				{/* Stale Banner */}
				<StaleBanner staleModules={staleModules} onNavigate={handleNavigateToModule} />

				{/* KPI Strip */}
				<PnlKpiStrip kpis={kpisData} isLoading={kpisLoading} />

				{/* Empty State */}
				{isEmpty && (
					<div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
						<p className="text-muted-foreground">
							No P&L data yet.{' '}
							{canCalculate
								? 'Click Calculate to generate.'
								: 'A Budget Owner or Editor must calculate the P&L first.'}
						</p>
						{canCalculate && (
							<Button onClick={handleCalculate} disabled={calculateMutation.isPending}>
								Calculate P&L
							</Button>
						)}
					</div>
				)}

				{/* P&L Grid */}
				{!isEmpty && (
					<div className="flex-1 overflow-y-auto pb-6">
						<PnlGrid lines={pnlData?.lines ?? []} isLoading={pnlLoading} />
					</div>
				)}
			</div>
		</PageTransition>
	);
}
