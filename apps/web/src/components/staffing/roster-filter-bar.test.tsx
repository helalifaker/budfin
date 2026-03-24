import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { RosterFilterBar } from './roster-filter-bar';
import { EMPTY_FILTERS, type RosterFilters } from '../../lib/roster-filters';

afterEach(() => {
	cleanup();
});

const departments = ['Administration', 'Maternelle', 'Primaire'];

function renderBar(
	overrides: Partial<{
		filters: RosterFilters;
		onFiltersChange: (f: RosterFilters) => void;
		totalCount: number;
		visibleCount: number;
		departmentCount: number;
	}> = {}
) {
	const props = {
		filters: EMPTY_FILTERS,
		onFiltersChange: vi.fn(),
		departments,
		totalCount: 192,
		visibleCount: 192,
		departmentCount: 7,
		...overrides,
	};
	return { ...render(<RosterFilterBar {...props} />), onChange: props.onFiltersChange };
}

describe('RosterFilterBar', () => {
	it('renders search input and filter buttons', () => {
		renderBar();
		expect(screen.getByLabelText('Search employees')).toBeDefined();
		expect(screen.getByRole('button', { name: /department/i })).toBeDefined();
		expect(screen.getByLabelText('Filter by status')).toBeDefined();
		expect(screen.getByRole('button', { name: /cost mode/i })).toBeDefined();
	});

	it('shows footer with counts', () => {
		renderBar({ totalCount: 192, visibleCount: 50, departmentCount: 3 });
		expect(screen.getByText(/showing 50 of 192 employees in 3 department/i)).toBeDefined();
	});

	it('fires onFiltersChange when search input changes', () => {
		const { onChange } = renderBar();
		const input = screen.getByLabelText('Search employees');
		fireEvent.change(input, { target: { value: 'Alice' } });
		expect(onChange).toHaveBeenCalledWith({ ...EMPTY_FILTERS, searchQuery: 'Alice' });
	});

	it('does not show clear button when no filters active', () => {
		renderBar();
		expect(screen.queryByRole('button', { name: /clear/i })).toBeNull();
	});

	it('shows clear button when filters active', () => {
		renderBar({ filters: { ...EMPTY_FILTERS, departments: ['Primaire'] } });
		expect(screen.getByRole('button', { name: /clear/i })).toBeDefined();
	});

	it('calls onFiltersChange with EMPTY_FILTERS when clear is clicked', () => {
		const onChange = vi.fn();
		render(
			<RosterFilterBar
				filters={{ ...EMPTY_FILTERS, departments: ['Primaire'] }}
				onFiltersChange={onChange}
				departments={departments}
				totalCount={192}
				visibleCount={50}
				departmentCount={1}
			/>
		);
		fireEvent.click(screen.getByRole('button', { name: /clear/i }));
		expect(onChange).toHaveBeenCalledWith(EMPTY_FILTERS);
	});

	it('renders status toggle options', () => {
		renderBar();
		expect(screen.getByLabelText('Existing employees')).toBeDefined();
		expect(screen.getByLabelText('New employees')).toBeDefined();
		expect(screen.getByLabelText('Departed employees')).toBeDefined();
	});
});
