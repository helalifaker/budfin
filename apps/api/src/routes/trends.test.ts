import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { generateKeyPair } from 'jose';
import { setKeys, signAccessToken } from '../services/token.js';
import { auth } from '../plugins/auth.js';
import { trendsRoutes } from './trends.js';
import { Decimal } from 'decimal.js';

// ── Mock Prisma ─────────────────────────────────────────────────────────────

vi.mock('../lib/prisma.js', () => {
	const mockPrisma = {
		budgetVersion: { findMany: vi.fn() },
		monthlyBudgetSummary: { findMany: vi.fn() },
		enrollmentHeadcount: { groupBy: vi.fn() },
		employee: { groupBy: vi.fn() },
	};
	return { prisma: mockPrisma };
});

import { prisma } from '../lib/prisma.js';

const mockPrisma = prisma as unknown as {
	budgetVersion: { findMany: ReturnType<typeof vi.fn> };
	monthlyBudgetSummary: { findMany: ReturnType<typeof vi.fn> };
	enrollmentHeadcount: { groupBy: ReturnType<typeof vi.fn> };
	employee: { groupBy: ReturnType<typeof vi.fn> };
};

let app: FastifyInstance;

const URL = '/api/v1/trends';

async function makeToken(role = 'Admin') {
	return signAccessToken({
		sub: 1,
		email: 'admin@budfin.app',
		role,
		sessionId: 'test-session',
	});
}

function headers(token: string) {
	return { authorization: `Bearer ${token}` };
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
	await app.register(trendsRoutes, { prefix: '/api/v1' });
	await app.ready();
});

