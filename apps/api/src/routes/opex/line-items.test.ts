import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { generateKeyPair } from 'jose';
import { setKeys, signAccessToken } from '../../services/token.js';
import { auth } from '../../plugins/auth.js';
import { opExLineItemRoutes } from './line-items.js';

// ── Mock Prisma ──────────────────────────────────────────────────────────────

const mockTx = {
	versionOpExLineItem: {
		create: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
		findUniqueOrThrow: vi.fn(),
		findMany: vi.fn(),
	},
	monthlyOpEx: {
		createMany: vi.fn().mockResolvedValue({ count: 0 }),
		upsert: vi.fn().mockResolvedValue({}),
	},
	budgetVersion: {
		update: vi.fn().mockResolvedValue({}),
	},
};

vi.mock('../../lib/prisma.js', () => {
	const mockPrisma = {
		budgetVersion: {
			findUnique: vi.fn(),
		},
		versionOpExLineItem: {
			findMany: vi.fn(),
			findUnique: vi.fn(),
			create: vi.fn(),
			delete: vi.fn(),
		},
		monthlyOpEx: {
			createMany: vi.fn().mockResolvedValue({ count: 0 }),
			upsert: vi.fn().mockResolvedValue({}),
		},
		auditEntry: {
			create: vi.fn().mockResolvedValue({ id: 1 }),
		},
		$transaction: vi
			.fn()
			.mockImplementation((fn: (tx: Record<string, unknown>) => unknown) => fn(mockTx)),
	};
	return { prisma: mockPrisma };
});

import { prisma } from '../../lib/prisma.js';

const mockPrisma = prisma as unknown as {
	budgetVersion: { findUnique: ReturnType<typeof vi.fn> };
	versionOpExLineItem: {
		findMany: ReturnType<typeof vi.fn>;
		findUnique: ReturnType<typeof vi.fn>;
		create: ReturnType<typeof vi.fn>;
		delete: ReturnType<typeof vi.fn>;
	};
	$transaction: ReturnType<typeof vi.fn>;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

let app: FastifyInstance;

async function makeToken(role = 'Admin') {
	return signAccessToken({
		sub: 1,
		email: 'admin@budfin.app',
		role,
		sessionId: 'test-session-id',
	});
}

function authHeader(token: string) {
	return { authorization: `Bearer ${token}` };
}

const ROUTE_PREFIX = '/api/v1/versions/:versionId';
const URL_PREFIX = '/api/v1/versions/1';

const mockDraftVersion = {
	id: 1,
	status: 'Draft',
	staleModules: [] as string[],
};

const mockLineItem = {
	id: 10,
	versionId: 1,
	sectionType: 'OPERATING',
	ifrsCategory: 'Supplies',
	lineItemName: 'Office Supplies',
	displayOrder: 1,
	computeMethod: 'MANUAL',
	computeRate: null,
	budgetV6Total: null,
	fy2025Actual: null,
	fy2024Actual: null,
	comment: null,
	entryMode: 'SEASONAL',
	activeMonths: [],
	annualTotal: null,
	flatAmount: null,
	flatOverrideMonths: [],
	monthlyAmounts: [
		{ month: 1, amount: '1000.0000' },
		{ month: 2, amount: '1200.0000' },
	],
};

beforeAll(async () => {
	const keys = await generateKeyPair('RS256');
	setKeys(keys.privateKey, keys.publicKey);

	app = Fastify({ logger: false });
	app.setValidatorCompiler(validatorCompiler);
	app.setSerializerCompiler(serializerCompiler);
	await app.register(auth);
	await app.register(opExLineItemRoutes, { prefix: ROUTE_PREFIX });
	await app.ready();
});

beforeEach(() => {
	vi.clearAllMocks();
});

// ── GET Tests ────────────────────────────────────────────────────────────────

describe('GET /api/v1/versions/:versionId/opex/line-items', () => {
	it('returns all line items for version with summary', async () => {
		mockPrisma.versionOpExLineItem.findMany.mockResolvedValue([mockLineItem]);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/opex/line-items`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.data).toHaveLength(1);
		expect(body.data[0].lineItemName).toBe('Office Supplies');
		expect(body.data[0].sectionType).toBe('OPERATING');
		expect(body.data[0].monthlyAmounts).toHaveLength(2);
		expect(body.summary).toBeDefined();
		expect(body.summary.totalOperating).toBeDefined();
	});

	it('returns empty data for version with no line items', async () => {
		mockPrisma.versionOpExLineItem.findMany.mockResolvedValue([]);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/opex/line-items`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		expect(res.json().data).toHaveLength(0);
	});

	it('Viewer can read line items (data:view)', async () => {
		mockPrisma.versionOpExLineItem.findMany.mockResolvedValue([]);

		const token = await makeToken('Viewer');
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/opex/line-items`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
	});

	it('returns 401 without auth', async () => {
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/opex/line-items`,
		});

		expect(res.statusCode).toBe(401);
	});
});

