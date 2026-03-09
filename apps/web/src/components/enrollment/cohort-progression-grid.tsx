import { useMemo, useCallback } from 'react';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { cn } from '../../lib/cn';
import { PlanningGrid } from '../data-grid/planning-grid';
import { useHeadcount, usePutHeadcount } from '../../hooks/use-enrollment';
import { useCohortParameters, usePutCohortParameters } from '../../hooks/use-cohort-parameters';
import { useGradeLevels } from '../../hooks/use-grade-levels';
import { EditableCell } from '../shared/editable-cell';
import type { HeadcountEntry, CohortParameterEntry } from '@budfin/types';

export type CohortProgressionGridProps = {
	versionId: number;
	bandFilter: string;
	isReadOnly: boolean;
};

const BAND_LABELS: Record<string, string> = {
	MATERNELLE: 'Maternelle',
	ELEMENTAIRE: 'Elementaire',
	COLLEGE: 'College',
	LYCEE: 'Lycee',
};

const BAND_STYLES: Record<string, string> = {
	MATERNELLE: 'bg-(--badge-maternelle-bg) text-(--badge-maternelle)',
	ELEMENTAIRE: 'bg-(--badge-elementaire-bg) text-(--badge-elementaire)',
	COLLEGE: 'bg-(--badge-college-bg) text-(--badge-college)',
	LYCEE: 'bg-(--badge-lycee-bg) text-(--badge-lycee)',
};

interface CohortRow {
	gradeLevel: string;
	gradeName: string;
	band: string;
	displayOrder: number;
	ay1Headcount: number;
	retentionRate: number;
	lateralEntry: number;
	ay2Total: number;
	isPS: boolean;
}

const columnHelper = createColumnHelper<CohortRow>();

