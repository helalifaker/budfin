import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useStaffingSelectionStore } from './staffing-selection-store';
import { useRightPanelStore } from './right-panel-store';

describe('useStaffingSelectionStore', () => {
	beforeEach(() => {
		useStaffingSelectionStore.getState().clearSelection();
		useRightPanelStore.getState().close();
	});

	afterEach(() => {
		useStaffingSelectionStore.getState().clearSelection();
		useRightPanelStore.getState().close();
	});

	it('starts with null selection', () => {
		expect(useStaffingSelectionStore.getState().selection).toBeNull();
	});

	it('selectRequirementLine sets selection with type REQUIREMENT_LINE and opens panel', () => {
		useStaffingSelectionStore.getState().selectRequirementLine(42, 'COLLEGE', 'MATHS');

		const selection = useStaffingSelectionStore.getState().selection;
		expect(selection).toEqual({
			type: 'REQUIREMENT_LINE',
			requirementLineId: 42,
			band: 'COLLEGE',
			disciplineCode: 'MATHS',
		});
		expect(useRightPanelStore.getState().isOpen).toBe(true);
		expect(useRightPanelStore.getState().activeTab).toBe('details');
	});

	it('selectSupportEmployee sets selection with type SUPPORT_EMPLOYEE and opens panel', () => {
		useStaffingSelectionStore.getState().selectSupportEmployee(99, 'Administration');

		const selection = useStaffingSelectionStore.getState().selection;
		expect(selection).toEqual({
			type: 'SUPPORT_EMPLOYEE',
			employeeId: 99,
			department: 'Administration',
		});
		expect(useRightPanelStore.getState().isOpen).toBe(true);
		expect(useRightPanelStore.getState().activeTab).toBe('details');
	});

	it('toggling same requirement line deselects and closes panel', () => {
		useStaffingSelectionStore.getState().selectRequirementLine(42, 'COLLEGE', 'MATHS');
		expect(useStaffingSelectionStore.getState().selection).not.toBeNull();
		expect(useRightPanelStore.getState().isOpen).toBe(true);

		// Select the same requirement line again -> deselect
		useStaffingSelectionStore.getState().selectRequirementLine(42, 'COLLEGE', 'MATHS');
		expect(useStaffingSelectionStore.getState().selection).toBeNull();
		expect(useRightPanelStore.getState().isOpen).toBe(false);
	});

	it('toggling same support employee deselects and closes panel', () => {
		useStaffingSelectionStore.getState().selectSupportEmployee(99, 'Administration');
		expect(useStaffingSelectionStore.getState().selection).not.toBeNull();
		expect(useRightPanelStore.getState().isOpen).toBe(true);

		// Select the same employee again -> deselect
		useStaffingSelectionStore.getState().selectSupportEmployee(99, 'Administration');
		expect(useStaffingSelectionStore.getState().selection).toBeNull();
		expect(useRightPanelStore.getState().isOpen).toBe(false);
	});

	it('switches from requirement line to support employee', () => {
		useStaffingSelectionStore.getState().selectRequirementLine(42, 'COLLEGE', 'MATHS');
		expect(useStaffingSelectionStore.getState().selection?.type).toBe('REQUIREMENT_LINE');

		useStaffingSelectionStore.getState().selectSupportEmployee(99, 'Administration');
		const selection = useStaffingSelectionStore.getState().selection;
		expect(selection?.type).toBe('SUPPORT_EMPLOYEE');
		if (selection?.type === 'SUPPORT_EMPLOYEE') {
			expect(selection.employeeId).toBe(99);
		}
		expect(useRightPanelStore.getState().isOpen).toBe(true);
	});

	it('switches between different requirement lines', () => {
		useStaffingSelectionStore.getState().selectRequirementLine(42, 'COLLEGE', 'MATHS');
		expect(useStaffingSelectionStore.getState().selection).toEqual({
			type: 'REQUIREMENT_LINE',
			requirementLineId: 42,
			band: 'COLLEGE',
			disciplineCode: 'MATHS',
		});

		useStaffingSelectionStore.getState().selectRequirementLine(55, 'LYCEE', 'FRANCAIS');
		expect(useStaffingSelectionStore.getState().selection).toEqual({
			type: 'REQUIREMENT_LINE',
			requirementLineId: 55,
			band: 'LYCEE',
			disciplineCode: 'FRANCAIS',
		});
		expect(useRightPanelStore.getState().isOpen).toBe(true);
	});

	it('clearSelection sets selection to null without closing panel', () => {
		useStaffingSelectionStore.getState().selectRequirementLine(42, 'COLLEGE', 'MATHS');
		expect(useRightPanelStore.getState().isOpen).toBe(true);

		useStaffingSelectionStore.getState().clearSelection();
		expect(useStaffingSelectionStore.getState().selection).toBeNull();
		// clearSelection does not close the panel (that is handled by the page effect)
		expect(useRightPanelStore.getState().isOpen).toBe(true);
	});
});
