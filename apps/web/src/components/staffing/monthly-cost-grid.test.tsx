import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MonthlyCostGrid } from './monthly-cost-grid';
import type { StaffCostRow } from '../../hooks/use-staffing';

function makeRow(overrides: Partial<StaffCostRow> = {}): StaffCostRow {
	return {
		group_key: 'January',
		total_gross_salary: '50000',
		total_allowances: '15000',
		total_social_charges: '5875',
		total_staff_cost: '70875',
		...overrides,
	};
}

const defaultTotals = {
	total_gross_salary: '600000',
	total_allowances: '180000',
	total_social_charges: '70500',
	total_staff_cost: '850500',
};

describe('MonthlyCostGrid', () => {
	afterEach(() => {
		cleanup();
	});

	describe('redacted mode', () => {
		it('hides Gross Salary and Allowances columns when isRedacted is true', () => {
			render(<MonthlyCostGrid data={[makeRow()]} totals={defaultTotals} isRedacted={true} />);

			expect(screen.queryByText('Gross Salary')).toBeNull();
			expect(screen.queryByText('Allowances')).toBeNull();
		});

		it('shows Social Charges and Total Cost when isRedacted is true', () => {
			render(<MonthlyCostGrid data={[makeRow()]} totals={defaultTotals} isRedacted={true} />);

			expect(screen.getByText('Social Charges')).toBeDefined();
			expect(screen.getByText('Total Cost')).toBeDefined();
		});

		it('shows all columns when isRedacted is false', () => {
			render(<MonthlyCostGrid data={[makeRow()]} totals={defaultTotals} isRedacted={false} />);

			expect(screen.getByText('Gross Salary')).toBeDefined();
			expect(screen.getByText('Allowances')).toBeDefined();
			expect(screen.getByText('Social Charges')).toBeDefined();
			expect(screen.getByText('Total Cost')).toBeDefined();
		});
	});

	describe('ARIA attributes', () => {
		it('has role="grid" on table element', () => {
			render(<MonthlyCostGrid data={[makeRow()]} totals={defaultTotals} isRedacted={false} />);

			expect(screen.getByRole('grid')).toBeDefined();
		});

		it('has aria-label on the grid', () => {
			render(<MonthlyCostGrid data={[makeRow()]} totals={defaultTotals} isRedacted={false} />);

			const grid = screen.getByRole('grid');
			expect(grid.getAttribute('aria-label')).toBeTruthy();
		});

		it('has aria-readonly="true" on the grid', () => {
			render(<MonthlyCostGrid data={[makeRow()]} totals={defaultTotals} isRedacted={false} />);

			const grid = screen.getByRole('grid');
			expect(grid.getAttribute('aria-readonly')).toBe('true');
		});

		it('has aria-rowcount and aria-colcount on the grid', () => {
			const rows = [makeRow(), makeRow({ group_key: 'February' })];
			render(<MonthlyCostGrid data={rows} totals={defaultTotals} isRedacted={false} />);

			const grid = screen.getByRole('grid');
			expect(grid.getAttribute('aria-rowcount')).toBeTruthy();
			expect(grid.getAttribute('aria-colcount')).toBeTruthy();
		});

		it('has aria-colindex on cells', () => {
			render(<MonthlyCostGrid data={[makeRow()]} totals={defaultTotals} isRedacted={false} />);

			const cells = screen.getAllByRole('gridcell');
			expect(cells.length).toBeGreaterThan(0);
			expect(cells[0]!.getAttribute('aria-colindex')).toBeTruthy();
		});
	});

	describe('empty state', () => {
		it('shows empty message when data is empty', () => {
			render(<MonthlyCostGrid data={[]} totals={null} isRedacted={false} />);

			expect(screen.getByText(/No staff cost data available/)).toBeDefined();
		});
	});
});
