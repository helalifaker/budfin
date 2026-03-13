import { useState } from 'react';
import {
	AlertTriangle,
	Calculator,
	ChevronDown,
	Globe,
	GraduationCap,
	ListChecks,
	Settings2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';

function GuideSection({
	title,
	icon: Icon,
	children,
	defaultOpen = false,
}: {
	title: string;
	icon: LucideIcon;
	children: React.ReactNode;
	defaultOpen?: boolean;
}) {
	const [open, setOpen] = useState(defaultOpen);

	return (
		<div className="rounded-lg border border-(--inspector-section-border) bg-(--workspace-bg-card) px-3 py-1">
			<button
				type="button"
				onClick={() => setOpen((prev) => !prev)}
				className={cn(
					'flex w-full items-center gap-2 py-2.5',
					'text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)',
					'hover:text-(--text-primary) transition-colors duration-(--duration-fast)'
				)}
				aria-expanded={open}
			>
				<Icon className="h-5 w-5 text-(--accent-500)" aria-hidden="true" />
				<span className="flex-1 text-left">{title}</span>
				<ChevronDown
					className={cn(
						'h-3.5 w-3.5 transition-transform duration-(--duration-fast)',
						open && 'rotate-180'
					)}
					aria-hidden="true"
				/>
			</button>
			{open && <div className="pb-3 text-(--text-sm) text-(--text-secondary)">{children}</div>}
		</div>
	);
}

export function EnrollmentGuideContent() {
	return (
		<div className="space-y-2">
			<p className="text-(--text-xs) text-(--text-muted) mb-3">
				Reference guide for enrollment planning concepts and formulas.
			</p>

			<GuideSection title="Workflow Overview" icon={ListChecks} defaultOpen>
				<div className="space-y-2">
					<p>The enrollment planning workflow follows four stages:</p>
					<ol className="list-decimal space-y-1 pl-5 text-(--text-xs)">
						<li>
							<strong>Baseline</strong> -- Import or confirm AY1 intake from prior-year actuals
							using the setup wizard.
						</li>
						<li>
							<strong>Assumptions</strong> -- Set retention rates and lateral entries per grade.
							Accept or override the system recommendations.
						</li>
						<li>
							<strong>Calculate</strong> -- Run the enrollment engine to project AY2 headcount,
							sections, and capacity utilization.
						</li>
						<li>
							<strong>Review</strong> -- Inspect exceptions, validate assumptions in the sidebar,
							and export for committee review.
						</li>
					</ol>
				</div>
			</GuideSection>

			<GuideSection title="Cohort Progression Formula" icon={Calculator}>
				<div className="space-y-2">
					<p>For each grade (except Petite Section):</p>
					<div className="rounded-md bg-(--workspace-bg-muted) px-3 py-2 font-[family-name:var(--font-mono)] text-(--text-xs)">
						AY2 = floor(Prior_Grade_AY1 &times; Retention%) + Laterals
					</div>
					<p className="text-(--text-xs) text-(--text-muted)">
						Retention is the percentage of students from the prior grade who progress. Laterals are
						additional students entering from outside the school.
					</p>
				</div>
			</GuideSection>

			<GuideSection title="Petite Section (PS) Handling" icon={GraduationCap}>
				<div className="space-y-2">
					<p>
						PS is the entry grade and does not have a prior grade for progression. Instead, AY2
						intake is set directly.
					</p>
					<ul className="list-disc space-y-1 pl-5 text-(--text-xs)">
						<li>
							The admin-configured default (Grade Settings) is used as a placeholder when no
							explicit value is set.
						</li>
						<li>Retention rate and lateral entries are not applicable for PS.</li>
						<li>
							Override the default per version by entering a value in the setup wizard or the
							inspector sidebar.
						</li>
					</ul>
				</div>
			</GuideSection>

			<GuideSection title="Planning Rules" icon={Settings2}>
				<div className="space-y-2">
					<p>
						Two version-scoped rules control how recommendations are generated from historical data:
					</p>
					<dl className="space-y-2 text-(--text-xs)">
						<dt className="font-semibold text-(--text-primary)">
							Rollover Threshold (default: 100%)
						</dt>
						<dd>
							When a grade&apos;s historical rollover ratio exceeds this value, the recommendation
							engine applies the capped retention rate instead of the raw historical rate.
						</dd>
						<dt className="font-semibold text-(--text-primary)">Retention Cap (default: 98%)</dt>
						<dd>
							The maximum retention rate applied when rollover exceeds the threshold. Excess
							students above the cap are added as lateral entries.
						</dd>
					</dl>
					<p className="text-(--text-xs) text-(--text-muted)">
						Edit these rules in the sidebar Planning Rules card or in Step 2 of the setup wizard.
						Changes require an explicit Save.
					</p>
				</div>
			</GuideSection>

			<GuideSection title="Nationality Overrides" icon={Globe}>
				<div className="space-y-2">
					<p>
						Each grade&apos;s AY2 headcount is distributed across three nationality groups:
						Francais, Nationaux, and Autres.
					</p>
					<ul className="list-disc space-y-1 pl-5 text-(--text-xs)">
						<li>Weights must sum to exactly 100% per grade.</li>
						<li>
							By default, weights are carried forward from AY1 actuals. Override them in the grade
							inspector sidebar.
						</li>
						<li>Overridden grades are flagged with a badge in the master grid and inspector.</li>
					</ul>
				</div>
			</GuideSection>

			<GuideSection title="Capacity Alerts" icon={AlertTriangle}>
				<div className="space-y-2">
					<p>
						The master grid flags capacity pressure using four alert levels based on utilization
						percentage:
					</p>
					<dl className="space-y-1 text-(--text-xs)">
						<dt className="font-semibold text-(--color-error)">OVER (&gt; 100%)</dt>
						<dd>AY2 headcount exceeds section capacity. Requires action.</dd>
						<dt className="font-semibold text-(--color-warning)">NEAR_CAP (90--100%)</dt>
						<dd>Approaching capacity limits. Review before finalizing.</dd>
						<dt className="font-semibold text-(--text-primary)">OK (70--90%)</dt>
						<dd>Within normal operating range.</dd>
						<dt className="font-semibold text-(--text-muted)">UNDER (&lt; 70%)</dt>
						<dd>Low utilization. Consider consolidating sections.</dd>
					</dl>
				</div>
			</GuideSection>
		</div>
	);
}
