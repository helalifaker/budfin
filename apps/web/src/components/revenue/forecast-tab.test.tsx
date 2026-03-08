import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ForecastTab } from './forecast-tab';

vi.mock('../../hooks/use-revenue', () => ({
	useRevenueResults: vi.fn(),
}));

import { useRevenueResults } from '../../hooks/use-revenue';

const mockUseRevenueResults = vi.mocked(useRevenueResults);

describe('ForecastTab', () => {
	beforeEach(() => {
		mockUseRevenueResults.mockReset();
		mockUseRevenueResults.mockReturnValue({
			isLoading: false,
			data: {
				entries: [],
				otherRevenueEntries: [],
				summary: [
					{
						month: '1',
						grossRevenueHt: '1000.0000',
						discountAmount: '100.0000',
						netRevenueHt: '900.0000',
						vatAmount: '150.0000',
					},
				],
				totals: {
					grossRevenueHt: '1800.0000',
					discountAmount: '150.0000',
					netRevenueHt: '1650.0000',
					vatAmount: '150.0000',
					otherRevenueAmount: '375.0000',
					totalOperatingRevenue: '2025.0000',
				},
				rowCount: 2,
				revenueEngine: {
					rows: [],
				},
				executiveSummary: {
					rows: [
						{
							section: 'Executive Summary',
							label: 'Tuition Fees',
							monthlyAmounts: [
								'1000.0000',
								'0.0000',
								'0.0000',
								'0.0000',
								'0.0000',
								'0.0000',
								'0.0000',
								'0.0000',
								'800.0000',
								'0.0000',
								'0.0000',
								'0.0000',
							],
							annualTotal: '1800.0000',
							percentageOfRevenue: '0.888889',
							isTotal: true,
						},
						{
							section: 'Executive Summary',
							label: 'Registration Fees',
							monthlyAmounts: [
								'300.0000',
								'0.0000',
								'0.0000',
								'0.0000',
								'0.0000',
								'0.0000',
								'0.0000',
								'0.0000',
								'0.0000',
								'0.0000',
								'0.0000',
								'0.0000',
							],
							annualTotal: '300.0000',
							percentageOfRevenue: '0.148148',
							isTotal: true,
						},
						{
							section: 'Executive Summary',
							label: 'TOTAL OPERATING REVENUE',
							monthlyAmounts: [
								'1200.0000',
								'0.0000',
								'0.0000',
								'0.0000',
								'0.0000',
								'0.0000',
								'0.0000',
								'0.0000',
								'825.0000',
								'0.0000',
								'0.0000',
								'0.0000',
							],
							annualTotal: '2025.0000',
							percentageOfRevenue: '1.000000',
							isTotal: true,
						},
					],
					composition: [
						{
							label: 'Net Tuition',
							amount: '1650.0000',
							percentageOfRevenue: '0.814815',
						},
						{
							label: 'Registration',
							amount: '300.0000',
							percentageOfRevenue: '0.148148',
						},
					],
					monthlyTrend: [
						{ month: 1, amount: '1200.0000' },
						{ month: 9, amount: '825.0000' },
					],
				},
			},
		} as unknown as ReturnType<typeof useRevenueResults>);
	});

	it('renders the executive summary sheet and headline totals', () => {
		render(<ForecastTab versionId={1} />);

		expect(screen.getByText('Executive Summary Sheet')).toBeDefined();
		expect(screen.getByRole('table', { name: 'Executive summary matrix' })).toBeDefined();
		expect(screen.getAllByText('Net Tuition').length).toBeGreaterThan(0);
		expect(screen.getAllByText('Total Operating Revenue').length).toBeGreaterThan(0);
		expect(screen.getAllByText(/2.?025,00/).length).toBeGreaterThan(0);
		expect(screen.getByText('Registration Fees')).toBeDefined();
	});
});
