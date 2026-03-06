import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import rateLimit from '@fastify/rate-limit'
import {
	serializerCompiler,
	validatorCompiler,
} from 'fastify-type-provider-zod'
import { generateKeyPair } from 'jose'
import { setKeys } from '../services/token.js'
import { auth } from '../plugins/auth.js'
import { authRoutes } from './auth.js'

// ── Mock Prisma ──────────────────────────────────────────────────────────

const mockUserFindUnique = vi.fn()
const mockUserUpdate = vi.fn()
const mockSystemConfigFindUnique = vi.fn()
const mockRefreshTokenCount = vi.fn()
const mockRefreshTokenCreate = vi.fn()
const mockRefreshTokenFindFirst = vi.fn()
const mockRefreshTokenUpdate = vi.fn()
const mockRefreshTokenUpdateMany = vi.fn()
const mockAuditEntryCreate = vi.fn()
const mockExecuteRaw = vi.fn()

vi.mock('../lib/prisma.js', () => ({
	prisma: {
		user: {
			findUnique: (...args: unknown[]) =>
				mockUserFindUnique(...args),
			update: (...args: unknown[]) => mockUserUpdate(...args),
		},
		systemConfig: {
			findUnique: (...args: unknown[]) =>
				mockSystemConfigFindUnique(...args),
		},
		refreshToken: {
			count: (...args: unknown[]) =>
				mockRefreshTokenCount(...args),
			create: (...args: unknown[]) =>
				mockRefreshTokenCreate(...args),
			findFirst: (...args: unknown[]) =>
				mockRefreshTokenFindFirst(...args),
			update: (...args: unknown[]) =>
				mockRefreshTokenUpdate(...args),
			updateMany: (...args: unknown[]) =>
				mockRefreshTokenUpdateMany(...args),
		},
		auditEntry: {
			create: (...args: unknown[]) =>
				mockAuditEntryCreate(...args),
		},
		$executeRaw: (...args: unknown[]) => mockExecuteRaw(...args),
	},
}))

// ── Mock services ────────────────────────────────────────────────────────

const mockVerifyPassword = vi.fn()
vi.mock('../services/password.js', () => ({
	verifyPassword: (...args: unknown[]) =>
		mockVerifyPassword(...args),
}))

const mockCreateFamily = vi.fn()
vi.mock('../services/token-family.js', () => ({
	createFamily: (...args: unknown[]) =>
		mockCreateFamily(...args),
	rotateToken: vi.fn(),
	detectReplay: vi.fn(),
}))

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
}

async function buildTestApp() {
	const app = Fastify({ logger: false })
	app.setValidatorCompiler(validatorCompiler)
	app.setSerializerCompiler(serializerCompiler)
	await app.register(cookie)
	await app.register(rateLimit, {
		max: 100,
		timeWindow: '1 minute',
	})
	await app.register(auth)
	await app.register(authRoutes, { prefix: '/api/v1/auth' })
	return app
}

beforeAll(async () => {
	const { privateKey, publicKey } = await generateKeyPair('RS256')
	setKeys(privateKey, publicKey)
})

beforeEach(() => {
	vi.clearAllMocks()
	mockUserUpdate.mockResolvedValue({})
	mockRefreshTokenCreate.mockResolvedValue({})
	mockRefreshTokenUpdate.mockResolvedValue({})
	mockRefreshTokenUpdateMany.mockResolvedValue({ count: 0 })
	mockAuditEntryCreate.mockResolvedValue({})
	mockExecuteRaw.mockResolvedValue(undefined)
	mockSystemConfigFindUnique.mockResolvedValue(null)
	mockRefreshTokenCount.mockResolvedValue(0)
	mockRefreshTokenFindFirst.mockResolvedValue(null)
	mockCreateFamily.mockResolvedValue({
		token: 'raw-refresh-token',
		tokenHash: 'hashed-token',
		familyId: 'family-uuid',
		expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
	})
})

// ── Login Tests ──────────────────────────────────────────────────────────

