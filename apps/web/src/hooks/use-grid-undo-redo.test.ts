import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useGridUndoRedo, type UndoEntry } from './use-grid-undo-redo';

function makeEntry(overrides: Partial<UndoEntry> = {}): UndoEntry {
	return {
		type: 'cell-edit',
		cellKey: '1-m3',
		oldValue: '100',
		newValue: '200',
		...overrides,
	};
}

describe('useGridUndoRedo', () => {
	it('starts with empty stacks', () => {
		const { result } = renderHook(() => useGridUndoRedo());

		expect(result.current.canUndo).toBe(false);
		expect(result.current.canRedo).toBe(false);
		expect(result.current.pendingCount).toBe(0);
	});

	it('push + undo returns the entry', () => {
		const { result } = renderHook(() => useGridUndoRedo());
		const entry = makeEntry();

		act(() => {
			result.current.push(entry);
		});

		expect(result.current.canUndo).toBe(true);
		expect(result.current.canRedo).toBe(false);
		expect(result.current.pendingCount).toBe(1);

		let undone: UndoEntry | null = null;
		act(() => {
			undone = result.current.undo();
		});

		expect(undone).toEqual(entry);
		expect(result.current.canUndo).toBe(false);
		expect(result.current.canRedo).toBe(true);
		expect(result.current.pendingCount).toBe(0);
	});

	it('undo + redo returns the entry', () => {
		const { result } = renderHook(() => useGridUndoRedo());
		const entry = makeEntry();

		act(() => {
			result.current.push(entry);
		});

		act(() => {
			result.current.undo();
		});

		let redone: UndoEntry | null = null;
		act(() => {
			redone = result.current.redo();
		});

		expect(redone).toEqual(entry);
		expect(result.current.canUndo).toBe(true);
		expect(result.current.canRedo).toBe(false);
		expect(result.current.pendingCount).toBe(1);
	});

	it('new push after undo clears redo stack', () => {
		const { result } = renderHook(() => useGridUndoRedo());

		const first = makeEntry({ cellKey: '1-m1', oldValue: '10', newValue: '20' });
		const second = makeEntry({ cellKey: '1-m2', oldValue: '30', newValue: '40' });
		const third = makeEntry({ cellKey: '1-m3', oldValue: '50', newValue: '60' });

		act(() => {
			result.current.push(first);
			result.current.push(second);
		});

		// Undo second -- it moves to redo
		act(() => {
			result.current.undo();
		});

		expect(result.current.canRedo).toBe(true);

		// Push a new entry -- redo stack should be cleared
		act(() => {
			result.current.push(third);
		});

		expect(result.current.canRedo).toBe(false);
		expect(result.current.pendingCount).toBe(2); // first + third
	});

	it('flush clears everything', () => {
		const { result } = renderHook(() => useGridUndoRedo());

		act(() => {
			result.current.push(makeEntry({ cellKey: '1-m1' }));
			result.current.push(makeEntry({ cellKey: '1-m2' }));
		});

		// Undo one so redo has an entry too
		act(() => {
			result.current.undo();
		});

		expect(result.current.canUndo).toBe(true);
		expect(result.current.canRedo).toBe(true);

		act(() => {
			result.current.flush();
		});

		expect(result.current.canUndo).toBe(false);
		expect(result.current.canRedo).toBe(false);
		expect(result.current.pendingCount).toBe(0);
	});

	it('canUndo/canRedo are correct at each step', () => {
		const { result } = renderHook(() => useGridUndoRedo());

		// Initial: both false
		expect(result.current.canUndo).toBe(false);
		expect(result.current.canRedo).toBe(false);

		// After push: canUndo true, canRedo false
		act(() => {
			result.current.push(makeEntry());
		});
		expect(result.current.canUndo).toBe(true);
		expect(result.current.canRedo).toBe(false);

		// After undo: canUndo false, canRedo true
		act(() => {
			result.current.undo();
		});
		expect(result.current.canUndo).toBe(false);
		expect(result.current.canRedo).toBe(true);

		// After redo: canUndo true, canRedo false
		act(() => {
			result.current.redo();
		});
		expect(result.current.canUndo).toBe(true);
		expect(result.current.canRedo).toBe(false);
	});

	it('pendingCount tracks undo stack size', () => {
		const { result } = renderHook(() => useGridUndoRedo());

		expect(result.current.pendingCount).toBe(0);

		act(() => {
			result.current.push(makeEntry({ cellKey: '1-m1' }));
		});
		expect(result.current.pendingCount).toBe(1);

		act(() => {
			result.current.push(makeEntry({ cellKey: '1-m2' }));
		});
		expect(result.current.pendingCount).toBe(2);

		act(() => {
			result.current.push(makeEntry({ cellKey: '1-m3' }));
		});
		expect(result.current.pendingCount).toBe(3);

		act(() => {
			result.current.undo();
		});
		expect(result.current.pendingCount).toBe(2);

		act(() => {
			result.current.undo();
		});
		expect(result.current.pendingCount).toBe(1);

		act(() => {
			result.current.redo();
		});
		expect(result.current.pendingCount).toBe(2);
	});

	it('undo on empty stack returns null', () => {
		const { result } = renderHook(() => useGridUndoRedo());

		let entry: UndoEntry | null = null;
		act(() => {
			entry = result.current.undo();
		});

		expect(entry).toBeNull();
		expect(result.current.canUndo).toBe(false);
		expect(result.current.canRedo).toBe(false);
	});

	it('redo on empty stack returns null', () => {
		const { result } = renderHook(() => useGridUndoRedo());

		let entry: UndoEntry | null = null;
		act(() => {
			entry = result.current.redo();
		});

		expect(entry).toBeNull();
		expect(result.current.canUndo).toBe(false);
		expect(result.current.canRedo).toBe(false);
	});

	it('handles multiple undo/redo cycles in LIFO order', () => {
		const { result } = renderHook(() => useGridUndoRedo());

		const a = makeEntry({ cellKey: '1-m1', oldValue: '10', newValue: '20' });
		const b = makeEntry({ cellKey: '1-m2', oldValue: '30', newValue: '40' });
		const c = makeEntry({ cellKey: '1-m3', oldValue: '50', newValue: '60' });

		act(() => {
			result.current.push(a);
			result.current.push(b);
			result.current.push(c);
		});

		// Undo returns in LIFO order: c, b, a
		let undone: UndoEntry | null = null;
		act(() => {
			undone = result.current.undo();
		});
		expect(undone).toEqual(c);

		act(() => {
			undone = result.current.undo();
		});
		expect(undone).toEqual(b);

		act(() => {
			undone = result.current.undo();
		});
		expect(undone).toEqual(a);

		// Redo returns in LIFO order of redo stack: a, b, c
		let redone: UndoEntry | null = null;
		act(() => {
			redone = result.current.redo();
		});
		expect(redone).toEqual(a);

		act(() => {
			redone = result.current.redo();
		});
		expect(redone).toEqual(b);

		act(() => {
			redone = result.current.redo();
		});
		expect(redone).toEqual(c);
	});
});
