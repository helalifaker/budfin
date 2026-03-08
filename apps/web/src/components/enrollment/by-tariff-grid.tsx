import { useMemo, useCallback } from 'react';
import {
	createColumnHelper,
	flexRender,
	getCoreRowModel,
	useReactTable,
} from '@tanstack/react-table';
import { useDetail, usePutDetail } from '../../hooks/use-enrollment';
import { useGradeLevels } from '../../hooks/use-grade-levels';
import type { AcademicPeriod, DetailEntry } from '@budfin/types';
import type { GradeBand } from '../../hooks/use-grade-levels';
import { TableSkeleton } from '../ui/skeleton';
import { EditableCell } from '../shared/editable-cell';

interface TariffRow {
	gradeLevel: string;
	gradeName: string;
	band: string;
	displayOrder: number;
	francaisRp: number;
	francaisR3: number;
	francaisPlein: number;
	nationauxRp: number;
	nationauxR3: number;
	nationauxPlein: number;
	autresRp: number;
	autresR3: number;
	autresPlein: number;
	total: number;
}

const columnHelper = createColumnHelper<TariffRow>();

const NATIONALITIES = ['Francais', 'Nationaux', 'Autres'] as const;
const TARIFF_TYPES = ['RP', 'R3+', 'Plein'] as const;

interface Props {
	versionId: number;
	isReadOnly: boolean;
	bandFilter: GradeBand | 'ALL';
	academicPeriod: string;
}

