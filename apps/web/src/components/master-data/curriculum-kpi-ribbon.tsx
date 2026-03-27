import { AlertTriangle, BookOpen, GraduationCap, School } from 'lucide-react';
import { KpiCard } from '../shared/kpi-card';
import type { CurriculumKpis } from '../../lib/curriculum-coverage-map';

export type CurriculumKpiRibbonProps = {
	kpis: CurriculumKpis;
};

export function CurriculumKpiRibbon({ kpis }: CurriculumKpiRibbonProps) {
	const primaryTotal = kpis.primaryHours.maternelle + kpis.primaryHours.elementaire;
	const secondaryTotal = kpis.secondaryHours.college + kpis.secondaryHours.lycee;
	const hasGaps = kpis.gapCount > 0;

	return (
		<div role="list" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
			<KpiCard
				role="listitem"
				label="Total Rules"
				icon={BookOpen}
				index={0}
				accentColor="var(--accent-500)"
				subtitle={`${kpis.disciplineCount} disciplines / ${kpis.gradeLevelCount} grades`}
			>
				{kpis.totalRules}
			</KpiCard>

			<KpiCard
				role="listitem"
				label="Primary Hours"
				icon={GraduationCap}
				index={1}
				accentColor="var(--badge-elementaire)"
				subtitle={`Mat: ${formatHours(kpis.primaryHours.maternelle)} / Elem: ${formatHours(kpis.primaryHours.elementaire)}`}
			>
				{formatHours(primaryTotal)}
			</KpiCard>

			<KpiCard
				role="listitem"
				label="Secondary Hours"
				icon={School}
				index={2}
				accentColor="var(--badge-college)"
				subtitle={`Col: ${formatHours(kpis.secondaryHours.college)} / Lyc: ${formatHours(kpis.secondaryHours.lycee)}`}
			>
				{formatHours(secondaryTotal)}
			</KpiCard>

			<KpiCard
				role="listitem"
				label="Coverage Gaps"
				icon={AlertTriangle}
				index={3}
				accentColor={hasGaps ? 'var(--color-error)' : 'var(--color-success)'}
				subtitle={hasGaps ? `${kpis.gapCount} missing rules` : 'All covered'}
			>
				{kpis.gapCount}
			</KpiCard>
		</div>
	);
}

function formatHours(hours: number): string {
	if (hours === 0) return '0h';
	const rounded = Math.round(hours * 10) / 10;
	return `${rounded}h`;
}
