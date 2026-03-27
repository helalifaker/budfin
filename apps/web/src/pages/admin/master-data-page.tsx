import { useMemo } from 'react';
import {
	BookOpen,
	CalendarDays,
	CheckCircle,
	DollarSign,
	Flag,
	GraduationCap,
	Layers,
	ListTree,
	Receipt,
	TrendingDown,
	TrendingUp,
	Building,
} from 'lucide-react';
import { useAdminTab } from '../../hooks/use-admin-tab';
import { AdminPageHeader } from '../../components/admin/admin-page-header';
import { AdminTabBar } from '../../components/admin/admin-tab-bar';
import { AdminKpiRibbon } from '../../components/admin/admin-kpi-ribbon';
import type { AdminKpiItem } from '../../components/admin/admin-kpi-ribbon';
import { AccountsTabContent } from '../../components/admin/tabs/accounts-tab-content';
import { AcademicYearsTabContent } from '../../components/admin/tabs/academic-years-tab-content';
import { GradesTabContent } from '../../components/admin/tabs/grades-tab-content';
import { NationalitiesTabContent } from '../../components/admin/tabs/nationalities-tab-content';
import { TariffsTabContent } from '../../components/admin/tabs/tariffs-tab-content';
import { DepartmentsTabContent } from '../../components/admin/tabs/departments-tab-content';
import { CurriculumTabContent } from '../../components/master-data/curriculum-tab-content';
import { useAccounts } from '../../hooks/use-accounts';
import { useAcademicYears } from '../../hooks/use-academic-years';
import { useGradeLevels } from '../../hooks/use-grade-levels';
import { useNationalities, useTariffs, useDepartments } from '../../hooks/use-reference-data';
import { useAuthStore } from '../../stores/auth-store';

const VALID_TABS = [
	'accounts',
	'academic',
	'grades',
	'nationalities',
	'tariffs',
	'departments',
	'curriculum',
] as const;
type TabKey = (typeof VALID_TABS)[number];

const TABS = [
	{ key: 'accounts', label: 'Accounts' },
	{ key: 'academic', label: 'Academic Years' },
	{ key: 'grades', label: 'Grades' },
	{ key: 'nationalities', label: 'Nationalities' },
	{ key: 'tariffs', label: 'Tariffs' },
	{ key: 'departments', label: 'Departments' },
	{ key: 'curriculum', label: 'Curriculum' },
] as const;

