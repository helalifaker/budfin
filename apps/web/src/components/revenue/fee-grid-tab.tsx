import { AlertTriangle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import Decimal from 'decimal.js';
import type {
	FeeGridEntry,
	FeeScheduleGroup,
	FeeScheduleRow,
	FeeScheduleSection,
	RevenueSettings,
} from '@budfin/types';
import {
	useFeeGrid,
	usePriorYearFees,
	usePutFeeGrid,
	usePutRevenueSettings,
	useRevenueSettings,
} from '../../hooks/use-revenue';
import { EditableCell } from '../shared/editable-cell';
import { Button } from '../ui/button';
import { buildFeeSchedule } from '../../lib/fee-schedule-builder';
import { writebackFeeScheduleEdit } from '../../lib/fee-schedule-writeback';
import { cn } from '../../lib/cn';
import { formatMoney } from '../../lib/format-money';

interface FeeGridTabProps {
	versionId: number;
	academicPeriod: 'AY1' | 'AY2' | 'both';
	isReadOnly: boolean;
}

const CELL_CLASS = 'px-3 py-2 text-xs font-[family-name:var(--font-mono)] tabular-nums text-right';
const HEADER_CELL_CLASS =
	'px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-right';
const LABEL_CELL_CLASS = 'px-3 py-2 text-xs font-medium text-(--text-primary)';
const TABLE_CLASS = 'w-full border-collapse text-left text-sm';

const PER_STUDENT_FEE_LABELS: Record<string, string> = {
	dossierPerStudentHt: 'Frais de Dossier',
	dpiPerStudentHt: 'DPI (1ere Inscription)',
	examBacPerStudent: 'BAC Exam',
	examDnbPerStudent: 'DNB Exam',
	examEafPerStudent: 'EAF Exam',
	evalPrimairePerStudent: 'Evaluation - Primaire',
	evalSecondairePerStudent: 'Evaluation - College+Lycee',
};

const PER_STUDENT_FEE_FIELDS = Object.keys(PER_STUDENT_FEE_LABELS) as Array<
	keyof Omit<RevenueSettings, 'flatDiscountPct'>
>;

function formatFeeMoney(value: string | undefined) {
	if (!value) {
		return '-';
	}

	const amount = new Decimal(value);
	if (amount.eq(0)) {
		return '-';
	}

	return formatMoney(amount, { showCurrency: true });
}

function normalizeCurrencyInput(value: number) {
	return new Decimal(value || 0).toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4);
}

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
	return (
		<div className="space-y-2">
			<h3 className="text-sm font-semibold text-(--text-primary)">{title}</h3>
			<div className="overflow-x-auto rounded-lg border border-(--grid-frame-border) bg-(--workspace-bg-card)">
				{children}
			</div>
		</div>
	);
}

function TuitionSection({
	section,
	isReadOnly,
	onCellEdit,
}: {
	section: FeeScheduleSection;
	isReadOnly: boolean;
	onCellEdit: (row: FeeScheduleRow, field: string, value: string) => void;
}) {
	const groups = section.groups ?? [];

	return (
		<SectionCard title={section.title}>
			<table className={TABLE_CLASS} role="grid" aria-label={section.title}>
				<thead className="sticky top-0 z-[2] border-b-2 border-b-(--grid-frame-border) bg-(--grid-subheader-bg)">
					<tr>
						<th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.12em]">
							Band
						</th>
						<th className={HEADER_CELL_CLASS}>DAI</th>
						<th className={HEADER_CELL_CLASS}>Tuition TTC</th>
						<th className={HEADER_CELL_CLASS}>Prior Year</th>
						<th className={HEADER_CELL_CLASS}>Increase (%)</th>
						<th className={HEADER_CELL_CLASS}>Total TTC</th>
					</tr>
				</thead>
				<tbody>
					{groups.flatMap((group) => renderTuitionGroup(group, isReadOnly, onCellEdit))}
				</tbody>
			</table>
		</SectionCard>
	);
}

function renderTuitionGroup(
	group: FeeScheduleGroup,
	isReadOnly: boolean,
	onCellEdit: (row: FeeScheduleRow, field: string, value: string) => void
) {
	return [
		<tr
			key={`header-${group.nationality}`}
			className="border-b border-(--grid-compact-border) bg-(--workspace-bg-subtle)"
		>
			<td
				colSpan={6}
				className="px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-(--text-secondary)"
			>
				{group.nationalityLabel}
			</td>
		</tr>,
		...group.rows.map((row) => (
			<TuitionRow key={row.id} row={row} isReadOnly={isReadOnly} onCellEdit={onCellEdit} />
		)),
	];
}

