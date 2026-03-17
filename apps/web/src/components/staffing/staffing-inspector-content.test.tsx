import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

// ── Mutable mock state ──────────────────────────────────────────────────────

let mockSelection: {
	type: 'REQUIREMENT_LINE' | 'SUPPORT_EMPLOYEE';
	requirementLineId?: number;
	employeeId?: number;
	band?: string;
	disciplineCode?: string;
	department?: string;
} | null = null;

const mockClearSelection = vi.fn();

vi.mock('../../stores/staffing-selection-store', () => ({
	useStaffingSelectionStore: (selector: (state: unknown) => unknown) =>
		selector({
			selection: mockSelection,
			clearSelection: mockClearSelection,
		}),
}));

// Mock workspace context
vi.mock('../../hooks/use-workspace-context', () => ({
	useWorkspaceContext: () => ({
		versionId: 42,
		fiscalYear: 2026,
		versionStatus: 'Draft',
	}),
}));

// Mock versions hook
vi.mock('../../hooks/use-versions', () => ({
	useVersions: () => ({
		data: {
			data: [
				{
					id: 42,
					status: 'Draft',
					staleModules: [],
					lastCalculatedAt: '2026-03-15T10:30:00Z',
				},
			],
		},
	}),
}));

// Mock teaching requirements
vi.mock('../../hooks/use-staffing', () => ({
	useTeachingRequirements: () => ({
		data: {
			data: [
				{
					id: 1,
					band: 'MATERNELLE',
					disciplineCode: 'FR',
					lineLabel: 'Francais - Maternelle',
					coverageStatus: 'COVERED',
					requiredFteRaw: '2.50',
					coveredFte: '2.50',
					gapFte: '0.00',
					assignedStaffCount: 3,
					directCostAnnual: '360000',
					hsaCostAnnual: '15000',
					requiredFtePlanned: '3.00',
					recommendedPositions: 3,
				},
				{
					id: 2,
					band: 'ELEMENTAIRE',
					disciplineCode: 'MATH',
					lineLabel: 'Mathematics - Elementaire',
					coverageStatus: 'DEFICIT',
					requiredFteRaw: '4.00',
					coveredFte: '3.00',
					gapFte: '-1.00',
					assignedStaffCount: 3,
					directCostAnnual: '480000',
					hsaCostAnnual: '20000',
					requiredFtePlanned: '4.00',
					recommendedPositions: 4,
				},
			],
			totals: {
				totalFteRaw: '6.50',
				totalFtePlanned: '7.00',
				totalFteCovered: '5.50',
				totalFteGap: '-1.00',
			},
		},
	}),
	useTeachingRequirementSources: () => ({
		data: {
			data: [
				{
					gradeLevel: 'PS',
					headcount: 25,
					sections: 1,
					hoursPerUnit: '4.0',
					totalWeeklyHours: '4.0',
				},
				{
					gradeLevel: 'MS',
					headcount: 28,
					sections: 1,
					hoursPerUnit: '4.0',
					totalWeeklyHours: '4.0',
				},
			],
		},
	}),
	useStaffingAssignments: () => ({
		data: {
			data: [
				{
					id: 10,
					requirementLineId: 1,
					employeeId: 100,
					fteShare: '0.80',
					hoursPerWeek: '19.2',
					note: null,
					source: 'MANUAL',
				},
				{
					id: 11,
					requirementLineId: 1,
					employeeId: 101,
					fteShare: '1.00',
					hoursPerWeek: '24.0',
					note: null,
					source: 'AUTO_SUGGEST',
				},
			],
		},
	}),
	useEmployees: () => ({
		data: {
			data: [
				{
					id: 100,
					name: 'Marie Dupont',
					costMode: 'LOCAL_PAYROLL',
					department: 'Primary',
					functionRole: 'Teacher',
					status: 'Active',
					baseSalary: '8000',
					monthlyCost: '12500',
					annualCost: '150000',
					isTeaching: true,
					recordType: 'TEACHER',
					homeBand: 'MATERNELLE',
				},
				{
					id: 101,
					name: 'Jean Martin',
					costMode: 'RECHARGE',
					department: 'Primary',
					functionRole: 'Teacher',
					status: 'Active',
					baseSalary: '9000',
					monthlyCost: '14000',
					annualCost: '168000',
					isTeaching: true,
					recordType: 'TEACHER',
					homeBand: 'MATERNELLE',
				},
				{
					id: 200,
					name: 'Sophie Bernard',
					costMode: 'LOCAL_PAYROLL',
					department: 'Administration',
					functionRole: 'Secretary',
					status: 'Active',
					baseSalary: '5000',
					monthlyCost: '7500',
					annualCost: '90000',
					isTeaching: false,
					recordType: 'SUPPORT',
					homeBand: null,
				},
			],
			total: 3,
		},
	}),
	useEmployee: () => ({
		data: {
			id: 200,
			name: 'Sophie Bernard',
			costMode: 'LOCAL_PAYROLL',
			department: 'Administration',
			functionRole: 'Secretary',
			status: 'Active',
			baseSalary: '5000',
			monthlyCost: '7500',
			annualCost: '90000',
			isTeaching: false,
			recordType: 'SUPPORT',
			homeBand: null,
			joiningDate: '2024-09-01',
			contractEndDate: null,
		},
	}),
	useStaffingSummary: () => ({
		data: {
			fte: '42.00',
			cost: '5400000',
			byDepartment: [
				{ department: 'Primary', total_cost: '3000000' },
				{ department: 'Administration', total_cost: '2400000' },
			],
		},
	}),
}));

