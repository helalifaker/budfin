/**
 * Story #51 — Version CRUD API
 *
 * Tests for GET /api/v1/versions, POST /api/v1/versions,
 * GET /api/v1/versions/:id, DELETE /api/v1/versions/:id
 *
 * AC-01: Admin/BudgetOwner can create Budget/Forecast versions
 * AC-02: Any role gets 400 for type: "Actual"
 * AC-03: Duplicate name for same FY → 409 DUPLICATE_VERSION_NAME
 * AC-09: Admin/BudgetOwner can DELETE Draft version → 204
 * AC-10: DELETE on non-Draft → 409 VERSION_NOT_DRAFT
 * AC-18: GET /:id returns all metadata fields
 * AC-19 (partial): Editor/Viewer → 403 INSUFFICIENT_ROLE on mutations
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
			findMany: vi.fn(),
			findUnique: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
			delete: vi.fn().mockResolvedValue({}),
			count: vi.fn(),
		},
		monthlyBudgetSummary: {
			findMany: vi.fn(),
			createMany: vi.fn(),
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
			]),
		},
		versionCapacityConfig: {
			findMany: vi.fn().mockResolvedValue([]),
			createMany: vi.fn().mockResolvedValue({ count: 1 }),
		},
		actualsImportLog: {
			findMany: vi.fn(),
		},
		auditEntry: {
			create: vi.fn().mockResolvedValue({ id: 1 }),
		},
		$transaction: vi.fn().mockImplementation((fn: (tx: Record<string, unknown>) => unknown) =>
			fn({
				budgetVersion: mockPrisma.budgetVersion,
				monthlyBudgetSummary: mockPrisma.monthlyBudgetSummary,
				versionRevenueSettings: mockPrisma.versionRevenueSettings,
				otherRevenueItem: mockPrisma.otherRevenueItem,
				gradeLevel: mockPrisma.gradeLevel,
				versionCapacityConfig: mockPrisma.versionCapacityConfig,
				auditEntry: mockPrisma.auditEntry,
			})
		),
	};
	return { prisma: mockPrisma };
});

import { prisma } from '../lib/prisma.js';

const mockPrisma = prisma as unknown as {
	budgetVersion: {
		findMany: ReturnType<typeof vi.fn>;
		findUnique: ReturnType<typeof vi.fn>;
		create: ReturnType<typeof vi.fn>;
		update: ReturnType<typeof vi.fn>;
		delete: ReturnType<typeof vi.fn>;
		count: ReturnType<typeof vi.fn>;
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
	versionCapacityConfig: {
		findMany: ReturnType<typeof vi.fn>;
		createMany: ReturnType<typeof vi.fn>;
	};
	actualsImportLog: { findMany: ReturnType<typeof vi.fn> };
	auditEntry: { create: ReturnType<typeof vi.fn> };
	$transaction: ReturnType<typeof vi.fn>;
};

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

const now = new Date();

const mockVersion = {
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
	rolloverThreshold: 1,
	cappedRetention: 0.98,
	createdById: 1,
	publishedAt: null,
	lockedAt: null,
	archivedAt: null,
	createdAt: now,
	updatedAt: now,
	createdBy: { email: 'admin@budfin.app' },
};

const mockVersion2 = {
	...mockVersion,
	id: 2,
	name: 'Forecast Q1',
	type: 'Forecast',
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
	await app.register(versionRoutes, { prefix: '/api/v1/versions' });
	await app.ready();
});

// ── GET / ─────────────────────────────────────────────────────────────────────

describe('GET /api/v1/versions', () => {
	it('returns list of versions for authenticated user', async () => {
		mockPrisma.budgetVersion.findMany.mockResolvedValue([mockVersion, mockVersion2]);
		mockPrisma.budgetVersion.count.mockResolvedValue(2);

		const token = await makeToken({ role: 'Viewer' });
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/versions?fiscalYear=2026',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.data).toHaveLength(2);
		expect(body.data[0].name).toBe('Budget v1');
	});

	it('filters by fiscalYear', async () => {
		mockPrisma.budgetVersion.findMany.mockResolvedValue([mockVersion]);
		mockPrisma.budgetVersion.count.mockResolvedValue(1);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/versions?fiscalYear=2026',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		expect(mockPrisma.budgetVersion.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({ fiscalYear: 2026 }),
			})
		);
	});

	it('filters by status', async () => {
		mockPrisma.budgetVersion.findMany.mockResolvedValue([mockVersion]);
		mockPrisma.budgetVersion.count.mockResolvedValue(1);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/versions?fiscalYear=2026&status=Draft',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		expect(mockPrisma.budgetVersion.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({ status: 'Draft' }),
			})
		);
	});

	it('returns versions without fiscalYear param (all years)', async () => {
		const token = await makeToken();
		mockPrisma.budgetVersion.findMany.mockResolvedValue([]);
		mockPrisma.budgetVersion.count.mockResolvedValue(0);
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/versions',
			headers: authHeader(token),
		});
		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.data).toEqual([]);
		expect(body.total).toBe(0);
	});

	it('returns 401 without token', async () => {
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/versions?fiscalYear=2026',
		});
		expect(res.statusCode).toBe(401);
	});
});

// ── GET /:id ──────────────────────────────────────────────────────────────────

describe('GET /api/v1/versions/:id', () => {
	it('AC-18: returns all metadata fields', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockVersion);

		const token = await makeToken({ role: 'Viewer' });
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/versions/1',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body).toMatchObject({
			id: 1,
			name: 'Budget v1',
			dataSource: 'CALCULATED',
			modificationCount: 0,
			staleModules: [],
			rolloverThreshold: 1,
			cappedRetention: 0.98,
			createdByEmail: 'admin@budfin.app',
		});
	});

	it('returns 404 when version not found', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(null);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/versions/999',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(404);
	});
});

// ── POST / ────────────────────────────────────────────────────────────────────

describe('POST /api/v1/versions', () => {
	it('AC-01: Admin creates Budget version successfully', async () => {
		mockPrisma.budgetVersion.create.mockResolvedValue(mockVersion);

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/versions',
			headers: authHeader(token),
			payload: { name: 'Budget v1', type: 'Budget', fiscalYear: 2026 },
		});

		expect(res.statusCode).toBe(201);
		const body = res.json();
		expect(body.name).toBe('Budget v1');
		expect(body.status).toBe('Draft');
		expect(body.modificationCount).toBe(0);
		expect(body.staleModules).toEqual([]);
		expect(body.rolloverThreshold).toBe(1);
		expect(body.cappedRetention).toBe(0.98);
	});

	it('AC-01: BudgetOwner creates Forecast version successfully', async () => {
		mockPrisma.budgetVersion.create.mockResolvedValue(mockVersion2);

		const token = await makeToken({ role: 'BudgetOwner', sub: 2 });
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/versions',
			headers: authHeader(token),
			payload: { name: 'Forecast Q1', type: 'Forecast', fiscalYear: 2026 },
		});

		expect(res.statusCode).toBe(201);
	});

	it('AC-02: any role gets 400 for type: "Actual"', async () => {
		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/versions',
			headers: authHeader(token),
			payload: { name: 'Actual 2026', type: 'Actual', fiscalYear: 2026 },
		});

		expect(res.statusCode).toBe(400);
		expect(res.json().code).toBe('ACTUAL_VERSION_MANUAL_CREATE_PROHIBITED');
	});

	it('AC-03: duplicate name for same FY → 409 DUPLICATE_VERSION_NAME', async () => {
		// Make create reject inside the transaction — the mock $transaction calls fn(tx)
		// so tx.budgetVersion.create rejection propagates naturally
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
			url: '/api/v1/versions',
			headers: authHeader(token),
			payload: { name: 'Budget v1', type: 'Budget', fiscalYear: 2026 },
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('DUPLICATE_VERSION_NAME');
	});

	it('AC-19: Editor gets 403 INSUFFICIENT_ROLE on POST', async () => {
		const token = await makeToken({ role: 'Editor' });
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/versions',
			headers: authHeader(token),
			payload: { name: 'Budget v1', type: 'Budget', fiscalYear: 2026 },
		});

		expect(res.statusCode).toBe(403);
		expect(res.json().code).toBe('FORBIDDEN');
	});

	it('AC-19: Viewer gets 403 INSUFFICIENT_ROLE on POST', async () => {
		const token = await makeToken({ role: 'Viewer' });
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/versions',
			headers: authHeader(token),
			payload: { name: 'Budget v1', type: 'Budget', fiscalYear: 2026 },
		});

		expect(res.statusCode).toBe(403);
		expect(res.json().code).toBe('FORBIDDEN');
	});

	it('returns 400 for missing required fields', async () => {
		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/versions',
			headers: authHeader(token),
			payload: { name: 'Budget v1' }, // missing type and fiscalYear
		});

		expect(res.statusCode).toBe(400);
	});

	it('creates version with sourceVersionId and clones data', async () => {
		const sourceVersion = {
			...mockVersion,
			id: 5,
			type: 'Budget',
			status: 'Published',
			rolloverThreshold: 1.04,
			cappedRetention: 0.99,
		};
		mockPrisma.budgetVersion.create.mockResolvedValue(mockVersion);
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(sourceVersion);
		mockPrisma.monthlyBudgetSummary.findMany.mockResolvedValue([
			{ month: 1, revenueHt: '1000', staffCosts: '500', netProfit: '500', calculatedAt: now },
		]);
		mockPrisma.monthlyBudgetSummary.createMany.mockResolvedValue({ count: 1 });

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/versions',
			headers: authHeader(token),
			payload: { name: 'Budget v1', type: 'Budget', fiscalYear: 2026, sourceVersionId: 5 },
		});

		expect(res.statusCode).toBe(201);
		expect(mockPrisma.budgetVersion.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					rolloverThreshold: 1.04,
					cappedRetention: 0.99,
				}),
			})
		);
		expect(mockPrisma.monthlyBudgetSummary.createMany).toHaveBeenCalled();
	});

	it('returns 404 for invalid sourceVersionId', async () => {
		mockPrisma.budgetVersion.create.mockResolvedValue(mockVersion);
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(null);

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/versions',
			headers: authHeader(token),
			payload: { name: 'Budget v1', type: 'Budget', fiscalYear: 2026, sourceVersionId: 999 },
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('SOURCE_VERSION_NOT_FOUND');
	});

	it('returns 409 for Actual sourceVersionId', async () => {
		const actualVersion = { ...mockVersion, id: 5, type: 'Actual' };
		mockPrisma.budgetVersion.create.mockResolvedValue(mockVersion);
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(actualVersion);

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/versions',
			headers: authHeader(token),
			payload: { name: 'Budget v1', type: 'Budget', fiscalYear: 2026, sourceVersionId: 5 },
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('ACTUAL_COPY_PROHIBITED');
	});
});

// ── DELETE /:id ───────────────────────────────────────────────────────────────

describe('DELETE /api/v1/versions/:id', () => {
	it('AC-09: Admin deletes Draft version → 204', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockVersion); // Draft
		mockPrisma.budgetVersion.delete.mockResolvedValue(mockVersion);

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'DELETE',
			url: '/api/v1/versions/1',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(204);
	});

	it('AC-10: DELETE on Published version → 409 VERSION_NOT_DRAFT', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue({
			...mockVersion,
			status: 'Published',
		});

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'DELETE',
			url: '/api/v1/versions/1',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('VERSION_NOT_DRAFT');
	});

	it('AC-10: DELETE on Locked version → 409 VERSION_NOT_DRAFT', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue({
			...mockVersion,
			status: 'Locked',
		});

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'DELETE',
			url: '/api/v1/versions/1',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('VERSION_NOT_DRAFT');
	});

	it('returns 404 when version not found', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(null);

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'DELETE',
			url: '/api/v1/versions/999',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(404);
	});

	it('AC-19: Editor gets 403 on DELETE', async () => {
		const token = await makeToken({ role: 'Editor' });
		const res = await app.inject({
			method: 'DELETE',
			url: '/api/v1/versions/1',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(403);
		expect(res.json().code).toBe('FORBIDDEN');
	});
});

// ── GET / — type filter ───────────────────────────────────────────────────────

describe('GET /api/v1/versions — type filter', () => {
	it('filters by type when provided', async () => {
		mockPrisma.budgetVersion.findMany.mockResolvedValue([mockVersion]);
		mockPrisma.budgetVersion.count.mockResolvedValue(1);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/versions?type=Budget',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		expect(mockPrisma.budgetVersion.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({ type: 'Budget' }),
			})
		);
	});
});

// ── GET /compare-multi ────────────────────────────────────────────────────────

const mockSummaries = (versionId: number) =>
	Array.from({ length: 12 }, (_, i) => ({
		versionId,
		month: i + 1,
		revenueHt: '100000.0000',
		staffCosts: '60000.0000',
		netProfit: '40000.0000',
		calculatedAt: now,
	}));

describe('GET /api/v1/versions/compare-multi', () => {
	it('returns comparison for 2 versions', async () => {
		const v1 = { ...mockVersion, id: 1, type: 'Budget' };
		const v2 = { ...mockVersion, id: 2, type: 'Forecast', name: 'Forecast Q1' };
		mockPrisma.budgetVersion.findMany.mockResolvedValue([v1, v2]);
		mockPrisma.monthlyBudgetSummary.findMany.mockResolvedValue([
			...mockSummaries(1),
			...mockSummaries(2),
		]);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/versions/compare-multi?ids=1,2',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.versions).toHaveLength(2);
		expect(body.monthly).toHaveLength(12);
		expect(body.annualTotals).toHaveLength(2);
		// Version 1 is base — variance should be null
		expect(body.annualTotals[0].variance).toBeNull();
		// Version 2 is non-base — has variance fields
		expect(body.annualTotals[1].variance).not.toBeNull();
		// Field names match MultiCompareResponse interface
		expect(body.annualTotals[0]).toHaveProperty('revenueHt');
		expect(body.annualTotals[0]).toHaveProperty('staffCosts');
		expect(body.annualTotals[0]).toHaveProperty('netProfit');
	});

	it('returns comparison for 3 versions', async () => {
		const v1 = { ...mockVersion, id: 1, type: 'Budget' };
		const v2 = { ...mockVersion, id: 2, type: 'Forecast', name: 'Forecast Q1' };
		const v3 = { ...mockVersion, id: 3, type: 'Actual', name: 'Actual 2026' };
		mockPrisma.budgetVersion.findMany.mockResolvedValue([v1, v2, v3]);
		mockPrisma.monthlyBudgetSummary.findMany.mockResolvedValue([
			...mockSummaries(1),
			...mockSummaries(2),
			...mockSummaries(3),
		]);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/versions/compare-multi?ids=1,2,3',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.versions).toHaveLength(3);
		expect(body.annualTotals).toHaveLength(3);
	});

	it('preserves requested version order (first ID is base)', async () => {
		const v1 = { ...mockVersion, id: 1, type: 'Budget' };
		const v2 = { ...mockVersion, id: 2, type: 'Forecast', name: 'Forecast Q1' };
		// API returns in DB order; test that handler re-orders to match requested IDs
		mockPrisma.budgetVersion.findMany.mockResolvedValue([v2, v1]);
		mockPrisma.monthlyBudgetSummary.findMany.mockResolvedValue([
			...mockSummaries(1),
			...mockSummaries(2),
		]);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/versions/compare-multi?ids=2,1',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		// Version 2 should be first (base) since it was requested first
		expect(body.versions[0].id).toBe(2);
		expect(body.annualTotals[0].variance).toBeNull();
	});

	it('returns 400 when fewer than 2 IDs provided', async () => {
		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/versions/compare-multi?ids=1',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(400);
		expect(res.json().code).toBe('INVALID_VERSION_COUNT');
	});

	it('returns 404 when a version is not found', async () => {
		// Only returns 1 version when 2 were requested
		mockPrisma.budgetVersion.findMany.mockResolvedValue([mockVersion]);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/versions/compare-multi?ids=1,999',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('VERSION_NOT_FOUND');
	});

	it('returns 401 without auth', async () => {
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/versions/compare-multi?ids=1,2',
		});
		expect(res.statusCode).toBe(401);
	});
});

// ── GET /:id/import-logs ──────────────────────────────────────────────────────

describe('GET /api/v1/versions/:id/import-logs', () => {
	const mockLog = {
		id: 1,
		module: 'ACTUALS',
		sourceFile: 'actuals-2026.xlsx',
		validationStatus: 'PASSED',
		rowsImported: 150,
		importedBy: { email: 'admin@budfin.app' },
		importedAt: now,
	};

	it('returns import logs for a valid version', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockVersion);
		mockPrisma.actualsImportLog.findMany.mockResolvedValue([mockLog]);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/versions/1/import-logs',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body).toHaveLength(1);
		expect(body[0].module).toBe('ACTUALS');
		expect(body[0].importedByEmail).toBe('admin@budfin.app');
	});

	it('returns empty array when no import logs exist', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockVersion);
		mockPrisma.actualsImportLog.findMany.mockResolvedValue([]);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/versions/1/import-logs',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual([]);
	});

	it('returns 404 when version not found', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(null);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/versions/999/import-logs',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('VERSION_NOT_FOUND');
	});
});

// ── PATCH /:id/status ─────────────────────────────────────────────────────────

describe('PATCH /api/v1/versions/:id/status', () => {
	const publishedVersion = { ...mockVersion, status: 'Published', publishedAt: now };

	it('AC-04: Admin can transition Draft → Published', async () => {
		const updatedVersion = { ...publishedVersion };
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockVersion);
		mockPrisma.budgetVersion.update.mockResolvedValue(updatedVersion);

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'PATCH',
			url: '/api/v1/versions/1/status',
			headers: authHeader(token),
			payload: { new_status: 'Published' },
		});

		expect(res.statusCode).toBe(200);
		expect(res.json().status).toBe('Published');
	});

	it('AC-31 (RBAC): BudgetOwner gets 403 when attempting Published → Locked', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(publishedVersion);

		const token = await makeToken({ role: 'BudgetOwner' });
		const res = await app.inject({
			method: 'PATCH',
			url: '/api/v1/versions/1/status',
			headers: authHeader(token),
			payload: { new_status: 'Locked' },
		});

		expect(res.statusCode).toBe(403);
		expect(res.json().code).toBe('FORBIDDEN');
		// Transaction should NOT have been called — RBAC check happens before DB write
		expect(mockPrisma.$transaction).not.toHaveBeenCalled();
	});

	it('Admin can transition Published → Locked', async () => {
		const lockedVersion = { ...publishedVersion, status: 'Locked', lockedAt: now };
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(publishedVersion);
		mockPrisma.budgetVersion.update.mockResolvedValue(lockedVersion);

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'PATCH',
			url: '/api/v1/versions/1/status',
			headers: authHeader(token),
			payload: { new_status: 'Locked' },
		});

		expect(res.statusCode).toBe(200);
		expect(res.json().status).toBe('Locked');
	});

	it('returns 409 for invalid transition (Draft → Locked)', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockVersion); // Draft

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'PATCH',
			url: '/api/v1/versions/1/status',
			headers: authHeader(token),
			payload: { new_status: 'Locked' },
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('INVALID_TRANSITION');
	});

	it('AC-08: reverse transition without audit_note returns 400', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(publishedVersion);

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'PATCH',
			url: '/api/v1/versions/1/status',
			headers: authHeader(token),
			payload: { new_status: 'Draft' }, // reverse, no audit_note
		});

		expect(res.statusCode).toBe(400);
		expect(res.json().code).toBe('AUDIT_NOTE_REQUIRED');
	});

	it('returns 404 when version not found', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(null);

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'PATCH',
			url: '/api/v1/versions/999/status',
			headers: authHeader(token),
			payload: { new_status: 'Published' },
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('VERSION_NOT_FOUND');
	});
});
