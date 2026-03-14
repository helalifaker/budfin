import { BookOpen, Calculator, CheckCircle, Globe, GraduationCap, Percent } from 'lucide-react';
import { GuideSection } from '../shared/guide-section';
import { registerGuideContent } from '../../lib/right-panel-registry';

export function RevenueGuideContent() {
	return (
		<div className="space-y-2">
			<GuideSection title="Workflow Overview" icon={BookOpen} defaultOpen>
				<p className="text-sm text-(--text-muted)">
					Revenue planning follows a 4-step workflow: configure the fee grid, assign tariff tiers to
					students, set discount policies, then calculate revenue. Each step must be completed
					before calculation can run.
				</p>
			</GuideSection>

			<GuideSection title="Revenue Calculation Formula" icon={Calculator}>
				<p className="text-sm text-(--text-muted)">
					Revenue = Sum over all students of (Tuition HT + DAI - Discount). Monthly distribution
					splits the annual amount across terms based on the fee schedule term weights.
					Registration, activity, and exam fees are computed from enrollment counts multiplied by
					configured rates.
				</p>
			</GuideSection>

			<GuideSection title="PS Fee Structure" icon={GraduationCap}>
				<p className="text-sm text-(--text-muted)">
					Petite Section (PS) has a standalone fee row because it has different tuition rates from
					MS and GS. MS and GS share identical fees and are combined into a single display row in
					the fee schedule.
				</p>
			</GuideSection>

			<GuideSection title="Discount Policies" icon={Percent}>
				<p className="text-sm text-(--text-muted)">
					Two discount tiers exist: RP (Reduced Price) and R3+ (3rd child and above). Discounts
					apply to tuition HT only, not to DAI or other fees. The discount rate is configured per
					tariff tier in Revenue Settings.
				</p>
			</GuideSection>

			<GuideSection title="Nationality-Tariff Mapping" icon={Globe}>
				<p className="text-sm text-(--text-muted)">
					Each student is assigned a nationality group (Francais, Nationaux, Autres) and a tariff
					tier (Plein, RP, R3+). Fee rates vary by nationality. Tariff assignment determines which
					discount rate applies.
				</p>
			</GuideSection>

			<GuideSection title="Revenue Validation" icon={CheckCircle}>
				<p className="text-sm text-(--text-muted)">
					Revenue validation checks 5 areas: fee grid completeness, tariff assignment coverage,
					discount policy configuration, derived revenue rates, and other revenue drivers. All areas
					must show green before calculation results are considered reliable.
				</p>
			</GuideSection>
		</div>
	);
}

// Register on module load
registerGuideContent('revenue', RevenueGuideContent);
