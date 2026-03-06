import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';

export type GradeBand = 'MATERNELLE' | 'ELEMENTAIRE' | 'COLLEGE' | 'LYCEE';

export interface GradeLevel {
	id: number;
	gradeCode: string;
	gradeName: string;
	band: GradeBand;
	maxClassSize: number;
	plancherPct: string;
	ciblePct: string;
	plafondPct: string;
	displayOrder: number;
	version: number;
}

const QUERY_KEY = ['grade-levels'];

export function useGradeLevels() {
	return useQuery({
		queryKey: QUERY_KEY,
		queryFn: () => apiClient<{ gradeLevels: GradeLevel[] }>('/master-data/grade-levels'),
	});
}

export function useUpdateGradeLevel() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			id,
			version,
			...body
		}: Pick<GradeLevel, 'id' | 'version'> &
			Partial<
				Pick<
					GradeLevel,
					'maxClassSize' | 'plancherPct' | 'ciblePct' | 'plafondPct' | 'displayOrder'
				>
			>) =>
			apiClient<GradeLevel>(`/master-data/grade-levels/${id}`, {
				method: 'PUT',
				body: JSON.stringify({ ...body, version }),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: QUERY_KEY });
		},
	});
}
