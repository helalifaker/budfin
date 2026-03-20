import { useState, useMemo, useCallback } from 'react';
import { Button } from '../ui/button';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { DisciplineSummaryGrid } from './discipline-summary-grid';
import { AutoSuggestDialog } from './auto-suggest-dialog';
import {
	BAND_FILTERS,
	COVERAGE_OPTIONS,
	buildDisciplineSummaryRows,
	type BandFilter,
	type CoverageFilter,
	type DisciplineSummaryRow,
} from '../../lib/staffing-workspace';
import { useAutoSuggestAssignments } from '../../hooks/use-master-data';
import { useStaffingSelectionStore } from '../../stores/staffing-selection-store';
import type { TeachingRequirementsResponse } from '../../hooks/use-staffing';
import type { AutoSuggestResult } from '../../hooks/use-master-data';
import { cn } from '../../lib/cn';

// ── Band filter → scope label map ────────────────────────────────────────────

const BAND_SCOPE_MAP: Record<BandFilter, string | null> = {
	ALL: null,
	MAT: 'Mat',
	ELEM: 'Elem',
	COL: 'Col+Lyc',
	LYC: 'Col+Lyc',
};

// ── Props ─────────────────────────────────────────────────────────────────────

export type CoverageTabContentProps = {
	versionId: number;
	teachingReqData: TeachingRequirementsResponse;
	isEditable: boolean;
};

// ── Component ─────────────────────────────────────────────────────────────────

export function CoverageTabContent({
	versionId,
	teachingReqData,
	isEditable,
}: CoverageTabContentProps) {
	const [coverageFilter, setCoverageFilter] = useState<CoverageFilter>('ALL');
	const [bandFilter, setBandFilter] = useState<BandFilter>('ALL');
	const [autoSuggestOpen, setAutoSuggestOpen] = useState(false);
	const [suggestions, setSuggestions] = useState<AutoSuggestResult[]>([]);

	const autoSuggest = useAutoSuggestAssignments(versionId);
	const selectDisciplineSummary = useStaffingSelectionStore((s) => s.selectDisciplineSummary);
	const selection = useStaffingSelectionStore((s) => s.selection);

	const selectedKey =
		selection?.type === 'DISCIPLINE_SUMMARY'
			? `${selection.scope === 'Mat' ? 'MATERNELLE' : selection.scope === 'Elem' ? 'ELEMENTAIRE' : 'COL_LYC'}-${selection.disciplineCode}`
			: null;

	const allRows = useMemo(
		() => buildDisciplineSummaryRows(teachingReqData.lines),
		[teachingReqData.lines]
	);

	const filteredRows = useMemo(() => {
		let rows = allRows;

		if (bandFilter !== 'ALL') {
			const scopeLabel = BAND_SCOPE_MAP[bandFilter];
			if (scopeLabel) {
				rows = rows.filter((r) => r.scope === scopeLabel);
			}
		}

		if (coverageFilter !== 'ALL') {
			rows = rows.filter((r) => r.coverageStatus === coverageFilter);
		}

		return rows;
	}, [allRows, bandFilter, coverageFilter]);

	const handleRowSelect = useCallback(
		(row: DisciplineSummaryRow) => {
			selectDisciplineSummary(row.disciplineCode, row.scope, row.contributingLineIds);
		},
		[selectDisciplineSummary]
	);

	const handleAutoSuggest = useCallback(() => {
		autoSuggest.mutate(undefined, {
			onSuccess: (data) => {
				setSuggestions(data.suggestions);
				setAutoSuggestOpen(true);
			},
		});
	}, [autoSuggest]);

	const coverageLabel =
		COVERAGE_OPTIONS.find((o) => o.value === coverageFilter)?.label ?? 'All Coverage';

	return (
		<div className="flex flex-col gap-4">
			{/* Toolbar */}
			<div className="flex items-center gap-3 flex-wrap">
				{/* Band scope filter */}
				<ToggleGroup
					type="single"
					value={bandFilter}
					onValueChange={(v) => {
						if (v) setBandFilter(v as BandFilter);
					}}
					aria-label="Filter by band scope"
				>
					{BAND_FILTERS.map((f) => (
						<ToggleGroupItem
							key={f.value}
							value={f.value}
							aria-label={`Filter ${f.label}`}
							className="text-xs"
						>
							{f.label}
						</ToggleGroupItem>
					))}
				</ToggleGroup>

				{/* Coverage status filter */}
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="outline"
							size="sm"
							className={cn(
								'text-xs',
								coverageFilter !== 'ALL' && 'border-(--accent-500) text-(--accent-700)'
							)}
							aria-label={`Coverage filter: ${coverageLabel}`}
						>
							{coverageLabel}
							<span className="ml-1 opacity-60" aria-hidden="true">
								&#9660;
							</span>
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start">
						{COVERAGE_OPTIONS.map((opt) => (
							<DropdownMenuItem
								key={opt.value}
								onSelect={() => setCoverageFilter(opt.value)}
								aria-current={coverageFilter === opt.value ? 'true' : undefined}
							>
								{opt.label}
							</DropdownMenuItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>

				{/* Row count indicator */}
				<span className="text-xs text-(--text-muted)">
					{filteredRows.length} discipline{filteredRows.length !== 1 ? 's' : ''}
				</span>

				{/* Auto-suggest button — editable versions only */}
				{isEditable && (
					<Button
						variant="outline"
						size="sm"
						className="ml-auto text-xs"
						onClick={handleAutoSuggest}
						disabled={autoSuggest.isPending}
						aria-busy={autoSuggest.isPending}
					>
						{autoSuggest.isPending ? 'Running...' : 'Auto-Suggest'}
					</Button>
				)}
			</div>

			{/* Grid */}
			<DisciplineSummaryGrid
				rows={filteredRows}
				onRowSelect={handleRowSelect}
				selectedKey={selectedKey}
			/>

			{/* Auto-suggest dialog */}
			<AutoSuggestDialog
				open={autoSuggestOpen}
				onOpenChange={setAutoSuggestOpen}
				versionId={versionId}
				suggestions={suggestions}
			/>
		</div>
	);
}
