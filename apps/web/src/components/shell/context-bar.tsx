import { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation } from 'react-router';
import { PanelRight, GitCompareArrows } from 'lucide-react';
import { useWorkspaceContext } from '../../hooks/use-workspace-context';
import { useVersions, type BudgetVersion } from '../../hooks/use-versions';
import { useRightPanelStore } from '../../stores/right-panel-store';
import { cn } from '../../lib/cn';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import { Breadcrumb } from './breadcrumb';
import { SaveIndicator } from './save-indicator';
import { StaleIndicator } from './stale-indicator';

const FISCAL_YEARS = Array.from({ length: 10 }, (_, i) => 2020 + i);

const ACADEMIC_PERIODS = [
	{ value: 'both', label: 'Full Year' },
	{ value: 'AY1', label: 'AY1' },
	{ value: 'AY2', label: 'AY2' },
	{ value: 'summer', label: 'Summer' },
] as const;

const SCENARIOS = [
	{ value: 'BASE', label: 'Base Scenario' },
	{ value: 'OPTIMISTIC', label: 'Optimistic' },
	{ value: 'PESSIMISTIC', label: 'Pessimistic' },
] as const;

const VERSION_TYPE_BORDER: Record<string, string> = {
	Budget: 'border-l-(--version-budget)',
	Forecast: 'border-l-(--version-forecast)',
	Actual: 'border-l-(--version-actual)',
};

const VERSION_TYPE_DOT: Record<string, string> = {
	Budget: 'bg-(--version-budget)',
	Forecast: 'bg-(--version-forecast)',
	Actual: 'bg-(--version-actual)',
};

const MODULE_LABELS: Record<string, string> = {
	'/planning/enrollment': 'Enrollment',
	'/planning/revenue': 'Revenue',
	'/planning/staffing': 'Staffing',
	'/planning/pnl': 'P&L',
	'/planning/scenarios': 'Scenarios',
	'/planning': 'Planning',
};

