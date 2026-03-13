import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { renderHook, cleanup, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import type { PlanningRules } from '@budfin/types';
import { usePlanningRules, usePutPlanningRules } from './use-planning-rules';

vi.mock('../lib/api-client', () => ({
	apiClient: vi.fn(),
}));

vi.mock('../components/ui/toast-state', () => ({
	toast: {
		error: vi.fn(),
		success: vi.fn(),
	},
}));

import { apiClient } from '../lib/api-client';

const mockApiClient = apiClient as unknown as ReturnType<typeof vi.fn>;

function makeWrapper() {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: { retry: false },
			mutations: { retry: false },
		},
	});
	return {
		queryClient,
		wrapper: ({ children }: { children: ReactNode }) =>
			createElement(QueryClientProvider, { client: queryClient }, children),
	};
}

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe('usePlanningRules', () => {
	it('calls the correct URL for the given versionId', async () => {
		const planningRules: PlanningRules = {
			rolloverThreshold: 1.03,
			cappedRetention: 0.99,
			retentionRecentWeight: 0.6,
			historicalTargetRecentWeight: 0.8,
		};
		mockApiClient.mockResolvedValue(planningRules);

		const { wrapper } = makeWrapper();
		const { result } = renderHook(() => usePlanningRules(42), { wrapper });

		await waitFor(() => expect(result.current.isSuccess).toBe(true));

		expect(mockApiClient).toHaveBeenCalledWith('/versions/42/enrollment/planning-rules');
	});

	it('does not fetch when versionId is null', () => {
		const { wrapper } = makeWrapper();
		renderHook(() => usePlanningRules(null), { wrapper });

		expect(mockApiClient).not.toHaveBeenCalled();
	});
});

describe('usePutPlanningRules', () => {
	beforeEach(() => {
		mockApiClient.mockResolvedValue({
			rolloverThreshold: 1.03,
			cappedRetention: 0.99,
			retentionRecentWeight: 0.6,
			historicalTargetRecentWeight: 0.8,
			staleModules: [],
		});
	});

	it('on success invalidates planning-rules and cohort-parameters query keys', async () => {
		const { queryClient, wrapper } = makeWrapper();
		const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

		const { result } = renderHook(() => usePutPlanningRules(42), { wrapper });

		result.current.mutate({
			rolloverThreshold: 1.03,
			cappedRetention: 0.99,
			retentionRecentWeight: 0.6,
			historicalTargetRecentWeight: 0.8,
		});

		await waitFor(() => expect(result.current.isSuccess).toBe(true));

		// planning-rules invalidation
		expect(invalidateSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				queryKey: ['enrollment', 'planning-rules', 42],
			})
		);

		// cohort-parameters invalidation
		expect(invalidateSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				queryKey: ['enrollment', 'cohort-parameters', 42],
			})
		);
	});
});
