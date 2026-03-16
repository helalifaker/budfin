import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { RevenueResultsResponse } from '@budfin/types';
import { ForecastGrid } from './forecast-grid';
import { useRevenueSelectionStore } from '../../stores/revenue-selection-store';
import {
	buildRevenueForecastGridRows,
	filterRevenueForecastRows,
} from '../../lib/revenue-workspace';

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
		useRevenueSelectionStore.getState().clearSelection();
	});

	afterEach(() => {
		cleanup();
	});

	it('renders the six category rows with negative and summer formatting', () => {
		const rows = buildRows('category');
		render(<ForecastGrid rows={rows} viewMode="category" period="both" totalLabel="Grand Total" />);

		expect(screen.getByRole('grid', { name: 'Revenue forecast grid' })).toBeDefined();
		expect(screen.getByText('Tuition Fees')).toBeDefined();
		expect(screen.getByText('Discount Impact')).toBeDefined();
		expect(screen.getByText('Grand Total')).toBeDefined();
		expect(screen.getByText('(175)')).toBeDefined();
		expect(screen.getAllByText('-').length).toBeGreaterThan(0);
	});

	it('renders grouped grade rows with subtotals and grand total', () => {
		const rows = buildRows('grade');
		render(<ForecastGrid rows={rows} viewMode="grade" period="both" totalLabel="Grand Total" />);
		const grid = screen.getByRole('grid', { name: 'Revenue forecast grid' });

		expect(screen.getByText('PS')).toBeDefined();
		expect(screen.getByText('MS')).toBeDefined();
		expect(screen.getByText('GS')).toBeDefined();
		expect(screen.getByText('Maternelle')).toBeDefined();
		expect(screen.getByText('Maternelle Subtotal')).toBeDefined();
		expect(screen.getByText('Elementaire')).toBeDefined();
		expect(screen.getByText('College')).toBeDefined();
		expect(screen.getByText('Lycee')).toBeDefined();
		expect(screen.getByText('Grand Total')).toBeDefined();
		expect(within(grid).getAllByRole('row').length).toBeGreaterThan(8);
	});

	it('filters visible columns by period', () => {
		const rows = buildRows('category');
		render(<ForecastGrid rows={rows} viewMode="category" period="AY1" totalLabel="Grand Total" />);
		const grid = screen.getByRole('grid', { name: 'Revenue forecast grid' });

		expect(within(grid).getByRole('columnheader', { name: 'Jan' })).toBeDefined();
		expect(within(grid).queryByRole('columnheader', { name: 'Sep' })).toBeNull();
	});

	it('stores the selected row when a non-total row is clicked', () => {
		const rows = buildRows('tariff');
		render(<ForecastGrid rows={rows} viewMode="tariff" period="both" totalLabel="Grand Total" />);

		const rpCell = document.querySelector<HTMLElement>(
			'[data-grid-row-id="tariff-RP"][data-col-index="0"]'
		);
		expect(rpCell).not.toBeNull();
		fireEvent.click(rpCell!);

		const selection = useRevenueSelectionStore.getState().selection;
		expect(selection).toMatchObject({
			id: 'tariff-RP',
			code: 'RP',
			label: 'RP',
			viewMode: 'tariff',
			rowType: 'data',
		});
	});
});

const GRADE_LEVELS = [
	makeGradeLevel(1, 'PS', 'MATERNELLE', 1),
	makeGradeLevel(2, 'MS', 'MATERNELLE', 2),
	makeGradeLevel(3, 'GS', 'MATERNELLE', 3),
	makeGradeLevel(4, 'CP', 'ELEMENTAIRE', 4),
	makeGradeLevel(5, 'CE1', 'ELEMENTAIRE', 5),
	makeGradeLevel(6, 'CE2', 'ELEMENTAIRE', 6),
	makeGradeLevel(7, 'CM1', 'ELEMENTAIRE', 7),
	makeGradeLevel(8, 'CM2', 'ELEMENTAIRE', 8),
	makeGradeLevel(9, '6EME', 'COLLEGE', 9),
	makeGradeLevel(10, '5EME', 'COLLEGE', 10),
	makeGradeLevel(11, '4EME', 'COLLEGE', 11),
	makeGradeLevel(12, '3EME', 'COLLEGE', 12),
	makeGradeLevel(13, '2NDE', 'LYCEE', 13),
	makeGradeLevel(14, '1ERE', 'LYCEE', 14),
	makeGradeLevel(15, 'TERM', 'LYCEE', 15),
];

function buildRows(viewMode: 'category' | 'grade' | 'nationality' | 'tariff') {
	return filterRevenueForecastRows({
		rows: buildRevenueForecastGridRows({
			data: makeResults(),
			viewMode,
			gradeLevels: GRADE_LEVELS,
		}),
		viewMode,
		bandFilter: 'ALL',
		exceptionFilter: 'all',
	});
}

function makeGradeLevel(
	id: number,
	gradeCode: string,
	band: 'MATERNELLE' | 'ELEMENTAIRE' | 'COLLEGE' | 'LYCEE',
	displayOrder: number
) {
	return {
		id,
		gradeCode,
		gradeName: gradeCode,
		band,
		maxClassSize: 25,
		defaultAy2Intake: null,
		plancherPct: '0.0000',
		ciblePct: '0.0000',
		plafondPct: '0.0000',
		displayOrder,
		version: 1,
	};
}
