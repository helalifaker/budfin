import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { Prisma } from '@prisma/client';
import { generateKeyPair } from 'jose';
import { auth } from '../../plugins/auth.js';
import { staffingMasterDataRoutes } from './staffing-master-data.js';
import { setKeys, signAccessToken } from '../../services/token.js';

vi.mock('../../lib/prisma.js', () => {
	const mockPrisma = {
		serviceObligationProfile: {
			findMany: vi.fn(),
		},
		discipline: {
			findMany: vi.fn(),
		},
		dhgRule: {
			findMany: vi.fn(),
			findUnique: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
			delete: vi.fn(),
		},
		auditEntry: {
			create: vi.fn(),
		},
		$transaction: vi
			.fn()
			.mockImplementation((fn: (tx: Record<string, unknown>) => unknown) => fn(mockPrisma)),
	};
	return { prisma: mockPrisma };
});

import { prisma } from '../../lib/prisma.js';

const mockPrisma = prisma as unknown as {
	serviceObligationProfile: {
		findMany: ReturnType<typeof vi.fn>;
	};
	discipline: {
		findMany: ReturnType<typeof vi.fn>;
	};
	dhgRule: {
		findMany: ReturnType<typeof vi.fn>;
		findUnique: ReturnType<typeof vi.fn>;
		create: ReturnType<typeof vi.fn>;
		update: ReturnType<typeof vi.fn>;
		delete: ReturnType<typeof vi.fn>;
	};
	auditEntry: {
		create: ReturnType<typeof vi.fn>;
	};
	$transaction: ReturnType<typeof vi.fn>;
};

let app: FastifyInstance;

async function makeToken(role = 'Admin') {
	return signAccessToken({
		sub: 1,
		email: 'admin@budfin.app',
		role,
		sessionId: 'staffing-md-session',
	});
}

function authHeader(token: string) {
	return { authorization: `Bearer ${token}` };
}

const ROUTE_PREFIX = '/api/v1/master-data';

beforeAll(async () => {
	const keys = await generateKeyPair('RS256');
	setKeys(keys.privateKey, keys.publicKey);
});

beforeEach(async () => {
	vi.clearAllMocks();

	// Re-wire $transaction after clearAllMocks resets it
	mockPrisma.$transaction.mockImplementation((fn: (tx: Record<string, unknown>) => unknown) =>
		fn(mockPrisma)
	);

	app = Fastify();
	app.setValidatorCompiler(validatorCompiler);
	app.setSerializerCompiler(serializerCompiler);
	await app.register(auth);
	await app.register(staffingMasterDataRoutes, { prefix: ROUTE_PREFIX });
	await app.ready();
});

// ── Service Profiles ─────────────────────────────────────────────────────────

describe('GET /service-profiles', () => {
	const mockProfiles = [
		{
			id: 1,
			code: 'ENS1D',
			name: 'Enseignant 1er degre',
			weeklyServiceHours: { toString: () => '24.0' },
			hsaEligible: false,
			defaultCostMode: 'LOCAL_PAYROLL',
			sortOrder: 1,
		},
		{
			id: 2,
			code: 'ENS2D',
			name: 'Enseignant 2nd degre',
			weeklyServiceHours: { toString: () => '18.0' },
			hsaEligible: true,
			defaultCostMode: 'LOCAL_PAYROLL',
			sortOrder: 2,
		},
	];

	it('returns all service profiles ordered by sortOrder', async () => {
		mockPrisma.serviceObligationProfile.findMany.mockResolvedValue(mockProfiles);

		const token = await makeToken('Viewer');
		const res = await app.inject({
			method: 'GET',
			url: `${ROUTE_PREFIX}/service-profiles`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.profiles).toHaveLength(2);
		expect(body.profiles[0].code).toBe('ENS1D');
		expect(body.profiles[0].weeklyServiceHours).toBe('24.0');
		expect(body.profiles[1].hsaEligible).toBe(true);
	});

	it('returns 401 without authentication', async () => {
		const res = await app.inject({
			method: 'GET',
			url: `${ROUTE_PREFIX}/service-profiles`,
		});

		expect(res.statusCode).toBe(401);
	});
});

// ── Disciplines ──────────────────────────────────────────────────────────────

describe('GET /disciplines', () => {
	const mockDisciplines = [
		{
			id: 1,
			code: 'MATH',
			name: 'Mathematiques',
			category: 'SUBJECT',
			sortOrder: 1,
			aliases: [{ id: 1, alias: 'Maths' }],
		},
		{
			id: 2,
			code: 'EPS',
			name: 'Education physique',
			category: 'SUPPORT',
			sortOrder: 2,
			aliases: [],
		},
	];

	it('returns all disciplines with aliases', async () => {
		mockPrisma.discipline.findMany.mockResolvedValue(mockDisciplines);

		const token = await makeToken('Viewer');
		const res = await app.inject({
			method: 'GET',
			url: `${ROUTE_PREFIX}/disciplines`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.disciplines).toHaveLength(2);
		expect(body.disciplines[0].aliases).toHaveLength(1);
		expect(body.disciplines[0].aliases[0].alias).toBe('Maths');
	});

	it('filters by category when provided', async () => {
		mockPrisma.discipline.findMany.mockResolvedValue([mockDisciplines[0]]);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: `${ROUTE_PREFIX}/disciplines?category=SUBJECT`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		expect(mockPrisma.discipline.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { category: 'SUBJECT' },
			})
		);
	});
});

