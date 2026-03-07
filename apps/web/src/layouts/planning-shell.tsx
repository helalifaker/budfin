import { Outlet } from 'react-router';
import { cn } from '../lib/cn';
import { ContextBar } from '../components/shell/context-bar';
import { RightPanel } from '../components/shell/right-panel';

export function PlanningShell() {
	return (
		<div className="flex flex-1 flex-col overflow-hidden">
			<ContextBar />
			<div className="flex flex-1 overflow-hidden">
				<main
					className={cn('flex flex-1 flex-col overflow-y-auto scrollbar-thin', 'min-w-[480px]')}
				>
					<Outlet />
				</main>
				<RightPanel />
			</div>
		</div>
	);
}
