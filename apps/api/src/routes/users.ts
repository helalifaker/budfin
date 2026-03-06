import type { Prisma } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { hashPassword } from '../services/password.js';
import { revokeAllUserTokens } from '../services/token-family.js';

const userRoleEnum = z.enum(['Admin', 'BudgetOwner', 'Editor', 'Viewer']);

const createBodySchema = z.object({
	email: z.string().email().max(255),
	password: z.string().min(8).max(128),
	role: userRoleEnum,
});

const updateBodySchema = z.object({
	role: userRoleEnum.optional(),
	is_active: z.boolean().optional(),
	force_password_reset: z.boolean().optional(),
	unlock_account: z.boolean().optional(),
	force_session_revoke: z.boolean().optional(),
});

const paramsSchema = z.object({
	id: z.coerce.number().int().positive(),
});

function formatUser(user: {
	id: number;
	email: string;
	role: string;
	isActive: boolean;
	lastLoginAt: Date | null;
	failedAttempts: number;
	lockedUntil: Date | null;
	createdAt: Date;
}) {
	return {
		id: user.id,
		email: user.email,
		role: user.role,
		is_active: user.isActive,
		last_login_at: user.lastLoginAt?.toISOString() ?? null,
		failed_attempts: user.failedAttempts,
		locked_until: user.lockedUntil?.toISOString() ?? null,
		created_at: user.createdAt.toISOString(),
	};
}

export async function userRoutes(app: FastifyInstance) {
	// GET / — List users (Admin only)
	app.get('/', {
		preHandler: [app.authenticate, app.requireRole('Admin')],
		handler: async () => {
			const users = await prisma.user.findMany({
				orderBy: { createdAt: 'desc' },
				select: {
					id: true,
					email: true,
					role: true,
					isActive: true,
					lastLoginAt: true,
					failedAttempts: true,
					lockedUntil: true,
					createdAt: true,
				},
			});
			return { users: users.map(formatUser) };
		},
	});

	// POST / — Create user (Admin only)
	app.post('/', {
		schema: { body: createBodySchema },
		preHandler: [app.authenticate, app.requireRole('Admin')],
		handler: async (request, reply) => {
			const { email, password, role } = request.body as z.infer<typeof createBodySchema>;

			const existing = await prisma.user.findUnique({
				where: { email },
			});
			if (existing) {
				return reply.status(409).send({
					error: 'CONFLICT',
					message: 'A user with this email already exists',
				});
			}

			const passwordHash = await hashPassword(password);

			const user = await prisma.user.create({
				data: {
					email,
					passwordHash,
					role,
					isActive: true,
					failedAttempts: 0,
				},
			});

			await prisma.auditEntry.create({
				data: {
					userId: request.user.id,
					operation: 'USER_CREATED',
					tableName: 'users',
					recordId: user.id,
					ipAddress: request.ip,
					newValues: { email, role },
				},
			});

			return reply.status(201).send({
				id: user.id,
				email: user.email,
				role: user.role,
			});
		},
	});

	// PATCH /:id — Update user (Admin only)
	app.patch('/:id', {
		schema: { params: paramsSchema, body: updateBodySchema },
		preHandler: [app.authenticate, app.requireRole('Admin')],
		handler: async (request, reply) => {
			const { id } = request.params as z.infer<typeof paramsSchema>;
			const body = request.body as z.infer<typeof updateBodySchema>;

			// Self-protection (EC-AUTH-05)
			if (id === request.user.id) {
				const isSelfDangerous =
					body.is_active === false || body.role !== undefined || body.force_session_revoke === true;
				if (isSelfDangerous) {
					return reply.status(400).send({
						error: 'SELF_MODIFICATION',
						message: 'Cannot modify your own account',
					});
				}
			}

			const target = await prisma.user.findUnique({
				where: { id },
			});
			if (!target) {
				return reply.status(404).send({
					error: 'NOT_FOUND',
					message: `User ${id} not found`,
				});
			}

			// Last Admin protection (EC-AUTH-06)
			if (body.is_active === false && target.role === 'Admin') {
				const adminCount = await prisma.user.count({
					where: { role: 'Admin', isActive: true },
				});
				if (adminCount <= 1) {
					return reply.status(400).send({
						error: 'LAST_ADMIN',
						message: 'Cannot deactivate the last active admin',
					});
				}
			}

			// Build update data
			const updateData: Record<string, unknown> = {};
			const oldValues: Record<string, unknown> = {};
			const newValues: Record<string, unknown> = {};

			if (body.role !== undefined) {
				oldValues.role = target.role;
				newValues.role = body.role;
				updateData.role = body.role;
			}
			if (body.is_active !== undefined) {
				oldValues.isActive = target.isActive;
				newValues.isActive = body.is_active;
				updateData.isActive = body.is_active;
			}
			if (body.force_password_reset !== undefined) {
				oldValues.forcePasswordReset = target.forcePasswordReset;
				newValues.forcePasswordReset = body.force_password_reset;
				updateData.forcePasswordReset = body.force_password_reset;
			}

			if (body.unlock_account === true) {
				oldValues.lockedUntil = target.lockedUntil?.toISOString() ?? null;
				oldValues.failedAttempts = target.failedAttempts;
				updateData.lockedUntil = null;
				updateData.failedAttempts = 0;
			}

			const shouldRevokeSessions = body.force_session_revoke === true || body.is_active === false;

			const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
				if (body.unlock_account === true) {
					await tx.auditEntry.create({
						data: {
							userId: request.user.id,
							operation: 'ACCOUNT_UNLOCKED',
							tableName: 'users',
							recordId: id,
							ipAddress: request.ip,
							oldValues: {
								lockedUntil: target.lockedUntil?.toISOString() ?? null,
								failedAttempts: target.failedAttempts,
							},
						},
					});
				}

				if (shouldRevokeSessions) {
					await revokeAllUserTokens(id, request.ip, tx);
				}

				if (body.force_session_revoke === true) {
					await tx.auditEntry.create({
						data: {
							userId: request.user.id,
							operation: 'SESSION_FORCE_REVOKED',
							tableName: 'refresh_tokens',
							recordId: id,
							ipAddress: request.ip,
						},
					});
				}

				const nextUser = await tx.user.update({
					where: { id },
					data: updateData,
					select: {
						id: true,
						email: true,
						role: true,
						isActive: true,
						lastLoginAt: true,
						failedAttempts: true,
						lockedUntil: true,
						createdAt: true,
					},
				});

				if (Object.keys(newValues).length > 0) {
					await tx.auditEntry.create({
						data: {
							userId: request.user.id,
							operation: 'USER_UPDATED',
							tableName: 'users',
							recordId: id,
							ipAddress: request.ip,
							oldValues: oldValues as Record<string, string | number | boolean | null>,
							newValues: newValues as Record<string, string | number | boolean | null>,
						},
					});
				}

				return nextUser;
			});

			return formatUser(updated);
		},
	});
}
