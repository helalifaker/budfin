import {
	startTransition,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ChangeEvent,
	type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, ChevronRight, FileSpreadsheet, Sparkles, Upload, X } from 'lucide-react';
import type { CohortParameterEntry, GradeCode, NationalityType } from '@budfin/types';
import { Button } from '../ui/button';
import { cn } from '../../lib/cn';
import {
	useApplyEnrollmentSetup,
	useEnrollmentSetupBaseline,
	useHeadcount,
	useValidateEnrollmentSetupImport,
} from '../../hooks/use-enrollment';
import { useCohortParameters } from '../../hooks/use-cohort-parameters';
import { useGradeLevels } from '../../hooks/use-grade-levels';
import { useNationalityBreakdown } from '../../hooks/use-nationality-breakdown';
import {
	buildAy1HeadcountMap,
	buildCapacityPreviewRows,
	buildCohortProjectionRows,
	buildNationalityPreviewRows,
	getPsAy2Headcount,
	type EnrollmentEditability,
} from '../../lib/enrollment-workspace';

type WizardStepId = 'baseline' | 'import' | 'review' | 'cohort' | 'preview';

type WizardRow = {
	gradeLevel: string;
	gradeName: string;
	band: string;
	displayOrder: number;
	baselineHeadcount: number;
	headcount: number;
};

type RecommendedCohortDefault = {
	suggestedRetention: number;
	suggestedLaterals: number;
	confidence: 'high' | 'medium' | 'low';
	observationCount: number;
	sourceFiscalYear: number | null;
	rolloverRatio: number | null;
	rule: 'direct-entry' | 'fixed-97-growth' | 'historical-rollover' | 'fallback-default';
};

type EnrollmentSetupWizardProps = {
	open: boolean;
	versionId: number;
	versionName?: string | null;
	editability: EnrollmentEditability;
	onClose: () => void;
};

function normalizeWholeNumber(value: number) {
	if (!Number.isFinite(value)) {
		return 0;
	}

	return Math.max(0, Math.round(value));
}

function buildInitialWorkingRows(
	baselineRows: Array<
		Pick<WizardRow, 'gradeLevel' | 'gradeName' | 'band' | 'displayOrder' | 'baselineHeadcount'>
	>,
	headcountEntries: Array<{ gradeLevel: string; academicPeriod: string; headcount: number }>
) {
	const persistedAy1 = new Map<string, number>(
		headcountEntries
			.filter((entry) => entry.academicPeriod === 'AY1')
			.map((entry) => [entry.gradeLevel, entry.headcount])
	);

	return baselineRows.map((entry) => ({
		...entry,
		headcount: persistedAy1.get(entry.gradeLevel) ?? entry.baselineHeadcount,
	}));
}

const WIZARD_STEPS: Array<{ id: WizardStepId; title: string; description: string }> = [
	{
		id: 'baseline',
		title: 'Baseline Source',
		description: 'Review the prior-year actual AY2 baseline before making changes.',
	},
	{
		id: 'import',
		title: 'Import Compare',
		description: 'Validate an optional workbook and compare it against the baseline.',
	},
	{
		id: 'review',
		title: 'AY1 Review',
		description: 'Resolve the final AY1 headcount dataset before anything is committed.',
	},
	{
		id: 'cohort',
		title: 'Retention & Laterals',
		description: 'Confirm progression assumptions with recommended defaults and manual control.',
	},
	{
		id: 'preview',
		title: 'Preview & Validate',
		description: 'Inspect AY2, capacity, and nationality projections before applying.',
	},
];

const NATIONALITY_LABELS: Record<NationalityType, string> = {
	Francais: 'Francais',
	Nationaux: 'Nationaux',
	Autres: 'Autres',
};

function toBandGroups(rows: WizardRow[]) {
	const groups = new Map<string, WizardRow[]>();
	for (const row of rows) {
		const entries = groups.get(row.band) ?? [];
		entries.push(row);
		groups.set(row.band, entries);
	}
	return [...groups.entries()];
}

function formatDelta(value: number | null) {
	if (value === null) {
		return '--';
	}
	return `${value > 0 ? '+' : ''}${value}`;
}

function MetricCard({
	label,
	value,
	description,
}: {
	label: string;
	value: string;
	description: string;
}) {
	return (
		<div
			className={cn(
				'rounded-xl border border-(--workspace-border)',
				'bg-(--workspace-bg-card) px-4 py-3 shadow-(--shadow-xs)'
			)}
		>
			<p className="text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
				{label}
			</p>
			<p className="mt-2 text-(--text-xl) font-semibold text-(--text-primary)">{value}</p>
			<p className="mt-1 text-(--text-xs) text-(--text-muted)">{description}</p>
		</div>
	);
}

