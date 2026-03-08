import { useEffect, useRef } from 'react';
import { Outlet } from 'react-router';
import { cn } from '../lib/cn';
import { ContextBar } from '../components/shell/context-bar';
import { RightPanel } from '../components/shell/right-panel';
import { useRightPanelStore } from '../stores/right-panel-store';
import { useWorkspaceContext } from '../hooks/use-workspace-context';

export function PlanningShell() {
	const { versionId } = useWorkspaceContext();
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
			<ContextBar />
			<div className="flex flex-1 overflow-hidden">
				<main
					className={cn(
						'flex flex-1 flex-col overflow-y-auto scrollbar-thin',
						'min-w-[480px] px-6 pt-4 bg-[var(--workspace-bg)]'
					)}
				>
					<Outlet />
				</main>
				<RightPanel />
			</div>
		</div>
	);
}
