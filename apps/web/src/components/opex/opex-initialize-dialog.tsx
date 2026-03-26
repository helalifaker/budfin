import { useState, useCallback } from 'react';
import { AlertTriangle, Calendar, Copy, Loader2, SquareDashedBottom } from 'lucide-react';
import type { OpExInitializePayload } from '@budfin/types';
import { useVersions } from '../../hooks/use-versions';
import { useInitializeOpEx } from '../../hooks/use-opex';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { cn } from '../../lib/cn';

// ── Types ────────────────────────────────────────────────────────────────────

type SourceType = 'PRIOR_YEAR_ACTUALS' | 'VERSION' | 'START_FRESH';
type PriorYear = 'FY2025' | 'FY2024';
type DialogStep = 'source' | 'confirm';

export type OpExInitializeDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	versionId: number;
	currentItemCount: number;
};

// ── Source Card ───────────────────────────────────────────────────────────────

type SourceCardProps = {
	value: SourceType;
	selected: boolean;
	icon: React.ReactNode;
	title: string;
	description: string;
	children?: React.ReactNode;
};

function SourceCard({ value, selected, icon, title, description, children }: SourceCardProps) {
	return (
		<label
			htmlFor={`source-${value}`}
			className={cn(
				'flex cursor-pointer gap-3 rounded-lg border p-4',
				'transition-all duration-(--duration-fast)',
				selected
					? 'border-(--accent-500) bg-(--accent-50) shadow-(--shadow-glow-accent)'
					: 'border-(--workspace-border) bg-(--workspace-bg-card) hover:border-(--accent-300)'
			)}
		>
			<RadioGroupItem value={value} id={`source-${value}`} className="mt-0.5 shrink-0" />
			<div className="flex-1 space-y-1">
				<div className="flex items-center gap-2">
					{icon}
					<span className="text-(--text-sm) font-medium text-(--text-primary)">{title}</span>
				</div>
				<p className="text-(--text-xs) text-(--text-secondary)">{description}</p>
				{selected && children && <div className="mt-3">{children}</div>}
			</div>
		</label>
	);
}

// ── Main Component ───────────────────────────────────────────────────────────

export function OpExInitializeDialog({
	open,
	onOpenChange,
	versionId,
	currentItemCount,
}: OpExInitializeDialogProps) {
	const [openKey, setOpenKey] = useState(0);

	function handleOpenChange(next: boolean) {
		if (next) {
			setOpenKey((k) => k + 1);
		}
		onOpenChange(next);
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<InitializeDialogBody
				key={openKey}
				onOpenChange={onOpenChange}
				versionId={versionId}
				currentItemCount={currentItemCount}
			/>
		</Dialog>
	);
}

// ── Dialog Body ──────────────────────────────────────────────────────────────

