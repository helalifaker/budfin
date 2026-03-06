import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../lib/api-client'

export interface Assumption {
	id: number
	key: string
	value: string
	unit: string
	section: string
	label: string
	valueType: 'PERCENTAGE' | 'CURRENCY' | 'INTEGER' | 'DECIMAL' | 'TEXT'
	version: number
}

export interface AssumptionsResponse {
	assumptions: Assumption[]
	computed: {
		gosiRateTotal: string
	}
}

export function useAssumptions() {
	return useQuery({
		queryKey: ['assumptions'],
		queryFn: () => apiClient<AssumptionsResponse>('/master-data/assumptions'),
	})
}

export function useUpdateAssumptions() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (updates: Array<{ key: string; value: string; version: number }>) =>
			apiClient<AssumptionsResponse>('/master-data/assumptions', {
				method: 'PATCH',
				body: JSON.stringify({ updates }),
			}),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ['assumptions'] }),
	})
}
