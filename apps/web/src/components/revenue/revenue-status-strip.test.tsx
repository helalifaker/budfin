import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { RevenueStatusStrip } from './revenue-status-strip';

let mockDirtyFields = new Map<string, Set<string>>();

vi.mock('../../stores/revenue-settings-dirty-store', () => ({
	useRevenueSettingsDirtyStore: (
		selector: (state: { dirtyFields: Map<string, Set<string>> }) => unknown
	) => selector({ dirtyFields: mockDirtyFields }),
}));

afterEach(() => {
	cleanup();
	mockDirtyFields = new Map();
});

describe('RevenueStatusStrip', () => {
	it('renders the status segments with AST timestamp formatting', () => {
		render(
			<RevenueStatusStrip
				lastCalculated="2026-03-14T09:30:00.000Z"
				enrollmentStale={false}
				downstreamStale={['STAFFING', 'PNL']}
				readiness={{
					feeGrid: { total: 90, complete: 90, ready: true },
					tariffAssignment: { reconciled: true, ready: true },
					discounts: { rpRate: '0.250000', r3Rate: '0.100000', ready: true },
					derivedRevenueSettings: { exists: true, ready: true },
					otherRevenue: { total: 20, configured: 20, ready: true },
					overallReady: true,
					readyCount: 5,
					totalCount: 5,
				}}
			/>
		);

		expect(screen.getByRole('status')).toBeDefined();
		expect(screen.getByText(/Last calculated:/)).toBeDefined();
		expect(screen.getByText(/Enrollment:/)).toBeDefined();
		expect(screen.getByText(/Config:/)).toBeDefined();
		expect(screen.getByText(/5 of 5 complete/)).toBeDefined();
		expect(screen.getByText('Staffing')).toBeDefined();
		expect(screen.getByText('P&L')).toBeDefined();
	});

	it('renders downstream stale modules as StalePill badges', () => {
		render(
			<RevenueStatusStrip
				lastCalculated="2026-03-14T09:30:00.000Z"
				enrollmentStale={false}
				downstreamStale={['STAFFING']}
				readiness={undefined}
			/>
		);

		expect(screen.getByText('Staffing')).toBeDefined();
		expect(screen.getByText(/Loading readiness/)).toBeDefined();
	});

	it('shows not yet calculated when lastCalculated is null', () => {
		render(
			<RevenueStatusStrip
				lastCalculated={null}
				enrollmentStale={false}
				downstreamStale={[]}
				readiness={undefined}
			/>
		);

		expect(screen.getByText('Not yet calculated')).toBeDefined();
	});

	it('shows dirty settings count when settings have been changed', () => {
		mockDirtyFields = new Map([
			['feeGrid', new Set(['field1', 'field2'])],
			['discounts', new Set(['field3'])],
		]);

		render(
			<RevenueStatusStrip
				lastCalculated="2026-03-14T09:30:00.000Z"
				enrollmentStale={false}
				downstreamStale={[]}
				readiness={undefined}
			/>
		);

		expect(screen.getByText(/3 settings changed since last calculation/)).toBeDefined();
	});

	it('shows singular form for 1 dirty setting', () => {
		mockDirtyFields = new Map([['feeGrid', new Set(['field1'])]]);

		render(
			<RevenueStatusStrip
				lastCalculated="2026-03-14T09:30:00.000Z"
				enrollmentStale={false}
				downstreamStale={[]}
				readiness={undefined}
			/>
		);

		expect(screen.getByText(/1 setting changed since last calculation/)).toBeDefined();
	});

	it('does not show downstream stale section when empty', () => {
		render(
			<RevenueStatusStrip
				lastCalculated="2026-03-14T09:30:00.000Z"
				enrollmentStale={false}
				downstreamStale={[]}
				readiness={undefined}
			/>
		);

		expect(screen.queryByText('Downstream stale:')).toBeNull();
	});

	it('uses flat border-b style without rounded corners', () => {
		const { container } = render(
			<RevenueStatusStrip
				lastCalculated={null}
				enrollmentStale={false}
				downstreamStale={[]}
				readiness={undefined}
			/>
		);

		const statusEl = container.querySelector('[role="status"]');
		expect(statusEl).toBeDefined();
		expect(statusEl?.className).toContain('border-b');
		expect(statusEl?.className).not.toContain('rounded');
		expect(statusEl?.className).not.toContain('shadow');
	});
});
