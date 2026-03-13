import type { HistoricalHeadcountPoint } from '@budfin/types';

export interface ActualVersionCandidate {
	id: number;
	fiscalYear: number;
	status: string;
	updatedAt: Date;
}

export interface HistoricalHeadcountRow {
	versionId: number;
	academicPeriod: string;
	gradeLevel: string;
	headcount: number;
}

export interface CohortHistoryDbClient {
	budgetVersion: {
		findMany(args: {
			where: {
				type: 'Actual';
				fiscalYear: { lt: number };
			};
			select: {
				id: true;
				fiscalYear: true;
				status: true;
				updatedAt: true;
			};
			orderBy: Array<{ fiscalYear: 'desc' } | { updatedAt: 'desc' }>;
		}): Promise<ActualVersionCandidate[]>;
	};
	enrollmentHeadcount: {
		findMany(args: {
			where: {
				versionId: { in: number[] };
				academicPeriod: 'AY1';
			};
			select: {
				versionId: true;
				academicPeriod: true;
				gradeLevel: true;
				headcount: true;
			};
		}): Promise<HistoricalHeadcountRow[]>;
	};
}

export function pickCanonicalActualVersions(
	versions: ActualVersionCandidate[]
): ActualVersionCandidate[] {
	const byFiscalYear = new Map<number, ActualVersionCandidate[]>();

	for (const version of versions) {
		const entries = byFiscalYear.get(version.fiscalYear) ?? [];
		entries.push(version);
		byFiscalYear.set(version.fiscalYear, entries);
	}

	return [...byFiscalYear.entries()]
		.sort(([leftYear], [rightYear]) => rightYear - leftYear)
		.map(
			([, candidates]) =>
				[...candidates].sort((left, right) => {
					const leftRank = left.status === 'Locked' ? 0 : 1;
					const rightRank = right.status === 'Locked' ? 0 : 1;

					if (leftRank !== rightRank) {
						return leftRank - rightRank;
					}

					return right.updatedAt.getTime() - left.updatedAt.getTime();
				})[0]!
		);
}

export async function loadHistoricalAy1Headcounts(
	client: CohortHistoryDbClient,
	targetFiscalYear: number
): Promise<HistoricalHeadcountPoint[]> {
	const versionCandidates = await client.budgetVersion.findMany({
		where: {
			type: 'Actual',
			fiscalYear: { lt: targetFiscalYear },
		},
		select: {
			id: true,
			fiscalYear: true,
			status: true,
			updatedAt: true,
		},
		orderBy: [{ fiscalYear: 'desc' }, { updatedAt: 'desc' }],
	});

	const actualVersions = pickCanonicalActualVersions(versionCandidates);
	if (actualVersions.length === 0) {
		return [];
	}

	const versionFiscalYears = new Map(
		actualVersions.map((version) => [version.id, version.fiscalYear] as const)
	);
	const headcounts = await client.enrollmentHeadcount.findMany({
		where: {
			versionId: { in: actualVersions.map((version) => version.id) },
			academicPeriod: 'AY1',
		},
		select: {
			versionId: true,
			academicPeriod: true,
			gradeLevel: true,
			headcount: true,
		},
	});

	return headcounts
		.map((row) => {
			const academicYear = versionFiscalYears.get(row.versionId);
			if (!academicYear) {
				return null;
			}

			return {
				academicYear,
				gradeLevel: row.gradeLevel,
				headcount: row.headcount,
			} satisfies HistoricalHeadcountPoint;
		})
		.filter((row): row is HistoricalHeadcountPoint => row !== null);
}
