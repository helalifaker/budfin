import { useCallback, useMemo } from 'react';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import type { CohortParameterEntry, GradeCode } from '@budfin/types';
import { cn } from '../../lib/cn';
import { PlanningGrid } from '../data-grid/planning-grid';
import { useHeadcount, useHistorical, usePutHeadcount } from '../../hooks/use-enrollment';
import { useCohortParameters, usePutCohortParameters } from '../../hooks/use-cohort-parameters';
import { useNationalityBreakdown } from '../../hooks/use-nationality-breakdown';
import { useGradeLevels } from '../../hooks/use-grade-levels';
import { useEnrollmentSelectionStore } from '../../stores/enrollment-selection-store';
import { useWorkspaceContext } from '../../hooks/use-workspace-context';
import { EditableCell } from '../shared/editable-cell';
import {
	buildAy1HeadcountMap,
	buildCohortProjectionRows,
	DEFAULT_PLANNING_RULES,
	getPsAy2Headcount,
	BAND_LABELS,
	type CohortProjectionRow,
} from '../../lib/enrollment-workspace';

export type CohortProgressionGridProps = {
	versionId: number;
	bandFilter: string;
	isReadOnly: boolean;
};

type CohortRow = CohortProjectionRow & {
	frPct: number;
	natPct: number;
	autPct: number;
};

const columnHelper = createColumnHelper<CohortRow>();

function buildBandFooterRow(rows: CohortRow[], band: string) {
	if (rows.length === 0) {
		return null;
	}

	const ay1Total = rows.reduce((sum, row) => sum + row.ay1Headcount, 0);
	const lateralTotal = rows.reduce((sum, row) => sum + row.lateralEntry, 0);
	const ay2Total = rows.reduce((sum, row) => sum + row.ay2Headcount, 0);

	return {
		label: `${BAND_LABELS[band] ?? band} subtotal`,
		type: 'subtotal' as const,
		values: {
			band: '',
			ay1Headcount: ay1Total,
			retentionRate: '—',
			lateralEntry: lateralTotal,
			ay2Headcount: ay2Total,
			frPct:
				ay2Total > 0
					? `${Math.round(rows.reduce((sum, row) => sum + row.frPct * row.ay2Headcount, 0) / ay2Total || 0)}%`
					: '—',
			natPct:
				ay2Total > 0
					? `${Math.round(rows.reduce((sum, row) => sum + row.natPct * row.ay2Headcount, 0) / ay2Total || 0)}%`
					: '—',
			autPct:
				ay2Total > 0
					? `${Math.round(rows.reduce((sum, row) => sum + row.autPct * row.ay2Headcount, 0) / ay2Total || 0)}%`
					: '—',
		},
	};
}

