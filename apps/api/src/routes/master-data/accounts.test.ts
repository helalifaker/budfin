import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { generateKeyPair } from 'jose';
import { Prisma } from '@prisma/client';
import { setKeys, signAccessToken } from '../../services/token.js';
import { auth } from '../../plugins/auth.js';
import { accountRoutes } from './accounts.js';

vi.mock('../../lib/prisma.js', () => {
	const mockPrisma = {
		chartOfAccount: {
			findMany: vi.fn(),
			findUnique: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
			delete: vi.fn(),
		},
		auditEntry: {
			create: vi.fn().mockResolvedValue({ id: 1 }),
		},
		$transaction: vi.fn().mockImplementation((fn: (tx: Record<string, unknown>) => unknown) =>
			fn({
				chartOfAccount: mockPrisma.chartOfAccount,
				auditEntry: mockPrisma.auditEntry,
			})
		),
	};
	return { prisma: mockPrisma };
});

import { prisma } from '../../lib/prisma.js';

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

const mockAccount = {
	id: 1,
	accountCode: 'REV001',
	accountName: 'Tuition Revenue',
	type: 'REVENUE' as const,
	ifrsCategory: 'Revenue from Contracts',
	centerType: 'PROFIT_CENTER' as const,
	description: null,
	status: 'ACTIVE' as const,
	version: 1,
	createdAt: now,
	updatedAt: now,
	createdBy: 1,
	updatedBy: 1,
};

const mockAccount2 = {
	...mockAccount,
	id: 2,
	accountCode: 'EXP001',
	accountName: 'Salary Expense',
	type: 'EXPENSE' as const,
	centerType: 'COST_CENTER' as const,
	ifrsCategory: 'Employee Benefits',
};

beforeAll(async () => {
	const keys = await generateKeyPair('RS256');
	setKeys(keys.privateKey, keys.publicKey);

	app = Fastify({ logger: false });
	app.setValidatorCompiler(validatorCompiler);
	app.setSerializerCompiler(serializerCompiler);
	await app.register(auth);
	await app.register(accountRoutes, {
		prefix: '/api/v1/master-data/accounts',
	});
	await app.ready();
});

beforeEach(() => {
	vi.clearAllMocks();
});

describe('GET /api/v1/master-data/accounts', () => {
	it('returns all accounts', async () => {
		vi.mocked(prisma.chartOfAccount.findMany).mockResolvedValue([mockAccount, mockAccount2]);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/master-data/accounts',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.accounts).toHaveLength(2);
	});

	it('filters by type', async () => {
		vi.mocked(prisma.chartOfAccount.findMany).mockResolvedValue([mockAccount]);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/master-data/accounts?type=REVENUE',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		expect(vi.mocked(prisma.chartOfAccount.findMany)).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({ type: 'REVENUE' }),
			})
		);
	});

	it('filters by search (case-insensitive)', async () => {
		vi.mocked(prisma.chartOfAccount.findMany).mockResolvedValue([mockAccount]);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/master-data/accounts?search=tuition',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const call = vi.mocked(prisma.chartOfAccount.findMany).mock.calls[0]![0];
		expect(call?.where?.OR).toEqual([
			{ accountCode: { contains: 'tuition', mode: 'insensitive' } },
			{ accountName: { contains: 'tuition', mode: 'insensitive' } },
		]);
	});

	it('accessible by Viewer role', async () => {
		vi.mocked(prisma.chartOfAccount.findMany).mockResolvedValue([]);

		const token = await makeToken({ role: 'Viewer' });
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/master-data/accounts',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
	});

	it('returns 401 without auth', async () => {
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/master-data/accounts',
		});

		expect(res.statusCode).toBe(401);
	});
});

describe('GET /api/v1/master-data/accounts/:id', () => {
	it('returns account by id', async () => {
		vi.mocked(prisma.chartOfAccount.findUnique).mockResolvedValue(mockAccount);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/master-data/accounts/1',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		expect(res.json().accountCode).toBe('REV001');
	});

	it('returns 404 for non-existent id', async () => {
		vi.mocked(prisma.chartOfAccount.findUnique).mockResolvedValue(null);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/master-data/accounts/999',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('NOT_FOUND');
	});
});

describe('POST /api/v1/master-data/accounts', () => {
	const createPayload = {
		accountCode: 'REV001',
		accountName: 'Tuition Revenue',
		type: 'REVENUE',
		ifrsCategory: 'Revenue from Contracts',
		centerType: 'PROFIT_CENTER',
	};

	it('creates account with 201', async () => {
		vi.mocked(prisma.chartOfAccount.create).mockResolvedValue(mockAccount);

		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/master-data/accounts',
			headers: authHeader(token),
			payload: createPayload,
		});

		expect(res.statusCode).toBe(201);
		expect(res.json().accountCode).toBe('REV001');
		expect(prisma.auditEntry.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					operation: 'ACCOUNT_CREATED',
					tableName: 'chart_of_accounts',
				}),
			})
		);
	});

	it('returns 409 for duplicate code', async () => {
		const error = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
			code: 'P2002',
			clientVersion: '6.0.0',
		});
		vi.mocked(prisma.chartOfAccount.create).mockRejectedValue(error);

		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/master-data/accounts',
			headers: authHeader(token),
			payload: createPayload,
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('DUPLICATE_CODE');
	});

	it('returns 403 for Viewer role', async () => {
		const token = await makeToken({ role: 'Viewer' });
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/master-data/accounts',
			headers: authHeader(token),
			payload: createPayload,
		});

		expect(res.statusCode).toBe(403);
	});

	it('returns 403 for Editor role', async () => {
		const token = await makeToken({ role: 'Editor' });
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/master-data/accounts',
			headers: authHeader(token),
			payload: createPayload,
		});

		expect(res.statusCode).toBe(403);
	});
});

