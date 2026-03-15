import { useState } from 'react';
import Decimal from 'decimal.js';
import { useRevenueSettings, usePutRevenueSettings } from '../../hooks/use-revenue';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

interface DiscountsTabProps {
	versionId: number;
	isReadOnly: boolean;
}

export function DiscountsTab({ versionId, isReadOnly }: DiscountsTabProps) {
	const { data: settingsData, isLoading } = useRevenueSettings(versionId);
	const saveMutation = usePutRevenueSettings(versionId);
	const sourceSettings = settingsData?.settings ?? null;

	const sourcePctStr = sourceSettings
		? new Decimal(sourceSettings.flatDiscountPct).mul(100).toFixed(2)
		: '';

	const [displayPct, setDisplayPct] = useState(sourcePctStr);
	const [prevSourcePct, setPrevSourcePct] = useState(sourcePctStr);

	if (sourcePctStr !== prevSourcePct) {
		setPrevSourcePct(sourcePctStr);
		setDisplayPct(sourcePctStr);
	}

	const sourcePct = sourceSettings
		? new Decimal(sourceSettings.flatDiscountPct).mul(100).toFixed(2)
		: '';
	const isDirty = displayPct !== sourcePct;

	const parsedPct = (() => {
		try {
			const d = new Decimal(displayPct || '0');
			return d.gte(0) && d.lte(100) ? d : null;
		} catch {
			return null;
		}
	})();

	const isValid = parsedPct !== null;
	const keptPct = parsedPct ? new Decimal(100).minus(parsedPct).toFixed(2) : '-';

	const handleSave = () => {
		if (!sourceSettings || !parsedPct) return;
		const flatDiscountPct = parsedPct.div(100).toFixed(6);
		saveMutation.mutate({ ...sourceSettings, flatDiscountPct });
	};

	if (isLoading) {
		return (
			<div className="space-y-4 animate-pulse">
				<div className="h-40 rounded-lg border border-(--grid-frame-border) bg-(--workspace-bg-card)" />
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between rounded-lg border border-(--workspace-border) bg-(--workspace-bg-subtle) px-4 py-3 text-sm">
				<div>
					<div className="font-medium text-(--text-primary)">Flat Discount</div>
					<div className="text-(--text-muted)">
						A single discount percentage applied uniformly to all students.
					</div>
				</div>
				{!isReadOnly && (
					<Button
						size="sm"
						disabled={!isDirty || !isValid || saveMutation.isPending}
						onClick={handleSave}
					>
						{saveMutation.isPending ? 'Saving...' : 'Save Discount'}
					</Button>
				)}
			</div>

			<div className="rounded-lg border border-(--grid-frame-border) bg-(--workspace-bg-card) p-6">
				<div className="mx-auto max-w-md space-y-6">
					<label className="block space-y-2">
						<span className="text-sm font-medium text-(--text-primary)">Discount Rate (%)</span>
						<div className="flex items-center gap-2">
							<Input
								value={displayPct}
								onChange={(e) => setDisplayPct(e.target.value)}
								disabled={isReadOnly || !sourceSettings}
								inputMode="decimal"
								className="max-w-[120px]"
								aria-label="Flat discount percentage"
							/>
							<span className="text-sm text-(--text-secondary)">%</span>
						</div>
						{!isValid && displayPct !== '' && (
							<p className="text-xs text-(--color-danger)">Enter a value between 0 and 100.</p>
						)}
					</label>

					<div className="rounded-md border border-(--grid-compact-border) bg-(--workspace-bg-subtle) p-4">
						<p className="text-sm text-(--text-secondary)">
							Students are billed at{' '}
							<span className="font-semibold text-(--text-primary)">{keptPct}%</span> of full
							tuition.
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}