function TuitionRow({
	row,
	isReadOnly,
	onCellEdit,
}: {
	row: FeeScheduleRow;
	isReadOnly: boolean;
	onCellEdit: (row: FeeScheduleRow, field: string, value: string) => void;
}) {
	const isEditable = row.editability === 'editable-source' || row.editability === 'editable-fanout';

	return (
		<tr
			className={cn(
				'border-b border-(--grid-compact-border) last:border-0',
				'transition-colors duration-(--duration-fast) hover:bg-gray-50/60',
				row.hasHeterogeneousValues && 'bg-(--color-warning-bg)/40'
			)}
		>
			<td className={LABEL_CELL_CLASS}>
				<div className="flex items-center gap-2">
					<span>{row.label}</span>
					{row.hasHeterogeneousValues && (
						<span className="inline-flex items-center gap-1 rounded-full bg-(--color-warning-bg) px-2 py-0.5 text-[10px] font-semibold text-(--color-warning)">
							<AlertTriangle className="h-3 w-3" aria-hidden="true" />
							Mixed values
						</span>
					)}
				</div>
			</td>
			{renderEditableCell(row, 'dai', isReadOnly || !isEditable, onCellEdit)}
			{renderEditableCell(row, 'tuitionTtc', isReadOnly || !isEditable, onCellEdit)}
			<td className={cn(CELL_CLASS, 'text-(--text-secondary)')}>
				{row.priorYearTtc ? formatFeeMoney(row.priorYearTtc) : '-'}
			</td>
			<td className={cn(CELL_CLASS, 'text-(--text-secondary)')}>
				{row.increasePct ? `${row.increasePct}%` : '-'}
			</td>
			<td className={cn(CELL_CLASS, 'font-semibold text-(--text-primary)')}>
				{formatFeeMoney(row.totalTtc)}
			</td>
		</tr>
	);
}

function renderEditableCell(
	row: FeeScheduleRow,
	field: 'dai' | 'tuitionTtc',
	forceReadOnly: boolean,
	onCellEdit: (row: FeeScheduleRow, field: string, value: string) => void
) {
	const value = row[field];
	if (forceReadOnly) {
		return <td className={CELL_CLASS}>{formatFeeMoney(value)}</td>;
	}

	return (
		<td className={cn(CELL_CLASS, 'p-1')}>
			<EditableCell
				value={value ?? '0'}
				onChange={(nextValue) => onCellEdit(row, field, normalizeCurrencyInput(nextValue))}
				isReadOnly={false}
				type="number"
			/>
		</td>
	);
}

function PerStudentFeeBlock({
	settings,
	isReadOnly,
	onSettingEdit,
}: {
	settings: RevenueSettings | null;
	isReadOnly: boolean;
	onSettingEdit: (field: keyof RevenueSettings, value: string) => void;
}) {
	return (
		<SectionCard title="Per-Student Fees">
			<table className={TABLE_CLASS} role="table" aria-label="Per-Student Fees">
				<thead className="sticky top-0 z-[2] border-b-2 border-b-(--grid-frame-border) bg-(--grid-subheader-bg)">
					<tr>
						<th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.12em]">
							Fee Type
						</th>
						<th className={HEADER_CELL_CLASS}>Amount HT</th>
					</tr>
				</thead>
				<tbody>
					{PER_STUDENT_FEE_FIELDS.map((field) => {
						const value = settings?.[field] ?? '0.0000';
						return (
							<tr
								key={field}
								className="border-b border-(--grid-compact-border) last:border-0 hover:bg-gray-50/60"
							>
								<td className={LABEL_CELL_CLASS}>{PER_STUDENT_FEE_LABELS[field]}</td>
								{isReadOnly ? (
									<td className={CELL_CLASS}>{formatFeeMoney(value)}</td>
								) : (
									<td className={cn(CELL_CLASS, 'p-1')}>
										<EditableCell
											value={value}
											onChange={(nextValue) =>
												onSettingEdit(field, normalizeCurrencyInput(nextValue))
											}
											isReadOnly={false}
											type="number"
										/>
									</td>
								)}
							</tr>
						);
					})}
				</tbody>
			</table>
		</SectionCard>
	);
}

function EmptyState() {
	return (
		<div className="flex flex-col items-center justify-center py-12 text-center">
			<p className="text-sm text-(--text-muted)">
				No fee schedule data is available for this version.
			</p>
		</div>
	);
}

function FeeGridSkeleton() {
	return (
		<div className="space-y-6 animate-pulse">
			{[1, 2].map((index) => (
				<div
					key={index}
					className="overflow-hidden rounded-lg border border-(--grid-frame-border) bg-(--workspace-bg-card)"
				>
					<div className="h-10 bg-(--workspace-bg-muted)" />
					{Array.from({ length: 4 }).map((_, rowIndex) => (
						<div
							key={rowIndex}
							className="flex gap-4 border-b border-(--grid-compact-border) px-3 py-3"
						>
							<div className="h-4 w-28 rounded bg-(--workspace-bg-muted)" />
							<div className="ml-auto h-4 w-20 rounded bg-(--workspace-bg-muted)" />
							<div className="h-4 w-20 rounded bg-(--workspace-bg-muted)" />
							<div className="h-4 w-20 rounded bg-(--workspace-bg-muted)" />
						</div>
					))}
				</div>
			))}
		</div>
	);
}

