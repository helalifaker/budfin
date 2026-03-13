import { describe, expect, it } from 'vitest';
import {
	buildCohortRecommendations,
	buildHistoricalCohortObservations,
	pickCanonicalActualVersions,
} from './cohort-recommendations.js';

describe('pickCanonicalActualVersions', () => {
	it('prefers locked Actual versions within the same fiscal year', () => {
		const actualVersions = pickCanonicalActualVersions([
			{
				id: 11,
				fiscalYear: 2025,
				status: 'Published',
				updatedAt: new Date('2026-01-05T00:00:00Z'),
			},
			{
				id: 10,
				fiscalYear: 2025,
				status: 'Locked',
				updatedAt: new Date('2025-12-31T00:00:00Z'),
			},
		]);

		expect(actualVersions).toEqual([expect.objectContaining({ id: 10, fiscalYear: 2025 })]);
	});
});

describe('buildHistoricalCohortObservations', () => {
	it('uses 97% retention when the historical rollover is at least 105%', () => {
		const observations = buildHistoricalCohortObservations({
			headcounts: [
				{ versionId: 1, academicPeriod: 'AY1', gradeLevel: 'GS', headcount: 94 },
				{ versionId: 1, academicPeriod: 'AY2', gradeLevel: 'CP', headcount: 111 },
			],
			versionFiscalYears: new Map([[1, 2024]]),
			planningRules: {
				rolloverThreshold: 1.05,
				cappedRetention: 0.97,
				retentionRecentWeight: 0.6,
				historicalTargetRecentWeight: 0.8,
			},
		});

		expect(observations).toEqual([
			expect.objectContaining({
				gradeLevel: 'CP',
				fiscalYear: 2024,
				rolloverRatio: 1.1809,
				recommendedRetentionRate: 0.97,
				recommendedLateralEntryCount: 20,
				rule: 'capped-retention-growth',
			}),
		]);
	});

	it('uses the latest historical rollover directly when it is below 105%', () => {
		const observations = buildHistoricalCohortObservations({
			headcounts: [
				{ versionId: 1, academicPeriod: 'AY1', gradeLevel: '3EME', headcount: 140 },
				{ versionId: 1, academicPeriod: 'AY2', gradeLevel: '2NDE', headcount: 122 },
			],
			versionFiscalYears: new Map([[1, 2025]]),
			planningRules: {
				rolloverThreshold: 1.05,
				cappedRetention: 0.97,
				retentionRecentWeight: 0.6,
				historicalTargetRecentWeight: 0.8,
			},
		});

		expect(observations).toEqual([
			expect.objectContaining({
				gradeLevel: '2NDE',
				fiscalYear: 2025,
				rolloverRatio: 0.8714,
				recommendedRetentionRate: 0.8715,
				recommendedLateralEntryCount: 0,
				rule: 'historical-rollover',
			}),
		]);
	});

	it('splits small rollover gains into full retention plus historical laterals', () => {
		const observations = buildHistoricalCohortObservations({
			headcounts: [
				{ versionId: 1, academicPeriod: 'AY1', gradeLevel: 'CM2', headcount: 122 },
				{ versionId: 1, academicPeriod: 'AY2', gradeLevel: '6EME', headcount: 128 },
			],
			versionFiscalYears: new Map([[1, 2025]]),
			planningRules: {
				rolloverThreshold: 1.05,
				cappedRetention: 0.97,
				retentionRecentWeight: 0.6,
				historicalTargetRecentWeight: 0.8,
			},
		});

		expect(observations).toEqual([
			expect.objectContaining({
				gradeLevel: '6EME',
				fiscalYear: 2025,
				rolloverRatio: 1.0492,
				recommendedRetentionRate: 1,
				recommendedLateralEntryCount: 6,
				rule: 'historical-rollover',
			}),
		]);
	});
});

describe('buildCohortRecommendations', () => {
	it('picks the latest usable observation per grade and derives confidence from depth', () => {
		const recommendations = buildCohortRecommendations([
			{
				gradeLevel: 'CE1',
				fiscalYear: 2025,
				priorAy1Headcount: 111,
				ay2Headcount: 110,
				rolloverRatio: 0.991,
				recommendedRetentionRate: 0.991,
				recommendedLateralEntryCount: 0,
				rule: 'historical-rollover',
			},
			{
				gradeLevel: 'CE1',
				fiscalYear: 2024,
				priorAy1Headcount: 98,
				ay2Headcount: 113,
				rolloverRatio: 1.1531,
				recommendedRetentionRate: 0.97,
				recommendedLateralEntryCount: 18,
				rule: 'capped-retention-growth',
			},
			{
				gradeLevel: 'CE1',
				fiscalYear: 2023,
				priorAy1Headcount: 93,
				ay2Headcount: 100,
				rolloverRatio: 1.0753,
				recommendedRetentionRate: 0.97,
				recommendedLateralEntryCount: 10,
				rule: 'capped-retention-growth',
			},
		]);

		const ce1 = recommendations.find((entry) => entry.gradeLevel === 'CE1');
		const ps = recommendations.find((entry) => entry.gradeLevel === 'PS');

		expect(ce1).toEqual(
			expect.objectContaining({
				recommendedRetentionRate: 0.991,
				recommendedLateralEntryCount: 0,
				confidence: 'high',
				observationCount: 3,
				sourceFiscalYear: 2025,
				recommendationPriorAy1Headcount: 111,
				recommendationAy2Headcount: 110,
				rule: 'historical-rollover',
			})
		);
		expect(ps).toEqual(
			expect.objectContaining({
				recommendedRetentionRate: 0,
				recommendedLateralEntryCount: 0,
				rule: 'direct-entry',
			})
		);
	});
});
