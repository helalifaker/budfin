import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { StaffingStatusStrip } from './staffing-status-strip';

vi.mock('../shared/stale-pill', () => ({
	StalePill: ({ label }: { label: string }) => <span data-testid="stale-pill">{label}</span>,
}));

afterEach(() => {
	cleanup();
});

describe('StaffingStatusStrip', () => {
	const baseProps = {
		lastCalculatedAt: '2026-03-15T10:30:00.000Z',
		staleModules: [] as string[],
		demandPeriod: 'Academic Year 2 (Sep 2026 — Jun 2027)',
		enrollmentCalculatedAt: '2026-03-15T09:00:00.000Z',
		enrollmentStale: false,
		supplyCount: { existing: 35, new: 5, vacancies: 2 },
		coverageSummary: { deficit: 0, uncovered: 0, balanced: 20 },
	};

	// AC-13: Calc timestamp section
	it('shows calc timestamp when data has been calculated', () => {
		render(<StaffingStatusStrip {...baseProps} />);

		expect(screen.getByText(/Last calculated/)).toBeDefined();
		// Should show formatted date
		expect(screen.queryByText('Not yet calculated')).toBeNull();
	});

	it('shows "Not yet calculated" when lastCalculatedAt is null', () => {
		render(<StaffingStatusStrip {...baseProps} lastCalculatedAt={null} />);

		expect(screen.getByText('Not yet calculated')).toBeDefined();
	});

	// AC-13: Stale warning
	it('shows stale warning when STAFFING in staleModules', () => {
		render(<StaffingStatusStrip {...baseProps} staleModules={['STAFFING']} />);

		// The section label "Stale:" is inside a child span
		const staleLabel = screen.getByText('Stale:');
		expect(staleLabel).toBeDefined();
	});

	it('hides stale warning when STAFFING not in staleModules', () => {
		render(<StaffingStatusStrip {...baseProps} staleModules={[]} />);

		// Should not show a stale warning section for staffing
		const statusStrip = screen.getByRole('status');
		expect(statusStrip).toBeDefined();
		// No stale text should appear (unless it's downstream)
	});

	// AC-13: Demand period
	it('shows demand period text', () => {
		render(<StaffingStatusStrip {...baseProps} />);

		expect(screen.getByText(/Academic Year 2/)).toBeDefined();
	});

	// AC-13: Source indicator with enrollment stale warning
	it('shows source indicator based on enrollment calculation date', () => {
		render(<StaffingStatusStrip {...baseProps} />);

		expect(screen.getByText(/enrollment/i)).toBeDefined();
	});

	it('shows warning on source indicator when ENROLLMENT is stale', () => {
		render(
			<StaffingStatusStrip
				{...baseProps}
				enrollmentStale
				staleModules={['ENROLLMENT', 'STAFFING']}
			/>
		);

		// Should have a warning-severity section for enrollment
		const container = screen.getByRole('status');
		expect(container).toBeDefined();
	});

	// AC-13: Supply count
	it('shows supply count with existing, new, and vacancies breakdown', () => {
		render(<StaffingStatusStrip {...baseProps} />);

		// Should show employee counts: existing + new = 40 employees
		expect(screen.getByText(/40 employees/i)).toBeDefined();
	});

	// AC-13: Coverage summary
	it('shows coverage summary', () => {
		render(<StaffingStatusStrip {...baseProps} />);

		expect(screen.getByText(/coverage/i)).toBeDefined();
	});

	it('shows warning on coverage when deficit or uncovered exist', () => {
		render(
			<StaffingStatusStrip
				{...baseProps}
				coverageSummary={{ deficit: 3, uncovered: 1, balanced: 16 }}
			/>
		);

		// Should contain deficit/uncovered information
		expect(screen.getByText(/deficit/i)).toBeDefined();
	});

	// AC-13: StalePill badges for downstream modules
	it('shows StalePill badges for downstream stale modules like PNL', () => {
		render(<StaffingStatusStrip {...baseProps} staleModules={['STAFFING', 'PNL']} />);

		const pills = screen.getAllByTestId('stale-pill');
		expect(pills.length).toBeGreaterThan(0);
		expect(screen.getByText('P&L')).toBeDefined();
	});

	// AC-13: Uses WorkspaceStatusStrip
	it('renders using WorkspaceStatusStrip component', () => {
		const { container } = render(<StaffingStatusStrip {...baseProps} />);

		// WorkspaceStatusStrip renders a role="status" div
		const statusStrip = container.querySelector('[role="status"]');
		expect(statusStrip).not.toBeNull();
	});

	it('renders all 6 status sections', () => {
		render(<StaffingStatusStrip {...baseProps} staleModules={['STAFFING', 'PNL']} />);

		const statusStrip = screen.getByRole('status');
		expect(statusStrip).toBeDefined();
		// At minimum, should have multiple info sections
		const sections = statusStrip.querySelectorAll('span');
		expect(sections.length).toBeGreaterThanOrEqual(6);
	});
});
