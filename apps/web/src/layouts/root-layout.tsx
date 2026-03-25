import { useEffect } from 'react';
import { Outlet } from 'react-router';
import { ErrorBoundary } from '../components/shared/error-boundary';
import { CommandPalette } from '../components/shared/command-palette';
import { Sidebar } from '../components/shell/sidebar';
import { initTheme } from '../lib/theme';

export function RootLayout() {
	useEffect(() => {
		initTheme();
	}, []);

	return (
		<ErrorBoundary>
			<div className="flex h-screen overflow-hidden bg-(--workspace-bg)">
				<div data-sidebar="">
					<Sidebar />
				</div>
				<div className="flex flex-1 flex-col overflow-hidden">
					<Outlet />
				</div>
			</div>
			<CommandPalette />
		</ErrorBoundary>
	);
}
