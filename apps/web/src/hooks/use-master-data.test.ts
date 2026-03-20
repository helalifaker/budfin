import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import {
	useServiceProfiles,
	useDisciplines,
	useDhgRules,
	useAutoSuggestAssignments,
	useDemandOverrides,
} from './use-master-data';

// Mock apiClient to track calls
const mockApiClient = vi.fn();

vi.mock('../lib/api-client', () => ({
	apiClient: (...args: unknown[]) => mockApiClient(...args),
	ApiError: class ApiError extends Error {
		status: number;
		code: string;
		constructor(status: number, code: string, message: string) {
			super(message);
			this.status = status;
			this.code = code;
		}
	},
}));

vi.mock('../components/ui/toast-state', () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn(),
	},
}));

function createWrapper() {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: { retry: false },
			mutations: { retry: false },
		},
	});
	return function Wrapper({ children }: { children: ReactNode }) {
		return createElement(QueryClientProvider, { client: queryClient }, children);
	};
}

afterEach(() => {
	mockApiClient.mockReset();
});

// ── useServiceProfiles ──────────────────────────────────────────────────────

describe('useServiceProfiles', () => {
	it('fetches service profiles and selects profiles array', async () => {
		const mockProfiles = [
			{
				id: 1,
				code: 'CERTIFIE',
				name: 'Professeur Certifie',
				weeklyServiceHours: '18.0',
				hsaEligible: true,
				defaultCostMode: 'LOCAL_PAYROLL',
				sortOrder: 2,
			},
		];
		mockApiClient.mockResolvedValue({ profiles: mockProfiles });

		const { result } = renderHook(() => useServiceProfiles(), { wrapper: createWrapper() });

		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(mockApiClient).toHaveBeenCalledWith('/master-data/service-profiles');
		expect(result.current.data).toEqual(mockProfiles);
	});
});

// ── useDisciplines ──────────────────────────────────────────────────────────

describe('useDisciplines', () => {
	it('fetches disciplines and selects disciplines array', async () => {
		const mockDisciplines = [
			{
				id: 1,
				code: 'MATHEMATIQUES',
				name: 'Mathematiques',
				category: 'SUBJECT',
				sortOrder: 2,
				aliases: [{ id: 1, alias: 'Maths' }],
			},
		];
		mockApiClient.mockResolvedValue({ disciplines: mockDisciplines });

		const { result } = renderHook(() => useDisciplines(), { wrapper: createWrapper() });

		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(mockApiClient).toHaveBeenCalledWith('/master-data/disciplines');
		expect(result.current.data).toEqual(mockDisciplines);
	});
});

// ── useDhgRules ─────────────────────────────────────────────────────────────

describe('useDhgRules', () => {
	it('fetches DHG rules from master data and selects rules array', async () => {
		const mockRules = [
			{
				id: 1,
				gradeLevel: '6eme',
				disciplineId: 1,
				disciplineCode: 'MATHS',
				disciplineName: 'Mathematiques',
				lineType: 'STRUCTURAL',
				driverType: 'HOURS',
				hoursPerUnit: '4.5',
				serviceProfileId: 1,
				serviceProfileCode: 'ENS2D',
				serviceProfileName: 'Enseignant 2nd degre',
				languageCode: null,
				groupingKey: null,
				effectiveFromYear: 2025,
				effectiveToYear: null,
				updatedAt: '2026-01-01T00:00:00.000Z',
			},
		];
		mockApiClient.mockResolvedValue({ rules: mockRules });

		const { result } = renderHook(() => useDhgRules(), { wrapper: createWrapper() });

		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(mockApiClient).toHaveBeenCalledWith('/master-data/dhg-rules');
		expect(result.current.data).toEqual(mockRules);
	});
});

// ── useAutoSuggestAssignments ───────────────────────────────────────────────

describe('useAutoSuggestAssignments', () => {
	it('sends POST to auto-suggest endpoint', async () => {
		const mockData = {
			suggestions: [],
			summary: {
				totalSuggestions: 0,
				highConfidence: 0,
				mediumConfidence: 0,
				unassignedRemaining: 0,
			},
		};
		mockApiClient.mockResolvedValue(mockData);

		const { result } = renderHook(() => useAutoSuggestAssignments(10), {
			wrapper: createWrapper(),
		});

		result.current.mutate();

		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(mockApiClient).toHaveBeenCalledWith('/versions/10/staffing-assignments/auto-suggest', {
			method: 'POST',
		});
	});
});

// ── useDemandOverrides ──────────────────────────────────────────────────────

describe('useDemandOverrides', () => {
	it('fetches demand overrides', async () => {
		const mockData = { data: [] };
		mockApiClient.mockResolvedValue(mockData);

		const { result } = renderHook(() => useDemandOverrides(10), {
			wrapper: createWrapper(),
		});

		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(mockApiClient).toHaveBeenCalledWith('/versions/10/demand-overrides');
	});

	it('does not fetch when versionId is null', () => {
		renderHook(() => useDemandOverrides(null), { wrapper: createWrapper() });
		expect(mockApiClient).not.toHaveBeenCalled();
	});
});