function Stepper({
	activeStep,
	onStepChange,
	canAccessStep,
}: {
	activeStep: number;
	onStepChange: (step: number) => void;
	canAccessStep: (step: number) => boolean;
}) {
	return (
		<div className="flex flex-wrap gap-2">
			{WIZARD_STEPS.map((step, index) => {
				const isActive = index === activeStep;
				const isComplete = index < activeStep;
				const isDisabled = !canAccessStep(index);
				return (
					<button
						key={step.id}
						type="button"
						onClick={() => onStepChange(index)}
						disabled={isDisabled}
						className={cn(
							'group flex min-w-[180px] flex-1 items-start gap-3 rounded-xl border px-3 py-3 text-left',
							'transition-all duration-(--duration-fast)',
							isActive
								? 'border-(--accent-300) bg-(--accent-50) shadow-(--shadow-xs)'
								: 'border-(--workspace-border) bg-(--workspace-bg-card)',
							!isActive &&
								!isDisabled &&
								'hover:border-(--accent-200) hover:bg-(--workspace-bg-subtle)',
							isDisabled && 'cursor-not-allowed opacity-55'
						)}
					>
						<span
							className={cn(
								'mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-(--text-xs) font-semibold',
								isComplete &&
									'border-(--color-success) bg-(--color-success-bg) text-(--color-success)',
								isActive && 'border-(--accent-400) bg-(--workspace-bg-card) text-(--accent-700)',
								!isActive &&
									!isComplete &&
									'border-(--workspace-border-strong) bg-(--workspace-bg-subtle) text-(--text-muted)'
							)}
						>
							{isComplete ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : index + 1}
						</span>
						<span className="min-w-0">
							<span className="block text-(--text-sm) font-semibold text-(--text-primary)">
								{step.title}
							</span>
							<span className="mt-1 block text-(--text-xs) text-(--text-muted)">
								{step.description}
							</span>
						</span>
					</button>
				);
			})}
		</div>
	);
}

function SectionCard({
	title,
	description,
	children,
}: {
	title: string;
	description: string;
	children: ReactNode;
}) {
	return (
		<section
			className={cn(
				'rounded-2xl border border-(--workspace-border)',
				'bg-(--workspace-bg-card) shadow-(--shadow-card)'
			)}
		>
			<div className="border-b border-(--workspace-border) px-6 py-4">
				<h3 className="text-(--text-lg) font-semibold text-(--text-primary)">{title}</h3>
				<p className="mt-1 text-(--text-sm) text-(--text-muted)">{description}</p>
			</div>
			<div className="px-6 py-5">{children}</div>
		</section>
	);
}

function GroupedHeadcountTable({
	rows,
	onChange,
	readOnly,
	showBaselineDelta = false,
	showImportedDelta,
}: {
	rows: WizardRow[];
	onChange?: (gradeLevel: string, value: number) => void;
	readOnly: boolean;
	showBaselineDelta?: boolean;
	showImportedDelta?: Map<string, number | null>;
}) {
	const columnCount = 3 + Number(showBaselineDelta) + Number(Boolean(showImportedDelta));

	return (
		<div className="overflow-hidden rounded-xl border border-(--workspace-border)">
			<table className="w-full text-left text-(--text-sm)">
				<thead className="bg-(--grid-header-bg)">
					<tr>
						<th className="px-4 py-3 text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
							Grade
						</th>
						<th className="px-4 py-3 text-right text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
							Baseline
						</th>
						<th className="px-4 py-3 text-right text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
							Working AY1
						</th>
						{showBaselineDelta && (
							<th className="px-4 py-3 text-right text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
								Delta
							</th>
						)}
						{showImportedDelta && (
							<th className="px-4 py-3 text-right text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
								Import Delta
							</th>
						)}
					</tr>
				</thead>
				<tbody>
					{toBandGroups(rows).map(([band, bandRows]) => {
						const bandBaseline = bandRows.reduce((sum, row) => sum + row.baselineHeadcount, 0);
						const bandWorking = bandRows.reduce((sum, row) => sum + row.headcount, 0);

						return [
							<tr key={`${band}-header`} className="border-t border-(--workspace-border)">
								<td
									colSpan={columnCount}
									className="px-4 py-2 text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)"
								>
									{band}
								</td>
							</tr>,
							...bandRows.map((row) => (
								<tr
									key={row.gradeLevel}
									className="border-t border-(--workspace-border) bg-(--workspace-bg-card)"
								>
									<td className="px-4 py-3 font-medium text-(--text-primary)">{row.gradeName}</td>
									<td className="px-4 py-3 text-right font-[family-name:var(--font-mono)] tabular-nums text-(--text-secondary)">
										{row.baselineHeadcount}
									</td>
									<td className="px-4 py-2 text-right">
										{readOnly ? (
											<span className="font-[family-name:var(--font-mono)] tabular-nums text-(--text-primary)">
												{row.headcount}
											</span>
										) : (
											<input
												type="number"
												min={0}
												value={row.headcount}
												onChange={(event) => onChange?.(row.gradeLevel, Number(event.target.value))}
												className={cn(
													'w-24 rounded-md border border-(--workspace-border) bg-(--cell-editable-bg) px-3 py-1.5 text-right',
													'font-[family-name:var(--font-mono)] tabular-nums text-(--text-primary)',
													'focus:outline-none focus:ring-2 focus:ring-(--accent-400)'
												)}
											/>
										)}
									</td>
									{showBaselineDelta && (
										<td
											className={cn(
												'px-4 py-3 text-right font-[family-name:var(--font-mono)] tabular-nums',
												row.headcount > row.baselineHeadcount && 'text-(--color-success)',
												row.headcount < row.baselineHeadcount && 'text-(--color-error)',
												row.headcount === row.baselineHeadcount && 'text-(--text-muted)'
											)}
										>
											{formatDelta(row.headcount - row.baselineHeadcount)}
										</td>
									)}
									{showImportedDelta && (
										<td
											className={cn(
												'px-4 py-3 text-right font-[family-name:var(--font-mono)] tabular-nums',
												(showImportedDelta.get(row.gradeLevel) ?? 0) > 0 &&
													'text-(--color-success)',
												(showImportedDelta.get(row.gradeLevel) ?? 0) < 0 && 'text-(--color-error)',
												(showImportedDelta.get(row.gradeLevel) ?? null) === null &&
													'text-(--text-muted)'
											)}
										>
											{formatDelta(showImportedDelta.get(row.gradeLevel) ?? null)}
										</td>
									)}
								</tr>
							)),
							<tr
								key={`${band}-subtotal`}
								className="border-t border-(--workspace-border) bg-(--workspace-bg-subtle)"
							>
								<td className="px-4 py-2 text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-secondary)">
									{band} subtotal
								</td>
								<td className="px-4 py-2 text-right font-[family-name:var(--font-mono)] tabular-nums text-(--text-secondary)">
									{bandBaseline}
								</td>
								<td className="px-4 py-2 text-right font-[family-name:var(--font-mono)] tabular-nums text-(--text-primary)">
									{bandWorking}
								</td>
								{showBaselineDelta && (
									<td className="px-4 py-2 text-right font-[family-name:var(--font-mono)] tabular-nums text-(--text-secondary)">
										{formatDelta(bandWorking - bandBaseline)}
									</td>
								)}
								{showImportedDelta && <td className="px-4 py-2" />}
							</tr>,
						];
					})}
					<tr className="border-t border-(--workspace-border-strong) bg-(--grid-footer-bg)">
						<td className="px-4 py-3 text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-secondary)">
							Grand total
						</td>
						<td className="px-4 py-3 text-right font-[family-name:var(--font-mono)] tabular-nums text-(--text-secondary)">
							{rows.reduce((sum, row) => sum + row.baselineHeadcount, 0)}
						</td>
						<td className="px-4 py-3 text-right font-[family-name:var(--font-mono)] tabular-nums text-(--text-primary)">
							{rows.reduce((sum, row) => sum + row.headcount, 0)}
						</td>
						{showBaselineDelta && (
							<td className="px-4 py-3 text-right font-[family-name:var(--font-mono)] tabular-nums text-(--text-secondary)">
								{formatDelta(
									rows.reduce((sum, row) => sum + row.headcount - row.baselineHeadcount, 0)
								)}
							</td>
						)}
						{showImportedDelta && <td className="px-4 py-3" />}
					</tr>
				</tbody>
			</table>
		</div>
	);
}

