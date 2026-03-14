import { useEffect, useMemo, useState } from 'react';
import Decimal from 'decimal.js';
import type { FeeGridEntry, FeeScheduleRow, FeeScheduleSection } from '@budfin/types';
import { useFeeGrid, usePutFeeGrid } from '../../hooks/use-revenue';
import { EditableCell } from '../data-grid/editable-cell';
import { Button } from '../ui/button';
import { buildFeeSchedule } from '../../lib/fee-schedule-builder';
import { writebackFeeScheduleEdit } from '../../lib/fee-schedule-writeback';
import { cn } from '../../lib/cn';

interface FeeGridTabProps {
	versionId: number;
	academicPeriod: 'AY1' | 'AY2' | 'both';
	isReadOnly: boolean;
}

// ── SAR formatting ──────────────────────────────────────────────────────────

function formatSar(value: string | undefined): string {
	if (!value || value === '0' || value === '0.0000') return '-';
	const d = new Decimal(value);
	if (d.isZero()) return '-';
	const rounded = d.abs().toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
	const formatted = rounded.toNumber().toLocaleString('fr-FR', {
		maximumFractionDigits: 0,
	});
	return d.lt(0) ? `(${formatted}) SAR` : `${formatted} SAR`;
}

// ── Nationality header colors ───────────────────────────────────────────────

const NATIONALITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
	Francais: {
		bg: 'bg-blue-50',
		text: 'text-blue-800',
		border: 'border-blue-200',
	},
	Nationaux: {
		bg: 'bg-emerald-50',
		text: 'text-emerald-800',
		border: 'border-emerald-200',
	},
	Autres: {
		bg: 'bg-amber-50',
		text: 'text-amber-800',
		border: 'border-amber-200',
	},
};

// ── Shared table styles ─────────────────────────────────────────────────────

const CELL_CLASS = 'px-3 py-2 text-xs font-[family-name:var(--font-mono)] tabular-nums text-right';
const HEADER_CELL_CLASS =
	'px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-right';
const LABEL_CELL_CLASS = 'px-3 py-2 text-xs font-medium text-(--text-primary)';
const TABLE_CLASS = 'w-full border-collapse text-left text-sm';
const SECTION_WRAPPER_CLASS =
	'overflow-x-auto rounded-lg border border-(--grid-frame-border) bg-(--workspace-bg-card)';

// ── Section 1: Tuition Fees ─────────────────────────────────────────────────

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
		<div className="space-y-1">
			<h3 className="text-sm font-semibold text-(--text-primary)">{section.title}</h3>
			<div className={SECTION_WRAPPER_CLASS}>
				<table className={TABLE_CLASS} role="grid" aria-label={section.title}>
					<thead className="sticky top-0 z-[2] bg-(--grid-subheader-bg) border-b-2 border-b-(--grid-frame-border)">
						<tr role="row">
							<th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-left w-36">
								Level
							</th>
							<th className={HEADER_CELL_CLASS}>DAI</th>
							<th className={HEADER_CELL_CLASS}>Tuition HT</th>
							<th className={HEADER_CELL_CLASS}>Term 1</th>
							<th className={HEADER_CELL_CLASS}>Term 2</th>
							<th className={HEADER_CELL_CLASS}>Term 3</th>
							<th className={HEADER_CELL_CLASS}>Total TTC</th>
						</tr>
					</thead>
					<tbody>
						{groups.map((group) => {
							const colors = NATIONALITY_COLORS[group.nationality] ?? {
								bg: 'bg-gray-50',
								text: 'text-gray-800',
								border: 'border-gray-200',
							};

							return [
								<tr
									key={`header-${group.nationality}`}
									role="row"
									className={cn('border-b', colors.border, colors.bg)}
								>
									<td
										colSpan={7}
										className={cn(
											'px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em]',
											colors.text
										)}
									>
										{group.nationalityLabel}
									</td>
								</tr>,
								...group.rows.map((row) => (
									<TuitionRow
										key={row.id}
										row={row}
										isReadOnly={isReadOnly}
										onCellEdit={onCellEdit}
									/>
								)),
							];
						})}
					</tbody>
				</table>
			</div>
		</div>
	);
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
	const isEditable = row.editability !== 'summary-only';
	const showWarning = row.hasHeterogeneousValues;

	return (
		<tr
			role="row"
			className={cn(
				'border-b border-(--grid-compact-border) last:border-0',
				'hover:bg-gray-50/60 transition-colors duration-100',
				showWarning && 'bg-amber-50/30'
			)}
		>
			<td className={LABEL_CELL_CLASS}>
				<span className="flex items-center gap-1.5">
					{row.label}
					{(row.underlyingGradeCount ?? 0) > 1 && (
						<span className="inline-flex items-center justify-center min-w-4 rounded-full bg-(--workspace-bg-muted) px-1 py-0 text-[10px] font-medium text-(--text-muted)">
							{row.underlyingGradeCount}
						</span>
					)}
					{showWarning && (
						<span
							className="inline-block h-2 w-2 rounded-full bg-amber-400"
							title="Underlying grades have different values"
							aria-label="Heterogeneous values warning"
						/>
					)}
				</span>
			</td>
			{renderTuitionCell(row, 'dai', isReadOnly && !isEditable, isReadOnly, onCellEdit)}
			{renderTuitionCell(row, 'tuitionHt', isReadOnly && !isEditable, isReadOnly, onCellEdit)}
			{renderTuitionCell(row, 'term1', isReadOnly && !isEditable, isReadOnly, onCellEdit)}
			{renderTuitionCell(row, 'term2', isReadOnly && !isEditable, isReadOnly, onCellEdit)}
			{renderTuitionCell(row, 'term3', isReadOnly && !isEditable, isReadOnly, onCellEdit)}
			<td className={cn(CELL_CLASS, 'font-semibold text-(--text-primary)')}>
				{formatSar(row.totalTtc)}
			</td>
		</tr>
	);
}

