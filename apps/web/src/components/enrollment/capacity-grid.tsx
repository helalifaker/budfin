import { useMemo } from 'react';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { useGradeLevels } from '../../hooks/use-grade-levels';
import { AlertBadge, UtilizationCell } from './capacity-columns';
import { PlanningGrid } from '../data-grid/planning-grid';
import type { CapacityResult, CapacityAlert } from '@budfin/types';

export type CapacityGridProps = {
	versionId: number;
	bandFilter: string;
	capacityResults?: CapacityResult[] | undefined;
};

const BAND_LABELS: Record<string, string> = {
	MATERNELLE: 'Maternelle',
	ELEMENTAIRE: 'Elementaire',
	COLLEGE: 'College',
	LYCEE: 'Lycee',
};

interface CapRow {
	gradeLevel: string;
	gradeName: string;
	band: string;
	displayOrder: number;
	ay2Total: number;
	maxClassSize: number;
	sectionsNeeded: number;
	utilization: number;
	alert: CapacityAlert | null;
}

const columnHelper = createColumnHelper<CapRow>();

export function CapacityGrid({
	versionId: _versionId,
	bandFilter,
	capacityResults,
}: CapacityGridProps) {
	const { data: gradeLevelData, isLoading: gradesLoading } = useGradeLevels();
	const gradeLevels = useMemo(
		() => gradeLevelData?.gradeLevels ?? [],
		[gradeLevelData?.gradeLevels]
	);
	const hasResults = capacityResults && capacityResults.length > 0;

	const rows: CapRow[] = useMemo(() => {
		const capMap = new Map<string, CapacityResult>();
		if (capacityResults) {
			for (const r of capacityResults) {
				if (r.academicPeriod === 'AY2') {
					capMap.set(r.gradeLevel, r);
				}
			}
		}

		const filtered =
			bandFilter === 'ALL' ? gradeLevels : gradeLevels.filter((gl) => gl.band === bandFilter);

		return filtered
			.sort((a, b) => a.displayOrder - b.displayOrder)
			.map((gl) => {
				const cap = capMap.get(gl.gradeCode);
				return {
					gradeLevel: gl.gradeCode,
					gradeName: gl.gradeName,
					band: gl.band,
					displayOrder: gl.displayOrder,
					ay2Total: cap?.headcount ?? 0,
					maxClassSize: cap?.maxClassSize ?? gl.maxClassSize,
					sectionsNeeded: cap?.sectionsNeeded ?? 0,
					utilization: cap?.utilization ?? 0,
					alert: cap?.alert ?? null,
				};
			});
	}, [capacityResults, gradeLevels, bandFilter]);

	const columns = useMemo(
		() => [
			columnHelper.accessor('gradeName', {
				header: 'Grade',
				cell: (info) => (
					<span className="font-medium text-(--text-primary)">{info.getValue()}</span>
				),
			}),
			columnHelper.accessor('ay2Total', {
				header: 'AY2 Tot',
				cell: (info) => <span className="tabular-nums">{info.getValue() || '-'}</span>,
			}),
			columnHelper.accessor('maxClassSize', {
				header: 'Max Size',
				cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
			}),
			columnHelper.accessor('sectionsNeeded', {
				header: 'Sections',
				cell: (info) => {
					const val = info.getValue();
					return val > 0 ? (
						<span className="tabular-nums">{val}</span>
					) : (
						<span className="text-(--text-muted)">-</span>
					);
				},
			}),
			columnHelper.accessor('utilization', {
				header: 'Util %',
				cell: (info) => <UtilizationCell value={info.getValue()} />,
			}),
			columnHelper.accessor('alert', {
				header: 'Alert',
				cell: (info) => <AlertBadge alert={info.getValue()} />,
			}),
		],
		[]
	);

	const table = useReactTable({
		data: hasResults ? rows : [],
		columns,
		getCoreRowModel: getCoreRowModel(),
		enableColumnResizing: true,
		columnResizeMode: 'onChange' as const,
	});

	if (!gradesLoading && !hasResults) {
		return (
			<div className="rounded-(--radius-lg) border border-(--workspace-border) px-4 py-12 text-center">
				<p className="text-(--text-sm) text-(--text-muted)">
					Press Calculate to generate capacity results.
				</p>
			</div>
		);
	}

	return (
		<PlanningGrid
			table={table}
			isLoading={gradesLoading}
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
			numericColumns={['ay2Total', 'maxClassSize', 'sectionsNeeded', 'utilization']}
			ariaLabel="Capacity planning"
		/>
	);
}
