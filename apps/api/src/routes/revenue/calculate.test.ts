import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { generateKeyPair } from 'jose';
import { auth } from '../../plugins/auth.js';
import { revenueCalculateRoutes } from './calculate.js';
import { setKeys, signAccessToken } from '../../services/token.js';

// ── Mock revenue engine ─────────────────────────────────────────────────────

const mockCalculateRevenue = vi.fn();
vi.mock('../../services/revenue-engine.js', () => ({
	calculateRevenue: (...args: unknown[]) => mockCalculateRevenue(...args),
}));

// ── Mock Prisma ─────────────────────────────────────────────────────────────

vi.mock('../../lib/prisma.js', () => {
	const mockPrisma = {
		budgetVersion: {
			findUnique: vi.fn(),
			update: vi.fn(),
		},
		enrollmentDetail: { findMany: vi.fn() },
		feeGrid: { findMany: vi.fn() },
		discountPolicy: { findMany: vi.fn() },
		otherRevenueItem: { findMany: vi.fn() },
		calculationAuditLog: {
			create: vi.fn().mockResolvedValue({ id: 1 }),
			updateMany: vi.fn().mockResolvedValue({ count: 1 }),
		},
		monthlyRevenue: {
			deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
			createMany: vi.fn().mockResolvedValue({ count: 0 }),
		},
		monthlyOtherRevenue: {
			deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
			createMany: vi.fn().mockResolvedValue({ count: 0 }),
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
	enrollmentDetail: { findMany: ReturnType<typeof vi.fn> };
	feeGrid: { findMany: ReturnType<typeof vi.fn> };
	discountPolicy: { findMany: ReturnType<typeof vi.fn> };
	otherRevenueItem: { findMany: ReturnType<typeof vi.fn> };
	calculationAuditLog: {
		create: ReturnType<typeof vi.fn>;
		updateMany: ReturnType<typeof vi.fn>;
	};
	monthlyRevenue: {
		deleteMany: ReturnType<typeof vi.fn>;
		createMany: ReturnType<typeof vi.fn>;
	};
	monthlyOtherRevenue: {
		deleteMany: ReturnType<typeof vi.fn>;
		createMany: ReturnType<typeof vi.fn>;
	};
	$transaction: ReturnType<typeof vi.fn>;
};

let app: FastifyInstance;

async function makeToken(role = 'Admin') {
	return signAccessToken({
		sub: 1,
		email: 'admin@budfin.app',
		role,
		sessionId: 'calc-session',
	});
}

function authHeader(token: string) {
	return { authorization: `Bearer ${token}` };
}

const ROUTE_PREFIX = '/api/v1/versions/:versionId/calculate';
const URL_PREFIX = '/api/v1/versions/1/calculate';

const mockVersion = {
	id: 1,
	name: 'Budget v1',
	status: 'Draft',
	dataSource: 'CALCULATED',
	staleModules: ['REVENUE'],
};

const mockEngineResult = {
	tuitionRevenue: [
		{
			academicPeriod: 'AY1',
			gradeLevel: 'PS',
			nationality: 'Francais',
			tariff: 'RP',
			month: 1,
			grossRevenueHt: '1000.0000',
			discountAmount: '100.0000',
			netRevenueHt: '900.0000',
			vatAmount: '135.0000',
		},
	],
	otherRevenue: [
		{
			lineItemName: 'Registration Fees AY1',
			ifrsCategory: 'Registration Fees',
			executiveCategory: 'REGISTRATION_FEES',
			month: 1,
			amount: '200.0000',
		},
	],
	totals: {
		grossRevenueHt: '1000.0000',
		discountAmount: '100.0000',
		netRevenueHt: '900.0000',
		otherRevenue: '200.0000',
	},
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
	await app.register(revenueCalculateRoutes, { prefix: ROUTE_PREFIX });
	await app.ready();

	mockPrisma.enrollmentDetail.findMany.mockResolvedValue([]);
	mockPrisma.feeGrid.findMany.mockResolvedValue([]);
	mockPrisma.discountPolicy.findMany.mockResolvedValue([]);
	mockPrisma.otherRevenueItem.findMany.mockResolvedValue([]);
	mockPrisma.budgetVersion.update.mockResolvedValue({});
});

describe('POST /calculate/revenue', () => {
	it('calculates revenue successfully and returns summary', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockVersion);
		mockCalculateRevenue.mockReturnValue(mockEngineResult);

		const token = await makeToken('Editor');
		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/revenue`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.runId).toBeTruthy();
		expect(body.durationMs).toBeGreaterThanOrEqual(0);
		expect(body.summary).toEqual(mockEngineResult.totals);
		expect(body.tuitionRowCount).toBe(1);
		expect(body.otherRevenueRowCount).toBe(1);
	});

	it('persists tuition and other-revenue rows in a transaction', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockVersion);
		mockCalculateRevenue.mockReturnValue(mockEngineResult);

		const token = await makeToken();
		await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/revenue`,
			headers: authHeader(token),
		});

		expect(mockPrisma.monthlyRevenue.deleteMany).toHaveBeenCalledWith({
			where: { versionId: 1, scenarioName: 'Base' },
		});
		expect(mockPrisma.monthlyRevenue.createMany).toHaveBeenCalledOnce();
		expect(mockPrisma.monthlyOtherRevenue.createMany).toHaveBeenCalledOnce();
		expect(mockPrisma.calculationAuditLog.create).toHaveBeenCalledOnce();
		expect(mockPrisma.calculationAuditLog.updateMany).toHaveBeenCalledOnce();
	});

	it('removes REVENUE from staleModules after calculation', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue({
			...mockVersion,
			staleModules: ['REVENUE', 'PNL'],
		});
		mockCalculateRevenue.mockReturnValue(mockEngineResult);

		const token = await makeToken();
		await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/revenue`,
			headers: authHeader(token),
		});

		expect(mockPrisma.budgetVersion.update).toHaveBeenCalledWith({
			where: { id: 1 },
			data: { staleModules: ['PNL'] },
		});
	});

	it('returns 404 for non-existent version', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(null);

		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/revenue`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('VERSION_NOT_FOUND');
	});

	it('returns 409 for non-Draft version (locked)', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue({
			...mockVersion,
			status: 'Published',
		});

		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/revenue`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('VERSION_LOCKED');
	});

	it('returns 409 for imported version', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue({
			...mockVersion,
			dataSource: 'IMPORTED',
		});

		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/revenue`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('IMPORTED_VERSION');
	});

	it('handles empty enrollment data gracefully', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockVersion);
		mockCalculateRevenue.mockReturnValue({
			tuitionRevenue: [],
			otherRevenue: [],
			totals: {
				grossRevenueHt: '0.0000',
				discountAmount: '0.0000',
				netRevenueHt: '0.0000',
				otherRevenue: '0.0000',
			},
		});

		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/revenue`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		expect(res.json().tuitionRowCount).toBe(0);
		expect(res.json().otherRevenueRowCount).toBe(0);
	});

	it('returns 403 for Viewer role', async () => {
		const token = await makeToken('Viewer');
		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/revenue`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(403);
		expect(res.json().code).toBe('FORBIDDEN');
	});

	it('returns 401 without authentication', async () => {
		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/revenue`,
		});

		expect(res.statusCode).toBe(401);
	});
});
