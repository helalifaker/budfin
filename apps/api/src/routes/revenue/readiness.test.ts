import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { generateKeyPair } from 'jose';
import { auth } from '../../plugins/auth.js';
import { revenueReadinessRoutes } from './readiness.js';
import { setKeys, signAccessToken } from '../../services/token.js';

vi.mock('../../lib/prisma.js', () => {
	const mockPrisma = {
		budgetVersion: {
			findUnique: vi.fn(),
		},
		feeGrid: {
			count: vi.fn(),
		},
		otherRevenueItem: {
			count: vi.fn(),
		},
		discountPolicy: {
			findMany: vi.fn(),
		},
		enrollmentDetail: {
			findMany: vi.fn(),
		},
		nationalityBreakdown: {
			findMany: vi.fn(),
		},
	};
	return { prisma: mockPrisma };
});

import { prisma } from '../../lib/prisma.js';

const mockPrisma = prisma as unknown as {
	budgetVersion: { findUnique: ReturnType<typeof vi.fn> };
	feeGrid: { count: ReturnType<typeof vi.fn> };
	otherRevenueItem: { count: ReturnType<typeof vi.fn> };
	discountPolicy: { findMany: ReturnType<typeof vi.fn> };
	enrollmentDetail: { findMany: ReturnType<typeof vi.fn> };
	nationalityBreakdown: { findMany: ReturnType<typeof vi.fn> };
};

let app: FastifyInstance;

async function makeToken(role = 'Admin') {
	return signAccessToken({
		sub: 1,
		email: 'admin@budfin.app',
		role,
		sessionId: 'readiness-session',
	});
}

function authHeader(token: string) {
	return { authorization: `Bearer ${token}` };
}

const ROUTE_PREFIX = '/api/v1/versions/:versionId';
const URL_PREFIX = '/api/v1/versions/1';

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
	await app.register(revenueReadinessRoutes, { prefix: ROUTE_PREFIX });
	await app.ready();

	mockPrisma.budgetVersion.findUnique.mockResolvedValue({ id: 1 });
	mockPrisma.feeGrid.count.mockResolvedValue(0);
	mockPrisma.otherRevenueItem.count.mockResolvedValue(0);
	mockPrisma.discountPolicy.findMany.mockResolvedValue([]);
	mockPrisma.enrollmentDetail.findMany.mockResolvedValue([]);
	mockPrisma.nationalityBreakdown.findMany.mockResolvedValue([]);
});

describe('GET /revenue/readiness', () => {
	it('returns overallReady true when all four areas are configured', async () => {
		mockPrisma.feeGrid.count.mockResolvedValue(90);
		mockPrisma.otherRevenueItem.count.mockResolvedValueOnce(20).mockResolvedValueOnce(20);
		mockPrisma.discountPolicy.findMany.mockResolvedValue([
			{ tariff: 'RP', discountRate: '0.250000' },
			{ tariff: 'R3+', discountRate: '0.100000' },
		]);
		mockPrisma.enrollmentDetail.findMany.mockResolvedValue([
			{ academicPeriod: 'AY1', gradeLevel: 'CP', nationality: 'Francais', headcount: 10 },
			{ academicPeriod: 'AY1', gradeLevel: 'CP', nationality: 'Francais', headcount: 2 },
		]);
		mockPrisma.nationalityBreakdown.findMany.mockResolvedValue([
			{ academicPeriod: 'AY1', gradeLevel: 'CP', nationality: 'Francais', headcount: 12 },
		]);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/revenue/readiness`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual({
			feeGrid: { total: 90, complete: 90, ready: true },
			tariffAssignment: { reconciled: true, ready: true },
			discounts: { rpRate: '0.250000', r3Rate: '0.100000', ready: true },
			otherRevenue: { total: 20, configured: 20, ready: true },
			overallReady: true,
			readyCount: 4,
			totalCount: 4,
		});
	});

	it('returns all areas not ready when nothing is configured', async () => {
		const token = await makeToken('Viewer');
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/revenue/readiness`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual({
			feeGrid: { total: 0, complete: 0, ready: false },
			tariffAssignment: { reconciled: false, ready: false },
			discounts: { rpRate: null, r3Rate: null, ready: false },
			otherRevenue: { total: 0, configured: 0, ready: false },
			overallReady: false,
			readyCount: 0,
			totalCount: 4,
		});
	});

	it('returns partial readiness when only discounts and other revenue are configured', async () => {
		mockPrisma.otherRevenueItem.count.mockResolvedValueOnce(2).mockResolvedValueOnce(2);
		mockPrisma.discountPolicy.findMany.mockResolvedValue([
			{ tariff: 'RP', discountRate: '0.250000' },
			{ tariff: 'R3+', discountRate: '0.100000' },
		]);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/revenue/readiness`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.overallReady).toBe(false);
		expect(body.readyCount).toBe(2);
		expect(body.feeGrid.ready).toBe(false);
		expect(body.tariffAssignment.ready).toBe(false);
		expect(body.discounts.ready).toBe(true);
		expect(body.otherRevenue.ready).toBe(true);
	});

	it('returns 404 for a missing version', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(null);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/revenue/readiness`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('VERSION_NOT_FOUND');
	});

	it('allows Viewer access', async () => {
		const token = await makeToken('Viewer');
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/revenue/readiness`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
	});
});