// ── DHG Rules — GET ─────────────────────────────────────────────────────────

describe('GET /dhg-rules', () => {
	const mockRules = [
		{
			id: 1,
			gradeLevel: 'CP',
			disciplineId: 1,
			discipline: { code: 'MATH', name: 'Mathematiques' },
			lineType: 'STRUCTURAL',
			driverType: 'HOURS',
			hoursPerUnit: { toString: () => '5.00' },
			serviceProfileId: 1,
			serviceProfile: { code: 'ENS1D', name: 'Enseignant 1er degre' },
			languageCode: null,
			groupingKey: null,
			effectiveFromYear: 2025,
			effectiveToYear: null,
			updatedAt: new Date('2026-03-18T12:00:00Z'),
		},
	];

	it('returns all DHG rules with discipline and profile joins', async () => {
		mockPrisma.dhgRule.findMany.mockResolvedValue(mockRules);

		const token = await makeToken('Viewer');
		const res = await app.inject({
			method: 'GET',
			url: `${ROUTE_PREFIX}/dhg-rules`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.rules).toHaveLength(1);
		expect(body.rules[0].disciplineCode).toBe('MATH');
		expect(body.rules[0].serviceProfileCode).toBe('ENS1D');
		expect(body.rules[0].hoursPerUnit).toBe('5.00');
		expect(body.rules[0].updatedAt).toBe('2026-03-18T12:00:00.000Z');
	});

	it('filters by year when provided', async () => {
		mockPrisma.dhgRule.findMany.mockResolvedValue([]);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: `${ROUTE_PREFIX}/dhg-rules?year=2026`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		expect(mockPrisma.dhgRule.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					effectiveFromYear: { lte: 2026 },
					OR: [{ effectiveToYear: null }, { effectiveToYear: { gte: 2026 } }],
				},
			})
		);
	});

	it('returns empty where when no year filter', async () => {
		mockPrisma.dhgRule.findMany.mockResolvedValue([]);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: `${ROUTE_PREFIX}/dhg-rules`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		expect(mockPrisma.dhgRule.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {},
			})
		);
	});
});

// ── DHG Rules — POST ────────────────────────────────────────────────────────

