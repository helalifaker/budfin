import { useMemo } from 'react';
import {
	Calculator,
	Settings,
	Percent,
	Clock,
	FileSpreadsheet,
	CheckCircle,
	AlertCircle,
	PieChart,
} from 'lucide-react';
import { useAdminTab } from '../../hooks/use-admin-tab';
import { AdminPageHeader } from '../../components/admin/admin-page-header';
import { AdminTabBar } from '../../components/admin/admin-tab-bar';
import { AdminKpiRibbon, type AdminKpiItem } from '../../components/admin/admin-kpi-ribbon';
import {
	AssumptionsTabContent,
	useAssumptionsKpiStats,
} from '../../components/admin/tabs/assumptions-tab-content';
import {
	PnlTemplateTabContent,
	usePnlTemplateKpiStats,
} from '../../components/admin/tabs/pnl-template-tab-content';

const TABS = [
	{ key: 'assumptions', label: 'Assumptions' },
	{ key: 'pnl-template', label: 'P&L Template' },
] as const;

type TabKey = (typeof TABS)[number]['key'];
const VALID_TABS: readonly TabKey[] = TABS.map((t) => t.key);

export function FinancialSetupPage() {
	const [activeTab, setTab] = useAdminTab<TabKey>('assumptions', VALID_TABS);

	const assumptionsStats = useAssumptionsKpiStats();
	const pnlStats = usePnlTemplateKpiStats();

	const kpiItems = useMemo<AdminKpiItem[]>(() => {
		if (activeTab === 'assumptions') {
			return [
				{
					label: 'Parameters',
					icon: Calculator,
					value: assumptionsStats?.parameterCount ?? '-',
					accentColor: 'var(--accent-500)',
				},
				{
					label: 'Categories',
					icon: Settings,
					value: assumptionsStats?.categoryCount ?? '-',
					accentColor: 'var(--color-info)',
				},
				{
					label: 'GOSI Rate',
					icon: Percent,
					value: assumptionsStats ? `${assumptionsStats.gosiRateTotal}%` : '-',
					accentColor: 'var(--color-warning)',
				},
				{
					label: 'Last Updated',
					icon: Clock,
					value: assumptionsStats?.lastUpdated ?? 'N/A',
					accentColor: 'var(--color-success)',
				},
			];
		}

		// pnl-template tab
		return [
			{
				label: 'Sections',
				icon: FileSpreadsheet,
				value: pnlStats?.sectionCount ?? '-',
				accentColor: 'var(--accent-500)',
			},
			{
				label: 'Mapped Accounts',
				icon: CheckCircle,
				value: pnlStats?.mappedAccountCount ?? '-',
				accentColor: 'var(--color-success)',
			},
			{
				label: 'Unassigned',
				icon: AlertCircle,
				value: pnlStats?.unassignedCount ?? '-',
				accentColor: 'var(--color-warning)',
			},
			{
				label: 'Coverage %',
				icon: PieChart,
				value: pnlStats != null ? `${pnlStats.coveragePct}%` : '-',
				accentColor: 'var(--color-info)',
			},
		];
	}, [activeTab, assumptionsStats, pnlStats]);

	return (
		<div className="flex h-full flex-col overflow-hidden p-6">
			<AdminPageHeader
				title="Financial Setup"
				subtitle="Manage assumptions, parameters, and P&L template mappings"
			/>

			<div className="mt-4">
				<AdminKpiRibbon items={kpiItems} />
			</div>

			<div className="mt-4">
				<AdminTabBar
					tabs={TABS}
					activeTab={activeTab}
					onTabChange={(key) => setTab(key as TabKey)}
					ariaLabel="Financial setup sections"
				/>
			</div>

			<div
				role="tabpanel"
				id={`admin-panel-${activeTab}`}
				aria-labelledby={`admin-tab-${activeTab}`}
				className="mt-6 min-h-0 flex-1 overflow-y-auto"
			>
				{activeTab === 'assumptions' && <AssumptionsTabContent />}
				{activeTab === 'pnl-template' && <PnlTemplateTabContent />}
			</div>
		</div>
	);
}
