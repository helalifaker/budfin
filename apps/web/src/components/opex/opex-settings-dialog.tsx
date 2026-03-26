import { useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { usePatchVersion } from '../../hooks/use-versions';
import { opexKeys } from '../../hooks/use-opex';
import { toast } from '../ui/toast-state';
import { cn } from '../../lib/cn';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';

// ── Constants ────────────────────────────────────────────────────────────────

const MONTH_LABELS = [
	'Jan',
	'Feb',
	'Mar',
	'Apr',
	'May',
	'Jun',
	'Jul',
	'Aug',
	'Sep',
	'Oct',
	'Nov',
	'Dec',
] as const;

const SCHOOL_YEAR_MONTHS = [1, 2, 3, 4, 5, 6, 9, 10, 11, 12];
const FULL_YEAR_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

// ── Types ────────────────────────────────────────────────────────────────────

export type OpExSettingsDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	versionId: number;
	currentMonths: number[];
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function getInactiveMonthNames(selectedMonths: number[]): string {
	const inactive = MONTH_LABELS.map((label, i) => ({ label, month: i + 1 }))
		.filter(({ month }) => !selectedMonths.includes(month))
		.map(({ label }) => label);

	if (inactive.length === 0) return 'none inactive';
	return inactive.join(', ') + ' inactive';
}

function arraysEqual(a: number[], b: number[]): boolean {
	if (a.length !== b.length) return false;
	const sortedA = [...a].sort((x, y) => x - y);
	const sortedB = [...b].sort((x, y) => x - y);
	return sortedA.every((v, i) => v === sortedB[i]);
}

// ── Component ────────────────────────────────────────────────────────────────

export function OpExSettingsDialog({
	open,
	onOpenChange,
	versionId,
	currentMonths,
}: OpExSettingsDialogProps) {
	const [selectedMonths, setSelectedMonths] = useState<number[]>(() =>
		[...currentMonths].sort((a, b) => a - b)
	);
	const patchVersion = usePatchVersion();
	const queryClient = useQueryClient();

	// Reset selection when dialog opens with new data
	const handleOpenChange = useCallback(
		(nextOpen: boolean) => {
			if (nextOpen) {
				setSelectedMonths([...currentMonths].sort((a, b) => a - b));
			}
			onOpenChange(nextOpen);
		},
		[currentMonths, onOpenChange]
	);

	const toggleMonth = useCallback((month: number) => {
		setSelectedMonths((prev) => {
			if (prev.includes(month)) {
				// Prevent removing the last active month
				if (prev.length <= 1) return prev;
				return prev.filter((m) => m !== month).sort((a, b) => a - b);
			}
			return [...prev, month].sort((a, b) => a - b);
		});
	}, []);

	const applyPreset = useCallback((preset: number[]) => {
		setSelectedMonths([...preset].sort((a, b) => a - b));
	}, []);

	const hasChanges = useMemo(
		() => !arraysEqual(selectedMonths, currentMonths),
		[selectedMonths, currentMonths]
	);

	const summaryText = useMemo(() => {
		const count = selectedMonths.length;
		const inactive = getInactiveMonthNames(selectedMonths);
		return `${count} month${count !== 1 ? 's' : ''} active \u2014 ${inactive}`;
	}, [selectedMonths]);

	const handleSave = useCallback(() => {
		patchVersion.mutate(
			{ id: versionId, schoolCalendarMonths: selectedMonths },
			{
				onSuccess: () => {
					queryClient.invalidateQueries({
						queryKey: opexKeys.lineItems(versionId),
					});
					toast.success('School calendar updated');
					onOpenChange(false);
				},
			}
		);
	}, [versionId, selectedMonths, patchVersion, queryClient, onOpenChange]);

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent aria-label="OpEx Settings" className="max-w-[480px]">
				<DialogHeader>
					<DialogTitle>OpEx Settings</DialogTitle>
					<DialogDescription>
						Configure school calendar and operational parameters.
					</DialogDescription>
				</DialogHeader>

				{/* School Calendar Section */}
				<div className="mt-2">
					<label className="text-sm font-medium text-(--text-primary)">Active School Months</label>
					<p className="mt-0.5 text-xs text-(--text-secondary)">
						Months when the school is open. New line items inherit this calendar.
					</p>

					{/* Month pills grid */}
					<div
						className="mt-3 grid grid-cols-6 gap-2"
						role="group"
						aria-label="Select active school months"
					>
						{MONTH_LABELS.map((label, index) => {
							const month = index + 1;
							const isActive = selectedMonths.includes(month);
							const isLastActive = isActive && selectedMonths.length === 1;

							return (
								<button
									key={month}
									type="button"
									role="switch"
									aria-checked={isActive}
									aria-label={`${label} ${isActive ? 'active' : 'inactive'}`}
									disabled={isLastActive}
									onClick={() => toggleMonth(month)}
									className={cn(
										'rounded-md border px-2 py-1.5 text-xs font-medium',
										'transition-all duration-(--duration-fast)',
										'focus-visible:outline-none focus-visible:ring-2',
										'focus-visible:ring-(--accent-500) focus-visible:ring-offset-1',
										isActive
											? [
													'border-(--accent-400) bg-(--accent-500)',
													'text-white',
													'hover:bg-(--accent-600)',
												]
											: [
													'border-(--workspace-border) bg-(--workspace-bg-subtle)',
													'text-(--text-muted)',
													'hover:border-(--accent-300) hover:text-(--text-secondary)',
												],
										isLastActive && 'cursor-not-allowed opacity-60'
									)}
								>
									{label}
								</button>
							);
						})}
					</div>

					{/* Presets */}
					<div className="mt-3 flex items-center gap-2">
						<span className="text-xs text-(--text-muted)">Presets:</span>
						<button
							type="button"
							onClick={() => applyPreset(SCHOOL_YEAR_MONTHS)}
							className={cn(
								'rounded-md border px-2 py-1 text-xs',
								'transition-colors duration-(--duration-fast)',
								'hover:border-(--accent-300) hover:text-(--accent-600)',
								'focus-visible:outline-none focus-visible:ring-2',
								'focus-visible:ring-(--accent-500) focus-visible:ring-offset-1',
								arraysEqual(selectedMonths, SCHOOL_YEAR_MONTHS)
									? 'border-(--accent-300) bg-(--accent-50) text-(--accent-600)'
									: 'border-(--workspace-border) text-(--text-secondary)'
							)}
						>
							School Year (Sep-Jun)
						</button>
						<button
							type="button"
							onClick={() => applyPreset(FULL_YEAR_MONTHS)}
							className={cn(
								'rounded-md border px-2 py-1 text-xs',
								'transition-colors duration-(--duration-fast)',
								'hover:border-(--accent-300) hover:text-(--accent-600)',
								'focus-visible:outline-none focus-visible:ring-2',
								'focus-visible:ring-(--accent-500) focus-visible:ring-offset-1',
								arraysEqual(selectedMonths, FULL_YEAR_MONTHS)
									? 'border-(--accent-300) bg-(--accent-50) text-(--accent-600)'
									: 'border-(--workspace-border) text-(--text-secondary)'
							)}
						>
							Full Year
						</button>
					</div>

					{/* Summary */}
					<p className="mt-3 text-xs text-(--text-secondary)" aria-live="polite">
						{summaryText}
					</p>
				</div>

				<DialogFooter>
					<Button
						variant="ghost"
						size="sm"
						onClick={() => onOpenChange(false)}
						disabled={patchVersion.isPending}
					>
						Cancel
					</Button>
					<Button
						variant="primary"
						size="sm"
						onClick={handleSave}
						disabled={!hasChanges || patchVersion.isPending}
						loading={patchVersion.isPending}
					>
						Save
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
