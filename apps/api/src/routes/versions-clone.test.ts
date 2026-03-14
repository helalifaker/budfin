/**
 * Story #53 — Version Clone API
 *
 * POST /api/v1/versions/:id/clone
 *
 * AC-11: Admin/BudgetOwner can clone Budget/Forecast → new Draft with sourceVersionId + deep copy of enrollment data
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
		enrollmentHeadcount: {
			findMany: vi.fn().mockResolvedValue([]),
			createMany: vi.fn().mockResolvedValue({ count: 0 }),
		},
		enrollmentDetail: {
			findMany: vi.fn().mockResolvedValue([]),
			createMany: vi.fn().mockResolvedValue({ count: 0 }),
		},
		monthlyBudgetSummary: {
			findMany: vi.fn().mockResolvedValue([]),
			createMany: vi.fn().mockResolvedValue({ count: 0 }),
		},
		versionRevenueSettings: {
			findUnique: vi.fn().mockResolvedValue(null),
			create: vi.fn().mockResolvedValue({ id: 1 }),
		},
		otherRevenueItem: {
			findMany: vi.fn().mockResolvedValue([]),
			createMany: vi.fn().mockResolvedValue({ count: 14 }),
		},
		gradeLevel: {
			findMany: vi.fn().mockResolvedValue([
				{
					gradeCode: 'PS',
					maxClassSize: 25,
					plancherPct: '0.7000',
					ciblePct: '0.8000',
					plafondPct: '1.0000',
				},
				{
					gradeCode: 'CP',
					maxClassSize: 28,
					plancherPct: '0.7500',
					ciblePct: '0.8500',
					plafondPct: '1.0000',
				},
			]),
		},
		auditEntry: {
			create: vi.fn().mockResolvedValue({ id: 1 }),
		},
		cohortParameter: {
			findMany: vi.fn().mockResolvedValue([]),
			createMany: vi.fn().mockResolvedValue({ count: 0 }),
		},
		nationalityBreakdown: {
			findMany: vi.fn().mockResolvedValue([]),
			createMany: vi.fn().mockResolvedValue({ count: 0 }),
		},
		versionCapacityConfig: {
			findMany: vi.fn().mockResolvedValue([]),
			createMany: vi.fn().mockResolvedValue({ count: 0 }),
		},
		$transaction: vi.fn().mockImplementation((fn: (tx: Record<string, unknown>) => unknown) =>
			fn({
				budgetVersion: mockPrisma.budgetVersion,
				enrollmentHeadcount: mockPrisma.enrollmentHeadcount,
				enrollmentDetail: mockPrisma.enrollmentDetail,
				monthlyBudgetSummary: mockPrisma.monthlyBudgetSummary,
				versionRevenueSettings: mockPrisma.versionRevenueSettings,
				otherRevenueItem: mockPrisma.otherRevenueItem,
				gradeLevel: mockPrisma.gradeLevel,
				auditEntry: mockPrisma.auditEntry,
				cohortParameter: mockPrisma.cohortParameter,
				nationalityBreakdown: mockPrisma.nationalityBreakdown,
				versionCapacityConfig: mockPrisma.versionCapacityConfig,
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
	enrollmentHeadcount: {
		findMany: ReturnType<typeof vi.fn>;
		createMany: ReturnType<typeof vi.fn>;
	};
	enrollmentDetail: {
		findMany: ReturnType<typeof vi.fn>;
		createMany: ReturnType<typeof vi.fn>;
	};
	monthlyBudgetSummary: {
		findMany: ReturnType<typeof vi.fn>;
		createMany: ReturnType<typeof vi.fn>;
	};
	versionRevenueSettings: {
		findUnique: ReturnType<typeof vi.fn>;
		create: ReturnType<typeof vi.fn>;
	};
	otherRevenueItem: {
		findMany: ReturnType<typeof vi.fn>;
		createMany: ReturnType<typeof vi.fn>;
	};
	gradeLevel: {
		findMany: ReturnType<typeof vi.fn>;
	};
	auditEntry: { create: ReturnType<typeof vi.fn> };
	cohortParameter: {
		findMany: ReturnType<typeof vi.fn>;
		createMany: ReturnType<typeof vi.fn>;
	};
	nationalityBreakdown: {
		findMany: ReturnType<typeof vi.fn>;
		createMany: ReturnType<typeof vi.fn>;
	};
	versionCapacityConfig: {
		findMany: ReturnType<typeof vi.fn>;
		createMany: ReturnType<typeof vi.fn>;
	};
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
		rolloverThreshold: '1.0000',
		cappedRetention: '0.9800',
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

	it('AC-11: clone copies enrollmentHeadcount rows', async () => {
		const source = makeVersion({ id: 1 });
		const headcounts = [
			{
				id: 10,
				versionId: 1,
				academicPeriod: 'AY1',
				gradeLevel: 'CP',
				headcount: 25,
				createdBy: 1,
			},
			{
				id: 11,
				versionId: 1,
				academicPeriod: 'AY1',
				gradeLevel: 'CE1',
				headcount: 30,
				createdBy: 1,
			},
		];
		const cloned = makeVersion({
			id: 2,
			name: 'Budget Clone',
			sourceVersionId: 1,
			createdBy: { email: 'admin@budfin.app' },
		});

		mockPrisma.budgetVersion.findUnique.mockResolvedValue(source);
		mockPrisma.enrollmentHeadcount.findMany.mockResolvedValue(headcounts);
		mockPrisma.budgetVersion.create.mockResolvedValue(cloned);

		const token = await makeToken({ role: 'Admin' });
		await app.inject({
			method: 'POST',
			url: '/api/v1/versions/1/clone',
			headers: authHeader(token),
			payload: { name: 'Budget Clone' },
		});

		expect(mockPrisma.enrollmentHeadcount.createMany).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.arrayContaining([
					expect.objectContaining({ gradeLevel: 'CP', versionId: 2 }),
					expect.objectContaining({ gradeLevel: 'CE1', versionId: 2 }),
				]),
			})
		);
	});

	it('AC-11: clone copies enrollmentDetail rows', async () => {
		const source = makeVersion({ id: 1 });
		const details = [
			{
				id: 20,
				versionId: 1,
				academicPeriod: 'AY1',
				gradeLevel: 'CP',
				nationality: 'Francais',
				tariff: 'RP',
				headcount: 15,
				createdBy: 1,
			},
		];
		const cloned = makeVersion({
			id: 2,
			name: 'Detail Clone',
			sourceVersionId: 1,
			createdBy: { email: 'admin@budfin.app' },
		});

		mockPrisma.budgetVersion.findUnique.mockResolvedValue(source);
		mockPrisma.enrollmentDetail.findMany.mockResolvedValue(details);
		mockPrisma.budgetVersion.create.mockResolvedValue(cloned);

		const token = await makeToken({ role: 'Admin' });
		await app.inject({
			method: 'POST',
			url: '/api/v1/versions/1/clone',
			headers: authHeader(token),
			payload: { name: 'Detail Clone' },
		});

		expect(mockPrisma.enrollmentDetail.createMany).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.arrayContaining([
					expect.objectContaining({
						gradeLevel: 'CP',
						nationality: 'Francais',
						versionId: 2,
					}),
				]),
			})
		);
	});

	it('AC-11: clone sets staleModules to ENROLLMENT', async () => {
		const source = makeVersion({ id: 1 });
		const cloned = makeVersion({
			id: 2,
			name: 'Stale Clone',
			sourceVersionId: 1,
			staleModules: ['ENROLLMENT'],
			createdBy: { email: 'admin@budfin.app' },
		});

		mockPrisma.budgetVersion.findUnique.mockResolvedValue(source);
		mockPrisma.budgetVersion.create.mockResolvedValue(cloned);

		const token = await makeToken({ role: 'Admin' });
		await app.inject({
			method: 'POST',
			url: '/api/v1/versions/1/clone',
			headers: authHeader(token),
			payload: { name: 'Stale Clone' },
		});

		expect(mockPrisma.budgetVersion.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					staleModules: ['ENROLLMENT'],
				}),
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

	it('AC-11: clone with description override uses provided description', async () => {
		const source = makeVersion({ id: 1, description: 'Original description' });
		const cloned = makeVersion({
			id: 2,
			name: 'Clone With Desc',
			description: 'Overridden description',
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
			payload: { name: 'Clone With Desc', description: 'Overridden description' },
		});

		expect(res.statusCode).toBe(201);
		expect(mockPrisma.budgetVersion.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ description: 'Overridden description' }),
			})
		);
	});

	// 404 not found
	it('returns 404 VERSION_NOT_FOUND when source version not found', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(null);

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/versions/999/clone',
			headers: authHeader(token),
			payload: { name: 'Clone' },
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('VERSION_NOT_FOUND');
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
		expect(res.json().code).toBe('FORBIDDEN');
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
		expect(res.json().code).toBe('FORBIDDEN');
	});

	it('AC-11: clone carries rolloverThreshold and cappedRetention from source version', async () => {
		const source = makeVersion({
			id: 1,
			rolloverThreshold: '1.0500',
			cappedRetention: '0.9700',
		});
		const cloned = makeVersion({
			id: 2,
			name: 'Threshold Clone',
			sourceVersionId: 1,
			rolloverThreshold: '1.0500',
			cappedRetention: '0.9700',
			createdBy: { email: 'admin@budfin.app' },
		});
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(source);
		mockPrisma.budgetVersion.create.mockResolvedValue(cloned);

		const token = await makeToken({ role: 'Admin' });
		await app.inject({
			method: 'POST',
			url: '/api/v1/versions/1/clone',
			headers: authHeader(token),
			payload: { name: 'Threshold Clone' },
		});

		expect(mockPrisma.budgetVersion.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					rolloverThreshold: '1.0500',
					cappedRetention: '0.9700',
				}),
			})
		);
	});

	it('clone copies capacity config overrides', async () => {
		const source = makeVersion({ id: 1 });
		const capacityConfigs = [
			{ gradeLevel: 'PS', maxClassSize: 24 },
			{ gradeLevel: 'CP', maxClassSize: 22 },
		];
		const cloned = makeVersion({
			id: 2,
			name: 'Capacity Clone',
			sourceVersionId: 1,
			createdBy: { email: 'admin@budfin.app' },
		});

		mockPrisma.budgetVersion.findUnique.mockResolvedValue(source);
		mockPrisma.versionCapacityConfig.findMany.mockResolvedValue(capacityConfigs);
		mockPrisma.budgetVersion.create.mockResolvedValue(cloned);

		const token = await makeToken({ role: 'Admin' });
		await app.inject({
			method: 'POST',
			url: '/api/v1/versions/1/clone',
			headers: authHeader(token),
			payload: { name: 'Capacity Clone' },
		});

		expect(mockPrisma.versionCapacityConfig.createMany).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.arrayContaining([
					expect.objectContaining({ gradeLevel: 'PS', maxClassSize: 24, versionId: 2 }),
					expect.objectContaining({ gradeLevel: 'CP', maxClassSize: 22, versionId: 2 }),
				]),
			})
		);
	});
});
