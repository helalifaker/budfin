import { useEffect, useMemo, useState } from 'react';
import { useWorkspaceContext } from '../../hooks/use-workspace-context';
import { useAuthStore } from '../../stores/auth-store';
import { useRightPanelStore } from '../../stores/right-panel-store';
import { useStaffingSelectionStore } from '../../stores/staffing-selection-store';
import { useStaffingSettingsSheetStore } from '../../stores/staffing-settings-store';
import { useCalculateStaffing } from '../../hooks/use-staffing';
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

				{/* Grid zone — flex-1, owns its own scroll */}
				<div className="flex-1 min-h-0 overflow-hidden px-6 py-2">
					<div className="h-full overflow-y-auto scrollbar-thin">
						{isTeachingMode ? (
							<div
								data-testid="teaching-grid-placeholder"
								className="flex h-full items-center justify-center text-(--text-muted)"
							>
								Teaching workspace
							</div>
						) : (
							<div
								data-testid="support-grid-placeholder"
								className="flex h-full items-center justify-center text-(--text-muted)"
							>
								Support &amp; Admin workspace
							</div>
						)}
					</div>
				</div>
			</div>
		</PageTransition>
	);
}
