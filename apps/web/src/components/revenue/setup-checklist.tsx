import { useEffect, useRef, useState } from 'react';
import type { RevenueReadinessResponse, RevenueSettingsTab } from '@budfin/types';
import { cn } from '../../lib/cn';
import { Button } from '../ui/button';
import { useRevenueSettingsDialogStore } from '../../stores/revenue-settings-dialog-store';

type RevenueSetupChecklistProps = {
	versionId: number;
	lastCalculatedAt: string | null | undefined;
	readiness: RevenueReadinessResponse;
	forceOpen?: boolean;
	onClose?: (() => void) | undefined;
};

const AREA_CONFIG: Array<{
	key: keyof Pick<RevenueReadinessResponse, 'feeGrid' | 'otherRevenue'>;
	label: string;
	tab: RevenueSettingsTab;
}> = [
	{ key: 'feeGrid', label: 'Fee Grid', tab: 'feeGrid' },
	{ key: 'otherRevenue', label: 'Other Revenue', tab: 'otherRevenue' },
];

function getDismissalKey(versionId: number) {
	return `revenue-setup-dismissed-${versionId}`;
}

export function RevenueSetupChecklist({
	versionId,
	lastCalculatedAt,
	readiness,
	forceOpen = false,
	onClose,
}: RevenueSetupChecklistProps) {
	const [closedVersionId, setClosedVersionId] = useState<number | null>(null);
	const headingRef = useRef<HTMLHeadingElement | null>(null);
	const openSettings = useRevenueSettingsDialogStore((state) => state.open);
	const dismissalKey = getDismissalKey(versionId);
	const open =
		forceOpen ||
		(closedVersionId !== versionId &&
			lastCalculatedAt === null &&
			lastCalculatedAt !== undefined &&
			!readiness.overallReady &&
			sessionStorage.getItem(dismissalKey) === null);

	useEffect(() => {
		if (!open) {
			return;
		}

		const frameId = window.requestAnimationFrame(() => {
			headingRef.current?.focus();
		});

		return () => window.cancelAnimationFrame(frameId);
	}, [onClose, open, versionId]);

	useEffect(() => {
		if (!open) {
			return;
		}

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				setClosedVersionId(versionId);
				onClose?.();
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [onClose, open, versionId]);

	if (!open) {
		return null;
	}

	const openFirstIncomplete = () => {
		const nextArea = AREA_CONFIG.find((area) => !readiness[area.key].ready) ?? AREA_CONFIG[0];
		openSettings(nextArea?.tab ?? 'feeGrid');
		setClosedVersionId(versionId);
		onClose?.();
	};

	const handleSkip = () => {
		sessionStorage.setItem(dismissalKey, 'true');
		setClosedVersionId(versionId);
		onClose?.();
	};

	return (
		<div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-4">
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="revenue-setup-checklist-title"
				className="w-full max-w-2xl rounded-2xl border border-(--workspace-border) bg-(--workspace-bg-card) p-6 shadow-(--shadow-lg)"
			>
				<div className="space-y-2">
					<h2
						id="revenue-setup-checklist-title"
						ref={headingRef}
						tabIndex={-1}
						className="text-(--text-xl) font-semibold text-(--text-primary) outline-none"
					>
						Finish revenue setup
					</h2>
					<p className="text-(--text-sm) text-(--text-muted)">
						Complete the remaining inputs before calculating revenue.
					</p>
				</div>

				<div className="mt-5 space-y-3">
					{AREA_CONFIG.map((area) => {
						const areaState = readiness[area.key];
						return (
							<div
								key={area.key}
								className="flex items-center justify-between rounded-xl border border-(--workspace-border) bg-(--workspace-bg-subtle) px-4 py-3"
							>
								<div>
									<div className="font-medium text-(--text-primary)">{area.label}</div>
									<div
										className={cn(
											'text-(--text-xs)',
											areaState.ready ? 'text-(--color-success)' : 'text-(--text-muted)'
										)}
									>
										{areaState.ready ? 'Ready' : 'Needs attention'}
									</div>
								</div>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => {
										openSettings(area.tab);
										setClosedVersionId(versionId);
										onClose?.();
									}}
								>
									{`Edit ${area.label}`}
								</Button>
							</div>
						);
					})}
				</div>

				<div className="mt-5 flex items-center justify-between gap-3 border-t border-(--workspace-border) pt-4">
					<div className="text-(--text-sm) text-(--text-secondary)">
						{readiness.readyCount} of {readiness.totalCount} complete
					</div>
					<div className="flex items-center gap-2">
						<Button type="button" variant="outline" size="sm" onClick={handleSkip}>
							Skip for Now
						</Button>
						<Button type="button" size="sm" onClick={openFirstIncomplete}>
							Open Settings
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}
