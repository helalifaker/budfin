import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { StaffingGuideContent } from './staffing-guide-content';

vi.mock('../../lib/right-panel-registry', () => ({
	registerPanelContent: vi.fn(),
	registerGuideContent: vi.fn(),
}));

afterEach(() => {
	cleanup();
});

describe('StaffingGuideContent', () => {
	it('renders contextual help content', () => {
		render(<StaffingGuideContent />);

		// Should display help text about the staffing module
		expect(screen.getByText('Staffing Guide')).toBeDefined();
	});

	it('registers guide content with the right-panel registry', async () => {
		const registry = await import('../../lib/right-panel-registry');
		expect(registry.registerGuideContent).toHaveBeenCalledWith('staffing', expect.any(Function));
	});

	it('includes information about KPI metrics', () => {
		render(<StaffingGuideContent />);

		expect(screen.getByText('KPI Metrics')).toBeDefined();
	});

	it('includes information about inspector panel', () => {
		render(<StaffingGuideContent />);

		// Should mention the detail panel
		expect(screen.getByText('Detail Panel')).toBeDefined();
	});
});
