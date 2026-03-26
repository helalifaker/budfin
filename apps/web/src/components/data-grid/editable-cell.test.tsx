import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { EditableCell } from './editable-cell';

describe('EditableCell keyboard entry modes', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.runOnlyPendingTimers();
		vi.useRealTimers();
		cleanup();
	});

	// ---------------------------------------------------------------------------
	// Existing behavior: click to edit (sanity check)
	// ---------------------------------------------------------------------------

	it('enters edit mode on click with existing value', () => {
		render(<EditableCell value="500" onChange={vi.fn()} type="number" />);

		fireEvent.click(screen.getByRole('button'));

		const input = screen.getByRole('spinbutton') as HTMLInputElement;
		expect(input).toBeDefined();
		expect(input.value).toBe('500');
	});

	// ---------------------------------------------------------------------------
	// Overwrite-on-type: printable character replaces value
	// ---------------------------------------------------------------------------

	it('enters edit mode with just the typed digit on printable key', () => {
		render(<EditableCell value="500" onChange={vi.fn()} type="number" />);

		const button = screen.getByRole('button');
		fireEvent.keyDown(button, { key: '3' });

		const input = screen.getByRole('spinbutton') as HTMLInputElement;
		expect(input).toBeDefined();
		expect(input.value).toBe('3');
	});

	it('enters edit mode with typed letter for text type', () => {
		render(<EditableCell value="hello" onChange={vi.fn()} type="text" />);

		const button = screen.getByRole('button');
		fireEvent.keyDown(button, { key: 'a' });

		const input = screen.getByRole('textbox') as HTMLInputElement;
		expect(input).toBeDefined();
		expect(input.value).toBe('a');
	});

	it('does not enter overwrite mode when Ctrl is held', () => {
		render(<EditableCell value="500" onChange={vi.fn()} type="number" />);

		const button = screen.getByRole('button');
		fireEvent.keyDown(button, { key: 'c', ctrlKey: true });

		// Should still be in display mode
		expect(screen.queryByRole('spinbutton')).toBeNull();
		expect(screen.getByRole('button')).toBeDefined();
	});

	it('does not enter overwrite mode when Meta is held', () => {
		render(<EditableCell value="500" onChange={vi.fn()} type="number" />);

		const button = screen.getByRole('button');
		fireEvent.keyDown(button, { key: 'v', metaKey: true });

		expect(screen.queryByRole('spinbutton')).toBeNull();
		expect(screen.getByRole('button')).toBeDefined();
	});

	it('does not enter overwrite mode when Alt is held', () => {
		render(<EditableCell value="500" onChange={vi.fn()} type="number" />);

		const button = screen.getByRole('button');
		fireEvent.keyDown(button, { key: 'a', altKey: true });

		expect(screen.queryByRole('spinbutton')).toBeNull();
		expect(screen.getByRole('button')).toBeDefined();
	});

	// ---------------------------------------------------------------------------
	// F2 edit mode: preserves existing value
	// ---------------------------------------------------------------------------

	it('enters edit mode with existing value preserved on F2', () => {
		render(<EditableCell value="500" onChange={vi.fn()} type="number" />);

		const button = screen.getByRole('button');
		fireEvent.keyDown(button, { key: 'F2' });

		const input = screen.getByRole('spinbutton') as HTMLInputElement;
		expect(input).toBeDefined();
		expect(input.value).toBe('500');
	});

	it('enters edit mode with text value preserved on F2', () => {
		render(<EditableCell value="hello" onChange={vi.fn()} type="text" />);

		const button = screen.getByRole('button');
		fireEvent.keyDown(button, { key: 'F2' });

		const input = screen.getByRole('textbox') as HTMLInputElement;
		expect(input).toBeDefined();
		expect(input.value).toBe('hello');
	});

	// ---------------------------------------------------------------------------
	// Delete/Backspace: clear to '0'
	// ---------------------------------------------------------------------------

	it('clears cell to 0 on Delete key and calls onChange', () => {
		const onChange = vi.fn();
		render(<EditableCell value="500" onChange={onChange} type="number" />);

		const button = screen.getByRole('button');
		fireEvent.keyDown(button, { key: 'Delete' });

		// Should NOT enter edit mode
		expect(screen.queryByRole('spinbutton')).toBeNull();
		// Should still show button (display mode)
		expect(screen.getByRole('button')).toBeDefined();
		// onChange should have been called with '0'
		expect(onChange).toHaveBeenCalledWith('0');
	});

	it('clears cell to 0 on Backspace key and calls onChange', () => {
		const onChange = vi.fn();
		render(<EditableCell value="250" onChange={onChange} type="number" />);

		const button = screen.getByRole('button');
		fireEvent.keyDown(button, { key: 'Backspace' });

		expect(screen.queryByRole('spinbutton')).toBeNull();
		expect(onChange).toHaveBeenCalledWith('0');
	});

	it('does not call onChange on Delete when value is already 0', () => {
		const onChange = vi.fn();
		render(<EditableCell value="0" onChange={onChange} type="number" />);

		const button = screen.getByRole('button');
		fireEvent.keyDown(button, { key: 'Delete' });

		expect(onChange).not.toHaveBeenCalled();
	});

	// ---------------------------------------------------------------------------
	// Navigation keys passthrough: do NOT enter edit mode
	// ---------------------------------------------------------------------------

	it('does not enter edit mode on ArrowUp', () => {
		render(<EditableCell value="500" onChange={vi.fn()} type="number" />);

		const button = screen.getByRole('button');
		fireEvent.keyDown(button, { key: 'ArrowUp' });

		expect(screen.queryByRole('spinbutton')).toBeNull();
		expect(screen.getByRole('button')).toBeDefined();
	});

	it('does not enter edit mode on ArrowDown', () => {
		render(<EditableCell value="500" onChange={vi.fn()} type="number" />);

		const button = screen.getByRole('button');
		fireEvent.keyDown(button, { key: 'ArrowDown' });

		expect(screen.queryByRole('spinbutton')).toBeNull();
		expect(screen.getByRole('button')).toBeDefined();
	});

	it('does not enter edit mode on ArrowLeft', () => {
		render(<EditableCell value="500" onChange={vi.fn()} type="number" />);

		const button = screen.getByRole('button');
		fireEvent.keyDown(button, { key: 'ArrowLeft' });

		expect(screen.queryByRole('spinbutton')).toBeNull();
		expect(screen.getByRole('button')).toBeDefined();
	});

	it('does not enter edit mode on ArrowRight', () => {
		render(<EditableCell value="500" onChange={vi.fn()} type="number" />);

		const button = screen.getByRole('button');
		fireEvent.keyDown(button, { key: 'ArrowRight' });

		expect(screen.queryByRole('spinbutton')).toBeNull();
		expect(screen.getByRole('button')).toBeDefined();
	});

	it('does not enter edit mode on Tab', () => {
		render(<EditableCell value="500" onChange={vi.fn()} type="number" />);

		const button = screen.getByRole('button');
		fireEvent.keyDown(button, { key: 'Tab' });

		expect(screen.queryByRole('spinbutton')).toBeNull();
		expect(screen.getByRole('button')).toBeDefined();
	});

	it('does not enter edit mode on Home', () => {
		render(<EditableCell value="500" onChange={vi.fn()} type="number" />);

		const button = screen.getByRole('button');
		fireEvent.keyDown(button, { key: 'Home' });

		expect(screen.queryByRole('spinbutton')).toBeNull();
		expect(screen.getByRole('button')).toBeDefined();
	});

	it('does not enter edit mode on End', () => {
		render(<EditableCell value="500" onChange={vi.fn()} type="number" />);

		const button = screen.getByRole('button');
		fireEvent.keyDown(button, { key: 'End' });

		expect(screen.queryByRole('spinbutton')).toBeNull();
		expect(screen.getByRole('button')).toBeDefined();
	});

	it('does not enter edit mode on Enter (lets button default handle it)', () => {
		render(<EditableCell value="500" onChange={vi.fn()} type="number" />);

		const button = screen.getByRole('button');
		fireEvent.keyDown(button, { key: 'Enter' });

		// Enter on a button triggers click which enters edit mode via onClick,
		// but our onKeyDown handler does NOT intercept Enter, so it passes through.
		// The button's native behavior may or may not fire click -- in test env
		// fireEvent.keyDown does not auto-trigger click, so no edit mode.
		expect(screen.queryByRole('spinbutton')).toBeNull();
	});

	// ---------------------------------------------------------------------------
	// Read-only cells should not respond to keyboard entry
	// ---------------------------------------------------------------------------

	it('does not respond to keyboard events when read-only', () => {
		const onChange = vi.fn();
		render(<EditableCell value="500" onChange={onChange} type="number" isReadOnly />);

		// Read-only renders a span, not a button
		expect(screen.queryByRole('button')).toBeNull();
		expect(onChange).not.toHaveBeenCalled();
	});

	// ---------------------------------------------------------------------------
	// Confirm that edit mode from overwrite still works with commit/cancel
	// ---------------------------------------------------------------------------

	it('can commit an overwrite-entered edit via Enter', () => {
		const onChange = vi.fn();
		render(<EditableCell value="500" onChange={onChange} type="number" />);

		// Type '7' to enter overwrite mode
		fireEvent.keyDown(screen.getByRole('button'), { key: '7' });

		const input = screen.getByRole('spinbutton') as HTMLInputElement;
		expect(input.value).toBe('7');

		// Commit with Enter
		fireEvent.keyDown(input, { key: 'Enter' });

		// Should exit edit mode
		expect(screen.queryByRole('spinbutton')).toBeNull();
		expect(screen.getByRole('button')).toBeDefined();
		// onChange called with '7' (different from '500')
		expect(onChange).toHaveBeenCalledWith('7');
	});

	it('can cancel an overwrite-entered edit via Escape', () => {
		const onChange = vi.fn();
		render(<EditableCell value="500" onChange={onChange} type="number" />);

		// Type '7' to enter overwrite mode
		fireEvent.keyDown(screen.getByRole('button'), { key: '7' });

		const input = screen.getByRole('spinbutton') as HTMLInputElement;
		expect(input.value).toBe('7');

		// Cancel with Escape
		fireEvent.keyDown(input, { key: 'Escape' });

		// Should exit edit mode, value restored
		expect(screen.queryByRole('spinbutton')).toBeNull();
		expect(screen.getByRole('button')).toBeDefined();
		// onChange should NOT have been called
		expect(onChange).not.toHaveBeenCalled();
	});

	it('can commit an F2-entered edit via blur', () => {
		const onChange = vi.fn();
		render(<EditableCell value="500" onChange={onChange} type="number" />);

		// F2 to enter edit mode with existing value
		fireEvent.keyDown(screen.getByRole('button'), { key: 'F2' });

		const input = screen.getByRole('spinbutton') as HTMLInputElement;
		expect(input.value).toBe('500');

		// Modify value
		fireEvent.change(input, { target: { value: '600' } });
		// Blur to commit
		fireEvent.blur(input);

		expect(screen.queryByRole('spinbutton')).toBeNull();
		expect(onChange).toHaveBeenCalledWith('600');
	});
});
