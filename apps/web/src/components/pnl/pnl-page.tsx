import { useEffect, useMemo, useState } from 'react';
import Decimal from 'decimal.js';
import {
	useReactTable,
	getCoreRowModel,
	flexRender,
	type ColumnDef,
	type Row,
} from '@tanstack/react-table';
import {
	AlertTriangle,
	ArrowUpRight,
	BarChart3,
	DollarSign,
	Download,
	Landmark,
	Printer,
	TrendingUp,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { useWorkspaceContext } from '../../hooks/use-workspace-context';
import { usePnlResults, usePnlKpis, useCalculatePnl } from '../../hooks/use-pnl';
import { useVersions } from '../../hooks/use-versions';
import { useAuthStore } from '../../stores/auth-store';
import { useRightPanelStore } from '../../stores/right-panel-store';
import { usePnlSelectionStore, type PnlSelection } from '../../stores/pnl-selection-store';
import { ApiError } from '../../lib/api-client';
import { cn } from '../../lib/cn';
import { formatMoney } from '../../lib/format-money';
import { formatDateTime } from '../../lib/format-date';
import { Button } from '../ui/button';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import { Skeleton } from '../ui/skeleton';
import { CalculateButton } from '../shared/calculate-button';
import { Counter } from '../shared/counter';
import { EmptyState } from '../shared/empty-state';
import { KpiCard } from '../shared/kpi-card';
import { PageTransition } from '../shared/page-transition';
import { StalePill } from '../shared/stale-pill';
import { WorkspaceStatusStrip, type StatusSection } from '../shared/workspace-status-strip';
import { ExportDialog } from '../shared/export-dialog';
import type { PnlFormat, PnlLineItem, PnlKpis } from '@budfin/types';
import { ComparisonBarChart } from './comparison-bar-chart';
import { VarianceWaterfallChart } from './variance-waterfall-chart';
import '../pnl/pnl-inspector-content';

// ── Constants ───────────────────────────────────────────────────────────────

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const STALE_MODULE_LABELS: Record<string, string> = {
	REVENUE: 'Revenue',
	STAFFING: 'Staffing',
	OPEX: 'OpEx',
};

const STALE_MODULE_PATHS: Record<string, string> = {
	REVENUE: '/planning/revenue',
	STAFFING: '/planning/staffing',
	OPEX: '/planning/opex',
};

/** Maps P&L section keys to the planning module that sources them. */
const SECTION_DRILL_DOWN_PATHS: Record<string, string> = {
	REVENUE_CONTRACTS: '/planning/revenue',
	STAFF_COSTS: '/planning/staffing',
	EMPLOYER_CHARGES: '/planning/staffing',
	OTHER_OPEX: '/planning/opex',
};

// ── Format helpers ──────────────────────────────────────────────────────────

function formatPnlAmount(value: string): string {
	const d = new Decimal(value);
	if (d.isZero()) return '--';
	const formatted = formatMoney(d.abs());
	return d.isNeg() ? `(${formatted})` : formatted;
}

// ── Grid Row Type ───────────────────────────────────────────────────────────

interface PnlGridRow {
	id: string;
	displayLabel: string;
	depth: 1 | 2 | 3;
	displayOrder: number;
	isSubtotal: boolean;
	isSeparator: boolean;
	sectionKey: string;
	monthlyAmounts: string[];
	annualTotal: string;
	isClickable: boolean;
	/** Route path for drill-down navigation (only set on depth-1 header rows). */
	drillDownPath: string | null;
	comparisonMonthlyAmounts?: string[] | undefined;
	comparisonAnnualTotal?: string | undefined;
	varianceMonthlyAmounts?: string[] | undefined;
	varianceAnnualTotal?: string | undefined;
	varianceAnnualPercent?: string | undefined;
}

function buildGridRows(lines: PnlLineItem[]): PnlGridRow[] {
	return lines.map((line) => {
		const drillDownPath =
			line.depth === 1 && !line.isSeparator && !line.isSubtotal
				? (SECTION_DRILL_DOWN_PATHS[line.sectionKey] ?? null)
				: null;

		const row: PnlGridRow = {
			id: `${line.sectionKey}/${line.categoryKey}/${line.lineItemKey}`,
			displayLabel: line.displayLabel,
			depth: line.depth,
			displayOrder: line.displayOrder,
			isSubtotal: line.isSubtotal,
			isSeparator: line.isSeparator,
			sectionKey: line.sectionKey,
			monthlyAmounts: line.monthlyAmounts,
			annualTotal: line.annualTotal,
			isClickable: (line.depth === 1 || line.isSubtotal) && !line.isSeparator,
			drillDownPath,
		};
		if (line.comparisonMonthlyAmounts) row.comparisonMonthlyAmounts = line.comparisonMonthlyAmounts;
		if (line.comparisonAnnualTotal) row.comparisonAnnualTotal = line.comparisonAnnualTotal;
		if (line.varianceMonthlyAmounts) row.varianceMonthlyAmounts = line.varianceMonthlyAmounts;
		if (line.varianceAnnualTotal) row.varianceAnnualTotal = line.varianceAnnualTotal;
		if (line.varianceAnnualPercent) row.varianceAnnualPercent = line.varianceAnnualPercent;
		return row;
	});
}

// ── KPI Strip ───────────────────────────────────────────────────────────────

function PnlKpiRibbon({
	kpis,
	isLoading,
	isStale,
}: {
	kpis: PnlKpis | undefined;
	isLoading: boolean;
	isStale: boolean;
}) {
	if (isLoading) {
		return (
			<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
				{Array.from({ length: 4 }).map((_, i) => (
					<Skeleton key={i} className="h-24 rounded-xl" />
				))}
			</div>
		);
	}

	if (!kpis) return null;

	const marginPct = new Decimal(kpis.ebitdaMarginPct || '0');
	const ebitda = new Decimal(kpis.ebitda || '0');
	const netProfit = new Decimal(kpis.netProfit || '0');

	const marginAccent = marginPct.gte(15)
		? 'var(--color-success)'
		: marginPct.gte(5)
			? 'var(--color-warning)'
			: 'var(--color-error)';

	const ebitdaAccent = ebitda.gte(0) ? 'var(--color-success)' : 'var(--color-error)';
	const profitAccent = netProfit.gte(0) ? 'var(--color-success)' : 'var(--color-error)';

	return (
		<div
			className="grid grid-cols-2 gap-3 lg:grid-cols-4"
			role="list"
			aria-label="P&L key performance indicators"
		>
			<KpiCard
				label="Total Revenue HT"
				icon={DollarSign}
				index={0}
				isStale={isStale}
				accentColor="var(--color-info)"
				subtitle="Gross revenue before costs"
			>
				<Counter
					value={parseFloat(kpis.totalRevenueHt)}
					formatter={(v) => formatMoney(v, { showCurrency: true, compact: true })}
				/>
			</KpiCard>

			<KpiCard
				label="EBITDA"
				icon={TrendingUp}
				index={1}
				isStale={isStale}
				accentColor={ebitdaAccent}
				subtitle="Earnings before interest, tax, depreciation"
			>
				<Counter
					value={parseFloat(kpis.ebitda)}
					formatter={(v) => formatMoney(v, { showCurrency: true, compact: true })}
				/>
			</KpiCard>

			<KpiCard
				label="EBITDA Margin"
				icon={BarChart3}
				index={2}
				isStale={isStale}
				accentColor={marginAccent}
				subtitle="Operating profitability ratio"
			>
				<Counter value={marginPct.toNumber()} formatter={(v) => `${v.toFixed(1)}%`} />
			</KpiCard>

			<KpiCard
				label="Net Profit"
				icon={Landmark}
				index={3}
				isStale={isStale}
				accentColor={profitAccent}
				subtitle="Bottom line after all charges"
			>
				<Counter
					value={parseFloat(kpis.netProfit)}
					formatter={(v) => formatMoney(v, { showCurrency: true, compact: true })}
				/>
			</KpiCard>
		</div>
	);
}

// ── Status Strip ────────────────────────────────────────────────────────────

function PnlStatusStrip({
	calculatedAt,
	staleModules,
}: {
	calculatedAt: string | null;
	staleModules: string[];
}) {
	const upstreamStale = staleModules.filter((m) => ['REVENUE', 'STAFFING', 'OPEX'].includes(m));
	const isPnlStale = staleModules.includes('PNL');

	const sections: StatusSection[] = [
		{
			key: 'last-calculated',
			label: 'Last calculated',
			value: calculatedAt ? formatDateTime(calculatedAt) : 'Not yet calculated',
			priority: 0,
		},
		{
			key: 'pnl-status',
			label: 'P&L',
			value: isPnlStale ? 'Stale' : 'Fresh',
			severity: isPnlStale ? 'warning' : 'success',
			priority: 1,
		},
	];

	if (upstreamStale.length > 0) {
		sections.push({
			key: 'upstream',
			label: 'Upstream',
			value: (
				<span className="inline-flex items-center gap-1.5">
					{upstreamStale.map((mod) => (
						<StalePill key={mod} label={STALE_MODULE_LABELS[mod] ?? mod} />
					))}
				</span>
			),
			severity: 'warning',
			priority: 2,
		});
	}

	return <WorkspaceStatusStrip sections={sections} />;
}

// ── Stale Banner ────────────────────────────────────────────────────────────

function StaleBanner({
	staleModules,
	onNavigate,
}: {
	staleModules: string[];
	onNavigate: (path: string) => void;
}) {
	const upstreamStale = staleModules.filter((m) => ['REVENUE', 'STAFFING', 'OPEX'].includes(m));

	if (upstreamStale.length === 0) return null;

	return (
		<div
			className={cn(
				'mx-6 mt-3 flex items-start gap-3 rounded-lg',
				'border border-(--color-warning)/20 bg-(--color-warning-bg)',
				'px-4 py-3 text-(--text-sm) text-(--color-warning)'
			)}
			role="alert"
		>
			<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
			<div>
				<span className="font-medium">Prerequisites outdated.</span> Recalculate{' '}
				{upstreamStale.map((m, i) => (
					<span key={m}>
						{i > 0 && ', '}
						<button
							className={cn(
								'underline transition-colors duration-(--duration-fast)',
								'hover:text-(--color-warning-hover)'
							)}
							onClick={() => {
								const path = STALE_MODULE_PATHS[m];
								if (path) onNavigate(path);
							}}
						>
							{STALE_MODULE_LABELS[m]?.toLowerCase() ?? m.toLowerCase()}
						</button>
					</span>
				))}{' '}
				before running P&L.
			</div>
		</div>
	);
}

// ── P&L Grid ────────────────────────────────────────────────────────────────

function PnlGrid({
	lines,
	isLoading,
	selection,
	onSelectRow,
	onNavigate,
}: {
	lines: PnlLineItem[];
	isLoading: boolean;
	selection: PnlSelection | null;
	onSelectRow: (row: PnlGridRow) => void;
	onNavigate: (path: string) => void;
}) {
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
					const path = row.original.drillDownPath;
					return (
						<div
							style={{ paddingLeft: `${indent}px` }}
							className={cn(
								'truncate',
								row.original.isSubtotal && 'font-semibold',
								row.original.depth === 1 && !row.original.isSeparator && 'font-semibold'
							)}
						>
							{path ? (
								<button
									className={cn(
										'inline-flex items-center gap-1',
										'text-left hover:text-(--accent-600)',
										'transition-colors duration-(--duration-fast)'
									)}
									aria-label={`Navigate to ${row.original.displayLabel}`}
									onClick={(e) => {
										e.stopPropagation();
										onNavigate(path);
									}}
								>
									{row.original.displayLabel}
									<ArrowUpRight className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden="true" />
								</button>
							) : (
								row.original.displayLabel
							)}
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
				size: 100,
				cell: ({ row }) => {
					if (row.original.isSeparator) return null;
					const val = row.original.monthlyAmounts[monthIdx] ?? '0';
					const d = new Decimal(val);
					return (
						<div
							className={cn(
								'text-right font-[family-name:var(--font-mono)] tabular-nums',
								d.isNeg() && 'text-(--color-error)',
								d.isZero() && 'text-(--text-muted)'
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
			size: 120,
			cell: ({ row }) => {
				if (row.original.isSeparator) return null;
				const d = new Decimal(row.original.annualTotal);
				return (
					<div
						className={cn(
							'text-right font-[family-name:var(--font-mono)] tabular-nums font-medium',
							d.isNeg() && 'text-(--color-error)',
							d.isZero() && 'text-(--text-muted)'
						)}
					>
						{formatPnlAmount(row.original.annualTotal)}
					</div>
				);
			},
		});

		return cols;
	}, [onNavigate]);

	const table = useReactTable({
		data: rows,
		columns,
		getCoreRowModel: getCoreRowModel(),
		getRowId: (row) => row.id,
	});

	if (isLoading) {
		return (
			<div className="space-y-2 px-6 py-4">
				{Array.from({ length: 15 }).map((_, i) => (
					<Skeleton key={i} className="h-8 w-full rounded-md" />
				))}
			</div>
		);
	}

	if (rows.length === 0) return null;

	const isSelected = (row: PnlGridRow) =>
		selection?.sectionKey === row.sectionKey && selection?.displayLabel === row.displayLabel;

	return (
		<div className="h-full overflow-y-auto scrollbar-thin">
			<table
				role="grid"
				aria-label="P&L Income Statement"
				className="w-full border-collapse text-(--text-sm)"
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
										'sticky top-0 z-10',
										'bg-(--workspace-bg-card)',
										'border-b border-(--workspace-border)',
										'px-3 py-2.5',
										'text-(--text-xs) font-medium uppercase tracking-wider text-(--text-muted)',
										header.id !== 'label' && 'text-right',
										header.id === 'annual' && 'bg-(--workspace-bg-subtle)'
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
					{table.getRowModel().rows.map((row: Row<PnlGridRow>) => {
						const orig = row.original;
						const selected = isSelected(orig);

						return (
							<tr
								key={row.id}
								role="row"
								aria-level={orig.depth}
								aria-selected={selected}
								tabIndex={orig.isClickable ? 0 : undefined}
								onClick={() => {
									if (orig.isClickable) onSelectRow(orig);
								}}
								onKeyDown={(e) => {
									if (orig.isClickable && (e.key === 'Enter' || e.key === ' ')) {
										e.preventDefault();
										onSelectRow(orig);
									}
								}}
								className={cn(
									'border-b border-(--workspace-border)/50',
									'transition-colors duration-(--duration-fast)',
									orig.isSeparator && 'h-1',
									orig.isSubtotal &&
										'bg-(--workspace-bg-subtle) border-t border-(--workspace-border) font-semibold',
									orig.depth === 1 &&
										!orig.isSubtotal &&
										!orig.isSeparator &&
										'bg-(--workspace-bg-muted)',
									orig.isClickable && !selected && 'cursor-pointer hover:bg-(--workspace-bg-muted)',
									selected && 'bg-(--accent-50) border-l-[3px] border-l-(--accent-500)'
								)}
							>
								{row.getVisibleCells().map((cell) => (
									<td
										key={cell.id}
										role="gridcell"
										aria-readonly="true"
										className={cn(
											'px-3 py-1.5',
											cell.column.id === 'annual' && 'bg-(--workspace-bg-subtle)/50'
										)}
									>
										{orig.isSeparator
											? null
											: flexRender(cell.column.columnDef.cell, cell.getContext())}
									</td>
								))}
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}

// ── Main P&L Page ───────────────────────────────────────────────────────────

export function PnlPage() {
	const { versionId, versionStatus, comparisonVersionId, fiscalYear } = useWorkspaceContext();
	const user = useAuthStore((state) => state.user);
	const { data: versionsData } = useVersions(fiscalYear);
	const setActivePage = useRightPanelStore((state) => state.setActivePage);
	const isPanelOpen = useRightPanelStore((state) => state.isOpen);
	const selection = usePnlSelectionStore((state) => state.selection);
	const selectRow = usePnlSelectionStore((state) => state.selectRow);
	const clearSelection = usePnlSelectionStore((state) => state.clearSelection);
	const navigate = useNavigate();

	const [format, setFormat] = useState<PnlFormat>('ifrs');
	const [exportOpen, setExportOpen] = useState(false);

	const {
		data: pnlData,
		isLoading: pnlLoading,
		isError: pnlError,
		error: pnlErrorObj,
	} = usePnlResults(format, comparisonVersionId ?? undefined);
	const { data: kpisData, isLoading: kpisLoading, error: kpisErrorObj } = usePnlKpis();

	const isNotCalculated =
		(pnlErrorObj instanceof ApiError && pnlErrorObj.code === 'PNL_NOT_CALCULATED') ||
		(kpisErrorObj instanceof ApiError && kpisErrorObj.code === 'PNL_NOT_CALCULATED');
	const calculateMutation = useCalculatePnl();

	const version = versionsData?.data?.find((v) => v.id === versionId);
	const staleModules: string[] = version?.staleModules ?? [];
	const isViewerOnly = user?.role === 'Viewer';
	const isLocked = versionStatus === 'Locked' || versionStatus === 'Archived';
	const canCalculate = !isViewerOnly && !isLocked;
	const isPnlStale = staleModules.includes('PNL');

	useEffect(() => {
		setActivePage('pnl');
		return () => {
			setActivePage(null);
			clearSelection();
		};
	}, [clearSelection, setActivePage]);

	useEffect(() => {
		if (!isPanelOpen) {
			clearSelection();
		}
	}, [clearSelection, isPanelOpen]);

	const handleCalculate = () => {
		const hasUpstreamStale = staleModules.some((m) => ['REVENUE', 'STAFFING', 'OPEX'].includes(m));
		if (hasUpstreamStale) return;
		calculateMutation.mutate();
	};

	const handleSelectRow = (row: PnlGridRow) => {
		const pnlSelection: PnlSelection = {
			sectionKey: row.sectionKey,
			displayLabel: row.displayLabel,
			depth: row.depth,
			isSubtotal: row.isSubtotal,
			monthlyAmounts: row.monthlyAmounts,
			annualTotal: row.annualTotal,
		};
		if (row.comparisonMonthlyAmounts)
			pnlSelection.comparisonMonthlyAmounts = row.comparisonMonthlyAmounts;
		if (row.comparisonAnnualTotal) pnlSelection.comparisonAnnualTotal = row.comparisonAnnualTotal;
		if (row.varianceMonthlyAmounts)
			pnlSelection.varianceMonthlyAmounts = row.varianceMonthlyAmounts;
		if (row.varianceAnnualTotal) pnlSelection.varianceAnnualTotal = row.varianceAnnualTotal;
		if (row.varianceAnnualPercent) pnlSelection.varianceAnnualPercent = row.varianceAnnualPercent;
		selectRow(pnlSelection);
	};

	const isEmpty =
		!pnlLoading && (isNotCalculated || (!pnlError && (!pnlData || pnlData.lines.length === 0)));

	const hasComparison = !!comparisonVersionId && !isEmpty && (pnlData?.lines ?? []).length > 0;
	const primaryVersion = versionsData?.data?.find((v) => v.id === versionId);
	const comparisonVersion = versionsData?.data?.find((v) => v.id === comparisonVersionId);
	const primaryLabel = primaryVersion?.name ?? 'Primary';
	const comparisonLabel = comparisonVersion?.name ?? 'Comparison';

	return (
		<PageTransition>
			<div className="flex h-full flex-col overflow-hidden">
				{/* Toolbar */}
				<div
					className={cn(
						'flex shrink-0 flex-wrap items-center justify-between gap-3',
						'border-b border-(--workspace-border) px-6 py-2'
					)}
				>
					<ToggleGroup
						type="single"
						value={format}
						onValueChange={(value) => {
							if (value) {
								setFormat(value as PnlFormat);
								clearSelection();
							}
						}}
						aria-label="P&L format"
					>
						<ToggleGroupItem value="summary">Summary</ToggleGroupItem>
						<ToggleGroupItem value="detailed">Detailed</ToggleGroupItem>
						<ToggleGroupItem value="ifrs">IFRS</ToggleGroupItem>
					</ToggleGroup>

					<div className="flex flex-wrap items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() => setExportOpen(true)}
							className="no-print"
						>
							<Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
							Export
						</Button>
						<Button variant="outline" size="sm" onClick={() => window.print()} className="no-print">
							<Printer className="mr-1.5 h-4 w-4" aria-hidden="true" />
							Print
						</Button>
						{canCalculate && (
							<CalculateButton
								onCalculate={handleCalculate}
								isPending={calculateMutation.isPending}
								isSuccess={calculateMutation.isSuccess}
								isError={calculateMutation.isError}
								disabled={staleModules.some((m) => ['REVENUE', 'STAFFING', 'OPEX'].includes(m))}
							/>
						)}
					</div>
				</div>

				{/* Stale Banner */}
				<StaleBanner staleModules={staleModules} onNavigate={(path) => navigate(path)} />

				{/* KPI Ribbon */}
				<div className="shrink-0 px-6 py-3">
					<PnlKpiRibbon kpis={kpisData} isLoading={kpisLoading} isStale={isPnlStale} />
				</div>

				{/* Status Strip */}
				<div className="shrink-0">
					<PnlStatusStrip
						calculatedAt={pnlData?.calculatedAt ?? null}
						staleModules={staleModules}
					/>
				</div>

				{/* Comparison Charts (shown only when a comparison version is selected) */}
				{hasComparison && (
					<div className="shrink-0 border-b border-(--workspace-border) px-6 py-4">
						<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
							<ComparisonBarChart
								lines={pnlData!.lines}
								primaryLabel={primaryLabel}
								comparisonLabel={comparisonLabel}
							/>
							<VarianceWaterfallChart lines={pnlData!.lines} />
						</div>
					</div>
				)}

				{/* Empty State */}
				{isEmpty && (
					<div className="flex flex-1 items-center justify-center">
						<EmptyState
							icon={Landmark}
							title="No P&L data yet"
							description={
								canCalculate
									? 'Click Calculate to generate the P&L statement.'
									: 'A Budget Owner or Editor must calculate the P&L first.'
							}
						/>
					</div>
				)}

				{/* P&L Grid */}
				{!isEmpty && (
					<div className="min-h-0 flex-1 overflow-hidden px-6 py-2">
						<PnlGrid
							lines={pnlData?.lines ?? []}
							isLoading={pnlLoading}
							selection={selection}
							onSelectRow={handleSelectRow}
							onNavigate={(path) => navigate(path)}
						/>
					</div>
				)}
			</div>

			<ExportDialog open={exportOpen} onOpenChange={setExportOpen} defaultReportType="PNL" />
		</PageTransition>
	);
}
