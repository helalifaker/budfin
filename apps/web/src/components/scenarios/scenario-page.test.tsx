import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ScenarioPage } from './scenario-page';

// ── Mutable mock state ───────────────────────────────────────────────────────

let mockWorkspaceContext = {
	versionId: 10 as number | null,
};

let mockParamsResponse: { data: MockParam[] } | undefined = undefined;
let mockParamsLoading = false;
let mockComparisonData: { rows: MockComparisonRow[] } | undefined = undefined;
let mockComparisonLoading = false;

interface MockParam {
	id: number;
	versionId: number;
	scenarioName: string;
	newEnrollmentFactor: string;
	retentionAdjustment: string;
	feeCollectionRate: string;
	scholarshipAllocation: string;
	attritionRate: string;
	orsHours: string;
}

interface MockComparisonRow {
	metric: string;
	base: string;
	optimistic: string;
	pessimistic: string;
	optimisticDeltaPct: string;
	pessimisticDeltaPct: string;
}

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../hooks/use-workspace-context', () => ({
	useWorkspaceContext: () => mockWorkspaceContext,
}));

vi.mock('../../hooks/use-scenarios', () => ({
	useScenarioParameters: () => ({
		data: mockParamsResponse,
		isLoading: mockParamsLoading,
	}),
	useUpdateScenarioParameters: () => ({
		mutateAsync: vi.fn().mockResolvedValue({}),
		isPending: false,
	}),
	useScenarioComparison: () => ({
		data: mockComparisonData,
		isLoading: mockComparisonLoading,
	}),
}));

