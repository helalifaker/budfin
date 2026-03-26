import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { generateKeyPair } from 'jose';
import { setKeys, signAccessToken } from '../services/token.js';
import { auth } from '../plugins/auth.js';
import { commentRoutes } from './comments.js';

// ── Mock Prisma ─────────────────────────────────────────────────────────────

vi.mock('../lib/prisma.js', () => {
	const mockPrisma = {
		budgetVersion: { findUnique: vi.fn() },
		comment: {
			findMany: vi.fn(),
			findUnique: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
			delete: vi.fn(),
			groupBy: vi.fn(),
		},
		auditEntry: { create: vi.fn().mockResolvedValue({}) },
	};
	return { prisma: mockPrisma };
});

import { prisma } from '../lib/prisma.js';

const mockPrisma = prisma as unknown as {
	budgetVersion: { findUnique: ReturnType<typeof vi.fn> };
	comment: {
		findMany: ReturnType<typeof vi.fn>;
		findUnique: ReturnType<typeof vi.fn>;
		create: ReturnType<typeof vi.fn>;
		update: ReturnType<typeof vi.fn>;
		delete: ReturnType<typeof vi.fn>;
		groupBy: ReturnType<typeof vi.fn>;
	};
};

let app: FastifyInstance;

const ROUTE_PREFIX = '/api/v1/versions/:versionId/comments';
const URL_BASE = '/api/v1/versions/1/comments';

async function makeToken(role = 'Admin', userId = 1) {
	return signAccessToken({
		sub: userId,
		email: `user${userId}@budfin.app`,
		role,
		sessionId: 'test-session',
	});
}

function headers(token: string) {
	return { authorization: `Bearer ${token}` };
}

const NOW = new Date();

function mockComment(overrides: Record<string, unknown> = {}) {
	return {
		id: 1,
		versionId: 1,
		targetType: 'revenue',
		targetId: 'grade-PS',
		parentId: null,
		authorId: 1,
		body: 'Test comment',
		resolvedAt: null,
		resolvedById: null,
		createdAt: NOW,
		updatedAt: NOW,
		author: { email: 'user1@budfin.app' },
		resolvedBy: null,
		replies: [],
		...overrides,
	};
}

beforeAll(async () => {
	const keys = await generateKeyPair('RS256');
	setKeys(keys.privateKey, keys.publicKey);
});

beforeEach(async () => {
	vi.clearAllMocks();
	app = Fastify();
	app.setValidatorCompiler(validatorCompiler);
	app.setSerializerCompiler(serializerCompiler);
	await app.register(auth);
	await app.register(commentRoutes, { prefix: ROUTE_PREFIX });
	await app.ready();
});

// ── GET / — List comments ─────────────────────────────────────────────────

