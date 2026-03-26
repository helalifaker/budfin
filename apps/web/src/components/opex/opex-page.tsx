import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Decimal from 'decimal.js';
import { Download, FileSpreadsheet, FolderInput, Settings2 } from 'lucide-react';
import { useWorkspaceContext } from '../../hooks/use-workspace-context';
import { useAuthStore } from '../../stores/auth-store';
import { useRightPanelStore } from '../../stores/right-panel-store';
import { useOpExSelectionStore } from '../../stores/opex-selection-store';
import { useOpExDirtyStore } from '../../stores/opex-dirty-store';
import { useGridUndoRedo } from '../../hooks/use-grid-undo-redo';
import { useVersions } from '../../hooks/use-versions';
import {
	useOpExLineItems,
	useUpdateOpExMonthly,
	useUpdateOpExLineItem,
	useBulkUpdateOpEx,
	useCalculateOpEx,
	useReorderOpExLineItem,
} from '../../hooks/use-opex';
import { useRevenueResults } from '../../hooks/use-revenue';
import { deriveStaffingEditability } from '../../lib/staffing-workspace';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import { cn } from '../../lib/cn';
import { Button } from '../ui/button';
import { PageTransition } from '../shared/page-transition';
import { CalculateButton } from '../shared/calculate-button';
import { EmptyState } from '../shared/empty-state';
import { ExportDialog } from '../shared/export-dialog';
import { StalePill } from '../shared/stale-pill';
import { OpExInitializeDialog } from './opex-initialize-dialog';
import { OpExKpiRibbon } from './opex-kpi-ribbon';
import { OpExSettingsDialog } from './opex-settings-dialog';
import { OpExStatusStrip } from './opex-status-strip';
import { OpExGrid } from './opex-grid';
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
	const setOverlay = useRightPanelStore((state) => state.setOverlay);
	const isPanelOpen = useRightPanelStore((state) => state.isOpen);
	const clearSelection = useOpExSelectionStore((s) => s.clearSelection);

	const { setDirty, getDirtyUpdates, flush: flushDirty } = useOpExDirtyStore();
	const pendingCount = useOpExDirtyStore((s) => s.dirtyMap.size);
	const undoRedo = useGridUndoRedo();
	const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const [activeTab, setActiveTab] = useState<OpExTab>('operating');
	const [exportOpen, setExportOpen] = useState(false);
	const [initializeOpen, setInitializeOpen] = useState(false);
	const [settingsOpen, setSettingsOpen] = useState(false);

	const { data: versionsData } = useVersions(fiscalYear);
	const { data: lineItemsResponse, isLoading } = useOpExLineItems(versionId);
	const { data: revenueData } = useRevenueResults(versionId);
	const { isUpstreamStale, ...calculateMutation } = useCalculateOpEx(versionId);
	const updateMonthlyMutation = useUpdateOpExMonthly(versionId);
	const patchMutation = useUpdateOpExLineItem(versionId);
	const bulkUpdateMutation = useBulkUpdateOpEx(versionId);
	const reorderMutation = useReorderOpExLineItem(versionId);

	// Register right panel on mount
	useEffect(() => {
		setActivePage('opex');
		setOverlay(true);
		return () => {
			setActivePage(null);
			setOverlay(false);
			clearSelection();
		};
	}, [clearSelection, setActivePage, setOverlay]);

	// Clear selection when panel closes
	useEffect(() => {
		if (!isPanelOpen) {
			clearSelection();
		}
	}, [clearSelection, isPanelOpen]);

	// Clean up flush timer on unmount
	useEffect(() => {
		return () => {
			if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
		};
	}, []);

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

	// Revenue total for KPI % calculation
	const totalRevenue = revenueData?.totals?.totalOperatingRevenue ?? '0';

	// KPI values
	const kpiValues = useMemo(() => {
		if (!summary) {
			return {
				totalOperating: 0,
				totalDepreciation: 0,
				financeNet: 0,
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
			totalNonOperating: new Decimal(summary.totalNonOperating || '0').toNumber(),
		};
	}, [summary]);

	// Status strip values
	const staleModules = useMemo(
		() => currentVersion?.staleModules ?? [],
		[currentVersion?.staleModules]
	);

	// Monthly update handler — debounced batch save via dirty store
	const handleMonthlyUpdate = useCallback(
		(lineItemId: number, month: number, amount: string) => {
			// Find old value for undo
			const allItems = lineItemsResponse?.data ?? [];
			const item = allItems.find((li) => li.id === lineItemId);
			const oldAmount = item?.monthlyAmounts?.find((m) => m.month === month)?.amount ?? '0';

			undoRedo.push({
				type: 'cell-edit',
				cellKey: `${lineItemId}-${month}`,
				oldValue: oldAmount,
				newValue: amount,
			});
			setDirty(lineItemId, month, amount);

			// Debounce: flush after 2 seconds of inactivity
			if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
			flushTimerRef.current = setTimeout(() => {
				const updates = getDirtyUpdates();
				if (updates.length > 0) {
					updateMonthlyMutation.mutate(updates, {
						onSuccess: () => {
							flushDirty();
							undoRedo.flush();
						},
					});
				}
			}, 2000);
		},
		[
			lineItemsResponse?.data,
			undoRedo,
			setDirty,
			getDirtyUpdates,
			flushDirty,
			updateMonthlyMutation,
		]
	);

	// Annual total update handler (for ANNUAL_SPREAD entry mode)
	const handleAnnualTotalUpdate = useCallback(
		(lineItemId: number, annualTotal: string) => {
			patchMutation.mutate({ lineItemId, patch: { annualTotal } });
		},
		[patchMutation]
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
						comment,
						monthlyAmounts: item.monthlyAmounts,
					},
				],
			});
		},
		[lineItemsResponse?.data, bulkUpdateMutation]
	);

	// Reorder handler for drag-and-drop
	const handleReorder = useCallback(
		(payload: Parameters<typeof reorderMutation.mutate>[0]) => {
			reorderMutation.mutate(payload);
		},
		[reorderMutation]
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
						{isEditable && (
							<Button
								variant="outline"
								size="sm"
								onClick={() => setInitializeOpen(true)}
								className="no-print"
							>
								<FolderInput className="mr-1.5 h-4 w-4" aria-hidden="true" />
								Initialize from...
							</Button>
						)}
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
							<Button
								variant="outline"
								size="sm"
								onClick={() => setSettingsOpen(true)}
								className="no-print"
								aria-label="OpEx Settings"
							>
								<Settings2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
								Settings
							</Button>
						)}
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
						unsavedCount={pendingCount}
					/>
				</div>

				{/* KPI ribbon */}
				<div className="shrink-0 px-6 py-3">
					<OpExKpiRibbon
						totalOperating={kpiValues.totalOperating}
						totalDepreciation={kpiValues.totalDepreciation}
						financeNet={kpiValues.financeNet}
						totalRevenue={totalRevenue}
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
								sectionType="OPERATING"
								lineItems={operatingItems}
								monthlyTotals={summary?.monthlyOperatingTotals ?? []}
								isEditable={isEditable}
								onMonthlyUpdate={handleMonthlyUpdate}
								onCommentUpdate={handleCommentUpdate}
								onAnnualTotalUpdate={handleAnnualTotalUpdate}
								onReorder={isEditable ? handleReorder : undefined}
							/>
						</div>
					)}

					{!isLoading && activeTab === 'non-operating' && nonOperatingItems.length > 0 && (
						<div className="h-full animate-stagger-reveal">
							<OpExGrid
								sectionType="NON_OPERATING"
								lineItems={nonOperatingItems}
								monthlyTotals={summary?.monthlyNonOperatingTotals ?? []}
								isEditable={isEditable}
								onMonthlyUpdate={handleMonthlyUpdate}
								onCommentUpdate={handleCommentUpdate}
								onAnnualTotalUpdate={handleAnnualTotalUpdate}
								onReorder={isEditable ? handleReorder : undefined}
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

			{versionId && (
				<OpExInitializeDialog
					open={initializeOpen}
					onOpenChange={setInitializeOpen}
					versionId={versionId}
					currentItemCount={(lineItemsResponse?.data ?? []).length}
				/>
			)}

			{versionId && (
				<OpExSettingsDialog
					open={settingsOpen}
					onOpenChange={setSettingsOpen}
					versionId={versionId}
					currentMonths={currentVersion?.schoolCalendarMonths ?? [1, 2, 3, 4, 5, 6, 9, 10, 11, 12]}
				/>
			)}
		</PageTransition>
	);
}
