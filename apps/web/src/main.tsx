import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from './lib/api-client';
import { App } from './App';
import './index.css';

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			// Never retry client errors (4xx) — they represent business state (e.g.
			// STALE_DATA 409, NOT_FOUND 404) that won't resolve on retry.
			retry: (failureCount, error) => {
				if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
					return false;
				}
				return failureCount < 3;
			},
		},
	},
});
const root = document.getElementById('root');

if (!root) {
	throw new Error('Root element not found');
}

createRoot(root).render(
	<StrictMode>
		<QueryClientProvider client={queryClient}>
			<App />
		</QueryClientProvider>
	</StrictMode>
);
