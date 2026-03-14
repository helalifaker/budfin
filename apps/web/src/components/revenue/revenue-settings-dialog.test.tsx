import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RevenueSettingsDialog } from './revenue-settings-dialog';
import { useRevenueSettingsDialogStore } from '../../stores/revenue-settings-dialog-store';
import { useRevenueSettingsDirtyStore } from '../../stores/revenue-settings-dirty-store';

vi.mock('./fee-grid-tab', () => ({
	FeeGridTab: ({ isReadOnly }: { isReadOnly: boolean }) => (
		<div>
			<input aria-label="Fee Grid Input" disabled={isReadOnly} />
			{!isReadOnly && <button type="button">Save Fee Grid</button>}
		</div>
	),
}));

vi.mock('./tariff-assignment-grid', () => ({
	TariffAssignmentGrid: ({ isReadOnly }: { isReadOnly: boolean }) => (
		<div>
			<input aria-label="Tariff Assignment Input" disabled={isReadOnly} />
			{!isReadOnly && <button type="button">Save Tariff Assignment</button>}
		</div>
	),
}));

vi.mock('./discounts-tab', () => ({
	DiscountsTab: ({ isReadOnly }: { isReadOnly: boolean }) => (
		<div>
			<input aria-label="Discounts Input" disabled={isReadOnly} />
			{!isReadOnly && <button type="button">Save Discounts</button>}
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

const mockReadiness = {
	feeGrid: { total: 90, complete: 90, ready: true },
	tariffAssignment: { reconciled: true, ready: true },
	discounts: { rpRate: '0.250000', r3Rate: '0.100000', ready: true },
	derivedRevenueSettings: { exists: true, ready: true },
	otherRevenue: { total: 20, configured: 20, ready: true },
	overallReady: true,
	readyCount: 5,
	totalCount: 5 as const,
};

const mockIncompleteReadiness = {
	feeGrid: { total: 90, complete: 0, ready: false },
	tariffAssignment: { reconciled: false, ready: false },
	discounts: { rpRate: null, r3Rate: null, ready: false },
	derivedRevenueSettings: { exists: false, ready: false },
	otherRevenue: { total: 20, configured: 0, ready: false },
	overallReady: false,
	readyCount: 0,
	totalCount: 5 as const,
};

describe('RevenueSettingsDialog', () => {
	beforeEach(() => {
		useRevenueSettingsDialogStore.setState({ isOpen: true, activeTab: 'feeGrid' });
		useRevenueSettingsDirtyStore.getState().clearAll();
	});

	afterEach(() => {
		cleanup();
		useRevenueSettingsDialogStore.setState({ isOpen: false, activeTab: 'feeGrid' });
		useRevenueSettingsDirtyStore.getState().clearAll();
	});

	it('renders the revenue settings dialog with tabs', () => {
		render(
			<RevenueSettingsDialog
				versionId={1}
				isViewer={false}
				readiness={mockReadiness}
				isImported={false}
			/>
		);

		expect(screen.getByRole('dialog', { name: 'Revenue Settings' })).toBeDefined();
		expect(screen.getByRole('tab', { name: 'Fee Grid' })).toBeDefined();
		expect(screen.getByRole('tab', { name: 'Tariff Assignment' })).toBeDefined();
		expect(screen.getByRole('tab', { name: 'Discounts' })).toBeDefined();
		expect(screen.getByRole('tab', { name: 'Other Revenue' })).toBeDefined();
	});

	it('shows an inline warning when switching away from a dirty tab', () => {
		useRevenueSettingsDirtyStore.getState().markDirty('feeGrid', 'fee-grid-input');

		render(
			<RevenueSettingsDialog
				versionId={1}
				isViewer={false}
				readiness={mockReadiness}
				isImported={false}
			/>
		);
		fireEvent.click(screen.getByRole('tab', { name: 'Discounts' }));

		expect(screen.getByText('You have unsaved changes. Switch anyway?')).toBeDefined();
		fireEvent.click(screen.getByRole('button', { name: 'Switch' }));

		expect(useRevenueSettingsDialogStore.getState().activeTab).toBe('discounts');
	});

	it('shows discard confirmation when closing with dirty tabs', () => {
		useRevenueSettingsDirtyStore.getState().markDirty('feeGrid', 'fee-grid-input');

		render(
			<RevenueSettingsDialog
				versionId={1}
				isViewer={false}
				readiness={mockReadiness}
				isImported={false}
			/>
		);
		fireEvent.click(screen.getByLabelText('Close'));

		expect(screen.getByText(/Discard and close\?/)).toBeDefined();
		fireEvent.click(screen.getByRole('button', { name: 'Discard' }));

		expect(useRevenueSettingsDialogStore.getState().isOpen).toBe(false);
	});

	it('shows viewer banner in read-only mode', () => {
		render(
			<RevenueSettingsDialog versionId={1} isViewer readiness={mockReadiness} isImported={false} />
		);

		expect(screen.getByText(/Viewer mode is read-only/)).toBeDefined();
		expect(screen.queryByRole('button', { name: 'Save Fee Grid' })).toBeNull();
	});

	it('shows progress bar when setup is incomplete', () => {
		useRevenueSettingsDialogStore.setState({ isOpen: true, activeTab: 'feeGrid' });

		render(
			<RevenueSettingsDialog
				versionId={1}
				isViewer={false}
				readiness={mockIncompleteReadiness}
				isImported={false}
			/>
		);

		expect(screen.getByText(/Complete 5 remaining steps/)).toBeDefined();
	});

	it('shows readiness progress summary below tab list', () => {
		render(
			<RevenueSettingsDialog
				versionId={1}
				isViewer={false}
				readiness={mockReadiness}
				isImported={false}
			/>
		);

		expect(screen.getByText('5/5 complete')).toBeDefined();
	});
});
