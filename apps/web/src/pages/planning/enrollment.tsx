import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import type { GradeCode } from '@budfin/types';
import { useWorkspaceContext } from '../../hooks/use-workspace-context';
import { useAuthStore } from '../../stores/auth-store';
import { useRightPanelStore } from '../../stores/right-panel-store';
import { useEnrollmentSelectionStore } from '../../stores/enrollment-selection-store';
import { useDirtyRowsStore } from '../../stores/dirty-rows-store';
import {
	useCalculateEnrollment,
	useEnrollmentCapacityResults,
	useEnrollmentSettings,
	useHeadcount,
	useHistorical,
	usePutHeadcount,
} from '../../hooks/use-enrollment';
import { useVersions } from '../../hooks/use-versions';
import { useGradeLevels } from '../../hooks/use-grade-levels';
import { useCohortParameters, usePutCohortParameters } from '../../hooks/use-cohort-parameters';
import { Button } from '../../components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '../../components/ui/toggle-group';
import { EnrollmentKpiRibbon } from '../../components/enrollment/kpi-ribbon';
import { EnrollmentStatusStrip } from '../../components/enrollment/enrollment-status-strip';
import { EnrollmentMasterGrid } from '../../components/enrollment/enrollment-master-grid';
import { ExportButton } from '../../components/enrollment/export-button';
import {
	ExceptionFilterMenu,
	type ExceptionFilterValue,
} from '../../components/enrollment/exception-filter-menu';
import { CalculateButton } from '../../components/enrollment/calculate-button';
import { PageTransition } from '../../components/shared/page-transition';
import { VersionLockBanner } from '../../components/enrollment/version-lock-banner';
import { EnrollmentSetupWizard } from '../../components/enrollment/setup-wizard';
import { EnrollmentSettingsSheet } from '../../components/enrollment/enrollment-settings-sheet';
import {
	buildAy1HeadcountMap,
	buildCapacityPreviewRows,
	buildCohortProjectionRows,
	buildMasterGridRows,
	DEFAULT_PLANNING_RULES,
	deriveEnrollmentEditability,
	getPsAy2Headcount,
	resolveEnrollmentGradeLevels,
} from '../../lib/enrollment-workspace';
import '../../components/enrollment/enrollment-inspector';
import '../../components/enrollment/enrollment-guide-content';
import { useEnrollmentSettingsSheetStore } from '../../stores/enrollment-settings-store';

const BAND_FILTERS: Array<{ value: string; label: string }> = [
	{ value: 'ALL', label: 'All' },
	{ value: 'MATERNELLE', label: 'Mat' },
	{ value: 'ELEMENTAIRE', label: 'Elem' },
	{ value: 'COLLEGE', label: 'Col' },
	{ value: 'LYCEE', label: 'Lyc' },
];

