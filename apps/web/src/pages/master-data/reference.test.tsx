import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { ReferencePage } from './reference';

let mockUserRole = 'Admin';

const mockNationalities = [
	{ id: 1, code: 'SA', label: 'Saudi', vatExempt: true, version: 1 },
	{ id: 2, code: 'FR', label: 'French', vatExempt: false, version: 1 },
];

const mockTariffs = [
	{ id: 1, code: 'STD', label: 'Standard', description: 'Standard tariff', version: 1 },
	{ id: 2, code: 'DISC', label: 'Discounted', description: null, version: 1 },
];

const mockDepartments = [
	{
		id: 1,
		code: 'MAT',
		label: 'Maternelle',
		bandMapping: 'MATERNELLE' as const,
		version: 1,
	},
	{
		id: 2,
		code: 'ELEM',
		label: 'Elementaire',
		bandMapping: 'ELEMENTAIRE' as const,
		version: 1,
	},
];

vi.mock('../../stores/auth-store', () => ({
	useAuthStore: (selector: (state: { user: { role: string } }) => unknown) =>
		selector({ user: { role: mockUserRole } }),
}));

vi.mock('../../hooks/use-reference-data', () => ({
	useNationalities: () => ({ data: mockNationalities, isLoading: false }),
	useCreateNationality: () => ({ mutate: vi.fn(), isPending: false }),
	useUpdateNationality: () => ({ mutate: vi.fn(), isPending: false }),
	useDeleteNationality: () => ({ mutate: vi.fn(), isPending: false }),
	useTariffs: () => ({ data: mockTariffs, isLoading: false }),
	useCreateTariff: () => ({ mutate: vi.fn(), isPending: false }),
	useUpdateTariff: () => ({ mutate: vi.fn(), isPending: false }),
	useDeleteTariff: () => ({ mutate: vi.fn(), isPending: false }),
	useDepartments: () => ({ data: mockDepartments, isLoading: false }),
	useCreateDepartment: () => ({ mutate: vi.fn(), isPending: false }),
	useUpdateDepartment: () => ({ mutate: vi.fn(), isPending: false }),
	useDeleteDepartment: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('../../hooks/use-delayed-skeleton', () => ({
	useDelayedSkeleton: () => false,
}));

vi.mock('../../components/ui/button', () => ({
	Button: ({
		children,
		...props
	}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
		children: ReactNode;
		variant?: string;
		size?: string;
	}) => (
		<button type="button" {...props}>
			{children}
		</button>
	),
}));

vi.mock('../../components/ui/input', () => ({
	Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock('../../components/ui/alert-dialog', () => ({
	AlertDialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	AlertDialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	AlertDialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	AlertDialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	AlertDialogDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	AlertDialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	AlertDialogAction: ({ children }: { children: ReactNode }) => (
		<button type="button">{children}</button>
	),
	AlertDialogCancel: ({ children }: { children: ReactNode }) => (
		<button type="button">{children}</button>
	),
}));

vi.mock('../../components/ui/dropdown-menu', () => ({
	DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	DropdownMenuTrigger: ({ children }: { children: ReactNode; asChild?: boolean }) => (
		<div>{children}</div>
	),
	DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	DropdownMenuItem: ({
		children,
	}: {
		children: ReactNode;
		onSelect?: () => void;
		destructive?: boolean;
	}) => <div>{children}</div>,
	DropdownMenuSeparator: () => <hr />,
}));

vi.mock('../../components/ui/skeleton', () => ({
	TableSkeleton: () => null,
}));

vi.mock('../../components/ui/toast-state', () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../components/master-data/nationality-side-panel', () => ({
	NationalitySidePanel: () => <div data-testid="nationality-side-panel" />,
}));

vi.mock('../../components/master-data/tariff-side-panel', () => ({
	TariffSidePanel: () => <div data-testid="tariff-side-panel" />,
}));

vi.mock('../../components/master-data/department-side-panel', () => ({
	DepartmentSidePanel: () => <div data-testid="department-side-panel" />,
}));

vi.mock('../../components/master-data/curriculum-tab-content', () => ({
	CurriculumTabContent: () => <div data-testid="curriculum-tab-content">Curriculum</div>,
}));

function renderWithRouter(ui: React.ReactElement) {
	return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('ReferencePage', () => {
	beforeEach(() => {
		mockUserRole = 'Admin';
	});

	afterEach(() => {
		cleanup();
	});

	it('renders page heading', () => {
		renderWithRouter(<ReferencePage />);
		expect(screen.getByText('Reference Data')).toBeTruthy();
	});

	it('renders all 4 tabs', () => {
		renderWithRouter(<ReferencePage />);
		const tabs = screen.getAllByRole('tab');
		expect(tabs.length).toBe(4);
		expect(screen.getByText('Nationalities')).toBeTruthy();
		expect(screen.getByText('Tariffs')).toBeTruthy();
		expect(screen.getByText('Departments')).toBeTruthy();
		expect(screen.getByText('Curriculum')).toBeTruthy();
	});

	it('renders nationalities tab by default with data', () => {
		renderWithRouter(<ReferencePage />);
		expect(screen.getByRole('table')).toBeTruthy();
		expect(screen.getByText('SA')).toBeTruthy();
		expect(screen.getByText('Saudi')).toBeTruthy();
		expect(screen.getByText('FR')).toBeTruthy();
		expect(screen.getByText('French')).toBeTruthy();
	});

	it('renders search filter', () => {
		renderWithRouter(<ReferencePage />);
		expect(screen.getByPlaceholderText('Search...')).toBeTruthy();
	});

	it('renders Add Item button for admins', () => {
		renderWithRouter(<ReferencePage />);
		expect(screen.getByText('+ Add Item')).toBeTruthy();
	});

	it('hides Add Item button for non-admins', () => {
		mockUserRole = 'Editor';
		renderWithRouter(<ReferencePage />);
		expect(screen.queryByText('+ Add Item')).toBeNull();
	});

	it('renders nationality side panel', () => {
		renderWithRouter(<ReferencePage />);
		expect(screen.getByTestId('nationality-side-panel')).toBeTruthy();
	});

	it('renders table column headers for nationalities', () => {
		renderWithRouter(<ReferencePage />);
		expect(screen.getByText('Code')).toBeTruthy();
		expect(screen.getByText('Label')).toBeTruthy();
		expect(screen.getByText('VAT Exempt')).toBeTruthy();
	});

	it('renders VAT exempt badges', () => {
		renderWithRouter(<ReferencePage />);
		expect(screen.getByText('Yes')).toBeTruthy();
		expect(screen.getByText('No')).toBeTruthy();
	});

	it('renders tabpanel with correct aria attributes', () => {
		renderWithRouter(<ReferencePage />);
		const panel = screen.getByRole('tabpanel');
		expect(panel.getAttribute('aria-labelledby')).toBe('tab-nationalities');
	});
});
