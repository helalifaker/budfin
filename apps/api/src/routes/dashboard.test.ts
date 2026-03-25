import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { generateKeyPair } from 'jose';
import { setKeys, signAccessToken } from '../services/token.js';
import { auth } from '../plugins/auth.js';
import { dashboardRoutes } from './dashboard.js';

vi.mock('../lib/prisma.js', () => ({
	prisma: {
		budgetVersion: {
			findUnique: vi.fn(),
		},
		monthlyBudgetSummary: {
			findMany: vi.fn(),
		},
		enrollmentHeadcount: {
			aggregate: vi.fn(),
		},
	},
}));

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

const ROUTE_PREFIX = '/api/v1/versions/:versionId';
const URL_PREFIX = '/api/v1/versions/1';

const mockVersion = {
	id: 1,
	name: 'Budget v1',
	status: 'Draft',
	staleModules: ['REVENUE'],
};

beforeAll(async () => {
	const keys = await generateKeyPair('RS256');
	setKeys(keys.privateKey, keys.publicKey);

	app = Fastify({ logger: false });
	app.setValidatorCompiler(validatorCompiler);
	app.setSerializerCompiler(serializerCompiler);
	await app.register(auth);
	await app.register(dashboardRoutes, { prefix: ROUTE_PREFIX });
	await app.ready();
});

beforeEach(() => {
	vi.clearAllMocks();
});

