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

vi.mock('../../services/cohort-recommendations.js', () => ({
	getHistoricalCohortRecommendations: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../lib/prisma.js', () => {
	const mockPrisma = {
		budgetVersion: {
			findUnique: vi.fn(),
			findMany: vi.fn().mockResolvedValue([]),
			update: vi.fn().mockResolvedValue({}),
		},
		enrollmentHeadcount: {
			findMany: vi.fn(),
			upsert: vi.fn().mockResolvedValue({}),
		},
		gradeLevel: {
			findMany: vi.fn(),
		},
		versionCapacityConfig: {
			findMany: vi.fn().mockResolvedValue([]),
		},
		auditEntry: {
			create: vi.fn().mockResolvedValue({ id: 1 }),
		},
		calculationAuditLog: {
			create: vi.fn().mockResolvedValue({ id: 1 }),
			updateMany: vi.fn().mockResolvedValue({ count: 1 }),
		},
		dhgRequirement: {
			upsert: vi.fn().mockResolvedValue({}),
		},
		cohortParameter: {
			findMany: vi.fn().mockResolvedValue([]),
		},
		nationalityBreakdown: {
			findMany: vi.fn().mockResolvedValue([]),
			upsert: vi.fn().mockResolvedValue({}),
		},
		$transaction: vi.fn().mockImplementation((fn: (tx: Record<string, unknown>) => unknown) =>
			fn({
				budgetVersion: mockPrisma.budgetVersion,
				enrollmentHeadcount: mockPrisma.enrollmentHeadcount,
				gradeLevel: mockPrisma.gradeLevel,
				versionCapacityConfig: mockPrisma.versionCapacityConfig,
				auditEntry: mockPrisma.auditEntry,
				calculationAuditLog: mockPrisma.calculationAuditLog,
				dhgRequirement: mockPrisma.dhgRequirement,
				cohortParameter: mockPrisma.cohortParameter,
				nationalityBreakdown: mockPrisma.nationalityBreakdown,
			})
		),
	};
	return { prisma: mockPrisma };
});

import { prisma } from '../../lib/prisma.js';

const mockPrisma = prisma as unknown as {
	budgetVersion: {
		findUnique: ReturnType<typeof vi.fn>;
		findMany: ReturnType<typeof vi.fn>;
		update: ReturnType<typeof vi.fn>;
	};
	enrollmentHeadcount: {
		findMany: ReturnType<typeof vi.fn>;
		upsert: ReturnType<typeof vi.fn>;
	};
	gradeLevel: {
		findMany: ReturnType<typeof vi.fn>;
	};
	versionCapacityConfig: {
		findMany: ReturnType<typeof vi.fn>;
	};
	auditEntry: { create: ReturnType<typeof vi.fn> };
	calculationAuditLog: {
		create: ReturnType<typeof vi.fn>;
		updateMany: ReturnType<typeof vi.fn>;
	};
	dhgRequirement: {
		upsert: ReturnType<typeof vi.fn>;
	};
	cohortParameter: {
		findMany: ReturnType<typeof vi.fn>;
	};
	nationalityBreakdown: {
		findMany: ReturnType<typeof vi.fn>;
		upsert: ReturnType<typeof vi.fn>;
	};
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

const ROUTE_PREFIX = '/api/v1/versions/:versionId/calculate';
const URL_PREFIX = '/api/v1/versions/1/calculate';

const mockDraftVersion = {
	id: 1,
	fiscalYear: 2026,
	name: 'Budget v1',
	type: 'Budget',
	status: 'Draft',
	dataSource: 'MANUAL',
	staleModules: ['ENROLLMENT', 'REVENUE'],
	modificationCount: 0,
	rolloverThreshold: 1,
	cappedRetention: 0.98,
	retentionRecentWeight: 0.6,
	historicalTargetRecentWeight: 0.8,
};

const mockGradeLevels = [
	{
		gradeCode: 'PS',
		gradeName: 'Petite Section',
		band: 'MATERNELLE',
		displayOrder: 1,
		maxClassSize: 25,
		plafondPct: 1.0,
	},
	{
		gradeCode: 'MS',
		gradeName: 'Moyenne Section',
		band: 'MATERNELLE',
		displayOrder: 2,
		maxClassSize: 25,
		plafondPct: 1.0,
	},
	{
		gradeCode: 'GS',
		gradeName: 'Grande Section',
		band: 'MATERNELLE',
		displayOrder: 3,
		maxClassSize: 25,
		plafondPct: 1.0,
	},
	{
		gradeCode: 'CP',
		gradeName: 'CP',
		band: 'ELEMENTAIRE',
		displayOrder: 4,
		maxClassSize: 28,
		plafondPct: 1.1,
	},
	{
		gradeCode: 'CE1',
		gradeName: 'CE1',
		band: 'ELEMENTAIRE',
		displayOrder: 5,
		maxClassSize: 28,
		plafondPct: 1.1,
	},
	{
		gradeCode: 'CE2',
		gradeName: 'CE2',
		band: 'ELEMENTAIRE',
		displayOrder: 6,
		maxClassSize: 28,
		plafondPct: 1.1,
	},
	{
		gradeCode: 'CM1',
		gradeName: 'CM1',
		band: 'ELEMENTAIRE',
		displayOrder: 7,
		maxClassSize: 28,
		plafondPct: 1.1,
	},
	{
		gradeCode: 'CM2',
		gradeName: 'CM2',
		band: 'ELEMENTAIRE',
		displayOrder: 8,
		maxClassSize: 28,
		plafondPct: 1.1,
	},
	{
		gradeCode: '6EME',
		gradeName: '6EME',
		band: 'COLLEGE',
		displayOrder: 9,
		maxClassSize: 30,
		plafondPct: 1.1,
	},
	{
		gradeCode: '5EME',
		gradeName: '5EME',
		band: 'COLLEGE',
		displayOrder: 10,
		maxClassSize: 30,
		plafondPct: 1.1,
	},
	{
		gradeCode: '4EME',
		gradeName: '4EME',
		band: 'COLLEGE',
		displayOrder: 11,
		maxClassSize: 30,
		plafondPct: 1.1,
	},
	{
		gradeCode: '3EME',
		gradeName: '3EME',
		band: 'COLLEGE',
		displayOrder: 12,
		maxClassSize: 30,
		plafondPct: 1.1,
	},
	{
		gradeCode: '2NDE',
		gradeName: '2NDE',
		band: 'LYCEE',
		displayOrder: 13,
		maxClassSize: 35,
		plafondPct: 1.1,
	},
	{
		gradeCode: '1ERE',
		gradeName: '1ERE',
		band: 'LYCEE',
		displayOrder: 14,
		maxClassSize: 35,
		plafondPct: 1.1,
	},
	{
		gradeCode: 'TERM',
		gradeName: 'TERM',
		band: 'LYCEE',
		displayOrder: 15,
		maxClassSize: 35,
		plafondPct: 1.1,
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
			url: `${URL_PREFIX}/enrollment`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();

		expect(body.runId).toBeDefined();
		expect(body.durationMs).toBeGreaterThanOrEqual(0);
		// AY1 (2 grades with data) + AY2 (15 grades from cohort progression) = 17+ results
		expect(body.results.length).toBeGreaterThanOrEqual(17);
		expect(body.summary.totalStudentsAy1).toBe(45);
		// AY2: PS gets 20 (from AY1 default), MS gets floor(20*0.97)=19, etc.
		expect(body.summary.totalStudentsAy2).toBeGreaterThan(0);

		// CP AY1: 25 students, maxClassSize=28 → 1 section
		const cpAy1 = body.results.find(
			(r: Record<string, unknown>) => r.gradeLevel === 'CP' && r.academicPeriod === 'AY1'
		);
		expect(cpAy1.sectionsNeeded).toBe(1);
		expect(cpAy1.maxClassSize).toBe(28);
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
			url: `${URL_PREFIX}/enrollment`,
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
			url: `${URL_PREFIX}/enrollment`,
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
			url: `${URL_PREFIX}/enrollment`,
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
			url: `${URL_PREFIX}/enrollment`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('VERSION_NOT_FOUND');
	});

	it('Viewer cannot calculate → 403', async () => {
		const token = await makeToken({ role: 'Viewer' });
		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/enrollment`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(403);
		expect(res.json().code).toBe('FORBIDDEN');
	});

	it('returns 401 without auth', async () => {
		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/enrollment`,
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
			url: `${URL_PREFIX}/enrollment`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		// Find CP AY1 result specifically (zero headcount)
		const cpAy1 = body.results.find(
			(r: Record<string, unknown>) => r.gradeLevel === 'CP' && r.academicPeriod === 'AY1'
		);
		expect(cpAy1.sectionsNeeded).toBe(0);
		expect(cpAy1.utilization).toBe(0);
		expect(cpAy1.alert).toBeNull();
		expect(cpAy1.recruitmentSlots).toBe(0);
	});
});
