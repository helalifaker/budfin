import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import type { AcademicPeriod } from '@budfin/types';
import { useWorkspaceContext } from '../../hooks/use-workspace-context';
import { useAuthStore } from '../../stores/auth-store';
import { useRightPanelStore } from '../../stores/right-panel-store';
import { useEnrollmentSelectionStore } from '../../stores/enrollment-selection-store';
import {
	useHeadcount,
	useCalculateEnrollment,
	useEnrollmentCapacityResults,
	useHistorical,
} from '../../hooks/use-enrollment';
import { useVersions } from '../../hooks/use-versions';
import { useGradeLevels } from '../../hooks/use-grade-levels';
import { useCohortParameters } from '../../hooks/use-cohort-parameters';
import { Button } from '../../components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '../../components/ui/toggle-group';
import { WorkspaceBoard } from '../../components/shared/workspace-board';
import { WorkspaceBlock } from '../../components/shared/workspace-block';
import { EnrollmentKpiRibbon } from '../../components/enrollment/kpi-ribbon';
import { CohortProgressionGrid } from '../../components/enrollment/cohort-progression-grid';
import { NationalityDistributionGrid } from '../../components/enrollment/nationality-distribution-grid';
import { CapacityGrid } from '../../components/enrollment/capacity-grid';
import { HistoricalChart } from '../../components/enrollment/historical-chart';
import { CalculateButton } from '../../components/enrollment/calculate-button';
import { PageTransition } from '../../components/shared/page-transition';
import { VersionLockBanner } from '../../components/enrollment/version-lock-banner';
import { EnrollmentSetupWizard } from '../../components/enrollment/setup-wizard';
import { deriveEnrollmentEditability } from '../../lib/enrollment-workspace';
import '../../components/enrollment/enrollment-inspector';

const BAND_FILTERS: Array<{ value: string; label: string }> = [
	{ value: 'ALL', label: 'All' },
	{ value: 'MATERNELLE', label: 'Mat' },
	{ value: 'ELEMENTAIRE', label: 'Elem' },
	{ value: 'COLLEGE', label: 'Col' },
	{ value: 'LYCEE', label: 'Lyc' },
];

