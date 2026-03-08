import { useMemo, useCallback } from 'react';
import {
	createColumnHelper,
	flexRender,
	getCoreRowModel,
	useReactTable,
} from '@tanstack/react-table';
import { cn } from '../../lib/cn';
import { useHeadcount, usePutHeadcount } from '../../hooks/use-enrollment';
import { useCohortParameters, usePutCohortParameters } from '../../hooks/use-cohort-parameters';
import { useGradeLevels } from '../../hooks/use-grade-levels';
import { EditableCell } from '../shared/editable-cell';
import { TableSkeleton } from '../ui/skeleton';
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
	MATERNELLE: 'bg-[var(--badge-maternelle-bg)] text-[var(--badge-maternelle)]',
	ELEMENTAIRE: 'bg-[var(--badge-elementaire-bg)] text-[var(--badge-elementaire)]',
	COLLEGE: 'bg-[var(--badge-college-bg)] text-[var(--badge-college)]',
	LYCEE: 'bg-[var(--badge-lycee-bg)] text-[var(--badge-lycee)]',
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

	const gradeLevels = gradeLevelData?.gradeLevels ?? [];
	const entries = headcountData?.entries ?? [];
	const cohortEntries = cohortData?.entries ?? [];

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

	const bands = useMemo(() => {
		const bandMap = new Map<string, CohortRow[]>();
		for (const row of rows) {
			const existing = bandMap.get(row.band) ?? [];
			existing.push(row);
			bandMap.set(row.band, existing);
		}
		return bandMap;
	}, [rows]);

	const columns = useMemo(
		() => [
			columnHelper.accessor('gradeName', {
				header: 'Grade',
				cell: (info) => (
					<span className="font-medium text-[var(--text-primary)]">{info.getValue()}</span>
				),
			}),
			columnHelper.accessor('band', {
				header: 'Band',
				cell: (info) => {
					const band = info.getValue();
					return (
						<span
							className={cn(
								'inline-block rounded-[var(--radius-sm)] px-2 py-0.5',
								'text-[length:var(--text-xs)] font-medium',
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
							<span className="inline-block w-full px-2 py-1 text-right text-[length:var(--text-sm)] text-[var(--text-muted)]">
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
							<span className="inline-block w-full px-2 py-1 text-right text-[length:var(--text-sm)] text-[var(--text-muted)]">
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
								'text-right text-[length:var(--text-sm)] tabular-nums',
								'bg-[var(--cell-readonly-bg)] text-[var(--text-secondary)]'
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
	});

	return (
		<div className="overflow-x-auto rounded-[var(--radius-lg)] border">
			<table
				role="grid"
				className="w-full text-left text-[length:var(--text-sm)]"
				aria-label="Cohort progression"
			>
				<thead className="border-b bg-[var(--workspace-bg-muted)]">
					{table.getHeaderGroups().map((hg) => (
						<tr key={hg.id}>
							{hg.headers.map((header) => (
								<th key={header.id} className="px-4 py-3 font-medium text-[var(--text-secondary)]">
									{flexRender(header.column.columnDef.header, header.getContext())}
								</th>
							))}
						</tr>
					))}
				</thead>
				<tbody>
					{isLoading ? (
						<TableSkeleton rows={15} cols={columns.length} />
					) : rows.length === 0 ? (
						<tr>
							<td
								colSpan={columns.length}
								className="px-4 py-6 text-center text-[var(--text-muted)]"
							>
								No cohort data available. Enter headcount to begin.
							</td>
						</tr>
					) : (
						[...bands.entries()].map(([band, bandRows]) => (
							<BandGroup
								key={band}
								band={band}
								bandRows={bandRows}
								table={table}
								colCount={columns.length}
							/>
						))
					)}
				</tbody>
			</table>
		</div>
	);
}

function BandGroup({
	band,
	bandRows,
	table,
	colCount,
}: {
	band: string;
	bandRows: CohortRow[];
	table: ReturnType<typeof useReactTable<CohortRow>>;
	colCount: number;
}) {
	return (
		<>
			<tr className="bg-[var(--workspace-bg-muted)]/50">
				<td
					colSpan={colCount}
					className="px-4 py-1.5 text-[length:var(--text-xs)] font-semibold uppercase tracking-wider text-[var(--text-muted)]"
				>
					{BAND_LABELS[band] ?? band} ({bandRows.length} grades)
				</td>
			</tr>
			{bandRows.map((row) => {
				const tableRow = table
					.getRowModel()
					.rows.find((r) => r.original.gradeLevel === row.gradeLevel);
				if (!tableRow) return null;
				return (
					<tr
						key={tableRow.id}
						className="border-b transition-colors duration-[var(--duration-fast)] last:border-0 hover:bg-[var(--accent-50)]"
					>
						{tableRow.getVisibleCells().map((cell) => (
							<td key={cell.id} className="px-4 py-2">
								{flexRender(cell.column.columnDef.cell, cell.getContext())}
							</td>
						))}
					</tr>
				);
			})}
		</>
	);
}
