import { useState, useMemo, useEffect } from 'react';
import { useWorkspaceContext } from '../../hooks/use-workspace-context';
import { useAuthStore } from '../../stores/auth-store';
import { useRightPanelStore } from '../../stores/right-panel-store';
import { useEnrollmentSelectionStore } from '../../stores/enrollment-selection-store';
import { useHeadcount, useCalculateEnrollment, useHistorical } from '../../hooks/use-enrollment';
import { useVersions } from '../../hooks/use-versions';
import { Button } from '../../components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '../../components/ui/toggle-group';
import { WorkspaceBoard } from '../../components/shared/workspace-board';
import { WorkspaceBlock } from '../../components/shared/workspace-block';
import { EnrollmentKpiRibbon } from '../../components/enrollment/kpi-ribbon';
import { CohortProgressionGrid } from '../../components/enrollment/cohort-progression-grid';
import { NationalityDistributionGrid } from '../../components/enrollment/nationality-distribution-grid';
import { CapacityGrid } from '../../components/enrollment/capacity-grid';
import { HistoricalChart } from '../../components/enrollment/historical-chart';
import { CsvImportPanel } from '../../components/enrollment/csv-import-panel';
import { CalculateButton } from '../../components/enrollment/calculate-button';
import { PageTransition } from '../../components/shared/page-transition';
import { VersionLockBanner } from '../../components/enrollment/version-lock-banner';
import '../../components/enrollment/enrollment-inspector';
import type { AcademicPeriod } from '@budfin/types';

const BAND_FILTERS: Array<{ value: string; label: string }> = [
	{ value: 'ALL', label: 'All' },
	{ value: 'MATERNELLE', label: 'Mat' },
	{ value: 'ELEMENTAIRE', label: 'Elem' },
	{ value: 'COLLEGE', label: 'Col' },
	{ value: 'LYCEE', label: 'Lyc' },
];

