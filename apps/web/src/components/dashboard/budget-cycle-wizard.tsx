import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { cn } from '../../lib/cn';

interface WizardStep {
	name: string;
	description: string;
	route: string;
}

const WIZARD_STEPS: WizardStep[] = [
	{
		name: 'Create Version',
		description:
			'Start by creating a new budget version for the fiscal year. This acts as the container for all your planning data.',
		route: '/management/versions',
	},
	{
		name: 'Configure Enrollment',
		description:
			'Enter student headcount projections by grade and academic period. Enrollment drives revenue calculations.',
		route: '/planning/enrollment',
	},
	{
		name: 'Set Fee Grid',
		description:
			'Define tuition fees, discounts, and other revenue items per grade. Revenue is calculated from enrollment and fee data.',
		route: '/planning/revenue',
	},
	{
		name: 'Import Staff',
		description:
			'Add employee records with salary details, contracts, and FTE allocations. Staff costs are the largest budget line.',
		route: '/planning/staffing',
	},
	{
		name: 'Configure OpEx',
		description:
			'Set up operating expenditure line items such as utilities, maintenance, and supplies.',
		route: '/planning/opex',
	},
	{
		name: 'Run Calculations',
		description:
			'Trigger the calculation engine to compute revenue, staff costs, OpEx, and P&L. Ensure no modules are stale.',
		route: '/planning/pnl',
	},
	{
		name: 'Review P&L',
		description:
			'Review the Profit & Loss statement to verify all figures. Compare with prior versions and finalize the budget.',
		route: '/planning/pnl',
	},
];

interface BudgetCycleWizardProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function BudgetCycleWizard({ open, onOpenChange }: BudgetCycleWizardProps) {
	const [currentStep, setCurrentStep] = useState(0);
	const navigate = useNavigate();

	const step = WIZARD_STEPS[currentStep]!;
	const isFirst = currentStep === 0;
	const isLast = currentStep === WIZARD_STEPS.length - 1;

	function handlePrevious() {
		if (!isFirst) {
			setCurrentStep((s) => s - 1);
		}
	}

	function handleNext() {
		if (!isLast) {
			setCurrentStep((s) => s + 1);
		}
	}

	function handleGoToModule() {
		onOpenChange(false);
		setCurrentStep(0);
		void navigate(step.route);
	}

	function handleClose() {
		onOpenChange(false);
		setCurrentStep(0);
	}

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent className="max-w-[540px]">
				<DialogHeader>
					<DialogTitle>Budget Cycle Wizard</DialogTitle>
					<DialogDescription>Follow these steps to complete your budget cycle.</DialogDescription>
				</DialogHeader>

				{/* Step indicator */}
				<div className="flex items-center gap-1.5 py-2" aria-label="Wizard progress">
					{WIZARD_STEPS.map((_, idx) => (
						<div
							key={idx}
							className={cn(
								'h-1.5 flex-1 rounded-full transition-colors',
								idx <= currentStep ? 'bg-(--accent-500)' : 'bg-(--workspace-border)'
							)}
							aria-hidden="true"
						/>
					))}
				</div>

				{/* Step content */}
				<div className="py-4">
					<div className="flex items-baseline gap-3 mb-2">
						<span
							className={cn(
								'flex h-7 w-7 shrink-0 items-center justify-center',
								'rounded-full bg-(--accent-500) text-white',
								'text-(--text-xs) font-bold'
							)}
						>
							{currentStep + 1}
						</span>
						<h3 className="text-(--text-base) font-semibold text-(--text-primary)">{step.name}</h3>
					</div>
					<p className="ml-10 text-(--text-sm) text-(--text-secondary) leading-relaxed">
						{step.description}
					</p>
					<div className="ml-10 mt-4">
						<Button variant="secondary" size="sm" onClick={handleGoToModule}>
							Go to Module
							<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
						</Button>
					</div>
				</div>

				<DialogFooter className="flex items-center justify-between">
					<span className="text-(--text-xs) text-(--text-muted)">
						Step {currentStep + 1} of {WIZARD_STEPS.length}
					</span>
					<div className="flex gap-2">
						{!isFirst && (
							<Button variant="ghost" size="sm" onClick={handlePrevious}>
								<ChevronLeft className="h-4 w-4" aria-hidden="true" />
								Previous
							</Button>
						)}
						{isLast ? (
							<Button variant="primary" size="sm" onClick={handleClose}>
								Done
							</Button>
						) : (
							<Button variant="primary" size="sm" onClick={handleNext}>
								Next
								<ChevronRight className="h-4 w-4" aria-hidden="true" />
							</Button>
						)}
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