vi.mock('../../lib/format-money', () => ({
	formatMoney: (value: string | number, opts?: { compact?: boolean; showCurrency?: boolean }) => {
		const num = typeof value === 'string' ? parseFloat(value) : value;
		if (opts?.compact) {
			if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M SAR`;
			if (num >= 1_000) return `${(num / 1_000).toFixed(0)}K SAR`;
			return `${num} SAR`;
		}
		if (opts?.showCurrency) return `SAR ${num.toLocaleString()}`;
		return num.toLocaleString();
	},
}));

vi.mock('../../lib/right-panel-registry', () => ({
	registerPanelContent: vi.fn(),
	registerGuideContent: vi.fn(),
}));

afterEach(() => {
	cleanup();
	mockSelection = null;
	mockClearSelection.mockReset();
});

describe('StaffingInspectorContent', () => {
	// Lazy import to allow mocks to be set up first
	let StaffingInspectorContent: React.ComponentType;

	beforeEach(async () => {
		const mod = await import('./staffing-inspector-content');
		StaffingInspectorContent = mod.StaffingInspectorContent;
	});

	// AC-14: Registration
	it('registers panel content with the right-panel registry', async () => {
		const registry = await import('../../lib/right-panel-registry');
		expect(registry.registerPanelContent).toHaveBeenCalledWith('staffing', expect.any(Function));
	});

	// ── Default view (no selection) ─────────────────────────────────────────

	describe('Default view (no selection)', () => {
		it('shows workflow status card', () => {
			mockSelection = null;
			render(<StaffingInspectorContent />);

			expect(screen.getByText(/staffing workflow/i)).toBeDefined();
		});

		it('shows quick stats', () => {
			mockSelection = null;
			render(<StaffingInspectorContent />);

			// Should show total FTE stats
			expect(screen.getByText('Total FTE required')).toBeDefined();
			expect(screen.getByText('Total FTE covered')).toBeDefined();
		});

		it('shows coverage distribution', () => {
			mockSelection = null;
			render(<StaffingInspectorContent />);

			expect(screen.getByText('Coverage distribution')).toBeDefined();
		});

		it('shows recommended actions', () => {
			mockSelection = null;
			render(<StaffingInspectorContent />);

			expect(screen.getByText('Recommended actions')).toBeDefined();
		});

		it('shows band summary table', () => {
			mockSelection = null;
			render(<StaffingInspectorContent />);

			expect(screen.getByText('Summary by band')).toBeDefined();
		});
	});

	// ── Requirement line selected view ──────────────────────────────────────

	describe('Requirement line selected view', () => {
		beforeEach(() => {
			mockSelection = {
				type: 'REQUIREMENT_LINE',
				requirementLineId: 1,
				band: 'MATERNELLE',
				disciplineCode: 'FR',
			};
		});

		it('shows header with line label and band badge', () => {
			render(<StaffingInspectorContent />);

			expect(screen.getByText('Francais - Maternelle')).toBeDefined();
			// Band badge text
			expect(screen.getByText('Maternelle')).toBeDefined();
		});

		it('shows coverage status in header', () => {
			render(<StaffingInspectorContent />);

			// The coverage status badge exists in the header
			const coverageBadges = screen.getAllByText('Covered');
			expect(coverageBadges.length).toBeGreaterThanOrEqual(1);
		});

		it('shows driver breakdown table from sources', () => {
			render(<StaffingInspectorContent />);

			// Should show grade-level driver breakdown
			expect(screen.getByText('PS')).toBeDefined();
			expect(screen.getByText('MS')).toBeDefined();
		});

		it('shows assigned teachers list with costMode badges', () => {
			render(<StaffingInspectorContent />);

			expect(screen.getByText('Marie Dupont')).toBeDefined();
			expect(screen.getByText('Jean Martin')).toBeDefined();
			// CostMode badges
			expect(screen.getByText(/LOCAL/i)).toBeDefined();
			expect(screen.getByText(/RECHARGE/i)).toBeDefined();
		});

		it('shows fteShare for each assigned teacher', () => {
			render(<StaffingInspectorContent />);

			expect(screen.getByText('0.80')).toBeDefined();
			expect(screen.getByText('1.00')).toBeDefined();
		});

		it('shows gap analysis card', () => {
			render(<StaffingInspectorContent />);

			expect(screen.getByText(/gap analysis/i)).toBeDefined();
		});

		it('shows cost split card', () => {
			render(<StaffingInspectorContent />);

			expect(screen.getByText(/cost split/i)).toBeDefined();
		});

		it('shows back button that returns to default view', () => {
			render(<StaffingInspectorContent />);

			const backButton = screen.getByRole('button', { name: /back/i });
			expect(backButton).toBeDefined();

			fireEvent.click(backButton);
			expect(mockClearSelection).toHaveBeenCalled();
		});

		it('applies animate-inspector-slide-in transition', () => {
			const { container } = render(<StaffingInspectorContent />);

			const animated = container.querySelector('.animate-inspector-slide-in');
			expect(animated).not.toBeNull();
		});
	});

	// ── Support employee selected view ──────────────────────────────────────

	describe('Support employee selected view', () => {
		beforeEach(() => {
			mockSelection = {
				type: 'SUPPORT_EMPLOYEE',
				employeeId: 200,
				department: 'Administration',
			};
		});

		it('shows employee header with name', () => {
			render(<StaffingInspectorContent />);

			expect(screen.getByText('Sophie Bernard')).toBeDefined();
		});

		it('shows employment details', () => {
			render(<StaffingInspectorContent />);

			expect(screen.getByText(/secretary/i)).toBeDefined();
			expect(screen.getByText(/administration/i)).toBeDefined();
		});

		it('shows cost summary', () => {
			render(<StaffingInspectorContent />);

			// Should show cost summary section
			expect(screen.getByText('Cost summary')).toBeDefined();
		});

		it('shows back button that clears selection', () => {
			render(<StaffingInspectorContent />);

			const backButton = screen.getByRole('button', { name: /back/i });
			expect(backButton).toBeDefined();

			fireEvent.click(backButton);
			expect(mockClearSelection).toHaveBeenCalled();
		});

		it('applies animate-inspector-slide-in transition', () => {
			const { container } = render(<StaffingInspectorContent />);

			const animated = container.querySelector('.animate-inspector-slide-in');
			expect(animated).not.toBeNull();
		});
	});
});
