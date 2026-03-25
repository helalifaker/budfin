import { useCallback, useEffect, useMemo, useState } from 'react';
import Decimal from 'decimal.js';
import { Download, FileSpreadsheet } from 'lucide-react';
import { useWorkspaceContext } from '../../hooks/use-workspace-context';
import { useAuthStore } from '../../stores/auth-store';
import { useRightPanelStore } from '../../stores/right-panel-store';
import { useOpExSelectionStore } from '../../stores/opex-selection-store';
import { useVersions } from '../../hooks/use-versions';
import {
	useOpExLineItems,
	useUpdateOpExMonthly,
	useBulkUpdateOpEx,
	useCalculateOpEx,
} from '../../hooks/use-opex';
import { deriveStaffingEditability } from '../../lib/staffing-workspace';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import { cn } from '../../lib/cn';
import { Button } from '../ui/button';
import { PageTransition } from '../shared/page-transition';
import { CalculateButton } from '../shared/calculate-button';
import { EmptyState } from '../shared/empty-state';
import { ExportDialog } from '../shared/export-dialog';
import { StalePill } from '../shared/stale-pill';
import { OpExKpiRibbon } from './opex-kpi-ribbon';
import { OpExStatusStrip } from './opex-status-strip';
import { OpExGrid } from './opex-grid';
import { NonOperatingGrid } from './non-operating-grid';
import './opex-inspector';

// ── Types ────────────────────────────────────────────────────────────────────

type OpExTab = 'operating' | 'non-operating';

const OPEX_TABS: Array<{ value: OpExTab; label: string }> = [
	{ value: 'operating', label: 'Operating Expenses' },
	{ value: 'non-operating', label: 'Non-Operating Items' },
];

// ── Component ────────────────────────────────────────────────────────────────

