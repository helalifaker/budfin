import { useMemo } from 'react';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { cn } from '../../lib/cn';
import { PlanningGrid } from '../data-grid/planning-grid';
import { useNationalityBreakdown } from '../../hooks/use-nationality-breakdown';
import { useGradeLevels } from '../../hooks/use-grade-levels';

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
}

const columnHelper = createColumnHelper<NatRow>();

function buildBandFooterRow(rows: NatRow[], band: string) {
	if (rows.length === 0) {
		return null;
	}

	const total = rows.reduce((sum, row) => sum + row.total, 0);
	return {
		label: `${BAND_LABELS[band] ?? band} subtotal`,
		type: 'subtotal' as const,
		values: {
			francaisWt:
				total > 0
					? `${Math.round((rows.reduce((sum, row) => sum + row.francaisCnt, 0) / total) * 100)}%`
					: '—',
			francaisCnt: rows.reduce((sum, row) => sum + row.francaisCnt, 0),
			nationauxWt:
				total > 0
					? `${Math.round((rows.reduce((sum, row) => sum + row.nationauxCnt, 0) / total) * 100)}%`
					: '—',
			nationauxCnt: rows.reduce((sum, row) => sum + row.nationauxCnt, 0),
			autresWt:
				total > 0
					? `${Math.round((rows.reduce((sum, row) => sum + row.autresCnt, 0) / total) * 100)}%`
					: '—',
			autresCnt: rows.reduce((sum, row) => sum + row.autresCnt, 0),
			total,
			isOverridden: rows.some((row) => row.isOverridden) ? 'Mixed' : 'Computed',
		},
	};
}

export function NationalityDistributionGrid({
	versionId,
	bandFilter,
	isReadOnly: _isReadOnly,
}: NationalityDistributionGridProps) {
	const { data: natData, isLoading } = useNationalityBreakdown(versionId, 'AY2');
	const { data: gradeLevelData } = useGradeLevels();

	const gradeLevels = useMemo(
		() => gradeLevelData?.gradeLevels ?? [],
		[gradeLevelData?.gradeLevels]
	);
	const natEntries = useMemo(() => natData?.entries ?? [], [natData?.entries]);

	const rows = useMemo(() => {
		const entryMap = new Map<string, Map<string, (typeof natEntries)[number]>>();
		for (const entry of natEntries) {
			const existing = entryMap.get(entry.gradeLevel) ?? new Map();
			existing.set(entry.nationality, entry);
			entryMap.set(entry.gradeLevel, existing);
		}

		const filteredLevels =
			bandFilter === 'ALL'
				? gradeLevels
				: gradeLevels.filter((gradeLevel) => gradeLevel.band === bandFilter);

		return [...filteredLevels]
			.sort((left, right) => left.displayOrder - right.displayOrder)
			.map((gradeLevel) => {
				const nationalityMap = entryMap.get(gradeLevel.gradeCode);
				const francais = nationalityMap?.get('Francais');
				const nationaux = nationalityMap?.get('Nationaux');
				const autres = nationalityMap?.get('Autres');
				const total =
					(francais?.headcount ?? 0) + (nationaux?.headcount ?? 0) + (autres?.headcount ?? 0);

				return {
					gradeLevel: gradeLevel.gradeCode,
					gradeName: gradeLevel.gradeName,
					band: gradeLevel.band,
					displayOrder: gradeLevel.displayOrder,
					francaisWt: Math.round((francais?.weight ?? 0) * 100),
					francaisCnt: francais?.headcount ?? 0,
					nationauxWt: Math.round((nationaux?.weight ?? 0) * 100),
					nationauxCnt: nationaux?.headcount ?? 0,
					autresWt: Math.round((autres?.weight ?? 0) * 100),
					autresCnt: autres?.headcount ?? 0,
					total,
					isOverridden:
						francais?.isOverridden || nationaux?.isOverridden || autres?.isOverridden || false,
				};
			});
	}, [bandFilter, gradeLevels, natEntries]);

	const columns = useMemo(
		() => [
			columnHelper.accessor('gradeName', {
				header: 'Grade',
				cell: (info) => (
					<span className="font-medium text-(--text-primary)">{info.getValue()}</span>
				),
			}),
			columnHelper.accessor('francaisWt', {
				header: 'Fr %',
				cell: (info) => <span className="text-(--text-secondary)">{info.getValue()}%</span>,
			}),
			columnHelper.accessor('francaisCnt', {
				header: 'Fr Cnt',
				cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
			}),
			columnHelper.accessor('nationauxWt', {
				header: 'Nat %',
				cell: (info) => <span className="text-(--text-secondary)">{info.getValue()}%</span>,
			}),
			columnHelper.accessor('nationauxCnt', {
				header: 'Nat Cnt',
				cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
			}),
			columnHelper.accessor('autresWt', {
				header: 'Aut %',
				cell: (info) => <span className="text-(--text-secondary)">{info.getValue()}%</span>,
			}),
			columnHelper.accessor('autresCnt', {
				header: 'Aut Cnt',
				cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
			}),
			columnHelper.accessor('total', {
				header: 'Total',
				cell: (info) => (
					<span className="font-medium tabular-nums text-(--text-primary)">{info.getValue()}</span>
				),
			}),
			columnHelper.accessor('isOverridden', {
				header: 'Source',
				cell: (info) => (
					<span
						className={cn(
							'inline-flex rounded-full px-2 py-0.5 text-(--text-xs) font-semibold',
							info.getValue()
								? 'bg-(--color-warning-bg) text-(--color-warning)'
								: 'bg-(--workspace-bg-subtle) text-(--text-muted)'
						)}
					>
						{info.getValue() ? 'Override' : 'Computed'}
					</span>
				),
			}),
		],
		[]
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
			rangeSelection
			clipboardEnabled
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
						francaisCnt: rows.reduce((sum, row) => sum + row.francaisCnt, 0),
						nationauxCnt: rows.reduce((sum, row) => sum + row.nationauxCnt, 0),
						autresCnt: rows.reduce((sum, row) => sum + row.autresCnt, 0),
						total: rows.reduce((sum, row) => sum + row.total, 0),
					},
				},
			]}
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
			ariaLabel="Nationality distribution"
		/>
	);
}
