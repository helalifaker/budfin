import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { generateKeyPair } from 'jose';
import { setKeys, signAccessToken } from '../services/token.js';
import { auth } from '../plugins/auth.js';
import { userRoutes } from './users.js';
import { contextRoutes } from './context.js';

// Mock prisma
vi.mock('../lib/prisma.js', () => ({
	prisma: {
		user: {
			findMany: vi.fn(),
			findUnique: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
			count: vi.fn(),
		},
		auditEntry: {
			create: vi.fn().mockResolvedValue({ id: 1 }),
		},
	},
}));

// Mock password service
vi.mock('../services/password.js', () => ({
	hashPassword: vi.fn().mockResolvedValue('$2a$12$hashed'),
}));

// Mock token-family service
vi.mock('../services/token-family.js', () => ({
	revokeAllUserTokens: vi.fn().mockResolvedValue(3),
}));

import { prisma } from '../lib/prisma.js';
import { revokeAllUserTokens } from '../services/token-family.js';

let app: FastifyInstance;

async function makeToken(overrides: { sub?: number; email?: string; role?: string } = {}) {
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

const mockUser = {
	id: 2,
	email: 'editor@budfin.app',
	role: 'Editor' as const,
	passwordHash: '$2a$12$hashed',
	isActive: true,
	forcePasswordReset: false,
	lastLoginAt: null,
	failedAttempts: 0,
	lockedUntil: null,
	createdAt: new Date('2026-01-01'),
	updatedAt: new Date('2026-01-01'),
};

beforeAll(async () => {
	const keys = await generateKeyPair('RS256');
	setKeys(keys.privateKey, keys.publicKey);

	app = Fastify({ logger: false });
	app.setValidatorCompiler(validatorCompiler);
	app.setSerializerCompiler(serializerCompiler);
	await app.register(auth);
	await app.register(userRoutes, { prefix: '/api/v1/users' });
	await app.register(contextRoutes, { prefix: '/api/v1' });
	await app.ready();
});

beforeEach(() => {
	vi.clearAllMocks();
});

describe('GET /api/v1/users', () => {
	it('returns user list for Admin', async () => {
		vi.mocked(prisma.user.findMany).mockResolvedValue([mockUser]);
		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/users',
			headers: authHeader(token),
		});
		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.users).toHaveLength(1);
		expect(body.users[0].email).toBe('editor@budfin.app');
		expect(body.users[0].is_active).toBe(true);
	});

	it('returns 403 for non-Admin', async () => {
		const token = await makeToken({ role: 'Editor' });
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/users',
			headers: authHeader(token),
		});
		expect(res.statusCode).toBe(403);
	});
});

describe('POST /api/v1/users', () => {
	it('creates user with hashed password (201)', async () => {
		vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
		vi.mocked(prisma.user.create).mockResolvedValue({
			...mockUser,
			id: 10,
			email: 'new@budfin.app',
			role: 'Viewer',
		});

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/users',
			headers: authHeader(token),
			payload: {
				email: 'new@budfin.app',
				password: 'securepass1',
				role: 'Viewer',
			},
		});
		expect(res.statusCode).toBe(201);
		expect(res.json()).toMatchObject({
			id: 10,
			email: 'new@budfin.app',
			role: 'Viewer',
		});
		expect(prisma.auditEntry.create).toHaveBeenCalledOnce();
	});

	it('validates min 8 char password', async () => {
		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/users',
			headers: authHeader(token),
			payload: {
				email: 'new@budfin.app',
				password: 'short',
				role: 'Viewer',
			},
		});
		expect(res.statusCode).toBe(400);
	});
});

