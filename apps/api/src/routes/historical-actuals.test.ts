import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { generateKeyPair } from 'jose';
import { Decimal } from 'decimal.js';
import { setKeys, signAccessToken } from '../services/token.js';
import { auth } from '../plugins/auth.js';
import { historicalActualRoutes } from './historical-actuals.js';

vi.mock('../lib/prisma.js', () => {
	const mockPrisma = {
		historicalActual: {
			findMany: vi.fn(),
			findUnique: vi.fn(),
			upsert: vi.fn(),
			update: vi.fn(),
			delete: vi.fn(),
		},
		auditEntry: {
			create: vi.fn().mockResolvedValue({ id: 1 }),
		},
		$transaction: vi.fn().mockImplementation((fn: (tx: Record<string, unknown>) => unknown) =>
			fn({
				historicalActual: mockPrisma.historicalActual,
				auditEntry: mockPrisma.auditEntry,
			})
		),
	};
	return { prisma: mockPrisma };
});

import { prisma } from '../lib/prisma.js';

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

const now = new Date();

const mockActual = {
	id: 1,
	fiscalYear: 2024,
	accountCode: 'REV001',
	annualAmount: new Decimal('100000.0000'),
	q1Amount: new Decimal('25000.0000'),
	q2Amount: new Decimal('25000.0000'),
	q3Amount: new Decimal('25000.0000'),
	source: 'MANUAL' as const,
	importedAt: now,
};

const mockActual2 = {
	...mockActual,
	id: 2,
	fiscalYear: 2025,
	accountCode: 'EXP001',
	annualAmount: new Decimal('50000.0000'),
	q1Amount: null,
	q2Amount: null,
	q3Amount: null,
};

beforeAll(async () => {
	const keys = await generateKeyPair('RS256');
	setKeys(keys.privateKey, keys.publicKey);

	app = Fastify({ logger: false });
	app.setValidatorCompiler(validatorCompiler);
	app.setSerializerCompiler(serializerCompiler);
	await app.register(auth);
	await app.register(historicalActualRoutes, {
		prefix: '/api/v1/historical-actuals',
	});
	await app.ready();
});

beforeEach(() => {
	vi.clearAllMocks();
});

describe('GET /api/v1/historical-actuals', () => {
	it('returns all actuals', async () => {
		vi.mocked(prisma.historicalActual.findMany).mockResolvedValue([mockActual, mockActual2]);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/historical-actuals',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.actuals).toHaveLength(2);
	});

	it('filters by fiscalYear', async () => {
		vi.mocked(prisma.historicalActual.findMany).mockResolvedValue([mockActual]);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/historical-actuals?fiscalYear=2024',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		expect(vi.mocked(prisma.historicalActual.findMany)).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({ fiscalYear: 2024 }),
			})
		);
	});

	it('is accessible by Viewer role', async () => {
		vi.mocked(prisma.historicalActual.findMany).mockResolvedValue([]);

		const token = await makeToken({ role: 'Viewer' });
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/historical-actuals',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
	});

	it('returns 401 without auth', async () => {
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/historical-actuals',
		});

		expect(res.statusCode).toBe(401);
	});
});

