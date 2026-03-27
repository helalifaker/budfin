import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { generateKeyPair } from 'jose';
import { Prisma } from '@prisma/client';
import { setKeys, signAccessToken } from '../../services/token.js';
import { auth } from '../../plugins/auth.js';
import { pnlTemplateRoutes } from './pnl-templates.js';

vi.mock('../../lib/prisma.js', () => {
	const mockPrisma = {
		pnlTemplate: {
			findMany: vi.fn(),
			findUnique: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
			updateMany: vi.fn(),
			delete: vi.fn(),
		},
		pnlTemplateSection: {
			deleteMany: vi.fn(),
			create: vi.fn(),
		},
		pnlAccountMapping: {
			createMany: vi.fn(),
		},
		auditEntry: {
			create: vi.fn().mockResolvedValue({ id: 1 }),
		},
		$transaction: vi.fn().mockImplementation((fn: (tx: Record<string, unknown>) => unknown) =>
			fn({
				pnlTemplate: mockPrisma.pnlTemplate,
				pnlTemplateSection: mockPrisma.pnlTemplateSection,
				pnlAccountMapping: mockPrisma.pnlAccountMapping,
				auditEntry: mockPrisma.auditEntry,
			})
		),
	};
	return { prisma: mockPrisma };
});

import { prisma } from '../../lib/prisma.js';

let app: FastifyInstance;

async function makeToken(overrides: { sub?: number; role?: string } = {}) {
	return signAccessToken({
		sub: overrides.sub ?? 1,
		email: 'admin@budfin.app',
		role: overrides.role ?? 'Admin',
		sessionId: 'test-session-id',
	});
}

function authHeader(token: string) {
	return { authorization: `Bearer ${token}` };
}

const now = new Date();

const mockTemplate = {
	id: 1,
	name: 'Standard P&L',
	isDefault: true,
	isSystem: false,
	version: 1,
	createdAt: now,
	updatedAt: now,
	createdBy: 1,
	updatedBy: 1,
};

const mockTemplateWithCount = {
	...mockTemplate,
	_count: { sections: 3 },
};

const mockSection = {
	id: 10,
	templateId: 1,
	sectionKey: 'REVENUE',
	displayLabel: 'Revenue',
	displayOrder: 1,
	isSubtotal: false,
	subtotalFormula: null,
	signConvention: 'POSITIVE',
};

const mockMapping = {
	id: 100,
	sectionId: 10,
	analyticalKey: 'tuition',
	analyticalKeyType: 'LINE_ITEM',
	accountCode: 'REV001',
	monthFilter: [],
	displayLabel: 'Tuition Revenue',
	visibility: 'SHOW',
	displayOrder: 1,
	profitCenterAllocation: 'HEADCOUNT',
	manualAllocation: null,
};

beforeAll(async () => {
	const keys = await generateKeyPair('RS256');
	setKeys(keys.privateKey, keys.publicKey);

	app = Fastify({ logger: false });
	app.setValidatorCompiler(validatorCompiler);
	app.setSerializerCompiler(serializerCompiler);
	await app.register(auth);
	await app.register(pnlTemplateRoutes, {
		prefix: '/api/v1/master-data/pnl-templates',
	});
	await app.ready();
});

beforeEach(() => {
	vi.clearAllMocks();
});

describe('GET /api/v1/master-data/pnl-templates', () => {
	it('returns all templates with section counts', async () => {
		vi.mocked(prisma.pnlTemplate.findMany).mockResolvedValue([mockTemplateWithCount] as never);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/master-data/pnl-templates',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.templates).toHaveLength(1);
		expect(body.templates[0]._count.sections).toBe(3);
	});

	it('is accessible by Viewer role', async () => {
		vi.mocked(prisma.pnlTemplate.findMany).mockResolvedValue([]);

		const token = await makeToken({ role: 'Viewer' });
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/master-data/pnl-templates',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
	});

	it('returns 401 without auth', async () => {
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/master-data/pnl-templates',
		});

		expect(res.statusCode).toBe(401);
	});
});

