/**
 * Story #84 — Historical enrollment API
 *
 * AC-16: GET /historical returns data with CAGR and moving averages
 * AC-17: POST /historical/import with mode=validate returns preview
 * AC-18: POST /historical/import with mode=commit persists data
 * AC-19: Duplicate year → 409 DUPLICATE_YEAR
 * AC-20: Invalid grades are flagged in validation errors
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { generateKeyPair } from 'jose';
import { setKeys, signAccessToken } from '../../services/token.js';
import { auth } from '../../plugins/auth.js';
import { historicalRoutes } from './historical.js';

vi.mock('../../lib/prisma.js', () => {
	const mockPrisma = {
		budgetVersion: {
			findMany: vi.fn(),
			findFirst: vi.fn(),
			create: vi.fn(),
		},
		enrollmentHeadcount: {
			findMany: vi.fn(),
			count: vi.fn(),
			create: vi.fn().mockResolvedValue({}),
		},
		auditEntry: {
			create: vi.fn().mockResolvedValue({ id: 1 }),
		},
		$transaction: vi.fn().mockImplementation((fn: (tx: Record<string, unknown>) => unknown) =>
			fn({
				budgetVersion: mockPrisma.budgetVersion,
				enrollmentHeadcount: mockPrisma.enrollmentHeadcount,
				auditEntry: mockPrisma.auditEntry,
			})
		),
	};
	return { prisma: mockPrisma };
});

import { prisma } from '../../lib/prisma.js';

const mockPrisma = prisma as unknown as {
	budgetVersion: {
		findMany: ReturnType<typeof vi.fn>;
		findFirst: ReturnType<typeof vi.fn>;
		create: ReturnType<typeof vi.fn>;
	};
	enrollmentHeadcount: {
		findMany: ReturnType<typeof vi.fn>;
		count: ReturnType<typeof vi.fn>;
		create: ReturnType<typeof vi.fn>;
	};
	auditEntry: { create: ReturnType<typeof vi.fn> };
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

const URL_PREFIX = '/api/v1/enrollment';

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
	await app.register(historicalRoutes, { prefix: URL_PREFIX });
	await app.ready();
});

// ── GET /historical ──────────────────────────────────────────────────────────

describe('GET /historical', () => {
	it('AC-16: returns historical data with CAGR and moving averages', async () => {
		mockPrisma.budgetVersion.findMany.mockResolvedValue([
			{ id: 2, fiscalYear: 2025 },
			{ id: 1, fiscalYear: 2024 },
		]);
		mockPrisma.enrollmentHeadcount.findMany.mockResolvedValue([
			{ versionId: 1, gradeLevel: 'CP', academicPeriod: 'AY1', headcount: 20 },
			{ versionId: 2, gradeLevel: 'CP', academicPeriod: 'AY1', headcount: 25 },
		]);

		const token = await makeToken({ role: 'Viewer' });
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/historical`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();

		expect(body.data).toHaveLength(2);
		expect(body.data[0].academicYear).toBe(2024);
		expect(body.data[1].academicYear).toBe(2025);
		expect(body.cagrByBand).toBeDefined();
		expect(body.cagrByBand.ELEMENTAIRE).toBeDefined();
		expect(body.movingAvgByBand).toBeDefined();
	});

	it('AC-16: returns empty when no Actual versions', async () => {
		mockPrisma.budgetVersion.findMany.mockResolvedValue([]);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/historical`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.data).toEqual([]);
		expect(body.cagrByBand).toEqual({});
	});

	it('respects years query parameter', async () => {
		mockPrisma.budgetVersion.findMany.mockResolvedValue([]);

		const token = await makeToken();
		await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/historical?years=3`,
			headers: authHeader(token),
		});

		expect(mockPrisma.budgetVersion.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				take: 3,
			})
		);
	});

	it('returns 401 without auth', async () => {
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/historical`,
		});

		expect(res.statusCode).toBe(401);
	});
});

// ── POST /historical/import ──────────────────────────────────────────────────

describe('POST /historical/import', () => {
	function buildMultipart(
		csvContent: string,
		fields: Record<string, string> = {}
	): { body: Buffer; contentType: string } {
		const boundary = '----TestBoundary123456';
		let body = '';

		// Add fields
		for (const [name, value] of Object.entries(fields)) {
			body += `--${boundary}\r\n`;
			body += `Content-Disposition: form-data; name="${name}"\r\n\r\n`;
			body += `${value}\r\n`;
		}

		// Add file
		body += `--${boundary}\r\n`;
		body += 'Content-Disposition: form-data; name="file"; filename="enrollment.csv"\r\n';
		body += 'Content-Type: text/csv\r\n\r\n';
		body += `${csvContent}\r\n`;
		body += `--${boundary}--\r\n`;

		return {
			body: Buffer.from(body),
			contentType: `multipart/form-data; boundary=${boundary}`,
		};
	}

	it('AC-17: validate mode returns preview without persisting', async () => {
		const csv = 'grade_level,student_count\nCP,25\nCE1,30\n';
		const { body, contentType } = buildMultipart(csv, {
			mode: 'validate',
			academicYear: '2025',
		});

		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/historical/import`,
			headers: {
				...authHeader(token),
				'content-type': contentType,
			},
			payload: body,
		});

		expect(res.statusCode).toBe(200);
		const result = res.json();
		expect(result.totalRows).toBe(2);
		expect(result.validRows).toBe(2);
		expect(result.errors).toHaveLength(0);
		expect(result.preview).toHaveLength(2);

		// Should NOT persist anything
		expect(mockPrisma.enrollmentHeadcount.create).not.toHaveBeenCalled();
	});

	it('AC-20: flags invalid grades in validation errors', async () => {
		const csv = 'grade_level,student_count\nCP,25\nINVALID,10\n';
		const { body, contentType } = buildMultipart(csv, {
			mode: 'validate',
			academicYear: '2025',
		});

		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/historical/import`,
			headers: {
				...authHeader(token),
				'content-type': contentType,
			},
			payload: body,
		});

		expect(res.statusCode).toBe(200);
		const result = res.json();
		expect(result.validRows).toBe(1);
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0].field).toBe('grade_level');
		expect(result.errors[0].message).toContain('INVALID');
	});

	it('AC-18: commit mode persists data', async () => {
		const csv = 'grade_level,student_count\nCP,25\n';
		const { body, contentType } = buildMultipart(csv, {
			mode: 'commit',
			academicYear: '2025',
		});

		mockPrisma.budgetVersion.findFirst.mockResolvedValue(null);
		mockPrisma.budgetVersion.create.mockResolvedValue({
			id: 99,
			name: 'Actual 2025',
			type: 'Actual',
			fiscalYear: 2025,
		});

		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/historical/import`,
			headers: {
				...authHeader(token),
				'content-type': contentType,
			},
			payload: body,
		});

		expect(res.statusCode).toBe(201);
		const result = res.json();
		expect(result.versionId).toBe(99);
		expect(result.rowsImported).toBe(1);

		// Verify persistence
		expect(mockPrisma.enrollmentHeadcount.create).toHaveBeenCalledTimes(1);
		expect(mockPrisma.auditEntry.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					operation: 'HISTORICAL_ENROLLMENT_IMPORTED',
				}),
			})
		);
	});

	it('AC-19: rejects duplicate year → 409', async () => {
		const csv = 'grade_level,student_count\nCP,25\n';
		const { body, contentType } = buildMultipart(csv, {
			mode: 'commit',
			academicYear: '2025',
		});

		mockPrisma.budgetVersion.findFirst.mockResolvedValue({
			id: 50,
			type: 'Actual',
			fiscalYear: 2025,
		});
		mockPrisma.enrollmentHeadcount.count.mockResolvedValue(5);

		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/historical/import`,
			headers: {
				...authHeader(token),
				'content-type': contentType,
			},
			payload: body,
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('DUPLICATE_YEAR');
	});

	it('rejects missing mode → 400', async () => {
		const csv = 'grade_level,student_count\nCP,25\n';
		const { body, contentType } = buildMultipart(csv, {
			academicYear: '2025',
		});

		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/historical/import`,
			headers: {
				...authHeader(token),
				'content-type': contentType,
			},
			payload: body,
		});

		expect(res.statusCode).toBe(400);
		expect(res.json().code).toBe('INVALID_MODE');
	});

	it('rejects invalid academicYear → 400', async () => {
		const csv = 'grade_level,student_count\nCP,25\n';
		const { body, contentType } = buildMultipart(csv, {
			mode: 'validate',
			academicYear: 'abc',
		});

		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/historical/import`,
			headers: {
				...authHeader(token),
				'content-type': contentType,
			},
			payload: body,
		});

		expect(res.statusCode).toBe(400);
		expect(res.json().code).toBe('INVALID_ACADEMIC_YEAR');
	});

	it('Viewer cannot import → 403', async () => {
		const csv = 'grade_level,student_count\nCP,25\n';
		const { body, contentType } = buildMultipart(csv, {
			mode: 'validate',
			academicYear: '2025',
		});

		const token = await makeToken({ role: 'Viewer' });
		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/historical/import`,
			headers: {
				...authHeader(token),
				'content-type': contentType,
			},
			payload: body,
		});

		expect(res.statusCode).toBe(403);
		expect(res.json().error).toBe('FORBIDDEN');
	});

	it('returns 401 without auth', async () => {
		const csv = 'grade_level,student_count\nCP,25\n';
		const { body, contentType } = buildMultipart(csv, {
			mode: 'validate',
			academicYear: '2025',
		});

		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/historical/import`,
			headers: { 'content-type': contentType },
			payload: body,
		});

		expect(res.statusCode).toBe(401);
	});
});
