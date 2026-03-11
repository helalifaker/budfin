import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { CohortParameterEntry } from '@budfin/types';
import { EnrollmentSetupWizard } from './setup-wizard';

function createBaselineData() {
	return {
		available: true,
		sourceVersion: null,
		entries: [
			{
				gradeLevel: 'PS',
				gradeName: 'Petite Section',
				band: 'MATERNELLE',
				displayOrder: 1,
				baselineHeadcount: 90,
			},
			{
				gradeLevel: 'MS',
				gradeName: 'Moyenne Section',
				band: 'MATERNELLE',
				displayOrder: 2,
				baselineHeadcount: 100,
			},
		],
		totals: {
			grandTotal: 190,
			bands: [{ band: 'MATERNELLE', total: 190 }],
		},
	};
}

function createHeadcountData() {
	return {
		entries: [
			{
				gradeLevel: 'PS',
				academicPeriod: 'AY1',
				headcount: 91,
				gradeName: 'Petite Section',
				band: 'MATERNELLE',
				displayOrder: 1,
			},
			{
				gradeLevel: 'MS',
				academicPeriod: 'AY1',
				headcount: 101,
				gradeName: 'Moyenne Section',
				band: 'MATERNELLE',
				displayOrder: 2,
			},
			{
				gradeLevel: 'PS',
				academicPeriod: 'AY2',
				headcount: 93,
				gradeName: 'Petite Section',
				band: 'MATERNELLE',
				displayOrder: 1,
			},
		],
	};
}

function createCohortData() {
	return {
		entries: [
			{
				gradeLevel: 'PS',
				retentionRate: 0,
				lateralEntryCount: 0,
				lateralWeightFr: 0,
				lateralWeightNat: 0,
				lateralWeightAut: 0,
				isPersisted: true,
				recommendedRetentionRate: 0,
				recommendedLateralEntryCount: 0,
				recommendationConfidence: 'low' as const,
			},
			{
				gradeLevel: 'MS',
				retentionRate: 0.97,
				lateralEntryCount: 2,
				lateralWeightFr: 0.3333,
				lateralWeightNat: 0.3334,
				lateralWeightAut: 0.3333,
				isPersisted: true,
				recommendedRetentionRate: 0.991,
				recommendedLateralEntryCount: 1,
				recommendationConfidence: 'high' as const,
			},
		] satisfies CohortParameterEntry[],
	};
}

function createGradeLevelsData() {
	return {
		gradeLevels: [
			{
				gradeCode: 'PS',
				gradeName: 'Petite Section',
				band: 'MATERNELLE',
				displayOrder: 1,
				maxClassSize: 25,
				plafondPct: '1',
			},
			{
				gradeCode: 'MS',
				gradeName: 'Moyenne Section',
				band: 'MATERNELLE',
				displayOrder: 2,
				maxClassSize: 25,
				plafondPct: '1',
			},
		],
	};
}

const mockHooks = vi.hoisted(() => ({
	applyMutateAsync: vi.fn().mockResolvedValue({ runId: 'wizard-run-1' }),
	importMutateAsync: vi.fn().mockResolvedValue(undefined),
	importReset: vi.fn(),
	importData: null as {
		totalRows: number;
		validRows: number;
		errors: Array<{ row: number; field: string; message: string }>;
		preview: Array<{
			gradeLevel: string;
			gradeName: string;
			band: string;
			displayOrder: number;
			baselineHeadcount: number;
			importedHeadcount: number | null;
			delta: number | null;
			variancePct: number | null;
			hasLargeVariance: boolean;
		}>;
		summary: {
			baselineTotal: number;
			importTotal: number;
		};
	} | null,
	baselineData: createBaselineData(),
	headcountData: createHeadcountData(),
	cohortData: createCohortData(),
	gradeLevelsData: createGradeLevelsData(),
	nationalityData: {
		entries: [],
	},
}));

vi.mock('../../hooks/use-enrollment', () => ({
	useApplyEnrollmentSetup: () => ({
		mutateAsync: mockHooks.applyMutateAsync,
		isPending: false,
	}),
	useEnrollmentSetupBaseline: () => ({
		data: mockHooks.baselineData,
	}),
	useHeadcount: () => ({
		data: mockHooks.headcountData,
	}),
	useValidateEnrollmentSetupImport: () => ({
		mutateAsync: mockHooks.importMutateAsync,
		reset: mockHooks.importReset,
		data: mockHooks.importData,
		isPending: false,
	}),
}));

vi.mock('../../hooks/use-cohort-parameters', () => ({
	useCohortParameters: () => ({
		data: mockHooks.cohortData,
	}),
}));

