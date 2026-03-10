import { create } from 'zustand';
import { useRightPanelStore } from './right-panel-store';

interface EnrollmentSelectionState {
	selectedGrade: string | null;
	selectGrade: (grade: string) => void;
	clearSelection: () => void;
}

export const useEnrollmentSelectionStore = create<EnrollmentSelectionState>((set, get) => ({
	selectedGrade: null,

	selectGrade: (grade) => {
		const current = get().selectedGrade;
		if (current === grade) {
			set({ selectedGrade: null });
			useRightPanelStore.getState().close();
			return;
		}
		set({ selectedGrade: grade });
		useRightPanelStore.getState().open('details');
	},

	clearSelection: () => set({ selectedGrade: null }),
}));
