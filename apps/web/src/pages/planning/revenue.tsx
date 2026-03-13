import { useEffect, useMemo, useState } from 'react';
import Decimal from 'decimal.js';
import { ToggleGroup, ToggleGroupItem } from '../../components/ui/toggle-group';
import { Button } from '../../components/ui/button';
import { PageTransition } from '../../components/shared/page-transition';
import { VersionLockBanner } from '../../components/enrollment/version-lock-banner';
import { ForecastGrid } from '../../components/revenue/forecast-grid';
import { RevenueExportButton } from '../../components/revenue/revenue-export-button';
import { RevenueKpiRibbon } from '../../components/revenue/kpi-ribbon';
import { RevenueSettingsDialog } from '../../components/revenue/revenue-settings-dialog';
import { RevenueSetupChecklist } from '../../components/revenue/setup-checklist';
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

function ImportedBanner() {
	return (
		<div className="rounded-lg border border-(--color-info) bg-(--color-info-bg) px-3 py-2 text-(--text-sm) text-(--color-info)">
			This version was imported. Review the loaded assumptions before recalculating revenue.
		</div>
	);
}

function ViewerBanner() {
	return (
		<div className="rounded-lg border border-(--workspace-border) bg-(--workspace-bg-subtle) px-3 py-2 text-(--text-sm) text-(--text-secondary)">
			Viewer access keeps this workspace in review mode.
		</div>
	);
}

export function RevenuePage() {
	const { versionId, fiscalYear, academicPeriod, setAcademicPeriod, versionStatus, versionName } =
		useWorkspaceContext();
	const user = useAuthStore((state) => state.user);
	const isViewer = user?.role === 'Viewer';
	const [viewMode, setViewMode] = useState<'category' | 'grade' | 'nationality' | 'tariff'>(
		'category'
	);
	const [setupOpen, setSetupOpen] = useState(false);
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
			<div className="space-y-4 pb-6">
				{(currentVersion?.status ?? versionStatus) !== 'Draft' && (
					<VersionLockBanner
						status={currentVersion?.status ?? versionStatus ?? 'Draft'}
						versionName={currentVersion?.name ?? versionName ?? undefined}
					/>
				)}
				{currentVersion?.dataSource === 'IMPORTED' && <ImportedBanner />}
				{isViewer && <ViewerBanner />}

				<div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-(--workspace-border) bg-(--workspace-bg-card) px-4 py-3 shadow-(--shadow-xs)">
					<div className="flex flex-wrap items-center gap-3">
						<ToggleGroup
							type="single"
							value={viewMode}
							onValueChange={(value) => {
								if (value) {
									setViewMode(value as 'category' | 'grade' | 'nationality' | 'tariff');
									clearSelection();
								}
							}}
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
					</div>

					<div className="flex flex-wrap items-center gap-2">
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
						<Button type="button" variant="outline" size="sm" onClick={() => setSetupOpen(true)}>
							Setup
						</Button>
						{!isViewer && (
							<Button
								type="button"
								size="sm"
								disabled={calculateMutation.isPending}
								onClick={() => calculateMutation.mutate()}
							>
								{calculateMutation.isPending ? 'Calculating...' : 'Calculate Revenue'}
							</Button>
						)}
					</div>
				</div>

				<RevenueKpiRibbon
					grossHt={revenueResults?.totals.grossRevenueHt ?? '0.0000'}
					totalDiscounts={revenueResults?.totals.discountAmount ?? '0.0000'}
					netRevenue={revenueResults?.totals.netRevenueHt ?? '0.0000'}
					otherRevenue={revenueResults?.totals.otherRevenueAmount ?? '0.0000'}
					totalOperatingRevenue={revenueResults?.totals.totalOperatingRevenue ?? '0.0000'}
					avgPerStudent={avgPerStudent}
					isStale={isStale}
				/>

				<RevenueStatusStrip
					lastCalculated={currentVersion?.lastCalculatedAt ?? null}
					enrollmentStale={enrollmentStale}
					downstreamStale={downstreamStale}
					readiness={readiness}
				/>

				<ForecastGrid versionId={versionId} viewMode={viewMode} period={period} />

				{readiness && (
					<RevenueSetupChecklist
						versionId={versionId}
						lastCalculatedAt={currentVersion?.lastCalculatedAt}
						readiness={readiness}
						forceOpen={setupOpen}
						onClose={() => setSetupOpen(false)}
					/>
				)}

				<RevenueSettingsDialog versionId={versionId} isViewer={isViewer} />
			</div>
		</PageTransition>
	);
}
