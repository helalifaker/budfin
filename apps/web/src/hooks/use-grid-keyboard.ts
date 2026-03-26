import { useCallback, useEffect, useRef, useState } from 'react';

import type { CellCoord, GridMode, GridSelection } from '../components/data-grid/grid-types';
import { useGridClipboard } from './use-grid-clipboard';
import { useGridSelection } from './use-grid-selection';

export interface GridKeyboardOptions {
	tableRef: React.RefObject<HTMLTableElement | null>;
	rowCount: number;
	colCount: number;
	enabled?: boolean | undefined;

	// Column metadata
	editableColumns?: string[] | undefined;
	columnIds: string[];

	// Edit mode callbacks
	onStartEdit?: ((rowIndex: number, colId: string) => void) | undefined;
	onCommitEdit?: ((rowIndex: number, colId: string) => void) | undefined;
	onCancelEdit?: (() => void) | undefined;

	// Range selection
	rangeSelection?: boolean | undefined;
	onSelectionChange?: ((selection: GridSelection | null) => void) | undefined;

	// Clipboard
	clipboardEnabled?: boolean | undefined;
	getCellValue?: ((rowIndex: number, colId: string) => string) | undefined;
	onPaste?: ((startRow: number, startCol: number, data: string[][]) => void) | undefined;

	// Row callbacks
	onRowSelect?: ((rowIndex: number) => void) | undefined;
	onActiveRowChange?: ((rowIndex: number) => void) | undefined;
}

export interface UseGridKeyboardReturn {
	activeCell: CellCoord | null;
	selection: GridSelection | null;
	mode: GridMode;
	setActiveCell: (cell: CellCoord | null) => void;
	handlers: {
		onKeyDown: (e: React.KeyboardEvent) => void;
		onCellClick: (rowIndex: number, colIndex: number, e?: React.MouseEvent) => void;
		onCellDoubleClick: (rowIndex: number, colIndex: number) => void;
	};
	isCellActive: (rowIndex: number, colIndex: number) => boolean;
	isCellInRange: (rowIndex: number, colIndex: number) => boolean;
	exitEditMode: () => void;
}

const PAGE_SIZE = 10;

function isMod(e: React.KeyboardEvent): boolean {
	return e.metaKey || e.ctrlKey;
}

