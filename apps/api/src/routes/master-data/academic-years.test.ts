import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import {
	serializerCompiler,
	validatorCompiler,
} from 'fastify-type-provider-zod';
import { generateKeyPair } from 'jose';
import { Prisma } from '@prisma/client';
import { setKeys, signAccessToken } from '../../services/token.js';
import { auth } from '../../plugins/auth.js';
import { academicYearRoutes } from './academic-years.js';

vi.mock('../../lib/prisma.js', () => ({
	prisma: {
		academicYear: {
			findMany: vi.fn(),
			findUnique: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
			delete: vi.fn(),
		},
		auditEntry: {
			create: vi.fn().mockResolvedValue({ id: 1 }),
		},
		$transaction: vi.fn().mockImplementation((fn: (tx: Record<string, unknown>) => unknown) => fn({ academicYear: prisma.academicYear, auditEntry: prisma.auditEntry })),
	},
}));

import { prisma } from '../../lib/prisma.js';

let app: FastifyInstance;

async function makeToken(
	overrides: { sub?: number; role?: string } = {},
) {
	return signAccessToken({
		sub: overrides.sub ?? 1,
		email: 'admin@budfin.app',
		role: overrides.role ?? 'Admin',
	});
}

function authHeader(token: string) {
	return { authorization: `Bearer ${token}` };
}

const validDates = {
	ay1Start: '2026-09-01',
	ay1End: '2026-12-20',
	summerStart: '2026-12-20',
	summerEnd: '2027-01-05',
	ay2Start: '2027-01-05',
	ay2End: '2027-06-30',
};

const mockAcademicYear = {
	id: 1,
	fiscalYear: '202627',
	ay1Start: new Date('2026-09-01'),
	ay1End: new Date('2026-12-20'),
	ay2Start: new Date('2027-01-05'),
	ay2End: new Date('2027-06-30'),
	summerStart: new Date('2026-12-20'),
	summerEnd: new Date('2027-01-05'),
	academicWeeks: 36,
	version: 1,
	createdAt: new Date('2026-03-01T10:00:00Z'),
	updatedAt: new Date('2026-03-01T10:00:00Z'),
	createdBy: 1,
	updatedBy: 1,
};

beforeAll(async () => {
	const keys = await generateKeyPair('RS256');
	setKeys(keys.privateKey, keys.publicKey);

	app = Fastify({ logger: false });
	app.setValidatorCompiler(validatorCompiler);
	app.setSerializerCompiler(serializerCompiler);
	await app.register(auth);
	await app.register(academicYearRoutes, {
		prefix: '/api/v1/master-data/academic-years',
	});
	await app.ready();
});

beforeEach(() => {
	vi.clearAllMocks();
});

describe('GET /api/v1/master-data/academic-years', () => {
	it('returns all academic years ordered by fiscalYear desc', async () => {
		vi.mocked(prisma.academicYear.findMany).mockResolvedValue([
			mockAcademicYear,
		]);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/master-data/academic-years',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.academicYears).toHaveLength(1);
		expect(body.academicYears[0].fiscalYear).toBe('202627');
		expect(vi.mocked(prisma.academicYear.findMany)).toHaveBeenCalledWith({
			orderBy: { fiscalYear: 'desc' },
		});
	});

	it('allows Viewer role (any authenticated user)', async () => {
		vi.mocked(prisma.academicYear.findMany).mockResolvedValue([]);

		const token = await makeToken({ role: 'Viewer' });
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/master-data/academic-years',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
	});
});

describe('GET /api/v1/master-data/academic-years/:id', () => {
	it('returns a single academic year', async () => {
		vi.mocked(prisma.academicYear.findUnique).mockResolvedValue(
			mockAcademicYear,
		);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/master-data/academic-years/1',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		expect(res.json().fiscalYear).toBe('202627');
	});

	it('returns 404 if not found', async () => {
		vi.mocked(prisma.academicYear.findUnique).mockResolvedValue(null);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/master-data/academic-years/999',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('NOT_FOUND');
	});
});

