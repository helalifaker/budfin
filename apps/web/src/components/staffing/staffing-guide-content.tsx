import { registerGuideContent } from '../../lib/right-panel-registry';

export function StaffingGuideContent() {
	return (
		<div className="space-y-4 p-4">
			<h3 className="text-lg font-semibold text-(--text-primary)">Staffing Guide</h3>

			<div className="space-y-3">
				<section>
					<h4 className="text-sm font-medium text-(--text-secondary)">KPI Metrics</h4>
					<p className="mt-1 text-sm text-(--text-muted)">
						The ribbon displays key staffing metrics: total headcount, FTE gap, staff cost, HSA
						budget, H/E ratio, and recharge cost. Values update after each calculation run.
					</p>
				</section>

				<section>
					<h4 className="text-sm font-medium text-(--text-secondary)">Detail Panel</h4>
					<p className="mt-1 text-sm text-(--text-muted)">
						Click a requirement line or employee in the grid to inspect details. The panel shows
						driver breakdowns, assigned teachers, gap analysis, and cost splits. Use the back button
						to return to the overview.
					</p>
				</section>

				<section>
					<h4 className="text-sm font-medium text-(--text-secondary)">Stale Indicators</h4>
					<p className="mt-1 text-sm text-(--text-muted)">
						A pulsing red dot signals that staffing data is stale and needs recalculation.
						Downstream modules (P&amp;L) are marked with stale pills in the status strip.
					</p>
				</section>
			</div>
		</div>
	);
}

// Register guide content at module level (side-effect import)
registerGuideContent('staffing', StaffingGuideContent);
