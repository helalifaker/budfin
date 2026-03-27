import { create } from 'zustand';

export interface PnlAccountingSelection {
	sectionKey: string;
	lineLabel: string;
	budgetAmount: string;
	actualAmount?: string;
	variance?: string;
	variancePct?: string;
	accountCode?: string;
}

interface PnlAccountingSelectionState {
	selection: PnlAccountingSelection | null;
	selectLine: (sel: PnlAccountingSelection) => void;
	clearSelection: () => void;
}

export const usePnlAccountingSelectionStore = create<PnlAccountingSelectionState>((set) => ({
	selection: null,
	selectLine: (selection) => set({ selection }),
	clearSelection: () => set({ selection: null }),
}));