export function FeeGridTab({ versionId, academicPeriod, isReadOnly }: FeeGridTabProps) {
	const { data, isLoading } = useFeeGrid(versionId, academicPeriod);
	const { data: settingsData, isLoading: settingsLoading } = useRevenueSettings(versionId);
	const { data: priorYearData } = usePriorYearFees(versionId);
	const saveFeeGridMutation = usePutFeeGrid(versionId);
	const saveSettingsMutation = usePutRevenueSettings(versionId);
	const sourceEntries = useMemo(() => data?.entries ?? [], [data?.entries]);
	const sourceSettings = settingsData?.settings ?? null;
	const [draftEntries, setDraftEntries] = useState<FeeGridEntry[]>([]);
	const [draftSettings, setDraftSettings] = useState<RevenueSettings | null>(null);

	useEffect(() => {
		setDraftEntries(sourceEntries);
	}, [sourceEntries]);

	useEffect(() => {
		setDraftSettings(sourceSettings);
	}, [sourceSettings]);

	const isEntriesDirty = JSON.stringify(draftEntries) !== JSON.stringify(sourceEntries);
	const isSettingsDirty = JSON.stringify(draftSettings) !== JSON.stringify(sourceSettings);
	const isDirty = isEntriesDirty || isSettingsDirty;

	const sections: FeeScheduleSection[] = useMemo(
		() =>
			buildFeeSchedule({
				entries: draftEntries,
				settings: draftSettings,
				priorYearEntries: priorYearData?.entries,
			}),
		[draftEntries, draftSettings, priorYearData?.entries]
	);

	const handleTuitionCellEdit = (editedRow: FeeScheduleRow, field: string, newValue: string) => {
		setDraftEntries((current) => writebackFeeScheduleEdit(current, editedRow, field, newValue));
	};

	const handleSettingEdit = (field: keyof RevenueSettings, newValue: string) => {
		setDraftSettings((current) => (current === null ? current : { ...current, [field]: newValue }));
	};

	const handleSave = async () => {
		const mutations: Promise<unknown>[] = [];
		if (isEntriesDirty) {
			mutations.push(saveFeeGridMutation.mutateAsync(draftEntries));
		}
		if (isSettingsDirty && draftSettings) {
			mutations.push(saveSettingsMutation.mutateAsync(draftSettings));
		}
		await Promise.all(mutations);
	};

	if (isLoading || settingsLoading) {
		return (
			<div className="space-y-4">
				<FeeGridHeader
					isReadOnly={isReadOnly}
					isDirty={false}
					isPending={false}
					onSave={() => {}}
				/>
				<FeeGridSkeleton />
			</div>
		);
	}

	if (draftEntries.length === 0 && !draftSettings) {
		return (
			<div className="space-y-4">
				<FeeGridHeader
					isReadOnly={isReadOnly}
					isDirty={false}
					isPending={false}
					onSave={() => {}}
				/>
				<EmptyState />
			</div>
		);
	}

	const [tuitionSection, perStudentSection] = sections;
	const isPending = saveFeeGridMutation.isPending || saveSettingsMutation.isPending;

	return (
		<div className="space-y-4">
			<FeeGridHeader
				isReadOnly={isReadOnly}
				isDirty={isDirty}
				isPending={isPending}
				onSave={() => void handleSave()}
			/>

			<div className="space-y-6">
				{tuitionSection && (
					<TuitionSection
						section={tuitionSection}
						isReadOnly={isReadOnly}
						onCellEdit={handleTuitionCellEdit}
					/>
				)}
				{perStudentSection && (
					<PerStudentFeeBlock
						settings={draftSettings}
						isReadOnly={isReadOnly}
						onSettingEdit={handleSettingEdit}
					/>
				)}
			</div>
		</div>
	);
}

function FeeGridHeader({
	isReadOnly,
	isDirty,
	isPending,
	onSave,
}: {
	isReadOnly: boolean;
	isDirty: boolean;
	isPending: boolean;
	onSave: () => void;
}) {
	return (
		<div className="flex items-center justify-between rounded-lg border border-(--workspace-border) bg-(--workspace-bg-subtle) px-4 py-3 text-sm">
			<div>
				<div className="font-medium text-(--text-primary)">Fee Schedule</div>
				<div className="text-(--text-muted)">
					Tuition bands, per-student fees, and prior-year comparison.
				</div>
			</div>
			{!isReadOnly && (
				<Button size="sm" disabled={!isDirty || isPending} onClick={onSave}>
					{isPending ? 'Saving...' : 'Save Fee Schedule'}
				</Button>
			)}
		</div>
	);
}
