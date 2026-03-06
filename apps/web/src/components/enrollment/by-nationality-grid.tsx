import { useMemo, useState, useCallback } from 'react';
import {
	createColumnHelper,
	flexRender,
	getCoreRowModel,
	useReactTable,
} from '@tanstack/react-table';
import { Check, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/cn';
import { useHeadcount, useDetail, usePutDetail } from '../../hooks/use-enrollment';
import { useGradeLevels } from '../../hooks/use-grade-levels';
import type { DetailEntry } from '@budfin/types';
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
}

export function ByNationalityGrid({ versionId, isReadOnly, bandFilter }: Props) {
	const { data: headcountData } = useHeadcount(versionId);
	const { data: detailData, isLoading } = useDetail(versionId);
	const { data: gradeLevelData } = useGradeLevels();
	const putDetail = usePutDetail(versionId);

	const gradeLevels = gradeLevelData?.gradeLevels ?? [];
	const headcountEntries = headcountData?.entries ?? [];
	const detailEntries = detailData?.entries ?? [];

	const rows: NationalityRow[] = useMemo(() => {
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
	}, [gradeLevels, detailEntries, headcountEntries, bandFilter]);

	const mismatchCount = useMemo(
		() => rows.filter((r) => !r.matches && r.stage1Total > 0).length,
		[rows]
	);

	const handleCellSave = useCallback(
		(gradeLevel: string, nationality: string, value: number) => {
			if (isReadOnly) return;
			const entry: DetailEntry = {
				gradeLevel: gradeLevel as DetailEntry['gradeLevel'],
				academicPeriod: 'AY1',
				nationality: nationality as DetailEntry['nationality'],
				tariff: 'RP',
				headcount: value,
			};
			putDetail.mutate([entry]);
		},
		[isReadOnly, putDetail]
	);

	const columns = useMemo(
		() => [
			columnHelper.accessor('gradeName', {
				header: 'Grade',
				cell: (info) => <span className="font-medium text-slate-900">{info.getValue()}</span>,
			}),
			columnHelper.accessor('francais', {
				header: 'Francais',
				cell: (info) => (
					<EditableNatCell
						value={info.getValue()}
						isReadOnly={isReadOnly}
						onSave={(val) => handleCellSave(info.row.original.gradeLevel, 'Francais', val)}
					/>
				),
			}),
			columnHelper.accessor('nationaux', {
				header: 'Nationaux',
				cell: (info) => (
					<EditableNatCell
						value={info.getValue()}
						isReadOnly={isReadOnly}
						onSave={(val) => handleCellSave(info.row.original.gradeLevel, 'Nationaux', val)}
					/>
				),
			}),
			columnHelper.accessor('autres', {
				header: 'Autres',
				cell: (info) => (
					<EditableNatCell
						value={info.getValue()}
						isReadOnly={isReadOnly}
						onSave={(val) => handleCellSave(info.row.original.gradeLevel, 'Autres', val)}
					/>
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
						return <span className="text-slate-300">-</span>;
					}
					return info.getValue() ? (
						<Check className="h-4 w-4 text-green-600" aria-label="Totals match" />
					) : (
						<AlertTriangle className="h-4 w-4 text-amber-500" aria-label="Totals do not match" />
					);
				},
			}),
			columnHelper.accessor('stage1Total', {
				header: 'Stage 1',
				cell: (info) => <span className="text-slate-500 tabular-nums">{info.getValue()}</span>,
			}),
		],
		[isReadOnly, handleCellSave]
	);

	const table = useReactTable({
		data: rows,
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	return (
		<div>
			{mismatchCount > 0 && (
				<div className="mb-2 flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
					<AlertTriangle className="h-4 w-4" />
					{mismatchCount} grade{mismatchCount > 1 ? 's' : ''} with nationality total mismatch
				</div>
			)}
			<div className="overflow-x-auto rounded-lg border">
				<table
					role="grid"
					className="w-full text-left text-sm"
					aria-label="Enrollment by nationality"
				>
					<thead className="border-b bg-slate-50">
						{table.getHeaderGroups().map((hg) => (
							<tr key={hg.id}>
								{hg.headers.map((header) => (
									<th key={header.id} className="px-4 py-3 font-medium text-slate-600">
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
										'border-b last:border-0 hover:bg-slate-50',
										!row.original.matches && row.original.stage1Total > 0 && 'bg-amber-50/30'
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

function EditableNatCell({
	value,
	isReadOnly,
	onSave,
}: {
	value: number;
	isReadOnly: boolean;
	onSave: (val: number) => void;
}) {
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState(String(value));

	const handleDoubleClick = () => {
		if (isReadOnly) return;
		setEditing(true);
		setDraft(String(value));
	};

	const handleBlur = () => {
		setEditing(false);
		const parsed = parseInt(draft, 10);
		if (!isNaN(parsed) && parsed >= 0 && parsed !== value) {
			onSave(parsed);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter') {
			(e.target as HTMLInputElement).blur();
		} else if (e.key === 'Escape') {
			setEditing(false);
		}
	};

	if (editing) {
		return (
			<input
				type="number"
				min={0}
				className="w-16 rounded border border-blue-400 bg-yellow-50 px-2 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
				value={draft}
				onChange={(e) => setDraft(e.target.value)}
				onBlur={handleBlur}
				onKeyDown={handleKeyDown}
				autoFocus
				aria-label="Edit nationality headcount"
			/>
		);
	}

	return (
		<span
			className={cn(
				'inline-block w-16 rounded px-2 py-1 text-right text-sm tabular-nums',
				!isReadOnly && 'cursor-pointer hover:bg-yellow-50'
			)}
			onDoubleClick={handleDoubleClick}
			role={isReadOnly ? undefined : 'button'}
			tabIndex={isReadOnly ? undefined : 0}
			aria-readonly={isReadOnly}
			onKeyDown={(e) => {
				if (!isReadOnly && (e.key === 'Enter' || e.key === ' ')) {
					handleDoubleClick();
				}
			}}
		>
			{value}
		</span>
	);
}
