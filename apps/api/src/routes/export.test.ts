import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { generateKeyPair } from 'jose';
import { setKeys, signAccessToken } from '../services/token.js';
import { auth } from '../plugins/auth.js';
import { exportRoutes } from './export.js';

// ── Mock Prisma ─────────────────────────────────────────────────────────────

vi.mock('../lib/prisma.js', () => {
	const mockPrisma = {
		budgetVersion: { findUnique: vi.fn() },
		exportJob: {
			create: vi.fn(),
			findUnique: vi.fn(),
		},
	};
	return { prisma: mockPrisma };
});

vi.mock('../services/export/export-worker.js', () => ({
	getExportBoss: vi.fn(() => ({
		send: vi.fn().mockResolvedValue(undefined),
	})),
}));

import { prisma } from '../lib/prisma.js';

const mockPrisma = prisma as unknown as {
	budgetVersion: { findUnique: ReturnType<typeof vi.fn> };
	exportJob: {
		create: ReturnType<typeof vi.fn>;
		findUnique: ReturnType<typeof vi.fn>;
	};
};

let app: FastifyInstance;

const URL_BASE = '/api/v1/export';

async function makeToken(role = 'Admin', userId = 1) {
	return signAccessToken({
		sub: userId,
		email: `user${userId}@budfin.app`,
		role,
		sessionId: 'test-session',
	});
}

function headers(token: string) {
	return { authorization: `Bearer ${token}` };
}

const NOW = new Date();

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
	await app.register(exportRoutes, { prefix: URL_BASE });
	await app.ready();
});

// ── POST /jobs — Create export job ──────────────────────────────────────

describe('POST /jobs', () => {
	it('creates a PNL PDF export job', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue({ id: 1 });
		mockPrisma.exportJob.create.mockResolvedValue({
			id: 42,
			status: 'PENDING',
			progress: 0,
			createdAt: NOW,
		});
		const token = await makeToken();

		const res = await app.inject({
			method: 'POST',
			url: `${URL_BASE}/jobs`,
			headers: headers(token),
			payload: {
				versionId: 1,
				reportType: 'PNL',
				format: 'PDF',
			},
		});

		expect(res.statusCode).toBe(201);
		const body = res.json();
		expect(body.id).toBe(42);
		expect(body.status).toBe('PENDING');
		expect(body.progress).toBe(0);
	});

	it('creates an EXCEL export job', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue({ id: 1 });
		mockPrisma.exportJob.create.mockResolvedValue({
			id: 43,
			status: 'PENDING',
			progress: 0,
			createdAt: NOW,
		});
		const token = await makeToken();

		const res = await app.inject({
			method: 'POST',
			url: `${URL_BASE}/jobs`,
			headers: headers(token),
			payload: {
				versionId: 1,
				reportType: 'REVENUE',
				format: 'EXCEL',
			},
		});

		expect(res.statusCode).toBe(201);
	});

	it('returns 404 when version not found', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(null);
		const token = await makeToken();

		const res = await app.inject({
			method: 'POST',
			url: `${URL_BASE}/jobs`,
			headers: headers(token),
			payload: {
				versionId: 999,
				reportType: 'PNL',
				format: 'PDF',
			},
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('VERSION_NOT_FOUND');
	});

	it('returns 403 for Viewer requesting STAFFING (salary:view required)', async () => {
		const token = await makeToken('Viewer');

		const res = await app.inject({
			method: 'POST',
			url: `${URL_BASE}/jobs`,
			headers: headers(token),
			payload: {
				versionId: 1,
				reportType: 'STAFFING',
				format: 'PDF',
			},
		});

		expect(res.statusCode).toBe(403);
		expect(res.json().code).toBe('FORBIDDEN');
	});

	it('allows Editor to request STAFFING (has salary:view)', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue({ id: 1 });
		mockPrisma.exportJob.create.mockResolvedValue({
			id: 44,
			status: 'PENDING',
			progress: 0,
			createdAt: NOW,
		});
		const token = await makeToken('Editor');

		const res = await app.inject({
			method: 'POST',
			url: `${URL_BASE}/jobs`,
			headers: headers(token),
			payload: {
				versionId: 1,
				reportType: 'STAFFING',
				format: 'PDF',
			},
		});

		expect(res.statusCode).toBe(201);
	});

	it('validates comparison version exists', async () => {
		// First call for main version succeeds, second for comparison fails
		mockPrisma.budgetVersion.findUnique
			.mockResolvedValueOnce({ id: 1 })
			.mockResolvedValueOnce(null);
		const token = await makeToken();

		const res = await app.inject({
			method: 'POST',
			url: `${URL_BASE}/jobs`,
			headers: headers(token),
			payload: {
				versionId: 1,
				reportType: 'PNL',
				format: 'PDF',
				comparisonVersionId: 999,
			},
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('COMPARISON_VERSION_NOT_FOUND');
	});

	it('returns 401 without auth', async () => {
		const res = await app.inject({
			method: 'POST',
			url: `${URL_BASE}/jobs`,
			payload: {
				versionId: 1,
				reportType: 'PNL',
				format: 'PDF',
			},
		});

		expect(res.statusCode).toBe(401);
	});
});

