/**
 * Story #56 — Latest Estimate API
 *
 * GET /api/v1/versions/:id/latest-estimate
 *
 * AC-16: For each month 1-12:
 *   - If fiscal period is Locked → use actualVersionId's monthly_budget_summary (source: ACTUAL)
 *   - If fiscal period is Draft → use the requested version's monthly_budget_summary (source: FORECAST)
 * All 12 months returned; missing summary rows return zeros
 * All roles can call this (read-only)
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
		fiscalPeriod: {
			findMany: vi.fn().mockResolvedValue([]),
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
	fiscalPeriod: {
		findMany: ReturnType<typeof vi.fn>;
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

function makePeriod(fiscalYear: number, month: number, overrides: Record<string, unknown> = {}) {
	return {
		id: fiscalYear * 100 + month,
		fiscalYear,
		month,
		status: 'Draft',
		actualVersionId: null,
		lockedAt: null,
		lockedById: null,
		createdAt: now,
		updatedAt: now,
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

describe('GET /api/v1/versions/:id/latest-estimate', () => {
	it('AC-16: returns 12 months blending ACTUAL and FORECAST sources', async () => {
		const version = { id: 1, fiscalYear: 2026, createdBy: { email: 'admin@budfin.app' } };
		// months 1-6 locked with actualVersionId=10, months 7-12 draft
		const periods = [
			...Array.from({ length: 6 }, (_, i) =>
				makePeriod(2026, i + 1, { status: 'Locked', actualVersionId: 10 }),
			),
			...Array.from({ length: 6 }, (_, i) => makePeriod(2026, i + 7)),
		];
		// Actual version summaries (months 1-6)
		const actualSummaries = Array.from({ length: 6 }, (_, i) =>
			makeSummary(10, i + 1, { revenueHt: '2000.0000' }),
		);
		// Forecast version summaries (months 7-12)
		const forecastSummaries = Array.from({ length: 6 }, (_, i) =>
			makeSummary(1, i + 7, { revenueHt: '1500.0000' }),
		);

		mockPrisma.budgetVersion.findUnique.mockResolvedValue(version);
		mockPrisma.fiscalPeriod.findMany.mockResolvedValue(periods);
		mockPrisma.monthlyBudgetSummary.findMany
			.mockResolvedValueOnce(actualSummaries) // actual version summaries
			.mockResolvedValueOnce(forecastSummaries); // forecast version summaries

		const token = await makeToken({ role: 'Viewer' });
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/versions/1/latest-estimate',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.months).toHaveLength(12);

		// Months 1-6: ACTUAL source, revenue = 2000
		const month1 = body.months.find((m: { month: number }) => m.month === 1);
		expect(month1.source).toBe('ACTUAL');
		expect(Number(month1.revenueHt)).toBeCloseTo(2000, 2);

		// Months 7-12: FORECAST source, revenue = 1500
		const month7 = body.months.find((m: { month: number }) => m.month === 7);
		expect(month7.source).toBe('FORECAST');
		expect(Number(month7.revenueHt)).toBeCloseTo(1500, 2);
	});

	it('months with no summary rows return zeros', async () => {
		const version = { id: 1, fiscalYear: 2026, createdBy: { email: 'admin@budfin.app' } };
		const periods = Array.from({ length: 12 }, (_, i) => makePeriod(2026, i + 1)); // all Draft

		mockPrisma.budgetVersion.findUnique.mockResolvedValue(version);
		mockPrisma.fiscalPeriod.findMany.mockResolvedValue(periods);
		// No actual summaries needed (all draft), forecast = empty
		mockPrisma.monthlyBudgetSummary.findMany
			.mockResolvedValueOnce([]) // actual (none locked, so no actual summaries)
			.mockResolvedValueOnce([]); // forecast — empty

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/versions/1/latest-estimate',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.months).toHaveLength(12);
		const month1 = body.months[0];
		expect(Number(month1.revenueHt)).toBe(0);
		expect(Number(month1.staffCosts)).toBe(0);
		expect(Number(month1.netProfit)).toBe(0);
		expect(month1.source).toBe('FORECAST');
	});

	it('returns 404 when version not found', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(null);

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/versions/999/latest-estimate',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(404);
	});

	it('all roles can access (Viewer)', async () => {
		const version = { id: 1, fiscalYear: 2026, createdBy: { email: 'admin@budfin.app' } };
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(version);
		mockPrisma.fiscalPeriod.findMany.mockResolvedValue([]);
		mockPrisma.monthlyBudgetSummary.findMany
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([]);

		const token = await makeToken({ role: 'Viewer' });
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/versions/1/latest-estimate',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
	});
});
