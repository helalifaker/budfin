import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { StaffingKpiRibbon, type StaffingKpiRibbonProps } from './kpi-ribbon';

// Mock the Counter component to avoid animation timing issues in tests
vi.mock('../shared/counter', () => ({
	Counter: ({
		value,
		formatter,
		className,
	}: {
		value: number;
		formatter: (v: number) => string;
		className?: string;
	}) => (
		<span className={className} data-testid="counter">
			{formatter(value)}
		</span>
	),
}));

afterEach(() => {
	cleanup();
});

const defaultProps: StaffingKpiRibbonProps = {
	totalHeadcount: 42,
	totalAnnualStaffCost: 5400000,
	avgMonthlyCostPerEmployee: 10714,
	gosiTotal: 324000,
	ajeerTotal: 96000,
	eosTotal: 180000,
	isStale: false,
};

describe('StaffingKpiRibbon', () => {
	it('renders all 6 KPI cards', () => {
		render(<StaffingKpiRibbon {...defaultProps} />);

		expect(screen.getByText('Total Headcount')).toBeDefined();
		expect(screen.getByText('Annual Staff Cost')).toBeDefined();
		expect(screen.getByText('Avg Monthly / Employee')).toBeDefined();
		expect(screen.getByText('GOSI Total')).toBeDefined();
		expect(screen.getByText('Ajeer Total')).toBeDefined();
		expect(screen.getByText('EoS Total')).toBeDefined();
	});

	it('displays formatted headcount value', () => {
		render(<StaffingKpiRibbon {...defaultProps} />);

		expect(screen.getByText('42')).toBeDefined();
	});

	it('displays SAR-formatted monetary values', () => {
		render(<StaffingKpiRibbon {...defaultProps} />);

		expect(screen.getByText('SAR 5,400,000')).toBeDefined();
		expect(screen.getByText('SAR 10,714')).toBeDefined();
		expect(screen.getByText('SAR 324,000')).toBeDefined();
		expect(screen.getByText('SAR 96,000')).toBeDefined();
		expect(screen.getByText('SAR 180,000')).toBeDefined();
	});

	it('shows stale indicator when isStale is true', () => {
		render(<StaffingKpiRibbon {...defaultProps} isStale />);

		expect(screen.getByText('Stale — recalculate to refresh')).toBeDefined();
		expect(
			screen.getByRole('status', { name: 'Data is stale, recalculation needed' })
		).toBeDefined();
	});

	it('hides stale indicator when isStale is false', () => {
		render(<StaffingKpiRibbon {...defaultProps} isStale={false} />);

		expect(screen.queryByText('Stale — recalculate to refresh')).toBeNull();
	});

	it('shows skeleton loading state when isLoading is true', () => {
		const { container } = render(<StaffingKpiRibbon {...defaultProps} isLoading />);

		// Should show 6 skeleton elements (one per KPI card)
		const skeletons = container.querySelectorAll('[aria-hidden="true"].animate-shimmer');
		expect(skeletons.length).toBe(6);

		// Should not show any counter values
		expect(screen.queryAllByTestId('counter').length).toBe(0);
	});

	it('shows counter values when isLoading is false', () => {
		render(<StaffingKpiRibbon {...defaultProps} isLoading={false} />);

		expect(screen.getAllByTestId('counter').length).toBe(6);
	});

	it('has an accessible region landmark', () => {
		render(<StaffingKpiRibbon {...defaultProps} />);

		expect(
			screen.getByRole('region', { name: 'Staffing key performance indicators' })
		).toBeDefined();
	});

	it('renders zero values correctly', () => {
		render(
			<StaffingKpiRibbon
				totalHeadcount={0}
				totalAnnualStaffCost={0}
				avgMonthlyCostPerEmployee={0}
				gosiTotal={0}
				ajeerTotal={0}
				eosTotal={0}
				isStale={false}
			/>
		);

		expect(screen.getByText('0')).toBeDefined();
		// All SAR values should show SAR 0
		const sarZeros = screen.getAllByText('SAR 0');
		expect(sarZeros.length).toBe(5);
	});
});
