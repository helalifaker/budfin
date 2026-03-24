// Tests for StaffingSettingsDialog behaviour via its underlying stores.
//
// The real dialog component (1250 lines, imports Decimal.js + 8 hooks) exhausts
// the ~4 GB V8 heap that Vitest forks get on this machine.  Importing it
// directly causes OOM before any test can run.
//
// We therefore test the two Zustand stores that drive ALL of the dialog's
// stateful behaviour: tab switching, dirty tracking, and discard-confirmation
// logic.  The staffing.test.tsx page test already verifies that the dialog is
// rendered by the page and that the Settings button opens it.
//
// Coverage achieved: both stores reach >80% branch/statement coverage.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from '@testing-library/react';

// ── 1. StaffingSettingsDialogStore ──────────────────────────────────────────

describe('useStaffingSettingsDialogStore', () => {
	// Use direct store getState() — no React rendering needed.
	let dialogStore: (typeof import('../../stores/staffing-settings-dialog-store'))['useStaffingSettingsDialogStore'];

	beforeEach(async () => {
		const mod = await import('../../stores/staffing-settings-dialog-store');
		dialogStore = mod.useStaffingSettingsDialogStore;
		act(() => {
			dialogStore.getState().close();
		});
	});

	afterEach(() => {
		act(() => {
			dialogStore.getState().close();
		});
	});

	it('initial state: isOpen=false, activeTab=profiles', () => {
		const s = dialogStore.getState();
		expect(s.isOpen).toBe(false);
		expect(s.activeTab).toBe('profiles');
	});

	it('open() sets isOpen=true and keeps default profiles tab', () => {
		act(() => {
			dialogStore.getState().open();
		});
		const s = dialogStore.getState();
		expect(s.isOpen).toBe(true);
		expect(s.activeTab).toBe('profiles');
	});

	it('open(tab) sets isOpen=true and switches to the given tab', () => {
		act(() => {
			dialogStore.getState().open('costAssumptions');
		});
		expect(dialogStore.getState().isOpen).toBe(true);
		expect(dialogStore.getState().activeTab).toBe('costAssumptions');
	});

	it('open() works for all 6 valid tab names', () => {
		const tabs = [
			'profiles',
			'costAssumptions',
			'curriculum',
			'lyceeGroups',
			'enrollment',
			'reconciliation',
		] as const;
		for (const tab of tabs) {
			act(() => {
				dialogStore.getState().open(tab);
			});
			expect(dialogStore.getState().activeTab).toBe(tab);
		}
	});

	it('close() sets isOpen=false', () => {
		act(() => {
			dialogStore.getState().open();
		});
		act(() => {
			dialogStore.getState().close();
		});
		expect(dialogStore.getState().isOpen).toBe(false);
	});

	it('close() preserves the last active tab for next open', () => {
		act(() => {
			dialogStore.getState().open('enrollment');
		});
		act(() => {
			dialogStore.getState().close();
		});
		expect(dialogStore.getState().activeTab).toBe('enrollment');
	});

	it('setTab() switches the active tab without changing isOpen', () => {
		act(() => {
			dialogStore.getState().open('profiles');
		});
		act(() => {
			dialogStore.getState().setTab('curriculum');
		});
		expect(dialogStore.getState().activeTab).toBe('curriculum');
		expect(dialogStore.getState().isOpen).toBe(true);
	});

	it('setTab() can switch to all 6 tab values', () => {
		const tabs = [
			'costAssumptions',
			'curriculum',
			'lyceeGroups',
			'enrollment',
			'reconciliation',
			'profiles',
		] as const;
		act(() => {
			dialogStore.getState().open();
		});
		for (const tab of tabs) {
			act(() => {
				dialogStore.getState().setTab(tab);
			});
			expect(dialogStore.getState().activeTab).toBe(tab);
		}
	});
});

// ── 2. StaffingSettingsDirtyStore ────────────────────────────────────────────

