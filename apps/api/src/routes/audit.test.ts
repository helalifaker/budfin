import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { generateKeyPair } from 'jose';
import { setKeys, signAccessToken } from '../services/token.js';
import { auth } from '../plugins/auth.js';
import { auditRoutes } from './audit.js';

vi.mock('../lib/prisma.js', () => ({
	prisma: {
		auditEntry: {
			findMany: vi.fn(),
			count: vi.fn(),
			create: vi.fn().mockResolvedValue({ id: 1 }),
		},
		calculationAuditLog: {
			findMany: vi.fn(),
			count: vi.fn(),
		},
	},
}));

import { prisma } from '../lib/prisma.js';

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

const mockEntry = {
	id: 1,
	userId: 2,
	operation: 'LOGIN_SUCCESS',
	tableName: 'users',
	recordId: null,
	oldValues: null,
	newValues: null,
	ipAddress: '127.0.0.1',
	userEmail: null,
	sessionId: null,
	auditNote: null,
	createdAt: new Date('2026-03-01T10:00:00Z'),
};

beforeAll(async () => {
	const keys = await generateKeyPair('RS256');
	setKeys(keys.privateKey, keys.publicKey);

	app = Fastify({ logger: false });
	app.setValidatorCompiler(validatorCompiler);
	app.setSerializerCompiler(serializerCompiler);
	await app.register(auth);
	await app.register(auditRoutes, { prefix: '/api/v1/audit' });
	await app.ready();
});

beforeEach(() => {
	vi.clearAllMocks();
});

describe('GET /api/v1/audit', () => {
	it('returns paginated entries for Admin', async () => {
		vi.mocked(prisma.auditEntry.findMany).mockResolvedValue([mockEntry]);
		vi.mocked(prisma.auditEntry.count).mockResolvedValue(1);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/audit',
			headers: authHeader(token),
		});
		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.entries).toHaveLength(1);
		expect(body.entries[0].operation).toBe('LOGIN_SUCCESS');
		expect(body.page).toBe(1);
		expect(body.page_size).toBe(50);
	});

	it('returns 403 for non-Admin', async () => {
		const token = await makeToken({ role: 'Viewer' });
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/audit',
			headers: authHeader(token),
		});
		expect(res.statusCode).toBe(403);
	});

	it('filters by date range (from/to)', async () => {
		vi.mocked(prisma.auditEntry.findMany).mockResolvedValue([]);
		vi.mocked(prisma.auditEntry.count).mockResolvedValue(0);

		const token = await makeToken();
		const from = '2026-03-01T00:00:00Z';
		const to = '2026-03-02T00:00:00Z';
		await app.inject({
			method: 'GET',
			url: `/api/v1/audit?from=${from}&to=${to}`,
			headers: authHeader(token),
		});

		const call = vi.mocked(prisma.auditEntry.findMany).mock.calls[0]![0];
		expect(call?.where?.createdAt).toMatchObject({
			gte: new Date(from),
			lte: new Date(to),
		});
	});

	it('filters by user_id', async () => {
		vi.mocked(prisma.auditEntry.findMany).mockResolvedValue([]);
		vi.mocked(prisma.auditEntry.count).mockResolvedValue(0);

		const token = await makeToken();
		await app.inject({
			method: 'GET',
			url: '/api/v1/audit?user_id=5',
			headers: authHeader(token),
		});

		const call = vi.mocked(prisma.auditEntry.findMany).mock.calls[0]![0];
		expect(call?.where?.userId).toBe(5);
	});

	it('filters by operation', async () => {
		vi.mocked(prisma.auditEntry.findMany).mockResolvedValue([]);
		vi.mocked(prisma.auditEntry.count).mockResolvedValue(0);

		const token = await makeToken();
		await app.inject({
			method: 'GET',
			url: '/api/v1/audit?operation=ACCOUNT_LOCKED',
			headers: authHeader(token),
		});

		const call = vi.mocked(prisma.auditEntry.findMany).mock.calls[0]![0];
		expect(call?.where?.operation).toBe('ACCOUNT_LOCKED');
	});

	it('defaults to page_size 50 and respects max 200', async () => {
		vi.mocked(prisma.auditEntry.findMany).mockResolvedValue([]);
		vi.mocked(prisma.auditEntry.count).mockResolvedValue(0);

		const token = await makeToken();

		// Default page_size
		const res1 = await app.inject({
			method: 'GET',
			url: '/api/v1/audit',
			headers: authHeader(token),
		});
		expect(res1.json().page_size).toBe(50);

		const call = vi.mocked(prisma.auditEntry.findMany).mock.calls[0]![0];
		expect(call?.take).toBe(50);

		// Exceeding max returns 400
		const res2 = await app.inject({
			method: 'GET',
			url: '/api/v1/audit?page_size=300',
			headers: authHeader(token),
		});
		expect(res2.statusCode).toBe(400);
	});

	it('returns total count', async () => {
		vi.mocked(prisma.auditEntry.findMany).mockResolvedValue([mockEntry]);
		vi.mocked(prisma.auditEntry.count).mockResolvedValue(150);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/audit',
			headers: authHeader(token),
		});
		expect(res.json().total).toBe(150);
	});
});

