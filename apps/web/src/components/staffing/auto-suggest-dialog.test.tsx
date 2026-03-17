import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { AutoSuggestResult } from '../../hooks/use-master-data';

// ── Mock mutation functions ────────────────────────────────────────────────

const mockCreateAssignment = vi.fn();
const mockOnOpenChange = vi.fn();

vi.mock('../../hooks/use-staffing', () => ({
	useCreateAssignment: () => ({
		mutateAsync: mockCreateAssignment,
		mutate: mockCreateAssignment,
		isPending: false,
	}),
	useStaffingAssignments: () => ({
		data: { data: [] },
	}),
}));

// Mock Sheet to render children directly for testing
vi.mock('../ui/sheet', () => ({
	Sheet: ({ children, open }: { children: ReactNode; open: boolean }) =>
		open ? <div data-testid="sheet-root">{children}</div> : null,
	SheetContent: ({ children, className }: { children: ReactNode; className?: string }) => (
		<div data-testid="sheet-content" className={className}>
			{children}
		</div>
	),
	SheetHeader: ({ children }: { children: ReactNode }) => (
		<div data-testid="sheet-header">{children}</div>
	),
	SheetFooter: ({ children }: { children: ReactNode }) => (
		<div data-testid="sheet-footer">{children}</div>
	),
	SheetTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
	SheetDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
	SheetClose: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	SheetOverlay: () => null,
	SheetPortal: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	SheetTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

// Mock Checkbox to render a simple checkbox input
vi.mock('../ui/checkbox', () => ({
	Checkbox: ({
		checked,
		onCheckedChange,
		...props
	}: {
		checked?: boolean;
		onCheckedChange?: (checked: boolean) => void;
		'aria-label'?: string;
	}) => (
		<input
			type="checkbox"
			checked={checked}
			onChange={(e) => onCheckedChange?.(e.target.checked)}
			aria-label={props['aria-label']}
			data-testid={`checkbox-${props['aria-label'] ?? 'unknown'}`}
		/>
	),
}));

vi.mock('../ui/button', () => ({
	Button: ({
		children,
		...props
	}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }) => (
		<button type="button" {...props}>
			{children}
		</button>
	),
}));

const mockSuggestions: AutoSuggestResult[] = [
	{
		employeeId: 100,
		employeeName: 'Marie Dupont',
		requirementLineId: 1,
		band: 'MATERNELLE',
		disciplineCode: 'FR',
		fteShare: '0.80',
		confidence: 'High',
	},
	{
		employeeId: 101,
		employeeName: 'Jean Martin',
		requirementLineId: 2,
		band: 'COLLEGE',
		disciplineCode: 'MATH',
		fteShare: '0.60',
		confidence: 'Medium',
	},
	{
		employeeId: 102,
		employeeName: 'Sophie Bernard',
		requirementLineId: 3,
		band: 'LYCEE',
		disciplineCode: 'PHYS',
		fteShare: '1.00',
		confidence: 'High',
	},
];

afterEach(() => {
	cleanup();
	mockCreateAssignment.mockReset();
	mockOnOpenChange.mockReset();
});

describe('AutoSuggestDialog', () => {
	let AutoSuggestDialog: React.ComponentType<{
		open: boolean;
		onOpenChange: (open: boolean) => void;
		versionId: number;
		suggestions: AutoSuggestResult[];
	}>;

	beforeEach(async () => {
		const mod = await import('./auto-suggest-dialog');
		AutoSuggestDialog = mod.AutoSuggestDialog;
	});

	// AC-16: Dialog renders nothing when closed
	it('renders nothing when open is false', () => {
		const { container } = render(
			<AutoSuggestDialog
				open={false}
				onOpenChange={mockOnOpenChange}
				versionId={42}
				suggestions={mockSuggestions}
			/>
		);
		expect(container.textContent).toBe('');
	});

	// AC-16: Header
	it('renders header with title "Suggested Assignments — Review and Accept"', () => {
		render(
			<AutoSuggestDialog
				open={true}
				onOpenChange={mockOnOpenChange}
				versionId={42}
				suggestions={mockSuggestions}
			/>
		);
		expect(screen.getByText('Suggested Assignments — Review and Accept')).toBeDefined();
	});

	// AC-16: Summary text
	it('shows summary with suggestion count and unique employee count', () => {
		render(
			<AutoSuggestDialog
				open={true}
				onOpenChange={mockOnOpenChange}
				versionId={42}
				suggestions={mockSuggestions}
			/>
		);
		// 3 suggestions for 3 unique employees
		expect(screen.getByText(/3 assignments suggested for 3 unassigned employees/i)).toBeDefined();
	});

	// AC-16: Table columns
	it('renders a table with Employee Name column', () => {
		render(
			<AutoSuggestDialog
				open={true}
				onOpenChange={mockOnOpenChange}
				versionId={42}
				suggestions={mockSuggestions}
			/>
		);
		expect(screen.getByText('Employee Name')).toBeDefined();
	});

	it('renders a table with Band column', () => {
		render(
			<AutoSuggestDialog
				open={true}
				onOpenChange={mockOnOpenChange}
				versionId={42}
				suggestions={mockSuggestions}
			/>
		);
		expect(screen.getByText('Band')).toBeDefined();
	});

	it('renders a table with Discipline column', () => {
		render(
			<AutoSuggestDialog
				open={true}
				onOpenChange={mockOnOpenChange}
				versionId={42}
				suggestions={mockSuggestions}
			/>
		);
		expect(screen.getByText('Discipline')).toBeDefined();
	});

	it('renders a table with FTE Share column', () => {
		render(
			<AutoSuggestDialog
				open={true}
				onOpenChange={mockOnOpenChange}
				versionId={42}
				suggestions={mockSuggestions}
			/>
		);
		expect(screen.getByText('FTE Share')).toBeDefined();
	});

	it('renders a table with Confidence column', () => {
		render(
			<AutoSuggestDialog
				open={true}
				onOpenChange={mockOnOpenChange}
				versionId={42}
				suggestions={mockSuggestions}
			/>
		);
		expect(screen.getByText('Confidence')).toBeDefined();
	});

	// AC-16: Employee names in table rows
	it('renders all suggestion employee names', () => {
		render(
			<AutoSuggestDialog
				open={true}
				onOpenChange={mockOnOpenChange}
				versionId={42}
				suggestions={mockSuggestions}
			/>
		);
		expect(screen.getByText('Marie Dupont')).toBeDefined();
		expect(screen.getByText('Jean Martin')).toBeDefined();
		expect(screen.getByText('Sophie Bernard')).toBeDefined();
	});

	// AC-16: FTE values in rows
	it('renders FTE share values for each suggestion', () => {
		render(
			<AutoSuggestDialog
				open={true}
				onOpenChange={mockOnOpenChange}
				versionId={42}
				suggestions={mockSuggestions}
			/>
		);
		expect(screen.getByText('0.80')).toBeDefined();
		expect(screen.getByText('0.60')).toBeDefined();
		expect(screen.getByText('1.00')).toBeDefined();
	});

	// AC-16: Confidence badges
	it('renders High confidence badge with green styling', () => {
		render(
			<AutoSuggestDialog
				open={true}
				onOpenChange={mockOnOpenChange}
				versionId={42}
				suggestions={mockSuggestions}
			/>
		);
		const highBadges = screen.getAllByText('High');
		expect(highBadges.length).toBe(2); // Marie and Sophie both have High
	});

	it('renders Medium confidence badge with amber styling', () => {
		render(
			<AutoSuggestDialog
				open={true}
				onOpenChange={mockOnOpenChange}
				versionId={42}
				suggestions={mockSuggestions}
			/>
		);
		const mediumBadges = screen.getAllByText('Medium');
		expect(mediumBadges.length).toBe(1); // Only Jean
	});

	// AC-16: Checkboxes default checked
	it('renders checkboxes for each row that are checked by default', () => {
		render(
			<AutoSuggestDialog
				open={true}
				onOpenChange={mockOnOpenChange}
				versionId={42}
				suggestions={mockSuggestions}
			/>
		);
		const checkboxes = screen.getAllByRole('checkbox');
		expect(checkboxes.length).toBe(mockSuggestions.length);
		for (const cb of checkboxes) {
			expect((cb as HTMLInputElement).checked).toBe(true);
		}
	});

	// AC-16: Unchecking a checkbox
	it('allows unchecking a suggestion row checkbox', () => {
		render(
			<AutoSuggestDialog
				open={true}
				onOpenChange={mockOnOpenChange}
				versionId={42}
				suggestions={mockSuggestions}
			/>
		);
		const checkboxes = screen.getAllByRole('checkbox');
		fireEvent.click(checkboxes[1]!);
		expect((checkboxes[1] as HTMLInputElement).checked).toBe(false);
	});

	// AC-16: Accept Selected button
	it('renders "Accept Selected" button with count of checked rows', () => {
		render(
			<AutoSuggestDialog
				open={true}
				onOpenChange={mockOnOpenChange}
				versionId={42}
				suggestions={mockSuggestions}
			/>
		);
		expect(screen.getByText(/Accept Selected \(3\)/)).toBeDefined();
	});

	it('updates Accept Selected count when a checkbox is unchecked', () => {
		render(
			<AutoSuggestDialog
				open={true}
				onOpenChange={mockOnOpenChange}
				versionId={42}
				suggestions={mockSuggestions}
			/>
		);
		const checkboxes = screen.getAllByRole('checkbox');
		fireEvent.click(checkboxes[0]!);
		expect(screen.getByText(/Accept Selected \(2\)/)).toBeDefined();
	});

	// AC-16: Reject All button
	it('renders "Reject All" button', () => {
		render(
			<AutoSuggestDialog
				open={true}
				onOpenChange={mockOnOpenChange}
				versionId={42}
				suggestions={mockSuggestions}
			/>
		);
		expect(screen.getByText('Reject All')).toBeDefined();
	});

	it('calls onOpenChange(false) when Reject All is clicked', () => {
		render(
			<AutoSuggestDialog
				open={true}
				onOpenChange={mockOnOpenChange}
				versionId={42}
				suggestions={mockSuggestions}
			/>
		);
		fireEvent.click(screen.getByText('Reject All'));
		expect(mockOnOpenChange).toHaveBeenCalledWith(false);
	});

	// AC-16: Accept All button
	it('renders "Accept All" button', () => {
		render(
			<AutoSuggestDialog
				open={true}
				onOpenChange={mockOnOpenChange}
				versionId={42}
				suggestions={mockSuggestions}
			/>
		);
		expect(screen.getByText('Accept All')).toBeDefined();
	});

	// AC-16: Accept Selected calls create mutation for checked rows
	it('calls createAssignment for each checked suggestion on Accept Selected', async () => {
		render(
			<AutoSuggestDialog
				open={true}
				onOpenChange={mockOnOpenChange}
				versionId={42}
				suggestions={mockSuggestions}
			/>
		);
		// Uncheck first row, then accept
		const checkboxes = screen.getAllByRole('checkbox');
		fireEvent.click(checkboxes[0]!);
		fireEvent.click(screen.getByText(/Accept Selected/));
		// Should create 2 assignments (rows 2 and 3)
		expect(mockCreateAssignment).toHaveBeenCalledTimes(2);
	});

	// AC-16: Accept All calls create mutation for all rows
	it('calls createAssignment for all suggestions on Accept All', async () => {
		render(
			<AutoSuggestDialog
				open={true}
				onOpenChange={mockOnOpenChange}
				versionId={42}
				suggestions={mockSuggestions}
			/>
		);
		fireEvent.click(screen.getByText('Accept All'));
		expect(mockCreateAssignment).toHaveBeenCalledTimes(3);
	});

	// AC-16: Dialog closes after accept
	it('closes dialog after Accept Selected', () => {
		render(
			<AutoSuggestDialog
				open={true}
				onOpenChange={mockOnOpenChange}
				versionId={42}
				suggestions={mockSuggestions}
			/>
		);
		fireEvent.click(screen.getByText(/Accept Selected/));
		expect(mockOnOpenChange).toHaveBeenCalledWith(false);
	});

	it('closes dialog after Accept All', () => {
		render(
			<AutoSuggestDialog
				open={true}
				onOpenChange={mockOnOpenChange}
				versionId={42}
				suggestions={mockSuggestions}
			/>
		);
		fireEvent.click(screen.getByText('Accept All'));
		expect(mockOnOpenChange).toHaveBeenCalledWith(false);
	});

	// AC-16: Band values rendered in rows
	it('renders band values in table rows', () => {
		render(
			<AutoSuggestDialog
				open={true}
				onOpenChange={mockOnOpenChange}
				versionId={42}
				suggestions={mockSuggestions}
			/>
		);
		expect(screen.getByText('MATERNELLE')).toBeDefined();
		expect(screen.getByText('COLLEGE')).toBeDefined();
		expect(screen.getByText('LYCEE')).toBeDefined();
	});

	// AC-16: Discipline codes rendered in rows
	it('renders discipline codes in table rows', () => {
		render(
			<AutoSuggestDialog
				open={true}
				onOpenChange={mockOnOpenChange}
				versionId={42}
				suggestions={mockSuggestions}
			/>
		);
		expect(screen.getByText('FR')).toBeDefined();
		expect(screen.getByText('MATH')).toBeDefined();
		expect(screen.getByText('PHYS')).toBeDefined();
	});

	// AC-16: Empty state
	it('shows empty message when no suggestions', () => {
		render(
			<AutoSuggestDialog
				open={true}
				onOpenChange={mockOnOpenChange}
				versionId={42}
				suggestions={[]}
			/>
		);
		expect(screen.getByText(/no suggestions/i)).toBeDefined();
	});
});
