import type { RevenueSettingsTab } from '@budfin/types';
import { create } from 'zustand';

interface RevenueSettingsDirtyState {
	dirtyFields: Map<RevenueSettingsTab, Set<string>>;
	markDirty: (tab: RevenueSettingsTab, fieldId: string) => void;
	clearTab: (tab: RevenueSettingsTab) => void;
	clearAll: () => void;
	isTabDirty: (tab: RevenueSettingsTab) => boolean;
	isAnyDirty: () => boolean;
	getDirtyTabs: () => RevenueSettingsTab[];
}

export const useRevenueSettingsDirtyStore = create<RevenueSettingsDirtyState>((set, get) => ({
	dirtyFields: new Map(),
	markDirty: (tab, fieldId) =>
		set((state) => {
			const next = new Map(state.dirtyFields);
			const dirtySet = new Set(next.get(tab) ?? []);
			dirtySet.add(fieldId);
			next.set(tab, dirtySet);
			return { dirtyFields: next };
		}),
	clearTab: (tab) =>
		set((state) => {
			const next = new Map(state.dirtyFields);
			next.delete(tab);
			return { dirtyFields: next };
		}),
	clearAll: () => set({ dirtyFields: new Map() }),
	isTabDirty: (tab) => (get().dirtyFields.get(tab)?.size ?? 0) > 0,
	isAnyDirty: () => [...get().dirtyFields.values()].some((fields) => fields.size > 0),
	getDirtyTabs: () =>
		[...get().dirtyFields.entries()].filter(([, fields]) => fields.size > 0).map(([tab]) => tab),
}));
