import { vi, describe, it, expect, beforeEach } from 'vitest'
import {
	createFamily,
	rotateToken,
	detectReplay,
	revokeAllUserTokens,
} from './token-family.js'

const mockRefreshTokenCreate = vi.fn()
const mockRefreshTokenUpdate = vi.fn()
const mockRefreshTokenUpdateMany = vi.fn()
const mockRefreshTokenFindFirst = vi.fn()
const mockRefreshTokenFindUnique = vi.fn()
const mockRefreshTokenCount = vi.fn()
const mockAuditEntryCreate = vi.fn()

const mockPrisma = {
	refreshToken: {
		create: mockRefreshTokenCreate,
		update: mockRefreshTokenUpdate,
		updateMany: mockRefreshTokenUpdateMany,
		findFirst: mockRefreshTokenFindFirst,
		findUnique: mockRefreshTokenFindUnique,
		count: mockRefreshTokenCount,
	},
	auditEntry: {
		create: mockAuditEntryCreate,
	},
	$transaction: vi.fn(
		(fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
	),
}

vi.mock('../lib/prisma.js', () => ({
	prisma: {
		refreshToken: {
			create: (...args: unknown[]) => mockRefreshTokenCreate(...args),
			update: (...args: unknown[]) => mockRefreshTokenUpdate(...args),
			updateMany: (...args: unknown[]) => mockRefreshTokenUpdateMany(...args),
			findFirst: (...args: unknown[]) => mockRefreshTokenFindFirst(...args),
			findUnique: (...args: unknown[]) => mockRefreshTokenFindUnique(...args),
			count: (...args: unknown[]) => mockRefreshTokenCount(...args),
		},
		auditEntry: {
			create: (...args: unknown[]) => mockAuditEntryCreate(...args),
		},
		$transaction: (fn: (tx: typeof mockPrisma) => Promise<unknown>) =>
			fn(mockPrisma),
	},
}))

beforeEach(() => {
	vi.clearAllMocks()
	mockRefreshTokenCreate.mockResolvedValue({})
	mockRefreshTokenUpdateMany.mockResolvedValue({ count: 0 })
	mockAuditEntryCreate.mockResolvedValue({})
})

describe('token-family service', () => {
	describe('createFamily', () => {
		it('generates UUID familyId and returns raw token', async () => {
			const result = await createFamily(1)

			expect(result.familyId).toMatch(
				/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
			)
			expect(result.token).toBeTruthy()
			expect(result.tokenHash).toBeTruthy()
			expect(result.token).not.toBe(result.tokenHash)
		})

		it('creates RefreshToken record with correct expiresAt', async () => {
			const before = Date.now()
			const result = await createFamily(1)
			const after = Date.now()

			const eightHoursMs = 8 * 60 * 60 * 1000
			expect(result.expiresAt.getTime())
				.toBeGreaterThanOrEqual(before + eightHoursMs)
			expect(result.expiresAt.getTime())
				.toBeLessThanOrEqual(after + eightHoursMs)

			const createCall = mockRefreshTokenCreate.mock.calls[0]![0]
			expect(createCall.data.userId).toBe(1)
			expect(createCall.data.familyId).toBe(result.familyId)
		})

		it('creates audit entry with TOKEN_FAMILY_CREATED', async () => {
			await createFamily(42, '192.168.1.1')

			expect(mockAuditEntryCreate).toHaveBeenCalledWith({
				data: {
					userId: 42,
					operation: 'TOKEN_FAMILY_CREATED',
					tableName: 'refresh_tokens',
					ipAddress: '192.168.1.1',
				},
			})
		})
	})

	describe('rotateToken', () => {
		it('revokes old token and creates new token in same family', async () => {
			const familyId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
			mockRefreshTokenFindFirst.mockResolvedValue({ userId: 10 })

			const result = await rotateToken('old-hash', familyId)

			expect(result.token).toBeTruthy()
			expect(result.tokenHash).toBeTruthy()
			expect(result.expiresAt).toBeInstanceOf(Date)

			// Old token was revoked
			expect(mockRefreshTokenUpdateMany).toHaveBeenCalledWith({
				where: { tokenHash: 'old-hash', familyId },
				data: { isRevoked: true },
			})

			// New token created in same family
			const createCall = mockRefreshTokenCreate.mock.calls[0]![0]
			expect(createCall.data.familyId).toBe(familyId)
			expect(createCall.data.userId).toBe(10)
		})

		it('creates audit entry with TOKEN_ROTATION', async () => {
			mockRefreshTokenFindFirst.mockResolvedValue({ userId: 5 })

			await rotateToken('hash', 'family-1', '10.0.0.1')

			expect(mockAuditEntryCreate).toHaveBeenCalledWith({
				data: {
					operation: 'TOKEN_ROTATION',
					tableName: 'refresh_tokens',
					ipAddress: '10.0.0.1',
				},
			})
		})
	})

	describe('detectReplay', () => {
		it('returns VALID for non-revoked token', async () => {
			mockRefreshTokenFindFirst.mockResolvedValue({
				tokenHash: 'hash',
				familyId: 'fam-1',
				isRevoked: false,
			})

			const result = await detectReplay('hash', 1)

			expect(result).toBe('VALID')
		})

		it('revokes entire family when revoked token is replayed', async () => {
			const familyId = 'fam-replay'
			mockRefreshTokenFindFirst.mockResolvedValue({
				tokenHash: 'hash',
				familyId,
				isRevoked: true,
			})

			const result = await detectReplay('hash', 1)

			expect(result).toBe('TOKEN_FAMILY_REVOKED')
			expect(mockRefreshTokenUpdateMany).toHaveBeenCalledWith({
				where: { familyId, isRevoked: false },
				data: { isRevoked: true },
			})
		})

		it('creates TOKEN_FAMILY_REVOKED audit entry on replay', async () => {
			const familyId = 'fam-audit'
			mockRefreshTokenFindFirst.mockResolvedValue({
				tokenHash: 'hash',
				familyId,
				isRevoked: true,
			})

			await detectReplay('hash', 7, '172.16.0.1')

			expect(mockAuditEntryCreate).toHaveBeenCalledWith({
				data: {
					userId: 7,
					operation: 'TOKEN_FAMILY_REVOKED',
					tableName: 'refresh_tokens',
					ipAddress: '172.16.0.1',
					newValues: { familyId, reason: 'replay_detected' },
				},
			})
		})

		it('returns TOKEN_FAMILY_REVOKED for unknown token hash', async () => {
			mockRefreshTokenFindFirst.mockResolvedValue(null)

			const result = await detectReplay('unknown-hash', 1)

			expect(result).toBe('TOKEN_FAMILY_REVOKED')
		})
	})

	describe('revokeAllUserTokens', () => {
		it('revokes all active tokens for user', async () => {
			mockRefreshTokenUpdateMany.mockResolvedValue({ count: 3 })

			const count = await revokeAllUserTokens(5, '10.0.0.1')

			expect(count).toBe(3)
			expect(mockRefreshTokenUpdateMany).toHaveBeenCalledWith({
				where: { userId: 5, isRevoked: false },
				data: { isRevoked: true },
			})
			expect(mockAuditEntryCreate).toHaveBeenCalledWith({
				data: {
					userId: 5,
					operation: 'ALL_SESSIONS_REVOKED',
					tableName: 'refresh_tokens',
					ipAddress: '10.0.0.1',
				},
			})
		})
	})
})
