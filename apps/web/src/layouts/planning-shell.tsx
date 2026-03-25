import { useEffect, useRef } from 'react';
import { Outlet } from 'react-router';
import { cn } from '../lib/cn';
import { ContextBar } from '../components/shell/context-bar';
import { VersionAccentStrip } from '../components/shell/version-accent-strip';
import { RightPanel } from '../components/shell/right-panel';
import { useRightPanelStore } from '../stores/right-panel-store';
import { useWorkspaceContextStore } from '../stores/workspace-context-store';
import { useWorkspaceUrlSync } from '../hooks/use-workspace-url-sync';

export function PlanningShell() {
	useWorkspaceUrlSync();

	const versionId = useWorkspaceContextStore((s) => s.versionId);
	const openPanel = useRightPanelStore((s) => s.open);
	const hasAutoOpened = useRef(false);

	useEffect(() => {
		if (versionId && !hasAutoOpened.current) {
			openPanel('details');
			hasAutoOpened.current = true;
		}
	}, [versionId, openPanel]);

	return (
		<div className="flex flex-1 flex-col overflow-hidden">
			<div data-context-bar="">
				<ContextBar />
				<VersionAccentStrip />
			</div>
			<div className="flex flex-1 overflow-hidden">
				<main
					className={cn(
						'flex flex-1 flex-col overflow-y-auto scrollbar-thin',
						'min-w-[480px] px-6 pt-4 bg-(--workspace-bg)'
					)}
				>
					<Outlet />
				</main>
				<div data-right-panel="">
					<RightPanel />
				</div>
			</div>
		</div>
	);
}
