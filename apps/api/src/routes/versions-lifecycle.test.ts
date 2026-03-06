/**
 * Story #52 — Version Lifecycle API (state machine)
 *
 * PATCH /api/v1/versions/:id/status
 *
 * AC-04: Draft → Published (Admin/BudgetOwner)
 * AC-05: Published → Locked (Admin/BudgetOwner)
 * AC-06: Locked → Archived (Admin/BudgetOwner)
 * AC-07: Published/Locked → Draft (reverse, Admin only, audit_note ≥10 chars)
 * AC-08: reverse without valid audit_note → 400 AUDIT_NOTE_REQUIRED
 * AC-19 (partial): Editor/Viewer → 403 on PATCH /status
 * Invalid transition → 409 INVALID_TRANSITION
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { generateKeyPair } from 'jose';
import { setKeys, signAccessToken } from '../services/token.js';
import { auth } from '../plugins/auth.js';
import { versionRoutes } from './versions.js';

vi.mock('../lib/prisma.js', () => {
	const mockPrisma = {
		budgetVersion: {
			findUnique: vi.fn(),
			update: vi.fn().mockResolvedValue({}),
		},
		auditEntry: {
			create: vi.fn().mockResolvedValue({ id: 1 }),
		},
		$transaction: vi.fn().mockImplementation((fn: (tx: Record<string, unknown>) => unknown) =>
			fn({
				budgetVersion: mockPrisma.budgetVersion,
				auditEntry: mockPrisma.auditEntry,
			})
		),
	};
	return { prisma: mockPrisma };
});

import { prisma } from '../lib/prisma.js';

const mockPrisma = prisma as unknown as {
	budgetVersion: {
		findUnique: ReturnType<typeof vi.fn>;
		update: ReturnType<typeof vi.fn>;
	};
	auditEntry: { create: ReturnType<typeof vi.fn> };
	$transaction: ReturnType<typeof vi.fn>;
};

let app: FastifyInstance;
const now = new Date();

async function makeToken(overrides: { sub?: number; role?: string } = {}) {
	return signAccessToken({
		sub: overrides.sub ?? 1,
		email: 'admin@budfin.app',
		role: overrides.role ?? 'Admin',
	});
}

function authHeader(token: string) {
	return { authorization: `Bearer ${token}` };
}

function makeDraft(overrides: Record<string, unknown> = {}) {
	return {
		id: 1,
		fiscalYear: 2026,
		name: 'Budget v1',
		type: 'Budget',
		status: 'Draft',
		description: null,
		dataSource: 'CALCULATED',
		sourceVersionId: null,
		modificationCount: 0,
		staleModules: [],
		createdById: 1,
		publishedAt: null,
		lockedAt: null,
		archivedAt: null,
		createdAt: now,
		updatedAt: now,
		createdBy: { email: 'admin@budfin.app' },
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
	await app.register(versionRoutes, { prefix: '/api/v1/versions' });
	await app.ready();
});

// ── AC-04: Draft → Published ──────────────────────────────────────────────────

describe('PATCH /api/v1/versions/:id/status — lifecycle transitions', () => {
	it('AC-04: Draft → Published sets publishedAt and writes audit entry', async () => {
		const draft = makeDraft({ status: 'Draft' });
		const published = {
			...draft,
			status: 'Published',
			publishedAt: now,
			createdBy: { email: 'admin@budfin.app' },
		};
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(draft);
		mockPrisma.budgetVersion.update.mockResolvedValue(published);

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'PATCH',
			url: '/api/v1/versions/1/status',
			headers: authHeader(token),
			payload: { new_status: 'Published' },
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.status).toBe('Published');
		expect(mockPrisma.auditEntry.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ operation: 'VERSION_PUBLISHED' }),
			})
		);
	});

	it('AC-04: BudgetOwner can publish Draft version', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(makeDraft({ status: 'Draft' }));
		mockPrisma.budgetVersion.update.mockResolvedValue({
			...makeDraft({ status: 'Published' }),
			createdBy: { email: 'admin@budfin.app' },
		});

		const token = await makeToken({ role: 'BudgetOwner' });
		const res = await app.inject({
			method: 'PATCH',
			url: '/api/v1/versions/1/status',
			headers: authHeader(token),
			payload: { new_status: 'Published' },
		});

		expect(res.statusCode).toBe(200);
	});

	// AC-05: Published → Locked
	it('AC-05: Published → Locked sets lockedAt', async () => {
		const published = makeDraft({ status: 'Published', publishedAt: now });
		const locked = {
			...published,
			status: 'Locked',
			lockedAt: now,
			createdBy: { email: 'admin@budfin.app' },
		};
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(published);
		mockPrisma.budgetVersion.update.mockResolvedValue(locked);

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'PATCH',
			url: '/api/v1/versions/1/status',
			headers: authHeader(token),
			payload: { new_status: 'Locked' },
		});

		expect(res.statusCode).toBe(200);
		expect(res.json().status).toBe('Locked');
		expect(mockPrisma.auditEntry.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ operation: 'VERSION_LOCKED' }),
			})
		);
	});

	// AC-06: Locked → Archived
	it('AC-06: Locked → Archived sets archivedAt', async () => {
		const locked = makeDraft({ status: 'Locked', publishedAt: now, lockedAt: now });
		const archived = {
			...locked,
			status: 'Archived',
			archivedAt: now,
			createdBy: { email: 'admin@budfin.app' },
		};
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(locked);
		mockPrisma.budgetVersion.update.mockResolvedValue(archived);

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'PATCH',
			url: '/api/v1/versions/1/status',
			headers: authHeader(token),
			payload: { new_status: 'Archived' },
		});

		expect(res.statusCode).toBe(200);
		expect(res.json().status).toBe('Archived');
	});

	// AC-07: reverse transition (Published → Draft)
	it('AC-07: Published → Draft with valid audit_note increments modificationCount', async () => {
		const published = makeDraft({ status: 'Published', publishedAt: now });
		const reverted = {
			...published,
			status: 'Draft',
			publishedAt: null,
			modificationCount: 1,
			createdBy: { email: 'admin@budfin.app' },
		};
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(published);
		mockPrisma.budgetVersion.update.mockResolvedValue(reverted);

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'PATCH',
			url: '/api/v1/versions/1/status',
			headers: authHeader(token),
			payload: { new_status: 'Draft', audit_note: 'Reverted for corrections' },
		});

		expect(res.statusCode).toBe(200);
		expect(res.json().status).toBe('Draft');
		expect(mockPrisma.auditEntry.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					operation: 'VERSION_REVERTED',
					newValues: expect.objectContaining({ audit_note: 'Reverted for corrections' }),
				}),
			})
		);
	});

	// AC-08: reverse without audit_note
	it('AC-08: reverse transition without audit_note → 400 AUDIT_NOTE_REQUIRED', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(makeDraft({ status: 'Published' }));

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'PATCH',
			url: '/api/v1/versions/1/status',
			headers: authHeader(token),
			payload: { new_status: 'Draft' },
		});

		expect(res.statusCode).toBe(400);
		expect(res.json().code).toBe('AUDIT_NOTE_REQUIRED');
	});

	it('AC-08: reverse transition with audit_note < 10 chars → 400 AUDIT_NOTE_REQUIRED', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(makeDraft({ status: 'Published' }));

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'PATCH',
			url: '/api/v1/versions/1/status',
			headers: authHeader(token),
			payload: { new_status: 'Draft', audit_note: 'Short' },
		});

		expect(res.statusCode).toBe(400);
		expect(res.json().code).toBe('AUDIT_NOTE_REQUIRED');
	});

	// Invalid transitions
	it('Draft → Archived → 409 INVALID_TRANSITION', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(makeDraft({ status: 'Draft' }));

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'PATCH',
			url: '/api/v1/versions/1/status',
			headers: authHeader(token),
			payload: { new_status: 'Archived' },
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('INVALID_TRANSITION');
	});

	it('Draft → Locked → 409 INVALID_TRANSITION', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(makeDraft({ status: 'Draft' }));

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'PATCH',
			url: '/api/v1/versions/1/status',
			headers: authHeader(token),
			payload: { new_status: 'Locked' },
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('INVALID_TRANSITION');
	});

	it('Archived → Draft → 409 INVALID_TRANSITION (cannot revert from Archived)', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(
			makeDraft({ status: 'Archived', publishedAt: now, lockedAt: now, archivedAt: now })
		);

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'PATCH',
			url: '/api/v1/versions/1/status',
			headers: authHeader(token),
			payload: { new_status: 'Draft', audit_note: 'Trying to revert archived version' },
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('INVALID_TRANSITION');
	});

	// AC-19: RBAC
	it('AC-19: Editor gets 403 on PATCH /status', async () => {
		const token = await makeToken({ role: 'Editor' });
		const res = await app.inject({
			method: 'PATCH',
			url: '/api/v1/versions/1/status',
			headers: authHeader(token),
			payload: { new_status: 'Published' },
		});

		expect(res.statusCode).toBe(403);
	});

	it('AC-19: Viewer gets 403 on PATCH /status', async () => {
		const token = await makeToken({ role: 'Viewer' });
		const res = await app.inject({
			method: 'PATCH',
			url: '/api/v1/versions/1/status',
			headers: authHeader(token),
			payload: { new_status: 'Published' },
		});

		expect(res.statusCode).toBe(403);
	});

	it('returns 404 when version not found', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(null);

		const token = await makeToken({ role: 'Admin' });
		const res = await app.inject({
			method: 'PATCH',
			url: '/api/v1/versions/999/status',
			headers: authHeader(token),
			payload: { new_status: 'Published' },
		});

		expect(res.statusCode).toBe(404);
	});
});