export function EnrollmentPage() {
	const { versionId, fiscalYear, versionStatus, versionName, versionDataSource } =
		useWorkspaceContext();
	const user = useAuthStore((state) => state.user);
	const setActivePage = useRightPanelStore((state) => state.setActivePage);
	const isPanelOpen = useRightPanelStore((state) => state.isOpen);
	const clearSelection = useEnrollmentSelectionStore((state) => state.clearSelection);
	const selectGrade = useEnrollmentSelectionStore((state) => state.selectGrade);
	const selectedGrade =
		useEnrollmentSelectionStore((state) =>
			state.selection?.type === 'GRADE' ? state.selection.id : null
		) ?? null;
	const navigate = useNavigate();
	const dirtyCount = useDirtyRowsStore((state) => state.dirtyCount);
	const openEnrollmentSettings = useEnrollmentSettingsSheetStore((state) => state.open);

	const [bandFilter, setBandFilter] = useState('ALL');
	const [exceptionFilter, setExceptionFilter] = useState<ExceptionFilterValue>('all');
	const [quickEdit, setQuickEdit] = useState(false);
	const [wizardOpen, setWizardOpen] = useState(false);
	const autoPromptedVersionRef = useRef<number | null>(null);

	const { data: headcountData } = useHeadcount(versionId);
	const { data: historicalData } = useHistorical(5);
	const { data: gradeLevelsData } = useGradeLevels();
	const { data: cohortData } = useCohortParameters(versionId);
	const { data: capacityResultsData } = useEnrollmentCapacityResults(versionId);
	const { data: enrollmentSettingsData } = useEnrollmentSettings(versionId);
	const calculateMutation = useCalculateEnrollment(versionId);
	const putHeadcount = usePutHeadcount(versionId);
	const putCohortParameters = usePutCohortParameters(versionId);
	const { data: versionsData } = useVersions(fiscalYear);

	useEffect(() => {
		setActivePage('enrollment');
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

	const gradeLevels = useMemo(
		() =>
			resolveEnrollmentGradeLevels({
				gradeLevels: gradeLevelsData?.gradeLevels ?? [],
				capacityByGrade: enrollmentSettingsData?.capacityByGrade,
			}),
		[enrollmentSettingsData?.capacityByGrade, gradeLevelsData?.gradeLevels]
	);
	const headcountEntries = useMemo(() => headcountData?.entries ?? [], [headcountData?.entries]);
	const historicalEntries = useMemo(() => historicalData?.data ?? [], [historicalData?.data]);
	const cohortEntries = useMemo(() => cohortData?.entries ?? [], [cohortData?.entries]);
	const planningRules =
		enrollmentSettingsData?.rules ?? cohortData?.planningRules ?? DEFAULT_PLANNING_RULES;

	const expectedGradeCount = gradeLevels.length;
	const ay1HeadcountMap = useMemo(() => buildAy1HeadcountMap(headcountEntries), [headcountEntries]);
	const psDefaultAy2Intake =
		gradeLevels.find((gradeLevel) => gradeLevel.gradeCode === 'PS')?.defaultAy2Intake ?? null;
	const psAy2Headcount = getPsAy2Headcount(
		headcountEntries,
		ay1HeadcountMap,
		null,
		psDefaultAy2Intake
	);

	const projectionRows = useMemo(
		() =>
			buildCohortProjectionRows({
				gradeLevels,
				ay1HeadcountMap,
				cohortEntries,
				psAy2Headcount,
				planningRules,
				historicalEntries,
				targetFiscalYear: fiscalYear,
			}),
		[
			ay1HeadcountMap,
			cohortEntries,
			fiscalYear,
			gradeLevels,
			historicalEntries,
			planningRules,
			psAy2Headcount,
		]
	);
	const capacityPreviewRows = useMemo(
		() =>
			buildCapacityPreviewRows({
				gradeLevels,
				ay1HeadcountMap,
				projectionRows,
			}),
		[ay1HeadcountMap, gradeLevels, projectionRows]
	);
	const masterGridRows = useMemo(
		() =>
			buildMasterGridRows({
				gradeLevels,
				ay1HeadcountMap,
				cohortEntries,
				psAy2Headcount,
				capacityResults: capacityPreviewRows,
				planningRules,
				historicalEntries,
				targetFiscalYear: fiscalYear,
			}),
		[
			ay1HeadcountMap,
			capacityPreviewRows,
			cohortEntries,
			fiscalYear,
			gradeLevels,
			historicalEntries,
			planningRules,
			psAy2Headcount,
		]
	);
	const cohortMap = useMemo(
		() => new Map(cohortEntries.map((entry) => [entry.gradeLevel, entry])),
		[cohortEntries]
	);

	const filteredRows = useMemo(
		() =>
			masterGridRows.filter((row) => {
				if (bandFilter !== 'ALL' && row.band !== bandFilter) {
					return false;
				}

				if (exceptionFilter === 'all') {
					return true;
				}

				const tags = row.issueTags ?? [];
				return tags.includes(exceptionFilter);
			}),
		[bandFilter, exceptionFilter, masterGridRows]
	);

	const kpiData = useMemo(() => {
		const totalAy1 = masterGridRows.reduce((sum, row) => sum + row.ay1Headcount, 0);
		const totalAy2 = masterGridRows.reduce((sum, row) => sum + row.ay2Headcount, 0);
		const totalDelta = masterGridRows.reduce((sum, row) => sum + row.delta, 0);
		const utilizationPct =
			masterGridRows.length > 0
				? masterGridRows.reduce((sum, row) => sum + row.utilization, 0) / masterGridRows.length
				: 0;

		return {
			totalAy1,
			totalAy2,
			totalDelta,
			utilizationPct,
			alertCount: masterGridRows.filter((row) => row.alert === 'OVER' || row.alert === 'NEAR_CAP')
				.length,
			isStale,
		};
	}, [isStale, masterGridRows]);

	const ay1EntryCount = useMemo(
		() =>
			new Set(
				headcountEntries
					.filter((entry) => entry.academicPeriod === 'AY1')
					.map((entry) => entry.gradeLevel)
			).size,
		[headcountEntries]
	);
	const hasCompleteAy1 = expectedGradeCount > 0 && ay1EntryCount === expectedGradeCount;
	const hasPersistedCohorts =
		cohortEntries
			.filter((entry) => entry.gradeLevel !== 'PS')
			.every((entry) => entry.isPersisted) &&
		cohortEntries.filter((entry) => entry.gradeLevel !== 'PS').length ===
			gradeLevels.filter((gradeLevel) => gradeLevel.gradeCode !== 'PS').length;
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
	}, [editability, isSetupComplete, versionId]);

	function buildEditableCohortEntry(gradeLevel: GradeCode) {
		const existing = cohortMap.get(gradeLevel);
		if (existing) {
			return existing;
		}

		return {
			gradeLevel,
			retentionRate: gradeLevel === 'PS' ? 0 : 1,
			manualAdjustment: 0,
			lateralEntryCount: 0,
			lateralWeightFr: 0,
			lateralWeightNat: 0,
			lateralWeightAut: 0,
		};
	}

	const baselineSource = useMemo(() => {
		const ds = currentVersion?.dataSource;
		if (ds === 'CALCULATED') return 'Calculated';
		if (ds === 'IMPORTED') return 'Imported';
		return ds ?? null;
	}, [currentVersion?.dataSource]);

	const activeFilters = useMemo(() => {
		const filters: string[] = [];
		if (bandFilter !== 'ALL') filters.push(`Band: ${bandFilter}`);
		if (exceptionFilter !== 'all') filters.push(`Exception: ${exceptionFilter}`);
		return filters;
	}, [bandFilter, exceptionFilter]);

	const isFiltered = bandFilter !== 'ALL' || exceptionFilter !== 'all';

	if (!versionId) {
		return (
			<div className="flex h-64 items-center justify-center text-(--text-muted)">
				Select a version from the context bar to begin enrollment planning.
			</div>
		);
	}

	return (
		<PageTransition>
			<div className="flex h-full min-h-0 flex-col overflow-hidden">
				{/* Conditional banners */}
				{isLocked && versionStatus && (
					<VersionLockBanner status={versionStatus} versionName={versionName ?? undefined} />
				)}
				{isImported && (
					<div className="shrink-0 border-b border-(--color-warning) bg-(--color-warning-bg) px-4 py-3">
						<p className="text-sm font-semibold text-(--color-warning)">
							Imported versions are review-only for Enrollment.
						</p>
						<p className="mt-1 text-sm text-(--text-secondary)">
							Use the setup wizard on an editable Budget or Forecast version to validate intake and
							planning rules before applying changes.
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
					<div className="shrink-0 border-b border-(--color-info) bg-(--color-info-bg) px-4 py-3">
						<p className="text-sm font-semibold text-(--color-info)">
							Viewer access keeps this workspace in review mode.
						</p>
						<p className="mt-1 text-sm text-(--text-secondary)">
							You can inspect assumptions and results, but edits and calculations are disabled.
						</p>
					</div>
				)}

				{/* Toolbar */}
				<div className="flex shrink-0 items-center justify-between border-b border-(--workspace-border) px-6 py-2">
					<div className="flex items-center gap-2">
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
						<ExceptionFilterMenu value={exceptionFilter} onChange={setExceptionFilter} />
					</div>
					<div className="flex items-center gap-2">
						<Button
							type="button"
							variant={quickEdit ? 'default' : 'outline'}
							size="sm"
							onClick={() => setQuickEdit((current) => !current)}
							aria-pressed={quickEdit}
						>
							{quickEdit ? 'Quick Edit On' : 'Quick Edit'}
						</Button>
						<ExportButton
							rows={filteredRows}
							versionName={versionName ?? 'enrollment'}
							activeFilters={activeFilters}
							isFiltered={isFiltered}
							dirtyCount={dirtyCount}
						/>
						<Button type="button" variant="outline" size="sm" onClick={openEnrollmentSettings}>
							Enrollment Settings
						</Button>
						<Button type="button" variant="outline" size="sm" onClick={() => setWizardOpen(true)}>
							{isSetupComplete ? 'Reopen Setup Wizard' : 'Resume Setup Wizard'}
						</Button>
						{editability === 'editable' && (
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
				<EnrollmentKpiRibbon {...kpiData} />

				{/* Status strip */}
				<EnrollmentStatusStrip
					baselineSource={baselineSource}
					lastCalculatedAt={
						currentVersion?.lastCalculatedAt ?? capacityResultsData?.lastCalculatedAt ?? null
					}
					dirtyCount={dirtyCount}
					staleModules={currentVersion?.staleModules ?? []}
				/>

				{/* Grid zone — flex-1, owns its own scroll */}
				<div className="flex-1 min-h-0 overflow-hidden px-6 py-2">
					<div className="h-full overflow-y-auto scrollbar-thin">
						<EnrollmentMasterGrid
							rows={filteredRows}
							selectedGradeLevel={selectedGrade}
							isReadOnly={isReadOnly}
							quickEditEnabled={quickEdit}
							isFiltered={isFiltered}
							onSelectGrade={selectGrade}
							onEditAy1Headcount={(gradeLevel, value) =>
								putHeadcount.mutate([
									{
										gradeLevel,
										academicPeriod: 'AY1',
										headcount: Math.max(0, Math.round(value)),
									},
								])
							}
							onEditRetentionRate={(gradeLevel, value) =>
								putCohortParameters.mutate({
									entries: [
										{
											...buildEditableCohortEntry(gradeLevel),
											retentionRate: value,
										},
									],
								})
							}
							onEditManualAdjustment={(gradeLevel, value) =>
								putCohortParameters.mutate({
									entries: [
										{
											...buildEditableCohortEntry(gradeLevel),
											manualAdjustment: Math.round(value),
										},
									],
								})
							}
						/>
					</div>
				</div>
			</div>

			<EnrollmentSetupWizard
				open={wizardOpen}
				versionId={versionId}
				versionName={versionName}
				editability={editability}
				onClose={() => setWizardOpen(false)}
			/>
			<EnrollmentSettingsSheet versionId={versionId} editability={editability} />
		</PageTransition>
	);
}
