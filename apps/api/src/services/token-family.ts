import { randomUUID } from 'node:crypto'
import { prisma } from '../lib/prisma.js'
import { generateRefreshToken, hashRefreshToken } from './token.js'

const REFRESH_TOKEN_TTL_MS = 8 * 60 * 60 * 1000 // 8 hours

export interface CreateFamilyResult {
	token: string
	tokenHash: string
	familyId: string
	expiresAt: Date
}

export interface RotateTokenResult {
	token: string
	tokenHash: string
	expiresAt: Date
}

/**
 * Create a new token family for a login event.
 * Stores the first refresh token (hashed) and returns the raw token.
 */
export async function createFamily(
	userId: number,
	ipAddress?: string,
): Promise<CreateFamilyResult> {
	const familyId = randomUUID()
	const token = generateRefreshToken()
	const tokenHash = hashRefreshToken(token)
	const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS)

	await prisma.refreshToken.create({
		data: {
			userId,
			tokenHash,
			familyId,
			expiresAt,
		},
	})

	await prisma.auditEntry.create({
		data: {
			userId,
			operation: 'TOKEN_FAMILY_CREATED',
			tableName: 'refresh_tokens',
			ipAddress: ipAddress ?? null,
		},
	})

	return { token, tokenHash, familyId, expiresAt }
}

/**
 * Rotate a refresh token within its family.
 * Revokes the old token and issues a new one in the same family.
 */
export async function rotateToken(
	oldTokenHash: string,
	familyId: string,
	ipAddress?: string,
): Promise<RotateTokenResult> {
	return prisma.$transaction(async (tx) => {
		// Revoke old token
		await tx.refreshToken.updateMany({
			where: { tokenHash: oldTokenHash, familyId },
			data: { isRevoked: true },
		})

		// Find userId from family
		const familyToken = await tx.refreshToken.findFirst({
			where: { familyId },
			select: { userId: true },
		})

		// Issue new token in same family
		const token = generateRefreshToken()
		const tokenHash = hashRefreshToken(token)
		const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS)

		await tx.refreshToken.create({
			data: {
				userId: familyToken!.userId,
				tokenHash,
				familyId,
				expiresAt,
			},
		})

		await tx.auditEntry.create({
			data: {
				operation: 'TOKEN_ROTATION',
				tableName: 'refresh_tokens',
				ipAddress: ipAddress ?? null,
			},
		})

		return { token, tokenHash, expiresAt }
	})
}

/**
 * Check a token hash for replay attacks.
 * If the token is revoked, revokes entire family and logs audit.
 * Unknown tokens are treated as replay.
 */
export async function detectReplay(
	tokenHash: string,
	userId: number,
	ipAddress?: string,
): Promise<'VALID' | 'TOKEN_FAMILY_REVOKED'> {
	const existing = await prisma.refreshToken.findFirst({
		where: { tokenHash },
	})

	// Unknown token — treat as replay
	if (!existing) return 'TOKEN_FAMILY_REVOKED'

	// Valid, non-revoked token
	if (!existing.isRevoked) return 'VALID'

	// Revoked token replayed — revoke entire family
	await prisma.$transaction(async (tx) => {
		await tx.refreshToken.updateMany({
			where: { familyId: existing.familyId, isRevoked: false },
			data: { isRevoked: true },
		})

		await tx.auditEntry.create({
			data: {
				userId,
				operation: 'TOKEN_FAMILY_REVOKED',
				tableName: 'refresh_tokens',
				ipAddress: ipAddress ?? null,
				newValues: {
					familyId: existing.familyId,
					reason: 'replay_detected',
				},
			},
		})
	})

	return 'TOKEN_FAMILY_REVOKED'
}

/**
 * Revoke all active refresh tokens for a user.
 * Returns the count of revoked tokens.
 */
export async function revokeAllUserTokens(
	userId: number,
	ipAddress?: string,
): Promise<number> {
	const result = await prisma.refreshToken.updateMany({
		where: { userId, isRevoked: false },
		data: { isRevoked: true },
	})

	await prisma.auditEntry.create({
		data: {
			userId,
			operation: 'ALL_SESSIONS_REVOKED',
			tableName: 'refresh_tokens',
			ipAddress: ipAddress ?? null,
		},
	})

	return result.count
}