// ── GET /jobs/:id — Poll job status ─────────────────────────────────────

describe('GET /jobs/:id', () => {
	it('returns job status for PENDING job', async () => {
		mockPrisma.exportJob.findUnique.mockResolvedValue({
			id: 42,
			status: 'PENDING',
			progress: 0,
			createdAt: NOW,
			createdById: 1,
			format: 'PDF',
		});
		const token = await makeToken('Admin', 1);

		const res = await app.inject({
			method: 'GET',
			url: `${URL_BASE}/jobs/42`,
			headers: headers(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.status).toBe('PENDING');
		expect(body.progress).toBe(0);
	});

	it('returns download URL for DONE job', async () => {
		mockPrisma.exportJob.findUnique.mockResolvedValue({
			id: 42,
			status: 'DONE',
			progress: 100,
			createdAt: NOW,
			completedAt: NOW,
			createdById: 1,
			format: 'PDF',
		});
		const token = await makeToken('Admin', 1);

		const res = await app.inject({
			method: 'GET',
			url: `${URL_BASE}/jobs/42`,
			headers: headers(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.status).toBe('DONE');
		expect(body.downloadUrl).toBe('/api/v1/export/jobs/42/download');
	});

	it('returns error message for FAILED job', async () => {
		mockPrisma.exportJob.findUnique.mockResolvedValue({
			id: 42,
			status: 'FAILED',
			progress: 50,
			createdAt: NOW,
			errorMessage: 'Database connection timeout',
			createdById: 1,
			format: 'PDF',
		});
		const token = await makeToken('Admin', 1);

		const res = await app.inject({
			method: 'GET',
			url: `${URL_BASE}/jobs/42`,
			headers: headers(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.status).toBe('FAILED');
		expect(body.errorMessage).toBe('Database connection timeout');
	});

	it('returns 404 when job not found', async () => {
		mockPrisma.exportJob.findUnique.mockResolvedValue(null);
		const token = await makeToken();

		const res = await app.inject({
			method: 'GET',
			url: `${URL_BASE}/jobs/999`,
			headers: headers(token),
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('EXPORT_JOB_NOT_FOUND');
	});

	it('returns 403 when accessing another user job', async () => {
		mockPrisma.exportJob.findUnique.mockResolvedValue({
			id: 42,
			status: 'PENDING',
			progress: 0,
			createdAt: NOW,
			createdById: 999, // different user
			format: 'PDF',
		});
		const token = await makeToken('Admin', 1);

		const res = await app.inject({
			method: 'GET',
			url: `${URL_BASE}/jobs/42`,
			headers: headers(token),
		});

		expect(res.statusCode).toBe(403);
		expect(res.json().code).toBe('FORBIDDEN');
	});
});

// ── GET /jobs/:id/download — Download file ──────────────────────────────

describe('GET /jobs/:id/download', () => {
	it('returns 404 when job not found', async () => {
		mockPrisma.exportJob.findUnique.mockResolvedValue(null);
		const token = await makeToken();

		const res = await app.inject({
			method: 'GET',
			url: `${URL_BASE}/jobs/999/download`,
			headers: headers(token),
		});

		expect(res.statusCode).toBe(404);
	});

	it('returns 403 when another user tries to download', async () => {
		mockPrisma.exportJob.findUnique.mockResolvedValue({
			id: 42,
			status: 'DONE',
			filePath: '/tmp/test.pdf',
			createdById: 999,
			format: 'PDF',
		});
		const token = await makeToken('Admin', 1);

		const res = await app.inject({
			method: 'GET',
			url: `${URL_BASE}/jobs/42/download`,
			headers: headers(token),
		});

		expect(res.statusCode).toBe(403);
	});

	it('returns 409 when job not done', async () => {
		mockPrisma.exportJob.findUnique.mockResolvedValue({
			id: 42,
			status: 'PROCESSING',
			filePath: null,
			createdById: 1,
			format: 'PDF',
		});
		const token = await makeToken('Admin', 1);

		const res = await app.inject({
			method: 'GET',
			url: `${URL_BASE}/jobs/42/download`,
			headers: headers(token),
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('EXPORT_NOT_READY');
	});

	it('returns 410 when file has been cleaned up', async () => {
		mockPrisma.exportJob.findUnique.mockResolvedValue({
			id: 42,
			status: 'DONE',
			filePath: '/tmp/nonexistent-file-that-was-cleaned-up.pdf',
			createdById: 1,
			format: 'PDF',
		});
		const token = await makeToken('Admin', 1);

		const res = await app.inject({
			method: 'GET',
			url: `${URL_BASE}/jobs/42/download`,
			headers: headers(token),
		});

		expect(res.statusCode).toBe(410);
		expect(res.json().code).toBe('EXPORT_FILE_GONE');
	});

	it('streams file when job is done and file exists', async () => {
		const { writeFileSync, unlinkSync } = await import('node:fs');
		const { join } = await import('node:path');
		const { tmpdir } = await import('node:os');

		const tmpFile = join(tmpdir(), 'test-export.pdf');
		writeFileSync(tmpFile, 'fake-pdf-content', 'utf-8');

		try {
			mockPrisma.exportJob.findUnique.mockResolvedValue({
				id: 42,
				status: 'DONE',
				filePath: tmpFile,
				createdById: 1,
				format: 'PDF',
				reportType: 'PNL',
			});
			const token = await makeToken('Admin', 1);

			const res = await app.inject({
				method: 'GET',
				url: `${URL_BASE}/jobs/42/download`,
				headers: headers(token),
			});

			expect(res.statusCode).toBe(200);
			expect(res.headers['content-type']).toBe('application/pdf');
			expect(res.headers['content-disposition']).toContain('pnl-export-42.pdf');
		} finally {
			unlinkSync(tmpFile);
		}
	});

	it('streams Excel file with correct content type', async () => {
		const { writeFileSync, unlinkSync } = await import('node:fs');
		const { join } = await import('node:path');
		const { tmpdir } = await import('node:os');

		const tmpFile = join(tmpdir(), 'test-export.xlsx');
		writeFileSync(tmpFile, 'fake-xlsx-content', 'utf-8');

		try {
			mockPrisma.exportJob.findUnique.mockResolvedValue({
				id: 43,
				status: 'DONE',
				filePath: tmpFile,
				createdById: 1,
				format: 'EXCEL',
				reportType: 'REVENUE',
			});
			const token = await makeToken('Admin', 1);

			const res = await app.inject({
				method: 'GET',
				url: `${URL_BASE}/jobs/43/download`,
				headers: headers(token),
			});

			expect(res.statusCode).toBe(200);
			expect(res.headers['content-type']).toBe(
				'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
			);
			expect(res.headers['content-disposition']).toContain('revenue-export-43.xlsx');
		} finally {
			unlinkSync(tmpFile);
		}
	});
});
