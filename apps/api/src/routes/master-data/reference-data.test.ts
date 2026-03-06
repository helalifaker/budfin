import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { generateKeyPair } from 'jose';
import { setKeys, signAccessToken } from '../../services/token.js';
import { auth } from '../../plugins/auth.js';
import { nationalityRoutes } from './nationalities.js';
import { tariffRoutes } from './tariffs.js';
import { departmentRoutes } from './departments.js';

vi.mock('../../lib/prisma.js', () => {
	const mockPrisma = {
		nationality: {
			findMany: vi.fn(),
			findUnique: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
			delete: vi.fn(),
		},
		tariff: {
			findMany: vi.fn(),
			findUnique: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
			delete: vi.fn(),
		},
		department: {
			findMany: vi.fn(),
			findUnique: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
			delete: vi.fn(),
		},
		auditEntry: {
			create: vi.fn().mockResolvedValue({ id: 1 }),
		},
		$transaction: vi
			.fn()
			.mockImplementation((fn: (tx: Record<string, unknown>) => unknown) => fn(mockPrisma)),
	};
	return { prisma: mockPrisma };
});

import { prisma } from '../../lib/prisma.js';
import { Prisma } from '@prisma/client';

let app: FastifyInstance;

async function makeToken(overrides: { sub?: number; role?: string } = {}) {
	return signAccessToken({
		sub: overrides.sub ?? 1,
		email: 'admin@budfin.app',
		role: overrides.role ?? 'Admin',
	});
}

function authHeader(token: string) {
	return { authorization: `Bearer ${token}` };
}

function makePrismaError(code: string) {
	const error = new Prisma.PrismaClientKnownRequestError('error', {
		code,
		clientVersion: '6.0.0',
	});
	return error;
}

beforeAll(async () => {
	const keys = await generateKeyPair('RS256');
	setKeys(keys.privateKey, keys.publicKey);

	app = Fastify({ logger: false });
	app.setValidatorCompiler(validatorCompiler);
	app.setSerializerCompiler(serializerCompiler);
	await app.register(auth);
	await app.register(nationalityRoutes, {
		prefix: '/api/v1/master-data/nationalities',
	});
	await app.register(tariffRoutes, {
		prefix: '/api/v1/master-data/tariffs',
	});
	await app.register(departmentRoutes, {
		prefix: '/api/v1/master-data/departments',
	});
	await app.ready();
});

beforeEach(() => {
	vi.clearAllMocks();
});

// ── Nationalities ───────────────────────────────────────────────────────────