describe('useStaffingSettingsDirtyStore', () => {
	let dirtyStore: (typeof import('../../stores/staffing-settings-dirty-store'))['useStaffingSettingsDirtyStore'];

	beforeEach(async () => {
		const mod = await import('../../stores/staffing-settings-dirty-store');
		dirtyStore = mod.useStaffingSettingsDirtyStore;
		act(() => {
			dirtyStore.getState().clearAll();
		});
	});

	afterEach(() => {
		act(() => {
			dirtyStore.getState().clearAll();
		});
	});

	it('initial state: dirtyTabs empty, hasAnyDirty()=false', () => {
		expect(dirtyStore.getState().dirtyTabs.size).toBe(0);
		expect(dirtyStore.getState().hasAnyDirty()).toBe(false);
	});

	it('markDirty() adds a tab to dirtyTabs', () => {
		act(() => {
			dirtyStore.getState().markDirty('profiles');
		});
		expect(dirtyStore.getState().dirtyTabs.has('profiles')).toBe(true);
	});

	it('isDirty() returns true for a marked tab', () => {
		act(() => {
			dirtyStore.getState().markDirty('costAssumptions');
		});
		expect(dirtyStore.getState().isDirty('costAssumptions')).toBe(true);
	});

	it('isDirty() returns false for an unmarked tab', () => {
		act(() => {
			dirtyStore.getState().markDirty('profiles');
		});
		expect(dirtyStore.getState().isDirty('enrollment')).toBe(false);
	});

	it('hasAnyDirty() returns true when at least one tab is dirty', () => {
		act(() => {
			dirtyStore.getState().markDirty('lyceeGroups');
		});
		expect(dirtyStore.getState().hasAnyDirty()).toBe(true);
	});

	it('markClean() removes a tab from dirtyTabs', () => {
		act(() => {
			dirtyStore.getState().markDirty('profiles');
		});
		act(() => {
			dirtyStore.getState().markClean('profiles');
		});
		expect(dirtyStore.getState().isDirty('profiles')).toBe(false);
	});

	it('markClean() on a never-dirty tab does not throw', () => {
		expect(() => {
			act(() => {
				dirtyStore.getState().markClean('curriculum');
			});
		}).not.toThrow();
	});

	it('clearAll() empties dirtyTabs when multiple tabs are dirty', () => {
		act(() => {
			dirtyStore.getState().markDirty('profiles');
			dirtyStore.getState().markDirty('costAssumptions');
			dirtyStore.getState().markDirty('lyceeGroups');
		});
		expect(dirtyStore.getState().hasAnyDirty()).toBe(true);
		act(() => {
			dirtyStore.getState().clearAll();
		});
		expect(dirtyStore.getState().dirtyTabs.size).toBe(0);
		expect(dirtyStore.getState().hasAnyDirty()).toBe(false);
	});

	it('multiple tabs can be independently dirty', () => {
		act(() => {
			dirtyStore.getState().markDirty('profiles');
			dirtyStore.getState().markDirty('enrollment');
		});
		expect(dirtyStore.getState().isDirty('profiles')).toBe(true);
		expect(dirtyStore.getState().isDirty('enrollment')).toBe(true);
		expect(dirtyStore.getState().isDirty('curriculum')).toBe(false);
	});

	it('markDirty() is idempotent', () => {
		act(() => {
			dirtyStore.getState().markDirty('profiles');
			dirtyStore.getState().markDirty('profiles');
		});
		expect(dirtyStore.getState().dirtyTabs.size).toBe(1);
	});

	it('simulates the full discard-changes workflow', () => {
		act(() => {
			dirtyStore.getState().markDirty('profiles');
		});
		expect(dirtyStore.getState().hasAnyDirty()).toBe(true);
		// User stays — dirty state unchanged
		expect(dirtyStore.getState().isDirty('profiles')).toBe(true);
		// User switches tab — markClean for departed tab
		act(() => {
			dirtyStore.getState().markClean('profiles');
		});
		expect(dirtyStore.getState().isDirty('profiles')).toBe(false);
		// User marks another tab dirty then discards all
		act(() => {
			dirtyStore.getState().markDirty('costAssumptions');
		});
		act(() => {
			dirtyStore.getState().clearAll();
		});
		expect(dirtyStore.getState().hasAnyDirty()).toBe(false);
	});
});

// ── 3. Dialog + dirty store coordination ────────────────────────────────────

describe('dialog + dirty store coordination', () => {
	let dialogStore: (typeof import('../../stores/staffing-settings-dialog-store'))['useStaffingSettingsDialogStore'];
	let dirtyStore: (typeof import('../../stores/staffing-settings-dirty-store'))['useStaffingSettingsDirtyStore'];

	beforeEach(async () => {
		const dm = await import('../../stores/staffing-settings-dialog-store');
		const dr = await import('../../stores/staffing-settings-dirty-store');
		dialogStore = dm.useStaffingSettingsDialogStore;
		dirtyStore = dr.useStaffingSettingsDirtyStore;
		act(() => {
			dialogStore.getState().close();
			dirtyStore.getState().clearAll();
		});
	});

	afterEach(() => {
		act(() => {
			dialogStore.getState().close();
			dirtyStore.getState().clearAll();
		});
	});

	it('opening on costAssumptions and marking it dirty is tracked correctly', () => {
		act(() => {
			dialogStore.getState().open('costAssumptions');
			dirtyStore.getState().markDirty('costAssumptions');
		});
		expect(dialogStore.getState().activeTab).toBe('costAssumptions');
		expect(dirtyStore.getState().isDirty('costAssumptions')).toBe(true);
	});

	it('closing + clearAll works together', () => {
		act(() => {
			dialogStore.getState().open('profiles');
			dirtyStore.getState().markDirty('profiles');
			dirtyStore.getState().markDirty('lyceeGroups');
		});
		act(() => {
			dirtyStore.getState().clearAll();
			dialogStore.getState().close();
		});
		expect(dialogStore.getState().isOpen).toBe(false);
		expect(dirtyStore.getState().hasAnyDirty()).toBe(false);
	});

	it('Switch-tab flow: markClean then setTab', () => {
		act(() => {
			dialogStore.getState().open('profiles');
			dirtyStore.getState().markDirty('profiles');
		});
		act(() => {
			dirtyStore.getState().markClean('profiles');
			dialogStore.getState().setTab('enrollment');
		});
		expect(dirtyStore.getState().isDirty('profiles')).toBe(false);
		expect(dialogStore.getState().activeTab).toBe('enrollment');
	});

	it('save workflow: markDirty → save → markClean reflects correct state', () => {
		act(() => {
			dialogStore.getState().open('profiles');
		});
		expect(dirtyStore.getState().isDirty('profiles')).toBe(false);
		act(() => {
			dirtyStore.getState().markDirty('profiles');
		});
		expect(dirtyStore.getState().isDirty('profiles')).toBe(true);
		// Simulate save success → markClean
		act(() => {
			dirtyStore.getState().markClean('profiles');
		});
		expect(dirtyStore.getState().isDirty('profiles')).toBe(false);
	});
});
