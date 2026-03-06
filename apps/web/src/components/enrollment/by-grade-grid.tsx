import React, { useMemo, useState, useCallback } from 'react';
import {
	createColumnHelper,
	flexRender,
	getCoreRowModel,
	useReactTable,
} from '@tanstack/react-table';
import { cn } from '../../lib/cn';
import type { HeadcountEntry } from '@budfin/types';
import type { HeadcountRow } from '../../hooks/use-enrollment';
import type { GradeLevel, GradeBand } from '../../hooks/use-grade-levels';
import { TableSkeleton } from '../ui/skeleton';

const BAND_LABELS: Record<string, string> = {
	MATERNELLE: 'Maternelle',
	ELEMENTAIRE: 'Elementaire',
	COLLEGE: 'College',
	LYCEE: 'Lycee',
};

const BAND_STYLES: Record<string, string> = {
	MATERNELLE: 'bg-pink-50 text-pink-800',
	ELEMENTAIRE: 'bg-blue-50 text-blue-800',
	COLLEGE: 'bg-green-50 text-green-800',
	LYCEE: 'bg-purple-50 text-purple-800',
};

interface ByGradeGridProps {
	entries: HeadcountRow[];
	gradeLevels: GradeLevel[];
	isLoading: boolean;
	isReadOnly: boolean;
	versionId: number;
	onSave: (entries: HeadcountEntry[]) => void;
	bandFilter: GradeBand | 'ALL';
}

interface GridRow {
	gradeLevel: string;
	gradeName: string;
	band: string;
	displayOrder: number;
	ay1: number;
	ay2: number;
	total: number;
	priorAy1: number;
	priorAy2: number;
	deltaAy1: number | null;
	deltaAy2: number | null;
	isNew: boolean;
}

const columnHelper = createColumnHelper<GridRow>();

