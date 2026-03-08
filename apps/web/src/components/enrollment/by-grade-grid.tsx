import React, { useMemo, useCallback } from 'react';
import {
	createColumnHelper,
	flexRender,
	getCoreRowModel,
	useReactTable,
} from '@tanstack/react-table';
import { cn } from '../../lib/cn';
import type { HeadcountEntry, CapacityResult, CapacityAlert } from '@budfin/types';
import type { HeadcountRow } from '../../hooks/use-enrollment';
import type { GradeLevel, GradeBand } from '../../hooks/use-grade-levels';
import { TableSkeleton } from '../ui/skeleton';
import { AlertBadge, UtilizationCell } from './capacity-columns';
import { EditableCell } from '../shared/editable-cell';

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

interface ByGradeGridProps {
	entries: HeadcountRow[];
	gradeLevels: GradeLevel[];
	isLoading: boolean;
	isReadOnly: boolean;
	versionId: number;
	onSave: (entries: HeadcountEntry[]) => void;
	bandFilter: GradeBand | 'ALL';
	comparisonEntries?: HeadcountRow[] | undefined;
	capacityResults?: CapacityResult[] | undefined;
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
	sectionsNeeded: number;
	utilization: number;
	alert: CapacityAlert | null;
}

const columnHelper = createColumnHelper<GridRow>();

function DeltaCell({ delta, isNew }: { delta: number | null; isNew: boolean }) {
	if (isNew) {
		return (
			<span className="inline-flex items-center rounded-[var(--radius-sm)] bg-[var(--accent-50)] px-2 py-0.5 text-[length:var(--text-xs)] font-medium text-[var(--badge-elementaire)]">
				New
			</span>
		);
	}
	if (delta === null) return <span className="text-[var(--text-muted)]">-</span>;

	const absVal = Math.abs(delta);
	const sign = delta >= 0 ? '+' : '';
	const isLarge = absVal > 10;

	return (
		<span
			className={cn(
				'text-[length:var(--text-sm)] tabular-nums',
				isLarge ? 'font-medium text-[var(--color-error)]' : 'text-[var(--text-secondary)]'
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
	comparisonEntries,
	capacityResults,
}: ByGradeGridProps) {
	const rows: GridRow[] = useMemo(() => {
		const entryMap = new Map<string, HeadcountRow>();
		for (const e of entries) {
			entryMap.set(`${e.gradeLevel}:${e.academicPeriod}`, e);
		}

		const compMap = new Map<string, HeadcountRow>();
		if (comparisonEntries) {
			for (const e of comparisonEntries) {
				compMap.set(`${e.gradeLevel}:${e.academicPeriod}`, e);
			}
		}

		const capMap = new Map<string, CapacityResult>();
		if (capacityResults) {
			for (const r of capacityResults) {
				capMap.set(`${r.gradeLevel}:${r.academicPeriod}`, r);
			}
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

				const priorAy1 = compMap.get(`${gl.gradeCode}:AY1`)?.headcount ?? 0;
				const priorAy2 = compMap.get(`${gl.gradeCode}:AY2`)?.headcount ?? 0;

				const computeDelta = (current: number, prior: number): number | null => {
					if (prior === 0) return null;
					return ((current - prior) / prior) * 100;
				};

				const isNew =
					comparisonEntries !== undefined &&
					priorAy1 === 0 &&
					priorAy2 === 0 &&
					(ay1 > 0 || ay2 > 0);

				const capAy1 = capMap.get(`${gl.gradeCode}:AY1`);
				const capAy2 = capMap.get(`${gl.gradeCode}:AY2`);
				const bestCap = capAy1 ?? capAy2;

				return {
					gradeLevel: gl.gradeCode,
					gradeName: gl.gradeName,
					band: gl.band,
					displayOrder: gl.displayOrder,
					ay1,
					ay2,
					total: ay1 + ay2,
					priorAy1,
					priorAy2,
					deltaAy1: computeDelta(ay1, priorAy1),
					deltaAy2: computeDelta(ay2, priorAy2),
					isNew,
					sectionsNeeded: bestCap?.sectionsNeeded ?? 0,
					utilization: bestCap?.utilization ?? 0,
					alert: bestCap?.alert ?? null,
				};
			});
	}, [entries, gradeLevels, bandFilter, comparisonEntries, capacityResults]);

	const handleCellSave = useCallback(
		(gradeLevel: string, period: 'AY1' | 'AY2', value: number) => {
			const entry: HeadcountEntry = {
				gradeLevel: gradeLevel as HeadcountEntry['gradeLevel'],
				academicPeriod: period,
				headcount: value,
			};
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
								'inline-block rounded-[var(--radius-sm)] px-2 py-0.5 text-[length:var(--text-xs)] font-medium',
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
						min={0}
						onChange={(val) => handleCellSave(info.row.original.gradeLevel, 'AY1', val)}
					/>
				),
			}),
			columnHelper.accessor('ay2', {
				header: 'AY2 (Sep-Dec)',
				cell: (info) => (
					<EditableCell
						value={info.getValue()}
						isReadOnly={isReadOnly}
						min={0}
						onChange={(val) => handleCellSave(info.row.original.gradeLevel, 'AY2', val)}
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
			columnHelper.accessor('sectionsNeeded', {
				header: 'Sections',
				cell: (info) => {
					const val = info.getValue();
					return val > 0 ? (
						<span className="tabular-nums">{val}</span>
					) : (
						<span className="text-[var(--text-muted)]">-</span>
					);
				},
			}),
			columnHelper.accessor('utilization', {
				header: 'Utilization',
				cell: (info) => <UtilizationCell value={info.getValue()} />,
			}),
			columnHelper.accessor('alert', {
				header: 'Alert',
				cell: (info) => <AlertBadge alert={info.getValue()} />,
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
		<div className="overflow-x-auto rounded-[var(--radius-lg)] border">
			<table
				role="grid"
				className="w-full text-left text-[length:var(--text-sm)]"
				aria-label="Enrollment by grade"
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
								No enrollment data. Start entering headcount for each grade.
							</td>
						</tr>
					) : (
						<>
							{[...bands.entries()].map(([band, bandRows]) => (
								<React.Fragment key={`band-${band}`}>
									{/* Band group header */}
									<tr className="bg-[var(--workspace-bg-muted)]/50">
										<td
											colSpan={columns.length}
											className="px-4 py-1.5 text-[length:var(--text-xs)] font-semibold text-[var(--text-muted)] uppercase tracking-wider"
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
											<tr
												key={tableRow.id}
												className="border-b last:border-0 hover:bg-[var(--accent-50)] transition-colors duration-[var(--duration-fast)]"
											>
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
							<tr className="sticky bottom-0 border-t-2 bg-[var(--workspace-bg-muted)] font-semibold">
								<td className="px-4 py-2 text-[var(--text-primary)]">Grand Total</td>
								<td className="px-4 py-2" />
								<td className="px-4 py-2 text-right tabular-nums">{grandTotal.ay1}</td>
								<td className="px-4 py-2 text-right tabular-nums">{grandTotal.ay2}</td>
								<td className="px-4 py-2 text-right tabular-nums">{grandTotal.total}</td>
								<td className="px-4 py-2" />
								<td className="px-4 py-2" />
								<td className="px-4 py-2" />
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
