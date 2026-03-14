import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { RevenueKpiRibbon } from './kpi-ribbon';

vi.mock('../shared/counter', () => ({
	Counter: ({ value, formatter }: { value: number; formatter: (v: number) => string }) => (
		<span>{formatter(value)}</span>
	),
}));

afterEach(() => {
	cleanup();
});

describe('RevenueKpiRibbon', () => {
	it('renders four KPI cards with the correct labels', () => {
		render(
			<RevenueKpiRibbon
				grossHt="58972254.0000"
				totalDiscounts="2333713.0000"
				netRevenue="56638541.0000"
				otherRevenue="11517700.0000"
				totalOperatingRevenue="68156191.0000"
				avgPerStudent="42114.0000"
				isStale={false}
			/>
		);

		expect(screen.getByText('Net Tuition HT')).toBeDefined();
		expect(screen.getByText('Other Revenue')).toBeDefined();
		expect(screen.getByText('Total Operating Revenue')).toBeDefined();
		expect(screen.getByText('SAR per Student')).toBeDefined();

		const listItems = screen.getAllByRole('listitem');
		expect(listItems).toHaveLength(4);
	});

	it('shows discount percentage in the Net Tuition HT subtitle', () => {
		render(
			<RevenueKpiRibbon
				grossHt="100000.0000"
				totalDiscounts="15000.0000"
				netRevenue="85000.0000"
				otherRevenue="5000.0000"
				totalOperatingRevenue="90000.0000"
				avgPerStudent="500.0000"
				isStale={false}
			/>
		);

		expect(screen.getByText('15.0% discount applied')).toBeDefined();
	});

	it('shows stale styling when revenue data is stale', () => {
		const { container } = render(
			<RevenueKpiRibbon
				grossHt="1000.0000"
				totalDiscounts="100.0000"
				netRevenue="900.0000"
				otherRevenue="50.0000"
				totalOperatingRevenue="950.0000"
				avgPerStudent="95.0000"
				isStale
			/>
		);

		expect(container.querySelectorAll('.opacity-60')).toHaveLength(4);
		expect(container.querySelectorAll('.animate-pulse')).toHaveLength(4);
	});

	it('handles zero gross tuition gracefully', () => {
		render(
			<RevenueKpiRibbon
				grossHt="0.0000"
				totalDiscounts="0.0000"
				netRevenue="0.0000"
				otherRevenue="0.0000"
				totalOperatingRevenue="0.0000"
				avgPerStudent="0.0000"
				isStale={false}
			/>
		);

		expect(screen.getByText('0.0% discount applied')).toBeDefined();
	});
});
