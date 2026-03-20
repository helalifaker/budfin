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
const mockCreateAssignment = vi.fn();
const mockUpdateAssignment = vi.fn();
const mockDeleteAssignment = vi.fn();

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
			lines: [
				{
					id: 1,
					band: 'MATERNELLE',
					disciplineCode: 'FR',
					lineType: 'STRUCTURAL',
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
					effectiveOrs: '24',
				},
				{
					id: 2,
					band: 'ELEMENTAIRE',
					disciplineCode: 'MATH',
					lineType: 'STRUCTURAL',
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
					effectiveOrs: '24',
				},
			],
			totals: {
				totalFteRaw: '6.50',
				totalFteCovered: '5.50',
				totalFteGap: '-1.00',
				totalDirectCost: '840000',
				totalHsaCost: '35000',
				lineCount: 2,
			},
			warnings: [],
		},
	}),
	useTeachingRequirementSources: () => ({
		data: {
			data: [
				{
					id: 1,
					versionId: 42,
					disciplineId: 1,
					disciplineCode: 'FR',
					disciplineName: 'Francais',
					gradeLevel: 'PS',
					headcount: 25,
					sections: 1,
					hoursPerUnit: '4.0',
					totalWeeklyHours: '4.0',
					lineType: 'STRUCTURAL',
					driverType: 'SECTION',
					maxClassSize: 25,
					driverUnits: 1,
					calculatedAt: '2026-03-15T10:00:00Z',
				},
				{
					id: 2,
					versionId: 42,
					disciplineId: 1,
					disciplineCode: 'FR',
					disciplineName: 'Francais',
					gradeLevel: 'MS',
					headcount: 28,
					sections: 1,
					hoursPerUnit: '4.0',
					totalWeeklyHours: '4.0',
					lineType: 'STRUCTURAL',
					driverType: 'SECTION',
					maxClassSize: 28,
					driverUnits: 1,
					calculatedAt: '2026-03-15T10:00:00Z',
				},
			],
		},
	}),
	useStaffingAssignments: () => ({
		data: {
			data: [
				{
					id: 10,
					versionId: 42,
					employeeId: 100,
					band: 'MATERNELLE',
					disciplineId: 1,
					fteShare: '0.80',
					hoursPerWeek: '19.2',
					note: null,
					source: 'MANUAL',
					employeeName: 'Marie Dupont',
					employeeCode: 'EMP100',
					costMode: 'LOCAL_PAYROLL',
					disciplineCode: 'FR',
					disciplineName: 'Francais',
					updatedAt: '2026-03-15T10:00:00Z',
				},
				{
					id: 11,
					versionId: 42,
					employeeId: 101,
					band: 'MATERNELLE',
					disciplineId: 1,
					fteShare: '1.00',
					hoursPerWeek: '24.0',
					note: null,
					source: 'AUTO_SUGGEST',
					employeeName: 'Jean Martin',
					employeeCode: 'EMP101',
					costMode: 'RECHARGE',
					disciplineCode: 'FR',
					disciplineName: 'Francais',
					updatedAt: '2026-03-15T10:00:00Z',
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
	useCreateAssignment: () => ({
		mutate: mockCreateAssignment,
		mutateAsync: mockCreateAssignment,
		isPending: false,
	}),
	useUpdateAssignment: () => ({
		mutate: mockUpdateAssignment,
		mutateAsync: mockUpdateAssignment,
		isPending: false,
	}),
	useDeleteAssignment: () => ({
		mutate: mockDeleteAssignment,
		mutateAsync: mockDeleteAssignment,
		isPending: false,
	}),
}));

// Mock disciplines for employee filtering
vi.mock('../../hooks/use-master-data', () => ({
	useDisciplines: () => ({
		data: [
			{ id: 1, code: 'FR', name: 'Francais', category: 'SUBJECT', sortOrder: 1, aliases: [] },
			{
				id: 2,
				code: 'MATH',
				name: 'Mathematiques',
				category: 'SUBJECT',
				sortOrder: 2,
				aliases: [],
			},
		],
	}),
	useServiceProfiles: () => ({
		data: [
			{
				id: 1,
				code: 'P1',
				name: 'Titulaire',
				weeklyServiceHours: '24',
				hsaEligible: true,
				defaultCostMode: 'LOCAL_PAYROLL',
				sortOrder: 1,
			},
		],
	}),
}));

// Mock alert dialog to be simple for testing
vi.mock('../ui/alert-dialog', () => ({
	AlertDialog: ({ children, open }: { children: React.ReactNode; open?: boolean }) =>
		open !== false ? <div data-testid="alert-dialog">{children}</div> : null,
	AlertDialogTrigger: ({
		children,
		asChild: _asChild,
	}: {
		children: React.ReactNode;
		asChild?: boolean;
	}) => <div data-testid="alert-trigger">{children}</div>,
	AlertDialogContent: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="alert-content">{children}</div>
	),
	AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
	AlertDialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
	AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	AlertDialogAction: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
		<button type="button" {...props}>
			{children}
		</button>
	),
	AlertDialogCancel: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
		<button type="button" {...props}>
			{children}
		</button>
	),
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

// Mock Radix Select as a native <select> so fireEvent.change works in JSDOM.
// The factory inspects JSX children to extract id/aria-label from SelectTrigger
// and options from SelectContent > SelectItem, then renders a single native <select>.
vi.mock('../ui/select', async () => {
	const React = await import('react');
	return {
		Select: ({
			value = '',
			onValueChange,
			disabled,
			children,
		}: {
			value?: string;
			onValueChange?: (v: string) => void;
			disabled?: boolean;
			children?: React.ReactNode;
		}) => {
			const options: React.ReactNode[] = [];
			let id: string | undefined;
			let ariaLabel: string | undefined;

			React.Children.forEach(children, (child) => {
				if (!React.isValidElement(child)) return;
				const props = child.props as Record<string, unknown>;
				if (props.id) id = props.id as string;
				if (props['aria-label']) ariaLabel = props['aria-label'] as string;
				if (props.children) {
					React.Children.forEach(props.children as React.ReactNode, (item) => {
						if (!React.isValidElement(item)) return;
						const ip = item.props as Record<string, unknown>;
						if (ip.value !== undefined) {
							options.push(
								<option key={ip.value as string} value={ip.value as string}>
									{ip.children as React.ReactNode}
								</option>
							);
						}
					});
				}
			});

			return (
				<select
					id={id}
					aria-label={ariaLabel}
					value={value}
					onChange={(e) => onValueChange?.(e.target.value)}
					disabled={disabled}
				>
					<option value="">Select...</option>
					{options}
				</select>
			);
		},
		SelectTrigger: () => null,
		SelectContent: () => null,
		SelectItem: () => null,
		SelectValue: () => null,
	};
});

afterEach(() => {
	cleanup();
	mockSelection = null;
	mockClearSelection.mockReset();
	mockCreateAssignment.mockReset();
	mockUpdateAssignment.mockReset();
	mockDeleteAssignment.mockReset();
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

	// ── AC-15: Assignment management in requirement line view ───────────────

	describe('Assignment management (AC-15)', () => {
		beforeEach(() => {
			mockSelection = {
				type: 'REQUIREMENT_LINE',
				requirementLineId: 1,
				band: 'MATERNELLE',
				disciplineCode: 'FR',
			};
		});

		it('shows "Assign Teacher" button when requirement line is selected', () => {
			render(<StaffingInspectorContent />);
			expect(screen.getByRole('button', { name: /assign teacher/i })).toBeDefined();
		});

		it('shows assignment form when "Assign Teacher" is clicked', () => {
			render(<StaffingInspectorContent />);
			fireEvent.click(screen.getByRole('button', { name: /assign teacher/i }));
			// Form should contain employee selection and FTE input
			expect(screen.getByLabelText(/employee/i)).toBeDefined();
			expect(screen.getByLabelText(/fte share/i)).toBeDefined();
		});

		it('shows FTE share input with step 0.01', () => {
			render(<StaffingInspectorContent />);
			fireEvent.click(screen.getByRole('button', { name: /assign teacher/i }));
			const fteInput = screen.getByLabelText(/fte share/i) as HTMLInputElement;
			expect(fteInput.step).toBe('0.01');
		});

		it('shows hours/week as read-only derived display', () => {
			render(<StaffingInspectorContent />);
			fireEvent.click(screen.getByRole('button', { name: /assign teacher/i }));
			const hoursDisplay = screen.getByLabelText(/hours.*week/i);
			expect(hoursDisplay).toBeDefined();
			// Should be read-only
			expect(
				(hoursDisplay as HTMLInputElement).readOnly ||
					hoursDisplay.getAttribute('aria-readonly') === 'true'
			).toBe(true);
		});

		it('shows note textarea with maxLength 500', () => {
			render(<StaffingInspectorContent />);
			fireEvent.click(screen.getByRole('button', { name: /assign teacher/i }));
			const textarea = screen.getByLabelText(/note/i) as HTMLTextAreaElement;
			expect(textarea).toBeDefined();
			expect(textarea.maxLength).toBe(500);
		});

		it('shows edit button (pencil) for each existing assignment', () => {
			render(<StaffingInspectorContent />);
			const editButtons = screen.getAllByRole('button', { name: /edit/i });
			// There are 2 assignments for requirement line 1
			expect(editButtons.length).toBeGreaterThanOrEqual(2);
		});

		it('shows delete button (trash) for each existing assignment', () => {
			render(<StaffingInspectorContent />);
			const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
			expect(deleteButtons.length).toBeGreaterThanOrEqual(2);
		});

		it('shows confirmation dialog when delete button is clicked', () => {
			render(<StaffingInspectorContent />);
			const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
			fireEvent.click(deleteButtons[0]!);
			expect(screen.getByText(/are you sure|confirm|delete this assignment/i)).toBeDefined();
		});

		it('calls deleteAssignment mutation when delete is confirmed', () => {
			render(<StaffingInspectorContent />);
			const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
			fireEvent.click(deleteButtons[0]!);
			// Click the confirm/action button in the dialog
			const confirmButton = screen.getByRole('button', { name: /confirm|yes|delete$/i });
			fireEvent.click(confirmButton);
			expect(mockDeleteAssignment).toHaveBeenCalledWith(10);
		});

		it('calls createAssignment mutation when form is submitted', () => {
			render(<StaffingInspectorContent />);
			fireEvent.click(screen.getByRole('button', { name: /assign teacher/i }));
			// Fill form: select employee and FTE share
			const employeeSelect = screen.getByLabelText(/employee/i);
			fireEvent.change(employeeSelect, { target: { value: '100' } });
			const fteInput = screen.getByLabelText(/fte share/i);
			fireEvent.change(fteInput, { target: { value: '0.50' } });
			// Submit
			const submitButton = screen.getByRole('button', { name: /save|create|assign$/i });
			fireEvent.click(submitButton);
			expect(mockCreateAssignment).toHaveBeenCalled();
		});

		it('calls updateAssignment mutation when editing an existing assignment', () => {
			render(<StaffingInspectorContent />);
			// Click edit on first assignment
			const editButtons = screen.getAllByRole('button', { name: /edit/i });
			fireEvent.click(editButtons[0]!);
			// Change FTE share
			const fteInput = screen.getByLabelText(/fte share/i);
			fireEvent.change(fteInput, { target: { value: '0.90' } });
			// Save
			const saveButton = screen.getByRole('button', { name: /save|update/i });
			fireEvent.click(saveButton);
			expect(mockUpdateAssignment).toHaveBeenCalled();
		});
	});
});