describe('POST /api/v1/historical-actuals/bulk', () => {
	const bulkPayload = {
		actuals: [
			{
				fiscalYear: 2024,
				accountCode: 'REV001',
				annualAmount: 100000,
				q1Amount: 25000,
				q2Amount: 25000,
				q3Amount: 25000,
			},
			{
				fiscalYear: 2024,
				accountCode: 'EXP001',
				annualAmount: 50000,
			},
		],
	};

	it('bulk imports actuals with 201', async () => {
		vi.mocked(prisma.historicalActual.upsert).mockResolvedValue(mockActual);

		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/historical-actuals/bulk',
			headers: authHeader(token),
			payload: bulkPayload,
		});

		expect(res.statusCode).toBe(201);
		expect(res.json().imported).toBe(2);
		expect(prisma.historicalActual.upsert).toHaveBeenCalledTimes(2);
		expect(prisma.auditEntry.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					operation: 'HISTORICAL_ACTUALS_BULK_IMPORT',
					tableName: 'historical_actuals',
				}),
			})
		);
	});

	it('upserts based on fiscalYear + accountCode composite key', async () => {
		vi.mocked(prisma.historicalActual.upsert).mockResolvedValue(mockActual);

		const token = await makeToken();
		await app.inject({
			method: 'POST',
			url: '/api/v1/historical-actuals/bulk',
			headers: authHeader(token),
			payload: { actuals: [bulkPayload.actuals[0]] },
		});

		expect(prisma.historicalActual.upsert).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					fiscalYear_accountCode: {
						fiscalYear: 2024,
						accountCode: 'REV001',
					},
				},
			})
		);
	});

	it('returns 400 for empty actuals array', async () => {
		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/historical-actuals/bulk',
			headers: authHeader(token),
			payload: { actuals: [] },
		});

		expect(res.statusCode).toBe(400);
	});

	it('returns 403 for Viewer role', async () => {
		const token = await makeToken({ role: 'Viewer' });
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/historical-actuals/bulk',
			headers: authHeader(token),
			payload: bulkPayload,
		});

		expect(res.statusCode).toBe(403);
	});
});

describe('PUT /api/v1/historical-actuals/:id', () => {
	const updatePayload = {
		annualAmount: 120000,
		q1Amount: 30000,
		q2Amount: 30000,
		q3Amount: 30000,
	};

	it('updates single actual', async () => {
		const updatedActual = {
			...mockActual,
			annualAmount: new Decimal('120000.0000'),
			q1Amount: new Decimal('30000.0000'),
			q2Amount: new Decimal('30000.0000'),
			q3Amount: new Decimal('30000.0000'),
		};
		vi.mocked(prisma.historicalActual.findUnique).mockResolvedValue(mockActual);
		vi.mocked(prisma.historicalActual.update).mockResolvedValue(updatedActual);

		const token = await makeToken();
		const res = await app.inject({
			method: 'PUT',
			url: '/api/v1/historical-actuals/1',
			headers: authHeader(token),
			payload: updatePayload,
		});

		expect(res.statusCode).toBe(200);
		expect(prisma.auditEntry.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					operation: 'HISTORICAL_ACTUAL_UPDATED',
				}),
			})
		);
	});

	it('returns 404 for non-existent id', async () => {
		vi.mocked(prisma.historicalActual.findUnique).mockResolvedValue(null);

		const token = await makeToken();
		const res = await app.inject({
			method: 'PUT',
			url: '/api/v1/historical-actuals/999',
			headers: authHeader(token),
			payload: updatePayload,
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('NOT_FOUND');
	});

	it('returns 403 for Viewer role', async () => {
		const token = await makeToken({ role: 'Viewer' });
		const res = await app.inject({
			method: 'PUT',
			url: '/api/v1/historical-actuals/1',
			headers: authHeader(token),
			payload: updatePayload,
		});

		expect(res.statusCode).toBe(403);
	});
});

describe('DELETE /api/v1/historical-actuals/:id', () => {
	it('deletes actual with 204', async () => {
		vi.mocked(prisma.historicalActual.findUnique).mockResolvedValue(mockActual);
		vi.mocked(prisma.historicalActual.delete).mockResolvedValue(mockActual);

		const token = await makeToken();
		const res = await app.inject({
			method: 'DELETE',
			url: '/api/v1/historical-actuals/1',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(204);
		expect(prisma.auditEntry.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					operation: 'HISTORICAL_ACTUAL_DELETED',
				}),
			})
		);
	});

	it('returns 404 for non-existent id', async () => {
		vi.mocked(prisma.historicalActual.findUnique).mockResolvedValue(null);

		const token = await makeToken();
		const res = await app.inject({
			method: 'DELETE',
			url: '/api/v1/historical-actuals/999',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('NOT_FOUND');
	});

	it('returns 403 for Viewer role', async () => {
		const token = await makeToken({ role: 'Viewer' });
		const res = await app.inject({
			method: 'DELETE',
			url: '/api/v1/historical-actuals/1',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(403);
	});
});
