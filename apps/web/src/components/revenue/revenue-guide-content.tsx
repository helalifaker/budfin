import { BookOpen, Calculator, CheckCircle, Globe, GraduationCap, Percent } from 'lucide-react';
import { GuideSection } from '../shared/guide-section';
import { registerGuideContent } from '../../lib/right-panel-registry';

export function RevenueGuideContent() {
	return (
		<div className="space-y-2">
			<GuideSection title="Workflow Overview" icon={BookOpen} defaultOpen>
				<p className="text-sm text-(--text-muted)">
					Revenue planning follows a 3-step workflow: configure the fee grid (band-level tuition and
					per-student fees), set the flat discount percentage, then add custom other-revenue lines.
					Once all three areas are ready, run the calculation.
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

			<GuideSection title="Flat Discount" icon={Percent}>
				<p className="text-sm text-(--text-muted)">
					A single flat discount percentage is applied uniformly to all students. The discount
					reduces tuition HT only, not DAI or other fees. Configure the rate in the Discounts tab of
					Revenue Settings.
				</p>
			</GuideSection>

			<GuideSection title="Nationality Groups" icon={Globe}>
				<p className="text-sm text-(--text-muted)">
					Students belong to one of three nationality groups (Francais, Nationaux, Autres). Fee
					rates vary by nationality and grade band. Nationaux students are VAT-exempt; Francais and
					Autres are charged 15% VAT on tuition HT.
				</p>
			</GuideSection>

			<GuideSection title="Revenue Readiness" icon={CheckCircle}>
				<p className="text-sm text-(--text-muted)">
					Revenue readiness checks 3 areas: fee grid completeness, discount configuration, and other
					revenue drivers. All areas must show green before calculation results are considered
					reliable.
				</p>
			</GuideSection>
		</div>
	);
}

// Register on module load
registerGuideContent('revenue', RevenueGuideContent);
