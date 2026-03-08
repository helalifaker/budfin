import { create } from 'zustand';

export type PanelMode = 'closed' | 'detail' | 'create';

interface VersionPageState {
	fiscalYear: number | null;
	typeFilter: string;
	statusFilter: string;
	searchQuery: string;
	selectedVersionId: number | null;
	compareVersionIds: number[];
	isCompareMode: boolean;
	panelMode: PanelMode;

	setFiscalYear: (fy: number | null) => void;
	setTypeFilter: (type: string) => void;
	setStatusFilter: (status: string) => void;
	setSearchQuery: (query: string) => void;
	setSelectedVersionId: (id: number | null) => void;
	toggleCompareMode: () => void;
	addCompareVersion: (id: number) => void;
	removeCompareVersion: (id: number) => void;
	clearCompareVersions: () => void;
	setPanelMode: (mode: PanelMode) => void;
}

const MAX_COMPARE = 3;

export const useVersionPageStore = create<VersionPageState>((set) => ({
	fiscalYear: null,
	typeFilter: '',
	statusFilter: '',
	searchQuery: '',
	selectedVersionId: null,
	compareVersionIds: [],
	isCompareMode: false,
	panelMode: 'closed',

	setFiscalYear: (fy) => set({ fiscalYear: fy }),
	setTypeFilter: (type) => set({ typeFilter: type }),
	setStatusFilter: (status) => set({ statusFilter: status }),
	setSearchQuery: (query) => set({ searchQuery: query }),
	setSelectedVersionId: (id) => set({ selectedVersionId: id }),

	toggleCompareMode: () =>
		set((state) => ({
			isCompareMode: !state.isCompareMode,
			compareVersionIds: state.isCompareMode ? [] : state.compareVersionIds,
		})),

	addCompareVersion: (id) =>
		set((state) => {
			if (state.compareVersionIds.length >= MAX_COMPARE) return state;
			if (state.compareVersionIds.includes(id)) return state;
			return { compareVersionIds: [...state.compareVersionIds, id] };
		}),

	removeCompareVersion: (id) =>
		set((state) => ({
			compareVersionIds: state.compareVersionIds.filter((v) => v !== id),
		})),

	clearCompareVersions: () => set({ compareVersionIds: [], isCompareMode: false }),

	setPanelMode: (mode) => set({ panelMode: mode }),
}));