describe('GET /trends', () => {
	it('returns empty when no locked/archived versions exist', async () => {
		mockPrisma.budgetVersion.findMany.mockResolvedValue([]);
		const token = await makeToken();

		const res = await app.inject({
			method: 'GET',
			url: URL,
			headers: headers(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.years).toEqual([]);
		expect(body.growth).toEqual({});
	});

	it('returns 401 without auth', async () => {
		const res = await app.inject({
			method: 'GET',
			url: URL,
		});

		expect(res.statusCode).toBe(401);
	});

	it('returns trends for multiple fiscal years', async () => {
		const now = new Date();
		mockPrisma.budgetVersion.findMany.mockResolvedValue([
			{
				id: 2,
				fiscalYear: 2026,
				name: 'Budget 2026',
				status: 'Locked',
				updatedAt: now,
			},
			{
				id: 1,
				fiscalYear: 2025,
				name: 'Budget 2025',
				status: 'Locked',
				updatedAt: now,
			},
		]);

		mockPrisma.monthlyBudgetSummary.findMany.mockResolvedValue([
			{
				versionId: 1,
				month: 1,
				revenueHt: new Decimal('100000'),
				staffCosts: new Decimal('60000'),
				opexCosts: new Decimal('10000'),
				netProfit: new Decimal('30000'),
				ebitda: new Decimal('30000'),
			},
			{
				versionId: 2,
				month: 1,
				revenueHt: new Decimal('120000'),
				staffCosts: new Decimal('65000'),
				opexCosts: new Decimal('12000'),
				netProfit: new Decimal('43000'),
				ebitda: new Decimal('43000'),
			},
		]);

		mockPrisma.enrollmentHeadcount.groupBy.mockResolvedValue([
			{ versionId: 1, _sum: { headcount: 500 } },
			{ versionId: 2, _sum: { headcount: 550 } },
		]);

		mockPrisma.employee.groupBy.mockResolvedValue([
			{ versionId: 1, _sum: { hourlyPercentage: new Decimal('100.0') }, _count: { id: 50 } },
			{ versionId: 2, _sum: { hourlyPercentage: new Decimal('110.0') }, _count: { id: 55 } },
		]);

		const token = await makeToken();

		const res = await app.inject({
			method: 'GET',
			url: URL,
			headers: headers(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.years).toHaveLength(2);
		expect(body.years[0].fiscalYear).toBe('2025-2026');
		expect(body.years[1].fiscalYear).toBe('2026-2027');
		expect(body.years[0].metrics.totalRevenue).toBe('100000.00');
		expect(body.years[1].metrics.totalRevenue).toBe('120000.00');

		// Growth rates
		expect(body.growth.revenue).toHaveLength(2);
		expect(body.growth.revenue[0]).toBeNull(); // first year, no growth
		expect(body.growth.revenue[1]).toBe('0.2000'); // 20% growth
	});

	it('prefers Locked over Archived for same fiscal year', async () => {
		const now = new Date();
		const earlier = new Date(now.getTime() - 100000);

		mockPrisma.budgetVersion.findMany.mockResolvedValue([
			{
				id: 2,
				fiscalYear: 2025,
				name: 'Budget 2025 Locked',
				status: 'Locked',
				updatedAt: earlier,
			},
			{
				id: 1,
				fiscalYear: 2025,
				name: 'Budget 2025 Archived',
				status: 'Archived',
				updatedAt: now,
			},
		]);

		mockPrisma.monthlyBudgetSummary.findMany.mockResolvedValue([]);
		mockPrisma.enrollmentHeadcount.groupBy.mockResolvedValue([]);
		mockPrisma.employee.groupBy.mockResolvedValue([]);

		const token = await makeToken();

		const res = await app.inject({
			method: 'GET',
			url: URL,
			headers: headers(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.years).toHaveLength(1);
		expect(body.years[0].versionName).toBe('Budget 2025 Locked');
	});

	it('prefers newer updatedAt when same status', async () => {
		const older = new Date('2025-01-01');
		const newer = new Date('2025-06-01');

		mockPrisma.budgetVersion.findMany.mockResolvedValue([
			{
				id: 1,
				fiscalYear: 2025,
				name: 'Old Locked',
				status: 'Locked',
				updatedAt: older,
			},
			{
				id: 2,
				fiscalYear: 2025,
				name: 'New Locked',
				status: 'Locked',
				updatedAt: newer,
			},
		]);

		mockPrisma.monthlyBudgetSummary.findMany.mockResolvedValue([]);
		mockPrisma.enrollmentHeadcount.groupBy.mockResolvedValue([]);
		mockPrisma.employee.groupBy.mockResolvedValue([]);

		const token = await makeToken();

		const res = await app.inject({
			method: 'GET',
			url: URL,
			headers: headers(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		// The findMany returns desc order, so id=1 is processed first, then id=2
		// Since id=2 has newer updatedAt and same status, it should win
		expect(body.years[0].versionName).toBe('New Locked');
	});

	it('handles version with no summary data (zeros)', async () => {
		const now = new Date();
		mockPrisma.budgetVersion.findMany.mockResolvedValue([
			{
				id: 1,
				fiscalYear: 2025,
				name: 'Empty Budget',
				status: 'Locked',
				updatedAt: now,
			},
		]);

		mockPrisma.monthlyBudgetSummary.findMany.mockResolvedValue([]);
		mockPrisma.enrollmentHeadcount.groupBy.mockResolvedValue([]);
		mockPrisma.employee.groupBy.mockResolvedValue([]);

		const token = await makeToken();

		const res = await app.inject({
			method: 'GET',
			url: URL,
			headers: headers(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.years).toHaveLength(1);
		expect(body.years[0].metrics.totalRevenue).toBe('0.00');
		expect(body.years[0].metrics.totalEnrollment).toBe(0);
		expect(body.years[0].metrics.totalFte).toBe('0.0');
	});

	it('respects the years query parameter', async () => {
		const now = new Date();
		const versions = Array.from({ length: 10 }, (_, i) => ({
			id: i + 1,
			fiscalYear: 2020 + i,
			name: `Budget ${2020 + i}`,
			status: 'Locked' as const,
			updatedAt: now,
		}));

		mockPrisma.budgetVersion.findMany.mockResolvedValue(versions);
		mockPrisma.monthlyBudgetSummary.findMany.mockResolvedValue([]);
		mockPrisma.enrollmentHeadcount.groupBy.mockResolvedValue([]);
		mockPrisma.employee.groupBy.mockResolvedValue([]);

		const token = await makeToken();

		const res = await app.inject({
			method: 'GET',
			url: `${URL}?years=3`,
			headers: headers(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.years).toHaveLength(3);
		// Should be the last 3 years
		expect(body.years[0].fiscalYear).toBe('2027-2028');
	});

	it('YoY growth is null when previous value is zero', async () => {
		const now = new Date();
		mockPrisma.budgetVersion.findMany.mockResolvedValue([
			{
				id: 1,
				fiscalYear: 2025,
				name: 'Budget 2025',
				status: 'Locked',
				updatedAt: now,
			},
			{
				id: 2,
				fiscalYear: 2026,
				name: 'Budget 2026',
				status: 'Locked',
				updatedAt: now,
			},
		]);

		// Version 1 has zero revenue, version 2 has some revenue
		mockPrisma.monthlyBudgetSummary.findMany.mockResolvedValue([
			{
				versionId: 2,
				month: 1,
				revenueHt: new Decimal('50000'),
				staffCosts: new Decimal('0'),
				opexCosts: new Decimal('0'),
				netProfit: new Decimal('50000'),
				ebitda: new Decimal('50000'),
			},
		]);

		mockPrisma.enrollmentHeadcount.groupBy.mockResolvedValue([]);
		mockPrisma.employee.groupBy.mockResolvedValue([]);

		const token = await makeToken();

		const res = await app.inject({
			method: 'GET',
			url: URL,
			headers: headers(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		// Growth from 0 to 50000 should be null (division by zero)
		expect(body.growth.revenue[1]).toBeNull();
	});
});
