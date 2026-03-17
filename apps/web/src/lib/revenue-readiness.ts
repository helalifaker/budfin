import type { RevenueReadinessResponse, RevenueSettingsTab } from '@budfin/types';

export interface RevenueReadinessArea {
	key: 'feeGrid' | 'otherRevenue';
	label: string;
	tab: RevenueSettingsTab;
	ready: boolean;
}

export function getRevenueReadinessAreas(
	readiness: RevenueReadinessResponse | undefined
): RevenueReadinessArea[] {
	return [
		{
			key: 'feeGrid',
			label: 'Fee Grid',
			tab: 'feeGrid',
			ready: readiness?.feeGrid.ready ?? false,
		},
		{
			key: 'otherRevenue',
			label: 'Other Revenue',
			tab: 'otherRevenue',
			ready: readiness?.otherRevenue.ready ?? false,
		},
	];
}

export function getFirstIncompleteRevenueTab(
	readiness: RevenueReadinessResponse | undefined
): RevenueSettingsTab {
	const firstIncomplete = getRevenueReadinessAreas(readiness).find((area) => !area.ready);
	return firstIncomplete?.tab ?? 'feeGrid';
}

export function getRevenueTabReadiness(
	tab: RevenueSettingsTab,
	readiness: RevenueReadinessResponse | undefined
) {
	const areas = getRevenueReadinessAreas(readiness).filter((area) => area.tab === tab);
	const ready = areas.filter((area) => area.ready).length;
	return { ready, total: areas.length };
}

export function getRevenueValidationQueue(readiness: RevenueReadinessResponse | undefined) {
	return getRevenueReadinessAreas(readiness)
		.filter((area) => !area.ready)
		.map((area) => ({
			label: area.label,
			action: area.tab,
		}));
}
