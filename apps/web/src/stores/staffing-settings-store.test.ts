import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useStaffingSettingsSheetStore } from './staffing-settings-store';

describe('useStaffingSettingsSheetStore', () => {
	beforeEach(() => {
		useStaffingSettingsSheetStore.getState().close();
	});

	afterEach(() => {
		useStaffingSettingsSheetStore.getState().close();
	});

	it('starts with isOpen = false', () => {
		expect(useStaffingSettingsSheetStore.getState().isOpen).toBe(false);
	});

	it('open() sets isOpen to true', () => {
		useStaffingSettingsSheetStore.getState().open();
		expect(useStaffingSettingsSheetStore.getState().isOpen).toBe(true);
	});

	it('close() sets isOpen to false', () => {
		useStaffingSettingsSheetStore.getState().open();
		expect(useStaffingSettingsSheetStore.getState().isOpen).toBe(true);

		useStaffingSettingsSheetStore.getState().close();
		expect(useStaffingSettingsSheetStore.getState().isOpen).toBe(false);
	});

	it('setOpen(true) sets isOpen to true', () => {
		useStaffingSettingsSheetStore.getState().setOpen(true);
		expect(useStaffingSettingsSheetStore.getState().isOpen).toBe(true);
	});

	it('setOpen(false) sets isOpen to false', () => {
		useStaffingSettingsSheetStore.getState().setOpen(true);
		useStaffingSettingsSheetStore.getState().setOpen(false);
		expect(useStaffingSettingsSheetStore.getState().isOpen).toBe(false);
	});
});
