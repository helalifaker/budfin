import { useEffect, useMemo, useState } from 'react';
import Decimal from 'decimal.js';
import { ToggleGroup, ToggleGroupItem } from '../../components/ui/toggle-group';
import { Button } from '../../components/ui/button';
import { PageTransition } from '../../components/shared/page-transition';
import { CalculateButton } from '../../components/shared/calculate-button';
import { VersionLockBanner } from '../../components/enrollment/version-lock-banner';
import { ForecastGrid } from '../../components/revenue/forecast-grid';
import { RevenueExportButton } from '../../components/revenue/revenue-export-button';
import {
	RevenueExceptionFilter,
	type RevenueExceptionFilterValue,
} from '../../components/revenue/revenue-exception-filter';
import { RevenueKpiRibbon } from '../../components/revenue/kpi-ribbon';
import { RevenueSettingsDialog } from '../../components/revenue/revenue-settings-dialog';
import { RevenueStatusStrip } from '../../components/revenue/revenue-status-strip';
import { useGradeLevels } from '../../hooks/use-grade-levels';
import { useWorkspaceContext } from '../../hooks/use-workspace-context';
import { useHeadcount } from '../../hooks/use-enrollment';
import {
	useRevenueReadiness,
	useRevenueResults,
	useCalculateRevenue,
} from '../../hooks/use-revenue';
import { useVersions } from '../../hooks/use-versions';
import {
	buildRevenueForecastGridRows,
	type RevenueForecastPeriod,
} from '../../lib/revenue-workspace';
import { useRightPanelStore } from '../../stores/right-panel-store';
import { useRevenueSelectionStore } from '../../stores/revenue-selection-store';
import { useRevenueSettingsDialogStore } from '../../stores/revenue-settings-dialog-store';
import { useAuthStore } from '../../stores/auth-store';
import '../../components/revenue/revenue-inspector';
import '../../components/revenue/revenue-guide-content';

type ViewMode = 'category' | 'grade' | 'nationality' | 'tariff';
type BandFilter = 'ALL' | 'MATERNELLE' | 'ELEMENTAIRE' | 'COLLEGE' | 'LYCEE';

const BAND_FILTERS: Array<{ value: BandFilter; label: string }> = [
	{ value: 'ALL', label: 'All' },
	{ value: 'MATERNELLE', label: 'Mat' },
	{ value: 'ELEMENTAIRE', label: 'Elem' },
	{ value: 'COLLEGE', label: 'Col' },
	{ value: 'LYCEE', label: 'Lyc' },
];

function ImportedBanner() {
	return (
		<div className="shrink-0 border-b border-(--color-info) bg-(--color-info-bg) px-4 py-3 text-(--text-sm) text-(--color-info)">
			This version was imported. Review the loaded assumptions before recalculating revenue.
		</div>
	);
}

function ViewerBanner() {
	return (
		<div className="shrink-0 border-b border-(--workspace-border) bg-(--workspace-bg-subtle) px-4 py-3 text-(--text-sm) text-(--text-secondary)">
			Viewer access keeps this workspace in review mode.
		</div>
	);
}

