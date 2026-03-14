import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RevenueInspectorContent } from './revenue-inspector';
import { useRevenueResults, useRevenueReadiness } from '../../hooks/use-revenue';
import { useWorkspaceContext } from '../../hooks/use-workspace-context';
import { useGradeLevels } from '../../hooks/use-grade-levels';
import { useChartColors } from '../../hooks/use-chart-colors';
import { useRevenueSelectionStore } from '../../stores/revenue-selection-store';
import { useRevenueSettingsDialogStore } from '../../stores/revenue-settings-dialog-store';

vi.mock('../../hooks/use-revenue', () => ({
	useRevenueResults: vi.fn(),
	useRevenueReadiness: vi.fn(),
}));

vi.mock('../../hooks/use-workspace-context', () => ({
	useWorkspaceContext: vi.fn(),
}));

vi.mock('../../hooks/use-grade-levels', () => ({
	useGradeLevels: vi.fn(),
}));

vi.mock('../../hooks/use-chart-colors', () => ({
	useChartColors: vi.fn(),
}));

const mockUseRevenueResults = vi.mocked(useRevenueResults);
const mockUseRevenueReadiness = vi.mocked(useRevenueReadiness);
const mockUseWorkspaceContext = vi.mocked(useWorkspaceContext);
const mockUseGradeLevels = vi.mocked(useGradeLevels);
const mockUseChartColors = vi.mocked(useChartColors);

function makeRevenueData() {
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
				academicPeriod: 'AY2',
				gradeLevel: 'CP',
				nationality: 'Autres',
				tariff: 'RP',
				month: 9,
				grossRevenueHt: '2000.0000',
				discountAmount: '200.0000',
				scholarshipDeduction: '0.0000',
				netRevenueHt: '1800.0000',
				vatAmount: '300.0000',
			},
		],
		otherRevenueEntries: [],
		summary: [],
		totals: {
			grossRevenueHt: '3000.0000',
			discountAmount: '300.0000',
			netRevenueHt: '2700.0000',
			vatAmount: '450.0000',
			otherRevenueAmount: '0.0000',
			totalOperatingRevenue: '2700.0000',
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
						'2000.0000',
						'0.0000',
						'0.0000',
						'0.0000',
					],
					annualTotal: '3000.0000',
					percentageOfRevenue: '1.000000',
					isTotal: false,
				},
				{
					section: 'Executive Summary',
					label: 'Discount Impact',
					monthlyAmounts: [
						'-100.0000',
						'0.0000',
						'0.0000',
						'0.0000',
						'0.0000',
						'0.0000',
						'0.0000',
						'0.0000',
						'-200.0000',
						'0.0000',
						'0.0000',
						'0.0000',
					],
					annualTotal: '-300.0000',
					percentageOfRevenue: '-0.111111',
					isTotal: false,
				},
				{
					section: 'Executive Summary',
					label: 'TOTAL OPERATING REV',
					monthlyAmounts: [
						'900.0000',
						'0.0000',
						'0.0000',
						'0.0000',
						'0.0000',
						'0.0000',
						'0.0000',
						'0.0000',
						'1800.0000',
						'0.0000',
						'0.0000',
						'0.0000',
					],
					annualTotal: '2700.0000',
					percentageOfRevenue: '1.000000',
					isTotal: true,
				},
			],
			composition: [
				{
					label: 'Net Tuition',
					amount: '2700.0000',
					percentageOfRevenue: '1.000000',
				},
			],
			monthlyTrend: [
				{ month: 1, amount: '900.0000' },
				{ month: 9, amount: '1800.0000' },
			],
		},
	};
}

function makeChartColors() {
	return {
		maternelle: '#4ade80',
		elementaire: '#60a5fa',
		college: '#f59e0b',
		lycee: '#ef4444',
		total: '#6b7280',
		grid: '#e5e7eb',
		axis: '#9ca3af',
		tooltipBorder: '#d1d5db',
		versionBudget: '#2463EB',
		versionForecast: '#16A34A',
		versionActual: '#D97706',
		fallback: '#9ca3af',
	};
}

