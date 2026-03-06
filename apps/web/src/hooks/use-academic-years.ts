import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';

export interface AcademicYear {
	id: number;
	fiscalYear: string;
	ay1Start: string;
	ay1End: string;
	ay2Start: string;
	ay2End: string;
	summerStart: string;
	summerEnd: string;
	academicWeeks: number;
	version: number;
	createdAt: string;
	updatedAt: string;
}

const QUERY_KEY = ['academic-years'];

export function useAcademicYears() {
	return useQuery({
		queryKey: QUERY_KEY,
		queryFn: () => apiClient<{ academicYears: AcademicYear[] }>('/master-data/academic-years'),
	});
}

export function useCreateAcademicYear() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (body: Omit<AcademicYear, 'id' | 'version' | 'createdAt' | 'updatedAt'>) =>
			apiClient<AcademicYear>('/master-data/academic-years', {
				method: 'POST',
				body: JSON.stringify(body),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: QUERY_KEY });
		},
	});
}

export function useUpdateAcademicYear() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			id,
			version,
			...body
		}: Partial<AcademicYear> & { id: number; version: number }) =>
			apiClient<AcademicYear>(`/master-data/academic-years/${id}`, {
				method: 'PUT',
				body: JSON.stringify({ ...body, version }),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: QUERY_KEY });
		},
	});
}

export function useDeleteAcademicYear() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: number) =>
			apiClient<void>(`/master-data/academic-years/${id}`, {
				method: 'DELETE',
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: QUERY_KEY });
		},
	});
}
