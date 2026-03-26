import { useCallback } from 'react';

import type { CellCoord, GridSelection } from '../components/data-grid/grid-types';

export interface UseGridClipboardOptions {
	enabled?: boolean | undefined;
	getCellValue?: ((rowIndex: number, colId: string) => string) | undefined;
	onPaste?: ((startRow: number, startCol: number, data: string[][]) => void) | undefined;
	columnIds: string[];
	editableColumns?: string[] | undefined;
}

export interface UseGridClipboardReturn {
	copySelection: (selection: GridSelection) => Promise<void>;
	pasteAtCell: (cell: CellCoord) => Promise<void>;
	fillDown: (selection: GridSelection) => void;
	fillRight: (selection: GridSelection) => void;
}

function isClipboardAvailable(): boolean {
	return typeof navigator !== 'undefined' && typeof navigator.clipboard !== 'undefined';
}

export function useGridClipboard({
	enabled = true,
	getCellValue,
	onPaste,
	columnIds,
	editableColumns,
}: UseGridClipboardOptions): UseGridClipboardReturn {
	const copySelection = useCallback(
		async (selection: GridSelection): Promise<void> => {
			if (!enabled || !getCellValue || !isClipboardAvailable()) return;

			const { anchor, focus } = selection;
			const minRow = Math.min(anchor.rowIndex, focus.rowIndex);
			const maxRow = Math.max(anchor.rowIndex, focus.rowIndex);
			const minCol = Math.min(anchor.colIndex, focus.colIndex);
			const maxCol = Math.max(anchor.colIndex, focus.colIndex);

			const lines: string[] = [];
			for (let r = minRow; r <= maxRow; r++) {
				const cells: string[] = [];
				for (let c = minCol; c <= maxCol; c++) {
					const colId = columnIds[c] ?? '';
					cells.push(getCellValue(r, colId));
				}
				lines.push(cells.join('\t'));
			}

			const tsv = lines.join('\n');

			try {
				await navigator.clipboard.writeText(tsv);
			} catch {
				// Clipboard write failed (e.g., permission denied) — silently ignore
			}
		},
		[enabled, getCellValue, columnIds]
	);

	const pasteAtCell = useCallback(
		async (cell: CellCoord): Promise<void> => {
			if (!enabled || !onPaste || !isClipboardAvailable()) return;

			// Only allow paste when the start column is editable
			if (editableColumns?.length && !editableColumns.includes(cell.colId)) return;

			let text: string;
			try {
				text = await navigator.clipboard.readText();
			} catch {
				// Clipboard read failed (e.g., permission denied) — silently ignore
				return;
			}

			if (!text) return;

			const data = text.split('\n').map((line) => line.split('\t'));
			onPaste(cell.rowIndex, cell.colIndex, data);
		},
		[enabled, onPaste, editableColumns]
	);

	const fillDown = useCallback(
		(selection: GridSelection): void => {
			if (!enabled || !getCellValue || !onPaste) return;

			const { anchor, focus } = selection;
			const minRow = Math.min(anchor.rowIndex, focus.rowIndex);
			const maxRow = Math.max(anchor.rowIndex, focus.rowIndex);
			const minCol = Math.min(anchor.colIndex, focus.colIndex);
			const maxCol = Math.max(anchor.colIndex, focus.colIndex);

			// No-op if selection has fewer than 2 cells
			const rowSpan = maxRow - minRow + 1;
			const colSpan = maxCol - minCol + 1;
			if (rowSpan * colSpan < 2) return;

			// Need at least 2 rows for fill-down to have any effect
			if (rowSpan < 2) return;

			// Build data matrix: each row gets the topmost row's value per column,
			// but only for editable columns. Non-editable columns get their existing value
			// (effectively a no-op for those columns).
			const data: string[][] = [];
			for (let r = minRow; r <= maxRow; r++) {
				const row: string[] = [];
				for (let c = minCol; c <= maxCol; c++) {
					const colId = columnIds[c] ?? '';
					if (editableColumns?.length && !editableColumns.includes(colId)) {
						// Not editable: preserve existing value
						row.push(getCellValue(r, colId));
					} else {
						// Editable: use topmost row value
						row.push(getCellValue(minRow, colId));
					}
				}
				data.push(row);
			}

			onPaste(minRow, minCol, data);
		},
		[enabled, getCellValue, onPaste, columnIds, editableColumns]
	);

	const fillRight = useCallback(
		(selection: GridSelection): void => {
			if (!enabled || !getCellValue || !onPaste) return;

			const { anchor, focus } = selection;
			const minRow = Math.min(anchor.rowIndex, focus.rowIndex);
			const maxRow = Math.max(anchor.rowIndex, focus.rowIndex);
			const minCol = Math.min(anchor.colIndex, focus.colIndex);
			const maxCol = Math.max(anchor.colIndex, focus.colIndex);

			// No-op if selection has fewer than 2 cells
			const rowSpan = maxRow - minRow + 1;
			const colSpan = maxCol - minCol + 1;
			if (rowSpan * colSpan < 2) return;

			// Need at least 2 columns for fill-right to have any effect
			if (colSpan < 2) return;

			// Build data matrix: each column gets the leftmost column's value per row,
			// but only for editable columns. Non-editable columns get their existing value.
			const data: string[][] = [];
			for (let r = minRow; r <= maxRow; r++) {
				const row: string[] = [];
				const leftColId = columnIds[minCol] ?? '';
				const sourceValue = getCellValue(r, leftColId);
				for (let c = minCol; c <= maxCol; c++) {
					const colId = columnIds[c] ?? '';
					if (editableColumns?.length && !editableColumns.includes(colId)) {
						// Not editable: preserve existing value
						row.push(getCellValue(r, colId));
					} else {
						// Editable: use leftmost column value
						row.push(sourceValue);
					}
				}
				data.push(row);
			}

			onPaste(minRow, minCol, data);
		},
		[enabled, getCellValue, onPaste, columnIds, editableColumns]
	);

	return { copySelection, pasteAtCell, fillDown, fillRight };
}
