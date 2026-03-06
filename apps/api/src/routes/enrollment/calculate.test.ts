/**
 * Story #83 — Capacity calculation route
 *
 * AC-10 to AC-15: sections, zero headcount, alerts, summary, imported guard, recruitment slots
 * AC-23: removes ENROLLMENT from staleModules after calculation
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { generateKeyPair } from 'jose';
import { setKeys, signAccessToken } from '../../services/token.js';
import { auth } from '../../plugins/auth.js';
import { calculateRoutes } from './calculate.js';

vi.mock('../../lib/prisma.js', () => {
	const mockPrisma = {
		budgetVersion: {
			findUnique: vi.fn(),
			update: vi.fn().mockResolvedValue({}),
		},
		enrollmentHeadcount: {
			findMany: vi.fn(),
		},
		gradeLevel: {
			findMany: vi.fn(),
		},
		auditEntry: {
			create: vi.fn().mockResolvedValue({ id: 1 }),
		},
	};
	return { prisma: mockPrisma };
});

import { prisma } from '../../lib/prisma.js';

const mockPrisma = prisma as unknown as {
	budgetVersion: {
		findUnique: ReturnType<typeof vi.fn>;
		update: ReturnType<typeof vi.fn>;
	};
	enrollmentHeadcount: {
		findMany: ReturnType<typeof vi.fn>;
	};
	gradeLevel: {
		findMany: ReturnType<typeof vi.fn>;
	};
	auditEntry: { create: ReturnType<typeof vi.fn> };
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

const ROUTE_PREFIX = '/api/v1/versions/:versionId/enrollment';
const URL_PREFIX = '/api/v1/versions/1/enrollment';

const mockDraftVersion = {
	id: 1,
	fiscalYear: 2026,
	name: 'Budget v1',
	type: 'Budget',
	status: 'Draft',
	dataSource: 'MANUAL',
	staleModules: ['ENROLLMENT', 'REVENUE'],
	modificationCount: 0,
};

const mockGradeLevels = [
	{
		gradeCode: 'CP',
		gradeName: 'CP',
		band: 'ELEMENTAIRE',
		displayOrder: 4,
		maxClassSize: 28,
		plafondPct: 1.1,
	},
	{
		gradeCode: 'PS',
		gradeName: 'Petite Section',
		band: 'MATERNELLE',
		displayOrder: 1,
		maxClassSize: 25,
		plafondPct: 1.0,
	},
];

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
	await app.register(calculateRoutes, { prefix: ROUTE_PREFIX });
	await app.ready();
});

describe('POST /calculate', () => {
	it('AC-10/13: returns capacity results with summary', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);
		mockPrisma.enrollmentHeadcount.findMany.mockResolvedValue([
			{ gradeLevel: 'CP', academicPeriod: 'AY1', headcount: 25 },
			{ gradeLevel: 'PS', academicPeriod: 'AY1', headcount: 20 },
		]);
		mockPrisma.gradeLevel.findMany.mockResolvedValue(mockGradeLevels);

		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/calculate`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();

		expect(body.runId).toBeDefined();
		expect(body.durationMs).toBeGreaterThanOrEqual(0);
		expect(body.results).toHaveLength(2);
		expect(body.summary.totalStudentsAy1).toBe(45);
		expect(body.summary.totalStudentsAy2).toBe(0);

		// CP: 25 students, maxClassSize=28 → 1 section
		const cpResult = body.results.find((r: Record<string, unknown>) => r.gradeLevel === 'CP');
		expect(cpResult.sectionsNeeded).toBe(1);
		expect(cpResult.maxClassSize).toBe(28);
	});

	it('AC-23: removes ENROLLMENT from staleModules', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);
		mockPrisma.enrollmentHeadcount.findMany.mockResolvedValue([
			{ gradeLevel: 'CP', academicPeriod: 'AY1', headcount: 25 },
		]);
		mockPrisma.gradeLevel.findMany.mockResolvedValue(mockGradeLevels);

		const token = await makeToken();
		await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/calculate`,
			headers: authHeader(token),
		});

		expect(mockPrisma.budgetVersion.update).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: 1 },
				data: {
					staleModules: expect.not.arrayContaining(['ENROLLMENT']),
				},
			})
		);

		// REVENUE should remain in staleModules
		expect(mockPrisma.budgetVersion.update).toHaveBeenCalledWith(
			expect.objectContaining({
				data: {
					staleModules: expect.arrayContaining(['REVENUE']),
				},
			})
		);
	});

	it('AC-14: rejects IMPORTED version → 409', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue({
			...mockDraftVersion,
			dataSource: 'IMPORTED',
		});

		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/calculate`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('IMPORTED_VERSION');
	});

	it('rejects locked version → 409', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue({
			...mockDraftVersion,
			status: 'Locked',
		});

		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/calculate`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('VERSION_LOCKED');
	});

	it('returns 404 for unknown version', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(null);

		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/calculate`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('VERSION_NOT_FOUND');
	});

	it('Viewer cannot calculate → 403', async () => {
		const token = await makeToken({ role: 'Viewer' });
		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/calculate`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(403);
		expect(res.json().error).toBe('FORBIDDEN');
	});

	it('returns 401 without auth', async () => {
		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/calculate`,
		});

		expect(res.statusCode).toBe(401);
	});

	it('AC-11: handles zero headcount', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);
		mockPrisma.enrollmentHeadcount.findMany.mockResolvedValue([
			{ gradeLevel: 'CP', academicPeriod: 'AY1', headcount: 0 },
		]);
		mockPrisma.gradeLevel.findMany.mockResolvedValue(mockGradeLevels);

		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/calculate`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.results[0].sectionsNeeded).toBe(0);
		expect(body.results[0].utilization).toBe(0);
		expect(body.results[0].alert).toBeNull();
		expect(body.results[0].recruitmentSlots).toBe(0);
	});
});
