import { useMemo } from 'react';
import {
	createColumnHelper,
	flexRender,
	getCoreRowModel,
	useReactTable,
} from '@tanstack/react-table';
import { Check, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/cn';
import { useHeadcount, useDetail } from '../../hooks/use-enrollment';
import { useGradeLevels } from '../../hooks/use-grade-levels';
import type { AcademicPeriod } from '@budfin/types';
import type { GradeBand } from '../../hooks/use-grade-levels';
import { TableSkeleton } from '../ui/skeleton';

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
				header: 'Grade',
				cell: (info) => (
					<span className="font-medium text-[var(--text-primary)]">{info.getValue()}</span>
				),
			}),
			columnHelper.accessor('francais', {
				header: 'Francais',
				cell: (info) => (
					<span className="inline-block w-16 px-2 py-1 text-right text-[length:var(--text-sm)] tabular-nums">
						{info.getValue()}
					</span>
				),
			}),
			columnHelper.accessor('nationaux', {
				header: 'Nationaux',
				cell: (info) => (
					<span className="inline-block w-16 px-2 py-1 text-right text-[length:var(--text-sm)] tabular-nums">
						{info.getValue()}
					</span>
				),
			}),
			columnHelper.accessor('autres', {
				header: 'Autres',
				cell: (info) => (
					<span className="inline-block w-16 px-2 py-1 text-right text-[length:var(--text-sm)] tabular-nums">
						{info.getValue()}
					</span>
				),
			}),
			columnHelper.accessor('total', {
				header: 'Total',
				cell: (info) => <span className="font-medium tabular-nums">{info.getValue()}</span>,
			}),
			columnHelper.accessor('matches', {
				header: 'Match',
				cell: (info) => {
					const row = info.row.original;
					if (row.stage1Total === 0) {
						return <span className="text-[var(--text-muted)]">-</span>;
					}
					return info.getValue() ? (
						<Check className="h-4 w-4 text-[var(--color-success)]" aria-label="Totals match" />
					) : (
						<AlertTriangle
							className="h-4 w-4 text-[var(--color-warning)]"
							aria-label="Totals do not match"
						/>
					);
				},
			}),
			columnHelper.accessor('stage1Total', {
				header: 'Stage 1',
				cell: (info) => (
					<span className="text-[var(--text-muted)] tabular-nums">{info.getValue()}</span>
				),
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
				<div className="mb-2 flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-warning-bg)] px-3 py-2 text-[length:var(--text-sm)] text-[var(--color-warning)]">
					<AlertTriangle className="h-4 w-4" />
					{mismatchCount} grade{mismatchCount > 1 ? 's' : ''} with nationality total mismatch
				</div>
			)}
			<div className="overflow-x-auto rounded-[var(--radius-lg)] border">
				<table
					role="table"
					className="w-full text-left text-[length:var(--text-sm)]"
					aria-label="Enrollment by nationality"
				>
					<thead className="border-b bg-[var(--workspace-bg-muted)]">
						{table.getHeaderGroups().map((hg) => (
							<tr key={hg.id}>
								{hg.headers.map((header) => (
									<th
										key={header.id}
										className="px-4 py-3 font-medium text-[var(--text-secondary)]"
									>
										{flexRender(header.column.columnDef.header, header.getContext())}
									</th>
								))}
							</tr>
						))}
					</thead>
					<tbody>
						{isLoading ? (
							<TableSkeleton rows={15} cols={columns.length} />
						) : (
							table.getRowModel().rows.map((row) => (
								<tr
									key={row.id}
									className={cn(
										'border-b last:border-0 hover:bg-[var(--accent-50)] transition-colors duration-[var(--duration-fast)]',
										!row.original.matches &&
											row.original.stage1Total > 0 &&
											'bg-[var(--color-warning-bg)]/30'
									)}
								>
									{row.getVisibleCells().map((cell) => (
										<td key={cell.id} className="px-4 py-2">
											{flexRender(cell.column.columnDef.cell, cell.getContext())}
										</td>
									))}
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>
		</div>
	);
}
