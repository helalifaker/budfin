/**
 * Story #55 — Version Comparison API (remediated)
 *
 * GET /api/v1/versions/compare?primary=A&comparison=B
 *
 * AC-13: Returns nested shape with 12 month rows, annual_totals, version metadata
 * TC-001: All arithmetic via Decimal.js
 * PO-008: Both amounts 0 → absolute=0, percentage=null
 * PO-015: Missing monthly_budget_summary rows treated as 0
 * PO-032: Month-indexed 1-12, always returns exactly 12 rows
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
		sessionId: 'test-session-id',
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
	it('AC-13: returns nested shape with version metadata, 12 month rows, and annual_totals', async () => {
		const primarySummaries = Array.from({ length: 12 }, (_, i) =>
			makeSummary(1, i + 1, {
				revenueHt: '1200.0000',
				staffCosts: '600.0000',
				netProfit: '600.0000',
			})
		);
		const compSummaries = Array.from({ length: 12 }, (_, i) =>
			makeSummary(2, i + 1, {
				revenueHt: '1000.0000',
				staffCosts: '500.0000',
				netProfit: '500.0000',
			})
		);

		mockPrisma.budgetVersion.findUnique
			.mockResolvedValueOnce({ id: 1, name: 'Budget v1' })
			.mockResolvedValueOnce({ id: 2, name: 'Budget v2' });
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

		// Top-level structure
		expect(body.primary_version).toEqual({ id: 1, name: 'Budget v1' });
		expect(body.comparison_version).toEqual({ id: 2, name: 'Budget v2' });
		expect(body.monthly_comparison).toHaveLength(12);
		expect(body.annual_totals).toBeDefined();

		// Month 1 nested shape
		const month1 = body.monthly_comparison[0];
		expect(month1.month).toBe(1);
		expect(month1.primary).toEqual({
			total_revenue_ht: '1200',
			total_staff_costs: '600',
			net_profit: '600',
		});
		expect(month1.comparison).toEqual({
			total_revenue_ht: '1000',
			total_staff_costs: '500',
			net_profit: '500',
		});

		// revenue: (1200 - 1000) = 200 abs, (200/1000)*100 = 20 pct
		expect(Number(month1.variance_absolute.total_revenue_ht)).toBeCloseTo(200, 4);
		expect(Number(month1.variance_pct.total_revenue_ht)).toBeCloseTo(20, 4);
		// staff: (600 - 500) = 100 abs, (100/500)*100 = 20 pct
		expect(Number(month1.variance_absolute.total_staff_costs)).toBeCloseTo(100, 4);
		expect(Number(month1.variance_pct.total_staff_costs)).toBeCloseTo(20, 4);

		// Annual totals
		expect(Number(body.annual_totals.primary.total_revenue_ht)).toBeCloseTo(14400, 4);
		expect(Number(body.annual_totals.comparison.total_revenue_ht)).toBeCloseTo(12000, 4);
		expect(Number(body.annual_totals.variance_absolute.total_revenue_ht)).toBeCloseTo(2400, 4);
		expect(Number(body.annual_totals.variance_pct.total_revenue_ht)).toBeCloseTo(20, 4);
	});

	it('AC-13: always returns exactly 12 month rows even with no data', async () => {
		mockPrisma.budgetVersion.findUnique
			.mockResolvedValueOnce({ id: 1, name: 'V1' })
			.mockResolvedValueOnce({ id: 2, name: 'V2' });
		mockPrisma.monthlyBudgetSummary.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

		const token = await makeToken({ role: 'Viewer' });
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/versions/compare?primary=1&comparison=2',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.monthly_comparison).toHaveLength(12);
		expect(body.monthly_comparison[0].month).toBe(1);
		expect(body.monthly_comparison[11].month).toBe(12);

		// All zero-filled
		const month1 = body.monthly_comparison[0];
		expect(month1.primary.total_revenue_ht).toBe('0');
		expect(month1.comparison.total_revenue_ht).toBe('0');
		expect(month1.variance_absolute.total_revenue_ht).toBe('0');
		expect(month1.variance_pct.total_revenue_ht).toBeNull();
	});

	it('PO-008: both amounts 0 → absolute=0, percentage=null', async () => {
		const zeroSummaries = Array.from({ length: 1 }, (_, i) =>
			makeSummary(1, i + 1, { revenueHt: '0.0000', staffCosts: '0.0000', netProfit: '0.0000' })
		);
		const zeroCompSummaries = Array.from({ length: 1 }, (_, i) =>
			makeSummary(2, i + 1, { revenueHt: '0.0000', staffCosts: '0.0000', netProfit: '0.0000' })
		);

		mockPrisma.budgetVersion.findUnique
			.mockResolvedValueOnce({ id: 1, name: 'V1' })
			.mockResolvedValueOnce({ id: 2, name: 'V2' });
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
		const month1 = body.monthly_comparison[0];
		expect(Number(month1.variance_absolute.total_revenue_ht)).toBe(0);
		expect(month1.variance_pct.total_revenue_ht).toBeNull();
		expect(Number(month1.variance_absolute.total_staff_costs)).toBe(0);
		expect(month1.variance_pct.total_staff_costs).toBeNull();
	});

	it('PO-015: missing rows in primary treated as 0', async () => {
		mockPrisma.budgetVersion.findUnique
			.mockResolvedValueOnce({ id: 1, name: 'V1' })
			.mockResolvedValueOnce({ id: 2, name: 'V2' });
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
		const month1 = body.monthly_comparison[0];
		expect(Number(month1.variance_absolute.total_revenue_ht)).toBeCloseTo(-1000, 4);
		expect(Number(month1.variance_pct.total_revenue_ht)).toBeCloseTo(-100, 4);
	});

	it('PO-015: missing rows in comparison treated as 0 → percentage null (division by zero)', async () => {
		mockPrisma.budgetVersion.findUnique
			.mockResolvedValueOnce({ id: 1, name: 'V1' })
			.mockResolvedValueOnce({ id: 2, name: 'V2' });
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
		const month1 = body.monthly_comparison[0];
		expect(Number(month1.variance_absolute.total_revenue_ht)).toBeCloseTo(500, 4);
		expect(month1.variance_pct.total_revenue_ht).toBeNull(); // comparison=0 → null
	});

	it('returns 404 VERSION_NOT_FOUND when primary version not found', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValueOnce(null);

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/versions/compare?primary=999&comparison=2',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('VERSION_NOT_FOUND');
	});

	it('returns 404 VERSION_NOT_FOUND when comparison version not found', async () => {
		mockPrisma.budgetVersion.findUnique
			.mockResolvedValueOnce({ id: 1, name: 'V1' })
			.mockResolvedValueOnce(null);

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/versions/compare?primary=1&comparison=999',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('VERSION_NOT_FOUND');
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
