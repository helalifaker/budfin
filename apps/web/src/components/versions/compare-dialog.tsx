import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useVersions } from '../../hooks/use-versions';
import type { BudgetVersion } from '../../hooks/use-versions';
import { Button } from '../ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from '../ui/dialog';

export type CompareDialogProps = {
	open: boolean;
	fiscalYear: number;
	onClose: () => void;
};

function CompareDialogContent({ fiscalYear, onClose }: Omit<CompareDialogProps, 'open'>) {
	const navigate = useNavigate();

	const { data: versionsData } = useVersions(fiscalYear);
	const versions: BudgetVersion[] = versionsData?.data ?? [];

	const [primaryId, setPrimaryId] = useState('');
	const [comparisonId, setComparisonId] = useState('');

	const canCompare = primaryId && comparisonId && primaryId !== comparisonId;

	function handleCompare() {
		if (!canCompare) return;
		const params = new URLSearchParams({
			fy: String(fiscalYear),
			version: primaryId,
			compare: comparisonId,
			period: 'FULL',
		});
		navigate(`/planning?${params.toString()}`);
		onClose();
	}

	return (
		<Dialog open onOpenChange={(v) => !v && onClose()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Compare Versions</DialogTitle>
					<DialogDescription>Select two versions from FY{fiscalYear} to compare.</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<div>
						<label className="block text-[length:var(--text-sm)] font-medium">
							Primary Version
						</label>
						<Select value={primaryId} onValueChange={setPrimaryId}>
							<SelectTrigger className="mt-1 w-full" aria-label="Select primary version">
								<SelectValue placeholder="Select version..." />
							</SelectTrigger>
							<SelectContent>
								{versions.map((v) => (
									<SelectItem key={v.id} value={String(v.id)}>
										{v.name} ({v.status})
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div>
						<label className="block text-[length:var(--text-sm)] font-medium">
							Comparison Version
						</label>
						<Select value={comparisonId} onValueChange={setComparisonId}>
							<SelectTrigger className="mt-1 w-full" aria-label="Select comparison version">
								<SelectValue placeholder="Select version..." />
							</SelectTrigger>
							<SelectContent>
								{versions.map((v) => (
									<SelectItem key={v.id} value={String(v.id)}>
										{v.name} ({v.status})
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{primaryId && comparisonId && primaryId === comparisonId && (
						<p className="text-[length:var(--text-xs)] text-[var(--color-warning)]" role="alert">
							Primary and comparison versions must be different.
						</p>
					)}
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button onClick={handleCompare} disabled={!canCompare}>
						Compare
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export function CompareDialog({ open, fiscalYear, onClose }: CompareDialogProps) {
	if (!open) return null;
	return <CompareDialogContent fiscalYear={fiscalYear} onClose={onClose} />;
}
