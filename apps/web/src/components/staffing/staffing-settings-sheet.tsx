import { startTransition, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import Decimal from 'decimal.js';
import { AlertTriangle, ExternalLink } from 'lucide-react';
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
import {
	useStaffingSettings,
	usePutStaffingSettings,
	useServiceProfileOverrides,
	usePutServiceProfileOverrides,
	useCostAssumptions,
	usePutCostAssumptions,
	useLyceeGroupAssumptions,
	usePutLyceeGroupAssumptions,
	useStaffingSummary,
} from '../../hooks/use-staffing';
import type {
	StaffingSettings,
	ServiceProfileOverride,
	CostAssumption,
	LyceeGroupAssumption,
} from '../../hooks/use-staffing';
import { useServiceProfiles, useDhgRules } from '../../hooks/use-master-data';
import type { ServiceProfile, DhgRule } from '../../hooks/use-master-data';
import { useHeadcount } from '../../hooks/use-enrollment';
import { useStaffingSettingsSheetStore } from '../../stores/staffing-settings-store';
import { useWorkspaceContextStore } from '../../stores/workspace-context-store';
import { cn } from '../../lib/cn';

// ── Constants ──────────────────────────────────────────────────────────────

const COST_CATEGORIES = [
	{ key: 'REMPLACEMENTS', label: 'Remplacements' },
	{ key: 'FORMATION', label: 'Formation' },
	{ key: 'RESIDENT_SALAIRES', label: 'Resident Salaires' },
	{ key: 'RESIDENT_LOGEMENT', label: 'Resident Logement' },
	{ key: 'RESIDENT_PENSION', label: 'Resident Pension' },
] as const;

const COST_MODES = [
	{ value: 'FLAT_ANNUAL', label: 'Flat Annual' },
	{ value: 'PERCENT_OF_PAYROLL', label: '% of Payroll' },
	{ value: 'AMOUNT_PER_FTE', label: 'Amount per FTE' },
] as const;

const BAND_ORDER = ['MATERNELLE', 'ELEMENTAIRE', 'COLLEGE', 'LYCEE'] as const;

const monoInputClass = cn(
	'w-full rounded-md border border-(--workspace-border) bg-(--cell-editable-bg) px-3 py-2',
	'text-right font-[family-name:var(--font-mono)] tabular-nums text-(--text-primary)'
);

// ── Types ──────────────────────────────────────────────────────────────────

interface DraftHsaSettings {
	hsaTargetHours: string;
	hsaFirstHourRate: string;
	hsaAdditionalHourRate: string;
	hsaMonths: string;
}

interface DraftOrsOverride {
	serviceProfileId: number;
	effectiveOrs: string;
}

interface DraftCostAssumption {
	category: string;
	mode: string;
	value: string;
}

interface DraftLyceeGroup {
	disciplineCode: string;
	groupCount: string;
	hoursPerGroup: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const GRADE_TO_BAND: Record<string, string> = {
	PS: 'MATERNELLE',
	MS: 'MATERNELLE',
	GS: 'MATERNELLE',
	CP: 'ELEMENTAIRE',
	CE1: 'ELEMENTAIRE',
	CE2: 'ELEMENTAIRE',
	CM1: 'ELEMENTAIRE',
	CM2: 'ELEMENTAIRE',
	'6EME': 'COLLEGE',
	'5EME': 'COLLEGE',
	'4EME': 'COLLEGE',
	'3EME': 'COLLEGE',
	'2NDE': 'LYCEE',
	'1ERE': 'LYCEE',
	TERM: 'LYCEE',
};

function gradeToBand(gradeLevel: string): string {
	return GRADE_TO_BAND[gradeLevel] ?? 'MATERNELLE';
}

function computeMonthlyPreview(mode: string, value: string): string {
	const num = Number(value);
	if (!Number.isFinite(num) || num === 0) return '-';
	if (mode === 'FLAT_ANNUAL') {
		return new Decimal(value).dividedBy(12).toFixed(0);
	}
	if (mode === 'PERCENT_OF_PAYROLL') {
		return `${new Decimal(value).times(100).toFixed(1)}%`;
	}
	return value;
}

// ── Component ──────────────────────────────────────────────────────────────

export function StaffingSettingsSheet({
	versionId,
	isEditable,
}: {
	versionId: number | null;
	isEditable: boolean;
}) {
	const isOpen = useStaffingSettingsSheetStore((s) => s.isOpen);
	const setOpen = useStaffingSettingsSheetStore((s) => s.setOpen);
	const staleModules = useWorkspaceContextStore((s) => s.versionStaleModules);
	const navigate = useNavigate();

	// ── Data hooks ─────────────────────────────────────────────────────────

	const { data: settingsResp, isLoading: settingsLoading } = useStaffingSettings(versionId);
	const putSettings = usePutStaffingSettings(versionId);

	const { data: profilesResp } = useServiceProfiles();
	const { data: overridesResp } = useServiceProfileOverrides(versionId);
	const putOverrides = usePutServiceProfileOverrides(versionId);

	const { data: dhgRulesResp } = useDhgRules();
	const { data: lyceeResp } = useLyceeGroupAssumptions(versionId);
	const putLyceeGroup = usePutLyceeGroupAssumptions(versionId);

	const { data: costResp } = useCostAssumptions(versionId);
	const putCostAssumptions = usePutCostAssumptions(versionId);

	const { data: headcountResp } = useHeadcount(versionId, 'AY2');
	const { data: summaryResp } = useStaffingSummary(versionId);

	// ── Derived data ───────────────────────────────────────────────────────

	const settings = (settingsResp as { data: StaffingSettings } | undefined)?.data ?? null;

	// API returns { profiles: [...] } with name/weeklyServiceHours/hsaEligible
	const profiles: ServiceProfile[] = useMemo(() => {
		const raw = profilesResp as { profiles?: Array<Record<string, unknown>> } | undefined;
		return (raw?.profiles ?? []).map((p) => ({
			id: Number(p.id),
			code: String(p.code),
			label: String(p.name ?? p.code),
			defaultOrs: String(p.weeklyServiceHours ?? '18'),
			isHsaEligible: Boolean(p.hsaEligible),
		}));
	}, [profilesResp]);

	const overrides = useMemo(
		() => (overridesResp as { data: ServiceProfileOverride[] } | undefined)?.data ?? [],
		[overridesResp]
	);

	// API returns { rules: [...] } with gradeLevel/lineType/driverType/hoursPerUnit
	interface ApiDhgRule {
		id: number;
		gradeLevel: string;
		disciplineCode: string;
		lineType: string;
		driverType: string;
		hoursPerUnit: string;
	}
	const dhgRules: DhgRule[] = useMemo(() => {
		const raw = dhgRulesResp as { rules?: ApiDhgRule[] } | undefined;
		return (raw?.rules ?? []).map((r) => ({
			id: r.id,
			band: gradeToBand(r.gradeLevel),
			gradeLevel: r.gradeLevel,
			disciplineCode: r.disciplineCode,
			hoursPerWeekPerSection: r.hoursPerUnit,
			dhgType: r.driverType,
		}));
	}, [dhgRulesResp]);

	const lyceeAssumptions = useMemo(
		() => (lyceeResp as { data: LyceeGroupAssumption[] } | undefined)?.data ?? [],
		[lyceeResp]
	);
	const costAssumptions = useMemo(
		() => (costResp as { data: CostAssumption[] } | undefined)?.data ?? [],
		[costResp]
	);

	// API returns { entries: [{gradeLevel, academicPeriod, headcount, gradeName, ...}] }
	const headcountEntries = useMemo(() => {
		const raw = headcountResp as
			| { entries: Array<{ gradeLevel: string; gradeName?: string; headcount: number }> }
			| undefined;
		return (raw?.entries ?? []).map((e) => ({
			gradeLevel: e.gradeLevel,
			gradeName: e.gradeName ?? e.gradeLevel,
			ay2: e.headcount,
		}));
	}, [headcountResp]);

	const summary = summaryResp as { fte: string; cost: string } | undefined;

	const hasGroupDriverRules = useMemo(
		() => dhgRules.some((r) => r.dhgType === 'GROUPS'),
		[dhgRules]
	);

	const rulesByBand = useMemo(() => {
		const grouped = new Map<string, DhgRule[]>();
		for (const band of BAND_ORDER) {
			grouped.set(
				band,
				dhgRules.filter((r) => r.band === band)
			);
		}
		return grouped;
	}, [dhgRules]);

	const isEnrollmentStale = staleModules.includes('ENROLLMENT');

	// ── Draft state ────────────────────────────────────────────────────────

	const [draftHsa, setDraftHsa] = useState<DraftHsaSettings | null>(null);
	const [draftOrs, setDraftOrs] = useState<DraftOrsOverride[]>([]);
	const [draftCost, setDraftCost] = useState<DraftCostAssumption[]>([]);
	const [draftLycee, setDraftLycee] = useState<DraftLyceeGroup[]>([]);

	useEffect(() => {
		if (!isOpen) return;

		startTransition(() => {
			if (settings) {
				setDraftHsa({
					hsaTargetHours: settings.hsaTargetHours,
					hsaFirstHourRate: settings.hsaFirstHourRate,
					hsaAdditionalHourRate: settings.hsaAdditionalHourRate,
					hsaMonths: String(settings.hsaMonths),
				});
			}

			setDraftOrs(
				overrides.map((o) => ({
					serviceProfileId: o.serviceProfileId,
					effectiveOrs: o.weeklyServiceHours ?? '',
				}))
			);

			setDraftCost(
				costAssumptions.map((c) => ({
					category: c.category,
					mode: c.calculationMode,
					value: c.value,
				}))
			);

			setDraftLycee(
				lyceeAssumptions.map((l) => ({
					disciplineCode: l.disciplineCode,
					groupCount: String(l.groupCount),
					hoursPerGroup: l.hoursPerGroup,
				}))
			);
		});
	}, [isOpen, settings, overrides, costAssumptions, lyceeAssumptions]);

	// ── Change detection ───────────────────────────────────────────────────

	const hsaChanged = useMemo(() => {
		if (!draftHsa || !settings) return false;
		return (
			draftHsa.hsaTargetHours !== settings.hsaTargetHours ||
			draftHsa.hsaFirstHourRate !== settings.hsaFirstHourRate ||
			draftHsa.hsaAdditionalHourRate !== settings.hsaAdditionalHourRate ||
			draftHsa.hsaMonths !== String(settings.hsaMonths)
		);
	}, [draftHsa, settings]);

	const orsChanged = useMemo(() => {
		if (draftOrs.length !== overrides.length) return true;
		return draftOrs.some((d) => {
			const orig = overrides.find((o) => o.serviceProfileId === d.serviceProfileId);
			return !orig || (orig.weeklyServiceHours ?? '') !== d.effectiveOrs;
		});
	}, [draftOrs, overrides]);

	const costChanged = useMemo(() => {
		if (draftCost.length !== costAssumptions.length) return true;
		return draftCost.some((d) => {
			const orig = costAssumptions.find((c) => c.category === d.category);
			return !orig || orig.calculationMode !== d.mode || orig.value !== d.value;
		});
	}, [draftCost, costAssumptions]);

	const lyceeChanged = useMemo(() => {
		if (draftLycee.length !== lyceeAssumptions.length) return true;
		return draftLycee.some((d) => {
			const orig = lyceeAssumptions.find((l) => l.disciplineCode === d.disciplineCode);
			return (
				!orig || String(orig.groupCount) !== d.groupCount || orig.hoursPerGroup !== d.hoursPerGroup
			);
		});
	}, [draftLycee, lyceeAssumptions]);

	const hasChanges = hsaChanged || orsChanged || costChanged || lyceeChanged;

	const isSaving =
		putSettings.isPending ||
		putOverrides.isPending ||
		putCostAssumptions.isPending ||
		putLyceeGroup.isPending;

	// ── Handlers ───────────────────────────────────────────────────────────

	function handleSave() {
		if (!hasChanges || !isEditable) return;

		if (hsaChanged && draftHsa) {
			putSettings.mutate({
				hsaTargetHours: draftHsa.hsaTargetHours,
				hsaFirstHourRate: draftHsa.hsaFirstHourRate,
				hsaAdditionalHourRate: draftHsa.hsaAdditionalHourRate,
				hsaMonths: Number(draftHsa.hsaMonths),
			});
		}

		if (orsChanged) {
			putOverrides.mutate(
				draftOrs.map((d) => ({
					serviceProfileId: d.serviceProfileId,
					weeklyServiceHours: d.effectiveOrs || null,
				}))
			);
		}

		if (costChanged) {
			putCostAssumptions.mutate(
				draftCost.map((d) => ({
					category: d.category,
					calculationMode: d.mode,
					value: d.value,
				}))
			);
		}

		if (lyceeChanged) {
			putLyceeGroup.mutate(
				draftLycee.map((d) => ({
					disciplineCode: d.disciplineCode,
					groupCount: Number(d.groupCount),
					hoursPerGroup: d.hoursPerGroup,
				}))
			);
		}
	}

	function getOrsValue(profileId: number, defaultOrs: string): string {
		const draft = draftOrs.find((d) => d.serviceProfileId === profileId);
		if (draft) return draft.effectiveOrs;
		const override = overrides.find((o) => o.serviceProfileId === profileId);
		return override?.weeklyServiceHours ?? defaultOrs;
	}

	function updateOrs(profileId: number, value: string) {
		setDraftOrs((current) => {
			const exists = current.find((d) => d.serviceProfileId === profileId);
			if (exists) {
				return current.map((d) =>
					d.serviceProfileId === profileId ? { ...d, effectiveOrs: value } : d
				);
			}
			return [...current, { serviceProfileId: profileId, effectiveOrs: value }];
		});
	}

	// ── Render ─────────────────────────────────────────────────────────────

	const hsa = draftHsa ?? {
		hsaTargetHours: settings?.hsaTargetHours ?? '',
		hsaFirstHourRate: settings?.hsaFirstHourRate ?? '',
		hsaAdditionalHourRate: settings?.hsaAdditionalHourRate ?? '',
		hsaMonths: settings ? String(settings.hsaMonths) : '',
	};

	return (
		<Sheet open={isOpen} onOpenChange={setOpen}>
			<SheetContent side="right" className="flex w-[720px] max-w-[92vw] flex-col sm:max-w-[720px]">
				<SheetHeader>
					<SheetTitle>Staffing Settings</SheetTitle>
					<SheetDescription>
						Configure staffing parameters, cost assumptions, and review enrollment linkage.
					</SheetDescription>
				</SheetHeader>

				<div className="flex-1 overflow-y-auto px-6">
					{settingsLoading ? (
						<p className="mt-4 text-(--text-sm) text-(--text-muted)">Loading settings...</p>
					) : (
						<Tabs defaultValue="profiles" className="mt-4">
							<TabsList className="w-full flex-wrap">
								<TabsTrigger value="profiles">Service Profiles</TabsTrigger>
								<TabsTrigger value="curriculum">Curriculum</TabsTrigger>
								{hasGroupDriverRules && <TabsTrigger value="lycee">Lycee Group</TabsTrigger>}
								<TabsTrigger value="cost">Cost Assumptions</TabsTrigger>
								<TabsTrigger value="enrollment">Enrollment</TabsTrigger>
								<TabsTrigger value="reconciliation">Reconciliation</TabsTrigger>
							</TabsList>

							{/* ── Tab 1: Service Profiles & HSA ─────────────────────── */}
							<TabsContent value="profiles" forceMount className="data-[state=inactive]:hidden">
								<section className="rounded-xl border border-(--workspace-border) bg-(--workspace-bg-card) p-4">
									<div className="flex items-start justify-between gap-4">
										<div>
											<p className="text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
												Service Profiles & HSA
											</p>
											<p className="mt-1 text-(--text-sm) text-(--text-secondary)">
												View service profiles and configure HSA parameters.
											</p>
										</div>
										{!isEditable && (
											<span className="rounded-full bg-(--workspace-bg-subtle) px-3 py-1 text-(--text-xs) font-medium text-(--text-muted)">
												Review mode
											</span>
										)}
									</div>

									{/* Profile table */}
									<div className="mt-4 overflow-x-auto rounded-lg border border-(--workspace-border)">
										<table className="w-full text-left text-(--text-sm)">
											<thead className="bg-(--workspace-bg-subtle)">
												<tr>
													<th className="px-3 py-2 text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
														Code
													</th>
													<th className="px-3 py-2 text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
														Name
													</th>
													<th className="px-3 py-2 text-right text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
														ORS
													</th>
													<th className="px-3 py-2 text-center text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
														HSA Eligible
													</th>
												</tr>
											</thead>
											<tbody>
												{profiles.map((p) => (
													<tr key={p.id} className="border-t border-(--workspace-border)">
														<td className="px-3 py-2 font-medium text-(--text-primary)">
															{p.code}
														</td>
														<td className="px-3 py-2 text-(--text-secondary)">{p.label}</td>
														<td className="px-3 py-2">
															<Input
																type="number"
																min={0}
																max={30}
																step={0.5}
																value={getOrsValue(p.id, p.defaultOrs)}
																onChange={(e) => updateOrs(p.id, e.target.value)}
																disabled={!isEditable}
																aria-label={`${p.code} ORS`}
																className={cn(monoInputClass, 'h-8 w-20')}
															/>
														</td>
														<td className="px-3 py-2 text-center text-(--text-secondary)">
															{p.isHsaEligible ? 'Yes' : 'No'}
														</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>

									{/* HSA settings */}
									<div className="mt-4 grid gap-3 md:grid-cols-2">
										<div>
											<label
												htmlFor="hsa-target"
												className="block text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)"
											>
												HSA Target Hours/Week
											</label>
											<Input
												id="hsa-target"
												type="number"
												min={0}
												max={3}
												step={0.5}
												value={hsa.hsaTargetHours}
												onChange={(e) =>
													setDraftHsa((cur) => ({
														...(cur ?? hsa),
														hsaTargetHours: e.target.value,
													}))
												}
												disabled={!isEditable}
												aria-label="HSA Target Hours/Week"
												className={cn(monoInputClass, 'mt-2')}
											/>
										</div>
										<div>
											<label
												htmlFor="hsa-rate-first"
												className="block text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)"
											>
												First Hour Rate (SAR)
											</label>
											<Input
												id="hsa-rate-first"
												type="number"
												min={0}
												step={1}
												value={hsa.hsaFirstHourRate}
												onChange={(e) =>
													setDraftHsa((cur) => ({
														...(cur ?? hsa),
														hsaFirstHourRate: e.target.value,
													}))
												}
												disabled={!isEditable}
												aria-label="First Hour Rate"
												className={cn(monoInputClass, 'mt-2')}
											/>
										</div>
										<div>
											<label
												htmlFor="hsa-rate-additional"
												className="block text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)"
											>
												Additional Hour Rate (SAR)
											</label>
											<Input
												id="hsa-rate-additional"
												type="number"
												min={0}
												step={1}
												value={hsa.hsaAdditionalHourRate}
												onChange={(e) =>
													setDraftHsa((cur) => ({
														...(cur ?? hsa),
														hsaAdditionalHourRate: e.target.value,
													}))
												}
												disabled={!isEditable}
												aria-label="Additional Hour Rate"
												className={cn(monoInputClass, 'mt-2')}
											/>
										</div>
										<div>
											<label
												htmlFor="hsa-months"
												className="block text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)"
											>
												HSA Active Months
											</label>
											<Input
												id="hsa-months"
												type="number"
												min={1}
												max={12}
												step={1}
												value={hsa.hsaMonths}
												onChange={(e) =>
													setDraftHsa((cur) => ({
														...(cur ?? hsa),
														hsaMonths: e.target.value,
													}))
												}
												disabled={!isEditable}
												aria-label="HSA Months"
												className={cn(monoInputClass, 'mt-2')}
											/>
										</div>
									</div>
								</section>
							</TabsContent>

							{/* ── Tab 2: Curriculum / DHG Rules ─────────────────────── */}
							<TabsContent value="curriculum" forceMount className="data-[state=inactive]:hidden">
								<section className="rounded-xl border border-(--workspace-border) bg-(--workspace-bg-card) p-4">
									<div className="flex items-start justify-between gap-4">
										<p className="text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
											DHG Rules (Read-Only)
										</p>
										<a
											href="/master-data/reference"
											className="inline-flex items-center gap-1 text-(--text-sm) text-(--accent-600) hover:underline"
										>
											<ExternalLink className="h-3 w-3" />
											Edit in Master Data
										</a>
									</div>

									{BAND_ORDER.map((band) => {
										const rules = rulesByBand.get(band) ?? [];
										if (rules.length === 0) return null;
										return (
											<div key={band} className="mt-4">
												<p className="text-(--text-sm) font-semibold text-(--text-primary)">
													{band}
												</p>
												<div className="mt-2 overflow-x-auto rounded-lg border border-(--workspace-border)">
													<table className="w-full text-left text-(--text-sm)">
														<thead className="bg-(--workspace-bg-subtle)">
															<tr>
																<th className="px-3 py-2 text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
																	Grade
																</th>
																<th className="px-3 py-2 text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
																	Discipline
																</th>
																<th className="px-3 py-2 text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
																	Type
																</th>
																<th className="px-3 py-2 text-right text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
																	Hours/Unit
																</th>
															</tr>
														</thead>
														<tbody>
															{rules.map((r) => (
																<tr key={r.id} className="border-t border-(--workspace-border)">
																	<td className="px-3 py-2 text-(--text-primary)">
																		{r.gradeLevel}
																	</td>
																	<td className="px-3 py-2 text-(--text-secondary)">
																		{r.disciplineCode}
																	</td>
																	<td className="px-3 py-2 text-(--text-secondary)">{r.dhgType}</td>
																	<td className="px-3 py-2 text-right font-[family-name:var(--font-mono)] tabular-nums text-(--text-primary)">
																		{r.hoursPerWeekPerSection}
																	</td>
																</tr>
															))}
														</tbody>
													</table>
												</div>
											</div>
										);
									})}
								</section>
							</TabsContent>

							{/* ── Tab 3: Lycee Group Assumptions ────────────────────── */}
							{hasGroupDriverRules && (
								<TabsContent value="lycee" forceMount className="data-[state=inactive]:hidden">
									<section className="rounded-xl border border-(--workspace-border) bg-(--workspace-bg-card) p-4">
										<p className="text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
											Lycee Group Assumptions
										</p>
										<p className="mt-1 text-(--text-sm) text-(--text-secondary)">
											Configure group counts and hours for GROUP-driver disciplines.
										</p>

										<div className="mt-4 overflow-x-auto rounded-lg border border-(--workspace-border)">
											<table className="w-full text-left text-(--text-sm)">
												<thead className="bg-(--workspace-bg-subtle)">
													<tr>
														<th className="px-3 py-2 text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
															Discipline
														</th>
														<th className="px-3 py-2 text-right text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
															Group Count
														</th>
														<th className="px-3 py-2 text-right text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
															Hours/Group
														</th>
													</tr>
												</thead>
												<tbody>
													{draftLycee.map((d) => (
														<tr
															key={d.disciplineCode}
															className="border-t border-(--workspace-border)"
														>
															<td className="px-3 py-2 font-medium text-(--text-primary)">
																{d.disciplineCode}
															</td>
															<td className="px-3 py-2">
																<Input
																	type="number"
																	min={1}
																	max={20}
																	step={1}
																	value={d.groupCount}
																	onChange={(e) =>
																		setDraftLycee((cur) =>
																			cur.map((item) =>
																				item.disciplineCode === d.disciplineCode
																					? {
																							...item,
																							groupCount: e.target.value,
																						}
																					: item
																			)
																		)
																	}
																	disabled={!isEditable}
																	aria-label={`${d.disciplineCode} Group Count`}
																	className={cn(monoInputClass, 'h-8 w-20')}
																/>
															</td>
															<td className="px-3 py-2">
																<Input
																	type="number"
																	min={0}
																	max={20}
																	step={0.5}
																	value={d.hoursPerGroup}
																	onChange={(e) =>
																		setDraftLycee((cur) =>
																			cur.map((item) =>
																				item.disciplineCode === d.disciplineCode
																					? {
																							...item,
																							hoursPerGroup: e.target.value,
																						}
																					: item
																			)
																		)
																	}
																	disabled={!isEditable}
																	aria-label={`${d.disciplineCode} Hours/Group`}
																	className={cn(monoInputClass, 'h-8 w-20')}
																/>
															</td>
														</tr>
													))}
												</tbody>
											</table>
										</div>
									</section>
								</TabsContent>
							)}

							{/* ── Tab 4: Additional Cost Assumptions ─────────────────── */}
							<TabsContent value="cost" forceMount className="data-[state=inactive]:hidden">
								<section className="rounded-xl border border-(--workspace-border) bg-(--workspace-bg-card) p-4">
									<p className="text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
										Additional Cost Assumptions
									</p>

									<div className="mt-4 overflow-x-auto rounded-lg border border-(--workspace-border)">
										<table className="w-full text-left text-(--text-sm)">
											<thead className="bg-(--workspace-bg-subtle)">
												<tr>
													<th className="px-3 py-2 text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
														Category
													</th>
													<th className="px-3 py-2 text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
														Mode
													</th>
													<th className="px-3 py-2 text-right text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
														Value
													</th>
													<th className="px-3 py-2 text-right text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
														Monthly
													</th>
												</tr>
											</thead>
											<tbody>
												{COST_CATEGORIES.map((cat) => {
													const draft = draftCost.find((d) => d.category === cat.key);
													const mode = draft?.mode ?? 'FLAT_ANNUAL';
													const value = draft?.value ?? '0';
													return (
														<tr key={cat.key} className="border-t border-(--workspace-border)">
															<td className="px-3 py-2 font-medium text-(--text-primary)">
																{cat.label}
															</td>
															<td className="px-3 py-2">
																<select
																	value={mode}
																	onChange={(e) =>
																		setDraftCost((cur) =>
																			cur.map((d) =>
																				d.category === cat.key
																					? {
																							...d,
																							mode: e.target.value,
																						}
																					: d
																			)
																		)
																	}
																	disabled={!isEditable}
																	aria-label={`${cat.label} mode`}
																	className="rounded-md border border-(--workspace-border) bg-white px-2 py-1 text-(--text-sm)"
																>
																	{COST_MODES.map((m) => (
																		<option key={m.value} value={m.value}>
																			{m.label}
																		</option>
																	))}
																</select>
															</td>
															<td className="px-3 py-2">
																<Input
																	type="number"
																	min={0}
																	step={mode === 'PERCENT_OF_PAYROLL' ? 0.001 : 1}
																	value={value}
																	onChange={(e) =>
																		setDraftCost((cur) =>
																			cur.map((d) =>
																				d.category === cat.key
																					? {
																							...d,
																							value: e.target.value,
																						}
																					: d
																			)
																		)
																	}
																	disabled={!isEditable}
																	aria-label={`${cat.label} value`}
																	className={cn(monoInputClass, 'h-8 w-28')}
																/>
															</td>
															<td className="px-3 py-2 text-right font-[family-name:var(--font-mono)] tabular-nums text-(--text-secondary)">
																{computeMonthlyPreview(mode, value)}
															</td>
														</tr>
													);
												})}
											</tbody>
										</table>
									</div>
								</section>
							</TabsContent>

							{/* ── Tab 5: Enrollment Link ─────────────────────────────── */}
							<TabsContent value="enrollment" forceMount className="data-[state=inactive]:hidden">
								<section className="rounded-xl border border-(--workspace-border) bg-(--workspace-bg-card) p-4">
									<p className="text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
										Enrollment Headcounts (AY2)
									</p>

									{isEnrollmentStale && (
										<div className="mt-3 flex items-center gap-2 rounded-lg border border-(--color-warning) bg-(--workspace-bg-subtle) p-3 text-(--text-sm) text-(--color-warning)">
											<AlertTriangle className="h-4 w-4 shrink-0" />
											<span>
												Enrollment data is stale. Re-calculate enrollment before relying on these
												headcounts.
											</span>
										</div>
									)}

									<div className="mt-4 overflow-x-auto rounded-lg border border-(--workspace-border)">
										<table className="w-full text-left text-(--text-sm)">
											<thead className="bg-(--workspace-bg-subtle)">
												<tr>
													<th className="px-3 py-2 text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
														Grade
													</th>
													<th className="px-3 py-2 text-right text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
														AY2 Headcount
													</th>
												</tr>
											</thead>
											<tbody>
												{headcountEntries.map((entry) => (
													<tr
														key={entry.gradeLevel}
														className="border-t border-(--workspace-border)"
													>
														<td className="px-3 py-2 font-medium text-(--text-primary)">
															{entry.gradeLevel}
														</td>
														<td className="px-3 py-2 text-right font-[family-name:var(--font-mono)] tabular-nums text-(--text-primary)">
															{entry.ay2}
														</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>

									<div className="mt-4">
										<Button
											type="button"
											variant="outline"
											onClick={() => navigate('/planning/enrollment')}
										>
											Go to Enrollment
										</Button>
									</div>
								</section>
							</TabsContent>

							{/* ── Tab 6: Reconciliation ──────────────────────────────── */}
							<TabsContent
								value="reconciliation"
								forceMount
								className="data-[state=inactive]:hidden"
							>
								<section className="rounded-xl border border-(--workspace-border) bg-(--workspace-bg-card) p-4">
									<p className="text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
										Reconciliation
									</p>
									<p className="mt-1 text-(--text-sm) text-(--text-secondary)">
										Compare app-computed values against workbook baselines.
									</p>

									<div className="mt-4 overflow-x-auto rounded-lg border border-(--workspace-border)">
										<table className="w-full text-left text-(--text-sm)">
											<thead className="bg-(--workspace-bg-subtle)">
												<tr>
													<th className="px-3 py-2 text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
														Metric
													</th>
													<th className="px-3 py-2 text-right text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
														App-Computed
													</th>
													<th className="px-3 py-2 text-right text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
														Baseline
													</th>
													<th className="px-3 py-2 text-right text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
														Delta
													</th>
													<th className="px-3 py-2 text-center text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
														Status
													</th>
												</tr>
											</thead>
											<tbody>
												<tr className="border-t border-(--workspace-border)">
													<td className="px-3 py-2 font-medium text-(--text-primary)">Total FTE</td>
													<td className="px-3 py-2 text-right font-[family-name:var(--font-mono)] tabular-nums text-(--text-primary)">
														{summary?.fte ?? '-'}
													</td>
													<td className="px-3 py-2 text-right font-[family-name:var(--font-mono)] tabular-nums text-(--text-secondary)">
														-
													</td>
													<td className="px-3 py-2 text-right font-[family-name:var(--font-mono)] tabular-nums text-(--text-secondary)">
														-
													</td>
													<td className="px-3 py-2 text-center text-(--text-muted)">-</td>
												</tr>
												<tr className="border-t border-(--workspace-border)">
													<td className="px-3 py-2 font-medium text-(--text-primary)">
														Total Cost
													</td>
													<td className="px-3 py-2 text-right font-[family-name:var(--font-mono)] tabular-nums text-(--text-primary)">
														{summary?.cost ?? '-'}
													</td>
													<td className="px-3 py-2 text-right font-[family-name:var(--font-mono)] tabular-nums text-(--text-secondary)">
														-
													</td>
													<td className="px-3 py-2 text-right font-[family-name:var(--font-mono)] tabular-nums text-(--text-secondary)">
														-
													</td>
													<td className="px-3 py-2 text-center text-(--text-muted)">-</td>
												</tr>
											</tbody>
										</table>
									</div>
								</section>
							</TabsContent>
						</Tabs>
					)}
				</div>

				<SheetFooter className="justify-between">
					<p className="text-(--text-sm) text-(--text-muted)">
						{isSaving
							? 'Saving...'
							: hasChanges
								? 'Saving will mark STAFFING stale until recalculated.'
								: 'No unsaved changes.'}
					</p>
					<div className="flex items-center gap-2">
						<Button type="button" variant="ghost" onClick={() => setOpen(false)}>
							Close
						</Button>
						<Button
							type="button"
							onClick={handleSave}
							disabled={!isEditable || !hasChanges || isSaving}
						>
							{isSaving ? 'Saving...' : 'Save settings'}
						</Button>
					</div>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
