import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { RevenueReadinessResponse } from '@budfin/types';
import { RevenueSetupChecklist } from './setup-checklist';
import { useRevenueSettingsDialogStore } from '../../stores/revenue-settings-dialog-store';

function makeReadiness(
	overrides: Partial<RevenueReadinessResponse> = {}
): RevenueReadinessResponse {
	return {
		feeGrid: { total: 0, complete: 0, settingsExist: false, ready: false },
		discounts: { flatRate: null, ready: false },
		otherRevenue: { total: 0, configured: 0, ready: false },
		overallReady: false,
		readyCount: 0,
		totalCount: 2,
		...overrides,
	};
}

describe('RevenueSetupChecklist', () => {
	beforeEach(() => {
		sessionStorage.clear();
		useRevenueSettingsDialogStore.setState({ isOpen: false, activeTab: 'feeGrid' });
	});

	afterEach(() => {
		cleanup();
		sessionStorage.clear();
		useRevenueSettingsDialogStore.setState({ isOpen: false, activeTab: 'feeGrid' });
	});

	it('auto-opens on first visit and moves focus to the checklist heading', async () => {
		render(
			<RevenueSetupChecklist
				versionId={42}
				lastCalculatedAt={null}
				readiness={makeReadiness({ readyCount: 1 })}
			/>
		);

		const heading = await screen.findByRole('heading', { name: 'Finish revenue setup' });
		expect(heading).toBeTruthy();

		await waitFor(() => {
			expect(document.activeElement).toBe(heading);
		});
	});

	it('does not auto-open when the checklist has already been dismissed', () => {
		sessionStorage.setItem('revenue-setup-dismissed-42', 'true');

		render(
			<RevenueSetupChecklist versionId={42} lastCalculatedAt={null} readiness={makeReadiness()} />
		);

		expect(screen.queryByRole('dialog')).toBeNull();
	});

	it('stores dismissal in sessionStorage when skipped', async () => {
		render(
			<RevenueSetupChecklist
				versionId={42}
				lastCalculatedAt={null}
				readiness={makeReadiness({ readyCount: 2 })}
			/>
		);

		fireEvent.click(await screen.findByRole('button', { name: 'Skip for Now' }));

		expect(sessionStorage.getItem('revenue-setup-dismissed-42')).toBe('true');
		await waitFor(() => {
			expect(screen.queryByRole('dialog')).toBeNull();
		});
	});

	it('opens the matching settings tab from an edit button', async () => {
		render(
			<RevenueSetupChecklist
				versionId={42}
				lastCalculatedAt={null}
				readiness={makeReadiness({ readyCount: 1 })}
			/>
		);

		fireEvent.click(await screen.findByRole('button', { name: 'Edit Other Revenue' }));

		expect(useRevenueSettingsDialogStore.getState().isOpen).toBe(true);
		expect(useRevenueSettingsDialogStore.getState().activeTab).toBe('otherRevenue');
	});

	it('closes when Escape is pressed', async () => {
		render(
			<RevenueSetupChecklist versionId={42} lastCalculatedAt={null} readiness={makeReadiness()} />
		);

		await screen.findByRole('dialog');
		fireEvent.keyDown(window, { key: 'Escape' });

		await waitFor(() => {
			expect(screen.queryByRole('dialog')).toBeNull();
		});
	});
});
