import { create } from 'zustand';
import { useRightPanelStore } from './right-panel-store';

export interface StaffingSelectionRequirementLine {
	type: 'REQUIREMENT_LINE';
	requirementLineId: number;
	band: string;
	disciplineCode: string;
}

export interface StaffingSelectionSupportEmployee {
	type: 'SUPPORT_EMPLOYEE';
	employeeId: number;
	department: string;
}

export type StaffingSelection = StaffingSelectionRequirementLine | StaffingSelectionSupportEmployee;

interface StaffingSelectionState {
	selection: StaffingSelection | null;
	selectRequirementLine: (requirementLineId: number, band: string, disciplineCode: string) => void;
	selectSupportEmployee: (employeeId: number, department: string) => void;
	clearSelection: () => void;
}

export const useStaffingSelectionStore = create<StaffingSelectionState>((set, get) => ({
	selection: null,

	selectRequirementLine: (requirementLineId, band, disciplineCode) => {
		const current = get().selection;
		if (current?.type === 'REQUIREMENT_LINE' && current.requirementLineId === requirementLineId) {
			set({ selection: null });
			useRightPanelStore.getState().close();
			return;
		}
		set({
			selection: { type: 'REQUIREMENT_LINE', requirementLineId, band, disciplineCode },
		});
		useRightPanelStore.getState().open('details');
	},

	selectSupportEmployee: (employeeId, department) => {
		const current = get().selection;
		if (current?.type === 'SUPPORT_EMPLOYEE' && current.employeeId === employeeId) {
			set({ selection: null });
			useRightPanelStore.getState().close();
			return;
		}
		set({ selection: { type: 'SUPPORT_EMPLOYEE', employeeId, department } });
		useRightPanelStore.getState().open('details');
	},

	clearSelection: () => set({ selection: null }),
}));
