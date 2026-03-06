import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { generateRefreshToken, hashRefreshToken } from './token.js';

type TxClient = Prisma.TransactionClient;
type TokenFamilyClient = Pick<TxClient, 'refreshToken' | 'auditEntry'>;

const REFRESH_TOKEN_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

export interface CreateFamilyResult {
	token: string;
	tokenHash: string;
	familyId: string;
	expiresAt: Date;
}

export interface RotateTokenResult {
	token: string;
	tokenHash: string;
	expiresAt: Date;
}

/**
 * Create a new token family for a login event.
 * Stores the first refresh token (hashed) and returns the raw token.
 */
export async function createFamily(
	userId: number,
	ipAddress?: string,
	client: TokenFamilyClient = prisma
): Promise<CreateFamilyResult> {
	const familyId = randomUUID();
	const token = generateRefreshToken();
	const tokenHash = hashRefreshToken(token);
	const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

	await client.refreshToken.create({
		data: {
			userId,
			tokenHash,
			familyId,
			expiresAt,
		},
	});

	await client.auditEntry.create({
		data: {
			userId,
			operation: 'TOKEN_FAMILY_CREATED',
			tableName: 'refresh_tokens',
			ipAddress: ipAddress ?? null,
		},
	});

	return { token, tokenHash, familyId, expiresAt };
}

async function revokeFamily(tx: TokenFamilyClient, familyId: string, ipAddress?: string) {
	await tx.refreshToken.updateMany({
		where: { familyId, isRevoked: false },
		data: { isRevoked: true },
	});

	await tx.auditEntry.create({
		data: {
			userId: null,
			operation: 'TOKEN_FAMILY_REVOKED',
			tableName: 'refresh_tokens',
			ipAddress: ipAddress ?? null,
			newValues: {
				familyId,
				reason: 'concurrent_rotation_detected',
			},
		},
	});
}

/**
 * Rotate a refresh token within its family.
 * Revokes the old token and issues a new one in the same family.
 * Returns null when concurrent rotation is detected (token already rotated).
 */
export async function rotateToken(
	oldTokenHash: string,
	familyId: string,
	ipAddress?: string
): Promise<RotateTokenResult | null> {
	return prisma.$transaction(async (tx: TxClient) => {
		// Atomically revoke — only succeeds if not already revoked
		const revoked = await tx.refreshToken.updateMany({
			where: { tokenHash: oldTokenHash, familyId, isRevoked: false },
			data: { isRevoked: true },
		});

		if (revoked.count === 0) {
			// Token was already rotated by a concurrent request — replay detected
			await revokeFamily(tx, familyId, ipAddress);
			return null;
		}

		// Find userId from family
		const familyToken = await tx.refreshToken.findFirst({
			where: { familyId },
			select: { userId: true },
		});

		// Issue new token in same family
		const token = generateRefreshToken();
		const tokenHash = hashRefreshToken(token);
		const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

		await tx.refreshToken.create({
			data: {
				userId: familyToken!.userId,
				tokenHash,
				familyId,
				expiresAt,
			},
		});

		await tx.auditEntry.create({
			data: {
				userId: familyToken!.userId,
				operation: 'TOKEN_ROTATION',
				tableName: 'refresh_tokens',
				ipAddress: ipAddress ?? null,
			},
		});

		return { token, tokenHash, expiresAt };
	});
}

/**
 * Check a token hash for replay attacks.
 * If the token is revoked, revokes ALL user sessions (AC-06) and logs audit.
 * Unknown tokens are treated as replay.
 */
export async function detectReplay(
	tokenHash: string,
	userId: number,
	ipAddress?: string
): Promise<'VALID' | 'TOKEN_FAMILY_REVOKED'> {
	const existing = await prisma.refreshToken.findFirst({
		where: { tokenHash },
	});

	// Unknown token — treat as replay
	if (!existing) return 'TOKEN_FAMILY_REVOKED';

	// Valid, non-revoked token
	if (!existing.isRevoked) return 'VALID';

	// Revoked token replayed — revoke ALL user sessions (AC-06)
	await prisma.$transaction(async (tx: TxClient) => {
		await revokeAllUserTokens(userId, ipAddress, tx);

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
		});
	});

	return 'TOKEN_FAMILY_REVOKED';
}

/**
 * Revoke all active refresh tokens for a user.
 * Returns the count of revoked tokens.
 */
export async function revokeAllUserTokens(
	userId: number,
	ipAddress?: string,
	client: TokenFamilyClient = prisma
): Promise<number> {
	const result = await client.refreshToken.updateMany({
		where: { userId, isRevoked: false },
		data: { isRevoked: true },
	});

	await client.auditEntry.create({
		data: {
			userId,
			operation: 'ALL_SESSIONS_REVOKED',
			tableName: 'refresh_tokens',
			ipAddress: ipAddress ?? null,
		},
	});

	return result.count;
}