describe('POST /dhg-rules', () => {
	const validBody = {
		gradeLevel: 'CP',
		disciplineId: 1,
		lineType: 'STRUCTURAL',
		driverType: 'HOURS',
		hoursPerUnit: '5.00',
		serviceProfileId: 1,
		languageCode: null,
		groupingKey: null,
		effectiveFromYear: 2026,
		effectiveToYear: null,
	};

	const mockCreatedRule = {
		id: 10,
		gradeLevel: 'CP',
		disciplineId: 1,
		discipline: { code: 'MATH', name: 'Mathematiques' },
		lineType: 'STRUCTURAL',
		driverType: 'HOURS',
		hoursPerUnit: { toString: () => '5.00' },
		serviceProfileId: 1,
		serviceProfile: { code: 'ENS1D', name: 'Enseignant 1er degre' },
		languageCode: null,
		groupingKey: null,
		effectiveFromYear: 2026,
		effectiveToYear: null,
		createdAt: new Date('2026-03-18T12:00:00Z'),
		updatedAt: new Date('2026-03-18T12:00:00Z'),
	};

	it('creates a DHG rule and returns 201', async () => {
		mockPrisma.dhgRule.create.mockResolvedValue(mockCreatedRule);
		mockPrisma.auditEntry.create.mockResolvedValue({});

		const token = await makeToken('Admin');
		const res = await app.inject({
			method: 'POST',
			url: `${ROUTE_PREFIX}/dhg-rules`,
			headers: authHeader(token),
			payload: validBody,
		});

		expect(res.statusCode).toBe(201);
		const body = res.json();
		expect(body.id).toBe(10);
		expect(body.gradeLevel).toBe('CP');
		expect(body.disciplineCode).toBe('MATH');
		expect(body.serviceProfileCode).toBe('ENS1D');
		expect(body.hoursPerUnit).toBe('5.00');
		expect(body.updatedAt).toBe('2026-03-18T12:00:00.000Z');

		expect(mockPrisma.dhgRule.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					gradeLevel: 'CP',
					disciplineId: 1,
					lineType: 'STRUCTURAL',
					hoursPerUnit: '5.00',
				}),
			})
		);
		expect(mockPrisma.auditEntry.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					operation: 'DHG_RULE_CREATED',
					tableName: 'dhg_rules',
					recordId: 10,
				}),
			})
		);
	});

	it('returns 401 without authentication', async () => {
		const res = await app.inject({
			method: 'POST',
			url: `${ROUTE_PREFIX}/dhg-rules`,
			payload: validBody,
		});

		expect(res.statusCode).toBe(401);
	});

	it('returns 403 for Viewer role (no admin:config)', async () => {
		const token = await makeToken('Viewer');
		const res = await app.inject({
			method: 'POST',
			url: `${ROUTE_PREFIX}/dhg-rules`,
			headers: authHeader(token),
			payload: validBody,
		});

		expect(res.statusCode).toBe(403);
	});

	it('returns 409 for duplicate rule (P2002)', async () => {
		mockPrisma.dhgRule.create.mockRejectedValue(
			new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
				code: 'P2002',
				clientVersion: '6.0.0',
			})
		);

		const token = await makeToken('Admin');
		const res = await app.inject({
			method: 'POST',
			url: `${ROUTE_PREFIX}/dhg-rules`,
			headers: authHeader(token),
			payload: validBody,
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('DUPLICATE_RULE');
	});

	it('returns 400 for invalid body (missing required fields)', async () => {
		const token = await makeToken('Admin');
		const res = await app.inject({
			method: 'POST',
			url: `${ROUTE_PREFIX}/dhg-rules`,
			headers: authHeader(token),
			payload: { gradeLevel: 'CP' },
		});

		expect(res.statusCode).toBe(400);
	});
});

// ── DHG Rules — PUT ─────────────────────────────────────────────────────────

