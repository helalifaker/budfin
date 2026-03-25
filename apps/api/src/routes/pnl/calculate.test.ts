import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { generateKeyPair } from 'jose';
import { setKeys, signAccessToken } from '../../services/token.js';
import { auth } from '../../plugins/auth.js';
import { pnlCalculateRoutes } from './calculate.js';

// ── Mock P&L engine ──────────────────────────────────────────────────────────

const mockCalculatePnl = vi.fn();
vi.mock('../../services/pnl-engine.js', () => ({
	calculatePnl: (...args: unknown[]) => mockCalculatePnl(...args),
}));

// ── Mock Prisma ──────────────────────────────────────────────────────────────

const mockTx = {
	monthlyPnlLine: {
		deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
		createMany: vi.fn().mockResolvedValue({ count: 0 }),
	},
	monthlyBudgetSummary: {
		upsert: vi.fn().mockResolvedValue({}),
	},
	budgetVersion: {
		update: vi.fn().mockResolvedValue({}),
	},
	calculationAuditLog: {
		create: vi.fn().mockResolvedValue({ id: 1 }),
	},
};

vi.mock('../../lib/prisma.js', () => {
	const mockPrisma = {
		budgetVersion: {
			findUnique: vi.fn(),
		},
		monthlyRevenue: {
			findMany: vi.fn(),
		},
		monthlyOtherRevenue: {
			findMany: vi.fn(),
		},
		monthlyStaffCost: {
			findMany: vi.fn(),
		},
		categoryMonthlyCost: {
			findMany: vi.fn(),
		},
		monthlyOpEx: {
			findMany: vi.fn(),
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
	monthlyRevenue: { findMany: ReturnType<typeof vi.fn> };
	monthlyOtherRevenue: { findMany: ReturnType<typeof vi.fn> };
	monthlyStaffCost: { findMany: ReturnType<typeof vi.fn> };
	categoryMonthlyCost: { findMany: ReturnType<typeof vi.fn> };
	monthlyOpEx: { findMany: ReturnType<typeof vi.fn> };
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
const URL = '/api/v1/versions/1/calculate/pnl';

const mockDraftVersion = {
	id: 1,
	name: 'Budget v1',
	status: 'Draft',
	staleModules: [] as string[],
	fiscalYear: 2026,
};

beforeAll(async () => {
	const keys = await generateKeyPair('RS256');
	setKeys(keys.privateKey, keys.publicKey);

	app = Fastify({ logger: false });
	app.setValidatorCompiler(validatorCompiler);
	app.setSerializerCompiler(serializerCompiler);
	await app.register(auth);
	await app.register(pnlCalculateRoutes, { prefix: ROUTE_PREFIX });
	await app.ready();
});

beforeEach(() => {
	vi.clearAllMocks();
});

function setupSuccessMocks() {
	mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);
	mockPrisma.monthlyRevenue.findMany.mockResolvedValue([]);
	mockPrisma.monthlyOtherRevenue.findMany.mockResolvedValue([]);
	mockPrisma.monthlyStaffCost.findMany.mockResolvedValue([]);
	mockPrisma.categoryMonthlyCost.findMany.mockResolvedValue([]);
	mockPrisma.monthlyOpEx.findMany.mockResolvedValue([]);
	mockCalculatePnl.mockReturnValue({
		lines: [],
		summaries: [],
		totals: {
			totalRevenueHt: '0.0000',
			totalStaffCosts: '0.0000',
			ebitda: '0.0000',
			ebitdaMarginPct: '0.0000',
			netProfit: '0.0000',
		},
	});
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/v1/versions/:versionId/calculate/pnl', () => {
	it('returns 200 and recalculates P&L', async () => {
		setupSuccessMocks();

		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: URL,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.runId).toBeDefined();
		expect(body.totalRevenueHt).toBe('0.0000');
		expect(body.totalStaffCosts).toBe('0.0000');
		expect(body.ebitda).toBe('0.0000');
		expect(body.netProfit).toBe('0.0000');
		expect(mockCalculatePnl).toHaveBeenCalledOnce();
	});

	it('persists lines and summaries via transaction', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);
		mockPrisma.monthlyRevenue.findMany.mockResolvedValue([]);
		mockPrisma.monthlyOtherRevenue.findMany.mockResolvedValue([]);
		mockPrisma.monthlyStaffCost.findMany.mockResolvedValue([]);
		mockPrisma.categoryMonthlyCost.findMany.mockResolvedValue([]);
		mockPrisma.monthlyOpEx.findMany.mockResolvedValue([]);
		mockCalculatePnl.mockReturnValue({
			lines: [
				{
					month: 1,
					sectionKey: 'revenue',
					categoryKey: 'tuition',
					lineItemKey: 'gross_revenue',
					displayLabel: 'Gross Revenue',
					depth: 0,
					displayOrder: 1,
					amount: '100000.0000',
					signConvention: 'POSITIVE',
					isSubtotal: false,
					isSeparator: false,
				},
			],
			summaries: [
				{
					month: 1,
					revenueHt: '100000.0000',
					staffCosts: '50000.0000',
					opexCosts: '10000.0000',
					depreciation: '5000.0000',
					impairment: '0.0000',
					ebitda: '40000.0000',
					operatingProfit: '35000.0000',
					financeNet: '0.0000',
					profitBeforeZakat: '35000.0000',
					zakatAmount: '0.0000',
					netProfit: '35000.0000',
				},
			],
			totals: {
				totalRevenueHt: '100000.0000',
				totalStaffCosts: '50000.0000',
				ebitda: '40000.0000',
				ebitdaMarginPct: '40.0000',
				netProfit: '35000.0000',
			},
		});

		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: URL,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		expect(mockPrisma.$transaction).toHaveBeenCalledOnce();
		expect(mockTx.monthlyPnlLine.deleteMany).toHaveBeenCalledWith({
			where: { versionId: 1 },
		});
		expect(mockTx.monthlyPnlLine.createMany).toHaveBeenCalledOnce();
		expect(mockTx.monthlyBudgetSummary.upsert).toHaveBeenCalledOnce();
	});

	it('returns 404 for non-existent version', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(null);

		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/versions/999/calculate/pnl',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('VERSION_NOT_FOUND');
	});

	it('returns 409 VERSION_LOCKED for locked version', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue({
			...mockDraftVersion,
			status: 'Locked',
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
			...mockDraftVersion,
			status: 'Archived',
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

	it('returns 409 when REVENUE is stale', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue({
			...mockDraftVersion,
			staleModules: ['REVENUE'],
		});

		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: URL,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('STALE_PREREQUISITES');
		expect(res.json().staleModules).toContain('REVENUE');
	});

	it('returns 409 when STAFFING is stale', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue({
			...mockDraftVersion,
			staleModules: ['STAFFING'],
		});

		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: URL,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('STALE_PREREQUISITES');
		expect(res.json().staleModules).toContain('STAFFING');
	});

	it('returns 409 when OPEX is stale', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue({
			...mockDraftVersion,
			staleModules: ['OPEX'],
		});

		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: URL,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('STALE_PREREQUISITES');
		expect(res.json().staleModules).toContain('OPEX');
	});

	it('returns 409 when multiple upstream modules are stale', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue({
			...mockDraftVersion,
			staleModules: ['REVENUE', 'STAFFING', 'OPEX'],
		});

		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: URL,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('STALE_PREREQUISITES');
		expect(res.json().staleModules).toHaveLength(3);
	});

	it('returns 401 without auth', async () => {
		const res = await app.inject({
			method: 'POST',
			url: URL,
		});

		expect(res.statusCode).toBe(401);
	});

	it('returns 403 for Viewer role', async () => {
		const token = await makeToken('Viewer');
		const res = await app.inject({
			method: 'POST',
			url: URL,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(403);
	});

	it('allows Editor role', async () => {
		setupSuccessMocks();

		const token = await makeToken('Editor');
		const res = await app.inject({
			method: 'POST',
			url: URL,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
	});
});