describe('POST /api/v1/master-data/academic-years', () => {
	it('creates an academic year with valid dates (201)', async () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		vi.mocked(prisma.$transaction as any).mockImplementation(
			async (fn: (tx: unknown) => Promise<unknown>) => {
				return fn({
					academicYear: {
						create: vi.fn().mockResolvedValue(mockAcademicYear),
					},
					auditEntry: {
						create: vi.fn().mockResolvedValue({ id: 1 }),
					},
				});
			},
		);

		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/master-data/academic-years',
			headers: { ...authHeader(token), 'content-type': 'application/json' },
			payload: {
				fiscalYear: '202627',
				...validDates,
				academicWeeks: 36,
			},
		});

		expect(res.statusCode).toBe(201);
		expect(res.json().fiscalYear).toBe('202627');
	});

	it('rejects invalid date ordering (422)', async () => {
		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/master-data/academic-years',
			headers: { ...authHeader(token), 'content-type': 'application/json' },
			payload: {
				fiscalYear: '202627',
				ay1Start: '2026-09-01',
				ay1End: '2026-08-01', // before ay1Start — invalid
				summerStart: '2026-12-20',
				summerEnd: '2027-01-05',
				ay2Start: '2027-01-05',
				ay2End: '2027-06-30',
				academicWeeks: 36,
			},
		});

		expect(res.statusCode).toBe(422);
		expect(res.json().code).toBe('INVALID_DATE_ORDER');
	});

	it('returns 409 for duplicate fiscal year', async () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		vi.mocked(prisma.$transaction as any).mockImplementation(
			async (fn: (tx: unknown) => Promise<unknown>) => {
				return fn({
					academicYear: {
						create: vi.fn().mockRejectedValue(
							new Prisma.PrismaClientKnownRequestError(
								'Unique constraint failed',
								{ code: 'P2002', clientVersion: '6.0.0' },
							),
						),
					},
					auditEntry: {
						create: vi.fn().mockResolvedValue({ id: 1 }),
					},
				});
			},
		);

		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/master-data/academic-years',
			headers: { ...authHeader(token), 'content-type': 'application/json' },
			payload: {
				fiscalYear: '202627',
				...validDates,
				academicWeeks: 36,
			},
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('DUPLICATE_CODE');
	});

	it('returns 403 for Viewer role', async () => {
		const token = await makeToken({ role: 'Viewer' });
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/master-data/academic-years',
			headers: { ...authHeader(token), 'content-type': 'application/json' },
			payload: {
				fiscalYear: '202627',
				...validDates,
				academicWeeks: 36,
			},
		});

		expect(res.statusCode).toBe(403);
	});
});

describe('PUT /api/v1/master-data/academic-years/:id', () => {
	it('updates with matching version', async () => {
		vi.mocked(prisma.academicYear.findUnique).mockResolvedValue(
			mockAcademicYear,
		);
		const updatedYear = { ...mockAcademicYear, version: 2, academicWeeks: 38 };
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		vi.mocked(prisma.$transaction as any).mockImplementation(
			async (fn: (tx: unknown) => Promise<unknown>) => {
				return fn({
					academicYear: {
						update: vi.fn().mockResolvedValue(updatedYear),
					},
					auditEntry: {
						create: vi.fn().mockResolvedValue({ id: 2 }),
					},
				});
			},
		);

		const token = await makeToken();
		const res = await app.inject({
			method: 'PUT',
			url: '/api/v1/master-data/academic-years/1',
			headers: { ...authHeader(token), 'content-type': 'application/json' },
			payload: {
				fiscalYear: '202627',
				...validDates,
				academicWeeks: 38,
				version: 1,
			},
		});

		expect(res.statusCode).toBe(200);
		expect(res.json().academicWeeks).toBe(38);
	});

	it('returns 409 for version mismatch (optimistic lock)', async () => {
		vi.mocked(prisma.academicYear.findUnique).mockResolvedValue(
			{ ...mockAcademicYear, version: 3 },
		);

		const token = await makeToken();
		const res = await app.inject({
			method: 'PUT',
			url: '/api/v1/master-data/academic-years/1',
			headers: { ...authHeader(token), 'content-type': 'application/json' },
			payload: {
				fiscalYear: '202627',
				...validDates,
				academicWeeks: 36,
				version: 1,
			},
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('OPTIMISTIC_LOCK');
	});

	it('returns 404 if not found', async () => {
		vi.mocked(prisma.academicYear.findUnique).mockResolvedValue(null);

		const token = await makeToken();
		const res = await app.inject({
			method: 'PUT',
			url: '/api/v1/master-data/academic-years/999',
			headers: { ...authHeader(token), 'content-type': 'application/json' },
			payload: {
				fiscalYear: '202627',
				...validDates,
				academicWeeks: 36,
				version: 1,
			},
		});

		expect(res.statusCode).toBe(404);
	});
});

describe('DELETE /api/v1/master-data/academic-years/:id', () => {
	it('deletes and returns 204', async () => {
		vi.mocked(prisma.academicYear.findUnique).mockResolvedValue(
			mockAcademicYear,
		);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		vi.mocked(prisma.$transaction as any).mockImplementation(
			async (fn: (tx: unknown) => Promise<unknown>) => {
				return fn({
					academicYear: {
						delete: vi.fn().mockResolvedValue(mockAcademicYear),
					},
					auditEntry: {
						create: vi.fn().mockResolvedValue({ id: 3 }),
					},
				});
			},
		);

		const token = await makeToken();
		const res = await app.inject({
			method: 'DELETE',
			url: '/api/v1/master-data/academic-years/1',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(204);
	});

	it('returns 404 if not found', async () => {
		vi.mocked(prisma.academicYear.findUnique).mockResolvedValue(null);

		const token = await makeToken();
		const res = await app.inject({
			method: 'DELETE',
			url: '/api/v1/master-data/academic-years/999',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(404);
	});

	it('returns 403 for Viewer role', async () => {
		const token = await makeToken({ role: 'Viewer' });
		const res = await app.inject({
			method: 'DELETE',
			url: '/api/v1/master-data/academic-years/1',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(403);
	});
});
