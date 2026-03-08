import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { UserRole } from '@prisma/client';
import { verifyAccessToken } from '../services/token.js';
import { ROLE_PERMISSIONS, type Permission } from '../lib/rbac.js';
import { prisma } from '../lib/prisma.js';

declare module 'fastify' {
	interface FastifyInstance {
		authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
		requireRole: (
			...roles: UserRole[]
		) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
		requirePermission: (
			...perms: Permission[]
		) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
	}
	interface FastifyRequest {
		user: {
			id: number;
			email: string;
			role: UserRole;
		};
	}
}

async function authPlugin(app: FastifyInstance) {
	app.decorate(
		'authenticate',
		async function authenticate(request: FastifyRequest, reply: FastifyReply) {
			const header = request.headers.authorization;
			if (!header?.startsWith('Bearer ')) {
				return reply.status(401).send({
					code: 'UNAUTHORIZED',
					message: 'Missing or invalid authorization header',
				});
			}

			const token = header.slice(7);
			try {
				const payload = await verifyAccessToken(token);
				request.user = {
					id: payload.sub,
					email: payload.email,
					role: payload.role as UserRole,
				};
			} catch {
				return reply.status(401).send({
					code: 'INVALID_TOKEN',
					message: 'Token is invalid or expired',
				});
			}
		}
	);

	app.decorate('requireRole', function requireRole(...roles: UserRole[]) {
		return async function checkRole(request: FastifyRequest, reply: FastifyReply) {
			if (!roles.includes(request.user.role)) {
				await prisma.auditEntry.create({
					data: {
						operation: 'AUTHORIZATION_FAILED',
						userId: request.user.id,
						userEmail: request.user.email,
						ipAddress: request.ip,
						newValues: {
							route: request.url,
							method: request.method,
							requiredRoles: roles,
							actualRole: request.user.role,
						},
					},
				});
				return reply.status(403).send({
					code: 'FORBIDDEN',
					message: 'Insufficient permissions',
				});
			}
		};
	});

	app.decorate('requirePermission', function requirePermission(...perms: Permission[]) {
		return async function checkPermission(request: FastifyRequest, reply: FastifyReply) {
			const userPerms = ROLE_PERMISSIONS[request.user.role];
			const missing = perms.some((p) => !userPerms?.has(p));
			if (missing) {
				await prisma.auditEntry.create({
					data: {
						operation: 'AUTHORIZATION_FAILED',
						userId: request.user.id,
						userEmail: request.user.email,
						ipAddress: request.ip,
						newValues: {
							route: request.url,
							method: request.method,
							requiredPermissions: perms,
							actualRole: request.user.role,
						},
					},
				});
				return reply.status(403).send({
					code: 'FORBIDDEN',
					message: 'Insufficient permissions',
				});
			}
		};
	});
}

export const auth = fp(authPlugin, { name: 'auth' });
