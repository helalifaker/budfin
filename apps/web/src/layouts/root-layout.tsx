import { Outlet } from 'react-router';
import { Sidebar } from '../components/shell/sidebar';

export function RootLayout() {
	return (
		<div className="flex h-screen overflow-hidden bg-[var(--workspace-bg)]">
			<Sidebar />
			<div className="flex flex-1 flex-col overflow-hidden">
				<Outlet />
			</div>
		</div>
	);
}