describe('GET /comments', () => {
	it('returns comments for a target', async () => {
		const comment = mockComment();
		mockPrisma.comment.findMany.mockResolvedValue([comment]);
		const token = await makeToken();

		const res = await app.inject({
			method: 'GET',
			url: `${URL_BASE}?targetType=revenue&targetId=grade-PS`,
			headers: headers(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.comments).toHaveLength(1);
		expect(body.comments[0].body).toBe('Test comment');
		expect(body.comments[0].authorEmail).toBe('user1@budfin.app');
		expect(body.comments[0].replies).toEqual([]);
	});

	it('returns 401 without auth', async () => {
		const res = await app.inject({
			method: 'GET',
			url: `${URL_BASE}?targetType=revenue&targetId=grade-PS`,
		});

		expect(res.statusCode).toBe(401);
	});

	it('handles resolved comment with resolvedBy', async () => {
		const comment = mockComment({
			resolvedAt: NOW,
			resolvedById: 2,
			resolvedBy: { email: 'user2@budfin.app' },
		});
		mockPrisma.comment.findMany.mockResolvedValue([comment]);
		const token = await makeToken();

		const res = await app.inject({
			method: 'GET',
			url: `${URL_BASE}?targetType=revenue&targetId=grade-PS`,
			headers: headers(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.comments[0].resolvedAt).toBeTruthy();
		expect(body.comments[0].resolvedByEmail).toBe('user2@budfin.app');
	});

	it('handles comment with nested replies', async () => {
		const reply = mockComment({
			id: 2,
			parentId: 1,
			body: 'A reply',
			authorId: 2,
			author: { email: 'user2@budfin.app' },
		});
		const comment = mockComment({ replies: [reply] });
		mockPrisma.comment.findMany.mockResolvedValue([comment]);
		const token = await makeToken();

		const res = await app.inject({
			method: 'GET',
			url: `${URL_BASE}?targetType=revenue&targetId=grade-PS`,
			headers: headers(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.comments[0].replies).toHaveLength(1);
		expect(body.comments[0].replies[0].body).toBe('A reply');
	});
});

// ── GET /counts ───────────────────────────────────────────────────────────

describe('GET /comments/counts', () => {
	it('returns unresolved comment counts', async () => {
		mockPrisma.comment.groupBy.mockResolvedValue([
			{ targetId: 'grade-PS', _count: { id: 3 } },
			{ targetId: 'grade-MS', _count: { id: 1 } },
		]);
		const token = await makeToken();

		const res = await app.inject({
			method: 'GET',
			url: `${URL_BASE}/counts?targetType=revenue`,
			headers: headers(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.counts).toHaveLength(2);
		expect(body.counts[0].targetId).toBe('grade-PS');
		expect(body.counts[0].unresolvedCount).toBe(3);
	});
});

// ── POST / — Create comment ──────────────────────────────────────────────

describe('POST /comments', () => {
	it('creates a root comment', async () => {
		const created = mockComment();
		mockPrisma.budgetVersion.findUnique.mockResolvedValue({ id: 1 });
		mockPrisma.comment.create.mockResolvedValue(created);
		const token = await makeToken('Editor');

		const res = await app.inject({
			method: 'POST',
			url: URL_BASE,
			headers: headers(token),
			payload: {
				targetType: 'revenue',
				targetId: 'grade-PS',
				body: 'Test comment',
			},
		});

		expect(res.statusCode).toBe(201);
		const body = res.json();
		expect(body.comment.body).toBe('Test comment');
	});

	it('returns 404 when version does not exist', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(null);
		const token = await makeToken();

		const res = await app.inject({
			method: 'POST',
			url: URL_BASE,
			headers: headers(token),
			payload: {
				targetType: 'revenue',
				targetId: 'grade-PS',
				body: 'Test comment',
			},
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('VERSION_NOT_FOUND');
	});

	it('creates a reply to a root comment', async () => {
		const parent = mockComment({ id: 10, parentId: null });
		const reply = mockComment({ id: 11, parentId: 10, body: 'Reply text' });

		mockPrisma.budgetVersion.findUnique.mockResolvedValue({ id: 1 });
		mockPrisma.comment.findUnique.mockResolvedValue(parent);
		mockPrisma.comment.create.mockResolvedValue(reply);
		const token = await makeToken();

		const res = await app.inject({
			method: 'POST',
			url: URL_BASE,
			headers: headers(token),
			payload: {
				targetType: 'revenue',
				targetId: 'grade-PS',
				parentId: 10,
				body: 'Reply text',
			},
		});

		expect(res.statusCode).toBe(201);
	});

	it('returns 404 when parent comment not found', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue({ id: 1 });
		mockPrisma.comment.findUnique.mockResolvedValue(null);
		const token = await makeToken();

		const res = await app.inject({
			method: 'POST',
			url: URL_BASE,
			headers: headers(token),
			payload: {
				targetType: 'revenue',
				targetId: 'grade-PS',
				parentId: 999,
				body: 'Reply text',
			},
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('PARENT_NOT_FOUND');
	});

	it('returns 404 when parent belongs to different version', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue({ id: 1 });
		mockPrisma.comment.findUnique.mockResolvedValue({
			id: 10,
			versionId: 999,
			targetType: 'revenue',
			targetId: 'grade-PS',
			parentId: null,
		});
		const token = await makeToken();

		const res = await app.inject({
			method: 'POST',
			url: URL_BASE,
			headers: headers(token),
			payload: {
				targetType: 'revenue',
				targetId: 'grade-PS',
				parentId: 10,
				body: 'Reply text',
			},
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('PARENT_NOT_FOUND');
	});

	it('returns 400 when replying to a reply (nested reply)', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue({ id: 1 });
		mockPrisma.comment.findUnique.mockResolvedValue({
			id: 10,
			versionId: 1,
			targetType: 'revenue',
			targetId: 'grade-PS',
			parentId: 5, // This is already a reply
		});
		const token = await makeToken();

		const res = await app.inject({
			method: 'POST',
			url: URL_BASE,
			headers: headers(token),
			payload: {
				targetType: 'revenue',
				targetId: 'grade-PS',
				parentId: 10,
				body: 'Nested reply attempt',
			},
		});

		expect(res.statusCode).toBe(400);
		expect(res.json().code).toBe('NESTED_REPLY');
	});

	it('returns 403 for Viewer role (requires data:edit)', async () => {
		const token = await makeToken('Viewer');

		const res = await app.inject({
			method: 'POST',
			url: URL_BASE,
			headers: headers(token),
			payload: {
				targetType: 'revenue',
				targetId: 'grade-PS',
				body: 'Test',
			},
		});

		expect(res.statusCode).toBe(403);
	});
});

// ── PATCH /:id — Edit comment ────────────────────────────────────────────

describe('PATCH /comments/:id', () => {
	it('edits own comment', async () => {
		mockPrisma.comment.findUnique.mockResolvedValue({
			id: 1,
			versionId: 1,
			authorId: 1,
		});
		const updated = mockComment({ body: 'Updated body' });
		mockPrisma.comment.update.mockResolvedValue(updated);
		const token = await makeToken('Admin', 1);

		const res = await app.inject({
			method: 'PATCH',
			url: `${URL_BASE}/1`,
			headers: headers(token),
			payload: { body: 'Updated body' },
		});

		expect(res.statusCode).toBe(200);
		expect(res.json().comment.body).toBe('Updated body');
	});

	it('returns 404 when comment not found', async () => {
		mockPrisma.comment.findUnique.mockResolvedValue(null);
		const token = await makeToken();

		const res = await app.inject({
			method: 'PATCH',
			url: `${URL_BASE}/999`,
			headers: headers(token),
			payload: { body: 'Updated' },
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('COMMENT_NOT_FOUND');
	});

	it('returns 404 when comment belongs to different version', async () => {
		mockPrisma.comment.findUnique.mockResolvedValue({
			id: 1,
			versionId: 999,
			authorId: 1,
		});
		const token = await makeToken();

		const res = await app.inject({
			method: 'PATCH',
			url: `${URL_BASE}/1`,
			headers: headers(token),
			payload: { body: 'Updated' },
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('COMMENT_NOT_FOUND');
	});

	it('returns 403 when editing someone else comment', async () => {
		mockPrisma.comment.findUnique.mockResolvedValue({
			id: 1,
			versionId: 1,
			authorId: 999,
		});
		const token = await makeToken('Admin', 1);

		const res = await app.inject({
			method: 'PATCH',
			url: `${URL_BASE}/1`,
			headers: headers(token),
			payload: { body: 'Trying to edit' },
		});

		expect(res.statusCode).toBe(403);
		expect(res.json().code).toBe('NOT_AUTHOR');
	});
});

// ── POST /:id/resolve — Resolve thread ──────────────────────────────────

describe('POST /comments/:id/resolve', () => {
	it('resolves a root comment', async () => {
		mockPrisma.comment.findUnique.mockResolvedValue({
			id: 1,
			versionId: 1,
			parentId: null,
			resolvedAt: null,
		});
		const resolved = mockComment({
			resolvedAt: NOW,
			resolvedById: 1,
			resolvedBy: { email: 'user1@budfin.app' },
		});
		mockPrisma.comment.update.mockResolvedValue(resolved);
		const token = await makeToken();

		const res = await app.inject({
			method: 'POST',
			url: `${URL_BASE}/1/resolve`,
			headers: headers(token),
		});

		expect(res.statusCode).toBe(200);
		expect(res.json().comment.resolvedAt).toBeTruthy();
	});

	it('returns 404 when comment not found', async () => {
		mockPrisma.comment.findUnique.mockResolvedValue(null);
		const token = await makeToken();

		const res = await app.inject({
			method: 'POST',
			url: `${URL_BASE}/999/resolve`,
			headers: headers(token),
		});

		expect(res.statusCode).toBe(404);
	});

	it('returns 400 when trying to resolve a reply', async () => {
		mockPrisma.comment.findUnique.mockResolvedValue({
			id: 2,
			versionId: 1,
			parentId: 1,
			resolvedAt: null,
		});
		const token = await makeToken();

		const res = await app.inject({
			method: 'POST',
			url: `${URL_BASE}/2/resolve`,
			headers: headers(token),
		});

		expect(res.statusCode).toBe(400);
		expect(res.json().code).toBe('NOT_ROOT_COMMENT');
	});

	it('returns 409 when already resolved', async () => {
		mockPrisma.comment.findUnique.mockResolvedValue({
			id: 1,
			versionId: 1,
			parentId: null,
			resolvedAt: NOW,
		});
		const token = await makeToken();

		const res = await app.inject({
			method: 'POST',
			url: `${URL_BASE}/1/resolve`,
			headers: headers(token),
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('ALREADY_RESOLVED');
	});
});

// ── POST /:id/unresolve — Unresolve thread ──────────────────────────────

describe('POST /comments/:id/unresolve', () => {
	it('unresolves a resolved thread', async () => {
		mockPrisma.comment.findUnique.mockResolvedValue({
			id: 1,
			versionId: 1,
			parentId: null,
			resolvedAt: NOW,
		});
		const unresolvedComment = mockComment();
		mockPrisma.comment.update.mockResolvedValue(unresolvedComment);
		const token = await makeToken();

		const res = await app.inject({
			method: 'POST',
			url: `${URL_BASE}/1/unresolve`,
			headers: headers(token),
		});

		expect(res.statusCode).toBe(200);
		expect(res.json().comment.resolvedAt).toBeNull();
	});

	it('returns 404 when comment not found', async () => {
		mockPrisma.comment.findUnique.mockResolvedValue(null);
		const token = await makeToken();

		const res = await app.inject({
			method: 'POST',
			url: `${URL_BASE}/999/unresolve`,
			headers: headers(token),
		});

		expect(res.statusCode).toBe(404);
	});

	it('returns 400 when trying to unresolve a reply', async () => {
		mockPrisma.comment.findUnique.mockResolvedValue({
			id: 2,
			versionId: 1,
			parentId: 1,
			resolvedAt: NOW,
		});
		const token = await makeToken();

		const res = await app.inject({
			method: 'POST',
			url: `${URL_BASE}/2/unresolve`,
			headers: headers(token),
		});

		expect(res.statusCode).toBe(400);
		expect(res.json().code).toBe('NOT_ROOT_COMMENT');
	});

	it('returns 409 when not resolved', async () => {
		mockPrisma.comment.findUnique.mockResolvedValue({
			id: 1,
			versionId: 1,
			parentId: null,
			resolvedAt: null,
		});
		const token = await makeToken();

		const res = await app.inject({
			method: 'POST',
			url: `${URL_BASE}/1/unresolve`,
			headers: headers(token),
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('NOT_RESOLVED');
	});
});

// ── DELETE /:id — Delete comment ─────────────────────────────────────────

describe('DELETE /comments/:id', () => {
	it('deletes own comment', async () => {
		mockPrisma.comment.findUnique.mockResolvedValue({
			id: 1,
			versionId: 1,
			authorId: 1,
		});
		mockPrisma.comment.delete.mockResolvedValue({});
		const token = await makeToken('Admin', 1);

		const res = await app.inject({
			method: 'DELETE',
			url: `${URL_BASE}/1`,
			headers: headers(token),
		});

		expect(res.statusCode).toBe(204);
	});

	it('returns 404 when comment not found', async () => {
		mockPrisma.comment.findUnique.mockResolvedValue(null);
		const token = await makeToken();

		const res = await app.inject({
			method: 'DELETE',
			url: `${URL_BASE}/999`,
			headers: headers(token),
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('COMMENT_NOT_FOUND');
	});

	it('returns 403 when deleting someone else comment', async () => {
		mockPrisma.comment.findUnique.mockResolvedValue({
			id: 1,
			versionId: 1,
			authorId: 999,
		});
		const token = await makeToken('Admin', 1);

		const res = await app.inject({
			method: 'DELETE',
			url: `${URL_BASE}/1`,
			headers: headers(token),
		});

		expect(res.statusCode).toBe(403);
		expect(res.json().code).toBe('NOT_AUTHOR');
	});
});
