import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWorkspaceContext } from '../../hooks/use-workspace-context';
import { useAuthStore } from '../../stores/auth-store';
import { useRightPanelStore } from '../../stores/right-panel-store';
import { useStaffingSelectionStore } from '../../stores/staffing-selection-store';
import { useStaffingSettingsSheetStore } from '../../stores/staffing-settings-store';
import {
	useCalculateStaffing,
	useTeachingRequirements,
	useEmployees,
	useStaffingSummary,
	type Employee,
} from '../../hooks/use-staffing';
import { useVersions } from '../../hooks/use-versions';
import {
	BAND_FILTERS,
	COVERAGE_OPTIONS,
	VIEW_PRESETS,
	deriveStaffingEditability,
	type BandFilter,
	type CoverageFilter,
	type ViewPreset,
	type WorkspaceMode,
} from '../../lib/staffing-workspace';
import { Button } from '../../components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '../../components/ui/toggle-group';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { PageTransition } from '../../components/shared/page-transition';
import { TeachingMasterGrid } from '../../components/staffing/teaching-master-grid';
import { SupportAdminGrid } from '../../components/staffing/support-admin-grid';
import { StaffingKpiRibbonV2 } from '../../components/staffing/staffing-kpi-ribbon';
import { StaffingStatusStrip } from '../../components/staffing/staffing-status-strip';
import { StaffingSettingsSheet } from '../../components/staffing/staffing-settings-sheet';
// Side-effect imports: register right-panel content for staffing page
import '../../components/staffing/staffing-inspector-content';
import '../../components/staffing/staffing-guide-content';

