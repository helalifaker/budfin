import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { RevenueResultsResponse } from '@budfin/types';
import { ForecastGrid } from './forecast-grid';
import { useRevenueResults } from '../../hooks/use-revenue';
import { useGradeLevels } from '../../hooks/use-grade-levels';
import { useRevenueSelectionStore } from '../../stores/revenue-selection-store';

vi.mock('../../hooks/use-revenue', () => ({
	useRevenueResults: vi.fn(),
}));

vi.mock('../../hooks/use-grade-levels', () => ({
	useGradeLevels: vi.fn(),
}));

const mockUseRevenueResults = vi.mocked(useRevenueResults);
const mockUseGradeLevels = vi.mocked(useGradeLevels);

function makeResults(): RevenueResultsResponse {
	return {
		entries: [
			{
				academicPeriod: 'AY1',
				gradeLevel: 'PS',
				nationality: 'Francais',
				tariff: 'Plein',
				month: 1,
				grossRevenueHt: '1000.0000',
				discountAmount: '100.0000',
				scholarshipDeduction: '0.0000',
				netRevenueHt: '900.0000',
				vatAmount: '150.0000',
			},
			{
				academicPeriod: 'AY1',
				gradeLevel: 'MS',
				nationality: 'Autres',
				tariff: 'RP',
				month: 1,
				grossRevenueHt: '500.0000',
				discountAmount: '50.0000',
				scholarshipDeduction: '0.0000',
				netRevenueHt: '450.0000',
				vatAmount: '75.0000',
			},
			{
				academicPeriod: 'AY2',
				gradeLevel: 'GS',
				nationality: 'Nationaux',
				tariff: 'R3+',
				month: 9,
				grossRevenueHt: '750.0000',
				discountAmount: '25.0000',
				scholarshipDeduction: '0.0000',
				netRevenueHt: '725.0000',
				vatAmount: '112.5000',
			},
			{
				academicPeriod: 'AY2',
				gradeLevel: 'CP',
				nationality: 'Autres',
				tariff: 'Plein',
				month: 9,
				grossRevenueHt: '1250.0000',
				discountAmount: '0.0000',
				scholarshipDeduction: '0.0000',
				netRevenueHt: '1250.0000',
				vatAmount: '187.5000',
			},
		],
		otherRevenueEntries: [],
		summary: [],
		totals: {
			grossRevenueHt: '3500.0000',
			discountAmount: '175.0000',
			netRevenueHt: '3325.0000',
			vatAmount: '525.0000',
			otherRevenueAmount: '0.0000',
			totalOperatingRevenue: '3325.0000',
		},
		rowCount: 4,
		revenueEngine: {
			rows: [],
		},
		executiveSummary: {
			rows: [
				{
					section: 'Executive Summary',
					label: 'Tuition Fees',
					monthlyAmounts: [
						'1500.0000',
						'0.0000',
						'0.0000',
						'0.0000',
						'0.0000',
						'0.0000',
						'0.0000',
						'0.0000',
						'2000.0000',
						'0.0000',
						'0.0000',
						'0.0000',
					],
					annualTotal: '3500.0000',
					percentageOfRevenue: '1.000000',
					isTotal: false,
				},
				{
					section: 'Executive Summary',
					label: 'Discount Impact',
					monthlyAmounts: [
						'-150.0000',
						'0.0000',
						'0.0000',
						'0.0000',
						'0.0000',
						'0.0000',
						'0.0000',
						'0.0000',
						'-25.0000',
						'0.0000',
						'0.0000',
						'0.0000',
					],
					annualTotal: '-175.0000',
					percentageOfRevenue: '-0.052632',
					isTotal: false,
				},
				{
					section: 'Executive Summary',
					label: 'Registration Fees',
					monthlyAmounts: Array.from({ length: 12 }, () => '0.0000'),
					annualTotal: '0.0000',
					percentageOfRevenue: '0.000000',
					isTotal: false,
				},
				{
					section: 'Executive Summary',
					label: 'Activities & Services',
					monthlyAmounts: Array.from({ length: 12 }, () => '0.0000'),
					annualTotal: '0.0000',
					percentageOfRevenue: '0.000000',
					isTotal: false,
				},
				{
					section: 'Executive Summary',
					label: 'Examination Fees',
					monthlyAmounts: Array.from({ length: 12 }, () => '0.0000'),
					annualTotal: '0.0000',
					percentageOfRevenue: '0.000000',
					isTotal: false,
				},
				{
					section: 'Executive Summary',
					label: 'TOTAL OPERATING REV',
					monthlyAmounts: [
						'1350.0000',
						'0.0000',
						'0.0000',
						'0.0000',
						'0.0000',
						'0.0000',
						'0.0000',
						'0.0000',
						'1975.0000',
						'0.0000',
						'0.0000',
						'0.0000',
					],
					annualTotal: '3325.0000',
					percentageOfRevenue: '1.000000',
					isTotal: true,
				},
			],
			composition: [],
			monthlyTrend: [],
		},
	};
}

