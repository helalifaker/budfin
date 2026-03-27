import { Outlet } from 'react-router';
import { AdminSidePanelProvider } from '../components/admin/admin-side-panel-context';
import { AdminSidePanel } from '../components/admin/admin-side-panel';

export function AdminShell() {
	return (
		<AdminSidePanelProvider>
			<div className="flex flex-1 overflow-hidden">
				<main className="flex flex-1 flex-col overflow-y-auto scrollbar-thin">
					<Outlet />
				</main>
				<AdminSidePanel />
			</div>
		</AdminSidePanelProvider>
	);
}
