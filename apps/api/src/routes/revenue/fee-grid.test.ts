import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { generateKeyPair } from 'jose';
import { auth } from '../../plugins/auth.js';
import { feeGridRoutes } from './fee-grid.js';
import { setKeys, signAccessToken } from '../../services/token.js';

// ── Mock Prisma ─────────────────────────────────────────────────────────────

vi.mock('../../lib/prisma.js', () => {
	const mockPrisma = {
		budgetVersion: {
			findUnique: vi.fn(),
			update: vi.fn(),
		},
		feeGrid: {
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
	feeGrid: {
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
		sessionId: 'fee-grid-session',
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

// tuitionTtc = 11500, Francais (15% VAT), tuitionHt = 11500 / 1.15 = 10000
const validEntry = {
	academicPeriod: 'AY1',
	gradeLevel: 'PS',
	nationality: 'Francais',
	tariff: 'RP',
	dai: '500.0000',
	tuitionTtc: '11500.0000',
	tuitionHt: '10000.0000',
	term1Amount: '3833.3300',
	term2Amount: '3833.3300',
	term3Amount: '3833.3400',
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
	await app.register(feeGridRoutes, { prefix: ROUTE_PREFIX });
	await app.ready();

	mockPrisma.budgetVersion.update.mockResolvedValue({});
	mockPrisma.feeGrid.upsert.mockResolvedValue({});
});

// ── GET /fee-grid ───────────────────────────────────────────────────────────

describe('GET /fee-grid', () => {
	it('returns empty entries when no fee grids exist', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockVersion);
		mockPrisma.feeGrid.findMany.mockResolvedValue([]);

		const token = await makeToken('Viewer');
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/fee-grid`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		expect(res.json().entries).toEqual([]);
	});

	it('returns formatted fee grid entries with 4-decimal precision', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockVersion);
		mockPrisma.feeGrid.findMany.mockResolvedValue([
			{
				academicPeriod: 'AY1',
				gradeLevel: 'PS',
				nationality: 'Francais',
				tariff: 'RP',
				dai: '500',
				tuitionTtc: '11500',
				tuitionHt: '10000',
				term1Amount: '3833.33',
				term2Amount: '3833.33',
				term3Amount: '3833.34',
			},
		]);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/fee-grid`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const entry = res.json().entries[0];
		expect(entry.dai).toBe('500.0000');
		expect(entry.tuitionTtc).toBe('11500.0000');
		expect(entry.tuitionHt).toBe('10000.0000');
	});

	it('filters by academic_period query param', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockVersion);
		mockPrisma.feeGrid.findMany.mockResolvedValue([]);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/fee-grid?academic_period=AY1`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		expect(mockPrisma.feeGrid.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { versionId: 1, academicPeriod: 'AY1' },
			})
		);
	});

	it('returns 404 for non-existent version', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(null);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/fee-grid`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('VERSION_NOT_FOUND');
	});

	it('returns 401 without authentication', async () => {
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/fee-grid`,
		});

		expect(res.statusCode).toBe(401);
	});
});

// ── PUT /fee-grid ───────────────────────────────────────────────────────────

describe('PUT /fee-grid', () => {
	const validPayload = { entries: [validEntry] };

	it('upserts fee grid entries and marks modules stale', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockVersion);

		const token = await makeToken('Editor');
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/fee-grid`,
			headers: authHeader(token),
			payload: validPayload,
		});

		expect(res.statusCode).toBe(200);
		expect(res.json().updated).toBe(1);
		expect(mockPrisma.feeGrid.upsert).toHaveBeenCalledOnce();
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
			status: 'Locked',
		});

		const token = await makeToken();
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/fee-grid`,
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
			url: `${URL_PREFIX}/fee-grid`,
			headers: authHeader(token),
			payload: validPayload,
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('VERSION_NOT_FOUND');
	});

	it('returns 422 for VAT mismatch (tuitionHt does not match)', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockVersion);

		const token = await makeToken();
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/fee-grid`,
			headers: authHeader(token),
			payload: {
				entries: [
					{
						...validEntry,
						tuitionHt: '5000.0000', // intentionally wrong
					},
				],
			},
		});

		expect(res.statusCode).toBe(422);
		expect(res.json().code).toBe('VAT_MISMATCH');
		expect(res.json().errors).toHaveLength(1);
	});

	it('accepts Nationaux with 0% VAT (tuitionHt = tuitionTtc)', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockVersion);

		const token = await makeToken();
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/fee-grid`,
			headers: authHeader(token),
			payload: {
				entries: [
					{
						...validEntry,
						nationality: 'Nationaux',
						tuitionTtc: '10000.0000',
						tuitionHt: '10000.0000',
					},
				],
			},
		});

		expect(res.statusCode).toBe(200);
	});

	it('returns 400 for empty entries array', async () => {
		const token = await makeToken();
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/fee-grid`,
			headers: authHeader(token),
			payload: { entries: [] },
		});

		expect(res.statusCode).toBe(400);
	});

	it('returns 403 for Viewer role', async () => {
		const token = await makeToken('Viewer');
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/fee-grid`,
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
			url: `${URL_PREFIX}/fee-grid`,
			headers: authHeader(token),
			payload: validPayload,
		});

		expect(mockPrisma.auditEntry.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					operation: 'FEE_GRID_UPDATED',
				}),
			})
		);
	});
});
