import { create } from 'zustand';
import { useRightPanelStore } from './right-panel-store';

export interface PnlSelection {
	sectionKey: string;
	displayLabel: string;
	depth: 1 | 2 | 3;
	isSubtotal: boolean;
	monthlyAmounts: string[];
	annualTotal: string;
	comparisonMonthlyAmounts?: string[] | undefined;
	comparisonAnnualTotal?: string | undefined;
	varianceMonthlyAmounts?: string[] | undefined;
	varianceAnnualTotal?: string | undefined;
	varianceAnnualPercent?: string | undefined;
}

interface PnlSelectionState {
	selection: PnlSelection | null;
	selectRow: (row: PnlSelection) => void;
	clearSelection: () => void;
}

export const usePnlSelectionStore = create<PnlSelectionState>((set, get) => ({
	selection: null,

	selectRow: (row) => {
		const current = get().selection;
		if (current?.sectionKey === row.sectionKey && current?.displayLabel === row.displayLabel) {
			set({ selection: null });
			useRightPanelStore.getState().close();
			return;
		}
		set({ selection: row });
		useRightPanelStore.getState().open('details');
	},

	clearSelection: () => {
		set({ selection: null });
	},
}));
