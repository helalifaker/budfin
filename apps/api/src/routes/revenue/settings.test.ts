import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { generateKeyPair } from 'jose';
import { auth } from '../../plugins/auth.js';
import { revenueSettingsRoutes } from './settings.js';
import { setKeys, signAccessToken } from '../../services/token.js';

vi.mock('../../lib/prisma.js', () => {
	const mockPrisma = {
		budgetVersion: {
			findUnique: vi.fn(),
			update: vi.fn(),
		},
		versionRevenueSettings: {
			findUnique: vi.fn(),
			update: vi.fn(),
		},
		auditEntry: {
			create: vi.fn().mockResolvedValue({ id: 1 }),
		},
		$transaction: vi
			.fn()
			.mockImplementation((fn: (tx: Record<string, unknown>) => unknown) => fn(mockPrisma)),
	};
	return { prisma: mockPrisma };
});

import { prisma } from '../../lib/prisma.js';

const mockPrisma = prisma as unknown as {
	budgetVersion: {
		findUnique: ReturnType<typeof vi.fn>;
		update: ReturnType<typeof vi.fn>;
	};
	versionRevenueSettings: {
		findUnique: ReturnType<typeof vi.fn>;
		update: ReturnType<typeof vi.fn>;
	};
	auditEntry: { create: ReturnType<typeof vi.fn> };
	$transaction: ReturnType<typeof vi.fn>;
};

let app: FastifyInstance;

async function makeToken(role = 'Admin') {
	return signAccessToken({
		sub: 1,
		email: 'admin@budfin.app',
		role,
		sessionId: 'revenue-settings-session',
	});
}

function authHeader(token: string) {
	return { authorization: `Bearer ${token}` };
}

const ROUTE_PREFIX = '/api/v1/versions/:versionId';
const URL_PREFIX = '/api/v1/versions/1';

const mockVersion = {
	id: 1,
	status: 'Draft',
	staleModules: [],
};

const mockSettings = {
	id: 1,
	versionId: 1,
	dpiPerStudentHt: '2000.0000',
	dossierPerStudentHt: '1000.0000',
	examBacPerStudent: '2000.0000',
	examDnbPerStudent: '600.0000',
	examEafPerStudent: '800.0000',
	evalPrimairePerStudent: '200.0000',
	evalSecondairePerStudent: '300.0000',
	flatDiscountPct: '0.000000',
};

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
	await app.register(revenueSettingsRoutes, { prefix: ROUTE_PREFIX });
	await app.ready();

	mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockVersion);
	mockPrisma.budgetVersion.update.mockResolvedValue({});
	mockPrisma.versionRevenueSettings.findUnique.mockResolvedValue(mockSettings);
	mockPrisma.versionRevenueSettings.update.mockResolvedValue(mockSettings);
});

describe('GET /revenue/settings', () => {
	it('returns version-scoped revenue settings', async () => {
		const token = await makeToken('Viewer');
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/revenue/settings`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual({
			settings: {
				dpiPerStudentHt: '2000.0000',
				dossierPerStudentHt: '1000.0000',
				examBacPerStudent: '2000.0000',
				examDnbPerStudent: '600.0000',
				examEafPerStudent: '800.0000',
				evalPrimairePerStudent: '200.0000',
				evalSecondairePerStudent: '300.0000',
				flatDiscountPct: '0.000000',
			},
		});
	});

	it('returns 404 when the version does not exist', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(null);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/revenue/settings`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('VERSION_NOT_FOUND');
	});

	it('returns 404 when revenue settings row does not exist', async () => {
		mockPrisma.versionRevenueSettings.findUnique.mockResolvedValue(null);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/revenue/settings`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('REVENUE_SETTINGS_NOT_FOUND');
	});
});

describe('PUT /revenue/settings', () => {
	it('updates revenue settings and marks revenue stale', async () => {
		const token = await makeToken('Editor');
		const payload = {
			...mockSettings,
			examBacPerStudent: '2300.0000',
		};

		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/revenue/settings`,
			headers: authHeader(token),
			payload,
		});

		expect(res.statusCode).toBe(200);
		expect(mockPrisma.versionRevenueSettings.update).toHaveBeenCalledWith({
			where: { versionId: 1 },
			data: {
				dpiPerStudentHt: '2000.0000',
				dossierPerStudentHt: '1000.0000',
				examBacPerStudent: '2300.0000',
				examDnbPerStudent: '600.0000',
				examEafPerStudent: '800.0000',
				evalPrimairePerStudent: '200.0000',
				evalSecondairePerStudent: '300.0000',
				flatDiscountPct: '0.000000',
				updatedBy: 1,
			},
		});
		expect(mockPrisma.budgetVersion.update).toHaveBeenCalledWith({
			where: { id: 1 },
			data: { staleModules: ['REVENUE', 'PNL'] },
		});
	});

	it('returns 409 for non-draft versions', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue({
			...mockVersion,
			status: 'Published',
		});

		const token = await makeToken();
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/revenue/settings`,
			headers: authHeader(token),
			payload: mockSettings,
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('VERSION_LOCKED');
	});

	it('returns 404 when version does not exist on PUT', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(null);

		const token = await makeToken();
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/revenue/settings`,
			headers: authHeader(token),
			payload: mockSettings,
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('VERSION_NOT_FOUND');
	});

	it('returns 403 for Viewer role', async () => {
		const token = await makeToken('Viewer');
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/revenue/settings`,
			headers: authHeader(token),
			payload: mockSettings,
		});

		expect(res.statusCode).toBe(403);
		expect(res.json().code).toBe('FORBIDDEN');
	});

	it('returns 401 without authentication', async () => {
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/revenue/settings`,
			payload: mockSettings,
		});

		expect(res.statusCode).toBe(401);
	});
});