describe('Nationalities', () => {
	const baseUrl = '/api/v1/master-data/nationalities';

	const mockNationality = {
		id: 1,
		code: 'FR',
		label: 'French',
		vatExempt: false,
		version: 1,
		createdAt: new Date(),
		updatedAt: new Date(),
		createdBy: 1,
		updatedBy: 1,
	};

	describe('GET /', () => {
		it('returns nationalities list', async () => {
			vi.mocked(prisma.nationality.findMany).mockResolvedValue([mockNationality]);
			const token = await makeToken();
			const res = await app.inject({
				method: 'GET',
				url: baseUrl,
				headers: authHeader(token),
			});
			expect(res.statusCode).toBe(200);
			expect(res.json().nationalities).toHaveLength(1);
		});
	});

	describe('POST /', () => {
		it('creates nationality — 201', async () => {
			vi.mocked(prisma.nationality.create).mockResolvedValue(mockNationality);
			const token = await makeToken();
			const res = await app.inject({
				method: 'POST',
				url: baseUrl,
				headers: authHeader(token),
				payload: { code: 'FR', label: 'French' },
			});
			expect(res.statusCode).toBe(201);
		});

		it('returns 409 on duplicate code', async () => {
			vi.mocked(prisma.nationality.create).mockRejectedValue(makePrismaError('P2002'));
			const token = await makeToken();
			const res = await app.inject({
				method: 'POST',
				url: baseUrl,
				headers: authHeader(token),
				payload: { code: 'FR', label: 'French' },
			});
			expect(res.statusCode).toBe(409);
			expect(res.json().code).toBe('DUPLICATE_CODE');
		});

		it('returns 403 for Viewer role', async () => {
			const token = await makeToken({ role: 'Viewer' });
			const res = await app.inject({
				method: 'POST',
				url: baseUrl,
				headers: authHeader(token),
				payload: { code: 'FR', label: 'French' },
			});
			expect(res.statusCode).toBe(403);
		});
	});

	describe('PUT /:id', () => {
		it('updates with optimistic lock', async () => {
			vi.mocked(prisma.nationality.findUnique).mockResolvedValue(mockNationality);
			vi.mocked(prisma.nationality.update).mockResolvedValue({
				...mockNationality,
				label: 'Updated',
				version: 2,
			});
			const token = await makeToken();
			const res = await app.inject({
				method: 'PUT',
				url: `${baseUrl}/1`,
				headers: authHeader(token),
				payload: { code: 'FR', label: 'Updated', version: 1 },
			});
			expect(res.statusCode).toBe(200);
		});

		it('returns 404 if not found', async () => {
			vi.mocked(prisma.nationality.findUnique).mockResolvedValue(null);
			const token = await makeToken();
			const res = await app.inject({
				method: 'PUT',
				url: `${baseUrl}/999`,
				headers: authHeader(token),
				payload: { code: 'FR', label: 'Updated', version: 1 },
			});
			expect(res.statusCode).toBe(404);
		});

		it('returns 409 on version mismatch', async () => {
			vi.mocked(prisma.nationality.findUnique).mockResolvedValue(mockNationality);
			const token = await makeToken();
			const res = await app.inject({
				method: 'PUT',
				url: `${baseUrl}/1`,
				headers: authHeader(token),
				payload: { code: 'FR', label: 'Updated', version: 99 },
			});
			expect(res.statusCode).toBe(409);
			expect(res.json().code).toBe('OPTIMISTIC_LOCK');
		});

		it('returns 409 on duplicate code', async () => {
			vi.mocked(prisma.nationality.findUnique).mockResolvedValue(mockNationality);
			vi.mocked(prisma.nationality.update).mockRejectedValue(makePrismaError('P2002'));
			const token = await makeToken();
			const res = await app.inject({
				method: 'PUT',
				url: `${baseUrl}/1`,
				headers: authHeader(token),
				payload: { code: 'SA', label: 'Saudi', version: 1 },
			});
			expect(res.statusCode).toBe(409);
			expect(res.json().code).toBe('DUPLICATE_CODE');
		});
	});

	describe('DELETE /:id', () => {
		it('deletes — 204', async () => {
			vi.mocked(prisma.nationality.findUnique).mockResolvedValue(mockNationality);
			vi.mocked(prisma.nationality.delete).mockResolvedValue(mockNationality);
			const token = await makeToken();
			const res = await app.inject({
				method: 'DELETE',
				url: `${baseUrl}/1`,
				headers: authHeader(token),
			});
			expect(res.statusCode).toBe(204);
		});

		it('returns 404 if not found', async () => {
			vi.mocked(prisma.nationality.findUnique).mockResolvedValue(null);
			const token = await makeToken();
			const res = await app.inject({
				method: 'DELETE',
				url: `${baseUrl}/999`,
				headers: authHeader(token),
			});
			expect(res.statusCode).toBe(404);
		});

		it('returns 409 on referenced record', async () => {
			vi.mocked(prisma.nationality.findUnique).mockResolvedValue(mockNationality);
			vi.mocked(prisma.nationality.delete).mockRejectedValue(makePrismaError('P2003'));
			const token = await makeToken();
			const res = await app.inject({
				method: 'DELETE',
				url: `${baseUrl}/1`,
				headers: authHeader(token),
			});
			expect(res.statusCode).toBe(409);
			expect(res.json().code).toBe('REFERENCED_RECORD');
		});
	});
});

