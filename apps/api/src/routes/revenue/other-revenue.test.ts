import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { generateKeyPair } from 'jose';
import { auth } from '../../plugins/auth.js';
import { otherRevenueRoutes } from './other-revenue.js';
import { setKeys, signAccessToken } from '../../services/token.js';

// ── Mock Prisma ─────────────────────────────────────────────────────────────

vi.mock('../../lib/prisma.js', () => {
	const mockPrisma = {
		budgetVersion: {
			findUnique: vi.fn(),
			update: vi.fn(),
		},
		otherRevenueItem: {
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
	otherRevenueItem: {
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
		sessionId: 'other-rev-session',
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

const validItem = {
	lineItemName: 'Frais de Dossier AY1',
	annualAmount: '5000.0000',
	distributionMethod: 'ACADEMIC_10',
	ifrsCategory: 'Registration Fees',
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
	await app.register(otherRevenueRoutes, { prefix: ROUTE_PREFIX });
	await app.ready();

	mockPrisma.budgetVersion.update.mockResolvedValue({});
	mockPrisma.otherRevenueItem.upsert.mockResolvedValue({});
});

// ── GET /other-revenue ──────────────────────────────────────────────────────

describe('GET /other-revenue', () => {
	it('returns empty items when no other revenue exists', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockVersion);
		mockPrisma.otherRevenueItem.findMany.mockResolvedValue([]);

		const token = await makeToken('Viewer');
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/other-revenue`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		expect(res.json().items).toEqual([]);
	});

	it('returns formatted items with 4-decimal precision', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockVersion);
		mockPrisma.otherRevenueItem.findMany.mockResolvedValue([
			{
				id: 1,
				lineItemName: 'Frais de Dossier AY1',
				annualAmount: '5000',
				distributionMethod: 'ACADEMIC_10',
				weightArray: null,
				specificMonths: [],
				ifrsCategory: 'Registration Fees',
			},
		]);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/other-revenue`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const item = res.json().items[0];
		expect(item.annualAmount).toBe('5000.0000');
		expect(item.lineItemName).toBe('Frais de Dossier AY1');
	});

	it('returns 404 for non-existent version', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(null);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/other-revenue`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('VERSION_NOT_FOUND');
	});

	it('returns 401 without authentication', async () => {
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/other-revenue`,
		});

		expect(res.statusCode).toBe(401);
	});
});

// ── PUT /other-revenue ──────────────────────────────────────────────────────

describe('PUT /other-revenue', () => {
	const validPayload = { items: [validItem] };

	it('upserts other revenue items and marks modules stale', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockVersion);

		const token = await makeToken('Editor');
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/other-revenue`,
			headers: authHeader(token),
			payload: validPayload,
		});

		expect(res.statusCode).toBe(200);
		expect(res.json().updated).toBe(1);
		expect(mockPrisma.otherRevenueItem.upsert).toHaveBeenCalledOnce();
		expect(mockPrisma.budgetVersion.update).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: 1 },
				data: {
					staleModules: expect.arrayContaining(['REVENUE', 'PNL']),
				},
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
			url: `${URL_PREFIX}/other-revenue`,
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
			url: `${URL_PREFIX}/other-revenue`,
			headers: authHeader(token),
			payload: validPayload,
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('VERSION_NOT_FOUND');
	});

	it('accepts CUSTOM_WEIGHTS with valid weight array', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockVersion);

		const token = await makeToken();
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/other-revenue`,
			headers: authHeader(token),
			payload: {
				items: [
					{
						...validItem,
						distributionMethod: 'CUSTOM_WEIGHTS',
						weightArray: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
					},
				],
			},
		});

		expect(res.statusCode).toBe(200);
	});

	it('returns 422 for CUSTOM_WEIGHTS with zero-sum weight array', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockVersion);

		const token = await makeToken();
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/other-revenue`,
			headers: authHeader(token),
			payload: {
				items: [
					{
						...validItem,
						distributionMethod: 'CUSTOM_WEIGHTS',
						weightArray: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
					},
				],
			},
		});

		expect(res.statusCode).toBe(422);
		expect(res.json().code).toBe('INVALID_WEIGHT_ARRAY');
	});

	it('rejects CUSTOM_WEIGHTS without weight array', async () => {
		const token = await makeToken();
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/other-revenue`,
			headers: authHeader(token),
			payload: {
				items: [
					{
						...validItem,
						distributionMethod: 'CUSTOM_WEIGHTS',
					},
				],
			},
		});

		expect(res.statusCode).toBe(400);
	});

	it('accepts SPECIFIC_PERIOD with specific_months', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockVersion);

		const token = await makeToken();
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/other-revenue`,
			headers: authHeader(token),
			payload: {
				items: [
					{
						...validItem,
						distributionMethod: 'SPECIFIC_PERIOD',
						specificMonths: [1, 9],
					},
				],
			},
		});

		expect(res.statusCode).toBe(200);
	});

	it('rejects SPECIFIC_PERIOD without specific_months', async () => {
		const token = await makeToken();
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/other-revenue`,
			headers: authHeader(token),
			payload: {
				items: [
					{
						...validItem,
						distributionMethod: 'SPECIFIC_PERIOD',
					},
				],
			},
		});

		expect(res.statusCode).toBe(400);
	});

	it('returns 400 for empty items array', async () => {
		const token = await makeToken();
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/other-revenue`,
			headers: authHeader(token),
			payload: { items: [] },
		});

		expect(res.statusCode).toBe(400);
	});

	it('returns 403 for Viewer role', async () => {
		const token = await makeToken('Viewer');
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/other-revenue`,
			headers: authHeader(token),
			payload: validPayload,
		});

		expect(res.statusCode).toBe(403);
		expect(res.json().code).toBe('FORBIDDEN');
	});

	it('creates audit entry on successful upsert', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockVersion);

		const token = await makeToken();
		await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/other-revenue`,
			headers: authHeader(token),
			payload: validPayload,
		});

		expect(mockPrisma.auditEntry.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					operation: 'OTHER_REVENUE_UPDATED',
				}),
			})
		);
	});
});