describe('PUT /api/v1/master-data/accounts/:id', () => {
	const updatePayload = {
		accountCode: 'REV001',
		accountName: 'Updated Revenue',
		type: 'REVENUE',
		ifrsCategory: 'Revenue from Contracts',
		centerType: 'PROFIT_CENTER',
		version: 1,
	};

	it('updates account with optimistic lock', async () => {
		vi.mocked(prisma.chartOfAccount.findUnique).mockResolvedValue(mockAccount);
		vi.mocked(prisma.chartOfAccount.update).mockResolvedValue({
			...mockAccount,
			accountName: 'Updated Revenue',
			version: 2,
		});

		const token = await makeToken();
		const res = await app.inject({
			method: 'PUT',
			url: '/api/v1/master-data/accounts/1',
			headers: authHeader(token),
			payload: updatePayload,
		});

		expect(res.statusCode).toBe(200);
		expect(res.json().accountName).toBe('Updated Revenue');
		expect(prisma.auditEntry.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					operation: 'ACCOUNT_UPDATED',
				}),
			})
		);
	});

	it('returns 404 for non-existent id', async () => {
		vi.mocked(prisma.chartOfAccount.findUnique).mockResolvedValue(null);

		const token = await makeToken();
		const res = await app.inject({
			method: 'PUT',
			url: '/api/v1/master-data/accounts/999',
			headers: authHeader(token),
			payload: updatePayload,
		});

		expect(res.statusCode).toBe(404);
	});

	it('returns 409 for version mismatch', async () => {
		vi.mocked(prisma.chartOfAccount.findUnique).mockResolvedValue({ ...mockAccount, version: 2 });

		const token = await makeToken();
		const res = await app.inject({
			method: 'PUT',
			url: '/api/v1/master-data/accounts/1',
			headers: authHeader(token),
			payload: updatePayload,
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('OPTIMISTIC_LOCK');
	});

	it('returns 409 for duplicate code on update', async () => {
		vi.mocked(prisma.chartOfAccount.findUnique).mockResolvedValue(mockAccount);
		const error = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
			code: 'P2002',
			clientVersion: '6.0.0',
		});
		vi.mocked(prisma.chartOfAccount.update).mockRejectedValue(error);

		const token = await makeToken();
		const res = await app.inject({
			method: 'PUT',
			url: '/api/v1/master-data/accounts/1',
			headers: authHeader(token),
			payload: updatePayload,
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('DUPLICATE_CODE');
	});

	it('returns 403 for Viewer role', async () => {
		const token = await makeToken({ role: 'Viewer' });
		const res = await app.inject({
			method: 'PUT',
			url: '/api/v1/master-data/accounts/1',
			headers: authHeader(token),
			payload: updatePayload,
		});

		expect(res.statusCode).toBe(403);
	});
});

describe('DELETE /api/v1/master-data/accounts/:id', () => {
	it('deletes account with 204', async () => {
		vi.mocked(prisma.chartOfAccount.findUnique).mockResolvedValue(mockAccount);
		vi.mocked(prisma.chartOfAccount.delete).mockResolvedValue(mockAccount);

		const token = await makeToken();
		const res = await app.inject({
			method: 'DELETE',
			url: '/api/v1/master-data/accounts/1',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(204);
		expect(prisma.auditEntry.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					operation: 'ACCOUNT_DELETED',
				}),
			})
		);
	});

	it('returns 404 for non-existent id', async () => {
		vi.mocked(prisma.chartOfAccount.findUnique).mockResolvedValue(null);

		const token = await makeToken();
		const res = await app.inject({
			method: 'DELETE',
			url: '/api/v1/master-data/accounts/999',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(404);
	});

	it('returns 409 for referenced record', async () => {
		vi.mocked(prisma.chartOfAccount.findUnique).mockResolvedValue(mockAccount);
		const error = new Prisma.PrismaClientKnownRequestError('Foreign key constraint', {
			code: 'P2003',
			clientVersion: '6.0.0',
		});
		vi.mocked(prisma.chartOfAccount.delete).mockRejectedValue(error);

		const token = await makeToken();
		const res = await app.inject({
			method: 'DELETE',
			url: '/api/v1/master-data/accounts/1',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('REFERENCED_RECORD');
	});

	it('returns 403 for Viewer role', async () => {
		const token = await makeToken({ role: 'Viewer' });
		const res = await app.inject({
			method: 'DELETE',
			url: '/api/v1/master-data/accounts/1',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(403);
	});
});
