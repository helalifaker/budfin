import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { generateKeyPair } from 'jose';
import { auth } from '../../plugins/auth.js';
import { prisma } from '../../lib/prisma.js';
import { planningRulesRoutes } from './planning-rules.js';
import { setKeys, signAccessToken } from '../../services/token.js';

vi.mock('../../lib/prisma.js', () => {
	const mockPrisma = {
		budgetVersion: {
			findUnique: vi.fn(),
			update: vi.fn(),
		},
		auditEntry: {
			create: vi.fn().mockResolvedValue({ id: 1 }),
		},
		$transaction: vi.fn().mockImplementation((fn: (tx: Record<string, unknown>) => unknown) =>
			fn({
				budgetVersion: mockPrisma.budgetVersion,
				auditEntry: mockPrisma.auditEntry,
			})
		),
	};
	return { prisma: mockPrisma };
});

const mockPrisma = prisma as unknown as {
	budgetVersion: {
		findUnique: ReturnType<typeof vi.fn>;
		update: ReturnType<typeof vi.fn>;
	};
	auditEntry: {
		create: ReturnType<typeof vi.fn>;
	};
	$transaction: ReturnType<typeof vi.fn>;
};

const ROUTE_PREFIX = '/api/v1/versions/:versionId/enrollment';
const URL_PREFIX = '/api/v1/versions/1/enrollment';

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
	await app.register(planningRulesRoutes, { prefix: ROUTE_PREFIX });
	await app.ready();
});

describe('GET /planning-rules', () => {
	it('returns the persisted version planning rules', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValueOnce({
			id: 1,
			rolloverThreshold: 1.03,
			cappedRetention: 0.99,
		});

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/planning-rules`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual({
			rolloverThreshold: 1.03,
			cappedRetention: 0.99,
		});
	});
});

describe('PUT /planning-rules', () => {
	it('updates rules and marks downstream modules stale', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValueOnce({
			id: 1,
			status: 'Draft',
			dataSource: 'MANUAL',
			staleModules: ['REVENUE'],
		});
		mockPrisma.budgetVersion.update.mockResolvedValueOnce({
			rolloverThreshold: '1.0200',
			cappedRetention: '0.9900',
		});

		const token = await makeToken();
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/planning-rules`,
			headers: authHeader(token),
			payload: {
				rolloverThreshold: 1.02,
				cappedRetention: 0.99,
			},
		});

		expect(res.statusCode).toBe(200);
		expect(mockPrisma.budgetVersion.update).toHaveBeenCalledWith({
			where: { id: 1 },
			data: {
				rolloverThreshold: '1.0200',
				cappedRetention: '0.9900',
				staleModules: ['REVENUE', 'ENROLLMENT', 'DHG', 'STAFFING', 'PNL'],
			},
			select: {
				rolloverThreshold: true,
				cappedRetention: true,
			},
		});
		expect(res.json()).toEqual({
			rolloverThreshold: 1.02,
			cappedRetention: 0.99,
			staleModules: ['REVENUE', 'ENROLLMENT', 'DHG', 'STAFFING', 'PNL'],
		});
	});
});
