import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { generateKeyPair } from 'jose';
import { setKeys, signAccessToken } from '../services/token.js';
import { auth } from '../plugins/auth.js';
import { authRoutes } from './auth.js';

// ── Mock Prisma ──────────────────────────────────────────────────────────

const mockUserFindUnique = vi.fn();
const mockUserUpdate = vi.fn();
const mockSystemConfigFindUnique = vi.fn();
const mockRefreshTokenCount = vi.fn();
const mockRefreshTokenCreate = vi.fn();
const mockRefreshTokenFindFirst = vi.fn();
const mockRefreshTokenUpdate = vi.fn();
const mockRefreshTokenUpdateMany = vi.fn();
const mockAuditEntryCreate = vi.fn();
const mockExecuteRaw = vi.fn();

vi.mock('../lib/prisma.js', () => ({
	prisma: {
		user: {
			findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
			update: (...args: unknown[]) => mockUserUpdate(...args),
		},
		systemConfig: {
			findUnique: (...args: unknown[]) => mockSystemConfigFindUnique(...args),
		},
		refreshToken: {
			count: (...args: unknown[]) => mockRefreshTokenCount(...args),
			create: (...args: unknown[]) => mockRefreshTokenCreate(...args),
			findFirst: (...args: unknown[]) => mockRefreshTokenFindFirst(...args),
			update: (...args: unknown[]) => mockRefreshTokenUpdate(...args),
			updateMany: (...args: unknown[]) => mockRefreshTokenUpdateMany(...args),
		},
		auditEntry: {
			create: (...args: unknown[]) => mockAuditEntryCreate(...args),
		},
		$executeRaw: (...args: unknown[]) => mockExecuteRaw(...args),
	},
}));

// ── Mock services ────────────────────────────────────────────────────────

const mockVerifyPassword = vi.fn();
vi.mock('../services/password.js', () => ({
	verifyPassword: (...args: unknown[]) => mockVerifyPassword(...args),
}));

const mockCreateFamily = vi.fn();
const mockRotateToken = vi.fn();
const mockDetectReplay = vi.fn();
const mockRevokeAllUserTokens = vi.fn();
vi.mock('../services/token-family.js', () => ({
	createFamily: (...args: unknown[]) => mockCreateFamily(...args),
	rotateToken: (...args: unknown[]) => mockRotateToken(...args),
	detectReplay: (...args: unknown[]) => mockDetectReplay(...args),
	revokeAllUserTokens: (...args: unknown[]) => mockRevokeAllUserTokens(...args),
}));

// ── Test setup ───────────────────────────────────────────────────────────

const baseUser = {
	id: 1,
	email: 'test@efir.edu.sa',
	passwordHash: '$2b$12$hashedpassword',
	role: 'Editor',
	isActive: true,
	failedAttempts: 0,
	lockedUntil: null,
	forcePasswordReset: false,
	lastLoginAt: null,
	createdAt: new Date(),
	updatedAt: new Date(),
};

let validAccessToken: string;

async function buildTestApp() {
	const app = Fastify({ logger: false });
	app.setValidatorCompiler(validatorCompiler);
	app.setSerializerCompiler(serializerCompiler);
	await app.register(cookie);
	await app.register(rateLimit, {
		max: 100,
		timeWindow: '1 minute',
	});
	await app.register(auth);
	await app.register(authRoutes, { prefix: '/api/v1/auth' });
	return app;
}

beforeAll(async () => {
	const { privateKey, publicKey } = await generateKeyPair('RS256');
	setKeys(privateKey, publicKey);
	validAccessToken = await signAccessToken({
		sub: 1,
		email: 'test@efir.edu.sa',
		role: 'Editor',
		sessionId: 'test-session-id',
	});
});

beforeEach(() => {
	vi.clearAllMocks();
	mockUserUpdate.mockResolvedValue({});
	mockRefreshTokenCreate.mockResolvedValue({});
	mockRefreshTokenUpdate.mockResolvedValue({});
	mockRefreshTokenUpdateMany.mockResolvedValue({ count: 0 });
	mockAuditEntryCreate.mockResolvedValue({});
	mockExecuteRaw.mockResolvedValue(undefined);
	mockSystemConfigFindUnique.mockResolvedValue(null);
	mockRefreshTokenCount.mockResolvedValue(0);
	mockRefreshTokenFindFirst.mockResolvedValue(null);
	mockRevokeAllUserTokens.mockResolvedValue(0);
	mockCreateFamily.mockResolvedValue({
		token: 'raw-token',
		tokenHash: 'hashed',
		familyId: 'fam-uuid',
		expiresAt: new Date(Date.now() + 8 * 3600000),
	});
});

