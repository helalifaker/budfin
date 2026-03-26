import { create } from 'zustand';
import type { OpExLineItem } from '@budfin/types';
import { useRightPanelStore } from './right-panel-store';

export interface OpExSelection {
	lineItem: OpExLineItem;
}

interface OpExSelectionState {
	selection: OpExSelection | null;
	selectLineItem: (lineItem: OpExLineItem) => void;
	clearSelection: () => void;
}

export const useOpExSelectionStore = create<OpExSelectionState>((set, get) => ({
	selection: null,

	selectLineItem: (lineItem) => {
		const current = get().selection;
		if (current?.lineItem.id === lineItem.id) {
			set({ selection: null });
			useRightPanelStore.getState().close();
			return;
		}
		set({ selection: { lineItem } });
		useRightPanelStore.getState().open('details');
	},

	clearSelection: () => set({ selection: null }),
}));
