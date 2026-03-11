import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { generateKeyPair } from 'jose';
import { auth } from '../../plugins/auth.js';
import { prisma } from '../../lib/prisma.js';
import { enrollmentCapacityResultsRoutes } from './capacity-results.js';
import { setKeys, signAccessToken } from '../../services/token.js';

vi.mock('../../lib/prisma.js', () => {
	const mockPrisma = {
		budgetVersion: {
			findUnique: vi.fn(),
		},
		dhgRequirement: {
			findMany: vi.fn(),
		},
	};
	return { prisma: mockPrisma };
});

const mockPrisma = prisma as unknown as {
	budgetVersion: {
		findUnique: ReturnType<typeof vi.fn>;
	};
	dhgRequirement: {
		findMany: ReturnType<typeof vi.fn>;
	};
};

const ROUTE_PREFIX = '/api/v1/versions/:versionId/enrollment';
const URL_PREFIX = '/api/v1/versions/1/enrollment';

let app: FastifyInstance;

async function makeToken() {
	return signAccessToken({
		sub: 1,
		email: 'admin@budfin.app',
		role: 'Admin',
		sessionId: 'test-session-id',
	});
}

function authHeader(token: string) {
	return { authorization: `Bearer ${token}` };
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
	await app.register(enrollmentCapacityResultsRoutes, { prefix: ROUTE_PREFIX });
	await app.ready();
});

describe('GET /capacity-results', () => {
	it('returns 404 when the version does not exist', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValueOnce(null);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/capacity-results`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('VERSION_NOT_FOUND');
	});

	it('returns persisted results with summary totals', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValueOnce({ id: 1 });
		mockPrisma.dhgRequirement.findMany.mockResolvedValueOnce([
			{
				gradeLevel: 'PS',
				academicPeriod: 'AY1',
				headcount: 90,
				maxClassSize: 25,
				sectionsNeeded: 4,
				utilization: 90,
				alert: 'OK',
				recruitmentSlots: 10,
			},
			{
				gradeLevel: 'PS',
				academicPeriod: 'AY2',
				headcount: 95,
				maxClassSize: 25,
				sectionsNeeded: 4,
				utilization: 95,
				alert: 'OVER',
				recruitmentSlots: 5,
			},
		]);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/capacity-results`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		expect(res.json().summary).toEqual({
			totalStudentsAy1: 90,
			totalStudentsAy2: 95,
			overCapacityGrades: ['PS'],
		});
		expect(res.json().results).toHaveLength(2);
	});
});
