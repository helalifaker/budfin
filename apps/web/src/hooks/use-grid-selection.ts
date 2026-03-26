import { useCallback, useState } from 'react';

import type { CellCoord, GridSelection } from '../components/data-grid/grid-types';

export interface UseGridSelectionOptions {
	enabled?: boolean | undefined;
	colCount: number;
	columnIds: string[];
}

export interface UseGridSelectionReturn {
	selection: GridSelection | null;
	setAnchor: (cell: CellCoord) => void;
	extendTo: (cell: CellCoord) => void;
	clear: () => void;
	isCellInRange: (rowIndex: number, colIndex: number) => boolean;
}

function buildRange(anchor: CellCoord, focus: CellCoord, columnIds: string[]): CellCoord[] {
	const minRow = Math.min(anchor.rowIndex, focus.rowIndex);
	const maxRow = Math.max(anchor.rowIndex, focus.rowIndex);
	const minCol = Math.min(anchor.colIndex, focus.colIndex);
	const maxCol = Math.max(anchor.colIndex, focus.colIndex);

	const cells: CellCoord[] = [];
	for (let r = minRow; r <= maxRow; r++) {
		for (let c = minCol; c <= maxCol; c++) {
			cells.push({ rowIndex: r, colIndex: c, colId: columnIds[c] ?? '' });
		}
	}
	return cells;
}

export function useGridSelection({
	enabled = true,
	columnIds,
}: UseGridSelectionOptions): UseGridSelectionReturn {
	const [selection, setSelection] = useState<GridSelection | null>(null);

	const setAnchor = useCallback(
		(cell: CellCoord) => {
			if (!enabled) return;
			setSelection({
				anchor: cell,
				focus: cell,
				range: [cell],
			});
		},
		[enabled]
	);

	const extendTo = useCallback(
		(cell: CellCoord) => {
			if (!enabled) return;
			setSelection((prev) => {
				if (!prev) return prev;
				return {
					anchor: prev.anchor,
					focus: cell,
					range: buildRange(prev.anchor, cell, columnIds),
				};
			});
		},
		[enabled, columnIds]
	);

	const clear = useCallback(() => {
		setSelection(null);
	}, []);

	const isCellInRange = useCallback(
		(rowIndex: number, colIndex: number): boolean => {
			if (!selection) return false;
			const { anchor, focus } = selection;
			const minRow = Math.min(anchor.rowIndex, focus.rowIndex);
			const maxRow = Math.max(anchor.rowIndex, focus.rowIndex);
			const minCol = Math.min(anchor.colIndex, focus.colIndex);
			const maxCol = Math.max(anchor.colIndex, focus.colIndex);
			return rowIndex >= minRow && rowIndex <= maxRow && colIndex >= minCol && colIndex <= maxCol;
		},
		[selection]
	);

	return { selection, setAnchor, extendTo, clear, isCellInRange };
}
