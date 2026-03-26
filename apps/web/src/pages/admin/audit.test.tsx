import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuditPage } from './audit';

const mockAuditData = {
	entries: [
		{
			id: 1,
			user_id: 1,
			operation: 'UPDATE',
			table_name: 'budget_version',
			record_id: 10,
			old_values: null,
			new_values: { status: 'Published' },
			ip_address: '192.168.1.1',
			created_at: '2026-03-25T08:00:00Z',
		},
	],
	total: 1,
	page: 1,
	page_size: 50,
};

const mockCalcData = {
	entries: [
		{
			id: 1,
			run_id: 'run-123',
			version_id: 10,
			version_name: 'Budget 2026',
			fiscal_year: 2026,
			module: 'REVENUE',
			status: 'COMPLETED',
			started_at: '2026-03-25T08:00:00Z',
			completed_at: '2026-03-25T08:00:05Z',
			duration_ms: 5000,
			triggered_by: 'admin@efir.edu.sa',
			input_summary: null,
			output_summary: { rows: 90 },
		},
	],
	total: 1,
	page: 1,
	page_size: 20,
};

vi.mock('../../lib/api-client', () => ({
	apiClient: (path: string) => {
		if (path.includes('audit/calculation')) return Promise.resolve(mockCalcData);
		return Promise.resolve(mockAuditData);
	},
}));

vi.mock('../../hooks/use-versions', () => ({
	useVersions: () => ({
		data: { data: [] },
	}),
}));

vi.mock('../../components/admin/audit-filters', () => ({
	AuditFilters: (_props: { onFilterChange: (f: unknown) => void }) => (
		<div data-testid="audit-filters">Audit Filters</div>
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
	}) => (
		<button type="button" {...props}>
			{children}
		</button>
	),
}));

vi.mock('../../components/ui/skeleton', () => ({
	Skeleton: () => null,
	TableSkeleton: () => null,
}));

vi.mock('../../components/ui/tabs', () => ({
	Tabs: ({ children, defaultValue }: { children: ReactNode; defaultValue: string }) => (
		<div data-testid="tabs-root" data-default={defaultValue}>
			{children}
		</div>
	),
	TabsList: ({ children }: { children: ReactNode }) => <div role="tablist">{children}</div>,
	TabsTrigger: ({ children, value }: { children: ReactNode; value: string }) => (
		<button type="button" role="tab" data-value={value}>
			{children}
		</button>
	),
	TabsContent: ({ children, value }: { children: ReactNode; value: string }) => (
		<div role="tabpanel" data-value={value}>
			{children}
		</div>
	),
}));

vi.mock('../../components/ui/input', () => ({
	Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock('../../components/ui/select', () => ({
	Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	SelectTrigger: ({
		children,
		...props
	}: { children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) => (
		<div {...props}>{children}</div>
	),
	SelectValue: () => null,
	SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	SelectItem: ({ children }: { children: ReactNode; value: string }) => <div>{children}</div>,
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

describe('AuditPage', () => {
	afterEach(() => {
		cleanup();
	});

	it('renders page heading', () => {
		renderWithQueryClient(<AuditPage />);
		expect(screen.getByText('Audit Trail')).toBeTruthy();
	});

	it('renders Audit Log and Calculation History tabs', () => {
		renderWithQueryClient(<AuditPage />);
		const tabs = screen.getAllByRole('tab');
		expect(tabs.length).toBe(2);
		expect(screen.getByText('Audit Log')).toBeTruthy();
		expect(screen.getByText('Calculation History')).toBeTruthy();
	});

	it('renders audit log tab panel', () => {
		renderWithQueryClient(<AuditPage />);
		const panels = screen.getAllByRole('tabpanel');
		expect(panels.length).toBe(2);
	});

	it('renders audit filters component', () => {
		renderWithQueryClient(<AuditPage />);
		expect(screen.getByTestId('audit-filters')).toBeTruthy();
	});

	it('renders audit log table', async () => {
		renderWithQueryClient(<AuditPage />);
		await waitFor(() => {
			const tables = screen.getAllByRole('table');
			expect(tables.length).toBeGreaterThanOrEqual(1);
		});
	});

	it('renders calculation history filter controls', () => {
		renderWithQueryClient(<AuditPage />);
		expect(screen.getByLabelText('Filter by version')).toBeTruthy();
		expect(screen.getByLabelText('Filter by module')).toBeTruthy();
	});
});
