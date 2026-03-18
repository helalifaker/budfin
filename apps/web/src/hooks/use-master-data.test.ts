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
	it('fetches service profiles from master data', async () => {
		const mockData = {
			data: [{ id: 1, code: 'CERT', label: 'Certifie', defaultOrs: '18', isHsaEligible: true }],
		};
		mockApiClient.mockResolvedValue(mockData);

		const { result } = renderHook(() => useServiceProfiles(), { wrapper: createWrapper() });

		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(mockApiClient).toHaveBeenCalledWith('/master-data/service-profiles');
		expect(result.current.data).toEqual(mockData);
	});
});

// ── useDisciplines ──────────────────────────────────────────────────────────

describe('useDisciplines', () => {
	it('fetches disciplines from master data', async () => {
		const mockData = {
			data: [{ id: 1, code: 'MATHS', label: 'Mathematics', band: null }],
		};
		mockApiClient.mockResolvedValue(mockData);

		const { result } = renderHook(() => useDisciplines(), { wrapper: createWrapper() });

		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(mockApiClient).toHaveBeenCalledWith('/master-data/disciplines');
		expect(result.current.data).toEqual(mockData);
	});
});

// ── useDhgRules ─────────────────────────────────────────────────────────────

describe('useDhgRules', () => {
	it('fetches DHG rules from master data', async () => {
		const mockData = {
			data: [
				{
					id: 1,
					band: 'COLLEGE',
					gradeLevel: '6eme',
					disciplineCode: 'MATHS',
					hoursPerWeekPerSection: '4.5',
					dhgType: 'STRUCTURAL',
				},
			],
		};
		mockApiClient.mockResolvedValue(mockData);

		const { result } = renderHook(() => useDhgRules(), { wrapper: createWrapper() });

		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(mockApiClient).toHaveBeenCalledWith('/master-data/dhg-rules');
		expect(result.current.data).toEqual(mockData);
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
