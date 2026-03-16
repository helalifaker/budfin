import { create } from 'zustand';
import { useRightPanelStore } from './right-panel-store';
import type { RevenueGridRowIdentity } from '../lib/revenue-workspace';

interface RevenueSelectionState {
	selection: RevenueGridRowIdentity | null;
	selectRow: (row: RevenueGridRowIdentity) => void;
	clearSelection: () => void;
}

export const useRevenueSelectionStore = create<RevenueSelectionState>((set, get) => ({
	selection: null,

	selectRow: (row) => {
		// Only data rows are selectable
		if (row.rowType !== 'data') return;

		const current = get().selection;
		// Toggle: if same row selected, deselect
		if (current?.id === row.id) {
			set({ selection: null });
			useRightPanelStore.getState().close();
			return;
		}
		// Select new row, open details tab
		set({ selection: row });
		useRightPanelStore.getState().open('details');
	},

	clearSelection: () => {
		set({ selection: null });
	},
}));
