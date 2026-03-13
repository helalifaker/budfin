import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { RevenueKpiRibbon } from './kpi-ribbon';

afterEach(() => {
	cleanup();
});

describe('RevenueKpiRibbon', () => {
	it('renders five KPI cards with the new revenue totals', () => {
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

		expect(screen.getByText('Gross Tuition HT')).toBeDefined();
		expect(screen.getByText('Total Discounts')).toBeDefined();
		expect(screen.getByText('Net Revenue HT')).toBeDefined();
		expect(screen.getByText('Other Revenue')).toBeDefined();
		expect(screen.getByText('Total Operating Revenue')).toBeDefined();
		expect(screen.getByText(/SAR 42.?114 avg\/student/)).toBeDefined();
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

		expect(container.querySelectorAll('.opacity-60')).toHaveLength(5);
		expect(container.querySelectorAll('.animate-pulse')).toHaveLength(5);
	});
});