// ── POST Tests ───────────────────────────────────────────────────────────────

describe('POST /api/v1/versions/:versionId/opex/line-items', () => {
	const validBody = {
		sectionType: 'OPERATING',
		ifrsCategory: 'Supplies',
		lineItemName: 'New Office Item',
		displayOrder: 2,
		computeMethod: 'MANUAL',
		monthlyAmounts: [{ month: 1, amount: '500.0000' }],
	};

	it('creates a new line item and returns 201', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);
		const created = { ...mockLineItem, id: 20, lineItemName: 'New Office Item' };
		mockTx.versionOpExLineItem.create.mockResolvedValue(created);
		mockTx.versionOpExLineItem.findUniqueOrThrow.mockResolvedValue(created);

		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/opex/line-items`,
			headers: { ...authHeader(token), 'content-type': 'application/json' },
			payload: validBody,
		});

		expect(res.statusCode).toBe(201);
		const body = res.json();
		expect(body.lineItemName).toBe('New Office Item');
	});

	it('returns 404 when version not found or locked', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(null);

		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/opex/line-items`,
			headers: { ...authHeader(token), 'content-type': 'application/json' },
			payload: validBody,
		});

		expect(res.statusCode).toBe(404);
	});

	it('returns 404 when version is locked', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue({
			id: 1,
			status: 'Locked',
			staleModules: [],
		});

		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/opex/line-items`,
			headers: { ...authHeader(token), 'content-type': 'application/json' },
			payload: validBody,
		});

		expect(res.statusCode).toBe(404);
	});

	it('returns 403 for Viewer (needs data:edit)', async () => {
		const token = await makeToken('Viewer');
		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/opex/line-items`,
			headers: { ...authHeader(token), 'content-type': 'application/json' },
			payload: validBody,
		});

		expect(res.statusCode).toBe(403);
	});
});

// ── PUT bulk Tests ───────────────────────────────────────────────────────────

