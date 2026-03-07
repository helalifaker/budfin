import { useState, useCallback } from 'react';
import { useWorkspaceContext } from '../../hooks/use-workspace-context';
import { useAuthStore } from '../../stores/auth-store';
import { useHeadcount, usePutHeadcount, useCalculateEnrollment } from '../../hooks/use-enrollment';
import { useGradeLevels } from '../../hooks/use-grade-levels';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import { Button } from '../../components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '../../components/ui/toggle-group';
import { ByGradeGrid } from '../../components/enrollment/by-grade-grid';
import { ByNationalityGrid } from '../../components/enrollment/by-nationality-grid';
import { ByTariffGrid } from '../../components/enrollment/by-tariff-grid';
import { HistoricalChart } from '../../components/enrollment/historical-chart';
import { CsvImportPanel } from '../../components/enrollment/csv-import-panel';
import { CalculateButton } from '../../components/enrollment/calculate-button';
import { PageTransition } from '../../components/shared/page-transition';
import type { HeadcountEntry, AcademicPeriod } from '@budfin/types';
import type { GradeBand } from '../../hooks/use-grade-levels';

const BAND_FILTERS: Array<{ value: string; label: string }> = [
	{ value: 'ALL', label: 'All' },
	{ value: 'MATERNELLE', label: 'Mat' },
	{ value: 'ELEMENTAIRE', label: 'Elem' },
	{ value: 'COLLEGE', label: 'Col' },
	{ value: 'LYCEE', label: 'Lyc' },
];

export function EnrollmentPage() {
	const { versionId, academicPeriod, comparisonVersionId } = useWorkspaceContext();
	const user = useAuthStore((s) => s.user);
	const isViewer = user?.role === 'Viewer';

	const [bandFilter, setBandFilter] = useState('ALL');
	const [importOpen, setImportOpen] = useState(false);
	const [historyOpen, setHistoryOpen] = useState(false);

	const { data: headcountData, isLoading: headcountLoading } = useHeadcount(
		versionId,
		academicPeriod as AcademicPeriod | null
	);
	const { data: gradeLevelData } = useGradeLevels();
	const { data: comparisonData } = useHeadcount(
		comparisonVersionId,
		academicPeriod as AcademicPeriod | null
	);
	const putHeadcount = usePutHeadcount(versionId);
	const calculateMutation = useCalculateEnrollment(versionId);

	const gradeLevels = gradeLevelData?.gradeLevels ?? [];
	const entries = headcountData?.entries ?? [];

	const filteredEntries =
		bandFilter === 'ALL' ? entries : entries.filter((e) => e.band === bandFilter);

	const handleHeadcountSave = useCallback(
		(updated: HeadcountEntry[]) => {
			if (!versionId || isViewer) return;
			putHeadcount.mutate(updated);
		},
		[versionId, isViewer, putHeadcount]
	);

	if (!versionId) {
		return (
			<div className="flex items-center justify-center h-64 text-[var(--text-muted)]">
				Select a version from the context bar to begin enrollment planning.
			</div>
		);
	}

	return (
		<PageTransition>
			<div className="space-y-4">
				{/* Module Toolbar */}
				<div className="flex items-center justify-between">
					<h1 className="text-[length:var(--text-xl)] font-semibold text-[var(--text-primary)]">
						Enrollment & Capacity
					</h1>
					<div className="flex items-center gap-2">
						{/* Band filter toggle */}
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

						{!isViewer && (
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
					</div>
				</div>

				{/* Tab Bar */}
				<Tabs defaultValue="by-grade">
					<TabsList>
						<TabsTrigger value="by-grade">By Grade</TabsTrigger>
						<TabsTrigger value="by-nationality">By Nationality</TabsTrigger>
						<TabsTrigger value="by-tariff">By Tariff</TabsTrigger>
					</TabsList>

					<TabsContent value="by-grade">
						<ByGradeGrid
							entries={filteredEntries}
							gradeLevels={gradeLevels}
							isLoading={headcountLoading}
							isReadOnly={isViewer}
							versionId={versionId}
							onSave={handleHeadcountSave}
							bandFilter={bandFilter as GradeBand | 'ALL'}
							comparisonEntries={comparisonData?.entries}
							capacityResults={calculateMutation.data?.results}
						/>
					</TabsContent>

					<TabsContent value="by-nationality">
						<ByNationalityGrid
							versionId={versionId}
							isReadOnly={isViewer}
							bandFilter={bandFilter as GradeBand | 'ALL'}
							academicPeriod={academicPeriod ?? 'AY1'}
						/>
					</TabsContent>

					<TabsContent value="by-tariff">
						<ByTariffGrid
							versionId={versionId}
							isReadOnly={isViewer}
							bandFilter={bandFilter as GradeBand | 'ALL'}
							academicPeriod={academicPeriod ?? 'AY1'}
						/>
					</TabsContent>
				</Tabs>

				{/* Historical Chart (collapsible) */}
				{historyOpen && <HistoricalChart />}

				{/* CSV Import Side Panel */}
				<CsvImportPanel open={importOpen} onClose={() => setImportOpen(false)} />
			</div>
		</PageTransition>
	);
}
