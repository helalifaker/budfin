import { describe, expect, it } from 'vitest';
import { deriveStaffingReadiness } from './staffing-readiness';
import type {
	StaffingSettingsResponse,
	CostAssumptionsResponse,
	LyceeGroupAssumptionsResponse,
} from '../hooks/use-staffing';

function makeSettingsData(): StaffingSettingsResponse {
	return { data: {} as StaffingSettingsResponse['data'] };
}

function makeCostAssumptions(count: number): CostAssumptionsResponse {
	return {
		data: Array.from({ length: count }, (_, i) => ({
			id: i + 1,
			versionId: 1,
			category: `CAT_${i}`,
			calculationMode: 'PERCENT_OF_PAYROLL',
			value: '0.10',
			excludeSummerMonths: false,
		})),
	};
}

function makeLyceeGroupData(count: number): LyceeGroupAssumptionsResponse {
	return {
		data: Array.from({ length: count }, (_, i) => ({
			disciplineCode: `DISC_${i}`,
			groupCount: 2,
			hoursPerGroup: '4.0',
		})),
	};
}

describe('deriveStaffingReadiness', () => {
	it('returns all areas with correct ready states when all data is provided', () => {
		const result = deriveStaffingReadiness({
			settingsData: makeSettingsData(),
			costAssumptionsData: makeCostAssumptions(3),
			hasEnrollment: true,
			lyceeGroupData: makeLyceeGroupData(2),
			hasGroupDriverRules: false,
			teachingRequirementSourceCount: 5,
			staleModules: [],
		});

		expect(result.areas).toHaveLength(5);
		expect(result.areas.map((a) => a.key)).toEqual([
			'profiles',
			'costAssumptions',
			'curriculum',
			'enrollment',
			'reconciliation',
		]);
		expect(result.areas.every((a) => a.ready)).toBe(true);
		expect(result.overallReady).toBe(true);
		expect(result.readyCount).toBe(5);
		expect(result.totalCount).toBe(5);
	});

	it('returns not ready when settingsData is undefined', () => {
		const result = deriveStaffingReadiness({
			settingsData: undefined,
			costAssumptionsData: makeCostAssumptions(1),
			hasEnrollment: true,
			lyceeGroupData: undefined,
			hasGroupDriverRules: false,
			teachingRequirementSourceCount: 1,
			staleModules: [],
		});

		const profilesArea = result.areas.find((a) => a.key === 'profiles');
		expect(profilesArea?.ready).toBe(false);
		expect(result.overallReady).toBe(false);
	});

	it('returns not ready when costAssumptionsData is empty', () => {
		const result = deriveStaffingReadiness({
			settingsData: makeSettingsData(),
			costAssumptionsData: makeCostAssumptions(0),
			hasEnrollment: true,
			lyceeGroupData: undefined,
			hasGroupDriverRules: false,
			teachingRequirementSourceCount: 1,
			staleModules: [],
		});

		const costArea = result.areas.find((a) => a.key === 'costAssumptions');
		expect(costArea?.ready).toBe(false);
		expect(result.overallReady).toBe(false);
	});

	it('returns not ready when costAssumptionsData is undefined', () => {
		const result = deriveStaffingReadiness({
			settingsData: makeSettingsData(),
			costAssumptionsData: undefined,
			hasEnrollment: true,
			lyceeGroupData: undefined,
			hasGroupDriverRules: false,
			teachingRequirementSourceCount: 1,
			staleModules: [],
		});

		const costArea = result.areas.find((a) => a.key === 'costAssumptions');
		expect(costArea?.ready).toBe(false);
		expect(result.overallReady).toBe(false);
	});

	it('includes lyceeGroups area only when hasGroupDriverRules is true', () => {
		const withGroups = deriveStaffingReadiness({
			settingsData: makeSettingsData(),
			costAssumptionsData: makeCostAssumptions(1),
			hasEnrollment: true,
			lyceeGroupData: makeLyceeGroupData(2),
			hasGroupDriverRules: true,
			teachingRequirementSourceCount: 1,
			staleModules: [],
		});

		expect(withGroups.areas.find((a) => a.key === 'lyceeGroups')).toBeDefined();
		expect(withGroups.areas).toHaveLength(6);
		expect(withGroups.totalCount).toBe(6);
	});

	it('does not include lyceeGroups area when hasGroupDriverRules is false', () => {
		const withoutGroups = deriveStaffingReadiness({
			settingsData: makeSettingsData(),
			costAssumptionsData: makeCostAssumptions(1),
			hasEnrollment: true,
			lyceeGroupData: makeLyceeGroupData(2),
			hasGroupDriverRules: false,
			teachingRequirementSourceCount: 1,
			staleModules: [],
		});

		expect(withoutGroups.areas.find((a) => a.key === 'lyceeGroups')).toBeUndefined();
		expect(withoutGroups.areas).toHaveLength(5);
	});

	it('marks lyceeGroups not ready when lyceeGroupData is empty', () => {
		const result = deriveStaffingReadiness({
			settingsData: makeSettingsData(),
			costAssumptionsData: makeCostAssumptions(1),
			hasEnrollment: true,
			lyceeGroupData: makeLyceeGroupData(0),
			hasGroupDriverRules: true,
			teachingRequirementSourceCount: 1,
			staleModules: [],
		});

		const lyceeArea = result.areas.find((a) => a.key === 'lyceeGroups');
		expect(lyceeArea?.ready).toBe(false);
		expect(result.overallReady).toBe(false);
	});

	it('marks lyceeGroups not ready when lyceeGroupData is undefined', () => {
		const result = deriveStaffingReadiness({
			settingsData: makeSettingsData(),
			costAssumptionsData: makeCostAssumptions(1),
			hasEnrollment: true,
			lyceeGroupData: undefined,
			hasGroupDriverRules: true,
			teachingRequirementSourceCount: 1,
			staleModules: [],
		});

		const lyceeArea = result.areas.find((a) => a.key === 'lyceeGroups');
		expect(lyceeArea?.ready).toBe(false);
	});

	it('returns overallReady true only when ALL areas are ready', () => {
		const allReady = deriveStaffingReadiness({
			settingsData: makeSettingsData(),
			costAssumptionsData: makeCostAssumptions(1),
			hasEnrollment: true,
			lyceeGroupData: undefined,
			hasGroupDriverRules: false,
			teachingRequirementSourceCount: 1,
			staleModules: [],
		});
		expect(allReady.overallReady).toBe(true);
		expect(allReady.readyCount).toBe(allReady.totalCount);

		const notAllReady = deriveStaffingReadiness({
			settingsData: undefined,
			costAssumptionsData: makeCostAssumptions(1),
			hasEnrollment: true,
			lyceeGroupData: undefined,
			hasGroupDriverRules: false,
			teachingRequirementSourceCount: 1,
			staleModules: [],
		});
		expect(notAllReady.overallReady).toBe(false);
		expect(notAllReady.readyCount).toBeLessThan(notAllReady.totalCount);
	});

	it('handles partially ready state correctly', () => {
		const result = deriveStaffingReadiness({
			settingsData: makeSettingsData(),
			costAssumptionsData: makeCostAssumptions(0),
			hasEnrollment: false,
			lyceeGroupData: undefined,
			hasGroupDriverRules: false,
			teachingRequirementSourceCount: 1,
			staleModules: [],
		});

		// profiles: ready, costAssumptions: not ready, curriculum: ready (sources exist),
		// enrollment: not ready, reconciliation: ready (not stale)
		expect(result.readyCount).toBe(3);
		expect(result.totalCount).toBe(5);
		expect(result.overallReady).toBe(false);

		const readyKeys = result.areas.filter((a) => a.ready).map((a) => a.key);
		expect(readyKeys).toEqual(['profiles', 'curriculum', 'reconciliation']);

		const notReadyKeys = result.areas.filter((a) => !a.ready).map((a) => a.key);
		expect(notReadyKeys).toEqual(['costAssumptions', 'enrollment']);
	});

	it('places reconciliation as the last area', () => {
		const result = deriveStaffingReadiness({
			settingsData: makeSettingsData(),
			costAssumptionsData: makeCostAssumptions(1),
			hasEnrollment: true,
			lyceeGroupData: makeLyceeGroupData(1),
			hasGroupDriverRules: true,
			teachingRequirementSourceCount: 1,
			staleModules: [],
		});

		const lastArea = result.areas[result.areas.length - 1];
		expect(lastArea?.key).toBe('reconciliation');
	});

	it('places lyceeGroups before reconciliation when present', () => {
		const result = deriveStaffingReadiness({
			settingsData: makeSettingsData(),
			costAssumptionsData: makeCostAssumptions(1),
			hasEnrollment: true,
			lyceeGroupData: makeLyceeGroupData(1),
			hasGroupDriverRules: true,
			teachingRequirementSourceCount: 1,
			staleModules: [],
		});

		const keys = result.areas.map((a) => a.key);
		const lyceeIdx = keys.indexOf('lyceeGroups');
		const reconIdx = keys.indexOf('reconciliation');
		expect(lyceeIdx).toBeLessThan(reconIdx);
		expect(lyceeIdx).toBe(keys.length - 2);
	});

	// ── Curriculum readiness tests ──────────────────────────────────────────

	it('marks curriculum not ready when teachingRequirementSourceCount is 0', () => {
		const result = deriveStaffingReadiness({
			settingsData: makeSettingsData(),
			costAssumptionsData: makeCostAssumptions(1),
			hasEnrollment: true,
			lyceeGroupData: undefined,
			hasGroupDriverRules: false,
			teachingRequirementSourceCount: 0,
			staleModules: [],
		});

		const curriculumArea = result.areas.find((a) => a.key === 'curriculum');
		expect(curriculumArea?.ready).toBe(false);
		expect(result.overallReady).toBe(false);
	});

	it('marks curriculum ready when teachingRequirementSourceCount is undefined (loading)', () => {
		const result = deriveStaffingReadiness({
			settingsData: makeSettingsData(),
			costAssumptionsData: makeCostAssumptions(1),
			hasEnrollment: true,
			lyceeGroupData: undefined,
			hasGroupDriverRules: false,
			teachingRequirementSourceCount: undefined,
			staleModules: [],
		});

		const curriculumArea = result.areas.find((a) => a.key === 'curriculum');
		expect(curriculumArea?.ready).toBe(true);
	});

	it('marks curriculum ready when teachingRequirementSourceCount > 0', () => {
		const result = deriveStaffingReadiness({
			settingsData: makeSettingsData(),
			costAssumptionsData: makeCostAssumptions(1),
			hasEnrollment: true,
			lyceeGroupData: undefined,
			hasGroupDriverRules: false,
			teachingRequirementSourceCount: 3,
			staleModules: [],
		});

		const curriculumArea = result.areas.find((a) => a.key === 'curriculum');
		expect(curriculumArea?.ready).toBe(true);
	});

	// ── Reconciliation readiness tests ──────────────────────────────────────

	it('marks reconciliation not ready when STAFFING is in staleModules', () => {
		const result = deriveStaffingReadiness({
			settingsData: makeSettingsData(),
			costAssumptionsData: makeCostAssumptions(1),
			hasEnrollment: true,
			lyceeGroupData: undefined,
			hasGroupDriverRules: false,
			teachingRequirementSourceCount: 1,
			staleModules: ['STAFFING'],
		});

		const reconArea = result.areas.find((a) => a.key === 'reconciliation');
		expect(reconArea?.ready).toBe(false);
		expect(result.overallReady).toBe(false);
	});

	it('marks reconciliation ready when STAFFING is not in staleModules', () => {
		const result = deriveStaffingReadiness({
			settingsData: makeSettingsData(),
			costAssumptionsData: makeCostAssumptions(1),
			hasEnrollment: true,
			lyceeGroupData: undefined,
			hasGroupDriverRules: false,
			teachingRequirementSourceCount: 1,
			staleModules: ['REVENUE', 'PNL'],
		});

		const reconArea = result.areas.find((a) => a.key === 'reconciliation');
		expect(reconArea?.ready).toBe(true);
	});
});
