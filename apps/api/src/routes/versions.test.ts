/**
 * Story #51 — Version CRUD API
 *
 * Tests for GET /api/v1/versions, POST /api/v1/versions,
 * GET /api/v1/versions/:id, DELETE /api/v1/versions/:id
 *
 * AC-01: Admin/BudgetOwner can create Budget/Forecast versions
 * AC-02: Any role gets 400 for type: "Actual"
 * AC-03: Duplicate name for same FY → 409 DUPLICATE_VERSION_NAME
 * AC-09: Admin/BudgetOwner can DELETE Draft version → 204
 * AC-10: DELETE on non-Draft → 409 VERSION_NOT_DRAFT
 * AC-18: GET /:id returns all metadata fields
 * AC-19 (partial): Editor/Viewer → 403 INSUFFICIENT_ROLE on mutations
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
			findMany: vi.fn(),
			findUnique: vi.fn(),
			create: vi.fn(),
			delete: vi.fn().mockResolvedValue({}),
			count: vi.fn(),
		},
		auditEntry: {
			create: vi.fn().mockResolvedValue({ id: 1 }),
		},
		$transaction: vi.fn().mockImplementation((fn: (tx: Record<string, unknown>) => unknown) =>
			fn({
				budgetVersion: mockPrisma.budgetVersion,
				auditEntry: mockPrisma.auditEntry,
			})
		),
	};
	return { prisma: mockPrisma };
});

import { prisma } from '../lib/prisma.js';

const mockPrisma = prisma as unknown as {
	budgetVersion: {
		findMany: ReturnType<typeof vi.fn>;
		findUnique: ReturnType<typeof vi.fn>;
		create: ReturnType<typeof vi.fn>;
		delete: ReturnType<typeof vi.fn>;
		count: ReturnType<typeof vi.fn>;
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
	});
}

function authHeader(token: string) {
	return { authorization: `Bearer ${token}` };
}

const now = new Date();

const mockVersion = {
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
	createdById: 1,
	publishedAt: null,
	lockedAt: null,
	archivedAt: null,
	createdAt: now,
	updatedAt: now,
	createdBy: { email: 'admin@budfin.app' },
};

const mockVersion2 = {
	...mockVersion,
	id: 2,
	name: 'Forecast Q1',
	type: 'Forecast',
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
	await app.register(versionRoutes, { prefix: '/api/v1/versions' });
	await app.ready();
});

// ── GET / ─────────────────────────────────────────────────────────────────────

describe('GET /api/v1/versions', () => {
	it('returns list of versions for authenticated user', async () => {
		mockPrisma.budgetVersion.findMany.mockResolvedValue([mockVersion, mockVersion2]);
		mockPrisma.budgetVersion.count.mockResolvedValue(2);

		const token = await makeToken({ role: 'Viewer' });
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/versions',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.data).toHaveLength(2);
		expect(body.data[0].name).toBe('Budget v1');
	});

	it('filters by fiscalYear', async () => {
		mockPrisma.budgetVersion.findMany.mockResolvedValue([mockVersion]);
		mockPrisma.budgetVersion.count.mockResolvedValue(1);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/versions?fiscalYear=2026',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		expect(mockPrisma.budgetVersion.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({ fiscalYear: 2026 }),
			}),
		);
	});

	it('filters by status', async () => {
		mockPrisma.budgetVersion.findMany.mockResolvedValue([mockVersion]);
		mockPrisma.budgetVersion.count.mockResolvedValue(1);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/versions?status=Draft',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		expect(mockPrisma.budgetVersion.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({ status: 'Draft' }),
			}),
		);
	});

	it('returns 401 without token', async () => {
		const res = await app.inject({ method: 'GET', url: '/api/v1/versions' });
		expect(res.statusCode).toBe(401);
	});
});

// ── GET /:id ──────────────────────────────────────────────────────────────────

describe('GET /api/v1/versions/:id', () => {
	it('AC-18: returns all metadata fields', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockVersion);

		const token = await makeToken({ role: 'Viewer' });
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/versions/1',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body).toMatchObject({
			id: 1,
			name: 'Budget v1',
			dataSource: 'CALCULATED',
			modificationCount: 0,
			staleModules: [],
			createdByEmail: 'admin@budfin.app',
		});
	});

	it('returns 404 when version not found', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(null);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/versions/999',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(404);
	});
});

// ── POST / ────────────────────────────────────────────────────────────────────

describe('POST /api/v1/versions', () => {
	it('AC-01: Admin creates Budget version successfully', async () => {
		mockPrisma.budgetVersion.create.mockResolvedValue(mockVersion);

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/versions',
			headers: authHeader(token),
			payload: { name: 'Budget v1', type: 'Budget', fiscalYear: 2026 },
		});

		expect(res.statusCode).toBe(201);
		const body = res.json();
		expect(body.name).toBe('Budget v1');
		expect(body.status).toBe('Draft');
		expect(body.modificationCount).toBe(0);
		expect(body.staleModules).toEqual([]);
	});

	it('AC-01: BudgetOwner creates Forecast version successfully', async () => {
		mockPrisma.budgetVersion.create.mockResolvedValue(mockVersion2);

		const token = await makeToken({ role: 'BudgetOwner', sub: 2 });
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/versions',
			headers: authHeader(token),
			payload: { name: 'Forecast Q1', type: 'Forecast', fiscalYear: 2026 },
		});

		expect(res.statusCode).toBe(201);
	});

	it('AC-02: any role gets 400 for type: "Actual"', async () => {
		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/versions',
			headers: authHeader(token),
			payload: { name: 'Actual 2026', type: 'Actual', fiscalYear: 2026 },
		});

		expect(res.statusCode).toBe(400);
		expect(res.json().code).toBe('ACTUAL_VERSION_MANUAL_CREATE_PROHIBITED');
	});

	it('AC-03: duplicate name for same FY → 409 DUPLICATE_VERSION_NAME', async () => {
		// Make create reject inside the transaction — the mock $transaction calls fn(tx)
		// so tx.budgetVersion.create rejection propagates naturally
		mockPrisma.budgetVersion.create.mockRejectedValue(
			new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
				code: 'P2002',
				clientVersion: '6.0.0',
				meta: { target: ['fiscal_year', 'name'] },
			}),
		);

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/versions',
			headers: authHeader(token),
			payload: { name: 'Budget v1', type: 'Budget', fiscalYear: 2026 },
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('DUPLICATE_VERSION_NAME');
	});

	it('AC-19: Editor gets 403 INSUFFICIENT_ROLE on POST', async () => {
		const token = await makeToken({ role: 'Editor' });
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/versions',
			headers: authHeader(token),
			payload: { name: 'Budget v1', type: 'Budget', fiscalYear: 2026 },
		});

		expect(res.statusCode).toBe(403);
		expect(res.json().error).toBe('FORBIDDEN');
	});

	it('AC-19: Viewer gets 403 INSUFFICIENT_ROLE on POST', async () => {
		const token = await makeToken({ role: 'Viewer' });
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/versions',
			headers: authHeader(token),
			payload: { name: 'Budget v1', type: 'Budget', fiscalYear: 2026 },
		});

		expect(res.statusCode).toBe(403);
		expect(res.json().error).toBe('FORBIDDEN');
	});

	it('returns 400 for missing required fields', async () => {
		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/versions',
			headers: authHeader(token),
			payload: { name: 'Budget v1' }, // missing type and fiscalYear
		});

		expect(res.statusCode).toBe(400);
	});
});

// ── DELETE /:id ───────────────────────────────────────────────────────────────

describe('DELETE /api/v1/versions/:id', () => {
	it('AC-09: Admin deletes Draft version → 204', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockVersion); // Draft
		mockPrisma.budgetVersion.delete.mockResolvedValue(mockVersion);

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'DELETE',
			url: '/api/v1/versions/1',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(204);
	});

	it('AC-10: DELETE on Published version → 409 VERSION_NOT_DRAFT', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue({
			...mockVersion,
			status: 'Published',
		});

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'DELETE',
			url: '/api/v1/versions/1',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('VERSION_NOT_DRAFT');
	});

	it('AC-10: DELETE on Locked version → 409 VERSION_NOT_DRAFT', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue({
			...mockVersion,
			status: 'Locked',
		});

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'DELETE',
			url: '/api/v1/versions/1',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('VERSION_NOT_DRAFT');
	});

	it('returns 404 when version not found', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(null);

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'DELETE',
			url: '/api/v1/versions/999',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(404);
	});

	it('AC-19: Editor gets 403 on DELETE', async () => {
		const token = await makeToken({ role: 'Editor' });
		const res = await app.inject({
			method: 'DELETE',
			url: '/api/v1/versions/1',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(403);
		expect(res.json().error).toBe('FORBIDDEN');
	});
});
