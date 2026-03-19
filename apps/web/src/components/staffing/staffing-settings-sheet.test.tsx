import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { StaffingSettingsSheet } from './staffing-settings-sheet';

// ── Mutable mock data ──────────────────────────────────────────────────────

let mockStaffingSettingsData: unknown = {
	data: {
		id: 1,
		versionId: 42,
		hsaTargetHours: '1.5',
		hsaFirstHourRate: '250',
		hsaAdditionalHourRate: '200',
		hsaMonths: 10,
	},
};
let mockStaffingSettingsLoading = false;

const mockPutStaffingSettingsMutate = vi.fn();
let mockPutStaffingSettingsPending = false;

let mockServiceProfilesData: unknown = {
	profiles: [
		{
			id: 1,
			code: 'P1',
			name: 'Professeur Principal',
			weeklyServiceHours: '18',
			hsaEligible: true,
			defaultCostMode: 'LOCAL_PAYROLL',
			sortOrder: 1,
		},
		{
			id: 2,
			code: 'P2',
			name: 'Professeur Certifie',
			weeklyServiceHours: '18',
			hsaEligible: false,
			defaultCostMode: 'LOCAL_PAYROLL',
			sortOrder: 2,
		},
	],
};

let mockServiceProfileOverridesData: unknown = {
	data: [
		{
			id: 1,
			versionId: 42,
			serviceProfileId: 1,
			serviceProfileCode: 'P1',
			serviceProfileName: 'Professeur Principal',
			weeklyServiceHours: '17',
			hsaEligible: true,
		},
	],
};

const mockPutServiceProfileOverridesMutate = vi.fn();

let mockDhgRulesData: unknown = [
	{
		id: 1,
		gradeLevel: 'PS',
		disciplineCode: 'FR',
		lineType: 'STRUCTURAL',
		driverType: 'HOURS',
		hoursPerUnit: '2',
		serviceProfileCode: 'P1',
	},
	{
		id: 2,
		gradeLevel: '2NDE',
		disciplineCode: 'MATH',
		lineType: 'STRUCTURAL',
		driverType: 'GROUPS',
		hoursPerUnit: '4',
		serviceProfileCode: 'P1',
	},
];

let mockLyceeGroupData: unknown = {
	data: [{ disciplineCode: 'MATH', groupCount: 3, hoursPerGroup: '2' }],
};

const mockPutLyceeGroupMutate = vi.fn();

let mockCostAssumptionsData: unknown = {
	data: [
		{
			id: 1,
			versionId: 42,
			category: 'REMPLACEMENTS',
			calculationMode: 'FLAT_ANNUAL',
			value: '50000',
		},
		{
			id: 2,
			versionId: 42,
			category: 'FORMATION',
			calculationMode: 'PERCENT_OF_PAYROLL',
			value: '0.02',
		},
		{
			id: 3,
			versionId: 42,
			category: 'RESIDENT_SALAIRES',
			calculationMode: 'AMOUNT_PER_FTE',
			value: '5000',
		},
		{
			id: 4,
			versionId: 42,
			category: 'RESIDENT_LOGEMENT',
			calculationMode: 'FLAT_ANNUAL',
			value: '30000',
		},
		{
			id: 5,
			versionId: 42,
			category: 'RESIDENT_PENSION',
			calculationMode: 'FLAT_ANNUAL',
			value: '20000',
		},
	],
};

const mockPutCostAssumptionsMutate = vi.fn();

let mockHeadcountData: unknown = {
	entries: [
		{
			gradeLevel: 'PS',
			gradeName: 'PS',
			band: 'MATERNELLE',
			displayOrder: 1,
			headcount: 25,
			academicPeriod: 'AY2',
		},
		{
			gradeLevel: 'MS',
			gradeName: 'MS',
			band: 'MATERNELLE',
			displayOrder: 2,
			headcount: 30,
			academicPeriod: 'AY2',
		},
	],
};

let mockStaffingSummaryData: unknown = {
	fte: '45.5',
	cost: '5000000',
	byDepartment: [{ department: 'Teaching', total_cost: '4000000' }],
};

let mockVersionStaleModules: string[] = [];

const mockNavigate = vi.fn();

