import { useMemo } from 'react';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { cn } from '../../lib/cn';
import { formatMoney } from '../../lib/format-money';
import { registerPanelContent } from '../../lib/right-panel-registry';
import { useStaffingSelectionStore } from '../../stores/staffing-selection-store';
import { useWorkspaceContext } from '../../hooks/use-workspace-context';
import {
	useTeachingRequirements,
	useTeachingRequirementSources,
	useStaffingAssignments,
	useEmployees,
	useEmployee,
	type Employee,
} from '../../hooks/use-staffing';

// ── Band badge styles ────────────────────────────────────────────────────────

const BAND_BADGE_STYLES: Record<string, string> = {
	MATERNELLE: 'bg-(--badge-maternelle-bg) text-(--badge-maternelle)',
	ELEMENTAIRE: 'bg-(--badge-elementaire-bg) text-(--badge-elementaire)',
	COLLEGE: 'bg-(--badge-college-bg) text-(--badge-college)',
	LYCEE: 'bg-(--badge-lycee-bg) text-(--badge-lycee)',
};

const BAND_LABELS: Record<string, string> = {
	MATERNELLE: 'Maternelle',
	ELEMENTAIRE: 'Elementaire',
	COLLEGE: 'College',
	LYCEE: 'Lycee',
};

const COVERAGE_STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
	COVERED: { bg: 'bg-(--color-success-bg)', text: 'text-(--color-success)', label: 'Covered' },
	DEFICIT: { bg: 'bg-(--color-error-bg)', text: 'text-(--color-error)', label: 'Deficit' },
	SURPLUS: { bg: 'bg-(--color-warning-bg)', text: 'text-(--color-warning)', label: 'Surplus' },
	UNCOVERED: { bg: 'bg-(--color-error-bg)', text: 'text-(--color-error)', label: 'Uncovered' },
};

const COST_MODE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
	LOCAL_PAYROLL: {
		bg: 'bg-(--accent-50)',
		text: 'text-(--accent-700)',
		label: 'LOCAL',
	},
	RECHARGE: {
		bg: 'bg-(--color-warning-bg)',
		text: 'text-(--color-warning)',
		label: 'RECHARGE',
	},
	NO_COST: {
		bg: 'bg-(--workspace-bg-muted)',
		text: 'text-(--text-muted)',
		label: 'NO_COST',
	},
};

// ── Default view ─────────────────────────────────────────────────────────────

