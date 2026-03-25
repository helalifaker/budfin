import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

// ── Schemas ────────────────────────────────────────────────────────────────

const versionIdParams = z.object({
	versionId: z.coerce.number().int().positive(),
});

const commentIdParams = z.object({
	versionId: z.coerce.number().int().positive(),
	id: z.coerce.number().int().positive(),
});

const listQuerySchema = z.object({
	targetType: z.string().min(1).max(30),
	targetId: z.string().min(1).max(100),
});

const countsQuerySchema = z.object({
	targetType: z.string().min(1).max(30),
});

const createBodySchema = z.object({
	targetType: z.string().min(1).max(30),
	targetId: z.string().min(1).max(100),
	parentId: z.number().int().positive().nullable().optional(),
	body: z.string().min(1).max(5000),
});

const patchBodySchema = z.object({
	body: z.string().min(1).max(5000),
});

// ── Helpers ────────────────────────────────────────────────────────────────

interface CommentRow {
	id: number;
	versionId: number;
	targetType: string;
	targetId: string;
	parentId: number | null;
	authorId: number;
	body: string;
	resolvedAt: Date | null;
	resolvedById: number | null;
	createdAt: Date;
	updatedAt: Date;
	author: { email: string };
	resolvedBy: { email: string } | null;
	replies?: CommentRow[];
}

interface FormattedComment {
	id: number;
	versionId: number;
	targetType: string;
	targetId: string;
	parentId: number | null;
	authorId: number;
	authorEmail: string;
	body: string;
	resolvedAt: string | null;
	resolvedByEmail: string | null;
	createdAt: string;
	updatedAt: string;
	replies: FormattedComment[];
}

function formatComment(c: CommentRow): FormattedComment {
	return {
		id: c.id,
		versionId: c.versionId,
		targetType: c.targetType,
		targetId: c.targetId,
		parentId: c.parentId,
		authorId: c.authorId,
		authorEmail: c.author.email,
		body: c.body,
		resolvedAt: c.resolvedAt?.toISOString() ?? null,
		resolvedByEmail: c.resolvedBy?.email ?? null,
		createdAt: c.createdAt.toISOString(),
		updatedAt: c.updatedAt.toISOString(),
		replies: (c.replies ?? []).map(formatComment),
	};
}

const commentInclude = {
	author: { select: { email: true } },
	resolvedBy: { select: { email: true } },
} as const;

// ── Routes ─────────────────────────────────────────────────────────────────

