import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SettingsPage } from './settings';

const mockConfigData = {
	config: [
		{ key: 'max_sessions_per_user', value: '3', description: null, data_type: 'integer' },
		{ key: 'session_timeout_minutes', value: '30', description: null, data_type: 'integer' },
		{ key: 'lockout_threshold', value: '5', description: null, data_type: 'integer' },
		{ key: 'lockout_duration_minutes', value: '15', description: null, data_type: 'integer' },
		{ key: 'fiscal_year_start_month', value: '9', description: null, data_type: 'integer' },
		{ key: 'fiscal_year_range', value: '5', description: null, data_type: 'integer' },
		{ key: 'autosave_interval_seconds', value: '30', description: null, data_type: 'integer' },
	],
};

vi.mock('../../lib/api-client', () => ({
	apiClient: () => Promise.resolve(mockConfigData),
}));

vi.mock('../../hooks/use-delayed-skeleton', () => ({
	useDelayedSkeleton: () => false,
}));

vi.mock('../../components/admin/settings-card', () => ({
	SettingsCard: ({
		title,
		description,
		fields,
	}: {
		title: string;
		description: string;
		fields: Array<{ key: string; label: string; value: string }>;
	}) => (
		<div data-testid={`settings-card-${title.toLowerCase()}`}>
			<h2>{title}</h2>
			<p>{description}</p>
			{fields.map((f) => (
				<div key={f.key} data-testid={`field-${f.key}`}>
					<label>{f.label}</label>
					<span>{f.value}</span>
				</div>
			))}
		</div>
	),
}));

vi.mock('../../components/ui/button', () => ({
	Button: ({
		children,
		...props
	}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
		children: ReactNode;
		variant?: string;
		size?: string;
		loading?: boolean;
	}) => (
		<button type="button" {...props}>
			{children}
		</button>
	),
}));

vi.mock('../../components/ui/skeleton', () => ({
	Skeleton: ({ className }: { className?: string }) => (
		<div data-testid="skeleton" className={className} />
	),
}));

vi.mock('../../components/ui/toast-state', () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

function createTestQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: { retry: false, gcTime: 0 },
		},
	});
}

function renderWithQueryClient(ui: React.ReactElement) {
	const qc = createTestQueryClient();
	return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('SettingsPage', () => {
	afterEach(() => {
		cleanup();
	});

	it('renders page heading after data loads', async () => {
		renderWithQueryClient(<SettingsPage />);
		await waitFor(() => {
			expect(screen.getByText('System Settings')).toBeTruthy();
		});
	});

	it('renders settings cards for each group', async () => {
		renderWithQueryClient(<SettingsPage />);
		await waitFor(() => {
			expect(screen.getByTestId('settings-card-session')).toBeTruthy();
			expect(screen.getByTestId('settings-card-security')).toBeTruthy();
			expect(screen.getByTestId('settings-card-application')).toBeTruthy();
		});
	});

	it('renders session settings fields', async () => {
		renderWithQueryClient(<SettingsPage />);
		await waitFor(() => {
			expect(screen.getByText('Max Sessions per User')).toBeTruthy();
			expect(screen.getByText('Session Timeout (minutes)')).toBeTruthy();
		});
	});

	it('renders security settings fields', async () => {
		renderWithQueryClient(<SettingsPage />);
		await waitFor(() => {
			expect(screen.getByText('Lockout Threshold (attempts)')).toBeTruthy();
			expect(screen.getByText('Lockout Duration (minutes)')).toBeTruthy();
		});
	});

	it('renders application settings fields', async () => {
		renderWithQueryClient(<SettingsPage />);
		await waitFor(() => {
			expect(screen.getByText('Fiscal Year Start (month)')).toBeTruthy();
			expect(screen.getByText('Fiscal Year Range')).toBeTruthy();
			expect(screen.getByText('Autosave Interval (seconds)')).toBeTruthy();
		});
	});

	it('renders Save Changes button as disabled when no changes', async () => {
		renderWithQueryClient(<SettingsPage />);
		await waitFor(() => {
			const saveButton = screen.getByText('Save Changes');
			expect(saveButton).toBeTruthy();
			expect(saveButton.closest('button')?.disabled).toBe(true);
		});
	});

	it('renders configuration values from API data', async () => {
		renderWithQueryClient(<SettingsPage />);
		await waitFor(() => {
			expect(screen.getByTestId('field-max_sessions_per_user')).toBeTruthy();
			expect(screen.getByTestId('field-lockout_threshold')).toBeTruthy();
			expect(screen.getByTestId('field-fiscal_year_start_month')).toBeTruthy();
		});
	});
});
