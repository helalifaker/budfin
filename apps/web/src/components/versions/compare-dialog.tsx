import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { cn } from '../../lib/cn';
import { useVersions } from '../../hooks/use-versions';
import type { BudgetVersion } from '../../hooks/use-versions';

export type CompareDialogProps = {
	open: boolean;
	fiscalYear: number;
	onClose: () => void;
};

function CompareDialogContent({ fiscalYear, onClose }: Omit<CompareDialogProps, 'open'>) {
	const dialogRef = useRef<HTMLDivElement>(null);
	const titleId = 'compare-dialog-title';
	const navigate = useNavigate();

	const { data: versionsData } = useVersions(fiscalYear);
	const versions: BudgetVersion[] = versionsData?.data ?? [];

	const [primaryId, setPrimaryId] = useState('');
	const [comparisonId, setComparisonId] = useState('');

	// Focus trap + Escape
	useEffect(() => {
		const dialog = dialogRef.current;
		if (!dialog) return;

		const focusable = dialog.querySelectorAll<HTMLElement>(
			'select, button, [tabindex]:not([tabindex="-1"])'
		);
		const first = focusable[0];
		const last = focusable[focusable.length - 1];
		first?.focus();

		function handleKeyDown(e: KeyboardEvent) {
			if (e.key === 'Escape') {
				onClose();
				return;
			}
			if (e.key !== 'Tab') return;
			if (e.shiftKey && document.activeElement === first) {
				e.preventDefault();
				last?.focus();
			} else if (!e.shiftKey && document.activeElement === last) {
				e.preventDefault();
				first?.focus();
			}
		}

		dialog.addEventListener('keydown', handleKeyDown);
		return () => dialog.removeEventListener('keydown', handleKeyDown);
	}, [onClose]);

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
		<>
			<div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} aria-hidden="true" />
			<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
				<div
					ref={dialogRef}
					role="dialog"
					aria-modal="true"
					aria-labelledby={titleId}
					className="w-[480px] rounded-lg bg-white shadow-xl"
				>
					<div className="border-b px-6 py-4">
						<h2 id={titleId} className="text-lg font-semibold">
							Compare Versions
						</h2>
						<p className="mt-0.5 text-sm text-slate-500">
							Select two versions from FY{fiscalYear} to compare.
						</p>
					</div>

					<div className="space-y-4 px-6 py-4">
						<div>
							<label htmlFor="compare-primary" className="block text-sm font-medium">
								Primary Version
							</label>
							<select
								id="compare-primary"
								value={primaryId}
								onChange={(e) => setPrimaryId(e.target.value)}
								className={cn(
									'mt-1 w-full rounded-md border border-slate-300',
									'px-3 py-2 text-sm'
								)}
								aria-label="Select primary version"
							>
								<option value="">Select version...</option>
								{versions.map((v) => (
									<option key={v.id} value={String(v.id)}>
										{v.name} ({v.status})
									</option>
								))}
							</select>
						</div>

						<div>
							<label htmlFor="compare-comparison" className="block text-sm font-medium">
								Comparison Version
							</label>
							<select
								id="compare-comparison"
								value={comparisonId}
								onChange={(e) => setComparisonId(e.target.value)}
								className={cn(
									'mt-1 w-full rounded-md border border-slate-300',
									'px-3 py-2 text-sm'
								)}
								aria-label="Select comparison version"
							>
								<option value="">Select version...</option>
								{versions.map((v) => (
									<option key={v.id} value={String(v.id)}>
										{v.name} ({v.status})
									</option>
								))}
							</select>
						</div>

						{primaryId && comparisonId && primaryId === comparisonId && (
							<p className="text-xs text-amber-600" role="alert">
								Primary and comparison versions must be different.
							</p>
						)}
					</div>

					<div className="flex items-center justify-end gap-3 border-t px-6 py-4">
						<button
							type="button"
							onClick={onClose}
							className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
						>
							Cancel
						</button>
						<button
							type="button"
							onClick={handleCompare}
							disabled={!canCompare}
							className={cn(
								'rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white',
								'hover:bg-blue-700 disabled:opacity-50'
							)}
						>
							Compare
						</button>
					</div>
				</div>
			</div>
		</>
	);
}

export function CompareDialog({ open, fiscalYear, onClose }: CompareDialogProps) {
	if (!open) return null;
	return <CompareDialogContent fiscalYear={fiscalYear} onClose={onClose} />;
}
