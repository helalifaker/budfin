import type {
	StaffingSettingsResponse,
	CostAssumptionsResponse,
	LyceeGroupAssumptionsResponse,
} from '../hooks/use-staffing';

export interface ReadinessArea {
	key: string;
	label: string;
	ready: boolean;
}

export interface StaffingReadiness {
	areas: ReadinessArea[];
	readyCount: number;
	totalCount: number;
	overallReady: boolean;
}

export function deriveStaffingReadiness({
	settingsData,
	costAssumptionsData,
	hasEnrollment,
	lyceeGroupData,
	hasGroupDriverRules,
}: {
	settingsData: StaffingSettingsResponse | undefined;
	costAssumptionsData: CostAssumptionsResponse | undefined;
	hasEnrollment: boolean;
	lyceeGroupData: LyceeGroupAssumptionsResponse | undefined;
	hasGroupDriverRules: boolean;
}): StaffingReadiness {
	const areas: ReadinessArea[] = [
		{
			key: 'profiles',
			label: 'Service Profiles & ORS',
			ready: settingsData?.data !== undefined,
		},
		{
			key: 'costAssumptions',
			label: 'Cost Assumptions',
			ready: (costAssumptionsData?.data ?? []).length > 0,
		},
		{
			key: 'curriculum',
			label: 'Curriculum',
			// Placeholder: always ready. Curriculum readiness check will be implemented
			// when the curriculum validation engine is wired up.
			ready: true,
		},
		{
			key: 'enrollment',
			label: 'Enrollment',
			ready: hasEnrollment,
		},
	];

	if (hasGroupDriverRules) {
		areas.push({
			key: 'lyceeGroups',
			label: 'Lycee Groups',
			ready: (lyceeGroupData?.data ?? []).length > 0,
		});
	}

	areas.push({
		key: 'reconciliation',
		label: 'Reconciliation',
		// Placeholder: always ready. Reconciliation readiness check will be implemented
		// when the reconciliation workflow is built.
		ready: true,
	});

	const readyCount = areas.filter((a) => a.ready).length;

	return {
		areas,
		readyCount,
		totalCount: areas.length,
		overallReady: readyCount === areas.length,
	};
}