describe('GET /dashboard', () => {
	it('returns 200 with KPI data for a valid version', async () => {
		vi.mocked(prisma.budgetVersion.findUnique).mockResolvedValue(mockVersion as never);
		vi.mocked(prisma.monthlyBudgetSummary.findMany).mockResolvedValue([]);
		vi.mocked(prisma.enrollmentHeadcount.aggregate).mockResolvedValue({
			_sum: { headcount: 0 },
			_count: 0,
			_avg: { headcount: null },
			_min: { headcount: null },
			_max: { headcount: null },
		} as never);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/dashboard`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body).toHaveProperty('kpis');
		expect(body).toHaveProperty('monthlyTrend');
		expect(body).toHaveProperty('staleModules');
		expect(body).toHaveProperty('lastCalculatedAt');
		expect(body.monthlyTrend).toHaveLength(12);
	});

	it('returns 404 for non-existent version', async () => {
		vi.mocked(prisma.budgetVersion.findUnique).mockResolvedValue(null);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/dashboard`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('VERSION_NOT_FOUND');
	});

	it('returns 401 without auth token', async () => {
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/dashboard`,
		});

		expect(res.statusCode).toBe(401);
	});

	it('returns staleModules from the version', async () => {
		vi.mocked(prisma.budgetVersion.findUnique).mockResolvedValue({
			...mockVersion,
			staleModules: ['REVENUE', 'STAFFING', 'PNL'],
		} as never);
		vi.mocked(prisma.monthlyBudgetSummary.findMany).mockResolvedValue([]);
		vi.mocked(prisma.enrollmentHeadcount.aggregate).mockResolvedValue({
			_sum: { headcount: 0 },
			_count: 0,
			_avg: { headcount: null },
			_min: { headcount: null },
			_max: { headcount: null },
		} as never);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/dashboard`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.staleModules).toEqual(['REVENUE', 'STAFFING', 'PNL']);
	});

	it('returns zero/empty values when no calculation results exist', async () => {
		vi.mocked(prisma.budgetVersion.findUnique).mockResolvedValue(mockVersion as never);
		vi.mocked(prisma.monthlyBudgetSummary.findMany).mockResolvedValue([]);
		vi.mocked(prisma.enrollmentHeadcount.aggregate).mockResolvedValue({
			_sum: { headcount: 0 },
			_count: 0,
			_avg: { headcount: null },
			_min: { headcount: null },
			_max: { headcount: null },
		} as never);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/dashboard`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.kpis.totalRevenue).toBe('0.0000');
		expect(body.kpis.totalStaffCosts).toBe('0.0000');
		expect(body.kpis.enrollmentCount).toBe(0);
		expect(body.kpis.costPerStudent).toBe('0.0000');
		expect(body.kpis.ebitda).toBe('0.0000');
		expect(body.kpis.ebitdaMarginPct).toBe('0.00');
		expect(body.kpis.netProfit).toBe('0.0000');
		expect(body.lastCalculatedAt).toBeNull();

		// All monthly trend entries should be zero
		for (const entry of body.monthlyTrend) {
			expect(entry.revenue).toBe('0.0000');
			expect(entry.staffCosts).toBe('0.0000');
			expect(entry.opex).toBe('0.0000');
			expect(entry.netProfit).toBe('0.0000');
		}
	});

	it('returns correct KPI values when budget summary data exists', async () => {
		vi.mocked(prisma.budgetVersion.findUnique).mockResolvedValue(mockVersion as never);
		vi.mocked(prisma.monthlyBudgetSummary.findMany).mockResolvedValue([
			{
				id: 1,
				versionId: 1,
				month: 1,
				revenueHt: '1000000.0000',
				staffCosts: '400000.0000',
				opexCosts: '100000.0000',
				ebitda: '500000.0000',
				netProfit: '450000.0000',
				calculatedAt: new Date('2026-03-20T08:00:00Z'),
			},
			{
				id: 2,
				versionId: 1,
				month: 2,
				revenueHt: '1200000.0000',
				staffCosts: '420000.0000',
				opexCosts: '110000.0000',
				ebitda: '670000.0000',
				netProfit: '600000.0000',
				calculatedAt: new Date('2026-03-20T08:00:00Z'),
			},
		] as never);
		vi.mocked(prisma.enrollmentHeadcount.aggregate).mockResolvedValue({
			_sum: { headcount: 500 },
			_count: 0,
			_avg: { headcount: null },
			_min: { headcount: null },
			_max: { headcount: null },
		} as never);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/dashboard`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();

		// totalRevenue = 1000000 + 1200000 = 2200000
		expect(body.kpis.totalRevenue).toBe('2200000.0000');
		// totalStaffCosts = 400000 + 420000 = 820000
		expect(body.kpis.totalStaffCosts).toBe('820000.0000');
		expect(body.kpis.enrollmentCount).toBe(500);
		// costPerStudent = 820000 / 500 = 1640
		expect(body.kpis.costPerStudent).toBe('1640.0000');
		// ebitda = 500000 + 670000 = 1170000
		expect(body.kpis.ebitda).toBe('1170000.0000');
		// ebitdaMarginPct = (1170000 / 2200000) * 100 = 53.18...
		expect(body.kpis.ebitdaMarginPct).toBe('53.18');
		// netProfit = 450000 + 600000 = 1050000
		expect(body.kpis.netProfit).toBe('1050000.0000');
		expect(body.lastCalculatedAt).toBe('2026-03-20T08:00:00.000Z');

		// Monthly trend should include data for months 1 and 2, zeros for the rest
		expect(body.monthlyTrend[0].revenue).toBe('1000000.0000');
		expect(body.monthlyTrend[1].revenue).toBe('1200000.0000');
		expect(body.monthlyTrend[2].revenue).toBe('0.0000');
	});

	it('allows Viewer role to read dashboard (data:view)', async () => {
		vi.mocked(prisma.budgetVersion.findUnique).mockResolvedValue(mockVersion as never);
		vi.mocked(prisma.monthlyBudgetSummary.findMany).mockResolvedValue([]);
		vi.mocked(prisma.enrollmentHeadcount.aggregate).mockResolvedValue({
			_sum: { headcount: 0 },
			_count: 0,
			_avg: { headcount: null },
			_min: { headcount: null },
			_max: { headcount: null },
		} as never);

		const token = await makeToken({ role: 'Viewer' });
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/dashboard`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
	});
});
