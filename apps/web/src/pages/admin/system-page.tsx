import { useMemo } from 'react';
import {
	Users,
	UserCheck,
	Shield,
	Lock,
	FileText,
	Activity,
	Hash,
	Timer,
	KeyRound,
	Calendar,
	Clock,
} from 'lucide-react';
import { useAdminTab } from '../../hooks/use-admin-tab';
import { AdminPageHeader } from '../../components/admin/admin-page-header';
import { AdminTabBar } from '../../components/admin/admin-tab-bar';
import { AdminKpiRibbon, type AdminKpiItem } from '../../components/admin/admin-kpi-ribbon';
import { UsersTabContent, useUsersKpiStats } from '../../components/admin/tabs/users-tab-content';
import { AuditTabContent, useAuditKpiStats } from '../../components/admin/tabs/audit-tab-content';
import {
	SettingsTabContent,
	useSettingsKpiStats,
} from '../../components/admin/tabs/settings-tab-content';

const TABS = [
	{ key: 'users', label: 'Users' },
	{ key: 'audit', label: 'Audit' },
	{ key: 'settings', label: 'Settings' },
] as const;

type TabKey = (typeof TABS)[number]['key'];
const VALID_TABS: readonly TabKey[] = TABS.map((t) => t.key);

export function SystemPage() {
	const [activeTab, setTab] = useAdminTab<TabKey>('users', VALID_TABS);

	const usersStats = useUsersKpiStats();
	const auditStats = useAuditKpiStats();
	const settingsStats = useSettingsKpiStats();

	const kpiItems = useMemo<AdminKpiItem[]>(() => {
		if (activeTab === 'users') {
			return [
				{
					label: 'Total Users',
					icon: Users,
					value: usersStats?.totalUsers ?? '-',
					accentColor: 'var(--accent-500)',
				},
				{
					label: 'Active',
					icon: UserCheck,
					value: usersStats?.activeUsers ?? '-',
					accentColor: 'var(--color-success)',
				},
				{
					label: 'Admins',
					icon: Shield,
					value: usersStats?.adminCount ?? '-',
					accentColor: 'var(--color-info)',
				},
				{
					label: 'Locked',
					icon: Lock,
					value: usersStats?.lockedCount ?? '-',
					accentColor: 'var(--color-warning)',
				},
			];
		}

		if (activeTab === 'audit') {
			return [
				{
					label: 'Total Events',
					icon: FileText,
					value: auditStats?.totalEvents ?? '-',
					accentColor: 'var(--accent-500)',
				},
				{
					label: 'Operations',
					icon: Activity,
					value: auditStats?.operations || '-',
					subtitle: 'Unique action types',
					accentColor: 'var(--color-info)',
				},
				{
					label: 'Tables Touched',
					icon: Hash,
					value: auditStats?.tables || '-',
					subtitle: 'Unique entities',
					accentColor: 'var(--color-warning)',
				},
			];
		}

		// settings tab
		return [
			{
				label: 'Session Timeout',
				icon: Timer,
				value: settingsStats ? `${settingsStats.sessionTimeout}m` : '-',
				accentColor: 'var(--accent-500)',
			},
			{
				label: 'Lockout Threshold',
				icon: KeyRound,
				value: settingsStats?.lockoutThreshold ?? '-',
				subtitle: 'Failed attempts',
				accentColor: 'var(--color-warning)',
			},
			{
				label: 'Fiscal Year',
				icon: Calendar,
				value: settingsStats ? `Month ${settingsStats.fiscalYear}` : '-',
				accentColor: 'var(--color-info)',
			},
			{
				label: 'Autosave Interval',
				icon: Clock,
				value: settingsStats ? `${settingsStats.autosaveInterval}s` : '-',
				accentColor: 'var(--color-success)',
			},
		];
	}, [activeTab, usersStats, auditStats, settingsStats]);

	return (
		<div className="flex h-full flex-col overflow-hidden p-6">
			<AdminPageHeader
				title="System"
				subtitle="User management, audit trail, and application settings"
			/>

			<div className="mt-4">
				<AdminKpiRibbon items={kpiItems} />
			</div>

			<div className="mt-4">
				<AdminTabBar
					tabs={TABS}
					activeTab={activeTab}
					onTabChange={(key) => setTab(key as TabKey)}
					ariaLabel="System sections"
				/>
			</div>

			<div
				role="tabpanel"
				id={`admin-panel-${activeTab}`}
				aria-labelledby={`admin-tab-${activeTab}`}
				className="mt-6 min-h-0 flex-1 overflow-y-auto"
			>
				{activeTab === 'users' && <UsersTabContent />}
				{activeTab === 'audit' && <AuditTabContent />}
				{activeTab === 'settings' && <SettingsTabContent />}
			</div>
		</div>
	);
}