describe('ForecastGrid', () => {
	beforeEach(() => {
		mockUseRevenueResults.mockReset();
		mockUseGradeLevels.mockReset();
		useRevenueSelectionStore.getState().clearSelection();

		mockUseRevenueResults.mockReturnValue({
			data: makeResults(),
			isLoading: false,
		} as ReturnType<typeof useRevenueResults>);

		mockUseGradeLevels.mockReturnValue({
			data: {
				gradeLevels: [
					{ gradeCode: 'PS', band: 'MATERNELLE', displayOrder: 1 },
					{ gradeCode: 'MS', band: 'MATERNELLE', displayOrder: 2 },
					{ gradeCode: 'GS', band: 'MATERNELLE', displayOrder: 3 },
					{ gradeCode: 'CP', band: 'ELEMENTAIRE', displayOrder: 4 },
					{ gradeCode: 'CE1', band: 'ELEMENTAIRE', displayOrder: 5 },
					{ gradeCode: 'CE2', band: 'ELEMENTAIRE', displayOrder: 6 },
					{ gradeCode: 'CM1', band: 'ELEMENTAIRE', displayOrder: 7 },
					{ gradeCode: 'CM2', band: 'ELEMENTAIRE', displayOrder: 8 },
					{ gradeCode: '6EME', band: 'COLLEGE', displayOrder: 9 },
					{ gradeCode: '5EME', band: 'COLLEGE', displayOrder: 10 },
					{ gradeCode: '4EME', band: 'COLLEGE', displayOrder: 11 },
					{ gradeCode: '3EME', band: 'COLLEGE', displayOrder: 12 },
					{ gradeCode: '2NDE', band: 'LYCEE', displayOrder: 13 },
					{ gradeCode: '1ERE', band: 'LYCEE', displayOrder: 14 },
					{ gradeCode: 'TERM', band: 'LYCEE', displayOrder: 15 },
				],
			},
		} as ReturnType<typeof useGradeLevels>);
	});

	afterEach(() => {
		cleanup();
	});

	it('renders the six category rows with negative and summer formatting', () => {
		render(<ForecastGrid versionId={1} viewMode="category" period="both" />);

		expect(screen.getByRole('grid', { name: 'Revenue forecast grid' })).toBeDefined();
		expect(screen.getByText('Tuition Fees')).toBeDefined();
		expect(screen.getByText('Discount Impact')).toBeDefined();
		expect(screen.getByText('Grand Total')).toBeDefined();
		expect(screen.getByText('(175)')).toBeDefined();
		expect(screen.getAllByText('-').length).toBeGreaterThan(0);
	});

	it('renders 20 grade rows including band subtotals and grand total', () => {
		render(<ForecastGrid versionId={1} viewMode="grade" period="both" />);
		const grid = screen.getByRole('grid', { name: 'Revenue forecast grid' });

		expect(screen.getByText('PS')).toBeDefined();
		expect(screen.getByText('MS')).toBeDefined();
		expect(screen.getByText('GS')).toBeDefined();
		expect(screen.getByText('Maternelle')).toBeDefined();
		expect(screen.getByText('Elementaire')).toBeDefined();
		expect(screen.getByText('College')).toBeDefined();
		expect(screen.getByText('Lycee')).toBeDefined();
		expect(screen.getByText('Grand Total')).toBeDefined();
		expect(within(grid).getAllByRole('row')).toHaveLength(21);
	});

	it('filters visible columns by period', () => {
		render(<ForecastGrid versionId={1} viewMode="category" period="AY1" />);
		const grid = screen.getByRole('grid', { name: 'Revenue forecast grid' });

		expect(within(grid).getByRole('columnheader', { name: 'Jan' })).toBeDefined();
		expect(within(grid).queryByRole('columnheader', { name: 'Sep' })).toBeNull();
	});

	it('stores the selected row when a non-total row is clicked', () => {
		render(<ForecastGrid versionId={1} viewMode="tariff" period="both" />);

		fireEvent.click(screen.getByText('RP'));

		expect(useRevenueSelectionStore.getState().selection).toEqual({
			label: 'RP',
			viewMode: 'tariff',
		});
	});
});
