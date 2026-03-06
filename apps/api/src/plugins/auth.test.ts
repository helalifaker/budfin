import { describe, it, expect, beforeAll, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { generateKeyPair } from 'jose';
import { setKeys, signAccessToken } from '../services/token.js';
import { auth } from './auth.js';

// Mock prisma for audit entry creation
vi.mock('../lib/prisma.js', () => ({
	prisma: {
		auditEntry: {
			create: vi.fn().mockResolvedValue({ id: 1 }),
		},
	},
}));

import { prisma } from '../lib/prisma.js';

let app: FastifyInstance;

async function buildTestApp() {
	const instance = Fastify({ logger: false });
	await instance.register(auth);

	// Route requiring only authentication
	instance.get('/authed', {
		preHandler: [instance.authenticate],
		handler: async (request) => ({ user: request.user }),
	});

	// Route requiring Admin role
	instance.get('/admin-only', {
		preHandler: [instance.authenticate, instance.requireRole('Admin')],
		handler: async () => ({ ok: true }),
	});

	// Route requiring Admin or BudgetOwner role
	instance.get('/budget', {
		preHandler: [instance.authenticate, instance.requireRole('Admin', 'BudgetOwner')],
		handler: async () => ({ ok: true }),
	});

	// Route requiring salary:view permission
	instance.get('/salary', {
		preHandler: [instance.authenticate, instance.requirePermission('salary:view')],
		handler: async () => ({ ok: true }),
	});

	// Route requiring admin:users permission
	instance.get('/users', {
		preHandler: [instance.authenticate, instance.requirePermission('admin:users')],
		handler: async () => ({ ok: true }),
	});

	await instance.ready();
	return instance;
}

async function makeToken(overrides: { sub?: number; email?: string; role?: string } = {}) {
	return signAccessToken({
		sub: overrides.sub ?? 1,
		email: overrides.email ?? 'test@budfin.app',
		role: overrides.role ?? 'Admin',
		sessionId: 'test-session-id',
	});
}

beforeAll(async () => {
	const keys = await generateKeyPair('RS256');
	setKeys(keys.privateKey, keys.publicKey);
	app = await buildTestApp();
});

describe('authenticate', () => {
	it('allows request with valid Bearer token', async () => {
		const token = await makeToken({
			sub: 42,
			email: 'admin@budfin.app',
			role: 'Admin',
		});
		const res = await app.inject({
			method: 'GET',
			url: '/authed',
			headers: { authorization: `Bearer ${token}` },
		});
		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.user.id).toBe(42);
		expect(body.user.email).toBe('admin@budfin.app');
		expect(body.user.role).toBe('Admin');
	});

	it('rejects request without Authorization header (401)', async () => {
		const res = await app.inject({
			method: 'GET',
			url: '/authed',
		});
		expect(res.statusCode).toBe(401);
		expect(res.json().error).toBe('UNAUTHORIZED');
	});

	it('rejects request with invalid token (401)', async () => {
		const res = await app.inject({
			method: 'GET',
			url: '/authed',
			headers: { authorization: 'Bearer invalid.token.here' },
		});
		expect(res.statusCode).toBe(401);
		expect(res.json().error).toBe('INVALID_TOKEN');
	});
});

describe('requireRole', () => {
	it('allows matching role', async () => {
		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'GET',
			url: '/admin-only',
			headers: { authorization: `Bearer ${token}` },
		});
		expect(res.statusCode).toBe(200);
	});

	it('rejects non-matching role (403)', async () => {
		vi.mocked(prisma.auditEntry.create).mockClear();
		const token = await makeToken({ role: 'Viewer' });
		const res = await app.inject({
			method: 'GET',
			url: '/admin-only',
			headers: { authorization: `Bearer ${token}` },
		});
		expect(res.statusCode).toBe(403);
		expect(res.json().error).toBe('FORBIDDEN');
	});

	it('allows when role is in multi-role list', async () => {
		const token = await makeToken({ role: 'BudgetOwner' });
		const res = await app.inject({
			method: 'GET',
			url: '/budget',
			headers: { authorization: `Bearer ${token}` },
		});
		expect(res.statusCode).toBe(200);
	});
});

describe('requirePermission', () => {
	it('allows when user has permission', async () => {
		const token = await makeToken({ role: 'BudgetOwner' });
		const res = await app.inject({
			method: 'GET',
			url: '/salary',
			headers: { authorization: `Bearer ${token}` },
		});
		expect(res.statusCode).toBe(200);
	});

	it('rejects when user lacks permission (403)', async () => {
		vi.mocked(prisma.auditEntry.create).mockClear();
		const token = await makeToken({ role: 'Viewer' });
		const res = await app.inject({
			method: 'GET',
			url: '/salary',
			headers: { authorization: `Bearer ${token}` },
		});
		expect(res.statusCode).toBe(403);
		expect(res.json().error).toBe('FORBIDDEN');
	});
});

describe('audit logging on 403', () => {
	it('creates audit entry on role rejection', async () => {
		vi.mocked(prisma.auditEntry.create).mockClear();
		const token = await makeToken({
			sub: 99,
			role: 'Editor',
		});
		const res = await app.inject({
			method: 'GET',
			url: '/admin-only',
			headers: { authorization: `Bearer ${token}` },
		});
		expect(res.statusCode).toBe(403);
		expect(prisma.auditEntry.create).toHaveBeenCalledOnce();
		const call = vi.mocked(prisma.auditEntry.create).mock.calls[0]![0];
		expect(call.data.operation).toBe('AUTHORIZATION_FAILED');
		expect(call.data.userId).toBe(99);
		expect(call.data.newValues).toMatchObject({
			requiredRoles: ['Admin'],
			actualRole: 'Editor',
		});
	});

	it('creates audit entry on permission rejection', async () => {
		vi.mocked(prisma.auditEntry.create).mockClear();
		const token = await makeToken({
			sub: 77,
			role: 'Viewer',
		});
		const res = await app.inject({
			method: 'GET',
			url: '/users',
			headers: { authorization: `Bearer ${token}` },
		});
		expect(res.statusCode).toBe(403);
		expect(prisma.auditEntry.create).toHaveBeenCalledOnce();
		const call = vi.mocked(prisma.auditEntry.create).mock.calls[0]![0];
		expect(call.data.operation).toBe('AUTHORIZATION_FAILED');
		expect(call.data.userId).toBe(77);
		expect(call.data.newValues).toMatchObject({
			requiredPermissions: ['admin:users'],
			actualRole: 'Viewer',
		});
	});
});
