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

export interface StaffingSelectionEmployee {
	type: 'EMPLOYEE';
	employeeId: number;
	department: string;
}

export interface StaffingSelectionDisciplineSummary {
	type: 'DISCIPLINE_SUMMARY';
	disciplineCode: string;
	scope: string;
	contributingLineIds: number[];
}

export type StaffingSelection =
	| StaffingSelectionRequirementLine
	| StaffingSelectionSupportEmployee
	| StaffingSelectionEmployee
	| StaffingSelectionDisciplineSummary;

interface StaffingSelectionState {
	selection: StaffingSelection | null;
	selectRequirementLine: (requirementLineId: number, band: string, disciplineCode: string) => void;
	selectSupportEmployee: (employeeId: number, department: string) => void;
	selectEmployee: (employeeId: number, department: string) => void;
	selectDisciplineSummary: (
		disciplineCode: string,
		scope: string,
		contributingLineIds: number[]
	) => void;
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

	selectEmployee: (employeeId, department) => {
		const current = get().selection;
		if (current?.type === 'EMPLOYEE' && current.employeeId === employeeId) {
			set({ selection: null });
			useRightPanelStore.getState().close();
			return;
		}
		set({ selection: { type: 'EMPLOYEE', employeeId, department } });
		useRightPanelStore.getState().open('details');
	},

	selectDisciplineSummary: (disciplineCode, scope, contributingLineIds) => {
		const current = get().selection;
		if (
			current?.type === 'DISCIPLINE_SUMMARY' &&
			current.disciplineCode === disciplineCode &&
			current.scope === scope
		) {
			set({ selection: null });
			useRightPanelStore.getState().close();
			return;
		}
		set({
			selection: { type: 'DISCIPLINE_SUMMARY', disciplineCode, scope, contributingLineIds },
		});
		useRightPanelStore.getState().open('details');
	},

	clearSelection: () => set({ selection: null }),
}));
