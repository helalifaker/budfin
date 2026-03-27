import { useCallback, useMemo, useRef, useState } from 'react';
import { Save } from 'lucide-react';
import {
	usePnlTemplates,
	useTemplateMappings,
	useSaveMappings,
	type PnlTemplateSection,
	type SectionInput,
	type TemplateMappingsResponse,
} from '../../../hooks/use-pnl-templates';
import { useAccounts, type Account } from '../../../hooks/use-accounts';
import { cn } from '../../../lib/cn';
import { Button } from '../../ui/button';
import { Skeleton } from '../../ui/skeleton';
import { PnlPreviewPanel } from '../../pnl-mapping/pnl-preview-panel';
import { AccountAssignmentPanel } from '../../pnl-mapping/account-assignment-panel';
import { UnassignedAccounts } from '../../pnl-mapping/unassigned-accounts';
import { toast } from '../../ui/toast-state';

/**
 * KPI stats derived from P&L template data.
 * Used by the parent page to populate the AdminKpiRibbon.
 */
export type PnlTemplateKpiStats = {
	sectionCount: number;
	mappedAccountCount: number;
	unassignedCount: number;
	coveragePct: number;
};

export function usePnlTemplateKpiStats(): PnlTemplateKpiStats | null {
	const { data: templates } = usePnlTemplates();
	const { data: accountsData } = useAccounts();

	const defaultTemplate = templates?.find((t) => t.isDefault) ?? templates?.[0];
	const templateId = defaultTemplate?.id;

	const { data: mappingsData } = useTemplateMappings(templateId);

	return useMemo(() => {
		if (!mappingsData || !accountsData) return null;

		const sections = mappingsData.sections;
		const nonSubtotalSections = sections.filter((s) => !s.isSubtotal);

		const assignedCodes = new Set<string>();
		for (const section of sections) {
			for (const mapping of section.mappings) {
				if (mapping.accountCode) {
					assignedCodes.add(mapping.accountCode);
				}
			}
		}

		const activeAccounts = accountsData.accounts.filter((a) => a.status === 'ACTIVE');
		const unassignedCount = activeAccounts.filter((a) => !assignedCodes.has(a.accountCode)).length;
		const totalActive = activeAccounts.length;
		const coveragePct = totalActive > 0 ? Math.round((assignedCodes.size / totalActive) * 100) : 0;

		return {
			sectionCount: nonSubtotalSections.length,
			mappedAccountCount: assignedCodes.size,
			unassignedCount,
			coveragePct,
		};
	}, [mappingsData, accountsData]);
}

export function PnlTemplateTabContent() {
	const { data: templates, isLoading: templatesLoading } = usePnlTemplates();
	const { data: accountsData, isLoading: accountsLoading } = useAccounts();

	const defaultTemplate = templates?.find((t) => t.isDefault) ?? templates?.[0];
	const templateId = defaultTemplate?.id;

	const { data: mappingsData, isLoading: mappingsLoading } = useTemplateMappings(templateId);
	const isLoading = templatesLoading || accountsLoading || mappingsLoading;

	if (isLoading) {
		return (
			<div>
				<div className="mb-6 flex items-center justify-between">
					<Skeleton className="h-8 w-48" />
					<Skeleton className="h-9 w-24" />
				</div>
				<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
					<div className="space-y-2">
						{Array.from({ length: 10 }).map((_, i) => (
							<Skeleton key={i} className="h-10 w-full rounded-md" />
						))}
					</div>
					<div className="space-y-2">
						{Array.from({ length: 6 }).map((_, i) => (
							<Skeleton key={i} className="h-10 w-full rounded-md" />
						))}
					</div>
				</div>
			</div>
		);
	}

	return (
		<PnlMappingEditor
			mappingsData={mappingsData ?? null}
			allAccounts={accountsData?.accounts ?? []}
			templateId={templateId}
			templateName={defaultTemplate?.name}
		/>
	);
}

// ── Editor (rendered only after data loads) ──────────────────────────────────

interface PnlMappingEditorProps {
	mappingsData: TemplateMappingsResponse | null;
	allAccounts: Account[];
	templateId: number | undefined;
	templateName: string | undefined;
}