// ── Refresh Tests ────────────────────────────────────────────────────────

describe('POST /api/v1/auth/refresh', () => {
	it('returns new access_token + Set-Cookie on valid refresh', async () => {
		const app = await buildTestApp();
		mockRefreshTokenFindFirst.mockResolvedValue({
			id: 10,
			userId: 1,
			tokenHash: 'old-hash',
			familyId: 'fam-1',
			isRevoked: false,
			expiresAt: new Date(Date.now() + 3600000),
			user: { ...baseUser },
		});
		mockRotateToken.mockResolvedValue({
			token: 'new-raw-token',
			tokenHash: 'new-hash',
			expiresAt: new Date(Date.now() + 8 * 3600000),
		});

		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/auth/refresh',
			cookies: { refresh_token: 'old-raw-token' },
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.access_token).toBeTruthy();
		expect(body.expires_in).toBe(1800);
		expect(body.user.id).toBe(1);

		const cookies = res.cookies as {
			name: string;
			value: string;
		}[];
		const rc = cookies.find((c) => c.name === 'refresh_token');
		expect(rc).toBeTruthy();
		expect(rc!.value).toBe('new-raw-token');
	});

	it('returns 401 MISSING_TOKEN without cookie', async () => {
		const app = await buildTestApp();

		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/auth/refresh',
		});

		expect(res.statusCode).toBe(401);
		expect(res.json().error).toBe('MISSING_TOKEN');
	});

	it('returns 401 INVALID_TOKEN for unknown token', async () => {
		const app = await buildTestApp();
		mockRefreshTokenFindFirst.mockResolvedValue(null);

		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/auth/refresh',
			cookies: { refresh_token: 'unknown' },
		});

		expect(res.statusCode).toBe(401);
		expect(res.json().error).toBe('INVALID_TOKEN');
	});

	it('returns 401 TOKEN_EXPIRED for expired token', async () => {
		const app = await buildTestApp();
		mockRefreshTokenFindFirst.mockResolvedValue({
			id: 10,
			userId: 1,
			tokenHash: 'hash',
			familyId: 'fam-1',
			isRevoked: false,
			expiresAt: new Date(Date.now() - 1000),
			user: { ...baseUser },
		});

		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/auth/refresh',
			cookies: { refresh_token: 'expired' },
		});

		expect(res.statusCode).toBe(401);
		expect(res.json().error).toBe('TOKEN_EXPIRED');
	});

	it('returns 401 REFRESH_TOKEN_REUSE for revoked token', async () => {
		const app = await buildTestApp();
		mockRefreshTokenFindFirst.mockResolvedValue({
			id: 10,
			userId: 1,
			tokenHash: 'revoked-hash',
			familyId: 'fam-1',
			isRevoked: true,
			expiresAt: new Date(Date.now() + 3600000),
			user: { ...baseUser },
		});
		mockDetectReplay.mockResolvedValue('TOKEN_FAMILY_REVOKED');

		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/auth/refresh',
			cookies: { refresh_token: 'replayed' },
		});

		expect(res.statusCode).toBe(401);
		expect(res.json().error).toBe('REFRESH_TOKEN_REUSE');
		expect(mockDetectReplay).toHaveBeenCalledWith(expect.any(String), 1, expect.any(String));
	});

	it('rejects refresh for inactive users, clears cookie, and revokes sessions', async () => {
		const app = await buildTestApp();
		mockRefreshTokenFindFirst.mockResolvedValue({
			id: 10,
			userId: 1,
			tokenHash: 'hash',
			familyId: 'fam-1',
			isRevoked: false,
			expiresAt: new Date(Date.now() + 3600000),
			user: { ...baseUser, isActive: false },
		});

		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/auth/refresh',
			cookies: { refresh_token: 'inactive-user-token' },
		});

		expect(res.statusCode).toBe(401);
		expect(res.json().error).toBe('ACCOUNT_DISABLED');
		expect(mockRevokeAllUserTokens).toHaveBeenCalledWith(1, expect.any(String));
		expect(mockRotateToken).not.toHaveBeenCalled();

		const inactiveAudit = mockAuditEntryCreate.mock.calls.find(
			(c: unknown[]) =>
				(c[0] as { data: { operation: string } }).data.operation === 'REFRESH_REJECTED_INACTIVE'
		);
		expect(inactiveAudit).toBeTruthy();

		const cookies = res.cookies as {
			name: string;
			value: string;
		}[];
		const rc = cookies.find((c) => c.name === 'refresh_token');
		expect(rc).toBeTruthy();
		expect(rc!.value).toBe('');
	});

	it('revokes sessions for inactive user even with an expired token', async () => {
		const app = await buildTestApp();
		mockRefreshTokenFindFirst.mockResolvedValue({
			id: 10,
			userId: 1,
			tokenHash: 'hash',
			familyId: 'fam-1',
			isRevoked: false,
			expiresAt: new Date(Date.now() - 1000), // expired
			user: { ...baseUser, isActive: false },
		});

		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/auth/refresh',
			cookies: { refresh_token: 'inactive-expired-token' },
		});

		expect(res.statusCode).toBe(401);
		expect(res.json().error).toBe('ACCOUNT_DISABLED');
		expect(mockRevokeAllUserTokens).toHaveBeenCalledWith(1, expect.any(String));

		const cookies = res.cookies as { name: string; value: string }[];
		const rc = cookies.find((c) => c.name === 'refresh_token');
		expect(rc).toBeTruthy();
		expect(rc!.value).toBe('');
	});
});

