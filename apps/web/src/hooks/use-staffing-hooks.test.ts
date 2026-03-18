import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import {
	useStaffingSettings,
	usePutStaffingSettings,
	useServiceProfileOverrides,
	usePutServiceProfileOverrides,
	useCostAssumptions,
	usePutCostAssumptions,
	useLyceeGroupAssumptions,
	usePutLyceeGroupAssumptions,
	useTeachingRequirements,
	useTeachingRequirementSources,
	useStaffingAssignments,
	useCreateAssignment,
	useUpdateAssignment,
	useDeleteAssignment,
} from './use-staffing';

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

// ── useStaffingSettings ─────────────────────────────────────────────────────

describe('useStaffingSettings', () => {
	it('fetches staffing settings for the given versionId', async () => {
		const mockData = { data: { id: 1, versionId: 10, hsaMonths: 10 } };
		mockApiClient.mockResolvedValue(mockData);

		const { result } = renderHook(() => useStaffingSettings(10), {
			wrapper: createWrapper(),
		});

		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(mockApiClient).toHaveBeenCalledWith('/versions/10/staffing-settings');
		expect(result.current.data).toEqual(mockData);
	});

	it('does not fetch when versionId is null', () => {
		renderHook(() => useStaffingSettings(null), { wrapper: createWrapper() });
		expect(mockApiClient).not.toHaveBeenCalled();
	});
});

// ── usePutStaffingSettings ──────────────────────────────────────────────────

describe('usePutStaffingSettings', () => {
	it('sends PUT to staffing-settings endpoint', async () => {
		mockApiClient.mockResolvedValue({ data: { id: 1 } });

		const { result } = renderHook(() => usePutStaffingSettings(10), {
			wrapper: createWrapper(),
		});

		result.current.mutate({ hsaMonths: 10 });

		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(mockApiClient).toHaveBeenCalledWith('/versions/10/staffing-settings', {
			method: 'PUT',
			body: JSON.stringify({ hsaMonths: 10 }),
		});
	});
});

// ── useServiceProfileOverrides ──────────────────────────────────────────────

describe('useServiceProfileOverrides', () => {
	it('fetches service profile overrides', async () => {
		const mockData = { data: [{ serviceProfileId: 1, effectiveOrs: '18' }] };
		mockApiClient.mockResolvedValue(mockData);

		const { result } = renderHook(() => useServiceProfileOverrides(10), {
			wrapper: createWrapper(),
		});

		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(mockApiClient).toHaveBeenCalledWith('/versions/10/service-profile-overrides');
	});

	it('does not fetch when versionId is null', () => {
		renderHook(() => useServiceProfileOverrides(null), { wrapper: createWrapper() });
		expect(mockApiClient).not.toHaveBeenCalled();
	});
});

// ── usePutServiceProfileOverrides ───────────────────────────────────────────

describe('usePutServiceProfileOverrides', () => {
	it('sends PUT with overrides', async () => {
		mockApiClient.mockResolvedValue({ data: [] });

		const { result } = renderHook(() => usePutServiceProfileOverrides(10), {
			wrapper: createWrapper(),
		});

		const overrides = [{ serviceProfileId: 1, effectiveOrs: '18' }];
		result.current.mutate(overrides);

		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(mockApiClient).toHaveBeenCalledWith('/versions/10/service-profile-overrides', {
			method: 'PUT',
			body: JSON.stringify({ overrides }),
		});
	});
});

// ── useCostAssumptions ──────────────────────────────────────────────────────

describe('useCostAssumptions', () => {
	it('fetches cost assumptions', async () => {
		const mockData = {
			data: [
				{
					id: 1,
					versionId: 10,
					category: 'formation',
					calculationMode: 'FLAT_ANNUAL',
					value: '5000',
				},
			],
		};
		mockApiClient.mockResolvedValue(mockData);

		const { result } = renderHook(() => useCostAssumptions(10), {
			wrapper: createWrapper(),
		});

		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(mockApiClient).toHaveBeenCalledWith('/versions/10/cost-assumptions');
	});

	it('does not fetch when versionId is null', () => {
		renderHook(() => useCostAssumptions(null), { wrapper: createWrapper() });
		expect(mockApiClient).not.toHaveBeenCalled();
	});
});

// ── usePutCostAssumptions ───────────────────────────────────────────────────

describe('usePutCostAssumptions', () => {
	it('sends PUT with assumptions', async () => {
		mockApiClient.mockResolvedValue({ data: [] });

		const { result } = renderHook(() => usePutCostAssumptions(10), {
			wrapper: createWrapper(),
		});

		const assumptions = [{ category: 'formation', calculationMode: 'FLAT_ANNUAL', value: '5000' }];
		result.current.mutate(assumptions);

		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(mockApiClient).toHaveBeenCalledWith('/versions/10/cost-assumptions', {
			method: 'PUT',
			body: JSON.stringify({ assumptions }),
		});
	});
});

// ── useLyceeGroupAssumptions ────────────────────────────────────────────────