describe('RevenueInspectorContent', () => {
	beforeEach(() => {
		useRevenueSelectionStore.getState().clearSelection();
		useRevenueSettingsDialogStore.setState({ isOpen: false, activeTab: 'feeGrid' });

		mockUseWorkspaceContext.mockReturnValue({
			versionId: 1,
		} as unknown as ReturnType<typeof useWorkspaceContext>);
		mockUseRevenueResults.mockReturnValue({
			data: makeRevenueData(),
			isLoading: false,
		} as unknown as ReturnType<typeof useRevenueResults>);
		mockUseRevenueReadiness.mockReturnValue({
			data: {
				feeGrid: { total: 90, complete: 90, ready: true },
				tariffAssignment: { reconciled: true, ready: true },
				discounts: { rpRate: '0.250000', r3Rate: '0.100000', ready: true },
				derivedRevenueSettings: { exists: true, ready: true },
				otherRevenue: { total: 20, configured: 20, ready: true },
				overallReady: true,
				readyCount: 5,
				totalCount: 5,
			},
			isLoading: false,
		} as unknown as ReturnType<typeof useRevenueReadiness>);
		mockUseGradeLevels.mockReturnValue({
			data: {
				gradeLevels: [
					{ gradeCode: 'PS', band: 'MATERNELLE', displayOrder: 1 },
					{ gradeCode: 'CP', band: 'ELEMENTAIRE', displayOrder: 4 },
				],
			},
		} as unknown as ReturnType<typeof useGradeLevels>);
		mockUseChartColors.mockReturnValue(makeChartColors() as ReturnType<typeof useChartColors>);
	});

	afterEach(() => {
		cleanup();
	});

	it('renders the default analytics view when no row is selected', () => {
		render(<RevenueInspectorContent />);

		expect(screen.getByText('Revenue composition')).toBeDefined();
		expect(screen.getByText('Monthly trend')).toBeDefined();
		expect(screen.getByText('Readiness checklist')).toBeDefined();
		expect(screen.getByRole('button', { name: 'Open Settings' })).toBeDefined();
	});

	it('renders the active inspector view when a selection is set', () => {
		useRevenueSelectionStore.getState().selectRow({
			id: 'category-tuition-fees',
			code: 'tuition-fees',
			label: 'Tuition Fees',
			viewMode: 'category',
			rowType: 'data',
		});

		render(<RevenueInspectorContent />);

		expect(screen.getByRole('heading', { name: 'Tuition Fees' })).toBeDefined();
		expect(screen.getByText('By Band')).toBeDefined();
		expect(screen.getByText('By Nationality')).toBeDefined();
		expect(screen.getByText('By Tariff')).toBeDefined();
	});

	it('renders the view mode badge with correct text', () => {
		useRevenueSelectionStore.getState().selectRow({
			id: 'category-tuition-fees',
			code: 'tuition-fees',
			label: 'Tuition Fees',
			viewMode: 'category',
			rowType: 'data',
		});

		render(<RevenueInspectorContent />);

		expect(screen.getByText('Category')).toBeDefined();
	});

	it('renders the grade view mode badge when in grade view', () => {
		useRevenueSelectionStore.getState().selectRow({
			id: 'grade-PS',
			code: 'PS',
			label: 'PS',
			viewMode: 'grade',
			rowType: 'data',
		});

		render(<RevenueInspectorContent />);

		expect(screen.getByText('Grade')).toBeDefined();
	});

	it('shows KPI cards with gross and net revenue values', () => {
		useRevenueSelectionStore.getState().selectRow({
			id: 'category-tuition-fees',
			code: 'tuition-fees',
			label: 'Tuition Fees',
			viewMode: 'category',
			rowType: 'data',
		});

		render(<RevenueInspectorContent />);

		expect(screen.getByText('Gross Revenue')).toBeDefined();
		expect(screen.getByText('Net Revenue')).toBeDefined();
	});

	it('calls clearSelection when back button is clicked', () => {
		useRevenueSelectionStore.getState().selectRow({
			id: 'category-tuition-fees',
			code: 'tuition-fees',
			label: 'Tuition Fees',
			viewMode: 'category',
			rowType: 'data',
		});

		render(<RevenueInspectorContent />);

		fireEvent.click(screen.getByRole('button', { name: 'Back to overview' }));

		expect(useRevenueSelectionStore.getState().selection).toBeNull();
	});

	it('opens the mapped settings tab when Edit in Settings is clicked', () => {
		useRevenueSelectionStore.getState().selectRow({
			id: 'category-tuition-fees',
			code: 'tuition-fees',
			label: 'Tuition Fees',
			viewMode: 'category',
			rowType: 'data',
		});

		render(<RevenueInspectorContent />);

		fireEvent.click(screen.getByRole('button', { name: 'Edit in Settings' }));

		expect(useRevenueSettingsDialogStore.getState().isOpen).toBe(true);
		expect(useRevenueSettingsDialogStore.getState().activeTab).toBe('feeGrid');
	});

	it('shows the formula card section', () => {
		useRevenueSelectionStore.getState().selectRow({
			id: 'category-tuition-fees',
			code: 'tuition-fees',
			label: 'Tuition Fees',
			viewMode: 'category',
			rowType: 'data',
		});

		render(<RevenueInspectorContent />);

		expect(screen.getByText('How revenue is calculated')).toBeDefined();
		expect(
			screen.getByText('Gross Revenue = Headcount x Tuition Fee HT per student')
		).toBeDefined();
	});

	it('shows band aggregate context in grade view', () => {
		useRevenueSelectionStore.getState().selectRow({
			id: 'grade-PS',
			code: 'PS',
			label: 'PS',
			viewMode: 'grade',
			rowType: 'data',
		});

		render(<RevenueInspectorContent />);

		expect(screen.getByText('Maternelle band context')).toBeDefined();
	});

	it('renders contextual breakdowns for grade view mode', () => {
		useRevenueSelectionStore.getState().selectRow({
			id: 'grade-PS',
			code: 'PS',
			label: 'PS',
			viewMode: 'grade',
			rowType: 'data',
		});

		render(<RevenueInspectorContent />);

		expect(screen.getByText('By Nationality')).toBeDefined();
		expect(screen.getByText('By Tariff')).toBeDefined();
		expect(screen.getByText('By Category')).toBeDefined();
	});
});
