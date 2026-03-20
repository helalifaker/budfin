import { create } from 'zustand';

import type { SettingsTab } from './staffing-settings-dialog-store';

interface StaffingSettingsDirtyState {
	dirtyTabs: Set<SettingsTab>;
	markDirty: (tab: SettingsTab) => void;
	markClean: (tab: SettingsTab) => void;
	clearAll: () => void;
	isDirty: (tab: SettingsTab) => boolean;
	hasAnyDirty: () => boolean;
}

export const useStaffingSettingsDirtyStore = create<StaffingSettingsDirtyState>((set, get) => ({
	dirtyTabs: new Set(),
	markDirty: (tab) =>
		set((state) => {
			const next = new Set(state.dirtyTabs);
			next.add(tab);
			return { dirtyTabs: next };
		}),
	markClean: (tab) =>
		set((state) => {
			const next = new Set(state.dirtyTabs);
			next.delete(tab);
			return { dirtyTabs: next };
		}),
	clearAll: () => set({ dirtyTabs: new Set() }),
	isDirty: (tab) => get().dirtyTabs.has(tab),
	hasAnyDirty: () => get().dirtyTabs.size > 0,
}));
