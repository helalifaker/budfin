import { useMemo } from 'react';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Check, AlertTriangle } from 'lucide-react';
import { useHeadcount, useDetail } from '../../hooks/use-enrollment';
import { useGradeLevels } from '../../hooks/use-grade-levels';
import type { AcademicPeriod } from '@budfin/types';
import type { GradeBand } from '../../hooks/use-grade-levels';
import { PlanningGrid } from '../data-grid/planning-grid';

interface NationalityRow {
	gradeLevel: string;
	gradeName: string;
	band: string;
	displayOrder: number;
	francais: number;
	nationaux: number;
	autres: number;
	total: number;
	stage1Total: number;
	matches: boolean;
}

const columnHelper = createColumnHelper<NationalityRow>();

interface Props {
	versionId: number;
	isReadOnly: boolean;
	bandFilter: GradeBand | 'ALL';
	academicPeriod: string;
}

export function ByNationalityGrid({ versionId, bandFilter, academicPeriod }: Props) {
	const { data: headcountData } = useHeadcount(versionId, academicPeriod as AcademicPeriod);
	const { data: detailData, isLoading } = useDetail(versionId, academicPeriod as AcademicPeriod);
	const { data: gradeLevelData } = useGradeLevels();

	const rows: NationalityRow[] = useMemo(() => {
		const gradeLevels = gradeLevelData?.gradeLevels ?? [];
		const headcountEntries = headcountData?.entries ?? [];
		const detailEntries = detailData?.entries ?? [];

		const filtered =
			bandFilter === 'ALL' ? gradeLevels : gradeLevels.filter((gl) => gl.band === bandFilter);

		return filtered
			.sort((a, b) => a.displayOrder - b.displayOrder)
			.map((gl) => {
				const gradeDetails = detailEntries.filter((d) => d.gradeLevel === gl.gradeCode);
				const francais = gradeDetails
					.filter((d) => d.nationality === 'Francais')
					.reduce((sum, d) => sum + d.headcount, 0);
				const nationaux = gradeDetails
					.filter((d) => d.nationality === 'Nationaux')
					.reduce((sum, d) => sum + d.headcount, 0);
				const autres = gradeDetails
					.filter((d) => d.nationality === 'Autres')
					.reduce((sum, d) => sum + d.headcount, 0);
				const total = francais + nationaux + autres;

				const stage1Total = headcountEntries
					.filter((h) => h.gradeLevel === gl.gradeCode)
					.reduce((sum, h) => sum + h.headcount, 0);

				return {
					gradeLevel: gl.gradeCode,
					gradeName: gl.gradeName,
					band: gl.band,
					displayOrder: gl.displayOrder,
					francais,
					nationaux,
					autres,
					total,
					stage1Total,
					matches: total === stage1Total,
				};
			});
	}, [gradeLevelData, detailData, headcountData, bandFilter]);

	const mismatchCount = useMemo(
		() => rows.filter((r) => !r.matches && r.stage1Total > 0).length,
		[rows]
	);

	const columns = useMemo(
		() => [
			columnHelper.accessor('gradeName', {
				id: 'gradeName',
				header: 'Grade',
				cell: (info) => (
					<span className="font-medium text-(--text-primary)">{info.getValue()}</span>
				),
			}),
			columnHelper.accessor('francais', {
				id: 'francais',
				header: 'Francais',
				cell: (info) => (
					<span className="inline-block w-16 px-2 py-1 text-right text-(--text-sm) tabular-nums">
						{info.getValue()}
					</span>
				),
			}),
			columnHelper.accessor('nationaux', {
				id: 'nationaux',
				header: 'Nationaux',
				cell: (info) => (
					<span className="inline-block w-16 px-2 py-1 text-right text-(--text-sm) tabular-nums">
						{info.getValue()}
					</span>
				),
			}),
			columnHelper.accessor('autres', {
				id: 'autres',
				header: 'Autres',
				cell: (info) => (
					<span className="inline-block w-16 px-2 py-1 text-right text-(--text-sm) tabular-nums">
						{info.getValue()}
					</span>
				),
			}),
			columnHelper.accessor('total', {
				id: 'total',
				header: 'Total',
				cell: (info) => <span className="font-medium tabular-nums">{info.getValue()}</span>,
			}),
			columnHelper.accessor('matches', {
				id: 'matches',
				header: 'Match',
				cell: (info) => {
					const row = info.row.original;
					if (row.stage1Total === 0) {
						return <span className="text-(--text-muted)">-</span>;
					}
					return info.getValue() ? (
						<Check className="h-4 w-4 text-(--color-success)" aria-label="Totals match" />
					) : (
						<AlertTriangle
							className="h-4 w-4 text-(--color-warning)"
							aria-label="Totals do not match"
						/>
					);
				},
			}),
			columnHelper.accessor('stage1Total', {
				id: 'stage1Total',
				header: 'Stage 1',
				cell: (info) => <span className="text-(--text-muted) tabular-nums">{info.getValue()}</span>,
			}),
		],
		[]
	);

	const table = useReactTable({
		data: rows,
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	return (
		<div>
			{mismatchCount > 0 && (
				<div className="mb-2 flex items-center gap-2 rounded-md bg-(--color-warning-bg) px-3 py-2 text-(--text-sm) text-(--color-warning)">
					<AlertTriangle className="h-4 w-4" />
					{mismatchCount} grade{mismatchCount > 1 ? 's' : ''} with nationality total mismatch
				</div>
			)}
			<PlanningGrid
				table={table}
				isLoading={isLoading}
				ariaLabel="Enrollment by nationality"
				rangeSelection
				clipboardEnabled
				pinnedColumns={['gradeName']}
				numericColumns={['francais', 'nationaux', 'autres', 'total', 'stage1Total']}
				getRowClassName={(row) =>
					!row.matches && row.stage1Total > 0 ? 'bg-(--color-warning-bg)/30' : undefined
				}
			/>
		</div>
	);
}
