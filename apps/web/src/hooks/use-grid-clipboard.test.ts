import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

import type { GridSelection } from '../components/data-grid/grid-types';
import { useGridClipboard } from './use-grid-clipboard';

/**
 * Helper to build a GridSelection from row/col bounds.
 * The `range` array is not used by fillDown/fillRight, so we leave it empty.
 */
function makeSelection(
	anchorRow: number,
	anchorCol: number,
	focusRow: number,
	focusCol: number,
	columnIds: string[]
): GridSelection {
	return {
		anchor: { rowIndex: anchorRow, colIndex: anchorCol, colId: columnIds[anchorCol] ?? '' },
		focus: { rowIndex: focusRow, colIndex: focusCol, colId: columnIds[focusCol] ?? '' },
		range: [],
	};
}

describe('useGridClipboard', () => {
	const columnIds = ['name', 'jan', 'feb', 'mar'];

	// A simple 3x4 grid of values for testing
	const gridData: Record<string, string[]> = {
		name: ['Alice', 'Bob', 'Carol'],
		jan: ['100', '200', '300'],
		feb: ['110', '210', '310'],
		mar: ['120', '220', '320'],
	};

	function getCellValue(rowIndex: number, colId: string): string {
		return gridData[colId]?.[rowIndex] ?? '';
	}

	// ---- fillDown tests ----

	describe('fillDown', () => {
		it('copies top row value to all rows below in each column', () => {
			const onPaste = vi.fn();
			const { result } = renderHook(() =>
				useGridClipboard({
					enabled: true,
					getCellValue,
					onPaste,
					columnIds,
				})
			);

			// Select jan column, rows 0-2
			const selection = makeSelection(0, 1, 2, 1, columnIds);
			result.current.fillDown(selection);

			expect(onPaste).toHaveBeenCalledOnce();
			expect(onPaste).toHaveBeenCalledWith(0, 1, [
				['100'], // row 0 (source)
				['100'], // row 1 (filled)
				['100'], // row 2 (filled)
			]);
		});

		it('fills down across multiple columns', () => {
			const onPaste = vi.fn();
			const { result } = renderHook(() =>
				useGridClipboard({
					enabled: true,
					getCellValue,
					onPaste,
					columnIds,
				})
			);

			// Select jan+feb columns, rows 0-2
			const selection = makeSelection(0, 1, 2, 2, columnIds);
			result.current.fillDown(selection);

			expect(onPaste).toHaveBeenCalledOnce();
			expect(onPaste).toHaveBeenCalledWith(0, 1, [
				['100', '110'], // row 0 values (source)
				['100', '110'], // row 1 filled with row 0
				['100', '110'], // row 2 filled with row 0
			]);
		});

		it('works when anchor is below focus (reversed selection)', () => {
			const onPaste = vi.fn();
			const { result } = renderHook(() =>
				useGridClipboard({
					enabled: true,
					getCellValue,
					onPaste,
					columnIds,
				})
			);

			// Anchor at row 2, focus at row 0 -- should still use row 0 as source
			const selection = makeSelection(2, 1, 0, 1, columnIds);
			result.current.fillDown(selection);

			expect(onPaste).toHaveBeenCalledOnce();
			expect(onPaste).toHaveBeenCalledWith(0, 1, [['100'], ['100'], ['100']]);
		});

		it('is a no-op when selection has fewer than 2 cells (single cell)', () => {
			const onPaste = vi.fn();
			const { result } = renderHook(() =>
				useGridClipboard({
					enabled: true,
					getCellValue,
					onPaste,
					columnIds,
				})
			);

			// Single cell selection
			const selection = makeSelection(0, 1, 0, 1, columnIds);
			result.current.fillDown(selection);

			expect(onPaste).not.toHaveBeenCalled();
		});

		it('is a no-op when only one row is selected (even multiple columns)', () => {
			const onPaste = vi.fn();
			const { result } = renderHook(() =>
				useGridClipboard({
					enabled: true,
					getCellValue,
					onPaste,
					columnIds,
				})
			);

			// Single row, 3 columns -- has 3 cells but only 1 row
			const selection = makeSelection(0, 1, 0, 3, columnIds);
			result.current.fillDown(selection);

			expect(onPaste).not.toHaveBeenCalled();
		});

		it('respects editableColumns -- non-editable columns keep their existing values', () => {
			const onPaste = vi.fn();
			const { result } = renderHook(() =>
				useGridClipboard({
					enabled: true,
					getCellValue,
					onPaste,
					columnIds,
					editableColumns: ['jan', 'mar'], // feb is NOT editable
				})
			);

			// Select jan+feb+mar columns, rows 0-2
			const selection = makeSelection(0, 1, 2, 3, columnIds);
			result.current.fillDown(selection);

			expect(onPaste).toHaveBeenCalledOnce();
			expect(onPaste).toHaveBeenCalledWith(0, 1, [
				['100', '110', '120'], // row 0: source row for editable, existing for feb
				['100', '210', '120'], // row 1: jan+mar filled, feb keeps own value
				['100', '310', '120'], // row 2: jan+mar filled, feb keeps own value
			]);
		});

		it('is a no-op when enabled is false', () => {
			const onPaste = vi.fn();
			const { result } = renderHook(() =>
				useGridClipboard({
					enabled: false,
					getCellValue,
					onPaste,
					columnIds,
				})
			);

			const selection = makeSelection(0, 1, 2, 1, columnIds);
			result.current.fillDown(selection);

			expect(onPaste).not.toHaveBeenCalled();
		});
	});

	// ---- fillRight tests ----

	describe('fillRight', () => {
		it('copies leftmost column value to all columns right for each row', () => {
			const onPaste = vi.fn();
			const { result } = renderHook(() =>
				useGridClipboard({
					enabled: true,
					getCellValue,
					onPaste,
					columnIds,
				})
			);

			// Select jan+feb+mar for row 0
			const selection = makeSelection(0, 1, 0, 3, columnIds);
			result.current.fillRight(selection);

			expect(onPaste).toHaveBeenCalledOnce();
			expect(onPaste).toHaveBeenCalledWith(0, 1, [
				['100', '100', '100'], // jan value fills feb and mar
			]);
		});

		it('fills right across multiple rows', () => {
			const onPaste = vi.fn();
			const { result } = renderHook(() =>
				useGridClipboard({
					enabled: true,
					getCellValue,
					onPaste,
					columnIds,
				})
			);

			// Select jan+feb columns, rows 0-1
			const selection = makeSelection(0, 1, 1, 2, columnIds);
			result.current.fillRight(selection);

			expect(onPaste).toHaveBeenCalledOnce();
			expect(onPaste).toHaveBeenCalledWith(0, 1, [
				['100', '100'], // row 0: jan fills feb
				['200', '200'], // row 1: jan fills feb
			]);
		});

		it('works when anchor is to the right of focus (reversed selection)', () => {
			const onPaste = vi.fn();
			const { result } = renderHook(() =>
				useGridClipboard({
					enabled: true,
					getCellValue,
					onPaste,
					columnIds,
				})
			);

			// Anchor at col 3, focus at col 1 -- should still use col 1 as source
			const selection = makeSelection(0, 3, 0, 1, columnIds);
			result.current.fillRight(selection);

			expect(onPaste).toHaveBeenCalledOnce();
			expect(onPaste).toHaveBeenCalledWith(0, 1, [['100', '100', '100']]);
		});

		it('is a no-op when selection has fewer than 2 cells (single cell)', () => {
			const onPaste = vi.fn();
			const { result } = renderHook(() =>
				useGridClipboard({
					enabled: true,
					getCellValue,
					onPaste,
					columnIds,
				})
			);

			const selection = makeSelection(0, 1, 0, 1, columnIds);
			result.current.fillRight(selection);

			expect(onPaste).not.toHaveBeenCalled();
		});

		it('is a no-op when only one column is selected (even multiple rows)', () => {
			const onPaste = vi.fn();
			const { result } = renderHook(() =>
				useGridClipboard({
					enabled: true,
					getCellValue,
					onPaste,
					columnIds,
				})
			);

			// 3 rows, single column -- has 3 cells but only 1 column
			const selection = makeSelection(0, 1, 2, 1, columnIds);
			result.current.fillRight(selection);

			expect(onPaste).not.toHaveBeenCalled();
		});

		it('respects editableColumns -- non-editable columns keep their existing values', () => {
			const onPaste = vi.fn();
			const { result } = renderHook(() =>
				useGridClipboard({
					enabled: true,
					getCellValue,
					onPaste,
					columnIds,
					editableColumns: ['jan', 'mar'], // feb is NOT editable
				})
			);

			// Select jan+feb+mar for row 0
			const selection = makeSelection(0, 1, 0, 3, columnIds);
			result.current.fillRight(selection);

			expect(onPaste).toHaveBeenCalledOnce();
			expect(onPaste).toHaveBeenCalledWith(0, 1, [
				['100', '110', '100'], // jan fills mar, feb keeps its own value
			]);
		});

		it('is a no-op when enabled is false', () => {
			const onPaste = vi.fn();
			const { result } = renderHook(() =>
				useGridClipboard({
					enabled: false,
					getCellValue,
					onPaste,
					columnIds,
				})
			);

			const selection = makeSelection(0, 1, 0, 3, columnIds);
			result.current.fillRight(selection);

			expect(onPaste).not.toHaveBeenCalled();
		});
	});

	// ---- Shared editableColumns edge cases ----

	describe('editableColumns edge cases', () => {
		it('fillDown treats all columns as editable when editableColumns is undefined', () => {
			const onPaste = vi.fn();
			const { result } = renderHook(() =>
				useGridClipboard({
					enabled: true,
					getCellValue,
					onPaste,
					columnIds,
					// no editableColumns -- all columns are editable
				})
			);

			const selection = makeSelection(0, 1, 1, 2, columnIds);
			result.current.fillDown(selection);

			expect(onPaste).toHaveBeenCalledWith(0, 1, [
				['100', '110'], // row 0 source values
				['100', '110'], // row 1 filled from row 0
			]);
		});

		it('fillRight treats all columns as editable when editableColumns is undefined', () => {
			const onPaste = vi.fn();
			const { result } = renderHook(() =>
				useGridClipboard({
					enabled: true,
					getCellValue,
					onPaste,
					columnIds,
				})
			);

			const selection = makeSelection(0, 1, 0, 2, columnIds);
			result.current.fillRight(selection);

			expect(onPaste).toHaveBeenCalledWith(0, 1, [
				['100', '100'], // jan value fills feb
			]);
		});

		it('fillDown treats all columns as editable when editableColumns is empty array', () => {
			const onPaste = vi.fn();
			const { result } = renderHook(() =>
				useGridClipboard({
					enabled: true,
					getCellValue,
					onPaste,
					columnIds,
					editableColumns: [], // empty = all editable
				})
			);

			const selection = makeSelection(0, 1, 1, 2, columnIds);
			result.current.fillDown(selection);

			expect(onPaste).toHaveBeenCalledWith(0, 1, [
				['100', '110'],
				['100', '110'],
			]);
		});

		it('fillRight treats all columns as editable when editableColumns is empty array', () => {
			const onPaste = vi.fn();
			const { result } = renderHook(() =>
				useGridClipboard({
					enabled: true,
					getCellValue,
					onPaste,
					columnIds,
					editableColumns: [],
				})
			);

			const selection = makeSelection(0, 1, 0, 2, columnIds);
			result.current.fillRight(selection);

			expect(onPaste).toHaveBeenCalledWith(0, 1, [['100', '100']]);
		});

		it('fillDown is a no-op without getCellValue', () => {
			const onPaste = vi.fn();
			const { result } = renderHook(() =>
				useGridClipboard({
					enabled: true,
					onPaste,
					columnIds,
				})
			);

			const selection = makeSelection(0, 1, 2, 1, columnIds);
			result.current.fillDown(selection);

			expect(onPaste).not.toHaveBeenCalled();
		});

		it('fillRight is a no-op without onPaste', () => {
			const { result } = renderHook(() =>
				useGridClipboard({
					enabled: true,
					getCellValue,
					columnIds,
				})
			);

			const selection = makeSelection(0, 1, 0, 3, columnIds);
			// Should not throw
			result.current.fillRight(selection);
		});
	});
});
