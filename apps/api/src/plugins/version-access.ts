import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { prisma } from '../lib/prisma.js';

declare module 'fastify' {
	interface FastifyInstance {
		validateVersionAccess: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
	}
	interface FastifyRequest {
		version: {
			id: number;
			status: string;
			staleModules: string[];
		};
	}
}

async function versionAccessPlugin(app: FastifyInstance) {
	app.decorate(
		'validateVersionAccess',
		async function validateVersionAccess(request: FastifyRequest, reply: FastifyReply) {
			const params = request.params as { versionId?: string | number };
			const versionId = Number(params.versionId);

			if (!versionId || isNaN(versionId)) {
				return reply.status(400).send({
					code: 'INVALID_VERSION_ID',
					message: 'Invalid version ID',
				});
			}

			const version = await prisma.budgetVersion.findUnique({
				where: { id: versionId },
				select: { id: true, status: true, staleModules: true },
			});

			if (!version) {
				return reply.status(404).send({
					code: 'VERSION_NOT_FOUND',
					message: `Version ${versionId} not found`,
				});
			}

			request.version = version;
		}
	);
}

export const versionAccess = fp(versionAccessPlugin, {
	name: 'version-access',
	dependencies: ['auth'],
});