describe('POST /api/v1/auth/login', () => {
	it('returns 200 + access_token + Set-Cookie for valid creds',
		async () => {
			const app = await buildTestApp()
			mockUserFindUnique.mockResolvedValue({ ...baseUser })
			mockVerifyPassword.mockResolvedValue(true)

			const res = await app.inject({
				method: 'POST',
				url: '/api/v1/auth/login',
				payload: {
					email: 'test@efir.edu.sa',
					password: 'correct',
				},
			})

			expect(res.statusCode).toBe(200)
			const body = res.json()
			expect(body.access_token).toBeTruthy()
			expect(body.expires_in).toBe(1800)
			expect(body.user.id).toBe(1)

			const cookies = res.cookies as {
				name: string
				value: string
			}[]
			const rc = cookies.find(
				(c) => c.name === 'refresh_token',
			)
			expect(rc).toBeTruthy()
		},
	)

	it('returns 401 INVALID_CREDENTIALS for unknown email',
		async () => {
			const app = await buildTestApp()
			mockUserFindUnique.mockResolvedValue(null)

			const res = await app.inject({
				method: 'POST',
				url: '/api/v1/auth/login',
				payload: {
					email: 'x@efir.edu.sa',
					password: 'any',
				},
			})

			expect(res.statusCode).toBe(401)
			expect(res.json().error).toBe('INVALID_CREDENTIALS')
		},
	)

	it('returns 401 and increments failedAttempts on wrong password',
		async () => {
			const app = await buildTestApp()
			mockUserFindUnique.mockResolvedValue({ ...baseUser })
			mockVerifyPassword.mockResolvedValue(false)

			const res = await app.inject({
				method: 'POST',
				url: '/api/v1/auth/login',
				payload: {
					email: 'test@efir.edu.sa',
					password: 'wrong',
				},
			})

			expect(res.statusCode).toBe(401)
			expect(mockUserUpdate).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { id: 1 },
					data: expect.objectContaining({
						failedAttempts: 1,
					}),
				}),
			)
		},
	)

	it('returns 401 ACCOUNT_LOCKED for locked account', async () => {
		const app = await buildTestApp()
		const lockedUntil = new Date(Date.now() + 30 * 60 * 1000)
		mockUserFindUnique.mockResolvedValue({
			...baseUser,
			lockedUntil,
		})

		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/auth/login',
			payload: {
				email: 'test@efir.edu.sa',
				password: 'any',
			},
		})

		expect(res.statusCode).toBe(401)
		const body = res.json()
		expect(body.error).toBe('ACCOUNT_LOCKED')
		expect(body.locked_until).toBe(lockedUntil.toISOString())
	})

	it('triggers lockout after threshold failures', async () => {
		const app = await buildTestApp()
		mockUserFindUnique.mockResolvedValue({
			...baseUser,
			failedAttempts: 4,
		})
		mockVerifyPassword.mockResolvedValue(false)

		await app.inject({
			method: 'POST',
			url: '/api/v1/auth/login',
			payload: {
				email: 'test@efir.edu.sa',
				password: 'wrong',
			},
		})

		const updateCall = mockUserUpdate.mock.calls[0]![0]
		expect(updateCall.data.failedAttempts).toBe(5)
		expect(updateCall.data.lockedUntil).toBeInstanceOf(Date)

		const lockAudit = mockAuditEntryCreate.mock.calls.find(
			(c: unknown[]) =>
				(c[0] as { data: { operation: string } }).data
					.operation === 'ACCOUNT_LOCKED',
		)
		expect(lockAudit).toBeTruthy()
	})

	it('clears expired lockout on successful login', async () => {
		const app = await buildTestApp()
		mockUserFindUnique.mockResolvedValue({
			...baseUser,
			lockedUntil: new Date(Date.now() - 1000),
			failedAttempts: 5,
		})
		mockVerifyPassword.mockResolvedValue(true)

		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/auth/login',
			payload: {
				email: 'test@efir.edu.sa',
				password: 'correct',
			},
		})

		expect(res.statusCode).toBe(200)
		const clearCall = mockUserUpdate.mock.calls[0]![0]
		expect(clearCall.data.lockedUntil).toBeNull()
		expect(clearCall.data.failedAttempts).toBe(0)
	})

	it('enforces session concurrency — revokes oldest on max',
		async () => {
			const app = await buildTestApp()
			mockUserFindUnique.mockResolvedValue({ ...baseUser })
			mockVerifyPassword.mockResolvedValue(true)
			mockRefreshTokenCount.mockResolvedValue(2)
			mockRefreshTokenFindFirst.mockResolvedValue({
				id: 99,
				familyId: 'old-family',
			})

			const res = await app.inject({
				method: 'POST',
				url: '/api/v1/auth/login',
				payload: {
					email: 'test@efir.edu.sa',
					password: 'correct',
				},
			})

			expect(res.statusCode).toBe(200)
			expect(mockRefreshTokenUpdate).toHaveBeenCalledWith({
				where: { id: 99 },
				data: { isRevoked: true },
			})

			const revokeAudit = mockAuditEntryCreate.mock.calls.find(
				(c: unknown[]) =>
					(c[0] as { data: { operation: string } }).data
						.operation === 'SESSION_FORCE_REVOKED',
			)
			expect(revokeAudit).toBeTruthy()
		},
	)

	it('creates LOGIN_SUCCESS audit entry', async () => {
		const app = await buildTestApp()
		mockUserFindUnique.mockResolvedValue({ ...baseUser })
		mockVerifyPassword.mockResolvedValue(true)

		await app.inject({
			method: 'POST',
			url: '/api/v1/auth/login',
			payload: {
				email: 'test@efir.edu.sa',
				password: 'correct',
			},
		})

		const audit = mockAuditEntryCreate.mock.calls.find(
			(c: unknown[]) =>
				(c[0] as { data: { operation: string } }).data
					.operation === 'LOGIN_SUCCESS',
		)
		expect(audit).toBeTruthy()
	})

	it('returns correct shape with expires_in: 1800', async () => {
		const app = await buildTestApp()
		mockUserFindUnique.mockResolvedValue({ ...baseUser })
		mockVerifyPassword.mockResolvedValue(true)

		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/auth/login',
			payload: {
				email: 'test@efir.edu.sa',
				password: 'correct',
			},
		})

		expect(res.json()).toEqual({
			access_token: expect.any(String),
			expires_in: 1800,
			user: {
				id: 1,
				email: 'test@efir.edu.sa',
				role: 'Editor',
			},
		})
	})
})
