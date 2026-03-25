import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { generateKeyPair } from 'jose';
import { setKeys, signAccessToken } from '../../services/token.js';
import { auth } from '../../plugins/auth.js';
import { opExCalculateRoutes } from './calculate.js';

// ── Mock OpEx engine ─────────────────────────────────────────────────────────

const mockComputeOpEx = vi.fn();
vi.mock('../../services/opex/opex-engine.js', () => ({
	computeOpEx: (...args: unknown[]) => mockComputeOpEx(...args),
}));

// ── Mock Prisma ──────────────────────────────────────────────────────────────

const mockTx = {
	monthlyOpEx: {
		upsert: vi.fn().mockResolvedValue({}),
	},
	budgetVersion: {
		update: vi.fn().mockResolvedValue({}),
	},
};

vi.mock('../../lib/prisma.js', () => {
	const mockPrisma = {
		budgetVersion: {
			findUnique: vi.fn(),
		},
		versionOpExLineItem: {
			findMany: vi.fn(),
		},
		monthlyRevenue: {
			groupBy: vi.fn(),
		},
		monthlyOtherRevenue: {
			groupBy: vi.fn(),
		},
		monthlyOpEx: {
			upsert: vi.fn().mockResolvedValue({}),
		},
		auditEntry: {
			create: vi.fn().mockResolvedValue({ id: 1 }),
		},
		$transaction: vi
			.fn()
			.mockImplementation((fn: (tx: Record<string, unknown>) => unknown) => fn(mockTx)),
	};
	return { prisma: mockPrisma };
});

import { prisma } from '../../lib/prisma.js';

const mockPrisma = prisma as unknown as {
	budgetVersion: { findUnique: ReturnType<typeof vi.fn> };
	versionOpExLineItem: { findMany: ReturnType<typeof vi.fn> };
	monthlyRevenue: { groupBy: ReturnType<typeof vi.fn> };
	monthlyOtherRevenue: { groupBy: ReturnType<typeof vi.fn> };
	$transaction: ReturnType<typeof vi.fn>;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

let app: FastifyInstance;

async function makeToken(role = 'Admin') {
	return signAccessToken({
		sub: 1,
		email: 'admin@budfin.app',
		role,
		sessionId: 'test-session-id',
	});
}

function authHeader(token: string) {
	return { authorization: `Bearer ${token}` };
}

const ROUTE_PREFIX = '/api/v1/versions/:versionId/calculate';
const URL = '/api/v1/versions/1/calculate/opex';

const mockDraftVersion = {
	id: 1,
	status: 'Draft',
	staleModules: [] as string[],
};

beforeAll(async () => {
	const keys = await generateKeyPair('RS256');
	setKeys(keys.privateKey, keys.publicKey);

	app = Fastify({ logger: false });
	app.setValidatorCompiler(validatorCompiler);
	app.setSerializerCompiler(serializerCompiler);
	await app.register(auth);
	await app.register(opExCalculateRoutes, { prefix: ROUTE_PREFIX });
	await app.ready();
});

beforeEach(() => {
	vi.clearAllMocks();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/v1/versions/:versionId/calculate/opex', () => {
	it('returns 200 and recalculates OpEx', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);
		mockPrisma.versionOpExLineItem.findMany.mockResolvedValue([]);
		mockPrisma.monthlyRevenue.groupBy.mockResolvedValue([]);
		mockPrisma.monthlyOtherRevenue.groupBy.mockResolvedValue([]);
		mockComputeOpEx.mockReturnValue({
			computedLineItems: [],
			totalOperating: '0.0000',
			totalNonOperating: '0.0000',
		});

		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: URL,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.lineItemCount).toBe(0);
		expect(body.monthlyRecordCount).toBe(0);
		expect(body.totalOperating).toBe('0.0000');
		expect(body.totalNonOperating).toBe('0.0000');
		expect(mockComputeOpEx).toHaveBeenCalledOnce();
	});

	it('persists computed line items via transaction', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);
		mockPrisma.versionOpExLineItem.findMany.mockResolvedValue([
			{
				id: 10,
				sectionType: 'OPERATING',
				ifrsCategory: 'Supplies',
				lineItemName: 'Office Supplies',
				computeMethod: 'MANUAL',
				computeRate: null,
				monthlyAmounts: [{ month: 1, amount: '1000.0000' }],
			},
		]);
		mockPrisma.monthlyRevenue.groupBy.mockResolvedValue([]);
		mockPrisma.monthlyOtherRevenue.groupBy.mockResolvedValue([]);
		mockComputeOpEx.mockReturnValue({
			computedLineItems: [{ lineItemId: 10, month: 1, amount: '1000.0000' }],
			totalOperating: '1000.0000',
			totalNonOperating: '0.0000',
		});

		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: URL,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		expect(res.json().monthlyRecordCount).toBe(1);
		expect(mockPrisma.$transaction).toHaveBeenCalledOnce();
	});

	it('returns 404 for non-existent version', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(null);

		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/versions/999/calculate/opex',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().message).toContain('not found');
	});

	it('returns 409 VERSION_LOCKED for locked version', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue({
			id: 1,
			status: 'Locked',
			staleModules: [],
		});

		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: URL,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('VERSION_LOCKED');
	});

	it('returns 409 VERSION_LOCKED for archived version', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue({
			id: 1,
			status: 'Archived',
			staleModules: [],
		});

		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: URL,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('VERSION_LOCKED');
	});

	it('returns 409 REVENUE_STALE when REVENUE is stale', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue({
			id: 1,
			status: 'Draft',
			staleModules: ['REVENUE'],
		});

		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: URL,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('REVENUE_STALE');
	});

	it('returns 401 without auth', async () => {
		const res = await app.inject({
			method: 'POST',
			url: URL,
		});

		expect(res.statusCode).toBe(401);
	});

	it('returns 403 for Viewer (needs data:edit)', async () => {
		const token = await makeToken('Viewer');
		const res = await app.inject({
			method: 'POST',
			url: URL,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(403);
	});

	it('allows Editor role (has data:edit)', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);
		mockPrisma.versionOpExLineItem.findMany.mockResolvedValue([]);
		mockPrisma.monthlyRevenue.groupBy.mockResolvedValue([]);
		mockPrisma.monthlyOtherRevenue.groupBy.mockResolvedValue([]);
		mockComputeOpEx.mockReturnValue({
			computedLineItems: [],
			totalOperating: '0.0000',
			totalNonOperating: '0.0000',
		});

		const token = await makeToken('Editor');
		const res = await app.inject({
			method: 'POST',
			url: URL,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
	});
});