export function MasterDataPage() {
	const [tab, setTab] = useAdminTab<TabKey>('accounts', VALID_TABS);

	const currentUser = useAuthStore((s) => s.user);
	const isAdmin = currentUser?.role === 'Admin';

	// --- KPI data sources ---
	const { data: accountsData } = useAccounts();
	const { data: ayData } = useAcademicYears();
	const { data: glData } = useGradeLevels();
	const { data: nationalities = [] } = useNationalities();
	const { data: tariffs = [] } = useTariffs();
	const { data: departments = [] } = useDepartments();

	// --- Per-tab KPI items ---

	const accountsKpis = useMemo<AdminKpiItem[]>(() => {
		const all = accountsData?.accounts ?? [];
		const total = all.length;
		const active = all.filter((a) => a.status === 'ACTIVE').length;
		const revenue = all.filter((a) => a.type === 'REVENUE').length;
		const expense = all.filter((a) => a.type === 'EXPENSE').length;

		return [
			{
				label: 'Total Accounts',
				icon: BookOpen,
				value: total,
				subtitle: 'All account codes',
				accentColor: 'var(--accent-500)',
			},
			{
				label: 'Active',
				icon: CheckCircle,
				value: active,
				subtitle: 'Currently active',
				accentColor: 'var(--color-success)',
			},
			{
				label: 'Revenue',
				icon: TrendingUp,
				value: revenue,
				subtitle: 'Revenue accounts',
				accentColor: 'var(--badge-revenue)',
			},
			{
				label: 'Expense',
				icon: TrendingDown,
				value: expense,
				subtitle: 'Expense accounts',
				accentColor: 'var(--badge-expense)',
			},
		];
	}, [accountsData]);

	const academicKpis = useMemo<AdminKpiItem[]>(() => {
		const all = ayData?.academicYears ?? [];
		const total = all.length;
		const latestYear = all.length > 0 ? (all[all.length - 1]?.fiscalYear ?? '-') : '-';

		return [
			{
				label: 'Total Years',
				icon: CalendarDays,
				value: total,
				subtitle: 'Academic years defined',
				accentColor: 'var(--accent-500)',
			},
			{
				label: 'Latest Year',
				icon: CalendarDays,
				value: latestYear,
				subtitle: 'Most recent entry',
				accentColor: 'var(--accent-600)',
			},
		];
	}, [ayData]);

	const gradesKpis = useMemo<AdminKpiItem[]>(() => {
		const all = glData?.gradeLevels ?? [];
		const total = all.length;
		const bands = new Set(all.map((g) => g.band)).size;

		return [
			{
				label: 'Total Grades',
				icon: GraduationCap,
				value: total,
				subtitle: 'Grade levels defined',
				accentColor: 'var(--accent-500)',
			},
			{
				label: 'Bands',
				icon: Layers,
				value: bands,
				subtitle: 'Distinct grade bands',
				accentColor: 'var(--accent-600)',
			},
		];
	}, [glData]);

	const nationalitiesKpis = useMemo<AdminKpiItem[]>(() => {
		const total = nationalities.length;
		const vatExempt = nationalities.filter((n) => n.vatExempt).length;

		return [
			{
				label: 'Total Nationalities',
				icon: Flag,
				value: total,
				subtitle: 'Nationality codes',
				accentColor: 'var(--accent-500)',
			},
			{
				label: 'VAT Exempt',
				icon: DollarSign,
				value: vatExempt,
				subtitle: 'Exempt from VAT',
				accentColor: 'var(--color-success)',
			},
		];
	}, [nationalities]);

	const tariffsKpis = useMemo<AdminKpiItem[]>(() => {
		const total = tariffs.length;

		return [
			{
				label: 'Total Tariffs',
				icon: Receipt,
				value: total,
				subtitle: 'Fee tariff codes',
				accentColor: 'var(--accent-500)',
			},
		];
	}, [tariffs]);

	const departmentsKpis = useMemo<AdminKpiItem[]>(() => {
		const total = departments.length;
		const academic = departments.filter((d) => d.bandMapping !== 'NON_ACADEMIC').length;

		return [
			{
				label: 'Total Departments',
				icon: Building,
				value: total,
				subtitle: 'Department codes',
				accentColor: 'var(--accent-500)',
			},
			{
				label: 'Academic',
				icon: ListTree,
				value: academic,
				subtitle: 'Mapped to grade bands',
				accentColor: 'var(--accent-600)',
			},
		];
	}, [departments]);

	const curriculumKpis = useMemo<AdminKpiItem[]>(() => {
		// Curriculum tab has its own KPI ribbon internally; return empty
		return [];
	}, []);

	const kpiMap: Record<TabKey, AdminKpiItem[]> = useMemo(
		() => ({
			accounts: accountsKpis,
			academic: academicKpis,
			grades: gradesKpis,
			nationalities: nationalitiesKpis,
			tariffs: tariffsKpis,
			departments: departmentsKpis,
			curriculum: curriculumKpis,
		}),
		[
			accountsKpis,
			academicKpis,
			gradesKpis,
			nationalitiesKpis,
			tariffsKpis,
			departmentsKpis,
			curriculumKpis,
		]
	);

	return (
		<div className="p-6 space-y-4">
			<AdminPageHeader
				title="Master Data"
				subtitle="Reference data used across all planning modules"
			/>
			<AdminTabBar
				tabs={TABS}
				activeTab={tab}
				onTabChange={(key) => setTab(key as TabKey)}
				ariaLabel="Master data categories"
			/>
			<AdminKpiRibbon items={kpiMap[tab]} />
			<div role="tabpanel" id={`admin-panel-${tab}`} aria-labelledby={`admin-tab-${tab}`}>
				{tab === 'accounts' && <AccountsTabContent />}
				{tab === 'academic' && <AcademicYearsTabContent />}
				{tab === 'grades' && <GradesTabContent />}
				{tab === 'nationalities' && <NationalitiesTabContent />}
				{tab === 'tariffs' && <TariffsTabContent />}
				{tab === 'departments' && <DepartmentsTabContent />}
				{tab === 'curriculum' && <CurriculumTabContent isAdmin={isAdmin} />}
			</div>
		</div>
	);
}