export function ContextBar() {
	const {
		fiscalYear,
		versionId,
		comparisonVersionId,
		academicPeriod,
		scenarioId,
		versionType,
		versionName,
		versionStaleModules,
		setFiscalYear,
		setVersion,
		setComparisonVersion,
		setAcademicPeriod,
		setScenario,
	} = useWorkspaceContext();

	const { data: versionsData } = useVersions(fiscalYear);
	const versions = useMemo(() => versionsData?.data ?? [], [versionsData?.data]);
	const location = useLocation();
	const togglePanel = useRightPanelStore((s) => s.toggle);
	const isPanelOpen = useRightPanelStore((s) => s.isOpen);

	const [showCompare, setShowCompare] = useState(comparisonVersionId !== null);
	const [glowKey, setGlowKey] = useState<string | null>(null);
	const glowTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

	// Smart FY change: auto-select first available version instead of clearing
	function handleFiscalYearChange(value: string) {
		const newFy = Number(value);
		setFiscalYear(newFy);
		setComparisonVersion(null);
		setShowCompare(false);
		// Version auto-selection handled by the effect below
	}

	// Auto-select first version when versions change and current versionId is not in the list
	useEffect(() => {
		if (versions.length === 0) {
			if (versionId !== null) {
				setVersion(null, undefined);
			}
			return;
		}

		const currentExists = versions.some((v) => v.id === versionId);
		if (!currentExists && versions[0]) {
			const first = versions[0];
			setVersion(first.id, {
				type: first.type,
				name: first.name,
				status: first.status,
				staleModules: first.staleModules,
			});
		}
	}, [versions, versionId, setVersion]);

	function handleVersionChange(value: string) {
		if (value === '__none__') {
			setVersion(null, undefined);
			return;
		}
		const selected = versions.find((v) => v.id === Number(value));
		if (selected) {
			setVersion(selected.id, {
				type: selected.type,
				name: selected.name,
				status: selected.status,
				staleModules: selected.staleModules,
			});
		}
		triggerGlow('version');
	}

	function handleComparisonVersionChange(value: string) {
		setComparisonVersion(value === '__none__' ? null : Number(value));
		triggerGlow('compare');
	}

	function triggerGlow(key: string) {
		setGlowKey(key);
		clearTimeout(glowTimerRef.current);
		glowTimerRef.current = setTimeout(() => setGlowKey(null), 600);
	}

	// Build breadcrumb items
	const moduleName = MODULE_LABELS[location.pathname] ?? 'Planning';
	const fyLabel = `FY${fiscalYear}/${fiscalYear + 1}`;
	const breadcrumbItems = [
		{ label: fyLabel },
		...(versionName ? [{ label: versionName }] : []),
		{ label: moduleName },
	];

	return (
		<nav
			aria-label="Planning context"
			className={cn(
				'grid h-16 shrink-0 items-center gap-4 px-4',
				'grid-cols-[auto_1fr_auto]',
				'border-b border-(--workspace-border)',
				'frosted-glass shadow-(--shadow-xs)',
				'animate-context-bar-enter'
			)}
		>
			{/* Left zone — Breadcrumb */}
			<div className="flex items-center min-w-0">
				<Breadcrumb items={breadcrumbItems} />
			</div>

			{/* Center zone — Selectors */}
			<div className="flex items-center justify-center gap-3">
				{/* Fiscal Year */}
				<SelectorGroup label="FY" htmlFor="ctx-fiscal-year">
					<Select value={String(fiscalYear)} onValueChange={handleFiscalYearChange}>
						<SelectTrigger
							id="ctx-fiscal-year"
							aria-label="Fiscal year"
							className={cn(
								'h-9 w-32 text-(--text-sm)',
								glowKey === 'fy' && 'animate-selector-glow'
							)}
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
				</SelectorGroup>

				<Divider />

				{/* Version (hero selector) */}
				<SelectorGroup label="Version" htmlFor="ctx-version">
					<Select
						value={versionId !== null ? String(versionId) : '__none__'}
						onValueChange={handleVersionChange}
					>
						<SelectTrigger
							id="ctx-version"
							aria-label="Budget version"
							className={cn(
								'h-10 w-60 text-(--text-sm) font-medium',
								'border-l-[3px]',
								versionType ? VERSION_TYPE_BORDER[versionType] : 'border-l-(--workspace-border)',
								glowKey === 'version' && 'animate-selector-glow'
							)}
						>
							<SelectValue placeholder="Select version" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="__none__">None</SelectItem>
							{versions.map((v) => (
								<SelectItem key={v.id} value={String(v.id)}>
									<VersionOption version={v} />
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</SelectorGroup>

				<Divider />

				{/* Comparison toggle + selector */}
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={() => {
							const next = !showCompare;
							setShowCompare(next);
							if (!next) setComparisonVersion(null);
						}}
						className={cn(
							'flex h-9 w-9 items-center justify-center rounded-(--radius-md)',
							'border border-(--workspace-border)',
							'transition-colors duration-(--duration-fast)',
							showCompare
								? 'bg-(--accent-50) text-(--accent-600) border-(--accent-200)'
								: 'text-(--text-muted) hover:text-(--text-secondary) hover:bg-(--workspace-bg-subtle)'
						)}
						aria-label="Toggle comparison version"
						aria-pressed={showCompare}
					>
						<GitCompareArrows className="h-4 w-4" />
					</button>
					{showCompare && (
						<div className="animate-expand-width">
							<Select
								value={comparisonVersionId !== null ? String(comparisonVersionId) : '__none__'}
								onValueChange={handleComparisonVersionChange}
							>
								<SelectTrigger
									id="ctx-compare"
									aria-label="Comparison version"
									className={cn(
										'h-9 w-48 text-(--text-sm)',
										glowKey === 'compare' && 'animate-selector-glow'
									)}
								>
									<SelectValue placeholder="Compare to..." />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="__none__">None</SelectItem>
									{versions
										.filter((v) => v.id !== versionId)
										.map((v) => (
											<SelectItem key={v.id} value={String(v.id)}>
												<VersionOption version={v} />
											</SelectItem>
										))}
								</SelectContent>
							</Select>
						</div>
					)}
				</div>

				<Divider />

				{/* Period — ToggleGroup */}
				<SelectorGroup label="Period" htmlFor="ctx-period">
					<ToggleGroup
						id="ctx-period"
						type="single"
						value={academicPeriod ?? 'both'}
						onValueChange={(value: string) => {
							if (value) setAcademicPeriod(value);
						}}
						aria-label="Academic period"
					>
						{ACADEMIC_PERIODS.map((p) => (
							<ToggleGroupItem key={p.value} value={p.value}>
								{p.label}
							</ToggleGroupItem>
						))}
					</ToggleGroup>
				</SelectorGroup>

				<Divider />

				{/* Scenario */}
				{versionType !== 'Actual' && (
					<SelectorGroup label="Scenario" htmlFor="ctx-scenario">
						<Select value={scenarioId ?? 'BASE'} onValueChange={(value) => setScenario(value)}>
							<SelectTrigger
								id="ctx-scenario"
								aria-label="Scenario"
								className="h-9 w-36 text-(--text-sm)"
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
					</SelectorGroup>
				)}
			</div>

			{/* Right zone — Status indicators + panel toggle */}
			<div className="flex items-center gap-3">
				<SaveIndicator status="idle" />
				{versionStaleModules.length > 0 && (
					<div className="animate-stale-pulse">
						<StaleIndicator staleModules={versionStaleModules} />
					</div>
				)}
				<button
					type="button"
					onClick={togglePanel}
					className={cn(
						'flex h-9 w-9 items-center justify-center rounded-(--radius-md)',
						'border border-(--workspace-border)',
						'transition-colors duration-(--duration-fast)',
						isPanelOpen
							? 'bg-(--accent-50) text-(--accent-600) border-(--accent-200)'
							: 'text-(--text-muted) hover:text-(--text-secondary) hover:bg-(--workspace-bg-subtle)'
					)}
					aria-label={isPanelOpen ? 'Close details panel' : 'Open details panel'}
					aria-pressed={isPanelOpen}
				>
					<PanelRight className="h-4 w-4" />
				</button>
			</div>
		</nav>
	);
}

function Divider() {
	return <div className="h-6 w-px bg-(--workspace-border)" aria-hidden="true" />;
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
				className={cn(
					'text-[11px] font-semibold uppercase tracking-wider',
					'text-(--text-muted) whitespace-nowrap'
				)}
			>
				{label}
			</label>
			{children}
		</div>
	);
}

function VersionOption({ version }: { version: BudgetVersion }) {
	return (
		<span className="inline-flex items-center gap-1.5">
			<span
				className={cn('h-2 w-2 rounded-full', VERSION_TYPE_DOT[version.type])}
				aria-hidden="true"
			/>
			{version.name}
			<span className="text-(--text-muted)">({version.status})</span>
		</span>
	);
}
