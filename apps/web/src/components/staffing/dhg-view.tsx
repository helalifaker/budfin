import { cn } from '../../lib/cn';
import type { DhgGrilleEntry, DhgRequirement } from '../../hooks/use-staffing';

export type DhgGrilleViewProps = {
	grilles: DhgGrilleEntry[];
};

export function DhgGrilleView({ grilles }: DhgGrilleViewProps) {
	if (grilles.length === 0) {
		return (
			<div className="py-6 text-center text-sm text-(--text-muted)">
				No DHG grille configuration found. Configure grilles in Master Data.
			</div>
		);
	}

	// Group by grade level
	const grouped = new Map<string, DhgGrilleEntry[]>();
	for (const g of grilles) {
		const list = grouped.get(g.gradeLevel) ?? [];
		list.push(g);
		grouped.set(g.gradeLevel, list);
	}

	return (
		<div className="space-y-4">
			{[...grouped.entries()].map(([grade, entries]) => (
				<div key={grade}>
					<h4 className="text-(--text-xs) font-semibold uppercase tracking-wider text-(--text-muted) mb-2">
						{grade}
					</h4>
					<div className="overflow-x-auto rounded-(--radius-md) border border-(--workspace-border)">
						<table className="w-full border-collapse text-sm" role="grid">
							<thead>
								<tr className="bg-(--workspace-bg-subtle)">
									<th className="px-3 py-2 text-left text-xs font-medium text-(--text-muted) uppercase tracking-wider">
										Subject
									</th>
									<th className="px-3 py-2 text-left text-xs font-medium text-(--text-muted) uppercase tracking-wider">
										Type
									</th>
									<th className="px-3 py-2 text-right text-xs font-medium text-(--text-muted) uppercase tracking-wider">
										Hrs/Wk/Section
									</th>
								</tr>
							</thead>
							<tbody>
								{entries.map((e, i) => (
									<tr
										key={`${e.subject}-${i}`}
										className={cn(
											'border-t border-(--workspace-border)',
											'hover:bg-(--workspace-bg-subtle)'
										)}
									>
										<td className="px-3 py-1.5 text-(--text-primary)">{e.subject}</td>
										<td className="px-3 py-1.5 text-(--text-muted)">{e.dhgType}</td>
										<td className="px-3 py-1.5 text-right font-mono text-(--text-primary)">
											{e.hoursPerWeekPerSection}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			))}
		</div>
	);
}

export type DhgRequirementsViewProps = {
	requirements: DhgRequirement[];
};

export function DhgRequirementsView({ requirements }: DhgRequirementsViewProps) {
	if (requirements.length === 0) {
		return (
			<div className="py-6 text-center text-sm text-(--text-muted)">
				No DHG requirements calculated yet. Run Calculate to generate requirements.
			</div>
		);
	}

	const totalFte = requirements.reduce((sum, r) => sum + Number(r.fte), 0);
	const totalSections = requirements.reduce((sum, r) => sum + r.sectionsNeeded, 0);
	const totalStudents = requirements.reduce((sum, r) => sum + r.headcount, 0);

	return (
		<div className="space-y-3">
			<div className="overflow-x-auto rounded-(--radius-md) border border-(--workspace-border)">
				<table className="w-full border-collapse text-sm" role="grid">
					<thead>
						<tr className="bg-(--workspace-bg-subtle)">
							{[
								'Grade',
								'Students',
								'Max Class',
								'Sections',
								'Weekly Hrs',
								'Annual Hrs',
								'FTE',
							].map((h) => (
								<th
									key={h}
									className={cn(
										'px-3 py-2 text-xs font-medium text-(--text-muted)',
										'uppercase tracking-wider',
										h !== 'Grade' ? 'text-right' : 'text-left'
									)}
								>
									{h}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{requirements.map((r) => (
							<tr
								key={r.gradeLevel}
								className={cn(
									'border-t border-(--workspace-border)',
									'hover:bg-(--workspace-bg-subtle)'
								)}
							>
								<td className="px-3 py-1.5 font-medium text-(--text-primary)">{r.gradeLevel}</td>
								<td className="px-3 py-1.5 text-right text-(--text-primary)">{r.headcount}</td>
								<td className="px-3 py-1.5 text-right text-(--text-muted)">{r.maxClassSize}</td>
								<td className="px-3 py-1.5 text-right font-medium text-(--text-primary)">
									{r.sectionsNeeded}
								</td>
								<td className="px-3 py-1.5 text-right font-mono text-(--text-primary)">
									{Number(r.totalWeeklyHours).toFixed(1)}
								</td>
								<td className="px-3 py-1.5 text-right font-mono text-(--text-primary)">
									{Number(r.totalAnnualHours).toFixed(1)}
								</td>
								<td className="px-3 py-1.5 text-right font-mono font-medium text-(--accent-700)">
									{Number(r.fte).toFixed(2)}
								</td>
							</tr>
						))}
					</tbody>
					<tfoot>
						<tr className="border-t-2 border-(--workspace-border) bg-(--workspace-bg-subtle)">
							<td className="px-3 py-2 font-semibold text-(--text-primary)">Total</td>
							<td className="px-3 py-2 text-right font-semibold text-(--text-primary)">
								{totalStudents}
							</td>
							<td className="px-3 py-2" />
							<td className="px-3 py-2 text-right font-semibold text-(--text-primary)">
								{totalSections}
							</td>
							<td className="px-3 py-2" />
							<td className="px-3 py-2" />
							<td className="px-3 py-2 text-right font-mono font-bold text-(--accent-700)">
								{totalFte.toFixed(2)}
							</td>
						</tr>
					</tfoot>
				</table>
			</div>
		</div>
	);
}