export function StaffingPage() {
	const { versionId, fiscalYear, versionStatus } = useWorkspaceContext();
	const user = useAuthStore((state) => state.user);
	const setActivePage = useRightPanelStore((state) => state.setActivePage);
	const isPanelOpen = useRightPanelStore((state) => state.isOpen);
	const clearSelection = useStaffingSelectionStore((state) => state.clearSelection);
	const openSettings = useStaffingSettingsSheetStore((state) => state.open);

	const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('teaching');
	const [bandFilter, setBandFilter] = useState<BandFilter>('ALL');
	const [coverageFilter, setCoverageFilter] = useState<CoverageFilter>('ALL');
	const [viewPreset, setViewPreset] = useState<ViewPreset>('Full View');

	const { data: versionsData } = useVersions(fiscalYear);
	const calculateMutation = useCalculateStaffing(versionId);

	// Data hooks for grids and KPIs
	const { data: teachingReqData, isError: teachingReqError } = useTeachingRequirements(versionId);
	const { data: employeesData } = useEmployees(versionId);
	const { data: summaryData } = useStaffingSummary(versionId);

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

	const editability = deriveStaffingEditability({
		role: user?.role ?? null,
		versionStatus: currentVersion?.status ?? versionStatus,
	});
	const isEditable = editability === 'editable';
	const isLocked = editability === 'locked';
	const isViewer = editability === 'viewer';
	const isStale = currentVersion?.staleModules?.includes('STAFFING') ?? false;
	const isUncalculated = !isStale && !currentVersion?.lastCalculatedAt;

	// Reset filters when workspace mode changes
	const handleWorkspaceModeChange = (value: string) => {
		if (value === 'teaching' || value === 'support') {
			setWorkspaceMode(value);
			setBandFilter('ALL');
			setCoverageFilter('ALL');
		}
	};

	const isTeachingMode = workspaceMode === 'teaching';
	const showCoverageFilter = isTeachingMode && viewPreset !== 'Need';

	// Selected requirement line ID for teaching grid highlighting
	const selection = useStaffingSelectionStore((state) => state.selection);
	const selectSupportEmployee = useStaffingSelectionStore((state) => state.selectSupportEmployee);

	const selectedLineId = useMemo(() => {
		if (selection?.type === 'REQUIREMENT_LINE') return selection.requirementLineId;
		return null;
	}, [selection]);

	// KPI ribbon values derived from teaching requirements totals and staffing summary
	const kpiValues = useMemo(() => {
		const totals = teachingReqData?.totals;
		const totalFteGap = totals ? parseFloat(totals.totalFteGap) : 0;
		const staffCost = summaryData ? parseFloat(summaryData.cost) : 0;

		return {
			totalHeadcount: employeesData?.total ?? 0,
			fteGap: totalFteGap,
			staffCost,
			hsaBudget: 0,
			heRatio: 0,
			rechargeCost: 0,
		};
	}, [teachingReqData?.totals, summaryData, employeesData?.total]);

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

	// Support grid callbacks
	const handleEmployeeSelect = useCallback(
		(employee: Employee) => {
			selectSupportEmployee(employee.id, employee.department);
		},
		[selectSupportEmployee]
	);

	const handleEmployeeDoubleClick = useCallback((_employee: Employee) => {
		// Future: open employee edit form
	}, []);

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
					<div className="flex items-center gap-2">
						{/* Workspace mode toggle */}
						<ToggleGroup
							type="single"
							value={workspaceMode}
							onValueChange={handleWorkspaceModeChange}
							aria-label="Workspace mode"
						>
							<ToggleGroupItem value="teaching">Teaching</ToggleGroupItem>
							<ToggleGroupItem value="support">Support &amp; Admin</ToggleGroupItem>
						</ToggleGroup>

						{/* Band filter — Teaching mode only */}
						{isTeachingMode && (
							<ToggleGroup
								type="single"
								value={bandFilter}
								onValueChange={(value) => {
									if (value) setBandFilter(value as BandFilter);
								}}
								aria-label="Band filter"
							>
								{BAND_FILTERS.map((filter) => (
									<ToggleGroupItem key={filter.value} value={filter.value}>
										{filter.label}
									</ToggleGroupItem>
								))}
							</ToggleGroup>
						)}

						{/* Coverage filter — Teaching mode only, hidden when Need */}
						{showCoverageFilter && (
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button variant="outline" size="sm">
										{COVERAGE_OPTIONS.find((opt) => opt.value === coverageFilter)?.label ??
											'All Coverage'}
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent>
									{COVERAGE_OPTIONS.map((option) => (
										<DropdownMenuItem
											key={option.value}
											onClick={() => setCoverageFilter(option.value)}
										>
											{option.label}
										</DropdownMenuItem>
									))}
								</DropdownMenuContent>
							</DropdownMenu>
						)}
					</div>

					<div className="flex items-center gap-2">
						{/* View presets — Teaching mode only */}
						{isTeachingMode && (
							<ToggleGroup
								type="single"
								value={viewPreset}
								onValueChange={(value) => {
									if (value) setViewPreset(value as ViewPreset);
								}}
								aria-label="View preset"
							>
								{VIEW_PRESETS.map((preset) => (
									<ToggleGroupItem key={preset.value} value={preset.value}>
										{preset.label}
									</ToggleGroupItem>
								))}
							</ToggleGroup>
						)}

						{/* Settings — always visible */}
						<Button type="button" variant="outline" size="sm" onClick={openSettings}>
							Settings
						</Button>

						{/* Import — editable only */}
						{isEditable && (
							<Button type="button" variant="outline" size="sm">
								Import
							</Button>
						)}

						{/* Add Employee — editable only */}
						{isEditable && (
							<Button type="button" variant="outline" size="sm">
								Add Employee
							</Button>
						)}

						{/* Auto-Suggest — Teaching mode + editable only */}
						{isTeachingMode && isEditable && (
							<Button type="button" variant="outline" size="sm">
								Auto-Suggest
							</Button>
						)}

						{/* Calculate — editable only */}
						{isEditable && (
							<Button
								type="button"
								size="sm"
								disabled={calculateMutation.isPending}
								onClick={() => calculateMutation.mutate()}
							>
								{calculateMutation.isPending ? 'Calculating...' : 'Calculate'}
							</Button>
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

				{/* KPI ribbon */}
				<div className="shrink-0 px-6 py-3">
					<StaffingKpiRibbonV2
						totalHeadcount={kpiValues.totalHeadcount}
						fteGap={kpiValues.fteGap}
						staffCost={kpiValues.staffCost}
						hsaBudget={kpiValues.hsaBudget}
						heRatio={kpiValues.heRatio}
						rechargeCost={kpiValues.rechargeCost}
						isStale={isStale}
					/>
				</div>

				{/* Grid zone — flex-1, owns its own scroll */}
				<div className="flex-1 min-h-0 overflow-hidden px-6 py-2">
					{isTeachingMode && (
						<h2 className="mb-2 text-sm font-semibold text-(--text-primary)">
							Teaching Requirements
						</h2>
					)}
					<div className="h-full overflow-y-auto scrollbar-thin">
						{isTeachingMode ? (
							teachingReqData ? (
								<TeachingMasterGrid
									data={teachingReqData}
									viewPreset={viewPreset}
									bandFilter={bandFilter}
									coverageFilter={coverageFilter}
									selectedLineId={selectedLineId}
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
									{isEditable && (
										<Button
											type="button"
											size="sm"
											disabled={calculateMutation.isPending}
											onClick={() => calculateMutation.mutate()}
										>
											{calculateMutation.isPending ? 'Calculating...' : 'Calculate'}
										</Button>
									)}
								</div>
							) : (
								<div
									data-testid="teaching-grid-loading"
									className="flex h-full items-center justify-center text-(--text-muted)"
								>
									Loading teaching requirements...
								</div>
							)
						) : (
							<SupportAdminGrid
								employees={employeesData?.data ?? []}
								editability={editability}
								onEmployeeSelect={handleEmployeeSelect}
								onEmployeeDoubleClick={handleEmployeeDoubleClick}
							/>
						)}
					</div>
				</div>

				{/* Settings sheet (rendered always, visibility controlled by store) */}
				<StaffingSettingsSheet versionId={versionId} isEditable={isEditable} />
			</div>
		</PageTransition>
	);
}
