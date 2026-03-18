import { useState, useMemo, useCallback } from 'react';
import { cn } from '../../lib/cn';
import { useCreateAssignment } from '../../hooks/use-staffing';
import type { AutoSuggestResult } from '../../hooks/use-master-data';
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetFooter,
	SheetTitle,
	SheetDescription,
} from '../ui/sheet';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';

// ── Confidence badge styles ────────────────────────────────────────────────

const CONFIDENCE_STYLES: Record<string, { bg: string; text: string }> = {
	High: {
		bg: 'bg-(--color-success-bg)',
		text: 'text-(--color-success)',
	},
	Medium: {
		bg: 'bg-(--color-warning-bg)',
		text: 'text-(--color-warning)',
	},
};

// ── Props ──────────────────────────────────────────────────────────────────

interface AutoSuggestDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	versionId: number;
	suggestions: AutoSuggestResult[];
}

// ── Component ──────────────────────────────────────────────────────────────

export function AutoSuggestDialog({
	open,
	onOpenChange,
	versionId,
	suggestions,
}: AutoSuggestDialogProps) {
	const createAssignment = useCreateAssignment(versionId);

	// Track unchecked indices — default is empty (all checked).
	// This avoids syncing with suggestions prop changes.
	const [uncheckedIds, setUncheckedIds] = useState<Set<number>>(() => new Set());

	const checkedCount = suggestions.length - uncheckedIds.size;

	const uniqueEmployeeCount = useMemo(() => {
		const ids = new Set(suggestions.map((s) => s.employeeId));
		return ids.size;
	}, [suggestions]);

	const handleToggle = useCallback((index: number, checked: boolean) => {
		setUncheckedIds((prev) => {
			const next = new Set(prev);
			if (checked) {
				next.delete(index);
			} else {
				next.add(index);
			}
			return next;
		});
	}, []);

	const persistSuggestions = useCallback(
		(indices: number[]) => {
			for (const idx of indices) {
				const s = suggestions[idx];
				if (s) {
					createAssignment.mutate({
						band: s.band,
						disciplineId: s.disciplineId,
						employeeId: s.employeeId,
						fteShare: s.fteShare,
						hoursPerWeek: '0',
						note: null,
					});
				}
			}
			onOpenChange(false);
		},
		[suggestions, createAssignment, onOpenChange]
	);

	const handleAcceptSelected = useCallback(() => {
		const checkedIndices = suggestions.map((_, i) => i).filter((i) => !uncheckedIds.has(i));
		persistSuggestions(checkedIndices);
	}, [suggestions, uncheckedIds, persistSuggestions]);

	const handleAcceptAll = useCallback(() => {
		persistSuggestions(suggestions.map((_, i) => i));
	}, [suggestions, persistSuggestions]);

	const handleRejectAll = useCallback(() => {
		onOpenChange(false);
	}, [onOpenChange]);

	if (!open) return null;

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent side="bottom" className="h-[80vh]">
				<SheetHeader>
					<SheetTitle>Suggested Assignments {'\u2014'} Review and Accept</SheetTitle>
					<SheetDescription>
						{suggestions.length > 0
							? `${suggestions.length} assignments suggested for ${uniqueEmployeeCount} unassigned employees`
							: 'Review the results below.'}
					</SheetDescription>
				</SheetHeader>

				{suggestions.length === 0 ? (
					<div className="flex flex-1 items-center justify-center p-8">
						<p className="text-sm text-(--text-muted)">
							No suggestions available. All requirement lines may already be covered.
						</p>
					</div>
				) : (
					<div className="flex-1 overflow-auto px-6 py-4">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b border-(--workspace-border) bg-(--workspace-bg-muted)">
									<th className="w-10 px-3 py-2 text-left" />
									<th className="px-3 py-2 text-left text-(--text-xs) font-medium uppercase tracking-wider text-(--text-muted)">
										Employee Name
									</th>
									<th className="px-3 py-2 text-left text-(--text-xs) font-medium uppercase tracking-wider text-(--text-muted)">
										Band
									</th>
									<th className="px-3 py-2 text-left text-(--text-xs) font-medium uppercase tracking-wider text-(--text-muted)">
										Discipline
									</th>
									<th className="px-3 py-2 text-right text-(--text-xs) font-medium uppercase tracking-wider text-(--text-muted)">
										FTE Share
									</th>
									<th className="px-3 py-2 text-left text-(--text-xs) font-medium uppercase tracking-wider text-(--text-muted)">
										Confidence
									</th>
								</tr>
							</thead>
							<tbody>
								{suggestions.map((suggestion, index) => {
									const isChecked = !uncheckedIds.has(index);
									const defaultConfStyle = {
										bg: 'bg-(--color-warning-bg)',
										text: 'text-(--color-warning)',
									};
									const confStyle = CONFIDENCE_STYLES[suggestion.confidence] ?? defaultConfStyle;

									return (
										<tr
											key={`${suggestion.employeeId}-${suggestion.band}-${suggestion.disciplineId}`}
											className="border-b border-(--workspace-border)"
										>
											<td className="px-3 py-2">
												<Checkbox
													checked={isChecked}
													onCheckedChange={(checked) => handleToggle(index, checked === true)}
													aria-label={`Select ${suggestion.employeeName}`}
												/>
											</td>
											<td className="px-3 py-2 font-medium text-(--text-primary)">
												{suggestion.employeeName}
											</td>
											<td className="px-3 py-2 text-(--text-secondary)">{suggestion.band}</td>
											<td className="px-3 py-2 text-(--text-secondary)">
												{suggestion.disciplineCode}
											</td>
											<td className="px-3 py-2 text-right font-[family-name:var(--font-mono)] tabular-nums text-(--text-primary)">
												{suggestion.fteShare}
											</td>
											<td className="px-3 py-2">
												<span
													className={cn(
														'inline-flex items-center rounded-full px-2 py-0.5 text-(--text-xs) font-medium',
														confStyle.bg,
														confStyle.text
													)}
												>
													{suggestion.confidence}
												</span>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}

				<SheetFooter>
					<Button variant="outline" onClick={handleRejectAll}>
						Reject All
					</Button>
					<Button variant="outline" onClick={handleAcceptAll}>
						Accept All
					</Button>
					<Button onClick={handleAcceptSelected}>Accept Selected ({checkedCount})</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
