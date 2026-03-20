import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Plus } from 'lucide-react';
import {
	useDhgRules,
	useCreateDhgRule,
	useUpdateDhgRule,
	useDeleteDhgRule,
	useDisciplines,
} from '../../hooks/use-master-data';
import type { DhgRuleDetail } from '../../hooks/use-master-data';
import type { DhgRuleFormValues } from './dhg-rule-side-panel';
import { DhgRuleSidePanel } from './dhg-rule-side-panel';
import { useGradeLevels } from '../../hooks/use-grade-levels';
import {
	buildRuleIndex,
	computeCoverageGaps,
	computeCurriculumKpis,
} from '../../lib/curriculum-coverage-map';
import { CurriculumKpiRibbon } from './curriculum-kpi-ribbon';
import { CurriculumCoverageMatrix } from './curriculum-coverage-matrix';
import { CurriculumRulesTable } from './curriculum-rules-table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogAction,
	AlertDialogCancel,
} from '../ui/alert-dialog';
import { toast } from '../ui/toast-state';

// ── Types ────────────────────────────────────────────────────────────────────

type SubView = 'coverage' | 'rules';

export type CurriculumTabContentProps = {
	isAdmin: boolean;
};

// ── Component ────────────────────────────────────────────────────────────────

export function CurriculumTabContent({ isAdmin }: CurriculumTabContentProps) {
	const [searchParams, setSearchParams] = useSearchParams();

	// Sub-tab state from URL
	const viewParam = searchParams.get('view');
	const subView: SubView = viewParam === 'rules' ? 'rules' : 'coverage';

	const handleViewChange = useCallback(
		(value: string) => {
			setSearchParams({ tab: 'curriculum', view: value }, { replace: true });
		},
		[setSearchParams]
	);

	// Panel state
	const [panelOpen, setPanelOpen] = useState(false);
	const [editingRule, setEditingRule] = useState<DhgRuleDetail | null>(null);
	const [prefillGrade, setPrefillGrade] = useState<string | undefined>();
	const [prefillDisciplineCode, setPrefillDisciplineCode] = useState<string | undefined>();

	// Delete state
	const [deleteTarget, setDeleteTarget] = useState<{
		code: string;
		id: number;
	} | null>(null);
	const [deleteConfirmText, setDeleteConfirmText] = useState('');

	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect -- reset form state when dialog opens; sync with prop is intentional
		if (deleteTarget) setDeleteConfirmText('');
	}, [deleteTarget]);

	// Data hooks
	const { data: dhgRules = [], isLoading: rulesLoading } = useDhgRules();
	const { data: disciplines = [] } = useDisciplines();
	const { data: gradeLevelsData } = useGradeLevels();
	const gradeLevels = useMemo(() => gradeLevelsData?.gradeLevels ?? [], [gradeLevelsData]);

	const createDhg = useCreateDhgRule();
	const updateDhg = useUpdateDhgRule();
	const deleteDhg = useDeleteDhgRule();

	// Derived data
	const gradeToBand = useMemo(() => {
		const map = new Map<string, string>();
		for (const gl of gradeLevels) {
			map.set(gl.gradeCode, gl.band);
		}
		return map;
	}, [gradeLevels]);

	const ruleIndex = useMemo(() => buildRuleIndex(dhgRules), [dhgRules]);
	const gaps = useMemo(() => computeCoverageGaps(dhgRules), [dhgRules]);
	const kpis = useMemo(() => computeCurriculumKpis(dhgRules, gradeToBand), [dhgRules, gradeToBand]);

	// Resolve discipline code to ID for prefill
	const prefillDisciplineId = useMemo(() => {
		if (!prefillDisciplineCode) return undefined;
		const disc = disciplines.find((d) => d.code === prefillDisciplineCode);
		return disc?.id;
	}, [prefillDisciplineCode, disciplines]);

	// ── Handlers ──────────────────────────────────────────────────────────────

	const openAddPanel = useCallback(() => {
		setEditingRule(null);
		setPrefillGrade(undefined);
		setPrefillDisciplineCode(undefined);
		setPanelOpen(true);
	}, []);

	const handleCellClick = useCallback(
		(gradeCode: string, disciplineCode: string, rule?: DhgRuleDetail) => {
			if (rule) {
				// Edit existing rule
				setEditingRule(rule);
				setPrefillGrade(undefined);
				setPrefillDisciplineCode(undefined);
			} else if (isAdmin) {
				// Add new rule pre-filled
				setEditingRule(null);
				setPrefillGrade(gradeCode);
				setPrefillDisciplineCode(disciplineCode);
			}
			setPanelOpen(true);
		},
		[isAdmin]
	);

	const handleEditRule = useCallback((rule: DhgRuleDetail) => {
		setEditingRule(rule);
		setPrefillGrade(undefined);
		setPrefillDisciplineCode(undefined);
		setPanelOpen(true);
	}, []);

	const handleDeleteRequest = useCallback((rule: DhgRuleDetail) => {
		setDeleteTarget({
			code: `${rule.gradeLevel}-${rule.disciplineCode}`,
			id: rule.id,
		});
	}, []);

	const handleClosePanel = useCallback(() => {
		setPanelOpen(false);
		setEditingRule(null);
		setPrefillGrade(undefined);
		setPrefillDisciplineCode(undefined);
	}, []);

	const handleSave = useCallback(
		(data: DhgRuleFormValues) => {
			if (editingRule) {
				updateDhg.mutate(
					{ id: editingRule.id, updatedAt: editingRule.updatedAt, ...data },
					{
						onSuccess: () => {
							handleClosePanel();
							toast.success('DHG rule updated successfully');
						},
						onError: () => toast.error('Failed to update DHG rule'),
					}
				);
			} else {
				createDhg.mutate(data, {
					onSuccess: () => {
						handleClosePanel();
						toast.success('DHG rule created successfully');
					},
					onError: () => toast.error('Failed to create DHG rule'),
				});
			}
		},
		[editingRule, createDhg, updateDhg, handleClosePanel]
	);

	const handleDeleteConfirm = useCallback(() => {
		if (!deleteTarget) return;
		deleteDhg.mutate(deleteTarget.id, {
			onSuccess: () => {
				setDeleteTarget(null);
				toast.success('DHG rule deleted successfully');
			},
			onError: () => toast.error('Failed to delete DHG rule'),
		});
	}, [deleteTarget, deleteDhg]);

	// ── Render ────────────────────────────────────────────────────────────────

	return (
		<div className="space-y-4">
			{/* KPI Summary Cards */}
			<CurriculumKpiRibbon kpis={kpis} />

			{/* Sub-tabs + Add button */}
			<Tabs value={subView} onValueChange={handleViewChange}>
				<div className="flex items-center justify-between">
					<TabsList>
						<TabsTrigger value="coverage">Coverage</TabsTrigger>
						<TabsTrigger value="rules">Rules</TabsTrigger>
					</TabsList>

					{isAdmin && (
						<Button type="button" variant="primary" onClick={openAddPanel}>
							<Plus className="mr-1 h-4 w-4" />
							Add Rule
						</Button>
					)}
				</div>

				<TabsContent value="coverage">
					<CurriculumCoverageMatrix
						rules={dhgRules}
						gradeLevels={gradeLevels}
						ruleIndex={ruleIndex}
						gaps={gaps}
						isAdmin={isAdmin}
						onCellClick={handleCellClick}
					/>
				</TabsContent>

				<TabsContent value="rules">
					<CurriculumRulesTable
						rules={dhgRules}
						gradeLevels={gradeLevels}
						isAdmin={isAdmin}
						isLoading={rulesLoading}
						onEdit={handleEditRule}
						onDelete={handleDeleteRequest}
					/>
				</TabsContent>
			</Tabs>

			{/* Side Panel */}
			<DhgRuleSidePanel
				open={panelOpen}
				onClose={handleClosePanel}
				dhgRule={editingRule}
				onSave={handleSave}
				loading={createDhg.isPending || updateDhg.isPending}
				prefillGradeLevel={prefillGrade}
				prefillDisciplineId={prefillDisciplineId}
			/>

			{/* Delete Confirmation */}
			<AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle className="text-(--color-error)">Delete DHG Rule</AlertDialogTitle>
						<AlertDialogDescription>
							This action cannot be undone. Type{' '}
							<strong className="font-mono">{deleteTarget?.code}</strong> to confirm deletion.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<div className="mt-2">
						<label htmlFor="delete-curriculum-confirm" className="sr-only">
							Type code to confirm
						</label>
						<Input
							id="delete-curriculum-confirm"
							type="text"
							value={deleteConfirmText}
							onChange={(e) => setDeleteConfirmText(e.target.value)}
							placeholder={deleteTarget?.code}
							className="font-mono"
						/>
					</div>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={deleteDhg.isPending}>Cancel</AlertDialogCancel>
						<AlertDialogAction
							className="bg-(--color-error) hover:bg-[color-mix(in_srgb,var(--color-error),black_15%)]"
							disabled={deleteConfirmText !== deleteTarget?.code || deleteDhg.isPending}
							onClick={handleDeleteConfirm}
						>
							{deleteDhg.isPending ? 'Deleting...' : 'Delete'}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
