import { Outlet } from 'react-router';

export function ManagementShell() {
	return (
		<main className="flex flex-1 flex-col overflow-y-auto scrollbar-thin">
			<Outlet />
		</main>
	);
}
