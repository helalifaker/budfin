/**
 * Story #53 — Version Clone API
 * Story 19-7 — Version Clone: Staffing Tables Support
 *
 * POST /api/v1/versions/:id/clone
 *
 * AC-11: Admin/BudgetOwner can clone Budget/Forecast -> new Draft
 *        with sourceVersionId + deep copy of enrollment data
 * AC-12: Clone on Actual version -> 409 ACTUAL_VERSION_CLONE_PROHIBITED
 * AC-19 (partial): Editor/Viewer -> 403 on POST /clone
 * Duplicate name -> 409 DUPLICATE_VERSION_NAME
 *
 * Story 19-7 ACs:
 * AC-01: VersionStaffingSettings deep-copied
 * AC-02: VersionServiceProfileOverride rows copied
 * AC-03: VersionStaffingCostAssumption rows copied
 * AC-04: VersionLyceeGroupAssumption rows copied
 * AC-05: StaffingAssignment rows copied with employeeId remapped
 * AC-06: DemandOverride rows copied
 * AC-07: STAFFING added to staleModules
 * AC-08: Derived outputs NOT copied
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { generateKeyPair } from 'jose';
import { Prisma } from '@prisma/client';
import { setKeys, signAccessToken } from '../services/token.js';
import { auth } from '../plugins/auth.js';
import { versionRoutes } from './versions.js';

vi.mock('../lib/prisma.js', () => {
	const mockPrisma = {
		budgetVersion: {
			findUnique: vi.fn(),
			create: vi.fn(),
		},
		enrollmentHeadcount: {
			findMany: vi.fn().mockResolvedValue([]),
			createMany: vi.fn().mockResolvedValue({ count: 0 }),
		},
		enrollmentDetail: {
			findMany: vi.fn().mockResolvedValue([]),
			createMany: vi.fn().mockResolvedValue({ count: 0 }),
		},
		monthlyBudgetSummary: {
			findMany: vi.fn().mockResolvedValue([]),
			createMany: vi.fn().mockResolvedValue({ count: 0 }),
		},
		versionRevenueSettings: {
			findUnique: vi.fn().mockResolvedValue(null),
			create: vi.fn().mockResolvedValue({ id: 1 }),
		},
		otherRevenueItem: {
			findMany: vi.fn().mockResolvedValue([]),
			createMany: vi.fn().mockResolvedValue({ count: 14 }),
		},
		gradeLevel: {
			findMany: vi.fn().mockResolvedValue([
				{
					gradeCode: 'PS',
					maxClassSize: 25,
					plancherPct: '0.7000',
					ciblePct: '0.8000',
					plafondPct: '1.0000',
				},
				{
					gradeCode: 'CP',
					maxClassSize: 28,
					plancherPct: '0.7500',
					ciblePct: '0.8500',
					plafondPct: '1.0000',
				},
			]),
		},
		auditEntry: {
			create: vi.fn().mockResolvedValue({ id: 1 }),
		},
		cohortParameter: {
			findMany: vi.fn().mockResolvedValue([]),
			createMany: vi.fn().mockResolvedValue({ count: 0 }),
		},
		nationalityBreakdown: {
			findMany: vi.fn().mockResolvedValue([]),
			createMany: vi.fn().mockResolvedValue({ count: 0 }),
		},
		versionCapacityConfig: {
			findMany: vi.fn().mockResolvedValue([]),
			createMany: vi.fn().mockResolvedValue({ count: 0 }),
		},
		// Story 19-7: Staffing table mocks
		versionStaffingSettings: {
			findUnique: vi.fn().mockResolvedValue(null),
			create: vi.fn().mockResolvedValue({ id: 1 }),
		},
		versionServiceProfileOverride: {
			findMany: vi.fn().mockResolvedValue([]),
			createMany: vi.fn().mockResolvedValue({ count: 0 }),
		},
		versionStaffingCostAssumption: {
			findMany: vi.fn().mockResolvedValue([]),
			createMany: vi.fn().mockResolvedValue({ count: 0 }),
		},
		versionLyceeGroupAssumption: {
			findMany: vi.fn().mockResolvedValue([]),
			createMany: vi.fn().mockResolvedValue({ count: 0 }),
		},
		staffingAssignment: {
			findMany: vi.fn().mockResolvedValue([]),
			createMany: vi.fn().mockResolvedValue({ count: 0 }),
		},
		demandOverride: {
			findMany: vi.fn().mockResolvedValue([]),
			createMany: vi.fn().mockResolvedValue({ count: 0 }),
		},
		$queryRaw: vi.fn().mockResolvedValue([]),
		$transaction: vi.fn().mockImplementation((fn: (tx: Record<string, unknown>) => unknown) =>
			fn({
				budgetVersion: mockPrisma.budgetVersion,
				enrollmentHeadcount: mockPrisma.enrollmentHeadcount,
				enrollmentDetail: mockPrisma.enrollmentDetail,
				monthlyBudgetSummary: mockPrisma.monthlyBudgetSummary,
				versionRevenueSettings: mockPrisma.versionRevenueSettings,
				otherRevenueItem: mockPrisma.otherRevenueItem,
				gradeLevel: mockPrisma.gradeLevel,
				auditEntry: mockPrisma.auditEntry,
				cohortParameter: mockPrisma.cohortParameter,
				nationalityBreakdown: mockPrisma.nationalityBreakdown,
				versionCapacityConfig: mockPrisma.versionCapacityConfig,
				// Story 19-7 staffing tables
				versionStaffingSettings: mockPrisma.versionStaffingSettings,
				versionServiceProfileOverride: mockPrisma.versionServiceProfileOverride,
				versionStaffingCostAssumption: mockPrisma.versionStaffingCostAssumption,
				versionLyceeGroupAssumption: mockPrisma.versionLyceeGroupAssumption,
				staffingAssignment: mockPrisma.staffingAssignment,
				demandOverride: mockPrisma.demandOverride,
				$queryRaw: mockPrisma.$queryRaw,
			})
		),
	};
	return { prisma: mockPrisma };
});

import { prisma } from '../lib/prisma.js';

const mockPrisma = prisma as unknown as {
	budgetVersion: {
		findUnique: ReturnType<typeof vi.fn>;
		create: ReturnType<typeof vi.fn>;
	};
	enrollmentHeadcount: {
		findMany: ReturnType<typeof vi.fn>;
		createMany: ReturnType<typeof vi.fn>;
	};
	enrollmentDetail: {
		findMany: ReturnType<typeof vi.fn>;
		createMany: ReturnType<typeof vi.fn>;
	};
	monthlyBudgetSummary: {
		findMany: ReturnType<typeof vi.fn>;
		createMany: ReturnType<typeof vi.fn>;
	};
	versionRevenueSettings: {
		findUnique: ReturnType<typeof vi.fn>;
		create: ReturnType<typeof vi.fn>;
	};
	otherRevenueItem: {
		findMany: ReturnType<typeof vi.fn>;
		createMany: ReturnType<typeof vi.fn>;
	};
	gradeLevel: {
		findMany: ReturnType<typeof vi.fn>;
	};
	auditEntry: { create: ReturnType<typeof vi.fn> };
	cohortParameter: {
		findMany: ReturnType<typeof vi.fn>;
		createMany: ReturnType<typeof vi.fn>;
	};
	nationalityBreakdown: {
		findMany: ReturnType<typeof vi.fn>;
		createMany: ReturnType<typeof vi.fn>;
	};
	versionCapacityConfig: {
		findMany: ReturnType<typeof vi.fn>;
		createMany: ReturnType<typeof vi.fn>;
	};
	// Story 19-7 staffing tables
	versionStaffingSettings: {
		findUnique: ReturnType<typeof vi.fn>;
		create: ReturnType<typeof vi.fn>;
	};
	versionServiceProfileOverride: {
		findMany: ReturnType<typeof vi.fn>;
		createMany: ReturnType<typeof vi.fn>;
	};
	versionStaffingCostAssumption: {
		findMany: ReturnType<typeof vi.fn>;
		createMany: ReturnType<typeof vi.fn>;
	};
	versionLyceeGroupAssumption: {
		findMany: ReturnType<typeof vi.fn>;
		createMany: ReturnType<typeof vi.fn>;
	};
	staffingAssignment: {
		findMany: ReturnType<typeof vi.fn>;
		createMany: ReturnType<typeof vi.fn>;
	};
	demandOverride: {
		findMany: ReturnType<typeof vi.fn>;
		createMany: ReturnType<typeof vi.fn>;
	};
	$queryRaw: ReturnType<typeof vi.fn>;
	$transaction: ReturnType<typeof vi.fn>;
};

let app: FastifyInstance;
const now = new Date();

async function makeToken(overrides: { sub?: number; role?: string } = {}) {
	return signAccessToken({
		sub: overrides.sub ?? 1,
		email: 'admin@budfin.app',
		role: overrides.role ?? 'Admin',
		sessionId: 'test-session-id',
	});
}

function authHeader(token: string) {
	return { authorization: `Bearer ${token}` };
}

function makeVersion(overrides: Record<string, unknown> = {}) {
	return {
		id: 1,
		fiscalYear: 2026,
		name: 'Budget v1',
		type: 'Budget',
		status: 'Draft',
		description: null,
		dataSource: 'CALCULATED',
		sourceVersionId: null,
		modificationCount: 0,
		staleModules: [],
		rolloverThreshold: '1.0000',
		cappedRetention: '0.9800',
		createdById: 1,
		publishedAt: null,
		lockedAt: null,
		archivedAt: null,
		createdAt: now,
		updatedAt: now,
		createdBy: { email: 'admin@budfin.app' },
		...overrides,
	};
}

beforeAll(async () => {
	const keys = await generateKeyPair('RS256');
	setKeys(keys.privateKey, keys.publicKey);
});

beforeEach(async () => {
	vi.clearAllMocks();
	app = Fastify();
	app.setValidatorCompiler(validatorCompiler);
	app.setSerializerCompiler(serializerCompiler);
	await app.register(auth);
	await app.register(versionRoutes, { prefix: '/api/v1/versions' });
	await app.ready();
});

// ── AC-11: Successful clone ─────────────────────────────────────────

describe('POST /api/v1/versions/:id/clone', () => {
	it('AC-11: Admin clones Budget version -> 201 with sourceVersionId and Draft status', async () => {
		const source = makeVersion({
			id: 1,
			type: 'Budget',
			status: 'Published',
		});
		const cloned = makeVersion({
			id: 2,
			name: 'Budget v1 Clone',
			status: 'Draft',
			sourceVersionId: 1,
			createdBy: { email: 'admin@budfin.app' },
		});
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(source);
		mockPrisma.budgetVersion.create.mockResolvedValue(cloned);

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/versions/1/clone',
			headers: authHeader(token),
			payload: { name: 'Budget v1 Clone' },
		});

		expect(res.statusCode).toBe(201);
		const body = res.json();
		expect(body.status).toBe('Draft');
		expect(body.sourceVersionId).toBe(1);
		expect(body.name).toBe('Budget v1 Clone');
	});

	it('AC-11: BudgetOwner can clone Forecast version', async () => {
		const source = makeVersion({
			id: 1,
			type: 'Forecast',
			status: 'Draft',
		});
		const cloned = makeVersion({
			id: 2,
			name: 'Forecast Clone',
			type: 'Forecast',
			status: 'Draft',
			sourceVersionId: 1,
			createdBy: { email: 'admin@budfin.app' },
		});
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(source);
		mockPrisma.budgetVersion.create.mockResolvedValue(cloned);

		const token = await makeToken({ role: 'BudgetOwner' });
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/versions/1/clone',
			headers: authHeader(token),
			payload: { name: 'Forecast Clone' },
		});

		expect(res.statusCode).toBe(201);
	});

	it('AC-11: clone copies enrollmentHeadcount rows', async () => {
		const source = makeVersion({ id: 1 });
		const headcounts = [
			{
				id: 10,
				versionId: 1,
				academicPeriod: 'AY1',
				gradeLevel: 'CP',
				headcount: 25,
				createdBy: 1,
			},
			{
				id: 11,
				versionId: 1,
				academicPeriod: 'AY1',
				gradeLevel: 'CE1',
				headcount: 30,
				createdBy: 1,
			},
		];
		const cloned = makeVersion({
			id: 2,
			name: 'Budget Clone',
			sourceVersionId: 1,
			createdBy: { email: 'admin@budfin.app' },
		});

		mockPrisma.budgetVersion.findUnique.mockResolvedValue(source);
		mockPrisma.enrollmentHeadcount.findMany.mockResolvedValue(headcounts);
		mockPrisma.budgetVersion.create.mockResolvedValue(cloned);

		const token = await makeToken({ role: 'Admin' });
		await app.inject({
			method: 'POST',
			url: '/api/v1/versions/1/clone',
			headers: authHeader(token),
			payload: { name: 'Budget Clone' },
		});

		expect(mockPrisma.enrollmentHeadcount.createMany).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.arrayContaining([
					expect.objectContaining({
						gradeLevel: 'CP',
						versionId: 2,
					}),
					expect.objectContaining({
						gradeLevel: 'CE1',
						versionId: 2,
					}),
				]),
			})
		);
	});

	it('AC-11: clone copies enrollmentDetail rows', async () => {
		const source = makeVersion({ id: 1 });
		const details = [
			{
				id: 20,
				versionId: 1,
				academicPeriod: 'AY1',
				gradeLevel: 'CP',
				nationality: 'Francais',
				tariff: 'RP',
				headcount: 15,
				createdBy: 1,
			},
		];
		const cloned = makeVersion({
			id: 2,
			name: 'Detail Clone',
			sourceVersionId: 1,
			createdBy: { email: 'admin@budfin.app' },
		});

		mockPrisma.budgetVersion.findUnique.mockResolvedValue(source);
		mockPrisma.enrollmentDetail.findMany.mockResolvedValue(details);
		mockPrisma.budgetVersion.create.mockResolvedValue(cloned);

		const token = await makeToken({ role: 'Admin' });
		await app.inject({
			method: 'POST',
			url: '/api/v1/versions/1/clone',
			headers: authHeader(token),
			payload: { name: 'Detail Clone' },
		});

		expect(mockPrisma.enrollmentDetail.createMany).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.arrayContaining([
					expect.objectContaining({
						gradeLevel: 'CP',
						nationality: 'Francais',
						versionId: 2,
					}),
				]),
			})
		);
	});

	it('AC-07: clone sets staleModules to ENROLLMENT and STAFFING', async () => {
		const source = makeVersion({ id: 1 });
		const cloned = makeVersion({
			id: 2,
			name: 'Stale Clone',
			sourceVersionId: 1,
			staleModules: ['ENROLLMENT', 'STAFFING'],
			createdBy: { email: 'admin@budfin.app' },
		});

		mockPrisma.budgetVersion.findUnique.mockResolvedValue(source);
		mockPrisma.budgetVersion.create.mockResolvedValue(cloned);

		const token = await makeToken({ role: 'Admin' });
		await app.inject({
			method: 'POST',
			url: '/api/v1/versions/1/clone',
			headers: authHeader(token),
			payload: { name: 'Stale Clone' },
		});

		expect(mockPrisma.budgetVersion.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					staleModules: ['ENROLLMENT', 'STAFFING'],
				}),
			})
		);
	});

	it('AC-11: writes audit entry for VERSION_CLONED', async () => {
		const source = makeVersion({ id: 1 });
		const cloned = makeVersion({
			id: 2,
			name: 'Clone',
			sourceVersionId: 1,
			createdBy: { email: 'admin@budfin.app' },
		});
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(source);
		mockPrisma.budgetVersion.create.mockResolvedValue(cloned);

		const token = await makeToken({ role: 'Admin' });
		await app.inject({
			method: 'POST',
			url: '/api/v1/versions/1/clone',
			headers: authHeader(token),
			payload: { name: 'Clone' },
		});

		expect(mockPrisma.auditEntry.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					operation: 'VERSION_CLONED',
				}),
			})
		);
	});

	// AC-12: Actual version clone prohibited
	it('AC-12: clone of Actual version -> 409 ACTUAL_VERSION_CLONE_PROHIBITED', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(makeVersion({ type: 'Actual' }));

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/versions/1/clone',
			headers: authHeader(token),
			payload: { name: 'Actual Clone' },
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('ACTUAL_VERSION_CLONE_PROHIBITED');
	});

	// Duplicate name
	it('duplicate name -> 409 DUPLICATE_VERSION_NAME', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(makeVersion());
		mockPrisma.budgetVersion.create.mockRejectedValue(
			new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
				code: 'P2002',
				clientVersion: '6.0.0',
				meta: { target: ['fiscal_year', 'name'] },
			})
		);

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/versions/1/clone',
			headers: authHeader(token),
			payload: { name: 'Budget v1' },
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('DUPLICATE_VERSION_NAME');
	});

	it('AC-11: clone with description override uses provided description', async () => {
		const source = makeVersion({
			id: 1,
			description: 'Original description',
		});
		const cloned = makeVersion({
			id: 2,
			name: 'Clone With Desc',
			description: 'Overridden description',
			status: 'Draft',
			sourceVersionId: 1,
			createdBy: { email: 'admin@budfin.app' },
		});
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(source);
		mockPrisma.budgetVersion.create.mockResolvedValue(cloned);

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/versions/1/clone',
			headers: authHeader(token),
			payload: {
				name: 'Clone With Desc',
				description: 'Overridden description',
			},
		});

		expect(res.statusCode).toBe(201);
		expect(mockPrisma.budgetVersion.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					description: 'Overridden description',
				}),
			})
		);
	});

	// 404 not found
	it('returns 404 VERSION_NOT_FOUND when source version not found', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(null);

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/versions/999/clone',
			headers: authHeader(token),
			payload: { name: 'Clone' },
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('VERSION_NOT_FOUND');
	});

	// AC-19: RBAC
	it('AC-19: Editor gets 403 on POST /clone', async () => {
		const token = await makeToken({ role: 'Editor' });
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/versions/1/clone',
			headers: authHeader(token),
			payload: { name: 'Clone' },
		});

		expect(res.statusCode).toBe(403);
		expect(res.json().code).toBe('FORBIDDEN');
	});

	it('AC-19: Viewer gets 403 on POST /clone', async () => {
		const token = await makeToken({ role: 'Viewer' });
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/versions/1/clone',
			headers: authHeader(token),
			payload: { name: 'Clone' },
		});

		expect(res.statusCode).toBe(403);
		expect(res.json().code).toBe('FORBIDDEN');
	});

	it('AC-11: clone carries rolloverThreshold and cappedRetention from source version', async () => {
		const source = makeVersion({
			id: 1,
			rolloverThreshold: '1.0500',
			cappedRetention: '0.9700',
		});
		const cloned = makeVersion({
			id: 2,
			name: 'Threshold Clone',
			sourceVersionId: 1,
			rolloverThreshold: '1.0500',
			cappedRetention: '0.9700',
			createdBy: { email: 'admin@budfin.app' },
		});
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(source);
		mockPrisma.budgetVersion.create.mockResolvedValue(cloned);

		const token = await makeToken({ role: 'Admin' });
		await app.inject({
			method: 'POST',
			url: '/api/v1/versions/1/clone',
			headers: authHeader(token),
			payload: { name: 'Threshold Clone' },
		});

		expect(mockPrisma.budgetVersion.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					rolloverThreshold: '1.0500',
					cappedRetention: '0.9700',
				}),
			})
		);
	});

	it('clone copies capacity config overrides', async () => {
		const source = makeVersion({ id: 1 });
		const capacityConfigs = [
			{ gradeLevel: 'PS', maxClassSize: 24 },
			{ gradeLevel: 'CP', maxClassSize: 22 },
		];
		const cloned = makeVersion({
			id: 2,
			name: 'Capacity Clone',
			sourceVersionId: 1,
			createdBy: { email: 'admin@budfin.app' },
		});

		mockPrisma.budgetVersion.findUnique.mockResolvedValue(source);
		mockPrisma.versionCapacityConfig.findMany.mockResolvedValue(capacityConfigs);
		mockPrisma.budgetVersion.create.mockResolvedValue(cloned);

		const token = await makeToken({ role: 'Admin' });
		await app.inject({
			method: 'POST',
			url: '/api/v1/versions/1/clone',
			headers: authHeader(token),
			payload: { name: 'Capacity Clone' },
		});

		expect(mockPrisma.versionCapacityConfig.createMany).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.arrayContaining([
					expect.objectContaining({
						gradeLevel: 'PS',
						maxClassSize: 24,
						versionId: 2,
					}),
					expect.objectContaining({
						gradeLevel: 'CP',
						maxClassSize: 22,
						versionId: 2,
					}),
				]),
			})
		);
	});

	// ── Story 19-7: Staffing table clone tests ──────────────────────

	it('AC-01: clone copies VersionStaffingSettings with reconciliationBaseline', async () => {
		const source = makeVersion({ id: 1 });
		const cloned = makeVersion({
			id: 2,
			name: 'Staff Clone',
			sourceVersionId: 1,
			createdBy: { email: 'admin@budfin.app' },
		});
		const srcSettings = {
			id: 10,
			versionId: 1,
			hsaTargetHours: '1.5',
			hsaFirstHourRate: '500',
			hsaAdditionalHourRate: '400',
			hsaMonths: 10,
			academicWeeks: 36,
			ajeerAnnualLevy: '9500.0000',
			ajeerMonthlyFee: '160.0000',
			reconciliationBaseline: { totalFte: 42.5, totalCost: 10000 },
			createdAt: now,
			updatedAt: now,
		};

		mockPrisma.budgetVersion.findUnique.mockResolvedValue(source);
		mockPrisma.budgetVersion.create.mockResolvedValue(cloned);
		mockPrisma.versionStaffingSettings.findUnique.mockResolvedValue(srcSettings);

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/versions/1/clone',
			headers: authHeader(token),
			payload: { name: 'Staff Clone' },
		});

		expect(res.statusCode).toBe(201);
		expect(mockPrisma.versionStaffingSettings.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					versionId: 2,
					hsaTargetHours: '1.5',
					hsaFirstHourRate: '500',
					hsaAdditionalHourRate: '400',
					hsaMonths: 10,
					academicWeeks: 36,
					ajeerAnnualLevy: '9500.0000',
					ajeerMonthlyFee: '160.0000',
					reconciliationBaseline: {
						totalFte: 42.5,
						totalCost: 10000,
					},
				}),
			})
		);
	});

	it('AC-01: clone skips VersionStaffingSettings when none exist', async () => {
		const source = makeVersion({ id: 1 });
		const cloned = makeVersion({
			id: 2,
			name: 'No Settings Clone',
			sourceVersionId: 1,
			createdBy: { email: 'admin@budfin.app' },
		});

		mockPrisma.budgetVersion.findUnique.mockResolvedValue(source);
		mockPrisma.budgetVersion.create.mockResolvedValue(cloned);
		mockPrisma.versionStaffingSettings.findUnique.mockResolvedValue(null);

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/versions/1/clone',
			headers: authHeader(token),
			payload: { name: 'No Settings Clone' },
		});

		expect(res.statusCode).toBe(201);
		expect(mockPrisma.versionStaffingSettings.create).not.toHaveBeenCalled();
	});

	it('AC-02: clone copies VersionServiceProfileOverride rows', async () => {
		const source = makeVersion({ id: 1 });
		const cloned = makeVersion({
			id: 2,
			name: 'Profile Clone',
			sourceVersionId: 1,
			createdBy: { email: 'admin@budfin.app' },
		});
		const overrides = [
			{
				id: 1,
				versionId: 1,
				serviceProfileId: 10,
				weeklyServiceHours: '18.0',
				hsaEligible: true,
			},
			{
				id: 2,
				versionId: 1,
				serviceProfileId: 11,
				weeklyServiceHours: '20.0',
				hsaEligible: false,
			},
		];

		mockPrisma.budgetVersion.findUnique.mockResolvedValue(source);
		mockPrisma.budgetVersion.create.mockResolvedValue(cloned);
		mockPrisma.versionServiceProfileOverride.findMany.mockResolvedValue(overrides);

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/versions/1/clone',
			headers: authHeader(token),
			payload: { name: 'Profile Clone' },
		});

		expect(res.statusCode).toBe(201);
		expect(mockPrisma.versionServiceProfileOverride.createMany).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.arrayContaining([
					expect.objectContaining({
						versionId: 2,
						serviceProfileId: 10,
						weeklyServiceHours: '18.0',
						hsaEligible: true,
					}),
					expect.objectContaining({
						versionId: 2,
						serviceProfileId: 11,
						weeklyServiceHours: '20.0',
						hsaEligible: false,
					}),
				]),
			})
		);
	});

	it('AC-03: clone copies VersionStaffingCostAssumption rows', async () => {
		const source = makeVersion({ id: 1 });
		const cloned = makeVersion({
			id: 2,
			name: 'Cost Clone',
			sourceVersionId: 1,
			createdBy: { email: 'admin@budfin.app' },
		});
		const assumptions = [
			{
				id: 1,
				versionId: 1,
				category: 'GOSI_EMPLOYER',
				calculationMode: 'PERCENT_OF_PAYROLL',
				value: '0.1175',
			},
			{
				id: 2,
				versionId: 1,
				category: 'MEDICAL_INSURANCE',
				calculationMode: 'FLAT_ANNUAL',
				value: '5000.0000',
			},
		];

		mockPrisma.budgetVersion.findUnique.mockResolvedValue(source);
		mockPrisma.budgetVersion.create.mockResolvedValue(cloned);
		mockPrisma.versionStaffingCostAssumption.findMany.mockResolvedValue(assumptions);

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/versions/1/clone',
			headers: authHeader(token),
			payload: { name: 'Cost Clone' },
		});

		expect(res.statusCode).toBe(201);
		expect(mockPrisma.versionStaffingCostAssumption.createMany).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.arrayContaining([
					expect.objectContaining({
						versionId: 2,
						category: 'GOSI_EMPLOYER',
						calculationMode: 'PERCENT_OF_PAYROLL',
						value: '0.1175',
					}),
					expect.objectContaining({
						versionId: 2,
						category: 'MEDICAL_INSURANCE',
						calculationMode: 'FLAT_ANNUAL',
						value: '5000.0000',
					}),
				]),
			})
		);
	});

	it('AC-04: clone copies VersionLyceeGroupAssumption rows', async () => {
		const source = makeVersion({ id: 1 });
		const cloned = makeVersion({
			id: 2,
			name: 'Lycee Clone',
			sourceVersionId: 1,
			createdBy: { email: 'admin@budfin.app' },
		});
		const lyceeAssumptions = [
			{
				id: 1,
				versionId: 1,
				gradeLevel: '2NDE',
				disciplineId: 5,
				groupCount: 3,
				hoursPerGroup: '2.00',
			},
		];

		mockPrisma.budgetVersion.findUnique.mockResolvedValue(source);
		mockPrisma.budgetVersion.create.mockResolvedValue(cloned);
		mockPrisma.versionLyceeGroupAssumption.findMany.mockResolvedValue(lyceeAssumptions);

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/versions/1/clone',
			headers: authHeader(token),
			payload: { name: 'Lycee Clone' },
		});

		expect(res.statusCode).toBe(201);
		expect(mockPrisma.versionLyceeGroupAssumption.createMany).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.arrayContaining([
					expect.objectContaining({
						versionId: 2,
						gradeLevel: '2NDE',
						disciplineId: 5,
						groupCount: 3,
						hoursPerGroup: '2.00',
					}),
				]),
			})
		);
	});

	it('AC-05: clone copies StaffingAssignment with employeeId remapped', async () => {
		const source = makeVersion({ id: 1 });
		const cloned = makeVersion({
			id: 2,
			name: 'Assign Clone',
			sourceVersionId: 1,
			createdBy: { email: 'admin@budfin.app' },
		});

		// Employee clone returns old_id -> new_id mapping
		mockPrisma.$queryRaw.mockResolvedValue([
			{ old_id: 100, new_id: 200 },
			{ old_id: 101, new_id: 201 },
		]);

		const assignments = [
			{
				id: 1,
				versionId: 1,
				employeeId: 100,
				band: 'PRIMAIRE',
				disciplineId: 5,
				hoursPerWeek: '18.00',
				fteShare: '1.0000',
				source: 'MANUAL',
				note: 'Primary teacher',
			},
			{
				id: 2,
				versionId: 1,
				employeeId: 101,
				band: 'COLLEGE',
				disciplineId: 6,
				hoursPerWeek: '9.00',
				fteShare: '0.5000',
				source: 'AUTO_SUGGESTED',
				note: null,
			},
		];

		mockPrisma.budgetVersion.findUnique.mockResolvedValue(source);
		mockPrisma.budgetVersion.create.mockResolvedValue(cloned);
		mockPrisma.staffingAssignment.findMany.mockResolvedValue(assignments);

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/versions/1/clone',
			headers: authHeader(token),
			payload: { name: 'Assign Clone' },
		});

		expect(res.statusCode).toBe(201);
		expect(mockPrisma.staffingAssignment.createMany).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.arrayContaining([
					expect.objectContaining({
						versionId: 2,
						employeeId: 200,
						band: 'PRIMAIRE',
						disciplineId: 5,
						hoursPerWeek: '18.00',
						fteShare: '1.0000',
						source: 'MANUAL',
						note: 'Primary teacher',
					}),
					expect.objectContaining({
						versionId: 2,
						employeeId: 201,
						band: 'COLLEGE',
						disciplineId: 6,
						hoursPerWeek: '9.00',
						fteShare: '0.5000',
						source: 'AUTO_SUGGESTED',
						note: null,
					}),
				]),
			})
		);
	});

	it('AC-05: clone skips assignments whose employee was not cloned', async () => {
		const source = makeVersion({ id: 1 });
		const cloned = makeVersion({
			id: 2,
			name: 'Orphan Clone',
			sourceVersionId: 1,
			createdBy: { email: 'admin@budfin.app' },
		});

		// Only employee 100 was cloned, not 999
		mockPrisma.$queryRaw.mockResolvedValue([{ old_id: 100, new_id: 200 }]);

		const assignments = [
			{
				id: 1,
				versionId: 1,
				employeeId: 100,
				band: 'PRIMAIRE',
				disciplineId: 5,
				hoursPerWeek: '18.00',
				fteShare: '1.0000',
				source: 'MANUAL',
				note: null,
			},
			{
				id: 2,
				versionId: 1,
				employeeId: 999,
				band: 'COLLEGE',
				disciplineId: 6,
				hoursPerWeek: '9.00',
				fteShare: '0.5000',
				source: 'MANUAL',
				note: null,
			},
		];

		mockPrisma.budgetVersion.findUnique.mockResolvedValue(source);
		mockPrisma.budgetVersion.create.mockResolvedValue(cloned);
		mockPrisma.staffingAssignment.findMany.mockResolvedValue(assignments);

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/versions/1/clone',
			headers: authHeader(token),
			payload: { name: 'Orphan Clone' },
		});

		expect(res.statusCode).toBe(201);
		// Only 1 assignment should be cloned (employee 100 -> 200)
		expect(mockPrisma.staffingAssignment.createMany).toHaveBeenCalledWith(
			expect.objectContaining({
				data: [
					expect.objectContaining({
						versionId: 2,
						employeeId: 200,
					}),
				],
			})
		);
	});

	it('AC-06: clone copies DemandOverride rows', async () => {
		const source = makeVersion({ id: 1 });
		const cloned = makeVersion({
			id: 2,
			name: 'Demand Clone',
			sourceVersionId: 1,
			createdBy: { email: 'admin@budfin.app' },
		});
		const overrides = [
			{
				id: 1,
				versionId: 1,
				band: 'PRIMAIRE',
				disciplineId: 5,
				lineType: 'DHG',
				overrideFte: '2.0000',
				reasonCode: 'POLICY_DECISION',
				note: 'Extra FTE',
			},
		];

		mockPrisma.budgetVersion.findUnique.mockResolvedValue(source);
		mockPrisma.budgetVersion.create.mockResolvedValue(cloned);
		mockPrisma.demandOverride.findMany.mockResolvedValue(overrides);

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/versions/1/clone',
			headers: authHeader(token),
			payload: { name: 'Demand Clone' },
		});

		expect(res.statusCode).toBe(201);
		expect(mockPrisma.demandOverride.createMany).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.arrayContaining([
					expect.objectContaining({
						versionId: 2,
						band: 'PRIMAIRE',
						disciplineId: 5,
						lineType: 'DHG',
						overrideFte: '2.0000',
						reasonCode: 'POLICY_DECISION',
						note: 'Extra FTE',
					}),
				]),
			})
		);
	});

	it('AC-05: clone with empty staffing tables succeeds gracefully', async () => {
		const source = makeVersion({ id: 1 });
		const cloned = makeVersion({
			id: 2,
			name: 'Empty Staff Clone',
			sourceVersionId: 1,
			createdBy: { email: 'admin@budfin.app' },
		});

		// No employees, no staffing data
		mockPrisma.$queryRaw.mockResolvedValue([]);
		mockPrisma.versionStaffingSettings.findUnique.mockResolvedValue(null);
		mockPrisma.versionServiceProfileOverride.findMany.mockResolvedValue([]);
		mockPrisma.versionStaffingCostAssumption.findMany.mockResolvedValue([]);
		mockPrisma.versionLyceeGroupAssumption.findMany.mockResolvedValue([]);
		mockPrisma.staffingAssignment.findMany.mockResolvedValue([]);
		mockPrisma.demandOverride.findMany.mockResolvedValue([]);

		mockPrisma.budgetVersion.findUnique.mockResolvedValue(source);
		mockPrisma.budgetVersion.create.mockResolvedValue(cloned);

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/versions/1/clone',
			headers: authHeader(token),
			payload: { name: 'Empty Staff Clone' },
		});

		expect(res.statusCode).toBe(201);
		// None of the staffing create calls should fire
		expect(mockPrisma.versionStaffingSettings.create).not.toHaveBeenCalled();
		expect(mockPrisma.versionServiceProfileOverride.createMany).not.toHaveBeenCalled();
		expect(mockPrisma.versionStaffingCostAssumption.createMany).not.toHaveBeenCalled();
		expect(mockPrisma.versionLyceeGroupAssumption.createMany).not.toHaveBeenCalled();
		expect(mockPrisma.staffingAssignment.createMany).not.toHaveBeenCalled();
		expect(mockPrisma.demandOverride.createMany).not.toHaveBeenCalled();
	});

	it('AC-08: clone does NOT copy TeachingRequirementSource or TeachingRequirementLine', async () => {
		const source = makeVersion({ id: 1 });
		const cloned = makeVersion({
			id: 2,
			name: 'No Derived Clone',
			sourceVersionId: 1,
			createdBy: { email: 'admin@budfin.app' },
		});

		mockPrisma.budgetVersion.findUnique.mockResolvedValue(source);
		mockPrisma.budgetVersion.create.mockResolvedValue(cloned);

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/versions/1/clone',
			headers: authHeader(token),
			payload: { name: 'No Derived Clone' },
		});

		expect(res.statusCode).toBe(201);
		// These models should never be accessed in the mock transaction
		// because they should not be cloned (derived outputs)
		const txCallArg = mockPrisma.$transaction.mock.calls[0]?.[0];
		expect(txCallArg).toBeDefined();
		// Verify the transaction function was called and completed
		// without trying to copy teaching requirement tables
	});

	it('AC-05: employee clone uses raw SQL INSERT...SELECT to preserve encrypted salary bytes', async () => {
		const source = makeVersion({ id: 1 });
		const cloned = makeVersion({
			id: 2,
			name: 'Crypto Clone',
			sourceVersionId: 1,
			createdBy: { email: 'admin@budfin.app' },
		});

		mockPrisma.$queryRaw.mockResolvedValue([{ old_id: 50, new_id: 150 }]);

		mockPrisma.budgetVersion.findUnique.mockResolvedValue(source);
		mockPrisma.budgetVersion.create.mockResolvedValue(cloned);

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/versions/1/clone',
			headers: authHeader(token),
			payload: { name: 'Crypto Clone' },
		});

		expect(res.statusCode).toBe(201);
		// Verify $queryRaw was called (for INSERT...SELECT employee clone)
		expect(mockPrisma.$queryRaw).toHaveBeenCalled();
	});
});
