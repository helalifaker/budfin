/**
 * Story #54 — Fiscal Period API (remediated)
 *
 * GET /api/v1/fiscal-periods/:fiscalYear
 * PATCH /api/v1/fiscal-periods/:fiscalYear/:month/lock
 *
 * AC-14: GET returns exactly 12 rows; auto-seeds on first GET for new fiscal year
 * AC-15: PATCH /lock with valid actual_version_id (Locked Actual IMPORTED version) → status=Locked
 * AC-19 (partial): Editor/Viewer on PATCH /lock → 403
 * PERIOD_ALREADY_LOCKED: 409 if period is already locked
 * INVALID_ACTUAL_VERSION: 422 if version is not Actual+Locked+IMPORTED
 * VERSION_NOT_FOUND: 404 if actual_version_id does not exist
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { generateKeyPair } from 'jose';
import { setKeys, signAccessToken } from '../services/token.js';
import { auth } from '../plugins/auth.js';
import { fiscalPeriodRoutes } from './fiscal-periods.js';

vi.mock('../lib/prisma.js', () => {
	const mockPrisma = {
		fiscalPeriod: {
			findMany: vi.fn(),
			findUnique: vi.fn(),
			createMany: vi.fn().mockResolvedValue({ count: 0 }),
			update: vi.fn(),
		},
		budgetVersion: {
			findUnique: vi.fn(),
		},
		auditEntry: {
			create: vi.fn().mockResolvedValue({ id: 1 }),
		},
		$transaction: vi.fn().mockImplementation((fn: (tx: Record<string, unknown>) => unknown) =>
			fn({
				fiscalPeriod: mockPrisma.fiscalPeriod,
				budgetVersion: mockPrisma.budgetVersion,
				auditEntry: mockPrisma.auditEntry,
			})
		),
	};
	return { prisma: mockPrisma };
});

import { prisma } from '../lib/prisma.js';

const mockPrisma = prisma as unknown as {
	fiscalPeriod: {
		findMany: ReturnType<typeof vi.fn>;
		findUnique: ReturnType<typeof vi.fn>;
		createMany: ReturnType<typeof vi.fn>;
		update: ReturnType<typeof vi.fn>;
	};
	budgetVersion: {
		findUnique: ReturnType<typeof vi.fn>;
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

function make12Periods(fiscalYear: number) {
	return Array.from({ length: 12 }, (_, i) => makePeriod(fiscalYear, i + 1));
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
	await app.register(fiscalPeriodRoutes, { prefix: '/api/v1/fiscal-periods' });
	await app.ready();
});

// ── AC-14: GET /:fiscalYear ───────────────────────────────────────────────────

describe('GET /api/v1/fiscal-periods/:fiscalYear', () => {
	it('AC-14: returns exactly 12 rows for existing fiscal year', async () => {
		mockPrisma.fiscalPeriod.findMany.mockResolvedValue(make12Periods(2026));

		const token = await makeToken({ role: 'Viewer' });
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/fiscal-periods/2026',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body).toHaveLength(12);
		expect(body[0].month).toBe(1);
		expect(body[11].month).toBe(12);
		expect(body[0].fiscalYear).toBe(2026);
	});

	it('AC-14: auto-seeds 12 rows on first GET (empty result -> createMany then re-fetch)', async () => {
		mockPrisma.fiscalPeriod.findMany
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce(make12Periods(2027));

		const token = await makeToken({ role: 'Viewer' });
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/fiscal-periods/2027',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		expect(mockPrisma.fiscalPeriod.createMany).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.arrayContaining([
					expect.objectContaining({ fiscalYear: 2027, month: 1, status: 'Draft' }),
					expect.objectContaining({ fiscalYear: 2027, month: 12, status: 'Draft' }),
				]),
				skipDuplicates: true,
			})
		);
		expect(res.json()).toHaveLength(12);
	});

	it('each row has required fields: status, actualVersionId, lockedAt', async () => {
		mockPrisma.fiscalPeriod.findMany.mockResolvedValue(make12Periods(2026));

		const token = await makeToken({ role: 'Viewer' });
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/fiscal-periods/2026',
			headers: authHeader(token),
		});

		const period = res.json()[0];
		expect(period).toHaveProperty('status');
		expect(period).toHaveProperty('actualVersionId');
		expect(period).toHaveProperty('lockedAt');
		expect(period).toHaveProperty('month');
		expect(period).toHaveProperty('fiscalYear');
	});

	it('returns 401 without token', async () => {
		const res = await app.inject({ method: 'GET', url: '/api/v1/fiscal-periods/2026' });
		expect(res.statusCode).toBe(401);
	});
});

// ── AC-15: PATCH /:fiscalYear/:month/lock ────────────────────────────────────

describe('PATCH /api/v1/fiscal-periods/:fiscalYear/:month/lock', () => {
	it('AC-15: Admin locks period with valid Locked Actual IMPORTED version', async () => {
		const lockedActual = { id: 5, type: 'Actual', status: 'Locked', dataSource: 'IMPORTED' };
		const period = makePeriod(2026, 1);
		const updatedPeriod = {
			...period,
			status: 'Locked',
			actualVersionId: 5,
			lockedAt: now,
			lockedById: 1,
		};

		// Period not already locked
		mockPrisma.fiscalPeriod.findUnique.mockResolvedValue(period);
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(lockedActual);
		mockPrisma.fiscalPeriod.update.mockResolvedValue(updatedPeriod);

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'PATCH',
			url: '/api/v1/fiscal-periods/2026/1/lock',
			headers: authHeader(token),
			payload: { actual_version_id: 5 },
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.status).toBe('Locked');
		expect(body.actualVersionId).toBe(5);
	});

	it('AC-15: BudgetOwner can lock a period', async () => {
		const lockedActual = { id: 5, type: 'Actual', status: 'Locked', dataSource: 'IMPORTED' };
		const period = makePeriod(2026, 1);
		const updatedPeriod = makePeriod(2026, 1, { status: 'Locked', actualVersionId: 5 });

		mockPrisma.fiscalPeriod.findUnique.mockResolvedValue(period);
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(lockedActual);
		mockPrisma.fiscalPeriod.update.mockResolvedValue(updatedPeriod);

		const token = await makeToken({ role: 'BudgetOwner' });
		const res = await app.inject({
			method: 'PATCH',
			url: '/api/v1/fiscal-periods/2026/1/lock',
			headers: authHeader(token),
			payload: { actual_version_id: 5 },
		});

		expect(res.statusCode).toBe(200);
	});

	it('AC-15: writes audit entry FISCAL_PERIOD_LOCKED', async () => {
		const lockedActual = { id: 5, type: 'Actual', status: 'Locked', dataSource: 'IMPORTED' };
		const period = makePeriod(2026, 1);

		mockPrisma.fiscalPeriod.findUnique.mockResolvedValue(period);
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(lockedActual);
		mockPrisma.fiscalPeriod.update.mockResolvedValue(makePeriod(2026, 1, { status: 'Locked' }));

		const token = await makeToken({ role: 'Admin' });
		await app.inject({
			method: 'PATCH',
			url: '/api/v1/fiscal-periods/2026/1/lock',
			headers: authHeader(token),
			payload: { actual_version_id: 5 },
		});

		expect(mockPrisma.auditEntry.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ operation: 'FISCAL_PERIOD_LOCKED' }),
			})
		);
	});

	it('409 PERIOD_ALREADY_LOCKED when period is already locked', async () => {
		const lockedPeriod = makePeriod(2026, 1, { status: 'Locked', actualVersionId: 5 });
		mockPrisma.fiscalPeriod.findUnique.mockResolvedValue(lockedPeriod);

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'PATCH',
			url: '/api/v1/fiscal-periods/2026/1/lock',
			headers: authHeader(token),
			payload: { actual_version_id: 5 },
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('PERIOD_ALREADY_LOCKED');
	});

	it('422 INVALID_ACTUAL_VERSION when version is non-Actual type', async () => {
		const period = makePeriod(2026, 1);
		mockPrisma.fiscalPeriod.findUnique.mockResolvedValue(period);
		mockPrisma.budgetVersion.findUnique.mockResolvedValue({
			id: 3,
			type: 'Budget',
			status: 'Locked',
			dataSource: 'IMPORTED',
		});

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'PATCH',
			url: '/api/v1/fiscal-periods/2026/1/lock',
			headers: authHeader(token),
			payload: { actual_version_id: 3 },
		});

		expect(res.statusCode).toBe(422);
		expect(res.json().code).toBe('INVALID_ACTUAL_VERSION');
	});

	it('422 INVALID_ACTUAL_VERSION when Actual version is not Locked', async () => {
		const period = makePeriod(2026, 1);
		mockPrisma.fiscalPeriod.findUnique.mockResolvedValue(period);
		mockPrisma.budgetVersion.findUnique.mockResolvedValue({
			id: 6,
			type: 'Actual',
			status: 'Published',
			dataSource: 'IMPORTED',
		});

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'PATCH',
			url: '/api/v1/fiscal-periods/2026/1/lock',
			headers: authHeader(token),
			payload: { actual_version_id: 6 },
		});

		expect(res.statusCode).toBe(422);
		expect(res.json().code).toBe('INVALID_ACTUAL_VERSION');
	});

	// B7: dataSource === 'IMPORTED' check removed per audit — any dataSource is valid
	// as long as version is type=Actual and status=Locked

	it('404 VERSION_NOT_FOUND when actual_version_id does not exist', async () => {
		const period = makePeriod(2026, 1);
		mockPrisma.fiscalPeriod.findUnique.mockResolvedValue(period);
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(null);

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'PATCH',
			url: '/api/v1/fiscal-periods/2026/1/lock',
			headers: authHeader(token),
			payload: { actual_version_id: 999 },
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('VERSION_NOT_FOUND');
	});

	it('AC-19: Editor gets 403 on PATCH /lock', async () => {
		const token = await makeToken({ role: 'Editor' });
		const res = await app.inject({
			method: 'PATCH',
			url: '/api/v1/fiscal-periods/2026/1/lock',
			headers: authHeader(token),
			payload: { actual_version_id: 5 },
		});

		expect(res.statusCode).toBe(403);
		expect(res.json().code).toBe('FORBIDDEN');
	});

	it('AC-19: Viewer gets 403 on PATCH /lock', async () => {
		const token = await makeToken({ role: 'Viewer' });
		const res = await app.inject({
			method: 'PATCH',
			url: '/api/v1/fiscal-periods/2026/1/lock',
			headers: authHeader(token),
			payload: { actual_version_id: 5 },
		});

		expect(res.statusCode).toBe(403);
		expect(res.json().code).toBe('FORBIDDEN');
	});
});