export function EnrollmentPage() {
	const { versionId, fiscalYear, academicPeriod, versionStatus, versionName } =
		useWorkspaceContext();
	const user = useAuthStore((s) => s.user);
	const isViewer = user?.role === 'Viewer';
	const isReadOnly = isViewer || (versionStatus !== 'Draft' && versionStatus !== undefined);

	const setActivePage = useRightPanelStore((s) => s.setActivePage);
	const isOpen = useRightPanelStore((s) => s.isOpen);
	const clearSelection = useEnrollmentSelectionStore((s) => s.clearSelection);

	useEffect(() => {
		setActivePage('enrollment');
		return () => {
			setActivePage(null);
			clearSelection();
		};
	}, [setActivePage, clearSelection]);

	useEffect(() => {
		if (!isOpen) {
			clearSelection();
		}
	}, [isOpen, clearSelection]);

	const [bandFilter, setBandFilter] = useState('ALL');
	const [importOpen, setImportOpen] = useState(false);
	const [historyOpen, setHistoryOpen] = useState(false);

	const { data: headcountData } = useHeadcount(versionId, academicPeriod as AcademicPeriod | null);
	const calculateMutation = useCalculateEnrollment(versionId);
	const { data: versionsData } = useVersions(fiscalYear);
	const { data: historicalData } = useHistorical(5);

	const currentVersion = useMemo(() => {
		if (!versionId || !versionsData?.data) return null;
		return versionsData.data.find((v) => v.id === versionId) ?? null;
	}, [versionId, versionsData]);

	const isStale = currentVersion?.staleModules?.includes('ENROLLMENT') ?? false;

	const historicalTotals = useMemo(() => {
		if (!historicalData?.data) return undefined;
		const yearMap = new Map<number, number>();
		for (const dp of historicalData.data) {
			yearMap.set(dp.academicYear, (yearMap.get(dp.academicYear) ?? 0) + dp.headcount);
		}
		return [...yearMap.entries()].sort(([a], [b]) => a - b).map(([, total]) => total);
	}, [historicalData]);

	const previousYearTotal =
		historicalTotals && historicalTotals.length >= 2
			? (historicalTotals[historicalTotals.length - 1] ?? undefined)
			: undefined;

	const kpiData = useMemo(() => {
		const entries = headcountData?.entries ?? [];
		const ay1Total = entries
			.filter((e) => e.academicPeriod === 'AY1')
			.reduce((sum, e) => sum + e.headcount, 0);
		const ay2Total = entries
			.filter((e) => e.academicPeriod === 'AY2')
			.reduce((sum, e) => sum + e.headcount, 0);

		const results = calculateMutation.data?.results ?? [];
		const overCount = results.filter((r) => r.alert === 'OVER' || r.alert === 'NEAR_CAP').length;

		let avgUtil = 0;
		if (results.length > 0) {
			avgUtil = results.reduce((sum, r) => sum + r.utilization, 0) / results.length;
		}

		return {
			totalAy1: ay1Total,
			totalAy2: ay2Total,
			utilizationPct: avgUtil,
			alertCount: overCount,
			isStale,
		};
	}, [headcountData, calculateMutation.data, isStale]);

	const capacityCount = calculateMutation.data?.results?.length ?? 0;

	if (!versionId) {
		return (
			<div className="flex h-64 items-center justify-center text-(--text-muted)">
				Select a version from the context bar to begin enrollment planning.
			</div>
		);
	}

	return (
		<PageTransition>
			{isReadOnly && versionStatus && versionStatus !== 'Draft' && (
				<VersionLockBanner status={versionStatus} versionName={versionName ?? undefined} />
			)}
			<WorkspaceBoard
				title="Enrollment & Capacity"
				description="Configure cohort progression, nationality distribution, and capacity planning."
				actions={
					<>
						<ToggleGroup
							type="single"
							value={bandFilter}
							onValueChange={(val) => {
								if (val) setBandFilter(val);
							}}
							aria-label="Grade band filter"
						>
							{BAND_FILTERS.map((f) => (
								<ToggleGroupItem key={f.value} value={f.value}>
									{f.label}
								</ToggleGroupItem>
							))}
						</ToggleGroup>

						{!isReadOnly && (
							<>
								<CalculateButton
									versionId={versionId}
									onCalculate={() => calculateMutation.mutate()}
									isPending={calculateMutation.isPending}
									isSuccess={calculateMutation.isSuccess}
									isError={calculateMutation.isError}
								/>
								<Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
									Import CSV
								</Button>
							</>
						)}

						<Button variant="outline" size="sm" onClick={() => setHistoryOpen(!historyOpen)}>
							{historyOpen ? 'Hide History' : 'Show History'}
						</Button>
					</>
				}
				kpiRibbon={
					<EnrollmentKpiRibbon
						{...kpiData}
						historicalTotals={historicalTotals}
						previousYearTotal={previousYearTotal}
					/>
				}
			>
				<WorkspaceBlock
					title="Cohort Progression (AY1 → AY2)"
					count={headcountData?.entries?.length ?? 0}
					isStale={isStale}
				>
					<CohortProgressionGrid
						versionId={versionId}
						bandFilter={bandFilter}
						isReadOnly={isReadOnly}
					/>
				</WorkspaceBlock>

				<WorkspaceBlock title="Nationality Distribution" isStale={isStale}>
					<NationalityDistributionGrid
						versionId={versionId}
						bandFilter={bandFilter}
						isReadOnly={isReadOnly}
					/>
				</WorkspaceBlock>

				<WorkspaceBlock title="Capacity Planning" count={capacityCount}>
					<CapacityGrid
						versionId={versionId}
						bandFilter={bandFilter}
						capacityResults={calculateMutation.data?.results}
					/>
				</WorkspaceBlock>

				{historyOpen && <HistoricalChart />}

				<CsvImportPanel open={importOpen} onClose={() => setImportOpen(false)} />
			</WorkspaceBoard>
		</PageTransition>
	);
}
