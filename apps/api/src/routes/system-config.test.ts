import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { generateKeyPair } from 'jose';
import { setKeys, signAccessToken } from '../services/token.js';
import { auth } from '../plugins/auth.js';
import { systemConfigRoutes } from './system-config.js';

vi.mock('../lib/prisma.js', () => ({
	prisma: {
		systemConfig: {
			findMany: vi.fn(),
			findUnique: vi.fn(),
			update: vi.fn(),
		},
		auditEntry: {
			create: vi.fn().mockResolvedValue({ id: 1 }),
		},
	},
}));

import { prisma } from '../lib/prisma.js';

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

const mockConfigs = [
	{
		key: 'lockout_threshold',
		value: '5',
		description: 'Max failed login attempts',
		dataType: 'number',
		updatedAt: new Date(),
		updatedBy: null,
	},
	{
		key: 'max_sessions_per_user',
		value: '2',
		description: 'Max concurrent sessions',
		dataType: 'number',
		updatedAt: new Date(),
		updatedBy: null,
	},
];

beforeAll(async () => {
	const keys = await generateKeyPair('RS256');
	setKeys(keys.privateKey, keys.publicKey);

	app = Fastify({ logger: false });
	app.setValidatorCompiler(validatorCompiler);
	app.setSerializerCompiler(serializerCompiler);
	await app.register(auth);
	await app.register(systemConfigRoutes, {
		prefix: '/api/v1/system-config',
	});
	await app.ready();
});

beforeEach(() => {
	vi.clearAllMocks();
});

describe('GET /api/v1/system-config', () => {
	it('returns all config for Admin', async () => {
		vi.mocked(prisma.systemConfig.findMany).mockResolvedValue(mockConfigs);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/system-config',
			headers: authHeader(token),
		});
		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.config).toHaveLength(2);
		expect(body.config[0].key).toBe('lockout_threshold');
		expect(body.config[0].data_type).toBe('number');
	});

	it('returns 403 for non-Admin', async () => {
		const token = await makeToken({ role: 'Editor' });
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/system-config',
			headers: authHeader(token),
		});
		expect(res.statusCode).toBe(403);
	});
});

describe('PUT /api/v1/system-config', () => {
	it('updates values', async () => {
		vi.mocked(prisma.systemConfig.findUnique).mockResolvedValue(mockConfigs[0]!);
		vi.mocked(prisma.systemConfig.update).mockResolvedValue({
			...mockConfigs[0]!,
			value: '10',
		});

		const token = await makeToken();
		const res = await app.inject({
			method: 'PUT',
			url: '/api/v1/system-config',
			headers: authHeader(token),
			payload: {
				updates: [{ key: 'lockout_threshold', value: '10' }],
			},
		});
		expect(res.statusCode).toBe(200);
		expect(res.json().updated).toBe(1);
	});

	it('creates audit entries with old/new values', async () => {
		vi.mocked(prisma.systemConfig.findUnique).mockResolvedValue(mockConfigs[0]!);
		vi.mocked(prisma.systemConfig.update).mockResolvedValue({
			...mockConfigs[0]!,
			value: '10',
		});

		const token = await makeToken({ sub: 1 });
		await app.inject({
			method: 'PUT',
			url: '/api/v1/system-config',
			headers: authHeader(token),
			payload: {
				updates: [{ key: 'lockout_threshold', value: '10' }],
			},
		});

		expect(prisma.auditEntry.create).toHaveBeenCalledOnce();
		const call = vi.mocked(prisma.auditEntry.create).mock.calls[0]![0];
		expect(call.data.operation).toBe('CONFIG_UPDATED');
		expect(call.data.oldValues).toMatchObject({
			key: 'lockout_threshold',
			value: '5',
		});
		expect(call.data.newValues).toMatchObject({
			key: 'lockout_threshold',
			value: '10',
		});
	});

	it('returns updated count (skips unknown keys)', async () => {
		vi.mocked(prisma.systemConfig.findUnique)
			.mockResolvedValueOnce(mockConfigs[0]!)
			.mockResolvedValueOnce(null);
		vi.mocked(prisma.systemConfig.update).mockResolvedValue({
			...mockConfigs[0]!,
			value: '10',
		});

		const token = await makeToken();
		const res = await app.inject({
			method: 'PUT',
			url: '/api/v1/system-config',
			headers: authHeader(token),
			payload: {
				updates: [
					{ key: 'lockout_threshold', value: '10' },
					{ key: 'nonexistent_key', value: 'foo' },
				],
			},
		});
		expect(res.json().updated).toBe(1);
	});
});