// ── Tariffs ─────────────────────────────────────────────────────────────────

describe('Tariffs', () => {
	const baseUrl = '/api/v1/master-data/tariffs';

	const mockTariff = {
		id: 1,
		code: 'T1',
		label: 'Standard',
		description: null,
		version: 1,
		createdAt: new Date(),
		updatedAt: new Date(),
		createdBy: 1,
		updatedBy: 1,
	};

	describe('GET /', () => {
		it('returns tariffs list', async () => {
			vi.mocked(prisma.tariff.findMany).mockResolvedValue([mockTariff]);
			const token = await makeToken();
			const res = await app.inject({
				method: 'GET',
				url: baseUrl,
				headers: authHeader(token),
			});
			expect(res.statusCode).toBe(200);
			expect(res.json().tariffs).toHaveLength(1);
		});
	});

	describe('POST /', () => {
		it('creates tariff — 201', async () => {
			vi.mocked(prisma.tariff.create).mockResolvedValue(mockTariff);
			const token = await makeToken();
			const res = await app.inject({
				method: 'POST',
				url: baseUrl,
				headers: authHeader(token),
				payload: { code: 'T1', label: 'Standard' },
			});
			expect(res.statusCode).toBe(201);
		});

		it('returns 409 on duplicate code', async () => {
			vi.mocked(prisma.tariff.create).mockRejectedValue(makePrismaError('P2002'));
			const token = await makeToken();
			const res = await app.inject({
				method: 'POST',
				url: baseUrl,
				headers: authHeader(token),
				payload: { code: 'T1', label: 'Standard' },
			});
			expect(res.statusCode).toBe(409);
			expect(res.json().code).toBe('DUPLICATE_CODE');
		});

		it('returns 403 for Viewer role', async () => {
			const token = await makeToken({ role: 'Viewer' });
			const res = await app.inject({
				method: 'POST',
				url: baseUrl,
				headers: authHeader(token),
				payload: { code: 'T1', label: 'Standard' },
			});
			expect(res.statusCode).toBe(403);
		});
	});

	describe('PUT /:id', () => {
		it('updates with optimistic lock', async () => {
			vi.mocked(prisma.tariff.findUnique).mockResolvedValue(mockTariff);
			vi.mocked(prisma.tariff.update).mockResolvedValue({
				...mockTariff,
				label: 'Premium',
				version: 2,
			});
			const token = await makeToken();
			const res = await app.inject({
				method: 'PUT',
				url: `${baseUrl}/1`,
				headers: authHeader(token),
				payload: { code: 'T1', label: 'Premium', version: 1 },
			});
			expect(res.statusCode).toBe(200);
		});

		it('returns 409 on version mismatch', async () => {
			vi.mocked(prisma.tariff.findUnique).mockResolvedValue(mockTariff);
			const token = await makeToken();
			const res = await app.inject({
				method: 'PUT',
				url: `${baseUrl}/1`,
				headers: authHeader(token),
				payload: { code: 'T1', label: 'Premium', version: 99 },
			});
			expect(res.statusCode).toBe(409);
			expect(res.json().code).toBe('OPTIMISTIC_LOCK');
		});

		it('returns 404 if not found', async () => {
			vi.mocked(prisma.tariff.findUnique).mockResolvedValue(null);
			const token = await makeToken();
			const res = await app.inject({
				method: 'PUT',
				url: `${baseUrl}/999`,
				headers: authHeader(token),
				payload: { code: 'T1', label: 'Premium', version: 1 },
			});
			expect(res.statusCode).toBe(404);
			expect(res.json().code).toBe('NOT_FOUND');
		});

		it('returns 409 on duplicate code', async () => {
			vi.mocked(prisma.tariff.findUnique).mockResolvedValue(mockTariff);
			vi.mocked(prisma.tariff.update).mockRejectedValue(makePrismaError('P2002'));
			const token = await makeToken();
			const res = await app.inject({
				method: 'PUT',
				url: `${baseUrl}/1`,
				headers: authHeader(token),
				payload: { code: 'T2', label: 'Premium', version: 1 },
			});
			expect(res.statusCode).toBe(409);
			expect(res.json().code).toBe('DUPLICATE_CODE');
		});
	});

	describe('DELETE /:id', () => {
		it('deletes — 204', async () => {
			vi.mocked(prisma.tariff.findUnique).mockResolvedValue(mockTariff);
			vi.mocked(prisma.tariff.delete).mockResolvedValue(mockTariff);
			const token = await makeToken();
			const res = await app.inject({
				method: 'DELETE',
				url: `${baseUrl}/1`,
				headers: authHeader(token),
			});
			expect(res.statusCode).toBe(204);
		});

		it('returns 404 if not found', async () => {
			vi.mocked(prisma.tariff.findUnique).mockResolvedValue(null);
			const token = await makeToken();
			const res = await app.inject({
				method: 'DELETE',
				url: `${baseUrl}/999`,
				headers: authHeader(token),
			});
			expect(res.statusCode).toBe(404);
			expect(res.json().code).toBe('NOT_FOUND');
		});

		it('returns 409 on referenced record', async () => {
			vi.mocked(prisma.tariff.findUnique).mockResolvedValue(mockTariff);
			vi.mocked(prisma.tariff.delete).mockRejectedValue(makePrismaError('P2003'));
			const token = await makeToken();
			const res = await app.inject({
				method: 'DELETE',
				url: `${baseUrl}/1`,
				headers: authHeader(token),
			});
			expect(res.statusCode).toBe(409);
			expect(res.json().code).toBe('REFERENCED_RECORD');
		});
	});
});

