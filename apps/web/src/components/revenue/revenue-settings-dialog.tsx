import { useEffect, useMemo, useRef, useState } from 'react';
import type { RevenueReadinessResponse, RevenueSettingsTab } from '@budfin/types';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '../ui/alert-dialog';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { DiscountsTab } from './discounts-tab';
import { FeeGridTab } from './fee-grid-tab';
import { OtherRevenueTab } from './other-revenue-tab';
import { TariffAssignmentGrid } from './tariff-assignment-grid';
import { useRevenueSettingsDialogStore } from '../../stores/revenue-settings-dialog-store';
import { useRevenueSettingsDirtyStore } from '../../stores/revenue-settings-dirty-store';
import { cn } from '../../lib/cn';

const TAB_CONFIG: Array<{
	id: RevenueSettingsTab;
	label: string;
	readinessKey: keyof Pick<
		RevenueReadinessResponse,
		'feeGrid' | 'tariffAssignment' | 'discounts' | 'otherRevenue'
	>;
}> = [
	{ id: 'feeGrid', label: 'Fee Grid', readinessKey: 'feeGrid' },
	{ id: 'tariffAssignment', label: 'Tariff Assignment', readinessKey: 'tariffAssignment' },
	{ id: 'discounts', label: 'Discounts', readinessKey: 'discounts' },
	{ id: 'otherRevenue', label: 'Other Revenue', readinessKey: 'otherRevenue' },
];

const TAB_LABELS = Object.fromEntries(TAB_CONFIG.map((tab) => [tab.id, tab.label])) as Record<
	RevenueSettingsTab,
	string
>;

function ViewerBanner() {
	return (
		<div className="rounded-xl border border-(--workspace-border) bg-(--workspace-bg-subtle) px-4 py-3 text-(--text-sm) text-(--text-secondary)">
			Viewer mode is read-only. Revenue settings can be reviewed but not edited.
		</div>
	);
}

function ReadinessDot({ ready }: { ready: boolean }) {
	return (
		<span
			className={cn(
				'inline-block h-2 w-2 shrink-0 rounded-full',
				ready ? 'bg-(--color-success)' : 'bg-(--color-warning)'
			)}
			aria-hidden="true"
		/>
	);
}

function SetupProgressBar({ readyCount, totalCount }: { readyCount: number; totalCount: number }) {
	const remaining = totalCount - readyCount;
	const pct = totalCount > 0 ? (readyCount / totalCount) * 100 : 0;

	if (remaining <= 0) {
		return null;
	}

	return (
		<div className="border-b border-(--workspace-border) bg-(--color-warning-bg) px-6 py-3">
			<p className="text-(--text-sm) font-medium text-(--color-warning)">
				Complete {remaining} remaining {remaining === 1 ? 'step' : 'steps'} to enable revenue
				calculation
			</p>
			<div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-(--workspace-bg-muted)">
				<div
					className="h-full rounded-full bg-(--color-warning) transition-all duration-300"
					style={{ width: `${pct}%` }}
				/>
			</div>
		</div>
	);
}

