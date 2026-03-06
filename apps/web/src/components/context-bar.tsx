import { useWorkspaceContext } from '../hooks/use-workspace-context';
import { useVersions } from '../hooks/use-versions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

// Fiscal years available for selection — covers a rolling window around the current year.
const CURRENT_YEAR = new Date().getFullYear();
const FISCAL_YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 1 + i);

// Academic period options (tied to master-data AY structure)
const ACADEMIC_PERIODS = [
	{ value: 'AY1', label: 'Academic Year 1' },
	{ value: 'AY2', label: 'Academic Year 2' },
	{ value: 'SUMMER', label: 'Summer' },
	{ value: 'FULL', label: 'Full Year' },
] as const;

// Scenario dropdown is a UI stub — no backend support in v1.
const SCENARIOS = [
	{ value: 'BASE', label: 'Base Scenario' },
	{ value: 'OPTIMISTIC', label: 'Optimistic' },
	{ value: 'PESSIMISTIC', label: 'Pessimistic' },
] as const;

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
		// Clear version selection when FY changes — old version may not belong to new FY
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
			className="flex h-10 shrink-0 items-center gap-4 border-b border-gray-200 bg-white px-4"
		>
			{/* Fiscal Year */}
			<div className="flex items-center gap-2">
				<label
					htmlFor="ctx-fiscal-year"
					className="text-xs font-medium text-gray-500 whitespace-nowrap"
				>
					FY
				</label>
				<Select value={String(fiscalYear)} onValueChange={handleFiscalYearChange}>
					<SelectTrigger
						id="ctx-fiscal-year"
						aria-label="Fiscal year"
						className="h-7 w-28 text-xs border-gray-200"
					>
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
			</div>

			<div className="h-5 w-px bg-gray-200" aria-hidden="true" />

			{/* Version */}
			<div className="flex items-center gap-2">
				<label
					htmlFor="ctx-version"
					className="text-xs font-medium text-gray-500 whitespace-nowrap"
				>
					Version
				</label>
				<Select
					value={versionId !== null ? String(versionId) : '__none__'}
					onValueChange={handleVersionChange}
				>
					<SelectTrigger
						id="ctx-version"
						aria-label="Budget version"
						className="h-7 w-48 text-xs border-gray-200"
					>
						<SelectValue placeholder="Select version" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="__none__">None</SelectItem>
						{versions.map((v) => (
							<SelectItem key={v.id} value={String(v.id)}>
								{v.name}
								<span className="ml-1 text-gray-400">({v.status})</span>
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			<div className="h-5 w-px bg-gray-200" aria-hidden="true" />

			{/* Comparison Version */}
			<div className="flex items-center gap-2">
				<label
					htmlFor="ctx-compare"
					className="text-xs font-medium text-gray-500 whitespace-nowrap"
				>
					Compare
				</label>
				<Select
					value={comparisonVersionId !== null ? String(comparisonVersionId) : '__none__'}
					onValueChange={handleComparisonVersionChange}
				>
					<SelectTrigger
						id="ctx-compare"
						aria-label="Comparison version"
						className="h-7 w-48 text-xs border-gray-200"
					>
						<SelectValue placeholder="No comparison" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="__none__">None</SelectItem>
						{versions.map((v) => (
							<SelectItem key={v.id} value={String(v.id)}>
								{v.name}
								<span className="ml-1 text-gray-400">({v.status})</span>
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			<div className="h-5 w-px bg-gray-200" aria-hidden="true" />

			{/* Academic Period */}
			<div className="flex items-center gap-2">
				<label htmlFor="ctx-period" className="text-xs font-medium text-gray-500 whitespace-nowrap">
					Period
				</label>
				<Select
					value={academicPeriod ?? 'FULL'}
					onValueChange={(value) => setAcademicPeriod(value)}
				>
					<SelectTrigger
						id="ctx-period"
						aria-label="Academic period"
						className="h-7 w-36 text-xs border-gray-200"
					>
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
			</div>

			<div className="h-5 w-px bg-gray-200" aria-hidden="true" />

			{/* Scenario — UI stub, no backend */}
			<div className="flex items-center gap-2">
				<label
					htmlFor="ctx-scenario"
					className="text-xs font-medium text-gray-500 whitespace-nowrap"
				>
					Scenario
				</label>
				<Select
					value={scenarioId !== null ? String(scenarioId) : 'BASE'}
					onValueChange={(_value) => {
						// Stub: scenario is a UI-only control in v1 — no backend for scenario IDs yet.
						// The setScenario setter is wired and ready; the SCENARIOS list above uses
						// string keys (BASE / OPTIMISTIC / PESSIMISTIC) rather than numeric IDs.
						// When the backend ships scenario endpoints, replace this with:
						//   setScenario(Number(_value))
						void setScenario;
					}}
				>
					<SelectTrigger
						id="ctx-scenario"
						aria-label="Scenario"
						className="h-7 w-36 text-xs border-gray-200"
					>
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
			</div>
		</nav>
	);
}
