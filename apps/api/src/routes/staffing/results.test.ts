/**
 * Story #157 — Stale data enforcement for GET /staff-costs and GET /staffing-summary
 *
 * AC-09: Returns 409 STALE_DATA when STAFFING is in stale_modules
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { generateKeyPair } from 'jose';
import { setKeys, signAccessToken } from '../../services/token.js';
import { auth } from '../../plugins/auth.js';
import { staffingResultRoutes } from './results.js';

// ── Mock Prisma ─────────────────────────────────────────────────────────────

vi.mock('../../lib/prisma.js', () => {
	const mockPrisma = {
		budgetVersion: {
			findUnique: vi.fn(),
		},
		monthlyStaffCost: {
			findMany: vi.fn(),
		},
		teachingRequirementLine: {
			findMany: vi.fn(),
		},
		categoryMonthlyCost: {
			findMany: vi.fn(),
		},
	};
	return { prisma: mockPrisma };
});

import { prisma } from '../../lib/prisma.js';

const mockPrisma = prisma as unknown as {
	budgetVersion: {
		findUnique: ReturnType<typeof vi.fn>;
	};
	monthlyStaffCost: {
		findMany: ReturnType<typeof vi.fn>;
	};
	teachingRequirementLine: {
		findMany: ReturnType<typeof vi.fn>;
	};
	categoryMonthlyCost: {
		findMany: ReturnType<typeof vi.fn>;
	};
};

let app: FastifyInstance;

async function makeToken(role = 'Admin') {
	return signAccessToken({
		sub: 1,
		email: 'admin@budfin.app',
		role,
		sessionId: 'test-session-id',
	});
}

function authHeader(token: string) {
	return { authorization: `Bearer ${token}` };
}

const ROUTE_PREFIX = '/api/v1/versions/:versionId';
const URL_PREFIX = '/api/v1/versions/1';

const mockFreshVersion = {
	id: 1,
	name: 'Budget v1',
	status: 'Draft',
	staleModules: [] as string[],
};

const mockStaleVersion = {
	id: 1,
	name: 'Budget v1',
	status: 'Draft',
	staleModules: ['STAFFING'],
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
	await app.register(staffingResultRoutes, { prefix: ROUTE_PREFIX });
	await app.ready();
});

// ── GET /staff-costs ────────────────────────────────────────────────────────

describe('GET /staff-costs', () => {
	it('AC-09: returns 409 STALE_DATA when STAFFING is in stale_modules', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockStaleVersion);
		const token = await makeToken();

		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/staff-costs`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(409);
		const body = res.json();
		expect(body.code).toBe('STALE_DATA');
		expect(body.message).toMatch(/not been.*calculated/i);
	});

	it('returns 200 when STAFFING is NOT in stale_modules', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockFreshVersion);
		mockPrisma.monthlyStaffCost.findMany.mockResolvedValue([]);
		const token = await makeToken();

		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/staff-costs`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
	});
});

// ── GET /staffing-summary ───────────────────────────────────────────────────

describe('GET /staffing-summary', () => {
	it('AC-09: returns 409 STALE_DATA when STAFFING is in stale_modules', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockStaleVersion);
		const token = await makeToken();

		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/staffing-summary`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(409);
		const body = res.json();
		expect(body.code).toBe('STALE_DATA');
		expect(body.message).toMatch(/not been.*calculated/i);
	});

	it('returns 200 when STAFFING is NOT in stale_modules', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockFreshVersion);
		mockPrisma.teachingRequirementLine.findMany.mockResolvedValue([]);
		mockPrisma.monthlyStaffCost.findMany.mockResolvedValue([]);
		const token = await makeToken();

		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/staffing-summary`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
	});
});