describe('POST /api/v1/master-data/pnl-templates', () => {
	const createPayload = {
		name: 'New Template',
		isDefault: false,
	};

	it('creates template with 201', async () => {
		vi.mocked(prisma.pnlTemplate.create).mockResolvedValue(mockTemplate);

		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/master-data/pnl-templates',
			headers: authHeader(token),
			payload: createPayload,
		});

		expect(res.statusCode).toBe(201);
		expect(res.json().name).toBe('Standard P&L');
		expect(prisma.auditEntry.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					operation: 'PNL_TEMPLATE_CREATED',
					tableName: 'pnl_templates',
				}),
			})
		);
	});

	it('returns 409 for duplicate name', async () => {
		const error = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
			code: 'P2002',
			clientVersion: '6.0.0',
		});
		vi.mocked(prisma.pnlTemplate.create).mockRejectedValue(error);

		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/master-data/pnl-templates',
			headers: authHeader(token),
			payload: createPayload,
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('DUPLICATE_NAME');
	});

	it('returns 403 for Viewer role', async () => {
		const token = await makeToken({ role: 'Viewer' });
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/master-data/pnl-templates',
			headers: authHeader(token),
			payload: createPayload,
		});

		expect(res.statusCode).toBe(403);
	});

	it('returns 400 for missing name', async () => {
		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/master-data/pnl-templates',
			headers: authHeader(token),
			payload: {},
		});

		expect(res.statusCode).toBe(400);
	});
});

