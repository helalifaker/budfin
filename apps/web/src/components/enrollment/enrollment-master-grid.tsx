import { useMemo, useCallback } from 'react';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import type { EnrollmentMasterGridRow, GradeCode } from '@budfin/types';
import { PlanningGrid } from '../data-grid/planning-grid';
import { EditableCell } from '../shared/editable-cell';
import { AlertBadge, UtilizationCell } from './capacity-columns';
import { BAND_LABELS } from '../../lib/enrollment-workspace';
import { useDirtyRowsStore } from '../../stores/dirty-rows-store';

const columnHelper = createColumnHelper<EnrollmentMasterGridRow>();

const BAND_STYLES = {
	MATERNELLE: { color: 'var(--badge-maternelle)', bg: 'var(--badge-maternelle-bg)' },
	ELEMENTAIRE: { color: 'var(--badge-elementaire)', bg: 'var(--badge-elementaire-bg)' },
	COLLEGE: { color: 'var(--badge-college)', bg: 'var(--badge-college-bg)' },
	LYCEE: { color: 'var(--badge-lycee)', bg: 'var(--badge-lycee-bg)' },
} as const;

function formatInt(value: number) {
	return value.toLocaleString();
}

function worstAlert(
	alerts: Array<EnrollmentMasterGridRow['alert']>
): EnrollmentMasterGridRow['alert'] {
	const priority: EnrollmentMasterGridRow['alert'][] = ['OVER', 'NEAR_CAP', 'OK', 'UNDER'];
	for (const level of priority) {
		if (alerts.includes(level)) return level;
	}
	return null;
}

function buildBandSubtotalValues(rows: EnrollmentMasterGridRow[]): Record<string, number | string> {
	const ay1Sum = rows.reduce((s, r) => s + r.ay1Headcount, 0);
	const lateralsSum = rows.reduce((s, r) => s + r.lateralEntry, 0);
	const ay2Sum = rows.reduce((s, r) => s + r.ay2Headcount, 0);
	const sectionsSum = rows.reduce((s, r) => s + r.sectionsNeeded, 0);
	const utilValues = rows.filter((r) => r.utilization > 0).map((r) => r.utilization);
	const avgUtil =
		utilValues.length > 0
			? Number((utilValues.reduce((s, v) => s + v, 0) / utilValues.length).toFixed(1))
			: 0;
	const worst = worstAlert(rows.map((r) => r.alert));

	return {
		ay1Headcount: formatInt(ay1Sum),
		retentionRate: '--',
		lateralEntry: formatInt(lateralsSum),
		ay2Headcount: formatInt(ay2Sum),
		sectionsNeeded: formatInt(sectionsSum),
		utilization: avgUtil > 0 ? `${avgUtil}%` : '-',
		alert: worst ?? '-',
	};
}

export type EnrollmentMasterGridProps = {
	rows: EnrollmentMasterGridRow[];
	selectedGradeLevel?: string | null;
	isReadOnly: boolean;
	quickEditEnabled: boolean;
	isFiltered?: boolean;
	onSelectGrade: (gradeLevel: GradeCode) => void;
	onEditAy1Headcount: (gradeLevel: GradeCode, value: number) => void;
	onEditRetentionRate: (gradeLevel: GradeCode, value: number) => void;
	onEditLateralEntry: (gradeLevel: GradeCode, value: number) => void;
	onEditPsAy2?: (value: number) => void;
};

