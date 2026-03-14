import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { RevenueGridRowIdentity } from '../lib/revenue-workspace';
import { useRevenueSelectionStore } from './revenue-selection-store';
import { useRightPanelStore } from './right-panel-store';

function makeDataRow(overrides: Partial<RevenueGridRowIdentity> = {}): RevenueGridRowIdentity {
	return {
		id: 'grade-PS',
		code: 'PS',
		label: 'PS',
		viewMode: 'grade',
		rowType: 'data',
		band: 'MATERNELLE',
		groupKey: 'MATERNELLE',
		settingsTarget: 'feeGrid',
		...overrides,
	};
}

describe('useRevenueSelectionStore', () => {
	beforeEach(() => {
		useRevenueSelectionStore.getState().clearSelection();
		useRightPanelStore.getState().close();
	});

	afterEach(() => {
		useRevenueSelectionStore.getState().clearSelection();
		useRightPanelStore.getState().close();
	});

	it('starts with null selection', () => {
		expect(useRevenueSelectionStore.getState().selection).toBeNull();
	});

	it('selects a data row and opens the right panel', () => {
		const row = makeDataRow();
		useRevenueSelectionStore.getState().selectRow(row);

		expect(useRevenueSelectionStore.getState().selection).toEqual(row);
		expect(useRightPanelStore.getState().isOpen).toBe(true);
		expect(useRightPanelStore.getState().activeTab).toBe('details');
	});

	it('toggles off when the same row is selected again', () => {
		const row = makeDataRow();

		useRevenueSelectionStore.getState().selectRow(row);
		expect(useRevenueSelectionStore.getState().selection).toEqual(row);
		expect(useRightPanelStore.getState().isOpen).toBe(true);

		// Select the same row again -> deselect
		useRevenueSelectionStore.getState().selectRow(row);
		expect(useRevenueSelectionStore.getState().selection).toBeNull();
		expect(useRightPanelStore.getState().isOpen).toBe(false);
	});

	it('switches selection when a different row is selected', () => {
		const rowA = makeDataRow({ id: 'grade-PS', code: 'PS', label: 'PS' });
		const rowB = makeDataRow({ id: 'grade-MS', code: 'MS', label: 'MS' });

		useRevenueSelectionStore.getState().selectRow(rowA);
		expect(useRevenueSelectionStore.getState().selection?.id).toBe('grade-PS');

		useRevenueSelectionStore.getState().selectRow(rowB);
		expect(useRevenueSelectionStore.getState().selection?.id).toBe('grade-MS');
		expect(useRightPanelStore.getState().isOpen).toBe(true);
	});

	it('ignores subtotal rows', () => {
		const subtotalRow = makeDataRow({ rowType: 'subtotal', id: 'grade-band-MATERNELLE' });

		useRevenueSelectionStore.getState().selectRow(subtotalRow);
		expect(useRevenueSelectionStore.getState().selection).toBeNull();
		expect(useRightPanelStore.getState().isOpen).toBe(false);
	});

	it('ignores total rows', () => {
		const totalRow = makeDataRow({ rowType: 'total', id: 'grade-grand-total' });

		useRevenueSelectionStore.getState().selectRow(totalRow);
		expect(useRevenueSelectionStore.getState().selection).toBeNull();
		expect(useRightPanelStore.getState().isOpen).toBe(false);
	});

	it('ignores group-header rows', () => {
		const headerRow = makeDataRow({ rowType: 'group-header', id: 'header-maternelle' });

		useRevenueSelectionStore.getState().selectRow(headerRow);
		expect(useRevenueSelectionStore.getState().selection).toBeNull();
		expect(useRightPanelStore.getState().isOpen).toBe(false);
	});

	it('clearSelection sets selection to null without closing panel', () => {
		const row = makeDataRow();
		useRevenueSelectionStore.getState().selectRow(row);
		expect(useRightPanelStore.getState().isOpen).toBe(true);

		useRevenueSelectionStore.getState().clearSelection();
		expect(useRevenueSelectionStore.getState().selection).toBeNull();
		// clearSelection does not close the panel (that is handled by the page effect)
		expect(useRightPanelStore.getState().isOpen).toBe(true);
	});
});
