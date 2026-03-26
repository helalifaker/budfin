import { useCallback, useRef, useState } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────

export interface UndoEntry {
	type: 'cell-edit' | 'bulk-edit';
	cellKey: string;
	oldValue: string;
	newValue: string;
}

export interface UseGridUndoRedoReturn {
	push(entry: UndoEntry): void;
	undo(): UndoEntry | null;
	redo(): UndoEntry | null;
	flush(): void;
	canUndo: boolean;
	canRedo: boolean;
	pendingCount: number;
}

// ── Hook ───────────────────────────────────────────────────────────────────

/**
 * Provides local undo/redo support for grid cell edits.
 *
 * Stacks are stored in refs to avoid copying large arrays on every push.
 * A version counter in state triggers re-renders when stacks change,
 * and derived values (canUndo, canRedo, pendingCount) are computed
 * from state to satisfy the react-hooks/refs lint rule.
 */
export function useGridUndoRedo(): UseGridUndoRedoReturn {
	const undoStackRef = useRef<UndoEntry[]>([]);
	const redoStackRef = useRef<UndoEntry[]>([]);

	// State tracks stack sizes so derived values don't read refs during render.
	const [sizes, setSizes] = useState({ undo: 0, redo: 0 });

	const syncSizes = useCallback(() => {
		setSizes({
			undo: undoStackRef.current.length,
			redo: redoStackRef.current.length,
		});
	}, []);

	const push = useCallback(
		(entry: UndoEntry): void => {
			undoStackRef.current.push(entry);
			redoStackRef.current = [];
			syncSizes();
		},
		[syncSizes]
	);

	const undo = useCallback((): UndoEntry | null => {
		const entry = undoStackRef.current.pop() ?? null;
		if (entry) {
			redoStackRef.current.push(entry);
			syncSizes();
		}
		return entry;
	}, [syncSizes]);

	const redo = useCallback((): UndoEntry | null => {
		const entry = redoStackRef.current.pop() ?? null;
		if (entry) {
			undoStackRef.current.push(entry);
			syncSizes();
		}
		return entry;
	}, [syncSizes]);

	const flush = useCallback((): void => {
		undoStackRef.current = [];
		redoStackRef.current = [];
		syncSizes();
	}, [syncSizes]);

	return {
		push,
		undo,
		redo,
		flush,
		canUndo: sizes.undo > 0,
		canRedo: sizes.redo > 0,
		pendingCount: sizes.undo,
	};
}