describe('PUT /dhg-rules/:id', () => {
	const updatedAtIso = '2026-03-18T12:00:00.000Z';

	const existingRule = {
		id: 10,
		gradeLevel: 'CP',
		disciplineId: 1,
		lineType: 'STRUCTURAL',
		driverType: 'HOURS',
		hoursPerUnit: { toString: () => '5.00' },
		serviceProfileId: 1,
		languageCode: null,
		groupingKey: null,
		effectiveFromYear: 2026,
		effectiveToYear: null,
		createdAt: new Date('2026-03-18T12:00:00Z'),
		updatedAt: new Date(updatedAtIso),
	};

	const updateBody = {
		gradeLevel: 'CE1',
		disciplineId: 1,
		lineType: 'STRUCTURAL',
		driverType: 'HOURS',
		hoursPerUnit: '6.00',
		serviceProfileId: 1,
		languageCode: null,
		groupingKey: null,
		effectiveFromYear: 2026,
		effectiveToYear: null,
		updatedAt: updatedAtIso,
	};

	const mockUpdatedRule = {
		id: 10,
		gradeLevel: 'CE1',
		disciplineId: 1,
		discipline: { code: 'MATH', name: 'Mathematiques' },
		lineType: 'STRUCTURAL',
		driverType: 'HOURS',
		hoursPerUnit: { toString: () => '6.00' },
		serviceProfileId: 1,
		serviceProfile: { code: 'ENS1D', name: 'Enseignant 1er degre' },
		languageCode: null,
		groupingKey: null,
		effectiveFromYear: 2026,
		effectiveToYear: null,
		createdAt: new Date('2026-03-18T12:00:00Z'),
		updatedAt: new Date('2026-03-18T12:01:00Z'),
	};

	it('updates a DHG rule and returns 200', async () => {
		mockPrisma.dhgRule.findUnique.mockResolvedValue(existingRule);
		mockPrisma.dhgRule.update.mockResolvedValue(mockUpdatedRule);
		mockPrisma.auditEntry.create.mockResolvedValue({});

		const token = await makeToken('Admin');
		const res = await app.inject({
			method: 'PUT',
			url: `${ROUTE_PREFIX}/dhg-rules/10`,
			headers: authHeader(token),
			payload: updateBody,
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.gradeLevel).toBe('CE1');
		expect(body.hoursPerUnit).toBe('6.00');
		expect(body.updatedAt).toBe('2026-03-18T12:01:00.000Z');

		expect(mockPrisma.dhgRule.update).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: 10 },
				data: expect.objectContaining({
					gradeLevel: 'CE1',
					hoursPerUnit: '6.00',
				}),
			})
		);
		expect(mockPrisma.auditEntry.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					operation: 'DHG_RULE_UPDATED',
					tableName: 'dhg_rules',
					recordId: 10,
				}),
			})
		);
	});

	it('returns 404 when rule not found', async () => {
		mockPrisma.dhgRule.findUnique.mockResolvedValue(null);

		const token = await makeToken('Admin');
		const res = await app.inject({
			method: 'PUT',
			url: `${ROUTE_PREFIX}/dhg-rules/999`,
			headers: authHeader(token),
			payload: updateBody,
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('NOT_FOUND');
	});

	it('returns 409 on optimistic lock conflict', async () => {
		const staleRule = {
			...existingRule,
			updatedAt: new Date('2026-03-18T11:00:00.000Z'),
		};
		mockPrisma.dhgRule.findUnique.mockResolvedValue(staleRule);

		const token = await makeToken('Admin');
		const res = await app.inject({
			method: 'PUT',
			url: `${ROUTE_PREFIX}/dhg-rules/10`,
			headers: authHeader(token),
			payload: updateBody,
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('OPTIMISTIC_LOCK');
		expect(mockPrisma.dhgRule.update).not.toHaveBeenCalled();
	});
});

// ── DHG Rules — DELETE ──────────────────────────────────────────────────────

describe('DELETE /dhg-rules/:id', () => {
	const existingRule = {
		id: 10,
		gradeLevel: 'CP',
		disciplineId: 1,
		lineType: 'STRUCTURAL',
		driverType: 'HOURS',
		hoursPerUnit: { toString: () => '5.00' },
		serviceProfileId: 1,
		languageCode: null,
		groupingKey: null,
		effectiveFromYear: 2026,
		effectiveToYear: null,
		createdAt: new Date('2026-03-18T12:00:00Z'),
		updatedAt: new Date('2026-03-18T12:00:00Z'),
	};

	it('deletes a DHG rule and returns 204', async () => {
		mockPrisma.dhgRule.findUnique.mockResolvedValue(existingRule);
		mockPrisma.dhgRule.delete.mockResolvedValue(existingRule);
		mockPrisma.auditEntry.create.mockResolvedValue({});

		const token = await makeToken('Admin');
		const res = await app.inject({
			method: 'DELETE',
			url: `${ROUTE_PREFIX}/dhg-rules/10`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(204);
		expect(mockPrisma.dhgRule.delete).toHaveBeenCalledWith({ where: { id: 10 } });
		expect(mockPrisma.auditEntry.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					operation: 'DHG_RULE_DELETED',
					tableName: 'dhg_rules',
					recordId: 10,
				}),
			})
		);
	});

	it('returns 404 when rule not found', async () => {
		mockPrisma.dhgRule.findUnique.mockResolvedValue(null);

		const token = await makeToken('Admin');
		const res = await app.inject({
			method: 'DELETE',
			url: `${ROUTE_PREFIX}/dhg-rules/999`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('NOT_FOUND');
	});
});
