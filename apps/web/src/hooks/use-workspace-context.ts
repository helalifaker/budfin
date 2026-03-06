import { useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

export interface WorkspaceContext {
	fiscalYear: number;
	versionId: number | null;
	comparisonVersionId: number | null;
	academicPeriod: string | null;
	scenarioId: number | null;
}

export function useWorkspaceContext() {
	const [searchParams, setSearchParams] = useSearchParams();
	const queryClient = useQueryClient();

	const fiscalYear = Number(searchParams.get('fy')) || new Date().getFullYear();
	const versionId = searchParams.get('version') ? Number(searchParams.get('version')) : null;
	const comparisonVersionId = searchParams.get('compare')
		? Number(searchParams.get('compare'))
		: null;
	const academicPeriod = searchParams.get('period');
	const scenarioId = searchParams.get('scenario')
		? Number(searchParams.get('scenario'))
		: null;

	const setVersion = useCallback(
		(id: number | null) => {
			setSearchParams((prev) => {
				const next = new URLSearchParams(prev);
				if (id !== null) {
					next.set('version', String(id));
				} else {
					next.delete('version');
				}
				return next;
			});
			// Invalidate all version-scoped queries on version change
			void queryClient.invalidateQueries({ queryKey: ['version'] });
		},
		[setSearchParams, queryClient],
	);

	const setFiscalYear = useCallback(
		(fy: number) => {
			setSearchParams((prev) => {
				const next = new URLSearchParams(prev);
				next.set('fy', String(fy));
				return next;
			});
		},
		[setSearchParams],
	);

	const setComparisonVersion = useCallback(
		(id: number | null) => {
			setSearchParams((prev) => {
				const next = new URLSearchParams(prev);
				if (id !== null) {
					next.set('compare', String(id));
				} else {
					next.delete('compare');
				}
				return next;
			});
		},
		[setSearchParams],
	);

	const setAcademicPeriod = useCallback(
		(period: string | null) => {
			setSearchParams((prev) => {
				const next = new URLSearchParams(prev);
				if (period !== null) {
					next.set('period', period);
				} else {
					next.delete('period');
				}
				return next;
			});
		},
		[setSearchParams],
	);

	const setScenario = useCallback(
		(id: number | null) => {
			setSearchParams((prev) => {
				const next = new URLSearchParams(prev);
				if (id !== null) {
					next.set('scenario', String(id));
				} else {
					next.delete('scenario');
				}
				return next;
			});
		},
		[setSearchParams],
	);

	return {
		fiscalYear,
		versionId,
		comparisonVersionId,
		academicPeriod,
		scenarioId,
		setVersion,
		setFiscalYear,
		setComparisonVersion,
		setAcademicPeriod,
		setScenario,
	};
}
