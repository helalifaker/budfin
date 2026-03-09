import { useMemo, useCallback, useState } from 'react';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { cn } from '../../lib/cn';
import { PlanningGrid } from '../data-grid/planning-grid';
import {
	useNationalityBreakdown,
	usePutNationalityBreakdown,
} from '../../hooks/use-nationality-breakdown';
import { useGradeLevels } from '../../hooks/use-grade-levels';
import { EditableCell } from '../shared/editable-cell';
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

	const columns = useMemo(
		() => [
			columnHelper.accessor('gradeName', {
				header: 'Grade',
				cell: (info) => (
					<span className="font-medium text-(--text-primary)">{info.getValue()}</span>
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
							'text-right text-(--text-sm) tabular-nums',
							'bg-(--cell-readonly-bg) text-(--text-secondary)'
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
							'text-right text-(--text-sm) tabular-nums',
							'bg-(--cell-readonly-bg) text-(--text-secondary)'
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
							'text-right text-(--text-sm) tabular-nums',
							'bg-(--cell-readonly-bg) text-(--text-secondary)'
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
								'rounded-(--radius-sm) px-2 py-1',
								'text-(--text-xs) font-medium',
								'transition-colors duration-(--duration-fast)',
								info.getValue()
									? 'bg-(--cell-override-bg) text-(--badge-lycee)'
									: 'bg-(--workspace-bg-muted) text-(--text-muted)',
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
			numericColumns={[
				'francaisWt',
				'francaisCnt',
				'nationauxWt',
				'nationauxCnt',
				'autresWt',
				'autresCnt',
				'total',
			]}
			editableColumns={['francaisWt', 'nationauxWt', 'autresWt']}
			ariaLabel="Nationality distribution"
		/>
	);
}
