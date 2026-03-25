import { useCallback, useEffect, useMemo, useState } from 'react';
import Decimal from 'decimal.js';
import { useWorkspaceContext } from '../../hooks/use-workspace-context';
import { useAuthStore } from '../../stores/auth-store';
import { useRightPanelStore } from '../../stores/right-panel-store';
import { useStaffingSelectionStore } from '../../stores/staffing-selection-store';
import { useStaffingSettingsDialogStore } from '../../stores/staffing-settings-dialog-store';
import {
	useCalculateStaffing,
	useTeachingRequirements,
	useEmployees,
	useStaffingSummary,
	useStaffingAssignments,
	useCategoryCosts,
} from '../../hooks/use-staffing';
import { useVersions } from '../../hooks/use-versions';
import {
	WORKSPACE_TABS,
	deriveStaffingEditability,
	deriveTabKpis,
	buildDisciplineSummaryRows,
	type WorkspaceTab,
} from '../../lib/staffing-workspace';
import { Button } from '../ui/button';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import { CalculateButton } from '../shared/calculate-button';
import { cn } from '../../lib/cn';
import { PageTransition } from '../shared/page-transition';
import { StaffingKpiRibbonV2 } from './staffing-kpi-ribbon';
import { StaffingStatusStrip } from './staffing-status-strip';
import { StaffingSettingsDialog } from './staffing-settings-dialog';
import { StaffingExportButton, type KpiValues } from './staffing-export-button';
import { DemandTabContent } from './demand-tab-content';
import { RosterTabContent } from './roster-tab-content';
import { CoverageTabContent } from './coverage-tab-content';
import { CostsTabContent } from './costs-tab-content';
// Side-effect imports: register right-panel content for staffing page
import './staffing-inspector-content';
import './staffing-guide-content';

