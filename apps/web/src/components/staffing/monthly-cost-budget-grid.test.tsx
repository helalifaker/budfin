import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MonthlyCostBudgetGrid } from './monthly-cost-budget-grid';
import type { CategoryMonthData } from '../../hooks/use-staffing';

// Mock ResizeObserver for jsdom
class MockResizeObserver {
	observe() {}
	unobserve() {}
	disconnect() {}
}

beforeEach(() => {
	globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
});

afterEach(() => {
	cleanup();
});

function buildMockData(): CategoryMonthData {
	const zeroMonths = [
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
		'0.0000',
	];

	return {
		months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
		categories: [
			{
				key: 'gross_salaries_existing',
				label: 'Existing Staff',
				monthly_amounts: [
					'10000.0000',
					'10000.0000',
					'10000.0000',
					'10000.0000',
					'10000.0000',
					'10000.0000',
					'10000.0000',
					'10000.0000',
					'11000.0000',
					'11000.0000',
					'11000.0000',
					'11000.0000',
				],
				annual_total: '124000.0000',
			},
			{
				key: 'gross_salaries_new',
				label: 'New Staff',
				monthly_amounts: [
					'0.0000',
					'0.0000',
					'0.0000',
					'0.0000',
					'0.0000',
					'0.0000',
					'0.0000',
					'0.0000',
					'5000.0000',
					'5000.0000',
					'5000.0000',
					'5000.0000',
				],
				annual_total: '20000.0000',
			},
			{
				key: 'gosi',
				label: 'GOSI',
				monthly_amounts: [
					'1175.0000',
					'1175.0000',
					'1175.0000',
					'1175.0000',
					'1175.0000',
					'1175.0000',
					'1175.0000',
					'1175.0000',
					'1880.0000',
					'1880.0000',
					'1880.0000',
					'1880.0000',
				],
				annual_total: '16920.0000',
			},
			{
				key: 'ajeer',
				label: 'Ajeer',
				monthly_amounts: zeroMonths,
				annual_total: '0.0000',
			},
			{
				key: 'eos_accrual',
				label: 'EoS Accrual',
				monthly_amounts: [
					'500.0000',
					'500.0000',
					'500.0000',
					'500.0000',
					'500.0000',
					'500.0000',
					'500.0000',
					'500.0000',
					'600.0000',
					'600.0000',
					'600.0000',
					'600.0000',
				],
				annual_total: '6400.0000',
			},
		],
		annual_totals: {
			gross_salaries_existing: '124000.0000',
			gross_salaries_new: '20000.0000',
			gosi: '16920.0000',
			ajeer: '0.0000',
			eos_accrual: '6400.0000',
		},
	};
}

function buildMockCategoryCosts() {
	const zeroMonths = [
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
		'0.0000',
	];

	return {
		categories: [
			{
				key: 'remplacements',
				label: 'Remplacements',
				monthly_amounts: [
					'2000.0000',
					'2000.0000',
					'2000.0000',
					'2000.0000',
					'2000.0000',
					'2000.0000',
					'2000.0000',
					'2000.0000',
					'2000.0000',
					'2000.0000',
					'2000.0000',
					'2000.0000',
				],
				annual_total: '24000.0000',
			},
			{
				key: 'formation',
				label: 'Formation',
				monthly_amounts: [
					'100.0000',
					'100.0000',
					'100.0000',
					'100.0000',
					'100.0000',
					'100.0000',
					'100.0000',
					'100.0000',
					'100.0000',
					'100.0000',
					'100.0000',
					'100.0000',
				],
				annual_total: '1200.0000',
			},
			{
				key: 'resident_salaires',
				label: 'Resident Salaires',
				monthly_amounts: [
					'3000.0000',
					'3000.0000',
					'3000.0000',
					'3000.0000',
					'3000.0000',
					'3000.0000',
					'3000.0000',
					'3000.0000',
					'3000.0000',
					'3000.0000',
					'3000.0000',
					'3000.0000',
				],
				annual_total: '36000.0000',
			},
			{
				key: 'resident_logement',
				label: 'Resident Logement',
				monthly_amounts: zeroMonths,
				annual_total: '0.0000',
			},
		],
	};
}

