import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RevenueInspectorContent } from './revenue-inspector';
import { useRevenueResults, useRevenueReadiness } from '../../hooks/use-revenue';
import { useWorkspaceContext } from '../../hooks/use-workspace-context';
import { useGradeLevels } from '../../hooks/use-grade-levels';
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

const mockUseRevenueResults = vi.mocked(useRevenueResults);
const mockUseRevenueReadiness = vi.mocked(useRevenueReadiness);
const mockUseWorkspaceContext = vi.mocked(useWorkspaceContext);
const mockUseGradeLevels = vi.mocked(useGradeLevels);

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
			composition: [{ label: 'Net Tuition', amount: '2700.0000', percentageOfRevenue: '1.000000' }],
			monthlyTrend: [
				{ month: 1, amount: '900.0000' },
				{ month: 9, amount: '1800.0000' },
			],
		},
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

	it('renders the active inspector view and opens the mapped settings tab', () => {
		useRevenueSelectionStore.getState().selectRow({
			label: 'Tuition Fees',
			viewMode: 'category',
		});

		render(<RevenueInspectorContent />);

		expect(screen.getByText('Selected row')).toBeDefined();
		expect(screen.getByRole('heading', { name: 'Tuition Fees' })).toBeDefined();
		expect(screen.getByText('By Band')).toBeDefined();
		expect(screen.getByText('By Nationality')).toBeDefined();
		expect(screen.getByText('By Tariff')).toBeDefined();

		fireEvent.click(screen.getByRole('button', { name: 'Edit in Settings' }));

		expect(useRevenueSettingsDialogStore.getState().isOpen).toBe(true);
		expect(useRevenueSettingsDialogStore.getState().activeTab).toBe('feeGrid');
	});
});
