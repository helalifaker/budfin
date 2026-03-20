import { startTransition, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import Decimal from 'decimal.js';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '../ui/alert-dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
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
import { useStaffingSettingsDialogStore } from '../../stores/staffing-settings-dialog-store';
import type { SettingsTab } from '../../stores/staffing-settings-dialog-store';
import { useStaffingSettingsDirtyStore } from '../../stores/staffing-settings-dirty-store';
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

// ── Sidebar item ───────────────────────────────────────────────────────────

interface SidebarItemProps {
	id: SettingsTab;
	label: string;
	isActive: boolean;
	isReady: boolean;
	isDirty: boolean;
	isHidden?: boolean | undefined;
	onClick: () => void;
}

function SidebarItem({
	id: _id,
	label,
	isActive,
	isReady,
	isDirty,
	isHidden,
	onClick,
}: SidebarItemProps) {
	if (isHidden) return null;
	return (
		<Button
			variant="ghost"
			onClick={onClick}
			aria-current={isActive ? 'page' : undefined}
			className={cn(
				'h-auto w-full justify-between rounded-xl border px-3 py-2 text-left text-(--text-sm)',
				isActive
					? 'border-(--workspace-border) bg-(--workspace-bg-card) font-medium text-(--text-primary)'
					: 'border-transparent text-(--text-secondary) hover:bg-(--workspace-bg-card)'
			)}
		>
			<span>{label}</span>
			<span className="flex items-center gap-1">
				{isDirty && (
					<span
						className="h-2 w-2 rounded-full bg-orange-400"
						aria-label={`${label} has unsaved changes`}
					/>
				)}
				<span
					className={cn(
						'h-2 w-2 rounded-full',
						isReady ? 'bg-green-500' : 'bg-(--workspace-border)'
					)}
					aria-label={isReady ? `${label} configured` : `${label} not configured`}
				/>
			</span>
		</Button>
	);
}

// ── Component ──────────────────────────────────────────────────────────────

export type StaffingSettingsDialogProps = {
	versionId: number | null;
	isEditable: boolean;
};

export function StaffingSettingsDialog({ versionId, isEditable }: StaffingSettingsDialogProps) {
	const isOpen = useStaffingSettingsDialogStore((s) => s.isOpen);
	const activeTab = useStaffingSettingsDialogStore((s) => s.activeTab);
	const setTab = useStaffingSettingsDialogStore((s) => s.setTab);
	const close = useStaffingSettingsDialogStore((s) => s.close);

	const dirtyTabs = useStaffingSettingsDirtyStore((s) => s.dirtyTabs);
	const markDirty = useStaffingSettingsDirtyStore((s) => s.markDirty);
	const markClean = useStaffingSettingsDirtyStore((s) => s.markClean);
	const clearAll = useStaffingSettingsDirtyStore((s) => s.clearAll);
	const isDirty = useStaffingSettingsDirtyStore((s) => s.isDirty);
	const hasAnyDirty = useStaffingSettingsDirtyStore((s) => s.hasAnyDirty);

	const staleModules = useWorkspaceContextStore((s) => s.versionStaleModules);
	const navigate = useNavigate();

	const [pendingTab, setPendingTab] = useState<SettingsTab | null>(null);
	const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);

	// ── Data hooks ─────────────────────────────────────────────────────────

	const { data: settingsResp, isLoading: settingsLoading } = useStaffingSettings(versionId);
	const putSettings = usePutStaffingSettings(versionId);

	const { data: profilesResp } = useServiceProfiles();
	const { data: overridesResp } = useServiceProfileOverrides(versionId);
	const putOverrides = usePutServiceProfileOverrides(versionId);

	const { data: dhgRulesData } = useDhgRules();
	const { data: lyceeResp } = useLyceeGroupAssumptions(versionId);
	const putLyceeGroup = usePutLyceeGroupAssumptions(versionId);

	const { data: costResp } = useCostAssumptions(versionId);
	const putCostAssumptions = usePutCostAssumptions(versionId);

	const { data: headcountResp } = useHeadcount(versionId, 'AY2');
	const { data: summaryResp } = useStaffingSummary(versionId);

	// ── Derived data ───────────────────────────────────────────────────────

	const settings = (settingsResp as { data: StaffingSettings } | undefined)?.data ?? null;

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

	const dhgRules: DhgRule[] = useMemo(() => {
		return (dhgRulesData ?? []).map((r) => ({
			id: r.id,
			band: gradeToBand(r.gradeLevel),
			gradeLevel: r.gradeLevel,
			disciplineCode: r.disciplineCode,
			hoursPerWeekPerSection: r.hoursPerUnit,
			dhgType: r.driverType,
		}));
	}, [dhgRulesData]);

	const lyceeAssumptions = useMemo(
		() => (lyceeResp as { data: LyceeGroupAssumption[] } | undefined)?.data ?? [],
		[lyceeResp]
	);
	const costAssumptions = useMemo(
		() => (costResp as { data: CostAssumption[] } | undefined)?.data ?? [],
		[costResp]
	);

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

	// Sync local change detection into dirty store
	useEffect(() => {
		if (hsaChanged || orsChanged) {
			markDirty('profiles');
		} else {
			markClean('profiles');
		}
	}, [hsaChanged, orsChanged, markDirty, markClean]);

	useEffect(() => {
		if (costChanged) {
			markDirty('costAssumptions');
		} else {
			markClean('costAssumptions');
		}
	}, [costChanged, markDirty, markClean]);

	useEffect(() => {
		if (lyceeChanged) {
			markDirty('lyceeGroups');
		} else {
			markClean('lyceeGroups');
		}
	}, [lyceeChanged, markDirty, markClean]);

	const isSaving =
		putSettings.isPending ||
		putOverrides.isPending ||
		putCostAssumptions.isPending ||
		putLyceeGroup.isPending;

	// ── Readiness checks ───────────────────────────────────────────────────

	const tabReadiness: Record<SettingsTab, boolean> = useMemo(
		() => ({
			profiles: settings !== null,
			costAssumptions: costAssumptions.length > 0,
			curriculum: true,
			lyceeGroups: lyceeAssumptions.length > 0,
			enrollment: true,
			reconciliation: true,
		}),
		[settings, costAssumptions, lyceeAssumptions]
	);

	// ── Handlers ───────────────────────────────────────────────────────────

	function handleOpenChange(nextOpen: boolean) {
		if (nextOpen) return;

		if (hasAnyDirty()) {
			setConfirmDiscardOpen(true);
			return;
		}

		clearAll();
		close();
	}

	function handleTabClick(tab: SettingsTab) {
		if (tab === activeTab) return;

		if (isDirty(activeTab)) {
			setPendingTab(tab);
			return;
		}

		setTab(tab);
	}

	function handleStayOnTab() {
		setPendingTab(null);
	}

	function handleSwitchTab() {
		if (!pendingTab) return;
		markClean(activeTab);
		setTab(pendingTab);
		setPendingTab(null);
	}

	function handleDiscardClose() {
		clearAll();
		setConfirmDiscardOpen(false);
		close();
	}

	async function handleSaveProfiles() {
		if (!isEditable) return;
		const results = await Promise.allSettled([
			hsaChanged && draftHsa
				? putSettings.mutateAsync({
						hsaTargetHours: draftHsa.hsaTargetHours,
						hsaFirstHourRate: draftHsa.hsaFirstHourRate,
						hsaAdditionalHourRate: draftHsa.hsaAdditionalHourRate,
						hsaMonths: Number(draftHsa.hsaMonths),
					})
				: Promise.resolve(),
			orsChanged
				? putOverrides.mutateAsync(
						draftOrs.map((d) => ({
							serviceProfileId: d.serviceProfileId,
							weeklyServiceHours: d.effectiveOrs || null,
						}))
					)
				: Promise.resolve(),
		]);
		if (results.every((r) => r.status === 'fulfilled')) {
			markClean('profiles');
		}
	}

	async function handleSaveCostAssumptions() {
		if (!isEditable || !costChanged) return;
		await putCostAssumptions.mutateAsync(
			draftCost.map((d) => ({
				category: d.category,
				calculationMode: d.mode,
				value: d.value,
			}))
		);
		markClean('costAssumptions');
	}

	async function handleSaveLyceeGroups() {
		if (!isEditable || !lyceeChanged) return;
		await putLyceeGroup.mutateAsync(
			draftLycee.map((d) => ({
				disciplineCode: d.disciplineCode,
				groupCount: Number(d.groupCount),
				hoursPerGroup: d.hoursPerGroup,
			}))
		);
		markClean('lyceeGroups');
	}

	function handleSaveActiveTab() {
		if (activeTab === 'profiles') {
			void handleSaveProfiles();
		} else if (activeTab === 'costAssumptions') {
			void handleSaveCostAssumptions();
		} else if (activeTab === 'lyceeGroups') {
			void handleSaveLyceeGroups();
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

	const activeTabIsSaveable =
		activeTab === 'profiles' ||
		activeTab === 'costAssumptions' ||
		(activeTab === 'lyceeGroups' && hasGroupDriverRules);

	const activeTabHasChanges =
		(activeTab === 'profiles' && (hsaChanged || orsChanged)) ||
		(activeTab === 'costAssumptions' && costChanged) ||
		(activeTab === 'lyceeGroups' && lyceeChanged);

	const TAB_CONFIG: Array<{
		id: SettingsTab;
		label: string;
		hidden?: boolean;
	}> = [
		{ id: 'profiles', label: 'Service Profiles & ORS' },
		{ id: 'costAssumptions', label: 'Cost Assumptions' },
		{ id: 'curriculum', label: 'Curriculum (DHG Rules)' },
		{ id: 'lyceeGroups', label: 'Lycee Groups', hidden: !hasGroupDriverRules },
		{ id: 'enrollment', label: 'Enrollment' },
		{ id: 'reconciliation', label: 'Reconciliation' },
	];

	return (
		<>
			<Dialog open={isOpen} onOpenChange={handleOpenChange}>
				<DialogContent
					aria-label="Staffing Settings"
					className="h-[90vh] max-w-[90vw] overflow-hidden rounded-3xl bg-(--workspace-bg-card) p-0"
				>
					<div className="flex h-full flex-col">
						<DialogHeader className="border-b border-(--workspace-border) px-6 py-5">
							<DialogTitle>Staffing Settings</DialogTitle>
							<DialogDescription>
								Configure staffing parameters, cost assumptions, and review enrollment linkage.
							</DialogDescription>
						</DialogHeader>

						<div className="flex min-h-0 flex-1">
							{/* Sidebar */}
							<nav
								aria-label="Staffing settings sections"
								className="w-64 shrink-0 border-r border-(--workspace-border) bg-(--workspace-bg-subtle) p-4"
							>
								<div className="flex flex-col gap-1">
									{TAB_CONFIG.map((tab) => (
										<SidebarItem
											key={tab.id}
											id={tab.id}
											label={tab.label}
											isActive={activeTab === tab.id}
											isReady={tabReadiness[tab.id]}
											isDirty={dirtyTabs.has(tab.id)}
											isHidden={tab.hidden}
											onClick={() => handleTabClick(tab.id)}
										/>
									))}
								</div>
							</nav>

							{/* Content area */}
							<div className="flex min-h-0 flex-1 flex-col">
								<div className="flex-1 overflow-y-auto px-6 py-5">
									{settingsLoading ? (
										<p className="mt-4 text-(--text-sm) text-(--text-muted)">Loading settings...</p>
									) : (
										<>
											{pendingTab && (
												<div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-(--color-warning) bg-(--color-warning-bg) px-4 py-3 text-(--text-sm) text-(--color-warning)">
													<span>You have unsaved changes. Switch anyway?</span>
													<div className="flex items-center gap-2">
														<Button
															type="button"
															variant="outline"
															size="sm"
															onClick={handleStayOnTab}
														>
															Stay
														</Button>
														<Button type="button" size="sm" onClick={handleSwitchTab}>
															Switch
														</Button>
													</div>
												</div>
											)}

											{/* ── Tab: Service Profiles & ORS ───────────────────────── */}
											{activeTab === 'profiles' && (
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
											)}

											{/* ── Tab: Curriculum / DHG Rules ───────────────────────── */}
											{activeTab === 'curriculum' && (
												<section className="rounded-xl border border-(--workspace-border) bg-(--workspace-bg-card) p-4">
													<div className="flex items-start justify-between gap-4">
														<p className="text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
															DHG Rules (Read-Only)
														</p>
														<Button
															variant="ghost"
															size="sm"
															onClick={() => {
																close();
																navigate('/master-data/reference?tab=curriculum');
															}}
															className="gap-1 text-(--text-sm) text-(--accent-600) hover:underline"
														>
															<ExternalLink className="h-3 w-3" />
															Edit in Master Data
														</Button>
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
																				<tr
																					key={r.id}
																					className="border-t border-(--workspace-border)"
																				>
																					<td className="px-3 py-2 text-(--text-primary)">
																						{r.gradeLevel}
																					</td>
																					<td className="px-3 py-2 text-(--text-secondary)">
																						{r.disciplineCode}
																					</td>
																					<td className="px-3 py-2 text-(--text-secondary)">
																						{r.dhgType}
																					</td>
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
											)}

											{/* ── Tab: Lycee Group Assumptions ──────────────────────── */}
											{activeTab === 'lyceeGroups' && hasGroupDriverRules && (
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
																								? { ...item, groupCount: e.target.value }
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
																								? { ...item, hoursPerGroup: e.target.value }
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
											)}

											{/* ── Tab: Additional Cost Assumptions ──────────────────── */}
											{activeTab === 'costAssumptions' && (
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
																		<tr
																			key={cat.key}
																			className="border-t border-(--workspace-border)"
																		>
																			<td className="px-3 py-2 font-medium text-(--text-primary)">
																				{cat.label}
																			</td>
																			<td className="px-3 py-2">
																				<Select
																					value={mode}
																					onValueChange={(val) =>
																						setDraftCost((cur) =>
																							cur.map((d) =>
																								d.category === cat.key ? { ...d, mode: val } : d
																							)
																						)
																					}
																					disabled={!isEditable}
																				>
																					<SelectTrigger
																						aria-label={`${cat.label} mode`}
																						className="h-8 w-36"
																					>
																						<SelectValue />
																					</SelectTrigger>
																					<SelectContent>
																						{COST_MODES.map((m) => (
																							<SelectItem key={m.value} value={m.value}>
																								{m.label}
																							</SelectItem>
																						))}
																					</SelectContent>
																				</Select>
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
																									? { ...d, value: e.target.value }
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
											)}

											{/* ── Tab: Enrollment ───────────────────────────────────── */}
											{activeTab === 'enrollment' && (
												<section className="rounded-xl border border-(--workspace-border) bg-(--workspace-bg-card) p-4">
													<p className="text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
														Enrollment Headcounts (AY2)
													</p>

													{isEnrollmentStale && (
														<div className="mt-3 flex items-center gap-2 rounded-lg border border-(--color-warning) bg-(--workspace-bg-subtle) p-3 text-(--text-sm) text-(--color-warning)">
															<AlertTriangle className="h-4 w-4 shrink-0" />
															<span>
																Enrollment data is stale. Re-calculate enrollment before relying on
																these headcounts.
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
											)}

											{/* ── Tab: Reconciliation ───────────────────────────────── */}
											{activeTab === 'reconciliation' && (
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
																	<td className="px-3 py-2 font-medium text-(--text-primary)">
																		Total FTE
																	</td>
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
											)}
										</>
									)}
								</div>

								{/* Footer */}
								<div className="flex items-center justify-between border-t border-(--workspace-border) px-6 py-4">
									<p className="text-(--text-sm) text-(--text-muted)">
										{isSaving
											? 'Saving...'
											: activeTabHasChanges
												? 'Saving will mark STAFFING stale until recalculated.'
												: 'No unsaved changes.'}
									</p>
									<div className="flex items-center gap-2">
										<Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
											Close
										</Button>
										{activeTabIsSaveable && (
											<Button
												type="button"
												onClick={handleSaveActiveTab}
												disabled={!isEditable || !activeTabHasChanges || isSaving}
											>
												{isSaving ? 'Saving...' : 'Save'}
											</Button>
										)}
									</div>
								</div>
							</div>
						</div>
					</div>
				</DialogContent>
			</Dialog>

			<AlertDialog open={confirmDiscardOpen} onOpenChange={setConfirmDiscardOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Discard changes?</AlertDialogTitle>
						<AlertDialogDescription>
							You have unsaved changes. Discard and close?
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction onClick={handleDiscardClose}>Discard</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
