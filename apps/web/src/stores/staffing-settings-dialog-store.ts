import { create } from 'zustand';

export type SettingsTab =
	| 'profiles'
	| 'costAssumptions'
	| 'curriculum'
	| 'lyceeGroups'
	| 'enrollment'
	| 'reconciliation';

interface StaffingSettingsDialogState {
	isOpen: boolean;
	activeTab: SettingsTab;
	open: (tab?: SettingsTab) => void;
	close: () => void;
	setTab: (tab: SettingsTab) => void;
}

export const useStaffingSettingsDialogStore = create<StaffingSettingsDialogState>((set) => ({
	isOpen: false,
	activeTab: 'profiles',
	open: (tab) => set({ isOpen: true, activeTab: tab ?? 'profiles' }),
	close: () => set({ isOpen: false }),
	setTab: (activeTab) => set({ activeTab }),
}));