describe('PUT /api/v1/master-data/pnl-templates/:id', () => {
	const updatePayload = {
		name: 'Updated Template',
		isDefault: false,
		version: 1,
	};

	it('updates template with optimistic lock', async () => {
		const updatedTemplate = { ...mockTemplate, name: 'Updated Template', version: 2 };
		vi.mocked(prisma.pnlTemplate.findUnique)
			.mockResolvedValueOnce(mockTemplate)
			.mockResolvedValueOnce(updatedTemplate);
		vi.mocked(prisma.pnlTemplate.updateMany).mockResolvedValue({ count: 1 });

		const token = await makeToken();
		const res = await app.inject({
			method: 'PUT',
			url: '/api/v1/master-data/pnl-templates/1',
			headers: authHeader(token),
			payload: updatePayload,
		});

		expect(res.statusCode).toBe(200);
		expect(res.json().name).toBe('Updated Template');
		expect(prisma.auditEntry.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					operation: 'PNL_TEMPLATE_UPDATED',
				}),
			})
		);
	});

	it('returns 404 for non-existent id', async () => {
		vi.mocked(prisma.pnlTemplate.findUnique).mockResolvedValue(null);

		const token = await makeToken();
		const res = await app.inject({
			method: 'PUT',
			url: '/api/v1/master-data/pnl-templates/999',
			headers: authHeader(token),
			payload: updatePayload,
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('NOT_FOUND');
	});

	it('returns 409 for version mismatch', async () => {
		vi.mocked(prisma.pnlTemplate.findUnique).mockResolvedValue(mockTemplate);
		vi.mocked(prisma.pnlTemplate.updateMany).mockResolvedValue({ count: 0 });

		const token = await makeToken();
		const res = await app.inject({
			method: 'PUT',
			url: '/api/v1/master-data/pnl-templates/1',
			headers: authHeader(token),
			payload: updatePayload,
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('OPTIMISTIC_LOCK');
	});

	it('returns 403 for Viewer role', async () => {
		const token = await makeToken({ role: 'Viewer' });
		const res = await app.inject({
			method: 'PUT',
			url: '/api/v1/master-data/pnl-templates/1',
			headers: authHeader(token),
			payload: updatePayload,
		});

		expect(res.statusCode).toBe(403);
	});
});

describe('DELETE /api/v1/master-data/pnl-templates/:id', () => {
	it('deletes template with 204', async () => {
		vi.mocked(prisma.pnlTemplate.findUnique).mockResolvedValue(mockTemplate);
		vi.mocked(prisma.pnlTemplate.delete).mockResolvedValue(mockTemplate);

		const token = await makeToken();
		const res = await app.inject({
			method: 'DELETE',
			url: '/api/v1/master-data/pnl-templates/1',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(204);
		expect(prisma.auditEntry.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					operation: 'PNL_TEMPLATE_DELETED',
				}),
			})
		);
	});

	it('returns 403 for system template', async () => {
		const systemTemplate = { ...mockTemplate, isSystem: true };
		vi.mocked(prisma.pnlTemplate.findUnique).mockResolvedValue(systemTemplate);

		const token = await makeToken();
		const res = await app.inject({
			method: 'DELETE',
			url: '/api/v1/master-data/pnl-templates/1',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(403);
		expect(res.json().code).toBe('SYSTEM_TEMPLATE');
	});

	it('returns 404 for non-existent id', async () => {
		vi.mocked(prisma.pnlTemplate.findUnique).mockResolvedValue(null);

		const token = await makeToken();
		const res = await app.inject({
			method: 'DELETE',
			url: '/api/v1/master-data/pnl-templates/999',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(404);
	});

	it('returns 403 for Viewer role', async () => {
		const token = await makeToken({ role: 'Viewer' });
		const res = await app.inject({
			method: 'DELETE',
			url: '/api/v1/master-data/pnl-templates/1',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(403);
	});
});

describe('GET /api/v1/master-data/pnl-templates/:id/mappings', () => {
	it('returns template with full nested structure', async () => {
		const templateWithSections = {
			...mockTemplate,
			sections: [
				{
					...mockSection,
					mappings: [mockMapping],
				},
			],
		};
		vi.mocked(prisma.pnlTemplate.findUnique).mockResolvedValue(templateWithSections as never);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/master-data/pnl-templates/1/mappings',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.sections).toHaveLength(1);
		expect(body.sections[0].mappings).toHaveLength(1);
		expect(body.sections[0].mappings[0].analyticalKey).toBe('tuition');
	});

	it('returns 404 for non-existent template', async () => {
		vi.mocked(prisma.pnlTemplate.findUnique).mockResolvedValue(null);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/master-data/pnl-templates/999/mappings',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('NOT_FOUND');
	});
});

describe('PUT /api/v1/master-data/pnl-templates/:id/mappings', () => {
	const bulkPayload = {
		sections: [
			{
				sectionKey: 'REVENUE',
				displayLabel: 'Revenue',
				displayOrder: 1,
				isSubtotal: false,
				signConvention: 'POSITIVE',
				mappings: [
					{
						analyticalKey: 'tuition',
						analyticalKeyType: 'LINE_ITEM',
						accountCode: 'REV001',
						displayOrder: 1,
					},
				],
			},
		],
	};

	it('bulk saves sections and mappings', async () => {
		vi.mocked(prisma.pnlTemplate.findUnique)
			.mockResolvedValueOnce(mockTemplate)
			.mockResolvedValueOnce({
				...mockTemplate,
				sections: [{ ...mockSection, mappings: [mockMapping] }],
			} as never);
		vi.mocked(prisma.pnlTemplateSection.deleteMany).mockResolvedValue({ count: 0 });
		vi.mocked(prisma.pnlTemplateSection.create).mockResolvedValue(mockSection);
		vi.mocked(prisma.pnlAccountMapping.createMany).mockResolvedValue({ count: 1 });

		const token = await makeToken();
		const res = await app.inject({
			method: 'PUT',
			url: '/api/v1/master-data/pnl-templates/1/mappings',
			headers: authHeader(token),
			payload: bulkPayload,
		});

		expect(res.statusCode).toBe(200);
		expect(prisma.pnlTemplateSection.deleteMany).toHaveBeenCalledWith({ where: { templateId: 1 } });
		expect(prisma.pnlTemplateSection.create).toHaveBeenCalledTimes(1);
		expect(prisma.pnlAccountMapping.createMany).toHaveBeenCalledTimes(1);
		expect(prisma.auditEntry.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					operation: 'PNL_TEMPLATE_MAPPINGS_UPDATED',
				}),
			})
		);
	});

	it('returns 404 for non-existent template', async () => {
		vi.mocked(prisma.pnlTemplate.findUnique).mockResolvedValue(null);

		const token = await makeToken();
		const res = await app.inject({
			method: 'PUT',
			url: '/api/v1/master-data/pnl-templates/999/mappings',
			headers: authHeader(token),
			payload: bulkPayload,
		});

		expect(res.statusCode).toBe(404);
	});

	it('handles empty sections array', async () => {
		vi.mocked(prisma.pnlTemplate.findUnique)
			.mockResolvedValueOnce(mockTemplate)
			.mockResolvedValueOnce({ ...mockTemplate, sections: [] } as never);
		vi.mocked(prisma.pnlTemplateSection.deleteMany).mockResolvedValue({ count: 0 });

		const token = await makeToken();
		const res = await app.inject({
			method: 'PUT',
			url: '/api/v1/master-data/pnl-templates/1/mappings',
			headers: authHeader(token),
			payload: { sections: [] },
		});

		expect(res.statusCode).toBe(200);
		expect(prisma.pnlTemplateSection.deleteMany).toHaveBeenCalled();
		expect(prisma.pnlTemplateSection.create).not.toHaveBeenCalled();
	});

	it('returns 403 for Viewer role', async () => {
		const token = await makeToken({ role: 'Viewer' });
		const res = await app.inject({
			method: 'PUT',
			url: '/api/v1/master-data/pnl-templates/1/mappings',
			headers: authHeader(token),
			payload: bulkPayload,
		});

		expect(res.statusCode).toBe(403);
	});
});