export function OpExPage() {
	const { versionId, fiscalYear, versionStatus } = useWorkspaceContext();
	const user = useAuthStore((state) => state.user);
	const setActivePage = useRightPanelStore((state) => state.setActivePage);
	const isPanelOpen = useRightPanelStore((state) => state.isOpen);
	const clearSelection = useOpExSelectionStore((s) => s.clearSelection);

	const [activeTab, setActiveTab] = useState<OpExTab>('operating');
	const [exportOpen, setExportOpen] = useState(false);

	const { data: versionsData } = useVersions(fiscalYear);
	const { data: lineItemsResponse, isLoading } = useOpExLineItems(versionId);
	const { isUpstreamStale, ...calculateMutation } = useCalculateOpEx(versionId);
	const updateMonthlyMutation = useUpdateOpExMonthly(versionId);
	const bulkUpdateMutation = useBulkUpdateOpEx(versionId);

	// Register right panel on mount
	useEffect(() => {
		setActivePage('opex');
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

	const currentVersion = useMemo(() => {
		if (!versionId || !versionsData?.data) return null;
		return versionsData.data.find((version) => version.id === versionId) ?? null;
	}, [versionId, versionsData]);

	// Editability & permissions
	const editability = deriveStaffingEditability({
		role: user?.role ?? null,
		versionStatus: currentVersion?.status ?? versionStatus,
	});
	const isEditable = editability === 'editable';
	const isLocked = editability === 'locked';
	const isViewer = editability === 'viewer';
	const isStale = currentVersion?.staleModules?.includes('OPEX') ?? false;
	const isUncalculated = !isStale && !currentVersion?.lastCalculatedAt;

	// Split line items by section type
	const operatingItems = useMemo(
		() => (lineItemsResponse?.data ?? []).filter((item) => item.sectionType === 'OPERATING'),
		[lineItemsResponse?.data]
	);

	const nonOperatingItems = useMemo(
		() => (lineItemsResponse?.data ?? []).filter((item) => item.sectionType === 'NON_OPERATING'),
		[lineItemsResponse?.data]
	);

	const summary = lineItemsResponse?.summary;

	// KPI values
	const kpiValues = useMemo(() => {
		if (!summary) {
			return {
				totalOperating: 0,
				totalDepreciation: 0,
				financeNet: 0,
				opexPercentOfRevenue: 0,
				totalNonOperating: 0,
			};
		}

		const financeIncome = new Decimal(summary.totalFinanceIncome || '0');
		const financeCosts = new Decimal(summary.totalFinanceCosts || '0');
		const financeNet = financeIncome.minus(financeCosts);

		return {
			totalOperating: new Decimal(summary.totalOperating || '0').toNumber(),
			totalDepreciation: new Decimal(summary.totalDepreciation || '0').toNumber(),
			financeNet: financeNet.toNumber(),
			opexPercentOfRevenue: 0,
			totalNonOperating: new Decimal(summary.totalNonOperating || '0').toNumber(),
		};
	}, [summary]);

	// Status strip values
	const staleModules = useMemo(
		() => currentVersion?.staleModules ?? [],
		[currentVersion?.staleModules]
	);

	// Monthly update handler
	const handleMonthlyUpdate = useCallback(
		(lineItemId: number, month: number, amount: string) => {
			updateMonthlyMutation.mutate([{ lineItemId, month, amount }]);
		},
		[updateMonthlyMutation]
	);

	// Comment update handler
	const handleCommentUpdate = useCallback(
		(lineItemId: number, comment: string) => {
			const allItems = lineItemsResponse?.data ?? [];
			const item = allItems.find((i) => i.id === lineItemId);
			if (!item) return;

			bulkUpdateMutation.mutate({
				lineItems: [
					{
						id: item.id,
						sectionType: item.sectionType,
						ifrsCategory: item.ifrsCategory,
						lineItemName: item.lineItemName,
						displayOrder: item.displayOrder,
						computeMethod: item.computeMethod,
						comment,
						monthlyAmounts: item.monthlyAmounts,
					},
				],
			});
		},
		[lineItemsResponse?.data, bulkUpdateMutation]
	);

	const handleTabChange = useCallback((value: string) => {
		setActiveTab(value as OpExTab);
	}, []);

	if (!versionId) {
		return (
			<EmptyState
				icon={FileSpreadsheet}
				title="No version selected"
				description="Select a version from the context bar to begin operating expenses planning."
			/>
		);
	}

	return (
		<PageTransition>
			<div className="flex h-full min-h-0 flex-col overflow-hidden">
				{/* Conditional banners */}
				{isLocked && versionStatus && (
					<div
						className={cn(
							'animate-stagger-reveal shrink-0',
							'border-b border-(--color-info) bg-(--color-info-bg) px-6 py-3'
						)}
					>
						<p className="text-sm font-semibold text-(--color-info)">
							This version is locked. Operating expenses data is read-only.
						</p>
					</div>
				)}
				{isViewer && (
					<div
						className={cn(
							'animate-stagger-reveal shrink-0',
							'border-b border-(--color-info) bg-(--color-info-bg) px-6 py-3'
						)}
					>
						<p className="text-sm font-semibold text-(--color-info)">You have view-only access.</p>
					</div>
				)}
				{isUncalculated && (
					<div
						className={cn(
							'animate-stagger-reveal shrink-0',
							'border-b border-(--color-warning) bg-(--color-warning-bg) px-6 py-3'
						)}
					>
						<p className="text-sm font-semibold text-(--color-warning)">
							Operating expenses have not been calculated. Click Calculate to generate.
						</p>
					</div>
				)}

				{/* Toolbar */}
				<div className="flex shrink-0 items-center justify-between border-b border-(--workspace-border) px-6 py-2">
					<div className="flex items-center gap-3">
						<Tabs value={activeTab} onValueChange={handleTabChange}>
							<TabsList>
								{OPEX_TABS.map((tab) => (
									<TabsTrigger key={tab.value} value={tab.value}>
										<span className="flex items-center gap-1.5">
											{tab.label}
											{tab.value === 'operating' && isStale && <StalePill label="Stale" />}
										</span>
									</TabsTrigger>
								))}
							</TabsList>
						</Tabs>
					</div>

					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() => setExportOpen(true)}
							className="no-print"
						>
							<Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
							Export
						</Button>
						{isEditable && (
							<CalculateButton
								onCalculate={() => calculateMutation.mutate()}
								isPending={calculateMutation.isPending}
								isSuccess={calculateMutation.isSuccess}
								isError={calculateMutation.isError}
								disabled={isUpstreamStale}
							/>
						)}
					</div>
				</div>

				{/* Status strip */}
				<div className="shrink-0 border-b border-(--workspace-border)">
					<OpExStatusStrip
						lastCalculatedAt={currentVersion?.lastCalculatedAt ?? null}
						staleModules={staleModules}
						operatingLineCount={operatingItems.length}
						nonOperatingLineCount={nonOperatingItems.length}
					/>
				</div>

				{/* KPI ribbon */}
				<div className="shrink-0 px-6 py-3">
					<OpExKpiRibbon
						totalOperating={kpiValues.totalOperating}
						totalDepreciation={kpiValues.totalDepreciation}
						financeNet={kpiValues.financeNet}
						opexPercentOfRevenue={kpiValues.opexPercentOfRevenue}
						totalNonOperating={kpiValues.totalNonOperating}
						isStale={isStale}
					/>
				</div>

				{/* Tab content zone */}
				<div className="flex-1 min-h-0 overflow-hidden px-6 py-2">
					{isLoading && (
						<div className="flex h-full items-center justify-center">
							<div className="flex items-center gap-3 text-(--text-muted)">
								<div className="h-5 w-5 animate-spin rounded-full border-2 border-(--accent-200) border-t-(--accent-500)" />
								<span className="text-sm">Loading operating expenses...</span>
							</div>
						</div>
					)}

					{!isLoading && activeTab === 'operating' && operatingItems.length > 0 && (
						<div className="h-full animate-stagger-reveal">
							<OpExGrid
								lineItems={operatingItems}
								monthlyTotals={summary?.monthlyOperatingTotals ?? []}
								isEditable={isEditable}
								onMonthlyUpdate={handleMonthlyUpdate}
								onCommentUpdate={handleCommentUpdate}
							/>
						</div>
					)}

					{!isLoading && activeTab === 'non-operating' && nonOperatingItems.length > 0 && (
						<div className="h-full animate-stagger-reveal">
							<NonOperatingGrid
								lineItems={nonOperatingItems}
								monthlyTotals={summary?.monthlyNonOperatingTotals ?? []}
								isEditable={isEditable}
								onMonthlyUpdate={handleMonthlyUpdate}
								onCommentUpdate={handleCommentUpdate}
							/>
						</div>
					)}

					{!isLoading && activeTab === 'operating' && operatingItems.length === 0 && (
						<EmptyState
							icon={FileSpreadsheet}
							title="No operating expense line items"
							description="Click Calculate to generate operating expense line items from the budget template."
						/>
					)}

					{!isLoading && activeTab === 'non-operating' && nonOperatingItems.length === 0 && (
						<EmptyState
							icon={FileSpreadsheet}
							title="No non-operating items"
							description="Click Calculate to generate non-operating items from the budget template."
						/>
					)}
				</div>
			</div>

			<ExportDialog open={exportOpen} onOpenChange={setExportOpen} defaultReportType="OPEX" />
		</PageTransition>
	);
}
