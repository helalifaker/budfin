import { useMemo } from 'react';
import { Layers, FileCheck, Lock, Archive, Calendar, CalendarCheck, Clock } from 'lucide-react';
import { useAdminTab } from '../../hooks/use-admin-tab';
import { AdminPageHeader } from '../../components/admin/admin-page-header';
import { AdminTabBar } from '../../components/admin/admin-tab-bar';
import { AdminKpiRibbon } from '../../components/admin/admin-kpi-ribbon';
import type { AdminKpiItem } from '../../components/admin/admin-kpi-ribbon';
import { VersionsTabContent } from '../../components/admin/tabs/versions-tab-content';
import { FiscalPeriodsTabContent } from '../../components/admin/tabs/fiscal-periods-tab-content';
import { useVersions } from '../../hooks/use-versions';
import { useFiscalPeriods } from '../../hooks/use-fiscal-periods';
import { getCurrentFiscalYear } from '../../lib/format-date';

const VALID_TABS = ['versions', 'periods'] as const;
type TabKey = (typeof VALID_TABS)[number];

const TABS = [
	{ key: 'versions', label: 'Versions' },
	{ key: 'periods', label: 'Fiscal Periods' },
] as const;

const CURRENT_FISCAL_YEAR = getCurrentFiscalYear();

export function VersionsPage() {
	const [tab, setTab] = useAdminTab<TabKey>('versions', VALID_TABS);

	// --- KPI data for versions tab ---
	const { data: versionsData } = useVersions();

	const versionKpis = useMemo<AdminKpiItem[]>(() => {
		const all = versionsData?.data ?? [];
		const draftCount = all.filter((v) => v.status === 'Draft').length;
		const publishedCount = all.filter((v) => v.status === 'Published').length;
		const lockedCount = all.filter((v) => v.status === 'Locked').length;
		const archivedCount = all.filter((v) => v.status === 'Archived').length;

		return [
			{
				label: 'Draft',
				icon: Layers,
				value: draftCount,
				subtitle: 'In progress',
				accentColor: 'var(--status-draft)',
			},
			{
				label: 'Published',
				icon: FileCheck,
				value: publishedCount,
				subtitle: 'Ready for review',
				accentColor: 'var(--status-published)',
			},
			{
				label: 'Locked',
				icon: Lock,
				value: lockedCount,
				subtitle: 'Finalized',
				accentColor: 'var(--status-locked)',
			},
			{
				label: 'Archived',
				icon: Archive,
				value: archivedCount,
				subtitle: 'Historical',
				accentColor: 'var(--status-archived)',
			},
		];
	}, [versionsData]);

	// --- KPI data for periods tab ---
	const { data: periodsData } = useFiscalPeriods(CURRENT_FISCAL_YEAR);

	const periodKpis = useMemo<AdminKpiItem[]>(() => {
		const all = periodsData ?? [];
		const totalCount = all.length;
		const lockedCount = all.filter((p) => p.status === 'Locked').length;
		const openCount = all.filter((p) => p.status !== 'Locked').length;

		return [
			{
				label: 'Total Periods',
				icon: Calendar,
				value: totalCount,
				subtitle: `FY ${CURRENT_FISCAL_YEAR}`,
				accentColor: 'var(--accent-500)',
			},
			{
				label: 'Locked',
				icon: Lock,
				value: lockedCount,
				subtitle: 'Closed periods',
				accentColor: 'var(--status-locked)',
			},
			{
				label: 'Open',
				icon: CalendarCheck,
				value: openCount,
				subtitle: 'Active periods',
				accentColor: 'var(--status-published)',
			},
			{
				label: 'Current FY',
				icon: Clock,
				value: CURRENT_FISCAL_YEAR,
				subtitle: 'Active fiscal year',
				accentColor: 'var(--accent-600)',
			},
		];
	}, [periodsData]);

	const kpiItems = tab === 'versions' ? versionKpis : periodKpis;

	return (
		<div className="p-6 space-y-4">
			<AdminPageHeader
				title="Versions & Periods"
				subtitle="Manage budget versions, lifecycle transitions, and fiscal period locks"
			/>
			<AdminTabBar
				tabs={TABS}
				activeTab={tab}
				onTabChange={(key) => setTab(key as TabKey)}
				ariaLabel="Versions & Periods sections"
			/>
			<AdminKpiRibbon items={kpiItems} />
			<div role="tabpanel" id={`admin-panel-${tab}`} aria-labelledby={`admin-tab-${tab}`}>
				{tab === 'versions' && <VersionsTabContent />}
				{tab === 'periods' && <FiscalPeriodsTabContent />}
			</div>
		</div>
	);
}
