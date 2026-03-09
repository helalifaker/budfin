import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { useAddEmployeeShortcut } from './use-add-employee-shortcut';

afterEach(() => {
	cleanup();
});

function fireCtrlShiftN() {
	const event = new KeyboardEvent('keydown', {
		key: 'N',
		ctrlKey: true,
		shiftKey: true,
		bubbles: true,
		cancelable: true,
	});
	document.dispatchEvent(event);
}

describe('useAddEmployeeShortcut', () => {
	it('calls onAddEmployee when Ctrl+Shift+N is pressed', () => {
		const onAddEmployee = vi.fn();
		renderHook(() => useAddEmployeeShortcut(false, onAddEmployee));

		fireCtrlShiftN();
		expect(onAddEmployee).toHaveBeenCalledTimes(1);
	});

	it('does not call onAddEmployee when isViewer is true', () => {
		const onAddEmployee = vi.fn();
		renderHook(() => useAddEmployeeShortcut(true, onAddEmployee));

		fireCtrlShiftN();
		expect(onAddEmployee).not.toHaveBeenCalled();
	});

	it('does not call onAddEmployee for other key combos', () => {
		const onAddEmployee = vi.fn();
		renderHook(() => useAddEmployeeShortcut(false, onAddEmployee));

		// Ctrl+N without Shift
		document.dispatchEvent(
			new KeyboardEvent('keydown', {
				key: 'N',
				ctrlKey: true,
				shiftKey: false,
				bubbles: true,
			})
		);
		expect(onAddEmployee).not.toHaveBeenCalled();

		// Shift+N without Ctrl
		document.dispatchEvent(
			new KeyboardEvent('keydown', {
				key: 'N',
				ctrlKey: false,
				shiftKey: true,
				bubbles: true,
			})
		);
		expect(onAddEmployee).not.toHaveBeenCalled();

		// Ctrl+Shift+M (wrong key)
		document.dispatchEvent(
			new KeyboardEvent('keydown', {
				key: 'M',
				ctrlKey: true,
				shiftKey: true,
				bubbles: true,
			})
		);
		expect(onAddEmployee).not.toHaveBeenCalled();
	});

	it('cleans up listener on unmount', () => {
		const onAddEmployee = vi.fn();
		const { unmount } = renderHook(() => useAddEmployeeShortcut(false, onAddEmployee));

		unmount();

		fireCtrlShiftN();
		expect(onAddEmployee).not.toHaveBeenCalled();
	});

	it('removes listener when isViewer changes to true', () => {
		const onAddEmployee = vi.fn();
		const { rerender } = renderHook(
			({ isViewer }) => useAddEmployeeShortcut(isViewer, onAddEmployee),
			{ initialProps: { isViewer: false } }
		);

		// Should work initially
		fireCtrlShiftN();
		expect(onAddEmployee).toHaveBeenCalledTimes(1);

		// Change to viewer
		rerender({ isViewer: true });

		fireCtrlShiftN();
		// Should still be 1 (not called again)
		expect(onAddEmployee).toHaveBeenCalledTimes(1);
	});
});