export function EnrollmentPage() {
	const { versionId, fiscalYear, academicPeriod, versionStatus, versionName, versionDataSource } =
		useWorkspaceContext();
	const user = useAuthStore((state) => state.user);
	const setActivePage = useRightPanelStore((state) => state.setActivePage);
	const isPanelOpen = useRightPanelStore((state) => state.isOpen);
	const clearSelection = useEnrollmentSelectionStore((state) => state.clearSelection);
	const navigate = useNavigate();

	const [bandFilter, setBandFilter] = useState('ALL');
	const [historyOpen, setHistoryOpen] = useState(false);
	const [wizardOpen, setWizardOpen] = useState(false);
	const autoPromptedVersionRef = useRef<number | null>(null);

	const { data: headcountData } = useHeadcount(versionId, academicPeriod as AcademicPeriod | null);
	const { data: setupHeadcountData } = useHeadcount(versionId);
	const { data: gradeLevelsData } = useGradeLevels();
	const { data: cohortData } = useCohortParameters(versionId);
	const { data: capacityResultsData } = useEnrollmentCapacityResults(versionId);
	const calculateMutation = useCalculateEnrollment(versionId);
	const { data: versionsData } = useVersions(fiscalYear);
	const { data: historicalData } = useHistorical(5);

	useEffect(() => {
		setActivePage('enrollment');
		return () => {
			setActivePage(null);
			clearSelection();
		};
	}, [setActivePage, clearSelection]);

	useEffect(() => {
		if (!isPanelOpen) {
			clearSelection();
		}
	}, [isPanelOpen, clearSelection]);

	const currentVersion = useMemo(() => {
		if (!versionId || !versionsData?.data) {
			return null;
		}
		return versionsData.data.find((version) => version.id === versionId) ?? null;
	}, [versionId, versionsData]);

	const editability = deriveEnrollmentEditability({
		role: user?.role ?? null,
		versionStatus: currentVersion?.status ?? versionStatus,
		dataSource: currentVersion?.dataSource ?? versionDataSource,
	});
	const isReadOnly = editability !== 'editable';
	const isImported = editability === 'imported';
	const isLocked = editability === 'locked';
	const isViewer = editability === 'viewer';
	const isStale = currentVersion?.staleModules?.includes('ENROLLMENT') ?? false;

	const expectedGradeCount = gradeLevelsData?.gradeLevels.length ?? 0;
	const ay1Entries = useMemo(
		() => setupHeadcountData?.entries.filter((entry) => entry.academicPeriod === 'AY1') ?? [],
		[setupHeadcountData]
	);
	const ay1EntryCount = useMemo(
		() => new Set(ay1Entries.map((entry) => entry.gradeLevel)).size,
		[ay1Entries]
	);
	const hasCompleteAy1 = expectedGradeCount > 0 && ay1EntryCount === expectedGradeCount;
	const hasPersistedCohorts =
		cohortData?.entries
			.filter((entry) => entry.gradeLevel !== 'PS')
			.every((entry) => entry.isPersisted) ?? false;
	const isSetupComplete = hasCompleteAy1 && hasPersistedCohorts;

	useEffect(() => {
		if (!versionId) {
			autoPromptedVersionRef.current = null;
			const frameId = window.requestAnimationFrame(() => {
				setWizardOpen(false);
			});
			return () => window.cancelAnimationFrame(frameId);
		}

		if (editability !== 'editable' || isSetupComplete) {
			return;
		}

		if (autoPromptedVersionRef.current === versionId) {
			return;
		}

		autoPromptedVersionRef.current = versionId;
		const frameId = window.requestAnimationFrame(() => {
			setWizardOpen(true);
		});
		return () => window.cancelAnimationFrame(frameId);
	}, [versionId, editability, isSetupComplete]);

	const historicalTotals = useMemo(() => {
		if (!historicalData?.data) {
			return undefined;
		}
		const totalsByYear = new Map<number, number>();
		for (const point of historicalData.data) {
			totalsByYear.set(
				point.academicYear,
				(totalsByYear.get(point.academicYear) ?? 0) + point.headcount
			);
		}
		return [...totalsByYear.entries()]
			.sort(([leftYear], [rightYear]) => leftYear - rightYear)
			.map(([, total]) => total);
	}, [historicalData]);

	const previousYearTotal =
		historicalTotals && historicalTotals.length >= 2
			? historicalTotals[historicalTotals.length - 1]
			: undefined;

	const capacityResults = useMemo(
		() => capacityResultsData?.results ?? calculateMutation.data?.results ?? [],
		[calculateMutation.data?.results, capacityResultsData?.results]
	);

	const kpiData = useMemo(() => {
		const ay1Total = ay1Entries.reduce((sum, entry) => sum + entry.headcount, 0);
		const ay2Total = (headcountData?.entries ?? [])
			.filter((entry) => entry.academicPeriod === 'AY2')
			.reduce((sum, entry) => sum + entry.headcount, 0);
		const alertCount = capacityResults.filter(
			(result) => result.alert === 'OVER' || result.alert === 'NEAR_CAP'
		).length;
		const utilizationPct =
			capacityResults.length > 0
				? capacityResults.reduce((sum, result) => sum + result.utilization, 0) /
					capacityResults.length
				: 0;

		return {
			totalAy1: ay1Total,
			totalAy2: ay2Total,
			utilizationPct,
			alertCount,
			isStale,
		};
	}, [ay1Entries, headcountData, capacityResults, isStale]);

	if (!versionId) {
		return (
			<div className="flex h-64 items-center justify-center text-(--text-muted)">
				Select a version from the context bar to begin enrollment planning.
			</div>
		);
	}

	return (
		<PageTransition>
			<div className="space-y-4">
				{isLocked && versionStatus && (
					<VersionLockBanner status={versionStatus} versionName={versionName ?? undefined} />
				)}
				{isImported && (
					<div className="rounded-xl border border-(--color-warning) bg-(--color-warning-bg) px-4 py-3">
						<p className="text-(--text-sm) font-semibold text-(--color-warning)">
							Imported versions are review-only for Enrollment.
						</p>
						<p className="mt-1 text-(--text-sm) text-(--text-secondary)">
							Use the wizard on an editable Budget or Forecast version to validate baseline data
							before applying changes.
						</p>
						<div className="mt-3">
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => navigate('/management/versions')}
							>
								Open Version Management
							</Button>
						</div>
					</div>
				)}
				{isViewer && (
					<div className="rounded-xl border border-(--color-info) bg-(--color-info-bg) px-4 py-3">
						<p className="text-(--text-sm) font-semibold text-(--color-info)">
							Viewer access keeps this workspace in review mode.
						</p>
						<p className="mt-1 text-(--text-sm) text-(--text-secondary)">
							You can inspect assumptions and results, but edits and calculations are disabled.
						</p>
					</div>
				)}

				<WorkspaceBoard
					title="Enrollment Control Workspace"
					description="Validate baseline data, confirm cohort assumptions, and keep the grid reserved for smaller operational edits."
					actions={
						<>
							<ToggleGroup
								type="single"
								value={bandFilter}
								onValueChange={(value) => {
									if (value) {
										setBandFilter(value);
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
							<Button type="button" variant="outline" size="sm" onClick={() => setWizardOpen(true)}>
								{isSetupComplete ? 'Reopen Setup Wizard' : 'Resume Setup Wizard'}
							</Button>
							{editability === 'editable' && (
								<CalculateButton
									versionId={versionId}
									onCalculate={() => calculateMutation.mutate()}
									isPending={calculateMutation.isPending}
									isSuccess={calculateMutation.isSuccess}
									isError={calculateMutation.isError}
								/>
							)}
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => setHistoryOpen((current) => !current)}
							>
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
						title="Cohort Progression"
						count={headcountData?.entries.length ?? 0}
						isStale={isStale}
					>
						<CohortProgressionGrid
							versionId={versionId}
							bandFilter={bandFilter}
							isReadOnly={isReadOnly}
						/>
					</WorkspaceBlock>

					<WorkspaceBlock title="Nationality Distribution" isStale={isStale}>
						<NationalityDistributionGrid versionId={versionId} bandFilter={bandFilter} isReadOnly />
					</WorkspaceBlock>

					<WorkspaceBlock title="Capacity Planning" count={capacityResults.length}>
						<CapacityGrid
							versionId={versionId}
							bandFilter={bandFilter}
							capacityResults={capacityResults}
						/>
					</WorkspaceBlock>

					{historyOpen && <HistoricalChart />}
				</WorkspaceBoard>
			</div>

			<EnrollmentSetupWizard
				open={wizardOpen}
				versionId={versionId}
				versionName={versionName}
				editability={editability}
				onClose={() => setWizardOpen(false)}
			/>
		</PageTransition>
	);
}
