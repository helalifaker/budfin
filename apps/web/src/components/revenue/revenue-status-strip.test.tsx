import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { RevenueStatusStrip } from './revenue-status-strip';

afterEach(() => {
	cleanup();
});

describe('RevenueStatusStrip', () => {
	it('renders the four status segments with AST timestamp formatting', () => {
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
		expect(screen.getByText(/Downstream:/)).toBeDefined();
		expect(screen.getByText(/Config:/)).toBeDefined();
		expect(screen.getByText(/5 of 5 complete/)).toBeDefined();
		expect(screen.getByText(/Staffing, P&L/)).toBeDefined();
	});
});
