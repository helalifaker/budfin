/**
 * Story #81 — Stage 1 API: headcount GET/PUT
 *
 * AC-01: PUT upserts headcount, updates stale_modules, returns 200
 * AC-02: GET returns entries sorted by display order
 * AC-03: PUT on Locked/Archived → 409 VERSION_LOCKED
 * AC-04: PUT with negative → 422 NEGATIVE_HEADCOUNT with field-level errors
 * AC-05: Viewer PUT → 403
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { generateKeyPair } from 'jose';
import { setKeys, signAccessToken } from '../../services/token.js';
import { auth } from '../../plugins/auth.js';
import { headcountRoutes } from './headcount.js';

vi.mock('../../lib/prisma.js', () => {
	const mockPrisma = {
		budgetVersion: {
			findUnique: vi.fn(),
			update: vi.fn().mockResolvedValue({}),
		},
		enrollmentHeadcount: {
			findMany: vi.fn(),
			upsert: vi.fn().mockResolvedValue({}),
		},
		gradeLevel: {
			findMany: vi.fn(),
		},
		auditEntry: {
			create: vi.fn().mockResolvedValue({ id: 1 }),
		},
		$transaction: vi.fn().mockImplementation((fn: (tx: Record<string, unknown>) => unknown) =>
			fn({
				budgetVersion: mockPrisma.budgetVersion,
				enrollmentHeadcount: mockPrisma.enrollmentHeadcount,
				gradeLevel: mockPrisma.gradeLevel,
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
		upsert: ReturnType<typeof vi.fn>;
	};
	gradeLevel: {
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
	staleModules: [],
	modificationCount: 0,
};

const mockGradeLevels = [
	{ gradeCode: 'PS', gradeName: 'Petite Section', band: 'MATERNELLE', displayOrder: 1 },
	{ gradeCode: 'MS', gradeName: 'Moyenne Section', band: 'MATERNELLE', displayOrder: 2 },
	{ gradeCode: 'GS', gradeName: 'Grande Section', band: 'MATERNELLE', displayOrder: 3 },
	{ gradeCode: 'CP', gradeName: 'CP', band: 'ELEMENTAIRE', displayOrder: 4 },
	{ gradeCode: 'CE1', gradeName: 'CE1', band: 'ELEMENTAIRE', displayOrder: 5 },
];

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
	await app.register(headcountRoutes, { prefix: ROUTE_PREFIX });
	await app.ready();
});

// ── GET /headcount ────────────────────────────────────────────────────────────

describe('GET /headcount', () => {
	it('AC-02: returns entries sorted by display order', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);
		mockPrisma.enrollmentHeadcount.findMany.mockResolvedValue([
			{
				gradeLevel: 'CP',
				academicPeriod: 'AY1',
				headcount: 25,
			},
			{
				gradeLevel: 'PS',
				academicPeriod: 'AY1',
				headcount: 20,
			},
		]);
		mockPrisma.gradeLevel.findMany.mockResolvedValue(mockGradeLevels);

		const token = await makeToken({ role: 'Viewer' });
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/headcount`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.entries).toHaveLength(2);
		// PS (displayOrder: 1) should come before CP (displayOrder: 4)
		expect(body.entries[0].gradeLevel).toBe('PS');
		expect(body.entries[0].gradeName).toBe('Petite Section');
		expect(body.entries[0].band).toBe('MATERNELLE');
		expect(body.entries[1].gradeLevel).toBe('CP');
	});

	it('AC-02: filters by academic_period', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);
		mockPrisma.enrollmentHeadcount.findMany.mockResolvedValue([
			{ gradeLevel: 'PS', academicPeriod: 'AY1', headcount: 20 },
		]);
		mockPrisma.gradeLevel.findMany.mockResolvedValue(mockGradeLevels);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/headcount?academic_period=AY1`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		expect(mockPrisma.enrollmentHeadcount.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { versionId: 1, academicPeriod: 'AY1' },
			})
		);
	});

	it('defaults to both periods when no filter', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);
		mockPrisma.enrollmentHeadcount.findMany.mockResolvedValue([]);
		mockPrisma.gradeLevel.findMany.mockResolvedValue(mockGradeLevels);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/headcount`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		expect(mockPrisma.enrollmentHeadcount.findMany).toHaveBeenCalledWith(
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
			url: `${URL_PREFIX}/headcount`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('VERSION_NOT_FOUND');
	});

	it('returns 401 without auth', async () => {
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/headcount`,
		});

		expect(res.statusCode).toBe(401);
	});
});

// ── PUT /headcount ────────────────────────────────────────────────────────────

describe('PUT /headcount', () => {
	it('AC-01: upserts headcount, updates stale_modules, returns 200', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);

		const token = await makeToken({ role: 'Editor' });
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/headcount`,
			headers: authHeader(token),
			payload: {
				entries: [
					{ gradeLevel: 'PS', academicPeriod: 'AY1', headcount: 20 },
					{ gradeLevel: 'MS', academicPeriod: 'AY1', headcount: 22 },
				],
			},
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.updated).toBe(2);
		expect(body.staleModules).toEqual(
			expect.arrayContaining(['ENROLLMENT', 'REVENUE', 'DHG', 'STAFFING', 'PNL'])
		);

		// Verify upsert was called for each entry
		expect(mockPrisma.enrollmentHeadcount.upsert).toHaveBeenCalledTimes(2);

		// Verify stale modules update
		expect(mockPrisma.budgetVersion.update).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: 1 },
				data: {
					staleModules: expect.arrayContaining(['ENROLLMENT', 'REVENUE', 'DHG', 'STAFFING', 'PNL']),
				},
			})
		);

		// Verify audit log
		expect(mockPrisma.auditEntry.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					operation: 'HEADCOUNT_UPDATED',
					tableName: 'enrollment_headcount',
					recordId: 1,
				}),
			})
		);
	});

	it('AC-01: merges with existing stale modules', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue({
			...mockDraftVersion,
			staleModules: ['REVENUE', 'SOME_OTHER'],
		});

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/headcount`,
			headers: authHeader(token),
			payload: {
				entries: [{ gradeLevel: 'PS', academicPeriod: 'AY1', headcount: 20 }],
			},
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.staleModules).toContain('SOME_OTHER');
		expect(body.staleModules).toContain('ENROLLMENT');
		expect(body.staleModules).toContain('REVENUE');
		expect(body.staleModules).toContain('DHG');
	});

	it('AC-03: PUT on Locked version → 409 VERSION_LOCKED', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue({
			...mockDraftVersion,
			status: 'Locked',
		});

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/headcount`,
			headers: authHeader(token),
			payload: {
				entries: [{ gradeLevel: 'PS', academicPeriod: 'AY1', headcount: 20 }],
			},
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('VERSION_LOCKED');
	});

	it('AC-03: PUT on Archived version → 409 VERSION_LOCKED', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue({
			...mockDraftVersion,
			status: 'Archived',
		});

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/headcount`,
			headers: authHeader(token),
			payload: {
				entries: [{ gradeLevel: 'PS', academicPeriod: 'AY1', headcount: 20 }],
			},
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('VERSION_LOCKED');
	});

	it('AC-03: PUT on Published version → 409 VERSION_LOCKED', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue({
			...mockDraftVersion,
			status: 'Published',
		});

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/headcount`,
			headers: authHeader(token),
			payload: {
				entries: [{ gradeLevel: 'PS', academicPeriod: 'AY1', headcount: 20 }],
			},
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('VERSION_LOCKED');
	});

	it('AC-04: PUT with negative headcount → 422 NEGATIVE_HEADCOUNT', async () => {
		const token = await makeToken({ role: 'Editor' });
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/headcount`,
			headers: authHeader(token),
			payload: {
				entries: [
					{ gradeLevel: 'PS', academicPeriod: 'AY1', headcount: -5 },
					{ gradeLevel: 'MS', academicPeriod: 'AY1', headcount: 10 },
					{ gradeLevel: 'GS', academicPeriod: 'AY2', headcount: -3 },
				],
			},
		});

		expect(res.statusCode).toBe(422);
		const body = res.json();
		expect(body.code).toBe('NEGATIVE_HEADCOUNT');
		expect(body.errors).toHaveLength(2);
		expect(body.errors[0]).toMatchObject({
			index: 0,
			gradeLevel: 'PS',
			headcount: -5,
		});
		expect(body.errors[1]).toMatchObject({
			index: 2,
			gradeLevel: 'GS',
			headcount: -3,
		});
	});

	it('AC-05: Viewer PUT → 403', async () => {
		const token = await makeToken({ role: 'Viewer' });
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/headcount`,
			headers: authHeader(token),
			payload: {
				entries: [{ gradeLevel: 'PS', academicPeriod: 'AY1', headcount: 20 }],
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
			url: `${URL_PREFIX}/headcount`,
			headers: authHeader(token),
			payload: {
				entries: [{ gradeLevel: 'PS', academicPeriod: 'AY1', headcount: 20 }],
			},
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('VERSION_NOT_FOUND');
	});

	it('returns 401 without auth', async () => {
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/headcount`,
			payload: {
				entries: [{ gradeLevel: 'PS', academicPeriod: 'AY1', headcount: 20 }],
			},
		});

		expect(res.statusCode).toBe(401);
	});

	it('Admin can PUT headcount', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/headcount`,
			headers: authHeader(token),
			payload: {
				entries: [{ gradeLevel: 'PS', academicPeriod: 'AY1', headcount: 20 }],
			},
		});

		expect(res.statusCode).toBe(200);
	});

	it('BudgetOwner can PUT headcount', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);

		const token = await makeToken({ role: 'BudgetOwner' });
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/headcount`,
			headers: authHeader(token),
			payload: {
				entries: [{ gradeLevel: 'CP', academicPeriod: 'AY2', headcount: 30 }],
			},
		});

		expect(res.statusCode).toBe(200);
	});
});
