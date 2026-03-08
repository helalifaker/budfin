/**
 * HTTP-layer tests for the nationality-breakdown route.
 *
 * GET /api/v1/versions/:versionId/enrollment/nationality-breakdown
 * PUT /api/v1/versions/:versionId/enrollment/nationality-breakdown
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { generateKeyPair } from 'jose';
import { setKeys, signAccessToken } from '../../services/token.js';
import { auth } from '../../plugins/auth.js';
import { nationalityBreakdownRoutes } from './nationality-breakdown.js';

vi.mock('../../lib/prisma.js', () => {
	const mockPrisma = {
		budgetVersion: {
			findUnique: vi.fn(),
			update: vi.fn().mockResolvedValue({}),
		},
		nationalityBreakdown: {
			findMany: vi.fn(),
			upsert: vi.fn().mockResolvedValue({}),
		},
		enrollmentHeadcount: {
			findMany: vi.fn(),
		},
		auditEntry: {
			create: vi.fn().mockResolvedValue({ id: 1 }),
		},
		$transaction: vi.fn().mockImplementation((fn: (tx: Record<string, unknown>) => unknown) =>
			fn({
				budgetVersion: mockPrisma.budgetVersion,
				nationalityBreakdown: mockPrisma.nationalityBreakdown,
				enrollmentHeadcount: mockPrisma.enrollmentHeadcount,
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
	nationalityBreakdown: {
		findMany: ReturnType<typeof vi.fn>;
		upsert: ReturnType<typeof vi.fn>;
	};
	enrollmentHeadcount: {
		findMany: ReturnType<typeof vi.fn>;
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

const ROUTE_PREFIX = '/api/v1/versions/:versionId/enrollment';
const URL_PREFIX = '/api/v1/versions/1/enrollment';

const mockDraftVersion = {
	id: 1,
	fiscalYear: 2026,
	name: 'Budget v1',
	type: 'Budget',
	status: 'Draft',
	dataSource: 'MANUAL',
	staleModules: [] as string[],
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
	await app.register(nationalityBreakdownRoutes, { prefix: ROUTE_PREFIX });
	await app.ready();
});

// ── GET /nationality-breakdown ───────────────────────────────────────────────

describe('GET /nationality-breakdown', () => {
	it('returns 401 without auth', async () => {
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/nationality-breakdown`,
		});

		expect(res.statusCode).toBe(401);
	});

	it('returns 404 for nonexistent version', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(null);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/nationality-breakdown`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('VERSION_NOT_FOUND');
	});

	it('returns entries with period=both (default)', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue({ id: 1 });
		mockPrisma.nationalityBreakdown.findMany.mockResolvedValue([
			{
				gradeLevel: 'CP',
				academicPeriod: 'AY1',
				nationality: 'Francais',
				weight: 0.5,
				headcount: 10,
				isOverridden: false,
			},
			{
				gradeLevel: 'CP',
				academicPeriod: 'AY2',
				nationality: 'Francais',
				weight: 0.5,
				headcount: 12,
				isOverridden: true,
			},
		]);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/nationality-breakdown`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.entries).toHaveLength(2);
		expect(body.entries[0]).toEqual({
			gradeLevel: 'CP',
			academicPeriod: 'AY1',
			nationality: 'Francais',
			weight: 0.5,
			headcount: 10,
			isOverridden: false,
		});

		// When period=both, no academicPeriod filter should be in the where clause
		expect(mockPrisma.nationalityBreakdown.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { versionId: 1 },
			})
		);
	});

	it('filters entries by academic_period=AY1', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue({ id: 1 });
		mockPrisma.nationalityBreakdown.findMany.mockResolvedValue([
			{
				gradeLevel: 'CP',
				academicPeriod: 'AY1',
				nationality: 'Francais',
				weight: 0.5,
				headcount: 10,
				isOverridden: false,
			},
		]);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/nationality-breakdown?academic_period=AY1`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		expect(res.json().entries).toHaveLength(1);

		expect(mockPrisma.nationalityBreakdown.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { versionId: 1, academicPeriod: 'AY1' },
			})
		);
	});

	it('filters entries by academic_period=AY2', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue({ id: 1 });
		mockPrisma.nationalityBreakdown.findMany.mockResolvedValue([
			{
				gradeLevel: 'CP',
				academicPeriod: 'AY2',
				nationality: 'Nationaux',
				weight: 0.3,
				headcount: 8,
				isOverridden: true,
			},
		]);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/nationality-breakdown?academic_period=AY2`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		expect(res.json().entries).toHaveLength(1);
		expect(res.json().entries[0].nationality).toBe('Nationaux');

		expect(mockPrisma.nationalityBreakdown.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { versionId: 1, academicPeriod: 'AY2' },
			})
		);
	});
});

// ── PUT /nationality-breakdown ───────────────────────────────────────────────

describe('PUT /nationality-breakdown', () => {
	const validOverrides = [
		{ gradeLevel: 'CP', nationality: 'Francais', weight: 0.5, headcount: 14 },
		{ gradeLevel: 'CP', nationality: 'Nationaux', weight: 0.3, headcount: 8 },
		{ gradeLevel: 'CP', nationality: 'Autres', weight: 0.2, headcount: 6 },
	];

	it('returns 401 without auth', async () => {
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/nationality-breakdown`,
			payload: { overrides: validOverrides },
		});

		expect(res.statusCode).toBe(401);
	});

	it('returns 403 for Viewer role', async () => {
		const token = await makeToken({ role: 'Viewer' });
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/nationality-breakdown`,
			headers: authHeader(token),
			payload: { overrides: validOverrides },
		});

		expect(res.statusCode).toBe(403);
		expect(res.json().code).toBe('FORBIDDEN');
	});

	it('returns 404 for nonexistent version', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(null);

		const token = await makeToken();
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/nationality-breakdown`,
			headers: authHeader(token),
			payload: { overrides: validOverrides },
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('VERSION_NOT_FOUND');
	});

	it('returns 409 for locked version', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue({
			...mockDraftVersion,
			status: 'Locked',
		});

		const token = await makeToken();
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/nationality-breakdown`,
			headers: authHeader(token),
			payload: { overrides: validOverrides },
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
			url: `${URL_PREFIX}/nationality-breakdown`,
			headers: authHeader(token),
			payload: { overrides: validOverrides },
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('IMPORTED_VERSION');
	});

	it('returns 422 when nationality weights do not sum to 1.0', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);
		mockPrisma.enrollmentHeadcount.findMany.mockResolvedValue([
			{ gradeLevel: 'CP', academicPeriod: 'AY2', headcount: 28 },
		]);

		const badOverrides = [
			{ gradeLevel: 'CP', nationality: 'Francais', weight: 0.5, headcount: 14 },
			{ gradeLevel: 'CP', nationality: 'Nationaux', weight: 0.3, headcount: 8 },
			{ gradeLevel: 'CP', nationality: 'Autres', weight: 0.3, headcount: 6 },
		];

		const token = await makeToken();
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/nationality-breakdown`,
			headers: authHeader(token),
			payload: { overrides: badOverrides },
		});

		expect(res.statusCode).toBe(422);
		expect(res.json().code).toBe('NATIONALITY_WEIGHT_SUM_INVALID');
		expect(res.json().errors).toHaveLength(1);
		expect(res.json().errors[0].gradeLevel).toBe('CP');
	});

	it('returns 422 when nationality headcounts do not sum to grade total', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);
		mockPrisma.enrollmentHeadcount.findMany.mockResolvedValue([
			{ gradeLevel: 'CP', academicPeriod: 'AY2', headcount: 30 },
		]);

		// Weights sum to 1.0 but headcounts sum to 28 (not 30)
		const badOverrides = [
			{ gradeLevel: 'CP', nationality: 'Francais', weight: 0.5, headcount: 14 },
			{ gradeLevel: 'CP', nationality: 'Nationaux', weight: 0.3, headcount: 8 },
			{ gradeLevel: 'CP', nationality: 'Autres', weight: 0.2, headcount: 6 },
		];

		const token = await makeToken();
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/nationality-breakdown`,
			headers: authHeader(token),
			payload: { overrides: badOverrides },
		});

		expect(res.statusCode).toBe(422);
		expect(res.json().code).toBe('NATIONALITY_HEADCOUNT_MISMATCH');
		expect(res.json().errors).toHaveLength(1);
		expect(res.json().errors[0]).toEqual({
			gradeLevel: 'CP',
			expected: 30,
			actual: 28,
		});
	});

	it('successfully upserts overrides and adds stale modules', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);
		mockPrisma.enrollmentHeadcount.findMany.mockResolvedValue([
			{ gradeLevel: 'CP', academicPeriod: 'AY2', headcount: 28 },
		]);

		const token = await makeToken();
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/nationality-breakdown`,
			headers: authHeader(token),
			payload: { overrides: validOverrides },
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.updated).toBe(3);
		expect(body.staleModules).toEqual(
			expect.arrayContaining(['ENROLLMENT', 'REVENUE', 'DHG', 'STAFFING', 'PNL'])
		);

		// Verify each override was upserted with academicPeriod='AY2'
		expect(mockPrisma.nationalityBreakdown.upsert).toHaveBeenCalledTimes(3);
		expect(mockPrisma.nationalityBreakdown.upsert).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					versionId_academicPeriod_gradeLevel_nationality: {
						versionId: 1,
						academicPeriod: 'AY2',
						gradeLevel: 'CP',
						nationality: 'Francais',
					},
				},
				create: expect.objectContaining({
					versionId: 1,
					academicPeriod: 'AY2',
					gradeLevel: 'CP',
					nationality: 'Francais',
					weight: 0.5,
					headcount: 14,
					isOverridden: true,
				}),
				update: expect.objectContaining({
					weight: 0.5,
					headcount: 14,
					isOverridden: true,
				}),
			})
		);

		// Verify stale modules were updated on budgetVersion
		expect(mockPrisma.budgetVersion.update).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: 1 },
				data: {
					staleModules: expect.arrayContaining(['ENROLLMENT', 'REVENUE', 'DHG', 'STAFFING', 'PNL']),
				},
			})
		);
	});

	it('creates audit entry on successful update', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);
		mockPrisma.enrollmentHeadcount.findMany.mockResolvedValue([
			{ gradeLevel: 'CP', academicPeriod: 'AY2', headcount: 28 },
		]);

		const token = await makeToken();
		await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/nationality-breakdown`,
			headers: authHeader(token),
			payload: { overrides: validOverrides },
		});

		expect(mockPrisma.auditEntry.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					userId: 1,
					userEmail: 'admin@budfin.app',
					operation: 'NATIONALITY_BREAKDOWN_UPDATED',
					tableName: 'nationality_breakdown',
					recordId: 1,
					newValues: expect.objectContaining({
						overrides: expect.arrayContaining([
							expect.objectContaining({
								gradeLevel: 'CP',
								nationality: 'Francais',
								weight: 0.5,
								headcount: 14,
							}),
						]),
					}),
				}),
			})
		);
	});
});