export function CohortProgressionGrid({
	versionId,
	bandFilter,
	isReadOnly,
}: CohortProgressionGridProps) {
	const { fiscalYear } = useWorkspaceContext();
	const { data: headcountData, isLoading: headcountLoading } = useHeadcount(versionId);
	const { data: historicalData } = useHistorical(5);
	const { data: cohortData, isLoading: cohortLoading } = useCohortParameters(versionId);
	const { data: natData } = useNationalityBreakdown(versionId, 'AY2');
	const { data: gradeLevelData } = useGradeLevels();
	const putHeadcount = usePutHeadcount(versionId);
	const putCohortParams = usePutCohortParameters(versionId);
	const selectGrade = useEnrollmentSelectionStore((state) => state.selectGrade);
	const selectedGrade = useEnrollmentSelectionStore((state) =>
		state.selection?.type === 'GRADE' ? state.selection.id : null
	);

	const isLoading = headcountLoading || cohortLoading;
	const headcountEntries = useMemo(() => headcountData?.entries ?? [], [headcountData?.entries]);
	const cohortEntries = useMemo(() => cohortData?.entries ?? [], [cohortData?.entries]);
	const historicalEntries = useMemo(() => historicalData?.data ?? [], [historicalData?.data]);
	const natEntries = useMemo(() => natData?.entries ?? [], [natData?.entries]);
	const gradeLevels = useMemo(
		() => gradeLevelData?.gradeLevels ?? [],
		[gradeLevelData?.gradeLevels]
	);

	const projectionRows = useMemo(() => {
		const ay1HeadcountMap = buildAy1HeadcountMap(headcountEntries);
		const psDefaultAy2Intake =
			gradeLevels.find((gradeLevel) => gradeLevel.gradeCode === 'PS')?.defaultAy2Intake ?? null;
		const psAy2Headcount = getPsAy2Headcount(
			headcountEntries,
			ay1HeadcountMap,
			null,
			psDefaultAy2Intake
		);
		return buildCohortProjectionRows({
			gradeLevels,
			ay1HeadcountMap,
			cohortEntries,
			psAy2Headcount,
			planningRules: cohortData?.planningRules ?? DEFAULT_PLANNING_RULES,
			historicalEntries,
			targetFiscalYear: fiscalYear,
		});
	}, [
		cohortData?.planningRules,
		fiscalYear,
		headcountEntries,
		historicalEntries,
		gradeLevels,
		cohortEntries,
	]);

	const nationalityByGrade = useMemo(() => {
		const summary = new Map<string, { frPct: number; natPct: number; autPct: number }>();
		for (const entry of natEntries) {
			if (entry.academicPeriod !== 'AY2') {
				continue;
			}

			const current = summary.get(entry.gradeLevel) ?? { frPct: 0, natPct: 0, autPct: 0 };
			if (entry.nationality === 'Francais') {
				current.frPct = Math.round(entry.weight * 100);
			}
			if (entry.nationality === 'Nationaux') {
				current.natPct = Math.round(entry.weight * 100);
			}
			if (entry.nationality === 'Autres') {
				current.autPct = Math.round(entry.weight * 100);
			}
			summary.set(entry.gradeLevel, current);
		}
		return summary;
	}, [natEntries]);

	const rows = useMemo(() => {
		const filteredRows =
			bandFilter === 'ALL'
				? projectionRows
				: projectionRows.filter((row) => row.band === bandFilter);

		return filteredRows.map((row) => {
			const nationality = nationalityByGrade.get(row.gradeLevel) ?? {
				frPct: 0,
				natPct: 0,
				autPct: 0,
			};
			return {
				...row,
				frPct: nationality.frPct,
				natPct: nationality.natPct,
				autPct: nationality.autPct,
			};
		});
	}, [bandFilter, projectionRows, nationalityByGrade]);

	const handleHeadcountChange = useCallback(
		(gradeLevel: GradeCode, period: 'AY1' | 'AY2', value: number) => {
			if (isReadOnly) {
				return;
			}
			putHeadcount.mutate([
				{
					gradeLevel,
					academicPeriod: period,
					headcount: Math.max(0, Math.round(value)),
				},
			]);
		},
		[isReadOnly, putHeadcount]
	);

	const handleCohortChange = useCallback(
		(
			gradeLevel: GradeCode,
			field: keyof Pick<CohortParameterEntry, 'retentionRate' | 'manualAdjustment'>,
			value: number
		) => {
			if (isReadOnly) {
				return;
			}

			const existing = cohortEntries.find((entry) => entry.gradeLevel === gradeLevel);
			const baseEntry: CohortParameterEntry = {
				gradeLevel,
				retentionRate:
					existing?.retentionRate ??
					cohortData?.planningRules?.cappedRetention ??
					DEFAULT_PLANNING_RULES.cappedRetention ??
					0.98,
				manualAdjustment: existing?.manualAdjustment ?? existing?.lateralEntryCount ?? 0,
				lateralEntryCount: existing?.lateralEntryCount ?? 0,
				lateralWeightFr: existing?.lateralWeightFr ?? 0,
				lateralWeightNat: existing?.lateralWeightNat ?? 0,
				lateralWeightAut: existing?.lateralWeightAut ?? 0,
			};

			putCohortParams.mutate({
				entries: [
					{
						...baseEntry,
						[field]: field === 'retentionRate' ? value : Math.round(value),
					},
				],
			});
		},
		[cohortData?.planningRules?.cappedRetention, isReadOnly, cohortEntries, putCohortParams]
	);

	const columns = useMemo(
		() => [
			columnHelper.accessor('gradeName', {
				header: 'Grade',
				cell: (info) => (
					<div className="min-w-0">
						<span className="block font-medium text-(--text-primary)">{info.getValue()}</span>
						<span className="mt-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
							{info.row.original.gradeLevel}
						</span>
					</div>
				),
			}),
			columnHelper.accessor('ay1Headcount', {
				header: 'AY1',
				cell: (info) => (
					<EditableCell
						value={info.getValue()}
						onChange={(value) => handleHeadcountChange(info.row.original.gradeLevel, 'AY1', value)}
						type="number"
						isReadOnly={isReadOnly}
						className="px-3 py-1.5"
					/>
				),
			}),
			columnHelper.accessor('retentionRate', {
				header: 'Ret %',
				cell: (info) =>
					info.row.original.isPS ? (
						<span className="inline-block w-full px-2 py-1 text-right text-(--text-sm) text-(--text-muted)">
							—
						</span>
					) : (
						<EditableCell
							value={Math.round(info.getValue() * 100)}
							onChange={(value) =>
								handleCohortChange(info.row.original.gradeLevel, 'retentionRate', value)
							}
							type="percentage"
							isReadOnly={isReadOnly || info.row.original.usesConfiguredRetention !== true}
							className="px-3 py-1.5"
						/>
					),
			}),
			columnHelper.accessor('lateralEntry', {
				header: 'Laterals',
				cell: (info) =>
					info.row.original.isPS ? (
						<span className="inline-block w-full px-2 py-1 text-right text-(--text-sm) text-(--text-muted)">
							—
						</span>
					) : (
						<span
							className={cn(
								'inline-block w-full rounded-md border border-transparent px-3 py-1.5 text-right',
								'bg-(--cell-readonly-bg) font-medium text-(--text-secondary) tabular-nums'
							)}
						>
							{info.getValue()}
						</span>
					),
			}),
			columnHelper.accessor((row) => row.manualAdjustment ?? 0, {
				id: 'manualAdjustment',
				header: 'Override',
				cell: (info) =>
					info.row.original.isPS ? (
						<span className="inline-block w-full px-2 py-1 text-right text-(--text-sm) text-(--text-muted)">
							—
						</span>
					) : (
						<EditableCell
							value={info.getValue()}
							onChange={(value) =>
								handleCohortChange(info.row.original.gradeLevel, 'manualAdjustment', value)
							}
							type="number"
							isReadOnly={isReadOnly}
							className="px-3 py-1.5"
						/>
					),
			}),
			columnHelper.accessor('ay2Headcount', {
				header: 'AY2',
				cell: (info) =>
					info.row.original.isPS ? (
						<EditableCell
							value={info.getValue()}
							onChange={(value) =>
								handleHeadcountChange(info.row.original.gradeLevel, 'AY2', value)
							}
							type="number"
							isReadOnly={isReadOnly}
						/>
					) : (
						<span
							className={cn(
								'inline-block w-full rounded-md border border-transparent px-3 py-1.5 text-right',
								'bg-(--cell-readonly-bg) font-medium text-(--text-secondary) tabular-nums'
							)}
						>
							{info.getValue()}
						</span>
					),
			}),
			columnHelper.accessor('frPct', {
				header: 'Fr%',
				cell: (info) => (
					<span className="inline-flex w-full justify-end text-(--text-xs) font-medium tabular-nums text-(--text-muted)">
						{info.getValue() || 0}%
					</span>
				),
			}),
			columnHelper.accessor('natPct', {
				header: 'Nat%',
				cell: (info) => (
					<span className="inline-flex w-full justify-end text-(--text-xs) font-medium tabular-nums text-(--text-muted)">
						{info.getValue() || 0}%
					</span>
				),
			}),
			columnHelper.accessor('autPct', {
				header: 'Aut%',
				cell: (info) => (
					<span className="inline-flex w-full justify-end text-(--text-xs) font-medium tabular-nums text-(--text-muted)">
						{info.getValue() || 0}%
					</span>
				),
			}),
		],
		[handleCohortChange, handleHeadcountChange, isReadOnly]
	);

	const table = useReactTable({
		data: rows,
		columns,
		getCoreRowModel: getCoreRowModel(),
		enableColumnResizing: true,
		columnResizeMode: 'onChange',
	});

	return (
		<PlanningGrid
			table={table}
			isLoading={isLoading}
			onRowSelect={(row) => selectGrade(row.gradeLevel)}
			selectedRowPredicate={(row) => row.gradeLevel === selectedGrade}
			bandGrouping={{
				getBand: (row) => row.band,
				bandLabels: BAND_LABELS,
				bandStyles: {
					MATERNELLE: { color: 'var(--badge-maternelle)', bg: 'var(--badge-maternelle-bg)' },
					ELEMENTAIRE: { color: 'var(--badge-elementaire)', bg: 'var(--badge-elementaire-bg)' },
					COLLEGE: { color: 'var(--badge-college)', bg: 'var(--badge-college-bg)' },
					LYCEE: { color: 'var(--badge-lycee)', bg: 'var(--badge-lycee-bg)' },
				},
				collapsible: true,
				footerBuilder: buildBandFooterRow,
			}}
			footerRows={[
				{
					label: 'Grand total',
					type: 'grandtotal',
					values: {
						ay1Headcount: rows.reduce((sum, row) => sum + row.ay1Headcount, 0),
						retentionRate: '—',
						lateralEntry: rows.reduce((sum, row) => sum + row.lateralEntry, 0),
						ay2Headcount: rows.reduce((sum, row) => sum + row.ay2Headcount, 0),
					},
				},
			]}
			pinnedColumns={['gradeName']}
			numericColumns={['ay1Headcount', 'retentionRate', 'lateralEntry', 'ay2Headcount']}
			editableColumns={['ay1Headcount', 'retentionRate', 'lateralEntry', 'ay2Headcount']}
			ariaLabel="Cohort progression"
		/>
	);
}
