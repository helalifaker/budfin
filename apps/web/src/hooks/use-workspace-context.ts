import { useQueryClient } from '@tanstack/react-query';
import { useWorkspaceContextStore, type VersionMeta } from '../stores/workspace-context-store';

export interface WorkspaceContext {
	fiscalYear: number;
	versionId: number | null;
	comparisonVersionId: number | null;
	academicPeriod: string | null;
	scenarioId: string | null;
}

export function useWorkspaceContext() {
	const store = useWorkspaceContextStore();
	const queryClient = useQueryClient();

	function setVersion(id: number | null, meta?: VersionMeta) {
		store.setVersion(id, meta);
		void queryClient.invalidateQueries({ queryKey: ['versions'] });
	}

	return {
		fiscalYear: store.fiscalYear,
		versionId: store.versionId,
		comparisonVersionId: store.comparisonVersionId,
		academicPeriod: store.academicPeriod,
		scenarioId: store.scenarioId,
		versionType: store.versionType,
		versionName: store.versionName,
		versionStatus: store.versionStatus,
		versionStaleModules: store.versionStaleModules,
		setFiscalYear: store.setFiscalYear,
		setVersion,
		setComparisonVersion: store.setComparisonVersion,
		setAcademicPeriod: store.setAcademicPeriod,
		setScenario: store.setScenario,
	};
}