export function useGridKeyboard({
	tableRef,
	rowCount,
	colCount,
	enabled = true,
	editableColumns,
	columnIds,
	onStartEdit,
	onCommitEdit,
	onCancelEdit,
	rangeSelection = false,
	onSelectionChange,
	clipboardEnabled = false,
	getCellValue,
	onPaste,
	onRowSelect,
	onActiveRowChange,
}: GridKeyboardOptions): UseGridKeyboardReturn {
	const [activeCell, setActiveCellState] = useState<CellCoord | null>(null);
	const [mode, setMode] = useState<GridMode>('navigation');

	// Keep a ref to mode so keyboard handler always reads the latest value
	const modeRef = useRef<GridMode>(mode);
	useEffect(() => {
		modeRef.current = mode;
	}, [mode]);

	const maxRow = rowCount - 1;
	const maxCol = colCount - 1;

	// --- Composed hooks ---

	const {
		selection,
		setAnchor,
		extendTo,
		clear: clearSelection,
		isCellInRange,
	} = useGridSelection({
		enabled: rangeSelection,
		colCount,
		columnIds,
	});

	const { copySelection, pasteAtCell, fillDown, fillRight } = useGridClipboard({
		enabled: clipboardEnabled,
		getCellValue,
		onPaste,
		columnIds,
		editableColumns,
	});

	// --- Selection change notification ---

	const prevSelectionRef = useRef<GridSelection | null>(null);
	useEffect(() => {
		if (onSelectionChange && selection !== prevSelectionRef.current) {
			prevSelectionRef.current = selection;
			onSelectionChange(selection);
		}
	}, [selection, onSelectionChange]);

	// --- Active row change notification ---

	const prevActiveRowRef = useRef<number | null>(null);
	useEffect(() => {
		if (onActiveRowChange && activeCell) {
			if (prevActiveRowRef.current !== activeCell.rowIndex) {
				prevActiveRowRef.current = activeCell.rowIndex;
				onActiveRowChange(activeCell.rowIndex);
			}
		}
	}, [activeCell, onActiveRowChange]);

	// --- Focus management ---
	// When activeCell changes and we are NOT in edit mode, focus the DOM cell.

	useEffect(() => {
		if (!enabled || !activeCell || !tableRef.current) return;
		// Do not steal focus from edit-mode inputs
		if (modeRef.current === 'edit') return;

		const cell = tableRef.current.querySelector<HTMLElement>(
			`[data-row-index="${activeCell.rowIndex}"][data-col-index="${activeCell.colIndex}"]`
		);
		cell?.focus();
	}, [activeCell, enabled, tableRef]);

	// --- Helpers ---

	const isEditable = useCallback(
		(colId: string): boolean => {
			if (!editableColumns?.length) return false;
			return editableColumns.includes(colId);
		},
		[editableColumns]
	);

	const makeCellCoord = useCallback(
		(rowIndex: number, colIndex: number): CellCoord => ({
			rowIndex,
			colIndex,
			colId: columnIds[colIndex] ?? '',
		}),
		[columnIds]
	);

	const setActiveCell = useCallback(
		(cell: CellCoord | null) => {
			setActiveCellState(cell);
			if (cell && rangeSelection) {
				setAnchor(cell);
			}
		},
		[rangeSelection, setAnchor]
	);

	const exitEditMode = useCallback(() => {
		setMode('navigation');
	}, []);

	// --- Navigation helpers ---

	const moveBy = useCallback(
		(rowDelta: number, colDelta: number): CellCoord | null => {
			if (!activeCell) return null;
			const newRow = Math.max(0, Math.min(maxRow, activeCell.rowIndex + rowDelta));
			const newCol = Math.max(0, Math.min(maxCol, activeCell.colIndex + colDelta));
			return makeCellCoord(newRow, newCol);
		},
		[activeCell, maxRow, maxCol, makeCellCoord]
	);

	const findNextEditable = useCallback(
		(fromRow: number, fromCol: number, direction: 1 | -1): CellCoord => {
			if (!editableColumns?.length) {
				// No editable columns defined — just move by 1 column with row wrapping
				let col = fromCol + direction;
				let row = fromRow;
				if (col > maxCol) {
					col = 0;
					row = row >= maxRow ? 0 : row + 1;
				} else if (col < 0) {
					col = maxCol;
					row = row <= 0 ? maxRow : row - 1;
				}
				return makeCellCoord(row, col);
			}

			let col = fromCol;
			let row = fromRow;
			const totalCells = colCount * Math.max(rowCount, 1);
			let steps = 0;

			do {
				col += direction;
				if (col > maxCol) {
					col = 0;
					row = row >= maxRow ? 0 : row + 1;
				} else if (col < 0) {
					col = maxCol;
					row = row <= 0 ? maxRow : row - 1;
				}
				steps++;
			} while (steps <= totalCells && !editableColumns.includes(columnIds[col] ?? ''));

			return makeCellCoord(row, col);
		},
		[editableColumns, columnIds, maxCol, maxRow, colCount, rowCount, makeCellCoord]
	);

	// --- Edit mode entry/exit ---

	const enterEditMode = useCallback(
		(cell: CellCoord) => {
			if (!isEditable(cell.colId)) return;
			setMode('edit');
			onStartEdit?.(cell.rowIndex, cell.colId);
		},
		[isEditable, onStartEdit]
	);

	const commitAndMove = useCallback(
		(nextCell: CellCoord) => {
			if (activeCell) {
				onCommitEdit?.(activeCell.rowIndex, activeCell.colId);
			}
			setMode('navigation');
			setActiveCell(nextCell);
		},
		[activeCell, onCommitEdit, setActiveCell]
	);

	const cancelEdit = useCallback(() => {
		onCancelEdit?.();
		setMode('navigation');
	}, [onCancelEdit]);

	// --- Keyboard handler ---

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (!enabled || !activeCell) return;

			// --- Edit mode key handling ---
			if (modeRef.current === 'edit') {
				switch (e.key) {
					case 'Enter': {
						e.preventDefault();
						// Commit and move down
						const newRow = Math.min(maxRow, activeCell.rowIndex + 1);
						commitAndMove(makeCellCoord(newRow, activeCell.colIndex));
						break;
					}
					case 'Tab': {
						e.preventDefault();
						// Commit and move to next editable
						const dir = e.shiftKey ? -1 : 1;
						const next = findNextEditable(activeCell.rowIndex, activeCell.colIndex, dir as 1 | -1);
						commitAndMove(next);
						break;
					}
					case 'Escape': {
						e.preventDefault();
						cancelEdit();
						break;
					}
					default:
						// Let all other keys pass through to the editing input
						break;
				}
				return;
			}

			// --- Navigation mode key handling ---

			switch (e.key) {
				case 'ArrowUp': {
					e.preventDefault();
					if (e.shiftKey && rangeSelection) {
						const target = moveBy(-1, 0);
						if (target) {
							setActiveCellState(target);
							extendTo(target);
						}
					} else {
						const target = moveBy(-1, 0);
						if (target) setActiveCell(target);
					}
					break;
				}
				case 'ArrowDown': {
					e.preventDefault();
					if (e.shiftKey && rangeSelection) {
						const target = moveBy(1, 0);
						if (target) {
							setActiveCellState(target);
							extendTo(target);
						}
					} else {
						const target = moveBy(1, 0);
						if (target) setActiveCell(target);
					}
					break;
				}
				case 'ArrowLeft': {
					// Skip if currently in an input element (let the input handle cursor)
					if (e.target instanceof HTMLInputElement) break;
					e.preventDefault();
					if (e.shiftKey && rangeSelection) {
						const target = moveBy(0, -1);
						if (target) {
							setActiveCellState(target);
							extendTo(target);
						}
					} else {
						const target = moveBy(0, -1);
						if (target) setActiveCell(target);
					}
					break;
				}
				case 'ArrowRight': {
					if (e.target instanceof HTMLInputElement) break;
					e.preventDefault();
					if (e.shiftKey && rangeSelection) {
						const target = moveBy(0, 1);
						if (target) {
							setActiveCellState(target);
							extendTo(target);
						}
					} else {
						const target = moveBy(0, 1);
						if (target) setActiveCell(target);
					}
					break;
				}
				case 'Tab': {
					e.preventDefault();
					const dir = e.shiftKey ? -1 : 1;
					const next = findNextEditable(activeCell.rowIndex, activeCell.colIndex, dir as 1 | -1);
					setActiveCell(next);
					break;
				}
				case 'Enter': {
					e.preventDefault();
					if (isEditable(activeCell.colId)) {
						enterEditMode(activeCell);
					}
					onRowSelect?.(activeCell.rowIndex);
					break;
				}
				case 'F2': {
					e.preventDefault();
					enterEditMode(activeCell);
					break;
				}
				case 'Home': {
					e.preventDefault();
					if (isMod(e)) {
						setActiveCell(makeCellCoord(0, 0));
					} else {
						setActiveCell(makeCellCoord(activeCell.rowIndex, 0));
					}
					break;
				}
				case 'End': {
					e.preventDefault();
					if (isMod(e)) {
						setActiveCell(makeCellCoord(maxRow, maxCol));
					} else {
						setActiveCell(makeCellCoord(activeCell.rowIndex, maxCol));
					}
					break;
				}
				case 'PageUp': {
					e.preventDefault();
					const newRow = Math.max(0, activeCell.rowIndex - PAGE_SIZE);
					setActiveCell(makeCellCoord(newRow, activeCell.colIndex));
					break;
				}
				case 'PageDown': {
					e.preventDefault();
					const newRow = Math.min(maxRow, activeCell.rowIndex + PAGE_SIZE);
					setActiveCell(makeCellCoord(newRow, activeCell.colIndex));
					break;
				}
				case 'Escape': {
					e.preventDefault();
					clearSelection();
					setActiveCellState(null);
					break;
				}
				case 'c': {
					if (isMod(e) && clipboardEnabled && selection) {
						e.preventDefault();
						void copySelection(selection);
					}
					break;
				}
				case 'v': {
					if (isMod(e) && clipboardEnabled && activeCell) {
						e.preventDefault();
						void pasteAtCell(activeCell);
					}
					break;
				}
				case 'd': {
					if (isMod(e) && clipboardEnabled && selection) {
						e.preventDefault();
						fillDown(selection);
					}
					break;
				}
				case 'r': {
					if (isMod(e) && clipboardEnabled && selection) {
						e.preventDefault();
						fillRight(selection);
					}
					break;
				}
				default:
					break;
			}
		},
		[
			enabled,
			activeCell,
			maxRow,
			maxCol,
			rangeSelection,
			clipboardEnabled,
			selection,
			moveBy,
			setActiveCell,
			extendTo,
			findNextEditable,
			enterEditMode,
			commitAndMove,
			cancelEdit,
			clearSelection,
			makeCellCoord,
			copySelection,
			pasteAtCell,
			fillDown,
			fillRight,
			isEditable,
			onRowSelect,
		]
	);

	// --- Click handlers ---

	const onCellClick = useCallback(
		(rowIndex: number, colIndex: number, e?: React.MouseEvent) => {
			if (!enabled) return;
			const cell = makeCellCoord(rowIndex, colIndex);

			if (e?.shiftKey && rangeSelection && activeCell) {
				// Extend selection from anchor to clicked cell
				setActiveCellState(cell);
				extendTo(cell);
			} else {
				setActiveCell(cell);
			}
		},
		[enabled, makeCellCoord, rangeSelection, activeCell, setActiveCell, extendTo]
	);

	const onCellDoubleClick = useCallback(
		(rowIndex: number, colIndex: number) => {
			if (!enabled) return;
			const colId = columnIds[colIndex] ?? '';
			if (isEditable(colId)) {
				const cell = makeCellCoord(rowIndex, colIndex);
				setActiveCellState(cell);
				if (rangeSelection) {
					setAnchor(cell);
				}
				enterEditMode(cell);
			}
		},
		[enabled, columnIds, isEditable, makeCellCoord, rangeSelection, setAnchor, enterEditMode]
	);

	// --- Cell query helpers ---

	const isCellActive = useCallback(
		(rowIndex: number, colIndex: number): boolean => {
			if (!activeCell) return false;
			return activeCell.rowIndex === rowIndex && activeCell.colIndex === colIndex;
		},
		[activeCell]
	);

	return {
		activeCell,
		selection,
		mode,
		setActiveCell,
		handlers: {
			onKeyDown: handleKeyDown,
			onCellClick,
			onCellDoubleClick,
		},
		isCellActive,
		isCellInRange,
		exitEditMode,
	};
}
