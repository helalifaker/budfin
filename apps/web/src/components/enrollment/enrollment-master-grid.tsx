import React, { useMemo, useCallback } from 'react';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import type { EnrollmentMasterGridRow, GradeCode } from '@budfin/types';
import { PlanningGrid } from '../data-grid/planning-grid';
import { EditableCell } from '../shared/editable-cell';
import { AlertBadge, DeltaCell, UtilizationGauge } from './capacity-columns';
import { BAND_LABELS, BAND_STYLES } from '../../lib/band-styles';
import { useDirtyRowsStore } from '../../stores/dirty-rows-store';

const columnHelper = createColumnHelper<EnrollmentMasterGridRow>();
const INTEGER_FORMATTER = new Intl.NumberFormat('en-US');

function formatInt(value: number) {
	return INTEGER_FORMATTER.format(value);
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

function buildBandSubtotalValues(rows: EnrollmentMasterGridRow[]): Record<string, React.ReactNode> {
	const ay1Sum = rows.reduce((s, r) => s + r.ay1Headcount, 0);
	const retainedSum = rows.reduce((s, r) => s + (r.retainedFromPrior ?? 0), 0);
	const historicalTargetSum = rows.reduce((s, r) => s + (r.historicalTargetHeadcount ?? 0), 0);
	const lateralsSum = rows.reduce((s, r) => s + r.lateralEntry, 0);
	const adjustmentSum = rows.reduce((s, r) => s + (r.manualAdjustment ?? 0), 0);
	const ay2Sum = rows.reduce((s, r) => s + r.ay2Headcount, 0);
	const deltaSum = rows.reduce((s, r) => s + r.delta, 0);
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
		trendRetentionRate: '--',
		retainedFromPrior: formatInt(retainedSum),
		historicalTargetHeadcount: formatInt(historicalTargetSum),
		lateralEntry: formatInt(lateralsSum),
		manualAdjustment: adjustmentSum === 0 ? '0' : formatInt(adjustmentSum),
		ay2Headcount: formatInt(ay2Sum),
		delta: <DeltaCell delta={deltaSum} ay1Headcount={ay1Sum} />,
		maxClassSize: '--',
		sectionsNeeded: formatInt(sectionsSum),
		utilGauge: avgUtil > 0 ? `${avgUtil}%` : '-',
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
	onEditManualAdjustment: (gradeLevel: GradeCode, value: number) => void;
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
	onEditManualAdjustment,
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

	const handleAdjustmentEdit = useCallback(
		(gradeLevel: GradeCode, value: number) => {
			markDirty(gradeLevel, 'override');
			onEditManualAdjustment(gradeLevel, value);
		},
		[markDirty, onEditManualAdjustment]
	);

	const columns = useMemo(
		() => [
			columnHelper.accessor('gradeName', {
				id: 'grade',
				header: 'Grade',
				cell: ({ row }) => {
					const { gradeLevel, gradeName, hasManualOverride } = row.original;
					const isDirty = dirtyRows.has(gradeLevel);
					return (
						<div>
							<span className="font-medium text-(--text-primary)">
								{isDirty && <DirtyDot />}
								{gradeName}
							</span>
							<span className="ml-1.5 text-(--text-xs) font-[family-name:var(--font-mono)] text-(--text-muted)">
								{gradeLevel}
							</span>
							{hasManualOverride && (
								<span
									className="ml-1.5 text-(--text-xs) text-(--accent-500)"
									title="Has manual override"
								>
									*
								</span>
							)}
						</div>
					);
				},
			}),

			columnHelper.group({
				id: 'students-group',
				header: 'Students',
				columns: [
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
										variant="highlighted"
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
						header: 'Ret%',
						cell: ({ row, getValue }) => {
							if (row.original.isPS) {
								return <span className="text-(--text-muted)">--</span>;
							}
							const isDirty = dirtyRows.get(row.original.gradeLevel)?.has('retention');
							const isEditableRetention = canEdit && row.original.usesConfiguredRetention === true;
							return (
								<div className="relative">
									{isDirty && <DirtyDot />}
									<EditableCell
										value={Math.round(getValue() * 100)}
										onChange={(value) => handleRetentionEdit(row.original.gradeLevel, value)}
										type="percentage"
										variant={isEditableRetention ? 'highlighted' : 'subtle'}
										isReadOnly={!isEditableRetention}
									/>
								</div>
							);
						},
					}),
					columnHelper.accessor((row) => row.trendRetentionRate ?? null, {
						id: 'trendRetentionRate',
						header: 'Trend',
						cell: ({ row, getValue }) =>
							row.original.isPS || getValue() === null ? (
								<span className="text-(--text-muted)">--</span>
							) : (
								<span className="font-[family-name:var(--font-mono)] tabular-nums text-(--text-secondary)">
									{Math.round((getValue() ?? 0) * 100)}%
								</span>
							),
					}),
					columnHelper.accessor((row) => row.retainedFromPrior ?? 0, {
						id: 'retainedFromPrior',
						header: 'Retained',
						cell: ({ row, getValue }) =>
							row.original.isPS ? (
								<span className="text-(--text-muted)">--</span>
							) : (
								<span className="font-[family-name:var(--font-mono)] tabular-nums">
									{formatInt(getValue())}
								</span>
							),
					}),
					columnHelper.accessor((row) => row.historicalTargetHeadcount ?? null, {
						id: 'historicalTargetHeadcount',
						header: 'Hist Target',
						cell: ({ row, getValue }) =>
							row.original.isPS || getValue() === null ? (
								<span className="text-(--text-muted)">--</span>
							) : (
								<span className="font-[family-name:var(--font-mono)] tabular-nums">
									{formatInt(getValue() ?? 0)}
								</span>
							),
					}),
					columnHelper.accessor('lateralEntry', {
						id: 'lateralEntry',
						header: 'Lat',
						cell: ({ row, getValue }) => {
							if (row.original.isPS) {
								return <span className="text-(--text-muted)">--</span>;
							}
							return (
								<span className="font-[family-name:var(--font-mono)] tabular-nums text-(--text-secondary)">
									{formatInt(getValue())}
								</span>
							);
						},
					}),
					columnHelper.accessor((row) => row.manualAdjustment ?? 0, {
						id: 'manualAdjustment',
						header: 'Override',
						cell: ({ row, getValue }) => {
							if (row.original.isPS) {
								return <span className="text-(--text-muted)">--</span>;
							}
							const isDirty = dirtyRows.get(row.original.gradeLevel)?.has('override');
							return (
								<div className="relative">
									{isDirty && <DirtyDot />}
									<EditableCell
										value={getValue()}
										onChange={(value) => handleAdjustmentEdit(row.original.gradeLevel, value)}
										variant={canEdit ? 'highlighted' : 'subtle'}
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
							const gradeFields = dirtyRows.get(row.original.gradeLevel);
							const isDirty = gradeFields
								? gradeFields.has('ay1') ||
									gradeFields.has('retention') ||
									gradeFields.has('override')
								: false;
							const value = getValue();

							if (row.original.isPS && canEdit && onEditPsAy2) {
								return <EditableCell value={value} onChange={onEditPsAy2} variant="highlighted" />;
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
					columnHelper.accessor('delta', {
						id: 'delta',
						header: 'Delta',
						cell: ({ row }) => (
							<DeltaCell delta={row.original.delta} ay1Headcount={row.original.ay1Headcount} />
						),
					}),
				],
			}),

			columnHelper.group({
				id: 'capacity-group',
				header: 'Capacity',
				columns: [
					columnHelper.accessor('maxClassSize', {
						id: 'maxClassSize',
						header: 'Max',
						cell: ({ getValue }) => (
							<span className="font-[family-name:var(--font-mono)] tabular-nums">
								{formatInt(getValue())}
							</span>
						),
					}),
					columnHelper.accessor('sectionsNeeded', {
						id: 'sectionsNeeded',
						header: 'Sec',
						cell: ({ getValue }) => (
							<span className="font-[family-name:var(--font-mono)] tabular-nums">
								{formatInt(getValue())}
							</span>
						),
					}),
					columnHelper.display({
						id: 'utilGauge',
						header: 'Util',
						cell: ({ row }) => (
							<UtilizationGauge
								utilization={row.original.utilization}
								plancher={row.original.plancher}
								cible={row.original.cible}
								plafond={row.original.plafond}
							/>
						),
					}),
					columnHelper.accessor('alert', {
						id: 'alert',
						header: 'Alert',
						cell: ({ getValue }) => <AlertBadge alert={getValue()} />,
					}),
				],
			}),
		],
		[canEdit, dirtyRows, handleAdjustmentEdit, handleAy1Edit, handleRetentionEdit, onEditPsAy2]
	);

	const table = useReactTable({
		data: rows,
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

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

	const editableColumnIds = canEdit ? ['ay1Headcount', 'retentionRate', 'manualAdjustment'] : [];

	return (
		<PlanningGrid
			table={table}
			variant="compact"
			ariaLabel="Enrollment master grid"
			pinnedColumns={['grade']}
			numericColumns={[
				'ay1Headcount',
				'retentionRate',
				'trendRetentionRate',
				'retainedFromPrior',
				'historicalTargetHeadcount',
				'lateralEntry',
				'manualAdjustment',
				'ay2Headcount',
				'delta',
				'maxClassSize',
				'sectionsNeeded',
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
			onRowSelect={(row) => onSelectGrade(row.gradeLevel)}
			selectedRowPredicate={(row) => row.gradeLevel === selectedGradeLevel}
		/>
	);
}

function DirtyDot() {
	return (
		<span
			className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-(--color-warning)"
			aria-label="Unsaved change"
		/>
	);
}