// ── Departments ─────────────────────────────────────────────────────────────

describe('Departments', () => {
	const baseUrl = '/api/v1/master-data/departments';

	const mockDepartment = {
		id: 1,
		code: 'ADMIN',
		label: 'Administration',
		bandMapping: 'NON_ACADEMIC' as const,
		version: 1,
		createdAt: new Date(),
		updatedAt: new Date(),
		createdBy: 1,
		updatedBy: 1,
	};

	describe('GET /', () => {
		it('returns departments list', async () => {
			vi.mocked(prisma.department.findMany).mockResolvedValue([mockDepartment]);
			const token = await makeToken();
			const res = await app.inject({
				method: 'GET',
				url: baseUrl,
				headers: authHeader(token),
			});
			expect(res.statusCode).toBe(200);
			expect(res.json().departments).toHaveLength(1);
		});
	});

	describe('POST /', () => {
		it('creates department — 201', async () => {
			vi.mocked(prisma.department.create).mockResolvedValue(mockDepartment);
			const token = await makeToken();
			const res = await app.inject({
				method: 'POST',
				url: baseUrl,
				headers: authHeader(token),
				payload: {
					code: 'ADMIN',
					label: 'Administration',
					bandMapping: 'NON_ACADEMIC',
				},
			});
			expect(res.statusCode).toBe(201);
		});

		it('returns 409 on duplicate code', async () => {
			vi.mocked(prisma.department.create).mockRejectedValue(makePrismaError('P2002'));
			const token = await makeToken();
			const res = await app.inject({
				method: 'POST',
				url: baseUrl,
				headers: authHeader(token),
				payload: {
					code: 'ADMIN',
					label: 'Administration',
					bandMapping: 'NON_ACADEMIC',
				},
			});
			expect(res.statusCode).toBe(409);
			expect(res.json().code).toBe('DUPLICATE_CODE');
		});

		it('returns 403 for Viewer role', async () => {
			const token = await makeToken({ role: 'Viewer' });
			const res = await app.inject({
				method: 'POST',
				url: baseUrl,
				headers: authHeader(token),
				payload: {
					code: 'ADMIN',
					label: 'Administration',
					bandMapping: 'NON_ACADEMIC',
				},
			});
			expect(res.statusCode).toBe(403);
		});
	});

	describe('PUT /:id', () => {
		it('updates with optimistic lock', async () => {
			vi.mocked(prisma.department.findUnique).mockResolvedValue(mockDepartment);
			vi.mocked(prisma.department.update).mockResolvedValue({
				...mockDepartment,
				label: 'Updated',
				version: 2,
			});
			const token = await makeToken();
			const res = await app.inject({
				method: 'PUT',
				url: `${baseUrl}/1`,
				headers: authHeader(token),
				payload: {
					code: 'ADMIN',
					label: 'Updated',
					bandMapping: 'NON_ACADEMIC',
					version: 1,
				},
			});
			expect(res.statusCode).toBe(200);
		});

		it('returns 409 on version mismatch', async () => {
			vi.mocked(prisma.department.findUnique).mockResolvedValue(mockDepartment);
			const token = await makeToken();
			const res = await app.inject({
				method: 'PUT',
				url: `${baseUrl}/1`,
				headers: authHeader(token),
				payload: {
					code: 'ADMIN',
					label: 'Updated',
					bandMapping: 'NON_ACADEMIC',
					version: 99,
				},
			});
			expect(res.statusCode).toBe(409);
			expect(res.json().code).toBe('OPTIMISTIC_LOCK');
		});

		it('returns 404 if not found', async () => {
			vi.mocked(prisma.department.findUnique).mockResolvedValue(null);
			const token = await makeToken();
			const res = await app.inject({
				method: 'PUT',
				url: `${baseUrl}/999`,
				headers: authHeader(token),
				payload: {
					code: 'ADMIN',
					label: 'Updated',
					bandMapping: 'NON_ACADEMIC',
					version: 1,
				},
			});
			expect(res.statusCode).toBe(404);
			expect(res.json().code).toBe('NOT_FOUND');
		});

		it('returns 409 on duplicate code', async () => {
			vi.mocked(prisma.department.findUnique).mockResolvedValue(mockDepartment);
			vi.mocked(prisma.department.update).mockRejectedValue(makePrismaError('P2002'));
			const token = await makeToken();
			const res = await app.inject({
				method: 'PUT',
				url: `${baseUrl}/1`,
				headers: authHeader(token),
				payload: {
					code: 'TEACHING',
					label: 'Teaching',
					bandMapping: 'NON_ACADEMIC',
					version: 1,
				},
			});
			expect(res.statusCode).toBe(409);
			expect(res.json().code).toBe('DUPLICATE_CODE');
		});
	});

	describe('DELETE /:id', () => {
		it('deletes — 204', async () => {
			vi.mocked(prisma.department.findUnique).mockResolvedValue(mockDepartment);
			vi.mocked(prisma.department.delete).mockResolvedValue(mockDepartment);
			const token = await makeToken();
			const res = await app.inject({
				method: 'DELETE',
				url: `${baseUrl}/1`,
				headers: authHeader(token),
			});
			expect(res.statusCode).toBe(204);
		});

		it('returns 404 if not found', async () => {
			vi.mocked(prisma.department.findUnique).mockResolvedValue(null);
			const token = await makeToken();
			const res = await app.inject({
				method: 'DELETE',
				url: `${baseUrl}/999`,
				headers: authHeader(token),
			});
			expect(res.statusCode).toBe(404);
			expect(res.json().code).toBe('NOT_FOUND');
		});

		it('returns 409 on referenced record', async () => {
			vi.mocked(prisma.department.findUnique).mockResolvedValue(mockDepartment);
			vi.mocked(prisma.department.delete).mockRejectedValue(makePrismaError('P2003'));
			const token = await makeToken();
			const res = await app.inject({
				method: 'DELETE',
				url: `${baseUrl}/1`,
				headers: authHeader(token),
			});
			expect(res.statusCode).toBe(409);
			expect(res.json().code).toBe('REFERENCED_RECORD');
		});
	});
});
