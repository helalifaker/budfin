import { describe, expect, it, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MonthlyCostBudgetGrid } from './monthly-cost-budget-grid';
import type { CategoryMonthData, CategoryCostData } from '../../hooks/use-staffing';

afterEach(() => {
	cleanup();
});

function buildMockStaffData(): CategoryMonthData {
	return {
		months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
		categories: [
			{
				category: 'gross_salaries_existing',
				label: 'Existing Staff',
				parent: 'local_staff_salaries',
				values: [
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
			},
			{
				category: 'gross_salaries_new',
				label: 'New Staff',
				parent: 'local_staff_salaries',
				values: [
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
			},
			{
				category: 'gosi',
				label: 'GOSI',
				parent: null,
				values: [
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
			},
			{
				category: 'ajeer',
				label: 'Ajeer',
				parent: null,
				values: Array(12).fill('0.0000'),
			},
			{
				category: 'eos_accrual',
				label: 'EoS Accrual',
				parent: null,
				values: [
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

function buildMockCategoryCosts(): CategoryCostData {
	return {
		data: Array.from({ length: 12 }, (_, i) => ({
			month: i + 1,
			remplacements: '2000.0000',
			formation: '100.0000',
			resident_salaires: '3000.0000',
			resident_logement: '0.0000',
		})),
		grand_total: '61200.0000',
	};
}

describe('MonthlyCostBudgetGrid', () => {
	describe('AC-10: 12-month columns + annual total', () => {
		it('renders all 12 month column headers (Jan-Dec)', () => {
			render(
				<MonthlyCostBudgetGrid
					staffCostData={buildMockStaffData()}
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
					staffCostData={buildMockStaffData()}
					categoryCostData={buildMockCategoryCosts()}
					isLoading={false}
				/>
			);

			expect(screen.getByText('Annual')).toBeDefined();
		});

		it('renders the Category column header', () => {
			render(
				<MonthlyCostBudgetGrid
					staffCostData={buildMockStaffData()}
					categoryCostData={buildMockCategoryCosts()}
					isLoading={false}
				/>
			);

			expect(screen.getByText('Category')).toBeDefined();
		});

		it('uses aria grid role for accessibility', () => {
			render(
				<MonthlyCostBudgetGrid
					staffCostData={buildMockStaffData()}
					categoryCostData={buildMockCategoryCosts()}
					isLoading={false}
				/>
			);

			expect(screen.getByRole('grid')).toBeDefined();
		});

		it('sets aria-readonly on the grid', () => {
			render(
				<MonthlyCostBudgetGrid
					staffCostData={buildMockStaffData()}
					categoryCostData={buildMockCategoryCosts()}
					isLoading={false}
				/>
			);

			expect(screen.getByRole('grid').getAttribute('aria-readonly')).toBe('true');
		});
	});

	describe('AC-11: Category hierarchy with expandable parent rows', () => {
		it('renders Local Staff Salaries parent row', () => {
			render(
				<MonthlyCostBudgetGrid
					staffCostData={buildMockStaffData()}
					categoryCostData={buildMockCategoryCosts()}
					isLoading={false}
				/>
			);

			expect(screen.getByText('Local Staff Salaries')).toBeDefined();
		});

		it('renders child rows: Existing Staff and New Staff under Local Staff Salaries', () => {
			render(
				<MonthlyCostBudgetGrid
					staffCostData={buildMockStaffData()}
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
					staffCostData={buildMockStaffData()}
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
					staffCostData={buildMockStaffData()}
					categoryCostData={buildMockCategoryCosts()}
					isLoading={false}
				/>
			);

			expect(screen.getByText('Subtotal Local Staff')).toBeDefined();
		});

		it('renders Contrats Locaux parent row with children', () => {
			render(
				<MonthlyCostBudgetGrid
					staffCostData={buildMockStaffData()}
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
					staffCostData={buildMockStaffData()}
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
					staffCostData={buildMockStaffData()}
					categoryCostData={buildMockCategoryCosts()}
					isLoading={false}
				/>
			);

			const toggleButton = screen.getByRole('button', {
				name: /Local Staff Salaries/i,
			});
			expect(toggleButton).toBeDefined();

			// Initially expanded
			expect(screen.getByText('Existing Staff')).toBeDefined();

			// Collapse
			fireEvent.click(toggleButton);

			// Child rows should be hidden
			expect(screen.queryByText('Existing Staff')).toBeNull();
		});
	});

	describe('AC-12: Grand total row', () => {
		it('renders the Grand Total row', () => {
			render(
				<MonthlyCostBudgetGrid
					staffCostData={buildMockStaffData()}
					categoryCostData={buildMockCategoryCosts()}
					isLoading={false}
				/>
			);

			expect(screen.getByText('GRAND TOTAL')).toBeDefined();
		});

		it('displays formatted currency values in the Grand Total annual cell', () => {
			render(
				<MonthlyCostBudgetGrid
					staffCostData={buildMockStaffData()}
					categoryCostData={buildMockCategoryCosts()}
					isLoading={false}
				/>
			);

			// Grand total annual = staff costs (124000 + 20000 + 16920 + 0 + 6400) +
			// category costs (24000 + 1200 + 36000 + 0) = 228,520
			const grandTotalRow = screen.getByText('GRAND TOTAL').closest('tr');
			expect(grandTotalRow).not.toBeNull();
			expect(grandTotalRow!.textContent).toContain('228,520');
		});
	});

	describe('Loading state', () => {
		it('renders skeleton when isLoading is true', () => {
			render(
				<MonthlyCostBudgetGrid staffCostData={null} categoryCostData={null} isLoading={true} />
			);

			const rows = screen.getAllByRole('row');
			expect(rows.length).toBeGreaterThan(0);
		});
	});

	describe('Empty data', () => {
		it('shows empty state message when no data available', () => {
			render(
				<MonthlyCostBudgetGrid staffCostData={null} categoryCostData={null} isLoading={false} />
			);

			expect(screen.getByText(/No staff cost data available/i)).toBeDefined();
		});
	});

	describe('TC-001: Decimal.js currency formatting', () => {
		it('formats monetary values with SAR prefix and proper grouping', () => {
			render(
				<MonthlyCostBudgetGrid
					staffCostData={buildMockStaffData()}
					categoryCostData={buildMockCategoryCosts()}
					isLoading={false}
				/>
			);

			// Existing Staff annual total is 124,000
			const existingStaffRow = screen.getByText('Existing Staff').closest('tr');
			expect(existingStaffRow).not.toBeNull();
			expect(existingStaffRow!.textContent).toContain('124,000');
		});
	});

	describe('AC-02: September step-change indicator', () => {
		it('renders September column with amber triangle indicator', () => {
			render(
				<MonthlyCostBudgetGrid
					staffCostData={buildMockStaffData()}
					categoryCostData={buildMockCategoryCosts()}
					isLoading={false}
				/>
			);

			const sepIndicator = screen.getByLabelText('September indicator');
			expect(sepIndicator).toBeDefined();
		});

		it('Sep header has aria-description for accessibility', () => {
			render(
				<MonthlyCostBudgetGrid
					staffCostData={buildMockStaffData()}
					categoryCostData={buildMockCategoryCosts()}
					isLoading={false}
				/>
			);

			const sepHeader = screen.getByText('Sep').closest('th');
			expect(sepHeader).not.toBeNull();
			expect(sepHeader!.getAttribute('aria-description')).toBe('New positions start in September');
		});
	});

	describe('AC-03: Academic period filter', () => {
		it('renders period filter toggle group', () => {
			render(
				<MonthlyCostBudgetGrid
					staffCostData={buildMockStaffData()}
					categoryCostData={buildMockCategoryCosts()}
					isLoading={false}
				/>
			);

			expect(screen.getByText('Full Year')).toBeDefined();
			expect(screen.getByText('AY1')).toBeDefined();
			expect(screen.getByText('AY2')).toBeDefined();
			expect(screen.getByText('Summer')).toBeDefined();
		});

		it('shows only Jan-Jun when AY1 is selected', () => {
			render(
				<MonthlyCostBudgetGrid
					staffCostData={buildMockStaffData()}
					categoryCostData={buildMockCategoryCosts()}
					isLoading={false}
				/>
			);

			fireEvent.click(screen.getByText('AY1'));

			expect(screen.getByText('Jan')).toBeDefined();
			expect(screen.getByText('Jun')).toBeDefined();
			expect(screen.queryByText('Jul')).toBeNull();
			expect(screen.queryByText('Sep')).toBeNull();
			expect(screen.queryByText('Dec')).toBeNull();
		});

		it('shows only Sep-Dec when AY2 is selected', () => {
			render(
				<MonthlyCostBudgetGrid
					staffCostData={buildMockStaffData()}
					categoryCostData={buildMockCategoryCosts()}
					isLoading={false}
				/>
			);

			fireEvent.click(screen.getByText('AY2'));

			expect(screen.getByText('Sep')).toBeDefined();
			expect(screen.getByText('Dec')).toBeDefined();
			expect(screen.queryByText('Jan')).toBeNull();
			expect(screen.queryByText('Jun')).toBeNull();
		});

		it('shows only Jul-Aug when Summer is selected', () => {
			render(
				<MonthlyCostBudgetGrid
					staffCostData={buildMockStaffData()}
					categoryCostData={buildMockCategoryCosts()}
					isLoading={false}
				/>
			);

			fireEvent.click(screen.getByText('Summer'));

			expect(screen.getByText('Jul')).toBeDefined();
			expect(screen.getByText('Aug')).toBeDefined();
			expect(screen.queryByText('Jan')).toBeNull();
			expect(screen.queryByText('Sep')).toBeNull();
		});

		it('Annual column sums only visible months when period is filtered', () => {
			render(
				<MonthlyCostBudgetGrid
					staffCostData={buildMockStaffData()}
					categoryCostData={buildMockCategoryCosts()}
					isLoading={false}
				/>
			);

			// Switch to AY1 (Jan-Jun)
			fireEvent.click(screen.getByText('AY1'));

			// Existing Staff AY1 = 10000 * 6 = 60,000
			const existingRow = screen.getByText('Existing Staff').closest('tr');
			expect(existingRow).not.toBeNull();
			expect(existingRow!.textContent).toContain('60,000');
		});
	});
});
