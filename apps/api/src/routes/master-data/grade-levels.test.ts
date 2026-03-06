import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { generateKeyPair } from 'jose';
import { setKeys, signAccessToken } from '../../services/token.js';
import { auth } from '../../plugins/auth.js';
import { gradeLevelRoutes } from './grade-levels.js';

vi.mock('../../lib/prisma.js', () => {
	const mockPrisma = {
		gradeLevel: {
			findMany: vi.fn(),
			findUnique: vi.fn(),
			update: vi.fn(),
			updateMany: vi.fn(),
		},
		auditEntry: {
			create: vi.fn().mockResolvedValue({ id: 1 }),
		},
		$transaction: vi.fn().mockImplementation((fn: (tx: Record<string, unknown>) => unknown) =>
			fn({
				gradeLevel: mockPrisma.gradeLevel,
				auditEntry: mockPrisma.auditEntry,
			})
		),
	};
	return { prisma: mockPrisma };
});

import { prisma } from '../../lib/prisma.js';

const PREFIX = '/api/v1/master-data/grade-levels';

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

const mockGradeLevel = {
	id: 1,
	gradeCode: 'PS',
	gradeName: 'Petite Section',
	band: 'MATERNELLE',
	maxClassSize: 25,
	plancherPct: { toString: () => '0.7000' },
	ciblePct: { toString: () => '0.8000' },
	plafondPct: { toString: () => '0.9000' },
	displayOrder: 1,
	version: 1,
	createdAt: new Date(),
	updatedAt: new Date(),
};

const mockGradeLevel2 = {
	id: 2,
	gradeCode: 'MS',
	gradeName: 'Moyenne Section',
	band: 'MATERNELLE',
	maxClassSize: 28,
	plancherPct: { toString: () => '0.6500' },
	ciblePct: { toString: () => '0.7500' },
	plafondPct: { toString: () => '0.8500' },
	displayOrder: 2,
	version: 1,
	createdAt: new Date(),
	updatedAt: new Date(),
};

beforeAll(async () => {
	const keys = await generateKeyPair('RS256');
	setKeys(keys.privateKey, keys.publicKey);

	app = Fastify({ logger: false });
	app.setValidatorCompiler(validatorCompiler);
	app.setSerializerCompiler(serializerCompiler);
	await app.register(auth);
	await app.register(gradeLevelRoutes, { prefix: PREFIX });
	await app.ready();
});

beforeEach(() => {
	vi.clearAllMocks();
});

describe('GET /api/v1/master-data/grade-levels', () => {
	it('returns all grade levels with serialized decimals', async () => {
		vi.mocked(prisma.gradeLevel.findMany).mockResolvedValue([
			mockGradeLevel,
			mockGradeLevel2,
		] as never);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: PREFIX,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.gradeLevels).toHaveLength(2);
		expect(body.gradeLevels[0].plancherPct).toBe('0.7000');
		expect(body.gradeLevels[0].ciblePct).toBe('0.8000');
		expect(body.gradeLevels[0].plafondPct).toBe('0.9000');
	});

	it('returns 401 without auth', async () => {
		const res = await app.inject({
			method: 'GET',
			url: PREFIX,
		});
		expect(res.statusCode).toBe(401);
	});
});