export function RevenueSettingsDialog({
	versionId,
	isViewer,
	readiness,
	isImported,
}: {
	versionId: number;
	isViewer: boolean;
	readiness: RevenueReadinessResponse | undefined;
	isImported: boolean;
}) {
	const isOpen = useRevenueSettingsDialogStore((state) => state.isOpen);
	const activeTab = useRevenueSettingsDialogStore((state) => state.activeTab);
	const setTab = useRevenueSettingsDialogStore((state) => state.setTab);
	const close = useRevenueSettingsDialogStore((state) => state.close);
	const openSettings = useRevenueSettingsDialogStore((state) => state.open);
	const dirtyFields = useRevenueSettingsDirtyStore((state) => state.dirtyFields);
	const markDirty = useRevenueSettingsDirtyStore((state) => state.markDirty);
	const clearTab = useRevenueSettingsDirtyStore((state) => state.clearTab);
	const clearAll = useRevenueSettingsDirtyStore((state) => state.clearAll);
	const [pendingTab, setPendingTab] = useState<RevenueSettingsTab | null>(null);
	const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
	const autoPromptedVersionRef = useRef<number | null>(null);

	const dirtyTabs = useMemo(
		() => [...dirtyFields.entries()].filter(([, fields]) => fields.size > 0).map(([tab]) => tab),
		[dirtyFields]
	);
	const hasDirtyTabs = dirtyTabs.length > 0;

	const dirtyTabNames = useMemo(
		() => dirtyTabs.map((tab) => TAB_LABELS[tab]).join(', '),
		[dirtyTabs]
	);

	const readyCount = readiness?.readyCount ?? 0;
	const totalCount = readiness?.totalCount ?? 5;
	const setupIncomplete = readiness ? !readiness.overallReady : false;
	const shouldAutoOpen = setupIncomplete && !isViewer && !isImported;

	// Auto-navigate to the first incomplete tab when the dialog opens with incomplete setup
	useEffect(() => {
		if (!isOpen || !readiness || !setupIncomplete) {
			return;
		}

		const firstIncompleteTab = TAB_CONFIG.find((tab) => !readiness[tab.readinessKey].ready);
		if (firstIncompleteTab && firstIncompleteTab.id !== activeTab) {
			setTab(firstIncompleteTab.id);
		}
		// Only run when dialog opens, not on every readiness change
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isOpen]);

	// Auto-open the dialog on first page visit when setup is incomplete
	useEffect(() => {
		if (!shouldAutoOpen || !readiness) {
			return;
		}

		if (autoPromptedVersionRef.current === versionId) {
			return;
		}

		autoPromptedVersionRef.current = versionId;
		const frameId = window.requestAnimationFrame(() => {
			const firstIncomplete = TAB_CONFIG.find((tab) => !readiness[tab.readinessKey].ready);
			openSettings(firstIncomplete?.id ?? 'feeGrid');
		});
		return () => window.cancelAnimationFrame(frameId);
	}, [shouldAutoOpen, readiness, versionId, openSettings]);

	function handleOpenChange(nextOpen: boolean) {
		if (nextOpen) {
			return;
		}

		if (hasDirtyTabs) {
			setConfirmDiscardOpen(true);
			return;
		}

		clearAll();
		close();
	}

	function handleTabChange(nextTab: string) {
		const nextRevenueTab = nextTab as RevenueSettingsTab;
		if (nextRevenueTab === activeTab) {
			return;
		}

		if ((dirtyFields.get(activeTab)?.size ?? 0) > 0) {
			setPendingTab(nextRevenueTab);
			return;
		}

		setTab(nextRevenueTab);
	}

	function handleStayOnTab() {
		setPendingTab(null);
	}

	function handleSwitchTab() {
		if (!pendingTab) {
			return;
		}

		clearTab(activeTab);
		setTab(pendingTab);
		setPendingTab(null);
	}

	function handleDiscardClose() {
		clearAll();
		setConfirmDiscardOpen(false);
		close();
	}

	function handleInteraction(fieldId: string) {
		if (isViewer) {
			return;
		}

		markDirty(activeTab, fieldId);
	}

	function handleContentClick(event: React.MouseEvent<HTMLDivElement>) {
		const button = (event.target as HTMLElement).closest('button');
		if (!button) {
			return;
		}

		if (button.textContent?.trim().startsWith('Save ')) {
			clearTab(activeTab);
		}
	}

	return (
		<>
			<Dialog open={isOpen} onOpenChange={handleOpenChange}>
				<DialogContent
					aria-label="Revenue Settings"
					className="h-[90vh] max-w-[90vw] overflow-hidden rounded-3xl bg-(--workspace-bg-card) p-0"
				>
					<div className="flex h-full flex-col">
						<DialogHeader className="border-b border-(--workspace-border) px-6 py-5">
							<DialogTitle>Revenue Settings</DialogTitle>
							<DialogDescription>
								Manage fee grid, tariff assignment, discounts, and other revenue drivers.
							</DialogDescription>
						</DialogHeader>

						{readiness && setupIncomplete && (
							<SetupProgressBar readyCount={readyCount} totalCount={totalCount} />
						)}

						<div className="flex min-h-0 flex-1">
							<div className="w-64 shrink-0 border-r border-(--workspace-border) bg-(--workspace-bg-subtle) p-4">
								<Tabs value={activeTab} onValueChange={handleTabChange} orientation="vertical">
									<TabsList
										className="flex h-auto flex-col items-stretch gap-2 border-0"
										aria-label="Revenue settings tabs"
									>
										{TAB_CONFIG.map((tab) => {
											const isReady = readiness ? readiness[tab.readinessKey].ready : true;
											return (
												<TabsTrigger
													key={tab.id}
													value={tab.id}
													onClick={() => handleTabChange(tab.id)}
													className="justify-start rounded-xl border border-(--workspace-border) px-3 py-2 data-[state=active]:bg-(--workspace-bg-card)"
												>
													<span className="flex items-center gap-2">
														{readiness && <ReadinessDot ready={isReady} />}
														{tab.label}
													</span>
												</TabsTrigger>
											);
										})}
									</TabsList>
								</Tabs>

								{readiness && (
									<div className="mt-4 px-3 text-(--text-xs) text-(--text-muted)">
										{readyCount}/{totalCount} complete
									</div>
								)}
							</div>

							<div className="flex min-h-0 flex-1 flex-col">
								<div className="flex-1 overflow-y-auto px-6 py-5">
									{isViewer && <ViewerBanner />}

									{pendingTab && (
										<div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-(--color-warning) bg-(--color-warning-bg) px-4 py-3 text-(--text-sm) text-(--color-warning)">
											<span>You have unsaved changes. Switch anyway?</span>
											<div className="flex items-center gap-2">
												<Button type="button" variant="outline" size="sm" onClick={handleStayOnTab}>
													Stay
												</Button>
												<Button type="button" size="sm" onClick={handleSwitchTab}>
													Switch
												</Button>
											</div>
										</div>
									)}

									<div
										onInputCapture={(event) => {
											const target = event.target as HTMLElement;
											handleInteraction(
												target.getAttribute('name') ??
													target.getAttribute('aria-label') ??
													target.id ??
													target.tagName.toLowerCase()
											);
										}}
										onChangeCapture={(event) => {
											const target = event.target as HTMLElement;
											handleInteraction(
												target.getAttribute('name') ??
													target.getAttribute('aria-label') ??
													target.id ??
													target.tagName.toLowerCase()
											);
										}}
										onClickCapture={handleContentClick}
									>
										<Tabs value={activeTab} onValueChange={handleTabChange}>
											<TabsContent value="feeGrid">
												<FeeGridTab
													versionId={versionId}
													academicPeriod="both"
													isReadOnly={isViewer}
												/>
											</TabsContent>
											<TabsContent value="tariffAssignment">
												<TariffAssignmentGrid
													versionId={versionId}
													academicPeriod="both"
													isReadOnly={isViewer}
												/>
											</TabsContent>
											<TabsContent value="discounts">
												<DiscountsTab versionId={versionId} isReadOnly={isViewer} />
											</TabsContent>
											<TabsContent value="otherRevenue">
												<OtherRevenueTab versionId={versionId} isReadOnly={isViewer} />
											</TabsContent>
										</Tabs>
									</div>
								</div>
							</div>
						</div>
					</div>
				</DialogContent>
			</Dialog>

			<AlertDialog open={confirmDiscardOpen} onOpenChange={setConfirmDiscardOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Discard changes?</AlertDialogTitle>
						<AlertDialogDescription>
							Unsaved changes in {dirtyTabNames || 'this dialog'}. Discard and close?
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction onClick={handleDiscardClose}>Discard</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