export function StaffingPageV2() {
	const { versionId, fiscalYear, versionStatus } = useWorkspaceContext();
	const user = useAuthStore((state) => state.user);
	const setActivePage = useRightPanelStore((state) => state.setActivePage);
	const isPanelOpen = useRightPanelStore((state) => state.isOpen);
	const clearSelection = useStaffingSelectionStore((state) => state.clearSelection);
	const openSettings = useStaffingSettingsDialogStore((state) => state.open);

	const [activeTab, setActiveTab] = useState<WorkspaceTab>('demand');

	const { data: versionsData } = useVersions(fiscalYear);
	const calculateMutation = useCalculateStaffing(versionId);

	// Data hooks
	const { data: teachingReqData, isError: teachingReqError } = useTeachingRequirements(versionId);
	const { data: employeesData } = useEmployees(versionId);
	const { data: summaryData } = useStaffingSummary(versionId);
	const { data: assignmentsData } = useStaffingAssignments(versionId);
	const { data: categoryCosts } = useCategoryCosts(versionId);

	// Register right panel page key
	useEffect(() => {
		setActivePage('staffing');
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
	const canViewSalary = user?.role !== 'Viewer';
	const isStale = currentVersion?.staleModules?.includes('STAFFING') ?? false;
	const isUncalculated = !isStale && !currentVersion?.lastCalculatedAt;

	// Global stable KPIs for export (DC-3)
	const exportKpis: KpiValues = useMemo(() => {
		// HSA Budget: sum of hsaCostAnnual across all requirement lines
		const hsaBudget = (teachingReqData?.lines ?? [])
			.reduce((sum, line) => sum.plus(line.hsaCostAnnual ?? '0'), new Decimal(0))
			.toNumber();

		// H/E Ratio: Host (local) / Expatriate (AEFE) count
		const employees = employeesData?.data ?? [];
		const localCount = employees.filter(
			(e) => e.costMode !== 'AEFE_RECHARGE' && e.status !== 'Departed'
		).length;
		const aefeCount = employees.filter(
			(e) => e.costMode === 'AEFE_RECHARGE' && e.status !== 'Departed'
		).length;
		const heRatio = aefeCount > 0 ? +(localCount / aefeCount).toFixed(2) : 0;

		// Recharge Cost: sum of RESIDENT_* category costs (annualized)
		const rechargeCost = (categoryCosts?.data ?? [])
			.reduce((sum, entry) => {
				let monthTotal = new Decimal(0);
				for (const [key, val] of Object.entries(entry)) {
					if (key.startsWith('RESIDENT_') && typeof val === 'string') {
						monthTotal = monthTotal.plus(val);
					}
				}
				return sum.plus(monthTotal);
			}, new Decimal(0))
			.toNumber();

		const totalHeadcount = employees.filter((e) => e.recordType !== 'REPLACEMENT').length;

		return {
			totalHeadcount,
			fteGap: parseFloat(teachingReqData?.totals.totalFteGap ?? '0'),
			staffCost: new Decimal(summaryData?.cost ?? '0').toNumber(),
			hsaBudget,
			heRatio,
			rechargeCost,
		};
	}, [employeesData, teachingReqData, summaryData, categoryCosts]);

	// Tab-specific KPIs (available for future per-tab ribbon enhancement)
	const _tabKpis = useMemo(
		() =>
			deriveTabKpis(
				activeTab,
				teachingReqData,
				employeesData,
				summaryData,
				categoryCosts,
				assignmentsData
			),
		[activeTab, teachingReqData, employeesData, summaryData, categoryCosts, assignmentsData]
	);

	// Status strip values
	const staleModules = useMemo(
		() => currentVersion?.staleModules ?? [],
		[currentVersion?.staleModules]
	);

	const supplyCount = useMemo(() => {
		const employees = employeesData?.data ?? [];
		let existing = 0;
		let newCount = 0;
		let vacancies = 0;
		for (const emp of employees) {
			if (emp.recordType === 'VACANCY') {
				vacancies++;
			} else if (emp.status === 'New') {
				newCount++;
			} else {
				existing++;
			}
		}
		return { existing, new: newCount, vacancies };
	}, [employeesData?.data]);

	const coverageSummary = useMemo(() => {
		const lines = teachingReqData?.lines ?? [];
		let deficit = 0;
		let uncovered = 0;
		let balanced = 0;
		for (const line of lines) {
			const status = line.coverageStatus;
			if (status === 'DEFICIT') deficit++;
			else if (status === 'UNCOVERED') uncovered++;
			else balanced++;
		}
		return { deficit, uncovered, balanced };
	}, [teachingReqData?.lines]);

	const enrollmentStale = staleModules.includes('ENROLLMENT');
	const enrollmentCalculatedAt = currentVersion?.lastCalculatedAt ?? null;

	// Tab badges
	const tabBadges = useMemo(() => {
		const badges: Record<WorkspaceTab, string | null> = {
			demand: isStale ? 'stale' : null,
			roster: null,
			coverage: null,
			costs: isStale ? 'stale' : null,
		};

		// Roster: unassigned teaching count
		if (employeesData && assignmentsData) {
			const assignedIds = new Set(assignmentsData.data.map((a) => a.employeeId));
			const unassigned = employeesData.data.filter(
				(e) => e.isTeaching && !assignedIds.has(e.id)
			).length;
			if (unassigned > 0) badges.roster = String(unassigned);
		}

		// Coverage: deficit + uncovered count
		if (teachingReqData) {
			const summaryRows = buildDisciplineSummaryRows(teachingReqData.lines);
			const issues = summaryRows.filter(
				(r) => r.coverageStatus === 'DEFICIT' || r.coverageStatus === 'UNCOVERED'
			).length;
			if (issues > 0) badges.coverage = String(issues);
		}

		return badges;
	}, [isStale, employeesData, assignmentsData, teachingReqData]);

	const handleTabChange = useCallback(
		(value: string) => {
			setActiveTab(value as WorkspaceTab);
			clearSelection();
		},
		[clearSelection]
	);

	if (!versionId) {
		return (
			<div className="flex h-64 items-center justify-center text-(--text-muted)">
				Select a version from the context bar to begin staffing planning.
			</div>
		);
	}

	return (
		<PageTransition>
			<div className="flex h-full min-h-0 flex-col overflow-hidden">
				{/* Conditional banners */}
				{isLocked && versionStatus && (
					<div className="shrink-0 border-b border-(--color-info) bg-(--color-info-bg) px-4 py-3">
						<p className="text-sm font-semibold text-(--color-info)">
							This version is locked. Staffing data is read-only.
						</p>
					</div>
				)}
				{isViewer && (
					<div className="shrink-0 border-b border-(--color-info) bg-(--color-info-bg) px-4 py-3">
						<p className="text-sm font-semibold text-(--color-info)">You have view-only access.</p>
					</div>
				)}
				{isUncalculated && (
					<div className="shrink-0 border-b border-(--color-warning) bg-(--color-warning-bg) px-4 py-3">
						<p className="text-sm font-semibold text-(--color-warning)">
							Staffing has not been calculated. Click Calculate to generate.
						</p>
					</div>
				)}

				{/* Toolbar */}
				<div className="flex shrink-0 items-center justify-between border-b border-(--workspace-border) px-6 py-2">
					<div className="flex items-center gap-3">
						{/* 4-Tab navigation */}
						<Tabs value={activeTab} onValueChange={handleTabChange}>
							<TabsList>
								{WORKSPACE_TABS.map((tab) => (
									<TabsTrigger key={tab.value} value={tab.value}>
										<span className="flex items-center gap-1.5">
											{tab.label}
											{tabBadges[tab.value] === 'stale' && (
												<span
													className="size-2 animate-pulse rounded-full bg-(--color-stale)"
													aria-label="Stale data"
												/>
											)}
											{tabBadges[tab.value] && tabBadges[tab.value] !== 'stale' && (
												<span
													className={cn(
														'inline-flex h-5 min-w-[20px] items-center justify-center',
														'rounded-full bg-(--accent-100) px-1.5',
														'text-xs font-medium text-(--accent-700)'
													)}
												>
													{tabBadges[tab.value]}
												</span>
											)}
										</span>
									</TabsTrigger>
								))}
							</TabsList>
						</Tabs>
					</div>

					<div className="flex items-center gap-2">
						{/* Settings */}
						<Button type="button" variant="outline" size="sm" onClick={() => openSettings()}>
							{isViewer ? 'View Settings' : 'Settings'}
						</Button>

						{/* Export — available from any tab */}
						{teachingReqData && (
							<StaffingExportButton
								versionId={versionId}
								data={teachingReqData}
								employeesData={employeesData ?? { data: [], total: 0 }}
								summaryData={summaryData}
								versionName={currentVersion?.name ?? 'unknown'}
								kpiValues={exportKpis}
							/>
						)}

						{/* Calculate — editable only */}
						{isEditable && (
							<CalculateButton
								onCalculate={() => calculateMutation.mutate()}
								isPending={calculateMutation.isPending}
								isSuccess={calculateMutation.isSuccess}
								isError={calculateMutation.isError}
							/>
						)}
					</div>
				</div>

				{/* Status strip */}
				<div className="shrink-0 border-b border-(--workspace-border)">
					<StaffingStatusStrip
						lastCalculatedAt={currentVersion?.lastCalculatedAt ?? null}
						staleModules={staleModules}
						demandPeriod={fiscalYear ? `AY ${fiscalYear}` : 'N/A'}
						enrollmentCalculatedAt={enrollmentCalculatedAt}
						enrollmentStale={enrollmentStale}
						supplyCount={supplyCount}
						coverageSummary={coverageSummary}
					/>
				</div>

				{/* KPI ribbon — contextual per tab */}
				<div className="shrink-0 px-6 py-3">
					<StaffingKpiRibbonV2
						totalHeadcount={exportKpis.totalHeadcount}
						fteGap={exportKpis.fteGap}
						staffCost={exportKpis.staffCost}
						hsaBudget={exportKpis.hsaBudget}
						heRatio={exportKpis.heRatio}
						rechargeCost={exportKpis.rechargeCost}
						isStale={isStale}
					/>
				</div>

				{/* Tab content zone — flex-1, owns its own scroll */}
				<div className="flex-1 min-h-0 overflow-hidden px-6 py-2">
					<div className="h-full overflow-y-auto scrollbar-thin">
						{activeTab === 'demand' &&
							(teachingReqData ? (
								<DemandTabContent
									versionId={versionId}
									teachingReqData={teachingReqData}
									isStale={isStale}
									isEditable={isEditable}
								/>
							) : teachingReqError || isStale ? (
								<div
									data-testid="teaching-grid-stale"
									className="flex h-full flex-col items-center justify-center gap-3 text-(--text-muted)"
								>
									<p className="text-sm font-medium">
										{isStale
											? 'Staffing data is stale. Click Calculate to regenerate teaching requirements.'
											: 'Unable to load teaching requirements.'}
									</p>
								</div>
							) : (
								<div
									data-testid="teaching-grid-loading"
									className="flex h-full items-center justify-center text-(--text-muted)"
								>
									Loading teaching requirements...
								</div>
							))}

						{activeTab === 'roster' && employeesData && (
							<RosterTabContent
								versionId={versionId}
								employeesData={employeesData}
								isEditable={isEditable}
								canViewSalary={canViewSalary}
								versionStatus={currentVersion?.status ?? versionStatus ?? null}
							/>
						)}

						{activeTab === 'roster' && !employeesData && (
							<div className="flex h-full items-center justify-center text-(--text-muted)">
								Loading employees...
							</div>
						)}

						{activeTab === 'coverage' &&
							(teachingReqData ? (
								<CoverageTabContent
									versionId={versionId}
									teachingReqData={teachingReqData}
									isEditable={isEditable}
								/>
							) : (
								<div className="flex h-full items-center justify-center text-(--text-muted)">
									Loading coverage data...
								</div>
							))}

						{activeTab === 'costs' && (
							<CostsTabContent
								versionId={versionId}
								isEditable={isEditable}
								canViewSalary={canViewSalary}
							/>
						)}
					</div>
				</div>

				{/* Settings dialog */}
				<StaffingSettingsDialog versionId={versionId} isEditable={isEditable} />
			</div>
		</PageTransition>
	);
}