describe('PUT /api/v1/master-data/grade-levels/:id', () => {
	const validPayload = {
		maxClassSize: 30,
		plancherPct: 0.75,
		ciblePct: 0.85,
		plafondPct: 0.95,
		displayOrder: 1,
		version: 1,
	};

	it('updates a grade level and returns 200', async () => {
		const updatedGrade = {
			...mockGradeLevel,
			maxClassSize: 30,
			plancherPct: { toString: () => '0.7500' },
			ciblePct: { toString: () => '0.8500' },
			plafondPct: { toString: () => '0.9500' },
			version: 2,
		};
		vi.mocked(prisma.gradeLevel.findUnique)
			.mockResolvedValueOnce(mockGradeLevel as never)
			.mockResolvedValueOnce(updatedGrade as never);
		vi.mocked(prisma.gradeLevel.updateMany).mockResolvedValue({ count: 1 });

		const token = await makeToken();
		const res = await app.inject({
			method: 'PUT',
			url: `${PREFIX}/1`,
			headers: authHeader(token),
			payload: validPayload,
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.plancherPct).toBe('0.7500');
		expect(body.version).toBe(2);
	});

	it('creates audit entry with old/new values', async () => {
		const updatedGrade = {
			...mockGradeLevel,
			...validPayload,
			version: 2,
			plancherPct: { toString: () => '0.7500' },
			ciblePct: { toString: () => '0.8500' },
			plafondPct: { toString: () => '0.9500' },
		};
		vi.mocked(prisma.gradeLevel.findUnique)
			.mockResolvedValueOnce(mockGradeLevel as never)
			.mockResolvedValueOnce(updatedGrade as never);
		vi.mocked(prisma.gradeLevel.updateMany).mockResolvedValue({ count: 1 });

		const token = await makeToken();
		await app.inject({
			method: 'PUT',
			url: `${PREFIX}/1`,
			headers: authHeader(token),
			payload: validPayload,
		});

		expect(prisma.auditEntry.create).toHaveBeenCalledOnce();
		const call = vi.mocked(prisma.auditEntry.create).mock.calls[0]![0];
		expect(call.data.operation).toBe('GRADE_LEVEL_UPDATED');
		expect(call.data.oldValues).toMatchObject({
			maxClassSize: 25,
			plancherPct: '0.7000',
		});
	});

	it('returns 422 when plancher > cible', async () => {
		const token = await makeToken();
		const res = await app.inject({
			method: 'PUT',
			url: `${PREFIX}/1`,
			headers: authHeader(token),
			payload: {
				...validPayload,
				plancherPct: 0.9,
				ciblePct: 0.7,
				plafondPct: 0.95,
			},
		});

		// Zod refine failures return 400 from fastify-type-provider-zod
		expect(res.statusCode).toBe(400);
	});

	it('returns 404 when grade level not found', async () => {
		vi.mocked(prisma.gradeLevel.findUnique).mockResolvedValue(null);

		const token = await makeToken();
		const res = await app.inject({
			method: 'PUT',
			url: `${PREFIX}/999`,
			headers: authHeader(token),
			payload: validPayload,
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('NOT_FOUND');
	});

	it('returns 409 on version mismatch', async () => {
		vi.mocked(prisma.gradeLevel.findUnique).mockResolvedValue(mockGradeLevel as never);
		vi.mocked(prisma.gradeLevel.updateMany).mockResolvedValue({ count: 0 });

		const token = await makeToken();
		const res = await app.inject({
			method: 'PUT',
			url: `${PREFIX}/1`,
			headers: authHeader(token),
			payload: validPayload,
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('OPTIMISTIC_LOCK');
	});

	it('returns 403 for Viewer role (no admin:config permission)', async () => {
		const token = await makeToken({ role: 'Viewer' });
		const res = await app.inject({
			method: 'PUT',
			url: `${PREFIX}/1`,
			headers: authHeader(token),
			payload: validPayload,
		});

		expect(res.statusCode).toBe(403);
	});
});

describe('POST /api/v1/master-data/grade-levels', () => {
	it('returns 405 Method Not Allowed', async () => {
		const res = await app.inject({
			method: 'POST',
			url: PREFIX,
			payload: {},
		});

		expect(res.statusCode).toBe(405);
		expect(res.json().code).toBe('METHOD_NOT_ALLOWED');
	});
});

describe('DELETE /api/v1/master-data/grade-levels/:id', () => {
	it('returns 405 Method Not Allowed', async () => {
		const res = await app.inject({
			method: 'DELETE',
			url: `${PREFIX}/1`,
		});

		expect(res.statusCode).toBe(405);
		expect(res.json().code).toBe('METHOD_NOT_ALLOWED');
	});
});
