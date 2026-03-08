import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { EditableCell } from './editable-cell';

describe('EditableCell', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.runOnlyPendingTimers();
		vi.useRealTimers();
		cleanup();
	});

	it('renders the display value as a button when editable', () => {
		render(<EditableCell value={1500} onChange={vi.fn()} />);

		const button = screen.getByRole('button');
		expect(button).toBeDefined();
		expect(button.textContent).toContain('1,500');
	});

	it('renders as a read-only span when isReadOnly is true', () => {
		render(<EditableCell value={42} onChange={vi.fn()} isReadOnly />);

		expect(screen.queryByRole('button')).toBeNull();
		const span = screen.getByText('42');
		expect(span.tagName).toBe('SPAN');
	});

	it('enters edit mode on click', () => {
		render(<EditableCell value={100} onChange={vi.fn()} />);

		fireEvent.click(screen.getByRole('button'));

		const input = screen.getByRole('spinbutton');
		expect(input).toBeDefined();
		expect((input as HTMLInputElement).value).toBe('100');
	});

	it('does not enter edit mode when isReadOnly', () => {
		render(<EditableCell value={100} onChange={vi.fn()} isReadOnly />);

		const span = screen.getByText('100');
		fireEvent.click(span);

		expect(screen.queryByRole('spinbutton')).toBeNull();
	});

	it('confirms edit on Enter key and calls onChange', () => {
		const onChange = vi.fn();
		render(<EditableCell value={100} onChange={onChange} />);

		// Enter edit mode
		fireEvent.click(screen.getByRole('button'));
		const input = screen.getByRole('spinbutton');

		// Change value
		fireEvent.change(input, { target: { value: '200' } });
		// Press Enter
		fireEvent.keyDown(input, { key: 'Enter' });

		// Should exit edit mode
		expect(screen.queryByRole('spinbutton')).toBeNull();
		expect(screen.getByRole('button')).toBeDefined();

		// onChange is debounced by 300ms
		expect(onChange).not.toHaveBeenCalled();
		vi.advanceTimersByTime(300);
		expect(onChange).toHaveBeenCalledWith(200);
	});

	it('cancels edit on Escape key without calling onChange', () => {
		const onChange = vi.fn();
		render(<EditableCell value={100} onChange={onChange} />);

		fireEvent.click(screen.getByRole('button'));
		const input = screen.getByRole('spinbutton');

		fireEvent.change(input, { target: { value: '999' } });
		fireEvent.keyDown(input, { key: 'Escape' });

		// Should exit edit mode without saving
		expect(screen.queryByRole('spinbutton')).toBeNull();
		expect(screen.getByRole('button')).toBeDefined();

		vi.advanceTimersByTime(500);
		expect(onChange).not.toHaveBeenCalled();
	});

	it('saves on blur', () => {
		const onChange = vi.fn();
		render(<EditableCell value={50} onChange={onChange} />);

		fireEvent.click(screen.getByRole('button'));
		const input = screen.getByRole('spinbutton');

		fireEvent.change(input, { target: { value: '75' } });
		fireEvent.blur(input);

		// Should exit edit mode
		expect(screen.queryByRole('spinbutton')).toBeNull();

		vi.advanceTimersByTime(300);
		expect(onChange).toHaveBeenCalledWith(75);
	});

	it('does not call onChange when value has not changed', () => {
		const onChange = vi.fn();
		render(<EditableCell value={100} onChange={onChange} />);

		fireEvent.click(screen.getByRole('button'));
		const input = screen.getByRole('spinbutton');

		// Confirm without changing value
		fireEvent.keyDown(input, { key: 'Enter' });

		vi.advanceTimersByTime(500);
		expect(onChange).not.toHaveBeenCalled();
	});

	it('displays percentage values with % suffix', () => {
		render(<EditableCell value={5} onChange={vi.fn()} type="percentage" />);

		expect(screen.getByRole('button').textContent).toBe('5%');
	});

	it('divides percentage value by 100 when calling onChange', () => {
		const onChange = vi.fn();
		render(<EditableCell value={0} onChange={onChange} type="percentage" />);

		fireEvent.click(screen.getByRole('button'));
		const input = screen.getByRole('spinbutton');

		// User types 15 meaning 15%
		fireEvent.change(input, { target: { value: '15' } });
		fireEvent.keyDown(input, { key: 'Enter' });

		vi.advanceTimersByTime(300);
		expect(onChange).toHaveBeenCalledWith(0.15);
	});

	it('does not call onChange for NaN input', () => {
		const onChange = vi.fn();
		render(<EditableCell value={100} onChange={onChange} />);

		fireEvent.click(screen.getByRole('button'));
		const input = screen.getByRole('spinbutton');

		fireEvent.change(input, { target: { value: '' } });
		fireEvent.keyDown(input, { key: 'Enter' });

		vi.advanceTimersByTime(500);
		expect(onChange).not.toHaveBeenCalled();
	});

	it('shows error styling and title when isError is true', () => {
		render(
			<EditableCell value={100} onChange={vi.fn()} isError errorMessage="Value out of range" />
		);

		const button = screen.getByRole('button');
		expect(button.getAttribute('title')).toBe('Value out of range');
	});

	it('shows error title on read-only cells', () => {
		render(
			<EditableCell
				value={100}
				onChange={vi.fn()}
				isReadOnly
				isError
				errorMessage="Computed error"
			/>
		);

		const span = screen.getByText('100');
		expect(span.getAttribute('title')).toBe('Computed error');
	});

	it('enters edit mode on Enter key press on the button', () => {
		render(<EditableCell value={42} onChange={vi.fn()} />);

		const button = screen.getByRole('button');
		fireEvent.keyDown(button, { key: 'Enter' });

		expect(screen.getByRole('spinbutton')).toBeDefined();
	});

	it('enters edit mode on Space key press on the button', () => {
		render(<EditableCell value={42} onChange={vi.fn()} />);

		const button = screen.getByRole('button');
		fireEvent.keyDown(button, { key: ' ' });

		expect(screen.getByRole('spinbutton')).toBeDefined();
	});

	it('handles string values correctly', () => {
		render(<EditableCell value="250.5" onChange={vi.fn()} />);

		const button = screen.getByRole('button');
		expect(button.textContent).toContain('250.5');
	});

	it('sets aria-label on the input', () => {
		render(<EditableCell value={10} onChange={vi.fn()} />);

		fireEvent.click(screen.getByRole('button'));

		const input = screen.getByLabelText('Edit cell value');
		expect(input).toBeDefined();
	});
});