// ── Calculation History Tests ────────────────────────────────────────────────

const mockCalcEntry = {
	id: 10,
	runId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
	versionId: 1,
	module: 'REVENUE',
	status: 'COMPLETED',
	startedAt: new Date('2026-03-20T08:00:00Z'),
	completedAt: new Date('2026-03-20T08:00:02Z'),
	durationMs: 2000,
	triggeredBy: 1,
	inputSummary: { versionId: 1 },
	outputSummary: { rowsUpserted: 120 },
	version: { name: 'Budget v1', fiscalYear: 2026 },
	triggerer: { email: 'admin@budfin.app' },
};

describe('GET /api/v1/audit/calculation', () => {
	it('returns paginated calculation history for Admin', async () => {
		vi.mocked(prisma.calculationAuditLog.findMany).mockResolvedValue([mockCalcEntry]);
		vi.mocked(prisma.calculationAuditLog.count).mockResolvedValue(1);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/audit/calculation',
			headers: authHeader(token),
		});
		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.entries).toHaveLength(1);
		expect(body.entries[0].module).toBe('REVENUE');
		expect(body.entries[0].status).toBe('COMPLETED');
		expect(body.entries[0].version_name).toBe('Budget v1');
		expect(body.entries[0].triggered_by).toBe('admin@budfin.app');
		expect(body.entries[0].duration_ms).toBe(2000);
		expect(body.page).toBe(1);
		expect(body.page_size).toBe(20);
	});

	it('allows BudgetOwner access', async () => {
		vi.mocked(prisma.calculationAuditLog.findMany).mockResolvedValue([]);
		vi.mocked(prisma.calculationAuditLog.count).mockResolvedValue(0);

		const token = await makeToken({ role: 'BudgetOwner' });
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/audit/calculation',
			headers: authHeader(token),
		});
		expect(res.statusCode).toBe(200);
	});

	it('returns 403 for Editor role', async () => {
		const token = await makeToken({ role: 'Editor' });
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/audit/calculation',
			headers: authHeader(token),
		});
		expect(res.statusCode).toBe(403);
	});

	it('returns 403 for Viewer role', async () => {
		const token = await makeToken({ role: 'Viewer' });
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/audit/calculation',
			headers: authHeader(token),
		});
		expect(res.statusCode).toBe(403);
	});

	it('filters by version_id', async () => {
		vi.mocked(prisma.calculationAuditLog.findMany).mockResolvedValue([]);
		vi.mocked(prisma.calculationAuditLog.count).mockResolvedValue(0);

		const token = await makeToken();
		await app.inject({
			method: 'GET',
			url: '/api/v1/audit/calculation?version_id=3',
			headers: authHeader(token),
		});

		const call = vi.mocked(prisma.calculationAuditLog.findMany).mock.calls[0]![0];
		expect(call?.where?.versionId).toBe(3);
	});

	it('filters by module', async () => {
		vi.mocked(prisma.calculationAuditLog.findMany).mockResolvedValue([]);
		vi.mocked(prisma.calculationAuditLog.count).mockResolvedValue(0);

		const token = await makeToken();
		await app.inject({
			method: 'GET',
			url: '/api/v1/audit/calculation?module=STAFFING',
			headers: authHeader(token),
		});

		const call = vi.mocked(prisma.calculationAuditLog.findMany).mock.calls[0]![0];
		expect(call?.where?.module).toBe('STAFFING');
	});

	it('filters by date range (from/to)', async () => {
		vi.mocked(prisma.calculationAuditLog.findMany).mockResolvedValue([]);
		vi.mocked(prisma.calculationAuditLog.count).mockResolvedValue(0);

		const token = await makeToken();
		const from = '2026-03-01T00:00:00Z';
		const to = '2026-03-31T23:59:59Z';
		await app.inject({
			method: 'GET',
			url: `/api/v1/audit/calculation?from=${from}&to=${to}`,
			headers: authHeader(token),
		});

		const call = vi.mocked(prisma.calculationAuditLog.findMany).mock.calls[0]![0];
		expect(call?.where?.startedAt).toMatchObject({
			gte: new Date(from),
			lte: new Date(to),
		});
	});

	it('respects page_size max of 100', async () => {
		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/audit/calculation?page_size=200',
			headers: authHeader(token),
		});
		expect(res.statusCode).toBe(400);
	});

	it('handles null version and triggerer gracefully', async () => {
		const entryWithNulls = {
			...mockCalcEntry,
			versionId: null,
			triggeredBy: null,
			completedAt: null,
			durationMs: null,
			version: null,
			triggerer: null,
		};
		vi.mocked(prisma.calculationAuditLog.findMany).mockResolvedValue([entryWithNulls]);
		vi.mocked(prisma.calculationAuditLog.count).mockResolvedValue(1);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/audit/calculation',
			headers: authHeader(token),
		});
		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.entries[0].version_name).toBeNull();
		expect(body.entries[0].triggered_by).toBeNull();
		expect(body.entries[0].completed_at).toBeNull();
	});
});
