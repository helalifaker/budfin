import { useWorkspaceContext } from '../../hooks/use-workspace-context';
import { useVersions } from '../../hooks/use-versions';
import { getCurrentFiscalYear } from '../../lib/format-date';
import { cn } from '../../lib/cn';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

const CURRENT_YEAR = getCurrentFiscalYear();
const FISCAL_YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 1 + i);

const ACADEMIC_PERIODS = [
	{ value: 'both', label: 'Both Periods' },
	{ value: 'AY1', label: 'AY1 (Jan-Jun)' },
	{ value: 'AY2', label: 'AY2 (Sep-Dec)' },
] as const;

const SCENARIOS = [
	{ value: 'BASE', label: 'Base Scenario' },
	{ value: 'OPTIMISTIC', label: 'Optimistic' },
	{ value: 'PESSIMISTIC', label: 'Pessimistic' },
] as const;

const VERSION_TYPE_DOT: Record<string, string> = {
	Budget: 'bg-[var(--version-budget)]',
	Forecast: 'bg-[var(--version-forecast)]',
	Actual: 'bg-[var(--version-actual)]',
};

export function ContextBar() {
	const {
		fiscalYear,
		versionId,
		comparisonVersionId,
		academicPeriod,
		scenarioId,
		setFiscalYear,
		setVersion,
		setComparisonVersion,
		setAcademicPeriod,
		setScenario,
	} = useWorkspaceContext();

	const { data: versionsData } = useVersions(fiscalYear);
	const versions = versionsData?.data ?? [];

	function handleFiscalYearChange(value: string) {
		setFiscalYear(Number(value));
		setVersion(null);
		setComparisonVersion(null);
	}

	function handleVersionChange(value: string) {
		setVersion(value === '__none__' ? null : Number(value));
	}

	function handleComparisonVersionChange(value: string) {
		setComparisonVersion(value === '__none__' ? null : Number(value));
	}

	return (
		<nav
			aria-label="Planning context"
			className={cn(
				'flex h-14 shrink-0 items-center gap-3 px-4',
				'border-b border-[var(--workspace-border)]',
				'frosted-glass'
			)}
		>
			{/* Fiscal Year */}
			<SelectorGroup label="FY" htmlFor="ctx-fiscal-year">
				<Select value={String(fiscalYear)} onValueChange={handleFiscalYearChange}>
					<SelectTrigger id="ctx-fiscal-year" aria-label="Fiscal year" className="h-7 w-28 text-xs">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{FISCAL_YEARS.map((fy) => (
							<SelectItem key={fy} value={String(fy)}>
								{fy}/{fy + 1}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</SelectorGroup>

			<Divider />

			{/* Version */}
			<SelectorGroup label="Version" htmlFor="ctx-version">
				<Select
					value={versionId !== null ? String(versionId) : '__none__'}
					onValueChange={handleVersionChange}
				>
					<SelectTrigger id="ctx-version" aria-label="Budget version" className="h-7 w-48 text-xs">
						<SelectValue placeholder="Select version" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="__none__">None</SelectItem>
						{versions.map((v) => (
							<SelectItem key={v.id} value={String(v.id)}>
								<span className="inline-flex items-center gap-1.5">
									<span
										className={cn('h-1.5 w-1.5 rounded-full', VERSION_TYPE_DOT[v.type])}
										aria-hidden="true"
									/>
									{v.name}
									<span className="text-[var(--text-muted)]">({v.status})</span>
								</span>
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</SelectorGroup>

			<Divider />

			{/* Comparison */}
			<SelectorGroup label="Compare" htmlFor="ctx-compare">
				<Select
					value={comparisonVersionId !== null ? String(comparisonVersionId) : '__none__'}
					onValueChange={handleComparisonVersionChange}
				>
					<SelectTrigger
						id="ctx-compare"
						aria-label="Comparison version"
						className="h-7 w-48 text-xs"
					>
						<SelectValue placeholder="No comparison" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="__none__">None</SelectItem>
						{versions.map((v) => (
							<SelectItem key={v.id} value={String(v.id)}>
								<span className="inline-flex items-center gap-1.5">
									<span
										className={cn('h-1.5 w-1.5 rounded-full', VERSION_TYPE_DOT[v.type])}
										aria-hidden="true"
									/>
									{v.name}
									<span className="text-[var(--text-muted)]">({v.status})</span>
								</span>
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</SelectorGroup>

			<Divider />

			{/* Period */}
			<SelectorGroup label="Period" htmlFor="ctx-period">
				<Select
					value={academicPeriod ?? 'both'}
					onValueChange={(value) => setAcademicPeriod(value)}
				>
					<SelectTrigger id="ctx-period" aria-label="Academic period" className="h-7 w-36 text-xs">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{ACADEMIC_PERIODS.map((p) => (
							<SelectItem key={p.value} value={p.value}>
								{p.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</SelectorGroup>

			<Divider />

			{/* Scenario */}
			<SelectorGroup label="Scenario" htmlFor="ctx-scenario">
				<Select value={scenarioId ?? 'BASE'} onValueChange={(value) => setScenario(value)}>
					<SelectTrigger id="ctx-scenario" aria-label="Scenario" className="h-7 w-36 text-xs">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{SCENARIOS.map((s) => (
							<SelectItem key={s.value} value={s.value}>
								{s.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</SelectorGroup>
		</nav>
	);
}

function Divider() {
	return <div className="h-5 w-px bg-[var(--workspace-border)]" aria-hidden="true" />;
}

function SelectorGroup({
	label,
	htmlFor,
	children,
}: {
	label: string;
	htmlFor: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex items-center gap-2">
			<label
				htmlFor={htmlFor}
				className="text-[11px] font-medium text-[var(--text-muted)] whitespace-nowrap uppercase tracking-wide"
			>
				{label}
			</label>
			{children}
		</div>
	);
}
