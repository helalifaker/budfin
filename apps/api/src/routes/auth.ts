import type { Prisma } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { verifyPassword } from '../services/password.js';
import { signAccessToken, hashRefreshToken, verifyAccessToken } from '../services/token.js';
import {
	createFamily,
	rotateToken,
	detectReplay,
	revokeAllUserTokens,
} from '../services/token-family.js';

const loginBodySchema = z.object({
	email: z.string().email(),
	password: z.string(),
});

type ConfigClient = Pick<typeof prisma, 'systemConfig'>;

async function getConfigValue(
	key: string,
	defaultValue: number,
	client: ConfigClient = prisma
): Promise<number> {
	const config = await client.systemConfig.findUnique({
		where: { key },
	});
	return config ? Number(config.value) : defaultValue;
}

export async function authRoutes(fastify: FastifyInstance) {
	fastify.post('/login', {
		schema: {
			body: loginBodySchema,
		},
		config: {
			rateLimit: {
				max: 10,
				timeWindow: '15 minutes',
			},
		},
		handler: async (request, reply) => {
			const { email, password } = request.body as z.infer<typeof loginBodySchema>;
			const ip = request.ip;

			// 1. Find user
			const user = await prisma.user.findUnique({
				where: { email },
			});

			if (!user) {
				await prisma.auditEntry.create({
					data: {
						userId: null,
						userEmail: email,
						operation: 'LOGIN_FAILED_UNKNOWN_EMAIL',
						tableName: 'users',
						ipAddress: ip,
						newValues: { email } as unknown as Prisma.InputJsonValue,
					},
				});
				return reply.status(401).send({
					code: 'INVALID_CREDENTIALS',
					message: 'Invalid email or password',
				});
			}

			// 2. Check active
			if (!user.isActive) {
				return reply.status(401).send({
					code: 'ACCOUNT_DISABLED',
					message: 'Account is disabled',
				});
			}

			// 3. Check lockout
			if (user.lockedUntil) {
				if (user.lockedUntil > new Date()) {
					return reply.status(401).send({
						code: 'ACCOUNT_LOCKED',
						message: 'Account is locked',
						locked_until: user.lockedUntil.toISOString(),
					});
				}
				// Expired lockout — clear it
				await prisma.user.update({
					where: { id: user.id },
					data: { lockedUntil: null, failedAttempts: 0 },
				});
			}

			// 4. Verify password
			const valid = await verifyPassword(password, user.passwordHash);

			if (!valid) {
				const threshold = await getConfigValue('lockout_threshold', 5);
				const durationMinutes = await getConfigValue('lockout_duration_minutes', 30);
				const newAttempts = user.failedAttempts + 1;

				const updateData: Record<string, unknown> = {
					failedAttempts: newAttempts,
				};

				let isNowLocked = false;
				let lockedUntil: Date | undefined;

				if (newAttempts >= threshold) {
					lockedUntil = new Date(Date.now() + durationMinutes * 60 * 1000);
					updateData.lockedUntil = lockedUntil;
					isNowLocked = true;

					await prisma.auditEntry.create({
						data: {
							userId: user.id,
							userEmail: user.email,
							operation: 'ACCOUNT_LOCKED',
							tableName: 'users',
							ipAddress: ip,
						},
					});
				}

				await prisma.user.update({
					where: { id: user.id },
					data: updateData,
				});

				await prisma.auditEntry.create({
					data: {
						userId: user.id,
						userEmail: user.email,
						operation: 'LOGIN_FAILED',
						tableName: 'users',
						ipAddress: ip,
					},
				});

				if (isNowLocked) {
					return reply.status(401).send({
						code: 'ACCOUNT_LOCKED',
						message: 'Account locked due to too many failed attempts',
						locked_until: lockedUntil!.toISOString(),
					});
				}

				return reply.status(401).send({
					code: 'INVALID_CREDENTIALS',
					message: 'Invalid email or password',
				});
			}

			const family = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
				// Keep the lock and all session mutations in the same transaction.
				await tx.$executeRaw`SELECT pg_advisory_xact_lock(${user.id})`;

				const now = new Date();
				const activeSessionWhere = {
					userId: user.id,
					isRevoked: false,
					expiresAt: { gt: now },
				};
				const maxSessions = await getConfigValue('max_sessions_per_user', 2, tx);
				const activeSessions = await tx.refreshToken.count({
					where: activeSessionWhere,
				});

				if (activeSessions >= maxSessions) {
					const oldest = await tx.refreshToken.findFirst({
						where: activeSessionWhere,
						orderBy: { createdAt: 'asc' },
					});

					if (oldest) {
						await tx.refreshToken.update({
							where: { id: oldest.id },
							data: { isRevoked: true },
						});

						await tx.auditEntry.create({
							data: {
								userId: user.id,
								userEmail: user.email,
								operation: 'SESSION_FORCE_REVOKED',
								tableName: 'refresh_tokens',
								ipAddress: ip,
								newValues: {
									familyId: oldest.familyId,
									reason: 'max_sessions_exceeded',
								},
							},
						});
					}
				}

				await tx.user.update({
					where: { id: user.id },
					data: {
						failedAttempts: 0,
						lockedUntil: null,
						lastLoginAt: now,
					},
				});

				const createdFamily = await createFamily(user.id, ip, tx);

				return createdFamily;
			});

			// 6. Sign access token
			const accessToken = await signAccessToken({
				sub: user.id,
				email: user.email,
				role: user.role,
				sessionId: family.familyId,
			});

			// Audit after token issuance so a signing failure doesn't leave a
			// false LOGIN_SUCCESS record.
			await prisma.auditEntry.create({
				data: {
					userId: user.id,
					userEmail: user.email,
					operation: 'LOGIN_SUCCESS',
					tableName: 'users',
					ipAddress: ip,
				},
			});

			// 7. Set refresh token cookie
			reply.setCookie('refresh_token', family.token, {
				httpOnly: true,
				secure: true,
				sameSite: 'strict',
				path: '/api/v1/auth',
				maxAge: 8 * 60 * 60,
			});

			return {
				access_token: accessToken,
				expires_in: 1800 as const,
				user: {
					id: user.id,
					email: user.email,
					role: user.role,
				},
			};
		},
	});

	// ── POST /refresh ────────────────────────────────────────────────────

	fastify.post('/refresh', {
		handler: async (request, reply) => {
			const rawToken = (request.cookies as Record<string, string>)?.refresh_token;
			const ip = request.ip;

			if (!rawToken) {
				return reply.status(401).send({
					code: 'MISSING_TOKEN',
					message: 'No refresh token provided',
				});
			}

			const tokenHash = hashRefreshToken(rawToken);

			// Look up the token record
			const existing = await prisma.refreshToken.findFirst({
				where: { tokenHash },
				include: { user: { select: { id: true, email: true, role: true, isActive: true } } },
			});

			if (!existing) {
				return reply.status(401).send({
					code: 'INVALID_TOKEN',
					message: 'Invalid refresh token',
				});
			}

			// Check for replay (revoked token reuse)
			if (existing.isRevoked) {
				await detectReplay(tokenHash, existing.userId, ip);
				reply.clearCookie('refresh_token', {
					path: '/api/v1/auth',
				});
				return reply.status(401).send({
					code: 'REFRESH_TOKEN_REUSE',
					message: 'Token reuse detected',
				});
			}

			// Check inactive before expiry so an inactive user's remaining
			// sessions are always revoked, even when the presented token is
			// expired.
			if (!existing.user.isActive) {
				await revokeAllUserTokens(existing.userId, ip);
				await prisma.auditEntry.create({
					data: {
						userId: existing.userId,
						userEmail: existing.user.email,
						operation: 'REFRESH_REJECTED_INACTIVE',
						tableName: 'refresh_tokens',
						ipAddress: ip,
					},
				});
				reply.clearCookie('refresh_token', {
					path: '/api/v1/auth',
				});
				return reply.status(401).send({
					code: 'ACCOUNT_DISABLED',
					message: 'Account is disabled',
				});
			}

			// Check expiry
			if (existing.expiresAt < new Date()) {
				return reply.status(401).send({
					code: 'TOKEN_EXPIRED',
					message: 'Refresh token expired',
				});
			}

			// Rotate token within same family
			const rotated = await rotateToken(tokenHash, existing.familyId, ip);

			if (!rotated) {
				reply.clearCookie('refresh_token', { path: '/api/v1/auth' });
				return reply.status(401).send({
					code: 'REFRESH_TOKEN_REUSE',
					message: 'Token reuse detected',
				});
			}

			// Sign new access token
			const accessToken = await signAccessToken({
				sub: existing.user.id,
				email: existing.user.email,
				role: existing.user.role,
				sessionId: existing.familyId,
			});

			// Set new refresh cookie
			reply.setCookie('refresh_token', rotated.token, {
				httpOnly: true,
				secure: true,
				sameSite: 'strict',
				path: '/api/v1/auth',
				maxAge: 8 * 60 * 60,
			});

			return {
				access_token: accessToken,
				expires_in: 1800 as const,
				user: {
					id: existing.user.id,
					email: existing.user.email,
					role: existing.user.role,
				},
			};
		},
	});

	// ── POST /logout ─────────────────────────────────────────────────────

	fastify.post('/logout', {
		handler: async (request, reply) => {
			const rawToken = (request.cookies as Record<string, string>)?.refresh_token;
			const ip = request.ip;

			if (rawToken) {
				const tokenHash = hashRefreshToken(rawToken);

				const existing = await prisma.refreshToken.findFirst({
					where: { tokenHash },
				});

				if (existing && !existing.isRevoked) {
					await prisma.refreshToken.update({
						where: { id: existing.id },
						data: { isRevoked: true },
					});
				}
			}

			// Best-effort: extract userId from access token if present and valid
			let userId: number | null = null;
			const authHeader = request.headers.authorization;
			if (authHeader?.startsWith('Bearer ')) {
				try {
					const payload = await verifyAccessToken(authHeader.slice(7));
					userId = payload.sub;
				} catch {
					// Token expired or invalid — still allow logout
				}
			}

			await prisma.auditEntry.create({
				data: {
					userId,
					operation: 'LOGOUT',
					tableName: 'users',
					ipAddress: ip,
				},
			});

			reply.clearCookie('refresh_token', {
				path: '/api/v1/auth',
			});

			return reply.status(204).send();
		},
	});
}
