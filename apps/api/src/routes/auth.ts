import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { verifyPassword } from '../services/password.js';
import { signAccessToken, hashRefreshToken } from '../services/token.js';
import { createFamily, rotateToken, detectReplay } from '../services/token-family.js';

const loginBodySchema = z.object({
	email: z.string().email(),
	password: z.string(),
});

async function getConfigValue(key: string, defaultValue: number): Promise<number> {
	const config = await prisma.systemConfig.findUnique({
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
				return reply.status(401).send({
					error: 'INVALID_CREDENTIALS',
					message: 'Invalid email or password',
				});
			}

			// 2. Check active
			if (!user.isActive) {
				return reply.status(401).send({
					error: 'ACCOUNT_DISABLED',
					message: 'Account is disabled',
				});
			}

			// 3. Check lockout
			if (user.lockedUntil) {
				if (user.lockedUntil > new Date()) {
					return reply.status(401).send({
						error: 'ACCOUNT_LOCKED',
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

				if (newAttempts >= threshold) {
					updateData.lockedUntil = new Date(Date.now() + durationMinutes * 60 * 1000);

					await prisma.auditEntry.create({
						data: {
							userId: user.id,
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
						operation: 'LOGIN_FAILURE',
						tableName: 'users',
						ipAddress: ip,
					},
				});

				return reply.status(401).send({
					error: 'INVALID_CREDENTIALS',
					message: 'Invalid email or password',
				});
			}

			// 5. Successful login — use advisory lock for concurrency
			await prisma.$executeRaw`SELECT pg_advisory_xact_lock(${user.id})`;

			// 6. Session concurrency
			const maxSessions = await getConfigValue('max_sessions_per_user', 2);

			const activeSessions = await prisma.refreshToken.count({
				where: {
					userId: user.id,
					isRevoked: false,
					expiresAt: { gt: new Date() },
				},
			});

			if (activeSessions >= maxSessions) {
				const oldest = await prisma.refreshToken.findFirst({
					where: {
						userId: user.id,
						isRevoked: false,
						expiresAt: { gt: new Date() },
					},
					orderBy: { createdAt: 'asc' },
				});

				if (oldest) {
					await prisma.refreshToken.update({
						where: { id: oldest.id },
						data: { isRevoked: true },
					});

					await prisma.auditEntry.create({
						data: {
							userId: user.id,
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

			// 7. Reset failed attempts, update last login
			await prisma.user.update({
				where: { id: user.id },
				data: {
					failedAttempts: 0,
					lockedUntil: null,
					lastLoginAt: new Date(),
				},
			});

			// 8. Create token family
			const family = await createFamily(user.id, ip);

			// 9. Sign access token
			const accessToken = await signAccessToken({
				sub: user.id,
				email: user.email,
				role: user.role,
			});

			// 10. Set refresh token cookie
			reply.setCookie('refresh_token', family.token, {
				httpOnly: true,
				secure: process.env.NODE_ENV === 'production',
				sameSite: 'strict',
				path: '/api/v1/auth',
				maxAge: 8 * 60 * 60,
			});

			// 11. Audit
			await prisma.auditEntry.create({
				data: {
					userId: user.id,
					operation: 'LOGIN_SUCCESS',
					tableName: 'users',
					ipAddress: ip,
				},
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
					error: 'MISSING_TOKEN',
					message: 'No refresh token provided',
				});
			}

			const tokenHash = hashRefreshToken(rawToken);

			// Look up the token record
			const existing = await prisma.refreshToken.findFirst({
				where: { tokenHash },
				include: { user: { select: { id: true, email: true, role: true } } },
			});

			if (!existing) {
				return reply.status(401).send({
					error: 'INVALID_TOKEN',
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
					error: 'REFRESH_TOKEN_REUSE',
					message: 'Token reuse detected',
				});
			}

			// Check expiry
			if (existing.expiresAt < new Date()) {
				return reply.status(401).send({
					error: 'TOKEN_EXPIRED',
					message: 'Refresh token expired',
				});
			}

			// Rotate token within same family
			const rotated = await rotateToken(tokenHash, existing.familyId, ip);

			// Sign new access token
			const accessToken = await signAccessToken({
				sub: existing.user.id,
				email: existing.user.email,
				role: existing.user.role,
			});

			// Set new refresh cookie
			reply.setCookie('refresh_token', rotated.token, {
				httpOnly: true,
				secure: process.env.NODE_ENV === 'production',
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
		preHandler: [fastify.authenticate],
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

			await prisma.auditEntry.create({
				data: {
					userId: request.user.id,
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