function InspectorDefaultView() {
	const { versionId } = useWorkspaceContext();
	const { data: reqData } = useTeachingRequirements(versionId);

	const totals = reqData?.totals;
	const lines = useMemo(() => reqData?.data ?? [], [reqData?.data]);

	const coverageDist = useMemo(() => {
		const dist = { covered: 0, deficit: 0, surplus: 0, uncovered: 0 };
		for (const line of lines) {
			const status = line.coverageStatus.toLowerCase() as keyof typeof dist;
			if (status in dist) {
				dist[status]++;
			}
		}
		return dist;
	}, [lines]);

	const bandSummary = useMemo(() => {
		const bands = new Map<string, { count: number; fteRaw: number; covered: number }>();
		for (const line of lines) {
			const existing = bands.get(line.band) ?? { count: 0, fteRaw: 0, covered: 0 };
			existing.count++;
			existing.fteRaw += parseFloat(line.requiredFteRaw);
			existing.covered += parseFloat(line.coveredFte);
			bands.set(line.band, existing);
		}
		return Array.from(bands.entries()).map(([band, data]) => ({
			band,
			label: BAND_LABELS[band] ?? band,
			...data,
		}));
	}, [lines]);

	return (
		<div className="space-y-5">
			{/* Workflow status card */}
			<div
				className={cn(
					'rounded-xl border border-(--workspace-border) bg-(--workspace-bg-card) px-4 py-4',
					'border-l-[3px] border-l-(--accent-500)'
				)}
			>
				<div className="flex items-start gap-3">
					<span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-(--accent-50)">
						<ShieldCheck className="h-4 w-4 text-(--accent-700)" aria-hidden="true" />
					</span>
					<div className="space-y-1">
						<p className="text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
							Staffing workflow
						</p>
						<p className="text-sm text-(--text-secondary)">
							Review teaching requirements and coverage, then assign teachers to fill gaps.
						</p>
					</div>
				</div>
			</div>

			{/* Quick stats */}
			<div className="grid gap-3 md:grid-cols-2">
				<div className="rounded-xl border border-(--workspace-border) bg-(--workspace-bg-card) px-4 py-3">
					<p className="text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
						Total FTE required
					</p>
					<p className="mt-2 text-xl font-semibold text-(--text-primary)">
						{totals?.totalFteRaw ?? '0'}
					</p>
				</div>
				<div className="rounded-xl border border-(--workspace-border) bg-(--workspace-bg-card) px-4 py-3">
					<p className="text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
						Total FTE covered
					</p>
					<p className="mt-2 text-xl font-semibold text-(--text-primary)">
						{totals?.totalFteCovered ?? '0'}
					</p>
				</div>
			</div>

			{/* Coverage distribution */}
			<div>
				<h4 className="mb-2 text-(--text-xs) font-semibold uppercase tracking-[0.06em] text-(--text-muted)">
					Coverage distribution
				</h4>
				<div className="overflow-hidden rounded-lg border border-(--workspace-border)">
					<div className="divide-y divide-(--workspace-border)">
						{Object.entries(coverageDist).map(([status, count]) => (
							<div key={status} className="flex items-center justify-between px-3 py-2">
								<span className="text-sm capitalize text-(--text-secondary)">{status}</span>
								<span className="font-[family-name:var(--font-mono)] text-sm tabular-nums text-(--text-primary)">
									{count}
								</span>
							</div>
						))}
					</div>
				</div>
			</div>

			{/* Recommended actions */}
			<div>
				<h4 className="mb-2 text-(--text-xs) font-semibold uppercase tracking-[0.06em] text-(--text-muted)">
					Recommended actions
				</h4>
				<div className="rounded-lg border border-(--workspace-border) bg-(--workspace-bg-card) p-3">
					{coverageDist.deficit > 0 || coverageDist.uncovered > 0 ? (
						<p className="text-sm text-(--text-secondary)">
							{coverageDist.deficit + coverageDist.uncovered} requirement lines need teacher
							assignments. Use Auto-Suggest or assign manually.
						</p>
					) : (
						<p className="text-sm text-(--text-muted)">
							All requirement lines are covered. No immediate action needed.
						</p>
					)}
				</div>
			</div>

			{/* Band summary */}
			<div>
				<h4 className="mb-2 text-(--text-xs) font-semibold uppercase tracking-[0.06em] text-(--text-muted)">
					Summary by band
				</h4>
				<div className="overflow-hidden rounded-lg border border-(--workspace-border)">
					<table className="w-full text-sm">
						<thead>
							<tr className="bg-(--workspace-bg-muted)">
								<th className="px-3 py-1.5 text-left text-(--text-xs) font-medium uppercase tracking-wider text-(--text-muted)">
									Band
								</th>
								<th className="px-3 py-1.5 text-right text-(--text-xs) font-medium uppercase tracking-wider text-(--text-muted)">
									Lines
								</th>
								<th className="px-3 py-1.5 text-right text-(--text-xs) font-medium uppercase tracking-wider text-(--text-muted)">
									FTE
								</th>
							</tr>
						</thead>
						<tbody>
							{bandSummary.map((row) => (
								<tr key={row.band} className="border-t border-(--workspace-border)">
									<td className="px-3 py-1.5 font-medium">{row.label}</td>
									<td className="px-3 py-1.5 text-right font-[family-name:var(--font-mono)] tabular-nums">
										{row.count}
									</td>
									<td className="px-3 py-1.5 text-right font-[family-name:var(--font-mono)] tabular-nums">
										{row.fteRaw.toFixed(2)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}

// ── Requirement line view ────────────────────────────────────────────────────

function InspectorRequirementView({
	requirementLineId,
	band,
}: {
	requirementLineId: number;
	band: string;
}) {
	const { versionId } = useWorkspaceContext();
	const clearSelection = useStaffingSelectionStore((state) => state.clearSelection);
	const { data: reqData } = useTeachingRequirements(versionId);
	const { data: sourcesData } = useTeachingRequirementSources(versionId, requirementLineId);
	const { data: assignmentsData } = useStaffingAssignments(versionId);
	const { data: employeesData } = useEmployees(versionId);

	const line = useMemo(
		() => reqData?.data.find((l) => l.id === requirementLineId) ?? null,
		[reqData?.data, requirementLineId]
	);

	const lineAssignments = useMemo(
		() => (assignmentsData?.data ?? []).filter((a) => a.requirementLineId === requirementLineId),
		[assignmentsData?.data, requirementLineId]
	);

	const employeeMap = useMemo(() => {
		const map = new Map<number, Employee>();
		for (const emp of employeesData?.data ?? []) {
			map.set(emp.id, emp);
		}
		return map;
	}, [employeesData?.data]);

	if (!line) return null;

	const sources = sourcesData?.data ?? [];
	const defaultCoverageStyle = {
		bg: 'bg-(--color-success-bg)',
		text: 'text-(--color-success)',
		label: 'Covered',
	};
	const coverageStyle = COVERAGE_STATUS_STYLES[line.coverageStatus] ?? defaultCoverageStyle;
	const bandLabel = BAND_LABELS[band] ?? band;
	const bandBadgeStyle = BAND_BADGE_STYLES[band] ?? '';

	const gapValue = parseFloat(line.gapFte);
	const directCost = parseFloat(line.directCostAnnual);
	const hsaCost = parseFloat(line.hsaCostAnnual);
	const totalCost = directCost + hsaCost;

	return (
		<div className="space-y-4">
			{/* Header with back button */}
			<div className="flex items-center gap-2">
				<button
					type="button"
					onClick={clearSelection}
					className={cn(
						'rounded-md p-1 text-(--text-muted) transition-colors duration-(--duration-fast)',
						'hover:bg-(--workspace-bg-muted) hover:text-(--text-primary)'
					)}
					aria-label="Back to overview"
				>
					<ArrowLeft className="h-4 w-4" />
				</button>
				<span
					className={cn('rounded-sm px-1.5 py-0.5 text-(--text-xs) font-medium', bandBadgeStyle)}
				>
					{bandLabel}
				</span>
				<h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-(--text-primary)">
					{line.lineLabel}
				</h3>
				<span
					className={cn(
						'rounded-full px-2 py-0.5 text-(--text-xs) font-semibold',
						coverageStyle.bg,
						coverageStyle.text
					)}
				>
					{coverageStyle.label}
				</span>
			</div>

			{/* Driver Breakdown table */}
			<div>
				<h4 className="mb-2 text-(--text-xs) font-semibold uppercase tracking-[0.06em] text-(--text-muted)">
					Driver breakdown
				</h4>
				<div className="overflow-hidden rounded-lg border border-(--workspace-border)">
					<table className="w-full text-sm">
						<thead>
							<tr className="bg-(--workspace-bg-muted)">
								<th className="px-3 py-1.5 text-left text-(--text-xs) font-medium uppercase tracking-wider text-(--text-muted)">
									Grade
								</th>
								<th className="px-3 py-1.5 text-right text-(--text-xs) font-medium uppercase tracking-wider text-(--text-muted)">
									Headcount
								</th>
								<th className="px-3 py-1.5 text-right text-(--text-xs) font-medium uppercase tracking-wider text-(--text-muted)">
									Sections
								</th>
								<th className="px-3 py-1.5 text-right text-(--text-xs) font-medium uppercase tracking-wider text-(--text-muted)">
									Hrs/unit
								</th>
								<th className="px-3 py-1.5 text-right text-(--text-xs) font-medium uppercase tracking-wider text-(--text-muted)">
									Total Hrs/w
								</th>
							</tr>
						</thead>
						<tbody>
							{sources.map((src) => (
								<tr key={src.gradeLevel} className="border-t border-(--workspace-border)">
									<td className="px-3 py-1.5 font-medium">{src.gradeLevel}</td>
									<td className="px-3 py-1.5 text-right font-[family-name:var(--font-mono)] tabular-nums">
										{src.headcount}
									</td>
									<td className="px-3 py-1.5 text-right font-[family-name:var(--font-mono)] tabular-nums">
										{src.sections}
									</td>
									<td className="px-3 py-1.5 text-right font-[family-name:var(--font-mono)] tabular-nums">
										{src.hoursPerUnit}
									</td>
									<td className="px-3 py-1.5 text-right font-[family-name:var(--font-mono)] tabular-nums">
										{src.totalWeeklyHours}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>

			{/* Assigned Teachers list */}
			<div>
				<h4 className="mb-2 text-(--text-xs) font-semibold uppercase tracking-[0.06em] text-(--text-muted)">
					Assigned teachers
				</h4>
				<div className="space-y-2">
					{lineAssignments.map((assignment) => {
						const emp = employeeMap.get(assignment.employeeId);
						const defaultCostMode = {
							bg: 'bg-(--accent-50)',
							text: 'text-(--accent-700)',
							label: 'LOCAL',
						};
						const costModeStyle =
							COST_MODE_STYLES[emp?.costMode ?? 'LOCAL_PAYROLL'] ?? defaultCostMode;

						return (
							<div
								key={assignment.id}
								className="flex items-center justify-between rounded-lg border border-(--workspace-border) bg-(--workspace-bg-card) px-3 py-2"
							>
								<div className="flex items-center gap-2">
									<span className="text-sm font-medium text-(--text-primary)">
										{emp?.name ?? `Employee #${assignment.employeeId}`}
									</span>
									<span
										className={cn(
											'rounded-sm px-1.5 py-0.5 text-(--text-xs) font-medium',
											costModeStyle.bg,
											costModeStyle.text
										)}
									>
										{costModeStyle.label}
									</span>
								</div>
								<span className="font-[family-name:var(--font-mono)] text-sm tabular-nums text-(--text-secondary)">
									{assignment.fteShare}
								</span>
							</div>
						);
					})}
					{lineAssignments.length === 0 && (
						<p className="text-sm text-(--text-muted)">No teachers assigned yet.</p>
					)}
				</div>
			</div>

			{/* Gap Analysis card */}
			<div>
				<h4 className="mb-2 text-(--text-xs) font-semibold uppercase tracking-[0.06em] text-(--text-muted)">
					Gap analysis
				</h4>
				<div className="space-y-2 rounded-lg border border-(--workspace-border) bg-(--workspace-bg-card) p-3">
					<div className="flex items-center justify-between">
						<span className="text-sm text-(--text-secondary)">Raw need</span>
						<span className="font-[family-name:var(--font-mono)] text-sm tabular-nums text-(--text-primary)">
							{line.requiredFteRaw}
						</span>
					</div>
					<div className="flex items-center justify-between">
						<span className="text-sm text-(--text-secondary)">Planned need</span>
						<span className="font-[family-name:var(--font-mono)] text-sm tabular-nums text-(--text-primary)">
							{line.requiredFtePlanned}
						</span>
					</div>
					<div className="flex items-center justify-between">
						<span className="text-sm text-(--text-secondary)">Covered</span>
						<span className="font-[family-name:var(--font-mono)] text-sm tabular-nums text-(--text-primary)">
							{line.coveredFte}
						</span>
					</div>
					<div className="flex items-center justify-between">
						<span className="text-sm text-(--text-secondary)">Gap</span>
						<span
							className={cn(
								'font-[family-name:var(--font-mono)] text-sm tabular-nums font-semibold',
								gapValue < 0 && 'text-(--color-error)',
								gapValue > 0 && 'text-(--color-warning)',
								gapValue === 0 && 'text-(--color-success)'
							)}
						>
							{line.gapFte}
						</span>
					</div>
					{gapValue < 0 && (
						<p className="mt-1 text-(--text-xs) text-(--text-muted)">
							Hiring recommendation: {Math.ceil(Math.abs(gapValue))} additional position(s)
						</p>
					)}
				</div>
			</div>

			{/* Cost Split card */}
			<div>
				<h4 className="mb-2 text-(--text-xs) font-semibold uppercase tracking-[0.06em] text-(--text-muted)">
					Cost split
				</h4>
				<div className="space-y-2 rounded-lg border border-(--workspace-border) bg-(--workspace-bg-card) p-3">
					<div className="flex items-center justify-between">
						<span className="text-sm text-(--text-secondary)">Direct payroll</span>
						<span className="font-[family-name:var(--font-mono)] text-sm tabular-nums text-(--text-primary)">
							{formatMoney(directCost, { showCurrency: true })}
						</span>
					</div>
					<div className="flex items-center justify-between">
						<span className="text-sm text-(--text-secondary)">HSA cost</span>
						<span className="font-[family-name:var(--font-mono)] text-sm tabular-nums text-(--text-primary)">
							{formatMoney(hsaCost, { showCurrency: true })}
						</span>
					</div>
					<div className="flex items-center justify-between border-t border-(--workspace-border) pt-2">
						<span className="text-sm font-semibold text-(--text-primary)">Total loaded cost</span>
						<span className="font-[family-name:var(--font-mono)] text-sm tabular-nums font-semibold text-(--text-primary)">
							{formatMoney(totalCost, { showCurrency: true })}
						</span>
					</div>
				</div>
			</div>
		</div>
	);
}

// ── Support employee view ────────────────────────────────────────────────────

function InspectorSupportView({ employeeId }: { employeeId: number }) {
	const { versionId } = useWorkspaceContext();
	const clearSelection = useStaffingSelectionStore((state) => state.clearSelection);
	const { data: empData } = useEmployee(versionId, employeeId);

	if (!empData) return null;

	return (
		<div className="space-y-4">
			{/* Header with back button */}
			<div className="flex items-center gap-2">
				<button
					type="button"
					onClick={clearSelection}
					className={cn(
						'rounded-md p-1 text-(--text-muted) transition-colors duration-(--duration-fast)',
						'hover:bg-(--workspace-bg-muted) hover:text-(--text-primary)'
					)}
					aria-label="Back to overview"
				>
					<ArrowLeft className="h-4 w-4" />
				</button>
				<h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-(--text-primary)">
					{empData.name}
				</h3>
			</div>

			{/* Employment details */}
			<div>
				<h4 className="mb-2 text-(--text-xs) font-semibold uppercase tracking-[0.06em] text-(--text-muted)">
					Employment details
				</h4>
				<div className="space-y-2 rounded-lg border border-(--workspace-border) bg-(--workspace-bg-card) p-3">
					<div className="flex items-center justify-between">
						<span className="text-sm text-(--text-secondary)">Role</span>
						<span className="text-sm text-(--text-primary)">{empData.functionRole}</span>
					</div>
					<div className="flex items-center justify-between">
						<span className="text-sm text-(--text-secondary)">Department</span>
						<span className="text-sm text-(--text-primary)">{empData.department}</span>
					</div>
					<div className="flex items-center justify-between">
						<span className="text-sm text-(--text-secondary)">Status</span>
						<span className="text-sm text-(--text-primary)">{empData.status}</span>
					</div>
					{empData.joiningDate && (
						<div className="flex items-center justify-between">
							<span className="text-sm text-(--text-secondary)">Joining date</span>
							<span className="text-sm text-(--text-primary)">{empData.joiningDate}</span>
						</div>
					)}
				</div>
			</div>

			{/* Cost summary */}
			<div>
				<h4 className="mb-2 text-(--text-xs) font-semibold uppercase tracking-[0.06em] text-(--text-muted)">
					Cost summary
				</h4>
				<div className="space-y-2 rounded-lg border border-(--workspace-border) bg-(--workspace-bg-card) p-3">
					{empData.monthlyCost && (
						<div className="flex items-center justify-between">
							<span className="text-sm text-(--text-secondary)">Monthly cost</span>
							<span className="font-[family-name:var(--font-mono)] text-sm tabular-nums text-(--text-primary)">
								{formatMoney(empData.monthlyCost, { showCurrency: true })}
							</span>
						</div>
					)}
					{empData.annualCost && (
						<div className="flex items-center justify-between">
							<span className="text-sm text-(--text-secondary)">Annual cost</span>
							<span className="font-[family-name:var(--font-mono)] text-sm tabular-nums text-(--text-primary)">
								{formatMoney(empData.annualCost, { showCurrency: true })}
							</span>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

// ── Main inspector content ───────────────────────────────────────────────────

export function StaffingInspectorContent() {
	const selection = useStaffingSelectionStore((state) => state.selection);

	if (selection?.type === 'REQUIREMENT_LINE') {
		return (
			<div key={selection.requirementLineId} className="animate-inspector-slide-in">
				<InspectorRequirementView
					requirementLineId={selection.requirementLineId}
					band={selection.band}
				/>
			</div>
		);
	}

	if (selection?.type === 'SUPPORT_EMPLOYEE') {
		return (
			<div key={selection.employeeId} className="animate-inspector-slide-in">
				<InspectorSupportView employeeId={selection.employeeId} />
			</div>
		);
	}

	return (
		<div className="animate-inspector-crossfade">
			<InspectorDefaultView />
		</div>
	);
}

// Register panel content at module level (side-effect import)
registerPanelContent('staffing', StaffingInspectorContent);
