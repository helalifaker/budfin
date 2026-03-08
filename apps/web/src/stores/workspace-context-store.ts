import { create } from 'zustand';
import { getCurrentFiscalYear } from '../lib/format-date';

export interface VersionMeta {
	type: 'Budget' | 'Forecast' | 'Actual';
	name: string;
	status: 'Draft' | 'Published' | 'Locked' | 'Archived';
	staleModules?: string[];
}

export interface WorkspaceContextState {
	fiscalYear: number;
	versionId: number | null;
	comparisonVersionId: number | null;
	academicPeriod: string;
	scenarioId: string;
	versionType: 'Budget' | 'Forecast' | 'Actual' | null;
	versionName: string | null;
	versionStatus: 'Draft' | 'Published' | 'Locked' | 'Archived' | null;
	versionStaleModules: string[];
	setFiscalYear: (fy: number) => void;
	setVersion: (id: number | null, meta?: VersionMeta) => void;
	setComparisonVersion: (id: number | null) => void;
	setAcademicPeriod: (period: string) => void;
	setScenario: (id: string) => void;
	hydrate: (params: Partial<HydratableFields>) => void;
}

type HydratableFields = Pick<
	WorkspaceContextState,
	'fiscalYear' | 'versionId' | 'comparisonVersionId' | 'academicPeriod' | 'scenarioId'
>;

export const useWorkspaceContextStore = create<WorkspaceContextState>((set) => ({
	fiscalYear: getCurrentFiscalYear(),
	versionId: null,
	comparisonVersionId: null,
	academicPeriod: 'both',
	scenarioId: 'BASE',
	versionType: null,
	versionName: null,
	versionStatus: null,
	versionStaleModules: [],

	setFiscalYear: (fy) =>
		set({
			fiscalYear: fy,
		}),

	setVersion: (id, meta) =>
		set({
			versionId: id,
			versionType: meta?.type ?? null,
			versionName: meta?.name ?? null,
			versionStatus: meta?.status ?? null,
			versionStaleModules: meta?.staleModules ?? [],
		}),

	setComparisonVersion: (id) => set({ comparisonVersionId: id }),

	setAcademicPeriod: (period) => set({ academicPeriod: period }),

	setScenario: (id) => set({ scenarioId: id }),

	hydrate: (params) =>
		set((state) => ({
			...state,
			...params,
		})),
}));