export function EnrollmentSetupWizard({
	open,
	versionId,
	versionName,
	editability,
	onClose,
}: EnrollmentSetupWizardProps) {
	const { data: baselineData } = useEnrollmentSetupBaseline(versionId);
	const { data: headcountData } = useHeadcount(versionId);
	const { data: cohortData } = useCohortParameters(versionId);
	const { data: gradeLevelData } = useGradeLevels();
	const { data: ay1NationalityData } = useNationalityBreakdown(versionId, 'AY1');
	const validateImport = useValidateEnrollmentSetupImport(versionId);
	const applySetup = useApplyEnrollmentSetup(versionId);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const initializedVersionRef = useRef<number | null>(null);

	const isEditable = editability === 'editable';
	const [activeStep, setActiveStep] = useState(0);
	const [baselineWorkingRows, setBaselineWorkingRows] = useState<WizardRow[]>([]);
	const [workingRows, setWorkingRows] = useState<WizardRow[]>([]);
	const [cohortRows, setCohortRows] = useState<CohortParameterEntry[]>([]);
	const [psAy2Headcount, setPsAy2Headcount] = useState(0);
	const [importMode, setImportMode] = useState<'baseline' | 'imported'>('baseline');

	useEffect(() => {
		if (!open) {
			initializedVersionRef.current = null;
			validateImport.reset();
			return;
		}

		if (
			initializedVersionRef.current === versionId ||
			!baselineData?.entries ||
			!gradeLevelData?.gradeLevels ||
			!cohortData?.entries ||
			!headcountData?.entries
		) {
			return;
		}

		const frameId = window.requestAnimationFrame(() => {
			const initialWorkingRows = buildInitialWorkingRows(
				baselineData.entries,
				headcountData.entries
			);
			setBaselineWorkingRows(initialWorkingRows);
			setWorkingRows(initialWorkingRows);
			setCohortRows(
				cohortData.entries
					.map((entry) => ({ ...entry }))
					.sort(
						(left, right) =>
							(gradeLevelData.gradeLevels.find((grade) => grade.gradeCode === left.gradeLevel)
								?.displayOrder ?? 0) -
							(gradeLevelData.gradeLevels.find((grade) => grade.gradeCode === right.gradeLevel)
								?.displayOrder ?? 0)
					)
			);

			const ay1Map = buildAy1HeadcountMap(headcountData.entries);
			setPsAy2Headcount(getPsAy2Headcount(headcountData.entries, ay1Map));
			setImportMode('baseline');
			setActiveStep(0);
			initializedVersionRef.current = versionId;
		});

		return () => window.cancelAnimationFrame(frameId);
	}, [open, versionId, baselineData, gradeLevelData, cohortData, headcountData, validateImport]);

	useEffect(() => {
		if (!open) {
			return;
		}

		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				onClose();
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => {
			document.body.style.overflow = previousOverflow;
			window.removeEventListener('keydown', handleKeyDown);
		};
	}, [open, onClose]);

	const recommendedMap = useMemo(
		() =>
			new Map(
				(cohortData?.entries ?? []).map((entry) => [
					entry.gradeLevel,
					{
						suggestedRetention: entry.recommendedRetentionRate ?? entry.retentionRate,
						suggestedLaterals: entry.recommendedLateralEntryCount ?? entry.lateralEntryCount,
						confidence: entry.recommendationConfidence ?? 'low',
						observationCount: entry.recommendationObservationCount ?? 0,
						sourceFiscalYear: entry.recommendationSourceFiscalYear ?? null,
						rolloverRatio: entry.recommendationRolloverRatio ?? null,
						rule: entry.recommendationRule ?? 'fallback-default',
					} satisfies RecommendedCohortDefault,
				])
			),
		[cohortData?.entries]
	);

	const ay1Map = useMemo(
		() => new Map(workingRows.map((row) => [row.gradeLevel as GradeCode, row.headcount] as const)),
		[workingRows]
	);

	const projectionRows = useMemo(() => {
		if (!gradeLevelData?.gradeLevels.length) {
			return [];
		}
		return buildCohortProjectionRows({
			gradeLevels: gradeLevelData.gradeLevels,
			ay1HeadcountMap: ay1Map,
			cohortEntries: cohortRows,
			psAy2Headcount,
		});
	}, [gradeLevelData, ay1Map, cohortRows, psAy2Headcount]);

	const capacityRows = useMemo(() => {
		if (!gradeLevelData?.gradeLevels.length) {
			return [];
		}
		return buildCapacityPreviewRows({
			gradeLevels: gradeLevelData.gradeLevels,
			ay1HeadcountMap: ay1Map,
			projectionRows,
		});
	}, [gradeLevelData, ay1Map, projectionRows]);

	const nationalityPreviewRows = useMemo(
		() =>
			buildNationalityPreviewRows({
				projectionRows,
				ay1NationalityEntries: ay1NationalityData?.entries ?? [],
				cohortEntries: cohortRows,
			}),
		[projectionRows, ay1NationalityData, cohortRows]
	);

	const importedDeltaMap = useMemo(() => {
		if (!validateImport.data?.preview) {
			return null;
		}
		return new Map(validateImport.data.preview.map((row) => [row.gradeLevel, row.delta]));
	}, [validateImport.data]);
	const hasImportableRows = useMemo(
		() => validateImport.data?.preview.some((row) => row.importedHeadcount !== null) ?? false,
		[validateImport.data]
	);
	const isWizardInitialized =
		baselineWorkingRows.length > 0 && workingRows.length > 0 && cohortRows.length > 0;
	const previewDependenciesReady = ay1NationalityData !== undefined;

	const currentStep = WIZARD_STEPS[activeStep]!;
	const canMoveNext = activeStep < WIZARD_STEPS.length - 1;
	const canMoveBack = activeStep > 0;
	const reviewStepValid =
		workingRows.length > 0 &&
		workingRows.every(
			(row) =>
				Number.isFinite(row.headcount) && Number.isInteger(row.headcount) && row.headcount >= 0
		);
	const psAy2StepValid =
		Number.isFinite(psAy2Headcount) && Number.isInteger(psAy2Headcount) && psAy2Headcount >= 0;
	const cohortStepValid =
		cohortRows.some((row) => row.gradeLevel !== 'PS') &&
		cohortRows.every((row) => {
			if (row.gradeLevel === 'PS') {
				return true;
			}

			return (
				Number.isFinite(row.retentionRate) &&
				row.retentionRate >= 0 &&
				row.retentionRate <= 1 &&
				Number.isFinite(row.lateralEntryCount) &&
				Number.isInteger(row.lateralEntryCount) &&
				row.lateralEntryCount >= 0
			);
		});
	const canAccessStep = (step: number) => {
		if (step <= activeStep) {
			return true;
		}

		if (!isWizardInitialized) {
			return false;
		}

		if (step <= 2) {
			return true;
		}

		if (step === 3) {
			return reviewStepValid && psAy2StepValid;
		}

		if (step === 4) {
			return reviewStepValid && psAy2StepValid && cohortStepValid && previewDependenciesReady;
		}

		return false;
	};
	const isCurrentStepValid =
		activeStep <= 1
			? isWizardInitialized
			: activeStep === 2
				? reviewStepValid && psAy2StepValid
				: activeStep === 3
					? cohortStepValid && previewDependenciesReady
					: previewDependenciesReady;
	const previewSummary = useMemo(
		() => ({
			ay1Total: workingRows.reduce((sum, row) => sum + row.headcount, 0),
			ay2Total: projectionRows.reduce((sum, row) => sum + row.ay2Headcount, 0),
			alertCount: capacityRows.filter(
				(row) => row.academicPeriod === 'AY2' && row.alert && row.alert !== 'OK'
			).length,
		}),
		[workingRows, projectionRows, capacityRows]
	);

	const handleStepChange = (step: number) => {
		if (!canAccessStep(step)) {
			return;
		}

		startTransition(() => {
			setActiveStep(step);
		});
	};

	const handleWorkingHeadcountChange = (gradeLevel: string, value: number) => {
		setWorkingRows((currentRows) =>
			currentRows.map((row) =>
				row.gradeLevel === gradeLevel
					? {
							...row,
							headcount: normalizeWholeNumber(value),
						}
					: row
			)
		);
	};

	const handleCohortChange = (
		gradeLevel: string,
		field: keyof Pick<CohortParameterEntry, 'retentionRate' | 'lateralEntryCount'>,
		value: number
	) => {
		setCohortRows((currentRows) =>
			currentRows.map((row) =>
				row.gradeLevel === gradeLevel
					? {
							...row,
							[field]: field === 'retentionRate' ? value : normalizeWholeNumber(value),
						}
					: row
			)
		);
	};

	const applyRecommendedDefaults = () => {
		setCohortRows((currentRows) =>
			currentRows.map((row) => {
				const suggested = recommendedMap.get(row.gradeLevel);
				if (!suggested || row.gradeLevel === 'PS') {
					return row;
				}

				return {
					...row,
					retentionRate: suggested.suggestedRetention,
					lateralEntryCount: suggested.suggestedLaterals,
				};
			})
		);
	};

	const applyImportedDataset = () => {
		if (!validateImport.data?.preview || !hasImportableRows) {
			return;
		}

		setWorkingRows((currentRows) =>
			currentRows.map((row) => {
				const importedRow = validateImport.data?.preview.find(
					(previewRow) => previewRow.gradeLevel === row.gradeLevel
				);
				return {
					...row,
					headcount: importedRow?.importedHeadcount ?? row.headcount,
				};
			})
		);
		setImportMode('imported');
	};

	const handleImportFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) {
			return;
		}

		await validateImport.mutateAsync({
			file,
			baselineEntries: workingRows.map((row) => ({
				gradeLevel: row.gradeLevel,
				headcount: row.baselineHeadcount,
			})),
		});
		event.target.value = '';
	};

	const handleApply = async () => {
		if (!isWizardInitialized || !reviewStepValid || !psAy2StepValid || !cohortStepValid) {
			return;
		}

		await applySetup.mutateAsync({
			ay1Entries: workingRows.map((row) => ({
				gradeLevel: row.gradeLevel,
				headcount: normalizeWholeNumber(row.headcount),
			})),
			cohortEntries: cohortRows.map((row) => ({
				...row,
				lateralEntryCount: normalizeWholeNumber(row.lateralEntryCount),
			})),
			psAy2Headcount: normalizeWholeNumber(psAy2Headcount),
		});
		onClose();
	};

	if (!open) {
		return null;
	}

	if (typeof document === 'undefined') {
		return null;
	}

	return createPortal(
		<div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain px-4 py-6 sm:px-6">
			<div
				className="absolute inset-0 backdrop-blur-[2px]"
				style={{
					backgroundColor: 'color-mix(in srgb, var(--text-primary) 20%, transparent)',
				}}
				onClick={onClose}
				aria-hidden="true"
			/>
			<div className="relative z-10 flex min-h-full items-start justify-center lg:items-center">
				<div
					role="dialog"
					aria-modal="true"
					aria-label="Enrollment setup wizard"
					className={cn(
						'relative my-auto flex max-h-[min(920px,calc(100vh-3rem))] w-[min(1400px,96vw)] flex-col overflow-hidden rounded-[20px]',
						'border border-(--workspace-border) bg-(--workspace-bg) shadow-(--shadow-panel)'
					)}
				>
					<header className="sticky top-0 z-[1] border-b border-(--workspace-border) bg-(--workspace-bg-card) px-6 py-5">
						<div className="flex items-start justify-between gap-4">
							<div className="space-y-1">
								<p className="text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--accent-700)">
									Enrollment setup
								</p>
								<h2 className="text-(--text-2xl) font-semibold font-[family-name:var(--font-display)] text-(--text-primary)">
									{versionName ? `${versionName} setup` : 'Guided enrollment setup'}
								</h2>
								<p className="text-(--text-sm) text-(--text-muted)">{currentStep.description}</p>
							</div>
							<button
								type="button"
								onClick={onClose}
								className={cn(
									'rounded-md p-2 text-(--text-muted)',
									'hover:bg-(--workspace-bg-subtle) hover:text-(--text-primary)',
									'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent-400)',
									'transition-colors duration-(--duration-fast)'
								)}
								aria-label="Close wizard"
							>
								<X className="h-5 w-5" />
							</button>
						</div>
						<div className="mt-5">
							<Stepper
								activeStep={activeStep}
								onStepChange={handleStepChange}
								canAccessStep={canAccessStep}
							/>
						</div>
					</header>

					<div className="flex-1 overflow-y-auto overscroll-contain px-6 py-5">
						<div className="space-y-5">
							{!isWizardInitialized && (
								<SectionCard
									title="Loading setup data"
									description="Gathering the baseline, saved AY1 rows, and cohort assumptions for this version."
								>
									<p className="text-(--text-sm) text-(--text-muted)">
										The wizard will unlock as soon as the current version data is ready.
									</p>
								</SectionCard>
							)}

							{isWizardInitialized && activeStep === 0 && (
								<>
									<div className="grid gap-4 md:grid-cols-3">
										<MetricCard
											label="Source"
											value={
												baselineData?.available ? 'Prior-year Actual AY2' : 'No prior baseline'
											}
											description={
												baselineData?.sourceVersion
													? `${baselineData.sourceVersion.name} · FY${baselineData.sourceVersion.fiscalYear}`
													: 'No qualifying Actual version was found for the prior fiscal year.'
											}
										/>
										<MetricCard
											label="Baseline Total"
											value={String(baselineData?.totals.grandTotal ?? 0)}
											description="This is the reference point before any setup changes are applied."
										/>
										<MetricCard
											label="Working Total"
											value={String(workingRows.reduce((sum, row) => sum + row.headcount, 0))}
											description="Current staged AY1 total for this setup session."
										/>
									</div>
									<SectionCard
										title="Baseline by grade"
										description="The working copy starts from persisted AY1 values when they exist; otherwise it falls back to the prior-year Actual AY2 baseline."
									>
										<GroupedHeadcountTable rows={workingRows} readOnly />
									</SectionCard>
								</>
							)}

							{isWizardInitialized && activeStep === 1 && (
								<>
									<SectionCard
										title="Validate an optional workbook"
										description="Nothing is written to the version in this step. The import is checked, compared, and only becomes the working dataset if you explicitly choose it."
									>
										<div className="flex flex-wrap items-center gap-3">
											<input
												ref={fileInputRef}
												type="file"
												accept=".xlsx,.xls,.csv"
												onChange={handleImportFileChange}
												className="hidden"
											/>
											<Button
												type="button"
												variant="outline"
												onClick={() => fileInputRef.current?.click()}
												disabled={!isEditable || validateImport.isPending}
											>
												<Upload className="h-4 w-4" aria-hidden="true" />
												{validateImport.isPending ? 'Validating...' : 'Upload workbook'}
											</Button>
											<Button
												type="button"
												variant="ghost"
												onClick={() => {
													setWorkingRows(baselineWorkingRows);
													setImportMode('baseline');
												}}
												className={cn(
													importMode === 'baseline' && 'bg-(--accent-50) text-(--accent-700)'
												)}
											>
												Keep baseline
											</Button>
											<Button
												type="button"
												variant="ghost"
												onClick={applyImportedDataset}
												disabled={!hasImportableRows}
												className={cn(
													importMode === 'imported' && 'bg-(--accent-50) text-(--accent-700)'
												)}
											>
												<FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
												Use imported values
											</Button>
										</div>
										{validateImport.data ? (
											<div className="mt-5 space-y-4">
												<div className="grid gap-4 md:grid-cols-2">
													<MetricCard
														label="Validated rows"
														value={String(validateImport.data.validRows)}
														description={`${validateImport.data.totalRows} rows were checked.`}
													/>
													<MetricCard
														label="Import total"
														value={String(validateImport.data.summary.importTotal)}
														description="The imported total remains staged until you choose it."
													/>
												</div>
												<GroupedHeadcountTable
													rows={workingRows}
													readOnly
													{...(importedDeltaMap ? { showImportedDelta: importedDeltaMap } : {})}
												/>
												{validateImport.data.errors.length > 0 && (
													<div className="rounded-xl border border-(--color-warning) bg-(--color-warning-bg) px-4 py-3">
														<p className="text-(--text-sm) font-semibold text-(--color-warning)">
															Validation notes
														</p>
														<ul className="mt-2 space-y-1 text-(--text-xs) text-(--text-secondary)">
															{validateImport.data.errors.map((error) => (
																<li key={`${error.row}-${error.field}`}>
																	Row {error.row}: {error.message}
																</li>
															))}
														</ul>
													</div>
												)}
											</div>
										) : (
											<div className="mt-5 rounded-xl border border-dashed border-(--workspace-border-strong) bg-(--workspace-bg-card) px-6 py-12 text-center">
												<FileSpreadsheet
													className="mx-auto h-10 w-10 text-(--text-muted)"
													aria-hidden="true"
												/>
												<p className="mt-4 text-(--text-sm) font-semibold text-(--text-primary)">
													Upload an AY1 workbook to compare before apply
												</p>
												<p className="mt-2 text-(--text-sm) text-(--text-muted)">
													Supported columns: grade, grade_level, level_code and headcount,
													student_count, ay1_headcount.
												</p>
											</div>
										)}
									</SectionCard>
								</>
							)}

							{isWizardInitialized && activeStep === 2 && (
								<SectionCard
									title="Finalize AY1 headcounts"
									description="This review stays local to the wizard until the final validation step. Use the table below to resolve any grade-level differences."
								>
									<div className="mb-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
										<MetricCard
											label="Working total"
											value={String(workingRows.reduce((sum, row) => sum + row.headcount, 0))}
											description="Current staged AY1 total."
										/>
										<MetricCard
											label="Baseline total"
											value={String(
												workingRows.reduce((sum, row) => sum + row.baselineHeadcount, 0)
											)}
											description="Prior-year Actual AY2 total."
										/>
										<MetricCard
											label="Delta"
											value={formatDelta(
												workingRows.reduce(
													(sum, row) => sum + row.headcount - row.baselineHeadcount,
													0
												)
											)}
											description="Difference between the staged AY1 total and the baseline."
										/>
										<MetricCard
											label="PS AY2"
											value={String(psAy2Headcount)}
											description="Direct entry used for AY2 Petite Section."
										/>
									</div>
									<div className="mb-4 flex items-center justify-between rounded-xl border border-(--workspace-border) bg-(--workspace-bg-subtle) px-4 py-3">
										<div>
											<p className="text-(--text-sm) font-semibold text-(--text-primary)">
												PS direct AY2 entry
											</p>
											<p className="text-(--text-xs) text-(--text-muted)">
												Adjust Petite Section separately when AY2 intake differs from AY1.
											</p>
										</div>
										<input
											type="number"
											min={0}
											step={1}
											inputMode="numeric"
											value={psAy2Headcount}
											onChange={(event) =>
												setPsAy2Headcount(normalizeWholeNumber(Number(event.target.value)))
											}
											disabled={!isEditable}
											className={cn(
												'w-28 rounded-md border border-(--workspace-border) bg-(--cell-editable-bg) px-3 py-1.5 text-right',
												'font-[family-name:var(--font-mono)] tabular-nums text-(--text-primary)',
												'focus:outline-none focus:ring-2 focus:ring-(--accent-400)',
												!isEditable && 'bg-(--cell-readonly-bg)'
											)}
										/>
									</div>
									<GroupedHeadcountTable
										rows={workingRows}
										onChange={handleWorkingHeadcountChange}
										readOnly={!isEditable}
										showBaselineDelta
									/>
								</SectionCard>
							)}

							{isWizardInitialized && activeStep === 3 && (
								<SectionCard
									title="Retention and lateral entries"
									description="These assumptions drive the AY2 projection. Suggested defaults come from the latest completed Actual AY1 to AY2 rollover, with older Actual years used for confidence."
								>
									<div className="mb-4 flex flex-wrap items-center gap-3">
										<Button
											type="button"
											variant="outline"
											onClick={applyRecommendedDefaults}
											disabled={!isEditable}
										>
											<Sparkles className="h-4 w-4" aria-hidden="true" />
											Apply suggested defaults
										</Button>
										<p className="text-(--text-xs) text-(--text-muted)">
											Retention uses prior-grade AY1 with floor rounding. If a historical rollover
											reached 105% or more, the default retention stays at 97% and the excess is
											stored as laterals.
										</p>
									</div>
									<div className="overflow-hidden rounded-xl border border-(--workspace-border)">
										<table className="w-full text-left text-(--text-sm)">
											<thead className="bg-(--grid-header-bg)">
												<tr>
													<th className="px-4 py-3 text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
														Grade
													</th>
													<th className="px-4 py-3 text-right text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
														Retention %
													</th>
													<th className="px-4 py-3 text-right text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
														Laterals
													</th>
													<th className="px-4 py-3 text-right text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
														Suggested
													</th>
													<th className="px-4 py-3 text-right text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
														Confidence
													</th>
												</tr>
											</thead>
											<tbody>
												{cohortRows.map((row) => {
													const suggested = recommendedMap.get(row.gradeLevel);
													const isPS = row.gradeLevel === 'PS';
													return (
														<tr
															key={row.gradeLevel}
															className="border-t border-(--workspace-border)"
														>
															<td className="px-4 py-3 font-medium text-(--text-primary)">
																{row.gradeLevel}
															</td>
															<td className="px-4 py-2 text-right">
																{isPS ? (
																	<span className="text-(--text-muted)">--</span>
																) : (
																	<input
																		type="number"
																		min={0}
																		max={100}
																		value={Math.round(row.retentionRate * 100)}
																		onChange={(event) =>
																			handleCohortChange(
																				row.gradeLevel,
																				'retentionRate',
																				Number(event.target.value) / 100
																			)
																		}
																		disabled={!isEditable}
																		className={cn(
																			'w-24 rounded-md border border-(--workspace-border) bg-(--cell-editable-bg) px-3 py-1.5 text-right',
																			'font-[family-name:var(--font-mono)] tabular-nums text-(--text-primary)',
																			'focus:outline-none focus:ring-2 focus:ring-(--accent-400)',
																			!isEditable && 'bg-(--cell-readonly-bg)'
																		)}
																	/>
																)}
															</td>
															<td className="px-4 py-2 text-right">
																{isPS ? (
																	<span className="text-(--text-muted)">--</span>
																) : (
																	<input
																		type="number"
																		min={0}
																		step={1}
																		inputMode="numeric"
																		value={row.lateralEntryCount}
																		onChange={(event) =>
																			handleCohortChange(
																				row.gradeLevel,
																				'lateralEntryCount',
																				Number(event.target.value)
																			)
																		}
																		disabled={!isEditable}
																		className={cn(
																			'w-24 rounded-md border border-(--workspace-border) bg-(--cell-editable-bg) px-3 py-1.5 text-right',
																			'font-[family-name:var(--font-mono)] tabular-nums text-(--text-primary)',
																			'focus:outline-none focus:ring-2 focus:ring-(--accent-400)',
																			!isEditable && 'bg-(--cell-readonly-bg)'
																		)}
																	/>
																)}
															</td>
															<td className="px-4 py-3 text-right text-(--text-secondary)">
																{suggested && !isPS
																	? `${Math.round(suggested.suggestedRetention * 100)}% · ${suggested.suggestedLaterals}`
																	: '--'}
															</td>
															<td className="px-4 py-3 text-right">
																{suggested && !isPS ? (
																	<span
																		className={cn(
																			'inline-flex rounded-full px-2 py-0.5 text-(--text-xs) font-semibold',
																			suggested.confidence === 'high' &&
																				'bg-(--color-success-bg) text-(--color-success)',
																			suggested.confidence === 'medium' &&
																				'bg-(--color-warning-bg) text-(--color-warning)',
																			suggested.confidence === 'low' &&
																				'bg-(--workspace-bg-subtle) text-(--text-muted)'
																		)}
																	>
																		{suggested.confidence}
																	</span>
																) : (
																	<span className="text-(--text-muted)">--</span>
																)}
															</td>
														</tr>
													);
												})}
											</tbody>
										</table>
									</div>
									<div className="mt-3 rounded-xl border border-(--workspace-border) bg-(--workspace-bg-subtle) px-4 py-3 text-(--text-xs) text-(--text-muted)">
										The recommendation for each grade uses the most recent completed Actual cohort
										rollover that was found. Confidence reflects how many prior Actual years also
										had a usable rollover for that grade.
									</div>
								</SectionCard>
							)}

							{isWizardInitialized && activeStep === 4 && (
								<>
									{!previewDependenciesReady && (
										<div className="rounded-xl border border-(--color-info) bg-(--color-info-bg) px-4 py-3">
											<p className="text-(--text-sm) font-semibold text-(--color-info)">
												Loading nationality preview inputs
											</p>
											<p className="mt-1 text-(--text-sm) text-(--text-secondary)">
												The AY2 nationality estimate will appear once the saved AY1 composition is
												ready.
											</p>
										</div>
									)}
									<div className="grid gap-4 lg:grid-cols-3">
										<MetricCard
											label="AY1 total"
											value={String(previewSummary.ay1Total)}
											description="Staged AY1 dataset before commit."
										/>
										<MetricCard
											label="Projected AY2"
											value={String(previewSummary.ay2Total)}
											description="Computed locally using the backend cohort rules."
										/>
										<MetricCard
											label="Capacity alerts"
											value={String(previewSummary.alertCount)}
											description="AY2 rows flagged as near capacity or under target."
										/>
									</div>
									<SectionCard
										title="AY2 cohort preview"
										description="This preview uses prior-grade AY1, floor retention, and direct PS AY2 entry."
									>
										<div className="overflow-hidden rounded-xl border border-(--workspace-border)">
											<table className="w-full text-left text-(--text-sm)">
												<thead className="bg-(--grid-header-bg)">
													<tr>
														<th className="px-4 py-3 text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
															Grade
														</th>
														<th className="px-4 py-3 text-right text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
															AY1
														</th>
														<th className="px-4 py-3 text-right text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
															Retained
														</th>
														<th className="px-4 py-3 text-right text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
															Laterals
														</th>
														<th className="px-4 py-3 text-right text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
															AY2
														</th>
													</tr>
												</thead>
												<tbody>
													{projectionRows.map((row) => (
														<tr
															key={row.gradeLevel}
															className="border-t border-(--workspace-border)"
														>
															<td className="px-4 py-3 font-medium text-(--text-primary)">
																{row.gradeName}
															</td>
															<td className="px-4 py-3 text-right font-[family-name:var(--font-mono)] tabular-nums">
																{row.ay1Headcount}
															</td>
															<td className="px-4 py-3 text-right font-[family-name:var(--font-mono)] tabular-nums">
																{row.retainedFromPrior}
															</td>
															<td className="px-4 py-3 text-right font-[family-name:var(--font-mono)] tabular-nums">
																{row.isPS ? '--' : row.lateralEntry}
															</td>
															<td className="px-4 py-3 text-right font-[family-name:var(--font-mono)] tabular-nums text-(--text-primary)">
																{row.ay2Headcount}
															</td>
														</tr>
													))}
												</tbody>
											</table>
										</div>
									</SectionCard>
									<div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
										<SectionCard
											title="Capacity preview"
											description="AY2 capacity is shown from the staged setup, not from transient mutation memory."
										>
											<div className="overflow-hidden rounded-xl border border-(--workspace-border)">
												<table className="w-full text-left text-(--text-sm)">
													<thead className="bg-(--grid-header-bg)">
														<tr>
															<th className="px-4 py-3 text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
																Grade
															</th>
															<th className="px-4 py-3 text-right text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
																Sections
															</th>
															<th className="px-4 py-3 text-right text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
																Utilization
															</th>
															<th className="px-4 py-3 text-right text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
																Alert
															</th>
														</tr>
													</thead>
													<tbody>
														{capacityRows
															.filter((row) => row.academicPeriod === 'AY2')
															.map((row) => (
																<tr
																	key={row.gradeLevel}
																	className="border-t border-(--workspace-border)"
																>
																	<td className="px-4 py-3 font-medium text-(--text-primary)">
																		{row.gradeLevel}
																	</td>
																	<td className="px-4 py-3 text-right font-[family-name:var(--font-mono)] tabular-nums">
																		{row.sectionsNeeded}
																	</td>
																	<td className="px-4 py-3 text-right font-[family-name:var(--font-mono)] tabular-nums">
																		{row.utilization.toFixed(1)}%
																	</td>
																	<td className="px-4 py-3 text-right">
																		<span
																			className={cn(
																				'inline-flex rounded-full px-2 py-0.5 text-(--text-xs) font-semibold',
																				row.alert === 'OVER' &&
																					'bg-(--color-error-bg) text-(--color-error)',
																				row.alert === 'NEAR_CAP' &&
																					'bg-(--color-warning-bg) text-(--color-warning)',
																				row.alert === 'OK' &&
																					'bg-(--color-success-bg) text-(--color-success)',
																				row.alert === 'UNDER' &&
																					'bg-(--workspace-bg-subtle) text-(--text-muted)'
																			)}
																		>
																			{row.alert ?? '—'}
																		</span>
																	</td>
																</tr>
															))}
													</tbody>
												</table>
											</div>
										</SectionCard>
										<SectionCard
											title="Nationality estimate"
											description="This is a read-only AY2 estimate based on retained prior-grade composition plus lateral weighting."
										>
											<div className="space-y-3">
												{['Francais', 'Nationaux', 'Autres'].map((nationality) => {
													const total = nationalityPreviewRows
														.filter((row) => row.nationality === nationality)
														.reduce((sum, row) => sum + row.headcount, 0);
													return (
														<div
															key={nationality}
															className="rounded-xl border border-(--workspace-border) bg-(--workspace-bg-subtle) px-4 py-3"
														>
															<p className="text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
																{NATIONALITY_LABELS[nationality as NationalityType]}
															</p>
															<p className="mt-2 text-(--text-xl) font-semibold text-(--text-primary)">
																{total}
															</p>
														</div>
													);
												})}
											</div>
										</SectionCard>
									</div>
								</>
							)}
						</div>
					</div>
					<footer className="sticky bottom-0 flex items-center justify-between gap-4 border-t border-(--workspace-border) bg-(--workspace-bg-card) px-6 py-4">
						<div className="text-(--text-sm) text-(--text-muted)">
							{isEditable
								? 'All setup changes stay staged until Validate and Apply.'
								: 'This version is currently review-only.'}
						</div>
						<div className="flex items-center gap-3">
							<Button type="button" variant="ghost" onClick={onClose}>
								Close
							</Button>
							<Button
								type="button"
								variant="outline"
								onClick={() => handleStepChange(activeStep - 1)}
								disabled={!canMoveBack}
							>
								Back
							</Button>
							{canMoveNext ? (
								<Button
									type="button"
									onClick={() => handleStepChange(activeStep + 1)}
									disabled={!isCurrentStepValid}
								>
									Next
									<ChevronRight className="h-4 w-4" aria-hidden="true" />
								</Button>
							) : (
								<Button
									type="button"
									onClick={handleApply}
									loading={applySetup.isPending}
									disabled={
										!isEditable ||
										!isWizardInitialized ||
										!reviewStepValid ||
										!psAy2StepValid ||
										!cohortStepValid
									}
								>
									Validate and Apply
								</Button>
							)}
						</div>
					</footer>
				</div>
			</div>
		</div>,
		document.body
	);
}
