/**
 * Story #82 — Stage 2 API: detail GET/PUT
 *
 * AC-06: PUT upserts detail entries with transaction + audit log
 * AC-07: PUT validates sum of detail headcounts matches Stage 1 totals → 422 STAGE2_TOTAL_MISMATCH
 * AC-08: GET returns detail entries filtered by academic_period
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { generateKeyPair } from 'jose';
import { setKeys, signAccessToken } from '../../services/token.js';
import { auth } from '../../plugins/auth.js';
import { detailRoutes } from './detail.js';

vi.mock('../../lib/prisma.js', () => {
	const mockPrisma = {
		budgetVersion: {
			findUnique: vi.fn(),
			update: vi.fn().mockResolvedValue({}),
		},
		enrollmentHeadcount: {
			findMany: vi.fn(),
		},
		enrollmentDetail: {
			findMany: vi.fn(),
			upsert: vi.fn().mockResolvedValue({}),
		},
		auditEntry: {
			create: vi.fn().mockResolvedValue({ id: 1 }),
		},
		$transaction: vi.fn().mockImplementation((fn: (tx: Record<string, unknown>) => unknown) =>
			fn({
				budgetVersion: mockPrisma.budgetVersion,
				enrollmentDetail: mockPrisma.enrollmentDetail,
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
	enrollmentHeadcount: {
		findMany: ReturnType<typeof vi.fn>;
	};
	enrollmentDetail: {
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

const ROUTE_PREFIX = '/api/v1/versions/:versionId/enrollment';
const URL_PREFIX = '/api/v1/versions/1/enrollment';

const mockDraftVersion = {
	id: 1,
	fiscalYear: 2026,
	name: 'Budget v1',
	type: 'Budget',
	status: 'Draft',
	staleModules: [],
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
	await app.register(detailRoutes, { prefix: ROUTE_PREFIX });
	await app.ready();
});

// ── GET /detail ──────────────────────────────────────────────────────────────

describe('GET /detail', () => {
	it('AC-08: returns detail entries for a version', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);
		mockPrisma.enrollmentDetail.findMany.mockResolvedValue([
			{
				gradeLevel: 'CP',
				academicPeriod: 'AY1',
				nationality: 'Francais',
				tariff: 'RP',
				headcount: 10,
			},
			{
				gradeLevel: 'CP',
				academicPeriod: 'AY1',
				nationality: 'Nationaux',
				tariff: 'R3+',
				headcount: 5,
			},
		]);

		const token = await makeToken({ role: 'Viewer' });
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/detail`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.entries).toHaveLength(2);
		expect(body.entries[0].nationality).toBe('Francais');
		expect(body.entries[1].tariff).toBe('R3+');
	});

	it('AC-08: filters by academic_period', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);
		mockPrisma.enrollmentDetail.findMany.mockResolvedValue([]);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/detail?academic_period=AY2`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		expect(mockPrisma.enrollmentDetail.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { versionId: 1, academicPeriod: 'AY2' },
			})
		);
	});

	it('defaults to both periods', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);
		mockPrisma.enrollmentDetail.findMany.mockResolvedValue([]);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/detail`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		expect(mockPrisma.enrollmentDetail.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { versionId: 1 },
			})
		);
	});

	it('returns 404 when version not found', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(null);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/detail`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('VERSION_NOT_FOUND');
	});

	it('returns 401 without auth', async () => {
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/detail`,
		});

		expect(res.statusCode).toBe(401);
	});
});

// ── PUT /detail ──────────────────────────────────────────────────────────────

describe('PUT /detail', () => {
	it('AC-06: upserts detail entries in transaction with audit log', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);
		mockPrisma.enrollmentHeadcount.findMany.mockResolvedValue([
			{ gradeLevel: 'CP', academicPeriod: 'AY1', headcount: 15 },
		]);

		const token = await makeToken({ role: 'Editor' });
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/detail`,
			headers: authHeader(token),
			payload: {
				entries: [
					{
						gradeLevel: 'CP',
						academicPeriod: 'AY1',
						nationality: 'Francais',
						tariff: 'RP',
						headcount: 10,
					},
					{
						gradeLevel: 'CP',
						academicPeriod: 'AY1',
						nationality: 'Nationaux',
						tariff: 'R3+',
						headcount: 5,
					},
				],
			},
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.updated).toBe(2);

		// Verify upsert called for each entry
		expect(mockPrisma.enrollmentDetail.upsert).toHaveBeenCalledTimes(2);

		// Verify audit log
		expect(mockPrisma.auditEntry.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					operation: 'DETAIL_UPDATED',
					tableName: 'enrollment_detail',
					recordId: 1,
				}),
			})
		);
	});

	it('AC-07: rejects when detail sums do not match Stage 1 totals', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);
		mockPrisma.enrollmentHeadcount.findMany.mockResolvedValue([
			{ gradeLevel: 'CP', academicPeriod: 'AY1', headcount: 20 },
		]);

		const token = await makeToken({ role: 'Editor' });
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/detail`,
			headers: authHeader(token),
			payload: {
				entries: [
					{
						gradeLevel: 'CP',
						academicPeriod: 'AY1',
						nationality: 'Francais',
						tariff: 'RP',
						headcount: 10,
					},
					{
						gradeLevel: 'CP',
						academicPeriod: 'AY1',
						nationality: 'Nationaux',
						tariff: 'R3+',
						headcount: 5,
					},
				],
			},
		});

		expect(res.statusCode).toBe(422);
		const body = res.json();
		expect(body.code).toBe('STAGE2_TOTAL_MISMATCH');
		expect(body.mismatches).toHaveLength(1);
		expect(body.mismatches[0]).toMatchObject({
			gradeLevel: 'CP',
			academicPeriod: 'AY1',
			expected: 20,
			actual: 15,
		});
	});

	it('AC-07: passes when detail sums match exactly', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);
		mockPrisma.enrollmentHeadcount.findMany.mockResolvedValue([
			{ gradeLevel: 'CP', academicPeriod: 'AY1', headcount: 25 },
		]);

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/detail`,
			headers: authHeader(token),
			payload: {
				entries: [
					{
						gradeLevel: 'CP',
						academicPeriod: 'AY1',
						nationality: 'Francais',
						tariff: 'RP',
						headcount: 15,
					},
					{
						gradeLevel: 'CP',
						academicPeriod: 'AY1',
						nationality: 'Nationaux',
						tariff: 'R3+',
						headcount: 10,
					},
				],
			},
		});

		expect(res.statusCode).toBe(200);
		expect(res.json().updated).toBe(2);
	});

	it('rejects on locked version → 409 VERSION_LOCKED', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue({
			...mockDraftVersion,
			status: 'Locked',
		});

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/detail`,
			headers: authHeader(token),
			payload: {
				entries: [
					{
						gradeLevel: 'CP',
						academicPeriod: 'AY1',
						nationality: 'Francais',
						tariff: 'RP',
						headcount: 10,
					},
				],
			},
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('VERSION_LOCKED');
	});

	it('Viewer PUT → 403', async () => {
		const token = await makeToken({ role: 'Viewer' });
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/detail`,
			headers: authHeader(token),
			payload: {
				entries: [
					{
						gradeLevel: 'CP',
						academicPeriod: 'AY1',
						nationality: 'Francais',
						tariff: 'RP',
						headcount: 10,
					},
				],
			},
		});

		expect(res.statusCode).toBe(403);
		expect(res.json().code).toBe('FORBIDDEN');
	});

	it('returns 404 when version not found', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(null);

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/detail`,
			headers: authHeader(token),
			payload: {
				entries: [
					{
						gradeLevel: 'CP',
						academicPeriod: 'AY1',
						nationality: 'Francais',
						tariff: 'RP',
						headcount: 10,
					},
				],
			},
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('VERSION_NOT_FOUND');
	});

	it('returns 401 without auth', async () => {
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/detail`,
			payload: {
				entries: [
					{
						gradeLevel: 'CP',
						academicPeriod: 'AY1',
						nationality: 'Francais',
						tariff: 'RP',
						headcount: 10,
					},
				],
			},
		});

		expect(res.statusCode).toBe(401);
	});
});