vi.mock('../../components/shared/page-transition', () => ({
	PageTransition: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../components/ui/card', () => ({
	Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
	CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	CardTitle: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
	CardDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
	CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../components/ui/input', () => ({
	Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock('../../components/ui/button', () => ({
	Button: ({
		children,
		...props
	}: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) => (
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

vi.mock('../../lib/format-money', () => ({
	formatMoney: (val: unknown) => {
		const num =
			typeof val === 'object' && val !== null && 'toNumber' in val
				? (val as { toNumber: () => number }).toNumber()
				: Number(val);
		return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(num);
	},
}));

vi.mock('../../lib/cn', () => ({
	cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

// ── Setup / Teardown ─────────────────────────────────────────────────────────

const defaultParams: MockParam[] = [
	{
		id: 10,
		versionId: 10,
		scenarioName: 'Base',
		newEnrollmentFactor: '1.000000',
		retentionAdjustment: '1.000000',
		feeCollectionRate: '1.000000',
		scholarshipAllocation: '0.000000',
		attritionRate: '0.000000',
		orsHours: '18.0000',
	},
	{
		id: 11,
		versionId: 10,
		scenarioName: 'Optimistic',
		newEnrollmentFactor: '1.100000',
		retentionAdjustment: '1.050000',
		feeCollectionRate: '1.000000',
		scholarshipAllocation: '0.000000',
		attritionRate: '0.000000',
		orsHours: '20.0000',
	},
	{
		id: 12,
		versionId: 10,
		scenarioName: 'Pessimistic',
		newEnrollmentFactor: '0.900000',
		retentionAdjustment: '0.950000',
		feeCollectionRate: '0.950000',
		scholarshipAllocation: '0.020000',
		attritionRate: '0.050000',
		orsHours: '16.0000',
	},
];

const defaultComparisonRows: MockComparisonRow[] = [
	{
		metric: 'Total Revenue (HT)',
		base: '5000000.0000',
		optimistic: '5500000.0000',
		pessimistic: '4500000.0000',
		optimisticDeltaPct: '10.00',
		pessimisticDeltaPct: '-10.00',
	},
	{
		metric: 'Total Staff Costs',
		base: '2000000.0000',
		optimistic: '2000000.0000',
		pessimistic: '2000000.0000',
		optimisticDeltaPct: '0.00',
		pessimisticDeltaPct: '0.00',
	},
	{
		metric: 'EBITDA',
		base: '2500000.0000',
		optimistic: '3000000.0000',
		pessimistic: '2000000.0000',
		optimisticDeltaPct: '20.00',
		pessimisticDeltaPct: '-20.00',
	},
	{
		metric: 'Net Profit',
		base: '2000000.0000',
		optimistic: '2500000.0000',
		pessimistic: '1500000.0000',
		optimisticDeltaPct: '25.00',
		pessimisticDeltaPct: '-25.00',
	},
];

beforeEach(() => {
	mockWorkspaceContext = { versionId: 10 };
	mockParamsResponse = { data: defaultParams };
	mockParamsLoading = false;
	mockComparisonData = { rows: defaultComparisonRows };
	mockComparisonLoading = false;
});

afterEach(() => {
	cleanup();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ScenarioPage', () => {
	it('renders loading skeletons when data is loading', () => {
		mockParamsLoading = true;

		render(<ScenarioPage />);

		const skeletons = screen.getAllByTestId('skeleton');
		expect(skeletons.length).toBeGreaterThan(0);
	});

	it('shows version select message when no versionId', () => {
		mockWorkspaceContext = { versionId: null };

		render(<ScenarioPage />);

		expect(screen.getByText('Select a budget version to configure scenarios.')).toBeTruthy();
	});

	it('renders page heading and description', () => {
		render(<ScenarioPage />);

		expect(screen.getByText('Scenario Modeling')).toBeTruthy();
		expect(
			screen.getByText(/Compare budget scenarios and configure what-if parameters/)
		).toBeTruthy();
	});

	it('renders parameter form with 6 input fields per scenario', () => {
		render(<ScenarioPage />);

		// 6 parameter labels
		expect(screen.getByText('New Enrollment Factor')).toBeTruthy();
		expect(screen.getByText('Retention Adjustment')).toBeTruthy();
		expect(screen.getByText('Fee Collection Rate')).toBeTruthy();
		expect(screen.getByText('Scholarship Allocation')).toBeTruthy();
		expect(screen.getByText('Attrition Rate')).toBeTruthy();
		expect(screen.getByText('ORS Hours')).toBeTruthy();

		// 3 scenario column headers in the parameter table
		const parameterTable = screen.getByText('Scenario Parameters').closest('[data-testid="card"]');
		expect(parameterTable).toBeTruthy();

		// 6 fields * 3 scenarios = 18 inputs
		const inputs = screen.getAllByRole('spinbutton');
		expect(inputs).toHaveLength(18);
	});

	it('renders comparison table with Base/Optimistic/Pessimistic columns', () => {
		render(<ScenarioPage />);

		// Comparison card header
		expect(screen.getByText('Scenario Comparison')).toBeTruthy();

		// Column headers: Metric, Base, Optimistic, Delta %, Pessimistic, Delta %
		const comparisonCard = screen.getByText('Scenario Comparison').closest('[data-testid="card"]');
		expect(comparisonCard).toBeTruthy();

		// Metric rows
		expect(screen.getByText('Total Revenue (HT)')).toBeTruthy();
		expect(screen.getByText('Total Staff Costs')).toBeTruthy();
	});

	it('renders Save Parameters button', () => {
		render(<ScenarioPage />);

		expect(screen.getByText('Save Parameters')).toBeTruthy();
	});

	it('displays positive variance values with + prefix and success color', () => {
		render(<ScenarioPage />);

		// Positive delta: +10.0%
		const positiveBadge = screen.getByText('+10.0%');
		expect(positiveBadge).toBeTruthy();
		expect(positiveBadge.className).toContain('color-success');
	});

	it('displays negative variance values with error color', () => {
		render(<ScenarioPage />);

		// Negative delta: -10.0%
		const negativeBadge = screen.getByText('-10.0%');
		expect(negativeBadge).toBeTruthy();
		expect(negativeBadge.className).toContain('color-error');
	});

	it('displays zero variance as "--"', () => {
		render(<ScenarioPage />);

		// The "Total Staff Costs" row has 0.00 delta -> displays as "--"
		const dashBadges = screen.getAllByText('--');
		expect(dashBadges.length).toBeGreaterThan(0);
	});

	it('renders comparison loading skeletons', () => {
		mockComparisonLoading = true;

		render(<ScenarioPage />);

		// Comparison card loading shows skeletons
		const skeletons = screen.getAllByTestId('skeleton');
		expect(skeletons.length).toBeGreaterThan(0);
	});

	it('shows no comparison data message when rows are empty', () => {
		mockComparisonData = { rows: [] };

		render(<ScenarioPage />);

		expect(
			screen.getByText('No comparison data available. Run the P&L calculation first.')
		).toBeTruthy();
	});
});