describe('PATCH /api/v1/users/:id', () => {
	it('updates role', async () => {
		vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);
		vi.mocked(prisma.user.update).mockResolvedValue({
			...mockUser,
			role: 'BudgetOwner' as const,
		});

		const token = await makeToken({ sub: 1, role: 'Admin' });
		const res = await app.inject({
			method: 'PATCH',
			url: '/api/v1/users/2',
			headers: authHeader(token),
			payload: { role: 'BudgetOwner' },
		});
		expect(res.statusCode).toBe(200);
		expect(res.json().role).toBe('BudgetOwner');
		// USER_UPDATED audit entry
		const auditCalls = vi.mocked(prisma.auditEntry.create).mock.calls;
		const updateAudit = auditCalls.find((c) => c[0].data.operation === 'USER_UPDATED');
		expect(updateAudit).toBeDefined();
	});

	it('rejects self-deactivation (400 SELF_MODIFICATION)', async () => {
		const token = await makeToken({ sub: 1, role: 'Admin' });
		const res = await app.inject({
			method: 'PATCH',
			url: '/api/v1/users/1',
			headers: authHeader(token),
			payload: { is_active: false },
		});
		expect(res.statusCode).toBe(400);
		expect(res.json().error).toBe('SELF_MODIFICATION');
	});

	it('rejects last Admin deactivation (400 LAST_ADMIN)', async () => {
		vi.mocked(prisma.user.findUnique).mockResolvedValue({
			...mockUser,
			id: 5,
			role: 'Admin' as const,
		});
		vi.mocked(prisma.user.count).mockResolvedValue(1);

		const token = await makeToken({ sub: 1, role: 'Admin' });
		const res = await app.inject({
			method: 'PATCH',
			url: '/api/v1/users/5',
			headers: authHeader(token),
			payload: { is_active: false },
		});
		expect(res.statusCode).toBe(400);
		expect(res.json().error).toBe('LAST_ADMIN');
	});

	it('unlock_account clears lockout', async () => {
		const lockedUser = {
			...mockUser,
			id: 3,
			lockedUntil: new Date('2026-04-01'),
			failedAttempts: 5,
		};
		vi.mocked(prisma.user.findUnique).mockResolvedValue(lockedUser);
		vi.mocked(prisma.user.update).mockResolvedValue({
			...lockedUser,
			lockedUntil: null,
			failedAttempts: 0,
		});

		const token = await makeToken({ sub: 1, role: 'Admin' });
		const res = await app.inject({
			method: 'PATCH',
			url: '/api/v1/users/3',
			headers: authHeader(token),
			payload: { unlock_account: true },
		});
		expect(res.statusCode).toBe(200);
		expect(res.json().locked_until).toBeNull();
		expect(res.json().failed_attempts).toBe(0);

		const auditCalls = vi.mocked(prisma.auditEntry.create).mock.calls;
		const unlockAudit = auditCalls.find((c) => c[0].data.operation === 'ACCOUNT_UNLOCKED');
		expect(unlockAudit).toBeDefined();
	});

	it('force_session_revoke revokes all tokens', async () => {
		vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);
		vi.mocked(prisma.user.update).mockResolvedValue(mockUser);

		const token = await makeToken({ sub: 1, role: 'Admin' });
		const res = await app.inject({
			method: 'PATCH',
			url: '/api/v1/users/2',
			headers: authHeader(token),
			payload: { force_session_revoke: true },
		});
		expect(res.statusCode).toBe(200);
		expect(revokeAllUserTokens).toHaveBeenCalledWith(2, expect.any(String));

		const auditCalls = vi.mocked(prisma.auditEntry.create).mock.calls;
		const revokeAudit = auditCalls.find((c) => c[0].data.operation === 'SESSION_FORCE_REVOKED');
		expect(revokeAudit).toBeDefined();
	});
});

describe('GET /api/v1/context', () => {
	it('returns user + permissions array', async () => {
		const token = await makeToken({
			sub: 5,
			email: 'viewer@budfin.app',
			role: 'Viewer',
		});
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/context',
			headers: authHeader(token),
		});
		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.user).toMatchObject({
			id: 5,
			email: 'viewer@budfin.app',
			role: 'Viewer',
		});
		expect(body.permissions).toContain('data:view');
		expect(body.permissions).not.toContain('salary:view');
		expect(body).toHaveProperty('schoolYear', null);
	});
});

describe('POST /api/v1/users — duplicate email', () => {
	it('returns 409 CONFLICT for existing email', async () => {
		vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);
		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/users',
			headers: authHeader(token),
			payload: {
				email: 'editor@budfin.app',
				password: 'securepass1',
				role: 'Viewer',
			},
		});
		expect(res.statusCode).toBe(409);
		expect(res.json().error).toBe('CONFLICT');
	});
});

describe('PATCH /api/v1/users/:id — not found', () => {
	it('returns 404 NOT_FOUND for unknown user', async () => {
		vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
		const token = await makeToken({ sub: 1, role: 'Admin' });
		const res = await app.inject({
			method: 'PATCH',
			url: '/api/v1/users/999',
			headers: authHeader(token),
			payload: { role: 'Viewer' },
		});
		expect(res.statusCode).toBe(404);
		expect(res.json().error).toBe('NOT_FOUND');
	});
});

describe('PATCH /api/v1/users/:id — force_password_reset', () => {
	it('sets forcePasswordReset and logs audit', async () => {
		vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);
		vi.mocked(prisma.user.update).mockResolvedValue({
			...mockUser,
			forcePasswordReset: true,
		});

		const token = await makeToken({ sub: 1, role: 'Admin' });
		const res = await app.inject({
			method: 'PATCH',
			url: '/api/v1/users/2',
			headers: authHeader(token),
			payload: { force_password_reset: true },
		});
		expect(res.statusCode).toBe(200);

		const auditCalls = vi.mocked(prisma.auditEntry.create).mock.calls;
		const updateAudit = auditCalls.find((c) => c[0].data.operation === 'USER_UPDATED');
		expect(updateAudit).toBeDefined();
		expect(updateAudit![0].data.newValues).toMatchObject({
			forcePasswordReset: true,
		});
	});
});
