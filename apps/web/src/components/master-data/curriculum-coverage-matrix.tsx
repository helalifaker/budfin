import { useMemo } from 'react';
import { cn } from '../../lib/cn';
import type { DhgRuleDetail } from '../../hooks/use-master-data';
import type { GradeLevel } from '../../hooks/use-grade-levels';
import type { CoverageGap } from '../../lib/curriculum-coverage-map';
import { DISCIPLINE_DISPLAY_GROUPS, isExpectedCell } from '../../lib/curriculum-coverage-map';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '../ui/tooltip';

// ── Band color mapping ──────────────────────────────────────────────────────

const BAND_HEADER_STYLES: Record<string, string> = {
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

// ── Types ────────────────────────────────────────────────────────────────────

type DisciplineRow = {
	code: string;
	name: string;
	disciplineId: number | null;
};

type BandGroup = {
	band: string;
	grades: GradeLevel[];
};

export type CurriculumCoverageMatrixProps = {
	rules: DhgRuleDetail[];
	gradeLevels: GradeLevel[];
	ruleIndex: Map<string, DhgRuleDetail[]>;
	gaps: CoverageGap[];
	isAdmin: boolean;
	onCellClick: (gradeCode: string, disciplineCode: string, rule?: DhgRuleDetail) => void;
};

// ── Component ────────────────────────────────────────────────────────────────

export function CurriculumCoverageMatrix({
	rules,
	gradeLevels,
	ruleIndex,
	gaps,
	isAdmin,
	onCellClick,
}: CurriculumCoverageMatrixProps) {
	// Group grade levels by band, sorted by displayOrder
	const bandGroups = useMemo(() => {
		const order = ['MATERNELLE', 'ELEMENTAIRE', 'COLLEGE', 'LYCEE'];
		const grouped = new Map<string, GradeLevel[]>();
		for (const gl of gradeLevels) {
			const list = grouped.get(gl.band) ?? [];
			list.push(gl);
			grouped.set(gl.band, list);
		}
		return order
			.filter((b) => grouped.has(b))
			.map(
				(band): BandGroup => ({
					band,
					grades: grouped.get(band)!.sort((a, b) => a.displayOrder - b.displayOrder),
				})
			);
	}, [gradeLevels]);

	// All grade codes in display order
	const allGrades = useMemo(() => bandGroups.flatMap((bg) => bg.grades), [bandGroups]);

	// Build gap lookup set for fast checking
	const gapKeys = useMemo(() => {
		const set = new Set<string>();
		for (const gap of gaps) {
			set.add(`${gap.gradeCode}::${gap.disciplineCode}`);
		}
		return set;
	}, [gaps]);

	// Build discipline rows grouped by display group
	// Resolve discipline names from rules or use code as fallback
	const disciplineNameMap = useMemo(() => {
		const map = new Map<string, { name: string; id: number }>();
		for (const rule of rules) {
			if (!map.has(rule.disciplineCode)) {
				map.set(rule.disciplineCode, {
					name: rule.disciplineName,
					id: rule.disciplineId,
				});
			}
		}
		return map;
	}, [rules]);

	const displayGroups = useMemo(() => {
		return DISCIPLINE_DISPLAY_GROUPS.map((group) => ({
			...group,
			disciplines: group.disciplineCodes.map((code): DisciplineRow => {
				const info = disciplineNameMap.get(code);
				return {
					code,
					name: info?.name ?? code.replace(/_/g, ' '),
					disciplineId: info?.id ?? null,
				};
			}),
		}));
	}, [disciplineNameMap]);

	return (
		<TooltipProvider delayDuration={200}>
			<div className="overflow-x-auto rounded-lg border border-(--workspace-border) shadow-(--shadow-xs)">
				<table
					role="table"
					className="w-full text-left text-(--text-xs)"
					aria-label="Curriculum coverage matrix"
				>
					{/* Band header row */}
					<thead>
						<tr>
							<th
								className={cn(
									'sticky left-0 z-20 min-w-[180px] bg-(--workspace-bg-card)',
									'border-b border-r border-(--workspace-border)',
									'px-3 py-2 text-(--text-xs) font-medium text-(--text-secondary)'
								)}
								scope="col"
							>
								Discipline
							</th>
							{bandGroups.map((bg) => (
								<th
									key={bg.band}
									colSpan={bg.grades.length}
									scope="colgroup"
									className={cn(
										'border-b border-(--workspace-border) px-2 py-1.5 text-center font-semibold',
										BAND_HEADER_STYLES[bg.band]
									)}
								>
									{BAND_LABELS[bg.band]}
								</th>
							))}
						</tr>
						{/* Grade code sub-header */}
						<tr>
							<th
								className={cn(
									'sticky left-0 z-20 bg-(--workspace-bg-card)',
									'border-b border-r border-(--workspace-border)',
									'px-3 py-1.5'
								)}
								scope="col"
							>
								<span className="sr-only">Grade</span>
							</th>
							{allGrades.map((gl) => (
								<th
									key={gl.gradeCode}
									scope="col"
									className={cn(
										'border-b border-(--workspace-border)',
										'px-1 py-1.5 text-center font-medium text-(--text-muted)',
										'min-w-[52px]'
									)}
								>
									{gl.gradeCode}
								</th>
							))}
						</tr>
					</thead>

					<tbody>
						{displayGroups.map((group) => (
							<GroupRows
								key={group.key}
								groupLabel={group.label}
								disciplines={group.disciplines}
								allGrades={allGrades}
								ruleIndex={ruleIndex}
								gapKeys={gapKeys}
								isAdmin={isAdmin}
								onCellClick={onCellClick}
							/>
						))}
					</tbody>
				</table>
			</div>
		</TooltipProvider>
	);
}

// ── Group Rows ───────────────────────────────────────────────────────────────

function GroupRows({
	groupLabel,
	disciplines,
	allGrades,
	ruleIndex,
	gapKeys,
	isAdmin,
	onCellClick,
}: {
	groupLabel: string;
	disciplines: DisciplineRow[];
	allGrades: GradeLevel[];
	ruleIndex: Map<string, DhgRuleDetail[]>;
	gapKeys: Set<string>;
	isAdmin: boolean;
	onCellClick: (gradeCode: string, disciplineCode: string, rule?: DhgRuleDetail) => void;
}) {
	return (
		<>
			{/* Group header row */}
			<tr>
				<td
					colSpan={allGrades.length + 1}
					className={cn(
						'sticky left-0 z-10',
						'bg-(--workspace-bg-muted) px-3 py-1.5',
						'text-(--text-xs) font-semibold uppercase tracking-wider text-(--text-secondary)',
						'border-b border-(--workspace-border)'
					)}
				>
					{groupLabel}
				</td>
			</tr>
			{/* Discipline rows */}
			{disciplines.map((disc) => (
				<tr
					key={disc.code}
					className="border-b border-(--workspace-border) last:border-0 hover:bg-(--accent-50)/30"
				>
					<td
						className={cn(
							'sticky left-0 z-10 bg-(--workspace-bg-card)',
							'border-r border-(--workspace-border)',
							'px-3 py-1.5 font-medium text-(--text-primary)',
							'whitespace-nowrap'
						)}
					>
						{disc.name}
					</td>
					{allGrades.map((gl) => (
						<CoverageCell
							key={`${disc.code}-${gl.gradeCode}`}
							gradeCode={gl.gradeCode}
							disciplineCode={disc.code}
							ruleIndex={ruleIndex}
							isGap={gapKeys.has(`${gl.gradeCode}::${disc.code}`)}
							isExpected={isExpectedCell(gl.gradeCode, disc.code)}
							isAdmin={isAdmin}
							onCellClick={onCellClick}
						/>
					))}
				</tr>
			))}
		</>
	);
}

// ── Coverage Cell ────────────────────────────────────────────────────────────

function CoverageCell({
	gradeCode,
	disciplineCode,
	ruleIndex,
	isGap,
	isExpected,
	isAdmin,
	onCellClick,
}: {
	gradeCode: string;
	disciplineCode: string;
	ruleIndex: Map<string, DhgRuleDetail[]>;
	isGap: boolean;
	isExpected: boolean;
	isAdmin: boolean;
	onCellClick: (gradeCode: string, disciplineCode: string, rule?: DhgRuleDetail) => void;
}) {
	const key = `${gradeCode}::${disciplineCode}`;
	const cellRules = ruleIndex.get(key);
	const hasRule = cellRules && cellRules.length > 0;

	if (hasRule) {
		// Sum hours for display (could have multiple rules e.g., STRUCTURAL + SPECIALTY)
		const totalHours = cellRules.reduce((sum, r) => sum + (parseFloat(r.hoursPerUnit) || 0), 0);
		const primaryRule = cellRules[0];
		const displayHours = Math.round(totalHours * 10) / 10;

		return (
			<td className="px-1 py-1.5 text-center">
				<Tooltip>
					<TooltipTrigger asChild>
						<button
							type="button"
							onClick={() => onCellClick(gradeCode, disciplineCode, primaryRule)}
							className={cn(
								'inline-flex min-w-[40px] items-center justify-center',
								'rounded px-1.5 py-0.5',
								'font-[family-name:var(--font-mono)] text-(--text-xs) tabular-nums',
								'bg-(--accent-50) text-(--accent-700)',
								'hover:bg-(--accent-100) cursor-pointer',
								'transition-colors duration-(--duration-fast)',
								'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent-500)'
							)}
							aria-label={`${disciplineCode} at ${gradeCode}: ${displayHours}h/week`}
						>
							{displayHours}h
						</button>
					</TooltipTrigger>
					<TooltipContent side="top">
						<div className="space-y-0.5 text-xs">
							{cellRules.map((r) => (
								<div key={r.id}>
									<span className="font-medium">{r.lineType.replace('_', ' ')}</span>
									{' | '}
									{r.driverType}
									{' | '}
									{r.serviceProfileName}
									{' | '}
									{r.hoursPerUnit}h
								</div>
							))}
						</div>
					</TooltipContent>
				</Tooltip>
			</td>
		);
	}

	if (isGap) {
		return (
			<td className="px-1 py-1.5 text-center">
				{isAdmin ? (
					<button
						type="button"
						onClick={() => onCellClick(gradeCode, disciplineCode)}
						className={cn(
							'inline-flex min-w-[40px] items-center justify-center',
							'rounded border border-dashed border-(--color-error)/40 px-1.5 py-0.5',
							'bg-(--color-error)/5 text-(--color-error)/60',
							'text-(--text-xs) font-medium',
							'hover:bg-(--color-error)/10 hover:border-(--color-error)/60 cursor-pointer',
							'transition-colors duration-(--duration-fast)',
							'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-error)'
						)}
						aria-label={`Missing rule: ${disciplineCode} at ${gradeCode}. Click to add.`}
					>
						+
					</button>
				) : (
					<span
						className={cn(
							'inline-flex min-w-[40px] items-center justify-center',
							'rounded border border-dashed border-(--color-error)/30 px-1.5 py-0.5',
							'bg-(--color-error)/5 text-(--color-error)/40',
							'text-(--text-xs)'
						)}
						aria-label={`Missing rule: ${disciplineCode} at ${gradeCode}`}
					>
						!
					</span>
				)}
			</td>
		);
	}

	if (!isExpected) {
		return (
			<td className="px-1 py-1.5 text-center text-(--text-muted)/40">
				<span aria-hidden="true">&mdash;</span>
			</td>
		);
	}

	// Expected but no rule — shouldn't happen if gap detection is correct
	// Fall back to dash
	return (
		<td className="px-1 py-1.5 text-center text-(--text-muted)/40">
			<span aria-hidden="true">&mdash;</span>
		</td>
	);
}