function InitializeDialogBody({
	onOpenChange,
	versionId,
	currentItemCount,
}: {
	onOpenChange: (open: boolean) => void;
	versionId: number;
	currentItemCount: number;
}) {
	const { data: versionsData } = useVersions();
	const initializeMutation = useInitializeOpEx(versionId);

	const [step, setStep] = useState<DialogStep>('source');
	const [sourceType, setSourceType] = useState<SourceType>('PRIOR_YEAR_ACTUALS');
	const [priorYear, setPriorYear] = useState<PriorYear>('FY2025');
	const [sourceVersionId, setSourceVersionId] = useState<string>('');

	// Filter versions: exclude current version, show only Draft/Published
	const availableVersions = (versionsData?.data ?? []).filter(
		(v) => v.id !== versionId && (v.status === 'Draft' || v.status === 'Published')
	);

	const canProceed = useCallback(() => {
		if (sourceType === 'START_FRESH') return true;
		if (sourceType === 'PRIOR_YEAR_ACTUALS') return !!priorYear;
		if (sourceType === 'VERSION') return !!sourceVersionId;
		return false;
	}, [sourceType, priorYear, sourceVersionId]);

	const handleNext = useCallback(() => {
		if (!canProceed()) return;
		setStep('confirm');
	}, [canProceed]);

	const handleBack = useCallback(() => {
		setStep('source');
	}, []);

	const handleInitialize = useCallback(() => {
		if (sourceType === 'START_FRESH') {
			// Start fresh means initialize with empty category structure.
			// The API handles this as a version-copy with no source data.
			// For now, close the dialog since the grid already starts empty.
			onOpenChange(false);
			return;
		}

		const payload: OpExInitializePayload =
			sourceType === 'PRIOR_YEAR_ACTUALS'
				? { source: 'PRIOR_YEAR_ACTUALS', priorYear }
				: { source: 'VERSION', sourceVersionId: Number(sourceVersionId) };

		initializeMutation.mutate(payload, {
			onSuccess: () => {
				onOpenChange(false);
			},
		});
	}, [sourceType, priorYear, sourceVersionId, initializeMutation, onOpenChange]);

	const sourceLabel =
		sourceType === 'PRIOR_YEAR_ACTUALS'
			? `${priorYear} actuals`
			: sourceType === 'VERSION'
				? (availableVersions.find((v) => v.id === Number(sourceVersionId))?.name ??
					'selected version')
				: 'empty template';

	return (
		<DialogContent className="max-w-[520px]">
			<DialogHeader>
				<DialogTitle>Initialize Operating Expenses</DialogTitle>
				<DialogDescription>
					{step === 'source'
						? 'Choose a data source to populate your operating expenses grid.'
						: 'Confirm initialization to proceed.'}
				</DialogDescription>
			</DialogHeader>

			{step === 'source' && (
				<div className="space-y-3 py-2">
					<RadioGroup value={sourceType} onValueChange={(v) => setSourceType(v as SourceType)}>
						<SourceCard
							value="PRIOR_YEAR_ACTUALS"
							selected={sourceType === 'PRIOR_YEAR_ACTUALS'}
							icon={<Calendar className="h-4 w-4 text-(--accent-500)" aria-hidden="true" />}
							title="Prior Year Actuals"
							description="Copy annual totals from a prior year. Each item spread evenly across active months."
						>
							<fieldset className="space-y-2">
								<legend className="sr-only">Select prior year</legend>
								<RadioGroup
									value={priorYear}
									onValueChange={(v) => setPriorYear(v as PriorYear)}
									className="flex gap-4"
								>
									<label htmlFor="prior-fy2025" className="flex items-center gap-2">
										<RadioGroupItem value="FY2025" id="prior-fy2025" />
										<span className="text-(--text-sm) text-(--text-primary)">FY2025</span>
									</label>
									<label htmlFor="prior-fy2024" className="flex items-center gap-2">
										<RadioGroupItem value="FY2024" id="prior-fy2024" />
										<span className="text-(--text-sm) text-(--text-primary)">FY2024</span>
									</label>
								</RadioGroup>
							</fieldset>
						</SourceCard>

						<SourceCard
							value="VERSION"
							selected={sourceType === 'VERSION'}
							icon={<Copy className="h-4 w-4 text-(--accent-500)" aria-hidden="true" />}
							title="Another Version"
							description="Copy all line items, monthly amounts, and entry modes from an existing version."
						>
							<div className="space-y-1.5">
								<label
									htmlFor="source-version-select"
									className="text-(--text-xs) font-medium text-(--text-secondary)"
								>
									Select version
								</label>
								<Select value={sourceVersionId} onValueChange={setSourceVersionId}>
									<SelectTrigger id="source-version-select">
										<SelectValue placeholder="Choose a version..." />
									</SelectTrigger>
									<SelectContent>
										{availableVersions.map((v) => (
											<SelectItem key={v.id} value={String(v.id)}>
												{v.name} (FY{v.fiscalYear} {v.type})
											</SelectItem>
										))}
										{availableVersions.length === 0 && (
											<div className="px-3 py-2 text-(--text-xs) text-(--text-muted)">
												No other versions available.
											</div>
										)}
									</SelectContent>
								</Select>
							</div>
						</SourceCard>

						<SourceCard
							value="START_FRESH"
							selected={sourceType === 'START_FRESH'}
							icon={
								<SquareDashedBottom className="h-4 w-4 text-(--accent-500)" aria-hidden="true" />
							}
							title="Start Fresh"
							description="Empty grid with category structure only."
						/>
					</RadioGroup>
				</div>
			)}

			{step === 'confirm' && (
				<div className="py-2">
					<div
						className={cn(
							'flex gap-3 rounded-lg p-4',
							'border border-(--color-warning)/30 bg-(--color-warning-bg)'
						)}
						role="alert"
					>
						<AlertTriangle className="h-5 w-5 shrink-0 text-(--color-warning)" aria-hidden="true" />
						<div className="space-y-1">
							<p className="text-(--text-sm) font-medium text-(--text-primary)">
								{currentItemCount > 0
									? `This will replace all ${currentItemCount} current line items.`
									: 'This will initialize your operating expenses grid.'}
							</p>
							<p className="text-(--text-xs) text-(--text-secondary)">
								{currentItemCount > 0
									? 'This action cannot be undone. All existing monthly amounts will be overwritten.'
									: `Data will be populated from ${sourceLabel}.`}
							</p>
							{sourceType !== 'START_FRESH' && (
								<p className="mt-2 text-(--text-xs) text-(--text-secondary)">
									Source: <span className="font-medium text-(--text-primary)">{sourceLabel}</span>
								</p>
							)}
						</div>
					</div>
				</div>
			)}

			<DialogFooter>
				{step === 'source' ? (
					<>
						<Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
							Cancel
						</Button>
						<Button size="sm" onClick={handleNext} disabled={!canProceed()}>
							Next
						</Button>
					</>
				) : (
					<>
						<Button
							variant="ghost"
							size="sm"
							onClick={handleBack}
							disabled={initializeMutation.isPending}
						>
							Back
						</Button>
						<Button
							variant="destructive"
							size="sm"
							onClick={handleInitialize}
							disabled={initializeMutation.isPending}
						>
							{initializeMutation.isPending ? (
								<>
									<Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />
									Initializing...
								</>
							) : (
								'Initialize'
							)}
						</Button>
					</>
				)}
			</DialogFooter>
		</DialogContent>
	);
}
