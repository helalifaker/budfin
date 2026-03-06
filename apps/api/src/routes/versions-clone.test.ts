/**
 * Story #53 — Version Clone API
 *
 * POST /api/v1/versions/:id/clone
 *
 * AC-11: Admin/BudgetOwner can clone Budget/Forecast → new Draft with sourceVersionId + deep copy of monthlyBudgetSummary
 * AC-12: Clone on Actual version → 409 ACTUAL_VERSION_CLONE_PROHIBITED
 * AC-19 (partial): Editor/Viewer → 403 on POST /clone
 * Duplicate name → 409 DUPLICATE_VERSION_NAME
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { generateKeyPair } from 'jose';
import { Prisma } from '@prisma/client';
import { setKeys, signAccessToken } from '../services/token.js';
import { auth } from '../plugins/auth.js';
import { versionRoutes } from './versions.js';

vi.mock('../lib/prisma.js', () => {
	const mockPrisma = {
		budgetVersion: {
			findUnique: vi.fn(),
			create: vi.fn(),
		},
		monthlyBudgetSummary: {
			findMany: vi.fn().mockResolvedValue([]),
			createMany: vi.fn().mockResolvedValue({ count: 0 }),
		},
		auditEntry: {
			create: vi.fn().mockResolvedValue({ id: 1 }),
		},
		$transaction: vi.fn().mockImplementation((fn: (tx: Record<string, unknown>) => unknown) =>
			fn({
				budgetVersion: mockPrisma.budgetVersion,
				monthlyBudgetSummary: mockPrisma.monthlyBudgetSummary,
				auditEntry: mockPrisma.auditEntry,
			})
		),
	};
	return { prisma: mockPrisma };
});

import { prisma } from '../lib/prisma.js';

const mockPrisma = prisma as unknown as {
	budgetVersion: {
		findUnique: ReturnType<typeof vi.fn>;
		create: ReturnType<typeof vi.fn>;
	};
	monthlyBudgetSummary: {
		findMany: ReturnType<typeof vi.fn>;
		createMany: ReturnType<typeof vi.fn>;
	};
	auditEntry: { create: ReturnType<typeof vi.fn> };
	$transaction: ReturnType<typeof vi.fn>;
};

let app: FastifyInstance;
const now = new Date();

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

function makeVersion(overrides: Record<string, unknown> = {}) {
	return {
		id: 1,
		fiscalYear: 2026,
		name: 'Budget v1',
		type: 'Budget',
		status: 'Draft',
		description: null,
		dataSource: 'CALCULATED',
		sourceVersionId: null,
		modificationCount: 0,
		staleModules: [],
		createdById: 1,
		publishedAt: null,
		lockedAt: null,
		archivedAt: null,
		createdAt: now,
		updatedAt: now,
		createdBy: { email: 'admin@budfin.app' },
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

// ── AC-11: Successful clone ───────────────────────────────────────────────────

describe('POST /api/v1/versions/:id/clone', () => {
	it('AC-11: Admin clones Budget version → 201 with sourceVersionId and Draft status', async () => {
		const source = makeVersion({ id: 1, type: 'Budget', status: 'Published' });
		const cloned = makeVersion({
			id: 2,
			name: 'Budget v1 Clone',
			status: 'Draft',
			sourceVersionId: 1,
			createdBy: { email: 'admin@budfin.app' },
		});
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(source);
		mockPrisma.budgetVersion.create.mockResolvedValue(cloned);

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/versions/1/clone',
			headers: authHeader(token),
			payload: { name: 'Budget v1 Clone' },
		});

		expect(res.statusCode).toBe(201);
		const body = res.json();
		expect(body.status).toBe('Draft');
		expect(body.sourceVersionId).toBe(1);
		expect(body.name).toBe('Budget v1 Clone');
	});

	it('AC-11: BudgetOwner can clone Forecast version', async () => {
		const source = makeVersion({ id: 1, type: 'Forecast', status: 'Draft' });
		const cloned = makeVersion({
			id: 2,
			name: 'Forecast Clone',
			type: 'Forecast',
			status: 'Draft',
			sourceVersionId: 1,
			createdBy: { email: 'admin@budfin.app' },
		});
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(source);
		mockPrisma.budgetVersion.create.mockResolvedValue(cloned);

		const token = await makeToken({ role: 'BudgetOwner' });
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/versions/1/clone',
			headers: authHeader(token),
			payload: { name: 'Forecast Clone' },
		});

		expect(res.statusCode).toBe(201);
	});

	it('AC-11: clone copies monthly_budget_summary rows in transaction', async () => {
		const source = makeVersion({ id: 1 });
		const summaries = [
			{
				id: 10,
				versionId: 1,
				month: 1,
				revenueHt: '100.00',
				staffCosts: '50.00',
				netProfit: '50.00',
				calculatedAt: now,
			},
			{
				id: 11,
				versionId: 1,
				month: 2,
				revenueHt: '200.00',
				staffCosts: '80.00',
				netProfit: '120.00',
				calculatedAt: now,
			},
		];
		const cloned = makeVersion({
			id: 2,
			name: 'Budget Clone',
			sourceVersionId: 1,
			createdBy: { email: 'admin@budfin.app' },
		});

		mockPrisma.budgetVersion.findUnique.mockResolvedValue(source);
		mockPrisma.monthlyBudgetSummary.findMany.mockResolvedValue(summaries);
		mockPrisma.budgetVersion.create.mockResolvedValue(cloned);

		const token = await makeToken({ role: 'Admin' });
		await app.inject({
			method: 'POST',
			url: '/api/v1/versions/1/clone',
			headers: authHeader(token),
			payload: { name: 'Budget Clone' },
		});

		expect(mockPrisma.monthlyBudgetSummary.createMany).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.arrayContaining([
					expect.objectContaining({ month: 1, versionId: 2 }),
					expect.objectContaining({ month: 2, versionId: 2 }),
				]),
			})
		);
	});

	it('AC-11: writes audit entry for VERSION_CLONED', async () => {
		const source = makeVersion({ id: 1 });
		const cloned = makeVersion({
			id: 2,
			name: 'Clone',
			sourceVersionId: 1,
			createdBy: { email: 'admin@budfin.app' },
		});
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(source);
		mockPrisma.budgetVersion.create.mockResolvedValue(cloned);

		const token = await makeToken({ role: 'Admin' });
		await app.inject({
			method: 'POST',
			url: '/api/v1/versions/1/clone',
			headers: authHeader(token),
			payload: { name: 'Clone' },
		});

		expect(mockPrisma.auditEntry.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ operation: 'VERSION_CLONED' }),
			})
		);
	});

	// AC-12: Actual version clone prohibited
	it('AC-12: clone of Actual version → 409 ACTUAL_VERSION_CLONE_PROHIBITED', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(makeVersion({ type: 'Actual' }));

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/versions/1/clone',
			headers: authHeader(token),
			payload: { name: 'Actual Clone' },
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('ACTUAL_VERSION_CLONE_PROHIBITED');
	});

	// Duplicate name
	it('duplicate name → 409 DUPLICATE_VERSION_NAME', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(makeVersion());
		mockPrisma.budgetVersion.create.mockRejectedValue(
			new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
				code: 'P2002',
				clientVersion: '6.0.0',
				meta: { target: ['fiscal_year', 'name'] },
			})
		);

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/versions/1/clone',
			headers: authHeader(token),
			payload: { name: 'Budget v1' },
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('DUPLICATE_VERSION_NAME');
	});

	// 404 not found
	it('returns 404 when source version not found', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(null);

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/versions/999/clone',
			headers: authHeader(token),
			payload: { name: 'Clone' },
		});

		expect(res.statusCode).toBe(404);
	});

	// AC-19: RBAC
	it('AC-19: Editor gets 403 on POST /clone', async () => {
		const token = await makeToken({ role: 'Editor' });
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/versions/1/clone',
			headers: authHeader(token),
			payload: { name: 'Clone' },
		});

		expect(res.statusCode).toBe(403);
		expect(res.json().error).toBe('FORBIDDEN');
	});

	it('AC-19: Viewer gets 403 on POST /clone', async () => {
		const token = await makeToken({ role: 'Viewer' });
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/versions/1/clone',
			headers: authHeader(token),
			payload: { name: 'Clone' },
		});

		expect(res.statusCode).toBe(403);
		expect(res.json().error).toBe('FORBIDDEN');
	});
});
