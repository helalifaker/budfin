import type { RevenueSettingsTab } from '@budfin/types';
import { create } from 'zustand';

interface RevenueSettingsDialogState {
	isOpen: boolean;
	activeTab: RevenueSettingsTab;
	open: (tab?: RevenueSettingsTab) => void;
	close: () => void;
	setTab: (tab: RevenueSettingsTab) => void;
}

export const useRevenueSettingsDialogStore = create<RevenueSettingsDialogState>((set) => ({
	isOpen: false,
	activeTab: 'feeGrid',
	open: (tab) =>
		set({
			isOpen: true,
			activeTab: tab ?? 'feeGrid',
		}),
	close: () => set({ isOpen: false }),
	setTab: (tab) => set({ activeTab: tab }),
}));
