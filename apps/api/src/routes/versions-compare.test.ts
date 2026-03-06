/**
 * Story #55 — Version Comparison API
 *
 * GET /api/v1/versions/compare?primary=A&comparison=B
 *
 * AC-13: Returns month 1-12 variance rows (abs + pct) for revenue, staff costs, net profit
 * TC-001: All arithmetic via Decimal.js
 * PO-008: Both amounts 0 → absolute=0, percentage=null
 * PO-015: Missing monthly_budget_summary rows treated as 0
 * PO-032: Month-indexed 1-12, no academic calendar logic
 * All roles can call this endpoint (read-only)
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { generateKeyPair } from 'jose';
import { setKeys, signAccessToken } from '../services/token.js';
import { auth } from '../plugins/auth.js';
import { versionRoutes } from './versions.js';

vi.mock('../lib/prisma.js', () => {
	const mockPrisma = {
		budgetVersion: {
			findUnique: vi.fn(),
		},
		monthlyBudgetSummary: {
			findMany: vi.fn().mockResolvedValue([]),
		},
	};
	return { prisma: mockPrisma };
});

import { prisma } from '../lib/prisma.js';

const mockPrisma = prisma as unknown as {
	budgetVersion: {
		findUnique: ReturnType<typeof vi.fn>;
	};
	monthlyBudgetSummary: {
		findMany: ReturnType<typeof vi.fn>;
	};
};

let app: FastifyInstance;
const now = new Date();

async function makeToken(overrides: { sub?: number; role?: string } = {}) {
	return signAccessToken({
		sub: overrides.sub ?? 1,
		email: 'admin@budfin.app',
		role: overrides.role ?? 'Viewer',
	});
}

function authHeader(token: string) {
	return { authorization: `Bearer ${token}` };
}

function makeSummary(versionId: number, month: number, overrides: Record<string, unknown> = {}) {
	return {
		id: versionId * 100 + month,
		versionId,
		month,
		revenueHt: '1000.0000',
		staffCosts: '500.0000',
		netProfit: '500.0000',
		calculatedAt: now,
		...overrides,
	};
}

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

describe('GET /api/v1/versions/compare', () => {
	it('AC-13: returns 12 month rows with abs and pct variance fields', async () => {
		// primary version has months 1-12, comparison version has months 1-12
		const primarySummaries = Array.from({ length: 12 }, (_, i) =>
			makeSummary(1, i + 1, {
				revenueHt: '1200.0000',
				staffCosts: '600.0000',
				netProfit: '600.0000',
			}),
		);
		const compSummaries = Array.from({ length: 12 }, (_, i) =>
			makeSummary(2, i + 1, {
				revenueHt: '1000.0000',
				staffCosts: '500.0000',
				netProfit: '500.0000',
			}),
		);

		mockPrisma.budgetVersion.findUnique
			.mockResolvedValueOnce({ id: 1 })
			.mockResolvedValueOnce({ id: 2 });
		mockPrisma.monthlyBudgetSummary.findMany
			.mockResolvedValueOnce(primarySummaries)
			.mockResolvedValueOnce(compSummaries);

		const token = await makeToken({ role: 'Viewer' });
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/versions/compare?primary=1&comparison=2',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body).toHaveLength(12);

		const month1 = body[0];
		expect(month1.month).toBe(1);
		// revenue: (1200 - 1000) = 200 abs, (200/1000)*100 = 20 pct
		expect(Number(month1.revenue_abs)).toBeCloseTo(200, 4);
		expect(Number(month1.revenue_pct)).toBeCloseTo(20, 4);
		// staff: (600 - 500) = 100 abs, (100/500)*100 = 20 pct
		expect(Number(month1.staff_costs_abs)).toBeCloseTo(100, 4);
		expect(Number(month1.staff_costs_pct)).toBeCloseTo(20, 4);
		// net: (600 - 500) = 100 abs, 20 pct
		expect(Number(month1.net_profit_abs)).toBeCloseTo(100, 4);
		expect(Number(month1.net_profit_pct)).toBeCloseTo(20, 4);
	});

	it('PO-008: both amounts 0 → absolute=0, percentage=null', async () => {
		const zeroSummaries = Array.from({ length: 1 }, (_, i) =>
			makeSummary(1, i + 1, { revenueHt: '0.0000', staffCosts: '0.0000', netProfit: '0.0000' }),
		);
		const zeroCompSummaries = Array.from({ length: 1 }, (_, i) =>
			makeSummary(2, i + 1, { revenueHt: '0.0000', staffCosts: '0.0000', netProfit: '0.0000' }),
		);

		mockPrisma.budgetVersion.findUnique
			.mockResolvedValueOnce({ id: 1 })
			.mockResolvedValueOnce({ id: 2 });
		mockPrisma.monthlyBudgetSummary.findMany
			.mockResolvedValueOnce(zeroSummaries)
			.mockResolvedValueOnce(zeroCompSummaries);

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/versions/compare?primary=1&comparison=2',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		const month1 = body[0];
		expect(Number(month1.revenue_abs)).toBe(0);
		expect(month1.revenue_pct).toBeNull();
		expect(Number(month1.staff_costs_abs)).toBe(0);
		expect(month1.staff_costs_pct).toBeNull();
	});

	it('PO-015: missing rows in primary treated as 0', async () => {
		// primary has no summaries, comparison has month 1
		mockPrisma.budgetVersion.findUnique
			.mockResolvedValueOnce({ id: 1 })
			.mockResolvedValueOnce({ id: 2 });
		mockPrisma.monthlyBudgetSummary.findMany
			.mockResolvedValueOnce([]) // primary — empty
			.mockResolvedValueOnce([makeSummary(2, 1, { revenueHt: '1000.0000' })]); // comparison

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/versions/compare?primary=1&comparison=2',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		// month 1: primary=0, comparison=1000 → abs = -1000, pct = -100
		const month1 = body.find((m: { month: number }) => m.month === 1);
		expect(month1).toBeDefined();
		expect(Number(month1.revenue_abs)).toBeCloseTo(-1000, 4);
		expect(Number(month1.revenue_pct)).toBeCloseTo(-100, 4);
	});

	it('PO-015: missing rows in comparison treated as 0 → percentage null (division by zero)', async () => {
		mockPrisma.budgetVersion.findUnique
			.mockResolvedValueOnce({ id: 1 })
			.mockResolvedValueOnce({ id: 2 });
		mockPrisma.monthlyBudgetSummary.findMany
			.mockResolvedValueOnce([makeSummary(1, 1, { revenueHt: '500.0000' })]) // primary
			.mockResolvedValueOnce([]); // comparison — empty

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/versions/compare?primary=1&comparison=2',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		const month1 = body.find((m: { month: number }) => m.month === 1);
		expect(Number(month1.revenue_abs)).toBeCloseTo(500, 4);
		expect(month1.revenue_pct).toBeNull(); // comparison=0 → null
	});

	it('returns empty array when neither version has summaries', async () => {
		mockPrisma.budgetVersion.findUnique
			.mockResolvedValueOnce({ id: 1 })
			.mockResolvedValueOnce({ id: 2 });
		mockPrisma.monthlyBudgetSummary.findMany
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([]);

		const token = await makeToken({ role: 'Viewer' });
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/versions/compare?primary=1&comparison=2',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual([]);
	});

	it('returns 404 when primary version not found', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValueOnce(null);

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/versions/compare?primary=999&comparison=2',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('NOT_FOUND');
	});

	it('returns 404 when comparison version not found', async () => {
		mockPrisma.budgetVersion.findUnique
			.mockResolvedValueOnce({ id: 1 })
			.mockResolvedValueOnce(null);

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/versions/compare?primary=1&comparison=999',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('NOT_FOUND');
	});

	it('returns 401 without token', async () => {
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/versions/compare?primary=1&comparison=2',
		});

		expect(res.statusCode).toBe(401);
	});

	it('returns 400 when primary or comparison params are missing', async () => {
		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/versions/compare?primary=1',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(400);
	});
});
