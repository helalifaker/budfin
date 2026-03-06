import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../lib/api-client'

export interface Account {
	id: number
	accountCode: string
	accountName: string
	type: 'REVENUE' | 'EXPENSE' | 'ASSET' | 'LIABILITY'
	ifrsCategory: string
	centerType: 'PROFIT_CENTER' | 'COST_CENTER'
	description: string | null
	status: 'ACTIVE' | 'INACTIVE'
	version: number
	createdAt: string
	updatedAt: string
}

export interface AccountFilters {
	type?: string
	centerType?: string
	status?: string
	search?: string
}

export function useAccounts(filters: AccountFilters = {}) {
	const params = new URLSearchParams()
	if (filters.type) params.set('type', filters.type)
	if (filters.centerType) params.set('centerType', filters.centerType)
	if (filters.status) params.set('status', filters.status)
	if (filters.search) params.set('search', filters.search)
	const query = params.toString()

	return useQuery({
		queryKey: ['accounts', filters],
		queryFn: () => apiClient<{ accounts: Account[] }>(
			`/master-data/accounts${query ? `?${query}` : ''}`
		),
	})
}

export function useCreateAccount() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (data: Omit<Account, 'id' | 'version' | 'createdAt' | 'updatedAt'>) =>
			apiClient<Account>('/master-data/accounts', {
				method: 'POST',
				body: JSON.stringify(data),
			}),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ['accounts'] }),
	})
}

export function useUpdateAccount() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: ({ id, ...data }: Partial<Account> & { id: number; version: number }) =>
			apiClient<Account>(`/master-data/accounts/${id}`, {
				method: 'PUT',
				body: JSON.stringify(data),
			}),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ['accounts'] }),
	})
}

export function useDeleteAccount() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (id: number) =>
			apiClient<void>(`/master-data/accounts/${id}`, { method: 'DELETE' }),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ['accounts'] }),
	})
}