// ── Logout Tests ─────────────────────────────────────────────────────────

describe('POST /api/v1/auth/logout', () => {
	it('returns 204 and clears cookie with valid auth', async () => {
		const app = await buildTestApp();
		mockRefreshTokenFindFirst.mockResolvedValue({
			id: 20,
			userId: 1,
			familyId: 'fam-1',
			isRevoked: false,
		});

		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/auth/logout',
			headers: {
				authorization: `Bearer ${validAccessToken}`,
			},
			cookies: { refresh_token: 'my-token' },
		});

		expect(res.statusCode).toBe(204);

		// Token revoked
		expect(mockRefreshTokenUpdate).toHaveBeenCalledWith({
			where: { id: 20 },
			data: { isRevoked: true },
		});

		// Cookie cleared
		const cookies = res.cookies as {
			name: string;
			value: string;
		}[];
		const rc = cookies.find((c) => c.name === 'refresh_token');
		expect(rc).toBeTruthy();
		expect(rc!.value).toBe('');
	});

	it('returns 204 without auth header (no cookie)', async () => {
		const app = await buildTestApp();

		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/auth/logout',
		});

		expect(res.statusCode).toBe(204);
		expect(mockRefreshTokenFindFirst).not.toHaveBeenCalled();
	});

	it('returns 204 and clears cookie without access token', async () => {
		const app = await buildTestApp();
		mockRefreshTokenFindFirst.mockResolvedValue({
			id: 20,
			userId: 1,
			familyId: 'fam-1',
			isRevoked: false,
		});

		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/auth/logout',
			cookies: { refresh_token: 'my-token' },
		});

		expect(res.statusCode).toBe(204);

		// Token still revoked
		expect(mockRefreshTokenUpdate).toHaveBeenCalledWith({
			where: { id: 20 },
			data: { isRevoked: true },
		});

		// Cookie cleared
		const cookies = res.cookies as { name: string; value: string }[];
		const rc = cookies.find((c) => c.name === 'refresh_token');
		expect(rc).toBeTruthy();
		expect(rc!.value).toBe('');
	});

	it('creates LOGOUT audit entry', async () => {
		const app = await buildTestApp();
		mockRefreshTokenFindFirst.mockResolvedValue({
			id: 20,
			userId: 1,
			familyId: 'fam-1',
			isRevoked: false,
		});

		await app.inject({
			method: 'POST',
			url: '/api/v1/auth/logout',
			headers: {
				authorization: `Bearer ${validAccessToken}`,
			},
			cookies: { refresh_token: 'token' },
		});

		const logoutAudit = mockAuditEntryCreate.mock.calls.find(
			(c: unknown[]) => (c[0] as { data: { operation: string } }).data.operation === 'LOGOUT'
		);
		expect(logoutAudit).toBeTruthy();
		const data = (logoutAudit![0] as { data: { userId: number } }).data;
		expect(data.userId).toBe(1);
	});
});
