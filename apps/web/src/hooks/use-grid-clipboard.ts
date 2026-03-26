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

	return { copySelection, pasteAtCell };
}
