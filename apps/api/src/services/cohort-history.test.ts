import { describe, expect, it, vi } from 'vitest';
import type { CohortHistoryDbClient } from './cohort-history.js';
import { loadHistoricalAy1Headcounts, pickCanonicalActualVersions } from './cohort-history.js';

function makeMockClient(
	overrides: {
		versions?: Awaited<ReturnType<CohortHistoryDbClient['budgetVersion']['findMany']>>;
		headcounts?: Awaited<ReturnType<CohortHistoryDbClient['enrollmentHeadcount']['findMany']>>;
	} = {}
): CohortHistoryDbClient {
	return {
		budgetVersion: {
			findMany: vi.fn().mockResolvedValue(overrides.versions ?? []),
		},
		enrollmentHeadcount: {
			findMany: vi.fn().mockResolvedValue(overrides.headcounts ?? []),
		},
	};
}

describe('pickCanonicalActualVersions', () => {
	it('prefers locked Actual versions within the same fiscal year', () => {
		const versions = [
			{ id: 1, fiscalYear: 2025, status: 'Published', updatedAt: new Date('2026-03-01') },
			{ id: 2, fiscalYear: 2025, status: 'Locked', updatedAt: new Date('2026-01-01') },
		];

		const result = pickCanonicalActualVersions(versions);
		expect(result).toHaveLength(1);
		expect(result[0]!.id).toBe(2);
	});

	it('returns one canonical version per fiscal year sorted descending', () => {
		const versions = [
			{ id: 1, fiscalYear: 2024, status: 'Locked', updatedAt: new Date('2025-01-01') },
			{ id: 2, fiscalYear: 2025, status: 'Locked', updatedAt: new Date('2026-01-01') },
			{ id: 3, fiscalYear: 2023, status: 'Locked', updatedAt: new Date('2024-01-01') },
		];

		const result = pickCanonicalActualVersions(versions);
		expect(result.map((v) => v.fiscalYear)).toEqual([2025, 2024, 2023]);
	});

	it('breaks ties by most recently updated when status is the same', () => {
		const versions = [
			{ id: 1, fiscalYear: 2025, status: 'Published', updatedAt: new Date('2026-01-01') },
			{ id: 2, fiscalYear: 2025, status: 'Published', updatedAt: new Date('2026-03-01') },
		];

		const result = pickCanonicalActualVersions(versions);
		expect(result).toHaveLength(1);
		expect(result[0]!.id).toBe(2);
	});

	it('returns empty array for empty input', () => {
		expect(pickCanonicalActualVersions([])).toEqual([]);
	});
});

describe('loadHistoricalAy1Headcounts', () => {
	it('returns empty array when no actual versions exist', async () => {
		const client = makeMockClient({ versions: [] });
		const result = await loadHistoricalAy1Headcounts(client, 2026);

		expect(result).toEqual([]);
		expect(client.enrollmentHeadcount.findMany).not.toHaveBeenCalled();
	});

	it('loads headcounts from canonical actual versions', async () => {
		const client = makeMockClient({
			versions: [
				{ id: 10, fiscalYear: 2025, status: 'Locked', updatedAt: new Date('2026-01-01') },
				{ id: 11, fiscalYear: 2024, status: 'Locked', updatedAt: new Date('2025-01-01') },
			],
			headcounts: [
				{ versionId: 10, academicPeriod: 'AY1', gradeLevel: 'PS', headcount: 90 },
				{ versionId: 10, academicPeriod: 'AY1', gradeLevel: 'MS', headcount: 85 },
				{ versionId: 11, academicPeriod: 'AY1', gradeLevel: 'PS', headcount: 80 },
			],
		});

		const result = await loadHistoricalAy1Headcounts(client, 2026);

		expect(result).toEqual([
			{ academicYear: 2025, gradeLevel: 'PS', headcount: 90 },
			{ academicYear: 2025, gradeLevel: 'MS', headcount: 85 },
			{ academicYear: 2024, gradeLevel: 'PS', headcount: 80 },
		]);

		expect(client.budgetVersion.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { type: 'Actual', fiscalYear: { lt: 2026 } },
			})
		);
	});

	it('filters out headcount rows with no matching version fiscal year', async () => {
		const client = makeMockClient({
			versions: [{ id: 10, fiscalYear: 2025, status: 'Locked', updatedAt: new Date('2026-01-01') }],
			headcounts: [
				{ versionId: 10, academicPeriod: 'AY1', gradeLevel: 'PS', headcount: 90 },
				{ versionId: 999, academicPeriod: 'AY1', gradeLevel: 'PS', headcount: 50 },
			],
		});

		const result = await loadHistoricalAy1Headcounts(client, 2026);

		expect(result).toEqual([{ academicYear: 2025, gradeLevel: 'PS', headcount: 90 }]);
	});

	it('deduplicates versions per fiscal year before querying headcounts', async () => {
		const client = makeMockClient({
			versions: [
				{ id: 10, fiscalYear: 2025, status: 'Locked', updatedAt: new Date('2026-01-01') },
				{ id: 11, fiscalYear: 2025, status: 'Published', updatedAt: new Date('2026-02-01') },
			],
			headcounts: [{ versionId: 10, academicPeriod: 'AY1', gradeLevel: 'PS', headcount: 90 }],
		});

		const result = await loadHistoricalAy1Headcounts(client, 2026);

		expect(result).toHaveLength(1);
		expect(result[0]!.academicYear).toBe(2025);

		const findManyCall = (client.enrollmentHeadcount.findMany as ReturnType<typeof vi.fn>).mock
			.calls[0]![0];
		expect(findManyCall.where.versionId.in).toEqual([10]);
	});
});