export async function commentRoutes(app: FastifyInstance) {
	// GET / — List comments for a target (root comments with nested replies)
	app.get('/', {
		schema: {
			params: versionIdParams,
			querystring: listQuerySchema,
		},
		preHandler: [app.authenticate, app.requirePermission('data:view')],
		handler: async (request) => {
			const { versionId } = request.params as z.infer<typeof versionIdParams>;
			const { targetType, targetId } = request.query as z.infer<typeof listQuerySchema>;

			const rootComments = await prisma.comment.findMany({
				where: {
					versionId,
					targetType,
					targetId,
					parentId: null,
				},
				include: {
					...commentInclude,
					replies: {
						include: commentInclude,
						orderBy: { createdAt: 'asc' },
					},
				},
				orderBy: { createdAt: 'desc' },
			});

			return {
				comments: rootComments.map(formatComment),
			};
		},
	});

	// GET /counts — Unresolved comment counts by targetId
	app.get('/counts', {
		schema: {
			params: versionIdParams,
			querystring: countsQuerySchema,
		},
		preHandler: [app.authenticate, app.requirePermission('data:view')],
		handler: async (request) => {
			const { versionId } = request.params as z.infer<typeof versionIdParams>;
			const { targetType } = request.query as z.infer<typeof countsQuerySchema>;

			const counts = await prisma.comment.groupBy({
				by: ['targetId'],
				where: {
					versionId,
					targetType,
					parentId: null,
					resolvedAt: null,
				},
				_count: { id: true },
			});

			return {
				counts: counts.map((row) => ({
					targetId: row.targetId,
					unresolvedCount: row._count.id,
				})),
			};
		},
	});

	// POST / — Create a comment or reply
	app.post('/', {
		schema: {
			params: versionIdParams,
			body: createBodySchema,
		},
		preHandler: [app.authenticate, app.requirePermission('data:edit')],
		handler: async (request, reply) => {
			const { versionId } = request.params as z.infer<typeof versionIdParams>;
			const { targetType, targetId, parentId, body } = request.body as z.infer<
				typeof createBodySchema
			>;

			const version = await prisma.budgetVersion.findUnique({
				where: { id: versionId },
				select: { id: true },
			});

			if (!version) {
				return reply.status(404).send({
					code: 'VERSION_NOT_FOUND',
					message: `Version ${versionId} not found`,
				});
			}

			// If replying, validate parent exists and belongs to same version/target
			if (parentId) {
				const parent = await prisma.comment.findUnique({
					where: { id: parentId },
					select: { id: true, versionId: true, targetType: true, targetId: true, parentId: true },
				});

				if (!parent || parent.versionId !== versionId) {
					return reply.status(404).send({
						code: 'PARENT_NOT_FOUND',
						message: `Parent comment ${parentId} not found in this version`,
					});
				}

				if (parent.parentId !== null) {
					return reply.status(400).send({
						code: 'NESTED_REPLY',
						message: 'Replies to replies are not supported; reply to the root comment instead',
					});
				}
			}

			const comment = await prisma.comment.create({
				data: {
					versionId,
					targetType,
					targetId,
					parentId: parentId ?? null,
					authorId: request.user.id,
					body,
				},
				include: {
					...commentInclude,
					replies: {
						include: commentInclude,
						orderBy: { createdAt: 'asc' },
					},
				},
			});

			return reply.status(201).send({
				comment: formatComment(comment),
			});
		},
	});

	// PATCH /:id — Edit own comment body
	app.patch('/:id', {
		schema: {
			params: commentIdParams,
			body: patchBodySchema,
		},
		preHandler: [app.authenticate, app.requirePermission('data:edit')],
		handler: async (request, reply) => {
			const { versionId, id } = request.params as z.infer<typeof commentIdParams>;
			const { body } = request.body as z.infer<typeof patchBodySchema>;

			const comment = await prisma.comment.findUnique({
				where: { id },
				select: { id: true, versionId: true, authorId: true },
			});

			if (!comment || comment.versionId !== versionId) {
				return reply.status(404).send({
					code: 'COMMENT_NOT_FOUND',
					message: `Comment ${id} not found`,
				});
			}

			if (comment.authorId !== request.user.id) {
				return reply.status(403).send({
					code: 'NOT_AUTHOR',
					message: 'You can only edit your own comments',
				});
			}

			const updated = await prisma.comment.update({
				where: { id },
				data: { body },
				include: {
					...commentInclude,
					replies: {
						include: commentInclude,
						orderBy: { createdAt: 'asc' },
					},
				},
			});

			return { comment: formatComment(updated) };
		},
	});

	// POST /:id/resolve — Resolve a thread (root comment only)
	app.post('/:id/resolve', {
		schema: { params: commentIdParams },
		preHandler: [app.authenticate, app.requirePermission('data:edit')],
		handler: async (request, reply) => {
			const { versionId, id } = request.params as z.infer<typeof commentIdParams>;

			const comment = await prisma.comment.findUnique({
				where: { id },
				select: { id: true, versionId: true, parentId: true, resolvedAt: true },
			});

			if (!comment || comment.versionId !== versionId) {
				return reply.status(404).send({
					code: 'COMMENT_NOT_FOUND',
					message: `Comment ${id} not found`,
				});
			}

			if (comment.parentId !== null) {
				return reply.status(400).send({
					code: 'NOT_ROOT_COMMENT',
					message: 'Only root comments (threads) can be resolved',
				});
			}

			if (comment.resolvedAt) {
				return reply.status(409).send({
					code: 'ALREADY_RESOLVED',
					message: 'This thread is already resolved',
				});
			}

			const updated = await prisma.comment.update({
				where: { id },
				data: {
					resolvedAt: new Date(),
					resolvedById: request.user.id,
				},
				include: {
					...commentInclude,
					replies: {
						include: commentInclude,
						orderBy: { createdAt: 'asc' },
					},
				},
			});

			return { comment: formatComment(updated) };
		},
	});

	// POST /:id/unresolve — Reopen a resolved thread
	app.post('/:id/unresolve', {
		schema: { params: commentIdParams },
		preHandler: [app.authenticate, app.requirePermission('data:edit')],
		handler: async (request, reply) => {
			const { versionId, id } = request.params as z.infer<typeof commentIdParams>;

			const comment = await prisma.comment.findUnique({
				where: { id },
				select: { id: true, versionId: true, parentId: true, resolvedAt: true },
			});

			if (!comment || comment.versionId !== versionId) {
				return reply.status(404).send({
					code: 'COMMENT_NOT_FOUND',
					message: `Comment ${id} not found`,
				});
			}

			if (comment.parentId !== null) {
				return reply.status(400).send({
					code: 'NOT_ROOT_COMMENT',
					message: 'Only root comments (threads) can be unresolved',
				});
			}

			if (!comment.resolvedAt) {
				return reply.status(409).send({
					code: 'NOT_RESOLVED',
					message: 'This thread is not resolved',
				});
			}

			const updated = await prisma.comment.update({
				where: { id },
				data: {
					resolvedAt: null,
					resolvedById: null,
				},
				include: {
					...commentInclude,
					replies: {
						include: commentInclude,
						orderBy: { createdAt: 'asc' },
					},
				},
			});

			return { comment: formatComment(updated) };
		},
	});

	// DELETE /:id — Delete own comment
	app.delete('/:id', {
		schema: { params: commentIdParams },
		preHandler: [app.authenticate, app.requirePermission('data:edit')],
		handler: async (request, reply) => {
			const { versionId, id } = request.params as z.infer<typeof commentIdParams>;

			const comment = await prisma.comment.findUnique({
				where: { id },
				select: { id: true, versionId: true, authorId: true },
			});

			if (!comment || comment.versionId !== versionId) {
				return reply.status(404).send({
					code: 'COMMENT_NOT_FOUND',
					message: `Comment ${id} not found`,
				});
			}

			if (comment.authorId !== request.user.id) {
				return reply.status(403).send({
					code: 'NOT_AUTHOR',
					message: 'You can only delete your own comments',
				});
			}

			await prisma.comment.delete({ where: { id } });

			return reply.status(204).send();
		},
	});
}
