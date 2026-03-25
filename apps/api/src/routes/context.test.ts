import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { generateKeyPair } from 'jose';
import { setKeys, signAccessToken } from '../services/token.js';
import { auth } from '../plugins/auth.js';
import { contextRoutes } from './context.js';

// ── Mock Prisma ──────────────────────────────────────────────────────────────

vi.mock('../lib/prisma.js', () => ({
	prisma: {
		systemConfig: {
			findUnique: vi.fn(),
		},
	},
}));

import { prisma } from '../lib/prisma.js';

const mockPrisma = prisma as unknown as {
	systemConfig: { findUnique: ReturnType<typeof vi.fn> };
};

// ── Helpers ──────────────────────────────────────────────────────────────────

let app: FastifyInstance;

async function makeToken(overrides: { sub?: number; role?: string; email?: string } = {}) {
	return signAccessToken({
		sub: overrides.sub ?? 1,
		email: overrides.email ?? 'admin@budfin.app',
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

	app = Fastify({ logger: false });
	app.setValidatorCompiler(validatorCompiler);
	app.setSerializerCompiler(serializerCompiler);
	await app.register(auth);
	await app.register(contextRoutes, { prefix: '/api/v1' });
	await app.ready();
});

beforeEach(() => {
	vi.clearAllMocks();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/v1/context', () => {
	it('returns 200 with user context for Admin', async () => {
		mockPrisma.systemConfig.findUnique.mockResolvedValue({
			key: 'schoolYear',
			value: '2026-2027',
		});

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/context',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.user.id).toBe(1);
		expect(body.user.email).toBe('admin@budfin.app');
		expect(body.user.role).toBe('Admin');
		expect(body.schoolYear).toBe('2026-2027');
		expect(body.permissions).toContain('data:view');
		expect(body.permissions).toContain('data:edit');
		expect(body.permissions).toContain('salary:view');
		expect(body.permissions).toContain('admin:users');
	});

	it('returns role-specific permissions for Viewer', async () => {
		mockPrisma.systemConfig.findUnique.mockResolvedValue(null);

		const token = await makeToken({ role: 'Viewer' });
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/context',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.user.role).toBe('Viewer');
		expect(body.permissions).toContain('data:view');
		expect(body.permissions).not.toContain('data:edit');
		expect(body.permissions).not.toContain('salary:view');
		expect(body.permissions).not.toContain('admin:users');
	});

	it('returns role-specific permissions for Editor', async () => {
		mockPrisma.systemConfig.findUnique.mockResolvedValue(null);

		const token = await makeToken({ role: 'Editor' });
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/context',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.permissions).toContain('data:view');
		expect(body.permissions).toContain('data:edit');
		expect(body.permissions).toContain('salary:view');
		expect(body.permissions).not.toContain('salary:edit');
	});

	it('returns null schoolYear when not configured', async () => {
		mockPrisma.systemConfig.findUnique.mockResolvedValue(null);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/context',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		expect(res.json().schoolYear).toBeNull();
	});

	it('returns 401 without auth', async () => {
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/context',
		});

		expect(res.statusCode).toBe(401);
	});
});