vi.mock('../../hooks/use-grade-levels', () => ({
	useGradeLevels: () => ({
		data: mockHooks.gradeLevelsData,
	}),
}));

vi.mock('../../hooks/use-nationality-breakdown', () => ({
	useNationalityBreakdown: () => ({
		data: mockHooks.nationalityData,
	}),
}));

class MockResizeObserver {
	observe() {}
	unobserve() {}
	disconnect() {}
}

describe('EnrollmentSetupWizard', () => {
	beforeEach(() => {
		globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
		vi.spyOn(window, 'requestAnimationFrame').mockImplementation(
			(callback: FrameRequestCallback) => {
				callback(0);
				return 1;
			}
		);
		vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
		mockHooks.applyMutateAsync.mockClear();
		mockHooks.importMutateAsync.mockClear();
		mockHooks.importReset.mockClear();
		mockHooks.baselineData = createBaselineData();
		mockHooks.headcountData = createHeadcountData();
		mockHooks.cohortData = createCohortData();
		mockHooks.gradeLevelsData = createGradeLevelsData();
		mockHooks.nationalityData = { entries: [] };
		mockHooks.importData = null;
	});

	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
	});

	it('preserves existing working values for grades missing from a partial import', async () => {
		mockHooks.importData = {
			totalRows: 1,
			validRows: 1,
			errors: [],
			preview: [
				{
					gradeLevel: 'MS',
					gradeName: 'Moyenne Section',
					band: 'MATERNELLE',
					displayOrder: 2,
					baselineHeadcount: 100,
					importedHeadcount: 120,
					delta: 20,
					variancePct: 20,
					hasLargeVariance: true,
				},
			],
			summary: {
				baselineTotal: 190,
				importTotal: 120,
			},
		};

		render(
			<EnrollmentSetupWizard
				open
				versionId={20}
				versionName="v2"
				editability="editable"
				onClose={vi.fn()}
			/>
		);

		fireEvent.click(screen.getByRole('button', { name: /Import Compare/i }));
		fireEvent.click(screen.getByRole('button', { name: /Use imported values/i }));
		fireEvent.click(screen.getByRole('button', { name: /Preview & Validate/i }));
		fireEvent.click(screen.getByRole('button', { name: /Validate and Apply/i }));

		await waitFor(() => {
			expect(mockHooks.applyMutateAsync).toHaveBeenCalledTimes(1);
		});

		const payload = mockHooks.applyMutateAsync.mock.calls[0]![0];
		expect(payload.ay1Entries).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ gradeLevel: 'PS', headcount: 91 }),
				expect.objectContaining({ gradeLevel: 'MS', headcount: 120 }),
			])
		);
	});

	it('restores the seeded baseline dataset when Keep baseline is chosen after an import', async () => {
		mockHooks.importData = {
			totalRows: 1,
			validRows: 1,
			errors: [],
			preview: [
				{
					gradeLevel: 'MS',
					gradeName: 'Moyenne Section',
					band: 'MATERNELLE',
					displayOrder: 2,
					baselineHeadcount: 100,
					importedHeadcount: 120,
					delta: 20,
					variancePct: 20,
					hasLargeVariance: true,
				},
			],
			summary: {
				baselineTotal: 190,
				importTotal: 120,
			},
		};

		render(
			<EnrollmentSetupWizard
				open
				versionId={20}
				versionName="v2"
				editability="editable"
				onClose={vi.fn()}
			/>
		);

		fireEvent.click(screen.getByRole('button', { name: /Import Compare/i }));
		fireEvent.click(screen.getByRole('button', { name: /Use imported values/i }));
		fireEvent.click(screen.getByRole('button', { name: /Keep baseline/i }));
		fireEvent.click(screen.getByRole('button', { name: /AY1 Review/i }));
		fireEvent.click(screen.getByRole('button', { name: /Retention & Laterals/i }));
		fireEvent.click(screen.getByRole('button', { name: /Preview & Validate/i }));
		fireEvent.click(screen.getByRole('button', { name: /Validate and Apply/i }));

		await waitFor(() => {
			expect(mockHooks.applyMutateAsync).toHaveBeenCalledTimes(1);
		});

		const payload = mockHooks.applyMutateAsync.mock.calls[0]![0];
		expect(payload.ay1Entries).toEqual(
			expect.arrayContaining([expect.objectContaining({ gradeLevel: 'MS', headcount: 101 })])
		);
	});

	it('keeps navigation disabled until the wizard data is initialized', () => {
		mockHooks.baselineData = undefined as never;
		mockHooks.headcountData = undefined as never;
		mockHooks.cohortData = undefined as never;

		render(
			<EnrollmentSetupWizard
				open
				versionId={20}
				versionName="v2"
				editability="editable"
				onClose={vi.fn()}
			/>
		);

		expect(screen.getByText('Loading setup data')).toBeTruthy();
		const nextButton = screen.getByRole('button', { name: /Next/i }) as HTMLButtonElement;
		expect(nextButton.disabled).toBe(true);
		const previewStepButton = screen.getByRole('button', {
			name: /Preview & Validate/i,
		}) as HTMLButtonElement;
		expect(previewStepButton.disabled).toBe(true);
	});

	it('normalizes integer-only wizard fields before apply', async () => {
		render(
			<EnrollmentSetupWizard
				open
				versionId={20}
				versionName="v2"
				editability="editable"
				onClose={vi.fn()}
			/>
		);

		fireEvent.click(screen.getByRole('button', { name: /AY1 Review/i }));
		const reviewSection = screen
			.getByRole('heading', { name: 'Finalize AY1 headcounts' })
			.closest('section');
		expect(reviewSection).not.toBeNull();
		const reviewInputs = reviewSection!.querySelectorAll('input[type="number"]');
		expect(reviewInputs.length).toBeGreaterThanOrEqual(3);

		fireEvent.change(reviewInputs[0]!, { target: { value: '92.6' } });
		fireEvent.change(reviewInputs[2]!, { target: { value: '101.6' } });

		fireEvent.click(screen.getByRole('button', { name: /Retention & Laterals/i }));
		const cohortSection = screen
			.getByRole('heading', { name: 'Retention and lateral entries' })
			.closest('section');
		expect(cohortSection).not.toBeNull();
		const cohortInputs = cohortSection!.querySelectorAll('input[type="number"]');
		expect(cohortInputs.length).toBeGreaterThanOrEqual(2);

		fireEvent.change(cohortInputs[1]!, { target: { value: '3.7' } });

		fireEvent.click(screen.getByRole('button', { name: /Preview & Validate/i }));
		fireEvent.click(screen.getByRole('button', { name: /Validate and Apply/i }));

		await waitFor(() => {
			expect(mockHooks.applyMutateAsync).toHaveBeenCalledTimes(1);
		});

		const payload = mockHooks.applyMutateAsync.mock.calls[0]![0];
		expect(payload.psAy2Headcount).toBe(93);
		expect(payload.ay1Entries).toEqual(
			expect.arrayContaining([expect.objectContaining({ gradeLevel: 'MS', headcount: 102 })])
		);
		expect(payload.cohortEntries).toEqual(
			expect.arrayContaining([expect.objectContaining({ gradeLevel: 'MS', lateralEntryCount: 4 })])
		);
	});

	it('reinitializes staged state when the version changes while open', async () => {
		const { rerender } = render(
			<EnrollmentSetupWizard
				open
				versionId={20}
				versionName="v2"
				editability="editable"
				onClose={vi.fn()}
			/>
		);

		fireEvent.click(screen.getByRole('button', { name: /Preview & Validate/i }));
		fireEvent.click(screen.getByRole('button', { name: /AY1 Review/i }));

		const reviewSection = screen
			.getByRole('heading', { name: 'Finalize AY1 headcounts' })
			.closest('section');
		expect(reviewSection).not.toBeNull();
		const reviewInputs = reviewSection!.querySelectorAll('input[type="number"]');
		fireEvent.change(reviewInputs[2]!, { target: { value: '110' } });

		mockHooks.headcountData = {
			entries: [
				{
					gradeLevel: 'PS',
					academicPeriod: 'AY1',
					headcount: 80,
					gradeName: 'Petite Section',
					band: 'MATERNELLE',
					displayOrder: 1,
				},
				{
					gradeLevel: 'MS',
					academicPeriod: 'AY1',
					headcount: 88,
					gradeName: 'Moyenne Section',
					band: 'MATERNELLE',
					displayOrder: 2,
				},
				{
					gradeLevel: 'PS',
					academicPeriod: 'AY2',
					headcount: 81,
					gradeName: 'Petite Section',
					band: 'MATERNELLE',
					displayOrder: 1,
				},
			],
		};

		rerender(
			<EnrollmentSetupWizard
				open
				versionId={21}
				versionName="v3"
				editability="editable"
				onClose={vi.fn()}
			/>
		);

		fireEvent.click(screen.getByRole('button', { name: /AY1 Review/i }));
		const updatedSection = screen
			.getByRole('heading', { name: 'Finalize AY1 headcounts' })
			.closest('section');
		expect(updatedSection).not.toBeNull();
		const updatedInputs = updatedSection!.querySelectorAll('input[type="number"]');
		expect((updatedInputs[2] as HTMLInputElement).value).toBe('88');
	});
});
