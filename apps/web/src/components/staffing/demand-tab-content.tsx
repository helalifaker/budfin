import { useState } from 'react';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import { TeachingMasterGrid } from './teaching-master-grid';
import { DisciplineDemandGrid } from './discipline-demand-grid';
import { BAND_FILTERS, type BandFilter } from '../../lib/staffing-workspace';
import type { TeachingRequirementsResponse } from '../../hooks/use-staffing';
import { useStaffingSelectionStore } from '../../stores/staffing-selection-store';

type DemandView = 'band' | 'discipline';

export type DemandTabContentProps = {
	versionId: number;
	teachingReqData: TeachingRequirementsResponse | undefined;
	isStale: boolean;
	isEditable: boolean;
};

export function DemandTabContent({ teachingReqData, isStale }: DemandTabContentProps) {
	const [demandView, setDemandView] = useState<DemandView>('band');
	const [bandFilter, setBandFilter] = useState<BandFilter>('ALL');
	const selection = useStaffingSelectionStore((s) => s.selection);
	const selectedLineId =
		selection?.type === 'REQUIREMENT_LINE' ? selection.requirementLineId : null;

	if (isStale) {
		return (
			<div
				className="flex items-center justify-center py-16 text-(--text-muted)"
				role="status"
				aria-live="polite"
			>
				Teaching requirements are out of date. Run Calculate to refresh.
			</div>
		);
	}

	if (!teachingReqData) {
		return (
			<div
				className="flex items-center justify-center py-16 text-(--text-muted)"
				role="status"
				aria-live="polite"
			>
				Loading teaching requirements...
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-3">
			{/* Top toolbar */}
			<div className="flex items-center gap-3">
				{/* View toggle */}
				<ToggleGroup
					type="single"
					value={demandView}
					onValueChange={(val) => {
						if (val) setDemandView(val as DemandView);
					}}
					aria-label="Demand view"
				>
					<ToggleGroupItem value="band">By Band</ToggleGroupItem>
					<ToggleGroupItem value="discipline">By Discipline</ToggleGroupItem>
				</ToggleGroup>

				{/* Band filter — only shown in By Band mode */}
				{demandView === 'band' && (
					<ToggleGroup
						type="single"
						value={bandFilter}
						onValueChange={(val) => {
							if (val) setBandFilter(val as BandFilter);
						}}
						aria-label="Band filter"
					>
						{BAND_FILTERS.map((f) => (
							<ToggleGroupItem key={f.value} value={f.value}>
								{f.label}
							</ToggleGroupItem>
						))}
					</ToggleGroup>
				)}
			</div>

			{/* Grid content */}
			{demandView === 'band' ? (
				<TeachingMasterGrid
					data={teachingReqData}
					viewPreset="Need"
					bandFilter={bandFilter}
					coverageFilter="ALL"
					selectedLineId={selectedLineId}
				/>
			) : (
				<DisciplineDemandGrid data={teachingReqData} />
			)}
		</div>
	);
}
