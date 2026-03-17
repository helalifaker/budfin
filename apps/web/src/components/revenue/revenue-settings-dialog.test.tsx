import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RevenueSettingsDialog } from './revenue-settings-dialog';
import { useRevenueReadiness } from '../../hooks/use-revenue';
import { useRevenueSettingsDialogStore } from '../../stores/revenue-settings-dialog-store';
import { useRevenueSettingsDirtyStore } from '../../stores/revenue-settings-dirty-store';

vi.mock('../../hooks/use-revenue', () => ({
	useRevenueReadiness: vi.fn(),
}));

vi.mock('./fee-grid-tab', () => ({
	FeeGridTab: ({ isReadOnly }: { isReadOnly: boolean }) => (
		<div>
			<input aria-label="Fee Grid Input" disabled={isReadOnly} />
			{!isReadOnly && <button type="button">Save Fee Grid</button>}
		</div>
	),
}));

vi.mock('./other-revenue-tab', () => ({
	OtherRevenueTab: ({ isReadOnly }: { isReadOnly: boolean }) => (
		<div>
			<input aria-label="Other Revenue Input" disabled={isReadOnly} />
			{!isReadOnly && <button type="button">Save Other Revenue</button>}
		</div>
	),
}));

const mockUseRevenueReadiness = vi.mocked(useRevenueReadiness);

describe('RevenueSettingsDialog', () => {
	beforeEach(() => {
		useRevenueSettingsDialogStore.setState({ isOpen: true, activeTab: 'feeGrid' });
		useRevenueSettingsDirtyStore.getState().clearAll();
		mockUseRevenueReadiness.mockReturnValue({
			data: {
				feeGrid: { total: 90, complete: 90, settingsExist: true, ready: true },
				discounts: { flatRate: '0.000000', ready: true },
				otherRevenue: { total: 20, configured: 20, ready: true },
				overallReady: true,
				readyCount: 2,
				totalCount: 2,
			},
			isLoading: false,
		} as ReturnType<typeof useRevenueReadiness>);
	});

	afterEach(() => {
		cleanup();
		useRevenueSettingsDialogStore.setState({ isOpen: false, activeTab: 'feeGrid' });
		useRevenueSettingsDirtyStore.getState().clearAll();
		vi.clearAllMocks();
	});

	it('renders the revenue settings dialog with 2 tabs', () => {
		render(<RevenueSettingsDialog versionId={1} isViewer={false} />);

		expect(screen.getByRole('dialog', { name: 'Revenue Settings' })).toBeDefined();
		expect(screen.getByText('Setup progress')).toBeDefined();
		expect(screen.getByText('2/2 complete')).toBeDefined();
		expect(screen.getByRole('tab', { name: /Fee Grid/ })).toBeDefined();
		expect(screen.getByRole('tab', { name: /Other Revenue/ })).toBeDefined();
		expect(screen.queryByRole('tab', { name: /Discounts/ })).toBeNull();
		expect(screen.queryByRole('tab', { name: /Tariff Assignment/ })).toBeNull();
	});

	it('shows an inline warning when switching away from a dirty tab', () => {
		useRevenueSettingsDirtyStore.getState().markDirty('feeGrid', 'fee-grid-input');

		render(<RevenueSettingsDialog versionId={1} isViewer={false} />);
		fireEvent.click(screen.getByRole('tab', { name: /Other Revenue/ }));

		expect(screen.getByText('You have unsaved changes. Switch anyway?')).toBeDefined();
		fireEvent.click(screen.getByRole('button', { name: 'Switch' }));

		expect(useRevenueSettingsDialogStore.getState().activeTab).toBe('otherRevenue');
	});

	it('shows discard confirmation when closing with dirty tabs', () => {
		useRevenueSettingsDirtyStore.getState().markDirty('feeGrid', 'fee-grid-input');

		render(<RevenueSettingsDialog versionId={1} isViewer={false} />);
		fireEvent.click(screen.getByLabelText('Close'));

		expect(screen.getByText(/Discard and close\?/)).toBeDefined();
		fireEvent.click(screen.getByRole('button', { name: 'Discard' }));

		expect(useRevenueSettingsDialogStore.getState().isOpen).toBe(false);
	});

	it('shows viewer banner in read-only mode', () => {
		render(<RevenueSettingsDialog versionId={1} isViewer />);

		expect(screen.getByText(/Viewer mode is read-only/)).toBeDefined();
		expect(screen.queryByRole('button', { name: 'Save Fee Grid' })).toBeNull();
	});

	it('auto-routes to the first incomplete tab only once per open cycle', () => {
		mockUseRevenueReadiness.mockReturnValue({
			data: {
				feeGrid: { total: 90, complete: 90, settingsExist: true, ready: true },
				discounts: { flatRate: '0.000000', ready: true },
				otherRevenue: { total: 20, configured: 0, ready: false },
				overallReady: false,
				readyCount: 1,
				totalCount: 2,
			},
			isLoading: false,
		} as ReturnType<typeof useRevenueReadiness>);

		render(<RevenueSettingsDialog versionId={1} isViewer={false} />);

		expect(useRevenueSettingsDialogStore.getState().activeTab).toBe('otherRevenue');

		fireEvent.click(screen.getByRole('tab', { name: /Fee Grid/ }));

		expect(useRevenueSettingsDialogStore.getState().activeTab).toBe('feeGrid');
		expect(screen.getByLabelText('Fee Grid Input')).toBeDefined();
	});
});
