import Decimal from 'decimal.js';
import { ArrowLeft, ArrowRight, DollarSign, FileText, Layers, PieChart } from 'lucide-react';
import { useNavigate } from 'react-router';
import { cn } from '../../lib/cn';
import { formatMoney } from '../../lib/format-money';
import { registerPanelContent } from '../../lib/right-panel-registry';
import {
	usePnlAccountingSelectionStore,
	type PnlAccountingSelection,
} from '../../stores/pnl-accounting-selection-store';
import { InspectorSection } from '../shared/inspector-section';
import { KpiCard } from '../shared/kpi-card';
import { Button } from '../ui/button';

// ── Section Module Map ───────────────────────────────────────────────────────

const SECTION_MODULE_MAP: Record<string, { path: string; label: string }> = {
	REVENUE: { path: '/planning/revenue', label: 'Revenue' },
	REVENUE_CONTRACTS: { path: '/planning/revenue', label: 'Revenue' },
	RENTAL_INCOME: { path: '/planning/revenue', label: 'Revenue' },
	TOTAL_REVENUE: { path: '/planning/revenue', label: 'Revenue' },
	STAFF_COSTS: { path: '/planning/staffing', label: 'Staffing' },
	EMPLOYER_CHARGES: { path: '/planning/staffing', label: 'Staffing' },
	COST_OF_SERVICE: { path: '/planning/opex', label: 'OpEx' },
	PFC_6PCT: { path: '/planning/opex', label: 'OpEx' },
	RENT: { path: '/planning/opex', label: 'OpEx' },
	MAINTENANCE: { path: '/planning/opex', label: 'OpEx' },
	OTHER_OPEX: { path: '/planning/opex', label: 'OpEx' },
	DEPRECIATION: { path: '/planning/opex', label: 'OpEx' },
	PROVISIONS: { path: '/planning/opex', label: 'OpEx' },
	TOTAL_OPEX: { path: '/planning/opex', label: 'OpEx' },
};

// ── Section Descriptions ─────────────────────────────────────────────────────

const SECTION_DESCRIPTIONS: Record<string, string> = {
	REVENUE: 'Tuition fees split by trimester, registration fees, activities, and other income',
	COST_OF_SERVICE: 'AEFE fees and teaching materials directly tied to educational delivery',
	PFC_6PCT: 'Contribution de frais de scolarite (6% of tuition)',
	STAFF_COSTS: 'Local salaries (base, housing, transport), employer charges (GOSI, EOS, Ajeer)',
	RENT: 'School campus rental costs',
	MAINTENANCE: 'Building maintenance contracts',
	OTHER_OPEX: 'Insurance, travel, IT, general expenses, and other operating costs',
	DEPRECIATION: 'Fixed asset depreciation charges',
	PROVISIONS: 'EOS provision, bad debt, strategic provisions',
	NET_FINANCE: 'Financial income and FX gains/losses',
};

// ── Trimester labels for revenue ─────────────────────────────────────────────

const TRIMESTER_INFO: Record<string, string> = {
	'701100': 'Trimester 1 (Sep-Dec)',
	'701200': 'Trimester 2 (Jan-Mar)',
	'701300': 'Trimester 3 (Apr-Jun)',
};

// ── Default View ─────────────────────────────────────────────────────────────

function PnlAccountingInspectorDefault() {
	const navigate = useNavigate();

	return (
		<div className="space-y-5">
			<p className="text-(--text-sm) text-(--text-muted)">
				Click a line item in the accounting P&L grid to see its details here.
			</p>

			<InspectorSection title="Quick links">
				<div className="flex flex-wrap gap-2">
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => navigate('/planning/revenue')}
					>
						Revenue
						<ArrowRight className="ml-1 h-3 w-3" />
					</Button>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => navigate('/planning/staffing')}
					>
						Staffing
						<ArrowRight className="ml-1 h-3 w-3" />
					</Button>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => navigate('/planning/opex')}
					>
						OpEx
						<ArrowRight className="ml-1 h-3 w-3" />
					</Button>
				</div>
			</InspectorSection>
		</div>
	);
}

// ── Active View ──────────────────────────────────────────────────────────────

