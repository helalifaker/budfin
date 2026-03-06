import { useEffect } from 'react';
import { RouterProvider } from 'react-router';
import { router } from './router';
import { useAuthStore } from './stores/auth-store';

export function App() {
	useEffect(() => {
		useAuthStore.getState().initialize();
	}, []);

	return <RouterProvider router={router} />;
}
