import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { StaffingKpiRibbonV2, type StaffingKpiRibbonV2Props } from './staffing-kpi-ribbon';

// Mock the Counter component to avoid animation timing issues
vi.mock('../shared/counter', () => ({
	Counter: ({
		value,
		formatter,
		className,
	}: {
		value: number;
		formatter: (v: number) => string;
		className?: string;
	}) => (
		<span className={className} data-testid="counter">
			{formatter(value)}
		</span>
	),
}));

vi.mock('../../lib/format-money', () => ({
	formatMoney: (
		value: string | number,
		opts?: { compact?: boolean; millions?: boolean; showCurrency?: boolean }
	) => {
		const num = typeof value === 'string' ? parseFloat(value) : value;
		if (opts?.millions) {
			const mVal = num / 1_000_000;
			const formatted = mVal.toFixed(1);
			return opts.showCurrency ? `${formatted}M SAR` : `${formatted}M`;
		}
		if (opts?.compact) {
			if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M SAR`;
			if (num >= 1_000) return `${(num / 1_000).toFixed(0)}K SAR`;
			return `${num} SAR`;
		}
		return String(num);
	},
}));

afterEach(() => {
	cleanup();
});

const defaultProps: StaffingKpiRibbonV2Props = {
	totalHeadcount: 42,
	fteGap: -0.5,
	staffCost: 5400000,
	hsaBudget: 180000,
	heRatio: 8.5,
	rechargeCost: 360000,
	isStale: false,
};

describe('StaffingKpiRibbonV2', () => {
	it('renders all 6 KPI cards with correct labels', () => {
		render(<StaffingKpiRibbonV2 {...defaultProps} />);

		expect(screen.getByText('Total Headcount')).toBeDefined();
		expect(screen.getByText('FTE Gap')).toBeDefined();
		expect(screen.getByText('Staff Cost')).toBeDefined();
		expect(screen.getByText('HSA Budget')).toBeDefined();
		expect(screen.getByText('H/E Ratio')).toBeDefined();
		expect(screen.getByText('Recharge Cost')).toBeDefined();
	});

	it('displays formatted headcount value', () => {
		render(<StaffingKpiRibbonV2 {...defaultProps} />);

		expect(screen.getByText('42')).toBeDefined();
	});

	it('displays compact SAR values for monetary KPIs', () => {
		render(<StaffingKpiRibbonV2 {...defaultProps} />);

		// Staff Cost should show millions SAR
		expect(screen.getByText('5.4M SAR')).toBeDefined();
		// HSA Budget
		expect(screen.getByText('0.2M SAR')).toBeDefined();
		// Recharge Cost
		expect(screen.getByText('0.4M SAR')).toBeDefined();
	});

	it('displays H/E Ratio with 2 decimal places', () => {
		render(<StaffingKpiRibbonV2 {...defaultProps} />);

		expect(screen.getByText('8.50')).toBeDefined();
	});

	it('displays FTE Gap value', () => {
		render(<StaffingKpiRibbonV2 {...defaultProps} />);

		expect(screen.getByText('-0.50')).toBeDefined();
	});

	// AC-12: FTE Gap card dynamic border color
	it('shows green border on FTE Gap card when balanced (|gap| <= 0.25)', () => {
		const { container } = render(<StaffingKpiRibbonV2 {...defaultProps} fteGap={0.1} />);

		const fteGapCard = container.querySelector('[data-kpi="fteGap"]');
		expect(fteGapCard).not.toBeNull();
		expect(fteGapCard!.className).toContain('border-l-');
		// Should contain the success/green color token
		expect(fteGapCard!.className).toMatch(/color-success|kpi-accent-success/);
	});

	it('shows red border on FTE Gap card when deficit (gap < -0.25)', () => {
		const { container } = render(<StaffingKpiRibbonV2 {...defaultProps} fteGap={-1.0} />);

		const fteGapCard = container.querySelector('[data-kpi="fteGap"]');
		expect(fteGapCard).not.toBeNull();
		expect(fteGapCard!.className).toMatch(/color-error|kpi-accent-error/);
	});

	it('shows amber border on FTE Gap card when surplus (gap > 0.25)', () => {
		const { container } = render(<StaffingKpiRibbonV2 {...defaultProps} fteGap={1.0} />);

		const fteGapCard = container.querySelector('[data-kpi="fteGap"]');
		expect(fteGapCard).not.toBeNull();
		expect(fteGapCard!.className).toMatch(/color-warning|kpi-accent-warning/);
	});

	// AC-12: Stale indicator
	it('shows stale indicator with pulsing dot when isStale is true', () => {
		render(<StaffingKpiRibbonV2 {...defaultProps} isStale />);

		expect(screen.getByRole('status')).toBeDefined();
		const staleText = screen.getByText(/Stale/);
		expect(staleText).toBeDefined();
	});

	it('hides stale indicator when isStale is false', () => {
		render(<StaffingKpiRibbonV2 {...defaultProps} isStale={false} />);

		expect(screen.queryByText(/Stale/)).toBeNull();
	});

	// AC-12: Grid responsive layout
	it('uses responsive grid cols (grid-cols-2 lg:grid-cols-3 xl:grid-cols-6)', () => {
		const { container } = render(<StaffingKpiRibbonV2 {...defaultProps} />);

		const grid = container.querySelector('[role="region"]');
		expect(grid).not.toBeNull();
		expect(grid!.className).toContain('grid-cols-2');
		expect(grid!.className).toContain('lg:grid-cols-3');
		expect(grid!.className).toContain('xl:grid-cols-6');
	});

	// AC-12: Staggered animation delay
	it('applies staggered 60ms animation delays to KPI cards', () => {
		const { container } = render(<StaffingKpiRibbonV2 {...defaultProps} />);

		const cards = container.querySelectorAll('[data-kpi]');
		expect(cards.length).toBe(6);

		cards.forEach((card, i) => {
			expect((card as HTMLElement).style.animationDelay).toBe(`${i * 60}ms`);
		});
	});

	// AC-12: Counter component used for animated values
	it('uses Counter components for all 6 values', () => {
		render(<StaffingKpiRibbonV2 {...defaultProps} />);

		const counters = screen.getAllByTestId('counter');
		expect(counters.length).toBe(6);
	});

	it('renders zero values without crashing', () => {
		render(
			<StaffingKpiRibbonV2
				totalHeadcount={0}
				fteGap={0}
				staffCost={0}
				hsaBudget={0}
				heRatio={0}
				rechargeCost={0}
				isStale={false}
			/>
		);

		expect(screen.getByText('Total Headcount')).toBeDefined();
	});

	it('has accessible region landmark', () => {
		render(<StaffingKpiRibbonV2 {...defaultProps} />);

		expect(screen.getByRole('region', { name: /staffing.*key.*performance/i })).toBeDefined();
	});
});
