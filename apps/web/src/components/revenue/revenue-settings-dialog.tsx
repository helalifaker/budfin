import { useEffect, useMemo, useRef, useState } from 'react';
import type { RevenueSettingsTab } from '@budfin/types';
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
import { FeeGridTab } from './fee-grid-tab';
import { OtherRevenueTab } from './other-revenue-tab';

import { ReadinessIndicator } from '../shared/readiness-indicator';
import { useRevenueReadiness } from '../../hooks/use-revenue';
import {
	getFirstIncompleteRevenueTab,
	getRevenueReadinessAreas,
	getRevenueTabReadiness,
} from '../../lib/revenue-readiness';
import { useRevenueSettingsDialogStore } from '../../stores/revenue-settings-dialog-store';
import { useRevenueSettingsDirtyStore } from '../../stores/revenue-settings-dirty-store';

const TAB_CONFIG: Array<{ id: RevenueSettingsTab; label: string }> = [
	{ id: 'feeGrid', label: 'Fee Grid' },
	{ id: 'otherRevenue', label: 'Other Revenue' },
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

export function RevenueSettingsDialog({
	versionId,
	isViewer,
	onClose,
}: {
	versionId: number;
	isViewer: boolean;
	onClose?: () => void;
}) {
	const isOpen = useRevenueSettingsDialogStore((state) => state.isOpen);
	const activeTab = useRevenueSettingsDialogStore((state) => state.activeTab);
	const setTab = useRevenueSettingsDialogStore((state) => state.setTab);
	const close = useRevenueSettingsDialogStore((state) => state.close);
	const dirtyFields = useRevenueSettingsDirtyStore((state) => state.dirtyFields);
	const markDirty = useRevenueSettingsDirtyStore((state) => state.markDirty);
	const clearTab = useRevenueSettingsDirtyStore((state) => state.clearTab);
	const clearAll = useRevenueSettingsDirtyStore((state) => state.clearAll);
	const [pendingTab, setPendingTab] = useState<RevenueSettingsTab | null>(null);
	const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
	const dirtyTabs = useMemo(
		() => [...dirtyFields.entries()].filter(([, fields]) => fields.size > 0).map(([tab]) => tab),
		[dirtyFields]
	);
	const hasDirtyTabs = dirtyTabs.length > 0;
	const { data: readiness } = useRevenueReadiness(versionId);
	const readinessAreas = useMemo(() => getRevenueReadinessAreas(readiness), [readiness]);
	const readyCount = readiness?.readyCount ?? readinessAreas.filter((area) => area.ready).length;
	const totalCount = readiness?.totalCount ?? readinessAreas.length;
	const completionPct = totalCount === 0 ? 100 : Math.round((readyCount / totalCount) * 100);
	const hasAutoRoutedRef = useRef(false);

	const dirtyTabNames = useMemo(
		() => dirtyTabs.map((tab) => TAB_LABELS[tab]).join(', '),
		[dirtyTabs]
	);

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
		onClose?.();
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
		onClose?.();
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

	useEffect(() => {
		if (!isOpen) {
			hasAutoRoutedRef.current = false;
		}
	}, [isOpen]);

	useEffect(() => {
		if (!isOpen || !readiness || readiness.overallReady) {
			return;
		}

		if (hasAutoRoutedRef.current) {
			return;
		}

		if (activeTab !== 'feeGrid') {
			hasAutoRoutedRef.current = true;
			return;
		}

		const nextTab = getFirstIncompleteRevenueTab(readiness);
		if (nextTab !== activeTab) {
			setTab(nextTab);
		}
		hasAutoRoutedRef.current = true;
	}, [activeTab, isOpen, readiness, setTab]);

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
							<DialogDescription>Manage fee grid and other revenue drivers.</DialogDescription>
							<div className="mt-4 space-y-2">
								<div className="flex items-center justify-between text-(--text-sm)">
									<span className="font-medium text-(--text-primary)">Setup progress</span>
									<span className="tabular-nums text-(--text-secondary)">
										{readyCount}/{totalCount} complete
									</span>
								</div>
								<div className="h-2 overflow-hidden rounded-full bg-(--workspace-bg-subtle)">
									<div
										className="h-full rounded-full bg-(--accent-500) transition-[width] duration-(--duration-fast)"
										style={{ width: `${completionPct}%` }}
									/>
								</div>
							</div>
						</DialogHeader>

						<div className="flex min-h-0 flex-1">
							<div className="w-64 shrink-0 border-r border-(--workspace-border) bg-(--workspace-bg-subtle) p-4">
								<Tabs value={activeTab} onValueChange={handleTabChange} orientation="vertical">
									<TabsList
										className="flex h-auto flex-col items-stretch gap-2 border-0"
										aria-label="Revenue settings tabs"
									>
										{TAB_CONFIG.map((tab) => (
											<TabsTrigger
												key={tab.id}
												value={tab.id}
												onClick={() => handleTabChange(tab.id)}
												className="justify-start rounded-xl border border-(--workspace-border) px-3 py-2 data-[state=active]:bg-(--workspace-bg-card)"
											>
												<div className="flex w-full items-center justify-between gap-2">
													<span>{tab.label}</span>
													<ReadinessIndicator
														ready={getRevenueTabReadiness(tab.id, readiness).ready}
														total={getRevenueTabReadiness(tab.id, readiness).total}
														size="sm"
													/>
												</div>
											</TabsTrigger>
										))}
									</TabsList>
								</Tabs>
							</div>

							<div className="flex min-h-0 flex-1 flex-col">
								<div className="flex-1 overflow-y-auto px-6 py-5">
									{isViewer && <ViewerBanner />}
									{!readiness?.overallReady && (
										<div className="mb-4 rounded-xl border border-(--color-warning) bg-(--color-warning-bg) px-4 py-3 text-(--text-sm) text-(--color-warning)">
											Complete the remaining setup areas before treating Revenue as
											calculation-ready.
										</div>
									)}

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