export function EnrollmentMasterGrid({
	rows,
	selectedGradeLevel,
	isReadOnly,
	quickEditEnabled,
	isFiltered = false,
	onSelectGrade,
	onEditAy1Headcount,
	onEditRetentionRate,
	onEditLateralEntry,
	onEditPsAy2,
}: EnrollmentMasterGridProps) {
	const dirtyRows = useDirtyRowsStore((s) => s.dirtyRows);
	const markDirty = useDirtyRowsStore((s) => s.markDirty);

	const canEdit = !isReadOnly && quickEditEnabled;

	const handleAy1Edit = useCallback(
		(gradeLevel: GradeCode, value: number) => {
			markDirty(gradeLevel, 'ay1');
			onEditAy1Headcount(gradeLevel, value);
		},
		[markDirty, onEditAy1Headcount]
	);

	const handleRetentionEdit = useCallback(
		(gradeLevel: GradeCode, value: number) => {
			markDirty(gradeLevel, 'retention');
			onEditRetentionRate(gradeLevel, value);
		},
		[markDirty, onEditRetentionRate]
	);

	const handleLateralEdit = useCallback(
		(gradeLevel: GradeCode, value: number) => {
			markDirty(gradeLevel, 'laterals');
			onEditLateralEntry(gradeLevel, value);
		},
		[markDirty, onEditLateralEntry]
	);

	const columns = useMemo(
		() => [
			columnHelper.accessor('gradeName', {
				id: 'grade',
				header: 'Grade',
				cell: ({ row }) => {
					const original = row.original;
					const isDirty = dirtyRows.has(original.gradeLevel);
					return (
						<div className="min-w-[180px]">
							<p className="font-medium text-(--text-primary)">
								{isDirty && (
									<span
										className="mr-1.5 inline-block h-2 w-2 rounded-full bg-(--color-warning)"
										aria-label="Unsaved changes"
									/>
								)}
								{original.gradeName}
							</p>
							<div className="mt-1 flex items-center gap-2 text-(--text-xs)">
								<span className="font-[family-name:var(--font-mono)] text-(--text-muted)">
									{original.gradeLevel}
								</span>
								{original.hasManualOverride && (
									<span className="rounded-full bg-(--accent-50) px-2 py-0.5 font-medium text-(--accent-700)">
										Manual override
									</span>
								)}
							</div>
						</div>
					);
				},
			}),
			columnHelper.accessor('ay1Headcount', {
				id: 'ay1Headcount',
				header: 'AY1',
				cell: ({ row, getValue }) => {
					const isDirty = dirtyRows.get(row.original.gradeLevel)?.has('ay1');
					return canEdit ? (
						<div className="relative">
							{isDirty && <DirtyDot />}
							<EditableCell
								value={getValue()}
								onChange={(value) => handleAy1Edit(row.original.gradeLevel, value)}
							/>
						</div>
					) : (
						<span className="font-[family-name:var(--font-mono)] tabular-nums">
							{formatInt(getValue())}
						</span>
					);
				},
			}),
			columnHelper.accessor('retentionRate', {
				id: 'retentionRate',
				header: 'Retention',
				cell: ({ row, getValue }) => {
					if (row.original.isPS) {
						return <span className="text-(--text-muted)">--</span>;
					}

					const isDirty = dirtyRows.get(row.original.gradeLevel)?.has('retention');
					return (
						<div className="relative">
							{isDirty && <DirtyDot />}
							<EditableCell
								value={Math.round(getValue() * 100)}
								onChange={(value) => handleRetentionEdit(row.original.gradeLevel, value)}
								type="percentage"
								isReadOnly={!canEdit}
							/>
						</div>
					);
				},
			}),
			columnHelper.accessor('lateralEntry', {
				id: 'lateralEntry',
				header: 'Laterals',
				cell: ({ row, getValue }) => {
					if (row.original.isPS) {
						return <span className="text-(--text-muted)">--</span>;
					}

					const isDirty = dirtyRows.get(row.original.gradeLevel)?.has('laterals');
					return (
						<div className="relative">
							{isDirty && <DirtyDot />}
							<EditableCell
								value={getValue()}
								onChange={(value) => handleLateralEdit(row.original.gradeLevel, value)}
								isReadOnly={!canEdit}
							/>
						</div>
					);
				},
			}),
			columnHelper.accessor('ay2Headcount', {
				id: 'ay2Headcount',
				header: 'AY2',
				cell: ({ row, getValue }) => {
					const isDirty = dirtyRows.has(row.original.gradeLevel);
					const value = getValue();

					if (row.original.isPS && canEdit && onEditPsAy2) {
						return <EditableCell value={value} onChange={onEditPsAy2} />;
					}

					return (
						<span className="font-[family-name:var(--font-mono)] font-medium tabular-nums text-(--text-primary)">
							{formatInt(value)}
							{isDirty && (
								<span className="ml-0.5 text-(--color-warning)" title="Recalculation needed">
									?
								</span>
							)}
						</span>
					);
				},
			}),
			columnHelper.accessor('sectionsNeeded', {
				id: 'sectionsNeeded',
				header: 'Sections',
				cell: ({ getValue }) => (
					<span className="font-[family-name:var(--font-mono)] tabular-nums">
						{formatInt(getValue())}
					</span>
				),
			}),
			columnHelper.accessor('utilization', {
				id: 'utilization',
				header: 'Utilization',
				cell: ({ getValue }) => <UtilizationCell value={getValue()} />,
			}),
			columnHelper.accessor('alert', {
				id: 'alert',
				header: 'Alert',
				cell: ({ getValue }) => <AlertBadge alert={getValue()} />,
			}),
		],
		[canEdit, dirtyRows, handleAy1Edit, handleRetentionEdit, handleLateralEdit, onEditPsAy2]
	);

	const table = useReactTable({
		data: rows,
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	const getRowClassName = useCallback((row: EnrollmentMasterGridRow) => {
		if (row.alert === 'OVER') return 'bg-(--color-error-bg)';
		if (row.alert === 'NEAR_CAP') return 'bg-(--color-warning-bg)';
		return undefined;
	}, []);

	const bandFooterBuilder = useCallback(
		(bandRows: EnrollmentMasterGridRow[], band: string) => ({
			label: `${BAND_LABELS[band] ?? band} Subtotal`,
			type: 'subtotal' as const,
			values: buildBandSubtotalValues(bandRows),
		}),
		[]
	);

	const grandTotalRow = useMemo(() => {
		if (rows.length === 0) return [];
		return [
			{
				label: isFiltered ? 'Filtered Total' : 'Grand Total',
				type: 'grandtotal' as const,
				values: buildBandSubtotalValues(rows),
			},
		];
	}, [rows, isFiltered]);

	const editableColumnIds = canEdit ? ['ay1Headcount', 'retentionRate', 'lateralEntry'] : [];

	return (
		<PlanningGrid
			table={table}
			ariaLabel="Enrollment master grid"
			pinnedColumns={['grade']}
			numericColumns={[
				'ay1Headcount',
				'retentionRate',
				'lateralEntry',
				'ay2Headcount',
				'sectionsNeeded',
				'utilization',
			]}
			editableColumns={editableColumnIds}
			bandGrouping={{
				getBand: (row) => row.band,
				bandLabels: BAND_LABELS,
				bandStyles: BAND_STYLES,
				collapsible: false,
				footerBuilder: bandFooterBuilder,
			}}
			footerRows={grandTotalRow}
			getRowClassName={getRowClassName}
			onRowSelect={(row) => onSelectGrade(row.gradeLevel)}
			selectedRowPredicate={(row) => row.gradeLevel === selectedGradeLevel}
		/>
	);
}

function DirtyDot() {
	return (
		<span
			className="absolute -left-1 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-(--color-warning)"
			aria-label="Unsaved change"
		/>
	);
}
