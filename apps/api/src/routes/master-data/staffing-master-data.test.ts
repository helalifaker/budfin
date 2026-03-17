import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
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
		},
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
	};
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

// ── DHG Rules ────────────────────────────────────────────────────────────────

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