function PnlAccountingInspectorActive({ selection }: { selection: PnlAccountingSelection }) {
	const clearSelection = usePnlAccountingSelectionStore((s) => s.clearSelection);
	const navigate = useNavigate();

	const budget = new Decimal(selection.budgetAmount);
	const moduleLink = SECTION_MODULE_MAP[selection.sectionKey];
	const sectionDesc = SECTION_DESCRIPTIONS[selection.sectionKey];
	const trimesterLabel = selection.accountCode ? TRIMESTER_INFO[selection.accountCode] : undefined;

	return (
		<div className="space-y-5">
			{/* Back + label */}
			<div className="flex items-center gap-2">
				<button
					type="button"
					onClick={clearSelection}
					className={cn(
						'rounded-md p-1 text-(--text-muted)',
						'transition-colors duration-(--duration-fast)',
						'hover:bg-(--workspace-bg-muted) hover:text-(--text-primary)'
					)}
					aria-label="Back to overview"
				>
					<ArrowLeft className="h-4 w-4" />
				</button>
				<h3
					className={cn(
						'font-[family-name:var(--font-display)]',
						'text-(--text-lg) font-semibold text-(--text-primary)'
					)}
				>
					{selection.lineLabel}
				</h3>
			</div>

			{/* KPI cards */}
			<div className="grid gap-3">
				<KpiCard
					label="Budget Amount"
					icon={DollarSign}
					index={0}
					subtitle={selection.sectionKey.replace(/_/g, ' ')}
				>
					{formatMoney(budget, { showCurrency: true, compact: true })}
				</KpiCard>
			</div>

			{/* Section context */}
			{sectionDesc && (
				<InspectorSection title="About this section" icon={Layers}>
					<p className="text-(--text-xs) text-(--text-secondary) leading-relaxed">{sectionDesc}</p>
				</InspectorSection>
			)}

			{/* Account detail */}
			{selection.accountCode && (
				<InspectorSection title="Account detail" icon={FileText}>
					<div className="space-y-2 text-(--text-sm)">
						<div className="flex justify-between">
							<span className="text-(--text-muted)">PCG Code</span>
							<span className="font-mono font-medium">{selection.accountCode}</span>
						</div>
						<div className="flex justify-between">
							<span className="text-(--text-muted)">Label</span>
							<span className="font-medium">{selection.lineLabel}</span>
						</div>
						{trimesterLabel && (
							<div className="flex justify-between">
								<span className="text-(--text-muted)">Period</span>
								<span className="font-medium">{trimesterLabel}</span>
							</div>
						)}
					</div>
				</InspectorSection>
			)}

			{/* Variance detail */}
			{selection.actualAmount && (
				<InspectorSection title="Comparison">
					<div className="space-y-2 text-(--text-sm)">
						<div className="flex justify-between">
							<span className="text-(--text-muted)">Budget</span>
							<span className="font-mono tabular-nums">
								{formatMoney(budget, { showCurrency: true })}
							</span>
						</div>
						<div className="flex justify-between">
							<span className="text-(--text-muted)">Actual</span>
							<span className="font-mono tabular-nums">
								{formatMoney(selection.actualAmount, { showCurrency: true })}
							</span>
						</div>
						{selection.variance && (
							<div className="flex justify-between">
								<span className="text-(--text-muted)">Variance</span>
								<span
									className={cn(
										'font-mono tabular-nums',
										new Decimal(selection.variance).gt(0)
											? 'text-(--color-success)'
											: 'text-(--color-error)'
									)}
								>
									{formatMoney(selection.variance, { showCurrency: true })}
									{selection.variancePct && (
										<span className="ml-1 text-(--text-xs) text-(--text-muted)">
											({selection.variancePct}%)
										</span>
									)}
								</span>
							</div>
						)}
					</div>
				</InspectorSection>
			)}

			{/* Profit center allocation info */}
			<InspectorSection title="Profit center allocation" icon={PieChart}>
				<p className="text-(--text-xs) text-(--text-secondary)">
					{selection.sectionKey === 'REVENUE'
						? 'Revenue is allocated directly by grade band. Select a profit center in the toolbar to filter.'
						: 'Costs are allocated by enrollment headcount ratio. Select a profit center in the toolbar to see the weighted share.'}
				</p>
			</InspectorSection>

			{/* Navigation */}
			{moduleLink && (
				<InspectorSection title="Source module">
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => navigate(moduleLink.path)}
					>
						View {moduleLink.label}
						<ArrowRight className="ml-1 h-3 w-3" />
					</Button>
				</InspectorSection>
			)}
		</div>
	);
}

// ── Main Inspector Content ───────────────────────────────────────────────────

function PnlAccountingInspector() {
	const selection = usePnlAccountingSelectionStore((s) => s.selection);

	return (
		<div aria-live="polite">
			{selection ? (
				<div
					key={`active-${selection.sectionKey}-${selection.lineLabel}`}
					className="animate-inspector-crossfade"
				>
					<PnlAccountingInspectorActive selection={selection} />
				</div>
			) : (
				<div key="default" className="animate-inspector-crossfade">
					<PnlAccountingInspectorDefault />
				</div>
			)}
		</div>
	);
}

registerPanelContent('pnl-accounting', PnlAccountingInspector);

export { PnlAccountingInspector };