// ── Module mocks ───────────────────────────────────────────────────────────

vi.mock('../../hooks/use-staffing', () => ({
	useStaffingSettings: vi.fn(() => ({
		data: mockStaffingSettingsData,
		isLoading: mockStaffingSettingsLoading,
	})),
	usePutStaffingSettings: vi.fn(() => ({
		mutate: mockPutStaffingSettingsMutate,
		isPending: mockPutStaffingSettingsPending,
	})),
	useServiceProfileOverrides: vi.fn(() => ({
		data: mockServiceProfileOverridesData,
		isLoading: false,
	})),
	usePutServiceProfileOverrides: vi.fn(() => ({
		mutate: mockPutServiceProfileOverridesMutate,
		isPending: false,
	})),
	useCostAssumptions: vi.fn(() => ({
		data: mockCostAssumptionsData,
		isLoading: false,
	})),
	usePutCostAssumptions: vi.fn(() => ({
		mutate: mockPutCostAssumptionsMutate,
		isPending: false,
	})),
	useLyceeGroupAssumptions: vi.fn(() => ({
		data: mockLyceeGroupData,
		isLoading: false,
	})),
	usePutLyceeGroupAssumptions: vi.fn(() => ({
		mutate: mockPutLyceeGroupMutate,
		isPending: false,
	})),
	useStaffingSummary: vi.fn(() => ({
		data: mockStaffingSummaryData,
		isLoading: false,
	})),
}));

vi.mock('../../hooks/use-master-data', () => ({
	useServiceProfiles: vi.fn(() => ({
		data: mockServiceProfilesData,
		isLoading: false,
	})),
	useDhgRules: vi.fn(() => ({
		data: mockDhgRulesData,
		isLoading: false,
	})),
	useDisciplines: vi.fn(() => ({
		data: {
			data: [
				{ id: 1, code: 'FR', label: 'Francais', band: null },
				{ id: 2, code: 'MATH', label: 'Mathematiques', band: 'LYCEE' },
			],
		},
		isLoading: false,
	})),
}));

vi.mock('../../hooks/use-enrollment', () => ({
	useHeadcount: vi.fn(() => ({
		data: mockHeadcountData,
		isLoading: false,
	})),
}));

vi.mock('../../stores/workspace-context-store', () => ({
	useWorkspaceContextStore: vi.fn(
		(selector: (state: { versionStaleModules: string[] }) => unknown) =>
			selector({ versionStaleModules: mockVersionStaleModules })
	),
}));

vi.mock('../../stores/staffing-settings-store', () => ({
	useStaffingSettingsSheetStore: vi.fn(
		(selector: (state: { isOpen: boolean; setOpen: (v: boolean) => void }) => unknown) =>
			selector({ isOpen: true, setOpen: vi.fn() })
	),
}));

vi.mock('react-router', () => ({
	useNavigate: vi.fn(() => mockNavigate),
}));

// ── Helpers ────────────────────────────────────────────────────────────────

