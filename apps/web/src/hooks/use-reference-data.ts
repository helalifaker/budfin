import {
	useQuery,
	useMutation,
	useQueryClient,
} from '@tanstack/react-query'
import { apiClient } from '../lib/api-client'

// --- Nationalities ---

export interface Nationality {
	id: number
	code: string
	label: string
	vatExempt: boolean
	version: number
}

export function useNationalities() {
	return useQuery({
		queryKey: ['nationalities'],
		queryFn: () =>
			apiClient<{ nationalities: Nationality[] }>(
				'/master-data/nationalities',
			),
		select: (data) => data.nationalities,
	})
}

export function useCreateNationality() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (body: { code: string; label: string; vatExempt?: boolean }) =>
			apiClient<Nationality>('/master-data/nationalities', {
				method: 'POST',
				body: JSON.stringify(body),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['nationalities'] })
		},
	})
}

export function useUpdateNationality() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: ({
			id,
			...body
		}: {
			id: number
			code: string
			label: string
			vatExempt: boolean
			version: number
		}) =>
			apiClient<Nationality>(`/master-data/nationalities/${id}`, {
				method: 'PUT',
				body: JSON.stringify(body),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['nationalities'] })
		},
	})
}

export function useDeleteNationality() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (id: number) =>
			apiClient<void>(`/master-data/nationalities/${id}`, {
				method: 'DELETE',
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['nationalities'] })
		},
	})
}

// --- Tariffs ---

export interface Tariff {
	id: number
	code: string
	label: string
	description: string | null
	version: number
}

export function useTariffs() {
	return useQuery({
		queryKey: ['tariffs'],
		queryFn: () =>
			apiClient<{ tariffs: Tariff[] }>('/master-data/tariffs'),
		select: (data) => data.tariffs,
	})
}

export function useCreateTariff() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (body: {
			code: string
			label: string
			description?: string | undefined
		}) =>
			apiClient<Tariff>('/master-data/tariffs', {
				method: 'POST',
				body: JSON.stringify(body),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['tariffs'] })
		},
	})
}

export function useUpdateTariff() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: ({
			id,
			...body
		}: {
			id: number
			code: string
			label: string
			description?: string | undefined
			version: number
		}) =>
			apiClient<Tariff>(`/master-data/tariffs/${id}`, {
				method: 'PUT',
				body: JSON.stringify(body),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['tariffs'] })
		},
	})
}

export function useDeleteTariff() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (id: number) =>
			apiClient<void>(`/master-data/tariffs/${id}`, {
				method: 'DELETE',
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['tariffs'] })
		},
	})
}

// --- Departments ---

export type BandMapping =
	| 'MATERNELLE'
	| 'ELEMENTAIRE'
	| 'COLLEGE'
	| 'LYCEE'
	| 'NON_ACADEMIC'

export interface Department {
	id: number
	code: string
	label: string
	bandMapping: BandMapping
	version: number
}

export function useDepartments() {
	return useQuery({
		queryKey: ['departments'],
		queryFn: () =>
			apiClient<{ departments: Department[] }>(
				'/master-data/departments',
			),
		select: (data) => data.departments,
	})
}

export function useCreateDepartment() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (body: {
			code: string
			label: string
			bandMapping: BandMapping
		}) =>
			apiClient<Department>('/master-data/departments', {
				method: 'POST',
				body: JSON.stringify(body),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['departments'] })
		},
	})
}

export function useUpdateDepartment() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: ({
			id,
			...body
		}: {
			id: number
			code: string
			label: string
			bandMapping: BandMapping
			version: number
		}) =>
			apiClient<Department>(`/master-data/departments/${id}`, {
				method: 'PUT',
				body: JSON.stringify(body),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['departments'] })
		},
	})
}

export function useDeleteDepartment() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (id: number) =>
			apiClient<void>(`/master-data/departments/${id}`, {
				method: 'DELETE',
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['departments'] })
		},
	})
}