function renderTuitionCell(
	row: FeeScheduleRow,
	field: string,
	forceReadOnly: boolean,
	isTabReadOnly: boolean,
	onCellEdit: (row: FeeScheduleRow, field: string, value: string) => void
) {
	const value = (row as Record<string, unknown>)[field] as string | undefined;
	const isEditable = row.editability !== 'summary-only' && !isTabReadOnly;

	if (!isEditable || forceReadOnly) {
		return <td className={CELL_CLASS}>{formatSar(value)}</td>;
	}

	return (
		<td className={cn(CELL_CLASS, 'p-1')}>
			<EditableCell
				value={value ?? '0'}
				onChange={(newVal) => {
					const sanitized = String(Number(newVal.replace(/,/g, '.')) || 0);
					onCellEdit(row, field, sanitized);
				}}
				isReadOnly={false}
				type="number"
			/>
		</td>
	);
}

// ── Section 2: Autres Frais ─────────────────────────────────────────────────

function AutresFraisSection({ section }: { section: FeeScheduleSection }) {
	const rows = section.rows ?? [];

	return (
		<div className="space-y-1">
			<h3 className="text-sm font-semibold text-(--text-primary)">{section.title}</h3>
			<div className={SECTION_WRAPPER_CLASS}>
				<table className={TABLE_CLASS} role="table" aria-label={section.title}>
					<thead className="sticky top-0 z-[2] bg-(--grid-subheader-bg) border-b-2 border-b-(--grid-frame-border)">
						<tr role="row">
							<th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-left w-36">
								Level
							</th>
							<th className={HEADER_CELL_CLASS}>DAI Francais</th>
							<th className={HEADER_CELL_CLASS}>DAI Nationaux</th>
							<th className={HEADER_CELL_CLASS}>DAI Autres</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((row) => {
							const daiData = row as Record<string, unknown>;
							return (
								<tr
									key={row.id}
									role="row"
									className="border-b border-(--grid-compact-border) last:border-0 hover:bg-gray-50/60 transition-colors duration-100"
								>
									<td className={LABEL_CELL_CLASS}>{row.label}</td>
									<td className={CELL_CLASS}>
										{formatSar(daiData.dai_Francais as string | undefined)}
									</td>
									<td className={CELL_CLASS}>
										{formatSar(daiData.dai_Nationaux as string | undefined)}
									</td>
									<td className={CELL_CLASS}>
										{formatSar(daiData.dai_Autres as string | undefined)}
									</td>
								</tr>
							);
						})}
						{rows.length === 0 && (
							<tr>
								<td colSpan={4} className="px-4 py-8 text-center text-sm text-(--text-muted)">
									No DAI data available.
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
		</div>
	);
}

// ── Section 3: Tarifs Abattement ────────────────────────────────────────────

function AbattementSection({ section }: { section: FeeScheduleSection }) {
	const rows = section.rows ?? [];

	return (
		<div className="space-y-1">
			<h3 className="text-sm font-semibold text-(--text-primary)">{section.title}</h3>
			<div className={SECTION_WRAPPER_CLASS}>
				<table className={TABLE_CLASS} role="table" aria-label={section.title}>
					<thead className="sticky top-0 z-[2] bg-(--grid-subheader-bg) border-b-2 border-b-(--grid-frame-border)">
						<tr role="row">
							<th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-left w-48">
								Level / Tariff
							</th>
							<th className={HEADER_CELL_CLASS}>Tuition HT</th>
							<th className={HEADER_CELL_CLASS}>Total TTC</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((row) => (
							<tr
								key={row.id}
								role="row"
								className="border-b border-(--grid-compact-border) last:border-0 hover:bg-gray-50/60 transition-colors duration-100"
							>
								<td className={LABEL_CELL_CLASS}>{row.label}</td>
								<td className={CELL_CLASS}>{formatSar(row.tuitionHt)}</td>
								<td className={CELL_CLASS}>{formatSar(row.totalTtc)}</td>
							</tr>
						))}
						{rows.length === 0 && (
							<tr>
								<td colSpan={3} className="px-4 py-8 text-center text-sm text-(--text-muted)">
									No abattement data available.
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
		</div>
	);
}

// ── Empty state ─────────────────────────────────────────────────────────────

function EmptyState() {
	return (
		<div className="flex flex-col items-center justify-center py-12 text-center">
			<div className="mb-2 text-3xl text-(--text-muted)" aria-hidden="true">
				~
			</div>
			<p className="text-sm text-(--text-muted)">No fee grid data is available for this period.</p>
		</div>
	);
}

// ── Loading skeleton ────────────────────────────────────────────────────────

function FeeGridSkeleton() {
	return (
		<div className="space-y-6 animate-pulse">
			{[1, 2, 3].map((i) => (
				<div key={i} className={SECTION_WRAPPER_CLASS}>
					<div className="h-8 bg-(--workspace-bg-muted) rounded-t-lg" />
					{Array.from({ length: 5 }).map((_, j) => (
						<div key={j} className="flex gap-4 px-3 py-3 border-b border-(--grid-compact-border)">
							<div className="h-4 w-24 bg-(--workspace-bg-muted) rounded" />
							<div className="h-4 w-16 bg-(--workspace-bg-muted) rounded ml-auto" />
							<div className="h-4 w-16 bg-(--workspace-bg-muted) rounded" />
							<div className="h-4 w-16 bg-(--workspace-bg-muted) rounded" />
						</div>
					))}
				</div>
			))}
		</div>
	);
}

// ── Main component ──────────────────────────────────────────────────────────

export function FeeGridTab({ versionId, academicPeriod, isReadOnly }: FeeGridTabProps) {
	const { data, isLoading } = useFeeGrid(versionId, academicPeriod);
	const saveMutation = usePutFeeGrid(versionId);
	const sourceEntries = useMemo(() => data?.entries ?? [], [data?.entries]);
	const [draftEntries, setDraftEntries] = useState<FeeGridEntry[]>([]);

	useEffect(() => {
		setDraftEntries(sourceEntries);
	}, [sourceEntries]);

	const isDirty = JSON.stringify(draftEntries) !== JSON.stringify(sourceEntries);

	const sections: FeeScheduleSection[] = useMemo(
		() => (draftEntries.length > 0 ? buildFeeSchedule(draftEntries) : []),
		[draftEntries]
	);

	const handleCellEdit = (editedRow: FeeScheduleRow, field: string, newValue: string) => {
		setDraftEntries((current) => writebackFeeScheduleEdit(current, editedRow, field, newValue));
	};

	if (isLoading) {
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

	if (draftEntries.length === 0) {
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

	const tuitionSection = sections[0];
	const autresSection = sections[1];
	const abattementSection = sections[2];

	return (
		<div className="space-y-4">
			<FeeGridHeader
				isReadOnly={isReadOnly}
				isDirty={isDirty}
				isPending={saveMutation.isPending}
				onSave={() => saveMutation.mutate(draftEntries)}
			/>

			<div className="space-y-6">
				{tuitionSection && (
					<TuitionSection
						section={tuitionSection}
						isReadOnly={isReadOnly}
						onCellEdit={handleCellEdit}
					/>
				)}

				{autresSection && <AutresFraisSection section={autresSection} />}

				{abattementSection && <AbattementSection section={abattementSection} />}
			</div>
		</div>
	);
}

// ── Header bar ──────────────────────────────────────────────────────────────

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
				<div className="font-medium text-(--text-primary)">Fee Grid</div>
				<div className="text-(--text-muted)">
					Edit tariff-level fees directly in the grid. The workbook logic still derives discounts
					separately.
				</div>
			</div>
			{!isReadOnly && (
				<Button size="sm" disabled={!isDirty || isPending} onClick={onSave}>
					{isPending ? 'Saving...' : 'Save Fee Grid'}
				</Button>
			)}
		</div>
	);
}