function resetMockData() {
	mockStaffingSettingsData = {
		data: {
			id: 1,
			versionId: 42,
			hsaTargetHours: '1.5',
			hsaFirstHourRate: '250',
			hsaAdditionalHourRate: '200',
			hsaMonths: 10,
		},
	};
	mockStaffingSettingsLoading = false;
	mockPutStaffingSettingsPending = false;
	mockServiceProfilesData = {
		profiles: [
			{
				id: 1,
				code: 'P1',
				name: 'Professeur Principal',
				weeklyServiceHours: '18',
				hsaEligible: true,
				defaultCostMode: 'LOCAL_PAYROLL',
				sortOrder: 1,
			},
			{
				id: 2,
				code: 'P2',
				name: 'Professeur Certifie',
				weeklyServiceHours: '18',
				hsaEligible: false,
				defaultCostMode: 'LOCAL_PAYROLL',
				sortOrder: 2,
			},
		],
	};
	mockServiceProfileOverridesData = {
		data: [
			{
				id: 1,
				versionId: 42,
				serviceProfileId: 1,
				serviceProfileCode: 'P1',
				serviceProfileName: 'Professeur Principal',
				weeklyServiceHours: '17',
				hsaEligible: true,
			},
		],
	};
	mockDhgRulesData = [
		{
			id: 1,
			gradeLevel: 'PS',
			disciplineCode: 'FR',
			lineType: 'STRUCTURAL',
			driverType: 'HOURS',
			hoursPerUnit: '2',
			serviceProfileCode: 'P1',
		},
		{
			id: 2,
			gradeLevel: '2NDE',
			disciplineCode: 'MATH',
			lineType: 'STRUCTURAL',
			driverType: 'GROUPS',
			hoursPerUnit: '4',
			serviceProfileCode: 'P1',
		},
	];
	mockLyceeGroupData = {
		data: [{ disciplineCode: 'MATH', groupCount: 3, hoursPerGroup: '2' }],
	};
	mockCostAssumptionsData = {
		data: [
			{
				id: 1,
				versionId: 42,
				category: 'REMPLACEMENTS',
				calculationMode: 'FLAT_ANNUAL',
				value: '50000',
			},
			{
				id: 2,
				versionId: 42,
				category: 'FORMATION',
				calculationMode: 'PERCENT_OF_PAYROLL',
				value: '0.02',
			},
			{
				id: 3,
				versionId: 42,
				category: 'RESIDENT_SALAIRES',
				calculationMode: 'AMOUNT_PER_FTE',
				value: '5000',
			},
			{
				id: 4,
				versionId: 42,
				category: 'RESIDENT_LOGEMENT',
				calculationMode: 'FLAT_ANNUAL',
				value: '30000',
			},
			{
				id: 5,
				versionId: 42,
				category: 'RESIDENT_PENSION',
				calculationMode: 'FLAT_ANNUAL',
				value: '20000',
			},
		],
	};
	mockHeadcountData = {
		entries: [
			{
				gradeLevel: 'PS',
				gradeName: 'PS',
				band: 'MATERNELLE',
				displayOrder: 1,
				headcount: 25,
				academicPeriod: 'AY2',
			},
			{
				gradeLevel: 'MS',
				gradeName: 'MS',
				band: 'MATERNELLE',
				displayOrder: 2,
				headcount: 30,
				academicPeriod: 'AY2',
			},
		],
	};
	mockStaffingSummaryData = {
		fte: '45.5',
		cost: '5000000',
		byDepartment: [{ department: 'Teaching', total_cost: '4000000' }],
	};
	mockVersionStaleModules = [];
}

/**
 * Gets the sheet content panel (the Radix Dialog content rendered via portal).
 * Sheet uses Dialog.Content which renders in a portal with role="dialog".
 */