describe('useLyceeGroupAssumptions', () => {
	it('fetches lycee group assumptions', async () => {
		mockApiClient.mockResolvedValue({ data: [] });

		const { result } = renderHook(() => useLyceeGroupAssumptions(10), {
			wrapper: createWrapper(),
		});

		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(mockApiClient).toHaveBeenCalledWith('/versions/10/lycee-group-assumptions');
	});

	it('does not fetch when versionId is null', () => {
		renderHook(() => useLyceeGroupAssumptions(null), { wrapper: createWrapper() });
		expect(mockApiClient).not.toHaveBeenCalled();
	});
});

// ── usePutLyceeGroupAssumptions ─────────────────────────────────────────────

describe('usePutLyceeGroupAssumptions', () => {
	it('sends PUT with assumptions', async () => {
		mockApiClient.mockResolvedValue({ data: [] });

		const { result } = renderHook(() => usePutLyceeGroupAssumptions(10), {
			wrapper: createWrapper(),
		});

		const assumptions = [{ disciplineCode: 'MATHS', groupCount: 3, hoursPerGroup: '2.0' }];
		result.current.mutate(assumptions);

		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(mockApiClient).toHaveBeenCalledWith('/versions/10/lycee-group-assumptions', {
			method: 'PUT',
			body: JSON.stringify({ assumptions }),
		});
	});
});

// ── useTeachingRequirements ─────────────────────────────────────────────────

describe('useTeachingRequirements', () => {
	it('fetches teaching requirements', async () => {
		const mockData = { data: [], totals: {} };
		mockApiClient.mockResolvedValue(mockData);

		const { result } = renderHook(() => useTeachingRequirements(10), {
			wrapper: createWrapper(),
		});

		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(mockApiClient).toHaveBeenCalledWith('/versions/10/teaching-requirements');
	});

	it('does not fetch when versionId is null', () => {
		renderHook(() => useTeachingRequirements(null), { wrapper: createWrapper() });
		expect(mockApiClient).not.toHaveBeenCalled();
	});
});

// ── useTeachingRequirementSources ───────────────────────────────────────────

describe('useTeachingRequirementSources', () => {
	it('fetches all requirement sources for a version', async () => {
		const mockData = { data: [] };
		mockApiClient.mockResolvedValue(mockData);

		const { result } = renderHook(() => useTeachingRequirementSources(10), {
			wrapper: createWrapper(),
		});

		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(mockApiClient).toHaveBeenCalledWith('/versions/10/teaching-requirement-sources');
	});

	it('does not fetch when versionId is null', () => {
		renderHook(() => useTeachingRequirementSources(null), { wrapper: createWrapper() });
		expect(mockApiClient).not.toHaveBeenCalled();
	});
});

// ── useStaffingAssignments ──────────────────────────────────────────────────

describe('useStaffingAssignments', () => {
	it('fetches staffing assignments', async () => {
		const mockData = { data: [] };
		mockApiClient.mockResolvedValue(mockData);

		const { result } = renderHook(() => useStaffingAssignments(10), {
			wrapper: createWrapper(),
		});

		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(mockApiClient).toHaveBeenCalledWith('/versions/10/staffing-assignments');
	});

	it('does not fetch when versionId is null', () => {
		renderHook(() => useStaffingAssignments(null), { wrapper: createWrapper() });
		expect(mockApiClient).not.toHaveBeenCalled();
	});
});

// ── useCreateAssignment ─────────────────────────────────────────────────────

describe('useCreateAssignment', () => {
	it('sends POST to create assignment', async () => {
		mockApiClient.mockResolvedValue({ id: 1 });

		const { result } = renderHook(() => useCreateAssignment(10), {
			wrapper: createWrapper(),
		});

		result.current.mutate({
			band: 'MATERNELLE',
			disciplineId: 42,
			employeeId: 99,
			fteShare: '1.0',
			hoursPerWeek: '18',
			note: null,
		});

		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(mockApiClient).toHaveBeenCalledWith('/versions/10/staffing-assignments', {
			method: 'POST',
			body: expect.any(String),
		});
	});
});

// ── useUpdateAssignment ─────────────────────────────────────────────────────

describe('useUpdateAssignment', () => {
	it('sends PUT to update assignment', async () => {
		mockApiClient.mockResolvedValue({ id: 1 });

		const { result } = renderHook(() => useUpdateAssignment(10), {
			wrapper: createWrapper(),
		});

		result.current.mutate({
			id: 1,
			data: { fteShare: '0.5' },
		});

		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(mockApiClient).toHaveBeenCalledWith('/versions/10/staffing-assignments/1', {
			method: 'PUT',
			body: JSON.stringify({ fteShare: '0.5' }),
		});
	});
});

// ── useDeleteAssignment ─────────────────────────────────────────────────────

describe('useDeleteAssignment', () => {
	it('sends DELETE to remove assignment', async () => {
		mockApiClient.mockResolvedValue(undefined);

		const { result } = renderHook(() => useDeleteAssignment(10), {
			wrapper: createWrapper(),
		});

		result.current.mutate(1);

		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(mockApiClient).toHaveBeenCalledWith('/versions/10/staffing-assignments/1', {
			method: 'DELETE',
		});
	});
});
