import { useEffect, useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { useWorkspaceContext } from '../../hooks/use-workspace-context';
import { usePnlAccounting } from '../../hooks/use-pnl-accounting';
import { useVersions } from '../../hooks/use-versions';
import { useRightPanelStore } from '../../stores/right-panel-store';
import {
	usePnlAccountingSelectionStore,
	type PnlAccountingSelection,
} from '../../stores/pnl-accounting-selection-store';
import { cn } from '../../lib/cn';
import { PnlKpiRibbon } from './pnl-kpi-ribbon';
import { PnlAccountingGrid } from './pnl-accounting-grid';
import { PageTransition } from '../shared/page-transition';
import { EmptyState } from '../shared/empty-state';
import { Skeleton } from '../ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import '../pnl/pnl-accounting-inspector';

// ── Page Component ───────────────────────────────────────────────────────────

export function PnlAccountingPage() {
	const { versionId, fiscalYear } = useWorkspaceContext();
	const { data: versionsData } = useVersions(fiscalYear);
	const setActivePage = useRightPanelStore((s) => s.setActivePage);
	const isPanelOpen = useRightPanelStore((s) => s.isOpen);
	const selectLine = usePnlAccountingSelectionStore((s) => s.selectLine);
	const clearSelection = usePnlAccountingSelectionStore((s) => s.clearSelection);

	const [compareYear, setCompareYear] = useState<number | undefined>();
	const [profitCenter, setProfitCenter] = useState<string | undefined>();

	const queryOptions: { compareYear?: number; profitCenter?: string } = {};
	if (compareYear !== undefined) queryOptions.compareYear = compareYear;
	if (profitCenter !== undefined) queryOptions.profitCenter = profitCenter;

	const { data, isLoading, error } = usePnlAccounting(queryOptions);

	const version = versionsData?.data?.find((v) => v.id === versionId);
	const staleModules: string[] = version?.staleModules ?? [];
	const isPnlStale = staleModules.includes('PNL');

	// Register with the right panel
	useEffect(() => {
		setActivePage('pnl-accounting');
		return () => {
			setActivePage(null);
			clearSelection();
		};
	}, [clearSelection, setActivePage]);

	// Clear selection when panel closes
	useEffect(() => {
		if (!isPanelOpen) {
			clearSelection();
		}
	}, [clearSelection, isPanelOpen]);

	const handleRowClick = (sectionKey: string, lineLabel: string) => {
		if (!data) return;

		// Find the line in sections
		let matchedLine: PnlAccountingSelection | null = null;

		for (const section of data.sections) {
			if (section.isSubtotal) continue;
			for (const line of section.lines) {
				if (section.sectionKey === sectionKey && line.displayLabel === lineLabel) {
					const sel: PnlAccountingSelection = {
						sectionKey: section.sectionKey,
						lineLabel: line.displayLabel,
						budgetAmount: line.budgetAmount,
					};
					if (line.actualAmount) sel.actualAmount = line.actualAmount;
					if (line.variance) sel.variance = line.variance;
					if (line.variancePct) sel.variancePct = line.variancePct;
					if (line.accountCode) sel.accountCode = line.accountCode;
					matchedLine = sel;
					break;
				}
			}
			if (matchedLine) break;
		}

		if (matchedLine) {
			selectLine(matchedLine);
		}
	};

	const isEmpty = !isLoading && (!data || data.sections.length === 0);

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
					<h1 className="text-(--text-base) font-semibold text-(--text-primary)">
						P&L (Accounting View)
					</h1>

					<div className="flex flex-wrap items-center gap-3">
						{/* Compare dropdown */}
						<Select
							value={compareYear ? String(compareYear) : 'none'}
							onValueChange={(v) => setCompareYear(v === 'none' ? undefined : Number(v))}
						>
							<SelectTrigger className="w-[180px]" aria-label="Compare with year">
								<SelectValue placeholder="No comparison" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="none">No comparison</SelectItem>
								<SelectItem value="2025">Actual 2025</SelectItem>
								<SelectItem value="2024">Actual 2024</SelectItem>
							</SelectContent>
						</Select>

						{/* Profit center toggle */}
						<ToggleGroup
							type="single"
							value={profitCenter ?? ''}
							onValueChange={(v) => setProfitCenter(v === '' ? undefined : v)}
							aria-label="Filter by profit center"
						>
							<ToggleGroupItem value="">All</ToggleGroupItem>
							<ToggleGroupItem value="MATERNELLE">Maternelle</ToggleGroupItem>
							<ToggleGroupItem value="ELEMENTAIRE">Élémentaire</ToggleGroupItem>
							<ToggleGroupItem value="COLLEGE">Collège</ToggleGroupItem>
							<ToggleGroupItem value="LYCEE">Lycée</ToggleGroupItem>
						</ToggleGroup>
					</div>
				</div>

				{/* KPI Ribbon */}
				{isLoading && (
					<div className="shrink-0 px-6 py-3">
						<div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
							{Array.from({ length: 5 }).map((_, i) => (
								<Skeleton key={i} className="h-24 rounded-xl" />
							))}
						</div>
					</div>
				)}

				{data && (
					<div className="shrink-0 px-6 py-3">
						<PnlKpiRibbon kpis={data.kpis} isStale={isPnlStale} />
					</div>
				)}

				{/* Error */}
				{error && !isLoading && (
					<div
						className={cn(
							'mx-6 mt-3 rounded-lg border border-(--color-error)/20',
							'bg-(--color-error)/5 px-4 py-3 text-(--text-sm) text-(--color-error)'
						)}
						role="alert"
					>
						Failed to load accounting P&L data. Please try again.
					</div>
				)}

				{/* Empty State */}
				{isEmpty && !error && (
					<div className="flex flex-1 items-center justify-center">
						<EmptyState
							icon={FileSpreadsheet}
							title="No accounting P&L data"
							description="Calculate the P&L first, then come back to see the accounting view."
						/>
					</div>
				)}

				{/* P&L Grid */}
				{data && data.sections.length > 0 && (
					<div className="min-h-0 flex-1 overflow-auto px-6 py-2">
						<PnlAccountingGrid
							sections={data.sections}
							hasComparison={!!compareYear}
							onRowClick={handleRowClick}
						/>
					</div>
				)}
			</div>
		</PageTransition>
	);
}