function getSheetContent(): HTMLElement {
	return screen.getByRole('dialog');
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('StaffingSettingsSheet', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		resetMockData();
	});

	afterEach(() => {
		cleanup();
	});

	// ── Sheet structure ────────────────────────────────────────────────────

	it('renders the sheet with title and description', () => {
		render(<StaffingSettingsSheet versionId={42} isEditable={true} />);
		const dialog = getSheetContent();
		expect(dialog.textContent).toContain('Staffing Settings');
		expect(dialog.textContent).toContain('Configure staffing parameters');
	});

	it('renders 6 tab triggers', () => {
		render(<StaffingSettingsSheet versionId={42} isEditable={true} />);
		expect(screen.getByRole('tab', { name: /Service Profiles/i })).toBeDefined();
		expect(screen.getByRole('tab', { name: /Curriculum/i })).toBeDefined();
		expect(screen.getByRole('tab', { name: /Lycee Group/i })).toBeDefined();
		expect(screen.getByRole('tab', { name: /Cost Assumptions/i })).toBeDefined();
		expect(screen.getByRole('tab', { name: /Enrollment/i })).toBeDefined();
		expect(screen.getByRole('tab', { name: /Reconciliation/i })).toBeDefined();
	});

	it('renders Close and Save buttons in the footer', () => {
		render(<StaffingSettingsSheet versionId={42} isEditable={true} />);
		const dialog = getSheetContent();
		const buttons = dialog.querySelectorAll('button');
		const buttonTexts = Array.from(buttons).map((b) => b.textContent);
		expect(buttonTexts.some((t) => t?.includes('Close'))).toBe(true);
		expect(buttonTexts.some((t) => t?.includes('Save'))).toBe(true);
	});

	it('disables Save button when there are no changes', () => {
		render(<StaffingSettingsSheet versionId={42} isEditable={true} />);
		const dialog = getSheetContent();
		const saveBtn = Array.from(dialog.querySelectorAll('button')).find((b) =>
			b.textContent?.includes('Save settings')
		) as HTMLButtonElement;
		expect(saveBtn.disabled).toBe(true);
	});

	it('disables Save button when not editable', () => {
		render(<StaffingSettingsSheet versionId={42} isEditable={false} />);
		const dialog = getSheetContent();
		const saveBtn = Array.from(dialog.querySelectorAll('button')).find((b) =>
			b.textContent?.includes('Save settings')
		) as HTMLButtonElement;
		expect(saveBtn.disabled).toBe(true);
	});

	// ── Tab 1: Service Profiles & HSA ──────────────────────────────────────

	describe('Tab 1: Service Profiles & HSA', () => {
		it('shows service profiles in a read-only table', () => {
			render(<StaffingSettingsSheet versionId={42} isEditable={true} />);
			const dialog = getSheetContent();
			expect(dialog.textContent).toContain('Professeur Principal');
			expect(dialog.textContent).toContain('Professeur Certifie');
		});

		it('shows profile codes', () => {
			render(<StaffingSettingsSheet versionId={42} isEditable={true} />);
			const dialog = getSheetContent();
			const cells = Array.from(dialog.querySelectorAll('td'));
			const cellTexts = cells.map((c) => c.textContent?.trim());
			expect(cellTexts).toContain('P1');
			expect(cellTexts).toContain('P2');
		});

		it('shows ORS column with override values', () => {
			render(<StaffingSettingsSheet versionId={42} isEditable={true} />);
			const orsInputs = screen.getAllByLabelText(/ORS/i);
			expect(orsInputs.length).toBeGreaterThanOrEqual(1);
		});

		it('shows HSA eligibility indicators', () => {
			render(<StaffingSettingsSheet versionId={42} isEditable={true} />);
			const dialog = getSheetContent();
			const cells = Array.from(dialog.querySelectorAll('td'));
			const cellTexts = cells.map((c) => c.textContent?.trim());
			expect(cellTexts).toContain('Yes');
			expect(cellTexts).toContain('No');
		});

		it('shows HSA settings fields', () => {
			render(<StaffingSettingsSheet versionId={42} isEditable={true} />);
			expect(screen.getByLabelText(/HSA Target/i)).toBeDefined();
			expect(screen.getByLabelText(/First Hour Rate/i)).toBeDefined();
			expect(screen.getByLabelText(/Additional Hour Rate/i)).toBeDefined();
			expect(screen.getByLabelText(/HSA Months/i)).toBeDefined();
		});

		it('populates HSA fields with current settings', () => {
			render(<StaffingSettingsSheet versionId={42} isEditable={true} />);
			const targetInput = screen.getByLabelText(/HSA Target/i) as HTMLInputElement;
			expect(targetInput.value).toBe('1.5');
		});
	});

	// ── Tab 2: Curriculum / DHG Rules ──────────────────────────────────────

	describe('Tab 2: Curriculum / DHG Rules', () => {
		it('shows DHG rules grouped by band', () => {
			render(<StaffingSettingsSheet versionId={42} isEditable={true} />);
			fireEvent.click(screen.getByRole('tab', { name: /Curriculum/i }));
			const dialog = getSheetContent();
			expect(dialog.textContent).toContain('MATERNELLE');
			expect(dialog.textContent).toContain('LYCEE');
		});

		it('shows rule details: grade, discipline, type, hours', () => {
			render(<StaffingSettingsSheet versionId={42} isEditable={true} />);
			fireEvent.click(screen.getByRole('tab', { name: /Curriculum/i }));
			const dialog = getSheetContent();
			const cells = Array.from(dialog.querySelectorAll('td'));
			const cellTexts = cells.map((c) => c.textContent?.trim());
			expect(cellTexts).toContain('PS');
			expect(cellTexts).toContain('FR');
			expect(cellTexts).toContain('HOURS');
		});

		it('shows Edit in Master Data link', () => {
			render(<StaffingSettingsSheet versionId={42} isEditable={true} />);
			fireEvent.click(screen.getByRole('tab', { name: /Curriculum/i }));
			const dialog = getSheetContent();
			expect(dialog.textContent).toContain('Edit in Master Data');
		});

		it('DHG rules display is read-only (no editable inputs)', () => {
			render(<StaffingSettingsSheet versionId={42} isEditable={true} />);
			const dialog = getSheetContent();
			// Find the curriculum tabpanel by its id (radix convention: trigger id + '-content-')
			const panels = Array.from(dialog.querySelectorAll('[role="tabpanel"]'));
			const curriculumPanel = panels.find((p) => p.id && p.id.includes('curriculum'));
			expect(curriculumPanel).toBeDefined();
			const inputs = curriculumPanel!.querySelectorAll('input:not([type="hidden"])');
			expect(inputs.length).toBe(0);
		});
	});

	// ── Tab 3: Lycee Group Assumptions ─────────────────────────────────────

	describe('Tab 3: Lycee Group Assumptions', () => {
		it('shows Lycee Group tab when GROUP-driver rules exist', () => {
			render(<StaffingSettingsSheet versionId={42} isEditable={true} />);
			expect(screen.getByRole('tab', { name: /Lycee Group/i })).toBeDefined();
		});

		it('shows editable group count and hours per group fields', () => {
			render(<StaffingSettingsSheet versionId={42} isEditable={true} />);
			fireEvent.click(screen.getByRole('tab', { name: /Lycee Group/i }));
			expect(screen.getByLabelText(/MATH Group Count/i)).toBeDefined();
			expect(screen.getByLabelText(/MATH Hours\/Group/i)).toBeDefined();
		});

		it('populates with current assumption values', () => {
			render(<StaffingSettingsSheet versionId={42} isEditable={true} />);
			fireEvent.click(screen.getByRole('tab', { name: /Lycee Group/i }));
			const groupCount = screen.getByLabelText(/MATH Group Count/i) as HTMLInputElement;
			expect(groupCount.value).toBe('3');
		});

		it('hides Lycee Group tab when no GROUP-driver rules exist', () => {
			mockDhgRulesData = [
				{
					id: 1,
					gradeLevel: 'PS',
					disciplineCode: 'FR',
					lineType: 'STRUCTURAL',
					driverType: 'HOURS',
					hoursPerUnit: '2',
					serviceProfileCode: 'P1',
				},
			];

			render(<StaffingSettingsSheet versionId={42} isEditable={true} />);
			expect(screen.queryByRole('tab', { name: /Lycee Group/i })).toBeNull();
		});
	});

	// ── Tab 4: Additional Cost Assumptions ─────────────────────────────────

	describe('Tab 4: Additional Cost Assumptions', () => {
		it('shows 5 category rows', () => {
			render(<StaffingSettingsSheet versionId={42} isEditable={true} />);
			fireEvent.click(screen.getByRole('tab', { name: /Cost Assumptions/i }));
			const dialog = getSheetContent();
			expect(dialog.textContent).toContain('Remplacements');
			expect(dialog.textContent).toContain('Formation');
			expect(dialog.textContent).toContain('Resident Salaires');
			expect(dialog.textContent).toContain('Resident Logement');
			expect(dialog.textContent).toContain('Resident Pension');
		});

		it('shows mode dropdown for each category', () => {
			render(<StaffingSettingsSheet versionId={42} isEditable={true} />);
			fireEvent.click(screen.getByRole('tab', { name: /Cost Assumptions/i }));
			const modeSelects = screen.getAllByLabelText(/mode/i);
			expect(modeSelects.length).toBe(5);
		});

		it('shows value input for each category', () => {
			render(<StaffingSettingsSheet versionId={42} isEditable={true} />);
			fireEvent.click(screen.getByRole('tab', { name: /Cost Assumptions/i }));
			const valueInputs = screen.getAllByLabelText(/value/i);
			expect(valueInputs.length).toBe(5);
		});

		it('shows monthly preview column', () => {
			render(<StaffingSettingsSheet versionId={42} isEditable={true} />);
			fireEvent.click(screen.getByRole('tab', { name: /Cost Assumptions/i }));
			const dialog = getSheetContent();
			expect(dialog.textContent).toContain('Monthly');
		});
	});

	// ── Tab 5: Enrollment Link ─────────────────────────────────────────────

	describe('Tab 5: Enrollment Link', () => {
		it('shows AY2 headcounts by grade', () => {
			render(<StaffingSettingsSheet versionId={42} isEditable={true} />);
			fireEvent.click(screen.getByRole('tab', { name: /Enrollment/i }));
			const dialog = getSheetContent();
			const cells = Array.from(dialog.querySelectorAll('td'));
			const cellTexts = cells.map((c) => c.textContent?.trim());
			expect(cellTexts).toContain('PS');
			expect(cellTexts).toContain('25');
			expect(cellTexts).toContain('MS');
			expect(cellTexts).toContain('30');
		});

		it('shows Go to Enrollment button', () => {
			render(<StaffingSettingsSheet versionId={42} isEditable={true} />);
			fireEvent.click(screen.getByRole('tab', { name: /Enrollment/i }));
			const dialog = getSheetContent();
			const buttons = Array.from(dialog.querySelectorAll('button'));
			expect(buttons.some((b) => b.textContent?.includes('Go to Enrollment'))).toBe(true);
		});

		it('shows stale warning when ENROLLMENT is stale', () => {
			mockVersionStaleModules = ['ENROLLMENT'];
			render(<StaffingSettingsSheet versionId={42} isEditable={true} />);
			fireEvent.click(screen.getByRole('tab', { name: /Enrollment/i }));
			const dialog = getSheetContent();
			expect(dialog.textContent?.toLowerCase()).toContain('stale');
		});

		it('enrollment data is read-only (no editable inputs)', () => {
			render(<StaffingSettingsSheet versionId={42} isEditable={true} />);
			const dialog = getSheetContent();
			const panels = Array.from(dialog.querySelectorAll('[role="tabpanel"]'));
			const enrollmentPanel = panels.find((p) => p.id && p.id.includes('enrollment'));
			expect(enrollmentPanel).toBeDefined();
			const inputs = enrollmentPanel!.querySelectorAll(
				'input:not([type="hidden"]):not([readonly])'
			);
			expect(inputs.length).toBe(0);
		});
	});

	// ── Tab 6: Reconciliation ──────────────────────────────────────────────

	describe('Tab 6: Reconciliation', () => {
		it('shows reconciliation comparison table headers', () => {
			render(<StaffingSettingsSheet versionId={42} isEditable={true} />);
			fireEvent.click(screen.getByRole('tab', { name: /Reconciliation/i }));
			const dialog = getSheetContent();
			const headers = Array.from(dialog.querySelectorAll('th'));
			const headerTexts = headers.map((h) => h.textContent?.trim());
			expect(headerTexts).toContain('Metric');
			expect(headerTexts).toContain('App-Computed');
			expect(headerTexts).toContain('Baseline');
			expect(headerTexts).toContain('Delta');
			expect(headerTexts).toContain('Status');
		});

		it('shows reconciliation metrics', () => {
			render(<StaffingSettingsSheet versionId={42} isEditable={true} />);
			fireEvent.click(screen.getByRole('tab', { name: /Reconciliation/i }));
			const dialog = getSheetContent();
			expect(dialog.textContent).toContain('Total FTE');
			expect(dialog.textContent).toContain('Total Cost');
		});

		it('reconciliation is read-only', () => {
			render(<StaffingSettingsSheet versionId={42} isEditable={true} />);
			const dialog = getSheetContent();
			const panels = Array.from(dialog.querySelectorAll('[role="tabpanel"]'));
			const reconPanel = panels.find((p) => p.id && p.id.includes('reconciliation'));
			expect(reconPanel).toBeDefined();
			const inputs = reconPanel!.querySelectorAll('input:not([type="hidden"]):not([readonly])');
			expect(inputs.length).toBe(0);
		});
	});

	// ── Save behavior ──────────────────────────────────────────────────────

	describe('Save behavior', () => {
		it('enables Save button after modifying an HSA setting', () => {
			render(<StaffingSettingsSheet versionId={42} isEditable={true} />);
			const targetInput = screen.getByLabelText(/HSA Target/i);
			fireEvent.change(targetInput, { target: { value: '2.0' } });
			const dialog = getSheetContent();
			const saveBtn = Array.from(dialog.querySelectorAll('button')).find((b) =>
				b.textContent?.includes('Save settings')
			) as HTMLButtonElement;
			expect(saveBtn.disabled).toBe(false);
		});

		it('calls PUT endpoints on save', async () => {
			render(<StaffingSettingsSheet versionId={42} isEditable={true} />);
			const targetInput = screen.getByLabelText(/HSA Target/i);
			fireEvent.change(targetInput, { target: { value: '2.0' } });
			const dialog = getSheetContent();
			const saveBtn = Array.from(dialog.querySelectorAll('button')).find((b) =>
				b.textContent?.includes('Save settings')
			) as HTMLButtonElement;
			fireEvent.click(saveBtn);
			await waitFor(() => {
				expect(mockPutStaffingSettingsMutate).toHaveBeenCalled();
			});
		});

		it('enables Save button after modifying a cost assumption', () => {
			render(<StaffingSettingsSheet versionId={42} isEditable={true} />);
			fireEvent.click(screen.getByRole('tab', { name: /Cost Assumptions/i }));
			const valueInputs = screen.getAllByLabelText(/value/i);
			fireEvent.change(valueInputs[0]!, { target: { value: '60000' } });
			const dialog = getSheetContent();
			const saveBtn = Array.from(dialog.querySelectorAll('button')).find((b) =>
				b.textContent?.includes('Save settings')
			) as HTMLButtonElement;
			expect(saveBtn.disabled).toBe(false);
		});

		it('enables Save button after modifying a lycee group assumption', () => {
			render(<StaffingSettingsSheet versionId={42} isEditable={true} />);
			fireEvent.click(screen.getByRole('tab', { name: /Lycee Group/i }));
			const groupCountInput = screen.getByLabelText(/MATH Group Count/i);
			fireEvent.change(groupCountInput, { target: { value: '4' } });
			const dialog = getSheetContent();
			const saveBtn = Array.from(dialog.querySelectorAll('button')).find((b) =>
				b.textContent?.includes('Save settings')
			) as HTMLButtonElement;
			expect(saveBtn.disabled).toBe(false);
		});

		it('shows Saving... text while mutation is pending', () => {
			mockPutStaffingSettingsPending = true;
			render(<StaffingSettingsSheet versionId={42} isEditable={true} />);
			const dialog = getSheetContent();
			expect(dialog.textContent).toContain('Saving');
		});
	});

	// ── Read-only mode ─────────────────────────────────────────────────────

	describe('Read-only mode', () => {
		it('shows review mode indicator when not editable', () => {
			render(<StaffingSettingsSheet versionId={42} isEditable={false} />);
			const dialog = getSheetContent();
			expect(dialog.textContent).toContain('Review mode');
		});

		it('disables HSA input fields when not editable', () => {
			render(<StaffingSettingsSheet versionId={42} isEditable={false} />);
			const targetInput = screen.getByLabelText(/HSA Target/i) as HTMLInputElement;
			expect(targetInput.disabled).toBe(true);
		});
	});

	// ── Edge cases ─────────────────────────────────────────────────────────

	describe('Edge cases', () => {
		it('renders loading state when data is loading', () => {
			mockStaffingSettingsData = undefined;
			mockStaffingSettingsLoading = true;
			render(<StaffingSettingsSheet versionId={42} isEditable={true} />);
			const dialog = getSheetContent();
			expect(dialog.textContent).toContain('Loading');
		});

		it('handles null versionId gracefully', () => {
			render(<StaffingSettingsSheet versionId={null} isEditable={true} />);
			const dialog = getSheetContent();
			expect(dialog.textContent).toContain('Staffing Settings');
		});

		it('renders monetary inputs with monospace font class', () => {
			render(<StaffingSettingsSheet versionId={42} isEditable={true} />);
			const rateInput = screen.getByLabelText(/First Hour Rate/i);
			expect(rateInput.className).toContain('font-');
		});
	});
});
