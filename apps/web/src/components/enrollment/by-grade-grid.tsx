import { useMemo, useCallback } from 'react';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { cn } from '../../lib/cn';
import type { HeadcountEntry, CapacityResult, CapacityAlert } from '@budfin/types';
import type { HeadcountRow } from '../../hooks/use-enrollment';
import type { GradeLevel, GradeBand } from '../../hooks/use-grade-levels';
import { AlertBadge, UtilizationCell } from './capacity-columns';
import { EditableCell } from '../shared/editable-cell';
import { PlanningGrid } from '../data-grid/planning-grid';
import { BAND_LABELS, BAND_STYLES } from '../../lib/band-styles';

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
			<span className="inline-flex items-center rounded-sm bg-(--accent-50) px-2 py-0.5 font-medium text-(--badge-elementaire)">
				New
			</span>
		);
	}
	if (delta === null) return <span className="text-(--text-muted)">-</span>;

	const absVal = Math.abs(delta);
	const sign = delta >= 0 ? '+' : '';
	const isLarge = absVal > 10;

	return (
		<span
			className={cn(
				'text-(length:--text-sm) tabular-nums',
				isLarge ? 'font-medium text-(--color-error)' : 'text-(--text-secondary)'
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

	const columns = useMemo(
		() => [
			columnHelper.accessor('gradeName', {
				id: 'gradeName',
				header: 'Grade',
				cell: (info) => (
					<span className="font-medium text-(--text-primary)">{info.getValue()}</span>
				),
			}),
			columnHelper.accessor('band', {
				id: 'band',
				header: 'Band',
				cell: (info) => {
					const band = info.getValue();
					return (
						<span
							className="inline-block rounded-sm px-2 py-0.5 text-(length:--text-xs) font-medium"
							style={{
								color: BAND_STYLES[band]?.color,
								backgroundColor: BAND_STYLES[band]?.bg,
							}}
						>
							{BAND_LABELS[band] ?? band}
						</span>
					);
				},
			}),
			columnHelper.accessor('ay1', {
				id: 'ay1',
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
				id: 'ay2',
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
				id: 'total',
				header: 'Total',
				cell: (info) => <span className="font-medium tabular-nums">{info.getValue()}</span>,
			}),
			columnHelper.accessor('deltaAy1', {
				id: 'deltaAy1',
				header: 'Delta AY1',
				cell: (info) => <DeltaCell delta={info.getValue()} isNew={info.row.original.isNew} />,
			}),
			columnHelper.accessor('deltaAy2', {
				id: 'deltaAy2',
				header: 'Delta AY2',
				cell: (info) => <DeltaCell delta={info.getValue()} isNew={info.row.original.isNew} />,
			}),
			columnHelper.accessor('sectionsNeeded', {
				id: 'sectionsNeeded',
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
				id: 'utilization',
				header: 'Utilization',
				cell: (info) => <UtilizationCell value={info.getValue()} />,
			}),
			columnHelper.accessor('alert', {
				id: 'alert',
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

	const grandTotalRow = useMemo(() => {
		if (rows.length === 0) return [];
		return [
			{
				label: 'Grand Total',
				type: 'grandtotal' as const,
				values: {
					ay1: rows.reduce((sum, r) => sum + r.ay1, 0),
					ay2: rows.reduce((sum, r) => sum + r.ay2, 0),
					total: rows.reduce((sum, r) => sum + r.total, 0),
				},
			},
		];
	}, [rows]);

	const bandFooterBuilder = useCallback((bandRows: GridRow[], band: string) => {
		return {
			label: `${BAND_LABELS[band] ?? band} Subtotal`,
			type: 'subtotal' as const,
			values: {
				ay1: bandRows.reduce((sum, r) => sum + r.ay1, 0),
				ay2: bandRows.reduce((sum, r) => sum + r.ay2, 0),
				total: bandRows.reduce((sum, r) => sum + r.total, 0),
			},
		};
	}, []);

	const editableColumnIds = isReadOnly ? [] : ['ay1', 'ay2'];

	return (
		<PlanningGrid
			table={table}
			isLoading={isLoading}
			ariaLabel="Enrollment by grade"
			rangeSelection
			clipboardEnabled
			pinnedColumns={['gradeName']}
			numericColumns={[
				'ay1',
				'ay2',
				'total',
				'deltaAy1',
				'deltaAy2',
				'sectionsNeeded',
				'utilization',
			]}
			editableColumns={editableColumnIds}
			bandGrouping={{
				getBand: (row) => row.band,
				bandLabels: BAND_LABELS,
				bandStyles: BAND_STYLES,
				collapsible: true,
				footerBuilder: bandFooterBuilder,
			}}
			footerRows={grandTotalRow}
			forceGridRole
		/>
	);
}
