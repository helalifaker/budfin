import { create } from 'zustand';
import type { RevenueViewMode } from '@budfin/types';

export interface RevenueSelection {
	label: string;
	viewMode: RevenueViewMode;
}

interface RevenueSelectionState {
	selection: RevenueSelection | null;
	selectRow: (selection: RevenueSelection) => void;
	clearSelection: () => void;
}

export const useRevenueSelectionStore = create<RevenueSelectionState>((set) => ({
	selection: null,
	selectRow: (selection) => set({ selection }),
	clearSelection: () => set({ selection: null }),
}));
