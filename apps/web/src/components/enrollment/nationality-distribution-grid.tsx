import { useMemo, useCallback, useState } from 'react';
import {
	createColumnHelper,
	flexRender,
	getCoreRowModel,
	useReactTable,
} from '@tanstack/react-table';
import { cn } from '../../lib/cn';
import {
	useNationalityBreakdown,
	usePutNationalityBreakdown,
} from '../../hooks/use-nationality-breakdown';
import { useGradeLevels } from '../../hooks/use-grade-levels';
import { EditableCell } from '../shared/editable-cell';
import { TableSkeleton } from '../ui/skeleton';
import type { NationalityBreakdownEntry } from '@budfin/types';

export type NationalityDistributionGridProps = {
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

interface NatRow {
	gradeLevel: string;
	gradeName: string;
	band: string;
	displayOrder: number;
	francaisWt: number;
	francaisCnt: number;
	nationauxWt: number;
	nationauxCnt: number;
	autresWt: number;
	autresCnt: number;
	total: number;
	isOverridden: boolean;
	isPS: boolean;
}

const columnHelper = createColumnHelper<NatRow>();

export function NationalityDistributionGrid({
	versionId,
	bandFilter,
	isReadOnly,
}: NationalityDistributionGridProps) {
	const { data: natData, isLoading } = useNationalityBreakdown(versionId, 'AY2');
	const { data: gradeLevelData } = useGradeLevels();
	const putNationality = usePutNationalityBreakdown(versionId);
	const [localOverrides, setLocalOverrides] = useState<Set<string>>(new Set());

	const gradeLevels = useMemo(
		() => gradeLevelData?.gradeLevels ?? [],
		[gradeLevelData?.gradeLevels]
	);
	const natEntries = useMemo(() => natData?.entries ?? [], [natData?.entries]);

	const rows: NatRow[] = useMemo(() => {
		const natMap = new Map<string, Map<string, NationalityBreakdownEntry>>();
		for (const e of natEntries) {
			if (!natMap.has(e.gradeLevel)) natMap.set(e.gradeLevel, new Map());
			natMap.get(e.gradeLevel)!.set(e.nationality, e);
		}

		const filtered =
			bandFilter === 'ALL' ? gradeLevels : gradeLevels.filter((gl) => gl.band === bandFilter);

		return filtered
			.sort((a, b) => a.displayOrder - b.displayOrder)
			.map((gl) => {
				const gradeNats = natMap.get(gl.gradeCode);
				const fr = gradeNats?.get('Francais');
				const nat = gradeNats?.get('Nationaux');
				const aut = gradeNats?.get('Autres');

				const isOverridden =
					fr?.isOverridden ||
					nat?.isOverridden ||
					aut?.isOverridden ||
					localOverrides.has(gl.gradeCode) ||
					false;

				const francaisCnt = fr?.headcount ?? 0;
				const nationauxCnt = nat?.headcount ?? 0;
				const autresCnt = aut?.headcount ?? 0;
				const total = francaisCnt + nationauxCnt + autresCnt;

				return {
					gradeLevel: gl.gradeCode,
					gradeName: gl.gradeName,
					band: gl.band,
					displayOrder: gl.displayOrder,
					francaisWt: fr?.weight ?? 0,
					francaisCnt,
					nationauxWt: nat?.weight ?? 0,
					nationauxCnt,
					autresWt: aut?.weight ?? 0,
					autresCnt,
					total,
					isOverridden,
					isPS: gl.gradeCode === 'PS',
				};
			});
	}, [natEntries, gradeLevels, bandFilter, localOverrides]);

	const handleWeightChange = useCallback(
		(gradeLevel: string, nationality: string, weight: number) => {
			if (isReadOnly) return;
			const row = rows.find((r) => r.gradeLevel === gradeLevel);
			if (!row) return;
			putNationality.mutate([
				{
					gradeLevel,
					nationality,
					weight,
					headcount: Math.round(row.total * weight),
				},
			]);
		},
		[isReadOnly, rows, putNationality]
	);

	const handleOverrideToggle = useCallback(
		(gradeLevel: string) => {
			if (isReadOnly) return;
			setLocalOverrides((prev) => {
				const next = new Set(prev);
				if (next.has(gradeLevel)) {
					next.delete(gradeLevel);
				} else {
					next.add(gradeLevel);
				}
				return next;
			});
		},
		[isReadOnly]
	);

	const bands = useMemo(() => {
		const bandMap = new Map<string, NatRow[]>();
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
			columnHelper.accessor('francaisWt', {
				header: 'Francais Wt%',
				cell: (info) => {
					const row = info.row.original;
					const canEdit = row.isPS || row.isOverridden;
					return (
						<EditableCell
							value={Math.round(info.getValue() * 100)}
							onChange={(val) => handleWeightChange(row.gradeLevel, 'Francais', val)}
							type="percentage"
							isReadOnly={isReadOnly || !canEdit}
						/>
					);
				},
			}),
			columnHelper.accessor('francaisCnt', {
				header: 'Francais Cnt',
				cell: (info) => (
					<span
						className={cn(
							'inline-block w-full rounded-sm px-2 py-1',
							'text-right text-[length:var(--text-sm)] tabular-nums',
							'bg-[var(--cell-readonly-bg)] text-[var(--text-secondary)]'
						)}
					>
						{info.getValue()}
					</span>
				),
			}),
			columnHelper.accessor('nationauxWt', {
				header: 'Nationaux Wt%',
				cell: (info) => {
					const row = info.row.original;
					const canEdit = row.isPS || row.isOverridden;
					return (
						<EditableCell
							value={Math.round(info.getValue() * 100)}
							onChange={(val) => handleWeightChange(row.gradeLevel, 'Nationaux', val)}
							type="percentage"
							isReadOnly={isReadOnly || !canEdit}
						/>
					);
				},
			}),
			columnHelper.accessor('nationauxCnt', {
				header: 'Nationaux Cnt',
				cell: (info) => (
					<span
						className={cn(
							'inline-block w-full rounded-sm px-2 py-1',
							'text-right text-[length:var(--text-sm)] tabular-nums',
							'bg-[var(--cell-readonly-bg)] text-[var(--text-secondary)]'
						)}
					>
						{info.getValue()}
					</span>
				),
			}),
			columnHelper.accessor('autresWt', {
				header: 'Autres Wt%',
				cell: (info) => {
					const row = info.row.original;
					const canEdit = row.isPS || row.isOverridden;
					return (
						<EditableCell
							value={Math.round(info.getValue() * 100)}
							onChange={(val) => handleWeightChange(row.gradeLevel, 'Autres', val)}
							type="percentage"
							isReadOnly={isReadOnly || !canEdit}
						/>
					);
				},
			}),
			columnHelper.accessor('autresCnt', {
				header: 'Autres Cnt',
				cell: (info) => (
					<span
						className={cn(
							'inline-block w-full rounded-sm px-2 py-1',
							'text-right text-[length:var(--text-sm)] tabular-nums',
							'bg-[var(--cell-readonly-bg)] text-[var(--text-secondary)]'
						)}
					>
						{info.getValue()}
					</span>
				),
			}),
			columnHelper.accessor('total', {
				header: 'Total',
				cell: (info) => <span className="font-medium tabular-nums">{info.getValue()}</span>,
			}),
			columnHelper.accessor('isOverridden', {
				header: 'Override',
				cell: (info) => {
					const row = info.row.original;
					if (row.isPS) return null;
					return (
						<button
							type="button"
							className={cn(
								'rounded-[var(--radius-sm)] px-2 py-1',
								'text-[length:var(--text-xs)] font-medium',
								'transition-colors duration-[var(--duration-fast)]',
								info.getValue()
									? 'bg-[var(--cell-override-bg)] text-[var(--badge-lycee)]'
									: 'bg-[var(--workspace-bg-muted)] text-[var(--text-muted)]',
								isReadOnly && 'pointer-events-none opacity-50'
							)}
							onClick={() => handleOverrideToggle(row.gradeLevel)}
							disabled={isReadOnly}
							aria-pressed={info.getValue()}
							aria-label={`${info.getValue() ? 'Disable' : 'Enable'} override for ${row.gradeName}`}
						>
							{info.getValue() ? 'On' : 'Off'}
						</button>
					);
				},
			}),
		],
		[isReadOnly, handleWeightChange, handleOverrideToggle]
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
				aria-label="Nationality distribution"
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
								No nationality data available.
							</td>
						</tr>
					) : (
						[...bands.entries()].map(([band, bandRows]) => (
							<NatBandGroup
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

function NatBandGroup({
	band,
	bandRows,
	table,
	colCount,
}: {
	band: string;
	bandRows: NatRow[];
	table: ReturnType<typeof useReactTable<NatRow>>;
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
						className={cn(
							'border-b transition-colors duration-[var(--duration-fast)] last:border-0',
							row.isOverridden
								? 'bg-[var(--cell-override-bg)]/30 hover:bg-[var(--cell-override-bg)]/50'
								: 'hover:bg-[var(--accent-50)]'
						)}
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
