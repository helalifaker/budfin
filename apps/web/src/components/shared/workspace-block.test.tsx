import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { WorkspaceBlock } from './workspace-block';

// Mock ResizeObserver for jsdom
class MockResizeObserver {
	observe() {}
	unobserve() {}
	disconnect() {}
}

beforeEach(() => {
	globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
});

afterEach(() => {
	cleanup();
});

describe('WorkspaceBlock', () => {
	it('renders title and children', () => {
		render(
			<WorkspaceBlock title="Enrollment">
				<p>Table content</p>
			</WorkspaceBlock>
		);

		expect(screen.getByText('Enrollment')).toBeDefined();
		expect(screen.getByText('Table content')).toBeDefined();
	});

	it('renders count badge when count is provided', () => {
		render(
			<WorkspaceBlock title="Positions" count={24}>
				<p>Content</p>
			</WorkspaceBlock>
		);

		expect(screen.getByText('24')).toBeDefined();
	});

	it('does not render count badge when count is undefined', () => {
		render(
			<WorkspaceBlock title="Positions">
				<p>Content</p>
			</WorkspaceBlock>
		);

		// Only the title and children should be present
		const button = screen.getByRole('button');
		expect(button.textContent).not.toContain('0');
	});

	it('toggles collapse on header click', () => {
		render(
			<WorkspaceBlock title="Revenue">
				<p>Revenue content</p>
			</WorkspaceBlock>
		);

		const button = screen.getByRole('button');

		// Should start expanded (defaultOpen=true)
		expect(button.getAttribute('aria-expanded')).toBe('true');

		// Click to collapse
		fireEvent.click(button);
		expect(button.getAttribute('aria-expanded')).toBe('false');

		// Click to expand again
		fireEvent.click(button);
		expect(button.getAttribute('aria-expanded')).toBe('true');
	});

	it('starts collapsed when defaultOpen is false', () => {
		render(
			<WorkspaceBlock title="Hidden" defaultOpen={false}>
				<p>Hidden content</p>
			</WorkspaceBlock>
		);

		const button = screen.getByRole('button');
		expect(button.getAttribute('aria-expanded')).toBe('false');
	});

	it('shows stale indicator when isStale is true', () => {
		render(
			<WorkspaceBlock title="Stale Block" isStale>
				<p>Content</p>
			</WorkspaceBlock>
		);

		expect(screen.getByText('Recalculate')).toBeDefined();
	});

	it('hides stale indicator when isStale is false', () => {
		render(
			<WorkspaceBlock title="Fresh Block" isStale={false}>
				<p>Content</p>
			</WorkspaceBlock>
		);

		expect(screen.queryByText('Recalculate')).toBeNull();
	});

	it('hides stale indicator by default', () => {
		render(
			<WorkspaceBlock title="Default Block">
				<p>Content</p>
			</WorkspaceBlock>
		);

		expect(screen.queryByText('Recalculate')).toBeNull();
	});

	it('applies aria-expanded attribute correctly', () => {
		render(
			<WorkspaceBlock title="ARIA Test">
				<p>Content</p>
			</WorkspaceBlock>
		);

		const button = screen.getByRole('button');

		// Starts expanded
		expect(button.getAttribute('aria-expanded')).toBe('true');

		// Collapse
		fireEvent.click(button);
		expect(button.getAttribute('aria-expanded')).toBe('false');
	});

	it('sets aria-controls to a content region id', () => {
		render(
			<WorkspaceBlock title="Test Section">
				<p>Content</p>
			</WorkspaceBlock>
		);

		const button = screen.getByRole('button');
		const ariaControls = button.getAttribute('aria-controls');
		expect(ariaControls).toBe('workspace-block-test-section');

		// Verify the region element has matching id
		const region = screen.getByRole('region');
		expect(region.getAttribute('id')).toBe('workspace-block-test-section');
	});

	it('renders the collapsible content in a region role', () => {
		render(
			<WorkspaceBlock title="Region Test">
				<p>Region content</p>
			</WorkspaceBlock>
		);

		const region = screen.getByRole('region');
		expect(region).toBeDefined();
		expect(region.textContent).toContain('Region content');
	});

	it('wraps in a section element', () => {
		const { container } = render(
			<WorkspaceBlock title="Section Test">
				<p>Content</p>
			</WorkspaceBlock>
		);

		const section = container.querySelector('section');
		expect(section).not.toBeNull();
	});

	it('sets maxHeight to 0 when collapsed', () => {
		render(
			<WorkspaceBlock title="Height Test" defaultOpen={false}>
				<p>Content</p>
			</WorkspaceBlock>
		);

		const region = screen.getByRole('region');
		expect(region.style.maxHeight).toBe('0px');
	});
});
