import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { generateKeyPair } from 'jose';
import { auth } from '../../plugins/auth.js';
import { scenarioParameterRoutes } from './parameters.js';
import { setKeys, signAccessToken } from '../../services/token.js';

vi.mock('../../lib/prisma.js', () => {
	const mockPrisma = {
		budgetVersion: {
			findUnique: vi.fn(),
			update: vi.fn(),
		},
		scenarioParameters: {
			findMany: vi.fn(),
			findUnique: vi.fn(),
			createMany: vi.fn(),
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
	scenarioParameters: {
		findMany: ReturnType<typeof vi.fn>;
		findUnique: ReturnType<typeof vi.fn>;
		createMany: ReturnType<typeof vi.fn>;
		upsert: ReturnType<typeof vi.fn>;
	};
	auditEntry: { create: ReturnType<typeof vi.fn> };
	$transaction: ReturnType<typeof vi.fn>;
};

let app: FastifyInstance;

const ROUTE_PREFIX = '/api/v1/versions/:versionId';
const URL_PREFIX = '/api/v1/versions/1';

async function makeToken(role = 'Admin') {
	return signAccessToken({
		sub: 1,
		email: 'admin@budfin.app',
		role,
		sessionId: 'scenario-test-session',
	});
}

function authHeader(token: string) {
	return { authorization: `Bearer ${token}` };
}

const mockVersion = {
	id: 1,
	status: 'Draft',
	staleModules: [],
};

const mockBaseParams = {
	id: 10,
	versionId: 1,
	scenarioName: 'Base',
	newEnrollmentFactor: '1.000000',
	retentionAdjustment: '1.000000',
	feeCollectionRate: '1.000000',
	scholarshipAllocation: '0.000000',
	attritionRate: '0.000000',
	orsHours: '18.0000',
};

const mockOptimisticParams = {
	...mockBaseParams,
	id: 11,
	scenarioName: 'Optimistic',
};

const mockPessimisticParams = {
	...mockBaseParams,
	id: 12,
	scenarioName: 'Pessimistic',
};

const allParams = [mockBaseParams, mockOptimisticParams, mockPessimisticParams];

beforeAll(async () => {
	const keys = await generateKeyPair('RS256');
	setKeys(keys.privateKey, keys.publicKey);
});

beforeEach(async () => {
	vi.clearAllMocks();

	app = Fastify({ logger: false });
	app.setValidatorCompiler(validatorCompiler);
	app.setSerializerCompiler(serializerCompiler);
	await app.register(auth);
	await app.register(scenarioParameterRoutes, { prefix: ROUTE_PREFIX });
	await app.ready();

	mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockVersion);
	mockPrisma.budgetVersion.update.mockResolvedValue({});
});

// ── GET /scenarios/parameters ────────────────────────────────────────────────

describe('GET /scenarios/parameters', () => {
	it('returns 3 default scenarios via lazy init when none exist', async () => {
		// First call: no rows => triggers createMany, second call: returns created rows
		mockPrisma.scenarioParameters.findMany
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce(allParams);
		mockPrisma.scenarioParameters.createMany.mockResolvedValue({ count: 3 });

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/scenarios/parameters`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.data).toHaveLength(3);
		expect(body.data.map((d: { scenarioName: string }) => d.scenarioName)).toEqual([
			'Base',
			'Optimistic',
			'Pessimistic',
		]);
		expect(mockPrisma.scenarioParameters.createMany).toHaveBeenCalledOnce();
	});

	it('returns existing params when already created', async () => {
		mockPrisma.scenarioParameters.findMany.mockResolvedValue(allParams);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/scenarios/parameters`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.data).toHaveLength(3);
		expect(body.data[0].newEnrollmentFactor).toBe('1.000000');
		expect(body.data[0].orsHours).toBe('18.0000');
		// createMany should NOT be called when params already exist
		expect(mockPrisma.scenarioParameters.createMany).not.toHaveBeenCalled();
	});

	it('returns 404 for non-existent version', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(null);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/scenarios/parameters`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('VERSION_NOT_FOUND');
	});

	it('returns 401 without auth token', async () => {
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/scenarios/parameters`,
		});

		expect(res.statusCode).toBe(401);
	});

	it('allows Viewer to read (data:view)', async () => {
		mockPrisma.scenarioParameters.findMany.mockResolvedValue(allParams);

		const token = await makeToken('Viewer');
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/scenarios/parameters`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
	});
});

// ── PATCH /scenarios/parameters/:scenarioName ────────────────────────────────

describe('PATCH /scenarios/parameters/:scenarioName', () => {
	it('updates scenario values', async () => {
		const updatedRow = {
			...mockBaseParams,
			newEnrollmentFactor: '1.100000',
			retentionAdjustment: '0.950000',
		};

		mockPrisma.scenarioParameters.findUnique.mockResolvedValue(mockBaseParams);
		mockPrisma.scenarioParameters.upsert.mockResolvedValue(updatedRow);

		const token = await makeToken('Editor');
		const res = await app.inject({
			method: 'PATCH',
			url: `${URL_PREFIX}/scenarios/parameters/Base`,
			headers: authHeader(token),
			payload: {
				newEnrollmentFactor: '1.100000',
				retentionAdjustment: '0.950000',
			},
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.scenarioName).toBe('Base');
		expect(body.newEnrollmentFactor).toBe('1.100000');
		expect(body.retentionAdjustment).toBe('0.950000');
	});

	it('marks downstream modules stale after update', async () => {
		mockPrisma.scenarioParameters.findUnique.mockResolvedValue(mockBaseParams);
		mockPrisma.scenarioParameters.upsert.mockResolvedValue(mockBaseParams);

		const token = await makeToken();
		await app.inject({
			method: 'PATCH',
			url: `${URL_PREFIX}/scenarios/parameters/Optimistic`,
			headers: authHeader(token),
			payload: { feeCollectionRate: '0.950000' },
		});

		expect(mockPrisma.budgetVersion.update).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: 1 },
				data: {
					staleModules: expect.arrayContaining(['REVENUE', 'STAFFING', 'OPEX', 'PNL']) as unknown,
				},
			})
		);
	});

	it('returns 404 for non-existent version on PATCH', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(null);

		const token = await makeToken();
		const res = await app.inject({
			method: 'PATCH',
			url: `${URL_PREFIX}/scenarios/parameters/Base`,
			headers: authHeader(token),
			payload: { newEnrollmentFactor: '1.050000' },
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('VERSION_NOT_FOUND');
	});

	it('returns 403 for Viewer role (cannot write)', async () => {
		const token = await makeToken('Viewer');
		const res = await app.inject({
			method: 'PATCH',
			url: `${URL_PREFIX}/scenarios/parameters/Base`,
			headers: authHeader(token),
			payload: { newEnrollmentFactor: '1.050000' },
		});

		expect(res.statusCode).toBe(403);
	});

	it('returns 401 without auth token', async () => {
		const res = await app.inject({
			method: 'PATCH',
			url: `${URL_PREFIX}/scenarios/parameters/Base`,
			payload: { newEnrollmentFactor: '1.050000' },
		});

		expect(res.statusCode).toBe(401);
	});

	it('returns 400 for invalid scenarioName', async () => {
		const token = await makeToken();
		const res = await app.inject({
			method: 'PATCH',
			url: `${URL_PREFIX}/scenarios/parameters/Invalid`,
			headers: authHeader(token),
			payload: { newEnrollmentFactor: '1.050000' },
		});

		expect(res.statusCode).toBe(400);
	});
});

// ── GET /scenarios/comparison ────────────────────────────────────────────────

describe('GET /scenarios/comparison', () => {
	it('returns comparison data with 4 metrics', async () => {
		vi.mocked(prisma.budgetVersion.findUnique).mockResolvedValue(mockVersion as never);

		const mockSummary = [
			{
				id: 1,
				versionId: 1,
				month: 1,
				revenueHt: '500000.0000',
				staffCosts: '200000.0000',
				opexCosts: '50000.0000',
				ebitda: '250000.0000',
				netProfit: '200000.0000',
				calculatedAt: new Date(),
			},
		];

		(
			prisma as unknown as { monthlyBudgetSummary: { findMany: ReturnType<typeof vi.fn> } }
		).monthlyBudgetSummary = { findMany: vi.fn().mockResolvedValue(mockSummary) };

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/scenarios/comparison`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.rows).toHaveLength(4);
		expect(body.rows.map((r: { metric: string }) => r.metric)).toEqual([
			'Total Revenue (HT)',
			'Total Staff Costs',
			'EBITDA',
			'Net Profit',
		]);
		// Each row should have base, optimistic, pessimistic, and delta fields
		for (const row of body.rows) {
			expect(row).toHaveProperty('base');
			expect(row).toHaveProperty('optimistic');
			expect(row).toHaveProperty('pessimistic');
			expect(row).toHaveProperty('optimisticDeltaPct');
			expect(row).toHaveProperty('pessimisticDeltaPct');
		}
	});

	it('returns 404 for non-existent version', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(null);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/scenarios/comparison`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('VERSION_NOT_FOUND');
	});

	it('allows Viewer to read comparison (data:view)', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockVersion);

		(
			prisma as unknown as { monthlyBudgetSummary: { findMany: ReturnType<typeof vi.fn> } }
		).monthlyBudgetSummary = { findMany: vi.fn().mockResolvedValue([]) };

		const token = await makeToken('Viewer');
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/scenarios/comparison`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
	});
});
