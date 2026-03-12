/**
 * HTTP-layer tests for cohort-parameters routes.
 *
 * GET  /api/v1/versions/:versionId/cohort-parameters
 * PUT  /api/v1/versions/:versionId/cohort-parameters
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { generateKeyPair } from 'jose';
import { setKeys, signAccessToken } from '../../services/token.js';
import { auth } from '../../plugins/auth.js';
import { cohortParameterRoutes } from './cohort-parameters.js';

vi.mock('../../services/cohort-recommendations.js', () => ({
	getHistoricalCohortRecommendations: vi.fn().mockResolvedValue([
		{
			gradeLevel: 'PS',
			recommendedRetentionRate: 0,
			recommendedLateralEntryCount: 0,
			confidence: 'low',
			observationCount: 0,
			sourceFiscalYear: null,
			rolloverRatio: null,
			recommendationPriorAy1Headcount: null,
			recommendationAy2Headcount: null,
			rule: 'direct-entry',
		},
		{
			gradeLevel: 'CP',
			recommendedRetentionRate: 1,
			recommendedLateralEntryCount: 2,
			confidence: 'high',
			observationCount: 4,
			sourceFiscalYear: 2025,
			rolloverRatio: 1.0189,
			recommendationPriorAy1Headcount: 106,
			recommendationAy2Headcount: 108,
			rule: 'historical-rollover',
		},
		{
			gradeLevel: 'MS',
			recommendedRetentionRate: 1,
			recommendedLateralEntryCount: 3,
			confidence: 'high',
			observationCount: 4,
			sourceFiscalYear: 2025,
			rolloverRatio: 1.0309,
			recommendationPriorAy1Headcount: 92,
			recommendationAy2Headcount: 95,
			rule: 'historical-rollover',
		},
	]),
}));

vi.mock('../../lib/prisma.js', () => {
	const mockPrisma = {
		budgetVersion: {
			findUnique: vi.fn(),
			update: vi.fn().mockResolvedValue({}),
		},
		cohortParameter: {
			findMany: vi.fn().mockResolvedValue([]),
			upsert: vi.fn().mockResolvedValue({}),
		},
		auditEntry: {
			create: vi.fn().mockResolvedValue({ id: 1 }),
		},
		$transaction: vi.fn().mockImplementation((fn: (tx: Record<string, unknown>) => unknown) =>
			fn({
				budgetVersion: mockPrisma.budgetVersion,
				cohortParameter: mockPrisma.cohortParameter,
				auditEntry: mockPrisma.auditEntry,
			})
		),
	};
	return { prisma: mockPrisma };
});

import { prisma } from '../../lib/prisma.js';

const mockPrisma = prisma as unknown as {
	budgetVersion: {
		findUnique: ReturnType<typeof vi.fn>;
		update: ReturnType<typeof vi.fn>;
	};
	cohortParameter: {
		findMany: ReturnType<typeof vi.fn>;
		upsert: ReturnType<typeof vi.fn>;
	};
	auditEntry: { create: ReturnType<typeof vi.fn> };
	$transaction: ReturnType<typeof vi.fn>;
};

let app: FastifyInstance;

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

const ROUTE_PREFIX = '/api/v1/versions/:versionId';
const URL_PREFIX = '/api/v1/versions/1';

const mockDraftVersion = {
	id: 1,
	fiscalYear: 2026,
	rolloverThreshold: 1,
	cappedRetention: 0.98,
	name: 'Budget v1',
	type: 'Budget',
	status: 'Draft',
	dataSource: 'MANUAL',
	staleModules: ['REVENUE'],
	modificationCount: 0,
};

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
	await app.register(cohortParameterRoutes, { prefix: ROUTE_PREFIX });
	await app.ready();
});

// ── GET /cohort-parameters ──────────────────────────────────────────────────

describe('GET /cohort-parameters', () => {
	it('returns 401 without auth', async () => {
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/cohort-parameters`,
		});

		expect(res.statusCode).toBe(401);
	});

	it('returns 404 for nonexistent version', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(null);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/cohort-parameters`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('VERSION_NOT_FOUND');
	});

	it('returns default parameters when no cohort params exist', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue({
			id: 1,
			fiscalYear: 2026,
			rolloverThreshold: 1,
			cappedRetention: 0.98,
		});
		mockPrisma.cohortParameter.findMany.mockResolvedValue([]);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/cohort-parameters`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();

		// Should have 15 entries (one per grade in GRADE_PROGRESSION)
		expect(body.entries).toHaveLength(15);
		expect(body.planningRules).toEqual({
			rolloverThreshold: 1,
			cappedRetention: 0.98,
		});

		// PS defaults: retentionRate=0 (direct entry grade)
		const ps = body.entries.find((e: Record<string, unknown>) => e.gradeLevel === 'PS');
		expect(ps).toBeDefined();
		expect(ps.retentionRate).toBe(0);
		expect(ps.lateralEntryCount).toBe(0);
		expect(ps.lateralWeightFr).toBe(0);
		expect(ps.lateralWeightNat).toBe(0);
		expect(ps.lateralWeightAut).toBe(0);
		expect(ps.isPersisted).toBe(false);

		// Non-PS defaults: retentionRate=0.97
		const cp = body.entries.find((e: Record<string, unknown>) => e.gradeLevel === 'CP');
		expect(cp).toBeDefined();
		expect(cp.retentionRate).toBe(1);
		expect(cp.lateralEntryCount).toBe(2);
		expect(cp.isPersisted).toBe(false);
		expect(cp.recommendationSourceFiscalYear).toBe(2025);
		expect(cp.recommendationPriorAy1Headcount).toBe(106);
		expect(cp.recommendationAy2Headcount).toBe(108);
	});

	it('returns existing parameters for a version', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue({
			id: 1,
			fiscalYear: 2026,
			rolloverThreshold: 1.05,
			cappedRetention: 0.97,
		});
		mockPrisma.cohortParameter.findMany.mockResolvedValue([
			{
				gradeLevel: 'CP',
				retentionRate: 0.95,
				lateralEntryCount: 3,
				lateralWeightFr: 0.5,
				lateralWeightNat: 0.3,
				lateralWeightAut: 0.2,
			},
			{
				gradeLevel: 'PS',
				retentionRate: 0,
				lateralEntryCount: 0,
				lateralWeightFr: 0,
				lateralWeightNat: 0,
				lateralWeightAut: 0,
			},
		]);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/cohort-parameters`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.entries).toHaveLength(15);

		// CP should reflect stored values
		const cp = body.entries.find((e: Record<string, unknown>) => e.gradeLevel === 'CP');
		expect(cp.retentionRate).toBe(0.95);
		expect(cp.lateralEntryCount).toBe(3);
		expect(cp.lateralWeightFr).toBe(0.5);
		expect(cp.lateralWeightNat).toBe(0.3);
		expect(cp.lateralWeightAut).toBe(0.2);
		expect(cp.isPersisted).toBe(true);

		// MS should be defaults (not stored)
		const ms = body.entries.find((e: Record<string, unknown>) => e.gradeLevel === 'MS');
		expect(ms.retentionRate).toBe(1);
		expect(ms.lateralEntryCount).toBe(3);
		expect(ms.isPersisted).toBe(false);
		expect(ms.recommendationRule).toBe('historical-rollover');
		expect(body.planningRules).toEqual({
			rolloverThreshold: 1.05,
			cappedRetention: 0.97,
		});
	});
});

// ── PUT /cohort-parameters ──────────────────────────────────────────────────

const validEntry = {
	gradeLevel: 'CP',
	retentionRate: 0.95,
	lateralEntryCount: 2,
	lateralWeightFr: 0.5,
	lateralWeightNat: 0.3,
	lateralWeightAut: 0.2,
};

describe('PUT /cohort-parameters', () => {
	it('returns 401 without auth', async () => {
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/cohort-parameters`,
			payload: { entries: [validEntry] },
		});

		expect(res.statusCode).toBe(401);
	});

	it('returns 403 for Viewer role', async () => {
		const token = await makeToken({ role: 'Viewer' });
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/cohort-parameters`,
			headers: authHeader(token),
			payload: { entries: [validEntry] },
		});

		expect(res.statusCode).toBe(403);
		expect(res.json().code).toBe('FORBIDDEN');
	});

	it('returns 404 for nonexistent version', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(null);

		const token = await makeToken();
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/cohort-parameters`,
			headers: authHeader(token),
			payload: { entries: [validEntry] },
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('VERSION_NOT_FOUND');
	});

	it('returns 409 for locked version (status !== Draft)', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue({
			...mockDraftVersion,
			status: 'Locked',
		});

		const token = await makeToken();
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/cohort-parameters`,
			headers: authHeader(token),
			payload: { entries: [validEntry] },
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('VERSION_LOCKED');
	});

	it('returns 409 for IMPORTED version', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue({
			...mockDraftVersion,
			dataSource: 'IMPORTED',
		});

		const token = await makeToken();
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/cohort-parameters`,
			headers: authHeader(token),
			payload: { entries: [validEntry] },
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('IMPORTED_VERSION');
	});

	it('returns 422 when lateral weights do not sum to 1.0 (lateralEntryCount > 0)', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);

		const token = await makeToken();
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/cohort-parameters`,
			headers: authHeader(token),
			payload: {
				entries: [
					{
						gradeLevel: 'CP',
						retentionRate: 0.95,
						lateralEntryCount: 5,
						lateralWeightFr: 0.5,
						lateralWeightNat: 0.3,
						lateralWeightAut: 0.1, // sum = 0.9, not 1.0
					},
				],
			},
		});

		expect(res.statusCode).toBe(422);
		const body = res.json();
		expect(body.code).toBe('LATERAL_WEIGHT_SUM_INVALID');
		expect(body.errors).toHaveLength(1);
		expect(body.errors[0].gradeLevel).toBe('CP');
	});

	it('successfully upserts parameters and adds stale modules', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);

		const token = await makeToken();
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/cohort-parameters`,
			headers: authHeader(token),
			payload: { entries: [validEntry] },
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.updated).toBe(1);

		// All COHORT_STALE_MODULES should be added
		expect(body.staleModules).toEqual(
			expect.arrayContaining(['ENROLLMENT', 'REVENUE', 'DHG', 'STAFFING', 'PNL'])
		);

		// Verify the upsert was called with correct compound key
		expect(mockPrisma.cohortParameter.upsert).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					versionId_gradeLevel: {
						versionId: 1,
						gradeLevel: 'CP',
					},
				},
				create: expect.objectContaining({
					versionId: 1,
					gradeLevel: 'CP',
					retentionRate: 0.95,
					lateralEntryCount: 2,
				}),
				update: expect.objectContaining({
					retentionRate: 0.95,
					lateralEntryCount: 2,
				}),
			})
		);

		// budgetVersion.update should have been called with merged staleModules
		expect(mockPrisma.budgetVersion.update).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: 1 },
				data: {
					staleModules: expect.arrayContaining(['REVENUE', 'ENROLLMENT', 'DHG', 'STAFFING', 'PNL']),
				},
			})
		);
	});

	it('skips weight validation when lateralEntryCount is 0', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);

		const token = await makeToken();
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/cohort-parameters`,
			headers: authHeader(token),
			payload: {
				entries: [
					{
						gradeLevel: 'MS',
						retentionRate: 0.97,
						lateralEntryCount: 0,
						lateralWeightFr: 0,
						lateralWeightNat: 0,
						lateralWeightAut: 0, // sum = 0, but OK since count is 0
					},
				],
			},
		});

		expect(res.statusCode).toBe(200);
		expect(res.json().updated).toBe(1);
	});

	it('creates audit entry on successful update', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);

		const token = await makeToken();
		await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/cohort-parameters`,
			headers: authHeader(token),
			payload: { entries: [validEntry] },
		});

		expect(mockPrisma.auditEntry.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					userId: 1,
					userEmail: 'admin@budfin.app',
					operation: 'COHORT_PARAMETERS_UPDATED',
					tableName: 'cohort_parameters',
					recordId: 1,
					newValues: expect.objectContaining({
						entries: expect.arrayContaining([
							expect.objectContaining({
								gradeLevel: 'CP',
								retentionRate: 0.95,
								lateralEntryCount: 2,
							}),
						]),
					}),
				}),
			})
		);
	});
});