describe('PUT /api/v1/versions/:versionId/opex/line-items/bulk', () => {
	const validBulkBody = {
		lineItems: [
			{
				id: 10,
				sectionType: 'OPERATING',
				ifrsCategory: 'Supplies',
				lineItemName: 'Updated Office Supplies',
				displayOrder: 1,
				computeMethod: 'MANUAL',
				monthlyAmounts: [{ month: 1, amount: '1500.0000' }],
			},
		],
	};

	it('updates existing line items and returns data', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);
		const updatedItems = [{ ...mockLineItem, lineItemName: 'Updated Office Supplies' }];
		mockTx.versionOpExLineItem.update.mockResolvedValue(updatedItems[0]);
		mockTx.versionOpExLineItem.findMany.mockResolvedValue(updatedItems);

		const token = await makeToken();
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/opex/line-items/bulk`,
			headers: { ...authHeader(token), 'content-type': 'application/json' },
			payload: validBulkBody,
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.data).toBeDefined();
		expect(body.summary).toBeDefined();
	});

	it('returns 404 when version not found or locked', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(null);

		const token = await makeToken();
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/opex/line-items/bulk`,
			headers: { ...authHeader(token), 'content-type': 'application/json' },
			payload: validBulkBody,
		});

		expect(res.statusCode).toBe(404);
	});

	it('returns 403 for Viewer (needs data:edit)', async () => {
		const token = await makeToken('Viewer');
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/opex/line-items/bulk`,
			headers: { ...authHeader(token), 'content-type': 'application/json' },
			payload: validBulkBody,
		});

		expect(res.statusCode).toBe(403);
	});
});

// ── PUT monthly Tests ────────────────────────────────────────────────────────

describe('PUT /api/v1/versions/:versionId/opex/monthly', () => {
	const validMonthlyBody = {
		updates: [{ lineItemId: 10, month: 3, amount: '2000.0000' }],
	};

	it('updates monthly amounts and returns count', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);

		const token = await makeToken();
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/opex/monthly`,
			headers: { ...authHeader(token), 'content-type': 'application/json' },
			payload: validMonthlyBody,
		});

		expect(res.statusCode).toBe(200);
		expect(res.json().updated).toBe(1);
	});

	it('returns 404 when version not found', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(null);

		const token = await makeToken();
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/opex/monthly`,
			headers: { ...authHeader(token), 'content-type': 'application/json' },
			payload: validMonthlyBody,
		});

		expect(res.statusCode).toBe(404);
	});
});

// ── DELETE Tests ─────────────────────────────────────────────────────────────

describe('DELETE /api/v1/versions/:versionId/opex/line-items/:lineItemId', () => {
	it('deletes a line item and returns 204', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);

		const token = await makeToken();
		const res = await app.inject({
			method: 'DELETE',
			url: `${URL_PREFIX}/opex/line-items/10`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(204);
		expect(mockTx.versionOpExLineItem.delete).toHaveBeenCalledWith({
			where: { id: 10 },
		});
	});

	it('returns 404 when version not found or locked', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(null);

		const token = await makeToken();
		const res = await app.inject({
			method: 'DELETE',
			url: `${URL_PREFIX}/opex/line-items/10`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(404);
	});

	it('returns 404 when version is archived', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue({
			id: 1,
			status: 'Archived',
			staleModules: [],
		});

		const token = await makeToken();
		const res = await app.inject({
			method: 'DELETE',
			url: `${URL_PREFIX}/opex/line-items/10`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(404);
	});

	it('returns 403 for Viewer (needs data:edit)', async () => {
		const token = await makeToken('Viewer');
		const res = await app.inject({
			method: 'DELETE',
			url: `${URL_PREFIX}/opex/line-items/10`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(403);
	});
});

// ── PATCH Tests ──────────────────────────────────────────────────────────────

describe('PATCH /api/v1/versions/:versionId/opex/line-items/:lineItemId', () => {
	it('patches a line item and returns the updated record', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);
		mockPrisma.versionOpExLineItem.findUnique.mockResolvedValue({
			id: 10,
			versionId: 1,
			sectionType: 'OPERATING',
		});
		const updated = { ...mockLineItem, entryMode: 'FLAT', flatAmount: '5000.0000' };
		mockTx.versionOpExLineItem.update.mockResolvedValue(updated);
		mockTx.versionOpExLineItem.findUniqueOrThrow.mockResolvedValue(updated);

		const token = await makeToken();
		const res = await app.inject({
			method: 'PATCH',
			url: `${URL_PREFIX}/opex/line-items/10`,
			headers: { ...authHeader(token), 'content-type': 'application/json' },
			payload: { entryMode: 'FLAT', flatAmount: '5000.0000' },
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.entryMode).toBe('FLAT');
		expect(body.flatAmount).toBe('5000.0000');
	});

	it('returns 404 when version not found or locked', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(null);

		const token = await makeToken();
		const res = await app.inject({
			method: 'PATCH',
			url: `${URL_PREFIX}/opex/line-items/10`,
			headers: { ...authHeader(token), 'content-type': 'application/json' },
			payload: { comment: 'test' },
		});

		expect(res.statusCode).toBe(404);
	});

	it('returns 404 when line item not found in version', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);
		mockPrisma.versionOpExLineItem.findUnique.mockResolvedValue(null);

		const token = await makeToken();
		const res = await app.inject({
			method: 'PATCH',
			url: `${URL_PREFIX}/opex/line-items/999`,
			headers: { ...authHeader(token), 'content-type': 'application/json' },
			payload: { comment: 'test' },
		});

		expect(res.statusCode).toBe(404);
	});

	it('returns 400 for invalid IFRS category', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);
		mockPrisma.versionOpExLineItem.findUnique.mockResolvedValue({
			id: 10,
			versionId: 1,
			sectionType: 'OPERATING',
		});

		const token = await makeToken();
		const res = await app.inject({
			method: 'PATCH',
			url: `${URL_PREFIX}/opex/line-items/10`,
			headers: { ...authHeader(token), 'content-type': 'application/json' },
			payload: { ifrsCategory: 'InvalidCategory' },
		});

		expect(res.statusCode).toBe(400);
		expect(res.json().code).toBe('INVALID_IFRS_CATEGORY');
	});

	it('marks stale when entryMode changes', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);
		mockPrisma.versionOpExLineItem.findUnique.mockResolvedValue({
			id: 10,
			versionId: 1,
			sectionType: 'OPERATING',
		});
		mockTx.versionOpExLineItem.update.mockResolvedValue(mockLineItem);
		mockTx.versionOpExLineItem.findUniqueOrThrow.mockResolvedValue(mockLineItem);

		const token = await makeToken();
		await app.inject({
			method: 'PATCH',
			url: `${URL_PREFIX}/opex/line-items/10`,
			headers: { ...authHeader(token), 'content-type': 'application/json' },
			payload: { entryMode: 'FLAT' },
		});

		expect(mockTx.budgetVersion.update).toHaveBeenCalled();
	});

	it('does not mark stale when only comment changes', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);
		mockPrisma.versionOpExLineItem.findUnique.mockResolvedValue({
			id: 10,
			versionId: 1,
			sectionType: 'OPERATING',
		});
		mockTx.versionOpExLineItem.update.mockResolvedValue(mockLineItem);
		mockTx.versionOpExLineItem.findUniqueOrThrow.mockResolvedValue(mockLineItem);

		const token = await makeToken();
		await app.inject({
			method: 'PATCH',
			url: `${URL_PREFIX}/opex/line-items/10`,
			headers: { ...authHeader(token), 'content-type': 'application/json' },
			payload: { comment: 'just a comment' },
		});

		expect(mockTx.budgetVersion.update).not.toHaveBeenCalled();
	});

	it('returns 403 for Viewer (needs data:edit)', async () => {
		const token = await makeToken('Viewer');
		const res = await app.inject({
			method: 'PATCH',
			url: `${URL_PREFIX}/opex/line-items/10`,
			headers: { ...authHeader(token), 'content-type': 'application/json' },
			payload: { comment: 'test' },
		});

		expect(res.statusCode).toBe(403);
	});
});

// ── Reorder Tests ────────────────────────────────────────────────────────────

describe('PUT /api/v1/versions/:versionId/opex/line-items/reorder', () => {
	const validReorderBody = {
		moves: [
			{ lineItemId: 10, ifrsCategory: 'Rent & Utilities', displayOrder: 0 },
			{ lineItemId: 11, ifrsCategory: 'Rent & Utilities', displayOrder: 1 },
		],
	};

	it('reorders line items and returns success', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);
		mockTx.versionOpExLineItem.update.mockResolvedValue({});

		const token = await makeToken();
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/opex/line-items/reorder`,
			headers: { ...authHeader(token), 'content-type': 'application/json' },
			payload: validReorderBody,
		});

		expect(res.statusCode).toBe(200);
		expect(res.json().success).toBe(true);
		expect(mockTx.versionOpExLineItem.update).toHaveBeenCalledTimes(2);
	});

	it('returns 404 when version not found or locked', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(null);

		const token = await makeToken();
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/opex/line-items/reorder`,
			headers: { ...authHeader(token), 'content-type': 'application/json' },
			payload: validReorderBody,
		});

		expect(res.statusCode).toBe(404);
	});

	it('returns 403 for Viewer (needs data:edit)', async () => {
		const token = await makeToken('Viewer');
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/opex/line-items/reorder`,
			headers: { ...authHeader(token), 'content-type': 'application/json' },
			payload: validReorderBody,
		});

		expect(res.statusCode).toBe(403);
	});
});
