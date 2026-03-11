import type { GradeCode } from '@budfin/types';
import { create } from 'zustand';
import { useRightPanelStore } from './right-panel-store';

export interface EnrollmentSelection {
	type: 'GRADE';
	id: GradeCode;
}

interface EnrollmentSelectionState {
	selection: EnrollmentSelection | null;
	selectGrade: (grade: GradeCode) => void;
	clearSelection: () => void;
}

export const useEnrollmentSelectionStore = create<EnrollmentSelectionState>((set, get) => ({
	selection: null,

	selectGrade: (grade) => {
		const current = get().selection;
		if (current?.type === 'GRADE' && current.id === grade) {
			set({ selection: null });
			useRightPanelStore.getState().close();
			return;
		}
		set({ selection: { type: 'GRADE', id: grade } });
		useRightPanelStore.getState().open('details');
	},

	clearSelection: () => set({ selection: null }),
}));
