import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { generateKeyPair } from 'jose';
import { auth } from '../../plugins/auth.js';
import { discountRoutes } from './discounts.js';
import { setKeys, signAccessToken } from '../../services/token.js';

// ── Mock Prisma ─────────────────────────────────────────────────────────────

vi.mock('../../lib/prisma.js', () => {
	const mockPrisma = {
		budgetVersion: {
			findUnique: vi.fn(),
			update: vi.fn(),
		},
		discountPolicy: {
			findMany: vi.fn(),
			upsert: vi.fn(),
		},
		auditEntry: {
			create: vi.fn().mockResolvedValue({ id: 1 }),
		},
		$transaction: vi
			.fn()
			.mockImplementation((fn: (tx: Record<string, unknown>) => unknown) => fn(mockPrisma)),
	};
	return { prisma: mockPrisma };
});

import { prisma } from '../../lib/prisma.js';

const mockPrisma = prisma as unknown as {
	budgetVersion: {
		findUnique: ReturnType<typeof vi.fn>;
		update: ReturnType<typeof vi.fn>;
	};
	discountPolicy: {
		findMany: ReturnType<typeof vi.fn>;
		upsert: ReturnType<typeof vi.fn>;
	};
	auditEntry: { create: ReturnType<typeof vi.fn> };
	$transaction: ReturnType<typeof vi.fn>;
};

let app: FastifyInstance;

async function makeToken(role = 'Admin') {
	return signAccessToken({
		sub: 1,
		email: 'admin@budfin.app',
		role,
		sessionId: 'discount-session',
	});
}

function authHeader(token: string) {
	return { authorization: `Bearer ${token}` };
}

const ROUTE_PREFIX = '/api/v1/versions/:versionId';
const URL_PREFIX = '/api/v1/versions/1';

const mockVersion = {
	id: 1,
	name: 'Budget v1',
	status: 'Draft',
	staleModules: [],
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
	await app.register(discountRoutes, { prefix: ROUTE_PREFIX });
	await app.ready();

	mockPrisma.budgetVersion.update.mockResolvedValue({});
	mockPrisma.discountPolicy.upsert.mockResolvedValue({});
});

// ── GET /discounts ──────────────────────────────────────────────────────────

describe('GET /discounts', () => {
	it('returns empty entries when no policies exist', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockVersion);
		mockPrisma.discountPolicy.findMany.mockResolvedValue([]);

		const token = await makeToken('Viewer');
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/discounts`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		expect(res.json().entries).toEqual([]);
	});

	it('returns formatted discount policies with 6-decimal precision', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockVersion);
		mockPrisma.discountPolicy.findMany.mockResolvedValue([
			{
				tariff: 'RP',
				nationality: 'Francais',
				discountRate: '0.250000',
			},
			{
				tariff: 'R3+',
				nationality: null,
				discountRate: '0.100000',
			},
		]);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/discounts`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.entries).toHaveLength(2);
		expect(body.entries[0].discountRate).toBe('0.250000');
		expect(body.entries[1].discountRate).toBe('0.100000');
	});

	it('returns 404 for non-existent version', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(null);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/discounts`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('VERSION_NOT_FOUND');
	});

	it('returns 401 without authentication', async () => {
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/discounts`,
		});

		expect(res.statusCode).toBe(401);
	});
});

// ── PUT /discounts ──────────────────────────────────────────────────────────

describe('PUT /discounts', () => {
	const validPayload = {
		entries: [{ tariff: 'RP', nationality: 'Francais', discountRate: '0.250000' }],
	};

	it('upserts discount policies and marks modules stale', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockVersion);

		const token = await makeToken('Editor');
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/discounts`,
			headers: authHeader(token),
			payload: validPayload,
		});

		expect(res.statusCode).toBe(200);
		expect(res.json().updated).toBe(1);
		expect(mockPrisma.discountPolicy.upsert).toHaveBeenCalledOnce();
		expect(mockPrisma.budgetVersion.update).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: 1 },
				data: { staleModules: expect.arrayContaining(['REVENUE', 'PNL']) },
			})
		);
		expect(mockPrisma.auditEntry.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					operation: 'DISCOUNT_POLICY_UPDATED',
				}),
			})
		);
	});

	it('returns 409 for non-Draft version', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue({
			...mockVersion,
			status: 'Published',
		});

		const token = await makeToken();
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/discounts`,
			headers: authHeader(token),
			payload: validPayload,
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('VERSION_LOCKED');
	});

	it('returns 404 for non-existent version', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(null);

		const token = await makeToken();
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/discounts`,
			headers: authHeader(token),
			payload: validPayload,
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('VERSION_NOT_FOUND');
	});

	it('returns 422 for discount rate > 1', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockVersion);

		const token = await makeToken();
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/discounts`,
			headers: authHeader(token),
			payload: {
				entries: [{ tariff: 'RP', nationality: 'Francais', discountRate: '1.500000' }],
			},
		});

		expect(res.statusCode).toBe(422);
		expect(res.json().code).toBe('INVALID_DISCOUNT_RATE');
	});

	it('returns 400 for negative discount rate (fails regex validation)', async () => {
		const token = await makeToken();
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/discounts`,
			headers: authHeader(token),
			payload: {
				entries: [
					{
						tariff: 'RP',
						nationality: 'Francais',
						discountRate: '-0.100000',
					},
				],
			},
		});

		expect(res.statusCode).toBe(400);
	});

	it('returns 400 for empty entries array', async () => {
		const token = await makeToken();
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/discounts`,
			headers: authHeader(token),
			payload: { entries: [] },
		});

		expect(res.statusCode).toBe(400);
	});

	it('returns 400 for invalid discountRate format', async () => {
		const token = await makeToken();
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/discounts`,
			headers: authHeader(token),
			payload: {
				entries: [{ tariff: 'RP', nationality: 'Francais', discountRate: 'abc' }],
			},
		});

		expect(res.statusCode).toBe(400);
	});

	it('returns 403 for Viewer role', async () => {
		const token = await makeToken('Viewer');
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/discounts`,
			headers: authHeader(token),
			payload: validPayload,
		});

		expect(res.statusCode).toBe(403);
		expect(res.json().code).toBe('FORBIDDEN');
	});

	it('accepts BudgetOwner role', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockVersion);

		const token = await makeToken('BudgetOwner');
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/discounts`,
			headers: authHeader(token),
			payload: validPayload,
		});

		expect(res.statusCode).toBe(200);
	});
});