function PnlMappingEditor({
	mappingsData,
	allAccounts,
	templateId,
	templateName,
}: PnlMappingEditorProps) {
	const saveMutation = useSaveMappings();

	const initialSections = useMemo(() => mappingsData?.sections ?? [], [mappingsData?.sections]);
	const firstNonSubtotal = initialSections.find((s) => !s.isSubtotal);

	const [selectedSectionKey, setSelectedSectionKey] = useState<string | null>(
		firstNonSubtotal?.sectionKey ?? null
	);
	const [localSections, setLocalSections] = useState<PnlTemplateSection[] | null>(null);
	const [isDirty, setIsDirty] = useState(false);
	const nextTempId = useRef(-1);

	// Use local overrides if dirty, otherwise fall back to remote data
	const sections = useMemo(
		() => localSections ?? initialSections,
		[localSections, initialSections]
	);

	// Compute unassigned accounts
	const assignedCodes = useMemo(() => {
		const codes = new Set<string>();
		for (const section of sections) {
			for (const mapping of section.mappings) {
				if (mapping.accountCode) {
					codes.add(mapping.accountCode);
				}
			}
		}
		return codes;
	}, [sections]);

	const unassignedAccounts = useMemo(() => {
		return allAccounts.filter((a) => a.status === 'ACTIVE' && !assignedCodes.has(a.accountCode));
	}, [allAccounts, assignedCodes]);

	const selectedSection = sections.find((s) => s.sectionKey === selectedSectionKey) ?? null;

	// ── Mutation Handlers ────────────────────────────────────────────────────

	const updateSections = useCallback(
		(updater: (prev: PnlTemplateSection[]) => PnlTemplateSection[]) => {
			setLocalSections((prev) => {
				const current = prev ?? initialSections;
				return updater(current);
			});
			setIsDirty(true);
		},
		[initialSections]
	);

	const handleVisibilityChange = useCallback(
		(sectionKey: string, mappingId: number, visibility: 'SHOW' | 'GROUP') => {
			updateSections((prev) =>
				prev.map((section) => {
					if (section.sectionKey !== sectionKey) return section;
					return {
						...section,
						mappings: section.mappings.map((m) => (m.id === mappingId ? { ...m, visibility } : m)),
					};
				})
			);
		},
		[updateSections]
	);

	const handleRemoveAccount = useCallback(
		(sectionKey: string, mappingId: number) => {
			updateSections((prev) =>
				prev.map((section) => {
					if (section.sectionKey !== sectionKey) return section;
					return {
						...section,
						mappings: section.mappings.filter((m) => m.id !== mappingId),
					};
				})
			);
		},
		[updateSections]
	);

	const handleAddAccount = useCallback(
		(sectionKey: string, accountCode: string) => {
			const account = allAccounts.find((a) => a.accountCode === accountCode);
			if (!account) return;

			updateSections((prev) =>
				prev.map((section) => {
					if (section.sectionKey !== sectionKey) return section;
					if (section.mappings.some((m) => m.accountCode === accountCode)) {
						return section;
					}
					const tempId = nextTempId.current--;
					return {
						...section,
						mappings: [
							...section.mappings,
							{
								id: tempId,
								sectionId: section.id,
								accountCode,
								displayLabel: account.accountName,
								displayOrder: section.mappings.length + 1,
								visibility: 'SHOW' as const,
							},
						],
					};
				})
			);
		},
		[allAccounts, updateSections]
	);

	const handleSave = useCallback(() => {
		if (!templateId || !localSections) return;

		const sectionInputs: SectionInput[] = localSections.map((section) => ({
			sectionKey: section.sectionKey,
			displayLabel: section.displayLabel,
			displayOrder: section.displayOrder,
			isSubtotal: section.isSubtotal,
			signConvention: section.signConvention,
			mappings: section.mappings.map((m, i) => ({
				accountCode: m.accountCode,
				displayLabel: m.displayLabel,
				displayOrder: i + 1,
				visibility: m.visibility,
			})),
		}));

		saveMutation.mutate(
			{ templateId, sections: sectionInputs },
			{
				onSuccess: () => {
					setIsDirty(false);
					toast.success('P&L template mappings saved successfully');
				},
				onError: () => {
					toast.error('Failed to save P&L template mappings');
				},
			}
		);
	}, [templateId, localSections, saveMutation]);

	return (
		<div className="flex h-full flex-col overflow-hidden">
			{/* Header */}
			<div className="mb-6 flex shrink-0 flex-wrap items-center justify-between gap-3">
				<div>
					<p className="text-(--text-sm) text-(--text-muted)">
						Configure account assignments for the IFRS P&L template
						{templateName && <span className="ml-1 font-medium">({templateName})</span>}
					</p>
				</div>

				<Button
					type="button"
					variant="primary"
					onClick={handleSave}
					disabled={!isDirty || saveMutation.isPending}
					loading={saveMutation.isPending}
				>
					<Save className="mr-1.5 h-4 w-4" aria-hidden="true" />
					{saveMutation.isPending ? 'Saving...' : 'Save Mappings'}
				</Button>
			</div>

			{/* Two-Panel Layout */}
			<div className="grid min-h-0 flex-1 grid-cols-1 gap-6 overflow-hidden lg:grid-cols-2">
				{/* Left: Section List */}
				<div
					className={cn(
						'flex flex-col overflow-hidden',
						'rounded-xl border border-(--workspace-border) bg-(--workspace-bg-card)'
					)}
				>
					<div
						className={cn(
							'shrink-0 border-b border-(--workspace-border)',
							'bg-(--workspace-bg-muted) px-4 py-3'
						)}
					>
						<h2 className="text-(--text-sm) font-semibold text-(--text-primary)">IFRS Sections</h2>
					</div>
					<div className="flex-1 overflow-y-auto p-3">
						<PnlPreviewPanel
							sections={sections}
							selectedSectionKey={selectedSectionKey}
							onSelectSection={setSelectedSectionKey}
						/>
					</div>
				</div>

				{/* Right: Account Assignment */}
				<div className="flex flex-col gap-4 overflow-y-auto">
					<div
						className={cn(
							'rounded-xl border border-(--workspace-border)',
							'bg-(--workspace-bg-card) p-4'
						)}
					>
						{selectedSection ? (
							<AccountAssignmentPanel
								section={selectedSection}
								allAccounts={allAccounts}
								onVisibilityChange={handleVisibilityChange}
								onRemoveAccount={handleRemoveAccount}
								onAddAccount={handleAddAccount}
							/>
						) : (
							<p className="py-12 text-center text-(--text-sm) text-(--text-muted)">
								Select a section on the left to manage its account assignments.
							</p>
						)}
					</div>

					{/* Unassigned accounts */}
					<UnassignedAccounts
						accounts={unassignedAccounts}
						sections={sections}
						onAssignAccount={handleAddAccount}
					/>
				</div>
			</div>
		</div>
	);
}