export function RevenuePage() {
	const { versionId, fiscalYear, academicPeriod, setAcademicPeriod, versionStatus, versionName } =
		useWorkspaceContext();
	const user = useAuthStore((state) => state.user);
	const isViewer = user?.role === 'Viewer';
	const [viewMode, setViewMode] = useState<ViewMode>('category');
	const [bandFilter, setBandFilter] = useState<BandFilter>('ALL');
	const [exceptionFilter, setExceptionFilter] = useState<RevenueExceptionFilterValue>('all');
	const setActivePage = useRightPanelStore((state) => state.setActivePage);
	const clearSelection = useRevenueSelectionStore((state) => state.clearSelection);
	const openSettings = useRevenueSettingsDialogStore((state) => state.open);
	const { data: versionsData } = useVersions(fiscalYear);
	const { data: revenueResults } = useRevenueResults(versionId, 'category');
	const { data: readiness } = useRevenueReadiness(versionId);
	const { data: headcountData } = useHeadcount(versionId);
	const { data: gradeLevelsData } = useGradeLevels();
	const calculateMutation = useCalculateRevenue(versionId);

	useEffect(() => {
		setActivePage('revenue');
		return () => {
			setActivePage(null);
			clearSelection();
		};
	}, [clearSelection, setActivePage]);

	function handleViewModeChange(value: string) {
		if (!value) {
			return;
		}

		const nextMode = value as ViewMode;
		setViewMode(nextMode);
		clearSelection();
		if (nextMode !== 'grade') {
			setBandFilter('ALL');
		}
	}

	const period = useMemo<RevenueForecastPeriod>(() => {
		return academicPeriod === 'AY1' || academicPeriod === 'AY2' ? academicPeriod : 'both';
	}, [academicPeriod]);

	const currentVersion = useMemo(() => {
		if (!versionId) {
			return null;
		}

		return versionsData?.data.find((version) => version.id === versionId) ?? null;
	}, [versionId, versionsData?.data]);

	const isStale = currentVersion?.staleModules?.includes('REVENUE') ?? false;
	const enrollmentStale = currentVersion?.staleModules?.includes('ENROLLMENT') ?? false;
	const isImported = currentVersion?.dataSource === 'IMPORTED';
	const downstreamStale = (currentVersion?.staleModules ?? []).filter(
		(moduleName) => moduleName === 'STAFFING' || moduleName === 'PNL'
	);
	const totalAy1Headcount =
		headcountData?.entries
			.filter((entry) => entry.academicPeriod === 'AY1')
			.reduce((sum, entry) => sum + entry.headcount, 0) ?? 0;
	const avgPerStudent =
		revenueResults && totalAy1Headcount > 0
			? new Decimal(revenueResults.totals.totalOperatingRevenue).div(totalAy1Headcount).toFixed(0)
			: '0.0000';
	const exportRows = useMemo(
		() =>
			buildRevenueForecastGridRows({
				data: revenueResults,
				viewMode,
				gradeLevels: gradeLevelsData?.gradeLevels,
			}),
		[gradeLevelsData?.gradeLevels, revenueResults, viewMode]
	);

	if (!versionId) {
		return (
			<PageTransition>
				<div className="flex h-64 items-center justify-center text-(--text-muted)">
					Select a version from the context bar to begin revenue planning.
				</div>
			</PageTransition>
		);
	}

	return (
		<PageTransition>
			<div className="flex h-full min-h-0 flex-col overflow-hidden">
				{/* Conditional banners */}
				{(currentVersion?.status ?? versionStatus) !== 'Draft' && (
					<VersionLockBanner
						status={currentVersion?.status ?? versionStatus ?? 'Draft'}
						versionName={currentVersion?.name ?? versionName ?? undefined}
					/>
				)}
				{isImported && <ImportedBanner />}
				{isViewer && <ViewerBanner />}

				{/* Toolbar */}
				<div className="flex shrink-0 items-center justify-between border-b border-(--workspace-border) px-6 py-2">
					<div className="flex items-center gap-3">
						<ToggleGroup
							type="single"
							value={viewMode}
							onValueChange={handleViewModeChange}
							aria-label="Revenue view mode"
						>
							<ToggleGroupItem value="category">Category</ToggleGroupItem>
							<ToggleGroupItem value="grade">Grade</ToggleGroupItem>
							<ToggleGroupItem value="nationality">Nationality</ToggleGroupItem>
							<ToggleGroupItem value="tariff">Tariff</ToggleGroupItem>
						</ToggleGroup>

						<ToggleGroup
							type="single"
							value={period}
							onValueChange={(value) => setAcademicPeriod(value || 'both')}
							aria-label="Revenue period"
						>
							<ToggleGroupItem value="AY1">AY1</ToggleGroupItem>
							<ToggleGroupItem value="AY2">AY2</ToggleGroupItem>
							<ToggleGroupItem value="both">FY2026</ToggleGroupItem>
						</ToggleGroup>

						{viewMode === 'grade' && (
							<ToggleGroup
								type="single"
								value={bandFilter}
								onValueChange={(value) => {
									if (value) {
										setBandFilter(value as BandFilter);
									}
								}}
								aria-label="Grade band filter"
							>
								{BAND_FILTERS.map((filter) => (
									<ToggleGroupItem key={filter.value} value={filter.value}>
										{filter.label}
									</ToggleGroupItem>
								))}
							</ToggleGroup>
						)}

						<RevenueExceptionFilter value={exceptionFilter} onChange={setExceptionFilter} />
					</div>

					<div className="flex items-center gap-2">
						<RevenueExportButton
							rows={exportRows}
							viewMode={viewMode}
							period={period}
							versionName={currentVersion?.name ?? 'revenue'}
						/>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => openSettings('feeGrid')}
						>
							{isViewer ? 'View Settings' : 'Revenue Settings'}
						</Button>
						{!isViewer && (
							<CalculateButton
								onCalculate={() => calculateMutation.mutate()}
								isPending={calculateMutation.isPending}
								isSuccess={calculateMutation.isSuccess}
								isError={calculateMutation.isError}
							/>
						)}
					</div>
				</div>

				{/* KPI ribbon */}
				<RevenueKpiRibbon
					grossHt={revenueResults?.totals.grossRevenueHt ?? '0.0000'}
					totalDiscounts={revenueResults?.totals.discountAmount ?? '0.0000'}
					netRevenue={revenueResults?.totals.netRevenueHt ?? '0.0000'}
					otherRevenue={revenueResults?.totals.otherRevenueAmount ?? '0.0000'}
					totalOperatingRevenue={revenueResults?.totals.totalOperatingRevenue ?? '0.0000'}
					avgPerStudent={avgPerStudent}
					isStale={isStale}
				/>

				{/* Status strip */}
				<RevenueStatusStrip
					lastCalculated={currentVersion?.lastCalculatedAt ?? null}
					enrollmentStale={enrollmentStale}
					downstreamStale={downstreamStale}
					readiness={readiness}
				/>

				{/* Grid zone */}
				<div className="flex-1 min-h-0 overflow-hidden px-6 py-2">
					<div className="h-full overflow-y-auto scrollbar-thin">
						<ForecastGrid versionId={versionId} viewMode={viewMode} period={period} />
					</div>
				</div>
			</div>

			<RevenueSettingsDialog
				versionId={versionId}
				isViewer={isViewer}
				readiness={readiness}
				isImported={isImported}
			/>
		</PageTransition>
	);
}