function EditableCell({
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
			setDraft(String(value));
		}
	};

	if (editing) {
		return (
			<input
				type="number"
				min={0}
				className="w-20 rounded border border-blue-400 bg-yellow-50 px-2 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
				value={draft}
				onChange={(e) => setDraft(e.target.value)}
				onBlur={handleBlur}
				onKeyDown={handleKeyDown}
				autoFocus
				aria-label="Edit headcount"
			/>
		);
	}

	return (
		<span
			className={cn(
				'inline-block w-20 rounded px-2 py-1 text-right text-sm tabular-nums',
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

function DeltaCell({ delta, isNew }: { delta: number | null; isNew: boolean }) {
	if (isNew) {
		return (
			<span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
				New
			</span>
		);
	}
	if (delta === null) return <span className="text-slate-300">-</span>;

	const absVal = Math.abs(delta);
	const sign = delta >= 0 ? '+' : '';
	const isLarge = absVal > 10;

	return (
		<span
			className={cn(
				'text-sm tabular-nums',
				isLarge ? 'font-medium text-red-600' : 'text-slate-600'
			)}
		>
			{sign}
			{delta.toFixed(1)}%
		</span>
	);
}

export function ByGradeGrid({
	entries,
	gradeLevels,
	isLoading,
	isReadOnly,
	versionId: _versionId,
	onSave,
	bandFilter,
}: ByGradeGridProps) {
	const [pendingChanges, setPendingChanges] = useState<Map<string, HeadcountEntry>>(new Map());

	const rows: GridRow[] = useMemo(() => {
		const entryMap = new Map<string, HeadcountRow>();
		for (const e of entries) {
			entryMap.set(`${e.gradeLevel}:${e.academicPeriod}`, e);
		}

		const filtered =
			bandFilter === 'ALL' ? gradeLevels : gradeLevels.filter((gl) => gl.band === bandFilter);

		return filtered
			.sort((a, b) => a.displayOrder - b.displayOrder)
			.map((gl) => {
				const ay1Entry = entryMap.get(`${gl.gradeCode}:AY1`);
				const ay2Entry = entryMap.get(`${gl.gradeCode}:AY2`);
				const ay1 = ay1Entry?.headcount ?? 0;
				const ay2 = ay2Entry?.headcount ?? 0;

				return {
					gradeLevel: gl.gradeCode,
					gradeName: gl.gradeName,
					band: gl.band,
					displayOrder: gl.displayOrder,
					ay1,
					ay2,
					total: ay1 + ay2,
					priorAy1: 0,
					priorAy2: 0,
					deltaAy1: null,
					deltaAy2: null,
					isNew: false,
				};
			});
	}, [entries, gradeLevels, bandFilter]);

	const flushChanges = useCallback(() => {
		if (pendingChanges.size > 0) {
			onSave([...pendingChanges.values()]);
			setPendingChanges(new Map());
		}
	}, [pendingChanges, onSave]);

	const handleCellSave = useCallback(
		(gradeLevel: string, period: 'AY1' | 'AY2', value: number) => {
			const key = `${gradeLevel}:${period}`;
			const entry: HeadcountEntry = {
				gradeLevel: gradeLevel as HeadcountEntry['gradeLevel'],
				academicPeriod: period,
				headcount: value,
			};
			setPendingChanges((prev) => {
				const next = new Map(prev);
				next.set(key, entry);
				return next;
			});
			// Auto-save immediately on each cell edit
			onSave([entry]);
		},
		[onSave]
	);

	// Group by band for visual separators
	const bands = useMemo(() => {
		const bandMap = new Map<string, GridRow[]>();
		for (const row of rows) {
			const existing = bandMap.get(row.band) ?? [];
			existing.push(row);
			bandMap.set(row.band, existing);
		}
		return bandMap;
	}, [rows]);

	// Grand totals
	const grandTotal = useMemo(
		() => ({
			ay1: rows.reduce((sum, r) => sum + r.ay1, 0),
			ay2: rows.reduce((sum, r) => sum + r.ay2, 0),
			total: rows.reduce((sum, r) => sum + r.total, 0),
		}),
		[rows]
	);

	const columns = useMemo(
		() => [
			columnHelper.accessor('gradeName', {
				header: 'Grade',
				cell: (info) => <span className="font-medium text-slate-900">{info.getValue()}</span>,
			}),
			columnHelper.accessor('band', {
				header: 'Band',
				cell: (info) => {
					const band = info.getValue();
					return (
						<span
							className={cn(
								'inline-block rounded-full px-2 py-0.5 text-xs font-medium',
								BAND_STYLES[band] ?? ''
							)}
						>
							{BAND_LABELS[band] ?? band}
						</span>
					);
				},
			}),
			columnHelper.accessor('ay1', {
				header: 'AY1 (Jan-Jun)',
				cell: (info) => (
					<EditableCell
						value={info.getValue()}
						isReadOnly={isReadOnly}
						onSave={(val) => handleCellSave(info.row.original.gradeLevel, 'AY1', val)}
					/>
				),
			}),
			columnHelper.accessor('ay2', {
				header: 'AY2 (Sep-Dec)',
				cell: (info) => (
					<EditableCell
						value={info.getValue()}
						isReadOnly={isReadOnly}
						onSave={(val) => handleCellSave(info.row.original.gradeLevel, 'AY2', val)}
					/>
				),
			}),
			columnHelper.accessor('total', {
				header: 'Total',
				cell: (info) => <span className="font-medium tabular-nums">{info.getValue()}</span>,
			}),
			columnHelper.accessor('deltaAy1', {
				header: 'Delta AY1',
				cell: (info) => <DeltaCell delta={info.getValue()} isNew={info.row.original.isNew} />,
			}),
			columnHelper.accessor('deltaAy2', {
				header: 'Delta AY2',
				cell: (info) => <DeltaCell delta={info.getValue()} isNew={info.row.original.isNew} />,
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
		<div className="overflow-x-auto rounded-lg border" onBlur={flushChanges}>
			<table role="grid" className="w-full text-left text-sm" aria-label="Enrollment by grade">
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
					) : rows.length === 0 ? (
						<tr>
							<td colSpan={columns.length} className="px-4 py-6 text-center text-slate-500">
								No enrollment data. Start entering headcount for each grade.
							</td>
						</tr>
					) : (
						<>
							{[...bands.entries()].map(([band, bandRows]) => (
								<React.Fragment key={`band-${band}`}>
									{/* Band group header */}
									<tr className="bg-slate-50/50">
										<td
											colSpan={columns.length}
											className="px-4 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider"
											aria-expanded="true"
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
											<tr key={tableRow.id} className="border-b last:border-0 hover:bg-slate-50">
												{tableRow.getVisibleCells().map((cell) => (
													<td key={cell.id} className="px-4 py-2">
														{flexRender(cell.column.columnDef.cell, cell.getContext())}
													</td>
												))}
											</tr>
										);
									})}
								</React.Fragment>
							))}
							{/* Grand total row */}
							<tr className="sticky bottom-0 border-t-2 bg-slate-100 font-semibold">
								<td className="px-4 py-2 text-slate-900">Grand Total</td>
								<td className="px-4 py-2" />
								<td className="px-4 py-2 text-right tabular-nums">{grandTotal.ay1}</td>
								<td className="px-4 py-2 text-right tabular-nums">{grandTotal.ay2}</td>
								<td className="px-4 py-2 text-right tabular-nums">{grandTotal.total}</td>
								<td className="px-4 py-2" />
								<td className="px-4 py-2" />
							</tr>
						</>
					)}
				</tbody>
			</table>
		</div>
	);
}
