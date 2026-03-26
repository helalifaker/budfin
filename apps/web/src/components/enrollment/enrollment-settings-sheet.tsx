import { startTransition, useEffect, useMemo, useState } from 'react';
import type {
	EnrollmentCapacityByGradeSetting,
	EnrollmentSettingsUpdatePayload,
	PlanningRules,
} from '@budfin/types';
import { ChevronDown, ChevronRight, Undo2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from '../ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { useEnrollmentSettings, usePutEnrollmentSettings } from '../../hooks/use-enrollment';
import { useEnrollmentSettingsSheetStore } from '../../stores/enrollment-settings-store';
import type { EnrollmentEditability } from '../../lib/enrollment-workspace';
import { cn } from '../../lib/cn';

const BAND_ORDER = ['MATERNELLE', 'ELEMENTAIRE', 'COLLEGE', 'LYCEE'] as const;
const BAND_LABELS: Record<(typeof BAND_ORDER)[number], string> = {
	MATERNELLE: 'Maternelle',
	ELEMENTAIRE: 'Elementaire',
	COLLEGE: 'College',
	LYCEE: 'Lycee',
};

type BulkScope = 'ALL' | (typeof BAND_ORDER)[number];

type CapacityBulkDraft = {
	maxClassSize: string;
	plancherPct: string;
	ciblePct: string;
	plafondPct: string;
};

const EMPTY_BULK_DRAFT: CapacityBulkDraft = {
	maxClassSize: '',
	plancherPct: '',
	ciblePct: '',
	plafondPct: '',
};

function cloneRules(rules: PlanningRules): PlanningRules {
	return {
		rolloverThreshold: rules.rolloverThreshold,
		cappedRetention: rules.cappedRetention,
		retentionRecentWeight: rules.retentionRecentWeight,
		historicalTargetRecentWeight: rules.historicalTargetRecentWeight,
	};
}

function cloneCapacityRows(rows: EnrollmentCapacityByGradeSetting[]) {
	return rows.map((row) => ({ ...row }));
}

function parseOptionalNumber(value: string) {
	if (value.trim() === '') {
		return null;
	}

	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : null;
}

function isValidRules(rules: PlanningRules) {
	return (
		rules.rolloverThreshold >= 0.5 &&
		rules.rolloverThreshold <= 2 &&
		(rules.cappedRetention ?? 0.98) >= 0.5 &&
		(rules.cappedRetention ?? 0.98) <= 1 &&
		rules.retentionRecentWeight >= 0 &&
		rules.retentionRecentWeight <= 1 &&
		rules.historicalTargetRecentWeight >= 0 &&
		rules.historicalTargetRecentWeight <= 1
	);
}

function isValidCapacityRow(row: EnrollmentCapacityByGradeSetting) {
	return (
		row.maxClassSize >= 1 &&
		row.maxClassSize <= 50 &&
		row.plancherPct >= 0 &&
		row.ciblePct >= 0 &&
		row.plafondPct >= 0 &&
		row.plafondPct <= 1.5 &&
		row.plancherPct <= row.ciblePct &&
		row.ciblePct <= row.plafondPct
	);
}

function buildUpdatePayload({
	rules,
	capacityByGrade,
}: {
	rules: PlanningRules;
	capacityByGrade: EnrollmentCapacityByGradeSetting[];
}): EnrollmentSettingsUpdatePayload {
	return {
		rules,
		capacityByGrade: capacityByGrade.map((row) => ({
			gradeLevel: row.gradeLevel,
			maxClassSize: row.maxClassSize,
			plancherPct: row.plancherPct,
			ciblePct: row.ciblePct,
			plafondPct: row.plafondPct,
		})),
	};
}

const fieldInputClass = cn(
	'w-full rounded-md border border-(--workspace-border) bg-(--cell-editable-bg) px-3 py-2 text-right',
	'font-mono tabular-nums text-(--text-primary)'
);

function rowDiffersFromTemplate(row: EnrollmentCapacityByGradeSetting) {
	return (
		row.maxClassSize !== row.templateMaxClassSize ||
		row.plancherPct !== row.templatePlancherPct ||
		row.ciblePct !== row.templateCiblePct ||
		row.plafondPct !== row.templatePlafondPct
	);
}

function formatPercentLabel(value: number) {
	return `${Math.round(value * 100)}%`;
}

function buildDefaultExpandedBands() {
	return Object.fromEntries(BAND_ORDER.map((band) => [band, true])) as Record<string, boolean>;
}

export function EnrollmentSettingsSheet({
	versionId,
	editability,
}: {
	versionId: number | null;
	editability: EnrollmentEditability;
}) {
	const isOpen = useEnrollmentSettingsSheetStore((state) => state.isOpen);
	const setOpen = useEnrollmentSettingsSheetStore((state) => state.setOpen);
	const { data, isLoading } = useEnrollmentSettings(versionId);
	const putEnrollmentSettings = usePutEnrollmentSettings(versionId);
	const isEditable = editability === 'editable';
	const [draftRules, setDraftRules] = useState<PlanningRules | null>(null);
	const [draftCapacity, setDraftCapacity] = useState<EnrollmentCapacityByGradeSetting[]>([]);
	const [bulkDraft, setBulkDraft] = useState<CapacityBulkDraft>({ ...EMPTY_BULK_DRAFT });
	const [bulkScope, setBulkScope] = useState<BulkScope>('ALL');
	const [expandedBands, setExpandedBands] = useState(buildDefaultExpandedBands);

	useEffect(() => {
		if (!isOpen || !data) {
			return;
		}

		startTransition(() => {
			setDraftRules(cloneRules(data.rules));
			setDraftCapacity(cloneCapacityRows(data.capacityByGrade));
			setBulkDraft({ ...EMPTY_BULK_DRAFT });
			setBulkScope('ALL');
			setExpandedBands(buildDefaultExpandedBands());
		});
	}, [data, isOpen]);

	const rules = draftRules ?? data?.rules ?? null;
	const capacityByGrade = useMemo(
		() => (draftCapacity.length > 0 ? draftCapacity : (data?.capacityByGrade ?? [])),
		[draftCapacity, data?.capacityByGrade]
	);
	const initialPayload = useMemo(
		() =>
			data
				? JSON.stringify(
						buildUpdatePayload({
							rules: data.rules,
							capacityByGrade: data.capacityByGrade,
						})
					)
				: null,
		[data]
	);
	const currentPayload = useMemo(
		() =>
			rules
				? JSON.stringify(
						buildUpdatePayload({
							rules,
							capacityByGrade,
						})
					)
				: null,
		[capacityByGrade, rules]
	);
	const hasChanges =
		initialPayload !== null && currentPayload !== null && initialPayload !== currentPayload;
	const isValid =
		rules !== null && isValidRules(rules) && capacityByGrade.every(isValidCapacityRow);

	const groupedByBand = useMemo(
		() =>
			BAND_ORDER.map((band) => ({
				band,
				label: BAND_LABELS[band],
				rows: capacityByGrade.filter((row) => row.band === band),
			})),
		[capacityByGrade]
	);

	function updateCapacityRow(
		gradeLevel: string,
		field: keyof Pick<
			EnrollmentCapacityByGradeSetting,
			'maxClassSize' | 'plancherPct' | 'ciblePct' | 'plafondPct'
		>,
		value: number
	) {
		setDraftCapacity((currentRows) =>
			currentRows.map((row) =>
				row.gradeLevel === gradeLevel
					? {
							...row,
							[field]: field === 'maxClassSize' ? Math.max(1, Math.round(value)) : value,
						}
					: row
			)
		);
	}

	function resetRowToTemplate(gradeLevel: string) {
		setDraftCapacity((currentRows) =>
			currentRows.map((row) =>
				row.gradeLevel === gradeLevel
					? {
							...row,
							maxClassSize: row.templateMaxClassSize,
							plancherPct: row.templatePlancherPct,
							ciblePct: row.templateCiblePct,
							plafondPct: row.templatePlafondPct,
						}
					: row
			)
		);
	}

	function applyBulkDraft(
		draft: CapacityBulkDraft,
		predicate: (row: EnrollmentCapacityByGradeSetting) => boolean
	) {
		const nextMaxClassSize = parseOptionalNumber(draft.maxClassSize);
		const nextPlancherPct = parseOptionalNumber(draft.plancherPct);
		const nextCiblePct = parseOptionalNumber(draft.ciblePct);
		const nextPlafondPct = parseOptionalNumber(draft.plafondPct);

		if (
			nextMaxClassSize === null &&
			nextPlancherPct === null &&
			nextCiblePct === null &&
			nextPlafondPct === null
		) {
			return;
		}

		setDraftCapacity((currentRows) =>
			currentRows.map((row) => {
				if (!predicate(row)) {
					return row;
				}

				return {
					...row,
					maxClassSize:
						nextMaxClassSize === null
							? row.maxClassSize
							: Math.max(1, Math.round(nextMaxClassSize)),
					plancherPct: nextPlancherPct ?? row.plancherPct,
					ciblePct: nextCiblePct ?? row.ciblePct,
					plafondPct: nextPlafondPct ?? row.plafondPct,
				};
			})
		);
	}

	function handleResetAll() {
		setDraftCapacity((currentRows) =>
			currentRows.map((row) => ({
				...row,
				maxClassSize: row.templateMaxClassSize,
				plancherPct: row.templatePlancherPct,
				ciblePct: row.templateCiblePct,
				plafondPct: row.templatePlafondPct,
			}))
		);
	}

	function handleApplyBulk() {
		const predicate =
			bulkScope === 'ALL'
				? () => true
				: (row: EnrollmentCapacityByGradeSetting) => row.band === bulkScope;
		applyBulkDraft(bulkDraft, predicate);
	}

	function toggleBand(band: string) {
		setExpandedBands((current) => ({ ...current, [band]: !current[band] }));
	}

	function handleSave() {
		if (!rules || !isValid || !hasChanges) {
			return;
		}

		putEnrollmentSettings.mutate(
			buildUpdatePayload({
				rules,
				capacityByGrade,
			}),
			{
				onSuccess: () => {
					setOpen(false);
				},
			}
		);
	}

	return (
		<Sheet open={isOpen} onOpenChange={setOpen}>
			<SheetContent side="right" className="flex w-[680px] max-w-[92vw] flex-col sm:max-w-[680px]">
				<SheetHeader>
					<SheetTitle>Enrollment Settings</SheetTitle>
					<SheetDescription>Manage planning rules and capacity policy.</SheetDescription>
				</SheetHeader>

				<TooltipProvider delayDuration={200}>
					<div className="flex-1 overflow-y-auto px-6">
						<Tabs defaultValue="rules" className="mt-4">
							<TabsList className="w-full">
								<TabsTrigger value="rules">Planning Rules</TabsTrigger>
								<TabsTrigger value="capacity">Capacity Policy</TabsTrigger>
							</TabsList>

							{/* Tab 1: Planning Rules */}
							<TabsContent value="rules">
								<section className="rounded-xl border border-(--workspace-border) bg-(--workspace-bg-card) p-4">
									<div className="flex items-start justify-between gap-4">
										<div>
											<p className="text-(--text-xs) font-semibold uppercase tracking-(--tracking-wide) text-(--text-muted)">
												Recommendation Rules
											</p>
											<p className="mt-1 text-(--text-sm) text-(--text-secondary)">
												These guide the default cohort recommendations across the current version.
											</p>
										</div>
										{!isEditable && (
											<span className="rounded-full bg-(--workspace-bg-subtle) px-3 py-1 text-(--text-xs) font-medium text-(--text-muted)">
												Review mode
											</span>
										)}
									</div>

									{isLoading || !rules ? (
										<p className="mt-4 text-(--text-sm) text-(--text-muted)">Loading settings...</p>
									) : (
										<div className="mt-4 grid gap-3 md:grid-cols-2">
											<div>
												<label
													htmlFor="rollover-threshold"
													className="block text-(--text-xs) font-semibold uppercase tracking-(--tracking-wide) text-(--text-muted)"
												>
													Rollover threshold (%)
												</label>
												<Input
													id="rollover-threshold"
													type="number"
													min={50}
													max={200}
													step={1}
													value={Math.round(rules.rolloverThreshold * 100)}
													onChange={(event) =>
														setDraftRules((current) => ({
															...(current ?? rules),
															rolloverThreshold: Number(event.target.value) / 100,
														}))
													}
													disabled={!isEditable}
													className={cn(fieldInputClass, 'mt-2')}
												/>
											</div>
											<div>
												<label
													htmlFor="capped-retention"
													className="block text-(--text-xs) font-semibold uppercase tracking-(--tracking-wide) text-(--text-muted)"
												>
													Capped retention (%)
												</label>
												<Input
													id="capped-retention"
													type="number"
													min={50}
													max={100}
													step={1}
													value={Math.round((rules.cappedRetention ?? 0.98) * 100)}
													onChange={(event) =>
														setDraftRules((current) => ({
															...(current ?? rules),
															cappedRetention: Number(event.target.value) / 100,
														}))
													}
													disabled={!isEditable}
													className={cn(fieldInputClass, 'mt-2')}
												/>
											</div>
											<div>
												<label
													htmlFor="retention-trend-weight"
													className="block text-(--text-xs) font-semibold uppercase tracking-(--tracking-wide) text-(--text-muted)"
												>
													Retention trend weight (%)
												</label>
												<Input
													id="retention-trend-weight"
													type="number"
													min={0}
													max={100}
													step={1}
													value={Math.round(rules.retentionRecentWeight * 100)}
													onChange={(event) =>
														setDraftRules((current) => ({
															...(current ?? rules),
															retentionRecentWeight: Number(event.target.value) / 100,
														}))
													}
													disabled={!isEditable}
													className={cn(fieldInputClass, 'mt-2')}
												/>
											</div>
											<div>
												<label
													htmlFor="historical-target-weight"
													className="block text-(--text-xs) font-semibold uppercase tracking-(--tracking-wide) text-(--text-muted)"
												>
													Historical target weight (%)
												</label>
												<Input
													id="historical-target-weight"
													type="number"
													min={0}
													max={100}
													step={1}
													value={Math.round(rules.historicalTargetRecentWeight * 100)}
													onChange={(event) =>
														setDraftRules((current) => ({
															...(current ?? rules),
															historicalTargetRecentWeight: Number(event.target.value) / 100,
														}))
													}
													disabled={!isEditable}
													className={cn(fieldInputClass, 'mt-2')}
												/>
											</div>
										</div>
									)}
								</section>
							</TabsContent>

							{/* Tab 2: Capacity Policy */}
							<TabsContent value="capacity">
								{/* Inline bulk toolbar */}
								<div className="rounded-xl border border-(--workspace-border) bg-(--workspace-bg-subtle) p-3">
									<div className="flex flex-wrap items-end gap-2">
										<div className="w-[140px]">
											<label className="block text-(--text-xs) font-semibold uppercase tracking-(--tracking-wide) text-(--text-muted)">
												Apply to
											</label>
											<Select
												value={bulkScope}
												onValueChange={(v) => setBulkScope(v as BulkScope)}
												disabled={!isEditable}
											>
												<SelectTrigger className="mt-1 h-9">
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="ALL">All grades</SelectItem>
													{BAND_ORDER.map((band) => (
														<SelectItem key={band} value={band}>
															{BAND_LABELS[band]}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
										{(
											[
												['maxClassSize', 'Max'],
												['plancherPct', 'Fl%'],
												['ciblePct', 'Tgt%'],
												['plafondPct', 'Ceil%'],
											] as const
										).map(([field, label]) => (
											<div key={field} className="w-[72px]">
												<label className="block text-(--text-xs) font-semibold uppercase tracking-(--tracking-wide) text-(--text-muted)">
													{label}
												</label>
												<Input
													type="number"
													min={field === 'maxClassSize' ? 1 : 0}
													max={field === 'maxClassSize' ? 50 : field === 'plafondPct' ? 1.5 : 1}
													step={field === 'maxClassSize' ? 1 : 0.01}
													value={bulkDraft[field]}
													onChange={(event) =>
														setBulkDraft((current) => ({
															...current,
															[field]: event.target.value,
														}))
													}
													disabled={!isEditable}
													className={cn(fieldInputClass, 'mt-1 h-9 px-2')}
												/>
											</div>
										))}
										<Button
											type="button"
											size="sm"
											onClick={handleApplyBulk}
											disabled={!isEditable}
										>
											Apply
										</Button>
										<Button
											type="button"
											variant="ghost"
											size="sm"
											onClick={handleResetAll}
											disabled={!isEditable || capacityByGrade.length === 0}
										>
											Reset all
										</Button>
									</div>
								</div>

								{/* Band-grouped collapsible table */}
								<div className="mt-3 overflow-x-auto rounded-xl border border-(--workspace-border)">
									<table className="w-full text-left text-(--text-sm)">
										<thead className="bg-(--workspace-bg-subtle)">
											<tr>
												<th className="px-3 py-2 text-(--text-xs) font-semibold uppercase tracking-(--tracking-wide) text-(--text-muted)">
													Grade
												</th>
												<th className="px-3 py-2 text-right text-(--text-xs) font-semibold uppercase tracking-(--tracking-wide) text-(--text-muted)">
													Max
												</th>
												<th className="px-3 py-2 text-right text-(--text-xs) font-semibold uppercase tracking-(--tracking-wide) text-(--text-muted)">
													Floor %
												</th>
												<th className="px-3 py-2 text-right text-(--text-xs) font-semibold uppercase tracking-(--tracking-wide) text-(--text-muted)">
													Target %
												</th>
												<th className="px-3 py-2 text-right text-(--text-xs) font-semibold uppercase tracking-(--tracking-wide) text-(--text-muted)">
													Ceiling %
												</th>
												<th className="w-10 px-2 py-2" />
											</tr>
										</thead>
										<tbody>
											{groupedByBand.map(({ band, label, rows }) => (
												<BandGroup
													key={band}
													label={label}
													rows={rows}
													expanded={expandedBands[band] ?? true}
													onToggle={() => toggleBand(band)}
													isEditable={isEditable}
													updateCapacityRow={updateCapacityRow}
													resetRowToTemplate={resetRowToTemplate}
												/>
											))}
										</tbody>
									</table>
								</div>
							</TabsContent>
						</Tabs>
					</div>
				</TooltipProvider>

				<SheetFooter className="justify-between">
					<p className="text-(--text-sm) text-(--text-muted)">
						{!isValid
							? 'Resolve invalid rule or capacity values before saving.'
							: hasChanges
								? 'Saving will mark enrollment-dependent calculations stale until recalculated.'
								: 'No unsaved changes.'}
					</p>
					<div className="flex items-center gap-2">
						<Button type="button" variant="ghost" onClick={() => setOpen(false)}>
							Close
						</Button>
						<Button
							type="button"
							onClick={handleSave}
							disabled={!isEditable || !hasChanges || !isValid || putEnrollmentSettings.isPending}
						>
							{putEnrollmentSettings.isPending ? 'Saving...' : 'Save settings'}
						</Button>
					</div>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}

function BandGroup({
	label,
	rows,
	expanded,
	onToggle,
	isEditable,
	updateCapacityRow,
	resetRowToTemplate,
}: {
	label: string;
	rows: EnrollmentCapacityByGradeSetting[];
	expanded: boolean;
	onToggle: () => void;
	isEditable: boolean;
	updateCapacityRow: (
		gradeLevel: string,
		field: keyof Pick<
			EnrollmentCapacityByGradeSetting,
			'maxClassSize' | 'plancherPct' | 'ciblePct' | 'plafondPct'
		>,
		value: number
	) => void;
	resetRowToTemplate: (gradeLevel: string) => void;
}) {
	if (rows.length === 0) {
		return null;
	}

	const Icon = expanded ? ChevronDown : ChevronRight;

	return (
		<>
			<tr className="border-t border-(--workspace-border) bg-(--workspace-bg-subtle)">
				<td colSpan={6} className="px-3 py-2">
					<button
						type="button"
						onClick={onToggle}
						aria-expanded={expanded}
						className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left transition-colors hover:bg-(--workspace-bg-card) focus:outline-none focus:ring-2 focus:ring-(--accent-400)"
					>
						<Icon className="h-4 w-4 text-(--text-muted)" />
						<span className="text-(--text-sm) font-semibold text-(--text-primary)">{label}</span>
						<span className="rounded-full bg-(--workspace-border) px-2 py-0.5 text-(--text-xs) font-medium text-(--text-muted)">
							{rows.length}
						</span>
					</button>
				</td>
			</tr>
			{expanded &&
				rows.map((row) => {
					const differs = rowDiffersFromTemplate(row);
					return (
						<tr key={row.gradeLevel} className="border-t border-(--workspace-border)">
							<td className="px-3 py-2">
								<div className="flex items-center gap-2">
									<span className="font-medium text-(--text-primary)">{row.gradeName}</span>
									{differs && (
										<Tooltip>
											<TooltipTrigger asChild>
												<span
													className="inline-block h-2 w-2 rounded-full bg-(--accent-500)"
													aria-label="Modified from template"
												/>
											</TooltipTrigger>
											<TooltipContent side="right">
												<p>
													Template: Max {row.templateMaxClassSize}, Floor{' '}
													{formatPercentLabel(row.templatePlancherPct)}, Target{' '}
													{formatPercentLabel(row.templateCiblePct)}, Ceiling{' '}
													{formatPercentLabel(row.templatePlafondPct)}
												</p>
											</TooltipContent>
										</Tooltip>
									)}
								</div>
							</td>
							<td className="px-3 py-2">
								<Input
									id={`${row.gradeLevel}-maxClassSize`}
									aria-label={`${row.gradeName} max class size`}
									type="number"
									min={1}
									max={50}
									step={1}
									value={row.maxClassSize}
									onChange={(event) =>
										updateCapacityRow(row.gradeLevel, 'maxClassSize', Number(event.target.value))
									}
									disabled={!isEditable}
									className={fieldInputClass}
								/>
							</td>
							<td className="px-3 py-2">
								<Input
									id={`${row.gradeLevel}-plancherPct`}
									aria-label={`${row.gradeName} floor percentage`}
									type="number"
									min={0}
									max={1}
									step={0.01}
									value={row.plancherPct}
									onChange={(event) =>
										updateCapacityRow(row.gradeLevel, 'plancherPct', Number(event.target.value))
									}
									disabled={!isEditable}
									className={fieldInputClass}
								/>
							</td>
							<td className="px-3 py-2">
								<Input
									id={`${row.gradeLevel}-ciblePct`}
									aria-label={`${row.gradeName} target percentage`}
									type="number"
									min={0}
									max={1}
									step={0.01}
									value={row.ciblePct}
									onChange={(event) =>
										updateCapacityRow(row.gradeLevel, 'ciblePct', Number(event.target.value))
									}
									disabled={!isEditable}
									className={fieldInputClass}
								/>
							</td>
							<td className="px-3 py-2">
								<Input
									id={`${row.gradeLevel}-plafondPct`}
									aria-label={`${row.gradeName} ceiling percentage`}
									type="number"
									min={0}
									max={1.5}
									step={0.01}
									value={row.plafondPct}
									onChange={(event) =>
										updateCapacityRow(row.gradeLevel, 'plafondPct', Number(event.target.value))
									}
									disabled={!isEditable}
									className={fieldInputClass}
								/>
							</td>
							<td className="px-2 py-2 text-center">
								{differs && (
									<Tooltip>
										<TooltipTrigger asChild>
											<button
												type="button"
												className={cn(
													'inline-flex h-7 w-7 items-center justify-center rounded-md',
													'text-(--text-muted) hover:bg-(--workspace-bg-subtle) hover:text-(--text-primary)',
													'transition-colors duration-(--duration-fast)',
													'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent-500)'
												)}
												onClick={() => resetRowToTemplate(row.gradeLevel)}
												disabled={!isEditable}
												aria-label={`Reset ${row.gradeName} to template`}
											>
												<Undo2 className="h-4 w-4" />
											</button>
										</TooltipTrigger>
										<TooltipContent>Reset to template</TooltipContent>
									</Tooltip>
								)}
							</td>
						</tr>
					);
				})}
		</>
	);
}