export function ByTariffGrid({ versionId, isReadOnly, bandFilter, academicPeriod }: Props) {
	const { data: detailData, isLoading } = useDetail(versionId, academicPeriod as AcademicPeriod);
	const { data: gradeLevelData } = useGradeLevels();
	const putDetail = usePutDetail(versionId);

	const detailEntries = useMemo(() => detailData?.entries ?? [], [detailData]);

	const rows: TariffRow[] = useMemo(() => {
		const gradeLevels = gradeLevelData?.gradeLevels ?? [];

		const filtered =
			bandFilter === 'ALL' ? gradeLevels : gradeLevels.filter((gl) => gl.band === bandFilter);

		return filtered
			.sort((a, b) => a.displayOrder - b.displayOrder)
			.map((gl) => {
				const gradeDetails = detailEntries.filter((d) => d.gradeLevel === gl.gradeCode);

				function getCount(nat: string, tariff: string) {
					return gradeDetails
						.filter((d) => d.nationality === nat && d.tariff === tariff)
						.reduce((sum, d) => sum + d.headcount, 0);
				}

				const francaisRp = getCount('Francais', 'RP');
				const francaisR3 = getCount('Francais', 'R3+');
				const francaisPlein = getCount('Francais', 'Plein');
				const nationauxRp = getCount('Nationaux', 'RP');
				const nationauxR3 = getCount('Nationaux', 'R3+');
				const nationauxPlein = getCount('Nationaux', 'Plein');
				const autresRp = getCount('Autres', 'RP');
				const autresR3 = getCount('Autres', 'R3+');
				const autresPlein = getCount('Autres', 'Plein');

				return {
					gradeLevel: gl.gradeCode,
					gradeName: gl.gradeName,
					band: gl.band,
					displayOrder: gl.displayOrder,
					francaisRp,
					francaisR3,
					francaisPlein,
					nationauxRp,
					nationauxR3,
					nationauxPlein,
					autresRp,
					autresR3,
					autresPlein,
					total:
						francaisRp +
						francaisR3 +
						francaisPlein +
						nationauxRp +
						nationauxR3 +
						nationauxPlein +
						autresRp +
						autresR3 +
						autresPlein,
				};
			});
	}, [gradeLevelData, detailEntries, bandFilter]);

	const handleCellSave = useCallback(
		(gradeLevel: string, nationality: string, tariff: string, value: number) => {
			if (isReadOnly) return;
			const period = academicPeriod as DetailEntry['academicPeriod'];
			const entries: DetailEntry[] = [];
			for (const nat of NATIONALITIES) {
				for (const tar of TARIFF_TYPES) {
					const isEdited = nat === nationality && tar === tariff;
					const current = detailEntries.find(
						(d) =>
							d.gradeLevel === gradeLevel &&
							d.academicPeriod === period &&
							d.nationality === nat &&
							d.tariff === tar
					);
					entries.push({
						gradeLevel: gradeLevel as DetailEntry['gradeLevel'],
						academicPeriod: period,
						nationality: nat as DetailEntry['nationality'],
						tariff: tar as DetailEntry['tariff'],
						headcount: isEdited ? value : (current?.headcount ?? 0),
					});
				}
			}
			putDetail.mutate(entries);
		},
		[isReadOnly, putDetail, academicPeriod, detailEntries]
	);

	const columns = useMemo(() => {
		const makeTariffCol = (
			accessor: keyof TariffRow,
			header: string,
			nationality: string,
			tariff: string
		) =>
			columnHelper.accessor(accessor as 'francaisRp', {
				header,
				cell: (info) => (
					<EditableCell
						value={info.getValue() as number}
						isReadOnly={isReadOnly}
						min={0}
						onChange={(val) =>
							handleCellSave(info.row.original.gradeLevel, nationality, tariff, val)
						}
					/>
				),
			});

		return [
			columnHelper.accessor('gradeName', {
				header: 'Grade',
				cell: (info) => (
					<span className="font-medium text-(--text-primary)">{info.getValue()}</span>
				),
			}),
			makeTariffCol('francaisRp', 'FR RP', 'Francais', 'RP'),
			makeTariffCol('francaisR3', 'FR R3+', 'Francais', 'R3+'),
			makeTariffCol('francaisPlein', 'FR Plein', 'Francais', 'Plein'),
			makeTariffCol('nationauxRp', 'NAT RP', 'Nationaux', 'RP'),
			makeTariffCol('nationauxR3', 'NAT R3+', 'Nationaux', 'R3+'),
			makeTariffCol('nationauxPlein', 'NAT Plein', 'Nationaux', 'Plein'),
			makeTariffCol('autresRp', 'AUT RP', 'Autres', 'RP'),
			makeTariffCol('autresR3', 'AUT R3+', 'Autres', 'R3+'),
			makeTariffCol('autresPlein', 'AUT Plein', 'Autres', 'Plein'),
			columnHelper.accessor('total', {
				header: 'Total',
				cell: (info) => <span className="font-medium tabular-nums">{info.getValue()}</span>,
			}),
		];
	}, [isReadOnly, handleCellSave]);

	const table = useReactTable({
		data: rows,
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	return (
		<div className="overflow-x-auto rounded-lg border">
			<table
				role="grid"
				className="w-full text-left text-(length:--text-sm)"
				aria-label="Enrollment by tariff"
			>
				<thead className="border-b bg-(--workspace-bg-muted)">
					{/* Two-level header */}
					<tr>
						<th rowSpan={2} className="px-4 py-3 font-medium text-(--text-secondary)">
							Grade
						</th>
						<th
							colSpan={3}
							className="border-b border-l px-4 py-1.5 text-center text-(length:--text-xs) font-medium text-(--text-muted)"
						>
							Francais
						</th>
						<th
							colSpan={3}
							className="border-b border-l px-4 py-1.5 text-center text-(length:--text-xs) font-medium text-(--text-muted)"
						>
							Nationaux
						</th>
						<th
							colSpan={3}
							className="border-b border-l px-4 py-1.5 text-center text-(length:--text-xs) font-medium text-(--text-muted)"
						>
							Autres
						</th>
						<th rowSpan={2} className="border-l px-4 py-3 font-medium text-(--text-secondary)">
							Total
						</th>
					</tr>
					<tr>
						{['RP', 'R3+', 'Plein', 'RP', 'R3+', 'Plein', 'RP', 'R3+', 'Plein'].map((t, i) => (
							<th
								key={`${t}-${i}`}
								className="border-l px-3 py-1.5 text-center text-(length:--text-xs) font-medium text-(--text-muted)"
							>
								{t}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{isLoading ? (
						<TableSkeleton rows={15} cols={11} />
					) : (
						table.getRowModel().rows.map((row) => (
							<tr
								key={row.id}
								className="border-b last:border-0 hover:bg-(--accent-50) transition-colors duration-(--duration-fast)"
							>
								{row.getVisibleCells().map((cell) => (
									<td key={cell.id} className="px-3 py-2">
										{flexRender(cell.column.columnDef.cell, cell.getContext())}
									</td>
								))}
							</tr>
						))
					)}
				</tbody>
			</table>
		</div>
	);
}