describe('MonthlyCostBudgetGrid', () => {
	// AC-10: Grid displays 12-month columns + annual total
	describe('AC-10: 12-month columns + annual total', () => {
		it('renders all 12 month column headers (Jan-Dec)', () => {
			render(
				<MonthlyCostBudgetGrid
					staffCostData={buildMockData()}
					categoryCostData={buildMockCategoryCosts()}
					isLoading={false}
				/>
			);

			const monthNames = [
				'Jan',
				'Feb',
				'Mar',
				'Apr',
				'May',
				'Jun',
				'Jul',
				'Aug',
				'Sep',
				'Oct',
				'Nov',
				'Dec',
			];
			for (const month of monthNames) {
				expect(screen.getByText(month)).toBeDefined();
			}
		});

		it('renders the Annual Total column header', () => {
			render(
				<MonthlyCostBudgetGrid
					staffCostData={buildMockData()}
					categoryCostData={buildMockCategoryCosts()}
					isLoading={false}
				/>
			);

			expect(screen.getByText('Annual')).toBeDefined();
		});

		it('renders the Category column header', () => {
			render(
				<MonthlyCostBudgetGrid
					staffCostData={buildMockData()}
					categoryCostData={buildMockCategoryCosts()}
					isLoading={false}
				/>
			);

			expect(screen.getByText('Category')).toBeDefined();
		});

		it('uses aria grid role for accessibility', () => {
			render(
				<MonthlyCostBudgetGrid
					staffCostData={buildMockData()}
					categoryCostData={buildMockCategoryCosts()}
					isLoading={false}
				/>
			);

			expect(screen.getByRole('grid')).toBeDefined();
		});

		it('sets aria-readonly on the grid', () => {
			render(
				<MonthlyCostBudgetGrid
					staffCostData={buildMockData()}
					categoryCostData={buildMockCategoryCosts()}
					isLoading={false}
				/>
			);

			expect(screen.getByRole('grid').getAttribute('aria-readonly')).toBe('true');
		});
	});

	// AC-11: Category hierarchy with expandable parent rows
	describe('AC-11: Category hierarchy with expandable parent rows', () => {
		it('renders Local Staff Salaries parent row', () => {
			render(
				<MonthlyCostBudgetGrid
					staffCostData={buildMockData()}
					categoryCostData={buildMockCategoryCosts()}
					isLoading={false}
				/>
			);

			expect(screen.getByText('Local Staff Salaries')).toBeDefined();
		});

		it('renders child rows: Existing Staff and New Staff under Local Staff Salaries', () => {
			render(
				<MonthlyCostBudgetGrid
					staffCostData={buildMockData()}
					categoryCostData={buildMockCategoryCosts()}
					isLoading={false}
				/>
			);

			expect(screen.getByText('Existing Staff')).toBeDefined();
			expect(screen.getByText('New Staff')).toBeDefined();
		});

		it('renders Social Charges parent rows: GOSI, Ajeer, EoS Accrual', () => {
			render(
				<MonthlyCostBudgetGrid
					staffCostData={buildMockData()}
					categoryCostData={buildMockCategoryCosts()}
					isLoading={false}
				/>
			);

			expect(screen.getByText('GOSI')).toBeDefined();
			expect(screen.getByText('Ajeer')).toBeDefined();
			expect(screen.getByText('EoS Accrual')).toBeDefined();
		});

		it('renders Subtotal Local Staff row', () => {
			render(
				<MonthlyCostBudgetGrid
					staffCostData={buildMockData()}
					categoryCostData={buildMockCategoryCosts()}
					isLoading={false}
				/>
			);

			expect(screen.getByText('Subtotal Local Staff')).toBeDefined();
		});

		it('renders Contrats Locaux parent row with children', () => {
			render(
				<MonthlyCostBudgetGrid
					staffCostData={buildMockData()}
					categoryCostData={buildMockCategoryCosts()}
					isLoading={false}
				/>
			);

			expect(screen.getByText('Contrats Locaux')).toBeDefined();
			expect(screen.getByText('Remplacements')).toBeDefined();
			expect(screen.getByText('Formation')).toBeDefined();
		});

		it('renders Residents parent row with children', () => {
			render(
				<MonthlyCostBudgetGrid
					staffCostData={buildMockData()}
					categoryCostData={buildMockCategoryCosts()}
					isLoading={false}
				/>
			);

			expect(screen.getByText('Residents')).toBeDefined();
			expect(screen.getByText('Resident Salaires')).toBeDefined();
			expect(screen.getByText('Resident Logement')).toBeDefined();
		});

		it('allows toggling expandable parent rows', () => {
			render(
				<MonthlyCostBudgetGrid
					staffCostData={buildMockData()}
					categoryCostData={buildMockCategoryCosts()}
					isLoading={false}
				/>
			);

			// Local Staff Salaries should be expandable
			const toggleButton = screen.getByRole('button', {
				name: /Local Staff Salaries/i,
			});
			expect(toggleButton).toBeDefined();

			// Initially expanded -- children visible
			expect(screen.getByText('Existing Staff')).toBeDefined();

			// Collapse
			fireEvent.click(toggleButton);

			// After collapse, the child rows should be hidden
			expect(screen.queryByText('Existing Staff')).toBeNull();
		});
	});

	// AC-12: Grand total row sums all categories
	describe('AC-12: Grand total row', () => {
		it('renders the Grand Total row', () => {
			render(
				<MonthlyCostBudgetGrid
					staffCostData={buildMockData()}
					categoryCostData={buildMockCategoryCosts()}
					isLoading={false}
				/>
			);

			expect(screen.getByText('GRAND TOTAL')).toBeDefined();
		});

		it('displays formatted currency values in the Grand Total annual cell', () => {
			render(
				<MonthlyCostBudgetGrid
					staffCostData={buildMockData()}
					categoryCostData={buildMockCategoryCosts()}
					isLoading={false}
				/>
			);

			// Grand total annual = staff costs (124000 + 20000 + 16920 + 0 + 6400) +
			// category costs (24000 + 1200 + 36000 + 0) = 228,520
			// Check that the formatted value appears somewhere in the grid
			const grandTotalRow = screen.getByText('GRAND TOTAL').closest('tr');
			expect(grandTotalRow).not.toBeNull();
			expect(grandTotalRow!.textContent).toContain('228,520');
		});
	});

	// Edge case: loading state
	describe('Loading state', () => {
		it('renders skeleton when isLoading is true', () => {
			render(
				<MonthlyCostBudgetGrid staffCostData={null} categoryCostData={null} isLoading={true} />
			);

			// Should show skeleton loading elements
			const skeletons = screen.getAllByRole('row', { hidden: true });
			expect(skeletons.length).toBeGreaterThan(0);
		});
	});

	// Edge case: empty data
	describe('Empty data', () => {
		it('shows empty state message when no data available', () => {
			render(
				<MonthlyCostBudgetGrid staffCostData={null} categoryCostData={null} isLoading={false} />
			);

			expect(screen.getByText(/No staff cost data available/i)).toBeDefined();
		});
	});

	// TC-001: Currency formatting uses Decimal.js
	describe('TC-001: Decimal.js currency formatting', () => {
		it('formats monetary values with SAR prefix and proper grouping', () => {
			render(
				<MonthlyCostBudgetGrid
					staffCostData={buildMockData()}
					categoryCostData={buildMockCategoryCosts()}
					isLoading={false}
				/>
			);

			// Existing Staff annual total is 124,000 -- should appear formatted
			const existingStaffRow = screen.getByText('Existing Staff').closest('tr');
			expect(existingStaffRow).not.toBeNull();
			expect(existingStaffRow!.textContent).toContain('124,000');
		});
	});
});