export function CohortProgressionGrid({
	versionId,
	bandFilter,
	isReadOnly,
}: CohortProgressionGridProps) {
	const { data: headcountData, isLoading: headcountLoading } = useHeadcount(versionId);
	const { data: cohortData, isLoading: cohortLoading } = useCohortParameters(versionId);
	const { data: gradeLevelData } = useGradeLevels();
	const putHeadcount = usePutHeadcount(versionId);
	const putCohortParams = usePutCohortParameters(versionId);

	const isLoading = headcountLoading || cohortLoading;

	const gradeLevels = useMemo(
		() => gradeLevelData?.gradeLevels ?? [],
		[gradeLevelData?.gradeLevels]
	);
	const entries = useMemo(() => headcountData?.entries ?? [], [headcountData?.entries]);
	const cohortEntries = useMemo(() => cohortData?.entries ?? [], [cohortData?.entries]);

	const rows: CohortRow[] = useMemo(() => {
		const ay1Map = new Map<string, number>();
		const ay2Map = new Map<string, number>();
		for (const e of entries) {
			if (e.academicPeriod === 'AY1') ay1Map.set(e.gradeLevel, e.headcount);
			if (e.academicPeriod === 'AY2') ay2Map.set(e.gradeLevel, e.headcount);
		}

		const cohortMap = new Map<string, CohortParameterEntry>();
		for (const c of cohortEntries) {
			cohortMap.set(c.gradeLevel, c);
		}

		const filtered =
			bandFilter === 'ALL' ? gradeLevels : gradeLevels.filter((gl) => gl.band === bandFilter);

		return filtered
			.sort((a, b) => a.displayOrder - b.displayOrder)
			.map((gl) => {
				const ay1 = ay1Map.get(gl.gradeCode) ?? 0;
				const cohort = cohortMap.get(gl.gradeCode);
				const isPS = gl.gradeCode === 'PS';
				const retRate = cohort?.retentionRate ?? 0;
				const lateral = cohort?.lateralEntryCount ?? 0;
				const ay2 = isPS ? (ay2Map.get(gl.gradeCode) ?? 0) : Math.round(ay1 * retRate + lateral);

				return {
					gradeLevel: gl.gradeCode,
					gradeName: gl.gradeName,
					band: gl.band,
					displayOrder: gl.displayOrder,
					ay1Headcount: ay1,
					retentionRate: retRate,
					lateralEntry: lateral,
					ay2Total: ay2,
					isPS,
				};
			});
	}, [entries, cohortEntries, gradeLevels, bandFilter]);

	const handleHeadcountChange = useCallback(
		(gradeLevel: string, period: 'AY1' | 'AY2', value: number) => {
			if (isReadOnly) return;
			const entry: HeadcountEntry = {
				gradeLevel: gradeLevel as HeadcountEntry['gradeLevel'],
				academicPeriod: period,
				headcount: Math.round(value),
			};
			putHeadcount.mutate([entry]);
		},
		[isReadOnly, putHeadcount]
	);

	const handleCohortChange = useCallback(
		(gradeLevel: string, field: 'retentionRate' | 'lateralEntryCount', value: number) => {
			if (isReadOnly) return;
			const existing = cohortEntries.find((c) => c.gradeLevel === gradeLevel);
			const entry: CohortParameterEntry = {
				gradeLevel: gradeLevel as CohortParameterEntry['gradeLevel'],
				retentionRate: existing?.retentionRate ?? 0,
				lateralEntryCount: existing?.lateralEntryCount ?? 0,
				lateralWeightFr: existing?.lateralWeightFr ?? 0,
				lateralWeightNat: existing?.lateralWeightNat ?? 0,
				lateralWeightAut: existing?.lateralWeightAut ?? 0,
				[field]: value,
			};
			putCohortParams.mutate([entry]);
		},
		[isReadOnly, cohortEntries, putCohortParams]
	);

	const columns = useMemo(
		() => [
			columnHelper.accessor('gradeName', {
				header: 'Grade',
				cell: (info) => (
					<span className="font-medium text-(--text-primary)">{info.getValue()}</span>
				),
			}),
			columnHelper.accessor('band', {
				header: 'Band',
				cell: (info) => {
					const band = info.getValue();
					return (
						<span
							className={cn(
								'inline-block rounded-(--radius-sm) px-2 py-0.5',
								'text-(--text-xs) font-medium',
								BAND_STYLES[band] ?? ''
							)}
						>
							{BAND_LABELS[band] ?? band}
						</span>
					);
				},
			}),
			columnHelper.accessor('ay1Headcount', {
				header: 'AY1 Hdc',
				cell: (info) => (
					<EditableCell
						value={info.getValue()}
						onChange={(val) => handleHeadcountChange(info.row.original.gradeLevel, 'AY1', val)}
						type="number"
						isReadOnly={isReadOnly}
					/>
				),
			}),
			columnHelper.accessor('retentionRate', {
				header: 'Ret %',
				cell: (info) => {
					if (info.row.original.isPS) {
						return (
							<span className="inline-block w-full px-2 py-1 text-right text-(--text-sm) text-(--text-muted)">
								-
							</span>
						);
					}
					return (
						<EditableCell
							value={Math.round(info.getValue() * 100)}
							onChange={(val) =>
								handleCohortChange(info.row.original.gradeLevel, 'retentionRate', val)
							}
							type="percentage"
							isReadOnly={isReadOnly}
						/>
					);
				},
			}),
			columnHelper.accessor('lateralEntry', {
				header: 'Lat.Ent',
				cell: (info) => {
					if (info.row.original.isPS) {
						return (
							<span className="inline-block w-full px-2 py-1 text-right text-(--text-sm) text-(--text-muted)">
								-
							</span>
						);
					}
					return (
						<EditableCell
							value={info.getValue()}
							onChange={(val) =>
								handleCohortChange(info.row.original.gradeLevel, 'lateralEntryCount', val)
							}
							type="number"
							isReadOnly={isReadOnly}
						/>
					);
				},
			}),
			columnHelper.accessor('ay2Total', {
				header: 'AY2 Tot',
				cell: (info) => {
					if (info.row.original.isPS) {
						return (
							<EditableCell
								value={info.getValue()}
								onChange={(val) => handleHeadcountChange(info.row.original.gradeLevel, 'AY2', val)}
								type="number"
								isReadOnly={isReadOnly}
							/>
						);
					}
					return (
						<span
							className={cn(
								'inline-block w-full rounded-sm px-2 py-1',
								'text-right text-(--text-sm) tabular-nums',
								'bg-(--cell-readonly-bg) text-(--text-secondary)'
							)}
						>
							{info.getValue().toLocaleString()}
						</span>
					);
				},
			}),
		],
		[isReadOnly, handleHeadcountChange, handleCohortChange]
	);

	const table = useReactTable({
		data: rows,
		columns,
		getCoreRowModel: getCoreRowModel(),
		enableColumnResizing: true,
		columnResizeMode: 'onChange' as const,
	});

	return (
		<PlanningGrid
			table={table}
			isLoading={isLoading}
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
			}}
			pinnedColumns={['gradeName']}
			numericColumns={['ay1Headcount', 'retentionRate', 'lateralEntry', 'ay2Total']}
			editableColumns={['ay1Headcount', 'retentionRate', 'lateralEntry']}
			ariaLabel="Cohort progression"
		/>
	);
}
